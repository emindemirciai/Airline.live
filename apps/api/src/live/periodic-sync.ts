/**
 * Bir depodan aralıklı okunan değerin API'deki kopyası (D-074, D-115): hex engel listesi
 * (`BlocklistSync`) ve canlı katman anahtarı (`LiveLayerSync`).
 *
 * Kapalı başlar: ilk başarılı okumaya kadar `loaded()` false'tur ve canlı veri sunulmaz (REST 503,
 * WS 1013). İlk okuma başarısızsa `retryMs`'de bir yeniden denenir, sonra `refreshMs`'de bir
 * yenilenir. Sonraki okuma hataları son iyi değeri korur. Depo yoksa (`read` null) başlangıç değeri
 * geçerlidir ve hemen yüklenmiş sayılır.
 */

/** Tekrarlayan okuma uyarısının en sık yazım aralığı. */
const WARN_INTERVAL_MS = 60_000

export interface PeriodicSyncLog {
  info(fields: object, message: string): void
  warn(fields: object, message: string): void
}

export interface PeriodicSyncTexts<T> {
  /** İlk başarılı okumanın info logu; alanlar değerin özetidir (içerik yazılmaz). */
  loaded: string
  loadedFields: (value: T) => object
  /** Yüklendikten sonraki okuma hatası. */
  readFailedLoaded: string
  /** İlk başarılı okumadan önceki okuma hatası. */
  readFailedUnloaded: string
}

export interface PeriodicSyncOptions<T> {
  /** Değerin tamamını okur; `null`: depo yok. */
  read: (() => Promise<T>) | null
  /** Yüklenmeden önceki (ve depo yoksa geçerli) değer. */
  initial: T
  log: PeriodicSyncLog
  texts: PeriodicSyncTexts<T>
  refreshMs: number
  retryMs: number
  now?: () => number
  /** Her başarılı okumada, önceki değerle birlikte çağrılır (ör. değişikliği loglamak için). */
  onRead?: (value: T, previous: T, first: boolean) => void
}

export class PeriodicSync<T> {
  private readonly read: (() => Promise<T>) | null
  private readonly log: PeriodicSyncLog
  private readonly texts: PeriodicSyncTexts<T>
  private readonly now: () => number
  private readonly refreshMs: number
  private readonly retryMs: number
  private readonly onRead: ((value: T, previous: T, first: boolean) => void) | null

  private value: T
  private loadedFlag: boolean
  private stopped = false
  private started = false
  private timer: NodeJS.Timeout | null = null
  private warnedAt: number | null = null
  private readonly waiters = new Set<(loaded: boolean) => void>()

  constructor(options: PeriodicSyncOptions<T>) {
    this.read = options.read
    this.value = options.initial
    this.log = options.log
    this.texts = options.texts
    this.now = options.now ?? Date.now
    this.refreshMs = options.refreshMs
    this.retryMs = options.retryMs
    this.onRead = options.onRead ?? null
    this.loadedFlag = options.read === null
  }

  /** Güncel değer (yüklenmeden önce başlangıç değeri; `loaded()` false iken canlı veri sunulmamalı). */
  current(): T {
    return this.value
  }

  /** En az bir kez başarıyla okundu mu (ya da depo yok mu). */
  loaded(): boolean {
    return this.loadedFlag
  }

  /** İlk okumayı hemen yapar; sonra yüklenene kadar `retryMs`, yüklendikten sonra `refreshMs`. */
  start(): void {
    if (this.started || this.stopped) return
    this.started = true
    if (this.read === null) return
    void this.run()
  }

  /** Zamanlayıcıyı durdurur; yüklenmeyi bekleyenler `false` ile çözülür. */
  stop(): void {
    this.stopped = true
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.settle(false)
  }

  /** İlk başarılı okumada `true`, ondan önce durdurulursa `false` ile çözülür. */
  whenLoaded(): Promise<boolean> {
    if (this.loadedFlag) return Promise.resolve(true)
    if (this.stopped) return Promise.resolve(false)
    return new Promise((resolve) => this.waiters.add(resolve))
  }

  /** Bir okuma; başarılıysa true. Hata son iyi değeri değiştirmez. */
  async refresh(): Promise<boolean> {
    if (this.read === null) return true
    try {
      const value = await this.read()
      if (this.stopped) return false
      const previous = this.value
      const first = !this.loadedFlag
      this.value = value
      if (first) {
        this.loadedFlag = true
        this.log.info(this.texts.loadedFields(value), this.texts.loaded)
        this.settle(true)
      }
      this.onRead?.(value, previous, first)
      return true
    } catch (error) {
      const t = this.now()
      if (this.warnedAt === null || t - this.warnedAt >= WARN_INTERVAL_MS) {
        this.warnedAt = t
        this.log.warn(
          { err: error, loaded: this.loadedFlag },
          this.loadedFlag ? this.texts.readFailedLoaded : this.texts.readFailedUnloaded,
        )
      }
      return false
    }
  }

  private async run(): Promise<void> {
    await this.refresh()
    if (this.stopped) return
    this.timer = setTimeout(() => void this.run(), this.loadedFlag ? this.refreshMs : this.retryMs)
    this.timer.unref()
  }

  private settle(loaded: boolean): void {
    for (const resolve of this.waiters) resolve(loaded)
    this.waiters.clear()
  }
}
