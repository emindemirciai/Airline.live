import { ConditionsBuilder, tokenize } from './groups'
import type { DecodedTaf, TafPeriod } from './schema'
import { resolveDayTime, toDate, type DateInput } from './time'

/**
 * TAF çözücüsü (WMO FM 51; MGM Havacılık Meteorolojisi V.3; WMO-782 Bölüm C). AMD, COR, CNL ve
 * NIL; temel tahmin ve FM, BECMG, TEMPO, PROB30/40, PROB30/40 TEMPO değişiklik grupları; NSW ve
 * CAVOK. TX/TN ve düşük seviye rüzgâr kesmesi (`WS020/24045KT`) tanınır, gösterilmez. Gün/saat
 * grupları geçerlilik başının ayına oturtulur (ay sonu ve `HH=24` dahil); kayıttaki (AWC epoch)
 * zamanlar ham gruplardan önceliklidir.
 */

export interface DecodeTafOptions {
  /** Kayıttaki yayım zamanı (AWC `issueTime`). */
  issuedAt?: DateInput | null
  /** Kayıttaki geçerlilik başı ve sonu (AWC `validTimeFrom`/`validTimeTo`). */
  validFrom?: DateInput | null
  validTo?: DateInput | null
  /** Hiçbir zaman verilmezse ham grupların oturtulacağı an (ör. alınma zamanı). */
  referenceTime?: DateInput | null
}

const STATION_RE = /^[A-Z][A-Z0-9]{3}$/
const ISSUE_RE = /^(\d{2})(\d{2})(\d{2})Z$/
const PERIOD_RE = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/
const FM_RE = /^FM(\d{2})(\d{2})(\d{2})$/
const PROB_RE = /^PROB(\d{2})$/
const TEMPERATURE_RE = /^T[XN]M?\d{2}\/\d{4}Z$/
const LOW_LEVEL_SHEAR_RE = /^WS\d{3}\/\d{5}KT$/
const HEADER_WORDS = new Set(['TAF', 'AMD', 'COR', 'NIL', 'CNL', 'CAVOK', 'TEMPO', 'BECMG'])

function validDate(value: DateInput | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  const date = toDate(value)
  return Number.isFinite(date.getTime()) ? date : null
}

interface Segment {
  kind: TafPeriod['kind']
  probability: number | null
  fm: string | null
  tokens: string[]
}

const iso = (date: Date | null) => (date ? date.toISOString() : null)

/** TAF ham metnini çözer. */
export function decodeTaf(raw: string, options: DecodeTafOptions = {}): DecodedTaf {
  const tokens = tokenize(raw)
  const unparsed: string[] = []
  let i = 0
  let amended = false
  let corrected = false
  let cancelled = false
  let nil = false
  let station: string | null = null
  let issue: RegExpExecArray | null = null
  let validity: RegExpExecArray | null = null

  if (tokens[i] === 'TAF') i++
  // Başlık: TAF [AMD|COR] CCCC YYGGggZ [NIL] Y1Y1G1G1/Y2Y2G2G2 [CNL]; sırası esnek okunur.
  for (; i < tokens.length; i++) {
    const token = tokens[i] ?? ''
    if (token === 'AMD') amended = true
    else if (token === 'COR') corrected = true
    else if (token === 'NIL') nil = true
    else if (token === 'CNL') cancelled = true
    else if (station === null && STATION_RE.test(token) && !HEADER_WORDS.has(token)) {
      station = token
    } else if (issue === null && validity === null && ISSUE_RE.test(token)) {
      issue = ISSUE_RE.exec(token)
    } else if (validity === null && PERIOD_RE.test(token)) {
      validity = PERIOD_RE.exec(token)
    } else break
  }

  const reference = validDate(options.referenceTime)
  const issuedAt =
    validDate(options.issuedAt) ??
    (issue && (reference ?? validDate(options.validFrom))
      ? resolveDayTime(
          Number(issue[1]),
          Number(issue[2]),
          Number(issue[3]),
          (reference ?? validDate(options.validFrom)) as Date,
        )
      : null)
  const anchor = validDate(options.validFrom) ?? issuedAt ?? reference
  const rawFrom =
    validity && anchor ? resolveDayTime(Number(validity[1]), Number(validity[2]), 0, anchor) : null
  const rawTo =
    validity && (rawFrom ?? anchor)
      ? resolveDayTime(Number(validity[3]), Number(validity[4]), 0, (rawFrom ?? anchor) as Date)
      : null
  const validFrom = validDate(options.validFrom) ?? rawFrom
  const validTo = validDate(options.validTo) ?? rawTo

  // Gövdeyi değişiklik gruplarına böl.
  const segments: Segment[] = []
  let current: Segment = { kind: 'BASE', probability: null, fm: null, tokens: [] }
  const startSegment = (segment: Segment) => {
    segments.push(current)
    current = segment
  }
  for (; i < tokens.length && !nil && !cancelled; i++) {
    const token = tokens[i] ?? ''
    if (token === 'RMK') break
    const prob = PROB_RE.exec(token)
    if (FM_RE.test(token)) {
      startSegment({ kind: 'FM', probability: null, fm: token, tokens: [] })
    } else if (token === 'BECMG') {
      startSegment({ kind: 'BECMG', probability: null, fm: null, tokens: [] })
    } else if (token === 'TEMPO') {
      if (current.kind === 'PROB' && current.tokens.length === 0) current.kind = 'TEMPO'
      else startSegment({ kind: 'TEMPO', probability: null, fm: null, tokens: [] })
    } else if (prob) {
      startSegment({ kind: 'PROB', probability: Number(prob[1]), fm: null, tokens: [] })
    } else if (token === 'CNL') {
      cancelled = true
    } else {
      current.tokens.push(token)
    }
  }
  segments.push(current)
  if (nil || cancelled) unparsed.push(...tokens.slice(i).filter((t) => t !== 'CNL'))

  const resolvePeriodTime = (day: string | undefined, hour: string | undefined, minute = '00') =>
    validFrom ? resolveDayTime(Number(day), Number(hour), Number(minute), validFrom) : null

  const periods: TafPeriod[] = []
  for (const segment of segments) {
    if (segment.kind === 'BASE' && segment.tokens.length === 0) continue
    let from: Date | null = null
    let to: Date | null = null
    let body = segment.tokens
    if (segment.kind === 'BASE') {
      from = validFrom
    } else if (segment.kind === 'FM') {
      const match = FM_RE.exec(segment.fm ?? '')
      from = match ? resolvePeriodTime(match[1], match[2], match[3]) : null
    } else {
      const window = PERIOD_RE.exec(body[0] ?? '')
      if (window) {
        from = resolvePeriodTime(window[1], window[2])
        to = resolvePeriodTime(window[3], window[4])
        body = body.slice(1)
      }
    }
    const builder = new ConditionsBuilder()
    for (let j = 0; j < body.length;) {
      const part = body[j] ?? ''
      const used = builder.accept(part, body[j + 1])
      if (used > 0) {
        j += used
        continue
      }
      if (!TEMPERATURE_RE.test(part) && !LOW_LEVEL_SHEAR_RE.test(part)) builder.unparsed.push(part)
      j++
    }
    const keyword =
      segment.kind === 'BASE'
        ? []
        : segment.kind === 'FM'
          ? [segment.fm ?? '']
          : segment.probability !== null
            ? segment.kind === 'TEMPO'
              ? [`PROB${segment.probability}`, 'TEMPO']
              : [`PROB${segment.probability}`]
            : [segment.kind]
    periods.push({
      kind: segment.kind,
      probability: segment.probability,
      from: iso(from),
      to: iso(to),
      raw: [...keyword, ...segment.tokens].join(' '),
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

  // Temel tahmin ilk FM'ye, her FM bir sonrakine ya da geçerlilik sonuna kadar sürer.
  const fmStarts = periods.filter((p) => p.kind === 'FM' && p.from !== null).map((p) => p.from)
  for (const period of periods) {
    if (period.kind !== 'BASE' && period.kind !== 'FM') continue
    const start = period.from
    const nextStart = fmStarts.find((t) => t !== null && start !== null && t > start) ?? null
    period.to = nextStart ?? iso(validTo)
  }

  return {
    station,
    issuedAt: iso(issuedAt),
    validFrom: iso(validFrom),
    validTo: iso(validTo),
    raw,
    amended,
    corrected,
    cancelled,
    nil,
    periods,
    unparsed,
  }
}
