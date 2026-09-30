import type { LiveSnapshotMessage } from '@havayolu/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LiveConnection } from '../../lib/live/connection'
import { AircraftStore } from '../../lib/live/store'
import {
  RENDER_INTERVAL_MS,
  SILENCE_REFRESH_MS,
  SilenceWatchdog,
  VIEWPORT_DEBOUNCE_MS,
  VIEWPORT_MAX_WAIT_MS,
  ViewportDebouncer,
  ViewportRelay,
  throttledVersion,
} from './use-live'

const box = (minLon: number) => ({ minLon, minLat: 36, maxLon: minLon + 5, maxLat: 40 })
/** Sahte zamanlayıcılarla ilerleyen saat (üretimde geri gitmeyen saat, clock.ts). */
const fakeNow = () => Date.now()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_000_000)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ViewportDebouncer', () => {
  it('son görünümü 250 ms sessizlikten sonra bir kez gönderir', () => {
    const send = vi.fn()
    const debouncer = new ViewportDebouncer(send, undefined, undefined, fakeNow)
    debouncer.push(box(26), 5)
    vi.advanceTimersByTime(100)
    debouncer.push(box(27), 6)
    vi.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS - 1)
    expect(send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(box(27), 6)
  })

  it('harita durmadan kaysa da en geç 2 sn içinde gönderir', () => {
    const send = vi.fn()
    const debouncer = new ViewportDebouncer(send, undefined, undefined, fakeNow)
    for (let t = 0; t <= VIEWPORT_MAX_WAIT_MS; t += 100) {
      debouncer.push(box(26 + t / 1000), 7)
      vi.advanceTimersByTime(100)
    }
    expect(send).toHaveBeenCalled()
    expect(send.mock.calls[0]?.[1]).toBe(7)
  })

  it('iptal edilince bekleyen görünüm gönderilmez', () => {
    const send = vi.fn()
    const debouncer = new ViewportDebouncer(send, undefined, undefined, fakeNow)
    debouncer.push(box(26), 5)
    debouncer.cancel()
    vi.advanceTimersByTime(VIEWPORT_MAX_WAIT_MS)
    expect(send).not.toHaveBeenCalled()
  })
})

describe('throttledVersion', () => {
  const snapshot = (seq: number): LiveSnapshotMessage => ({
    type: 'snapshot',
    seq,
    coverage: 'full',
    status: { providers: { adsbLol: 'ok' }, primaryAgeS: 1, newestAgeS: 1 },
    aircraft: [],
  })

  it('ilk değişikliği hemen, sonrakileri en fazla 500 ms’de bir bildirir', () => {
    const store = new AircraftStore()
    const feed = throttledVersion(store, RENDER_INTERVAL_MS, fakeNow)
    const listener = vi.fn()
    const unsubscribe = feed.subscribe(listener)

    store.applySnapshot(snapshot(1), Date.now())
    expect(listener).toHaveBeenCalledTimes(1)
    expect(feed.getSnapshot()).toBe(store.version)

    store.applySnapshot(snapshot(2), Date.now())
    store.applySnapshot(snapshot(3), Date.now())
    expect(listener).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(RENDER_INTERVAL_MS)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(feed.getSnapshot()).toBe(store.version)

    unsubscribe()
    store.applySnapshot(snapshot(4), Date.now())
    vi.advanceTimersByTime(RENDER_INTERVAL_MS)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe('SilenceWatchdog', () => {
  it('açık bağlantıda 30 sn mesaj gelmezse aboneliği yeniler; mesaj saati sıfırlar', () => {
    const refresh = vi.fn()
    const watchdog = new SilenceWatchdog(refresh, 0)
    watchdog.check(SILENCE_REFRESH_MS - 1, true)
    expect(refresh).not.toHaveBeenCalled()
    watchdog.message(20_000)
    watchdog.check(SILENCE_REFRESH_MS + 5_000, true)
    expect(refresh).not.toHaveBeenCalled()
    watchdog.check(20_000 + SILENCE_REFRESH_MS, true)
    expect(refresh).toHaveBeenCalledTimes(1)
    // Yenilemeden sonra yeniden 30 sn beklenir (saniyede bir abonelik yağmuru olmaz).
    watchdog.check(20_000 + SILENCE_REFRESH_MS + 5_000, true)
    expect(refresh).toHaveBeenCalledTimes(1)
    watchdog.check(20_000 + 2 * SILENCE_REFRESH_MS, true)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('bağlantı açık değilken yenilemez; açılınca süre baştan başlar', () => {
    const refresh = vi.fn()
    const watchdog = new SilenceWatchdog(refresh, 0)
    watchdog.check(SILENCE_REFRESH_MS * 3, false)
    watchdog.check(SILENCE_REFRESH_MS * 3 + 1_000, true)
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('ViewportRelay', () => {
  it('"Uçağı ortala" ile her turda kayan harita aboneliği yenilemez; yeni hücreye geçince yeniler', () => {
    const setViewport = vi.fn()
    const relay = new ViewportRelay()
    relay.attach({ setViewport } as unknown as LiveConnection)
    const view = (lon: number) => ({
      minLon: lon - 0.35,
      maxLon: lon + 0.35,
      minLat: 40.85,
      maxLat: 41.35,
    })
    relay.push(view(28.8), 10)
    vi.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS)
    expect(setViewport).toHaveBeenCalledTimes(1)
    // 2 dk boyunca saniyede iki görünüm bildirimi (MapController, 500 ms).
    for (let i = 1; i <= 240; i++) {
      relay.push(view(28.8 + i * 0.002), 10)
      vi.advanceTimersByTime(500)
    }
    expect(setViewport).toHaveBeenCalledTimes(1)
    // Görünüm 30° boylamını aştı: yeni hücreye abone olunur.
    relay.push(view(29.8), 10)
    vi.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS)
    expect(setViewport).toHaveBeenCalledTimes(2)
  })

  it('iptal edilen bekleyen görünüm yeniden bildirilince gönderilir (yeniden bağlanan bileşen)', () => {
    const setViewport = vi.fn()
    const relay = new ViewportRelay()
    relay.attach({ setViewport } as unknown as LiveConnection)
    const turkey = { minLon: 25.5, minLat: 35.8, maxLon: 44.8, maxLat: 42.2 }
    relay.push(turkey, 5.3)
    relay.cancel()
    vi.advanceTimersByTime(VIEWPORT_MAX_WAIT_MS)
    expect(setViewport).not.toHaveBeenCalled()
    relay.push(turkey, 5.3)
    vi.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS)
    expect(setViewport).toHaveBeenCalledTimes(1)
    // Gönderilmiş abonelik iptalden sonra da korunur: aynı görünüm yeniden gönderilmez.
    relay.cancel()
    relay.push(turkey, 5.3)
    vi.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS)
    expect(setViewport).toHaveBeenCalledTimes(1)
  })
})
