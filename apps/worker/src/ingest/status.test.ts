import { describe, expect, it } from 'vitest'
import type { OutcomeKind } from './rate'
import {
  FRESHNESS_TARGET_PRIMARY_MS,
  FreshnessTracker,
  HourlyCounter,
  ProviderStatusTracker,
  STATUS_WINDOW_MS,
} from './status'

const T0 = 1_790_000_000_000
const healthy = { circuitOpen: false, primaryFreshnessMs: 5_000 }

function tracker(outcomes: readonly OutcomeKind[], at = T0) {
  const t = new ProviderStatusTracker()
  outcomes.forEach((o, i) => t.record(at + i, o))
  return t
}

describe('ProviderStatusTracker', () => {
  it('sabitler: 60 sn pencere, birincil hedef 20 sn', () => {
    expect(STATUS_WINDOW_MS).toBe(60_000)
    expect(FRESHNESS_TARGET_PRIMARY_MS).toBe(20_000)
  })

  it('hiç istek yokken down (başarılı yanıt yok); sayaçlar sıfır, oran null', () => {
    const t = new ProviderStatusTracker()
    expect(t.status(T0, healthy)).toEqual({ status: 'down', reason: 'no_success' })
    expect(t.counters(T0)).toEqual({
      requests: 0,
      successes: 0,
      rateLimited: 0,
      serverErrors: 0,
      networkErrors: 0,
      otherErrors: 0,
      errorRatio: null,
    })
  })

  it('60 sn içinde başarılı yanıt varsa ok; 60 sn dolunca down', () => {
    const t = tracker(['success'])
    expect(t.status(T0, healthy)).toEqual({ status: 'ok', reason: null })
    expect(t.status(T0 + 59_999, healthy)).toEqual({ status: 'ok', reason: null })
    expect(t.status(T0 + 60_000, healthy)).toEqual({ status: 'down', reason: 'no_success' })
  })

  it("devre açıksa başarı olsa da down; down degraded'dan önce gelir", () => {
    const t = tracker(['success', 'rate_limit', 'rate_limit'])
    expect(t.status(T0 + 10, { circuitOpen: true, primaryFreshnessMs: 90_000 })).toEqual({
      status: 'down',
      reason: 'circuit_open',
    })
    const onlyErrors = tracker(['rate_limit', 'server', 'rate_limit'])
    expect(onlyErrors.status(T0 + 10, { circuitOpen: false, primaryFreshnessMs: 90_000 })).toEqual({
      status: 'down',
      reason: 'no_success',
    })
  })

  it('hata oranı: pay 429/420 + 5xx, payda bütün istekler; > %20 degraded', () => {
    // 1/5 = %20: eşik aşılmadı.
    const atLimit = tracker(['success', 'success', 'success', 'success', 'rate_limit'])
    expect(atLimit.counters(T0 + 10).errorRatio).toBeCloseTo(0.2, 12)
    expect(atLimit.status(T0 + 10, healthy)).toEqual({ status: 'ok', reason: null })
    // 2/6 ≈ %33.
    const over = tracker(['success', 'success', 'success', 'success', 'rate_limit', 'server'])
    expect(over.status(T0 + 10, healthy)).toEqual({ status: 'degraded', reason: 'error_ratio' })
  })

  it('ağ hatası ve bozuk yanıt oranın payına girmez ama paydaya girer', () => {
    const t = tracker(['success', 'network', 'network', 'response', 'request', 'server'])
    const c = t.counters(T0 + 10)
    expect(c).toEqual({
      requests: 6,
      successes: 1,
      rateLimited: 0,
      serverErrors: 1,
      networkErrors: 2,
      otherErrors: 2,
      errorRatio: 1 / 6,
    })
    expect(t.status(T0 + 10, healthy)).toEqual({ status: 'ok', reason: null })
  })

  it('401/403 (config) diğer hatalara sayılır', () => {
    const c = tracker(['config']).counters(T0)
    expect(c.otherErrors).toBe(1)
    expect(c.requests).toBe(1)
  })

  it('birincil tazelik > hedef × 2 (40 sn) degraded; null ise etkisiz', () => {
    const t = tracker(['success'])
    const at = (primaryFreshnessMs: number | null) =>
      t.status(T0 + 1, { circuitOpen: false, primaryFreshnessMs })
    expect(at(40_000)).toEqual({ status: 'ok', reason: null })
    expect(at(40_001)).toEqual({ status: 'degraded', reason: 'freshness' })
    expect(at(null)).toEqual({ status: 'ok', reason: null })
  })

  it('hata oranı nedeni tazelikten önce yazılır', () => {
    const t = tracker(['success', 'rate_limit'])
    expect(t.status(T0 + 5, { circuitOpen: false, primaryFreshnessMs: 60_000 })).toEqual({
      status: 'degraded',
      reason: 'error_ratio',
    })
  })

  it("kayan pencere: 60 sn'den eski hatalar oranı etkilemez", () => {
    const t = new ProviderStatusTracker()
    for (let i = 0; i < 6; i += 1) t.record(T0 + i * 1_000, 'rate_limit')
    for (let i = 0; i < 6; i += 1) t.record(T0 + 30_000 + i * 10_000, 'success')
    // T0 + 80 sn: pencere (T0+20 sn, T0+80 sn]; 429'lar düştü.
    const now = T0 + 80_000
    expect(t.counters(now)).toMatchObject({ requests: 6, successes: 6, rateLimited: 0 })
    expect(t.status(now, healthy)).toEqual({ status: 'ok', reason: null })
    // T0 + 60 sn: pencere (T0, T0+60 sn]; T0'daki 429 düştü, 5'i kaldı → 5/8.
    const t2 = new ProviderStatusTracker()
    for (let i = 0; i < 6; i += 1) t2.record(T0 + i * 1_000, 'rate_limit')
    for (let i = 0; i < 3; i += 1) t2.record(T0 + 30_000 + i * 10_000, 'success')
    expect(t2.counters(T0 + 60_000)).toMatchObject({
      requests: 8,
      rateLimited: 5,
      errorRatio: 5 / 8,
    })
  })

  it('bütçe modu (D-122): 420 sn pencere; başarı varsa limited, tazelik kuralı yok', () => {
    const budget = (primaryFreshnessMs: number | null) => ({
      circuitOpen: false,
      primaryFreshnessMs,
      budgetWindowMs: 420_000,
    })
    const t = new ProviderStatusTracker({ retainMs: 3_600_000 })
    t.record(T0, 'success')
    // 60 sn'lik pencerede başarı yok sayılırdı (down); bütçe penceresinde var.
    expect(t.status(T0 + 180_000, healthy)).toEqual({ status: 'down', reason: 'no_success' })
    expect(t.status(T0 + 180_000, budget(360_000))).toEqual({ status: 'limited', reason: 'budget' })
    expect(t.status(T0 + 419_999, budget(null))).toEqual({ status: 'limited', reason: 'budget' })
    expect(t.status(T0 + 420_000, budget(null))).toEqual({ status: 'down', reason: 'no_success' })
    expect(t.counters(T0 + 180_000, 420_000)).toMatchObject({ requests: 1, successes: 1 })
    expect(t.counters(T0 + 180_000)).toMatchObject({ requests: 0 })
  })

  it('bütçe modu: devre açık down, pencerede hata oranı > %20 degraded', () => {
    const budget = { circuitOpen: false, primaryFreshnessMs: null, budgetWindowMs: 420_000 }
    const t = new ProviderStatusTracker({ retainMs: 3_600_000 })
    t.record(T0, 'success')
    t.record(T0 + 180_000, 'success')
    expect(t.status(T0 + 200_000, { ...budget, circuitOpen: true })).toEqual({
      status: 'down',
      reason: 'circuit_open',
    })
    t.record(T0 + 360_000, 'rate_limit')
    // 1/3 > %20.
    expect(t.status(T0 + 370_000, budget)).toEqual({ status: 'degraded', reason: 'error_ratio' })
    // Pencere kayınca ilk başarı düşer: 1 başarı + 1 429 = %50, hâlâ degraded.
    expect(t.status(T0 + 430_000, budget)).toEqual({ status: 'degraded', reason: 'error_ratio' })
    t.record(T0 + 540_000, 'success')
    t.record(T0 + 720_000, 'success')
    t.record(T0 + 900_000, 'success')
    // Pencere (T0 + 481 sn, T0 + 901 sn]: 429 çıktı, yalnız 3 başarı kaldı.
    expect(t.status(T0 + 901_000, budget)).toEqual({ status: 'limited', reason: 'budget' })
  })

  it('olaylar tutma süresi kadar saklanır; tutma pencereden kısa olamaz', () => {
    const t = new ProviderStatusTracker({ retainMs: 600_000 })
    t.record(T0, 'success')
    expect(t.counters(T0 + 599_999, 3_600_000)).toMatchObject({ requests: 1 })
    expect(t.counters(T0 + 600_000, 3_600_000)).toMatchObject({ requests: 0 })
    const short = new ProviderStatusTracker({ windowMs: 60_000, retainMs: 1_000 })
    short.record(T0, 'success')
    expect(short.status(T0 + 59_999, healthy)).toEqual({ status: 'ok', reason: null })
  })

  it('sıra dışı gelen kayıt doğru yere yerleşir', () => {
    const t = new ProviderStatusTracker()
    t.record(T0 + 50_000, 'success')
    t.record(T0 + 1_000, 'server')
    t.record(T0 + 30_000, 'rate_limit')
    expect(t.counters(T0 + 61_000)).toMatchObject({ requests: 2, successes: 1, rateLimited: 1 })
    expect(t.counters(T0 + 91_000)).toMatchObject({ requests: 1, successes: 1 })
  })

  it('ayarlar: pencere, oran eşiği ve tazelik hedefi', () => {
    const t = new ProviderStatusTracker({
      windowMs: 10_000,
      degradedErrorRatio: 0.5,
      freshnessTargetMs: 5_000,
    })
    t.record(T0, 'success')
    t.record(T0 + 1, 'server')
    expect(t.status(T0 + 2, { circuitOpen: false, primaryFreshnessMs: 10_000 })).toEqual({
      status: 'ok',
      reason: null,
    })
    expect(t.status(T0 + 2, { circuitOpen: false, primaryFreshnessMs: 10_001 })).toEqual({
      status: 'degraded',
      reason: 'freshness',
    })
    t.record(T0 + 2, 'rate_limit')
    expect(t.status(T0 + 3, healthy).reason).toBe('error_ratio')
    expect(t.status(T0 + 10_000, healthy)).toEqual({ status: 'down', reason: 'no_success' })
    expect(() => new ProviderStatusTracker({ windowMs: 0 })).toThrow(RangeError)
    expect(() => new ProviderStatusTracker({ freshnessTargetMs: -1 })).toThrow(RangeError)
  })

  it('bellek sınırlı: pencere dışı kayıtlar atılır', () => {
    const t = new ProviderStatusTracker()
    for (let i = 0; i < 10_000; i += 1) t.record(T0 + i * 1_000, 'success')
    expect(t.counters(T0 + 9_999 * 1_000).requests).toBe(60)
  })
})

/** Referans: pencere içindeki yaşların en yakın sıra p95'i. */
function referenceP95(
  samples: readonly { at: number; age: number }[],
  now: number,
  windowMs: number,
) {
  const ages = samples
    .filter((s) => s.at > now - windowMs && s.at <= now)
    .map((s) => s.age)
    .sort((a, b) => a - b)
  if (ages.length === 0) return null
  return ages[Math.ceil((95 * ages.length) / 100) - 1] ?? null
}

describe('FreshnessTracker', () => {
  it('örnek yoksa ya da yaş null ise p95 null', () => {
    const f = new FreshnessTracker()
    expect(f.p95(T0)).toBeNull()
    f.sample(T0, null)
    expect(f.p95(T0)).toBeNull()
  })

  it('en yakın sıra p95: 1..100 → 95, 1..20 → 19, tek örnek → kendisi', () => {
    const f = new FreshnessTracker()
    for (let i = 1; i <= 100; i += 1) f.sample(T0 + i, (101 - i) * 1_000)
    expect(f.p95(T0 + 100)).toBe(95_000)

    const g = new FreshnessTracker()
    for (let i = 1; i <= 20; i += 1) g.sample(T0 + i, i)
    expect(g.p95(T0 + 20)).toBe(19)

    const h = new FreshnessTracker()
    h.sample(T0, 12_345)
    expect(h.p95(T0)).toBe(12_345)
  })

  it('kayan 5 dk pencere: saniyede bir örnek, eski örnekler düşer', () => {
    const f = new FreshnessTracker()
    // İlk 5 dk yaş 60 sn (kötü), sonraki 5 dk 10 sn (iyi).
    const ageAt = (sec: number) => (sec <= 300 ? 60_000 : 10_000)
    const p95At = new Map<number, number | null>()
    for (let sec = 1; sec <= 600; sec += 1) {
      f.sample(T0 + sec * 1_000, ageAt(sec))
      p95At.set(sec, f.p95(T0 + sec * 1_000))
    }
    expect(p95At.get(300)).toBe(60_000)
    expect(p95At.get(450)).toBe(60_000)
    // 584. sn: pencerede 16 kötü + 284 iyi örnek; 285. sıra kötü örneğe düşer.
    expect(p95At.get(584)).toBe(60_000)
    // 585. sn: 15 kötü (%5) + 285 iyi; 285. sıra son iyi örnektir.
    expect(p95At.get(585)).toBe(10_000)
    expect(p95At.get(600)).toBe(10_000)
    // Yeni örnek gelmese de pencere kayar.
    expect(f.p95(T0 + 600_000 + 299_999)).toBe(10_000)
    expect(f.p95(T0 + 600_000 + 300_000)).toBeNull()
  })

  it('düzensiz örneklerde referans hesapla aynı sonuç', () => {
    // Park–Miller LCG: deterministik, çarpım 2^53'ün altında kalır.
    let seed = 42
    const next = () => {
      seed = (seed * 16_807) % 2_147_483_647
      return seed / 2_147_483_647
    }
    const f = new FreshnessTracker()
    const all: { at: number; age: number }[] = []
    let now = T0
    for (let i = 0; i < 2_000; i += 1) {
      now += Math.floor(next() * 2_000)
      const age = Math.round(next() * 120_000)
      f.sample(now, age)
      all.push({ at: now, age })
      if (i % 37 === 0) expect(f.p95(now)).toBe(referenceP95(all, now, 300_000))
    }
    expect(f.p95(now)).toBe(referenceP95(all, now, 300_000))
  })

  it('negatif yaş (saat kayması) 0 sayılır; sonsuz yaş yok sayılır', () => {
    const f = new FreshnessTracker()
    f.sample(T0, -3_000)
    f.sample(T0, Number.POSITIVE_INFINITY)
    expect(f.p95(T0)).toBe(0)
  })

  it('pencere ayarlanabilir', () => {
    const f = new FreshnessTracker({ windowMs: 10_000 })
    f.sample(T0, 50_000)
    f.sample(T0 + 5_000, 1_000)
    expect(f.p95(T0 + 5_000)).toBe(50_000)
    expect(f.p95(T0 + 10_000)).toBe(1_000)
    expect(() => new FreshnessTracker({ windowMs: 0 })).toThrow(RangeError)
  })
})

describe('HourlyCounter', () => {
  it('sonuçları türüne göre sayar; take sıfırlar', () => {
    const h = new HourlyCounter()
    const outcomes: OutcomeKind[] = [
      'success',
      'success',
      'success',
      'rate_limit',
      'server',
      'network',
      'response',
      'request',
      'config',
    ]
    for (const o of outcomes) h.add(o)
    expect(h.take()).toEqual({
      requests: 9,
      successes: 3,
      rateLimited: 1,
      serverErrors: 1,
      networkErrors: 1,
      otherErrors: 3,
    })
    expect(h.take()).toEqual({
      requests: 0,
      successes: 0,
      rateLimited: 0,
      serverErrors: 0,
      networkErrors: 0,
      otherErrors: 0,
    })
    h.add('success')
    expect(h.take().successes).toBe(1)
  })
})
