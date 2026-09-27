import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hasDbFlag, isHiddenByDefault, isLowWeightSource, withPrivacy } from '../aircraft'
import { CLEANING, epochMs, parseLiveResponse, ResponseFormatError } from './response'

// Gerçek adsb.lol yanıtları (2026-09-27, kullanıcı onayıyla 4 istek; tools/fixtures/adsblol).
const fixture = (name: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../tools/fixtures/adsblol/${name}.json`, import.meta.url),
      'utf8',
    ),
  ) as { now: number; ac: Record<string, unknown>[] }

const point = fixture('point-ltfm-40nm')
/** Gerçek bir kaydı temel alıp alanları değiştirir (sentetik durumlar gerçek biçimden türetilir). */
const base = point.ac[0] as Record<string, unknown>
const envelope = (ac: Record<string, unknown>[], now = point.now) => ({
  ac,
  msg: 'No error',
  now,
  total: ac.length,
  ctime: now,
  ptime: 5,
})
const one = (patch: Record<string, unknown>, omit: string[] = [], now?: number) => {
  const record: Record<string, unknown> = { ...base, ...patch }
  for (const key of omit) delete record[key]
  return parseLiveResponse(envelope([record], now), 'adsbLol')
}

describe('adsb.lol fixture', () => {
  it('bütün kayıtlar ayrışır; zaman ms, alanlar modele eşlenir', () => {
    const parsed = parseLiveResponse(point, 'adsbLol')
    expect(parsed.aircraft).toHaveLength(point.ac.length)
    expect(parsed.rejected).toEqual([])
    expect(parsed.now).toBe(point.now)
    const pgt = parsed.aircraft.find((a) => a.callsign === 'PGT4XF')
    expect(pgt).toMatchObject({
      hex: '4b8750',
      nonIcao: false,
      registration: 'TC-AZP',
      typeCode: 'B738',
      category: 'A3',
      positionSource: 'adsb_icao',
      onGround: false,
      altBaroFt: 32025,
      squawk: '5365',
      emergency: null,
      source: 'adsbLol',
    })
    expect(pgt?.sampleTime).toBe(point.now - Math.round((base.seen_pos as number) * 1000))
  })

  it('hex, çağrı kodu ve tescil yanıtları da ayrışır', () => {
    for (const name of ['hex-mixed', 'callsign', 'reg']) {
      const parsed = parseLiveResponse(fixture(name), 'adsbLol')
      expect(parsed.rejected, name).toEqual([])
      expect(parsed.aircraft.length, name).toBeGreaterThan(0)
    }
  })

  it('LADD bayraklı iş jeti (TC-OIL, çağrı kodu TCOIL): tescil de çağrı kodu da gizlenir', () => {
    const ladd = parseLiveResponse(point, 'adsbLol').aircraft.find((a) =>
      hasDbFlag(a.dbFlags, 'ladd'),
    )
    expect(ladd).toMatchObject({ hex: '4bbd2c', registration: 'TC-OIL', callsign: 'TCOIL' })
    expect(ladd && withPrivacy(ladd)).toMatchObject({ registration: null, callsign: null })
  })
})

describe('yanıt biçimi kuralları (data-sources.md §1)', () => {
  it('yerdeki uçak: alt_baro "ground" → onGround, altBaroFt null; gs ve true_heading olmayabilir', () => {
    const [a] = one({ alt_baro: 'ground' }, ['gs', 'true_heading']).aircraft
    expect(a).toMatchObject({ onGround: true, altBaroFt: null, gsKt: null, trueHeadingDeg: null })
  })

  it('eksik alanlar null olur, tip uyuşmayan alan yok sayılır', () => {
    const { aircraft, rejected } = parseLiveResponse(
      envelope([{ hex: 'ABC123', lat: 41, lon: 29, seen_pos: 1, gs: 'hızlı', nav_modes: 'x' }]),
      'adsbLol',
    )
    expect(rejected).toEqual([])
    expect(aircraft[0]).toMatchObject({
      hex: 'abc123',
      callsign: null,
      registration: null,
      typeCode: null,
      dbFlags: 0,
      positionSource: 'unknown',
      altBaroFt: null,
      onGround: false,
      gsKt: null,
      navModes: [],
      squawk: null,
    })
  })

  it('lastPosition ve rr_lat/rr_lon konum sayılmaz: konumsuz kayıt atılır', () => {
    const lastPosition = { lat: 41.1, lon: 28.9, nic: 7, rc: 186, seen_pos: 75 }
    const stale = one({ lastPosition, rr_lat: 41.2, rr_lon: 29 }, ['lat', 'lon'])
    expect(stale.aircraft).toEqual([])
    expect(stale.rejected).toEqual([{ hex: '4b8750', reason: 'no_position' }])
  })

  it('now ms (adsb.lol) ve saniye (readsb aircraft.json) aynı örnek zamanını verir', () => {
    const ms = one({ seen_pos: 2.5 }, [], 1_790_498_951_500)
    const readsb = parseLiveResponse(
      { now: 1_790_498_951.5, messages: 1, aircraft: [{ ...base, seen_pos: 2.5 }] },
      'localReceiver',
    )
    expect(ms.aircraft[0]?.sampleTime).toBe(1_790_498_949_000)
    expect(readsb.aircraft[0]?.sampleTime).toBe(1_790_498_949_000)
    expect(readsb.aircraft[0]?.source).toBe('localReceiver')
    expect(epochMs(1_790_498_951.5)).toBe(1_790_498_951_500)
  })

  it('boş flight (8 boşluk) null çağrı kodu, dolu olan kırpılır', () => {
    expect(one({ flight: '        ' }).aircraft[0]?.callsign).toBeNull()
    expect(one({ flight: 'THY1KQ  ' }).aircraft[0]?.callsign).toBe('THY1KQ')
  })

  it('~ ile başlayan hex ICAO dışı adrestir (TIS-B)', () => {
    const [a] = one({ hex: '~2A4F10', type: 'tisb_trackfile' }).aircraft
    expect(a).toMatchObject({ hex: '~2a4f10', nonIcao: true, positionSource: 'tisb_trackfile' })
    expect(a && isLowWeightSource(a.positionSource)).toBe(true)
  })

  it('konum MLAT ya da TIS-B listesinden geliyorsa type adsb_icao olsa da o kaynak kullanılır', () => {
    expect(one({ mlat: ['lat', 'lon', 'track'] }).aircraft[0]?.positionSource).toBe('mlat')
    expect(one({ tisb: ['lat', 'lon'] }).aircraft[0]?.positionSource).toBe('tisb_other')
    expect(one({ mlat: ['gs'] }).aircraft[0]?.positionSource).toBe('adsb_icao')
    for (const source of ['mlat', 'other', 'unknown', 'tisb_icao', 'tisb_other'] as const) {
      expect(isLowWeightSource(source), source).toBe(true)
    }
    for (const source of ['adsb_icao', 'adsb_icao_nt', 'adsr_icao', 'adsc'] as const) {
      expect(isLowWeightSource(source), source).toBe(false)
    }
  })

  it('dbFlags bitleri tek tek: 1 askeri gizli, 2 ilginç görünür, 4 PIA ve 8 LADD tescili gizler', () => {
    const state = (dbFlags: number) => {
      const a = one({ dbFlags }).aircraft[0]
      if (!a) throw new Error(`dbFlags ${dbFlags} ayrışmadı`)
      return { a, shown: withPrivacy(a) }
    }
    const expectations: [number, { hidden: boolean; registration: boolean }][] = [
      [0, { hidden: false, registration: true }],
      [1, { hidden: true, registration: true }],
      [2, { hidden: false, registration: true }],
      [3, { hidden: true, registration: true }],
      [4, { hidden: false, registration: false }],
      [8, { hidden: false, registration: false }],
      [16, { hidden: false, registration: true }],
    ]
    for (const [dbFlags, expected] of expectations) {
      const { a, shown } = state(dbFlags)
      expect(isHiddenByDefault(a), `dbFlags ${dbFlags} gizli`).toBe(expected.hidden)
      expect(shown.registration !== null, `dbFlags ${dbFlags} tescil`).toBe(expected.registration)
      // Havayolu çağrı kodu (tescile eşit değil) PIA/LADD'de de görünür kalır.
      expect(shown.callsign, `dbFlags ${dbFlags} çağrı kodu`).toBe('PGT4XF')
    }
    expect(hasDbFlag(3, 'military') && hasDbFlag(3, 'interesting') && !hasDbFlag(3, 'pia')).toBe(
      true,
    )
  })

  it("dbFlags: adsb.lol'de yoksa 0; yerel alıcıda yoksa bilinmiyor (gizli sayılır); bozuksa kayıt reddedilir", () => {
    expect(one({}, ['dbFlags']).aircraft[0]?.dbFlags).toBe(0)
    const local = parseLiveResponse(
      {
        now: point.now / 1000,
        aircraft: [{ hex: '4b8750', lat: 41, lon: 29, seen_pos: 1, r: 'TC-XYZ' }],
      },
      'localReceiver',
    ).aircraft[0]
    expect(local?.dbFlags).toBeNull()
    expect(local && isHiddenByDefault(local)).toBe(true)
    expect(local && withPrivacy(local).registration).toBeNull()
    for (const dbFlags of ['1', 1.5, -1]) {
      expect(one({ dbFlags }).rejected, String(dbFlags)).toEqual([
        { hex: '4b8750', reason: 'invalid_db_flags' },
      ])
    }
  })

  it("emergency 'none' null olur, diğerleri korunur", () => {
    expect(one({ emergency: 'none' }).aircraft[0]?.emergency).toBeNull()
    expect(one({ emergency: 'general' }).aircraft[0]?.emergency).toBe('general')
  })
})

describe('saat', () => {
  it('negatif seen_pos gelecekte örnek üretmez; seen_pos yoksa seen kullanılır', () => {
    expect(one({ seen_pos: -5 }).aircraft[0]?.sampleTime).toBe(point.now)
    expect(one({ seen: 3 }, ['seen_pos']).aircraft[0]?.sampleTime).toBe(point.now - 3000)
  })

  it("yanıtın saati alınma anından 60 sn'den fazla saparsa yanıt reddedilir", () => {
    const at = (receivedAt: number) => () => parseLiveResponse(point, 'adsbLol', { receivedAt })
    expect(at(point.now + 59_000)).not.toThrow()
    expect(at(point.now + 61_000)).toThrow(ResponseFormatError)
    expect(at(point.now - 61_000)).toThrow(/kaymış/)
  })
})

describe('temizlik', () => {
  it(`${CLEANING.maxSampleAgeMs / 1000} sn'den eski örnek, imkânsız hız ve dikey hız, geçersiz konum atılır`, () => {
    const cases = [
      [{ seen_pos: 61 }, 'stale'],
      [{ gs: 801 }, 'impossible_speed'],
      [{ baro_rate: -10_001 }, 'impossible_vertical_rate'],
      [{ geom_rate: 10_500 }, 'impossible_vertical_rate'],
      [{ lat: 95 }, 'invalid_position'],
      [{ lon: -181 }, 'invalid_position'],
    ] as const
    for (const [patch, reason] of cases) {
      const result = one(patch)
      expect(result.aircraft, reason).toEqual([])
      expect(result.rejected[0]?.reason, JSON.stringify(patch)).toBe(reason)
    }
    // Sınırda kalanlar geçer.
    expect(one({ seen_pos: 60, gs: 800, baro_rate: -10_000 }).aircraft).toHaveLength(1)
  })

  it('hex taşımayan kayıt bozuk sayılır; zarfı bozuk yanıt hata verir', () => {
    const result = parseLiveResponse(envelope([{ lat: 41, lon: 29 }]), 'adsbLol')
    expect(result.rejected).toEqual([{ hex: null, reason: 'malformed' }])
    expect(() => parseLiveResponse({ ac: [] }, 'adsbLol')).toThrow(ResponseFormatError)
    expect(() => parseLiveResponse('<html>', 'adsbLol')).toThrow(ResponseFormatError)
  })
})
