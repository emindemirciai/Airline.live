import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config, proxy } from './proxy'

/** Next'in iç adresi (standalone sunucu 0.0.0.0:3000'i dinler); host başlıktan gelir. */
function request(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://0.0.0.0:3000${path}`, {
    headers: { host: 'havayolu.live', ...headers },
  })
}

/** `NextResponse.next/rewrite({ request: { headers } })` ile sayfaya iletilen istek başlığı. */
function forwarded(response: Response, name: string): string | null {
  return response.headers.get(`x-middleware-request-${name}`)
}

beforeEach(() => {
  vi.stubEnv('WEB_HOST', 'havayolu.live')
  vi.stubEnv('ADMIN_HOST', 'admin.havayolu.live')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('proxy — dil yönlendirmesi', () => {
  it('Türkçe yol geçer; dil ve mantıksal yol başlıkları eklenir', () => {
    const response = proxy(request('/istasyon/LTFM?x=1'))
    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(forwarded(response, 'x-hy-locale')).toBe('tr')
    expect(forwarded(response, 'x-hy-path')).toBe('/istasyon/LTFM?x=1')
  })

  it('/en/* öneksiz yola yeniden yazılır, sorgu metni korunur', () => {
    const response = proxy(request('/en/durum?x=1'))
    expect(new URL(response.headers.get('x-middleware-rewrite') ?? '').pathname).toBe('/durum')
    expect(new URL(response.headers.get('x-middleware-rewrite') ?? '').search).toBe('?x=1')
    expect(forwarded(response, 'x-hy-locale')).toBe('en')
    expect(forwarded(response, 'x-hy-path')).toBe('/durum?x=1')

    const home = proxy(request('/en?hex=ff0001'))
    expect(new URL(home.headers.get('x-middleware-rewrite') ?? '').pathname).toBe('/')
    expect(forwarded(home, 'x-hy-path')).toBe('/?hex=ff0001')
  })

  it('istemcinin gönderdiği dil ve yol başlıkları ezilir', () => {
    const response = proxy(request('/durum', { 'x-hy-locale': 'en', 'x-hy-path': '/admin' }))
    expect(forwarded(response, 'x-hy-locale')).toBe('tr')
    expect(forwarded(response, 'x-hy-path')).toBe('/durum')

    const en = proxy(request('/en/durum', { 'x-hy-locale': 'tr', 'x-hy-path': '//evil' }))
    expect(forwarded(en, 'x-hy-locale')).toBe('en')
    expect(forwarded(en, 'x-hy-path')).toBe('/durum')
  })

  it('/tr/* isteğin host’unda mutlak adresle 308 alır', () => {
    const response = proxy(request('/tr/durum?x=1'))
    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('http://havayolu.live/durum?x=1')

    const secure = proxy(
      new NextRequest('https://0.0.0.0:3000/tr', { headers: { host: 'havayolu.live' } }),
    )
    expect(secure.headers.get('location')).toBe('https://havayolu.live/')
  })

  it('geçersiz host başlığında sunucunun kendi adresine yönlendirir', () => {
    const response = proxy(request('/tr/durum', { host: 'evil.example/x' }))
    expect(response.headers.get('location')).toBe('http://0.0.0.0:3000/durum')
  })

  it('öneki ayrılınca // ile başlayan yol site dışına yönlendirilmez ve yeniden yazılmaz', () => {
    for (const path of ['/tr//evil.example', '/tr//evil.example/x', '/en//evil.example']) {
      const response = proxy(request(path))
      expect(response.status, path).toBe(404)
      expect(response.headers.get('location'), path).toBeNull()
      expect(response.headers.get('x-middleware-rewrite'), path).toBeNull()
    }
  })

  it('/en/admin, /en/api ve /en/ + kök dosya 404 alır', () => {
    for (const path of ['/en/admin', '/en/api/version', '/en/robots.txt', '/en/dil']) {
      expect(proxy(request(path)).status, path).toBe(404)
    }
  })

  it('www isteği kök alan adına 308 ile gider (dil öneki korunur)', () => {
    const response = proxy(request('/en/durum?x=1', { host: 'www.havayolu.live' }))
    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('https://havayolu.live/en/durum?x=1')
  })
})

describe('proxy — X-Robots-Tag', () => {
  it("web host'unda /api/* noindex alır, sayfalar almaz", () => {
    expect(proxy(request('/api/version')).headers.get('x-robots-tag')).toBe('noindex')
    expect(proxy(request('/istasyon/LTFM')).headers.get('x-robots-tag')).toBeNull()
  })

  it("admin host'undaki her yanıt noindex, nofollow taşır", () => {
    const admin = { host: 'admin.havayolu.live' }
    const page = proxy(request('/admin', admin))
    expect(page.headers.get('x-middleware-next')).toBe('1')
    expect(forwarded(page, 'x-hy-locale')).toBe('tr')
    expect(page.headers.get('x-robots-tag')).toBe('noindex, nofollow')

    const redirect = proxy(request('/durum', admin))
    expect(redirect.status).toBe(307)
    expect(redirect.headers.get('location')).toBe('https://admin.havayolu.live/admin')
    expect(redirect.headers.get('x-robots-tag')).toBe('noindex, nofollow')

    const robots = proxy(request('/robots.txt', admin))
    expect(robots.headers.get('x-middleware-next')).toBe('1')
    expect(robots.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })

  it("başka host'tan /admin 404 alır", () => {
    expect(proxy(request('/admin')).status).toBe(404)
  })
})

describe('proxy — kök dosyalar', () => {
  const ROOT_FILES = [
    '/robots.txt',
    '/sitemap.xml',
    '/llms.txt',
    '/manifest.webmanifest',
    '/favicon.ico',
    '/icon/192',
    '/apple-icon',
    '/og/site',
  ]

  it('web host’unda dil kararı onları olduğu gibi geçirir, başlık eklenmez', () => {
    for (const path of ROOT_FILES) {
      const response = proxy(request(path))
      expect(response.headers.get('x-middleware-next'), path).toBe('1')
      expect(forwarded(response, 'x-hy-path'), path).toBe(path)
      expect(response.headers.get('x-robots-tag'), path).toBeNull()
    }
  })

  it('www host’unda kök alan adına 308 ile gider', () => {
    for (const path of ['/sitemap.xml', '/llms.txt', '/robots.txt', '/og/site', '/icon/512']) {
      const response = proxy(request(path, { host: 'www.havayolu.live' }))
      expect(response.status, path).toBe(308)
      expect(response.headers.get('location'), path).toBe(`https://havayolu.live${path}`)
    }
  })

  it('admin host’unda site haritası ve llms.txt yönetime yönlenir; hepsi noindex, nofollow', () => {
    const admin = { host: 'admin.havayolu.live' }
    for (const path of ['/sitemap.xml', '/llms.txt', '/og/site']) {
      const response = proxy(request(path, admin))
      expect(response.status, path).toBe(307)
      expect(response.headers.get('location'), path).toBe('https://admin.havayolu.live/admin')
      expect(response.headers.get('x-robots-tag'), path).toBe('noindex, nofollow')
    }
    // Admin sayfalarının kullandığı simgeler, manifest ve siteyi kapatan robots.txt geçer.
    for (const path of [
      '/robots.txt',
      '/favicon.ico',
      '/icon/192',
      '/apple-icon',
      '/manifest.webmanifest',
    ]) {
      const response = proxy(request(path, admin))
      expect(response.headers.get('x-middleware-next'), path).toBe('1')
      expect(response.headers.get('x-robots-tag'), path).toBe('noindex, nofollow')
    }
  })
})

describe('proxy — matcher', () => {
  // Next eşleyicisi path-to-regexp ile derlenir; buradaki desen JS düzenli ifadesi olarak da geçerlidir.
  const [pattern] = config.matcher
  const matches = (path: string) => new RegExp(`^${pattern}$`).test(path)

  it('yalnızca Next’in derlenmiş varlıkları proxy’ye girmez', () => {
    for (const path of ['/_next/static/chunks/a.js', '/_next/image']) {
      expect(matches(path), path).toBe(false)
    }
  })

  it('sayfalar, API, kök dosyalar ve /en/ + kök dosya proxy’den geçer', () => {
    for (const path of [
      '/',
      '/en',
      '/istasyon/LTFM',
      '/en/istasyon/LTFM',
      '/api/version',
      '/dil',
      '/robots.txt',
      '/sitemap.xml',
      '/llms.txt',
      '/manifest.webmanifest',
      '/favicon.ico',
      '/icon/192',
      '/apple-icon',
      '/og/site',
      '/test-style.json',
      '/en/robots.txt',
      '/en/icon/192',
    ]) {
      expect(matches(path), path).toBe(true)
    }
  })
})
