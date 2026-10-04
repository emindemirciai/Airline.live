import { describe, expect, it } from 'vitest'
import {
  alongTrackKm,
  bearingDifference,
  circleContainsCircle,
  circleContainsPoint,
  crossTrackKm,
  destinationPoint,
  distanceKm,
  distanceNm,
  fpmToMpm,
  ftToM,
  initialBearing,
  kmhToKt,
  kmToNm,
  ktToKmh,
  mToFt,
  nmToKm,
  normalizeBearing,
  runwayThreshold,
  type Circle,
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

describe('birim dönüşümleri', () => {
  it('kt ↔ km/sa', () => {
    expect(ktToKmh(100)).toBeCloseTo(185.2, 10)
    expect(ktToKmh(233)).toBeCloseTo(431.516, 10)
    expect(kmhToKt(185.2)).toBeCloseTo(100, 10)
    expect(kmhToKt(ktToKmh(451))).toBeCloseTo(451, 10)
    expect(ktToKmh(0)).toBe(0)
  })

  it('ft/dk → m/dk işareti korur', () => {
    expect(fpmToMpm(1000)).toBeCloseTo(304.8, 10)
    expect(fpmToMpm(-1235)).toBeCloseTo(-376.428, 10)
    expect(fpmToMpm(0)).toBe(0)
  })

  it('m ↔ ft', () => {
    expect(ftToM(1000)).toBeCloseTo(304.8, 6)
    expect(mToFt(304.8)).toBeCloseTo(1000, 6)
  })
})

describe('crossTrackKm ve alongTrackKm (pist hizası)', () => {
  const origin = { lat: 41, lon: 29 }

  it('kuzeye giden hattın 1 km doğusundaki nokta: yanal +1 km, boyuna ≈ 0', () => {
    const p = destinationPoint(origin, 90, 1)
    expect(crossTrackKm(p, origin, 0)).toBeCloseTo(1, 3)
    expect(alongTrackKm(p, origin, 0)).toBeCloseTo(0, 3)
    // Batıdaki nokta solda: işaret eksi.
    expect(crossTrackKm(destinationPoint(origin, 270, 1), origin, 0)).toBeCloseTo(-1, 3)
  })

  it('hattın gerisindeki nokta eksi, ilerisindeki artı boyuna uzaklık verir', () => {
    expect(alongTrackKm(destinationPoint(origin, 180, 5), origin, 0)).toBeCloseTo(-5, 3)
    expect(crossTrackKm(destinationPoint(origin, 180, 5), origin, 0)).toBeCloseTo(0, 6)
    const ahead = destinationPoint(destinationPoint(origin, 0, 3), 90, 1)
    expect(alongTrackKm(ahead, origin, 0)).toBeCloseTo(3, 2)
    expect(crossTrackKm(ahead, origin, 0)).toBeCloseTo(1, 2)
  })

  it('pist eşiğinden önce son yaklaşmada: boyuna eksi, yanal sıfıra yakın (LTFM 35L)', () => {
    // OurAirports runways.csv: 35L eşiği ve karşı ucu (tools/src/scenarios/airports.ts).
    const threshold = { lat: 41.26190185546875, lon: 28.725299835205078 }
    const farEnd = { lat: 41.29880142211914, lon: 28.72450065612793 }
    const bearing = initialBearing(threshold, farEnd)
    const onFinal = destinationPoint(threshold, bearing + 180, 8)
    expect(alongTrackKm(onFinal, threshold, bearing)).toBeCloseTo(-8, 3)
    expect(Math.abs(crossTrackKm(onFinal, threshold, bearing))).toBeLessThan(0.001)
    expect(alongTrackKm(farEnd, threshold, bearing)).toBeCloseTo(distanceKm(threshold, farEnd), 6)
  })

  it('aynı nokta sıfırdır; yön [0, 360) dışından da verilebilir', () => {
    expect(crossTrackKm(origin, origin, 45)).toBe(0)
    expect(alongTrackKm(origin, origin, 45)).toBe(0)
    const p = destinationPoint(origin, 90, 1)
    expect(crossTrackKm(p, origin, 360)).toBeCloseTo(crossTrackKm(p, origin, 0), 9)
    expect(alongTrackKm(p, origin, -360)).toBeCloseTo(alongTrackKm(p, origin, 0), 9)
  })

  it('180. boylamı geçen hatta da doğrudur', () => {
    const east = { lat: 0, lon: 179.99 }
    const p = destinationPoint(east, 90, 10)
    expect(p.lon).toBeLessThan(0)
    expect(alongTrackKm(p, east, 90)).toBeCloseTo(10, 6)
    expect(crossTrackKm(p, east, 90)).toBeCloseTo(0, 6)
  })
})

describe('distanceNm', () => {
  it('km mesafesinin NM karşılığıdır ve simetriktir', () => {
    expect(distanceNm(LTFM, LTFJ)).toBeCloseTo(kmToNm(distanceKm(LTFM, LTFJ)), 12)
    expect(distanceNm(LTFM, LTFJ)).toBeCloseTo(distanceNm(LTFJ, LTFM), 12)
    expect(distanceNm(LTFM, LTFM)).toBe(0)
  })

  it('ekvatorda 1 derece boylam ≈ 60 NM', () => {
    expect(distanceNm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(60.04, 1)
  })
})

describe('çember içerme', () => {
  const center = { lat: 41.274874, lon: 28.732136 }
  const circle: Circle = { center, radiusNm: 40 }
  const at = (bearing: number, nm: number) => destinationPoint(center, bearing, nmToKm(nm))

  it('merkez ve içteki noktalar içeride, dıştakiler dışarıda', () => {
    expect(circleContainsPoint(circle, center)).toBe(true)
    expect(circleContainsPoint(circle, at(90, 39.9))).toBe(true)
    expect(circleContainsPoint(circle, at(270, 40.01))).toBe(false)
    expect(circleContainsPoint(circle, LTAI)).toBe(false)
  })

  it('sınırdaki nokta (kayan nokta hatasıyla) içeride sayılır', () => {
    for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
      expect(circleContainsPoint(circle, at(bearing, 40))).toBe(true)
    }
  })

  it('sıfır yarıçaplı çember yalnızca merkezini içerir', () => {
    const point: Circle = { center, radiusNm: 0 }
    expect(circleContainsPoint(point, center)).toBe(true)
    expect(circleContainsPoint(point, at(0, 0.001))).toBe(false)
  })

  it('iç çember: aynı çember, eş merkezli küçük çember ve içten teğet çember', () => {
    expect(circleContainsCircle(circle, circle)).toBe(true)
    expect(circleContainsCircle(circle, { center, radiusNm: 10 })).toBe(true)
    expect(circleContainsCircle(circle, { center: at(45, 15), radiusNm: 25 })).toBe(true)
  })

  it('taşan, kesişen, ayrık ve daha büyük çember içeride değildir', () => {
    expect(circleContainsCircle(circle, { center: at(45, 15), radiusNm: 25.01 })).toBe(false)
    expect(circleContainsCircle(circle, { center: at(180, 50), radiusNm: 20 })).toBe(false)
    expect(circleContainsCircle(circle, { center: LTAI, radiusNm: 1 })).toBe(false)
    expect(circleContainsCircle(circle, { center, radiusNm: 40.01 })).toBe(false)
    expect(circleContainsCircle({ center, radiusNm: 10 }, circle)).toBe(false)
  })

  it("batı çemberi (39,5 / 29,5; 250 NM) beş tohum istasyonun 60 NM P0 çemberini içerir, Doğu'dakini değil", () => {
    const west: Circle = { center: { lat: 39.5, lon: 29.5 }, radiusNm: 250 }
    const seeds = [
      { lat: 41.274874, lon: 28.732136 },
      { lat: 40.898602, lon: 29.3092 },
      { lat: 40.128101, lon: 32.995098 },
      { lat: 38.2924, lon: 27.157 },
      { lat: 36.898701, lon: 30.800501 },
    ]
    for (const station of seeds) {
      expect(circleContainsCircle(west, { center: station, radiusNm: 60 })).toBe(true)
    }
    // Van (LTCI) batı çemberinin dışında kalır.
    const van = { lat: 38.468201, lon: 43.3323 }
    expect(circleContainsPoint(west, van)).toBe(false)
    expect(circleContainsCircle(west, { center: van, radiusNm: 60 })).toBe(false)
  })
})
