import { getMessages } from '@havayolu/i18n'
import type { AirportWeather, Locale, WeatherHistoryResponse } from '@havayolu/shared'
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

/** Her zaman yazılan satırlar (kullanıcı kararı 2026-10-01: rüzgâr, yağmur, kar, oraj, sis). */
const ALWAYS = ['wind', 'rain', 'snow', 'thunder', 'fog', 'visibility', 'clouds'] as const

function panel(
  weather: AirportWeather | null,
  {
    locale = 'tr',
    now = FIXTURE_NOW,
    live = false,
  }: { locale?: Locale; now?: number; live?: boolean } = {},
) {
  return renderToStaticMarkup(
    createElement(WeatherPanel, {
      locale,
      t: getMessages(locale).weather,
      ...LTFM,
      weather,
      now,
      live,
    }),
  )
}

function log(history: WeatherHistoryResponse | null, locale: Locale = 'tr') {
  return renderToStaticMarkup(
    createElement(WeatherLog, {
      locale,
      t: getMessages(locale).weather,
      icao: 'LTFM',
      name: locale === 'tr' ? 'İstanbul Havalimanı' : 'Istanbul Airport',
      history,
      now: FIXTURE_NOW,
      apiBaseUrl: API,
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

/** Satırın değeri (`<div data-row="rain"><dt>…</dt><dd>…</dd></div>`). */
function row(html: string, key: string): string | null {
  const match = new RegExp(`<div data-row="${key}"><dt>[^<]*</dt><dd>(.*?)</dd></div>`).exec(html)
  return match ? text(match[1] ?? '').trim() : null
}

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
    }
  })

  it('LTFM: başlık, kuvvetli rüzgâr, satırlar, gözlem saati; göreli yaş yalnızca istemcide', () => {
    const weather = fixtureWeather('LTFM')
    const html = panel(weather)
    const body = text(html)
    expect(body).toContain('Hafif sağanak yağmur · 9 °C')
    expect(html).toContain('<span class="weather-chip">Kuvvetli rüzgâr</span>')
    expect(row(html, 'wind')).toMatch(
      /^Kuzeydoğudan 33 km\/sa · hamle 59 km\/sa · +Kuvvetli rüzgâr$/,
    )
    // Etiket metinden ayrılır (ekran okuyucu ve kopyalama "km/saKuvvetli" okumaz).
    expect(html).toContain('hamle 59 km/sa · <span class="weather-chip">Kuvvetli rüzgâr</span>')
    expect(row(html, 'rain')).toBe('Hafif sağanak yağmur')
    expect(row(html, 'snow')).toBe('Yok')
    expect(row(html, 'thunder')).toBe('Yok (kümülonimbüs bulutu var)')
    expect(row(html, 'fog')).toBe('Yok')
    expect(row(html, 'visibility')).toBe('10 km ve üzeri')
    expect(row(html, 'pressure')).toBe('1009 hPa')
    expect(body).toContain('Gözlem 15:50')
    expect(body).not.toContain('önce')
    expect(text(panel(weather, { live: true }))).toContain('Gözlem 15:50 · 10 dakika önce')
    expect(html).toMatch(/<svg class="weather-icon" data-icon="showers"/)
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
    expect(en).toContain('Light rain showers · 9 °C')
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
      '<th scope="row" class="mono">03018G32KT</th><td>Rüzgâr: 030° 18 kt (33 km/sa) · hamle 32 kt (59 km/sa)</td>',
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
      'Havalimanında yok; çevresinde gök gürültüsü',
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
    }
    expect(text(html)).toContain('Otomatik gözlem; bazı hava olayları algılanmayabilir.')
  })
})

describe('WeatherPanel: eğilim (TREND) penceresi', () => {
  // LTFM'nin son METAR'ı 12:50Z'de gözlendi, eğilimi TEMPO; pencere 14:50Z'de biter.
  const observed = Date.parse('2026-01-15T12:50:00Z')
  const label = (html: string) => /<div data-row="next2h"><dt>([^<]*)<\/dt>/.exec(html)?.[1] ?? null

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
    expect(html).toContain(`· ${history.entries.length} rapor</caption>`)
    // En yeni rapor üstte: 12:50 UTC = 15:50.
    const first = html.slice(
      html.indexOf('<tbody>'),
      html.indexOf('</tr>', html.indexOf('<tbody>')),
    )
    expect(text(first)).toContain('15:50 12:50 UTC METAR Hafif sağanak yağmur · 9 °C')
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
    expect(html).toContain(`· ${times.length} rapor</caption>`)
  })

  it('tek rapor: İngilizcede tekil ("1 report"), çoğulda "reports"', () => {
    const full = fixtureHistory('LTFM')
    const one = { ...full, entries: full.entries.slice(0, 1) }
    expect(log(one, 'en')).toContain('· 1 report</caption>')
    expect(log(one, 'en')).not.toContain('1 reports')
    expect(log(one)).toContain('· 1 rapor</caption>')
    expect(log(full, 'en')).toContain(`· ${full.entries.length} reports</caption>`)
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
