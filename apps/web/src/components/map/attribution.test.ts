import { getMessages } from '@havayolu/i18n'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DATA_ATTRIBUTION } from '../../lib/map-config'
import {
  dataAttributionHtml,
  escapeHtml,
  mapCustomAttributionHtml,
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
    expect(termsLinkHtml(termsLink)).toBe('<a href="/kullanim-kosullari">Koşullar</a>')
    expect(mapCustomAttributionHtml(DATA_ATTRIBUTION, dataAttributionPrefix, termsLink)).toBe(
      `${dataAttributionHtml(DATA_ATTRIBUTION, dataAttributionPrefix)} · <a href="/kullanim-kosullari">Koşullar</a>`,
    )
    expect(termsLinkHtml('<b>')).toBe('<a href="/kullanim-kosullari">&lt;b&gt;</a>')
  })
})

describe('DataAttributionNotice (harita yokken)', () => {
  it('MapLibre atıf kutusundakiyle aynı metin ve bağlantılar', () => {
    const { dataAttributionPrefix: prefix, termsLink: termsLabel } = getMessages('tr').map
    const html = renderToStaticMarkup(
      createElement(DataAttributionNotice, { attribution: DATA_ATTRIBUTION, prefix, termsLabel }),
    )
    expect(html).toBe(
      `<p class="live-map__attrib">${mapCustomAttributionHtml(DATA_ATTRIBUTION, prefix, termsLabel)}</p>`,
    )
    expect(html).toContain('Canlı uçuş verisi: <a href="https://adsb.lol"')
    expect(html).toContain('<a href="/kullanim-kosullari">Koşullar</a>')
  })
})
