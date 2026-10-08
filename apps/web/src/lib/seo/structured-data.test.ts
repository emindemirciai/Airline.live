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

  it('yakın ülkelerdeki havalimanı: il yok, ülke ISO kodu, sayfadaki şehir adı (Atina, D-080)', () => {
    const athens = airportFixture({
      icao: 'LGAV',
      iata: 'ATH',
      name: 'Athens Eleftherios Venizelos International Airport',
      isoRegion: 'GR-I',
      municipality: 'Spata-Artemida',
      country: 'GR',
      ring: 1,
      distanceToTrKm: 275,
    })
    expect(airportNode(athens, 'tr')).toMatchObject({
      name: 'Atina Eleftherios Venizelos Havalimanı',
      alternateName: 'Athens Eleftherios Venizelos International Airport',
      iataCode: 'ATH',
      icaoCode: 'LGAV',
      address: {
        '@type': 'PostalAddress',
        // Sayfadaki "Hizmet verdiği yerleşim"; OurAirports yerleşimi ("Spata-Artemida") değil.
        addressLocality: 'Atina',
        addressCountry: 'GR',
      },
      hasMap: 'https://havayolu.live/?havalimani=LGAV',
    })
    expect(airportNode(athens, 'en').address).not.toHaveProperty('addressRegion')
    expect(airportNode(athens, 'en')).toMatchObject({
      name: 'Athens Eleftherios Venizelos International Airport',
      address: { addressLocality: 'Athens', addressCountry: 'GR' },
    })
    // 4. halka (D-102): küratörlü şehir iki dilde.
    const heathrow = airportFixture({
      icao: 'EGLL',
      isoRegion: 'GB-ENG',
      municipality: 'London',
      country: 'GB',
      ring: 4,
    })
    expect(airportNode(heathrow, 'tr').address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Londra',
      addressCountry: 'GB',
    })
    expect(airportNode(heathrow, 'en').address).toMatchObject({ addressLocality: 'London' })
    // Tabloda olmayan yabancı havalimanı (5. halka): Türkçe sayfada yerleşim yazılmaz, İngilizcede
    // temizse yazılır.
    const jfk = airportFixture({
      icao: 'KJFK',
      isoRegion: 'US-NY',
      municipality: 'New York',
      country: 'US',
      ring: 5,
    })
    expect(airportNode(jfk, 'tr').address).toEqual({
      '@type': 'PostalAddress',
      addressCountry: 'US',
    })
    expect(airportNode(jfk, 'en').address).toMatchObject({ addressLocality: 'New York' })
  })

  it('Ercan (LCEN): gösterilen ülke KKTC, ISO kodu yok; addressCountry yazılmaz (CY yazılmaz)', () => {
    const ercan = airportFixture({
      icao: 'LCEN',
      iata: 'ECN',
      name: 'Ercan International Airport',
      isoRegion: 'CY-02',
      municipality: 'Tymbou (Kirklar)',
      country: 'CY',
      ring: 1,
      distanceToTrKm: 168,
    })
    for (const [locale, city] of [
      ['tr', 'Lefkoşa'],
      ['en', 'North Nicosia'],
    ] as const) {
      const node = airportNode(ercan, locale)
      // Ülke kodu yazılmaz; adreste yalnızca sayfadaki şehir adı kalır.
      expect(node.address, locale).toEqual({ '@type': 'PostalAddress', addressLocality: city })
      expect(JSON.stringify(node), locale).not.toContain('"CY"')
    }
    const pristina = airportFixture({ icao: 'BKPR', country: 'XK', isoRegion: 'XK-01' })
    expect(airportNode(pristina, 'tr').address).toMatchObject({ addressCountry: 'XK' })
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
