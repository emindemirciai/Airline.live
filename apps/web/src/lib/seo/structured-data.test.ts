import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { airportFixture } from '../test/airport-fixture'
import {
  airportId,
  airportMapUrl,
  airportNode,
  breadcrumbId,
  breadcrumbList,
  itemList,
  organizationNode,
  pageId,
  webPageNode,
  websiteGraph,
} from './structured-data'

vi.mock('server-only', () => ({}))

beforeEach(() => {
  vi.stubEnv('APP_ENV', 'test')
  vi.stubEnv('APP_NAME', 'havayolu')
  vi.stubEnv('WEB_HOST', 'havayolu.live')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const ltfm = airportFixture({
  icao: 'LTFM',
  iata: 'IST',
  name: 'Istanbul Airport',
  lat: 41.2608,
  lon: 28.7418,
  elevationFt: 325,
  isoRegion: 'TR-34',
  municipality: 'Arnavutköy',
  station: { active: true, primary: true, fetchRadiusNm: 60 },
})

describe('websiteGraph', () => {
  it('WebSite + Organization; SearchAction ve sameAs yok', () => {
    const [website, org] = websiteGraph('tr')
    expect(website).toMatchObject({
      '@type': 'WebSite',
      '@id': 'https://havayolu.live/#website',
      name: 'havayolu',
      alternateName: 'havayolu.live',
      url: 'https://havayolu.live/',
      inLanguage: ['tr', 'en'],
      publisher: { '@id': 'https://havayolu.live/#org' },
    })
    expect(org).toEqual(organizationNode('tr'))
    expect(org).toMatchObject({
      '@type': 'Organization',
      '@id': 'https://havayolu.live/#org',
      url: 'https://havayolu.live/',
      logo: { '@type': 'ImageObject', url: 'https://havayolu.live/icon/512', width: 512 },
    })
    const json = JSON.stringify(websiteGraph('en'))
    expect(json).not.toContain('SearchAction')
    expect(json).not.toContain('sameAs')
  })
})

describe('airportNode', () => {
  it('kodlar, sayısal konum ve metre cinsinden rakım, il ve canlı harita adresi', () => {
    const node = airportNode(ltfm, 'tr')
    expect(node).toMatchObject({
      '@type': 'Airport',
      '@id': 'https://havayolu.live/istasyon/LTFM#airport',
      name: 'İstanbul Havalimanı',
      alternateName: 'Istanbul Airport',
      iataCode: 'IST',
      icaoCode: 'LTFM',
      geo: { '@type': 'GeoCoordinates', latitude: 41.2608, longitude: 28.7418, elevation: 99 },
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Arnavutköy',
        addressRegion: 'İstanbul',
        addressCountry: 'TR',
      },
      hasMap: 'https://havayolu.live/?havalimani=LTFM',
    })
    const geo = node.geo as Record<string, unknown>
    for (const key of ['latitude', 'longitude', 'elevation']) {
      expect(typeof geo[key]).toBe('number')
    }
  })

  it('İngilizce sayfada ad ve il İngilizcedir; varlık kimliği iki dilde aynıdır', () => {
    const node = airportNode(ltfm, 'en')
    expect(node).toMatchObject({
      '@id': airportId('LTFM'),
      name: 'Istanbul Airport',
      address: { addressRegion: 'Istanbul' },
      hasMap: 'https://havayolu.live/en?havalimani=LTFM',
    })
    // OurAirports adı görünen adla aynıysa alternateName yazılmaz.
    expect(node).not.toHaveProperty('alternateName')
  })

  it('bilinmeyen rakım ve yerleşim alanları yazılmaz', () => {
    const node = airportNode(
      airportFixture({ icao: 'LTZZ', elevationFt: null, municipality: null, isoRegion: 'XX-1' }),
      'tr',
    )
    expect(node.geo).not.toHaveProperty('elevation')
    expect(node.address).toEqual({ '@type': 'PostalAddress', addressCountry: 'TR' })
  })

  it('addressLocality ham OurAirports yerleşimi değildir: biçimsiz ya da ille aynı değer yazılmaz', () => {
    for (const municipality of ['Istanbul', 'Istanbul(Bakırköy)', 'Pendik, Istanbul']) {
      const node = airportNode({ ...ltfm, municipality }, 'tr')
      expect(node.address, municipality).not.toHaveProperty('addressLocality')
      expect(node.address).toMatchObject({ addressRegion: 'İstanbul' })
    }
  })

  it('harita adresi ICAO kodunu büyük harfe çevirir', () => {
    expect(airportMapUrl('ltfm', 'tr')).toBe('https://havayolu.live/?havalimani=LTFM')
  })
})

describe('webPageNode ve breadcrumbList', () => {
  it('sayfa düğümü dil önekli adres, inLanguage, WebSite ve içerik yolu bağlantısı taşır', () => {
    const node = webPageNode({
      locale: 'en',
      path: '/istasyon/LTFM',
      name: 'Istanbul Airport (IST/LTFM)',
      about: airportId('LTFM'),
      dateModified: '2026-09-20T04:40:00.000Z',
      breadcrumb: true,
    })
    expect(node).toEqual({
      '@type': 'WebPage',
      '@id': 'https://havayolu.live/en/istasyon/LTFM#page',
      url: 'https://havayolu.live/en/istasyon/LTFM',
      name: 'Istanbul Airport (IST/LTFM)',
      inLanguage: 'en',
      isPartOf: { '@id': 'https://havayolu.live/#website' },
      about: { '@id': 'https://havayolu.live/istasyon/LTFM#airport' },
      dateModified: '2026-09-20T04:40:00.000Z',
      breadcrumb: { '@id': 'https://havayolu.live/en/istasyon/LTFM#breadcrumb' },
    })
    expect(pageId('tr', '/')).toBe('https://havayolu.live/#page')
  })

  it('içerik yolu 1’den başlayan sıralı konumlar ve mutlak adresler taşır', () => {
    const list = breadcrumbList(
      [
        { name: 'havayolu', url: '/en' },
        { name: 'Airports', url: '/en/havalimanlari' },
        { name: 'Istanbul Airport', url: '/en/istasyon/LTFM' },
      ],
      breadcrumbId('en', '/istasyon/LTFM'),
    )
    expect(list['@id']).toBe('https://havayolu.live/en/istasyon/LTFM#breadcrumb')
    const items = list.itemListElement as { position: number; item: string }[]
    expect(items.map((i) => i.position)).toEqual([1, 2, 3])
    expect(items.map((i) => i.item)).toEqual([
      'https://havayolu.live/en',
      'https://havayolu.live/en/havalimanlari',
      'https://havayolu.live/en/istasyon/LTFM',
    ])
  })

  it('CollectionPage ana varlık olarak ItemList taşıyabilir', () => {
    const node = webPageNode({
      locale: 'tr',
      path: '/havalimanlari',
      name: 'Havalimanları',
      type: 'CollectionPage',
      mainEntity: itemList([
        { name: 'İstanbul Havalimanı (IST/LTFM)', url: '/istasyon/LTFM' },
        { name: 'Ankara Esenboğa Havalimanı (ESB/LTAC)', url: '/istasyon/LTAC' },
      ]),
    })
    expect(node).toMatchObject({
      '@type': 'CollectionPage',
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: 2,
        itemListElement: [
          { '@type': 'ListItem', position: 1, url: 'https://havayolu.live/istasyon/LTFM' },
          { '@type': 'ListItem', position: 2, url: 'https://havayolu.live/istasyon/LTAC' },
        ],
      },
    })
    expect(node).not.toHaveProperty('breadcrumb')
    expect(node).not.toHaveProperty('dateModified')
  })
})
