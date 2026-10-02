import { readFileSync } from 'node:fs'
import { getMessages } from '@havayolu/i18n'
import { ERROR_PAGE_MESSAGES } from '@havayolu/i18n/error-page'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ErrorPage from './error'
import GlobalError from './global-error'

const retry = () => undefined
const error = Object.assign(new Error('sunucu hatası'), { digest: '123' })

describe('hata sayfaları (error.tsx, global-error.tsx)', () => {
  it('sitenin sayfası olarak iki dilde çizilir; her blok kendi dilini taşır', () => {
    const html = renderToStaticMarkup(createElement(ErrorPage, { error, retry }))
    expect(html).toMatch(/^<article class="page error-page">/)
    for (const locale of ['tr', 'en'] as const) {
      const t = ERROR_PAGE_MESSAGES[locale]
      const block = html.slice(html.indexOf(`<div lang="${locale}"`))
      expect(block, locale).toMatch(
        new RegExp(`^<div lang="${locale}" class="error-page__copy"><h1>${t.title}</h1>`),
      )
      expect(block, locale).toContain(`<p class="lead">${t.body}</p>`)
      expect(block, locale).toContain(`<button type="button" class="button">${t.retry}</button>`)
    }
    expect(html).toContain('<a href="/" class="try-link">Haritaya dön →</a>')
    expect(html).toContain('<a href="/en" class="try-link">Back to the map →</a>')
    // Next'in yerleşik İngilizce sayfasının metni ve hata ayrıntısı gösterilmez.
    expect(html).not.toMatch(/couldn['’]t load|sunucu hatası|123/)
  })

  it('metinler i18n kataloğundadır (TR ve EN aynı anahtarlar)', () => {
    expect(getMessages('tr').errors.page).toEqual(ERROR_PAGE_MESSAGES.tr)
    expect(getMessages('en').errors.page).toEqual(ERROR_PAGE_MESSAGES.en)
    expect(Object.keys(ERROR_PAGE_MESSAGES.en)).toEqual(Object.keys(ERROR_PAGE_MESSAGES.tr))
  })

  it('kök düzen hatasında kendi belgesini sitenin stiliyle çizer; sunucuda Türkçe', () => {
    const html = renderToStaticMarkup(createElement(GlobalError, { error, retry }))
    expect(html).toMatch(/^<html lang="tr"><head><title>Bir sorun çıktı<\/title><\/head><body>/)
    expect(html).toContain('<main class="site-main"><article class="page error-page">')
    const source = readFileSync(new URL('./global-error.tsx', import.meta.url), 'utf8')
    expect(source).toContain("import './globals.css'")
  })

  it('stil: <html lang> dışındaki dil gizlenir; işletim sisteminin koyu tercihi rengi değiştirmez', () => {
    const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8')
    expect(css).toMatch(
      /html:not\(\[lang='en'\]\) \.error-page__copy\[lang='en'\],\s*html\[lang='en'\] \.error-page__copy:not\(\[lang='en'\]\) \{\s*display: none;/,
    )
    expect(css).toContain('color-scheme: light')
    expect(css).not.toContain('prefers-color-scheme: dark')
  })
})
