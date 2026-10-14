import { getMessages } from '@havayolu/i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  absoluteUrl,
  DEV_SITE_URL,
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
  OG_SITE_IMAGE,
  pageMetadata,
  siteOgImagePath,
  siteUrl,
  siteUrlFrom,
} from './metadata'
import { siteOgContent, siteOgVersion } from './og-site-content'

vi.mock('server-only', () => ({}))

beforeEach(() => {
  vi.stubEnv('APP_ENV', 'test')
  vi.stubEnv('APP_NAME', 'havayolu')
  vi.stubEnv('WEB_HOST', 'airline.live')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('siteUrlFrom / siteUrl', () => {
  it('genel host https, yerel host http ile kök adres olur', () => {
    expect(siteUrlFrom('airline.live').toString()).toBe('https://airline.live/')
    expect(siteUrlFrom(' AirLine.Live ').toString()).toBe('https://airline.live/')
    expect(siteUrlFrom('localhost:3100').toString()).toBe('http://localhost:3100/')
    expect(siteUrlFrom('127.0.0.1:3100').toString()).toBe('http://127.0.0.1:3100/')
    expect(siteUrlFrom('[::1]:3100').toString()).toBe('http://[::1]:3100/')
    expect(siteUrlFrom('web.localhost').toString()).toBe('http://web.localhost/')
    // "localhost" ile başlayan genel bir alan adı yerel sayılmaz.
    expect(siteUrlFrom('localhost.example.com').toString()).toBe('https://localhost.example.com/')
  })

  it('WEB_HOST yoksa yerel geliştirme adresi', () => {
    expect(siteUrlFrom(undefined).toString()).toBe(`${DEV_SITE_URL}/`)
    expect(siteUrlFrom('  ').toString()).toBe(`${DEV_SITE_URL}/`)
    vi.stubEnv('WEB_HOST', '')
    expect(siteUrl().toString()).toBe(`${DEV_SITE_URL}/`)
  })

  it('siteUrl çalışma zamanında WEB_HOST okur; absoluteUrl yolu ona ekler', () => {
    expect(siteUrl().toString()).toBe('https://airline.live/')
    expect(absoluteUrl('/istasyon/LTFM')).toBe('https://airline.live/istasyon/LTFM')
    expect(absoluteUrl('/en')).toBe('https://airline.live/en')
    vi.stubEnv('WEB_HOST', 'staging.airline.live')
    expect(absoluteUrl('/')).toBe('https://staging.airline.live/')
  })
})

describe('pageMetadata', () => {
  it('Türkçe sayfa: kanonik kendisi, tr + en + x-default (= en) karşılıkları', () => {
    const m = pageMetadata({
      locale: 'tr',
      path: '/havalimanlari',
      title: 'Havalimanları',
      description: 'Açıklama',
    })
    expect(m.title).toBe('Havalimanları')
    expect(m.description).toBe('Açıklama')
    expect(m.alternates).toEqual({
      canonical: '/havalimanlari',
      languages: {
        tr: '/havalimanlari',
        en: '/en/havalimanlari',
        'x-default': '/en/havalimanlari',
      },
    })
    expect(m.robots).toEqual(INDEX_ROBOTS)
  })

  it('İngilizce kök sayfa: kanonik /en, mutlak başlık, og:locale en_US', () => {
    const m = pageMetadata({
      locale: 'en',
      path: '/',
      title: 'Live flight tracker · havayolu',
      description: 'Description',
      absoluteTitle: true,
    })
    expect(m.title).toEqual({ absolute: 'Live flight tracker · havayolu' })
    expect(m.alternates).toEqual({
      canonical: '/en',
      languages: { tr: '/', en: '/en', 'x-default': '/en' },
    })
    expect(m.openGraph).toMatchObject({
      type: 'website',
      siteName: 'havayolu',
      url: '/en',
      locale: 'en_US',
      alternateLocale: ['tr_TR'],
      title: 'Live flight tracker · havayolu',
      description: 'Description',
    })
  })

  it('varsayılan paylaşım görseli açıkça eklenir (sayfa openGraph üst düzenin görselini düşürür)', () => {
    const m = pageMetadata({ locale: 'tr', path: '/hakkinda', title: 'Hakkında', description: 'x' })
    expect(m.openGraph).toMatchObject({
      locale: 'tr_TR',
      alternateLocale: ['en_US'],
      images: [
        {
          url: expect.stringMatching(/^\/og\/site\?v=[0-9a-f]{8}$/),
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: `havayolu · ${getMessages('tr').seo.ogTagline}`,
        },
      ],
    })
  })

  it('paylaşım görselinin adresi içerikten sürümlüdür; rotanın içeriğiyle aynı (D-106)', () => {
    const m = pageMetadata({ locale: 'en', path: '/', title: 'x', description: 'x' })
    const images = m.openGraph?.images
    const url = Array.isArray(images) && typeof images[0] === 'object' ? images[0] : undefined
    const expected = `${OG_SITE_IMAGE.path}?v=${siteOgVersion(siteOgContent('havayolu', 'airline.live'))}`
    expect(url).toMatchObject({ url: expected })
    expect(siteOgImagePath('havayolu', 'airline.live')).toBe(expected)
    // İki dil aynı görseli kullanır.
    expect(
      pageMetadata({ locale: 'tr', path: '/', title: 'x', description: 'x' }).openGraph,
    ).toMatchObject({ images: [{ url: expected }] })
    // Ad ya da alan adı değişince adres değişir; WEB_HOST yoksa alan adı yazılmaz.
    expect(siteOgImagePath('başka', 'airline.live')).not.toBe(expected)
    expect(siteOgImagePath('havayolu', 'staging.airline.live')).not.toBe(expected)
    expect(siteOgImagePath('havayolu', undefined)).toBe(
      `${OG_SITE_IMAGE.path}?v=${siteOgVersion(siteOgContent('havayolu', null))}`,
    )
  })

  it("ogImage 'segment': images anahtarı hiç yazılmaz, klasördeki opengraph-image kullanılır", () => {
    const m = pageMetadata({
      locale: 'tr',
      path: '/istasyon/LTFM',
      title: 'İstanbul Havalimanı',
      description: 'x',
      ogImage: 'segment',
    })
    // Next yalnızca `images` anahtarı yoksa dosya tabanlı görseli ekler (hasOwnProperty).
    expect(Object.hasOwn(m.openGraph ?? {}, 'images')).toBe(false)
  })

  it('index: false → noindex, follow', () => {
    const m = pageMetadata({
      locale: 'tr',
      path: '/durum',
      title: 'Durum',
      description: 'x',
      index: false,
    })
    expect(m.robots).toEqual(NOINDEX_ROBOTS)
    expect(NOINDEX_ROBOTS).toEqual({ index: false, follow: true })
  })

  it('dizine eklenen sayfaların robots değeri önizleme yönergelerini de taşır', () => {
    expect(INDEX_ROBOTS).toEqual({
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    })
  })

  it('APP_NAME site adını değiştirir', () => {
    vi.stubEnv('APP_NAME', 'deneme')
    const m = pageMetadata({ locale: 'tr', path: '/', title: 't', description: 'd' })
    expect(m.openGraph).toMatchObject({ siteName: 'deneme' })
  })
})
