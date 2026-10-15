import { describe, expect, it } from 'vitest'
import {
  ceilingFt,
  iconCategory,
  isStrongWind,
  largestCover,
  lightWind,
  lowestCloudBaseFt,
  offScaleWind,
  relativeHumidity,
  windLevel,
  windLevelTier,
  windTier,
} from './derive'
import { decodeMetar } from './metar'
import { WIND_LEVELS, WIND_TIERS, type Sky, type Wind, type WindLevel } from './schema'

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
    // Satırın vurgu eşiği (17 kt, hamle 25 kt) meydan uyarısını değiştirmez (D-083, 2026-10-03).
    [wind(17), false],
    [wind(16, 25), false],
    [wind(19, 29), false],
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
    // Vurgu eşiği (kullanıcı kararı 2026-10-03): ortalama 17 kt (MGM Beaufort 5) ya da hamle 25 kt.
    ['16KT', null],
    ['17KT', 'fresh'],
    ['19KT', 'fresh'],
    ['16G24KT', null],
    ['16G25KT', 'gusty'],
    ['10G29KT', 'gusty'],
    ['17G26KT', 'fresh'],
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
    ['19G29KT', 'fresh'],
    ['19G30KT', 'gusts'],
    ['18G32KT', 'gusts'],
    ['10G42KT', 'gusts'],
    ['25G42KT', 'strong'],
    ['25G43KT', 'gale'],
    ['10G52KT', 'severeGale'],
    ['40G61KT', 'storm'],
    ['50G69KT', 'violentStorm'],
    ['P99KT', 'hurricane'],
    ['20GP99KT', 'violentStorm'],
    ['11MPS', 'strong'],
    // 9 m/s = 17,5 kt → 17 kt; 8 m/s = 15,6 kt → 16 kt.
    ['09MPS', 'fresh'],
    ['08MPS', null],
    ['10MPS', 'fresh'],
    ['00KT', null],
  ] as const)('%s → %s', (group, level) => {
    const w = decode(`270${group}`)
    expect(windLevel(w)).toBe(level)
    // MGM meydan uyarısı eşiği `gusts` ve üstüdür; `fresh` ve `gusty` yalnız satırı vurgular.
    const warning = level !== null && level !== 'fresh' && level !== 'gusty'
    expect(isStrongWind(w)).toBe(warning)
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
    expect(order('gusty')).toBeLessThan(order('fresh'))
    expect(order('fresh')).toBeLessThan(order('gusts'))
    expect(order('gusts')).toBeLessThan(order('strong'))
    expect(order('strong')).toBeLessThan(order('nearGale'))
    expect(order('violentStorm')).toBeLessThan(order('hurricane'))
    expect(windLevel(wind(64, 69))).toBe('hurricane')
    expect(windLevel(wind(28, 43))).toBe('gale')
  })
})

describe('hafif rüzgâr: gösterilen hız ≤ 10 km/sa (kullanıcı kararı 2026-10-03, D-083)', () => {
  const decode = (group: string) =>
    decodeMetar(`LTXX 031250Z ${group} 9999 FEW030 10/05 Q1010`, {
      referenceTime: '2026-10-03T13:00:00Z',
    }).wind
  it.each([
    ['00000KT', 'calm'],
    ['VRB01KT', 'lightVariable'],
    ['VRB03KT', 'lightVariable'],
    ['VRB04KT', 'light'],
    ['VRB05KT', 'light'],
    ['VRB06KT', null],
    // 5 kt = 9,3 km/sa → 9: hafif; 6 kt = 11,1 km/sa → 11: değil (sınır km/sa'dadır).
    ['27005KT', 'light'],
    ['27006KT', null],
    ['27001KT', 'light'],
    // MPS: 2 m/s = 7,2 km/sa → 7 hafif; 3 m/s = 10,8 km/sa → 11 değil (gösterilen değer).
    ['27002MPS', 'light'],
    ['VRB01MPS', 'lightVariable'],
    ['27003MPS', null],
    // KMH: 10 km/sa hafif, 11 km/sa değil.
    ['27010KMH', 'light'],
    ['27011KMH', null],
    // Hamleli rüzgâr hafif değildir (hamle en az 10 kt fazladır).
    ['27004G14KT', null],
    ['/////KT', null],
    ['270//KT', null],
  ] as const)('%s → %s', (group, expected) => {
    expect(lightWind(decode(group))).toBe(expected)
  })

  it("ölçek üstü, bilinmeyen ve eksik rüzgâr hafif değildir; km/sa yoksa kt'den çevrilir", () => {
    expect(lightWind(null)).toBeNull()
    expect(lightWind(wind(100, null, true))).toBeNull()
    expect(lightWind(wind(null))).toBeNull()
    // Eski API yanıtı (`speedKmh` yok): 5 kt → 9 km/sa, 6 kt → 11 km/sa.
    expect(lightWind(wind(5))).toBe('light')
    expect(lightWind(wind(6))).toBeNull()
    expect(lightWind({ ...wind(6), speedKmh: 10 })).toBe('light')
  })
})

describe('rüzgârın renk basamağı (kullanıcı isteği 2026-10-04: derecelendirilmiş, D-083)', () => {
  const decode = (group: string) =>
    decodeMetar(`LTXX 041250Z ${group} 9999 FEW030 10/05 Q1010`, {
      referenceTime: '2026-10-04T13:00:00Z',
    }).wind
  it.each([
    ['00000KT', 'calm'],
    ['VRB01KT', 'calm'],
    ['VRB03KT', 'calm'],
    ['VRB05KT', 'calm'],
    ['VRB06KT', 'breeze'],
    // 10/11 km/sa (gösterilen değer): 5 kt = 9, 6 kt = 11; KMH olduğu gibi; MPS 2 m/s = 7, 3 m/s = 11.
    // 6 kt ve 3 m/s MGM'de Beaufort 2 "Hafif Rüzgâr"dır; burada hafif-ortadır, çünkü sınır kullanıcının
    // hafif rüzgâr kuralıdır (2026-10-03, D-083), MGM'nin 6/7 kt sınırı değil.
    ['27005KT', 'calm'],
    ['27006KT', 'breeze'],
    ['27010KMH', 'calm'],
    ['27011KMH', 'breeze'],
    ['27002MPS', 'calm'],
    ['27003MPS', 'breeze'],
    // 19/20 km/sa: 10 kt = 19, 11 kt = 20; MPS 5 m/s = 18, 6 m/s = 22.
    ['27010KT', 'breeze'],
    ['27011KT', 'moderate'],
    ['27019KMH', 'breeze'],
    ['27020KMH', 'moderate'],
    ['27005MPS', 'breeze'],
    ['27006MPS', 'moderate'],
    // 30/31 km/sa ile 16/17 kt aynı sınırdır: 16 kt = 30, 17 kt = 31; 30 KMH = 16 kt, 31 KMH = 17 kt;
    // 8 m/s = 29 km/sa (16 kt), 9 m/s = 32 km/sa (17 kt).
    ['27016KT', 'moderate'],
    ['27017KT', 'fresh'],
    ['27030KMH', 'moderate'],
    ['27031KMH', 'fresh'],
    ['27008MPS', 'moderate'],
    ['27009MPS', 'fresh'],
    // Hamle: büyük olan gösterilen değer basamağı belirler (hafif rüzgâr kuralıyla aynı).
    ['27004G14KT', 'moderate'],
    ['27010G20KT', 'moderate'],
    ['27010G24KT', 'moderate'],
    ['27010G25KT', 'fresh'],
    ['27015G29KT', 'fresh'],
    ['27015G30KT', 'strong'],
    // Kehribar ile turuncu: ortalama 19/20 kt (MGM meydan uyarısı).
    ['27019KT', 'fresh'],
    ['27020KT', 'strong'],
    ['27019G29KT', 'fresh'],
    // Turuncu ile kırmızı: ortalama 33/34 kt (Beaufort 8), hamle 42/43 kt (Met Office "Gale").
    ['27033KT', 'strong'],
    ['27034KT', 'storm'],
    ['27025G42KT', 'strong'],
    ['27025G43KT', 'storm'],
    ['27064KT', 'storm'],
    // Ölçek üstü en az kendi düzeyidir.
    ['270P99KT', 'storm'],
    ['27020GP99KT', 'storm'],
    ['270P49MPS', 'storm'],
    // Bilinmeyen hız: vurgu yok.
    ['/////KT', null],
    ['270//KT', null],
  ] as const)('%s → %s', (group, tier) => {
    expect(windTier(decode(group))).toBe(tier)
  })

  it('basamak düzeyden gelir; hafif rüzgâr yeşildir; rüzgâr yoksa null', () => {
    expect(windTier(null)).toBeNull()
    expect(windTier(wind(null))).toBeNull()
    // Hız bilinmiyor ama hamle meydan uyarısı eşiğinde: düzey (`gusts`) gibi.
    expect(windTier(wind(null, 35))).toBe('strong')
    // Ölçek üstü küçük değer yalnız alt sınırdır: hafif sayılmaz.
    expect(windTier(wind(5, null, true))).toBe('breeze')
    // Eski API yanıtı (`speedKmh` yok): kt'den çevrilir.
    expect([windTier(wind(10)), windTier(wind(11))]).toEqual(['breeze', 'moderate'])
    expect(windTier({ ...wind(11), speedKmh: 19 })).toBe('breeze')
    for (const [group, light] of [
      ['00000KT', 'calm'],
      ['VRB02KT', 'lightVariable'],
      ['27005KT', 'light'],
    ] as const) {
      expect([windTier(decode(group)), lightWind(decode(group))], group).toEqual(['calm', light])
    }
  })

  it('her şiddet düzeyinin basamağı: gusty ve fresh kehribar, nearGale’e kadar turuncu, gale ve üstü kırmızı', () => {
    expect(Object.fromEntries(WIND_LEVELS.map((level) => [level, windLevelTier(level)]))).toEqual({
      gusty: 'fresh',
      fresh: 'fresh',
      gusts: 'strong',
      strong: 'strong',
      nearGale: 'strong',
      gale: 'storm',
      severeGale: 'storm',
      storm: 'storm',
      violentStorm: 'storm',
      hurricane: 'storm',
    })
    expect([...WIND_TIERS]).toEqual(['calm', 'breeze', 'moderate', 'fresh', 'strong', 'storm'])
    // Meydan uyarısı (API `derived.strongWind`) değişmedi: turuncu ve kırmızı basamaklardır.
    for (const group of ['27016KT', '27017KT', '27010G25KT', '27020KT', '27015G30KT', '27034KT']) {
      const w = decode(group)
      expect(isStrongWind(w), group).toBe(windTier(w) === 'strong' || windTier(w) === 'storm')
    }
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
