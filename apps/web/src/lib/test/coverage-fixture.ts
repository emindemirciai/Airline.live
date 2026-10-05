// Yalnızca testlerde kullanılan kapsama raporu örnekleri (üretim kodu bunları import edemez).
import type { CoverageDetail, CoverageReport, CoverageResultSummary } from '../arrival-coverage'

/** Bitmiş bir rapor (API biçimi); pencere 24 sa, 90 sn sürmüş. */
export function coverageReportFixture(overrides: Partial<CoverageReport> = {}): CoverageReport {
  return {
    id: 7,
    status: 'done',
    hours: 24,
    requestedAt: '2026-10-06T10:00:00.000Z',
    startedAt: '2026-10-06T10:00:05.000Z',
    finishedAt: '2026-10-06T10:01:35.000Z',
    windowStart: '2026-10-05T09:15:05.000Z',
    windowEnd: '2026-10-06T09:15:05.000Z',
    error: null,
    definitionVersion: 1,
    ...overrides,
  }
}

/** API sonucunun sayfada gösterilen alt kümesi: LTAI'de 3 varış, 1 yerde örneği, kural 1. */
export const COVERAGE_RESULT_FIXTURE: CoverageResultSummary = {
  definitionVersion: 1,
  window: { start: '2026-10-05T09:15:05.000Z', end: '2026-10-06T09:15:05.000Z', hours: 24 },
  effectiveStart: '2026-10-05T09:15:05.000Z',
  dataGapWarning: false,
  stations: [
    {
      icao: 'LTAI',
      iata: 'AYT',
      arrivals: 3,
      openRecordArrivals: 0,
      groundSeen: 1,
      groundShare: 1 / 3,
      groundShareWilson: { low: 0.0615, high: 0.7923 },
      all: { medianAglFt: 412.4, medianThresholdKm: 2.73 },
      rule1: { verdict: 'applies', borderline: true, lowSample: true },
      rule2: { verdict: 'does_not_apply', borderline: false, lowSample: true },
    },
  ],
  totals: { arrivals: 3, groundSeen: 1, openRecordArrivals: 0 },
}

export const COVERAGE_MARKDOWN_FIXTURE =
  '# Kapsama raporu\n\nCanlı uçuş verisi: ADSB.lol — ODbL 1.0\n'

export function coverageDetailFixture(overrides: Partial<CoverageDetail> = {}): CoverageDetail {
  return {
    ...coverageReportFixture(),
    result: COVERAGE_RESULT_FIXTURE,
    markdown: COVERAGE_MARKDOWN_FIXTURE,
    checkedAt: '2026-10-06T10:02:00.000Z',
    ...overrides,
  }
}
