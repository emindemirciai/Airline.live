import {
  getWeatherSource,
  listListedAirports,
  metarStationsSince,
  pruneWeather,
  recordWeatherCheck,
  recordWeatherDisabled,
  recordWeatherError,
  retainMetars,
  retainTafs,
  upsertMetars,
  upsertTafs,
  WEATHER_RETENTION_DAYS,
  type Database,
  type MetarWrite,
  type TafWrite,
  type WeatherFailure,
  type WeatherKind,
  type WeatherCheck,
  type WeatherPruneResult,
  type WeatherSourceState,
  type WeatherUpsertCounts,
} from '@havayolu/db'
import {
  AWC_METAR_HOURS,
  AWC_METAR_MAX_HOURS,
  AviationWeatherError,
  type AviationWeatherClient,
  type MetarReport,
  type SkippedEntry,
  type TafReport,
} from '@havayolu/providers'
import { AIRPORT_RING_CONFIG, decodeMetar, errorMessage } from '@havayolu/shared'
import { UnrecoverableError } from 'bullmq'
import type { Logger } from 'pino'

/**
 * Havalimanı hava durumu işleri (D-078): METAR 5 dk'da, TAF 15 dk'da bir; her çalışma listelenen
 * bütün havalimanlarını (Türkiye ve açık halkalar, D-080) ister. AWC istemcisi listeyi 400 kayıt
 * sınırına göre gruplara böler (olağan 2 saatlik METAR'da 80 istasyon: 3. halkayla 503 istasyon yedi
 * istek, D-090; TAF'ta istekte en çok 200 istasyon: üç istek) ve iki isteğin başlangıcı arasında en
 * az 700 ms bekler (`AWC_MIN_REQUEST_INTERVAL_MS`; saatte ~96 istek, anlık en çok dakikada ~86).
 * Yayından sonraki ilk METAR çalışmasında listeye yeni giren istasyonlar 24 saatle istenir
 * (`fetchMetars`; 3. halkanın 278 istasyonu 6'şarlı 47 istek, olağan 3 istekle birlikte 50 istek,
 * aralıkla en az ~35 sn).
 * Her farklı rapor saklanır (geçmiş), 30 gün sonra silinir.
 * - 429: istek atılmaz, `blocked_until = şimdi + max(Retry-After, 10 dk)`; iş yeniden denenmez.
 * - 403: 1 saat istek atılmaz, admin satırı "çalışmıyor" olur; kaynağın davranışı değişmiştir
 *   (CLAUDE.md DUR-SOR 3: kullanıcıya söylenir).
 * - 400, 5xx, ağ hatası: hata kaydedilir, iş BullMQ ile 60 sn sonra bir kez yeniden denenir.
 * - 204 ya da raporu gelmeyen istasyon: eldeki satırlar silinmez; sayfa raporun yaşını gösterir.
 */

/** 429 sonrası en kısa bekleme (sn); Retry-After daha uzunsa o kullanılır. */
export const RATE_LIMIT_BLOCK_SEC = 600
/** 403 sonrası bekleme (sn). */
export const FORBIDDEN_BLOCK_SEC = 3_600
/** METAR ve TAF istasyonu: dört harfli ICAO kodu (GPS ya da yerel kodlar sorgulanmaz). */
const ICAO_STATION = /^[A-Z]{4}$/
const DAY_MS = 86_400_000

/** Kaynağın bir çağrıda verdiği raporlar (AWC istemcisi ya da fixture). */
export interface WeatherFetch<T> {
  status: 200 | 204
  items: T[]
  skipped: SkippedEntry[]
  /** AWC'nin 400 kayıt sınırına bölmeden sonra da ulaşıldı. */
  truncated?: boolean
  requests?: number
}

export interface WeatherSource {
  /** `hours`: METAR geriye bakışı (saat); kesintiden sonra kaydı doldurmak için uzar. */
  metars(ids: readonly string[], options: { hours: number }): Promise<WeatherFetch<MetarReport>>
  tafs(ids: readonly string[]): Promise<WeatherFetch<TafReport>>
}

/** AWC istemcisini kaynak arayüzüne bağlar. */
export function awcWeatherSource(client: AviationWeatherClient): WeatherSource {
  return {
    metars: (ids, { hours }) => client.metars(ids, { hours }),
    tafs: (ids) => client.tafs(ids),
  }
}

/**
 * METAR isteğinin geriye bakışı (saat): son başarılı kontrolden bu yana geçen süre + 1 saat pay,
 * en az `AWC_METAR_HOURS` (2), en çok `AWC_METAR_MAX_HOURS` (24). Olağan 5 dakikalık çalışmada 2
 * saattir; worker kapalı kaldıysa, AWC 429/5xx verdiyse ya da engel sürdüyse ilk başarılı istek
 * aradaki raporları da alır ve kayıtta delik kalmaz (24 saatten uzun kesintide en eski kısım
 * alınamaz). Hiç başarılı kontrol yoksa (ilk açılış) 24 saat. TAF ucu `hours` almaz: kesintide
 * yayımlanıp yerini yenisine bırakan TAF'lar alınamaz (D-078).
 */
export function metarLookbackHours(lastCheckedAt: Date | null, now: Date): number {
  if (lastCheckedAt === null) return AWC_METAR_MAX_HOURS
  const gapHours = (now.getTime() - lastCheckedAt.getTime()) / 3_600_000
  if (!Number.isFinite(gapHours)) return AWC_METAR_MAX_HOURS
  return Math.min(AWC_METAR_MAX_HOURS, Math.max(AWC_METAR_HOURS, Math.ceil(gapHours) + 1))
}

/**
 * Sorgulanacak istasyonlar: listelenen havalimanlarının (API'nin `scope=listed` listesi; Türkiye ve
 * açık halkalar, D-080) dört harfli ICAO kodları, liste sırasıyla ve tekil. GPS ya da yerel kodlu
 * havalimanı (ör. `TR-0042`) atlanır: AWC yalnızca ICAO istasyonu tanır.
 */
export function weatherStations(airports: readonly { icao: string }[]): string[] {
  return [...new Set(airports.map((a) => a.icao))].filter((icao) => ICAO_STATION.test(icao))
}

/** İşlerin veritabanı erişimi; testte bellek içi sahte uygulama verilir. */
export interface WeatherStore {
  /** Sorgulanacak istasyonlar (`weatherStations`). */
  stations(): Promise<string[]>
  /** Verilen istasyonlardan `since` ya da sonrası gözlenmiş METAR/SPECI'si olanlar. */
  metarStationsSince(stations: readonly string[], since: Date): Promise<string[]>
  source(kind: WeatherKind): Promise<WeatherSourceState | null>
  upsertMetars(rows: readonly MetarWrite[], fetchedAt: Date): Promise<WeatherUpsertCounts>
  upsertTafs(rows: readonly TafWrite[], fetchedAt: Date): Promise<WeatherUpsertCounts>
  /** Yalnızca fixture modu: istasyonların listede olmayan satırlarını siler (kopya birikmesin). */
  retainMetars(stations: readonly string[], rows: readonly MetarWrite[]): Promise<number>
  retainTafs(stations: readonly string[], rows: readonly TafWrite[]): Promise<number>
  recordCheck(kind: WeatherKind, check: WeatherCheck): Promise<void>
  recordError(kind: WeatherKind, failure: WeatherFailure): Promise<void>
  recordDisabled(kind: WeatherKind, reason: string): Promise<void>
  prune(now: Date, stations: readonly string[]): Promise<WeatherPruneResult>
}

export function databaseWeatherStore(database: Database): WeatherStore {
  const { db, sql } = database
  return {
    stations: async () => weatherStations(await listListedAirports(db, AIRPORT_RING_CONFIG)),
    metarStationsSince: (stations, since) => metarStationsSince(sql, stations, since),
    source: (kind) => getWeatherSource(sql, kind),
    upsertMetars: (rows, fetchedAt) => upsertMetars(sql, rows, fetchedAt),
    upsertTafs: (rows, fetchedAt) => upsertTafs(sql, rows, fetchedAt),
    retainMetars: (stations, rows) => retainMetars(sql, stations, rows),
    retainTafs: (stations, rows) => retainTafs(sql, stations, rows),
    recordCheck: (kind, check) => recordWeatherCheck(sql, kind, check),
    recordError: (kind, failure) => recordWeatherError(sql, kind, failure),
    recordDisabled: (kind, reason) => recordWeatherDisabled(sql, kind, { reason }),
    prune: (now, stations) => pruneWeather(sql, { now, stations }),
  }
}

/**
 * Ham METAR'daki QNH (hPa), ortak kod çözücüden (`@havayolu/shared` `decodeMetar`; ana gövdedeki
 * `Qdddd`, ABD biçimi `Adddd` çevrilir, eğilim ve `RMK` okunmaz). Yoksa, `Q////` ise ya da
 * makul aralıkta değilse null. Parça 2 AGL hesabı yalnızca 90 dakikadan yeni gözlemde kullanır.
 */
export function metarQnhHpa(raw: string): number | null {
  try {
    const qnh = decodeMetar(raw).qnhHpa
    return qnh !== null && Number.isFinite(qnh) && qnh >= 850 && qnh <= 1100 ? qnh : null
  } catch {
    return null
  }
}

export interface WeatherRunDeps {
  store: WeatherStore
  source: WeatherSource
  origin: 'remote' | 'fixture'
  log: Logger
  now?: () => Date
  /**
   * METAR kaydı bu süreçte denetlenmiş ya da 24 saatle doldurulmuş istasyonlar
   * (`runWeatherMetar`); worker süreci boyunca yaşar, böylece kaydı olmayan istasyon her çalışmada
   * değil süreç başına bir kez doldurulur. Verilmezse her çalışmada denetlenir.
   */
  backfilled?: Set<string>
}

export type WeatherRunResult =
  | { skipped: 'no_stations' }
  | { skipped: 'blocked'; blockedUntil: string; blockedKind: string | null }
  | {
      status: 200 | 204
      stations: number
      reports: number
      stationsWithReport: number
      skipped: number
      truncated: boolean
      written: WeatherUpsertCounts
      /** Fixture modunda silinen eski (kaydırılmış) kopyalar; uzak kaynakta 0. */
      removed: number
    }

/** Atlanan kayıtları neden başına sayar (log için). */
function skippedSummary(skipped: readonly SkippedEntry[]): Record<string, number> {
  const summary: Record<string, number> = {}
  for (const entry of skipped) summary[entry.reason] = (summary[entry.reason] ?? 0) + 1
  return summary
}

/**
 * Hata kaydı: 429 ve 403 engel yazar ve yeniden denenmeyen hata fırlatır; diğerleri kaydedilip
 * olduğu gibi fırlatılır (BullMQ yeniden dener). Kayıt yazılamasa da asıl hata kaybolmaz.
 */
async function fail(
  kind: WeatherKind,
  deps: WeatherRunDeps,
  now: Date,
  error: unknown,
): Promise<never> {
  const message = errorMessage(error)
  let block: WeatherFailure['block']
  if (error instanceof AviationWeatherError && error.kind === 'rate_limit') {
    const seconds = Math.max(error.retryAfterSec ?? 0, RATE_LIMIT_BLOCK_SEC)
    block = { until: new Date(now.getTime() + seconds * 1000), kind: 'rate_limit' }
  } else if (error instanceof AviationWeatherError && error.kind === 'forbidden') {
    block = { until: new Date(now.getTime() + FORBIDDEN_BLOCK_SEC * 1000), kind: 'forbidden' }
    deps.log.error(
      { kind, err: error },
      'aviationweather.gov erişimi engelledi (403): kaynağın davranışı değişti, kullanıcıya bildir (DUR-SOR 3)',
    )
  }
  try {
    await deps.store.recordError(kind, {
      origin: deps.origin,
      now,
      error: message,
      ...(block ? { block } : {}),
    })
  } catch (recordError) {
    deps.log.error({ err: recordError, kind }, 'hava durumu hata kaydı yazılamadı')
  }
  if (block) throw new UnrecoverableError(message)
  throw error
}

/** Ortak akış: istasyonlar, engel denetimi, istek, yazma ve kontrol kaydı. */
async function runWeather<T extends { station: string }, W>(
  kind: WeatherKind,
  deps: WeatherRunDeps,
  fetch: (
    ids: readonly string[],
    state: WeatherSourceState | null,
    now: Date,
  ) => Promise<WeatherFetch<T>>,
  toRows: (items: readonly T[], now: Date) => W[],
  write: (rows: readonly W[], fetchedAt: Date) => Promise<WeatherUpsertCounts>,
  retain: (stations: readonly string[], rows: readonly W[]) => Promise<number>,
): Promise<WeatherRunResult> {
  const now = (deps.now ?? (() => new Date()))()
  const stations = await deps.store.stations()
  if (stations.length === 0) {
    deps.log.warn({ kind }, 'hava durumu: listede havalimanı yok (referans verisi bekleniyor)')
    return { skipped: 'no_stations' }
  }
  const state = await deps.store.source(kind)
  if (state?.blockedUntil && state.blockedUntil.getTime() > now.getTime()) {
    deps.log.info(
      { kind, blockedUntil: state.blockedUntil.toISOString(), blockedKind: state.blockedKind },
      'hava durumu: kaynak engeli sürüyor, istek atılmadı',
    )
    return {
      skipped: 'blocked',
      blockedUntil: state.blockedUntil.toISOString(),
      blockedKind: state.blockedKind,
    }
  }
  let result: WeatherFetch<T>
  try {
    result = await fetch(stations, state, now)
  } catch (error) {
    return fail(kind, deps, now, error)
  }
  const rows = toRows(result.items, now)
  // Fixture modu tabloyu fixture'ın kaydırılmış hâline eşitler; uzak kaynakta hiçbir satır
  // silinmez (204 ya da raporu gelmeyen istasyonun eski raporu yaşıyla gösterilir).
  const removed = deps.origin === 'fixture' ? await retain(stations, rows) : 0
  const written = await write(rows, now)
  await deps.store.recordCheck(kind, {
    origin: deps.origin,
    now,
    stationCount: stations.length,
    reportCount: result.items.length,
    skippedCount: result.skipped.length,
  })
  if (result.skipped.length > 0) {
    deps.log.warn(
      { kind, skipped: skippedSummary(result.skipped) },
      'hava durumu: geçersiz kayıtlar atlandı',
    )
  }
  if (result.truncated) {
    deps.log.warn({ kind }, 'hava durumu: yanıt 400 kayıt sınırında; bazı raporlar eksik olabilir')
  }
  return {
    status: result.status,
    stations: stations.length,
    reports: result.items.length,
    stationsWithReport: new Set(result.items.map((item) => item.station)).size,
    skipped: result.skipped.length,
    truncated: result.truncated ?? false,
    written,
    removed,
  }
}

/** İki kaynak yanıtını birleştirir (olağan istek ve doldurma isteği). */
function mergeFetches<T>(a: WeatherFetch<T>, b: WeatherFetch<T>): WeatherFetch<T> {
  const requests =
    a.requests === undefined && b.requests === undefined
      ? undefined
      : (a.requests ?? 0) + (b.requests ?? 0)
  return {
    status: a.status === 200 || b.status === 200 ? 200 : 204,
    items: [...a.items, ...b.items],
    skipped: [...a.skipped, ...b.skipped],
    truncated: (a.truncated ?? false) || (b.truncated ?? false),
    ...(requests === undefined ? {} : { requests }),
  }
}

/**
 * METAR isteği. Geriye bakış son başarılı kontrolden gelir (`metarLookbackHours`), ama bu kontrol
 * bütün kaynağındır: listeye yeni giren istasyonun (yeni halka, D-080) kaydı olağan 2 saatle başlar
 * ve "son 24 saat" kaydı bir gün boyunca eksik kalırdı. Bu yüzden son 24 saatte hiç METAR'ı
 * saklanmamış istasyonlar ayrı bir istekle 24 saat istenir (AWC istemcisi 6'şarlı gruplara böler),
 * diğerleri olağan geriye bakışla. Denetlenen istasyonlar `backfilled`'e yazılır: hiç rapor
 * yayımlamayan istasyon her 5 dakikada değil, worker süreci başına bir kez 24 saatle istenir.
 */
async function fetchMetars(
  deps: WeatherRunDeps,
  ids: readonly string[],
  state: WeatherSourceState | null,
  now: Date,
): Promise<WeatherFetch<MetarReport>> {
  const hours = metarLookbackHours(state?.checkedAt ?? null, now)
  const seen = deps.backfilled
  if (hours >= AWC_METAR_MAX_HOURS) {
    const result = await deps.source.metars(ids, { hours })
    for (const id of ids) seen?.add(id)
    return result
  }
  const pending = seen ? ids.filter((id) => !seen.has(id)) : [...ids]
  const since = new Date(now.getTime() - AWC_METAR_MAX_HOURS * 3_600_000)
  const stored = new Set(
    pending.length === 0 ? [] : await deps.store.metarStationsSince(pending, since),
  )
  const fresh = new Set(pending.filter((id) => !stored.has(id)))
  for (const id of stored) seen?.add(id)
  if (fresh.size === 0) return deps.source.metars(ids, { hours })
  const regular = ids.filter((id) => !fresh.has(id))
  const normal = regular.length === 0 ? null : await deps.source.metars(regular, { hours })
  const filled = await deps.source.metars([...fresh], { hours: AWC_METAR_MAX_HOURS })
  for (const id of fresh) seen?.add(id)
  deps.log.info(
    { stations: [...fresh], hours: AWC_METAR_MAX_HOURS },
    'hava durumu: kaydı olmayan istasyonların son 24 saati istendi',
  )
  return normal === null ? filled : mergeFetches(normal, filled)
}

export function runWeatherMetar(deps: WeatherRunDeps): Promise<WeatherRunResult> {
  return runWeather(
    'metar',
    deps,
    (ids, state, now) => fetchMetars(deps, ids, state, now),
    (items, now) =>
      items
        .filter((m) => m.observedAt.getTime() >= now.getTime() - WEATHER_RETENTION_DAYS * DAY_MS)
        .map((m): MetarWrite => ({
          stationIcao: m.station,
          reportType: m.type,
          observedAt: m.observedAt,
          rawText: m.raw,
          qnhHpa: metarQnhHpa(m.raw),
          flightCategory: m.flightCategory,
        })),
    (rows, fetchedAt) => deps.store.upsertMetars(rows, fetchedAt),
    (stations, rows) => deps.store.retainMetars(stations, rows),
  )
}

export function runWeatherTaf(deps: WeatherRunDeps): Promise<WeatherRunResult> {
  return runWeather(
    'taf',
    deps,
    (ids) => deps.source.tafs(ids),
    (items, now) =>
      items
        .filter((t) => t.validTo.getTime() >= now.getTime() - WEATHER_RETENTION_DAYS * DAY_MS)
        .map((t): TafWrite => ({
          stationIcao: t.station,
          issuedAt: t.issuedAt,
          validFrom: t.validFrom,
          validTo: t.validTo,
          rawText: t.raw,
        })),
    (rows, fetchedAt) => deps.store.upsertTafs(rows, fetchedAt),
    (stations, rows) => deps.store.retainTafs(stations, rows),
  )
}

/** Günlük saklama: 30 günden eski raporlar ve listeden çıkan istasyonlar silinir. */
export async function runWeatherPrune(deps: {
  store: WeatherStore
  log: Logger
  now?: () => Date
}): Promise<WeatherPruneResult> {
  const now = (deps.now ?? (() => new Date()))()
  const stations = await deps.store.stations()
  const result = await deps.store.prune(now, stations)
  deps.log.info({ ...result, stations: stations.length }, 'hava durumu kaydı temizlendi')
  return result
}

/** Kapalı kaynak (lisans ya da üretimde dış istek kapalı): admin satırı nedeni gösterir. */
export async function recordWeatherSourcesDisabled(
  store: WeatherStore,
  reason: string,
  log: Logger,
): Promise<void> {
  for (const kind of ['metar', 'taf'] as const) {
    try {
      await store.recordDisabled(kind, reason)
    } catch (error) {
      log.warn({ err: error, kind }, 'hava durumu kapalılık kaydı yazılamadı')
    }
  }
}
