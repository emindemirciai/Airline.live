import { fileURLToPath } from 'node:url'
import {
  claimNextArrivalCoverageReport,
  createDb,
  failArrivalCoverageReport,
  finishArrivalCoverageReport,
  runMigrations,
  seedStations,
  writeStationArrivalCoverage7d,
  type Database,
} from '@havayolu/db'
import { ARRIVAL_COVERAGE_DEFINITION_VERSION, ARRIVAL_COVERAGE_SETTLE_MS } from '@havayolu/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { login, testApp } from '../test/helpers'
import {
  ARRIVAL_COVERAGE_ERRORS,
  ARRIVAL_COVERAGE_REPORTS_PATH,
  arrivalCoverageFileName,
  pgArrivalCoverageStore,
} from './arrival-coverage'

// Gerçek PostgreSQL (yerelde `pnpm dev:infra`, CI'da dev compose); bu teste ait veritabanı.
const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_api_arrival_coverage'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../../../../packages/db/drizzle', import.meta.url))

let admin: Database
let database: Database

const MARKDOWN = '# Kapsama raporu\n\nCanlı uçuş verisi: ADSB.lol — ODbL 1.0\n'

beforeAll(async () => {
  admin = createDb(adminUrl, { max: 1 })
  await admin.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.sql.unsafe(`create database ${testDbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder })
  database = createDb(testUrl, { max: 3 })
  await seedStations(database.db)
  await database.sql`update stations set is_active = false where icao = 'LTBJ'`
})

beforeEach(async () => {
  await database.sql`delete from arrival_coverage_reports`
})

afterAll(async () => {
  await database?.sql.end({ timeout: 5 })
  await admin?.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin?.sql.end({ timeout: 5 })
})

/** Her test kendi uygulamasını kurar: POST hız sınırı (5/dk) süreç içi sayaçtadır. */
async function appWithDatabase() {
  const { app } = await testApp({ deps: { arrivalCoverage: pgArrivalCoverageStore(database.sql) } })
  const token = await login(app)
  const auth = { authorization: `Bearer ${token}` }
  const post = (hours: unknown) =>
    app.inject({
      method: 'POST',
      url: ARRIVAL_COVERAGE_REPORTS_PATH,
      headers: auth,
      payload: { hours },
    })
  const get = (suffix = '') =>
    app.inject({ method: 'GET', url: `${ARRIVAL_COVERAGE_REPORTS_PATH}${suffix}`, headers: auth })
  return { app, post, get }
}

/** Worker'ın yaptığı gibi sıradaki satırı üstlenir. */
async function claim(now = new Date()) {
  const claimed = await claimNextArrivalCoverageReport(database.sql, {
    now,
    settleMs: ARRIVAL_COVERAGE_SETTLE_MS,
    definitionVersion: ARRIVAL_COVERAGE_DEFINITION_VERSION,
  })
  if (!claimed) throw new Error('nothing to claim')
  return claimed
}

describe('kapsama raporu uçları (gerçek PostgreSQL)', () => {
  it('POST satırı kuyruğa yazar; etkin rapor varken 409; worker bitirince ayrıntı ve .md eki', async () => {
    const { app, post, get } = await appWithDatabase()
    try {
      const created = await post(24)
      expect(created.statusCode).toBe(202)
      const { id } = created.json() as { id: number }
      expect(created.json()).toEqual({ id, status: 'queued', hours: 24 })
      const [row] = await database.sql<{ status: string; hours: number }[]>`
        select status, hours from arrival_coverage_reports where id = ${id}`
      expect(row).toEqual({ status: 'queued', hours: 24 })

      const conflict = await post(6)
      expect(conflict.statusCode).toBe(409)
      expect(conflict.json()).toEqual({ ...ARRIVAL_COVERAGE_ERRORS.active, activeId: id })

      const queuedList = await get()
      expect(queuedList.statusCode).toBe(200)
      expect(queuedList.json()).toMatchObject({
        activeId: id,
        reports: [{ id, status: 'queued', hours: 24, windowEnd: null, error: null }],
      })
      const notReady = await get(`/${id}/markdown`)
      expect(notReady.statusCode).toBe(409)
      expect(notReady.json()).toMatchObject({ error: 'report_not_ready', status: 'queued' })

      const claimed = await claim()
      expect(claimed.id).toBe(id)
      expect((await get()).json()).toMatchObject({
        activeId: id,
        reports: [
          { id, status: 'running', definitionVersion: ARRIVAL_COVERAGE_DEFINITION_VERSION },
        ],
      })
      const result = { definitionVersion: ARRIVAL_COVERAGE_DEFINITION_VERSION, stations: [] }
      expect(
        await finishArrivalCoverageReport(database.sql, {
          id,
          now: new Date(),
          result,
          markdown: MARKDOWN,
        }),
      ).toBe(true)

      const doneList = (await get()).json() as {
        activeId: number | null
        reports: { id: number; status: string; windowStart: string; windowEnd: string }[]
      }
      expect(doneList.activeId).toBeNull()
      expect(doneList.reports[0]).toMatchObject({
        id,
        status: 'done',
        windowStart: claimed.windowStart.toISOString(),
        windowEnd: claimed.windowEnd.toISOString(),
      })
      // Liste Markdown ve sonuç taşımaz.
      expect(doneList.reports[0]).not.toHaveProperty('markdown')

      const detail = await get(`/${id}`)
      expect(detail.statusCode).toBe(200)
      expect(detail.json()).toMatchObject({ id, status: 'done', markdown: MARKDOWN, result })

      const download = await get(`/${id}/markdown`)
      expect(download.statusCode).toBe(200)
      expect(download.headers['content-type']).toBe('text/markdown; charset=utf-8')
      expect(download.headers['content-disposition']).toBe(
        `attachment; filename="${arrivalCoverageFileName(claimed.windowEnd)}"`,
      )
      expect(download.headers['cache-control']).toBe('no-store')
      expect(download.headers['x-content-type-options']).toBe('nosniff')
      expect(download.body).toBe(MARKDOWN)

      expect((await get(`/${id + 1000}`)).statusCode).toBe(404)
      expect((await get('/abc/markdown')).statusCode).toBe(400)
    } finally {
      await app.close()
    }
  })

  it('başarısız rapor hatasıyla listelenir, Markdown’ı 409; yeni rapor istenebilir', async () => {
    const { app, post, get } = await appWithDatabase()
    try {
      const { id } = (await post(6)).json() as { id: number }
      await claim()
      await failArrivalCoverageReport(database.sql, { id, now: new Date(), error: 'no_baro_rate' })
      expect((await get()).json()).toMatchObject({
        activeId: null,
        reports: [{ id, status: 'failed', error: 'no_baro_rate' }],
      })
      expect((await get(`/${id}/markdown`)).json()).toMatchObject({ status: 'failed' })
      const next = await post(12)
      expect(next.statusCode).toBe(202)
      expect((next.json() as { id: number }).id).toBeGreaterThan(id)
    } finally {
      await app.close()
    }
  })

  it('15 dk’dan eski kuyruk satırı listede zaman aşımı görünür; POST onu kapatıp yenisini yazar', async () => {
    const [stale] = await database.sql<{ id: string }[]>`
      insert into arrival_coverage_reports (status, hours, requested_at)
      values ('queued', 24, now() - interval '16 minutes')
      returning id`
    const staleId = Number(stale?.id)
    const { app, post, get } = await appWithDatabase()
    try {
      expect((await get()).json()).toMatchObject({
        activeId: null,
        reports: [{ id: staleId, status: 'failed', error: 'timeout_queued' }],
      })
      // Okuma yazmaz: tabloda hâlâ kuyrukta.
      const [before] = await database.sql<{ status: string }[]>`
        select status from arrival_coverage_reports where id = ${staleId}`
      expect(before?.status).toBe('queued')

      const created = await post(72)
      expect(created.statusCode).toBe(202)
      const rows = await database.sql<{ id: string; status: string; error: string | null }[]>`
        select id, status, error from arrival_coverage_reports order by id`
      expect(rows.map((r) => [Number(r.id), r.status, r.error])).toEqual([
        [staleId, 'failed', 'timeout_queued'],
        [(created.json() as { id: number }).id, 'queued', null],
      ])
    } finally {
      await app.close()
    }
  })

  it('istasyonların 7 günlük kapsaması: etkin istasyonlar, önce birincil; iş çalışmadıysa boş', async () => {
    const { app, get } = await appWithDatabase()
    try {
      const before = (await get()).json() as { stations: Record<string, unknown>[] }
      expect(before.stations.map((s) => s.icao)).toEqual(['LTFM', 'LTAC', 'LTAI', 'LTFJ'])
      expect(before.stations[0]).toEqual({
        icao: 'LTFM',
        iata: 'IST',
        isPrimary: true,
        ratio7d: null,
        arrivals7d: null,
        updatedAt: null,
      })

      const at = new Date('2026-10-06T00:45:00.000Z')
      await writeStationArrivalCoverage7d(
        database.sql,
        [
          { icao: 'LTFM', arrivals: 3, groundSeen: 1 },
          { icao: 'LTAI', arrivals: 0, groundSeen: 0 },
        ],
        at,
      )
      const after = (await get()).json() as { stations: Record<string, unknown>[] }
      // `coverage_ground_ratio_7d` real (float4) sütunudur.
      expect(after.stations.find((s) => s.icao === 'LTFM')).toMatchObject({
        ratio7d: expect.closeTo(1 / 3, 6),
        arrivals7d: 3,
        updatedAt: at.toISOString(),
      })
      expect(after.stations.find((s) => s.icao === 'LTAI')).toMatchObject({
        ratio7d: null,
        arrivals7d: 0,
        updatedAt: at.toISOString(),
      })
    } finally {
      await app.close()
    }
  })
})
