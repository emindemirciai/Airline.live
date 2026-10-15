import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIVE_LAYER_REFRESH_MS, LiveLayerSync } from './live-layer-sync'
import { PeriodicSync } from './periodic-sync'

const T0 = Date.UTC(2026, 9, 15, 12, 0, 0)

const texts = {
  loaded: 'value loaded',
  loadedFields: (value: number) => ({ value }),
  readFailedLoaded: 'value could not be read; keeping the last value',
  readFailedUnloaded: 'value could not be read; withheld until it loads',
}

describe('PeriodicSync', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: T0 })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('kapalı başlar, retryMs ile dener, yüklenince refreshMs ile yeniler; onRead önceki değeri alır', async () => {
    const results: (number | Error)[] = [new Error('down'), 1, 2]
    const reads: number[] = []
    const seen: [number, number, boolean][] = []
    const log = { info: vi.fn(), warn: vi.fn() }
    const sync = new PeriodicSync<number>({
      read: async () => {
        reads.push(Date.now() - T0)
        const next = results.length > 1 ? results.shift() : results[0]
        if (next === undefined || next instanceof Error) throw next ?? new Error('none')
        return next
      },
      initial: 0,
      log,
      texts,
      refreshMs: 10_000,
      retryMs: 1_000,
      onRead: (value, previous, first) => seen.push([value, previous, first]),
    })
    sync.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(sync.loaded()).toBe(false)
    expect(sync.current()).toBe(0)
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ loaded: false }),
      texts.readFailedUnloaded,
    )
    await vi.advanceTimersByTimeAsync(1_000)
    expect(sync.loaded()).toBe(true)
    expect(sync.current()).toBe(1)
    expect(log.info).toHaveBeenCalledWith({ value: 1 }, 'value loaded')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(sync.current()).toBe(2)
    expect(reads).toEqual([0, 1_000, 11_000])
    expect(seen).toEqual([
      [1, 0, true],
      [2, 1, false],
    ])
    sync.stop()
  })

  it('depo yoksa başlangıç değeri geçerlidir ve hemen yüklenmiş sayılır', async () => {
    const sync = new PeriodicSync<number>({
      read: null,
      initial: 7,
      log: { info: vi.fn(), warn: vi.fn() },
      texts,
      refreshMs: 1_000,
      retryMs: 1_000,
    })
    expect(sync.loaded()).toBe(true)
    expect(await sync.whenLoaded()).toBe(true)
    expect(sync.current()).toBe(7)
    expect(await sync.refresh()).toBe(true)
  })
})

describe('LiveLayerSync (D-115)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: T0 })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('2 sn’de bir okur; ilk okumaya kadar kapalı, değişimi bir kez loglar, hata son durumu korur', async () => {
    const values: (boolean | Error)[] = [true, false, new Error('db down'), true]
    const log = { info: vi.fn(), warn: vi.fn() }
    const sync = new LiveLayerSync({
      read: async () => {
        const next = values.length > 1 ? values.shift() : values[0]
        if (next === undefined || next instanceof Error) throw next ?? new Error('none')
        return next
      },
      log,
    })
    let loaded: boolean | null = null
    void sync.whenLoaded().then((value) => {
      loaded = value
    })
    expect(sync.loaded()).toBe(false)
    sync.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(loaded).toBe(true)
    expect(sync.current()).toBe(true)
    expect(log.info).toHaveBeenCalledWith({ layer: 'on' }, 'live layer state loaded')
    await vi.advanceTimersByTimeAsync(LIVE_LAYER_REFRESH_MS)
    expect(sync.current()).toBe(false)
    expect(log.info).toHaveBeenCalledWith({ layer: 'off' }, 'live layer changed')
    await vi.advanceTimersByTimeAsync(LIVE_LAYER_REFRESH_MS)
    expect(sync.current()).toBe(false)
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ loaded: true }),
      'live layer state could not be read; keeping the last state',
    )
    // Admin değişikliğinden sonra beklemeden yenilenir.
    expect(await sync.refresh()).toBe(true)
    expect(sync.current()).toBe(true)
    expect(log.info).toHaveBeenCalledWith({ layer: 'on' }, 'live layer changed')
    sync.stop()
  })

  it('veritabanı yoksa katman açık ve hemen yüklenmiş', async () => {
    const sync = new LiveLayerSync({ read: null, log: { info: vi.fn(), warn: vi.fn() } })
    expect(sync.loaded()).toBe(true)
    expect(sync.current()).toBe(true)
    expect(await sync.whenLoaded()).toBe(true)
  })
})
