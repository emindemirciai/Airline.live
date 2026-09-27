import {
  createDb,
  createRedis,
  pingDb,
  pingRedis,
  readHeartbeats,
  writeHeartbeat,
} from '@havayolu/db'
import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from './app'
import { RedisSessionStore, SESSION_TTL_SECONDS } from './auth/session-store'
import { ADMIN_EMAIL, ADMIN_SETUP_TOKEN, fakeProbes, testEnv } from './test/helpers'

// Yerelde docker-compose.dev.yml (45432, 46379, 46380), CI'da servis konteynerleri.
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const REDIS_QUEUE_URL =
  process.env.TEST_REDIS_QUEUE_URL ?? 'redis://:queue_dev_only@localhost:46379/1'
const REDIS_LIVE_URL = process.env.TEST_REDIS_LIVE_URL ?? 'redis://:live_dev_only@localhost:46380/1'

const database = createDb(DATABASE_URL, { max: 2 })
const redisQueue = createRedis(REDIS_QUEUE_URL, { name: 'test-queue' })
const redisLive = createRedis(REDIS_LIVE_URL, { name: 'test-live' })

afterAll(async () => {
  await redisQueue.flushdb()
  await Promise.allSettled([database.sql.end({ timeout: 5 }), redisQueue.quit(), redisLive.quit()])
})

describe('gerçek bağımlılıklarla', () => {
  it("RedisSessionStore token'ı hash'li ve 7 gün TTL ile saklar, iptal eder", async () => {
    const store = new RedisSessionStore(redisQueue)
    const { token } = await store.create(ADMIN_EMAIL)
    expect(await store.get(token)).toMatchObject({ email: ADMIN_EMAIL, role: 'ADMIN' })
    const keys = await redisQueue.keys('hy:admin_session:*')
    expect(keys.some((k) => k.includes(token))).toBe(false)
    const ttl = await redisQueue.ttl(keys[0] ?? '')
    expect(ttl).toBeGreaterThan(SESSION_TTL_SECONDS - 10)
    await store.revoke(token)
    expect(await store.get(token)).toBeNull()
  })

  it('heartbeat yazılır ve okunur', async () => {
    await writeHeartbeat(redisQueue, {
      service: 'worker-test',
      roles: ['jobs'],
      version: '0.3.0',
      gitSha: 'abc',
      pid: 1,
      startedAt: new Date().toISOString(),
      at: new Date().toISOString(),
    })
    const heartbeats = await readHeartbeats(redisQueue)
    expect(heartbeats.map((h) => h.service)).toContain('worker-test')
  })

  it('/ready gerçek PostgreSQL ve iki Redis ile 200 döner; giriş + /api/admin/session çalışır', async () => {
    const app = await buildApp(testEnv(), {
      sessionStore: new RedisSessionStore(redisQueue),
      readiness: {
        postgres: () => pingDb(database.sql),
        redisQueue: () => pingRedis(redisQueue),
        redisLive: () => pingRedis(redisLive),
      },
      probes: fakeProbes(),
      rateLimitRedis: redisQueue,
    })
    try {
      const ready = await app.inject({ method: 'GET', url: '/ready' })
      expect(ready.statusCode).toBe(200)
      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: ADMIN_EMAIL, password: ADMIN_SETUP_TOKEN },
      })
      expect(login.statusCode).toBe(200)
      const { token } = login.json() as { token: string }
      const session = await app.inject({
        method: 'GET',
        url: '/api/admin/session',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(session.statusCode).toBe(200)
    } finally {
      await app.close()
    }
  })
})
