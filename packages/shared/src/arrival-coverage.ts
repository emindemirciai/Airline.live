/**
 * Arrival coverage report: definitions, input and result types (Part 1 M7b.2, D-098).
 *
 * Single source for every consumer: the db readers receive these values as call parameters
 * (packages/db does not depend on shared), the worker report job and the daily 7-day ratio job
 * classify and aggregate with them, the local `coverage:report` CLI and the M7c probe reuse the
 * same code. The module is pure (no IO, no clock) and carries no Turkish text: the Turkish
 * markdown renderer lives in the worker, admin UI labels live in packages/i18n.
 *
 * Binding sources: docs/prompts/parca-1.md M7 (arrival, ground sample, AGL, decision rules) and
 * docs/spec/domain.md (AGL method section, landing confidence geometry). Changing a definition is
 * DUR-SOR and bumps ARRIVAL_COVERAGE_DEFINITION_VERSION.
 */

/** Bumped whenever a definition below changes meaning; stored on every report row. */
export const ARRIVAL_COVERAGE_DEFINITION_VERSION = 1

// ---------------------------------------------------------------------------------------------
// Arrival, ground sample, last airborne sample

/** Arrival: an airborne sample within this distance of the ARP (inclusive, haversine km). */
export const ARRIVAL_ARP_KM = 15
/** Arrival: `alt_baro <= field elevation + this` (inclusive; unknown elevation counts as 0). */
export const ARRIVAL_MAX_ABOVE_FIELD_FT = 3000
/** Arrival: raw `baro_rate` strictly below this (fpm). A null baro_rate never qualifies. */
export const ARRIVAL_BARO_RATE_BELOW_FPM = -300
/** Ground sample: `alt_baro: "ground"` within this distance of the ARP (inclusive), after firstQual. */
export const ARRIVAL_GROUND_ARP_KM = 6
/** Station zone: the last airborne sample and the seen_pos samples are taken inside it (inclusive). */
export const ARRIVAL_ZONE_KM = 30

/**
 * SQL candidate prefilter: a lat/lon box of this half-size around the ARP, with the longitude span
 * taken at the box's poleward latitude, so the box is a strict superset of the 15 km circle.
 */
export const ARRIVAL_CANDIDATE_BOX_KM = 15.5

/** Parameters for the db candidate query (`findArrivalCandidateFlights`). */
export interface ArrivalCandidateRule {
  boxKm: number
  maxAboveFieldFt: number
  baroRateBelowFpm: number
  /** Also return rows with null baro_rate and `vertical_rate_fpm` below the limit (geom-only sensitivity). */
  includeGeomOnly: boolean
}

export const ARRIVAL_CANDIDATE_RULE: Readonly<ArrivalCandidateRule> = Object.freeze({
  boxKm: ARRIVAL_CANDIDATE_BOX_KM,
  maxAboveFieldFt: ARRIVAL_MAX_ABOVE_FIELD_FT,
  baroRateBelowFpm: ARRIVAL_BARO_RATE_BELOW_FPM,
  includeGeomOnly: true,
})

// ---------------------------------------------------------------------------------------------
// Window

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000

/** Window end = job start - settle. */
export const ARRIVAL_COVERAGE_SETTLE_MS = 45 * MINUTE_MS
/** Only records closed by then count: `flights.last_seen_at <= job start - this` (flight gap rule). */
export const ARRIVAL_COVERAGE_CLOSED_RECORD_MS = 30 * MINUTE_MS
/** A record's samples are read from `max(first_seen_at, window start - this)`. */
export const ARRIVAL_COVERAGE_LOOKBACK_MS = 24 * HOUR_MS
/** Report lengths offered by the admin page and accepted by the API (hours). */
export const ARRIVAL_COVERAGE_HOURS = [6, 12, 24, 48, 72, 168] as const
export type ArrivalCoverageHours = (typeof ARRIVAL_COVERAGE_HOURS)[number]
/** Daily ratio job window length. */
export const ARRIVAL_COVERAGE_RATIO_HOURS = 7 * 24

export interface ArrivalCoverageWindow {
  /** Epoch ms. */
  jobStart: number
  /** Window start (inclusive), epoch ms: an arrival counts when firstQual is in [start, end). */
  start: number
  /** Window end (exclusive), epoch ms. */
  end: number
  /** Records whose last_seen_at is after this are open and do not count. */
  closedCutoff: number
  /** Earliest sample time read for a record (window start - lookback). */
  lookbackStart: number
}

/** Window for a job that starts at `jobStartMs` and covers `hours` hours. */
export function arrivalCoverageWindow(jobStartMs: number, hours: number): ArrivalCoverageWindow {
  const end = jobStartMs - ARRIVAL_COVERAGE_SETTLE_MS
  const start = end - hours * HOUR_MS
  return {
    jobStart: jobStartMs,
    start,
    end,
    closedCutoff: jobStartMs - ARRIVAL_COVERAGE_CLOSED_RECORD_MS,
    lookbackStart: start - ARRIVAL_COVERAGE_LOOKBACK_MS,
  }
}

// ---------------------------------------------------------------------------------------------
// AGL

/** Baro AGL (`alt_baro - field elevation`) uncertainty, both directions (ft). */
export const ARRIVAL_BARO_AGL_TOLERANCE_FT = 300
/** domain.md geoid formula: `alt_geom_ft - N_m * 3.28084 - field_elevation_ft`. */
export const ARRIVAL_GEOID_FT_PER_M = 3.28084

/**
 * EGM96 geoid undulation fallback (m) used when `stations.geoid_undulation_m` is null
 * (docs/research/2026-09-25-kaynak-dogrulama.md). Other stations use the baro method.
 */
export const ARRIVAL_COVERAGE_GEOID_FALLBACK_M: Readonly<Record<string, number>> = Object.freeze({
  LTFM: 37.05,
  LTFJ: 37.61,
  LTAI: 27.36,
})

export type ArrivalGeoidSource = 'station' | 'fallback'

/** Station value first, then the fallback table; null when neither exists. */
export function resolveArrivalGeoid(
  icao: string,
  stationGeoidM: number | null,
): { geoidM: number | null; source: ArrivalGeoidSource | null } {
  if (stationGeoidM !== null && Number.isFinite(stationGeoidM)) {
    return { geoidM: stationGeoidM, source: 'station' }
  }
  const fallback = ARRIVAL_COVERAGE_GEOID_FALLBACK_M[icao.trim().toUpperCase()]
  return fallback === undefined
    ? { geoidM: null, source: null }
    : { geoidM: fallback, source: 'fallback' }
}

/** QNH sensitivity (domain.md "qnh" method): `alt_baro + (QNH - 1013.25) * 27 - elevation`. */
export const ARRIVAL_QNH_STANDARD_HPA = 1013.25
export const ARRIVAL_QNH_FT_PER_HPA = 27
/** A METAR QNH applies to samples at most this long after its observation time. */
export const ARRIVAL_QNH_MAX_AGE_MS = 90 * MINUTE_MS

/** Implied baro AGL bias for a QNH value (ft): true AGL ~ baro AGL + bias. */
export function arrivalQnhBiasFt(qnhHpa: number): number {
  return (qnhHpa - ARRIVAL_QNH_STANDARD_HPA) * ARRIVAL_QNH_FT_PER_HPA
}

// ---------------------------------------------------------------------------------------------
// No-ground classification, data quality, provider

/** left_zone: record seen after the last airborne sample by more than max(this, 3 x median gap). */
export const ARRIVAL_LEFT_ZONE_MIN_MS = 120_000
export const ARRIVAL_LEFT_ZONE_GAP_FACTOR = 3
/** other_field: known airfields (OurAirports, incl. military) within this distance of the ARP. */
export const ARRIVAL_NEARBY_AIRFIELD_KM = 30
/** Arrivals with provider status degraded/down within this time after firstQual are counted. */
export const ARRIVAL_PROVIDER_DEGRADED_WITHIN_MS = 10 * MINUTE_MS
/** Header warning when the null share of baro_rate or seen_pos among airborne samples exceeds this. */
export const ARRIVAL_DATA_GAP_WARNING_SHARE = 0.05

// ---------------------------------------------------------------------------------------------
// Decision rules (input to Part 2)

/** Rule 1: ground share below this -> landings are presented as "probable" by default. */
export const ARRIVAL_GROUND_SHARE_MIN = 0.7
/** Rule 2: median last-airborne AGL above this (ft) -> DUR-SOR. */
export const ARRIVAL_MEDIAN_AGL_MAX_FT = 1000
/** Rule 2: median distance from the last airborne sample to the threshold above this (km) -> DUR-SOR. */
export const ARRIVAL_MEDIAN_THRESHOLD_MAX_KM = 8
/** Fewer arrivals than this -> low-sample flag (the rule is still stated). */
export const ARRIVAL_LOW_SAMPLE_ARRIVALS = 20
/** Two-sided 95 % normal quantile for the Wilson interval. */
export const ARRIVAL_WILSON_Z_95 = 1.959963984540054

/** Threshold proposal percentiles; AGL is rounded up to 100 ft, distance up to 0.5 km. */
export const ARRIVAL_PROPOSAL_PERCENTILES = [50, 75, 90] as const
export type ArrivalProposalPercentile = (typeof ARRIVAL_PROPOSAL_PERCENTILES)[number]
export const ARRIVAL_PROPOSAL_AGL_STEP_FT = 100
export const ARRIVAL_PROPOSAL_DISTANCE_STEP_KM = 0.5
/** Distribution percentiles printed per station. */
export const ARRIVAL_DISTRIBUTION_PERCENTILES = [10, 25, 50, 75, 90] as const
export const ARRIVAL_SEEN_POS_PERCENTILES = [50, 90, 99] as const

/**
 * Position conditions of the current landing confidence rules (domain.md, landing detection
 * section); descent and silence durations are not evaluated by the report. AGL limits: high
 * inclusive, medium/low exclusive. Distances are inclusive. high is measured to the threshold,
 * medium and low to the ARP.
 */
export type ArrivalLandingRule = 'high' | 'medium' | 'low'
export type ArrivalDistanceFrame = 'threshold' | 'arp'

export interface ArrivalLandingRuleGeometry {
  maxAglFt: number
  aglInclusive: boolean
  maxKm: number
  frame: ArrivalDistanceFrame
}

export const ARRIVAL_LANDING_RULES: Readonly<
  Record<ArrivalLandingRule, ArrivalLandingRuleGeometry>
> = Object.freeze({
  high: { maxAglFt: 300, aglInclusive: true, maxKm: 3, frame: 'threshold' },
  medium: { maxAglFt: 1000, aglInclusive: false, maxKm: 8, frame: 'arp' },
  low: { maxAglFt: 3000, aglInclusive: false, maxKm: 20, frame: 'arp' },
})

/** Does a last airborne sample satisfy a rule's position condition? */
export function landingRuleHolds(
  rule: ArrivalLandingRule,
  aglFt: number,
  thresholdKm: number,
  arpKm: number,
): boolean {
  const g = ARRIVAL_LANDING_RULES[rule]
  const aglOk = g.aglInclusive ? aglFt <= g.maxAglFt : aglFt < g.maxAglFt
  const km = g.frame === 'threshold' ? thresholdKm : arpKm
  return aglOk && km <= g.maxKm
}

// ---------------------------------------------------------------------------------------------
// Buckets (half-open [min, max); null = unbounded)

export interface ArrivalBucket<K extends string = string> {
  key: K
  min: number | null
  max: number | null
}

export const ARRIVAL_SEEN_POS_BUCKETS = [
  { key: 'lt0', min: null, max: 0 },
  { key: '0-1', min: 0, max: 1 },
  { key: '1-2', min: 1, max: 2 },
  { key: '2-5', min: 2, max: 5 },
  { key: '5-10', min: 5, max: 10 },
  { key: '10-30', min: 10, max: 30 },
  { key: '30-60', min: 30, max: 60 },
  { key: 'ge60', min: 60, max: null },
] as const satisfies readonly ArrivalBucket[]

export const ARRIVAL_AGL_BUCKETS = [
  { key: 'lt0', min: null, max: 0 },
  { key: '0-300', min: 0, max: 300 },
  { key: '300-1000', min: 300, max: 1000 },
  { key: '1000-2000', min: 1000, max: 2000 },
  { key: '2000-3000', min: 2000, max: 3000 },
  { key: 'ge3000', min: 3000, max: null },
] as const satisfies readonly ArrivalBucket[]

export const ARRIVAL_DISTANCE_BUCKETS = [
  { key: '0-3', min: 0, max: 3 },
  { key: '3-8', min: 3, max: 8 },
  { key: '8-15', min: 8, max: 15 },
  { key: '15-30', min: 15, max: 30 },
  { key: 'ge30', min: 30, max: null },
] as const satisfies readonly ArrivalBucket[]

/** Value missing (seen_pos absent, AGL without altitude). */
export const ARRIVAL_UNKNOWN_BUCKET = 'unknown'

export type ArrivalSeenPosBucket =
  (typeof ARRIVAL_SEEN_POS_BUCKETS)[number]['key'] | typeof ARRIVAL_UNKNOWN_BUCKET
export type ArrivalAglBucket =
  (typeof ARRIVAL_AGL_BUCKETS)[number]['key'] | typeof ARRIVAL_UNKNOWN_BUCKET
export type ArrivalDistanceBucket = (typeof ARRIVAL_DISTANCE_BUCKETS)[number]['key']

/** Bucket key of a value; null (or a value no bucket holds) gives 'unknown'. */
export function arrivalBucketKey<K extends string>(
  buckets: readonly ArrivalBucket<K>[],
  value: number | null,
): K | typeof ARRIVAL_UNKNOWN_BUCKET {
  if (value === null || Number.isNaN(value)) return ARRIVAL_UNKNOWN_BUCKET
  for (const b of buckets) {
    if ((b.min === null || value >= b.min) && (b.max === null || value < b.max)) return b.key
  }
  return ARRIVAL_UNKNOWN_BUCKET
}

/** Zero counts for every bucket key (plus 'unknown' when asked), in bucket order. */
export function emptyArrivalBucketCounts<K extends string>(
  buckets: readonly ArrivalBucket<K>[],
  withUnknown: boolean,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const b of buckets) out[b.key] = 0
  if (withUnknown) out[ARRIVAL_UNKNOWN_BUCKET] = 0
  return out
}

// ---------------------------------------------------------------------------------------------
// Statistics helpers

/**
 * Wilson score interval for `successes / n` (95 % by default); null when n is 0.
 */
export function wilsonInterval(
  successes: number,
  n: number,
  z: number = ARRIVAL_WILSON_Z_95,
): { low: number; high: number } | null {
  if (!(n > 0)) return null
  const p = successes / n
  const z2 = z * z
  const denominator = 1 + z2 / n
  const center = (p + z2 / (2 * n)) / denominator
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) }
}

/**
 * Quantile of an ascending array with linear interpolation between order statistics (R type 7):
 * the median of an even count is the mean of the two middle values. Null for an empty array.
 * `p` is in [0, 1].
 */
export function quantileSorted(sorted: readonly number[], p: number): number | null {
  const n = sorted.length
  if (n === 0) return null
  const h = (n - 1) * Math.min(1, Math.max(0, p))
  const lowIndex = Math.floor(h)
  const low = sorted[lowIndex] as number
  const high = sorted[Math.min(n - 1, lowIndex + 1)] as number
  return low + (h - lowIndex) * (high - low)
}

/** Ascending copy without null and non-finite values. */
export function sortedFinite(values: readonly (number | null)[]): number[] {
  const out: number[] = []
  for (const v of values) if (v !== null && Number.isFinite(v)) out.push(v)
  return out.sort((a, b) => a - b)
}

/** Median (type 7); null for no finite values. */
export function median(values: readonly (number | null)[]): number | null {
  return quantileSorted(sortedFinite(values), 0.5)
}

/** Rounds up to a multiple of `step` (a value already on a multiple stays; float noise ignored). */
export function ceilToStep(value: number, step: number): number {
  const steps = Math.ceil(value / step - 1e-9)
  return Number((steps * step).toFixed(6))
}

// ---------------------------------------------------------------------------------------------
// Pure inputs (db rows map onto these structurally)

/** OurAirports threshold source, or 'override' when an admin runway override moved the point. */
export type ArrivalThresholdSource =
  'runway_end' | 'displaced_threshold' | 'arp_fallback' | 'override'

/** One fine track sample (`track_points_fine` row) of a flight record. */
export interface ArrivalCoverageSample {
  /** Epoch ms. */
  ts: number
  lat: number
  lon: number
  altBaroFt: number | null
  altGeomFt: number | null
  /** Visible vertical rate (`baro ?? geom`); with null baroRateFpm it is the geometric rate. */
  verticalRateFpm: number | null
  /** Raw barometric rate (D-097); null when the source did not send it (and before v0.20.0). */
  baroRateFpm: number | null
  onGround: boolean
  /** Raw seen_pos (s), may be negative; null when absent (and before v0.20.0). */
  seenPosS: number | null
  /** `trackSourceCode(provider, position source)`. */
  source: number
}

/** A closed or open flight record with its fine samples sorted by ts (ascending). */
export interface ArrivalCoverageRecord {
  /** `flights.last_seen_at` (epoch ms); it includes samples not written to the fine table. */
  lastSeenTs: number
  samples: readonly ArrivalCoverageSample[]
}

export interface ArrivalCoverageThreshold {
  lat: number
  lon: number
  source: ArrivalThresholdSource
  /** Runway end elevation (ft), for the method section; null when unknown. */
  elevationFt: number | null
  ident: string | null
}

/** Another known airfield near the station (other_field classification). */
export interface ArrivalCoverageAirfield {
  ident: string
  lat: number
  lon: number
}

export interface ArrivalCoverageStation {
  icao: string
  iata: string
  arp: { lat: number; lon: number }
  elevationFt: number | null
  /** Resolved with `resolveArrivalGeoid`. */
  geoidM: number | null
  geoidSource: ArrivalGeoidSource | null
  /** Non-hidden runway thresholds with overrides applied. */
  thresholds: readonly ArrivalCoverageThreshold[]
  nearbyAirfields: readonly ArrivalCoverageAirfield[]
}

// ---------------------------------------------------------------------------------------------
// Observations (classifier output; no hex, callsign or registration)

export type ArrivalAglMethod = 'geoid' | 'baro_tolerant'
export type ArrivalNoGroundClass = 'lost_low' | 'left_zone' | 'other_field'
export const ARRIVAL_NO_GROUND_CLASSES = ['lost_low', 'left_zone', 'other_field'] as const

export interface ArrivalLastAirborne {
  ts: number
  altBaroFt: number | null
  altGeomFt: number | null
  /** AGL by the prompt definition (geoid, else baro); sign kept; null without altitude. */
  aglFt: number | null
  aglMethod: ArrivalAglMethod | null
  /** `alt_baro - elevation` whatever the method (QNH sensitivity); null without alt_baro. */
  baroAglFt: number | null
  /** Distance to the nearest non-fallback threshold, or to the ARP (`thresholdFallback`). */
  thresholdKm: number
  thresholdFallback: boolean
  arpKm: number
  /** Distance to the nearest other known airfield; null when none is near the station. */
  otherFieldKm: number | null
  lowWeightSource: boolean
}

export interface ArrivalObservation {
  icao: string
  /** First qualifying sample of the record at this station (epoch ms). */
  firstQualTs: number
  /** The record is closed (`lastSeenTs <= closedCutoff`); open records do not count. */
  recordClosed: boolean
  groundSeen: boolean
  firstGroundTs: number | null
  /** Set when no ground sample was seen. */
  noGround: ArrivalNoGroundClass | null
  lastAirborne: ArrivalLastAirborne
  /** Raw seen_pos values (s) of the record's samples inside the station zone. */
  seenPosS: number[]
  /** Zone samples without seen_pos. */
  seenPosUnknown: number
  zoneSamples: number
  lowWeightZoneSamples: number
  /** Median gap between consecutive samples of the record (s); null with fewer than 2 samples. */
  medianGapS: number | null
}

/** A record that qualifies only on the geometric rate (baro_rate null) at a station. */
export interface ArrivalGeomOnlyObservation {
  icao: string
  firstQualTs: number
  recordClosed: boolean
  groundSeen: boolean
}

export interface ArrivalRecordClassification {
  arrivals: ArrivalObservation[]
  geomOnly: ArrivalGeomOnlyObservation[]
}

// ---------------------------------------------------------------------------------------------
// Aggregation inputs

/** Fine-sample completeness per station zone in the window (db `readArrivalCoverageWindowStats`). */
export interface ArrivalCoverageWindowStats {
  icao: string
  airborneSamples: number
  baroRateNull: number
  seenPosNull: number
  /** Earliest airborne sample with non-null baro_rate in the window (epoch ms); null when none. */
  firstBaroRateTs: number | null
}

export type ArrivalProviderStatus = 'ok' | 'degraded' | 'down' | 'unknown'

export interface ArrivalCoverageProviderHour {
  /** Hour start (epoch ms, UTC). */
  hour: number
  /** A provider_health_hourly row exists (false: ingest was not running). */
  present: boolean
  requests: number
  successes: number
  rateLimited: number
  serverErrors: number
  networkErrors: number
  otherErrors: number
  freshnessP95MaxS: number | null
}

/** Provider status over [from, to) (epoch ms); 'unknown' before the first recorded change. */
export interface ArrivalCoverageStatusSpan {
  status: ArrivalProviderStatus
  from: number
  to: number
}

export interface ArrivalCoverageProviderInput {
  provider: string
  /**
   * Every UTC hour the window touches, whole (the first and last hour can include minutes outside
   * the window: an hourly row cannot be split).
   */
  hours: readonly ArrivalCoverageProviderHour[]
  /**
   * Status from window start to window end + ARRIVAL_PROVIDER_DEGRADED_WITHIN_MS, so an arrival in
   * the window's last minutes still sees a later outage. Time per status is clipped to the window.
   */
  spans: readonly ArrivalCoverageStatusSpan[]
}

export interface ArrivalCoverageQnhObservation {
  icao: string
  /** Epoch ms. */
  observedAt: number
  qnhHpa: number
}

export interface ArrivalCoverageAggregateInput {
  window: ArrivalCoverageWindow
  hours: number
  stations: readonly ArrivalCoverageStation[]
  observations: readonly ArrivalObservation[]
  geomOnly: readonly ArrivalGeomOnlyObservation[]
  windowStats: readonly ArrivalCoverageWindowStats[]
  /** null when provider stats were not read (probe). */
  provider: ArrivalCoverageProviderInput | null
  /** METAR QNH from window start - 90 min to window end. */
  qnh: readonly ArrivalCoverageQnhObservation[]
}

// ---------------------------------------------------------------------------------------------
// Result (stored as `arrival_coverage_reports.result` jsonb; ISO 8601 UTC timestamps)

/** Counts and share; `low`/`high` bound the share under the baro AGL uncertainty. */
export interface ArrivalShare {
  count: number
  n: number
  share: number | null
  low: number | null
  high: number | null
}

export interface ArrivalProposal {
  percentile: ArrivalProposalPercentile
  /** AGL percentile rounded up to 100 ft. */
  aglFt: number
  /** Distance percentile rounded up to 0.5 km (frame of the list). */
  distanceKm: number
  /** Share captured by `AGL <= aglFt and distance <= distanceKm`. */
  capture: ArrivalShare
}

export type ArrivalQuantiles = Record<'p10' | 'p25' | 'p50' | 'p75' | 'p90', number>

export interface ArrivalSubsetStats {
  /** Arrivals in the subset. */
  n: number
  /** Of them, with a known AGL (denominator of capture shares and proposals). */
  withAgl: number
  medianAglFt: number | null
  /** Median AGL with baro arrivals shifted by the tolerance range (low, high). */
  medianAglRangeFt: { low: number; high: number } | null
  medianThresholdKm: number | null
  medianArpKm: number | null
  aglQuantilesFt: ArrivalQuantiles | null
  thresholdQuantilesKm: ArrivalQuantiles | null
  arpQuantilesKm: ArrivalQuantiles | null
  proposals: { threshold: ArrivalProposal[]; arp: ArrivalProposal[] }
  capture: Record<ArrivalLandingRule | 'high_or_medium', ArrivalShare>
}

export type ArrivalRuleVerdict = 'applies' | 'does_not_apply' | 'no_arrivals'

export interface ArrivalRuleResult {
  verdict: ArrivalRuleVerdict
  /** Rule 1: the Wilson interval contains 70 %. Rule 2: the baro uncertainty flips the verdict. */
  borderline: boolean
  /** Fewer than ARRIVAL_LOW_SAMPLE_ARRIVALS arrivals. */
  lowSample: boolean
}

export type ArrivalStationNote =
  | 'no_elevation'
  | 'threshold_fallback'
  | 'no_geoid'
  | 'geoid_fallback'
  | 'data_gap'
  | 'no_baro_rate'
  | 'qnh_bias_exceeds_tolerance'

export interface ArrivalCoverageStationResult {
  icao: string
  iata: string
  elevationFt: number | null
  geoidM: number | null
  geoidSource: ArrivalGeoidSource | null
  thresholds: number
  thresholdFallbackOnly: boolean
  /** Runway end elevations relative to the field elevation (ft); null when unknown. */
  thresholdElevationDeltaFt: { min: number; max: number } | null
  effectiveWindow: {
    /** Earliest non-null baro_rate in the window (ISO); null when none. */
    start: string | null
    airborneSamples: number
    baroRateNullShare: number | null
    seenPosNullShare: number | null
    warning: boolean
  }
  /** Arrivals counted (closed records, firstQual in the window). */
  arrivals: number
  /** Arrivals in the window left out because their record was still open. */
  openRecordArrivals: number
  groundSeen: number
  groundShare: number | null
  groundShareWilson: { low: number; high: number } | null
  /** Sensitivity: ground share without left_zone and other_field arrivals. */
  groundShareExcludingLeft: ArrivalShare
  noGround: Record<ArrivalNoGroundClass, number>
  aglMethods: { geoid: number; baro_tolerant: number; unknown: number }
  all: ArrivalSubsetStats
  lostLow: ArrivalSubsetStats
  aglHistogram: Record<string, number>
  thresholdHistogram: Record<string, number>
  arpHistogram: Record<string, number>
  seenPos: {
    samples: number
    buckets: Record<string, number>
    p50: number | null
    p90: number | null
    p99: number | null
  }
  medianGapS: number | null
  /** Share of zone samples from low-weight position sources. */
  lowWeightShare: number | null
  lowWeightLastAirborne: number
  qnh: {
    observations: number
    minHpa: number
    maxHpa: number
    biasMinFt: number
    biasMaxFt: number
    correctedMedianAglFt: number | null
    correctedN: number
  } | null
  /** Baro AGL range applied to capture shares (ft): +-300, widened by the QNH bias. */
  baroToleranceFt: { low: number; high: number }
  geomOnly: { arrivals: number; groundSeen: number; groundShare: number | null }
  /** null without provider stats. */
  degradedAfterArrival: number | null
  rule1: ArrivalRuleResult
  rule2: ArrivalRuleResult
  notes: ArrivalStationNote[]
}

export interface ArrivalCoverageProviderResult {
  provider: string
  /** UTC hours the window touches (counted whole; see ArrivalCoverageProviderInput.hours). */
  hours: number
  /** First hour start to last hour end (ISO); null without hours. */
  hourRange: { start: string; end: string } | null
  hoursWithoutRows: number
  hoursWithoutSuccess: number
  requests: number
  successes: number
  rateLimited: number
  serverErrors: number
  networkErrors: number
  otherErrors: number
  rateLimitedShare: number | null
  serverErrorShare: number | null
  freshnessP95MaxS: { max: number | null; median: number | null }
  /** Time in each status inside the window. */
  statusMs: Record<ArrivalProviderStatus, number>
}

/** Definitions in force, copied into every result for the report's method section. */
export interface ArrivalCoverageDefinitions {
  arrivalArpKm: number
  maxAboveFieldFt: number
  baroRateBelowFpm: number
  groundArpKm: number
  zoneKm: number
  settleMs: number
  closedRecordMs: number
  lookbackMs: number
  baroAglToleranceFt: number
  qnhMaxAgeMs: number
  geoidFallbackM: Record<string, number>
  groundShareMin: number
  medianAglMaxFt: number
  medianThresholdMaxKm: number
  lowSampleArrivals: number
  dataGapWarningShare: number
  leftZoneMinMs: number
  leftZoneGapFactor: number
  nearbyAirfieldKm: number
  providerDegradedWithinMs: number
  landingRules: Record<ArrivalLandingRule, ArrivalLandingRuleGeometry>
}

export function arrivalCoverageDefinitions(): ArrivalCoverageDefinitions {
  return {
    arrivalArpKm: ARRIVAL_ARP_KM,
    maxAboveFieldFt: ARRIVAL_MAX_ABOVE_FIELD_FT,
    baroRateBelowFpm: ARRIVAL_BARO_RATE_BELOW_FPM,
    groundArpKm: ARRIVAL_GROUND_ARP_KM,
    zoneKm: ARRIVAL_ZONE_KM,
    settleMs: ARRIVAL_COVERAGE_SETTLE_MS,
    closedRecordMs: ARRIVAL_COVERAGE_CLOSED_RECORD_MS,
    lookbackMs: ARRIVAL_COVERAGE_LOOKBACK_MS,
    baroAglToleranceFt: ARRIVAL_BARO_AGL_TOLERANCE_FT,
    qnhMaxAgeMs: ARRIVAL_QNH_MAX_AGE_MS,
    geoidFallbackM: { ...ARRIVAL_COVERAGE_GEOID_FALLBACK_M },
    groundShareMin: ARRIVAL_GROUND_SHARE_MIN,
    medianAglMaxFt: ARRIVAL_MEDIAN_AGL_MAX_FT,
    medianThresholdMaxKm: ARRIVAL_MEDIAN_THRESHOLD_MAX_KM,
    lowSampleArrivals: ARRIVAL_LOW_SAMPLE_ARRIVALS,
    dataGapWarningShare: ARRIVAL_DATA_GAP_WARNING_SHARE,
    leftZoneMinMs: ARRIVAL_LEFT_ZONE_MIN_MS,
    leftZoneGapFactor: ARRIVAL_LEFT_ZONE_GAP_FACTOR,
    nearbyAirfieldKm: ARRIVAL_NEARBY_AIRFIELD_KM,
    providerDegradedWithinMs: ARRIVAL_PROVIDER_DEGRADED_WITHIN_MS,
    landingRules: {
      high: { ...ARRIVAL_LANDING_RULES.high },
      medium: { ...ARRIVAL_LANDING_RULES.medium },
      low: { ...ARRIVAL_LANDING_RULES.low },
    },
  }
}

export interface ArrivalCoverageResult {
  definitionVersion: number
  definitions: ArrivalCoverageDefinitions
  jobStart: string
  window: { start: string; end: string; hours: number }
  /** Earliest non-null baro_rate over all stations (ISO); null when none (the job then fails). */
  effectiveStart: string | null
  /** Any station's null share of baro_rate or seen_pos exceeds 5 %. */
  dataGapWarning: boolean
  stations: ArrivalCoverageStationResult[]
  provider: ArrivalCoverageProviderResult | null
  /** Arrivals over all stations (counted ones). */
  totals: { arrivals: number; groundSeen: number; openRecordArrivals: number }
}
