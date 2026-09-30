import { describe, expect, it } from 'vitest'
import {
  coveragePlan,
  EAST_CIRCLE,
  MAX_CIRCLE_NM,
  planCoversPoint,
  PRIMARY_EXTRA_RADIUS_NM,
  WEST_CIRCLE,
  type PlannedCircle,
  type StationInput,
} from './coverage'
import { distanceKm, kmToNm } from './index'

const station = (icao: string, lat: number, lon: number, extra: Partial<StationInput> = {}) => ({
  icao,
  lat,
  lon,
  fetchRadiusNm: 60,
  isPrimary: false,
  ...extra,
})

/** Tohum istasyonlar (CLAUDE.md): IST birincil, SAW, ESB, ADB, AYT. */
const SEED: StationInput[] = [
  station('LTFM', 41.274874, 28.732136, { isPrimary: true }),
  station('LTFJ', 40.898602, 29.3092),
  station('LTAC', 40.128101, 32.995098),
  station('LTBJ', 38.2924, 27.157),
  station('LTAI', 36.898701, 30.800501),
]
/** Batıya sığmayan doğu istasyonları: Van ve Erzurum. */
const VAN = station('LTCI', 38.4682, 43.3323)
const ERZURUM = station('LTCE', 39.9565, 41.1702)

const distanceNm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  kmToNm(distanceKm(a, b))

/** P0 çemberi (ARP, fetchRadius) çemberin içinde mi? */
const containsP0 = (circle: PlannedCircle, s: StationInput) =>
  distanceNm(circle.center, s) + s.fetchRadiusNm <= circle.radiusNm + 1e-9

const byId = (plan: PlannedCircle[], id: string) => {
  const circle = plan.find((c) => c.id === id)
  if (!circle) throw new Error(`circle not in plan: ${id}`)
  return circle
}

describe('coveragePlan', () => {
  it('5 tohum istasyon: tek batı çemberi hepsini kapsar, birincil 40 NM ve Doğu eklenir', () => {
    const plan = coveragePlan(SEED)
    expect(plan.map((c) => c.kind)).toEqual(['west', 'primary', 'east'])
    const west = byId(plan, 'west')
    expect(west.covers).toEqual(['LTAC', 'LTAI', 'LTBJ', 'LTFJ', 'LTFM'])
    expect(west.center).toEqual(WEST_CIRCLE.center)
    expect(west.radiusNm).toBe(250)
    for (const s of SEED) expect(containsP0(west, s)).toBe(true)
    // En uzak nokta AYT: ≈ 167,8 + 60 = 227,8 NM (data-sources.md §1).
    const ayt = SEED[4] as StationInput
    expect(distanceNm(WEST_CIRCLE.center, ayt) + 60).toBeCloseTo(227.8, 0)

    const primary = byId(plan, 'primary')
    expect(primary.center).toEqual({ lat: 41.274874, lon: 28.732136 })
    expect(primary.radiusNm).toBe(PRIMARY_EXTRA_RADIUS_NM)
    expect(primary.primaryIcao).toBe('LTFM')
    expect(primary.covers).toEqual([])

    const east = byId(plan, 'east')
    expect(east.center).toEqual(EAST_CIRCLE.center)
    expect(east.radiusNm).toBe(250)
    expect(east.covers).toEqual([])
  })

  it('istasyon yoksa yalnızca Doğu çemberi', () => {
    expect(coveragePlan([]).map((c) => c.id)).toEqual(['east'])
  })

  it('Doğu çemberi her planda vardır ve sondadır', () => {
    for (const stations of [[], SEED, [VAN], [...SEED, VAN, ERZURUM]]) {
      const plan = coveragePlan(stations)
      expect(plan.at(-1)?.kind).toBe('east')
      expect(plan.filter((c) => c.kind === 'east')).toHaveLength(1)
    }
  })

  it('batıya sığmayan iki istasyon ≤ 250 NM çemberde birleşir', () => {
    const plan = coveragePlan([...SEED, VAN, ERZURUM])
    expect(plan.map((c) => c.id)).toEqual(['west', 'station-LTCE-LTCI', 'primary', 'east'])
    const merged = byId(plan, 'station-LTCE-LTCI')
    expect(merged.kind).toBe('station')
    expect(merged.covers).toEqual(['LTCE', 'LTCI'])
    expect(Number.isInteger(merged.radiusNm)).toBe(true)
    expect(merged.radiusNm).toBeLessThanOrEqual(MAX_CIRCLE_NM)
    expect(containsP0(merged, VAN)).toBe(true)
    expect(containsP0(merged, ERZURUM)).toBe(true)
    // İki P0'ı içeren en küçük çember ≈ (d + 60 + 60) / 2; yuvarlama en fazla 1 NM ekler.
    const minimal = (distanceNm(VAN, ERZURUM) + 120) / 2
    expect(merged.radiusNm).toBeGreaterThanOrEqual(minimal)
    expect(merged.radiusNm).toBeLessThanOrEqual(Math.ceil(minimal) + 1)
    // Erzurum'un P0'ı Doğu çemberinin de içindedir.
    expect(byId(plan, 'east').covers).toEqual(['LTCE'])
  })

  it('birleşemeyen istasyon kendi çemberini alır; yarıçap yukarı yuvarlanır', () => {
    const london = station('EGLL', 51.4706, -0.461941, { fetchRadiusNm: 60.2 })
    const plan = coveragePlan([london, VAN])
    expect(plan.map((c) => c.id)).toEqual(['station-EGLL', 'station-LTCI', 'east'])
    const own = byId(plan, 'station-EGLL')
    expect(own.center).toEqual({ lat: 51.4706, lon: -0.461941 })
    expect(own.radiusNm).toBe(61)
    expect(own.covers).toEqual(['EGLL'])
    expect(byId(plan, 'station-LTCI').radiusNm).toBe(60)
  })

  it('250 NM üstü çekim yarıçapı 250 NM ile sınırlanır; istasyon yine kapsanmış sayılır', () => {
    const plan = coveragePlan([station('LTCI', 38.4682, 43.3323, { fetchRadiusNm: 400 })])
    const own = byId(plan, 'station-LTCI')
    expect(own.radiusNm).toBe(MAX_CIRCLE_NM)
    expect(own.covers).toEqual(['LTCI'])
  })

  it('birincil batı dışında olabilir: kendi istasyon çemberi ve 40 NM birincil çember', () => {
    const plan = coveragePlan([
      ...SEED.map((s) => ({ ...s, isPrimary: false })),
      { ...VAN, isPrimary: true },
    ])
    expect(plan.map((c) => c.id)).toEqual(['west', 'station-LTCI', 'primary', 'east'])
    const primary = byId(plan, 'primary')
    expect(primary.primaryIcao).toBe('LTCI')
    expect(primary.center).toEqual({ lat: VAN.lat, lon: VAN.lon })
  })

  it('deterministik: giriş sırası planı değiştirmez; tekrar eden ICAO yok sayılır', () => {
    const stations = [...SEED, VAN, ERZURUM]
    const reversed = [...stations].reverse()
    // Birincil tek olduğundan sıra değişse de aynı istasyon birincildir.
    expect(coveragePlan(reversed)).toEqual(coveragePlan(stations))
    expect(coveragePlan([...stations, { ...VAN, lat: 0, lon: 0 }])).toEqual(coveragePlan(stations))
  })

  it('bütün yarıçaplar 1..250 arası tamsayıdır', () => {
    const plan = coveragePlan([
      ...SEED,
      VAN,
      ERZURUM,
      station('EGLL', 51.4706, -0.461941, { fetchRadiusNm: 0.2 }),
    ])
    for (const circle of plan) {
      expect(Number.isInteger(circle.radiusNm)).toBe(true)
      expect(circle.radiusNm).toBeGreaterThanOrEqual(1)
      expect(circle.radiusNm).toBeLessThanOrEqual(MAX_CIRCLE_NM)
    }
  })
})

describe('planCoversPoint', () => {
  /** Hakkari Yüksekova (LTCW) ve Van Ferit Melen (LTCI) havalimanı merkezleri (OurAirports). */
  const HAKKARI = { lat: 37.5497, lon: 44.2381 }
  const VAN_ARP = { lat: VAN.lat, lon: VAN.lon }

  it('tohum istasyonlarla Doğu çemberi Van’ı kapsar, Hakkari Yüksekova’yı kapsamaz', () => {
    const plan = coveragePlan(SEED)
    expect(planCoversPoint(plan, VAN_ARP)).toBe(true)
    expect(planCoversPoint(plan, HAKKARI)).toBe(false)
    // Doğu çemberinin 250 NM sınırının yaklaşık 24 NM dışında.
    expect(distanceNm(EAST_CIRCLE.center, HAKKARI)).toBeGreaterThan(270)
    for (const s of SEED) expect(planCoversPoint(plan, s)).toBe(true)
  })

  it('istasyon çemberi eklenince çevresi kapsanır; sınırdaki nokta içeridedir', () => {
    const hakkariStation = station('LTCW', HAKKARI.lat, HAKKARI.lon)
    expect(planCoversPoint(coveragePlan([...SEED, hakkariStation]), HAKKARI)).toBe(true)
    const edge = { center: { lat: 0, lon: 0 }, radiusNm: 60 }
    const plan: PlannedCircle[] = [{ id: 'x', kind: 'station', ...edge, covers: [] }]
    expect(planCoversPoint(plan, { lat: 0, lon: 0 })).toBe(true)
    expect(planCoversPoint(plan, { lat: 1.1, lon: 0 })).toBe(false)
    expect(planCoversPoint([], { lat: 0, lon: 0 })).toBe(false)
  })
})
