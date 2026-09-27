import { fileURLToPath } from 'node:url'
import {
  createDb,
  createRedis,
  listTrackPartitions,
  referenceStatus,
  runMigrations,
  type Database,
} from '@havayolu/db'
import { Queue } from 'bullmq'
import { pino } from 'pino'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseEnv } from '../env'
import { JOB_NAMES, MAINTENANCE_QUEUE, startJobs } from './index'
import {
  findFixturesDir,
  fixtureFetcher,
  runReferenceImport,
  type ReferenceFetcher,
} from './reference'

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
    try {
      const schedulers = await queue.getJobSchedulers()
      expect(schedulers.map((s) => [s.key, s.pattern, s.tz]).sort()).toEqual([
        ['reference-import', '40 4 * * *', 'UTC'],
        ['track-partitions', '15 0 * * *', 'UTC'],
      ])

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
      await queue.close()
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
