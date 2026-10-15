import { airportNameSource } from '@havayolu/shared'
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
  splitByCountry,
} from './airports'
import { airportFixture } from './test/airport-fixture'
import { fixtureListedAirports, fixtureTurkishAirports } from './test/ourairports-fixture'

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
/** Ad tablosunda olmayan (OurAirports'a sonradan eklenen), tarifesiz Türkiye havalimanı. */
const LTXA = airportFixture({
  icao: 'LTXA',
  iata: 'XXA',
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
/** Yakın ülkelerdeki listelenen havalimanı (D-080): Selanik. */
const LGTS = airportFixture({
  icao: 'LGTS',
  iata: 'SKG',
  isoRegion: 'GR-B',
  country: 'GR',
  ring: 1,
  distanceToTrKm: 263,
  lat: 40.519699,
  lon: 22.9709,
})
const ALL = [LTFM, LTFJ, LTBA, LTXA, LTBU]

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('airportsUrl', () => {
  it('tek toplu çağrının adresini iç API adresinden kurar: listelenen havalimanları (D-080)', () => {
    expect(airportsUrl('http://api:4000')).toBe(
      'http://api:4000/v1/airports?scope=listed&include=runways',
    )
  })
})

describe('parseAirportsBody', () => {
  it('geçerli kayıtları alır, bozuk kaydı atlar, fazla alanı düşürür', () => {
    const extra = { ...LTFM, unexpected: 1 }
    const broken = { ...LTFJ, lat: 'x' }
    const parsed = parseAirportsBody({ country: 'TR', airports: [extra, broken, LTXA] })
    expect(parsed.map((a) => a.icao)).toEqual(['LTFM', 'LTXA'])
    expect(parsed[0]).toEqual(LTFM)
  })

  it('zarf bozuksa hata fırlatır', () => {
    expect(() => parseAirportsBody({ airports: 'none' })).toThrow('unexpected shape')
    expect(() => parseAirportsBody(null)).toThrow()
  })

  it('scope=listed zarfı ülke taşımaz; ülke, halka ve uzaklık kayıtta denetlenir', () => {
    const parsed = parseAirportsBody({ scope: 'listed', airports: [LTFM, LGTS] })
    expect(parsed).toEqual([LTFM, LGTS])
    const { country: _country, ...noCountry } = LGTS
    const badRing = { ...LGTS, ring: -1 }
    const badCountry = { ...LGTS, country: 'Greece' }
    expect(parseAirportsBody({ airports: [noCountry, badRing, badCountry, LGTS] })).toEqual([LGTS])
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
    expect(call?.url).toBe('http://api.internal:4000/v1/airports?scope=listed&include=runways')
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

  it('aynı gövde bir kez ayrıştırılır; gövde değişince yeniden (D-102)', async () => {
    const parse = vi.spyOn(JSON, 'parse')
    try {
      const calls = stubFetch(
        { scope: 'listed', airports: [LTFM, LGTS] },
        { scope: 'listed', airports: [LTFM, LGTS] },
        { scope: 'listed', airports: [LTFM] },
      )
      const first = await getAirports()
      const second = await getAirports()
      expect(calls).toHaveLength(2)
      // Next'in veri önbelleği aynı gövdeyi verdi: JSON ve zod yeniden çalışmaz, dizi aynıdır.
      expect(second).toBe(first)
      expect(parse).toHaveBeenCalledTimes(1)
      const third = await getAirports()
      expect(third).not.toBe(first)
      expect(third.map((a) => a.icao)).toEqual(['LTFM'])
      expect(parse).toHaveBeenCalledTimes(2)
    } finally {
      parse.mockRestore()
    }
    // Bellekte liste varken bozuk zarf yine hata fırlatır.
    stubFetch({ airports: 'none' })
    await expect(getAirports()).rejects.toThrow('unexpected shape')
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

  it.each(['LTAG', 'UAB', 'ltah', 'AFY', 'LTBG', 'bdm', 'LTBI', 'ESK', 'LTBL', 'igl'])(
    'askerî hava üssü %s listede yok: yönlenmez, 404 (D-107)',
    (code) => {
      expect(resolveAirportCode(code, fixtureListedAirports())).toEqual({ kind: 'not_found' })
    },
  )

  it('adres takma adı (D-109): kodu değişen havalimanının eski kodu kanonik ICAO adresine 308', () => {
    const listed = fixtureListedAirports()
    // Özbekistan'ın havalimanları OurAirports kimliğinde eski UTxx kodunu taşır (3. ve 4. halka).
    for (const [code, icao] of [
      ['UTSS', 'UZSS'],
      ['utss', 'UZSS'],
      ['UTTT', 'UZTT'],
      ['LELO', 'LERJ'],
      ['VA1G', 'VERW'],
    ] as const) {
      expect(resolveAirportCode(code, listed), code).toEqual({ kind: 'redirect', icao })
    }
    // 1.–4. halkada 29 takma ad; her biri listelenen bir havalimanınındır ve hiçbir listelenen
    // havalimanının ICAO'su değildir.
    const aliased = listed.filter((airport) => airport.identAlias !== undefined)
    expect(aliased).toHaveLength(29)
    const icaos = new Set(listed.map((airport) => airport.icao))
    for (const airport of aliased) {
      expect(icaos.has(airport.identAlias ?? ''), airport.icao).toBe(false)
      expect(resolveAirportCode(airport.identAlias ?? '', listed)).toEqual({
        kind: 'redirect',
        icao: airport.icao,
      })
    }
    // Listelenmeyen havalimanının takma adı yönlenmez (5. halka kapalı: Lima SPIM → SPJC, Palm
    // Beach KPBI → KDJT); başka bir satırın ICAO'su olan kimlik takma ad değildir (WABP).
    for (const code of ['SPIM', 'KPBI', 'WABP']) {
      expect(resolveAirportCode(code, listed), code).toEqual({ kind: 'not_found' })
    }
  })

  it('ICAO takma addan önce gelir; takma ad yalnız dört karakterli koddadır', () => {
    const uzss = { ...LTFM, icao: 'UZSS', iata: 'SKD', identAlias: 'UTSS' }
    const other = { ...LTFM, icao: 'UTSS', iata: 'XXX' }
    expect(resolveAirportCode('UTSS', [uzss, other])).toEqual({ kind: 'found', airport: other })
    expect(resolveAirportCode('UTSS', [uzss])).toEqual({ kind: 'redirect', icao: 'UZSS' })
    expect(resolveAirportCode('UTS', [uzss])).toEqual({ kind: 'not_found' })
  })
})

describe('isIndexable ve isMonitoredStation', () => {
  it('tarifeli ya da istasyon olan havalimanı dizine eklenir', () => {
    expect(isIndexable(LTFM)).toBe(true)
    expect(isIndexable(LTBU)).toBe(true)
    expect(isIndexable(LTXA)).toBe(false)
    expect(
      isIndexable({ ...LTXA, station: { active: false, primary: false, fetchRadiusNm: 60 } }),
    ).toBe(true)
  })

  it('yakın ülkelerdeki listelenen havalimanları aday kuralı gereği tarifeli ya da kapanış tablosundadır ve dizine girer (D-110)', () => {
    const foreign = fixtureListedAirports().filter((airport) => airport.country !== 'TR')
    expect(foreign.length).toBeGreaterThan(70)
    expect(foreign.every(isIndexable)).toBe(true)
    // Savaş nedeniyle kapalı 23 havalimanı OurAirports'ta tarifesizdir; kapanış tablosu "arkasında
    // durabildiğimiz veri"dir (D-076), sayfa tarife vaat etmez.
    const unscheduled = foreign.filter((airport) => !airport.scheduled)
    expect(unscheduled).toHaveLength(23)
    expect(unscheduled.map((airport) => airport.icao)).toEqual(
      expect.arrayContaining(['UKBB', 'UKLL', 'URRP', 'FZMA']),
    )
    expect(unscheduled.every(isIndexable)).toBe(true)
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
    // Ankara (Etimesgut) resmî adı bakanlıktan doğrulanan sivil havalimanıdır ve tarifesiz olsa da
    // dizine girer (D-084). Askerî hava üsleri listede yoktur (D-107): listelenen 56 Türkiye
    // havalimanının hepsi dizine girer.
    const ltad = byIcao.get('LTAD')
    expect(ltad?.scheduled).toBe(false)
    expect(ltad && isIndexable(ltad)).toBe(true)
    expect(fixture).toHaveLength(56)
    expect(fixture.filter(isIndexable)).toHaveLength(56)
    for (const icao of ['LTAG', 'LTAH', 'LTBG', 'LTBI', 'LTBL'])
      expect(byIcao.has(icao)).toBe(false)
  })

  it('tabloda olmayan (OurAirports’a sonradan eklenen) Türkiye havalimanı yalnız tarifeliyse ya da istasyonsa dizine girer (D-076, D-084)', () => {
    const added = airportFixture({ icao: 'LTZZ', iata: 'YZG', scheduled: false })
    expect(airportNameSource(added.icao)).toBe('ourairports')
    expect(isIndexable(added)).toBe(false)
    expect(isIndexable({ ...added, scheduled: true })).toBe(true)
    expect(
      isIndexable({ ...added, station: { active: false, primary: false, fetchRadiusNm: 60 } }),
    ).toBe(true)
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

  it('en yakınlar Türkiye ve yakın ülkeleri karışık içerebilir (Sakız)', () => {
    const listed = fixtureListedAirports()
    const chios = listed.find((airport) => airport.icao === 'LGHI')
    if (!chios) throw new Error('fixture has no LGHI')
    const nearest = nearestAirports(chios, listed, 3).map((n) => n.airport.country)
    expect(nearest).toContain('TR')
    expect(nearest).toContain('GR')
  })
})

describe('sameProvinceAirports', () => {
  it('aynı ildeki diğer havalimanlarını verir', () => {
    expect(sameProvinceAirports(LTFM, ALL).map((a) => a.icao)).toEqual(['LTBA', 'LTFJ'])
    expect(sameProvinceAirports(LTXA, ALL)).toEqual([])
  })

  it('yalnızca Türkiye’de: yabancı havalimanında boş, Türkiye’de yabancı kayıt karışmaz', () => {
    const sameRegion = { ...LGTS, icao: 'LGXX', iata: 'XXG' }
    expect(sameProvinceAirports(LGTS, [...ALL, LGTS, sameRegion])).toEqual([])
    const fakeTr = { ...LGTS, isoRegion: 'TR-34' }
    expect(sameProvinceAirports(LTFM, [...ALL, fakeTr]).map((a) => a.icao)).toEqual([
      'LTBA',
      'LTFJ',
    ])
  })
})

describe('splitByCountry', () => {
  it('liste Türkiye ve diğer ülkeler olarak ayrılır, sıra korunur', () => {
    const { turkey, foreign } = splitByCountry([LGTS, LTFM, LTFJ])
    expect(turkey.map((a) => a.icao)).toEqual(['LTFM', 'LTFJ'])
    expect(foreign.map((a) => a.icao)).toEqual(['LGTS'])
  })
})

describe('nearestTr (API verisi; sayfada satır yok, D-106)', () => {
  it('yabancı havalimanının API verisi: Türkiye’deki en yakın havalimanı askerî üs değildir (D-107)', () => {
    const listed = fixtureListedAirports()
    const byIcao = (icao: string) => {
      const airport = listed.find((a) => a.icao === icao)
      if (!airport) throw new Error(`fixture has no ${icao}`)
      return airport
    }
    // Atina: İzmir Adnan Menderes, 284 km; Çiğli üssü (275 km) uzaklık referansı değildir (D-107).
    expect(byIcao('LGAV')).toMatchObject({
      distanceToTrKm: 284,
      nearestTr: { icao: 'LTBJ', iata: 'ADB' },
    })
    // Hiçbir yabancı havalimanının en yakını askerî üs değildir.
    for (const airport of listed) {
      expect(['LTAG', 'LTAH', 'LTBG', 'LTBI', 'LTBL'], airport.icao).not.toContain(
        airport.nearestTr?.icao,
      )
    }
    // Selanik ve Priştine: en yakın IATA kodlu Türkiye havalimanı Gökçeada (listelenmez, D-080).
    for (const icao of ['LGTS', 'BKPR']) {
      expect(byIcao(icao).nearestTr, icao).toEqual({
        icao: 'LTFK',
        iata: 'GKD',
        name: 'Gökçeada Airport',
      })
    }
    expect(byIcao('LTFM').nearestTr).toBeNull()
  })
})

describe('latestDataUpdate', () => {
  it('en yeni değişiklik anını verir', () => {
    expect(latestDataUpdate(ALL)).toBe('2026-09-29T04:40:12.000Z')
    expect(latestDataUpdate([])).toBeNull()
  })
})
