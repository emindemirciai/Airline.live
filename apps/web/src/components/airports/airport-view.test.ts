import { getMessages } from '@havayolu/i18n'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { airportFixture, runwayFixture } from '../../lib/test/airport-fixture'
import {
  fixtureForeignAirport,
  fixtureListedAirports,
  fixtureTurkishAirports,
} from '../../lib/test/ourairports-fixture'
import { airportCountry, airportDescription, formatCount } from './airport-text'
import { AirportView } from './airport-view'
import { civilClosureNote } from './civil-closure'
import { AirportsView } from './airports-view'

// `lib/airports` sunucu modülüdür; testte sunucu modülü olarak yüklenir.
vi.mock('server-only', () => ({}))

const AIRPORTS = fixtureTurkishAirports()
/** Listelenen havalimanları: Türkiye ile 1. ve 2. halkanın yabancı havalimanları (D-080, D-088). */
const LISTED = fixtureListedAirports()
const FOREIGN = LISTED.filter((a) => a.country !== 'TR')
const byIcao = (icao: string) => {
  const airport = LISTED.find((a) => a.icao === icao)
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
    expect(body).toContain(
      'Ad: İncirlik Hava Üssü (askerî hava üssü; DHMİ listesinde yer almaz, bulunduğu yerin adıyla yazılır)',
    )
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
    expect(text(renderAirport('LTAG', 'en'))).toContain(
      'Turkish name: İncirlik Hava Üssü (a military air base; it is not on the DHMİ list and is named after its location); the English name is a translation.',
    )
  })

  it('askerî üsler ve Ankara (Etimesgut) iki dilde: başlık, içerik yolu, ad kaynağı (D-084)', () => {
    const cases = [
      ['LTAD', 'Ankara (Etimesgut) Havalimanı', 'Ankara (Etimesgut) Airport', 'ANK'],
      ['LTAG', 'İncirlik Hava Üssü', 'Incirlik Air Base', 'UAB'],
      ['LTAH', 'Afyon Hava Üssü', 'Afyon Air Base', 'AFY'],
      ['LTBG', 'Bandırma Hava Üssü', 'Bandırma Air Base', 'BDM'],
      ['LTBI', 'Eskişehir Hava Üssü', 'Eskişehir Air Base', 'ESK'],
      ['LTBL', 'Çiğli Hava Üssü', 'Çiğli Air Base', 'IGL'],
    ] as const
    for (const [icao, tr, en, iata] of cases) {
      for (const [locale, name] of [
        ['tr', tr],
        ['en', en],
      ] as const) {
        const html = renderAirport(icao, locale)
        expect(html, `${icao} ${locale}`).toContain(
          `<h1>${name} <span class="airport-codes">(${iata}/${icao})</span></h1>`,
        )
        expect(html, `${icao} ${locale}`).toContain(`<span aria-current="page">${name}</span>`)
        // Başka dilde olduğu `lang` ile işaretlenen ögeler (OurAirports'taki ad, İngilizce sayfada
        // resmî Türkçe ad) sayılmaz; sayfanın kendi dilindeki metinde öbür dilin cins adı yoktur.
        const body = text(html.replace(/<(dd|span) lang="(?:tr|en)">[^<]*<\/\1>/g, ''))
        expect(body, `${icao} ${locale}`).not.toMatch(
          locale === 'tr' ? /\b(Air Base|Airbase|Airport)\b/ : /Havalimanı|Hava Üssü/,
        )
      }
    }
    // OurAirports'taki İngilizce ad Türkçe sayfada yalnız kendi satırında ve `lang="en"` ile kalır.
    expect(renderAirport('LTAD')).toContain('<dd lang="en">Etimesgut Air Base</dd>')
    expect(renderAirport('LTBL')).toContain('<dd lang="en">Çiğli Airbase</dd>')
    // Ankara (Etimesgut): resmî ad bakanlığınkidir, parantez ayırt etmek içindir.
    expect(text(renderAirport('LTAD'))).toContain(
      'Resmî Türkçe ad: Ankara Havalimanı (Ulaştırma ve Altyapı Bakanlığı); aynı ildeki diğer havalimanıyla karışmasın diye eski adı parantez içinde eklenmiştir.',
    )
    expect(renderAirport('LTAD', 'en')).toContain(
      'Official Turkish name: <span lang="tr">Ankara Havalimanı</span> (Ministry of Transport and Infrastructure)',
    )
    // Aynı ildeki havalimanları cümlesi Türkçe adlarla.
    expect(text(renderAirport('LTAC'))).toContain('Ankara (Etimesgut) Havalimanı (ANK)')
    expect(text(renderAirport('LTBJ'))).toContain('Çiğli Hava Üssü (IGL)')
    expect(text(renderAirport('LTBJ', 'en'))).toContain('Çiğli Air Base (IGL)')
  })

  it('OurAirports adı resmî addan farklıysa görünür (JSON-LD alternateName ile aynı)', () => {
    expect(text(renderAirport('LTFM'))).toContain('OurAirports’taki adı İstanbul Airport')
  })

  it('Türkiye havalimanının en yakınları listelenen havalimanlarından da hesaplanır (LTFM değişmez)', () => {
    const html = renderAirport('LTFM', 'tr', LISTED)
    const nearby = html.slice(html.indexOf('class="airport-nearby"'))
    const links = [...nearby.matchAll(/<li><a href="(\/istasyon\/[A-Z]{4})">/g)].map((m) => m[1])
    expect(links).toEqual(['/istasyon/LTBA', '/istasyon/LTFJ', '/istasyon/LTBU'])
    // "… ilindeki diğer havalimanları" cümlesine yabancı havalimanı girmez.
    expect(text(html)).toContain('İstanbul ilindeki diğer havalimanları:')
    expect(text(html)).not.toContain('Türkiye’deki en yakın havalimanı')
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
    for (const icao of ['LTFM', 'LTAG', 'LTAC', 'LTDB', 'LGAV', 'LCEN']) {
      for (const locale of ['tr', 'en'] as const) {
        expect(text(renderAirport(icao, locale, LISTED)), `${icao} ${locale}`).not.toMatch(
          /\{\w+\}/,
        )
      }
    }
  })
})

describe('AirportView: diğer ülkelerdeki havalimanı (D-080, D-106)', () => {
  it('Atina (LGAV): yer satırı şehir ve ülke; il cümlesi yok; ülke satırı', () => {
    const html = renderAirport('LGAV', 'tr', LISTED)
    expect(html).toMatch(
      /<h1>Atina Eleftherios Venizelos Havalimanı <span class="airport-codes">\(ATH\/LGAV\)<\/span><\/h1>/,
    )
    expect(html).toContain('<p class="airport-location">Atina, Yunanistan</p>')
    const body = text(html)
    expect(body).not.toMatch(/ilindeki diğer|, Türkiye\b| İl /)
    expect(body).toContain('Ülke Yunanistan')
    expect(body).toContain('Hizmet verdiği yerleşim Atina')
    // OurAirports yerleşimi ("Spata-Artemida") Türkçe sayfada yazılmaz.
    expect(body).not.toContain('Spata')
    expect(body).toContain(
      'OurAirports’taki adı Athens Eleftherios Venizelos International Airport',
    )
  })

  it('yurt dışı sayfasında Türkiye’ye göre satır yok; en yakın havalimanları listesi var (D-106)', () => {
    for (const icao of ['LGAV', 'HECA', 'LOWW', 'LLBG']) {
      for (const [locale, nearby] of [
        ['tr', 'En yakın havalimanları'],
        ['en', 'Nearest airports'],
      ] as const) {
        const body = text(renderAirport(icao, locale, LISTED))
        for (const removed of [
          'Türkiye’deki en yakın havalimanı',
          'Nearest airport in Türkiye',
          'listede yok',
          'not listed',
        ]) {
          expect(body, `${icao} ${locale}`).not.toContain(removed)
        }
        expect(body, `${icao} ${locale}`).toContain(nearby)
      }
    }
  })

  it('Türkçe sayfada yer satırı ve yerleşim Türkçe adla aynı şehirdir; OurAirports yerleşimi yazılmaz', () => {
    // OurAirports: "Thessaloniki", "Kos Island", Sitia için "Crete Island", "Damascus".
    for (const [icao, city, line, raw] of [
      ['LGTS', 'Selanik', 'Selanik, Yunanistan', 'Thessaloniki'],
      ['LGKO', 'İstanköy', 'İstanköy, Yunanistan', 'Kos Island'],
      ['LGST', 'Sitia', 'Sitia, Yunanistan', 'Crete Island'],
      ['OSDI', 'Şam', 'Şam, Suriye', 'Damascus'],
    ] as const) {
      const html = renderAirport(icao, 'tr', LISTED)
      expect(html, icao).toContain(`<p class="airport-location">${line}</p>`)
      expect(text(html), icao).toContain(`Hizmet verdiği yerleşim ${city}`)
      expect(html, icao).not.toContain(`<dd>${raw}</dd>`)
      expect(html, icao).not.toContain(`${raw}, `)
    }
  })

  it('canlı veri çekim alanının dışındaki yabancı havalimanı uçak vaat etmez; içindeki eder (Midilli)', () => {
    const athens = text(renderAirport('LGAV', 'tr', LISTED))
    expect(athens).toContain('Havalimanı canlı veri çekim alanının dışında')
    expect(athens).not.toContain('çevredeki uçaklar canlı haritada görünür')
    // Midilli (LGMT) batı çemberinin (39,5° K, 29,5° D, 250 NM) içindedir.
    expect(text(renderAirport('LGMT', 'tr', LISTED))).toContain(
      'Havalimanı canlı veri çekim alanının içinde',
    )
  })

  it('en yakın havalimanları Türkiye ve diğer ülkeleri karışık gösterir; yer il ya da ülkedir (Sakız)', () => {
    const html = renderAirport('LGHI', 'tr', LISTED)
    const nearby = text(html.slice(html.indexOf('class="airport-nearby"')))
    expect(nearby).toMatch(/\(ADB\) , İzmir: \d+ km/)
    expect(nearby).toMatch(/Havalimanı \([A-Z]{3}\) , Yunanistan: \d+ km/)
  })

  it('2. halka, Kahire (HECA): Türkçe ad ve şehir, ülke Mısır (D-088)', () => {
    const cairo = byIcao('HECA')
    expect(cairo.ring).toBe(2)
    const html = renderAirport('HECA', 'tr', LISTED)
    expect(html).toMatch(
      /<h1>Kahire Havalimanı <span class="airport-codes">\(CAI\/HECA\)<\/span><\/h1>/,
    )
    expect(html).toContain('<p class="airport-location">Kahire, Mısır</p>')
    const body = text(html)
    expect(body).toContain('Ülke Mısır')
    expect(body).toContain('Hizmet verdiği yerleşim Kahire')
    expect(body).not.toMatch(/ilindeki diğer|, Türkiye\b/)
    // API'nin `nearestTr` alanı değişmez (Gazipaşa-Alanya, GZP); sayfada yazılmaz (D-106).
    expect(cairo.nearestTr?.icao).toBe('LTFG')
    // Canlı uçak verisi yoktur: Kahire çekim alanının dışındadır.
    expect(body).toContain('Havalimanı canlı veri çekim alanının dışında')
    const en = renderAirport('HECA', 'en', LISTED)
    expect(en).toMatch(
      /<h1>Cairo International Airport <span class="airport-codes">\(CAI\/HECA\)<\/span><\/h1>/,
    )
    expect(en).toContain('<p class="airport-location">Cairo, Egypt</p>')
    expect(en).toContain('<a class="button" href="/en?havalimani=HECA">Open on the live map</a>')
  })

  it('3. halka, Viyana (LOWW): Türkçe ad ve şehir, ülke Avusturya (D-090)', () => {
    const vienna = byIcao('LOWW')
    expect(vienna.ring).toBe(3)
    const html = renderAirport('LOWW', 'tr', LISTED)
    expect(html).toMatch(
      /<h1>Viyana Havalimanı <span class="airport-codes">\(VIE\/LOWW\)<\/span><\/h1>/,
    )
    expect(html).toContain('<p class="airport-location">Viyana, Avusturya</p>')
    expect(html).not.toContain('civil-closure')
    const body = text(html)
    expect(body).toContain('Ülke Avusturya')
    // API'nin `distanceToTrKm` alanı değişmez (Gökçeada'ya, 1.149 km); sayfada yazılmaz (D-106).
    expect(vienna.distanceToTrKm).toBe(1149)
    const en = renderAirport('LOWW', 'en', LISTED)
    expect(en).toMatch(
      /<h1>Vienna International Airport <span class="airport-codes">\(VIE\/LOWW\)<\/span><\/h1>/,
    )
    expect(en).toContain('<p class="airport-location">Vienna, Austria</p>')
    expect(en).toContain('<a class="button" href="/en?havalimani=LOWW">Open on the live map</a>')
  })

  it('sivil uçuşlara kapalı olabilecek havalimanı: başlığın altında not, iki dilde (D-090)', () => {
    // Listelenen dördü: Krasnodar, Gelencik (1. halka), Elista (2. halka), Voronej (3. halka).
    for (const icao of ['URKK', 'URKG', 'URWI', 'UUOO']) {
      const html = renderAirport(icao, 'tr', LISTED)
      expect(html, icao).toMatch(
        /<p class="airport-location">[^<]+<\/p><p class="civil-closure" role="note">Sivil uçuşlara kapalı olabilir \(2022’den beri\)<\/p><\/header>/,
      )
      expect(renderAirport(icao, 'en', LISTED), icao).toContain(
        '<p class="civil-closure" role="note">May be closed to civil flights (since 2022)</p>',
      )
    }
    const closed = LISTED.filter((a) => civilClosureNote(a.icao, 'tr', '{since}') !== null)
    expect(closed.map((a) => a.icao).sort()).toEqual(['URKG', 'URKK', 'URWI', 'UUOO'])
  })

  it('4. halka (halka henüz kapalı, D-101): görünür pisti olmayan beş havalimanı pistsiz çizilir', () => {
    for (const icao of ['GMAZ', 'VIMB', 'ULDD', 'VOVI', 'ZWTK']) {
      const airport = fixtureForeignAirport(icao)
      expect(airport.ring, icao).toBe(4)
      expect(airport.runways, icao).toEqual([])
      for (const locale of ['tr', 'en'] as const) {
        const html = renderToStaticMarkup(
          createElement(AirportView, { locale, app: 'havayolu', airport, airports: LISTED }),
        )
        expect(html, `${icao} ${locale}`).not.toContain('<table')
        expect(text(html), `${icao} ${locale}`).not.toMatch(/\{\w+\}/)
        const description = airportDescription(airport, locale, false)
        expect(description, `${icao} ${locale}`).not.toMatch(/\{\w+\}/)
        expect(description, `${icao} ${locale}`).not.toMatch(/\b0 (pist|runway)/)
      }
    }
  })

  it('4. halka: uçları kayıtlı uzunluğa göre çok uzak pistte yön heading alanından, eşik havalimanı merkezinde (Amravati, D-101)', () => {
    const vaam = fixtureForeignAirport('VAAM')
    const [runway] = vaam.runways
    expect(vaam.runways).toHaveLength(1)
    expect(runway?.ends.map((end) => end.trueBearingDeg)).toEqual([75, 255])
    for (const end of runway?.ends ?? []) {
      expect([end.thresholdLat, end.thresholdLon]).toEqual([vaam.lat, vaam.lon])
    }
    // Pamplona'nın 2 ft'lik "03/21" satırı pist sayılmaz; Beauvais'nin boş "13R/31L" satırı gizli.
    expect(fixtureForeignAirport('LEPP').runways.map((r) => r.ends[0].ident)).toEqual(['15'])
    expect(fixtureForeignAirport('LFOB').runways.map((r) => r.ends[0].ident)).toEqual(['04', '12'])
  })

  it('Ercan (LCEN) KKTC olarak gösterilir', () => {
    const html = renderAirport('LCEN', 'tr', LISTED)
    expect(html).toContain('<p class="airport-location">Lefkoşa, KKTC</p>')
    expect(text(html)).toContain('Ülke Kuzey Kıbrıs Türk Cumhuriyeti (KKTC)')
    expect(text(html)).not.toMatch(/Kıbrıs Cumhuriyeti|\bCyprus\b/)
    const en = renderAirport('LCEN', 'en', LISTED)
    expect(en).toContain('<p class="airport-location">North Nicosia, TRNC</p>')
    expect(text(en)).toContain('Country Turkish Republic of Northern Cyprus (TRNC)')
  })

  it('İngilizce sayfa: OurAirports adı, ülke İngilizce; Türkçe ad derleme olarak belirtilir', () => {
    const html = renderAirport('LGAV', 'en', LISTED)
    expect(html).toMatch(
      /<h1>Athens Eleftherios Venizelos International Airport <span class="airport-codes">\(ATH\/LGAV\)<\/span><\/h1>/,
    )
    expect(html).toContain('<p class="airport-location">Athens, Greece</p>')
    expect(html).toContain('<a href="/en/havalimanlari">Airports</a>')
    expect(html).toContain('<a class="button" href="/en?havalimani=LGAV">Open on the live map</a>')
    expect(html).toContain(
      'English name: OurAirports · Turkish name: <span lang="tr">Atina Eleftherios Venizelos Havalimanı</span> (compiled with the Turkish place name, not an official name)',
    )
    expect(text(html)).not.toContain('Nearest airport in Türkiye')
    expect(text(html)).not.toMatch(/province|Havalimanı(nda|nın)/)
  })

  it('Türkçe ad kaynağı: resmî ad değil, Türkçe yer adıyla derleme', () => {
    expect(text(renderAirport('LGTS', 'tr', LISTED))).toContain(
      'Türkçe ad: Selanik Makedonya Havalimanı (Türkçe yer adıyla derlendi, resmî ad değildir) · İngilizce ad: OurAirports',
    )
    // Ad tablosunda olmayan havalimanı (5. halka; Roma Fiumicino 3. halkayla tabloya girdi, D-090).
    const unknown = airportFixture({
      icao: 'KJFK',
      iata: 'JFK',
      name: 'John F Kennedy International Airport',
      country: 'US',
      isoRegion: 'US-NY',
      ring: 5,
      distanceToTrKm: 7911,
    })
    const html = renderToStaticMarkup(
      createElement(AirportView, {
        locale: 'tr',
        app: 'havayolu',
        airport: unknown,
        airports: [...AIRPORTS, unknown],
      }),
    )
    expect(html).toContain('<h1>John F Kennedy Uluslararası Havalimanı <span')
    expect(text(html)).toContain('Ad: OurAirports (“Airport” Türkçede “Havalimanı” olarak yazılır)')
  })
})

describe('AirportsView', () => {
  function renderList(locale: 'tr' | 'en', airports = AIRPORTS) {
    return renderToStaticMarkup(createElement(AirportsView, { locale, app: 'havayolu', airports }))
  }

  it('bütün havalimanları gerçek bir tabloda, il adına göre sıralı', () => {
    const html = renderList('tr')
    expect(html).toContain('<h1>Havalimanları</h1>')
    expect(html).toContain('<h2 id="airports-turkey">Türkiye’deki havalimanları</h2>')
    expect(html).toContain(
      '<caption id="airports-caption">Türkiye’deki havalimanları, il adına göre sıralı</caption>',
    )
    // Yabancı havalimanı yoksa diğer ülkelerdeki havalimanları bölümü çizilmez.
    expect(html).not.toContain('airports-foreign')
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

  it('Diğer ülkelerdekiler: ikinci gerçek tablo, ülkeye sonra ada göre; en uzun pist', () => {
    const html = renderList('tr', LISTED)
    expect(html.match(/<table /g)).toHaveLength(2)
    const turkey = html.slice(
      html.indexOf('<section aria-labelledby="airports-turkey"'),
      html.indexOf('<section aria-labelledby="airports-foreign"'),
    )
    const foreign = html.slice(html.indexOf('<section aria-labelledby="airports-foreign"'))
    const rowLinks = (part: string) =>
      [...part.matchAll(/<tr><th scope="row"><a href="(\/istasyon\/[A-Z0-9]+)">/g)].map((m) => m[1])
    expect(rowLinks(turkey)).toHaveLength(61)
    expect(rowLinks(foreign)).toHaveLength(FOREIGN.length)
    // Başlık D-106'dan beri "Diğer ülkelerdeki havalimanları"dır (D-088'de "Türkiye dışındaki").
    expect(foreign).toContain('<h2 id="airports-foreign">Diğer ülkelerdeki havalimanları</h2>')
    expect(foreign).toContain(
      '<caption id="airports-foreign-caption">Diğer ülkelerdeki havalimanları, ülke adına göre sıralı</caption>',
    )
    expect(text(html)).not.toMatch(/[Yy]akın ülke/)
    expect(foreign).toContain(
      'role="region" aria-labelledby="airports-foreign-caption" tabindex="0"',
    )
    // Türkiye'ye uzaklık sütunu yoktur (D-106): beş sütun.
    expect(foreign.match(/<th scope="col">/g)).toHaveLength(5)
    expect(foreign).not.toContain('Türkiye’ye uzaklık')
    expect(foreign).toMatch(
      /<a href="\/istasyon\/LGAV">Atina Eleftherios Venizelos Havalimanı<\/a><\/th><td>Yunanistan<\/td><td class="mono">ATH<\/td><td class="mono">LGAV<\/td><td class="num">4\.\d{3} m<\/td><\/tr>/,
    )
    expect(foreign).toContain('<td>KKTC</td>')
    // Ülke sırası Türkçe alfabeyle; ilk ülke Afganistan (3. halkadan beri), son Yunanistan.
    const countries = [...foreign.matchAll(/<\/a><\/th><td>([^<]+)<\/td>/g)].map((m) => m[1])
    expect(countries[0]).toBe('Afganistan')
    expect(countries.at(-1)).toBe('Yunanistan')
    const body = text(html)
    // Özet tek toplam sayı yazar, binlik ayraçlı (D-106).
    expect(body).toContain(`Listede ${formatCount(61 + FOREIGN.length, 'tr')} havalimanı var;`)
    expect(body).toContain(
      'Türkiye’deki en yakın havalimanına uzaklığı en fazla 2.000 km olan, IATA kodlu büyük ve orta boy havalimanları yer alır; bazı havalimanları listelenmez.',
    )
    // OurAirports'un tarifeli sefer bilgisi gösterilmez (D-078, kullanıcı kararı).
    expect(body).not.toMatch(/tarifeli sefer|tarifesiz/i)
    expect(body).toContain('Canlı uçak verisi şimdilik yalnızca Türkiye ve çevresinden çekilir')
    // Ad kuralının örnekleri listede gerçekten öyle yazılır (D-088): Kahire exonym, Iași ve
    // Timișoara yerel adıyla (Yaş, Temeşvar yalnız tarihte kalan biçimlerdir).
    expect(body).toContain(
      'böyle bir adı olmayan yer yerel adıyla kalır (Iași, Timișoara). İngilizce adlar',
    )
    for (const [icao, start] of [
      ['HECA', 'Kahire '],
      ['LRIA', 'Iași '],
      ['LRTR', 'Timișoara '],
    ] as const) {
      expect(foreign, icao).toMatch(new RegExp(`<a href="/istasyon/${icao}">${start}`))
    }
  })

  it('Diğer ülkelerdekiler İngilizce: ülke adları ve /en bağlantıları', () => {
    const html = renderList('en', LISTED)
    const foreign = html.slice(html.indexOf('<section aria-labelledby="airports-foreign"'))
    expect(foreign).toContain('<h2 id="airports-foreign">Airports in other countries</h2>')
    expect(foreign).toContain(
      '<caption id="airports-foreign-caption">Airports in other countries, sorted by country name</caption>',
    )
    expect(foreign).toContain(
      '<a href="/en/istasyon/LGAV">Athens Eleftherios Venizelos International Airport</a></th><td>Greece</td>',
    )
    expect(foreign).toContain('<td>TRNC</td>')
    const countries = [...foreign.matchAll(/<\/a><\/th><td>([^<]+)<\/td>/g)].map((m) => m[1])
    expect(countries[0]).toBe(airportCountry(byIcao('OAHR'), 'en'))
    expect(countries[0]).toBe('Afghanistan')
    expect(text(html)).toContain(`The list has ${formatCount(61 + FOREIGN.length, 'en')} airports;`)
    expect(text(html)).not.toContain('Distance to Türkiye')
    expect(text(html)).toContain('at most 2,000 km from the nearest airport in Türkiye')
    expect(text(html)).not.toMatch(/neighbouring/)
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
