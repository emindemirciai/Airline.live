import {
  arrivalCoverageDefinitions,
  ARRIVAL_COVERAGE_DEFINITION_VERSION,
  type ArrivalCoverageResult,
  type ArrivalCoverageStationResult,
  type ArrivalShare,
  type ArrivalSubsetStats,
} from '@havayolu/shared'

/**
 * `runCoverageReport` testleri için elle kurulmuş rapor sonucu (gerçek hesap entegrasyon
 * testindedir). Varsayılan: LTAI'de 3 varış, 1 yerde örneği; kural 1 uygulanır (sınırda, az örnek),
 * kural 2 uygulanmaz.
 */

const emptyShare: ArrivalShare = { count: 0, n: 0, share: null, low: null, high: null }

function subset(overrides: Partial<ArrivalSubsetStats> = {}): ArrivalSubsetStats {
  return {
    n: 0,
    withAgl: 0,
    medianAglFt: null,
    medianAglRangeFt: null,
    medianThresholdKm: null,
    medianArpKm: null,
    aglQuantilesFt: null,
    thresholdQuantilesKm: null,
    arpQuantilesKm: null,
    proposals: { threshold: [], arp: [] },
    capture: { high: emptyShare, medium: emptyShare, low: emptyShare, high_or_medium: emptyShare },
    ...overrides,
  }
}

export function stationResult(
  overrides: Partial<ArrivalCoverageStationResult> = {},
): ArrivalCoverageStationResult {
  return {
    icao: 'LTAI',
    iata: 'AYT',
    elevationFt: 177,
    geoidM: 27.36,
    geoidSource: 'fallback',
    thresholds: 6,
    thresholdFallbackOnly: false,
    thresholdElevationDeltaFt: { min: -19, max: -1 },
    effectiveWindow: {
      start: '2026-10-05T07:00:00.000Z',
      airborneSamples: 120,
      baroRateNullShare: 0,
      seenPosNullShare: 0,
      warning: false,
    },
    arrivals: 3,
    openRecordArrivals: 0,
    groundSeen: 1,
    groundShare: 1 / 3,
    groundShareWilson: { low: 0.0615, high: 0.7923 },
    groundShareExcludingLeft: { count: 1, n: 3, share: 1 / 3, low: null, high: null },
    noGround: { lost_low: 2, left_zone: 0, other_field: 0 },
    aglMethods: { geoid: 3, baro_tolerant: 0, unknown: 0 },
    all: subset({ n: 3, withAgl: 3, medianAglFt: 308.2, medianThresholdKm: 1.5, medianArpKm: 3.4 }),
    lostLow: subset({ n: 2, withAgl: 2, medianAglFt: 437, medianThresholdKm: 2.25 }),
    aglHistogram: {},
    thresholdHistogram: {},
    arpHistogram: {},
    seenPos: { samples: 0, buckets: {}, p50: null, p90: null, p99: null },
    medianGapS: 5,
    lowWeightShare: 0,
    lowWeightLastAirborne: 0,
    qnh: null,
    baroToleranceFt: { low: -300, high: 300 },
    geomOnly: { arrivals: 0, groundSeen: 0, groundShare: null },
    degradedAfterArrival: 0,
    rule1: { verdict: 'applies', borderline: true, lowSample: true },
    rule2: { verdict: 'does_not_apply', borderline: false, lowSample: true },
    notes: ['geoid_fallback'],
    ...overrides,
  }
}

export function coverageResult(
  overrides: Partial<ArrivalCoverageResult> = {},
): ArrivalCoverageResult {
  const stations = overrides.stations ?? [stationResult()]
  return {
    definitionVersion: ARRIVAL_COVERAGE_DEFINITION_VERSION,
    definitions: arrivalCoverageDefinitions(),
    jobStart: '2026-10-05T12:00:00.000Z',
    window: { start: '2026-10-04T11:15:00.000Z', end: '2026-10-05T11:15:00.000Z', hours: 24 },
    effectiveStart: '2026-10-04T11:15:00.000Z',
    dataGapWarning: false,
    provider: null,
    totals: {
      arrivals: stations.reduce((t, s) => t + s.arrivals, 0),
      groundSeen: stations.reduce((t, s) => t + s.groundSeen, 0),
      openRecordArrivals: stations.reduce((t, s) => t + s.openRecordArrivals, 0),
    },
    ...overrides,
    stations,
  }
}
