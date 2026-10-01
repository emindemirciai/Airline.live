import { compassKey8 } from './compass'
import { isStrongWind, largestCover, lowestCloudBaseFt } from './derive'
import { list, phrase, type Measure, type Phrase, type WeatherText } from './phrase'
import type {
  DecodedMetar,
  DecodedTaf,
  Sky,
  TafPeriod,
  TrendGroup,
  Visibility,
  WeatherGroup,
  WeatherIconCategory,
  Wind,
} from './schema'
import { localDayDifference, toDate, TURKEY_TIME_ZONE, type DateInput } from './time'
import {
  compareWeatherSeverity,
  isFogGroup,
  isHailGroup,
  isOtherGroup,
  isRainGroup,
  isSnowGroup,
  isThunderGroup,
  isUnknownPrecipitationGroup,
  mostSevereGroup,
  weatherPhraseId,
} from './wx'

/**
 * Sade dil özeti (brief §5). Metin üretmez: her değer metin anahtarı + değişkendir
 * (`renderWeatherText`). Dürüstlük kuralları:
 * - Yağmur, kar, oraj ve sis satırları her zaman vardır; "yok" yalnızca rapor temiz çözüldüyse
 *   yazılır. Rapor NIL ise ya da gövdede hava olayına benzeyen çözülemeyen parça varsa
 *   "belirlenemedi" yazılır (tanınan olaylar yine gösterilir).
 * - Çevredeki (VC) ve son saatteki (RE) olaylar "havalimanında yok" diye ayrıca söylenir.
 * - Olasılıklı (PROB) tahmin "bekleniyor" diye yazılmaz; kalıp olasılığı söyler.
 */

/** Havalimanı sayfası ve harita penceresi satırları. Null satır gösterilmez. */
export interface WeatherSummaryRows {
  wind: WeatherText
  rain: WeatherText
  snow: WeatherText
  thunderstorm: WeatherText
  fog: WeatherText
  /** Yalnız dolu varsa. */
  hail: WeatherText | null
  /** Yalnız toz, kum, duman, volkanik kül, ani sert rüzgâr, hortum vb. varsa. */
  other: WeatherText | null
  visibility: WeatherText
  clouds: WeatherText
  temperature: WeatherText | null
  dewPoint: WeatherText | null
  humidity: WeatherText | null
  pressure: WeatherText | null
}

export interface WeatherSummary {
  /** Başlık: en önemli hava olayı ya da gökyüzü. */
  headline: WeatherText
  /** Gündüz simgesi (gece biçimi `iconCategory`). */
  icon: WeatherIconCategory
  temperature: Measure | null
  rows: WeatherSummaryRows
  /**
   * Eğilim (TREND, gözlemden sonraki 2 saat); yoksa ya da penceresi geçtiyse null. Pencere açıkken
   * gözlem 30 dakikadan eskiyse metin pencerenin bitiş saatiyle yazılır (`trend: 'untilTime'`).
   */
  next2h: WeatherText | null
  /**
   * Eğilim penceresinin durumu (`now` verildiyse): `next2h` gözlem tazeyken "önümüzdeki 2 saat",
   * `untilTime` gözlem eskiyken "… saatine kadar", `expired` pencere geçti (satır gösterilmez).
   * `now` verilmezse her zaman `next2h`.
   */
  trend: TrendWindow
  /** "Kuvvetli rüzgâr" etiketi (`weather.wind.strong`). */
  strongWind: boolean
  /** Hava olayı satırları "belirlenemedi" diyebilir; ham metne yönlendiren not gösterilir. */
  undetermined: boolean
  /** Uyarı notları (NIL, çözülemeyen parça, otomatik gözlem, düzeltilmiş rapor, SPECI). */
  notes: WeatherText[]
}

const NONE = phrase('weather.value.none')
const UNDETERMINED = phrase('weather.value.undetermined')

/** Grubun kendi metni (`weather.wx.<id>`). */
function groupPhrase(g: WeatherGroup): Phrase {
  return phrase(`weather.wx.${weatherPhraseId(g)}`)
}

/** Listede kullanılan metin: çevredeki grup "havalimanı çevresinde …" kalıbıyla sarılır. */
export function weatherGroupText(g: WeatherGroup): WeatherText {
  if (!g.vicinity) return groupPhrase(g)
  const id = weatherPhraseId(g)
  // VCSH ve VCTS'nin metni zaten çevreyi söyler ("sağanak", "gök gürültüsü") ama kalıp yine gerekir.
  return phrase('weather.wx.vicinity', { phrase: phrase(`weather.wx.${id}`) })
}

const speedMeasure = (kt: number): Measure => ({ measure: 'speed', kt })

function speedText(kt: number, aboveMax: boolean): WeatherText {
  return aboveMax && kt >= 100
    ? phrase('weather.wind.above', { speed: speedMeasure(kt) })
    : speedMeasure(kt)
}

/** Rüzgâr: "Kuzeydoğudan 33 km/sa · hamle 59 km/sa · yönü batı ile kuzey arasında değişiyor". */
export function windText(wind: Wind | null): WeatherText {
  if (!wind || wind.speedKt === null) return UNDETERMINED
  if (wind.calm) return phrase('weather.wind.calm')
  const speed = speedText(wind.speedKt, wind.aboveMaxKt)
  const items: WeatherText[] = []
  const direction = wind.directionDeg === null ? null : compassKey8(wind.directionDeg)
  if (wind.variable) {
    items.push(
      wind.speedKt <= 3 && wind.gustKt === null
        ? phrase('weather.wind.lightVariable')
        : phrase('weather.wind.variable', { speed }),
    )
  } else if (direction === null) {
    items.push(phrase('weather.wind.speedOnly', { speed }))
  } else {
    items.push(
      phrase('weather.wind.from', {
        direction: phrase(`weather.compass.from.${direction}`),
        speed,
      }),
    )
  }
  if (wind.gustKt !== null) {
    items.push(phrase('weather.wind.gust', { speed: speedText(wind.gustKt, wind.aboveMaxKt) }))
  }
  if (wind.varyingFromDeg !== null && wind.varyingToDeg !== null) {
    const from = compassKey8(wind.varyingFromDeg)
    const to = compassKey8(wind.varyingToDeg)
    if (from && to) {
      items.push(
        phrase('weather.wind.varying', {
          from: phrase(`weather.compass.name.${from}`),
          to: phrase(`weather.compass.name.${to}`),
        }),
      )
    }
  }
  return list(items, 'dot')
}

/** Görüş değeri (tek parça). */
function visibilityValue(v: Visibility): WeatherText {
  if (v.tenKmOrMore) return phrase('weather.visibility.tenKmPlus')
  if (v.lessThan50m) return phrase('weather.visibility.lessThan50')
  if (v.meters === null) return UNDETERMINED
  const value: Measure = { measure: 'visibility', meters: v.meters }
  if (v.qualifier === 'above') return phrase('weather.visibility.above', { visibility: value })
  if (v.qualifier === 'below') return phrase('weather.visibility.below', { visibility: value })
  return value
}

/** Görüş satırı: hâkim görüş ve varsa daha düşük en düşük görüş ile yönü. */
export function visibilityText(visibility: Visibility | null, cavok: boolean): WeatherText {
  if (cavok) return phrase('weather.visibility.tenKmPlus')
  if (!visibility) return UNDETERMINED
  const items = [visibilityValue(visibility)]
  const minimum = visibility.minimum
  if (
    minimum &&
    minimum.direction !== null &&
    (visibility.meters === null || minimum.meters < visibility.meters)
  ) {
    items.push(
      phrase('weather.visibility.minimum', {
        visibility: { measure: 'visibility', meters: minimum.meters },
        direction: phrase(`weather.compass.name.${minimum.direction}`),
      }),
    )
  }
  return list(items, 'dot')
}

/** Bulut satırı: "Çok bulutlu · en alçak bulut 760 m · kümülonimbüs". */
export function cloudsText(sky: Sky, cavok: boolean): WeatherText {
  if (cavok || sky.kind === 'cavok') return phrase('weather.clouds.cavok')
  switch (sky.kind) {
    case 'nsc':
      return phrase('weather.clouds.nsc')
    case 'ncd':
      return phrase('weather.clouds.ncd')
    case 'skc':
    case 'clr':
      return phrase('weather.clouds.skc')
    case 'vv':
      return sky.verticalVisibilityFt === null
        ? phrase('weather.clouds.vvUnknown')
        : phrase('weather.clouds.vv', {
            height: { measure: 'height', ft: sky.verticalVisibilityFt },
          })
    case 'unknown':
      return UNDETERMINED
    default:
      break
  }
  const items: WeatherText[] = []
  const cover = largestCover(sky)
  items.push(cover ? phrase(`weather.clouds.${cover}`) : UNDETERMINED)
  const lowest = lowestCloudBaseFt(sky)
  if (lowest !== null) {
    items.push(phrase('weather.clouds.lowest', { height: { measure: 'height', ft: lowest } }))
  }
  if (sky.layers.some((l) => l.type === 'CB')) items.push(phrase('weather.clouds.cb'))
  if (sky.layers.some((l) => l.type === 'TCU')) items.push(phrase('weather.clouds.tcu'))
  return list(items, 'dot')
}

interface PresenceInput {
  here: readonly WeatherGroup[]
  near: readonly WeatherGroup[]
  recent: readonly WeatherGroup[]
  undetermined: boolean
  none?: WeatherText
}

/** Olay satırı: havalimanında varsa olaylar; yoksa belirlenemedi / çevresinde / kısa süre önce / yok. */
function presenceRow({
  here,
  near,
  recent,
  undetermined,
  none = NONE,
}: PresenceInput): WeatherText {
  if (here.length > 0) return list(here.map(groupPhrase), 'comma')
  if (undetermined) return UNDETERMINED
  if (near.length > 0) {
    return phrase('weather.value.vicinity', { phrase: list(near.map(groupPhrase), 'comma') })
  }
  if (recent.length > 0) {
    return phrase('weather.value.recent', { phrase: list(recent.map(recentPhrase), 'comma') })
  }
  return none
}

/** Son saatteki olay: yağışsız oraj (`RETS`) "gök gürültüsü" diye yazılır (VCTS ile aynı ad). */
function recentPhrase(g: WeatherGroup): Phrase {
  const id = weatherPhraseId(g)
  return phrase(`weather.wx.${id === 'TS' ? 'VCTS' : id}`)
}

/** Başlık metni. */
function headlineText(m: DecodedMetar): WeatherText {
  const h = m.derived.headline
  switch (h.kind) {
    case 'nil':
      return phrase('weather.headline.noReport')
    case 'undetermined':
      return phrase('weather.headline.undetermined')
    case 'weather': {
      const worst = mostSevereGroup(m.weather.filter((g) => !g.vicinity))
      return worst ? groupPhrase(worst) : phrase('weather.headline.unknown')
    }
    default:
      break
  }
  switch (h.phrase) {
    case 'cavok':
      return phrase('weather.headline.cavok')
    case 'nsc':
      return phrase('weather.headline.nsc')
    case 'skc':
      return phrase('weather.clouds.skc')
    case 'ncd':
      return phrase('weather.clouds.ncd')
    case 'vv':
      return phrase('weather.clouds.vvUnknown')
    case 'FEW':
    case 'SCT':
    case 'BKN':
    case 'OVC':
      return phrase(`weather.clouds.${h.phrase}`)
    default:
      return phrase('weather.headline.unknown')
  }
}

type Conditions = Pick<TrendGroup, 'wind' | 'visibility' | 'cavok' | 'weather' | 'nsw' | 'sky'>

/** Değişiklik grubunun öğeleri: "görüş 4 km, sağanak yağmur". */
export function changeText(c: Conditions): WeatherText {
  const items: WeatherText[] = []
  if (c.wind) items.push(phrase('weather.change.wind', { wind: windText(c.wind) }))
  if (c.cavok) {
    items.push(phrase('weather.change.cavok'))
  } else if (c.visibility) {
    items.push(
      phrase('weather.change.visibility', { visibility: visibilityText(c.visibility, false) }),
    )
  }
  if (!c.cavok) items.push(...c.weather.map(weatherGroupText))
  if (c.nsw) items.push(phrase('weather.change.nsw'))
  if (!c.cavok && c.sky) items.push(cloudsText(c.sky, false))
  return items.length === 0 ? UNDETERMINED : list(items, 'comma')
}

/** METAR eğiliminin (TREND) kapsadığı süre: gözlemden sonraki 2 saat (WMO-49). */
export const METAR_TREND_WINDOW_MS = 2 * 3_600_000
/** Bundan eski gözlemde "önümüzdeki 2 saat" yerine pencerenin bitiş saati yazılır. */
export const METAR_TREND_RELATIVE_AFTER_MS = 30 * 60_000

export type TrendWindow = 'next2h' | 'untilTime' | 'expired'

/** Eğilim penceresinin `now` anındaki durumu; gözlem zamanı ya da `now` yoksa `next2h`. */
export function metarTrendWindow(
  observedAt: DateInput | null,
  now: DateInput | undefined,
): { window: TrendWindow; endsAt: number | null } {
  if (observedAt === null || now === undefined) return { window: 'next2h', endsAt: null }
  const observed = toDate(observedAt).getTime()
  const at = toDate(now).getTime()
  if (!Number.isFinite(observed) || !Number.isFinite(at)) return { window: 'next2h', endsAt: null }
  const endsAt = observed + METAR_TREND_WINDOW_MS
  if (at >= endsAt) return { window: 'expired', endsAt }
  return {
    window: at - observed > METAR_TREND_RELATIVE_AFTER_MS ? 'untilTime' : 'next2h',
    endsAt,
  }
}

/**
 * METAR TREND: "Önümüzdeki 2 saatte ara ara görüş 4 km, sağanak yağmur". Gözlem eskiyse "15:20
 * saatine kadar ara ara …" (pencerenin sonu); pencere geçtiyse yazılmaz (ileriye dönük iddia
 * kalmaz).
 */
function next2hText(
  m: DecodedMetar,
  trend: { window: TrendWindow; endsAt: number | null },
): WeatherText | null {
  if (m.nil || trend.window === 'expired') return null
  const until = trend.window === 'untilTime' && trend.endsAt !== null
  const to: Measure | null = until
    ? { measure: 'time', iso: new Date(trend.endsAt as number).toISOString() }
    : null
  if (m.trend.length > 0) {
    return list(
      m.trend.slice(0, 2).map((g) => {
        const change = changeText(g)
        if (to) {
          return phrase(
            g.kind === 'TEMPO' ? 'weather.trend.tempoUntil' : 'weather.trend.becmgUntil',
            {
              change,
              to,
            },
          )
        }
        return phrase(g.kind === 'TEMPO' ? 'weather.trend.tempo' : 'weather.trend.becmg', {
          change,
        })
      }),
      'semicolon',
    )
  }
  if (!m.nosig) return null
  return to ? phrase('weather.trend.nosigUntil', { to }) : phrase('weather.trend.nosig')
}

export interface SummarizeMetarOptions {
  /** Şimdiki an: eğilim yalnızca gözlemden sonraki 2 saat içinde ve ona göre yazılır. */
  now?: DateInput
}

/** Çözülmüş METAR'ın sade dil özeti. */
export function summarizeMetar(
  m: DecodedMetar,
  options: SummarizeMetarOptions = {},
): WeatherSummary {
  const trend = metarTrendWindow(m.observedAt, options.now)
  const undetermined = m.nil || m.derived.weatherUndetermined
  const here = m.nil ? [] : m.weather.filter((g) => !g.vicinity)
  const near = m.nil ? [] : m.weather.filter((g) => g.vicinity)
  const recent = m.nil ? [] : m.recent
  const pick = (groups: readonly WeatherGroup[], test: (g: WeatherGroup) => boolean) =>
    groups.filter(test)
  const rainLike = (g: WeatherGroup) => isRainGroup(g) || isUnknownPrecipitationGroup(g)
  const snowLike = (g: WeatherGroup) => isSnowGroup(g) || isUnknownPrecipitationGroup(g)
  const fogLike = (g: WeatherGroup) =>
    isFogGroup(g) || g.phenomena.includes('BR') || g.phenomena.includes('HZ')

  const hail = pick(here, isHailGroup)
  const otherHere = pick(here, isOtherGroup)
  const otherNear = pick(near, isOtherGroup)
  const other =
    otherHere.length + otherNear.length === 0
      ? null
      : list([...otherHere.map(groupPhrase), ...otherNear.map(weatherGroupText)], 'comma')

  const notes: WeatherText[] = []
  if (m.nil) notes.push(phrase('weather.note.nil'))
  else if (undetermined) notes.push(phrase('weather.note.undetermined'))
  if (m.auto) notes.push(phrase('weather.note.auto'))
  if (m.corrected) notes.push(phrase('weather.note.corrected'))
  if (m.type === 'SPECI') notes.push(phrase('weather.note.speci'))

  const temperature: Measure | null =
    m.nil || m.temperatureC === null ? null : { measure: 'temperature', celsius: m.temperatureC }
  const humidity = m.nil ? null : m.derived.relativeHumidityPct

  return {
    headline: headlineText(m),
    icon: m.derived.icon,
    temperature,
    rows: {
      wind: m.nil ? UNDETERMINED : windText(m.wind),
      rain: presenceRow({
        here: pick(here, rainLike),
        near: pick(near, (g) => g.descriptor === 'SH' || isRainGroup(g)),
        recent: pick(recent, isRainGroup),
        undetermined,
      }),
      snow: presenceRow({
        here: pick(here, snowLike),
        near: pick(near, isSnowGroup),
        recent: pick(recent, isSnowGroup),
        undetermined,
      }),
      thunderstorm: presenceRow({
        here: pick(here, isThunderGroup),
        near: pick(near, isThunderGroup),
        recent: pick(recent, isThunderGroup),
        undetermined,
        none: m.derived.flags.cb ? phrase('weather.value.noneWithCb') : NONE,
      }),
      fog: presenceRow({
        here: pick(here, fogLike),
        near: pick(near, isFogGroup),
        recent: pick(recent, isFogGroup),
        undetermined,
      }),
      hail: hail.length > 0 ? list(hail.map(groupPhrase), 'comma') : null,
      other,
      visibility: m.nil ? UNDETERMINED : visibilityText(m.visibility, m.cavok),
      clouds: m.nil ? UNDETERMINED : cloudsText(m.sky, m.cavok),
      temperature,
      dewPoint:
        m.nil || m.dewPointC === null ? null : { measure: 'temperature', celsius: m.dewPointC },
      humidity: humidity === null ? null : phrase('weather.humidity', { percent: humidity }),
      pressure: m.nil || m.qnhHpa === null ? null : { measure: 'pressure', hpa: m.qnhHpa },
    },
    next2h: next2hText(m, trend),
    trend: trend.window,
    strongWind: !m.nil && m.derived.strongWind,
    undetermined,
    notes,
  }
}

// ---------------------------------------------------------------------------------------------
// TAF özeti
// ---------------------------------------------------------------------------------------------

export interface TafSummary {
  /** ok: geçerli tahmin var; none: yok; cancelled: en yeni tahmin iptal; nil: tahmin yayımlanmadı. */
  status: 'ok' | 'none' | 'cancelled' | 'nil'
  /** Öne çıkan en fazla iki öğe (en önemli hava olayı ve varsa kuvvetli rüzgâr), her biri bir satır. */
  items: WeatherText[]
  /** "Tahmin yarın 21:00 saatine kadar geçerli."; geçerli tahmin yoksa null. */
  validUntil: WeatherText | null
  /** Öğe yoksa açıklama (önemli hava olayı beklenmiyor / geçerli tahmin yok / iptal / yok). */
  message: WeatherText | null
  /** Kullanılan en yeni tahmin güncellenmiş (AMD) ya da düzeltilmiş (COR) mi. */
  amended: boolean
  corrected: boolean
}

export interface SummarizeTafOptions {
  /** Özetin kapsadığı süre, saat (varsayılan 24). */
  horizonHours?: number
  /** "Yarın" kararı için saat dilimi (varsayılan Europe/Istanbul). */
  timeZone?: string
}

type Kind = 'BASE' | 'FM' | 'BECMG' | 'TEMPO' | 'PROB' | 'PROBTEMPO'

interface Candidate {
  kind: Kind
  probability: number | null
  /** Pencerenin (kesilmiş) başı ve sonu, epoch ms. */
  from: number
  to: number
  /** BECMG penceresinin sonu (kademeli değişimin bittiği an). */
  becmgTo: number | null
  /** Başlangıcı şimdiden önce: "… saatine kadar" kalıbı. */
  started: boolean
  group: WeatherGroup | null
  wind: Wind | null
}

interface State {
  wind: Wind | null
  visibility: Visibility | null
  cavok: boolean
  weather: WeatherGroup[]
  sky: Sky | null
}

interface Prevailing {
  start: number
  end: number
  kind: 'BASE' | 'FM' | 'BECMG'
  becmgTo: number | null
  state: State
}

const ms = (iso: string | null) => (iso === null ? null : Date.parse(iso))

const stateOf = (p: TafPeriod): State => ({
  wind: p.wind,
  visibility: p.visibility,
  cavok: p.cavok,
  weather: p.cavok || p.nsw ? [] : p.weather,
  sky: p.sky,
})

/** BECMG yalnız bildirdiği öğeleri değiştirir. */
function applyChange(state: State, p: TafPeriod): State {
  if (p.cavok)
    return {
      ...state,
      wind: p.wind ?? state.wind,
      visibility: p.visibility,
      cavok: true,
      weather: [],
      sky: p.sky,
    }
  return {
    wind: p.wind ?? state.wind,
    visibility: p.visibility ?? state.visibility,
    cavok: p.visibility ? false : state.cavok,
    weather: p.nsw ? [] : p.weather.length > 0 ? p.weather : state.weather,
    sky: p.sky ?? state.sky,
  }
}

/** Temel tahmin, FM ve BECMG'den hâkim durum dilimleri. */
function prevailingStates(taf: DecodedTaf): Prevailing[] {
  const validFrom = ms(taf.validFrom)
  const validTo = ms(taf.validTo)
  if (validFrom === null || validTo === null) return []
  const out: Prevailing[] = []
  const ordered = taf.periods
    .filter((p) => p.kind === 'BASE' || p.kind === 'FM' || p.kind === 'BECMG')
    .map((p) => ({ p, start: p.kind === 'BASE' ? validFrom : ms(p.from) }))
    .filter((x): x is { p: TafPeriod; start: number } => x.start !== null)
    .sort((a, b) => a.start - b.start)
  for (const { p, start } of ordered) {
    const previous = out.at(-1)
    if (previous) previous.end = start
    const state = p.kind === 'BECMG' && previous ? applyChange(previous.state, p) : stateOf(p)
    out.push({
      start,
      end: validTo,
      kind: p.kind as Prevailing['kind'],
      becmgTo: p.kind === 'BECMG' ? ms(p.to) : null,
      state,
    })
  }
  return out.filter((p) => p.end > p.start)
}

/** Yenisi eskisinin yerini alır: her TAF yalnız daha yeni bir TAF'ın kapsamadığı dilimleri verir. */
function coverage(
  tafs: readonly DecodedTaf[],
  from: number,
): { taf: DecodedTaf; from: number; to: number }[] {
  const out: { taf: DecodedTaf; from: number; to: number }[] = []
  const covered: [number, number][] = []
  for (const taf of tafs) {
    const validFrom = ms(taf.validFrom)
    const validTo = ms(taf.validTo)
    if (validFrom === null || validTo === null) continue
    let pieces: [number, number][] = [[Math.max(validFrom, from), validTo]]
    for (const [cFrom, cTo] of covered) {
      pieces = pieces.flatMap(([a, b]): [number, number][] => {
        if (cTo <= a || cFrom >= b) return [[a, b]]
        const rest: [number, number][] = []
        if (cFrom > a) rest.push([a, cFrom])
        if (cTo < b) rest.push([cTo, b])
        return rest
      })
    }
    for (const [a, b] of pieces) if (b > a) out.push({ taf, from: a, to: b })
    covered.push([validFrom, validTo])
  }
  return out
}

function candidatesFor(
  taf: DecodedTaf,
  windowFrom: number,
  windowTo: number,
  now: number,
  horizonEnd: number,
): Candidate[] {
  const out: Candidate[] = []
  const add = (
    kind: Kind,
    probability: number | null,
    start: number,
    end: number,
    becmgTo: number | null,
    state: Pick<State, 'weather' | 'wind'>,
  ) => {
    const from = Math.max(start, windowFrom)
    const to = Math.min(end, windowTo)
    // Ufuk yalnız süzer: ufuktan önce başlayan pencere gerçek sonuyla yazılır.
    if (to <= from || from >= horizonEnd) return
    const base = { kind, probability, from, to, becmgTo, started: from <= now }
    const worst = mostSevereGroup(state.weather)
    if (worst) out.push({ ...base, group: worst, wind: null })
    if (isStrongWind(state.wind)) out.push({ ...base, group: null, wind: state.wind })
  }
  for (const p of prevailingStates(taf)) add(p.kind, null, p.start, p.end, p.becmgTo, p.state)
  for (const p of taf.periods) {
    if (p.kind !== 'TEMPO' && p.kind !== 'PROB') continue
    const start = ms(p.from)
    const end = ms(p.to)
    if (start === null || end === null) continue
    const kind: Kind =
      p.kind === 'TEMPO' ? (p.probability !== null ? 'PROBTEMPO' : 'TEMPO') : 'PROB'
    add(kind, p.probability, start, end, null, { weather: p.nsw ? [] : p.weather, wind: p.wind })
  }
  return out
}

const PREVAILING: ReadonlySet<Kind> = new Set(['BASE', 'FM', 'BECMG'])

/** İki aday aynı öğeyi mi söyler: aynı en önemli olay (metin ve çevre) ya da ikisi de kuvvetli rüzgâr. */
function sameSubject(a: Candidate, b: Candidate): boolean {
  if (a.group && b.group) {
    return (
      weatherPhraseId(a.group) === weatherPhraseId(b.group) && a.group.vicinity === b.group.vicinity
    )
  }
  return a.group === null && b.group === null && a.wind !== null && b.wind !== null
}

/**
 * Birleşen kuvvetli rüzgâr dilimlerinin en güçlü değerleri: en yüksek ortalama ve en yüksek hamle
 * (ör. 25G38'in ardından 28G40 → 28 kt, hamle 40 kt). Yön ve yön aralığı ortalaması en yüksek
 * dilimden (eşitse öncekinden) gelir. Ortalamadan büyük olmayan hamle yazılmaz.
 */
function strongestWind(a: Wind, b: Wind): Wind {
  const base = (b.speedKt ?? 0) > (a.speedKt ?? 0) ? b : a
  const gusts = [a.gustKt, b.gustKt].filter((gust): gust is number => gust !== null)
  const gust = gusts.length === 0 ? null : Math.max(...gusts)
  return {
    ...base,
    gustKt: gust !== null && gust > (base.speedKt ?? 0) ? gust : null,
    aboveMaxKt: a.aboveMaxKt || b.aboveMaxKt,
  }
}

/**
 * Hâkim durumun (temel tahmin, FM, BECMG) ardışık dilimleri aynı öğeyi taşıyorsa tek öğe olur;
 * sonu, birleşen dilimlerin sonudur. Dilimler bir TAF'ın içinde başka bir öğe değişince (ör.
 * yalnız rüzgârı değiştiren BECMG) ve bir TAF'tan yenisine geçerken (kapsama sınırı) bölünür; olay
 * sürüyorsa "… saatine kadar" o sınırı değil olayın gerçek sonunu söylemelidir. Birleşen kuvvetli
 * rüzgâr öğesi ilk dilimin değil bütün dilimlerin en güçlü değerlerini söyler (`strongestWind`).
 * TEMPO ve PROB pencereleri birleştirilmez.
 */
function mergePrevailing(candidates: readonly Candidate[]): Candidate[] {
  const others = candidates.filter((c) => !PREVAILING.has(c.kind))
  const runs: Candidate[] = []
  const prevailing = candidates
    .filter((c) => PREVAILING.has(c.kind))
    .sort((a, b) => a.from - b.from || a.to - b.to)
  for (const candidate of prevailing) {
    const run = runs.findLast((r) => sameSubject(r, candidate))
    if (run && run.to === candidate.from) {
      run.to = candidate.to
      if (run.wind && candidate.wind) run.wind = strongestWind(run.wind, candidate.wind)
    } else runs.push({ ...candidate })
  }
  return [...runs, ...others]
}

const CERTAINTY: Record<Kind, number> = {
  BASE: 0,
  FM: 0,
  BECMG: 0,
  TEMPO: 1,
  PROBTEMPO: 2,
  PROB: 2,
}

function timeParam(at: number, now: number, timeZone: string): WeatherText {
  const iso = new Date(at).toISOString()
  const time: Measure = { measure: 'time', iso }
  const days = localDayDifference(now, at, timeZone)
  if (days === 0) return time
  if (days === 1) return phrase('weather.time.tomorrow', { time })
  return phrase('weather.time.onDate', { date: { measure: 'date', iso }, time })
}

function itemText(c: Candidate, now: number, timeZone: string): WeatherText {
  const subject: WeatherText = c.group
    ? weatherGroupText(c.group)
    : phrase('weather.taf.strongWind', { wind: windText(c.wind) })
  const from = timeParam(c.from, now, timeZone)
  const to = timeParam(c.to, now, timeZone)
  const probability = c.probability ?? 30
  switch (c.kind) {
    case 'BASE':
      return c.started
        ? phrase('weather.taf.until', { to, phrase: subject })
        : phrase('weather.taf.base', { from, to, phrase: subject })
    case 'FM':
      return c.started
        ? phrase('weather.taf.until', { to, phrase: subject })
        : phrase('weather.taf.fm', { from, phrase: subject })
    case 'BECMG':
      return c.started
        ? phrase('weather.taf.until', { to, phrase: subject })
        : phrase('weather.taf.becmg', {
            from,
            to: timeParam(c.becmgTo ?? c.to, now, timeZone),
            phrase: subject,
          })
    case 'TEMPO':
      return c.started
        ? phrase('weather.taf.tempoUntil', { to, phrase: subject })
        : phrase('weather.taf.tempo', { from, to, phrase: subject })
    case 'PROB':
      return c.started
        ? phrase('weather.taf.probUntil', { to, probability, phrase: subject })
        : phrase('weather.taf.prob', { from, to, probability, phrase: subject })
    case 'PROBTEMPO':
      return c.started
        ? phrase('weather.taf.probTempoUntil', { to, probability, phrase: subject })
        : phrase('weather.taf.probTempo', { from, to, probability, phrase: subject })
  }
}

/**
 * Geçerli TAF'ların sade dil özeti: şimdiden itibaren (varsayılan 24 saat) her saat için en son
 * yayımlanan ve o saati kapsayan TAF kullanılır (WMO-782 s. 48); tahmin geçerlilik sonunun ötesine
 * uzatılmaz. En önemli hava olayı (TEMPO ve PROB dahil) zaman penceresi ve niteleyicisiyle, varsa
 * kuvvetli rüzgâr ikinci satırda verilir.
 */
export function summarizeTaf(
  tafs: readonly DecodedTaf[],
  now: DateInput,
  options: SummarizeTafOptions = {},
): TafSummary {
  const nowMs = toDate(now).getTime()
  const timeZone = options.timeZone ?? TURKEY_TIME_ZONE
  const horizonEnd = nowMs + (options.horizonHours ?? 24) * 3_600_000
  const issued = (t: DecodedTaf) => ms(t.issuedAt) ?? ms(t.validFrom) ?? 0
  const newestFirst = [...tafs].sort((a, b) => issued(b) - issued(a))
  const live = newestFirst.filter((t) => {
    const end = ms(t.validTo)
    return end === null ? t.nil || t.cancelled : end > nowMs
  })
  const empty = (status: TafSummary['status'], key: 'none' | 'cancelled' | 'nil'): TafSummary => ({
    status,
    items: [],
    validUntil: null,
    message: phrase(`weather.taf.${key}`),
    amended: false,
    corrected: false,
  })
  const newest = live[0]
  if (newest?.cancelled) return empty('cancelled', 'cancelled')
  const usable = live.filter((t) => !t.nil && !t.cancelled && t.validFrom && t.validTo)
  if (usable.length === 0) return newest?.nil ? empty('nil', 'nil') : empty('none', 'none')

  const candidates = mergePrevailing(
    coverage(usable, nowMs).flatMap((segment) =>
      candidatesFor(segment.taf, segment.from, segment.to, nowMs, horizonEnd),
    ),
  )
  const weatherCandidates = candidates
    .filter((c): c is Candidate & { group: WeatherGroup } => c.group !== null)
    .sort(
      (a, b) =>
        compareWeatherSeverity(a.group, b.group) ||
        a.from - b.from ||
        CERTAINTY[a.kind] - CERTAINTY[b.kind],
    )
  const windCandidates = candidates
    .filter((c) => c.wind !== null)
    .sort((a, b) => a.from - b.from || CERTAINTY[a.kind] - CERTAINTY[b.kind])

  const chosen: Candidate[] = []
  const first = weatherCandidates[0]
  if (first) chosen.push(first)
  const strong = windCandidates[0]
  if (strong) chosen.push(strong)
  else if (first) {
    const firstId = weatherPhraseId(first.group)
    const second = weatherCandidates.find((c) => weatherPhraseId(c.group) !== firstId)
    if (second) chosen.push(second)
  }

  const validTo = Math.max(...usable.map((t) => ms(t.validTo) ?? 0))
  const lead = usable[0]
  return {
    status: 'ok',
    items: chosen.slice(0, 2).map((c) => itemText(c, nowMs, timeZone)),
    validUntil: phrase('weather.taf.validUntil', { time: timeParam(validTo, nowMs, timeZone) }),
    message: chosen.length === 0 ? phrase('weather.taf.nothingSignificant') : null,
    amended: lead?.amended ?? false,
    corrected: lead?.corrected ?? false,
  }
}
