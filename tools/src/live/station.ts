import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ourAirportsIcao } from '@havayolu/db'
import { parseAirports } from '@havayolu/providers'
import { LiveArgsError } from './args'

/**
 * Klasör başına bir kez ayrıştırılan fixture satırları (D-109: 5. halkayla 3.624 satır; smoke her
 * istasyon için, testler her çağrıda yeniden ayrıştırıyordu).
 */
const parsedFixtures = new Map<string, ReturnType<typeof parseAirports>['rows']>()

function fixtureAirports(fixturesDir: string): ReturnType<typeof parseAirports>['rows'] {
  let rows = parsedFixtures.get(fixturesDir)
  if (rows === undefined) {
    rows = parseAirports(
      readFileSync(join(fixturesDir, 'ourairports', 'airports.csv'), 'utf8'),
    ).rows
    parsedFixtures.set(fixturesDir, rows)
  }
  return rows
}

export interface StationPoint {
  icao: string
  lat: number
  lon: number
}

/**
 * İstasyonun ARP'ı, commit'li OurAirports fixture'ından (`<fixturesDir>/ourairports/airports.csv`;
 * ağa çıkılmaz). Eşleşme uygulamanın kanonik ICAO'suyla yapılır (`ourAirportsIcao`: `icao_code`,
 * `gps_code`, `ident` ve D-088 düzeltmeleri): Semerkant UZSS ile bulunur, OurAirports kimliği UTSS
 * ile bulunmaz. Bilinmeyen kod LiveArgsError verir.
 */
export function findStationPoint(icao: string, fixturesDir: string): StationPoint {
  const code = icao.trim().toUpperCase()
  if (!/^[A-Z]{4}$/.test(code)) {
    throw new LiveArgsError('--station 4 harfli bir ICAO kodu olmalı (ör. LTFM)')
  }
  const row = fixtureAirports(fixturesDir).find((airport) => ourAirportsIcao(airport) === code)
  if (row === undefined) {
    throw new LiveArgsError(
      `${code} OurAirports fixture'ında yok (tools/fixtures/ourairports/airports.csv)`,
    )
  }
  return { icao: code, lat: row.latitudeDeg, lon: row.longitudeDeg }
}
