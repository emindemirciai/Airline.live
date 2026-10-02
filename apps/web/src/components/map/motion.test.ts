import type { Airport } from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { BLEND_MS, MAX_EXTRAPOLATION_MS, predictPosition } from '../../lib/live/interpolate'
import type { TrackedAircraft, TrailPoint } from '../../lib/live/store'
import {
  MIN_UPLOAD_SHIFT_PX,
  MotionTracker,
  aircraftCollection,
  airportCollection,
  pixelsPerDegree,
  screenShiftPx,
  trailCollection,
} from './motion'

function aircraft(overrides: Partial<TrackedAircraft> = {}): TrackedAircraft {
  return {
    hex: '4bb26c',
    lat: 41,
    lon: 29,
    alt: 11_000,
    gnd: false,
    gs: 450,
    trk: 90,
    vr: 0,
    cs: 'THY974',
    fn: { airline: 'TK', number: '974' },
    reg: 'TC-JJA',
    type: 'B77W',
    cat: 'A5',
    sq: '1000',
    src: 'adsbLol',
    psrc: 'adsb_icao',
    t: 1_000,
    receivedAt: 10_000,
    sampledAt: 10_000,
    ...overrides,
  }
}

describe('MotionTracker', () => {
  it('ilk görüşte tahmini konumu doğrudan gösterir', () => {
    const motion = new MotionTracker()
    const ac = aircraft()
    expect(motion.update([ac], 12_000)).toBe(true)
    expect(motion.position(ac.hex)).toEqual(predictPosition(ac, ac.sampledAt, 12_000))
  })

  it('tahmin örneğin alındığı andan yapılır: eski örnek en fazla 10 sn ileri taşınır', () => {
    const motion = new MotionTracker()
    // 100 sn önce alınmış örnek, istemciye şimdi ulaştı (sinyali kesilen uçak).
    const stale = aircraft({ receivedAt: 200_000, sampledAt: 100_000 })
    motion.update([stale], 200_000)
    expect(motion.position(stale.hex)).toEqual(
      predictPosition(stale, 100_000, 100_000 + MAX_EXTRAPOLATION_MS),
    )
    motion.update([stale], 205_000)
    expect(motion.position(stale.hex)).toEqual(
      predictPosition(stale, 100_000, 100_000 + MAX_EXTRAPOLATION_MS),
    )
  })

  it('örnek zamanı tahmini düzelince simge sıçramaz, 1 sn içinde yeni yere geçer', () => {
    const motion = new MotionTracker()
    motion.update([aircraft()], 11_000)
    const before = motion.position('4bb26c')
    const refined = aircraft({ sampledAt: 5_000 })
    motion.update([refined], 11_000)
    expect(motion.position('4bb26c')).toEqual(before)
    motion.update([refined], 11_000 + BLEND_MS)
    expect(motion.position('4bb26c')).toEqual(predictPosition(refined, 5_000, 11_000 + BLEND_MS))
  })

  it('hareket etmeyen uçakta konum değişmez, değişiklik bildirilmez', () => {
    const motion = new MotionTracker()
    const ac = aircraft({ gs: 0 })
    motion.update([ac], 11_000)
    expect(motion.update([ac], 11_500)).toBe(false)
    expect(motion.position(ac.hex)).toEqual({ lat: 41, lon: 29 })
  })

  it('yeni örnekte gösterilen konumdan yeni tahmine 1 sn içinde geçer', () => {
    const motion = new MotionTracker()
    const first = aircraft({ gs: 0 })
    motion.update([first], 11_000)
    const next = aircraft({ gs: 0, lat: 41.01, t: 2_000, receivedAt: 12_000 })
    motion.update([next], 12_000)
    expect(motion.position(next.hex)).toEqual({ lat: 41, lon: 29 })
    motion.update([next], 12_000 + BLEND_MS / 2)
    expect(motion.position(next.hex)?.lat).toBeCloseTo(41.005, 9)
    motion.update([next], 12_000 + BLEND_MS)
    expect(motion.position(next.hex)).toEqual({ lat: 41.01, lon: 29 })
  })

  it('çok uzağa düşen örnekte geçiş yapmaz', () => {
    const motion = new MotionTracker()
    motion.update([aircraft({ gs: 0 })], 11_000)
    const far = aircraft({ gs: 0, lat: 42, t: 90_000, receivedAt: 100_000 })
    motion.update([far], 100_000)
    expect(motion.position(far.hex)).toEqual({ lat: 42, lon: 29 })
  })

  it('listeden düşen uçağın durumu atılır', () => {
    const motion = new MotionTracker()
    motion.update([aircraft(), aircraft({ hex: 'abcdef' })], 11_000)
    expect(motion.update([aircraft()], 11_066)).toBe(true)
    expect(motion.position('abcdef')).toBeUndefined()
  })

  it('yalnızca hareket eden uçakta küme değişmiş sayılmaz; kayma ekran pikseliyle ölçülür', () => {
    const motion = new MotionTracker()
    const ac = aircraft()
    motion.update([ac], 10_000)
    // Henüz yüklenmemiş simge: kayma sonsuz (ilk yükleme her zaman yapılır).
    expect(motion.largestShiftPx(pixelsPerDegree(6))).toBe(Infinity)
    motion.commit()
    expect(motion.largestShiftPx(pixelsPerDegree(6))).toBe(0)

    // 450 kt ≈ 231 m/sn; 66 ms'de ~15 m. z6'da bu bir pikselin çok altındadır, yükleme atlanır.
    expect(motion.update([ac], 10_066)).toBe(false)
    expect(motion.largestShiftPx(pixelsPerDegree(6))).toBeLessThan(MIN_UPLOAD_SHIFT_PX)
    // z14'te aynı kayma birkaç piksel eder.
    expect(motion.largestShiftPx(pixelsPerDegree(14))).toBeGreaterThan(MIN_UPLOAD_SHIFT_PX)
    // Birikir: z6'da ~0,25 px/sn; 3 sn sonra yarım pikseli geçer.
    motion.update([ac], 11_000)
    expect(motion.largestShiftPx(pixelsPerDegree(6))).toBeLessThan(MIN_UPLOAD_SHIFT_PX)
    motion.update([ac], 13_000)
    expect(motion.largestShiftPx(pixelsPerDegree(6))).toBeGreaterThan(MIN_UPLOAD_SHIFT_PX)
    motion.commit()
    expect(motion.largestShiftPx(pixelsPerDegree(6))).toBe(0)
  })
})

describe('ekran ölçüsü', () => {
  it('yakınlaştırma 0’da dünya 512 px; her düzey iki katı', () => {
    expect(pixelsPerDegree(0)).toBeCloseTo(512 / 360, 12)
    expect(pixelsPerDegree(3)).toBeCloseTo((512 * 8) / 360, 12)
  })

  it('Mercator: aynı enlem farkı kuzeyde daha uzun görünür', () => {
    const scale = pixelsPerDegree(10)
    const east = screenShiftPx({ lat: 0, lon: 0 }, { lat: 0, lon: 0.001 }, scale)
    expect(east).toBeCloseTo(0.001 * scale, 9)
    const northAtEquator = screenShiftPx({ lat: 0, lon: 0 }, { lat: 0.001, lon: 0 }, scale)
    const northAt60 = screenShiftPx({ lat: 60, lon: 0 }, { lat: 60.001, lon: 0 }, scale)
    expect(northAt60 / northAtEquator).toBeCloseTo(2, 2)
  })
})

describe('aircraftCollection', () => {
  it('katman sözleşmesindeki özellikleri kurar: ikon, yön, sıralama', () => {
    const motion = new MotionTracker()
    const thy = aircraft()
    const other = aircraft({
      hex: '3c6444',
      cs: 'DLH1TK',
      fn: { airline: 'LH', number: '1' },
      cat: 'A3',
      trk: -30,
    })
    const unknown = aircraft({
      hex: '~a1b2c3',
      cs: null,
      fn: null,
      cat: null,
      type: null,
      trk: null,
    })
    motion.update([thy, other, unknown], 10_000)
    const data = aircraftCollection([thy, other, unknown], motion, '3c6444')
    expect(data.type).toBe('FeatureCollection')
    expect(data.features.map((f) => f.properties)).toEqual([
      { hex: '4bb26c', icon: 'hy-ac-heavy-thy', trk: 90, sort: 1 },
      { hex: '3c6444', icon: 'hy-ac-jet-selected', trk: 330, sort: 2 },
      { hex: '~a1b2c3', icon: 'hy-ac-unknown-other', trk: 0, sort: 0 },
    ])
    expect(data.features[0]?.geometry).toEqual({ type: 'Point', coordinates: [29, 41] })
  })

  it('gösterim konumu yoksa örneğin konumunu kullanır', () => {
    const data = aircraftCollection([aircraft()], new MotionTracker(), null)
    expect(data.features[0]?.geometry.coordinates).toEqual([29, 41])
  })
})

describe('trailCollection', () => {
  const point = (lat: number, gnd: boolean): TrailPoint => ({ lat, lon: 29, gnd, t: lat })

  it('iz yoksa ya da tek noktaysa çizgi yoktur', () => {
    expect(trailCollection([], null).features).toEqual([])
    expect(trailCollection([point(41, false)], null).features).toEqual([])
  })

  it('havadaki izin sonuna simgenin şu anki yerini ekler', () => {
    const data = trailCollection([point(41, false), point(41.1, false)], {
      lat: 41.15,
      lon: 29,
      gnd: false,
    })
    expect(data.features).toEqual([
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [29, 41],
            [29, 41.1],
            [29, 41.15],
          ],
        },
        properties: { gnd: false },
      },
    ])
  })

  it('hava ve yer bölümlerini ortak noktayla ayırır; parça bitiş noktasının durumunu alır', () => {
    const data = trailCollection(
      [point(41, false), point(41.1, false), point(41.2, true), point(41.3, true)],
      { lat: 41.3, lon: 29, gnd: true },
    )
    expect(data.features.map((f) => [f.properties.gnd, f.geometry.coordinates])).toEqual([
      [
        false,
        [
          [29, 41],
          [29, 41.1],
        ],
      ],
      [
        true,
        [
          [29, 41.1],
          [29, 41.2],
          [29, 41.3],
        ],
      ],
    ])
  })
})

describe('airportCollection', () => {
  it('her havalimanı IATA ve ICAO özellikli bir Point olur', () => {
    const ist: Airport = {
      icao: 'LTFM',
      iata: 'IST',
      name: 'İstanbul Havalimanı',
      city: 'İstanbul',
      lat: 41.26,
      lon: 28.74,
      elevationFt: 325,
      type: 'large_airport',
      scheduled: true,
      country: 'TR',
      ring: 0,
      distanceToTrKm: null,
    }
    expect(airportCollection([ist])).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [28.74, 41.26] },
          properties: { icao: 'LTFM', iata: 'IST', name: 'İstanbul Havalimanı' },
        },
      ],
    })
  })
})
