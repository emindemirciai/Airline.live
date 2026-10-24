import { randomUUID } from 'node:crypto'
import type { Redis } from 'ioredis'

/**
 * adsb.lol günlük istek bütçesi (D-122). adsb.lol istemci IP'si başına saniyede 4, dakikada 60 ve
 * günde 500 istek kabul eder (`x-ratelimit-limit: 4, 4;w=1, 60;w=60, 500;w=86400`). Sayaç
 * `redis-queue`'dadır (AOF, `noeviction`): worker yeniden başlasa, iki süreç aynı anda çalışsa da
 * (yayın sırasında eski ve yeni konteyner) tek sayaç paylaşılır.
 *
 * - `hy:adsblol:budget:requests` (ZSET): her izin bir üye, skor = iznin anı (ms). Kayan 24 saatlik
 *   pencere `ZREMRANGEBYSCORE` ile tutulur; TTL 25 sa.
 * - `hy:adsblol:budget:seq`: izin sırası (`INCR`); worker hangi çemberin sorgulanacağını bununla
 *   seçer, sıra yeniden başlatmada da sürer.
 * - `hy:adsblol:budget:state` (HASH): `cap` (429 sonrası daraltılmış sınır), `serverDaily`
 *   (başlıklardan okunan günlük kota), `blockedUntil`, `lastRateLimitAt`, `lastCapChangeAt`; TTL 7 gün.
 *
 * İzin tek bir Lua betiğinde verilir (atomik):
 * 1. 24 saatten eski izinler silinir.
 * 2. Son 429'dan 24 sa ve son sınır değişiminden 6 sa geçtiyse daraltılmış sınır yapılandırılanın
 *    %5'i kadar büyür (yapılandırılanı aşmaz).
 * 3. Sert sınır = min(yapılandırılan, ⌊sunucu günlük kotası × 0,96⌋); uygulanan sınır =
 *    min(sert sınır, daraltılmış).
 * 4. Engel süresi sürüyorsa ret (`blocked`).
 * 5. Penceredeki izin sayısı sert sınıra ulaştıysa ret (`cap`): bu, aralıktan bağımsız sert
 *    sınırdır. 429 daraltması burada sayılmaz, yalnız aralığı genişletir: penceredeki izinler sert
 *    sınırı zaten aşmaz, pencereyi daraltılmış sınıra kadar boşaltmak gerekmez (boşaltma tek bir
 *    429'dan sonra saatlerce istek keserdi).
 * 6. Son izinden bu yana ⌊24 sa / uygulanan sınır⌋ geçmediyse ret (`spacing`): istekler güne eşit
 *    yayılır.
 * 7. Değilse izin eklenir, sıra artar.
 *
 * Zaman çağırandan gelir (`Date.now()`; bütün konteynerler sunucunun saatini paylaşır). Saat geri
 * giderse son izin gelecekte kalır ve aralık kuralı erken izin vermez.
 */

export const ADSBLOL_BUDGET_KEYS = {
  requests: 'hy:adsblol:budget:requests',
  seq: 'hy:adsblol:budget:seq',
  state: 'hy:adsblol:budget:state',
} as const

export const ADSBLOL_BUDGET_WINDOW_MS = 86_400_000
export const ADSBLOL_BUDGET_REQUESTS_TTL_MS = 25 * 3_600_000
export const ADSBLOL_BUDGET_STATE_TTL_MS = 7 * 86_400_000
/** Sunucunun günlük kotasının kullanılan payı (%): 500 → 480. */
export const ADSBLOL_SERVER_SHARE_PERCENT = 96
/** 429 sonrası daraltma (%): sınır bunun kadarına iner. */
export const ADSBLOL_BUDGET_SHRINK_PERCENT = 90
/** Daraltmanın alt sınırı: yapılandırılanın %20'si (480 → 96). */
export const ADSBLOL_BUDGET_FLOOR_PERCENT = 20
/** Geri büyüme adımı: yapılandırılanın %5'i. */
export const ADSBLOL_BUDGET_RAISE_PERCENT = 5
/** Geri büyüme için son 429'dan bu yana geçmesi gereken süre. */
export const ADSBLOL_BUDGET_RAISE_QUIET_MS = 86_400_000
/** İki sınır değişimi arasında en az bu süre geçer. */
export const ADSBLOL_BUDGET_RAISE_EVERY_MS = 6 * 3_600_000
/** Sınır 1'in altındaysa (sunucu kotası 0) yeniden deneme. */
const NO_CAP_RETRY_MS = 3_600_000

export type AdsbLolBudgetDecision = 'granted' | 'blocked' | 'cap' | 'spacing' | 'no_cap'
const DECISIONS: readonly AdsbLolBudgetDecision[] = [
  'granted',
  'blocked',
  'cap',
  'spacing',
  'no_cap',
]

export interface BudgetReservation {
  granted: boolean
  /** İzin verildiyse bir sonraki iznin en erken anı; verilmediyse yeniden denenecek an (ms). */
  retryAt: number
  /** Son 24 saatteki izinler (bu izin dahil). */
  used: number
  /** Uygulanan günlük sınır. */
  cap: number
  /** İzin verildiyse bu iznin sırası; verilmediyse son iznin sırası (hiç yoksa 0). */
  seq: number
  decision: AdsbLolBudgetDecision
  /** Engel süresinin sonu (ms); engel yoksa ya da bitmişse null. */
  blockedUntil: number | null
}

const RESERVE_SCRIPT = `
local now = tonumber(ARGV[1])
local configured = tonumber(ARGV[2])
local window = tonumber(ARGV[4])
local requestsTtl = tonumber(ARGV[5])
local stateTtl = tonumber(ARGV[6])
local serverShare = tonumber(ARGV[7])
local raisePercent = tonumber(ARGV[8])
local raiseQuiet = tonumber(ARGV[9])
local raiseEvery = tonumber(ARGV[10])
local noCapRetry = tonumber(ARGV[11])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
local st = redis.call('HMGET', KEYS[3], 'cap', 'serverDaily', 'blockedUntil', 'lastRateLimitAt', 'lastCapChangeAt')
local stateCap = tonumber(st[1])
local serverDaily = tonumber(st[2])
local blockedUntil = tonumber(st[3]) or 0
local lastRateLimitAt = tonumber(st[4]) or 0
local lastCapChangeAt = tonumber(st[5]) or 0
if stateCap and stateCap < configured and now - lastRateLimitAt >= raiseQuiet and now - lastCapChangeAt >= raiseEvery then
  stateCap = math.min(configured, stateCap + math.ceil(configured * raisePercent / 100))
  redis.call('HSET', KEYS[3], 'cap', stateCap, 'lastCapChangeAt', now)
  redis.call('PEXPIRE', KEYS[3], stateTtl)
end
local hardCap = configured
if serverDaily then hardCap = math.min(hardCap, math.floor(serverDaily * serverShare / 100)) end
hardCap = math.floor(hardCap)
local cap = hardCap
if stateCap then cap = math.floor(math.min(cap, stateCap)) end
local count = redis.call('ZCARD', KEYS[1])
local seq = tonumber(redis.call('GET', KEYS[2])) or 0
if cap < 1 then
  return {0, now + noCapRetry, count, cap, seq, 4, blockedUntil}
end
if blockedUntil > now then
  return {0, blockedUntil, count, cap, seq, 1, blockedUntil}
end
if count >= hardCap then
  local index = count - hardCap
  local entry = redis.call('ZRANGE', KEYS[1], index, index, 'WITHSCORES')
  return {0, tonumber(entry[2]) + window, count, cap, seq, 2, blockedUntil}
end
local spacing = math.floor(window / cap)
local newest = redis.call('ZRANGE', KEYS[1], -1, -1, 'WITHSCORES')
if newest[2] then
  local nextAt = tonumber(newest[2]) + spacing
  if now < nextAt then
    return {0, nextAt, count, cap, seq, 3, blockedUntil}
  end
end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], requestsTtl)
seq = redis.call('INCR', KEYS[2])
redis.call('PEXPIRE', KEYS[2], stateTtl)
if redis.call('EXISTS', KEYS[3]) == 1 then
  redis.call('PEXPIRE', KEYS[3], stateTtl)
end
return {1, now + spacing, count + 1, cap, seq, 0, blockedUntil}
`

const RATE_LIMIT_SCRIPT = `
local now = tonumber(ARGV[1])
local configured = tonumber(ARGV[2])
local waitMs = tonumber(ARGV[3])
local stateTtl = tonumber(ARGV[4])
local shrinkPercent = tonumber(ARGV[5])
local floorPercent = tonumber(ARGV[6])
local st = redis.call('HMGET', KEYS[1], 'cap', 'blockedUntil')
local current = tonumber(st[1]) or configured
if current > configured then current = configured end
local floorCap = math.max(1, math.floor(configured * floorPercent / 100))
local nextCap = math.max(floorCap, math.floor(current * shrinkPercent / 100))
local blocked = math.max(tonumber(st[2]) or 0, now + waitMs)
redis.call('HSET', KEYS[1], 'cap', nextCap, 'blockedUntil', blocked, 'lastRateLimitAt', now, 'lastCapChangeAt', now)
redis.call('PEXPIRE', KEYS[1], stateTtl)
return {nextCap, blocked}
`

function assertConfigured(configured: number): void {
  if (!Number.isInteger(configured) || configured < 1) {
    throw new RangeError(`adsb.lol daily budget must be a positive integer: ${configured}`)
  }
}

function assertTime(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer (ms): ${value}`)
  }
}

const toInt = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Bir istek izni ister (atomik). İzin verilmezse istek gönderilmez; `retryAt` yeniden denenecek
 * andır. İzin, isteğin gönderilip gönderilmediğinden bağımsız sayılır (temkinli taraf).
 */
export async function reserveAdsbLolRequest(
  redis: Redis,
  opts: { now: number; configured: number; member?: string },
): Promise<BudgetReservation> {
  assertConfigured(opts.configured)
  assertTime('now', opts.now)
  const member = opts.member ?? `${opts.now}:${randomUUID()}`
  const raw = (await redis.eval(
    RESERVE_SCRIPT,
    3,
    ADSBLOL_BUDGET_KEYS.requests,
    ADSBLOL_BUDGET_KEYS.seq,
    ADSBLOL_BUDGET_KEYS.state,
    String(opts.now),
    String(opts.configured),
    member,
    String(ADSBLOL_BUDGET_WINDOW_MS),
    String(ADSBLOL_BUDGET_REQUESTS_TTL_MS),
    String(ADSBLOL_BUDGET_STATE_TTL_MS),
    String(ADSBLOL_SERVER_SHARE_PERCENT),
    String(ADSBLOL_BUDGET_RAISE_PERCENT),
    String(ADSBLOL_BUDGET_RAISE_QUIET_MS),
    String(ADSBLOL_BUDGET_RAISE_EVERY_MS),
    String(NO_CAP_RETRY_MS),
  )) as unknown[]
  const [granted, retryAt, used, cap, seq, decision, blockedUntil] = raw.map(toInt)
  const blocked = blockedUntil ?? 0
  return {
    granted: granted === 1,
    retryAt: retryAt ?? opts.now,
    used: used ?? 0,
    cap: cap ?? 0,
    seq: seq ?? 0,
    decision: DECISIONS[decision ?? -1] ?? 'no_cap',
    blockedUntil: blocked > opts.now ? blocked : null,
  }
}

/**
 * 429/420 ya da tükenmek üzere olan kota (D-122): `blockedUntil` en az `now + waitMs` olur, sınır
 * %10 daralır (yapılandırılanın %20'sinin altına inmez). Yeni sınırı ve engel sonunu döndürür.
 */
export async function recordAdsbLolRateLimit(
  redis: Redis,
  opts: { now: number; configured: number; waitMs: number },
): Promise<{ cap: number; blockedUntil: number }> {
  assertConfigured(opts.configured)
  assertTime('now', opts.now)
  assertTime('waitMs', Math.ceil(opts.waitMs))
  const raw = (await redis.eval(
    RATE_LIMIT_SCRIPT,
    1,
    ADSBLOL_BUDGET_KEYS.state,
    String(opts.now),
    String(opts.configured),
    String(Math.ceil(opts.waitMs)),
    String(ADSBLOL_BUDGET_STATE_TTL_MS),
    String(ADSBLOL_BUDGET_SHRINK_PERCENT),
    String(ADSBLOL_BUDGET_FLOOR_PERCENT),
  )) as unknown[]
  const [cap, blockedUntil] = raw.map(toInt)
  return { cap: cap ?? 0, blockedUntil: blockedUntil ?? opts.now }
}

/** Başlıklardan okunan günlük kotayı yazar (`dailyQuota`; bugün 500). */
export async function recordAdsbLolServerLimit(
  redis: Redis,
  opts: { now: number; dailyQuota: number },
): Promise<void> {
  if (!Number.isInteger(opts.dailyQuota) || opts.dailyQuota < 0) {
    throw new RangeError(`daily quota must be a non-negative integer: ${opts.dailyQuota}`)
  }
  const results = await redis
    .multi()
    .hset(ADSBLOL_BUDGET_KEYS.state, 'serverDaily', String(opts.dailyQuota))
    .pexpire(ADSBLOL_BUDGET_KEYS.state, ADSBLOL_BUDGET_STATE_TTL_MS)
    .exec()
  for (const [error] of results ?? []) {
    if (error) throw error
  }
}

/**
 * Uygulanan sınır: min(yapılandırılan, daraltılmış, ⌊sunucu kotası × 0,96⌋); betikle aynı kural,
 * aralık bundan çıkar. Sert sınır (penceredeki izin sayısı) daraltmasızdır:
 * `effectiveAdsbLolCap(configured, null, serverDaily)`.
 */
export function effectiveAdsbLolCap(
  configured: number,
  stateCap: number | null,
  serverDaily: number | null,
): number {
  let cap = configured
  if (stateCap !== null) cap = Math.min(cap, stateCap)
  if (serverDaily !== null) {
    cap = Math.min(cap, Math.floor((serverDaily * ADSBLOL_SERVER_SHARE_PERCENT) / 100))
  }
  return Math.floor(cap)
}

export interface AdsbLolBudgetView {
  /** Son 24 saatteki izinler. */
  used: number
  cap: number
  blockedUntil: number | null
  serverDaily: number | null
}

/** Bütçenin anlık görünümü (yalnız okur; daraltılmış sınırı büyütmez). */
export async function readAdsbLolBudget(
  redis: Redis,
  opts: { now: number; configured: number },
): Promise<AdsbLolBudgetView> {
  const results = await redis
    .pipeline()
    .zcount(ADSBLOL_BUDGET_KEYS.requests, `(${opts.now - ADSBLOL_BUDGET_WINDOW_MS}`, '+inf')
    .hmget(ADSBLOL_BUDGET_KEYS.state, 'cap', 'serverDaily', 'blockedUntil')
    .exec()
  for (const [error] of results ?? []) {
    if (error) throw error
  }
  const used = toInt(results?.[0]?.[1])
  const [cap, serverDaily, blockedUntil] = (results?.[1]?.[1] as (string | null)[] | undefined) ?? [
    null,
    null,
    null,
  ]
  const num = (value: string | null | undefined) =>
    value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value)
  const blocked = num(blockedUntil)
  return {
    used,
    cap: effectiveAdsbLolCap(opts.configured, num(cap), num(serverDaily)),
    blockedUntil: blocked !== null && blocked > opts.now ? blocked : null,
    serverDaily: num(serverDaily),
  }
}
