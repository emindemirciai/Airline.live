import type { AirportDetail, RunwayDetail } from '@havayolu/shared'

/** Testler için tam bir `AirportDetail`; verilmeyen alanlar LTFM benzeri sabit değerlerdir. */
export function airportFixture(
  overrides: Partial<AirportDetail> & Pick<AirportDetail, 'icao'>,
): AirportDetail {
  return {
    iata: 'XXX',
    name: `${overrides.icao} Airport`,
    city: null,
    lat: 41,
    lon: 29,
    elevationFt: 325,
    type: 'medium_airport',
    scheduled: true,
    isoRegion: 'TR-34',
    municipality: null,
    country: 'TR',
    ring: 0,
    distanceToTrKm: null,
    nearestTr: null,
    station: null,
    dataUpdatedAt: '2026-09-20T04:40:00.000Z',
    runways: [runwayFixture()],
    ...overrides,
  }
}

export function runwayFixture(overrides: Partial<RunwayDetail> = {}): RunwayDetail {
  return {
    id: 1,
    lengthFt: 9843,
    widthFt: 148,
    surface: 'CON',
    lighted: true,
    ends: [
      {
        ident: '05',
        trueBearingDeg: 52.4,
        displacedThresholdFt: null,
        thresholdLat: null,
        thresholdLon: null,
      },
      {
        ident: '23',
        trueBearingDeg: 232.4,
        displacedThresholdFt: null,
        thresholdLat: null,
        thresholdLon: null,
      },
    ],
    ...overrides,
  }
}
