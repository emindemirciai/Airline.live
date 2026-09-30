import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { findAirportDetail, listAirportDetails, listAirportsWithIata } from './airports'
import { createDb, type Database } from './client'
import { runMigrations } from './migrate'
import type { AirportInsert, RunwayInsert } from './reference'
import { airports, runwayOverrides, runways, stations } from './schema'

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
  await database.sql`truncate airports, runway_overrides, stations cascade`
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

const at = (iso: string) => new Date(iso)

const runway = (
  id: number,
  airportId: number,
  leIdent: string,
  heIdent: string,
  overrides: Partial<RunwayInsert> = {},
): RunwayInsert => ({
  id,
  airportId,
  airportIdent: 'LTFM',
  lengthFt: 10_000,
  widthFt: 150,
  surface: 'ASP',
  lighted: true,
  leIdent,
  leLatitudeDeg: 41.3,
  leLongitudeDeg: 28.7,
  leElevationFt: 300,
  leHeadingDegT: 170,
  leDisplacedThresholdFt: null,
  leTrueBearingDeg: 175,
  leBearingSource: 'coordinates',
  leThresholdLat: 41.3,
  leThresholdLon: 28.7,
  leThresholdSource: 'runway_end',
  heIdent,
  heLatitudeDeg: 41.25,
  heLongitudeDeg: 28.75,
  heElevationFt: 310,
  heHeadingDegT: 350,
  heDisplacedThresholdFt: 1_000,
  heTrueBearingDeg: 355,
  heBearingSource: 'coordinates',
  heThresholdLat: 41.26,
  heThresholdLon: 28.74,
  heThresholdSource: 'displaced_threshold',
  rowHash: `runway:${id}`,
  updatedAt: at('2026-09-02T00:00:00Z'),
  ...overrides,
})

describe('listAirportDetails', () => {
  it('fixture: listeyle aynı 61 havalimanı; pisti olmayanın listesi boş, tarih havalimanınınki', async () => {
    await database.db
      .insert(airports)
      .values(readFixture().map((r) => ({ ...r, updatedAt: at('2026-09-01T00:00:00Z') })))
    const details = await listAirportDetails(database.db, 'TR')
    const list = await listAirportsWithIata(database.db, 'TR')
    expect(details).toHaveLength(61)
    expect(details.map((d) => d.icao)).toEqual(list.map((a) => a.icao))
    for (const detail of details) {
      expect(detail.isoRegion).toMatch(/^TR-\d{2}$/)
      expect(detail.municipality).toBe(detail.city)
      expect(detail.station).toBeNull()
      expect(detail.runways).toEqual([])
      expect(detail.dataUpdatedAt).toBe('2026-09-01T00:00:00.000Z')
    }
    expect(details.find((d) => d.icao === 'LTDB')).toMatchObject({
      iata: 'COV',
      isoRegion: 'TR-33',
      municipality: 'Tarsus',
    })
    expect(await listAirportDetails(database.db, 'ZZ')).toEqual([])
  })

  it('pistler sıralı; düzeltme alan alan uygulanır; istasyon ve en yeni değişiklik tarihi', async () => {
    await database.db
      .insert(airports)
      .values([
        extra(1, { ident: 'LTFM', icaoCode: 'LTFM', iataCode: 'IST', type: 'large_airport' }),
        extra(2, { ident: 'LTFJ', icaoCode: 'LTFJ', iataCode: 'SAW', type: 'large_airport' }),
      ])
    await database.db
      .update(airports)
      .set({ updatedAt: at('2026-09-01T00:00:00Z') })
      .where(sql`true`)
    await database.db
      .insert(runways)
      .values([
        runway(11, 1, '17L', '35R'),
        runway(12, 1, '09', '27', { updatedAt: at('2026-09-04T00:00:00Z') }),
        runway(13, 1, '16R', '34L'),
        runway(21, 2, '06', '24', { airportIdent: 'LTFJ' }),
      ])
    await database.db.insert(runwayOverrides).values([
      {
        runwayId: 13,
        leTrueBearingDeg: 172.5,
        heThresholdLat: 41.27,
        note: 'test',
        updatedAt: at('2026-09-10T08:00:00Z'),
      },
      // Pisti olmayan düzeltme hiçbir havalimanını etkilemez.
      { runwayId: 999, leTrueBearingDeg: 1, updatedAt: at('2026-12-01T00:00:00Z') },
    ])
    await database.db.insert(stations).values([
      { icao: 'LTFM', iata: 'IST', isPrimary: true, fetchRadiusNm: 60 },
      { icao: 'LTFJ', iata: 'SAW', isActive: false, fetchRadiusNm: 45 },
    ])

    const [ist, saw] = await listAirportDetails(database.db, 'TR')
    expect(ist?.icao).toBe('LTFM')
    expect(ist?.station).toEqual({ active: true, primary: true, fetchRadiusNm: 60 })
    expect(ist?.runways.map((r) => `${r.ends[0].ident}/${r.ends[1].ident}`)).toEqual([
      '09/27',
      '16R/34L',
      '17L/35R',
    ])
    const corrected = ist?.runways.find((r) => r.id === 13)
    expect(corrected?.ends).toEqual([
      {
        ident: '16R',
        trueBearingDeg: 172.5,
        displacedThresholdFt: null,
        thresholdLat: 41.3,
        thresholdLon: 28.7,
      },
      {
        ident: '34L',
        trueBearingDeg: 355,
        displacedThresholdFt: 1_000,
        thresholdLat: 41.27,
        thresholdLon: 28.74,
      },
    ])
    expect(ist?.runways.find((r) => r.id === 11)?.ends[0].trueBearingDeg).toBe(175)
    expect(ist?.dataUpdatedAt).toBe('2026-09-10T08:00:00.000Z')

    expect(saw?.station).toEqual({ active: false, primary: false, fetchRadiusNm: 45 })
    expect(saw?.runways.map((r) => r.id)).toEqual([21])
    expect(saw?.dataUpdatedAt).toBe('2026-09-02T00:00:00.000Z')
  })
})

describe('findAirportDetail', () => {
  beforeEach(async () => {
    await database.db
      .insert(airports)
      .values([
        extra(1, { ident: 'LTFM', icaoCode: 'LTFM', iataCode: 'IST', type: 'large_airport' }),
        extra(2, { ident: 'LTBL', gpsCode: 'LTBL', iataCode: 'IGL', type: 'medium_airport' }),
        extra(3, { ident: 'LTAE', icaoCode: 'LTAE', type: 'medium_airport' }),
        extra(4, { ident: 'EGLL', icaoCode: 'EGLL', iataCode: 'LHR', isoCountry: 'GB' }),
        extra(5, { ident: 'LTXA', icaoCode: 'LTXX', iataCode: 'AAA' }),
        extra(6, { ident: 'LTXB', icaoCode: 'LTXX', iataCode: 'BBB' }),
        extra(7, { ident: 'LTHP', icaoCode: 'LTHP', iataCode: 'HPX', type: 'heliport' }),
      ])
    await database.db.insert(runways).values([runway(11, 1, '16L', '34R')])
  })

  it('ICAO ya da IATA ile, büyük/küçük harf ve boşluk fark etmeden bulur', async () => {
    for (const code of ['LTFM', 'ltfm', 'IST', 'ist', ' Ist ']) {
      const detail = await findAirportDetail(database.db, code)
      expect(detail?.icao, code).toBe('LTFM')
      expect(
        detail?.runways.map((r) => r.id),
        code,
      ).toEqual([11])
    }
    // ICAO gps_code'dan gelir; başka ülke de bulunur.
    expect((await findAirportDetail(database.db, 'igl'))?.icao).toBe('LTBL')
    expect((await findAirportDetail(database.db, 'LTBL'))?.iata).toBe('IGL')
    expect((await findAirportDetail(database.db, 'lhr'))?.icao).toBe('EGLL')
  })

  it('listede görünmeyen kayıt bulunmaz: IATA kodu yok, heliport, gölgelenen ICAO, bilinmeyen kod', async () => {
    for (const code of ['LTAE', 'LTHP', 'HPX', 'BBB', 'ZZZ', 'ZZZZ', '']) {
      expect(await findAirportDetail(database.db, code), code).toBeNull()
    }
    // Aynı ICAO'daki iki kayıttan küçük kimlikli olan listede görünür.
    expect(await findAirportDetail(database.db, 'LTXX')).toMatchObject({ iata: 'AAA' })
    expect(await findAirportDetail(database.db, 'aaa')).toMatchObject({ icao: 'LTXX' })
  })
})
