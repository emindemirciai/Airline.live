import { createDb, createRedis, writeHeartbeat } from '@havayolu/db'
import { currentVersion } from '@havayolu/shared'
import { pino } from 'pino'
import { EnvError, loadDotEnvForDevelopment, parseEnv, type Env } from './env'
import { startHealthServer, type HealthState } from './health'
import { startJobs, type JobsHandle } from './jobs'
import { parseRoles, RoleError, type WorkerRole } from './roles'

/** Heartbeat aralığı; kayıt 60 sn TTL ile yazılır (packages/db → HEARTBEAT_TTL_SECONDS). */
const HEARTBEAT_INTERVAL_MS = 15_000
/** Kapanışta Redis'in QUIT yanıtı için beklenen en uzun süre; sonra bağlantı kesilir. */
const REDIS_QUIT_TIMEOUT_MS = 3_000

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
async function closeRedis(): Promise<void> {
  if (!redis) return
  const timeout = new Promise<'timeout'>((resolve) => {
    setTimeout(() => resolve('timeout'), REDIS_QUIT_TIMEOUT_MS).unref()
  })
  const outcome = await Promise.race([
    redis.quit().then(
      () => 'closed' as const,
      () => 'failed' as const,
    ),
    timeout,
  ])
  if (outcome !== 'closed') redis.disconnect()
}

// Sağlık ucu ve sinyal işleyicileri ilk heartbeat'ten önce açılır: Redis erişilemezse süreç sessizce
// takılmaz, /health 503 döner ve kapanış sinyali yine işlenir.
const health = startHealthServer(env.WORKER_HEALTH_PORT, () => state)
if (!redis)
  log.warn('REDIS_QUEUE_URL tanımlı değil: heartbeat yazılmayacak (yalnızca yerel geliştirme)')
void beat()
const timer = setInterval(() => void beat(), HEARTBEAT_INTERVAL_MS)

let jobs: JobsHandle | null = null

const shutdown = async (signal: string) => {
  log.info({ signal }, 'kapanıyor')
  clearInterval(timer)
  health.close()
  await jobs?.close().catch((error: unknown) => log.warn({ err: error }, 'bakım işleri kapanamadı'))
  await database?.sql.end({ timeout: 5 }).catch(() => undefined)
  await closeRedis()
  process.exit(0)
}
process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))
log.info({ roles, version, healthPort: env.WORKER_HEALTH_PORT }, 'worker başladı')

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
