import {
  cloudBaseMeters,
  ktToKmh,
  localDayDifference,
  localTime,
  messageAt,
  renderWeatherText,
  TURKEY_TIME_ZONE,
  utcOffsetFromTable,
  utcOffsetLabel,
  visibilityDisplay,
  type Locale,
  type Measure,
  type WeatherPhraseKey,
  type WeatherText,
} from '@havayolu/shared'
import type { Messages } from './messages/tr'
import { NBSP, NO_VALUE } from './units'

/**
 * Hava durumu metinleri (Parça 1 M6c, D-078). Çözücünün özetleri (`summarizeMetar`,
 * `summarizeTaf`; `@havayolu/shared` → weather) metin üretmez, metin anahtarı + ölçü döner; burada
 * `messages/*.ts` → `weather` metinleriyle ve metrik birimlerle (D-072) metne çevrilir. Havalimanı
 * sayfası, harita penceresi ve ileride mobil aynı işlevleri kullanır.
 *
 * - Sayılar `Intl.NumberFormat` ile: tr 'tr-TR' (1.070 m; 1,5 km), en 'en-GB'. Basınçta binlik ayırıcı
 *   yoktur ("1009 hPa"). Eksi işareti U+2212'dir. Bilinmeyen değer "—".
 * - Saatler havalimanının saat diliminde (`WeatherTextOptions.timeZone`, IANA; varsayılan
 *   Europe/Istanbul), 24 saat ("15:50"); ofset koda gömülmez, yaz saati dahil `Intl` hesaplar (D-084).
 * - Saat okunmaz: zamana bağlı her işlev `now` (epoch ms) alır.
 */

export type WeatherMessages = Messages['weather']

export interface WeatherTextOptions {
  locale: Locale
  /** `getMessages(locale).weather`; istemciye yalnızca bu bölüm gönderilir. */
  t: WeatherMessages
  /**
   * Saatlerin yazıldığı saat dilimi (IANA): havalimanının dilimi (`airportTimeZone`). Verilmezse
   * Europe/Istanbul (Türkiye; dilimi bilinmeyen yabancı havalimanında "Türkiye saati" etiketiyle).
   */
  timeZone?: string
}

const MINUS = '−'
const INTL_LOCALE: Record<Locale, string> = { tr: 'tr-TR', en: 'en-GB' }
const SPEED_UNIT: Record<Locale, string> = { tr: 'km/sa', en: 'km/h' }
// Rüzgâr hızındaki boşluklar bölünmezdir (`NBSP`, units.ts): sayı biriminden, knot karşılığı
// km/sa'dan ayrı satıra düşmez ("48 km/sa (26 kt)" tek parça; pencerenin dar değer sütununda "48" /
// "km/sa" kırılıyordu, D-083).

const numberFormats = new Map<string, Intl.NumberFormat>()

function numberFormat(locale: Locale, digits: number, grouping = true): Intl.NumberFormat {
  const key = `${locale}:${digits}:${grouping}`
  let formatter = numberFormats.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(INTL_LOCALE[locale], {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      useGrouping: grouping,
    })
    numberFormats.set(key, formatter)
  }
  return formatter
}

const known = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** "{ad}" yer tutucularını doldurur (index.ts → `format` ile aynı; döngüsel içe aktarma olmasın). */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    if (value === undefined) throw new Error(`Metin değişkeni eksik: {${key}}`)
    return String(value)
  })
}

// ---------------------------------------------------------------------------------------------
// Birimler
// ---------------------------------------------------------------------------------------------

/** Sıcaklık, tam derece: "9 °C", "−1 °C" (U+2212); yuvarlanınca sıfırsa işaretsiz. */
export function formatTemperature(celsius: number | null, locale: Locale): string {
  if (!known(celsius)) return NO_VALUE
  const rounded = Math.round(Math.abs(celsius))
  const text = numberFormat(locale, 0).format(rounded)
  return `${celsius < 0 && rounded !== 0 ? MINUS : ''}${text} °C`
}

/** Basınç, hPa, binlik ayırıcı olmadan ("1009 hPa"; tr-TR "1.009" yazardı). */
export function formatPressure(hpa: number | null, locale: Locale): string {
  if (!known(hpa)) return NO_VALUE
  return `${numberFormat(locale, 0, false).format(Math.round(hpa))} hPa`
}

/**
 * Bulut tabanı ve dikey görüş (ft girdi), metre: 1.000 m'nin altında en yakın 10 m'ye, üstünde en
 * yakın 50 m'ye yuvarlanır ("240 m", "1.070 m").
 */
export function formatHeight(ft: number | null, locale: Locale): string {
  if (!known(ft)) return NO_VALUE
  return `${numberFormat(locale, 0).format(cloudBaseMeters(ft))} m`
}

/** Yükseklik, ft (uzman görünümü): "1.800 ft". */
export function formatFeet(ft: number | null, locale: Locale): string {
  if (!known(ft)) return NO_VALUE
  return `${numberFormat(locale, 0).format(Math.round(ft))} ft`
}

/**
 * Rüzgâr hızı (kt girdi), km/sa: 18 kt → "33 km/sa" (en "33 km/h"). `kmh` raporun kendi biriminden
 * çevrilmiş değerdir (MPS raporu; `Wind.speedKmh`); verilmezse kt'den çevrilir.
 */
export function formatWindSpeed(kt: number | null, locale: Locale, kmh?: number | null): string {
  if (!known(kt)) return NO_VALUE
  const value = known(kmh) ? kmh : ktToKmh(kt)
  return `${numberFormat(locale, 0).format(value)}${NBSP}${SPEED_UNIT[locale]}`
}

/**
 * Rüzgâr hızı, sade görünüm (D-083): km/sa önce, knot parantezde: "33 km/sa (18 kt)" / "33 km/h
 * (18 kt)". kt rapordaki tam sayıdır.
 */
export function formatWindSpeedDual(
  kt: number | null,
  locale: Locale,
  kmh?: number | null,
): string {
  if (!known(kt)) return NO_VALUE
  const knots = numberFormat(locale, 0).format(Math.round(kt))
  return `${formatWindSpeed(kt, locale, kmh)}${NBSP}(${knots}${NBSP}kt)`
}

/** Rüzgâr hızı, uzman görünümü: knot önce, "18 kt (33 km/sa)". */
export function formatWindSpeedBoth(
  kt: number | null,
  locale: Locale,
  kmh?: number | null,
): string {
  if (!known(kt)) return NO_VALUE
  const knots = numberFormat(locale, 0).format(Math.round(kt))
  return `${knots}${NBSP}kt${NBSP}(${formatWindSpeed(kt, locale, kmh)})`
}

/** Görüş ve RVR (m girdi): "350 m", "1,5 km", "4 km", "7 km" (`visibilityDisplay`). */
export function formatVisibility(meters: number | null, locale: Locale): string {
  if (!known(meters)) return NO_VALUE
  const { value, unit, fractionDigits } = visibilityDisplay(meters)
  return `${numberFormat(locale, fractionDigits).format(value)} ${unit}`
}

// ---------------------------------------------------------------------------------------------
// Zaman
// ---------------------------------------------------------------------------------------------

export type DateLike = Date | number | string

const toMs = (value: DateLike): number =>
  value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value)

/** Yerel saat, verilen dilimde (varsayılan Europe/Istanbul), 24 saat: "15:50". Geçersizse "—". */
export function formatClock(at: DateLike, timeZone: string = TURKEY_TIME_ZONE): string {
  const ms = toMs(at)
  return Number.isFinite(ms) ? localTime(ms, timeZone).hhmm : NO_VALUE
}

/** UTC saat: "12:50". */
export function formatUtcClock(at: DateLike): string {
  const ms = toMs(at)
  if (!Number.isFinite(ms)) return NO_VALUE
  const date = new Date(ms)
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

/**
 * Yerel saatin o andaki UTC farkı, verilen dilimde (varsayılan Europe/Istanbul): "UTC+3",
 * "UTC+3:30", "UTC−4" (eksi U+2212). Ofset `Intl`'den gelir, koda gömülmez; yaz saati dahildir.
 */
export function formatUtcOffset(at: DateLike, timeZone: string = TURKEY_TIME_ZONE): string {
  const ms = toMs(at)
  if (!Number.isFinite(ms)) return 'UTC'
  return utcOffsetLabel(localTime(ms, timeZone).utcOffsetMinutes)
}

const dayMonthFormats = new Map<string, Intl.DateTimeFormat>()

/**
 * Yerel gün ve ay, verilen dilimde (varsayılan Europe/Istanbul): "17 Ocak" / "17 January". Dilimin
 * sunucu fark tablosu kayıtlıysa (D-109, `registerUtcOffsetTable`) gün UTC + farktan yazılır
 * (`localTime` gibi; tarayıcının tz verisine bakılmaz).
 */
export function formatDayMonth(
  at: DateLike,
  locale: Locale,
  timeZone: string = TURKEY_TIME_ZONE,
): string {
  const ms = toMs(at)
  if (!Number.isFinite(ms)) return NO_VALUE
  const offset = utcOffsetFromTable(timeZone, ms)
  if (offset !== undefined) return dayMonthFormat(locale, 'UTC').format(ms + offset * 60_000)
  return dayMonthFormat(locale, timeZone).format(ms)
}

function dayMonthFormat(locale: Locale, timeZone: string): Intl.DateTimeFormat {
  const key = `${locale}:${timeZone}`
  let formatter = dayMonthFormats.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      day: 'numeric',
      month: 'long',
      timeZone,
    })
    dayMonthFormats.set(key, formatter)
  }
  return formatter
}

/**
 * Yerel saat, gün değişiyorsa günüyle: aynı gün "15:00", ertesi gün "yarın 03:00" ("03:00
 * tomorrow"), daha uzak "17 Ocak 09:00". Gün, `timeZone`'un (havalimanının) takvimine göredir.
 */
export function formatDayTime(
  at: DateLike,
  now: number,
  { locale, t, timeZone = TURKEY_TIME_ZONE }: WeatherTextOptions,
): string {
  const ms = toMs(at)
  if (!Number.isFinite(ms)) return NO_VALUE
  const time = formatClock(ms, timeZone)
  const days = localDayDifference(now, ms, timeZone)
  if (days === 0) return time
  if (days === 1) return fill(t.time.tomorrow, { time })
  return fill(t.time.onDate, { date: formatDayMonth(ms, locale, timeZone), time })
}

/**
 * Süre: "18 dakika", "2 saat 10 dakika", "6 saat", "3 gün". 3 saatten uzun sürelerde dakika
 * yazılmaz; 48 saatten uzunlar gündür.
 */
export function formatDuration(ms: number, { t }: WeatherTextOptions): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  if (totalMinutes < 60) return fill(t.duration.minutes, { m: totalMinutes })
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 48) return fill(t.duration.days, { d: Math.floor(hours / 24) })
  if (hours >= 3 || minutes === 0) return fill(t.duration.hours, { h: hours })
  return fill(t.duration.hoursMinutes, { h: hours, m: minutes })
}

/** Göreli zaman: "18 dakika önce"; bir dakikadan kısa ya da gelecekteyse "az önce". */
export function formatAgo(at: DateLike, now: number, options: WeatherTextOptions): string {
  const ms = now - toMs(at)
  if (!Number.isFinite(ms) || ms < 60_000) return options.t.justNow
  return fill(options.t.ago, { duration: formatDuration(ms, options) })
}

// ---------------------------------------------------------------------------------------------
// Özetlerin metne çevrilmesi
// ---------------------------------------------------------------------------------------------

/**
 * Ölçüyü metrik ve dile göre yazar (`renderWeatherText` → `measure`); saat ve tarih `timeZone`'da
 * (varsayılan Europe/Istanbul).
 */
export function formatMeasure(
  value: Measure,
  locale: Locale,
  timeZone: string = TURKEY_TIME_ZONE,
): string {
  switch (value.measure) {
    case 'speed':
      return formatWindSpeedDual(value.kt, locale, value.kmh)
    case 'visibility':
      return formatVisibility(value.meters, locale)
    case 'height':
      return formatHeight(value.ft, locale)
    case 'temperature':
      return formatTemperature(value.celsius, locale)
    case 'pressure':
      return formatPressure(value.hpa, locale)
    case 'time':
      return formatClock(value.iso, timeZone)
    case 'date':
      return formatDayMonth(value.iso, locale, timeZone)
  }
}

/**
 * Çözücü özetini (`WeatherText`: anahtar + değişken + ölçü) metne çevirir; ilk harf büyür, iç içe
 * parçalar küçük harfle başlar. Eksik anahtar hata fırlatır (sessiz boş metin olmaz; i18n testi
 * bütün anahtarları `WEATHER_PHRASE_KEYS` listesinden denetler).
 */
export function weatherText(
  value: WeatherText,
  { locale, t, timeZone }: WeatherTextOptions,
  options: { capitalize?: boolean } = {},
): string {
  const root = { weather: t }
  return renderWeatherText(
    value,
    {
      locale,
      text: (key: WeatherPhraseKey) => {
        const template = messageAt(root, key)
        if (template === undefined) throw new Error(`Hava durumu metni yok: ${key}`)
        return template
      },
      measure: (measure) => formatMeasure(measure, locale, timeZone),
    },
    options,
  )
}
