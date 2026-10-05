import { format, type Messages } from '@havayolu/i18n'
import type { Locale } from '@havayolu/shared'
import Link from 'next/link'
// Göreli yollar: vitest `@/` takma adını çözmez; bu bileşenler testte çizilir.
import {
  coverageDownloadHref,
  coverageDurationMs,
  coverageFailureText,
  coverageReportHref,
  coverageResultSummary,
  formatCoverageNumber,
  formatCoveragePercent,
  formatCoverageTime,
  type CoverageDetail,
  type CoverageReport,
  type CoverageRule,
  type CoverageStation,
  type CoverageStatus,
} from '../../../lib/arrival-coverage'

/**
 * Kapsama raporu sayfasının çizimleri (sunucu bileşenleri; durum tutmaz). Sayılar ve zamanlar
 * yalnızca API'nin toplamlarıdır: hex, tescil ve çağrı kodu yoktur. Markdown metni HTML olarak
 * yorumlanmaz, `<pre>` içinde düz metin olarak gösterilir.
 */
type CoverageMessages = Messages['admin']['coverage']

const DASH = '—'

/** Durum rozetinin sınıfı (globals.css `.state-*`). */
const STATUS_CLASS: Record<CoverageStatus, string> = {
  queued: 'state-planned',
  running: 'state-in_progress',
  done: 'state-ok',
  failed: 'state-down',
}

const VERDICT_CLASS: Record<CoverageRule['verdict'], string> = {
  applies: 'state-degraded',
  does_not_apply: 'state-ok',
  no_arrivals: 'state-not_configured',
}

export function StatusBadge({ status, t }: { status: CoverageStatus; t: CoverageMessages }) {
  return <span className={`state ${STATUS_CLASS[status]}`}>{t.statuses[status]}</span>
}

export function formatCoverageDuration(ms: number, t: CoverageMessages): string {
  const total = Math.round(ms / 1000)
  if (total < 60) return format(t.reports.seconds, { n: total })
  return format(t.reports.minutes, { m: Math.floor(total / 60), s: total % 60 })
}

/**
 * Pencere: iş başlayınca yazılır. Başlamadan biten (kuyrukta zaman aşımı) raporda pencere yoktur;
 * "iş başlayınca belirlenir" yazılmaz, tire gösterilir.
 */
function windowText(report: CoverageReport, t: CoverageMessages, locale: Locale): string {
  if (report.windowStart === null || report.windowEnd === null) {
    return report.status === 'queued' || report.status === 'running'
      ? format(t.reports.windowPending, { hours: report.hours })
      : DASH
  }
  return format(t.reports.windowValue, {
    start: formatCoverageTime(report.windowStart, locale),
    end: formatCoverageTime(report.windowEnd, locale),
  })
}

/** "Son 7 gün": günlük işin yazdığı oran, varış sayısı ve güncellenme anı. */
export function CoverageLast7Table({
  stations,
  t,
  locale,
}: {
  stations: readonly CoverageStation[]
  t: CoverageMessages
  locale: Locale
}) {
  if (stations.length === 0) return <p className="muted">{t.last7.empty}</p>
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="coverage-last7">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">{t.last7.station}</th>
            <th scope="col">{t.last7.ratio}</th>
            <th scope="col">{t.last7.arrivals}</th>
            <th scope="col">{t.last7.updated}</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((station) => (
            <tr key={station.icao}>
              <th scope="row">
                {station.iata} <span className="airport-codes">{station.icao}</span>
              </th>
              <td className="num">
                {station.ratio7d === null ? DASH : formatCoveragePercent(station.ratio7d, locale)}
              </td>
              <td className="num">
                {station.arrivals7d === null
                  ? DASH
                  : formatCoverageNumber(station.arrivals7d, locale)}
              </td>
              <td className="num">
                {station.updatedAt === null
                  ? t.last7.never
                  : formatCoverageTime(station.updatedAt, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Raporlar tablosu: istenme, pencere, durum (ve hata), süre, Görüntüle ve İndir. */
export function CoverageReportsTable({
  reports,
  selectedId,
  t,
  locale,
  nowMs,
}: {
  reports: readonly CoverageReport[]
  selectedId: string | null
  t: CoverageMessages
  locale: Locale
  nowMs: number
}) {
  if (reports.length === 0) return <p className="muted">{t.reports.empty}</p>
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="coverage-reports">
      <table className="table">
        <caption>{t.reports.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.reports.columns.id}</th>
            <th scope="col">{t.reports.columns.requested}</th>
            <th scope="col">{t.reports.columns.window}</th>
            <th scope="col">{t.reports.columns.status}</th>
            <th scope="col">{t.reports.columns.duration}</th>
            <th scope="col">{t.reports.columns.actions}</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => {
            const duration = coverageDurationMs(report, nowMs)
            const failure = coverageFailureText(report.error, t.failures)
            const selected = selectedId === String(report.id)
            return (
              <tr key={report.id}>
                <th scope="row" className="num">
                  {report.id}
                </th>
                <td className="num">{formatCoverageTime(report.requestedAt, locale)}</td>
                <td className="num">{windowText(report, t, locale)}</td>
                <td>
                  <StatusBadge status={report.status} t={t} />
                  {report.status === 'failed' && failure ? (
                    <p className="detail-list coverage-failure">{failure}</p>
                  ) : null}
                </td>
                <td className="num">
                  {duration === null ? DASH : formatCoverageDuration(duration, t)}
                </td>
                <td>
                  <span className="actions">
                    <Link
                      href={coverageReportHref(report.id)}
                      prefetch={false}
                      aria-label={format(t.reports.viewLabel, { id: report.id })}
                      aria-current={selected ? 'page' : undefined}
                    >
                      {t.reports.view}
                    </Link>
                    {/* `download` özniteliği yok: dosyayı API'nin Content-Disposition'ı indirir;
                        oturum düştüyse giriş sayfası açılır, hata metni sayfada görünür. */}
                    {report.status === 'done' ? (
                      <a
                        href={coverageDownloadHref(report.id)}
                        aria-label={format(t.reports.downloadLabel, { id: report.id })}
                      >
                        {t.reports.download}
                      </a>
                    ) : null}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RuleCell({ rule, t }: { rule: CoverageRule; t: CoverageMessages }) {
  const flags = [
    rule.borderline ? t.detail.flags.borderline : null,
    rule.lowSample ? t.detail.flags.lowSample : null,
  ].filter((flag): flag is string => flag !== null)
  return (
    <td>
      <span className={`state ${VERDICT_CLASS[rule.verdict]}`}>
        {t.detail.verdicts[rule.verdict]}
      </span>
      {flags.length > 0 ? <span className="coverage-flags"> ({flags.join(', ')})</span> : null}
    </td>
  )
}

/** Seçili raporun özeti, istasyon tablosu, indirme bağlantısı ve Markdown metni. */
export function CoverageReportDetail({
  report,
  t,
  locale,
  nowMs,
}: {
  report: CoverageDetail
  t: CoverageMessages
  locale: Locale
  nowMs: number
}) {
  const summary = report.status === 'done' ? coverageResultSummary(report.result) : null
  const failure = report.status === 'failed' ? coverageFailureText(report.error, t.failures) : null
  const duration = coverageDurationMs(report, nowMs)
  const percent = (value: number) => formatCoveragePercent(value, locale)
  return (
    <section aria-labelledby="coverage-detail" className="coverage-detail">
      <h2 id="coverage-detail">
        {format(t.detail.heading, { id: report.id })} <StatusBadge status={report.status} t={t} />
      </h2>
      <dl className="facts">
        <div>
          <dt>{t.detail.window}</dt>
          <dd className="mono">{windowText(report, t, locale)}</dd>
        </div>
        {summary ? (
          <div>
            <dt>{t.detail.effectiveStart}</dt>
            <dd className="mono">
              {summary.effectiveStart === null
                ? t.detail.none
                : formatCoverageTime(summary.effectiveStart, locale)}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>{t.reports.columns.duration}</dt>
          <dd className="mono">{duration === null ? DASH : formatCoverageDuration(duration, t)}</dd>
        </div>
        <div>
          <dt>{t.detail.definitionVersion}</dt>
          <dd className="mono">{report.definitionVersion ?? DASH}</dd>
        </div>
      </dl>

      {failure ? (
        <p role="alert" className="form-error">
          {failure}
        </p>
      ) : null}
      {report.status === 'queued' || report.status === 'running' ? (
        <p className="muted">{t.detail.pending}</p>
      ) : null}
      {report.status === 'done' && summary === null ? (
        <p className="muted">{t.detail.resultUnreadable}</p>
      ) : null}

      {summary ? (
        <>
          <p>
            {format(t.detail.totals, {
              arrivals: formatCoverageNumber(summary.totals.arrivals, locale),
              ground: formatCoverageNumber(summary.totals.groundSeen, locale),
              open: formatCoverageNumber(summary.totals.openRecordArrivals, locale),
            })}
          </p>
          {summary.dataGapWarning ? (
            <p className="coverage-warning">{t.detail.dataGapWarning}</p>
          ) : null}
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label={t.detail.stations.caption}
          >
            <table className="table">
              <caption>{t.detail.stations.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.detail.stations.station}</th>
                  <th scope="col">{t.detail.stations.arrivals}</th>
                  <th scope="col">{t.detail.stations.groundShare}</th>
                  <th scope="col">{t.detail.stations.interval}</th>
                  <th scope="col">{t.detail.stations.medianAgl}</th>
                  <th scope="col">{t.detail.stations.medianThreshold}</th>
                  <th scope="col">{t.detail.stations.rule1}</th>
                  <th scope="col">{t.detail.stations.rule2}</th>
                </tr>
              </thead>
              <tbody>
                {summary.stations.map((station) => (
                  <tr key={station.icao}>
                    <th scope="row">
                      {station.iata} <span className="airport-codes">{station.icao}</span>
                    </th>
                    <td className="num">{formatCoverageNumber(station.arrivals, locale)}</td>
                    <td className="num">
                      {station.groundShare === null
                        ? DASH
                        : format(t.detail.stations.groundShareValue, {
                            share: percent(station.groundShare),
                            ground: formatCoverageNumber(station.groundSeen, locale),
                            arrivals: formatCoverageNumber(station.arrivals, locale),
                          })}
                    </td>
                    <td className="num">
                      {station.groundShareWilson === null
                        ? DASH
                        : format(t.detail.stations.intervalValue, {
                            low: percent(station.groundShareWilson.low),
                            high: percent(station.groundShareWilson.high),
                          })}
                    </td>
                    <td className="num">
                      {station.all.medianAglFt === null
                        ? DASH
                        : format(t.detail.feet, {
                            n: formatCoverageNumber(Math.round(station.all.medianAglFt), locale),
                          })}
                    </td>
                    <td className="num">
                      {station.all.medianThresholdKm === null
                        ? DASH
                        : format(t.detail.kilometres, {
                            n: formatCoverageNumber(station.all.medianThresholdKm, locale, 1),
                          })}
                    </td>
                    <RuleCell rule={station.rule1} t={t} />
                    <RuleCell rule={station.rule2} t={t} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">{t.detail.rules}</p>
        </>
      ) : null}

      {report.status === 'done' ? (
        <p>
          <a className="button button-secondary" href={coverageDownloadHref(report.id)}>
            {t.reports.download}
          </a>
        </p>
      ) : null}
      {report.markdown ? (
        <details className="weather-details">
          <summary>{t.detail.markdown}</summary>
          {/* Kaydırılabilir kutu klavyeyle odaklanır (WCAG 2.1.1). */}
          <pre className="coverage-markdown" tabIndex={0}>
            {report.markdown}
          </pre>
        </details>
      ) : null}
    </section>
  )
}
