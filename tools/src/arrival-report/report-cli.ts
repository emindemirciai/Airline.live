import { createDb } from '@havayolu/db'
import { devEnvSource, findWorkspaceRoot, workspaceVersion } from '../live/env'
import { ArrivalReportArgsError, COVERAGE_REPORT_USAGE, parseCoverageReportArgs } from './args'
import { fineRetentionDays, localCoverageGenerator } from './local-generate'
import { runCoverageReport, type CoverageReportExitCode } from './report'

/**
 * `pnpm coverage:report [--hours 24]` (Parça 1 M7b.2, D-098). İnce giriş: argümanlar, ortam,
 * gerçek saat ve worker'ın rapor kodu (`localCoverageGenerator`); iş `runCoverageReport`'tadır.
 * Yalnızca yerel veritabanı; ağa çıkmaz, veritabanına yazmaz.
 */

async function main(): Promise<CoverageReportExitCode> {
  let args: ReturnType<typeof parseCoverageReportArgs>
  try {
    args = parseCoverageReportArgs(process.argv.slice(2))
  } catch (error) {
    if (!(error instanceof ArrivalReportArgsError)) throw error
    console.error(`✗ ${error.message}`)
    console.error(COVERAGE_REPORT_USAGE)
    return 2
  }
  if (args.kind === 'help') {
    console.log(COVERAGE_REPORT_USAGE)
    return 0
  }
  const root = findWorkspaceRoot(process.cwd())
  if (root === null) {
    console.error('✗ Repo kökü bulunamadı (pnpm-workspace.yaml); komutu repo içinde çalıştır')
    return 2
  }
  const source = devEnvSource(root)
  const run = await runCoverageReport(
    { root, hours: args.hours, source },
    {
      now: () => Date.now(),
      log: (line) => console.log(line),
      error: (line) => console.error(line),
      openDb: (databaseUrl) => {
        const db = createDb(databaseUrl, { max: 2, applicationName: 'havayolu-coverage-report' })
        return { sql: db.sql, close: () => db.sql.end({ timeout: 5 }) }
      },
      generate: localCoverageGenerator({
        appVersion: workspaceVersion(root),
        retentionDays: fineRetentionDays(source),
        log: (line) => console.log(line),
        warn: (line) => console.error(line),
      }),
    },
  )
  return run.exitCode
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    console.error(
      `✗ coverage:report beklenmeyen hata: ${error instanceof Error ? error.message : String(error)}`,
    )
    if (process.env.LOG_LEVEL === 'debug' && error instanceof Error && error.stack) {
      console.error(error.stack)
    }
    process.exitCode = 4
  },
)
