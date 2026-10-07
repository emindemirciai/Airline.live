import type { Locale } from '@havayolu/shared'

/**
 * `/durum` sayfasının kontrol zamanı: UTC ve etiketli, saat dilimine kaydırılmaz (D-106).
 * TR "6.10.2026 14:20:00 UTC", EN "06/10/2026, 14:20:00 UTC".
 */
export function formatCheckedAt(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(iso))
}
