import { getMessages } from '@havayolu/i18n'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale } from '@/lib/locale'
import { localePath } from '@/lib/locale-routing'

/**
 * Yalnızca başlık: 404 sayfasının kanonik adresi ve dil karşılıkları yoktur; Next.js 404 durumunda
 * `noindex` etiketini kendisi ekler.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: getMessages(await getLocale()).errors.notFoundTitle }
}

export default async function NotFound() {
  const locale = await getLocale()
  const t = getMessages(locale).errors
  return (
    <article className="page">
      <h1>{t.notFoundTitle}</h1>
      <p className="lead">{t.notFoundBody}</p>
      <p>
        <Link href={localePath(locale, '/')} className="try-link">
          {t.goToMap} →
        </Link>
      </p>
    </article>
  )
}
