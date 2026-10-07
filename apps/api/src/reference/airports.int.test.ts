import { fileURLToPath } from 'node:url'
import {
  airports,
  createDb,
  listAirportsWithIata,
  listListedAirportDetails,
  listListedAirports,
  runMigrations,
  type AirportInsert,
  type Database,
} from '@havayolu/db'
import { AIRPORT_RING_CONFIG } from '@havayolu/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testApp } from '../test/helpers'
import { AIRPORT_ERRORS, AIRPORTS_CACHE_CONTROL } from './airports'

// Gerçek PostgreSQL (yerelde `pnpm dev:infra`, CI'da dev compose); bu teste ait veritabanı.
const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_api_airports'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../../../../packages/db/drizzle', import.meta.url))

let admin: Database
let database: Database
let databaseClosed = false

const airport = (
  id: number,
  ident: string,
  iata: string | null,
  overrides: Partial<AirportInsert> = {},
): AirportInsert => ({
  id,
  ident,
  type: 'large_airport',
  name: `${ident} Airport`,
  latitudeDeg: 41,
  longitudeDeg: 29,
  elevationFt: 100,
  isoCountry: 'TR',
  isoRegion: 'TR-34',
  municipality: 'Istanbul',
  scheduledService: true,
  icaoCode: ident,
  iataCode: iata,
  gpsCode: ident,
  rowHash: `${id}`,
  ...overrides,
})

beforeAll(async () => {
  admin = createDb(adminUrl, { max: 1 })
  await admin.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.sql.unsafe(`create database ${testDbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder })
  database = createDb(testUrl, { max: 2 })
  await database.db.insert(airports).values([
    airport(1, 'LTFJ', 'SAW'),
    airport(2, 'LTFM', 'IST', { latitudeDeg: 41.2611, longitudeDeg: 28.7419, elevationFt: 325 }),
    // Askerî hava üssü (D-107): tabloda durur, hiçbir listede yoktur.
    airport(3, 'LTBL', 'IGL', {
      icaoCode: null,
      type: 'medium_airport',
      scheduledService: false,
    }),
    airport(4, 'LTAE', null, { type: 'medium_airport', municipality: null }),
    airport(5, 'LTHX', 'HXX', { type: 'heliport' }),
    airport(6, 'EGLL', 'LHR', {
      isoCountry: 'GB',
      isoRegion: 'GB-ENG',
      municipality: 'London',
      latitudeDeg: 51.4706,
      longitudeDeg: -0.461941,
    }),
    // Yurt dışı: 1. halkada aday (Dedeağaç, en yakın test satırına 238 km); aday olmayan küçük ve tarifesiz
    // orta havalimanı.
    airport(7, 'LGAL', 'AXD', {
      type: 'medium_airport',
      isoCountry: 'GR',
      isoRegion: 'GR-A',
      municipality: 'Alexandroupolis',
      latitudeDeg: 40.855869,
      longitudeDeg: 25.956264,
    }),
    airport(8, 'LGXS', 'XSA', {
      type: 'small_airport',
      isoCountry: 'GR',
      isoRegion: 'GR-A',
      latitudeDeg: 40.9,
      longitudeDeg: 26,
    }),
    airport(9, 'LGXM', 'XMA', {
      type: 'medium_airport',
      scheduledService: false,
      isoCountry: 'GR',
      isoRegion: 'GR-A',
      latitudeDeg: 40.9,
      longitudeDeg: 26.1,
    }),
  ])
})

afterAll(async () => {
  if (!databaseClosed) await database?.sql.end({ timeout: 5 })
  await admin?.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin?.sql.end({ timeout: 5 })
})

describe('GET /v1/airports (gerçek PostgreSQL)', () => {
  it('scope=listed: Türkiye ve 1.–4. halkadaki yurt dışı adayları; pistli liste aynı sırada', async () => {
    const { app } = await testApp({
      deps: {
        airports: {
          list: (country) => listAirportsWithIata(database.db, country, AIRPORT_RING_CONFIG),
          listed: () => listListedAirports(database.db, AIRPORT_RING_CONFIG),
          listedDetails: () => listListedAirportDetails(database.db, AIRPORT_RING_CONFIG),
        },
      },
    })
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/airports?scope=listed' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { scope: string; airports: Record<string, unknown>[] }
      expect(body.scope).toBe('listed')
      expect(body).not.toHaveProperty('country')
      expect(body.airports.map((a) => [a.iata, a.icao, a.country, a.ring])).toEqual([
        ['AXD', 'LGAL', 'GR', 1],
        ['IST', 'LTFM', 'TR', 0],
        // Londra 4. halkada (LTFM'ye 2.489 km); M6i.2'den (D-102) beri açık halkadadır.
        ['LHR', 'EGLL', 'GB', 4],
        ['SAW', 'LTFJ', 'TR', 0],
      ])
      expect(body.airports[0]?.distanceToTrKm).toBe(238)
      expect(body.airports[1]?.distanceToTrKm).toBeNull()
      const detailed = await app.inject({
        method: 'GET',
        url: '/v1/airports?scope=listed&include=runways',
      })
      const details = detailed.json() as { scope: string; airports: Record<string, unknown>[] }
      expect(details.scope).toBe('listed')
      expect(details.airports.map((a) => a.icao)).toEqual(body.airports.map((a) => a.icao))
      expect(details.airports[0]).toMatchObject({ isoRegion: 'GR-A', runways: [], station: null })
      const conflict = await app.inject({
        method: 'GET',
        url: '/v1/airports?scope=listed&country=TR',
      })
      expect(conflict.statusCode).toBe(400)
      expect(conflict.json()).toEqual(AIRPORT_ERRORS.scopeConflict)
    } finally {
      await app.close()
    }
  })

  it('IATA kodlu havalimanlarını sıralı döner; veritabanı kapanınca önbellekteki kopya sunulur', async () => {
    const { app } = await testApp({
      deps: {
        airports: {
          list: (country) => listAirportsWithIata(database.db, country, AIRPORT_RING_CONFIG),
        },
      },
    })
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/airports' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['cache-control']).toBe(AIRPORTS_CACHE_CONTROL)
      const body = res.json() as { country: string; airports: Record<string, unknown>[] }
      expect(body.country).toBe('TR')
      expect(body.airports.map((a) => [a.iata, a.icao, a.type])).toEqual([
        ['IST', 'LTFM', 'large_airport'],
        ['SAW', 'LTFJ', 'large_airport'],
      ])
      expect(body.airports[0]).toEqual({
        icao: 'LTFM',
        iata: 'IST',
        name: 'LTFM Airport',
        city: 'Istanbul',
        lat: 41.2611,
        lon: 28.7419,
        elevationFt: 325,
        type: 'large_airport',
        scheduled: true,
        country: 'TR',
        ring: 0,
        distanceToTrKm: null,
      })
      const gb = await app.inject({ method: 'GET', url: '/v1/airports?country=GB' })
      // Ülke isteğinde halka süzgeci yoktur; kayıt halkasını taşır (Londra 4. halkada).
      expect(
        (gb.json() as { airports: { iata: string; ring: number }[] }).airports.map((a) => [
          a.iata,
          a.ring,
        ]),
      ).toEqual([['LHR', 4]])

      await database.sql.end({ timeout: 5 })
      databaseClosed = true
      const cached = await app.inject({ method: 'GET', url: '/v1/airports?country=TR' })
      expect(cached.statusCode).toBe(200)
      expect(cached.json()).toEqual(body)
      const uncached = await app.inject({ method: 'GET', url: '/v1/airports?country=DE' })
      expect(uncached.statusCode).toBe(503)
      expect(uncached.json()).toEqual(AIRPORT_ERRORS.unavailable)
    } finally {
      await app.close()
    }
  })
})
