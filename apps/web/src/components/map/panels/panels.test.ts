import { getMessages } from '@havayolu/i18n'
import type { LiveStatus } from '@havayolu/shared'
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TrackedAircraft } from '../../../lib/live/store'
import { AIRPORT_DISPLAY_MODES, type LabelSettings } from '../../../lib/map/label-settings'
import type { MapAirport } from '../airport-data'
import type { AircraftPlaceView } from './aircraft-place'
import { AircraftTable } from './aircraft-table'
import { InfoCard } from './info-card'
import { LabelSettingsControl, LabelSettingsPanel } from './label-settings-control'
import { SearchBox, SearchResultsList } from './search-box'
import { searchOptions, type AirportSearchRow } from './search-box-model'
import {
  dataAgeSeconds,
  providerHealth,
  StatusStrip,
  summarizeStatus,
  type StatusStripProps,
} from './status-strip'

const tr = getMessages('tr').map
const en = getMessages('en').map
const noop = () => undefined

const THY974: TrackedAircraft = {
  hex: '4bb26c',
  lat: 41.27534,
  lon: 28.75191,
  alt: 1093,
  gnd: false,
  gs: 233,
  trk: 359.4,
  vr: -1235,
  cs: 'THY974',
  fn: { airline: 'TK', number: '974' },
  reg: 'TC-LSA',
  type: 'A21N',
  cat: 'A3',
  sq: '0753',
  src: 'adsbLol',
  psrc: 'adsb_icao',
  t: 1_000_000,
  receivedAt: 1_000_000,
  sampledAt: 1_000_000,
}

const PRIVATE_JET: TrackedAircraft = {
  ...THY974,
  hex: '3c6444',
  lat: 40.9,
  lon: 29.3,
  cs: 'DCABC',
  fn: null,
  reg: null,
  type: null,
  gnd: true,
  alt: null,
  gs: 12,
  src: 'localReceiver',
  psrc: 'mlat',
}

/** HTML'deki metin (etiketler atılır, boşluklar sadeleşir). */
const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

describe('InfoCard', () => {
  const render = (props: Partial<Parameters<typeof InfoCard>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(InfoCard, {
        aircraft: THY974,
        now: 1_012_400,
        locale: 'tr',
        units: 'metric',
        following: false,
        onToggleFollow: noop,
        onClose: noop,
        messages: tr.card,
        ...props,
      }),
    )

  it('başlık sefer no, alanlar metrik birimle ve dilde yazılır', () => {
    const html = render()
    expect(html).toMatch(/<h2[^>]*>TK-974<\/h2>/)
    const text = textOf(html)
    for (const expected of [
      'Çağrı kodu THY974',
      'Tescil TC-LSA',
      'Uçak tipi A21N',
      'Yükseklik 333 m',
      'Yer hızı 432 km/sa',
      'Dikey hız −376 m/dk',
      'Yön 359°',
      'Transponder kodu 0753',
      'Son görülme 12 sn önce',
      'Veri kaynağı ADSB.lol',
      'Konum kaynağı ADS-B',
      'Hex kodu 4BB26C',
    ]) {
      expect(text).toContain(expected)
    }
    expect(html).toContain('data-thy="true"')
  })

  it('"Uçağı ortala" bir aç/kapa düğmesidir; kapat düğmesinin adı "Kapat"tır', () => {
    expect(render()).toMatch(/aria-pressed="false"[^>]*>.*Uçağı ortala<\/button>/)
    const following = render({ following: true })
    expect(following).toMatch(/aria-pressed="true"/)
    expect(following).toContain(tr.card.following)
    expect(render()).toContain('aria-label="Kapat"')
  })

  it('bilinmeyen alanlar "—", yerdeki uçak "yerde", dakikalık son görülme', () => {
    const text = textOf(render({ aircraft: PRIVATE_JET, now: THY974.receivedAt + 125_000 }))
    expect(text).toContain('Çağrı kodu DCABC')
    expect(text).toContain('Tescil —')
    expect(text).toContain('Uçak tipi —')
    expect(text).toContain('Yükseklik yerde')
    expect(text).toContain('Son görülme 2 dk önce')
    expect(text).toContain('Veri kaynağı Yerel alıcı')
    expect(text).toContain('Konum kaynağı MLAT')
    expect(render({ aircraft: PRIVATE_JET })).not.toContain('data-thy')
  })

  it('son görülme örneğin yaşıdır: görünüme yeni giren eski örnekli uçak "0 sn" görünmez', () => {
    // Örnek 95 sn önce alınmış, istemciye şimdi ulaştı.
    const stale = { ...THY974, receivedAt: 1_000_000, sampledAt: 1_000_000 - 95_000 }
    expect(textOf(render({ aircraft: stale, now: 1_000_000 }))).toContain('Son görülme 1 dk önce')
  })

  it('sefer no ve çağrı kodu yoksa başlık tescildir', () => {
    const html = render({ aircraft: { ...THY974, fn: null, cs: null, reg: 'TC-JVI' } })
    expect(html).toMatch(/<h2[^>]*>TC-JVI<\/h2>/)
    expect(html).toContain('>Tescil</p>')
  })

  it('İngilizce ve havacılık birimleri', () => {
    const text = textOf(render({ locale: 'en', units: 'aviation', messages: en.card }))
    expect(text).toContain('Altitude 1,093 ft')
    expect(text).toContain('Ground speed 233 kt')
    expect(text).toContain('Last seen 12 s ago')
  })
})

describe('AircraftTable', () => {
  /** Durum hücresi (D-085): THY974 IST'ye yaklaşmada, PRIVATE_JET yolda (rozetsiz). */
  const placeOf = (ac: TrackedAircraft): AircraftPlaceView =>
    ac.hex === THY974.hex
      ? { phase: 'approaching', badge: 'Yaklaşmada', text: 'IST, 18 km', airport: 'LTFM' }
      : { phase: 'enRoute', badge: null, text: 'SAW, 45 km kuzeyinde', airport: 'LTFJ' }
  const render = (props: Partial<Parameters<typeof AircraftTable>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(AircraftTable, {
        rows: [THY974, PRIVATE_JET],
        total: 2,
        selectedHex: '3c6444',
        onSelect: noop,
        placeOf,
        sheet: false,
        wideOpen: true,
        onWideOpenChange: noop,
        locale: 'tr',
        units: 'metric',
        messages: tr.table,
        ...props,
      }),
    )
  /** Sütun başlıklarının görünen metni ve ekran okuyucu metni (`.sr-only`). */
  const columnHeaders = (html: string) =>
    [...html.matchAll(/<th scope="col"[^>]*>(.*?)<\/th>/g)].map((m) => {
      const cell = m[1] ?? ''
      const visible = cell.replace(/<span class="sr-only">.*?<\/span>/g, '')
      const hidden = /<span class="sr-only">(.*?)<\/span>/.exec(cell)?.[1] ?? null
      return { visible: textOf(visible), srOnly: hidden }
    })

  it('gerçek tablo: başlık, dört sütun (Sefer, Kuyruk, Yükseklik, Konum ve durum), seçim durumu', () => {
    const html = render()
    expect(html).toContain('<caption>Haritada görünen uçaklar</caption>')
    expect(columnHeaders(html)).toEqual([
      { visible: 'Sefer', srOnly: null },
      { visible: 'Kuyruk', srOnly: 'Kuyruk tescili' },
      { visible: 'Yükseklik', srOnly: null },
      { visible: 'Konum ve durum', srOnly: null },
    ])
    // Görünen "Kuyruk" ekran okuyucudan gizlidir; erişilebilir ad "Kuyruk tescili"dir (WCAG 2.5.3).
    expect(html).toContain('<span aria-hidden="true">Kuyruk</span>')
    expect(html).toMatch(/<tr data-hex="4bb26c" aria-selected="false"/)
    expect(html).toMatch(/<tr data-hex="3c6444" aria-selected="true" class="is-selected"/)
    // Tip ve Hız listeden çıktı (bilgi kartında kalır).
    expect(textOf(html)).not.toContain('A21N')
    expect(textOf(html)).not.toContain('km/sa')
  })

  it('satır: klavye düğmesi, tescil (boşsa "—"), yükseklik ("yerde"), durum rozeti ve konum', () => {
    const html = render()
    expect(html).toMatch(
      /<th scope="row"><button type="button"[^>]*aria-label="TK-974 uçağını seç"/,
    )
    expect(textOf(html)).toContain('TK-974 TC-LSA 333 m Yaklaşmada IST, 18 km')
    expect(textOf(html)).toContain('DCABC — yerde SAW, 45 km kuzeyinde')
    expect(html).toContain('<td class="map-table__reg mono">TC-LSA</td>')
    expect(html).toContain('<td class="map-table__reg mono">—</td>')
    // Sayı ile birim bölünmez boşlukla birleşir: dar sütunda kırılmaz.
    expect(html).toContain('333 m')
    expect(html).toMatch(
      /<td class="map-table__place" data-phase="approaching" data-airport="LTFM"><span class="map-table__phase">Yaklaşmada<\/span> IST, 18 km<\/td>/,
    )
    // Yoldaki uçakta rozet yoktur.
    expect(html).toMatch(
      /<td class="map-table__place" data-phase="enRoute" data-airport="LTFJ">SAW, 45 km kuzeyinde<\/td>/,
    )
    // Havalimanı yokken konum koordinattır, havalimanı özniteliği yazılmaz.
    const bare = render({
      placeOf: () => ({ phase: 'enRoute', badge: null, text: '41.275, 28.752', airport: null }),
    })
    expect(bare).toContain('<td class="map-table__place" data-phase="enRoute">41.275, 28.752</td>')
  })

  it('durumlar canlı bölge değildir: değişince duyurulmaz', () => {
    const html = render()
    expect(html).not.toContain('aria-live')
    expect(html).not.toMatch(/role="(status|alert|log)"/)
  })

  it('"Durumlar tahminidir" notu tablonun altında, aria-describedby ile bağlı; TR ve EN', () => {
    const html = render()
    const describedBy = /<table class="map-table__table" aria-describedby="([^"]+)"/.exec(html)?.[1]
    expect(describedBy).toBeTruthy()
    expect(html).toContain(`<p id="${describedBy}" class="map-table__note">${tr.table.note}</p>`)
    expect(html.indexOf('</table>')).toBeLessThan(html.indexOf('class="map-table__note"'))
    expect(tr.table.note).toMatch(/^Durumlar tahminidir/)
    expect(tr.table.note).toContain('PIA, LADD')
    const english = render({ locale: 'en', units: 'aviation', messages: en.table })
    expect(english).toContain('<caption>Aircraft visible on the map</caption>')
    expect(columnHeaders(english).map((c) => c.visible)).toEqual([
      'Flight',
      'Tail',
      'Altitude',
      'Location and status',
    ])
    expect(columnHeaders(english)[1]?.srOnly).toBe('Tail number')
    expect(textOf(english)).toContain('TK-974 TC-LSA 1,093 ft')
    expect(textOf(english)).toContain('DCABC — on ground')
    expect(english).toContain(en.table.note)
    expect(en.table.note).toMatch(/^Statuses are estimates/)
  })

  it('satır sınırı aşılınca başlık "ilk N / toplam" olur; boş listede dört sütunluk açıklama satırı', () => {
    expect(render({ total: 180 })).toContain(
      '<caption>Haritada görünen uçaklar (ilk 2 / 180)</caption>',
    )
    const empty = render({ rows: [], total: 0 })
    expect(empty).toMatch(/<td colspan="4"/i)
    expect(empty).toContain(tr.table.empty)
  })

  it('geniş ekran: başlık düğmesi açık listeyi daraltır; hâl dışarıdan gelir (cihazda saklanır)', () => {
    const html = render()
    const toggle = /<button type="button" class="map-table__toggle"[^>]*>/.exec(html)?.[0] ?? ''
    expect(toggle).toContain('aria-expanded="true"')
    const controls = /aria-controls="([^"]+)"/.exec(toggle)?.[1]
    expect(html).toContain(`<div id="${controls}" class="map-table__body">`)
    expect(textOf(html)).toMatch(/^Uçak listesini gizle 2 /)
    expect(html).toContain('data-wide-open="true"')
    // Sayı rozeti ve ok simgesi ekran okuyucudan gizlidir.
    expect(html).toContain('<span class="map-table__count mono" aria-hidden="true">2</span>')
    expect(html).toMatch(/<svg class="map-table__chevron"[^>]*aria-hidden="true"/)

    const closed = render({ wideOpen: false })
    expect(closed).toMatch(/aria-expanded="false"[^>]*>.*Uçak listesini göster/)
    expect(closed).toContain('data-wide-open="false"')
  })

  it('dar ekran: liste her açılışta kapalı başlar, geniş ekranın kaydına bakmaz', () => {
    // Sunucu çizimi geniş ekranı varsayar; telefonda CSS `data-phone-open="false"`a bakar.
    expect(render()).toContain('data-phone-open="false"')
    const phone = render({ sheet: true, wideOpen: true })
    expect(phone).toMatch(/aria-expanded="false"[^>]*>.*Uçak listesini göster/)
    expect(phone).toContain('data-phone-open="false"')
  })
})

describe('StatusStrip', () => {
  const ok: LiveStatus = { providers: { adsbLol: 'ok' }, primaryAgeS: 4, newestAgeS: 2 }

  it('sağlayıcıların birleşik durumu', () => {
    expect(providerHealth({ ...ok, providers: {} })).toBe('none')
    expect(providerHealth(ok)).toBe('ok')
    expect(providerHealth({ ...ok, providers: { adsbLol: 'degraded' } })).toBe('degraded')
    expect(providerHealth({ ...ok, providers: { adsbLol: 'down', localReceiver: 'ok' } })).toBe(
      'degraded',
    )
    expect(providerHealth({ ...ok, providers: { adsbLol: 'down', localReceiver: 'down' } })).toBe(
      'down',
    )
  })

  it('uyarılar öncelik sırasıyla; bağlantı yokken bayat durum uyarısı gösterilmez', () => {
    expect(summarizeStatus(ok, 'full', 'open', false)).toEqual({ tone: 'ok', notices: [] })
    expect(summarizeStatus({ ...ok, providers: {} }, 'partial', 'open', true)).toEqual({
      tone: 'down',
      notices: ['noProvider', 'coveragePartial', 'basemapFailed'],
    })
    expect(
      summarizeStatus({ ...ok, providers: { adsbLol: 'degraded' } }, 'none', 'open', false),
    ).toEqual({ tone: 'warn', notices: ['providerDegraded', 'coverageNone'] })
    expect(
      summarizeStatus({ ...ok, providers: { adsbLol: 'down' } }, 'unknown', 'open', false),
    ).toEqual({ tone: 'down', notices: ['providerDown'] })
    expect(summarizeStatus({ ...ok, providers: {} }, 'none', 'reconnecting', true)).toEqual({
      tone: 'warn',
      notices: ['reconnecting', 'basemapFailed'],
    })
    expect(summarizeStatus(null, null, 'offline', false)).toEqual({
      tone: 'down',
      notices: ['offline'],
    })
  })

  it('veri yaşı: birincil istasyon, yoksa en yeni örnek', () => {
    expect(dataAgeSeconds(ok, 0)).toBe(4)
    expect(dataAgeSeconds({ ...ok, primaryAgeS: null }, 0)).toBe(2)
    expect(dataAgeSeconds({ ...ok, primaryAgeS: null, newestAgeS: null }, 0)).toBeNull()
    expect(dataAgeSeconds(null, 0)).toBeNull()
  })

  it('sağlayıcı sağlıklıyken mesaj gelmeyen sakin bölgede veri yaşı artmaz', () => {
    expect(dataAgeSeconds(ok, 3_400)).toBe(4)
    expect(dataAgeSeconds(ok, 300_000)).toBe(4)
  })

  it('sağlayıcı sorunluysa ya da yoksa mesajdan bu yana geçen süre eklenir', () => {
    expect(dataAgeSeconds({ ...ok, providers: { adsbLol: 'degraded' } }, 3_400)).toBe(7)
    expect(dataAgeSeconds({ ...ok, providers: { adsbLol: 'down' } }, 60_000)).toBe(64)
    expect(dataAgeSeconds({ ...ok, providers: {} }, 10_000)).toBe(14)
  })

  const render = (props: Partial<StatusStripProps> = {}) =>
    renderToStaticMarkup(
      createElement(StatusStrip, {
        status: ok,
        coverage: 'full',
        connection: 'open',
        basemapFailed: false,
        now: 5_000,
        messages: tr.status,
        ...props,
      }),
    )

  it('veri yaşı canlı bölgenin dışında yazılır; uyarılar role="status" içindedir', () => {
    const html = render({ basemapFailed: true })
    expect(html).toMatch(/<p role="status"[^>]*>.*Harita altlığı yüklenemedi\.<\/span><\/p>/)
    expect(html).toContain('Veri yaşı 4 sn')
    expect(html).not.toMatch(/role="status"[^>]*>[^]*Veri yaşı[^]*<\/p><p class="map-status__age/)
  })

  it('bağlantı açık değilken veri yaşı gösterilmez; gösterilecek bir şey yoksa şerit boştur', () => {
    const offline = render({ connection: 'reconnecting' })
    expect(offline).toContain(tr.status.reconnecting)
    expect(offline).not.toContain('Veri yaşı')
    const idle = render({ status: { ...ok, primaryAgeS: null, newestAgeS: null } })
    expect(idle).toContain('data-idle="true"')
    expect(idle).toContain('role="status"')
  })
})

describe('SearchBox', () => {
  const searchBoxProps = {
    apiBaseUrl: 'http://localhost:4100',
    locale: 'tr' as const,
    airports: [],
    messages: tr.search,
    onFound: noop,
    onAirportFound: noop,
  }

  it('arama alanı: role="search", etiketli combobox (kapalı) ve gönder düğmesi (D-108)', () => {
    const html = renderToStaticMarkup(createElement(SearchBox, searchBoxProps))
    expect(html).toMatch(/<form role="search"/)
    const input = /<input [^>]*>/.exec(html)?.[0] ?? ''
    const inputId = /id="([^"]+)"/.exec(input)?.[1]
    expect(inputId).toBeTruthy()
    expect(html).toContain(
      `<label for="${inputId}" class="sr-only">Uçak ya da havalimanı ara: sefer no, çağrı kodu, tescil ya da hex; havalimanı kodu, adı ya da şehri</label>`,
    )
    expect(input).toContain('type="search"')
    expect(input).toContain('role="combobox"')
    expect(input).toContain('aria-autocomplete="list"')
    expect(input).toContain('aria-expanded="false"')
    // Liste kapalıyken ne denetlenen liste ne etkin seçenek var.
    expect(input).not.toContain('aria-controls')
    expect(input).not.toContain('aria-activedescendant')
    expect(input).toContain('placeholder="Sefer, tescil, havalimanı"')
    // API sorgu sınırı (SEARCH_QUERY_MAX_LENGTH); HTML öznitelik adı büyük-küçük harf duyarsızdır.
    expect(input).toMatch(/maxlength="32"/i)
    expect(input).toMatch(/autocomplete="off"/i)
    expect(input).toContain(`aria-describedby="`)
    expect(html).toMatch(/<button type="submit"[^>]*>Ara<\/button>/)
    expect(html).toMatch(/aria-live="polite"/)
    expect(html).not.toContain('role="listbox"')
  })

  it('paylaşılan bağlantıdaki uçak bulunamadıysa durum satırında "bulunamadı" metni yazar', () => {
    const html = renderToStaticMarkup(
      createElement(SearchBox, { ...searchBoxProps, notice: tr.search.notFound }),
    )
    expect(html).toMatch(/<p id="[^"]+" class="map-search__status" aria-live="polite">Bu sefer/)
    expect(tr.search.notFound).toBe(
      'Bu sefer şu an havada görünmüyor ya da farklı bir çağrı koduyla uçuyor; tescil ile arayabilirsin.',
    )
  })
})

describe('SearchResultsList (D-108)', () => {
  const ist = { icao: 'LTFM', iata: 'IST' } as MapAirport
  const ath = { icao: 'LGAV', iata: 'ATH' } as MapAirport
  const rows = (locale: 'tr' | 'en'): AirportSearchRow[] => [
    {
      airport: ist,
      code: 'IST',
      name: locale === 'tr' ? 'İstanbul Havalimanı' : 'Istanbul Airport',
      place: locale === 'tr' ? 'İstanbul' : 'Istanbul',
      match: 'code',
    },
    // Yalnız kodla aramada (ad parçası yüklenemedi) ad ve yer boştur: yer yerine ICAO.
    { airport: ath, code: 'ATH', name: '', place: '', match: 'code' },
  ]

  /** Seçeneğin görünen metni (etiketler atılmış). */
  const optionText = (html: string, id: string) =>
    new RegExp(`<div id="${id}" role="option"[^>]*>(.*?)</div>`)
      .exec(html)?.[1]
      ?.replace(/<[^>]+>/g, '')
  /** Seçeneğin açılış etiketi. */
  const optionTag = (html: string, id: string) =>
    new RegExp(`<div id="${id}" role="option"[^>]*>`).exec(html)?.[0] ?? ''

  it.each(['tr', 'en'] as const)(
    'listbox: önce Havalimanları, sonra Uçaklar; kimlikler ve etkin seçenek (%s)',
    (locale) => {
      const t = getMessages(locale).map.search
      const options = searchOptions('list', rows(locale), [THY974])
      const html = renderToStaticMarkup(
        createElement(SearchResultsList, {
          id: 'list',
          options,
          activeId: 'list-a-LTFM',
          messages: t,
          onChoose: noop,
        }),
      )
      expect(html).toMatch(
        new RegExp(
          `^<div id="list" role="listbox" aria-label="${t.results}" class="map-search__results"`,
        ),
      )
      const groups = [...html.matchAll(/<div role="group" aria-labelledby="([^"]+)">/g)].map(
        (match) => match[1],
      )
      expect(groups).toEqual(['list-ga', 'list-gp'])
      expect(html).toContain(
        `<div id="list-ga" role="presentation" class="map-search__group-label">${t.groupAirports}</div>`,
      )
      expect(html).toContain(
        `<div id="list-gp" role="presentation" class="map-search__group-label">${t.groupAircraft}</div>`,
      )
      expect(html.indexOf(t.groupAirports)).toBeLessThan(html.indexOf(t.groupAircraft))
      expect(html).toContain('id="list-a-LTFM"')
      expect(html).toContain('id="list-a-LGAV"')
      expect(html).toContain('id="list-p-4bb26c"')
      expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
      expect(optionTag(html, 'list-a-LTFM')).toContain('aria-selected="true"')
      expect(html.match(/aria-selected="false"/g)).toHaveLength(2)
      // Havalimanı seçeneğinin adı virgüllerle açıkça verilir: içerikten türeyen ad blok satırın
      // çevresine boşluk koyardı ("IST , …"; Playwright ve tarayıcılar aynı).
      expect(optionTag(html, 'list-a-LTFM')).toContain(
        locale === 'tr'
          ? 'aria-label="IST, İstanbul Havalimanı, İstanbul · LTFM"'
          : 'aria-label="IST, Istanbul Airport, Istanbul · LTFM"',
      )
      expect(optionTag(html, 'list-a-LGAV')).toContain('aria-label="ATH, LGAV"')
      expect(optionText(html, 'list-a-LTFM')).toBe(
        locale === 'tr'
          ? 'ISTİstanbul Havalimanıİstanbul · LTFM'
          : 'ISTIstanbul AirportIstanbul · LTFM',
      )
      expect(optionText(html, 'list-a-LGAV')).toBe('ATHLGAV')
      // Uçak satırının adı görünen metnidir (virgüller metnin içinde).
      expect(optionTag(html, 'list-p-4bb26c')).not.toContain('aria-label')
      expect(optionText(html, 'list-p-4bb26c')).toBe('TK-974, A21N, TC-LSA')
      expect(html).not.toContain('sr-only')
      // "Havalimanları" panelinin kod sınıfı burada yoktur (e2e `airportListCodes` onu okur).
      expect(html).not.toContain('map-airports__code')
      expect(html).toContain('<span class="map-search__code">IST</span>')
      const place = locale === 'tr' ? 'İstanbul' : 'Istanbul'
      expect(html).toContain(`<span class="map-search__place">${place} · LTFM</span>`)
      expect(html).toContain('<span class="map-search__place">LGAV</span>')
    },
  )

  it('boş grup çizilmez: yalnız uçak sonuçları', () => {
    const html = renderToStaticMarkup(
      createElement(SearchResultsList, {
        id: 'list',
        options: searchOptions('list', [], [THY974]),
        activeId: null,
        messages: tr.search,
        onChoose: noop,
      }),
    )
    expect(html).not.toContain(tr.search.groupAirports)
    expect(html).toContain(tr.search.groupAircraft)
    expect(html).not.toContain('aria-selected="true"')
  })
})

/** Varsayılan etiket ayarı (uçaklar Tam, havalimanları Simge ve kod, ülke adları Göster). */
const LABEL_DEFAULTS: LabelSettings = {
  selected: 'full',
  others: 'full',
  airportDisplay: 'icon-code',
  countries: 'shown',
}

describe('LabelSettingsControl', () => {
  it('kapalıyken yalnızca "Etiketler" düğmesi çizilir', () => {
    const html = renderToStaticMarkup(
      createElement(LabelSettingsControl, {
        value: LABEL_DEFAULTS,
        onChange: noop,
        messages: tr.labels,
      }),
    )
    expect(html).toMatch(/aria-expanded="false"[^>]*>.*Etiketler<\/button>/)
    expect(html).not.toContain('type="radio"')
    expect(html).not.toContain('aria-controls')
  })
})

describe('LabelSettingsPanel (D-084, D-113)', () => {
  const render = (value: LabelSettings, messages = tr.labels) =>
    renderToStaticMarkup(
      createElement(LabelSettingsPanel, { id: 'labels', value, onChange: noop, messages }),
    )
  /**
   * Grubun `legend`i, `fieldset` nitelikleri ve radyo düğmeleri: [ad, değer, yazı, seçili mi,
   * kullanılabilir mi]. Kullanılabilir: yerel `disabled`, `aria-disabled` ve `tabindex="-1"` yok;
   * seçenek sekmeyle ulaşılır, ok tuşları grubun içinde seçer (tarayıcının radyo grubu davranışı).
   */
  const groups = (html: string) =>
    [...html.matchAll(/<fieldset([^>]*)><legend>([^<]+)<\/legend>(.*?)<\/fieldset>/g)].map(
      ([, fieldset = '', legend, body = '']) => ({
        legend,
        fieldset,
        options: [...body.matchAll(/<input type="radio"([^>]*)\/><span>([^<]+)<\/span>/g)].map(
          ([, attributes = '', text]) => ({
            name: /\bname="([^"]+)"/.exec(attributes)?.[1],
            mode: /\bvalue="([^"]+)"/.exec(attributes)?.[1],
            text,
            checked: /\bchecked=""/.test(attributes),
            usable: !/\b(?:disabled=""|aria-disabled=|tabindex="-1")/.test(attributes),
          }),
        ),
      }),
    )
  const checkedMode = (group: ReturnType<typeof groups>[number] | undefined) =>
    group?.options.find((o) => o.checked)?.mode

  it('dört grup: Seçili uçak, Diğer uçaklar, Havalimanları (Gizle / Simge / Simge ve kod), Ülke adları (Gizle / Göster)', () => {
    const html = render({ ...LABEL_DEFAULTS, others: 'short' })
    expect(html).toMatch(/^<div id="labels" class="map-panel map-labels__panel" role="group"/)
    const found = groups(html)
    expect(found.map((g) => g.legend)).toEqual([
      'Seçili uçak',
      'Diğer uçaklar',
      'Havalimanları',
      'Ülke adları',
    ])
    // Havalimanları (D-113): pinler ve kodları tek satırda, Gizle önce; varsayılan Simge ve kod.
    expect(found[2]?.options.map((o) => [o.mode, o.text, o.checked])).toEqual([
      ['hidden', 'Gizle', false],
      ['icon', 'Simge', false],
      ['icon-code', 'Simge ve kod', true],
    ])
    // Ülke adları (D-095): Gizle önce, varsayılan Göster.
    expect(found[3]?.options.map((o) => [o.mode, o.text, o.checked])).toEqual([
      ['hidden', 'Gizle', false],
      ['shown', 'Göster', true],
    ])
    // Her grubun radyo adı ayrıdır (ok tuşları yalnızca kendi grubunda gezer).
    expect(new Set(found.map((g) => g.options[0]?.name)).size).toBe(4)
    for (const group of found) {
      expect(new Set(group.options.map((o) => o.name)).size).toBe(1)
      expect(group.options.filter((o) => o.checked)).toHaveLength(1)
      // Hiçbir grup kapalı değildir: her seçenek sekmeyle ve ok tuşlarıyla seçilir.
      expect(group.fieldset, group.legend).not.toMatch(/disabled/)
      expect(
        group.options.every((o) => o.usable),
        group.legend,
      ).toBe(true)
    }
    expect(checkedMode(found[0])).toBe('full')
    expect(checkedMode(found[1])).toBe('short')
    // Ayrı "Havalimanı simgeleri" satırı ve not yok (ilk tasarım, D-113 → Seçilmeyenler).
    expect(textOf(html)).not.toContain('Havalimanı simgeleri')
    expect(html).not.toContain('map-labels__note')
    expect(html).not.toContain('aria-describedby')
    expect(textOf(html)).toContain(
      'Kısa: yalnızca sefer no. Tam: sefer no, hız ve yükseklik. Ülke adları haritayı uzaklaştırınca görünür.',
    )
    expect(textOf(html)).not.toContain('Kod ve ad')
  })

  it('seçili havalimanı seçeneği ayardan gelir, öbür grupları etkilemez; Gizle’de de satır açıktır', () => {
    for (const airportDisplay of ['hidden', 'icon', 'icon-code'] as const) {
      const found = groups(render({ ...LABEL_DEFAULTS, airportDisplay }))
      expect(found, airportDisplay).toHaveLength(4)
      expect(checkedMode(found[2]), airportDisplay).toBe(airportDisplay)
      expect(checkedMode(found[0]), airportDisplay).toBe('full')
      expect(checkedMode(found[1]), airportDisplay).toBe('full')
      expect(checkedMode(found[3]), airportDisplay).toBe('shown')
      expect(found.every((g) => g.options.every((o) => o.usable))).toBe(true)
    }
    for (const countries of ['hidden', 'shown'] as const) {
      const found = groups(render({ ...LABEL_DEFAULTS, countries }))
      expect(checkedMode(found[3]), countries).toBe(countries)
      expect(checkedMode(found[2]), countries).toBe('icon-code')
    }
  })

  it('İngilizce metinler: Airports (Hide / Icon / Icon and code)', () => {
    const enHtml = render({ ...LABEL_DEFAULTS, airportDisplay: 'hidden' }, en.labels)
    const found = groups(enHtml)
    expect(found.map((g) => g.legend)).toEqual([
      'Selected aircraft',
      'Other aircraft',
      'Airports',
      'Country names',
    ])
    expect(found[2]?.options.map((o) => [o.text, o.checked])).toEqual([
      ['Hide', true],
      ['Icon', false],
      ['Icon and code', false],
    ])
    expect(found[3]?.options.map((o) => [o.text, o.checked])).toEqual([
      ['Hide', false],
      ['Show', true],
    ])
    expect(textOf(enHtml)).not.toContain('Airport icons')
    expect(textOf(enHtml)).toContain('Country names appear when you zoom out.')
  })

  it('seçim yalnız havalimanları alanını değiştirir (onChange; öbür alanlar korunur)', () => {
    const value: LabelSettings = {
      selected: 'short',
      others: 'hidden',
      airportDisplay: 'icon-code',
      countries: 'hidden',
    }
    const changes: LabelSettings[] = []
    // Panel bir çizimin içinde çağrılır (useId); dönen ağaçtaki "Havalimanları" grubunun seçim işlevi
    // her seçenekle çağrılır.
    const probe = () => {
      const panel = LabelSettingsPanel({
        value,
        onChange: (next) => changes.push(next),
        messages: tr.labels,
      })
      const group = Children.toArray((panel.props as { children?: ReactNode }).children).find(
        (child): child is ReactElement<{ legend: string; onSelect: (mode: string) => void }> =>
          isValidElement(child) &&
          (child.props as { legend?: unknown }).legend === tr.labels.airports,
      )
      for (const mode of AIRPORT_DISPLAY_MODES) group?.props.onSelect(mode)
      return null
    }
    renderToStaticMarkup(createElement(probe))
    expect(changes).toEqual(
      AIRPORT_DISPLAY_MODES.map((airportDisplay) => ({ ...value, airportDisplay })),
    )
  })
})
