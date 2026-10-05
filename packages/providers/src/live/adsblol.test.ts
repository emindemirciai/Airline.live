import { readFileSync } from 'node:fs'
import { createServer, type IncomingHttpHeaders, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AdsbLolError,
  chunkHexes,
  createAdsbLolClient,
  MAX_HEX_PER_CALL,
  providerUserAgent,
} from './adsblol'
import { MAX_RETRY_AFTER_SEC, parseRetryAfter } from './http'
import { createLocalReceiverClient, parseReceiverUrls, ReceiverConfigError } from './local-receiver'

// Stub HTTP sunucusu (yerel); canlı adsb.lol'e istek atılmaz.
const pointFixture = readFileSync(
  new URL('../../../../tools/fixtures/adsblol/point-ltfm-40nm.json', import.meta.url),
)
/** Fixture'ın ölçüm anı: istemcinin saat kayması denetimi için test saati buna sabitlenir. */
const FIXTURE_NOW = (JSON.parse(pointFixture.toString()) as { now: number }).now

interface Seen {
  path: string
  headers: IncomingHttpHeaders
}

type Reply =
  | { status: number; body?: string | Buffer; headers?: Record<string, string> }
  /** Başlıkları yazar, gövdeyi hiç bitirmez (zaman aşımı testi). */
  | 'hang-body'
  /** Hiç yanıt vermez. */
  | 'hang'

const servers: Server[] = []
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections()
    await new Promise((r) => server.close(r))
  }
})

async function stub(reply: (path: string) => Reply) {
  const seen: Seen[] = []
  const server = createServer((req, res: ServerResponse) => {
    const path = req.url ?? '/'
    seen.push({ path, headers: req.headers })
    const r = reply(path)
    if (r === 'hang') return
    if (r === 'hang-body') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.write('{"now":')
      return
    }
    res.writeHead(r.status, r.headers).end(r.body)
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen }
}

/** Kapalı bir yerel port (gerçek bağlantı reddi; fetch'in "bad port" listesine takılmaz). */
async function closedPort(): Promise<string> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  await new Promise((r) => server.close(r))
  return `http://127.0.0.1:${port}`
}

const identity = {
  appName: 'havayolu',
  version: '0.6.0',
  webHost: 'havayolu.live',
  contactEmail: 'iletisim@example.test',
  dataUsageMode: 'commercial' as const,
  now: () => FIXTURE_NOW,
}

const json = (body: Buffer | string): Reply => ({
  status: 200,
  body: gzipSync(body),
  headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' },
})

describe('providerUserAgent', () => {
  it('data-sources.md biçimi: site adresi ve iletişim; yerelde mailto', () => {
    expect(providerUserAgent(identity)).toBe(
      'havayolu/0.6.0 (+https://havayolu.live; iletisim@example.test)',
    )
    expect(providerUserAgent({ ...identity, webHost: '' })).toBe(
      'havayolu/0.6.0 (+mailto:iletisim@example.test)',
    )
    expect(providerUserAgent({ ...identity, contactEmail: null })).toBe(
      'havayolu/0.6.0 (+https://havayolu.live)',
    )
  })
})

describe('adsb.lol istemcisi', () => {
  it('gzip yanıtı açar; User-Agent, gzip ve API anahtarı başlığını gönderir', async () => {
    const server = await stub(() => json(pointFixture))
    const client = createAdsbLolClient({
      ...identity,
      baseUrl: server.base,
      apiKey: 'anahtar-degeri',
      apiKeyHeader: 'api-auth',
    })
    const result = await client.point(41.2749, 28.7321, 40)
    expect(result.aircraft.length).toBeGreaterThan(0)
    expect(server.seen[0]?.path).toBe('/v2/point/41.2749/28.7321/40')
    expect(server.seen[0]?.headers).toMatchObject({
      'user-agent': 'havayolu/0.6.0 (+https://havayolu.live; iletisim@example.test)',
      'accept-encoding': 'gzip',
      'api-auth': 'anahtar-degeri',
    })
  })

  it('sorgu yolları: hex, çağrı kodu, tescil; negatif ve küçük koordinatlar', async () => {
    const server = await stub(() => json(pointFixture))
    const client = createAdsbLolClient({ ...identity, baseUrl: server.base })
    await client.hex(['4B8750', '4bb872', '~2a4f10', '4b8750', 'bozuk!'])
    await client.callsign(['thy1kq', 'PGT4XF'])
    await client.registration(['tc-azp'])
    await client.point(-33.94, -0.00001, 10)
    expect(server.seen.map((s) => s.path)).toEqual([
      '/v2/hex/4b8750,4bb872',
      '/v2/callsign/THY1KQ,PGT4XF',
      '/v2/reg/TC-AZP',
      '/v2/point/-33.94/0/10',
    ])
    expect(server.seen[0]?.headers['api-auth']).toBeUndefined()
  })

  it('hata sınıfları: 401/403 yapılandırma, 429/420 kısıtlama, 5xx sunucu, diğer 4xx ve 3xx istek', async () => {
    const html = '<html><head><title>429 Too Many Requests</title></head><body>nginx</body></html>'
    let reply: Reply = { status: 200 }
    const server = await stub(() => reply)
    const client = createAdsbLolClient({ ...identity, baseUrl: server.base })
    const cases: [Reply, AdsbLolError['kind']][] = [
      [{ status: 401, body: 'Unauthorized' }, 'config'],
      [{ status: 403, body: 'User-Agent too generic' }, 'config'],
      [{ status: 429, body: html, headers: { 'content-type': 'text/html' } }, 'rate_limit'],
      [{ status: 420 }, 'rate_limit'],
      [{ status: 500, body: 'oops' }, 'server'],
      [{ status: 502, body: 'bad gateway' }, 'server'],
      [{ status: 404, body: 'not found' }, 'request'],
      [{ status: 302, headers: { location: 'http://127.0.0.1:1/baska' } }, 'request'],
    ]
    for (const [r, kind] of cases) {
      reply = r
      const status = typeof r === 'object' ? r.status : 0
      const error = await client.point(41, 29, 10).catch((e: unknown) => e)
      expect(error, `HTTP ${status}`).toBeInstanceOf(AdsbLolError)
      expect(error, `HTTP ${status}`).toMatchObject({ kind, status })
    }
    reply = { status: 403, body: 'User-Agent too generic' }
    await expect(client.point(41, 29, 10)).rejects.toThrow(/User-Agent too generic/)
  })

  it('Retry-After yalnızca varsa kullanılır: saniye ya da HTTP tarihi, en fazla 300 sn', async () => {
    let headers: Record<string, string> = {}
    const server = await stub(() => ({ status: 429, headers }))
    const client = createAdsbLolClient({ ...identity, baseUrl: server.base })
    const retryAfter = async () =>
      ((await client.point(41, 29, 10).catch((e: unknown) => e)) as AdsbLolError).retryAfterSec
    expect(await retryAfter()).toBeNull()
    headers = { 'retry-after': '30' }
    expect(await retryAfter()).toBe(30)
    headers = { 'retry-after': '86400' }
    expect(await retryAfter()).toBe(MAX_RETRY_AFTER_SEC)
    headers = { 'retry-after': new Date(FIXTURE_NOW + 45_000).toUTCString() }
    expect(await retryAfter()).toBe(45)
    expect(parseRetryAfter('yarın', FIXTURE_NOW)).toBeNull()
  })

  it('ağ: kapalı port, yanıtsız sunucu ve gövdesi bitmeyen yanıt ağ hatasıdır (zaman aşımı)', async () => {
    const offline = createAdsbLolClient({ ...identity, baseUrl: await closedPort() })
    await expect(offline.point(41, 29, 10)).rejects.toMatchObject({ kind: 'network' })
    for (const mode of ['hang', 'hang-body'] as const) {
      const server = await stub(() => mode)
      const client = createAdsbLolClient({ ...identity, baseUrl: server.base, timeoutMs: 150 })
      await expect(client.point(41, 29, 10), mode).rejects.toMatchObject({ kind: 'network' })
    }
  })

  it('yanıt biçimi: HTML, zarfsız JSON, çok büyük gövde ve saati kaymış yanıt', async () => {
    let reply: Reply = { status: 200, body: '<html>bakım</html>' }
    const server = await stub(() => reply)
    const client = createAdsbLolClient({ ...identity, baseUrl: server.base })
    await expect(client.point(41, 29, 10)).rejects.toMatchObject({ kind: 'response' })
    reply = json(JSON.stringify({ ac: [] }))
    await expect(client.point(41, 29, 10)).rejects.toMatchObject({ kind: 'response' })
    reply = { status: 200, headers: { 'content-length': String(64 * 1024 * 1024) }, body: '' }
    await expect(client.point(41, 29, 10)).rejects.toThrow(/çok büyük/)
    const skewed = createAdsbLolClient({
      ...identity,
      baseUrl: server.base,
      now: () => FIXTURE_NOW + 5 * 60_000,
    })
    reply = json(pointFixture)
    await expect(skewed.point(41, 29, 10)).rejects.toThrow(/saati -300 sn kaymış/)
  })

  it('geçersiz sorgular istek atılmadan reddedilir', async () => {
    const server = await stub(() => json(pointFixture))
    const client = createAdsbLolClient({ ...identity, baseUrl: server.base })
    for (const call of [
      () => client.point(41, 29, 251),
      () => client.point(41, 29, 10.5),
      () => client.point(91, 29, 10),
      () => client.hex(['~2a4f10', 'xyz']),
      () => client.callsign(['THY 1']),
      () => client.registration(['TC/ABC']),
    ]) {
      await expect(call()).rejects.toMatchObject({ kind: 'request' })
    }
    expect(server.seen).toEqual([])
  })

  it('iletişim adresi, anahtar başlığı ya da geçerli başlık değerleri yoksa istemci kurulmaz', () => {
    const config = (patch: Record<string, string>) => () =>
      createAdsbLolClient({ ...identity, ...patch })
    expect(config({ contactEmail: '' })).toThrow(/CONTACT_EMAIL/)
    expect(config({ apiKey: 'x' })).toThrow(/API_KEY_HEADER/)
    expect(config({ apiKey: 'x', apiKeyHeader: 'X-Api-Key:' })).toThrow(AdsbLolError)
    expect(config({ apiKey: 'anahtar\r\nx: y', apiKeyHeader: 'api-auth' })).toThrow(/geçersiz/)
    try {
      config({ apiKey: 'gizli\nanahtar', apiKeyHeader: 'api-auth' })()
    } catch (error) {
      expect((error as Error).message).not.toContain('gizli')
    }
  })

  it('chunkHexes: 500 sınırı, tekrarlar, ICAO dışı ve bozuk değerler', () => {
    const many = Array.from({ length: 1_201 }, (_, i) => i.toString(16).padStart(6, '0'))
    const chunks = chunkHexes([...many, '~abcdef', 'zzzzzz', '12345', many[0] ?? ''])
    expect(chunks.map((c) => c.length)).toEqual([MAX_HEX_PER_CALL, MAX_HEX_PER_CALL, 201])
    expect(chunks.flat()).not.toContain('~abcdef')
    expect(chunks.flat()).not.toContain('zzzzzz')
  })
})

describe('yerel alıcı (readsb aircraft.json)', () => {
  const readsbNow = 1_790_498_951.5
  const readsb = (now = readsbNow) =>
    JSON.stringify({
      now,
      messages: 10,
      aircraft: [{ hex: '4b8750', lat: 41.2, lon: 28.7, alt_baro: 'ground', seen_pos: 0.5 }],
    })

  it('LOCAL_RECEIVER_URLS: adres|token listesi; hatalar girdiyi (token) yazmaz', () => {
    expect(parseReceiverUrls('')).toEqual([])
    expect(
      parseReceiverUrls(' http://10.0.0.5/data/aircraft.json , https://alici.test/a.json|gizli-1 '),
    ).toEqual([
      { url: 'http://10.0.0.5/data/aircraft.json', token: null },
      { url: 'https://alici.test/a.json', token: 'gizli-1' },
    ])
    expect(() => parseReceiverUrls('ftp://x/a.json')).toThrow(ReceiverConfigError)
    expect(() => parseReceiverUrls('https://u:p@x/a.json')).toThrow(/token/)
    for (const input of ['https://a.test/x.json|abc,def123gizli', 'https://a.test/x.json|ab cd']) {
      const error = (() => {
        try {
          parseReceiverUrls(input)
        } catch (e) {
          return e as Error
        }
        return null
      })()
      expect(error, input).toBeInstanceOf(ReceiverConfigError)
      expect(error?.message).not.toMatch(/gizli|ab cd/)
    }
  })

  it('alıcıları okur (now saniye), token gönderir; sağlık metriği tutar ve düzelince sıfırlar', async () => {
    let failing = true
    const good = await stub(() => ({ status: 200, body: readsb() }))
    const flaky = await stub(() =>
      failing ? { status: 502, body: 'bad gateway' } : { status: 200, body: readsb() },
    )
    let clock = readsbNow * 1000
    const client = createLocalReceiverClient({
      receivers: parseReceiverUrls(
        `${good.base}/data/aircraft.json|alici-anahtari,${flaky.base}/x`,
      ),
      dataUsageMode: 'commercial',
      userAgent: 'havayolu/0.6.0',
      now: () => clock,
    })
    expect(client.enabled).toBe(true)
    const [ok, failed] = await client.fetchAll()
    expect(ok?.response?.aircraft[0]).toMatchObject({
      hex: '4b8750',
      onGround: true,
      dbFlags: null,
      sampleTime: 1_790_498_951_000,
      seenPosS: 0.5,
      baroRateFpm: null,
      source: 'localReceiver',
    })
    expect(good.seen[0]?.headers.authorization).toBe('Bearer alici-anahtari')
    expect(failed).toMatchObject({ ok: false, error: 'HTTP 502' })
    clock += 1_000
    await client.fetchAll()
    expect(client.health()[1]).toMatchObject({ consecutiveFailures: 2, lastSuccessAt: null })
    failing = false
    clock += 1_000
    await client.fetchAll()
    expect(client.health()[1]).toMatchObject({ consecutiveFailures: 0, lastSuccessAt: clock })
    expect(client.health()[0]).toMatchObject({ lastAircraftCount: 1, consecutiveFailures: 0 })
    expect(JSON.stringify(client.health())).not.toContain('alici-anahtari')
  })

  it('donmuş aircraft.json (eski now) ve zaman aşımı başarısızlık sayılır; metinler sabit sözlükten', async () => {
    const frozen = await stub(() => ({ status: 200, body: readsb() }))
    const hung = await stub(() => 'hang')
    const client = createLocalReceiverClient({
      receivers: parseReceiverUrls(`${frozen.base}/a.json|gizli-anahtar,${hung.base}/b.json`),
      dataUsageMode: 'commercial',
      userAgent: 'havayolu/0.6.0',
      timeoutMs: 150,
      now: () => readsbNow * 1000 + 10 * 60_000,
    })
    const [stale, timeout] = await client.fetchAll()
    expect(stale).toMatchObject({ ok: false, error: 'yanıt biçimi ya da saati hatalı' })
    expect(timeout).toMatchObject({ ok: false, error: 'zaman aşımı' })
    expect(JSON.stringify(client.health())).not.toContain('gizli-anahtar')
  })
})
