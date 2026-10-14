import { brotliDecompressSync, gunzipSync, gzipSync } from 'node:zlib'
import { CHANGELOG } from '@havayolu/shared'
import { afterAll, describe, expect, it } from 'vitest'
import { allowedOrigins, API_ROBOTS_TAG, API_ROBOTS_TXT } from './app'
import { EnvError, parseEnv } from './env'
import { testApp, testEnv } from './test/helpers'

const { app } = await testApp()
afterAll(() => app.close())

describe('sistem uç noktaları', () => {
  it('/health 200 ve ok döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })

  it('/version changelog sürümünü ve GIT_SHA değerini döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/version' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      app: 'Airline.live',
      version: CHANGELOG[0]?.version,
      gitSha: 'abc1234',
      env: 'test',
    })
  })

  it('güvenlik başlıklarını ekler', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['strict-transport-security']).toBeDefined()
  })

  it('/ready bütün bağımlılıklar yanıt verince 200, biri düşünce 503 döner', async () => {
    const ok = await app.inject({ method: 'GET', url: '/ready' })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toMatchObject({ status: 'ready' })

    const { app: broken } = await testApp({
      deps: {
        readiness: {
          postgres: async () => 1,
          redisQueue: () => Promise.reject(new Error('bağlantı reddedildi')),
          redisLive: null,
        },
      },
    })
    const res = await broken.inject({ method: 'GET', url: '/ready' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({
      status: 'not_ready',
      checks: {
        postgres: { ok: true },
        redisQueue: { ok: false, error: 'erişilemiyor' },
        redisLive: { ok: false, error: 'yapılandırılmamış' },
      },
    })
    // Sürücü hata metni (iç adres, kullanıcı adı) herkese açık yanıtta yer almaz.
    expect(res.body).not.toContain('bağlantı reddedildi')
    await broken.close()
  })

  it('/openapi.json auth, admin ve canlı uç noktalarını içerir', async () => {
    const res = await app.inject({ method: 'GET', url: '/openapi.json' })
    expect(res.statusCode).toBe(200)
    const spec = res.json() as {
      openapi: string
      paths: Record<string, Record<string, { tags?: string[] }>>
    }
    expect(spec.openapi).toMatch(/^3\./)
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        '/api/auth/login',
        '/api/admin/session',
        '/v1/admin/services',
        '/v1/admin/blocklist',
        '/v1/live',
        '/v1/search',
        '/v1/airports',
      ]),
    )
    expect(spec.paths['/v1/live']?.get?.tags).toEqual(['live'])
    expect(spec.paths['/v1/search']?.get?.tags).toEqual(['live'])
    expect(spec.paths['/v1/airports']?.get?.tags).toEqual(['reference'])
    expect(Object.keys(spec.paths['/v1/admin/blocklist'] ?? {}).sort()).toEqual([
      'delete',
      'get',
      'post',
    ])
  })

  it('bilinmeyen yol 404 döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/yok' })
    expect(res.statusCode).toBe(404)
  })
})

describe('yanıt sıkıştırma', () => {
  it('1 KB üstü gövde istemcinin kabul ettiği biçimde sıkışır (önce br, sonra gzip); içerik aynı', async () => {
    const plain = await app.inject({ method: 'GET', url: '/openapi.json' })
    expect(plain.headers['content-encoding']).toBeUndefined()
    expect(plain.rawPayload.length).toBeGreaterThan(1024)

    const br = await app.inject({
      method: 'GET',
      url: '/openapi.json',
      headers: { 'accept-encoding': 'gzip, deflate, br' },
    })
    expect(br.headers['content-encoding']).toBe('br')
    expect(String(br.headers.vary)).toMatch(/accept-encoding/i)
    expect(br.rawPayload.length).toBeLessThan(plain.rawPayload.length / 3)
    expect(brotliDecompressSync(br.rawPayload).toString('utf8')).toBe(plain.body)

    const gzip = await app.inject({
      method: 'GET',
      url: '/openapi.json',
      headers: { 'accept-encoding': 'gzip' },
    })
    expect(gzip.headers['content-encoding']).toBe('gzip')
    expect(gunzipSync(gzip.rawPayload).toString('utf8')).toBe(plain.body)
    expect(gzip.headers['x-robots-tag']).toBe(API_ROBOTS_TAG)
  })

  it('küçük gövde ve desteklenmeyen biçim sıkıştırılmaz', async () => {
    const small = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'accept-encoding': 'gzip, br' },
    })
    expect(small.headers['content-encoding']).toBeUndefined()
    expect(small.json()).toMatchObject({ status: 'ok' })

    const deflate = await app.inject({
      method: 'GET',
      url: '/openapi.json',
      headers: { 'accept-encoding': 'deflate' },
    })
    expect(deflate.headers['content-encoding']).toBeUndefined()
  })

  it('sıkıştırılmış istek gövdesi açılmaz', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' },
      payload: gzipSync(JSON.stringify({ email: 'a@example.test', password: 'x'.repeat(12) })),
    })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.statusCode).toBeLessThan(500)
  })
})

describe('arama motorları (M6b)', () => {
  it('/robots.txt bütün yolları kapatır; düz metin, hız sınırsız', async () => {
    const res = await app.inject({ method: 'GET', url: '/robots.txt' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('text/plain; charset=utf-8')
    expect(res.headers['cache-control']).toBe('public, max-age=86400')
    expect(res.headers['x-ratelimit-limit']).toBeUndefined()
    expect(res.body).toBe(API_ROBOTS_TXT)
    expect(res.body).toBe('User-agent: *\nDisallow: /\n')
  })

  it('her yanıtta X-Robots-Tag: noindex (başarı, 4xx, 5xx, robots.txt, OpenAPI)', async () => {
    const requests = [
      { url: '/health', status: 200 },
      { url: '/robots.txt', status: 200 },
      { url: '/openapi.json', status: 200 },
      { url: '/yok', status: 404 },
      { url: '/v1/airports?country=tr', status: 400 },
      { url: '/v1/airports/LT-M', status: 400 },
      // testApp'te veritabanı yok: havalimanı uçları 503.
      { url: '/v1/airports', status: 503 },
      { url: '/v1/airports/LTFM', status: 503 },
      { url: '/v1/admin/services', status: 401 },
    ]
    for (const { url, status } of requests) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode, url).toBe(status)
      expect(res.headers['x-robots-tag'], url).toBe(API_ROBOTS_TAG)
    }
    expect(API_ROBOTS_TAG).toBe('noindex')
    const options = await app.inject({
      method: 'OPTIONS',
      url: '/v1/airports',
      headers: { origin: 'https://example.com', 'access-control-request-method': 'GET' },
    })
    expect(options.headers['x-robots-tag']).toBe(API_ROBOTS_TAG)
  })

  it('hız sınırı aşılınca da (429) X-Robots-Tag gönderilir', async () => {
    const { app: limited } = await testApp()
    try {
      let last = await limited.inject({ method: 'GET', url: '/v1/airports/LTFM' })
      for (let i = 0; i < 60 && last.statusCode !== 429; i++) {
        last = await limited.inject({ method: 'GET', url: '/v1/airports/LTFM' })
      }
      expect(last.statusCode).toBe(429)
      expect(last.headers['x-robots-tag']).toBe(API_ROBOTS_TAG)
    } finally {
      await limited.close()
    }
  })

  it('/openapi.json havalimanı uçlarını içerir; robots.txt belgelenmez', async () => {
    const spec = (await app.inject({ method: 'GET', url: '/openapi.json' })).json() as {
      paths: Record<
        string,
        Record<string, { tags?: string[]; parameters?: { name: string; in: string }[] }>
      >
    }
    expect(spec.paths['/v1/airports/{code}']?.get?.tags).toEqual(['reference'])
    expect(spec.paths['/v1/airports/{code}']?.get?.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'code', in: 'path' })]),
    )
    expect(spec.paths['/v1/airports']?.get?.parameters?.map((p) => p.name).sort()).toEqual([
      'country',
      'include',
      'scope',
    ])
    expect(spec.paths['/robots.txt']).toBeUndefined()
  })
})

describe('env', () => {
  it('varsayılanları uygular', () => {
    const parsed = parseEnv({})
    expect(parsed.API_PORT).toBe(4100)
    expect(parsed.APP_ENV).toBe('development')
    expect(parsed.GIT_SHA).toBe('dev')
    expect(parsed.EXPECTED_WORKERS).toEqual(['worker-rt', 'worker-bg'])
    expect(parseEnv({ API_PORT: '' }).API_PORT).toBe(4100)
    expect(parsed.WS_MAX_CONNECTIONS).toBe(2_000)
    expect(parsed.LIVE_POLL_MS).toBe(1_000)
    expect(parseEnv({ WS_MAX_CONNECTIONS: '', LIVE_POLL_MS: '' })).toMatchObject({
      WS_MAX_CONNECTIONS: 2_000,
      LIVE_POLL_MS: 1_000,
    })
  })

  it('canlı API ayarları sınırlar içinde olmalı', () => {
    expect(parseEnv({ WS_MAX_CONNECTIONS: '500', LIVE_POLL_MS: '250' })).toMatchObject({
      WS_MAX_CONNECTIONS: 500,
      LIVE_POLL_MS: 250,
    })
    expect(parseEnv({ WS_MAX_CONNECTIONS: '100000', LIVE_POLL_MS: '10000' })).toMatchObject({
      WS_MAX_CONNECTIONS: 100_000,
      LIVE_POLL_MS: 10_000,
    })
    for (const bad of ['0', '100001', '1.5', 'abc']) {
      expect(() => parseEnv({ WS_MAX_CONNECTIONS: bad }), bad).toThrow(/WS_MAX_CONNECTIONS/)
    }
    for (const bad of ['249', '10001', '500.5', 'hızlı']) {
      expect(() => parseEnv({ LIVE_POLL_MS: bad }), bad).toThrow(/LIVE_POLL_MS/)
    }
  })

  it('üretimde port 4000; veri bağlantıları ve güvenilen proxy ağları zorunlu', () => {
    const production = {
      APP_ENV: 'production',
      DATABASE_URL: 'postgres://u:p@db:5432/app',
      REDIS_QUEUE_URL: 'redis://:p@rq:6379/0',
      REDIS_LIVE_URL: 'redis://:p@rl:6379/0',
      TRUSTED_PROXY_CIDRS: '10.0.0.0/8, 172.16.0.0/12',
    }
    expect(() => parseEnv({ APP_ENV: 'production' })).toThrow(/DATABASE_URL/)
    expect(() => parseEnv({ ...production, TRUSTED_PROXY_CIDRS: '' })).toThrow(
      /TRUSTED_PROXY_CIDRS/,
    )
    const prod = parseEnv(production)
    expect(prod.API_PORT).toBe(4000)
    expect(prod.TRUSTED_PROXY_CIDRS).toEqual(['10.0.0.0/8', '172.16.0.0/12'])
  })

  it('#…# talimatları tanımsız sayılır; doldurulmamış parola açılışı durdurur', () => {
    const parsed = parseEnv({
      EDGE_PROXY: '#boş bırak; Cloudflare açılırsa cloudflare yaz#',
      ADMIN_EMAIL: '#yönetici e-postanı yaz#',
      ADMIN_SETUP_TOKEN: '#parola üret (en az 12 karakter)#',
      TRUSTED_PROXY_CIDRS: '10.0.0.0/8',
    })
    expect(parsed.EDGE_PROXY).toBeUndefined()
    expect(parsed.ADMIN_EMAIL).toBeUndefined()
    expect(parsed.ADMIN_SETUP_TOKEN).toBeUndefined()
    expect(() =>
      parseEnv({ DATABASE_URL: 'postgres://havayolu:#parola üret#@hy-postgres:5432/havayolu' }),
    ).toThrow(/POSTGRES_PASSWORD doldurulmamış/)
    expect(() =>
      parseEnv({ REDIS_LIVE_URL: 'redis://:#parola üret#@hy-redis-live:6379/0' }),
    ).toThrow(/REDIS_LIVE_PASSWORD doldurulmamış/)
  })

  it('geçersiz proxy ağı reddedilir; boş GIT_SHA açılışı engellemez', () => {
    expect(() => parseEnv({ TRUSTED_PROXY_CIDRS: '10.0.0.0/33' })).toThrow(/TRUSTED_PROXY_CIDRS/)
    expect(() => parseEnv({ TRUSTED_PROXY_CIDRS: 'traefik' })).toThrow(/TRUSTED_PROXY_CIDRS/)
    expect(() => parseEnv({ TRUSTED_PROXY_CIDRS: '0.0.0.0/0' })).toThrow(/TRUSTED_PROXY_CIDRS/)
    expect(parseEnv({ GIT_SHA: '' }).GIT_SHA).toBe('dev')
    expect(parseEnv({ GIT_SHA: '  ' }).GIT_SHA).toBe('dev')
  })

  it("hatalı yönetici ayarı API'yi kapatmaz: giriş kapanır ve nedeni döner", () => {
    const ok = parseEnv({ ADMIN_EMAIL: 'a@b.co', ADMIN_SETUP_TOKEN: 'on-iki-harf' + 'x' })
    expect(ok).toMatchObject({ ADMIN_EMAIL: 'a@b.co', ADMIN_DISABLED_REASON: null })
    expect(ok.ADMIN_SETUP_TOKEN).toHaveLength(12)
    const cases = [
      [{ ADMIN_EMAIL: 'a@b.co' }, /birlikte/],
      [{ ADMIN_SETUP_TOKEN: 'yeterince-uzun-anahtar' }, /birlikte/],
      [
        { ADMIN_EMAIL: 'a@b.co', ADMIN_SETUP_TOKEN: 'kisa' },
        /en az 12 karakter olmalı \(şu an 4\)/,
      ],
      [{ ADMIN_EMAIL: 'eposta-degil', ADMIN_SETUP_TOKEN: 'yeterince-uzun-anahtar' }, /e-posta/],
    ] as const
    for (const [vars, reason] of cases) {
      const parsed = parseEnv(vars)
      expect(parsed.ADMIN_DISABLED_REASON).toMatch(reason)
      expect(parsed.ADMIN_EMAIL).toBeUndefined()
      expect(parsed.ADMIN_SETUP_TOKEN).toBeUndefined()
    }
    expect(parseEnv({}).ADMIN_DISABLED_REASON).toBeNull()
  })

  it('geçersiz genel ayarlar açılışı durdurur', () => {
    expect(() => parseEnv({ API_PORT: 'abc' })).toThrow(EnvError)
    expect(() => parseEnv({ APP_ENV: 'staging' })).toThrow(/APP_ENV/)
  })

  it("CORS yalnızca web ve admin host'larına izin verir", () => {
    expect(
      allowedOrigins(testEnv({ WEB_HOST: 'airline.live', ADMIN_HOST: 'admin.airline.live' })),
    ).toEqual(['https://airline.live', 'https://admin.airline.live'])
    expect(allowedOrigins(testEnv({ WEB_HOST: 'localhost:3100' }))).toEqual([
      'http://localhost:3100',
    ])
    expect(allowedOrigins(testEnv())).toEqual([])
  })
})

describe('marka ve eski alan adları (D-112)', () => {
  const LEGACY = {
    WEB_HOST: 'airline.live',
    ADMIN_HOST: 'admin.airline.live',
    API_HOST: 'api.airline.live',
    LEGACY_API_HOSTS: 'api.havayolu.live',
  }

  it('OpenAPI başlığı ve /version marka adını APP_NAME’den alır (varsayılan Airline.live)', async () => {
    const spec = (await app.inject({ method: 'GET', url: '/openapi.json' })).json() as {
      info: { title: string }
    }
    expect(spec.info.title).toBe('Airline.live API')

    const { app: named } = await testApp({ env: { APP_NAME: ' Deneme.site ' } })
    const renamed = (await named.inject({ method: 'GET', url: '/openapi.json' })).json() as {
      info: { title: string }
    }
    expect(renamed.info.title).toBe('Deneme.site API')
    expect((await named.inject({ method: 'GET', url: '/version' })).json()).toMatchObject({
      app: 'Deneme.site',
    })
    await named.close()
  })

  it('eski API host’una gelen her istek yol ve sorguyla 308 alır: GET, POST, OPTIONS, 404', async () => {
    const { app: legacy } = await testApp({ env: LEGACY })
    const cases = [
      { method: 'GET', url: '/version?x=1&y=%20z', host: 'api.havayolu.live' },
      { method: 'GET', url: '/v1/live?bbox=25,35,45,43', host: 'API.HAVAYOLU.LIVE:443' },
      { method: 'POST', url: '/api/auth/login', host: 'api.havayolu.live' },
      { method: 'OPTIONS', url: '/v1/live', host: 'api.havayolu.live' },
      { method: 'GET', url: '/yok', host: 'api.havayolu.live.' },
      { method: 'GET', url: '/ready', host: 'api.havayolu.live' },
    ] as const
    for (const { method, url, host } of cases) {
      const res = await legacy.inject({
        method,
        url,
        headers: { host, origin: 'https://havayolu.live' },
        ...(method === 'POST' ? { payload: { email: 'a@b.co', password: 'x' } } : {}),
      })
      expect(res.statusCode, `${method} ${host}${url}`).toBe(308)
      expect(res.headers.location, `${method} ${host}${url}`).toBe(`https://api.airline.live${url}`)
      // Eski origin CORS'a eklenmez: yönlendirme yanıtı izin başlığı taşımaz.
      expect(res.headers['access-control-allow-origin']).toBeUndefined()
    }
    await legacy.close()
  })

  it('yeni host, iç host ve bilinmeyen host bugünkü gibi yanıt alır', async () => {
    const { app: legacy } = await testApp({ env: LEGACY })
    for (const host of ['api.airline.live', 'hy-api:4000', '127.0.0.1:4000', 'other.example']) {
      const res = await legacy.inject({ method: 'GET', url: '/health', headers: { host } })
      expect(res.statusCode, host).toBe(200)
      expect(res.headers.location, host).toBeUndefined()
    }
    await legacy.close()
  })

  it('X-Forwarded-Host yalnızca güvenilen vekilden gelince okunur', async () => {
    const forwarded = { host: 'hy-api:4000', 'x-forwarded-host': 'api.havayolu.live' }
    const { app: trusted } = await testApp({
      env: { ...LEGACY, TRUSTED_PROXY_CIDRS: '127.0.0.1/32' },
    })
    const viaProxy = await trusted.inject({ method: 'GET', url: '/health', headers: forwarded })
    expect(viaProxy.statusCode).toBe(308)
    expect(viaProxy.headers.location).toBe('https://api.airline.live/health')
    await trusted.close()

    const { app: direct } = await testApp({ env: LEGACY })
    const res = await direct.inject({ method: 'GET', url: '/health', headers: forwarded })
    expect(res.statusCode).toBe(200)
    await direct.close()
  })

  it('WebSocket el sıkışması eski host’ta düz 308 yanıtıyla reddedilir (101 yok)', async () => {
    const { app: legacy } = await testApp({ env: LEGACY })
    await legacy.ready()
    await expect(
      legacy.injectWS('/v1/ws?x=1', { headers: { host: 'api.havayolu.live' } }),
    ).rejects.toThrow(/Unexpected server response: 308/)
    await legacy.close()
  })

  it('liste boşsa eski host da normal yanıt alır (geçişten önceki durum)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { host: 'api.havayolu.live' },
    })
    expect(res.statusCode).toBe(200)
  })

  it('env: liste kırpılır ve küçük harfe çevrilir; hedefsiz, döngülü ve geçersiz liste reddedilir', () => {
    expect(
      parseEnv({ API_HOST: 'API.airline.live', LEGACY_API_HOSTS: ' Api.Havayolu.Live ,' }),
    ).toMatchObject({ API_HOST: 'api.airline.live', LEGACY_API_HOSTS: ['api.havayolu.live'] })
    expect(parseEnv({}).LEGACY_API_HOSTS).toEqual([])
    expect(parseEnv({ LEGACY_API_HOSTS: '#boş bırak#' }).LEGACY_API_HOSTS).toEqual([])
    expect(() => parseEnv({ LEGACY_API_HOSTS: 'api.havayolu.live' })).toThrow(
      /LEGACY_API_HOSTS: API_HOST tanımlı olmalı/,
    )
    for (const entry of ['api.airline.live', 'airline.live', 'admin.airline.live']) {
      expect(() => parseEnv({ ...LEGACY, LEGACY_API_HOSTS: entry }), entry).toThrow(
        /yönlendirme döngüye girer/,
      )
    }
    for (const entry of ['hy-api', 'localhost:4100', '127.0.0.1', 'https://api.havayolu.live']) {
      expect(() => parseEnv({ ...LEGACY, LEGACY_API_HOSTS: entry }), entry).toThrow(
        /LEGACY_API_HOSTS/,
      )
    }
    expect(() => parseEnv({ API_HOST: 'https://api.airline.live' })).toThrow(/API_HOST/)
    expect(parseEnv({ APP_NAME: '' }).APP_NAME).toBe('Airline.live')
  })
})
