import type {
  CloudLayer,
  CompassPoint8,
  Sky,
  SkyKind,
  Visibility,
  WeatherGroup,
  Wind,
} from './schema'
import { parseWeatherGroup, toWeatherGroup } from './wx'

/**
 * METAR ve TAF'ın ortak grupları: rüzgâr, görüş, CAVOK, hava olayı, gökyüzü, NSW. Eksik değerler
 * (`/////KT`, `////`, `//////`) WMO-782 "Missing elements" kuralıyla tanınır: grup çözülmüş sayılır,
 * değeri null olur.
 */

const KT_PER_MPS = 1.943844
const KMH_PER_KT = 1.852
const M_PER_SM = 1609.344

/** Ham metni parçalara böler: `=` sonlandırıcısı atılır, – ve − eksi işaretine çevrilir. */
export function tokenize(raw: string): string[] {
  return raw
    .replace(/[–−]/g, '-')
    .replace(/=/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
}

const WIND_RE = /^(VRB|\d{3}|\/{3})(P?\d{2,3}|\/{2,3})(?:G(P?\d{2,3}|\/{2,3}))?(KT|MPS|KMH)$/
const WIND_MISSING_RE = /^\/{2,6}(?:KT|MPS|KMH)$/
const WIND_VARYING_RE = /^(\d{3})V(\d{3})$/

const KMH_PER_MPS = 3.6

function toKt(value: number, unit: string): number {
  if (unit === 'MPS') return Math.round(value * KT_PER_MPS)
  if (unit === 'KMH') return Math.round(value / KMH_PER_KT)
  return value
}

/** km/sa, raporun biriminden tek yuvarlamayla (kt'den yeniden çevrilmez; D-083). */
function toKmh(value: number, unit: string): number {
  if (unit === 'MPS') return Math.round(value * KMH_PER_MPS)
  if (unit === 'KMH') return value
  return Math.round(value * KMH_PER_KT)
}

interface Speed {
  kt: number | null
  kmh: number | null
  above: boolean
}

/** Hız parçası: `P99` ölçek üstüdür (100 kt ve üzeri); `//` bilinmiyor. */
function speed(part: string | undefined, unit: string): Speed {
  if (part === undefined || part.startsWith('/')) return { kt: null, kmh: null, above: false }
  const above = part.startsWith('P')
  const value = above ? Number(part.slice(1)) + 1 : Number(part)
  return { kt: toKt(value, unit), kmh: toKmh(value, unit), above }
}

/**
 * `dddffGfmfmKT` (MPS ve KMH da). Eşleşmezse undefined; tamamen eksikse (`/////KT`) `{ wind: null }`.
 */
export function parseWind(token: string): { wind: Wind | null } | undefined {
  if (WIND_MISSING_RE.test(token)) return { wind: null }
  const match = WIND_RE.exec(token)
  if (!match) return undefined
  const [, dir = '', spd, gst, unit = 'KT'] = match
  const mean = speed(spd, unit)
  const gust = speed(gst, unit)
  const variable = dir === 'VRB'
  const directionDeg = variable || dir.startsWith('/') ? null : Number(dir)
  if (directionDeg !== null && directionDeg > 360) return undefined
  if (dir.startsWith('/') && mean.kt === null) return { wind: null }
  return {
    wind: {
      calm: mean.kt === 0 && gust.kt === null && (directionDeg === 0 || variable),
      variable,
      directionDeg,
      speedKt: mean.kt,
      gustKt: gust.kt,
      speedKmh: mean.kmh,
      gustKmh: gust.kmh,
      varyingFromDeg: null,
      varyingToDeg: null,
      aboveMaxKt: mean.above || gust.above,
    },
  }
}

/** `dddVddd`: yönün değiştiği aralık. */
export function parseWindVarying(token: string): { from: number; to: number } | undefined {
  const match = WIND_VARYING_RE.exec(token)
  if (!match) return undefined
  const from = Number(match[1])
  const to = Number(match[2])
  return from > 360 || to > 360 ? undefined : { from, to }
}

const VIS_RE = /^(\d{4})(NDV)?$/
const VIS_DIR_RE = /^(\d{4})(N|NE|E|SE|S|SW|W|NW)$/
const VIS_MISSING_RE = /^\/{4}(?:NDV)?$/
const VIS_SM_RE = /^([MP])?(\d{1,2})(?:\/(\d{1,2}))?SM$/
const VIS_SM_WHOLE_RE = /^\d$/
const VIS_SM_FRACTION_RE = /^(\d)\/(\d{1,2})SM$/

function metricVisibility(meters: number, ndv: boolean): Visibility {
  if (meters >= 9999) {
    return {
      meters: 10_000,
      tenKmOrMore: true,
      lessThan50m: false,
      qualifier: null,
      minimum: null,
      ndv,
    }
  }
  if (meters === 0) {
    return {
      meters: 50,
      tenKmOrMore: false,
      lessThan50m: true,
      qualifier: 'below',
      minimum: null,
      ndv,
    }
  }
  return { meters, tenKmOrMore: false, lessThan50m: false, qualifier: null, minimum: null, ndv }
}

function statuteVisibility(miles: number, qualifier: 'above' | 'below' | null): Visibility {
  const meters = Math.round(miles * M_PER_SM)
  return {
    meters,
    tenKmOrMore: meters >= 10_000 && qualifier !== 'below',
    lessThan50m: false,
    qualifier,
    minimum: null,
    ndv: false,
  }
}

export type VisibilityToken =
  | { kind: 'prevailing'; visibility: Visibility | null; consumed: number }
  | { kind: 'minimum'; meters: number; direction: CompassPoint8; consumed: number }

/** Görüş grubu (metre, yön, NDV, eksik, mil). `next`: "1 1/2SM" için sonraki parça. */
export function parseVisibility(token: string, next?: string): VisibilityToken | undefined {
  let match = VIS_RE.exec(token)
  if (match) {
    return {
      kind: 'prevailing',
      visibility: metricVisibility(Number(match[1]), match[2] === 'NDV'),
      consumed: 1,
    }
  }
  match = VIS_DIR_RE.exec(token)
  if (match) {
    return {
      kind: 'minimum',
      meters: Number(match[1]),
      direction: match[2] as CompassPoint8,
      consumed: 1,
    }
  }
  if (VIS_MISSING_RE.test(token)) return { kind: 'prevailing', visibility: null, consumed: 1 }
  if (VIS_SM_WHOLE_RE.test(token) && next !== undefined) {
    const fraction = VIS_SM_FRACTION_RE.exec(next)
    if (fraction) {
      const miles = Number(token) + Number(fraction[1]) / Number(fraction[2])
      return { kind: 'prevailing', visibility: statuteVisibility(miles, null), consumed: 2 }
    }
  }
  match = VIS_SM_RE.exec(token)
  if (match) {
    const [, sign, whole = '0', denominator] = match
    const miles = denominator === undefined ? Number(whole) : Number(whole) / Number(denominator)
    if (!Number.isFinite(miles)) return undefined
    const qualifier = sign === 'P' ? 'above' : sign === 'M' ? 'below' : null
    return { kind: 'prevailing', visibility: statuteVisibility(miles, qualifier), consumed: 1 }
  }
  return undefined
}

const CLOUD_RE = /^(FEW|SCT|BKN|OVC|\/{3})(\d{3}|\/{3})(CB|TCU|\/{3})?$/
const VV_RE = /^VV(\d{3}|\/{3})$/
const SKY_WORDS: Record<string, SkyKind> = { NSC: 'nsc', NCD: 'ncd', SKC: 'skc', CLR: 'clr' }

export type SkyToken =
  | { kind: 'layer'; layer: CloudLayer }
  | { kind: 'vv'; ft: number | null }
  | { kind: 'word'; sky: SkyKind }

/** Bulut grubu (`BKN035CB`, `///018CB`, `VV001`, `NSC` …). */
export function parseSkyToken(token: string): SkyToken | undefined {
  const word = SKY_WORDS[token]
  if (word) return { kind: 'word', sky: word }
  let match = VV_RE.exec(token)
  if (match) {
    const height = match[1] ?? ''
    return { kind: 'vv', ft: height.startsWith('/') ? null : Number(height) * 100 }
  }
  match = CLOUD_RE.exec(token)
  if (!match) return undefined
  const [, cover = '', height = '', type] = match
  return {
    kind: 'layer',
    layer: {
      cover: cover.startsWith('/') ? null : (cover as CloudLayer['cover']),
      baseFt: height.startsWith('/') ? null : Number(height) * 100,
      type: type === 'CB' || type === 'TCU' ? type : null,
    },
  }
}

/**
 * Bir grubun (METAR gövdesi, TREND, TAF dönemi) ortak alanlarını biriktirir. `weatherLike`:
 * çözülemeyen ama hava olayına benzeyen parça görüldü.
 */
export class ConditionsBuilder {
  wind: Wind | null = null
  windSeen = false
  visibility: Visibility | null = null
  visibilitySeen = false
  cavok = false
  nsw = false
  weather: WeatherGroup[] = []
  layers: CloudLayer[] = []
  skyKind: SkyKind | null = null
  verticalVisibilityFt: number | null = null
  unparsed: string[] = []

  /** Ortak bir grubu tanırsa tükettiği parça sayısını, tanımazsa 0 döner. */
  accept(token: string, next: string | undefined): number {
    if (token === 'CAVOK') {
      this.cavok = true
      this.visibilitySeen = true
      this.visibility = metricVisibility(10_000, false)
      return 1
    }
    if (token === 'NSW') {
      this.nsw = true
      return 1
    }
    if (token === 'NDV' && this.visibilitySeen) {
      // Ayrık yazılmış "9999 NDV".
      if (this.visibility) this.visibility = { ...this.visibility, ndv: true }
      return 1
    }
    const wind = parseWind(token)
    if (wind) {
      this.wind = wind.wind
      this.windSeen = true
      return 1
    }
    const varying = parseWindVarying(token)
    if (varying) {
      if (this.wind) {
        this.wind = { ...this.wind, varyingFromDeg: varying.from, varyingToDeg: varying.to }
      }
      return 1
    }
    const visibility = parseVisibility(token, next)
    if (visibility) {
      this.acceptVisibility(visibility)
      return visibility.consumed
    }
    const sky = parseSkyToken(token)
    if (sky) {
      if (sky.kind === 'layer') this.layers.push(sky.layer)
      else if (sky.kind === 'vv') {
        this.skyKind = 'vv'
        this.verticalVisibilityFt = sky.ft
      } else this.skyKind = sky.sky
      return 1
    }
    const group = parseWeatherGroup(token)
    if (group && !group.recent) {
      this.weather.push(toWeatherGroup(group))
      return 1
    }
    return 0
  }

  private acceptVisibility(token: VisibilityToken): void {
    if (token.kind === 'prevailing') {
      if (!this.visibilitySeen) this.visibility = token.visibility
      this.visibilitySeen = true
      return
    }
    const minimum = { meters: token.meters, direction: token.direction }
    if (!this.visibilitySeen) {
      // Tek yönlü grup hâkim görüşün yerinde: en düşük değer hâkim kabul edilir (temkinli).
      this.visibility = { ...metricVisibility(token.meters, false), minimum }
      this.visibilitySeen = true
    } else if (this.visibility && this.visibility.minimum === null) {
      this.visibility = { ...this.visibility, minimum }
    }
  }

  /** Gökyüzü; hiç grup yoksa null. Tümü eksik katmanlar (`/////////`) "bilinmiyor"dur. */
  sky(): Sky | null {
    if (this.cavok) return { kind: 'cavok', layers: [], verticalVisibilityFt: null }
    if (this.skyKind === 'vv') {
      return { kind: 'vv', layers: [], verticalVisibilityFt: this.verticalVisibilityFt }
    }
    const known = this.layers.filter(
      (l) => l.cover !== null || l.baseFt !== null || l.type !== null,
    )
    if (known.length > 0) {
      const layers = [...known].sort((a, b) => (a.baseFt ?? Infinity) - (b.baseFt ?? Infinity))
      return { kind: 'layers', layers, verticalVisibilityFt: null }
    }
    if (this.skyKind) return { kind: this.skyKind, layers: [], verticalVisibilityFt: null }
    if (this.layers.length > 0) return { kind: 'unknown', layers: [], verticalVisibilityFt: null }
    return null
  }
}

/**
 * NATO renk durumu (askerî ve ortak kullanımlı meydanların METAR sonu: BLU, WHT, GRN, YLO1, YLO2,
 * AMB, RED; önünde BLACK olabilir). Hava olayı değildir; tanınır ve gösterilmez.
 */
export function isColourState(token: string): boolean {
  return /^(?:BLACK)?(?:BLU|WHT|GRN|YLO[12]?|AMB|RED)\+?$|^BLACK$/.test(token)
}

/**
 * Çözülemeyen bir parça hava olayına benziyor mu: yalnız harf (önünde `+`, `-`, `VC` ya da `RE`
 * olabilir) ve en az iki harf. Bu durumda yağmur/kar/oraj/sis için "yok" denemez.
 */
export function isWeatherLike(token: string): boolean {
  return /^(?:RE|VC|[+-])?[A-Z]{2,}$/.test(token)
}
