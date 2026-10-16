import { readFileSync } from 'node:fs'
import { mapShownAirports, toAirportMapEntry, type AirportDetail } from '@havayolu/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../lib/live/api'
import {
  AIRPORT_LIST_LIMIT,
  airportLinkCenter,
  airportsInView,
  fetchAirportRunways,
  fetchMapAirports,
  mapAirportsUrl,
  runwaySummary,
  toMapAirport,
  type MapAirport,
} from './airport-data'

/**
 * `GET /v1/airports/<kod>` (ya da `?scope=listed&include=runways`) kaydı (AirportDetail + listelenme
 * alanları, D-080), kısaltılmış pist uçlarıyla.
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
  it('haritanın alanlarını alır; istasyon ve veri tarihi tutulmaz, bozuk pist ucu atlanır', () => {
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
      runways: [
        { lengthFt: 12303, ends: [] },
        { lengthFt: 13451, ends: [] },
        { lengthFt: null, ends: [] },
      ],
    })
  })

  it('pist uçlarından ad, yön ve eşik tutulur (uçak listesinin pist hizası, D-085)', () => {
    // OurAirports runways.csv, LTFM 17R/35L (eşikler API'de kaydırılmış eşikle gelir).
    const end35L = {
      ident: '35L',
      trueBearingDeg: 359.1,
      displacedThresholdFt: null,
      thresholdLat: 41.26190185546875,
      thresholdLon: 28.725299835205078,
      elevationFt: 310,
    }
    const end17R = {
      ...end35L,
      ident: ' 17R ',
      trueBearingDeg: 179.1,
      thresholdLat: 41.29880142211914,
      thresholdLon: 28.72450065612793,
    }
    const airport = toMapAirport({
      ...IST_DETAIL,
      runways: [{ id: 7, lengthFt: 13451, widthFt: 197, ends: [end35L, end17R] }],
    })
    expect(airport?.runways).toEqual([
      {
        lengthFt: 13451,
        ends: [
          { ident: '35L', trueBearingDeg: 359.1, lat: 41.26190185546875, lon: 28.725299835205078 },
          { ident: '17R', trueBearingDeg: 179.1, lat: 41.29880142211914, lon: 28.72450065612793 },
        ],
      },
    ])
  })

  it('pist ucu hoşgörüyle okunur: uç alanı yoksa alan yazılmaz (D-111), dizi değilse boş liste; yönü ya da eşiği bozuk uç atlanır', () => {
    const end = { ident: '35L', trueBearingDeg: 359.1, thresholdLat: 41.26, thresholdLon: 28.72 }
    const runways = (ends: unknown) =>
      toMapAirport({ ...IST_DETAIL, runways: [{ lengthFt: 13451, ends }] })?.runways
    // Haritanın listesi 4. halkadan itibaren uçları taşımaz: alan yok, uçlar istek üzerine gelir.
    expect(runways(undefined)).toEqual([{ lengthFt: 13451 }])
    expect(runways(undefined)?.[0]).not.toHaveProperty('ends')
    expect(runways(null)).toEqual([{ lengthFt: 13451, ends: [] }])
    expect(
      runways([
        end,
        { ...end, trueBearingDeg: null },
        { ...end, trueBearingDeg: Number.NaN },
        { ...end, thresholdLat: null },
        { ...end, thresholdLat: 91 },
        { ...end, thresholdLon: '28.72' },
        { ...end, thresholdLon: -181 },
        'bozuk',
        { ...end, ident: null },
      ]),
    ).toEqual([
      {
        lengthFt: 13451,
        ends: [
          { ident: '35L', trueBearingDeg: 359.1, lat: 41.26, lon: 28.72 },
          { ident: '', trueBearingDeg: 359.1, lat: 41.26, lon: 28.72 },
        ],
      },
    ])
  })

  it('yakın ülkedeki havalimanı ülke koduyla gelir (D-080)', () => {
    const athens = toMapAirport(ATH_DETAIL)
    expect(athens?.country).toBe('GR')
    expect(athens?.ring).toBe(1)
    expect(athens?.distanceToTrKm).toBe(275)
    expect(athens?.isoRegion).toBe('GR-I')
    expect(athens?.runways).toEqual([{ lengthFt: 13123, ends: [] }])
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

  it('haritanın kaydı (include=map, D-111): ortak `toAirportMapEntry` çıktısı okunur; uçlar yalnız 1.–3. halkada', () => {
    const end = (ident: string, trueBearingDeg: number) => ({
      ident,
      trueBearingDeg,
      displacedThresholdFt: null,
      thresholdLat: 41.26,
      thresholdLon: 28.72,
    })
    const detail = (ring: number): AirportDetail => ({
      ...(IST_DETAIL as unknown as AirportDetail),
      identAlias: 'LTXX',
      nearestTr: null,
      runways: [
        {
          id: 7,
          lengthFt: 13451,
          widthFt: 197,
          surface: 'ASP',
          lighted: true,
          ends: [end('35L', 359.1), end('17R', 179.1)],
        },
      ],
      ring,
    })
    const wire = (ring: number): unknown =>
      JSON.parse(JSON.stringify(toAirportMapEntry(detail(ring))))
    const near = toMapAirport(wire(3))
    expect(near).toMatchObject({ icao: 'LTFM', ring: 3, identAlias: 'LTXX', isoRegion: 'TR-34' })
    expect(near?.runways).toEqual([
      {
        lengthFt: 13451,
        ends: [
          { ident: '35L', trueBearingDeg: 359.1, lat: 41.26, lon: 28.72 },
          { ident: '17R', trueBearingDeg: 179.1, lat: 41.26, lon: 28.72 },
        ],
      },
    ])
    const far = toMapAirport(wire(4))
    expect(far).toMatchObject({ icao: 'LTFM', ring: 4, municipality: 'Arnavutköy' })
    expect(far?.runways).toEqual([{ lengthFt: 13451 }])
  })

  it('adres takma adı (D-109) aramada tam kod için tutulur; yoksa ya da bozuksa alan yazılmaz', () => {
    expect(toMapAirport({ ...ATH_DETAIL, identAlias: 'UTSS' })?.identAlias).toBe('UTSS')
    expect(toMapAirport(ATH_DETAIL)).not.toHaveProperty('identAlias')
    for (const identAlias of ['utss', 'UTS', 'UTSSX', 42, null]) {
      const airport = toMapAirport({ ...ATH_DETAIL, identAlias })
      expect(airport?.icao, String(identAlias)).toBe('LGAV')
      expect(airport, String(identAlias)).not.toHaveProperty('identAlias')
    }
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
    // Haritanın kaydı (D-111): pencerenin alanları ve pist uzunlukları, uçlar 1.–3. halkada.
    expect(String(url)).toBe('http://localhost:4100/v1/airports?scope=listed&include=map')
    expect(init?.signal).toBe(controller.signal)
    expect(String(mapAirportsUrl('https://api.airline.live'))).toBe(
      'https://api.airline.live/v1/airports?scope=listed&include=map',
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

describe('fetchAirportRunways (istek üzerine pist uçları, D-111)', () => {
  it('tek havalimanı ucundan pistleri uçlarıyla alır', async () => {
    const end = { ident: '04L', trueBearingDeg: 31, thresholdLat: 40.62, thresholdLon: -73.79 }
    const fetchMock = mockFetch(200, {
      ...ATH_DETAIL,
      icao: 'KJFK',
      iata: 'JFK',
      country: 'US',
      ring: 5,
      isoRegion: 'US-NY',
      runways: [{ id: 9, lengthFt: 12079, ends: [end, { ...end, ident: '22R' }] }],
    })
    const controller = new AbortController()
    const runways = await fetchAirportRunways('http://localhost:4100', 'KJFK', controller.signal)
    expect(runways).toEqual([
      {
        lengthFt: 12079,
        ends: [
          { ident: '04L', trueBearingDeg: 31, lat: 40.62, lon: -73.79 },
          { ident: '22R', trueBearingDeg: 31, lat: 40.62, lon: -73.79 },
        ],
      },
    ])
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('http://localhost:4100/v1/airports/KJFK')
    expect(init?.signal).toBe(controller.signal)
  })

  it('başarısız, bozuk ya da başka havalimanının yanıtı null; kesilen istek fırlatır', async () => {
    mockFetch(404, { error: 'airport_not_found' })
    expect(await fetchAirportRunways('http://localhost:4100', 'KJFK')).toBeNull()
    mockFetch(200, '<html>')
    expect(await fetchAirportRunways('http://localhost:4100', 'KJFK')).toBeNull()
    mockFetch(200, ATH_DETAIL)
    expect(await fetchAirportRunways('http://localhost:4100', 'KJFK')).toBeNull()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('aborted', 'AbortError')
      }),
    )
    const controller = new AbortController()
    controller.abort()
    await expect(
      fetchAirportRunways('http://localhost:4100', 'KJFK', controller.signal),
    ).rejects.toThrow('aborted')
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

  it('180. meridyen (D-111): 179,5° D ve −179,5°’de z5 kamera Fiji, Tonga, Samoa ve Wallis’i listeler', () => {
    // MapLibre'nin sınırları sarılmamıştır: 1280×800 görünüm, z5'te dünya 512 × 2^5 px; batı ve doğu
    // kameranın ortasından ±640 px (±14,06°). 179,5° D'de doğu sınırı 193,56°'dir, −179,5°'de batı
    // sınırı −193,56°.
    const pacific = [
      airport('NAN', -17.755, 177.443),
      airport('TBU', -21.241, -175.15),
      airport('APW', -13.83, -172.008),
      airport('WLS', -13.238, -176.199),
      airport('IST', 41.275, 28.752),
    ]
    const halfSpan = (640 / (512 * 2 ** 5)) * 360
    const view = (centerLon: number) => ({
      bounds: {
        minLon: centerLon - halfSpan,
        minLat: -26,
        maxLon: centerLon + halfSpan,
        maxLat: -8,
      },
      center: { lat: -17, lon: centerLon },
    })
    // Uzaklık kameranın dünya kopyasında ölçülür (Tonga 179,5° D'den 5,35° doğuda, 354,65° batıda değil).
    expect(airportsInView(pacific, view(179.5)).map((a) => a.iata)).toEqual([
      'NAN',
      'WLS',
      'TBU',
      'APW',
    ])
    expect(airportsInView(pacific, view(-179.5)).map((a) => a.iata)).toEqual([
      'NAN',
      'WLS',
      'TBU',
      'APW',
    ])
    // Sınırın dışındaki boylam (−165°, 179,5° D'den 15,5° doğuda) listelenmez.
    expect(airportsInView([airport('XXX', -17, -165)], view(179.5))).toEqual([])
    // Dünyanın tamamını kapsayan görünüm her boylamı alır.
    expect(
      airportsInView(pacific, {
        bounds: { minLon: -300, minLat: -85, maxLon: 300, maxLat: 85 },
        center: { lat: 0, lon: 0 },
      }),
    ).toHaveLength(5)
  })
})

describe('askerî hava üsleri haritada yok (D-103, D-107)', () => {
  const airport = (
    icao: string,
    iata: string,
    lat: number,
    lon: number,
    country = 'TR',
  ): MapAirport => ({
    icao,
    iata,
    name: iata,
    city: null,
    lat,
    lon,
    elevationFt: null,
    type: 'medium_airport',
    scheduled: icao !== 'LTBL',
    country,
    ring: country === 'TR' ? 0 : 1,
    distanceToTrKm: country === 'TR' ? null : 300,
    isoRegion: `${country}-35`,
    municipality: null,
    runways: [],
  })
  // İzmir: Adnan Menderes (sivil) ve Çiğli Hava Üssü (askerî), 27 km arayla; Ankara (Etimesgut)
  // sivil adlıdır (kullanıcı kararı 2026-10-03); Bağdat ortak sivil-askerî ama tarifeli, sivildir.
  const IST = airport('LTFM', 'IST', 41.2753, 28.7519)
  const ANK = airport('LTAD', 'ANK', 39.9498, 32.6886)
  const ADB = airport('LTBJ', 'ADB', 38.2924, 27.157)
  const BGW = airport('ORBI', 'BGW', 33.2625, 44.2346, 'IQ')
  const UAB = airport('LTAG', 'UAB', 37.002, 35.4259)
  const AFY = airport('LTAH', 'AFY', 38.7264, 30.6011)
  const BDM = airport('LTBG', 'BDM', 40.318, 27.9777)
  const ESK = airport('LTBI', 'ESK', 39.7841, 30.5821)
  const IGL = airport('LTBL', 'IGL', 38.513, 27.010099)
  const civil = [IST, ANK, ADB, BGW]
  const bases = [UAB, AFY, BDM, ESK, IGL]
  const all = [IST, ANK, UAB, AFY, ADB, BDM, ESK, IGL, BGW]

  it('savunma süzgeci (API listesinde üs yok, D-107) beş askerî üssü çıkarır, öbürlerini sırasıyla tutar', () => {
    expect(all).toHaveLength(9)
    expect(mapShownAirports(all).map((a) => a.icao)).toEqual(['LTFM', 'LTAD', 'LTBJ', 'ORBI'])
    expect(mapShownAirports(civil)).toEqual(civil)
    expect(mapShownAirports(bases)).toEqual([])
    expect(mapShownAirports([])).toEqual([])
  })

  it('İzmir görünümünün "Havalimanları" listesinde ADB var, Çiğli (IGL) yok', () => {
    const izmir = {
      bounds: { minLon: 26.5, minLat: 38, maxLon: 27.5, maxLat: 38.9 },
      center: { lat: IGL.lat, lon: IGL.lon },
    }
    // Süzgeçsiz liste Çiğli'yi ortada, ilk sırada gösterirdi.
    expect(airportsInView(all, izmir).map((a) => a.iata)).toEqual(['IGL', 'ADB'])
    expect(airportsInView(mapShownAirports(all), izmir).map((a) => a.iata)).toEqual(['ADB'])
  })

  it('?havalimani= haritanın listesinde aranır: askerî üs (ICAO ya da IATA) bilinmeyen kod gibidir (D-107)', () => {
    // Canlı harita API listesini yüklerken savunma süzgecinden geçirir; eski bir liste üs taşısa da
    // `?havalimani=<üs>` haritayı oraya götürmez, açılış görünümü kalır.
    const shown = mapShownAirports(all)
    for (const code of [
      'LTBL',
      'IGL',
      'LTAG',
      'UAB',
      'LTAH',
      'AFY',
      'LTBG',
      'BDM',
      'LTBI',
      'ESK',
    ]) {
      expect(airportLinkCenter(shown, code), code).toBeNull()
    }
    expect(airportLinkCenter(shown, 'LTBJ')).toEqual({ lat: ADB.lat, lon: ADB.lon })
    expect(airportLinkCenter(shown, 'ADB')).toEqual({ lat: ADB.lat, lon: ADB.lon })
    expect(airportLinkCenter(shown, 'ZZZZ')).toBeNull()
    expect(airportLinkCenter([], 'LTBL')).toBeNull()
  })

  it('canlı harita listeyi yüklerken süzer; pinler, pencere, liste, ?havalimani= ve uçak listesi aynı listeyi kullanır', () => {
    const source = readFileSync(new URL('./live-map.tsx', import.meta.url), 'utf8')
    expect(source).toContain('const list = mapShownAirports(loaded)')
    expect(source).toContain('setAirports(list)')
    expect(source).toContain('airportLinkCenter(list, code)')
    expect(source).toContain('useFlightPhases(store, airports, config.apiBaseUrl)')
    expect(source).not.toContain('shownAirports')
  })
})
