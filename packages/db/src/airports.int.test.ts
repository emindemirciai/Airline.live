import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  findAirportDetail,
  listAirportDetails,
  listAirportsWithIata,
  listListedAirportDetails,
  listListedAirports,
  type AirportRingConfig,
} from './airports'
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

/**
 * 1. halka açık (M6d'nin ayarı; bugünkü `@havayolu/shared` `AIRPORT_RING_CONFIG` 4. halkadır, D-102).
 * Testler 1. halkayı sabit tutar; 2., 3. ve 4. halka ayrı durumlarda (`enabledRing: 2`, `3`, `4`)
 * denetlenir.
 */
const RINGS: AirportRingConfig = { ringsKm: [500, 1000, 2000, 5000], enabledRing: 1 }

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
 * süzgeci uygulanır (data-sources.md §3; `@havayolu/providers` `isImportedAirport`): büyük ve orta
 * havalimanları, tarifeli sefer alanlar ve Türkiye'nin IATA kodlu küçük alanları (Gökçeada gibi
 * tarifesiz alanlar; yalnızca uzaklık referansıdırlar, listeye girmezler, D-080).
 * `turkishIata: false`: o alanlar olmadan (M6d öncesi süzgeç).
 */
function readFixture({ turkishIata = true }: { turkishIata?: boolean } = {}): AirportInsert[] {
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
        r.get('scheduled_service') === 'yes' ||
        (turkishIata &&
          r.get('iso_country') === 'TR' &&
          /^[A-Z]{3}$/.test(r.get('iata_code') ?? '')),
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
    expect(await listAirportsWithIata(database.db, 'TR', RINGS)).toEqual([])
  })

  it("fixture: Türkiye'nin içe aktarılan 73 alanından IATA kodlu 61'inin askerî üsler (D-107) dışındaki 56'sı, IATA sırasıyla", async () => {
    const rows = readFixture()
    // 68 büyük, orta ya da tarifeli alan + IATA kodlu 5 tarifesiz küçük alan (uzaklık referansı,
    // D-080; listeye girmez).
    expect(rows.filter((r) => r.isoCountry === 'TR')).toHaveLength(73)
    await database.db.insert(airports).values(rows)

    const list = await listAirportsWithIata(database.db, 'TR', RINGS)
    expect(list).toHaveLength(56)
    const codes = list.map((a) => a.iata)
    expect(codes).toEqual([...codes].sort())
    expect(new Set(list.map((a) => a.icao)).size).toBe(56)
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
      country: 'TR',
      ring: 0,
      distanceToTrKm: null,
    })
    // Askerî hava üsleri (D-107) listede yok; Çiğli'nin icao_code'u boştur, kanonik ICAO'su
    // gps_code'dan (LTBL) gelir ve yine süzülür.
    for (const code of ['UAB', 'AFY', 'BDM', 'ESK', 'IGL']) expect(codes, code).not.toContain(code)
    for (const icao of ['LTAG', 'LTAH', 'LTBG', 'LTBI', 'LTBL']) {
      expect(
        list.map((a) => a.icao),
        icao,
      ).not.toContain(icao)
    }
    // Askerî adlı ama sivil Ankara (Etimesgut) listede (D-084).
    expect(list.find((a) => a.iata === 'ANK')?.icao).toBe('LTAD')
    // Tarifeli seferi olmayan Atatürk de listelenir.
    expect(list.find((a) => a.iata === 'ISL')).toMatchObject({ icao: 'LTBA', scheduled: false })
    // IATA kodu olmayan askeri alanlar yoktur.
    expect(list.map((a) => a.icao)).not.toContain('LTAE')

    // Başka ülke: kayıt halkasını ve Türkiye'ye uzaklığını taşır (halka süzgeci yok; Birleşik
    // Krallık'ın fixture'daki 40 havalimanı 4. halkada, 2.000–5.000 km; D-101).
    const gb = await listAirportsWithIata(database.db, 'GB', RINGS)
    expect(gb).toHaveLength(40)
    expect(gb.every((a) => a.country === 'GB' && a.ring === 4)).toBe(true)
    expect(gb.find((a) => a.iata === 'LHR')).toMatchObject({ icao: 'EGLL', ring: 4 })
    expect(gb.find((a) => a.iata === 'LHR')?.distanceToTrKm).toBeGreaterThan(2000)
    expect((await listAirportsWithIata(database.db, 'US', RINGS)).map((a) => a.iata)).toEqual([
      'JFK',
    ])
    expect(await listAirportsWithIata(database.db, 'ZZ', RINGS)).toEqual([])
  })

  it('heliport, kapalı alan, boş IATA ve tarifesiz küçük alan süzülür; ICAO yoksa ident', async () => {
    await database.db.insert(airports).values([
      extra(900_001, { type: 'heliport', iataCode: 'HPX', icaoCode: 'LTHP' }),
      extra(900_002, { type: 'closed', iataCode: 'CLX', icaoCode: 'LTCL' }),
      extra(900_003, { iataCode: '   ', icaoCode: 'LTBK' }),
      extra(900_004, { iataCode: 'smx', scheduledService: true }),
      extra(900_005, { iataCode: 'MDX', type: 'medium_airport', gpsCode: 'LTGP' }),
      extra(900_006, { iataCode: 'FRX', isoCountry: 'FR', icaoCode: 'LFXX' }),
      // İçe aktarım süzgecinden geçmeyen biçim (tarifesiz küçük alan): listeye girmez.
      extra(900_007, { iataCode: 'GKX', icaoCode: 'LTGK' }),
    ])
    const list = await listAirportsWithIata(database.db, 'TR', RINGS)
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

describe('listListedAirports (D-080)', () => {
  it('tablo boşken liste boş', async () => {
    expect(await listListedAirports(database.db, RINGS)).toEqual([])
    expect(await listListedAirportDetails(database.db, RINGS)).toEqual([])
  })

  it('fixture, içe aktarım süzgeciyle: 56 Türkiye (askerî üsler hariç, D-107) + 75 yurt dışı (1. halka) = 131, IATA sırasıyla', async () => {
    const rows = readFixture()
    // Gökçeada, Selçuk-Efes, Bodrum-İmsık, Aydın Çıldır, Adana Şakirpaşa: tarifesiz küçük alanlar,
    // yalnızca uzaklık referansı.
    expect(rows.filter((r) => r.isoCountry === 'TR')).toHaveLength(73)
    await database.db.insert(airports).values(rows)
    const list = await listListedAirports(database.db, RINGS)
    const codes = list.map((a) => a.iata)
    expect(codes).toEqual([...codes].sort())
    expect(new Set(list.map((a) => a.icao)).size).toBe(list.length)

    const turkish = list.filter((a) => a.country === 'TR')
    const tr = await listAirportsWithIata(database.db, 'TR', RINGS)
    expect(turkish.map((a) => a.icao)).toEqual(tr.map((a) => a.icao))
    expect(turkish.every((a) => a.ring === 0 && a.distanceToTrKm === null)).toBe(true)

    expect(list.map((a) => a.icao)).not.toContain('LTFK')
    const foreign = list.filter((a) => a.country !== 'TR')
    expect(foreign).toHaveLength(75)
    expect(list).toHaveLength(131)
    for (const airport of foreign) {
      expect(airport.ring, airport.icao).toBe(1)
      expect(airport.distanceToTrKm, airport.icao).toBeLessThanOrEqual(500)
      expect(['large_airport', 'medium_airport']).toContain(airport.type)
      expect(airport.scheduled, airport.icao).toBe(true)
    }
    // Atina'nın uzaklığı İzmir Adnan Menderes'e ölçülür; Çiğli üssü (275 km) referans değildir (D-107).
    expect(list.find((a) => a.icao === 'LGAV')).toMatchObject({
      iata: 'ATH',
      country: 'GR',
      ring: 1,
      distanceToTrKm: 284,
    })
    expect(list.find((a) => a.icao === 'LCEN')).toMatchObject({ iata: 'ECN', country: 'CY' })
    // Süleymaniye: OurAirports kimliği ORSU, ICAO'su ORSJ.
    expect(list.find((a) => a.iata === 'ISU')?.icao).toBe('ORSJ')
    // Priştine, Preveze ve Niş Türkiye'deki en yakın IATA kodlu alana (Gökçeada) 500 km içinde;
    // Gökçeada listelenmez ama uzaklık referansıdır (Çanakkale'den ölçülse 500 km'yi aşarlardı).
    expect(list.find((a) => a.icao === 'BKPR')).toMatchObject({
      country: 'XK',
      ring: 1,
      distanceToTrKm: 482,
    })
    expect(list.find((a) => a.icao === 'LGPZ')?.distanceToTrKm).toBe(461)
    expect(list.find((a) => a.icao === 'LYNI')?.distanceToTrKm).toBe(482)
    // Uzak fixture havalimanları (EGLL, KJFK …) listede değildir.
    expect(list.map((a) => a.icao)).not.toContain('EGLL')

    const details = await listListedAirportDetails(database.db, RINGS)
    expect(details.map((a) => a.icao)).toEqual(list.map((a) => a.icao))
    expect(details.find((a) => a.icao === 'LGAV')).toMatchObject({
      isoRegion: 'GR-I',
      country: 'GR',
      ring: 1,
      distanceToTrKm: 284,
      nearestTr: { icao: 'LTBJ', iata: 'ADB' },
      station: null,
    })
    // Uzaklığın ölçüldüğü havalimanı listelenmeyen küçük alan olabilir (Selanik → Gökçeada).
    expect(details.find((a) => a.icao === 'LGTS')?.nearestTr).toEqual({
      icao: 'LTFK',
      iata: 'GKD',
      name: 'Gökçeada Airport',
    })
    expect(details.filter((a) => a.country === 'TR').every((a) => a.nearestTr === null)).toBe(true)
    // Hiçbir kaydın en yakın Türkiye havalimanı askerî üs değildir (D-107).
    for (const detail of details) {
      expect(['LTAG', 'LTAH', 'LTBG', 'LTBI', 'LTBL'], detail.icao).not.toContain(
        detail.nearestTr?.icao,
      )
    }
    // Açık halka genişlerse liste büyür; Türkiye kısmı değişmez.
    const wider = await listListedAirports(database.db, { ...RINGS, enabledRing: 5 })
    expect(wider.length).toBeGreaterThan(list.length)
    expect(wider.filter((a) => a.country === 'TR')).toHaveLength(56)
  })

  it('2. halka açık (M6g, D-088): 56 + 75 + 89 = 220; İskenderiye HEBA, Ben Gurion 500 km 2. halkada', async () => {
    await database.db.insert(airports).values(readFixture())
    const list = await listListedAirports(database.db, { ...RINGS, enabledRing: 2 })
    expect(list).toHaveLength(220)
    expect(new Set(list.map((a) => a.icao)).size).toBe(220)
    expect(new Set(list.map((a) => a.iata)).size).toBe(220)
    const foreign = list.filter((a) => a.country !== 'TR')
    expect(foreign.filter((a) => a.ring === 1)).toHaveLength(75)
    const ringTwo = foreign.filter((a) => a.ring === 2)
    expect(ringTwo).toHaveLength(89)
    for (const airport of ringTwo) {
      // Uzaklık tam km'ye yuvarlıdır; halka yuvarlanmamış uzaklıktan (Ben Gurion 500,44 km).
      expect(airport.distanceToTrKm, airport.icao).toBeGreaterThanOrEqual(500)
      expect(airport.distanceToTrKm, airport.icao).toBeLessThanOrEqual(1000)
    }
    expect(list.find((a) => a.icao === 'LLBG')).toMatchObject({ ring: 2, distanceToTrKm: 500 })
    expect(list.find((a) => a.icao === 'OKKK')).toMatchObject({ ring: 2, distanceToTrKm: 988 })
    expect(list.find((a) => a.iata === 'CAI')).toMatchObject({ icao: 'HECA', country: 'EG' })
    // Kaynak düzeltmeleri: OurAirports icao_code HEAX → HEBA; ad boşluğu teke iner.
    expect(list.find((a) => a.iata === 'HBE')?.icao).toBe('HEBA')
    expect(list.map((a) => a.icao)).not.toContain('HEAX')
    expect(list.find((a) => a.icao === 'LRBC')?.name).toBe(
      'Bacău George Enescu International Airport',
    )
    // 1. halka ve Türkiye değişmez.
    const ringOne = await listListedAirports(database.db, RINGS)
    expect(list.filter((a) => a.ring <= 1).map((a) => a.icao)).toEqual(ringOne.map((a) => a.icao))
    const alexandria = await findAirportDetail(database.db, 'heba', RINGS)
    expect(alexandria).toMatchObject({ icao: 'HEBA', iata: 'HBE', ring: 2 })
    expect((await findAirportDetail(database.db, 'HBE', RINGS))?.icao).toBe('HEBA')
    expect(await findAirportDetail(database.db, 'HEAX', RINGS)).toBeNull()
  })

  it('3. halka açık (M6h, D-090): 56 + 75 + 89 + 278 = 498; Viyana, UZxx kodları, ad temizliği', async () => {
    await database.db.insert(airports).values(readFixture())
    const list = await listListedAirports(database.db, { ...RINGS, enabledRing: 3 })
    expect(list).toHaveLength(498)
    expect(new Set(list.map((a) => a.icao)).size).toBe(498)
    expect(new Set(list.map((a) => a.iata)).size).toBe(498)
    const foreign = list.filter((a) => a.country !== 'TR')
    expect(foreign).toHaveLength(442)
    expect(foreign.filter((a) => a.ring === 1)).toHaveLength(75)
    expect(foreign.filter((a) => a.ring === 2)).toHaveLength(89)
    const ringThree = foreign.filter((a) => a.ring === 3)
    expect(ringThree).toHaveLength(278)
    for (const airport of ringThree) {
      // En yakını Gachsaran 1.006 km: 1.000 km sınırında yuvarlama vakası yok.
      expect(airport.distanceToTrKm, airport.icao).toBeGreaterThan(1000)
      expect(airport.distanceToTrKm, airport.icao).toBeLessThanOrEqual(2000)
    }
    expect(list.find((a) => a.icao === 'OIAH')).toMatchObject({ ring: 3, distanceToTrKm: 1006 })
    expect(list.find((a) => a.icao === 'ESMX')).toMatchObject({ ring: 3, distanceToTrKm: 1994 })
    expect(list.find((a) => a.iata === 'VIE')).toMatchObject({
      icao: 'LOWW',
      country: 'AT',
      ring: 3,
      distanceToTrKm: 1149,
    })
    // Fixture'ın uzak örneklerinden üçü 3. halkadadır; beşi değildir.
    for (const icao of ['EDDF', 'OMDB', 'OTHH']) {
      expect(list.find((a) => a.icao === icao)?.ring, icao).toBe(3)
    }
    for (const icao of ['EGLL', 'LFPG', 'EHAM', 'LEMD', 'KJFK']) {
      expect(
        list.map((a) => a.icao),
        icao,
      ).not.toContain(icao)
    }
    // Özbekistan: OurAirports kimliği UTxx, ICAO'su UZxx; Kızıldeniz'in kimliği "RSI".
    expect(list.find((a) => a.iata === 'SKD')?.icao).toBe('UZSS')
    expect(list.map((a) => a.icao)).not.toContain('UTSS')
    expect(list.find((a) => a.iata === 'RSI')?.icao).toBe('OERS')
    // Küçük harfli "airport" okurken "Airport" olur (Bastia).
    expect(list.find((a) => a.icao === 'LFKB')?.name).toBe('Bastia-Poretta International Airport')
    // 1. ve 2. halka ve Türkiye değişmez.
    const ringTwoList = await listListedAirports(database.db, { ...RINGS, enabledRing: 2 })
    expect(list.filter((a) => a.ring <= 2).map((a) => a.icao)).toEqual(
      ringTwoList.map((a) => a.icao),
    )
    const vienna = await findAirportDetail(database.db, 'vie', RINGS)
    expect(vienna).toMatchObject({ icao: 'LOWW', ring: 3, nearestTr: { icao: 'LTFK' } })
  })

  it('4. halka açık (D-101; uygulamada M6i.2’den beri açık, D-102): 56 + 75 + 89 + 278 + 719 = 1.217; Kihihi (UG-0002) dört karakterli ICAO kuralıyla dışarıda', async () => {
    await database.db.insert(airports).values(readFixture())
    const list = await listListedAirports(database.db, { ...RINGS, enabledRing: 4 })
    expect(list).toHaveLength(1217)
    expect(new Set(list.map((a) => a.icao)).size).toBe(1217)
    const foreign = list.filter((a) => a.country !== 'TR')
    expect([1, 2, 3, 4].map((ring) => foreign.filter((a) => a.ring === ring).length)).toEqual([
      75, 89, 278, 719,
    ])
    for (const airport of list) expect(airport.icao).toMatch(/^[A-Z0-9]{4}$/)
    expect(list.map((a) => a.icao)).not.toContain('UG-0002')
    expect(list.map((a) => a.iata)).not.toContain('KHX')
    // En yakını Barselona, en uzağı Çinggis Haan (Ulan Batur); uzak örneklerden dördü 4. halkada.
    const ringFour = foreign.filter((a) => a.ring === 4)
    expect(Math.min(...ringFour.map((a) => a.distanceToTrKm ?? 0))).toBe(2003)
    expect(list.find((a) => a.icao === 'LEBL')).toMatchObject({ ring: 4, distanceToTrKm: 2003 })
    expect(list.find((a) => a.icao === 'ZMCK')).toMatchObject({ ring: 4, distanceToTrKm: 4981 })
    for (const icao of ['EGLL', 'LFPG', 'EHAM', 'LEMD']) {
      expect(list.find((a) => a.icao === icao)?.ring, icao).toBe(4)
    }
    expect(list.map((a) => a.icao)).not.toContain('KJFK')
    // Ülke listesi ICAO koşulu uygulamaz; Kihihi orada ident'iyle görünür, sayfa adresi yoktur.
    const uganda = await listAirportsWithIata(database.db, 'UG', RINGS)
    expect(uganda.find((a) => a.iata === 'KHX')).toMatchObject({ icao: 'UG-0002', ring: 4 })
    const details = await listListedAirportDetails(database.db, { ...RINGS, enabledRing: 4 })
    expect(details.map((a) => a.icao)).toEqual(list.map((a) => a.icao))
    // 3. halkanın listesi (D-107'den sonra 498) 4. halka açılınca değişmez.
    const ringThree = await listListedAirports(database.db, { ...RINGS, enabledRing: 3 })
    expect(ringThree).toHaveLength(498)
    expect(list.filter((a) => a.ring <= 3).map((a) => a.icao)).toEqual(ringThree.map((a) => a.icao))
  })

  it('uzaklık referansı küçük alanlar olmadan (M6d öncesi süzgeç) 1. halka daralır: 56 + 72', async () => {
    await database.db.insert(airports).values(readFixture({ turkishIata: false }))
    const list = await listListedAirports(database.db, RINGS)
    expect(list.filter((a) => a.country === 'TR')).toHaveLength(56)
    expect(list.filter((a) => a.country !== 'TR')).toHaveLength(72)
    for (const icao of ['BKPR', 'LGPZ', 'LYNI']) {
      expect(
        list.map((a) => a.icao),
        icao,
      ).not.toContain(icao)
    }
    expect(await listAirportsWithIata(database.db, 'TR', RINGS)).toHaveLength(56)
  })
})

describe('listAirportDetails', () => {
  it('fixture: listeyle aynı 56 havalimanı; pisti olmayanın listesi boş, tarih havalimanınınki', async () => {
    await database.db
      .insert(airports)
      .values(readFixture().map((r) => ({ ...r, updatedAt: at('2026-09-01T00:00:00Z') })))
    const details = await listAirportDetails(database.db, 'TR', RINGS)
    const list = await listAirportsWithIata(database.db, 'TR', RINGS)
    expect(details).toHaveLength(56)
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
    expect(await listAirportDetails(database.db, 'ZZ', RINGS)).toEqual([])
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

    const [ist, saw] = await listAirportDetails(database.db, 'TR', RINGS)
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
    await database.db.insert(airports).values([
      extra(1, { ident: 'LTFM', icaoCode: 'LTFM', iataCode: 'IST', type: 'large_airport' }),
      extra(2, { ident: 'LTBJ', gpsCode: 'LTBJ', iataCode: 'ADB', type: 'large_airport' }),
      // Askerî hava üssü (D-107): içe aktarılır ama hiçbir kodla bulunmaz.
      extra(9, { ident: 'LTBL', gpsCode: 'LTBL', iataCode: 'IGL', type: 'medium_airport' }),
      extra(10, { ident: 'LTAG', icaoCode: 'LTAG', iataCode: 'UAB', type: 'medium_airport' }),
      extra(3, { ident: 'LTAE', icaoCode: 'LTAE', type: 'medium_airport' }),
      extra(4, {
        ident: 'EGLL',
        icaoCode: 'EGLL',
        iataCode: 'LHR',
        isoCountry: 'GB',
        type: 'large_airport',
        latitudeDeg: 51.4706,
        longitudeDeg: -0.461941,
      }),
      extra(5, { ident: 'LTXA', icaoCode: 'LTXX', iataCode: 'AAA', scheduledService: true }),
      extra(6, { ident: 'LTXB', icaoCode: 'LTXX', iataCode: 'BBB', scheduledService: true }),
      // Türkiye'nin tarifesiz, IATA kodlu küçük alanı içe aktarılır ama yalnızca uzaklık
      // referansıdır (D-080): bulunmaz.
      extra(8, { ident: 'LTGK', icaoCode: 'LTGK', iataCode: 'GKX' }),
      extra(7, { ident: 'LTHP', icaoCode: 'LTHP', iataCode: 'HPX', type: 'heliport' }),
    ])
    await database.db.insert(runways).values([runway(11, 1, '16L', '34R')])
  })

  it('ICAO ya da IATA ile, büyük/küçük harf ve boşluk fark etmeden bulur', async () => {
    for (const code of ['LTFM', 'ltfm', 'IST', 'ist', ' Ist ']) {
      const detail = await findAirportDetail(database.db, code, RINGS)
      expect(detail?.icao, code).toBe('LTFM')
      expect(
        detail?.runways.map((r) => r.id),
        code,
      ).toEqual([11])
    }
    // ICAO gps_code'dan gelir; başka ülke de bulunur.
    expect((await findAirportDetail(database.db, 'adb', RINGS))?.icao).toBe('LTBJ')
    expect((await findAirportDetail(database.db, 'LTBJ', RINGS))?.iata).toBe('ADB')
    // Halka süzgeci yok: 1. halkanın dışındaki havalimanı da bulunur, halkasını taşır (Londra 4.
    // halkada).
    expect(await findAirportDetail(database.db, 'lhr', RINGS)).toMatchObject({
      icao: 'EGLL',
      country: 'GB',
      ring: 4,
    })
    expect((await findAirportDetail(database.db, 'LTFM', RINGS))?.distanceToTrKm).toBeNull()
  })

  it('listede görünmeyen kayıt bulunmaz: IATA kodu yok, heliport, gölgelenen ICAO, askerî üs, bilinmeyen kod', async () => {
    const military = ['LTBL', 'ltbl', 'IGL', 'igl', 'LTAG', 'UAB']
    for (const code of [
      'LTAE',
      'LTHP',
      'HPX',
      'BBB',
      'LTGK',
      'GKX',
      ...military,
      'ZZZ',
      'ZZZZ',
      '',
    ]) {
      expect(await findAirportDetail(database.db, code, RINGS), code).toBeNull()
    }
    // Aynı ICAO'daki iki kayıttan küçük kimlikli olan listede görünür.
    expect(await findAirportDetail(database.db, 'LTXX', RINGS)).toMatchObject({ iata: 'AAA' })
    expect(await findAirportDetail(database.db, 'aaa', RINGS)).toMatchObject({ icao: 'LTXX' })
  })
})
