import { createDb, createRedis, LIVE_KEYS, type Database } from '@havayolu/db'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { LIVE_GAP_TOLERANCE_MS, LIVE_MIN_GAP_MS, pointPath } from './guard'
import { LIVE_LAST_KEY, LIVE_LOCK_KEY } from './lock'
import { runSmoke, TURKEY_BBOX, type SmokeConfig, type SmokeDeps } from './smoke'
import { findStationPoint } from './station'
import {
  cruiseFrame,
  FIXTURES_DIR,
  jsonReply,
  localOnlyFetch,
  nginx429Reply,
  startAdsbLolStub,
  WORKSPACE_ROOT,
  type AdsbLolEnvelope,
  type AdsbLolStub,
  type StubHandler,
} from './test/adsblol-stub'

// Gerçek PostgreSQL + redis-live (yerelde `pnpm dev:infra`, CI'da dev compose); adsb.lol,
// 127.0.0.1'deki testin kendi sunucusudur (vitest.setup.ts başka adrese giden fetch'i reddeder).
// Hedefler: veritabanı app_test_tools_smoke, ingest redis-live 4; env'in redis-live indeksi 8
// (kilit ve başka ingest denetimi). 0 dev, 1–3 ve 5 diğer testler, 9 kilit testi.
const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const DB_NAME = 'app_test_tools_smoke'
const ENV_INDEX = 8
const SMOKE_INDEX = 4
const EMAIL = 'ops@example.org'
const RPS = 0.19

function redisUrl(index: number): string {
  const url = new URL(process.env.TEST_REDIS_LIVE_URL ?? 'redis://:live_dev_only@localhost:46380/3')
  url.pathname = `/${index}`
  return url.toString()
}

function databaseUrl(name: string): string {
  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  return url.toString()
}

const envRedis = createRedis(redisUrl(ENV_INDEX), { name: 'tools-smoke-test-env' })
const smokeRedis = createRedis(redisUrl(SMOKE_INDEX), { name: 'tools-smoke-test-live' })
envRedis.on('error', () => {})
smokeRedis.on('error', () => {})
let admin: Database

const SOURCE: Record<string, string | undefined> = {
  APP_ENV: 'test',
  APP_NAME: 'testbrand',
  CONTACT_EMAIL: EMAIL,
  WEB_HOST: 'localhost:3100',
  ADSBLOL_RPS: String(RPS),
  LOG_LEVEL: 'info',
  // Env'in kendi veritabanı yalnızca ad karşılaştırması içindir; smoke ona bağlanmaz.
  DATABASE_URL: databaseUrl('app_test_tools_env'),
  REDIS_LIVE_URL: redisUrl(ENV_INDEX),
}

const FAST_TIMERS = { tickMs: 200, flushMs: 200, receiverMs: 200, healthMs: 200 }
const UA = /^testbrand\/0\.0\.0-test \(\+mailto:ops@example\.org\)$/

let stub: AdsbLolStub | null = null

async function serve(handler: StubHandler): Promise<AdsbLolStub> {
  stub = await startAdsbLolStub(handler)
  return stub
}

function smokeConfig(baseUrl: string, overrides: Partial<SmokeConfig> = {}): SmokeConfig {
  return {
    root: WORKSPACE_ROOT,
    confirm: true,
    source: SOURCE,
    // CI'ın kabuk ortamı: test sunucusu canlı adres olmadığı için ci/external_disabled uygulanmaz.
    shellEnv: { CI: 'true', EXTERNAL_PROVIDERS_DISABLED: 'true' },
    version: '0.0.0-test',
    targets: { databaseName: DB_NAME, liveDbIndex: SMOKE_INDEX },
    durationMs: 8_000,
    baseUrl,
    timers: FAST_TIMERS,
    progressEveryMs: 2_000,
    ...overrides,
  }
}

function smokeDeps(lines: string[], random?: () => number): SmokeDeps {
  return {
    fetch: localOnlyFetch,
    clock: {
      now: () => Date.now(),
      sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    },
    random,
    log: (line) => void lines.push(line),
    redisFactory: (url) => createRedis(url, { name: 'tools-smoke-test-guard' }),
  }
}

async function databaseExists(): Promise<boolean> {
  const rows = await admin.sql`select 1 from pg_database where datname = ${DB_NAME}`
  return rows.length > 0
}

async function dropDatabase(): Promise<void> {
  await admin.sql.unsafe(`drop database if exists ${DB_NAME} with (force)`)
}

function expectNoLeak(lines: readonly string[]): void {
  const text = lines.join('\n')
  expect(text).not.toContain(EMAIL)
  expect(text).not.toContain('127.0.0.1')
  expect(text).not.toContain('havayolu_dev_only')
  expect(text).not.toContain('live_dev_only')
}

beforeAll(async () => {
  admin = createDb(adminUrl, { max: 1 })
  await admin.sql`select 1`
  await envRedis.flushdb()
  await smokeRedis.flushdb()
})

afterEach(async () => {
  await stub?.close()
  stub = null
  await envRedis.flushdb()
  await smokeRedis.flushdb()
})

afterAll(async () => {
  await dropDatabase().catch(() => undefined)
  await admin?.sql.end({ timeout: 5 })
  await envRedis.quit().catch(() => envRedis.disconnect())
  await smokeRedis.quit().catch(() => smokeRedis.disconnect())
})

describe('smoke:live (gerçek PostgreSQL + redis-live, sahte adsb.lol)', () => {
  it('GEÇTİ: gerçek ingest, aralıklar ≥ 5 sn, plan çemberleri, bbox, tazelik ve sağlık satırı', async () => {
    const served: AdsbLolEnvelope[] = []
    const server = await serve(() => {
      const frame = cruiseFrame(Date.now(), 60)
      served.push(frame)
      return jsonReply(frame, { gzip: true })
    })
    // Önceki canlı çalışmanın son isteği "şimdi": ilk istek en erken bundan 1000 / rps ms sonra.
    const previousLast = Date.now()
    await envRedis.set(LIVE_LAST_KEY, String(previousLast), 'PX', 60_000)

    const lines: string[] = []
    const result = await runSmoke(smokeConfig(server.baseUrl), smokeDeps(lines))
    expect(result.exitCode, lines.join('\n')).toBe(0)
    expect(result.report?.pass).toBe(true)
    const obs = result.observations
    if (obs === null) throw new Error('observations missing')

    // İstekler: en az 2, bekçinin kaydına göre aralıklar ≥ 5 sn − 250 ms; sunucu aynısını gördü.
    expect(obs.stopReason).toBe('completed')
    expect(obs.requests.length).toBeGreaterThanOrEqual(2)
    expect(server.requests).toHaveLength(obs.requests.length)
    const starts = obs.requests.map((r) => r.startedAt)
    for (let i = 1; i < starts.length; i += 1) {
      expect((starts[i] as number) - (starts[i - 1] as number)).toBeGreaterThanOrEqual(
        LIVE_MIN_GAP_MS - LIVE_GAP_TOLERANCE_MS,
      )
    }
    expect(starts[0] as number).toBeGreaterThanOrEqual(previousLast + 1000 / RPS - 5)
    expect(obs.requests.every((r) => r.status === 200)).toBe(true)

    // Yollar: tohum istasyonlarının planı (batı, LTFM 40 NM, doğu); UA mailto biçiminde.
    const ltfm = findStationPoint('LTFM', FIXTURES_DIR)
    const ltfmPath = pointPath(ltfm.lat, ltfm.lon, 40)
    const allowed = new Set(['/v2/point/39.5/29.5/250', ltfmPath, '/v2/point/39.2/38.8/250'])
    for (const request of server.requests) {
      expect(allowed.has(request.path), request.path).toBe(true)
      expect(request.method).toBe('GET')
      expect(request.headers['user-agent']).toMatch(UA)
    }
    // Birincil istasyonu batı ve LTFM 40 NM çemberleri kapsar; istekler en az birinden geçti.
    expect([...obs.primaryPaths].sort()).toEqual(['/v2/point/39.5/29.5/250', ltfmPath].sort())
    expect(obs.requests.some((r) => obs.primaryPaths.includes(r.path))).toBe(true)
    expect(obs.primaryIcao).toBe('LTFM')

    // Bbox: sunulan karelerde bbox içindeki farklı uçaklar (sentetik 60 seyir + yaklaşma + taksi).
    const expected = new Set<string>()
    for (const frame of served) {
      for (const a of frame.ac) {
        const { hex, lat, lon } = a as { hex: string; lat: number; lon: number }
        const b = TURKEY_BBOX
        if (lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon)
          expected.add(hex)
      }
    }
    expect(expected.size).toBeGreaterThanOrEqual(50)
    expect(obs.bbox.total).toBe(expected.size)
    expect(obs.bbox.malformed).toBe(0)

    // Sağlık satırı (kapanıştaki son yazım): tazelik, son başarı, devre.
    expect(obs.health).not.toBeNull()
    expect(obs.health?.freshnessP95S).not.toBeNull()
    expect(obs.health?.freshnessP95S ?? Infinity).toBeLessThanOrEqual(20)
    expect(obs.health?.lastSuccessAt).not.toBeNull()
    expect(obs.health?.circuit).toBe('closed')
    expect(obs.health?.updatedAt.getTime() ?? 0).toBeGreaterThanOrEqual(obs.dbStartMs)

    // Rapor ve günlük: marka env'den, sızıntı yok.
    expect(lines.some((l) => l.startsWith('smoke:live · testbrand 0.0.0-test · '))).toBe(true)
    expect(lines).toContain('SONUÇ: GEÇTİ')
    expectNoLeak(lines)

    // Sonrası: kilit bırakıldı, son istek yazıldı, ingest indeksi temiz, veritabanı inceleme için kaldı.
    expect(await envRedis.exists(LIVE_LOCK_KEY)).toBe(0)
    expect(Number(await envRedis.get(LIVE_LAST_KEY))).toBe(Math.round(starts.at(-1) as number))
    expect(await smokeRedis.dbsize()).toBe(0)
    expect(await databaseExists()).toBe(true)
  })

  it('403: ilk istekten sonra durur, satırda devre config ve durum down, çıkış 3', async () => {
    const server = await serve(() => ({ status: 403, body: 'Forbidden' }))
    const lines: string[] = []
    const result = await runSmoke(
      smokeConfig(server.baseUrl, { durationMs: 20_000 }),
      smokeDeps(lines),
    )
    expect(result.exitCode, lines.join('\n')).toBe(3)
    const obs = result.observations
    if (obs === null) throw new Error('observations missing')
    expect(obs.stopReason).toBe('config')
    expect(server.requests).toHaveLength(1)
    expect(obs.requests).toHaveLength(1)
    expect(obs.requests[0]?.status).toBe(403)
    expect(obs.ingestStoppedAt - obs.ingestStartedAt).toBeLessThan(5_000)
    expect(obs.health?.circuit).toBe('config')
    expect(obs.health?.status).toBe('down')
    expect(result.report?.pass).toBe(false)
    expect(lines.join('\n')).toContain('DUR-SOR 3')
    expectNoLeak(lines)
    expect(await envRedis.exists(LIVE_LOCK_KEY)).toBe(0)
  })

  it('nginx 429 (Retry-After yok): tek istek, bbox 0, tazelik yok → KALDI, çıkış 1', async () => {
    const server = await serve(() => nginx429Reply())
    const lines: string[] = []
    const result = await runSmoke(
      smokeConfig(server.baseUrl, { durationMs: 6_000 }),
      smokeDeps(lines, () => 0.5),
    )
    expect(result.exitCode, lines.join('\n')).toBe(1)
    const obs = result.observations
    if (obs === null) throw new Error('observations missing')
    expect(obs.stopReason).toBe('completed')
    expect(server.requests).toHaveLength(1)
    expect(obs.requests[0]?.status).toBe(429)
    expect(obs.bbox.total).toBe(0)
    expect(obs.health?.freshnessP95S ?? null).toBeNull()
    expect(obs.stats.rateLimited).toBe(1)
    expect(result.report?.checks.map((c) => [c.id, c.pass])).toEqual([
      ['bbox', false],
      ['freshness', false],
      ['health', false],
    ])
    expect(lines).toContain('SONUÇ: KALDI')
    expectNoLeak(lines)
  })

  it('çalışırken başka ingest başlarsa denetimde durur, yarım rapor, çıkış 2', async () => {
    const server = await serve(async () => {
      // İlk istekle birlikte env'in indeksinde başka bir adsb.lol ingest'i belirir.
      await envRedis.set(LIVE_KEYS.provider('adsbLol'), '{}', 'EX', 180)
      return jsonReply(cruiseFrame(Date.now(), 60))
    })
    const lines: string[] = []
    const result = await runSmoke(
      smokeConfig(server.baseUrl, { durationMs: 20_000, lockCheckEveryMs: 1_000 }),
      smokeDeps(lines),
    )
    expect(result.exitCode, lines.join('\n')).toBe(2)
    const obs = result.observations
    if (obs === null) throw new Error('observations missing')
    expect(obs.stopReason).toBe('lock')
    expect(obs.ingestStoppedAt - obs.ingestStartedAt).toBeLessThan(5_000)
    expect(server.requests).toHaveLength(1)
    expect(result.report?.pass).toBe(false)
    expect(lines.join('\n')).toContain("adsb.lol'den çeken başka bir ingest var")
    expect(lines).toContain('SONUÇ: KALDI')
    expectNoLeak(lines)
    expect(await envRedis.exists(LIVE_LOCK_KEY)).toBe(0)
  })

  it('başka ingest ya da kilit varsa istek yok, veritabanı kurulmaz, çıkış 2', async () => {
    const server = await serve(() => jsonReply(cruiseFrame(Date.now(), 60)))
    await dropDatabase()

    await envRedis.set(LIVE_KEYS.provider('adsbLol'), '{}', 'EX', 180)
    const first: string[] = []
    expect((await runSmoke(smokeConfig(server.baseUrl), smokeDeps(first))).exitCode).toBe(2)
    expect(first.join('\n')).toContain("adsb.lol'den çeken başka bir ingest var")
    expect(await envRedis.exists(LIVE_LOCK_KEY)).toBe(0)

    await envRedis.flushdb()
    await envRedis.set(LIVE_LOCK_KEY, 'someone-else', 'PX', 120_000)
    const second: string[] = []
    expect((await runSmoke(smokeConfig(server.baseUrl), smokeDeps(second))).exitCode).toBe(2)
    expect(second.join('\n')).toContain('Başka bir canlı araç')
    expect(await envRedis.get(LIVE_LOCK_KEY)).toBe('someone-else')

    expect(server.requests).toHaveLength(0)
    expect(await databaseExists()).toBe(false)
    expect(await smokeRedis.dbsize()).toBe(0)
  })
})
