/**
 * Boşta çalıştırma: tarayıcı boş kalınca (`requestIdleCallback`), en geç `IDLE_TIMEOUT_MS` sonra.
 * `requestIdleCallback` olmayan tarayıcıda (Safari) `IDLE_FALLBACK_DELAY_MS` sonra.
 */

/** Tarayıcının boşta süresi (`IdleDeadline`); yedek zamanlayıcıda verilmez. */
export interface IdleDeadlineLike {
  /** Süre dolduğu için zorla çalıştırıldı (sayfa boş kalmadı); kalan süre 0'dır. */
  readonly didTimeout: boolean
  timeRemaining(): number
}

/** Zamanlayıcılar (`window`); testte değiştirilir. */
export interface IdleScheduler {
  requestIdleCallback?: (
    callback: (deadline?: IdleDeadlineLike) => void,
    options?: { timeout: number },
  ) => number
  cancelIdleCallback?: (handle: number) => void
  setTimeout: (callback: () => void, ms: number) => number
  clearTimeout: (handle: number) => void
}

/** Sayfa hiç boş kalmasa da iş en geç bu kadar sonra çalışır. */
export const IDLE_TIMEOUT_MS = 3000

/** `requestIdleCallback` yoksa gecikme. */
export const IDLE_FALLBACK_DELAY_MS = 1000

/**
 * Dilimli işin, tarayıcının boşta süresi olmadan çalıştığında (yedek zamanlayıcı ya da süresi dolan
 * zorunlu çağrı) bir dilimde kullandığı süre, ms. Kısa tutulur: dilim uzun bir görev olmasın (50 ms).
 */
export const IDLE_FORCED_SLICE_MS = 10

/** İşi boşta çalıştırır; dönen fonksiyon iptal eder (efektin temizliği). */
export function whenIdle(
  task: (deadline?: IdleDeadlineLike) => void,
  scheduler: IdleScheduler = window,
): () => void {
  const { requestIdleCallback, cancelIdleCallback } = scheduler
  if (requestIdleCallback !== undefined && cancelIdleCallback !== undefined) {
    const handle = requestIdleCallback.call(scheduler, task, { timeout: IDLE_TIMEOUT_MS })
    return () => cancelIdleCallback.call(scheduler, handle)
  }
  const handle = scheduler.setTimeout(task, IDLE_FALLBACK_DELAY_MS)
  return () => scheduler.clearTimeout(handle)
}

/**
 * İşi bir sonraki görevde çalıştırır (`setTimeout(task, 0)`); dönen fonksiyon iptal eder. Dilimli
 * işin yedek zamanlayıcıdaki sonraki dilimleri içindir: `requestIdleCallback` olmayan tarayıcıda
 * (Safari, iOS'taki bütün tarayıcılar) her dilim `IDLE_FALLBACK_DELAY_MS` beklemesin (D-118). İş
 * yine dilimlerle bölünür; dilimler arasında tarayıcı çizer ve olayları işler.
 */
export function nextTask(task: () => void, scheduler: IdleScheduler = window): () => void {
  const handle = scheduler.setTimeout(task, 0)
  return () => scheduler.clearTimeout(handle)
}

/**
 * Bir dilimin kalan süresi, ms: tarayıcı boşta süre verdiyse onunki; vermediyse (yedek zamanlayıcı)
 * ya da süre dolduğu için zorla çalıştıysa dilimin başından `IDLE_FORCED_SLICE_MS`. `now` testte
 * değiştirilir.
 */
export function sliceTimeRemaining(
  deadline: IdleDeadlineLike | undefined,
  now: () => number = () => performance.now(),
): () => number {
  if (deadline !== undefined && !deadline.didTimeout) return () => deadline.timeRemaining()
  const end = now() + IDLE_FORCED_SLICE_MS
  return () => Math.max(0, end - now())
}
