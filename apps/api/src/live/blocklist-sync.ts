/**
 * Yöneticinin hex engel listesinin API'deki kopyası (D-074). Liste `redis-queue`'dan okunur.
 *
 * Kapalı başlar: ilk başarılı okumaya kadar `loaded()` false'tur ve canlı veri sunulmaz (REST 503,
 * WS 1013); engelli bir uçak açılışta bir an bile görünmesin. İlk okuma başarısızsa 5 sn'de bir
 * yeniden denenir, sonra 30 sn'de bir yenilenir. Sonraki okuma hataları son iyi listeyi korur.
 * `redis-queue` tanımsızsa liste tutulamaz ve yönetilemez (admin uçları da kapalıdır): liste boştur
 * ve hemen yüklenmiş sayılır.
 */

/** Liste yüklendikten sonraki yenileme aralığı. */
export const BLOCKLIST_REFRESH_MS = 30_000
/** İlk başarılı okumaya kadar yeniden deneme aralığı. */
export const BLOCKLIST_RETRY_MS = 5_000
/** Tekrarlayan okuma uyarısının en sık yazım aralığı. */
const WARN_INTERVAL_MS = 60_000

export interface BlocklistSyncLog {
  info(fields: object, message: string): void
  warn(fields: object, message: string): void
}

export interface BlocklistSyncOptions {
  /** Listenin tamamını okur; `null`: depo yok (redis-queue tanımsız). */
  read: (() => Promise<ReadonlySet<string>>) | null
  log: BlocklistSyncLog
  now?: () => number
  refreshMs?: number
  retryMs?: number
}

export class BlocklistSync {
  private readonly read: (() => Promise<ReadonlySet<string>>) | null
  private readonly log: BlocklistSyncLog
  private readonly now: () => number
  private readonly refreshMs: number
  private readonly retryMs: number

  private list: ReadonlySet<string> = new Set()
  private loadedFlag: boolean
  private stopped = false
  private started = false
  private timer: NodeJS.Timeout | null = null
  private warnedAt: number | null = null
  private readonly waiters = new Set<(loaded: boolean) => void>()

  constructor(options: BlocklistSyncOptions) {
    this.read = options.read
    this.log = options.log
    this.now = options.now ?? Date.now
    this.refreshMs = options.refreshMs ?? BLOCKLIST_REFRESH_MS
    this.retryMs = options.retryMs ?? BLOCKLIST_RETRY_MS
    this.loadedFlag = options.read === null
  }

  /** Güncel liste (yüklenmeden önce boş; `loaded()` false iken canlı veri sunulmamalı). */
  current(): ReadonlySet<string> {
    return this.list
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

  /** Bir okuma; başarılıysa true. Hata son iyi listeyi değiştirmez. */
  async refresh(): Promise<boolean> {
    if (this.read === null) return true
    try {
      const list = await this.read()
      if (this.stopped) return false
      this.list = list
      if (!this.loadedFlag) {
        this.loadedFlag = true
        this.log.info({ hexes: list.size }, 'blocklist loaded; live data enabled')
        this.settle(true)
      }
      return true
    } catch (error) {
      const t = this.now()
      if (this.warnedAt === null || t - this.warnedAt >= WARN_INTERVAL_MS) {
        this.warnedAt = t
        this.log.warn(
          { err: error, loaded: this.loadedFlag },
          this.loadedFlag
            ? 'blocklist could not be read; keeping the last list'
            : 'blocklist could not be read; live data withheld until it loads',
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
