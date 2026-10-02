import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../lib/live/api'
import {
  AIRPORT_LIST_LIMIT,
  airportsInView,
  fetchMapAirports,
  mapAirportsUrl,
  runwaySummary,
  toMapAirport,
  type MapAirport,
} from './airport-data'

/**
 * `GET /v1/airports?scope=listed&include=runways` kaydı (AirportDetail + listelenme alanları, D-080),
 * kısaltılmış pist uçlarıyla.
 */
const IST_DETAIL = {
  icao: 'LTFM',
  iata: 'IST',
  name: 'Istanbul Airport',
  city: 'Istanbul',
  lat: 41.2753,
  lon: 28.7519,
  elevationFt: 325,
  type: 'large_airport',
  scheduled: true,
  country: 'TR',
  ring: 0,
  distanceToTrKm: null,
  isoRegion: 'TR-34',
  municipality: 'Arnavutköy',
  station: { active: true, primary: true, fetchRadiusNm: 60 },
  dataUpdatedAt: '2026-09-29T03:00:00.000Z',
  runways: [
    { id: 1, lengthFt: 12303, widthFt: 197, surface: 'ASP', lighted: true, ends: [{}, {}] },
    { id: 2, lengthFt: 13451, widthFt: 197, surface: 'ASP', lighted: true, ends: [{}, {}] },
    { id: 3, lengthFt: null, widthFt: null, surface: null, lighted: false, ends: [{}, {}] },
  ],
}

/** Yakın ülkedeki listelenen havalimanı (1. halka): Atina, en yakın Türkiye havalimanına 275 km. */
const ATH_DETAIL = {
  icao: 'LGAV',
  iata: 'ATH',
  name: 'Athens Eleftherios Venizelos International Airport',
  city: 'Spata-Artemida',
  lat: 37.936401,
  lon: 23.9445,
  elevationFt: 308,
  type: 'large_airport',
  scheduled: true,
  country: 'GR',
  ring: 1,
  distanceToTrKm: 275,
  isoRegion: 'GR-I',
  municipality: 'Spata-Artemida',
  station: null,
  dataUpdatedAt: '2026-10-01T23:03:49.000Z',
  runways: [
    { id: 4, lengthFt: 13123, widthFt: 148, surface: 'ASP', lighted: true, ends: [{}, {}] },
  ],
}

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async (_url: URL, _init?: RequestInit) =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('toMapAirport', () => {
  it('haritanın alanlarını alır; istasyon, pist uçları ve veri tarihi tutulmaz', () => {
    expect(toMapAirport(IST_DETAIL)).toEqual({
      icao: 'LTFM',
      iata: 'IST',
      name: 'Istanbul Airport',
      city: 'Istanbul',
      lat: 41.2753,
      lon: 28.7519,
      elevationFt: 325,
      type: 'large_airport',
      scheduled: true,
      country: 'TR',
      ring: 0,
      distanceToTrKm: null,
      isoRegion: 'TR-34',
      municipality: 'Arnavutköy',
      runways: [{ lengthFt: 12303 }, { lengthFt: 13451 }, { lengthFt: null }],
    })
  })

  it('yakın ülkedeki havalimanı ülke koduyla gelir (D-080)', () => {
    const athens = toMapAirport(ATH_DETAIL)
    expect(athens?.country).toBe('GR')
    expect(athens?.ring).toBe(1)
    expect(athens?.distanceToTrKm).toBe(275)
    expect(athens?.isoRegion).toBe('GR-I')
    expect(athens?.runways).toEqual([{ lengthFt: 13123 }])
  })

  it('halka ve uzaklık: halkadan önceki API’de Türkiye 0; yurt dışında halkasız ya da bozuk kayıt düşer', () => {
    const { ring: _ring, distanceToTrKm: _distance, ...turkeyOld } = IST_DETAIL
    expect(toMapAirport(turkeyOld)).toMatchObject({ ring: 0, distanceToTrKm: null })
    const { ring: _foreignRing, ...athensWithoutRing } = ATH_DETAIL
    expect(toMapAirport(athensWithoutRing)).toBeNull()
    expect(toMapAirport({ ...ATH_DETAIL, ring: -1 })).toBeNull()
    expect(toMapAirport({ ...ATH_DETAIL, ring: 1.5 })).toBeNull()
    expect(toMapAirport({ ...ATH_DETAIL, distanceToTrKm: '275' })).toBeNull()
    expect(toMapAirport({ ...ATH_DETAIL, distanceToTrKm: -3 })).toBeNull()
    expect(toMapAirport({ ...ATH_DETAIL, distanceToTrKm: null })?.distanceToTrKm).toBeNull()
  })

  it('ülke alanı yoksa (önceki API) bölge kodunun önekinden; geçersiz ülke reddedilir', () => {
    const { country: _country, ...withoutCountry } = ATH_DETAIL
    expect(toMapAirport(withoutCountry)?.country).toBe('GR')
    expect(toMapAirport({ ...withoutCountry, country: null })?.country).toBe('GR')
    expect(toMapAirport({ ...ATH_DETAIL, country: 'gr' })).toBeNull()
    expect(toMapAirport({ ...ATH_DETAIL, country: 'GRC' })).toBeNull()
    expect(toMapAirport({ ...withoutCountry, isoRegion: 'bilinmiyor' })).toBeNull()
  })

  it('pistsiz ya da ayrıntısız (eski API) kayıt ve bozuk pist reddedilir', () => {
    const { runways: _runways, ...withoutRunways } = IST_DETAIL
    expect(toMapAirport(withoutRunways)).toBeNull()
    expect(toMapAirport({ ...IST_DETAIL, isoRegion: 34 })).toBeNull()
    expect(toMapAirport({ ...IST_DETAIL, municipality: undefined })).toBeNull()
    expect(toMapAirport({ ...IST_DETAIL, runways: [{ lengthFt: '4100' }] })).toBeNull()
    expect(toMapAirport({ ...IST_DETAIL, lat: Number.NaN })).toBeNull()
    expect(toMapAirport(null)).toBeNull()
  })

  it('sıfır ya da eksi pist uzunluğu bilinmiyor sayılır, kayıt düşmez', () => {
    const airport = toMapAirport({ ...IST_DETAIL, runways: [{ lengthFt: 0 }, { lengthFt: -5 }] })
    expect(airport?.runways).toEqual([{ lengthFt: null }, { lengthFt: null }])
  })
})

describe('runwaySummary', () => {
  it('pist sayısı ve uzunluğu bilinen en uzun pist', () => {
    expect(runwaySummary([{ lengthFt: 9250 }, { lengthFt: null }, { lengthFt: 13451 }])).toEqual({
      count: 3,
      longestFt: 13451,
    })
    expect(runwaySummary([{ lengthFt: null }])).toEqual({ count: 1, longestFt: null })
    expect(runwaySummary([])).toEqual({ count: 0, longestFt: null })
  })
})

describe('fetchMapAirports', () => {
  it('listelenen havalimanlarını pistlerle tek istekte alır; bozuk kayıtları atlar', async () => {
    const fetchMock = mockFetch(200, {
      scope: 'listed',
      airports: [IST_DETAIL, ATH_DETAIL, { icao: 'LTXX' }],
    })
    const controller = new AbortController()
    const airports = await fetchMapAirports('http://localhost:4100', controller.signal)
    expect(airports.map((airport) => airport.icao)).toEqual(['LTFM', 'LGAV'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('http://localhost:4100/v1/airports?scope=listed&include=runways')
    expect(init?.signal).toBe(controller.signal)
    expect(String(mapAirportsUrl('https://api.havayolu.live'))).toBe(
      'https://api.havayolu.live/v1/airports?scope=listed&include=runways',
    )
  })

  it('zarfın kapsam alanı ne olursa olsun `airports` dizisi okunur', async () => {
    mockFetch(200, { country: 'TR', airports: [IST_DETAIL] })
    const airports = await fetchMapAirports('http://localhost:4100')
    expect(airports.map((airport) => airport.icao)).toEqual(['LTFM'])
  })

  it('2xx olmayan, JSON olmayan ya da zarfı bozuk yanıtta ApiError fırlatır', async () => {
    mockFetch(503, { error: 'reference_unavailable' })
    await expect(fetchMapAirports('http://localhost:4100')).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
    })
    mockFetch(200, '<html>')
    await expect(fetchMapAirports('http://localhost:4100')).rejects.toBeInstanceOf(ApiError)
    mockFetch(200, { scope: 'listed', airports: null })
    await expect(fetchMapAirports('http://localhost:4100')).rejects.toBeInstanceOf(ApiError)
    mockFetch(200, [IST_DETAIL])
    await expect(fetchMapAirports('http://localhost:4100')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('airportsInView (Havalimanları listesi, klavye yolu)', () => {
  const airport = (iata: string, lat: number, lon: number): MapAirport => ({
    icao: `LT${iata.slice(0, 2)}`,
    iata,
    name: iata,
    city: null,
    lat,
    lon,
    elevationFt: null,
    type: 'medium_airport',
    scheduled: true,
    country: 'TR',
    ring: 0,
    distanceToTrKm: null,
    isoRegion: 'TR-34',
    municipality: null,
    runways: [],
  })
  const viewport = {
    bounds: { minLon: 27.5, minLat: 40.5, maxLon: 30, maxLat: 42 },
    center: { lat: 41.2753, lon: 28.7519 },
  }

  it('yalnızca görünümdekiler, ortaya yakın önce', () => {
    const list = airportsInView(
      [
        airport('ESB', 40.128, 32.995),
        airport('SAW', 40.898, 29.309),
        airport('IST', 41.275, 28.752),
        airport('TEQ', 41.138, 27.919),
      ],
      viewport,
    )
    expect(list.map((a) => a.iata)).toEqual(['IST', 'SAW', 'TEQ'])
  })

  it('yakın ülke havalimanları da listelenir (Ege: Midilli, Edremit, Sakız)', () => {
    const greek = (icao: string, distanceToTrKm: number) => ({
      icao,
      country: 'GR',
      ring: 1,
      distanceToTrKm,
      isoRegion: 'GR-K',
    })
    const aegean = {
      bounds: { minLon: 25.5, minLat: 38, maxLon: 27.5, maxLat: 39.8 },
      center: { lat: 39, lon: 26.5 },
    }
    const list = airportsInView(
      [
        { ...airport('MJT', 39.057, 26.598), ...greek('LGMT', 65) },
        airport('EDO', 39.555, 27.014),
        { ...airport('JKH', 38.343, 26.141), ...greek('LGHI', 78) },
        airport('IST', 41.275, 28.752),
      ],
      aegean,
    )
    expect(list.map((a) => a.iata)).toEqual(['MJT', 'EDO', 'JKH'])
  })

  it('en fazla sınır kadar', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      airport(`A${String(i).padStart(2, '0')}`, 41, 28 + i * 0.01),
    )
    expect(airportsInView(many, viewport)).toHaveLength(AIRPORT_LIST_LIMIT)
    expect(airportsInView(many, viewport, 3)).toHaveLength(3)
    expect(airportsInView([], viewport)).toEqual([])
  })
})
