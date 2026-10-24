'use client'

import type { Bbox, LiveServerMessage } from '@havayolu/shared'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { monotonicNow } from '../../lib/live/clock'
import { LiveConnection, type ConnectionState } from '../../lib/live/connection'
import { liveMaxAgeMs } from '../../lib/live/interpolate'
import { AircraftStore } from '../../lib/live/store'
import { SubscriptionPlanner } from '../../lib/live/subscription'

/** Görünüm aboneliği `moveend`'den bu kadar sonra gönderilir (D-075). */
export const VIEWPORT_DEBOUNCE_MS = 250
/** Harita durmadan kaysa da abonelik en geç bu aralıkla güncellenir. */
export const VIEWPORT_MAX_WAIT_MS = 2_000
/** Eski uçakların atılma ve sessizlik denetiminin aralığı. */
export const PRUNE_INTERVAL_MS = 5_000
/**
 * Bağlantı açıkken bu kadar süre hiç mesaj gelmezse abonelik yenilenir: sunucu yalnızca görünümde
 * bir değişiklik olunca gönderir, sakin bir görünümde (ya da veri akışı durunca) sağlayıcı durumu ve
 * veri yaşı başka türlü tazelenmez. Sunucu sağlayıcı kaydını 30 sn'de bayat sayar (cache.ts).
 */
export const SILENCE_REFRESH_MS = 30_000
/** Tablo ve kart en fazla bu aralıkla yeniden çizilir (saniyede ~2). */
export const RENDER_INTERVAL_MS = 500

interface Pending {
  bbox: Bbox
  zoom: number
}

/**
 * Seyreltme: son değer `delayMs` sessizlikten sonra, sürekli değişimde en geç `maxWaitMs`'te
 * gönderilir. Zamanlayıcılar testte değiştirilebilir.
 */
export class ViewportDebouncer {
  private pending: Pending | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private firstPendingAt = 0

  constructor(
    private readonly send: (bbox: Bbox, zoom: number) => void,
    private readonly delayMs = VIEWPORT_DEBOUNCE_MS,
    private readonly maxWaitMs = VIEWPORT_MAX_WAIT_MS,
    private readonly now: () => number = monotonicNow,
  ) {}

  push(bbox: Bbox, zoom: number): void {
    const now = this.now()
    if (this.pending === null) this.firstPendingAt = now
    this.pending = { bbox, zoom }
    if (this.timer !== null) clearTimeout(this.timer)
    const wait = Math.min(this.delayMs, Math.max(0, this.firstPendingAt + this.maxWaitMs - now))
    this.timer = setTimeout(() => this.flush(), wait)
  }

  flush(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    const pending = this.pending
    this.pending = null
    if (pending) this.send(pending.bbox, pending.zoom)
  }

  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.pending = null
  }
}

/**
 * Deponun sürümünü React'e seyrelterek bildirir: ilk değişiklik hemen, sonrakiler en fazla
 * `intervalMs`'te bir. Çizim döngüsü depoyu doğrudan okur; bu yalnızca tablo ve kart içindir.
 */
export function throttledVersion(
  store: AircraftStore,
  intervalMs: number = RENDER_INTERVAL_MS,
  now: () => number = monotonicNow,
): { subscribe: (listener: () => void) => () => void; getSnapshot: () => number } {
  let published = store.version
  return {
    subscribe(listener) {
      let timer: ReturnType<typeof setTimeout> | null = null
      let last = -Infinity
      const publish = () => {
        timer = null
        last = now()
        published = store.version
        listener()
      }
      const unsubscribe = store.subscribe(() => {
        if (timer !== null) return
        const wait = last + intervalMs - now()
        if (wait <= 0) publish()
        else timer = setTimeout(publish, wait)
      })
      return () => {
        unsubscribe()
        if (timer !== null) clearTimeout(timer)
      }
    },
    getSnapshot: () => published,
  }
}

export interface LiveData {
  /** Canlı uçak kümesi; çizim döngüsü doğrudan okur. */
  store: AircraftStore
  /** Seyreltilmiş sürüm: değiştikçe tablo ve kart yeniden çizilir. */
  version: number
  connection: ConnectionState
  /** Harita görünümü (sınırlar ve yakınlaştırma); seyreltilip abonelik olarak gönderilir. */
  setViewport: (bounds: Bbox, zoom: number) => void
}

/**
 * Sessizlik bekçisi: son mesajdan (ya da son yenilemeden) bu yana `thresholdMs` geçtiyse ve
 * bağlantı açıksa `refresh` çağrılır. Zaman istemcinin geri gitmeyen saatidir.
 */
export class SilenceWatchdog {
  private lastActivity: number

  constructor(
    private readonly refresh: () => void,
    now: number,
    private readonly thresholdMs = SILENCE_REFRESH_MS,
  ) {
    this.lastActivity = now
  }

  /** Sunucudan mesaj geldi. */
  message(now: number): void {
    this.lastActivity = now
  }

  /** Düzenli denetim; bağlantı açık değilse yalnızca saat sıfırlanır (açılışta abonelik gider). */
  check(now: number, open: boolean): void {
    if (!open) {
      this.lastActivity = now
      return
    }
    if (now - this.lastActivity < this.thresholdMs) return
    this.lastActivity = now
    this.refresh()
  }
}

function handleMessage(store: AircraftStore, message: LiveServerMessage, now: number): void {
  switch (message.type) {
    case 'snapshot':
      store.applySnapshot(message, now)
      break
    case 'diff':
      store.applyDiff(message, now)
      break
    case 'error':
      console.warn(`Live connection error: ${message.code}`)
      break
    case 'reconnect':
      // Bağlantı kendisi yeniden bağlanır (connection.ts).
      break
  }
}

/**
 * Görünüm aboneliğinin bağlantıya iletilmesi: görünüm hücre ızgarasına yuvarlanır ve yalnızca
 * abonelik kutusu değişince (subscription.ts) seyreltilerek gönderilir; son abonelik saklanır,
 * bağlantı (yeniden) kurulunca hemen gönderilir.
 */
export class ViewportRelay {
  private connection: LiveConnection | null = null
  private viewport: Pending | null = null
  private readonly planner = new SubscriptionPlanner()
  readonly debouncer = new ViewportDebouncer((bbox, zoom) => {
    this.viewport = { bbox, zoom }
    this.connection?.setViewport(bbox, zoom)
  })

  /** Harita görünümü değişti; abonelik kutusu değişmediyse bir şey gönderilmez. */
  push(bounds: Bbox, zoom: number): void {
    const box = this.planner.next(bounds)
    if (box) this.debouncer.push(box, zoom)
  }

  /**
   * Bekleyen görünümü iptal eder; plan son gönderilen aboneliğe döner. Böylece aynı görünüm yeniden
   * bildirilince (ör. bileşen yeniden bağlanınca) gönderilir, "değişmedi" diye atlanmaz.
   */
  cancel(): void {
    this.debouncer.cancel()
    this.planner.reset(this.viewport?.bbox ?? null)
  }

  attach(connection: LiveConnection): void {
    this.connection = connection
    if (this.viewport) connection.setViewport(this.viewport.bbox, this.viewport.zoom)
  }

  detach(connection: LiveConnection): void {
    if (this.connection === connection) this.connection = null
  }
}

/**
 * Canlı veri: `AircraftStore` ve `/v1/ws` bağlantısı. Görünüm aboneliği hücre ızgarasına
 * yuvarlanır ve kutu değişince `moveend`'den 250 ms sonra gönderilir; örneği API'nin yaş
 * penceresinden (`status.maxAgeS`, varsayılan 120 sn) eski uçaklar 5 sn'de bir atılır; 30 sn mesaj gelmeyen açık bağlantıda abonelik yenilenir. Bileşen sökülünce bağlantı ve
 * zamanlayıcılar durur.
 */
export function useLive(wsUrl: string): LiveData {
  const [store] = useState(() => new AircraftStore())
  const [feed] = useState(() => throttledVersion(store))
  const version = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [relay] = useState(() => new ViewportRelay())

  useEffect(() => {
    const watchdog = new SilenceWatchdog(() => live.refresh(), monotonicNow())
    const live = new LiveConnection({
      url: wsUrl,
      onMessage: (message) => {
        const now = monotonicNow()
        watchdog.message(now)
        handleMessage(store, message, now)
      },
      onState: setConnection,
    })
    live.start()
    relay.attach(live)
    const prune = setInterval(() => {
      const now = monotonicNow()
      // Yaş penceresi API'nin durumundan (D-122): seyrek veride uçak iki sorgu arasında düşmez.
      store.prune(now, liveMaxAgeMs(store.status))
      watchdog.check(now, live.state === 'open')
    }, PRUNE_INTERVAL_MS)
    return () => {
      clearInterval(prune)
      relay.detach(live)
      live.stop()
    }
  }, [relay, store, wsUrl])

  useEffect(() => () => relay.cancel(), [relay])

  const setViewport = useCallback((bounds: Bbox, zoom: number) => relay.push(bounds, zoom), [relay])

  return { store, version, connection, setViewport }
}
