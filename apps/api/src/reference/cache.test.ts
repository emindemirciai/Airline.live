import { describe, expect, it, vi } from 'vitest'
import { cachedReader } from './cache'

const log = { warn: vi.fn() } as unknown as Parameters<typeof cachedReader>[0]['log']

describe('cachedReader', () => {
  it('rastgele anahtarlarla doldurulsa da anahtar sayısı ve bayt bütçesi aşılmaz', async () => {
    const maxBytes = 1_000_000
    const read = vi.fn(async (key: string) => 'x'.repeat(10_000 + (key.length % 7) * 5_000))
    const reader = cachedReader<string>({
      read,
      ttl: () => 60_000,
      now: () => 0,
      log,
      what: 'test',
      maxEntries: 500,
      maxBytes,
      sizeOf: (value) => value.length,
    })
    for (let i = 0; i < 5_000; i++) {
      await reader(`key-${i}-${'k'.repeat(i % 13)}`)
      const { entries, bytes } = reader.stats()
      expect(bytes).toBeLessThanOrEqual(maxBytes)
      expect(entries).toBeLessThanOrEqual(500)
    }
    expect(reader.stats().bytes).toBeGreaterThan(maxBytes / 2)
    expect(read).toHaveBeenCalledTimes(5_000)
  })

  it('anahtar sınırı: en eski kayıt atılır; bütçeden büyük değer sunulur ama saklanmaz', async () => {
    const read = vi.fn(async (key: string) => (key === 'big' ? 'x'.repeat(200) : key))
    const reader = cachedReader<string>({
      read,
      ttl: () => 60_000,
      now: () => 0,
      log,
      what: 'test',
      maxEntries: 2,
      maxBytes: 100,
      sizeOf: (value) => value.length,
    })
    await reader('a')
    await reader('b')
    await reader('c')
    expect(reader.stats()).toEqual({ entries: 2, bytes: 2 })
    await reader('a')
    expect(read).toHaveBeenCalledTimes(4)
    expect(await reader('big')).toEqual({ value: 'x'.repeat(200) })
    expect(reader.stats().bytes).toBeLessThanOrEqual(100)
    await reader('big')
    expect(read).toHaveBeenCalledTimes(6)
  })

  it('bütçe verilmezse yalnızca anahtar sayısı sınırlanır', async () => {
    const reader = cachedReader<string>({
      read: async (key) => key,
      ttl: () => 60_000,
      now: () => 0,
      log,
      what: 'test',
      maxEntries: 3,
    })
    for (const key of ['a', 'b', 'c', 'd', 'e']) await reader(key)
    expect(reader.stats()).toEqual({ entries: 3, bytes: 0 })
  })
})
