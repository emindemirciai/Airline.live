import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { JsonLd, jsonLdDocument, serializeJsonLd } from './json-ld'

function scriptBody(html: string): string {
  const match = /^<script type="application\/ld\+json">([\s\S]*)<\/script>$/.exec(html)
  if (!match?.[1]) throw new Error(`tek bir JSON-LD betiği beklenirdi: ${html}`)
  return match[1]
}

describe('JsonLd', () => {
  it('tek bir application/ld+json betiği çizer; içerik geçerli JSON-LD', () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, { data: { '@type': 'WebSite', name: 'havayolu' } }),
    )
    expect(JSON.parse(scriptBody(html))).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'havayolu',
    })
  })

  it('"<" \\u003c olarak yazılır: veri betiği kapatamaz, HTML yorumu açamaz', () => {
    const data = { '@type': 'Thing', name: '</script><script>alert(1)</script><!--' }
    const html = renderToStaticMarkup(createElement(JsonLd, { data }))
    const body = scriptBody(html)
    expect(body).not.toContain('<')
    expect(body).toContain('\\u003c/script>')
    // Ayrıştırınca özgün metin geri gelir.
    expect(JSON.parse(body)).toMatchObject({ name: data.name })
    expect(html.match(/<script/g)).toHaveLength(1)
  })

  it('düğüm dizisi @graph olarak tek bağlamla sarılır', () => {
    const nodes = [{ '@type': 'WebSite' }, { '@type': 'Organization' }]
    expect(jsonLdDocument(nodes)).toEqual({ '@context': 'https://schema.org', '@graph': nodes })
    expect(JSON.parse(serializeJsonLd(nodes))['@graph']).toHaveLength(2)
  })

  it('hazır @context korunur, yeniden eklenmez', () => {
    const doc = { '@context': 'https://schema.org', '@graph': [] }
    expect(jsonLdDocument(doc)).toBe(doc)
  })
})
