import { createDb, createRedis, writeHeartbeat } from '@havayolu/db'
import { currentVersion } from '@havayolu/shared'
import type { Redis } from 'ioredis'
import { pino } from 'pino'
import { EnvError, loadDotEnvForDevelopment, parseEnv, type Env } from './env'
import { startHealthServer, type HealthState } from './health'
import { startIngest, type IngestHandle } from './ingest'
import { startJobs, type JobsHandle } from './jobs'
import { parseRoles, RoleError, type WorkerRole } from './roles'

/** Heartbeat aralığı; kayıt 60 sn TTL ile yazılır (packages/db → HEARTBEAT_TTL_SECONDS). */
const HEARTBEAT_INTERVAL_MS = 15_000
/** Kapanışta Redis'in QUIT yanıtı için beklenen en uzun süre; sonra bağlantı kesilir. */
const REDIS_QUIT_TIMEOUT_MS = 3_000
/**
 * Ingest kapanışının üst sınırı: yoldaki istek ve alıcı turu (≤ 8 sn) + son yazmalar (≤ 4 sn).
 * Docker'ın 30 sn'lik durdurma süresi içinde veritabanı ve Redis kapanışına yer kalır.
 */
const INGEST_SHUTDOWN_TIMEOUT_MS = 13_000
/** redis-live komutu bu sürede yanıt almazsa hata verir (bağlantı açık ama Redis yanıtsız). */
const LIVE_COMMAND_TIMEOUT_MS = 2_000

loadDotEnvForDevelopment()

let env: Env
let roles: WorkerRole[]
try {
  env = parseEnv(process.env)
  roles = parseRoles(env.WORKER_ROLE, env.APP_ENV)
} catch (error) {
  if (error instanceof EnvError || error instanceof RoleError) {
    console.error(error.message)
    process.exit(1)
  }
  throw error
}

const log = pino({ level: env.LOG_LEVEL, base: { service: env.WORKER_SERVICE_NAME } })
const version = currentVersion()
const startedAt = new Date().toISOString()
// Heartbeat bağlantısı BullMQ işleyicisi değildir: komutlar Redis kesintisinde sonsuza dek
// kuyrukta beklemesin diye sonlu yeniden deneme (varsayılan 2) kullanılır.
const redis = env.REDIS_QUEUE_URL
  ? createRedis(env.REDIS_QUEUE_URL, { name: env.WORKER_SERVICE_NAME })
  : null
/**
 * Anlık durum bağlantısı hızlı hata verir: bağlantı yokken komut çevrimdışı kuyrukta yeniden
 * bağlanmayı beklemez (`enableOfflineQueue: false`), yanıtsız kalan komut 2 sn'de düşer. Anlık
 * durum kalıcı değildir; bir sonraki tur yeniden yazar. `createRedis` bu iki ayarı almaz; ioredis
 * ikisini de her komutta `options`'tan okuduğu için bağlantı kurulurken ayarlanır.
 */
function createLiveRedis(url: string): Redis {
  const client = createRedis(url, { name: `${env.WORKER_SERVICE_NAME}:live` })
  client.options.enableOfflineQueue = false
  client.options.commandTimeout = LIVE_COMMAND_TIMEOUT_MS
  return client
}

// Anlık durum (ingest). Yalnızca ingest rolü kullanır; diğer rollerde bağlantı açılmaz.
const redisLive =
  env.REDIS_LIVE_URL && roles.includes('ingest') ? createLiveRedis(env.REDIS_LIVE_URL) : null

// Worker havuzu küçük tutulur: api ve worker havuzlarının toplamı ≤ 30 (infra.md).
const database = env.DATABASE_URL
  ? createDb(env.DATABASE_URL, { max: 3, applicationName: `havayolu-${env.WORKER_SERVICE_NAME}` })
  : null

const state: HealthState = {
  service: env.WORKER_SERVICE_NAME,
  roles,
  version,
  lastHeartbeatAt: null,
  heartbeatRequired: redis !== null,
}

async function beat() {
  if (!redis) return
  try {
    await writeHeartbeat(redis, {
      service: env.WORKER_SERVICE_NAME,
      roles,
      version,
      gitSha: env.GIT_SHA,
      pid: process.pid,
      startedAt,
      at: new Date().toISOString(),
    })
    state.lastHeartbeatAt = new Date()
  } catch (error) {
    log.warn({ err: error }, 'heartbeat yazılamadı')
  }
}

/** QUIT'i sınırlı süre bekler; Redis yanıt vermiyorsa bağlantıyı doğrudan keser. */
async function closeRedisClient(client: Redis | null): Promise<void> {
  if (!client) return
  const timeout = new Promise<'timeout'>((resolve) => {
    setTimeout(() => resolve('timeout'), REDIS_QUIT_TIMEOUT_MS).unref()
  })
  const outcome = await Promise.race([
    client.quit().then(
      () => 'closed' as const,
      () => 'failed' as const,
    ),
    timeout,
  ])
  if (outcome !== 'closed') client.disconnect()
}

async function closeRedis(): Promise<void> {
  await Promise.all([closeRedisClient(redis), closeRedisClient(redisLive)])
}

/** Ingest kapanışı sınırlıdır; süre dolarsa bağlantılar yine kapatılır. */
async function closeIngest(handle: IngestHandle): Promise<void> {
  const timeout = new Promise<'timeout'>((resolve) => {
    setTimeout(() => resolve('timeout'), INGEST_SHUTDOWN_TIMEOUT_MS).unref()
  })
  const outcome = await Promise.race([
    handle.close().then(
      () => 'closed' as const,
      (error: unknown) => {
        log.warn({ err: error }, 'ingest close failed')
        return 'failed' as const
      },
    ),
    timeout,
  ])
  if (outcome === 'timeout') log.warn('ingest did not close in time')
}

// Sağlık ucu ve sinyal işleyicileri ilk heartbeat'ten önce açılır: Redis erişilemezse süreç sessizce
// takılmaz, /health 503 döner ve kapanış sinyali yine işlenir.
const health = startHealthServer(env.WORKER_HEALTH_PORT, () => state)
if (!redis)
  log.warn('REDIS_QUEUE_URL tanımlı değil: heartbeat yazılmayacak (yalnızca yerel geliştirme)')
void beat()
const timer = setInterval(() => void beat(), HEARTBEAT_INTERVAL_MS)

let jobs: JobsHandle | null = null
let ingest: IngestHandle | null = null
let shuttingDown = false

const shutdown = async (signal: string) => {
  shuttingDown = true
  log.info({ signal }, 'kapanıyor')
  clearInterval(timer)
  if (ingest) await closeIngest(ingest)
  health.close()
  await jobs?.close().catch((error: unknown) => log.warn({ err: error }, 'bakım işleri kapanamadı'))
  await database?.sql.end({ timeout: 5 }).catch(() => undefined)
  await closeRedis()
  process.exit(0)
}
process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))
log.info({ roles, version, healthPort: env.WORKER_HEALTH_PORT }, 'worker başladı')

if (roles.includes('ingest')) {
  if (!redisLive || !database) {
    const missing = [!redisLive && 'REDIS_LIVE_URL', !database && 'DATABASE_URL'].filter(Boolean)
    if (env.APP_ENV === 'production') {
      log.fatal({ missing }, 'ingest role requires REDIS_LIVE_URL and DATABASE_URL')
      process.exit(1)
    }
    log.warn({ missing }, 'ingest role skipped: REDIS_LIVE_URL and DATABASE_URL are required')
  } else {
    try {
      const handle = await startIngest({
        env,
        redisLive,
        // Hex engel listesi kaynakta da uygulanır (D-115).
        redisQueue: redis ?? undefined,
        database,
        log,
        version,
      })
      // Açılış sürerken kapanış sinyali geldiyse döngüler hemen durdurulur.
      if (shuttingDown) await closeIngest(handle)
      else ingest = handle
    } catch (error) {
      // Üretimde süreç çıkar ve Docker yeniden başlatır; yerelde (ör. migration çalıştırılmamış)
      // diğer roller ve web/api çalışmaya devam eder.
      if (env.APP_ENV === 'production') {
        log.fatal({ err: error }, 'ingest failed to start')
        process.exit(1)
      }
      log.error({ err: error }, 'ingest failed to start; run pnpm db:migrate and restart')
    }
  }
}

if (roles.includes('jobs')) {
  if (!env.REDIS_QUEUE_URL || !database) {
    log.warn('jobs rolü için REDIS_QUEUE_URL ve DATABASE_URL gerekli: bakım işleri başlamadı')
  } else {
    try {
      jobs = await startJobs({ env, redisUrl: env.REDIS_QUEUE_URL, database, log, version })
    } catch (error) {
      // Zamanlayıcı kaydedilemezse süreç çıkar; Docker yeniden başlatır.
      log.fatal({ err: error }, 'bakım işleri başlatılamadı')
      process.exit(1)
    }
  }
}
