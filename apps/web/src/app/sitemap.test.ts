import { CHANGELOG } from '@havayolu/shared'
import { resolveSitemap } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data'
import type * as AirportsModule from '../lib/airports'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SITEMAP_PAGES } from '../lib/seo/sitemap'
import { airportFixture } from '../lib/test/airport-fixture'
import { TERMS_EFFECTIVE_DATE } from '../lib/terms'
import sitemap from './sitemap'

vi.mock('server-only', () => ({}))
const connection = vi.hoisted(() => vi.fn(async () => undefined))
const getAirports = vi.hoisted(() => vi.fn())
vi.mock('next/server', () => ({ connection }))
vi.mock('../lib/airports', async (importOriginal) => ({
  ...(await importOriginal<typeof AirportsModule>()),
  getAirports,
}))

const AIRPORTS = [
  airportFixture({
    icao: 'LTFM',
    iata: 'IST',
    station: { active: true, primary: true, fetchRadiusNm: 60 },
    dataUpdatedAt: '2026-09-21T03:00:00.000Z',
  }),
  airportFixture({ icao: 'LTAC', iata: 'ESB', dataUpdatedAt: '2026-09-20T03:00:00.000Z' }),
  // Tarifesiz ama izlenen istasyon: dizine eklenir.
  airportFixture({
    icao: 'LTBU',
    iata: 'TEQ',
    scheduled: false,
    station: { active: true, primary: false, fetchRadiusNm: 30 },
  }),
  // Tarifesiz, istasyon değil (askerî üs): noindex, site haritasında yok. Listede görünür ve
  // `/havalimanlari` sayfasının son değişikliğine katılır.
  airportFixture({
    icao: 'LTAG',
    iata: 'ADA',
    scheduled: false,
    dataUpdatedAt: '2026-09-25T03:00:00.000Z',
  }),
  // Yakın ülkelerdeki listelenen havalimanı (1. halka, D-080): aday kuralı gereği tarifeli, dizine
  // eklenir.
  airportFixture({
    icao: 'LGAV',
    iata: 'ATH',
    country: 'GR',
    isoRegion: 'GR-I',
    ring: 1,
    distanceToTrKm: 275,
    dataUpdatedAt: '2026-09-22T03:00:00.000Z',
  }),
]
const INDEXABLE = ['LGAV', 'LTAC', 'LTBU', 'LTFM']
const BASE = 'https://havayolu.live'

beforeEach(() => {
  vi.stubEnv('APP_ENV', 'test')
  vi.stubEnv('WEB_HOST', 'havayolu.live')
  getAirports.mockResolvedValue(AIRPORTS)
})

afterEach(() => {
  vi.unstubAllEnvs()
  connection.mockClear()
  getAirports.mockReset()
})

describe('sitemap.xml', () => {
  it('önce connection() çağrılır; havalimanları tek toplu istekten gelir', async () => {
    await sitemap()
    expect(connection).toHaveBeenCalledTimes(1)
    expect(getAirports).toHaveBeenCalledTimes(1)
  })

  it('her sayfa iki dilde: (dizine eklenen havalimanı + 5 sayfa) × 2 adres, hepsi mutlak', async () => {
    const entries = await sitemap()
    expect(SITEMAP_PAGES).toHaveLength(5)
    expect(entries).toHaveLength((INDEXABLE.length + SITEMAP_PAGES.length) * 2)
    for (const entry of entries) {
      expect(entry.url.startsWith(`${BASE}/`)).toBe(true)
      for (const href of Object.values(entry.alternates?.languages ?? {})) {
        expect(String(href).startsWith(`${BASE}/`)).toBe(true)
      }
    }
    const urls = entries.map((e) => e.url)
    expect(new Set(urls).size).toBe(urls.length)
    expect(urls).toEqual(
      expect.arrayContaining([
        `${BASE}/`,
        `${BASE}/en`,
        `${BASE}/havalimanlari`,
        `${BASE}/en/havalimanlari`,
        `${BASE}/hakkinda`,
        `${BASE}/en/yenilikler`,
        `${BASE}/kullanim-kosullari`,
        `${BASE}/en/kullanim-kosullari`,
        ...INDEXABLE.flatMap((icao) => [`${BASE}/istasyon/${icao}`, `${BASE}/en/istasyon/${icao}`]),
      ]),
    )
  })

  it('yakın ülkelerdeki listelenen havalimanı iki dilde, kendi veri tarihiyle (LGAV, D-080)', async () => {
    const entries = await sitemap()
    const athens = entries.find((e) => e.url === `${BASE}/istasyon/LGAV`)
    expect(athens?.lastModified).toBe('2026-09-22T03:00:00.000Z')
    expect(athens?.alternates?.languages).toEqual({
      tr: `${BASE}/istasyon/LGAV`,
      en: `${BASE}/en/istasyon/LGAV`,
      'x-default': `${BASE}/en/istasyon/LGAV`,
    })
  })

  it('noindex adresler yok: tarifesiz havalimanı, /durum, yönetim', async () => {
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls.some((u) => u.includes('LTAG'))).toBe(false)
    expect(urls.some((u) => /\/(durum|admin|dil|api)(\/|$)/.test(u))).toBe(false)
  })

  it('karşılıklar karşılıklıdır: tr, en ve x-default (= en) her iki kayıtta aynı', async () => {
    const entries = await sitemap()
    const byUrl = new Map(entries.map((e) => [e.url, e]))
    for (const entry of entries) {
      const languages = entry.alternates?.languages as Record<string, string>
      expect(Object.keys(languages).sort()).toEqual(['en', 'tr', 'x-default'])
      expect(languages['x-default']).toBe(languages.en)
      expect([languages.tr, languages.en]).toContain(entry.url)
      for (const locale of ['tr', 'en']) {
        const twin = byUrl.get(languages[locale] as string)
        expect(twin?.alternates?.languages).toEqual(languages)
      }
    }
  })

  it('lastmod yalnızca doğrulanabilir tarihlerden gelir', async () => {
    const entries = await sitemap()
    const lastmod = (url: string) => entries.find((e) => e.url === url)?.lastModified
    expect(lastmod(`${BASE}/istasyon/LTFM`)).toBe('2026-09-21T03:00:00.000Z')
    expect(lastmod(`${BASE}/en/istasyon/LTAC`)).toBe('2026-09-20T03:00:00.000Z')
    // Liste sayfası dizine eklenmeyenler dahil tüm havalimanlarının en yenisidir.
    expect(lastmod(`${BASE}/havalimanlari`)).toBe('2026-09-25T03:00:00.000Z')
    expect(lastmod(`${BASE}/yenilikler`)).toBe(CHANGELOG[0]?.date)
    expect(lastmod(`${BASE}/kullanim-kosullari`)).toBe(TERMS_EFFECTIVE_DATE)
    expect(lastmod(`${BASE}/`)).toBeUndefined()
    expect(lastmod(`${BASE}/hakkinda`)).toBeUndefined()
  })

  it('XML çıktısı LTFM için xhtml:link karşılıklarını taşır', async () => {
    const xml = resolveSitemap(await sitemap())
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    const ltfm = xml
      .split('<url>')
      .find((block) => block.includes(`<loc>${BASE}/istasyon/LTFM</loc>`))
    expect(ltfm).toContain(`hreflang="tr" href="${BASE}/istasyon/LTFM"`)
    expect(ltfm).toContain(`hreflang="en" href="${BASE}/en/istasyon/LTFM"`)
    expect(ltfm).toContain(`hreflang="x-default" href="${BASE}/en/istasyon/LTFM"`)
  })

  it('yerel geliştirmede adresler WEB_HOST=localhost:3100 ile http olur', async () => {
    vi.stubEnv('WEB_HOST', 'localhost:3100')
    const entries = await sitemap()
    expect(entries[0]?.url).toBe('http://localhost:3100/')
  })
})
