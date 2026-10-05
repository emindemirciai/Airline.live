import { getMessages } from '@havayolu/i18n'
import type { LiveStatus } from '@havayolu/shared'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TrackedAircraft } from '../../../lib/live/store'
import type { LabelSettings } from '../../../lib/map/label-settings'
import type { AircraftPlaceView } from './aircraft-place'
import { AircraftTable } from './aircraft-table'
import { InfoCard } from './info-card'
import { LabelSettingsControl, LabelSettingsPanel } from './label-settings-control'
import { SearchBox } from './search-box'
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
  it('arama alanı: role="search", etiketli searchbox ve gönder düğmesi', () => {
    const html = renderToStaticMarkup(
      createElement(SearchBox, {
        apiBaseUrl: 'http://localhost:4100',
        messages: tr.search,
        onFound: noop,
      }),
    )
    expect(html).toMatch(/<form role="search"/)
    const inputId = /<input id="([^"]+)" type="search"/.exec(html)?.[1]
    expect(inputId).toBeTruthy()
    expect(html).toContain(
      `<label for="${inputId}" class="sr-only">Uçak ara: sefer no, çağrı kodu, tescil ya da hex</label>`,
    )
    // API sorgu sınırı (SEARCH_QUERY_MAX_LENGTH); HTML öznitelik adı büyük-küçük harf duyarsızdır.
    expect(html).toMatch(/maxlength="32"/i)
    expect(html).toMatch(/<button type="submit"[^>]*>Ara<\/button>/)
    expect(html).toMatch(/aria-live="polite"/)
  })

  it('paylaşılan bağlantıdaki uçak bulunamadıysa durum satırında "bulunamadı" metni yazar', () => {
    const html = renderToStaticMarkup(
      createElement(SearchBox, {
        apiBaseUrl: 'http://localhost:4100',
        messages: tr.search,
        onFound: noop,
        notice: tr.search.notFound,
      }),
    )
    expect(html).toMatch(/<p id="[^"]+" class="map-search__status" aria-live="polite">Bu sefer/)
    expect(tr.search.notFound).toBe(
      'Bu sefer şu an havada görünmüyor ya da farklı bir çağrı koduyla uçuyor; tescil ile arayabilirsin.',
    )
  })
})

describe('LabelSettingsControl', () => {
  it('kapalıyken yalnızca "Etiketler" düğmesi çizilir', () => {
    const html = renderToStaticMarkup(
      createElement(LabelSettingsControl, {
        value: { selected: 'full', others: 'full', airports: 'code', countries: 'shown' },
        onChange: noop,
        messages: tr.labels,
      }),
    )
    expect(html).toMatch(/aria-expanded="false"[^>]*>.*Etiketler<\/button>/)
    expect(html).not.toContain('type="radio"')
    expect(html).not.toContain('aria-controls')
  })
})

describe('LabelSettingsPanel (D-084)', () => {
  const render = (value: LabelSettings, messages = tr.labels) =>
    renderToStaticMarkup(
      createElement(LabelSettingsPanel, { id: 'labels', value, onChange: noop, messages }),
    )
  /** Grubun `legend`i ve radyo düğmeleri: [ad, değer, seçili mi]. */
  const groups = (html: string) =>
    [...html.matchAll(/<fieldset[^>]*><legend>([^<]+)<\/legend>(.*?)<\/fieldset>/g)].map(
      ([, legend, body = '']) => ({
        legend,
        options: [...body.matchAll(/<input type="radio"([^>]*)\/><span>([^<]+)<\/span>/g)].map(
          ([, attributes = '', text]) => ({
            name: /\bname="([^"]+)"/.exec(attributes)?.[1],
            mode: /\bvalue="([^"]+)"/.exec(attributes)?.[1],
            text,
            checked: /\bchecked=""/.test(attributes),
          }),
        ),
      }),
    )

  it('dört grup: Seçili uçak, Diğer uçaklar, Havalimanları (Gizle / Kod), Ülke adları (Gizle / Göster)', () => {
    const html = render({ selected: 'full', others: 'short', airports: 'code', countries: 'shown' })
    expect(html).toMatch(/^<div id="labels" class="map-panel map-labels__panel" role="group"/)
    const found = groups(html)
    expect(found.map((g) => g.legend)).toEqual([
      'Seçili uçak',
      'Diğer uçaklar',
      'Havalimanları',
      'Ülke adları',
    ])
    // "Kod ve ad" 2026-10-04'te kaldırıldı: ad, havalimanı penceresindedir (kullanıcı isteği).
    expect(found[2]?.options.map((o) => [o.mode, o.text])).toEqual([
      ['hidden', 'Gizle'],
      ['code', 'Kod'],
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
    }
    expect(found[0]?.options.find((o) => o.checked)?.mode).toBe('full')
    expect(found[1]?.options.find((o) => o.checked)?.mode).toBe('short')
    expect(found[2]?.options.find((o) => o.checked)?.mode).toBe('code')
    expect(textOf(html)).toContain(
      'Kısa: yalnızca sefer no. Tam: sefer no, hız ve yükseklik. Ülke adları haritayı uzaklaştırınca görünür.',
    )
    expect(textOf(html)).not.toContain('Kod ve ad')
  })

  it('seçili havalimanı ve ülke adı seçeneği ayardan gelir; İngilizce metinler', () => {
    for (const airports of ['hidden', 'code'] as const) {
      const found = groups(
        render({ selected: 'full', others: 'full', airports, countries: 'shown' }),
      )
      expect(found[2]?.options.find((o) => o.checked)?.mode, airports).toBe(airports)
    }
    for (const countries of ['hidden', 'shown'] as const) {
      const found = groups(
        render({ selected: 'full', others: 'full', airports: 'code', countries }),
      )
      expect(found[3]?.options.find((o) => o.checked)?.mode, countries).toBe(countries)
      expect(found[2]?.options.find((o) => o.checked)?.mode, countries).toBe('code')
    }
    const enMessages = getMessages('en').map.labels
    const enHtml = render(
      { selected: 'full', others: 'full', airports: 'hidden', countries: 'shown' },
      enMessages,
    )
    const en = groups(enHtml)
    expect(en.map((g) => g.legend)).toEqual([
      'Selected aircraft',
      'Other aircraft',
      'Airports',
      'Country names',
    ])
    expect(en[2]?.options.map((o) => o.text)).toEqual(['Hide', 'Code'])
    expect(en[3]?.options.map((o) => [o.text, o.checked])).toEqual([
      ['Hide', false],
      ['Show', true],
    ])
    expect(textOf(enHtml)).toContain('Country names appear when you zoom out.')
  })
})
