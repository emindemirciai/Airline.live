import { LIVE_KEYS } from '@havayolu/db'

/**
 * Canlı araçların eşzamanlılık denetimi (D-094), env'in redis-live indeksinde:
 * - `hy:provider:adsbLol` (TTL 180 sn) yalnızca adsb.lol'ü yapılandırılmış bir ingest yazar: varsa
 *   aynı IP'den ikinci bir çeken açılmaz.
 * - `hy:tools:live` kilidi iki canlı aracın aynı anda çalışmasını önler (SET NX PX, 30 sn'de bir
 *   yenilenir, sahibi token'la denetlenir).
 * - `hy:tools:live:last` son isteğin başlangıcını 60 sn tutar: sonraki çalışma ilk isteğini
 *   `last + 1000 / ADSBLOL_RPS`'ten önce atmaz.
 * İstemci `LiveRedis` arayüzünü sağlayan her şeydir: üretimde `@havayolu/db` `createRedis`, birim
 * testinde bellek içi sahte.
 */

export const LIVE_LOCK_KEY = 'hy:tools:live'
export const LIVE_LOCK_TTL_MS = 120_000
/** Kilit yenileme (ve başka ingest denetimi) aralığı. */
export const LIVE_LOCK_REFRESH_MS = 30_000
export const LIVE_LAST_KEY = 'hy:tools:live:last'
export const LIVE_LAST_TTL_MS = 60_000

/** Araçların kullandığı Redis komutları; ioredis `Redis` bunu yapısal olarak sağlar. */
export interface LiveRedis {
  ping(): Promise<string>
  exists(...keys: string[]): Promise<number>
  get(key: string): Promise<string | null>
  set(key: string, value: string, px: 'PX', milliseconds: number, nx: 'NX'): Promise<'OK' | null>
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>
  on(event: 'error', listener: (error: Error) => void): unknown
  quit(): Promise<unknown>
  disconnect(): void
}

/** CLI'lar `(url) => createRedis(url, { name: 'tools-live' })` verir; testler sahte istemci. */
export type LiveRedisFactory = (url: string) => LiveRedis

/** Lua betikleri (sahte istemci bunları adıyla tanır). */
export const LIVE_LOCK_SCRIPTS = {
  /** KEYS[1] kilit; ARGV[1] token, ARGV[2] TTL ms → 1 yenilendi, 0 kilit başkasında ya da yok. */
  refresh: [
    "if redis.call('GET', KEYS[1]) == ARGV[1] then",
    "  return redis.call('PEXPIRE', KEYS[1], ARGV[2])",
    'end',
    'return 0',
  ].join('\n'),
  /**
   * KEYS[1] kilit, KEYS[2] son istek; ARGV[1] token, ARGV[2] son istek ms ('' = yok), ARGV[3] TTL.
   * Kilit token'ınsa silinir; son istek daha yeniyse yazılır. → 1 kilit bırakıldı, 0 değildi.
   */
  release: [
    'local released = 0',
    "if redis.call('GET', KEYS[1]) == ARGV[1] then",
    "  redis.call('DEL', KEYS[1])",
    '  released = 1',
    'end',
    "if ARGV[2] ~= '' then",
    "  local previous = tonumber(redis.call('GET', KEYS[2]) or '0') or 0",
    '  if tonumber(ARGV[2]) > previous then',
    "    redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3])",
    '  end',
    'end',
    'return released',
  ].join('\n'),
} as const

/** adsb.lol'den çeken bir ingest var mı (ya da son 180 sn'de var mıydı)? */
export async function otherIngestActive(redis: LiveRedis): Promise<boolean> {
  return (await redis.exists(LIVE_KEYS.provider('adsbLol'))) > 0
}

export async function acquireLiveLock(redis: LiveRedis, token: string): Promise<boolean> {
  return (await redis.set(LIVE_LOCK_KEY, token, 'PX', LIVE_LOCK_TTL_MS, 'NX')) === 'OK'
}

/** Kilit hâlâ bu token'ınsa süresini uzatır. */
export async function refreshLiveLock(redis: LiveRedis, token: string): Promise<boolean> {
  const result = await redis.eval(
    LIVE_LOCK_SCRIPTS.refresh,
    1,
    LIVE_LOCK_KEY,
    token,
    LIVE_LOCK_TTL_MS,
  )
  return Number(result) === 1
}

/**
 * Kilidi (bu token'ınsa) bırakır ve son isteğin başlangıcını `hy:tools:live:last`'e yazar
 * (60 sn; var olandan yeni değilse yazılmaz).
 */
export async function releaseLiveLock(
  redis: LiveRedis,
  token: string,
  lastRequestAt: number | null = null,
): Promise<void> {
  await redis.eval(
    LIVE_LOCK_SCRIPTS.release,
    2,
    LIVE_LOCK_KEY,
    LIVE_LAST_KEY,
    token,
    lastRequestAt === null || !Number.isFinite(lastRequestAt)
      ? ''
      : String(Math.round(lastRequestAt)),
    LIVE_LAST_TTL_MS,
  )
}

export type LiveLockCheck = 'held' | 'lost' | 'other_ingest'

/** 30 sn'lik denetim: kilidi yeniler, sonra başka ingest var mı bakar. */
export async function checkLiveLock(redis: LiveRedis, token: string): Promise<LiveLockCheck> {
  if (!(await refreshLiveLock(redis, token))) return 'lost'
  if (await otherIngestActive(redis)) return 'other_ingest'
  return 'held'
}

/** Önceki canlı çalışmanın son isteğinin başlangıcı (ms); yoksa ya da bozuksa null. */
export async function lastLiveRequestAt(redis: LiveRedis): Promise<number | null> {
  const value = Number(await redis.get(LIVE_LAST_KEY))
  return Number.isFinite(value) && value > 0 ? value : null
}

/**
 * İlk isteğin en erken anı: `last + 1000 / rps`. Önceki çalışma yoksa `now`. Bozuk (gelecekteki)
 * bir değer beklemeyi `LIVE_LAST_TTL_MS + 1000 / rps`'ten uzun tutamaz.
 */
export function liveStartNotBefore(lastRequestAt: number | null, rps: number, now: number): number {
  if (lastRequestAt === null) return now
  const gap = 1000 / rps
  return Math.max(now, Math.min(lastRequestAt + gap, now + LIVE_LAST_TTL_MS + gap))
}

/** Komutun sonucunu `ms` içinde bekler; hata, eşzamanlı fırlatma ya da zaman aşımında null. */
function settleWithin<T>(run: () => Promise<T>, ms: number): Promise<{ value: T } | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    timer.unref?.()
    let promise: Promise<T>
    try {
      promise = run()
    } catch {
      clearTimeout(timer)
      resolve(null)
      return
    }
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve({ value })
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
    )
  })
}

/**
 * İstemciyi kurar, hata dinleyicisini hemen bağlar (yoksa ioredis bağlanamayınca işlenmemiş hata
 * olayı süreci düşürür) ve `timeoutMs` içinde PING'e yanıt bekler. Kurulum hata verir, PING hata
 * verir ya da zaman aşılırsa bağlantı kesilir ve null döner; çağıran "Redis yok" yoluna geçer.
 */
export async function connectLiveRedis(
  factory: LiveRedisFactory,
  url: string,
  timeoutMs: number,
): Promise<LiveRedis | null> {
  let redis: LiveRedis
  try {
    redis = factory(url)
  } catch {
    return null
  }
  redis.on('error', () => {})
  const pong = await settleWithin(() => redis.ping(), timeoutMs)
  if (pong === null) {
    try {
      redis.disconnect()
    } catch {
      // Zaten kapalı istemci.
    }
    return null
  }
  return redis
}

/** QUIT'i `timeoutMs` bekler; hata verir ya da yanıt gelmezse bağlantıyı keser. */
export async function closeLiveRedis(redis: LiveRedis | null, timeoutMs = 1_000): Promise<void> {
  if (redis === null) return
  const quit = await settleWithin(() => redis.quit(), timeoutMs)
  if (quit === null) {
    try {
      redis.disconnect()
    } catch {
      // Zaten kapalı istemci.
    }
  }
}
