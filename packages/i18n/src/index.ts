import { DEFAULT_LOCALE, isLocale, type Locale } from '@havayolu/shared'
import { en } from './messages/en'
import { tr, type Messages } from './messages/tr'

export type { Messages } from './messages/tr'
export * from './units'

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
