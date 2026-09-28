import { distanceKm, initialBearing, KM_PER_NM, mToFt, type LatLon } from '@havayolu/geo'
import { describe, expect, it } from 'vitest'
import { AIRPORTS, LTFM_35L } from './airports'
import {
  approachMotion,
  ktToKmPerMs,
  loopMotion,
  positiveMod,
  shuttleMotion,
  type ApproachProfile,
} from './motion'

const near = (a: LatLon, b: LatLon, km = 0.001) => distanceKm(a, b) <= km
const angleDiff = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360)
  return d > 180 ? 360 - d : d
}

describe('positiveMod', () => {
  it('sonuç her zaman [0, period)', () => {
    expect(positiveMod(5, 3)).toBe(2)
    expect(positiveMod(-1, 3)).toBe(2)
    expect(positiveMod(-3, 3)).toBe(0)
    expect(positiveMod(0, 3)).toBe(0)
    expect(positiveMod(-1e-18, 3)).toBeLessThan(3)
  })
})

describe('shuttleMotion', () => {
  const a = AIRPORTS.IST
  const b = AIRPORTS.ESB
  const gsKt = 450
  const legMs = distanceKm(a, b) / ktToKmPerMs(gsKt)
  const motion = shuttleMotion(a, b, gsKt)

  it("a'dan başlar, bacak süresinde b'ye varır, turda a'ya döner", () => {
    expect(near(motion(0).position, a)).toBe(true)
    expect(near(motion(legMs - 1e-6).position, b)).toBe(true)
    expect(near(motion(2 * legMs - 1e-6).position, a)).toBe(true)
    expect(near(motion(2 * legMs).position, a)).toBe(true)
  })

  it('iz: gidişte a→b, dönüşte b→a yönü; yer hızı sabit', () => {
    expect(motion(0).trackDeg).toBeCloseTo(initialBearing(a, b), 6)
    expect(motion(legMs + 1).trackDeg).toBeCloseTo(initialBearing(b, a), 3)
    expect(motion(123_456).gsKt).toBe(gsKt)
  })

  it('konum büyük daire üzerindedir ve hız kt ile tutarlıdır', () => {
    for (const t of [60_000, legMs / 3, legMs / 2, legMs * 0.9]) {
      const p = motion(t).position
      expect(distanceKm(a, p) + distanceKm(p, b) - distanceKm(a, b)).toBeLessThan(1e-6)
      expect(distanceKm(a, p)).toBeCloseTo(t * ktToKmPerMs(gsKt), 6)
    }
  })

  it('phase turun başlangıç noktasını kaydırır', () => {
    const half = shuttleMotion(a, b, gsKt, 0.5)
    expect(near(half(0).position, b)).toBe(true)
    expect(half(1000)).toEqual(motion(legMs + 1000))
  })

  it('geçersiz girdi RangeError verir', () => {
    expect(() => shuttleMotion(a, a, gsKt)).toThrow(RangeError)
    expect(() => shuttleMotion(a, b, 0)).toThrow(RangeError)
    expect(() => shuttleMotion(a, b, Number.NaN)).toThrow(RangeError)
  })
})

describe('approachMotion', () => {
  const profile: ApproachProfile = {
    threshold: LTFM_35L.threshold,
    runwayBearingDeg: initialBearing(LTFM_35L.threshold, LTFM_35L.farEnd),
    thresholdElevationFt: 310,
    startNm: 12,
    startKt: 180,
    thresholdKt: 140,
    glideSlopeDeg: 3,
    crossingHeightFt: 50,
  }
  const motion = approachMotion(profile)
  const lengthKm = 12 * KM_PER_NM
  const durationMs = (2 * lengthKm) / (ktToKmPerMs(180) + ktToKmPerMs(140))
  const glide = Math.tan((3 * Math.PI) / 180)

  it('pist yönü uçlardan ≈ 359°', () => {
    expect(profile.runwayBearingDeg).toBeGreaterThan(358)
    expect(profile.runwayBearingDeg).toBeLessThan(360)
  })

  it("12 NM'de başlar: süzülüş yüksekliği, 180 kt, pist yönünde", () => {
    const start = motion(0)
    expect(distanceKm(start.position, profile.threshold)).toBeCloseTo(lengthKm, 6)
    expect(start.remainingKm).toBeCloseTo(lengthKm, 6)
    expect(start.altitudeFt).toBeCloseTo(310 + 50 + mToFt(lengthKm * 1000) * glide, 3)
    expect(start.gsKt).toBe(180)
    expect(angleDiff(start.trackDeg, profile.runwayBearingDeg)).toBeLessThan(0.01)
    expect(start.verticalRateFpm).toBeCloseTo(-180 * (mToFt(1852) / 60) * glide, 6)
  })

  it('eşiğe süre sonunda TCH ile ve 140 kt ile varır, sonra başa döner', () => {
    const end = motion(durationMs - 1e-6)
    expect(end.remainingKm).toBeLessThan(1e-6)
    expect(end.altitudeFt).toBeCloseTo(360, 3)
    expect(end.gsKt).toBeCloseTo(140, 6)
    expect(angleDiff(end.trackDeg, profile.runwayBearingDeg)).toBeLessThan(0.01)
    const again = motion(durationMs + 10_000)
    const first = motion(10_000)
    expect(distanceKm(again.position, first.position)).toBeLessThan(1e-6)
    expect(again.altitudeFt).toBeCloseTo(first.altitudeFt, 6)
  })

  it('yaklaşma boyunca alçalır, yavaşlar ve eksende kalır', () => {
    let previous = motion(0)
    for (let t = 5_000; t < durationMs; t += 5_000) {
      const current = motion(t)
      expect(current.altitudeFt).toBeLessThan(previous.altitudeFt)
      expect(current.gsKt).toBeLessThan(previous.gsKt)
      expect(current.verticalRateFpm).toBeLessThan(0)
      // Eşikten bakınca uçak pist yönünün tersinde (uzatılmış eksende) durur.
      const fromThreshold = initialBearing(profile.threshold, current.position)
      expect(angleDiff(fromThreshold, profile.runwayBearingDeg + 180)).toBeLessThan(0.01)
      previous = current
    }
  })

  it('geçersiz profil RangeError verir', () => {
    expect(() => approachMotion({ ...profile, startNm: 0 })).toThrow(RangeError)
    expect(() => approachMotion({ ...profile, thresholdKt: -1 })).toThrow(RangeError)
  })
})

describe('loopMotion', () => {
  const square: LatLon[] = [
    { lat: 41.27, lon: 28.733 },
    { lat: 41.284, lon: 28.733 },
    { lat: 41.284, lon: 28.736 },
    { lat: 41.27, lon: 28.736 },
  ]
  const perimeterKm = square.reduce(
    (sum, p, i) => sum + distanceKm(p, square[(i + 1) % square.length]!),
    0,
  )
  const periodMs = perimeterKm / ktToKmPerMs(15)
  const motion = loopMotion(square, 15)

  it('ilk noktadan başlar, çevre süresinde başa döner', () => {
    expect(near(motion(0).position, square[0]!)).toBe(true)
    expect(near(motion(periodMs - 1e-3).position, square[0]!, 0.005)).toBe(true)
    expect(motion(periodMs).position.lat).toBeCloseTo(motion(0).position.lat, 9)
  })

  it('kenar üzerinde iz kenar yönündedir', () => {
    const firstLeg = distanceKm(square[0]!, square[1]!)
    const t = firstLeg / 2 / ktToKmPerMs(15)
    const m = motion(t)
    expect(angleDiff(m.trackDeg, initialBearing(square[0]!, square[1]!))).toBeLessThan(0.01)
    expect(m.gsKt).toBe(15)
    const secondLegT = (firstLeg + 0.05) / ktToKmPerMs(15)
    expect(angleDiff(motion(secondLegT).trackDeg, 90)).toBeLessThan(1)
  })

  it('geçersiz girdi RangeError verir', () => {
    expect(() => loopMotion([square[0]!], 15)).toThrow(RangeError)
    expect(() => loopMotion(square, 0)).toThrow(RangeError)
    expect(() => loopMotion([square[0]!, square[0]!], 15)).toThrow(RangeError)
  })
})
