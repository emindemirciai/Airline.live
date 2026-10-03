import { getMessages, weatherText } from '@havayolu/i18n'
import {
  windText,
  type AirportWeather,
  type Locale,
  type WeatherHistoryResponse,
} from '@havayolu/shared'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  FIXTURE_NOW,
  fixtureHistory,
  fixtureWeather,
  metarFromRaw,
} from '../../lib/test/weather-fixture'
import { AirportWeatherLive } from './airport-weather-live'
import { expertWind } from './weather-expert'
import { WeatherLog } from './weather-log'
import { WeatherPanel } from './weather-panel'

/** İstanbul Havalimanı merkezi (gün doğumu/batımı için). */
const LTFM = { lat: 41.262222, lon: 28.727778 }
const API = 'http://localhost:4100'

/** Fixture'daki bütün durumlar (tools/fixtures/weather/index.json → cases). */
const STATIONS = [
  'LTFM',
  'LTBA',
  'LTAC',
  'LTAI',
  'LTBJ',
  'LTCG',
  'LTFJ',
  'LTCE',
  'LTDB',
  'LTAU',
  'LTBS',
  'LTCF',
  'LTAJ',
  'LTCW',
  'LTBQ',
] as const

/** Fixture'daki yakın ülke havalimanları (1. halka, D-080). */
const FOREIGN_STATIONS = ['LGAV', 'LGTS', 'LCLK', 'LCEN', 'LBSF', 'UGTB'] as const

/** Her zaman yazılan satırlar (kullanıcı kararı 2026-10-01: rüzgâr, yağmur, kar, oraj, sis). */
const ALWAYS = ['wind', 'rain', 'snow', 'thunder', 'fog', 'visibility', 'clouds'] as const

function panel(
  weather: AirportWeather | null,
  {
    locale = 'tr',
    now = FIXTURE_NOW,
    live = false,
    abroad = false,
  }: { locale?: Locale; now?: number; live?: boolean; abroad?: boolean } = {},
) {
  return renderToStaticMarkup(
    createElement(WeatherPanel, {
      locale,
      t: getMessages(locale).weather,
      ...LTFM,
      weather,
      now,
      live,
      abroad,
    }),
  )
}

function log(history: WeatherHistoryResponse | null, locale: Locale = 'tr', abroad = false) {
  return renderToStaticMarkup(
    createElement(WeatherLog, {
      locale,
      t: getMessages(locale).weather,
      icao: 'LTFM',
      name: locale === 'tr' ? 'İstanbul Havalimanı' : 'Istanbul Airport',
      history,
      now: FIXTURE_NOW,
      apiBaseUrl: API,
      abroad,
    }),
  )
}

/** Etiketsiz görünür metin (boşluklar sadeleşmiş). */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
}

/** Satırın değeri (`<div class="wx-row" data-row="rain" …><dt>…</dt><dd>…</dd></div>`). */
function row(html: string, key: string): string | null {
  const match = new RegExp(
    `<div class="wx-row" data-row="${key}"[^>]*><dt>.*?</dt><dd>(.*?)</dd></div>`,
  ).exec(html)
  return match ? text(match[1] ?? '').trim() : null
}

/** Satırın vurgusu (`data-tone`); vurgusuz satırda null, satır yoksa undefined. */
function tone(html: string, key: string): string | null | undefined {
  const match = new RegExp(`<div class="wx-row" data-row="${key}"( data-tone="(\\w+)")?>`).exec(
    html,
  )
  return match ? (match[2] ?? null) : undefined
}

/** Sayıdan (ya da eksi işaretinden) hemen önce "·" ya da "–" (eksi gibi okunur; 2026-10-02). */
const DASH_BEFORE_NUMBER = /[·–]\s*[−-]?\d/

describe('WeatherPanel: bütün fixture durumları', () => {
  it.each(STATIONS)('%s: başlık, dürüst satırlar, çözülmemiş yer tutucu yok (TR, EN)', (icao) => {
    for (const locale of ['tr', 'en'] as const) {
      const weather = fixtureWeather(icao)
      const html = panel(weather, { locale })
      expect(html).toContain('<section aria-labelledby="airport-weather" class="airport-weather"')
      expect(html, `${icao} ${locale}`).not.toMatch(/\{\w+\}|undefined|NaN/)
      if (weather.metar && icao !== 'LTBQ') {
        for (const key of ALWAYS) expect(row(html, key), `${icao} ${locale} ${key}`).not.toBeNull()
      }
      // MGM sözcükleri: gök gürültülü olay "fırtına" değildir.
      if (locale === 'tr') expect(row(html, 'thunder') ?? '', icao).not.toMatch(/fırtına/)
      // Sayıdan önce "·" ya da "–" yazılmaz (sıcaklık, rüzgâr, görüş, gözlem yaşı, tahmin, uzman).
      const live = panel(weather, { locale, live: true })
      expect(text(live), `${icao} ${locale}`).not.toMatch(DASH_BEFORE_NUMBER)
    }
  })

  it('LTFM: başlık, rüzgâr şiddeti, satırlar, gözlem saati; göreli yaş yalnızca istemcide', () => {
    const weather = fixtureWeather('LTFM')
    const html = panel(weather)
    const body = text(html)
    // Sıcaklık başlığın yanında ayrı kutucuktur; önünde ayraç yoktur.
    expect(html).toContain(
      '<strong>Hafif sağanak yağmur</strong> <span class="wx-temp">9 °C</span></p>',
    )
    // km/sa ve parantezde kt; yalnız hamle eşiği (32 kt) aşıldığı için "Kuvvetli hamle" (D-083).
    expect(html).toContain('<span class="wx-tag">Kuvvetli hamle</span>')
    expect(row(html, 'wind')).toBe(
      'Kuzeydoğudan 33 km/sa (18 kt), hamle 59 km/sa (32 kt) Kuvvetli hamle',
    )
    // Etiket metinden boşlukla ayrılır (ekran okuyucu ve kopyalama "kt)Kuvvetli" okumaz). Hızın
    // içinde bölünmez boşluk: sayı birimden, knot km/sa'dan ayrı satıra düşmez (D-083).
    expect(html).toContain(
      'hamle 59\u00a0km/sa\u00a0(32\u00a0kt) <span class="wx-tag">Kuvvetli hamle</span>',
    )
    expect(row(html, 'rain')).toBe('Hafif sağanak yağmur')
    expect(row(html, 'snow')).toBe('Yok')
    // Kümülonimbüs ve yağış: şimşek ve yıldırım tehlikesi (kullanıcının sözü, 2026-10-03).
    expect(row(html, 'thunder')).toBe(
      'Kümülonimbüs (oraj bulutu) ve yağış var; şimşek ve yıldırım tehlikesi',
    )
    expect(row(html, 'fog')).toBe('Yok')
    expect(row(html, 'visibility')).toBe('10 km ve üzeri')
    expect(row(html, 'pressure')).toBe('1009 hPa')
    expect(body).toContain('Gözlem 15:50')
    expect(body).not.toContain('önce')
    expect(panel(weather, { live: true })).toContain('>Gözlem 15:50</time>, 10 dakika önce</span>')
    expect(html).toMatch(/<svg class="weather-icon" data-icon="showers"/)
  })

  it('satır simgeleri süslemedir; var olan olay, etkili rüzgâr ve yıldırım riski vurgulanır', () => {
    const html = panel(fixtureWeather('LTFM'))
    for (const key of ['wind', 'rain', 'snow', 'thunder', 'fog', 'visibility', 'clouds']) {
      expect(html, key).toMatch(
        new RegExp(
          `data-row="${key}"[^>]*><dt><svg class="wx-icon" data-icon="${key}"[^>]* aria-hidden="true" focusable="false">`,
        ),
      )
    }
    // Simgesi olmayan satırda hizalama için boş, gizli yer tutucu.
    expect(html).toContain(
      '<div class="wx-row" data-row="pressure"><dt><span class="wx-icon" aria-hidden="true"></span>Basınç</dt>',
    )
    expect(html).toContain('<dl class="wx-rows wx-rows--page">')
    // LTFM: hamle 32 kt (kehribar rüzgâr), hafif sağanak (mavi), CB ve yağışta şimşek ve yıldırım
    // tehlikesi (kehribar); kar ve sis yok (D-083).
    expect(['wind', 'rain', 'snow', 'thunder', 'fog'].map((key) => tone(html, key))).toEqual([
      'wind',
      'rain',
      null,
      'thunder',
      null,
    ])
    const snow = panel(fixtureWeather('LTAC'))
    expect([tone(snow, 'snow'), tone(snow, 'fog'), tone(snow, 'rain')]).toEqual([
      'snow',
      'fog',
      null,
    ])
    expect(tone(panel(fixtureWeather('LTCG')), 'fog')).toBe('fog')
    const storm = panel(fixtureWeather('LTBS'))
    expect([tone(storm, 'thunder'), tone(storm, 'hail'), tone(storm, 'rain')]).toEqual([
      'thunder',
      'hail',
      'rain',
    ])
    // Çevredeki gök gürültüsü: yıldırım havalimanına da düşebilir, vurgulanır (D-083).
    expect(tone(panel(fixtureWeather('LTAU')), 'thunder')).toBe('thunder')
    // Rüzgâr eşiğin altında vurgusuz ve etiketsiz (LTAC 12 kt); kuvvetli kuzeybatı (LGTS 26G38).
    const calm = panel(fixtureWeather('LTAC'))
    expect(tone(calm, 'wind')).toBeNull()
    expect(calm).not.toContain('wx-tag')
    const vardar = panel(fixtureWeather('LGTS'), { abroad: true })
    expect(tone(vardar, 'wind')).toBe('wind')
    expect(row(vardar, 'wind')).toBe(
      'Kuzeybatıdan 48 km/sa (26 kt), hamle 70 km/sa (38 kt) Kuvvetli rüzgâr',
    )
  })

  it('rüzgâr renkleri (M6e.2, kullanıcı kararı 2026-10-03): ≥ 17 kt ya da hamle ≥ 25 kt kehribar, ≤ 10 km/sa açık yeşil, arası sade', () => {
    // LTAI 15G28: hamle 25 kt'yi geçti, meydan uyarısı eşiğinin (30 kt) altında: "Hamleli rüzgâr".
    const gusty = panel(fixtureWeather('LTAI'))
    expect(tone(gusty, 'wind')).toBe('wind')
    expect(gusty).toContain('<span class="wx-tag">Hamleli rüzgâr</span>')
    expect(text(panel(fixtureWeather('LTAI'), { locale: 'en' }))).toContain('Gusty wind')
    // LTBS SPECI 15G27 (dolu ve oraj da var): aynı düzey; eski 20/30 kt kuralında sadeydi.
    const hail = panel(fixtureWeather('LTBS'))
    expect(tone(hail, 'wind')).toBe('wind')
    expect(row(hail, 'wind')).toBe(
      'Batıdan 28 km/sa (15 kt), hamle 50 km/sa (27 kt) Hamleli rüzgâr',
    )
    expect(text(panel(fixtureWeather('LTBS'), { locale: 'en' }))).toContain('Gusty wind')
    // LTAJ 5 kt (9 km/sa): açık yeşil, değer hızı yazdığı için "Hafif rüzgâr" etiketi (renk tek ipucu
    // değildir).
    const light = panel(fixtureWeather('LTAJ'))
    expect(tone(light, 'wind')).toBe('calm')
    expect(row(light, 'wind')).toBe('Doğudan 9 km/sa (5 kt) Hafif rüzgâr')
    expect(text(panel(fixtureWeather('LTAJ'), { locale: 'en' }))).toContain(
      'From the east 9 km/h (5 kt) Light wind',
    )
    // Sakin (LTCF) ve hafif değişken (LTBJ): değer durumu zaten söyler, etiket yok.
    for (const [icao, value] of [
      ['LTCF', 'Sakin'],
      ['LTBJ', 'Hafif ve değişken yönlü'],
    ] as const) {
      const html = panel(fixtureWeather(icao))
      expect(tone(html, 'wind'), icao).toBe('calm')
      expect(row(html, 'wind'), icao).toBe(value)
      expect(html, icao).not.toContain('wx-tag')
    }
    // LTDB 6 kt = 11 km/sa: yeşil değil; LTAC 12 kt ve LGAV 16 kt: sade.
    for (const icao of ['LTDB', 'LTAC', 'LGAV'] as const) {
      const html = panel(fixtureWeather(icao), { abroad: icao === 'LGAV' })
      expect(tone(html, 'wind'), icao).toBeNull()
      expect(html, icao).not.toContain('wx-tag')
    }
  })

  it('rüzgâr kesmesi (üretim LGMK `WS R34`): satır kehribar, şiddetin adı ve kesme değerin altında', () => {
    const observedAt = '2026-01-15T12:50:00.000Z'
    const station = (raw: string): AirportWeather => ({
      icao: 'LGMK',
      generatedAt: observedAt,
      metar: metarFromRaw(raw, observedAt),
      tafs: [],
    })
    const lgmk = station('LGMK 151250Z 35019KT 9999 FEW018 20/15 Q1020 WS R34')
    const html = panel(lgmk, { abroad: true })
    expect(tone(html, 'wind')).toBe('wind')
    expect(html).toContain(
      'Kuzeyden 35 km/sa (19 kt) <span class="wx-tag">Sert rüzgâr</span> <span class="wx-note">Rüzgâr kesmesi bildirildi: pist 34</span></dd>',
    )
    expect(row(panel(lgmk, { abroad: true, locale: 'en' }), 'wind')).toBe(
      'From the north 35 km/h (19 kt) Fresh wind Wind shear reported: runway 34',
    )
    // Hafif rüzgârda da kesme satırı kehribar yapar; "Hafif rüzgâr" etiketi yazılmaz.
    const calm = panel(station('LGMK 151250Z 00000KT 9999 FEW018 20/15 Q1020 WS ALL RWY'), {
      abroad: true,
    })
    expect(tone(calm, 'wind')).toBe('wind')
    expect(row(calm, 'wind')).toBe('Sakin Rüzgâr kesmesi bildirildi: bütün pistler')
    expect(calm).not.toContain('wx-tag')
    const light = panel(station('LGMK 151250Z 18004KT 9999 FEW018 20/15 Q1020 WS R16'), {
      abroad: true,
    })
    expect(tone(light, 'wind')).toBe('wind')
    expect(row(light, 'wind')).toBe('Güneyden 7 km/sa (4 kt) Rüzgâr kesmesi bildirildi: pist 16')
  })

  it('LTFM: tahmin özeti niteleyicisiyle, geçerlilik sonu; yerel saat ve gün doğumu/batımı', () => {
    const body = text(panel(fixtureWeather('LTFM')))
    expect(body).toContain('Tahmin')
    expect(body).toContain('%30 olasılıkla')
    expect(body).not.toContain('bekleniyor')
    expect(body).toContain('Tahminin geçerlilik sonu: yarın 21:00.')
    expect(body).toContain('Yerel saat 16:00 (UTC+3)')
    expect(body).toMatch(/Gün doğumu \d{2}:\d{2}/)
    expect(body).toMatch(/Gün batımı \d{2}:\d{2}/)
    const en = text(panel(fixtureWeather('LTFM'), { locale: 'en' }))
    expect(en).toContain('Light rain showers 9 °C')
    expect(en).toContain('30% chance')
    expect(en).toContain('Forecast valid until 21:00 tomorrow.')
    expect(en).toMatch(/Sunrise \d{2}:\d{2}/)
  })

  it('uzman ayrıntıları: kapalı, kod kod çözüm, ham METAR ve TAF, TAF dönemleri; kopyala düğmesi sunucuda yok', () => {
    const html = panel(fixtureWeather('LTFM'))
    expect(html).toContain('<details class="weather-details"><summary>Ayrıntılar (uzman)</summary>')
    expect(html).not.toMatch(/<details[^>]* open/)
    expect(html).toContain('<caption id="weather-codes-caption">Gözlemin kod kod çözümü</caption>')
    expect(html).toContain(
      '<th scope="row" class="mono">03018G32KT</th><td>Rüzgâr: 030° 18\u00a0kt\u00a0(33\u00a0km/sa), hamle 32\u00a0kt\u00a0(59\u00a0km/sa)</td>',
    )
    // Tahmin dönemi: yerel saatler "ile … arası", TAF'taki gün-saat kodu eğik çizgiyle.
    expect(html).toContain(
      '<th scope="row" class="num">15:00 ile yarın 21:00 arası (1512/1618)</th>',
    )
    expect(panel(fixtureWeather('LTFM'), { locale: 'en' })).toContain(
      '<th scope="row" class="num">15:00 to 21:00 tomorrow (1512/1618)</th>',
    )
    expect(html).toContain(
      '<th scope="row" class="mono">-SHRA</th><td>Hava olayı: Hafif sağanak yağmur</td>',
    )
    expect(html).toMatch(/<pre class="weather-raw">LTFM 151250Z 03018G32KT[^<]*<\/pre>/)
    expect(html).toMatch(/<pre class="weather-raw">TAF LTFM 151040Z[^<]*<\/pre>/)
    expect(html).toContain('Tahmin dönemleri (13:40 (10:40 UTC) yayımlanan TAF)')
    expect(html).toContain('Havalimanı tahmini sıcaklık içermez.')
    expect(html).not.toContain('<button')
  })

  it('LTAU: çevrede gök gürültüsü; LTAC: kar; LTCG: sis ve dikey görüş; LTBS: dolu ve özel rapor', () => {
    expect(row(panel(fixtureWeather('LTAU')), 'thunder')).toBe(
      'Havalimanı çevresinde gök gürültüsü var; yıldırım havalimanına da düşebilir',
    )
    expect(row(panel(fixtureWeather('LTAI')), 'thunder')).toBe(
      'Gök gürültüsü var; şimşek ve yıldırım tehlikesi',
    )
    expect(row(panel(fixtureWeather('LTAC')), 'snow')).toBe('Kar')
    const fog = panel(fixtureWeather('LTCG'))
    expect(row(fog, 'fog')).toBe('Sis')
    expect(row(fog, 'clouds')).toBe('Gökyüzü görünmüyor (dikey görüş 30 m)')
    const speci = panel(fixtureWeather('LTBS'))
    expect(row(speci, 'hail')).not.toBeNull()
    expect(text(speci)).toContain('Özel rapor')
  })

  it('LTAJ gecikmiş gözlem: rozet ve uyarı', () => {
    const html = panel(fixtureWeather('LTAJ'))
    expect(html).toContain('<span class="weather-badge is-delayed">Gecikmiş gözlem</span>')
    expect(text(html)).toMatch(/Son gözlem \d{2}:\d{2}/)
    expect(text(html)).toContain('Yeni rapor gelmedi; değerler güncel olmayabilir.')
  })

  it('LTCW eski gözlem: değerler kapalı bölümde, güncel gözlem yok denir', () => {
    const html = panel(fixtureWeather('LTCW'))
    expect(html).toContain('<span class="weather-badge is-stale">Eski gözlem</span>')
    expect(text(html)).toContain('Şu an güncel gözlem yok.')
    expect(html).toContain(
      '<details class="weather-details weather-stale"><summary>Son gözlemin değerleri</summary>',
    )
    expect(html).toContain('data-age="stale"')
  })

  it('LTBQ rapor yok; LTBJ geçerli tahmin yok; 12 saatten eski gözlem gösterilmez', () => {
    const none = text(panel(fixtureWeather('LTBQ')))
    expect(none).toContain('Şu an bu havalimanı için güncel bir havacılık hava raporu yok.')
    expect(none).toContain('Bu havalimanı için geçerli bir tahmin (TAF) yok.')
    expect(text(panel(fixtureWeather('LTBJ')))).toContain(
      'Bu havalimanı için geçerli bir tahmin (TAF) yok.',
    )
    const old = panel(fixtureWeather('LTFM'), { now: FIXTURE_NOW + 13 * 3_600_000 })
    expect(old).toContain('data-age="none"')
    expect(old).not.toContain('data-row="rain"')
  })

  it('API yanıt vermezse dürüst uyarı; yerel saat yine yazılır', () => {
    const html = text(panel(null))
    expect(html).toContain('Hava durumu şu an alınamıyor.')
    expect(html).toContain('Yerel saat 16:00 (UTC+3)')
    expect(text(panel(null, { locale: 'en' }))).toContain('Weather is unavailable right now.')
  })

  it('hava olayı belirlenemeyen rapor "Yok" demez', () => {
    const observedAt = '2026-01-15T12:50:00.000Z'
    const weather: AirportWeather = {
      icao: 'LTXX',
      generatedAt: observedAt,
      metar: metarFromRaw('LTXX 151250Z AUTO 03010KT 9999 // NCD 10/05 Q1010', observedAt),
      tafs: [],
    }
    const html = panel(weather)
    for (const key of ['rain', 'snow', 'thunder', 'fog']) {
      expect(row(html, key), key).toBe('Belirlenemedi')
      // "Belirlenemedi" nötrdür: vurgulanmaz.
      expect(tone(html, key), key).toBeNull()
    }
    expect(text(html)).toContain('Otomatik gözlem; bazı hava olayları algılanmayabilir.')
  })
})

describe('WeatherPanel: Türkiye dışındaki havalimanı (D-080)', () => {
  it.each(FOREIGN_STATIONS)('%s: satırlar çizilir, yer tutucu yok (TR, EN)', (icao) => {
    for (const locale of ['tr', 'en'] as const) {
      const weather = fixtureWeather(icao)
      const html = panel(weather, { locale, abroad: true })
      expect(html, `${icao} ${locale}`).not.toMatch(/\{\w+\}|undefined|NaN/)
      if (weather.metar) {
        for (const key of ALWAYS) expect(row(html, key), `${icao} ${locale} ${key}`).not.toBeNull()
      }
    }
  })

  it('saatler Türkiye saati diye etiketlenir; yerel saat ve gün doğumu/batımı yazılmaz', () => {
    const html = panel(fixtureWeather('LGAV'), { abroad: true })
    const body = text(html)
    expect(body).toContain(
      'Saatler Türkiye saatidir (UTC+3); havalimanının yerel saati farklı olabilir.',
    )
    expect(body).not.toMatch(/[Yy]erel saat \d|Gün doğumu|Gün batımı/)
    expect(body).toMatch(/Gözlem zamanı: \d{2}:\d{2} UTC \(Türkiye saati \d{2}:\d{2}\)/)
    const en = text(panel(fixtureWeather('LGAV'), { locale: 'en', abroad: true }))
    expect(en).toContain('Times are Türkiye time (UTC+3); the airport’s local time may differ.')
    expect(en).not.toMatch(/Local time|local time\)|Sunrise|Sunset/)
    // Türkiye'deki havalimanında değişmez.
    expect(text(panel(fixtureWeather('LTFM')))).toContain('Yerel saat 16:00 (UTC+3)')
  })

  it('kayıt: saatler Türkiye saati, UTC yanında', () => {
    expect(text(log(fixtureHistory('LTFM'), 'tr', true))).toContain(
      'Saatler Türkiye saatidir; UTC yanında yazılır.',
    )
    expect(text(log(fixtureHistory('LTFM'), 'en', true))).toContain(
      'Times are Türkiye time, with UTC alongside.',
    )
    expect(text(log(fixtureHistory('LTFM')))).toContain('Saatler yerel saattir')
  })
})

describe('WeatherPanel: eğilim (TREND) penceresi', () => {
  // LTFM'nin son METAR'ı 12:50Z'de gözlendi, eğilimi TEMPO; pencere 14:50Z'de biter.
  const observed = Date.parse('2026-01-15T12:50:00Z')
  const label = (html: string) =>
    /<div class="wx-row" data-row="next2h"><dt><span class="wx-icon" aria-hidden="true"><\/span>([^<]*)<\/dt>/.exec(
      html,
    )?.[1] ?? null

  it('gözlem tazeyken "Önümüzdeki 2 saat"', () => {
    const html = panel(fixtureWeather('LTFM'), { now: observed + 10 * 60_000 })
    expect(label(html)).toBe('Önümüzdeki 2 saat')
    expect(row(html, 'next2h')).toMatch(/^Önümüzdeki 2 saatte ara ara/)
  })

  it('gözlem 30 dakikadan eskiyse pencerenin bitiş saatiyle yazılır', () => {
    const html = panel(fixtureWeather('LTFM'), { now: observed + 70 * 60_000 })
    expect(label(html)).toBe('Gözlemden sonraki 2 saat')
    expect(row(html, 'next2h')).toMatch(/^17:50 saatine kadar ara ara/)
    const en = panel(fixtureWeather('LTFM'), { locale: 'en', now: observed + 70 * 60_000 })
    expect(label(en)).toBe('2 hours after the observation')
    expect(row(en, 'next2h')).toMatch(/^At times until 17:50/)
  })

  it('pencere geçtiyse (gecikmiş ya da eski gözlem) eğilim satırı yoktur', () => {
    const html = panel(fixtureWeather('LTFM'), { now: observed + 2 * 3_600_000 })
    expect(row(html, 'next2h')).toBeNull()
    expect(html).not.toContain('Önümüzdeki 2 saat')
    // Fixture'daki gecikmiş LTAJ (NOSIG): "önemli değişiklik beklenmiyor" iddiası yazılmaz.
    const delayed = panel(fixtureWeather('LTAJ'))
    expect(delayed).toContain('Gecikmiş gözlem')
    expect(text(delayed)).not.toMatch(/Önümüzdeki 2 saatte önemli değişiklik beklenmiyor/)
  })
})

describe('WeatherLog: METAR/TAF kaydı', () => {
  it('son 24 saat, en yenisi üstte; yerel saat ve UTC, tür, özet, ham metin', () => {
    const history = fixtureHistory('LTFM')
    const html = log(history)
    expect(html).toContain('<h2 id="airport-weather-log">METAR/TAF kaydı</h2>')
    const rows = [...html.matchAll(/<tr data-kind="(METAR|SPECI|TAF)">/g)].map((m) => m[1])
    expect(rows.length).toBe(history.entries.length)
    expect(rows.filter((kind) => kind === 'METAR').length).toBeGreaterThanOrEqual(48)
    expect(rows).toContain('TAF')
    expect(html).toContain(`(${history.entries.length} rapor)</caption>`)
    // En yeni rapor üstte: 12:50 UTC = 15:50.
    const first = html.slice(
      html.indexOf('<tbody>'),
      html.indexOf('</tr>', html.indexOf('<tbody>')),
    )
    expect(text(first)).toContain(
      '15:50 12:50 UTC METAR Hafif sağanak yağmur, 9 °C, kuzeydoğudan 33 km/sa (18 kt), hamle 59 km/sa (32 kt)',
    )
    expect(text(html)).not.toMatch(DASH_BEFORE_NUMBER)
    expect(html).toContain('<span class="weather-type is-taf">TAF</span>')
    expect(text(html)).toMatch(/arası için tahmin/)
    expect(html).toContain(
      'href="http://localhost:4100/v1/airports/LTFM/weather/history?hours=168"',
    )
    expect(html).not.toMatch(/\{\w+\}|undefined|NaN/)
  })

  it('İngilizce, boş ve alınamayan kayıt', () => {
    const en = text(log(fixtureHistory('LTFM'), 'en'))
    expect(en).toContain('METAR/TAF log')
    expect(en).toContain('Forecast for')
    expect(text(log(fixtureHistory('LTBQ')))).toContain('Son 24 saatte kayıtlı rapor yok.')
    expect(text(log(null))).toContain('Rapor kaydı şu an alınamıyor.')
  })

  it('önbellekten gelen eski kayıtta 24 saatten eski satır gösterilmez (pencere şimdiye göre)', () => {
    const history = fixtureHistory('LTFM')
    const later = FIXTURE_NOW + 2 * 3_600_000
    const html = renderToStaticMarkup(
      createElement(WeatherLog, {
        locale: 'tr',
        t: getMessages('tr').weather,
        icao: 'LTFM',
        name: 'İstanbul Havalimanı',
        history,
        now: later,
        apiBaseUrl: API,
      }),
    )
    const times = [...html.matchAll(/<time dateTime="([^"]+)"/g)].map((m) => Date.parse(m[1] ?? ''))
    expect(times.length).toBeGreaterThan(0)
    expect(times.length).toBeLessThan(history.entries.length)
    expect(Math.min(...times)).toBeGreaterThanOrEqual(later - 24 * 3_600_000)
    expect(html).toContain(`(${times.length} rapor)</caption>`)
  })

  it('tek rapor: İngilizcede tekil ("1 report"), çoğulda "reports"', () => {
    const full = fixtureHistory('LTFM')
    const one = { ...full, entries: full.entries.slice(0, 1) }
    expect(log(one, 'en')).toContain('(1 report)</caption>')
    expect(log(one, 'en')).not.toContain('1 reports')
    expect(log(one)).toContain('(1 rapor)</caption>')
    expect(log(full, 'en')).toContain(`(${full.entries.length} reports)</caption>`)
    expect(text(log(full, 'en'))).not.toMatch(DASH_BEFORE_NUMBER)
  })
})

describe('AirportWeatherLive (sunucu çizimi)', () => {
  it('iki bölümü çizer; göreli yaş ve kopyala düğmesi hidrasyondan sonra gelir', () => {
    const html = renderToStaticMarkup(
      createElement(AirportWeatherLive, {
        locale: 'tr',
        t: getMessages('tr').weather,
        icao: 'LTFM',
        name: 'İstanbul Havalimanı',
        ...LTFM,
        apiBaseUrl: API,
        initialWeather: fixtureWeather('LTFM'),
        initialHistory: fixtureHistory('LTFM'),
        renderedAt: FIXTURE_NOW,
      }),
    )
    expect(html).toContain('id="airport-weather"')
    expect(html).toContain('id="airport-weather-log"')
    expect(text(html)).toContain('Gözlem 15:50')
    expect(text(html)).not.toContain('dakika önce')
    expect(html).not.toContain('<button')
  })
})

describe('ölçek üstü rüzgâr: sade ve uzman görünüm aynı (P99KT, P49MPS; D-083)', () => {
  const options = { locale: 'tr' as const, t: getMessages('tr').weather }
  // Bölünmez boşluklar (D-083) okunurluk için olağan boşluğa çevrilir.
  const spaced = (value: string) => value.replace(/\u00a0/g, ' ')
  const observedAt = new Date(FIXTURE_NOW).toISOString()

  it.each([
    // P49MPS: 50 m/s ve üzeri = 97 kt; sade görünüm 100 kt'nin altında "ve üzeri"yi düşürüyordu.
    ['270P49MPS', 'Batıdan 180 km/sa (97 kt) ve üzeri', '270° 97 kt (180 km/sa) ve üzeri'],
    [
      '27020GP49MPS',
      'Batıdan 72 km/sa (39 kt), hamle 180 km/sa (97 kt) ve üzeri',
      '270° 39 kt (72 km/sa), hamle 97 kt (180 km/sa) ve üzeri',
    ],
    ['270P99KT', 'Batıdan 185 km/sa (100 kt) ve üzeri', '270° 100 kt (185 km/sa) ve üzeri'],
    [
      '33090GP99KT',
      'Kuzeybatıdan 167 km/sa (90 kt), hamle 185 km/sa (100 kt) ve üzeri',
      '330° 90 kt (167 km/sa), hamle 100 kt (185 km/sa) ve üzeri',
    ],
  ])('%s', (group, plain, expert) => {
    const { wind } = metarFromRaw(`UUXX 011250Z ${group} 9999 FEW030 15/08 Q1015`, observedAt)
    expect(spaced(weatherText(windText(wind), options))).toBe(plain)
    expect(spaced(expertWind(wind, options))).toBe(expert)
  })
})
