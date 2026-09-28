import { readFileSync } from 'node:fs'
import { distanceKm, initialBearing, KM_PER_NM, type LatLon } from '@havayolu/geo'
import { parseCsvRecords, parseLiveResponse } from '@havayolu/providers'
import { describe, expect, it } from 'vitest'
import {
  AIRPORTS,
  APPROACH_PROFILE,
  CRUISE_ALTITUDE_FT,
  CRUISE_ROUTES,
  cruiseFleet,
  cruiseScenario,
  createScenario,
  isScenarioName,
  LTFM_35L,
  MAX_CRUISE_COUNT,
  SEEN_POS_S,
  syntheticIdentity,
  type ReadsbAircraft,
  type ReadsbFrame,
} from '.'

/** Sabit bir an (2026-09-28 09:00 UTC): testler gerçek saate bağlı değildir. */
const T0 = Date.UTC(2026, 8, 28, 9, 0, 0)
const APPROACH_HEX = 'ff0091'
const TAXI_HEX = 'ff0092'

const pos = (a: ReadsbAircraft): LatLon => ({ lat: a.lat, lon: a.lon })
const byHex = (frame: ReadsbFrame) => new Map(frame.aircraft.map((a) => [a.hex, a]))
const angleDiff = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360)
  return d > 180 ? 360 - d : d
}
const ktOver = (km: number, ms: number) => km / KM_PER_NM / (ms / 3_600_000)

describe('cruise senaryosu: determinizm ve biçim', () => {
  it('aynı an her zaman aynı kareyi verir (ayrı örneklerde de)', () => {
    const a = cruiseScenario().frameAt(T0)
    const b = cruiseScenario().frameAt(T0)
    expect(b).toEqual(a)
    expect(JSON.stringify(cruiseScenario().frameAt(T0 + 12_345))).toBe(
      JSON.stringify(cruiseScenario().frameAt(T0 + 12_345)),
    )
    expect(cruiseScenario().frameAt(T0 + 1000)).not.toEqual(a)
  })

  it('zarf readsb aircraft.json biçimindedir: now saniye, messages artar', () => {
    const frame = cruiseScenario().frameAt(T0 + 250)
    expect(frame.now).toBe((T0 + 250) / 1000)
    expect(frame.messages).toBeGreaterThan(0)
    expect(cruiseScenario().frameAt(T0 + 10_000).messages).toBeGreaterThan(frame.messages)
  })

  it('varsayılan 8 seyir uçağı + yaklaşma + taksi; kimlikler sentetik ve tekil', () => {
    const frame = cruiseScenario().frameAt(T0)
    expect(frame.aircraft).toHaveLength(10)
    const hexes = frame.aircraft.map((a) => a.hex)
    expect(new Set(hexes).size).toBe(hexes.length)
    expect(hexes.slice(0, 8)).toEqual([
      'ff0001',
      'ff0002',
      'ff0003',
      'ff0004',
      'ff0005',
      'ff0006',
      'ff0007',
      'ff0008',
    ])
    expect(hexes.slice(8)).toEqual([APPROACH_HEX, TAXI_HEX])
    for (const a of frame.aircraft) {
      expect(a.hex).toMatch(/^ff\d{4}$/)
      expect(a.flight).toMatch(/^HYS\d{3} {2}$/)
      expect(a.r).toMatch(/^TC-SYN\d{2}$/)
      expect(a.squawk).toMatch(/^[0-7]{4}$/)
      expect(a).toMatchObject({ dbFlags: 0, type: 'adsb_icao', seen_pos: SEEN_POS_S })
      expect(a.seen).toBeLessThanOrEqual(a.seen_pos)
    }
  })

  it('kimlikler uçak sayısından bağımsız sabittir', () => {
    const three = byHex(cruiseScenario({ count: 3 }).frameAt(T0))
    const eight = byHex(cruiseScenario({ count: 8 }).frameAt(T0))
    expect(three.size).toBe(5)
    expect(three.get('ff0002')).toEqual(eight.get('ff0002'))
    expect(three.get(APPROACH_HEX)).toEqual(eight.get(APPROACH_HEX))
    expect(three.get(TAXI_HEX)).toEqual(eight.get(TAXI_HEX))
    expect(
      cruiseScenario({ count: 0 })
        .frameAt(T0)
        .aircraft.map((a) => a.hex),
    ).toEqual([APPROACH_HEX, TAXI_HEX])
  })

  it('uçak sayısı 0–90 arası tam sayı olmalı', () => {
    expect(() => cruiseScenario({ count: -1 })).toThrow(RangeError)
    expect(() => cruiseScenario({ count: MAX_CRUISE_COUNT + 1 })).toThrow(RangeError)
    expect(() => cruiseScenario({ count: 1.5 })).toThrow(RangeError)
    expect(cruiseScenario({ count: MAX_CRUISE_COUNT }).frameAt(T0).aircraft).toHaveLength(92)
  })

  it('sonlu olmayan zaman RangeError verir', () => {
    expect(() => cruiseScenario().frameAt(Number.NaN)).toThrow(RangeError)
  })
})

describe('cruise senaryosu: hareket', () => {
  const scenario = cruiseScenario()
  const fleet = cruiseFleet()

  it('bütün uçaklar 3 sn içinde yer değiştirir', () => {
    const before = byHex(scenario.frameAt(T0))
    const after = byHex(scenario.frameAt(T0 + 3000))
    for (const [hex, a] of before) {
      const b = after.get(hex)!
      expect(distanceKm(pos(a), pos(b)), hex).toBeGreaterThan(0.015)
    }
  })

  it("seyir uçakları 35.000 ft'te, ≈ 450 kt ile büyük daire üzerinde uçar", () => {
    const before = byHex(scenario.frameAt(T0))
    const after = byHex(scenario.frameAt(T0 + 3000))
    for (const flight of fleet) {
      const a = before.get(flight.hex)!
      const b = after.get(flight.hex)!
      expect(a.alt_baro).toBe(CRUISE_ALTITUDE_FT)
      expect(a.baro_rate).toBe(0)
      expect(a.gs).toBe(flight.gsKt)
      expect(a.gs).toBeGreaterThanOrEqual(440)
      expect(a.gs).toBeLessThanOrEqual(465)
      expect(ktOver(distanceKm(pos(a), pos(b)), 3000)).toBeCloseTo(flight.gsKt, -1)
      const from = AIRPORTS[flight.from]
      const to = AIRPORTS[flight.to]
      const offCourseKm = distanceKm(from, pos(a)) + distanceKm(pos(a), to) - distanceKm(from, to)
      expect(offCourseKm, flight.hex).toBeLessThan(0.01)
    }
  })

  it('iz (track) gerçek hareket yönüyle tutarlıdır', () => {
    for (const t of [T0, T0 + 7 * 60_000, T0 + 95 * 60_000]) {
      const before = byHex(scenario.frameAt(t))
      const after = byHex(scenario.frameAt(t + 1000))
      for (const flight of fleet) {
        const a = before.get(flight.hex)!
        const b = after.get(flight.hex)!
        expect(a.track).toBeGreaterThanOrEqual(0)
        expect(a.track).toBeLessThan(360)
        expect(angleDiff(initialBearing(pos(a), pos(b)), a.track!), flight.hex).toBeLessThan(0.5)
      }
    }
  })

  it("rotalar sırayla dağıtılır; 8'den fazlası aynı rotayı başka noktadan uçar", () => {
    const many = cruiseFleet(10)
    expect(many.map((f) => [f.from, f.to])).toEqual([
      ...CRUISE_ROUTES.map((r) => [...r]),
      [...CRUISE_ROUTES[0]!],
      [...CRUISE_ROUTES[1]!],
    ])
    expect(many[8]!.phase).not.toBe(many[0]!.phase)
    for (const f of many) {
      expect(f.phase).toBeGreaterThanOrEqual(0)
      expect(f.phase).toBeLessThan(1)
    }
  })

  it('yaklaşma uçağı 35L ekseninde alçalır', () => {
    const threshold = LTFM_35L.threshold
    for (let t = T0; t < T0 + 20 * 60_000; t += 20_000) {
      const a = byHex(scenario.frameAt(t)).get(APPROACH_HEX)!
      const b = byHex(scenario.frameAt(t + 3000)).get(APPROACH_HEX)!
      expect(a.alt_baro).toBeTypeOf('number')
      const alt = a.alt_baro as number
      expect(alt).toBeGreaterThanOrEqual(350)
      expect(alt).toBeLessThanOrEqual(4200)
      expect(a.baro_rate).toBeLessThan(0)
      expect(Math.abs(a.baro_rate! % 64)).toBe(0)
      expect(angleDiff(a.track!, 359)).toBeLessThan(1.5)
      expect(distanceKm(threshold, pos(a))).toBeLessThanOrEqual(12 * KM_PER_NM + 0.01)
      expect(
        angleDiff(initialBearing(threshold, pos(a)), APPROACH_PROFILE.runwayBearingDeg + 180),
      ).toBeLessThan(0.5)
      // Döngü başına atlama dışında 3 sn sonra daha alçakta ve eşiğe daha yakındır.
      if (distanceKm(threshold, pos(b)) < distanceKm(threshold, pos(a))) {
        expect(b.alt_baro as number).toBeLessThanOrEqual(alt)
      }
    }
  })

  it("taksi uçağı LTFM'de yerde ≈ 15 kt ile dolaşır", () => {
    for (let t = T0; t < T0 + 20 * 60_000; t += 30_000) {
      const a = byHex(scenario.frameAt(t)).get(TAXI_HEX)!
      expect(a.alt_baro).toBe('ground')
      expect(a.alt_geom).toBeUndefined()
      expect(a.gs).toBe(15)
      expect(distanceKm(AIRPORTS.IST, pos(a))).toBeLessThan(2)
    }
  })

  it('6 saat boyunca her kare Türkiye içinde ve fiziksel sınırlarda kalır', () => {
    const wide = cruiseScenario({ count: 16 })
    for (let t = T0; t < T0 + 6 * 3_600_000; t += 53_000) {
      for (const a of wide.frameAt(t).aircraft) {
        expect(a.lat).toBeGreaterThan(35.5)
        expect(a.lat).toBeLessThan(42.5)
        expect(a.lon).toBeGreaterThan(25.5)
        expect(a.lon).toBeLessThan(45)
        expect(a.gs).toBeLessThan(500)
        expect(Math.abs(a.baro_rate ?? 0)).toBeLessThan(2000)
      }
    }
  })
})

describe('cruise senaryosu: yerel alıcı ayrıştırıcısı', () => {
  it('kareler localReceiver ayrıştırıcısından sıfır retle geçer', () => {
    const scenario = cruiseScenario({ count: 16 })
    for (let t = T0; t < T0 + 3 * 3_600_000; t += 97_000) {
      const frame = JSON.parse(JSON.stringify(scenario.frameAt(t))) as unknown
      const parsed = parseLiveResponse(frame, 'localReceiver', { receivedAt: t })
      expect(parsed.rejected).toEqual([])
      expect(parsed.aircraft).toHaveLength(18)
      expect(parsed.now).toBe(t)
    }
  })

  it('model alanları doğru eşlenir: örnek zamanı now − seen_pos, yerde irtifa yok', () => {
    const frame = cruiseScenario().frameAt(T0)
    const parsed = parseLiveResponse(frame, 'localReceiver', { receivedAt: T0 })
    for (const a of parsed.aircraft) {
      expect(a.sampleTime).toBe(T0 - SEEN_POS_S * 1000)
      expect(a).toMatchObject({ dbFlags: 0, positionSource: 'adsb_icao', source: 'localReceiver' })
    }
    const first = parsed.aircraft.find((a) => a.hex === 'ff0001')!
    expect(first).toMatchObject({
      callsign: 'HYS001',
      registration: 'TC-SYN01',
      typeCode: 'A321',
      onGround: false,
      altBaroFt: CRUISE_ALTITUDE_FT,
    })
    const taxi = parsed.aircraft.find((a) => a.hex === TAXI_HEX)!
    expect(taxi).toMatchObject({ onGround: true, altBaroFt: null, gsKt: 15 })
  })
})

describe('sentetik kimlik ve senaryo kaydı', () => {
  it('kimlik biçimi', () => {
    expect(syntheticIdentity(1)).toEqual({
      hex: 'ff0001',
      callsign: 'HYS001',
      registration: 'TC-SYN01',
      squawk: '2001',
    })
    for (let n = 1; n <= 92; n += 1) {
      const { squawk } = syntheticIdentity(n)
      expect(squawk).toMatch(/^[0-7]{4}$/)
      expect(['7500', '7600', '7700']).not.toContain(squawk)
    }
  })

  it('createScenario ve isScenarioName', () => {
    expect(isScenarioName('cruise')).toBe(true)
    expect(isScenarioName('storm')).toBe(false)
    const scenario = createScenario('cruise', { count: 2 })
    expect(scenario.name).toBe('cruise')
    expect(scenario.frameAt(T0).aircraft).toHaveLength(4)
    expect(createScenario('cruise').frameAt(T0)).toEqual(cruiseScenario().frameAt(T0))
  })
})

describe("havalimanı verisi commit'li OurAirports alt kümesiyle aynı", () => {
  const read = (name: string) =>
    parseCsvRecords(
      readFileSync(new URL(`../../fixtures/ourairports/${name}.csv`, import.meta.url), 'utf8'),
    ).records.map((r) => r.values)

  it('ARP ve alan yüksekliği', () => {
    const airports = new Map(read('airports').map((v) => [v.ident, v]))
    for (const airport of Object.values(AIRPORTS)) {
      const row = airports.get(airport.icao)
      expect(row, airport.icao).toBeDefined()
      expect(airport.lat).toBeCloseTo(Number(row!.latitude_deg), 6)
      expect(airport.lon).toBeCloseTo(Number(row!.longitude_deg), 6)
      expect(airport.elevationFt).toBe(Number(row!.elevation_ft))
    }
  })

  it('LTFM 35L eşiği ve karşı ucu', () => {
    const row = read('runways').find((v) => v.airport_ident === 'LTFM' && v.he_ident === '35L')
    expect(row).toBeDefined()
    expect(LTFM_35L.threshold.lat).toBeCloseTo(Number(row!.he_latitude_deg), 9)
    expect(LTFM_35L.threshold.lon).toBeCloseTo(Number(row!.he_longitude_deg), 9)
    expect(LTFM_35L.farEnd.lat).toBeCloseTo(Number(row!.le_latitude_deg), 9)
    expect(LTFM_35L.farEnd.lon).toBeCloseTo(Number(row!.le_longitude_deg), 9)
    expect(LTFM_35L.thresholdElevationFt).toBe(Number(row!.he_elevation_ft))
  })
})
