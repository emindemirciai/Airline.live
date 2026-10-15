import {
  readCoverage,
  readLiveAircraftMany,
  readLiveChangedSince,
  readConfiguredProviders,
  readProviderLive,
  type AirlineCodes,
  type CoverageCircle,
} from '@havayolu/db'
import type { Redis } from 'ioredis'
import { coverageOf, inBbox } from './bbox'
import { toPublicAircraft } from './record'
import type {
  Bbox,
  CoverageState,
  LiveSource,
  ProviderState,
  PublicAircraft,
  ServedLiveStatus,
  TickDiff,
} from './types'

export const LIVE_CACHE_DEFAULTS = { pollMs: 1_000, maxAgeMs: 120_000, historyTicks: 120 } as const
/** Sağlayıcı durumu ve kapsama planı bu aralıkla yeniden okunur. */
export const AUX_REFRESH_MS = 5_000
/**
 * Worker sağlayıcı durumunu saniyede bir yazar (D-073). Kayıt bundan eskiyse worker durmuş ya da
 * `redis-live`'a yazamıyordur; kaydın TTL'i (180 sn) dolmasa da sağlayıcı `down` sayılır. API
 * kayıtları bu süreden uzun okuyamadıysa da (redis-live erişilemez) bilinen her sağlayıcı `down`
 * sayılır: donmuş bir `ok` boş haritanın yanında gösterilmez.
 */
export const PROVIDER_STALE_MS = 30_000
/**
 * Tek okumanın üst sınırı. Yanıt vermeyen bir bağlantı turu dondurmasın: tur son durumla biter,
 * yaş budaması çalışmaya devam eder.
 */
export const READ_TIMEOUT_MS = 5_000
/** Tekrarlayan uyarıların en sık yazım aralığı (tür başına). */
const WARN_INTERVAL_MS = 60_000
const LIVE_PROVIDERS = ['adsbLol', 'localReceiver'] as const
type LiveProviderId = (typeof LIVE_PROVIDERS)[number]
const PROVIDER_STATES = new Set<string>(['ok', 'degraded', 'down'])

export interface LiveCacheLog {
  debug(fields: object, message: string): void
  info(fields: object, message: string): void
  warn(fields: object, message: string): void
}

/** `redis-live` okumaları (packages/db); testler sahtesini verir. */
export interface LiveReaders {
  changedSince: typeof readLiveChangedSince
  aircraftMany: typeof readLiveAircraftMany
  providerLive: typeof readProviderLive
  coverage: typeof readCoverage
  configuredProviders: typeof readConfiguredProviders
}

const DEFAULT_READERS: LiveReaders = {
  changedSince: readLiveChangedSince,
  aircraftMany: readLiveAircraftMany,
  providerLive: readProviderLive,
  coverage: readCoverage,
  configuredProviders: readConfiguredProviders,
}

/** Okumayı süre sınırıyla sarar; süre dolarsa hata fırlatır (geç gelen yanıt yok sayılır). */
function bounded<A extends unknown[], R>(
  read: (...args: A) => Promise<R>,
  ms: number,
): (...args: A) => Promise<R> {
  return (...args) => {
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`redis-live read timed out after ${ms} ms`)), ms)
    })
    return Promise.race([read(...args), timeout]).finally(() => clearTimeout(timer))
  }
}

export interface LiveCacheOptions {
  redisLive: Redis
  /** Güncel havayolu kod eşlemeleri (sefer no için). */
  codes: () => AirlineCodes
  /** Güncel hex engel listesi (admin). */
  blocklist: () => ReadonlySet<string>
  /**
   * Canlı katman açık mı (admin anahtarı, D-115; varsayılan hep açık). Kapalıyken görünür küme
   * boştur; değişim turunda fark boş olsa da gönderilir (`statusChanged`).
   */
  layer?: () => boolean
  log: LiveCacheLog
  now?: () => number
  pollMs?: number
  /** Bu süreden eski örnek önbellekten budanır (D-074: silinme bununla anlaşılır). */
  maxAgeMs?: number
  /** `diffsSince` için tutulan son değişen tur sayısı. */
  historyTicks?: number
  /** Tek Redis okumasının üst sınırı (varsayılan `READ_TIMEOUT_MS`). */
  readTimeoutMs?: number
  /**
   * `seq`'in başlangıç değeri (varsayılan 0). Üretimde sürecin başlangıç anıdır (epoch ms): tur
   * en sık 250 ms'de bir olduğundan önceki süreçten kalan her `lastSeq` bu değerin altında kalır
   * ve yeniden bağlanan istemci yanlış süreçten fark değil tam görüntü alır (D-074).
   */
  seqBase?: number
  /** Yalnızca test: Redis okumalarının yerine geçer. */
  readers?: Partial<LiveReaders>
}

/** Son okunan sağlayıcı kaydı; `updatedAt` worker'ın yazdığı an (alan yoksa okunduğu an). */
interface ProviderRecord {
  status: ProviderState
  updatedAt: number
}

interface Known {
  /** `hy:ac:seen` skoru (`sampleTime`); değişmedikçe hash yeniden okunmaz. */
  score: number
  /** Gizlilik uygulanmış kayıt; geçersiz ya da gizli (askeri, bayrağı bilinmeyen) ise null. */
  aircraft: PublicAircraft | null
}

const round1 = (value: number) => Math.round(value * 10) / 10

/**
 * API'nin bellekteki canlı önbelleği (D-074). REST, arama ve WebSocket buradan okur.
 *
 * Her tur `hy:ac:seen`'den son `maxAgeMs` içindeki bütün uçakları skorlarıyla okur ve yalnızca
 * skoru değişenlerin hash'ini çeker. Pencere son yoklama zamanına göre değil yaşa göredir: adsb.lol
 * örneğinin `sampleTime`'ı yazıldığı andan saniyeler önce olabilir (`seen_pos`, çekim aralığı);
 * "son yoklamadan beri" penceresi böyle geç gelen örnekleri kaçırırdı.
 *
 * Görünür küme = canlı katman açıkken geçerli, gizli olmayan, engel listesinde olmayan ve
 * `maxAgeMs`'ten yeni kayıtlar (katman kapalıyken boş, D-115).
 * Bir önceki tura göre fark (eklenen, `t`'si değişen, çıkan) boş değilse `seq` artar, fark geçmişe
 * eklenir ve dinleyicilere bildirilir. Redis hatasında son durum sunulmaya devam eder (uyarı
 * dakikada bir); yaş budaması yine çalışır, 120 sn'den eski konum canlı diye sunulmaz.
 */
export class LiveCache implements LiveSource {
  private readonly redis: Redis
  private readonly codes: () => AirlineCodes
  private readonly blocklist: () => ReadonlySet<string>
  private readonly layer: () => boolean
  private readonly log: LiveCacheLog
  private readonly now: () => number
  private readonly pollMs: number
  private readonly maxAgeMs: number
  private readonly historyTicks: number
  private readonly read: LiveReaders

  private readonly known = new Map<string, Known>()
  private readonly visible = new Map<string, PublicAircraft>()
  private readonly history: TickDiff[] = []
  private readonly listeners = new Set<(diff: TickDiff) => void>()
  private readonly warnedAt = new Map<string, number>()
  private seqValue = 0
  /** Son turda uygulanan katman durumu; ilk turdan önce null. */
  private appliedLayer: boolean | null = null
  private newestT: number | null = null
  private providerRecords = new Map<LiveProviderId, ProviderRecord>()
  /**
   * Bu süreçte geçerli kaydı görülmüş sağlayıcılar. Kaydı sonradan kaybolan (worker 180 sn'den
   * uzun durdu, TTL doldu) sağlayıcı listeden düşmez, `down` görünür.
   */
  private readonly seenProviders = new Set<LiveProviderId>()
  /** Sağlayıcı kayıtlarının son başarıyla okunduğu an. */
  private providersReadAt: number | null = null
  /**
   * adsb.lol kaydındaki birincil istasyon yaşı ve kaydın yazıldığı an. Kayıt kaybolursa son değer
   * kalır ve yaşlanmaya devam eder (worker durmuşsa veri gerçekten o kadar eskidir).
   */
  private primary: { ageS: number; at: number } | null = null
  private circles: CoverageCircle[] | null = null
  private auxAt: number | null = null
  private ticking = false
  private stopped = true
  private timer: NodeJS.Timeout | null = null
  private loop: Promise<void> | null = null

  constructor(options: LiveCacheOptions) {
    this.redis = options.redisLive
    this.codes = options.codes
    this.blocklist = options.blocklist
    this.layer = options.layer ?? (() => true)
    this.log = options.log
    this.now = options.now ?? Date.now
    this.pollMs = options.pollMs ?? LIVE_CACHE_DEFAULTS.pollMs
    this.maxAgeMs = options.maxAgeMs ?? LIVE_CACHE_DEFAULTS.maxAgeMs
    this.historyTicks = options.historyTicks ?? LIVE_CACHE_DEFAULTS.historyTicks
    const base = options.seqBase ?? 0
    this.seqValue = Number.isSafeInteger(base) && base >= 0 ? base : 0
    const readers = { ...DEFAULT_READERS, ...options.readers }
    const timeoutMs = options.readTimeoutMs ?? READ_TIMEOUT_MS
    this.read = {
      changedSince: bounded(readers.changedSince, timeoutMs),
      aircraftMany: bounded(readers.aircraftMany, timeoutMs),
      providerLive: bounded(readers.providerLive, timeoutMs),
      coverage: bounded(readers.coverage, timeoutMs),
      configuredProviders: bounded(readers.configuredProviders, timeoutMs),
    }
  }

  // --- Yaşam döngüsü ------------------------------------------------------------------------

  /** İlk turu hemen, sonrakileri her tur bittikten `pollMs` sonra çalıştırır (turlar üst üste binmez). */
  start(): void {
    if (!this.stopped) return
    this.stopped = false
    const run = async () => {
      const started = this.now()
      try {
        await this.tick()
      } catch (error) {
        this.warnThrottled('tick', { err: error }, 'live cache tick failed')
      }
      if (this.stopped) return
      const wait = Math.max(0, this.pollMs - (this.now() - started))
      this.timer = setTimeout(() => {
        this.loop = run()
      }, wait)
    }
    this.loop = run()
  }

  /** Döngüyü durdurur; yoldaki tur bitince çözülür. */
  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    await this.loop
  }

  // --- Tur ----------------------------------------------------------------------------------

  /** Bir yoklama turu; görünür küme değiştiyse farkı döndürür, değişmediyse (ya da tur sürüyorsa) null. */
  async tick(): Promise<TickDiff | null> {
    if (this.ticking) return null
    this.ticking = true
    try {
      const t = this.now()
      const aux = this.auxAt === null || t - this.auxAt >= AUX_REFRESH_MS
      if (aux) this.auxAt = t
      await Promise.all([this.poll(t), aux ? this.refreshAux(t) : Promise.resolve()])
      return this.apply(t)
    } finally {
      this.ticking = false
    }
  }

  private async poll(t: number): Promise<void> {
    let present: Map<string, number>
    let fetched: Map<string, unknown>
    try {
      const changes = await this.read.changedSince(this.redis, t - this.maxAgeMs)
      present = new Map(changes.map((change) => [change.hex, change.sampleTime]))
      const stale = changes
        .filter((change) => this.known.get(change.hex)?.score !== change.sampleTime)
        .map((change) => change.hex)
      fetched = stale.length > 0 ? await this.read.aircraftMany(this.redis, stale) : new Map()
    } catch (error) {
      this.warnThrottled('poll', { err: error }, 'live state could not be read; serving last state')
      return
    }
    const codes = this.codes()
    for (const [hex, raw] of fetched) {
      const score = present.get(hex)
      if (score !== undefined)
        this.known.set(hex, { score, aircraft: toPublicAircraft(raw, codes) })
    }
    // Kümede artık olmayan (süpürülmüş ya da pencerenin dışına düşmüş) uçaklar unutulur.
    for (const hex of this.known.keys()) {
      if (!present.has(hex)) this.known.delete(hex)
    }
  }

  private apply(t: number): TickDiff | null {
    const blocked = this.blocklist()
    const layerOn = this.layer()
    const layerChanged = this.appliedLayer !== null && this.appliedLayer !== layerOn
    this.appliedLayer = layerOn
    const added: PublicAircraft[] = []
    const updated: PublicAircraft[] = []
    const removed: TickDiff['removed'] = []
    const remove = (hex: string, previous: PublicAircraft) => {
      removed.push({ hex, lat: previous.lat, lon: previous.lon })
      this.visible.delete(hex)
    }
    for (const [hex, entry] of this.known) {
      const aircraft = entry.aircraft
      const next =
        layerOn && aircraft !== null && !blocked.has(hex) && t - aircraft.t <= this.maxAgeMs
          ? aircraft
          : null
      const previous = this.visible.get(hex)
      if (next !== null && previous === undefined) {
        added.push(next)
        this.visible.set(hex, next)
      } else if (next !== null && previous !== undefined && next.t !== previous.t) {
        updated.push(next)
        this.visible.set(hex, next)
      } else if (next === null && previous !== undefined) {
        remove(hex, previous)
      }
    }
    for (const [hex, previous] of this.visible) {
      if (!this.known.has(hex)) remove(hex, previous)
    }

    let newest: number | null = null
    for (const aircraft of this.visible.values()) {
      if (newest === null || aircraft.t > newest) newest = aircraft.t
    }
    this.newestT = newest

    const empty = added.length === 0 && updated.length === 0 && removed.length === 0
    if (empty && !layerChanged) return null
    this.seqValue += 1
    const diff: TickDiff = {
      seq: this.seqValue,
      added,
      updated,
      removed,
      ...(layerChanged ? { statusChanged: true as const } : {}),
    }
    this.history.push(diff)
    if (this.history.length > this.historyTicks) {
      this.history.splice(0, this.history.length - this.historyTicks)
    }
    for (const listener of this.listeners) {
      try {
        listener(diff)
      } catch (error) {
        this.log.warn({ err: error }, 'live tick listener failed')
      }
    }
    return diff
  }

  /**
   * Sağlayıcı kayıtları ve kapsama planı; okunamazsa önceki değer korunur. Bayatlık `status()`'ta
   * o anki saate göre hesaplanır (okuma hatası sürerken de işler).
   */
  private async refreshAux(t: number): Promise<void> {
    await Promise.all([
      (async () => {
        try {
          const [records, configured] = await Promise.all([
            Promise.all(
              LIVE_PROVIDERS.map(
                async (id) => [id, await this.read.providerLive(this.redis, id)] as const,
              ),
            ),
            this.read.configuredProviders(this.redis),
          ])
          // Worker'ın yapılandırdığı sağlayıcı, canlı kaydı hiç görülmemiş olsa da (API worker
          // çökükken açıldıysa) bilinir; kaydı yoksa "down" raporlanır.
          for (const id of configured ?? []) {
            if ((LIVE_PROVIDERS as readonly string[]).includes(id)) {
              this.seenProviders.add(id as LiveProviderId)
            }
          }
          const next = new Map<LiveProviderId, ProviderRecord>()
          let primary = this.primary
          for (const [id, fields] of records) {
            if (fields === null || fields.status === undefined) continue
            if (!PROVIDER_STATES.has(fields.status)) continue
            const updatedAt = Number(fields.updatedAt)
            const at = fields.updatedAt !== undefined && Number.isFinite(updatedAt) ? updatedAt : t
            next.set(id, { status: fields.status as ProviderState, updatedAt: at })
            this.seenProviders.add(id)
            if (id === 'adsbLol') {
              const ageS = Number(fields.primaryAgeS)
              primary =
                fields.primaryAgeS !== undefined && Number.isFinite(ageS) ? { ageS, at } : null
            }
          }
          this.providerRecords = next
          this.providersReadAt = t
          this.primary = primary
        } catch (error) {
          this.warnThrottled('providers', { err: error }, 'provider live state could not be read')
        }
      })(),
      (async () => {
        try {
          this.circles = await this.read.coverage(this.redis)
        } catch (error) {
          this.warnThrottled('coverage', { err: error }, 'coverage plan could not be read')
        }
      })(),
    ])
  }

  private warnThrottled(key: string, fields: object, message: string): void {
    const t = this.now()
    const last = this.warnedAt.get(key)
    if (last !== undefined && t - last < WARN_INTERVAL_MS) return
    this.warnedAt.set(key, t)
    this.log.warn(fields, message)
  }

  // --- LiveSource ---------------------------------------------------------------------------

  seq(): number {
    return this.seqValue
  }

  snapshot(bbox?: Bbox): PublicAircraft[] {
    const out: PublicAircraft[] = []
    for (const aircraft of this.visible.values()) {
      if (bbox === undefined || inBbox(aircraft, bbox)) out.push(aircraft)
    }
    return out
  }

  get(hex: string): PublicAircraft | undefined {
    return this.visible.get(hex)
  }

  all(): Iterable<PublicAircraft> {
    return this.visible.values()
  }

  /**
   * `afterSeq`'ten sonraki farklar. İstemci güncelse boş dizi; tampon yetmiyorsa (önceki sürecin
   * `seq`'i `seqBase`'in altında kaldığı için buna düşer), `afterSeq` bu süreçten büyükse ya da
   * geçersizse null (tam görüntü gönderilir).
   */
  diffsSince(afterSeq: number): TickDiff[] | null {
    if (!Number.isInteger(afterSeq) || afterSeq < 0 || afterSeq > this.seqValue) return null
    if (afterSeq === this.seqValue) return []
    const first = this.history[0]
    if (first === undefined || first.seq > afterSeq + 1) return null
    return this.history.slice(afterSeq + 1 - first.seq)
  }

  /**
   * Sağlayıcı durumu o anki saate göre: kaydı 30 sn'den eski, kaydı kaybolmuş ya da kayıtları
   * 30 sn'dir okunamayan (daha önce görülmüş) sağlayıcı `down`. Hiç görülmemiş sağlayıcı yer almaz.
   * `layer`: son turda uygulanan katman durumu (ilk turdan önce anahtarın kendisi).
   */
  status(): ServedLiveStatus {
    const t = this.now()
    const readFresh = this.providersReadAt !== null && t - this.providersReadAt <= PROVIDER_STALE_MS
    const providers: Partial<Record<LiveProviderId, ProviderState>> = {}
    for (const id of LIVE_PROVIDERS) {
      if (!this.seenProviders.has(id)) continue
      const record = this.providerRecords.get(id)
      providers[id] =
        readFresh && record !== undefined && t - record.updatedAt <= PROVIDER_STALE_MS
          ? record.status
          : 'down'
    }
    return {
      providers,
      primaryAgeS:
        this.primary === null
          ? null
          : round1(this.primary.ageS + Math.max(0, t - this.primary.at) / 1000),
      newestAgeS: this.newestT === null ? null : round1(Math.max(0, t - this.newestT) / 1000),
      layer: (this.appliedLayer ?? this.layer()) ? 'on' : 'off',
    }
  }

  coverage(bbox: Bbox): CoverageState {
    return coverageOf(bbox, this.circles)
  }

  onTick(listener: (diff: TickDiff) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
