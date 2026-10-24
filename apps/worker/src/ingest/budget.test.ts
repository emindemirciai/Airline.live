import { ADSBLOL_BUDGET_WINDOW_MS } from '@havayolu/db'
import { describe, expect, it } from 'vitest'
import {
  budgetCircle,
  BudgetPacer,
  BudgetPermit,
  BudgetPermitError,
  budgetPlan,
  budgetSlotMs,
  budgetStatusWindowMs,
  BUDGET_STORE_RETRY_MS,
  LIVE_TTL_MAX_MS,
  LIVE_TTL_MIN_MS,
  liveTtlMsForSlot,
  rateLimitWaitMs,
} from './budget'
import { coveragePlan, type PlannedCircle, type StationInput } from './plan'
import { MemoryBudgetStore } from './test/budget-store'

const DAY = ADSBLOL_BUDGET_WINDOW_MS
const HOUR = 3_600_000
const T0 = Date.UTC(2026, 9, 24, 0, 0, 0)

const station = (icao: string, lat: number, lon: number, extra: Partial<StationInput> = {}) => ({
  icao,
  lat,
  lon,
  fetchRadiusNm: 60,
  isPrimary: false,
  ...extra,
})

/** Tohum istasyonlar (CLAUDE.md): IST birincil, SAW, ESB, ADB, AYT. */
const SEED: StationInput[] = [
  station('LTFM', 41.274874, 28.732136, { isPrimary: true }),
  station('LTFJ', 40.898602, 29.3092),
  station('LTAC', 40.128101, 32.995098),
  station('LTBJ', 38.2924, 27.157),
  station('LTAI', 36.898701, 30.800501),
]
const PLAN = budgetPlan(coveragePlan(SEED))

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

const gaps = (times: readonly number[]) => times.slice(1).map((t, i) => t - (times[i] as number))

interface Grant {
  at: number
  seq: number
  circle: PlannedCircle['kind']
  cap: number
}

/**
 * Bütçe döngüsünün benzetimi (ingest `budgetLoop` gibi): sahte saat `tickMs`'de bir ilerler,
 * süreç yerel beklemesi dolmadan izin istemez. `restarts` anlarında süreç yeniden başlar (yeni
 * `BudgetPacer`, yerel durum yok; sayaç depoda sürer). `respond` izin alınan isteğin yanıtıdır:
 * `rate_limit` dönerse döngü gibi depoya 429 yazılır ve süreç bekler.
 */
async function simulate(opts: {
  store: MemoryBudgetStore
  hours: number
  tickMs?: number
  restarts?: readonly number[]
  respond?: (at: number, grant: Grant) => 'success' | 'rate_limit'
}): Promise<Grant[]> {
  const tick = opts.tickMs ?? 1_000
  const restarts = [...(opts.restarts ?? [])].sort((a, b) => a - b)
  let pacer = new BudgetPacer(opts.store)
  const grants: Grant[] = []
  for (let t = T0; t < T0 + opts.hours * HOUR; t += tick) {
    while (restarts.length > 0 && (restarts[0] as number) <= t) {
      restarts.shift()
      pacer = new BudgetPacer(opts.store)
    }
    if (t < pacer.nextAttemptAt()) continue
    const step = await pacer.step(t)
    if (step.kind !== 'granted') continue
    const circle = budgetCircle(step.reservation.seq, PLAN)
    if (circle === null) throw new Error('budget plan is empty')
    const grant = {
      at: t,
      seq: step.reservation.seq,
      circle: circle.kind,
      cap: step.reservation.cap,
    }
    grants.push(grant)
    if (opts.respond?.(t, grant) === 'rate_limit') {
      const waitMs = rateLimitWaitMs({
        retryAfterSec: null,
        resetS: null,
        slotMs: budgetSlotMs(grant.cap),
      })
      pacer.holdUntil(t + waitMs)
      await opts.store.rateLimited(t, waitMs)
    }
  }
  return grants
}

describe('bütçe modunun saf yardımcıları (D-122)', () => {
  it('plan: yalnız Batı ve Doğu; sıra B B D, Batı yoksa Doğu', () => {
    expect(PLAN.map((c) => c.id)).toEqual(['west', 'east'])
    expect([1, 2, 3, 4, 5, 6].map((seq) => budgetCircle(seq, PLAN)?.kind)).toEqual([
      'west',
      'west',
      'east',
      'west',
      'west',
      'east',
    ])
    const eastOnly = PLAN.filter((c) => c.kind === 'east')
    expect(budgetCircle(1, eastOnly)?.kind).toBe('east')
    expect(
      budgetCircle(
        3,
        PLAN.filter((c) => c.kind === 'west'),
      )?.kind,
    ).toBe('west')
    expect(budgetCircle(1, [])).toBeNull()
    // Batıya sığmayan istasyonların çemberleri de atlanır.
    const withVan = coveragePlan([...SEED, station('LTCI', 38.4682, 43.3323)])
    expect(withVan.some((c) => c.kind === 'station')).toBe(true)
    expect(budgetPlan(withVan).map((c) => c.kind)).toEqual(['west', 'east'])
  })

  it('slot, canlı kayıt ömrü ve durum penceresi: 480 → 180 sn, 660 sn, 420 sn', () => {
    expect(budgetSlotMs(480)).toBe(180_000)
    expect(budgetSlotMs(432)).toBe(200_000)
    expect(budgetSlotMs(500)).toBe(172_800)
    expect(budgetSlotMs(0)).toBe(DAY)
    expect(liveTtlMsForSlot(180_000)).toBe(660_000)
    expect(liveTtlMsForSlot(200_000)).toBe(720_000)
    expect(liveTtlMsForSlot(0)).toBe(LIVE_TTL_MIN_MS)
    expect(liveTtlMsForSlot(1_000)).toBe(180_000)
    // Taban sınırda (96/gün → 900 sn slot) ömür 1800 sn'de kırpılır.
    expect(liveTtlMsForSlot(budgetSlotMs(96))).toBe(LIVE_TTL_MAX_MS)
    expect(budgetStatusWindowMs(180_000)).toBe(420_000)
    expect(budgetStatusWindowMs(budgetSlotMs(96))).toBe(1_860_000)
    expect(budgetStatusWindowMs(DAY)).toBe(3_600_000)
  })

  it('ömür Doğu’nun iki sorgusu arasını ve Batı’da kaçan bir isteği karşılar', () => {
    const slot = budgetSlotMs(480)
    const ttl = liveTtlMsForSlot(slot)
    const sampleAge = 60_000
    // Doğu: 3 slot arayla sorgulanır.
    expect(3 * slot + sampleAge).toBeLessThan(ttl)
    // Batı: en uzun ara 2 slot; bir istek kaçarsa (hata) bir slot daha.
    expect(2 * slot + slot + sampleAge).toBeLessThan(ttl)
  })

  it('429 beklemesi: Retry-After ve sıfırlamanın büyüğü (en fazla 24 sa), en az 2 slot', () => {
    const slotMs = 180_000
    expect(rateLimitWaitMs({ retryAfterSec: null, resetS: null, slotMs })).toBe(360_000)
    expect(rateLimitWaitMs({ retryAfterSec: 30, resetS: null, slotMs })).toBe(360_000)
    expect(rateLimitWaitMs({ retryAfterSec: 300, resetS: 1_800, slotMs })).toBe(1_800_000)
    expect(rateLimitWaitMs({ retryAfterSec: 900, resetS: 1, slotMs })).toBe(900_000)
    expect(rateLimitWaitMs({ retryAfterSec: null, resetS: 3 * 86_400, slotMs })).toBe(DAY)
    expect(rateLimitWaitMs({ retryAfterSec: -5, resetS: Number.NaN, slotMs })).toBe(360_000)
  })

  it('izin: yalnız verildikten sonra bir kez harcanır; geri alınan izin harcanamaz', () => {
    const permit = new BudgetPermit()
    expect(() => permit.consume()).toThrow(BudgetPermitError)
    permit.grant()
    permit.grant()
    expect(() => permit.consume()).not.toThrow()
    expect(() => permit.consume()).toThrow(BudgetPermitError)
    permit.grant()
    permit.revoke()
    expect(() => permit.consume()).toThrow(BudgetPermitError)
  })
})

describe('bütçe döngüsü benzetimi (sahte saat, bellek içi sayaç)', () => {
  it('48 saat: hiçbir 24 saatte 480’i aşmaz, istekler 180 sn arayla, Batı:Doğu = 2:1', async () => {
    const store = new MemoryBudgetStore(480)
    const grants = await simulate({ store, hours: 48 })
    const times = grants.map((g) => g.at)
    expect(maxInWindow(times)).toBe(480)
    expect(new Set(gaps(times))).toEqual(new Set([180_000]))
    expect(grants).toHaveLength(960)
    const west = grants.filter((g) => g.circle === 'west').length
    const east = grants.filter((g) => g.circle === 'east').length
    expect(west).toBe(640)
    expect(east).toBe(320)
    // Doğu üç slotta bir; Batı'nın iki sorgusu arası 1 ya da 2 slot.
    const eastGaps = gaps(grants.filter((g) => g.circle === 'east').map((g) => g.at))
    expect(new Set(eastGaps)).toEqual(new Set([540_000]))
    const westGaps = gaps(grants.filter((g) => g.circle === 'west').map((g) => g.at))
    expect(new Set(westGaps)).toEqual(new Set([180_000, 360_000]))
    // Reddedilen denemeler azdır: süreç retryAt'e kadar sormaz.
    expect(store.calls).toBeLessThan(grants.length * 2)
  })

  it('yeniden başlatma (13. saatte bir kez ve 7 dk’da bir) fazladan izin almaz, B B D sırası sürer', async () => {
    const restarts = [T0 + 13 * HOUR]
    for (let t = T0 + 20 * HOUR; t < T0 + 30 * HOUR; t += 7 * 60_000) restarts.push(t)
    const store = new MemoryBudgetStore(480)
    const grants = await simulate({ store, hours: 48, restarts })
    const times = grants.map((g) => g.at)
    expect(maxInWindow(times)).toBeLessThanOrEqual(480)
    expect(Math.min(...gaps(times))).toBeGreaterThanOrEqual(180_000)
    expect(grants).toHaveLength(960)
    expect(grants.map((g) => g.seq)).toEqual(grants.map((_, i) => i + 1))
    expect(grants.filter((g) => g.circle === 'east')).toHaveLength(320)
  })

  it('iki süreç aynı sayacı paylaşır (yayın sırasında eski ve yeni konteyner): toplam yine 480', async () => {
    const store = new MemoryBudgetStore(480)
    const a = new BudgetPacer(store)
    const b = new BudgetPacer(store)
    const times: number[] = []
    for (let t = T0; t < T0 + 30 * HOUR; t += 1_000) {
      for (const pacer of [a, b]) {
        if (t < pacer.nextAttemptAt()) continue
        const step = await pacer.step(t)
        if (step.kind === 'granted') times.push(t)
      }
    }
    expect(maxInWindow(times)).toBe(480)
    expect(Math.min(...gaps(times))).toBeGreaterThanOrEqual(180_000)
  })

  it('429: sınır 432’ye iner, aralık 200 sn olur; 24 saat 429 yoksa geri büyür; hiçbir pencere sınırı aşmaz', async () => {
    const store = new MemoryBudgetStore(480)
    let limited = false
    const grants = await simulate({
      store,
      hours: 60,
      // 5. saatteki ilk istek 429 alır (aynı IP'yi kullanan başka bir istemci).
      respond: (at) => {
        if (!limited && at >= T0 + 5 * HOUR) {
          limited = true
          return 'rate_limit'
        }
        return 'success'
      },
    })
    const first429 = grants.find((g) => g.at >= T0 + 5 * HOUR)
    expect(first429).toBeDefined()
    const after = grants.filter((g) => g.at > (first429?.at ?? 0))
    // 429'dan sonra en az 2 slot (360 sn) beklenir, sonra 200 sn arayla.
    expect((after[0]?.at ?? 0) - (first429?.at ?? 0)).toBeGreaterThanOrEqual(360_000)
    expect(after[0]?.cap).toBe(432)
    const nextDay = after.filter((g) => g.at < (first429?.at ?? 0) + DAY)
    expect(Math.min(...gaps(nextDay.map((g) => g.at)))).toBeGreaterThanOrEqual(200_000)
    // 24 saat 429 yok: 456, 6 saat sonra 480.
    const caps = [...new Set(after.map((g) => g.cap))]
    expect(caps).toEqual([432, 456, 480])
    const times = grants.map((g) => g.at)
    expect(maxInWindow(times)).toBeLessThanOrEqual(480)
    // Daralmış sınır sürerken, 429'dan sonra başlayan hiçbir 24 saatlik pencere 432'yi aşmaz.
    expect(maxInWindow(nextDay.map((g) => g.at))).toBeLessThanOrEqual(432)
  })

  it('sayaç erişilemezse istek yok; 5 sn sonra yeniden sorulur', async () => {
    const store = new MemoryBudgetStore(480)
    const pacer = new BudgetPacer(store)
    store.failing = true
    const step = await pacer.step(T0)
    expect(step).toMatchObject({ kind: 'error', untilMs: T0 + BUDGET_STORE_RETRY_MS })
    expect(pacer.nextAttemptAt()).toBe(T0 + BUDGET_STORE_RETRY_MS)
    expect(await pacer.step(T0 + 1_000)).toMatchObject({ kind: 'wait', decision: 'local' })
    store.failing = false
    expect(await pacer.step(T0 + BUDGET_STORE_RETRY_MS)).toMatchObject({ kind: 'granted' })
    expect(store.requests).toHaveLength(1)
  })

  it('holdUntil yerel beklemeyi yalnız uzatır', async () => {
    const pacer = new BudgetPacer(new MemoryBudgetStore(480))
    await pacer.step(T0)
    expect(pacer.nextAttemptAt()).toBe(T0 + 180_000)
    pacer.holdUntil(T0 + 60_000)
    expect(pacer.nextAttemptAt()).toBe(T0 + 180_000)
    pacer.holdUntil(T0 + 3_600_000)
    expect(pacer.nextAttemptAt()).toBe(T0 + 3_600_000)
  })
})
