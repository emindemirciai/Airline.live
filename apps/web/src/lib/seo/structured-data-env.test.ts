import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as EnvModule from '../env'
import { getServerEnv } from '../env'
import { breadcrumbList, itemList } from './structured-data'

vi.mock('server-only', () => ({}))
vi.mock('../env', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvModule>()
  return { ...actual, getServerEnv: vi.fn(actual.getServerEnv) }
})

beforeEach(() => {
  vi.stubEnv('APP_ENV', 'test')
  vi.stubEnv('APP_NAME', 'havayolu')
  vi.stubEnv('WEB_HOST', 'airline.live')
  vi.mocked(getServerEnv).mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

/**
 * `getServerEnv()` her çağrıda ortam değişkenlerini kopyalayıp zod ile doğrular: `/havalimanlari`'nın
 * `ItemList`'i satır başına okusaydı 4. halkada (1.217 satır) her çizim yüzlerce ms tutardı (D-102).
 */
describe('JSON-LD listeleri sitenin adresini bir kez okur (D-102)', () => {
  it('itemList: 1.217 satırda tek getServerEnv çağrısı; adresler mutlak', () => {
    const entries = Array.from({ length: 1_217 }, (_, index) => ({
      name: `Havalimanı ${index}`,
      url: `/istasyon/X${String(index).padStart(3, '0')}`,
    }))
    const list = itemList(entries)
    expect(getServerEnv).toHaveBeenCalledTimes(1)
    const items = list.itemListElement as { position: number; url: string }[]
    expect(items).toHaveLength(1_217)
    expect(items[0]).toMatchObject({ position: 1, url: 'https://airline.live/istasyon/X000' })
    expect(items.at(-1)).toMatchObject({
      position: 1_217,
      url: 'https://airline.live/istasyon/X1216',
    })
  })

  it('breadcrumbList: tek getServerEnv çağrısı; ortam değişince yeni adres', () => {
    const crumbs = [
      { name: 'havayolu', url: '/' },
      { name: 'Havalimanları', url: '/havalimanlari' },
      { name: 'İstanbul Havalimanı', url: '/istasyon/LTFM' },
    ]
    breadcrumbList(crumbs)
    expect(getServerEnv).toHaveBeenCalledTimes(1)
    // Adres önbelleğe alınmaz: her çağrı ortamı yeniden okur (testler env'i değiştirir).
    vi.stubEnv('WEB_HOST', 'example.test')
    const items = breadcrumbList(crumbs).itemListElement as { item: string }[]
    expect(items.map((item) => item.item)).toEqual([
      'https://example.test/',
      'https://example.test/havalimanlari',
      'https://example.test/istasyon/LTFM',
    ])
  })
})
