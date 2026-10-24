// Yalnızca WebSocket testlerinde kullanılan ikameler (üretim kodu bunları import edemez).
import type { HubSocket } from '../ws-hub'
import type {
  Bbox,
  CoverageState,
  LiveSource,
  PublicAircraft,
  ServedLiveStatus,
  TickDiff,
} from '../types'

export function aircraft(
  hex: string,
  lat: number,
  lon: number,
  overrides: Partial<PublicAircraft> = {},
): PublicAircraft {
  return {
    hex,
    lat,
    lon,
    alt: 12_000,
    gnd: false,
    gs: 420,
    trk: 90,
    vr: 0,
    cs: 'THY974',
    fn: { airline: 'TK', number: '974' },
    reg: 'TC-JRE',
    type: 'A321',
    cat: 'A3',
    sq: '2201',
    src: 'adsbLol',
    psrc: 'adsb_icao',
    t: 1_790_000_000_000,
    ...overrides,
  }
}

function inside(ac: PublicAircraft, b: Bbox): boolean {
  return ac.lat >= b.minLat && ac.lat <= b.maxLat && ac.lon >= b.minLon && ac.lon <= b.maxLon
}

/** Bellekteki canlı kaynak: `tick` bir turu uygular, seq'i artırır ve dinleyicilere bildirir. */
export class FakeLiveSource implements LiveSource {
  private current: number
  private readonly state = new Map<string, PublicAircraft>()
  private readonly history: TickDiff[] = []
  private readonly listeners = new Set<(diff: TickDiff) => void>()
  historyLimit = 120
  liveStatus: ServedLiveStatus = {
    providers: { adsbLol: 'ok' },
    primaryAgeS: 4,
    newestAgeS: 1,
    layer: 'on',
    maxAgeS: 120,
  }
  coverageState: CoverageState = 'full'

  constructor(initial: readonly PublicAircraft[] = [], seq = 0) {
    this.current = seq
    for (const ac of initial) this.state.set(ac.hex, ac)
  }

  seq(): number {
    return this.current
  }

  snapshot(bbox?: Bbox): PublicAircraft[] {
    const all = [...this.state.values()]
    return bbox ? all.filter((ac) => inside(ac, bbox)) : all
  }

  get(hex: string): PublicAircraft | undefined {
    return this.state.get(hex)
  }

  all(): Iterable<PublicAircraft> {
    return this.state.values()
  }

  diffsSince(afterSeq: number): TickDiff[] | null {
    if (afterSeq > this.current) return null
    const oldest = this.history[0]?.seq ?? this.current + 1
    if (afterSeq < oldest - 1) return null
    return this.history.filter((diff) => diff.seq > afterSeq)
  }

  status(): ServedLiveStatus {
    return this.liveStatus
  }

  coverage(): CoverageState {
    return this.coverageState
  }

  onTick(listener: (diff: TickDiff) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get listenerCount(): number {
    return this.listeners.size
  }

  /**
   * Değişiklikleri tek tur olarak uygular; değişiklik yoksa seq artmaz ve null döner.
   * `statusChanged` (canlı katman, D-115): fark boş olsa da tur sayılır.
   */
  tick(change: {
    upsert?: readonly PublicAircraft[]
    remove?: readonly string[]
    statusChanged?: boolean
  }): TickDiff | null {
    const diff: TickDiff = {
      seq: this.current + 1,
      added: [],
      updated: [],
      removed: [],
      ...(change.statusChanged ? { statusChanged: true as const } : {}),
    }
    for (const ac of change.upsert ?? []) {
      ;(this.state.has(ac.hex) ? diff.updated : diff.added).push(ac)
      this.state.set(ac.hex, ac)
    }
    for (const hex of change.remove ?? []) {
      const previous = this.state.get(hex)
      if (!previous) continue
      diff.removed.push({ hex, lat: previous.lat, lon: previous.lon })
      this.state.delete(hex)
    }
    const empty = diff.added.length + diff.updated.length + diff.removed.length === 0
    if (empty && !change.statusChanged) return null
    this.current = diff.seq
    this.history.push(diff)
    while (this.history.length > this.historyLimit) this.history.shift()
    for (const listener of this.listeners) listener(diff)
    return diff
  }

  /** Dinleyicilere haber vermeden `count` tur ilerler (kaçırılmış tur senaryosu). */
  skipSilently(count: number, upsert: readonly PublicAircraft[] = []): void {
    for (const ac of upsert) this.state.set(ac.hex, ac)
    this.current += count
    this.history.length = 0
  }
}

export type WsMessage = Record<string, unknown> & { type: string }

/** Hub'a verilen sahte soket; `close`/`terminate` kapanış olayını mikro görevde tetikler. */
export class FakeSocket implements HubSocket {
  bufferedAmount = 0
  /** Gönderilen çerçeveler; `at` gönderim anıdır (sahte saatle). */
  readonly frames: { data: Buffer | string; binary: boolean; at: number }[] = []
  closed: { code: number; reason: string } | null = null
  terminated = false
  pings = 0
  /** false: istemci kapanış el sıkışmasını hiç tamamlamaz (kapanış süresi testi). */
  closesOnRequest = true
  onClose: (() => void) | null = null

  send(data: Buffer | string, options: { binary: boolean }): void {
    this.frames.push({ data, binary: options.binary, at: Date.now() })
  }

  close(code: number, reason: string): void {
    if (this.closed || this.terminated) return
    this.closed = { code, reason }
    if (this.closesOnRequest) queueMicrotask(() => this.onClose?.())
  }

  terminate(): void {
    if (this.terminated) return
    this.terminated = true
    queueMicrotask(() => this.onClose?.())
  }

  ping(): void {
    this.pings += 1
  }

  messages(): WsMessage[] {
    return this.frames.map((frame) => JSON.parse(frame.data.toString()) as WsMessage)
  }

  last(): WsMessage | undefined {
    return this.messages().at(-1)
  }

  clear(): void {
    this.frames.length = 0
  }
}
