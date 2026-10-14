import { describe, expect, it, vi } from 'vitest'
import { createOgImageCache, OG_IMAGE_CACHE_MAX_ENTRIES } from './og-image-cache'

const png = (name: string) => new TextEncoder().encode(name).buffer as ArrayBuffer
const text = async (promise: Promise<ArrayBuffer>) => new TextDecoder().decode(await promise)

describe('createOgImageCache: paylaşım görsellerinin süreç içi önbelleği (D-111)', () => {
  it('en çok 256 görsel (~12,5 MB); fazlası en uzun süre istenmeyenden çıkar', async () => {
    expect(OG_IMAGE_CACHE_MAX_ENTRIES).toBe(256)
    const render = vi.fn(async (content: { name: string }) => png(content.name))
    const cache = createOgImageCache(render)
    for (let i = 0; i < 300; i++) await cache.get(`A${i}`, { name: `n${i}` })
    expect(cache.size).toBe(256)
    expect(render).toHaveBeenCalledTimes(300)
    // İlk 44 çıktı: yeniden istenince yeniden çizilir; kalanlar önbellekten.
    await cache.get('A0', { name: 'n0' })
    expect(render).toHaveBeenCalledTimes(301)
    await cache.get('A299', { name: 'n299' })
    expect(render).toHaveBeenCalledTimes(301)
    expect(cache.size).toBe(256)
  })

  it('kullanılan kayıt sona taşınır (LRU), içerik değişince yeniden çizilir', async () => {
    const render = vi.fn(async (content: { name: string }) => png(content.name))
    const cache = createOgImageCache(render, 2)
    await cache.get('LTFM', { name: 'a' })
    await cache.get('LTFJ', { name: 'b' })
    // LTFM kullanıldı: yeni kayıt LTFJ'yi çıkarır.
    expect(await text(cache.get('LTFM', { name: 'a' }))).toBe('a')
    await cache.get('LTBA', { name: 'c' })
    expect(render).toHaveBeenCalledTimes(3)
    await cache.get('LTFM', { name: 'a' })
    expect(render).toHaveBeenCalledTimes(3)
    await cache.get('LTFJ', { name: 'b' })
    expect(render).toHaveBeenCalledTimes(4)
    // Aynı kimlik, yeni içerik: yeniden çizilir, kayıt sayısı artmaz.
    expect(await text(cache.get('LTFJ', { name: 'b2' }))).toBe('b2')
    expect(render).toHaveBeenCalledTimes(5)
    expect(cache.size).toBe(2)
  })

  it('aynı anda gelen istekler tek çizimi paylaşır; başarısız çizim önbellekte kalmaz', async () => {
    let fail = true
    const render = vi.fn(async (content: { name: string }) => {
      if (fail) throw new Error('render failed')
      return png(content.name)
    })
    const cache = createOgImageCache(render)
    const first = cache.get('LTFM', { name: 'a' })
    const second = cache.get('LTFM', { name: 'a' })
    expect(second).toBe(first)
    await expect(first).rejects.toThrow('render failed')
    expect(cache.size).toBe(0)
    fail = false
    expect(await text(cache.get('LTFM', { name: 'a' }))).toBe('a')
    expect(render).toHaveBeenCalledTimes(2)
  })
})
