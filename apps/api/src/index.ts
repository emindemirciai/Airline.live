import {
  createDb,
  createRedis,
  pingDb,
  pingRedis,
  readHeartbeats,
  readProviderSummaries,
  redisMemory,
  referenceStatus,
  trackPartitionStatus,
} from '@havayolu/db'
import type { Redis } from 'ioredis'
import { buildApp } from './app'
import { RedisSessionStore } from './auth/session-store'
import { EnvError, loadDotEnvForDevelopment, parseEnv, type Env } from './env'

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
    http: httpJson,
    webUrl: new URL('/api/version', env.WEB_INTERNAL_URL).toString(),
    analyticsUrl: env.ANALYZE_URL ? new URL('/api/health', env.ANALYZE_URL).toString() : null,
    expectedWorkers: env.EXPECTED_WORKERS,
    now: () => new Date(),
  },
  rateLimitRedis: redisQueue,
})

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
    await app.close()
    await Promise.allSettled([
      database?.sql.end({ timeout: 5 }),
      redisQueue?.quit(),
      redisLive?.quit(),
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
