import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadAirlineCodes, loadAirlineDesignatorRows } from './airlines'
import { createDb, type Database } from './client'
import { runMigrations } from './migrate'

const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_db_airlines'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))
const vrsFixture = fileURLToPath(
  new URL('../../../tools/fixtures/vrs/airlines.csv', import.meta.url),
)

const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined })
// API'deki gibi `createDb`: Drizzle aynı istemcinin serileştiricilerini değiştirir; fonksiyon bu
// istemciyle çağrılır, veri düz istemciyle (`check`) yazılır.
let database: Database
let check: postgres.Sql

beforeAll(async () => {
  await admin.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.unsafe(`create database ${testDbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder })
  database = createDb(testUrl, { max: 2 })
  check = postgres(testUrl, { max: 2, onnotice: () => undefined })
})

afterAll(async () => {
  await Promise.allSettled([database?.sql.end({ timeout: 5 }), check?.end({ timeout: 5 })])
  await admin.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.end({ timeout: 5 })
})

beforeEach(async () => {
  await check`truncate airlines, airline_overrides`
})

interface AirlineRow {
  code: string
  name: string
  icao: string | null
  iata: string | null
}

async function insertAirlines(rows: readonly AirlineRow[]) {
  const payload = rows.map((r) => ({ ...r, row_hash: `${r.code}:${r.name}` }))
  await check`
    insert into airlines (code, name, icao, iata, row_hash)
    select code, name, icao, iata, row_hash
    from jsonb_to_recordset(${JSON.stringify(payload)}::text::jsonb) as v(
      code text, name text, icao text, iata text, row_hash text
    )`
}

const airline = (code: string, icao: string | null, iata: string | null): AirlineRow => ({
  code,
  name: code,
  icao,
  iata,
})

/** VRS airlines.csv: her alan tırnaklı, ayraç `","`; boş alan null. */
function readVrsFixture(): AirlineRow[] {
  const lines = readFileSync(vrsFixture, 'utf8').split(/\r?\n/).slice(1).filter(Boolean)
  return lines.map((line) => {
    const [code = '', name = '', icao = '', iata = ''] = line.slice(1, -1).split('","')
    return { code, name, icao: icao || null, iata: iata || null }
  })
}

describe('loadAirlineCodes', () => {
  it('boş tablolarda eşlemeler boştur', async () => {
    const codes = await loadAirlineCodes(database.sql)
    expect(codes.icaoToIata.size).toBe(0)
    expect(codes.iataToIcao.size).toBe(0)
  })

  it('VRS fixture: THY → TK, PGT → PC; VF iki havayolunda (TKJ, VLU)', async () => {
    const rows = readVrsFixture()
    expect(rows.length).toBeGreaterThan(5000)
    await insertAirlines(rows)
    const codes = await loadAirlineCodes(database.sql)
    expect(codes.icaoToIata.get('THY')).toBe('TK')
    expect(codes.icaoToIata.get('PGT')).toBe('PC')
    expect(codes.icaoToIata.get('SXS')).toBe('XQ')
    expect(codes.icaoToIata.get('TKJ')).toBe('VF')
    expect(codes.iataToIcao.get('TK')).toEqual(['THY'])
    expect(codes.iataToIcao.get('VF')).toEqual(['TKJ', 'VLU'])
    // ICAO'suz rezervasyon sistemi satırları ve IATA'sız havayolları eşleme üretmez.
    expect(codes.iataToIcao.has('1B')).toBe(false)
    expect(codes.icaoToIata.has('AAB')).toBe(false)
    for (const [icao, iata] of codes.icaoToIata) {
      expect(icao).toMatch(/^[A-Z]{3}$/)
      expect(iata).toMatch(/^[A-Z0-9]{2}$/)
      expect(iata).not.toMatch(/^\d\d$/)
      expect(codes.iataToIcao.get(iata)).toContain(icao)
    }
  })

  it('düzeltme satırı aynı koddaki VRS satırının yerine geçer; boş alan VRS değerini korur', async () => {
    await insertAirlines([
      airline('THY', 'THY', 'TK'),
      airline('TKJ', 'TKJ', 'VF'),
      airline('VLU', 'VLU', 'VF'),
      airline('BAD', 'BAD', 'B1'),
      airline('OLD', 'OLD', 'OL'),
    ])
    await check`
      insert into airline_overrides (code, name, icao, iata) values
        ('TKJ', 'AJet (düzeltme)', null, null),
        ('VLU', null, null, 'V1'),
        ('BAD', null, null, ''),
        ('NEW', 'Yeni Havayolu', 'nwx', 'vf'),
        ('XYZ', 'Kodsuz düzeltme', null, null)`
    const codes = await loadAirlineCodes(database.sql)
    expect(Object.fromEntries(codes.icaoToIata)).toEqual({
      THY: 'TK',
      // Yalnızca adı düzeltilen havayolu VRS kodlarını korur.
      TKJ: 'VF',
      // IATA düzeltmesi VRS değerini ezer.
      VLU: 'V1',
      // VRS'te olmayan kod yeni havayolu olarak eklenir (kodlar büyük harfe çevrilir).
      NWX: 'VF',
      OLD: 'OL',
    })
    // BAD: boş metin IATA'yı bilerek temizler.
    expect(codes.icaoToIata.has('BAD')).toBe(false)
    // Düzeltmeden gelen ICAO önce, sonra alfabetik.
    expect(codes.iataToIcao.get('VF')).toEqual(['NWX', 'TKJ'])
    expect(codes.iataToIcao.get('V1')).toEqual(['VLU'])
    expect(codes.iataToIcao.has('B1')).toBe(false)
  })

  it('düzeltme başka koddan aynı ICAO’yu verirse o IATA önce gelir', async () => {
    await insertAirlines([airline('ABC', 'ABC', 'AB')])
    await check`insert into airline_overrides (code, icao, iata) values ('ZZZ', 'ABC', 'AZ')`
    const codes = await loadAirlineCodes(database.sql)
    expect(codes.icaoToIata.get('ABC')).toBe('AZ')
    expect(codes.iataToIcao.get('AB')).toEqual(['ABC'])
    expect(codes.iataToIcao.get('AZ')).toEqual(['ABC'])
  })

  it('düz postgres-js istemcisiyle de aynı sonucu verir', async () => {
    await insertAirlines([airline('THY', 'THY', 'TK')])
    const plain = await loadAirlineCodes(check)
    const wrapped = await loadAirlineCodes(database.sql)
    expect(Object.fromEntries(plain.icaoToIata)).toEqual(Object.fromEntries(wrapped.icaoToIata))
  })
})

describe('loadAirlineDesignatorRows', () => {
  it('IATA kodu olmayan satırlar, düzeltilen ICAO ve VRS desenleri gelir; ICAO’suz satır gelmez', async () => {
    const dlhCharter = String.raw`^((987\d)|(99\d\d))$`
    await insertAirlines([airline('THY', 'THY', 'TK'), airline('EAF', 'EAF', null)])
    await check`
      insert into airlines (code, name, icao, iata, charter_flight_pattern, positioning_flight_pattern, row_hash)
      values
        ('NJE', 'NetJets Europe', 'NJE', null, '.*', null, 'x'),
        ('DLH', 'Lufthansa', 'DLH', 'LH', ${dlhCharter}, null, 'y'),
        ('1B', 'Abacus International', null, '1B', null, null, 'z')`
    await check`
      insert into airline_overrides (code, icao, iata) values
        ('EAF', 'eax', null),
        ('NEW', 'NWX', null),
        ('BAD', 'B1', null)`
    const rows = await loadAirlineDesignatorRows(database.sql)
    const byIcao = new Map(rows.map((r) => [r.icao, r]))
    expect([...byIcao.keys()].sort()).toEqual(['DLH', 'EAX', 'NJE', 'NWX', 'THY'])
    expect(byIcao.get('THY')).toEqual({
      icao: 'THY',
      iata: 'TK',
      charterFlightPattern: null,
      positioningFlightPattern: null,
    })
    // Düzeltilen ICAO (küçük harf büyütülür), IATA'sız satır da gelir.
    expect(byIcao.get('EAX')?.iata).toBeNull()
    expect(byIcao.get('NJE')?.charterFlightPattern).toBe('.*')
    expect(byIcao.get('DLH')?.charterFlightPattern).toBe(dlhCharter)
  })

  it('VRS fixture: IATA şartı olmadan bütün ICAO kodlu satırlar', async () => {
    await insertAirlines(readVrsFixture())
    const rows = await loadAirlineDesignatorRows(database.sql)
    expect(new Set(rows.map((r) => r.icao)).size).toBe(5_904)
    expect(rows.find((r) => r.icao === 'HVK')).toMatchObject({ iata: null })
  })
})
