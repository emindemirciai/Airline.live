import { destinationPoint, type LatLon } from '@havayolu/geo'
import type { AircraftState } from '@havayolu/providers'
import { describe, expect, it } from 'vitest'
import {
  emptyCursor,
  FINE_ARP_KM,
  GROUND_MIN_MOVE_M,
  isFineCandidate,
  SAMPLED_INTERVAL_MS,
  trackDecision,
  type FineContext,
  type TrackCursor,
} from './tracks'

/** Test örneği: seyirdeki bir uçak; alanlar `overrides` ile değiştirilir. */
function state(overrides: Partial<AircraftState> = {}): AircraftState {
  return {
    hex: '4bb1c3',
    nonIcao: false,
    callsign: 'THY4',
    registration: 'TC-JJE',
    typeCode: 'B77W',
    category: 'A5',
    dbFlags: 0,
    positionSource: 'adsb_icao',
    lat: 41.2,
    lon: 28.7,
    altBaroFt: 35_000,
    onGround: false,
    altGeomFt: 35_500,
    navQnhHpa: null,
    gsKt: 450,
    trackDeg: 90,
    trueHeadingDeg: null,
    baroRateFpm: 0,
    geomRateFpm: null,
    iasKt: null,
    tasKt: null,
    mach: null,
    windDirDeg: null,
    windSpeedKt: null,
    oatC: null,
    selAltFt: null,
    navModes: [],
    squawk: null,
    emergency: null,
    sampleTime: 0,
    source: 'adsbLol',
    ...overrides,
  }
}

/** LTFM ARP (alan yüksekliği 325 ft) ve yüksekliği bilinmeyen sentetik bir istasyon. */
const IST: LatLon = { lat: 41.274874, lon: 28.732136 }
const NO_ELEVATION: LatLon = { lat: 38.2924, lon: 27.157 }
const CTX: FineContext = {
  stations: [
    { ...IST, elevationFt: 325 },
    { ...NO_ELEVATION, elevationFt: null },
  ],
  watch: new Set(['abcdef']),
}

/** `from` noktasından kuzeye `meters` metre. */
const north = (from: LatLon, meters: number) => destinationPoint(from, 0, meters / 1000)

const at = (point: LatLon, extra: Partial<AircraftState> = {}) =>
  state({ lat: point.lat, lon: point.lon, ...extra })
const onGround = (point: LatLon, extra: Partial<AircraftState> = {}) =>
  at(point, { onGround: true, altBaroFt: null, gsKt: 5, ...extra })

describe('isFineCandidate', () => {
  it('takip listesindeki uçak konum ve irtifadan bağımsız adaydır', () => {
    const far = { lat: 51.47, lon: -0.46 }
    expect(isFineCandidate(at(far, { hex: 'abcdef' }), CTX)).toBe(true)
    expect(isFineCandidate(at(far, { hex: 'abcdef', altBaroFt: null }), CTX)).toBe(true)
    expect(isFineCandidate(at(far), CTX)).toBe(false)
  })

  it('ARP’a ≤ 30 km ve yerden yükseklik < 10.000 ft (alan yüksekliği düşülür)', () => {
    const near = north(IST, 10_000)
    expect(isFineCandidate(at(near, { altBaroFt: 10_300 }), CTX)).toBe(true)
    expect(isFineCandidate(at(near, { altBaroFt: 10_325 }), CTX)).toBe(false)
    expect(isFineCandidate(at(near, { altBaroFt: 35_000 }), CTX)).toBe(false)
  })

  it('alan yüksekliği bilinmiyorsa 0 alınır', () => {
    const near = north(NO_ELEVATION, 5_000)
    expect(isFineCandidate(at(near, { altBaroFt: 9_999 }), CTX)).toBe(true)
    expect(isFineCandidate(at(near, { altBaroFt: 10_000 }), CTX)).toBe(false)
  })

  it('30 km sınırı dahildir; ötesi aday değildir (yerde olsa da)', () => {
    expect(isFineCandidate(at(north(IST, FINE_ARP_KM * 1000 - 1), { altBaroFt: 3_000 }), CTX)).toBe(
      true,
    )
    const outside = north(IST, FINE_ARP_KM * 1000 + 50)
    expect(isFineCandidate(at(outside, { altBaroFt: 3_000 }), CTX)).toBe(false)
    expect(isFineCandidate(onGround(outside), CTX)).toBe(false)
  })

  it('yerdeki uçak (irtifa null) adaydır; irtifası bilinmeyen havadaki uçak değildir', () => {
    const near = north(IST, 2_000)
    expect(isFineCandidate(onGround(near), CTX)).toBe(true)
    expect(isFineCandidate(at(near, { altBaroFt: null }), CTX)).toBe(false)
  })

  it('istasyon yoksa yalnızca takip listesi', () => {
    const ctx: FineContext = { stations: [], watch: new Set() }
    expect(isFineCandidate(onGround(IST), ctx)).toBe(false)
  })
})

/** Örnekleri sırayla işler; her örnek için (sampled, fine) döner. */
function decide(samples: readonly AircraftState[], ctx: FineContext = CTX) {
  let cursor: TrackCursor = emptyCursor()
  return samples.map((s) => {
    const result = trackDecision(cursor, s, ctx)
    cursor = result.cursor
    return [result.sampled, result.fine]
  })
}

describe('trackDecision', () => {
  it('ilk örnek iki tabloya da yazılır ve imleç güncellenir', () => {
    const s = at(north(IST, 5_000), { altBaroFt: 3_000, sampleTime: 1_000 })
    const result = trackDecision(emptyCursor(), s, CTX)
    expect(result).toEqual({
      sampled: true,
      fine: true,
      cursor: {
        sampledTs: 1_000,
        sampledPos: { lat: s.lat, lon: s.lon },
        fineTs: 1_000,
        finePos: { lat: s.lat, lon: s.lon },
      },
    })
  })

  it('sampled 30 sn’de bir yazılır; fine her yeni örnekte', () => {
    const times = [0, 10_000, SAMPLED_INTERVAL_MS - 1, SAMPLED_INTERVAL_MS, 45_000, 60_000]
    const samples = times.map((sampleTime, i) =>
      at(north(IST, 5_000 + i * 150), { altBaroFt: 3_000, sampleTime }),
    )
    expect(decide(samples)).toEqual([
      [true, true],
      [false, true],
      [false, true],
      [true, true],
      [false, true],
      [true, true],
    ])
  })

  it('fine yalnızca son yazılandan yeni örneği yazar', () => {
    const s = at(north(IST, 5_000), { altBaroFt: 3_000, sampleTime: 5_000 })
    expect(decide([s, s, { ...s, sampleTime: 4_000 }])).toEqual([
      [true, true],
      [false, false],
      [false, false],
    ])
  })

  it('aday olmayan örnek fine’a yazılmaz ve fine imleci değişmez', () => {
    const cruise = at({ lat: 39, lon: 35 }, { sampleTime: 0 })
    const result = trackDecision(emptyCursor(), cruise, CTX)
    expect(result.sampled).toBe(true)
    expect(result.fine).toBe(false)
    expect(result.cursor.fineTs).toBeNull()
    expect(result.cursor.finePos).toBeNull()
  })

  it('yerde 20 m’den az kıpırdayan örnek yazılmaz; 20 m ve ötesi yazılır', () => {
    const base = north(IST, 1_000)
    const t = (s: number) => s * 1_000
    expect(
      decide([
        onGround(base, { sampleTime: t(0) }),
        onGround(north(base, 10), { sampleTime: t(1) }),
        onGround(north(base, GROUND_MIN_MOVE_M - 0.5), { sampleTime: t(2) }),
        onGround(north(base, GROUND_MIN_MOVE_M + 0.5), { sampleTime: t(3) }),
        onGround(north(base, 25), { sampleTime: t(40) }),
        onGround(north(base, 50), { sampleTime: t(70) }),
      ]),
    ).toEqual([
      [true, true],
      [false, false],
      [false, false],
      [false, true],
      // sampled son yazılan (0 m) noktasına göre 25 m: yazılır; fine (20,5 m) göre 4,5 m: yazılmaz.
      [true, false],
      [true, true],
    ])
  })

  it('park eden uçak iki tabloya da hiç yazılmaz', () => {
    const base = north(IST, 1_000)
    const parked = Array.from({ length: 20 }, (_, i) =>
      onGround(north(base, i % 2 === 0 ? 0 : 3), { sampleTime: i * 30_000 }),
    )
    const written = decide(parked).slice(1)
    expect(written.every(([sampled, fine]) => !sampled && !fine)).toBe(true)
  })

  it('20 m kuralı yalnızca yerde uygulanır', () => {
    const point = north(IST, 5_000)
    expect(
      decide([
        at(point, { altBaroFt: 2_000, sampleTime: 0 }),
        at(point, { altBaroFt: 2_000, sampleTime: 1_000 }),
        at(point, { altBaroFt: 2_000, sampleTime: SAMPLED_INTERVAL_MS }),
      ]),
    ).toEqual([
      [true, true],
      [false, true],
      [true, true],
    ])
  })

  it('takip listesindeki uçak her yeni örnekte fine’a yazılır', () => {
    const far = { lat: 39, lon: 35 }
    expect(
      decide([
        at(far, { hex: 'abcdef', sampleTime: 0 }),
        at(far, { hex: 'abcdef', sampleTime: 2_000 }),
      ]),
    ).toEqual([
      [true, true],
      [false, true],
    ])
  })
})
