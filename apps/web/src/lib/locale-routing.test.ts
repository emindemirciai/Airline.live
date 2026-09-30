import { describe, expect, it } from 'vitest'
import {
  alternatesFor,
  LOCALE_HEADER,
  localePath,
  localeRouting,
  PATH_HEADER,
  stripLocale,
} from './locale-routing'

describe('localePath', () => {
  it('Türkçe yol öneksizdir', () => {
    expect(localePath('tr', '/')).toBe('/')
    expect(localePath('tr', '/durum')).toBe('/durum')
    expect(localePath('tr', '/?hex=ff0001')).toBe('/?hex=ff0001')
  })

  it('İngilizce yol /en önekini alır; kök /en olur', () => {
    expect(localePath('en', '/')).toBe('/en')
    expect(localePath('en', '/durum')).toBe('/en/durum')
    expect(localePath('en', '/istasyon/LTFM')).toBe('/en/istasyon/LTFM')
  })

  it('sorgu metnini ve # kısmını korur', () => {
    expect(localePath('en', '/?hex=ff0001')).toBe('/en?hex=ff0001')
    expect(localePath('en', '/?havalimani=LTFM#x')).toBe('/en?havalimani=LTFM#x')
    expect(localePath('en', '/yenilikler#v0.9.0')).toBe('/en/yenilikler#v0.9.0')
    expect(localePath('en', '/durum?x=1')).toBe('/en/durum?x=1')
  })
})

describe('stripLocale', () => {
  it('/en önekini ayırır', () => {
    expect(stripLocale('/en')).toEqual({ locale: 'en', path: '/' })
    expect(stripLocale('/en/')).toEqual({ locale: 'en', path: '/' })
    expect(stripLocale('/en/durum')).toEqual({ locale: 'en', path: '/durum' })
    expect(stripLocale('/en?hex=ff0001')).toEqual({ locale: 'en', path: '/?hex=ff0001' })
    expect(stripLocale('/en/istasyon/LTFM?x=1#a')).toEqual({
      locale: 'en',
      path: '/istasyon/LTFM?x=1#a',
    })
  })

  it('/tr önekini de tanır; öneksiz yol Türkçedir', () => {
    expect(stripLocale('/tr/durum')).toEqual({ locale: 'tr', path: '/durum' })
    expect(stripLocale('/tr')).toEqual({ locale: 'tr', path: '/' })
    expect(stripLocale('/durum?x=1')).toEqual({ locale: 'tr', path: '/durum?x=1' })
    expect(stripLocale('/')).toEqual({ locale: 'tr', path: '/' })
  })

  it('benzer yolları önek saymaz', () => {
    expect(stripLocale('/english')).toEqual({ locale: 'tr', path: '/english' })
    expect(stripLocale('/trabzon')).toEqual({ locale: 'tr', path: '/trabzon' })
    expect(stripLocale('/durum/en')).toEqual({ locale: 'tr', path: '/durum/en' })
  })

  it('localePath ile gidiş-dönüş aynı mantıksal yolu verir', () => {
    for (const path of ['/', '/durum', '/?hex=ff0001', '/istasyon/LTFM?x=1']) {
      for (const locale of ['tr', 'en'] as const) {
        expect(stripLocale(localePath(locale, path))).toEqual({ locale, path })
      }
    }
  })
})

describe('alternatesFor', () => {
  it('kanonik adres sayfanın kendi dilidir; tr, en ve x-default (İngilizce) listelenir', () => {
    expect(alternatesFor('tr', '/istasyon/LTFM')).toEqual({
      canonical: '/istasyon/LTFM',
      languages: {
        tr: '/istasyon/LTFM',
        en: '/en/istasyon/LTFM',
        'x-default': '/en/istasyon/LTFM',
      },
    })
    expect(alternatesFor('en', '/')).toEqual({
      canonical: '/en',
      languages: { tr: '/', en: '/en', 'x-default': '/en' },
    })
  })

  it('her dil sürümünün kanonik adresi dil listesinde de yer alır (kendine başvuru)', () => {
    for (const locale of ['tr', 'en'] as const) {
      const { canonical, languages } = alternatesFor(locale, '/havalimanlari')
      expect(languages[locale]).toBe(canonical)
    }
  })
})

describe('localeRouting', () => {
  it('başlık adları sabittir', () => {
    expect(LOCALE_HEADER).toBe('x-hy-locale')
    expect(PATH_HEADER).toBe('x-hy-path')
  })

  it('/en ve /en/* öneksiz yola yeniden yazılır', () => {
    expect(localeRouting('/en')).toEqual({ kind: 'rewrite', locale: 'en', path: '/' })
    expect(localeRouting('/en/durum')).toEqual({ kind: 'rewrite', locale: 'en', path: '/durum' })
    expect(localeRouting('/en/istasyon/LTFM')).toEqual({
      kind: 'rewrite',
      locale: 'en',
      path: '/istasyon/LTFM',
    })
    expect(localeRouting('/en/istasyon/LTFM/opengraph-image')).toEqual({
      kind: 'rewrite',
      locale: 'en',
      path: '/istasyon/LTFM/opengraph-image',
    })
  })

  it("/en/ sondaki eğik çizgisiz /en'e yönlenir", () => {
    expect(localeRouting('/en/')).toEqual({ kind: 'redirect', to: '/en' })
  })

  it('öneksiz yollar Türkçe olarak geçer; /english önek değildir', () => {
    expect(localeRouting('/')).toEqual({ kind: 'next', locale: 'tr', path: '/' })
    expect(localeRouting('/durum')).toEqual({ kind: 'next', locale: 'tr', path: '/durum' })
    expect(localeRouting('/english')).toEqual({ kind: 'next', locale: 'tr', path: '/english' })
    expect(localeRouting('/enx/durum')).toEqual({ kind: 'next', locale: 'tr', path: '/enx/durum' })
    expect(localeRouting('/admin')).toEqual({ kind: 'next', locale: 'tr', path: '/admin' })
    expect(localeRouting('/api/version')).toEqual({
      kind: 'next',
      locale: 'tr',
      path: '/api/version',
    })
  })

  it('/tr ve /tr/* öneksiz yola yönlenir', () => {
    expect(localeRouting('/tr')).toEqual({ kind: 'redirect', to: '/' })
    expect(localeRouting('/tr/')).toEqual({ kind: 'redirect', to: '/' })
    expect(localeRouting('/tr/durum')).toEqual({ kind: 'redirect', to: '/durum' })
    expect(localeRouting('/tr/istasyon/LTFM')).toEqual({
      kind: 'redirect',
      to: '/istasyon/LTFM',
    })
    expect(localeRouting('/trabzon')).toEqual({ kind: 'next', locale: 'tr', path: '/trabzon' })
  })

  it('öneki ayrılınca // ile başlayan yol yönlendirilmez ve yeniden yazılmaz (404)', () => {
    for (const path of [
      '/tr//evil.example',
      '/tr//evil.example/x',
      '/en//evil.example',
      '/en///x',
    ]) {
      expect(localeRouting(path), path).toEqual({ kind: 'not_found' })
    }
  })

  it('yönetim, API, /dil, kök dosyalar ve iç içe önekler /en altında 404 alır', () => {
    for (const path of [
      '/en/admin',
      '/en/admin/giris',
      '/en/api/version',
      '/en/dil',
      '/en/robots.txt',
      '/en/sitemap.xml',
      '/en/llms.txt',
      '/en/manifest.webmanifest',
      '/en/favicon.ico',
      '/en/icon',
      '/en/icon/192',
      '/en/apple-icon',
      '/en/og/site',
      '/en/test-style.json',
      '/en/_next/static/x.js',
      '/en/en',
      '/en/en/durum',
      '/en/tr/durum',
    ]) {
      expect(localeRouting(path), path).toEqual({ kind: 'not_found' })
    }
  })

  it('benzer adlı sayfalar /en altında geçer', () => {
    expect(localeRouting('/en/administrator')).toEqual({
      kind: 'rewrite',
      locale: 'en',
      path: '/administrator',
    })
    expect(localeRouting('/en/dilek')).toEqual({ kind: 'rewrite', locale: 'en', path: '/dilek' })
  })
})
