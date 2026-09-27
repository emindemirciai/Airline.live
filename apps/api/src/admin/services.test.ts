import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeProbes } from '../test/helpers'
import { collectServices, PROBE_TIMEOUT_MS } from './services'

const api = { version: '0.3.0', gitSha: 'abc1234', startedAt: new Date('2026-09-25T11:00:00Z') }
const byId = (report: Awaited<ReturnType<typeof collectServices>>, id: string) =>
  report.services.find((s) => s.id === id)

afterEach(() => {
  vi.useRealTimers()
})

describe('collectServices', () => {
  it('her şey yolundaysa genel durum ok; yapılandırılmamış analiz genel durumu bozmaz', async () => {
    const report = await collectServices({ ...fakeProbes(), api })
    expect(report.overall).toBe('ok')
    expect(byId(report, 'analytics')?.state).toBe('not_configured')
    expect(byId(report, 'api')).toMatchObject({
      state: 'ok',
      version: '0.3.0',
      detail: { uptimeSec: 3600 },
    })
    expect(byId(report, 'redis-queue')?.detail).toEqual({ memoryUsedMb: 10, memoryMaxMb: 128 })
    expect(byId(report, 'worker:worker-rt')?.detail).toMatchObject({
      heartbeatAgeSec: 10,
      roles: 'ingest, engine',
    })
  })

  it("heartbeat'i olmayan beklenen worker down, eski heartbeat degraded olur", async () => {
    const report = await collectServices({
      ...fakeProbes({
        heartbeats: async () => [
          {
            service: 'worker-rt',
            roles: ['ingest'],
            version: '0.3.0',
            gitSha: 'x',
            pid: 1,
            startedAt: '2026-09-25T11:00:00Z',
            at: '2026-09-25T11:59:00Z',
          },
        ],
      }),
      api,
    })
    expect(byId(report, 'worker:worker-rt')?.state).toBe('degraded')
    expect(byId(report, 'worker:worker-bg')?.state).toBe('down')
    expect(report.overall).toBe('down')
  })

  it("Redis belleği maxmemory'nin %80'ini aşınca degraded olur", async () => {
    const report = await collectServices({
      ...fakeProbes({
        redisLive: async () => ({
          latencyMs: 1,
          usedBytes: 170 * 1024 * 1024,
          maxBytes: 192 * 1024 * 1024,
        }),
      }),
      api,
    })
    expect(byId(report, 'redis-live')?.state).toBe('degraded')
    expect(report.overall).toBe('degraded')
  })

  it('hata veren yoklama down olur ve hata metni raporlanır', async () => {
    const report = await collectServices({
      ...fakeProbes({ postgres: () => Promise.reject(new Error('ECONNREFUSED')) }),
      api,
    })
    expect(byId(report, 'postgres')).toMatchObject({
      state: 'down',
      detail: { error: 'ECONNREFUSED' },
    })
  })

  it('yanıt vermeyen yoklama zaman aşımında down olur, rapor takılmaz', async () => {
    vi.useFakeTimers()
    const pending = collectServices({
      ...fakeProbes({ http: () => new Promise(() => undefined) }),
      api,
    })
    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS + 10)
    const report = await pending
    expect(byId(report, 'web')).toMatchObject({
      state: 'down',
      detail: { error: expect.stringMatching(/zaman aşımı/) },
    })
  })

  it('referans verisi: sayılar ve son kontrol yaşı; eski kontrol, boş tablo ya da hata degraded', async () => {
    const ok = await collectServices({ ...fakeProbes(), api })
    expect(byId(ok, 'reference-data')).toMatchObject({
      state: 'ok',
      kind: 'data',
      detail: { airports: 6347, runways: 7977, airlines: 5964, lastCheckAgeH: 7, origin: 'remote' },
    })

    const base = await fakeProbes().referenceData!()
    const at = (iso: string) => new Date(iso)
    const variants = {
      stale: {
        ...base,
        sources: base.sources.map((s) => ({ ...s, checkedAt: at('2026-09-23T12:00:00Z') })),
      },
      empty: { ...base, runways: 0 },
      failing: {
        ...base,
        sources: base.sources.map((s, i) =>
          i === 2
            ? { ...s, lastError: 'vrs-airlines: HTTP 503', lastErrorAt: at('2026-09-25T05:00:00Z') }
            : s,
        ),
      },
      neverImported: { airports: 0, runways: 0, airlines: 0, sources: [] },
    }
    for (const [name, value] of Object.entries(variants)) {
      const report = await collectServices({
        ...fakeProbes({ referenceData: async () => value }),
        api,
      })
      expect(byId(report, 'reference-data')?.state, name).toBe('degraded')
    }
    const failing = await collectServices({
      ...fakeProbes({ referenceData: async () => variants.failing }),
      api,
    })
    expect(byId(failing, 'reference-data')?.detail.error).toBe('vrs-airlines: HTTP 503')
  })

  it("iz partition'ları: 7 gün ileri ok; eksik gün ya da DEFAULT'ta satır degraded; hiç yoksa down", async () => {
    const table = (daysAhead: number | null, defaultRows = 0) => ({
      partitions: 9,
      oldestDay: '2026-09-24',
      newestDay: '2026-10-02',
      daysAhead,
      defaultRows,
    })
    const state = async (a: ReturnType<typeof table>, b: ReturnType<typeof table>) => {
      const report = await collectServices({
        ...fakeProbes({
          trackPartitions: async () => ({ track_points_sampled: a, track_points_fine: b }),
        }),
        api,
      })
      return byId(report, 'track-partitions')
    }
    expect(await state(table(7), table(7))).toMatchObject({
      state: 'ok',
      detail: { daysAhead: 7, oldestDay: '2026-09-24', defaultRows: 0 },
    })
    expect((await state(table(6), table(7)))?.state).toBe('ok')
    expect((await state(table(5), table(7)))?.state).toBe('degraded')
    expect((await state(table(7), table(7, 12)))?.detail.defaultRows).toBe(12)
    expect((await state(table(7), table(7, 12)))?.state).toBe('degraded')
    expect((await state(table(null), table(7)))?.state).toBe('down')
  })

  it('Drizzle hatasında sorgu metni değil PostgreSQL sebebi gösterilir', async () => {
    const cause = new Error('relation "airports" does not exist')
    const report = await collectServices({
      ...fakeProbes({
        referenceData: () =>
          Promise.reject(new Error('Failed query: select count(*) from "airports"', { cause })),
      }),
      api,
    })
    expect(byId(report, 'reference-data')).toMatchObject({
      state: 'down',
      detail: { error: cause.message },
    })
  })

  it('veritabanı yoksa veri satırları yapılandırılmadı görünür', async () => {
    const report = await collectServices({
      ...fakeProbes({ referenceData: null, trackPartitions: null }),
      api,
    })
    expect(byId(report, 'reference-data')?.state).toBe('not_configured')
    expect(byId(report, 'track-partitions')?.state).toBe('not_configured')
  })

  it('analiz uygulaması yapılandırılınca /api/health sonucu raporlanır', async () => {
    const report = await collectServices({
      ...fakeProbes({ analyticsUrl: 'http://analiz.test/api/health' }),
      api,
    })
    expect(byId(report, 'analytics')).toMatchObject({ state: 'ok', detail: { httpStatus: 200 } })
  })
})
