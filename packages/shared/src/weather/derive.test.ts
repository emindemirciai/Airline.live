import { describe, expect, it } from 'vitest'
import {
  ceilingFt,
  iconCategory,
  isStrongWind,
  largestCover,
  lowestCloudBaseFt,
  offScaleWind,
  relativeHumidity,
  windLevel,
} from './derive'
import { decodeMetar } from './metar'
import { WIND_LEVELS, type Sky, type Wind, type WindLevel } from './schema'

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

describe('rüzgâr şiddeti (D-083: MGM eşiği ve Beaufort adları, hamlede Met Office karşılıkları)', () => {
  const decode = (group: string) =>
    decodeMetar(`LTXX 031250Z ${group} 9999 FEW030 10/05 Q1010`, {
      referenceTime: '2026-10-03T13:00:00Z',
    }).wind
  it.each([
    ['19KT', null],
    ['20KT', 'strong'],
    ['27KT', 'strong'],
    ['28KT', 'nearGale'],
    ['33KT', 'nearGale'],
    ['34KT', 'gale'],
    ['40KT', 'gale'],
    ['41KT', 'severeGale'],
    ['48KT', 'storm'],
    ['56KT', 'violentStorm'],
    ['63KT', 'violentStorm'],
    ['64KT', 'hurricane'],
    ['19G29KT', null],
    ['19G30KT', 'gusts'],
    ['10G42KT', 'gusts'],
    ['25G42KT', 'strong'],
    ['25G43KT', 'gale'],
    ['10G52KT', 'severeGale'],
    ['40G61KT', 'storm'],
    ['50G69KT', 'violentStorm'],
    ['P99KT', 'hurricane'],
    ['20GP99KT', 'violentStorm'],
    ['11MPS', 'strong'],
    ['10MPS', null],
    ['00KT', null],
  ] as const)('%s → %s', (group, level) => {
    const w = decode(`270${group}`)
    expect(windLevel(w)).toBe(level)
    // Vurgu eşiği aynı kalır: düzey varsa MGM meydan uyarısı eşiği aşılmıştır.
    expect(isStrongWind(w)).toBe(level !== null)
  })

  it('sakin, bilinmeyen ve eksik rüzgârda düzey yok', () => {
    expect(windLevel(decode('00000KT'))).toBeNull()
    expect(windLevel(decode('/////KT'))).toBeNull()
    expect(windLevel(decode('270//KT'))).toBeNull()
    expect(windLevel(null)).toBeNull()
    expect(windLevel(wind(null, 35))).toBe('gusts')
  })

  it('düzeyler zayıftan güçlüye sıralıdır; büyük olan kazanır', () => {
    const order = (level: WindLevel) => WIND_LEVELS.indexOf(level)
    expect(order('gusts')).toBeLessThan(order('strong'))
    expect(order('strong')).toBeLessThan(order('nearGale'))
    expect(order('violentStorm')).toBeLessThan(order('hurricane'))
    expect(windLevel(wind(64, 69))).toBe('hurricane')
    expect(windLevel(wind(28, 43))).toBe('gale')
  })
})

describe('ölçek üstü değer (P99KT, P49MPS; D-083)', () => {
  it('hamle varsa ölçek üstü hamledir, yoksa ortalama; kt eşiği yoktur', () => {
    expect(offScaleWind(wind(100, null, true))).toEqual({ speed: true, gust: false })
    // P49MPS: 50 m/s = 97 kt; 100 kt'nin altında da ölçek üstüdür.
    expect(offScaleWind(wind(97, null, true))).toEqual({ speed: true, gust: false })
    expect(offScaleWind(wind(39, 97, true))).toEqual({ speed: false, gust: true })
    expect(offScaleWind(wind(90, 100, true))).toEqual({ speed: false, gust: true })
    expect(offScaleWind(wind(100, 100, true))).toEqual({ speed: true, gust: true })
    expect(offScaleWind(wind(100, null, false))).toEqual({ speed: false, gust: false })
    expect(offScaleWind(wind(20, 35))).toEqual({ speed: false, gust: false })
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
