import { getMessages } from '@havayolu/i18n'
import { decodeMetar, type AirportMetar, type AirportWeather, type Locale } from '@havayolu/shared'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MapAirport } from './airport-data'
import { AirportPopup } from './airport-popup'
import type { BulkWeatherState } from './use-airport-weather'

const IST: MapAirport = {
  icao: 'LTFM',
  iata: 'IST',
  name: 'Istanbul Airport',
  city: 'Istanbul',
  lat: 41.2753,
  lon: 28.7519,
  elevationFt: 325,
  type: 'large_airport',
  scheduled: true,
  country: 'TR',
  ring: 0,
  distanceToTrKm: null,
  isoRegion: 'TR-34',
  municipality: 'Arnavutköy',
  runways: [{ lengthFt: 13451 }, { lengthFt: 12303 }],
}

const NOW = Date.parse('2026-10-01T13:00:00Z')

/** Yakın ülkedeki listelenen havalimanı (1. halka, D-080). */
const ATH: MapAirport = {
  ...IST,
  icao: 'LGAV',
  iata: 'ATH',
  name: 'Athens Eleftherios Venizelos International Airport',
  city: 'Spata-Artemida',
  lat: 37.936401,
  lon: 23.9445,
  elevationFt: 308,
  country: 'GR',
  ring: 1,
  distanceToTrKm: 275,
  isoRegion: 'GR-I',
  municipality: 'Spata-Artemida',
  runways: [{ lengthFt: 13123 }],
}

/** LTFM'nin son raporu: hafif sağanak, kuvvetli rüzgâr (hamleli), CB; 10 dakika önce. */
function weatherState(raw: string, icao = 'LTFM'): BulkWeatherState {
  const observedAt = new Date(NOW - 10 * 60_000).toISOString()
  const metar: AirportMetar = { ...decodeMetar(raw, { observedAt }), observedAt }
  const station: AirportWeather = {
    icao,
    generatedAt: new Date(NOW).toISOString(),
    metar,
    tafs: [],
  }
  return {
    data: { generatedAt: new Date(NOW).toISOString(), stations: new Map([[icao, station]]) },
    failed: false,
  }
}

/** Etiketsiz görünür metin (boşluklar sadeleşmiş). */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

/** Satırın `<div>` açılışı ve değeri (`<div class="wx-row" data-row="rain" …><dt>…</dt><dd>…</dd>`). */
function weatherRow(html: string, key: string): { open: string; value: string } | null {
  const match = new RegExp(
    `(<div class="wx-row" data-row="${key}"[^>]*>)<dt>.*?</dt><dd>(.*?)</dd>`,
  ).exec(html)
  return match ? { open: match[1] ?? '', value: text(match[2] ?? '').trim() } : null
}

function render(
  locale: Locale,
  weather: BulkWeatherState,
  sheet = false,
  airport: MapAirport = IST,
): string {
  const messages = getMessages(locale)
  return renderToStaticMarkup(
    createElement(AirportPopup, {
      airport,
      weather,
      now: NOW,
      locale,
      sheet,
      mapRef: { current: null },
      onClose: () => undefined,
      messages: messages.map.airportPopup,
      weatherMessages: messages.weather,
    }),
  )
}

describe('AirportPopup', () => {
  it('kipsiz pencere: erişilebilir ad, kodlar, il, bilgiler ve havalimanı sayfası bağlantısı', () => {
    const html = render('tr', { data: null, failed: false })
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-label="İstanbul Havalimanı bilgileri"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('data-icao="LTFM"')
    expect(html).toContain('IST · LTFM')
    expect(html).toContain('<h2 class="map-popup__title">İstanbul Havalimanı</h2>')
    expect(html).toContain('İstanbul</p>')
    // Rakım ve pist uzunluğunda sayı ile birim bölünmez boşlukla (D-083).
    expect(html).toContain('<dt>Rakım</dt><dd>99\u00a0m (325\u00a0ft)</dd>')
    expect(html).toContain('<dt>Pistler</dt><dd>2 pist, en uzunu 4.100\u00a0m</dd>')
    expect(html).toContain('<dt>Yerel saat</dt><dd>16:00</dd>')
    // Gün doğumu ve batımı yalnız havalimanı sayfasındadır (kullanıcı kararı 2026-10-02).
    expect(html).not.toMatch(/Gün doğumu|Gün batımı/)
    expect(html).toContain('aria-label="Kapat"')
    expect(html).toContain('href="/istasyon/LTFM"')
    expect(html).toContain('Havalimanı sayfası →')
    // Kaldırılan bilgiler (M6c kullanıcı kararı 3) pencerede de yoktur.
    expect(html).not.toMatch(/Tarifeli sefer|İzlenen istasyon/)
  })

  it('İngilizce: /en bağlantısı ve İngilizce ad', () => {
    const html = render('en', { data: null, failed: false })
    expect(html).toContain('aria-label="Istanbul Airport details"')
    expect(html).toContain('href="/en/istasyon/LTFM"')
    expect(html).toContain('Airport page →')
    expect(html).toContain('2 runways, longest 4,100\u00a0m')
    expect(html).not.toMatch(/Sunrise|Sunset/)
  })

  it('hava durumu: başlığın yanında sıcaklık kutucuğu, simgeli ortalı satırlar, vurgular', () => {
    const html = render(
      'tr',
      weatherState('LTFM 011250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009'),
    )
    // Sıcaklık ayrı kutucuk; önünde ayraç yok.
    expect(html).toContain(
      '<p class="map-popup__headline"><span>Hafif sağanak yağmur</span> <span class="wx-temp">9 °C</span></p>',
    )
    expect(html).not.toMatch(/[·–]\s*[−-]?\d/)
    // Rüzgâr km/sa ve parantezde kt, virgülle; şiddet etiketi ayraçsız, boşlukla ayrılır (D-083).
    expect(weatherRow(html, 'wind')?.value).toBe(
      'Kuzeydoğudan 33 km/sa (18 kt), hamle 59 km/sa (32 kt) Kuvvetli hamle',
    )
    // Hızın içinde bölünmez boşluk: dar değer sütununda "59" ile "km/sa" ayrı satıra düşmez.
    expect(html).toContain(
      'hamle 59\u00a0km/sa\u00a0(32\u00a0kt) <span class="wx-tag">Kuvvetli hamle</span>',
    )
    expect(text(html)).toContain('Gözlem 15:50, 10 dakika önce')
    // Satırlar ortalı düzendedir: etiket sağa, değer sola, çiftler orta eksende.
    expect(html).toContain('<dl class="wx-rows wx-rows--center">')
    // Var olan olay (yağmur), etkili rüzgâr ve CB ile yağışın yıldırım tehlikesi vurgulu; "Yok" sade.
    expect(weatherRow(html, 'rain')).toEqual({
      open: '<div class="wx-row" data-row="rain" data-tone="rain">',
      value: 'Hafif sağanak yağmur',
    })
    expect(weatherRow(html, 'wind')?.open).toBe(
      '<div class="wx-row" data-row="wind" data-tone="wind">',
    )
    expect(weatherRow(html, 'thunder')).toEqual({
      open: '<div class="wx-row" data-row="thunder" data-tone="thunder">',
      value: 'Kümülonimbüs (oraj bulutu) ve yağış var; şimşek ve yıldırım tehlikesi',
    })
    for (const key of ['snow', 'fog', 'visibility']) {
      expect(weatherRow(html, key)?.open, key).toBe(`<div class="wx-row" data-row="${key}">`)
    }
    // Simgeler süslemedir: ekran okuyucudan gizli; etiket metni değişmez.
    for (const key of ['wind', 'rain', 'snow', 'thunder', 'fog', 'visibility']) {
      expect(html, key).toMatch(
        new RegExp(
          `data-row="${key}"[^>]*><dt><svg class="wx-icon" data-icon="${key}"[^>]* aria-hidden="true" focusable="false">`,
        ),
      )
    }
    expect(html).toMatch(/<\/svg>Rüzgâr<\/dt>/)
    expect(html).toMatch(/<\/svg>Sis ve pus<\/dt>/)
    // Ekran okuyucu bildirimi başlığı ve sıcaklığı virgülle okur.
    expect(html).toContain('role="status" aria-live="polite">Hafif sağanak yağmur, 9 °C</p>')
  })

  it('hava durumu: sıfırın altı U+2212; kar, sis, gök gürültüsü ve dolu kendi rengiyle', () => {
    const snow = render(
      'en',
      weatherState('LTAC 011250Z 32012KT 1500 SN BR BKN008 OVC015 M03/M04 Q1018', 'LTAC'),
      false,
      { ...IST, icao: 'LTAC', iata: 'ESB' },
    )
    expect(snow).toContain('<span class="wx-temp">\u22123 °C</span>')
    expect(snow).not.toMatch(/[·–]\s*[−-]?\d/)
    expect(weatherRow(snow, 'snow')?.open).toContain('data-tone="snow"')
    expect(weatherRow(snow, 'fog')?.open).toContain('data-tone="fog"')
    expect(weatherRow(snow, 'rain')?.open).not.toContain('data-tone')
    const storm = render(
      'tr',
      weatherState(
        'SPECI LTBS 011242Z 25015G27KT 2000 +TSRAGR SCT012CB BKN025 12/10 Q1007',
        'LTBS',
      ),
      false,
      { ...IST, icao: 'LTBS', iata: 'DLM' },
    )
    expect(weatherRow(storm, 'thunder')?.open).toContain('data-tone="thunder"')
    expect(weatherRow(storm, 'hail')?.open).toContain('data-tone="hail"')
    expect(weatherRow(storm, 'rain')?.open).toContain('data-tone="rain"')
  })

  it('hava durumu: yükleniyor, alınamıyor, rapor yok', () => {
    expect(render('tr', { data: null, failed: false })).toContain('Hava durumu yükleniyor…')
    expect(render('tr', { data: null, failed: true })).toContain('Hava durumu şu an alınamıyor.')
    const empty: BulkWeatherState = {
      data: { generatedAt: new Date(NOW).toISOString(), stations: new Map() },
      failed: false,
    }
    expect(render('tr', empty)).toContain('Hava durumu raporu yok')
  })

  it('yakın ülke havalimanı: il yerine ülke; saat dilimi bilinmediği için saat satırları yok', () => {
    const html = render('tr', { data: null, failed: false }, false, ATH)
    expect(html).toContain('data-icao="LGAV"')
    expect(html).toContain('ATH · LGAV')
    expect(html).toContain('<p class="map-popup__place">Yunanistan</p>')
    expect(html).toContain('<dt>Pistler</dt><dd>Tek pist, 4.000\u00a0m</dd>')
    expect(html).not.toContain('Yerel saat')
    expect(html).not.toContain('Gün doğumu')
    expect(html).toContain('href="/istasyon/LGAV"')
    const english = render('en', { data: null, failed: false }, false, ATH)
    expect(english).toContain('<p class="map-popup__place">Greece</p>')
    expect(english).toContain('href="/en/istasyon/LGAV"')
  })
})
