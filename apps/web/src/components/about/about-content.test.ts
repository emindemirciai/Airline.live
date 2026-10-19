import { getMessages } from '@havayolu/i18n'
import { LOCALES, PROJECT } from '@havayolu/shared'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DATA_ATTRIBUTION } from '../../lib/map-config'
import { TERMS_LINKS } from '../../lib/terms'
import { AVIATION_WEATHER_URL } from '../airports/weather-links'
import { aboutDescription, AboutContent, VRS_STANDING_DATA_URL } from './about-content'

const STATIONS = [
  { icao: 'LTFM', iata: 'IST', name: 'İstanbul Havalimanı', primary: true },
  { icao: 'LTAC', iata: 'ESB', name: 'Ankara Esenboğa Havalimanı', primary: false },
]

/** Tohum istasyonlarla kapsama planının dışında kalan tek havalimanı (lib/airports.test.ts). */
const OUTSIDE = [
  { icao: 'LTCW', iata: 'YKO', name: 'Hakkari Yüksekova Selahaddin Eyyubi Havalimanı' },
]

function render(
  locale: 'tr' | 'en',
  stations: typeof STATIONS | null = STATIONS,
  outside: typeof OUTSIDE | null = OUTSIDE,
) {
  return renderToStaticMarkup(
    createElement(AboutContent, { locale, app: 'havayolu', stations, outside }),
  )
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
}

describe('AboutContent', () => {
  it.each(LOCALES)('%s: bütün bölümler, yer tutucusuz', (locale) => {
    const t = getMessages(locale).about
    const html = render(locale)
    for (const heading of [
      t.shows.heading,
      t.limits.heading,
      t.method.heading,
      t.sources.heading,
      t.privacy.heading,
      t.more.heading,
    ]) {
      expect(html).toContain(`>${heading}</h2>`)
    }
    expect(text(html)).not.toMatch(/\{\w+\}/)
  })

  it('işleten: proje sahibinin herkese açık hesabı (kişisel veri yok)', () => {
    const html = render('tr')
    expect(html).toContain(`<a href="${PROJECT.ownerUrl}" rel="author">${PROJECT.owner}</a>`)
    expect(html).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i)
  })

  it('v1 sınırları, gizlilik kuralları ve tazelik hedefleri (domain.md, D-073)', () => {
    const body = text(render('tr'))
    expect(body).toContain('rötar, kapı, terminal, bagaj, kod paylaşımı ve iptal bilgisi')
    expect(body).toContain(
      'Canlı haritada yalnız bilinen bir havayolu çağrı koduyla uçan uçaklar gösterilir. Askerî, devlet ve özel uçakları tespit kurallarımızla göstermemeye çalışırız; bu kurallar kusursuz değildir.',
    )
    // Ş1 (D-115): İngilizcesi de mutlak değildir; eski mutlak cümle iki dilde de dönmez.
    expect(text(render('en'))).toContain(
      'The live map shows only aircraft flying under a known airline callsign. We use detection rules to try to keep military, state and private aircraft off the site; these rules are not perfect.',
    )
    for (const locale of LOCALES) {
      expect(text(render(locale)), locale).not.toMatch(
        /Askeri uçaklar haritada|Military aircraft are not shown/i,
      )
    }
    expect(body).toContain('PIA ya da LADD')
    expect(body).toContain('engel listesine')
    expect(body).toContain('yaklaşık 20 sn')
    expect(body).toContain('MLAT')
  })

  it('yalnızca kodla doğrulanan yöntem cümleleri (tahmini etiketi, birincil çember, durum satırı)', () => {
    for (const locale of LOCALES) {
      const body = text(render(locale))
      // Hiçbir değer "tahmini" etiketi taşımıyor; tüm hesaplanan değerlerin etiketli olduğu söylenmez.
      expect(body, locale).not.toMatch(/tahmini” etiketi|labelled “estimated”/)
    }
    const tr = text(render('tr'))
    // En sık çekilen çember 40 NM'dir (PRIMARY_EXTRA_RADIUS_NM), istasyonun 60 NM'lik çemberi değil.
    expect(tr).toContain('birincil istasyonun 74 km (40 NM) çevresinde yaklaşık 20 sn')
    // Durum satırı birincil istasyonun veri yaşını gösterir (status-strip.tsx → dataAgeSeconds).
    expect(tr).toContain('durum satırı birincil istasyonun çevresindeki gerçekleşen veri yaşını')
    expect(text(render('en'))).toContain('about 20 s within 74 km (40 NM) of the primary station')
  })

  it('çekim alanının dışındaki havalimanları veriden, bağlantılı', () => {
    const html = render('tr')
    expect(text(html)).toMatch(
      /Türkiye’de canlı veri çekim alanının dışında kalan havalimanları; çevrelerindeki uçaklar haritada görünmeyebilir: Hakkari Yüksekova Selahaddin Eyyubi Havalimanı \(YKO\)\s?\./,
    )
    expect(html).toContain('<a href="/istasyon/LTCW">')
    expect(render('en')).toContain('<a href="/en/istasyon/LTCW">')
    expect(text(render('tr', STATIONS, []))).not.toContain('çekim alanının dışında kalan')
    expect(text(render('tr', STATIONS, null))).not.toContain('çekim alanının dışında kalan')
  })

  it('liste kuralı: bütün halkalar açık, uzaklık sınırı yazılmaz; canlı veri alanı açıkça yazılır (D-080, D-090, D-102, D-106, D-109)', () => {
    const tr = text(render('tr'))
    expect(tr).toContain(
      'Havalimanları: listedeki her havalimanının kodları, pistleri ve en yakın havalimanları.',
    )
    expect(tr).toContain(
      'Havalimanı listesinde Türkiye’nin IATA kodlu havalimanları ile diğer ülkelerin IATA kodlu büyük ve orta boy havalimanları yer alır. Diğer ülkelerdeki havalimanlarının çoğu canlı veri çekim alanının dışındadır',
    )
    // Kapsama dürüstlüğü (D-106): canlı veri alanı ürün tercihi değil, bugünkü sınır olarak yazılır.
    expect(tr).toContain('Canlı uçak verisi şimdilik yalnızca Türkiye ve çevresinden çekilir')
    // Birincil istasyon girişte yazılır; site Türkiye ile sınırlanmaz.
    expect(tr).toContain('İstanbul Havalimanı’nı öncelikli izleyen')
    // OurAirports'un tarifeli sefer bilgisi gösterilmez (D-078, kullanıcı kararı).
    expect(tr).not.toMatch(/tarifeli sefer/i)
    const en = text(render('en'))
    expect(en).toContain(
      'The airport list includes airports in Türkiye with an IATA code and large and medium airports with an IATA code in other countries.',
    )
    // 4. halkada liste kuralı uzaklıkla yazılıyordu ("en fazla 5.000 km"); 5. halkayla sınır yok.
    for (const body of [tr, en]) expect(body).not.toMatch(/en fazla [\d.]+ km|at most [\d,]+ km/)
    expect(en).toContain('for every listed airport.')
    expect(en).toContain(
      'Live aircraft data is currently fetched only over Türkiye and the surrounding area',
    )
    expect(en).toContain('with Istanbul Airport as its top priority')
    expect(en).not.toMatch(/scheduled service/i)
    // "Türkiye odaklı" (D-106) ve 2. halkadan beri "yakın ülkeler" (D-088) yazılmaz.
    for (const body of [tr, en]) {
      expect(body).not.toMatch(/odaklı|focused on Türkiye|[Yy]akın ülke|neighbouring/)
    }
  })

  it('kaynaklar ve lisanslar bağlantılı', () => {
    const html = render('en')
    expect(html).toContain(`href="${DATA_ATTRIBUTION.href}"`)
    expect(html).toContain(`href="${DATA_ATTRIBUTION.licenseHref}"`)
    expect(html).toContain(`href="${TERMS_LINKS.ourAirports}"`)
    expect(html).toContain(`href="${VRS_STANDING_DATA_URL}"`)
    expect(html).toContain(`href="${TERMS_LINKS.openStreetMap}"`)
    expect(html).toContain('<span lang="en">Powered by Esri')
    expect(html).toContain(`href="${AVIATION_WEATHER_URL}"`)
  })

  it('hava durumu: ne gösterildiği ve kaynağı, resmî brifing olmadığı (D-078)', () => {
    const tr = text(render('tr'))
    expect(tr).toContain('Hava durumu: her havalimanı sayfasında son havacılık hava raporu (METAR)')
    expect(tr).toContain('resmî brifing yerine geçmez')
    expect(text(render('en'))).toContain('not an official briefing')
  })

  it('izlenen istasyonlar veriden, bağlantılı; birincil işaretli', () => {
    expect(text(render('tr'))).toMatch(
      /İzlenen havalimanları: İstanbul Havalimanı \(IST, birincil istasyon\), Ankara Esenboğa Havalimanı \(ESB\)\s?\./,
    )
    expect(render('tr')).toContain('<a href="/istasyon/LTFM">İstanbul Havalimanı</a>')
    expect(render('en')).toContain('<a href="/en/istasyon/LTAC">')
    // API'ye ulaşılamazsa liste çıkmaz, sayfa yine çizilir.
    expect(text(render('tr', null))).not.toContain('İzlenen havalimanları')
  })

  it('kullanım koşulları ve yenilikler dil önekiyle bağlanır', () => {
    expect(render('tr')).toContain('<a href="/kullanim-kosullari">Kullanım koşulları</a>')
    expect(render('en')).toContain('<a href="/en/kullanim-kosullari">Terms of use</a>')
    expect(render('en')).toContain('<a href="/en/yenilikler">What’s new</a>')
  })

  it('açıklama uygulama adıyla biçimlenir', () => {
    expect(aboutDescription('tr', 'havayolu')).toMatch(/^havayolu nasıl çalışır: /)
  })
})
