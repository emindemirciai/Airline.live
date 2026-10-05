import {
  arrivalCoverageWindow,
  type ArrivalCoverageAggregateInput,
  type ArrivalCoverageProviderInput,
  type ArrivalObservation,
} from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import {
  aglCaptureShare,
  arrivalCoverageRatioRows,
  arrivalProposals,
  arrivalSubsetStats,
  DEFAULT_BARO_TOLERANCE,
  degradedAfter,
  groundShareRule,
  medianRule,
  providerWindowSummary,
  qnhAt,
  summarizeArrivalCoverage,
} from './aggregate'
import { classifyArrivalRecord } from './classify'
import { approach, ESB, IST, observation, record, rollout, SAW, T0 } from './test/synthetic'

const S = 1000
const MIN = 60 * S
const HOUR = 60 * MIN

/** İşin başlangıcı: pencere [T0 − 1 sa, T0 + 23 sa) olsun diye T0 + 23 sa 45 dk. */
const JOB_START = T0 + 23 * HOUR + 45 * MIN
const WINDOW = arrivalCoverageWindow(JOB_START, 24)

function input(
  overrides: Partial<ArrivalCoverageAggregateInput> = {},
): ArrivalCoverageAggregateInput {
  return {
    window: WINDOW,
    hours: 24,
    stations: [IST],
    observations: [],
    geomOnly: [],
    windowStats: [
      {
        icao: 'LTFM',
        airborneSamples: 1000,
        baroRateNull: 10,
        seenPosNull: 20,
        firstBaroRateTs: WINDOW.start,
      },
    ],
    provider: null,
    qnh: [],
    ...overrides,
  }
}

const station = (result: ReturnType<typeof summarizeArrivalCoverage>, icao = 'LTFM') => {
  const s = result.stations.find((x) => x.icao === icao)
  if (s === undefined) throw new Error(`no station ${icao}`)
  return s
}

/** `n` gözlem, ilk `ground` tanesi yerde görülmüş. */
function many(
  n: number,
  ground: number,
  extra: Partial<ArrivalObservation> = {},
): ArrivalObservation[] {
  return Array.from({ length: n }, (_, i) =>
    observation({
      firstQualTs: T0 + i * MIN,
      groundSeen: i < ground,
      noGround: i < ground ? null : 'lost_low',
      ...extra,
    }),
  )
}

describe('kural 1: yerde örneği payı', () => {
  it("%70 sınırı: 7/10 uygulanmaz, 6/10 uygulanır; Wilson aralığı %70'i içeriyorsa sınırda", () => {
    expect(groundShareRule(10, 7)).toEqual({
      verdict: 'does_not_apply',
      borderline: true,
      lowSample: true,
    })
    expect(groundShareRule(10, 6).verdict).toBe('applies')
    // Çok örnekte aralık daralır: 300/1000 açıkça uygulanır, sınırda değil.
    expect(groundShareRule(1000, 300)).toEqual({
      verdict: 'applies',
      borderline: false,
      lowSample: false,
    })
    expect(groundShareRule(1000, 950).borderline).toBe(false)
  })

  it('az örnek: 19 varış evet, 20 varış hayır; 0 varış "no_arrivals"', () => {
    expect(groundShareRule(19, 2).lowSample).toBe(true)
    expect(groundShareRule(20, 2).lowSample).toBe(false)
    expect(groundShareRule(0, 0)).toEqual({
      verdict: 'no_arrivals',
      borderline: false,
      lowSample: true,
    })
  })
})

describe('kural 2: medyan AGL ve eşik mesafesi', () => {
  const stats = (agls: number[], kms: number[], method: 'geoid' | 'baro_tolerant' = 'geoid') =>
    arrivalSubsetStats(
      agls.map((aglFt, i) =>
        observation({ lastAirborne: { aglFt, aglMethod: method, thresholdKm: kms[i] ?? 1 } }),
      ),
      DEFAULT_BARO_TOLERANCE,
    )

  it('tek ve çift sayıda medyan', () => {
    expect(stats([100, 900, 500], [1, 2, 3]).medianAglFt).toBe(500)
    expect(stats([100, 900, 500, 700], [1, 2, 3, 4]).medianAglFt).toBe(600)
    expect(stats([100, 900, 500, 700], [1, 2, 3, 4]).medianThresholdKm).toBe(2.5)
  })

  it('1.000 ft ve 8 km sınırları (dahil değil)', () => {
    expect(medianRule(stats([1000], [8]), 1).verdict).toBe('does_not_apply')
    expect(medianRule(stats([1000.5], [1]), 1).verdict).toBe('applies')
    expect(medianRule(stats([200], [8.01]), 1).verdict).toBe('applies')
    expect(medianRule(stats([], []), 0)).toEqual({
      verdict: 'no_arrivals',
      borderline: false,
      lowSample: true,
    })
  })

  it('baro belirsizliği sonucu değiştiriyorsa sınırda; geoid yönteminde değil', () => {
    const baro = stats([900, 900, 900], [1, 1, 1], 'baro_tolerant')
    expect(baro.medianAglRangeFt).toEqual({ low: 600, high: 1200 })
    expect(medianRule(baro, 3)).toEqual({
      verdict: 'does_not_apply',
      borderline: true,
      lowSample: true,
    })
    const geoid = stats([900, 900, 900], [1, 1, 1], 'geoid')
    expect(geoid.medianAglRangeFt).toEqual({ low: 900, high: 900 })
    expect(medianRule(geoid, 3).borderline).toBe(false)
  })
})

describe('öneriler ve yakalama payları', () => {
  const obs = [
    observation({ lastAirborne: { aglFt: 150, thresholdKm: 1.2, arpKm: 2.1 } }),
    observation({ lastAirborne: { aglFt: 420, thresholdKm: 2.6, arpKm: 4.4 } }),
    observation({ lastAirborne: { aglFt: 880, thresholdKm: 5.1, arpKm: 6.9 } }),
    observation({ lastAirborne: { aglFt: 1210, thresholdKm: 7.4, arpKm: 9.6 } }),
    observation({ lastAirborne: { aglFt: 2050, thresholdKm: 11.8, arpKm: 13.3 } }),
  ]

  it("p50/p75/p90: AGL 100 ft'e, mesafe 0,5 km'ye yukarı yuvarlanır; çiftin birlikte yakaladığı pay", () => {
    const proposals = arrivalProposals(obs, 'threshold', DEFAULT_BARO_TOLERANCE)
    expect(proposals.map((p) => [p.percentile, p.aglFt, p.distanceKm])).toEqual([
      [50, 900, 5.5],
      [75, 1300, 7.5],
      [90, 1800, 10.5],
    ])
    expect(proposals.map((p) => p.capture.count)).toEqual([3, 4, 4])
    expect(proposals[0]?.capture.share).toBeCloseTo(0.6, 9)
    const arp = arrivalProposals(obs, 'arp', DEFAULT_BARO_TOLERANCE)
    expect(arp.map((p) => p.distanceKm)).toEqual([7, 10, 12])
    expect(arrivalProposals([], 'arp', DEFAULT_BARO_TOLERANCE)).toEqual([])
  })

  it("bugünkü kuralların yakalama payı (high eşikte, medium/low ARP'ta)", () => {
    const s = arrivalSubsetStats(obs, DEFAULT_BARO_TOLERANCE)
    expect(s.capture.high.count).toBe(1)
    expect(s.capture.medium.count).toBe(3)
    expect(s.capture.low.count).toBe(5)
    expect(s.capture.high_or_medium.count).toBe(3)
    expect(s.capture.low.n).toBe(5)
  })

  it("baro gözlemlerde pay ±300 ft aralığıyla; AGL'si bilinmeyen paydaya girmez", () => {
    const mixed = [
      observation({
        lastAirborne: { aglFt: 250, aglMethod: 'baro_tolerant', thresholdKm: 1, arpKm: 2 },
      }),
      observation({
        lastAirborne: { aglFt: 500, aglMethod: 'baro_tolerant', thresholdKm: 1, arpKm: 2 },
      }),
      observation({ lastAirborne: { aglFt: 100, aglMethod: 'geoid', thresholdKm: 1, arpKm: 2 } }),
      observation({ lastAirborne: { aglFt: null, aglMethod: null, thresholdKm: 1, arpKm: 2 } }),
    ]
    const high = aglCaptureShare(mixed, (agl) => agl <= 300, DEFAULT_BARO_TOLERANCE)
    expect(high).toEqual({ count: 2, n: 3, share: 2 / 3, low: 1 / 3, high: 1 })
    const s = arrivalSubsetStats(mixed, DEFAULT_BARO_TOLERANCE)
    expect(s.n).toBe(4)
    expect(s.withAgl).toBe(3)
  })
})

describe('summarizeArrivalCoverage', () => {
  it('pencere: başlangıç dahil, bitiş hariç; açık kayıt ayrıca sayılır', () => {
    const result = summarizeArrivalCoverage(
      input({
        observations: [
          observation({ firstQualTs: WINDOW.start, groundSeen: true, noGround: null }),
          observation({ firstQualTs: WINDOW.end - 1 }),
          observation({ firstQualTs: WINDOW.end }),
          observation({ firstQualTs: WINDOW.start - 1 }),
          observation({ firstQualTs: WINDOW.start + HOUR, recordClosed: false }),
          observation({ icao: 'LTFJ', firstQualTs: WINDOW.start + HOUR }),
        ],
      }),
    )
    const s = station(result)
    expect(s.arrivals).toBe(2)
    expect(s.groundSeen).toBe(1)
    expect(s.groundShare).toBe(0.5)
    expect(s.openRecordArrivals).toBe(1)
    expect(result.totals).toEqual({ arrivals: 2, groundSeen: 1, openRecordArrivals: 1 })
    expect(result.window).toEqual({
      start: new Date(WINDOW.start).toISOString(),
      end: new Date(WINDOW.end).toISOString(),
      hours: 24,
    })
  })

  it('yerde örneği yoksa sınıflar ve left_zone/other_field hariç duyarlılık', () => {
    const observations = [
      ...many(4, 4),
      observation({ noGround: 'lost_low' }),
      observation({ noGround: 'lost_low' }),
      observation({ noGround: 'left_zone' }),
      observation({ noGround: 'other_field' }),
    ]
    const s = station(summarizeArrivalCoverage(input({ observations })))
    expect(s.noGround).toEqual({ lost_low: 2, left_zone: 1, other_field: 1 })
    expect(s.groundShare).toBe(0.5)
    expect(s.groundShareExcludingLeft).toMatchObject({ count: 4, n: 6, share: 4 / 6 })
    expect(s.rule1.verdict).toBe('applies')
    expect(s.lostLow.n).toBe(2)
    expect(s.all.n).toBe(8)
  })

  it('seen_pos kovaları (negatif ve bilinmeyen dahil) ve p50/p90/p99', () => {
    const s = station(
      summarizeArrivalCoverage(
        input({
          observations: [
            observation({ seenPosS: [-0.5, 0, 0.4, 1, 2.5], seenPosUnknown: 2 }),
            observation({ seenPosS: [7, 12, 45, 61], seenPosUnknown: 1 }),
          ],
        }),
      ),
    )
    expect(s.seenPos.buckets).toEqual({
      lt0: 1,
      '0-1': 2,
      '1-2': 1,
      '2-5': 1,
      '5-10': 1,
      '10-30': 1,
      '30-60': 1,
      ge60: 1,
      unknown: 3,
    })
    expect(s.seenPos.samples).toBe(12)
    expect(s.seenPos.p50).toBe(2.5)
    expect(s.seenPos.p90).toBeCloseTo(48.2, 9)
    expect(s.seenPos.p99).toBeCloseTo(59.72, 9)
  })

  it('AGL yöntemleri, histogramlar ve notlar', () => {
    const result = summarizeArrivalCoverage(
      input({
        stations: [IST, ESB],
        windowStats: [
          {
            icao: 'LTFM',
            airborneSamples: 100,
            baroRateNull: 0,
            seenPosNull: 0,
            firstBaroRateTs: WINDOW.start,
          },
          {
            icao: 'LTAC',
            airborneSamples: 100,
            baroRateNull: 6,
            seenPosNull: 0,
            firstBaroRateTs: null,
          },
        ],
        observations: [
          observation({
            lastAirborne: { aglFt: -40, aglMethod: 'geoid', thresholdKm: 0.5, arpKm: 2 },
          }),
          observation({
            lastAirborne: { aglFt: 250, aglMethod: 'baro_tolerant', thresholdKm: 2.9, arpKm: 3 },
          }),
          observation({
            lastAirborne: { aglFt: null, aglMethod: null, thresholdKm: 9, arpKm: 10 },
          }),
          observation({
            icao: 'LTAC',
            lastAirborne: {
              aglFt: 3200,
              aglMethod: 'baro_tolerant',
              thresholdKm: 31,
              arpKm: 31,
              thresholdFallback: true,
            },
          }),
        ],
      }),
    )
    const ist = station(result)
    expect(ist.aglMethods).toEqual({ geoid: 1, baro_tolerant: 1, unknown: 1 })
    expect(ist.aglHistogram).toMatchObject({ lt0: 1, '0-300': 1, unknown: 1 })
    expect(ist.thresholdHistogram).toEqual({ '0-3': 2, '3-8': 0, '8-15': 1, '15-30': 0, ge30: 0 })
    expect(ist.notes).toEqual([])
    expect(ist.thresholdElevationDeltaFt).toEqual({ min: -25, max: 5 })
    const esb = station(result, 'LTAC')
    expect(esb.notes).toEqual(['threshold_fallback', 'no_geoid', 'data_gap', 'no_baro_rate'])
    expect(esb.thresholdFallbackOnly).toBe(true)
    expect(esb.aglHistogram).toMatchObject({ ge3000: 1 })
    expect(esb.effectiveWindow).toEqual({
      start: null,
      airborneSamples: 100,
      baroRateNullShare: 0.06,
      seenPosNullShare: 0,
      warning: true,
    })
    expect(result.dataGapWarning).toBe(true)
    expect(result.effectiveStart).toBe(new Date(WINDOW.start).toISOString())
  })

  it("QNH: penceredeki uç değerler, sapma aralığı, düzeltilmiş medyan; sapma ±300 ft'i aşınca aralık genişler", () => {
    const t = WINDOW.start + 2 * HOUR
    const result = summarizeArrivalCoverage(
      input({
        qnh: [
          { icao: 'LTFM', observedAt: WINDOW.start - 30 * MIN, qnhHpa: 1035 },
          { icao: 'LTFM', observedAt: t - 10 * MIN, qnhHpa: 1030 },
          { icao: 'LTFM', observedAt: t + 3 * HOUR, qnhHpa: 1010 },
          { icao: 'LTFJ', observedAt: t, qnhHpa: 990 },
        ],
        observations: [
          observation({
            firstQualTs: t - 5 * MIN,
            lastAirborne: { ts: t, altBaroFt: 925, aglFt: 600, aglMethod: 'baro_tolerant' },
          }),
          // QNH'si 90 dk'dan eski: düzeltilmiş medyana girmez.
          observation({
            firstQualTs: t + 2 * HOUR,
            lastAirborne: {
              ts: t + 2 * HOUR,
              altBaroFt: 1325,
              aglFt: 1000,
              aglMethod: 'baro_tolerant',
            },
          }),
        ],
      }),
    )
    const s = station(result)
    expect(s.qnh).toMatchObject({ observations: 2, minHpa: 1010, maxHpa: 1030, correctedN: 1 })
    expect(s.qnh?.biasMinFt).toBeCloseTo(-87.75, 9)
    expect(s.qnh?.biasMaxFt).toBeCloseTo(452.25, 9)
    expect(s.qnh?.correctedMedianAglFt).toBeCloseTo(600 + 452.25, 9)
    expect(s.baroToleranceFt.low).toBe(-300)
    expect(s.baroToleranceFt.high).toBeCloseTo(452.25, 9)
    expect(s.notes).toContain('qnh_bias_exceeds_tolerance')
    // 600 ft: ±300 ft ile kesin yakalanırdı (900 < 1.000); +452 ft sapmayla kesin değil.
    expect(s.all.capture.medium).toMatchObject({ count: 1, n: 2, share: 0.5, low: 0, high: 1 })
  })

  it('QNH yoksa aralık ±300 ft', () => {
    const s = station(summarizeArrivalCoverage(input({ observations: many(3, 1) })))
    expect(s.qnh).toBeNull()
    expect(s.baroToleranceFt).toEqual({ low: -300, high: 300 })
  })

  it("geometrik hız duyarlılığı yalnızca etkin pencerede (ilk dolu baro_rate'ten sonra)", () => {
    const effective = WINDOW.start + 6 * HOUR
    const s = station(
      summarizeArrivalCoverage(
        input({
          windowStats: [
            {
              icao: 'LTFM',
              airborneSamples: 100,
              baroRateNull: 1,
              seenPosNull: 1,
              firstBaroRateTs: effective,
            },
          ],
          geomOnly: [
            { icao: 'LTFM', firstQualTs: effective - 1, recordClosed: true, groundSeen: true },
            { icao: 'LTFM', firstQualTs: effective, recordClosed: true, groundSeen: true },
            { icao: 'LTFM', firstQualTs: effective + HOUR, recordClosed: true, groundSeen: false },
            { icao: 'LTFM', firstQualTs: effective + HOUR, recordClosed: false, groundSeen: true },
          ],
        }),
      ),
    )
    expect(s.geomOnly).toEqual({ arrivals: 2, groundSeen: 1, groundShare: 0.5 })
    expect(s.effectiveWindow.start).toBe(new Date(effective).toISOString())
  })

  it('sağlayıcı: satırsız ve başarısız saatler, 429 payı, durum süreleri, varış sonrası kesinti', () => {
    const h0 = WINDOW.start - (WINDOW.start % HOUR)
    const provider: ArrivalCoverageProviderInput = {
      provider: 'adsbLol',
      hours: [
        {
          hour: h0,
          present: true,
          requests: 360,
          successes: 350,
          rateLimited: 8,
          serverErrors: 2,
          networkErrors: 0,
          otherErrors: 0,
          freshnessP95MaxS: 12,
        },
        {
          hour: h0 + HOUR,
          present: false,
          requests: 0,
          successes: 0,
          rateLimited: 0,
          serverErrors: 0,
          networkErrors: 0,
          otherErrors: 0,
          freshnessP95MaxS: null,
        },
        {
          hour: h0 + 2 * HOUR,
          present: true,
          requests: 40,
          successes: 0,
          rateLimited: 40,
          serverErrors: 0,
          networkErrors: 0,
          otherErrors: 0,
          freshnessP95MaxS: 30,
        },
        {
          hour: h0 + 3 * HOUR,
          present: true,
          requests: 0,
          successes: 0,
          rateLimited: 0,
          serverErrors: 0,
          networkErrors: 0,
          otherErrors: 0,
          freshnessP95MaxS: 20,
        },
      ],
      // Dilimler pencere sonundan 10 dk sonrasına uzanır (`statusUntil`).
      spans: [
        { status: 'unknown', from: WINDOW.start, to: WINDOW.start + HOUR },
        { status: 'ok', from: WINDOW.start + HOUR, to: WINDOW.start + 2 * HOUR },
        { status: 'degraded', from: WINDOW.start + 2 * HOUR, to: WINDOW.start + 3 * HOUR },
        { status: 'ok', from: WINDOW.start + 3 * HOUR, to: WINDOW.end + 5 * MIN },
        { status: 'down', from: WINDOW.end + 5 * MIN, to: WINDOW.end + 10 * MIN },
      ],
    }
    const summary = providerWindowSummary(provider, WINDOW)
    expect(summary).toMatchObject({
      hours: 4,
      hourRange: {
        start: new Date(h0).toISOString(),
        end: new Date(h0 + 4 * HOUR).toISOString(),
      },
      hoursWithoutRows: 1,
      hoursWithoutSuccess: 2,
      requests: 400,
      rateLimited: 48,
      serverErrors: 2,
      rateLimitedShare: 0.12,
      serverErrorShare: 0.005,
      freshnessP95MaxS: { max: 30, median: 20 },
    })
    // Durum süreleri pencereye kırpılır: pencere sonundan sonraki `ok` ve `down` sayılmaz.
    expect(summary.statusMs).toEqual({
      ok: 22 * HOUR,
      degraded: HOUR,
      down: 0,
      unknown: HOUR,
    })
    // Kesintiden 10 dk önce başlayan varış sayılır, 10 dk + 1 ms önce başlayan sayılmaz.
    expect(degradedAfter(provider.spans, WINDOW.start + 2 * HOUR - 10 * MIN)).toBe(true)
    expect(degradedAfter(provider.spans, WINDOW.start + 2 * HOUR - 10 * MIN - 1)).toBe(false)
    expect(degradedAfter(provider.spans, WINDOW.start + 3 * HOUR)).toBe(false)
    // Pencerenin son dakikasındaki varış, pencere bittikten sonraki kesintiyi görür.
    expect(degradedAfter(provider.spans, WINDOW.end - MIN)).toBe(true)
    const s = station(
      summarizeArrivalCoverage(
        input({
          provider,
          observations: [
            observation({ firstQualTs: WINDOW.start + 2 * HOUR + 5 * MIN }),
            observation({ firstQualTs: WINDOW.start + 5 * HOUR }),
            observation({ firstQualTs: WINDOW.end - MIN }),
          ],
        }),
      ),
    )
    expect(s.degradedAfterArrival).toBe(2)
    expect(station(summarizeArrivalCoverage(input())).degradedAfterArrival).toBeNull()
  })

  it('istek yoksa paylar boş', () => {
    const summary = providerWindowSummary({ provider: 'adsbLol', hours: [], spans: [] }, WINDOW)
    expect(summary.rateLimitedShare).toBeNull()
    expect(summary.hourRange).toBeNull()
    expect(summary.freshnessP95MaxS).toEqual({ max: null, median: null })
  })

  it('qnhAt: en geç gözlem, en çok 90 dk eski (dahil)', () => {
    const series = [
      { icao: 'LTFM', observedAt: 0, qnhHpa: 1010 },
      { icao: 'LTFM', observedAt: 30 * MIN, qnhHpa: 1012 },
    ]
    expect(qnhAt(series, 29 * MIN)).toBe(1010)
    expect(qnhAt(series, 30 * MIN)).toBe(1012)
    expect(qnhAt(series, 120 * MIN)).toBe(1012)
    expect(qnhAt(series, 120 * MIN + 1)).toBeNull()
    expect(qnhAt(series, -1)).toBeNull()
  })

  it('sınıflandırıcıdan uçtan uca: aynı girdi aynı JSON; çıktıda kimlik yok; oran satırları', () => {
    const landed = record([
      ...approach({
        station: IST,
        bearingDeg: 180,
        startKm: 12,
        endKm: 3,
        startAglFt: 2500,
        endAglFt: 250,
        startTs: T0,
        count: 10,
        withGeom: true,
      }),
      ...rollout(IST, { startTs: T0 + 50 * S, count: 3, bearingDeg: 180, fromKm: 2.4, toKm: 2 }),
    ])
    const lost = record(
      approach({
        station: IST,
        bearingDeg: 0,
        startKm: 12,
        endKm: 4,
        startAglFt: 2500,
        endAglFt: 600,
        startTs: T0 + HOUR,
        count: 10,
      }),
    )
    const sawLost = record(
      approach({
        station: SAW,
        bearingDeg: 240,
        startKm: 12,
        endKm: 3,
        startAglFt: 2500,
        endAglFt: 400,
        startTs: T0 + 2 * HOUR,
        count: 10,
      }),
    )
    const observations = [landed, lost, sawLost].flatMap(
      (r) => classifyArrivalRecord(r, [IST, SAW], { closedCutoffTs: WINDOW.closedCutoff }).arrivals,
    )
    const build = () =>
      summarizeArrivalCoverage(
        input({
          stations: [IST, SAW],
          observations,
          windowStats: [
            {
              icao: 'LTFM',
              airborneSamples: 20,
              baroRateNull: 0,
              seenPosNull: 0,
              firstBaroRateTs: T0,
            },
            {
              icao: 'LTFJ',
              airborneSamples: 10,
              baroRateNull: 0,
              seenPosNull: 0,
              firstBaroRateTs: T0,
            },
          ],
        }),
      )
    const a = build()
    expect(JSON.stringify(a)).toBe(JSON.stringify(build()))
    expect(JSON.stringify(a)).not.toMatch(/hex|callsign|registration/i)
    expect(station(a).arrivals).toBe(2)
    expect(station(a).groundShare).toBe(0.5)
    expect(station(a).aglMethods).toEqual({ geoid: 1, baro_tolerant: 1, unknown: 0 })
    expect(station(a, 'LTFJ').arrivals).toBe(1)
    expect(station(a, 'LTFJ').rule1.verdict).toBe('applies')
    expect(station(a, 'LTFJ').notes).toEqual(['geoid_fallback'])
    expect(arrivalCoverageRatioRows(a)).toEqual([
      { icao: 'LTFM', arrivals: 2, groundSeen: 1 },
      { icao: 'LTFJ', arrivals: 1, groundSeen: 0 },
    ])
    expect(a.definitionVersion).toBe(1)
    expect(a.jobStart).toBe(new Date(JOB_START).toISOString())
  })

  it('varışı olmayan istasyon', () => {
    const s = station(summarizeArrivalCoverage(input()))
    expect(s.arrivals).toBe(0)
    expect(s.groundShare).toBeNull()
    expect(s.groundShareWilson).toBeNull()
    expect(s.rule1.verdict).toBe('no_arrivals')
    expect(s.rule2.verdict).toBe('no_arrivals')
    expect(s.all.medianAglFt).toBeNull()
    expect(s.all.proposals).toEqual({ threshold: [], arp: [] })
  })
})
