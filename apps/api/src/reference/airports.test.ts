import type { Airport } from '@havayolu/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { testApp } from '../test/helpers'
import {
  AIRPORT_ERRORS,
  AIRPORTS_CACHE_CONTROL,
  AIRPORTS_CACHE_MS,
  AIRPORTS_EMPTY_CACHE_MS,
  AIRPORTS_RETRY_MS,
} from './airports'

const ist: Airport = {
  icao: 'LTFM',
  iata: 'IST',
  name: 'Istanbul Airport',
  city: 'Istanbul',
  lat: 41.2611,
  lon: 28.7419,
  elevationFt: 325,
  type: 'large_airport',
  scheduled: true,
}
const isl: Airport = {
  icao: 'LTBA',
  iata: 'ISL',
  name: 'İstanbul Atatürk Airport',
  city: null,
  lat: 40.976,
  lon: 28.814,
  elevationFt: null,
  type: 'large_airport',
  scheduled: false,
}

let clock = 1_000_000
const apps: { close(): Promise<unknown> }[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

async function setup(list: ((country: string) => Promise<Airport[]>) | null) {
  const { app } = await testApp({ deps: { airports: { list, now: () => clock } } })
  apps.push(app)
  const get = (url = '/v1/airports') => app.inject({ method: 'GET', url })
  return { app, get }
}

describe('GET /v1/airports', () => {
  it('varsayılan ülke TR; yanıt, önbellek başlığı ve hız sınırı', async () => {
    const list = vi.fn(async () => [isl, ist])
    const { get } = await setup(list)
    const res = await get()
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe(AIRPORTS_CACHE_CONTROL)
    expect(res.headers['x-ratelimit-limit']).toBe('60')
    expect(res.json()).toEqual({ country: 'TR', airports: [isl, ist] })
    expect(list).toHaveBeenCalledWith('TR')
  })

  it('başka ülke ayrı okunur ve ayrı önbelleğe girer', async () => {
    const list = vi.fn(async (country: string) => (country === 'TR' ? [ist] : []))
    const { get } = await setup(list)
    expect((await get('/v1/airports?country=DE')).json()).toEqual({ country: 'DE', airports: [] })
    expect((await get('/v1/airports?country=TR')).json()).toEqual({
      country: 'TR',
      airports: [ist],
    })
    expect(list.mock.calls).toEqual([['DE'], ['TR']])
  })

  it('ülke kodu iki büyük harf değilse 400 bad_country; veritabanına gidilmez', async () => {
    const list = vi.fn(async () => [ist])
    const { get } = await setup(list)
    for (const query of ['tr', 'TUR', '', 'T', 'T1', '1R', 'TR&country=DE', '%20TR']) {
      const res = await get(`/v1/airports?country=${query}`)
      expect(res.statusCode, query).toBe(400)
      expect(res.headers['cache-control'], query).toBe('no-store')
      expect(res.json(), query).toEqual(AIRPORT_ERRORS.badCountry)
    }
    expect(list).not.toHaveBeenCalled()
  })

  it('liste 10 dk önbellekte kalır, sonra yeniden okunur', async () => {
    const list = vi.fn(async () => [ist])
    const { get } = await setup(list)
    await get()
    clock += AIRPORTS_CACHE_MS - 1
    expect((await get()).json()).toEqual({ country: 'TR', airports: [ist] })
    expect(list).toHaveBeenCalledTimes(1)
    clock += 1
    await get()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('boş liste yalnızca 1 dk tutulur (referans verisi henüz içe aktarılmamış olabilir)', async () => {
    const list = vi.fn<(country: string) => Promise<Airport[]>>(async () => [])
    const { get } = await setup(list)
    expect((await get()).json()).toEqual({ country: 'TR', airports: [] })
    clock += AIRPORTS_EMPTY_CACHE_MS - 1
    await get()
    expect(list).toHaveBeenCalledTimes(1)
    list.mockResolvedValue([ist])
    clock += 1
    expect((await get()).json()).toEqual({ country: 'TR', airports: [ist] })
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('okuma başarısız ve kopya yoksa 503 airports_unavailable; sonraki istek yeniden dener', async () => {
    const list = vi
      .fn<(country: string) => Promise<Airport[]>>()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValue([ist])
    const { get } = await setup(list)
    const failed = await get()
    expect(failed.statusCode).toBe(503)
    expect(failed.headers['cache-control']).toBe('no-store')
    expect(failed.json()).toEqual(AIRPORT_ERRORS.unavailable)
    // Sürücü hata metni herkese açık yanıtta yer almaz.
    expect(failed.body).not.toContain('connection refused')
    expect((await get()).statusCode).toBe(200)
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('okuma başarısızsa eski kopya sunulur ve 1 dk yeniden denenmez', async () => {
    const list = vi.fn<(country: string) => Promise<Airport[]>>().mockResolvedValueOnce([ist])
    list.mockRejectedValue(new Error('down'))
    const { get } = await setup(list)
    await get()
    clock += AIRPORTS_CACHE_MS
    const stale = await get()
    expect(stale.statusCode).toBe(200)
    expect(stale.headers['cache-control']).toBe(AIRPORTS_CACHE_CONTROL)
    expect(stale.json()).toEqual({ country: 'TR', airports: [ist] })
    expect(list).toHaveBeenCalledTimes(2)
    clock += AIRPORTS_RETRY_MS - 1
    await get()
    expect(list).toHaveBeenCalledTimes(2)
    clock += 1
    list.mockResolvedValue([isl, ist])
    expect((await get()).json()).toEqual({ country: 'TR', airports: [isl, ist] })
    expect(list).toHaveBeenCalledTimes(3)
  })

  it('eşzamanlı istekler tek okumayı bekler', async () => {
    let resolve: (value: Airport[]) => void = () => undefined
    const list = vi.fn(
      () =>
        new Promise<Airport[]>((r) => {
          resolve = r
        }),
    )
    const { get } = await setup(list)
    const requests = [get(), get(), get()]
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(1))
    resolve([ist])
    for (const res of await Promise.all(requests)) {
      expect(res.json()).toEqual({ country: 'TR', airports: [ist] })
    }
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('veritabanı yoksa 503', async () => {
    const { get } = await setup(null)
    const res = await get()
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual(AIRPORT_ERRORS.unavailable)
  })

  it('yanıt şemayla serileştirilir: fazla alan gönderilmez, null alanlar korunur', async () => {
    const extra = { ...isl, ident: 'LTBA', rowHash: 'x' } as Airport
    const { get } = await setup(async () => [extra])
    expect((await get()).json()).toEqual({ country: 'TR', airports: [isl] })
  })
})
