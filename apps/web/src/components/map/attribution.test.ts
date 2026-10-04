import { getMessages } from '@havayolu/i18n'
import { currentVersion } from '@havayolu/shared'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { localePath } from '../../lib/locale-routing'
import { DATA_ATTRIBUTION } from '../../lib/map-config'
import { TERMS_PATH } from '../../lib/terms'
import {
  ATTRIBUTION_INNER_SELECTOR,
  dataAttributionHtml,
  escapeHtml,
  mapCustomAttributionHtml,
  prependSiteCredit,
  SITE_CREDIT_CLASS,
  siteCredit,
  siteCreditHtml,
  termsLinkHtml,
} from './attribution'
import { DataAttributionNotice } from './data-attribution'

describe('dataAttributionHtml', () => {
  it('ADSB.lol ve ODbL bağlantılı atıf (data-sources.md §1)', () => {
    expect(dataAttributionHtml(DATA_ATTRIBUTION)).toBe(
      '<a href="https://adsb.lol" target="_blank" rel="noopener">ADSB.lol</a> — ' +
        '<a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL 1.0</a>',
    )
  })

  it('ön ek eklenebilir; metinler kaçışlanır', () => {
    expect(dataAttributionHtml(DATA_ATTRIBUTION, 'Canlı uçuş verisi:')).toMatch(
      /^Canlı uçuş verisi: <a href="https:\/\/adsb\.lol"/,
    )
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    )
  })
})

describe('mapCustomAttributionHtml', () => {
  it('canlı veri atfı ve kullanım koşulları bağlantısı tek girdidir (E204 §3.1c.5)', () => {
    const { dataAttributionPrefix, termsLink } = getMessages('tr').map
    expect(termsLinkHtml(termsLink, TERMS_PATH)).toBe('<a href="/kullanim-kosullari">Koşullar</a>')
    expect(
      mapCustomAttributionHtml(DATA_ATTRIBUTION, dataAttributionPrefix, termsLink, TERMS_PATH),
    ).toBe(
      `${dataAttributionHtml(DATA_ATTRIBUTION, dataAttributionPrefix)} · <a href="/kullanim-kosullari">Koşullar</a>`,
    )
    expect(termsLinkHtml('<b>', TERMS_PATH)).toBe('<a href="/kullanim-kosullari">&lt;b&gt;</a>')
  })

  it('İngilizce sayfada koşullar bağlantısı /en önekini taşır', () => {
    const { termsLink } = getMessages('en').map
    expect(termsLinkHtml(termsLink, localePath('en', TERMS_PATH))).toBe(
      `<a href="/en/kullanim-kosullari">${termsLink}</a>`,
    )
    expect(termsLinkHtml('x', '/a"b')).toBe('<a href="/a&quot;b">x</a>')
  })
})

/** Site alt bilgisindekiyle aynı kaynak: varsayılan ad ve changelog'daki en yeni sürüm. */
const SITE = { name: 'havayolu', version: currentVersion() }
const CHANGELOG_PATH = '/yenilikler'

function creditFor(locale: 'tr' | 'en') {
  return siteCredit(
    SITE,
    localePath(locale, CHANGELOG_PATH),
    getMessages(locale).map.siteCreditLabel,
  )
}

describe('siteCredit (D-089)', () => {
  it('künye "havayolu v<sürüm>"; sürüm changelog’dan, bağlantı Türkçe Yenilikler sayfası', () => {
    const credit = creditFor('tr')
    expect(credit.text).toBe(`havayolu v${currentVersion()}`)
    expect(credit.text).toMatch(/^havayolu v\d+\.\d+\.\d+/)
    expect(credit.href).toBe('/yenilikler')
    // Erişilebilir ad görünen metinle başlar (WCAG 2.5.3), nereye gittiğini de söyler.
    expect(credit.label).toBe(`havayolu v${currentVersion()}, yenilikler`)
  })

  it('İngilizce sayfada /en/yenilikler ve İngilizce erişilebilir ad', () => {
    const credit = creditFor('en')
    expect(credit.href).toBe('/en/yenilikler')
    expect(credit.label).toBe(`havayolu v${currentVersion()}, what’s new`)
    expect(credit.label.startsWith(credit.text)).toBe(true)
  })

  it('ad ve sürüm verilenden gelir (APP_NAME ile değişir)', () => {
    const credit = siteCredit({ name: 'deneme', version: '1.2.3' }, '/yenilikler', '{credit}, x')
    expect(credit).toEqual({
      text: 'deneme v1.2.3',
      href: '/yenilikler',
      label: 'deneme v1.2.3, x',
    })
  })

  it('HTML: aynı sekmede site içi bağlantı ve ekran okuyucudan gizli ayraç; metinler kaçışlanır', () => {
    const credit = creditFor('tr')
    expect(siteCreditHtml(credit)).toBe(
      `<span class="${SITE_CREDIT_CLASS}">` +
        `<a href="/yenilikler" aria-label="havayolu v${currentVersion()}, yenilikler">havayolu v${currentVersion()}</a>` +
        '<span aria-hidden="true"> | </span></span>',
    )
    expect(siteCreditHtml(credit)).not.toContain('target=')
    expect(siteCreditHtml({ text: '<b>', href: '/a"b', label: `'&'` })).toBe(
      `<span class="${SITE_CREDIT_CLASS}"><a href="/a&quot;b" aria-label="&#39;&amp;&#39;">&lt;b&gt;</a>` +
        '<span aria-hidden="true"> | </span></span>',
    )
  })

  it('künye MapLibre girdisi değildir: canlı veri girdisinde yoktur', () => {
    const { dataAttributionPrefix, termsLink } = getMessages('tr').map
    expect(
      mapCustomAttributionHtml(DATA_ATTRIBUTION, dataAttributionPrefix, termsLink, TERMS_PATH),
    ).not.toContain(SITE_CREDIT_CLASS)
  })
})

/**
 * MapLibre atıf şeridinin en küçük taklidi: `details.maplibregl-ctrl-attrib` içinde `summary` ve
 * girdilerin kabı (`div.maplibregl-ctrl-attrib-inner`). `strip` kabın kardeşlerini sırayla tutar;
 * kabın içi (`INNER`) MapLibre'nindir, altlık değişince yalnızca o yeniden yazılır.
 */
function fakeMapContainer(withAttribution = true) {
  const strip: string[] = ['<summary></summary>', 'INNER']
  const details = {
    querySelector: (selector: string) =>
      selector === `:scope > .${SITE_CREDIT_CLASS}` &&
      strip.some((part) => part.includes(`class="${SITE_CREDIT_CLASS}"`))
        ? {}
        : null,
  }
  const inner = {
    parentElement: details,
    insertAdjacentHTML: (position: string, html: string) => {
      if (position !== 'beforebegin') throw new Error(`unexpected position ${position}`)
      strip.splice(strip.indexOf('INNER'), 0, html)
    },
  }
  const container = {
    querySelector: (selector: string) =>
      withAttribution && selector === ATTRIBUTION_INNER_SELECTOR ? inner : null,
  }
  return { container: container as unknown as ParentNode, strip }
}

describe('prependSiteCredit (D-089)', () => {
  it('künye girdilerin kabının önüne konur: şerit her altlıkta künyeyle başlar', () => {
    const { container, strip } = fakeMapContainer()
    const html = siteCreditHtml(creditFor('tr'))
    expect(prependSiteCredit(container, html)).toBe(true)
    expect(strip).toEqual(['<summary></summary>', html, 'INNER'])
  })

  it('ikinci kez eklenmez', () => {
    const { container, strip } = fakeMapContainer()
    const html = siteCreditHtml(creditFor('tr'))
    prependSiteCredit(container, html)
    expect(prependSiteCredit(container, html)).toBe(true)
    expect(strip.filter((part) => part === html)).toHaveLength(1)
  })

  it('atıf şeridi yoksa false', () => {
    const { container, strip } = fakeMapContainer(false)
    expect(prependSiteCredit(container, siteCreditHtml(creditFor('tr')))).toBe(false)
    expect(strip).toEqual(['<summary></summary>', 'INNER'])
  })
})

describe('DataAttributionNotice (harita yokken)', () => {
  it('MapLibre atıf kutusundakiyle aynı metin, bağlantılar ve sıra: önce künye', () => {
    const { dataAttributionPrefix: prefix, termsLink: termsLabel } = getMessages('tr').map
    const credit = creditFor('tr')
    const html = renderToStaticMarkup(
      createElement(DataAttributionNotice, {
        attribution: DATA_ATTRIBUTION,
        prefix,
        termsLabel,
        termsHref: TERMS_PATH,
        siteCredit: credit,
      }),
    )
    expect(html).toBe(
      `<p class="live-map__attrib">${siteCreditHtml(credit)}${mapCustomAttributionHtml(DATA_ATTRIBUTION, prefix, termsLabel, TERMS_PATH)}</p>`,
    )
    expect(html).toMatch(
      /^<p class="live-map__attrib"><span class="map-site-credit"><a href="\/yenilikler"/,
    )
    expect(html).toContain('Canlı uçuş verisi: <a href="https://adsb.lol"')
    expect(html).toContain('<a href="/kullanim-kosullari">Koşullar</a>')
  })
})
