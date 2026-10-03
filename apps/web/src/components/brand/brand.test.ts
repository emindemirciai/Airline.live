import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BrandMark } from './brand-mark'
import { SiteBrand } from './site-brand'

/** Erişilebilir ad yaklaşık olarak: `aria-hidden` alt ağaçları atılır, kalan metin birleştirilir. */
function accessibleText(html: string): string {
  const withoutHidden = html.replace(
    /<(svg|span|div)[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g,
    '',
  )
  return withoutHidden
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('SiteBrand (başlıktaki marka bağlantısı, D-086)', () => {
  it('logo işareti ve yazı marka; erişilebilir ad yalnızca yazı, bir kez', () => {
    const html = renderToStaticMarkup(createElement(SiteBrand, { href: '/en', name: 'havayolu' }))
    expect(html).toMatch(/^<a class="brand" href="\/en"><svg [^>]*class="brand-mark"/)
    // İşaret süstür: ekran okuyucudan gizli, odak almaz, ad taşımaz.
    expect(html).toMatch(/<svg [^>]*aria-hidden="true" focusable="false">/)
    expect(html).not.toMatch(/<title|aria-label|role="img"|alt=/)
    expect(html.match(/havayolu/g)).toHaveLength(1)
    expect(accessibleText(html)).toBe('havayolu')
    // Tam işaret (halka ve uçak), renk yazıdan (`currentColor`, şeritte beyaz).
    expect(html).toContain('stroke="currentColor" stroke-width="7"')
    expect(html).toContain('fill="currentColor"><path d="M50 4C')
  })
})

describe('BrandMark', () => {
  it('aynı sayfadaki her işaretin maskesi tekildir ve halka kendi maskesini kullanır', () => {
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(BrandMark),
        createElement(BrandMark, { ring: 'var(--header)', plane: '#0B2A33' }),
      ),
    )
    const ids = [...html.matchAll(/<mask id="([^"]+)"/g)].map((match) => match[1])
    const refs = [...html.matchAll(/mask="url\(#([^)]+)\)"/g)].map((match) => match[1])
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    expect(refs).toEqual(ids)
    // Kimlik CSS ve `url(#…)` içinde kaçış gerektirmez.
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(html).toContain('stroke="var(--header)"')
    expect(html).toContain('fill="#0B2A33"')
  })

  it('küçük işaret maskesizdir', () => {
    const html = renderToStaticMarkup(createElement(BrandMark, { variant: 'small' }))
    expect(html).toContain('<circle cx="50" cy="50" r="48" fill="currentColor"></circle>')
    expect(html).not.toContain('<mask')
  })
})
