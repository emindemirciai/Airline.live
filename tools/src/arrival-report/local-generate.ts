import { renderArrivalCoverageMarkdown } from '@havayolu/worker/jobs/arrival-coverage/render'
import {
  arrivalCoverageFailure,
  ArrivalCoverageError,
  arrivalCoverageMaxHours,
  computeArrivalCoverage,
  retentionExceededError,
  type ArrivalCoverageLogger,
} from '@havayolu/worker/jobs/arrival-coverage/run'
import { CoverageReportFailure, type CoverageReportDeps } from './report'

/**
 * Yerel raporun hesabı: worker'ın rapor işiyle aynı kod (`computeArrivalCoverage`,
 * `requireBaroRate: true`) ve aynı Markdown (`renderArrivalCoverageMarkdown`, kaynak "yerel").
 * Saklama süresi denetimi de işinkiyle aynıdır (`hours ≤ (TRACK_FINE_RETENTION_DAYS − 1) × 24`).
 * Worker'ın bilinen başarısızlıkları ve tükenen SQL yeniden denemeleri `CoverageReportFailure`
 * olur (CLI çıkış 1); ileti işin rapor satırına yazdığı Türkçe metindir.
 */

/** Worker'ın varsayılanı (`TRACK_FINE_RETENTION_DAYS`, .env.example). */
export const DEFAULT_FINE_RETENTION_DAYS = 30
const SQL_RETRY_CODES = new Set(['57014', '55P03'])

/** `TRACK_FINE_RETENTION_DAYS` (pozitif tam sayı); yoksa ya da geçersizse 30. */
export function fineRetentionDays(source: Record<string, string | undefined>): number {
  const value = Number(source.TRACK_FINE_RETENTION_DAYS?.trim())
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_FINE_RETENTION_DAYS
}

/** Worker hatası → `CoverageReportFailure`; başka hata olduğu gibi kalır. */
export function asCoverageReportFailure(error: unknown): unknown {
  const code = (error as { code?: unknown } | null)?.code
  if (
    error instanceof ArrivalCoverageError ||
    (typeof code === 'string' && SQL_RETRY_CODES.has(code))
  ) {
    const failure = arrivalCoverageFailure(error)
    return new CoverageReportFailure(failure.message, failure.code)
  }
  return error
}

export interface LocalGeneratorOptions {
  appVersion: string
  retentionDays: number
  /** Hesap özeti satırı (istasyon, aday kayıt, örnek, süre). */
  log?: (line: string) => void
  /** Okuma yeniden denemesi gibi uyarılar. */
  warn?: (line: string) => void
}

export function localCoverageGenerator(
  options: LocalGeneratorOptions,
): CoverageReportDeps['generate'] {
  const logger: ArrivalCoverageLogger = {
    info: () => undefined,
    warn: (fields, message) => options.warn?.(`  ${message} ${JSON.stringify(fields)}`),
  }
  return async (sql, { jobStartMs, hours }) => {
    try {
      if (hours > arrivalCoverageMaxHours(options.retentionDays)) {
        throw retentionExceededError(hours, options.retentionDays)
      }
      const { result, stats } = await computeArrivalCoverage(
        { sql, log: logger },
        { jobStart: new Date(jobStartMs), hours, requireBaroRate: true },
      )
      options.log?.(
        `  ${stats.stations} istasyon, ${stats.candidates} aday uçuş kaydı, ${stats.samples} iz örneği, ${(stats.durationMs / 1000).toFixed(1)} sn`,
      )
      const markdown = renderArrivalCoverageMarkdown(result, {
        source: { kind: 'local' },
        appVersion: options.appVersion,
      })
      return { result, markdown }
    } catch (error) {
      throw asCoverageReportFailure(error)
    }
  }
}
