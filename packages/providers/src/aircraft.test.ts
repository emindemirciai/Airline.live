import { describe, expect, it } from 'vitest'
import { sameIdentity } from './aircraft'

describe('sameIdentity', () => {
  it('harf ve rakamları karşılaştırır: büyük-küçük harf, tire ve boşluk fark etmez', () => {
    expect(sameIdentity('TCOIL', 'TC-OIL')).toBe(true)
    expect(sameIdentity('tcoil  ', 'TC-OIL')).toBe(true)
    expect(sameIdentity('N123AB', 'N123AB')).toBe(true)
    expect(sameIdentity('THY974', 'TC-JSB')).toBe(false)
    expect(sameIdentity('TCOIL', 'TC-OIM')).toBe(false)
  })

  it('harf ve rakam taşımayan kimlik hiçbir şeyle aynı sayılmaz', () => {
    expect(sameIdentity('', '')).toBe(false)
    expect(sameIdentity('--', '-')).toBe(false)
    expect(sameIdentity(' ', 'TC-OIL')).toBe(false)
  })
})
