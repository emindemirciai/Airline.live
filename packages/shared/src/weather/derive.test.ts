import { describe, expect, it } from 'vitest'
import {
  ceilingFt,
  iconCategory,
  isStrongWind,
  largestCover,
  lowestCloudBaseFt,
  relativeHumidity,
} from './derive'
import { decodeMetar } from './metar'
import type { Sky, Wind } from './schema'

const layers = (...items: [string | null, number | null, string | null][]): Sky => ({
  kind: 'layers',
  layers: items.map(([cover, baseFt, type]) => ({
    cover: cover as Sky['layers'][number]['cover'],
    baseFt,
    type: type as Sky['layers'][number]['type'],
  })),
  verticalVisibilityFt: null,
})

const wind = (speedKt: number | null, gustKt: number | null = null, aboveMaxKt = false): Wind => ({
  calm: false,
  variable: false,
  directionDeg: 180,
  speedKt,
  gustKt,
  varyingFromDeg: null,
  varyingToDeg: null,
  aboveMaxKt,
})

describe('bağıl nem (Magnus, Alduchov–Eskridge; %5 adım)', () => {
  // Lawrence 2005 formülüyle (araştırma prototipi): 20/15 → 72,9; 5/4 → 93,2; 30/10 → 28,9; 35/−5 → 7,51.
  const cases: [number, number, number][] = [
    [20, 15, 75],
    [5, 4, 95],
    [30, 10, 30],
    [-2, -3, 95],
    [35, -5, 10],
    [10, 10, 100],
    [9, 5, 75],
  ]
  it.each(cases)('%i/%i → %i', (t, td, rh) => {
    expect(relativeHumidity(t, td)).toBe(rh)
  })
  it('eksik değerde null; 100 ile sınırlı', () => {
    expect(relativeHumidity(null, 5)).toBeNull()
    expect(relativeHumidity(5, null)).toBeNull()
    expect(relativeHumidity(5, 7)).toBe(100)
  })
})

describe('tavan ve bulut', () => {
  it('en alçak BKN/OVC ya da VV; FEW/SCT tavan değildir', () => {
    expect(ceilingFt(layers(['FEW', 2500, 'CB'], ['BKN', 3500, null]))).toBe(3500)
    expect(ceilingFt(layers(['SCT', 1200, null], ['OVC', 7600, null], ['BKN', 2800, null]))).toBe(
      2800,
    )
    expect(ceilingFt(layers(['FEW', 1000, null], ['SCT', 2000, null]))).toBeNull()
    expect(ceilingFt(layers(['BKN', 2500, 'CB']))).toBe(2500)
    expect(ceilingFt({ kind: 'vv', layers: [], verticalVisibilityFt: 100 })).toBe(100)
    expect(ceilingFt({ kind: 'cavok', layers: [], verticalVisibilityFt: null })).toBeNull()
    expect(ceilingFt(layers(['BKN', null, null]))).toBeNull()
  })
  it('en büyük tek katman (katmanlar toplanmaz) ve en alçak taban', () => {
    const sky = layers(['SCT', 1200, null], ['SCT', 2500, null], ['FEW', 800, 'TCU'])
    expect(largestCover(sky)).toBe('SCT')
    expect(lowestCloudBaseFt(sky)).toBe(800)
    expect(largestCover(layers([null, null, 'CB']))).toBeNull()
  })
})

describe('kuvvetli rüzgâr (ortalama ≥ 20 kt ya da hamle ≥ 30 kt)', () => {
  it.each([
    [wind(19), false],
    [wind(20), true],
    [wind(15, 29), false],
    [wind(15, 30), true],
    [wind(100, null, true), true],
    [wind(null), false],
    [null, false],
  ] as const)('%o → %s', (w, strong) => {
    expect(isStrongWind(w)).toBe(strong)
  })
})

describe('başlık ve simge', () => {
  const decode = (raw: string) => decodeMetar(raw, { referenceTime: '2026-01-15T13:00:00Z' })
  it.each([
    ['LTXX 151250Z 18005KT 0800 -DZ FG VV002 05/05 Q1010', 'weather', 'FG', 'fog'],
    ['LTXX 151250Z 18005KT 3000 RA BR OVC010 05/04 Q1010', 'weather', 'RA', 'rain'],
    ['LTXX 151250Z 18005KT 3000 +RA OVC010 05/04 Q1010', 'weather', 'RA_heavy', 'rain_heavy'],
    ['LTXX 151250Z 18005KT 3000 -RASN OVC010 01/00 Q1010', 'weather', 'RASN_light', 'sleet'],
    ['LTXX 151250Z 18005KT 3000 SG OVC010 M01/M02 Q1010', 'weather', 'SG', 'snow'],
    ['LTXX 151250Z 18005KT 3000 GS OVC010 05/04 Q1010', 'weather', 'GS', 'hail'],
    ['LTXX 151250Z 18005KT 3000 BLDU NSC 25/04 Q1010', 'weather', 'BLDU', 'dust_sand'],
    ['LTXX 151250Z 18005KT 3000 +FC BKN020CB 25/20 Q1010', 'weather', 'FC_heavy', 'severe'],
    ['LTXX 151250Z 18005KT 9999 FEW030 25/04 Q1010', 'sky', 'FEW', 'fair'],
    ['LTXX 151250Z 18005KT 9999 SCT030 25/04 Q1010', 'sky', 'SCT', 'partly'],
    ['LTXX 151250Z 18005KT 9999 OVC030 25/04 Q1010', 'sky', 'OVC', 'overcast'],
    ['LTXX 151250Z 18005KT 9999 NSC 25/04 Q1010', 'sky', 'nsc', 'fair'],
    ['LTXX 151250Z 18005KT 9999 SKC 25/04 Q1010', 'sky', 'skc', 'clear'],
    ['LTXX 151250Z 18005KT 0100 FG VV/// 05/05 Q1010', 'weather', 'FG', 'fog'],
    ['LTXX 151250Z 18005KT 9999 25/04 Q1010', 'sky', 'unknown', 'unknown'],
  ])('%s', (raw, kind, phraseId, icon) => {
    const m = decode(raw)
    expect(m.derived.headline.kind).toBe(kind)
    expect(m.derived.headline.phrase).toBe(phraseId)
    expect(m.derived.icon).toBe(icon)
  })

  it('gece biçimi yalnız açık, az ve parçalı bulutlu için', () => {
    const fair = decode('LTXX 151250Z 18005KT 9999 FEW030 25/04 Q1010')
    expect(iconCategory(fair, true)).toBe('fair')
    expect(iconCategory(fair, false)).toBe('fair_night')
    const rain = decode('LTXX 151250Z 18005KT 3000 RA OVC010 05/04 Q1010')
    expect(iconCategory(rain, false)).toBe('rain')
  })
})
