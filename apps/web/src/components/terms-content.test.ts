import { getMessages } from '@havayolu/i18n'
import { LOCALES } from '@havayolu/shared'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TERMS_LINKS } from '../lib/terms'
import { richText } from './rich-text'
import { TermsContent } from './terms-content'

function render(node: ReturnType<typeof richText>): string {
  return renderToStaticMarkup(createElement('p', null, node))
}

describe('richText', () => {
  it('yer tutucuları öğelerle doldurur, metni kaçışlar', () => {
    const html = render(
      richText('Veri {source} kaynağından <gelir> ({source}).', {
        source: createElement('a', { href: 'https://adsb.lol' }, 'ADSB.lol'),
      }),
    )
    expect(html).toBe(
      '<p>Veri <a href="https://adsb.lol">ADSB.lol</a> kaynağından &lt;gelir&gt; (<a href="https://adsb.lol">ADSB.lol</a>).</p>',
    )
  })

  it('yer tutucusuz metin olduğu gibi kalır; eksik değişken hata verir', () => {
    expect(render(richText('Düz metin.', {}))).toBe('<p>Düz metin.</p>')
    expect(() => richText('{missing}', {})).toThrow('{missing}')
  })
})

describe('TermsContent', () => {
  it.each(LOCALES)('%s: Esri maddesi, belgeler ve yürürlük tarihi', (locale) => {
    const t = getMessages(locale).terms
    const html = renderToStaticMarkup(createElement(TermsContent, { locale, app: 'havayolu' }))

    // E204 §3.1c.5: kullanıcı Esri şartlarına uymayı kabul eder; iki belge de bağlantılıdır.
    expect(html).toContain(`href="${TERMS_LINKS.esriPlatform}"`)
    expect(html).toContain(`href="${TERMS_LINKS.esriProductTerms}"`)
    expect(html).toContain(t.map.esriPlatform)
    expect(html).toContain('Esri')
    // ODbL 4.7: koşullar ODbL haklarını kısıtlamaz.
    expect(html).toContain(t.data.odbl)
    expect(html).toContain('href="https://opendatacommons.org/licenses/odbl/1-0/"')
    expect(html).toContain('href="https://adsb.lol"')
    expect(html).toMatch(/<time datetime="2026-10-15">/i)
    expect(html).toContain(locale === 'tr' ? '15 Ekim 2026' : '15 October 2026')
    // Hava durumu maddesi (D-078): kaynak ve NWS kullanım şartları bağlantılı, resmî brifing değil.
    expect(html).toContain('href="https://aviationweather.gov/"')
    expect(html).toContain('href="https://www.weather.gov/disclaimer"')
    expect(html).toContain(
      locale === 'tr' ? 'resmî brifing yerine geçmez' : 'not an official briefing',
    )
    expect(html).toContain(t.interim)
    // Uygulama adı yer tutucuları dolduruldu; açıkta "{ad}" kalmadı.
    expect(html).toContain('havayolu')
    expect(html).not.toMatch(/\{\w+\}/)
  })
})
