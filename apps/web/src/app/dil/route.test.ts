import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

function location(query: string): string {
  const response = GET(new NextRequest(`http://0.0.0.0:3000/dil${query}`))
  expect(response.status).toBe(308)
  return response.headers.get('location') ?? ''
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /dil', () => {
  it('eski bağlantıyı dil önekli adrese yönlendirir, eski çerezi siler, noindex', () => {
    const response = GET(new NextRequest('http://0.0.0.0:3000/dil?to=en&next=/durum'))
    expect(response.headers.get('location')).toBe('/en/durum')
    expect(response.headers.get('set-cookie')).toMatch(/^lang=; Path=\/; Max-Age=0/)
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
    expect(location('?to=tr&next=/en/durum')).toBe('/durum')
    expect(location(`?to=en&next=${encodeURIComponent('/?hex=4bb26c')}`)).toBe('/en?hex=4bb26c')
  })

  it('önek ayrılınca site dışına çıkan hedefler kök sayfaya döner (açık yönlendirme yok)', () => {
    const cases: [string, string][] = [
      ['?next=/en//evil.example', '/'],
      ['?to=tr&next=/en//evil.example', '/'],
      ['?to=en&next=/en//evil.example', '/en'],
      ['?to=tr&next=/tr//evil.example', '/'],
      ['?to=en&next=/tr//evil.example/x', '/en'],
      ['?next=%2Fen%2F%2Fevil.example%2Fx', '/'],
      ['?to=en&next=%2Ftr%2F%2Fevil.example', '/en'],
      ['?next=/en/%5Cevil.example', '/'],
      ['?next=%2Fen%2F%5C%5Cevil.example', '/'],
      ['?next=/en/%09/evil.example', '/'],
      ['?next=//evil.example', '/'],
      ['?to=en&next=https://evil.example/', '/en'],
    ]
    for (const [query, expected] of cases) {
      const target = location(query)
      expect(target, query).toBe(expected)
      // Tarayıcı `//host` ve `/\host` biçimini şemasız dış adres sayar.
      expect(target, query).toMatch(/^\/(?![/\\])/)
      expect(new URL(target, 'https://airline.live').host, query).toBe('airline.live')
    }
  })

  it('Türkçe ve diğer ASCII dışı karakterli hedef yüzde kodlanır (500 yerine 308)', () => {
    expect(location('?to=en&next=/%C5%9F')).toBe('/en/%C5%9F')
    expect(location(`?next=${encodeURIComponent('/istasyon/LTFM?q=ığ')}`)).toBe(
      '/istasyon/LTFM?q=%C4%B1%C4%9F',
    )
    // Tam genişlikli bölü (U+FF0F) kodlanır; adres site içinde kalır.
    const target = location('?next=/%EF%BC%8Fevil.example')
    expect(new URL(target, 'https://airline.live').host).toBe('airline.live')
  })

  it('iki kez kodlanmış bölü işareti site içinde kalır', () => {
    const target = location('?next=/en/%252F%252Fevil.example')
    expect(new URL(target, 'https://airline.live').host).toBe('airline.live')
  })

  it('üretimde silinen çerez Secure taşır', () => {
    vi.stubEnv('APP_ENV', 'production')
    const response = GET(new NextRequest('http://0.0.0.0:3000/dil?to=en&next=/'))
    expect(response.headers.get('set-cookie')).toContain('; Secure')
  })
})
