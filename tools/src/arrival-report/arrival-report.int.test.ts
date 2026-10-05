import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDb, runMigrations, seedStations, type Database } from '@havayolu/db'
import { fixtureFetcher, runReferenceImport } from '@havayolu/worker/jobs/reference'
import { pino } from 'pino'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FIXTURES_DIR, WORKSPACE_ROOT } from '../live/test/adsblol-stub'
import {
  ARRIVAL_FIXTURE_HEXES,
  ARRIVAL_FIXTURE_ICAO,
  cleanArrivalFixture,
  seedArrivalFixture,
} from './fixture'
import { localCoverageGenerator } from './local-generate'
import { runCoverageReport, type CoverageReportDeps } from './report'

// Gerçek PostgreSQL (yerelde `pnpm dev:infra`, CI'da dev compose). Veritabanı app_test_tools_arrival
// her koşuda yeniden kurulur: migration'lar, tohum istasyonları ve OurAirports fixture'ı (ağa
// çıkılmaz). Rapor worker'ın kendi koduyla (computeArrivalCoverage + render) hesaplanır.
const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const DB_NAME = 'app_test_tools_arrival'

function databaseUrl(name: string): string {
  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  return url.toString()
}

const TEST_URL = databaseUrl(DB_NAME)
let admin: Database
let db: Database
const dirs: string[] = []

async function countRows(): Promise<{ flights: number; samples: number }> {
  const hexes = [...ARRIVAL_FIXTURE_HEXES]
  const [flights] = await db.sql<{ n: number }[]>`
    select count(*)::int as n from flights where hex in ${db.sql(hexes)}`
  const [samples] = await db.sql<{ n: number }[]>`
    select count(*)::int as n from track_points_fine
    where flight_id in (select id from flights where hex in ${db.sql(hexes)})`
  return { flights: flights?.n ?? -1, samples: samples?.n ?? -1 }
}

function deps(lines: string[], errors: string[], now: () => number): CoverageReportDeps {
  return {
    now,
    log: (line) => void lines.push(line),
    error: (line) => void errors.push(line),
    openDb: (url) => {
      const own = createDb(url, { max: 2, applicationName: 'havayolu-coverage-report-test' })
      return { sql: own.sql, close: () => own.sql.end({ timeout: 5 }) }
    },
    generate: localCoverageGenerator({
      appVersion: '0.0.0-test',
      retentionDays: 30,
      log: (line) => void lines.push(line),
    }),
  }
}

function outDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'hy-coverage-int-'))
  dirs.push(dir)
  return dir
}

beforeAll(async () => {
  admin = createDb(adminUrl, { max: 1, applicationName: 'havayolu-arrival-report-test' })
  await admin.sql.unsafe(`drop database if exists ${DB_NAME} with (force)`)
  await admin.sql.unsafe(`create database ${DB_NAME}`)
  await runMigrations({
    databaseUrl: TEST_URL,
    migrationsFolder: join(WORKSPACE_ROOT, 'packages', 'db', 'drizzle'),
  })
  db = createDb(TEST_URL, { max: 3, applicationName: 'havayolu-arrival-report-test' })
  await seedStations(db.db)
  const imported = await runReferenceImport({
    db: db.db,
    fetcher: fixtureFetcher(FIXTURES_DIR),
    origin: 'fixture',
    log: pino({ level: 'silent' }),
  })
  expect(imported.ourairports.status).not.toBe('failed')
}, 120_000)

afterAll(async () => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  await db?.sql.end({ timeout: 5 })
  await admin?.sql.unsafe(`drop database if exists ${DB_NAME} with (force)`)
  await admin?.sql.end({ timeout: 5 })
})

describe('coverage:report ve arrival-fixture (gerçek PostgreSQL)', () => {
  it('fixture yokken pencerede baro_rate yok: rapor hesaplanamaz, çıkış 1, dosya yok', async () => {
    const lines: string[] = []
    const errors: string[] = []
    const dir = outDir()
    const run = await runCoverageReport(
      { root: WORKSPACE_ROOT, hours: 24, source: { DATABASE_URL: TEST_URL }, outDir: dir },
      deps(lines, errors, () => Date.now()),
    )
    expect(run.exitCode).toBe(1)
    expect(errors.join('\n')).toMatch(/^✗ Rapor hesaplanamadı: Pencerede baro_rate_fpm/)
    expect(run.outPath).toBeNull()
  })

  it('fixture idempotent: iki kez yazılınca 3 uçuş ve aynı örnek sayısı kalır', async () => {
    const now = Date.now()
    const first = await seedArrivalFixture(db.sql, now)
    expect(first.flights).toBe(3)
    expect(first.station.icao).toBe(ARRIVAL_FIXTURE_ICAO)
    expect(first.station.landing.ident).toBe('18C')
    const second = await seedArrivalFixture(db.sql, now)
    expect(second.removed).toEqual({ flights: 3, samples: first.samples })
    expect(await countRows()).toEqual({ flights: 3, samples: first.samples })
    const statuses = await db.sql<{ status: string; callsign: string | null }[]>`
      select status, callsign from flights where hex in ${db.sql([...ARRIVAL_FIXTURE_HEXES])}`
    expect(statuses.map((r) => [r.status, r.callsign])).toEqual([
      ['ended', null],
      ['ended', null],
      ['ended', null],
    ])
  })

  it('rapor: LTAI 3 varış, %33,3, kural 1 uygulanır; Markdown kimlik taşımaz', async () => {
    const lines: string[] = []
    const errors: string[] = []
    const dir = outDir()
    const run = await runCoverageReport(
      { root: WORKSPACE_ROOT, hours: 24, source: { DATABASE_URL: TEST_URL }, outDir: dir },
      deps(lines, errors, () => Date.now()),
    )
    expect(errors).toEqual([])
    expect(run.exitCode).toBe(0)
    const ltai = run.result?.stations.find((s) => s.icao === ARRIVAL_FIXTURE_ICAO)
    expect(ltai).toMatchObject({
      arrivals: 3,
      groundSeen: 1,
      openRecordArrivals: 0,
      noGround: { lost_low: 2, left_zone: 0, other_field: 0 },
      aglMethods: { geoid: 3, baro_tolerant: 0, unknown: 0 },
      geoidSource: 'fallback',
      rule1: { verdict: 'applies', borderline: true, lowSample: true },
      rule2: { verdict: 'does_not_apply', borderline: false, lowSample: true },
    })
    expect(ltai?.groundShare).toBeCloseTo(1 / 3, 10)
    // Diğer tohum istasyonlarında bu veritabanında varış yoktur.
    expect(run.result?.totals).toEqual({ arrivals: 3, groundSeen: 1, openRecordArrivals: 0 })
    expect(lines.join('\n')).toContain(
      'LTAI (AYT): 3 varış · yerde örneği %33,3 (1/3) · medyan AGL 308 ft · eşiğe medyan 1,5 km · Kural 1: uygulanır (sınırda, az örnek) · Kural 2: uygulanmaz (az örnek)',
    )
    const markdown = readFileSync(run.outPath as string, 'utf8')
    expect(markdown.startsWith('# Kapsama raporu\n')).toBe(true)
    expect(markdown).toContain('yerel veritabanı')
    expect(markdown).toContain('ODbL')
    expect(markdown).not.toContain('\r')
    for (const hex of ARRIVAL_FIXTURE_HEXES) expect(markdown).not.toContain(hex)
    expect(run.outPath).toMatch(/kapsama-\d{8}T\d{4}Z\.md$/)
  })

  it('6 saatlik pencere de fixture’ı sayar', async () => {
    const run = await runCoverageReport(
      { root: WORKSPACE_ROOT, hours: 6, source: { DATABASE_URL: TEST_URL }, outDir: outDir() },
      deps([], [], () => Date.now()),
    )
    expect(run.exitCode).toBe(0)
    expect(run.result?.stations.find((s) => s.icao === 'LTAI')?.arrivals).toBe(3)
  })

  it('--clean yalnızca fixture satırlarını siler', async () => {
    const [other] = await db.sql<{ id: string }[]>`
      insert into flights (hex, first_seen_at, last_seen_at, status)
      values ('e2e0b1', now() - interval '1 hour', now() - interval '50 minutes', 'ended')
      returning id`
    const removed = await cleanArrivalFixture(db.sql)
    expect(removed.flights).toBe(3)
    expect(removed.samples).toBeGreaterThan(100)
    expect(await countRows()).toEqual({ flights: 0, samples: 0 })
    const kept = await db.sql`select 1 from flights where id = ${other?.id ?? '0'}`
    expect(kept).toHaveLength(1)
    expect(await cleanArrivalFixture(db.sql)).toEqual({ flights: 0, samples: 0 })
  })
})
