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
/** 26 Ekim 2026 21:05 UTC: Atina kış saatinde (UTC+2), 23:05. */
const WINTER = Date.parse('2026-10-26T21:05:00Z')

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

/**
 * Bilgi satırı (rakım, pistler, yerel saat): simgesi, etiketi ve ham değeri (bölünmez boşluk
 * korunur). Hava durumu satırlarıyla aynı liste düzenindedir (`<div class="wx-row" data-row=…>`).
 */
function factRow(
  html: string,
  key: string,
): { icon: string | null; label: string; value: string } | null {
  const match = new RegExp(
    `<div class="wx-row" data-row="${key}"><dt>(<svg class="wx-icon" data-icon="${key}"[^>]*>.*?</svg>)?([^<]*)</dt><dd>([^<]*)</dd></div>`,
  ).exec(html)
  return match ? { icon: match[1] ?? null, label: match[2] ?? '', value: match[3] ?? '' } : null
}

function render(
  locale: Locale,
  weather: BulkWeatherState,
  sheet = false,
  airport: MapAirport = IST,
  now = NOW,
): string {
  const messages = getMessages(locale)
  return renderToStaticMarkup(
    createElement(AirportPopup, {
      airport,
      weather,
      now,
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
    expect(factRow(html, 'elevation')).toMatchObject({
      label: 'Rakım',
      value: '99\u00a0m (325\u00a0ft)',
    })
    expect(factRow(html, 'runways')).toMatchObject({
      label: 'Pistler',
      value: '2 pist, en uzunu 4.100\u00a0m',
    })
    // Yerel saat UTC farkıyla, her havalimanında aynı biçimde (D-084).
    expect(factRow(html, 'localTime')).toMatchObject({
      label: 'Yerel saat',
      value: '16:00 (UTC+3)',
    })
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

  it('tek hizalı tablo: bilgi satırları simgeli, hava durumu satırlarıyla aynı liste düzeninde', () => {
    const html = render(
      'tr',
      weatherState('LTFM 011250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009'),
    )
    // İki liste aynı bileşen ve aynı sütun sınıfıyla çizilir (M6e.1, D-083); ortalı düzen yok.
    expect(html).toContain('<dl class="wx-rows map-popup__facts wx-rows--popup">')
    expect(html).toContain('<dl class="wx-rows wx-rows--popup">')
    expect(html).not.toContain('wx-rows--center')
    // Bilgi satırları hava durumu bölümünden önce; sırası değişmedi.
    const facts = html.slice(
      html.indexOf('map-popup__facts'),
      html.indexOf('class="map-popup__weather"'),
    )
    expect([...facts.matchAll(/data-row="(\w+)"/g)].map((m) => m[1])).toEqual([
      'elevation',
      'runways',
      'localTime',
    ])
    // Her bilgi satırının kendi çizgi simgesi var; süslemedir (ekran okuyucudan gizli).
    for (const key of ['elevation', 'runways', 'localTime']) {
      const icon = factRow(html, key)?.icon ?? ''
      expect(icon, key).toContain('aria-hidden="true" focusable="false"')
      expect(icon, key).toContain('stroke="currentColor"')
    }
    // Simgeler birbirinden ve hava durumu simgelerinden farklı çizimlerdir.
    const shapes = ['elevation', 'runways', 'localTime', 'wind', 'visibility'].map(
      (key) => new RegExp(`data-icon="${key}"[^>]*>(.*?)</svg>`).exec(html)?.[1],
    )
    expect(shapes.every((shape) => (shape ?? '').length > 0)).toBe(true)
    expect(new Set(shapes).size).toBe(shapes.length)
    // Her `<dt>` simge yuvasıyla başlar (simgesiz satırda boş yuva): etiketler aynı x'te.
    const dts = [...html.matchAll(/<dt>(.{0,40})/g)].map((m) => m[1] ?? '')
    expect(dts.length).toBeGreaterThanOrEqual(9)
    for (const dt of dts) expect(dt).toMatch(/^<(svg|span) class="wx-icon"/)
    // İngilizce de aynı düzen.
    const english = render('en', { data: null, failed: false })
    expect(factRow(english, 'elevation')?.label).toBe('Elevation')
    expect(factRow(english, 'runways')?.label).toBe('Runways')
    expect(factRow(english, 'localTime')?.label).toBe('Local time')
  })

  it('hava durumu: başlığın yanında sıcaklık kutucuğu, simgeli satırlar, vurgular', () => {
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
    // Satırlar pencerenin tek hizalı düzenindedir (sabit etiket sütunu; M6e.1, D-083).
    expect(html).toContain('<dl class="wx-rows wx-rows--popup">')
    // Var olan olay (yağmur), etkili rüzgâr ve CB ile yağışın yıldırım tehlikesi vurgulu; "Yok" sade.
    expect(weatherRow(html, 'rain')).toEqual({
      open: '<div class="wx-row" data-row="rain" data-tone="rain">',
      value: 'Hafif sağanak yağmur',
    })
    // Hamle 32 kt: MGM meydan uyarısı, turuncu "Kuvvetli hamle" (M6e.3, D-083).
    expect(weatherRow(html, 'wind')?.open).toBe(
      '<div class="wx-row" data-row="wind" data-tone="strong">',
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

  it('hava durumu: derecelendirilmiş rüzgâr renkleri ve rüzgâr kesmesi pencerede de aynı (M6e.2, M6e.3; D-083)', () => {
    // Üretim LGMK: 19 kt "Sert rüzgâr" ve pist 34'te rüzgâr kesmesi.
    const shear = render('tr', weatherState('LGMK 011250Z 35019KT 9999 FEW018 20/15 Q1020 WS R34'))
    expect(weatherRow(shear, 'wind')).toEqual({
      open: '<div class="wx-row" data-row="wind" data-tone="fresh">',
      value: 'Kuzeyden 35 km/sa (19 kt) Sert rüzgâr Rüzgâr kesmesi bildirildi: pist 34',
    })
    expect(shear).toContain('<span class="wx-note">Rüzgâr kesmesi bildirildi: pist 34</span>')
    // Hafif rüzgâr: açık yeşil ve etiket; satır pencerenin tek hizalı listesindedir.
    const light = render('en', weatherState('LTFM 011250Z 24005KT 9999 FEW030 20/15 Q1020'))
    expect(weatherRow(light, 'wind')).toEqual({
      open: '<div class="wx-row" data-row="wind" data-tone="calm">',
      value: 'From the southwest 9 km/h (5 kt) Light wind',
    })
    expect(light).toContain('<dl class="wx-rows wx-rows--popup">')
    // Derecelendirilmiş renkler (M6e.3, kullanıcı isteği 2026-10-04): rüzgâr varsa satır renklidir,
    // basamağın adı etikettir. 6 kt (11 km/sa) ve 16 kt (30 km/sa) eskiden sadeydi.
    for (const [group, tone, value] of [
      ['24006KT', 'breeze', 'Güneybatıdan 11 km/sa (6 kt) Tatlı rüzgâr'],
      ['24010KT', 'breeze', 'Güneybatıdan 19 km/sa (10 kt) Tatlı rüzgâr'],
      ['24011KT', 'moderate', 'Güneybatıdan 20 km/sa (11 kt) Orta rüzgâr'],
      ['24016KT', 'moderate', 'Güneybatıdan 30 km/sa (16 kt) Orta rüzgâr'],
      ['24017KT', 'fresh', 'Güneybatıdan 31 km/sa (17 kt) Sert rüzgâr'],
      ['24020KT', 'strong', 'Güneybatıdan 37 km/sa (20 kt) Kuvvetli rüzgâr'],
      ['24034KT', 'storm', 'Güneybatıdan 63 km/sa (34 kt) Fırtına'],
    ] as const) {
      const html = render('tr', weatherState(`LTFM 011250Z ${group} 9999 FEW030 20/15 Q1020`))
      expect(weatherRow(html, 'wind'), group).toEqual({
        open: `<div class="wx-row" data-row="wind" data-tone="${tone}">`,
        value,
      })
    }
    // Sayfayla aynı satırlar: İngilizce adlar.
    const moderate = render('en', weatherState('LTFM 011250Z 24014KT 9999 FEW030 20/15 Q1020'))
    expect(weatherRow(moderate, 'wind')?.value).toBe(
      'From the southwest 26 km/h (14 kt) Moderate wind',
    )
    // Bilinmeyen hız: vurgusuz.
    expect(
      weatherRow(render('tr', weatherState('LTFM 011250Z /////KT 9999 FEW030 20/15 Q1020')), 'wind')
        ?.open,
    ).toBe('<div class="wx-row" data-row="wind">')
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

  it('yakın ülke havalimanı: il yerine ülke; havalimanının yerel saati ve UTC farkı (D-084)', () => {
    const html = render('tr', { data: null, failed: false }, false, ATH)
    expect(html).toContain('data-icao="LGAV"')
    expect(html).toContain('ATH · LGAV')
    expect(html).toContain('<p class="map-popup__place">Yunanistan</p>')
    expect(factRow(html, 'runways')).toMatchObject({
      label: 'Pistler',
      value: 'Tek pist, 4.000\u00a0m',
    })
    // 1 Ekim 13:00Z: Atina yaz saatinde, UTC+3 (İstanbul ile aynı saat).
    expect(factRow(html, 'localTime')).toMatchObject({
      label: 'Yerel saat',
      value: '16:00 (UTC+3)',
    })
    expect(html).not.toContain('Gün doğumu')
    expect(html).toContain('href="/istasyon/LGAV"')
    const english = render('en', { data: null, failed: false }, false, ATH)
    expect(english).toContain('<p class="map-popup__place">Greece</p>')
    expect(factRow(english, 'localTime')).toMatchObject({
      label: 'Local time',
      value: '16:00 (UTC+3)',
    })
    // Kışın (Atina 25 Ekim 2026 01:00 UTC'den sonra UTC+2) aynı satır yeni farkı yazar.
    const winter = render('tr', { data: null, failed: false }, false, ATH, WINTER)
    expect(factRow(winter, 'localTime')?.value).toBe('23:05 (UTC+2)')
    expect(english).toContain('href="/en/istasyon/LGAV"')
  })

  it('gözlem saati havalimanının yerel saatiyle; dilimi bilinmeyen havalimanında UTC ile', () => {
    const raw = 'LGAV 011250Z 36012KT CAVOK 22/10 Q1015 NOSIG'
    // Tahran (UTC+3:30): gözlem 12:50Z yerel 16:20.
    const tehran: MapAirport = {
      ...ATH,
      icao: 'OIII',
      iata: 'THR',
      country: 'IR',
      isoRegion: 'IR-23',
    }
    const local = text(render('tr', weatherState(raw, 'OIII'), false, tehran))
    expect(local).toContain('Yerel saat 16:30 (UTC+3:30)')
    expect(local).toContain('Gözlem 16:20, 10 dakika önce')
    // Kuralı olmayan çok dilimli ülke (ABD): yerel saat satırı yok, gözlem UTC.
    const unknown: MapAirport = {
      ...ATH,
      icao: 'KJFK',
      iata: 'JFK',
      country: 'US',
      isoRegion: 'US-NY',
    }
    const utc = text(render('tr', weatherState(raw, 'KJFK'), false, unknown))
    expect(utc).not.toContain('Yerel saat')
    expect(utc).toContain('Gözlem 12:50 UTC, 10 dakika önce')
  })
})
