import { createRedis, LIVE_KEYS } from '@havayolu/db'
import { describe, expect, it } from 'vitest'
import {
  acquireLiveLock,
  checkLiveLock,
  closeLiveRedis,
  connectLiveRedis,
  LIVE_LAST_KEY,
  LIVE_LAST_TTL_MS,
  LIVE_LOCK_KEY,
  LIVE_LOCK_REFRESH_MS,
  LIVE_LOCK_TTL_MS,
  lastLiveRequestAt,
  liveStartNotBefore,
  otherIngestActive,
  refreshLiveLock,
  releaseLiveLock,
  type LiveRedisFactory,
} from './lock'
import { FakeClock, FakeLiveRedis } from './test/adsblol-stub'

// Tip denetimi: @havayolu/db createRedis (ioredis) LiveRedis'i yapısal olarak sağlar. Fonksiyon
// çağrılmaz; bağlantı açılmaz.
const realFactory: LiveRedisFactory = (url) => createRedis(url, { name: 'tools-live' })

function fake() {
  const clock = new FakeClock()
  return { clock, redis: new FakeLiveRedis({ now: clock.now }) }
}

describe('kilit', () => {
  it('sabitler', () => {
    expect(LIVE_LOCK_KEY).toBe('hy:tools:live')
    expect(LIVE_LOCK_TTL_MS).toBe(120_000)
    expect(LIVE_LOCK_REFRESH_MS).toBe(30_000)
    expect(LIVE_LAST_KEY).toBe('hy:tools:live:last')
    expect(LIVE_LAST_TTL_MS).toBe(60_000)
    expect(typeof realFactory).toBe('function')
  })

  it('SET NX PX: ikinci çalışma kilidi alamaz; süre dolunca alır', async () => {
    const { clock, redis } = fake()
    expect(await acquireLiveLock(redis, 'a')).toBe(true)
    expect(await acquireLiveLock(redis, 'b')).toBe(false)
    clock.advance(LIVE_LOCK_TTL_MS - 1)
    expect(await acquireLiveLock(redis, 'b')).toBe(false)
    clock.advance(1)
    expect(await acquireLiveLock(redis, 'b')).toBe(true)
  })

  it('yenileme yalnızca sahibin token’ıyla ve süreyi uzatır', async () => {
    const { clock, redis } = fake()
    await acquireLiveLock(redis, 'a')
    clock.advance(100_000)
    expect(await refreshLiveLock(redis, 'b')).toBe(false)
    expect(await refreshLiveLock(redis, 'a')).toBe(true)
    clock.advance(100_000)
    expect(redis.peek(LIVE_LOCK_KEY)).toBe('a')
    clock.advance(20_000)
    expect(await refreshLiveLock(redis, 'a')).toBe(false)
  })

  it('bırakma yalnızca sahibin kilidini siler ve son isteği 60 sn yazar', async () => {
    const { clock, redis } = fake()
    await acquireLiveLock(redis, 'a')
    await releaseLiveLock(redis, 'b', null)
    expect(redis.peek(LIVE_LOCK_KEY)).toBe('a')
    expect(redis.peek(LIVE_LAST_KEY)).toBeNull()
    await releaseLiveLock(redis, 'a', clock.now() - 2_000)
    expect(redis.peek(LIVE_LOCK_KEY)).toBeNull()
    expect(redis.peek(LIVE_LAST_KEY)).toBe(String(clock.now() - 2_000))
    // Daha eski bir değer yenisinin üstüne yazılmaz.
    await releaseLiveLock(redis, 'x', clock.now() - 9_000)
    expect(await lastLiveRequestAt(redis)).toBe(clock.now() - 2_000)
    clock.advance(LIVE_LAST_TTL_MS)
    expect(await lastLiveRequestAt(redis)).toBeNull()
  })

  it('bozuk son istek değeri null', async () => {
    const { redis } = fake()
    redis.seed(LIVE_LAST_KEY, 'abc')
    expect(await lastLiveRequestAt(redis)).toBeNull()
    redis.seed(LIVE_LAST_KEY, '0')
    expect(await lastLiveRequestAt(redis)).toBeNull()
  })

  it('ilk isteğin en erken anı: son + 1000/rps, gelecekteki bozuk değer sınırlı', () => {
    const now = 1_000_000
    expect(liveStartNotBefore(null, 0.1, now)).toBe(now)
    expect(liveStartNotBefore(now - 4_000, 0.1, now)).toBe(now + 6_000)
    expect(liveStartNotBefore(now - 30_000, 0.1, now)).toBe(now)
    expect(liveStartNotBefore(now - 1_000, 0.2, now)).toBe(now + 4_000)
    expect(liveStartNotBefore(now + 10 ** 9, 0.1, now)).toBe(now + LIVE_LAST_TTL_MS + 10_000)
  })

  it('başka ingest: hy:provider:adsbLol var mı', async () => {
    const { clock, redis } = fake()
    expect(await otherIngestActive(redis)).toBe(false)
    redis.seed(LIVE_KEYS.provider('adsbLol'), '{}', 180_000)
    expect(await otherIngestActive(redis)).toBe(true)
    clock.advance(180_000)
    expect(await otherIngestActive(redis)).toBe(false)
  })

  it('30 sn denetimi: held, lost ya da other_ingest', async () => {
    const { redis } = fake()
    await acquireLiveLock(redis, 'a')
    expect(await checkLiveLock(redis, 'a')).toBe('held')
    redis.seed(LIVE_KEYS.provider('adsbLol'), '{}', 180_000)
    expect(await checkLiveLock(redis, 'a')).toBe('other_ingest')
    expect(await checkLiveLock(redis, 'b')).toBe('lost')
  })
})

describe('bağlantı', () => {
  it('PING yanıt verirse istemci döner ve hata dinleyicisi bağlıdır', async () => {
    const redis = new FakeLiveRedis()
    const connected = await connectLiveRedis(() => redis, 'redis://localhost:46380/0', 1_000)
    expect(connected).toBe(redis)
    expect(redis.errorListeners).toBe(1)
    await closeLiveRedis(connected)
    expect(redis.quitCalls).toBe(1)
    expect(redis.isOpen()).toBe(false)
  })

  it('PING hata verir ya da hiç yanıt vermezse bağlantı kesilir ve null döner', async () => {
    for (const ping of ['error', 'never'] as const) {
      const redis = new FakeLiveRedis({ ping })
      const started = Date.now()
      expect(await connectLiveRedis(() => redis, 'redis://localhost:1/0', 50)).toBeNull()
      expect(Date.now() - started).toBeLessThan(2_000)
      expect(redis.disconnectCalls).toBe(1)
      expect(redis.isOpen()).toBe(false)
      expect(redis.errorListeners).toBe(1)
    }
  })

  it('istemci kurulamazsa null', async () => {
    const factory: LiveRedisFactory = () => {
      throw new Error('ERR invalid url')
    }
    expect(await connectLiveRedis(factory, 'redis://x', 50)).toBeNull()
  })

  it('QUIT başarısızsa disconnect; null istemci sorun değil', async () => {
    const redis = new FakeLiveRedis()
    redis.disconnect()
    await closeLiveRedis(redis)
    expect(redis.quitCalls).toBe(1)
    expect(redis.disconnectCalls).toBe(2)
    await expect(closeLiveRedis(null)).resolves.toBeUndefined()
  })
})
