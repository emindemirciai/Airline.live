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
