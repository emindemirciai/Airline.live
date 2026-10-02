import { describe, expect, it } from 'vitest'
import { decodeMetar } from './metar'
import {
  capitalizeFirst,
  cloudBaseMeters,
  isMeasure,
  isPhrase,
  isPhraseList,
  ktToKmh,
  messageAt,
  renderWeatherText,
  visibilityDisplay,
  WEATHER_PHRASE_KEYS,
  type Measure,
  type WeatherParam,
  type WeatherPhraseKey,
  type WeatherText,
} from './phrase'
import type { DecodedMetar, DecodedTaf, LightningRisk, WindLevel } from './schema'
import { summarizeMetar, summarizeTaf, type WeatherSummary } from './summary'
import { decodeTaf } from './taf'
import { fake, fakeMeasure, keyTemplate } from './test/fake-text'

const NOW = '2026-01-15T13:00:00Z'
const metar = (raw: string): DecodedMetar => decodeMetar(raw, { referenceTime: NOW })
const taf = (raw: string): DecodedTaf => decodeTaf(raw, { referenceTime: NOW })

/** Satırları anahtar biçiminde metne çevirir. */
function rows(summary: WeatherSummary): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(summary.rows).map(([name, value]) => [name, fake(value)]),
  )
}

const NONE = 'weather.value.none'
const UNDETERMINED = 'weather.value.undetermined'

describe('summarizeMetar: brief §2 fixture’ları', () => {
  it('LTFM: hafif sağanak, kuvvetli rüzgâr, CB, TEMPO', () => {
    const s = summarizeMetar(
      metar('LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA'),
    )
    expect(fake(s.headline)).toBe('weather.wx.SHRA_light')
    expect(s.temperature).toEqual({ measure: 'temperature', celsius: 9 })
    expect(rows(s)).toEqual({
      wind: 'weather.wind.from(weather.compass.from.NE,18kt), weather.wind.gust(32kt)',
      rain: 'weather.wx.SHRA_light',
      snow: NONE,
      thunderstorm: 'weather.thunder.cloudPrecip',
      fog: NONE,
      hail: null,
      other: null,
      visibility: 'weather.visibility.tenKmPlus',
      clouds: 'weather.clouds.BKN, weather.clouds.lowest(2500ft), weather.clouds.cb',
      temperature: '9C',
      dewPoint: '5C',
      humidity: 'weather.humidity(75)',
      pressure: '1009hPa',
    })
    expect(fake(s.next2h)).toBe(
      'weather.trend.tempo(weather.change.visibility(4000m), weather.wx.SHRA)',
    )
    expect(s).toMatchObject({
      windLevel: 'gusts',
      strongWind: true,
      lightning: 'cloudPrecip',
      undetermined: false,
      notes: [],
      icon: 'showers',
    })
  })

  it('LTBA: CAVOK, NOSIG', () => {
    const s = summarizeMetar(metar('LTBA 151250Z 04008KT CAVOK 10/03 Q1010 NOSIG'))
    expect(fake(s.headline)).toBe('weather.headline.cavok')
    expect(rows(s)).toMatchObject({
      wind: 'weather.wind.from(weather.compass.from.NE,8kt)',
      rain: NONE,
      snow: NONE,
      thunderstorm: NONE,
      fog: NONE,
      visibility: 'weather.visibility.tenKmPlus',
      clouds: 'weather.clouds.cavok',
    })
    expect(fake(s.next2h)).toBe('weather.trend.nosig')
  })

  it('LTAC: kar ve pus', () => {
    const s = summarizeMetar(
      metar('LTAC 151250Z 32012KT 1500 SN BR BKN008 OVC015 M01/M02 Q1018 BECMG 3000 -SN'),
    )
    expect(rows(s)).toMatchObject({
      wind: 'weather.wind.from(weather.compass.from.NW,12kt)',
      rain: NONE,
      snow: 'weather.wx.SN',
      fog: 'weather.wx.BR',
      visibility: '1500m',
      clouds: 'weather.clouds.OVC, weather.clouds.lowest(800ft)',
      temperature: '-1C',
    })
    expect(fake(s.next2h)).toBe(
      'weather.trend.becmg(weather.change.visibility(3000m), weather.wx.SN_light)',
    )
  })

  it('LTAI: kuvvetli oraj; yağmur satırı olayı, gök gürültüsü satırı yıldırım tehlikesini söyler', () => {
    const s = summarizeMetar(
      metar(
        'LTAI 151250Z 20015G28KT 160V240 3000 +TSRA SCT015CB BKN030 16/14 Q1006 TEMPO 1500 +TSRA',
      ),
    )
    expect(rows(s)).toMatchObject({
      wind: 'weather.wind.from(weather.compass.from.S,15kt), weather.wind.gust(28kt), weather.wind.varying(weather.compass.name.S,weather.compass.name.SW)',
      rain: 'weather.wx.TSRA_heavy',
      thunderstorm: 'weather.thunder.here',
      snow: NONE,
    })
    expect(s.strongWind).toBe(false)
    expect(s.windLevel).toBeNull()
    expect(s.lightning).toBe('here')
  })

  it('LTBJ: hafif ve değişken; LTCG: sakin, sis, VV', () => {
    expect(
      rows(summarizeMetar(metar('LTBJ 151250Z VRB02KT 9999 FEW040 14/06 Q1012 NOSIG'))).wind,
    ).toBe('weather.wind.lightVariable')
    const fog = summarizeMetar(
      metar('LTCG 151250Z 00000KT 0200 R11/0350N FG VV001 08/08 Q1015 BECMG 1500 BR'),
    )
    expect(rows(fog)).toMatchObject({
      wind: 'weather.wind.calm',
      fog: 'weather.wx.FG',
      visibility: '200m',
      clouds: 'weather.clouds.vv(100ft)',
      humidity: 'weather.humidity(100)',
    })
    expect(fake(fog.headline)).toBe('weather.wx.FG')
  })

  it('LTFJ: çisenti görünürken son saatteki yağmur ayrıca söylenmez', () => {
    const s = summarizeMetar(
      metar('LTFJ 151250Z 06010KT 4000 -DZ BR SCT006 OVC012 08/07 Q1011 RERA NOSIG'),
    )
    expect(rows(s)).toMatchObject({ rain: 'weather.wx.DZ_light', fog: 'weather.wx.BR' })
  })

  it('LTCE: kar sağanağı ve savrulan kar', () => {
    const s = summarizeMetar(
      metar('LTCE 151250Z 27022G35KT 0800 +SHSN BLSN VV004 M08/M10 Q1021 TEMPO 0400 +SHSN'),
    )
    expect(rows(s)).toMatchObject({
      wind: 'weather.wind.from(weather.compass.from.W,22kt), weather.wind.gust(35kt)',
      snow: 'weather.wx.SHSN_heavy, weather.wx.BLSN',
      rain: NONE,
    })
    expect(s.strongWind).toBe(true)
    expect(s.windLevel).toBe('strong')
  })

  it('LTDB: kuru pus sis/pus satırında; NSC', () => {
    const s = summarizeMetar(metar('LTDB 151250Z 18006KT 4000 HZ NSC 19/08 Q1008 NOSIG'))
    expect(rows(s)).toMatchObject({ fog: 'weather.wx.HZ', clouds: 'weather.clouds.nsc' })
    expect(fake(s.headline)).toBe('weather.wx.HZ')
  })

  it('LTAU: çevrede oraj', () => {
    const s = summarizeMetar(
      metar('LTAU 151250Z 23008KT 9999 VCTS SCT040CB BKN100 07/M01 Q1013 NOSIG'),
    )
    expect(rows(s).thunderstorm).toBe('weather.thunder.vicinity')
    expect(s.lightning).toBe('vicinity')
    expect(fake(s.headline)).toBe('weather.clouds.BKN')
  })

  it('LTBS: SPECI, dolu satırı görünür', () => {
    const s = summarizeMetar(
      metar('SPECI LTBS 151242Z 25015G27KT 2000 +TSRAGR SCT012CB BKN025 12/10 Q1007'),
    )
    expect(rows(s)).toMatchObject({
      hail: 'weather.wx.TSGR_heavy',
      thunderstorm: 'weather.thunder.here',
      rain: 'weather.wx.TSGR_heavy',
    })
    expect(s.notes.map(fake)).toEqual(['weather.note.speci'])
  })

  it('LTCF: donan yağmur', () => {
    const s = summarizeMetar(metar('LTCF 151250Z 00000KT 2500 FZRA BR OVC005 M01/M02 Q1022 NOSIG'))
    expect(rows(s)).toMatchObject({ rain: 'weather.wx.FZRA', fog: 'weather.wx.BR' })
  })
})

describe('summarizeMetar: dürüstlük kuralları', () => {
  const PRESENCE = ['rain', 'snow', 'thunderstorm', 'fog'] as const

  it('yağmur, kar, oraj ve sis satırları her zaman vardır', () => {
    for (const raw of [
      'LTBA 151250Z 04008KT CAVOK 10/03 Q1010 NOSIG',
      'METAR LTBQ 151250Z NIL=',
      'LTXX 151250Z AUTO /////KT //// // ////// ///// Q////',
      '',
    ]) {
      const r = rows(summarizeMetar(metar(raw)))
      for (const name of PRESENCE) expect(typeof r[name]).toBe('string')
    }
  })

  it('çözülemeyen hava olayına benzer parça: "yok" yerine "belirlenemedi"', () => {
    const s = summarizeMetar(metar('LTXX 151250Z 22010KT 9999 XYZRA FEW030 10/05 Q1010'))
    const r = rows(s)
    for (const name of PRESENCE) expect(r[name]).toBe(UNDETERMINED)
    expect(fake(s.headline)).toBe('weather.headline.undetermined')
    expect(s.undetermined).toBe(true)
    expect(s.notes.map(fake)).toEqual(['weather.note.undetermined'])
    // Tanınan olay korunur, ötekiler belirlenemedi.
    const partly = rows(
      summarizeMetar(metar('LTXX 151250Z 22010KT 9999 -RA XYZRA FEW030 10/05 Q1010')),
    )
    expect(partly).toMatchObject({
      rain: 'weather.wx.RA_light',
      snow: UNDETERMINED,
      thunderstorm: UNDETERMINED,
      fog: UNDETERMINED,
    })
  })

  it('NIL: bütün değerler belirlenemedi, sıcaklık yok', () => {
    const s = summarizeMetar(metar('METAR LTBQ 151250Z NIL='))
    expect(fake(s.headline)).toBe('weather.headline.noReport')
    expect(rows(s)).toEqual({
      wind: UNDETERMINED,
      rain: UNDETERMINED,
      snow: UNDETERMINED,
      thunderstorm: UNDETERMINED,
      fog: UNDETERMINED,
      hail: null,
      other: null,
      visibility: UNDETERMINED,
      clouds: UNDETERMINED,
      temperature: null,
      dewPoint: null,
      humidity: null,
      pressure: null,
    })
    expect(s.temperature).toBeNull()
    expect(s.next2h).toBeNull()
    expect(s.notes.map(fake)).toEqual(['weather.note.nil'])
  })

  it('otomatik gözlem: hava olayı gözlenemedi (//) → belirlenemedi; AUTO notu', () => {
    const s = summarizeMetar(metar('LTXX 151250Z AUTO 18005KT 9999 // NCD 10/05 Q1010'))
    expect(rows(s).rain).toBe(UNDETERMINED)
    expect(rows(s).clouds).toBe('weather.clouds.ncd')
    expect(s.notes.map(fake)).toEqual(['weather.note.undetermined', 'weather.note.auto'])
    // Temiz otomatik rapor "yok" diyebilir, AUTO notu yine gösterilir.
    const clean = summarizeMetar(metar('LTXX 151250Z AUTO 18005KT 9999 NCD 10/05 Q1010'))
    expect(rows(clean).rain).toBe(NONE)
    expect(clean.notes.map(fake)).toEqual(['weather.note.auto'])
  })

  it('çevredeki ve son saatteki olaylar "havalimanında yok" diye ayrı söylenir', () => {
    expect(
      rows(summarizeMetar(metar('LTXX 151250Z 18005KT 9999 VCSH FEW030CB 10/05 Q1010'))).rain,
    ).toBe('weather.value.vicinity(weather.wx.VCSH)')
    const recent = rows(
      summarizeMetar(metar('LTXX 151250Z 18005KT 9999 FEW030 10/05 Q1010 RERA RETS RESN')),
    )
    expect(recent).toMatchObject({
      rain: 'weather.value.recent(weather.wx.RA)',
      thunderstorm: 'weather.value.recent(weather.wx.VCTS)',
      snow: 'weather.value.recent(weather.wx.SN)',
    })
    expect(
      rows(summarizeMetar(metar('LTXX 151250Z 18005KT 9999 VCFG FEW030 10/05 Q1010'))).fog,
    ).toBe('weather.value.vicinity(weather.wx.FG)')
  })

  it('türü belirlenemeyen yağış hem yağmur hem kar satırında', () => {
    const r = rows(summarizeMetar(metar('LTXX 151250Z AUTO 18005KT 4000 UP OVC010 02/01 Q1010')))
    expect(r).toMatchObject({ rain: 'weather.wx.UP', snow: 'weather.wx.UP' })
  })

  it('diğer olaylar yalnız varsa görünür (çevredekiler dahil)', () => {
    const r = rows(summarizeMetar(metar('LTXX 151250Z 18005KT 4000 DU VCPO NSC 30/05 Q1010')))
    expect(r.other).toBe('weather.wx.DU, weather.wx.vicinity(weather.wx.PO)')
    expect(r.hail).toBeNull()
  })

  it('COR notu', () => {
    const s = summarizeMetar(metar('METAR COR LTXX 151250Z 18005KT 9999 FEW030 10/05 Q1010'))
    expect(s.notes.map(fake)).toEqual(['weather.note.corrected'])
  })
})

describe('summarizeMetar: olay satırının durumu (vurgu)', () => {
  const presence = (raw: string) => summarizeMetar(metar(raw)).presence

  it('havalimanında var olan olay "present"; yok ve CB’li yok "none"', () => {
    expect(
      presence('LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA'),
    ).toEqual({
      rain: 'present',
      snow: 'none',
      thunderstorm: 'none',
      fog: 'none',
      hail: 'none',
      other: 'none',
    })
    expect(
      presence('SPECI LTBS 151242Z 25015G27KT 2000 +TSRAGR SCT012CB BKN025 12/10 Q1007'),
    ).toMatchObject({ rain: 'present', thunderstorm: 'present', hail: 'present', fog: 'none' })
    expect(presence('LTAC 151250Z 32012KT 1500 SN BR BKN008 OVC015 M01/M02 Q1018')).toMatchObject({
      rain: 'none',
      snow: 'present',
      fog: 'present',
    })
    expect(presence('LTDB 151250Z 18006KT 4000 HZ NSC 19/08 Q1008 NOSIG').fog).toBe('present')
  })

  it('çevredeki ve son saatteki olay vurgulanmaz; belirlenemeyen satır "undetermined"', () => {
    expect(presence('LTAU 151250Z 23008KT 9999 VCTS SCT040CB 07/M01 Q1013').thunderstorm).toBe(
      'vicinity',
    )
    expect(presence('LTXX 151250Z 18005KT 9999 FEW030 10/05 Q1010 RERA RETS')).toMatchObject({
      rain: 'recent',
      thunderstorm: 'recent',
      snow: 'none',
    })
    expect(presence('LTXX 151250Z 18005KT 4000 DU VCPO NSC 30/05 Q1010').other).toBe('present')
    expect(presence('LTXX 151250Z 18005KT 9999 VCPO NSC 30/05 Q1010').other).toBe('vicinity')
    const auto = presence('LTXX 151250Z AUTO 18005KT 9999 // NCD 10/05 Q1010')
    expect([auto.rain, auto.snow, auto.thunderstorm, auto.fog]).toEqual(
      Array(4).fill('undetermined'),
    )
    // Tanınan olay belirlenemeyen raporda da "present"tır (metni de yazılır).
    expect(presence('LTXX 151250Z 22010KT 9999 -RA XYZRA FEW030 10/05 Q1010').rain).toBe('present')
    expect(presence('METAR LTBQ 151250Z NIL=').rain).toBe('undetermined')
  })
})

describe('summarizeMetar: rüzgâr şiddeti ve şimşek-yıldırım uyarısı (M6e, D-083)', () => {
  /**
   * Gerçek biçimli METAR'lar (2026-10-03). İlk ikisi üretimdeki ekran görüntülerindeki durumlardır:
   * Gazipaşa'da gök gürültülü hafif sağanak (rüzgâr 13 km/sa), İstanbul'da kuzeydoğudan 48 km/sa ve
   * kümülonimbüs. Sütunlar: METAR, rüzgâr satırı, şiddet, gök gürültüsü satırı, `lightning`.
   */
  const CASES: readonly (readonly [
    string,
    string,
    WindLevel | null,
    string,
    LightningRisk | null,
  ])[] = [
    [
      'LTFG 031250Z 14007KT 9999 -TSRA FEW025CB SCT030 BKN100 24/19 Q1012',
      'weather.wind.from(weather.compass.from.SE,7kt)',
      null,
      'weather.thunder.here',
      'here',
    ],
    [
      'LTFM 031250Z 04026KT 9999 SCT030CB BKN040 17/12 Q1014 NOSIG',
      'weather.wind.from(weather.compass.from.NE,26kt)',
      'strong',
      'weather.thunder.cloud',
      'cloud',
    ],
    [
      'LTFM 031250Z 36025KT 9999 FEW040 18/10 Q1015',
      'weather.wind.from(weather.compass.from.N,25kt)',
      'strong',
      NONE,
      null,
    ],
    [
      'LTAF 031250Z 22012KT 9999 TS SCT035CB 31/12 Q1009',
      'weather.wind.from(weather.compass.from.SW,12kt)',
      null,
      'weather.thunder.hereDry',
      'hereDry',
    ],
    [
      'LTBJ 031250Z 25010KT 9999 VCSH TS FEW030CB 27/18 Q1010',
      'weather.wind.from(weather.compass.from.W,10kt)',
      null,
      'weather.thunder.hereDry',
      'hereDry',
    ],
    [
      'LTAU 151250Z 23008KT 9999 VCTS SCT040CB BKN100 07/M01 Q1013 NOSIG',
      'weather.wind.from(weather.compass.from.SW,8kt)',
      null,
      'weather.thunder.vicinity',
      'vicinity',
    ],
    [
      'LTBA 031320Z 30012KT 9999 FEW030 SCT040 22/15 Q1013 RETSRA',
      'weather.wind.from(weather.compass.from.NW,12kt)',
      null,
      'weather.value.recent(weather.wx.TSRA)',
      null,
    ],
    [
      'LTBA 031320Z 30012KT 9999 FEW030CB SCT040 22/15 Q1013 RETSRA',
      'weather.wind.from(weather.compass.from.NW,12kt)',
      null,
      'weather.thunder.cloud',
      'cloud',
    ],
    [
      'LTFM 141020Z 27014KT 9999 -SHRA FEW020TCU BKN030 11/08 Q1008 NOSIG',
      'weather.wind.from(weather.compass.from.W,14kt)',
      null,
      NONE,
      null,
    ],
    [
      // Kümülonimbüs ve havalimanında yağış, oraj bildirilmedi (fixture IST): "Yok" denmez,
      // şimşek ve yıldırım tehlikesi yazılır (kullanıcının sözü, 2026-10-03).
      'LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA',
      'weather.wind.from(weather.compass.from.NE,18kt), weather.wind.gust(32kt)',
      'gusts',
      'weather.thunder.cloudPrecip',
      'cloudPrecip',
    ],
    [
      'LTCE 031250Z 27010KT 3000 -SN SCT020CB OVC030 M02/M04 Q1012',
      'weather.wind.from(weather.compass.from.W,10kt)',
      null,
      'weather.thunder.cloudPrecip',
      'cloudPrecip',
    ],
    [
      // Tanınan yağış rapor belirlenemese de vardır: tehlike yazılır ("Yok" ya da "Belirlenemedi"
      // demeyen metin).
      'LTXX 031250Z 22010KT 9999 -RA XYZRA FEW030CB 10/05 Q1010',
      'weather.wind.from(weather.compass.from.SW,10kt)',
      null,
      'weather.thunder.cloudPrecip',
      'cloudPrecip',
    ],
    [
      // Yağış yalnız çevrede (VCSH) ya da yağış değil (pus): bulut olasılığı.
      'LTXX 031250Z 22010KT 9999 VCSH FEW030CB 10/05 Q1010',
      'weather.wind.from(weather.compass.from.SW,10kt)',
      null,
      'weather.thunder.cloud',
      'cloud',
    ],
    [
      'LTXX 031250Z 22010KT 4000 BR FEW030CB 10/09 Q1010',
      'weather.wind.from(weather.compass.from.SW,10kt)',
      null,
      'weather.thunder.cloud',
      'cloud',
    ],
    [
      'LTFJ 031250Z 04026G45KT 9999 SCT030 17/10 Q1012',
      'weather.wind.from(weather.compass.from.NE,26kt), weather.wind.gust(45kt)',
      'gale',
      NONE,
      null,
    ],
    [
      'LGTS 031250Z 32030KT 9999 FEW030 05/M06 Q1024 NOSIG',
      'weather.wind.from(weather.compass.from.NW,30kt)',
      'nearGale',
      NONE,
      null,
    ],
    [
      'LTAI 031250Z VRB25G40KT 3000 +TSRA SCT015CB 18/16 Q1006',
      'weather.wind.variable(25kt), weather.wind.gust(40kt)',
      'strong',
      'weather.thunder.here',
      'here',
    ],
    [
      'LTAI 151250Z 20015G28KT 160V240 3000 +TSRA SCT015CB BKN030 16/14 Q1006',
      'weather.wind.from(weather.compass.from.S,15kt), weather.wind.gust(28kt), weather.wind.varying(weather.compass.name.S,weather.compass.name.SW)',
      null,
      'weather.thunder.here',
      'here',
    ],
    [
      // 11 m/s = 21,4 kt → 21 kt; km/sa m/s'den (39,6 → 40), kt'den çevrilseydi 39 olurdu.
      'UGTB 031230Z 31011MPS 9999 FEW030 15/08 Q1015 NOSIG',
      'weather.wind.from(weather.compass.from.NW,21kt/40kmh)',
      'strong',
      NONE,
      null,
    ],
    [
      'LTXX 031250Z 270P99KT 0800 +TSRA BKN010CB 20/18 Q0990',
      'weather.wind.from(weather.compass.from.W,weather.wind.above(100kt))',
      'hurricane',
      'weather.thunder.here',
      'here',
    ],
    [
      // Ölçek üstü m/s: 50 m/s ve üzeri = 97 kt; "ve üzeri" kt eşiğine (100) bağlı değildir.
      'UUXX 031250Z 270P49MPS 0800 +TSRA BKN010CB 20/18 Q0990',
      'weather.wind.from(weather.compass.from.W,weather.wind.above(97kt))',
      'hurricane',
      'weather.thunder.here',
      'here',
    ],
    [
      // Ölçek üstü hamle: yalnız hamle "ve üzeri"dir, ortalama değil.
      'UUXX 031250Z 27020GP49MPS 9999 FEW030 15/08 Q1015',
      'weather.wind.from(weather.compass.from.W,39kt), weather.wind.gust(weather.wind.above(97kt))',
      'violentStorm',
      NONE,
      null,
    ],
    [
      'LTXX 031250Z 33090GP99KT 9999 FEW030 10/05 Q1010',
      'weather.wind.from(weather.compass.from.NW,90kt), weather.wind.gust(weather.wind.above(100kt))',
      'hurricane',
      NONE,
      null,
    ],
    ['LTXX 031250Z NIL', UNDETERMINED, null, UNDETERMINED, null],
    [
      // Hava olayına benzeyen çözülemeyen parça: "Yok" denemez, bulut yine söylenir.
      'LTXX 031250Z 22010KT 9999 XYZRA FEW030CB 10/05 Q1010',
      'weather.wind.from(weather.compass.from.SW,10kt)',
      null,
      'weather.thunder.cloudUndetermined',
      'cloudUndetermined',
    ],
    [
      // Ayrı gruplar: havalimanında oraj ve yağmur.
      'LTXX 031250Z 18008KT 6000 TS RA BKN020CB 20/18 Q1008',
      'weather.wind.from(weather.compass.from.S,8kt)',
      null,
      'weather.thunder.here',
      'here',
    ],
    [
      // Havalimanında oraj, hava olayı belirlenemedi (otomatik istasyonun hava duyargası `//`,
      // şimşek algılayıcısı çalışıyor): yağış bilinmez, "yağış yok" (`hereDry`) denemez.
      'LTAF 031250Z AUTO 22012KT 9999 TS // NCD 31/12 Q1009',
      'weather.wind.from(weather.compass.from.SW,12kt)',
      null,
      'weather.thunder.here',
      'here',
    ],
    [
      // Görüşü eksik (kesik) rapor ve hava olayına benzeyen çözülemeyen parça: aynı kural.
      'LTAF 031250Z 22012KT TS SCT035CB 31/12 Q1009',
      'weather.wind.from(weather.compass.from.SW,12kt)',
      null,
      'weather.thunder.here',
      'here',
    ],
    [
      'LTAF 031250Z 22012KT 9999 TS XXRA SCT035CB 31/12 Q1009',
      'weather.wind.from(weather.compass.from.SW,12kt)',
      null,
      'weather.thunder.here',
      'here',
    ],
    [
      // Çevrede oraj, rapor belirlenemedi: çevredeki oraj yine söylenir.
      'LTXX 031250Z 18008KT 9999 VCTS XYZRA SCT030CB 20/18 Q1008',
      'weather.wind.from(weather.compass.from.S,8kt)',
      null,
      'weather.thunder.vicinity',
      'vicinity',
    ],
  ]

  it.each(CASES)('%s', (raw, wind, level, thunder, lightning) => {
    const s = summarizeMetar(metar(raw))
    const r = rows(s)
    expect(r.wind).toBe(wind)
    expect(r.thunderstorm).toBe(thunder)
    expect(s.windLevel).toBe(level)
    expect(s.strongWind).toBe(level !== null)
    expect(s.lightning).toBe(lightning)
  })

  it('yağmur satırı olayı ayrıca söyler (Gazipaşa, yağışsız oraj, çevrede sağanak)', () => {
    const rain = (raw: string) => rows(summarizeMetar(metar(raw))).rain
    expect(rain('LTFG 031250Z 14007KT 9999 -TSRA FEW025CB SCT030 BKN100 24/19 Q1012')).toBe(
      'weather.wx.TSRA_light',
    )
    expect(rain('LTAF 031250Z 22012KT 9999 TS SCT035CB 31/12 Q1009')).toBe(NONE)
    expect(rain('LTBJ 031250Z 25010KT 9999 VCSH TS FEW030CB 27/18 Q1010')).toBe(
      'weather.value.vicinity(weather.wx.VCSH)',
    )
  })

  it('oraj var, hava olayı belirlenemedi: başlık ve satırlar "yağış yok" demez (D-078)', () => {
    for (const raw of [
      'LTAF 031250Z AUTO 22012KT 9999 TS // NCD 31/12 Q1009',
      'LTAF 031250Z 22012KT TS SCT035CB 31/12 Q1009',
      'LTAF 031250Z 22012KT 9999 TS XXRA SCT035CB 31/12 Q1009',
    ]) {
      const s = summarizeMetar(metar(raw))
      expect(s.undetermined, raw).toBe(true)
      // `weather.wx.TS` "yağış yok" der; başlık yalnız gök gürültüsünü söyler.
      expect(fake(s.headline), raw).toBe('weather.wx.VCTS')
      expect(rows(s).rain, raw).toBe(UNDETERMINED)
      expect(s.lightning, raw).toBe('here')
    }
    // Temiz raporda yağışsız oraj olduğu gibi: başlık grubun metni, yağmur "Yok".
    const clean = summarizeMetar(metar('LTAF 031250Z 22012KT 9999 TS SCT035CB 31/12 Q1009'))
    expect(fake(clean.headline)).toBe('weather.wx.TS')
    expect(rows(clean).rain).toBe(NONE)
    expect(clean.lightning).toBe('hereDry')
    // Yağışlı orajda belirlenemeyen parça başlığı değiştirmez.
    const wet = summarizeMetar(metar('LTAF 031250Z 22012KT 9999 -TSRA XXRA SCT035CB 31/12 Q1009'))
    expect(fake(wet.headline)).toBe('weather.wx.TSRA_light')
  })

  it('oraj ve yağış ayrı gruplarda (`TS RA`): başlık "yağış yok" demez, yağış satırı yağışı yazar', () => {
    for (const [raw, row, value] of [
      ['LTXX 031250Z 18008KT 6000 TS RA BKN020CB 20/18 Q1008', 'rain', 'weather.wx.RA'],
      ['LTXX 031250Z 18008KT 6000 TS -SHRA BKN020CB 20/18 Q1008', 'rain', 'weather.wx.SHRA_light'],
      ['LTXX 031250Z 18008KT 6000 TS GS BKN020CB 20/18 Q1008', 'hail', 'weather.wx.GS'],
      ['LTXX 031250Z 18008KT 6000 -RA TS BKN020CB 20/18 Q1008', 'rain', 'weather.wx.RA_light'],
    ] as const) {
      const s = summarizeMetar(metar(raw))
      expect(s.undetermined, raw).toBe(false)
      // `weather.wx.TS` "yağış yok" der; yağış başka grupta olduğu için başlık yalnız gök gürültüsü.
      expect(fake(s.headline), raw).toBe('weather.wx.VCTS')
      expect(rows(s)[row], raw).toBe(value)
      expect(s.lightning, raw).toBe('here')
    }
    // Yağış yalnız çevrede (VCSH): havalimanında yağış yok, yağışsız orajın metni kalır.
    const vcsh = summarizeMetar(metar('LTBJ 031250Z 25010KT 9999 VCSH TS FEW030CB 27/18 Q1010'))
    expect(fake(vcsh.headline)).toBe('weather.wx.TS')
    // Yağış oraj grubunun içinde (`TSRA`): grubun kendi metni.
    const tsra = summarizeMetar(metar('LTXX 031250Z 18008KT 6000 -TSRA BKN020CB 20/18 Q1008'))
    expect(fake(tsra.headline)).toBe('weather.wx.TSRA_light')
  })

  it('olay satırının durumu değişmez: yağışsız oraj havalimanında "present"', () => {
    const p = summarizeMetar(metar('LTAF 031250Z 22012KT 9999 TS SCT035CB 31/12 Q1009')).presence
    expect(p).toMatchObject({ thunderstorm: 'present', rain: 'none' })
    const cb = summarizeMetar(metar('LTFM 031250Z 04026KT 9999 SCT030CB BKN040 17/12 Q1014'))
    expect(cb.presence.thunderstorm).toBe('none')
  })

  it('kümülonimbüs varken gök gürültüsü satırı uyarısız "Yok" demez', () => {
    for (const [raw] of CASES) {
      const m = metar(raw)
      if (!m.nil && m.derived.flags.cb) expect(summarizeMetar(m).lightning, raw).not.toBeNull()
    }
  })
})

describe('summarizeMetar: rüzgâr, görüş, bulut biçimleri', () => {
  const wind = (group: string) =>
    rows(summarizeMetar(metar(`LTXX 151250Z ${group} 9999 FEW030 10/05 Q1010`))).wind
  it.each([
    ['00000KT', 'weather.wind.calm'],
    ['VRB02KT', 'weather.wind.lightVariable'],
    ['VRB03KT', 'weather.wind.lightVariable'],
    ['VRB05KT', 'weather.wind.variable(5kt)'],
    ['VRB02G12KT', 'weather.wind.variable(2kt), weather.wind.gust(12kt)'],
    [
      'VRB25KT 220V010',
      'weather.wind.variable(25kt), weather.wind.varying(weather.compass.name.SW,weather.compass.name.N)',
    ],
    ['220P99KT', 'weather.wind.from(weather.compass.from.SW,weather.wind.above(100kt))'],
    [
      '33090GP99KT',
      'weather.wind.from(weather.compass.from.NW,90kt), weather.wind.gust(weather.wind.above(100kt))',
    ],
    ['/////KT', UNDETERMINED],
    ['270//KT', UNDETERMINED],
    ['///10KT', 'weather.wind.speedOnly(10kt)'],
  ])('%s', (group, expected) => {
    expect(wind(group)).toBe(expected)
  })

  const field = (body: string, name: 'visibility' | 'clouds') =>
    rows(summarizeMetar(metar(`LTXX 151250Z 18005KT ${body} 10/05 Q1010`)))[name]
  it.each([
    [
      '6000 1400SW BR NSC',
      'visibility',
      '6000m, weather.visibility.minimum(1400m,weather.compass.name.SW)',
    ],
    ['0000 FG VV///', 'visibility', 'weather.visibility.lessThan50'],
    ['//// NCD', 'visibility', UNDETERMINED],
    ['P6SM SKC', 'visibility', 'weather.visibility.above(9656m)'],
    ['M1/4SM FG VV001', 'visibility', 'weather.visibility.below(402m)'],
    ['9999 SKC', 'clouds', 'weather.clouds.skc'],
    ['9999 NCD', 'clouds', 'weather.clouds.ncd'],
    ['0100 FG VV///', 'clouds', 'weather.clouds.vvUnknown'],
    ['9999', 'clouds', UNDETERMINED],
    ['9999 //////CB', 'clouds', `${UNDETERMINED}, weather.clouds.cb`],
    [
      '9999 FEW015TCU SCT030 BKN100',
      'clouds',
      'weather.clouds.BKN, weather.clouds.lowest(1500ft), weather.clouds.tcu',
    ],
  ] as const)('%s → %s', (body, name, expected) => {
    expect(field(body, name)).toBe(expected)
  })
})

describe('summarizeMetar: eğilim penceresi (gözlemden sonraki 2 saat)', () => {
  const m = metar('LTXX 151250Z 04008KT 9999 FEW030 10/03 Q1010 NOSIG')
  const at = (minutes: number) => new Date(Date.parse('2026-01-15T12:50:00Z') + minutes * 60_000)

  it('taze gözlem: "önümüzdeki 2 saat"; now verilmezse de', () => {
    expect(fake(summarizeMetar(m).next2h)).toBe('weather.trend.nosig')
    const fresh = summarizeMetar(m, { now: at(20) })
    expect(fresh.trend).toBe('next2h')
    expect(fake(fresh.next2h)).toBe('weather.trend.nosig')
  })

  it('30 dakikadan eski gözlem: pencerenin bitiş saatiyle', () => {
    const old = summarizeMetar(m, { now: at(45) })
    expect(old.trend).toBe('untilTime')
    expect(fake(old.next2h)).toBe('weather.trend.nosigUntil(t14:50)')
    const tempo = summarizeMetar(
      metar('LTXX 151250Z 04008KT 9999 FEW030 10/03 Q1010 TEMPO 4000 SHRA'),
      {
        now: at(90),
      },
    )
    expect(fake(tempo.next2h)).toBe(
      'weather.trend.tempoUntil(weather.change.visibility(4000m), weather.wx.SHRA,t14:50)',
    )
  })

  it('pencere geçti: eğilim yok (gecikmiş ya da eski gözlem ileriye dönük iddia taşımaz)', () => {
    for (const minutes of [120, 160, 600]) {
      const late = summarizeMetar(m, { now: at(minutes) })
      expect(late.trend).toBe('expired')
      expect(late.next2h).toBeNull()
    }
  })
})

describe('summarizeTaf', () => {
  const LTFM_NEW =
    'TAF LTFM 151040Z 1512/1618 03015G28KT 9999 SCT025 BKN035 TEMPO 1512/1518 4000 SHRA FEW025CB PROB30 TEMPO 1514/1518 TSRA BECMG 1520/1522 02008KT'
  const LTFM_OLD = 'TAF LTFM 150440Z 1506/1612 04012KT 9999 SCT030 TEMPO 1510/1516 5000 -SHRA'

  const items = (tafs: DecodedTaf[], now = NOW) => summarizeTaf(tafs, now).items.map(fake)

  it('LTFM: en önemli olay (PROB30 TEMPO oraj) ve sonraki farklı olay; eski TAF’ın yerini yenisi alır', () => {
    const s = summarizeTaf([taf(LTFM_OLD), taf(LTFM_NEW)], NOW)
    expect(s.status).toBe('ok')
    expect(s.items.map(fake)).toEqual([
      'weather.taf.probTempo(t14:00,t18:00,30,weather.wx.TSRA)',
      'weather.taf.tempoUntil(t18:00,weather.wx.SHRA)',
    ])
    expect(fake(s.validUntil)).toBe('weather.taf.validUntil(weather.time.tomorrow(t18:00))')
    expect(s.message).toBeNull()
  })

  it('yeni TAF geçerli olmadan önce eskisi kullanılır, yenisinin başında kesilir', () => {
    const older = taf('TAF LTFM 150440Z 1506/1612 04012KT 9999 SCT030 TEMPO 1510/1516 +TSRA')
    const newer = taf('TAF LTFM 151040Z 1512/1618 03010KT 9999 SCT025')
    expect(items([newer, older], '2026-01-15T11:00:00Z')).toEqual([
      'weather.taf.tempoUntil(t12:00,weather.wx.TSRA_heavy)',
    ])
    // 12:00'den sonra eski TAF'ın TEMPO'su (16:00'ya kadar) artık kullanılmaz.
    expect(summarizeTaf([newer, older], NOW).message).not.toBeNull()
    expect(fake(summarizeTaf([newer, older], NOW).message)).toBe('weather.taf.nothingSignificant')
  })

  it('LTAI AMD: PROB40 kuvvetli oraj olasılıkla söylenir, temel oraj ikinci satırda', () => {
    const s = summarizeTaf(
      [
        taf(
          'TAF AMD LTAI 151215Z 1512/1618 20015G28KT 3000 TSRA SCT015CB BKN030 PROB40 1515/1518 1500 +TSRA BECMG 1600/1602 9999 NSW SCT025',
        ),
      ],
      NOW,
    )
    expect(s.items.map(fake)).toEqual([
      'weather.taf.prob(t15:00,t18:00,40,weather.wx.TSRA_heavy)',
      'weather.taf.until(weather.time.tomorrow(t00:00),weather.wx.TSRA)',
    ])
    expect(s.amended).toBe(true)
  })

  it('LTCE: kuvvetli rüzgâr ikinci satırda', () => {
    expect(
      items([
        taf(
          'TAF LTCE 151040Z 1512/1612 27020G35KT 0800 +SHSN BLSN VV004 BECMG 1516/1518 25012KT 3000 -SN BKN010',
        ),
      ]),
    ).toEqual([
      'weather.taf.until(t16:00,weather.wx.SHSN_heavy)',
      'weather.taf.until(t16:00,weather.taf.strongWind(weather.wind.level.strong,weather.wind.from(weather.compass.from.W,20kt), weather.wind.gust(35kt)))',
    ])
  })

  it('olay sürüyorsa yalnız başka öğeyi değiştiren BECMG "… saatine kadar"ı kesmez', () => {
    // Türk TAF'larında sık: yalnız rüzgârı değiştiren BECMG; sağanak geçerlilik sonuna kadar sürer.
    expect(
      items([taf('TAF LTXX 151040Z 1512/1618 03015KT 9999 -SHRA SCT025 BECMG 1514/1516 25012KT')]),
    ).toEqual(['weather.taf.until(weather.time.tomorrow(t18:00),weather.wx.SHRA_light)'])
  })

  it('MGM kitap örneği: hava grubu ve NSW taşımayan BECMG yer yer sisi geçerlilik sonuna kadar sürdürür', () => {
    const now = '2026-01-31T09:30:00Z'
    const mgm = decodeTaf(
      'TAF LTXX 310440Z 3106/3115 VRB02KT 2800 BCFG SCT010 TEMPO 3107/3109 0800 FG BKN002 BECMG 3111/3113 24015KT 6000 NSC',
      { referenceTime: now },
    )
    const result = summarizeTaf([mgm], now).items.map(fake)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatch(/^weather\.taf\.until\(t15:00,weather\.wx\.BCFG/)
  })

  it('örtüşen iki TAF, ikisinde de hafif yağmur: yenisinin başlangıcında kesilmez', () => {
    // Yeni TAF geçerliliğinden ~1 saat 20 dk önce yayımlanır; arada eski TAF kullanılır.
    const older = taf('TAF LTFM 150440Z 1506/1612 04012KT 9999 -RA BKN030')
    const newer = taf('TAF LTFM 151040Z 1512/1618 03010KT 9999 -RA BKN025')
    expect(items([newer, older], '2026-01-15T11:00:00Z')).toEqual([
      'weather.taf.until(weather.time.tomorrow(t18:00),weather.wx.RA_light)',
    ])
    // Yenisinde yağmur yoksa eski TAF'ın yağmuru yenisinin başında biter.
    const dry = taf('TAF LTFM 151040Z 1512/1618 03010KT 9999 BKN025')
    expect(items([dry, older], '2026-01-15T11:00:00Z')).toEqual([
      'weather.taf.until(t12:00,weather.wx.RA_light)',
    ])
    // Kuvvetli rüzgâr da aynı kuralla: iki TAF'ta da kuvvetli rüzgâr sürüyor. Birleşen öğe
    // yenisinin daha güçlü değerlerini söyler (ilk dilimin 25G38'ini değil).
    const windyOld = taf('TAF LTFM 150440Z 1506/1612 04025G38KT 9999 BKN030')
    const windyNew = taf(
      'TAF LTFM 151040Z 1512/1618 04028G40KT 9999 BKN030 BECMG 1520/1522 04010KT',
    )
    // 28 kt fırtınamsı rüzgârdır (Beaufort 7; D-083).
    expect(items([windyNew, windyOld], '2026-01-15T11:00:00Z')).toEqual([
      'weather.taf.until(t20:00,weather.taf.strongWind(weather.wind.level.nearGale,weather.wind.from(weather.compass.from.NE,28kt), weather.wind.gust(40kt)))',
    ])
  })

  it('birleşen kuvvetli rüzgâr: bütün dilimlerin en yüksek ortalaması ve en yüksek hamlesi', () => {
    // Güçlü dilim önce: sonraki zayıf dilim değerleri düşürmez.
    expect(
      items([taf('TAF LTXX 151040Z 1512/1618 04028G40KT 9999 BKN030 BECMG 1514/1516 04025G35KT')]),
    ).toEqual([
      'weather.taf.until(weather.time.tomorrow(t18:00),weather.taf.strongWind(weather.wind.level.nearGale,weather.wind.from(weather.compass.from.NE,28kt), weather.wind.gust(40kt)))',
    ])
    // Ortalama bir dilimden, hamle ötekinden; yön ortalaması en yüksek dilimin yönüdür. Şiddet
    // birleşen değerden: ortalama 30 kt fırtınamsı, hamle 45 kt fırtına → fırtına.
    expect(
      items([taf('TAF LTXX 151040Z 1512/1618 27030KT 9999 BKN030 BECMG 1514/1516 25022G45KT')]),
    ).toEqual([
      'weather.taf.until(weather.time.tomorrow(t18:00),weather.taf.strongWind(weather.wind.level.gale,weather.wind.from(weather.compass.from.W,30kt), weather.wind.gust(45kt)))',
    ])
    // Ortalamadan büyük olmayan hamle yazılmaz.
    expect(
      items([taf('TAF LTXX 151040Z 1512/1618 27020G30KT 9999 BKN030 BECMG 1514/1516 27035KT')]),
    ).toEqual([
      'weather.taf.until(weather.time.tomorrow(t18:00),weather.taf.strongWind(weather.wind.level.gale,weather.wind.from(weather.compass.from.W,35kt)))',
    ])
  })

  it('etkili rüzgâr öğesi şiddetin adıyla (D-083): fırtına, kuvvetli hamle; MPS dilimi', () => {
    expect(items([taf('TAF LTXX 151040Z 1512/1618 04030G45KT 9999 SCT030 BKN040')])).toEqual([
      'weather.taf.until(weather.time.tomorrow(t18:00),weather.taf.strongWind(weather.wind.level.gale,weather.wind.from(weather.compass.from.NE,30kt), weather.wind.gust(45kt)))',
    ])
    expect(items([taf('TAF LTXX 151040Z 1512/1618 04015G30KT 9999 SCT030')])).toEqual([
      'weather.taf.until(weather.time.tomorrow(t18:00),weather.taf.strongWind(weather.wind.level.gusts,weather.wind.from(weather.compass.from.NE,15kt), weather.wind.gust(30kt)))',
    ])
    // 11 m/s: km/sa raporun biriminden (40), kt yuvarlanmış (21).
    expect(items([taf('TAF UGTB 151040Z 1512/1618 31011MPS 9999 SCT030')])).toEqual([
      'weather.taf.until(weather.time.tomorrow(t18:00),weather.taf.strongWind(weather.wind.level.strong,weather.wind.from(weather.compass.from.NW,21kt/40kmh)))',
    ])
    // Birleşen dilimlerde hamlenin km/sa'sı hamleyle birlikte gelir: ortalama ilk dilimden (11 m/s),
    // hamle ikinciden (16 m/s = 31 kt; 57,6 → 58 km/sa, kt'den çevrilseydi 57).
    expect(
      items([taf('TAF UGTB 151040Z 1512/1618 31011MPS 9999 SCT030 BECMG 1514/1516 31008G16MPS')]),
    ).toEqual([
      'weather.taf.until(weather.time.tomorrow(t18:00),weather.taf.strongWind(weather.wind.level.strong,weather.wind.from(weather.compass.from.NW,21kt/40kmh), weather.wind.gust(31kt/58kmh)))',
    ])
  })

  it('birden çok kuvvetli rüzgâr: en şiddetlisi yazılır, sonra gelse de (D-083)', () => {
    // Temel 20 kt kuvvetli rüzgâr, TEMPO 45G65 tam fırtına: en erken olan değil en şiddetli olan.
    expect(
      items([taf('TAF LTXX 151040Z 1512/1618 18020KT 9999 SCT030 TEMPO 1515/1518 27045G65KT')]),
    ).toEqual([
      'weather.taf.tempo(t15:00,t18:00,weather.taf.strongWind(weather.wind.level.storm,weather.wind.from(weather.compass.from.W,45kt), weather.wind.gust(65kt)))',
    ])
    // İki TEMPO: önce kuvvetli hamle (15G30), sonra çok şiddetli fırtına (50G70).
    expect(
      items([
        taf(
          'TAF LTXX 151040Z 1512/1618 18010KT 9999 SCT030 TEMPO 1514/1516 18015G30KT TEMPO 1516/1520 27050G70KT',
        ),
      ]),
    ).toEqual([
      'weather.taf.tempo(t16:00,t20:00,weather.taf.strongWind(weather.wind.level.violentStorm,weather.wind.from(weather.compass.from.W,50kt), weather.wind.gust(70kt)))',
    ])
    // Hava olayıyla birlikte: olay ilk, en şiddetli rüzgâr ikinci satırda.
    expect(
      items([
        taf('TAF LTXX 151040Z 1512/1618 18022KT 9999 -SHRA SCT030 PROB30 1516/1519 27040G55KT'),
      ]),
    ).toEqual([
      'weather.taf.until(weather.time.tomorrow(t18:00),weather.wx.SHRA_light)',
      'weather.taf.prob(t16:00,t19:00,30,weather.taf.strongWind(weather.wind.level.severeGale,weather.wind.from(weather.compass.from.W,40kt), weather.wind.gust(55kt)))',
    ])
    // Şiddet eşitse en erken olan (sonra en kesin).
    expect(
      items([
        taf(
          'TAF LTXX 151040Z 1512/1618 18010KT 9999 SCT030 TEMPO 1514/1516 18022KT TEMPO 1517/1519 27024KT',
        ),
      ]),
    ).toEqual([
      'weather.taf.tempo(t14:00,t16:00,weather.taf.strongWind(weather.wind.level.strong,weather.wind.from(weather.compass.from.S,22kt)))',
    ])
  })

  it('henüz başlamamış tahmin: zaman penceresiyle', () => {
    expect(
      items([taf('TAF LTXX 151040Z 1512/1618 20010KT 3000 TSRA BKN030CB')], '2026-01-15T11:00:00Z'),
    ).toEqual(['weather.taf.base(t12:00,weather.time.tomorrow(t18:00),weather.wx.TSRA)'])
    expect(
      items(
        [taf('TAF LTXX 151040Z 1512/1618 20010KT 9999 SCT030 FM151500 22012KT 4000 RA BKN012')],
        NOW,
      ),
    ).toEqual(['weather.taf.fm(t15:00,weather.wx.RA)'])
    expect(
      items([taf('TAF LTXX 151040Z 1512/1618 20010KT 9999 SCT030 BECMG 1516/1518 3000 BR')], NOW),
    ).toEqual(['weather.taf.becmg(t16:00,t18:00,weather.wx.BR)'])
    expect(
      items([taf('TAF LTXX 151040Z 1512/1618 20010KT 9999 SCT030 PROB30 1520/1524 0800 FG')], NOW),
    ).toEqual(['weather.taf.prob(t20:00,weather.time.tomorrow(t00:00),30,weather.wx.FG)'])
  })

  it('önemli olay yok, süresi dolmuş, iptal ve NIL', () => {
    const quiet = summarizeTaf([taf('TAF LTXX 151040Z 1512/1618 04010KT CAVOK')], NOW)
    expect(quiet.items).toEqual([])
    expect(fake(quiet.message)).toBe('weather.taf.nothingSignificant')

    const expired = summarizeTaf([taf('TAF LTBJ 140440Z 1406/1506 VRB03KT 9999 FEW040')], NOW)
    expect(expired).toMatchObject({ status: 'none', items: [], validUntil: null })
    expect(fake(expired.message)).toBe('weather.taf.none')
    expect(summarizeTaf([], NOW).status).toBe('none')

    const cancelled = summarizeTaf(
      [taf('TAF LTXX 151040Z 1512/1618 04010KT CAVOK'), taf('TAF AMD LTXX 151215Z 1512/1618 CNL')],
      NOW,
    )
    expect(cancelled.status).toBe('cancelled')
    expect(fake(cancelled.message)).toBe('weather.taf.cancelled')

    const nil = summarizeTaf(
      [decodeTaf('TAF LTXX 151040Z NIL', { referenceTime: NOW, validTo: '2026-01-16T18:00:00Z' })],
      NOW,
    )
    expect(nil.status).toBe('nil')
  })

  it('ufuk 24 saattir, tahmin geçerlilik sonunun ötesine uzatılmaz', () => {
    const t = taf('TAF LTXX 151040Z 1512/1618 20010KT 9999 SCT030 TEMPO 1614/1618 TSRA')
    // 16 Ocak 14:00 şimdiden 25 saat sonra: ufuk dışında.
    expect(items([t])).toEqual([])
    expect(items([t], '2026-01-16T13:00:00Z')).toEqual([
      'weather.taf.tempo(t14:00,t18:00,weather.wx.TSRA)',
    ])
    expect(summarizeTaf([t], '2026-01-16T18:00:00Z').status).toBe('none')
  })
})

/** Özet ağacındaki bütün anahtarları ve değişken adlarını toplar. */
function collectKeys(value: WeatherParam, out: Map<string, string[]>): void {
  if (typeof value !== 'object') return
  if (isMeasure(value)) return
  if (isPhraseList(value)) {
    for (const item of value.list) collectKeys(item, out)
    return
  }
  if (isPhrase(value)) {
    out.set(value.key, Object.keys(value.params ?? {}).sort())
    for (const param of Object.values(value.params ?? {})) collectKeys(param, out)
  }
}

describe('metin anahtarı kaydı', () => {
  const METARS = [
    'LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA',
    'LTBA 151250Z 04008KT CAVOK 10/03 Q1010 NOSIG',
    'LTAC 151250Z 32012KT 1500 SN BR BKN008 OVC015 M01/M02 Q1018 BECMG 3000 -SN',
    'LTAU 151250Z 23008KT 9999 VCTS SCT040CB BKN100 07/M01 Q1013 NOSIG',
    'METAR LTBQ 151250Z NIL=',
    'METAR COR LTXX 151250Z AUTO VRB25KT 220V010 6000 1400SW // DU VCPO RERA RETS NSC 30/05 Q1010 BECMG CAVOK TEMPO 30030G45KT P6SM VCSH NSW VV///',
    'LTXX 151250Z 220P99KT M1/4SM FG VV001 05/04 Q1010 TEMPO 9999 SKC',
  ]
  const TAFS = [
    'TAF LTFM 151040Z 1512/1618 03015G28KT 9999 SCT025 BKN035 TEMPO 1512/1518 4000 SHRA FEW025CB PROB30 TEMPO 1514/1518 TSRA BECMG 1520/1522 02008KT',
    'TAF LTCE 151040Z 1512/1612 27020G35KT 0800 +SHSN BLSN VV004 BECMG 1516/1518 25012KT 3000 -SN BKN010',
    'TAF LTXX 151040Z 1513/1618 20010KT 9999 SCT030 FM151500 22012KT 4000 RA BKN012 PROB40 1516/1518 VCTS',
  ]

  it('özetleyiciler yalnız kayıtlı anahtarları, kayıttaki değişkenlerle kullanır', () => {
    const keys = new Map<string, string[]>()
    for (const raw of METARS) {
      const s = summarizeMetar(metar(raw))
      for (const value of [s.headline, s.next2h, ...Object.values(s.rows), ...s.notes]) {
        if (value) collectKeys(value, keys)
      }
    }
    const tafs = TAFS.map(taf)
    for (const now of [NOW, '2026-01-15T11:00:00Z', '2026-01-17T00:00:00Z']) {
      const s = summarizeTaf(tafs, now)
      for (const value of [...s.items, s.validUntil, s.message]) if (value) collectKeys(value, keys)
    }
    for (const [key, params] of keys) {
      expect(WEATHER_PHRASE_KEYS[key], key).toBeDefined()
      expect(params, key).toEqual([...(WEATHER_PHRASE_KEYS[key] ?? [])].sort())
    }
    // Kayıttaki anahtarların önemli bir kısmı bu örneklerle gerçekten üretilir.
    expect(keys.size).toBeGreaterThan(40)
  })

  it('kayıt anahtarları tekrarsız, `weather.` önekli ve i18n yolu olarak geçerlidir', () => {
    for (const key of Object.keys(WEATHER_PHRASE_KEYS)) {
      expect(key).toMatch(/^weather\.[A-Za-z0-9_.]+$/)
      expect(key.split('.').every((part) => part.length > 0)).toBe(true)
    }
  })
})

describe('renderWeatherText', () => {
  const TR: Partial<Record<WeatherPhraseKey, string>> = {
    'weather.wind.from': '{direction} {speed}',
    'weather.wind.gust': 'hamle {speed}',
    'weather.compass.from.NE': 'Kuzeydoğudan',
    'weather.value.vicinity': 'Havalimanında yok; çevresinde {phrase}',
    'weather.wx.VCSH': 'sağanak',
    'weather.wx.SHRA_light': 'Hafif sağanak yağmur',
    'weather.taf.until': '{to} saatine kadar {phrase}',
    'weather.time.tomorrow': 'yarın {time}',
    'weather.wx.IC': 'Işıltılı buz kristalleri',
    'weather.value.recent': 'Şu an yok; kısa süre önce {phrase}',
    'weather.change.cavok': 'CAVOK koşulları',
    'weather.trend.tempo': 'Önümüzdeki 2 saatte ara ara {change}',
  }
  const EN: Partial<Record<WeatherPhraseKey, string>> = {
    'weather.wind.from': '{direction} {speed}',
    'weather.wind.gust': 'gusts {speed}',
    'weather.compass.from.NE': 'from the northeast',
  }
  const measureTr = (m: Measure) =>
    m.measure === 'speed'
      ? `${ktToKmh(m.kt)} km/sa`
      : m.measure === 'time'
        ? '18:00'
        : fakeMeasure(m)
  const measureEn = (m: Measure) =>
    m.measure === 'speed' ? `${ktToKmh(m.kt)} km/h` : fakeMeasure(m)
  const tr = (value: WeatherText) =>
    renderWeatherText(value, {
      locale: 'tr',
      text: (key) => TR[key] ?? keyTemplate(key),
      measure: measureTr,
    })
  const en = (value: WeatherText) =>
    renderWeatherText(value, {
      locale: 'en',
      text: (key) => EN[key] ?? keyTemplate(key),
      measure: measureEn,
    })

  it('iç içe parçalar küçük harfle, bütün metin büyük harfle başlar', () => {
    const wind = summarizeMetar(metar('LTFM 151250Z 03018G32KT 9999 FEW025 09/05 Q1009')).rows.wind
    expect(tr(wind)).toBe('Kuzeydoğudan 33 km/sa, hamle 59 km/sa')
    expect(en(wind)).toBe('From the northeast 33 km/h, gusts 59 km/h')
    const rain = summarizeMetar(metar('LTXX 151250Z 18005KT 9999 VCSH FEW030 10/05 Q1010')).rows
      .rain
    expect(tr(rain)).toBe('Havalimanında yok; çevresinde sağanak')
  })

  it('Türkçe büyük/küçük harf (I/ı, İ/i) ve kısaltmalar', () => {
    expect(capitalizeFirst('ılık', 'tr')).toBe('Ilık')
    expect(capitalizeFirst('istanbul', 'tr')).toBe('İstanbul')
    expect(capitalizeFirst('istanbul', 'en')).toBe('Istanbul')
    expect(tr({ key: 'weather.value.recent', params: { phrase: { key: 'weather.wx.IC' } } })).toBe(
      'Şu an yok; kısa süre önce ışıltılı buz kristalleri',
    )
    // Büyük harfle süren kısaltma küçültülmez.
    expect(
      tr({ key: 'weather.trend.tempo', params: { change: { key: 'weather.change.cavok' } } }),
    ).toBe('Önümüzdeki 2 saatte ara ara CAVOK koşulları')
  })

  it('eksik değişken hata fırlatır; büyük harf seçeneği kapatılabilir', () => {
    expect(() => tr({ key: 'weather.wind.gust' })).toThrow(/speed/)
    expect(
      renderWeatherText(
        { key: 'weather.wx.SHRA_light' },
        { locale: 'tr', text: (key) => TR[key] ?? key, measure: measureTr },
        { capitalize: false },
      ),
    ).toBe('hafif sağanak yağmur')
  })

  it('messageAt noktalı yolu okur', () => {
    const messages = { weather: { wx: { RA: 'Yağmur' }, value: { none: 'Yok' } } }
    expect(messageAt(messages, 'weather.wx.RA')).toBe('Yağmur')
    expect(messageAt(messages, 'weather.wx')).toBeUndefined()
    expect(messageAt(messages, 'weather.wx.SN')).toBeUndefined()
    expect(messageAt(null, 'weather')).toBeUndefined()
  })
})

describe('gösterim yardımcıları', () => {
  it('kt → km/sa', () => {
    expect([ktToKmh(18), ktToKmh(32), ktToKmh(100)]).toEqual([33, 59, 185])
  })
  it('bulut tabanı: 1000 m altı 10 m, üstü 50 m adım', () => {
    expect([
      cloudBaseMeters(100),
      cloudBaseMeters(2500),
      cloudBaseMeters(3500),
      cloudBaseMeters(5000),
    ]).toEqual([30, 760, 1050, 1500])
  })
  it('görüş: m, bir ondalıklı km, tam km (aşağı yuvarlanır)', () => {
    expect(visibilityDisplay(350)).toEqual({ value: 350, unit: 'm', fractionDigits: 0 })
    expect(visibilityDisplay(1500)).toEqual({ value: 1.5, unit: 'km', fractionDigits: 1 })
    expect(visibilityDisplay(4000)).toEqual({ value: 4, unit: 'km', fractionDigits: 0 })
    expect(visibilityDisplay(7000)).toEqual({ value: 7, unit: 'km', fractionDigits: 0 })
    expect(visibilityDisplay(9656)).toEqual({ value: 9, unit: 'km', fractionDigits: 0 })
    expect(visibilityDisplay(2414)).toEqual({ value: 2.4, unit: 'km', fractionDigits: 1 })
  })
})
