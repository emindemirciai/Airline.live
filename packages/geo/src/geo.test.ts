import { describe, expect, it } from 'vitest'
import {
  bearingDifference,
  destinationPoint,
  distanceKm,
  initialBearing,
  kmToNm,
  nmToKm,
  normalizeBearing,
  runwayThreshold,
} from './index'

describe('runwayThreshold', () => {
  const end = { lat: 41.25, lon: 28.72 }
  const arp = { lat: 41.2753, lon: 28.7519 }

  it('kaydırma varsa ucu pist yönünde displaced × 0,3048 m taşır', () => {
    const { point, source } = runwayThreshold(end, 350, 1000, arp)
    expect(source).toBe('displaced_threshold')
    expect(distanceKm(end, point) * 1000).toBeCloseTo(304.8, 3)
    expect(bearingDifference(initialBearing(end, point), 350)).toBeLessThan(0.01)
  })

  it('kaydırma yoksa ya da yön bilinmiyorsa ucun kendisi; uç yoksa havalimanı merkezi', () => {
    expect(runwayThreshold(end, 350, 0, arp)).toEqual({ point: end, source: 'runway_end' })
    expect(runwayThreshold(end, 350, null, arp)).toEqual({ point: end, source: 'runway_end' })
    expect(runwayThreshold(end, null, 500, arp)).toEqual({ point: end, source: 'runway_end' })
    expect(runwayThreshold(null, 350, 500, arp)).toEqual({ point: arp, source: 'arp_fallback' })
  })
})

// OurAirports ARP koordinatları (yaklaşık)
const LTFM = { lat: 41.2753, lon: 28.7519 }
const LTFJ = { lat: 40.8986, lon: 29.3092 }
const LTAI = { lat: 36.8987, lon: 30.8005 }

describe('geo', () => {
  it('IST–SAW mesafesi ≈ 63 km ≈ 34 NM', () => {
    const km = distanceKm(LTFM, LTFJ)
    expect(km).toBeGreaterThan(61)
    expect(km).toBeLessThan(65)
    expect(kmToNm(km)).toBeCloseTo(33.9, 0)
  })

  it('aynı nokta için mesafe 0', () => {
    expect(distanceKm(LTFM, LTFM)).toBe(0)
  })

  it('IST–AYT mesafesi ≈ 520 km', () => {
    expect(distanceKm(LTFM, LTAI)).toBeGreaterThan(500)
    expect(distanceKm(LTFM, LTAI)).toBeLessThan(540)
  })

  it('yön hesabı ana yönlerde doğrudur', () => {
    expect(initialBearing({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(0, 5)
    expect(initialBearing({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(90, 5)
    expect(initialBearing(LTFM, LTFJ)).toBeGreaterThan(120)
    expect(initialBearing(LTFM, LTFJ)).toBeLessThan(140)
  })

  it('hedef noktası ile mesafe/yön tutarlıdır', () => {
    const p = destinationPoint(LTFM, 350, 10)
    expect(distanceKm(LTFM, p)).toBeCloseTo(10, 6)
    expect(initialBearing(LTFM, p)).toBeCloseTo(350, 3)
  })

  it('açı normalizasyonu ve fark', () => {
    expect(normalizeBearing(-10)).toBe(350)
    expect(normalizeBearing(725)).toBe(5)
    expect(bearingDifference(350, 10)).toBe(20)
    expect(bearingDifference(90, 270)).toBe(180)
  })

  it('10 km ≈ 5,4 NM', () => {
    expect(kmToNm(10)).toBeCloseTo(5.4, 1)
    expect(nmToKm(1)).toBe(1.852)
  })
})
