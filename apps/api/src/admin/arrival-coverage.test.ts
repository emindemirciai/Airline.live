import { Writable } from 'node:stream'
import {
  arrivalCoverageTimeoutAt,
  effectiveArrivalCoverageReport,
  type ArrivalCoverageReportDetail,
  type ArrivalCoverageReportStatus,
  type StationArrivalCoverage7d,
} from '@havayolu/db'
import Fastify, { type FastifyInstance } from 'fastify'
import { afterAll, describe, expect, it } from 'vitest'
import { ADMIN_EMAIL, InMemorySessionStore, login, testApp } from '../test/helpers'
import {
  ARRIVAL_COVERAGE_ERRORS,
  ARRIVAL_COVERAGE_REPORTS_PATH,
  arrivalCoverageFileName,
  parseArrivalCoverageHours,
  parseArrivalCoverageReportId,
  registerArrivalCoverageRoutes,
  type ArrivalCoverageStore,
} from './arrival-coverage'

const NOW = new Date('2026-10-06T12:00:00.000Z')
const MIN = 60_000

interface Row {
  id: number
  status: ArrivalCoverageReportStatus
  hours: number
  requestedAt: Date
  startedAt: Date | null
  finishedAt: Date | null
  windowStart: Date | null
  windowEnd: Date | null
  error: string | null
  result: unknown
  markdown: string | null
}

/** Bellekteki rapor tablosu (PostgreSQL deposunun ikamesi); eskime kuralı db paketininkidir. */
class MemoryArrivalCoverage implements ArrivalCoverageStore {
  readonly rows: Row[] = []
  readonly requested: number[] = []
  failWith: Error | null = null
  stationRows: StationArrivalCoverage7d[] = []

  add(row: Partial<Row> & Pick<Row, 'status'>): Row {
    const full: Row = {
      id: this.rows.length + 1,
      hours: 24,
      requestedAt: new Date(NOW.getTime() - 60 * MIN),
      startedAt: null,
      finishedAt: null,
      windowStart: null,
      windowEnd: null,
      error: null,
      result: null,
      markdown: null,
      ...row,
    }
    this.rows.push(full)
    return full
  }

  private detail(row: Row, now: Date): ArrivalCoverageReportDetail {
    const stored = {
      storedStatus: row.status,
      requestedAt: row.requestedAt,
      startedAt: row.startedAt,
      error: row.error,
    }
    const effective = effectiveArrivalCoverageReport(stored, now)
    const expired = effective.status !== row.status
    return {
      ...row,
      status: effective.status,
      storedStatus: row.status,
      finishedAt: row.finishedAt ?? (expired ? arrivalCoverageTimeoutAt(stored) : null),
      error: effective.error,
      definitionVersion: row.status === 'queued' ? null : 1,
    }
  }

  private check() {
    if (this.failWith) throw this.failWith
  }

  async request(hours: Parameters<ArrivalCoverageStore['request']>[0], now: Date) {
    this.check()
    const active = this.rows.find((row) => {
      const status = this.detail(row, now).status
      return status === 'queued' || status === 'running'
    })
    if (active) return { queued: false as const, activeId: active.id }
    this.requested.push(hours)
    return { queued: true as const, id: this.add({ status: 'queued', hours, requestedAt: now }).id }
  }

  async list(now: Date) {
    this.check()
    const reports = [...this.rows].reverse().map((row) => {
      const { result: _result, markdown: _markdown, ...summary } = this.detail(row, now)
      return summary
    })
    const active = reports.find((r) => r.status === 'queued' || r.status === 'running')
    return { reports, activeId: active?.id ?? null }
  }

  async get(id: number, now: Date) {
    this.check()
    const row = this.rows.find((r) => r.id === id)
    return row ? this.detail(row, now) : null
  }

  async stations() {
    this.check()
    return this.stationRows
  }
}

const apps: FastifyInstance[] = []
afterAll(() => Promise.all(apps.map((app) => app.close())))

async function setup(
  options: { store?: ArrivalCoverageStore | null; sessions?: boolean; logs?: string[] } = {},
) {
  const sessions = new InMemorySessionStore()
  const store = options.store === undefined ? new MemoryArrivalCoverage() : options.store
  const logs = options.logs
  const app = Fastify(
    logs
      ? {
          logger: {
            level: 'info',
            stream: new Writable({
              write(chunk: Buffer, _encoding, done) {
                logs.push(chunk.toString('utf8'))
                done()
              },
            }),
          },
        }
      : {},
  )
  apps.push(app)
  registerArrivalCoverageRoutes(app, {
    sessions: options.sessions === false ? null : sessions,
    store,
    now: () => NOW,
  })
  await app.ready()
  const { token } = await sessions.create(ADMIN_EMAIL)
  return { app, store, token, auth: { authorization: `Bearer ${token}` } }
}

const memory = (store: ArrivalCoverageStore | null) => store as MemoryArrivalCoverage

const ROUTES = [
  { method: 'POST', url: ARRIVAL_COVERAGE_REPORTS_PATH, payload: { hours: 24 } },
  { method: 'GET', url: ARRIVAL_COVERAGE_REPORTS_PATH },
  { method: 'GET', url: `${ARRIVAL_COVERAGE_REPORTS_PATH}/1` },
  { method: 'GET', url: `${ARRIVAL_COVERAGE_REPORTS_PATH}/1/markdown` },
] as const

const MARKDOWN = '# Kapsama raporu\n\nCanlı uçuş verisi: ADSB.lol — ODbL 1.0\n'

describe('parseArrivalCoverageHours', () => {
  it('yalnızca 6, 12, 24, 48, 72 ve 168 saat kabul edilir', () => {
    for (const hours of [6, 12, 24, 48, 72, 168]) {
      expect(parseArrivalCoverageHours({ hours })).toBe(hours)
    }
    for (const hours of [0, 1, 7, 23, 25, 169, 24.5, -24, Number.NaN, '24', 'abc', null]) {
      expect(parseArrivalCoverageHours({ hours }), String(hours)).toBeNull()
    }
    expect(parseArrivalCoverageHours(null)).toBeNull()
    expect(parseArrivalCoverageHours({})).toBeNull()
    expect(parseArrivalCoverageHours('24')).toBeNull()
  })
})

describe('parseArrivalCoverageReportId', () => {
  it('1 ile başlayan en çok 18 hane; güvenli tamsayı dışı 0 (bulunamaz)', () => {
    expect(parseArrivalCoverageReportId('1')).toBe(1)
    expect(parseArrivalCoverageReportId('9007199254740991')).toBe(9_007_199_254_740_991)
    expect(parseArrivalCoverageReportId('999999999999999999')).toBe(0)
    for (const value of ['0', '01', '-1', '1.5', '1e3', ' 1', 'abc', '', '1999999999999999999']) {
      expect(parseArrivalCoverageReportId(value), value).toBeNull()
    }
    expect(parseArrivalCoverageReportId(undefined)).toBeNull()
    expect(parseArrivalCoverageReportId(12)).toBeNull()
  })
})

describe('arrivalCoverageFileName', () => {
  it('kapsama-<YYYYMMDD>T<HHmm>Z.md, UTC, iki nokta yok', () => {
    expect(arrivalCoverageFileName(new Date('2026-10-06T11:15:42.123Z'))).toBe(
      'kapsama-20261006T1115Z.md',
    )
    // Türkiye saatiyle gün değişse de ad UTC'dir.
    expect(arrivalCoverageFileName(new Date('2026-01-02T23:05:00Z'))).toBe(
      'kapsama-20260102T2305Z.md',
    )
    expect(arrivalCoverageFileName(new Date('2026-01-02T03:04:00Z'))).not.toContain(':')
  })
})

describe('/v1/admin/arrival-coverage/reports: yetki ve yapılandırma', () => {
  it('oturum yoksa ya da token geçersizse her uç 401; depo dokunulmaz', async () => {
    const { app, store } = await setup()
    for (const route of ROUTES) {
      for (const headers of [
        {},
        { authorization: 'Bearer yanlis' },
        { authorization: 'Basic x' },
      ]) {
        const res = await app.inject({ ...route, headers })
        expect(res.statusCode, `${route.method} ${route.url}`).toBe(401)
        expect(res.json()).toEqual(ARRIVAL_COVERAGE_ERRORS.unauthorized)
        expect(res.headers['cache-control']).toBe('no-store')
      }
    }
    expect(memory(store).rows).toEqual([])
  })

  it('oturum deposu yoksa (giriş kapalı) 401', async () => {
    const { app, auth } = await setup({ sessions: false })
    for (const route of ROUTES) {
      expect((await app.inject({ ...route, headers: auth })).statusCode).toBe(401)
    }
  })

  it('veritabanı yoksa oturumlu istek 503', async () => {
    const { app, auth } = await setup({ store: null })
    for (const route of ROUTES) {
      const res = await app.inject({ ...route, headers: auth })
      expect(res.statusCode).toBe(503)
      expect(res.json()).toMatchObject({ error: 'arrival_coverage_unavailable' })
    }
  })

  it('veritabanı hatası 503; sürücü iletisi yanıta girmez', async () => {
    const store = new MemoryArrivalCoverage()
    store.add({ status: 'done', markdown: MARKDOWN })
    store.failWith = new Error('connect ECONNREFUSED 10.0.1.5:5432 user havayolu')
    const { app, auth } = await setup({ store })
    for (const route of ROUTES) {
      const res = await app.inject({ ...route, headers: auth })
      expect(res.statusCode, `${route.method} ${route.url}`).toBe(503)
      expect(res.json()).toEqual(ARRIVAL_COVERAGE_ERRORS.failed)
      expect(res.body).not.toContain('ECONNREFUSED')
    }
  })
})

describe('POST /v1/admin/arrival-coverage/reports', () => {
  it('geçersiz saat 400 döner ve satır yazılmaz', async () => {
    const { app, auth, store } = await setup()
    const bodies: unknown[] = [
      { hours: 0 },
      { hours: 169 },
      { hours: 'abc' },
      { hours: 7 },
      { hours: 24.5 },
      { hours: null },
      {},
      [24],
    ]
    for (const payload of bodies) {
      const res = await app.inject({
        method: 'POST',
        url: ARRIVAL_COVERAGE_REPORTS_PATH,
        headers: auth,
        payload: payload as object,
      })
      expect(res.statusCode, JSON.stringify(payload)).toBe(400)
      expect(res.json()).toMatchObject({ error: 'bad_hours', allowed: [6, 12, 24, 48, 72, 168] })
    }
    const empty = await app.inject({
      method: 'POST',
      url: ARRIVAL_COVERAGE_REPORTS_PATH,
      headers: auth,
    })
    expect(empty.statusCode).toBe(400)
    expect(memory(store).rows).toEqual([])
  })

  it('202 ile kuyruğa yazar; etkin rapor varken 409 ve etkin kimlik döner', async () => {
    const { app, auth, store } = await setup()
    const first = await app.inject({
      method: 'POST',
      url: ARRIVAL_COVERAGE_REPORTS_PATH,
      headers: auth,
      payload: { hours: 168 },
    })
    expect(first.statusCode).toBe(202)
    expect(first.json()).toEqual({ id: 1, status: 'queued', hours: 168 })
    expect(first.headers['cache-control']).toBe('no-store')

    const second = await app.inject({
      method: 'POST',
      url: ARRIVAL_COVERAGE_REPORTS_PATH,
      headers: auth,
      payload: { hours: 6 },
    })
    expect(second.statusCode).toBe(409)
    expect(second.json()).toEqual({ ...ARRIVAL_COVERAGE_ERRORS.active, activeId: 1 })
    expect(memory(store).requested).toEqual([168])
  })

  it('eskimiş etkin rapor (15 dk kuyrukta) yenisini engellemez', async () => {
    const store = new MemoryArrivalCoverage()
    store.add({ status: 'queued', requestedAt: new Date(NOW.getTime() - 16 * MIN) })
    const { app, auth } = await setup({ store })
    const res = await app.inject({
      method: 'POST',
      url: ARRIVAL_COVERAGE_REPORTS_PATH,
      headers: auth,
      payload: { hours: 24 },
    })
    expect(res.statusCode).toBe(202)
    expect(res.json()).toMatchObject({ id: 2 })
  })

  it('pino olayı admin_arrival_coverage_requested: rapor kimliği ve saat; e-posta ve token yok', async () => {
    const logs: string[] = []
    const { app, auth, token } = await setup({ logs })
    await app.inject({
      method: 'POST',
      url: ARRIVAL_COVERAGE_REPORTS_PATH,
      headers: auth,
      payload: { hours: 48 },
    })
    const events = logs
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((entry) => entry.event === 'admin_arrival_coverage_requested')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ reportId: 1, hours: 48, level: 30 })
    const all = logs.join('\n')
    expect(all).not.toContain(ADMIN_EMAIL)
    expect(all).not.toContain(token)
  })
})

describe('GET /v1/admin/arrival-coverage/reports', () => {
  it('raporlar yeniden eskiye, etkin durumla; etkin kimlik ve etkin istasyonların 7 günü', async () => {
    const store = new MemoryArrivalCoverage()
    store.add({
      status: 'done',
      hours: 24,
      requestedAt: new Date('2026-10-06T10:00:00Z'),
      startedAt: new Date('2026-10-06T10:00:05Z'),
      finishedAt: new Date('2026-10-06T10:01:35Z'),
      windowStart: new Date('2026-10-05T09:15:05Z'),
      windowEnd: new Date('2026-10-06T09:15:05Z'),
      markdown: MARKDOWN,
      result: { stations: [] },
    })
    // 25 dk önce başlamış ve bitmemiş: etkin durumu zaman aşımıdır.
    store.add({
      status: 'running',
      requestedAt: new Date(NOW.getTime() - 26 * MIN),
      startedAt: new Date(NOW.getTime() - 25 * MIN),
    })
    store.add({ status: 'queued', requestedAt: new Date(NOW.getTime() - MIN) })
    store.stationRows = [
      {
        icao: 'LTFM',
        iata: 'IST',
        isActive: true,
        isPrimary: true,
        ratio7d: 0.875,
        arrivals7d: 640,
        updatedAt: new Date('2026-10-06T00:45:12Z'),
      },
      {
        icao: 'LTXX',
        iata: 'ZZZ',
        isActive: false,
        isPrimary: false,
        ratio7d: null,
        arrivals7d: null,
        updatedAt: null,
      },
      {
        icao: 'LTAI',
        iata: 'AYT',
        isActive: true,
        isPrimary: false,
        ratio7d: null,
        arrivals7d: 0,
        updatedAt: new Date('2026-10-06T00:45:12Z'),
      },
    ]
    const { app, auth } = await setup({ store })
    const res = await app.inject({
      method: 'GET',
      url: ARRIVAL_COVERAGE_REPORTS_PATH,
      headers: auth,
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const body = res.json() as {
      checkedAt: string
      reports: Record<string, unknown>[]
      activeId: number | null
      stations: Record<string, unknown>[]
    }
    // Etkin durumun hesaplandığı an (sayfa çalışan raporun süresini buna göre yazar).
    expect(body.checkedAt).toBe(NOW.toISOString())
    expect(body.activeId).toBe(3)
    expect(body.reports.map((r) => [r.id, r.status, r.error])).toEqual([
      [3, 'queued', null],
      [2, 'failed', 'timeout_running'],
      [1, 'done', null],
    ])
    // Zaman aşımına uğrayan satırın bitişi zaman aşımı anıdır (başlangıç + 20 dk).
    expect(body.reports[1]?.finishedAt).toBe(new Date(NOW.getTime() - 5 * MIN).toISOString())
    expect(body.reports[2]).toEqual({
      id: 1,
      status: 'done',
      hours: 24,
      requestedAt: '2026-10-06T10:00:00.000Z',
      startedAt: '2026-10-06T10:00:05.000Z',
      finishedAt: '2026-10-06T10:01:35.000Z',
      windowStart: '2026-10-05T09:15:05.000Z',
      windowEnd: '2026-10-06T09:15:05.000Z',
      error: null,
      definitionVersion: 1,
    })
    // Liste Markdown ve sonuç taşımaz.
    expect(res.body).not.toContain('Kapsama raporu')
    expect(body.stations).toEqual([
      {
        icao: 'LTFM',
        iata: 'IST',
        isPrimary: true,
        ratio7d: 0.875,
        arrivals7d: 640,
        updatedAt: '2026-10-06T00:45:12.000Z',
      },
      {
        icao: 'LTAI',
        iata: 'AYT',
        isPrimary: false,
        ratio7d: null,
        arrivals7d: 0,
        updatedAt: '2026-10-06T00:45:12.000Z',
      },
    ])
  })
})

describe('GET /v1/admin/arrival-coverage/reports/:id ve /markdown', () => {
  async function withReports() {
    const store = new MemoryArrivalCoverage()
    store.add({
      status: 'done',
      requestedAt: new Date('2026-10-06T10:00:00Z'),
      startedAt: new Date('2026-10-06T10:00:05Z'),
      finishedAt: new Date('2026-10-06T10:01:35Z'),
      windowStart: new Date('2026-10-05T09:15:05Z'),
      windowEnd: new Date('2026-10-06T09:15:05Z'),
      markdown: MARKDOWN,
      result: { definitionVersion: 1, stations: [{ icao: 'LTAI', arrivals: 3 }] },
    })
    store.add({ status: 'failed', error: 'no_baro_rate', finishedAt: NOW })
    store.add({ status: 'queued', requestedAt: new Date(NOW.getTime() - MIN) })
    return setup({ store })
  }

  it('ayrıntı sonucu ve Markdown metnini taşır', async () => {
    const { app, auth } = await withReports()
    const res = await app.inject({
      method: 'GET',
      url: `${ARRIVAL_COVERAGE_REPORTS_PATH}/1`,
      headers: auth,
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.json()).toMatchObject({
      id: 1,
      status: 'done',
      windowEnd: '2026-10-06T09:15:05.000Z',
      markdown: MARKDOWN,
      result: { definitionVersion: 1, stations: [{ icao: 'LTAI', arrivals: 3 }] },
      checkedAt: NOW.toISOString(),
    })
    expect(res.json()).not.toHaveProperty('storedStatus')
  })

  it('biçim dışı kimlik 400, bilinmeyen ya da güvenli tamsayı dışı kimlik 404', async () => {
    const { app, auth } = await withReports()
    for (const suffix of ['', '/markdown']) {
      for (const id of ['abc', '0', '01', '-1', '1.5', '1999999999999999999']) {
        const res = await app.inject({
          method: 'GET',
          url: `${ARRIVAL_COVERAGE_REPORTS_PATH}/${encodeURIComponent(id)}${suffix}`,
          headers: auth,
        })
        expect(res.statusCode, `${id}${suffix}`).toBe(400)
        expect(res.json()).toEqual(ARRIVAL_COVERAGE_ERRORS.badId)
      }
      for (const id of ['4', '999999999999999999']) {
        const res = await app.inject({
          method: 'GET',
          url: `${ARRIVAL_COVERAGE_REPORTS_PATH}/${id}${suffix}`,
          headers: auth,
        })
        expect(res.statusCode, `${id}${suffix}`).toBe(404)
        expect(res.json()).toEqual(ARRIVAL_COVERAGE_ERRORS.notFound)
      }
    }
  })

  it('Markdown eki: text/markdown, kapsama-<pencere sonu>Z.md, no-store, nosniff', async () => {
    const { app, auth } = await withReports()
    const res = await app.inject({
      method: 'GET',
      url: `${ARRIVAL_COVERAGE_REPORTS_PATH}/1/markdown`,
      headers: auth,
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('text/markdown; charset=utf-8')
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="kapsama-20261006T0915Z.md"',
    )
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.body).toBe(MARKDOWN)
  })

  it('hazır olmayan raporun Markdown’ı 409 ve etkin durumu döner', async () => {
    const { app, auth } = await withReports()
    for (const [id, status] of [
      ['2', 'failed'],
      ['3', 'queued'],
    ] as const) {
      const res = await app.inject({
        method: 'GET',
        url: `${ARRIVAL_COVERAGE_REPORTS_PATH}/${id}/markdown`,
        headers: auth,
      })
      expect(res.statusCode).toBe(409)
      expect(res.json()).toEqual({ ...ARRIVAL_COVERAGE_ERRORS.notReady, status })
    }
  })
})

describe('uygulamada (buildApp)', () => {
  it('OpenAPI dört uç noktayı admin etiketiyle belgeler', async () => {
    const { app } = await testApp()
    apps.push(app)
    const spec = (await app.inject({ method: 'GET', url: '/openapi.json' })).json() as {
      paths: Record<string, Record<string, { tags?: string[]; parameters?: { name: string }[] }>>
    }
    const list = spec.paths['/v1/admin/arrival-coverage/reports']
    expect(Object.keys(list ?? {}).sort()).toEqual(['get', 'post'])
    expect(list?.post?.tags).toEqual(['admin'])
    expect(list?.get?.tags).toEqual(['admin'])
    for (const path of [
      '/v1/admin/arrival-coverage/reports/{id}',
      '/v1/admin/arrival-coverage/reports/{id}/markdown',
    ]) {
      expect(spec.paths[path]?.get?.tags, path).toEqual(['admin'])
      expect(
        spec.paths[path]?.get?.parameters?.map((p) => p.name),
        path,
      ).toEqual(['id'])
    }
  })

  it('veritabanı yokken 503; POST dakikada 5 istekle sınırlı (6. istek 429)', async () => {
    const { app } = await testApp()
    apps.push(app)
    const token = await login(app)
    const statuses: number[] = []
    for (let i = 0; i < 6; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: ARRIVAL_COVERAGE_REPORTS_PATH,
        headers: { authorization: `Bearer ${token}` },
        payload: { hours: 24 },
      })
      statuses.push(res.statusCode)
    }
    expect(statuses).toEqual([503, 503, 503, 503, 503, 429])
  })
})
