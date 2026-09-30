import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  createDb,
  findAirportDetail,
  listAirportDetails,
  listAirportsWithIata,
  runMigrations,
  seedStations,
  syncOurAirports,
  type Database,
  type RunwayInsert,
} from '@havayolu/db'
import { bearingDifference, initialBearing, type LatLon } from '@havayolu/geo'
import { parseAirports, parseRunways, type RunwayRow } from '@havayolu/providers'
import {
  airportName,
  provinceName,
  runwaySurfaceKey,
  type AirportDetail,
  type AirportDetailsResponse,
} from '@havayolu/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testApp } from '../test/helpers'
import { AIRPORT_ERRORS, AIRPORTS_CACHE_CONTROL } from './airports'

// Gerçek PostgreSQL (yerelde `pnpm dev:infra`, CI'da dev compose); bu teste ait veritabanı. Veri,
// worker'ın içe aktarımıyla aynı ayrıştırıcıdan geçen commit'li OurAirports alt kümesidir
// (tools/fixtures/README.md: Türkiye'nin bütün kayıtları).
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
        list: (country) => listAirportsWithIata(database.db, country),
        details: (country) => listAirportDetails(database.db, country),
        find: (code) => findAirportDetail(database.db, code),
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
    const details = await listAirportDetails(database.db, 'TR')
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
      const list = (await listAirportDetails(database.db, 'TR')).find((a) => a.icao === 'LTFM')
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
})
