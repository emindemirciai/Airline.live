import { AdsbLolError, createAdsbLolClient } from '@havayolu/providers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertAllowedBaseUrl,
  createLiveFetch,
  LIVE_GAP_TOLERANCE_MS,
  LIVE_MIN_GAP_MS,
  LiveGuardError,
  pointPath,
} from './guard'
import {
  FakeClock,
  fixturePointFrame,
  jsonReply,
  localOnlyFetch,
  nginx429Reply,
  startAdsbLolStub,
  type AdsbLolStub,
} from './test/adsblol-stub'

const LTFM_PATH = '/v2/point/41.2749/28.7321/40'
const UA = { 'user-agent': 'havayolu/0.0.0-test (+mailto:ops@example.org)' }
const GET_INIT: RequestInit = { headers: UA, redirect: 'manual' }

const stubs: AdsbLolStub[] = []
afterEach(async () => {
  await Promise.all(stubs.splice(0).map((s) => s.close()))
})

async function setup(opts: { gzip?: boolean; captureBodies?: boolean } = {}) {
  const clock = new FakeClock()
  const stub = await startAdsbLolStub(
    (req) =>
      req.path.startsWith('/v2/point/')
        ? jsonReply(fixturePointFrame(clock.now()), { gzip: opts.gzip ?? false })
        : nginx429Reply(),
    { now: clock.now },
  )
  stubs.push(stub)
  const inner = vi.fn(localOnlyFetch)
  const guard = createLiveFetch({
    baseUrl: stub.baseUrl,
    now: clock.now,
    fetch: inner,
    captureBodies: opts.captureBodies ?? false,
  })
  return { clock, stub, inner, guard }
}

describe('vitest kurulumu', () => {
  it('global fetch yalnızca yerel adrese gider (ağa çıkmadan hata)', async () => {
    expect(globalThis.fetch).toBe(localOnlyFetch)
    // TEST-NET-1 (192.0.2.0/24, belgeleme aralığı): sarmalayıcı bağlantı denemeden reddeder.
    await expect(localOnlyFetch('http://192.0.2.1/v2/point/1/1/1')).rejects.toThrow(/non-local/)
    await expect(fetch(new URL('https://192.0.2.1/'))).rejects.toThrow(/non-local/)
    await expect(fetch('file:///etc/passwd')).rejects.toThrow(/non-local/)
  })
})

describe('pointPath ve sabitler', () => {
  it('istemciyle aynı 4 ondalık biçim', () => {
    expect(pointPath(41.274874, 28.732136, 40)).toBe(LTFM_PATH)
    expect(pointPath(40, 29.5, 250)).toBe('/v2/point/40/29.5/250')
    expect(pointPath(-0.00001, 0, 1)).toBe('/v2/point/0/0/1')
    expect(pointPath(-33.94608, 151.177002, 5)).toBe('/v2/point/-33.9461/151.177/5')
    expect(LIVE_MIN_GAP_MS).toBe(5000)
    expect(LIVE_GAP_TOLERANCE_MS).toBe(250)
  })
})

describe('assertAllowedBaseUrl', () => {
  it('yalnızca canlı adsb.lol ve 127.0.0.1:<port>', () => {
    for (const url of ['https://api.adsb.lol', 'https://api.adsb.lol/', 'http://127.0.0.1:4301']) {
      expect(() => assertAllowedBaseUrl(url)).not.toThrow()
    }
    for (const url of [
      'http://api.adsb.lol',
      'https://api.adsb.lol/v2',
      'https://api.adsb.lol?x=1',
      'https://user:pw@api.adsb.lol',
      'https://adsb.lol',
      'https://api.adsb.lol.example',
      'http://localhost:4300',
      'http://127.0.0.1',
      'https://127.0.0.1:4301',
      'ayrıştırılamaz',
    ]) {
      expect(() => assertAllowedBaseUrl(url)).toThrow(LiveGuardError)
    }
    expect(() =>
      createLiveFetch({ baseUrl: 'https://evil.example', now: () => 0, fetch: localOnlyFetch }),
    ).toThrow(LiveGuardError)
  })
})

describe('createLiveFetch', () => {
  it('izinli nokta sorgusu geçer ve kaydedilir', async () => {
    const { clock, stub, inner, guard } = await setup()
    const res = await guard.fetch(`${stub.baseUrl}${LTFM_PATH}`, GET_INIT)
    expect(res.status).toBe(200)
    await res.text()
    expect(inner).toHaveBeenCalledTimes(1)
    expect(guard.violation()).toBeNull()
    expect(guard.requests()).toEqual([
      expect.objectContaining({ path: LTFM_PATH, startedAt: clock.now(), status: 200 }),
    ])
    expect(stub.requests.map((r) => r.path)).toEqual([LTFM_PATH])
    expect(stub.requests[0]?.headers['user-agent']).toBe(UA['user-agent'])
  })

  const violations: [string, (base: string) => [string, RequestInit], RegExp][] = [
    ['başka host', () => ['http://192.0.2.1' + LTFM_PATH, GET_INIT], /taban adresin dışında/],
    ['/v2/hex', (b) => [`${b}/v2/hex/4b8750`, GET_INIT], /\/v2\/point dışında/],
    ['/v2/all', (b) => [`${b}/v2/all`, GET_INIT], /\/v2\/point dışında/],
    ['/v2/mil', (b) => [`${b}/v2/mil`, GET_INIT], /\/v2\/point dışında/],
    ['/v2/ladd', (b) => [`${b}/v2/ladd`, GET_INIT], /\/v2\/point dışında/],
    ['/api/0/routeset', (b) => [`${b}/api/0/routeset`, GET_INIT], /\/v2\/point dışında/],
    ['/api/0/route', (b) => [`${b}/api/0/route/THY1`, GET_INIT], /\/v2\/point dışında/],
    ['sorgu dizesi', (b) => [`${b}${LTFM_PATH}?x=1`, GET_INIT], /\/v2\/point dışında/],
    ['yarıçap 4 hane', (b) => [`${b}/v2/point/41/28/1000`, GET_INIT], /\/v2\/point dışında/],
    ['POST', (b) => [`${b}${LTFM_PATH}`, { ...GET_INIT, method: 'POST' }], /GET dışında/],
    ['redirect follow', (b) => [`${b}${LTFM_PATH}`, { headers: UA, redirect: 'follow' }], /manual/],
    ['redirect yok', (b) => [`${b}${LTFM_PATH}`, { headers: UA }], /manual/],
    ['UA yok', (b) => [`${b}${LTFM_PATH}`, { redirect: 'manual' }], /User-Agent yok/],
    [
      'boş UA',
      (b) => [`${b}${LTFM_PATH}`, { ...GET_INIT, headers: { 'user-agent': ' ' } }],
      /User-Agent yok/,
    ],
  ]

  for (const [name, request, reason] of violations) {
    it(`ihlal: ${name} (istek gönderilmez, bekçi kilitlenir)`, async () => {
      const { stub, inner, guard } = await setup()
      const [url, init] = request(stub.baseUrl)
      await expect(guard.fetch(url, init)).rejects.toThrow(LiveGuardError)
      expect(guard.violation()).toMatch(reason)
      expect(inner).not.toHaveBeenCalled()
      expect(stub.requests).toEqual([])
      // Kilit: geçerli istek de alttaki fetch'e gitmez.
      await expect(guard.fetch(`${stub.baseUrl}${LTFM_PATH}`, GET_INIT)).rejects.toMatchObject({
        reason: 'latched',
      })
      expect(inner).not.toHaveBeenCalled()
      expect(guard.violation()).toMatch(reason)
    })
  }

  it('aralık: 5000 ve 4999 ms geçer, 4700 ms ihlaldir', async () => {
    const { clock, stub, inner, guard } = await setup()
    const url = `${stub.baseUrl}${LTFM_PATH}`
    await (await guard.fetch(url, GET_INIT)).text()
    clock.advance(5000)
    await (await guard.fetch(url, GET_INIT)).text()
    clock.advance(4999)
    await (await guard.fetch(url, GET_INIT)).text()
    expect(guard.violation()).toBeNull()
    clock.advance(4700)
    await expect(guard.fetch(url, GET_INIT)).rejects.toMatchObject({ reason: 'gap' })
    expect(guard.violation()).toMatch(/5 sn/)
    expect(inner).toHaveBeenCalledTimes(3)
    expect(guard.requests().map((r) => r.startedAt - clock.current)).toEqual([-14699, -9699, -4700])
    clock.advance(10_000)
    await expect(guard.fetch(url, GET_INIT)).rejects.toMatchObject({ reason: 'latched' })
    expect(inner).toHaveBeenCalledTimes(3)
  })

  it('kısa aralık eşiği minGapMs − 250 ms (özel minGapMs ile)', async () => {
    const { clock, stub } = await setup()
    const guard = createLiveFetch({
      baseUrl: stub.baseUrl,
      now: clock.now,
      fetch: localOnlyFetch,
      minGapMs: 1000,
    })
    const url = `${stub.baseUrl}${LTFM_PATH}`
    await (await guard.fetch(url, GET_INIT)).text()
    clock.advance(750)
    await (await guard.fetch(url, GET_INIT)).text()
    clock.advance(749)
    await expect(guard.fetch(url, GET_INIT)).rejects.toThrow(LiveGuardError)
  })

  it('ağ hatası kaydedilir (durum null) ve olduğu gibi fırlar; bekçi ihlali sayılmaz', async () => {
    const { clock, stub } = await setup()
    const failing = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    const guard = createLiveFetch({ baseUrl: stub.baseUrl, now: clock.now, fetch: failing })
    await expect(guard.fetch(`${stub.baseUrl}${LTFM_PATH}`, GET_INIT)).rejects.toThrow(
      'fetch failed',
    )
    expect(guard.violation()).toBeNull()
    expect(guard.requests()).toEqual([
      { path: LTFM_PATH, startedAt: clock.now(), status: null, durationMs: 0, bytes: null },
    ])
  })

  it('captureBodies: 200 gövdesi ham metin olarak alınır (gzip açılmış); bir kez', async () => {
    const { clock, stub, guard } = await setup({ gzip: true, captureBodies: true })
    const expected = JSON.stringify(fixturePointFrame(clock.now()))
    const res = await guard.fetch(`${stub.baseUrl}${LTFM_PATH}`, GET_INIT)
    expect(await res.text()).toBe(expected)
    expect(await guard.takeBody()).toBe(expected)
    expect(await guard.takeBody()).toBeNull()
    expect(guard.requests()[0]?.bytes).toBe(Buffer.byteLength(expected))
  })

  it('captureBodies: 200 dışındaki yanıtta gövde yok', async () => {
    const clock = new FakeClock()
    const stub = await startAdsbLolStub(() => nginx429Reply())
    stubs.push(stub)
    const guard = createLiveFetch({
      baseUrl: stub.baseUrl,
      now: clock.now,
      fetch: localOnlyFetch,
      captureBodies: true,
    })
    const res = await guard.fetch(`${stub.baseUrl}${LTFM_PATH}`, GET_INIT)
    expect(res.status).toBe(429)
    await res.text()
    expect(await guard.takeBody()).toBeNull()
    expect(guard.requests()[0]?.status).toBe(429)
  })

  it('adsb.lol istemcisiyle: nokta sorgusu geçer, hex sorgusu ağ hatası olur ve violation dolar', async () => {
    const { clock, stub, guard } = await setup({ captureBodies: true })
    const client = createAdsbLolClient({
      appName: 'havayolu',
      version: '0.0.0-test',
      webHost: null,
      contactEmail: 'ops@example.org',
      dataUsageMode: 'commercial',
      baseUrl: stub.baseUrl,
      fetch: guard.fetch,
      now: clock.now,
    })
    const result = await client.point(41.274874, 28.732136, 40)
    expect(result.aircraft.length).toBeGreaterThan(0)
    expect(JSON.parse((await guard.takeBody()) ?? 'null')).toEqual(fixturePointFrame(clock.now()))
    expect(stub.requests.map((r) => r.path)).toEqual([pointPath(41.274874, 28.732136, 40)])
    expect(stub.requests[0]?.headers['user-agent']).toBe(client.userAgent)
    clock.advance(10_000)
    const error = await client.hex(['4b8750']).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AdsbLolError)
    expect((error as AdsbLolError).kind).toBe('network')
    expect(guard.violation()).toMatch(/\/v2\/point dışında/)
    expect(stub.requests).toHaveLength(1)
  })
})
