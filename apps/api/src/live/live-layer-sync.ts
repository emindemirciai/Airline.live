import { PeriodicSync, type PeriodicSyncLog } from './periodic-sync'

/**
 * Canlı katman anahtarının (D-115) API'deki kopyası. Durum PostgreSQL'dedir (`live_layer_state`;
 * satır yoksa açık). 2 sn'de bir okunur; admin anahtarı değiştirince API kendi kopyasını hemen
 * yeniler (`refresh`). Kapalıyken REST, arama ve WS boş küme ve `status.layer: "off"` döner.
 *
 * Engel listesi gibi kapalı başlar: ilk başarılı okumaya kadar canlı veri sunulmaz. Veritabanı
 * tanımsızsa anahtar tutulamaz: katman açıktır ve hemen yüklenmiş sayılır.
 */
export const LIVE_LAYER_REFRESH_MS = 2_000

export interface LiveLayerSyncOptions {
  /** Katman açık mı; `null`: veritabanı yok. */
  read: (() => Promise<boolean>) | null
  log: PeriodicSyncLog
  now?: () => number
  refreshMs?: number
}

export class LiveLayerSync extends PeriodicSync<boolean> {
  constructor(options: LiveLayerSyncOptions) {
    const refreshMs = options.refreshMs ?? LIVE_LAYER_REFRESH_MS
    super({
      read: options.read,
      initial: true,
      log: options.log,
      now: options.now,
      refreshMs,
      retryMs: refreshMs,
      texts: {
        loaded: 'live layer state loaded',
        loadedFields: (on) => ({ layer: on ? 'on' : 'off' }),
        readFailedLoaded: 'live layer state could not be read; keeping the last state',
        readFailedUnloaded: 'live layer state could not be read; live data withheld until it loads',
      },
      onRead: (on, previous, first) => {
        if (!first && on !== previous) {
          options.log.info({ layer: on ? 'on' : 'off' }, 'live layer changed')
        }
      },
    })
  }
}
