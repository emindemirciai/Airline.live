import { AdsbLolError, createAdsbLolClient, parseLiveResponse } from '@havayolu/providers'
import { afterEach, describe, expect, it } from 'vitest'
import {
  adsbLolEnvelope,
  cruiseFrame,
  FAKE_T0,
  FakeClock,
  fixturePointFrame,
  gzipJson,
  jsonReply,
  NGINX_429_HTML,
  nginx429Reply,
  startAdsbLolStub,
  type AdsbLolStub,
  type StubReply,
} from './adsblol-stub'

const stubs: AdsbLolStub[] = []
afterEach(async () => {
  await Promise.all(stubs.splice(0).map((s) => s.close()))
})

async function clientFor(reply: (index: number) => StubReply, clock = new FakeClock()) {
  const stub = await startAdsbLolStub((_req, index) => reply(index), { now: clock.now })
  stubs.push(stub)
  const client = createAdsbLolClient({
    appName: 'havayolu',
    version: '0.0.0-test',
    contactEmail: 'ops@example.org',
    dataUsageMode: 'commercial',
    baseUrl: stub.baseUrl,
    now: clock.now,
  })
  return { stub, client, clock }
}

describe('adsb.lol kareleri', () => {
  it('zarf: ac, msg, now (ms), total, ctime, ptime', () => {
    expect(adsbLolEnvelope([{ hex: 'abc123' }], 1000)).toEqual({
      ac: [{ hex: 'abc123' }],
      msg: 'No error',
      now: 1000,
      total: 1,
      ctime: 1000,
      ptime: 0,
    })
  })

  it('fixture karesi verilen ana taşınır ve adsb.lol ayrıştırıcısından geçer', () => {
    const frame = fixturePointFrame(FAKE_T0)
    expect(frame.now).toBe(FAKE_T0)
    expect(frame.ctime).toBe(FAKE_T0)
    expect(frame.ac).toHaveLength(18)
    frame.ac.length = 0
    expect(fixturePointFrame(FAKE_T0).ac).toHaveLength(18)
    const parsed = parseLiveResponse(fixturePointFrame(FAKE_T0), 'adsbLol', { receivedAt: FAKE_T0 })
    expect(parsed.aircraft.length).toBeGreaterThan(0)
  })

  it('cruise karesi: count seyir + yaklaşma + taksi uçağı, sentetik kimlikler', () => {
    const frame = cruiseFrame(FAKE_T0, 60)
    expect(frame.total).toBe(62)
    expect(frame.ac.every((a) => typeof a.hex === 'string' && a.hex.startsWith('ff'))).toBe(true)
    const parsed = parseLiveResponse(frame, 'adsbLol', { receivedAt: FAKE_T0 })
    expect(parsed.aircraft).toHaveLength(62)
  })
})

describe('sahte sunucu ve adsb.lol istemcisi', () => {
  it('gzip JSON yanıtı; istek yolu, UA ve saat kaydedilir', async () => {
    const { stub, client, clock } = await clientFor(() =>
      jsonReply(fixturePointFrame(FAKE_T0), { gzip: true }),
    )
    const result = await client.point(41.274874, 28.732136, 40)
    expect(result.aircraft.length).toBeGreaterThan(0)
    expect(stub.requests).toEqual([
      expect.objectContaining({
        method: 'GET',
        path: '/v2/point/41.2749/28.7321/40',
        at: clock.now(),
      }),
    ])
    expect(stub.requests[0]?.headers['user-agent']).toBe(client.userAgent)
    expect(gzipJson({ a: 1 })[0]).toBe(0x1f)
  })

  it('nginx 429 (Retry-After yok) ve gövdesiz 420 → rate_limit', async () => {
    const replies: StubReply[] = [nginx429Reply(), { status: 420 }]
    const { client } = await clientFor((index) => replies[index] ?? { status: 500 })
    for (const status of [429, 420]) {
      const error = await client.point(41, 28, 40).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(AdsbLolError)
      expect(error).toMatchObject({ kind: 'rate_limit', status, retryAfterSec: null })
    }
    expect(NGINX_429_HTML).toContain('429 Too Many Requests')
  })

  it('302 izlenmez (request), kesilen soket ağ hatası, işleyici hatası 500', async () => {
    const replies: StubReply[] = [
      { status: 302, headers: { location: '/v2/hex/4b8750' } },
      { destroy: true },
    ]
    const { stub, client } = await clientFor((index) => {
      const reply = replies[index]
      if (reply === undefined) throw new Error('boom')
      return reply
    })
    expect(await client.point(41, 28, 40).catch((e: unknown) => e)).toMatchObject({
      kind: 'request',
      status: 302,
    })
    expect(await client.point(41, 28, 40).catch((e: unknown) => e)).toMatchObject({
      kind: 'network',
    })
    expect(await client.point(41, 28, 40).catch((e: unknown) => e)).toMatchObject({
      kind: 'server',
      status: 500,
    })
    expect(stub.requests.map((r) => r.path)).not.toContain('/v2/hex/4b8750')
  })
})

describe('FakeClock', () => {
  it('sleep zamanı anında ilerletir; now bağlamsız çağrılabilir', async () => {
    const clock = new FakeClock()
    const { now, sleep } = clock
    expect(now()).toBe(FAKE_T0)
    await sleep(10_000)
    await sleep(-5)
    clock.advance(1)
    expect(now()).toBe(FAKE_T0 + 10_001)
  })
})
