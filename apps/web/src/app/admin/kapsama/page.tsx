import { format, getMessages } from '@havayolu/i18n'
import { ARRIVAL_COVERAGE_HOURS } from '@havayolu/shared'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { ADMIN_COOKIE, fetchCoverageReport, fetchCoverageReports } from '@/lib/admin-api'
import {
  COVERAGE_DEFAULT_HOURS,
  coverageRefreshActiveId,
  parseCoverageReportId,
} from '@/lib/arrival-coverage'
import { clientForwardHeaders } from '@/lib/forwarded'
import { getLocale } from '@/lib/locale'
import { logoutAction } from '../actions'
import { AdminNav } from '../admin-nav'
import { AutoRefresh } from './auto-refresh'
import { CoverageLast7Table, CoverageReportDetail, CoverageReportsTable } from './coverage-view'
import { StartCoverageForm } from './start-form'

export async function generateMetadata(): Promise<Metadata> {
  return { title: getMessages(await getLocale()).admin.coverage.title }
}

/**
 * Kapsama raporu (Parça 1 M7b.2, D-098): "Son 7 gün" tablosu, "Raporu başlat" formu, raporlar ve
 * seçili rapor (`?rapor=<id>`). Etkin rapor varken sayfa kendini yeniler (25 dk'ya kadar).
 */
export default async function AdminCoveragePage({ searchParams }: PageProps<'/admin/kapsama'>) {
  await connection()
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!token) redirect('/admin/giris')

  const locale = await getLocale()
  const admin = getMessages(locale).admin
  const t = admin.coverage
  const { rapor } = await searchParams
  const rawId = Array.isArray(rapor) ? rapor[0] : rapor
  const selectedId = rawId === undefined ? null : parseCoverageReportId(rawId)

  const forwarded = await clientForwardHeaders()
  const [list, detail] = await Promise.all([
    fetchCoverageReports(token, forwarded),
    selectedId === null ? null : fetchCoverageReport(token, selectedId, forwarded),
  ])
  if (
    (!list.ok && list.reason === 'unauthorized') ||
    (detail !== null && !detail.ok && detail.reason === 'unauthorized')
  ) {
    redirect('/admin/giris')
  }

  return (
    <article className="page page-wide coverage-page">
      <AdminNav
        current="coverage"
        labels={{
          label: admin.navLabel,
          services: admin.servicesTitle,
          coverage: t.title,
          live: admin.liveLayer.title,
        }}
      />
      <header className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p className="lead">{t.intro}</p>
        </div>
        <div className="actions">
          <form action={logoutAction}>
            <button type="submit" className="button button-secondary">
              {admin.logout}
            </button>
          </form>
        </div>
      </header>

      {/* Liste alınamasa da çizilir (aynı yerde, durumu korunur): kısa bir API kesintisi
          yenilemeyi durdurmaz. */}
      <AutoRefresh activeId={coverageRefreshActiveId(list, detail)} labels={t.refresh} />

      {rawId !== undefined && (selectedId === null || (detail !== null && !detail.ok)) ? (
        <p role="alert" className="form-error">
          {detail !== null && !detail.ok && detail.reason === 'unavailable'
            ? t.fetchFailed
            : t.detail.notFound}
        </p>
      ) : null}
      {detail?.ok ? (
        <CoverageReportDetail
          report={detail.report}
          t={t}
          locale={locale}
          nowMs={Date.parse(detail.report.checkedAt)}
        />
      ) : null}

      <section aria-labelledby="coverage-start">
        <h2 id="coverage-start">{t.start.heading}</h2>
        <StartCoverageForm
          defaultHours={COVERAGE_DEFAULT_HOURS}
          labels={{
            hours: t.start.hours,
            options: ARRIVAL_COVERAGE_HOURS.map((value) => ({
              value,
              label: format(t.start.hoursOption, { n: value }),
            })),
            submit: t.start.submit,
            pending: t.start.pending,
            note: t.start.note,
            errors: t.start.errors,
          }}
        />
      </section>

      {list.ok ? (
        <>
          <section aria-labelledby="coverage-reports">
            <h2 id="coverage-reports">{t.reports.heading}</h2>
            <CoverageReportsTable
              reports={list.list.reports}
              selectedId={selectedId}
              t={t}
              locale={locale}
              nowMs={Date.parse(list.list.checkedAt)}
            />
          </section>
          <section aria-labelledby="coverage-last7">
            <h2 id="coverage-last7">{t.last7.heading}</h2>
            <p className="hint">{t.last7.intro}</p>
            <CoverageLast7Table stations={list.list.stations} t={t} locale={locale} />
          </section>
        </>
      ) : (
        <p role="alert" className="form-error">
          {t.fetchFailed}
        </p>
      )}
    </article>
  )
}
