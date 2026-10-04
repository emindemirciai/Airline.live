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
