import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  airportsUrl,
  getAirport,
  getAirports,
  isInLiveCoverage,
  isIndexable,
  isMonitoredStation,
  liveCoveragePlan,
  latestDataUpdate,
  nearestAirports,
  parseAirportsBody,
  resolveAirportCode,
  sameProvinceAirports,
} from './airports'
import { airportFixture } from './test/airport-fixture'
import { fixtureTurkishAirports } from './test/ourairports-fixture'

// `server-only` istemci paketlerinde hata fırlatır; testte sunucu modülü olarak yüklenir.
vi.mock('server-only', () => ({}))

const LTFM = airportFixture({
  icao: 'LTFM',
  iata: 'IST',
  isoRegion: 'TR-34',
  lat: 41.262222,
  lon: 28.727778,
  station: { active: true, primary: true, fetchRadiusNm: 60 },
})
const LTFJ = airportFixture({
  icao: 'LTFJ',
  iata: 'SAW',
  isoRegion: 'TR-34',
  lat: 40.898602,
  lon: 29.3092,
  station: { active: true, primary: false, fetchRadiusNm: 60 },
})
const LTBA = airportFixture({
  icao: 'LTBA',
  iata: 'ISL',
  isoRegion: 'TR-34',
  lat: 40.976898,
  lon: 28.8146,
  scheduled: false,
  dataUpdatedAt: '2026-09-29T04:40:12.000Z',
})
const LTAG = airportFixture({
  icao: 'LTAG',
  iata: 'UAB',
  isoRegion: 'TR-01',
  lat: 37.002102,
  lon: 35.4259,
  scheduled: false,
})
const LTBU = airportFixture({
  icao: 'LTBU',
  iata: 'TEQ',
  isoRegion: 'TR-59',
  lat: 41.1382,
  lon: 27.919,
})
const ALL = [LTFM, LTFJ, LTBA, LTAG, LTBU]

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('airportsUrl', () => {
  it('tek toplu çağrının adresini iç API adresinden kurar', () => {
    expect(airportsUrl('http://api:4000')).toBe(
      'http://api:4000/v1/airports?country=TR&include=runways',
    )
  })
})

describe('parseAirportsBody', () => {
  it('geçerli kayıtları alır, bozuk kaydı atlar, fazla alanı düşürür', () => {
    const extra = { ...LTFM, unexpected: 1 }
    const broken = { ...LTFJ, lat: 'x' }
    const parsed = parseAirportsBody({ country: 'TR', airports: [extra, broken, LTAG] })
    expect(parsed.map((a) => a.icao)).toEqual(['LTFM', 'LTAG'])
    expect(parsed[0]).toEqual(LTFM)
  })

  it('zarf bozuksa hata fırlatır', () => {
    expect(() => parseAirportsBody({ airports: 'none' })).toThrow('unexpected shape')
    expect(() => parseAirportsBody(null)).toThrow()
  })
})

describe('getAirports', () => {
  function stubFetch(...bodies: unknown[]) {
    const calls: { url: string; init: RequestInit & { next?: unknown } }[] = []
    let index = 0
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      const body = bodies[Math.min(index++, bodies.length - 1)]
      return new Response(JSON.stringify(body), { status: 200 })
    })
    return calls
  }

  it('istemci başlığı iletmeden, saatlik önbellek etiketiyle tek istek atar', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000')
    const calls = stubFetch({ country: 'TR', airports: ALL })
    const airports = await getAirports()
    expect(airports).toHaveLength(ALL.length)
    expect(calls).toHaveLength(1)
    const [call] = calls
    expect(call?.url).toBe('http://api.internal:4000/v1/airports?country=TR&include=runways')
    expect(call?.init.next).toEqual({ revalidate: 3600, tags: ['airports'] })
    expect(call?.init.cache).toBeUndefined()
    // Önbellek anahtarı başlıkları içerir: yalnızca sabit başlıklar gönderilir.
    expect(call?.init.headers).toEqual({ accept: 'application/json', 'x-hy-cache-window': '3600' })
  })

  it('saatlik kayıttaki liste boşsa dakikalık önbellek kaydına bakar, önbelleksiz istek atmaz', async () => {
    const calls = stubFetch({ country: 'TR', airports: [] }, { country: 'TR', airports: [LTFM] })
    expect((await getAirports()).map((a) => a.icao)).toEqual(['LTFM'])
    expect(calls).toHaveLength(2)
    const [hourly, minutely] = calls
    expect(minutely?.init.cache).toBeUndefined()
    expect(minutely?.init.next).toEqual({ revalidate: 60, tags: ['airports'] })
    // İki kayıt farklı önbellek anahtarı alır (anahtar başlıkları içerir, `revalidate`'i içermez).
    expect(minutely?.init.headers).not.toEqual(hourly?.init.headers)
    expect(calls.every((call) => call.init.cache !== 'no-store')).toBe(true)
  })

  it('iki kayıt da boşsa boş liste döner (sayfa "henüz yüklenmedi" der)', async () => {
    const calls = stubFetch({ country: 'TR', airports: [] })
    expect(await getAirports()).toEqual([])
    expect(calls).toHaveLength(2)
  })

  it('API hata dönerse hata fırlatır (yumuşak 404 yerine 500)', async () => {
    vi.stubGlobal('fetch', async () => new Response('down', { status: 503 }))
    await expect(getAirports()).rejects.toThrow('HTTP 503')
  })

  it('getAirport ICAO kodunu büyük-küçük harf fark etmeden bulur', async () => {
    stubFetch({ country: 'TR', airports: ALL })
    expect((await getAirport(' ltfj '))?.iata).toBe('SAW')
    expect(await getAirport('ZZZZ')).toBeUndefined()
  })
})

describe('resolveAirportCode', () => {
  it('büyük harfli ICAO kanoniktir', () => {
    expect(resolveAirportCode('LTFM', ALL)).toEqual({ kind: 'found', airport: LTFM })
  })

  it.each([
    ['ltfm', 'LTFM'],
    ['LtFm', 'LTFM'],
    ['IST', 'LTFM'],
    ['ist', 'LTFM'],
    ['saw', 'LTFJ'],
  ])('%s → %s adresine yönlenir', (code, icao) => {
    expect(resolveAirportCode(code, ALL)).toEqual({ kind: 'redirect', icao })
  })

  it.each(['ZZZZ', 'XXX', 'LT', 'LTFMX', 'LT-M', '%E0%A4%A', '', 'İST'])('%s bulunamaz', (code) => {
    expect(resolveAirportCode(code, ALL)).toEqual({ kind: 'not_found' })
  })
})

describe('isIndexable ve isMonitoredStation', () => {
  it('tarifeli ya da istasyon olan havalimanı dizine eklenir', () => {
    expect(isIndexable(LTFM)).toBe(true)
    expect(isIndexable(LTBU)).toBe(true)
    expect(isIndexable(LTAG)).toBe(false)
    expect(
      isIndexable({ ...LTAG, station: { active: false, primary: false, fetchRadiusNm: 60 } }),
    ).toBe(true)
  })

  it('OurAirports tarifeli bayrağı tek ölçüt değildir: resmî adı doğrulanan sivil havalimanı dizine girer', () => {
    const fixture = fixtureTurkishAirports()
    const byIcao = new Map(fixture.map((airport) => [airport.icao, airport]))
    // OurAirports'ta "tarifeli değil" görünen DHMİ havalimanları (Siirt'te AJet ve THY seferleri var).
    for (const icao of ['LTCL', 'LTBQ', 'LTBO', 'LTBA']) {
      const airport = byIcao.get(icao)
      expect(airport?.scheduled, icao).toBe(false)
      expect(airport && isIndexable(airport), icao).toBe(true)
    }
    // Resmî adı doğrulanamayan askerî üsler noindex kalır.
    const hidden = fixture.filter((airport) => !isIndexable(airport)).map((airport) => airport.icao)
    expect(hidden.sort()).toEqual(['LTAD', 'LTAG', 'LTAH', 'LTBG', 'LTBI', 'LTBL'])
    expect(fixture.filter(isIndexable)).toHaveLength(55)
  })

  it('yalnızca etkin istasyon izlenir', () => {
    expect(isMonitoredStation(LTFM)).toBe(true)
    expect(isMonitoredStation(LTBU)).toBe(false)
    expect(
      isMonitoredStation({
        ...LTFJ,
        station: { active: false, primary: false, fetchRadiusNm: 60 },
      }),
    ).toBe(false)
  })
})

describe('liveCoveragePlan ve isInLiveCoverage', () => {
  it('tohum istasyonlarla yalnızca Hakkari Yüksekova çekim alanının dışında kalır', () => {
    const fixture = fixtureTurkishAirports()
    const plan = liveCoveragePlan(fixture)
    expect(plan.map((circle) => circle.id)).toEqual(['west', 'primary', 'east'])
    const outside = fixture.filter((airport) => !isInLiveCoverage(airport, plan))
    expect(outside.map((airport) => airport.icao)).toEqual(['LTCW'])
  })

  it('yalnızca etkin istasyonlar plana girer; istasyon eklenince çevresi kapsanır', () => {
    const fixture = fixtureTurkishAirports()
    const hakkari = fixture.find((airport) => airport.icao === 'LTCW')
    if (!hakkari) throw new Error('fixture has no LTCW')
    const inactive = { ...hakkari, station: { active: false, primary: false, fetchRadiusNm: 60 } }
    const active = { ...hakkari, station: { active: true, primary: false, fetchRadiusNm: 60 } }
    const others = fixture.filter((airport) => airport.icao !== 'LTCW')
    expect(isInLiveCoverage(inactive, liveCoveragePlan([...others, inactive]))).toBe(false)
    expect(isInLiveCoverage(active, liveCoveragePlan([...others, active]))).toBe(true)
    // İstasyon yokken yalnızca Doğu çemberi vardır.
    expect(liveCoveragePlan([]).map((circle) => circle.id)).toEqual(['east'])
  })
})

describe('nearestAirports', () => {
  it('kendisi hariç en yakınları yakından uzağa verir', () => {
    const nearest = nearestAirports(LTFM, ALL, 3)
    expect(nearest.map((n) => n.airport.icao)).toEqual(['LTBA', 'LTFJ', 'LTBU'])
    expect(nearest[0]?.distanceKm).toBeGreaterThan(20)
    expect(nearest[0]?.distanceKm).toBeLessThan(40)
    expect(nearestAirports(LTFM, ALL, 0)).toEqual([])
    expect(nearestAirports(LTFM, [LTFM], 3)).toEqual([])
  })
})

describe('sameProvinceAirports', () => {
  it('aynı ildeki diğer havalimanlarını verir', () => {
    expect(sameProvinceAirports(LTFM, ALL).map((a) => a.icao)).toEqual(['LTBA', 'LTFJ'])
    expect(sameProvinceAirports(LTAG, ALL)).toEqual([])
  })
})

describe('latestDataUpdate', () => {
  it('en yeni değişiklik anını verir', () => {
    expect(latestDataUpdate(ALL)).toBe('2026-09-29T04:40:12.000Z')
    expect(latestDataUpdate([])).toBeNull()
  })
})
