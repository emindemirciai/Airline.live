/** Rapor sürerken sayfa bu aralıkla yenilenir. */
export const AUTO_REFRESH_INTERVAL_MS = 5_000
/**
 * Yenileme bu süreden sonra durur (kuyrukta 15 dk, çalışırken 20 dk zaman aşımından sonra rapor
 * zaten "Hata" görünür; açık kalan sekme API'yi sonsuza dek yoklamaz).
 */
export const AUTO_REFRESH_MAX_MS = 25 * 60_000

/**
 * Yenilemenin izlediği etkin rapor. Sayfa listeyi alamadıysa (`undefined`: API yeniden başlıyor,
 * kısa bir 502) son bilinen değer korunur: döngü ve 25 dk sınırı sürer, sonraki başarılı yenileme
 * durumu düzeltir. Liste alındıysa API'nin etkin raporu (yoksa null) geçerlidir.
 */
export function nextRefreshActiveId(
  known: number | null,
  incoming: number | null | undefined,
): number | null {
  return incoming === undefined ? known : incoming
}

export interface AutoRefreshLoopOptions {
  /** Sayfayı yeniler (`router.refresh`). */
  refresh: () => void
  /** Süre dolunca bir kez çağrılır. */
  onStop: () => void
  now?: () => number
  intervalMs?: number
  maxMs?: number
}

/**
 * Kapsama raporu sayfasının kendini yenileme döngüsü (saf; istemci bileşeni `auto-refresh.tsx`
 * kullanır). `start` anından itibaren her `intervalMs`'de `refresh` çağrılır; `maxMs` dolunca döngü
 * kendini durdurur ve `onStop`'u çağırır.
 */
export class AutoRefreshLoop {
  private timer: ReturnType<typeof setInterval> | null = null
  private startedAt = 0
  private readonly now: () => number
  private readonly intervalMs: number
  private readonly maxMs: number

  constructor(private readonly options: AutoRefreshLoopOptions) {
    this.now = options.now ?? Date.now
    this.intervalMs = options.intervalMs ?? AUTO_REFRESH_INTERVAL_MS
    this.maxMs = options.maxMs ?? AUTO_REFRESH_MAX_MS
  }

  get running(): boolean {
    return this.timer !== null
  }

  start(): void {
    if (this.timer !== null) return
    this.startedAt = this.now()
    this.timer = setInterval(() => this.tick(), this.intervalMs)
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  private tick(): void {
    if (this.now() - this.startedAt >= this.maxMs) {
      this.stop()
      this.options.onStop()
      return
    }
    this.options.refresh()
  }
}
