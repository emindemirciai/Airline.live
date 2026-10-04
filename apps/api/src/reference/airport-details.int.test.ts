import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  createDb,
  findAirportDetail,
  listAirportDetails,
  listAirportsWithIata,
  listListedAirportDetails,
  listListedAirports,
  runMigrations,
  seedStations,
  syncOurAirports,
  type Database,
  type RunwayInsert,
} from '@havayolu/db'
import { bearingDifference, distanceKm, initialBearing, type LatLon } from '@havayolu/geo'
import { parseAirports, parseRunways, type RunwayRow } from '@havayolu/providers'
import {
  AIRPORT_RING_CONFIG,
  airportCountryName,
  airportName,
  countryName,
  foreignAirportName,
  isForeignCandidate,
  ourAirportsIcao,
  provinceName,
  runwaySurfaceKey,
  type AirportDetail,
  type AirportDetailsResponse,
  type ListedAirportDetailsResponse,
} from '@havayolu/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testApp } from '../test/helpers'
import { AIRPORT_ERRORS, AIRPORTS_CACHE_CONTROL } from './airports'

// Gerçek PostgreSQL (yerelde `pnpm dev:infra`, CI'da dev compose); bu teste ait veritabanı. Veri,
// worker'ın içe aktarımıyla aynı ayrıştırıcıdan geçen commit'li OurAirports alt kümesidir
// (tools/fixtures/README.md: Türkiye'nin bütün kayıtları, birkaç uzak havalimanı, 1., 2. ve 3. halka).
const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_api_airport_details'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../../../../packages/db/drizzle', import.meta.url))
const fixture = (path: string) =>
  readFileSync(new URL(`../../../../tools/fixtures/${path}`, import.meta.url), 'utf8')

let admin: Database
let database: Database

/** Worker'ın `runwayInsert`'iyle aynı açılım (apps/worker/src/jobs/reference.ts). */
function runwayInsert(row: RunwayRow): RunwayInsert {
  const { le, he } = row
  return {
    id: row.id,
    airportId: row.airportId,
    airportIdent: row.airportIdent,
    lengthFt: row.lengthFt,
    widthFt: row.widthFt,
    surface: row.surface,
    lighted: row.lighted,
    endsAreThresholds: row.endsAreThresholds,
    leIdent: le.ident,
    leLatitudeDeg: le.latitudeDeg,
    leLongitudeDeg: le.longitudeDeg,
    leElevationFt: le.elevationFt,
    leHeadingDegT: le.headingDegT,
    leDisplacedThresholdFt: le.displacedThresholdFt,
    leTrueBearingDeg: le.trueBearingDeg,
    leBearingSource: le.bearingSource,
    leHeadingMismatch: le.headingMismatch,
    leThresholdLat: le.thresholdLat,
    leThresholdLon: le.thresholdLon,
    leThresholdSource: le.thresholdSource,
    heIdent: he.ident,
    heLatitudeDeg: he.latitudeDeg,
    heLongitudeDeg: he.longitudeDeg,
    heElevationFt: he.elevationFt,
    heHeadingDegT: he.headingDegT,
    heDisplacedThresholdFt: he.displacedThresholdFt,
    heTrueBearingDeg: he.trueBearingDeg,
    heBearingSource: he.bearingSource,
    heHeadingMismatch: he.headingMismatch,
    heThresholdLat: he.thresholdLat,
    heThresholdLon: he.thresholdLon,
    heThresholdSource: he.thresholdSource,
    rowHash: row.rowHash,
  }
}

const airportRows = parseAirports(fixture('ourairports/airports.csv')).rows
const arps = new Map<number, LatLon>(
  airportRows.map((a) => [a.id, { lat: a.latitudeDeg, lon: a.longitudeDeg }]),
)
const runwayRows = parseRunways(fixture('ourairports/runways.csv'), arps).rows

/**
 * Açık halkaların (1.–3., ≤ 2.000 km; D-090) beklenen ICAO'ları, içe aktarılan satırlardan
 * (veritabanından bağımsız hesap). ICAO kaynak düzeltmeleriyle (İskenderiye HEAX → HEBA).
 */
function expectedListedForeign(): string[] {
  const iata = (row: (typeof airportRows)[number]) => row.iataCode?.trim().toUpperCase() ?? ''
  const listable = ['large_airport', 'medium_airport', 'small_airport']
  const turkey = airportRows
    .filter((r) => r.isoCountry === 'TR' && listable.includes(r.type) && /^[A-Z]{3}$/.test(iata(r)))
    .map((r) => ({ lat: r.latitudeDeg, lon: r.longitudeDeg }))
  return airportRows
    .filter(
      (r) => r.isoCountry !== 'TR' && isForeignCandidate(r.type, r.scheduledService, r.iataCode),
    )
    .filter((r) =>
      turkey.some((tr) => distanceKm({ lat: r.latitudeDeg, lon: r.longitudeDeg }, tr) <= 2000),
    )
    .map((r) => ourAirportsIcao(r))
    .sort()
}

beforeAll(async () => {
  admin = createDb(adminUrl, { max: 1 })
  await admin.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.sql.unsafe(`create database ${testDbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder })
  database = createDb(testUrl, { max: 2 })
  await syncOurAirports(database.db, {
    airports: airportRows,
    runways: runwayRows.map(runwayInsert),
  })
  await seedStations(database.db)
})

afterAll(async () => {
  await database?.sql.end({ timeout: 5 })
  await admin?.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin?.sql.end({ timeout: 5 })
})

async function app() {
  const { app: instance } = await testApp({
    deps: {
      airports: {
        list: (country) => listAirportsWithIata(database.db, country, AIRPORT_RING_CONFIG),
        details: (country) => listAirportDetails(database.db, country, AIRPORT_RING_CONFIG),
        listed: () => listListedAirports(database.db, AIRPORT_RING_CONFIG),
        listedDetails: () => listListedAirportDetails(database.db, AIRPORT_RING_CONFIG),
        find: (code) => findAirportDetail(database.db, code, AIRPORT_RING_CONFIG),
      },
    },
  })
  return instance
}

describe('havalimanı ayrıntıları (gerçek PostgreSQL, OurAirports fixture)', () => {
  it('include=runways: 61 havalimanı, 51 dizinlenebilir, hepsinin açık pisti var', async () => {
    const instance = await app()
    try {
      const res = await instance.inject({
        method: 'GET',
        url: '/v1/airports?country=TR&include=runways',
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['cache-control']).toBe(AIRPORTS_CACHE_CONTROL)
      const body = res.json() as AirportDetailsResponse
      expect(body.country).toBe('TR')
      expect(body.airports).toHaveLength(61)

      const plain = (
        await instance.inject({ method: 'GET', url: '/v1/airports?country=TR' })
      ).json()
      expect(body.airports.map((a) => a.icao)).toEqual(
        (plain as { airports: { icao: string }[] }).airports.map((a) => a.icao),
      )

      // Dizinlenebilir sayfa: tarifeli sefer ya da izlenen istasyon (M6b sözleşmesi).
      const indexable = body.airports.filter((a) => a.scheduled || a.station !== null)
      expect(indexable).toHaveLength(51)
      expect(body.airports.reduce((n, a) => n + a.runways.length, 0)).toBe(79)

      for (const airport of body.airports) {
        expect(airport.runways.length, airport.icao).toBeGreaterThan(0)
        expect(airportName(airport.icao), airport.icao).toBeDefined()
        expect(provinceName(airport.isoRegion, 'tr'), airport.icao).not.toBeNull()
        expect(Number.isNaN(Date.parse(airport.dataUpdatedAt)), airport.icao).toBe(false)
        for (const runway of airport.runways) {
          if (runway.surface !== null) {
            expect(runwaySurfaceKey(runway.surface), `${airport.icao} ${runway.surface}`).not.toBe(
              'unknown',
            )
          }
          for (const end of runway.ends) {
            expect(end.thresholdLat, `${airport.icao} ${end.ident}`).not.toBeNull()
          }
        }
      }

      const stations = body.airports.filter((a) => a.station !== null).map((a) => a.icao)
      expect(stations.sort()).toEqual(['LTAC', 'LTAI', 'LTBJ', 'LTFJ', 'LTFM'])
      const ltfm = body.airports.find((a) => a.icao === 'LTFM')
      expect(ltfm?.station).toEqual({ active: true, primary: true, fetchRadiusNm: 60 })
      expect(body.airports.find((a) => a.icao === 'LTDB')).toMatchObject({
        iata: 'COV',
        isoRegion: 'TR-33',
      })
    } finally {
      await instance.close()
    }
  })

  it('LTFM: 6 pist, pist adına göre sıralı; yönler heading alanından değil koordinatlardan', async () => {
    const details = await listAirportDetails(database.db, 'TR', AIRPORT_RING_CONFIG)
    const ltfm = details.find((a) => a.icao === 'LTFM') as AirportDetail
    expect(ltfm.runways).toHaveLength(6)
    const idents = ltfm.runways.map((r) => r.ends[0].ident)
    expect(idents).toEqual([...idents].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })))

    let mismatched = 0
    for (const runway of ltfm.runways) {
      const source = runwayRows.find((r) => r.id === runway.id)
      expect(source, String(runway.id)).toBeDefined()
      if (source === undefined) continue
      const le = { lat: source.le.latitudeDeg ?? NaN, lon: source.le.longitudeDeg ?? NaN }
      const he = { lat: source.he.latitudeDeg ?? NaN, lon: source.he.longitudeDeg ?? NaN }
      const [low, high] = runway.ends
      expect(bearingDifference(low.trueBearingDeg ?? NaN, initialBearing(le, he))).toBeLessThan(
        0.01,
      )
      expect(bearingDifference(high.trueBearingDeg ?? NaN, initialBearing(he, le))).toBeLessThan(
        0.01,
      )
      if (
        source.le.headingDegT !== null &&
        bearingDifference(low.trueBearingDeg ?? NaN, source.le.headingDegT) > 1
      ) {
        mismatched += 1
      }
    }
    // D-066: dört LTFM pistinin heading alanı koordinat yönünden sapıyor.
    expect(mismatched).toBe(4)
  })

  it('GET /v1/airports/:code: ICAO ya da IATA, büyük/küçük harf fark etmez; kanonik ICAO döner', async () => {
    const instance = await app()
    try {
      const list = (await listAirportDetails(database.db, 'TR', AIRPORT_RING_CONFIG)).find(
        (a) => a.icao === 'LTFM',
      )
      for (const code of ['LTFM', 'ltfm', 'IST', 'ist']) {
        const res = await instance.inject({ method: 'GET', url: `/v1/airports/${code}` })
        expect(res.statusCode, code).toBe(200)
        expect(res.headers['cache-control'], code).toBe(AIRPORTS_CACHE_CONTROL)
        expect(res.json(), code).toEqual(list)
      }
      const cov = await instance.inject({ method: 'GET', url: '/v1/airports/cov' })
      expect((cov.json() as AirportDetail).icao).toBe('LTDB')
      // Adana Şakirpaşa içe aktarılmaz (tarifeli sefer yok); Akıncı'nın IATA kodu yok.
      for (const code of ['LTAF', 'ADA', 'LTAE', 'ZZZZ']) {
        const res = await instance.inject({ method: 'GET', url: `/v1/airports/${code}` })
        expect(res.statusCode, code).toBe(404)
        expect(res.json(), code).toEqual(AIRPORT_ERRORS.notFound)
      }
    } finally {
      await instance.close()
    }
  })

  it('scope=listed&include=runways: 61 Türkiye + 1.–3. halka; yurt dışı adları, ülkeleri, pistleri', async () => {
    const instance = await app()
    try {
      const res = await instance.inject({
        method: 'GET',
        url: '/v1/airports?scope=listed&include=runways',
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['cache-control']).toBe(AIRPORTS_CACHE_CONTROL)
      const body = res.json() as ListedAirportDetailsResponse
      expect(body.scope).toBe('listed')
      const turkish = body.airports.filter((a) => a.country === 'TR')
      const foreign = body.airports.filter((a) => a.country !== 'TR')
      expect(turkish).toHaveLength(61)
      // Beklenen küme içe aktarılan satırlardan bağımsız hesaplanır (halka analizinin kuralı,
      // @havayolu/geo): uzaklık referansı Türkiye'nin içe aktarılmış IATA kodlu alanlarıdır. Bugünkü
      // süzgeçle 1. halka 72; Türkiye'nin IATA kodlu tarifesiz küçük alanları da (Gökçeada …) içe
      // aktarılırsa Priştine, Preveze ve Niş de girer: 75 (D-080; packages/db airports.int.test.ts
      // iki durumu ayrı sınar). 3. halkayla (D-090) 434 ya da 442 (2. halkada 161 ya da 164).
      expect(foreign.map((a) => a.icao).sort()).toEqual(expectedListedForeign())
      expect([434, 442]).toContain(foreign.length)
      expect(body.airports).toHaveLength(61 + foreign.length)

      const plain = (
        await instance.inject({ method: 'GET', url: '/v1/airports?scope=listed' })
      ).json() as { scope: string; airports: { icao: string }[] }
      expect(plain.airports.map((a) => a.icao)).toEqual(body.airports.map((a) => a.icao))

      const ringLimitKm: Record<number, number> = { 1: 500, 2: 1000, 3: 2000 }
      for (const airport of foreign) {
        expect([1, 2, 3], airport.icao).toContain(airport.ring)
        expect(airport.distanceToTrKm, airport.icao).toBeLessThanOrEqual(
          ringLimitKm[airport.ring] ?? 0,
        )
        if (airport.ring === 3) expect(airport.distanceToTrKm, airport.icao).toBeGreaterThan(1000)
        expect(airport.scheduled, airport.icao).toBe(true)
        expect(foreignAirportName(airport.icao), airport.icao).toBeDefined()
        expect(countryName(airport.country, 'tr'), airport.icao).not.toBe(airport.country)
        expect(Number.isNaN(Date.parse(airport.dataUpdatedAt)), airport.icao).toBe(false)
        for (const runway of airport.runways) {
          if (runway.surface !== null) {
            expect(runwaySurfaceKey(runway.surface), `${airport.icao} ${runway.surface}`).not.toBe(
              'unknown',
            )
          }
        }
      }
      // Laçın'ın (UBLC) OurAirports'ta açık pisti yoktur; diğerlerinin hepsinde vardır.
      expect(foreign.filter((a) => a.runways.length === 0).map((a) => a.icao)).toEqual(['UBLC'])
      expect(foreign.every((a) => a.station === null)).toBe(true)
      // Kaynak düzeltmeleri (D-088): İskenderiye HEBA (OurAirports icao_code HEAX); Taba ve Cluj'un
      // yinelenen boş pist satırı gösterilmez; Bacău'nun adındaki çift boşluk teke iner.
      expect(body.airports.find((a) => a.iata === 'HBE')).toMatchObject({ icao: 'HEBA', ring: 2 })
      expect(body.airports.map((a) => a.icao)).not.toContain('HEAX')
      const runwayNames = (icao: string) =>
        body.airports.find((a) => a.icao === icao)?.runways.map((r) => r.ends[0].ident)
      expect(runwayNames('HETB')).toEqual(['04L'])
      expect(runwayNames('LRCL')).toEqual(['07'])
      expect(body.airports.find((a) => a.icao === 'LRBC')?.name).toBe(
        'Bacău George Enescu International Airport',
      )
      // 3. halka (D-090): Voronej ve Linz'in boş pist satırları gizli; Stuttgart'ın karşı ucu
      // olmayan iki helikopter satırı pist sayılmaz; küçük harfli "airport" "Airport" okunur;
      // Özbekistan UZxx koduyla (OurAirports kimliği UTxx).
      expect(runwayNames('UUOO')).toEqual(['12'])
      expect(runwayNames('LOWL')).toEqual(['08', '08E'])
      expect(runwayNames('EDDS')).toEqual(['07'])
      expect(body.airports.find((a) => a.icao === 'LFLW')?.name).toBe('Aurillac Airport')
      expect(body.airports.find((a) => a.iata === 'SKD')).toMatchObject({ icao: 'UZSS', ring: 3 })
      expect(body.airports.find((a) => a.iata === 'VIE')).toMatchObject({
        icao: 'LOWW',
        country: 'AT',
        isoRegion: 'AT-9',
        ring: 3,
        distanceToTrKm: 1149,
      })
      for (const icao of ['EGLL', 'LFPG', 'EHAM', 'LEMD', 'KJFK']) {
        expect(
          body.airports.map((a) => a.icao),
          icao,
        ).not.toContain(icao)
      }
      // Ben Gurion 500,44 km: yanıtta 500 km, halkası 2.
      expect(body.airports.find((a) => a.icao === 'LLBG')).toMatchObject({
        ring: 2,
        distanceToTrKm: 500,
      })

      const lgav = body.airports.find((a) => a.icao === 'LGAV')
      expect(lgav).toMatchObject({
        iata: 'ATH',
        country: 'GR',
        isoRegion: 'GR-I',
        ring: 1,
        distanceToTrKm: 275,
      })
      expect(lgav?.runways.length).toBeGreaterThan(0)
      const lcen = body.airports.find((a) => a.icao === 'LCEN') as AirportDetail
      expect(lcen.country).toBe('CY')
      expect(airportCountryName(lcen, 'tr')).toBe('KKTC')
      expect(airportCountryName(lcen, 'en', 'long')).toBe('Turkish Republic of Northern Cyprus')
    } finally {
      await instance.close()
    }
  })

  it('GET /v1/airports/:code yurt dışı havalimanını da bulur; liste kaydıyla aynı', async () => {
    const instance = await app()
    try {
      const listed = await listListedAirportDetails(database.db, AIRPORT_RING_CONFIG)
      const lgav = listed.find((a) => a.icao === 'LGAV')
      for (const code of ['LGAV', 'lgav', 'ATH']) {
        const res = await instance.inject({ method: 'GET', url: `/v1/airports/${code}` })
        expect(res.statusCode, code).toBe(200)
        expect(res.json(), code).toEqual(lgav)
      }
      const isu = await instance.inject({ method: 'GET', url: '/v1/airports/isu' })
      expect((isu.json() as AirportDetail).icao).toBe('ORSJ')
      // İskenderiye: ICAO HEBA ve IATA HBE ile bulunur; kaynaktaki yanlış kod (HEAX) 404.
      const heba = listed.find((a) => a.icao === 'HEBA')
      for (const code of ['HEBA', 'heba', 'HBE', 'hbe']) {
        const res = await instance.inject({ method: 'GET', url: `/v1/airports/${code}` })
        expect(res.statusCode, code).toBe(200)
        expect(res.json(), code).toEqual(heba)
      }
      const heax = await instance.inject({ method: 'GET', url: '/v1/airports/HEAX' })
      expect(heax.statusCode).toBe(404)
      // Halka süzgeci yok: listede olmayan Londra bulunur ve halkasını taşır.
      const lhr = await instance.inject({ method: 'GET', url: '/v1/airports/LHR' })
      expect(lhr.statusCode).toBe(200)
      expect(lhr.json()).toMatchObject({ icao: 'EGLL', country: 'GB', ring: 4 })
    } finally {
      await instance.close()
    }
  })
})
