import { DEFAULT_LOCALE, isLocale, type Locale } from '@havayolu/shared'
import { en } from './messages/en'
import { tr, type Messages } from './messages/tr'

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

/** Tarihi seçili dilde, Europe/Istanbul saat diliminde biçimlendirir. */
export function formatDate(isoDate: string, locale: Locale): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(date)
}
