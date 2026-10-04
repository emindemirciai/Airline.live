import type { AddressInfo } from 'node:net'
import { EMPTY_AIRLINE_CODES } from '@havayolu/db'
import Fastify, { type FastifyInstance } from 'fastify'
import WebSocket from 'ws'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { testApp, testEnv } from '../test/helpers'
import { aircraft, FakeLiveSource, type WsMessage } from './test/ws-fakes'
import type { Bbox, PublicAircraft } from './types'
import { closeLiveSockets, registerLiveWs, WS_MAX_PAYLOAD_BYTES, wsRateLimit } from './ws'
import { WS_LIMITS } from './ws-hub'

// Gerçek Fastify (127.0.0.1, rastgele port) ve `ws` istemcisi; canlı veri test içi kaynaktan gelir.
const V_IST: Bbox = { minLon: 28.2, minLat: 40.5, maxLon: 29.5, maxLat: 41.5 }
const a1 = aircraft('4bb001', 41.0, 29.0)
const b1 = aircraft('4bb101', 39.5, 32.8, { cs: 'AJA1A', fn: null, reg: 'TC-AJA' })

const apps: FastifyInstance[] = []
const sockets: WebSocket[] = []

afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate()
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

async function listen(app: FastifyInstance): Promise<string> {
  apps.push(app)
  await app.listen({ host: '127.0.0.1', port: 0 })
  const { port } = app.server.address() as AddressInfo
  return `ws://127.0.0.1:${port}/v1/ws`
}

/** Uygulamanın gerçek bağlaması (buildApp: helmet, CORS, hız sınırı, WS). */
async function realApp(source: FakeLiveSource) {
  const { app } = await testApp({
    deps: { live: { source, codes: () => EMPTY_AIRLINE_CODES } },
  })
  return { app, url: await listen(app) }
}

class Client {
  readonly messages: WsMessage[] = []
  readonly closed: Promise<{ code: number; reason: string }>
  readonly opened: Promise<void>

  constructor(
    readonly ws: WebSocket,
    readonly name = 'client',
  ) {
    sockets.push(ws)
    ws.on('message', (data) => this.messages.push(JSON.parse(data.toString()) as WsMessage))
    // Açılıştan sonraki hatalar (sunucunun sonlandırdığı soket) testi düşürmesin; kapanış kodu denetlenir.
    ws.on('error', () => {})
    this.closed = new Promise((resolve) => {
      ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() }))
    })
    this.opened = new Promise((resolve, reject) => {
      ws.once('open', () => resolve())
      ws.once('error', reject)
    })
  }

  static async open(url: string, options: WebSocket.ClientOptions = {}): Promise<Client> {
    const client = new Client(new WebSocket(url, options))
    await client.opened
    return client
  }

  subscribe(viewport: Bbox, extra: Record<string, unknown> = {}) {
    this.ws.send(JSON.stringify({ type: 'subscribe', viewport, zoom: 9, ...extra }))
  }

  async next(timeout = 5_000): Promise<WsMessage> {
    await vi.waitFor(() => expect(this.messages.length).toBeGreaterThan(0), { timeout })
    const message = this.messages.shift()
    if (!message) throw new Error('no message')
    return message
  }
}

function cellsOf(message: WsMessage) {
  return message.cells as { c: string; added: PublicAircraft[]; updated: PublicAircraft[] }[]
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('/v1/ws gerçek sunucuda', () => {
  it('abonelik tam görüntü getirir, kaynak turu görünüm hücresinin farkını getirir', async () => {
    const source = new FakeLiveSource([a1, b1], 10)
    const { url } = await realApp(source)
    const client = await Client.open(url)
    // İstemci permessage-deflate önerse de sunucu sıkıştırmayı açmaz.
    expect(client.ws.extensions).toBe('')
    client.subscribe(V_IST)
    const snapshot = await client.next()
    expect(snapshot).toMatchObject({ type: 'snapshot', seq: 10, aircraft: [a1] })

    const moved = { ...a1, lat: 41.1, t: a1.t + 1_000 }
    source.tick({ upsert: [moved, { ...b1, lat: 39.6 }] })
    const diff = await client.next()
    expect(diff).toMatchObject({ type: 'diff', seq: 11, status: { providers: { adsbLol: 'ok' } } })
    expect(cellsOf(diff)).toEqual([{ c: '20:14', added: [], updated: [moved], removed: [] }])
  })

  it('lastSeq ile yeniden bağlanan istemci yalnızca eksik farkları alır', async () => {
    const source = new FakeLiveSource([a1, b1], 10)
    const { url } = await realApp(source)
    const first = await Client.open(url)
    first.subscribe(V_IST)
    const { seq } = await first.next()
    first.ws.close(1000)
    await first.closed

    source.tick({ upsert: [{ ...a1, lat: 41.1 }] })
    source.tick({ upsert: [{ ...b1, lat: 39.4 }] })
    const newcomer = aircraft('4bb003', 41.3, 29.3, { cs: 'THY1', reg: 'TC-LGA' })
    source.tick({ upsert: [{ ...a1, lat: 41.2 }, newcomer] })

    const again = await Client.open(url)
    again.subscribe(V_IST, { lastSeq: seq })
    const resumed = await again.next()
    expect(resumed).toMatchObject({ type: 'diff', seq: 13 })
    expect(cellsOf(resumed)).toEqual([
      { c: '20:14', added: [newcomer], updated: [{ ...a1, lat: 41.2 }], removed: [] },
    ])
    await pause(200)
    expect(again.messages).toEqual([])

    // Bundan sonra farklar kesintisiz devam eder.
    source.tick({ remove: ['4bb003'] })
    expect(await again.next()).toMatchObject({
      type: 'diff',
      seq: 14,
      cells: [{ c: '20:14', added: [], updated: [], removed: ['4bb003'] }],
    })
  })

  it('closeLiveSockets her istemciye reconnect gönderir ve 1012 ile kapatır', async () => {
    const source = new FakeLiveSource([a1], 3)
    const { url } = await realApp(source)
    const clients = await Promise.all([Client.open(url), Client.open(url), Client.open(url)])
    const started = Date.now()
    await closeLiveSockets()
    expect(Date.now() - started).toBeLessThan(WS_LIMITS.closeGraceMs)
    for (const client of clients) {
      const message = await client.next()
      expect(message.type).toBe('reconnect')
      expect(message.afterMs).toBeGreaterThanOrEqual(1_000)
      expect(message.afterMs).toBeLessThanOrEqual(10_000)
      expect(await client.closed).toEqual({ code: 1012, reason: 'restart' })
    }
    // Kapanış başladıktan sonra gelen bağlantı da yeniden bağlanmaya yönlendirilir.
    const late = await Client.open(url)
    expect((await late.next()).type).toBe('reconnect')
    expect((await late.closed).code).toBe(1012)
  })

  it('aynı IP’den 11. bağlantı 1008 too_many_connections ile kapanır', async () => {
    const { url } = await realApp(new FakeLiveSource([a1], 1))
    const open: Client[] = []
    for (let i = 0; i < WS_LIMITS.perIp; i++) open.push(await Client.open(url))
    const extra = await Client.open(url)
    expect(await extra.closed).toEqual({ code: 1008, reason: 'too_many_connections' })
    for (const client of open) expect(client.ws.readyState).toBe(WebSocket.OPEN)

    open[0]?.ws.close(1000)
    await open[0]?.closed
    const replacement = await Client.open(url)
    await pause(100)
    expect(replacement.ws.readyState).toBe(WebSocket.OPEN)
  })

  // Test ortamı (APP_ENV=test) üretim dışıdır: sınır üretimdekinin iki katıdır (`wsRateLimit`, D-088).
  const handshakeLimit = wsRateLimit('test').max
  it(`el sıkışması IP başına dakikada ${handshakeLimit} ile sınırlıdır (429)`, async () => {
    const { url } = await realApp(new FakeLiveSource([], 0))
    for (let i = 0; i < handshakeLimit; i++) {
      const client = await Client.open(url)
      client.ws.close(1000)
      await client.closed
    }
    const limited = new Client(new WebSocket(url))
    await expect(limited.opened).rejects.toThrow(/429/)
  })

  it('16 KiB üstündeki istemci mesajı bağlantıyı 1009 ile kapatır', async () => {
    const { url } = await realApp(new FakeLiveSource([a1], 1))
    const client = await Client.open(url)
    client.ws.send('x'.repeat(WS_MAX_PAYLOAD_BYTES + 1))
    expect((await client.closed).code).toBe(1009)
  })

  it('pong vermeyen istemci iki kaçırılmış ping sonra sonlandırılır', async () => {
    const source = new FakeLiveSource([a1], 1)
    const app = Fastify()
    registerLiveWs(app, { source, env: testEnv(), log: app.log, pingIntervalMs: 100 })
    const url = await listen(app)
    const silent = await Client.open(url, { autoPong: false })
    const healthy = await Client.open(url)
    const started = Date.now()
    const { code } = await silent.closed
    // Sunucu kapanış çerçevesi göndermeden soketi kapatır (terminate) → 1006.
    expect(code).toBe(1006)
    expect(Date.now() - started).toBeGreaterThanOrEqual(150)
    await pause(300)
    expect(healthy.ws.readyState).toBe(WebSocket.OPEN)
  })

  it('geri basınç: 1 MiB üstünde fark atlanır, sonra tam görüntü gelir; 4 MiB üstünde bağlantı koparılır', async () => {
    const source = new FakeLiveSource([a1, b1], 10)
    const { app, url } = await realApp(source)
    const client = await Client.open(url)
    client.subscribe(V_IST)
    expect((await client.next()).type).toBe('snapshot')

    // Windows loopback'i okumayan istemcinin verisini çekirdekte tutar (ölçüm: 29 MB'lık tam
    // görüntüde sunucu tamponu 0 kaldı); birikme gerçek ağda deterministik üretilemez. Bu yüzden
    // gerçek sunucu soketinin ölçümü değiştirilir, geri kalan her şey gerçektir.
    const server = [...app.websocketServer.clients][0]
    if (!server) throw new Error('server socket missing')
    let buffered = WS_LIMITS.softBufferBytes + 1
    Object.defineProperty(server, 'bufferedAmount', { get: () => buffered })

    source.tick({ upsert: [{ ...a1, lat: 41.1 }] })
    await pause(WS_LIMITS.diffIntervalMs + 200)
    expect(client.messages).toEqual([])

    buffered = 0
    source.tick({ upsert: [{ ...a1, lat: 41.2 }] })
    expect(await client.next()).toMatchObject({
      type: 'snapshot',
      seq: 12,
      aircraft: [{ ...a1, lat: 41.2 }],
    })

    buffered = WS_LIMITS.hardBufferBytes + 1
    source.tick({ upsert: [{ ...a1, lat: 41.3 }] })
    // terminate(): kapanış el sıkışması yok, istemci 1006 görür (D-074).
    expect((await client.closed).code).toBe(1006)
    expect(client.messages).toEqual([])
  })
})
