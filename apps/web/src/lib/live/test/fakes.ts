// Yalnızca canlı harita mantık testlerinde kullanılan ikameler (üretim kodu bunları import edemez).
import type { LiveStatus, PublicAircraft } from '@havayolu/shared'

/** Test uçağı: THY974, İstanbul üstünde seyirde; alanlar `overrides` ile değişir. */
export function aircraft(overrides: Partial<PublicAircraft> = {}): PublicAircraft {
  return {
    hex: '4bb1c5',
    lat: 41.2,
    lon: 28.7,
    alt: 35_000,
    gnd: false,
    gs: 450,
    trk: 90,
    vr: 0,
    cs: 'THY974',
    fn: { airline: 'TK', number: '974' },
    reg: 'TC-JJA',
    type: 'B77W',
    cat: 'A5',
    sq: '2000',
    src: 'adsbLol',
    psrc: 'adsb_icao',
    t: 1_000,
    ...overrides,
  }
}

export const STATUS: LiveStatus = {
  providers: { adsbLol: 'ok' },
  primaryAgeS: 2,
  newestAgeS: 1,
}

type Listener = (event: { data?: unknown; code?: number }) => void

/**
 * Tarayıcı WebSocket'inin bağlantının kullandığı yüzeyi: `on*` işleyicileri, `send`, `close` ve
 * `readyState`. Testte sunucu tarafı `serverOpen`, `serverSend`, `serverClose` ile sürülür.
 */
export class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []

  readonly url: string
  readyState = FakeWebSocket.CONNECTING
  readonly sent: string[] = []
  closedWith: { code: number | undefined; reason: string | undefined } | null = null
  onopen: Listener | null = null
  onmessage: Listener | null = null
  onclose: Listener | null = null
  onerror: Listener | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  static reset(): void {
    FakeWebSocket.instances = []
  }

  static last(): FakeWebSocket {
    const socket = FakeWebSocket.instances.at(-1)
    if (!socket) throw new Error('no socket was created')
    return socket
  }

  send(data: string): void {
    if (this.readyState !== FakeWebSocket.OPEN) throw new Error('socket is not open')
    this.sent.push(data)
  }

  close(code?: number, reason?: string): void {
    this.closedWith = { code, reason }
    this.readyState = FakeWebSocket.CLOSED
  }

  /** Gönderilen mesajlar, JSON çözülmüş. */
  messages(): unknown[] {
    return this.sent.map((text) => JSON.parse(text) as unknown)
  }

  serverOpen(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.({})
  }

  serverSend(message: unknown): void {
    this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) })
  }

  serverClose(code = 1006): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code })
  }

  serverError(): void {
    this.onerror?.({})
  }
}

/** Elle ilerletilen zamanlayıcılar: `setTimer`/`clearTimer` seçenekleri için. */
export class FakeTimers {
  private next = 1
  readonly pending = new Map<number, { fn: () => void; ms: number }>()

  readonly setTimer = (fn: () => void, ms: number): unknown => {
    const id = this.next++
    this.pending.set(id, { fn, ms })
    return id
  }

  readonly clearTimer = (handle: unknown): void => {
    this.pending.delete(handle as number)
  }

  /** Bekleyen tek zamanlayıcının süresi; birden fazla ya da hiç yoksa hata. */
  only(): number {
    const entries = [...this.pending.values()]
    const [entry] = entries
    if (!entry || entries.length !== 1) {
      throw new Error(`expected one pending timer, found ${entries.length}`)
    }
    return entry.ms
  }

  /** Bekleyen bütün zamanlayıcıları çalıştırır (sıra: kurulma sırası). */
  runAll(): void {
    const entries = [...this.pending.entries()]
    this.pending.clear()
    for (const [, entry] of entries) entry.fn()
  }
}
