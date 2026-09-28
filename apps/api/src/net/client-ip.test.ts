import type { Redis } from 'ioredis'
import { afterEach, describe, expect, it } from 'vitest'
import { LIVE_RATE_LIMIT, SEARCH_RATE_LIMIT } from '../live/routes'
import {
  ADMIN_EMAIL,
  FakeLiveSource,
  publicAircraft,
  testAirlineCodes,
  testApp,
} from '../test/helpers'
import { isCidr, isCloudflareAddress } from './client-ip'

type App = Awaited<ReturnType<typeof testApp>>['app']
const apps: App[] = []
async function freshApp(...args: Parameters<typeof testApp>) {
  const result = await testApp(...args)
  apps.push(result.app)
  return result.app
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

/** Yanlış bilgiyle bir giriş denemesi; durum kodunu döndürür. */
async function attempt(app: App, remoteAddress: string, headers: Record<string, string> = {}) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    remoteAddress,
    headers,
    payload: { email: ADMIN_EMAIL, password: 'yanlis-anahtar' },
  })
  return res.statusCode
}

describe('isCidr', () => {
  it('IPv4/IPv6 adres ve ağlarını kabul eder, bozuk değerleri reddeder', () => {
    for (const ok of ['10.0.0.0/8', '172.16.0.0/12', '192.168.1.5', 'fc00::/7', '::1']) {
      expect(isCidr(ok), ok).toBe(true)
    }
    for (const bad of [
      '10.0.0.0/33',
      'fc00::/129',
      '0.0.0.0/0',
      '::/0',
      'traefik',
      '10.0.0.0/8/1',
      '10.0.0.0/',
      '',
    ]) {
      expect(isCidr(bad), bad).toBe(false)
    }
  })
})

describe('isCloudflareAddress', () => {
  it('Cloudflare ağlarını tanır (IPv4, IPv6 ve IPv4-mapped IPv6), diğerlerini tanımaz', () => {
    expect(isCloudflareAddress('173.245.48.1')).toBe(true)
    expect(isCloudflareAddress('::ffff:104.16.0.1')).toBe(true)
    expect(isCloudflareAddress('2606:4700::1')).toBe(true)
    expect(isCloudflareAddress('203.0.113.9')).toBe(false)
    expect(isCloudflareAddress('10.0.0.5')).toBe(false)
    expect(isCloudflareAddress('uydurma')).toBe(false)
  })
})

describe('hız sınırı istemci başına tutulur', () => {
  const trusted = { TRUSTED_PROXY_CIDRS: '10.0.0.0/8' }

  it('güvenilen proxy (Traefik ya da web) arkasındaki farklı istemciler ayrı sayaca düşer', async () => {
    const app = await freshApp({ env: trusted })
    const first: number[] = []
    for (let i = 0; i < 6; i++) {
      first.push(await attempt(app, '10.0.0.5', { 'x-forwarded-for': '203.0.113.1' }))
    }
    expect(first).toEqual([401, 401, 401, 401, 401, 429])
    // Aynı web konteynerinden gelen başka bir ziyaretçi kilitlenmez.
    expect(await attempt(app, '10.0.0.5', { 'x-forwarded-for': '203.0.113.2' })).toBe(401)
  })

  it('istemcinin uydurduğu X-Forwarded-For girdisi sınırı aşmaya yetmez', async () => {
    const app = await freshApp({ env: trusted })
    const codes: number[] = []
    for (let i = 0; i < 6; i++) {
      // Traefik, istemcinin gönderdiği değerin sonuna gerçek adresi ekler.
      codes.push(
        await attempt(app, '10.0.0.5', { 'x-forwarded-for': `198.51.100.${i}, 203.0.113.7` }),
      )
    }
    expect(codes.at(-1)).toBe(429)
  })

  it('aynı IPv6 /64 bloğundaki adresler tek ziyaretçi sayılır', async () => {
    const app = await freshApp({ env: trusted })
    const codes: number[] = []
    for (let i = 1; i <= 6; i++) {
      codes.push(await attempt(app, '10.0.0.5', { 'x-forwarded-for': `2001:db8:1:2::${i}` }))
    }
    expect(codes).toEqual([401, 401, 401, 401, 401, 429])
    // Başka bir /64 bloğu ayrı sayaçtır.
    expect(await attempt(app, '10.0.0.5', { 'x-forwarded-for': '2001:db8:1:3::1' })).toBe(401)
  })

  it('güvenilmeyen bir adresten gelen X-Forwarded-For yok sayılır', async () => {
    const app = await freshApp({ env: trusted })
    const codes: number[] = []
    for (let i = 0; i < 6; i++) {
      codes.push(await attempt(app, '198.51.100.7', { 'x-forwarded-for': `203.0.113.${i}` }))
    }
    expect(codes.at(-1)).toBe(429)
  })

  it('CF-Connecting-IP yalnızca istek bir Cloudflare adresinden geldiyse kullanılır', async () => {
    const app = await freshApp({ env: { ...trusted, EDGE_PROXY: 'cloudflare' } })
    // Sunucuya doğrudan gelen biri (Cloudflare değil) başlığı her seferinde değiştirse de tek sayaç.
    const spoofed: number[] = []
    for (let i = 0; i < 6; i++) {
      spoofed.push(
        await attempt(app, '10.0.0.5', {
          'x-forwarded-for': '203.0.113.50',
          'cf-connecting-ip': `198.51.100.${i}`,
        }),
      )
    }
    expect(spoofed.at(-1)).toBe(429)

    // Cloudflare kenarından gelen iki ziyaretçi ayrı sayaçlara düşer.
    const viaEdge = (client: string) =>
      attempt(app, '10.0.0.5', { 'x-forwarded-for': '173.245.48.9', 'cf-connecting-ip': client })
    for (let i = 0; i < 5; i++) expect(await viaEdge('203.0.113.60')).toBe(401)
    expect(await viaEdge('203.0.113.60')).toBe(429)
    expect(await viaEdge('203.0.113.61')).toBe(401)
  })
})

describe('canlı uçların (/v1/live, /v1/search) hız sınırı istemci başına', () => {
  const trusted = { TRUSTED_PROXY_CIDRS: '10.0.0.0/8' }
  const routes = [
    { url: '/v1/live?bbox=28,40,29,41', max: LIVE_RATE_LIMIT.max },
    { url: '/v1/search?q=THY974', max: SEARCH_RATE_LIMIT.max },
  ]
  const liveApp = () =>
    freshApp({
      env: trusted,
      deps: { live: { source: new FakeLiveSource([publicAircraft()]), codes: testAirlineCodes } },
    })

  /** Aynı istemciden `count` istek; durum kodlarını döndürür. */
  async function burst(
    app: App,
    url: string,
    count: number,
    remoteAddress: string,
    xff: (i: number) => string,
  ) {
    const codes: number[] = []
    for (let i = 0; i < count; i++) {
      const res = await app.inject({
        method: 'GET',
        url,
        remoteAddress,
        headers: { 'x-forwarded-for': xff(i) },
      })
      codes.push(res.statusCode)
    }
    return codes
  }

  for (const { url, max } of routes) {
    it(`${url.split('?')[0]}: farklı X-Forwarded-For ayrı sayaca düşer (${max}/dk)`, async () => {
      const app = await liveApp()
      const first = await burst(app, url, max + 1, '10.0.0.5', () => '203.0.113.1')
      expect(first.slice(0, max).every((code) => code === 200)).toBe(true)
      expect(first.at(-1)).toBe(429)
      // Aynı proxy arkasındaki başka bir ziyaretçi kilitlenmez.
      expect(await burst(app, url, 1, '10.0.0.5', () => '203.0.113.2')).toEqual([200])
    })

    it(`${url.split('?')[0]}: güvenilmeyen adresten gelen X-Forwarded-For yok sayılır`, async () => {
      const app = await liveApp()
      const codes = await burst(app, url, max + 1, '198.51.100.7', (i) => `203.0.113.${i % 250}`)
      expect(codes.at(-1)).toBe(429)
    })
  }
})

describe('sistem uçları ve sayaç deposu', () => {
  it('/health, /version ve /openapi.json hız sınırına girmez; /ready girer', async () => {
    const app = await freshApp()
    for (const url of ['/health', '/version', '/openapi.json']) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.headers['x-ratelimit-limit'], url).toBeUndefined()
    }
    const ready = await app.inject({ method: 'GET', url: '/ready' })
    expect(ready.headers['x-ratelimit-limit']).toBe('300')
  })

  it('sayaç deposu (Redis) hata verirse istekler reddedilmez', async () => {
    const fail = (...args: unknown[]) => {
      const callback = args.at(-1) as (error: Error) => void
      callback(new Error('Connection is closed.'))
    }
    const brokenRedis = {
      defineCommand: () => undefined,
      rateLimit: fail,
      rateLimitRead: fail,
    } as unknown as Redis
    const app = await freshApp({ deps: { rateLimitRedis: brokenRedis } })
    expect((await app.inject({ method: 'GET', url: '/ready' })).statusCode).toBe(200)
    expect(await attempt(app, '203.0.113.1')).toBe(401)
  })
})
