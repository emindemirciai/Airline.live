import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { parseEnv } from '../env'
import { aircraft, FakeLiveSource } from '../live/test/ws-fakes'
import { closeLiveSockets, registerLiveWs } from '../live/ws'
import { registerLegacyHostRedirect } from './legacy-host'

const apps: FastifyInstance[] = []
afterEach(async () => {
  await closeLiveSockets()
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

const env = (overrides: Record<string, string> = {}) =>
  parseEnv({
    APP_ENV: 'test',
    LOG_LEVEL: 'silent',
    WEB_HOST: 'airline.live',
    API_HOST: 'api.airline.live',
    LEGACY_API_HOSTS: 'api.havayolu.live',
    ...overrides,
  })

/** Yalnızca yönlendirme kancası, bir HTTP yolu ve canlı WebSocket (app.ts'teki sırayla). */
async function wired(overrides: Record<string, string> = {}) {
  const app = Fastify()
  apps.push(app)
  const e = env(overrides)
  registerLegacyHostRedirect(app, e)
  app.get('/health', async () => ({ status: 'ok' }))
  registerLiveWs(app, {
    source: new FakeLiveSource([aircraft('4bb001', 41.0, 29.0)], 1),
    env: e,
    log: app.log,
    random: () => 0,
  })
  await app.ready()
  return app
}

describe('registerLegacyHostRedirect', () => {
  it('eski host’taki WebSocket el sıkışması 308 alır; yeni host’ta bağlantı açılır', async () => {
    const app = await wired()
    await expect(
      app.injectWS('/v1/ws', { headers: { host: 'api.havayolu.live' } }),
    ).rejects.toThrow(/Unexpected server response: 308/)

    const ws = await app.injectWS('/v1/ws', { headers: { host: 'api.airline.live' } })
    expect(ws.readyState).toBe(ws.OPEN)
    ws.terminate()
  })

  it('HTTP yanıtı Location’ı env’deki hedeften kurar; sahte host başlığı dışarı yönlendiremez', async () => {
    const app = await wired()
    const res = await app.inject({
      method: 'GET',
      url: '//evil.example/x?y=1',
      headers: { host: 'api.havayolu.live' },
    })
    expect(res.statusCode).toBe(308)
    expect(res.headers.location).toBe('https://api.airline.live//evil.example/x?y=1')
    expect(res.body).toBe('')
  })

  it('liste boşsa kanca eklenmez', async () => {
    const app = await wired({ LEGACY_API_HOSTS: '' })
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { host: 'api.havayolu.live' },
    })
    expect(res.statusCode).toBe(200)
  })
})
