import type { FastifyBaseLogger } from 'fastify'

/** Okuma başarısız olup eldeki kopya sunulunca veritabanı bu aralıktan önce yeniden denenmez. */
export const CACHE_RETRY_MS = 60_000

interface CacheEntry<V> {
  value: V
  /** Bu ana kadar veritabanına gidilmez. */
  freshUntil: number
  /** `sizeOf(value)`; bayt bütçesinin toplamına girer. */
  bytes: number
}

export interface CachedReaderOptions<V> {
  /** Anahtarın değerini okur; `null`: okuyucu yok (veritabanı yok) → her istek `null` (503). */
  read: ((key: string) => Promise<V>) | null
  /** Okunan değerin taze kalacağı süre, ms (ör. boş liste daha kısa tutulur). */
  ttl: (value: V) => number
  /** Saat, epoch ms (testte sahte saat). */
  now: () => number
  log: FastifyBaseLogger
  /** Log satırında okunamayan şeyin adı (İngilizce). */
  what: string
  /** Önbellekteki anahtar sınırı; aşılınca en eski kayıt atılır. */
  maxEntries: number
  /**
   * Önbellekteki değerlerin toplam boyutu için üst sınır (bayt, `sizeOf` ile); aşılınca en eski
   * kayıtlar atılır. Verilmezse yalnızca anahtar sayısı sınırlanır (küçük değerler).
   */
  maxBytes?: number
  /** Değerin yaklaşık boyutu, bayt (ör. JSON metninin uzunluğu). `maxBytes` ile birlikte verilir. */
  sizeOf?: (value: V) => number
}

/** Önbellek okuyucusu; `stats` anlık anahtar sayısını ve tutulan baytı verir (test ve log). */
export type CachedReader<V> = ((key: string) => Promise<{ value: V } | null>) & {
  stats(): { entries: number; bytes: number }
}

/**
 * Anahtar başına süreç içi önbellek: taze kopya varsa o, yoksa tek bir okuma (eşzamanlı istekler
 * aynı okumayı bekler). Okuma başarısız olursa eldeki (süresi geçmiş) kopya sunulur ve
 * `CACHE_RETRY_MS` boyunca yeniden denenmez; kopya yoksa `null` (→ 503). Anahtar sayısı ve
 * (verilirse) toplam bayt sınırlıdır: rastgele anahtarlarla ya da büyük yanıtlarla gelen istekler
 * belleği büyütemez. Sınır aşılınca en eski (en uzun süredir yazılmamış) kayıt atılır; tek başına
 * bütçeyi aşan değer sunulur ama saklanmaz.
 */
export function cachedReader<V>(options: CachedReaderOptions<V>): CachedReader<V> {
  const { read, ttl, now, log, what, maxEntries } = options
  const maxBytes = options.maxBytes ?? Number.POSITIVE_INFINITY
  const sizeOf = options.sizeOf ?? (() => 0)
  const cache = new Map<string, CacheEntry<V>>()
  const pending = new Map<string, Promise<{ value: V } | null>>()
  let totalBytes = 0

  const drop = (key: string) => {
    const entry = cache.get(key)
    if (entry === undefined) return
    totalBytes -= entry.bytes
    cache.delete(key)
  }

  const remember = (key: string, value: V, freshUntil: number) => {
    drop(key)
    const bytes = Math.max(0, sizeOf(value))
    if (bytes > maxBytes) return
    cache.set(key, { value, freshUntil, bytes })
    totalBytes += bytes
    while (cache.size > maxEntries || totalBytes > maxBytes) {
      const oldest = cache.keys().next().value
      if (oldest === undefined) break
      drop(oldest)
    }
  }

  const refresh = async (
    reader: (key: string) => Promise<V>,
    key: string,
    stale: CacheEntry<V> | undefined,
  ): Promise<{ value: V } | null> => {
    try {
      const value = await reader(key)
      remember(key, value, now() + ttl(value))
      return { value }
    } catch (error) {
      log.warn({ err: error, key }, `${what} could not be read`)
      if (stale === undefined) return null
      stale.freshUntil = now() + CACHE_RETRY_MS
      return { value: stale.value }
    }
  }

  const get = (key: string): Promise<{ value: V } | null> => {
    const entry = cache.get(key)
    if (entry !== undefined && entry.freshUntil > now())
      return Promise.resolve({ value: entry.value })
    if (read === null) return Promise.resolve(null)
    let inflight = pending.get(key)
    if (inflight === undefined) {
      inflight = refresh(read, key, entry).finally(() => pending.delete(key))
      pending.set(key, inflight)
    }
    return inflight
  }
  return Object.assign(get, { stats: () => ({ entries: cache.size, bytes: totalBytes }) })
}
