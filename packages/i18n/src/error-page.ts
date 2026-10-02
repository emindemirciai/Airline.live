import type { Locale } from '@havayolu/shared'

export interface ErrorPageMessages {
  title: string
  body: string
  retry: string
  goToMap: string
}

/**
 * Beklenmeyen hata sayfasının metinleri (`apps/web/src/app/error.tsx`, `global-error.tsx`). Hata
 * sınırları istemci bileşenidir ve her sayfanın paketine girer; bütün mesaj kataloğu yerine bu
 * küçük dosyayı `@havayolu/i18n/error-page` yolundan alırlar. Aynı metinler `getMessages(locale)
 * .errors.page` olarak da vardır (tr.ts, en.ts); iki dilin anahtar eşitliği oradaki testle denetlenir.
 */
export const ERROR_PAGE_MESSAGES: Readonly<Record<Locale, ErrorPageMessages>> = {
  tr: {
    title: 'Bir sorun çıktı',
    body: 'Sayfa şu an açılamadı. Biraz sonra yeniden dene ya da canlı haritadan devam et.',
    retry: 'Yeniden dene',
    goToMap: 'Haritaya dön',
  },
  en: {
    title: 'Something went wrong',
    body: 'This page could not be loaded right now. Try again shortly or continue on the live map.',
    retry: 'Try again',
    goToMap: 'Back to the map',
  },
}
