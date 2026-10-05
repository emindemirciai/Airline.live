import { format, getMessages, type Messages } from '@havayolu/i18n'
import { shortSha, type Locale, type ServiceStatus } from '@havayolu/shared'
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
import { AdminNav } from './admin-nav'

export async function generateMetadata(): Promise<Metadata> {
  return { title: getMessages(await getLocale()).admin.servicesTitle }
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
    case 'weather':
      return t.services.weather
    case 'track-partitions':
      return t.services.trackPartitions
    case 'provider:adsbLol':
      return t.services.providerAdsbLol
    case 'provider:localReceiver':
      return t.services.providerLocalReceiver
    default:
      return id.startsWith('worker:') ? `${t.services.workerOther} (${id.slice(7)})` : id
  }
}

/** Geçen süreyi okunur birimle yazar (sn → dk → sa → gün). */
function ago(sec: number, t: AdminMessages): string {
  if (sec < 120) return format(t.detail.secondsAgo, { n: sec })
  if (sec < 7_200) return format(t.detail.minutesAgo, { n: Math.floor(sec / 60) })
  if (sec < 172_800) return format(t.detail.hoursAgo, { n: Math.floor(sec / 3_600) })
  return format(t.detail.daysAgo, { n: Math.floor(sec / 86_400) })
}

function circuitLabel(value: string, t: AdminMessages): string {
  switch (value) {
    case 'closed':
    case 'open':
    case 'half_open':
    case 'config':
      return t.detail.circuitStates[value]
    default:
      return value
  }
}

/** Canlı veri sağlayıcısı satırının ayrıntıları (API: provider_health özeti). */
function providerItems(d: ServiceStatus['detail'], t: AdminMessages, locale: Locale): string[] {
  const tag = locale === 'tr' ? 'tr-TR' : 'en-GB'
  const number = (value: number, digits: number) =>
    new Intl.NumberFormat(tag, { maximumFractionDigits: digits }).format(value)
  const percent = (value: number) =>
    new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 1 }).format(value / 100)
  const items: string[] = []
  if (typeof d.staleSec === 'number') items.push(`${t.detail.healthRecord}: ${ago(d.staleSec, t)}`)
  if (typeof d.circuit === 'string') {
    items.push(`${t.detail.circuit}: ${circuitLabel(d.circuit, t)}`)
  }
  if (typeof d.rps === 'number') items.push(`${t.detail.rps}: ${number(d.rps, 3)}`)
  if (typeof d.freshnessP95Sec === 'number') {
    items.push(
      `${t.detail.freshnessP95}: ${format(t.detail.seconds, { n: number(d.freshnessP95Sec, 1) })}`,
    )
  }
  if (typeof d.errorRatioPct === 'number') {
    items.push(`${t.detail.errorRatio}: ${percent(d.errorRatioPct)}`)
  }
  if (typeof d.rateLimited1hPct === 'number') {
    items.push(`${t.detail.rateLimited1h}: ${percent(d.rateLimited1hPct)}`)
  }
  if (typeof d.rateLimited24hPct === 'number') {
    items.push(`${t.detail.rateLimited24h}: ${percent(d.rateLimited24hPct)}`)
  }
  if ('lastSuccessAgeSec' in d) {
    const age = d.lastSuccessAgeSec
    items.push(`${t.detail.lastSuccess}: ${typeof age === 'number' ? ago(age, t) : t.detail.never}`)
  }
  return items
}

/** Hava durumu satırının ayrıntıları (API: weather_sources özeti, D-078). */
function weatherItems(d: ServiceStatus['detail'], t: AdminMessages, locale: Locale): string[] {
  const count = (value: number) => value.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-GB')
  const minutes = (value: unknown) =>
    typeof value === 'number' ? ago(value * 60, t) : t.detail.never
  const items: string[] = []
  if (d.origin === 'disabled') {
    items.push(`${t.detail.origin}: ${t.detail.originDisabled}`)
    if (typeof d.reason === 'string') items.push(`${t.detail.reason}: ${d.reason}`)
  } else if (d.origin === 'remote' || d.origin === 'fixture') {
    items.push(
      `${t.detail.origin}: ${d.origin === 'remote' ? t.detail.weatherOriginRemote : t.detail.weatherOriginFixture}`,
    )
  }
  if (typeof d.stationsWithMetar === 'number') {
    const total = typeof d.stationsTotal === 'number' ? ` / ${count(d.stationsTotal)}` : ''
    items.push(`${t.detail.stationsWithMetar}: ${count(d.stationsWithMetar)}${total}`)
  }
  if ('newestObsAgeMin' in d) items.push(`${t.detail.newestObs}: ${minutes(d.newestObsAgeMin)}`)
  if ('metarCheckAgeMin' in d) items.push(`${t.detail.metarCheck}: ${minutes(d.metarCheckAgeMin)}`)
  if ('tafCheckAgeMin' in d) items.push(`${t.detail.tafCheck}: ${minutes(d.tafCheckAgeMin)}`)
  if (typeof d.validTafCount === 'number') {
    items.push(`${t.detail.validTafs}: ${count(d.validTafCount)}`)
  }
  if (typeof d.blockedUntil === 'string') {
    items.push(`${t.detail.blockedUntil}: ${formatTime(d.blockedUntil, locale)}`)
  }
  if (typeof d.error === 'string') items.push(`${t.detail.error}: ${d.error}`)
  return items
}

function detailItems(service: ServiceStatus, t: AdminMessages, locale: Locale): string[] {
  const d = service.detail
  if (service.id === 'weather') return weatherItems(d, t, locale)
  const items: string[] = service.kind === 'provider' ? providerItems(d, t, locale) : []
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
  if (typeof d.gitSha === 'string') items.push(`${t.detail.gitSha}: ${shortSha(d.gitSha)}`)
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
      <AdminNav
        current="services"
        labels={{ label: t.navLabel, services: t.servicesTitle, coverage: t.coverage.title }}
      />
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
