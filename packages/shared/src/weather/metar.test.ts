import { describe, expect, it } from 'vitest'
import { decodeMetar } from './metar'
import { DecodedMetarSchema, type DecodedMetar } from './schema'

/**
 * METAR çözücü tabloları. Kaynaklar: brief §2 fixture metinleri (elle yazılmış, sentetik), MGM
 * Havacılık Meteorolojisi 1 (2018) kodlama örnekleri ("MGM s. N") ve WMO-782 (2020) örnekleri.
 */

const REF = '2026-01-15T13:00:00Z'
const decode = (raw: string) => decodeMetar(raw, { referenceTime: REF })
const wx = (m: DecodedMetar) => m.weather.map((g) => g.raw)

describe('brief §2 fixture METAR’ları', () => {
  it('LTFM: hafif sağanak, hamle 32 kt, CB, TEMPO', () => {
    const m = decode(
      'LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA',
    )
    expect(m.station).toBe('LTFM')
    expect(m.type).toBe('METAR')
    expect(m.observedAt).toBe('2026-01-15T12:50:00.000Z')
    expect(m.wind).toMatchObject({ directionDeg: 30, speedKt: 18, gustKt: 32, calm: false })
    expect(m.visibility).toMatchObject({ meters: 10000, tenKmOrMore: true })
    expect(wx(m)).toEqual(['-SHRA'])
    expect(m.sky.layers).toEqual([
      { cover: 'FEW', baseFt: 2500, type: 'CB' },
      { cover: 'BKN', baseFt: 3500, type: null },
    ])
    expect([m.temperatureC, m.dewPointC, m.qnhHpa]).toEqual([9, 5, 1009])
    expect(m.trend).toHaveLength(1)
    expect(m.trend[0]).toMatchObject({
      kind: 'TEMPO',
      raw: 'TEMPO 4000 SHRA',
      visibility: { meters: 4000 },
      weather: [{ raw: 'SHRA', descriptor: 'SH', phenomena: ['RA'] }],
    })
    expect(m.derived).toMatchObject({
      ceilingFt: 3500,
      relativeHumidityPct: 75,
      strongWind: true,
      weatherUndetermined: false,
      headline: { kind: 'weather', code: '-SHRA', phrase: 'SHRA_light' },
      icon: 'showers',
    })
    expect(m.derived.flags).toMatchObject({
      rain: true,
      snow: false,
      cb: true,
      thunderstorm: false,
    })
    expect(m.unparsed).toEqual([])
  })

  it('LTBA: CAVOK, NOSIG', () => {
    const m = decode('LTBA 151250Z 04008KT CAVOK 10/03 Q1010 NOSIG')
    expect(m.cavok).toBe(true)
    expect(m.visibility?.tenKmOrMore).toBe(true)
    expect(m.sky.kind).toBe('cavok')
    expect(m.weather).toEqual([])
    expect(m.nosig).toBe(true)
    expect(m.trend).toEqual([])
    expect(m.derived.headline).toEqual({ kind: 'sky', code: 'CAVOK', phrase: 'cavok' })
    expect(m.derived.icon).toBe('fair')
    expect(m.derived.ceilingFt).toBeNull()
  })

  it('LTAC: kar, pus, sıfır altı, 800 ft tavan', () => {
    const m = decode('LTAC 151250Z 32012KT 1500 SN BR BKN008 OVC015 M01/M02 Q1018 BECMG 3000 -SN')
    expect(wx(m)).toEqual(['SN', 'BR'])
    expect([m.temperatureC, m.dewPointC]).toEqual([-1, -2])
    expect(m.derived.ceilingFt).toBe(800)
    expect(m.derived.flags).toMatchObject({ snow: true, mist: true, rain: false })
    expect(m.derived.headline.phrase).toBe('SN')
    expect(m.trend[0]).toMatchObject({ kind: 'BECMG', visibility: { meters: 3000 } })
  })

  it('LTAI: kuvvetli oraj, değişken sektör, hamle', () => {
    const m = decode(
      'LTAI 151250Z 20015G28KT 160V240 3000 +TSRA SCT015CB BKN030 16/14 Q1006 TEMPO 1500 +TSRA',
    )
    expect(m.wind).toMatchObject({
      directionDeg: 200,
      speedKt: 15,
      gustKt: 28,
      varyingFromDeg: 160,
      varyingToDeg: 240,
    })
    expect(m.derived.strongWind).toBe(false)
    expect(m.derived.headline.phrase).toBe('TSRA_heavy')
    expect(m.derived.flags).toMatchObject({ thunderstorm: true, rain: true, cb: true })
    expect(m.derived.icon).toBe('thunder')
  })

  it('LTBJ: VRB hafif rüzgâr', () => {
    const m = decode('LTBJ 151250Z VRB02KT 9999 FEW040 14/06 Q1012 NOSIG')
    expect(m.wind).toMatchObject({ variable: true, directionDeg: null, speedKt: 2, calm: false })
    expect(m.derived.headline.phrase).toBe('FEW')
  })

  it('LTCG: sis, VV, sakin, RVR', () => {
    const m = decode('LTCG 151250Z 00000KT 0200 R11/0350N FG VV001 08/08 Q1015 BECMG 1500 BR')
    expect(m.wind?.calm).toBe(true)
    expect(m.visibility?.meters).toBe(200)
    expect(m.rvr).toEqual([
      {
        runway: '11',
        meters: 350,
        qualifier: null,
        varyingToMeters: null,
        varyingToQualifier: null,
        tendency: 'none',
      },
    ])
    expect(m.sky).toEqual({ kind: 'vv', layers: [], verticalVisibilityFt: 100 })
    expect(m.derived.ceilingFt).toBe(100)
    expect(m.derived.relativeHumidityPct).toBe(100)
    expect(m.derived.headline.phrase).toBe('FG')
    expect(m.derived.icon).toBe('fog')
  })

  it('LTFJ: çisenti, pus, son saatte yağmur', () => {
    const m = decode('LTFJ 151250Z 06010KT 4000 -DZ BR SCT006 OVC012 08/07 Q1011 RERA NOSIG')
    expect(wx(m)).toEqual(['-DZ', 'BR'])
    expect(m.recent.map((g) => g.raw)).toEqual(['RERA'])
    expect(m.derived.flags.recent).toBe(true)
    expect(m.derived.headline.phrase).toBe('DZ_light')
    expect(m.derived.icon).toBe('drizzle')
  })

  it('LTCE: kuvvetli kar sağanağı, savrulan kar, kuvvetli rüzgâr', () => {
    const m = decode('LTCE 151250Z 27022G35KT 0800 +SHSN BLSN VV004 M08/M10 Q1021 TEMPO 0400 +SHSN')
    expect(wx(m)).toEqual(['+SHSN', 'BLSN'])
    expect(m.derived.strongWind).toBe(true)
    expect(m.derived.headline.phrase).toBe('SHSN_heavy')
    expect(m.derived.ceilingFt).toBe(400)
  })

  it('LTDB: kuru pus, NSC', () => {
    const m = decode('LTDB 151250Z 18006KT 4000 HZ NSC 19/08 Q1008 NOSIG')
    expect(m.sky.kind).toBe('nsc')
    expect(m.derived.flags.haze).toBe(true)
    expect(m.derived.headline.phrase).toBe('HZ')
    expect(m.derived.icon).toBe('mist_haze')
  })

  it('LTAU: çevrede oraj başlığa girmez', () => {
    const m = decode('LTAU 151250Z 23008KT 9999 VCTS SCT040CB BKN100 07/M01 Q1013 NOSIG')
    expect(m.weather[0]).toMatchObject({ vicinity: true, descriptor: 'TS' })
    expect(m.derived.flags).toMatchObject({ thunderstorm: false, vicinityThunderstorm: true })
    expect(m.derived.headline).toEqual({ kind: 'sky', code: 'BKN', phrase: 'BKN' })
  })

  it('LTBS: SPECI, dolu', () => {
    const m = decode('SPECI LTBS 151242Z 25015G27KT 2000 +TSRAGR SCT012CB BKN025 12/10 Q1007')
    expect(m.type).toBe('SPECI')
    expect(m.observedAt).toBe('2026-01-15T12:42:00.000Z')
    expect(m.derived.flags).toMatchObject({ hail: true, thunderstorm: true, rain: true })
    expect(m.derived.headline.phrase).toBe('TSGR_heavy')
    expect(m.derived.icon).toBe('thunder_hail')
  })

  it('LTCF: donan yağmur', () => {
    const m = decode('LTCF 151250Z 00000KT 2500 FZRA BR OVC005 M01/M02 Q1022 NOSIG')
    expect(m.derived.flags).toMatchObject({ freezing: true, rain: true })
    expect(m.derived.headline.phrase).toBe('FZRA')
    expect(m.derived.icon).toBe('freezing')
  })

  it('LTCW: kuzeyden hafif rüzgâr, sıfır altı', () => {
    const m = decode('LTCW 150450Z 36004KT 9999 FEW050 M05/M09 Q1024')
    expect(m.observedAt).toBe('2026-01-15T04:50:00.000Z')
    expect(m.wind?.directionDeg).toBe(360)
    expect(m.derived.relativeHumidityPct).toBe(75)
  })
})

describe('MGM Havacılık Meteorolojisi kodlama örnekleri', () => {
  it('s. 65: değişken sektör, en düşük görüş, WS ALL RWY, BECMG AT', () => {
    const m = decodeMetar(
      'METAR LTXX 070820Z 23012G23KT 180V250 7000 3000SW SHRA FEW012 FEW022CB BKN030 23/18 Q1008 WS ALL RWY BECMG AT0910 29025KT 2500 TSGRRA =',
      { observedAt: '2026-01-07T08:20:00Z' },
    )
    expect(m.visibility).toMatchObject({ meters: 7000, minimum: { meters: 3000, direction: 'SW' } })
    expect(m.windShear).toEqual({ allRunways: true, runways: [] })
    expect(m.trend[0]).toMatchObject({
      kind: 'BECMG',
      at: '2026-01-07T09:10:00.000Z',
      wind: { directionDeg: 290, speedKt: 25 },
      weather: [{ raw: 'TSGRRA' }],
    })
    expect(m.unparsed).toEqual([])
  })

  it('s. 66: dört RVR, PRFG, REDZ, WS R07, BECMG FM/TL', () => {
    const m = decodeMetar(
      'METAR LTXX 151120Z 17012KT 150V290 2200 1200SE R07R/1200N R25L/1200N R07L/0700N R25R/1300N –DZ PRFG SCT012 BKN028 OVC076 07/07 Q1025 REDZ WS R07 BECMG FM1210 TL1235 26002KT 0800 RADZ FG BKN006 BKN028 OVC076 =',
      { observedAt: '2026-01-15T11:20:00Z' },
    )
    expect(m.rvr.map((r) => [r.runway, r.meters])).toEqual([
      ['07R', 1200],
      ['25L', 1200],
      ['07L', 700],
      ['25R', 1300],
    ])
    // Kitaptaki – (U+2013) eksi işareti olarak okunur.
    expect(wx(m)).toEqual(['-DZ', 'PRFG'])
    expect(m.recent.map((g) => g.raw)).toEqual(['REDZ'])
    expect(m.windShear).toEqual({ allRunways: false, runways: ['07'] })
    expect(m.trend[0]).toMatchObject({
      from: '2026-01-15T12:10:00.000Z',
      until: '2026-01-15T12:35:00.000Z',
      visibility: { meters: 800 },
    })
    expect(m.derived.headline.phrase).toBe('DZ_light')
    expect(m.unparsed).toEqual([])
  })

  it('s. 67: TCU, RESHGRRA, TEMPO FM +SHGR, RVR eğilimi', () => {
    const m = decodeMetar(
      'METAR LTXX 221350Z 32008KT 280V340 6000 R01/3300D R19/3400D +SHRA SCT030 FEW035TCU BKN080 22/19 Q1017 RESHGRRA WS R01 TEMPO FM1420 2300 +SHGR =',
      { observedAt: '2026-06-22T13:50:00Z' },
    )
    expect(m.rvr[0]).toMatchObject({ runway: '01', meters: 3300, tendency: 'down' })
    expect(m.derived.flags.tcu).toBe(true)
    expect(m.recent[0]).toMatchObject({ descriptor: 'SH', phenomena: ['GR', 'RA'] })
    expect(m.trend[0]).toMatchObject({ kind: 'TEMPO', from: '2026-06-22T14:20:00.000Z' })
  })

  it('s. 71: FZFG VV001, R29/M0150N, REFZRA, BECMG TL', () => {
    const m = decodeMetar(
      'METAR LTXX 300450Z 12004KT 110V180 0350 0200W R11/0350N R29/M0150N FZFG VV001 M06/M08 Q0985 REFZRA BECMG TL0625 1300 BR BKN012 BKN024 =',
      { observedAt: '2026-01-30T04:50:00Z' },
    )
    expect(m.visibility).toMatchObject({ meters: 350, minimum: { meters: 200, direction: 'W' } })
    expect(m.rvr[1]).toMatchObject({ runway: '29', meters: 150, qualifier: 'below' })
    expect(m.derived.headline.phrase).toBe('FZFG')
    expect(m.derived.flags).toMatchObject({ fog: true, freezing: true, rain: false })
    expect(m.trend[0]?.until).toBe('2026-01-30T06:25:00.000Z')
  })

  it('s. 72: eksik RVR (R03//////), REBLSN, BECMG NSW', () => {
    const m = decode(
      'METAR LTXX 120450Z 22008KT 170V250 2800 R03////// SN BKN007 BKN033 OVC080 M03/M05 Q1011 REBLSN WS R03 BECMG FM0515 7000 NSW BKN013 BKN035 =',
    )
    expect(m.rvr[0]).toMatchObject({ runway: '03', meters: null })
    expect(m.trend[0]?.nsw).toBe(true)
    expect(m.unparsed).toEqual([])
    expect(m.derived.weatherUndetermined).toBe(false)
  })

  it('s. 73: R34/P1500N, BCFG, RESN', () => {
    const m = decode(
      'METAR LTXX 150650Z VRB02KT 4800 1600NE R16/0800N R34/P1500N BCFG BKN014 SCT032 M00/M04 Q0994 RESN NOSIG =',
    )
    expect(m.rvr[1]).toMatchObject({ runway: '34', meters: 1500, qualifier: 'above' })
    expect(m.temperatureC).toBe(0)
    expect(Object.is(m.temperatureC, -0)).toBe(false)
    expect(m.derived.headline.phrase).toBe('BCFG')
  })

  it('s. 74: yağışsız oraj', () => {
    const m = decode(
      'METAR LTXX 070850Z 16010G22KT 120V190 6000 TS FEW028CB SCT035TCU 25/23 Q1016 RETSRA WS ALL RWY BECMG TL0920 NSW =',
    )
    expect(m.weather[0]).toMatchObject({ descriptor: 'TS', phenomena: [] })
    expect(m.derived.headline.phrase).toBe('TS')
    expect(m.derived.flags.thunderstorm).toBe(true)
  })

  it('s. 76: VCSH, REDS, TEMPO TL TSGR', () => {
    const m = decode(
      'METAR LTXX 091150Z 24026G36KT 6000 VCSH FEW025CB SCT025 BKN074 24/19 Q1011 REDS WS ALL RWY TEMPO TL1240 2200 TSGR =',
    )
    expect(m.derived.flags).toMatchObject({ vicinityShowers: true, rain: false })
    expect(m.derived.strongWind).toBe(true)
    expect(m.recent[0]?.phenomena).toEqual(['DS'])
  })

  it('s. 79: VRB22G35KT 220V300, TSGRRA', () => {
    const m = decode(
      'METAR LTXX 261150Z VRB22G35KT 220V300 3000 R18/2500U R36/3000U TSGRRA SCT012 BKN025CB BKN076 25/24 Q0999 RESHRA WS ALL RWY BECMG FM1220 TL1315 04012KT 7000 NSW =',
    )
    expect(m.wind).toMatchObject({
      variable: true,
      speedKt: 22,
      gustKt: 35,
      varyingFromDeg: 220,
      varyingToDeg: 300,
    })
    expect(m.rvr[0]?.tendency).toBe('up')
    expect(m.derived.ceilingFt).toBe(2500)
  })
})

describe('kenar durumlar', () => {
  it('P99KT ve GP99 (ölçek üstü)', () => {
    expect(decode('LTXX 151250Z 220P99KT 9999 FEW030 10/05 Q1010').wind).toMatchObject({
      directionDeg: 220,
      speedKt: 100,
      aboveMaxKt: true,
    })
    const gust = decode('LTXX 151250Z 33090GP99KT 9999 FEW030 10/05 Q1010')
    expect(gust.wind).toMatchObject({ speedKt: 90, gustKt: 100, aboveMaxKt: true })
    expect(gust.derived.strongWind).toBe(true)
  })

  it('P49MPS ve GP49MPS: 50 m/s ve üzeri (97 kt, 180 km/sa)', () => {
    expect(decode('UUXX 151250Z 270P49MPS 0800 +TSRA BKN010CB 20/18 Q0990').wind).toMatchObject({
      directionDeg: 270,
      speedKt: 97,
      speedKmh: 180,
      gustKt: null,
      aboveMaxKt: true,
    })
    expect(decode('UUXX 151250Z 27020GP49MPS 9999 FEW030 15/08 Q1015').wind).toMatchObject({
      speedKt: 39,
      speedKmh: 72,
      gustKt: 97,
      gustKmh: 180,
      aboveMaxKt: true,
    })
  })

  it('MPS ve KMH rüzgâr kt’ye çevrilir', () => {
    expect(decode('UUEE 151250Z 27005MPS 9999 FEW030 10/05 Q1010').wind?.speedKt).toBe(10)
    expect(decode('XXXX 151250Z 27037KMH 9999 FEW030 10/05 Q1010').wind?.speedKt).toBe(20)
  })

  it('km/sa raporun biriminden tek yuvarlamayla (D-083)', () => {
    // 11 m/s = 39,6 km/sa → 40; kt'den (21 kt × 1,852 = 38,9) çevrilseydi 39 olurdu.
    expect(decode('UGTB 151230Z 31011G16MPS 9999 FEW030 10/05 Q1010').wind).toMatchObject({
      speedKt: 21,
      speedKmh: 40,
      gustKt: 31,
      gustKmh: 58,
    })
    expect(decode('LTXX 151250Z 03018G32KT 9999 FEW030 10/05 Q1010').wind).toMatchObject({
      speedKmh: 33,
      gustKmh: 59,
    })
    expect(decode('XXXX 151250Z 27037KMH 9999 FEW030 10/05 Q1010').wind?.speedKmh).toBe(37)
    expect(decode('LTXX 151250Z 220P99KT 9999 FEW030 10/05 Q1010').wind?.speedKmh).toBe(185)
    expect(decode('LTXX 151250Z 270//KT 9999 FEW030 10/05 Q1010').wind?.speedKmh).toBeNull()
  })

  it('VRB25KT ile oraj (MGM: yön 180° ve üzeri değişir)', () => {
    const m = decode('LTXX 151250Z VRB25KT 220V010 3000 +TSRA BKN020CB 18/16 Q1004')
    expect(m.wind).toMatchObject({
      variable: true,
      speedKt: 25,
      varyingFromDeg: 220,
      varyingToDeg: 10,
    })
    expect(m.derived.strongWind).toBe(true)
  })

  it('görüş: 0000, 9999NDV, ayrık NDV, 1400SW, ////', () => {
    expect(decode('LTXX 151250Z 00000KT 0000 FG VV/// 05/05 Q1010').visibility).toMatchObject({
      meters: 50,
      lessThan50m: true,
      qualifier: 'below',
    })
    expect(decode('LTXX 151250Z AUTO 00000KT 9999NDV NCD 05/01 Q1010').visibility).toMatchObject({
      tenKmOrMore: true,
      ndv: true,
    })
    const split = decode('LTXX 151250Z 00000KT 9999 NDV NSC 05/01 Q1010')
    expect(split.visibility?.ndv).toBe(true)
    expect(split.unparsed).toEqual([])
    expect(decode('LTXX 151250Z 18005KT 6000 1400SW BR NSC 05/04 Q1010').visibility).toMatchObject({
      meters: 6000,
      minimum: { meters: 1400, direction: 'SW' },
    })
    expect(decode('LTXX 151250Z AUTO 18005KT //// NCD 05/04 Q1010').visibility).toBeNull()
  })

  it('ABD biçimi: mil görüş, A (inHg) basınç', () => {
    const m = decode('KXXX 151250Z 18005KT 1 1/2SM BR OVC004 05/04 A2992 RMK AO2')
    expect(m.visibility?.meters).toBe(2414)
    expect(m.qnhHpa).toBe(1013)
    expect(m.remarks).toBe('AO2')
    expect(decode('KXXX 151250Z 18005KT P6SM SKC 05/04 A2992').visibility).toMatchObject({
      meters: 9656,
      qualifier: 'above',
      tenKmOrMore: false,
    })
    expect(decode('KXXX 151250Z 18005KT M1/4SM FG VV001 05/04 A2992').visibility).toMatchObject({
      meters: 402,
      qualifier: 'below',
    })
  })

  it('RVR: M0050, P2000, değişken, FT', () => {
    const m = decode(
      'LTXX 151250Z 00000KT 0100 R35/M0050 R17/P2000 R05/0600V1200U R23/2000FT FG VV001 02/02 Q1010',
    )
    expect(m.rvr).toEqual([
      expect.objectContaining({ runway: '35', meters: 50, qualifier: 'below' }),
      expect.objectContaining({ runway: '17', meters: 2000, qualifier: 'above' }),
      expect.objectContaining({ meters: 600, varyingToMeters: 1200, tendency: 'up' }),
      expect.objectContaining({ runway: '23', meters: 610 }),
    ])
  })

  it('NCD, SKC, CLR, AUTO, COR', () => {
    const auto = decode('METAR COR LTXX 151250Z AUTO 18005KT 9999 NCD 10/05 Q1010')
    expect(auto).toMatchObject({ auto: true, corrected: true })
    expect(auto.sky.kind).toBe('ncd')
    expect(auto.derived.headline.phrase).toBe('ncd')
    expect(decode('LTXX 151250Z COR 18005KT 9999 SKC 10/05 Q1010').corrected).toBe(true)
    expect(decode('LTXX 151250Z 18005KT 9999 SKC 10/05 Q1010').sky.kind).toBe('skc')
    expect(decode('KXXX 151250Z 18005KT 10SM CLR 10/05 A3001').sky.kind).toBe('clr')
  })

  it('NIL: değerler yok, hava olayı belirlenemedi', () => {
    const m = decode('METAR LTBQ 151250Z NIL=')
    expect(m).toMatchObject({ nil: true, wind: null, visibility: null, temperatureC: null })
    expect(m.derived.weatherUndetermined).toBe(true)
    expect(m.derived.headline.kind).toBe('nil')
    expect(m.derived.icon).toBe('unknown')
  })

  it('otomatik istasyonun eksik değerleri (WMO-782 "Missing elements")', () => {
    const m = decode('LTXX 151250Z AUTO /////KT //// // ////// /////  Q//// RE//')
    expect(m).toMatchObject({
      wind: null,
      visibility: null,
      temperatureC: null,
      dewPointC: null,
      qnhHpa: null,
    })
    expect(m.sky.kind).toBe('unknown')
    expect(m.unparsed).toEqual([])
    // Hava olayı gözlenemedi (`//`): "yok" denemez.
    expect(m.derived.weatherUndetermined).toBe(true)
    const partial = decode('LTXX 151250Z 270//KT 9999 BKN////// 10/// Q1010')
    expect(partial.wind).toMatchObject({ directionDeg: 270, speedKt: null })
    expect(partial.sky.layers).toEqual([{ cover: 'BKN', baseFt: null, type: null }])
    expect([partial.temperatureC, partial.dewPointC]).toEqual([10, null])
    expect(partial.unparsed).toEqual([])
    const cb = decode('LTXX 151250Z 18005KT 9999 //////CB ///03 Q1010')
    expect(cb.sky.layers).toEqual([{ cover: null, baseFt: null, type: 'CB' }])
    expect([cb.temperatureC, cb.dewPointC]).toEqual([null, 3])
  })

  it('WS R35 ve WS RWY35L', () => {
    expect(decode('LTXX 151250Z 18005KT 9999 FEW030 10/05 Q1010 WS R35').windShear).toEqual({
      allRunways: false,
      runways: ['35'],
    })
    expect(decode('LTXX 151250Z 18005KT 9999 FEW030 10/05 Q1010 WS RWY35L').windShear).toEqual({
      allRunways: false,
      runways: ['35L'],
    })
  })

  it('+SNRA ve -TSRA', () => {
    expect(
      decode('LTXX 151250Z 18005KT 1500 +SNRA OVC008 00/M01 Q1010').derived.headline.phrase,
    ).toBe('SNRA_heavy')
    expect(
      decode('LTXX 151250Z 18005KT 5000 -TSRA BKN020CB 18/16 Q1010').derived.headline.phrase,
    ).toBe('TSRA_light')
  })

  it('pist durumu, deniz durumu ve NATO renk kodu tanınır, hava olayı sayılmaz', () => {
    const m = decode(
      'LTXX 151250Z 18005KT 9999 FEW030 10/05 Q1010 R05/290195 R/SNOCLO W15/S3 BLU NOSIG BLU',
    )
    expect(m.unparsed).toEqual([])
    expect(m.derived.weatherUndetermined).toBe(false)
  })

  it('çözülemeyen hava olayına benzer parça: belirlenemedi; tanınan olaylar korunur', () => {
    const m = decode('LTXX 151250Z 22010KT 9999 -RA XYZRA FEW030 10/05 Q1010')
    expect(m.unparsed).toEqual(['XYZRA'])
    expect(m.derived.weatherUndetermined).toBe(true)
    // Tanınan olay başlıkta kalır.
    expect(m.derived.headline.phrase).toBe('RA_light')
    const none = decode('LTXX 151250Z 22010KT 9999 QQSN FEW030 10/05 Q1010')
    expect(none.derived.headline.kind).toBe('undetermined')
  })

  it('TREND içindeki çözülemeyen parça güncel satırları etkilemez', () => {
    const m = decode('LTXX 151250Z 22010KT 9999 FEW030 10/05 Q1010 TEMPO 4000 XYZRA')
    expect(m.unparsed).toEqual(['XYZRA'])
    expect(m.trend[0]?.unparsed).toEqual(['XYZRA'])
    expect(m.derived.weatherUndetermined).toBe(false)
  })

  it('görüş grubu olmayan (kesik) rapor belirlenemedi sayılır', () => {
    const m = decode('LTFM 151250Z 03018KT')
    expect(m.derived.weatherUndetermined).toBe(true)
    expect(m.derived.headline.kind).toBe('undetermined')
  })

  it('başlıksız (istasyonsuz, zamansız) metin belirlenemedi sayılır', () => {
    expect(decode('').derived.weatherUndetermined).toBe(true)
    expect(decode('garbage text').derived.weatherUndetermined).toBe(true)
  })

  it('gözlem zamanı: kayıt zamanı ham gruptan önceliklidir; referans yoksa null', () => {
    const raw = 'LTFM 151250Z 03018KT 9999 FEW025 09/05 Q1009'
    expect(decodeMetar(raw, { observedAt: new Date('2026-01-15T12:51:00Z') }).observedAt).toBe(
      '2026-01-15T12:51:00.000Z',
    )
    expect(decodeMetar(raw).observedAt).toBeNull()
    // Ay sonu: 31'inde alınan 01'i raporu sonraki aya oturur.
    expect(
      decodeMetar('LTFM 010020Z 03018KT 9999 FEW025 09/05 Q1009', {
        referenceTime: '2026-01-31T23:58:00Z',
      }).observedAt,
    ).toBe('2026-02-01T00:20:00.000Z')
  })

  it('TREND saatleri gözlem zamanı bilinmiyorsa null, gece yarısını geçerse ertesi gün', () => {
    expect(
      decodeMetar('LTXX 151250Z 18005KT 9999 FEW030 10/05 Q1010 BECMG FM1300 BR').trend[0]?.from,
    ).toBeNull()
    const night = decodeMetar('LTXX 152350Z 18005KT 9999 FEW030 10/05 Q1010 TEMPO TL0030 BR', {
      observedAt: '2026-01-15T23:50:00Z',
    })
    expect(night.trend[0]?.until).toBe('2026-01-16T00:30:00.000Z')
  })
})

describe('sözleşme', () => {
  const samples = [
    'LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA',
    'LTBA 151250Z 04008KT CAVOK 10/03 Q1010 NOSIG',
    'LTCG 151250Z 00000KT 0200 R11/0350N FG VV001 08/08 Q1015 BECMG 1500 BR',
    'METAR LTBQ 151250Z NIL=',
    'LTXX 151250Z AUTO /////KT //// // ////// /////  Q//// RE//',
    'KXXX 151250Z 18005KT P6SM SKC 05/04 A2992',
    'METAR LTXX 300450Z 12004KT 110V180 0350 0200W R11/0350N R29/M0150N FZFG VV001 M06/M08 Q0985 REFZRA BECMG TL0625 1300 BR BKN012 BKN024 =',
    '',
  ]
  it.each(samples)('çıktı şemaya uyar ve JSON gidiş-dönüşünde değişmez: %s', (raw) => {
    const m = decode(raw)
    expect(DecodedMetarSchema.parse(m)).toEqual(m)
    expect(JSON.parse(JSON.stringify(m))).toEqual(m)
  })

  it('çözücü saf ve belirlenimcidir', () => {
    const raw = samples[0] ?? ''
    expect(decode(raw)).toEqual(decode(raw))
  })
})
