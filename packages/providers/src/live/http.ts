/** Canlı istemcilerin ortak HTTP yardımcıları (adsb.lol ve yerel alıcı). */

export class BodyTooLargeError extends Error {
  constructor(readonly limitBytes: number) {
    super(`yanıt ${limitBytes} baytı aşıyor`)
    this.name = 'BodyTooLargeError'
  }
}

/**
 * Gövdeyi en fazla `maxBytes` (açılmış, gzip sonrası) okur; aşarsa okumayı iptal eder ve
 * BodyTooLargeError fırlatır. Okuma sırasında ağ hatası ya da zaman aşımı olduğu gibi fırlar.
 */
export async function readTextCapped(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined)
    throw new BodyTooLargeError(maxBytes)
  }
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new BodyTooLargeError(maxBytes)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

/** En uzun bekleme (data-sources.md: geri çekilme en fazla 300 sn). */
export const MAX_RETRY_AFTER_SEC = 300

/** Retry-After: saniye ya da HTTP tarihi; yoksa ya da geçersizse null, en fazla 300 sn. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  const seconds = /^\d+$/.test(trimmed)
    ? Number(trimmed)
    : Math.ceil((Date.parse(trimmed) - now) / 1000)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return Math.min(seconds, MAX_RETRY_AFTER_SEC)
}

/** Başlıkların (User-Agent, anahtar, token) HTTP'de gönderilebilir olduğunu doğrular. */
export function headersAreValid(headers: Record<string, string>): boolean {
  try {
    new Headers(headers)
    return true
  } catch {
    return false
  }
}

/** Hız sınırı politikası: `windowS` saniyelik pencerede en fazla `quota` istek. */
export interface RateLimitPolicy {
  quota: number
  windowS: number
}

/**
 * Yanıtın hız sınırı başlıkları (draft-ietf-httpapi-ratelimit-headers biçimi; adsb.lol:
 * `x-ratelimit-limit: 4, 4;w=1, 60;w=60, 500;w=86400`).
 */
export interface RateLimitInfo {
  /** Şu anki sınır (başlıktaki pencere parametresiz ilk değer; yoksa ilk politikanın kotası). */
  limit: number
  /** `;w=` parametreli bütün politikalar (yazıldığı sırayla). */
  policies: RateLimitPolicy[]
  /** Kalan istek; başlık yoksa ya da bozuksa null. */
  remaining: number | null
  /** Pencerenin sıfırlanmasına kalan süre (sn); başlık yoksa ya da bozuksa null. */
  resetS: number | null
}

const NON_NEGATIVE_INT = /^\d{1,12}$/
/** Bu değerden büyük sıfırlama değeri Unix zamanıdır (sn), kalan süre değil. */
const EPOCH_RESET_MIN_S = 1_000_000_000

/** `quota[;w=pencere][;başka=parametre]` öğesi; bozuksa null. */
function parseLimitItem(item: string): { quota: number; windowS: number | null } | null {
  const [head, ...params] = item.split(';').map((part) => part.trim())
  if (head === undefined || !NON_NEGATIVE_INT.test(head)) return null
  let windowS: number | null = null
  for (const param of params) {
    const eq = param.indexOf('=')
    if (eq <= 0) return null
    const key = param.slice(0, eq).trim().toLowerCase()
    const value = param.slice(eq + 1).trim()
    if (key !== 'w') continue
    if (!NON_NEGATIVE_INT.test(value) || Number(value) === 0) return null
    windowS = Number(value)
  }
  return { quota: Number(head), windowS }
}

/** Liste başlığının ilk öğesi tamsayıysa o; değilse null. */
function firstInteger(value: string | null): number | null {
  const first = value?.split(',')[0]?.split(';')[0]?.trim()
  return first !== undefined && NON_NEGATIVE_INT.test(first) ? Number(first) : null
}

/**
 * Hız sınırı başlıklarını okur: önce `x-ratelimit-limit`, `x-ratelimit-remaining`,
 * `x-ratelimit-reset`; yoksa `ratelimit-*` adları (politikalar `ratelimit-policy`'den de gelebilir).
 * Sınır başlığı yoksa ya da bir öğesi bozuksa null döner (yarım bilgiyle karar verilmez).
 * Sıfırlama değeri Unix zamanıysa (≥ 1e9 sn) `now`'a göre kalan süreye çevrilir.
 */
export function parseRateLimitHeaders(
  headers: Headers,
  now: number = Date.now(),
): RateLimitInfo | null {
  const prefixed = headers.get('x-ratelimit-limit') !== null
  const read = (name: string) =>
    prefixed ? headers.get(`x-ratelimit-${name}`) : headers.get(`ratelimit-${name}`)
  const raw = read('limit')
  if (raw === null || raw.trim() === '') return null
  let limit: number | null = null
  const policies: RateLimitPolicy[] = []
  const policyText = [raw, read('policy') ?? ''].join(',')
  for (const [index, item] of policyText.split(',').entries()) {
    if (item.trim() === '') {
      if (index === 0) return null
      continue
    }
    const parsed = parseLimitItem(item)
    if (parsed === null) return null
    if (parsed.windowS === null) {
      limit ??= parsed.quota
      continue
    }
    // `ratelimit-policy` aynı politikaları yineleyebilir; tekrarı eklenmez.
    if (!policies.some((p) => p.quota === parsed.quota && p.windowS === parsed.windowS)) {
      policies.push({ quota: parsed.quota, windowS: parsed.windowS })
    }
  }
  limit ??= policies[0]?.quota ?? null
  if (limit === null) return null
  const remaining = firstInteger(read('remaining'))
  const reset = firstInteger(read('reset'))
  const resetS =
    reset === null
      ? null
      : reset >= EPOCH_RESET_MIN_S
        ? Math.max(0, Math.ceil(reset - now / 1000))
        : reset
  return { limit, policies, remaining, resetS }
}

/**
 * Politikalardan çıkan günlük istek sınırı: her politika için ⌊kota × 86400 / pencere⌋, en
 * küçüğü. Bugün adsb.lol için 500. Politika yoksa null.
 */
export function dailyQuota(info: RateLimitInfo | null): number | null {
  if (info === null || info.policies.length === 0) return null
  let min = Infinity
  for (const { quota, windowS } of info.policies) {
    min = Math.min(min, Math.floor((quota * 86_400) / windowS))
  }
  return Number.isFinite(min) ? min : null
}
