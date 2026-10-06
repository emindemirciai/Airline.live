/**
 * Boşta çalıştırma: tarayıcı boş kalınca (`requestIdleCallback`), en geç `IDLE_TIMEOUT_MS` sonra.
 * `requestIdleCallback` olmayan tarayıcıda (Safari) `IDLE_FALLBACK_DELAY_MS` sonra.
 */

/** Zamanlayıcılar (`window`); testte değiştirilir. */
export interface IdleScheduler {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
  setTimeout: (callback: () => void, ms: number) => number
  clearTimeout: (handle: number) => void
}

/** Sayfa hiç boş kalmasa da iş en geç bu kadar sonra çalışır. */
export const IDLE_TIMEOUT_MS = 3000

/** `requestIdleCallback` yoksa gecikme. */
export const IDLE_FALLBACK_DELAY_MS = 1000

/** İşi boşta çalıştırır; dönen fonksiyon iptal eder (efektin temizliği). */
export function whenIdle(task: () => void, scheduler: IdleScheduler = window): () => void {
  const { requestIdleCallback, cancelIdleCallback } = scheduler
  if (requestIdleCallback !== undefined && cancelIdleCallback !== undefined) {
    const handle = requestIdleCallback.call(scheduler, task, { timeout: IDLE_TIMEOUT_MS })
    return () => cancelIdleCallback.call(scheduler, handle)
  }
  const handle = scheduler.setTimeout(task, IDLE_FALLBACK_DELAY_MS)
  return () => scheduler.clearTimeout(handle)
}
