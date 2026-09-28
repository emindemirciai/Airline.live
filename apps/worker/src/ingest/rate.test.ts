import { describe, expect, it } from 'vitest'
import {
  ADSBLOL_RATE,
  AdaptiveRateController,
  isBreakerFailure,
  type OutcomeKind,
  type RateControllerOptions,
} from './rate'

const T0 = 1_790_000_000_000
const WINDOW = ADSBLOL_RATE.cleanWindowMs

/** Sahte saat ve sabit (ya da verilen) rastgelelikle kova. */
function setup(opts?: Partial<Omit<RateControllerOptions, 'now'>> & { randomValue?: number }) {
  let t = T0
  const clock = {
    now: () => t,
    set: (value: number) => {
      t = value
    },
    advance: (ms: number) => {
      t += ms
    },
  }
  const randomValue = opts?.randomValue ?? 0.5
  const controller = new AdaptiveRateController({
    startRps: opts?.startRps ?? ADSBLOL_RATE.startRps,
    floorRps: opts?.floorRps,
    ceilingRps: opts?.ceilingRps,
    now: clock.now,
    random: opts?.random ?? (() => randomValue),
  })
  return { c: controller, clock }
}

type Setup = ReturnType<typeof setup>

/** Bir istek: izin verilen ana gider, jetonu alır, `latencyMs` sonra sonucu bildirir. */
function request(s: Setup, outcome: OutcomeKind, latencyMs = 500, retryAfterSec?: number | null) {
  const next = s.c.nextAllowedAt()
  expect(Number.isFinite(next)).toBe(true)
  s.clock.set(next)
  expect(s.c.tryAcquire()).toBe(true)
  s.clock.advance(latencyMs)
  s.c.record(outcome, retryAfterSec === undefined ? undefined : { retryAfterSec })
}

/** `untilMs`'e kadar hep aynı sonucu alan döngü; rps değişimlerini (an, değer) döner. */
function runUntil(s: Setup, untilMs: number, outcome: OutcomeKind = 'success') {
  const changes: { at: number; rps: number }[] = []
  while (s.c.nextAllowedAt() < untilMs) {
    const before = s.c.rps()
    request(s, outcome)
    if (s.c.rps() !== before) changes.push({ at: s.clock.now(), rps: s.c.rps() })
  }
  return changes
}

describe('ADSBLOL_RATE', () => {
  it('D-073 değerleri', () => {
    expect(ADSBLOL_RATE.floorRps).toBe(0.05)
    expect(ADSBLOL_RATE.ceilingRps).toBe(0.2)
    expect(ADSBLOL_RATE.startRps).toBe(0.1)
    expect(ADSBLOL_RATE.backoffLadderMs).toEqual([
      15_000, 30_000, 60_000, 120_000, 240_000, 300_000,
    ])
    expect(ADSBLOL_RATE.breakerThreshold).toBe(5)
    expect(ADSBLOL_RATE.breakerOpenMs).toBe(60_000)
    expect(ADSBLOL_RATE.breakerMaxOpenMs).toBe(600_000)
  })

  it('devre kesiciyi 5xx, ağ ve bozuk yanıt besler', () => {
    const kinds: OutcomeKind[] = ['success', 'rate_limit', 'server', 'network', 'response']
    expect(kinds.filter(isBreakerFailure)).toEqual(['server', 'network', 'response'])
    expect(isBreakerFailure('request')).toBe(false)
    expect(isBreakerFailure('config')).toBe(false)
  })
})

describe('AdaptiveRateController: kurulum', () => {
  it('başlangıç durumu: kapalı devre, bekleme yok, hemen istek atılabilir', () => {
    const s = setup()
    expect(s.c.rps()).toBe(0.1)
    expect(s.c.state()).toEqual({
      rps: 0.1,
      circuit: 'closed',
      backoffUntil: null,
      consecutiveFailures: 0,
      cleanSince: T0,
    })
    expect(s.c.nextAllowedAt()).toBe(T0)
  })

  it('izinli aralığın dışındaki başlangıç hızını kırpmaz, reddeder', () => {
    expect(() => setup({ startRps: 0.3 })).toThrow(RangeError)
    expect(() => setup({ startRps: 0.01 })).toThrow(RangeError)
    expect(() => setup({ startRps: Number.NaN })).toThrow(RangeError)
    expect(() => setup({ startRps: 0.1, floorRps: 0 })).toThrow(RangeError)
    expect(() => setup({ startRps: 0.1, floorRps: 0.2, ceilingRps: 0.1 })).toThrow(RangeError)
    expect(() => setup({ startRps: 0.05 })).not.toThrow()
    expect(() => setup({ startRps: 0.2 })).not.toThrow()
  })
})

describe('AdaptiveRateController: jeton aralığı', () => {
  it('iki istek arası 1000/rps ms; patlama yok', () => {
    const s = setup()
    expect(s.c.tryAcquire()).toBe(true)
    expect(s.c.tryAcquire()).toBe(false)
    expect(s.c.nextAllowedAt()).toBe(T0 + 10_000)
    s.clock.set(T0 + 9_999)
    expect(s.c.tryAcquire()).toBe(false)
    s.clock.set(T0 + 10_000)
    expect(s.c.tryAcquire()).toBe(true)
    expect(s.c.nextAllowedAt()).toBe(T0 + 20_000)
  })

  it('aralık hıza göre: 0,2 → 5 sn, 0,05 → 20 sn', () => {
    for (const [rps, spacing] of [
      [0.2, 5_000],
      [0.05, 20_000],
    ] as const) {
      const s = setup({ startRps: rps })
      expect(s.c.tryAcquire()).toBe(true)
      expect(s.c.nextAllowedAt()).toBe(T0 + spacing)
    }
  })

  it('uzun boşluktan sonra da tek jeton birikir', () => {
    const s = setup()
    expect(s.c.tryAcquire()).toBe(true)
    s.clock.advance(3_600_000)
    expect(s.c.nextAllowedAt()).toBe(s.clock.now())
    expect(s.c.tryAcquire()).toBe(true)
    expect(s.c.tryAcquire()).toBe(false)
  })

  it('nextAllowedAt şimdiden küçük olmaz', () => {
    const s = setup()
    s.c.tryAcquire()
    s.clock.advance(25_000)
    expect(s.c.nextAllowedAt()).toBe(s.clock.now())
  })

  it('başarılı döngüde istekler tam 1000/rps aralıkla gider', () => {
    const s = setup()
    const starts: number[] = []
    for (let i = 0; i < 20; i += 1) {
      starts.push(s.c.nextAllowedAt())
      request(s, 'success', 800)
    }
    const gaps = starts.slice(1).map((t, i) => t - (starts[i] ?? 0))
    expect(new Set(gaps)).toEqual(new Set([10_000]))
  })
})

describe('AdaptiveRateController: 429/420', () => {
  it('Retry-After yok: hız en az yarıya iner ve bekleme başlar', () => {
    const s = setup({ randomValue: 0.5 })
    request(s, 'rate_limit', 500)
    const now = s.clock.now()
    expect(s.c.rps()).toBeLessThanOrEqual(0.1 * 0.5)
    expect(s.c.rps()).toBe(0.05)
    // Tam jitter: 0,5 × 15 sn = 7,5 sn bekleme; kovanın yeni aralığı (20 sn) daha uzun.
    expect(s.c.state().backoffUntil).toBe(now + 7_500)
    expect(s.c.state().cleanSince).toBe(now)
    expect(s.c.nextAllowedAt()).toBeGreaterThan(now)
    expect(s.c.nextAllowedAt()).toBe(T0 + 20_000)
    expect(s.c.tryAcquire()).toBe(false)
    s.clock.set(T0 + 19_999)
    expect(s.c.tryAcquire()).toBe(false)
    s.clock.set(T0 + 20_000)
    expect(s.c.tryAcquire()).toBe(true)
  })

  it('jitter sıfır çıksa da bekleme vardır (kova aralığı korunur)', () => {
    const s = setup({ randomValue: 0 })
    request(s, 'rate_limit', 100)
    expect(s.c.nextAllowedAt()).toBeGreaterThan(s.clock.now())
    expect(s.c.nextAllowedAt()).toBe(T0 + 20_000)
  })

  it("üst üste 429: tam jitter'lı üstel merdiven, 300 sn'de durur; hız alt sınırın altına inmez", () => {
    const s = setup({ randomValue: 0.99 })
    const waits: number[] = []
    for (let i = 0; i < 8; i += 1) {
      request(s, 'rate_limit', 0)
      waits.push((s.c.state().backoffUntil ?? 0) - s.clock.now())
      expect(s.c.rps()).toBeGreaterThanOrEqual(ADSBLOL_RATE.floorRps)
    }
    expect(waits).toEqual(
      [15_000, 30_000, 60_000, 120_000, 240_000, 300_000, 300_000, 300_000].map((ms) => ms * 0.99),
    )
    expect(s.c.rps()).toBe(0.05)
  })

  it('bekleme [0, merdiven basamağı) aralığındadır (tam jitter)', () => {
    for (const r of [0, 0.25, 0.999_999]) {
      const s = setup({ randomValue: r })
      request(s, 'rate_limit', 0)
      const wait = (s.c.state().backoffUntil ?? s.clock.now()) - s.clock.now()
      expect(wait).toBeGreaterThanOrEqual(0)
      expect(wait).toBeLessThan(15_000)
      expect(wait).toBeCloseTo(r * 15_000, 2)
    }
  })

  it('Retry-After varsa o kullanılır, rastgelelik kullanılmaz', () => {
    const s = setup({
      random: () => {
        throw new Error('random kullanılmamalı')
      },
    })
    request(s, 'rate_limit', 500, 120)
    const now = s.clock.now()
    expect(s.c.state().backoffUntil).toBe(now + 120_000)
    expect(s.c.nextAllowedAt()).toBe(now + 120_000)
    expect(s.c.rps()).toBe(0.05)
    s.clock.set(now + 119_999)
    expect(s.c.tryAcquire()).toBe(false)
    s.clock.set(now + 120_000)
    expect(s.c.tryAcquire()).toBe(true)
  })

  it('Retry-After kısa ise kova aralığı yine korunur', () => {
    const s = setup()
    request(s, 'rate_limit', 500, 1)
    expect(s.c.nextAllowedAt()).toBe(T0 + 20_000)
  })

  it('Retry-After null ya da geçersizse merdiven kullanılır', () => {
    for (const retryAfterSec of [null, -5, Number.NaN]) {
      const s = setup({ randomValue: 0.5 })
      request(s, 'rate_limit', 0, retryAfterSec)
      expect((s.c.state().backoffUntil ?? 0) - s.clock.now()).toBe(7_500)
    }
  })

  it('başarı merdiveni başa sarar', () => {
    const s = setup({ randomValue: 0.99 })
    request(s, 'rate_limit', 0)
    request(s, 'rate_limit', 0)
    expect((s.c.state().backoffUntil ?? 0) - s.clock.now()).toBe(0.99 * 30_000)
    request(s, 'success', 0)
    request(s, 'rate_limit', 0)
    expect((s.c.state().backoffUntil ?? 0) - s.clock.now()).toBe(0.99 * 15_000)
  })

  it('süresi dolan bekleme durumda görünmez', () => {
    const s = setup({ randomValue: 0.5 })
    request(s, 'rate_limit', 0)
    expect(s.c.state().backoffUntil).not.toBeNull()
    s.clock.advance(7_500)
    expect(s.c.state().backoffUntil).toBeNull()
  })

  it('429 devre kesici sayacını artırmaz ve sıfırlamaz, hızı düşürür', () => {
    const s = setup({ randomValue: 0 })
    for (let i = 0; i < 4; i += 1) request(s, 'server')
    request(s, 'rate_limit')
    expect(s.c.state().consecutiveFailures).toBe(4)
    expect(s.c.state().circuit).toBe('closed')
    request(s, 'server')
    expect(s.c.state().circuit).toBe('open')
  })
})

describe('AdaptiveRateController: temiz pencerede toparlanma', () => {
  it('429 sonrası 10 dk temiz → hız bir adım (%10) artar; daha önce artmaz', () => {
    const s = setup({ randomValue: 0 })
    request(s, 'rate_limit')
    const errorAt = s.clock.now()
    expect(s.c.rps()).toBe(0.05)
    const changes = runUntil(s, errorAt + WINDOW + 30_000)
    // Tek adım; ilk temiz 10 dk dolmadan değil, dolduktan sonraki ilk başarılı yanıtta.
    expect(changes).toHaveLength(1)
    expect(changes[0]?.at).toBeGreaterThanOrEqual(errorAt + WINDOW)
    expect(changes[0]?.at).toBeLessThan(errorAt + WINDOW + 20_000 + 500)
    expect(s.c.rps()).toBeCloseTo(0.055, 12)
  })

  it("kademeli toparlanma: her adım en çok %10, k. adım en erken k × 10 dk'da, üst sınır aşılmaz", () => {
    const s = setup({ randomValue: 0 })
    request(s, 'rate_limit')
    const errorAt = s.clock.now()
    let previous = s.c.rps()
    const changes = runUntil(s, errorAt + 4 * 3_600_000)
    changes.forEach((change, i) => {
      expect(change.rps).toBeGreaterThan(previous)
      expect(change.rps / previous).toBeLessThanOrEqual(ADSBLOL_RATE.increaseFactor + 1e-12)
      expect(change.rps).toBeLessThanOrEqual(ADSBLOL_RATE.ceilingRps)
      expect(change.at).toBeGreaterThanOrEqual(errorAt + (i + 1) * WINDOW)
      previous = change.rps
    })
    // 0,05 × 1,1^14 ≈ 0,1899; 15. adım üst sınıra (0,2) kırpılır.
    expect(changes).toHaveLength(15)
    expect(changes.at(-2)?.rps).toBeCloseTo(0.05 * 1.1 ** 14, 12)
    expect(s.c.rps()).toBe(ADSBLOL_RATE.ceilingRps)
    // Adımlar temiz pencere aralığıyla gelir (istek aralığı kadar sapmayla).
    const gaps = changes.slice(1).map((c, i) => c.at - (changes[i]?.at ?? 0))
    for (const gap of gaps) {
      expect(gap).toBeGreaterThan(WINDOW - 20_000)
      expect(gap).toBeLessThan(WINDOW + 20_000)
    }
  })

  it('üst sınırdayken temiz pencereler hızı artırmaz', () => {
    const s = setup({ startRps: 0.2 })
    runUntil(s, T0 + 3 * WINDOW + 1)
    expect(s.c.rps()).toBe(0.2)
    expect(s.c.state().cleanSince).toBe(T0 + 3 * WINDOW)
  })

  it('pencere içindeki 5xx ya da ağ hatası temiz sayacı sıfırlar', () => {
    for (const failure of ['server', 'network', 'response'] as const) {
      const s = setup({ randomValue: 0 })
      runUntil(s, T0 + 9 * 60_000)
      request(s, failure)
      const failedAt = s.clock.now()
      expect(s.c.state().cleanSince).toBe(failedAt)
      runUntil(s, T0 + WINDOW + 60_000)
      expect(s.c.rps()).toBe(0.1)
      runUntil(s, failedAt + WINDOW + 30_000)
      expect(s.c.rps()).toBeCloseTo(0.11, 12)
    }
  })

  it('kendi hatalı isteğimiz (request) temiz sayacı ve hızı değiştirmez', () => {
    const s = setup()
    runUntil(s, T0 + 5 * 60_000)
    request(s, 'request')
    expect(s.c.state().cleanSince).toBe(T0)
    expect(s.c.rps()).toBe(0.1)
    runUntil(s, T0 + WINDOW + 30_000)
    expect(s.c.rps()).toBeCloseTo(0.11, 12)
  })

  it('uzun boşluktan sonra tek adım atılır; artan süre sonraki adıma sayılır', () => {
    const s = setup()
    s.clock.set(T0 + 35 * 60_000)
    request(s, 'success', 0)
    expect(s.c.rps()).toBeCloseTo(0.11, 12)
    expect(s.c.state().cleanSince).toBe(T0 + 30 * 60_000)
    request(s, 'success', 0)
    expect(s.c.rps()).toBeCloseTo(0.11, 12)
    const changes = runUntil(s, T0 + 41 * 60_000)
    expect(changes).toHaveLength(1)
    expect(changes[0]?.at).toBeGreaterThanOrEqual(T0 + 40 * 60_000)
    expect(s.c.rps()).toBeCloseTo(0.121, 12)
  })
})

describe('AdaptiveRateController: 401/403 (config)', () => {
  it('devre kalıcı açılır; tryAcquire bir daha başarılı olmaz', () => {
    const s = setup()
    request(s, 'config')
    expect(s.c.state().circuit).toBe('config')
    expect(s.c.nextAllowedAt()).toBe(Infinity)
    expect(s.c.tryAcquire()).toBe(false)
    for (const later of [60_000, 600_000, 86_400_000, 30 * 86_400_000]) {
      s.clock.set(T0 + later)
      expect(s.c.tryAcquire()).toBe(false)
      expect(s.c.nextAllowedAt()).toBe(Infinity)
    }
  })

  it('sonradan gelen başarı ya da başka sonuç devreyi kapatmaz', () => {
    const s = setup()
    request(s, 'config')
    for (const outcome of ['success', 'rate_limit', 'server', 'request'] as const) {
      s.c.record(outcome)
    }
    expect(s.c.state()).toMatchObject({ circuit: 'config', backoffUntil: null, rps: 0.1 })
    expect(s.c.tryAcquire()).toBe(false)
  })

  it('açık devre sırasında gelen 403 de kalıcıdır', () => {
    const s = setup({ randomValue: 0 })
    for (let i = 0; i < 5; i += 1) request(s, 'server')
    expect(s.c.state().circuit).toBe('open')
    s.c.record('config')
    s.clock.advance(ADSBLOL_RATE.breakerMaxOpenMs)
    expect(s.c.state().circuit).toBe('config')
    expect(s.c.tryAcquire()).toBe(false)
  })
})

describe('AdaptiveRateController: 5xx/ağ geri çekilmesi ve devre kesici', () => {
  it("devre kapalıyken jitter'lı ayrı merdiven; hız değişmez", () => {
    const s = setup({ randomValue: 0.9 })
    request(s, 'server', 500)
    let now = s.clock.now()
    expect(s.c.state().backoffUntil).toBe(now + 0.9 * 15_000)
    expect(s.c.nextAllowedAt()).toBe(now + 0.9 * 15_000)
    request(s, 'network', 500)
    now = s.clock.now()
    expect(s.c.state().backoffUntil).toBe(now + 0.9 * 30_000)
    expect(s.c.rps()).toBe(0.1)
    expect(s.c.state().consecutiveFailures).toBe(2)
  })

  it('5 üst üste 5xx/ağ hatası devreyi 60 sn açar; yarı açık deneme başarılıysa kapanır', () => {
    const s = setup({ randomValue: 0 })
    const failures = ['server', 'network', 'server', 'network'] as const
    for (const f of failures) request(s, f)
    expect(s.c.state()).toMatchObject({ circuit: 'closed', consecutiveFailures: 4 })
    request(s, 'server')
    const openedAt = s.clock.now()
    expect(s.c.state()).toMatchObject({
      circuit: 'open',
      consecutiveFailures: 5,
      backoffUntil: openedAt + 60_000,
    })
    expect(s.c.nextAllowedAt()).toBe(openedAt + 60_000)
    s.clock.set(openedAt + 59_999)
    expect(s.c.tryAcquire()).toBe(false)
    expect(s.c.state().circuit).toBe('open')

    s.clock.set(openedAt + 60_000)
    expect(s.c.state()).toMatchObject({ circuit: 'half_open', backoffUntil: null })
    expect(s.c.tryAcquire()).toBe(true)
    // Tek deneme: sonucu gelene kadar başka istek yok.
    expect(s.c.nextAllowedAt()).toBe(Infinity)
    s.clock.advance(30_000)
    expect(s.c.tryAcquire()).toBe(false)
    s.c.record('success')
    expect(s.c.state()).toMatchObject({ circuit: 'closed', consecutiveFailures: 0 })
    expect(s.c.nextAllowedAt()).toBe(s.clock.now())
    expect(s.c.tryAcquire()).toBe(true)
  })

  it('bozuk yanıt da devre kesiciyi besler', () => {
    const s = setup({ randomValue: 0 })
    for (let i = 0; i < 5; i += 1) request(s, 'response')
    expect(s.c.state().circuit).toBe('open')
  })

  it('başarısız deneme açık süreyi ikiye katlar, en fazla 600 sn', () => {
    const s = setup({ randomValue: 0 })
    for (let i = 0; i < 5; i += 1) request(s, 'network')
    const openDurations: number[] = []
    let openedAt = s.clock.now()
    openDurations.push((s.c.state().backoffUntil ?? 0) - openedAt)
    for (let i = 0; i < 6; i += 1) {
      const probeAt = s.c.nextAllowedAt()
      expect(probeAt - openedAt).toBe(openDurations.at(-1))
      s.clock.set(probeAt)
      expect(s.c.state().circuit).toBe('half_open')
      expect(s.c.tryAcquire()).toBe(true)
      s.clock.advance(15_000)
      s.c.record('network')
      openedAt = s.clock.now()
      expect(s.c.state().circuit).toBe('open')
      openDurations.push((s.c.state().backoffUntil ?? 0) - openedAt)
    }
    expect(openDurations).toEqual([60_000, 120_000, 240_000, 480_000, 600_000, 600_000, 600_000])
  })

  it("kapanan devre yeniden açılırsa süre 60 sn'den başlar", () => {
    const s = setup({ randomValue: 0 })
    for (let i = 0; i < 5; i += 1) request(s, 'server')
    s.clock.set(s.c.nextAllowedAt())
    s.c.tryAcquire()
    s.c.record('server')
    expect((s.c.state().backoffUntil ?? 0) - s.clock.now()).toBe(120_000)
    request(s, 'success')
    expect(s.c.state().circuit).toBe('closed')
    for (let i = 0; i < 5; i += 1) request(s, 'server')
    expect((s.c.state().backoffUntil ?? 0) - s.clock.now()).toBe(60_000)
  })

  it('araya giren başarı sayacı sıfırlar', () => {
    const s = setup({ randomValue: 0 })
    for (let i = 0; i < 4; i += 1) request(s, 'server')
    request(s, 'success')
    for (let i = 0; i < 4; i += 1) request(s, 'server')
    expect(s.c.state()).toMatchObject({ circuit: 'closed', consecutiveFailures: 4 })
  })

  it('açık devrenin süresi hata merdiveninin yerini alır', () => {
    const s = setup({ randomValue: 0.999 })
    for (let i = 0; i < 5; i += 1) request(s, 'server', 0)
    // 5. hatanın merdiven basamağı (0,999 × 240 sn) uygulanmaz; deneme 60 sn sonra.
    expect(s.c.nextAllowedAt() - s.clock.now()).toBe(60_000)
  })

  it('yarı açık denemede 429: devre yarı açık kalır, bekleme bitince yeni deneme yapılır', () => {
    const s = setup({ randomValue: 0 })
    for (let i = 0; i < 5; i += 1) request(s, 'server')
    s.clock.set(s.c.nextAllowedAt())
    expect(s.c.tryAcquire()).toBe(true)
    s.clock.advance(500)
    s.c.record('rate_limit', { retryAfterSec: 30 })
    expect(s.c.state().circuit).toBe('half_open')
    expect(s.c.nextAllowedAt()).toBe(s.clock.now() + 30_000)
    s.clock.advance(30_000)
    expect(s.c.tryAcquire()).toBe(true)
    s.c.record('success')
    expect(s.c.state().circuit).toBe('closed')
  })

  it('yarı açık denemede kendi hatamız (request): deneme hakkı geri verilir', () => {
    const s = setup({ randomValue: 0 })
    for (let i = 0; i < 5; i += 1) request(s, 'server')
    s.clock.set(s.c.nextAllowedAt())
    expect(s.c.tryAcquire()).toBe(true)
    s.c.record('request')
    expect(s.c.state().circuit).toBe('half_open')
    expect(s.c.nextAllowedAt()).toBe(s.clock.now() + 10_000)
  })

  it('açıkken geç gelen hata süreyi uzatmaz', () => {
    const s = setup({ randomValue: 0 })
    for (let i = 0; i < 5; i += 1) request(s, 'server')
    const until = s.c.state().backoffUntil
    s.clock.advance(10_000)
    s.c.record('network')
    expect(s.c.state()).toMatchObject({ circuit: 'open', backoffUntil: until })
  })
})
