import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import {
  activeStationsWithArp,
  createDb,
  createFlight,
  createRedis,
  ensureTrackPartitions,
  insertTrackPoints,
  LIVE_KEYS,
  readCoverage,
  runMigrations,
  seedStations,
  writeProviderHealth,
  type Database,
  type ProviderHealthSnapshot,
  type TrackPointRow,
} from '@havayolu/db'
import type { Redis } from 'ioredis'
import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { parseEnv } from '../env'
import { coverageCircles, startIngest, type IngestDeps, type IngestHandle } from './index'
import { coveragePlan } from './plan'

// Gerçek PostgreSQL + redis-live (yerelde `pnpm dev:infra`, CI'da dev compose). Dış ağa hiçbir
// istek gitmez: yerel alıcı ve adsb.lol, 127.0.0.1'de testin kendi sunucularıdır.
const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_db_ingest_worker'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../../../../packages/db/drizzle', import.meta.url))
const fixtureFile = fileURLToPath(
  new URL('../../../../tools/fixtures/adsblol/point-ltfm-40nm.json', import.meta.url),
)

/** Başka testlerle çakışmasın diye adres ne olursa olsun redis-live'ın 3 numaralı veritabanı. */
function liveUrl(): string {
  const url = new URL(process.env.TEST_REDIS_LIVE_URL ?? 'redis://:live_dev_only@localhost:46380/3')
  url.pathname = '/3'
  return url.toString()
}

const FAST_TIMERS = { tickMs: 200, flushMs: 200, receiverMs: 200, healthMs: 200 }

let admin: Database
let database: Database
let redis: Redis

beforeAll(async () => {
  admin = createDb(adminUrl, { max: 1 })
  await admin.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.sql.unsafe(`create database ${testDbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder })
  database = createDb(testUrl, { max: 4 })
  await database.sql`
    insert into airports (id, ident, type, name, latitude_deg, longitude_deg, elevation_ft,
      iso_country, iso_region, scheduled_service, iata_code, row_hash)
    values (1, 'LTFM', 'large_airport', 'Istanbul Airport', 41.274874, 28.732136, 325, 'TR',
      'TR-34', true, 'IST', 'test')`
  await seedStations(database.db)
  redis = createRedis(liveUrl(), { name: 'test-worker-ingest' })
  await redis.flushdb()
})

afterAll(async () => {
  await redis?.flushdb().catch(() => undefined)
  await redis?.quit().catch(() => undefined)
  await database?.sql.end({ timeout: 5 })
  await admin?.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin?.sql.end({ timeout: 5 })
})

beforeEach(async () => {
  await redis.flushdb()
  await database.sql`truncate flights, track_points_sampled, track_points_fine, provider_health,
    provider_health_hourly, provider_status_changes`
})

/** Test saati: gerçek saatle ilerler, `advance` ile ileri atlatılır. */
function testClock() {
  let offset = 0
  return {
    now: () => Date.now() + offset,
    advance: (ms: number) => {
      offset += ms
    },
  }
}

/** 127.0.0.1'de rastgele portta sahte sunucu; kapanışta açık bağlantılar da kesilir. */
async function serve(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handler)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

/** Koşul sağlanana kadar kısa aralıklarla yoklar; süre dolarsa ne beklendiğini söyler. */
async function waitFor(what: string, check: () => Promise<boolean> | boolean, timeoutMs = 8_000) {
  const started = Date.now()
  for (;;) {
    if (await check()) return
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

/** Yalnızca 127.0.0.1'e izin veren fetch: yanlışlıkla gerçek ağa çıkılmasın. */
const localOnlyFetch: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.hostname !== '127.0.0.1') throw new Error(`test must not reach ${url.hostname}`)
  return fetch(input, init)
}

/** Log satırlarını toplar (sızıntı denetimi için). */
function captureLog() {
  const lines: string[] = []
  const log = pino({ level: 'debug' }, { write: (line: string) => void lines.push(line) })
  return { log, lines }
}

const staleHealth = (provider: string): ProviderHealthSnapshot => ({
  provider,
  status: 'ok',
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  consecutiveFailures: 0,
  rps: null,
  circuit: 'closed',
  backoffUntil: null,
  freshnessP95S: null,
  errorRatio60s: null,
  requests60s: 0,
})

const count = async (query: Promise<{ n: number }[]>) => (await query)[0]?.n ?? 0

async function withIngest(
  deps: Omit<IngestDeps, 'redisLive' | 'database' | 'version'> & { redisLive?: Redis },
  run: (ingest: IngestHandle) => Promise<void>,
) {
  const ingest = await startIngest({
    ...deps,
    redisLive: deps.redisLive ?? redis,
    database,
    version: '0.0.0-test',
  })
  try {
    await run(ingest)
  } finally {
    const started = Date.now()
    await ingest.close()
    expect(Date.now() - started).toBeLessThan(8_000)
  }
}

describe('ingest (gerçek PostgreSQL + redis-live)', () => {
  it('yerel alıcı: anlık durum, uçuş kaydı, iz ve sağlık yazılır; 120 sn sonra süpürülür', async () => {
    const clock = testClock()
    let serving = true
    const receiver = await serve((req, res) => {
      if (req.url !== '/data/aircraft.json') {
        res.writeHead(404).end()
        return
      }
      const aircraft = serving
        ? [
            // LTFM'e yaklaşan, 2 000 ft: ince iz adayı.
            {
              hex: 'fe0001',
              type: 'adsb_icao',
              flight: 'HYT001  ',
              r: 'TC-TST',
              t: 'A21N',
              alt_baro: 2000,
              alt_geom: 2150,
              gs: 160,
              track: 355,
              baro_rate: -704,
              lat: 41.2,
              lon: 28.73,
              seen_pos: 0.3,
              seen: 0.1,
              dbFlags: 0,
            },
            // LTFM'de yerde.
            {
              hex: 'fe0002',
              type: 'adsb_icao',
              flight: 'HYT002',
              alt_baro: 'ground',
              gs: 12,
              track: 90,
              lat: 41.2749,
              lon: 28.7321,
              seen_pos: 0.4,
              seen: 0.2,
              dbFlags: 0,
            },
            // FL350, uzakta; bayrağı bilinmiyor (veritabanısız readsb). Yalnızca geometrik dikey
            // hız gelir.
            {
              hex: 'fe0003',
              type: 'adsb_icao',
              flight: 'HYT003',
              alt_baro: 35000,
              gs: 450,
              track: 90,
              geom_rate: 64,
              lat: 39,
              lon: 35,
              seen_pos: 0.5,
              seen: 0.2,
            },
          ]
        : []
      res
        .writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ now: clock.now() / 1000, messages: 1000, aircraft }))
    })
    const { log, lines } = captureLog()
    // Bu süreçte yapılandırılmamış sağlayıcının eski satırı açılışta silinir.
    await writeProviderHealth(database.sql, staleHealth('adsbLol'))
    const env = parseEnv({
      APP_ENV: 'test',
      EXTERNAL_PROVIDERS_DISABLED: 'true',
      LOCAL_RECEIVER_URLS: `${receiver.url}/data/aircraft.json`,
      WORKER_SERVICE_NAME: 'worker-test',
    })
    const hexes = ['fe0001', 'fe0002', 'fe0003']
    try {
      await withIngest(
        { env, log, now: clock.now, fetch: localOnlyFetch, timers: FAST_TIMERS },
        async (ingest) => {
          await waitFor('live keys', async () => {
            const exists = await Promise.all(hexes.map((h) => redis.exists(LIVE_KEYS.aircraft(h))))
            return exists.every((n) => n === 1)
          })
          expect(await redis.zcard(LIVE_KEYS.geo)).toBe(3)
          expect(await redis.xlen(LIVE_KEYS.updates)).toBeGreaterThan(0)

          await waitFor('track rows', async () => {
            const sampled = await count(
              database.sql`select count(distinct flight_id)::int as n from track_points_sampled`,
            )
            const fine = await count(
              database.sql`select count(distinct flight_id)::int as n from track_points_fine`,
            )
            return sampled === 3 && fine === 2
          })
          const flights = await database.sql<{ hex: string; callsign: string; status: string }[]>`
            select hex, callsign, status from flights order by hex`
          expect(flights.map((f) => ({ ...f }))).toEqual([
            { hex: 'fe0001', callsign: 'HYT001', status: 'active' },
            { hex: 'fe0002', callsign: 'HYT002', status: 'active' },
            { hex: 'fe0003', callsign: 'HYT003', status: 'active' },
          ])
          const fineHexes = await database.sql<{ hex: string }[]>`
            select distinct f.hex from track_points_fine t join flights f on f.id = t.flight_id
            order by f.hex`
          expect(fineHexes.map((r) => r.hex)).toEqual(['fe0001', 'fe0002'])
          // localReceiver (1) × 16 + adsb_icao (0).
          const sources = await database.sql<{ source: number }[]>`
            select distinct source from track_points_sampled`
          expect(sources.map((r) => r.source)).toEqual([16])
          // Ham seen_pos ve baro_rate iki tabloya da yazılır (D-097); görünen dikey hız
          // barometrik yoksa geometrikten gelir, ham baro_rate boş kalır.
          const raw = (table: 'track_points_sampled' | 'track_points_fine') =>
            database.sql<
              {
                hex: string
                seen_pos_s: number | null
                baro_rate_fpm: number | null
                vertical_rate_fpm: number | null
              }[]
            >`
              select distinct f.hex, t.seen_pos_s, t.baro_rate_fpm, t.vertical_rate_fpm
              from ${database.sql(table)} t join flights f on f.id = t.flight_id
              order by f.hex`
          const expected = [
            {
              hex: 'fe0001',
              seen_pos_s: expect.closeTo(0.3, 5) as number,
              baro_rate_fpm: -704,
              vertical_rate_fpm: -704,
            },
            {
              hex: 'fe0002',
              seen_pos_s: expect.closeTo(0.4, 5) as number,
              baro_rate_fpm: null,
              vertical_rate_fpm: null,
            },
            {
              hex: 'fe0003',
              seen_pos_s: expect.closeTo(0.5, 5) as number,
              baro_rate_fpm: null,
              vertical_rate_fpm: 64,
            },
          ]
          expect((await raw('track_points_sampled')).map((r) => ({ ...r }))).toEqual(expected)
          expect((await raw('track_points_fine')).map((r) => ({ ...r }))).toEqual(
            expected.slice(0, 2),
          )

          await waitFor('localReceiver ok', async () => {
            const rows = await database.sql<{ status: string; circuit: string }[]>`
              select status, circuit from provider_health where provider = 'localReceiver'`
            return rows[0]?.status === 'ok' && rows[0].circuit === 'closed'
          })
          const providers = await database.sql<{ provider: string }[]>`
            select provider from provider_health order by provider`
          expect(providers.map((r) => r.provider)).toEqual(['localReceiver'])
          expect(await redis.hget(LIVE_KEYS.provider('localReceiver'), 'status')).toBe('ok')
          expect(await redis.get(LIVE_KEYS.providers)).toBe('["localReceiver"]')
          expect(ingest.stats()).toMatchObject({
            adsbLol: 'disabled',
            localReceivers: 1,
            aircraft: 3,
            activeFlights: 3,
            requests: 0,
            rps: null,
          })

          // Uçaklar kaybolur; saat 125 sn ileri atlar: sonraki tik canlı durumdan süpürür.
          serving = false
          clock.advance(125_000)
          await waitFor('sweep', async () => {
            const [geo, seen, keys] = await Promise.all([
              redis.zcard(LIVE_KEYS.geo),
              redis.zcard(LIVE_KEYS.seen),
              redis.exists(...hexes.map((h) => LIVE_KEYS.aircraft(h))),
            ])
            return geo === 0 && seen === 0 && keys === 0
          })
          await waitFor('memory prune', () => ingest.stats().aircraft === 0)
          // Kısa boşluk uçuşu bitirmez (30 dk kuralı).
          expect(ingest.stats().activeFlights).toBe(3)
        },
      )
    } finally {
      await receiver.close()
    }
    const logged = lines.join('\n')
    expect(logged).toContain('ingest started')
    expect(logged).toContain('ingest stopped')
    expect(logged).not.toContain('127.0.0.1')
  })

  it('adsb.lol (sahte sunucu): yanıt işlenir, 429 hızı yarıya indirir, sağlık yazılır', async () => {
    const clock = testClock()
    const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8')) as Record<string, unknown>
    const requests: { path: string; userAgent: string }[] = []
    const stub = await serve((req, res) => {
      requests.push({ path: req.url ?? '', userAgent: req.headers['user-agent'] ?? '' })
      if (requests.length === 1) {
        const now = clock.now()
        res
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ ...fixture, now, ctime: now }))
        return
      }
      // Gerçek 429 gibi: nginx HTML gövdesi, Retry-After yok.
      res
        .writeHead(429, { 'content-type': 'text/html' })
        .end('<html><head><title>429 Too Many Requests</title></head><body>nginx</body></html>')
    })
    expect(new URL(stub.url).hostname).toBe('127.0.0.1')
    const { log, lines } = captureLog()
    await writeProviderHealth(database.sql, staleHealth('localReceiver'))
    const env = parseEnv({
      APP_ENV: 'test',
      EXTERNAL_PROVIDERS_DISABLED: 'false',
      CONTACT_EMAIL: 'ops@example.org',
      ADSBLOL_RPS: '0.2',
      WORKER_SERVICE_NAME: 'worker-test',
    })
    try {
      await withIngest(
        {
          env,
          log,
          now: clock.now,
          random: () => 0,
          fetch: localOnlyFetch,
          adsbLolBaseUrl: stub.url,
          timers: FAST_TIMERS,
        },
        async (ingest) => {
          await waitFor('first response in redis', async () => {
            return (await redis.exists(LIVE_KEYS.aircraft('4b8750'))) === 1
          })
          // Tek istasyon (LTFM): ilk istek 40 NM birincil çemberidir.
          expect(requests[0]?.path).toBe('/v2/point/41.2749/28.7321/40')
          expect(requests[0]?.userAgent).toMatch(/^havayolu\/0\.0\.0-test \(.*ops@example\.org\)$/)
          expect(await redis.zcard(LIVE_KEYS.geo)).toBeGreaterThan(10)
          await waitFor('region freshness', async () => {
            const regions = await redis.hgetall(LIVE_KEYS.regions)
            return regions.LTFM !== undefined && regions.primary !== undefined
          })
          // Kapsama planı sağlık turunda TTL ile yazılır; API bu çemberlerle kapsama hesaplar.
          await waitFor('coverage plan', async () => (await readCoverage(redis)) !== null)
          const plan = coveragePlan(await activeStationsWithArp(database.sql))
          expect(await readCoverage(redis)).toEqual(coverageCircles(plan))
          expect(await readCoverage(redis)).toContainEqual({
            id: 'primary',
            kind: 'primary',
            lat: 41.274874,
            lon: 28.732136,
            radiusNm: 40,
          })
          expect(await redis.ttl(LIVE_KEYS.coverage)).toBeGreaterThan(590)

          // 0,2 istek/sn = 5 sn'lik slot: saat ileri atlar, ikinci istek 429 alır.
          clock.advance(5_000)
          await waitFor('rate limited', () => ingest.stats().rateLimited === 1)
          expect(requests).toHaveLength(2)
          expect(ingest.stats().rps).toBeCloseTo(0.1, 10)
          await waitFor('provider live hash', async () => {
            const live = await redis.hgetall(LIVE_KEYS.provider('adsbLol'))
            return live.rps === '0.1' && live.lastError === 'HTTP 429 (kısıtlama)'
          })
          await waitFor('provider_health degraded', async () => {
            const rows = await database.sql<
              { status: string; rps: number; last_error: string | null; circuit: string }[]
            >`select status, rps, last_error, circuit from provider_health
              where provider = 'adsbLol'`
            const row = rows[0]
            return (
              row?.status === 'degraded' &&
              Math.abs(row.rps - 0.1) < 1e-6 &&
              row.last_error === 'HTTP 429 (kısıtlama)' &&
              row.circuit === 'closed'
            )
          })
          const changes = await database.sql<{ to_status: string }[]>`
            select to_status from provider_status_changes where provider = 'adsbLol' order by id`
          expect(changes.map((c) => c.to_status)).toContain('degraded')
          const providers = await database.sql<{ provider: string }[]>`
            select provider from provider_health order by provider`
          expect(providers.map((r) => r.provider)).toEqual(['adsbLol'])
          expect(await count(database.sql`select count(*)::int as n from flights`)).toBeGreaterThan(
            10,
          )
          expect(ingest.stats()).toMatchObject({
            adsbLol: 'enabled',
            requests: 2,
            circuit: 'closed',
          })
        },
      )
    } finally {
      await stub.close()
    }
    const logged = lines.join('\n')
    expect(logged).toContain('adsblol request failed')
    expect(logged).not.toContain('127.0.0.1')
    expect(logged).not.toContain('ops@example.org')
  })

  it('redis-live erişilemezken yerel alıcı ve veritabanı geçmişi aynı hızla sürer', async () => {
    const clock = testClock()
    let hits = 0
    const receiver = await serve((_req, res) => {
      hits += 1
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({
          now: clock.now() / 1000,
          messages: 1,
          // LTFM'e yaklaşan, alçakta: her yeni örnek ince ize yazılır.
          aircraft: [
            {
              hex: 'fe0101',
              type: 'adsb_icao',
              flight: 'HYT101',
              alt_baro: 2000,
              gs: 160,
              track: 355,
              lat: 41.2,
              lon: 28.73,
              seen_pos: 0.2,
              seen: 0.1,
              dbFlags: 0,
            },
          ],
        }),
      )
    })
    // Kimsenin dinlemediği port; varsayılan ayarlar (çevrimdışı kuyruk açık) en kötü durumdur:
    // komutlar yeniden bağlanma denemeleri bitene kadar bekler.
    const deadLive = createRedis('redis://127.0.0.1:1/0', { name: 'test-worker-dead-live' })
    deadLive.on('error', () => undefined)
    const { log, lines } = captureLog()
    const env = parseEnv({
      APP_ENV: 'test',
      EXTERNAL_PROVIDERS_DISABLED: 'true',
      LOCAL_RECEIVER_URLS: `${receiver.url}/data/aircraft.json`,
      WORKER_SERVICE_NAME: 'worker-test',
    })
    const fineRows = () => count(database.sql`select count(*)::int as n from track_points_fine`)
    try {
      await withIngest(
        {
          env,
          log,
          now: clock.now,
          fetch: localOnlyFetch,
          timers: FAST_TIMERS,
          redisLive: deadLive,
        },
        async () => {
          await waitFor('first fine rows', async () => (await fineRows()) >= 2, 5_000)
          const hits0 = hits
          const rows0 = await fineRows()
          await new Promise((resolve) => setTimeout(resolve, 2_000))
          // 200 ms'lik tur: 2 sn'de ~10 okuma. Canlı yazım beklenseydi tur başına saniyeler sürerdi.
          expect(hits - hits0).toBeGreaterThanOrEqual(5)
          await waitFor('fine rows keep growing', async () => (await fineRows()) >= rows0 + 5)
        },
      )
    } finally {
      await receiver.close()
      deadLive.disconnect()
    }
    expect(lines.join('\n')).toContain('live state write failed')
  })

  it('yanıt vermeyen bir yerel alıcı diğerini yavaşlatmaz', async () => {
    const clock = testClock()
    let hits = 0
    const healthy = await serve((_req, res) => {
      hits += 1
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({
          now: clock.now() / 1000,
          messages: 1,
          aircraft: [
            {
              hex: 'fe0201',
              type: 'adsb_icao',
              flight: 'HYT201',
              alt_baro: 12000,
              gs: 300,
              track: 90,
              lat: 40.9,
              lon: 29.3,
              seen_pos: 0.2,
              seen: 0.1,
              dbFlags: 0,
            },
          ],
        }),
      )
    })
    // Bağlantıyı kabul eder, hiç yanıt vermez: istemci 5 sn'lik zaman aşımına kadar bekler.
    const hanging = await serve(() => undefined)
    const { log } = captureLog()
    const env = parseEnv({
      APP_ENV: 'test',
      EXTERNAL_PROVIDERS_DISABLED: 'true',
      LOCAL_RECEIVER_URLS: `${hanging.url}/data/aircraft.json,${healthy.url}/data/aircraft.json`,
      WORKER_SERVICE_NAME: 'worker-test',
    })
    try {
      await withIngest(
        { env, log, now: clock.now, fetch: localOnlyFetch, timers: FAST_TIMERS },
        async (ingest) => {
          // Birlikte beklenselerdi ilk sonuç ancak 5 sn sonra işlenirdi.
          await waitFor(
            'healthy receiver processed',
            async () => (await redis.exists(LIVE_KEYS.aircraft('fe0201'))) === 1,
            3_000,
          )
          const hits0 = hits
          await new Promise((resolve) => setTimeout(resolve, 2_000))
          expect(hits - hits0).toBeGreaterThanOrEqual(5)
          expect(ingest.stats()).toMatchObject({ localReceivers: 2, aircraft: 1 })
          // Asılı isteği bitir: kapanış 5 sn'lik zaman aşımını beklemesin.
          await hanging.close()
        },
      )
    } finally {
      await healthy.close()
      await hanging.close()
    }
  })

  it('açılışta yer bekleme durumu iz satırlarından geri kurulur', async () => {
    const clock = testClock()
    const t0 = clock.now()
    const MIN = 60_000
    await ensureTrackPartitions(database.sql, new Date(t0))
    const point = (flightId: number, ts: number, onGround: boolean, lat: number) =>
      ({
        flightId,
        ts: new Date(ts),
        lat,
        lon: 28.7321,
        altBaroFt: onGround ? null : 3000,
        altGeomFt: null,
        gsKt: onGround ? 0 : 160,
        trackDeg: 355,
        verticalRateFpm: null,
        onGround,
        source: 16,
        seenPosS: 0.2,
        baroRateFpm: null,
      }) satisfies TrackPointRow
    // G: park eden uçağın 20 dk bölünmesiyle açılmış kaydı (25 dk önce; satırı yalnızca ilk örnek).
    const parked = await createFlight(database.sql, {
      hex: 'fe0301',
      callsign: 'HYT301',
      registration: null,
      typeCode: null,
      firstSeenAt: new Date(t0 - 25 * MIN),
      lastSeenAt: new Date(t0 - 5_000),
    })
    await insertTrackPoints(database.sql, 'track_points_sampled', [
      point(parked, t0 - 25 * MIN, true, 41.2749),
    ])
    // H: havada açılmış, 5 dk önce inmiş kayıt.
    const landed = await createFlight(database.sql, {
      hex: 'fe0302',
      callsign: 'HYT302',
      registration: null,
      typeCode: null,
      firstSeenAt: new Date(t0 - 28 * MIN),
      lastSeenAt: new Date(t0 - 5_000),
    })
    await insertTrackPoints(database.sql, 'track_points_sampled', [
      point(landed, t0 - 28 * MIN, false, 41.1),
      point(landed, t0 - 5 * MIN, true, 41.2755),
    ])
    const receiver = await serve((_req, res) => {
      const onGround = (hex: string, flight: string, lat: number) => ({
        hex,
        type: 'adsb_icao',
        flight,
        alt_baro: 'ground',
        gs: 0,
        track: 355,
        lat,
        lon: 28.7321,
        seen_pos: 0.2,
        seen: 0.1,
        dbFlags: 0,
      })
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({
          now: clock.now() / 1000,
          messages: 1,
          aircraft: [onGround('fe0301', 'HYT301', 41.2749), onGround('fe0302', 'HYT302', 41.2755)],
        }),
      )
    })
    const { log } = captureLog()
    const env = parseEnv({
      APP_ENV: 'test',
      EXTERNAL_PROVIDERS_DISABLED: 'true',
      LOCAL_RECEIVER_URLS: `${receiver.url}/data/aircraft.json`,
      WORKER_SERVICE_NAME: 'worker-test',
    })
    const records = (hex: string) =>
      database.sql<{ id: number; status: string }[]>`
        select id::int as id, status from flights where hex = ${hex} order by id`
    const seenSince = async (hex: string, since: number) => {
      const rows = await database.sql<{ ms: number }[]>`
        select (extract(epoch from max(last_seen_at)) * 1000)::float8 as ms
        from flights where hex = ${hex}`
      return (rows[0]?.ms ?? 0) >= since
    }
    try {
      await withIngest(
        { env, log, now: clock.now, fetch: localOnlyFetch, timers: FAST_TIMERS },
        async (ingest) => {
          await waitFor('both touched', async () => {
            return (await seenSince('fe0301', t0)) && (await seenSince('fe0302', t0))
          })
          expect(ingest.stats().activeFlights).toBe(2)
          // H'nin beklemesi inişten (5 dk önce) sayılır: 16 dk sonra 20. dakikası dolar, bölünür.
          // Durum geri kurulmasaydı bekleme açılışta başlar, 16. dakikada bölünmezdi.
          clock.advance(16 * MIN)
          await waitFor('landed record split once', async () => {
            const rows = await records('fe0302')
            return rows.length === 2 && rows[0]?.status === 'ended'
          })
          // G'nin beklemesi zaten bölünmüştü: açılıştan 21 dk sonra da yeni kayıt açılmaz.
          clock.advance(5 * MIN)
          await waitFor('parked touched after 21 min', () => seenSince('fe0301', t0 + 21 * MIN))
          const parkedRows = await records('fe0301')
          expect(parkedRows.map((r) => ({ ...r }))).toEqual([{ id: parked, status: 'active' }])
        },
      )
    } finally {
      await receiver.close()
    }
  })

  it('adsb.lol yapılandırma hatası: worker çalışır, istek atılmaz, admin satırı down/config', async () => {
    const { log, lines } = captureLog()
    const env = parseEnv({
      APP_ENV: 'test',
      EXTERNAL_PROVIDERS_DISABLED: 'false',
      WORKER_SERVICE_NAME: 'worker-test',
    })
    let called = 0
    const neverFetch: typeof fetch = async () => {
      called += 1
      throw new Error('must not be called')
    }
    await withIngest(
      { env, log, fetch: neverFetch, adsbLolBaseUrl: 'http://127.0.0.1:9', timers: FAST_TIMERS },
      async (ingest) => {
        await waitFor('config row', async () => {
          const rows = await database.sql<
            { status: string; circuit: string; last_error: string | null }[]
          >`select status, circuit, last_error from provider_health where provider = 'adsbLol'`
          return (
            rows[0]?.status === 'down' &&
            rows[0].circuit === 'config' &&
            rows[0].last_error === 'CONTACT_EMAIL tanımlı değil'
          )
        })
        expect(ingest.stats()).toMatchObject({ adsbLol: 'enabled', circuit: 'config', requests: 0 })
      },
    )
    expect(called).toBe(0)
    expect(lines.join('\n')).toContain('adsblol config error')
  })
})
