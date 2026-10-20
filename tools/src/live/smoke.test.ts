import { LIVE_KEYS, type ProviderSummary } from '@havayolu/db'
import type { IngestStats } from '@havayolu/worker/ingest'
import { describe, expect, it, vi } from 'vitest'
import { refusalText } from './gates'
import type { LiveRequestRecord } from './guard'
import { LIVE_LOCK_KEY } from './lock'
import {
  assertSmokeTargets,
  countBboxAircraft,
  durationText,
  estimateSmokeRequests,
  evaluateSmoke,
  formatSmokeReport,
  runSmoke,
  seedCoveragePlan,
  SMOKE_DB_NAME,
  SMOKE_DURATION_MS,
  SMOKE_LIVE_DB_INDEX,
  smokeEnvSource,
  TURKEY_BBOX,
  type SmokeConfig,
  type SmokeDeps,
  type SmokeObservations,
} from './smoke'
import {
  FAKE_T0,
  FakeClock,
  FakeLiveRedis,
  FIXTURES_DIR,
  WORKSPACE_ROOT,
} from './test/adsblol-stub'

// Saf testler: altyapı yok, ağ yok. runSmoke yalnızca veritabanına ulaşmadan biten yollarda
// denenir (plan, kapılar, hedefler, kilit); bellek içi Redis ve hiç çağrılmaması beklenen fetch.

const WEST = '/v2/point/39.5/29.5/250'
const EAST = '/v2/point/39.2/38.8/250'
const LTFM = '/v2/point/41.2749/28.7321/40'
const EMAIL = 'ops@example.org'

function entry(id: string, tuple: unknown): [string, string[]] {
  return [id, ['c', JSON.stringify(tuple)]]
}

/** CompactAircraft: [hex, lat, lon, alt, yerde, gs, track, sampleTime, dbFlags]. */
function compact(hex: string, lat: number, lon: number, dbFlags: number | null = 0): unknown[] {
  return [hex, lat, lon, 35000, 0, 450, 90, FAKE_T0, dbFlags]
}

describe('countBboxAircraft', () => {
  it('sınırlar dahildir; dışarıdaki noktalar sayılmaz', () => {
    expect(TURKEY_BBOX).toEqual({ minLat: 35, maxLat: 43, minLon: 25, maxLon: 45 })
    const entries = [
      entry('1-0', compact('a00001', 35, 25)),
      entry('1-1', compact('a00002', 43, 45)),
      entry('1-2', compact('a00003', 35, 45)),
      entry('1-3', compact('a00004', 43, 25)),
      entry('1-4', compact('a00005', 39.1, 32.8)),
      entry('1-5', compact('b00001', 34.99999, 30)),
      entry('1-6', compact('b00002', 43.00001, 30)),
      entry('1-7', compact('b00003', 39, 24.99999)),
      entry('1-8', compact('b00004', 39, 45.00001)),
      entry('1-9', compact('b00005', 51.47, -0.45)),
    ]
    expect(countBboxAircraft(entries)).toEqual({ total: 5, visible: 5, nonIcao: 0, malformed: 0 })
  })

  it('aynı hex bir kez sayılır; ICAO dışı, askerî ve bilinmeyen dbFlags ayrılır', () => {
    const entries = [
      entry('1-0', compact('a00001', 40, 30)),
      entry('1-1', compact('a00001', 40.1, 30.1)),
      entry('1-2', compact('~1a2b3c', 41, 29)),
      entry('1-3', compact('a00002', 40, 31, 1)),
      entry('1-4', compact('a00003', 40, 32, 3)),
      entry('1-5', compact('a00004', 40, 33, 4)),
      entry('1-6', compact('a00005', 40, 34, 8)),
      entry('1-7', compact('a00006', 40, 35, null)),
      entry('1-8', compact('a00007', 40, 36, -1)),
      entry('1-9', compact('a00008', 40, 37, 1.5)),
    ]
    // Toplam 9 farklı hex; görünür: a00001, ~1a2b3c, a00004, a00005 (askerî 1/3 ve bilinmeyenler hariç).
    expect(countBboxAircraft(entries)).toEqual({ total: 9, visible: 4, nonIcao: 1, malformed: 0 })
  })

  it('görünürlük bbox içindeki son kayıttan okunur; bbox dışı kayıt etkilemez', () => {
    const entries = [
      entry('1-0', compact('a00001', 40, 30, 1)),
      entry('1-1', compact('a00001', 40.2, 30.2, 0)),
      entry('1-2', compact('a00002', 40, 30, 0)),
      entry('1-3', compact('a00002', 50, 30, 1)),
    ]
    expect(countBboxAircraft(entries)).toMatchObject({ total: 2, visible: 2 })
  })

  it('bozuk kayıtlar sayılır, hata fırlatılmaz', () => {
    const entries: [string, string[]][] = [
      ['1-0', []],
      ['1-1', ['x', '[]']],
      ['1-2', ['c', '{not json']],
      ['1-3', ['c', '{"hex":"a00001"}']],
      ['1-4', ['c', JSON.stringify(['a00001', 40, 30])]],
      ['1-5', ['c', JSON.stringify([1234, 40, 30, null, 0, null, null, FAKE_T0, 0])]],
      ['1-6', ['c', JSON.stringify(['a00002', '40', 30, null, 0, null, null, FAKE_T0, 0])]],
      ['1-7', ['c', JSON.stringify(['', 40, 30, null, 0, null, null, FAKE_T0, 0])]],
      entry('1-8', compact('a00003', 40, 30)),
    ]
    expect(countBboxAircraft(entries)).toEqual({ total: 1, visible: 1, nonIcao: 0, malformed: 8 })
  })

  it('başka bbox verilebilir', () => {
    const entries = [entry('1-0', compact('a00001', 51.47, -0.45))]
    expect(
      countBboxAircraft(entries, { minLat: 50, maxLat: 52, minLon: -1, maxLon: 0 }).total,
    ).toBe(1)
  })
})

// ---------------------------------------------------------------------------------------------

const STATS: IngestStats = {
  aircraft: 312,
  activeFlights: 300,
  requests: 31,
  rateLimited: 0,
  rowsSampled: 1200,
  rowsFine: 40,
  adsbLol: 'enabled',
  localReceivers: 0,
  rps: 0.1,
  circuit: 'closed',
  rowsDropped: 0,
  scope: 'airline',
  layer: 'on',
  published: 2900,
  dropped: { no_callsign: 40, pia_ladd: 3 },
}

function health(overrides: Partial<ProviderSummary> = {}): ProviderSummary {
  return {
    provider: 'adsbLol',
    status: 'ok',
    lastSuccessAt: new Date(FAKE_T0 + 301_000),
    lastErrorAt: null,
    lastError: null,
    consecutiveFailures: 0,
    rps: 0.1,
    circuit: 'closed',
    backoffUntil: null,
    freshnessP95S: 14.2,
    errorRatio60s: 0,
    requests60s: 6,
    updatedAt: new Date(FAKE_T0 + 307_000),
    rateLimitedRatio1h: 0,
    rateLimitedRatio24h: 0,
    ...overrides,
  }
}

/** 31 istek, 10 sn arayla: ilki birincil, her 7.'si doğu, kalanı batı. */
function requests(): LiveRequestRecord[] {
  return Array.from({ length: 31 }, (_, i) => ({
    path: i === 0 ? LTFM : i % 7 === 0 ? EAST : WEST,
    startedAt: FAKE_T0 + 5_000 + i * 10_000,
    status: 200,
    durationMs: 300,
    bytes: 1_000,
  }))
}

function observations(overrides: Partial<SmokeObservations> = {}): SmokeObservations {
  return {
    appName: 'testbrand',
    version: '0.19.0',
    startedAt: FAKE_T0,
    ingestStartedAt: FAKE_T0 + 5_000,
    ingestStoppedAt: FAKE_T0 + 305_000,
    endedAt: FAKE_T0 + 320_000,
    stopReason: 'completed',
    primaryIcao: 'LTFM',
    requests: requests(),
    primaryPaths: [WEST, LTFM],
    bbox: { total: 412, visible: 405, nonIcao: 3, malformed: 0 },
    health: health(),
    dbStartMs: FAKE_T0 + 1_000,
    stats: STATS,
    ...overrides,
  }
}

const passOf = (obs: SmokeObservations, id: 'bbox' | 'freshness' | 'health') =>
  evaluateSmoke(obs).checks.find((c) => c.id === id)?.pass

describe('evaluateSmoke', () => {
  it('üç ölçüt geçer ve çalışma tamamlanırsa GEÇTİ', () => {
    const report = evaluateSmoke(observations())
    expect(report.pass).toBe(true)
    expect(report.checks.map((c) => [c.id, c.pass])).toEqual([
      ['bbox', true],
      ['freshness', true],
      ['health', true],
    ])
  })

  it('bbox: 49 uçak KALDI, 50 GEÇTİ', () => {
    const bbox = (total: number) => ({ total, visible: total, nonIcao: 0, malformed: 0 })
    expect(passOf(observations({ bbox: bbox(49) }), 'bbox')).toBe(false)
    expect(evaluateSmoke(observations({ bbox: bbox(49) })).pass).toBe(false)
    expect(passOf(observations({ bbox: bbox(50) }), 'bbox')).toBe(true)
  })

  it('tazelik: 20,0 ve 20,00005 GEÇTİ (float4 payı); 20,01 ve veri yok KALDI', () => {
    const withP95 = (p95: number | null) => observations({ health: health({ freshnessP95S: p95 }) })
    expect(passOf(withP95(20), 'freshness')).toBe(true)
    expect(passOf(withP95(20.00005), 'freshness')).toBe(true)
    expect(passOf(withP95(20.01), 'freshness')).toBe(false)
    expect(passOf(withP95(null), 'freshness')).toBe(false)
    expect(passOf(withP95(Number.NaN), 'freshness')).toBe(false)
    expect(passOf(observations({ health: null }), 'freshness')).toBe(false)
  })

  it('sağlık satırı: yok, eski, son başarısız ya da devre config ise KALDI', () => {
    expect(passOf(observations({ health: null }), 'health')).toBe(false)
    expect(
      passOf(observations({ health: health({ updatedAt: new Date(FAKE_T0) }) }), 'health'),
    ).toBe(false)
    expect(passOf(observations({ health: health({ lastSuccessAt: null }) }), 'health')).toBe(false)
    expect(
      passOf(observations({ health: health({ circuit: 'config', status: 'down' }) }), 'health'),
    ).toBe(false)
    // updated_at çalıştırma başındaki veritabanı saatine eşitse yeni sayılır.
    expect(
      passOf(observations({ health: health({ updatedAt: new Date(FAKE_T0 + 1_000) }) }), 'health'),
    ).toBe(true)
    expect(passOf(observations({ health: health({ status: 'degraded' }) }), 'health')).toBe(true)
  })

  it('tamamlanmayan çalışma ölçütler geçse de GEÇTİ olmaz', () => {
    for (const stopReason of ['interrupted', 'config', 'guard', 'lock'] as const) {
      const report = evaluateSmoke(observations({ stopReason }))
      expect(report.checks.every((c) => c.pass)).toBe(true)
      expect(report.pass).toBe(false)
      expect(report.lines.some((l) => l.startsWith('Çalışma tamamlanmadı: '))).toBe(true)
      expect(report.lines.at(-1)).toBe('SONUÇ: KALDI')
    }
    expect(evaluateSmoke(observations({ stopReason: 'config' })).lines.join('\n')).toContain(
      'DUR-SOR 3',
    )
  })
})

describe('formatSmokeReport', () => {
  it('Türkçe, ondalık virgüllü, yalnızca sayılar', () => {
    const text = formatSmokeReport(evaluateSmoke(observations()))
    expect(text.split('\n')).toEqual([
      'smoke:live · testbrand 0.19.0 · 2026-10-04 12:00:00Z → 12:05:20Z · hazırlık 5,0 sn · ingest 5 dk 0 sn · kapanış 15,0 sn',
      'İstekler: 31 · 200: 31 · 429/420: 0 · 5xx: 0 · ağ/diğer: 0 · en kısa aralık 10,0 sn · son hız 0,100 istek/sn · devre closed',
      `  ${WEST} ×26 · ${EAST} ×4 · ${LTFM} ×1`,
      '  Birincil istasyonu (LTFM) kapsayan iki yanıt arası en uzun süre: 20,0 sn',
      "[GEÇTİ] Türkiye bbox'ında (35–43 K, 25–45 D) görülen uçak: 412 (en az 50) · askerî hariç 405 · ICAO dışı 3",
      '[GEÇTİ] LTFM veri yaşı p95: 14,2 sn (en çok 20)',
      '[GEÇTİ] provider_health: adsbLol · durum ok · güncelleme 12:05:07Z · son başarı 12:05:01Z · devre closed',
      'SONUÇ: GEÇTİ',
    ])
    expect(text).not.toMatch(/@|https?:|127\.0\.0\.1|localhost/)
  })

  it('istek dağılımı ve hata sayıları; eksik veri tire ile yazılır', () => {
    const list: LiveRequestRecord[] = [
      { path: LTFM, startedAt: FAKE_T0, status: 429, durationMs: 50, bytes: 100 },
      { path: WEST, startedAt: FAKE_T0 + 7_500, status: 503, durationMs: 50, bytes: 10 },
      { path: WEST, startedAt: FAKE_T0 + 20_000, status: null, durationMs: 15_000, bytes: null },
      { path: EAST, startedAt: FAKE_T0 + 40_000, status: 404, durationMs: 50, bytes: 0 },
    ]
    const text = formatSmokeReport(
      evaluateSmoke(
        observations({
          requests: list,
          bbox: { total: 0, visible: 0, nonIcao: 0, malformed: 2 },
          health: health({ freshnessP95S: null, lastSuccessAt: null, status: 'down' }),
          stats: { ...STATS, rps: null, circuit: null },
        }),
      ),
    )
    expect(text).toContain(
      'İstekler: 4 · 200: 0 · 429/420: 1 · 5xx: 1 · ağ/diğer: 2 · en kısa aralık 7,5 sn · son hız — · devre —',
    )
    expect(text).toContain(`  ${WEST} ×2 · ${EAST} ×1 · ${LTFM} ×1`)
    expect(text).toContain('kapsayan iki yanıt arası en uzun süre: —')
    expect(text).toContain(
      'görülen uçak: 0 (en az 50) · askerî hariç 0 · ICAO dışı 0 · bozuk kayıt 2',
    )
    expect(text).toContain('[KALDI] LTFM veri yaşı p95: veri yok (en çok 20)')
    expect(text).toContain('son başarı yok')
    expect(text.endsWith('SONUÇ: KALDI')).toBe(true)
  })

  it('istek yoksa ve sağlık satırı yoksa', () => {
    const text = formatSmokeReport(evaluateSmoke(observations({ requests: [], health: null })))
    expect(text).toContain('İstekler: 0 · 200: 0')
    expect(text).toContain('  (istek yok)')
    expect(text).toContain('[KALDI] provider_health: adsbLol satırı yok')
    expect(text).toContain('[KALDI] LTFM veri yaşı p95: veri yok')
  })

  it('eski sağlık satırı işaretlenir', () => {
    const text = formatSmokeReport(
      evaluateSmoke(observations({ health: health({ updatedAt: new Date(FAKE_T0 - 60_000) }) })),
    )
    expect(text).toContain('güncelleme 11:59:00Z (çalıştırmadan eski)')
  })
})

describe('yardımcılar', () => {
  it('durationText', () => {
    expect(durationText(0)).toBe('0,0 sn')
    expect(durationText(8_049)).toBe('8,0 sn')
    expect(durationText(59_900)).toBe('59,9 sn')
    expect(durationText(302_000)).toBe('5 dk 2 sn')
    expect(durationText(-5)).toBe('0,0 sn')
  })

  it('estimateSmokeRequests: ilk istek hemen, sonra her 1000/rps ms', () => {
    expect(estimateSmokeRequests(SMOKE_DURATION_MS, 0.1)).toBe(30)
    expect(estimateSmokeRequests(SMOKE_DURATION_MS, 0.2)).toBe(60)
    expect(estimateSmokeRequests(SMOKE_DURATION_MS, 0.19)).toBe(57)
    expect(estimateSmokeRequests(8_000, 0.19)).toBe(2)
  })

  it('seedCoveragePlan: tohum istasyonlarıyla batı, birincil LTFM ve doğu', () => {
    const plan = seedCoveragePlan(FIXTURES_DIR)
    expect(plan?.map((c) => c.kind)).toEqual(['west', 'primary', 'east'])
    expect(plan?.find((c) => c.kind === 'primary')?.primaryIcao).toBe('LTFM')
    expect(seedCoveragePlan(`${FIXTURES_DIR}/yok`)).toBeNull()
  })
})

describe('smokeEnvSource', () => {
  const source = {
    APP_ENV: 'development',
    WEB_HOST: 'localhost:3100',
    EXTERNAL_PROVIDERS_DISABLED: 'true',
    LOCAL_RECEIVER_URLS: 'http://localhost:4300',
    WATCH_HEX_LIST: '4baa01',
    DATABASE_URL: 'postgres://havayolu:havayolu_dev_only@localhost:45432/app_dev?sslmode=disable',
    REDIS_LIVE_URL: 'redis://:live_dev_only@localhost:46380/0',
  }

  it('dış sağlayıcı açık, alıcı ve takip boş, hedefler smoke veritabanı ve indeksi', () => {
    const before = { ...source }
    const out = smokeEnvSource(source, { databaseName: SMOKE_DB_NAME, liveDbIndex: 7 })
    expect(out).toMatchObject({
      APP_ENV: 'development',
      EXTERNAL_PROVIDERS_DISABLED: 'false',
      LOCAL_RECEIVER_URLS: '',
      WATCH_HEX_LIST: '',
      WEB_HOST: '',
      LIVE_AIRCRAFT_SCOPE: 'airline',
      DATABASE_URL:
        'postgres://havayolu:havayolu_dev_only@localhost:45432/app_smoke_live?sslmode=disable',
      REDIS_LIVE_URL: 'redis://:live_dev_only@localhost:46380/7',
    })
    expect(source).toEqual(before)
  })

  it('genel WEB_HOST kalır; ?db= atılır; ayrıştırılamayan adres olduğu gibi kalır', () => {
    const out = smokeEnvSource(
      {
        WEB_HOST: 'havayolu.example',
        REDIS_LIVE_URL: 'redis://localhost:46380?db=3',
        DATABASE_URL: 'not a url',
      },
      { databaseName: 'app_test_tools_smoke', liveDbIndex: 4 },
    )
    expect(out.WEB_HOST).toBe('havayolu.example')
    // Kullanıcının .env'indeki kapsam ne olursa olsun smoke yalnız havayolu uçaklarını yayınlar.
    expect(
      smokeEnvSource({ LIVE_AIRCRAFT_SCOPE: 'all' }, { databaseName: 'x', liveDbIndex: 1 })
        .LIVE_AIRCRAFT_SCOPE,
    ).toBe('airline')
    expect(out.REDIS_LIVE_URL).toBe('redis://localhost:46380/4')
    expect(out.DATABASE_URL).toBe('not a url')
    expect(
      smokeEnvSource({ WEB_HOST: '127.0.0.1:3100' }, { databaseName: 'x', liveDbIndex: 1 }),
    ).toMatchObject({ WEB_HOST: '' })
  })
})

describe('assertSmokeTargets', () => {
  const source = {
    DATABASE_URL: 'postgres://havayolu:havayolu_dev_only@localhost:45432/app_dev',
    REDIS_LIVE_URL: 'redis://:live_dev_only@localhost:46380/0',
  }
  const ok = (databaseName: string, liveDbIndex: number, src = source) => {
    try {
      assertSmokeTargets(src, { databaseName, liveDbIndex })
      return true
    } catch (error) {
      expect((error as { reason?: string }).reason).toBe('targets')
      return false
    }
  }

  it('app_smoke_live ve app_test_* kabul edilir', () => {
    expect(ok(SMOKE_DB_NAME, SMOKE_LIVE_DB_INDEX)).toBe(true)
    expect(ok('app_test_tools_smoke', 4)).toBe(true)
  })

  it('başka veritabanı adı, env kendi veritabanı ya da eşit/geçersiz indeks reddedilir', () => {
    expect(ok('app_dev', 7)).toBe(false)
    expect(ok('postgres', 7)).toBe(false)
    expect(ok('app_smoke_live; drop', 7)).toBe(false)
    expect(ok('App_Smoke_Live', 7)).toBe(false)
    expect(
      ok('app_test_tools_smoke', 7, {
        ...source,
        DATABASE_URL: 'postgres://u:p@localhost:45432/app_test_tools_smoke',
      }),
    ).toBe(false)
    expect(ok(SMOKE_DB_NAME, 0)).toBe(false)
    expect(ok(SMOKE_DB_NAME, 16)).toBe(false)
    expect(ok(SMOKE_DB_NAME, 1.5)).toBe(false)
    expect(ok(SMOKE_DB_NAME, 8, { ...source, REDIS_LIVE_URL: 'redis://localhost:46380/8' })).toBe(
      false,
    )
    // Yolsuz adres 0 numaralı veritabanıdır.
    expect(ok(SMOKE_DB_NAME, 7, { ...source, REDIS_LIVE_URL: 'redis://localhost:46380' })).toBe(
      true,
    )
    expect(
      ok(SMOKE_DB_NAME, 3, { ...source, REDIS_LIVE_URL: 'redis://localhost:46380?db=3' }),
    ).toBe(false)
    expect(ok(SMOKE_DB_NAME, 7, { ...source, DATABASE_URL: '' })).toBe(false)
    expect(ok(SMOKE_DB_NAME, 7, { ...source, REDIS_LIVE_URL: 'redis://localhost:46380/x' })).toBe(
      false,
    )
  })
})

// ---------------------------------------------------------------------------------------------
// runSmoke: veritabanına ulaşmadan biten yollar

const SOURCE: Record<string, string | undefined> = {
  APP_ENV: 'test',
  APP_NAME: 'testbrand',
  CONTACT_EMAIL: EMAIL,
  WEB_HOST: 'localhost:3100',
  ADSBLOL_RPS: '0.1',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://havayolu:havayolu_dev_only@localhost:45432/app_dev',
  REDIS_LIVE_URL: 'redis://:live_dev_only@localhost:46380/0',
}

function setup(overrides: Partial<SmokeConfig> = {}, redis: FakeLiveRedis = new FakeLiveRedis()) {
  const lines: string[] = []
  const fetchSpy = vi.fn<typeof fetch>(async () => {
    throw new Error('fetch must not be called')
  })
  const factory = vi.fn((_url: string) => redis)
  const config: SmokeConfig = {
    root: WORKSPACE_ROOT,
    confirm: true,
    source: SOURCE,
    shellEnv: {},
    version: '0.0.0-test',
    targets: { databaseName: SMOKE_DB_NAME, liveDbIndex: SMOKE_LIVE_DB_INDEX },
    durationMs: SMOKE_DURATION_MS,
    baseUrl: 'http://127.0.0.1:9',
    connectTimeoutMs: 100,
    ...overrides,
  }
  const deps: SmokeDeps = {
    fetch: fetchSpy,
    clock: new FakeClock(),
    log: (line) => void lines.push(line),
    redisFactory: factory,
  }
  return { config, deps, lines, fetchSpy, factory, redis, text: () => lines.join('\n') }
}

describe('runSmoke: plan (--confirm yok)', () => {
  it('istek ve bağlantı yok, çıkış 2; plan yolları, bütçeyi ve hedefleri yazar', async () => {
    const t = setup({ confirm: false, baseUrl: undefined })
    const result = await runSmoke(t.config, t.deps)
    expect(result).toEqual({ exitCode: 2, report: null, observations: null })
    expect(t.fetchSpy).not.toHaveBeenCalled()
    expect(t.factory).not.toHaveBeenCalled()
    const text = t.text()
    expect(text).toContain('smoke:live planı · testbrand 0.0.0-test (canlı istek atılmadı)')
    expect(text).toContain('5 dk; ≈30 istek (başlangıç 0,100 istek/sn, AIMD, üst sınır 0,2)')
    expect(text).toContain('yalnızca GET /v2/point (https://api.adsb.lol)')
    expect(text).toContain(`${WEST} (batı) · ${LTFM} (birincil LTFM) · ${EAST} (doğu)`)
    expect(text).toContain('Veritabanı: app_smoke_live her çalıştırmada yeniden kurulur')
    expect(text).toContain('redis-live 7: ')
    expect(text).toContain('CONTACT_EMAIL: var (değer yazılmaz)')
    expect(text).toContain('Kapılar: --confirm ile geçer')
    expect(text).toContain('ACTIVATION 1. adım')
    expect(text.split('\n').at(-1)).toBe(refusalText({ code: 'confirm_missing' }))
    expect(text).not.toContain(EMAIL)
    expect(text).not.toContain('havayolu_dev_only')
    expect(text).not.toContain('localhost')
  })

  it('ajan oturumunda da plan yazılır; --confirm reddi kapılarda görünür', async () => {
    const t = setup({
      confirm: false,
      baseUrl: undefined,
      shellEnv: { CLAUDECODE: '1', CI: 'true' },
      source: { ...SOURCE, CONTACT_EMAIL: '', ADSBLOL_RPS: '0.2' },
    })
    expect((await runSmoke(t.config, t.deps)).exitCode).toBe(2)
    const text = t.text()
    expect(text).toContain('≈60 istek (başlangıç 0,200 istek/sn')
    expect(text).toContain('CONTACT_EMAIL: yok')
    expect(text).toContain('Kapılar: --confirm ile şunlar engeller:')
    expect(text).toContain(refusalText({ code: 'agent_session' }))
    expect(text).toContain(refusalText({ code: 'ci' }))
    expect(text).toContain(refusalText({ code: 'contact_email' }))
    expect(t.factory).not.toHaveBeenCalled()
  })

  it('geçersiz env ve güvensiz hedef planda görünür', async () => {
    const t = setup({
      confirm: false,
      source: { ...SOURCE, ADSBLOL_RPS: '0.5' },
      targets: { databaseName: 'app_dev', liveDbIndex: 0 },
    })
    expect((await runSmoke(t.config, t.deps)).exitCode).toBe(2)
    expect(t.text()).toContain(refusalText({ code: 'targets' }))
    expect(t.text()).toContain(refusalText({ code: 'env_invalid' }))
    expect(t.text()).toContain('yalnızca GET /v2/point (test sunucusu)')
    expect(t.text()).not.toContain('127.0.0.1')
  })
})

describe('runSmoke: ret (istek yok, veritabanı yok)', () => {
  it('ajan oturumunda --confirm reddedilir', async () => {
    const t = setup({ shellEnv: { CLAUDECODE: '1' } })
    expect((await runSmoke(t.config, t.deps)).exitCode).toBe(2)
    expect(t.text()).toContain(refusalText({ code: 'agent_session' }))
    expect(t.factory).not.toHaveBeenCalled()
    expect(t.fetchSpy).not.toHaveBeenCalled()
  })

  it('canlı adreste CI ve EXTERNAL_PROVIDERS_DISABLED reddedilir; test sunucusunda geçer', async () => {
    const shellEnv = { CI: 'true', EXTERNAL_PROVIDERS_DISABLED: 'true' }
    const live = setup({ shellEnv, baseUrl: undefined })
    expect((await runSmoke(live.config, live.deps)).exitCode).toBe(2)
    expect(live.text()).toContain(refusalText({ code: 'ci' }))
    expect(live.text()).toContain(refusalText({ code: 'external_disabled' }))
    expect(live.factory).not.toHaveBeenCalled()

    // Test sunucusunda kapılar geçer; başka ingest olduğu için kilitte durur.
    const redis = new FakeLiveRedis()
    redis.seed(LIVE_KEYS.provider('adsbLol'), '{}', 180_000)
    const stub = setup({ shellEnv }, redis)
    expect((await runSmoke(stub.config, stub.deps)).exitCode).toBe(2)
    expect(stub.factory).toHaveBeenCalledTimes(1)
    expect(stub.factory).toHaveBeenCalledWith(SOURCE.REDIS_LIVE_URL)
  })

  it('yerel olmayan adres reddedilir; ileti adres ve parola içermez', async () => {
    const t = setup({
      source: { ...SOURCE, DATABASE_URL: 'postgres://u:topsecret99@db.example.net:5432/app' },
    })
    expect((await runSmoke(t.config, t.deps)).exitCode).toBe(2)
    expect(t.text()).toContain(refusalText({ code: 'url_not_local', subject: 'DATABASE_URL' }))
    expect(t.text()).not.toMatch(/topsecret99|db\.example\.net/)
    expect(t.factory).not.toHaveBeenCalled()
  })

  it('güvensiz hedef reddedilir', async () => {
    const t = setup({ targets: { databaseName: 'app_dev', liveDbIndex: 7 } })
    expect((await runSmoke(t.config, t.deps)).exitCode).toBe(2)
    expect(t.text()).toContain(refusalText({ code: 'targets' }))
    expect(t.factory).not.toHaveBeenCalled()
  })

  it('geçersiz env worker parseEnv iletisiyle reddedilir (değer yazılmaz)', async () => {
    const t = setup({ source: { ...SOURCE, ADSBLOL_RPS: '0.5' } })
    expect((await runSmoke(t.config, t.deps)).exitCode).toBe(2)
    expect(t.text()).toContain('ADSBLOL_RPS')
    expect(t.text()).not.toContain(EMAIL)
    expect(t.factory).not.toHaveBeenCalled()
  })

  it('izinsiz taban adres çıkış 4', async () => {
    const t = setup({ baseUrl: 'http://localhost:9' })
    expect((await runSmoke(t.config, t.deps)).exitCode).toBe(4)
    expect(t.text()).toContain('bekçi: taban adres izinli değil')
    expect(t.factory).not.toHaveBeenCalled()
  })

  it('baştan iptal edilmişse çıkış 130, bağlantı yok', async () => {
    const t = setup()
    const controller = new AbortController()
    controller.abort()
    t.deps.signal = controller.signal
    expect((await runSmoke(t.config, t.deps)).exitCode).toBe(130)
    expect(t.factory).not.toHaveBeenCalled()
  })

  it('redis-live yanıt vermezse çıkış 2 ve istemci kapatılır', async () => {
    const redis = new FakeLiveRedis({ ping: 'never' })
    const t = setup({}, redis)
    expect((await runSmoke(t.config, t.deps)).exitCode).toBe(2)
    expect(t.text()).toContain('pnpm dev:infra çalışıyor mu')
    expect(redis.errorListeners).toBe(1)
    expect(redis.isOpen()).toBe(false)
    expect(t.fetchSpy).not.toHaveBeenCalled()
  })

  it('başka ingest varsa çıkış 2; kilit alınmaz, istemci kapanır', async () => {
    const redis = new FakeLiveRedis()
    redis.seed(LIVE_KEYS.provider('adsbLol'), '{}', 180_000)
    const t = setup({}, redis)
    expect((await runSmoke(t.config, t.deps)).exitCode).toBe(2)
    expect(t.text()).toContain(refusalText({ code: 'other_ingest' }))
    expect(redis.peek(LIVE_LOCK_KEY)).toBeNull()
    expect(redis.isOpen()).toBe(false)
    expect(t.fetchSpy).not.toHaveBeenCalled()
  })

  it('kilit başkasındaysa çıkış 2; başkasının kilidine dokunulmaz', async () => {
    const redis = new FakeLiveRedis()
    redis.seed(LIVE_LOCK_KEY, 'other-token', 120_000)
    const t = setup({}, redis)
    expect((await runSmoke(t.config, t.deps)).exitCode).toBe(2)
    expect(t.text()).toContain(refusalText({ code: 'lock_held' }))
    expect(redis.peek(LIVE_LOCK_KEY)).toBe('other-token')
    expect(redis.isOpen()).toBe(false)
  })

  it('PostgreSQL yanıt vermezse çıkış 2; kilit bırakılır, parola yazılmaz', async () => {
    const redis = new FakeLiveRedis()
    // 127.0.0.1:1'de dinleyen yok: bağlantı reddedilir ya da süre dolar (ağa çıkılmaz).
    const t = setup(
      {
        source: { ...SOURCE, DATABASE_URL: 'postgres://u:topsecret99@127.0.0.1:1/app_dev' },
        connectTimeoutMs: 300,
      },
      redis,
    )
    expect((await runSmoke(t.config, t.deps)).exitCode).toBe(2)
    expect(t.text()).toContain('PostgreSQL yanıt vermedi')
    expect(t.text()).not.toContain('topsecret99')
    expect(redis.peek(LIVE_LOCK_KEY)).toBeNull()
    expect(redis.commands).toContain('eval')
    expect(redis.isOpen()).toBe(false)
    expect(t.fetchSpy).not.toHaveBeenCalled()
  }, 20_000)
})
