import { distanceKm, initialBearing } from '@havayolu/geo'
import { describe, expect, it } from 'vitest'
import { blend, MAX_EXTRAPOLATION_MS, predictPosition } from './interpolate'

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
