import { fileURLToPath } from 'node:url'
import {
  airports,
  createDb,
  listAirportsWithIata,
  runMigrations,
  type AirportInsert,
  type Database,
} from '@havayolu/db'
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
    airport(3, 'LTBL', 'IGL', {
      icaoCode: null,
      type: 'medium_airport',
      scheduledService: false,
    }),
    airport(4, 'LTAE', null, { type: 'medium_airport', municipality: null }),
    airport(5, 'LTHX', 'HXX', { type: 'heliport' }),
    airport(6, 'EGLL', 'LHR', { isoCountry: 'GB', isoRegion: 'GB-ENG', municipality: 'London' }),
  ])
})

afterAll(async () => {
  if (!databaseClosed) await database?.sql.end({ timeout: 5 })
  await admin?.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin?.sql.end({ timeout: 5 })
})

describe('GET /v1/airports (gerçek PostgreSQL)', () => {
  it('IATA kodlu havalimanlarını sıralı döner; veritabanı kapanınca önbellekteki kopya sunulur', async () => {
    const { app } = await testApp({
      deps: { airports: { list: (country) => listAirportsWithIata(database.db, country) } },
    })
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/airports' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['cache-control']).toBe(AIRPORTS_CACHE_CONTROL)
      const body = res.json() as { country: string; airports: Record<string, unknown>[] }
      expect(body.country).toBe('TR')
      expect(body.airports.map((a) => [a.iata, a.icao, a.type])).toEqual([
        ['IGL', 'LTBL', 'medium_airport'],
        ['IST', 'LTFM', 'large_airport'],
        ['SAW', 'LTFJ', 'large_airport'],
      ])
      expect(body.airports[1]).toEqual({
        icao: 'LTFM',
        iata: 'IST',
        name: 'LTFM Airport',
        city: 'Istanbul',
        lat: 41.2611,
        lon: 28.7419,
        elevationFt: 325,
        type: 'large_airport',
        scheduled: true,
      })
      const gb = await app.inject({ method: 'GET', url: '/v1/airports?country=GB' })
      expect((gb.json() as { airports: { iata: string }[] }).airports.map((a) => a.iata)).toEqual([
        'LHR',
      ])

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
