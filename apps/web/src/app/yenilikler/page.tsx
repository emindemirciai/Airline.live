import { getMessages } from '@havayolu/i18n'
import { CHANGELOG, currentVersion } from '@havayolu/shared'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { ChangelogContent } from '@/components/changelog/changelog-content'
import { JsonLd } from '@/components/json-ld'
import { getLocale } from '@/lib/locale'
import { SERVER_STARTED_AT } from '@/lib/server-start'
import { pageMetadata } from '@/lib/seo/metadata'
import { webPageNode } from '@/lib/seo/structured-data'

const CHANGELOG_PATH = '/yenilikler'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = getMessages(locale)
  return pageMetadata({
    locale,
    path: CHANGELOG_PATH,
    title: t.changelog.title,
    description: t.seo.changelog.description,
  })
}

export default async function ChangelogPage() {
  // Çalışan sürümün yayın saati sunucunun açılış anıdır (D-091); sayfa build'de üretilip derleme anı
  // gömülmesin diye istek anında çizilir.
  await connection()
  const locale = await getLocale()
  const t = getMessages(locale).changelog
  // En yeni sürüm listenin başındadır; sayfanın doğrulanabilir son değişiklik tarihi odur.
  const newestDate = CHANGELOG[0]?.date

  return (
    <article className="page">
      <JsonLd
        data={webPageNode({
          locale,
          path: CHANGELOG_PATH,
          name: t.title,
          ...(newestDate ? { dateModified: newestDate } : {}),
        })}
      />
      <ChangelogContent
        locale={locale}
        runningVersion={currentVersion()}
        serverStartedAt={SERVER_STARTED_AT}
      />
    </article>
  )
}
