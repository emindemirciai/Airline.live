import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ARRIVAL_COVERAGE_POLL_INTERVAL_MS,
  ARRIVAL_COVERAGE_POLL_LOG_EVERY,
  createExclusiveRunner,
  createStartupGate,
  startArrivalCoveragePoller,
  type PollLogger,
} from './poll'

function logger() {
  const entries: { level: 'info' | 'warn'; obj: Record<string, unknown>; msg: string }[] = []
  const log: PollLogger = {
    info: (obj, msg) => entries.push({ level: 'info', obj, msg }),
    warn: (obj, msg) => entries.push({ level: 'warn', obj, msg }),
  }
  return { log, entries }
}

/** Dışarıdan çözülen söz. */
function deferred<T = void>() {
  let resolve: (value: T) => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('yoklayıcı', () => {
  it('kapı açılmadan yoklamaz; açılınca hemen, sonra 10 sn arayla yoklar', async () => {
    const gate = deferred()
    const runOnce = vi.fn(async () => false)
    const { log } = logger()
    const poller = startArrivalCoveragePoller({ ready: gate.promise, runOnce, log })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(runOnce).not.toHaveBeenCalled()

    gate.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(runOnce).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(ARRIVAL_COVERAGE_POLL_INTERVAL_MS - 1)
    expect(runOnce).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(runOnce).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(3 * ARRIVAL_COVERAGE_POLL_INTERVAL_MS)
    expect(runOnce).toHaveBeenCalledTimes(5)
    await poller.close()
  })

  it('rapor işlendiyse sıradakine beklemeden bakar; turlar üst üste binmez', async () => {
    const results = [true, true, false]
    let running = 0
    let maxRunning = 0
    const runOnce = vi.fn(async () => {
      running += 1
      maxRunning = Math.max(maxRunning, running)
      await new Promise((resolve) => setTimeout(resolve, 25_000))
      running -= 1
      return results.shift() ?? false
    })
    const poller = startArrivalCoveragePoller({
      ready: Promise.resolve(),
      runOnce,
      intervalMs: 10_000,
      log: logger().log,
    })
    // 3 tur × 25 sn, aralarında bekleme yok (sahte saatte 0 ms'lik zamanlayıcı 1 ms sürer); sonra
    // 10 sn aralık.
    await vi.advanceTimersByTimeAsync(75_100)
    expect(runOnce).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(9_800)
    expect(runOnce).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(200)
    expect(runOnce).toHaveBeenCalledTimes(4)
    expect(maxRunning).toBe(1)
    await vi.advanceTimersByTimeAsync(25_000)
    await poller.close()
  })

  it('hata yoklamayı durdurmaz; ilk hata ve her 60. hata günlüğe yazılır, düzelince bildirilir', async () => {
    let fail = true
    const runOnce = vi.fn(async () => {
      if (fail) throw new Error('relation "arrival_coverage_reports" does not exist')
      return false
    })
    const { log, entries } = logger()
    const poller = startArrivalCoveragePoller({
      ready: Promise.resolve(),
      runOnce,
      intervalMs: 1_000,
      log,
    })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(ARRIVAL_COVERAGE_POLL_LOG_EVERY * 1_000)
    expect(runOnce).toHaveBeenCalledTimes(ARRIVAL_COVERAGE_POLL_LOG_EVERY + 1)
    const warns = entries.filter((e) => e.level === 'warn')
    expect(warns.map((w) => w.obj.failures)).toEqual([1, ARRIVAL_COVERAGE_POLL_LOG_EVERY])
    expect(warns[0]?.msg).toBe('arrival coverage poll failed')

    fail = false
    await vi.advanceTimersByTimeAsync(1_000)
    expect(entries.at(-1)).toMatchObject({
      level: 'info',
      msg: 'arrival coverage poll recovered',
      obj: { failures: ARRIVAL_COVERAGE_POLL_LOG_EVERY + 1 },
    })
    await poller.close()
  })

  it('kapanış: iptal sinyali gider, sürmekte olan tur beklenir, yeni tur başlamaz', async () => {
    const release = deferred()
    let seen: AbortSignal | null = null
    const runOnce = vi.fn(async (signal: AbortSignal) => {
      seen = signal
      await release.promise
      return true
    })
    const poller = startArrivalCoveragePoller({
      ready: Promise.resolve(),
      runOnce,
      log: logger().log,
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(runOnce).toHaveBeenCalledTimes(1)

    let closed = false
    const closing = poller.close().then(() => {
      closed = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect((seen as AbortSignal | null)?.aborted).toBe(true)
    expect(closed).toBe(false)
    release.resolve()
    await closing
    expect(closed).toBe(true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(runOnce).toHaveBeenCalledTimes(1)
  })

  it('kapı açılmadan kapanırsa hiç yoklamaz', async () => {
    const gate = deferred()
    const runOnce = vi.fn(async () => false)
    const poller = startArrivalCoveragePoller({ ready: gate.promise, runOnce, log: logger().log })
    await poller.close()
    gate.resolve()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(runOnce).not.toHaveBeenCalled()
  })
})

describe('sıralı çalıştırıcı', () => {
  it('görevler sırayla çalışır; hata sonrakini durdurmaz ve çağırana döner', async () => {
    vi.useRealTimers()
    const exclusive = createExclusiveRunner()
    const order: string[] = []
    const slow = deferred()
    const a = exclusive(async () => {
      order.push('a:start')
      await slow.promise
      order.push('a:end')
      return 'a'
    })
    const b = exclusive(async () => {
      order.push('b:start')
      throw new Error('b failed')
    })
    const c = exclusive(async () => {
      order.push('c')
      return 'c'
    })
    await Promise.resolve()
    expect(order).toEqual(['a:start'])
    slow.resolve()
    await expect(a).resolves.toBe('a')
    await expect(b).rejects.toThrow('b failed')
    await expect(c).resolves.toBe('c')
    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'c'])
  })
})

describe('açılış kapısı', () => {
  it('open ile açılır (bir kez); süre dolunca kendiliğinden açılır', async () => {
    const opened: string[] = []
    const gate = createStartupGate({ maxWaitMs: 600_000, onOpen: (r) => opened.push(r) })
    expect(gate.isOpen()).toBe(false)
    gate.open('track-partitions')
    gate.open('again')
    await expect(gate.ready).resolves.toBeUndefined()
    expect(opened).toEqual(['track-partitions'])
    await vi.advanceTimersByTimeAsync(600_000)
    expect(opened).toEqual(['track-partitions'])

    const late = createStartupGate({ maxWaitMs: 600_000, onOpen: (r) => opened.push(r) })
    await vi.advanceTimersByTimeAsync(599_999)
    expect(late.isOpen()).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(late.isOpen()).toBe(true)
    expect(opened).toEqual(['track-partitions', 'timeout'])

    const disposed = createStartupGate({ maxWaitMs: 1_000 })
    disposed.dispose()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(disposed.isOpen()).toBe(false)
  })
})
