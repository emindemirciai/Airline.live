import { getMessages } from '@havayolu/i18n'
import type { Metadata } from 'next'
import { JsonLd } from '@/components/json-ld'
import { TermsContent } from '@/components/terms-content'
import { appName, getServerEnv } from '@/lib/env'
import { getLocale } from '@/lib/locale'
import { pageMetadata } from '@/lib/seo/metadata'
import { webPageNode } from '@/lib/seo/structured-data'
import { TERMS_EFFECTIVE_DATE, TERMS_PATH } from '@/lib/terms'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = getMessages(locale)
  return pageMetadata({
    locale,
    path: TERMS_PATH,
    title: t.terms.title,
    description: t.seo.terms.description,
  })
}

/**
 * Geçici kullanım koşulları (D-075): Esri şartlarına uyma maddesi (E204 §3.1c.5) ve ODbL maddesi.
 * Dil adresten gelir (D-076): Türkçe `/kullanim-kosullari`, İngilizce `/en/kullanim-kosullari`.
 */
export default async function TermsPage() {
  const locale = await getLocale()
  return (
    <>
      <JsonLd
        data={webPageNode({
          locale,
          path: TERMS_PATH,
          name: getMessages(locale).terms.title,
          // Sayfada görünen yürürlük tarihi.
          dateModified: TERMS_EFFECTIVE_DATE,
        })}
      />
      <TermsContent locale={locale} app={appName(getServerEnv())} />
    </>
  )
}
