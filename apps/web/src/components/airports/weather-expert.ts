import {
  format,
  formatClock,
  formatDayTime,
  formatFeet,
  formatHeight,
  formatPressure,
  formatTemperature,
  formatUtcClock,
  formatVisibility,
  formatWindSpeedBoth,
  NO_VALUE,
  weatherText,
  type WeatherTextOptions,
} from '@havayolu/i18n'
import {
  changeText,
  cloudsText,
  isColourState,
  isRunwayStateGroup,
  isSeaStateGroup,
  offScaleWind,
  visibilityText,
  windShearRunway,
  weatherGroupText,
  type AirportMetar,
  type AirportTaf,
  type CloudCover,
  type Rvr,
  type TafPeriod,
  type WeatherGroup,
  type Wind,
} from '@havayolu/shared'

/**
 * Uzman ayrıntıları (M6c, brief §5): gözlemin kod kod çözümü ve tahmin dönemleri tablosu. Saf
 * modül; anlamlar çözülmüş rapordan ve `@havayolu/i18n` hava durumu metinlerinden kurulur, havacılık
 * birimleri (kt, ft) metrik karşılıklarıyla yazılır.
 */

export interface CodeRow {
  /** Rapordaki kod (bir ya da birkaç parça). */
  code: string
  meaning: string
}

const pad3 = (deg: number) => String(Math.round(deg)).padStart(3, '0')

/**
 * Uzman rüzgârı, virgülle: "030° 18 kt (33 km/sa), hamle 32 kt (59 km/sa), yön 160° ile 240° arası".
 * Sayıdan önce "·" ya da "–" yazılmaz (eksi gibi okunur; kullanıcı kararı 2026-10-02).
 */
export function expertWind(wind: Wind | null, { t, locale }: WeatherTextOptions): string {
  const e = t.expert
  if (!wind) return t.value.undetermined
  if (wind.calm) return e.calm
  const direction =
    wind.variable || wind.directionDeg === null
      ? e.variableDirection
      : `${pad3(wind.directionDeg)}°`
  // Ölçek üstü değer sade görünümle aynı kuralla (`offScaleWind`; P99KT 100 kt, P49MPS 97 kt).
  const offScale = offScaleWind(wind)
  const speed = formatWindSpeedBoth(wind.speedKt, locale, wind.speedKmh)
  const parts = [
    format(e.windValue, {
      direction,
      speed: offScale.speed ? format(t.wind.above, { speed }) : speed,
    }),
  ]
  if (wind.gustKt !== null) {
    const gust = formatWindSpeedBoth(wind.gustKt, locale, wind.gustKmh)
    parts.push(
      format(e.gust, { speed: offScale.gust ? format(t.wind.above, { speed: gust }) : gust }),
    )
  }
  if (wind.varyingFromDeg !== null && wind.varyingToDeg !== null) {
    parts.push(
      format(e.varying, {
        from: `${pad3(wind.varyingFromDeg)}°`,
        to: `${pad3(wind.varyingToDeg)}°`,
      }),
    )
  }
  return parts.join(', ')
}

/** Pist görüş mesafesi: "Pist 11: 350 m, değişmiyor". */
export function rvrText(rvr: Rvr, { t, locale }: WeatherTextOptions): string {
  const e = t.expert
  const value = (meters: number | null, qualifier: Rvr['qualifier']) => {
    const text = formatVisibility(meters, locale)
    if (qualifier === 'above') return format(e.rvrAbove, { value: text })
    if (qualifier === 'below') return format(e.rvrBelow, { value: text })
    return text
  }
  let text = value(rvr.meters, rvr.qualifier)
  if (rvr.varyingToMeters !== null) {
    text = format(e.rvrVarying, {
      from: text,
      to: value(rvr.varyingToMeters, rvr.varyingToQualifier),
    })
  }
  if (rvr.tendency) text = `${text}, ${e.rvrTendency[rvr.tendency]}`
  return format(e.rvrItem, { runway: rvr.runway, value: text })
}

const COVERS: ReadonlySet<string> = new Set(['FEW', 'SCT', 'BKN', 'OVC'])

/** Bulut katmanı: "Parçalı bulutlu 2.500 ft (760 m), kümülonimbüs". */
export function layerText(
  cover: CloudCover | null,
  baseFt: number | null,
  type: 'CB' | 'TCU' | null,
  { t, locale }: WeatherTextOptions,
): string {
  const e = t.expert
  const layer = format(e.layer, {
    cover: cover ? t.clouds[cover] : t.value.undetermined,
    ft: formatFeet(baseFt, locale),
    m: formatHeight(baseFt, locale),
  })
  if (type === null) return layer
  return format(e.layerType, { layer, type: type === 'CB' ? t.clouds.cb : t.clouds.tcu })
}

const WIND = /^(?:\d{3}|VRB|\/{3})(?:P?\d{2,3}|\/{2})(?:GP?\d{2,3})?(?:KT|MPS|KMH)$/
const VARYING = /^(\d{3})V(\d{3})$/
const VIS_MAIN = /^(\d{4})(NDV)?$/
const VIS_MIN = /^(\d{4})(N|NE|E|SE|S|SW|W|NW)$/
const RVR_TOKEN = /^R\d{2}[LCR]?\//
const CLOUD = /^(FEW|SCT|BKN|OVC|\/{3})(\d{3}|\/{3})(CB|TCU|\/{3})?$/
const VV = /^VV(\d{3}|\/{3})$/
const TEMP = /^(M?\d{2}|\/{2})\/(M?\d{2}|\/{2})?$/
const QNH = /^[QA](\d{4}|\/{4})$/
const TIME = /^\d{6}Z$/
const TREND_START = new Set(['BECMG', 'TEMPO', 'NOSIG'])

function label(name: string, value: string): string {
  return `${name}: ${value}`
}

/**
 * Gözlemin kod kod çözümü. Her parça bir satırdır; eğilim grupları (`TEMPO 4000 SHRA`) ve rüzgâr
 * kesmesi (`WS R35`) tek satırda toplanır. Tanınmayan parça "Belirlenemedi" yazar.
 */
export function metarCodeRows(
  metar: AirportMetar,
  options: WeatherTextOptions,
  /**
   * Dilimi bilinmeyen yabancı havalimanı: gözlem saati "Türkiye saati" diye yazılır (D-080). Dilim
   * biliniyorsa yerel saat havalimanınındır (`options.timeZone`, D-084).
   */
  { turkeyTime = false }: { turkeyTime?: boolean } = {},
): CodeRow[] {
  const { t, locale } = options
  const e = t.expert
  const tokens = metar.raw
    .replace(/=+\s*$/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const rows: CodeRow[] = []
  const weather = [...metar.weather]
  const recent = [...metar.recent]
  const rvr = [...metar.rvr]
  let trendIndex = 0
  let i = 0

  const takeGroup = (list: WeatherGroup[], token: string): WeatherGroup | undefined => {
    const index = list.findIndex((group) => group.raw === token)
    return index < 0 ? undefined : list.splice(index, 1)[0]
  }

  while (i < tokens.length) {
    const token = tokens[i] ?? ''
    if (token === 'RMK') {
      rows.push({ code: tokens.slice(i).join(' '), meaning: e.remarks })
      break
    }
    if (token === 'BECMG' || token === 'TEMPO') {
      let end = i + 1
      while (end < tokens.length && !TREND_START.has(tokens[end] ?? '') && tokens[end] !== 'RMK') {
        end += 1
      }
      const group = metar.trend[trendIndex]
      trendIndex += 1
      const change = group
        ? weatherText(changeText(group), options, { capitalize: false })
        : t.value.undetermined
      rows.push({
        code: tokens.slice(i, end).join(' '),
        // Kodun anlamı gözleme göredir ("gözlemden sonraki 2 saat"): eski raporda da doğrudur.
        meaning: format(token === 'TEMPO' ? e.trendTempo : e.trendBecmg, { change }),
      })
      i = end
      continue
    }
    if (token === 'WS') {
      // Çözücüyle aynı biçimler: `WS R35`, `WS RWY35`, `WS ALL RWY`, önünde `TKOF`/`LDG` olabilir.
      let end = i + 1
      if (tokens[end] === 'TKOF' || tokens[end] === 'LDG') end += 1
      if (tokens[end] === 'ALL' && tokens[end + 1] === 'RWY') end += 2
      else if (windShearRunway(tokens[end] ?? '') !== null) end += 1
      const shear = metar.windShear
      const where = shear?.allRunways
        ? e.windShearAll
        : (shear?.runways ?? []).map((runway) => format(e.windShearRunway, { runway })).join(', ')
      rows.push({
        code: tokens.slice(i, end).join(' '),
        meaning: label(e.windShear, where || NO_VALUE),
      })
      i = end
      continue
    }
    rows.push({ code: token, meaning: tokenMeaning(token, i) })
    i += 1
  }
  return rows

  function tokenMeaning(token: string, index: number): string {
    if (token === 'METAR') return e.metar
    if (token === 'SPECI') return e.speci
    if (token === 'COR') return t.note.corrected
    if (token === 'AUTO') return t.note.auto
    if (token === 'NIL') return t.note.nil
    if (token === 'NOSIG') return e.trendNosig
    if (token === 'CAVOK') return t.cavok
    if (token === '//') return e.notObserved
    if (token === 'RE//') return e.recentNotObserved
    if (token === 'NSC') return t.clouds.nsc
    if (token === 'NCD') return t.clouds.ncd
    if (token === 'SKC' || token === 'CLR') return t.clouds.skc
    if (index <= 2 && token === metar.station) return e.station
    if (TIME.test(token)) {
      return format(turkeyTime ? e.observedUtcTurkey : e.observedUtc, {
        utc: formatUtcClock(metar.observedAt),
        local: formatClock(metar.observedAt, options.timeZone),
      })
    }
    if (WIND.test(token)) return label(e.wind, expertWind(metar.wind, options))
    const varying = VARYING.exec(token)
    if (varying) {
      return label(e.wind, format(e.varying, { from: `${varying[1]}°`, to: `${varying[2]}°` }))
    }
    const main = VIS_MAIN.exec(token)
    if (main) {
      const meters = Number(main[1])
      const value =
        meters >= 9999
          ? t.visibility.tenKmPlus
          : meters === 0
            ? t.visibility.lessThan50
            : formatVisibility(meters, locale)
      return label(e.visibility, value)
    }
    const minimum = VIS_MIN.exec(token)
    if (minimum) {
      const direction = minimum[2] as keyof typeof t.compass.name
      return label(
        e.visibility,
        format(t.visibility.minimum, {
          visibility: formatVisibility(Number(minimum[1]), locale),
          direction: t.compass.name[direction],
        }),
      )
    }
    // Pist yüzeyi durumu da `Rxx/` ile başlar: RVR'den önce sorulur (çözücüyle aynı tanıma).
    if (isRunwayStateGroup(token)) return e.runwayState
    if (isSeaStateGroup(token)) return e.seaState
    if (isColourState(token)) return e.colourState
    if (RVR_TOKEN.test(token)) {
      const item = rvr.shift()
      return label(e.rvr, item ? rvrText(item, options) : t.value.undetermined)
    }
    const cloud = CLOUD.exec(token)
    if (cloud) {
      const cover = COVERS.has(cloud[1] ?? '') ? (cloud[1] as CloudCover) : null
      const base = /^\d{3}$/.test(cloud[2] ?? '') ? Number(cloud[2]) * 100 : null
      const type = cloud[3] === 'CB' || cloud[3] === 'TCU' ? cloud[3] : null
      return label(e.clouds, layerText(cover, base, type, options))
    }
    const vv = VV.exec(token)
    if (vv) {
      const ft = /^\d{3}$/.test(vv[1] ?? '') ? Number(vv[1]) * 100 : null
      return label(
        e.clouds,
        weatherText(
          cloudsText({ kind: 'vv', layers: [], verticalVisibilityFt: ft }, false),
          options,
        ),
      )
    }
    if (TEMP.test(token)) {
      return format(e.tempDew, {
        temperature: formatTemperature(metar.temperatureC, locale),
        dewPoint: formatTemperature(metar.dewPointC, locale),
      })
    }
    if (QNH.test(token)) return label(e.pressure, formatPressure(metar.qnhHpa, locale))
    const current = takeGroup(weather, token)
    if (current) return label(e.weather, weatherText(weatherGroupText(current), options))
    const past = takeGroup(recent, token)
    if (past)
      return label(e.recent, weatherText(weatherGroupText({ ...past, vicinity: false }), options))
    return t.value.undetermined
  }
}

export interface TafPeriodRow {
  period: string
  change: string
  wind: string
  visibility: string
  weather: string
  clouds: string
  raw: string
}

/** UTC gün ve saat, TAF yazımıyla: "1512". */
function ddhh(iso: string): string {
  const date = new Date(iso)
  return `${String(date.getUTCDate()).padStart(2, '0')}${String(date.getUTCHours()).padStart(2, '0')}`
}

/**
 * Dönem zamanı, yerel (gün değişirse "yarın") ve TAF'taki UTC gün-saat kodu: "15:00 ile yarın 21:00
 * arası (1512/1618)".
 */
function periodTime(
  from: string | null,
  to: string | null,
  taf: AirportTaf,
  now: number,
  options: WeatherTextOptions,
): string {
  const start = from ?? taf.validFrom
  const end = to ?? taf.validTo
  return format(options.t.expert.tafPeriod, {
    from: formatDayTime(start, now, options),
    to: formatDayTime(end, now, options),
    code: `${ddhh(start)}/${ddhh(end)}`,
  })
}

export function tafPeriodRows(
  taf: AirportTaf,
  now: number,
  options: WeatherTextOptions,
): TafPeriodRow[] {
  const { t } = options
  const c = t.expert.tafChange
  return taf.periods.map((period: TafPeriod) => {
    const p = period.probability
    const change =
      period.kind === 'BASE'
        ? c.base
        : period.kind === 'FM'
          ? c.fm
          : period.kind === 'BECMG'
            ? c.becmg
            : period.kind === 'TEMPO'
              ? p === null
                ? c.tempo
                : format(c.probTempo, { p })
              : format(c.prob, { p: p ?? 30 })
    const layers =
      period.sky === null
        ? NO_VALUE
        : period.sky.kind === 'layers'
          ? period.sky.layers
              .map((layer) => layerText(layer.cover, layer.baseFt, layer.type, options))
              .join('; ')
          : weatherText(cloudsText(period.sky, false), options)
    return {
      period: periodTime(period.from, period.to, taf, now, options),
      change,
      wind: period.wind ? expertWind(period.wind, options) : NO_VALUE,
      visibility: period.cavok
        ? t.cavok
        : period.visibility
          ? weatherText(visibilityText(period.visibility, false), options)
          : NO_VALUE,
      weather:
        period.weather.length > 0
          ? period.weather.map((group) => weatherText(weatherGroupText(group), options)).join(', ')
          : period.nsw
            ? t.nsw
            : NO_VALUE,
      clouds: period.cavok ? t.clouds.nsc : layers,
      raw: period.raw,
    }
  })
}
