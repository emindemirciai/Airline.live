import { createDb, type Database } from '@havayolu/db'
import { devEnvSource, findWorkspaceRoot } from '../live/env'
import { ARRIVAL_FIXTURE_USAGE, ArrivalReportArgsError, parseArrivalFixtureArgs } from './args'
import {
  ARRIVAL_FIXTURE_HEXES,
  ARRIVAL_FIXTURE_ICAO,
  ArrivalFixtureError,
  cleanArrivalFixture,
  seedArrivalFixture,
} from './fixture'
import { checkLocalDbGate, localDbRefusalText } from './gate'

/**
 * `pnpm --filter @havayolu/tools arrival-fixture [--clean]` (D-098): LTAI kapsama fixture'ını
 * yerel veritabanına yazar ya da siler. Ağa çıkmaz; yalnızca yerel `DATABASE_URL` (kapı).
 * e2e (`e2e/tests/admin-coverage.spec.ts`) ve yerel önizleme kullanır.
 */

const DB_TIMEOUT_MS = 5_000

function utc(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 16)}Z`
}

async function main(): Promise<number> {
  let args: ReturnType<typeof parseArrivalFixtureArgs>
  try {
    args = parseArrivalFixtureArgs(process.argv.slice(2))
  } catch (error) {
    if (!(error instanceof ArrivalReportArgsError)) throw error
    console.error(`✗ ${error.message}`)
    console.error(ARRIVAL_FIXTURE_USAGE)
    return 2
  }
  if (args.kind === 'help') {
    console.log(ARRIVAL_FIXTURE_USAGE)
    return 0
  }
  const root = findWorkspaceRoot(process.cwd())
  if (root === null) {
    console.error('✗ Repo kökü bulunamadı (pnpm-workspace.yaml); komutu repo içinde çalıştır')
    return 2
  }
  const gate = checkLocalDbGate(devEnvSource(root))
  if (!gate.ok) {
    for (const refusal of gate.refusals) console.error(`✗ ${localDbRefusalText(refusal)}`)
    return 2
  }
  const db: Database = createDb(gate.databaseUrl, {
    max: 2,
    applicationName: 'havayolu-arrival-fixture',
  })
  try {
    const ping = await Promise.race([
      db.sql`select 1`.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), DB_TIMEOUT_MS).unref()),
    ]).catch(() => false)
    if (!ping) {
      console.error('✗ PostgreSQL yanıt vermedi; pnpm dev:infra çalışıyor mu (Docker Desktop)?')
      return 2
    }
    if (args.kind === 'clean') {
      const removed = await cleanArrivalFixture(db.sql)
      console.log(
        `✓ Fixture silindi: ${removed.flights} uçuş, ${removed.samples} iz örneği (${ARRIVAL_FIXTURE_HEXES.join(', ')})`,
      )
      return 0
    }
    const seeded = await seedArrivalFixture(db.sql, Date.now())
    console.log(
      `✓ ${ARRIVAL_FIXTURE_ICAO} fixture'ı yazıldı: ${seeded.flights} uçuş, ${seeded.samples} iz örneği, ${utc(seeded.from)} – ${utc(seeded.to)} (iniş eşiği ${seeded.station.landing.ident ?? '?'})`,
    )
    if (seeded.removed.flights > 0) {
      console.log(`  Önceki fixture silindi: ${seeded.removed.flights} uçuş`)
    }
    console.log(
      '  Beklenen: 3 varış, yerde örneği %33,3 (1/3), kural 1 uygulanır. Rapor: pnpm coverage:report --hours 24',
    )
    return 0
  } catch (error) {
    if (error instanceof ArrivalFixtureError) {
      console.error(`✗ ${error.message}`)
      return 2
    }
    const code = (error as { code?: unknown }).code
    if (code === '42P01' || code === '42703') {
      console.error('✗ Veritabanı şeması eski; önce pnpm db:migrate çalıştır')
      return 2
    }
    throw error
  } finally {
    await db.sql.end({ timeout: 5 })
  }
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    console.error(
      `✗ arrival-fixture beklenmeyen hata: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 2
  },
)
