import { parseArgs } from 'node:util'
import { ARRIVAL_COVERAGE_HOURS, type ArrivalCoverageHours } from '@havayolu/shared'

/** `pnpm coverage:report` ve `arrival-fixture` argümanları (canlı araçların argüman kalıbı). */

export class ArrivalReportArgsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArrivalReportArgsError'
  }
}

/** Admin sayfasının ve API'nin kabul ettiği süreler (`ARRIVAL_COVERAGE_HOURS`); varsayılan 24. */
export const COVERAGE_REPORT_DEFAULT_HOURS: ArrivalCoverageHours = 24

export type CoverageReportArgs = { kind: 'help' } | { kind: 'run'; hours: ArrivalCoverageHours }

export type ArrivalFixtureArgs = { kind: 'help' } | { kind: 'seed' } | { kind: 'clean' }

const HOURS_TEXT = ARRIVAL_COVERAGE_HOURS.join(', ')

export const COVERAGE_REPORT_USAGE = [
  'Kullanım: pnpm coverage:report [--hours <saat>]',
  `  --hours <saat>  pencerenin uzunluğu: ${HOURS_TEXT} (varsayılan 24)`,
  '  -h, --help      bu yardım',
  'Kapsama raporunu (D-098) yerel veritabanında hesaplar: admin işiyle aynı tanımlar ve aynı kod.',
  'Pencere [şimdi − 45 dk − saat, şimdi − 45 dk); yalnızca kapanmış uçuş kayıtları sayılır.',
  'Çıktı tools/recordings/tmp/kapsama-<YYYYMMDD>T<HHmm>Z.md (pencere sonu, UTC; var olan dosya ezilmez).',
  'DATABASE_URL yalnızca localhost/127.0.0.1/::1 olabilir; ağa çıkmaz, veritabanına yazmaz.',
  'Üretim raporu yalnızca admin panelinden alınır (/admin/kapsama).',
  'Örnek veri: pnpm --filter @havayolu/tools arrival-fixture (LTAI, 3 varış, 1 yerde örneği).',
  'Çıkış: 0 rapor yazıldı · 1 rapor hesaplanamadı (ör. penceredeki örneklerde baro_rate yok) ·',
  '       2 ret, argüman, veritabanı ya da dosya hatası · 4 iç hata',
].join('\n')

export const ARRIVAL_FIXTURE_USAGE = [
  'Kullanım: pnpm --filter @havayolu/tools arrival-fixture [--clean]',
  '  --clean     yalnızca fixture uçuşlarını siler (e2e sonrası temizlik)',
  '  -h, --help  bu yardım',
  'Yerel veritabanına LTAI (Antalya) için 3 kapanmış sentetik varış yazar (3 sa, 2 sa 40 dk ve',
  '2 sa 20 dk önce başlayan); biri pistte yerde örneğiyle iner, ikisi alçakta kaybolur',
  '(beklenen: yerde örneği %33,3 → kural 1 uygulanır, kural 2 uygulanmaz).',
  "Hex e2e0a1, e2e0a2, e2e0a3; önce bu hex'lerin uçuşları ve iz örnekleri silinir (idempotent).",
  'DATABASE_URL yalnızca localhost/127.0.0.1/::1 olabilir. Çıkış: 0 tamam · 2 ret ya da hata',
].join('\n')

/** `pnpm <script> -- --x` biçiminde gelen ayraç atlanır. */
function stripSeparator(argv: readonly string[]): string[] {
  return argv[0] === '--' ? argv.slice(1) : [...argv]
}

function strict<T>(parse: () => T): T {
  try {
    return parse()
  } catch (error) {
    throw new ArrivalReportArgsError(
      `geçersiz argüman: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/** `--hours` yalnızca `ARRIVAL_COVERAGE_HOURS` listesinden bir tam sayı olabilir. */
export function parseReportHours(value: string | undefined): ArrivalCoverageHours {
  if (value === undefined) return COVERAGE_REPORT_DEFAULT_HOURS
  const text = value.trim()
  const hours = /^\d{1,3}$/.test(text) ? Number(text) : Number.NaN
  const allowed = ARRIVAL_COVERAGE_HOURS.find((h) => h === hours)
  if (allowed === undefined)
    throw new ArrivalReportArgsError(`--hours şunlardan biri olmalı: ${HOURS_TEXT}`)
  return allowed
}

export function parseCoverageReportArgs(argv: readonly string[]): CoverageReportArgs {
  const { values } = strict(() =>
    parseArgs({
      args: stripSeparator(argv),
      options: {
        hours: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: true,
      allowPositionals: false,
    }),
  )
  if (values.help) return { kind: 'help' }
  return { kind: 'run', hours: parseReportHours(values.hours) }
}

export function parseArrivalFixtureArgs(argv: readonly string[]): ArrivalFixtureArgs {
  const { values } = strict(() =>
    parseArgs({
      args: stripSeparator(argv),
      options: {
        clean: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: true,
      allowPositionals: false,
    }),
  )
  if (values.help) return { kind: 'help' }
  return values.clean ? { kind: 'clean' } : { kind: 'seed' }
}
