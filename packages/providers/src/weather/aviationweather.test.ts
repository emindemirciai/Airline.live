import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AVIATIONWEATHER_BASE_URL,
  AWC_MAX_ENTRIES,
  AWC_MAX_RETRY_AFTER_SEC,
  AWC_METAR_MAX_HOURS,
  AWC_METAR_PER_STATION_HOUR,
  AviationWeatherError,
  awcRetryAfter,
  createAviationWeatherClient,
  normalizeStationIds,
} from './aviationweather'

// Stub fetch ve yerel stub HTTP sunucusu; aviationweather.gov'a istek atılmaz.
const fixtureText = (name: string) =>
  readFileSync(new URL(`../../../../tools/fixtures/weather/${name}`, import.meta.url), 'utf8')
const FIXTURE_NOW = Date.parse(
  (JSON.parse(fixtureText('index.json')) as { fixtureNow: string }).fixtureNow,
)
const metarFixture = fixtureText('metar.json')
const tafFixture = fixtureText('taf.json')

const USER_AGENT = 'havayolu/0.11.0 (+https://havayolu.live; iletisim@example.test)'
const STATIONS = ['LTFM', 'LTBA', 'LTAC', 'LTBQ']

interface Call {
  url: string
  init: RequestInit
}

function stubFetch(respond: (url: URL, call: number) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    return respond(new URL(String(input)), calls.length)
  }) as typeof globalThis.fetch
  return { fetch, calls }
}

const json = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  })

const client = (fetch: typeof globalThis.fetch, extra: { timeoutMs?: number } = {}) =>
  createAviationWeatherClient({ userAgent: USER_AGENT, fetch, now: () => FIXTURE_NOW, ...extra })

async function failure(promise: Promise<unknown>): Promise<AviationWeatherError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof AviationWeatherError) return error
    throw error
  }
  throw new Error('hata bekleniyordu')
}

describe('istek biçimi', () => {
  it('METAR: düz virgüllü istasyon listesi, format=json, hours=2; belgelenmemiş parametre yok', async () => {
    const { fetch, calls } = stubFetch(() => json(metarFixture, { 'cache-control': 'max-age=60' }))
    const result = await client(fetch).metars([' ltfm', 'LTBA', 'LTFM', 'LTAC', 'LTBQ'])
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(
      `${AVIATIONWEATHER_BASE_URL}/metar?ids=LTFM,LTBA,LTAC,LTBQ&format=json&hours=2`,
    )
    expect(calls[0]?.init.redirect).toBe('manual')
    expect(calls[0]?.init.headers).toMatchObject({
      'user-agent': USER_AGENT,
      accept: 'application/json',
    })
    expect(result.status).toBe(200)
    expect(result.cacheControl).toBe('max-age=60')
    expect(result.requests).toBe(1)
    expect(result.truncated).toBe(false)
    // Listede olmayan istasyonların raporları atlanır.
    expect(new Set(result.items.map((m) => m.station))).toEqual(new Set(['LTFM', 'LTBA', 'LTAC']))
    expect(result.items.filter((m) => m.station === 'LTFM')).toHaveLength(146)
    expect(result.entryCount).toBe(159)
    expect(result.skipped.filter((s) => s.reason === 'unlisted_station')).toHaveLength(11)
  })

  it('TAF: hours gönderilmez (bu uçta yoktur)', async () => {
    const { fetch, calls } = stubFetch(() => json(tafFixture))
    const result = await client(fetch).tafs(STATIONS)
    expect(calls[0]?.url).toBe(
      `${AVIATIONWEATHER_BASE_URL}/taf?ids=LTFM,LTBA,LTAC,LTBQ&format=json`,
    )
    expect(result.items.filter((t) => t.station === 'LTFM')).toHaveLength(13)
    expect(result.items.some((t) => t.station === 'LTBQ')).toBe(false)
  })

  it('geçersiz istasyon kodu, boş liste ya da geçersiz hours istek atılmadan reddedilir', async () => {
    const { fetch, calls } = stubFetch(() => json('[]'))
    const awc = client(fetch)
    expect((await failure(awc.metars(['LTFM', 'LT;M']))).kind).toBe('request')
    expect((await failure(awc.metars(['  ']))).kind).toBe('request')
    expect((await failure(awc.metars(['LTFM'], { hours: 0 }))).kind).toBe('request')
    expect((await failure(awc.metars(['LTFM'], { hours: 1.5 }))).kind).toBe('request')
    expect((await failure(awc.metars(['LTFM'], { hours: AWC_METAR_MAX_HOURS + 1 }))).kind).toBe(
      'request',
    )
    expect(
      (
        await failure(
          awc.tafs(Array.from({ length: 201 }, (_, i) => `K${String(i).padStart(3, '0')}`)),
        )
      ).kind,
    ).toBe('request')
    expect(calls).toHaveLength(0)
    expect(normalizeStationIds(['ltfm', 'LTFM ', 'ltba'])).toEqual(['LTFM', 'LTBA'])
  })

  it('User-Agent boş ya da geçersizse istemci kurulmaz', () => {
    expect(() => createAviationWeatherClient({ userAgent: ' ' })).toThrow(AviationWeatherError)
    expect(() => createAviationWeatherClient({ userAgent: 'havayolu\n/1' })).toThrow(
      /geçersiz karakter/,
    )
  })
})

describe('durum kodları', () => {
  it('204: veri yok; gövde ayrıştırılmaz', async () => {
    const { fetch } = stubFetch(() => new Response(null, { status: 204 }))
    const result = await client(fetch).metars(STATIONS)
    expect(result).toMatchObject({ status: 204, items: [], skipped: [], entryCount: 0 })
  })

  it('200 ve boş gövde veri yok sayılır', async () => {
    const { fetch } = stubFetch(() => json(''))
    expect((await client(fetch).tafs(STATIONS)).items).toEqual([])
  })

  it('400: JSON hata gövdesindeki ileti raporlanır', async () => {
    const { fetch } = stubFetch(
      () =>
        new Response(JSON.stringify({ status: 'error', error: 'Invalid parameter: hours' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    )
    const error = await failure(client(fetch).tafs(STATIONS))
    expect(error).toMatchObject({ kind: 'request', status: 400 })
    expect(error.message).toContain('Invalid parameter: hours')
  })

  it('403 erişim engeli, 404 istek hatası, 5xx sunucu hatası', async () => {
    const cases: [number, string][] = [
      [403, 'forbidden'],
      [404, 'request'],
      [500, 'server'],
      [503, 'server'],
    ]
    for (const [status, kind] of cases) {
      const { fetch } = stubFetch(() => new Response('<html>hata</html>', { status }))
      expect(await failure(client(fetch).metars(STATIONS))).toMatchObject({ kind, status })
    }
  })

  it('429: Retry-After saniye ya da tarih olarak okunur; yoksa null', async () => {
    const reply = (headers: Record<string, string>) =>
      stubFetch(() => new Response('Too Many Requests', { status: 429, headers })).fetch
    expect(await failure(client(reply({ 'retry-after': '120' })).metars(STATIONS))).toMatchObject({
      kind: 'rate_limit',
      status: 429,
      retryAfterSec: 120,
    })
    const date = new Date(FIXTURE_NOW + 900_000).toUTCString()
    expect(
      (await failure(client(reply({ 'retry-after': date })).metars(STATIONS))).retryAfterSec,
    ).toBe(900)
    expect((await failure(client(reply({})).metars(STATIONS))).retryAfterSec).toBeNull()
    expect(awcRetryAfter('86400')).toBe(AWC_MAX_RETRY_AFTER_SEC)
    expect(awcRetryAfter('0')).toBeNull()
    expect(awcRetryAfter('yarın')).toBeNull()
  })

  it('3xx yönlendirme izlenmez, istek hatasıdır', async () => {
    const { fetch } = stubFetch(
      () => new Response(null, { status: 302, headers: { location: 'https://example.test/' } }),
    )
    expect(await failure(client(fetch).metars(STATIONS))).toMatchObject({
      kind: 'request',
      status: 302,
    })
  })

  it('JSON olmayan içerik türü, bozuk JSON ve dizi olmayan gövde yanıt hatasıdır', async () => {
    const bodies = [
      new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      json('[{"icaoId":'),
      json('{"status":"error"}'),
    ]
    for (const body of bodies) {
      const { fetch } = stubFetch(() => body)
      expect((await failure(client(fetch).metars(STATIONS))).kind).toBe('response')
    }
  })

  it('ağ hatası network olarak sınıflanır', async () => {
    const fetch = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof globalThis.fetch
    expect(await failure(client(fetch).metars(STATIONS))).toMatchObject({
      kind: 'network',
      status: null,
    })
  })
})

describe('boyut sınırı ve zaman aşımı (yerel stub sunucu)', () => {
  const servers: Server[] = []
  afterEach(async () => {
    for (const server of servers.splice(0)) {
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
    }
  })

  async function serve(handler: Parameters<typeof createServer>[1]) {
    const server = createServer(handler)
    servers.push(server)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  }

  it('sınırı aşan gövde yanıt hatasıdır', async () => {
    const baseUrl = await serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(`[${'"x",'.repeat(2_000)}"x"]`)
    })
    const awc = createAviationWeatherClient({ userAgent: USER_AGENT, baseUrl, maxBodyBytes: 1_000 })
    expect(await failure(awc.metars(STATIONS))).toMatchObject({ kind: 'response', status: 200 })
  })

  it('gövdesi gelmeyen yanıt zaman aşımında network hatasıdır', async () => {
    const baseUrl = await serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.write('[')
    })
    const awc = createAviationWeatherClient({ userAgent: USER_AGENT, baseUrl, timeoutMs: 200 })
    expect(await failure(awc.tafs(STATIONS))).toMatchObject({ kind: 'network' })
  })

  it('gerçek HTTP üzerinden User-Agent ve sorgu gider', async () => {
    let seen: { url?: string; ua?: string } = {}
    const baseUrl = await serve((req, res) => {
      seen = { url: req.url, ua: req.headers['user-agent'] }
      res.writeHead(204).end()
    })
    const awc = createAviationWeatherClient({ userAgent: USER_AGENT, baseUrl: `${baseUrl}/` })
    expect((await awc.metars(['LTFM', 'LTBA'])).status).toBe(204)
    expect(seen).toEqual({ url: '/metar?ids=LTFM,LTBA&format=json&hours=2', ua: USER_AGENT })
  })
})

describe('400 kayıt sınırı', () => {
  const entries = (ids: string[], count: number) =>
    JSON.stringify(
      Array.from({ length: count }, (_, i) => {
        const id = ids[i % ids.length] ?? 'LTFM'
        const minute = String(i % 60).padStart(2, '0')
        return {
          icaoId: id,
          obsTime: FIXTURE_NOW / 1000 - 600 - i * 60,
          rawOb: `${id} 1512${minute}Z 00000KT 9999 Q1010`,
        }
      }),
    )

  it('sınıra ulaşan yanıtta liste ikiye bölünür ve sonuçlar birleşir', async () => {
    const { fetch, calls } = stubFetch((url) => {
      const ids = url.searchParams.get('ids')?.split(',') ?? []
      return json(entries(ids, ids.length === 4 ? AWC_MAX_ENTRIES : 10))
    })
    const result = await client(fetch).metars(STATIONS)
    expect(calls.map((c) => new URL(c.url).searchParams.get('ids'))).toEqual([
      'LTFM,LTBA,LTAC,LTBQ',
      'LTFM,LTBA',
      'LTAC,LTBQ',
    ])
    expect(result).toMatchObject({ requests: 3, truncated: false, entryCount: 20 })
    expect(result.items).toHaveLength(20)
  })

  it('uzun geriye bakış (kesinti sonrası doldurma): liste 400 kayıt sınırına göre baştan gruplanır', async () => {
    const ids = Array.from(
      { length: 61 },
      (_, i) =>
        `LT${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`,
    )
    const { fetch, calls } = stubFetch(() => json('[]'))
    await client(fetch).metars(ids, { hours: AWC_METAR_MAX_HOURS })
    const perRequest = Math.floor(
      AWC_MAX_ENTRIES / (AWC_METAR_MAX_HOURS * AWC_METAR_PER_STATION_HOUR),
    )
    expect(perRequest).toBe(6)
    expect(calls).toHaveLength(Math.ceil(61 / perRequest))
    const sent = calls.map((c) => new URL(c.url).searchParams)
    expect(sent.every((q) => q.get('hours') === String(AWC_METAR_MAX_HOURS))).toBe(true)
    expect(sent.every((q) => (q.get('ids')?.split(',').length ?? 0) <= perRequest)).toBe(true)
    expect(sent.flatMap((q) => q.get('ids')?.split(',') ?? [])).toEqual(ids)
    // Olağan 2 saatlik istek 61 istasyon için tektir.
    const usual = stubFetch(() => json('[]'))
    await client(usual.fetch).metars(ids)
    expect(usual.calls).toHaveLength(1)
  })

  it('en fazla iki düzey bölünür; yine sınırdaysa eksik olabileceği bildirilir', async () => {
    const { fetch, calls } = stubFetch((url) => {
      const ids = url.searchParams.get('ids')?.split(',') ?? []
      return json(entries(ids, AWC_MAX_ENTRIES))
    })
    const result = await client(fetch).metars(STATIONS)
    expect(calls).toHaveLength(7)
    expect(result.truncated).toBe(true)
    // Tek istasyonluk liste bölünemez.
    const single = stubFetch(() => json(entries(['LTFM'], AWC_MAX_ENTRIES)))
    const one = await client(single.fetch).metars(['LTFM'])
    expect(single.calls).toHaveLength(1)
    expect(one.truncated).toBe(true)
  })
})
