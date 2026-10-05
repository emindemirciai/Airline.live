import {
  ARRIVAL_AGL_BUCKETS,
  ARRIVAL_BARO_AGL_TOLERANCE_FT,
  ARRIVAL_COVERAGE_DEFINITION_VERSION,
  ARRIVAL_DATA_GAP_WARNING_SHARE,
  ARRIVAL_DISTANCE_BUCKETS,
  ARRIVAL_GROUND_SHARE_MIN,
  ARRIVAL_LOW_SAMPLE_ARRIVALS,
  ARRIVAL_MEDIAN_AGL_MAX_FT,
  ARRIVAL_MEDIAN_THRESHOLD_MAX_KM,
  ARRIVAL_NO_GROUND_CLASSES,
  ARRIVAL_PROPOSAL_AGL_STEP_FT,
  ARRIVAL_PROPOSAL_DISTANCE_STEP_KM,
  ARRIVAL_PROPOSAL_PERCENTILES,
  ARRIVAL_PROVIDER_DEGRADED_WITHIN_MS,
  ARRIVAL_QNH_MAX_AGE_MS,
  ARRIVAL_SEEN_POS_BUCKETS,
  arrivalBucketKey,
  arrivalCoverageDefinitions,
  arrivalQnhBiasFt,
  ceilToStep,
  emptyArrivalBucketCounts,
  landingRuleHolds,
  median,
  quantileSorted,
  sortedFinite,
  wilsonInterval,
  type ArrivalBucket,
  type ArrivalCoverageAggregateInput,
  type ArrivalCoverageProviderInput,
  type ArrivalCoverageProviderResult,
  type ArrivalCoverageQnhObservation,
  type ArrivalCoverageResult,
  type ArrivalCoverageStation,
  type ArrivalCoverageStationResult,
  type ArrivalCoverageStatusSpan,
  type ArrivalCoverageWindowStats,
  type ArrivalDistanceFrame,
  type ArrivalGeomOnlyObservation,
  type ArrivalLandingRule,
  type ArrivalNoGroundClass,
  type ArrivalObservation,
  type ArrivalProposal,
  type ArrivalProviderStatus,
  type ArrivalQuantiles,
  type ArrivalRuleResult,
  type ArrivalShare,
  type ArrivalStationNote,
  type ArrivalSubsetStats,
} from '@havayolu/shared'

/**
 * Kapsama raporunun saf toplayıcısı (Parça 1 M7b.2, D-098): sınıflandırıcının gözlemlerinden,
 * pencere istatistiklerinden, sağlayıcı sayaçlarından ve METAR QNH'sinden
 * `ArrivalCoverageResult` üretir. Tanımlar `@havayolu/shared` `arrival-coverage.ts`'tedir.
 *
 * - Sayılan varış: istasyonun, ilk nitelikli örneği pencerede (`[start, end)`) olan ve kaydı
 *   kapanmış gözlemi. Pencerede olup kaydı açık olanlar ayrıca sayılır, başlıkta yer almaz.
 * - Kural 1: yerde örneği payı < %70 (bütün sayılan varışlar üzerinden). Wilson %95 aralığı %70'i
 *   içeriyorsa "sınırda" (`borderline`), varış 20'den azsa "az örnek" (`lowSample`).
 * - Kural 2: son havadaki örneğin medyan AGL'si > 1.000 ft ya da eşiğe medyan mesafe > 8 km
 *   (bütün varışlar). Baro belirsizliği sonucu değiştiriyorsa "sınırda".
 * - Baro AGL aralığı ±300 ft'tir; pencerenin METAR QNH sapması bu aralığı aşarsa aralık sapmaya
 *   genişletilir. Yakalama payları ve öneriler `low`/`high` sınırlarıyla verilir.
 * - Geometrik hız duyarlılığı yalnızca istasyonun etkin penceresinde (ilk dolu `baro_rate`'ten
 *   sonra) sayılır; v0.20.0 öncesi satırlarda baro hep boştur.
 *
 * Saf modüldür: IO ve saat yoktur; aynı girdi aynı sonucu verir.
 */

const iso = (ms: number) => new Date(ms).toISOString()
const HOUR_MS = 3_600_000
const share = (count: number, n: number): number | null => (n > 0 ? count / n : null)

/** Baro AGL'nin gerçek değer aralığı: gerçek AGL ≈ baro AGL + [low, high] (ft). */
export interface BaroTolerance {
  low: number
  high: number
}

export const DEFAULT_BARO_TOLERANCE: Readonly<BaroTolerance> = Object.freeze({
  low: -ARRIVAL_BARO_AGL_TOLERANCE_FT,
  high: ARRIVAL_BARO_AGL_TOLERANCE_FT,
})

/** Gözlemin AGL'si, baro yönteminde verilen kaydırmayla (geoid yönteminde kaydırma yok). */
function shiftedAgl(o: ArrivalObservation, shift: number): number | null {
  const agl = o.lastAirborne.aglFt
  if (agl === null) return null
  return o.lastAirborne.aglMethod === 'baro_tolerant' ? agl + shift : agl
}

const frameKm = (o: ArrivalObservation, frame: ArrivalDistanceFrame) =>
  frame === 'threshold' ? o.lastAirborne.thresholdKm : o.lastAirborne.arpKm

/**
 * AGL'de azalan (alçakta tutan) bir koşulun payı. Nokta değer gözlenen AGL'yle; `low` sınırı baro
 * gözlemleri en yükseğe (`+high`), `high` sınırı en alçağa (`+low`) kaydırılarak hesaplanır.
 * Payda AGL'si bilinen gözlemlerdir.
 */
export function aglCaptureShare(
  observations: readonly ArrivalObservation[],
  holds: (aglFt: number, o: ArrivalObservation) => boolean,
  tolerance: BaroTolerance,
): ArrivalShare {
  let n = 0
  let count = 0
  let surely = 0
  let possibly = 0
  for (const o of observations) {
    const agl = o.lastAirborne.aglFt
    if (agl === null) continue
    n += 1
    if (holds(agl, o)) count += 1
    const high = shiftedAgl(o, tolerance.high) as number
    const low = shiftedAgl(o, tolerance.low) as number
    if (holds(high, o)) surely += 1
    if (holds(low, o)) possibly += 1
  }
  return {
    count,
    n,
    share: share(count, n),
    low: share(surely, n),
    high: share(possibly, n),
  }
}

function quantiles(sorted: readonly number[]): ArrivalQuantiles | null {
  if (sorted.length === 0) return null
  const q = (p: number) => quantileSorted(sorted, p) as number
  return { p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9) }
}

/**
 * Eşik önerileri: AGL ve mesafe yüzdelikleri (p50/p75/p90; AGL 100 ft'e, mesafe 0,5 km'ye yukarı
 * yuvarlanır) ve her çiftin birlikte yakaladığı pay. AGL'si bilinen gözlemler üzerinden.
 */
export function arrivalProposals(
  observations: readonly ArrivalObservation[],
  frame: ArrivalDistanceFrame,
  tolerance: BaroTolerance,
): ArrivalProposal[] {
  const withAgl = observations.filter((o) => o.lastAirborne.aglFt !== null)
  if (withAgl.length === 0) return []
  const agl = sortedFinite(withAgl.map((o) => o.lastAirborne.aglFt))
  const km = sortedFinite(withAgl.map((o) => frameKm(o, frame)))
  return ARRIVAL_PROPOSAL_PERCENTILES.map((percentile) => {
    const aglFt = ceilToStep(
      quantileSorted(agl, percentile / 100) as number,
      ARRIVAL_PROPOSAL_AGL_STEP_FT,
    )
    const distanceKm = ceilToStep(
      quantileSorted(km, percentile / 100) as number,
      ARRIVAL_PROPOSAL_DISTANCE_STEP_KM,
    )
    return {
      percentile,
      aglFt,
      distanceKm,
      capture: aglCaptureShare(
        withAgl,
        (value, o) => value <= aglFt && frameKm(o, frame) <= distanceKm,
        tolerance,
      ),
    }
  })
}

const ruleHolds = (rule: ArrivalLandingRule) => (agl: number, o: ArrivalObservation) =>
  landingRuleHolds(rule, agl, o.lastAirborne.thresholdKm, o.lastAirborne.arpKm)

/** Bir gözlem kümesinin dağılımları, önerileri ve bugünkü kuralların yakalama payları. */
export function arrivalSubsetStats(
  observations: readonly ArrivalObservation[],
  tolerance: BaroTolerance,
): ArrivalSubsetStats {
  const withAgl = observations.filter((o) => o.lastAirborne.aglFt !== null)
  const agl = sortedFinite(withAgl.map((o) => o.lastAirborne.aglFt))
  const thresholdKm = sortedFinite(observations.map((o) => o.lastAirborne.thresholdKm))
  const arpKm = sortedFinite(observations.map((o) => o.lastAirborne.arpKm))
  const medianAglFt = quantileSorted(agl, 0.5)
  const high = ruleHolds('high')
  const medium = ruleHolds('medium')
  return {
    n: observations.length,
    withAgl: withAgl.length,
    medianAglFt,
    medianAglRangeFt:
      medianAglFt === null
        ? null
        : {
            low: median(withAgl.map((o) => shiftedAgl(o, tolerance.low))) as number,
            high: median(withAgl.map((o) => shiftedAgl(o, tolerance.high))) as number,
          },
    medianThresholdKm: quantileSorted(thresholdKm, 0.5),
    medianArpKm: quantileSorted(arpKm, 0.5),
    aglQuantilesFt: quantiles(agl),
    thresholdQuantilesKm: quantiles(thresholdKm),
    arpQuantilesKm: quantiles(arpKm),
    proposals: {
      threshold: arrivalProposals(withAgl, 'threshold', tolerance),
      arp: arrivalProposals(withAgl, 'arp', tolerance),
    },
    capture: {
      high: aglCaptureShare(withAgl, high, tolerance),
      medium: aglCaptureShare(withAgl, medium, tolerance),
      low: aglCaptureShare(withAgl, ruleHolds('low'), tolerance),
      high_or_medium: aglCaptureShare(withAgl, (a, o) => high(a, o) || medium(a, o), tolerance),
    },
  }
}

/** Kural 1: yerde örneği payı < %70 → iniş varsayılan olarak "muhtemel" sunulur. */
export function groundShareRule(arrivals: number, groundSeen: number): ArrivalRuleResult {
  if (arrivals <= 0) return { verdict: 'no_arrivals', borderline: false, lowSample: true }
  const wilson = wilsonInterval(groundSeen, arrivals)
  return {
    verdict: groundSeen / arrivals < ARRIVAL_GROUND_SHARE_MIN ? 'applies' : 'does_not_apply',
    borderline:
      wilson !== null &&
      wilson.low <= ARRIVAL_GROUND_SHARE_MIN &&
      ARRIVAL_GROUND_SHARE_MIN <= wilson.high,
    lowSample: arrivals < ARRIVAL_LOW_SAMPLE_ARRIVALS,
  }
}

const medianRuleApplies = (aglFt: number | null, thresholdKm: number | null) =>
  (aglFt !== null && aglFt > ARRIVAL_MEDIAN_AGL_MAX_FT) ||
  (thresholdKm !== null && thresholdKm > ARRIVAL_MEDIAN_THRESHOLD_MAX_KM)

/**
 * Kural 2: medyan AGL > 1.000 ft ya da eşiğe medyan mesafe > 8 km → DUR-SOR (bütün varışlar).
 * Baro aralığının iki ucunda sonuç farklıysa "sınırda".
 */
export function medianRule(all: ArrivalSubsetStats, arrivals: number): ArrivalRuleResult {
  if (arrivals <= 0) return { verdict: 'no_arrivals', borderline: false, lowSample: true }
  const applies = medianRuleApplies(all.medianAglFt, all.medianThresholdKm)
  const range = all.medianAglRangeFt
  const borderline =
    range !== null &&
    medianRuleApplies(range.low, all.medianThresholdKm) !==
      medianRuleApplies(range.high, all.medianThresholdKm)
  return {
    verdict: applies ? 'applies' : 'does_not_apply',
    borderline,
    lowSample: arrivals < ARRIVAL_LOW_SAMPLE_ARRIVALS,
  }
}

/** Gözlemin ölçülen anındaki geçerli QNH: en geç gözlem, `ts`'ten en çok 90 dk önce (dahil). */
export function qnhAt(series: readonly ArrivalCoverageQnhObservation[], ts: number): number | null {
  let best: ArrivalCoverageQnhObservation | null = null
  for (const q of series) {
    if (q.observedAt > ts || ts - q.observedAt > ARRIVAL_QNH_MAX_AGE_MS) continue
    if (best === null || q.observedAt >= best.observedAt) best = q
  }
  return best?.qnhHpa ?? null
}

function bucketCounts<K extends string>(
  buckets: readonly ArrivalBucket<K>[],
  values: readonly (number | null)[],
  withUnknown: boolean,
): Record<string, number> {
  const counts = emptyArrivalBucketCounts(buckets, withUnknown)
  for (const v of values) {
    const key = arrivalBucketKey(buckets, v)
    if (key in counts) counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

const DEGRADED: ReadonlySet<ArrivalProviderStatus> = new Set(['degraded', 'down'])

/**
 * Varıştan sonraki 10 dk içinde sağlayıcı `degraded`/`down` mıydı? Dilimler pencere sonundan
 * sonraki 10 dk'yı da kapsar (`readProviderWindowStats` `statusUntil`).
 */
export function degradedAfter(spans: readonly ArrivalCoverageStatusSpan[], ts: number): boolean {
  const until = ts + ARRIVAL_PROVIDER_DEGRADED_WITHIN_MS
  return spans.some((s) => DEGRADED.has(s.status) && s.from <= until && s.to > ts)
}

/**
 * Sağlayıcının pencere özeti: istek, 429/420 ve 5xx payları, satırsız ve başarısız saatler (pencereye
 * değen bütün UTC saatleri ve aralıkları), durum süreleri (pencereye kırpılır).
 */
export function providerWindowSummary(
  input: ArrivalCoverageProviderInput,
  window: { start: number; end: number },
): ArrivalCoverageProviderResult {
  const sum = (pick: (h: (typeof input.hours)[number]) => number) =>
    input.hours.reduce((total, h) => total + pick(h), 0)
  const requests = sum((h) => h.requests)
  const rateLimited = sum((h) => h.rateLimited)
  const serverErrors = sum((h) => h.serverErrors)
  const freshness = sortedFinite(
    input.hours.filter((h) => h.present).map((h) => h.freshnessP95MaxS),
  )
  const statusMs: Record<ArrivalProviderStatus, number> = {
    ok: 0,
    degraded: 0,
    down: 0,
    unknown: 0,
  }
  for (const span of input.spans) {
    const from = Math.max(span.from, window.start)
    const to = Math.min(span.to, window.end)
    statusMs[span.status] += Math.max(0, to - from)
  }
  const hourStarts = input.hours.map((h) => h.hour)
  return {
    provider: input.provider,
    hours: input.hours.length,
    hourRange:
      hourStarts.length === 0
        ? null
        : {
            start: iso(Math.min(...hourStarts)),
            end: iso(Math.max(...hourStarts) + HOUR_MS),
          },
    hoursWithoutRows: input.hours.filter((h) => !h.present).length,
    hoursWithoutSuccess: input.hours.filter((h) => h.present && h.successes === 0).length,
    requests,
    successes: sum((h) => h.successes),
    rateLimited,
    serverErrors,
    networkErrors: sum((h) => h.networkErrors),
    otherErrors: sum((h) => h.otherErrors),
    rateLimitedShare: share(rateLimited, requests),
    serverErrorShare: share(serverErrors, requests),
    freshnessP95MaxS: {
      max: freshness.at(-1) ?? null,
      median: quantileSorted(freshness, 0.5),
    },
    statusMs,
  }
}

interface StationContext {
  station: ArrivalCoverageStation
  counted: ArrivalObservation[]
  openRecordArrivals: number
  geomOnly: ArrivalGeomOnlyObservation[]
  stats: ArrivalCoverageWindowStats | undefined
  qnh: ArrivalCoverageQnhObservation[]
}

function stationResult(
  ctx: StationContext,
  window: ArrivalCoverageAggregateInput['window'],
  provider: ArrivalCoverageProviderInput | null,
): ArrivalCoverageStationResult {
  const { station, counted, stats } = ctx
  const notes: ArrivalStationNote[] = []

  // QNH (duyarlılık): penceredeki gözlemlerin uç değerleri ve sapma aralığı.
  const inWindowQnh = ctx.qnh.filter(
    (q) => q.observedAt >= window.start && q.observedAt < window.end,
  )
  let qnh: ArrivalCoverageStationResult['qnh'] = null
  let tolerance: BaroTolerance = { ...DEFAULT_BARO_TOLERANCE }
  if (inWindowQnh.length > 0) {
    const values = inWindowQnh.map((q) => q.qnhHpa)
    const minHpa = Math.min(...values)
    const maxHpa = Math.max(...values)
    const biasMinFt = arrivalQnhBiasFt(minHpa)
    const biasMaxFt = arrivalQnhBiasFt(maxHpa)
    const corrected: number[] = []
    for (const o of counted) {
      if (o.lastAirborne.altBaroFt === null) continue
      const value = qnhAt(ctx.qnh, o.lastAirborne.ts)
      if (value === null) continue
      corrected.push(
        o.lastAirborne.altBaroFt + arrivalQnhBiasFt(value) - (station.elevationFt ?? 0),
      )
    }
    qnh = {
      observations: inWindowQnh.length,
      minHpa,
      maxHpa,
      biasMinFt,
      biasMaxFt,
      correctedMedianAglFt: median(corrected),
      correctedN: corrected.length,
    }
    tolerance = {
      low: Math.min(DEFAULT_BARO_TOLERANCE.low, biasMinFt),
      high: Math.max(DEFAULT_BARO_TOLERANCE.high, biasMaxFt),
    }
    if (biasMinFt < DEFAULT_BARO_TOLERANCE.low || biasMaxFt > DEFAULT_BARO_TOLERANCE.high) {
      notes.push('qnh_bias_exceeds_tolerance')
    }
  }

  const arrivals = counted.length
  const groundSeen = counted.filter((o) => o.groundSeen).length
  const noGround = Object.fromEntries(ARRIVAL_NO_GROUND_CLASSES.map((c) => [c, 0])) as Record<
    ArrivalNoGroundClass,
    number
  >
  for (const o of counted) if (o.noGround !== null) noGround[o.noGround] += 1
  const excludingLeftN = arrivals - noGround.left_zone - noGround.other_field

  const aglMethods = { geoid: 0, baro_tolerant: 0, unknown: 0 }
  for (const o of counted) aglMethods[o.lastAirborne.aglMethod ?? 'unknown'] += 1

  const all = arrivalSubsetStats(counted, tolerance)
  const lostLow = arrivalSubsetStats(
    counted.filter((o) => o.noGround === 'lost_low'),
    tolerance,
  )

  const seenPosValues: number[] = []
  let seenPosUnknown = 0
  let zoneSamples = 0
  let lowWeightSamples = 0
  for (const o of counted) {
    for (const v of o.seenPosS) seenPosValues.push(v)
    seenPosUnknown += o.seenPosUnknown
    zoneSamples += o.zoneSamples
    lowWeightSamples += o.lowWeightZoneSamples
  }
  const seenPosSorted = sortedFinite(seenPosValues)
  const seenPosBuckets = bucketCounts(ARRIVAL_SEEN_POS_BUCKETS, seenPosValues, true)
  seenPosBuckets.unknown = (seenPosBuckets.unknown ?? 0) + seenPosUnknown

  // Etkin pencere: istasyon bölgesinde `baro_rate`'i dolu ilk örnekten başlar.
  const airborne = stats?.airborneSamples ?? 0
  const baroRateNullShare = share(stats?.baroRateNull ?? 0, airborne)
  const seenPosNullShare = share(stats?.seenPosNull ?? 0, airborne)
  const warning =
    (baroRateNullShare ?? 0) > ARRIVAL_DATA_GAP_WARNING_SHARE ||
    (seenPosNullShare ?? 0) > ARRIVAL_DATA_GAP_WARNING_SHARE
  const effectiveStart = stats?.firstBaroRateTs ?? null

  const geomCounted = ctx.geomOnly.filter(
    (g) => effectiveStart !== null && g.firstQualTs >= effectiveStart,
  )
  const geomGround = geomCounted.filter((g) => g.groundSeen).length

  const realThresholds = station.thresholds.filter((t) => t.source !== 'arp_fallback')
  const elevations =
    station.elevationFt === null
      ? []
      : station.thresholds
          .map((t) =>
            t.elevationFt === null ? null : t.elevationFt - (station.elevationFt as number),
          )
          .filter((v): v is number => v !== null)

  if (station.elevationFt === null) notes.push('no_elevation')
  if (realThresholds.length === 0) notes.push('threshold_fallback')
  if (station.geoidM === null) notes.push('no_geoid')
  else if (station.geoidSource === 'fallback') notes.push('geoid_fallback')
  if (warning) notes.push('data_gap')
  if (effectiveStart === null) notes.push('no_baro_rate')

  return {
    icao: station.icao,
    iata: station.iata,
    elevationFt: station.elevationFt,
    geoidM: station.geoidM,
    geoidSource: station.geoidSource,
    thresholds: station.thresholds.length,
    thresholdFallbackOnly: realThresholds.length === 0,
    thresholdElevationDeltaFt:
      elevations.length === 0
        ? null
        : { min: Math.min(...elevations), max: Math.max(...elevations) },
    effectiveWindow: {
      start: effectiveStart === null ? null : iso(effectiveStart),
      airborneSamples: airborne,
      baroRateNullShare,
      seenPosNullShare,
      warning,
    },
    arrivals,
    openRecordArrivals: ctx.openRecordArrivals,
    groundSeen,
    groundShare: share(groundSeen, arrivals),
    groundShareWilson: wilsonInterval(groundSeen, arrivals),
    groundShareExcludingLeft: {
      count: groundSeen,
      n: excludingLeftN,
      share: share(groundSeen, excludingLeftN),
      low: null,
      high: null,
    },
    noGround,
    aglMethods,
    all,
    lostLow,
    aglHistogram: bucketCounts(
      ARRIVAL_AGL_BUCKETS,
      counted.map((o) => o.lastAirborne.aglFt),
      true,
    ),
    thresholdHistogram: bucketCounts(
      ARRIVAL_DISTANCE_BUCKETS,
      counted.map((o) => o.lastAirborne.thresholdKm),
      false,
    ),
    arpHistogram: bucketCounts(
      ARRIVAL_DISTANCE_BUCKETS,
      counted.map((o) => o.lastAirborne.arpKm),
      false,
    ),
    seenPos: {
      samples: seenPosValues.length + seenPosUnknown,
      buckets: seenPosBuckets,
      p50: quantileSorted(seenPosSorted, 0.5),
      p90: quantileSorted(seenPosSorted, 0.9),
      p99: quantileSorted(seenPosSorted, 0.99),
    },
    medianGapS: median(counted.map((o) => o.medianGapS)),
    lowWeightShare: share(lowWeightSamples, zoneSamples),
    lowWeightLastAirborne: counted.filter((o) => o.lastAirborne.lowWeightSource).length,
    qnh,
    baroToleranceFt: tolerance,
    geomOnly: {
      arrivals: geomCounted.length,
      groundSeen: geomGround,
      groundShare: share(geomGround, geomCounted.length),
    },
    degradedAfterArrival:
      provider === null
        ? null
        : counted.filter((o) => degradedAfter(provider.spans, o.firstQualTs)).length,
    rule1: groundShareRule(arrivals, groundSeen),
    rule2: medianRule(all, arrivals),
    notes,
  }
}

/**
 * Raporun sonucu. İstasyon sırası girdideki sıradır. Gözlem, ilk nitelikli örneği pencerede ve
 * istasyonu listede ise değerlendirilir.
 */
export function summarizeArrivalCoverage(
  input: ArrivalCoverageAggregateInput,
): ArrivalCoverageResult {
  const { window } = input
  const inWindow = (ts: number) => ts >= window.start && ts < window.end
  const statsByIcao = new Map(input.windowStats.map((s) => [s.icao, s]))

  const stations = input.stations.map((station) => {
    const own = input.observations.filter((o) => o.icao === station.icao && inWindow(o.firstQualTs))
    return stationResult(
      {
        station,
        counted: own.filter((o) => o.recordClosed),
        openRecordArrivals: own.filter((o) => !o.recordClosed).length,
        geomOnly: input.geomOnly.filter(
          (g) => g.icao === station.icao && g.recordClosed && inWindow(g.firstQualTs),
        ),
        stats: statsByIcao.get(station.icao),
        qnh: input.qnh
          .filter((q) => q.icao === station.icao)
          .sort((a, b) => a.observedAt - b.observedAt),
      },
      window,
      input.provider,
    )
  })

  const starts = input.windowStats
    .map((s) => s.firstBaroRateTs)
    .filter((ts): ts is number => ts !== null)
  return {
    definitionVersion: ARRIVAL_COVERAGE_DEFINITION_VERSION,
    definitions: arrivalCoverageDefinitions(),
    jobStart: iso(window.jobStart),
    window: { start: iso(window.start), end: iso(window.end), hours: input.hours },
    effectiveStart: starts.length === 0 ? null : iso(Math.min(...starts)),
    dataGapWarning: stations.some((s) => s.effectiveWindow.warning),
    stations,
    provider: input.provider === null ? null : providerWindowSummary(input.provider, window),
    totals: {
      arrivals: stations.reduce((t, s) => t + s.arrivals, 0),
      groundSeen: stations.reduce((t, s) => t + s.groundSeen, 0),
      openRecordArrivals: stations.reduce((t, s) => t + s.openRecordArrivals, 0),
    },
  }
}

/** Günlük 7 günlük oran işinin yazacağı satırlar (`writeStationArrivalCoverage7d` girdisi). */
export function arrivalCoverageRatioRows(
  result: ArrivalCoverageResult,
): { icao: string; arrivals: number; groundSeen: number }[] {
  return result.stations.map((s) => ({
    icao: s.icao,
    arrivals: s.arrivals,
    groundSeen: s.groundSeen,
  }))
}
