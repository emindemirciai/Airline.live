import { describe, expect, it } from 'vitest'
import {
  clipRing,
  latitudeOf,
  mercatorX,
  mercatorY,
  ProjectedShape,
  pxPerKm,
  ringAreaKm2,
  ringContains,
  segmentTouchesRect,
  shiftRingWest,
  simplifyArc,
  unitsPerKm,
  unwrapLongitudes,
  WORLD_SIZE,
  type LonLat,
  type MultiPolygon,
} from './geometry'

/** Boylam/enlem dikdörtgeni → halka (saat yönünün tersine). */
const box = (west: number, south: number, east: number, north: number): LonLat[] => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
]

/** İzdüşümde boylam/enlem dikdörtgeni. */
const rect = (west: number, south: number, east: number, north: number) =>
  [mercatorX(west), mercatorY(north), mercatorX(east), mercatorY(south)] as const

const inside = (
  shape: ProjectedShape,
  west: number,
  south: number,
  east: number,
  north: number,
) => {
  const [x1, y1, x2, y2] = rect(west, south, east, north)
  return shape.containsRect(x1, y1, x2, y2, (x1 + x2) / 2, (y1 + y2) / 2)
}

describe('Web Mercator (512 birimlik dünya)', () => {
  it('izdüşüm değerleri: 0°/0° ortada, 180° kenarda, 85,05° üstte', () => {
    expect(WORLD_SIZE).toBe(512)
    expect(mercatorX(0)).toBe(256)
    expect(mercatorX(-180)).toBe(0)
    expect(mercatorX(180)).toBe(512)
    expect(mercatorY(0)).toBeCloseTo(256, 9)
    expect(mercatorY(85.0511287798)).toBeCloseTo(0, 6)
    expect(latitudeOf(mercatorY(39.93))).toBeCloseTo(39.93, 9)
  })

  it('ölçek: ekvatorda 1 km 512 / 40.075 birim; 60°’de iki katı; z’de 2^z ile', () => {
    expect(unitsPerKm(0)).toBeCloseTo(512 / 40075.016686, 12)
    expect(unitsPerKm(60) / unitsPerKm(0)).toBeCloseTo(2, 9)
    expect(pxPerKm(40, 7)).toBeCloseTo(unitsPerKm(40) * 128, 12)
    // z7, 40°: ~2,1 px/km.
    expect(pxPerKm(40, 7)).toBeCloseTo(2.13, 2)
  })
})

describe('simplifyArc (Douglas–Peucker)', () => {
  it('uç noktalar kalır; tolerans içindeki noktalar düşer; her düşen nokta sadeleşmiş yaya toleranstan yakın', () => {
    const arc: LonLat[] = []
    for (let i = 0; i <= 200; i++) arc.push([30 + i * 0.01, 40 + 0.004 * Math.sin(i / 3)])
    const simple = simplifyArc(arc, 0.5)
    expect(simple[0]).toEqual(arc[0])
    expect(simple.at(-1)).toEqual(arc.at(-1))
    expect(simple.length).toBeLessThan(arc.length)
    const shape = new ProjectedShape([[simple]])
    for (const [lon, lat] of arc) {
      expect(shape.distanceToBoundaryKm(lon, lat)).toBeLessThanOrEqual(0.5 + 1e-9)
    }
    // Sıfır tolerans ya da iki nokta: değişmez.
    expect(simplifyArc(arc, 0)).toEqual(arc)
    expect(simplifyArc(arc.slice(0, 2), 5)).toEqual(arc.slice(0, 2))
  })

  it('kapalı yay en uzak noktasından bölünür; büyük toleransta da üçgen kalır (küçük delik kaybolmaz)', () => {
    const ring = [...box(10, 10, 11, 11), [10, 10] as LonLat]
    const simple = simplifyArc(ring, 1000)
    expect(simple).toHaveLength(4)
    expect(simple[0]).toEqual([10, 10])
    expect(simple[2]).toEqual([11, 11])
    expect(simple.at(-1)).toEqual([10, 10])
    expect(new Set(simple.slice(0, -1).map((p) => p.join())).size).toBe(3)
  })
})

describe('clipRing, ringAreaKm2, ringContains', () => {
  it('dikdörtgene kırpma: tamamen içerideki halka değişmez, dışarıdaki düşer, kesişen kırpılır', () => {
    const roi = [0, 0, 10, 10] as const
    expect(clipRing(box(1, 1, 2, 2), roi)).toEqual(box(1, 1, 2, 2))
    expect(clipRing(box(20, 20, 21, 21), roi)).toBeNull()
    const clipped = clipRing(box(5, 5, 15, 15), roi) ?? []
    const xs = clipped.map((p) => p[0])
    const ys = clipped.map((p) => p[1])
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([
      5, 10, 5, 10,
    ])
  })

  it('alan: ekvatorda 1° × 1° ≈ 12.392 km²; içerme çift-tek kuralıyla', () => {
    expect(ringAreaKm2(box(0, -0.5, 1, 0.5))).toBeCloseTo(12392, -1)
    expect(ringContains(box(0, 0, 1, 1), 0.5, 0.5)).toBe(true)
    expect(ringContains(box(0, 0, 1, 1), 1.5, 0.5)).toBe(false)
  })

  it('180. meridyen: halka sürekli kılınır, −180’e kaydırılır; kırpınca 180° D’nun doğusu düşer', () => {
    // Batıdan doğuya: 170° D'dan 180°'yi geçip −170'e (190° D), geri dönüp başlangıca.
    const spherical: LonLat[] = [
      [170, 60],
      [179, 60],
      [-179, 61],
      [-170, 62],
      [-170, 66],
      [-179, 66],
      [179, 65],
      [170, 65],
    ]
    const unwrapped = unwrapLongitudes(spherical)
    expect(unwrapped.map(([lon]) => lon)).toEqual([170, 179, 181, 190, 190, 181, 179, 170])
    expect(unwrapped.map(([, lat]) => lat)).toEqual(spherical.map(([, lat]) => lat))
    // Aynı halka Çukotka'dan başlarsa batıya, −360'ın ötesine açılır; kaydırma aynı yere getirir.
    const rotated = unwrapLongitudes([...spherical.slice(2), ...spherical.slice(0, 2)])
    expect(rotated.map(([lon]) => lon)).toEqual([-179, -170, -170, -179, -181, -190, -190, -181])
    expect(shiftRingWest(rotated, -180).map(([lon]) => lon)).toEqual([
      181, 190, 190, 181, 179, 170, 170, 179,
    ])
    expect(shiftRingWest(unwrapped, -180)).toEqual(unwrapped)
    // Delik dış halkanın kopyasına: batı ucu 170 ise [170, 530).
    expect(shiftRingWest(box(-178, 62, -175, 63), 170).map(([lon]) => lon)).toEqual([
      182, 185, 185, 182,
    ])
    const clipped = clipRing(shiftRingWest(unwrapped, -180), [-20, 8, 180, 72]) ?? []
    expect(Math.max(...clipped.map(([lon]) => lon))).toBe(180)
    expect(Math.min(...clipped.map(([lon]) => lon))).toBe(170)
    // Sürekli kılınmamış halka 180 ile −170 arasında bütün haritayı kesen kenarlar bırakırdı.
    const raw = clipRing(spherical, [-20, 8, 180, 72]) ?? []
    expect(Math.min(...raw.map(([lon]) => lon))).toBe(-20)
  })

  it('Liang–Barsky: içeriden geçen, kenara değen ve dışarıda kalan parça', () => {
    expect(segmentTouchesRect(-1, 0.5, 2, 0.5, 0, 0, 1, 1)).toBe(true)
    expect(segmentTouchesRect(-1, 1, 2, 1, 0, 0, 1, 1)).toBe(true)
    expect(segmentTouchesRect(-1, 1.01, 2, 1.01, 0, 0, 1, 1)).toBe(false)
    expect(segmentTouchesRect(0.2, 0.2, 0.3, 0.3, 0, 0, 1, 1)).toBe(true)
    expect(segmentTouchesRect(2, 2, 3, 3, 0, 0, 1, 1)).toBe(false)
  })
})

describe('ProjectedShape.containsRect', () => {
  // L biçimli (içbükey) ülke: 0–10 × 0–2 ve 0–2 × 0–10.
  const concave: MultiPolygon = [
    [
      [
        [0, 0],
        [10, 0],
        [10, 2],
        [2, 2],
        [2, 10],
        [0, 10],
      ],
    ],
  ]
  // Delikli ülke: 0–10 × 0–10, ortada 4–6 × 4–6 göl.
  const holed: MultiPolygon = [[box(0, 0, 10, 10), box(4, 4, 6, 6)]]
  // İki ada: 0–4 ve 6–10, arada deniz.
  const islands: MultiPolygon = [[box(0, 0, 4, 4)], [box(6, 0, 10, 4)]]

  it('içbükey çokgende kolun içindeki dikdörtgen içeride; köşeyi aşan dışarıda', () => {
    const shape = new ProjectedShape(concave)
    expect(inside(shape, 4, 0.5, 9, 1.5)).toBe(true)
    expect(inside(shape, 0.5, 4, 1.5, 9)).toBe(true)
    expect(inside(shape, 1, 1, 3, 3)).toBe(false)
    expect(shape.contains(mercatorX(5), mercatorY(5))).toBe(false)
    expect(shape.contains(mercatorX(1), mercatorY(5))).toBe(true)
  })

  it('delik dışarıdır: göle giren dikdörtgen sığmaz; gölün yanındaki sığar; göldeki nokta dışarıda', () => {
    const shape = new ProjectedShape(holed)
    expect(inside(shape, 1, 1, 3, 3)).toBe(true)
    expect(inside(shape, 3, 3, 5, 5)).toBe(false)
    expect(shape.contains(mercatorX(5), mercatorY(5))).toBe(false)
    expect(inside(shape, 4.5, 4.5, 5.5, 5.5)).toBe(false)
  })

  it('iki ada arasındaki denizi aşan dikdörtgen sığmaz', () => {
    const shape = new ProjectedShape(islands)
    expect(inside(shape, 1, 1, 3, 3)).toBe(true)
    expect(inside(shape, 7, 1, 9, 3)).toBe(true)
    expect(inside(shape, 3, 1, 7, 3)).toBe(false)
  })

  it('kenara değen dikdörtgen dışarıda sayılır; bir iç noktayla verilen merkez yeniden sınanmaz', () => {
    const shape = new ProjectedShape(holed)
    expect(inside(shape, 0, 1, 2, 3)).toBe(false)
    expect(inside(shape, 0.01, 1, 2, 3)).toBe(true)
    const [x1, y1, x2, y2] = rect(1, 1, 3, 3)
    expect(shape.containsRect(x1, y1, x2, y2, 0, 0, true)).toBe(true)
    expect(shape.containsRect(x1, y1, x2, y2, 0, 0, false)).toBe(false)
  })

  it('kenara uzaklık: kare kenarından km ve izdüşüm birimi (görsel merkez, D-099)', () => {
    const shape = new ProjectedShape([[box(0, 0, 1, 1)]])
    // Enlem 0,5'te batı kenarına 0,25° (≈ 27,8 km); izdüşümde 0,25 / 360 × 512 birim.
    expect(shape.distanceToBoundaryKm(0.25, 0.5)).toBeCloseTo((0.25 * 40075.016686) / 360, 0)
    expect(shape.distanceToBoundary(0.25, 0.5)).toBeCloseTo((0.25 / 360) * 512, 6)
    // 60° enleminde aynı km haritada iki kat uzundur: uzaklık izdüşümde ölçülür.
    const north = new ProjectedShape([[box(0, 59.5, 1, 60.5)]])
    expect(north.distanceToBoundary(0.25, 60)).toBeCloseTo((0.25 / 360) * 512, 3)
  })
})
