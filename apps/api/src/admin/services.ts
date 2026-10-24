import {
  PARTITION_DAYS_AHEAD,
  type Heartbeat,
  type ProviderSummary,
  type ReferenceStatus,
  type TrackTableStatus,
  type WeatherSourceState,
  type WeatherStatus,
} from '@havayolu/db'
import {
  errorMessage,
  overallState,
  type ServicesReport,
  type ServiceState,
  type ServiceStatus,
} from '@havayolu/shared'

/** Her yoklama bu süreyi aşarsa servis "down" sayılır; panel asla takılmaz. */
export const PROBE_TIMEOUT_MS = 2_000
/** Heartbeat bu kadar eskiyse worker "degraded" (kayıt 60 sn TTL ile silinince "down"). */
export const HEARTBEAT_STALE_MS = 45_000
/** Redis belleği maxmemory'nin bu oranını aşarsa "degraded" (infra.md uyarı eşiği). */
export const REDIS_MEMORY_WARN_RATIO = 0.8
/** Referans verisi günlük kontrol edilir; son başarılı kontrol bundan eskiyse "degraded". */
export const REFERENCE_STALE_MS = 36 * 3_600_000
/**
 * Günlük iş partition'ları PARTITION_DAYS_AHEAD gün ileriye açar; iş o gün çalışmadan önce bir gün
 * eksik görünmesi normaldir.
 */
export const PARTITION_MIN_DAYS_AHEAD = PARTITION_DAYS_AHEAD - 1
/**
 * Worker sağlayıcı sağlığını dakikada bir (ve durum değişince) yazar (D-073). Kayıt bundan eskiyse
 * worker durmuş ya da DB'ye yazamıyor demektir: son bilinen durum artık geçerli değildir.
 */
export const PROVIDER_HEALTH_STALE_MS = 180_000
/**
 * Hava durumu (D-078): METAR işi 5 dk'da bir çalışır. Son başarılı kontrol 15 dk'dan eskiyse
 * "degraded", 2 saatten eskiyse (ya da hiç yoksa) "down". TAF işi 15 dk'da bir; 1 saatten eskiyse
 * "degraded". Son 3 saatte gözlemi olan istasyon yoksa da "degraded".
 */
export const WEATHER_METAR_STALE_MS = 15 * 60_000
export const WEATHER_METAR_DOWN_MS = 2 * 3_600_000
export const WEATHER_TAF_STALE_MS = 3_600_000

/** Panelde her zaman gösterilen canlı veri sağlayıcıları; sıra sabittir (servis kimliği provider:<id>). */
export const PROVIDER_IDS = ['adsbLol', 'localReceiver'] as const

export interface RedisProbeResult {
  latencyMs: number
  usedBytes: number
  maxBytes: number | null
}

export interface HttpProbeResult {
  status: number
  body: unknown
  latencyMs: number
}

/** Servis yoklamaları; üretimde gerçek bağlantılar, testte sahte uygulamalar verilir. */
export interface ServiceProbes {
  api: { version: string; gitSha: string; startedAt: Date }
  postgres: (() => Promise<{ latencyMs: number }>) | null
  redisQueue: (() => Promise<RedisProbeResult>) | null
  redisLive: (() => Promise<RedisProbeResult>) | null
  heartbeats: (() => Promise<Heartbeat[]>) | null
  referenceData: (() => Promise<ReferenceStatus>) | null
  trackPartitions: (() => Promise<Record<string, TrackTableStatus>>) | null
  /** provider_health satırları ve 1/24 saatlik 429 oranları; veritabanı yoksa null. */
  providers: (() => Promise<ProviderSummary[]>) | null
  /**
   * Hava durumu kaynak durumu (`weatherStatus`, packages/db); veritabanı yoksa null. Verilmezse
   * satır "yapılandırılmamış" görünür.
   */
  weather?: (() => Promise<WeatherStatus>) | null
  http: (url: string) => Promise<HttpProbeResult>
  webUrl: string | null
  analyticsUrl: string | null
  expectedWorkers: string[]
  now: () => Date
}

async function withTimeout<T>(promise: Promise<T>, ms = PROBE_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`zaman aşımı (${ms} ms)`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

const errorText = (error: unknown) => errorMessage(error)

function base(id: string, kind: ServiceStatus['kind'], checkedAt: string): ServiceStatus {
  return { id, kind, state: 'ok', version: null, latencyMs: null, detail: {}, checkedAt }
}

async function redisStatus(
  id: string,
  probe: ServiceProbes['redisQueue'],
  checkedAt: string,
): Promise<ServiceStatus> {
  const status = base(id, 'redis', checkedAt)
  if (!probe) return { ...status, state: 'not_configured' }
  try {
    const result = await withTimeout(probe())
    const ratio = result.maxBytes ? result.usedBytes / result.maxBytes : null
    return {
      ...status,
      state: ratio !== null && ratio > REDIS_MEMORY_WARN_RATIO ? 'degraded' : 'ok',
      latencyMs: result.latencyMs,
      detail: {
        memoryUsedMb: Math.round((result.usedBytes / 1024 / 1024) * 10) / 10,
        memoryMaxMb: result.maxBytes ? Math.round(result.maxBytes / 1024 / 1024) : null,
      },
    }
  } catch (error) {
    return { ...status, state: 'down', detail: { error: errorText(error) } }
  }
}

async function httpVersionStatus(
  id: string,
  kind: 'web' | 'analytics',
  url: string | null,
  probes: ServiceProbes,
  checkedAt: string,
): Promise<ServiceStatus> {
  const status = base(id, kind, checkedAt)
  if (!url) return { ...status, state: 'not_configured' }
  try {
    const result = await withTimeout(probes.http(url))
    const body = (result.body ?? {}) as Record<string, unknown>
    const version = typeof body.version === 'string' ? body.version : null
    return {
      ...status,
      state: result.status >= 200 && result.status < 300 ? 'ok' : 'down',
      latencyMs: result.latencyMs,
      version,
      detail: { httpStatus: result.status },
    }
  } catch (error) {
    return { ...status, state: 'down', detail: { error: errorText(error) } }
  }
}

async function workerStatuses(probes: ServiceProbes, checkedAt: string): Promise<ServiceStatus[]> {
  if (!probes.heartbeats) {
    return probes.expectedWorkers.map((name) => ({
      ...base(`worker:${name}`, 'worker', checkedAt),
      state: 'not_configured' as const,
    }))
  }
  let heartbeats: Heartbeat[]
  try {
    heartbeats = await withTimeout(probes.heartbeats())
  } catch (error) {
    return probes.expectedWorkers.map((name) => ({
      ...base(`worker:${name}`, 'worker', checkedAt),
      state: 'down' as const,
      detail: { error: errorText(error) },
    }))
  }
  const now = probes.now().getTime()
  const names = new Set([...probes.expectedWorkers, ...heartbeats.map((h) => h.service)])
  return [...names].sort().map((name): ServiceStatus => {
    const status = base(`worker:${name}`, 'worker', checkedAt)
    const heartbeat = heartbeats.find((h) => h.service === name)
    if (!heartbeat) return { ...status, state: 'down', detail: { heartbeatAgeSec: null } }
    const ageMs = now - Date.parse(heartbeat.at)
    return {
      ...status,
      state: ageMs > HEARTBEAT_STALE_MS ? 'degraded' : 'ok',
      version: heartbeat.version,
      detail: {
        heartbeatAgeSec: Math.max(0, Math.round(ageMs / 1000)),
        roles: heartbeat.roles.join(', ') || null,
        gitSha: heartbeat.gitSha,
      },
    }
  })
}

const minOrNull = (values: (number | null)[]): number | null =>
  values.length === 0 || values.includes(null) ? null : Math.min(...(values as number[]))

/** Referans verisi: satır sayıları, son başarılı kontrolün yaşı ve son hata. */
async function referenceDataStatus(
  probes: ServiceProbes,
  checkedAt: string,
): Promise<ServiceStatus> {
  const status = base('reference-data', 'data', checkedAt)
  if (!probes.referenceData) return { ...status, state: 'not_configured' }
  try {
    const result = await withTimeout(probes.referenceData())
    const now = probes.now().getTime()
    const oldestCheck = minOrNull(result.sources.map((s) => s.checkedAt?.getTime() ?? null))
    const failing = result.sources.find(
      (s) => s.lastErrorAt && (!s.checkedAt || s.lastErrorAt.getTime() > s.checkedAt.getTime()),
    )
    const empty = result.airports === 0 || result.runways === 0 || result.airlines === 0
    const stale = oldestCheck === null || now - oldestCheck > REFERENCE_STALE_MS
    return {
      ...status,
      state: empty || failing || stale ? 'degraded' : 'ok',
      detail: {
        airports: result.airports,
        runways: result.runways,
        airlines: result.airlines,
        lastCheckAgeH:
          oldestCheck === null ? null : Math.max(0, Math.floor((now - oldestCheck) / 3_600_000)),
        origin: result.sources[0]?.origin ?? null,
        // Kayıttaki hata kaynağı zaten adlandırır (ör. "vrs-airlines: HTTP 503"); OurAirports'ta
        // iki dosya aynı hatayı taşıdığı için ayrıca kaynak adı eklenmez.
        ...(failing?.lastError ? { error: failing.lastError } : {}),
      },
    }
  } catch (error) {
    return { ...status, state: 'down', detail: { error: errorText(error) } }
  }
}

/** İz partition'ları: kaç gün ileriye açık, en eski gün, DEFAULT'a düşen satır (0 olmalı). */
async function trackPartitionsStatus(
  probes: ServiceProbes,
  checkedAt: string,
): Promise<ServiceStatus> {
  const status = base('track-partitions', 'data', checkedAt)
  if (!probes.trackPartitions) return { ...status, state: 'not_configured' }
  try {
    const tables = Object.values(await withTimeout(probes.trackPartitions()))
    const daysAhead = minOrNull(tables.map((t) => t.daysAhead))
    const defaultRows = tables.reduce((sum, t) => sum + t.defaultRows, 0)
    const oldestDay =
      tables
        .map((t) => t.oldestDay)
        .filter((day): day is string => day !== null)
        .sort()[0] ?? null
    const state: ServiceStatus['state'] =
      daysAhead === null || daysAhead < 0
        ? 'down'
        : daysAhead < PARTITION_MIN_DAYS_AHEAD || defaultRows > 0
          ? 'degraded'
          : 'ok'
    return { ...status, state, detail: { daysAhead, oldestDay, defaultRows } }
  } catch (error) {
    return { ...status, state: 'down', detail: { error: errorText(error) } }
  }
}

const ageMin = (now: number, at: Date | null): number | null =>
  at === null ? null : Math.max(0, Math.floor((now - at.getTime()) / 60_000))

/** Son başarılı kontrolden sonra hata alınmış mı (hiç başarı yoksa her hata yenidir)? */
function failingSince(source: WeatherSourceState | null): boolean {
  if (!source?.lastErrorAt) return false
  return source.checkedAt === null || source.lastErrorAt.getTime() > source.checkedAt.getTime()
}

/** Engel sürüyor mu (429 ya da 403 sonrası; süresi geçmiş engel sayılmaz)? */
const activeBlock = (source: WeatherSourceState | null, now: number) =>
  source?.blockedUntil && source.blockedUntil.getTime() > now
    ? { until: source.blockedUntil, kind: source.blockedKind }
    : null

/**
 * Hava durumu (aviationweather.gov METAR/TAF, D-078): son kontrollerin yaşı, güncel gözlemi olan
 * istasyonlar, geçerli TAF'ı olan istasyonlar, engel ve son hata. Kaynak kapalıysa (üretim
 * imajında dış istek kapalı ya da lisans izin vermiyor) "yapılandırılmamış" ve nedeni.
 */
async function weatherServiceStatus(
  probes: ServiceProbes,
  checkedAt: string,
): Promise<ServiceStatus> {
  const status = base('weather', 'data', checkedAt)
  if (!probes.weather) return { ...status, state: 'not_configured' }
  try {
    const result = await withTimeout(probes.weather())
    const { metar, taf } = result
    if (metar?.origin === 'disabled') {
      return {
        ...status,
        state: 'not_configured',
        detail: { origin: 'disabled', reason: metar.disabledReason },
      }
    }
    const now = probes.now().getTime()
    const metarAge = ageMin(now, metar?.checkedAt ?? null)
    const tafAge = ageMin(now, taf?.checkedAt ?? null)
    const blocks = [activeBlock(metar, now), activeBlock(taf, now)].filter((b) => b !== null)
    const forbidden = blocks.some((b) => b.kind === 'forbidden')
    const failing = [metar, taf].find(failingSince)
    const state: ServiceState =
      metarAge === null || metarAge * 60_000 > WEATHER_METAR_DOWN_MS || forbidden
        ? 'down'
        : metarAge * 60_000 > WEATHER_METAR_STALE_MS ||
            tafAge === null ||
            tafAge * 60_000 > WEATHER_TAF_STALE_MS ||
            failing !== undefined ||
            blocks.length > 0 ||
            result.stationsWithRecentMetar === 0
          ? 'degraded'
          : 'ok'
    const blockedUntil = blocks
      .map((b) => b.until.getTime())
      .reduce<number | null>((latest, t) => (latest === null || t > latest ? t : latest), null)
    return {
      ...status,
      state,
      detail: {
        stationsWithMetar: result.stationsWithRecentMetar,
        stationsTotal: metar?.stationCount ?? null,
        newestObsAgeMin: ageMin(now, result.newestObservedAt),
        metarCheckAgeMin: metarAge,
        tafCheckAgeMin: tafAge,
        /** Geçerli TAF'ı olan istasyon sayısı. */
        validTafCount: result.stationsWithValidTaf,
        origin: metar?.origin ?? taf?.origin ?? null,
        ...(blockedUntil === null ? {} : { blockedUntil: new Date(blockedUntil).toISOString() }),
        ...(failing?.lastError ? { error: failing.lastError } : {}),
      },
    }
  } catch (error) {
    return { ...status, state: 'down', detail: { error: errorText(error) } }
  }
}

const round = (value: number, digits: number) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** 0–1 oranını yüzdeye çevirir; oran yoksa (pencerede istek yok) null. */
const percent = (ratio: number | null, digits: number): number | null =>
  ratio === null || !Number.isFinite(ratio) ? null : round(ratio * 100, digits)

const ageSec = (now: number, at: Date | null): number | null =>
  at === null ? null : Math.max(0, Math.round((now - at.getTime()) / 1000))

/**
 * Worker'ın hesapladığı durum (data-sources.md tanımı); bilinmeyen değer çalışmıyor sayılır.
 * `limited` (günlük bütçeyle seyrek sorgu, D-122) yönetim panelinde sorunlu görünür.
 */
function providerState(status: string): ServiceState {
  if (status === 'limited') return 'degraded'
  return status === 'ok' || status === 'degraded' ? status : 'down'
}

/**
 * Canlı veri sağlayıcıları: bilinen her sağlayıcı için bir satır. Satırı olmayan sağlayıcı
 * yapılandırılmamıştır (ör. LOCAL_RECEIVER_URLS boş); kaydı eskimiş sağlayıcı çalışmıyor sayılır.
 */
async function providerStatuses(
  probes: ServiceProbes,
  checkedAt: string,
): Promise<ServiceStatus[]> {
  const baseOf = (id: string) => base(`provider:${id}`, 'provider', checkedAt)
  if (!probes.providers) {
    return PROVIDER_IDS.map((id) => ({ ...baseOf(id), state: 'not_configured' as const }))
  }
  let summaries: ProviderSummary[]
  try {
    summaries = await withTimeout(probes.providers())
  } catch (error) {
    const message = errorText(error)
    return PROVIDER_IDS.map((id) => ({
      ...baseOf(id),
      state: 'down' as const,
      detail: { error: message },
    }))
  }
  const now = probes.now().getTime()
  return PROVIDER_IDS.map((id): ServiceStatus => {
    const status = baseOf(id)
    const row = summaries.find((summary) => summary.provider === id)
    if (!row) return { ...status, state: 'not_configured' }
    const lastSuccessAgeSec = ageSec(now, row.lastSuccessAt)
    // Son bilinen hata yalnızca sağlayıcı sorunluyken gösterilir; düzelmiş eski hata yanıltır.
    // Bütçe kipinde (`limited`, D-122) durum hep `ok` dışıdır: hata ancak son başarıdan yeniyse
    // gösterilir.
    const errorAfterSuccess =
      row.lastErrorAt !== null &&
      (row.lastSuccessAt === null || row.lastErrorAt.getTime() > row.lastSuccessAt.getTime())
    const showError = row.status === 'limited' ? errorAfterSuccess : row.status !== 'ok'
    const error: Record<string, string> = showError && row.lastError ? { error: row.lastError } : {}
    const staleMs = now - row.updatedAt.getTime()
    if (staleMs > PROVIDER_HEALTH_STALE_MS) {
      return {
        ...status,
        state: 'down',
        detail: { staleSec: Math.round(staleMs / 1000), lastSuccessAgeSec, ...error },
      }
    }
    return {
      ...status,
      state: providerState(row.status),
      detail: {
        rps: row.rps === null ? null : round(row.rps, 3),
        freshnessP95Sec: row.freshnessP95S === null ? null : round(row.freshnessP95S, 1),
        errorRatioPct: percent(row.errorRatio60s, 0),
        rateLimited1hPct: percent(row.rateLimitedRatio1h, 1),
        rateLimited24hPct: percent(row.rateLimitedRatio24h, 1),
        circuit: row.circuit,
        lastSuccessAgeSec,
        ...error,
      },
    }
  })
}

/** Bütün servislerin durumunu paralel toplar. Hiçbir yoklama raporu bozamaz ya da geciktiremez. */
export async function collectServices(probes: ServiceProbes): Promise<ServicesReport> {
  const checkedAt = probes.now().toISOString()
  const api: ServiceStatus = {
    ...base('api', 'api', checkedAt),
    version: probes.api.version,
    detail: {
      gitSha: probes.api.gitSha,
      uptimeSec: Math.round((probes.now().getTime() - probes.api.startedAt.getTime()) / 1000),
    },
  }

  const postgresPromise = (async (): Promise<ServiceStatus> => {
    const status = base('postgres', 'postgres', checkedAt)
    if (!probes.postgres) return { ...status, state: 'not_configured' }
    try {
      const { latencyMs } = await withTimeout(probes.postgres())
      return { ...status, latencyMs }
    } catch (error) {
      return { ...status, state: 'down', detail: { error: errorText(error) } }
    }
  })()

  const [
    web,
    workers,
    providers,
    postgres,
    redisQueue,
    redisLive,
    analytics,
    referenceData,
    weather,
    partitions,
  ] = await Promise.all([
    httpVersionStatus('web', 'web', probes.webUrl, probes, checkedAt),
    workerStatuses(probes, checkedAt),
    providerStatuses(probes, checkedAt),
    postgresPromise,
    redisStatus('redis-queue', probes.redisQueue, checkedAt),
    redisStatus('redis-live', probes.redisLive, checkedAt),
    httpVersionStatus('analytics', 'analytics', probes.analyticsUrl, probes, checkedAt),
    referenceDataStatus(probes, checkedAt),
    weatherServiceStatus(probes, checkedAt),
    trackPartitionsStatus(probes, checkedAt),
  ])

  const services = [
    web,
    api,
    ...workers,
    ...providers,
    postgres,
    redisQueue,
    redisLive,
    referenceData,
    weather,
    partitions,
    analytics,
  ]
  return { checkedAt, overall: overallState(services), services }
}
