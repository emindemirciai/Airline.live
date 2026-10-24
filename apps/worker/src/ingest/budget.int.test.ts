import { createRedis, type BudgetReservation } from '@havayolu/db'
import type { Redis } from 'ioredis'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { BudgetPacer, createRedisBudgetStore, type BudgetStore } from './budget'
import { MemoryBudgetStore } from './test/budget-store'

// Gerçek redis-queue (yerelde `pnpm dev:infra`, CI'da dev compose). Bütçe sayacı başka testlerle
// çakışmasın diye adres ne olursa olsun 8 numaralı veritabanı kullanılır (D-122). Saat sahtedir.
function queueUrl(): string {
  const url = new URL(
    process.env.TEST_REDIS_QUEUE_URL ?? 'redis://:queue_dev_only@localhost:46379/8',
  )
  url.pathname = '/8'
  return url.toString()
}

const T0 = Date.UTC(2026, 9, 24, 0, 0, 0)
const HOUR = 3_600_000
const DAY = 24 * HOUR

let redis: Redis

beforeAll(async () => {
  redis = createRedis(queueUrl(), { name: 'test-worker-budget' })
  await redis.flushdb()
})

beforeEach(async () => {
  await redis.flushdb()
})

afterAll(async () => {
  await redis?.flushdb()
  await redis?.quit()
})

/** Tohumlu sözde rastgele sayı üreteci (Park–Miller); her koşu aynı diziyi üretir. */
function seeded(seed: number) {
  let state = seed % 2_147_483_647
  return () => {
    state = (state * 48_271) % 2_147_483_647
    return state / 2_147_483_647
  }
}

const strip = (r: BudgetReservation) => ({ ...r })

describe('bütçe sayacı: bellek içi test deposu Lua betiğiyle aynı kararı verir', () => {
  it('3 gün boyunca rastgele izin, 429, sunucu kotası ve saat geri adımı', async () => {
    const real = createRedisBudgetStore(redis, 480)
    const fake = new MemoryBudgetStore(480)
    const random = seeded(122)
    let t = T0
    let grants = 0
    const decisions = new Set<string>()
    let ops = 0
    while (t < T0 + 3 * DAY) {
      ops += 1
      const roll = random()
      if (roll < 0.01) {
        const waitMs = Math.floor(random() * 2 * HOUR)
        expect(await real.rateLimited(t, waitMs), `429 @${t - T0}`).toEqual(
          await fake.rateLimited(t, waitMs),
        )
      } else if (roll < 0.02) {
        const quota = [500, 480, 300, 1_000][Math.floor(random() * 4)] ?? 500
        await real.serverLimit(t, quota)
        await fake.serverLimit(t, quota)
      } else {
        // Saat arada bir geri gider (en çok 30 dk).
        const at = roll < 0.03 ? t - Math.floor(random() * 30 * 60_000) : t
        const [a, b] = [await real.reserve(at), await fake.reserve(at)]
        expect(strip(a), `reserve @${at - T0}`).toEqual(strip(b))
        if (a.granted) grants += 1
        decisions.add(a.decision)
      }
      expect(await real.read(t)).toEqual(await fake.read(t))
      t += Math.floor(random() * 400_000)
    }
    // Sert sınır: engel bittikten sonra sunucu kotası 10'a iner (sınır 9), pencere dolu.
    t += 3 * HOUR
    await real.serverLimit(t, 10)
    await fake.serverLimit(t, 10)
    const [a, b] = [await real.reserve(t), await fake.reserve(t)]
    expect(strip(a)).toEqual(strip(b))
    decisions.add(a.decision)
    expect(ops).toBeGreaterThan(1_000)
    expect(grants).toBeGreaterThan(300)
    // Bütün karar yolları sınandı.
    expect([...decisions].sort()).toEqual(['blocked', 'cap', 'granted', 'spacing'])
  }, 120_000)

  it('gerçek sayaçla iki süreç ve yeniden başlatma: 30 saatte hiçbir 24 saat 480’i aşmaz', async () => {
    const store: BudgetStore = createRedisBudgetStore(redis, 480)
    let a = new BudgetPacer(store)
    const b = new BudgetPacer(store)
    const times: number[] = []
    for (let t = T0; t < T0 + 30 * HOUR; t += 5_000) {
      // a süreci saatte bir yeniden başlar (yerel durum yok).
      if ((t - T0) % HOUR === 0) a = new BudgetPacer(store)
      for (const pacer of [a, b]) {
        if (t < pacer.nextAttemptAt()) continue
        const step = await pacer.step(t)
        if (step.kind === 'granted') times.push(t)
      }
    }
    let max = 0
    let start = 0
    for (let end = 0; end < times.length; end += 1) {
      while ((times[start] as number) <= (times[end] as number) - DAY) start += 1
      max = Math.max(max, end - start + 1)
    }
    expect(max).toBe(480)
    const gaps = times.slice(1).map((x, i) => x - (times[i] as number))
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(180_000)
    expect(times).toHaveLength(600)
  }, 120_000)
})
