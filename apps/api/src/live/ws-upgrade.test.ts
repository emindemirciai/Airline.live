import type { IncomingMessage } from 'node:http'
import { duplexPair, type Duplex } from 'node:stream'
import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseEnv } from '../env'
import { testAirlineCodes, testApp } from '../test/helpers'
import { aircraft, FakeLiveSource } from './test/ws-fakes'
import { closeLiveSockets, isLiveWsUpgrade, registerLiveWs } from './ws'

const apps: FastifyInstance[] = []
const sockets: Duplex[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  for (const socket of sockets.splice(0)) socket.destroy()
  await closeLiveSockets()
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

const HOST = 'Host: api.airline.live\r\n'
const UPGRADE = 'Connection: Upgrade\r\nUpgrade: websocket\r\n'
const WS_KEY = 'Sec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n'
/** Arkadan gelen sıradan istek: bağlantı HTTP'de kaldıysa yanıtlanır ve sunucu bağlantıyı kapatır. */
const THEN_HEALTH = `GET /health HTTP/1.1\r\n${HOST}Connection: close\r\n\r\n`

/** `buildApp` ile canlı kaynaklı uygulama: merkez ve ping döngüsü açık. */
async function fullApp(env: Record<string, string> = {}) {
  const { app } = await testApp({
    env,
    deps: {
      live: {
        source: new FakeLiveSource([aircraft('4bb001', 41.0, 29.0)], 1),
        codes: testAirlineCodes,
      },
    },
  })
  apps.push(app)
  return app
}

/**
 * Node'un gerçek HTTP ayrıştırıcısıyla, port açmadan bağlantı: soket çifti sunucuya `connection`
 * olarak verilir (hız sınırı anahtarı için uzak adresi verilir). `send` isteği yazar; okunan yanıt
 * metni `until`'e uyunca, sunucu yazmayı bitirince (`Connection: close`) ya da soketi kapatınca
 * döner. İstekler sırayla gönderilir: Node, reddedilen yükseltme isteğiyle aynı pakette ardına
 * eklenen (pipelining) baytları ayrıştırmaz.
 */
async function connect(app: FastifyInstance) {
  await app.ready()
  const [client, server] = duplexPair()
  Object.defineProperty(server, 'remoteAddress', { value: '203.0.113.7' })
  sockets.push(client)
  let buffer = ''
  let closed = false
  let check = () => undefined as void
  client.on('data', (chunk: Buffer) => {
    buffer += chunk.toString()
    check()
  })
  const finish = () => {
    closed = true
    check()
  }
  client.on('end', finish)
  client.on('error', () => undefined)
  server.once('close', finish)
  app.server.emit('connection', server)
  const send = (request: string, until?: RegExp) =>
    new Promise<string>((resolve) => {
      check = () => {
        if (!closed && !until?.test(buffer)) return
        const response = buffer
        buffer = ''
        resolve(response)
      }
      client.write(request)
    })
  return { send, server }
}

async function exchange(app: FastifyInstance, request: string, until?: RegExp) {
  const connection = await connect(app)
  return { response: await connection.send(request, until), server: connection.server }
}

/** Yanıt bitti: başlıklar ve JSON gövdesi, ya da boş gövde (`content-length: 0`, HEAD). */
const JSON_DONE = /\r\n\r\n\{[\s\S]*\}$/
const EMPTY_DONE = /\r\n\r\n$/

const statusLines = (response: string) => response.match(/^HTTP\/1\.1 \d{3}/gm) ?? []

describe('WebSocket yükseltmesi (D-113)', () => {
  it('upgrade olayına yalnızca GET /v1/ws ve Upgrade: websocket ayrılır', () => {
    const req = (method: string, url: string, upgrade?: string) =>
      ({ method, url, headers: upgrade === undefined ? {} : { upgrade } }) as IncomingMessage
    expect(isLiveWsUpgrade(req('GET', '/v1/ws', 'websocket'))).toBe(true)
    expect(isLiveWsUpgrade(req('GET', '/v1/ws?lastSeq=4', 'WebSocket'))).toBe(true)
    expect(isLiveWsUpgrade(req('HEAD', '/v1/ws', 'websocket'))).toBe(false)
    expect(isLiveWsUpgrade(req('POST', '/v1/ws', 'websocket'))).toBe(false)
    expect(isLiveWsUpgrade(req('GET', '/v1/ws/', 'websocket'))).toBe(false)
    expect(isLiveWsUpgrade(req('GET', '/health', 'websocket'))).toBe(false)
    expect(isLiveWsUpgrade(req('GET', '/v1/ws', 'h2c'))).toBe(false)
    expect(isLiveWsUpgrade(req('GET', '/v1/ws'))).toBe(false)
  })

  it('HEAD /v1/ws 405 ve Allow: GET alır; Upgrade’li istekte bağlantı HTTP’de kalır, hata günlüğü yok', async () => {
    const app = await fullApp()
    app.get('/boom', async () => {
      throw new Error('boom')
    })
    const error = vi.spyOn(app.log, 'error')
    const warn = vi.spyOn(app.log, 'warn')

    const connection = await connect(app)
    const head = await connection.send(
      `HEAD /v1/ws HTTP/1.1\r\n${HOST}${UPGRADE}${WS_KEY}\r\n`,
      EMPTY_DONE,
    )
    expect(statusLines(head)).toEqual(['HTTP/1.1 405'])
    expect(head).toMatch(/\r\nallow: GET\r\n/i)
    expect(head).toMatch(/\r\nconnection: keep-alive\r\n/i)
    // Aynı bağlantıdaki sonraki istek sıradan HTTP olarak yanıtlanır.
    const next = await connection.send(THEN_HEALTH)
    expect(statusLines(next)).toEqual(['HTTP/1.1 200'])
    expect(next).toMatch(/\{"status":"ok"\}$/)

    const plain = await app.inject({ method: 'HEAD', url: '/v1/ws' })
    expect(plain.statusCode).toBe(405)
    expect(plain.headers.allow).toBe('GET')

    // Merkezde soketi olmayan istemci kalmadı: kapanış her istemciye mesaj gönderir.
    await expect(closeLiveSockets()).resolves.toBeUndefined()
    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()

    // Denetim: aynı casus Fastify'ın 500 günlüğünü görür (düzeltmeden önce HEAD /v1/ws böyleydi).
    expect((await app.inject({ method: 'GET', url: '/boom' })).statusCode).toBe(500)
    expect(error).toHaveBeenCalledTimes(1)
  })

  const LOGIN_BODY = '{"email":"yonetici@example.com","password":"yanlis"}'
  it.each([
    [
      'GET /health, Upgrade: websocket',
      `GET /health HTTP/1.1\r\n${HOST}${UPGRADE}${WS_KEY}\r\n`,
      200,
    ],
    // Gövde okunur: yanıt 401'dir (yanlış parola), gövde beklenerek asılı kalmaz.
    [
      'POST /api/auth/login, Upgrade: websocket',
      `POST /api/auth/login HTTP/1.1\r\n${HOST}${UPGRADE}${WS_KEY}Content-Type: application/json\r\nContent-Length: ${LOGIN_BODY.length}\r\n\r\n${LOGIN_BODY}`,
      401,
    ],
    [
      'POST /v1/ws',
      `POST /v1/ws HTTP/1.1\r\n${HOST}${UPGRADE}${WS_KEY}Content-Length: 0\r\n\r\n`,
      404,
    ],
    ['GET /nope, Upgrade: websocket', `GET /nope HTTP/1.1\r\n${HOST}${UPGRADE}${WS_KEY}\r\n`, 404],
  ])('%s sıradan HTTP yanıtı alır, bağlantı sürer', async (_name, request, status) => {
    const app = await fullApp()
    const connection = await connect(app)
    expect(statusLines(await connection.send(request, JSON_DONE))).toEqual([`HTTP/1.1 ${status}`])
    expect(statusLines(await connection.send(THEN_HEALTH))).toEqual(['HTTP/1.1 200'])
  })

  it('GET /v1/ws, Upgrade: h2c yükseltilmez: Upgrade’siz GET gibi 404 alır', async () => {
    const app = await fullApp()
    const connection = await connect(app)
    const h2c = await connection.send(
      `GET /v1/ws HTTP/1.1\r\n${HOST}Connection: Upgrade, HTTP2-Settings\r\nUpgrade: h2c\r\nHTTP2-Settings: AAMAAABkAARAAAAAAAIAAAAA\r\n\r\n`,
      EMPTY_DONE,
    )
    expect(statusLines(h2c)).toEqual(['HTTP/1.1 404'])
    expect(statusLines(await connection.send(THEN_HEALTH))).toEqual(['HTTP/1.1 200'])
  })

  it('GET /v1/ws el sıkışması 101 alır; anahtarsız el sıkışması ws’den 400 alır', async () => {
    const app = await fullApp()
    const ok = await exchange(
      app,
      `GET /v1/ws HTTP/1.1\r\n${HOST}${UPGRADE}${WS_KEY}\r\n`,
      /\r\n\r\n/,
    )
    expect(ok.response).toMatch(/^HTTP\/1\.1 101 Switching Protocols\r\n/)

    const bad = await exchange(app, `GET /v1/ws HTTP/1.1\r\n${HOST}${UPGRADE}\r\n`)
    expect(bad.response).toMatch(/^HTTP\/1\.1 400 /)
    expect(bad.server.destroyed).toBe(true)
  })

  it('eski API host’unda (D-112) HEAD ve el sıkışması 308 alır, bağlantı kapanır', async () => {
    const app = await fullApp({
      WEB_HOST: 'airline.live',
      API_HOST: 'api.airline.live',
      LEGACY_API_HOSTS: 'api.havayolu.live',
    })
    const legacy = 'Host: api.havayolu.live\r\n'
    for (const method of ['HEAD', 'GET']) {
      const { response, server } = await exchange(
        app,
        `${method} /v1/ws?lastSeq=4 HTTP/1.1\r\n${legacy}${UPGRADE}${WS_KEY}\r\n`,
      )
      expect(statusLines(response)).toEqual(['HTTP/1.1 308'])
      expect(response).toMatch(/\r\nlocation: https:\/\/api\.airline\.live\/v1\/ws\?lastSeq=4\r\n/i)
      expect(response).toMatch(/\r\nconnection: close\r\n/i)
      // HEAD sıradan istektir: Node `Connection: close` ile yazmayı bitirir (gerçek sokette
      // `destroySoon`). El sıkışması upgrade olayındadır: kanca soketi yanıttan sonra yok eder.
      expect(method === 'HEAD' ? server.writableEnded : server.destroyed).toBe(true)
    }
  })

  it('sunucu seçeneği olmadan da (her Upgrade upgrade olayında) HEAD WebSocket işleyicisine ulaşmaz', async () => {
    const app = Fastify()
    apps.push(app)
    registerLiveWs(app, {
      source: new FakeLiveSource([aircraft('4bb001', 41.0, 29.0)], 1),
      env: parseEnv({ APP_ENV: 'test', LOG_LEVEL: 'silent' }),
      log: app.log,
      random: () => 0,
      pingIntervalMs: 5,
    })
    await app.ready()

    const plain = await app.inject({ method: 'HEAD', url: '/v1/ws' })
    expect(plain.statusCode).toBe(405)
    expect(plain.headers.allow).toBe('GET')
    // Varsayılan dağıtımda `@fastify/websocket` el sıkışmasını dener, `ws` yöntemi reddeder.
    const { response, server } = await exchange(
      app,
      `HEAD /v1/ws HTTP/1.1\r\n${HOST}${UPGRADE}${WS_KEY}\r\n`,
    )
    expect(response).toMatch(/^HTTP\/1\.1 405 /)
    expect(server.destroyed).toBe(true)

    // Soketi olmayan istemci ping turunda süreci düşürürdü (zamanlayıcıda yakalanmayan TypeError).
    await new Promise((resolve) => setTimeout(resolve, 30))
    await expect(closeLiveSockets()).resolves.toBeUndefined()
  })
})
