import {
  decodeMetar,
  decodeTaf,
  messageAt,
  summarizeMetar,
  summarizeTaf,
  WEATHER_PHRASE_KEYS,
  WIND_LEVELS,
  WX_PHRASE_IDS,
  type AirportTaf,
  type Locale,
} from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { getMessages } from './index'
import {
  formatAgo,
  formatClock,
  formatDayTime,
  formatDuration,
  formatFeet,
  formatHeight,
  formatPressure,
  formatTemperature,
  formatUtcClock,
  formatUtcOffset,
  formatVisibility,
  formatWindSpeed,
  formatWindSpeedBoth,
  formatWindSpeedDual,
  weatherText,
  type WeatherTextOptions,
} from './weather'

const MINUS = '−'
const opts = (locale: Locale): WeatherTextOptions => ({ locale, t: getMessages(locale).weather })
const TR = opts('tr')
const EN = opts('en')

/** Sentetik gözlem anı (fixture'larla aynı): 15 Ocak 2026 12:50Z = 15:50 İstanbul. */
const OBSERVED = '2026-01-15T12:50:00.000Z'
const NOW = Date.parse('2026-01-15T13:00:00.000Z')

/**
 * Rüzgâr hızındaki bölünmez boşluklar (U+00A0; sayı birimiyle, knot karşılığı km/sa ile aynı satırda
 * kalır, D-083) olağan boşluğa çevrilir: beklenen metinler okunur kalır. Bölünmez boşlukların yeri
 * "birimler" testinde ve `M6e` bölümünde ayrıca denetlenir.
 */
const spaced = (text: string) => text.replace(/\u00a0/g, ' ')

function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort()
}

/** METAR'ın sade satırları, verilen dilde; rüzgâr şiddeti etiketi (`level`) arayüzdeki gibi. */
function rows(raw: string, options = TR) {
  const summary = summarizeMetar(decodeMetar(raw, { observedAt: OBSERVED }))
  const text = (value: Parameters<typeof weatherText>[0] | null) =>
    value === null ? null : spaced(weatherText(value, options))
  return {
    headline: text(summary.headline),
    wind: text(summary.rows.wind),
    rain: text(summary.rows.rain),
    snow: text(summary.rows.snow),
    thunder: text(summary.rows.thunderstorm),
    fog: text(summary.rows.fog),
    hail: text(summary.rows.hail),
    other: text(summary.rows.other),
    visibility: text(summary.rows.visibility),
    clouds: text(summary.rows.clouds),
    temperature: text(summary.rows.temperature),
    humidity: text(summary.rows.humidity),
    pressure: text(summary.rows.pressure),
    next2h: text(summary.next2h),
    notes: summary.notes.map((note) => spaced(weatherText(note, options))),
    strongWind: summary.strongWind,
    level: summary.windLevel ? options.t.wind.level[summary.windLevel] : null,
    windLight: summary.windLight,
    shear: text(summary.windShear),
    lightning: summary.lightning,
  }
}

describe('hava durumu metin anahtarları', () => {
  it('çözücünün üretebildiği her anahtar iki dilde de var ve aynı yer tutucuları taşır', () => {
    const missing: string[] = []
    const mismatched: string[] = []
    for (const locale of ['tr', 'en'] as const) {
      const messages = getMessages(locale)
      for (const [key, params] of Object.entries(WEATHER_PHRASE_KEYS)) {
        const template = messageAt(messages, key)
        if (template === undefined) missing.push(`${locale}:${key}`)
        else if (placeholders(template).join() !== [...params].sort().join()) {
          mismatched.push(`${locale}:${key}`)
        }
      }
    }
    expect(missing).toEqual([])
    expect(mismatched).toEqual([])
    expect(Object.keys(WEATHER_PHRASE_KEYS).length).toBeGreaterThan(WX_PHRASE_IDS.length)
  })

  it('MGM sözcükleri: gök gürültülü olaylar "fırtına" değildir; olasılıkta "bekleniyor" yazılmaz', () => {
    const t = getMessages('tr').weather
    const thunder = Object.entries(t.wx).filter(([id]) => id.startsWith('TS'))
    expect(thunder.length).toBeGreaterThan(10)
    for (const [id, text] of thunder) expect(text, id).not.toMatch(/fırtına|oraj/i)
    for (const locale of ['tr', 'en'] as const) {
      const taf = getMessages(locale).weather.taf
      for (const text of [taf.prob, taf.probTempo, taf.probUntil, taf.probTempoUntil]) {
        expect(text).not.toMatch(/bekleniyor|expected/i)
      }
    }
    expect(t.wx.HZ).toBe('Kuru pus')
    expect(t.clouds.OVC).toBe('Kapalı')
  })

  it('şimşek ve yıldırım uyarısı her durumda yazılır; "güvenli" ya da "risk yok" denmez (D-083)', () => {
    for (const locale of ['tr', 'en'] as const) {
      const thunder = getMessages(locale).weather.thunder
      for (const [id, text] of Object.entries(thunder)) {
        expect(text, `${locale}:${id}`).toMatch(locale === 'tr' ? /yıldırım/ : /lightning/)
        expect(text, `${locale}:${id}`).not.toMatch(/güvenli|risk yok|\bsafe\b|no risk/i)
        // TS için "fırtına" denmez (D-078); "oraj" yalnız bulutun açıklamasında.
        expect(text, `${locale}:${id}`).not.toMatch(/fırtına/i)
      }
      // Tehlike havalimanında oraj ya da kümülonimbüs ve yağış varken; çevrede "düşebilir",
      // yağışsız bulutta "olabilir". Tehlike yazan metin "Yok" ile başlamaz.
      expect(thunder.here).toMatch(locale === 'tr' ? /tehlikesi$/ : /danger$/)
      expect(thunder.hereDry).toMatch(locale === 'tr' ? /yağış yok/ : /no precipitation/)
      expect(thunder.vicinity).toMatch(locale === 'tr' ? /düşebilir$/ : /too$/)
      expect(thunder.cloudPrecip).toMatch(
        locale === 'tr'
          ? /^Kümülonimbüs .*yağış var; .*tehlikesi$/
          : /^Cumulonimbus .*precipitation.*danger$/,
      )
      expect(thunder.cloud).toMatch(locale === 'tr' ? /^Yok; .*olabilir$/ : /^None; .*possible$/)
    }
  })

  it('rüzgâr şiddeti adları MGM Beaufort ıskalasındandır (D-083)', () => {
    expect(Object.values(getMessages('tr').weather.wind.level)).toEqual([
      'Hamleli rüzgâr',
      'Sert rüzgâr',
      'Kuvvetli hamle',
      'Kuvvetli rüzgâr',
      'Fırtınamsı rüzgâr',
      'Fırtına',
      'Kuvvetli fırtına',
      'Tam fırtına',
      'Çok şiddetli fırtına',
      'Harikeyn (orkan)',
    ])
    expect(Object.keys(getMessages('en').weather.wind.level)).toEqual([...WIND_LEVELS])
  })

  it('sayıdan ya da sayı yazan yer tutucudan önce "·" ya da "–" yok (eksi gibi okunur; 2026-10-02)', () => {
    const offending: string[] = []
    const walk = (node: unknown, path: string) => {
      if (typeof node === 'string') {
        if (/[·–]\s*(?:\{|[−-]?\d)/.test(node)) offending.push(path)
        return
      }
      if (node === null || typeof node !== 'object') return
      for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`)
    }
    for (const locale of ['tr', 'en'] as const) {
      const messages = getMessages(locale)
      walk(messages.weather, `${locale}:weather`)
      walk(messages.map.airportPopup, `${locale}:map.airportPopup`)
    }
    expect(offending).toEqual([])
  })
})

describe('birimler (metrik, D-072)', () => {
  it('sıcaklık tam derece, eksi U+2212, sıfır işaretsiz', () => {
    expect(formatTemperature(9, 'tr')).toBe('9 °C')
    expect(formatTemperature(-1, 'tr')).toBe(`${MINUS}1 °C`)
    expect(formatTemperature(-0.4, 'en')).toBe('0 °C')
    expect(formatTemperature(null, 'tr')).toBe('—')
  })

  it('basınç binlik ayırıcısız', () => {
    expect(formatPressure(1009, 'tr')).toBe('1009 hPa')
    expect(formatPressure(1013.2, 'en')).toBe('1013 hPa')
  })

  it('bulut tabanı: 1.000 m altı 10 m, üstü 50 m adımla; uzman ft', () => {
    expect(formatHeight(2500, 'tr')).toBe('760 m')
    // 3.500 ft = 1.066,8 m: 1.000 m üstünde en yakın 50 m.
    expect(formatHeight(3500, 'tr')).toBe('1.050 m')
    expect(formatHeight(3500, 'en')).toBe('1,050 m')
    expect(formatHeight(100, 'tr')).toBe('30 m')
    expect(formatFeet(1800, 'tr')).toBe('1.800 ft')
  })

  it('görüş: metre ya da km', () => {
    expect(formatVisibility(350, 'tr')).toBe('350 m')
    expect(formatVisibility(1500, 'tr')).toBe('1,5 km')
    expect(formatVisibility(1500, 'en')).toBe('1.5 km')
    expect(formatVisibility(4000, 'tr')).toBe('4 km')
    expect(formatVisibility(null, 'tr')).toBe('—')
  })

  it('rüzgâr: sade görünümde km/sa ve parantezde kt (D-083); uzman görünümünde kt önce', () => {
    expect(spaced(formatWindSpeed(18, 'tr'))).toBe('33 km/sa')
    expect(spaced(formatWindSpeed(32, 'en'))).toBe('59 km/h')
    expect(spaced(formatWindSpeedDual(18, 'tr'))).toBe('33 km/sa (18 kt)')
    expect(spaced(formatWindSpeedDual(32, 'en'))).toBe('59 km/h (32 kt)')
    expect(spaced(formatWindSpeedDual(100, 'tr'))).toBe('185 km/sa (100 kt)')
    // MPS raporu: km/sa raporun biriminden (11 m/s = 40 km/sa), kt yuvarlanmış.
    expect(spaced(formatWindSpeedDual(21, 'tr', 40))).toBe('40 km/sa (21 kt)')
    expect(formatWindSpeedDual(null, 'tr')).toBe('—')
    expect(spaced(formatWindSpeedBoth(18, 'tr'))).toBe('18 kt (33 km/sa)')
    expect(spaced(formatWindSpeedBoth(21, 'en', 40))).toBe('21 kt (40 km/h)')
  })

  it('rüzgâr hızı tek parça: sayı ile birim ve knot karşılığı bölünmez boşlukla (D-083)', () => {
    // Pencerenin dar değer sütununda "48" ile "km/sa", "(7" ile "kt)" ayrı satıra düşüyordu.
    const NB = '\u00a0'
    expect(formatWindSpeed(18, 'tr')).toBe(`33${NB}km/sa`)
    expect(formatWindSpeedDual(26, 'tr')).toBe(`48${NB}km/sa${NB}(26${NB}kt)`)
    expect(formatWindSpeedDual(7, 'en')).toBe(`13${NB}km/h${NB}(7${NB}kt)`)
    expect(formatWindSpeedDual(21, 'tr', 40)).toBe(`40${NB}km/sa${NB}(21${NB}kt)`)
    expect(formatWindSpeedBoth(18, 'tr')).toBe(`18${NB}kt${NB}(33${NB}km/sa)`)
    // Bütün satırda kırılma yalnız sözcükler arasındadır.
    const raw = 'LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009'
    const wind = (options: WeatherTextOptions) =>
      weatherText(summarizeMetar(decodeMetar(raw, { observedAt: OBSERVED })).rows.wind, options)
    expect(wind(TR)).toBe(
      `Kuzeydoğudan 33${NB}km/sa${NB}(18${NB}kt), hamle 59${NB}km/sa${NB}(32${NB}kt)`,
    )
    expect(wind(EN)).toBe(
      `From the northeast 33${NB}km/h${NB}(18${NB}kt), gusts 59${NB}km/h${NB}(32${NB}kt)`,
    )
    for (const text of [wind(TR), wind(EN)])
      expect(text).not.toMatch(/\d (km|kt)|(km\/sa|km\/h) \(/)
  })
})

describe('zaman', () => {
  it('yerel saat İstanbul, UTC ayrı, ofset Intl ile', () => {
    expect(formatClock(OBSERVED)).toBe('15:50')
    expect(formatUtcClock(OBSERVED)).toBe('12:50')
    expect(formatUtcOffset(OBSERVED)).toBe('UTC+3')
    expect(formatClock('bozuk')).toBe('—')
  })

  it('süre ve göreli yaş', () => {
    expect(formatDuration(18 * 60_000, TR)).toBe('18 dakika')
    expect(formatDuration(130 * 60_000, TR)).toBe('2 saat 10 dakika')
    expect(formatDuration(130 * 60_000, EN)).toBe('2 h 10 min')
    expect(formatDuration(6 * 3_600_000 + 5 * 60_000, TR)).toBe('6 saat')
    expect(formatDuration(3 * 86_400_000, TR)).toBe('3 gün')
    expect(formatAgo(OBSERVED, NOW, TR)).toBe('10 dakika önce')
    expect(formatAgo(OBSERVED, NOW, EN)).toBe('10 min ago')
    expect(formatAgo(OBSERVED, Date.parse(OBSERVED) + 20_000, TR)).toBe('az önce')
  })

  it('gün değişince "yarın" ya da tarih yazılır', () => {
    expect(formatDayTime('2026-01-15T18:00:00Z', NOW, TR)).toBe('21:00')
    expect(formatDayTime('2026-01-16T18:00:00Z', NOW, TR)).toBe('yarın 21:00')
    expect(formatDayTime('2026-01-16T18:00:00Z', NOW, EN)).toBe('21:00 tomorrow')
    expect(formatDayTime('2026-01-14T19:50:00Z', NOW, TR)).toBe('14 Ocak 22:50')
  })

  it('havalimanının saat dilimi (D-084): yerel saat, yaz saatiyle UTC farkı, gün ve "yarın"', () => {
    // Atina: 25 Ekim 2026 01:00 UTC'ye kadar UTC+3, sonra UTC+2.
    expect(formatClock('2026-10-24T20:05:00Z', 'Europe/Athens')).toBe('23:05')
    expect(formatUtcOffset('2026-10-24T20:05:00Z', 'Europe/Athens')).toBe('UTC+3')
    expect(formatClock('2026-10-26T21:05:00Z', 'Europe/Athens')).toBe('23:05')
    expect(formatUtcOffset('2026-10-26T21:05:00Z', 'Europe/Athens')).toBe('UTC+2')
    // Tahran yarım saat: UTC+3:30; Tiflis UTC+4; Sohum Moskova saati UTC+3; batı yarıkürede eksi.
    expect(formatClock(OBSERVED, 'Asia/Tehran')).toBe('16:20')
    expect(formatUtcOffset(OBSERVED, 'Asia/Tehran')).toBe('UTC+3:30')
    expect(formatUtcOffset(OBSERVED, 'Asia/Tbilisi')).toBe('UTC+4')
    expect(formatUtcOffset(OBSERVED, 'Europe/Moscow')).toBe('UTC+3')
    expect(formatUtcOffset(OBSERVED, 'America/New_York')).toBe(`UTC${MINUS}5`)
    expect(formatUtcOffset(OBSERVED, 'Europe/London')).toBe('UTC')
    // Varsayılan dilim İstanbul'dur (Türkiye sayfaları değişmez).
    expect(formatClock(OBSERVED, 'Europe/Istanbul')).toBe(formatClock(OBSERVED))
    expect(formatUtcOffset(OBSERVED, 'Europe/Istanbul')).toBe('UTC+3')

    // "Yarın" havalimanının takvimine göredir: 15 Ocak 21:30Z İstanbul'da 16 Ocak 00:30, Atina'da
    // 15 Ocak 23:30.
    const athens = { ...TR, timeZone: 'Europe/Athens' }
    expect(formatDayTime('2026-01-15T21:30:00Z', NOW, TR)).toBe('yarın 00:30')
    expect(formatDayTime('2026-01-15T21:30:00Z', NOW, athens)).toBe('23:30')
    expect(formatDayTime('2026-01-17T07:00:00Z', NOW, { ...EN, timeZone: 'Asia/Tehran' })).toBe(
      '17 January 10:30',
    )
  })

  it('özet metninde saat ve tarih havalimanının diliminde (TAF geçerlilik sonu)', () => {
    const lgav: AirportTaf = {
      ...decodeTaf('TAF LGAV 151040Z 1512/1618 03010KT 9999 SCT030', {
        issuedAt: '2026-01-15T10:40:00.000Z',
        validFrom: '2026-01-15T12:00:00.000Z',
        validTo: '2026-01-16T18:00:00.000Z',
      }),
      issuedAt: '2026-01-15T10:40:00.000Z',
      validFrom: '2026-01-15T12:00:00.000Z',
      validTo: '2026-01-16T18:00:00.000Z',
    }
    const athens = summarizeTaf([lgav], NOW, { timeZone: 'Europe/Athens' })
    expect(
      athens.validUntil && weatherText(athens.validUntil, { ...TR, timeZone: 'Europe/Athens' }),
    ).toBe('Tahminin geçerlilik sonu: yarın 20:00.')
    expect(
      athens.validUntil && weatherText(athens.validUntil, { ...EN, timeZone: 'Asia/Tehran' }),
    ).toBe('Forecast valid until 21:30 tomorrow.')
  })
})

describe('METAR özetleri: fixture durumları (brief §2), sade ve metrik', () => {
  it('LTFM: hafif sağanak, hamleli kuvvetli rüzgâr, CB, TEMPO', () => {
    const r = rows('LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA')
    expect(r.headline).toBe('Hafif sağanak yağmur')
    expect(r.wind).toBe('Kuzeydoğudan 33 km/sa (18 kt), hamle 59 km/sa (32 kt)')
    expect(r.strongWind).toBe(true)
    expect(r.level).toBe('Kuvvetli hamle')
    expect(r.rain).toBe('Hafif sağanak yağmur')
    expect(r.snow).toBe('Yok')
    // Kümülonimbüs ve havalimanında yağış: "Yok" denmez, tehlike yazılır (kullanıcının sözü,
    // 2026-10-03: "yağmurla beraber, şimşek ve yıldırım tehlikesi").
    expect(r.thunder).toBe('Kümülonimbüs (oraj bulutu) ve yağış var; şimşek ve yıldırım tehlikesi')
    expect(r.fog).toBe('Yok')
    expect(r.visibility).toBe('10 km ve üzeri')
    expect(r.clouds).toBe('Çok bulutlu, en alçak bulut 760 m, kümülonimbüs')
    expect(r.temperature).toBe('9 °C')
    expect(r.humidity).toBe('Yaklaşık %75')
    expect(r.pressure).toBe('1009 hPa')
    expect(r.next2h).toBe('Önümüzdeki 2 saatte ara ara: görüş 4 km, sağanak yağmur')
    const en = rows(
      'LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA',
      EN,
    )
    expect(en.headline).toBe('Light rain showers')
    expect(en.wind).toBe('From the northeast 33 km/h (18 kt), gusts 59 km/h (32 kt)')
    expect(en.level).toBe('Strong gusts')
    expect(en.thunder).toBe(
      'Cumulonimbus (thunderstorm cloud) and precipitation present; lightning danger',
    )
    expect(en.clouds).toBe('Mostly cloudy, lowest cloud 760 m, cumulonimbus')
    expect(en.humidity).toBe('About 75%')
    expect(en.next2h).toBe('At times in the next 2 hours: visibility 4 km, rain showers')
  })

  it('LTBA: CAVOK, NOSIG', () => {
    const r = rows('LTBA 151250Z 04008KT CAVOK 10/03 Q1010 NOSIG')
    expect(r.headline).toBe('Görüş iyi, alçak bulut yok')
    expect(r.visibility).toBe('10 km ve üzeri')
    expect(r.clouds).toBe('Alçak bulut yok')
    expect(r.next2h).toBe('Önümüzdeki 2 saatte önemli değişiklik beklenmiyor')
    expect([r.rain, r.snow, r.thunder, r.fog]).toEqual(['Yok', 'Yok', 'Yok', 'Yok'])
  })

  it('LTAC: kar ve pus, sıfırın altı, 1,5 km', () => {
    const r = rows('LTAC 151250Z 32012KT 1500 SN BR BKN008 OVC015 M01/M02 Q1018 BECMG 3000 -SN')
    expect(r.headline).toBe('Kar')
    expect(r.wind).toBe('Kuzeybatıdan 22 km/sa (12 kt)')
    expect(r.snow).toBe('Kar')
    expect(r.fog).toBe('Pus')
    expect(r.rain).toBe('Yok')
    expect(r.visibility).toBe('1,5 km')
    expect(r.temperature).toBe(`${MINUS}1 °C`)
    expect(r.clouds).toBe('Kapalı, en alçak bulut 240 m')
  })

  it('LTAI: kuvvetli gök gürültülü sağanak, değişken yön aralığı; yıldırım tehlikesi', () => {
    const r = rows(
      'LTAI 151250Z 20015G28KT 160V240 3000 +TSRA SCT015CB BKN030 16/14 Q1006 TEMPO 1500 +TSRA',
    )
    expect(r.rain).toBe('Kuvvetli gök gürültülü sağanak')
    expect(r.thunder).toBe('Gök gürültüsü var; şimşek ve yıldırım tehlikesi')
    expect(r.wind).toBe(
      'Güneyden 28 km/sa (15 kt), hamle 52 km/sa (28 kt), yönü güney ile güneybatı arasında değişiyor',
    )
    // Hamle 28 kt ≥ 25 kt: satır vurgulanır (kullanıcı kararı 2026-10-03, D-083).
    expect(r.level).toBe('Hamleli rüzgâr')
    expect(r.strongWind).toBe(false)
    expect(r.visibility).toBe('3 km')
    const en = rows('LTAI 151250Z 20015G28KT 160V240 3000 +TSRA SCT015CB 16/14 Q1006', EN)
    expect(en.rain).toBe('Thunderstorm with heavy rain')
    expect(en.thunder).toBe('Thunderstorm at the airport; lightning danger')
  })

  it('LTBJ: hafif değişken rüzgâr; LTCG: sakin, sis, dikey görüş', () => {
    expect(rows('LTBJ 151250Z VRB02KT 9999 FEW040 14/06 Q1012 NOSIG').wind).toBe(
      'Hafif ve değişken yönlü',
    )
    const fog = rows('LTCG 151250Z 00000KT 0200 R11/0350N FG VV001 08/08 Q1015 BECMG 1500 BR')
    expect(fog.wind).toBe('Sakin')
    expect(fog.headline).toBe('Sis')
    expect(fog.fog).toBe('Sis')
    expect(fog.visibility).toBe('200 m')
    expect(fog.clouds).toBe('Gökyüzü görünmüyor (dikey görüş 30 m)')
    expect(fog.humidity).toBe('Yaklaşık %100')
  })

  it('LTAU: çevrede gök gürültüsü; yıldırım havalimanına da düşebilir', () => {
    const r = rows('LTAU 151250Z 23008KT 9999 VCTS SCT040CB BKN100 07/M01 Q1013 NOSIG')
    expect(r.thunder).toBe(
      'Havalimanı çevresinde gök gürültüsü var; yıldırım havalimanına da düşebilir',
    )
    expect(rows('LTAU 151250Z 23008KT 9999 VCTS SCT040CB 07/M01 Q1013', EN).thunder).toBe(
      'Thunderstorm near the airport; lightning can strike the airport too',
    )
  })

  it('LTBS SPECI: dolulu gök gürültülü sağanak; dolu satırı ve özel rapor notu', () => {
    const r = rows('SPECI LTBS 151242Z 25015G27KT 2000 +TSRAGR SCT012CB BKN025 12/10 Q1007')
    expect(r.rain).toBe('Dolulu, kuvvetli gök gürültülü sağanak')
    expect(r.thunder).toBe('Gök gürültüsü var; şimşek ve yıldırım tehlikesi')
    expect(r.hail).not.toBeNull()
    expect(r.notes).toContain(getMessages('tr').weather.note.speci)
  })

  it('LTCF donan yağmur; LTCE kar sağanağı ve savrulan kar; LTDB kuru pus', () => {
    expect(rows('LTCF 151250Z 00000KT 2500 FZRA BR OVC005 M01/M02 Q1022 NOSIG').rain).toBe(
      'Donan yağmur (buzlanma yapar)',
    )
    expect(
      rows('LTCE 151250Z 27022G35KT 0800 +SHSN BLSN VV004 M08/M10 Q1021 TEMPO 0400 +SHSN').snow,
    ).toBe('Kuvvetli kar sağanağı, savrulan kar')
    const haze = rows('LTDB 151250Z 18006KT 4000 HZ NSC 19/08 Q1008 NOSIG')
    expect(haze.fog).toBe('Kuru pus')
    expect(haze.clouds).toBe('Alçak bulut yok')
  })

  it('LTFJ: hafif çisenti ve pus; son saatte yağmur yalnızca havalimanında yağış yoksa söylenir', () => {
    const r = rows('LTFJ 151250Z 06010KT 4000 -DZ BR SCT006 OVC012 08/07 Q1011 RERA NOSIG')
    expect(r.rain).toBe('Hafif çisenti')
    expect(r.fog).toBe('Pus')
    expect(rows('LTFJ 151250Z 06010KT 9999 SCT030 08/07 Q1011 RERA NOSIG').rain).toBe(
      'Şu an yok; kısa süre önce yağmur',
    )
  })

  it('hava olayı belirlenemeyen rapor "yok" demez; NIL rapor', () => {
    const auto = rows('LTXX 151250Z AUTO 03010KT 9999 // NCD 10/05 Q1010')
    expect([auto.rain, auto.snow, auto.thunder, auto.fog]).toEqual(Array(4).fill('Belirlenemedi'))
    expect(auto.notes).toContain(getMessages('tr').weather.note.auto)
    const nil = rows('LTXX 151250Z NIL')
    expect(nil.headline).toBe('Rapor yok')
    expect(nil.rain).toBe('Belirlenemedi')
  })

  it('her hava olayı kimliği iki dilde de metne çevrilir; çözülmemiş yer tutucu kalmaz', () => {
    for (const options of [TR, EN]) {
      for (const id of WX_PHRASE_IDS) {
        const text = weatherText({ key: `weather.wx.${id}` }, options)
        expect(text, id).not.toMatch(/[{}]/)
        expect(text.length, id).toBeGreaterThan(1)
      }
    }
  })
})

describe('M6e: km/sa ve kt, rüzgâr şiddeti, şimşek ve yıldırım (D-083)', () => {
  /** Üretimdeki ekran görüntülerinin durumları (2026-10-03) ve sınır durumları, iki dilde. */
  it('Gazipaşa: gök gürültülü hafif sağanak; rüzgâr etiketsiz, yıldırım tehlikesi', () => {
    const raw = 'LTFG 031250Z 14007KT 9999 -TSRA FEW025CB SCT030 BKN100 24/19 Q1012'
    const r = rows(raw)
    expect(r.wind).toBe('Güneydoğudan 13 km/sa (7 kt)')
    expect(r.level).toBeNull()
    expect(r.rain).toBe('Gök gürültülü hafif sağanak')
    expect(r.thunder).toBe('Gök gürültüsü var; şimşek ve yıldırım tehlikesi')
    const en = rows(raw, EN)
    expect(en.wind).toBe('From the southeast 13 km/h (7 kt)')
    expect(en.thunder).toBe('Thunderstorm at the airport; lightning danger')
  })

  it('İstanbul: kuzeydoğudan 48 km/sa (26 kt), kuvvetli rüzgâr; kümülonimbüs, yıldırım olabilir', () => {
    const raw = 'LTFM 031250Z 04026KT 9999 SCT030CB BKN040 17/12 Q1014 NOSIG'
    const r = rows(raw)
    expect(r.wind).toBe('Kuzeydoğudan 48 km/sa (26 kt)')
    expect(r.level).toBe('Kuvvetli rüzgâr')
    expect(r.thunder).toBe('Yok; kümülonimbüs (oraj bulutu) var, şimşek ve yıldırım olabilir')
    const en = rows(raw, EN)
    expect(en.wind).toBe('From the northeast 48 km/h (26 kt)')
    expect(en.level).toBe('Strong wind')
    expect(en.thunder).toBe('None; cumulonimbus (thunderstorm cloud) present, lightning possible')
  })

  it('yağışsız oraj ve çevrede sağanak: tehlike yine yazılır', () => {
    expect(rows('LTAF 031250Z 22012KT 9999 TS SCT035CB 31/12 Q1009').thunder).toBe(
      'Gök gürültüsü var, yağış yok; şimşek ve yıldırım tehlikesi',
    )
    const vcsh = rows('LTBJ 031250Z 25010KT 9999 VCSH TS FEW030CB 27/18 Q1010', EN)
    expect(vcsh.thunder).toBe('Thunderstorm at the airport, no precipitation; lightning danger')
    expect(vcsh.rain).toBe('None at the airport; showers nearby')
  })

  it('oraj var, hava olayı belirlenemedi: "yağış yok" yazılmaz (D-078, D-083)', () => {
    for (const raw of [
      'LTAF 031250Z AUTO 22012KT 9999 TS // NCD 31/12 Q1009',
      'LTAF 031250Z 22012KT TS SCT035CB 31/12 Q1009',
      'LTAF 031250Z 22012KT 9999 TS XXRA SCT035CB 31/12 Q1009',
    ]) {
      const r = rows(raw)
      expect(r.rain, raw).toBe('Belirlenemedi')
      expect(r.headline, raw).toBe('Gök gürültüsü')
      expect(r.thunder, raw).toBe('Gök gürültüsü var; şimşek ve yıldırım tehlikesi')
      const en = rows(raw, EN)
      expect(en.rain, raw).toBe('Could not be determined')
      expect(en.headline, raw).toBe('Thunderstorm')
      expect(en.thunder, raw).toBe('Thunderstorm at the airport; lightning danger')
      for (const text of [r.headline, r.thunder, en.headline, en.thunder]) {
        expect(text, raw).not.toMatch(/yağış yok|no precipitation/)
      }
    }
    // Temiz raporda yağışsız oraj olduğu gibi söylenir.
    const clean = rows('LTAF 031250Z 22012KT 9999 TS SCT035CB 31/12 Q1009')
    expect(clean.headline).toBe('Gök gürültüsü ve şimşek, yağış yok')
    expect(clean.rain).toBe('Yok')
  })

  it('kümülonimbüs ve yağış: şimşek ve yıldırım tehlikesi (kullanıcının sözü, 2026-10-03)', () => {
    // Fixture İstanbul: hafif sağanak yağmur ve kümülonimbüs, oraj bildirilmedi.
    const raw = 'LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009'
    const r = rows(raw)
    expect(r.thunder).toBe('Kümülonimbüs (oraj bulutu) ve yağış var; şimşek ve yıldırım tehlikesi')
    expect(r.lightning).toBe('cloudPrecip')
    expect(rows(raw, EN).thunder).toBe(
      'Cumulonimbus (thunderstorm cloud) and precipitation present; lightning danger',
    )
    // Kar da yağıştır; tanınan yağış belirlenemeyen raporda da vardır.
    expect(rows('LTCE 031250Z 27010KT 3000 -SN SCT020CB OVC030 M02/M04 Q1012').thunder).toBe(
      'Kümülonimbüs (oraj bulutu) ve yağış var; şimşek ve yıldırım tehlikesi',
    )
    expect(rows('LTXX 031250Z 22010KT 9999 -RA XYZRA FEW030CB 10/05 Q1010').lightning).toBe(
      'cloudPrecip',
    )
    // Yağış yalnız çevrede: bulutun olasılığı.
    expect(rows('LTXX 031250Z 22010KT 9999 VCSH FEW030CB 10/05 Q1010').thunder).toBe(
      'Yok; kümülonimbüs (oraj bulutu) var, şimşek ve yıldırım olabilir',
    )
  })

  it('oraj ve yağış ayrı gruplarda (`TS RA`): başlık "yağış yok" demez', () => {
    for (const [raw, rain, rainEn] of [
      ['LTXX 031250Z 18008KT 6000 TS RA BKN020CB 20/18 Q1008', 'Yağmur', 'Rain'],
      [
        'LTXX 031250Z 18008KT 6000 TS -SHRA BKN020CB 20/18 Q1008',
        'Hafif sağanak yağmur',
        'Light rain showers',
      ],
    ] as const) {
      const r = rows(raw)
      expect(r.headline, raw).toBe('Gök gürültüsü')
      expect(r.rain, raw).toBe(rain)
      expect(r.thunder, raw).toBe('Gök gürültüsü var; şimşek ve yıldırım tehlikesi')
      const en = rows(raw, EN)
      expect(en.headline, raw).toBe('Thunderstorm')
      expect(en.rain, raw).toBe(rainEn)
      for (const text of [r.headline, r.thunder, en.headline, en.thunder]) {
        expect(text, raw).not.toMatch(/yağış yok|no precipitation/)
      }
    }
    const hail = rows('LTXX 031250Z 18008KT 6000 TS GS BKN020CB 20/18 Q1008')
    expect(hail.headline).toBe('Gök gürültüsü')
    expect(hail.hail).not.toBeNull()
  })

  it('kümülonimbüs ve belirlenemeyen rapor; TCU ve yalnız son saatteki oraj iddiasız', () => {
    expect(rows('LTXX 031250Z 22010KT 9999 XYZRA FEW030CB 10/05 Q1010').thunder).toBe(
      'Belirlenemedi; kümülonimbüs (oraj bulutu) var, şimşek ve yıldırım olabilir',
    )
    expect(rows('LTXX 031250Z 22010KT 9999 XYZRA FEW030CB 10/05 Q1010', EN).thunder).toBe(
      'Could not be determined; cumulonimbus (thunderstorm cloud) present, lightning possible',
    )
    const tcu = rows('LTFM 141020Z 27014KT 9999 -SHRA FEW020TCU BKN030 11/08 Q1008 NOSIG')
    expect(tcu.thunder).toBe('Yok')
    expect(tcu.lightning).toBeNull()
    const recent = rows('LTBA 031320Z 30012KT 9999 FEW030 SCT040 22/15 Q1013 RETSRA')
    expect(recent.thunder).toBe('Şu an yok; kısa süre önce gök gürültülü sağanak')
    expect(recent.lightning).toBeNull()
  })

  it.each([
    ['00000KT', 'Sakin', 'Calm', null],
    ['VRB02KT', 'Hafif ve değişken yönlü', 'Light and variable', null],
    ['VRB05KT', 'Değişken yönlü, 9 km/sa (5 kt)', 'Variable, 9 km/h (5 kt)', null],
    ['36025KT', 'Kuzeyden 46 km/sa (25 kt)', 'From the north 46 km/h (25 kt)', 'Kuvvetli rüzgâr'],
    [
      '20015G28KT 160V240',
      'Güneyden 28 km/sa (15 kt), hamle 52 km/sa (28 kt), yönü güney ile güneybatı arasında değişiyor',
      'From the south 28 km/h (15 kt), gusts 52 km/h (28 kt), varying between south and southwest',
      'Hamleli rüzgâr',
    ],
    // Vurgu eşiği (2026-10-03): ortalama 17 kt (31 km/sa), hamle 25 kt (46 km/sa).
    ['36016KT', 'Kuzeyden 30 km/sa (16 kt)', 'From the north 30 km/h (16 kt)', null],
    ['36017KT', 'Kuzeyden 31 km/sa (17 kt)', 'From the north 31 km/h (17 kt)', 'Sert rüzgâr'],
    [
      '04016G24KT',
      'Kuzeydoğudan 30 km/sa (16 kt), hamle 44 km/sa (24 kt)',
      'From the northeast 30 km/h (16 kt), gusts 44 km/h (24 kt)',
      null,
    ],
    [
      '36015G25KT',
      'Kuzeyden 28 km/sa (15 kt), hamle 46 km/sa (25 kt)',
      'From the north 28 km/h (15 kt), gusts 46 km/h (25 kt)',
      'Hamleli rüzgâr',
    ],
    ['36009KT', 'Kuzeyden 17 km/sa (9 kt)', 'From the north 17 km/h (9 kt)', null],
    ['///10KT', 'Yönü bilinmiyor, 19 km/sa (10 kt)', 'Direction unknown, 19 km/h (10 kt)', null],
    [
      '270P99KT',
      'Batıdan 185 km/sa (100 kt) ve üzeri',
      'From the west 185 km/h (100 kt) or more',
      'Harikeyn (orkan)',
    ],
    [
      // P49MPS: 50 m/s ve üzeri (97 kt); kt eşiği (100) yüzünden "ve üzeri" düşüyordu.
      '270P49MPS',
      'Batıdan 180 km/sa (97 kt) ve üzeri',
      'From the west 180 km/h (97 kt) or more',
      'Harikeyn (orkan)',
    ],
    [
      '27020GP49MPS',
      'Batıdan 72 km/sa (39 kt), hamle 180 km/sa (97 kt) ve üzeri',
      'From the west 72 km/h (39 kt), gusts 180 km/h (97 kt) or more',
      'Çok şiddetli fırtına',
    ],
    [
      '31011MPS',
      'Kuzeybatıdan 40 km/sa (21 kt)',
      'From the northwest 40 km/h (21 kt)',
      'Kuvvetli rüzgâr',
    ],
    [
      '04026G45KT',
      'Kuzeydoğudan 48 km/sa (26 kt), hamle 83 km/sa (45 kt)',
      'From the northeast 48 km/h (26 kt), gusts 83 km/h (45 kt)',
      'Fırtına',
    ],
    [
      '32030KT',
      'Kuzeybatıdan 56 km/sa (30 kt)',
      'From the northwest 56 km/h (30 kt)',
      'Fırtınamsı rüzgâr',
    ],
  ] as const)('%s → %s', (group, tr, en, level) => {
    const raw = `LTXX 031250Z ${group} 9999 FEW030 10/05 Q1010`
    expect(rows(raw).wind).toBe(tr)
    expect(rows(raw, EN).wind).toBe(en)
    expect(rows(raw).level).toBe(level)
  })

  it('rüzgâr ve uyarı metinlerinde sayıdan önce ayraç yok', () => {
    for (const raw of [
      'LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009',
      'LTXX 031250Z 270P99KT 0800 +TSRA BKN010CB 20/18 Q0990',
      'UGTB 031230Z 31011MPS 9999 FEW030 15/08 Q1015 NOSIG',
    ]) {
      for (const options of [TR, EN]) {
        const r = rows(raw, options)
        for (const text of [r.wind, r.thunder]) expect(text).not.toMatch(/[·–]\s*[−-]?\d/)
      }
    }
  })
})

describe('M6e.2: rüzgâr renkleri ve rüzgâr kesmesi (kullanıcı kararı 2026-10-03, D-083)', () => {
  it('etkili rüzgârın adları: Sert rüzgâr (17–19 kt), Hamleli rüzgâr (hamle 25–29 kt); hafif rüzgâr etiketi', () => {
    const tr = getMessages('tr').weather.wind
    const en = getMessages('en').weather.wind
    expect([tr.level.fresh, tr.level.gusty, tr.light]).toEqual([
      'Sert rüzgâr',
      'Hamleli rüzgâr',
      'Hafif rüzgâr',
    ])
    expect([en.level.fresh, en.level.gusty, en.light]).toEqual([
      'Fresh wind',
      'Gusty wind',
      'Light wind',
    ])
  })

  it('üretim METAR’ları (2026-10-03): şiddet, hafif rüzgâr ve rüzgâr kesmesi iki dilde', () => {
    // LGMK: 19 kt ve pist 34'te rüzgâr kesmesi.
    const lgmk = 'METAR LGMK 031520Z 35019KT 9999 FEW018 20/15 Q1020 WS R34'
    expect(rows(lgmk)).toMatchObject({
      wind: 'Kuzeyden 35 km/sa (19 kt)',
      level: 'Sert rüzgâr',
      strongWind: false,
      shear: 'Rüzgâr kesmesi bildirildi: pist 34',
    })
    expect(rows(lgmk, EN)).toMatchObject({
      wind: 'From the north 35 km/h (19 kt)',
      level: 'Fresh wind',
      shear: 'Wind shear reported: runway 34',
    })
    // LGAL 16G26: yalnız hamle eşikte.
    expect(rows('METAR LGAL 031520Z 04016G26KT 9999 FEW030 21/08 Q1026')).toMatchObject({
      wind: 'Kuzeydoğudan 30 km/sa (16 kt), hamle 48 km/sa (26 kt)',
      level: 'Hamleli rüzgâr',
    })
    // LTAI 5 kt: hafif (9 km/sa); LTCJ 6 kt: değil (11 km/sa).
    const light = rows('METAR LTAI 031520Z 24005KT 9999 SCT030 BKN080 22/12 Q1018 NOSIG')
    expect([light.wind, light.level, light.windLight]).toEqual([
      'Güneybatıdan 9 km/sa (5 kt)',
      null,
      'light',
    ])
    expect(
      rows('METAR LTCJ 031520Z 03006KT 320V070 9999 -TSRA FEW025CB BKN035 16/14 Q1021').windLight,
    ).toBeNull()
    // MPS: URMG 2 m/s = 7 km/sa (hafif), URSS 3 m/s = 11 km/sa (değil).
    const mps = rows('METAR URMG 031530Z 25002MPS 9999 FEW055 BKN082 12/08 Q1024 NOSIG', EN)
    expect([mps.wind, mps.windLight]).toEqual(['From the west 7 km/h (4 kt)', 'light'])
    const urss = rows('METAR URSS 031530Z 32003MPS 290V350 9999 NSC 15/11 Q1021 NOSIG')
    expect([urss.wind, urss.windLight]).toEqual([
      'Kuzeybatıdan 11 km/sa (6 kt), yönü batı ile kuzey arasında değişiyor',
      null,
    ])
  })

  it('rüzgâr kesmesi: bütün pistler ve birden çok pist; sayıdan önce ayraç yok', () => {
    const all = 'LTXX 031250Z 00000KT 9999 FEW030 10/05 Q1010 WS ALL RWY'
    expect(rows(all)).toMatchObject({
      wind: 'Sakin',
      windLight: 'calm',
      shear: 'Rüzgâr kesmesi bildirildi: bütün pistler',
    })
    expect(rows(all, EN).shear).toBe('Wind shear reported: all runways')
    const two = 'LTXX 031250Z 18005KT 9999 FEW030 10/05 Q1010 WS R16 WS RWY34L'
    expect(rows(two).shear).toBe('Rüzgâr kesmesi bildirildi: pistler 16, 34L')
    expect(rows(two, EN).shear).toBe('Wind shear reported: runways 16, 34L')
    for (const options of [TR, EN]) {
      const t = options.t.wind
      for (const text of [t.shearAll, t.shearRunway, t.shearRunways, t.light]) {
        expect(text).not.toMatch(/[·–]\s*(?:\{|[−-]?\d)/)
      }
    }
  })
})

describe('TAF özeti', () => {
  const taf = (raw: string, issuedAt: string, validFrom: string, validTo: string): AirportTaf => ({
    ...decodeTaf(raw, { issuedAt, validFrom, validTo }),
    issuedAt,
    validFrom,
    validTo,
  })

  it('olasılıklı gök gürültüsü niteleyicisiyle, "bekleniyor" denmez; geçerlilik sonu yarın', () => {
    const ltfm = taf(
      'TAF LTFM 151040Z 1512/1618 03015G28KT 9999 SCT025 BKN035 TEMPO 1512/1518 4000 SHRA FEW025CB PROB30 TEMPO 1514/1518 TSRA BECMG 1520/1522 02008KT',
      '2026-01-15T10:40:00.000Z',
      '2026-01-15T12:00:00.000Z',
      '2026-01-16T18:00:00.000Z',
    )
    const summary = summarizeTaf([ltfm], NOW)
    expect(summary.status).toBe('ok')
    const items = summary.items.map((item) => spaced(weatherText(item, TR)))
    expect(items.join(' | ')).toContain('%30 olasılıkla')
    expect(items.join(' | ')).toContain('gök gürültülü sağanak')
    expect(items.join(' ')).not.toMatch(/bekleniyor/)
    expect(summary.validUntil && weatherText(summary.validUntil, TR)).toBe(
      'Tahminin geçerlilik sonu: yarın 21:00.',
    )
    expect(summary.validUntil && weatherText(summary.validUntil, EN)).toBe(
      'Forecast valid until 21:00 tomorrow.',
    )
    const en = summary.items.map((item) => spaced(weatherText(item, EN))).join(' | ')
    expect(en).toContain('30% chance')
  })

  it('örtüşen iki TAF’ta süren kuvvetli rüzgâr: en güçlü değerler, sade görünümde metrik', () => {
    // Eski TAF 25G38, yenisi 28G40 (geçerliliği 12Z'de başlar); rüzgâr BECMG 1520/1522 penceresinde
    // zayıflar: eski koşul pencerenin sonuna, 22Z'ye (yarın 01:00) kadar sürebilir (WMO-782, D-083).
    const older = taf(
      'TAF LTFM 150440Z 1506/1612 04025G38KT 9999 BKN030',
      '2026-01-15T04:40:00.000Z',
      '2026-01-15T06:00:00.000Z',
      '2026-01-16T12:00:00.000Z',
    )
    const newer = taf(
      'TAF LTFM 151040Z 1512/1618 04028G40KT 9999 BKN030 BECMG 1520/1522 04010KT',
      '2026-01-15T10:40:00.000Z',
      '2026-01-15T12:00:00.000Z',
      '2026-01-16T18:00:00.000Z',
    )
    const summary = summarizeTaf([newer, older], Date.parse('2026-01-15T11:00:00.000Z'))
    // 28 kt = 52 km/sa, 40 kt = 74 km/sa; 25 kt (46) ve 38 kt (70) yazılmaz. 28 kt fırtınamsı
    // rüzgârdır (Beaufort 7); knot parantezde (D-083).
    expect(summary.items.map((item) => spaced(weatherText(item, TR)))).toEqual([
      'Yarın 01:00 saatine kadar fırtınamsı rüzgâr, kuzeydoğudan 52 km/sa (28 kt), hamle 74 km/sa (40 kt)',
    ])
    expect(summary.items.map((item) => spaced(weatherText(item, EN)))).toEqual([
      'Until 01:00 tomorrow: near gale, from the northeast 52 km/h (28 kt), gusts 74 km/h (40 kt)',
    ])
  })

  it('olasılıklı oraj ve etkili rüzgâr; tahmine yıldırım cümlesi eklenmez (D-083)', () => {
    const ltfm = taf(
      'TAF LTFM 031100Z 0312/0418 04025G38KT 9999 SCT030 BKN040 PROB30 TEMPO 0315/0318 TSRA BKN020CB',
      '2026-10-03T11:00:00.000Z',
      '2026-10-03T12:00:00.000Z',
      '2026-10-04T18:00:00.000Z',
    )
    const summary = summarizeTaf([ltfm], Date.parse('2026-10-03T12:00:00.000Z'))
    expect(summary.items.map((item) => spaced(weatherText(item, TR)))).toEqual([
      '18:00 ile 21:00 arası %30 olasılıkla ara ara gök gürültülü sağanak',
      'Yarın 21:00 saatine kadar kuvvetli rüzgâr, kuzeydoğudan 46 km/sa (25 kt), hamle 70 km/sa (38 kt)',
    ])
    expect(summary.items.map((item) => spaced(weatherText(item, EN)))[1]).toBe(
      'Until 21:00 tomorrow: strong wind, from the northeast 46 km/h (25 kt), gusts 70 km/h (38 kt)',
    )
    const gale = taf(
      'TAF LTFM 031100Z 0312/0418 04030G45KT 9999 SCT030',
      '2026-10-03T11:00:00.000Z',
      '2026-10-03T12:00:00.000Z',
      '2026-10-04T18:00:00.000Z',
    )
    expect(
      summarizeTaf([gale], Date.parse('2026-10-03T12:00:00.000Z')).items.map((item) =>
        spaced(weatherText(item, TR)),
      ),
    ).toEqual([
      'Yarın 21:00 saatine kadar fırtına, kuzeydoğudan 56 km/sa (30 kt), hamle 83 km/sa (45 kt)',
    ])
  })

  it('birden çok kuvvetli rüzgâr: en şiddetlisi yazılır, sonra gelse de (D-083)', () => {
    const windy = taf(
      'TAF LTFM 031100Z 0312/0418 18020KT 9999 SCT030 TEMPO 0315/0318 27045G65KT',
      '2026-10-03T11:00:00.000Z',
      '2026-10-03T12:00:00.000Z',
      '2026-10-04T18:00:00.000Z',
    )
    const items = (options: WeatherTextOptions) =>
      summarizeTaf([windy], Date.parse('2026-10-03T12:00:00.000Z')).items.map((item) =>
        spaced(weatherText(item, options)),
      )
    // 45 kt kuvvetli fırtına, hamle 65 kt tam fırtına → tam fırtına; temel 20 kt geride kalır.
    expect(items(TR)).toEqual([
      '18:00 ile 21:00 arası ara ara tam fırtına, batıdan 83 km/sa (45 kt), hamle 120 km/sa (65 kt)',
    ])
    expect(items(EN)).toEqual([
      'At times between 18:00 and 21:00: storm, from the west 83 km/h (45 kt), gusts 120 km/h (65 kt)',
    ])
  })

  it('geçerli tahmin yoksa açıklama', () => {
    const summary = summarizeTaf([], NOW)
    expect(summary.message && weatherText(summary.message, TR)).toBe(
      'Bu havalimanı için geçerli bir tahmin (TAF) yok.',
    )
  })
})
