import { afterEach, describe, expect, it } from 'vitest'
import { ADMIN_EMAIL, ADMIN_SETUP_TOKEN, login, testApp } from '../test/helpers'

type App = Awaited<ReturnType<typeof testApp>>['app']
const apps: App[] = []
async function freshApp(...args: Parameters<typeof testApp>) {
  const result = await testApp(...args)
  apps.push(result.app)
  return result
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

/**
 * "Siteni Analiz Et" uygulamasının src/lib/platformAuth.ts dosyasındaki token çıkarma mantığı
 * (token | accessToken | access_token; kök, data ya da user içinde). Sözleşmenin karşı tarafı.
 */
function extractPlatformToken(payload: Record<string, unknown>): string {
  const sources = [payload, payload.data, payload.user].filter(
    (s): s is Record<string, unknown> => typeof s === 'object' && s !== null,
  )
  for (const source of sources) {
    for (const key of ['token', 'accessToken', 'access_token']) {
      const value = source[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  return ''
}

describe('platform-admin giriş sözleşmesi', () => {
  it("doğru bilgiyle token döner; analiz uygulaması token'ı okuyabilir", async () => {
    const { app } = await freshApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ADMIN_EMAIL.toUpperCase(), password: ADMIN_SETUP_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Record<string, unknown>
    expect(extractPlatformToken(body)).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(body.expiresIn).toBe(604_800)
  })

  it('yanlış bilgide 401 ve okunur mesaj döner', async () => {
    const { app } = await freshApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ADMIN_EMAIL, password: 'yanlis-anahtar' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ message: 'E-posta ya da şifre hatalı.' })
  })

  it('eksik alanda 400 döner', async () => {
    const { app } = await freshApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ADMIN_EMAIL },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('message')
  })

  it('yönetici bilgileri tanımlı değilse giriş 404 ile kapalıdır', async () => {
    const { app } = await freshApp({ env: { ADMIN_EMAIL: '', ADMIN_SETUP_TOKEN: '' } })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ADMIN_EMAIL, password: ADMIN_SETUP_TOKEN },
    })
    expect(res.statusCode).toBe(404)
  })

  it('oturum deposu yoksa giriş kapalıdır', async () => {
    const { app } = await freshApp({ deps: { sessionStore: null } })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ADMIN_EMAIL, password: ADMIN_SETUP_TOKEN },
    })
    expect(res.statusCode).toBe(404)
  })

  it("/api/admin/session geçerli token'da 200, geçersiz ya da eksikte 401 döner", async () => {
    const { app } = await freshApp()
    const token = await login(app)
    const ok = await app.inject({
      method: 'GET',
      url: '/api/admin/session',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toMatchObject({ ok: true, user: { email: ADMIN_EMAIL, role: 'ADMIN' } })

    const bad = await app.inject({
      method: 'GET',
      url: '/api/admin/session',
      headers: { authorization: 'Bearer uydurma' },
    })
    expect(bad.statusCode).toBe(401)
    expect((bad.json() as { message: string }).message).toBeTruthy()

    const none = await app.inject({ method: 'GET', url: '/api/admin/session' })
    expect(none.statusCode).toBe(401)
  })

  it('/api/auth/me yetkili rolü ADMIN olarak döndürür', async () => {
    const { app } = await freshApp()
    const token = await login(app)
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ user: { email: ADMIN_EMAIL, role: 'ADMIN' } })
  })

  it("çıkış token'ı iptal eder", async () => {
    const { app } = await freshApp()
    const token = await login(app)
    const out = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(out.statusCode).toBe(204)
    const after = await app.inject({
      method: 'GET',
      url: '/api/admin/session',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(after.statusCode).toBe(401)
  })

  it("aynı IP'den dakikada 5'ten fazla deneme 429 alır", async () => {
    const { app } = await freshApp()
    const attempt = () =>
      app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: ADMIN_EMAIL, password: 'yanlis-anahtar' },
      })
    const codes: number[] = []
    for (let i = 0; i < 6; i++) codes.push((await attempt()).statusCode)
    expect(codes).toEqual([401, 401, 401, 401, 401, 429])
    const blocked = await attempt()
    expect((blocked.json() as { message: string }).message).toMatch(/Çok fazla istek/)
  })

  it('token depoda açık hâliyle tutulmaz', async () => {
    const { app, store } = await freshApp()
    const token = await login(app)
    expect([...store.sessions.keys()]).not.toContain(token)
    expect([...store.sessions.keys()][0]).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('/v1/admin/services', () => {
  it('oturumsuz istekte 401 döner', async () => {
    const { app } = await freshApp()
    const res = await app.inject({ method: 'GET', url: '/v1/admin/services' })
    expect(res.statusCode).toBe(401)
  })

  it('oturumla bütün servislerin raporunu döner', async () => {
    const { app } = await freshApp()
    const token = await login(app)
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/services',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const report = res.json() as { overall: string; services: { id: string; state: string }[] }
    expect(report.overall).toBe('ok')
    expect(report.services.map((s) => s.id)).toEqual([
      'web',
      'api',
      'worker:worker-bg',
      'worker:worker-rt',
      'provider:adsbLol',
      'provider:localReceiver',
      'postgres',
      'redis-queue',
      'redis-live',
      'reference-data',
      'weather',
      'track-partitions',
      'analytics',
    ])
  })
})
