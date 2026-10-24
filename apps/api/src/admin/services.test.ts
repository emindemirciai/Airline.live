import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProviderSummary, WeatherSourceState, WeatherStatus } from '@havayolu/db'
import { fakeProbes, fakeProviderSummary } from '../test/helpers'
import { collectServices, PROBE_TIMEOUT_MS, PROVIDER_HEALTH_STALE_MS } from './services'

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

describe('collectServices: canlı veri sağlayıcıları', () => {
  const NOW = new Date('2026-09-25T12:00:00Z').getTime()
  const secondsAgo = (sec: number) => new Date(NOW - sec * 1000)
  const report = (providers: ProviderSummary[] | (() => Promise<ProviderSummary[]>) | null) =>
    collectServices({
      ...fakeProbes({
        providers:
          typeof providers === 'function' || providers === null ? providers : async () => providers,
      }),
      api,
    })
  const providerRows = (r: Awaited<ReturnType<typeof collectServices>>) =>
    r.services.filter((s) => s.kind === 'provider')

  it('sağlıklı adsb.lol satırı: hız, tazelik, oranlar ve devre; yerel alıcı yapılandırılmadı', async () => {
    const r = await collectServices({ ...fakeProbes(), api })
    expect(r.overall).toBe('ok')
    expect(byId(r, 'provider:adsbLol')).toEqual({
      id: 'provider:adsbLol',
      kind: 'provider',
      state: 'ok',
      version: null,
      latencyMs: null,
      detail: {
        rps: 0.1,
        freshnessP95Sec: 14.3,
        errorRatioPct: 0,
        rateLimited1hPct: 0.4,
        rateLimited24hPct: 1.2,
        circuit: 'closed',
        lastSuccessAgeSec: 8,
      },
      checkedAt: '2026-09-25T12:00:00.000Z',
    })
    expect(byId(r, 'provider:localReceiver')).toMatchObject({
      kind: 'provider',
      state: 'not_configured',
      detail: {},
    })
  })

  it('sıra sabittir ve worker satırlarından sonra gelir; bilinmeyen sağlayıcı gösterilmez', async () => {
    const r = await report([
      fakeProviderSummary({ provider: 'someOther' }),
      fakeProviderSummary({ provider: 'localReceiver', rps: null }),
      fakeProviderSummary(),
    ])
    const ids = r.services.map((s) => s.id)
    expect(providerRows(r).map((s) => s.id)).toEqual(['provider:adsbLol', 'provider:localReceiver'])
    expect(ids.indexOf('provider:adsbLol')).toBe(ids.indexOf('worker:worker-rt') + 1)
    expect(ids.indexOf('postgres')).toBe(ids.indexOf('provider:localReceiver') + 1)
    expect(ids).not.toContain('provider:someOther')
    // Hız kovası olmayan yerel alıcıda hız boş kalır.
    expect(byId(r, 'provider:localReceiver')).toMatchObject({ state: 'ok', detail: { rps: null } })
  })

  it('veritabanı yoksa iki sağlayıcı da yapılandırılmadı görünür ve genel durumu bozmaz', async () => {
    const r = await report(null)
    expect(providerRows(r).map((s) => s.state)).toEqual(['not_configured', 'not_configured'])
    expect(r.overall).toBe('ok')
  })

  it('sağlık kaydı yoksa (worker henüz yazmadı ya da sağlayıcı kapalı) yapılandırılmadı görünür', async () => {
    const r = await report([])
    expect(providerRows(r).map((s) => s.state)).toEqual(['not_configured', 'not_configured'])
  })

  it('sorgu hata verirse iki sağlayıcı da down olur ve hata metni raporlanır', async () => {
    const r = await report(() =>
      Promise.reject(new Error('relation "provider_health" does not exist')),
    )
    for (const row of providerRows(r)) {
      expect(row).toMatchObject({
        state: 'down',
        detail: { error: 'relation "provider_health" does not exist' },
      })
    }
    expect(r.overall).toBe('down')
  })

  it('yanıt vermeyen sorgu zaman aşımında down olur', async () => {
    vi.useFakeTimers()
    const pending = report(() => new Promise(() => undefined))
    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS + 10)
    const r = await pending
    expect(byId(r, 'provider:adsbLol')).toMatchObject({
      state: 'down',
      detail: { error: expect.stringMatching(/zaman aşımı/) },
    })
  })

  it("180 sn'den eski kayıt down olur: kaydın yaşı ve son başarılı yanıt gösterilir", async () => {
    const stale = await report([
      fakeProviderSummary({ updatedAt: secondsAgo(240), lastSuccessAt: secondsAgo(250) }),
    ])
    expect(byId(stale, 'provider:adsbLol')).toMatchObject({
      state: 'down',
      detail: { staleSec: 240, lastSuccessAgeSec: 250 },
    })
    expect(byId(stale, 'provider:adsbLol')?.detail).not.toHaveProperty('rps')
    expect(byId(stale, 'provider:adsbLol')?.detail).not.toHaveProperty('error')
    expect(stale.overall).toBe('down')

    // Sınır: tam 180 sn eski kayıt hâlâ geçerlidir.
    const edge = await report([
      fakeProviderSummary({ updatedAt: new Date(NOW - PROVIDER_HEALTH_STALE_MS) }),
    ])
    expect(byId(edge, 'provider:adsbLol')?.state).toBe('ok')
  })

  it('eskimiş kayıt sorunluyken yazılmışsa son hata da gösterilir', async () => {
    const r = await report([
      fakeProviderSummary({
        status: 'down',
        updatedAt: secondsAgo(600),
        lastError: 'network: ECONNRESET',
        lastErrorAt: secondsAgo(610),
      }),
    ])
    expect(byId(r, 'provider:adsbLol')).toMatchObject({
      state: 'down',
      detail: { staleSec: 600, error: 'network: ECONNRESET' },
    })
  })

  it('degraded: 60 sn hata oranı tam yüzde, 429 oranı bir ondalık, son hata gösterilir', async () => {
    const r = await report([
      fakeProviderSummary({
        status: 'degraded',
        rps: 0.05,
        errorRatio60s: 1 / 3,
        lastError: 'rate_limit: HTTP 429',
        lastErrorAt: secondsAgo(12),
        rateLimitedRatio1h: 0.0567,
      }),
    ])
    expect(byId(r, 'provider:adsbLol')).toMatchObject({
      state: 'degraded',
      detail: {
        rps: 0.05,
        errorRatioPct: 33,
        rateLimited1hPct: 5.7,
        error: 'rate_limit: HTTP 429',
      },
    })
    expect(r.overall).toBe('degraded')
  })

  it('limited (günlük bütçe, D-122) yönetim panelinde sorunlu görünür; ayrıntılar kalır', async () => {
    const r = await report([
      fakeProviderSummary({
        status: 'limited',
        rps: 1 / 180,
        lastError: 'rate_limit: HTTP 429',
        lastErrorAt: secondsAgo(4_000),
      }),
    ])
    expect(byId(r, 'provider:adsbLol')).toMatchObject({
      state: 'degraded',
      detail: { rps: 0.006, circuit: 'closed', error: 'rate_limit: HTTP 429' },
    })
    expect(r.overall).toBe('degraded')
  })

  it('durum ok iken eski hata metni gösterilmez', async () => {
    const r = await report([
      fakeProviderSummary({ lastError: 'server: HTTP 502', lastErrorAt: secondsAgo(900) }),
    ])
    expect(byId(r, 'provider:adsbLol')?.detail).not.toHaveProperty('error')
  })

  it('401/403: devre config, hiç başarılı yanıt yok, down', async () => {
    const r = await report([
      fakeProviderSummary({
        status: 'down',
        circuit: 'config',
        lastSuccessAt: null,
        lastError: 'config: HTTP 403',
        lastErrorAt: secondsAgo(5),
        consecutiveFailures: 1,
      }),
    ])
    expect(byId(r, 'provider:adsbLol')).toMatchObject({
      state: 'down',
      detail: { circuit: 'config', lastSuccessAgeSec: null, error: 'config: HTTP 403' },
    })
  })

  it('pencerede istek yoksa oranlar boş; hız üç, tazelik bir ondalığa yuvarlanır', async () => {
    const r = await report([
      fakeProviderSummary({
        rps: 0.1 * 1.1 * 1.1,
        freshnessP95S: null,
        errorRatio60s: null,
        rateLimitedRatio1h: null,
        rateLimitedRatio24h: null,
      }),
    ])
    expect(byId(r, 'provider:adsbLol')?.detail).toMatchObject({
      rps: 0.121,
      freshnessP95Sec: null,
      errorRatioPct: null,
      rateLimited1hPct: null,
      rateLimited24hPct: null,
    })
  })

  it('bilinmeyen durum değeri down sayılır; ileri tarihli kayıt eski sayılmaz', async () => {
    const r = await report([
      fakeProviderSummary({ status: 'paused' as unknown as ProviderSummary['status'] }),
      fakeProviderSummary({ provider: 'localReceiver', updatedAt: new Date(NOW + 5_000) }),
    ])
    expect(byId(r, 'provider:adsbLol')?.state).toBe('down')
    expect(byId(r, 'provider:localReceiver')?.state).toBe('ok')
  })
})

describe('collectServices: hava durumu (D-078)', () => {
  const NOW = new Date('2026-09-25T12:00:00Z').getTime()
  const minutesAgo = (min: number) => new Date(NOW - min * 60_000)
  const source = (overrides: Partial<WeatherSourceState> = {}): WeatherSourceState => ({
    kind: 'metar',
    origin: 'remote',
    disabledReason: null,
    checkedAt: minutesAgo(3),
    stationCount: 61,
    reportCount: 118,
    skippedCount: 0,
    lastError: null,
    lastErrorAt: null,
    blockedUntil: null,
    blockedKind: null,
    updatedAt: minutesAgo(3),
    ...overrides,
  })
  const status = (overrides: Partial<WeatherStatus> = {}): WeatherStatus => ({
    metar: source(),
    taf: source({ kind: 'taf', checkedAt: minutesAgo(9), reportCount: 140 }),
    stationsWithRecentMetar: 52,
    newestObservedAt: minutesAgo(11),
    stationsWithValidTaf: 34,
    ...overrides,
  })
  const row = async (weather: (() => Promise<WeatherStatus>) | null | undefined) => {
    const report = await collectServices({ ...fakeProbes({ weather }), api })
    return { report, row: byId(report, 'weather') }
  }

  it('sağlıklı: tazelik ve sayılar; satır referans verisinden sonra gelir', async () => {
    const { report, row: weather } = await row(async () => status())
    expect(weather).toEqual({
      id: 'weather',
      kind: 'data',
      state: 'ok',
      version: null,
      latencyMs: null,
      detail: {
        stationsWithMetar: 52,
        stationsTotal: 61,
        newestObsAgeMin: 11,
        metarCheckAgeMin: 3,
        tafCheckAgeMin: 9,
        validTafCount: 34,
        origin: 'remote',
      },
      checkedAt: '2026-09-25T12:00:00.000Z',
    })
    const ids = report.services.map((s) => s.id)
    expect(ids.indexOf('weather')).toBe(ids.indexOf('reference-data') + 1)
    expect(report.overall).toBe('ok')
  })

  it('yoklama yoksa ya da kaynak kapalıysa yapılandırılmadı (nedeniyle); genel durumu bozmaz', async () => {
    expect((await row(undefined)).row?.state).toBe('not_configured')
    expect((await row(null)).row?.state).toBe('not_configured')
    const reason = "EXTERNAL_PROVIDERS_DISABLED=true ve commit'li hava durumu fixture'ı yok"
    const { report, row: disabled } = await row(async () =>
      status({ metar: source({ origin: 'disabled', disabledReason: reason, checkedAt: null }) }),
    )
    expect(disabled).toMatchObject({
      state: 'not_configured',
      detail: { origin: 'disabled', reason },
    })
    expect(report.overall).toBe('ok')
  })

  it('degraded: METAR 15 dk–2 sa eski, TAF 1 saatten eski ya da hiç yok, güncel gözlem yok', async () => {
    const cases: [string, WeatherStatus][] = [
      ['metar 16 dk', status({ metar: source({ checkedAt: minutesAgo(16) }) })],
      ['taf 61 dk', status({ taf: source({ kind: 'taf', checkedAt: minutesAgo(61) }) })],
      ['taf hiç', status({ taf: null })],
      ['güncel gözlem yok', status({ stationsWithRecentMetar: 0 })],
    ]
    for (const [name, value] of cases) {
      expect((await row(async () => value)).row?.state, name).toBe('degraded')
    }
    expect(
      (await row(async () => status({ metar: source({ checkedAt: minutesAgo(15) }) }))).row?.state,
    ).toBe('ok')
  })

  it('son kontrolden yeni hata ve 429 engeli degraded; hata ve engel bitişi gösterilir', async () => {
    const failing = await row(async () =>
      status({
        taf: source({
          kind: 'taf',
          checkedAt: minutesAgo(20),
          lastError: 'aviationweather.gov sunucu hatası (TAF, HTTP 503)',
          lastErrorAt: minutesAgo(5),
        }),
      }),
    )
    expect(failing.row).toMatchObject({
      state: 'degraded',
      detail: { error: 'aviationweather.gov sunucu hatası (TAF, HTTP 503)' },
    })
    const limited = await row(async () =>
      status({
        metar: source({
          lastError: 'aviationweather.gov hız sınırı (METAR, HTTP 429)',
          lastErrorAt: minutesAgo(1),
          blockedUntil: new Date(NOW + 9 * 60_000),
          blockedKind: 'rate_limit',
        }),
      }),
    )
    expect(limited.row).toMatchObject({
      state: 'degraded',
      detail: {
        blockedUntil: '2026-09-25T12:09:00.000Z',
        error: 'aviationweather.gov hız sınırı (METAR, HTTP 429)',
      },
    })
    // Süresi geçmiş engel ve düzelmiş eski hata gösterilmez.
    const recovered = await row(async () =>
      status({
        metar: source({
          lastError: 'eski',
          lastErrorAt: minutesAgo(30),
          blockedUntil: minutesAgo(1),
          blockedKind: 'rate_limit',
        }),
      }),
    )
    expect(recovered.row?.state).toBe('ok')
    expect(recovered.row?.detail).not.toHaveProperty('blockedUntil')
    expect(recovered.row?.detail).not.toHaveProperty('error')
  })

  it('down: METAR 2 saatten eski ya da hiç kontrol yok, 403 engeli, sorgu hatası', async () => {
    const cases: [string, () => Promise<WeatherStatus>][] = [
      ['metar 121 dk', async () => status({ metar: source({ checkedAt: minutesAgo(121) }) })],
      ['metar hiç', async () => status({ metar: null })],
      [
        '403',
        async () =>
          status({
            metar: source({
              lastError: 'aviationweather.gov erişimi engelledi (METAR, HTTP 403)',
              lastErrorAt: minutesAgo(2),
              blockedUntil: new Date(NOW + 58 * 60_000),
              blockedKind: 'forbidden',
            }),
          }),
      ],
      ['sorgu', () => Promise.reject(new Error('relation "weather_sources" does not exist'))],
    ]
    for (const [name, probe] of cases) {
      const { report, row: weather } = await row(probe)
      expect(weather?.state, name).toBe('down')
      expect(report.overall, name).toBe('down')
    }
    expect((await row(cases[3]![1])).row?.detail).toEqual({
      error: 'relation "weather_sources" does not exist',
    })
  })
})
