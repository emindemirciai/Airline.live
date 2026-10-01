import { getMessages } from '@havayolu/i18n'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { airportFixture, runwayFixture } from '../../lib/test/airport-fixture'
import { fixtureTurkishAirports } from '../../lib/test/ourairports-fixture'
import { AirportView } from './airport-view'
import { AirportsView } from './airports-view'

// `lib/airports` sunucu modülüdür; testte sunucu modülü olarak yüklenir.
vi.mock('server-only', () => ({}))

const AIRPORTS = fixtureTurkishAirports()
const byIcao = (icao: string) => {
  const airport = AIRPORTS.find((a) => a.icao === icao)
  if (!airport) throw new Error(`fixture has no ${icao}`)
  return airport
}

function renderAirport(icao: string, locale: 'tr' | 'en' = 'tr', airports = AIRPORTS) {
  return renderToStaticMarkup(
    createElement(AirportView, { locale, app: 'havayolu', airport: byIcao(icao), airports }),
  )
}

/** Etiketsiz görünür metin (boşluklar sadeleşmiş). */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

describe('AirportView', () => {
  it('içerik yolu, başlık, il ve veriden kurulan giriş cümleleri (LTFM, TR)', () => {
    const html = renderAirport('LTFM')
    expect(html).toContain('<nav aria-label="Sayfa konumu" class="breadcrumbs">')
    expect(html).toContain('<a href="/">havayolu</a>')
    expect(html).toContain('<a href="/havalimanlari">Havalimanları</a>')
    expect(html).toContain('<span aria-current="page">İstanbul Havalimanı</span>')
    expect(html).toMatch(
      /<h1>İstanbul Havalimanı <span class="airport-codes">\(IST\/LTFM\)<\/span><\/h1>/,
    )
    const body = text(html)
    expect(body).toContain('İstanbul, Türkiye')
    expect(body).toContain('Havalimanında 6 pist var; en uzunu 4.100 m (13.451 ft) ile 17L/35R.')
    expect(body).toContain('Havalimanının rakımı 99 m (325 ft).')
    // Aynı ildeki diğer havalimanları bağlantılıdır.
    expect(html).toContain('<a href="/istasyon/LTBA">İstanbul Atatürk Havalimanı (ISL)</a>')
    expect(html).toContain(
      '<a href="/istasyon/LTFJ">İstanbul Sabiha Gökçen Uluslararası Havalimanı (SAW)</a>',
    )
    expect(body).toContain('İstanbul ilindeki diğer havalimanları:')
  })

  it('canlı hava trafiği: kapsama cümlesi ve canlı harita bağlantısı; istasyon bilgisi yok (D-078)', () => {
    const html = renderAirport('LTFM')
    const body = text(html)
    expect(body).toContain(
      'Havalimanı canlı veri çekim alanının içinde; çevredeki uçaklar canlı haritada görünür (kapsama ADS-B alıcılarına bağlıdır).',
    )
    expect(html).toContain('<a class="button" href="/?havalimani=LTFM">Canlı haritada aç</a>')
    expect(body).not.toMatch(/izliyor|[Bb]irincil istasyon|İzlenen istasyon|111 km \(60 NM\)/)
  })

  it('İngilizce sayfa: bağlantılar /en önekli, metinler İngilizce', () => {
    const html = renderAirport('LTFM', 'en')
    expect(html).toContain('<a href="/en">havayolu</a>')
    expect(html).toContain('<a href="/en/havalimanlari">Airports</a>')
    expect(html).toContain('<a class="button" href="/en?havalimani=LTFM">Open on the live map</a>')
    expect(html).toContain('<a href="/en/hakkinda">see the About page</a>')
    const body = text(html)
    expect(body).toContain(
      'The airport has 6 runways; the longest is 17L/35R at 4,100 m (13,451 ft).',
    )
    expect(body).toContain('Other airports in Istanbul province:')
    expect(body).not.toMatch(/Havalimanı(nda|nın)|izliyor/)
  })

  it('tarifesiz havalimanı ve tek pist (LTAG)', () => {
    const body = text(renderAirport('LTAG'))
    expect(body).toContain('Havalimanında tek pist var: 3.048 m (10.000 ft) uzunluğundaki 05/23.')
    expect(body).toContain('Havalimanı canlı veri çekim alanının içinde')
    expect(body).not.toContain('ilindeki diğer')
    expect(body).toContain('Ad: OurAirports')
  })

  it('pist tablosu: başlık, birimler, yüzey, gerçek yönler; kaydırılmış eşik yalnızca varsa', () => {
    const esb = renderAirport('LTAC')
    expect(esb).toContain(
      '<caption id="airport-runways-caption">Ankara Esenboğa Havalimanı pistleri</caption>',
    )
    expect(esb).toContain('role="region" aria-labelledby="airport-runways-caption" tabindex="0"')
    expect(esb).toContain('<th scope="row" class="mono">03L/21R</th>')
    expect(esb).toContain('3.750 m (12.303 ft)')
    expect(esb).toContain('Asfalt')
    expect(esb).toContain('Kaydırılmış pist eşiği')
    // LTAC 03L: 1.148 ft → 350 m.
    expect(esb).toContain(
      '<span class="airport-runway-end"><span class="airport-runway-ident">03L</span> 350 m</span>',
    )
    expect(text(esb)).toMatch(/03L \d{1,3}° 21R \d{1,3}°/)
    const saw = renderAirport('LTFJ')
    expect(saw).not.toContain('Kaydırılmış pist eşiği')
    expect(saw).toContain('Beton')
  })

  it('en yakın üç havalimanı, mesafe km', () => {
    const html = renderAirport('LTFM')
    const nearby = html.slice(html.indexOf('class="airport-nearby"'))
    const links = [...nearby.matchAll(/<li><a href="(\/istasyon\/[A-Z]{4})">/g)].map((m) => m[1])
    expect(links).toEqual(['/istasyon/LTBA', '/istasyon/LTFJ', '/istasyon/LTBU'])
    expect(text(nearby)).toMatch(/İstanbul Atatürk Havalimanı \(ISL\) ?, İstanbul: \d{2} km/)
  })

  it('sınırlar notu Hakkında sayfasına, kaynak satırı veri tarihine bağlanır', () => {
    const html = renderAirport('LTFM')
    expect(html).toContain('<a href="/hakkinda">Hakkında sayfasına bak</a>')
    expect(html).toContain('<time dateTime="2026-09-29T04:40:00.000Z">29 Eylül 2026</time>')
    expect(html).toContain('href="https://ourairports.com/data/"')
    expect(text(html)).toContain('Resmî Türkçe ad: İstanbul Havalimanı (havalimanı işletmecisi)')
  })

  it('tarifeli sefer ve izlenen istasyon bilgisi gösterilmez (M6c, D-078; Siirt LTCL, LTFM)', () => {
    for (const icao of ['LTCL', 'LTFM']) {
      const tr = text(renderAirport(icao))
      expect(tr, icao).not.toMatch(
        /Tarifeli sefer|tarifeli havayolu seferi|İzlenen istasyon|izliyor/,
      )
      expect(tr, icao).not.toMatch(/\bYok\b/)
      const en = text(renderAirport(icao, 'en'))
      expect(en, icao).not.toMatch(
        /Scheduled service|scheduled airline service|Monitored station|monitors this airport/,
      )
    }
  })

  it('sefer sayısı, rötar ve iptal bölümü: bu bilgilerin olmadığını açıkça söyler (brief §10)', () => {
    const html = renderAirport('LTFM')
    expect(html).toContain('<h2 id="airport-schedule">Sefer sayısı, rötar ve iptal</h2>')
    const body = text(html)
    expect(body).toContain('Bu bilgiler henüz yok.')
    expect(body).toContain('havayolu şu an tarife verisi kullanmıyor.')
    expect(body).toContain('“gözlenen” hareketler')
    // Bölüm "Canlı hava trafiği"nden sonra gelir.
    expect(html.indexOf('id="airport-schedule"')).toBeGreaterThan(html.indexOf('id="airport-live"'))
    const en = renderAirport('LTFM', 'en')
    expect(en).toContain('<h2 id="airport-schedule">Flight counts, delays and cancellations</h2>')
    expect(text(en)).toContain('Not available yet.')
    expect(en).toContain('<a href="/en/hakkinda">see the About page</a>')
  })

  it('hava durumu yuvası girişten sonra, canlı trafikten önce; kaynak satırı yalnızca onunla', () => {
    const html = renderToStaticMarkup(
      createElement(AirportView, {
        locale: 'tr',
        app: 'havayolu',
        airport: byIcao('LTFM'),
        airports: AIRPORTS,
        weather: createElement('section', { id: 'weather-slot' }),
      }),
    )
    const slot = html.indexOf('id="weather-slot"')
    expect(slot).toBeGreaterThan(html.indexOf('airport-lead'))
    expect(slot).toBeLessThan(html.indexOf('id="airport-live"'))
    expect(html).toContain('href="https://aviationweather.gov/"')
    expect(text(html)).toContain('resmî brifing yerine geçmez')
    expect(renderAirport('LTFM')).not.toContain('aviationweather.gov')
  })

  it('pist ışıklandırması yalnızca kayıtlıysa "Var"; kayıtlı değilse "Yok" denmez (LTFJ 06R/24L)', () => {
    const html = renderAirport('LTFJ')
    const table = html.slice(html.indexOf('<table'), html.indexOf('</table>'))
    expect(table).toContain('<td>Var</td>')
    expect(table).toContain('<td>Kayıtlı değil</td>')
    expect(table).not.toContain('<td>Yok</td>')
    const en = renderAirport('LTFJ', 'en')
    expect(en).toContain('<td>Not recorded</td>')
    expect(en).not.toContain('<td>No</td>')
  })

  it('canlı veri çekim alanının dışındaki havalimanı çevredeki uçakları vaat etmez (LTCW)', () => {
    const outside = text(renderAirport('LTCW'))
    expect(outside).toContain('Havalimanı canlı veri çekim alanının dışında')
    expect(outside).not.toContain('çevredeki uçaklar canlı haritada görünür')
    expect(text(renderAirport('LTCW', 'en'))).toContain('outside the live data fetch area')
    // Van (LTCI) Doğu çemberinin içindedir.
    const inside = text(renderAirport('LTCI'))
    expect(inside).toContain('Havalimanı canlı veri çekim alanının içinde')
    expect(inside).toContain('çevredeki uçaklar canlı haritada görünür')
  })

  it('ham OurAirports yerleşimi gösterilmez; temiz ve ilden farklı ilçe gösterilir', () => {
    // LTFM "Istanbul" (ille aynı), LTBA "Istanbul(Bakırköy)", LTFJ "Pendik, Istanbul".
    for (const icao of ['LTFM', 'LTBA', 'LTFJ']) {
      const body = text(renderAirport(icao))
      expect(body, icao).not.toContain('Hizmet verdiği yerleşim')
      expect(body, icao).not.toMatch(/Istanbul\(|Pendik, Istanbul/)
    }
    expect(text(renderAirport('LTBJ'))).toContain('Hizmet verdiği yerleşim Gaziemir')
  })

  it('İngilizce ad çeviridir: resmî Türkçe ad ve kaynağı ayrıca yazılır', () => {
    const html = renderAirport('LTBS', 'en')
    expect(html).toContain(
      'Official Turkish name: <span lang="tr">Muğla Dalaman Havalimanı</span> (DHMİ); the English name is a translation.',
    )
    expect(text(renderAirport('LTBS'))).toContain(
      'Resmî Türkçe ad: Muğla Dalaman Havalimanı (DHMİ)',
    )
    expect(text(renderAirport('LTAG', 'en'))).toContain('Name: OurAirports')
  })

  it('OurAirports adı resmî addan farklıysa görünür (JSON-LD alternateName ile aynı)', () => {
    expect(text(renderAirport('LTFM'))).toContain('OurAirports’taki adı İstanbul Airport')
  })

  it('rakımı ve pisti olmayan kayıt da çizilir', () => {
    const airport = airportFixture({ icao: 'LTXX', iata: 'XXX', elevationFt: null, runways: [] })
    const html = renderToStaticMarkup(
      createElement(AirportView, { locale: 'tr', app: 'havayolu', airport, airports: [airport] }),
    )
    expect(html).not.toContain('<table')
    expect(html).not.toContain('airport-nearby')
    expect(text(html)).toContain('Rakım —')
  })

  it('hiçbir metinde çözülmemiş yer tutucu yoktur', () => {
    for (const icao of ['LTFM', 'LTAG', 'LTAC', 'LTDB']) {
      for (const locale of ['tr', 'en'] as const) {
        expect(text(renderAirport(icao, locale)), `${icao} ${locale}`).not.toMatch(/\{\w+\}/)
      }
    }
  })
})

describe('AirportsView', () => {
  function renderList(locale: 'tr' | 'en', airports = AIRPORTS) {
    return renderToStaticMarkup(createElement(AirportsView, { locale, app: 'havayolu', airports }))
  }

  it('bütün havalimanları gerçek bir tabloda, ile göre sıralı', () => {
    const html = renderList('tr')
    expect(html).toContain(
      '<caption id="airports-caption">Havalimanları, ile göre sıralı</caption>',
    )
    const rows = [...html.matchAll(/<tr><th scope="row"><a href="(\/istasyon\/[A-Z0-9]+)">/g)]
    expect(rows).toHaveLength(61)
    expect(rows[0]?.[1]).toBe('/istasyon/LTAG')
    expect(html).not.toContain('is-unscheduled')
    expect(text(html)).toContain(
      'Listede 61 havalimanı var; her havalimanının sayfasında pistleri, hava durumu ve canlı harita bağlantısı bulunur.',
    )
    expect(text(html)).toContain('son değişiklik 29 Eylül 2026')
  })

  it('satırlar: il, kodlar, en uzun pist (m); tarifeli sefer ve istasyon sütunu yok (D-078)', () => {
    const html = renderList('tr')
    expect(html).toMatch(
      /<a href="\/istasyon\/LTFM">İstanbul Havalimanı<\/a><\/th><td>İstanbul<\/td><td class="mono">IST<\/td><td class="mono">LTFM<\/td><td class="num">4\.100 m<\/td><\/tr>/,
    )
    expect(html.match(/<th scope="col">/g)).toHaveLength(5)
    expect(text(html)).not.toMatch(
      /Tarifeli sefer|İzlenen istasyon|birincil istasyon|Kayıtlı değil/,
    )
    expect(text(renderList('en'))).not.toMatch(/Scheduled service|Monitored station/)
  })

  it('İngilizce: /en bağlantıları ve İngilizce adlar', () => {
    const html = renderList('en')
    expect(html).toContain('<a href="/en/istasyon/LTFM">Istanbul Airport</a>')
    expect(html).toContain(getMessages('en').airports.caption)
  })

  it('veri yoksa tablo yerine açıklama', () => {
    const html = renderList('tr', [])
    expect(html).not.toContain('<table')
    expect(html).toContain(getMessages('tr').airports.empty)
  })

  it('tek satırlık liste', () => {
    const one = airportFixture({ icao: 'LTXX', runways: [runwayFixture({ lengthFt: null })] })
    expect(text(renderList('tr', [one]))).toContain('Listede 1 havalimanı var')
  })
})
