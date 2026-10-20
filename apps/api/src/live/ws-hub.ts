/**
 * WebSocket merkezi (D-074): bağlı istemcileri, görünümlerini ve kaynak turlarından üretilen
 * hücre farklarını yönetir. Fastify ve `ws`'ten bağımsızdır; soket yalnızca `HubSocket`
 * arayüzüyle kullanılır (bağlama `ws.ts`'tedir).
 *
 * - Her turda dokunulan hücrenin parçası, ona ihtiyaç duyan ilk istemcide bir kez serileştirilir;
 *   aynı hücreyi gören bütün istemcilerin mesajı bu ortak Buffer'lardan kurulur.
 * - İstemci başına saniyede en fazla bir diff gider; arada biriken turlar birleştirilir.
 * - `lastSeq` ile devam: merkezin kendi hücre geçmişi (son 120 tur) yetiyorsa eksik turlar tek
 *   diff olarak, yetmiyorsa tam görüntü gönderilir.
 * - Abonelik (tam görüntü) soket başına saniyede bir ve IP başına dakikada `/v1/live` sınırı
 *   kadardır; fazlası atılmaz, en son istenen görünüm ilk uygun anda işlenir.
 * - Gönderim tamponu soket başına (1 MiB atla / 4 MiB kapat) ve bütün merkezde (64 MiB) sınırlıdır.
 */
import type { FastifyBaseLogger } from 'fastify'
import { LIVE_RATE_LIMIT } from './routes'
import type { Bbox, LiveSource, TickDiff } from './types'
import {
  CellTracker,
  cellRange,
  diffMessage,
  diffPrefix,
  encodeCell,
  errorMessage,
  inCellRange,
  mergeCellChanges,
  parseClientMessage,
  reconnectMessage,
  snapshotMessage,
  type CellChange,
  type CellRange,
  type SubscribeMessage,
} from './ws-protocol'

/** Hub'ın kullandığı soket yüzeyi; `ws` WebSocket'i bunu karşılar. */
export interface HubSocket {
  readonly bufferedAmount: number
  send(data: Buffer | string, options: { binary: boolean }): void
  close(code: number, reason: string): void
  terminate(): void
  ping(): void
}

export type HubLog = Pick<FastifyBaseLogger, 'debug' | 'info' | 'warn' | 'error'>

/** WebSocket kapanış kodları (RFC 6455 ve IANA kaydı). */
export const WS_CLOSE = {
  policyViolation: 1008,
  serviceRestart: 1012,
  tryAgainLater: 1013,
} as const

export const WS_LIMITS = {
  /** Aynı IP'den (IPv6'da /64) açık bağlantı sayısı. */
  perIp: 10,
  /** İstemci başına iki diff arası en kısa süre. */
  diffIntervalMs: 1_000,
  /**
   * Soket başına iki abonelik (tam görüntü ya da `lastSeq` farkı) arası en kısa süre; arada
   * gelenlerden yalnızca sonuncusu işlenir.
   */
  subscribeIntervalMs: 1_000,
  /**
   * IP (/64) başına, o IP'nin bütün soketlerince paylaşılan abonelik bütçesi: `/v1/live` sınırıyla
   * aynı (dakikada 120). Kova dolu başlar ve 60 sn'de dolar (GCRA); bütçe bitince abonelik
   * ertelenir, atılmaz.
   */
  ipSubscribesPerMinute: LIVE_RATE_LIMIT.max,
  /** Bu kadar gönderilmemiş veri varsa diff atlanır, sonra tam görüntü gönderilir. */
  softBufferBytes: 1024 * 1024,
  /** Bu kadar gönderilmemiş veri varsa bağlantı hemen koparılır (terminate). */
  hardBufferBytes: 4 * 1024 * 1024,
  /**
   * Bütün istemcilerin gönderilmemiş verisinin toplam üst sınırı. hy-api `mem_limit` 384m, heap
   * sınırı 270m (`--max-old-space-size`); gönderim tamponları heap dışındadır ve kalan ≈ 114 MiB'ın
   * 64 MiB'ını geçmez. Soket başına 1 MiB sınırı tek başına yetmez: 2.000 yavaş istemci 2 GiB
   * tutabilir. Her turda toplam aşılırsa en çok biriktiren istemciler hemen koparılır: `close()`
   * okumayan istemcinin tamponunu kapanış süresi (30 sn) boyunca tutar, `terminate()` hemen bırakır.
   */
  totalBufferBytes: 64 * 1024 * 1024,
  /** Bu sayıda hatalı mesajda bağlantı 1008 ile kapatılır. */
  badMessages: 5,
  /** Yanıtlanmayan ping sayısı; aşılınca bağlantı sonlandırılır. */
  missedPongs: 2,
  /** Tutulan hücre farkı turu (LiveCache'in fark tamponuyla aynı). */
  historyTicks: 120,
  /** Kapanışta istemcilerin kapanmasının beklendiği en uzun süre. */
  closeGraceMs: 3_000,
  reconnectMinMs: 1_000,
  reconnectMaxMs: 10_000,
} as const

export const DEFAULT_PING_INTERVAL_MS = 25_000

export interface HubOptions {
  source: LiveSource
  log: HubLog
  maxConnections: number
  now?: () => number
  random?: () => number
  pingIntervalMs?: number
  /** Yalnızca test: `WS_LIMITS.totalBufferBytes` yerine geçer. */
  totalBufferBytes?: number
}

export interface HubClient {
  readonly socket: HubSocket
  readonly ipKey: string
  viewport: Bbox | null
  range: CellRange | null
  /** İstemciye ulaştırılmış son `seq` (tam görüntü ya da diff ile). */
  sentSeq: number
  lastDiffAt: number
  diffTimer: ReturnType<typeof setTimeout> | null
  needsSnapshot: boolean
  pendingSubscribe: SubscribeMessage | null
  subscribeTimer: ReturnType<typeof setTimeout> | null
  lastSubscribeAt: number
  subscribedOnce: boolean
  missedPongs: number
  badMessages: number
  closing: boolean
}

export interface HubStats {
  clients: number
  /** Serileştirilen hücre parçası sayısı (istemci sayısından bağımsız olmalı). */
  cellEncodes: number
  snapshots: number
  diffs: number
  backpressureSkips: number
  backpressureCloses: number
  /** Toplam tampon bütçesi aşıldığı için kapatılan istemci. */
  budgetCloses: number
  /** Soket ya da IP sınırı yüzünden ertelenen abonelik işlemesi. */
  deferredSubscribes: number
  pingTerminations: number
  rejected: number
}

/** IP başına abonelik bütçesinin iki abonelik arası payı (dakikada 120 → 500 ms). */
const IP_SUBSCRIBE_EMISSION_MS = 60_000 / WS_LIMITS.ipSubscribesPerMinute
/** Kova doluyken art arda kabul edilen abonelik sayısı dakikalık bütçedir. */
const IP_SUBSCRIBE_BURST_MS = (WS_LIMITS.ipSubscribesPerMinute - 1) * IP_SUBSCRIBE_EMISSION_MS

/** Bir turun (ya da birleştirilmiş turların) hücre farkları ve tembel serileştirilmiş parçaları. */
class Batch {
  private readonly encoded = new Map<string, Buffer>()

  constructor(
    readonly changes: ReadonlyMap<string, CellChange>,
    private readonly onEncode: () => void,
  ) {}

  /** Görünümle kesişen hücrelerin ortak Buffer'ları; her hücre bir kez serileştirilir. */
  fragments(range: CellRange): Buffer[] {
    const out: Buffer[] = []
    for (const change of this.changes.values()) {
      if (!inCellRange(range, change.latIndex, change.lonIndex)) continue
      let fragment = this.encoded.get(change.key)
      if (!fragment) {
        fragment = encodeCell(change)
        this.encoded.set(change.key, fragment)
        this.onEncode()
      }
      out.push(fragment)
    }
    return out
  }

  release(): void {
    this.encoded.clear()
  }
}

const EMPTY_CHANGES: ReadonlyMap<string, CellChange> = new Map()

export class LiveHub {
  private readonly source: LiveSource
  private readonly log: HubLog
  private readonly maxConnections: number
  private readonly now: () => number
  private readonly random: () => number
  private readonly pingIntervalMs: number
  private readonly totalBufferBytes: number

  private readonly clients = new Set<HubClient>()
  private readonly perIp = new Map<string, number>()
  /**
   * IP başına abonelik bütçesi (GCRA): bir sonraki aboneliğin "teorik varış zamanı". Değer şimdiden
   * küçükse kova doludur ve kayıt silinebilir; IP'nin son soketi kapansa da kayıt kova dolana kadar
   * kalır (yeniden bağlanarak bütçe sıfırlanamaz).
   */
  private readonly ipSubscribeTat = new Map<string, number>()
  private readonly cells = new CellTracker()
  private history: { seq: number; batch: Batch }[] = []
  private readonly merged = new Map<number, Batch>()
  private prefix: Buffer | null = null
  private seq = 0
  private started = false
  private shuttingDown = false
  private unsubscribe: (() => void) | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private readonly drainWaiters = new Set<() => void>()
  private readonly lastWarnAt = new Map<string, number>()
  private readonly counters: Omit<HubStats, 'clients'> = {
    cellEncodes: 0,
    snapshots: 0,
    diffs: 0,
    backpressureSkips: 0,
    backpressureCloses: 0,
    budgetCloses: 0,
    deferredSubscribes: 0,
    pingTerminations: 0,
    rejected: 0,
  }
  private readonly countEncode = () => {
    this.counters.cellEncodes += 1
  }

  constructor(options: HubOptions) {
    this.source = options.source
    this.log = options.log
    this.maxConnections = options.maxConnections
    this.now = options.now ?? (() => Date.now())
    this.random = options.random ?? (() => Math.random())
    this.pingIntervalMs = options.pingIntervalMs ?? DEFAULT_PING_INTERVAL_MS
    this.totalBufferBytes = options.totalBufferBytes ?? WS_LIMITS.totalBufferBytes
  }

  /** Kaynağa abone olur, hücre indeksini kurar ve ping döngüsünü başlatır. */
  start(): void {
    if (this.started) return
    this.started = true
    this.seq = this.source.seq()
    this.cells.reset(this.source.all())
    this.unsubscribe = this.source.onTick((diff) => this.handleTick(diff))
    this.pingTimer = setInterval(() => this.pingAll(), this.pingIntervalMs)
    this.pingTimer.unref()
  }

  /** Aboneliği ve zamanlayıcıları bırakır (uygulama kapanışı). Soketleri Fastify kapatır. */
  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.pingTimer) clearInterval(this.pingTimer)
    this.pingTimer = null
    for (const client of this.clients) this.clearTimers(client)
    this.started = false
  }

  stats(): HubStats {
    return { clients: this.clients.size, ...this.counters }
  }

  /**
   * `afterSeq`'ten sonraki turların görünümle kesişen ortak hücre parçaları; geçmiş yetmiyorsa
   * null. İstemci mesajları da bu Buffer'lardan kurulur.
   */
  fragmentsSince(afterSeq: number, viewport: Bbox): Buffer[] | null {
    return this.batchSince(afterSeq)?.fragments(cellRange(viewport)) ?? null
  }

  private batchSince(afterSeq: number): Batch | null {
    if (afterSeq >= this.seq) return new Batch(EMPTY_CHANGES, this.countEncode)
    const last = this.history.at(-1)
    if (afterSeq === this.seq - 1 && last?.seq === this.seq) return last.batch
    const cached = this.merged.get(afterSeq)
    if (cached) return cached
    const first = this.history[0]
    if (!first || first.seq > afterSeq + 1) return null
    const ticks = this.history.filter((entry) => entry.seq > afterSeq).map((e) => e.batch.changes)
    const batch = new Batch(mergeCellChanges(ticks), this.countEncode)
    this.merged.set(afterSeq, batch)
    return batch
  }

  /**
   * Yeni bağlantıyı sınırlara göre kabul eder. Kapanışta `reconnect` + 1012, toplam sınırda
   * 1013 `server_busy`, IP sınırında 1008 `too_many_connections` ile kapatır ve null döner.
   */
  connect(socket: HubSocket, ipKey: string): HubClient | null {
    if (this.shuttingDown) {
      socket.send(reconnectMessage(this.reconnectDelay()), { binary: false })
      socket.close(WS_CLOSE.serviceRestart, 'restart')
      this.counters.rejected += 1
      return null
    }
    if (this.clients.size >= this.maxConnections) {
      this.warnThrottled('busy', { limit: this.maxConnections }, 'ws connection limit reached')
      socket.close(WS_CLOSE.tryAgainLater, 'server_busy')
      this.counters.rejected += 1
      return null
    }
    const open = this.perIp.get(ipKey) ?? 0
    if (open >= WS_LIMITS.perIp) {
      this.log.debug({ limit: WS_LIMITS.perIp }, 'ws per-ip limit reached')
      socket.close(WS_CLOSE.policyViolation, 'too_many_connections')
      this.counters.rejected += 1
      return null
    }
    const client: HubClient = {
      socket,
      ipKey,
      viewport: null,
      range: null,
      sentSeq: 0,
      lastDiffAt: Number.NEGATIVE_INFINITY,
      diffTimer: null,
      needsSnapshot: false,
      pendingSubscribe: null,
      subscribeTimer: null,
      lastSubscribeAt: Number.NEGATIVE_INFINITY,
      subscribedOnce: false,
      missedPongs: 0,
      badMessages: 0,
      closing: false,
    }
    this.clients.add(client)
    this.perIp.set(ipKey, open + 1)
    return client
  }

  /** Soketin `close` olayı: istemci bütün sayaçlardan düşer. Tekrar çağrılması etkisizdir. */
  disconnected(client: HubClient): void {
    if (!this.clients.delete(client)) return
    this.clearTimers(client)
    client.closing = true
    const open = (this.perIp.get(client.ipKey) ?? 1) - 1
    if (open > 0) this.perIp.set(client.ipKey, open)
    else this.perIp.delete(client.ipKey)
    if (this.clients.size === 0) {
      for (const resolve of this.drainWaiters) resolve()
    }
  }

  pong(client: HubClient): void {
    client.missedPongs = 0
  }

  /** İstemci mesajı. Hatalı mesaj `error` alır; 5. hatalı mesajda bağlantı 1008 ile kapanır. */
  message(client: HubClient, text: string | null): void {
    if (client.closing) return
    const parsed = text === null ? null : parseClientMessage(text)
    if (!parsed) {
      client.badMessages += 1
      this.send(client, errorMessage('bad_request'))
      if (client.badMessages >= WS_LIMITS.badMessages) {
        this.closeClient(client, WS_CLOSE.policyViolation, 'bad_request')
      }
      return
    }
    // Bekleyen abonelik en son istenen görünümle değişir; zamanlayıcı onu işler.
    client.pendingSubscribe = parsed
    if (client.subscribeTimer) return
    this.trySubscribe(client)
  }

  /**
   * Bekleyen aboneliği soket (saniyede bir) ve IP (dakikada 120, soketlerce paylaşılır) sınırı
   * izin veriyorsa hemen işler; vermiyorsa ilk uygun ana zamanlar. Zamanlayıcı dolduğunda IP
   * bütçesini aynı IP'nin başka soketi almışsa yeniden zamanlanır: abonelik atılmaz.
   */
  private trySubscribe(client: HubClient): void {
    if (client.closing || !client.pendingSubscribe) return
    const now = this.now()
    const wait = Math.max(
      client.lastSubscribeAt + WS_LIMITS.subscribeIntervalMs - now,
      this.ipSubscribeWait(client.ipKey, now),
    )
    if (wait > 0) {
      this.counters.deferredSubscribes += 1
      client.subscribeTimer = setTimeout(() => {
        client.subscribeTimer = null
        this.trySubscribe(client)
      }, wait)
      return
    }
    this.takeIpSubscribe(client.ipKey, now)
    this.applySubscribe(client)
  }

  /** IP'nin bir sonraki aboneliğine kalan süre, ms (0: şimdi). */
  private ipSubscribeWait(ipKey: string, now: number): number {
    const tat = this.ipSubscribeTat.get(ipKey)
    return tat === undefined ? 0 : Math.max(0, Math.ceil(tat - IP_SUBSCRIBE_BURST_MS - now))
  }

  private takeIpSubscribe(ipKey: string, now: number): void {
    const tat = this.ipSubscribeTat.get(ipKey) ?? now
    this.ipSubscribeTat.set(ipKey, Math.max(tat, now) + IP_SUBSCRIBE_EMISSION_MS)
  }

  /** Kovası dolmuş IP kayıtlarını siler (dolu kova yeni kovayla aynıdır). */
  private pruneIpBudgets(now: number): void {
    for (const [ipKey, tat] of this.ipSubscribeTat) {
      if (tat <= now) this.ipSubscribeTat.delete(ipKey)
    }
  }

  /**
   * SIGTERM yolu: yeni bağlantı kabul edilmez, her istemciye 1–10 sn rastgele `reconnect`
   * gönderilir ve bağlantı 1012 ile kapatılır. Hepsi kapanınca ya da 3 sn sonra çözülür; o ana
   * kadar kapanmayan soketler sonlandırılır.
   */
  closeAll(): Promise<void> {
    this.shuttingDown = true
    for (const client of this.clients) {
      if (client.closing) continue
      this.send(client, reconnectMessage(this.reconnectDelay()))
      this.closeClient(client, WS_CLOSE.serviceRestart, 'restart')
    }
    if (this.clients.size === 0) return Promise.resolve()
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer)
        this.drainWaiters.delete(finish)
        resolve()
      }
      const timer = setTimeout(() => {
        for (const client of this.clients) client.socket.terminate()
        finish()
      }, WS_LIMITS.closeGraceMs)
      this.drainWaiters.add(finish)
    })
  }

  private reconnectDelay(): number {
    const span = WS_LIMITS.reconnectMaxMs - WS_LIMITS.reconnectMinMs
    return WS_LIMITS.reconnectMinMs + Math.min(span, Math.floor(this.random() * (span + 1)))
  }

  private handleTick(diff: TickDiff): void {
    if (diff.seq <= this.seq) return
    this.enforceBufferBudget()
    const previous = this.history.at(-1)
    previous?.batch.release()
    this.merged.clear()
    this.prefix = null
    if (diff.seq !== this.seq + 1) {
      // Kaçırılmış tur: hücre geçmişi güvenilmez. İndeks kaynaktan yeniden kurulur, abone
      // istemciler tam görüntü alır.
      this.warnThrottled('gap', { from: this.seq, to: diff.seq }, 'ws hub missed live ticks')
      this.cells.reset(this.source.all())
      this.history = []
      this.seq = diff.seq
      for (const client of this.clients) {
        if (!client.viewport || client.closing) continue
        client.needsSnapshot = true
        this.schedule(client)
      }
      return
    }
    const batch = new Batch(this.cells.apply(diff), this.countEncode)
    this.history.push({ seq: diff.seq, batch })
    if (this.history.length > WS_LIMITS.historyTicks) this.history.shift()
    this.seq = diff.seq
    for (const client of this.clients) {
      if (!client.viewport || client.closing) continue
      // Durum uçaklardan bağımsız değiştiyse (canlı katman, D-115) görünümü boş olan istemci de
      // haber almalı: boş diff gönderilmez, tam görüntü gönderilir.
      if (diff.statusChanged) client.needsSnapshot = true
      this.schedule(client)
    }
  }

  /** Saniyede bir diff sınırı: süre dolduysa hemen gönderir, dolmadıysa bir kez zamanlar. */
  private schedule(client: HubClient): void {
    if (client.diffTimer) return
    const wait = client.lastDiffAt + WS_LIMITS.diffIntervalMs - this.now()
    if (wait <= 0) {
      this.flush(client)
      return
    }
    client.diffTimer = setTimeout(() => {
      client.diffTimer = null
      this.flush(client)
    }, wait)
  }

  private flush(client: HubClient): void {
    if (client.closing || !client.range) return
    if (!this.hasRoom(client)) return
    if (client.needsSnapshot) {
      this.sendSnapshot(client)
      return
    }
    if (client.sentSeq >= this.seq) return
    const batch = this.batchSince(client.sentSeq)
    if (!batch) {
      this.sendSnapshot(client)
      return
    }
    const fragments = batch.fragments(client.range)
    client.sentSeq = this.seq
    // Görünümle kesişen hücrede değişiklik yoksa mesaj gönderilmez.
    if (fragments.length === 0) return
    this.sendDiff(client, fragments)
  }

  private applySubscribe(client: HubClient): void {
    const message = client.pendingSubscribe
    if (!message || client.closing) return
    client.pendingSubscribe = null
    client.lastSubscribeAt = this.now()
    const firstSubscribe = !client.subscribedOnce
    client.subscribedOnce = true
    client.viewport = message.viewport
    client.range = cellRange(message.viewport)
    if (!this.hasRoom(client)) return
    if (firstSubscribe && message.lastSeq !== undefined && this.resume(client, message.lastSeq)) {
      return
    }
    this.sendSnapshot(client)
  }

  /**
   * `lastSeq`'ten bu yana eksik turları tek diff olarak gönderir (boş olsa da: istemci güncel
   * olduğunu anlar). Sayaç ileride, kaynak tamponu ya da hücre geçmişi yetmiyorsa false döner.
   */
  private resume(client: HubClient, lastSeq: number): boolean {
    if (!client.range || lastSeq > this.seq || this.seq !== this.source.seq()) return false
    if (this.source.diffsSince(lastSeq) === null) return false
    const batch = this.batchSince(lastSeq)
    if (!batch) return false
    client.sentSeq = this.seq
    // Son turdan bu yana çok zaman geçmiş olabilir (veri kesintisinde tur gelmez): turda bir kez
    // kurulan baş değil, o anki durumla yeni bir baş kullanılır.
    this.sendDiff(client, batch.fragments(client.range), diffPrefix(this.seq, this.source.status()))
    return true
  }

  /** `prefix` verilmezse turda bir kez kurulan ortak baş kullanılır (flush yolu, tura ≤ 1 sn). */
  private sendDiff(client: HubClient, fragments: readonly Buffer[], prefix?: Buffer): void {
    const head = prefix ?? (this.prefix ??= diffPrefix(this.seq, this.source.status()))
    client.lastDiffAt = this.now()
    this.counters.diffs += 1
    this.send(client, diffMessage(head, fragments))
  }

  private sendSnapshot(client: HubClient): void {
    const viewport = client.viewport
    if (!viewport) return
    const seq = this.source.seq()
    const message = snapshotMessage(
      seq,
      this.source.coverage(viewport),
      this.source.status(),
      this.source.snapshot(viewport),
    )
    client.needsSnapshot = false
    client.sentSeq = seq
    client.lastDiffAt = this.now()
    this.counters.snapshots += 1
    this.send(client, message)
  }

  /**
   * Geri basınç: 4 MiB üstünde bağlantı hemen koparılır (tampon anında serbest kalır); 1 MiB
   * üstünde bu gönderim atlanır ve sonraki uygun turda tam görüntü gider.
   */
  private hasRoom(client: HubClient): boolean {
    const buffered = client.socket.bufferedAmount
    if (buffered > WS_LIMITS.hardBufferBytes) {
      this.counters.backpressureCloses += 1
      this.log.info({ buffered }, 'ws client terminated for backpressure')
      this.dropClient(client)
      return false
    }
    if (buffered > WS_LIMITS.softBufferBytes) {
      this.counters.backpressureSkips += 1
      client.needsSnapshot = true
      return false
    }
    return true
  }

  /**
   * Merkez geneli tampon bütçesi (her turda): kapanmakta olmayan istemcilerin gönderilmemiş verisi
   * toplamı `totalBufferBytes`'ı aşarsa en çok biriktirenden başlayarak istemciler koparılır
   * (`terminate`), toplam bütçenin altına inene kadar. Koparma tamponu hemen serbest bırakır ve
   * bağlantı sayaçlarından düşer; `close()` okumayan istemcide tamponu 30 sn tutardı.
   */
  private enforceBufferBudget(): void {
    let total = 0
    const lagging: { client: HubClient; buffered: number }[] = []
    for (const client of this.clients) {
      if (client.closing) continue
      const buffered = client.socket.bufferedAmount
      if (buffered <= 0) continue
      total += buffered
      lagging.push({ client, buffered })
    }
    if (total <= this.totalBufferBytes) return
    const before = total
    lagging.sort((a, b) => b.buffered - a.buffered)
    let closed = 0
    for (const { client, buffered } of lagging) {
      if (total <= this.totalBufferBytes) break
      this.dropClient(client)
      total -= buffered
      closed += 1
    }
    this.counters.budgetCloses += closed
    this.warnThrottled(
      'budget',
      { buffered: before, budget: this.totalBufferBytes, closed },
      'ws send buffers over budget; closed the most lagging clients',
    )
  }

  private pingAll(): void {
    this.pruneIpBudgets(this.now())
    for (const client of this.clients) {
      if (client.closing) continue
      if (client.missedPongs >= WS_LIMITS.missedPongs) {
        this.counters.pingTerminations += 1
        client.closing = true
        this.clearTimers(client)
        client.socket.terminate()
        continue
      }
      client.missedPongs += 1
      client.socket.ping()
    }
  }

  private send(client: HubClient, data: Buffer | string): void {
    client.socket.send(data, { binary: false })
  }

  /** Okumayan istemciyi hemen koparır: gönderilmemiş tampon anında serbest kalır. */
  private dropClient(client: HubClient): void {
    client.closing = true
    this.clearTimers(client)
    client.socket.terminate()
  }

  private closeClient(client: HubClient, code: number, reason: string): void {
    client.closing = true
    this.clearTimers(client)
    client.socket.close(code, reason)
  }

  private clearTimers(client: HubClient): void {
    if (client.diffTimer) clearTimeout(client.diffTimer)
    if (client.subscribeTimer) clearTimeout(client.subscribeTimer)
    client.diffTimer = null
    client.subscribeTimer = null
  }

  private warnThrottled(kind: string, fields: Record<string, unknown>, message: string): void {
    const now = this.now()
    const last = this.lastWarnAt.get(kind)
    if (last !== undefined && now - last < 60_000) return
    this.lastWarnAt.set(kind, now)
    this.log.warn(fields, message)
  }
}
