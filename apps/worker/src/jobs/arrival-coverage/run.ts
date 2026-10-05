import {
  arrivalCoverageSampleBatches,
  ARRIVAL_SAMPLE_BATCH_FLIGHTS,
  claimNextArrivalCoverageReport,
  failArrivalCoverageReport,
  findArrivalCandidateFlights,
  finishArrivalCoverageReport,
  readArrivalCoverageFlights,
  readArrivalCoverageStations,
  readArrivalCoverageWindowStats,
  readMetarQnhSeries,
  readNearbyAirfields,
  readProviderWindowStats,
  writeStationArrivalCoverage7d,
  type Database,
  type ReadOnlyOptions,
} from '@havayolu/db'
import { PROVIDER_LICENSES } from '@havayolu/providers'
import {
  ARRIVAL_CANDIDATE_RULE,
  ARRIVAL_COVERAGE_DEFINITION_VERSION,
  ARRIVAL_COVERAGE_LOOKBACK_MS,
  ARRIVAL_COVERAGE_RATIO_HOURS,
  ARRIVAL_COVERAGE_SETTLE_MS,
  ARRIVAL_NEARBY_AIRFIELD_KM,
  ARRIVAL_PROVIDER_DEGRADED_WITHIN_MS,
  ARRIVAL_QNH_MAX_AGE_MS,
  ARRIVAL_ZONE_KM,
  arrivalCoverageWindow,
  type ArrivalCoverageResult,
  type ArrivalGeomOnlyObservation,
  type ArrivalObservation,
} from '@havayolu/shared'
import { arrivalCoverageRatioRows, summarizeArrivalCoverage } from './aggregate'
import { classifyArrivalRecord, coverageStationsFromRows } from './classify'
import { renderArrivalCoverageMarkdown, type ArrivalCoverageReportSource } from './render'

/**
 * Kapsama raporunun IO katmanı (Parça 1 M7b.2, D-098): veritabanı okuyucularını sırayla çağırır,
 * her uçuş kaydını saf sınıflandırıcıdan geçirir ve yalnızca gözlemleri tutar (örnekler partiden
 * sonra bırakılır), sonra toplayıcıyla sonucu üretir.
 *
 * - **Rapor işi** (`runNextArrivalCoverageReport`): sıradaki `queued` satırı üstlenir, saklama
 *   süresini denetler, hesaplar, Türkçe Markdown'ı üretir ve satırı `done` ya da `failed` yapar.
 *   Hata metni Türkçedir; admin sayfası onu olduğu gibi gösterir.
 * - **Günlük iş** (`runArrivalCoverageRatio7d`): son 7 günü aynı kodla hesaplar ve istasyonların
 *   `coverage_ground_ratio_7d`, `coverage_arrivals_7d`, `coverage_updated_at` sütunlarını yazar.
 *   Veri yoksa varış 0, oran boş yazılır (ingest çalışmadan önce "—").
 * - **Yerel komut** (`pnpm coverage:report`): `computeArrivalCoverage` + `renderArrivalCoverageMarkdown`.
 *
 * Üretim güvenliği: okumalar salt okunur işlemlerdedir (okuyucular: 60 sn ifade, 2 sn kilit,
 * 55P03/57014'te üç deneme). İşin bütçesi 10 dk'dır. Bütçe ve kapanış sinyali (`signal`) adımlar
 * ve partiler arasında, ayrıca okuyucuların içinde her ifade denemesinden ve her yeniden deneme
 * beklemesinden önce denetlenir (`ReadOnlyOptions.checkpoint`): gün gün okunan 7 günlük pencere de
 * bütçeyi en geç bir ifade (≤ 60 sn) aşar. Çıktıda hex, çağrı kodu ve tescil yoktur.
 */

type Sql = Database['sql']

/** İşin süre sınırı; aşılırsa rapor `failed` olur (günlük işte yeniden denenmez). */
export const ARRIVAL_COVERAGE_BUDGET_MS = 10 * 60_000
/** Sağlayıcı sayaçlarının okunduğu canlı kaynak. */
export const ARRIVAL_COVERAGE_PROVIDER = PROVIDER_LICENSES.adsbLol.id

export type ArrivalCoverageFailureCode =
  | 'retention_exceeded'
  | 'no_stations'
  | 'no_baro_rate'
  | 'budget_exceeded'
  | 'aborted'
  | 'statement_timeout'
  | 'lock_timeout'
  | 'unexpected'

/** Bilinen başarısızlık: `code` günlüğe, Türkçe `message` rapor satırının hata sütununa gider. */
export class ArrivalCoverageError extends Error {
  readonly code: ArrivalCoverageFailureCode

  constructor(code: ArrivalCoverageFailureCode, message: string) {
    super(message)
    this.name = 'ArrivalCoverageError'
    this.code = code
  }
}

/** En uzun rapor: pencere + 24 sa geriye bakış ince iz saklama süresine sığmalı. */
export function arrivalCoverageMaxHours(fineRetentionDays: number): number {
  return Math.max(0, (Math.floor(fineRetentionDays) - 1) * 24)
}

const minutes = (ms: number) => Math.round(ms / 60_000)

export function retentionExceededError(hours: number, fineRetentionDays: number) {
  const max = arrivalCoverageMaxHours(fineRetentionDays)
  return new ArrivalCoverageError(
    'retention_exceeded',
    `${hours} saatlik rapor ince iz saklama süresini aşıyor: TRACK_FINE_RETENTION_DAYS=${fineRetentionDays} ` +
      `iken en çok ${max} saat seçilebilir (pencereden önce ${ARRIVAL_COVERAGE_LOOKBACK_MS / 3_600_000} ` +
      'saat geriye bakılır).',
  )
}

const noStationsError = () =>
  new ArrivalCoverageError(
    'no_stations',
    'Etkin istasyon yok ya da istasyonların havalimanı kaydı eksik (referans verisi içe ' +
      'aktarılmamış olabilir).',
  )

const noBaroRateError = (hours: number) =>
  new ArrivalCoverageError(
    'no_baro_rate',
    "Pencerede baro_rate_fpm'i dolu havadaki ince iz örneği yok: pencere v0.20.0 ingest'i " +
      "çalışmadan önceki bir aralığa düşüyor ya da üretim ingest'i çalışmıyor. Ingest en az " +
      `${hours} saat ${minutes(ARRIVAL_COVERAGE_SETTLE_MS)} dakika çalıştıktan sonra raporu ` +
      'yeniden başlat.',
  )

const budgetError = (budgetMs: number, done: number, total: number) =>
  new ArrivalCoverageError(
    'budget_exceeded',
    `Rapor ${minutes(budgetMs)} dakikalık süre sınırını aştı (` +
      (total === 0 ? 'uçuş örnekleri okunmadan önce' : `${done}/${total} uçuş partisi okundu`) +
      '); daha kısa bir süre seç.',
  )

const abortedError = () =>
  new ArrivalCoverageError(
    'aborted',
    'Worker kapanırken rapor yarıda kaldı; raporu yeniden başlat.',
  )

/** Hata → kod ve Türkçe ileti (rapor satırının hata sütunu en çok 500 karakter tutar). */
export function arrivalCoverageFailure(error: unknown): {
  code: ArrivalCoverageFailureCode
  message: string
} {
  if (error instanceof ArrivalCoverageError) return { code: error.code, message: error.message }
  const sqlState = (error as { code?: unknown } | null)?.code
  if (sqlState === '57014') {
    return {
      code: 'statement_timeout',
      message:
        'Veritabanı sorgusu 60 sn sınırını üç denemede de aştı; daha kısa bir süre seç ya da ' +
        'sonra yeniden dene.',
    }
  }
  if (sqlState === '55P03') {
    return {
      code: 'lock_timeout',
      message:
        'Veritabanı kilidi üç denemede de alınamadı (partition bakımı sürüyor olabilir); birkaç ' +
        'dakika sonra yeniden dene.',
    }
  }
  const text = error instanceof Error ? error.message : String(error)
  return { code: 'unexpected', message: `Beklenmeyen hata: ${text}` }
}

/**
 * Günlük oran işinin hatası BullMQ'da yeniden denenmeli mi? Bilinen hatalar (bütçe aşımı vb.) ve
 * üç denemede de zaman aşımına uğrayan (57014) ya da kilit alamayan (55P03) okuma yeniden
 * denenmez: her BullMQ denemesi 7 günlük taramayı baştan yapardı. Kapanışta yarıda kalan iş
 * (`aborted`, yayın ya da yeniden başlatma) ve beklenmeyen hatalar (bağlantı) yeniden denenir.
 */
export function arrivalCoverageRatioRetryable(error: unknown): boolean {
  if (error instanceof ArrivalCoverageError) return error.code === 'aborted'
  const code = arrivalCoverageFailure(error).code
  return code !== 'statement_timeout' && code !== 'lock_timeout'
}

/** Pino ile uyumlu en küçük günlükçü (yerel komut kendi günlükçüsünü verebilir). */
export interface ArrivalCoverageLogger {
  info(obj: Record<string, unknown>, msg: string): void
  warn(obj: Record<string, unknown>, msg: string): void
}

const silentLogger: ArrivalCoverageLogger = { info: () => undefined, warn: () => undefined }

export interface ArrivalCoverageComputeDeps {
  sql: Sql
  log?: ArrivalCoverageLogger
  /** Bütçe saati (ms); varsayılan `performance.now`. */
  clock?: () => number
  budgetMs?: number
  /** Kapanışta iptal; adımlar, partiler ve ifade denemeleri arasında denetlenir. */
  signal?: AbortSignal
  /** Okuyucu ayarları (zaman aşımı, deneme); testler kısaltır. */
  readOptions?: ReadOnlyOptions
  /** Parti başına uçuş kaydı (en çok 200). */
  batchSize?: number
}

export interface ArrivalCoverageComputeParams {
  /** İşin başlangıcı: pencere `[jobStart − 45 dk − saat, jobStart − 45 dk)`. */
  jobStart: Date
  hours: number
  /**
   * Penceredeki hiçbir istasyon bölgesinde `baro_rate`'i dolu örnek yoksa hata (rapor). Günlük iş
   * bunu istemez: veri yokken varış 0 yazılır.
   */
  requireBaroRate?: boolean
}

export interface ArrivalCoverageComputeStats {
  stations: number
  candidates: number
  flights: number
  batches: number
  samples: number
  arrivals: number
  geomOnly: number
  durationMs: number
}

export interface ArrivalCoverageComputation {
  result: ArrivalCoverageResult
  stats: ArrivalCoverageComputeStats
}

/** Raporun hesabı (rapor işi, günlük iş ve yerel komut ortak). */
export async function computeArrivalCoverage(
  deps: ArrivalCoverageComputeDeps,
  params: ArrivalCoverageComputeParams,
): Promise<ArrivalCoverageComputation> {
  const { sql, signal } = deps
  const log = deps.log ?? silentLogger
  const clock = deps.clock ?? (() => performance.now())
  const budgetMs = deps.budgetMs ?? ARRIVAL_COVERAGE_BUDGET_MS
  const batchSize = Math.max(
    1,
    Math.min(ARRIVAL_SAMPLE_BATCH_FLIGHTS, deps.batchSize ?? ARRIVAL_SAMPLE_BATCH_FLIGHTS),
  )
  const started = clock()
  let batchesDone = 0
  let batchesTotal = 0
  const checkpoint = () => {
    if (signal?.aborted) throw abortedError()
    if (clock() - started > budgetMs) throw budgetError(budgetMs, batchesDone, batchesTotal)
  }
  // Okuyucular denetimi her ifade denemesinden ve yeniden deneme beklemesinden önce çağırır: gün
  // dilimleri, uçuş parçaları ve partiler bütçeyi ve kapanışı en geç bir ifade sonra görür.
  const read: ReadOnlyOptions = {
    ...deps.readOptions,
    onRetry: (info) => {
      log.warn({ ...info }, 'arrival coverage read retry')
      deps.readOptions?.onRetry?.(info)
    },
    checkpoint: () => {
      checkpoint()
      deps.readOptions?.checkpoint?.()
    },
  }

  const window = arrivalCoverageWindow(params.jobStart.getTime(), params.hours)
  const from = new Date(window.start)
  const to = new Date(window.end)

  checkpoint()
  const rows = await readArrivalCoverageStations(sql, read)
  if (rows.length === 0) throw noStationsError()
  const centers = rows.map((r) => ({ icao: r.icao, lat: r.lat, lon: r.lon }))
  const airfields = await readNearbyAirfields(
    sql,
    { stations: centers, radiusKm: ARRIVAL_NEARBY_AIRFIELD_KM },
    read,
  )
  const stations = coverageStationsFromRows(rows, airfields)
  checkpoint()

  const windowStats = await readArrivalCoverageWindowStats(
    sql,
    { stations: centers, zoneKm: ARRIVAL_ZONE_KM, from, to },
    read,
  )
  if (params.requireBaroRate !== false && windowStats.every((s) => s.firstBaroRateTs === null)) {
    throw noBaroRateError(params.hours)
  }
  checkpoint()

  const candidates = await findArrivalCandidateFlights(
    sql,
    {
      stations: rows.map((r) => ({
        icao: r.icao,
        lat: r.lat,
        lon: r.lon,
        elevationFt: r.elevationFt,
      })),
      rule: ARRIVAL_CANDIDATE_RULE,
      from,
      to,
    },
    read,
  )
  checkpoint()
  const flights = await readArrivalCoverageFlights(sql, candidates, read)
  checkpoint()

  const observations: ArrivalObservation[] = []
  const geomOnly: ArrivalGeomOnlyObservation[] = []
  let samples = 0
  batchesTotal = Math.ceil(flights.length / batchSize)
  for await (const batch of arrivalCoverageSampleBatches(
    sql,
    {
      flights,
      lookbackStart: new Date(window.lookbackStart),
      to: params.jobStart,
      batchSize,
    },
    read,
  )) {
    for (const record of batch) {
      samples += record.samples.length
      const classified = classifyArrivalRecord(
        { lastSeenTs: record.lastSeenTs, samples: record.samples },
        stations,
        { closedCutoffTs: window.closedCutoff },
      )
      observations.push(...classified.arrivals)
      geomOnly.push(...classified.geomOnly)
    }
    batchesDone += 1
    checkpoint()
  }

  // Durum geçişleri pencere sonundan 10 dk sonrasına kadar okunur: pencerenin son dakikalarındaki
  // varıştan sonraki kesinti de sayılır (iş pencere sonundan 45 dk sonra başlar, veri vardır).
  const provider = await readProviderWindowStats(
    sql,
    {
      provider: ARRIVAL_COVERAGE_PROVIDER,
      from,
      to,
      statusUntil: new Date(window.end + ARRIVAL_PROVIDER_DEGRADED_WITHIN_MS),
    },
    read,
  )
  const qnh = await readMetarQnhSeries(
    sql,
    {
      icaos: rows.map((r) => r.icao),
      from: new Date(window.start - ARRIVAL_QNH_MAX_AGE_MS),
      to,
    },
    read,
  )
  checkpoint()

  const result = summarizeArrivalCoverage({
    window,
    hours: params.hours,
    stations,
    observations,
    geomOnly,
    windowStats,
    provider,
    qnh,
  })
  return {
    result,
    stats: {
      stations: stations.length,
      candidates: candidates.length,
      flights: flights.length,
      batches: batchesDone,
      samples,
      arrivals: result.totals.arrivals,
      geomOnly: geomOnly.length,
      durationMs: Math.round(clock() - started),
    },
  }
}

export interface ArrivalCoverageReportDeps extends ArrivalCoverageComputeDeps {
  now?: () => Date
  /** Raporun başlığındaki uygulama sürümü. */
  appVersion: string
  /** `TRACK_FINE_RETENTION_DAYS`. */
  fineRetentionDays: number
}

export type ArrivalCoverageReportOutcome =
  | { kind: 'idle' }
  | {
      kind: 'done'
      reportId: number
      hours: number
      /** Satır hâlâ `running` iken yazıldı (eskiyip kapandıysa false). */
      stored: boolean
      stats: ArrivalCoverageComputeStats
    }
  | {
      kind: 'failed'
      reportId: number
      hours: number
      code: ArrivalCoverageFailureCode
      message: string
      stored: boolean
    }

/**
 * Sıradaki kuyruktaki raporu üstlenir ve çalıştırır; kuyruk boşsa `idle`. Üstlenme eskimiş
 * satırları kapatır ve pencereyi yazar. Saklama süresi üstlenmeden hemen sonra, okumadan önce
 * denetlenir. Hata satıra yazılır ve fırlatılmaz (yalnızca üstlenme ya da bağlantı hatası fırlar).
 */
export async function runNextArrivalCoverageReport(
  deps: ArrivalCoverageReportDeps,
): Promise<ArrivalCoverageReportOutcome> {
  const now = deps.now ?? (() => new Date())
  const log = deps.log ?? silentLogger
  const claimed = await claimNextArrivalCoverageReport(deps.sql, {
    now: now(),
    settleMs: ARRIVAL_COVERAGE_SETTLE_MS,
    definitionVersion: ARRIVAL_COVERAGE_DEFINITION_VERSION,
  })
  if (claimed === null) return { kind: 'idle' }
  const base = { reportId: claimed.id, hours: claimed.hours }
  log.info({ ...base }, 'arrival coverage report started')
  try {
    if (claimed.hours > arrivalCoverageMaxHours(deps.fineRetentionDays)) {
      throw retentionExceededError(claimed.hours, deps.fineRetentionDays)
    }
    const { result, stats } = await computeArrivalCoverage(deps, {
      jobStart: claimed.startedAt,
      hours: claimed.hours,
      requireBaroRate: true,
    })
    const source: ArrivalCoverageReportSource = { kind: 'admin', reportId: claimed.id }
    const markdown = renderArrivalCoverageMarkdown(result, { source, appVersion: deps.appVersion })
    const stored = await finishArrivalCoverageReport(deps.sql, {
      id: claimed.id,
      now: now(),
      result,
      markdown,
    })
    if (stored) log.info({ ...base, ...stats }, 'arrival coverage report done')
    else log.warn({ ...base }, 'arrival coverage report finished after its row expired')
    return { kind: 'done', ...base, stored, stats }
  } catch (error) {
    const failure = arrivalCoverageFailure(error)
    let stored = false
    try {
      stored = await failArrivalCoverageReport(deps.sql, {
        id: claimed.id,
        now: now(),
        error: failure.message,
      })
    } catch (writeError) {
      log.warn({ ...base, err: writeError }, 'arrival coverage failure could not be stored')
    }
    log.warn(
      {
        ...base,
        code: failure.code,
        stored,
        ...(failure.code === 'unexpected' ? { err: error } : {}),
      },
      'arrival coverage report failed',
    )
    return { kind: 'failed', ...base, code: failure.code, message: failure.message, stored }
  }
}

export interface ArrivalCoverageRatioSummary {
  windowStart: string
  windowEnd: string
  stations: number
  updated: number
  arrivals: number
  groundSeen: number
  stats: ArrivalCoverageComputeStats
}

/**
 * Günlük 7 günlük oran: aynı hesap `ARRIVAL_COVERAGE_RATIO_HOURS` saatlik pencerede; etkin her
 * istasyon için oran (varış yoksa boş), varış sayısı ve güncellenme zamanı yazılır. Etkin
 * istasyon yoksa (referans verisi henüz yok) hiçbir şey yazılmaz; bu hata sayılmaz.
 */
export async function runArrivalCoverageRatio7d(
  deps: ArrivalCoverageComputeDeps & { now?: () => Date },
): Promise<ArrivalCoverageRatioSummary | { stations: 0; updated: 0 }> {
  const now = deps.now ?? (() => new Date())
  let computation: ArrivalCoverageComputation
  try {
    computation = await computeArrivalCoverage(deps, {
      jobStart: now(),
      hours: ARRIVAL_COVERAGE_RATIO_HOURS,
      requireBaroRate: false,
    })
  } catch (error) {
    if (error instanceof ArrivalCoverageError && error.code === 'no_stations') {
      return { stations: 0, updated: 0 }
    }
    throw error
  }
  const { result, stats } = computation
  const rows = arrivalCoverageRatioRows(result)
  const updated = await writeStationArrivalCoverage7d(deps.sql, rows, now())
  return {
    windowStart: result.window.start,
    windowEnd: result.window.end,
    stations: rows.length,
    updated,
    arrivals: result.totals.arrivals,
    groundSeen: result.totals.groundSeen,
    stats,
  }
}
