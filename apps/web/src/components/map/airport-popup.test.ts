import { getMessages } from '@havayolu/i18n'
import type { Locale } from '@havayolu/shared'
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
  isoRegion: 'TR-34',
  municipality: 'Arnavutköy',
  runways: [{ lengthFt: 13451 }, { lengthFt: 12303 }],
}

const NOW = Date.parse('2026-10-01T13:00:00Z')

function render(locale: Locale, weather: BulkWeatherState, sheet = false): string {
  const messages = getMessages(locale)
  return renderToStaticMarkup(
    createElement(AirportPopup, {
      airport: IST,
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
    expect(html).toContain('<dt>Rakım</dt><dd>99 m (325 ft)</dd>')
    expect(html).toContain('<dt>Pistler</dt><dd>2 pist, en uzunu 4.100 m</dd>')
    expect(html).toContain('<dt>Yerel saat</dt><dd>16:00</dd>')
    expect(html).toMatch(/<dt>Gün doğumu<\/dt><dd>\d{2}:\d{2}<\/dd>/)
    expect(html).toMatch(/<dt>Gün batımı<\/dt><dd>\d{2}:\d{2}<\/dd>/)
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
    expect(html).toContain('2 runways, longest 4,100 m')
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
})
