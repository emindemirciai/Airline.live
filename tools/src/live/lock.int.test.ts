import { createRedis, LIVE_KEYS } from '@havayolu/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  acquireLiveLock,
  checkLiveLock,
  closeLiveRedis,
  connectLiveRedis,
  LIVE_LAST_KEY,
  LIVE_LOCK_KEY,
  lastLiveRequestAt,
  otherIngestActive,
  refreshLiveLock,
  releaseLiveLock,
  type LiveRedis,
} from './lock'

// Gerçek redis-live (yerelde `pnpm dev:infra`, CI'da dev compose): Lua betikleri gerçek sunucuda
// denenir. Başka testlerle çakışmasın diye adres ne olursa olsun 9 numaralı veritabanı (0 dev,
// 1–3 ve 5 diğer testler, 4 ve 8 smoke entegrasyon testi).
function liveUrl(): string {
  const url = new URL(process.env.TEST_REDIS_LIVE_URL ?? 'redis://:live_dev_only@localhost:46380/3')
  url.pathname = '/9'
  return url.toString()
}

let redis: LiveRedis
const admin = createRedis(liveUrl(), { name: 'tools-lock-test-admin' })
admin.on('error', () => {})

beforeAll(async () => {
  const connected = await connectLiveRedis(
    (url) => createRedis(url, { name: 'tools-lock-test' }),
    liveUrl(),
    3_000,
  )
  if (connected === null) throw new Error('redis-live unreachable (pnpm dev:infra)')
  redis = connected
})

beforeEach(async () => {
  await admin.flushdb()
})

afterAll(async () => {
  await admin.flushdb()
  await closeLiveRedis(redis)
  await admin.quit()
})

describe('kilit betikleri (gerçek Redis)', () => {
  it('SET NX PX, token karşılaştırmalı yenileme ve bırakma', async () => {
    expect(await acquireLiveLock(redis, 'a')).toBe(true)
    expect(await acquireLiveLock(redis, 'b')).toBe(false)
    expect(await admin.pttl(LIVE_LOCK_KEY)).toBeGreaterThan(100_000)
    await admin.pexpire(LIVE_LOCK_KEY, 5_000)
    expect(await refreshLiveLock(redis, 'b')).toBe(false)
    expect(await admin.pttl(LIVE_LOCK_KEY)).toBeLessThanOrEqual(5_000)
    expect(await refreshLiveLock(redis, 'a')).toBe(true)
    expect(await admin.pttl(LIVE_LOCK_KEY)).toBeGreaterThan(100_000)
    await releaseLiveLock(redis, 'b', null)
    expect(await admin.get(LIVE_LOCK_KEY)).toBe('a')
    await releaseLiveLock(redis, 'a', null)
    expect(await admin.exists(LIVE_LOCK_KEY)).toBe(0)
    expect(await admin.exists(LIVE_LAST_KEY)).toBe(0)
    expect(await refreshLiveLock(redis, 'a')).toBe(false)
  })

  it('bırakırken son istek 60 sn yazılır; eskisi yenisinin üstüne yazılmaz', async () => {
    const t = Date.UTC(2026, 9, 4, 12, 0, 0)
    await acquireLiveLock(redis, 'a')
    await releaseLiveLock(redis, 'a', t)
    expect(await lastLiveRequestAt(redis)).toBe(t)
    const ttl = await admin.pttl(LIVE_LAST_KEY)
    expect(ttl).toBeGreaterThan(55_000)
    expect(ttl).toBeLessThanOrEqual(60_000)
    await releaseLiveLock(redis, 'z', t - 10_000)
    expect(await lastLiveRequestAt(redis)).toBe(t)
    await releaseLiveLock(redis, 'z', t + 10_000)
    expect(await lastLiveRequestAt(redis)).toBe(t + 10_000)
  })

  it('başka ingest ve 30 sn denetimi', async () => {
    expect(await otherIngestActive(redis)).toBe(false)
    await acquireLiveLock(redis, 'a')
    expect(await checkLiveLock(redis, 'a')).toBe('held')
    await admin.set(LIVE_KEYS.provider('adsbLol'), '{}', 'EX', 180)
    expect(await otherIngestActive(redis)).toBe(true)
    expect(await checkLiveLock(redis, 'a')).toBe('other_ingest')
    await admin.del(LIVE_LOCK_KEY)
    expect(await checkLiveLock(redis, 'a')).toBe('lost')
  })

  it('ulaşılamayan Redis: kısa sürede null, bağlantı kesilir', async () => {
    const started = Date.now()
    const url = new URL(liveUrl())
    url.port = '1'
    expect(
      await connectLiveRedis(
        (u) => createRedis(u, { name: 'tools-lock-test-unreachable' }),
        url.toString(),
        500,
      ),
    ).toBeNull()
    expect(Date.now() - started).toBeLessThan(3_000)
  })
})
