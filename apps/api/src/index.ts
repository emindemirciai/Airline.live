import {
  createDb,
  createRedis,
  EMPTY_AIRLINE_CODES,
  findAirportDetail,
  listAirportDetails,
  listAirportsWithIata,
  listLatestWeather,
  listListedAirportDetails,
  listListedAirports,
  listWeatherHistory,
  loadAirlineCodes,
  pingDb,
  pingRedis,
  readBlocklist,
  readHeartbeats,
  readProviderSummaries,
  redisMemory,
  referenceStatus,
  trackPartitionStatus,
  weatherStatus,
  type AirlineCodes,
} from '@havayolu/db'
import { AIRPORT_RING_CONFIG } from '@havayolu/shared'
import type { Redis } from 'ioredis'
import { pgArrivalCoverageStore } from './admin/arrival-coverage'
import { buildApp } from './app'
import { RedisSessionStore } from './auth/session-store'
import { EnvError, loadDotEnvForDevelopment, parseEnv, type Env } from './env'
import { BlocklistSync, type BlocklistSyncLog } from './live/blocklist-sync'
import { LiveCache, type LiveCacheLog } from './live/cache'
import { closeLiveSockets } from './live/ws'

/** Havayolu kod eşlemeleri (sefer no) bu aralıkla yeniden okunur. */
const AIRLINE_CODES_REFRESH_MS = 6 * 3_600_000
/**
 * Kodlar okunamadıysa ya da tablo henüz boşsa (ilk kurulumda VRS içe aktarımı worker'da API'den
 * sonra biter; PostgreSQL geç kalkmış olabilir) bu aralıkla yeniden denenir; sefer no 6 sa beklemez.
 */
const AIRLINE_CODES_RETRY_MS = 60_000

loadDotEnvForDevelopment()

let env: Env
try {
  env = parseEnv(process.env)
} catch (error) {
  if (error instanceof EnvError) {
    console.error(error.message)
    process.exit(1)
  }
  throw error
}

const database = env.DATABASE_URL
  ? createDb(env.DATABASE_URL, { max: 5, applicationName: 'hy-api' })
  : null
const redisQueue = env.REDIS_QUEUE_URL
  ? createRedis(env.REDIS_QUEUE_URL, { name: 'api-queue' })
  : null
const redisLive = env.REDIS_LIVE_URL ? createRedis(env.REDIS_LIVE_URL, { name: 'api-live' }) : null
// Canlı önbelleğin yoklaması kendi bağlantısındadır: pipeline'lı toplu okumalar /ready ve admin
// yoklamalarını bekletmez.
const redisLiveCache = env.REDIS_LIVE_URL
  ? createRedis(env.REDIS_LIVE_URL, { name: 'api-live-cache' })
  : null

let airlineCodes: AirlineCodes = EMPTY_AIRLINE_CODES

// Önbellek ve engel listesi uygulamaya verildiği için uygulamadan önce kurulur; logları uygulama
// kurulunca onun log'una gider. start() uygulamadan sonra çağrıldığından log kaybolmaz.
let liveLog: LiveCacheLog | null = null
const cacheLog: LiveCacheLog = {
  debug: (fields, message) => liveLog?.debug(fields, message),
  info: (fields, message) => liveLog?.info(fields, message),
  warn: (fields, message) => liveLog?.warn(fields, message),
}
let blocklistLog: BlocklistSyncLog | null = null
// Engel listesi kapalı başlar: ilk başarılı okumaya kadar canlı veri sunulmaz (D-074).
const blocklist = new BlocklistSync({
  read: redisQueue ? () => readBlocklist(redisQueue) : null,
  log: {
    info: (fields, message) => blocklistLog?.info(fields, message),
    warn: (fields, message) => blocklistLog?.warn(fields, message),
  },
})
/** Önbellek başladı mı: engel listesi yüklenmiş ve kodlar bir kez denenmiştir. */
let liveRunning = false

const liveCache = redisLiveCache
  ? new LiveCache({
      redisLive: redisLiveCache,
      codes: () => airlineCodes,
      blocklist: () => blocklist.current(),
      log: cacheLog,
      pollMs: env.LIVE_POLL_MS,
      // Süreç başına sayaç tabanı: yeniden başlayan API'ye eski `lastSeq` ile gelen istemci tam
      // görüntü alır (D-074).
      seqBase: Date.now(),
    })
  : null

const redisProbe = (redis: Redis | null) =>
  redis
    ? async () => {
        const latencyMs = await pingRedis(redis)
        return { latencyMs, ...(await redisMemory(redis)) }
      }
    : null

async function httpJson(url: string) {
  const started = performance.now()
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(2_000) })
  const body: unknown = await response.json().catch(() => null)
  return { status: response.status, body, latencyMs: Math.round(performance.now() - started) }
}

const app = await buildApp(env, {
  // redis-queue yoksa yönetici oturumu tutulamaz: giriş kapalı kalır.
  sessionStore: redisQueue ? new RedisSessionStore(redisQueue) : null,
  readiness: {
    postgres: database ? () => pingDb(database.sql) : null,
    redisQueue: redisQueue ? () => pingRedis(redisQueue) : null,
    redisLive: redisLive ? () => pingRedis(redisLive) : null,
  },
  probes: {
    postgres: database ? async () => ({ latencyMs: await pingDb(database.sql) }) : null,
    redisQueue: redisProbe(redisQueue),
    redisLive: redisProbe(redisLive),
    heartbeats: redisQueue ? () => readHeartbeats(redisQueue) : null,
    referenceData: database ? () => referenceStatus(database.db) : null,
    trackPartitions: database ? () => trackPartitionStatus(database.sql, new Date()) : null,
    providers: database ? () => readProviderSummaries(database.sql, new Date()) : null,
    weather: database ? () => weatherStatus(database.sql, new Date()) : null,
    http: httpJson,
    webUrl: new URL('/api/version', env.WEB_INTERNAL_URL).toString(),
    analyticsUrl: env.ANALYZE_URL ? new URL('/api/health', env.ANALYZE_URL).toString() : null,
    expectedWorkers: env.EXPECTED_WORKERS,
    now: () => new Date(),
  },
  rateLimitRedis: redisQueue,
  // Engel listesi yüklenip önbellek başlayana kadar /v1/live ve arama 503, WS 1013 döner.
  live: { source: liveCache, codes: () => airlineCodes, ready: () => liveRunning },
  blocklistRedis: redisQueue,
  // Kapsama raporu satırları (D-098): API yalnızca `queued` satır yazar ve okur.
  arrivalCoverage: database ? pgArrivalCoverageStore(database.sql) : null,
  // Halka ayarı (D-080) tek kaynaktan: `@havayolu/shared` `AIRPORT_RING_CONFIG`.
  airports: {
    list: database
      ? (country) => listAirportsWithIata(database.db, country, AIRPORT_RING_CONFIG)
      : null,
    details: database
      ? (country) => listAirportDetails(database.db, country, AIRPORT_RING_CONFIG)
      : null,
    listed: database ? () => listListedAirports(database.db, AIRPORT_RING_CONFIG) : null,
    listedDetails: database
      ? () => listListedAirportDetails(database.db, AIRPORT_RING_CONFIG)
      : null,
    find: database ? (code) => findAirportDetail(database.db, code, AIRPORT_RING_CONFIG) : null,
  },
  // Hava durumu: worker'ın yazdığı METAR/TAF kaydı; kod `/v1/airports/:code` kuralıyla çözülür.
  weather: {
    stations: database
      ? (country) => listAirportsWithIata(database.db, country, AIRPORT_RING_CONFIG)
      : null,
    listedStations: database ? () => listListedAirports(database.db, AIRPORT_RING_CONFIG) : null,
    resolve: database
      ? async (code) =>
          (await findAirportDetail(database.db, code, AIRPORT_RING_CONFIG))?.icao ?? null
      : null,
    latest: database ? (icaos, now) => listLatestWeather(database.sql, icaos, now) : null,
    history: database ? (icao, from, to) => listWeatherHistory(database.sql, icao, from, to) : null,
  },
})
liveLog = app.log.child({ component: 'live-cache' })
blocklistLog = app.log.child({ component: 'blocklist' })

/** Dolu bir eşleme okundu mu; okunana kadar `AIRLINE_CODES_RETRY_MS` aralığıyla denenir. */
let airlineCodesReady = false

/** Havayolu kodları; okunamazsa eldeki (açılışta boş) eşleme kalır, sefer no çıkarılmaz. */
const refreshAirlineCodes = async () => {
  if (!database) return
  try {
    airlineCodes = await loadAirlineCodes(database.sql)
    airlineCodesReady = airlineCodes.icaoToIata.size > 0
    app.log.debug({ airlines: airlineCodes.icaoToIata.size }, 'airline codes loaded')
  } catch (error) {
    app.log.warn({ err: error }, 'airline codes could not be loaded; flight numbers disabled')
  }
}

const refreshTimers = [
  setInterval(() => void refreshAirlineCodes(), AIRLINE_CODES_REFRESH_MS),
  setInterval(() => {
    if (!airlineCodesReady) void refreshAirlineCodes()
  }, AIRLINE_CODES_RETRY_MS),
]
for (const timer of refreshTimers) timer.unref()
let shuttingDown = false
// Önbellek, engel listesi ilk kez başarıyla okunduktan (5 sn'de bir denenir) ve kodlar bir kez
// denendikten sonra başlar: engelli uçak açılışta bir an bile görünmez. HTTP bunu beklemez; o ana
// kadar canlı uçlar 503/1013, ilk tura kadar /v1/live boş döner.
blocklist.start()
const liveStarted = Promise.all([refreshAirlineCodes(), blocklist.whenLoaded()]).then(
  ([, loaded]) => {
    if (!loaded || shuttingDown || !liveCache) return
    liveCache.start()
    liveRunning = true
  },
)
if (!liveCache) app.log.warn('live data disabled: REDIS_LIVE_URL is not set')

if (env.ADMIN_DISABLED_REASON) {
  app.log.error(
    { reason: env.ADMIN_DISABLED_REASON },
    'yönetici girişi kapalı: yönetici ayarı hatalı (Dokploy Environment)',
  )
} else if (!env.ADMIN_EMAIL || !redisQueue) {
  app.log.warn('yönetici girişi kapalı: ADMIN_EMAIL/ADMIN_SETUP_TOKEN ya da REDIS_QUEUE_URL eksik')
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'kapanıyor')
  try {
    shuttingDown = true
    for (const timer of refreshTimers) clearInterval(timer)
    blocklist.stop()
    // WebSocket istemcilerine önce yeniden bağlan mesajı gider (1012); sonra HTTP kapanır.
    await closeLiveSockets()
    await app.close()
    await liveStarted
    await liveCache?.stop()
    await Promise.allSettled([
      database?.sql.end({ timeout: 5 }),
      redisQueue?.quit(),
      redisLive?.quit(),
      redisLiveCache?.quit(),
    ])
    process.exit(0)
  } catch (error) {
    app.log.error(error, 'kapanış sırasında hata')
    process.exit(1)
  }
}
process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))

try {
  await app.listen({ host: env.API_LISTEN_HOST, port: env.API_PORT })
} catch (error) {
  app.log.error(error, 'API başlatılamadı')
  process.exit(1)
}
