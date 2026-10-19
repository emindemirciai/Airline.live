import { describe, expect, it, vi } from 'vitest'
import {
  IDLE_FALLBACK_DELAY_MS,
  IDLE_FORCED_SLICE_MS,
  IDLE_TIMEOUT_MS,
  sliceTimeRemaining,
  whenIdle,
  type IdleScheduler,
} from './idle'

describe('whenIdle', () => {
  it('requestIdleCallback varsa onunla (en geç IDLE_TIMEOUT_MS); temizlik iptal eder', () => {
    const scheduler = {
      requestIdleCallback: vi.fn(() => 7),
      cancelIdleCallback: vi.fn(),
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    } satisfies IdleScheduler
    const task = vi.fn()
    const cancel = whenIdle(task, scheduler)
    expect(scheduler.requestIdleCallback).toHaveBeenCalledWith(task, { timeout: IDLE_TIMEOUT_MS })
    expect(scheduler.setTimeout).not.toHaveBeenCalled()
    cancel()
    expect(scheduler.cancelIdleCallback).toHaveBeenCalledWith(7)
    expect(task).not.toHaveBeenCalled()
  })

  it('requestIdleCallback yoksa (Safari) setTimeout ile; temizlik iptal eder', () => {
    const scheduler = {
      setTimeout: vi.fn(() => 3),
      clearTimeout: vi.fn(),
    } satisfies IdleScheduler
    const task = vi.fn()
    const cancel = whenIdle(task, scheduler)
    expect(scheduler.setTimeout).toHaveBeenCalledWith(task, IDLE_FALLBACK_DELAY_MS)
    cancel()
    expect(scheduler.clearTimeout).toHaveBeenCalledWith(3)
  })
})

describe('sliceTimeRemaining (dilimli boşta iş, M6j.3)', () => {
  it('tarayıcının boşta süresi varsa onunki', () => {
    let left = 12
    const remaining = sliceTimeRemaining({ didTimeout: false, timeRemaining: () => left })
    expect(remaining()).toBe(12)
    left = 0
    expect(remaining()).toBe(0)
  })

  it('yedek zamanlayıcıda ya da süresi dolan zorunlu çağrıda dilimin başından IDLE_FORCED_SLICE_MS', () => {
    let now = 100
    const clock = () => now
    for (const deadline of [undefined, { didTimeout: true, timeRemaining: () => 0 }]) {
      now = 100
      const remaining = sliceTimeRemaining(deadline, clock)
      expect(remaining()).toBe(IDLE_FORCED_SLICE_MS)
      now = 104
      expect(remaining()).toBe(IDLE_FORCED_SLICE_MS - 4)
      now = 200
      expect(remaining()).toBe(0)
    }
    expect(IDLE_FORCED_SLICE_MS).toBe(10)
  })
})
