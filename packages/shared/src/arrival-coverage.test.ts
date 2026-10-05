import { describe, expect, it } from 'vitest'
import {
  ARRIVAL_AGL_BUCKETS,
  ARRIVAL_ARP_KM,
  ARRIVAL_BARO_RATE_BELOW_FPM,
  ARRIVAL_CANDIDATE_BOX_KM,
  ARRIVAL_CANDIDATE_RULE,
  ARRIVAL_COVERAGE_CLOSED_RECORD_MS,
  ARRIVAL_COVERAGE_DEFINITION_VERSION,
  ARRIVAL_COVERAGE_HOURS,
  ARRIVAL_COVERAGE_LOOKBACK_MS,
  ARRIVAL_COVERAGE_SETTLE_MS,
  ARRIVAL_DISTANCE_BUCKETS,
  ARRIVAL_GROUND_ARP_KM,
  ARRIVAL_GROUND_SHARE_MIN,
  ARRIVAL_LOW_SAMPLE_ARRIVALS,
  ARRIVAL_MAX_ABOVE_FIELD_FT,
  ARRIVAL_MEDIAN_AGL_MAX_FT,
  ARRIVAL_MEDIAN_THRESHOLD_MAX_KM,
  ARRIVAL_SEEN_POS_BUCKETS,
  ARRIVAL_ZONE_KM,
  arrivalBucketKey,
  arrivalCoverageDefinitions,
  arrivalCoverageWindow,
  arrivalQnhBiasFt,
  ceilToStep,
  emptyArrivalBucketCounts,
  landingRuleHolds,
  median,
  quantileSorted,
  resolveArrivalGeoid,
  sortedFinite,
  wilsonInterval,
} from './arrival-coverage'

describe('arrival coverage definitions', () => {
  it('match the prompt and the amendments', () => {
    expect(ARRIVAL_COVERAGE_DEFINITION_VERSION).toBe(1)
    expect(ARRIVAL_ARP_KM).toBe(15)
    expect(ARRIVAL_MAX_ABOVE_FIELD_FT).toBe(3000)
    expect(ARRIVAL_BARO_RATE_BELOW_FPM).toBe(-300)
    expect(ARRIVAL_GROUND_ARP_KM).toBe(6)
    expect(ARRIVAL_ZONE_KM).toBe(30)
    expect(ARRIVAL_COVERAGE_SETTLE_MS).toBe(45 * 60_000)
    expect(ARRIVAL_COVERAGE_CLOSED_RECORD_MS).toBe(30 * 60_000)
    expect(ARRIVAL_COVERAGE_LOOKBACK_MS).toBe(24 * 3_600_000)
    expect(ARRIVAL_GROUND_SHARE_MIN).toBe(0.7)
    expect(ARRIVAL_MEDIAN_AGL_MAX_FT).toBe(1000)
    expect(ARRIVAL_MEDIAN_THRESHOLD_MAX_KM).toBe(8)
    expect(ARRIVAL_LOW_SAMPLE_ARRIVALS).toBe(20)
    expect([...ARRIVAL_COVERAGE_HOURS]).toEqual([6, 12, 24, 48, 72, 168])
  })

  it('the SQL candidate rule is a superset of the arrival definition', () => {
    expect(ARRIVAL_CANDIDATE_BOX_KM).toBeGreaterThan(ARRIVAL_ARP_KM)
    expect(ARRIVAL_CANDIDATE_RULE).toEqual({
      boxKm: 15.5,
      maxAboveFieldFt: ARRIVAL_MAX_ABOVE_FIELD_FT,
      baroRateBelowFpm: ARRIVAL_BARO_RATE_BELOW_FPM,
      includeGeomOnly: true,
    })
    expect(Object.isFrozen(ARRIVAL_CANDIDATE_RULE)).toBe(true)
  })

  it('the definitions snapshot is plain JSON and copies the tables', () => {
    const d = arrivalCoverageDefinitions()
    expect(JSON.parse(JSON.stringify(d))).toEqual(d)
    expect(d.geoidFallbackM).toEqual({ LTFM: 37.05, LTFJ: 37.61, LTAI: 27.36 })
    expect(d.landingRules.high).toEqual({
      maxAglFt: 300,
      aglInclusive: true,
      maxKm: 3,
      frame: 'threshold',
    })
  })
})

describe('arrivalCoverageWindow', () => {
  it('ends settle before the job start and starts hours earlier; closed cutoff and lookback', () => {
    const jobStart = Date.parse('2026-10-06T12:00:00Z')
    const w = arrivalCoverageWindow(jobStart, 24)
    expect(new Date(w.end).toISOString()).toBe('2026-10-06T11:15:00.000Z')
    expect(new Date(w.start).toISOString()).toBe('2026-10-05T11:15:00.000Z')
    expect(new Date(w.closedCutoff).toISOString()).toBe('2026-10-06T11:30:00.000Z')
    expect(new Date(w.lookbackStart).toISOString()).toBe('2026-10-04T11:15:00.000Z')
    expect(w.jobStart).toBe(jobStart)
  })
})

describe('resolveArrivalGeoid', () => {
  it('station value first, then the fallback table, else null', () => {
    expect(resolveArrivalGeoid('LTFM', 36.9)).toEqual({ geoidM: 36.9, source: 'station' })
    expect(resolveArrivalGeoid('LTFM', null)).toEqual({ geoidM: 37.05, source: 'fallback' })
    expect(resolveArrivalGeoid('ltfj', null)).toEqual({ geoidM: 37.61, source: 'fallback' })
    expect(resolveArrivalGeoid('LTAI', null)).toEqual({ geoidM: 27.36, source: 'fallback' })
    expect(resolveArrivalGeoid('LTAC', null)).toEqual({ geoidM: null, source: null })
    expect(resolveArrivalGeoid('LTBJ', Number.NaN)).toEqual({ geoidM: null, source: null })
  })
})

describe('QNH bias', () => {
  it('is (QNH - 1013.25) x 27 ft', () => {
    expect(arrivalQnhBiasFt(1013.25)).toBe(0)
    expect(arrivalQnhBiasFt(1030)).toBeCloseTo(452.25, 6)
    expect(arrivalQnhBiasFt(1000)).toBeCloseTo(-357.75, 6)
  })
})

describe('landingRuleHolds', () => {
  it('high: AGL <= 300 ft inclusive and threshold <= 3 km', () => {
    expect(landingRuleHolds('high', 300, 3, 99)).toBe(true)
    expect(landingRuleHolds('high', 300.1, 3, 0)).toBe(false)
    expect(landingRuleHolds('high', 0, 3.001, 0)).toBe(false)
  })
  it('medium: AGL < 1000 ft exclusive and ARP <= 8 km', () => {
    expect(landingRuleHolds('medium', 999.9, 99, 8)).toBe(true)
    expect(landingRuleHolds('medium', 1000, 0, 0)).toBe(false)
    expect(landingRuleHolds('medium', 0, 0, 8.001)).toBe(false)
  })
  it('low: AGL < 3000 ft and ARP <= 20 km', () => {
    expect(landingRuleHolds('low', 2999, 99, 20)).toBe(true)
    expect(landingRuleHolds('low', 3000, 0, 0)).toBe(false)
    expect(landingRuleHolds('low', -50, 0, 20.5)).toBe(false)
  })
})

describe('buckets', () => {
  it('seen_pos: negative, half-open edges, >= 60 and unknown', () => {
    const key = (v: number | null) => arrivalBucketKey(ARRIVAL_SEEN_POS_BUCKETS, v)
    expect(key(-0.1)).toBe('lt0')
    expect(key(0)).toBe('0-1')
    expect(key(0.999)).toBe('0-1')
    expect(key(1)).toBe('1-2')
    expect(key(2)).toBe('2-5')
    expect(key(5)).toBe('5-10')
    expect(key(10)).toBe('10-30')
    expect(key(30)).toBe('30-60')
    expect(key(59.99)).toBe('30-60')
    expect(key(60)).toBe('ge60')
    expect(key(null)).toBe('unknown')
    expect(key(Number.NaN)).toBe('unknown')
  })
  it('AGL keeps the sign; distance from 0', () => {
    expect(arrivalBucketKey(ARRIVAL_AGL_BUCKETS, -1)).toBe('lt0')
    expect(arrivalBucketKey(ARRIVAL_AGL_BUCKETS, 0)).toBe('0-300')
    expect(arrivalBucketKey(ARRIVAL_AGL_BUCKETS, 300)).toBe('300-1000')
    expect(arrivalBucketKey(ARRIVAL_AGL_BUCKETS, 3000)).toBe('ge3000')
    expect(arrivalBucketKey(ARRIVAL_DISTANCE_BUCKETS, 0)).toBe('0-3')
    expect(arrivalBucketKey(ARRIVAL_DISTANCE_BUCKETS, 8)).toBe('8-15')
    expect(arrivalBucketKey(ARRIVAL_DISTANCE_BUCKETS, 30)).toBe('ge30')
    expect(arrivalBucketKey(ARRIVAL_DISTANCE_BUCKETS, -1)).toBe('unknown')
  })
  it('empty counts list every key in order', () => {
    expect(Object.keys(emptyArrivalBucketCounts(ARRIVAL_SEEN_POS_BUCKETS, true))).toEqual([
      'lt0',
      '0-1',
      '1-2',
      '2-5',
      '5-10',
      '10-30',
      '30-60',
      'ge60',
      'unknown',
    ])
    expect(Object.keys(emptyArrivalBucketCounts(ARRIVAL_DISTANCE_BUCKETS, false))).toHaveLength(5)
  })
})

describe('statistics', () => {
  it('quantile type 7: an even-count median is the mean of the middle values', () => {
    expect(quantileSorted([], 0.5)).toBeNull()
    expect(quantileSorted([7], 0.9)).toBe(7)
    expect(quantileSorted([1, 2, 3], 0.5)).toBe(2)
    expect(quantileSorted([1, 2, 3, 10], 0.5)).toBe(2.5)
    expect(quantileSorted([0, 10], 0.9)).toBe(9)
    expect(quantileSorted([1, 2, 3, 4, 5], 0)).toBe(1)
    expect(quantileSorted([1, 2, 3, 4, 5], 1)).toBe(5)
  })
  it('median ignores null and non-finite values', () => {
    expect(median([3, null, 1, Number.NaN, 2])).toBe(2)
    expect(median([null])).toBeNull()
    expect(sortedFinite([3, -1, null, Infinity, 2])).toEqual([-1, 2, 3])
  })
  it('Wilson 95 % interval', () => {
    expect(wilsonInterval(0, 0)).toBeNull()
    const w = wilsonInterval(7, 10)
    expect(w?.low).toBeCloseTo(0.3968, 4)
    expect(w?.high).toBeCloseTo(0.8922, 4)
    const all = wilsonInterval(20, 20)
    expect(all?.high).toBe(1)
    expect(all?.low).toBeCloseTo(0.8389, 4)
    expect(wilsonInterval(0, 5)?.low).toBe(0)
  })
  it('ceilToStep rounds up and keeps exact multiples', () => {
    expect(ceilToStep(1201, 100)).toBe(1300)
    expect(ceilToStep(1200, 100)).toBe(1200)
    expect(ceilToStep(-49, 100)).toBe(0)
    expect(ceilToStep(2.0000000001, 0.5)).toBe(2)
    expect(ceilToStep(2.01, 0.5)).toBe(2.5)
    expect(ceilToStep(0.3, 0.1)).toBe(0.3)
  })
})
