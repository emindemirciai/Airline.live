import { PeriodicSync, type PeriodicSyncLog } from './periodic-sync'

/**
 * Yöneticinin hex engel listesinin API'deki kopyası (D-074). Liste `redis-queue`'dan okunur.
 *
 * Kapalı başlar: ilk başarılı okumaya kadar `loaded()` false'tur ve canlı veri sunulmaz (REST 503,
 * WS 1013); engelli bir uçak açılışta bir an bile görünmesin. İlk okuma başarısızsa 5 sn'de bir
 * yeniden denenir, sonra 30 sn'de bir yenilenir. Sonraki okuma hataları son iyi listeyi korur.
 * `redis-queue` tanımsızsa liste tutulamaz ve yönetilemez (admin uçları da kapalıdır): liste boştur
 * ve hemen yüklenmiş sayılır. Ortak davranış `PeriodicSync`'tedir.
 */

/** Liste yüklendikten sonraki yenileme aralığı. */
export const BLOCKLIST_REFRESH_MS = 30_000
/** İlk başarılı okumaya kadar yeniden deneme aralığı. */
export const BLOCKLIST_RETRY_MS = 5_000

export type BlocklistSyncLog = PeriodicSyncLog

export interface BlocklistSyncOptions {
  /** Listenin tamamını okur; `null`: depo yok (redis-queue tanımsız). */
  read: (() => Promise<ReadonlySet<string>>) | null
  log: BlocklistSyncLog
  now?: () => number
  refreshMs?: number
  retryMs?: number
}

export class BlocklistSync extends PeriodicSync<ReadonlySet<string>> {
  constructor(options: BlocklistSyncOptions) {
    super({
      read: options.read,
      initial: new Set<string>(),
      log: options.log,
      now: options.now,
      refreshMs: options.refreshMs ?? BLOCKLIST_REFRESH_MS,
      retryMs: options.retryMs ?? BLOCKLIST_RETRY_MS,
      texts: {
        loaded: 'blocklist loaded; live data enabled',
        loadedFields: (list) => ({ hexes: list.size }),
        readFailedLoaded: 'blocklist could not be read; keeping the last list',
        readFailedUnloaded: 'blocklist could not be read; live data withheld until it loads',
      },
    })
  }
}
