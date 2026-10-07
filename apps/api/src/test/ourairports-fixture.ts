import { readFileSync } from 'node:fs'
import {
  turkishReferencePoints,
  type AirportDetailSourceRow,
  type RingContext,
  type RunwaySourceRow,
} from '@havayolu/db'
import { parseAirports, parseRunways } from '@havayolu/providers'
import { AIRPORT_RINGS_KM } from '@havayolu/shared'

/**
 * Commit'li OurAirports fixture'ı (tools/fixtures/README.md; 2026-10-01 kopyası), veritabanındaki
 * gibi: içe aktarım çözümleyicisi (`parseAirports`, `parseRunways`), kimlik sırası, satır biçimi
 * `@havayolu/db`'nin okuduğu gibi. 5. halkayla 3.624 havalimanı ve 4.604 pist satırıdır; test dosyası
 * başına bir kez ayrıştırılır (D-109: her testte yeniden ayrıştırmak dosyayı saniyelerce yavaşlatır).
 */
export interface ApiFixture {
  airportRows: AirportDetailSourceRow[]
  runwayRows: RunwaySourceRow[]
  /** Türkiye'deki uzaklık referansları ve halka sınırları (`@havayolu/db` `RingContext`). */
  context: RingContext
}

const fixture = (file: string) =>
  readFileSync(new URL(`../../../../tools/fixtures/ourairports/${file}`, import.meta.url), 'utf8')

let parsed: ApiFixture | undefined

export function apiFixture(): ApiFixture {
  if (parsed) return parsed
  const airports = parseAirports(fixture('airports.csv'))
  const runways = parseRunways(
    fixture('runways.csv'),
    new Map(airports.rows.map((a) => [a.id, { lat: a.latitudeDeg, lon: a.longitudeDeg }])),
  )
  if (airports.skipped.length > 0 || runways.skipped.length > 0) {
    throw new Error('fixture has skipped rows')
  }
  const updatedAt = new Date('2026-10-01T23:03:49Z')
  const airportRows: AirportDetailSourceRow[] = airports.rows
    .toSorted((a, b) => a.id - b.id)
    .map(({ rowHash: _hash, ...row }) => ({ ...row, updatedAt }))
  const runwayRows: RunwaySourceRow[] = runways.rows.map((r) => ({
    id: r.id,
    airportId: r.airportId,
    lengthFt: r.lengthFt,
    widthFt: r.widthFt,
    surface: r.surface,
    lighted: r.lighted,
    leIdent: r.le.ident,
    leTrueBearingDeg: r.le.trueBearingDeg,
    leDisplacedThresholdFt: r.le.displacedThresholdFt,
    leThresholdLat: r.le.thresholdLat,
    leThresholdLon: r.le.thresholdLon,
    heIdent: r.he.ident,
    heTrueBearingDeg: r.he.trueBearingDeg,
    heDisplacedThresholdFt: r.he.displacedThresholdFt,
    heThresholdLat: r.he.thresholdLat,
    heThresholdLon: r.he.thresholdLon,
    leLatitudeDeg: r.le.latitudeDeg,
    heLatitudeDeg: r.he.latitudeDeg,
    updatedAt,
    overrideUpdatedAt: null,
  }))
  parsed = {
    airportRows,
    runwayRows,
    context: { turkey: turkishReferencePoints(airportRows), ringsKm: AIRPORT_RINGS_KM },
  }
  return parsed
}
