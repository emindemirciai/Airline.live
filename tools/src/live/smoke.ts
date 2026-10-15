import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import {
  activeStationsWithArp,
  createDb,
  createRedis,
  LIVE_KEYS,
  readProviderSummaries,
  runMigrations,
  SEED_STATIONS,
  seedStations,
  stations as stationsTable,
  type Database,
  type ProviderSummary,
} from '@havayolu/db'
import { coveragePlan, type PlannedCircle } from '@havayolu/geo/coverage'
import { ADSBLOL_BASE_URL } from '@havayolu/providers'
import { DEFAULT_APP_NAME } from '@havayolu/shared'
import { EnvError, parseEnv, type Env } from '@havayolu/worker/env'
import {
  startIngest,
  type IngestDeps,
  type IngestHandle,
  type IngestStats,
} from '@havayolu/worker/ingest'
import { ADSBLOL_RATE } from '@havayolu/worker/ingest/rate'
import { FRESHNESS_TARGET_PRIMARY_MS } from '@havayolu/worker/ingest/status'
import { fixtureFetcher, runReferenceImport } from '@havayolu/worker/jobs/reference'
import { createRedactor, userAgentWebHost } from './env'
import { checkLiveGates, isLiveBaseUrl, refusalText, type Refusal } from './gates'
import {
  assertAllowedBaseUrl,
  createLiveFetch,
  LiveGuardError,
  pointPath,
  type LiveFetch,
  type LiveRequestRecord,
} from './guard'
import {
  acquireLiveLock,
  checkLiveLock,
  closeLiveRedis,
  connectLiveRedis,
  lastLiveRequestAt,
  LIVE_LOCK_REFRESH_MS,
  liveStartNotBefore,
  otherIngestActive,
  releaseLiveLock,
  type LiveLockCheck,
  type LiveRedis,
  type LiveRedisFactory,
} from './lock'
import { createToolLogger } from './logger'
import { findStationPoint } from './station'

/**
 * `pnpm smoke:live` (M7a, D-094): worker'ın gerçek ingest'i (`startIngest`) bu süreçte 5 dk canlı
 * adsb.lol'e karşı çalışır; ardından üç ölçüt denetlenir:
 * - Türkiye bbox'ında görülen farklı uçak ≥ 50 (`hy:ac:updates` stream'i, gizlilik süzgecinden önce)
 * - birincil istasyon veri yaşı p95 ≤ 20 sn (`provider_health.freshness_p95_s`, worker'ın tanımı)
 * - `provider_health`'te adsbLol satırı: çalıştırmadan yeni, son başarı dolu, devre `config` değil
 *
 * Yalıtım yerel altyapıdadır: `app_smoke_live` veritabanı her çalıştırmada yeniden kurulur
 * (migration'lar, tohum istasyonları, commit'li fixture'dan içe aktarım; ağa çıkılmaz) ve inceleme
 * için kalır; ingest redis-live'ın 7 numaralı veritabanına yazar (başta ve sonda temizlenir). Kilit
 * ve başka ingest denetimi env'in kendi redis-live indeksindedir. Rapor yalnızca sayı taşır; hex,
 * tescil, çağrı kodu, adres, parola ve e-posta yazılmaz.
 *
 * Canlı istek atar (CLAUDE.md DUR-SOR 6): `--confirm` olmadan yalnızca plan yazılır, dosya okumak
 * dışında hiçbir IO yapılmaz. Testler 127.0.0.1'deki sahte sunucuyla çalışır.
 */

export const TURKEY_BBOX = { minLat: 35, maxLat: 43, minLon: 25, maxLon: 45 } as const
export type Bbox = { minLat: number; maxLat: number; minLon: number; maxLon: number }

export const SMOKE_DURATION_MS = 300_000
export const SMOKE_MIN_AIRCRAFT = 50
/** Birincil istasyon tazelik hedefi (worker'ın `FRESHNESS_TARGET_PRIMARY_MS`'i), saniye. */
export const SMOKE_FRESHNESS_LIMIT_S = FRESHNESS_TARGET_PRIMARY_MS / 1000
/** `freshness_p95_s` sütunu `real` (float4): 20,0 yazılan değer 20,0000xx okunabilir. */
export const SMOKE_FRESHNESS_EPSILON_S = 1e-4
export const SMOKE_DB_NAME = 'app_smoke_live'
export const SMOKE_LIVE_DB_INDEX = 7
/** Redis ve PostgreSQL'in ilk yanıtı için beklenen en uzun süre. */
export const SMOKE_CONNECT_TIMEOUT_MS = 3_000
/** Bekleme döngüsünün yoklama aralığı. */
export const SMOKE_POLL_MS = 250
export const SMOKE_PROGRESS_MS = 30_000
const XRANGE_BATCH = 5_000
/** Kapanıştaki temizlik çağrılarının (flushdb, kilit bırakma) üst sınırı. */
const CLEANUP_TIMEOUT_MS = 3_000

export interface SmokeTargets {
  databaseName: string
  liveDbIndex: number
}

export interface SmokeClock {
  now(): number
  sleep(ms: number): Promise<void>
}

/** Ingest'in yazdığı redis-live istemcisi (ioredis; flushdb ve XRANGE için tam tip). */
type SmokeRedis = ReturnType<typeof createRedis>

export type SmokeStopReason = 'completed' | 'interrupted' | 'config' | 'guard' | 'lock'
export type SmokeExitCode = 0 | 1 | 2 | 3 | 4 | 130

// ---------------------------------------------------------------------------------------------
// Hedefler ve ortam

const SMOKE_DB_PATTERN = /^app_(smoke_live|test_[a-z0-9_]+)$/

function present(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed : null
}

/** Adresin yolunu değiştirir (Redis'te `?db=` de atılır); ayrıştırılamazsa null. */
function withPath(raw: string, pathname: string): string | null {
  try {
    const url = new URL(raw)
    url.pathname = pathname
    if (url.protocol === 'redis:' || url.protocol === 'rediss:') url.searchParams.delete('db')
    return url.toString()
  } catch {
    return null
  }
}

function databaseNameOf(raw: string | undefined): string | null {
  const value = present(raw)
  if (value === null) return null
  try {
    return decodeURIComponent(new URL(value).pathname.replace(/^\//, ''))
  } catch {
    return null
  }
}

/** Redis adresinin veritabanı indeksi (`/N`, yoksa `?db=N`, yoksa 0); geçersizse null. */
function redisIndexOf(raw: string | undefined): number | null {
  const value = present(raw)
  if (value === null) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  const fromPath = url.pathname.replace(/^\//, '')
  const text = fromPath || url.searchParams.get('db') || '0'
  return /^\d{1,2}$/.test(text) ? Number(text) : null
}

/**
 * Smoke'un worker env kaynağı: dış sağlayıcılar açık, yerel alıcı ve takip listesi boş; yerel
 * `WEB_HOST` boşaltılır (User-Agent `(+mailto:…)` olur); veritabanı ve redis-live hedefleri smoke'un
 * kendi veritabanı ve indeksidir. Kaynak değiştirilmez.
 */
export function smokeEnvSource(
  source: Record<string, string | undefined>,
  targets: SmokeTargets,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {
    ...source,
    EXTERNAL_PROVIDERS_DISABLED: 'false',
    LOCAL_RECEIVER_URLS: '',
    WATCH_HEX_LIST: '',
    WEB_HOST: userAgentWebHost(source.WEB_HOST) ?? '',
  }
  const database = present(source.DATABASE_URL)
  if (database !== null) {
    out.DATABASE_URL = withPath(database, `/${targets.databaseName}`) ?? database
  }
  const live = present(source.REDIS_LIVE_URL)
  if (live !== null) out.REDIS_LIVE_URL = withPath(live, `/${targets.liveDbIndex}`) ?? live
  return out
}

/**
 * Hedefler güvenli mi: veritabanı adı `app_smoke_live` (testte `app_test_*`) ve `DATABASE_URL`'in
 * kendi veritabanı değil; redis-live indeksi 1–15 ve `REDIS_LIVE_URL`'inkinden farklı. Değilse
 * LiveGuardError('targets'): smoke silip yeniden kurduğu veritabanını ve temizlediği indeksi asla
 * geliştirme verisiyle paylaşmaz.
 */
export function assertSmokeTargets(
  source: Record<string, string | undefined>,
  targets: SmokeTargets,
): void {
  const fail = (): never => {
    throw new LiveGuardError('targets')
  }
  if (!SMOKE_DB_PATTERN.test(targets.databaseName)) fail()
  const envDb = databaseNameOf(source.DATABASE_URL)
  if (envDb === null || envDb.toLowerCase() === targets.databaseName) fail()
  const index = targets.liveDbIndex
  if (!Number.isInteger(index) || index < 1 || index > 15) fail()
  const envIndex = redisIndexOf(source.REDIS_LIVE_URL)
  if (envIndex === null || envIndex === index) fail()
}

/** Çıktı maskesi: e-posta, API anahtarı ve bağlantı adreslerindeki parolalar. */
function smokeRedactor(source: Record<string, string | undefined>): (text: string) => string {
  const secrets: Record<string, string | undefined> = {
    CONTACT_EMAIL: source.CONTACT_EMAIL,
    ADSBLOL_API_KEY: source.ADSBLOL_API_KEY,
  }
  for (const name of ['DATABASE_URL', 'REDIS_LIVE_URL', 'REDIS_QUEUE_URL']) {
    const value = present(source[name])
    if (value === null) continue
    try {
      const password = decodeURIComponent(new URL(value).password)
      // Çok kısa değer metni bozar; geliştirme parolaları uzundur.
      if (password.length >= 6) secrets[`${name}:parola`] = password
    } catch {
      // Ayrıştırılamayan adres kapılarda reddedilir.
    }
  }
  return createRedactor(secrets)
}

// ---------------------------------------------------------------------------------------------
// Bbox sayımı

export interface BboxCount {
  /** Bbox içinde en az bir kez görülen farklı hex. */
  total: number
  /** Bunlardan dbFlags'i bilinen ve askerî biti (1) olmayanlar. */
  visible: number
  /** ICAO dışı adresler (`~` önekli). */
  nonIcao: number
  /** Ayrıştırılamayan stream kayıtları. */
  malformed: number
}

interface ParsedCompact {
  hex: string
  lat: number
  lon: number
  dbFlags: number | null
}

/** Stream kaydının `c` alanı: CompactAircraft `[hex, lat, lon, …, dbFlags]` (packages/db). */
function parseCompact(fields: readonly string[]): ParsedCompact | null {
  let raw: string | undefined
  for (let i = 0; i + 1 < fields.length; i += 2) {
    if (fields[i] === 'c') raw = fields[i + 1]
  }
  if (raw === undefined) return null
  let tuple: unknown
  try {
    tuple = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(tuple) || tuple.length < 9) return null
  const [hex, lat, lon] = tuple as unknown[]
  const flags: unknown = tuple[8]
  if (typeof hex !== 'string' || !hex) return null
  if (typeof lat !== 'number' || !Number.isFinite(lat)) return null
  if (typeof lon !== 'number' || !Number.isFinite(lon)) return null
  // Bozuk dbFlags bilinmiyor sayılır (görünür sayılmaz).
  const dbFlags = typeof flags === 'number' && Number.isInteger(flags) && flags >= 0 ? flags : null
  return { hex, lat, lon, dbFlags }
}

/**
 * XRANGE kayıtlarından bbox (sınırlar dahil) içinde görülen farklı uçaklar. Bir hex'in görünürlüğü
 * bbox içindeki son kaydının dbFlags'inden okunur. Bozuk kayıt sayılır, hata fırlatılmaz.
 */
export function countBboxAircraft(
  entries: readonly (readonly [string, readonly string[]])[],
  bbox: Bbox = TURKEY_BBOX,
): BboxCount {
  const inside = new Map<string, number | null>()
  let malformed = 0
  for (const [, fields] of entries) {
    const parsed = parseCompact(fields)
    if (parsed === null) {
      malformed += 1
      continue
    }
    const { hex, lat, lon, dbFlags } = parsed
    if (lat < bbox.minLat || lat > bbox.maxLat || lon < bbox.minLon || lon > bbox.maxLon) continue
    inside.set(hex, dbFlags)
  }
  let visible = 0
  let nonIcao = 0
  for (const [hex, dbFlags] of inside) {
    if (hex.startsWith('~')) nonIcao += 1
    if (dbFlags !== null && (dbFlags & 1) === 0) visible += 1
  }
  return { total: inside.size, visible, nonIcao, malformed }
}

// ---------------------------------------------------------------------------------------------
// Değerlendirme ve rapor

export interface SmokeObservations {
  /** `APP_NAME` (rapor başlığı). */
  appName: string
  version: string
  /** Kapılardan sonra hazırlığın başladığı an (ms). */
  startedAt: number
  /** `startIngest`'in döndüğü an: ölçüm penceresi buradan başlar. */
  ingestStartedAt: number
  /** Beklemenin bittiği, kapanışın başladığı an. */
  ingestStoppedAt: number
  /** Kapanış ve okumalar bittiğinde. */
  endedAt: number
  stopReason: SmokeStopReason
  /** Birincil istasyonun ICAO'su (tohumda LTFM). */
  primaryIcao: string
  requests: readonly LiveRequestRecord[]
  /** Birincil istasyonu kapsayan çemberlerin yolları. */
  primaryPaths: readonly string[]
  bbox: BboxCount
  health: ProviderSummary | null
  /** Çalıştırma başında veritabanı saati (ms); `updated_at` bununla karşılaştırılır. */
  dbStartMs: number
  stats: IngestStats
}

export interface SmokeCheck {
  id: 'bbox' | 'freshness' | 'health'
  pass: boolean
  detail: string
}

export interface SmokeReport {
  pass: boolean
  checks: SmokeCheck[]
  lines: string[]
}

const decimal = (value: number, digits: number) => value.toFixed(digits).replace('.', ',')

function utcClock(ms: number): string {
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? '--:--:--Z' : `${date.toISOString().slice(11, 19)}Z`
}

function utcDateTime(ms: number): string {
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return '----------'
  const iso = date.toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}Z`
}

/** "8,0 sn", "5 dk 2 sn". */
export function durationText(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0
  if (safe < 60_000) return `${decimal(safe / 1000, 1)} sn`
  const total = Math.round(safe / 1000)
  return `${Math.floor(total / 60)} dk ${total % 60} sn`
}

const rpsText = (rps: number | null) => (rps === null ? '—' : `${decimal(rps, 3)} istek/sn`)

const STOP_TEXT: Record<Exclude<SmokeStopReason, 'completed'>, string> = {
  interrupted: 'Ctrl+C ile durduruldu; rapor yarım',
  config:
    'adsb.lol 401/403 döndü; istekler durdu, yeniden denenmedi. DUR-SOR 3: dur ve bildir (RUNBOOK: adsb.lol API anahtarı istemeye başladı)',
  guard: 'bekçi ihlali; istekler durdu',
  lock: "canlı araç kilidi kaybedildi ya da adsb.lol'den çeken başka bir ingest başladı; istekler durdu",
}

const INTERRUPTED_BEFORE_INGEST = 'Ctrl+C ile durduruldu; ingest başlamadı, istek atılmadı'

function bboxLabel(): string {
  const b = TURKEY_BBOX
  return `(${b.minLat}–${b.maxLat} K, ${b.minLon}–${b.maxLon} D)`
}

function requestLines(obs: SmokeObservations): string[] {
  const list = obs.requests
  let ok = 0
  let limited = 0
  let server = 0
  for (const r of list) {
    if (r.status === 200) ok += 1
    else if (r.status === 429 || r.status === 420) limited += 1
    else if (r.status !== null && r.status >= 500) server += 1
  }
  const other = list.length - ok - limited - server
  const starts = list.map((r) => r.startedAt).sort((a, b) => a - b)
  let minGap: number | null = null
  for (let i = 1; i < starts.length; i += 1) {
    const gap = (starts[i] as number) - (starts[i - 1] as number)
    if (minGap === null || gap < minGap) minGap = gap
  }
  const summary = [
    `İstekler: ${list.length}`,
    `200: ${ok}`,
    `429/420: ${limited}`,
    `5xx: ${server}`,
    `ağ/diğer: ${other}`,
    `en kısa aralık ${minGap === null ? '—' : `${decimal(minGap / 1000, 1)} sn`}`,
    `son hız ${rpsText(obs.stats.rps)}`,
    `devre ${obs.stats.circuit ?? '—'}`,
  ].join(' · ')

  const perPath = new Map<string, number>()
  for (const r of list) perPath.set(r.path, (perPath.get(r.path) ?? 0) + 1)
  const paths = [...perPath.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([path, n]) => `${path} ×${n}`)

  const arrivals = list
    .filter((r) => r.status === 200 && obs.primaryPaths.includes(r.path))
    .map((r) => r.startedAt + r.durationMs)
    .sort((a, b) => a - b)
  let longest: number | null = null
  for (let i = 1; i < arrivals.length; i += 1) {
    const gap = (arrivals[i] as number) - (arrivals[i - 1] as number)
    if (longest === null || gap > longest) longest = gap
  }
  return [
    summary,
    `  ${paths.length > 0 ? paths.join(' · ') : '(istek yok)'}`,
    `  Birincil istasyonu (${obs.primaryIcao}) kapsayan iki yanıt arası en uzun süre: ${
      longest === null ? '—' : `${decimal(longest / 1000, 1)} sn`
    }`,
  ]
}

/** Üç ölçüt ve raporun bütün satırları; GEÇTİ yalnızca üçü de geçer ve çalışma tamamlanırsa. */
export function evaluateSmoke(obs: SmokeObservations): SmokeReport {
  const { bbox, health } = obs
  const bboxCheck: SmokeCheck = {
    id: 'bbox',
    pass: bbox.total >= SMOKE_MIN_AIRCRAFT,
    detail:
      `Türkiye bbox'ında ${bboxLabel()} görülen uçak: ${bbox.total} (en az ${SMOKE_MIN_AIRCRAFT})` +
      ` · askerî hariç ${bbox.visible} · ICAO dışı ${bbox.nonIcao}` +
      (bbox.malformed > 0 ? ` · bozuk kayıt ${bbox.malformed}` : ''),
  }

  const p95 = health?.freshnessP95S ?? null
  const freshnessCheck: SmokeCheck = {
    id: 'freshness',
    pass:
      p95 !== null &&
      Number.isFinite(p95) &&
      p95 <= SMOKE_FRESHNESS_LIMIT_S + SMOKE_FRESHNESS_EPSILON_S,
    detail: `${obs.primaryIcao} veri yaşı p95: ${
      p95 === null ? 'veri yok' : `${decimal(p95, 1)} sn`
    } (en çok ${SMOKE_FRESHNESS_LIMIT_S})`,
  }

  let healthCheck: SmokeCheck
  if (health === null) {
    healthCheck = { id: 'health', pass: false, detail: 'provider_health: adsbLol satırı yok' }
  } else {
    const updatedMs = health.updatedAt.getTime()
    const fresh = Number.isFinite(updatedMs) && updatedMs >= obs.dbStartMs
    healthCheck = {
      id: 'health',
      pass: fresh && health.lastSuccessAt !== null && health.circuit !== 'config',
      detail: [
        'provider_health: adsbLol',
        `durum ${health.status}`,
        `güncelleme ${utcClock(updatedMs)}${fresh ? '' : ' (çalıştırmadan eski)'}`,
        `son başarı ${health.lastSuccessAt === null ? 'yok' : utcClock(health.lastSuccessAt.getTime())}`,
        `devre ${health.circuit}`,
      ].join(' · '),
    }
  }

  const checks = [bboxCheck, freshnessCheck, healthCheck]
  const completed = obs.stopReason === 'completed'
  const pass = completed && checks.every((c) => c.pass)
  const header = [
    `smoke:live · ${obs.appName} ${obs.version}`,
    `${utcDateTime(obs.startedAt)} → ${utcClock(obs.endedAt)}`,
    `hazırlık ${durationText(obs.ingestStartedAt - obs.startedAt)}`,
    `ingest ${durationText(obs.ingestStoppedAt - obs.ingestStartedAt)}`,
    `kapanış ${durationText(obs.endedAt - obs.ingestStoppedAt)}`,
  ].join(' · ')
  const lines = [header, ...requestLines(obs)]
  if (obs.stopReason !== 'completed') {
    lines.push(`Çalışma tamamlanmadı: ${STOP_TEXT[obs.stopReason]}`)
  }
  for (const check of checks) lines.push(`[${check.pass ? 'GEÇTİ' : 'KALDI'}] ${check.detail}`)
  lines.push(`SONUÇ: ${pass ? 'GEÇTİ' : 'KALDI'}`)
  return { pass, checks, lines }
}

export function formatSmokeReport(report: SmokeReport): string {
  return report.lines.join('\n')
}

// ---------------------------------------------------------------------------------------------
// Plan (--confirm yok)

export interface SmokeConfig {
  /** Repo kökü (migration'lar ve fixture'lar buradan okunur). */
  root: string
  confirm: boolean
  /** `devEnvSource` sonucu. */
  source: Record<string, string | undefined>
  /** Gerçek kabuk ortamı (CI, EXTERNAL_PROVIDERS_DISABLED, ajan oturumu). */
  shellEnv: NodeJS.ProcessEnv
  version: string
  targets: SmokeTargets
  durationMs: number
  /** Yalnızca test: 127.0.0.1'deki sahte adsb.lol; verilmezse canlı adsb.lol. */
  baseUrl?: string
  /** Yalnızca test: ingest döngülerinin aralıkları. */
  timers?: IngestDeps['timers']
  progressEveryMs?: number
  /** Redis ve PostgreSQL'in ilk yanıtı için beklenen süre (varsayılan 3 sn). */
  connectTimeoutMs?: number
  /** Yalnızca test: kilit yenileme ve başka ingest denetimi aralığı (varsayılan 30 sn). */
  lockCheckEveryMs?: number
}

export interface SmokeDeps {
  fetch: typeof fetch
  clock: SmokeClock
  random?: () => number
  log: (line: string) => void
  signal?: AbortSignal
  /**
   * Kilit ve başka ingest denetiminin istemcisi (env'in redis-live indeksi). CLI
   * `(url) => createRedis(url, …)` verir; birim testleri bellek içi sahte.
   */
  redisFactory: LiveRedisFactory
}

export interface SmokeResult {
  exitCode: SmokeExitCode
  report: SmokeReport | null
  observations: SmokeObservations | null
}

/** Planlanan istek sayısı: ilk istek hemen, sonra her `1000 / rps` ms (AIMD 5 dk'da artmaz). */
export function estimateSmokeRequests(durationMs: number, rps: number): number {
  return Math.max(1, Math.ceil((durationMs / 1000) * rps - 1e-9))
}

const CIRCLE_LABEL: Record<PlannedCircle['kind'], string> = {
  west: 'batı',
  station: 'istasyon',
  primary: 'birincil',
  east: 'doğu',
}

/**
 * Tohum istasyonları ve OurAirports fixture'ıyla kapsama planı (çalıştırmada aynı plan veritabanından
 * kurulur). Fixture okunamazsa null.
 */
export function seedCoveragePlan(fixturesDir: string): PlannedCircle[] | null {
  const radius: unknown = stationsTable.fetchRadiusNm.default
  if (typeof radius !== 'number') return null
  try {
    return coveragePlan(
      SEED_STATIONS.map((station) => {
        const point = findStationPoint(station.icao, fixturesDir)
        return {
          icao: station.icao,
          lat: point.lat,
          lon: point.lon,
          fetchRadiusNm: radius,
          isPrimary: station.isPrimary,
        }
      }),
    )
  } catch {
    return null
  }
}

function circleLabel(circle: PlannedCircle): string {
  if (circle.kind === 'primary') return `birincil ${circle.primaryIcao ?? ''}`.trim()
  if (circle.kind === 'station') return `istasyon ${circle.covers.join('+')}`
  return CIRCLE_LABEL[circle.kind]
}

/** `--confirm` olmadan yazılan plan: değer yazmaz, IO yapmaz (yalnızca fixture okunur). */
export function smokePlanLines(config: SmokeConfig): string[] {
  const { source, targets } = config
  const refusals: Refusal[] = checkLiveGates({
    confirm: true,
    shellEnv: config.shellEnv,
    source,
    requiredUrls: ['DATABASE_URL', 'REDIS_LIVE_URL'],
    baseUrl: config.baseUrl,
  })
  try {
    assertSmokeTargets(source, targets)
  } catch {
    refusals.push({ code: 'targets' })
  }
  let env: Env | null = null
  try {
    env = parseEnv(smokeEnvSource(source, targets))
  } catch {
    refusals.push({ code: 'env_invalid' })
  }
  const rps = env?.ADSBLOL_RPS ?? ADSBLOL_RATE.startRps
  const minutes = config.durationMs / 60_000
  const duration = Number.isInteger(minutes) ? `${minutes} dk` : durationText(config.durationMs)
  const live = isLiveBaseUrl(config.baseUrl)
  const plan = seedCoveragePlan(join(config.root, 'tools', 'fixtures'))
  const circles =
    plan === null
      ? ['batı, birincil istasyon (40 NM) ve doğu çemberleri']
      : plan.map((c) => `${pointPath(c.center.lat, c.center.lon, c.radiusNm)} (${circleLabel(c)})`)

  const lines = [
    `smoke:live planı · ${env?.APP_NAME ?? DEFAULT_APP_NAME} ${config.version} (canlı istek atılmadı)`,
    `  Ne çalışır: worker'ın ingest'i (startIngest) bu süreçte ${duration}; ≈${estimateSmokeRequests(
      config.durationMs,
      rps,
    )} istek (başlangıç ${rpsText(rps)}, AIMD, üst sınır ${decimal(ADSBLOL_RATE.ceilingRps, 1)})`,
    `  Sorgular: yalnızca GET /v2/point (${live ? ADSBLOL_BASE_URL : 'test sunucusu'}); tohum istasyonlarıyla kapsama planı:`,
    `    ${circles.join(' · ')}`,
    `  Veritabanı: ${targets.databaseName} her çalıştırmada yeniden kurulur (migration'lar, tohum istasyonları, OurAirports ve VRS fixture'ı; ağa çıkılmaz) ve sonra inceleme için kalır`,
    `  redis-live ${targets.liveDbIndex}: smoke'un anlık durumu, başta ve sonda temizlenir; kilit (hy:tools:live) ve başka ingest denetimi env'in kendi redis-live indeksinde`,
    `  Ölçütler: Türkiye bbox'ında ${bboxLabel()} ≥ ${SMOKE_MIN_AIRCRAFT} uçak · birincil istasyon veri yaşı p95 ≤ ${SMOKE_FRESHNESS_LIMIT_S} sn · provider_health'te adsbLol satırı`,
    `  CONTACT_EMAIL: ${present(source.CONTACT_EMAIL) === null ? 'yok' : 'var'} (değer yazılmaz)`,
  ]
  if (refusals.length === 0) {
    lines.push('  Kapılar: --confirm ile geçer')
  } else {
    lines.push('  Kapılar: --confirm ile şunlar engeller:')
    for (const r of refusals) lines.push(`    ✗ ${refusalText(r)}`)
  }
  lines.push(
    "  Önce: ACTIVATION 1. adım (info@adsb.lol e-postası) yapılmış olmalı · pnpm dev:infra açık · adsb.lol'den çeken başka ingest yok (pnpm dev kapalı ya da EXTERNAL_PROVIDERS_DISABLED=true)",
    refusalText({ code: 'confirm_missing' }),
  )
  return lines
}

// ---------------------------------------------------------------------------------------------
// Çalıştırma

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown }

/** İşi en fazla `ms` bekler (gerçek zamanlayıcı); hata ya da süre aşımında `ok: false`. */
function settle<T>(run: () => Promise<T>, ms: number): Promise<Settled<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: new Error('timeout') }), ms)
    timer.unref?.()
    Promise.resolve()
      .then(run)
      .then(
        (value) => {
          clearTimeout(timer)
          resolve({ ok: true, value })
        },
        (error: unknown) => {
          clearTimeout(timer)
          resolve({ ok: false, error })
        },
      )
  })
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Ingest'in istemcisi: hata dinleyicisi hemen bağlanır, PING beklenir, olmazsa kesilir. */
async function connectSmokeRedis(url: string, timeoutMs: number): Promise<SmokeRedis | null> {
  const holder: { client: SmokeRedis | null } = { client: null }
  const connected = await connectLiveRedis(
    (u) => {
      const client = createRedis(u, { name: 'tools-smoke-live' })
      holder.client = client
      return client
    },
    url,
    timeoutMs,
  )
  return connected === null ? null : holder.client
}

async function readUpdates(redis: SmokeRedis): Promise<[string, string[]][]> {
  const out: [string, string[]][] = []
  let start = '-'
  for (;;) {
    const batch = await redis.xrange(LIVE_KEYS.updates, start, '+', 'COUNT', XRANGE_BATCH)
    out.push(...batch)
    const last = batch[batch.length - 1]
    if (batch.length < XRANGE_BATCH || last === undefined) return out
    start = `(${last[0]}`
  }
}

const LOCK_REFUSAL: Record<Exclude<LiveLockCheck, 'held'>, Refusal> = {
  lost: { code: 'lock_lost' },
  other_ingest: { code: 'other_ingest' },
}

const EXIT_BY_STOP: Record<Exclude<SmokeStopReason, 'completed'>, SmokeExitCode> = {
  interrupted: 130,
  config: 3,
  guard: 4,
  lock: 2,
}

/**
 * Smoke'u çalıştırır. Sıra: plan (`--confirm` yoksa çıkış 2) → kapılar → hedefler → worker env →
 * taban adres → kilit (env'in redis-live'ı; başka ingest varsa ya da kilit doluysa çıkış 2) →
 * veritabanı yeniden kurulur → redis-live hedef indeksi temizlenir → önceki canlı çalışmanın son
 * isteğinden `1000 / ADSBLOL_RPS` beklenir → ingest `durationMs` çalışır → kapanış (son
 * `provider_health` yazımı) → ölçüm ve rapor. Kilit, bağlantılar ve redis-live indeksi her durumda
 * kapatılır; veritabanı inceleme için kalır.
 */
export async function runSmoke(config: SmokeConfig, deps: SmokeDeps): Promise<SmokeResult> {
  const redact = smokeRedactor(config.source)
  const say = (line: string) => deps.log(redact(line))
  const refuse = (refusals: readonly Refusal[], exitCode: SmokeExitCode = 2): SmokeResult => {
    for (const r of refusals) say(`✗ ${refusalText(r)}`)
    return { exitCode, report: null, observations: null }
  }
  const fail = (text: string, exitCode: SmokeExitCode): SmokeResult => {
    say(`✗ ${text}`)
    return { exitCode, report: null, observations: null }
  }

  if (!config.confirm) {
    for (const line of smokePlanLines(config)) say(line)
    return { exitCode: 2, report: null, observations: null }
  }

  const gates = checkLiveGates({
    confirm: true,
    shellEnv: config.shellEnv,
    source: config.source,
    requiredUrls: ['DATABASE_URL', 'REDIS_LIVE_URL'],
    baseUrl: config.baseUrl,
  })
  if (gates.length > 0) return refuse(gates)
  try {
    assertSmokeTargets(config.source, config.targets)
  } catch {
    return refuse([{ code: 'targets' }])
  }
  let env: Env
  try {
    env = parseEnv(smokeEnvSource(config.source, config.targets))
  } catch (error) {
    return fail(error instanceof EnvError ? error.message : refusalText({ code: 'env_invalid' }), 2)
  }
  const baseUrl = config.baseUrl ?? ADSBLOL_BASE_URL
  try {
    assertAllowedBaseUrl(baseUrl)
  } catch (error) {
    return fail(errorMessage(error), 4)
  }
  if (deps.signal?.aborted) return fail(INTERRUPTED_BEFORE_INGEST, 130)

  const { clock } = deps
  const timeoutMs = config.connectTimeoutMs ?? SMOKE_CONNECT_TIMEOUT_MS
  const sourceDbUrl = config.source.DATABASE_URL?.trim() ?? ''
  const sourceLiveUrl = config.source.REDIS_LIVE_URL?.trim() ?? ''
  const smokeDbUrl = env.DATABASE_URL ?? ''
  const smokeLiveUrl = env.REDIS_LIVE_URL ?? ''
  const adminUrl = withPath(sourceDbUrl, '/postgres')
  if (!smokeDbUrl || !smokeLiveUrl || adminUrl === null) {
    return refuse([{ code: 'env_invalid' }])
  }

  const guardRedis = await connectLiveRedis(deps.redisFactory, sourceLiveUrl, timeoutMs)
  if (guardRedis === null) {
    return fail('redis-live yanıt vermedi; pnpm dev:infra çalışıyor mu (Docker Desktop)?', 2)
  }

  const token = randomUUID()
  let lockHeld = false
  let admin: Database | null = null
  let database: Database | null = null
  let smokeRedis: SmokeRedis | null = null
  let guard: LiveFetch | null = null
  let handle: IngestHandle | null = null
  let handleClosed = false

  const lockCheck = async (redis: LiveRedis): Promise<LiveLockCheck> => {
    const checked = await settle(() => checkLiveLock(redis, token), timeoutMs)
    return checked.ok ? checked.value : 'lost'
  }

  try {
    if (await otherIngestActive(guardRedis)) return refuse([{ code: 'other_ingest' }])
    if (!(await acquireLiveLock(guardRedis, token))) return refuse([{ code: 'lock_held' }])
    lockHeld = true
    const startedAt = clock.now()

    // 1. Veritabanı: yönetim bağlantısı, smoke veritabanı yeniden kurulur.
    const adminDb = createDb(adminUrl, { max: 1, applicationName: 'havayolu-smoke-live' })
    admin = adminDb
    const ping = await settle(() => adminDb.sql`select 1`, timeoutMs)
    if (!ping.ok) {
      return fail('PostgreSQL yanıt vermedi; pnpm dev:infra çalışıyor mu (Docker Desktop)?', 2)
    }
    const name = config.targets.databaseName
    say(
      `Hazırlık: ${name} yeniden kuruluyor (migration'lar, tohum istasyonları, fixture içe aktarımı)`,
    )
    // Ad SMOKE_DB_PATTERN ile doğrulandı (yalnızca küçük harf, rakam, alt çizgi).
    await adminDb.sql.unsafe(`drop database if exists ${name} with (force)`)
    await adminDb.sql.unsafe(`create database ${name}`)
    await runMigrations({
      databaseUrl: smokeDbUrl,
      migrationsFolder: join(config.root, 'packages', 'db', 'drizzle'),
    })
    const smokeDb = createDb(smokeDbUrl, { max: 4, applicationName: 'havayolu-smoke-live' })
    database = smokeDb
    const log = createToolLogger({ level: env.LOG_LEVEL, write: deps.log, redact })
    await seedStations(smokeDb.db)
    const imported = await runReferenceImport({
      db: smokeDb.db,
      fetcher: fixtureFetcher(join(config.root, 'tools', 'fixtures')),
      origin: 'fixture',
      log,
    })
    if (imported.ourairports.status === 'failed') {
      return fail("OurAirports fixture'ı içe aktarılamadı (tools/fixtures/ourairports)", 2)
    }
    const stationList = await activeStationsWithArp(smokeDb.sql)
    const primary = stationList.find((s) => s.isPrimary)
    if (primary === undefined) {
      return fail("Birincil istasyon yok (tohum istasyonları ya da OurAirports fixture'ı eksik)", 2)
    }
    const primaryPaths = coveragePlan(stationList)
      .filter((c) => c.covers.includes(primary.icao) || c.primaryIcao === primary.icao)
      .map((c) => pointPath(c.center.lat, c.center.lon, c.radiusNm))

    // 2. Ingest'in redis-live indeksi.
    smokeRedis = await connectSmokeRedis(smokeLiveUrl, timeoutMs)
    if (smokeRedis === null) {
      return fail('redis-live yanıt vermedi; pnpm dev:infra çalışıyor mu (Docker Desktop)?', 2)
    }
    await smokeRedis.flushdb()
    const [clockRow] = await smokeDb.sql<{ ms: number }[]>`
      select (extract(epoch from now()) * 1000)::float8 as ms`
    const dbStartMs = clockRow?.ms ?? clock.now()
    say(
      `✓ Hazır: ${stationList.length} istasyon (birincil ${primary.icao}), redis-live ${config.targets.liveDbIndex} temiz`,
    )

    // 3. Kilit hâlâ bizde mi; önceki canlı çalışmanın son isteğinden bu yana yeterli süre geçti mi.
    const check = await lockCheck(guardRedis)
    if (check !== 'held') return refuse([LOCK_REFUSAL[check]])
    const lastAt = await lastLiveRequestAt(guardRedis)
    const notBefore = liveStartNotBefore(lastAt, env.ADSBLOL_RPS, clock.now())
    if (notBefore > clock.now()) {
      say(
        `Önceki canlı çalışmanın son isteğinden sonra ${decimal((notBefore - clock.now()) / 1000, 1)} sn bekleniyor`,
      )
      while (clock.now() < notBefore && !deps.signal?.aborted) {
        await clock.sleep(Math.min(SMOKE_POLL_MS, notBefore - clock.now()))
      }
    }
    if (deps.signal?.aborted) return fail(INTERRUPTED_BEFORE_INGEST, 130)

    // 4. Ingest.
    const liveGuard = createLiveFetch({ baseUrl, now: clock.now, fetch: deps.fetch })
    guard = liveGuard
    const ingest = await startIngest({
      env,
      redisLive: smokeRedis,
      database: smokeDb,
      log,
      version: config.version,
      now: clock.now,
      random: deps.random,
      fetch: liveGuard.fetch,
      adsbLolBaseUrl: config.baseUrl,
      timers: config.timers,
    })
    handle = ingest
    const ingestStartedAt = clock.now()
    say(`Ingest başladı: ${durationText(config.durationMs)} ölçülecek (durdurmak için Ctrl+C)`)

    const endAt = ingestStartedAt + config.durationMs
    const progressEvery = config.progressEveryMs ?? SMOKE_PROGRESS_MS
    const lockCheckEvery = config.lockCheckEveryMs ?? LIVE_LOCK_REFRESH_MS
    let stopReason: SmokeStopReason = 'completed'
    let lockRefusal: Refusal | null = null
    let lastLockCheck = clock.now()
    let lastProgress = ingestStartedAt
    for (;;) {
      const t = clock.now()
      if (t >= endAt) break
      if (deps.signal?.aborted) {
        stopReason = 'interrupted'
        break
      }
      const stats = ingest.stats()
      if (stats.circuit === 'config') {
        stopReason = 'config'
        break
      }
      if (liveGuard.violation() !== null) {
        stopReason = 'guard'
        break
      }
      if (t - lastLockCheck >= lockCheckEvery) {
        lastLockCheck = t
        const state = await lockCheck(guardRedis)
        if (state !== 'held') {
          stopReason = 'lock'
          lockRefusal = LOCK_REFUSAL[state]
          break
        }
      }
      if (t - lastProgress >= progressEvery) {
        lastProgress = t
        say(
          [
            `${utcClock(t)} ilerleme ${durationText(t - ingestStartedAt)}`,
            `istek ${stats.requests}`,
            `429/420 ${stats.rateLimited}`,
            `hız ${rpsText(stats.rps)}`,
            `devre ${stats.circuit ?? '—'}`,
            `bellekte ${stats.aircraft} uçak`,
          ].join(' · '),
        )
      }
      await clock.sleep(Math.min(SMOKE_POLL_MS, endAt - t))
    }
    const ingestStoppedAt = clock.now()
    if (stopReason === 'guard') say(`✗ ${liveGuard.violation() ?? STOP_TEXT.guard}`)
    if (lockRefusal !== null) say(`✗ ${refusalText(lockRefusal)}`)
    say('Ingest kapanıyor (son provider_health yazımı)')
    await ingest.close()
    handleClosed = true

    // 5. Ölçüm.
    const bbox = countBboxAircraft(await readUpdates(smokeRedis))
    const summaries = await readProviderSummaries(smokeDb.sql, new Date())
    const observations: SmokeObservations = {
      appName: env.APP_NAME,
      version: config.version,
      startedAt,
      ingestStartedAt,
      ingestStoppedAt,
      endedAt: clock.now(),
      stopReason,
      primaryIcao: primary.icao,
      requests: liveGuard.requests(),
      primaryPaths,
      bbox,
      health: summaries.find((p) => p.provider === 'adsbLol') ?? null,
      dbStartMs,
      stats: ingest.stats(),
    }
    const report = evaluateSmoke(observations)
    for (const line of report.lines) say(line)
    say(`${name} veritabanı inceleme için kaldı; sonraki çalıştırmada yeniden kurulur.`)
    const exitCode: SmokeExitCode =
      stopReason === 'completed' ? (report.pass ? 0 : 1) : EXIT_BY_STOP[stopReason]
    return { exitCode, report, observations }
  } catch (error) {
    return fail(`Beklenmeyen hata: ${errorMessage(error)}`, 4)
  } finally {
    if (handle !== null && !handleClosed) {
      const ingest = handle
      await settle(() => ingest.close(), 20_000)
    }
    if (smokeRedis !== null) {
      const redis = smokeRedis
      await settle(() => redis.flushdb(), CLEANUP_TIMEOUT_MS)
      await closeLiveRedis(redis)
    }
    if (database !== null) {
      const db = database
      await settle(() => db.sql.end({ timeout: 5 }), 10_000)
    }
    if (admin !== null) {
      const db = admin
      await settle(() => db.sql.end({ timeout: 5 }), 10_000)
    }
    if (lockHeld) {
      const records = guard?.requests() ?? []
      const lastStart = records.length > 0 ? (records[records.length - 1]?.startedAt ?? null) : null
      await settle(() => releaseLiveLock(guardRedis, token, lastStart), CLEANUP_TIMEOUT_MS)
    }
    await closeLiveRedis(guardRedis)
  }
}
