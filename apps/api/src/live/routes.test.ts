import { EMPTY_AIRLINE_CODES } from '@havayolu/db'
import type { Redis } from 'ioredis'
import { afterAll, describe, expect, it, vi } from 'vitest'
import {
  aircraftState,
  FakeLiveSource,
  publicAircraft,
  testAirlineCodes,
  testApp,
} from '../test/helpers'
import { LiveCache, type LiveReaders } from './cache'
import { LIVE_ERRORS, SEARCH_QUERY_MAX_LENGTH } from './routes'

const istanbul = publicAircraft({ hex: '4bb1a2', cs: 'THY974', lat: 41.27, lon: 28.75 })
const ankara = publicAircraft({
  hex: '4ba9c1',
  cs: 'PGT123',
  fn: null,
  reg: null,
  lat: 39.95,
  lon: 32.69,
  alt: null,
  gnd: true,
  gs: null,
  trk: null,
  vr: null,
  type: null,
  cat: null,
  sq: null,
  src: 'localReceiver',
  psrc: 'mlat',
})
const source = new FakeLiveSource([istanbul, ankara])
source.seqValue = 42
source.circles = [{ id: 'ist', kind: 'primary', lat: 41.2753, lon: 28.7519, radiusNm: 40 }]

const { app } = await testApp({
  deps: { live: { source, codes: testAirlineCodes } },
})
const { app: unavailable } = await testApp()
afterAll(() => Promise.all([app.close(), unavailable.close()]))

describe('GET /v1/live', () => {
  it('kutudaki uçakları, seq, kapsama ve durumla döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/live?bbox=28.5,41,29,41.5' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.headers['x-ratelimit-limit']).toBe('120')
    expect(res.json()).toEqual({
      seq: 42,
      coverage: 'full',
      status: { providers: { adsbLol: 'ok' }, primaryAgeS: 4.2, newestAgeS: 1.5 },
      aircraft: [istanbul],
    })
  })

  it('null alanlar ve sefer no yanıtta korunur (şema serileştirmesi)', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/live?bbox=28,39,33,42' })
    const body = res.json() as { coverage: string; aircraft: unknown[] }
    expect(body.coverage).toBe('partial')
    expect(body.aircraft).toEqual([istanbul, ankara])
  })

  it('kapsama dışındaki kutu none, kapsama bilinmiyorsa unknown', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/live?bbox=40,37,41,38' })
    expect(res.json()).toMatchObject({ coverage: 'none', aircraft: [] })
    const circles = source.circles
    source.circles = null
    const unknown = await app.inject({ method: 'GET', url: '/v1/live?bbox=28.5,41,29,41.5' })
    expect(unknown.json()).toMatchObject({ coverage: 'unknown' })
    source.circles = circles
  })

  it('bbox yoksa, bozuksa ya da çok genişse 400 bad_bbox', async () => {
    for (const url of [
      '/v1/live',
      '/v1/live?bbox=',
      '/v1/live?bbox=1,2,3',
      '/v1/live?bbox=29,41,28,42',
      '/v1/live?bbox=0,0,70,10',
      '/v1/live?bbox=a,b,c,d',
      '/v1/live?bbox=1,2,3,4&bbox=5,6,7,8',
    ]) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode, url).toBe(400)
      expect(res.json(), url).toEqual(LIVE_ERRORS.badBbox)
    }
  })

  it('canlı kaynak yoksa 503 live_unavailable', async () => {
    const res = await unavailable.inject({ method: 'GET', url: '/v1/live?bbox=28,41,29,42' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual(LIVE_ERRORS.unavailable)
  })
})

describe('GET /v1/search', () => {
  it('sefer no ile arar ve durumu da döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/search?q=TK974' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-ratelimit-limit']).toBe('60')
    expect(res.json()).toEqual({
      kind: 'flight',
      results: [istanbul],
      status: source.statusValue,
    })
  })

  it('hex, çağrı kodu ve sonuçsuz arama', async () => {
    const byHex = await app.inject({ method: 'GET', url: '/v1/search?q=4BA9C1' })
    expect(byHex.json()).toMatchObject({ kind: 'hex', results: [ankara] })
    const byCallsign = await app.inject({ method: 'GET', url: '/v1/search?q=pgt' })
    expect(byCallsign.json()).toMatchObject({ kind: 'callsign', results: [ankara] })
    const none = await app.inject({ method: 'GET', url: '/v1/search?q=ZZZ' })
    expect(none.json()).toMatchObject({ kind: 'callsign', results: [] })
  })

  it('boş ya da 32 karakterden uzun sorgu 400', async () => {
    for (const q of ['', '%20%20', 'x'.repeat(SEARCH_QUERY_MAX_LENGTH + 1)]) {
      const res = await app.inject({ method: 'GET', url: `/v1/search?q=${q}` })
      expect(res.statusCode, q).toBe(400)
      expect(res.json()).toEqual(LIVE_ERRORS.badQuery)
    }
    expect((await app.inject({ method: 'GET', url: '/v1/search' })).statusCode).toBe(400)
    const longest = await app.inject({
      method: 'GET',
      url: `/v1/search?q=${'x'.repeat(SEARCH_QUERY_MAX_LENGTH)}`,
    })
    expect(longest.statusCode).toBe(200)
  })

  it('canlı kaynak yoksa 503', async () => {
    const res = await unavailable.inject({ method: 'GET', url: '/v1/search?q=THY' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual(LIVE_ERRORS.unavailable)
  })
})

describe('engel listesi yüklenmeden canlı veri yok (ready)', () => {
  it('ready false iken /v1/live ve /v1/search 503; true olunca kaynak sunulur', async () => {
    let ready = false
    const { app: gated } = await testApp({
      deps: { live: { source, codes: testAirlineCodes, ready: () => ready } },
    })
    try {
      const live = () => gated.inject({ method: 'GET', url: '/v1/live?bbox=28.5,41,29,41.5' })
      const search = () => gated.inject({ method: 'GET', url: '/v1/search?q=THY974' })
      for (const res of [await live(), await search()]) {
        expect(res.statusCode).toBe(503)
        expect(res.json()).toEqual(LIVE_ERRORS.unavailable)
      }
      // Kutu hatası hazır olmayı beklemez.
      expect((await gated.inject({ method: 'GET', url: '/v1/live?bbox=x' })).statusCode).toBe(400)
      ready = true
      expect((await live()).json()).toMatchObject({ seq: 42, aircraft: [istanbul] })
      expect((await search()).json()).toMatchObject({ kind: 'callsign', results: [istanbul] })
    } finally {
      await gated.close()
    }
  })
})

describe('gizlilik uçtan uca (LiveCache + REST)', () => {
  it('askeri ve bayrağı bilinmeyen uçak canlı yanıtta ve aramada yoktur', async () => {
    const states = [
      aircraftState({ hex: '4bb1a2', callsign: 'THY974', sampleTime: 1_000_000 }),
      aircraftState({ hex: '4b8001', callsign: 'TUAF01', dbFlags: 1, sampleTime: 1_000_000 }),
      aircraftState({ hex: '4b8002', callsign: 'THY975', dbFlags: null, sampleTime: 1_000_000 }),
    ]
    const readers: LiveReaders = {
      changedSince: async () => states.map((s) => ({ hex: s.hex, sampleTime: s.sampleTime })),
      aircraftMany: async (_redis, hexes) =>
        new Map(states.filter((s) => hexes.includes(s.hex)).map((s) => [s.hex, s])),
      providerLive: async () => null,
      coverage: async () => null,
      configuredProviders: async () => null,
    }
    const cache = new LiveCache({
      redisLive: {} as Redis,
      codes: () => EMPTY_AIRLINE_CODES,
      blocklist: () => new Set(),
      log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
      now: () => 1_001_000,
      readers,
    })
    await cache.tick()
    const { app: live } = await testApp({
      deps: { live: { source: cache, codes: () => EMPTY_AIRLINE_CODES } },
    })
    try {
      const res = await live.inject({ method: 'GET', url: '/v1/live?bbox=28,41,29,42' })
      const body = res.json() as { aircraft: { hex: string; fn: unknown }[] }
      expect(body.aircraft.map((a) => a.hex)).toEqual(['4bb1a2'])
      // Kod eşlemesi yoksa sefer no çıkarılmaz.
      expect(body.aircraft[0]?.fn).toBeNull()
      for (const q of ['4b8001', 'TUAF01', 'TUAF', 'THY975', '4B8002']) {
        const search = await live.inject({ method: 'GET', url: `/v1/search?q=${q}` })
        expect((search.json() as { results: unknown[] }).results, q).toEqual([])
      }
    } finally {
      await live.close()
    }
  })
})
