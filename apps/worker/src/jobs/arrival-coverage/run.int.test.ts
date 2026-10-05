import { fileURLToPath } from 'node:url'
import {
  addProviderHourly,
  createDb,
  createFlight,
  createRedis,
  endFlights,
  ensureTrackPartitions,
  getArrivalCoverageReport,
  insertQueuedArrivalCoverageReport,
  insertTrackPoints,
  readStationArrivalCoverage7d,
  recordProviderStatusChange,
  runMigrations,
  seedStations,
  type Database,
  type TrackPointRow,
} from '@havayolu/db'
import {
  ARRIVAL_COVERAGE_DEFINITION_VERSION,
  type ArrivalCoverageResult,
  type ArrivalCoverageSample,
  type ArrivalCoverageStation,
} from '@havayolu/shared'
import { Queue } from 'bullmq'
import { pino } from 'pino'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseEnv } from '../../env'
import {
  ARRIVAL_COVERAGE_JOB_NAMES,
  ARRIVAL_COVERAGE_QUEUE,
  SCHEDULE_REVISION,
  startJobs,
} from '../index'
import { findFixturesDir, fixtureFetcher, runReferenceImport } from '../reference'
import { runArrivalCoverageRatio7d, runNextArrivalCoverageReport } from './run'
import { airborneAt, approach, leg, pointAtKm, rollout } from './test/synthetic'

/**
 * Kapsama raporu uçtan uca (gerçek PostgreSQL + Redis): referans fixture'ı (LTAI pistleri),
 * tohum istasyonları, LTAI'ye sentetik ince iz, sağlayıcı sayaçları ve METAR. Testler LTAI
 * kullanır: replay senaryolarında LTAI yaklaşması yoktur ve geoid yedek tablodan gelir
 * (D-098). Saat sabittir.
 */

const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const redisUrl = process.env.TEST_REDIS_QUEUE_URL ?? 'redis://:queue_dev_only@localhost:46379/0'
const testDbName = 'app_test_db_worker_coverage'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(
  new URL('../../../../../packages/db/drizzle', import.meta.url),
)
const log = pino({ level: 'silent' })

const MIN = 60_000
const HOUR = 60 * MIN
const NOW = new Date('2026-10-05T12:00:00Z')
const at = (iso: string) => Date.parse(iso)

/** Sentetik iz üretimi için LTAI (gerçek ARP ve alan yüksekliği; geoid yedek tablodan). */
const LTAI: ArrivalCoverageStation = {
  icao: 'LTAI',
  iata: 'AYT',
  arp: { lat: 36.898701, lon: 30.800501 },
  elevationFt: 177,
  geoidM: 27.36,
  geoidSource: 'fallback',
  thresholds: [],
  nearbyAirfields: [],
}

const HEXES = ['e2e0a1', 'e2e0a2', 'e2e0a3', 'e2e0a4', 'e2e0a5', 'e2e0a6', 'e2e0a7']

let admin: Database
let database: Database

function rows(flightId: number, samples: readonly ArrivalCoverageSample[]): TrackPointRow[] {
  return samples.map((s) => ({
    flightId,
    ts: new Date(s.ts),
    lat: s.lat,
    lon: s.lon,
    altBaroFt: s.altBaroFt,
    altGeomFt: s.altGeomFt,
    gsKt: s.onGround ? 40 : 140,
    trackDeg: 180,
    verticalRateFpm: s.verticalRateFpm,
    onGround: s.onGround,
    source: s.source,
    seenPosS: s.seenPosS,
    baroRateFpm: s.baroRateFpm,
  }))
}

/** Kaydı ve ince izini yazar; `open` değilse kayıt kapatılır. */
async function flight(
  hex: string,
  samples: readonly ArrivalCoverageSample[],
  options: { lastSeenAt?: number; open?: boolean } = {},
): Promise<number> {
  const first = Math.min(...samples.map((s) => s.ts))
  const last = options.lastSeenAt ?? Math.max(...samples.map((s) => s.ts))
  const id = await createFlight(database.sql, {
    hex,
    callsign: `E2E${hex.slice(-2).toUpperCase()}`,
    registration: `TC-${hex.slice(-3).toUpperCase()}`,
    typeCode: 'A321',
    firstSeenAt: new Date(first),
    lastSeenAt: new Date(last),
  })
  await insertTrackPoints(database.sql, 'track_points_fine', rows(id, samples))
  if (!options.open) await endFlights(database.sql, [id])
  return id
}

/** LTAI'ye kuzeyden yaklaşma (18 pistleri); `endKm`/`endAglFt`'de biter. */
function ltaiApproach(startIso: string, endKm: number, endAglFt: number, withGeom = true) {
  return approach({
    station: LTAI,
    bearingDeg: 0,
    startKm: 13,
    endKm,
    startAglFt: 2600,
    endAglFt,
    startTs: at(startIso),
    count: 24,
    withGeom,
  })
}

async function seed() {
  // A1: iner (yerde örneği var).
  const a1 = ltaiApproach('2026-10-05T08:00:00Z', 2.5, 120)
  await flight(HEXES[0] as string, [
    ...a1,
    ...rollout(LTAI, {
      startTs: at('2026-10-05T08:02:00Z'),
      count: 6,
      bearingDeg: 0,
      fromKm: 1.8,
      toKm: 0.5,
    }),
  ])
  // A2, A3: alçakta kaybolur (lost_low).
  await flight(HEXES[1] as string, ltaiApproach('2026-10-05T09:00:00Z', 4, 600))
  await flight(HEXES[2] as string, ltaiApproach('2026-10-05T10:00:00Z', 3, 300))
  // D1: kalkış (aday değil).
  const runway = pointAtKm(LTAI.arp, 0, 1)
  await flight(HEXES[3] as string, [
    ...rollout(LTAI, {
      startTs: at('2026-10-05T08:30:00Z'),
      count: 4,
      bearingDeg: 180,
      fromKm: 1.5,
      toKm: 0.5,
    }),
    ...leg({
      from: runway,
      to: pointAtKm(LTAI.arp, 0, 25),
      startTs: at('2026-10-05T08:31:00Z'),
      count: 12,
      altBaroFt: 2500,
      baroRateFpm: 2000,
    }),
  ])
  // O1: pencerede ama kaydı açık (son görülme iş başlangıcından 10 dk önce).
  await flight(HEXES[4] as string, ltaiApproach('2026-10-05T11:00:00Z', 3, 300), {
    lastSeenAt: NOW.getTime() - 10 * MIN,
    open: true,
  })
  // P1: baro_rate yok, yalnızca geometrik hız; yerde örneğiyle (duyarlılık satırı).
  const p1 = approach({
    station: LTAI,
    bearingDeg: 0,
    startKm: 12,
    endKm: 2.5,
    startAglFt: 2400,
    endAglFt: 150,
    startTs: at('2026-10-05T10:30:00Z'),
    count: 20,
    baroRateFpm: null,
  }).map((s) => ({ ...s, verticalRateFpm: -700 }))
  await flight(HEXES[5] as string, [
    ...p1,
    ...rollout(LTAI, {
      startTs: at('2026-10-05T10:32:00Z'),
      count: 3,
      bearingDeg: 0,
      fromKm: 1.5,
      toKm: 1,
    }),
  ])
  // B1: 6 saatlik pencereden önce (04:00Z); 7 günlük oranda sayılır, alçakta kaybolur.
  await flight(HEXES[6] as string, [
    airborneAt(LTAI, { ts: at('2026-10-05T04:00:00Z'), bearingDeg: 0, km: 9, aglFt: 2000 }),
    airborneAt(LTAI, { ts: at('2026-10-05T04:01:00Z'), bearingDeg: 0, km: 5, aglFt: 900 }),
  ])

  // Sağlayıcı: 05:00–08:00 satırları var, 09:00–11:00 yok; 09:05–09:30 degraded.
  for (const hour of ['05', '06', '07', '08']) {
    await addProviderHourly(database.sql, 'adsbLol', new Date(`2026-10-05T${hour}:00:00Z`), {
      requests: 360,
      successes: 355,
      rateLimited: 3,
      serverErrors: hour === '07' ? 2 : 0,
      networkErrors: 0,
      otherErrors: 0,
      freshnessP95S: 3,
    })
  }
  const change = (iso: string, from: 'ok' | 'degraded' | null, to: 'ok' | 'degraded') =>
    recordProviderStatusChange(database.sql, {
      provider: 'adsbLol',
      at: new Date(iso),
      from,
      to,
      reason: null,
    })
  await change('2026-10-05T04:00:00Z', null, 'ok')
  await change('2026-10-05T09:05:00Z', 'ok', 'degraded')
  await change('2026-10-05T09:30:00Z', 'degraded', 'ok')

  // METAR QNH (A1'e 10 dk önce).
  await database.sql`
    insert into weather_metar (station_icao, report_type, observed_at, raw_text, qnh_hpa, fetched_at)
    values ('LTAI', 'METAR', '2026-10-05T07:50:00Z', 'METAR LTAI 050750Z 00000KT CAVOK 18/10 Q1020',
      1020, '2026-10-05T07:55:00Z')`
}

beforeAll(async () => {
  admin = createDb(adminUrl, { max: 1 })
  await admin.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.sql.unsafe(`create database ${testDbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder })
  database = createDb(testUrl, { max: 3 })
  await seedStations(database.db)
  const dir = findFixturesDir()
  if (!dir) throw new Error('tools/fixtures bulunamadı')
  await runReferenceImport({
    db: database.db,
    fetcher: fixtureFetcher(dir),
    origin: 'fixture',
    log,
    now: () => NOW,
  })
  await ensureTrackPartitions(database.sql, NOW)
  await seed()
})

afterAll(async () => {
  await database?.sql.end({ timeout: 5 })
  await admin.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.sql.end({ timeout: 5 })
})

async function waitFor(check: () => Promise<boolean>, timeoutMs = 45_000) {
  const started = Date.now()
  while (!(await check())) {
    if (Date.now() - started > timeoutMs) throw new Error('timed out')
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

const deps = {
  now: () => NOW,
  appVersion: '0.21.0',
  fineRetentionDays: 30,
}

describe('kapsama raporu (gerçek PostgreSQL)', () => {
  it('kuyruktaki 6 saatlik rapor üstlenilir, hesaplanır ve Markdown ile done olur', async () => {
    const queued = await insertQueuedArrivalCoverageReport(database.sql, { hours: 6, now: NOW })
    if (!queued.queued) throw new Error('report not queued')
    const outcome = await runNextArrivalCoverageReport({ sql: database.sql, ...deps })
    expect(outcome).toMatchObject({ kind: 'done', reportId: queued.id, hours: 6, stored: true })

    const row = await getArrivalCoverageReport(database.sql, queued.id, NOW)
    expect(row).toMatchObject({
      status: 'done',
      hours: 6,
      error: null,
      definitionVersion: ARRIVAL_COVERAGE_DEFINITION_VERSION,
    })
    expect(row?.windowStart?.toISOString()).toBe('2026-10-05T05:15:00.000Z')
    expect(row?.windowEnd?.toISOString()).toBe('2026-10-05T11:15:00.000Z')

    const result = row?.result as ArrivalCoverageResult
    expect(result.stations.map((s) => s.icao)).toEqual(['LTFM', 'LTAC', 'LTAI', 'LTBJ', 'LTFJ'])
    const ltai = result.stations.find((s) => s.icao === 'LTAI')
    expect(ltai).toMatchObject({
      arrivals: 3,
      groundSeen: 1,
      openRecordArrivals: 1,
      noGround: { lost_low: 2, left_zone: 0, other_field: 0 },
      aglMethods: { geoid: 3, baro_tolerant: 0, unknown: 0 },
      geoidM: 27.36,
      geoidSource: 'fallback',
      thresholdFallbackOnly: false,
      geomOnly: { arrivals: 1, groundSeen: 1, groundShare: 1 },
      degradedAfterArrival: 1,
      rule1: { verdict: 'applies', lowSample: true },
      rule2: { verdict: 'does_not_apply' },
    })
    expect(ltai?.groundShare).toBeCloseTo(1 / 3, 10)
    expect(ltai?.effectiveWindow.start).toBe('2026-10-05T08:00:00.000Z')
    expect(ltai?.qnh).toMatchObject({ observations: 1, minHpa: 1020, maxHpa: 1020, correctedN: 2 })
    expect(ltai?.thresholds).toBe(6)
    // Diğer istasyonlarda veri yok.
    for (const s of result.stations.filter((x) => x.icao !== 'LTAI')) {
      expect(s).toMatchObject({ arrivals: 0, effectiveWindow: { start: null } })
    }
    // 6 saatlik pencere (05:15–11:15) 7 UTC saatine değer; saatler bütün olarak sayılır.
    expect(result.provider).toMatchObject({
      provider: 'adsbLol',
      hours: 7,
      hourRange: { start: '2026-10-05T05:00:00.000Z', end: '2026-10-05T12:00:00.000Z' },
      hoursWithoutRows: 3,
      requests: 1440,
      rateLimited: 12,
      serverErrors: 2,
    })
    expect(result.totals).toEqual({ arrivals: 3, groundSeen: 1, openRecordArrivals: 1 })

    const markdown = row?.markdown ?? ''
    expect(markdown.startsWith('# Kapsama raporu\n')).toBe(true)
    expect(markdown).toContain(`admin raporu #${queued.id}; uygulama sürümü v0.21.0`)
    expect(markdown).toContain('- **Pencere (UTC):** 2026-10-05 05:15Z – 2026-10-05 11:15Z (6 sa)')
    expect(markdown).toMatch(/\| LTAI \(AYT\) \| 3 \| %33,3 \(1\/3\) \|/)
    expect(markdown).toContain(
      '| Pencereye değen UTC saatleri | 7 (2026-10-05 05:00Z – 2026-10-05 12:00Z) |',
    )
    expect(markdown).toContain('geoid N 27,36 m (araştırma tablosu')
    expect(markdown).toContain('[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)')
    // Kimlik yok: ne hex ne çağrı kodu ne tescil.
    for (const hex of HEXES) {
      expect(markdown.toLowerCase()).not.toContain(hex)
      expect(markdown).not.toContain(`E2E${hex.slice(-2).toUpperCase()}`)
      expect(markdown).not.toContain(`TC-${hex.slice(-3).toUpperCase()}`)
      expect(JSON.stringify(result).toLowerCase()).not.toContain(hex)
    }
  })

  it('saklama süresini aşan ve baro_rate verisi olmayan raporlar Türkçe iletiyle failed olur', async () => {
    const tooLong = await insertQueuedArrivalCoverageReport(database.sql, { hours: 48, now: NOW })
    if (!tooLong.queued) throw new Error('report not queued')
    const failed = await runNextArrivalCoverageReport({
      sql: database.sql,
      ...deps,
      fineRetentionDays: 2,
    })
    expect(failed).toMatchObject({ kind: 'failed', code: 'retention_exceeded', stored: true })
    const row = await getArrivalCoverageReport(database.sql, tooLong.id, NOW)
    expect(row).toMatchObject({ status: 'failed', markdown: null, result: null })
    expect(row?.error).toBe(
      '48 saatlik rapor ince iz saklama süresini aşıyor: TRACK_FINE_RETENTION_DAYS=2 iken en çok ' +
        '24 saat seçilebilir (pencereden önce 24 saat geriye bakılır).',
    )

    // 20 gün sonra: pencerede hiç örnek yok.
    const later = new Date(NOW.getTime() + 20 * 24 * HOUR)
    const empty = await insertQueuedArrivalCoverageReport(database.sql, { hours: 6, now: later })
    if (!empty.queued) throw new Error('report not queued')
    const noData = await runNextArrivalCoverageReport({
      sql: database.sql,
      ...deps,
      now: () => later,
    })
    expect(noData).toMatchObject({ kind: 'failed', code: 'no_baro_rate', stored: true })
    const emptyRow = await getArrivalCoverageReport(database.sql, empty.id, later)
    expect(emptyRow?.error).toMatch(/^Pencerede baro_rate_fpm'i dolu havadaki ince iz örneği yok/)

    await expect(runNextArrivalCoverageReport({ sql: database.sql, ...deps })).resolves.toEqual({
      kind: 'idle',
    })
  })

  it('günlük 7 günlük oran: LTAI 1/4, varışı olmayan istasyonlarda oran boş', async () => {
    const summary = await runArrivalCoverageRatio7d({ sql: database.sql, now: () => NOW })
    expect(summary).toMatchObject({ stations: 5, updated: 5, arrivals: 4, groundSeen: 1 })
    const coverage = await readStationArrivalCoverage7d(database.sql)
    const ltai = coverage.find((s) => s.icao === 'LTAI')
    expect(ltai).toMatchObject({ arrivals7d: 4, ratio7d: 0.25 })
    expect(ltai?.updatedAt?.toISOString()).toBe(NOW.toISOString())
    for (const s of coverage.filter((x) => x.icao !== 'LTAI')) {
      expect(s).toMatchObject({ arrivals7d: 0, ratio7d: null })
      expect(s.updatedAt?.toISOString()).toBe(NOW.toISOString())
    }
  })
})

describe('jobs rolü: yoklayıcı ve günlük oran kuyruğu (gerçek Redis)', () => {
  it('açılış partition işinden sonra kuyruktaki raporu işler; oran işi zamanlanır ve çalışır', async () => {
    await database.sql`
      update stations set coverage_ground_ratio_7d = null, coverage_arrivals_7d = null,
        coverage_updated_at = null`
    const queued = await insertQueuedArrivalCoverageReport(database.sql, { hours: 6, now: NOW })
    if (!queued.queued) throw new Error('report not queued')

    const prefix = `hy:test:coverage:${process.pid}:${Date.now()}`
    const env = parseEnv({
      APP_ENV: 'test',
      EXTERNAL_PROVIDERS_DISABLED: 'true',
      WORKER_SERVICE_NAME: 'worker-test',
    })
    const jobs = await startJobs({
      env,
      redisUrl,
      database,
      log,
      version: '0.0.0-test',
      prefix,
      now: () => NOW,
      arrivalCoveragePollMs: 500,
    })
    const connection = createRedis(redisUrl, { name: 'coverage-test', maxRetriesPerRequest: null })
    const queue = new Queue(ARRIVAL_COVERAGE_QUEUE, { connection, prefix })
    try {
      const schedulers = await queue.getJobSchedulers()
      expect(schedulers.map((s) => [s.key, s.pattern, s.tz])).toEqual([
        ['arrival-coverage-ratio-7d', '45 0 * * *', 'UTC'],
      ])

      await waitFor(async () => {
        const row = await getArrivalCoverageReport(database.sql, queued.id, NOW)
        return row?.status === 'done' || row?.status === 'failed'
      })
      const row = await getArrivalCoverageReport(database.sql, queued.id, NOW)
      expect(row).toMatchObject({ status: 'done', error: null })
      expect(row?.markdown).toContain(`admin raporu #${queued.id}; uygulama sürümü v0.0.0-test`)

      await queue.add(
        ARRIVAL_COVERAGE_JOB_NAMES.ratio7d,
        { revision: SCHEDULE_REVISION },
        { removeOnComplete: true, removeOnFail: true },
      )
      await waitFor(async () => {
        const coverage = await readStationArrivalCoverage7d(database.sql)
        return coverage.every((s) => s.updatedAt !== null)
      })
      const coverage = await readStationArrivalCoverage7d(database.sql)
      expect(coverage.find((s) => s.icao === 'LTAI')).toMatchObject({
        arrivals7d: 4,
        ratio7d: 0.25,
      })
    } finally {
      await jobs.close()
      await queue.obliterate({ force: true })
      const maintenance = new Queue('maintenance', { connection, prefix })
      await maintenance.obliterate({ force: true })
      await maintenance.close()
      await queue.close()
      await connection.quit()
    }
  })
})
