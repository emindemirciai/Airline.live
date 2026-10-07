import { fileURLToPath } from 'node:url'
import {
  createDb,
  createRedis,
  listTrackPartitions,
  referenceStatus,
  runMigrations,
  weatherStatus,
  type Database,
} from '@havayolu/db'
import { Queue } from 'bullmq'
import { pino } from 'pino'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseEnv } from '../env'
import { createExclusiveRunner } from './arrival-coverage/poll'
import { ARRIVAL_COVERAGE_QUEUE, JOB_NAMES, MAINTENANCE_QUEUE, startJobs } from './index'
import {
  findFixturesDir,
  fixtureFetcher,
  runReferenceImport,
  type ReferenceFetcher,
} from './reference'
import { databaseWeatherStore, runWeatherMetar, runWeatherTaf } from './weather'
import { fixtureWeatherSource } from './weather-fixture'

const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const redisUrl = process.env.TEST_REDIS_QUEUE_URL ?? 'redis://:queue_dev_only@localhost:46379/0'
const testDbName = 'app_test_db_worker'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../../../../packages/db/drizzle', import.meta.url))
const log = pino({ level: 'silent' })

let admin: Database
let database: Database

beforeAll(async () => {
  admin = createDb(adminUrl, { max: 1 })
  await admin.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.sql.unsafe(`create database ${testDbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder })
  database = createDb(testUrl, { max: 3 })
})

afterAll(async () => {
  await database?.sql.end({ timeout: 5 })
  await admin.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.sql.end({ timeout: 5 })
})

async function waitFor(check: () => Promise<boolean>, timeoutMs = 30_000) {
  const started = Date.now()
  while (!(await check())) {
    if (Date.now() - started > timeoutMs) throw new Error('bekleme süresi doldu')
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

describe('bakım işleri (gerçek PostgreSQL + Redis, BullMQ)', () => {
  it('zamanlayıcıları kaydeder; boş veritabanında ilk içe aktarımı ve partition işini çalıştırır', async () => {
    const prefix = `hy:test:${process.pid}:${Date.now()}`
    const env = parseEnv({
      APP_ENV: 'test',
      EXTERNAL_PROVIDERS_DISABLED: 'true',
      WORKER_SERVICE_NAME: 'worker-test',
    })
    const jobs = await startJobs({ env, redisUrl, database, log, version: '0.0.0-test', prefix })
    const connection = createRedis(redisUrl, { name: 'jobs-test', maxRetriesPerRequest: null })
    const queue = new Queue(MAINTENANCE_QUEUE, { connection, prefix })
    const coverageQueue = new Queue(ARRIVAL_COVERAGE_QUEUE, { connection, prefix })
    try {
      const schedulers = await queue.getJobSchedulers()
      expect(schedulers.map((s) => [s.key, s.pattern, s.tz]).sort()).toEqual([
        ['reference-import', '40 4 * * *', 'UTC'],
        ['track-partitions', '15 0 * * *', 'UTC'],
        ['weather-metar', '1-59/5 * * * *', 'UTC'],
        ['weather-prune', '25 0 * * *', 'UTC'],
        ['weather-taf', '3-59/15 * * * *', 'UTC'],
      ])
      // Kapsama oranı ayrı kuyrukta (rapor istekleri tablodan yoklanır, BullMQ'ya girmez).
      expect((await coverageQueue.getJobSchedulers()).map((s) => [s.key, s.pattern, s.tz])).toEqual(
        [['arrival-coverage-ratio-7d', '45 0 * * *', 'UTC']],
      )

      // Açılış telafisi: tablolar boş olduğu için içe aktarım, partition işi de her açılışta
      // kendiliğinden kuyruğa girer. İşin tamamen bittiği durum beklenir (ara durum değil).
      await waitFor(async () => {
        const status = await referenceStatus(database.db)
        return status.sources.length === 3 && status.sources.every((s) => s.checkedAt !== null)
      })
      const status = await referenceStatus(database.db)
      expect(status.airports).toBeGreaterThan(50)
      expect(status.airlines).toBeGreaterThan(5000)
      expect(status.sources.map((s) => [s.source, s.origin, s.lastError])).toEqual([
        ['ourairports-airports', 'fixture', null],
        ['ourairports-runways', 'fixture', null],
        ['vrs-airlines', 'fixture', null],
      ])
      const partitionCounts = async () => [
        (await listTrackPartitions(database.sql, 'track_points_sampled')).length,
        (await listTrackPartitions(database.sql, 'track_points_fine')).length,
      ]
      await waitFor(async () => (await partitionCounts()).every((n) => n === 9))

      // Hava durumu açılışta, referans içe aktarımından sonra fixture'dan (zamanı kaydırılarak)
      // yazılır: 20 istasyon (14 Türkiye, 6 1. halka), raporu olmayan LTBQ yok; LTFM'nin 3 günlük
      // geçmişi. İstasyon listesi listelenen havalimanlarıdır (Türkiye, 1.–4. halka: 56 + 75 + 89 +
      // 278 + 719 = 1.217; D-080, D-088, D-090, D-102; askerî hava üsleri yok, D-107). İskenderiye
      // OurAirports'taki HEAX koduyla değil HEBA ile, Özbekistan'ın istasyonları OurAirports kimliği
      // (UTxx) değil ICAO'suyla (UZxx) istenir.
      await waitFor(async () => {
        const weather = await weatherStatus(database.sql, new Date())
        return Boolean(weather.metar?.checkedAt) && Boolean(weather.taf?.checkedAt)
      })
      const weather = await weatherStatus(database.sql, new Date())
      expect(weather.metar).toMatchObject({ origin: 'fixture', lastError: null, skippedCount: 0 })
      expect(weather.taf).toMatchObject({ origin: 'fixture', lastError: null })
      const listed = await databaseWeatherStore(database).stations()
      expect(listed).toHaveLength(1217)
      for (const icao of ['LTAG', 'LTAH', 'LTBG', 'LTBI', 'LTBL'])
        expect(listed).not.toContain(icao)
      expect(listed).toEqual(
        expect.arrayContaining(['LTFM', 'LTBQ', 'LGAV', 'LGTS', 'LCLK', 'LCEN', 'LBSF', 'UGTB']),
      )
      expect(listed).toEqual(expect.arrayContaining(['HECA', 'HEBA', 'LLBG', 'OKKK']))
      expect(listed).not.toContain('HEAX')
      expect(listed).toEqual(expect.arrayContaining(['LOWW', 'EDDF', 'OMDB', 'UUEE', 'UZSS']))
      expect(listed).not.toContain('UTSS')
      // 4. halka (D-102); dört karakterli ICAO'su olmayan Kihihi (UG-0002) istasyon değildir.
      expect(listed).toEqual(expect.arrayContaining(['EGLL', 'LFPG', 'VIDP', 'ZMCK', 'ZWWW']))
      expect(listed).not.toContain('UG-0002')
      expect(listed).not.toContain('KJFK')
      expect(weather.metar?.stationCount).toBe(listed.length)
      expect(weather.taf?.stationCount).toBe(listed.length)
      const stations = await database.sql<{ station_icao: string; n: number }[]>`
        select station_icao, count(*)::int as n from weather_metar
        group by station_icao order by station_icao`
      expect(stations).toHaveLength(20)
      expect(stations.some((s) => s.station_icao === 'LTBQ')).toBe(false)
      expect(
        stations.filter((s) => !s.station_icao.startsWith('LT')).map((s) => s.station_icao),
      ).toEqual(['LBSF', 'LCEN', 'LCLK', 'LGAV', 'LGTS', 'UGTB'])
      // 144 METAR + 1 SPECI; düzeltilmiş rapor (COR) asıl raporla aynı satırdır.
      expect(stations.find((s) => s.station_icao === 'LTFM')?.n).toBe(145)
      const [cor] = await database.sql<{ raw_text: string }[]>`
        select raw_text from weather_metar where raw_text like 'METAR COR LTFM %'`
      expect(cor?.raw_text).toMatch(/^METAR COR LTFM \d{6}Z /)
      // Güncel gözlem 10–70 dk eski (fixtureNow içinde bulunulan saatin başına kaydırılır).
      const ageMin = (Date.now() - (weather.newestObservedAt?.getTime() ?? 0)) / 60_000
      expect(ageMin).toBeGreaterThanOrEqual(9)
      expect(ageMin).toBeLessThanOrEqual(71)
      // LTCW'nin gözlemi 8 saat eski; diğer 19 istasyonunki son 3 saatte.
      expect(weather.stationsWithRecentMetar).toBe(19)
      // TAF: 7 Türkiye istasyonundan 6'sı geçerli (LTBJ'ninki süresi dolmuş) ve 1. halkadan 4.
      expect(weather.stationsWithValidTaf).toBe(10)

      // Yeniden başlatma: tanımı değişmeyen zamanlayıcıya dokunulmaz (sıradaki çalışma aynı kalır;
      // upsert zamanı geçmiş işi silerdi).
      const before = await Promise.all(
        Object.values(JOB_NAMES).map(async (name) => (await queue.getJobScheduler(name))?.next),
      )
      const again = await startJobs({ env, redisUrl, database, log, version: '0.0.0-test', prefix })
      await again.close()
      const after = await Promise.all(
        Object.values(JOB_NAMES).map(async (name) => (await queue.getJobScheduler(name))?.next),
      )
      expect(after).toEqual(before)
    } finally {
      await jobs.close()
      await queue.obliterate({ force: true })
      await coverageQueue.obliterate({ force: true })
      await queue.close()
      await coverageQueue.close()
      await connection.quit()
    }
  })

  it('iz partition işi sürmekte olan kapsama okumasını bekler (DDL ile okuma çakışmaz)', async () => {
    const prefix = `hy:test:${process.pid}:${Date.now()}:serial`
    const env = parseEnv({
      APP_ENV: 'test',
      EXTERNAL_PROVIDERS_DISABLED: 'true',
      WORKER_SERVICE_NAME: 'worker-test',
    })
    // Çalışan bir kapsama raporunun yerine: çalıştırıcı, açılış partition işinden önce tutulur.
    const exclusive = createExclusiveRunner()
    let release: () => void = () => undefined
    const held = exclusive(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const jobs = await startJobs({
      env,
      redisUrl,
      database,
      log,
      version: '0.0.0-test',
      prefix,
      coverageExclusive: exclusive,
    })
    const connection = createRedis(redisUrl, {
      name: 'jobs-serial-test',
      maxRetriesPerRequest: null,
    })
    const queue = new Queue(MAINTENANCE_QUEUE, { connection, prefix })
    const coverageQueue = new Queue(ARRIVAL_COVERAGE_QUEUE, { connection, prefix })
    const partitionJobs = async (state: 'active' | 'completed') =>
      (state === 'active' ? await queue.getActive() : await queue.getCompleted()).filter(
        (job) => job.name === JOB_NAMES.trackPartitions,
      ).length
    try {
      // Bakım işçisi açılış partition işini aldı, ama çalıştırıcı boşalana dek DDL çalışmaz.
      await waitFor(async () => (await partitionJobs('active')) === 1)
      await new Promise((resolve) => setTimeout(resolve, 1_500))
      expect(await partitionJobs('active')).toBe(1)
      expect(await partitionJobs('completed')).toBe(0)

      release()
      await held
      await waitFor(async () => (await partitionJobs('completed')) === 1)
      expect(await partitionJobs('active')).toBe(0)
    } finally {
      release()
      await jobs.close()
      await queue.obliterate({ force: true })
      await coverageQueue.obliterate({ force: true })
      await queue.close()
      await coverageQueue.close()
      await connection.quit()
    }
  })
})

describe("referans içe aktarımı (commit'li fixture)", () => {
  const dir = findFixturesDir()
  if (!dir) throw new Error('tools/fixtures bulunamadı')
  const fixtures = fixtureFetcher(dir)
  const run = (fetcher: ReferenceFetcher, now = new Date('2026-09-27T04:40:00Z')) =>
    runReferenceImport({ db: database.db, fetcher, origin: 'fixture', log, now: () => now })

  it('LTFM pistleri eşik, yön ve kaynak bilgisiyle yazılır (M2 kabulü)', async () => {
    const rows = await database.sql<
      {
        le_ident: string
        le_bearing_source: string
        le_heading_mismatch: boolean
        le_threshold_source: string
        he_threshold_source: string
      }[]
    >`select r.le_ident, r.le_bearing_source, r.le_heading_mismatch, r.le_threshold_source,
         r.he_threshold_source
      from runways r join airports a on a.id = r.airport_id
      where a.ident = 'LTFM' order by r.le_ident`
    expect(rows.map((r) => r.le_ident)).toEqual(['09', '16L', '16R', '17L', '17R', '18'])
    expect(rows.every((r) => r.le_bearing_source === 'coordinates')).toBe(true)
    expect(rows.filter((r) => r.le_heading_mismatch).map((r) => r.le_ident)).toEqual([
      '16L',
      '16R',
      '17L',
      '17R',
    ])
    expect(rows.every((r) => r.le_threshold_source !== 'arp_fallback')).toBe(true)
  })

  it('değişmeyen fixture ikinci kez içe aktarılmaz', async () => {
    const result = await run(fixtures)
    expect(result).toEqual({
      ourairports: { status: 'not_modified' },
      airlines: { status: 'not_modified' },
    })
  })

  it('değişen dosya yalnızca değişen satırı yazar; havalimanı değişince pistler de işlenir', async () => {
    const changed: ReferenceFetcher = async (source, validators) => {
      const file = await fixtures(source, null)
      if (file.status !== 'ok') return file
      if (source === 'vrs-airlines') {
        return { ...file, etag: '"degisti"', body: file.body.replace('AJet', 'AJet Hava Yolları') }
      }
      if (source === 'ourairports-airports') return { ...file, etag: '"degisti"' }
      return (await fixtures(source, validators)).status === 'not_modified'
        ? { status: 'not_modified' }
        : file
    }
    const result = await run(changed)
    expect(result.airlines).toMatchObject({
      status: 'imported',
      counts: { airlines: { inserted: 0, updated: 1, deleted: 0 } },
    })
    expect(result.ourairports.status).toBe('imported')
    expect(result.ourairports.counts?.airports).toMatchObject({
      inserted: 0,
      updated: 0,
      deleted: 0,
    })
    expect(result.ourairports.counts?.runways).toMatchObject({
      inserted: 0,
      updated: 0,
      deleted: 0,
    })
  })

  it('kaynak hatası kaydedilir, veri korunur; diğer kaynak yine işlenir', async () => {
    const before = await referenceStatus(database.db)
    const failing: ReferenceFetcher = async (source, validators) => {
      if (source === 'vrs-airlines') throw new Error('HTTP 503')
      return fixtures(source, validators)
    }
    const result = await run(failing, new Date('2026-09-28T04:40:00Z'))
    expect(result.airlines).toEqual({ status: 'failed', error: 'HTTP 503' })
    // Önceki testte ETag değiştiği için OurAirports yeniden işlenir; hatadan etkilenmez.
    expect(result.ourairports.status).toBe('imported')
    const after = await referenceStatus(database.db)
    expect(after.airlines).toBe(before.airlines)
    const vrs = after.sources.find((s) => s.source === 'vrs-airlines')
    expect(vrs).toMatchObject({ lastError: 'HTTP 503' })
    expect(vrs?.lastErrorAt?.toISOString()).toBe('2026-09-28T04:40:00.000Z')
  })
})

describe('hava durumu fixture modu (gerçek PostgreSQL)', () => {
  it('saatler geçip zamanlar yeniden kaydırılsa da kopya birikmez; satırlar fixture ile aynı kalır', async () => {
    const dir = findFixturesDir()
    if (!dir) throw new Error('tools/fixtures bulunamadı')
    const counts = async () => {
      const [row] = await database.sql<{ metars: number; ltfm: number; tafs: number }[]>`
        select (select count(*)::int from weather_metar) as metars,
          (select count(*)::int from weather_metar where station_icao = 'LTFM') as ltfm,
          (select count(*)::int from weather_taf) as tafs`
      return row
    }
    const store = databaseWeatherStore(database)
    for (const hours of [1, 2, 5]) {
      const now = () => new Date(Date.now() + hours * 3_600_000)
      const source = fixtureWeatherSource({ dir: `${dir}/weather`, appEnv: 'test', now })
      await runWeatherMetar({ store, source, origin: 'fixture', log, now })
      await runWeatherTaf({ store, source, origin: 'fixture', log, now })
      // 20 istasyon: LTFM 145 (144 METAR + 1 SPECI; COR aynı satır), diğer 19 istasyon birer rapor;
      // TAF: LTFM 13, diğer 10 istasyon birer.
      expect(await counts()).toEqual({ metars: 164, ltfm: 145, tafs: 23 })
    }
  })
})
