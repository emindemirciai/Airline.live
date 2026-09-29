import { AIRCRAFT_LAYER } from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { clampViewport } from '../../lib/live/connection'
import { TURKEY_BOUNDS } from './camera'
import { iconScaleAt } from './map-controller'

describe('iconScaleAt', () => {
  it('paylaşılan uçak katmanının icon-size ifadesini izler (z4 0,55 → z10 1)', () => {
    expect(AIRCRAFT_LAYER.layout['icon-size']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      4,
      0.55,
      10,
      1,
    ])
    expect(iconScaleAt(2)).toBe(0.55)
    expect(iconScaleAt(4)).toBe(0.55)
    expect(iconScaleAt(7)).toBeCloseTo(0.775, 9)
    expect(iconScaleAt(10)).toBe(1)
    expect(iconScaleAt(16)).toBe(1)
  })

  it('çok duraklı ifadede doğru aralığı kullanır; sabit ve tanınmayan değerlerde düşmez', () => {
    const expression = ['interpolate', ['linear'], ['zoom'], 0, 0.5, 5, 1, 10, 2]
    expect(iconScaleAt(2.5, expression)).toBeCloseTo(0.75, 9)
    expect(iconScaleAt(7.5, expression)).toBeCloseTo(1.5, 9)
    expect(iconScaleAt(3, 0.8)).toBe(0.8)
    expect(iconScaleAt(3, ['step', ['zoom'], 1, 5, 2])).toBe(1)
    expect(iconScaleAt(3, null)).toBe(1)
  })
})

describe('açılış görünümü', () => {
  it('Türkiye kutusu API görünüm sınırının içindedir (kırpılmadan abone olunur)', () => {
    expect(clampViewport(TURKEY_BOUNDS)).toEqual(TURKEY_BOUNDS)
  })
})
