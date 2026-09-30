import { afterEach, describe, expect, it, vi } from 'vitest'
import { ServerClock, monotonicNow } from './clock'

describe('ServerClock', () => {
  it('gözlem yokken tahmin yoktur', () => {
    const clock = new ServerClock()
    expect(clock.serverAt(1_000)).toBeNull()
    expect(clock.localAt(1_000)).toBeNull()
  })

  it('en sıkı alt sınırı tutar; istemci saatiyle ileri taşır', () => {
    const clock = new ServerClock()
    clock.observe(5_000_000, 100)
    expect(clock.serverAt(1_100)).toBe(5_001_000)
    // Daha gevşek alt sınır (sakin görünüm, eski örnek) tahmini geri almaz.
    clock.observe(4_000_000, 2_000)
    expect(clock.serverAt(2_000)).toBe(5_001_900)
    // Daha sıkı alt sınır (daha az gecikmeyle gelen mesaj) tahmini ileri alır.
    clock.observe(5_002_500, 2_000)
    expect(clock.serverAt(2_000)).toBe(5_002_500)
    expect(clock.localAt(5_002_000)).toBe(1_500)
  })

  it('geçersiz değerleri yok sayar', () => {
    const clock = new ServerClock()
    clock.observe(Number.NaN, 1)
    clock.observe(1, Number.POSITIVE_INFINITY)
    expect(clock.serverAt(1)).toBeNull()
  })
})

describe('monotonicNow', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sistem saati geri alınsa da geri gitmez', () => {
    const first = monotonicNow()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(first - 3_600_000)
    expect(Date.now()).toBeLessThan(first)
    expect(monotonicNow()).toBeGreaterThanOrEqual(first)
  })
})
