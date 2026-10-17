/**
 * Paylaşım görsellerinin süreç içi önbelleği (D-111): en çok `OG_IMAGE_CACHE_MAX_ENTRIES` görsel,
 * en uzun süre istenmeyen önce çıkar (LRU). Görsel ~50 KB'tır: 256 kayıt ~12,5 MB. Sınırsız
 * önbellek bütün sayfaların taranmasında 4. halkada ~58 MB, 5. halkada ~155 MB tutardı (web
 * konteynerinin sınırı 320 MB).
 *
 * Kayıt kimliğe (ICAO) göredir; içerik değişirse (anahtar farklı) yeniden çizilir. Çizim sözü
 * tutulur: aynı anda gelen istekler tek çizimi paylaşır. Başarısız çizim önbellekte kalmaz.
 */
export const OG_IMAGE_CACHE_MAX_ENTRIES = 256

export interface OgImageCache<C> {
  get(id: string, content: C): Promise<ArrayBuffer>
  readonly size: number
}

export function createOgImageCache<C>(
  render: (content: C) => Promise<ArrayBuffer>,
  maxEntries = OG_IMAGE_CACHE_MAX_ENTRIES,
): OgImageCache<C> {
  const entries = new Map<string, { key: string; png: Promise<ArrayBuffer> }>()
  return {
    get(id, content) {
      const key = JSON.stringify(content)
      const entry = entries.get(id)
      // Map ekleme sırasını korur: kullanılan kayıt sona taşınır, en eski baştadır.
      entries.delete(id)
      if (entry?.key === key) {
        entries.set(id, entry)
        return entry.png
      }
      const png = render(content).catch((error: unknown) => {
        if (entries.get(id)?.key === key) entries.delete(id)
        throw error
      })
      entries.set(id, { key, png })
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next()
        if (oldest.done) break
        entries.delete(oldest.value)
      }
      return png
    },
    get size() {
      return entries.size
    },
  }
}
