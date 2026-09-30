import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { guardNetwork } from '../../../lib/seo/test/network-guard'
import { fixtureTurkishAirports } from '../../../lib/test/ourairports-fixture'
import Image, { alt, contentType, size } from './opengraph-image'

vi.mock('server-only', () => ({}))
const connection = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('next/server', () => ({ connection }))
// Veri sayfayla aynı toplu çağrıdan gelir; testte fixture listesi döner (ağ kapalı).
const getAirports = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/airports', () => ({ getAirports }))

let network: ReturnType<typeof guardNetwork>

beforeEach(() => {
  network = guardNetwork()
  getAirports.mockResolvedValue(fixtureTurkishAirports())
  vi.stubEnv('APP_ENV', 'test')
  vi.stubEnv('APP_NAME', 'havayolu')
  vi.stubEnv('WEB_HOST', 'havayolu.live')
})

afterEach(() => {
  network.restore()
  vi.unstubAllEnvs()
  connection.mockClear()
  getAirports.mockReset()
})

const params = (icao: string) => Promise.resolve({ icao })

describe('/istasyon/<ICAO>/opengraph-image', () => {
  it('1200×630 PNG ve sabit üst veri', () => {
    expect(size).toEqual({ width: 1200, height: 630 })
    expect(contentType).toBe('image/png')
    expect(alt).toBe('havayolu')
  })

  it('bilinen havalimanı: önce connection(), sonra PNG; ağa çıkılmaz', async () => {
    const response = await Image({ params: params('LTFM') })
    expect(connection).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toBe('public, max-age=86400')
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect([...bytes.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47])
    expect(network.networkCalls()).toEqual([])
  })

  it('aynı içerik yeniden çizilmez; bilinmeyen ya da kanonik olmayan kod 404', async () => {
    const first = new Uint8Array(await (await Image({ params: params('LTFJ') })).arrayBuffer())
    const second = new Uint8Array(await (await Image({ params: params('LTFJ') })).arrayBuffer())
    expect(second).toEqual(first)
    expect((await Image({ params: params('ZZZZ') })).status).toBe(404)
    expect((await Image({ params: params('ltfm') })).status).toBe(404)
  })
})
