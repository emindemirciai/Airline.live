import { format, getMessages, type Messages } from '@havayolu/i18n'
import type { Locale, ServiceStatus } from '@havayolu/shared'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { ADMIN_COOKIE, fetchServices } from '@/lib/admin-api'
import { getServerEnv } from '@/lib/env'
import { clientForwardHeaders } from '@/lib/forwarded'
import { getLocale } from '@/lib/locale'
import { logoutAction } from './actions'

export async function generateMetadata(): Promise<Metadata> {
  return { title: getMessages(await getLocale()).admin.servicesTitle, robots: { index: false } }
}

type AdminMessages = Messages['admin']

function serviceLabel(id: string, t: AdminMessages): string {
  switch (id) {
    case 'web':
      return t.services.web
    case 'api':
      return t.services.api
    case 'worker:worker-rt':
      return t.services.workerRt
    case 'worker:worker-bg':
      return t.services.workerBg
    case 'postgres':
      return t.services.postgres
    case 'redis-queue':
      return t.services.redisQueue
    case 'redis-live':
      return t.services.redisLive
    case 'analytics':
      return t.services.analytics
    case 'reference-data':
      return t.services.referenceData
    case 'track-partitions':
      return t.services.trackPartitions
    default:
      return id.startsWith('worker:') ? `${t.services.workerOther} (${id.slice(7)})` : id
  }
}

function detailItems(service: ServiceStatus, t: AdminMessages, locale: Locale): string[] {
  const d = service.detail
  const items: string[] = []
  const count = (value: unknown) =>
    typeof value === 'number' ? value.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-GB') : '?'
  if (typeof d.airports === 'number') {
    items.push(
      format(t.detail.counts, {
        airports: count(d.airports),
        runways: count(d.runways),
        airlines: count(d.airlines),
      }),
    )
  }
  if (typeof d.lastCheckAgeH === 'number') {
    items.push(`${t.detail.lastCheck}: ${format(t.detail.hoursAgo, { n: d.lastCheckAgeH })}`)
  }
  if (d.origin === 'remote' || d.origin === 'fixture') {
    items.push(
      `${t.detail.origin}: ${d.origin === 'remote' ? t.detail.originRemote : t.detail.originFixture}`,
    )
  }
  if (typeof d.daysAhead === 'number') items.push(`${t.detail.daysAhead}: ${d.daysAhead}`)
  if (typeof d.oldestDay === 'string') items.push(`${t.detail.oldestDay}: ${d.oldestDay}`)
  if (typeof d.defaultRows === 'number') {
    items.push(`${t.detail.defaultRows}: ${count(d.defaultRows)}`)
  }
  if (typeof d.memoryUsedMb === 'number') {
    items.push(
      `${t.detail.memory}: ${format(t.detail.megabytes, { used: d.memoryUsedMb, max: d.memoryMaxMb ?? '∞' })}`,
    )
  }
  if (typeof d.heartbeatAgeSec === 'number') {
    items.push(`${t.detail.heartbeatAge}: ${format(t.detail.secondsAgo, { n: d.heartbeatAgeSec })}`)
  }
  if (typeof d.roles === 'string') items.push(`${t.detail.roles}: ${d.roles}`)
  if (typeof d.uptimeSec === 'number') {
    items.push(`${t.detail.uptime}: ${format(t.detail.seconds, { n: d.uptimeSec })}`)
  }
  if (typeof d.gitSha === 'string') items.push(`${t.detail.gitSha}: ${d.gitSha}`)
  if (typeof d.httpStatus === 'number') items.push(`${t.detail.httpStatus}: ${d.httpStatus}`)
  if (typeof d.error === 'string') items.push(`${t.detail.error}: ${d.error}`)
  return items
}

function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso))
}

export default async function AdminServicesPage() {
  await connection()
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!token) redirect('/admin/giris')

  const locale = await getLocale()
  const t = getMessages(locale).admin
  const result = await fetchServices(token, await clientForwardHeaders())
  if (!result.ok && result.reason === 'unauthorized') redirect('/admin/giris')
  const analyticsUrl = getServerEnv().ANALYZE_URL

  return (
    <article className="page page-wide">
      <header className="page-header">
        <div>
          <h1>{t.servicesTitle}</h1>
          <p className="lead">{t.servicesIntro}</p>
        </div>
        <div className="actions">
          <Link href="/admin" className="button button-secondary" prefetch={false}>
            {t.refresh}
          </Link>
          {analyticsUrl ? (
            <a
              href={analyticsUrl}
              className="button button-secondary"
              target="_blank"
              rel="noreferrer"
            >
              {t.openAnalytics} ↗
            </a>
          ) : null}
          <form action={logoutAction}>
            <button type="submit" className="button button-secondary">
              {t.logout}
            </button>
          </form>
        </div>
      </header>

      {result.ok ? (
        <>
          <p>
            {t.overall}:{' '}
            <span className={`state state-${result.report.overall}`}>
              {t.states[result.report.overall]}
            </span>{' '}
            <span className="mono muted">{formatTime(result.report.checkedAt, locale)}</span>
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t.columns.service}</th>
                  <th scope="col">{t.columns.state}</th>
                  <th scope="col">{t.columns.version}</th>
                  <th scope="col">{t.columns.latency}</th>
                  <th scope="col">{t.columns.detail}</th>
                </tr>
              </thead>
              <tbody>
                {result.report.services.map((service) => (
                  <tr key={service.id}>
                    <th scope="row">{serviceLabel(service.id, t)}</th>
                    <td>
                      <span className={`state state-${service.state}`}>
                        {t.states[service.state]}
                      </span>
                    </td>
                    <td className="mono">{service.version ? `v${service.version}` : '—'}</td>
                    <td className="mono">
                      {service.latencyMs === null ? '—' : `${service.latencyMs} ms`}
                    </td>
                    <td>
                      <ul className="detail-list">
                        {detailItems(service, t, locale).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p role="alert" className="form-error">
          {t.fetchFailed}
        </p>
      )}
    </article>
  )
}
