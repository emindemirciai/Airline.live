import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AIRPORT_NAMES,
  airportRing,
  CIVIL_FLIGHT_CLOSURES,
  civilFlightClosure,
  ENABLED_AIRPORT_RING,
  FOREIGN_AIRPORT_NAMES,
  isForeignCandidate,
  isMilitaryAirfield,
  isScheduledIataAirport,
  ourAirportsIcao,
} from './index'

// Commit'li OurAirports alt kümesi (tools/fixtures/README.md); foreign.test.ts ile aynı okuma.
const rows = (() => {
  const text = readFileSync(
    new URL('../../../../tools/fixtures/ourairports/airports.csv', import.meta.url),
    'utf8',
  )
  const [header = '', ...lines] = text.split(/\r?\n/)
  const columns = header.slice(1, -1).split('","')
  return lines.filter(Boolean).map((line) => {
    const values = line
      .slice(1, -1)
      .split('","')
      .map((v) => v.replaceAll('""', '"'))
    return new Map(columns.map((column, i) => [column, values[i] ?? '']))
  })
})()
const icaoOf = (r: Map<string, string>) =>
  ourAirportsIcao({
    ident: r.get('ident') ?? '',
    icaoCode: r.get('icao_code'),
    gpsCode: r.get('gps_code'),
  })

/** Büyük daire, km (foreign.test.ts ile aynı). */
function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)))
}
const position = (r: Map<string, string>) => ({
  lat: Number(r.get('latitude_deg')),
  lon: Number(r.get('longitude_deg')),
})
const references = rows
  .filter((r) => r.get('iso_country') === 'TR')
  .filter((r) => ['large_airport', 'medium_airport', 'small_airport'].includes(r.get('type') ?? ''))
  .filter((r) => /^[A-Z]{3}$/.test((r.get('iata_code') ?? '').trim().toUpperCase()))
  .filter((r) => !isMilitaryAirfield(icaoOf(r)))
  .map(position)
const ringOf = (r: Map<string, string>) => {
  const here = position(r)
  return airportRing(Math.min(...references.map((tr) => km(here, tr))))
}
/** Açık halkalardaki yabancı havalimanları (liste kuralı, D-080, D-101, D-110). */
const listedRows = rows
  .filter((r) => r.get('iso_country') !== 'TR')
  .filter((r) =>
    isForeignCandidate(
      r.get('type') ?? '',
      r.get('scheduled_service') === 'yes',
      r.get('iata_code'),
      icaoOf(r),
    ),
  )
  .filter((r) => ringOf(r) <= ENABLED_AIRPORT_RING)
const listedForeign = listedRows.map(icaoOf)

/** Kesin kayıtlar (D-110 → "Not türü"): 23'ü 2022'den beri Ukrayna ve Rusya, üçü öbür yıllar. */
const CONFIRMED = [
  ...['UKBB', 'UKDD', 'UKDE', 'UKDR', 'UKFF', 'UKHH', 'UKKK', 'UKLI', 'UKLL', 'UKLN', 'UKLR'],
  ...['UKLU', 'UKOH', 'UKON', 'UKOO', 'UKWW', 'URKA', 'URRP', 'UUBP', 'UUOB', 'UUOK', 'UUOL'],
  ...['UUOO', 'FZMA', 'FZNA', 'OSLK'],
]
/** Belirsiz kayıtlar: haber ve dolaylı kanıt, açılışı yakın ya da denetimi yeni el değiştiren. */
const POSSIBLE = ['GAGO', 'GAMB', 'HAAX', 'HSFS', 'HSNN', 'HSOB', 'OSKL', 'OYSN', 'OYTZ']
/** OurAirports'ta tarifesiz, kapanış tablosuyla listeye giren 23 havalimanı (D-110). */
const UNSCHEDULED = [
  ...['FZMA', 'UKBB', 'UKDD', 'UKDE', 'UKDR', 'UKFF', 'UKHH', 'UKKK', 'UKLI', 'UKLL', 'UKLN'],
  ...['UKLR', 'UKLU', 'UKOH', 'UKON', 'UKOO', 'UKWW', 'URKA', 'URRP', 'UUBP', 'UUOB', 'UUOK'],
  'UUOL',
]

describe('CIVIL_FLIGHT_CLOSURES (savaş nedeniyle kapalı havalimanları, D-110; D-090)', () => {
  it('35 kayıt, ICAO sırasıyla; tarih biçimi ve aralığı', () => {
    const codes = Object.keys(CIVIL_FLIGHT_CLOSURES)
    expect(codes).toHaveLength(35)
    expect(codes).toEqual(codes.toSorted())
    expect(codes.toSorted()).toEqual([...CONFIRMED, ...POSSIBLE].sort())
    for (const [icao, closure] of Object.entries(CIVIL_FLIGHT_CLOSURES)) {
      expect(icao).toMatch(/^[A-Z]{4}$/)
      expect(closure.since, icao).toMatch(/^\d{4}-\d{2}(-\d{2})?$/)
      expect(Number.isNaN(Date.parse(closure.since)), icao).toBe(false)
      const year = Number(closure.since.slice(0, 4))
      expect(year, icao).toBeGreaterThanOrEqual(2015)
      expect(year, icao).toBeLessThanOrEqual(2026)
    }
    expect(civilFlightClosure('UKBB')).toEqual({ since: '2022-02-24', certainty: 'confirmed' })
    expect(civilFlightClosure('OYTZ')).toEqual({ since: '2015-10', certainty: 'possible' })
    expect(civilFlightClosure('FZNA')?.since).toBe('2025-01-27')
    expect(civilFlightClosure('FZMA')?.since).toBe('2025-02-14')
    expect(civilFlightClosure('OSLK')?.since).toBe('2024-12-08')
    expect(civilFlightClosure('OSKL')).toEqual({ since: '2024-12-08', certainty: 'possible' })
    expect(civilFlightClosure('OYSN')?.since).toBe('2025-05-28')
    for (const icao of ['HSFS', 'HSNN', 'HSOB']) {
      expect(civilFlightClosure(icao)?.since, icao).toBe('2023-04-15')
    }
    expect(civilFlightClosure('HAAX')?.since).toBe('2026-09-23')
    for (const icao of ['GAGO', 'GAMB']) {
      expect(civilFlightClosure(icao)?.since, icao).toBe('2026-04-28')
    }
  })

  it('not türü: 26 kesin, 9 belirsiz', () => {
    const by = (certainty: string) =>
      Object.entries(CIVIL_FLIGHT_CLOSURES)
        .filter(([, closure]) => closure.certainty === certainty)
        .map(([icao]) => icao)
        .sort()
    expect(by('confirmed')).toEqual(CONFIRMED.toSorted())
    expect(by('possible')).toEqual(POSSIBLE.toSorted())
    expect(CONFIRMED).toHaveLength(26)
    expect(POSSIBLE).toHaveLength(9)
    // Ukrayna ve Rusya'nın 23 kaydı 2022-02-24'ten beri kesin.
    for (const icao of CONFIRMED.filter((code) => /^U[KRU]/.test(code))) {
      expect(civilFlightClosure(icao), icao).toEqual({
        since: '2022-02-24',
        certainty: 'confirmed',
      })
    }
  })

  it("fixture: 35 kaydın hepsi açık halkada listelenir; 23'ü OurAirports'ta tarifesizdir", () => {
    const listedClosed = listedForeign.filter((icao) => civilFlightClosure(icao) !== undefined)
    expect(listedClosed.toSorted()).toEqual(Object.keys(CIVIL_FLIGHT_CLOSURES).sort())
    const unscheduled = listedRows
      .filter((r) => civilFlightClosure(icaoOf(r)) !== undefined)
      .filter((r) => r.get('scheduled_service') !== 'yes')
      .map(icaoOf)
      .sort()
    expect(unscheduled).toEqual(UNSCHEDULED)
    // Tarifesizler halka analizinin adayı değildir (OurAirports bayrağı); liste kuralı onları alır.
    for (const r of listedRows.filter((row) => UNSCHEDULED.includes(icaoOf(row)))) {
      expect(
        isScheduledIataAirport(r.get('type') ?? '', false, r.get('iata_code')),
        icaoOf(r),
      ).toBe(false)
      expect(isScheduledIataAirport(r.get('type') ?? '', true, r.get('iata_code')), icaoOf(r)).toBe(
        true,
      )
    }
    // Halka dağılımı: 1. halkada 2, 2. halkada 15, 3. halkada 5, 4. halkada 1 (Bukavu).
    const rings = listedRows
      .filter((r) => UNSCHEDULED.includes(icaoOf(r)))
      .map(ringOf)
      .reduce<Record<number, number>>((acc, ring) => ({ ...acc, [ring]: (acc[ring] ?? 0) + 1 }), {})
    expect(rings).toEqual({ 1: 2, 2: 15, 3: 5, 4: 1 })
  })

  it('yeniden açılanlar tabloda yok ama listede: Krasnodar, Gelencik, Elista; Mekele', () => {
    for (const icao of ['URKK', 'URKG', 'URWI', 'HAMK']) {
      expect(civilFlightClosure(icao), icao).toBeUndefined()
      expect(listedForeign, icao).toContain(icao)
    }
    // Kırım'daki Simferopol tablodadır (Ukrayna NOTAM'ı ve Rosaviatsiya kısıtlaması).
    expect(civilFlightClosure('UKFF')?.certainty).toBe('confirmed')
  })

  it('Türkiye havalimanı yok; her kaydın küratörlü adı var; kod kırpılır, prototip anahtarı kayıt değil', () => {
    for (const icao of Object.keys(CIVIL_FLIGHT_CLOSURES)) {
      expect(Object.hasOwn(AIRPORT_NAMES, icao), icao).toBe(false)
      expect(Object.hasOwn(FOREIGN_AIRPORT_NAMES, icao), icao).toBe(true)
      expect(isMilitaryAirfield(icao), icao).toBe(false)
    }
    expect(civilFlightClosure(' uuoo ')).toEqual({ since: '2022-02-24', certainty: 'confirmed' })
    expect(civilFlightClosure('UUEE')).toBeUndefined()
    expect(civilFlightClosure('LTFM')).toBeUndefined()
    expect(civilFlightClosure('')).toBeUndefined()
    expect(civilFlightClosure('toString')).toBeUndefined()
    expect(civilFlightClosure('__proto__')).toBeUndefined()
  })

  it('aday kuralı: tablodaki tarifesiz havalimanı adaydır; öbür koşullar geçerli', () => {
    expect(isForeignCandidate('large_airport', false, 'KBP', 'UKBB')).toBe(true)
    expect(isForeignCandidate('medium_airport', false, 'kbp', ' ukbb ')).toBe(true)
    expect(isForeignCandidate('large_airport', false, 'ATH', 'LGAV')).toBe(false)
    for (const type of ['small_airport', 'heliport', 'closed']) {
      expect(isForeignCandidate(type, false, 'KBP', 'UKBB'), type).toBe(false)
    }
    expect(isForeignCandidate('large_airport', false, null, 'UKBB')).toBe(false)
    expect(isForeignCandidate('large_airport', false, 'KBP', null)).toBe(false)
  })
})
