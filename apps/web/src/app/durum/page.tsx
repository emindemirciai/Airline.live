import { format, getMessages } from '@havayolu/i18n'
import { currentVersion, pickText, roadmapProgress, ROADMAP, shortSha } from '@havayolu/shared'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { fetchApiStatus } from '@/lib/api-status'
import { getServerEnv } from '@/lib/env'
import { getLocale } from '@/lib/locale'
import { pageMetadata } from '@/lib/seo/metadata'

/** Operasyonel ve sık değişen içerik: `noindex, follow`, site haritasında yok (kullanıcı kararı, D-076). */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = getMessages(locale)
  return pageMetadata({
    locale,
    path: '/durum',
    title: t.status.title,
    description: t.seo.status.description,
    index: false,
  })
}

export default async function StatusPage() {
  await connection()
  const locale = await getLocale()
  const t = getMessages(locale).status
  const env = getServerEnv()
  const api = await fetchApiStatus(env.API_INTERNAL_URL)
  const progress = roadmapProgress()
  // Kontrol zamanı UTC'dir ve etiketlidir: "6.10.2026 14:20:00 UTC" (D-106).
  const checkedAt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(api.checkedAt))

  return (
    <article className="page">
      <h1>{t.title}</h1>
      <p className="lead">{t.intro}</p>

      <dl className="facts">
        <div>
          <dt>{t.appVersion}</dt>
          <dd className="mono">v{currentVersion()}</dd>
        </div>
        <div>
          <dt>{t.build}</dt>
          <dd className="mono" title={env.GIT_SHA}>
            {shortSha(env.GIT_SHA)}
          </dd>
        </div>
        <div>
          <dt>{t.environment}</dt>
          <dd className="mono">{env.APP_ENV}</dd>
        </div>
        <div>
          <dt>{t.api}</dt>
          <dd>
            {api.reachable ? (
              <span className="state state-ok">{t.apiOk}</span>
            ) : (
              <span className="state state-down">{t.apiDown}</span>
            )}
          </dd>
        </div>
        {api.reachable ? (
          <div>
            <dt>{t.apiVersion}</dt>
            <dd className="mono" title={api.gitSha}>
              v{api.version} · {shortSha(api.gitSha)}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>{t.checkedAt}</dt>
          <dd className="mono">{checkedAt}</dd>
        </div>
      </dl>
      {api.reachable ? null : <p className="hint">{t.apiDownHint}</p>}

      <section aria-labelledby="roadmap-heading">
        <h2 id="roadmap-heading">{t.roadmap}</h2>
        <p className="progress-label">{format(t.progress, progress)}</p>
        <progress className="progress" value={progress.done} max={progress.total} />
        <ol className="roadmap">
          {ROADMAP.map((milestone) => (
            <li key={milestone.id} className={`milestone milestone-${milestone.status}`}>
              <span className="milestone-part mono">
                {t.part} {milestone.part}
              </span>
              <span className="milestone-title">{pickText(milestone.title, locale)}</span>
              <span className={`state state-${milestone.status}`}>
                {t.milestoneStatus[milestone.status]}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </article>
  )
}
