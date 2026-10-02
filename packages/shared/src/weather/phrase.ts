import type { Locale } from '../locale'
import { COMPASS_POINTS_8, CLOUD_COVERS, LIGHTNING_RISKS, WIND_LEVELS } from './schema'
import { WX_PHRASE_IDS } from './wx'

/**
 * Sade dil özetinin yapı taşları. Özetleyiciler (`summarizeMetar`, `summarizeTaf`) metin üretmez:
 * metin anahtarı + değişken döner, metinler `packages/i18n`'dedir (`weather.*`). Ölçüler ham birimde
 * (kt, m, ft, °C, hPa, ISO zaman) taşınır; arayüz birim tercihine göre biçimler.
 */

/** Ham birimli ölçü; `renderWeatherText`'e verilen `measure` biçimleyicisi metne çevirir. */
export type Measure =
  /**
   * Rüzgâr hızı, kt; sade görünüm "33 km/sa (18 kt)" yazar (D-083). `kmh` raporun kendi biriminden
   * çevrilmiş km/sa'dır (MPS raporunda kt'den çevrilenden 1 farklı olabilir); yoksa kt'den çevrilir.
   */
  | { measure: 'speed'; kt: number; kmh?: number }
  /** Görüş, m (1 km altı m, 5 km altı bir ondalıklı km, üstü tam km; `visibilityDisplay`). */
  | { measure: 'visibility'; meters: number }
  /** Bulut tabanı ya da dikey görüş, ft (metre gösterimi `cloudBaseMeters` ile yuvarlanır). */
  | { measure: 'height'; ft: number }
  /** Sıcaklık, °C (eksi U+2212). */
  | { measure: 'temperature'; celsius: number }
  /** Basınç, hPa (gruplama yok: "1009 hPa"). */
  | { measure: 'pressure'; hpa: number }
  /** Saat (Europe/Istanbul, "15:00"). */
  | { measure: 'time'; iso: string }
  /** Tarih (Europe/Istanbul, "17 Ocak"). */
  | { measure: 'date'; iso: string }

/** Metin anahtarı ve değişkenleri. */
export interface Phrase {
  key: WeatherPhraseKey
  params?: Readonly<Record<string, WeatherParam>>
}

/**
 * Ayraçla birleşen parçalar: virgül ", " ya da noktalı virgül "; ". Orta nokta " · " kullanılmaz:
 * sayıdan önce eksi işareti gibi okunur ("Çok bulutlu · 16 °C" → "−16"; kullanıcı kararı
 * 2026-10-02).
 */
export interface PhraseList {
  list: readonly WeatherText[]
  separator: 'comma' | 'semicolon'
}

export type WeatherText = Phrase | PhraseList | Measure
export type WeatherParam = WeatherText | string | number

const SEPARATORS: Record<PhraseList['separator'], string> = {
  comma: ', ',
  semicolon: '; ',
}

/**
 * Özetleyicilerin üretebildiği bütün metin anahtarları ve beklenen değişkenleri. i18n testi her
 * anahtarın iki dilde de var olduğunu ve aynı yer tutucuları taşıdığını bu listeden denetler.
 */
const FIXED_KEYS = {
  // Satır değerleri
  'weather.value.none': [],
  'weather.value.undetermined': [],
  'weather.value.vicinity': ['phrase'],
  'weather.value.recent': ['phrase'],
  // Hava olayı kalıpları
  'weather.wx.vicinity': ['phrase'],
  // Rüzgâr
  'weather.wind.calm': [],
  'weather.wind.lightVariable': [],
  'weather.wind.variable': ['speed'],
  'weather.wind.from': ['direction', 'speed'],
  'weather.wind.speedOnly': ['speed'],
  'weather.wind.gust': ['speed'],
  'weather.wind.varying': ['from', 'to'],
  'weather.wind.above': ['speed'],
  // Görüş
  'weather.visibility.tenKmPlus': [],
  'weather.visibility.lessThan50': [],
  'weather.visibility.above': ['visibility'],
  'weather.visibility.below': ['visibility'],
  'weather.visibility.minimum': ['visibility', 'direction'],
  // Bulut
  'weather.clouds.lowest': ['height'],
  'weather.clouds.cb': [],
  'weather.clouds.tcu': [],
  'weather.clouds.nsc': [],
  'weather.clouds.cavok': [],
  'weather.clouds.ncd': [],
  'weather.clouds.skc': [],
  'weather.clouds.vv': ['height'],
  'weather.clouds.vvUnknown': [],
  // Başlık
  'weather.headline.cavok': [],
  'weather.headline.nsc': [],
  'weather.headline.noReport': [],
  'weather.headline.undetermined': [],
  'weather.headline.unknown': [],
  // Nem
  'weather.humidity': ['percent'],
  // Önümüzdeki 2 saat (METAR TREND)
  'weather.trend.nosig': [],
  'weather.trend.tempo': ['change'],
  'weather.trend.becmg': ['change'],
  // Gözlem 30 dakikadan eskiyse eğilim gözlemden sonraki 2 saatin bitişiyle yazılır
  'weather.trend.nosigUntil': ['to'],
  'weather.trend.tempoUntil': ['change', 'to'],
  'weather.trend.becmgUntil': ['change', 'to'],
  // Değişiklik öğeleri (TREND ve TAF)
  'weather.change.visibility': ['visibility'],
  'weather.change.wind': ['wind'],
  'weather.change.cavok': [],
  'weather.change.nsw': [],
  // TAF
  'weather.taf.base': ['from', 'to', 'phrase'],
  'weather.taf.until': ['to', 'phrase'],
  'weather.taf.fm': ['from', 'phrase'],
  'weather.taf.becmg': ['from', 'to', 'phrase'],
  'weather.taf.tempo': ['from', 'to', 'phrase'],
  'weather.taf.tempoUntil': ['to', 'phrase'],
  'weather.taf.prob': ['from', 'to', 'probability', 'phrase'],
  'weather.taf.probUntil': ['to', 'probability', 'phrase'],
  'weather.taf.probTempo': ['from', 'to', 'probability', 'phrase'],
  'weather.taf.probTempoUntil': ['to', 'probability', 'phrase'],
  /** Etkili rüzgâr öğesi: şiddet adı (`weather.wind.level.*`) ve rüzgâr. */
  'weather.taf.strongWind': ['level', 'wind'],
  'weather.taf.validUntil': ['time'],
  'weather.taf.nothingSignificant': [],
  'weather.taf.none': [],
  'weather.taf.cancelled': [],
  'weather.taf.nil': [],
  'weather.taf.amended': [],
  'weather.taf.corrected': [],
  // Zaman
  'weather.time.tomorrow': ['time'],
  'weather.time.onDate': ['date', 'time'],
  // Notlar
  'weather.note.auto': [],
  'weather.note.undetermined': [],
  'weather.note.nil': [],
  'weather.note.corrected': [],
  'weather.note.speci': [],
} as const satisfies Record<string, readonly string[]>

type FixedKey = keyof typeof FIXED_KEYS
type CompassKey = `weather.compass.${'from' | 'name'}.${(typeof COMPASS_POINTS_8)[number]}`
type CoverKey = `weather.clouds.${(typeof CLOUD_COVERS)[number]}`
/** Etkili rüzgârın şiddet adı (`WIND_LEVELS`; D-083). */
type WindLevelKey = `weather.wind.level.${(typeof WIND_LEVELS)[number]}`
/** Gök gürültüsü satırının şimşek ve yıldırım uyarısı (`LIGHTNING_RISKS`; D-083). */
type ThunderKey = `weather.thunder.${(typeof LIGHTNING_RISKS)[number]}`
/** `weather.wx.<id>`: hava olayı metinleri (`WX_PHRASE_IDS`). */
type WxKey = `weather.wx.${string}`

export type WeatherPhraseKey = FixedKey | CompassKey | CoverKey | WindLevelKey | ThunderKey | WxKey

/** Anahtar → beklenen değişken adları (sıralı). */
export const WEATHER_PHRASE_KEYS: Readonly<Record<string, readonly string[]>> = {
  ...FIXED_KEYS,
  ...Object.fromEntries(
    COMPASS_POINTS_8.flatMap((point) => [
      [`weather.compass.from.${point}`, []],
      [`weather.compass.name.${point}`, []],
    ]),
  ),
  ...Object.fromEntries(CLOUD_COVERS.map((cover) => [`weather.clouds.${cover}`, []])),
  ...Object.fromEntries(WIND_LEVELS.map((level) => [`weather.wind.level.${level}`, []])),
  ...Object.fromEntries(LIGHTNING_RISKS.map((risk) => [`weather.thunder.${risk}`, []])),
  ...Object.fromEntries(WX_PHRASE_IDS.map((id) => [`weather.wx.${id}`, []])),
}

export const phrase = (key: WeatherPhraseKey, params?: Record<string, WeatherParam>): Phrase =>
  params === undefined ? { key } : { key, params }

export const list = (
  items: readonly WeatherText[],
  separator: PhraseList['separator'],
): WeatherText =>
  items.length === 1 && items[0] !== undefined ? items[0] : { list: items, separator }

export function isPhrase(value: WeatherParam): value is Phrase {
  return typeof value === 'object' && 'key' in value
}
export function isPhraseList(value: WeatherParam): value is PhraseList {
  return typeof value === 'object' && 'list' in value
}
export function isMeasure(value: WeatherParam): value is Measure {
  return typeof value === 'object' && 'measure' in value
}

/** Metin kalıbını (anahtar) ve ölçüleri metne çeviren bağlam. */
export interface WeatherRenderContext {
  locale: Locale
  /** Anahtarın metin kalıbı ("{name}" yer tutuculu); `messageAt(messages, key)` ile bulunabilir. */
  text: (key: WeatherPhraseKey) => string
  /** Ölçüyü dile ve birim tercihine göre biçimler (ör. "33 km/sa", "1,5 km", "15:00"). */
  measure: (value: Measure) => string
}

const INTL_LOCALE: Record<Locale, string> = { tr: 'tr-TR', en: 'en-GB' }

/** İlk harfi büyütür (tr'de i → İ). */
export function capitalizeFirst(text: string, locale: Locale): string {
  const first = text.charAt(0)
  return first === '' ? text : first.toLocaleUpperCase(INTL_LOCALE[locale]) + text.slice(1)
}

/**
 * İç içe metnin ilk harfini küçültür (tr'de I → ı). Kısaltma gibi büyük harfle süren sözcük
 * ("CAVOK") ve harfle başlamayan metin olduğu gibi kalır.
 */
function decapitalizeFirst(text: string, locale: Locale): string {
  const first = text.charAt(0)
  const second = text.charAt(1)
  if (first === '' || first.toLocaleLowerCase(INTL_LOCALE[locale]) === first) return text
  const upper = second.toLocaleUpperCase(INTL_LOCALE[locale])
  if (second !== '' && upper === second && /\p{L}/u.test(second)) return text
  return first.toLocaleLowerCase(INTL_LOCALE[locale]) + text.slice(1)
}

function renderInner(value: WeatherParam, ctx: WeatherRenderContext): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (isMeasure(value)) return ctx.measure(value)
  if (isPhraseList(value)) {
    return value.list.map((item) => renderInner(item, ctx)).join(SEPARATORS[value.separator])
  }
  const template = ctx.text(value.key)
  const filled = template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const param = value.params?.[name]
    if (param === undefined)
      throw new Error(`Hava durumu metni değişkeni eksik: {${name}} (${value.key})`)
    return renderInner(param, ctx)
  })
  return decapitalizeFirst(filled, ctx.locale)
}

/**
 * Özet parçasını metne çevirir: iç içe parçalar küçük harfle başlar, bütün metnin ilk harfi büyür
 * ("Kuzeydoğudan 33 km/sa, hamle 59 km/sa"). Eksik değişken hata fırlatır (sessiz boş metin olmaz).
 */
export function renderWeatherText(
  value: WeatherText,
  ctx: WeatherRenderContext,
  options: { capitalize?: boolean } = {},
): string {
  const text = renderInner(value, ctx)
  return options.capitalize === false ? text : capitalizeFirst(text, ctx.locale)
}

/** İç içe mesaj ağacında noktalı yolu okur (`weather.wx.RA`); metin değilse undefined. */
export function messageAt(messages: unknown, key: string): string | undefined {
  let node: unknown = messages
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}

const KMH_PER_KT = 1.852
const M_PER_FT = 0.3048

/** kt → km/sa, tam sayı. */
export function ktToKmh(kt: number): number {
  return Math.round(kt * KMH_PER_KT)
}

/**
 * Bulut tabanı ve dikey görüş metre gösterimi: 1000 m altı en yakın 10 m'ye, üstü en yakın 50 m'ye
 * yuvarlanır (brief §5).
 */
export function cloudBaseMeters(ft: number): number {
  const meters = ft * M_PER_FT
  return meters < 1000 ? Math.round(meters / 10) * 10 : Math.round(meters / 50) * 50
}

/**
 * Görüş gösterimi: 1000 m altı metre ("350 m"), 5000 m altı bir ondalıklı km ("1,5 km"; tam ise
 * ondalıksız "4 km"), üstü tam km ("7 km"). Raporlanan görüş aşağı yuvarlandığı için gösterim de
 * aşağı yuvarlar (mil çevirisi 9656 m → "9 km"). 10 km ve üzeri ayrı metindir (`tenKmPlus`).
 */
export function visibilityDisplay(meters: number): {
  value: number
  unit: 'm' | 'km'
  fractionDigits: 0 | 1
} {
  if (meters < 1000) return { value: Math.floor(meters), unit: 'm', fractionDigits: 0 }
  if (meters < 5000) {
    const km = Math.floor(meters / 100) / 10
    return { value: km, unit: 'km', fractionDigits: Number.isInteger(km) ? 0 : 1 }
  }
  return { value: Math.floor(meters / 1000), unit: 'km', fractionDigits: 0 }
}
