import { promisify } from 'node:util'
import zlib from 'node:zlib'
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify'

/**
 * Listelenen havalimanlarının (`scope=listed`) hazır yanıt gövdeleri (D-111). Liste nesnesi
 * (`cachedReader`'ın değeri) her yenilemede yenidir; gövde nesne başına bir kez metne çevrilir ve
 * sıkıştırılmış biçimleri (brotli kalite 11, gzip 9) zaman uyumsuz zlib'le (iş parçacığı havuzunda)
 * bir kez kurulur. Böylece istek başına serileştirme ve sıkıştırma yoktur: 5. halkada 3.243
 * havalimanının pistli listesi istek başına ~54 ms serileştirme ve ~28 ms brotli 4 ederdi; brotli 11
 * olay döngüsünde ~5 sn sürerdi.
 *
 * - **Sıkıştırılmamış gövde** değer ilk görüldüğünde eşzamanlı yazılır (yenileme başına bir kez).
 * - **Sıkıştırılmış gövdeler** kurulurken önceki değerin sıkıştırılmış gövdeleri sunulur (veri günde
 *   bir değişir; önceki liste ~10 dk eskidir). Yeni metin öncekiyle bayt bayt aynıysa sıkıştırma
 *   yeniden yapılmaz, öncekiler kullanılır.
 * - **Soğuk açılışta** (sıkıştırılmış gövde hiç yokken) `null` döner: istek eski yoldan gider,
 *   `@fastify/compress` gövdeyi istek anında brotli 4 ya da gzip ile sıkıştırır.
 * - Sıkıştırma başarısızsa günlüğe yazılır ve `CACHE_BUILD_RETRY_MS` sonra yeniden denenir; o sürede
 *   önceki gövdeler, yoksa soğuk yol.
 */

export const BODY_ENCODINGS = ['br', 'gzip'] as const
export type BodyEncoding = (typeof BODY_ENCODINGS)[number]
export type CompressBody = (encoding: BodyEncoding, body: Buffer) => Promise<Buffer>

/** Önbellekli gövdenin brotli kalitesi (en yüksek; yenileme başına bir kez, iş parçacığında). */
export const CACHED_BROTLI_QUALITY = 11
/** Önbellekli gövdenin gzip düzeyi. */
export const CACHED_GZIP_LEVEL = 9
/** Başarısız sıkıştırmadan sonra yeniden deneme için en kısa süre, ms. */
export const CACHE_BUILD_RETRY_MS = 60_000

const brotliCompress = promisify(zlib.brotliCompress)
const gzipCompress = promisify(zlib.gzip)

/** Varsayılan sıkıştırıcı: zaman uyumsuz zlib (olay döngüsünü tutmaz). */
export const compressBody: CompressBody = (encoding, body) =>
  encoding === 'br'
    ? brotliCompress(body, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: CACHED_BROTLI_QUALITY,
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length,
        },
      })
    : gzipCompress(body, { level: CACHED_GZIP_LEVEL })

/** Bir değerin gövdeleri: sıkıştırılmamış her zaman, sıkıştırılmışlar kurulduysa. */
export interface CachedBodies {
  identity: Buffer
  /** Bu değerin (ya da kurulurken öncekinin) sıkıştırılmış gövdeleri; soğuk açılışta null. */
  encoded: Readonly<Record<BodyEncoding, Buffer>> | null
}

interface Generation<V> {
  source: V
  identity: Buffer
  encoded: Readonly<Record<BodyEncoding, Buffer>> | null
  building: boolean
  failedAt: number | null
}

export interface BodyCacheOptions {
  log: FastifyBaseLogger
  /** Günlük satırındaki gövdenin adı (İngilizce). */
  what: string
  compress?: CompressBody
  now?: () => number
}

/** Değer nesnesi başına gövdeler; `get` değeri ve onun serileştiricisini alır. */
export interface BodyCache<V> {
  get(source: V, serialize: (value: V) => string): CachedBodies
}

export function createBodyCache<V extends object>({
  log,
  what,
  compress = compressBody,
  now = Date.now,
}: BodyCacheOptions): BodyCache<V> {
  let current: Generation<V> | null = null
  /** Son tamamlanan sıkıştırılmış gövdeler (yenisi kurulurken sunulur). */
  let lastEncoded: Readonly<Record<BodyEncoding, Buffer>> | null = null

  const build = (generation: Generation<V>) => {
    generation.building = true
    Promise.all(BODY_ENCODINGS.map((encoding) => compress(encoding, generation.identity))).then(
      ([br, gzip]) => {
        generation.building = false
        if (br === undefined || gzip === undefined) return
        generation.encoded = { br, gzip }
        if (current === generation) lastEncoded = generation.encoded
      },
      (error: unknown) => {
        generation.building = false
        generation.failedAt = now()
        log.warn({ err: error }, `${what} could not be compressed`)
      },
    )
  }

  return {
    get(source, serialize) {
      if (current?.source !== source) {
        const identity = Buffer.from(serialize(source))
        const previous = current
        const same =
          previous !== null && previous.encoded !== null && previous.identity.equals(identity)
        current = {
          source,
          identity,
          encoded: same ? previous.encoded : null,
          building: false,
          failedAt: null,
        }
        if (!same) build(current)
      } else if (
        current.encoded === null &&
        !current.building &&
        current.failedAt !== null &&
        now() - current.failedAt >= CACHE_BUILD_RETRY_MS
      ) {
        build(current)
      }
      return { identity: current.identity, encoded: current.encoded ?? lastEncoded }
    },
  }
}

/**
 * İstemcinin kabul ettiği önbellekli kodlama (`@fastify/compress`'in seçimi gibi): en yüksek `q`,
 * eşitse brotli; `*` ve `x-gzip` gzip sayılır; `q=0` reddedir. Kodlama yoksa null (gövde
 * sıkıştırılmadan gider).
 */
export function preferredEncoding(header: string | string[] | undefined): BodyEncoding | null {
  if (header === undefined) return null
  const quality: Partial<Record<BodyEncoding, number>> = {}
  for (const part of (Array.isArray(header) ? header.join(',') : header).split(',')) {
    const [rawName = '', ...params] = part.split(';')
    const name = rawName.trim().toLowerCase()
    const encoding: BodyEncoding | null =
      name === 'br' ? 'br' : name === 'gzip' || name === 'x-gzip' || name === '*' ? 'gzip' : null
    if (encoding === null) continue
    let q = 1
    for (const param of params) {
      const [key = '', value = ''] = param.split('=')
      if (key.trim().toLowerCase() === 'q') q = Number(value.trim())
    }
    if (!Number.isFinite(q)) continue
    quality[encoding] = Math.max(quality[encoding] ?? 0, q)
  }
  const br = quality.br ?? 0
  const gzip = quality.gzip ?? 0
  if (br > 0 && br >= gzip) return 'br'
  return gzip > 0 ? 'gzip' : null
}

/** `Vary` başlığına `accept-encoding` ekler (CORS'un `Origin`'i korunur). */
function addVary(reply: FastifyReply): void {
  const existing = reply.getHeader('vary')
  const values = (Array.isArray(existing) ? existing : existing === undefined ? [] : [existing])
    .map(String)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value !== '')
  if (!values.some((value) => value.toLowerCase() === 'accept-encoding')) {
    values.push('accept-encoding')
  }
  reply.header('vary', values.join(', '))
}

/**
 * Önbellekli gövdeyi gönderir: istemci brotli ya da gzip kabul ediyorsa ve o gövde hazırsa
 * sıkıştırılmış gövde (`content-encoding` yazılır, eklenti dokunmaz); değilse sıkıştırılmamış gövde
 * (eklenti istemciye göre istek anında sıkıştırır: soğuk yol). `x-no-compression` eklentideki gibi
 * sıkıştırmayı kapatır.
 */
export function sendCachedBody(
  request: FastifyRequest,
  reply: FastifyReply,
  bodies: CachedBodies,
): FastifyReply {
  addVary(reply)
  reply.type('application/json; charset=utf-8')
  const encoding =
    request.headers['x-no-compression'] === undefined
      ? preferredEncoding(request.headers['accept-encoding'])
      : null
  const encoded = encoding === null ? undefined : bodies.encoded?.[encoding]
  if (encoding !== null && encoded !== undefined) {
    return reply.header('content-encoding', encoding).send(encoded)
  }
  return reply.send(bodies.identity)
}
