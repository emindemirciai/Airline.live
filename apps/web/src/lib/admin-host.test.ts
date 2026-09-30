import { describe, expect, it } from 'vitest'
import { adminRouting, canonicalHostRedirect, isAdminHost, robotsTagFor } from './admin-host'

describe('adminRouting', () => {
  it('ADMIN_HOST yoksa her şey geçer (yerel geliştirme)', () => {
    expect(adminRouting(undefined, 'localhost:3100', '/admin')).toEqual({ action: 'next' })
    expect(adminRouting('', 'localhost:3100', '/durum')).toEqual({ action: 'next' })
  })

  it("admin host'unda /admin dışı sayfalar /admin'e yönlenir; API ve varlıklar geçer", () => {
    const host = 'admin.havayolu.live'
    expect(adminRouting(host, host, '/')).toEqual({
      action: 'redirect',
      location: 'https://admin.havayolu.live/admin',
    })
    expect(adminRouting(host, 'ADMIN.havayolu.live', '/durum')).toEqual({
      action: 'redirect',
      location: 'https://admin.havayolu.live/admin',
    })
    expect(adminRouting(host, host, '/admin/giris')).toEqual({ action: 'next' })
    expect(adminRouting(host, host, '/api/version')).toEqual({ action: 'next' })
    expect(adminRouting(host, host, '/_next/data/x.json')).toEqual({ action: 'next' })
  })

  it("admin host'unda dil değiştirme (/dil) çalışır, benzer yollar yönlenir", () => {
    const host = 'admin.havayolu.live'
    expect(adminRouting(host, host, '/dil')).toEqual({ action: 'next' })
    expect(adminRouting(host, host, '/dilek')).toEqual({
      action: 'redirect',
      location: 'https://admin.havayolu.live/admin',
    })
  })

  it("admin host'unda /robots.txt geçer (tüm siteyi kapatan kurallar oradan okunur)", () => {
    const host = 'admin.havayolu.live'
    expect(adminRouting(host, host, '/robots.txt')).toEqual({ action: 'next' })
    expect(adminRouting(host, host, '/robots.txt.bak')).toEqual({
      action: 'redirect',
      location: 'https://admin.havayolu.live/admin',
    })
    expect(adminRouting(host, host, '/en')).toEqual({
      action: 'redirect',
      location: 'https://admin.havayolu.live/admin',
    })
  })

  it("admin host'unda simgeler ve manifest geçer; site haritası, llms.txt ve OG görseli yönlenir", () => {
    const host = 'admin.havayolu.live'
    for (const path of ['/favicon.ico', '/icon/192', '/apple-icon', '/manifest.webmanifest']) {
      expect(adminRouting(host, host, path), path).toEqual({ action: 'next' })
    }
    for (const path of ['/sitemap.xml', '/llms.txt', '/og/site', '/iconx', '/apple-icon-x']) {
      expect(adminRouting(host, host, path), path).toEqual({
        action: 'redirect',
        location: 'https://admin.havayolu.live/admin',
      })
    }
  })

  it("başka host'tan /admin 404 alır, diğer sayfalar geçer", () => {
    const host = 'admin.havayolu.live'
    expect(adminRouting(host, 'havayolu.live', '/admin')).toEqual({ action: 'not_found' })
    expect(adminRouting(host, 'havayolu.live', '/admin/giris')).toEqual({ action: 'not_found' })
    expect(adminRouting(host, 'havayolu.live', '/administrator')).toEqual({ action: 'next' })
    expect(adminRouting(host, 'havayolu.live', '/durum')).toEqual({ action: 'next' })
  })
})

describe('isAdminHost', () => {
  it('büyük-küçük harf ve boşluk farkını yok sayar; ADMIN_HOST yoksa false', () => {
    expect(isAdminHost('admin.havayolu.live', ' ADMIN.havayolu.live ')).toBe(true)
    expect(isAdminHost('admin.havayolu.live', 'havayolu.live')).toBe(false)
    expect(isAdminHost('admin.havayolu.live', null)).toBe(false)
    expect(isAdminHost(undefined, 'admin.havayolu.live')).toBe(false)
    expect(isAdminHost('', '')).toBe(false)
  })
})

describe('robotsTagFor', () => {
  const admin = 'admin.havayolu.live'

  it("admin host'undaki her yanıt noindex, nofollow taşır", () => {
    for (const path of ['/admin', '/admin/giris', '/api/version', '/robots.txt', '/dil', '/']) {
      expect(robotsTagFor(admin, admin, path), path).toBe('noindex, nofollow')
    }
  })

  it("web host'unda yalnızca /api/* noindex alır", () => {
    expect(robotsTagFor(admin, 'havayolu.live', '/api/version')).toBe('noindex')
    expect(robotsTagFor(undefined, 'localhost:3100', '/api/version')).toBe('noindex')
    expect(robotsTagFor(admin, 'havayolu.live', '/')).toBeNull()
    expect(robotsTagFor(admin, 'havayolu.live', '/istasyon/LTFM')).toBeNull()
    expect(robotsTagFor(undefined, 'localhost:3100', '/apiary')).toBeNull()
  })
})

describe('canonicalHostRedirect', () => {
  it('www isteğini yol ve sorguyu koruyarak kök alan adına yönlendirir', () => {
    expect(canonicalHostRedirect('havayolu.live', 'www.havayolu.live', '/durum?x=1')).toBe(
      'https://havayolu.live/durum?x=1',
    )
    expect(canonicalHostRedirect('havayolu.live', 'WWW.havayolu.live', '/')).toBe(
      'https://havayolu.live/',
    )
  })

  it("kök alan adında, başka host'ta ya da WEB_HOST yokken yönlendirmez", () => {
    expect(canonicalHostRedirect('havayolu.live', 'havayolu.live', '/')).toBeNull()
    expect(canonicalHostRedirect('havayolu.live', 'admin.havayolu.live', '/')).toBeNull()
    expect(canonicalHostRedirect(undefined, 'www.havayolu.live', '/')).toBeNull()
  })
})
