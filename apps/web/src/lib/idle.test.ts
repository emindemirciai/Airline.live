import { describe, expect, it, vi } from 'vitest'
import { IDLE_FALLBACK_DELAY_MS, IDLE_TIMEOUT_MS, whenIdle, type IdleScheduler } from './idle'

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
