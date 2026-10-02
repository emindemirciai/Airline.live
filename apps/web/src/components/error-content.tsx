import { ERROR_PAGE_MESSAGES } from '@havayolu/i18n/error-page'
import { LOCALES } from '@havayolu/shared'
// Göreli yol: vitest `@/` takma adını çözmez ve bu bileşen testte çizilir.
import { localePath } from '../lib/locale-routing'

/**
 * Beklenmeyen hata sayfasının gövdesi (`app/error.tsx`, `app/global-error.tsx`). Hata sınırı istemci
 * bileşenidir ve sayfanın dilini sunucudan alamaz; metin iki dilde çizilir, her blok kendi `lang`'ını
 * taşır ve `<html lang>` dışındaki dil CSS ile gizlenir (globals.css → `.error-page`). Böylece sunucu
 * çiziminde de doğru dil görünür, JavaScript gerekmez ve gizli blok ekran okuyucuya ulaşmaz.
 * Başlık, tema ve açık renk düzeni sitenin kendisidir (Next'in yerleşik, işletim sisteminin koyu
 * tercihine uyan İngilizce hata sayfası gösterilmez; D-081).
 */
export function ErrorContent({ retry }: { retry: () => void }) {
  return (
    <article className="page error-page">
      {LOCALES.map((locale) => {
        const t = ERROR_PAGE_MESSAGES[locale]
        return (
          <div key={locale} lang={locale} className="error-page__copy">
            <h1>{t.title}</h1>
            <p className="lead">{t.body}</p>
            <p className="error-page__actions">
              <button type="button" className="button" onClick={retry}>
                {t.retry}
              </button>
              {/* Tam sayfa yüklemesi: hata sınırının dışındaki düzen de yeniden kurulur. */}
              <a href={localePath(locale, '/')} className="try-link">
                {t.goToMap} →
              </a>
            </p>
          </div>
        )
      })}
    </article>
  )
}
