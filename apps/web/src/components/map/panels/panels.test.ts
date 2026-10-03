import { getMessages } from '@havayolu/i18n'
import type { LiveStatus } from '@havayolu/shared'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TrackedAircraft } from '../../../lib/live/store'
import type { LabelSettings } from '../../../lib/map/label-settings'
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
  const render = (props: Partial<Parameters<typeof AircraftTable>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(AircraftTable, {
        rows: [THY974, PRIVATE_JET],
        total: 2,
        selectedHex: '3c6444',
        onSelect: noop,
        locale: 'tr',
        units: 'metric',
        messages: tr.table,
        ...props,
      }),
    )

  it('gerçek tablo: başlık, sütun başlıkları, satır başına hex ve seçim durumu', () => {
    const html = render()
    expect(html).toContain('<caption>Haritada görünen uçaklar</caption>')
    const columns = [...html.matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((m) => m[1])
    expect(columns).toEqual(['Sefer', 'Tip', 'Yükseklik', 'Hız', 'Konum'])
    expect(html).toMatch(/<tr data-hex="4bb26c" aria-selected="false"/)
    expect(html).toMatch(/<tr data-hex="3c6444" aria-selected="true" class="is-selected"/)
  })

  it('her satırın ilk hücresinde klavye için bir düğme, son hücrede konum vardır', () => {
    const html = render()
    expect(html).toMatch(
      /<th scope="row"><button type="button"[^>]*aria-label="TK-974 uçağını seç"/,
    )
    expect(html).toMatch(/<td class="mono">41\.275, 28\.752<\/td><\/tr>/)
    expect(textOf(html)).toContain('DCABC — yerde 22 km/sa 40.900, 29.300')
  })

  it('satır sınırı aşılınca başlık "ilk N / toplam" olur; boş listede açıklama satırı', () => {
    expect(render({ total: 180 })).toContain(
      '<caption>Haritada görünen uçaklar (ilk 2 / 180)</caption>',
    )
    const empty = render({ rows: [], total: 0 })
    expect(empty).toMatch(/<td colspan="5"/i)
    expect(empty).toContain(tr.table.empty)
  })

  it('dar ekran düğmesi listeyi açıp kapatır (başlangıçta kapalı)', () => {
    const html = render()
    expect(html).toMatch(/aria-expanded="false"[^>]*>.*Uçak listesini göster/)
    expect(html).toContain('data-expanded="false"')
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
        value: { selected: 'full', others: 'full', airports: 'code' },
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

  it('üç grup: Seçili uçak, Diğer uçaklar, Havalimanları (Gizle / Kod / Kod ve ad)', () => {
    const html = render({ selected: 'full', others: 'short', airports: 'code' })
    expect(html).toMatch(/^<div id="labels" class="map-panel map-labels__panel" role="group"/)
    const found = groups(html)
    expect(found.map((g) => g.legend)).toEqual(['Seçili uçak', 'Diğer uçaklar', 'Havalimanları'])
    expect(found[2]?.options.map((o) => [o.mode, o.text])).toEqual([
      ['hidden', 'Gizle'],
      ['code', 'Kod'],
      ['name', 'Kod ve ad'],
    ])
    // Her grubun radyo adı ayrıdır (ok tuşları yalnızca kendi grubunda gezer).
    expect(new Set(found.map((g) => g.options[0]?.name)).size).toBe(3)
    for (const group of found) {
      expect(new Set(group.options.map((o) => o.name)).size).toBe(1)
      expect(group.options.filter((o) => o.checked)).toHaveLength(1)
    }
    expect(found[0]?.options.find((o) => o.checked)?.mode).toBe('full')
    expect(found[1]?.options.find((o) => o.checked)?.mode).toBe('short')
    expect(found[2]?.options.find((o) => o.checked)?.mode).toBe('code')
    expect(textOf(html)).toContain('Kod ve ad: yakınlaştırınca havalimanının kısa adı da yazılır.')
  })

  it('seçili havalimanı seçeneği ayardan gelir; İngilizce metinler', () => {
    for (const airports of ['hidden', 'code', 'name'] as const) {
      const found = groups(render({ selected: 'full', others: 'full', airports }))
      expect(found[2]?.options.find((o) => o.checked)?.mode, airports).toBe(airports)
    }
    const en = groups(
      render({ selected: 'full', others: 'full', airports: 'name' }, getMessages('en').map.labels),
    )
    expect(en.map((g) => g.legend)).toEqual(['Selected aircraft', 'Other aircraft', 'Airports'])
    // "Code and name" 300 px panelin üçüncü sütununa sığmıyordu (iki satır); kısa karşılığı.
    expect(en[2]?.options.map((o) => o.text)).toEqual(['Hide', 'Code', 'With name'])
  })
})
