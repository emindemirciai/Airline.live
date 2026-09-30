import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { listAirportsWithIata } from './airports'
import { createDb, type Database } from './client'
import { runMigrations } from './migrate'
import type { AirportInsert } from './reference'
import { airports } from './schema'

const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_db_airports'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))
const airportsFixture = fileURLToPath(
  new URL('../../../tools/fixtures/ourairports/airports.csv', import.meta.url),
)

const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined })
let database: Database

beforeAll(async () => {
  await admin.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.unsafe(`create database ${testDbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder })
  database = createDb(testUrl, { max: 2 })
})

afterAll(async () => {
  await database?.sql.end({ timeout: 5 })
  await admin.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.end({ timeout: 5 })
})

beforeEach(async () => {
  await database.sql`truncate airports cascade`
})

const orNull = (value: string | undefined) => (value === undefined || value === '' ? null : value)

/**
 * OurAirports airports.csv fixture'ı: her alan tırnaklı, ayraç `","`. Worker'ın içe aktarım
 * süzgeci uygulanır (büyük ve orta havalimanları ile tarifeli sefer alanlar; data-sources.md §3).
 */
function readFixture(): AirportInsert[] {
  const [header = '', ...lines] = readFileSync(airportsFixture, 'utf8').split(/\r?\n/)
  const columns = header.slice(1, -1).split('","')
  const records = lines
    .filter(Boolean)
    .map((line) => {
      const values = line.slice(1, -1).split('","')
      return new Map(columns.map((column, i) => [column, values[i] ?? '']))
    })
    .filter(
      (r) =>
        r.get('type') === 'large_airport' ||
        r.get('type') === 'medium_airport' ||
        r.get('scheduled_service') === 'yes',
    )
  return records.map((r) => ({
    id: Number(r.get('id')),
    ident: r.get('ident') ?? '',
    type: r.get('type') ?? '',
    name: r.get('name') ?? '',
    latitudeDeg: Number(r.get('latitude_deg')),
    longitudeDeg: Number(r.get('longitude_deg')),
    elevationFt: r.get('elevation_ft') ? Number(r.get('elevation_ft')) : null,
    isoCountry: r.get('iso_country') ?? '',
    isoRegion: r.get('iso_region') ?? '',
    municipality: orNull(r.get('municipality')),
    scheduledService: r.get('scheduled_service') === 'yes',
    icaoCode: orNull(r.get('icao_code')),
    iataCode: orNull(r.get('iata_code')),
    gpsCode: orNull(r.get('gps_code')),
    rowHash: `fixture:${r.get('id')}`,
  }))
}

const extra = (id: number, overrides: Partial<AirportInsert>): AirportInsert => ({
  id,
  ident: `TR-${id}`,
  type: 'small_airport',
  name: `Test ${id}`,
  latitudeDeg: 39,
  longitudeDeg: 35,
  elevationFt: null,
  isoCountry: 'TR',
  isoRegion: 'TR-06',
  municipality: null,
  scheduledService: false,
  icaoCode: null,
  iataCode: null,
  gpsCode: null,
  rowHash: `extra:${id}`,
  ...overrides,
})

describe('listAirportsWithIata', () => {
  it('tablo boşken liste boş', async () => {
    expect(await listAirportsWithIata(database.db, 'TR')).toEqual([])
  })

  it("fixture: Türkiye'nin 68 havalimanından IATA kodlu 61'i, IATA sırasıyla", async () => {
    const rows = readFixture()
    expect(rows.filter((r) => r.isoCountry === 'TR')).toHaveLength(68)
    await database.db.insert(airports).values(rows)

    const list = await listAirportsWithIata(database.db, 'TR')
    expect(list).toHaveLength(61)
    const codes = list.map((a) => a.iata)
    expect(codes).toEqual([...codes].sort())
    expect(new Set(list.map((a) => a.icao)).size).toBe(61)
    expect(codes).toEqual(expect.arrayContaining(['IST', 'SAW', 'ESB', 'ADB', 'AYT', 'ISL']))
    for (const airport of list) {
      expect(airport.iata).toMatch(/^[A-Z]{3}$/)
      expect(['large_airport', 'medium_airport', 'small_airport']).toContain(airport.type)
    }

    const ltfm = rows.find((r) => r.ident === 'LTFM')
    expect(list.find((a) => a.iata === 'IST')).toEqual({
      icao: 'LTFM',
      iata: 'IST',
      name: ltfm?.name,
      city: ltfm?.municipality,
      lat: ltfm?.latitudeDeg,
      lon: ltfm?.longitudeDeg,
      elevationFt: ltfm?.elevationFt,
      type: 'large_airport',
      scheduled: true,
    })
    // icao_code'u boş kayıt: ICAO gps_code'dan gelir.
    expect(list.find((a) => a.iata === 'IGL')?.icao).toBe('LTBL')
    // Tarifeli seferi olmayan Atatürk de listelenir.
    expect(list.find((a) => a.iata === 'ISL')).toMatchObject({ icao: 'LTBA', scheduled: false })
    // IATA kodu olmayan askeri alanlar yoktur.
    expect(list.map((a) => a.icao)).not.toContain('LTAE')

    expect((await listAirportsWithIata(database.db, 'GB')).map((a) => a.iata)).toEqual(['LHR'])
    expect((await listAirportsWithIata(database.db, 'US')).map((a) => a.iata)).toEqual(['JFK'])
    expect(await listAirportsWithIata(database.db, 'ZZ')).toEqual([])
  })

  it('heliport, kapalı alan ve boş IATA süzülür; ICAO yoksa ident kullanılır', async () => {
    await database.db
      .insert(airports)
      .values([
        extra(900_001, { type: 'heliport', iataCode: 'HPX', icaoCode: 'LTHP' }),
        extra(900_002, { type: 'closed', iataCode: 'CLX', icaoCode: 'LTCL' }),
        extra(900_003, { iataCode: '   ', icaoCode: 'LTBK' }),
        extra(900_004, { iataCode: 'smx' }),
        extra(900_005, { iataCode: 'MDX', type: 'medium_airport', gpsCode: 'LTGP' }),
        extra(900_006, { iataCode: 'FRX', isoCountry: 'FR', icaoCode: 'LFXX' }),
      ])
    const list = await listAirportsWithIata(database.db, 'TR')
    expect(list.map((a) => [a.iata, a.icao, a.type])).toEqual([
      ['MDX', 'LTGP', 'medium_airport'],
      ['SMX', 'TR-900004', 'small_airport'],
    ])
  })
})
