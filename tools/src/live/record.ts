import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative } from 'node:path'
import {
  ADSBLOL_BASE_URL,
  AdsbLolError,
  createAdsbLolClient,
  hasDbFlag,
  PROVIDER_LICENSES,
  type AdsbLolClient,
} from '@havayolu/providers'
import { EnvError, parseEnv, type Env } from '@havayolu/worker/env'
import { adsbLolConfigProblem } from '@havayolu/worker/ingest'
import { AdaptiveRateController, ADSBLOL_RATE } from '@havayolu/worker/ingest/rate'
import { loadRecording } from '../replay-receiver/recording'
import { isPathInside, LiveArgsError, type RecordArgs } from './args'
import { createRedactor, userAgentWebHost } from './env'
import { checkLiveGates, refusalText, type Refusal } from './gates'
import { assertAllowedBaseUrl, createLiveFetch, LiveGuardError, pointPath } from './guard'
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
import { findStationPoint, type StationPoint } from './station'

export { RECORD_LIMITS } from './args'

/**
 * `pnpm record` (M7a, D-094): bir istasyonun ARP'ı çevresindeki tek ve sabit nokta sorgusunu
 * (`GET /v2/point/<enlem>/<boylam>/<yarıçap>`) worker'ın AIMD kovasıyla (`AdaptiveRateController`)
 * ve adsb.lol istemcisiyle (`createAdsbLolClient`) duvar saatiyle 1–60 dk tekrarlar; her başarılı
 * yanıtın ham gövdesini JSON Lines dosyasına bir satır olarak yazar. Dosya
 * `pnpm dev:replay --recording <dosya>` ile döngüyle oynar.
 *
 * Güvenlik: kapılar (`checkLiveGates`), ek bekçi (`createLiveFetch`: yalnızca nokta sorgusu, en az
 * 5 sn arayla, yönlendirme yok), redis-live'da `hy:tools:live` kilidi ve başka ingest denetimi.
 * `--confirm` yoksa yalnızca plan yazılır: istek, Redis bağlantısı ya da dosya yoktur. Çıktının
 * tamamı maskelenir (CONTACT_EMAIL, ADSBLOL_API_KEY); konsola hex, tescil ya da çağrı kodu yazılmaz,
 * User-Agent bir kez ve e-postası maskeli yazılır. Araç hiçbir dosyayı silmez ya da ezmez.
 */

export interface Clock {
  now(): number
  sleep(ms: number): Promise<void>
}

export interface RecordConfig {
  root: string
  args: Extract<RecordArgs, { kind: 'run' }>
  /** `devEnvSource` sonucu: süreç > .env > .env.example. */
  source: Record<string, string | undefined>
  /** Gerçek kabuk ortamı (CI, EXTERNAL_PROVIDERS_DISABLED, ajan oturumu). */
  shellEnv: NodeJS.ProcessEnv
  /** User-Agent ve künyedeki sürüm (kök package.json). */
  version: string
  /** Yalnızca test: `http://127.0.0.1:<port>` sahte sunucusu; verilmezse canlı adsb.lol. */
  baseUrl?: string
  /** OurAirports fixture'ının bulunduğu klasör; varsayılan `<root>/tools/fixtures`. */
  referenceDir?: string
}

export interface RecordDeps {
  fetch: typeof fetch
  clock: Clock
  random: () => number
  log: (line: string) => void
  /** CLI `(url) => createRedis(url, { name: 'tools-live' })` verir; testler bellek içi sahte. */
  redisFactory: LiveRedisFactory
  signal?: AbortSignal
  /** Redis PING ve kilit komutlarının zaman aşımı (gerçek zaman, ms); varsayılan 2000. */
  redisTimeoutMs?: number
}

export type RecordStopReason =
  'completed' | 'interrupted' | 'config' | 'request' | 'guard' | 'lock_lost' | 'other_ingest' | 'io'

export type RecordExitCode = 0 | 1 | 2 | 3 | 4 | 130

export interface RecordResult {
  exitCode: RecordExitCode
  stopReason: RecordStopReason | null
  frames: number
  /** Bekçiden geçip gönderilen istek sayısı. */
  requests: number
  rateLimited: number
  /** 429/420 dışındaki başarısız istekler. */
  errors: number
  outPath: string | null
  metaPath: string | null
  /** Kayıt dosyasına yazılan bayt. */
  bytes: number
  minGapMs: number | null
  finalRps: number | null
  /** Kayıt penceresinin başlangıcı (ilk isteğe izin verilen an, ms); başlamadıysa null. */
  startedAt: number | null
}

/** Redis PING ve kilit komutlarının varsayılan zaman aşımı. */
export const RECORD_REDIS_TIMEOUT_MS = 2_000
/** Son ad değişikliği (`.partial` → `.jsonl`) Windows'ta kilitliyse yeniden deneme. */
const RENAME_ATTEMPTS = 10
const RENAME_RETRY_MS = 100
const RENAME_RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])
const PROGRESS_EVERY_MS = 60_000
const MAX_SLEEP_MS = 1_000

/** Kayıt adı: `<ICAO>-<YYYYMMDDTHHmm>Z` (UTC), ör. `LTFM-20261004T1200Z` (Parça 2: `LTFM-*.jsonl`). */
export function recordingBaseName(icao: string, startedAtMs: number): string {
  const iso = new Date(startedAtMs).toISOString()
  const date = `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}`
  return `${icao}-${date}T${iso.slice(11, 13)}${iso.slice(14, 16)}Z`
}

export interface RecordOutput {
  final: string
  partial: string
  meta: string
}

/**
 * Çıktı yolları: varsayılan `tools/recordings/tmp/` (gitignore'da), `--fixture` ile
 * `tools/fixtures/replay/`, `--out` ile verilen yol. Kayıt bitene kadar `<ad>.jsonl.partial`
 * adını taşır; künye `<ad>.meta.json`'dır.
 */
export function recordOutputPaths(
  root: string,
  args: Pick<Extract<RecordArgs, { kind: 'run' }>, 'out' | 'fixture'>,
  baseName: string,
): RecordOutput {
  const final =
    args.out ??
    (args.fixture
      ? join(root, 'tools', 'fixtures', 'replay', `${baseName}.jsonl`)
      : join(root, 'tools', 'recordings', 'tmp', `${baseName}.jsonl`))
  const stem = final.slice(0, -'.jsonl'.length)
  return { final, partial: `${final}.partial`, meta: `${stem}.meta.json` }
}

export interface RequestEstimate {
  requests: number
  startRps: number
  /** AIMD'nin pencere sonunda ulaştığı hız (yanıtların hepsi başarılıysa). */
  maxRps: number
  /** Her isteğin `startAt`'e göre değil, mutlak başlangıcı (ms). */
  startTimes: number[]
}

/**
 * İstek bütçesi: `AdaptiveRateController` sahte saatle, bütün yanıtlar başarılı sayılarak
 * `minutes` boyunca adımlanır (ağ yok). Kayıt döngüsüyle aynı aritmetiktir: aynı `startAt` ile
 * istek anları birebir aynıdır. 30 dk, 0,1 istek/sn → ≈199 istek, hız en çok 0,121.
 */
export function estimateRecordRequests(
  minutes: number,
  startRps: number,
  startAt = 0,
): RequestEstimate {
  let now = startAt
  const rate = new AdaptiveRateController({ startRps, now: () => now, random: () => 0 })
  const deadline = startAt + minutes * 60_000
  const startTimes: number[] = []
  for (;;) {
    const at = rate.nextAllowedAt()
    if (!(at < deadline)) break
    now = at
    if (!rate.tryAcquire()) break
    startTimes.push(now)
    rate.record('success')
  }
  return { requests: startTimes.length, startRps, maxRps: rate.rps(), startTimes }
}

// ---------------------------------------------------------------------------------------------
// Gizlilik süzgeci (--fixture)

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** providers `withPrivacy` ile aynı: büyük harf, yalnızca harf ve rakam (TC-OIL → TCOIL). */
const identity = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')

const trimmedOrNull = (value: unknown): string | null =>
  typeof value === 'string' ? value.trim() || null : null

/**
 * Commit'lenecek kaydın süzgeci: genel API'nin göstereceğinden fazlası kalmaz.
 * - `dbFlags` biti 1 (askerî) olan ya da `dbFlags`'ı var ama negatif olmayan tam sayı olmayan
 *   kayıtlar atılır (kapalı varsayım; nesne olmayan kayıtlar da atılır).
 * - 4/8 (PIA/LADD) kayıtlarından `r` ve `ownOp` silinir; çağrı kodu tescille aynıysa (`withPrivacy`
 *   kuralı) `flight` da silinir, havayolu çağrı kodu kalır.
 * - Diğer kayıtlar ve zarf alanları olduğu gibi kalır; `total` yeni `ac` uzunluğu olur.
 * Admin engel listesi uygulanmaz (araç veritabanı okumaz); oynatmada API uygular.
 */
export function sanitizeFrameForFixture(body: unknown): unknown {
  if (!isObject(body) || !Array.isArray(body.ac)) return body
  const ac: Record<string, unknown>[] = []
  for (const item of body.ac as unknown[]) {
    if (!isObject(item)) continue
    // adsb.lol'de alanın yokluğu 0 demektir (data-sources.md §1).
    const flags = item.dbFlags === undefined ? 0 : item.dbFlags
    if (typeof flags !== 'number' || !Number.isInteger(flags) || flags < 0) continue
    if (hasDbFlag(flags, 'military')) continue
    if (!hasDbFlag(flags, 'pia') && !hasDbFlag(flags, 'ladd')) {
      ac.push(item)
      continue
    }
    const { r, ownOp: _ownOp, ...rest } = item
    const callsign = trimmedOrNull(rest.flight)
    const registration = trimmedOrNull(r)
    if (
      callsign !== null &&
      registration !== null &&
      identity(callsign) === identity(registration)
    ) {
      delete rest.flight
    }
    ac.push(rest)
  }
  return { ...body, ac, total: ac.length }
}

// ---------------------------------------------------------------------------------------------
// Biçim yardımcıları

/** `0,100` (ondalık virgül, 3 basamak). */
function formatRps(rps: number): string {
  return rps.toFixed(3).replace('.', ',')
}

function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(1).replace('.', ',')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

function clockText(ms: number): string {
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? '--:--:--Z' : `${date.toISOString().slice(11, 19)}Z`
}

/** Kök altındaysa `/` ayraçlı göreli yol (pnpm kökte çalışır), değilse mutlak yol. */
function displayPath(root: string, path: string): string {
  const rel = relative(root, path)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return path
  return rel.split('\\').join('/')
}

function baseNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

// ---------------------------------------------------------------------------------------------
// Plan (--confirm yok)

export interface RecordPlanInput {
  root: string
  station: StationPoint
  radiusNm: number
  minutes: number
  output: RecordOutput
  fixture: boolean
  estimate: RequestEstimate
  /** CONTACT_EMAIL tanımlı mı (değer yazılmaz). */
  contactEmail: boolean
  /** `--confirm` ile de reddedecek kapılar. */
  blockers: readonly Refusal[]
  /** Zaten var olan çıktı dosyaları. */
  conflicts: readonly string[]
}

/** Kuru çalıştırma planı (Türkçe, satır satır); değer (e-posta, adres, anahtar) içermez. */
export function recordPlanText(plan: RecordPlanInput): string {
  const { station, estimate, output } = plan
  const path = pointPath(station.lat, station.lon, plan.radiusNm)
  const lines = [
    'pnpm record · plan',
    `  İstasyon: ${station.icao} · ARP ${station.lat.toFixed(4)}, ${station.lon.toFixed(4)} (OurAirports fixture'ı) · yarıçap ${plan.radiusNm} NM`,
    `  İstek: GET ${path} (yalnızca bu yol; yönlendirme izlenmez, iki istek arası en az 5 sn)`,
    `  Süre: ${plan.minutes} dk · ≈${estimate.requests} istek (başlangıç ${formatRps(estimate.startRps)} istek/sn, AIMD ile en çok ${formatRps(estimate.maxRps)}; üst sınır ${formatRps(ADSBLOL_RATE.ceilingRps)})`,
    `  Çıktı: ${displayPath(plan.root, output.final)} + ${baseNameOf(output.meta)} (${
      plan.fixture
        ? "commit'lenecek kayıt; gizlilik süzgeci: askerî atılır, PIA/LADD tescili gizlenir"
        : "ham kayıt; commit'lenmez"
    })`,
    `  CONTACT_EMAIL: ${plan.contactEmail ? 'var' : 'yok'}`,
  ]
  for (const conflict of plan.conflicts) {
    lines.push(`  Çıktı dosyası zaten var: ${displayPath(plan.root, conflict)} (araç dosya ezmez)`)
  }
  if (plan.blockers.length === 0) {
    lines.push('  Kapılar: --confirm ile çalışmaya hazır')
  } else {
    lines.push('  Kapılar: --confirm ile de reddedilir:')
    for (const blocker of plan.blockers) lines.push(`    - ${refusalText(blocker)}`)
  }
  lines.push(
    "  Önce ACTIVATION 1. adım: adsb.lol'e (info@adsb.lol) bilgilendirme e-postası gönderilmiş olmalı",
    refusalText({ code: 'confirm_missing' }),
  )
  return lines.join('\n')
}

// ---------------------------------------------------------------------------------------------
// Çalıştırma

/** Araç kendi yapılandırmasına dış servisleri açar; yerel alıcı ve takip listesi kullanılmaz. */
function toolEnvSource(source: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return {
    ...source,
    EXTERNAL_PROVIDERS_DISABLED: 'false',
    LOCAL_RECEIVER_URLS: '',
    WATCH_HEX_LIST: '',
  }
}

/** Gerçek zamanlı üst sınır: yanıt vermeyen Redis komutu kayıt döngüsünü bekletmez. */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('redis command timed out')), ms)
    timer.unref?.()
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : error instanceof Error
      ? error.name
      : 'unknown'
}

const KIND_TEXT: Record<AdsbLolError['kind'], string> = {
  config: 'yapılandırma',
  rate_limit: 'kısıtlama',
  server: 'sunucu hatası',
  network: 'ağ hatası',
  response: 'yanıt hatası',
  request: 'istek hatası',
}

const STOP_TEXT: Record<RecordStopReason, string> = {
  completed: 'süre doldu',
  interrupted: 'Ctrl+C ile durduruldu',
  config: 'adsb.lol 401/403',
  request: 'beklenmeyen yanıt',
  guard: 'bekçi ihlali',
  lock_lost: 'kilit kaybedildi',
  other_ingest: 'başka bir ingest başladı',
  io: 'dosya hatası',
}

/** Bitiş adımları; hata iletisi hangi adımda kalındığını söyler. */
type FinalizeStage = 'target_exists' | 'rename' | 'meta' | 'self_check'

const FINALIZE_TEXT: Record<FinalizeStage, string> = {
  target_exists: 'son dosya kayıt sırasında oluştu (araç dosya ezmez)',
  rename: '.partial dosyasının adı değiştirilemedi',
  meta: 'künye (.meta.json) yazılamadı',
  self_check: 'öz denetim başarısız, kayıt yeniden okunamadı',
}

function exitCodeFor(stop: RecordStopReason, frames: number): RecordExitCode {
  switch (stop) {
    case 'config':
      return 3
    case 'request':
    case 'guard':
    case 'io':
      return 4
    case 'lock_lost':
    case 'other_ingest':
      return 2
    case 'interrupted':
      return 130
    case 'completed':
      return frames > 0 ? 0 : 1
  }
}

function minGap(startTimes: readonly number[]): number | null {
  let min: number | null = null
  for (let i = 1; i < startTimes.length; i += 1) {
    const gap = startTimes[i]! - startTimes[i - 1]!
    if (min === null || gap < min) min = gap
  }
  return min
}

/** `.partial` → `.jsonl`; Windows'ta dosya kısa süre kilitliyse (virüs tarayıcı) yeniden dener. */
async function renameWithRetry(from: string, to: string, clock: Clock): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      renameSync(from, to)
      return
    } catch (error) {
      if (attempt >= RENAME_ATTEMPTS || !RENAME_RETRY_CODES.has(errorCode(error))) throw error
      await clock.sleep(RENAME_RETRY_MS)
    }
  }
}

/** Künye: düz nesne, yalnızca ilkel değerler (prettier'da kararlı). UA, e-posta ya da host yok. */
export interface RecordingMeta {
  source: string
  license: string
  licenseUrl: string
  attribution: string
  path: string
  station: string
  radiusNm: number
  startedAt: string
  endedAt: string
  frames: number
  requests: number
  rateLimited: number
  errors: number
  minGapSec: number | null
  finalRps: number
  stopReason: RecordStopReason
  sanitized: boolean
  tool: string
}

function emptyResult(exitCode: RecordExitCode): RecordResult {
  return {
    exitCode,
    stopReason: null,
    frames: 0,
    requests: 0,
    rateLimited: 0,
    errors: 0,
    outPath: null,
    metaPath: null,
    bytes: 0,
    minGapMs: null,
    finalRps: null,
    startedAt: null,
  }
}

/**
 * `--out` yolunun reddi: `tools/fixtures` altı (commit'lenecek kayıt yalnızca `--fixture` ile,
 * süzgeçten geçerek yazılır) ve repo içinde `tools/recordings/tmp` dışındaki her yer (ham kayıt
 * askerî ve PIA/LADD verisi taşır; gitignore'da olmayan bir yolda commit'lenebilir). Repo dışı yol
 * serbesttir. Windows'ta büyük/küçük harf duyarsız karşılaştırılır.
 */
export function outPathRefusal(root: string, out: string): Refusal | null {
  if (isPathInside(out, join(root, 'tools', 'fixtures'))) {
    return { code: 'out_in_fixtures', subject: '--out' }
  }
  if (isPathInside(out, root) && !isPathInside(out, join(root, 'tools', 'recordings', 'tmp'))) {
    return { code: 'out_in_repo', subject: '--out' }
  }
  return null
}

export async function runRecord(config: RecordConfig, deps: RecordDeps): Promise<RecordResult> {
  const { args, source, root } = config
  const { clock } = deps
  const redact = createRedactor([source.CONTACT_EMAIL, source.ADSBLOL_API_KEY])
  const say = (text: string) => {
    for (const line of text.split('\n')) deps.log(redact(line))
  }
  const aborted = () => deps.signal?.aborted === true
  const redisTimeoutMs = deps.redisTimeoutMs ?? RECORD_REDIS_TIMEOUT_MS

  // 1. İstasyon, çıktı yolları, kapılar ve ortam (IO yok; yalnızca fixture okunur).
  let station: StationPoint
  try {
    station = findStationPoint(args.station, config.referenceDir ?? join(root, 'tools', 'fixtures'))
  } catch (error) {
    if (!(error instanceof LiveArgsError)) throw error
    say(`✗ ${error.message}`)
    return emptyResult(2)
  }
  const output = recordOutputPaths(root, args, recordingBaseName(station.icao, clock.now()))
  const path = pointPath(station.lat, station.lon, args.radiusNm)
  // Kapılar `--confirm` varmış gibi değerlendirilir: plan, `--confirm` ile de reddedecek her kapıyı
  // (ajan oturumu dahil) listeler; `--confirm` yokluğu planın son satırında ayrıca yazılır.
  const refusals = checkLiveGates({
    confirm: true,
    shellEnv: config.shellEnv,
    source,
    requiredUrls: [],
    ...(config.baseUrl === undefined ? {} : { baseUrl: config.baseUrl }),
  })
  const outRefusal = args.out === null ? null : outPathRefusal(root, args.out)
  if (outRefusal !== null) refusals.push(outRefusal)
  let env: Env | null = null
  let envError: EnvError | null = null
  try {
    env = parseEnv(toolEnvSource(source))
  } catch (error) {
    if (!(error instanceof EnvError)) throw error
    envError = error
    if (!refusals.some((r) => r.code === 'env_invalid')) refusals.push({ code: 'env_invalid' })
  }
  const conflicts = [output.final, output.partial, output.meta].filter((p) => existsSync(p))

  if (!args.confirm) {
    say(
      recordPlanText({
        root,
        station,
        radiusNm: args.radiusNm,
        minutes: args.minutes,
        output,
        fixture: args.fixture,
        estimate: estimateRecordRequests(args.minutes, env?.ADSBLOL_RPS ?? ADSBLOL_RATE.startRps),
        // Kapıyla aynı okuma: boş değer ve `#…#` şablon talimatı "yok" sayılır.
        contactEmail: !refusals.some((r) => r.code === 'contact_email'),
        blockers: refusals,
        conflicts,
      }),
    )
    if (envError !== null) say(envError.message)
    return emptyResult(2)
  }

  // 2. Retler: istek atılmaz.
  if (refusals.length > 0 || env === null) {
    for (const refusal of refusals) say(`✗ ${refusalText(refusal)}`)
    if (envError !== null) say(envError.message)
    return emptyResult(2)
  }
  if (conflicts.length > 0) {
    for (const conflict of conflicts) {
      say(
        `✗ Çıktı dosyası zaten var: ${displayPath(root, conflict)} (araç dosya ezmez ya da silmez)`,
      )
    }
    return emptyResult(2)
  }
  if (args.out !== null && !existsSync(dirname(args.out))) {
    say(`✗ --out klasörü yok: ${displayPath(root, dirname(args.out))}`)
    return emptyResult(2)
  }

  // 3. Bekçi ve istemci (yapılandırma hatası istek atmadan yakalanır).
  const baseUrl = config.baseUrl ?? ADSBLOL_BASE_URL
  try {
    assertAllowedBaseUrl(baseUrl)
  } catch (error) {
    if (!(error instanceof LiveGuardError)) throw error
    say(`✗ ${error.message}`)
    return { ...emptyResult(4), stopReason: 'guard' }
  }
  const guard = createLiveFetch({ baseUrl, now: clock.now, fetch: deps.fetch, captureBodies: true })
  let client: AdsbLolClient
  try {
    client = createAdsbLolClient({
      appName: env.APP_NAME,
      version: config.version,
      webHost: userAgentWebHost(env.WEB_HOST),
      contactEmail: env.CONTACT_EMAIL ?? null,
      dataUsageMode: env.DATA_USAGE_MODE,
      apiKey: env.ADSBLOL_API_KEY ?? null,
      apiKeyHeader: env.ADSBLOL_API_KEY_HEADER ?? null,
      baseUrl,
      fetch: guard.fetch,
      now: clock.now,
    })
  } catch (error) {
    say(`✗ adsb.lol istemcisi kurulamadı: ${adsbLolConfigProblem(env, error).text}`)
    return emptyResult(2)
  }

  // 4. Eşzamanlılık: başka ingest ya da canlı araç varsa ret. Kilitsiz yol yalnızca Redis'e hiç
  // ulaşılamadığında (PING `redisTimeoutMs` içinde yanıt vermedi) geçerlidir: yerel ingest de
  // Redis'siz çalışamaz. PING'den sonra EXISTS, SET ya da GET yanıt vermez ya da hata verirse ret
  // (kapalı varsayım; çalışma sırasındaki 30 sn denetimi de böyledir).
  const token = randomUUID()
  const redis: LiveRedis | null = env.REDIS_LIVE_URL
    ? await connectLiveRedis(deps.redisFactory, env.REDIS_LIVE_URL, redisTimeoutMs)
    : null
  let locked = false
  let previousRequestAt: number | null = null
  if (redis === null) {
    say('Uyarı: Redis yok; başka canlı çalışma denetlenemedi (kilitsiz devam)')
  } else {
    let refusal: Refusal | null = null
    let lockAttempted = false
    try {
      if (await within(otherIngestActive(redis), redisTimeoutMs)) {
        refusal = { code: 'other_ingest' }
      } else {
        lockAttempted = true
        if (!(await within(acquireLiveLock(redis, token), redisTimeoutMs))) {
          refusal = { code: 'lock_held' }
        } else {
          locked = true
          previousRequestAt = await within(lastLiveRequestAt(redis), redisTimeoutMs)
        }
      }
    } catch {
      refusal = { code: 'redis_unanswered' }
    }
    if (refusal !== null) {
      // Yanıtsız SET sonradan uygulanmış olabilir: bırakma token'ı karşılaştırır, başkasının
      // kilidine dokunmaz.
      if (locked || (lockAttempted && refusal.code === 'redis_unanswered')) {
        await within(releaseLiveLock(redis, token), redisTimeoutMs).catch(() => undefined)
      }
      await closeLiveRedis(redis)
      say(`✗ ${refusalText(refusal)}`)
      return emptyResult(2)
    }
  }

  const result = emptyResult(1)
  let stop: RecordStopReason = 'completed'
  let lastRequestStart: number | null = null
  let finalizeFailed = false
  try {
    // 5. Önceki canlı çalışmanın son isteğinden en az 1000 / ADSBLOL_RPS sonra başlanır.
    const notBefore = liveStartNotBefore(previousRequestAt, env.ADSBLOL_RPS, clock.now())
    if (notBefore > clock.now()) {
      say(
        `Önceki canlı çalışmanın son isteğinden sonra ${formatSeconds(notBefore - clock.now())} sn bekleniyor`,
      )
    }
    while (clock.now() < notBefore && !aborted()) {
      await clock.sleep(Math.min(notBefore - clock.now(), MAX_SLEEP_MS))
    }

    const startedAt = clock.now()
    const deadline = startedAt + args.minutes * 60_000
    result.startedAt = startedAt
    const rate = new AdaptiveRateController({
      startRps: env.ADSBLOL_RPS,
      now: clock.now,
      random: deps.random,
    })
    say(
      `pnpm record · ${station.icao} · ${path} · ${args.minutes} dk · çıktı ${displayPath(root, output.final)}${
        args.fixture ? ' (gizlilik süzgeciyle)' : ''
      }`,
    )
    say(`User-Agent: ${client.userAgent}`)

    let attempt = 0
    let nextLockCheckAt = startedAt + LIVE_LOCK_REFRESH_MS
    let nextProgressAt = startedAt + PROGRESS_EVERY_MS

    // 6. Döngü: kova izin verdikçe tek istek; süre dolunca yeni istek başlamaz.
    for (;;) {
      if (aborted()) {
        stop = 'interrupted'
        break
      }
      const now = clock.now()
      if (now >= deadline) break
      if (redis !== null && locked && now >= nextLockCheckAt) {
        nextLockCheckAt = now + LIVE_LOCK_REFRESH_MS
        let check: LiveLockCheck
        try {
          check = await within(checkLiveLock(redis, token), redisTimeoutMs)
        } catch {
          check = 'lost'
        }
        if (check !== 'held') {
          stop = check === 'lost' ? 'lock_lost' : 'other_ingest'
          say(`✗ ${refusalText({ code: stop })}`)
          break
        }
      }
      if (rate.state().circuit === 'config') {
        stop = 'config'
        break
      }
      const at = rate.nextAllowedAt()
      if (at >= deadline) break
      if (at > now) {
        await clock.sleep(Math.min(at - now, MAX_SLEEP_MS))
        continue
      }
      if (!rate.tryAcquire()) {
        await clock.sleep(50)
        continue
      }
      attempt += 1
      lastRequestStart = now
      try {
        await client.point(station.lat, station.lon, args.radiusNm)
      } catch (error) {
        const violation = guard.violation()
        if (violation !== null) {
          say(`✗ ${violation} (çıkış 4)`)
          stop = 'guard'
          break
        }
        if (!(error instanceof AdsbLolError)) {
          rate.record('network')
          result.errors += 1
          say(`${clockText(now)} #${attempt} beklenmeyen hata · ${formatRps(rate.rps())} istek/sn`)
          continue
        }
        rate.record(error.kind, { retryAfterSec: error.retryAfterSec })
        if (error.kind === 'rate_limit') result.rateLimited += 1
        else result.errors += 1
        const next = rate.nextAllowedAt()
        const wait = Number.isFinite(next)
          ? ` · sonraki istek ${formatSeconds(Math.max(0, next - clock.now()))} sn sonra`
          : ''
        say(
          `${clockText(now)} #${attempt} ${error.status ?? '---'} · ${KIND_TEXT[error.kind]} · ${error.message}${wait} · ${formatRps(rate.rps())} istek/sn`,
        )
        if (error.kind === 'config') {
          stop = 'config'
          say(
            `✗ adsb.lol ${error.status ?? '401/403'} döndü: istekler durduruldu, yeniden denenmez (çıkış 3)`,
          )
          say('  RUNBOOK: "adsb.lol API anahtarı istemeye başladı (401/403)" (docs/RUNBOOK.md)')
          say('  DUR-SOR 3: dur ve bildir')
          break
        }
        if (error.kind === 'request') {
          stop = 'request'
          say('✗ Beklenmeyen yanıt (yönlendirme, 404 ya da geçersiz sorgu): kayıt durdu (çıkış 4)')
          break
        }
        continue
      }

      // Başarılı yanıt: ham gövde (istemcinin okuduğu metnin aynısı) satır olarak yazılır.
      const raw = await guard.takeBody()
      let frame: unknown
      try {
        if (raw === null) throw new Error('body not captured')
        frame = JSON.parse(raw) as unknown
      } catch {
        rate.record('response')
        result.errors += 1
        say(`${clockText(now)} #${attempt} 200 · yanıt gövdesi yakalanamadı · kare yazılmadı`)
        continue
      }
      if (args.fixture) frame = sanitizeFrameForFixture(frame)
      const line = `${JSON.stringify(frame)}\n`
      try {
        if (result.frames === 0) {
          mkdirSync(dirname(output.partial), { recursive: true })
          writeFileSync(output.partial, line, { flag: 'wx' })
        } else {
          appendFileSync(output.partial, line)
        }
      } catch (error) {
        rate.record('success')
        stop = 'io'
        say(
          `✗ Kayıt dosyasına yazılamadı (${errorCode(error)}): ${displayPath(root, output.partial)}`,
        )
        break
      }
      result.frames += 1
      result.bytes += Buffer.byteLength(line)
      rate.record('success')
      if (now >= nextProgressAt) {
        const count = isObject(frame) && Array.isArray(frame.ac) ? frame.ac.length : 0
        say(
          `${clockText(now)} #${attempt} 200 · ${count} uçak · ${result.frames} kare · ${formatRps(rate.rps())} istek/sn`,
        )
        while (nextProgressAt <= now) nextProgressAt += PROGRESS_EVERY_MS
      }
    }

    // 7. Bitiş: kare varsa .partial → .jsonl, künye ve öz denetim.
    const endedAt = clock.now()
    const requests = guard.requests()
    result.requests = requests.length
    result.minGapMs = minGap(requests.map((r) => r.startedAt))
    result.finalRps = Number(rate.rps().toFixed(4))
    result.stopReason = stop
    say(
      `Durdu: ${STOP_TEXT[stop]} · ${result.requests} istek · 200: ${result.frames} · 429/420: ${result.rateLimited} · hata: ${result.errors}${
        result.minGapMs === null ? '' : ` · en kısa aralık ${formatSeconds(result.minGapMs)} sn`
      } · son hız ${formatRps(rate.rps())} istek/sn`,
    )
    if (result.frames === 0) {
      say('Hiç kare alınmadı; dosya oluşturulmadı')
    } else {
      let stage: FinalizeStage = 'target_exists'
      try {
        if (existsSync(output.final)) {
          throw Object.assign(new Error('target exists'), { code: 'EEXIST' })
        }
        stage = 'rename'
        await renameWithRetry(output.partial, output.final, clock)
        result.outPath = output.final
        stage = 'meta'
        const lic = PROVIDER_LICENSES.adsbLol
        const meta: RecordingMeta = {
          source: ADSBLOL_BASE_URL,
          license: lic.license,
          licenseUrl: lic.attribution.licenseUrl,
          attribution: `${lic.attribution.text} (${lic.attribution.url}), ${lic.license}`,
          path,
          station: station.icao,
          radiusNm: args.radiusNm,
          startedAt: new Date(startedAt).toISOString(),
          endedAt: new Date(endedAt).toISOString(),
          frames: result.frames,
          requests: result.requests,
          rateLimited: result.rateLimited,
          errors: result.errors,
          minGapSec: result.minGapMs === null ? null : Number((result.minGapMs / 1000).toFixed(3)),
          finalRps: result.finalRps,
          stopReason: stop,
          sanitized: args.fixture,
          tool: `${env.APP_NAME} ${config.version} pnpm record`,
        }
        writeFileSync(output.meta, `${JSON.stringify(meta, null, 2)}\n`, { flag: 'wx' })
        result.metaPath = output.meta
        stage = 'self_check'
        const loaded = loadRecording(output.final).frames.length
        if (loaded !== result.frames) {
          throw new Error(`${loaded} kare okundu, ${result.frames} kare yazılmıştı`)
        }
        say(
          `Kayıt: ${displayPath(root, output.final)} · ${result.frames} kare · ${formatBytes(result.bytes)}`,
        )
        say(`Künye: ${displayPath(root, output.meta)}`)
        say(`Oynatmak için: pnpm dev:replay --recording ${displayPath(root, output.final)}`)
      } catch (error) {
        finalizeFailed = true
        // Dosya adımlarında yalnızca hata kodu; öz denetimde ayrıştırıcının iletisi (satır ya da
        // kare numarası; yol öneki atılır). İkisi de sır taşımaz, `say` ayrıca maskeler.
        const detail =
          stage === 'self_check' && error instanceof Error
            ? error.message.replace(`${output.final}: `, '')
            : errorCode(error)
        say(
          `✗ Kayıt kapatılamadı: ${FINALIZE_TEXT[stage]} (${detail}); kareler ${displayPath(
            root,
            result.outPath ?? output.partial,
          )} dosyasında duruyor`,
        )
        if (stage === 'self_check') {
          say(
            '  pnpm dev:replay --recording bu dosyayı reddeder; satırları elle incele ya da kaydı yeniden al',
          )
        }
      }
    }
  } finally {
    // 8. Kilit bırakılır, son isteğin başlangıcı sonraki çalışma için yazılır.
    if (redis !== null) {
      if (locked) {
        await within(releaseLiveLock(redis, token, lastRequestStart), redisTimeoutMs).catch(
          () => undefined,
        )
      }
      await closeLiveRedis(redis)
    }
  }

  result.exitCode = stop === 'config' ? 3 : finalizeFailed ? 4 : exitCodeFor(stop, result.frames)
  return result
}
