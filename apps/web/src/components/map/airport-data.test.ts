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

/** `GET /v1/airports?country=TR&include=runways` kaydı (AirportDetail), kısaltılmış pist uçlarıyla. */
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
      isoRegion: 'TR-34',
      municipality: 'Arnavutköy',
      runways: [{ lengthFt: 12303 }, { lengthFt: 13451 }, { lengthFt: null }],
    })
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
  it('pistlerle tek istek atar; bozuk kayıtları atlar', async () => {
    const fetchMock = mockFetch(200, { country: 'TR', airports: [IST_DETAIL, { icao: 'LTXX' }] })
    const controller = new AbortController()
    const airports = await fetchMapAirports('http://localhost:4100', controller.signal)
    expect(airports.map((airport) => airport.icao)).toEqual(['LTFM'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('http://localhost:4100/v1/airports?country=TR&include=runways')
    expect(init?.signal).toBe(controller.signal)
    expect(String(mapAirportsUrl('https://api.havayolu.live', 'CY'))).toBe(
      'https://api.havayolu.live/v1/airports?country=CY&include=runways',
    )
  })

  it('2xx olmayan, JSON olmayan ya da zarfı bozuk yanıtta ApiError fırlatır', async () => {
    mockFetch(503, { error: 'reference_unavailable' })
    await expect(fetchMapAirports('http://localhost:4100')).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
    })
    mockFetch(200, '<html>')
    await expect(fetchMapAirports('http://localhost:4100')).rejects.toBeInstanceOf(ApiError)
    mockFetch(200, { country: 'TR', airports: null })
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

  it('en fazla sınır kadar', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      airport(`A${String(i).padStart(2, '0')}`, 41, 28 + i * 0.01),
    )
    expect(airportsInView(many, viewport)).toHaveLength(AIRPORT_LIST_LIMIT)
    expect(airportsInView(many, viewport, 3)).toHaveLength(3)
    expect(airportsInView([], viewport)).toEqual([])
  })
})
