/**
 * Süreç belleğinde tek değerlik önbellek (web sunucusu; D-090, D-111). Toplu hava durumu
 * (`lib/weather.ts`, 60 sn) ve havalimanı listesi (`lib/airports.ts`, 1 saat) bunu kullanır: ikisi
 * de Next veri önbelleğinin 2 MiB öğe sınırını aşar ya da aşacaktır (5. halkada liste ~3 MB).
 * Bellek: en çok bir değer (yenilenirken kısa süre iki).
 */

export interface MemoryCacheOptions<T> {
  /** Değeri getirir; hata fırlatırsa istek başarısız sayılır. */
  load: () => Promise<T>
  /** Taze sayılma süresi, ms; değere göre de verilebilir (ör. boş liste kısa tutulur). */
  ttlMs: number | ((value: T) => number)
  /** Başarısız istekten sonra yeniden deneme için en kısa süre, ms. */
  retryMs: number
  /** Yenileme başarısızken eldeki değerin en çok kullanılacağı yaş, ms (sınırsız: `Infinity`). */
  maxStaleMs: number
  /**
   * Süresi dolan değer beklemeden verilsin mi (stale-while-revalidate, D-111). Açıkken: süresi dolan
   * değer hemen döner ve arkada tek yenileme başlar; hiç değer yokken çağrı yüklemeyi bekler ve
   * yükleme başarısızsa **hatasını fırlatır** (yeniden deneme süresi beklenmez). Kapalıyken
   * (varsayılan): süresi dolunca ilk çağrı yenilemeyi bekler, hiçbir zaman fırlatmaz.
   */
  staleWhileRevalidate?: boolean
  /** Saat, epoch ms (testte sahte saat). */
  now?: () => number
}

/**
 * Önbellekli okuma işlevi. Değer `ttlMs` boyunca taze kalır; aynı anda gelen çağrılar süren tek
 * isteği paylaşır (tek uçuş). Yenileme başarısızsa değer `maxStaleMs` yaşına kadar verilir, daha
 * eskiyse null; `retryMs` dolmadan yeniden istek atılmaz. Süresi dolunca:
 * - varsayılan: ilk çağrı yenilemeyi bekler (toplu hava, D-090);
 * - `staleWhileRevalidate`: eldeki değer hemen döner, yenileme arkada (havalimanı listesi, D-111).
 */
export function createMemoryCache<T>({
  load,
  ttlMs,
  retryMs,
  maxStaleMs,
  staleWhileRevalidate = false,
  now = Date.now,
}: MemoryCacheOptions<T>): () => Promise<T | null> {
  let stored: { value: T; at: number } | null = null
  let failedAt: number | null = null
  let lastError: unknown = null
  let pending: Promise<void> | null = null
  const read = () => stored
  const ttlOf = (value: T) => (typeof ttlMs === 'function' ? ttlMs(value) : ttlMs)
  const usable = (): T | null => {
    const entry = read()
    return entry !== null && now() - entry.at <= maxStaleMs ? entry.value : null
  }
  const retryDue = () => failedAt === null || now() - failedAt >= retryMs
  /** Tek uçuş yenileme; dönen söz hiçbir zaman reddedilmez. */
  const refresh = (): Promise<void> =>
    (pending ??= load()
      .then(
        (value) => {
          stored = { value, at: now() }
          failedAt = null
          lastError = null
        },
        (error: unknown) => {
          failedAt = now()
          lastError = error
        },
      )
      .finally(() => {
        pending = null
      }))

  return async () => {
    const entry = read()
    if (entry !== null && now() - entry.at < ttlOf(entry.value)) return entry.value
    if (staleWhileRevalidate) {
      if (entry === null) {
        await refresh()
        const loaded = read()
        if (loaded === null) throw lastError
        return loaded.value
      }
      if (retryDue()) void refresh()
      return usable()
    }
    if (!retryDue()) return usable()
    await refresh()
    return usable()
  }
}
