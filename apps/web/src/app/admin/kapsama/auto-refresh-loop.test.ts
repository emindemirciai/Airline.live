import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTO_REFRESH_INTERVAL_MS,
  AUTO_REFRESH_MAX_MS,
  AutoRefreshLoop,
  nextRefreshActiveId,
} from './auto-refresh-loop'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(Date.parse('2026-10-06T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AutoRefreshLoop', () => {
  it('5 sn aralık ve 25 dk sınır', () => {
    expect(AUTO_REFRESH_INTERVAL_MS).toBe(5_000)
    expect(AUTO_REFRESH_MAX_MS).toBe(25 * 60_000)
  })

  it('5 sn’de bir yeniler; 25 dk dolunca durur, onStop bir kez çağrılır, sonra yenilemez', () => {
    const refresh = vi.fn()
    const onStop = vi.fn()
    const loop = new AutoRefreshLoop({ refresh, onStop })
    loop.start()
    expect(loop.running).toBe(true)

    vi.advanceTimersByTime(AUTO_REFRESH_INTERVAL_MS - 1)
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(refresh).toHaveBeenCalledTimes(1)

    // 25 dk'nın son yoklaması 24:55'tedir; 25:00'te döngü durur.
    vi.advanceTimersByTime(AUTO_REFRESH_MAX_MS - AUTO_REFRESH_INTERVAL_MS - 1)
    expect(refresh).toHaveBeenCalledTimes(AUTO_REFRESH_MAX_MS / AUTO_REFRESH_INTERVAL_MS - 1)
    expect(onStop).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(loop.running).toBe(false)

    vi.advanceTimersByTime(60 * 60_000)
    expect(refresh).toHaveBeenCalledTimes(AUTO_REFRESH_MAX_MS / AUTO_REFRESH_INTERVAL_MS - 1)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stop() zamanlayıcıyı kaldırır; onStop çağrılmaz', () => {
    const refresh = vi.fn()
    const onStop = vi.fn()
    const loop = new AutoRefreshLoop({ refresh, onStop })
    loop.start()
    vi.advanceTimersByTime(12_000)
    loop.stop()
    vi.advanceTimersByTime(AUTO_REFRESH_MAX_MS * 2)
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(onStop).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ikinci start() yeni zamanlayıcı açmaz; durduktan sonra yeniden başlatılınca süre sıfırlanır', () => {
    const refresh = vi.fn()
    const onStop = vi.fn()
    const loop = new AutoRefreshLoop({ refresh, onStop, intervalMs: 1_000, maxMs: 3_000 })
    loop.start()
    loop.start()
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(3_000)
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(onStop).toHaveBeenCalledTimes(1)

    loop.start()
    vi.advanceTimersByTime(2_000)
    expect(refresh).toHaveBeenCalledTimes(4)
    vi.advanceTimersByTime(1_000)
    expect(onStop).toHaveBeenCalledTimes(2)
  })
})

describe('nextRefreshActiveId', () => {
  it('liste alınamayınca son bilinen rapor korunur; liste dönünce API’nin değeri geçerlidir', () => {
    // Rapor 7 sürüyor; bir yenileme başarısız (undefined), sonraki yenileme yine 7, sonra bitti.
    const sequence: (number | null | undefined)[] = [7, undefined, undefined, 7, null]
    const seen: (number | null)[] = []
    let known: number | null = null
    for (const incoming of sequence) {
      known = nextRefreshActiveId(known, incoming)
      seen.push(known)
    }
    expect(seen).toEqual([7, 7, 7, 7, null])
    // Etkin rapor yokken başarısız yenileme döngü başlatmaz; yeni rapor gelince ona geçilir.
    expect(nextRefreshActiveId(null, undefined)).toBeNull()
    expect(nextRefreshActiveId(7, 8)).toBe(8)
  })

  it('başarısız yenileme döngünün süresini sıfırlamaz: aynı anahtar, 25 dk sınırı sürer', () => {
    const refresh = vi.fn()
    const onStop = vi.fn()
    const loop = new AutoRefreshLoop({ refresh, onStop })
    loop.start()
    // Bileşen anahtarı `<etkin>:<kuşak>`; liste alınamayınca etkin rapor değişmez, döngü sürer.
    const key = (active: number | null) => (active === null ? null : `${active}:0`)
    const before = key(nextRefreshActiveId(null, 7))
    const during = key(nextRefreshActiveId(7, undefined))
    expect(during).toBe(before)
    vi.advanceTimersByTime(AUTO_REFRESH_MAX_MS)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(AUTO_REFRESH_MAX_MS / AUTO_REFRESH_INTERVAL_MS - 1)
  })
})
