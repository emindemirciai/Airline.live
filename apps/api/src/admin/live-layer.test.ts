import type { AdminAction, LiveLayerView } from '@havayolu/db'
import Fastify from 'fastify'
import { afterAll, describe, expect, it } from 'vitest'
import { ADMIN_EMAIL, InMemorySessionStore } from '../test/helpers'
import {
  LIVE_LAYER_PATH,
  parseLiveLayerBody,
  registerLiveLayerRoutes,
  type LiveLayerStore,
} from './live-layer'

/** Bellekteki anahtar ve işlem kaydı (PostgreSQL tablolarının ikamesi). */
class MemoryLiveLayer implements LiveLayerStore {
  state: LiveLayerView = { enabled: true, updatedAt: null, updatedBy: null }
  readonly log: AdminAction[] = []
  clock = Date.parse('2026-10-15T09:00:00.000Z')

  async read() {
    return this.state
  }
  async set(params: { enabled: boolean; actor: string; reason: string | null }) {
    const at = new Date((this.clock += 60_000))
    this.log.unshift({
      at,
      actor: params.actor,
      action: params.enabled ? 'live_layer_on' : 'live_layer_off',
      reason: params.reason,
    })
    this.state = { enabled: params.enabled, updatedAt: at, updatedBy: params.actor }
    return this.state
  }
  async actions(limit: number) {
    return this.log.slice(0, limit)
  }
}

async function setup(options: { store?: LiveLayerStore | null; sessions?: boolean } = {}) {
  const sessions = new InMemorySessionStore()
  const store = options.store === undefined ? new MemoryLiveLayer() : options.store
  const lines: string[] = []
  const app = Fastify({
    logger: { level: 'info', stream: { write: (line: string) => void lines.push(line) } },
  })
  let changed = 0
  registerLiveLayerRoutes(app, {
    sessions: options.sessions === false ? null : sessions,
    store,
    changed: () => {
      changed += 1
    },
  })
  await app.ready()
  const { token } = await sessions.create(ADMIN_EMAIL)
  return {
    app,
    store,
    lines,
    changes: () => changed,
    auth: { authorization: `Bearer ${token}` },
  }
}

const apps: { close(): PromiseLike<unknown> }[] = []
afterAll(() => Promise.all(apps.map((app) => app.close())))
async function fresh(...args: Parameters<typeof setup>) {
  const result = await setup(...args)
  apps.push(result.app)
  return result
}

describe('parseLiveLayerBody', () => {
  it('enabled boolean olmalı; neden kırpılır, NUL atılır, boşsa null', () => {
    expect(parseLiveLayerBody({ enabled: false })).toEqual({
      ok: true,
      enabled: false,
      reason: null,
    })
    expect(parseLiveLayerBody({ enabled: true, reason: '  Karar 2026/1 \u0000 ' })).toEqual({
      ok: true,
      enabled: true,
      reason: 'Karar 2026/1',
    })
    expect(parseLiveLayerBody({ enabled: true, reason: '   ' })).toEqual({
      ok: true,
      enabled: true,
      reason: null,
    })
    expect(parseLiveLayerBody({ enabled: true, reason: 'ş'.repeat(500) })).toMatchObject({
      ok: true,
    })
  })

  it('eksik ya da boolean olmayan enabled, metin olmayan ya da 500 karakterden uzun neden reddedilir', () => {
    for (const body of [
      null,
      [],
      'false',
      {},
      { enabled: 'false' },
      { enabled: 1 },
      { enabled: null },
      { enabled: true, reason: 42 },
      { enabled: true, reason: 'x'.repeat(501) },
    ]) {
      expect(parseLiveLayerBody(body), JSON.stringify(body)?.slice(0, 40)).toEqual({ ok: false })
    }
  })
})

describe('/v1/admin/live-layer', () => {
  it('oturum yoksa 401; depo yoksa 503', async () => {
    const { app, auth } = await fresh()
    expect((await app.inject({ method: 'GET', url: LIVE_LAYER_PATH })).statusCode).toBe(401)
    const put = await app.inject({
      method: 'PUT',
      url: LIVE_LAYER_PATH,
      payload: { enabled: false },
    })
    expect(put.statusCode).toBe(401)
    const noSessions = await fresh({ sessions: false })
    expect(
      (await noSessions.app.inject({ method: 'GET', url: LIVE_LAYER_PATH, headers: auth }))
        .statusCode,
    ).toBe(401)
    const noStore = await fresh({ store: null })
    const res = await noStore.app.inject({
      method: 'GET',
      url: LIVE_LAYER_PATH,
      headers: noStore.auth,
    })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ error: 'live_layer_unavailable' })
  })

  it('GET: hiç değiştirilmemiş anahtar açık; işlem kaydı boş', async () => {
    const { app, auth } = await fresh()
    const res = await app.inject({ method: 'GET', url: LIVE_LAYER_PATH, headers: auth })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.json()).toEqual({ enabled: true, updatedAt: null, updatedBy: null, actions: [] })
  })

  it('PUT kapatır ve açar: kim oturumun e-postasıdır, işlemler en yeni önce, changed çağrılır', async () => {
    const { app, auth, changes, lines } = await fresh()
    const off = await app.inject({
      method: 'PUT',
      url: LIVE_LAYER_PATH,
      headers: auth,
      payload: { enabled: false, reason: ' Karar 2026/123 ' },
    })
    expect(off.statusCode).toBe(200)
    expect(off.json()).toMatchObject({
      enabled: false,
      updatedBy: ADMIN_EMAIL,
      updatedAt: '2026-10-15T09:01:00.000Z',
      actions: [
        {
          at: '2026-10-15T09:01:00.000Z',
          actor: ADMIN_EMAIL,
          action: 'off',
          reason: 'Karar 2026/123',
        },
      ],
    })
    expect(changes()).toBe(1)
    const on = await app.inject({
      method: 'PUT',
      url: LIVE_LAYER_PATH,
      headers: auth,
      payload: { enabled: true },
    })
    expect(on.json()).toMatchObject({
      enabled: true,
      actions: [
        { action: 'on', reason: null },
        { action: 'off', reason: 'Karar 2026/123' },
      ],
    })
    // Durum aynı kalsa da her basış kaydedilir.
    await app.inject({
      method: 'PUT',
      url: LIVE_LAYER_PATH,
      headers: auth,
      payload: { enabled: true },
    })
    const view = await app.inject({ method: 'GET', url: LIVE_LAYER_PATH, headers: auth })
    expect((view.json() as { actions: unknown[] }).actions).toHaveLength(3)
    expect(changes()).toBe(3)
    // Log anahtarın yeni durumunu yazar; e-posta ve neden yazılmaz.
    const logged = lines.join('\n')
    expect(logged).toContain('"event":"admin_live_layer"')
    expect(logged).not.toContain(ADMIN_EMAIL)
    expect(logged).not.toContain('Karar 2026/123')
  })

  it('PUT gövde doğrulaması: 400, durum değişmez, changed çağrılmaz', async () => {
    const { app, auth, store, changes } = await fresh()
    for (const payload of [
      {},
      { enabled: 'false' },
      { enabled: 1 },
      { enabled: false, reason: 'x'.repeat(501) },
    ]) {
      const res = await app.inject({ method: 'PUT', url: LIVE_LAYER_PATH, headers: auth, payload })
      expect(res.statusCode, JSON.stringify(payload).slice(0, 40)).toBe(400)
      expect(res.json()).toMatchObject({ error: 'bad_request' })
    }
    expect(((await store?.read()) as LiveLayerView).enabled).toBe(true)
    expect(changes()).toBe(0)
  })
})
