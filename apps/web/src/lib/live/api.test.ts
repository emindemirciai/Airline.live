import type { Airport } from '@havayolu/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, fetchAirports, fetchSearch } from './api'
import { aircraft, STATUS } from './test/fakes'

const IST: Airport = {
  icao: 'LTFM',
  iata: 'IST',
  name: 'İstanbul Havalimanı',
  city: 'İstanbul',
  lat: 41.2753,
  lon: 28.7519,
  elevationFt: 325,
  type: 'large_airport',
  scheduled: true,
}

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async (_url: URL, _init?: RequestInit) =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchSearch', () => {
  it('sorguyu kırpıp kodlar ve yanıtı döndürür', async () => {
    const fetchMock = mockFetch(200, {
      kind: 'callsign',
      results: [aircraft(), { hex: 'bozuk' }],
      status: STATUS,
    })
    const controller = new AbortController()
    const result = await fetchSearch('http://localhost:4100', '  TK 974&x ', controller.signal)
    expect(result).toEqual({ kind: 'callsign', results: [aircraft()], status: STATUS })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('http://localhost:4100/v1/search?q=TK+974%26x')
    expect(init?.signal).toBe(controller.signal)
  })

  it('2xx olmayan yanıtta durum koduyla ApiError fırlatır', async () => {
    mockFetch(429, { error: 'rate_limited' })
    const error = await fetchSearch('https://api.havayolu.live', 'THY974').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(429)
    mockFetch(503, { error: 'live_unavailable', message: '' })
    await expect(fetchSearch('https://api.havayolu.live', 'x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
    })
  })

  it('biçimi bozuk yanıtı reddeder', async () => {
    for (const body of [
      'not json',
      [],
      { kind: 'other', results: [], status: STATUS },
      { kind: 'hex', results: {}, status: STATUS },
      { kind: 'hex', results: [], status: { providers: { opensky: 'ok' } } },
    ]) {
      mockFetch(200, body)
      await expect(
        fetchSearch('https://api.havayolu.live', 'x'),
        JSON.stringify(body),
      ).rejects.toBeInstanceOf(ApiError)
    }
  })

  it('ağ hatası ve iptal olduğu gibi iletilir', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(fetchSearch('https://api.havayolu.live', 'x')).rejects.toBeInstanceOf(TypeError)
  })
})

describe('fetchAirports', () => {
  it('varsayılan ülke TR; uygun olmayan havalimanı kayıtlarını atlar', async () => {
    const fetchMock = mockFetch(200, {
      country: 'TR',
      airports: [IST, { ...IST, iata: '' }, { ...IST, type: 'heliport' }, { ...IST, lat: 'x' }],
    })
    const result = await fetchAirports('https://api.havayolu.live')
    expect(result).toEqual({ country: 'TR', airports: [IST] })
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.havayolu.live/v1/airports?country=TR',
    )
  })

  it('ülke kodunu iletir, hata ve bozuk biçimi reddeder', async () => {
    const fetchMock = mockFetch(200, { country: 'CY', airports: [] })
    await expect(fetchAirports('http://localhost:4100', 'CY')).resolves.toEqual({
      country: 'CY',
      airports: [],
    })
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'http://localhost:4100/v1/airports?country=CY',
    )
    mockFetch(503, { error: 'airports_unavailable' })
    await expect(fetchAirports('http://localhost:4100')).rejects.toMatchObject({ status: 503 })
    mockFetch(200, { country: 'TR' })
    await expect(fetchAirports('http://localhost:4100')).rejects.toBeInstanceOf(ApiError)
  })
})
