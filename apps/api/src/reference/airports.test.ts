import type { Airport, AirportDetail } from '@havayolu/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { testApp } from '../test/helpers'
import {
  AIRPORT_ERRORS,
  AIRPORTS_CACHE_CONTROL,
  AIRPORTS_CACHE_MAX_ENTRIES,
  AIRPORTS_CACHE_MS,
  AIRPORTS_EMPTY_CACHE_MS,
  AIRPORTS_RETRY_MS,
  airportSelection,
} from './airports'

const ist: Airport = {
  icao: 'LTFM',
  iata: 'IST',
  name: 'Istanbul Airport',
  city: 'Istanbul',
  lat: 41.2611,
  lon: 28.7419,
  elevationFt: 325,
  type: 'large_airport',
  scheduled: true,
  country: 'TR',
  ring: 0,
  distanceToTrKm: null,
}
const isl: Airport = {
  icao: 'LTBA',
  iata: 'ISL',
  name: 'İstanbul Atatürk Airport',
  city: null,
  lat: 40.976,
  lon: 28.814,
  elevationFt: null,
  type: 'large_airport',
  scheduled: false,
  country: 'TR',
  ring: 0,
  distanceToTrKm: null,
}

let clock = 1_000_000
const apps: { close(): Promise<unknown> }[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

async function setup(list: ((country: string) => Promise<Airport[]>) | null) {
  const { app } = await testApp({ deps: { airports: { list, now: () => clock } } })
  apps.push(app)
  const get = (url = '/v1/airports') => app.inject({ method: 'GET', url })
  return { app, get }
}

describe('GET /v1/airports', () => {
  it('varsayılan ülke TR; yanıt, önbellek başlığı ve hız sınırı', async () => {
    const list = vi.fn(async () => [isl, ist])
    const { get } = await setup(list)
    const res = await get()
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe(AIRPORTS_CACHE_CONTROL)
    expect(res.headers['x-ratelimit-limit']).toBe('60')
    expect(res.json()).toEqual({ country: 'TR', airports: [isl, ist] })
    expect(list).toHaveBeenCalledWith('TR')
  })

  it('başka ülke ayrı okunur ve ayrı önbelleğe girer', async () => {
    const list = vi.fn(async (country: string) => (country === 'TR' ? [ist] : []))
    const { get } = await setup(list)
    expect((await get('/v1/airports?country=DE')).json()).toEqual({ country: 'DE', airports: [] })
    expect((await get('/v1/airports?country=TR')).json()).toEqual({
      country: 'TR',
      airports: [ist],
    })
    expect(list.mock.calls).toEqual([['DE'], ['TR']])
  })

  it('ülke kodu iki büyük harf değilse 400 bad_country; veritabanına gidilmez', async () => {
    const list = vi.fn(async () => [ist])
    const { get } = await setup(list)
    for (const query of ['tr', 'TUR', '', 'T', 'T1', '1R', 'TR&country=DE', '%20TR']) {
      const res = await get(`/v1/airports?country=${query}`)
      expect(res.statusCode, query).toBe(400)
      expect(res.headers['cache-control'], query).toBe('no-store')
      expect(res.json(), query).toEqual(AIRPORT_ERRORS.badCountry)
    }
    expect(list).not.toHaveBeenCalled()
  })

  it('liste 10 dk önbellekte kalır, sonra yeniden okunur', async () => {
    const list = vi.fn(async () => [ist])
    const { get } = await setup(list)
    await get()
    clock += AIRPORTS_CACHE_MS - 1
    expect((await get()).json()).toEqual({ country: 'TR', airports: [ist] })
    expect(list).toHaveBeenCalledTimes(1)
    clock += 1
    await get()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('boş liste yalnızca 1 dk tutulur (referans verisi henüz içe aktarılmamış olabilir)', async () => {
    const list = vi.fn<(country: string) => Promise<Airport[]>>(async () => [])
    const { get } = await setup(list)
    expect((await get()).json()).toEqual({ country: 'TR', airports: [] })
    clock += AIRPORTS_EMPTY_CACHE_MS - 1
    await get()
    expect(list).toHaveBeenCalledTimes(1)
    list.mockResolvedValue([ist])
    clock += 1
    expect((await get()).json()).toEqual({ country: 'TR', airports: [ist] })
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('okuma başarısız ve kopya yoksa 503 airports_unavailable; sonraki istek yeniden dener', async () => {
    const list = vi
      .fn<(country: string) => Promise<Airport[]>>()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValue([ist])
    const { get } = await setup(list)
    const failed = await get()
    expect(failed.statusCode).toBe(503)
    expect(failed.headers['cache-control']).toBe('no-store')
    expect(failed.json()).toEqual(AIRPORT_ERRORS.unavailable)
    // Sürücü hata metni herkese açık yanıtta yer almaz.
    expect(failed.body).not.toContain('connection refused')
    expect((await get()).statusCode).toBe(200)
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('okuma başarısızsa eski kopya sunulur ve 1 dk yeniden denenmez', async () => {
    const list = vi.fn<(country: string) => Promise<Airport[]>>().mockResolvedValueOnce([ist])
    list.mockRejectedValue(new Error('down'))
    const { get } = await setup(list)
    await get()
    clock += AIRPORTS_CACHE_MS
    const stale = await get()
    expect(stale.statusCode).toBe(200)
    expect(stale.headers['cache-control']).toBe(AIRPORTS_CACHE_CONTROL)
    expect(stale.json()).toEqual({ country: 'TR', airports: [ist] })
    expect(list).toHaveBeenCalledTimes(2)
    clock += AIRPORTS_RETRY_MS - 1
    await get()
    expect(list).toHaveBeenCalledTimes(2)
    clock += 1
    list.mockResolvedValue([isl, ist])
    expect((await get()).json()).toEqual({ country: 'TR', airports: [isl, ist] })
    expect(list).toHaveBeenCalledTimes(3)
  })

  it('eşzamanlı istekler tek okumayı bekler', async () => {
    let resolve: (value: Airport[]) => void = () => undefined
    const list = vi.fn(
      () =>
        new Promise<Airport[]>((r) => {
          resolve = r
        }),
    )
    const { get } = await setup(list)
    const requests = [get(), get(), get()]
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(1))
    resolve([ist])
    for (const res of await Promise.all(requests)) {
      expect(res.json()).toEqual({ country: 'TR', airports: [ist] })
    }
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('veritabanı yoksa 503', async () => {
    const { get } = await setup(null)
    const res = await get()
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual(AIRPORT_ERRORS.unavailable)
  })

  it('yanıt şemayla serileştirilir: fazla alan gönderilmez, null alanlar korunur', async () => {
    const extra = { ...isl, ident: 'LTBA', rowHash: 'x' } as Airport
    const { get } = await setup(async () => [extra])
    expect((await get()).json()).toEqual({ country: 'TR', airports: [isl] })
  })
})

const istDetail: AirportDetail = {
  ...ist,
  nearestTr: null,
  isoRegion: 'TR-34',
  municipality: 'Istanbul',
  station: { active: true, primary: true, fetchRadiusNm: 60 },
  dataUpdatedAt: '2026-09-27T04:40:00.000Z',
  runways: [
    {
      id: 330_001,
      lengthFt: 12_303,
      widthFt: 197,
      surface: 'CONC',
      lighted: true,
      ends: [
        {
          ident: '16L',
          trueBearingDeg: 180.1,
          displacedThresholdFt: null,
          thresholdLat: 41.29,
          thresholdLon: 28.72,
        },
        {
          ident: '34R',
          trueBearingDeg: 0.1,
          displacedThresholdFt: 1_000,
          thresholdLat: 41.26,
          thresholdLon: 28.72,
        },
      ],
    },
  ],
}
const islDetail: AirportDetail = {
  ...isl,
  nearestTr: null,
  isoRegion: 'TR-34',
  municipality: null,
  station: null,
  dataUpdatedAt: '2026-09-20T00:00:00.000Z',
  runways: [],
}

async function setupDetails(options: {
  details?: ((country: string) => Promise<AirportDetail[]>) | null
  find?: ((code: string) => Promise<AirportDetail | null>) | null
  list?: ((country: string) => Promise<Airport[]>) | null
  listed?: (() => Promise<Airport[]>) | null
  listedDetails?: (() => Promise<AirportDetail[]>) | null
  cacheMaxEntries?: number
}) {
  const { app } = await testApp({
    deps: {
      airports: {
        list: options.list ?? null,
        details: options.details,
        listed: options.listed,
        listedDetails: options.listedDetails,
        find: options.find,
        now: () => clock,
        cacheMaxEntries: options.cacheMaxEntries,
      },
    },
  })
  apps.push(app)
  const get = (url: string) => app.inject({ method: 'GET', url })
  return { app, get }
}

describe('GET /v1/airports?include=runways', () => {
  it('ayrıntılı liste ayrı okunur; düz liste ayrıntı alanı taşımaz', async () => {
    const list = vi.fn(async () => [isl, ist])
    const details = vi.fn(async () => [islDetail, istDetail])
    const { get } = await setupDetails({ list, details })
    const res = await get('/v1/airports?country=TR&include=runways')
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(res.headers['cache-control']).toBe(AIRPORTS_CACHE_CONTROL)
    expect(res.headers['x-ratelimit-limit']).toBe('60')
    expect(res.json()).toEqual({ country: 'TR', airports: [islDetail, istDetail] })
    expect(details).toHaveBeenCalledWith('TR')
    expect(list).not.toHaveBeenCalled()

    const plain = await get('/v1/airports?country=TR')
    expect(plain.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(plain.json()).toEqual({ country: 'TR', airports: [isl, ist] })
    expect(details).toHaveBeenCalledTimes(1)
    // Varsayılan ülke de ayrıntılı listeyi önbellekten verir.
    expect((await get('/v1/airports?include=runways')).json()).toEqual({
      country: 'TR',
      airports: [islDetail, istDetail],
    })
    expect(details).toHaveBeenCalledTimes(1)
  })

  it('düz okuyucu ayrıntı döndürse bile düz listede yalnızca Airport alanları gider', async () => {
    const { get } = await setupDetails({ list: async () => [istDetail] })
    expect((await get('/v1/airports')).json()).toEqual({ country: 'TR', airports: [ist] })
  })

  it('bilinmeyen include 400 bad_include; okuyucuya gidilmez', async () => {
    const details = vi.fn(async () => [istDetail])
    const { get } = await setupDetails({ details })
    const queries = [
      'include=',
      'include=pistler',
      'include=RUNWAYS',
      'include=runways&include=runways',
    ]
    for (const query of queries) {
      const res = await get(`/v1/airports?${query}`)
      expect(res.statusCode, query).toBe(400)
      expect(res.headers['cache-control'], query).toBe('no-store')
      expect(res.json(), query).toEqual(AIRPORT_ERRORS.badInclude)
    }
    // Ülke önce denetlenir.
    expect((await get('/v1/airports?country=tr&include=x')).json()).toEqual(
      AIRPORT_ERRORS.badCountry,
    )
    expect(details).not.toHaveBeenCalled()
  })

  it('ayrıntı okuyucusu yoksa 503; okuma başarısızsa eldeki kopya sunulur', async () => {
    const none = await setupDetails({})
    expect((await none.get('/v1/airports?include=runways')).statusCode).toBe(503)
    const details = vi
      .fn<(country: string) => Promise<AirportDetail[]>>()
      .mockResolvedValueOnce([istDetail])
      .mockRejectedValue(new Error('down'))
    const { get } = await setupDetails({ details })
    await get('/v1/airports?include=runways')
    clock += AIRPORTS_CACHE_MS
    const stale = await get('/v1/airports?include=runways')
    expect(stale.statusCode).toBe(200)
    expect(stale.json()).toEqual({ country: 'TR', airports: [istDetail] })
    expect(details).toHaveBeenCalledTimes(2)
  })
})

describe('GET /v1/airports/:code', () => {
  it('kodu büyük harfe çevirip okur; tek AirportDetail, önbellek ve hız sınırı başlıklarıyla', async () => {
    const find = vi.fn(async (code: string) =>
      code === 'LTFM' || code === 'IST' ? istDetail : null,
    )
    const { get } = await setupDetails({ find })
    for (const code of ['LTFM', 'ltfm', 'IST', 'iSt']) {
      const res = await get(`/v1/airports/${code}`)
      expect(res.statusCode, code).toBe(200)
      expect(res.headers['cache-control'], code).toBe(AIRPORTS_CACHE_CONTROL)
      expect(res.headers['x-ratelimit-limit'], code).toBe('60')
      expect(res.json(), code).toEqual(istDetail)
    }
    // Büyük harfe çevrilen aynı kod önbellekten gelir.
    expect(find.mock.calls).toEqual([['LTFM'], ['IST']])
  })

  it('biçimi bozuk kod 400 bad_code; okuyucuya gidilmez', async () => {
    const find = vi.fn(async () => istDetail)
    const { get } = await setupDetails({ find })
    for (const code of ['LT', 'LTFMX', 'LT-M', 'LT%20M', '%C4%B0ST', 'ab_c']) {
      const res = await get(`/v1/airports/${code}`)
      expect(res.statusCode, code).toBe(400)
      expect(res.headers['cache-control'], code).toBe('no-store')
      expect(res.json(), code).toEqual(AIRPORT_ERRORS.badCode)
    }
    expect(find).not.toHaveBeenCalled()
  })

  it('bilinmeyen kod 404 airport_not_found; sonuç 1 dk tutulur', async () => {
    const find = vi.fn<(code: string) => Promise<AirportDetail | null>>(async () => null)
    const { get } = await setupDetails({ find })
    const res = await get('/v1/airports/ZZZZ')
    expect(res.statusCode).toBe(404)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.json()).toEqual(AIRPORT_ERRORS.notFound)
    clock += AIRPORTS_EMPTY_CACHE_MS - 1
    await get('/v1/airports/zzzz')
    expect(find).toHaveBeenCalledTimes(1)
    find.mockResolvedValue(istDetail)
    clock += 1
    expect((await get('/v1/airports/ZZZZ')).statusCode).toBe(200)
    expect(find).toHaveBeenCalledTimes(2)
  })

  it('bulunan havalimanı 10 dk önbellekte kalır', async () => {
    const find = vi.fn(async () => istDetail)
    const { get } = await setupDetails({ find })
    await get('/v1/airports/LTFM')
    clock += AIRPORTS_CACHE_MS - 1
    await get('/v1/airports/LTFM')
    expect(find).toHaveBeenCalledTimes(1)
    clock += 1
    await get('/v1/airports/LTFM')
    expect(find).toHaveBeenCalledTimes(2)
  })

  it('okuyucu yoksa ya da okuma başarısız ve kopya yoksa 503; hata metni sızmaz', async () => {
    const none = await setupDetails({})
    expect((await none.get('/v1/airports/LTFM')).statusCode).toBe(503)
    const find = vi
      .fn<(code: string) => Promise<AirportDetail | null>>()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValue(istDetail)
    const { get } = await setupDetails({ find })
    const failed = await get('/v1/airports/LTFM')
    expect(failed.statusCode).toBe(503)
    expect(failed.headers['cache-control']).toBe('no-store')
    expect(failed.json()).toEqual(AIRPORT_ERRORS.unavailable)
    expect(failed.body).not.toContain('connection refused')
    expect((await get('/v1/airports/LTFM')).statusCode).toBe(200)
  })

  it('önbellek sınırlıdır: sınır aşılınca en eski kod atılır ve yeniden okunur', async () => {
    expect(AIRPORTS_CACHE_MAX_ENTRIES).toBe(1_024)
    const find = vi.fn<(code: string) => Promise<AirportDetail | null>>(async () => null)
    const { get } = await setupDetails({ find, cacheMaxEntries: 3 })
    for (const code of ['AAAA', 'BBBB', 'CCCC', 'DDDD']) await get(`/v1/airports/${code}`)
    expect(find).toHaveBeenCalledTimes(4)
    for (const code of ['BBBB', 'CCCC', 'DDDD']) await get(`/v1/airports/${code}`)
    expect(find).toHaveBeenCalledTimes(4)
    await get('/v1/airports/AAAA')
    expect(find).toHaveBeenCalledTimes(5)
    expect(find).toHaveBeenLastCalledWith('AAAA')
  })

  it('yanıt şemayla serileştirilir: fazla alan gönderilmez, null alanlar korunur', async () => {
    const extra = {
      ...islDetail,
      rowHash: 'x',
      runways: istDetail.runways.map((r) => ({ ...r, airportIdent: 'LTBA', rowHash: 'y' })),
    } as AirportDetail
    const { get } = await setupDetails({ find: async () => extra })
    expect((await get('/v1/airports/LTBA')).json()).toEqual({
      ...islDetail,
      runways: istDetail.runways,
    })
  })
})

const ath: Airport = {
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
}
const athDetail: AirportDetail = {
  ...ath,
  nearestTr: { icao: 'LTBL', iata: 'IGL', name: 'Çiğli Airbase' },
  isoRegion: 'GR-I',
  municipality: 'Spata-Artemida',
  station: null,
  dataUpdatedAt: '2026-10-01T23:03:49.000Z',
  runways: [],
}

describe('GET /v1/airports?scope=listed (D-080)', () => {
  it('listelenen havalimanları: zarfta scope, ülke yok; ayrı önbellek', async () => {
    const list = vi.fn(async () => [ist])
    const listed = vi.fn(async () => [ath, isl, ist])
    const { get } = await setupDetails({ list, listed })
    const res = await get('/v1/airports?scope=listed')
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(res.headers['cache-control']).toBe(AIRPORTS_CACHE_CONTROL)
    expect(res.headers['x-ratelimit-limit']).toBe('60')
    expect(res.json()).toEqual({ scope: 'listed', airports: [ath, isl, ist] })
    expect(listed).toHaveBeenCalledTimes(1)
    expect(list).not.toHaveBeenCalled()
    // Varsayılan (ülke) isteği kendi okuyucusundan gelir.
    expect((await get('/v1/airports')).json()).toEqual({ country: 'TR', airports: [ist] })
    clock += AIRPORTS_CACHE_MS - 1
    await get('/v1/airports?scope=listed')
    expect(listed).toHaveBeenCalledTimes(1)
    clock += 1
    await get('/v1/airports?scope=listed')
    expect(listed).toHaveBeenCalledTimes(2)
  })

  it('include=runways: ayrıntılı liste; düz listede ayrıntı alanı gitmez', async () => {
    const listed = vi.fn(async () => [athDetail, istDetail])
    const listedDetails = vi.fn(async () => [athDetail, istDetail])
    const { get } = await setupDetails({ listed, listedDetails })
    const res = await get('/v1/airports?scope=listed&include=runways')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ scope: 'listed', airports: [athDetail, istDetail] })
    expect(listedDetails).toHaveBeenCalledTimes(1)
    expect((await get('/v1/airports?include=runways&scope=listed')).json()).toEqual(res.json())
    expect(listedDetails).toHaveBeenCalledTimes(1)
    // Düz liste yalnızca Airport alanlarını serileştirir.
    expect((await get('/v1/airports?scope=listed')).json()).toEqual({
      scope: 'listed',
      airports: [ath, ist],
    })
  })

  it('country ile scope birlikte 400 scope_conflict; okuyucuya gidilmez', async () => {
    const list = vi.fn(async () => [ist])
    const listed = vi.fn(async () => [ath])
    const { get } = await setupDetails({ list, listed })
    for (const query of [
      'country=TR&scope=listed',
      'scope=listed&country=GR',
      'country=tr&scope=listed',
      'country=TR&scope=all',
      'country=&scope=listed&include=runways',
    ]) {
      const res = await get(`/v1/airports?${query}`)
      expect(res.statusCode, query).toBe(400)
      expect(res.headers['cache-control'], query).toBe('no-store')
      expect(res.json(), query).toEqual(AIRPORT_ERRORS.scopeConflict)
    }
    expect(list).not.toHaveBeenCalled()
    expect(listed).not.toHaveBeenCalled()
  })

  it('bilinmeyen scope 400 bad_scope; include denetimi ondan sonra', async () => {
    const listed = vi.fn(async () => [ath])
    const { get } = await setupDetails({ listed })
    for (const query of ['scope=', 'scope=all', 'scope=LISTED', 'scope=listed&scope=listed']) {
      const res = await get(`/v1/airports?${query}`)
      expect(res.statusCode, query).toBe(400)
      expect(res.json(), query).toEqual(AIRPORT_ERRORS.badScope)
    }
    expect((await get('/v1/airports?scope=listed&include=x')).json()).toEqual(
      AIRPORT_ERRORS.badInclude,
    )
    expect(listed).not.toHaveBeenCalled()
  })

  it('okuyucu yoksa 503; okuma başarısızsa eldeki kopya sunulur', async () => {
    const none = await setupDetails({ list: async () => [ist] })
    expect((await none.get('/v1/airports?scope=listed')).statusCode).toBe(503)
    expect((await none.get('/v1/airports?scope=listed&include=runways')).statusCode).toBe(503)
    const listed = vi
      .fn<() => Promise<Airport[]>>()
      .mockResolvedValueOnce([ath])
      .mockRejectedValue(new Error('connection refused'))
    const { get } = await setupDetails({ listed })
    await get('/v1/airports?scope=listed')
    clock += AIRPORTS_CACHE_MS
    const stale = await get('/v1/airports?scope=listed')
    expect(stale.statusCode).toBe(200)
    expect(stale.json()).toEqual({ scope: 'listed', airports: [ath] })
    expect(listed).toHaveBeenCalledTimes(2)
  })

  it('boş liste yalnızca 1 dk tutulur', async () => {
    const listed = vi.fn<() => Promise<Airport[]>>(async () => [])
    const { get } = await setupDetails({ listed })
    expect((await get('/v1/airports?scope=listed')).json()).toEqual({
      scope: 'listed',
      airports: [],
    })
    listed.mockResolvedValue([ath])
    clock += AIRPORTS_EMPTY_CACHE_MS
    expect((await get('/v1/airports?scope=listed')).json()).toEqual({
      scope: 'listed',
      airports: [ath],
    })
  })
})

describe('airportSelection', () => {
  it('ülke, kapsam, varsayılan ve hatalar', () => {
    expect(airportSelection(undefined, undefined)).toEqual({ country: 'TR' })
    expect(airportSelection('GR', undefined)).toEqual({ country: 'GR' })
    expect(airportSelection(undefined, 'listed')).toEqual({ scope: 'listed' })
    expect(airportSelection('TR', 'listed')).toEqual({ error: AIRPORT_ERRORS.scopeConflict })
    expect(airportSelection(undefined, 'LISTED')).toEqual({ error: AIRPORT_ERRORS.badScope })
    expect(airportSelection(undefined, ['listed'])).toEqual({ error: AIRPORT_ERRORS.badScope })
    expect(airportSelection('tr', undefined)).toEqual({ error: AIRPORT_ERRORS.badCountry })
    expect(airportSelection(['TR'], undefined)).toEqual({ error: AIRPORT_ERRORS.badCountry })
  })
})
