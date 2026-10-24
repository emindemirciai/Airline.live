import type { Redis } from 'ioredis'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  ADSBLOL_BUDGET_KEYS,
  ADSBLOL_BUDGET_REQUESTS_TTL_MS,
  ADSBLOL_BUDGET_STATE_TTL_MS,
  ADSBLOL_BUDGET_WINDOW_MS,
  readAdsbLolBudget,
  recordAdsbLolRateLimit,
  recordAdsbLolServerLimit,
  reserveAdsbLolRequest,
  type BudgetReservation,
} from './adsblol-budget'
import { createRedis } from './redis'

// Bütçe sayacı redis-queue'dadır (kalıcı, D-122). Başka testlerle çakışmasın diye adres ne olursa
// olsun 9 numaralı veritabanı kullanılır. Saat sahtedir: zaman her çağrıda parametre olarak verilir.
function queueUrl(): string {
  const url = new URL(
    process.env.TEST_REDIS_QUEUE_URL ?? 'redis://:queue_dev_only@localhost:46379/9',
  )
  url.pathname = '/9'
  return url.toString()
}

const DAY = ADSBLOL_BUDGET_WINDOW_MS
const HOUR = 3_600_000
const T0 = Date.UTC(2026, 9, 24, 0, 0, 0)
const CONFIGURED = 480

let redis: Redis
const extra: Redis[] = []

const connect = (name: string) => {
  const client = createRedis(queueUrl(), { name })
  extra.push(client)
  return client
}

beforeAll(async () => {
  redis = createRedis(queueUrl(), { name: 'test-db-adsblol-budget' })
  await redis.flushdb()
})

beforeEach(async () => {
  await redis.flushdb()
})

afterAll(async () => {
  await redis?.flushdb()
  await Promise.allSettled([redis?.quit(), ...extra.map((c) => c.quit())])
})

const reserve = (now: number, client: Redis = redis, configured = CONFIGURED) =>
  reserveAdsbLolRequest(client, { now, configured })

/** Sıralı izin anlarında her kayan 24 saatlik pencerenin (t − 24 sa, t] en çok izin sayısı. */
function maxInWindow(times: readonly number[]): number {
  let max = 0
  let start = 0
  for (let end = 0; end < times.length; end += 1) {
    const t = times[end] as number
    while ((times[start] as number) <= t - DAY) start += 1
    max = Math.max(max, end - start + 1)
  }
  return max
}

const minGap = (times: readonly number[]) =>
  times.slice(1).reduce((m, t, i) => Math.min(m, t - (times[i] as number)), Infinity)

describe('reserveAdsbLolRequest (sahte saat)', () => {
  it('48 saat boyunca 10 sn’de bir istense de: hiçbir 24 saatte 480’i aşmaz, izinler ≥ 180 sn arayla; 13. saatte yeniden başlatma fazladan izin almaz', async () => {
    const restarted = connect('test-db-adsblol-budget-restart')
    const grants: number[] = []
    const seqs: number[] = []
    let last: BudgetReservation | null = null
    for (let t = T0; t < T0 + 48 * HOUR; t += 10_000) {
      // 13. saatte süreç yeniden başlar: yeni bağlantı, yerel durum yok; sayaç Redis'te sürer.
      const client = t >= T0 + 13 * HOUR ? restarted : redis
      const r = await reserve(t, client)
      if (r.granted) {
        grants.push(t)
        seqs.push(r.seq)
        expect(r.retryAt).toBe(t + 180_000)
      } else {
        expect(r.retryAt).toBeGreaterThan(t)
      }
      expect(r.cap).toBe(CONFIGURED)
      expect(r.used).toBeLessThanOrEqual(CONFIGURED)
      last = r
    }
    expect(maxInWindow(grants)).toBeLessThanOrEqual(CONFIGURED)
    expect(maxInWindow(grants)).toBe(CONFIGURED)
    expect(minGap(grants)).toBeGreaterThanOrEqual(180_000)
    expect(grants.length).toBe(960)
    // Sıra kesintisiz artar (yeniden başlatma onu sıfırlamaz).
    expect(seqs).toEqual(Array.from({ length: grants.length }, (_, i) => i + 1))
    expect(last?.used).toBe(CONFIGURED)
  }, 120_000)

  it('aynı anda 20 istek: tam olarak biri izin alır', async () => {
    const clients = [redis, connect('test-db-budget-p1'), connect('test-db-budget-p2')]
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => reserve(T0, clients[i % clients.length])),
    )
    expect(results.filter((r) => r.granted)).toHaveLength(1)
    expect(new Set(results.filter((r) => !r.granted).map((r) => r.decision))).toEqual(
      new Set(['spacing']),
    )
    expect(await redis.zcard(ADSBLOL_BUDGET_KEYS.requests)).toBe(1)
  })

  it('saat geri giderse erken izin yok; aralık son izinden sayılır', async () => {
    expect((await reserve(T0)).granted).toBe(true)
    const back = await reserve(T0 - HOUR)
    expect(back).toMatchObject({ granted: false, decision: 'spacing', retryAt: T0 + 180_000 })
    expect((await reserve(T0 + 179_999)).granted).toBe(false)
    expect((await reserve(T0 + 180_000)).granted).toBe(true)
  })

  it('429: engel süresi tutulur, sınır 432’ye iner (200 sn aralık); 24 saat 429 yoksa geri büyür', async () => {
    expect((await reserve(T0)).granted).toBe(true)
    const t429 = T0 + 180_000
    expect((await reserve(t429)).granted).toBe(true)
    const limited = await recordAdsbLolRateLimit(redis, {
      now: t429,
      configured: CONFIGURED,
      waitMs: 30 * 60_000,
    })
    expect(limited).toEqual({ cap: 432, blockedUntil: t429 + 30 * 60_000 })
    // Daha kısa ikinci bir bekleme engeli kısaltmaz.
    const again = await recordAdsbLolRateLimit(redis, {
      now: t429 + 1_000,
      configured: CONFIGURED,
      waitMs: 5_000,
    })
    expect(again.blockedUntil).toBe(t429 + 30 * 60_000)
    expect(again.cap).toBe(388)
    // Testin geri kalanı tek 429 ile sürer.
    await redis.hset(ADSBLOL_BUDGET_KEYS.state, 'cap', '432')

    const blocked = await reserve(t429 + 10 * 60_000)
    expect(blocked).toMatchObject({
      granted: false,
      decision: 'blocked',
      retryAt: t429 + 30 * 60_000,
      blockedUntil: t429 + 30 * 60_000,
      cap: 432,
    })
    const open = t429 + 30 * 60_000
    const first = await reserve(open)
    expect(first).toMatchObject({ granted: true, cap: 432, retryAt: open + 200_000 })
    expect((await reserve(open + 199_999)).granted).toBe(false)
    expect((await reserve(open + 200_000)).granted).toBe(true)

    // Son 429'dan (t429 + 1 sn) 24 saat sonra sınır %5 (24) büyür; 6 saat sonra bir adım daha,
    // yapılandırılanı aşmaz.
    const quiet = t429 + 1_000 + DAY
    expect((await reserve(quiet - 1)).cap).toBe(432)
    expect((await reserve(quiet)).cap).toBe(456)
    expect((await reserve(quiet + 5 * HOUR)).cap).toBe(456)
    expect((await reserve(quiet + 6 * HOUR)).cap).toBe(CONFIGURED)
    expect((await reserve(quiet + 12 * HOUR)).cap).toBe(CONFIGURED)
  })

  it('kararlı durumda (pencere dolu) 429: engel bitince istek sürer, aralık 200 sn; pencere boşaltılmaz, hiçbir 24 saat 480’i aşmaz', async () => {
    // Worker gibi: her ret `retryAt`'te yeniden sorulur. 30 saat 180 sn arayla (pencerede 480
    // izin).
    const grants: number[] = []
    let t = T0
    while (t < T0 + 30 * HOUR) {
      const r = await reserve(t)
      if (r.granted) grants.push(t)
      t = Math.max(r.retryAt, t + 1_000)
    }
    const t429 = grants.at(-1) as number
    expect(await redis.zcard(ADSBLOL_BUDGET_KEYS.requests)).toBe(CONFIGURED)
    const limited = await recordAdsbLolRateLimit(redis, {
      now: t429,
      configured: CONFIGURED,
      waitMs: 360_000,
    })
    expect(limited).toEqual({ cap: 432, blockedUntil: t429 + 360_000 })

    // 429'dan sonraki 24 saat (sonra sınır geri büyümeye başlar).
    const after: number[] = []
    t = t429 + 1_000
    while (t < t429 + DAY) {
      const r = await reserve(t)
      if (r.granted) {
        after.push(t)
        expect(r.cap).toBe(432)
      } else {
        expect(r.decision, `@${t - t429}`).not.toBe('cap')
      }
      t = Math.max(r.retryAt, t + 1_000)
    }
    // Engel sonunda ilk izin, sonra 200 sn arayla; boşaltma yok (eskiden ~2,4 sa istek yoktu).
    expect(after[0]).toBe(t429 + 360_000)
    expect(after[1]).toBe(t429 + 560_000)
    expect(minGap(after)).toBe(200_000)
    expect(Math.max(...after.slice(1).map((x, i) => x - (after[i] as number)))).toBe(200_000)
    expect(maxInWindow([...grants, ...after])).toBeLessThanOrEqual(CONFIGURED)
    // Daralmış sınır sürerken 429'dan sonraki 24 saat 432 izinle sınırlıdır.
    expect(maxInWindow(after)).toBeLessThanOrEqual(432)
  }, 120_000)

  it('429 daraltması yapılandırılanın %20’sinin (96) altına inmez', async () => {
    let cap = CONFIGURED
    for (let i = 0; i < 40; i += 1) {
      cap = (
        await recordAdsbLolRateLimit(redis, { now: T0 + i, configured: CONFIGURED, waitMs: 1 })
      ).cap
    }
    expect(cap).toBe(96)
  })

  it('sunucu kotası: 500 → 480; daha düşük kota sınırı indirir ve sayı sınırdaysa sert ret', async () => {
    await recordAdsbLolServerLimit(redis, { now: T0, dailyQuota: 500 })
    expect((await reserve(T0, redis, 1_000)).cap).toBe(480)
    expect(await readAdsbLolBudget(redis, { now: T0, configured: 1_000 })).toEqual({
      used: 1,
      cap: 480,
      blockedUntil: null,
      serverDaily: 500,
    })
    // 10 izin daha (aralık kuralını aşmak için saat ilerler).
    const times = [T0]
    for (let i = 1; i <= 9; i += 1) {
      const t = T0 + i * 200_000
      expect((await reserve(t)).granted).toBe(true)
      times.push(t)
    }
    // Sunucu kotası 10'a inerse sınır 9: 10 izin var, ikinci en eski 24 saat dolunca yer açılır.
    await recordAdsbLolServerLimit(redis, { now: T0, dailyQuota: 10 })
    const denied = await reserve(T0 + 10 * 200_000)
    expect(denied).toMatchObject({
      granted: false,
      decision: 'cap',
      cap: 9,
      used: 10,
      retryAt: (times[1] as number) + DAY,
    })
    // Sunucu kotası 0: hiçbir izin yok.
    await recordAdsbLolServerLimit(redis, { now: T0, dailyQuota: 0 })
    expect(await reserve(T0 + 3 * DAY)).toMatchObject({ granted: false, decision: 'no_cap' })
  })

  it('anahtarların TTL’i: istekler 25 sa, sıra ve durum 7 gün', async () => {
    await reserve(T0)
    await recordAdsbLolServerLimit(redis, { now: T0, dailyQuota: 500 })
    const requestsTtl = await redis.pttl(ADSBLOL_BUDGET_KEYS.requests)
    expect(requestsTtl).toBeGreaterThan(ADSBLOL_BUDGET_REQUESTS_TTL_MS - 5_000)
    expect(requestsTtl).toBeLessThanOrEqual(ADSBLOL_BUDGET_REQUESTS_TTL_MS)
    for (const key of [ADSBLOL_BUDGET_KEYS.seq, ADSBLOL_BUDGET_KEYS.state]) {
      const ttl = await redis.pttl(key)
      expect(ttl, key).toBeGreaterThan(ADSBLOL_BUDGET_STATE_TTL_MS - 5_000)
      expect(ttl, key).toBeLessThanOrEqual(ADSBLOL_BUDGET_STATE_TTL_MS)
    }
    // İzin durumu tazeler: TTL 7 günden kısaltılmışsa sonraki izin yeniden uzatır.
    await redis.pexpire(ADSBLOL_BUDGET_KEYS.state, 1_000_000)
    await reserve(T0 + 180_000)
    expect(await redis.pttl(ADSBLOL_BUDGET_KEYS.state)).toBeGreaterThan(
      ADSBLOL_BUDGET_STATE_TTL_MS - 5_000,
    )
  })

  it('geçersiz girdi Redis’e gitmeden reddedilir', async () => {
    await expect(reserveAdsbLolRequest(redis, { now: T0, configured: 0 })).rejects.toThrow(
      RangeError,
    )
    await expect(reserveAdsbLolRequest(redis, { now: T0, configured: 1.5 })).rejects.toThrow(
      RangeError,
    )
    await expect(reserveAdsbLolRequest(redis, { now: -1, configured: 480 })).rejects.toThrow(
      RangeError,
    )
    expect(await redis.exists(ADSBLOL_BUDGET_KEYS.requests)).toBe(0)
  })
})
