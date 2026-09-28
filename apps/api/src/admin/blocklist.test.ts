import Fastify from 'fastify'
import { afterAll, describe, expect, it } from 'vitest'
import { ADMIN_EMAIL, InMemorySessionStore, testApp } from '../test/helpers'
import {
  BLOCKLIST_MAX_ITEMS,
  parseHexes,
  registerBlocklistRoutes,
  type BlocklistStore,
} from './blocklist'

/** Bellekteki engel listesi (redis-queue kümesinin ikamesi). */
class MemoryBlocklist implements BlocklistStore {
  readonly hexes = new Set<string>()
  async list() {
    return [...this.hexes].sort()
  }
  async add(hexes: readonly string[]) {
    const before = this.hexes.size
    for (const hex of hexes) this.hexes.add(hex)
    return this.hexes.size - before
  }
  async remove(hexes: readonly string[]) {
    let removed = 0
    for (const hex of hexes) if (this.hexes.delete(hex)) removed += 1
    return removed
  }
}

async function setup(options: { blocklist?: BlocklistStore | null; sessions?: boolean } = {}) {
  const sessions = new InMemorySessionStore()
  const blocklist = options.blocklist === undefined ? new MemoryBlocklist() : options.blocklist
  const app = Fastify()
  registerBlocklistRoutes(app, {
    sessions: options.sessions === false ? null : sessions,
    blocklist,
  })
  await app.ready()
  const { token } = await sessions.create(ADMIN_EMAIL)
  return { app, blocklist, auth: { authorization: `Bearer ${token}` } }
}

const apps: { close(): PromiseLike<unknown> }[] = []
afterAll(() => Promise.all(apps.map((app) => app.close())))
async function fresh(...args: Parameters<typeof setup>) {
  const result = await setup(...args)
  apps.push(result.app)
  return result
}

describe('parseHexes', () => {
  it('kırpar, küçük harfe çevirir, tekrarları atar', () => {
    expect(parseHexes({ hexes: [' 4BB1A2 ', '4bb1a2', '~A1B2C3'] })).toEqual({
      ok: true,
      hexes: ['4bb1a2', '~a1b2c3'],
    })
  })

  it('biri bile geçersizse hiçbiri kabul edilmez', () => {
    const result = parseHexes({ hexes: ['4bb1a2', 'xyz', '4bb1a'] })
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      body: { error: 'bad_hex', invalid: ['xyz', '4bb1a'] },
    })
  })

  it('gövde biçimi: dizi, 1–1000 öğe, yalnızca metin', () => {
    for (const body of [
      null,
      {},
      { hexes: '4bb1a2' },
      { hexes: [] },
      { hexes: [123456] },
      { hexes: Array.from({ length: BLOCKLIST_MAX_ITEMS + 1 }, () => '4bb1a2') },
    ]) {
      expect(parseHexes(body), JSON.stringify(body)?.slice(0, 40)).toMatchObject({
        ok: false,
        body: { error: 'bad_request' },
      })
    }
  })
})

describe('/v1/admin/blocklist', () => {
  it('ekler, listeler ve çıkarır', async () => {
    const { app, auth } = await fresh()
    const add = await app.inject({
      method: 'POST',
      url: '/v1/admin/blocklist',
      headers: auth,
      payload: { hexes: ['4BB1A2', '~a1b2c3', '4bb1a2'] },
    })
    expect(add.statusCode).toBe(200)
    expect(add.json()).toEqual({ added: 2 })
    const again = await app.inject({
      method: 'POST',
      url: '/v1/admin/blocklist',
      headers: auth,
      payload: { hexes: ['4bb1a2'] },
    })
    expect(again.json()).toEqual({ added: 0 })

    const list = await app.inject({ method: 'GET', url: '/v1/admin/blocklist', headers: auth })
    expect(list.json()).toEqual({ hexes: ['4bb1a2', '~a1b2c3'] })

    const remove = await app.inject({
      method: 'DELETE',
      url: '/v1/admin/blocklist',
      headers: auth,
      payload: { hexes: ['4bb1a2', '4bb1a3'] },
    })
    expect(remove.json()).toEqual({ removed: 1 })
    const after = await app.inject({ method: 'GET', url: '/v1/admin/blocklist', headers: auth })
    expect(after.json()).toEqual({ hexes: ['~a1b2c3'] })
  })

  it('geçersiz hex 400 döner ve hiçbir şey yazılmaz', async () => {
    const { app, auth, blocklist } = await fresh()
    for (const method of ['POST', 'DELETE'] as const) {
      const res = await app.inject({
        method,
        url: '/v1/admin/blocklist',
        headers: auth,
        payload: { hexes: ['4bb1a2', 'nothex'] },
      })
      expect(res.statusCode, method).toBe(400)
      expect(res.json()).toMatchObject({ error: 'bad_hex', invalid: ['nothex'] })
    }
    const empty = await app.inject({
      method: 'POST',
      url: '/v1/admin/blocklist',
      headers: auth,
      payload: { hexes: [] },
    })
    expect(empty.statusCode).toBe(400)
    expect(empty.json()).toMatchObject({ error: 'bad_request' })
    expect(await blocklist?.list()).toEqual([])
  })

  it('yönetici oturumu olmadan 401; oturum deposu yoksa da 401', async () => {
    const { app } = await fresh()
    for (const method of ['GET', 'POST', 'DELETE'] as const) {
      const res = await app.inject({
        method,
        url: '/v1/admin/blocklist',
        headers: { authorization: 'Bearer yanlis' },
        ...(method === 'GET' ? {} : { payload: { hexes: ['4bb1a2'] } }),
      })
      expect(res.statusCode, method).toBe(401)
    }
    const { app: noSessions, auth } = await fresh({ sessions: false })
    const res = await noSessions.inject({
      method: 'GET',
      url: '/v1/admin/blocklist',
      headers: auth,
    })
    expect(res.statusCode).toBe(401)
  })

  it('depo (redis-queue) yoksa yöneticiye 503', async () => {
    const { app, auth } = await fresh({ blocklist: null })
    const res = await app.inject({ method: 'GET', url: '/v1/admin/blocklist', headers: auth })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ error: 'blocklist_unavailable' })
  })

  it('uygulamaya kayıtlıdır (buildApp)', async () => {
    const { app } = await testApp()
    apps.push(app)
    const res = await app.inject({ method: 'GET', url: '/v1/admin/blocklist' })
    expect(res.statusCode).toBe(401)
  })
})
