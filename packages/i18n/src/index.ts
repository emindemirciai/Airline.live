import { DEFAULT_LOCALE, isLocale, TURKEY_TIME_ZONE, type Locale } from '@havayolu/shared'
import { en } from './messages/en'
import { tr, type Messages } from './messages/tr'
import { NO_VALUE } from './units'
import { formatClock, formatUtcOffset, type DateLike } from './weather'

export type { Messages } from './messages/tr'
export * from './units'
export * from './weather'

const catalogs: Record<Locale, Messages> = { tr, en }

export function getMessages(locale: Locale): Messages {
  return catalogs[locale]
}

/** Bilinmeyen ya da boş değeri varsayılan dile (tr) çevirir. */
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/** "{name}" yer tutucularını doldurur. Eksik değişken hata fırlatır (sessiz boş metin olmaz). */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    if (value === undefined) throw new Error(`Metin değişkeni eksik: {${key}}`)
    return String(value)
  })
}

/** Sayının okunuşundaki son sözcüğün ayrılma eki: birler, onlar, yüz, bin (ünlü ve ünsüz uyumu). */
const ABLATIVE_ONES = ['', 'den', 'den', 'ten', 'ten', 'ten', 'dan', 'den', 'den', 'dan'] as const
const ABLATIVE_TENS = ['', 'dan', 'den', 'dan', 'tan', 'den', 'tan', 'ten', 'den', 'dan'] as const

/**
 * "… beri" kalıbındaki yıl (D-090): Türkçede kesme işaretli ayrılma ekiyle, sayının okunuşuna göre
 * ("2022’den", "2023’ten", "2026’dan", "2040’tan", "2000’den"); İngilizcede yalnız yıl ("2022").
 * Pozitif tam sayı olmayan değer `RangeError` fırlatır.
 */
export function formatSinceYear(year: number, locale: Locale): string {
  if (!Number.isInteger(year) || year < 1) throw new RangeError(`invalid year: ${year}`)
  if (locale !== 'tr') return String(year)
  const ones = year % 10
  const tens = Math.floor(year / 10) % 10
  // Son sözcük birler ("iki"), yoksa onlar ("yirmi"), yoksa "yüz" ya da "bin" (boş ek, "-den").
  const suffix = (ones > 0 ? ABLATIVE_ONES[ones] : ABLATIVE_TENS[tens]) || 'den'
  return `${year}’${suffix}`
}

const longDates = new Map<Locale, Intl.DateTimeFormat>()

/** "4 Ekim 2026" / "4 October 2026", Europe/Istanbul takvimiyle. */
function longDate(locale: Locale): Intl.DateTimeFormat {
  let formatter = longDates.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: TURKEY_TIME_ZONE,
    })
    longDates.set(locale, formatter)
  }
  return formatter
}

/** Tarihi seçili dilde, Europe/Istanbul saat diliminde biçimlendirir. */
export function formatDate(isoDate: string, locale: Locale): string {
  return longDate(locale).format(new Date(`${isoDate}T12:00:00Z`))
}

/**
 * Yayın saatinin dilim etiketi (D-091): Türkçede açık yazılır: "Türkiye saati" (kısaltma kullanılmaz, web-ui kuralı; dilim
 * Türkiye'nin kendisi olduğundan ofset yazılmaz), İngilizcede o anki UTC farkı ("UTC+3"; `Intl`'den,
 * koda gömülmez).
 */
const RELEASE_ZONE: Record<Locale, (ms: number) => string> = {
  tr: () => 'Türkiye saati',
  en: (ms) => formatUtcOffset(ms),
}

/**
 * Bir sürümün yayın anı, seçili dilde ve Europe/Istanbul'da, 24 saat (D-091): "4 Ekim 2026, 20:27
 * (Türkiye saati)" / "4 October 2026, 20:27 (UTC+3)". Gün ve saat aynı dilimdedir (UTC 23:17 → "2 Ekim 2026,
 * 02:17"). Geçersiz anda "—".
 */
export function formatReleaseTime(at: DateLike, locale: Locale): string {
  const ms = at instanceof Date ? at.getTime() : typeof at === 'number' ? at : Date.parse(at)
  if (!Number.isFinite(ms)) return NO_VALUE
  return format(catalogs[locale].changelog.releasedAtValue, {
    date: longDate(locale).format(ms),
    time: formatClock(ms),
    zone: RELEASE_ZONE[locale](ms),
  })
}
