import {
  activeStationsWithArp,
  addProviderHourly,
  createFlight,
  deleteProviderHealth,
  ensureTrackPartitions,
  loadActiveFlights,
  loadTrailingGroundStart,
  recordProviderStatusChange,
  sweepLive,
  writeConfiguredProviders,
  writeCoverage,
  writeLiveUpdates,
  writeProviderHealth,
  writeProviderLive,
  writeRegionFreshness,
  type CoverageCircle,
  type Database,
  type ProviderHealthSnapshot,
  type ProviderHourlyCounters,
  type StationArp,
  type TrackPointRow,
} from '@havayolu/db'
import { distanceNm } from '@havayolu/geo'
import {
  AdsbLolError,
  chunkHexes,
  createAdsbLolClient,
  createLocalReceiverClient,
  LIVE_SOURCE_IDS,
  parseReceiverUrls,
  ProviderLicenseError,
  providerUserAgent,
  trackSourceCode,
  type AdsbLolClient,
  type AdsbLolErrorKind,
  type AircraftState,
  type LiveSourceId,
  type LocalReceiverClient,
} from '@havayolu/providers'
import type { Redis } from 'ioredis'
import type { Logger } from 'pino'
import type { Env } from '../env'
import {
  continueFlight,
  decideFlight,
  FLIGHT_GAP_MS,
  restoredGroundState,
  startFlight,
  type FlightTrack,
} from './flights'
import { LatestStore } from './merge'
import {
  coveragePlan,
  FRESHNESS_TARGETS_MS,
  MAX_CIRCLE_NM,
  RequestScheduler,
  type CircleFetch,
  type PlannedCircle,
  type PlannedRequest,
} from './plan'
import { AdaptiveRateController, type CircuitState, type OutcomeKind } from './rate'
import {
  FreshnessTracker,
  HourlyCounter,
  ProviderStatusTracker,
  type OutcomeCounters,
  type ProviderStatus,
} from './status'
import { emptyCursor, trackDecision, type FineContext, type TrackCursor } from './tracks'
import { isDataError, TrackWriter } from './writer'

/**
 * `ingest` rolü (Parça 1 M4, D-073): canlı kaynakları okur, örnekleri birleştirir, `redis-live`'a
 * anlık durumu, PostgreSQL'e uçuş kaydını ve izi yazar, sağlayıcı sağlığını tutar.
 *
 * Döngüler (her biri kendinden öncekini bekler, üst üste binmez; kapanışta hemen durur):
 * - adsb.lol: AIMD kovası izin verdikçe zamanlayıcının seçtiği çember ya da takip listesi isteği
 * - yerel alıcı: her alıcı kendi döngüsünde saniyede bir
 * - tik: birincil tazelik örneği, canlı süpürme, bellek budama, eski uçuşların kapatılması
 * - yazma: iz ve uçuş tamponu (1,5 sn)
 * - sağlık: `redis-live`'a her tur (sağlayıcı durumu, bölge tazeliği, kapsama planı), veritabanına
 *   dakikada bir ve durum değişince
 *
 * Örnek işleme tek sıradadır (iki kaynak aynı hex için aynı anda kayıt açamaz). `redis-live`
 * yazımları bu sırayı ve döngüleri beklemez (`LiveWriter`, `LIVE_WRITE_TIMEOUT_MS`): anlık durum
 * kesintisinde veritabanı geçmişi ve kaynak okumaları aynı hızda sürer. Zaman için `now()`
 * kullanılır (test saati); döngülerin bekleme aralıkları gerçek zamanlayıcıdır.
 */

export const INGEST_TIMERS = {
  tickMs: 1_000,
  flushMs: 1_500,
  receiverMs: 1_000,
  healthMs: 1_000,
} as const

/** İstasyon listesi boşken (referans verisi yok) yeniden deneme; doluyken yenileme aralığı. */
export const STATIONS_RETRY_MS = 60_000
export const STATIONS_REFRESH_MS = 600_000
const PRUNE_EVERY_MS = 10_000
const FLIGHT_SWEEP_EVERY_MS = 60_000
/** `provider_health` ve saatlik sayaçların yazım aralığı (admin 180 sn'den eskiyi düşmüş sayar). */
export const HEALTH_PERSIST_MS = 60_000
/** Yerel alıcı bu sürede en az bir başarılı yanıt verdiyse `ok`. */
export const RECEIVER_OK_WINDOW_MS = 60_000
/** Kapanışta yoldaki istek ve alıcı turu için beklenen en uzun süre. */
export const INGEST_CLOSE_TIMEOUT_MS = 8_000
/** Kapanıştaki son yazmalar (tampon, sağlık) için üst sınır. */
const FINAL_WRITE_TIMEOUT_MS = 4_000
/** Uzun beklemeler bu adımlarla bölünür; kapanış en geç bir adımda fark edilir. */
const MAX_SLEEP_STEP_MS = 1_000
/** Uçuş kaydı açılamadıysa (veritabanı erişilemez) yeni deneme için beklenen süre. */
const CREATE_FLIGHT_BACKOFF_MS = 10_000
/** Tekrarlayan uyarıların en sık yazım aralığı. */
const WARN_INTERVAL_MS = 60_000

export interface IngestDeps {
  env: Env
  redisLive: Redis
  database: Database
  log: Logger
  version: string
  now?: () => number
  random?: () => number
  fetch?: typeof fetch
  /** Yalnızca test: adsb.lol yerine yerel sahte sunucu. */
  adsbLolBaseUrl?: string
  timers?: { tickMs?: number; flushMs?: number; receiverMs?: number; healthMs?: number }
}

export interface IngestStats {
  aircraft: number
  activeFlights: number
  /** adsb.lol istekleri (açılıştan beri). */
  requests: number
  rateLimited: number
  /** Veritabanına eklenen iz satırları (açılıştan beri). */
  rowsSampled: number
  rowsFine: number
  adsbLol: 'enabled' | 'disabled'
  localReceivers: number
  /** adsb.lol güncel hızı ve devresi; kapalıysa null. */
  rps: number | null
  circuit: CircuitState | null
  /** Yazıcı tamponu dolduğu için atılan iz satırları. */
  rowsDropped: number
}

export interface IngestHandle {
  close(): Promise<void>
  stats(): IngestStats
}

// ---------------------------------------------------------------------------------------------
// Saf yardımcılar

/**
 * Admin panelinde gösterilen hata metni: sabit ve kısa; ham hata iletisi, adres ya da anahtar
 * taşımaz (D-071).
 */
export function adsbLolErrorText(kind: AdsbLolErrorKind, status: number | null): string {
  switch (kind) {
    case 'rate_limit':
      return `HTTP ${status ?? 429} (kısıtlama)`
    case 'config':
      return status === null ? 'yapılandırma hatası' : `HTTP ${status} (yapılandırma)`
    case 'server':
      return status === null ? 'sunucu hatası' : `HTTP ${status} (sunucu hatası)`
    case 'network':
      return 'bağlantı hatası'
    case 'response':
      return 'yanıt biçimi hatalı'
    case 'request':
      return status === null ? 'istek hatası' : `HTTP ${status} (istek hatası)`
  }
}

export interface ConfigProblem {
  /** Log için İngilizce kod. */
  code: 'license' | 'contact_email_missing' | 'api_key_header_missing' | 'invalid_header' | 'other'
  /** Admin panelinde gösterilen sabit metin. */
  text: string
}

/** adsb.lol istemcisi kurulamadıysa nedeni (değer ya da ham ileti taşımadan). */
export function adsbLolConfigProblem(
  env: Pick<Env, 'CONTACT_EMAIL' | 'ADSBLOL_API_KEY' | 'ADSBLOL_API_KEY_HEADER'>,
  error: unknown,
): ConfigProblem {
  if (error instanceof ProviderLicenseError) {
    return { code: 'license', text: 'lisans kaydı bu kullanım moduna izin vermiyor' }
  }
  if (!env.CONTACT_EMAIL?.trim()) {
    return { code: 'contact_email_missing', text: 'CONTACT_EMAIL tanımlı değil' }
  }
  if (env.ADSBLOL_API_KEY?.trim() && !env.ADSBLOL_API_KEY_HEADER?.trim()) {
    return { code: 'api_key_header_missing', text: 'ADSBLOL_API_KEY_HEADER tanımlı değil' }
  }
  if (error instanceof AdsbLolError && error.kind === 'config') {
    return { code: 'invalid_header', text: 'User-Agent ya da anahtar başlığı geçersiz' }
  }
  return { code: 'other', text: 'yapılandırma hatası' }
}

/** Yerel alıcının sabit hata metninden (providers) sayaç türü. */
export function receiverOutcome(error: string | null): OutcomeKind {
  if (error === null) return 'success'
  const status = /^HTTP (\d{3})$/.exec(error)?.[1]
  if (status !== undefined) {
    const code = Number(status)
    if (code === 429 || code === 420) return 'rate_limit'
    if (code === 401 || code === 403) return 'config'
    if (code >= 500) return 'server'
    return 'request'
  }
  if (error.startsWith('yanıt')) return 'response'
  return 'network'
}

/** Ortanca `sampleTime`; liste boşsa null. */
export function medianSampleTime(list: readonly { sampleTime: number }[]): number | null {
  if (list.length === 0) return null
  const times = list.map((a) => a.sampleTime).sort((a, b) => a - b)
  const mid = Math.floor(times.length / 2)
  const upper = times[mid] as number
  return times.length % 2 === 1 ? upper : Math.round(((times[mid - 1] as number) + upper) / 2)
}

/**
 * Başarılı çember çekiminden bölge veri zamanları (D-073): çemberin kapsadığı her istasyon (ve
 * birincil çemberin istasyonu) için P0 yarıçapı içindeki uçakların ortanca `sampleTime`'ı, çember
 * için bütün uçakların; uçak yoksa yanıtın `now` değeri.
 */
export function regionDataTimes(
  circle: PlannedCircle,
  response: { aircraft: readonly AircraftState[]; now: number },
  stations: ReadonlyMap<string, StationArp>,
): Record<string, number> {
  const out: Record<string, number> = {
    [circle.id]: medianSampleTime(response.aircraft) ?? response.now,
  }
  const icaos = new Set(circle.covers)
  if (circle.primaryIcao) icaos.add(circle.primaryIcao)
  for (const icao of icaos) {
    const station = stations.get(icao)
    if (!station) continue
    const radius = Math.min(station.fetchRadiusNm, MAX_CIRCLE_NM)
    const inside = response.aircraft.filter((a) => distanceNm(station, a) <= radius)
    out[icao] = medianSampleTime(inside) ?? response.now
  }
  return out
}

export interface WatchCoverage {
  /** Takip hedefine yetecek sıklıkta çekilen çemberler ve son çekimleri (`watchCircles()`). */
  circles: readonly CircleFetch[]
  /** Hex'in en son hangi çember yanıtında geldiği: o yanıtın işlendiği an (ms). */
  seenInCircleAt: (hex: string) => number | undefined
  /** Hiç örneği olmayan hex'in son tarih tabanı: son takip isteği, yoksa ingest'in açılışı. */
  unseenSince: number
}

export interface WatchNeed {
  /** `/v2/hex` ile izlenecek hex'ler; son tarihi en yakın olan önce. */
  hexes: string[]
  /** Takip isteğinin son tarihi (en yakını); izlenecek hex yoksa null. */
  dueAt: number | null
}

/**
 * Takip listesinden `/v2/hex` ile izlenmesi gerekenler (D-073, data-sources.md §1 P1). Takip
 * listesi önce kapsama çemberlerinden karşılanır: uçağın son konumunu içeren 30 sn hedefli
 * çemberlerin en son çekimi son 30 sn içindeyse ve uçak o yanıtta geldiyse `/v2/hex` gerekmez;
 * çemberin bir sonraki çekimi de onu getirir. Kapsama dışındaki, kapsayan çemberin son yanıtında
 * gelmeyen, kapsayan çemberi gecikmiş ya da hiç görülmemiş uçak izlenir.
 *
 * Son tarih örnek zamanı ile son `/v2/hex` isteğinin (yoksa açılışın, `unseenSince`) büyüğü + 30 sn'dir. İzlenen uçağın işi,
 * örneği taze olsa da zamanlayıcıya bu son tarihle bildirilir: iş, sırası geldiğinde ansızın
 * belirip sırası gelmiş başka bir çekimin slotunu almasın.
 */
/** ICAO hex (6 onaltılık hane) ya da ICAO dışı adres (`~` önekli); başka biçim Redis anahtarına ve DB'ye girmez. */
export const VALID_HEX = /^~?[0-9a-f]{6}$/

export function watchNeed(
  watch: readonly string[],
  latest: (hex: string) => AircraftState | undefined,
  now: number,
  coverage: WatchCoverage,
): WatchNeed {
  const target = FRESHNESS_TARGETS_MS.watch
  const needs: { hex: string; dueAt: number }[] = []
  for (const hex of watch) {
    const state = latest(hex)
    if (state === undefined) {
      needs.push({ hex, dueAt: coverage.unseenSince + target })
      continue
    }
    let newestFetch: number | null = null
    for (const { circle, fetchedAt } of coverage.circles) {
      if (fetchedAt === null || distanceNm(circle.center, state) > circle.radiusNm) continue
      if (newestFetch === null || fetchedAt > newestFetch) newestFetch = fetchedAt
    }
    const seenAt = coverage.seenInCircleAt(hex)
    const covered =
      newestFetch !== null &&
      now - newestFetch <= target &&
      seenAt !== undefined &&
      seenAt >= newestFetch
    // Son `/v2/hex` yeni örnek getirmediyse (uçak indi, sustu) son tarih o istekten ileri kayar;
    // yoksa geçmişte donar ve takip işi her slotu alır.
    if (!covered)
      needs.push({ hex, dueAt: Math.max(state.sampleTime, coverage.unseenSince) + target })
  }
  needs.sort((a, b) => a.dueAt - b.dueAt)
  return { hexes: needs.map((n) => n.hex), dueAt: needs[0]?.dueAt ?? null }
}

/**
 * Kapsama planının `redis-live`'a yazılan biçimi (D-074): API `/v1/live`'ın kapsamasını
 * (`full | partial | none | unknown`) bu çemberlerle hesaplar.
 */
export function coverageCircles(plan: readonly PlannedCircle[]): CoverageCircle[] {
  return plan.map((c) => ({
    id: c.id,
    kind: c.kind,
    lat: c.center.lat,
    lon: c.center.lon,
    radiusNm: c.radiusNm,
  }))
}

export function trackRow(flightId: number, s: AircraftState): TrackPointRow {
  return {
    flightId,
    ts: new Date(s.sampleTime),
    lat: s.lat,
    lon: s.lon,
    altBaroFt: s.altBaroFt,
    altGeomFt: s.altGeomFt,
    gsKt: s.gsKt,
    trackDeg: s.trackDeg,
    verticalRateFpm: s.baroRateFpm ?? s.geomRateFpm,
    onGround: s.onGround,
    source: trackSourceCode(s.source, s.positionSource),
  }
}

const emptyCounters = (): OutcomeCounters => ({
  requests: 0,
  successes: 0,
  rateLimited: 0,
  serverErrors: 0,
  networkErrors: 0,
  otherErrors: 0,
})

function addCounters(a: OutcomeCounters, b: OutcomeCounters): OutcomeCounters {
  return {
    requests: a.requests + b.requests,
    successes: a.successes + b.successes,
    rateLimited: a.rateLimited + b.rateLimited,
    serverErrors: a.serverErrors + b.serverErrors,
    networkErrors: a.networkErrors + b.networkErrors,
    otherErrors: a.otherErrors + b.otherErrors,
  }
}

const toDate = (ms: number | null) => (ms === null ? null : new Date(ms))
const maxOf = (values: readonly (number | null)[]) =>
  values.reduce<number | null>((m, v) => (v !== null && (m === null || v > m) ? v : m), null)

/**
 * `redis-live` çağrısının beklenebileceği en uzun süre. Anlık durum kalıcı değildir: Redis
 * kesintisi ya da yavaşlığı örnek işlemeyi, veritabanı geçmişini ve kaynak döngülerini
 * yavaşlatmamalıdır (bağlantı ayarları için bkz. `apps/worker/src/index.ts`).
 */
export const LIVE_WRITE_TIMEOUT_MS = 1_000

export class LiveTimeoutError extends Error {
  constructor(ms: number) {
    super(`live redis call timed out after ${ms} ms`)
    this.name = 'LiveTimeoutError'
  }
}

/** Sözü en fazla `ms` bekler; süre dolarsa `LiveTimeoutError` (iş arkada sürer, hatası yutulur). */
export async function bounded<T>(promise: Promise<T>, ms: number): Promise<T> {
  promise.catch(() => undefined)
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LiveTimeoutError(ms)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Anlık durum yazıcısı: `push` beklemeden döner, örnek işleme Redis'i hiç beklemez. Aynı anda en
 * fazla bir yazım yoldadır; yoldayken gelen örnekler hex başına en yenisiyle birikir ve yazım
 * bitince (ya da `timeoutMs` dolunca) tek seferde yazılır. Bekleyen küme uçak sayısıyla sınırlıdır.
 * Hata ve süre aşımı `onError`'a gider.
 */
export class LiveWriter<T extends { hex: string }> {
  private pending = new Map<string, T>()
  private running: Promise<void> | null = null

  constructor(
    private readonly write: (list: readonly T[]) => Promise<void>,
    private readonly onError: (error: unknown, count: number) => void,
    private readonly timeoutMs: number = LIVE_WRITE_TIMEOUT_MS,
  ) {}

  push(list: readonly T[]): void {
    for (const item of list) this.pending.set(item.hex, item)
    this.pump()
  }

  /** Yazılmayı bekleyen uçak sayısı. */
  backlog(): number {
    return this.pending.size
  }

  /** Yoldaki ve bekleyen yazımlar bitene (ya da süreleri dolana) kadar bekler. */
  async drain(): Promise<void> {
    while (this.running !== null) await this.running
  }

  private pump(): void {
    if (this.running !== null || this.pending.size === 0) return
    const batch = [...this.pending.values()]
    this.pending = new Map()
    this.running = this.run(batch).finally(() => {
      this.running = null
      this.pump()
    })
  }

  private async run(batch: readonly T[]): Promise<void> {
    try {
      await bounded(
        Promise.resolve().then(() => this.write(batch)),
        this.timeoutMs,
      )
    } catch (error) {
      this.onError(error, batch.length)
    }
  }
}

/** Süre dolunca false döner; zamanlayıcıyı her durumda temizler. */
async function within(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms)
  })
  try {
    return await Promise.race([promise.then(() => true as const), timeout])
  } finally {
    clearTimeout(timer)
  }
}

interface ProviderView {
  id: LiveSourceId
  status: ProviderStatus
  reason: string | null
  snapshot: ProviderHealthSnapshot
  live: Record<string, string | number | null>
}

interface SourceState {
  lastSuccessAt: number | null
  lastErrorAt: number | null
  lastError: string | null
  consecutiveFailures: number
}

// ---------------------------------------------------------------------------------------------

export async function startIngest(deps: IngestDeps): Promise<IngestHandle> {
  const { env, redisLive: redis, database, log, version } = deps
  const sql = database.sql
  const now = deps.now ?? (() => Date.now())
  const random = deps.random ?? Math.random
  const timers = {
    tickMs: deps.timers?.tickMs ?? INGEST_TIMERS.tickMs,
    flushMs: deps.timers?.flushMs ?? INGEST_TIMERS.flushMs,
    receiverMs: deps.timers?.receiverMs ?? INGEST_TIMERS.receiverMs,
    healthMs: deps.timers?.healthMs ?? INGEST_TIMERS.healthMs,
  }
  const stop = new AbortController()
  const startedAt = now()

  const warnedAt = new Map<string, number>()
  /** Aynı anahtarlı uyarı dakikada en fazla bir kez yazılır (kesintide log seli olmasın). */
  const warnThrottled = (key: string, fields: Record<string, unknown>, message: string) => {
    const t = now()
    const last = warnedAt.get(key)
    if (last !== undefined && t - last < WARN_INTERVAL_MS) return
    warnedAt.set(key, t)
    log.warn(fields, message)
  }

  // 1. Günün ve ilerideki günlerin partition'ları (bakım işi de açar; burada yalnızca güvence).
  try {
    const ensured = await ensureTrackPartitions(sql, new Date(now()))
    if (ensured.created.length > 0) {
      log.info({ created: ensured.created.length }, 'track partitions created')
    }
  } catch (error) {
    log.warn({ err: error }, 'track partitions could not be ensured; rows may land in DEFAULT')
  }

  // 2. İstasyonlar ve kapsama planı.
  const watchList = env.WATCH_HEX_LIST
  const watch = new Set(watchList)
  let stationByIcao = new Map<string, StationArp>()
  let primaryIcao: string | null = null
  let scheduler: RequestScheduler | null = null
  /** Güncel planın çemberleri; istasyon yokken boştur (API'de kapsama `none`). */
  let coverage: CoverageCircle[] = []
  let fineCtx: FineContext = { stations: [], watch }
  let stationsKey: string | null = null
  let stationsLoadedAt = now()

  const applyStations = (list: StationArp[]) => {
    const key = JSON.stringify(
      list.map((s) => [s.icao, s.lat, s.lon, s.elevationFt, s.fetchRadiusNm, s.isPrimary]),
    )
    if (key === stationsKey) return
    stationsKey = key
    stationByIcao = new Map(list.map((s) => [s.icao, s]))
    primaryIcao = list.find((s) => s.isPrimary)?.icao ?? null
    fineCtx = {
      stations: list.map((s) => ({ lat: s.lat, lon: s.lon, elevationFt: s.elevationFt })),
      watch,
    }
    if (list.length === 0) {
      scheduler = null
      coverage = []
      log.warn(
        { retrySec: STATIONS_RETRY_MS / 1000 },
        'no active station with an airport reference yet; adsb.lol waits for the reference import',
      )
      return
    }
    // Zamanlayıcı plan değişince yeniden kurulur (durum taşımaz; ilk turda birincil öne geçer).
    const plan = coveragePlan(list)
    scheduler = new RequestScheduler(plan)
    coverage = coverageCircles(plan)
    log.info(
      {
        stations: list.map((s) => s.icao),
        primary: primaryIcao,
        circles: plan.map((c) => `${c.id}:${c.radiusNm}`),
      },
      'coverage plan ready',
    )
  }

  const refreshStations = async () => {
    stationsLoadedAt = now()
    try {
      applyStations(await activeStationsWithArp(sql))
    } catch (error) {
      warnThrottled('stations', { err: error }, 'stations could not be loaded')
    }
  }

  applyStations(await activeStationsWithArp(sql))

  // 3. Açık uçuş kayıtları: son 30 dk'da görülenler sürer, eskileri kapatılır. Yer bekleme
  // durumu kayıtların iz satırlarından geri kurulur (aynı bekleme yeniden bölünmesin).
  const flights = new Map<string, FlightTrack>()
  const activeRows = await loadActiveFlights(sql, new Date(now() - FLIGHT_GAP_MS))
  let groundStarts = new Map<number, number>()
  if (activeRows.length > 0) {
    // Satırlar kayıt başınadır ve kaydın ilk görülmesinden önce olamaz; en eski kaydın başlangıcı
    // bütün kayıtların bütün satırlarını kapsar (park eden uçağın satırları seyrek ve eskidir).
    const oldest = activeRows.reduce((m, r) => Math.min(m, r.firstSeenAt.getTime()), Infinity)
    try {
      groundStarts = await loadTrailingGroundStart(
        sql,
        activeRows.map((r) => r.id),
        new Date(oldest),
      )
    } catch (error) {
      log.warn({ err: error }, 'ground wait state could not be restored; waits restart now')
    }
  }
  for (const row of activeRows) {
    const firstSeen = row.firstSeenAt.getTime()
    const lastSeen = row.lastSeenAt.getTime()
    flights.set(row.hex, {
      id: row.id,
      hex: row.hex,
      callsign: row.callsign,
      registration: row.registration,
      typeCode: row.typeCode,
      firstSeen,
      lastSeen,
      ...restoredGroundState(firstSeen, lastSeen, groundStarts.get(row.id) ?? null),
    })
  }

  // 4. adsb.lol: dış istekler açıksa. İstemci kurulamazsa worker çalışmaya devam eder, devre
  // `config`'te kalır ve durum admin'de "Çalışmıyor" görünür.
  const adsbLolConfigured = !env.EXTERNAL_PROVIDERS_DISABLED
  const rate = new AdaptiveRateController({ startRps: env.ADSBLOL_RPS, now, random })
  const adsb: SourceState = {
    lastSuccessAt: null,
    lastErrorAt: null,
    lastError: null,
    consecutiveFailures: 0,
  }
  let adsbLolClient: AdsbLolClient | null = null
  let configErrorLogged = false
  if (adsbLolConfigured) {
    try {
      adsbLolClient = createAdsbLolClient({
        appName: env.APP_NAME,
        version,
        webHost: env.WEB_HOST,
        contactEmail: env.CONTACT_EMAIL,
        dataUsageMode: env.DATA_USAGE_MODE,
        apiKey: env.ADSBLOL_API_KEY,
        apiKeyHeader: env.ADSBLOL_API_KEY_HEADER,
        baseUrl: deps.adsbLolBaseUrl,
        fetch: deps.fetch,
        now,
      })
    } catch (error) {
      const problem = adsbLolConfigProblem(env, error)
      log.error({ reason: problem.code }, 'adsblol config error')
      configErrorLogged = true
      rate.record('config')
      adsb.lastErrorAt = now()
      adsb.lastError = problem.text
    }
  }

  // 5. Yerel alıcılar (adresler env'de doğrulandı). Her alıcının kendi istemcisi ve döngüsü
  // vardır: yavaş ya da erişilemeyen bir alıcı (5 sn zaman aşımı) diğerlerini bekletmez.
  const receivers = parseReceiverUrls(env.LOCAL_RECEIVER_URLS)
  let receiverClients: LocalReceiverClient[] = []
  let receiverProblem: string | null = null
  if (receivers.length > 0) {
    try {
      const userAgent = providerUserAgent({
        appName: env.APP_NAME,
        version,
        webHost: env.WEB_HOST,
        contactEmail: env.CONTACT_EMAIL,
      })
      receiverClients = receivers.map((receiver) =>
        createLocalReceiverClient({
          receivers: [receiver],
          dataUsageMode: env.DATA_USAGE_MODE,
          userAgent,
          fetch: deps.fetch,
          now,
        }),
      )
    } catch (error) {
      const code = error instanceof ProviderLicenseError ? 'license' : 'invalid_header'
      log.error({ reason: code }, 'local receiver config error')
      receiverClients = []
      receiverProblem = 'yapılandırma hatası'
    }
  }

  const configured: Record<LiveSourceId, boolean> = {
    adsbLol: adsbLolConfigured,
    localReceiver: receivers.length > 0,
  }
  // Bu süreçte yapılandırılmamış sağlayıcının eski satırı admin'de kalıcı "Çalışmıyor" kalmasın.
  for (const id of LIVE_SOURCE_IDS) {
    if (configured[id]) continue
    try {
      await deleteProviderHealth(sql, id)
    } catch (error) {
      log.warn({ err: error, provider: id }, 'stale provider health row could not be deleted')
    }
  }

  // 6. Bileşenler.
  const adsbStatus = new ProviderStatusTracker()
  const receiverStatus = new ProviderStatusTracker()
  const freshness = new FreshnessTracker()
  const hourly: Record<LiveSourceId, HourlyCounter> = {
    adsbLol: new HourlyCounter(),
    localReceiver: new HourlyCounter(),
  }
  /** Yazılamayan saatlik sayaçlar bir sonraki yazımda eklenir. */
  const pendingHourly: Record<LiveSourceId, OutcomeCounters> = {
    adsbLol: emptyCounters(),
    localReceiver: emptyCounters(),
  }
  const store = new LatestStore()
  const cursors = new Map<string, TrackCursor>()
  const writer = new TrackWriter(sql, log, { now })
  const regionTimes = new Map<string, number>()
  const totals = { requests: 0, rateLimited: 0, rowsSampled: 0, rowsFine: 0 }
  const lastStatus = new Map<LiveSourceId, ProviderStatus>()
  let lastPruneAt = now()
  let lastFlightSweepAt = now()
  let lastPersistAt = now()
  let createBlockedUntil = 0
  /** Kapanışta son yazmalardan sonra gelen örnekler işlenmez (bağlantılar kapanmak üzere). */
  let finished = false

  // --- Örnek işleme (tek sıra) ---------------------------------------------------------------
  let queue: Promise<unknown> = Promise.resolve()
  const exclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn)
    queue = run.catch(() => undefined)
    return run
  }

  const openFlight = async (f: FlightTrack): Promise<number | null> => {
    if (now() < createBlockedUntil) return null
    try {
      return await createFlight(sql, {
        hex: f.hex,
        callsign: f.callsign,
        registration: f.registration,
        typeCode: f.typeCode,
        firstSeenAt: new Date(f.firstSeen),
        lastSeenAt: new Date(f.lastSeen),
      })
    } catch (error) {
      // Bozuk veri (SQLSTATE 22/23) yalnızca o uçağı etkiler; diğer uçakların kaydını bekletmez.
      if (!isDataError(error)) createBlockedUntil = now() + CREATE_FLIGHT_BACKOFF_MS
      warnThrottled('create-flight', { err: error }, 'flight record could not be created')
      return null
    }
  }

  const applySample = async (s: AircraftState) => {
    const previous = flights.get(s.hex)
    const decision = decideFlight(previous, s)
    let flight: FlightTrack
    if (decision.action === 'new' || previous === undefined) {
      if (previous !== undefined && previous.id !== null) writer.end(previous.id)
      flight = startFlight(s, previous, decision)
      cursors.set(s.hex, emptyCursor())
    } else {
      flight = continueFlight(previous, s)
    }
    if (flight.id === null) {
      // Kayıt açılamadıysa sonraki örnekte yeniden denenir; o zamana kadar iz yazılmaz.
      flight = { ...flight, id: await openFlight(flight) }
    } else {
      writer.touch({
        id: flight.id,
        lastSeenAt: new Date(flight.lastSeen),
        callsign: flight.callsign,
        registration: flight.registration,
        typeCode: flight.typeCode,
      })
    }
    flights.set(s.hex, flight)
    if (flight.id === null) return
    const decided = trackDecision(cursors.get(s.hex) ?? emptyCursor(), s, fineCtx)
    cursors.set(s.hex, decided.cursor)
    if (!decided.sampled && !decided.fine) return
    const row = trackRow(flight.id, s)
    if (decided.sampled) writer.addSampled(row)
    if (decided.fine) writer.addFine(row)
  }

  // Anlık durum beklenmeden yazılır: harita veritabanı yavaşlasa da güncel kalır, Redis
  // kesintisi de veritabanı yazımını ve kaynak döngülerini yavaşlatmaz.
  const liveWriter = new LiveWriter<AircraftState>(
    (list) => writeLiveUpdates(redis, list),
    (error, count) =>
      warnThrottled(
        'live-write',
        { err: error, count, backlog: liveWriter.backlog() },
        'live state write failed',
      ),
  )

  let invalidHex = 0
  const processStates = (states: readonly AircraftState[]) =>
    exclusive(async () => {
      if (finished || states.length === 0) return
      const valid = states.filter((st) => VALID_HEX.test(st.hex))
      if (valid.length < states.length) {
        invalidHex += states.length - valid.length
        warnThrottled('invalid-hex', { dropped: invalidHex }, 'samples with malformed hex dropped')
      }
      const accepted = store.accept(valid, now())
      if (accepted.length === 0) return
      liveWriter.push(accepted)
      for (const s of accepted) await applySample(s)
    })

  /** Aynı anahtarlı `redis-live` çağrısından yoldaki varsa yenisi başlatılmaz (birikmesin). */
  const liveInFlight = new Set<string>()
  /**
   * Tik ve sağlık döngülerinin `redis-live` çağrısı: en fazla `LIVE_WRITE_TIMEOUT_MS` beklenir;
   * hata ve süre aşımı dakikada bir uyarı olarak yazılır.
   */
  const liveCall = async (
    key: string,
    fields: Record<string, unknown>,
    message: string,
    call: () => Promise<unknown>,
  ): Promise<void> => {
    if (liveInFlight.has(key)) return
    liveInFlight.add(key)
    const running = Promise.resolve()
      .then(call)
      .finally(() => liveInFlight.delete(key))
    try {
      await bounded(running, LIVE_WRITE_TIMEOUT_MS)
    } catch (error) {
      warnThrottled(key, { err: error, ...fields }, message)
    }
  }

  // --- Döngü yardımcıları ------------------------------------------------------------------
  const pause = (ms: number) =>
    new Promise<void>((resolve) => {
      if (stop.signal.aborted) {
        resolve()
        return
      }
      const done = () => {
        clearTimeout(timer)
        stop.signal.removeEventListener('abort', done)
        resolve()
      }
      const timer = setTimeout(done, Math.max(1, ms))
      stop.signal.addEventListener('abort', done, { once: true })
    })

  const every = async (
    name: string,
    intervalMs: number,
    fn: () => Promise<void>,
    delayFirst = false,
  ) => {
    if (delayFirst) await pause(intervalMs)
    while (!stop.signal.aborted) {
      const started = performance.now()
      try {
        await fn()
      } catch (error) {
        warnThrottled(`loop:${name}`, { err: error, loop: name }, 'ingest loop iteration failed')
      }
      await pause(intervalMs - (performance.now() - started))
    }
  }

  // --- adsb.lol ------------------------------------------------------------------------------
  const recordAdsbLol = (
    kind: OutcomeKind,
    status: number | null,
    retryAfterSec: number | null = null,
  ) => {
    const t = now()
    rate.record(kind, { retryAfterSec })
    adsbStatus.record(t, kind)
    hourly.adsbLol.add(kind)
    totals.requests += 1
    if (kind === 'success') {
      adsb.lastSuccessAt = t
      adsb.consecutiveFailures = 0
      return
    }
    adsb.lastErrorAt = t
    adsb.lastError = adsbLolErrorText(kind, status)
    adsb.consecutiveFailures += 1
    if (kind === 'rate_limit') totals.rateLimited += 1
    if (kind === 'config' && !configErrorLogged) {
      configErrorLogged = true
      log.error({ reason: 'rejected', status }, 'adsblol config error')
    }
  }

  const requestLabel = (req: PlannedRequest | null) =>
    req === null ? null : req.kind === 'circle' ? req.circle.id : 'watch'

  /** Takip listesindeki hex'in en son geldiği çember yanıtının işlendiği an. */
  const watchSeenInCircle = new Map<string, number>()
  /** Son başarılı `/v2/hex` isteği (zamanlayıcı plan değişince yeniden kurulsa da korunur). */
  let lastWatchAt: number | null = null

  const runAdsbLolRequest = async (client: AdsbLolClient, current: RequestScheduler) => {
    let req: PlannedRequest | null = null
    let result: Awaited<ReturnType<AdsbLolClient['point']>>
    try {
      const t = now()
      const slotMs = 1000 / rate.rps()
      const need = watchNeed(watchList, (hex) => store.get(hex), t, {
        circles: current.watchCircles(),
        seenInCircleAt: (hex) => watchSeenInCircle.get(hex),
        unseenSince: lastWatchAt ?? startedAt,
      })
      req = current.next(t, slotMs, need.dueAt)
      result =
        req.kind === 'circle'
          ? await client.point(req.circle.center.lat, req.circle.center.lon, req.circle.radiusNm)
          : await client.hex(chunkHexes(need.hexes)[0] ?? [])
    } catch (error) {
      const kind = error instanceof AdsbLolError ? error.kind : 'network'
      const status = error instanceof AdsbLolError ? error.status : null
      recordAdsbLol(kind, status, error instanceof AdsbLolError ? error.retryAfterSec : null)
      log.warn(
        { kind, status, request: requestLabel(req), rps: rate.rps() },
        'adsblol request failed',
      )
      return
    }
    recordAdsbLol('success', 200)
    const at = now()
    current.served(req, at)
    if (req.kind === 'circle') {
      for (const [region, time] of Object.entries(
        regionDataTimes(req.circle, result, stationByIcao),
      )) {
        regionTimes.set(region, time)
      }
      if (watch.size > 0) {
        for (const a of result.aircraft) if (watch.has(a.hex)) watchSeenInCircle.set(a.hex, at)
      }
    } else {
      lastWatchAt = at
    }
    log.debug(
      {
        request: requestLabel(req),
        aircraft: result.aircraft.length,
        rejected: result.rejected.length,
        latencyMs: result.latencyMs,
      },
      'adsblol response',
    )
    try {
      await processStates(result.aircraft)
    } catch (error) {
      warnThrottled('process', { err: error }, 'ingest processing failed')
    }
  }

  const adsbLolLoop = async (client: AdsbLolClient) => {
    while (!stop.signal.aborted) {
      try {
        // 401/403: süreç yeniden başlayana kadar istek atılmaz (D-073).
        if (rate.state().circuit === 'config') return
        const current = scheduler
        if (current === null) {
          await pause(MAX_SLEEP_STEP_MS)
          continue
        }
        const t = now()
        const allowedAt = rate.nextAllowedAt()
        if (allowedAt > t) {
          await pause(Math.min(allowedAt - t, MAX_SLEEP_STEP_MS))
          continue
        }
        if (!rate.tryAcquire()) {
          await pause(50)
          continue
        }
        await runAdsbLolRequest(client, current)
      } catch (error) {
        warnThrottled('loop:adsblol', { err: error }, 'ingest loop iteration failed')
        await pause(MAX_SLEEP_STEP_MS)
      }
    }
  }

  // --- Yerel alıcı ---------------------------------------------------------------------------
  /** Tek alıcının turu; her alıcı kendi döngüsünde okunur ve sonucu gelir gelmez işlenir. */
  const receiverRound = async (client: LocalReceiverClient) => {
    const results = await client.fetchAll()
    const t = now()
    for (const r of results) {
      const outcome = receiverOutcome(r.error)
      receiverStatus.record(t, outcome)
      hourly.localReceiver.add(outcome)
    }
    const states = results.flatMap((r) => (r.ok && r.response ? r.response.aircraft : []))
    if (states.length > 0) await processStates(states)
  }

  // --- Tik -----------------------------------------------------------------------------------
  const tick = async () => {
    const t = now()
    if (primaryIcao !== null) {
      const dataTime = regionTimes.get(primaryIcao)
      freshness.sample(t, dataTime === undefined ? null : t - dataTime)
    }
    await liveCall('sweep', {}, 'live sweep failed', () => sweepLive(redis, t))
    if (t - lastPruneAt >= PRUNE_EVERY_MS) {
      lastPruneAt = t
      await exclusive(async () => {
        for (const hex of store.prune(t)) cursors.delete(hex)
      })
    }
    if (t - lastFlightSweepAt >= FLIGHT_SWEEP_EVERY_MS) {
      lastFlightSweepAt = t
      await exclusive(async () => {
        let ended = 0
        for (const [hex, flight] of flights) {
          if (flight.lastSeen >= t - FLIGHT_GAP_MS) continue
          if (flight.id !== null) writer.end(flight.id)
          flights.delete(hex)
          cursors.delete(hex)
          ended += 1
        }
        if (ended > 0) log.debug({ ended }, 'flights ended after gap')
      })
    }
    const stationsDue = stationByIcao.size === 0 ? STATIONS_RETRY_MS : STATIONS_REFRESH_MS
    if (t - stationsLoadedAt >= stationsDue) await refreshStations()
  }

  // --- Yazma ---------------------------------------------------------------------------------
  const flushWriter = async () => {
    const result = await writer.flush()
    totals.rowsSampled += result.sampled
    totals.rowsFine += result.fine
  }

  // --- Sağlık --------------------------------------------------------------------------------
  const adsbLolView = (t: number): ProviderView => {
    const state = rate.state()
    const counters = adsbStatus.counters(t)
    const p95 = freshness.p95(t)
    const primaryData = primaryIcao === null ? undefined : regionTimes.get(primaryIcao)
    const { status, reason } = adsbStatus.status(t, {
      circuitOpen: state.circuit === 'open' || state.circuit === 'config',
      primaryFreshnessMs: p95,
    })
    const freshnessP95S = p95 === null ? null : p95 / 1000
    return {
      id: 'adsbLol',
      status,
      reason,
      snapshot: {
        provider: 'adsbLol',
        status,
        lastSuccessAt: toDate(adsb.lastSuccessAt),
        lastErrorAt: toDate(adsb.lastErrorAt),
        lastError: adsb.lastError,
        consecutiveFailures: adsb.consecutiveFailures,
        rps: state.rps,
        circuit: state.circuit,
        backoffUntil: toDate(state.backoffUntil),
        freshnessP95S,
        errorRatio60s: counters.errorRatio,
        requests60s: counters.requests,
      },
      live: {
        status,
        reason,
        rps: state.rps,
        circuit: state.circuit,
        backoffUntil: state.backoffUntil,
        consecutiveFailures: adsb.consecutiveFailures,
        lastSuccessAt: adsb.lastSuccessAt,
        lastErrorAt: adsb.lastErrorAt,
        lastError: adsb.lastError,
        freshnessP95S,
        primaryAgeS: primaryData === undefined ? null : (t - primaryData) / 1000,
        errorRatio60s: counters.errorRatio,
        requests60s: counters.requests,
        rateLimited60s: counters.rateLimited,
        updatedAt: t,
      },
    }
  }

  const receiverView = (t: number): ProviderView => {
    const health = receiverClients.flatMap((client) => client.health())
    const lastSuccessAt = maxOf(health.map((h) => h.lastSuccessAt))
    const lastErrorAt =
      receiverProblem !== null ? startedAt : maxOf(health.map((h) => h.lastErrorAt))
    const lastError =
      receiverProblem ??
      health.find((h) => h.lastErrorAt !== null && h.lastErrorAt === lastErrorAt)?.lastError ??
      null
    const consecutiveFailures =
      health.length === 0 ? 0 : Math.min(...health.map((h) => h.consecutiveFailures))
    const ok =
      receiverProblem === null &&
      lastSuccessAt !== null &&
      t - lastSuccessAt <= RECEIVER_OK_WINDOW_MS
    const status: ProviderStatus = ok ? 'ok' : 'down'
    const reason = ok ? null : receiverProblem !== null ? 'config' : 'no_success'
    const counters = receiverStatus.counters(t)
    return {
      id: 'localReceiver',
      status,
      reason,
      snapshot: {
        provider: 'localReceiver',
        status,
        lastSuccessAt: toDate(lastSuccessAt),
        lastErrorAt: toDate(lastErrorAt),
        lastError,
        consecutiveFailures,
        rps: null,
        circuit: receiverProblem !== null ? 'config' : 'closed',
        backoffUntil: null,
        freshnessP95S: null,
        errorRatio60s: counters.errorRatio,
        requests60s: counters.requests,
      },
      live: {
        status,
        reason,
        receivers: health.length,
        lastSuccessAt,
        lastErrorAt,
        lastError,
        consecutiveFailures,
        errorRatio60s: counters.errorRatio,
        requests60s: counters.requests,
        updatedAt: t,
      },
    }
  }

  const views = (t: number): ProviderView[] => {
    const out: ProviderView[] = []
    if (configured.adsbLol) out.push(adsbLolView(t))
    if (configured.localReceiver) out.push(receiverView(t))
    return out
  }

  const persistHourly = async (t: number, list: readonly ProviderView[]) => {
    for (const view of list) {
      const counters = addCounters(pendingHourly[view.id], hourly[view.id].take())
      const row: ProviderHourlyCounters = {
        ...counters,
        freshnessP95S: view.snapshot.freshnessP95S,
      }
      try {
        await addProviderHourly(sql, view.id, new Date(t), row)
        pendingHourly[view.id] = emptyCounters()
      } catch (error) {
        pendingHourly[view.id] = counters
        warnThrottled(
          `hourly:${view.id}`,
          { err: error, provider: view.id },
          'provider hourly counters could not be written',
        )
      }
    }
  }

  const persistHealth = async (list: readonly ProviderView[]) => {
    for (const view of list) {
      try {
        await writeProviderHealth(sql, view.snapshot)
      } catch (error) {
        warnThrottled(
          `health:${view.id}`,
          { err: error, provider: view.id },
          'provider health could not be written',
        )
      }
    }
  }

  const health = async () => {
    const t = now()
    const list = views(t)
    const regions = Object.fromEntries(regionTimes)
    const circles = coverage
    await Promise.all([
      ...list.map((view) =>
        liveCall(
          `live:${view.id}`,
          { provider: view.id },
          'provider live state could not be written',
          () => writeProviderLive(redis, view.id, view.live),
        ),
      ),
      regionTimes.size > 0
        ? liveCall('regions', {}, 'region freshness could not be written', () =>
            writeRegionFreshness(redis, regions),
          )
        : Promise.resolve(),
      // Kapsama planı her turda yazılır (TTL 600 sn): worker durursa API `unknown` gösterir.
      liveCall('coverage', { circles: circles.length }, 'coverage plan could not be written', () =>
        writeCoverage(redis, circles),
      ),
      // Yapılandırılmış sağlayıcılar uzun TTL ile: API, worker çökükken yeniden başlasa da onları
      // kayıt yokken "down" gösterir (D-074).
      liveCall('providers', {}, 'configured providers could not be written', () =>
        writeConfiguredProviders(
          redis,
          list.map((v) => v.id),
        ),
      ),
    ])
    for (const view of list) {
      const previous = lastStatus.get(view.id) ?? null
      if (previous === view.status) continue
      try {
        await recordProviderStatusChange(sql, {
          provider: view.id,
          at: new Date(t),
          from: previous,
          to: view.status,
          reason: view.reason,
        })
        lastStatus.set(view.id, view.status)
        log.info(
          { provider: view.id, from: previous, to: view.status, reason: view.reason },
          'provider status changed',
        )
      } catch (error) {
        warnThrottled(
          `status:${view.id}`,
          { err: error, provider: view.id },
          'provider status change could not be recorded',
        )
        continue
      }
      await persistHealth([view])
    }
    if (t - lastPersistAt >= HEALTH_PERSIST_MS) {
      lastPersistAt = t
      await persistHealth(list)
      await persistHourly(t, list)
      log.info(
        {
          aircraft: store.size(),
          activeFlights: flights.size,
          providers: Object.fromEntries(list.map((v) => [v.id, v.status])),
          rps: configured.adsbLol ? rate.rps() : null,
          requests: totals.requests,
          rateLimited: totals.rateLimited,
          rowsSampled: totals.rowsSampled,
          rowsFine: totals.rowsFine,
          buffered: writer.buffered(),
          rowsDropped: writer.dropped(),
          rowsRejected: writer.rejected(),
          invalidHex,
        },
        'ingest summary',
      )
    }
    log.debug(
      {
        aircraft: store.size(),
        flights: flights.size,
        buffered: writer.buffered(),
        providers: Object.fromEntries(list.map((v) => [v.id, v.status])),
      },
      'ingest round',
    )
  }

  // --- Başlat --------------------------------------------------------------------------------
  const loops: Promise<void>[] = [
    every('health', timers.healthMs, health, true),
    every('tick', timers.tickMs, tick, true),
    every('flush', timers.flushMs, flushWriter, true),
  ]
  if (adsbLolClient) loops.push(adsbLolLoop(adsbLolClient))
  for (const [index, client] of receiverClients.entries()) {
    loops.push(every(`receiver:${index + 1}`, timers.receiverMs, () => receiverRound(client)))
  }

  const adsbLolMode = !adsbLolConfigured ? 'disabled' : adsbLolClient ? 'enabled' : 'config_error'
  if (!adsbLolConfigured && receivers.length === 0) {
    log.warn(
      'no live source configured (EXTERNAL_PROVIDERS_DISABLED=true, LOCAL_RECEIVER_URLS empty); use pnpm dev:replay locally',
    )
  }
  log.info(
    {
      adsbLol: adsbLolMode,
      rps: env.ADSBLOL_RPS,
      localReceivers: receivers.length,
      stations: [...stationByIcao.keys()],
      activeFlights: flights.size,
      watch: watchList.length,
    },
    'ingest started',
  )

  const stats = (): IngestStats => ({
    aircraft: store.size(),
    activeFlights: flights.size,
    requests: totals.requests,
    rateLimited: totals.rateLimited,
    rowsSampled: totals.rowsSampled,
    rowsFine: totals.rowsFine,
    adsbLol: adsbLolConfigured ? 'enabled' : 'disabled',
    localReceivers: receivers.length,
    rps: adsbLolConfigured ? rate.rps() : null,
    circuit: adsbLolConfigured ? rate.state().circuit : null,
    rowsDropped: writer.dropped(),
  })

  const shutdown = async () => {
    stop.abort()
    // Yoldaki adsb.lol isteği ve alıcı turu beklenir (işlenir); süre dolarsa beklenmez.
    if (!(await within(Promise.allSettled(loops), INGEST_CLOSE_TIMEOUT_MS))) {
      log.warn({ timeoutMs: INGEST_CLOSE_TIMEOUT_MS }, 'ingest loops did not stop in time')
    }
    finished = true
    const finalWrites = async () => {
      try {
        await Promise.all([flushWriter(), liveWriter.drain()])
        const t = now()
        const list = views(t)
        await persistHealth(list)
        await persistHourly(t, list)
      } catch (error) {
        log.warn({ err: error }, 'ingest final writes failed')
      }
    }
    if (!(await within(finalWrites(), FINAL_WRITE_TIMEOUT_MS))) {
      log.warn({ buffered: writer.buffered() }, 'ingest final writes did not finish in time')
    }
    log.info({ ...stats(), buffered: writer.buffered() }, 'ingest stopped')
  }
  let closing: Promise<void> | null = null

  return {
    close: () => (closing ??= shutdown()),
    stats,
  }
}
