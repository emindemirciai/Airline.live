import type { Bbox } from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { CELL_DEG, SHRINK_FACTOR, SubscriptionPlanner, subscriptionBox } from './subscription'

/** Sunucunun hücre aralığı (apps/api/src/live/ws-protocol.ts `cellRange`). */
const cellRange = (b: Bbox) => ({
  lat0: Math.floor(b.minLat / CELL_DEG),
  lat1: Math.floor(b.maxLat / CELL_DEG),
  lon0: Math.floor(b.minLon / CELL_DEG),
  lon1: Math.floor(b.maxLon / CELL_DEG),
})

/** z10 civarı bir görünüm: ~0,7° × 0,5°. */
const view = (lon: number, lat: number): Bbox => ({
  minLon: lon - 0.35,
  maxLon: lon + 0.35,
  minLat: lat - 0.25,
  maxLat: lat + 0.25,
})

describe('subscriptionBox', () => {
  it('görünümü dışa doğru 2° hücre sınırlarına yuvarlar; fazladan hücre sırası eklemez', () => {
    const box = subscriptionBox(view(28.8, 41.1))
    expect(cellRange(box)).toEqual(cellRange(view(28.8, 41.1)))
    expect(box.minLon).toBe(28)
    expect(box.minLat).toBe(40)
    expect(box.maxLon).toBeCloseTo(30, 6)
    expect(box.maxLon).toBeLessThan(30)
    expect(box.maxLat).toBeLessThan(42)
  })

  it('Türkiye görünümü API sınırının içinde kalır', () => {
    const box = subscriptionBox({ minLon: 25.5, minLat: 35.8, maxLon: 44.8, maxLat: 42.2 })
    expect(box).toMatchObject({ minLon: 24, minLat: 34 })
    expect(box.maxLon - box.minLon).toBeLessThanOrEqual(60)
    expect(box.maxLat - box.minLat).toBeLessThanOrEqual(40)
  })

  it('API sınırından büyük görünümde kutu hücreye yuvarlanmış merkezin etrafında kurulur', () => {
    const world = { minLon: -170, minLat: -70, maxLon: 170, maxLat: 70 }
    const a = subscriptionBox(world)
    const b = subscriptionBox({ ...world, minLon: -169.5, maxLon: 170.5 })
    expect(a.maxLon - a.minLon).toBeLessThanOrEqual(60)
    expect(a.maxLat - a.minLat).toBeLessThanOrEqual(40)
    // Merkez aynı hücrede kaydı: kutu değişmez (ör. dünya görünümünde "Uçağı ortala").
    expect(b).toEqual(a)
  })
})

describe('SubscriptionPlanner', () => {
  it('ilk görünümde abone olur; hücre içindeki kaymalarda yeniden abone olmaz', () => {
    const planner = new SubscriptionPlanner()
    const first = planner.next(view(28.8, 41.1))
    expect(first).not.toBeNull()
    // "Uçağı ortala": uçak ~450 kt ile doğuya gider, harita her turda biraz kayar.
    let subscribes = 0
    for (let step = 1; step <= 600; step++) {
      if (planner.next(view(28.8 + step * 0.0005, 41.1))) subscribes += 1
    }
    expect(subscribes).toBe(0)
    expect(planner.box).toEqual(first)
  })

  it('görünüm aboneliğin dışına taşınca yeniden abone olur', () => {
    const planner = new SubscriptionPlanner()
    planner.next(view(28.8, 41.1))
    const next = planner.next(view(29.8, 41.1))
    expect(next).not.toBeNull()
    expect(next?.maxLon).toBeGreaterThan(30)
    expect(planner.next(view(29.8, 41.1))).toBeNull()
  })

  it(`abonelik gerekenin ${SHRINK_FACTOR} katından büyükse yakınlaşınca daralır`, () => {
    const planner = new SubscriptionPlanner()
    planner.next({ minLon: 25.5, minLat: 35.8, maxLon: 44.8, maxLat: 42.2 })
    const zoomed = planner.next(view(28.8, 41.1))
    expect(zoomed).not.toBeNull()
    expect(cellRange(zoomed as Bbox)).toEqual(cellRange(view(28.8, 41.1)))
  })

  it('hücre sınırındaki görünümde iki hücreye abone olur, sınırdan uzaklaşınca daralmaz', () => {
    const planner = new SubscriptionPlanner()
    const straddling = planner.next(view(30, 41.1))
    expect(straddling?.minLon).toBe(28)
    expect(planner.next(view(31, 41.1))).toBeNull()
  })
})
