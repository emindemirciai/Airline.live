'use client'

import '@fontsource/overpass/400.css'
import '@fontsource/overpass/600.css'
import '@fontsource/overpass/800.css'
import './globals.css'

import { ERROR_PAGE_MESSAGES } from '@havayolu/i18n/error-page'
import { useSyncExternalStore } from 'react'
// Göreli yollar: vitest `@/` takma adını çözmez ve bu dosya testte çizilir.
import { ErrorContent } from '../components/error-content'
import { stripLocale } from '../lib/locale-routing'

const subscribe = () => () => undefined
/** Adresin dili (`/en/*` İngilizce); sunucuda ve hidrasyonda varsayılan Türkçe. */
const browserLocale = () => stripLocale(window.location.pathname).locale
const serverLocale = () => 'tr' as const

/**
 * Kök düzenin kendisi hata verdiğinde (nadir) onun yerine geçen belge. Next'in yerleşik sayfası
 * işletim sisteminin koyu tercihine uyar ve İngilizcedir; bu sayfa sitenin stil dosyasını yükler:
 * "Açık turkuaz" teması ve `color-scheme: light` (D-081), metinler `packages/i18n`'den. Kök düzen
 * olmadığı için dil adresten okunur (`/en` öneki); sunucu çiziminde Türkçedir.
 */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const locale = useSyncExternalStore(subscribe, browserLocale, serverLocale)
  return (
    <html lang={locale}>
      <body>
        <title>{ERROR_PAGE_MESSAGES[locale].title}</title>
        <main className="site-main">
          <ErrorContent retry={retry} />
        </main>
      </body>
    </html>
  )
}
