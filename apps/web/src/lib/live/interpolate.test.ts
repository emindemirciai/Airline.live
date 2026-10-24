import { distanceKm, initialBearing } from '@havayolu/geo'
import type { LiveStatus } from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import {
  blend,
  liveMaxAgeMs,
  MAX_EXTRAPOLATION_MS,
  motionPolicy,
  NORMAL_MOTION_POLICY,
  OPACITY_STEP,
  predictPosition,
  SPARSE_MAX_EXTRAPOLATION_MS,
  STALE_MIN_OPACITY,
  staleOpacity,
} from './interpolate'

const start = { lat: 41, lon: 29 }

describe('predictPosition', () => {
  it('yer hızı ve iz yönüyle ileri taşır (kt → km)', () => {
    // 360 kt = 666,72 km/sa → 5 sn'de 0,926 km.
    const p = predictPosition({ ...start, gs: 360, trk: 45 }, 1_000, 6_000)
    expect(distanceKm(start, p)).toBeCloseTo(0.926, 3)
    expect(initialBearing(start, p)).toBeCloseTo(45, 1)
  })

  it('en fazla 10 sn ileri gider', () => {
    const ac = { ...start, gs: 360, trk: 90 }
    const atLimit = predictPosition(ac, 0, MAX_EXTRAPOLATION_MS)
    const later = predictPosition(ac, 0, MAX_EXTRAPOLATION_MS * 6)
    expect(later).toEqual(atLimit)
    expect(distanceKm(start, atLimit)).toBeCloseTo(1.852, 3)
    expect(distanceKm(start, predictPosition(ac, 0, 60_000, 2_000))).toBeCloseTo(0.3704, 3)
  })

  it('hız ya da yön yoksa, uçak duruyorsa ya da saat geride ise kıpırdamaz', () => {
    expect(predictPosition({ ...start, gs: null, trk: 90 }, 0, 5_000)).toEqual(start)
    expect(predictPosition({ ...start, gs: 300, trk: null }, 0, 5_000)).toEqual(start)
    expect(predictPosition({ ...start, gs: 0.5, trk: 90 }, 0, 5_000)).toEqual(start)
    expect(predictPosition({ ...start, gs: 300, trk: 90 }, 5_000, 1_000)).toEqual(start)
    expect(predictPosition({ ...start, gs: Number.NaN, trk: 90 }, 0, 5_000)).toEqual(start)
  })

  it('antimeridyeni geçen tahmin boylamı −180..180 aralığında tutar', () => {
    const p = predictPosition({ lat: 0, lon: 179.999, gs: 500, trk: 90 }, 0, 10_000)
    expect(p.lon).toBeLessThan(-179)
  })
})

describe('blend', () => {
  const from = { lat: 40, lon: 28 }
  const to = { lat: 41, lon: 30 }

  it('doğrusal geçiş yapar ve oranı 0..1 aralığına kırpar', () => {
    expect(blend(from, to, 0)).toEqual(from)
    expect(blend(from, to, 0.5)).toEqual({ lat: 40.5, lon: 29 })
    expect(blend(from, to, 1)).toEqual(to)
    expect(blend(from, to, -3)).toEqual(from)
    expect(blend(from, to, 7)).toEqual(to)
    expect(blend(from, to, Number.NaN)).toEqual(to)
  })

  it('antimeridyeni aşan geçişte doğrudan hedefe atlar', () => {
    const east = { lat: 10, lon: 179.9 }
    const west = { lat: 10.1, lon: -179.9 }
    expect(blend(east, west, 0.5)).toEqual(west)
    expect(blend(west, east, 0.1)).toEqual(east)
  })

  it('girdileri değiştirmez, yeni nesne döner', () => {
    const result = blend(from, to, 1)
    expect(result).not.toBe(to)
    expect(from).toEqual({ lat: 40, lon: 28 })
  })
})

describe('seyrek veri (D-122): yaş penceresi, tahmin ufku ve soluklaşma', () => {
  const status = (maxAgeS?: number): LiveStatus => ({
    providers: { adsbLol: maxAgeS === undefined ? 'ok' : 'limited' },
    primaryAgeS: 10,
    newestAgeS: 5,
    ...(maxAgeS === undefined ? {} : { maxAgeS }),
  })
  const s = (seconds: number) => seconds * 1_000

  it('yaş penceresi 120 sn ile 1.800 sn arasına kırpılır; alan yoksa 120 sn', () => {
    expect(liveMaxAgeMs(null)).toBe(s(120))
    expect(liveMaxAgeMs(status())).toBe(s(120))
    expect(liveMaxAgeMs(status(660))).toBe(s(660))
    expect(liveMaxAgeMs(status(30))).toBe(s(120))
    expect(liveMaxAgeMs(status(7_200))).toBe(s(1_800))
    expect(liveMaxAgeMs({ maxAgeS: Number.NaN })).toBe(s(120))
  })

  it('sık veride kural değişmez: ufuklar 10 sn, soluklaşma yok', () => {
    expect(motionPolicy(status())).toBe(NORMAL_MOTION_POLICY)
    expect(motionPolicy(null)).toBe(NORMAL_MOTION_POLICY)
    expect(motionPolicy(status(120))).toBe(NORMAL_MOTION_POLICY)
    expect(NORMAL_MOTION_POLICY).toEqual({
      airborneHorizonMs: MAX_EXTRAPOLATION_MS,
      groundHorizonMs: MAX_EXTRAPOLATION_MS,
      fadeStartMs: s(120),
      maxAgeMs: s(120),
      sparse: false,
    })
    for (const age of [0, s(60), s(120), s(600)]) {
      expect(staleOpacity(age, NORMAL_MOTION_POLICY), String(age)).toBe(1)
    }
  })

  it('seyrek veride havadaki uçak 180 sn ileri taşınır, yerdeki 10 sn; pencere kısaysa pencereye kadar', () => {
    expect(motionPolicy(status(660))).toEqual({
      airborneHorizonMs: SPARSE_MAX_EXTRAPOLATION_MS,
      groundHorizonMs: MAX_EXTRAPOLATION_MS,
      fadeStartMs: s(180),
      maxAgeMs: s(660),
      sparse: true,
    })
    expect(SPARSE_MAX_EXTRAPOLATION_MS).toBe(s(180))
    expect(motionPolicy(status(150))).toMatchObject({
      airborneHorizonMs: s(150),
      fadeStartMs: s(150),
      maxAgeMs: s(150),
      sparse: true,
    })
    // 360 kt ≈ 0,185 km/sn: 180 sn'de 33,3 km; sonrasında simge donar.
    const ac = { lat: 41, lon: 29, gs: 360, trk: 90 }
    const policy = motionPolicy(status(660))
    const at180 = predictPosition(ac, 0, s(180), policy.airborneHorizonMs)
    expect(distanceKm(ac, at180)).toBeCloseTo(33.336, 2)
    expect(predictPosition(ac, 0, s(500), policy.airborneHorizonMs)).toEqual(at180)
  })

  it('soluklaşma: 180 sn’ye kadar opak, 660 sn’de 0,35; 0,05’lik adımlarla iner', () => {
    const policy = motionPolicy(status(660))
    expect(staleOpacity(0, policy)).toBe(1)
    expect(staleOpacity(s(180), policy)).toBe(1)
    expect(staleOpacity(s(420), policy)).toBe(0.65)
    expect(staleOpacity(s(660), policy)).toBe(STALE_MIN_OPACITY)
    expect(staleOpacity(s(1_000), policy)).toBe(STALE_MIN_OPACITY)
    expect(staleOpacity(Number.NaN, policy)).toBe(1)
    let previous = 1
    for (let age = s(180); age <= s(660); age += 1_000) {
      const opacity = staleOpacity(age, policy)
      expect(opacity).toBeLessThanOrEqual(previous)
      expect(Math.abs(opacity / OPACITY_STEP - Math.round(opacity / OPACITY_STEP))).toBeLessThan(
        1e-9,
      )
      previous = opacity
    }
  })
})
