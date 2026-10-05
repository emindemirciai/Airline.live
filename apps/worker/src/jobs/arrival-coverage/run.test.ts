import * as db from '@havayolu/db'
import {
  ARRIVAL_CANDIDATE_RULE,
  ARRIVAL_COVERAGE_DEFINITION_VERSION,
  ARRIVAL_COVERAGE_SETTLE_MS,
  arrivalCoverageWindow,
  type ArrivalCoverageResult,
} from '@havayolu/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ArrivalCoverageError,
  arrivalCoverageFailure,
  arrivalCoverageMaxHours,
  arrivalCoverageRatioRetryable,
  computeArrivalCoverage,
  retentionExceededError,
  runArrivalCoverageRatio7d,
  runNextArrivalCoverageReport,
} from './run'
import { approach, IST, record, rollout, T0 } from './test/synthetic'

vi.mock('@havayolu/db', async (importOriginal) => {
  const actual = await importOriginal<typeof db>()
  return {
    ...actual,
    readArrivalCoverageStations: vi.fn(),
    readNearbyAirfields: vi.fn(),
    readArrivalCoverageWindowStats: vi.fn(),
    findArrivalCandidateFlights: vi.fn(),
    readArrivalCoverageFlights: vi.fn(),
    arrivalCoverageSampleBatches: vi.fn(),
    readProviderWindowStats: vi.fn(),
    readMetarQnhSeries: vi.fn(),
    claimNextArrivalCoverageReport: vi.fn(),
    finishArrivalCoverageReport: vi.fn(),
    failArrivalCoverageReport: vi.fn(),
    writeStationArrivalCoverage7d: vi.fn(),
  }
})

const MIN = 60_000
const HOUR = 60 * MIN
const JOB_START = new Date(T0 + 23 * HOUR + 45 * MIN)
const sql = {} as db.Database['sql']

const STATION_ROW: db.ArrivalCoverageStationRow = {
  icao: 'LTFM',
  iata: 'IST',
  isPrimary: true,
  airportId: 1,
  lat: IST.arp.lat,
  lon: IST.arp.lon,
  elevationFt: 325,
  geoidUndulationM: 37.05,
  thresholds: IST.thresholds.map((t, i) => ({
    runwayId: 1,
    end: i === 0 ? 'le' : 'he',
    ident: t.ident,
    lat: t.lat,
    lon: t.lon,
    source: t.source,
    elevationFt: t.elevationFt,
  })),
}

/** Üç kayıt: biri iner, ikisi alçakta kaybolur; dördüncüsü (id 4) örneksiz. */
function flightSamples(): db.ArrivalCoverageFlightSamples[] {
  const landed = record([
    ...approach({
      station: IST,
      bearingDeg: 180,
      startKm: 14,
      endKm: 3,
      startAglFt: 2500,
      endAglFt: 150,
      startTs: T0,
      count: 30,
      withGeom: true,
    }),
    ...rollout(IST, { startTs: T0 + 150_000, count: 3, bearingDeg: 180, fromKm: 2, toKm: 1 }),
  ])
  const lost = (start: number) =>
    record(
      approach({
        station: IST,
        bearingDeg: 0,
        startKm: 12,
        endKm: 4,
        startAglFt: 2000,
        endAglFt: 400,
        startTs: start,
        count: 12,
      }),
    )
  return [landed, lost(T0 + HOUR), lost(T0 + 2 * HOUR)]
    .map((r, i) => ({
      flightId: i + 1,
      firstSeenTs: r.samples[0]?.ts ?? 0,
      lastSeenTs: r.lastSeenTs,
      samples: r.samples.map((s) => ({ ...s })),
    }))
    .concat([{ flightId: 4, firstSeenTs: T0, lastSeenTs: T0, samples: [] }])
}

function mockHappyPath() {
  const m = vi.mocked
  m(db.readArrivalCoverageStations).mockResolvedValue([STATION_ROW])
  m(db.readNearbyAirfields).mockResolvedValue([])
  m(db.readArrivalCoverageWindowStats).mockResolvedValue([
    { icao: 'LTFM', airborneSamples: 500, baroRateNull: 0, seenPosNull: 0, firstBaroRateTs: T0 },
  ])
  m(db.findArrivalCandidateFlights).mockResolvedValue([1, 2, 3, 4])
  const samples = flightSamples()
  m(db.readArrivalCoverageFlights).mockResolvedValue(
    samples.map((f) => ({
      id: f.flightId,
      firstSeenAt: f.firstSeenTs,
      lastSeenAt: f.lastSeenTs,
      status: 'ended',
    })),
  )
  m(db.arrivalCoverageSampleBatches).mockImplementation(async function* (_sql, params) {
    const size = params.batchSize ?? 200
    const wanted = new Set(params.flights.map((f) => f.id))
    const all = samples.filter((f) => wanted.has(f.flightId))
    for (let i = 0; i < all.length; i += size) yield all.slice(i, i + size)
  })
  m(db.readProviderWindowStats).mockResolvedValue({ provider: 'adsbLol', hours: [], spans: [] })
  m(db.readMetarQnhSeries).mockResolvedValue([])
}

beforeEach(() => {
  vi.resetAllMocks()
  mockHappyPath()
})

describe('saklama süresi ve hata eşlemesi', () => {
  it('en uzun rapor = (saklama günü − 1) × 24 saat', () => {
    expect(arrivalCoverageMaxHours(30)).toBe(696)
    expect(arrivalCoverageMaxHours(8)).toBe(168)
    expect(arrivalCoverageMaxHours(7)).toBe(144)
    expect(arrivalCoverageMaxHours(1)).toBe(0)
  })

  it('Türkçe hata iletileri; SQLSTATE 57014 ve 55P03 ayrı kodlar', () => {
    expect(retentionExceededError(168, 7).message).toBe(
      '168 saatlik rapor ince iz saklama süresini aşıyor: TRACK_FINE_RETENTION_DAYS=7 iken en ' +
        'çok 144 saat seçilebilir (pencereden önce 24 saat geriye bakılır).',
    )
    expect(
      arrivalCoverageFailure(Object.assign(new Error('canceling'), { code: '57014' })),
    ).toMatchObject({
      code: 'statement_timeout',
      message: expect.stringContaining('60 sn') as string,
    })
    expect(arrivalCoverageFailure(Object.assign(new Error('lock'), { code: '55P03' })).code).toBe(
      'lock_timeout',
    )
    expect(arrivalCoverageFailure(new Error('boom'))).toEqual({
      code: 'unexpected',
      message: 'Beklenmeyen hata: boom',
    })
    const known = new ArrivalCoverageError('no_stations', 'x')
    expect(arrivalCoverageFailure(known)).toEqual({ code: 'no_stations', message: 'x' })
  })
})

describe('computeArrivalCoverage', () => {
  it('okuyuculara tanımları geçirir, kayıtları sınıflandırır ve sonucu üretir', async () => {
    const { result, stats } = await computeArrivalCoverage(
      { sql, batchSize: 2 },
      { jobStart: JOB_START, hours: 24 },
    )
    const window = arrivalCoverageWindow(JOB_START.getTime(), 24)
    expect(vi.mocked(db.readNearbyAirfields).mock.calls[0]?.[1]).toEqual({
      stations: [{ icao: 'LTFM', lat: IST.arp.lat, lon: IST.arp.lon }],
      radiusKm: 30,
    })
    expect(vi.mocked(db.readArrivalCoverageWindowStats).mock.calls[0]?.[1]).toEqual({
      stations: [{ icao: 'LTFM', lat: IST.arp.lat, lon: IST.arp.lon }],
      zoneKm: 30,
      from: new Date(window.start),
      to: new Date(window.end),
    })
    expect(vi.mocked(db.findArrivalCandidateFlights).mock.calls[0]?.[1]).toEqual({
      stations: [{ icao: 'LTFM', lat: IST.arp.lat, lon: IST.arp.lon, elevationFt: 325 }],
      rule: ARRIVAL_CANDIDATE_RULE,
      from: new Date(window.start),
      to: new Date(window.end),
    })
    const batchParams = vi.mocked(db.arrivalCoverageSampleBatches).mock.calls[0]?.[1]
    expect(batchParams?.lookbackStart).toEqual(new Date(window.lookbackStart))
    expect(batchParams?.to).toEqual(JOB_START)
    expect(batchParams?.batchSize).toBe(2)
    // Durum geçişleri pencere sonundan 10 dk sonrasına kadar (varış sonrası kesinti).
    expect(vi.mocked(db.readProviderWindowStats).mock.calls[0]?.[1]).toEqual({
      provider: 'adsbLol',
      from: new Date(window.start),
      to: new Date(window.end),
      statusUntil: new Date(window.end + 10 * MIN),
    })
    expect(vi.mocked(db.readMetarQnhSeries).mock.calls[0]?.[1]).toEqual({
      icaos: ['LTFM'],
      from: new Date(window.start - 90 * MIN),
      to: new Date(window.end),
    })

    expect(result.window).toEqual({
      start: new Date(window.start).toISOString(),
      end: new Date(window.end).toISOString(),
      hours: 24,
    })
    const ist = result.stations[0]
    expect(ist).toMatchObject({ icao: 'LTFM', arrivals: 3, groundSeen: 1 })
    expect(ist?.noGround).toEqual({ lost_low: 2, left_zone: 0, other_field: 0 })
    expect(stats).toMatchObject({
      stations: 1,
      candidates: 4,
      flights: 4,
      batches: 2,
      arrivals: 3,
      geomOnly: 0,
    })
    expect(stats.samples).toBe(33 + 12 + 12)
  })

  it('etkin istasyon yoksa no_stations', async () => {
    vi.mocked(db.readArrivalCoverageStations).mockResolvedValue([])
    await expect(
      computeArrivalCoverage({ sql }, { jobStart: JOB_START, hours: 24 }),
    ).rejects.toMatchObject({ code: 'no_stations' })
  })

  it('dolu baro_rate yoksa rapor no_baro_rate ile durur; günlük iş (requireBaroRate false) sürer', async () => {
    vi.mocked(db.readArrivalCoverageWindowStats).mockResolvedValue([
      {
        icao: 'LTFM',
        airborneSamples: 500,
        baroRateNull: 500,
        seenPosNull: 500,
        firstBaroRateTs: null,
      },
    ])
    const error = await computeArrivalCoverage({ sql }, { jobStart: JOB_START, hours: 24 }).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(ArrivalCoverageError)
    expect((error as ArrivalCoverageError).code).toBe('no_baro_rate')
    expect((error as ArrivalCoverageError).message).toContain('24 saat 45 dakika')
    expect(db.findArrivalCandidateFlights).not.toHaveBeenCalled()

    const daily = await computeArrivalCoverage(
      { sql },
      { jobStart: JOB_START, hours: 24, requireBaroRate: false },
    )
    expect(daily.result.effectiveStart).toBeNull()
  })

  it('bütçe partiler arasında denetlenir: aşılınca budget_exceeded (okunan parti sayısıyla)', async () => {
    let t = 0
    const clock = () => t
    vi.mocked(db.arrivalCoverageSampleBatches).mockImplementation(async function* () {
      for (const part of [flightSamples().slice(0, 2), flightSamples().slice(2)]) {
        t += 6 * MIN
        yield part
      }
    })
    const error = await computeArrivalCoverage(
      { sql, clock, budgetMs: 10 * MIN, batchSize: 2 },
      { jobStart: JOB_START, hours: 24 },
    ).catch((e: unknown) => e)
    expect(error).toMatchObject({
      code: 'budget_exceeded',
      message:
        'Rapor 10 dakikalık süre sınırını aştı (2/2 uçuş partisi okundu); daha kısa bir süre seç.',
    })
    expect(db.readProviderWindowStats).not.toHaveBeenCalled()
  })

  it('bütçe aday sorgusundan sonra da denetlenir: örnekler okunmaz', async () => {
    let t = 0
    vi.mocked(db.findArrivalCandidateFlights).mockImplementation(async () => {
      t += 11 * MIN
      return [1, 2, 3, 4]
    })
    await expect(
      computeArrivalCoverage(
        { sql, clock: () => t, budgetMs: 10 * MIN },
        { jobStart: JOB_START, hours: 24 },
      ),
    ).rejects.toMatchObject({
      code: 'budget_exceeded',
      message:
        'Rapor 10 dakikalık süre sınırını aştı (uçuş örnekleri okunmadan önce); daha kısa bir süre seç.',
    })
    expect(db.readArrivalCoverageFlights).not.toHaveBeenCalled()
    expect(db.arrivalCoverageSampleBatches).not.toHaveBeenCalled()
  })

  it('iptal sinyali okumadan önce ve partiler arasında denetlenir', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      computeArrivalCoverage(
        { sql, signal: controller.signal },
        { jobStart: JOB_START, hours: 24 },
      ),
    ).rejects.toMatchObject({ code: 'aborted' })
    expect(db.readArrivalCoverageStations).not.toHaveBeenCalled()
  })

  it('bütçe ve iptal okuyuculara checkpoint olarak geçer; çağıranın checkpoint’i de çalışır', async () => {
    const own = vi.fn()
    let seen: db.ReadOnlyOptions | undefined
    vi.mocked(db.readArrivalCoverageStations).mockImplementation(async (_sql, options) => {
      seen = options
      return [STATION_ROW]
    })
    let t = 0
    await computeArrivalCoverage(
      { sql, clock: () => t, budgetMs: 10 * MIN, readOptions: { checkpoint: own } },
      { jobStart: JOB_START, hours: 24 },
    )
    seen?.checkpoint?.()
    expect(own).toHaveBeenCalledTimes(1)
    t = 11 * MIN
    expect(() => seen?.checkpoint?.()).toThrow(ArrivalCoverageError)
  })

  it('okuma yeniden denemesi günlüğe yazılır ve çağıranın onRetry’ı da çalışır', async () => {
    const warn = vi.fn()
    const onRetry = vi.fn()
    vi.mocked(db.readArrivalCoverageStations).mockImplementation(async (_sql, options) => {
      options?.onRetry?.({ attempt: 1, code: '55P03', delayMs: 300 })
      return [STATION_ROW]
    })
    await computeArrivalCoverage(
      { sql, log: { info: vi.fn(), warn }, readOptions: { onRetry } },
      { jobStart: JOB_START, hours: 24 },
    )
    expect(warn).toHaveBeenCalledWith(
      { attempt: 1, code: '55P03', delayMs: 300 },
      'arrival coverage read retry',
    )
    expect(onRetry).toHaveBeenCalledWith({ attempt: 1, code: '55P03', delayMs: 300 })
  })
})

describe('bütçe ve iptal gün dilimleri arasında (gerçek okuyucu, yavaş sahte bağlantı)', () => {
  /**
   * Sahte bağlantı: her ifade denemesi `attemptMs` sürer (saat ilerler); bir gün diliminin ilk
   * `failFirst` denemesi 57014 ile düşer. Pencere istatistikleri db'nin gerçek okuyucusuyla, gün gün
   * okunur (168 saatlik pencere 8 UTC günü).
   */
  async function slowDatabase(params: { attemptMs: number; failFirst: number }) {
    const actual = await vi.importActual<typeof db>('@havayolu/db')
    vi.mocked(db.readArrivalCoverageWindowStats).mockImplementation(
      actual.readArrivalCoverageWindowStats,
    )
    const state = { now: 0, statements: 0, onStatement: (_n: number): void => undefined }
    const attempts = new Map<string, number>()
    const tx = Object.assign(() => Promise.resolve([]), {
      unsafe: (_text: string, values: unknown[]) => {
        state.statements += 1
        state.onStatement(state.statements)
        const slice = String(values[1])
        const n = (attempts.get(slice) ?? 0) + 1
        attempts.set(slice, n)
        if (n <= params.failFirst) {
          return Promise.reject(
            Object.assign(new Error('canceling statement due to statement timeout'), {
              code: '57014',
            }),
          )
        }
        return Promise.resolve([
          { icao: 'LTFM', airborne: 10, baro_rate_null: 0, seen_pos_null: 0, first_baro_ms: T0 },
        ])
      },
    })
    const slow = {
      begin: async (_mode: string, fn: (t: unknown) => Promise<unknown>) => {
        state.now += params.attemptMs
        return fn(tx)
      },
    } as unknown as db.Database['sql']
    const readOptions = { sleep: async () => undefined, jitter: () => 0 }
    return { slow, state, readOptions }
  }

  it('gün dilimleri arasında: bütçe aşılınca sonraki gün okunmaz', async () => {
    const { slow, state, readOptions } = await slowDatabase({ attemptMs: 3 * MIN, failFirst: 0 })
    const error = await computeArrivalCoverage(
      { sql: slow, clock: () => state.now, budgetMs: 10 * MIN, readOptions },
      { jobStart: JOB_START, hours: 168 },
    ).catch((e: unknown) => e)
    expect(error).toMatchObject({
      code: 'budget_exceeded',
      message:
        'Rapor 10 dakikalık süre sınırını aştı (uçuş örnekleri okunmadan önce); daha kısa bir süre seç.',
    })
    // 8 gün diliminden 4'ü okundu (12 dk); 5. dilimden önce bütçe görüldü.
    expect(state.statements).toBe(4)
    expect(state.now).toBe(12 * MIN)
    expect(db.findArrivalCandidateFlights).not.toHaveBeenCalled()
  })

  it('yeniden denemeden önce: 57014 sonrası bütçe aşıldıysa aynı tarama yinelenmez', async () => {
    const { slow, state, readOptions } = await slowDatabase({ attemptMs: MIN, failFirst: 2 })
    const error = await computeArrivalCoverage(
      { sql: slow, clock: () => state.now, budgetMs: 10 * MIN, readOptions },
      { jobStart: JOB_START, hours: 168 },
    ).catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'budget_exceeded' })
    // Denetim olmasaydı 8 gün × 3 deneme = 24 ifade (≈ 24 dk) çalışırdı.
    expect(state.statements).toBe(11)
    expect(state.now).toBe(11 * MIN)
  })

  it('iptal sinyali bir sonraki ifadeden önce görülür', async () => {
    const { slow, state, readOptions } = await slowDatabase({ attemptMs: MIN, failFirst: 0 })
    const controller = new AbortController()
    state.onStatement = (n) => {
      if (n === 2) controller.abort()
    }
    await expect(
      computeArrivalCoverage(
        { sql: slow, clock: () => state.now, signal: controller.signal, readOptions },
        { jobStart: JOB_START, hours: 168 },
      ),
    ).rejects.toMatchObject({ code: 'aborted' })
    expect(state.statements).toBe(2)
  })
})

describe('günlük oran işinin yeniden denenmesi', () => {
  it('bilinen hatalar ve son 57014/55P03 yeniden denenmez; kapanış ve bağlantı hatası denenir', () => {
    const sqlError = (code: string) => Object.assign(new Error(code), { code })
    expect(arrivalCoverageRatioRetryable(new ArrivalCoverageError('budget_exceeded', 'x'))).toBe(
      false,
    )
    expect(arrivalCoverageRatioRetryable(new ArrivalCoverageError('no_baro_rate', 'x'))).toBe(false)
    expect(arrivalCoverageRatioRetryable(sqlError('57014'))).toBe(false)
    expect(arrivalCoverageRatioRetryable(sqlError('55P03'))).toBe(false)
    expect(arrivalCoverageRatioRetryable(new ArrivalCoverageError('aborted', 'x'))).toBe(true)
    expect(arrivalCoverageRatioRetryable(sqlError('ECONNREFUSED'))).toBe(true)
    expect(arrivalCoverageRatioRetryable(new Error('connection ended'))).toBe(true)
  })
})

describe('runNextArrivalCoverageReport', () => {
  const now = () => JOB_START
  const claimed = (hours: number): db.ClaimedArrivalCoverageReport => ({
    id: 12,
    hours,
    requestedAt: new Date(JOB_START.getTime() - MIN),
    startedAt: JOB_START,
    windowStart: new Date(JOB_START.getTime() - ARRIVAL_COVERAGE_SETTLE_MS - hours * HOUR),
    windowEnd: new Date(JOB_START.getTime() - ARRIVAL_COVERAGE_SETTLE_MS),
    definitionVersion: ARRIVAL_COVERAGE_DEFINITION_VERSION,
  })
  const deps = { sql, now, appVersion: '0.21.0', fineRetentionDays: 30 }

  it('kuyruk boşsa idle; üstlenmeye kapanma payı ve tanım sürümü gider', async () => {
    vi.mocked(db.claimNextArrivalCoverageReport).mockResolvedValue(null)
    await expect(runNextArrivalCoverageReport(deps)).resolves.toEqual({ kind: 'idle' })
    expect(db.claimNextArrivalCoverageReport).toHaveBeenCalledWith(sql, {
      now: JOB_START,
      settleMs: ARRIVAL_COVERAGE_SETTLE_MS,
      definitionVersion: ARRIVAL_COVERAGE_DEFINITION_VERSION,
    })
    expect(db.readArrivalCoverageStations).not.toHaveBeenCalled()
  })

  it('başarıda sonuç ve Markdown yazılır', async () => {
    vi.mocked(db.claimNextArrivalCoverageReport).mockResolvedValue(claimed(24))
    vi.mocked(db.finishArrivalCoverageReport).mockResolvedValue(true)
    const info = vi.fn()
    const outcome = await runNextArrivalCoverageReport({ ...deps, log: { info, warn: vi.fn() } })
    expect(outcome).toMatchObject({ kind: 'done', reportId: 12, hours: 24, stored: true })
    const call = vi.mocked(db.finishArrivalCoverageReport).mock.calls[0]?.[1]
    expect(call?.id).toBe(12)
    expect((call?.result as ArrivalCoverageResult).stations[0]?.arrivals).toBe(3)
    expect(call?.markdown).toContain('admin raporu #12; uygulama sürümü v0.21.0')
    expect(info).toHaveBeenCalledWith(
      { reportId: 12, hours: 24 },
      'arrival coverage report started',
    )
    expect(info).toHaveBeenLastCalledWith(
      expect.objectContaining({ reportId: 12, arrivals: 3 }),
      'arrival coverage report done',
    )
    expect(db.failArrivalCoverageReport).not.toHaveBeenCalled()
  })

  it('saklama süresini aşan rapor okumadan Türkçe iletiyle failed olur', async () => {
    vi.mocked(db.claimNextArrivalCoverageReport).mockResolvedValue(claimed(168))
    vi.mocked(db.failArrivalCoverageReport).mockResolvedValue(true)
    const outcome = await runNextArrivalCoverageReport({ ...deps, fineRetentionDays: 7 })
    expect(outcome).toMatchObject({ kind: 'failed', code: 'retention_exceeded', stored: true })
    expect(db.failArrivalCoverageReport).toHaveBeenCalledWith(sql, {
      id: 12,
      now: JOB_START,
      error: retentionExceededError(168, 7).message,
    })
    expect(db.readArrivalCoverageStations).not.toHaveBeenCalled()
  })

  it('satır eskiyip kapandıysa sonuç yazılamaz (stored false); hata yazılamazsa fırlatılmaz', async () => {
    vi.mocked(db.claimNextArrivalCoverageReport).mockResolvedValue(claimed(24))
    vi.mocked(db.finishArrivalCoverageReport).mockResolvedValue(false)
    await expect(runNextArrivalCoverageReport(deps)).resolves.toMatchObject({
      kind: 'done',
      stored: false,
    })

    vi.mocked(db.claimNextArrivalCoverageReport).mockResolvedValue(claimed(24))
    vi.mocked(db.readArrivalCoverageStations).mockRejectedValue(
      Object.assign(new Error('canceling statement'), { code: '57014' }),
    )
    vi.mocked(db.failArrivalCoverageReport).mockRejectedValue(new Error('connection ended'))
    const warn = vi.fn()
    await expect(
      runNextArrivalCoverageReport({ ...deps, log: { info: vi.fn(), warn } }),
    ).resolves.toMatchObject({ kind: 'failed', code: 'statement_timeout', stored: false })
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ reportId: 12 }),
      'arrival coverage failure could not be stored',
    )
  })
})

describe('runArrivalCoverageRatio7d', () => {
  it('7 günlük pencereyi hesaplar ve istasyon sütunlarını yazar', async () => {
    vi.mocked(db.writeStationArrivalCoverage7d).mockResolvedValue(1)
    const summary = await runArrivalCoverageRatio7d({ sql, now: () => JOB_START })
    expect(db.writeStationArrivalCoverage7d).toHaveBeenCalledWith(
      sql,
      [{ icao: 'LTFM', arrivals: 3, groundSeen: 1 }],
      JOB_START,
    )
    const window = arrivalCoverageWindow(JOB_START.getTime(), 168)
    expect(summary).toMatchObject({
      windowStart: new Date(window.start).toISOString(),
      windowEnd: new Date(window.end).toISOString(),
      stations: 1,
      updated: 1,
      arrivals: 3,
      groundSeen: 1,
    })
  })

  it('veri yokken varış 0 yazılır; etkin istasyon yoksa hiçbir şey yazılmaz', async () => {
    vi.mocked(db.readArrivalCoverageWindowStats).mockResolvedValue([
      { icao: 'LTFM', airborneSamples: 0, baroRateNull: 0, seenPosNull: 0, firstBaroRateTs: null },
    ])
    vi.mocked(db.findArrivalCandidateFlights).mockResolvedValue([])
    vi.mocked(db.readArrivalCoverageFlights).mockResolvedValue([])
    await runArrivalCoverageRatio7d({ sql, now: () => JOB_START })
    expect(db.writeStationArrivalCoverage7d).toHaveBeenCalledWith(
      sql,
      [{ icao: 'LTFM', arrivals: 0, groundSeen: 0 }],
      JOB_START,
    )

    vi.clearAllMocks()
    vi.mocked(db.readArrivalCoverageStations).mockResolvedValue([])
    await expect(runArrivalCoverageRatio7d({ sql, now: () => JOB_START })).resolves.toEqual({
      stations: 0,
      updated: 0,
    })
    expect(db.writeStationArrivalCoverage7d).not.toHaveBeenCalled()
  })
})
