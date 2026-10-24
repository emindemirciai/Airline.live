import { describe, expect, it } from 'vitest'
import { greatCircleKm } from './airports'
import {
  ARRIVAL_COVERAGE_REPORT_ERROR_MAX,
  arrivalCoverageErrorText,
  arrivalCoverageTimeoutAt,
  effectiveArrivalCoverageReport,
} from './arrival-coverage-reports'
import {
  arrivalCandidateQuery,
  arrivalCoverageRetryDelayMs,
  arrivalSampleQuery,
  arrivalWindowStatsQuery,
  latLonBox,
  providerStatusSpans,
  readOnlyTransaction,
  utcDaySlices,
} from './arrival-coverage'
import { destination } from './test/geodesy'

const at = (iso: string) => new Date(iso)

describe('utcDaySlices', () => {
  it('UTC gün sınırlarında böler; boş aralık boş liste', () => {
    expect(utcDaySlices(at('2026-10-05T11:15:00Z'), at('2026-10-06T11:15:00Z'))).toEqual([
      { from: at('2026-10-05T11:15:00Z'), to: at('2026-10-06T00:00:00Z') },
      { from: at('2026-10-06T00:00:00Z'), to: at('2026-10-06T11:15:00Z') },
    ])
    expect(utcDaySlices(at('2026-10-05T00:00:00Z'), at('2026-10-05T06:00:00Z'))).toHaveLength(1)
    expect(utcDaySlices(at('2026-10-05T00:00:00Z'), at('2026-10-08T00:00:00Z'))).toHaveLength(3)
    expect(utcDaySlices(at('2026-10-05T06:00:00Z'), at('2026-10-05T06:00:00Z'))).toEqual([])
  })
})

describe('latLonBox', () => {
  it('yarıçapın hemen içindeki çemberi her yönde kapsar (Türkiye enlemlerinde ve yüksek enlemde)', () => {
    for (const center of [
      { lat: 41.274874, lon: 28.732136 },
      { lat: 36.898701, lon: 30.800501 },
      { lat: 69.68, lon: 18.92 },
      { lat: -33.9, lon: 151.2 },
    ]) {
      const box = latLonBox(center, 15.5)
      for (let bearing = 0; bearing < 360; bearing += 1) {
        const p = destination(center, bearing, 15.4999)
        expect(greatCircleKm(center, p)).toBeCloseTo(15.4999, 6)
        expect(p.lat).toBeGreaterThanOrEqual(box.minLat)
        expect(p.lat).toBeLessThanOrEqual(box.maxLat)
        expect(p.lon).toBeGreaterThanOrEqual(box.minLon)
        expect(p.lon).toBeLessThanOrEqual(box.maxLon)
      }
    }
  })

  it('kutup yakınında boylam bütün dünyaya açılır', () => {
    const box = latLonBox({ lat: 89.99, lon: 10 }, 15.5)
    expect(box.minLon).toBe(-180)
    expect(box.maxLon).toBe(180)
    expect(box.maxLat).toBe(90)
  })
})

describe('sorgu metinleri', () => {
  it('aday sorgusu: kutu, alan + 3.000 ft (alan yoksa 0), baro sınırı ve geomOnly anahtarı', () => {
    const q = arrivalCandidateQuery(
      [
        { icao: 'LTFM', lat: 41.274874, lon: 28.732136, elevationFt: 325 },
        { icao: 'LTBJ', lat: 38.2924, lon: 27.157, elevationFt: null },
      ],
      { boxKm: 15.5, maxAboveFieldFt: 3000, baroRateBelowFpm: -300, includeGeomOnly: true },
      at('2026-10-05T11:15:00Z'),
      at('2026-10-06T00:00:00Z'),
    )
    expect(q.text).toContain('t.ts >= $2::timestamptz and t.ts < $3::timestamptz')
    expect(q.text).toContain('t.baro_rate_fpm < $4::int')
    expect(q.values.slice(1)).toEqual([
      '2026-10-05T11:15:00.000Z',
      '2026-10-06T00:00:00.000Z',
      -300,
      true,
    ])
    const boxes = JSON.parse(q.values[0] as string) as { max_alt_ft: number; min_lat: number }[]
    expect(boxes.map((b) => b.max_alt_ft)).toEqual([3325, 3000])
    expect(boxes[0]?.min_lat).toBeCloseTo(41.274874 - 15.5 / ((Math.PI * 6371.0088) / 180), 9)
  })

  it('örnek sorgusu: alt sınır max(ilk görülme, geriye bakış) en küçüğü, üst sınır min(iş başı, son görülme + 1 ms)', () => {
    const lookbackStart = at('2026-10-04T11:15:00Z')
    const q = arrivalSampleQuery({
      flights: [
        {
          id: 7,
          firstSeenAt: Date.parse('2026-10-05T08:00:00Z'),
          lastSeenAt: Date.parse('2026-10-05T09:00:00Z'),
        },
        {
          id: 9,
          firstSeenAt: Date.parse('2026-10-03T23:00:00Z'),
          lastSeenAt: Date.parse('2026-10-05T10:00:00Z'),
        },
      ],
      lookbackStart,
      to: at('2026-10-06T12:00:00Z'),
    })
    expect(q.values).toEqual([[7, 9], '2026-10-04T11:15:00.000Z', '2026-10-05T10:00:00.001Z'])
    expect(q.text).toContain('t.flight_id = any($1::bigint[])')
    expect(q.text).toContain('order by t.flight_id, t.ts')
    const capped = arrivalSampleQuery({
      flights: [
        {
          id: 1,
          firstSeenAt: Date.parse('2026-10-06T10:00:00Z'),
          lastSeenAt: Date.parse('2026-10-06T13:00:00Z'),
        },
      ],
      lookbackStart,
      to: at('2026-10-06T12:00:00Z'),
    })
    expect(capped.values.slice(1)).toEqual(['2026-10-06T10:00:00.000Z', '2026-10-06T12:00:00.000Z'])
  })

  it('pencere istatistiği sorgusu bölge yarıçapını taşır', () => {
    const q = arrivalWindowStatsQuery(
      [{ icao: 'LTFM', lat: 41.274874, lon: 28.732136 }],
      30,
      at('2026-10-05T00:00:00Z'),
      at('2026-10-06T00:00:00Z'),
    )
    expect(JSON.parse(q.values[0] as string)).toMatchObject([{ icao: 'LTFM', zone_km: 30 }])
    expect(q.text).toContain('<= b.zone_km')
  })
})

describe('providerStatusSpans', () => {
  it('önceki durum yoksa unknown; geçişler dilimlenir, aynı durum birleşir', () => {
    expect(
      providerStatusSpans(
        null,
        [
          { at: 10, status: 'ok' },
          { at: 20, status: 'ok' },
          { at: 30, status: 'degraded' },
          { at: 45, status: 'down' },
          { at: 120, status: 'ok' },
        ],
        0,
        100,
      ),
    ).toEqual([
      { status: 'unknown', from: 0, to: 10 },
      { status: 'ok', from: 10, to: 30 },
      { status: 'degraded', from: 30, to: 45 },
      { status: 'down', from: 45, to: 100 },
    ])
  })

  it('önceki geçişin durumuyla başlar; bilinmeyen değer unknown; boş aralık boş', () => {
    expect(providerStatusSpans({ status: 'down' }, [{ at: 0, status: 'ok' }], 0, 50)).toEqual([
      { status: 'ok', from: 0, to: 50 },
    ])
    expect(providerStatusSpans({ status: 'weird' }, [], 0, 5)).toEqual([
      { status: 'unknown', from: 0, to: 5 },
    ])
    // Bütçe modu (D-122): seyrek veri, raporda degraded sayılır.
    expect(
      providerStatusSpans({ status: 'limited' }, [{ at: 3, status: 'degraded' }], 0, 5),
    ).toEqual([{ status: 'degraded', from: 0, to: 5 }])
    expect(providerStatusSpans(null, [], 5, 5)).toEqual([])
  })
})

describe('salt okunur işlem yardımcıları', () => {
  it('yeniden deneme gecikmesi artar ve rastgelelik 250 ms ile sınırlıdır', () => {
    expect(arrivalCoverageRetryDelayMs(1, 0)).toBe(250)
    expect(arrivalCoverageRetryDelayMs(2, 0)).toBe(500)
    expect(arrivalCoverageRetryDelayMs(2, 1)).toBe(750)
    expect(arrivalCoverageRetryDelayMs(1, 7)).toBe(500)
  })

  /** `begin` her çağrıda işlemi açar; `set_config` boş döner, okuma `run`'a gider. */
  function fakeSql(events: string[]) {
    const tx = () => Promise.resolve([])
    return {
      begin: async (_mode: string, fn: (t: unknown) => Promise<unknown>) => {
        events.push('begin')
        return fn(tx)
      },
    } as unknown as Parameters<typeof readOnlyTransaction>[0]
  }
  const timeout = () => Object.assign(new Error('canceling statement'), { code: '57014' })

  it('checkpoint her denemeden ve her yeniden deneme beklemesinden önce çağrılır', async () => {
    const events: string[] = []
    let attempt = 0
    const value = await readOnlyTransaction(
      fakeSql(events),
      async () => {
        attempt += 1
        events.push(`read ${attempt}`)
        if (attempt < 3) throw timeout()
        return 'ok'
      },
      {
        checkpoint: () => events.push('checkpoint'),
        sleep: async (ms) => {
          events.push(`sleep ${ms}`)
        },
        jitter: () => 0,
      },
    )
    expect(value).toBe('ok')
    expect(events).toEqual([
      'checkpoint',
      'begin',
      'read 1',
      'checkpoint',
      'sleep 250',
      'checkpoint',
      'begin',
      'read 2',
      'checkpoint',
      'sleep 500',
      'checkpoint',
      'begin',
      'read 3',
    ])
  })

  it('checkpoint fırlatırsa yeniden denenmez ve okuma başlamaz; hata olduğu gibi döner', async () => {
    const events: string[] = []
    const budget = new Error('budget exceeded')
    let calls = 0
    const error = await readOnlyTransaction(
      fakeSql(events),
      async () => {
        events.push('read')
        throw timeout()
      },
      {
        // İlk deneme geçer, yeniden denemeden önceki denetim bütçeyi aşmış bulur.
        checkpoint: () => {
          calls += 1
          if (calls > 1) throw budget
        },
        sleep: async () => {
          events.push('sleep')
        },
        jitter: () => 0,
      },
    ).catch((e: unknown) => e)
    expect(error).toBe(budget)
    expect(events).toEqual(['begin', 'read'])

    const aborted = new Error('aborted')
    const before: string[] = []
    await expect(
      readOnlyTransaction(fakeSql(before), async () => 'never', {
        checkpoint: () => {
          throw aborted
        },
      }),
    ).rejects.toBe(aborted)
    expect(before).toEqual([])
  })
})

describe('rapor satırı', () => {
  const requestedAt = at('2026-10-05T10:00:00Z')

  it('eskime: kuyrukta 15 dk, çalışırken 20 dk (sınır dahil değil)', () => {
    const queued = { storedStatus: 'queued' as const, requestedAt, startedAt: null, error: null }
    expect(effectiveArrivalCoverageReport(queued, at('2026-10-05T10:15:00Z'))).toEqual({
      status: 'queued',
      error: null,
    })
    expect(effectiveArrivalCoverageReport(queued, at('2026-10-05T10:15:00.001Z'))).toEqual({
      status: 'failed',
      error: 'timeout_queued',
    })
    const running = {
      storedStatus: 'running' as const,
      requestedAt,
      startedAt: at('2026-10-05T10:05:00Z'),
      error: null,
    }
    expect(effectiveArrivalCoverageReport(running, at('2026-10-05T10:25:00Z')).status).toBe(
      'running',
    )
    expect(effectiveArrivalCoverageReport(running, at('2026-10-05T10:25:00.001Z'))).toEqual({
      status: 'failed',
      error: 'timeout_running',
    })
    const done = { storedStatus: 'done' as const, requestedAt, startedAt: null, error: null }
    expect(effectiveArrivalCoverageReport(done, at('2026-10-06T00:00:00Z')).status).toBe('done')
  })

  it('zaman aşımı anı: kuyrukta istenme + 15 dk, çalışırken başlangıç + 20 dk; bitmişte yok', () => {
    expect(
      arrivalCoverageTimeoutAt({ storedStatus: 'queued', requestedAt, startedAt: null }),
    ).toEqual(at('2026-10-05T10:15:00Z'))
    expect(
      arrivalCoverageTimeoutAt({
        storedStatus: 'running',
        requestedAt,
        startedAt: at('2026-10-05T10:05:00Z'),
      }),
    ).toEqual(at('2026-10-05T10:25:00Z'))
    expect(
      arrivalCoverageTimeoutAt({ storedStatus: 'running', requestedAt, startedAt: null }),
    ).toEqual(at('2026-10-05T10:20:00Z'))
    expect(
      arrivalCoverageTimeoutAt({ storedStatus: 'failed', requestedAt, startedAt: null }),
    ).toBeNull()
  })

  it('hata metni kırpılır, en çok 500 karakter, vekil çifti bölünmez', () => {
    expect(arrivalCoverageErrorText('  boom  ')).toBe('boom')
    expect(arrivalCoverageErrorText('')).toBe('error')
    expect(arrivalCoverageErrorText('a\u0000b')).toBe('ab')
    const long = arrivalCoverageErrorText('x'.repeat(499) + '\u{1F600}' + 'y'.repeat(10))
    expect([...long]).toHaveLength(ARRIVAL_COVERAGE_REPORT_ERROR_MAX)
    expect(long.endsWith('\u{1F600}')).toBe(true)
  })
})
