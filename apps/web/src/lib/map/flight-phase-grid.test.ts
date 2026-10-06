import type { LatLon } from '@havayolu/geo'
import type { PublicAircraft } from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { FlightPhaseTracker, type PhaseAirportInput } from './flight-phase'
import { approxKm, lonDelta, PointGrid, type GridPoint } from './flight-phase-grid'

interface Point extends GridPoint {
  id: number
}

const point = (id: number, lat: number, lon: number): Point => ({
  id,
  arp: { lat, lon },
  cosLat: Math.cos((lat * Math.PI) / 180),
})

/** Önceki doğrusal tarama (D-101 öncesi `nearestAirport`), başvuru olarak. */
function linearNearest(points: readonly Point[], p: LatLon): Point | null {
  let best: Point | null = null
  let bestKm = Infinity
  for (const candidate of points) {
    const km = approxKm(p, candidate)
    if (km < bestKm) {
      best = candidate
      bestKm = km
    }
  }
  return best
}

/** Önceki doğrusal ön eleme (`nearbyAirports`), başvuru olarak. */
function linearWithin(points: readonly Point[], p: LatLon, deg: number): Point[] {
  return points.filter(
    (candidate) =>
      Math.abs(p.lat - candidate.arp.lat) <= deg &&
      Math.abs(lonDelta(p.lon, candidate.arp.lon)) * candidate.cosLat <= deg,
  )
}

/** Tohumlu sözde rastgele sayı (mulberry32): test her koşuda aynı kümeleri üretir. */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** [-180, 180) aralığına sarılmış boylam. */
const wrap = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180
const clampLat = (lat: number) => Math.max(-90, Math.min(90, lat))

/**
 * Bir küme. Gerçekçi kümede (`polar: false`) noktalar 4./5. halkaya benzer: kümeler hâlinde (Türkiye
 * çevresi, ENSB 78° K, ±180 kıyısı, Güney Amerika ucu), enlem en çok ±78,5 (`cosMin` ≥ 0,2): ızgara
 * yolu sınanır. Kutup kümesinde 90°'ye yakın noktalar `cosMin`'i sıfıra indirir: doğrusal taramaya
 * geçiş sınanır. İkisinde de tam sayı dereceler (hücre sınırı), birebir aynı konumda kopyalar ve iki
 * noktanın tam ortasındaki sorgular (eşit uzaklık) vardır.
 */
function scenario(rand: () => number, size: number, polar: boolean) {
  const maxLat = polar ? 90 : 78.5
  const centers: LatLon[] = [
    { lat: 39, lon: 32 },
    { lat: 50, lon: 10 },
    { lat: 25, lon: 55 },
    { lat: 76, lon: 15.5 },
    { lat: -50, lon: -68.3 },
    { lat: 62, lon: 179.6 },
    { lat: -17, lon: -179.8 },
    { lat: 0, lon: 0 },
    ...(polar ? [{ lat: 89.5, lon: 0 }] : []),
  ]
  const clamp = (lat: number) => Math.max(-maxLat, Math.min(maxLat, lat))
  const points: Point[] = []
  const add = (lat: number, lon: number) => points.push(point(points.length, clamp(lat), wrap(lon)))
  const centerOf = () => centers[Math.floor(rand() * centers.length)] ?? { lat: 0, lon: 0 }
  for (let i = 0; i < size; i += 1) {
    const kind = rand()
    if (kind < 0.7) {
      const center = centerOf()
      const spread = rand() < 0.5 ? 4 : 24
      add(center.lat + (rand() - 0.5) * spread, center.lon + (rand() - 0.5) * spread)
    } else if (kind < 0.8) {
      // Hücre sınırında: tam sayı dereceler.
      const center = centerOf()
      add(
        Math.round(center.lat + (rand() - 0.5) * 10),
        Math.round(center.lon + (rand() - 0.5) * 10),
      )
    } else if (kind < 0.9 && points.length > 0) {
      // Aynı konumda ikinci kayıt (eşitlikte listede önce gelen seçilir).
      const twin = points[Math.floor(rand() * points.length)]
      if (twin) add(twin.arp.lat, twin.arp.lon)
    } else {
      add(rand() * 2 * maxLat - maxLat, rand() * 360 - 180)
    }
  }
  const queries: LatLon[] = []
  for (let i = 0; i < 60; i += 1) {
    const kind = rand()
    const near = points[Math.floor(rand() * points.length)]
    if (kind < 0.5 && near) {
      queries.push({
        lat: clampLat(near.arp.lat + (rand() - 0.5) * 1.6),
        lon: wrap(near.arp.lon + (rand() - 0.5) * 1.6),
      })
    } else if (kind < 0.62) {
      // ±180 kıyısı.
      queries.push({
        lat: 55 + rand() * 15 - (rand() < 0.5 ? 75 : 0),
        lon: rand() < 0.5 ? 179.9 + rand() * 0.1 : -180 + rand() * 0.1,
      })
    } else if (kind < 0.75 && near) {
      // İki noktanın tam ortası: iki yöne eşit uzaklık.
      const other = points[Math.floor(rand() * points.length)] ?? near
      queries.push({
        lat: (near.arp.lat + other.arp.lat) / 2,
        lon: wrap(near.arp.lon + lonDelta(other.arp.lon, near.arp.lon) / 2),
      })
    } else if (kind < 0.9) {
      const center = centerOf()
      queries.push({
        lat: clampLat(center.lat + (rand() - 0.5) * 20),
        lon: wrap(center.lon + (rand() - 0.5) * 20),
      })
    } else {
      queries.push({ lat: rand() * 178 - 89, lon: rand() * 360 - 180 })
    }
  }
  return { points, queries }
}

describe('PointGrid: doğrusal taramayla aynı sonuç (özellik testi, D-101)', () => {
  it('rastgele kümeler: en yakın nokta ve ön eleme birebir aynı (aynı nesne, aynı sıra)', () => {
    let compared = 0
    let ties = 0
    for (let round = 0; round < 40; round += 1) {
      const rand = random(1_000 + round)
      const size = round === 0 ? 0 : round === 1 ? 1 : Math.floor(rand() * 1_400) + 2
      // Son on tur kutup kümesi (doğrusal taramaya geçiş).
      const { points, queries } = scenario(rand, size, round >= 30)
      const grid = new PointGrid(points)
      for (const p of queries) {
        const expected = linearNearest(points, p)
        expect(grid.nearest(p), `${round} ${p.lat},${p.lon}`).toBe(expected)
        for (const deg of [0.35, 1.5, 7]) {
          expect(grid.within(p, deg), `${round} ${p.lat},${p.lon} ${deg}`).toEqual(
            linearWithin(points, p, deg),
          )
        }
        if (expected) {
          const bestKm = approxKm(p, expected)
          if (points.some((q) => q !== expected && approxKm(p, q) === bestKm)) ties += 1
        }
        compared += 1
      }
    }
    expect(compared).toBe(40 * 60)
    // Kopyalar sayesinde eşitlik gerçekten sınanır.
    expect(ties).toBeGreaterThan(5)
  })

  it('eşit uzaklıktaki iki nokta: listede önce gelen; 180. boylamı geçen komşu', () => {
    const points = [point(0, 10, 21), point(1, 10, 19), point(2, 10, 21)]
    const grid = new PointGrid(points)
    expect(grid.nearest({ lat: 10, lon: 20 })).toBe(points[0])
    const across = [point(0, 0, -150), point(1, 0.3, 179.95), point(2, 0, 170)]
    const wrapped = new PointGrid(across)
    expect(wrapped.nearest({ lat: 0.2, lon: -179.9 })).toBe(across[1])
    expect(wrapped.within({ lat: 0.2, lon: -179.9 }, 0.35)).toEqual([across[1]])
  })

  it('boş ızgara ve sayı olmayan konum: sonuç yok', () => {
    expect(new PointGrid<Point>([]).nearest({ lat: 41, lon: 29 })).toBeNull()
    expect(new PointGrid<Point>([]).within({ lat: 41, lon: 29 }, 0.35)).toEqual([])
    const grid = new PointGrid([point(0, 41, 29)])
    expect(grid.nearest({ lat: Number.NaN, lon: 29 })).toBeNull()
    expect(grid.within({ lat: 41, lon: Number.POSITIVE_INFINITY }, 0.35)).toEqual([])
  })
})

describe('FlightPhaseTracker ızgarayla', () => {
  const airport = (icao: string, lat: number, lon: number): PhaseAirportInput => ({
    icao,
    iata: icao.slice(1),
    lat,
    lon,
    elevationFt: 0,
    scheduled: true,
    runways: [],
  })
  const aircraft = (hex: string, lat: number, lon: number): PublicAircraft =>
    ({
      hex,
      t: 1_000,
      lat,
      lon,
      alt: 35_000,
      gnd: false,
      trk: 90,
      vr: 0,
    }) as PublicAircraft

  it('yolda: en yakın havalimanı 180. boylamın öbür yanında da bulunur; liste değişince yeniden', () => {
    const tracker = new FlightPhaseTracker()
    tracker.setAirports([
      airport('PADK', 51.88, -176.65),
      airport('UHMA', 64.73, 177.74),
      airport('UHPP', 53.17, 158.45),
    ])
    tracker.observe([aircraft('aaaaaa', 60, -179.5), aircraft('bbbbbb', 52, -177)])
    expect(tracker.get('aaaaaa')).toMatchObject({ phase: 'enRoute', airport: { icao: 'UHMA' } })
    expect(tracker.get('bbbbbb')).toMatchObject({ phase: 'enRoute', airport: { icao: 'PADK' } })
    tracker.setAirports([airport('LTFM', 41.26, 28.73)])
    tracker.observe([aircraft('aaaaaa', 60, -179.5)])
    expect(tracker.get('aaaaaa')).toMatchObject({ airport: { icao: 'LTFM' } })
  })
})
