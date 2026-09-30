import { getMessages } from '@havayolu/i18n'
import Link from 'next/link'
import { getLocale } from '@/lib/locale'

export default async function NotFound() {
  const t = getMessages(await getLocale()).errors
  return (
    <article className="page">
      <h1>{t.notFoundTitle}</h1>
      <p className="lead">{t.notFoundBody}</p>
      <p>
        <Link href="/" className="try-link">
          {t.goToMap} →
        </Link>
      </p>
    </article>
  )
}
