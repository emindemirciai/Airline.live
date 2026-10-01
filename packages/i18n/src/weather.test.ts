import {
  decodeMetar,
  decodeTaf,
  messageAt,
  summarizeMetar,
  summarizeTaf,
  WEATHER_PHRASE_KEYS,
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

function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort()
}

/** METAR'ın sade satırları, verilen dilde. */
function rows(raw: string, options = TR) {
  const summary = summarizeMetar(decodeMetar(raw, { observedAt: OBSERVED }))
  const text = (value: Parameters<typeof weatherText>[0] | null) =>
    value === null ? null : weatherText(value, options)
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
    notes: summary.notes.map((note) => weatherText(note, options)),
    strongWind: summary.strongWind,
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

  it('rüzgâr km/sa; uzman görünümünde kt de', () => {
    expect(formatWindSpeed(18, 'tr')).toBe('33 km/sa')
    expect(formatWindSpeed(32, 'en')).toBe('59 km/h')
    expect(formatWindSpeedBoth(18, 'tr')).toBe('18 kt (33 km/sa)')
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
})

describe('METAR özetleri: fixture durumları (brief §2), sade ve metrik', () => {
  it('LTFM: hafif sağanak, hamleli kuvvetli rüzgâr, CB, TEMPO', () => {
    const r = rows('LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA')
    expect(r.headline).toBe('Hafif sağanak yağmur')
    expect(r.wind).toBe('Kuzeydoğudan 33 km/sa · hamle 59 km/sa')
    expect(r.strongWind).toBe(true)
    expect(r.rain).toBe('Hafif sağanak yağmur')
    expect(r.snow).toBe('Yok')
    expect(r.thunder).toBe('Yok (kümülonimbüs bulutu var)')
    expect(r.fog).toBe('Yok')
    expect(r.visibility).toBe('10 km ve üzeri')
    expect(r.clouds).toBe('Çok bulutlu · en alçak bulut 760 m · kümülonimbüs')
    expect(r.temperature).toBe('9 °C')
    expect(r.humidity).toBe('Yaklaşık %75')
    expect(r.pressure).toBe('1009 hPa')
    expect(r.next2h).toBe('Önümüzdeki 2 saatte ara ara: görüş 4 km, sağanak yağmur')
    const en = rows(
      'LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA',
      EN,
    )
    expect(en.headline).toBe('Light rain showers')
    expect(en.wind).toBe('From the northeast 33 km/h · gusts 59 km/h')
    expect(en.thunder).toBe('None (cumulonimbus present)')
    expect(en.clouds).toBe('Mostly cloudy · lowest cloud 760 m · cumulonimbus')
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
    expect(r.wind).toBe('Kuzeybatıdan 22 km/sa')
    expect(r.snow).toBe('Kar')
    expect(r.fog).toBe('Pus')
    expect(r.rain).toBe('Yok')
    expect(r.visibility).toBe('1,5 km')
    expect(r.temperature).toBe(`${MINUS}1 °C`)
    expect(r.clouds).toBe('Kapalı · en alçak bulut 240 m')
  })

  it('LTAI: kuvvetli gök gürültülü sağanak, değişken yön aralığı', () => {
    const r = rows(
      'LTAI 151250Z 20015G28KT 160V240 3000 +TSRA SCT015CB BKN030 16/14 Q1006 TEMPO 1500 +TSRA',
    )
    expect(r.thunder).toBe('Kuvvetli gök gürültülü sağanak')
    expect(r.wind).toBe(
      'Güneyden 28 km/sa · hamle 52 km/sa · yönü güney ile güneybatı arasında değişiyor',
    )
    expect(r.visibility).toBe('3 km')
    expect(
      rows('LTAI 151250Z 20015G28KT 160V240 3000 +TSRA SCT015CB 16/14 Q1006', EN).thunder,
    ).toBe('Thunderstorm with heavy rain')
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

  it('LTAU: çevrede gök gürültüsü; havalimanında "yok" denir ama çevresi söylenir', () => {
    const r = rows('LTAU 151250Z 23008KT 9999 VCTS SCT040CB BKN100 07/M01 Q1013 NOSIG')
    expect(r.thunder).toBe('Havalimanında yok; çevresinde gök gürültüsü')
    expect(rows('LTAU 151250Z 23008KT 9999 VCTS SCT040CB 07/M01 Q1013', EN).thunder).toBe(
      'None at the airport; thunderstorm nearby',
    )
  })

  it('LTBS SPECI: dolulu gök gürültülü sağanak; dolu satırı ve özel rapor notu', () => {
    const r = rows('SPECI LTBS 151242Z 25015G27KT 2000 +TSRAGR SCT012CB BKN025 12/10 Q1007')
    expect(r.thunder).toBe('Dolulu, kuvvetli gök gürültülü sağanak')
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
    const items = summary.items.map((item) => weatherText(item, TR))
    expect(items.join(' | ')).toContain('%30 olasılıkla')
    expect(items.join(' | ')).toContain('gök gürültülü sağanak')
    expect(items.join(' ')).not.toMatch(/bekleniyor/)
    expect(summary.validUntil && weatherText(summary.validUntil, TR)).toBe(
      'Tahminin geçerlilik sonu: yarın 21:00.',
    )
    expect(summary.validUntil && weatherText(summary.validUntil, EN)).toBe(
      'Forecast valid until 21:00 tomorrow.',
    )
    const en = summary.items.map((item) => weatherText(item, EN)).join(' | ')
    expect(en).toContain('30% chance')
  })

  it('örtüşen iki TAF’ta süren kuvvetli rüzgâr: en güçlü değerler, sade görünümde metrik', () => {
    // Eski TAF 25G38, yenisi 28G40 (geçerliliği 12Z'de başlar); rüzgâr 20Z'de (23:00) zayıflar.
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
    // 28 kt = 52 km/sa, 40 kt = 74 km/sa; 25 kt (46) ve 38 kt (70) yazılmaz, knot sade metinde yok.
    expect(summary.items.map((item) => weatherText(item, TR))).toEqual([
      '23:00 saatine kadar kuvvetli rüzgâr, kuzeydoğudan 52 km/sa · hamle 74 km/sa',
    ])
    expect(summary.items.map((item) => weatherText(item, EN))).toEqual([
      'Until 23:00: strong wind, from the northeast 52 km/h · gusts 74 km/h',
    ])
  })

  it('geçerli tahmin yoksa açıklama', () => {
    const summary = summarizeTaf([], NOW)
    expect(summary.message && weatherText(summary.message, TR)).toBe(
      'Bu havalimanı için geçerli bir tahmin (TAF) yok.',
    )
  })
})
