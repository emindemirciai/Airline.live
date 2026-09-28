import type { LatLon } from '@havayolu/geo'

/**
 * Senaryolarda kullanılan havalimanı merkezleri (ARP) ve alan yükseklikleri. Değerler commit'li
 * OurAirports alt kümesiyle aynıdır (tools/fixtures/ourairports/airports.csv; testte denetlenir).
 */
export interface ScenarioAirport extends LatLon {
  icao: string
  elevationFt: number
}

export const AIRPORTS = {
  IST: { icao: 'LTFM', lat: 41.274874, lon: 28.732136, elevationFt: 325 },
  SAW: { icao: 'LTFJ', lat: 40.898602, lon: 29.3092, elevationFt: 312 },
  ESB: { icao: 'LTAC', lat: 40.128101, lon: 32.995098, elevationFt: 3125 },
  ADB: { icao: 'LTBJ', lat: 38.2924, lon: 27.157, elevationFt: 412 },
  AYT: { icao: 'LTAI', lat: 36.898701, lon: 30.800501, elevationFt: 177 },
  VAN: { icao: 'LTCI', lat: 38.46820068359375, lon: 43.332298278808594, elevationFt: 5480 },
  TZX: { icao: 'LTCG', lat: 40.995098, lon: 39.7897, elevationFt: 104 },
  DIY: { icao: 'LTCC', lat: 37.893902, lon: 40.201, elevationFt: 2251 },
  ERZ: { icao: 'LTCE', lat: 39.956501, lon: 41.1702, elevationFt: 5763 },
} as const satisfies Record<string, ScenarioAirport>

export type AirportCode = keyof typeof AIRPORTS

/**
 * LTFM 35L: eşik ve pistin karşı ucu (17R), OurAirports runways.csv. Pist yönü uçlardan hesaplanır;
 * LTFM'de heading alanı hatalıdır (D-066).
 */
export const LTFM_35L = {
  threshold: { lat: 41.26190185546875, lon: 28.725299835205078 },
  farEnd: { lat: 41.29880142211914, lon: 28.72450065612793 },
  thresholdElevationFt: 310,
} as const
