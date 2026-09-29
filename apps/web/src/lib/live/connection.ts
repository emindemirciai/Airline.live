/**
 * `/v1/ws` istemcisi (D-074, infra.md → SIGTERM davranışı). Görünüm aboneliğini gönderir, gelen
 * metin çerçevelerini savunmacı biçimde çözer ve bağlantı koparsa yeniden bağlanır:
 *
 * - Beklenmeyen kapanış ya da hata: `reconnectDelayMs(deneme)` sonra (1–10 sn rastgele pay +
 *   üstel geri çekilme, en fazla 60 sn). 8 ardışık başarısızlıktan sonra durum `offline` olur,
 *   denemeler yaklaşık dakikada bir sürer. Abonelik yanıtı (tam görüntü ya da devam farkı) gelince
 *   deneme sayacı sıfırlanır.
 * - Sunucunun `{type:'reconnect', afterMs}` mesajı (kapanış): bağlantı kapatılır, tam `afterMs`
 *   sonra yeniden bağlanılır; başarısızlık sayılmaz.
 * - Yeniden bağlanınca ilk abonelik son `seq`'i (`lastSeq`) taşır; yalnızca görünüm o `seq`
 *   alındığından beri değişmediyse. Sunucu eksik turları tek fark olarak ya da tam görüntü olarak
 *   gönderir.
 *
 * Görünüm değişikliklerini çağıran seyreltir ve hücre ızgarasına yuvarlar (subscription.ts); aynı
 * görünüm yeniden gönderilmez, `refresh` aynı aboneliği bilerek yeniden gönderir. React'ten
 * bağımsızdır; zamanlayıcı ve WebSocket sınıfı testte değiştirilebilir.
 */
import type { Bbox, LiveServerMessage, LiveSubscribeMessage } from '@havayolu/shared'
import { parseServerMessage } from './validate'

export type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'offline'

export interface LiveConnectionOptions {
  url: string
  onMessage: (m: LiveServerMessage) => void
  onState: (s: ConnectionState) => void
  WebSocketImpl?: { new (url: string): WebSocket }
  random?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (h: unknown) => void
}

/** Bu kadar ardışık başarısızlıktan sonra durum `offline` olur (denemeler sürer). */
export const OFFLINE_AFTER_FAILURES = 8

/** Üstel geri çekilmenin üst sınırı; üstüne 1–10 sn rastgele pay eklenir. */
export const RECONNECT_BACKOFF_MAX_MS = 60_000

/** Sunucunun `reconnect.afterMs` değeri için güvenlik sınırı (sunucu 1–10 sn gönderir). */
export const SERVER_RECONNECT_MAX_MS = 60_000

/** API'nin görünüm sınırı (apps/api/src/live/bbox.ts `BBOX_MAX_SPAN`). */
export const VIEWPORT_MAX_SPAN = { lon: 60, lat: 40 } as const

/** Web Mercator'un gösterebildiği enlem sınırı (yuvarlatılmış). */
const MAX_LAT = 85
/** Sunucu min < max ister; sıfır boyutlu harita (gizli kapsayıcı) da geçerli kutu üretsin. */
const MIN_SPAN = 0.001
/** Kayan nokta payı: kırpılan kutu sınırın bir ulp üstüne çıkmasın. */
const SPAN_EPSILON = 1e-6
const MAX_ZOOM = 24

const WS_OPEN = 1
const NORMAL_CLOSURE = 1000

/**
 * `attempt` 0'dan başlar: min(60 sn, 1 sn × 2^attempt) + 1 sn + rastgele 0–9 sn.
 * İlk yeniden bağlanma 2–11 sn, altıncıdan sonrası 61–70 sn sürer.
 */
export function reconnectDelayMs(attempt: number, random: () => number): number {
  const exponent = Math.max(0, Math.floor(attempt))
  return Math.min(RECONNECT_BACKOFF_MAX_MS, 1000 * 2 ** exponent) + 1000 + random() * 9000
}

/** [lo, hi] aralığını sınırlara kırpar, merkezi etrafında `maxSpan`'a daraltır, en az MIN_SPAN yapar. */
function fitRange(
  lo: number,
  hi: number,
  bound: number,
  maxSpan: number,
): { min: number; max: number } {
  let min = Math.max(Math.min(lo, hi), -bound)
  let max = Math.min(Math.max(lo, hi), bound)
  if (!(min < max)) {
    // Kutu tümüyle sınırın dışında ya da sıfır boyutlu: en yakın geçerli noktaya indirgenir.
    const centre = Math.min(Math.max((lo + hi) / 2, -bound), bound)
    min = centre
    max = centre
  }
  const limit = maxSpan - SPAN_EPSILON
  if (max - min > limit) {
    const centre = (min + max) / 2
    min = centre - limit / 2
    max = centre + limit / 2
  }
  if (max - min < MIN_SPAN) {
    const centre = Math.min(Math.max((min + max) / 2, -bound + MIN_SPAN / 2), bound - MIN_SPAN / 2)
    min = centre - MIN_SPAN / 2
    max = centre + MIN_SPAN / 2
  }
  return { min, max }
}

const finiteOr = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)

/**
 * Harita sınırlarını API'nin kabul ettiği kutuya çevirir: dünya kopyasındaki (boylamı ±180'i
 * aşan) görünüm merkezi −180..180'e taşınır, enlem ±85'e, boylam ±180'e kırpılır ve kutu
 * merkezinin etrafında en fazla 60° × 40°'ye daraltılır.
 */
export function clampViewport(b: Bbox): Bbox {
  const minLon = finiteOr(b.minLon, -180)
  const maxLon = finiteOr(b.maxLon, 180)
  const shift = 360 * Math.round((minLon + maxLon) / 2 / 360)
  const lon = fitRange(minLon - shift, maxLon - shift, 180, VIEWPORT_MAX_SPAN.lon)
  const lat = fitRange(
    finiteOr(b.minLat, -MAX_LAT),
    finiteOr(b.maxLat, MAX_LAT),
    MAX_LAT,
    VIEWPORT_MAX_SPAN.lat,
  )
  return { minLon: lon.min, minLat: lat.min, maxLon: lon.max, maxLat: lat.max }
}

function sameBbox(a: Bbox, b: Bbox): boolean {
  return (
    a.minLon === b.minLon && a.minLat === b.minLat && a.maxLon === b.maxLon && a.maxLat === b.maxLat
  )
}

export class LiveConnection {
  private readonly options: LiveConnectionOptions
  private readonly random: () => number
  private readonly setTimer: (fn: () => void, ms: number) => unknown
  private readonly clearTimer: (h: unknown) => void

  private running = false
  private socket: WebSocket | null = null
  private timer: { handle: unknown } | null = null
  private currentState: ConnectionState | null = null
  /** Ardışık başarısız bağlantı sayısı; abonelik yanıtı gelince sıfırlanır. */
  private failures = 0
  private viewport: { bbox: Bbox; zoom: number } | null = null
  /** Bu soketteki son aboneliğin görünümü. */
  private sentViewport: Bbox | null = null
  private lastSeq: number | null = null
  /** `lastSeq`'in ait olduğu görünüm. */
  private seqViewport: Bbox | null = null
  /** Yeni soketin ilk aboneliği `lastSeq` taşıyabilir mi (yeniden bağlanma)? */
  private resume = false

  constructor(options: LiveConnectionOptions) {
    this.options = options
    this.random = options.random ?? Math.random
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearTimer =
      options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  }

  get state(): ConnectionState | null {
    return this.currentState
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.failures = 0
    this.resume = false
    this.setState('connecting')
    this.connect()
  }

  /** Görünüm aboneliği; aynı görünüm (ve yakınlaştırma) yeniden gönderilmez. */
  setViewport(viewport: Bbox, zoom: number): void {
    const z = Number.isFinite(zoom) ? Math.min(Math.max(zoom, 0), MAX_ZOOM) : 0
    const current = this.viewport
    if (current && current.zoom === z && sameBbox(current.bbox, viewport)) return
    this.viewport = { bbox: { ...viewport }, zoom: z }
    this.sendSubscribe()
  }

  /**
   * Aynı aboneliği yeniden gönderir (`lastSeq` olmadan): sunucu güncel durumla yeni bir tam görüntü
   * yollar. Sunucu yalnızca görünümde değişiklik olunca mesaj gönderdiğinden, uzun süre mesaj
   * gelmeyen sakin bir görünümde sağlayıcı durumu ve veri yaşı bununla tazelenir (use-live.ts).
   * Bağlantı açık değilse etkisizdir; açılınca abonelik zaten gönderilir.
   */
  refresh(): void {
    if (this.socket?.readyState !== WS_OPEN) return
    this.resume = false
    this.sendSubscribe()
  }

  /** Zamanlayıcıları iptal eder ve soketi 1000 koduyla kapatır. */
  stop(): void {
    this.running = false
    this.cancelTimer()
    if (this.socket) this.detach(this.socket)
    this.currentState = null
  }

  private connect(): void {
    const Impl = this.options.WebSocketImpl ?? globalThis.WebSocket
    let socket: WebSocket
    try {
      socket = new Impl(this.options.url)
    } catch {
      this.fail(null)
      return
    }
    this.socket = socket
    this.sentViewport = null
    socket.onopen = () => {
      if (this.socket !== socket) return
      this.setState('open')
      this.sendSubscribe()
    }
    socket.onmessage = (event: MessageEvent) => {
      if (this.socket === socket) this.handleMessage(event.data)
    }
    socket.onclose = () => {
      if (this.socket === socket) this.fail(socket)
    }
    socket.onerror = () => {
      if (this.socket === socket) this.fail(socket)
    }
  }

  private sendSubscribe(): void {
    const socket = this.socket
    const viewport = this.viewport
    if (!socket || socket.readyState !== WS_OPEN || !viewport) return
    const message: LiveSubscribeMessage = {
      type: 'subscribe',
      viewport: viewport.bbox,
      zoom: viewport.zoom,
    }
    if (
      this.resume &&
      this.lastSeq !== null &&
      this.seqViewport !== null &&
      sameBbox(this.seqViewport, viewport.bbox)
    ) {
      message.lastSeq = this.lastSeq
    }
    this.resume = false
    socket.send(JSON.stringify(message))
    this.sentViewport = viewport.bbox
  }

  private handleMessage(data: unknown): void {
    const message = parseServerMessage(data)
    if (!message) return
    if (message.type === 'snapshot' || message.type === 'diff') {
      this.lastSeq = message.seq
      this.seqViewport = this.sentViewport
      this.failures = 0
    }
    if (message.type === 'reconnect') this.reconnectAfter(message.afterMs)
    this.options.onMessage(message)
  }

  /** Sunucunun istediği yeniden bağlanma (kapanış); başarısızlık sayılmaz. */
  private reconnectAfter(afterMs: number): void {
    if (this.socket) this.detach(this.socket)
    if (!this.running) return
    this.resume = true
    this.setState('reconnecting')
    this.schedule(Math.min(afterMs, SERVER_RECONNECT_MAX_MS))
  }

  private fail(socket: WebSocket | null): void {
    if (socket) this.detach(socket)
    if (!this.running) return
    this.failures += 1
    this.resume = true
    this.setState(this.failures >= OFFLINE_AFTER_FAILURES ? 'offline' : 'reconnecting')
    this.schedule(reconnectDelayMs(this.failures - 1, this.random))
  }

  /** Soketin işleyicilerini bırakır ve kapatır; sonraki olayları yok sayılır. */
  private detach(socket: WebSocket): void {
    socket.onopen = null
    socket.onmessage = null
    socket.onclose = null
    socket.onerror = null
    if (this.socket === socket) this.socket = null
    try {
      socket.close(NORMAL_CLOSURE)
    } catch {
      // Kapanmış ya da kapanmakta olan soket: yapılacak bir şey yok.
    }
  }

  private schedule(ms: number): void {
    this.cancelTimer()
    const timer = {
      handle: this.setTimer(() => {
        if (this.timer !== timer) return
        this.timer = null
        if (this.running) this.connect()
      }, ms),
    }
    this.timer = timer
  }

  private cancelTimer(): void {
    if (this.timer) this.clearTimer(this.timer.handle)
    this.timer = null
  }

  private setState(state: ConnectionState): void {
    if (state === this.currentState) return
    this.currentState = state
    this.options.onState(state)
  }
}
