import { describe, expect, it } from 'vitest'
import { metarAgeClass, metarAgeMinutes } from './age'
import { compassKey, compassKey8 } from './compass'
import {
  hasUtcOffsetTable,
  isSupportedTimeZone,
  localDayDifference,
  localTime,
  registerUtcOffsetTable,
  resolveDayTime,
  resolveHourMinuteAfter,
  UTC_OFFSET_TABLE_HOURS,
  utcOffsetFromTable,
  utcOffsetLabel,
  utcOffsetTable,
} from './time'

describe('resolveDayTime', () => {
  const ref = new Date('2026-01-15T13:00:00Z')
  it('aynı ay', () => {
    expect(resolveDayTime(15, 12, 50, ref)?.toISOString()).toBe('2026-01-15T12:50:00.000Z')
  })
  it('ay ve yıl geçişleri', () => {
    expect(resolveDayTime(31, 23, 50, new Date('2026-02-01T00:10:00Z'))?.toISOString()).toBe(
      '2026-01-31T23:50:00.000Z',
    )
    expect(resolveDayTime(1, 0, 20, new Date('2025-12-31T23:58:00Z'))?.toISOString()).toBe(
      '2026-01-01T00:20:00.000Z',
    )
  })
  it('HH=24 ertesi gün 00:00', () => {
    expect(resolveDayTime(15, 24, 0, ref)?.toISOString()).toBe('2026-01-16T00:00:00.000Z')
  })
  it('ayda olmayan gün aday değildir (31 Eylül yok → 31 Ağustos)', () => {
    expect(resolveDayTime(31, 6, 0, new Date('2026-09-20T00:00:00Z'))?.toISOString()).toBe(
      '2026-08-31T06:00:00.000Z',
    )
  })
  it('geçersiz değerler null', () => {
    expect(resolveDayTime(32, 0, 0, ref)).toBeNull()
    expect(resolveDayTime(15, 25, 0, ref)).toBeNull()
    expect(resolveDayTime(15, 24, 30, ref)).toBeNull()
    expect(resolveDayTime(15, 12, 0, new Date(Number.NaN))).toBeNull()
  })
})

describe('resolveHourMinuteAfter', () => {
  const obs = new Date('2026-01-15T12:50:00Z')
  it('gözlemden sonraki saat', () => {
    expect(resolveHourMinuteAfter('1310', obs)?.toISOString()).toBe('2026-01-15T13:10:00.000Z')
    expect(resolveHourMinuteAfter('1245', obs)?.toISOString()).toBe('2026-01-15T12:45:00.000Z')
    expect(resolveHourMinuteAfter('0030', new Date('2026-01-15T23:50:00Z'))?.toISOString()).toBe(
      '2026-01-16T00:30:00.000Z',
    )
    expect(resolveHourMinuteAfter('2400', obs)?.toISOString()).toBe('2026-01-16T00:00:00.000Z')
    expect(resolveHourMinuteAfter('1x00', obs)).toBeNull()
  })
})

describe('localTime (Europe/Istanbul, Intl)', () => {
  it('UTC+3, gün sınırı', () => {
    expect(localTime('2026-10-01T12:32:10Z')).toMatchObject({
      hhmm: '15:32',
      dateKey: '2026-10-01',
      utcOffsetMinutes: 180,
      second: 10,
    })
    expect(localTime(new Date('2026-10-01T21:30:00Z')).dateKey).toBe('2026-10-02')
    expect(localTime(Date.UTC(2026, 0, 1, 0, 0), 'UTC')).toMatchObject({
      hhmm: '00:00',
      utcOffsetMinutes: 0,
    })
  })
  it('geçersiz tarih hata fırlatır', () => {
    expect(() => localTime('not a date')).toThrow()
  })
  it('yerel gün farkı', () => {
    expect(localDayDifference('2026-10-01T12:00:00Z', '2026-10-01T20:59:00Z')).toBe(0)
    expect(localDayDifference('2026-10-01T12:00:00Z', '2026-10-01T21:00:00Z')).toBe(1)
    expect(localDayDifference('2026-10-01T12:00:00Z', '2026-10-03T12:00:00Z')).toBe(2)
  })
  it('UTC farkı etiketi: tam saat, yarım saat, eksi U+2212, sıfır', () => {
    expect(utcOffsetLabel(180)).toBe('UTC+3')
    expect(utcOffsetLabel(210)).toBe('UTC+3:30')
    expect(utcOffsetLabel(345)).toBe('UTC+5:45')
    expect(utcOffsetLabel(-300)).toBe('UTC−5')
    expect(utcOffsetLabel(-570)).toBe('UTC−9:30')
    expect(utcOffsetLabel(0)).toBe('UTC')
    expect(utcOffsetLabel(localTime('2026-10-04T17:27:12Z').utcOffsetMinutes)).toBe('UTC+3')
  })
})

describe('compassKey', () => {
  it.each([
    [0, 'N', 'N'],
    [11, 'N', 'N'],
    [11.25, 'NNE', 'N'],
    [22.5, 'NNE', 'NE'],
    [30, 'NNE', 'NE'],
    [45, 'NE', 'NE'],
    [67.5, 'ENE', 'E'],
    [90, 'E', 'E'],
    [135, 'SE', 'SE'],
    [180, 'S', 'S'],
    [200, 'SSW', 'S'],
    [225, 'SW', 'SW'],
    [250, 'WSW', 'W'],
    [270, 'W', 'W'],
    [290, 'WNW', 'W'],
    [315, 'NW', 'NW'],
    [337.5, 'NNW', 'N'],
    [348.75, 'N', 'N'],
    [360, 'N', 'N'],
    [-90, 'W', 'W'],
    [720 + 45, 'NE', 'NE'],
  ] as const)('%f° → %s / %s', (deg, key16, key8) => {
    expect(compassKey(deg)).toBe(key16)
    expect(compassKey8(deg)).toBe(key8)
  })
  it('sonlu olmayan değer null', () => {
    expect(compassKey(Number.NaN)).toBeNull()
    expect(compassKey8(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('gözlem yaşı', () => {
  const now = '2026-01-15T13:00:00Z'
  it.each([
    ['2026-01-15T12:50:00Z', 10, 'fresh'],
    ['2026-01-15T11:30:00Z', 90, 'fresh'],
    ['2026-01-15T11:29:00Z', 91, 'delayed'],
    ['2026-01-15T10:00:00Z', 180, 'delayed'],
    ['2026-01-15T09:59:00Z', 181, 'stale'],
    ['2026-01-15T01:00:00Z', 720, 'stale'],
    ['2026-01-15T00:59:00Z', 721, 'none'],
    ['2026-01-15T13:05:00Z', 0, 'fresh'],
  ] as const)('%s → %i dk, %s', (observedAt, minutes, cls) => {
    expect(metarAgeMinutes(observedAt, now)).toBe(minutes)
    expect(metarAgeClass(observedAt, now)).toBe(cls)
  })
  it('gözlem yoksa none', () => {
    expect(metarAgeMinutes(null, now)).toBeNull()
    expect(metarAgeClass(null, now)).toBe('none')
    expect(metarAgeClass(undefined, now)).toBe('none')
    expect(metarAgeClass('bad', now)).toBe('none')
  })
})

describe('sunucunun fark tablosu (D-109)', () => {
  const HOUR = 3_600_000

  it('çizim anının saat başından ±48 saat; saat başı taranır, geçiş dakikasıyla', () => {
    expect(UTC_OFFSET_TABLE_HOURS).toBe(48)
    const at = Date.parse('2026-03-29T00:30:00Z')
    const table = utcOffsetTable('Europe/Berlin', at)
    expect(table.timeZone).toBe('Europe/Berlin')
    expect(table.fromMs).toBe(Date.parse('2026-03-27T00:00:00Z'))
    expect(table.toMs).toBe(Date.parse('2026-03-31T00:00:00Z'))
    // Berlin 29 Mart 2026 01:00 UTC'de yaz saatine geçer.
    expect(table.segments).toEqual([
      { fromMs: table.fromMs, offsetMinutes: 60 },
      { fromMs: Date.parse('2026-03-29T01:00:00Z'), offsetMinutes: 120 },
    ])
    // Yarım saatlik geçiş (Lord Howe, 30 dakikalık yaz saati) dakikasıyla bulunur.
    const lordHowe = utcOffsetTable('Australia/Lord_Howe', Date.parse('2026-04-04T12:00:00Z'))
    expect(lordHowe.segments.map((s) => s.offsetMinutes)).toEqual([660, 630])
    expect(lordHowe.segments[1]?.fromMs).toBe(Date.parse('2026-04-04T15:00:00Z'))
    expect(() => utcOffsetTable('Europe/Berlin', Number.NaN)).toThrow(RangeError)
  })

  it('kayıtlı tablo aralıkta Intl yerine kullanılır; aralık dışında Intl; dilim tanınmıyorsa kenar', () => {
    const at = Date.parse('2026-07-01T12:00:00Z')
    // Taklit tablo: gerçek farktan (UTC+3) ayrı, sabit UTC+5 (yalnız test için).
    const zone = 'Europe/Kiev'
    expect(hasUtcOffsetTable(zone)).toBe(false)
    registerUtcOffsetTable({
      timeZone: zone,
      fromMs: at - 48 * HOUR,
      toMs: at + 48 * HOUR,
      segments: [{ fromMs: at - 48 * HOUR, offsetMinutes: 300 }],
    })
    expect(hasUtcOffsetTable(zone)).toBe(true)
    expect(localTime(at, zone)).toMatchObject({ hhmm: '17:00', utcOffsetMinutes: 300 })
    expect(utcOffsetFromTable(zone, at)).toBe(300)
    // Aralığın dışında çalışma zamanı dilimi tanır: Intl (UTC+3).
    expect(localTime(at + 72 * HOUR, zone).utcOffsetMinutes).toBe(180)
    expect(utcOffsetFromTable(zone, at + 72 * HOUR)).toBeUndefined()
    // Tanınmayan dilim: aralıkta tablo, dışında en yakın kenar.
    const unknown = 'Mars/Olympus_Mons'
    expect(isSupportedTimeZone(unknown)).toBe(false)
    expect(() => localTime(at, unknown)).toThrow(RangeError)
    registerUtcOffsetTable({
      timeZone: unknown,
      fromMs: at,
      toMs: at + HOUR,
      segments: [
        { fromMs: at, offsetMinutes: -60 },
        { fromMs: at + 30 * 60_000, offsetMinutes: -120 },
      ],
    })
    expect(localTime(at, unknown).hhmm).toBe('11:00')
    expect(localTime(at + 45 * 60_000, unknown).hhmm).toBe('10:45')
    expect(localTime(at - 10 * HOUR, unknown).utcOffsetMinutes).toBe(-60)
    expect(localTime(at + 10 * HOUR, unknown).utcOffsetMinutes).toBe(-120)
    expect(utcOffsetFromTable(unknown, at + 10 * HOUR)).toBe(-120)
  })

  it('tablodan gelen bileşenler Intl ile aynı (gün, ay, yıl ve gün değişimi dahil)', () => {
    const at = Date.parse('2026-12-31T23:30:00Z')
    const table = utcOffsetTable('Asia/Tokyo', at)
    const intl = localTime(at, 'Asia/Tokyo')
    registerUtcOffsetTable(table)
    expect(localTime(at, 'Asia/Tokyo')).toEqual(intl)
    expect(localTime(at, 'Asia/Tokyo').dateKey).toBe('2027-01-01')
    expect(localDayDifference(at - 10 * HOUR, at, 'Asia/Tokyo')).toBe(1)
  })
})
