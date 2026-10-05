/**
 * Kapsama raporu kuyruğunun yoklayıcısı (Parça 1 M7b.2, D-098). API rapor isteğini yalnızca
 * `arrival_coverage_reports` tablosuna `queued` satır olarak yazar; BullMQ kullanmaz. `jobs` rolü
 * tabloyu 10 sn'de bir yoklar, satırı üstlenir (FOR UPDATE SKIP LOCKED) ve raporu tek eşzamanlı
 * çalıştırır.
 *
 * - Yoklama, açılıştaki iz partition işi bitince başlar (`ready`); ilk yoklama hemen yapılır.
 * - Bir rapor işlendiyse sıradaki satıra beklemeden bakılır; kuyruk boşsa `intervalMs` beklenir.
 * - Hata yoklamayı durdurmaz; art arda hatalar günlüğü boğmasın diye ilki ve her 60.'sı yazılır.
 * - Kapanışta zamanlayıcı durur ve çalışan rapora iptal sinyali gider (partiler arasında
 *   denetlenir); sürmekte olan tur beklenir.
 *
 * Rapor, günlük oran işi ve iz partition bakımı aynı süreçte üst üste binmesin diye üçü de
 * `createExclusiveRunner` ile sıraya girer (partition DDL'i kapsama okumasıyla çakışmaz).
 */

export const ARRIVAL_COVERAGE_POLL_INTERVAL_MS = 10_000
/** Art arda yoklama hatalarında günlüğe yazma aralığı (ilk hata her zaman yazılır). */
export const ARRIVAL_COVERAGE_POLL_LOG_EVERY = 60

export interface PollLogger {
  info(obj: Record<string, unknown>, msg: string): void
  warn(obj: Record<string, unknown>, msg: string): void
}

/** Görevi sıraya koyup çalıştırır; sonucu ya da hatası çağırana döner. */
export type ExclusiveRunner = <T>(task: () => Promise<T>) => Promise<T>

/**
 * Görevleri sırayla çalıştırır: yeni görev, öncekiler (başarılı ya da hatalı) bitince başlar.
 * Görevin sonucu ya da hatası çağırana döner.
 */
export function createExclusiveRunner(): ExclusiveRunner {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task)
    tail = run.catch(() => undefined)
    return run
  }
}

export interface StartupGate {
  /** Kapı açılınca çözülür. */
  ready: Promise<void>
  /** Kapıyı açar (ikinci çağrı etkisizdir); `reason` günlük içindir. */
  open: (reason: string) => void
  isOpen: () => boolean
  /** Bekleme zamanlayıcısını durdurur (kapanış). */
  dispose: () => void
}

/**
 * Açılış kapısı: `open` çağrılınca ya da en geç `maxWaitMs` sonra açılır. İz partition işi başka
 * bir süreçte işlendiyse ya da hiç bitmezse yoklama yine başlar.
 */
export function createStartupGate(params: {
  maxWaitMs: number
  onOpen?: (reason: string) => void
}): StartupGate {
  let opened = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let resolveReady: () => void = () => undefined
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })
  const dispose = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const open = (reason: string) => {
    if (opened) return
    opened = true
    dispose()
    params.onOpen?.(reason)
    resolveReady()
  }
  timer = setTimeout(() => open('timeout'), params.maxWaitMs)
  timer.unref?.()
  return { ready, open, isOpen: () => opened, dispose }
}

export interface ArrivalCoveragePollerOptions {
  /** Yoklama bu söz çözülünce başlar. */
  ready: Promise<void>
  /** Bir satır üstlenip çalıştırır; satır işlendiyse true (sıradakine hemen bakılır). */
  runOnce: (signal: AbortSignal) => Promise<boolean>
  intervalMs?: number
  log: PollLogger
}

export interface ArrivalCoveragePoller {
  /** Zamanlayıcıyı durdurur, çalışan rapora iptal gönderir ve sürmekte olan turu bekler. */
  close: () => Promise<void>
}

export function startArrivalCoveragePoller(
  options: ArrivalCoveragePollerOptions,
): ArrivalCoveragePoller {
  const intervalMs = options.intervalMs ?? ARRIVAL_COVERAGE_POLL_INTERVAL_MS
  const controller = new AbortController()
  let closed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let current: Promise<void> | null = null
  let failures = 0

  const schedule = (delayMs: number) => {
    if (closed) return
    timer = setTimeout(tick, delayMs)
    timer.unref?.()
  }

  function tick() {
    timer = null
    if (closed) return
    current = (async () => {
      let again = false
      try {
        again = await options.runOnce(controller.signal)
        if (failures > 0) options.log.info({ failures }, 'arrival coverage poll recovered')
        failures = 0
      } catch (error) {
        failures += 1
        if (failures === 1 || failures % ARRIVAL_COVERAGE_POLL_LOG_EVERY === 0) {
          options.log.warn({ err: error, failures }, 'arrival coverage poll failed')
        }
      }
      current = null
      schedule(again ? 0 : intervalMs)
    })()
  }

  void options.ready.then(() => schedule(0))

  return {
    close: async () => {
      closed = true
      if (timer !== null) clearTimeout(timer)
      timer = null
      controller.abort()
      await current
    },
  }
}
