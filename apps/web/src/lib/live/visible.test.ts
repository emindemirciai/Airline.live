import { describe, expect, it } from 'vitest'
import { inBounds, VISIBLE_LIMIT, visibleAircraft } from './visible'

const TURKEY = { minLon: 25.5, minLat: 35.8, maxLon: 44.8, maxLat: 42.2 }
const center = { lat: 39, lon: 35 }
const at = (hex: string, lat: number, lon: number) => ({ hex, lat, lon })

describe('visibleAircraft', () => {
  it('görünümün dışındakileri atar, merkeze yakınlığa göre sıralar', () => {
    const result = visibleAircraft(
      [at('far', 41, 28.8), at('out', 50, 10), at('near', 39.1, 35.1), at('mid', 40, 33)],
      TURKEY,
      center,
    )
    expect(result.rows.map((ac) => ac.hex)).toEqual(['near', 'mid', 'far'])
    expect(result.total).toBe(3)
  })

  it('eşit uzaklıkta hex sırasına göre dizer ve ilk limit kadarını döndürür', () => {
    const list = Array.from({ length: 80 }, (_, i) => at(`h${String(i).padStart(2, '0')}`, 39, 35))
    const result = visibleAircraft([...list].reverse(), TURKEY, center)
    expect(result.rows).toHaveLength(VISIBLE_LIMIT)
    expect(result.rows[0]?.hex).toBe('h00')
    expect(result.rows.at(-1)?.hex).toBe('h49')
    expect(result.total).toBe(80)
    expect(visibleAircraft(list, TURKEY, center, 3).rows.map((ac) => ac.hex)).toEqual([
      'h00',
      'h01',
      'h02',
    ])
  })

  it('satır nesnelerini olduğu gibi döndürür', () => {
    const ac = { ...at('a', 39, 35), cs: 'THY1' }
    expect(visibleAircraft([ac], TURKEY, center).rows[0]).toBe(ac)
  })

  it('boş listede boş sonuç döner', () => {
    expect(visibleAircraft([], TURKEY, center)).toEqual({ rows: [], total: 0 })
  })
})

describe('inBounds', () => {
  it('sınır dahildir; dünya kopyasına taşan sınırı tanır', () => {
    expect(inBounds({ lat: 35.8, lon: 25.5 }, TURKEY)).toBe(true)
    const pacific = { minLon: 170, minLat: -10, maxLon: 190, maxLat: 10 }
    expect(inBounds({ lat: 0, lon: -175 }, pacific)).toBe(true)
    expect(inBounds({ lat: 0, lon: 175 }, pacific)).toBe(true)
    expect(inBounds({ lat: 0, lon: -165 }, pacific)).toBe(false)
    expect(inBounds({ lat: 0, lon: 0 }, { minLon: -400, minLat: -1, maxLon: 400, maxLat: 1 })).toBe(
      true,
    )
  })
})
