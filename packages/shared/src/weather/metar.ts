import { deriveMetar } from './derive'
import { ConditionsBuilder, isColourState, isWeatherLike, tokenize } from './groups'
import type { DecodedMetar, Rvr, TrendGroup, WeatherGroup } from './schema'
import { resolveDayTime, resolveHourMinuteAfter, toDate, type DateInput } from './time'
import { parseWeatherGroup, toWeatherGroup } from './wx'

/**
 * METAR/SPECI çözücüsü (WMO FM 15; MGM Havacılık Meteorolojisi IV; WMO-782). Ham metin esastır:
 * görüş, bulut, sıcaklık ve rüzgâr buradan çözülür. Çözücü atmaz; tanımadığı parçaları `unparsed`
 * listesine koyar. Gövdede hava olayına benzeyen tanınmayan parça varsa ya da hava olayı
 * gözlenemediyse (`//`) `derived.weatherUndetermined` true olur.
 */

export interface DecodeMetarOptions {
  /**
   * Kayıttaki gözlem zamanı (AWC `obsTime`); ham `DDHHMMZ` grubundan önceliklidir ve TREND
   * saatleri (FM/TL/AT) buna göre takvime oturtulur.
   */
  observedAt?: DateInput | null
  /** Gözlem zamanı verilmezse ham `DDHHMMZ`'nin en yakın oturtulacağı an (ör. alınma zamanı). */
  referenceTime?: DateInput | null
}

const STATION_RE = /^[A-Z][A-Z0-9]{3}$/
const TIME_RE = /^(\d{2})(\d{2})(\d{2})Z$/
const HEADER_WORDS = new Set(['METAR', 'SPECI', 'AUTO', 'NIL', 'COR', 'CAVOK', 'NOSIG', 'NSC'])
const TREND_START = new Set(['NOSIG', 'BECMG', 'TEMPO'])

const RVR_RE = /^R(\d{2}[LCR]?)\/([PM])?(\d{4})(?:V([PM])?(\d{4}))?(FT)?(?:\/?([UDN]))?$/
const RVR_MISSING_RE = /^R(\d{2}[LCR]?)\/\/{4,6}[UDN]?$/
const TEMP_RE = /^(M?\d{1,2}|\/\/)\/(M?\d{1,2}|\/\/)?$/
const QNH_RE = /^Q(\d{4}|\/{4})$/
const ALTIMETER_RE = /^A(\d{4}|\/{4})$/
const RUNWAY_STATE_RE = /^R\d{2}[LCR]?\/(?:[0-9/]{6}|CLRD[0-9/]{2})$|^R\/SNOCLO$|^SNOCLO$/
const SEA_RE = /^W(?:M?\d{2}|\/\/)\/(?:S[\d/]|H[\d/]{1,3})$/
const WS_RUNWAY_RE = /^(?:R|RWY)(\d{2}[LCR]?)$/

/**
 * Pist yüzeyi durumu grubu (`R11/290195`, `R88/CLRD//`, `R/SNOCLO`, `SNOCLO`; MGM Havacılık
 * Meteorolojisi IV.1.3.9.5). Çözücü tanır ama ayrıntısını çözmez; hava olayı değildir.
 */
export function isRunwayStateGroup(token: string): boolean {
  return RUNWAY_STATE_RE.test(token)
}

/** Deniz yüzeyi sıcaklığı ve durumu grubu (`W15/S2`, `W12/H75`); tanınır, çözülmez. */
export function isSeaStateGroup(token: string): boolean {
  return SEA_RE.test(token)
}

/** Rüzgâr kesmesi grubunun pisti (`WS R35`, `WS RWY35`); pist kodu ya da null. */
export function windShearRunway(token: string): string | null {
  return WS_RUNWAY_RE.exec(token)?.[1] ?? null
}
const TREND_TIME_RE = /^(FM|TL|AT)(\d{4})$/

const HPA_PER_INHG = 33.8639
const M_PER_FT = 0.3048

function validDate(value: DateInput | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  const date = toDate(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function temperature(part: string | undefined): number | null {
  if (part === undefined || part.startsWith('/')) return null
  const value = Number(part.replace('M', '-'))
  // "M00" eksi sıfırdır; JSON'da -0 yazılmasın.
  return value === 0 ? 0 : value
}

function rvrMeters(value: string, feet: boolean): number {
  const n = Number(value)
  return feet ? Math.round(n * M_PER_FT) : n
}

function parseRvr(token: string): Rvr | undefined {
  const match = RVR_RE.exec(token)
  if (match) {
    const [, runway = '', q1, v1 = '', q2, v2, ft, tendency] = match
    const feet = ft === 'FT'
    const qualifier = (q: string | undefined) => (q === 'P' ? 'above' : q === 'M' ? 'below' : null)
    return {
      runway,
      meters: rvrMeters(v1, feet),
      qualifier: qualifier(q1),
      varyingToMeters: v2 === undefined ? null : rvrMeters(v2, feet),
      varyingToQualifier: v2 === undefined ? null : qualifier(q2),
      tendency:
        tendency === 'U' ? 'up' : tendency === 'D' ? 'down' : tendency === 'N' ? 'none' : null,
    }
  }
  const missing = RVR_MISSING_RE.exec(token)
  if (missing) {
    return {
      runway: missing[1] ?? '',
      meters: null,
      qualifier: null,
      varyingToMeters: null,
      varyingToQualifier: null,
      tendency: null,
    }
  }
  return undefined
}

/** TREND bölümü (NOSIG, BECMG, TEMPO); RMK'ye kadar. */
function parseTrend(
  tokens: readonly string[],
  start: number,
  observedAt: Date | null,
): { trend: TrendGroup[]; nosig: boolean; remarks: string | null; unparsed: string[] } {
  const trend: TrendGroup[] = []
  const unparsed: string[] = []
  let nosig = false
  let remarks: string | null = null
  let i = start
  while (i < tokens.length) {
    const token = tokens[i] ?? ''
    if (token === 'RMK') {
      remarks = tokens.slice(i + 1).join(' ') || null
      break
    }
    if (token === 'NOSIG') {
      nosig = true
      i++
      continue
    }
    if (token !== 'BECMG' && token !== 'TEMPO') {
      if (!isColourState(token)) unparsed.push(token)
      i++
      continue
    }
    const kind = token
    const groupTokens: string[] = []
    i++
    while (i < tokens.length && !TREND_START.has(tokens[i] ?? '') && tokens[i] !== 'RMK') {
      groupTokens.push(tokens[i] ?? '')
      i++
    }
    const builder = new ConditionsBuilder()
    const times: Record<'FM' | 'TL' | 'AT', string | null> = { FM: null, TL: null, AT: null }
    for (let j = 0; j < groupTokens.length;) {
      const part = groupTokens[j] ?? ''
      const time = TREND_TIME_RE.exec(part)
      if (time) {
        const resolved = observedAt ? resolveHourMinuteAfter(time[2] ?? '', observedAt) : null
        times[time[1] as 'FM' | 'TL' | 'AT'] = resolved ? resolved.toISOString() : null
        j++
        continue
      }
      const used = builder.accept(part, groupTokens[j + 1])
      if (used > 0) {
        j += used
        continue
      }
      if (!isColourState(part)) builder.unparsed.push(part)
      j++
    }
    trend.push({
      kind,
      raw: [kind, ...groupTokens].join(' '),
      from: times.FM,
      until: times.TL,
      at: times.AT,
      wind: builder.windSeen ? builder.wind : null,
      visibility: builder.visibilitySeen ? builder.visibility : null,
      cavok: builder.cavok,
      weather: builder.weather,
      nsw: builder.nsw,
      sky: builder.sky(),
      unparsed: builder.unparsed,
    })
    unparsed.push(...builder.unparsed)
  }
  return { trend, nosig, remarks, unparsed }
}

/** METAR ya da SPECI ham metnini çözer. */
export function decodeMetar(raw: string, options: DecodeMetarOptions = {}): DecodedMetar {
  const tokens = tokenize(raw)
  let i = 0
  let type: DecodedMetar['type'] = 'METAR'
  let corrected = false
  let auto = false
  let nil = false
  let station: string | null = null
  let time: { day: number; hour: number; minute: number } | null = null

  const first = tokens[i]
  if (first === 'METAR' || first === 'SPECI') {
    type = first
    i++
  }
  while (tokens[i] === 'COR') {
    corrected = true
    i++
  }
  const stationToken = tokens[i] ?? ''
  if (STATION_RE.test(stationToken) && !HEADER_WORDS.has(stationToken)) {
    station = stationToken
    i++
  }
  const timeMatch = TIME_RE.exec(tokens[i] ?? '')
  if (timeMatch) {
    time = { day: Number(timeMatch[1]), hour: Number(timeMatch[2]), minute: Number(timeMatch[3]) }
    i++
  }
  for (;;) {
    const word = tokens[i]
    if (word === 'NIL') nil = true
    else if (word === 'AUTO') auto = true
    else if (word === 'COR' || word === 'CCA' || word === 'CCB') corrected = true
    else break
    i++
  }

  const observedAt =
    validDate(options.observedAt) ??
    (() => {
      const reference = validDate(options.referenceTime)
      return time && reference ? resolveDayTime(time.day, time.hour, time.minute, reference) : null
    })()

  const body = new ConditionsBuilder()
  const rvr: Rvr[] = []
  const recent: WeatherGroup[] = []
  const bodyUnparsed: string[] = []
  let temperatureC: number | null = null
  let dewPointC: number | null = null
  let qnhHpa: number | null = null
  let windShearAll = false
  const windShearRunways: string[] = []
  let weatherNotObserved = false
  let trend: TrendGroup[] = []
  let nosig = false
  let remarks: string | null = null
  let trendUnparsed: string[] = []

  while (i < tokens.length && !nil) {
    const token = tokens[i] ?? ''
    const next = tokens[i + 1]
    if (token === 'RMK') {
      remarks = tokens.slice(i + 1).join(' ') || null
      break
    }
    if (TREND_START.has(token)) {
      const parsed = parseTrend(tokens, i, observedAt)
      trend = parsed.trend
      nosig = parsed.nosig
      remarks = parsed.remarks
      trendUnparsed = parsed.unparsed
      break
    }
    const used = body.accept(token, next)
    if (used > 0) {
      i += used
      continue
    }
    i++
    if (token === '//') {
      weatherNotObserved = true
      continue
    }
    const runwayRange = parseRvr(token)
    if (runwayRange) {
      rvr.push(runwayRange)
      continue
    }
    const temp = TEMP_RE.exec(token)
    if (temp) {
      temperatureC = temperature(temp[1])
      dewPointC = temperature(temp[2])
      continue
    }
    const qnh = QNH_RE.exec(token)
    if (qnh) {
      qnhHpa = qnh[1]?.startsWith('/') ? null : Number(qnh[1])
      continue
    }
    const altimeter = ALTIMETER_RE.exec(token)
    if (altimeter) {
      qnhHpa = altimeter[1]?.startsWith('/')
        ? null
        : Math.round((Number(altimeter[1]) / 100) * HPA_PER_INHG)
      continue
    }
    if (token === 'RE//') continue
    const group = parseWeatherGroup(token)
    if (group?.recent) {
      recent.push(toWeatherGroup(group))
      continue
    }
    if (token === 'WS') {
      if (next === 'TKOF' || next === 'LDG') i++
      const target = tokens[i]
      if (target === 'ALL' && tokens[i + 1] === 'RWY') {
        windShearAll = true
        i += 2
        continue
      }
      const runway = WS_RUNWAY_RE.exec(target ?? '')
      if (runway) {
        windShearRunways.push(runway[1] ?? '')
        i++
        continue
      }
      bodyUnparsed.push(token)
      continue
    }
    if (RUNWAY_STATE_RE.test(token) || SEA_RE.test(token) || isColourState(token)) continue
    if (token === 'AUTO') {
      auto = true
      continue
    }
    if (token === 'COR') {
      corrected = true
      continue
    }
    bodyUnparsed.push(token)
  }
  if (nil) bodyUnparsed.push(...tokens.slice(i))

  const fields: Omit<DecodedMetar, 'derived'> = {
    station,
    type,
    observedAt: observedAt ? observedAt.toISOString() : null,
    raw,
    auto,
    corrected,
    nil,
    wind: body.windSeen ? body.wind : null,
    visibility: body.visibilitySeen ? body.visibility : null,
    cavok: body.cavok,
    rvr,
    weather: body.weather,
    recent,
    sky: body.sky() ?? { kind: 'unknown', layers: [], verticalVisibilityFt: null },
    temperatureC,
    dewPointC,
    qnhHpa,
    windShear:
      windShearAll || windShearRunways.length > 0
        ? { allRunways: windShearAll, runways: windShearRunways }
        : null,
    trend,
    nosig,
    flightCategory: null,
    remarks,
    unparsed: [...bodyUnparsed, ...trendUnparsed],
  }
  const unreadable = station === null && time === null
  // Geçerli her METAR'da görüş grubu (ya da CAVOK, `////`) vardır; yoksa rapor kesik sayılır.
  const truncated = !body.visibilitySeen
  const weatherUndetermined =
    nil || unreadable || truncated || weatherNotObserved || bodyUnparsed.some(isWeatherLike)
  return { ...fields, derived: deriveMetar(fields, weatherUndetermined) }
}
