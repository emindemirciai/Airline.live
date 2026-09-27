// Yalnızca testlerde kullanılan yardımcılar (üretim kodu bunları import edemez).
import { REFERENCE_SOURCES, TRACK_TABLES } from '@havayolu/db'
import { buildApp, type AppDeps } from '../app'
import type { ServiceProbes } from '../admin/services'
import { hashToken, newToken, type AdminSession, type SessionStore } from '../auth/session-store'
import { parseEnv } from '../env'

/** Süreç içi oturum deposu (test ikamesi). Redis sürümü integration testinde denenir. */
export class InMemorySessionStore implements SessionStore {
  readonly sessions = new Map<string, AdminSession>()

  async create(email: string) {
    const token = newToken()
    this.sessions.set(hashToken(token), {
      email,
      role: 'ADMIN',
      createdAt: new Date().toISOString(),
    })
    return { token, expiresInSeconds: 604_800 }
  }

  async get(token: string) {
    return this.sessions.get(hashToken(token)) ?? null
  }

  async revoke(token: string) {
    this.sessions.delete(hashToken(token))
  }
}

export const ADMIN_EMAIL = 'yonetici@example.com'
export const ADMIN_SETUP_TOKEN = 'kurulum-anahtari-en-az-otuz-iki-karakter-uzun'

export function testEnv(overrides: Record<string, string> = {}) {
  return parseEnv({
    APP_ENV: 'test',
    LOG_LEVEL: 'silent',
    GIT_SHA: 'abc1234',
    ADMIN_EMAIL,
    ADMIN_SETUP_TOKEN,
    ...overrides,
  })
}

export function fakeProbes(overrides: Partial<Omit<ServiceProbes, 'api'>> = {}) {
  const now = new Date('2026-09-25T12:00:00Z')
  const probes: Omit<ServiceProbes, 'api'> = {
    postgres: async () => ({ latencyMs: 3 }),
    redisQueue: async () => ({
      latencyMs: 1,
      usedBytes: 10 * 1024 * 1024,
      maxBytes: 128 * 1024 * 1024,
    }),
    redisLive: async () => ({
      latencyMs: 1,
      usedBytes: 20 * 1024 * 1024,
      maxBytes: 192 * 1024 * 1024,
    }),
    heartbeats: async () => [
      {
        service: 'worker-rt',
        roles: ['ingest', 'engine'],
        version: '0.3.0',
        gitSha: 'abc1234',
        pid: 1,
        startedAt: '2026-09-25T11:00:00Z',
        at: '2026-09-25T11:59:50Z',
      },
      {
        service: 'worker-bg',
        roles: ['notifier', 'jobs'],
        version: '0.3.0',
        gitSha: 'abc1234',
        pid: 2,
        startedAt: '2026-09-25T11:00:00Z',
        at: '2026-09-25T11:59:55Z',
      },
    ],
    referenceData: async () => ({
      airports: 6347,
      runways: 7977,
      airlines: 5964,
      sources: REFERENCE_SOURCES.map((source) => ({
        source,
        origin: 'remote',
        etag: '"etag"',
        lastModified: null,
        checkedAt: new Date('2026-09-25T04:40:00Z'),
        importedAt: new Date('2026-09-25T04:40:00Z'),
        rowCount: 1,
        skippedCount: 0,
        lastError: null,
        lastErrorAt: null,
        updatedAt: new Date('2026-09-25T04:40:00Z'),
      })),
    }),
    trackPartitions: async () =>
      Object.fromEntries(
        TRACK_TABLES.map((table) => [
          table,
          {
            partitions: 9,
            oldestDay: '2026-09-24',
            newestDay: '2026-10-02',
            daysAhead: 7,
            defaultRows: 0,
          },
        ]),
      ),
    http: async (url: string) => ({
      status: 200,
      body: url.includes('health') ? { status: 'ok' } : { version: '0.3.0' },
      latencyMs: 5,
    }),
    webUrl: 'http://web.test/api/version',
    analyticsUrl: null,
    expectedWorkers: ['worker-rt', 'worker-bg'],
    now: () => now,
    ...overrides,
  }
  return probes
}

export async function testApp(
  options: { env?: Record<string, string>; deps?: Partial<AppDeps> } = {},
) {
  const store = new InMemorySessionStore()
  const app = await buildApp(testEnv(options.env), {
    sessionStore: store,
    readiness: { postgres: async () => 1, redisQueue: async () => 1, redisLive: async () => 1 },
    probes: fakeProbes(),
    rateLimitRedis: null,
    ...options.deps,
  })
  return { app, store }
}

export async function login(app: Awaited<ReturnType<typeof testApp>>['app']) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: ADMIN_EMAIL, password: ADMIN_SETUP_TOKEN },
  })
  return (res.json() as { token: string }).token
}
