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
  .map(position)
/** Açık halkalardaki yabancı havalimanları (liste kuralı, D-080). */
const listedForeign = rows
  .filter((r) => r.get('iso_country') !== 'TR')
  .filter((r) =>
    isForeignCandidate(
      r.get('type') ?? '',
      r.get('scheduled_service') === 'yes',
      r.get('iata_code'),
    ),
  )
  .filter((r) => {
    const here = position(r)
    return airportRing(Math.min(...references.map((tr) => km(here, tr)))) <= ENABLED_AIRPORT_RING
  })
  .map(icaoOf)

describe('CIVIL_FLIGHT_CLOSURES (kullanıcı kararı 2026-10-04, D-090)', () => {
  it("Rosaviatsiya'nın 2022-02-24 kısıtlamasındaki on Rusya havalimanı; Simferopol yok", () => {
    expect(Object.keys(CIVIL_FLIGHT_CLOSURES).sort()).toEqual(
      ['URKA', 'URKG', 'URKK', 'URRP', 'URWI', 'UUBP', 'UUOB', 'UUOK', 'UUOL', 'UUOO'].sort(),
    )
    for (const [icao, closure] of Object.entries(CIVIL_FLIGHT_CLOSURES)) {
      expect(icao).toMatch(/^[A-Z]{4}$/)
      expect(closure.since, icao).toBe('2022-02-24')
      expect(Number.isNaN(Date.parse(closure.since)), icao).toBe(false)
    }
    expect(civilFlightClosure('UKFF')).toBeUndefined()
    expect(civilFlightClosure('URFF')).toBeUndefined()
  })

  it('listede olanlar: Krasnodar, Gelencik (1. halka), Elista (2. halka), Voronej (3. halka)', () => {
    const listedClosed = listedForeign.filter((icao) => civilFlightClosure(icao) !== undefined)
    expect(listedClosed.sort()).toEqual(['URKG', 'URKK', 'URWI', 'UUOO'])
    // Hepsinin küratörlü adı vardır (sayfa ve pencere notu adın yanında gösterir).
    for (const icao of listedClosed) {
      expect(Object.hasOwn(FOREIGN_AIRPORT_NAMES, icao), icao).toBe(true)
    }
    // 2026-10-01 indirmesinde tarifesiz olan altısı fixture'da yoktur (aday değil, listelenmez).
    const fixtureIcaos = new Set(rows.map(icaoOf))
    for (const icao of ['URKA', 'URRP', 'UUBP', 'UUOB', 'UUOK', 'UUOL']) {
      expect(fixtureIcaos.has(icao), icao).toBe(false)
    }
  })

  it('Türkiye havalimanı tabloda değildir; kod kırpılır ve büyük harfe çevrilir', () => {
    for (const icao of Object.keys(CIVIL_FLIGHT_CLOSURES)) {
      expect(Object.hasOwn(AIRPORT_NAMES, icao), icao).toBe(false)
    }
    expect(civilFlightClosure(' uuoo ')).toEqual({ since: '2022-02-24' })
    expect(civilFlightClosure('UUEE')).toBeUndefined()
    expect(civilFlightClosure('LTFM')).toBeUndefined()
    expect(civilFlightClosure('')).toBeUndefined()
    expect(civilFlightClosure('toString')).toBeUndefined()
    expect(civilFlightClosure('__proto__')).toBeUndefined()
  })
})
