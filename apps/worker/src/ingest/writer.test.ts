import type { Database, FlightTouch, TrackPointRow } from '@havayolu/db'
import { pino } from 'pino'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isDataError, TrackWriter, WRITER_WARN_INTERVAL_MS } from './writer'

const db = vi.hoisted(() => ({
  endFlights: vi.fn(),
  touchFlights: vi.fn(),
  insertTrackPoints: vi.fn(),
  // Gerçeği 1000; küçük parti bölme ve daraltmayı birkaç satırla sınamaya yeter.
  TRACK_INSERT_CHUNK: 4,
}))

vi.mock('@havayolu/db', () => db)

const sql = {} as Database['sql']
const log = pino({ level: 'silent' })
const T0 = Date.UTC(2026, 8, 28, 12)

const row = (flightId: number, offsetSec: number): TrackPointRow => ({
  flightId,
  ts: new Date(T0 + offsetSec * 1000),
  lat: 41.2,
  lon: 28.7,
  altBaroFt: 2000,
  altGeomFt: null,
  gsKt: 160,
  trackDeg: 355,
  verticalRateFpm: -700,
  onGround: false,
  source: 16,
})

const touch = (id: number, offsetSec: number, over: Partial<FlightTouch> = {}): FlightTouch => ({
  id,
  lastSeenAt: new Date(T0 + offsetSec * 1000),
  callsign: null,
  registration: null,
  typeCode: null,
  ...over,
})

/** Sahte çağrıların sırası (tablo adıyla). */
let calls: string[] = []

beforeEach(() => {
  calls = []
  db.endFlights.mockReset().mockImplementation(async () => {
    calls.push('end')
  })
  db.touchFlights.mockReset().mockImplementation(async () => {
    calls.push('touch')
  })
  db.insertTrackPoints
    .mockReset()
    .mockImplementation(async (_sql: unknown, table: string, rows: TrackPointRow[]) => {
      calls.push(table)
      return rows.length
    })
})

describe('TrackWriter', () => {
  it('sırayla yazar: kapanış, son görülme (kimlik başına en yenisi), 30 sn iz, ince iz', async () => {
    const writer = new TrackWriter(sql, log)
    writer.addFine(row(1, 1))
    writer.addSampled(row(1, 0))
    writer.touch(touch(1, 0, { callsign: 'THY4' }))
    writer.touch(touch(1, 5, { registration: 'TC-JJA' }))
    writer.touch(touch(2, 3))
    writer.end(7)
    writer.end(7)
    expect(writer.buffered()).toBe(2)

    const result = await writer.flush()
    expect(calls).toEqual(['end', 'touch', 'track_points_sampled', 'track_points_fine'])
    expect(result).toEqual({ sampled: 1, fine: 1, touched: 2, ended: 1 })
    expect(db.endFlights).toHaveBeenCalledWith(sql, [7])
    const touched = db.touchFlights.mock.calls[0]?.[1] as FlightTouch[]
    expect(touched.find((t) => t.id === 1)).toEqual(
      touch(1, 5, { callsign: 'THY4', registration: 'TC-JJA' }),
    )
    expect(writer.buffered()).toBe(0)

    // Boş tamponda veritabanına gidilmez.
    calls = []
    expect(await writer.flush()).toEqual({ sampled: 0, fine: 0, touched: 0, ended: 0 })
    expect(calls).toEqual([])
  })

  it('veritabanı hatasında yazılamayan kısım korunur ve sonraki turda yeniden denenir', async () => {
    const writer = new TrackWriter(sql, log)
    writer.end(3)
    writer.touch(touch(3, 1))
    writer.addSampled(row(3, 0))
    writer.addFine(row(3, 1))
    db.insertTrackPoints.mockImplementationOnce(async () => {
      throw new Error('connection refused')
    })

    const failed = await writer.flush()
    expect(failed).toEqual({ sampled: 0, fine: 0, touched: 1, ended: 1 })
    expect(writer.consecutiveFailures()).toBe(1)
    expect(writer.buffered()).toBe(2)

    // Arada gelen satırlar eskilerin arkasına eklenir.
    writer.addSampled(row(3, 30))
    calls = []
    const retried = await writer.flush()
    expect(calls).toEqual(['track_points_sampled', 'track_points_fine'])
    expect(retried).toEqual({ sampled: 2, fine: 1, touched: 0, ended: 0 })
    const sampled = db.insertTrackPoints.mock.calls.at(-2)?.[2] as TrackPointRow[]
    expect(sampled.map((r) => r.ts.getTime())).toEqual([T0, T0 + 30_000])
    expect(writer.consecutiveFailures()).toBe(0)
  })

  it('son görülme yazılamazsa yeni gelenle birleşir (en yeni zaman, dolu alanlar korunur)', async () => {
    const writer = new TrackWriter(sql, log)
    writer.touch(touch(5, 10, { callsign: 'PGT1' }))
    db.touchFlights.mockImplementationOnce(async () => {
      throw new Error('timeout')
    })
    await writer.flush()
    writer.touch(touch(5, 20, { typeCode: 'A20N' }))
    await writer.flush()
    const touched = db.touchFlights.mock.calls.at(-1)?.[1] as FlightTouch[]
    expect(touched).toEqual([touch(5, 20, { callsign: 'PGT1', typeCode: 'A20N' })])
  })

  it('tampon sınırında zamanca en eski satırlar atılır ve sayılır', async () => {
    const writer = new TrackWriter(sql, log, { maxBuffered: 3 })
    writer.addSampled(row(1, 0))
    writer.addFine(row(1, 1))
    writer.addSampled(row(1, 30))
    writer.addFine(row(1, 2))
    writer.addFine(row(1, 31))
    expect(writer.buffered()).toBe(3)
    expect(writer.dropped()).toBe(2)
    await writer.flush()
    const [sampled, fine] = db.insertTrackPoints.mock.calls.map((c) => c[2] as TrackPointRow[])
    expect(sampled?.map((r) => r.ts.getTime())).toEqual([T0 + 30_000])
    expect(fine?.map((r) => r.ts.getTime())).toEqual([T0 + 2_000, T0 + 31_000])
  })

  it('iki flush aynı anda çalışmaz; çalışırken gelen çağrılar tek ek turda birleşir', async () => {
    const writer = new TrackWriter(sql, log)
    let release: () => void = () => undefined
    let active = 0
    let maxActive = 0
    db.insertTrackPoints.mockImplementation(
      async (_s: unknown, _t: string, rows: TrackPointRow[]) => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await new Promise<void>((resolve) => {
          release = resolve
        })
        active -= 1
        return rows.length
      },
    )
    writer.addSampled(row(1, 0))
    const first = writer.flush()
    await vi.waitFor(() => expect(active).toBe(1))
    writer.addSampled(row(1, 30))
    const second = writer.flush()
    const third = writer.flush()
    expect(third).toBe(second)
    release()
    expect(await first).toMatchObject({ sampled: 1 })
    await vi.waitFor(() => expect(active).toBe(1))
    release()
    expect(await second).toMatchObject({ sampled: 1 })
    expect(maxActive).toBe(1)
    expect(db.insertTrackPoints).toHaveBeenCalledTimes(2)
  })

  it('geçersiz tampon sınırı reddedilir', () => {
    expect(() => new TrackWriter(sql, log, { maxBuffered: 0 })).toThrow(RangeError)
  })
})

interface LogLine {
  level: number
  msg: string
  [key: string]: unknown
}

/** Log satırlarını toplayan gerçek pino kaydedicisi. */
function captureLog() {
  const lines: LogLine[] = []
  const logger = pino(
    { level: 'debug' },
    {
      write: (line: string) => {
        lines.push(JSON.parse(line) as LogLine)
      },
    },
  )
  return {
    logger,
    warns: () => lines.filter((l) => l.level === 40),
    infos: () => lines.filter((l) => l.level === 30),
  }
}

/** postgres-js hatası gibi SQLSTATE kodlu hata. */
const pgError = (code: string, message = 'db error') => Object.assign(new Error(message), { code })

describe('TrackWriter kesinti uyarıları', () => {
  it('hata uyarısı dakikada en fazla bir kez; arada kaç hata olduğu sayılır', async () => {
    let t = T0
    const { logger, warns, infos } = captureLog()
    const writer = new TrackWriter(sql, logger, { now: () => t })
    db.insertTrackPoints.mockImplementation(async () => {
      throw pgError('ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:45432')
    })
    writer.addSampled(row(1, 0))
    // 1,5 sn'de bir, 75 sn boyunca: t = 0, 1,5 … 75 → 51 başarısız flush.
    for (let i = 0; i <= 50; i += 1) {
      t = T0 + i * 1500
      await writer.flush()
    }
    expect(writer.consecutiveFailures()).toBe(51)
    expect(warns()).toHaveLength(2)
    expect(warns()[0]).toMatchObject({ step: 'sampled', failures: 1, failuresSinceLastWarning: 1 })
    // İkinci uyarı t = 60 sn'de: 1,5 … 60 sn arasındaki 40 hata.
    expect(warns()[1]).toMatchObject({ failures: 41, failuresSinceLastWarning: 40, buffered: 1 })
    expect(infos()).toHaveLength(0)

    // Düzelince tek info satırı; sonraki başarılı turlar yazmaz.
    db.insertTrackPoints.mockImplementation(async (_s: unknown, _t: string, rows: unknown[]) => {
      return rows.length
    })
    t += 1500
    expect(await writer.flush()).toMatchObject({ sampled: 1 })
    writer.addSampled(row(1, 30))
    t += 1500
    await writer.flush()
    expect(infos()).toHaveLength(1)
    expect(infos()[0]).toMatchObject({ failures: 51, buffered: 0 })
    expect(infos()[0]?.msg).toMatch(/recovered/)
    expect(writer.consecutiveFailures()).toBe(0)
  })

  it('dakika içinde gidip gelen kesinti tek uyarı ve tek info yazar', async () => {
    let t = T0
    const { logger, warns, infos } = captureLog()
    const writer = new TrackWriter(sql, logger, { now: () => t })
    for (let i = 0; i < 10; i += 1) {
      t = T0 + i * 3000
      db.touchFlights.mockImplementationOnce(async () => {
        throw pgError('57P01', 'terminating connection due to administrator command')
      })
      writer.touch(touch(1, i))
      await writer.flush()
      t += 1500
      await writer.flush()
    }
    expect(warns()).toHaveLength(1)
    expect(infos()).toHaveLength(1)
    // Aralık dolunca yeni hata yeniden uyarır ve bastırılanları sayar.
    t = T0 + WRITER_WARN_INTERVAL_MS + 1
    db.touchFlights.mockImplementationOnce(async () => {
      throw pgError('08006')
    })
    writer.touch(touch(1, 100))
    await writer.flush()
    expect(warns()).toHaveLength(2)
    expect(warns()[1]).toMatchObject({ step: 'touched', failuresSinceLastWarning: 10 })
  })
})

describe('TrackWriter veri hataları', () => {
  it('isDataError: SQLSTATE 22/23 ve RangeError veri hatasıdır; bağlantı ve kilit hataları değil', () => {
    for (const code of ['22003', '22P05', '22021', '22P02', '23505', '23502']) {
      expect(isDataError(pgError(code))).toBe(true)
    }
    for (const code of ['40001', '40P01', '55P03', '57P01', '08006', '53300', 'ECONNREFUSED']) {
      expect(isDataError(pgError(code))).toBe(false)
    }
    expect(isDataError(pgError('CONNECTION_CLOSED'))).toBe(false)
    expect(isDataError(new RangeError('Invalid time value'))).toBe(true)
    expect(isDataError(new Error('timeout'))).toBe(false)
    expect(isDataError(null)).toBe(false)
    expect(isDataError('22003')).toBe(false)
  })

  it('bozuk iz satırı daraltılıp atılır; kalanı ve sonraki adımlar yazılır, yeniden denenmez', async () => {
    const { logger, warns } = captureLog()
    const writer = new TrackWriter(sql, logger, { now: () => T0 })
    const bad = { ...row(1, 6), altGeomFt: 3e9 }
    const before = [0, 1, 2, 3, 4, 5].map((s) => row(1, s))
    for (const r of [...before, bad, row(1, 7), row(1, 8), row(1, 9)]) writer.addSampled(r)
    writer.addFine(row(1, 10))
    writer.touch(touch(1, 10))
    const sent: TrackPointRow[][] = []
    db.insertTrackPoints.mockImplementation(
      async (_s: unknown, table: string, part: TrackPointRow[]) => {
        calls.push(table)
        sent.push(part)
        if (part.includes(bad)) throw pgError('22003', 'value "3000000000" is out of range')
        return part.length
      },
    )

    const result = await writer.flush()
    expect(result).toEqual({ sampled: 9, fine: 1, touched: 1, ended: 0 })
    expect(writer.rejected()).toBe(1)
    expect(writer.consecutiveFailures()).toBe(0)
    expect(writer.buffered()).toBe(0)
    // Parti büyüklüğü 4: [0-3] tek seferde; [4,5,bad,7] → [4,5] + [bad,7] → [bad] + [7]; [8,9].
    expect(sent.map((p) => p.length)).toEqual([4, 4, 2, 2, 1, 1, 2, 1])
    expect(calls.at(-1)).toBe('track_points_fine')
    expect(warns()).toHaveLength(1)
    expect(warns()[0]).toMatchObject({ step: 'sampled', rejected: 1, rejectedTotal: 1 })

    // Atılan satır bir daha gönderilmez.
    sent.length = 0
    expect(await writer.flush()).toEqual({ sampled: 0, fine: 0, touched: 0, ended: 0 })
    expect(sent).toEqual([])
  })

  it('bozuk son görülme güncellemesi atılır; diğer güncellemeler ve iz yazılır', async () => {
    const writer = new TrackWriter(sql, log)
    for (const id of [1, 2, 9, 4]) writer.touch(touch(id, 1))
    writer.addSampled(row(1, 0))
    db.touchFlights.mockImplementation(async (_s: unknown, list: FlightTouch[]) => {
      calls.push('touch')
      if (list.some((t) => t.id === 9)) throw pgError('22P05', 'unsupported Unicode escape')
    })
    const result = await writer.flush()
    expect(result).toEqual({ sampled: 1, fine: 0, touched: 3, ended: 0 })
    expect(writer.rejected()).toBe(1)
    const written = db.touchFlights.mock.calls
      .map((c) => c[1] as FlightTouch[])
      .filter((list) => !list.some((t) => t.id === 9))
      .flatMap((list) => list.map((t) => t.id))
    expect(written.sort()).toEqual([1, 2, 4])
    // Sonraki turda bozuk güncelleme yeniden gönderilmez.
    db.touchFlights.mockClear()
    await writer.flush()
    expect(db.touchFlights).not.toHaveBeenCalled()
  })

  it('daraltma sırasında geçici hata: yalnızca yazılmamış satırlar tampona döner', async () => {
    const writer = new TrackWriter(sql, log)
    const bad = row(2, 3)
    const good = [row(2, 0), row(2, 1), row(2, 2)]
    for (const r of [...good, bad]) writer.addSampled(r)
    let transientOnce = true
    const sent: TrackPointRow[][] = []
    db.insertTrackPoints.mockImplementation(
      async (_s: unknown, _t: string, part: TrackPointRow[]) => {
        sent.push(part)
        if (part.length === 2 && part.includes(bad) && transientOnce) {
          transientOnce = false
          throw pgError('40P01', 'deadlock detected')
        }
        if (part.includes(bad)) throw pgError('22003')
        return part.length
      },
    )

    const failed = await writer.flush()
    // [0,1,2,bad] veri hatası → [0,1] yazılır → [2,bad] geçici hata.
    expect(failed.sampled).toBe(2)
    expect(writer.consecutiveFailures()).toBe(1)
    expect(writer.buffered()).toBe(2)
    expect(writer.rejected()).toBe(0)

    sent.length = 0
    const retried = await writer.flush()
    expect(sent[0]).toEqual([good[2], bad])
    expect(retried.sampled).toBe(1)
    expect(writer.rejected()).toBe(1)
    expect(writer.buffered()).toBe(0)
    expect(writer.consecutiveFailures()).toBe(0)
  })

  it('reddedilen satır uyarısı dakikada en fazla bir kez, arada atılanları sayar', async () => {
    let t = T0
    const { logger, warns } = captureLog()
    const writer = new TrackWriter(sql, logger, { now: () => t })
    db.insertTrackPoints.mockImplementation(async () => {
      throw new RangeError('Invalid time value')
    })
    for (let i = 0; i < 5; i += 1) {
      t = T0 + i * 10_000
      writer.addFine(row(3, i))
      await writer.flush()
    }
    expect(writer.rejected()).toBe(5)
    expect(warns()).toHaveLength(1)
    t = T0 + WRITER_WARN_INTERVAL_MS
    writer.addFine(row(3, 99))
    await writer.flush()
    expect(warns()).toHaveLength(2)
    expect(warns()[1]).toMatchObject({ step: 'fine', rejected: 5, rejectedTotal: 6 })
  })
})
