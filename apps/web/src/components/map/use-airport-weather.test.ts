import { decodeMetar, type AirportWeather } from '@havayolu/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../lib/live/api'
import {
  WEATHER_REFRESH_MS,
  WEATHER_RETRY_MS,
  fetchBulkWeather,
  nextWeatherFetchAt,
  parseBulkWeather,
  weatherUrl,
} from './use-airport-weather'

const OBSERVED = '2026-10-01T12:50:00.000Z'
const LTFM: AirportWeather = {
  icao: 'LTFM',
  generatedAt: '2026-10-01T13:00:00.000Z',
  metar: {
    ...decodeMetar('LTFM 011250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009', {
      observedAt: OBSERVED,
    }),
    observedAt: OBSERVED,
  },
  tafs: [],
}
const LTBQ: AirportWeather = { ...LTFM, icao: 'LTBQ', metar: null }
/** Yakın ülkedeki listelenen havalimanı (1. halka, D-080): aynı toplu yanıtta gelir. */
const LGAV: AirportWeather = {
  ...LTFM,
  icao: 'LGAV',
  metar: {
    ...decodeMetar('LGAV 011250Z 36012KT CAVOK 22/10 Q1015 NOSIG', { observedAt: OBSERVED }),
    observedAt: OBSERVED,
  },
}
const BODY = {
  generatedAt: '2026-10-01T13:00:00.000Z',
  attribution: { text: 'NOAA Aviation Weather Center', url: 'https://aviationweather.gov/' },
  stations: [LTFM, LTBQ, LGAV, { icao: 'bozuk' }],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('nextWeatherFetchAt', () => {
  it('hiç istek atılmadıysa hemen', () => {
    expect(nextWeatherFetchAt({ lastSuccessAt: null, lastFailureAt: null })).toBe(0)
  })

  it('başarılı yanıttan sonra en erken 5 dakika', () => {
    expect(nextWeatherFetchAt({ lastSuccessAt: 1_000, lastFailureAt: null })).toBe(
      1_000 + WEATHER_REFRESH_MS,
    )
    expect(WEATHER_REFRESH_MS).toBe(300_000)
  })

  it('başarısız istekten sonra en erken 1 dakika; eski başarı 5 dakika kuralını korur', () => {
    expect(nextWeatherFetchAt({ lastSuccessAt: null, lastFailureAt: 5_000 })).toBe(
      5_000 + WEATHER_RETRY_MS,
    )
    // Başarı 0'da, yenileme 300 sn'de başarısız: 1 dk sonra yeniden denenir.
    expect(nextWeatherFetchAt({ lastSuccessAt: 0, lastFailureAt: WEATHER_REFRESH_MS })).toBe(
      WEATHER_REFRESH_MS + WEATHER_RETRY_MS,
    )
    // Başarısızlıktan sonra gelen başarı: 5 dakika kuralı.
    expect(nextWeatherFetchAt({ lastSuccessAt: 90_000, lastFailureAt: 10_000 })).toBe(
      90_000 + WEATHER_REFRESH_MS,
    )
  })
})

describe('weatherUrl', () => {
  it('toplu uç nokta, haritadaki havalimanlarıyla aynı küme (listelenenler, D-080)', () => {
    expect(String(weatherUrl('http://localhost:4100'))).toBe(
      'http://localhost:4100/v1/weather?scope=listed',
    )
    expect(String(weatherUrl('https://api.havayolu.live/'))).toBe(
      'https://api.havayolu.live/v1/weather?scope=listed',
    )
  })
})

describe('parseBulkWeather', () => {
  it('istasyonları ICAO koduyla eşler; bozuk kayıt atlanır', () => {
    // JSON gidiş-dönüşü: API yanıtındaki biçim.
    const parsed = parseBulkWeather(JSON.parse(JSON.stringify(BODY)))
    expect(parsed?.generatedAt).toBe(BODY.generatedAt)
    expect([...(parsed?.stations.keys() ?? [])]).toEqual(['LTFM', 'LTBQ', 'LGAV'])
    expect(parsed?.stations.get('LTFM')?.metar?.wind?.gustKt).toBe(32)
    expect(parsed?.stations.get('LTBQ')?.metar).toBeNull()
    expect(parsed?.stations.get('LGAV')?.metar?.raw).toContain('CAVOK')
  })

  it('zarf bozuksa null', () => {
    expect(parseBulkWeather(null)).toBeNull()
    expect(parseBulkWeather({ stations: [] })).toBeNull()
    expect(parseBulkWeather({ generatedAt: BODY.generatedAt, stations: {} })).toBeNull()
  })
})

describe('fetchBulkWeather', () => {
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

  it('tek istek, iptal sinyaliyle', async () => {
    const fetchMock = mockFetch(200, BODY)
    const controller = new AbortController()
    const result = await fetchBulkWeather('http://localhost:4100', controller.signal)
    expect(result.stations.size).toBe(3)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('http://localhost:4100/v1/weather?scope=listed')
    expect(init?.signal).toBe(controller.signal)
  })

  it('2xx olmayan, JSON olmayan ya da zarfı bozuk yanıtta ApiError', async () => {
    mockFetch(503, { error: 'weather_unavailable' })
    await expect(fetchBulkWeather('http://localhost:4100')).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
    })
    mockFetch(200, 'not json')
    await expect(fetchBulkWeather('http://localhost:4100')).rejects.toBeInstanceOf(ApiError)
    mockFetch(200, { generatedAt: BODY.generatedAt })
    await expect(fetchBulkWeather('http://localhost:4100')).rejects.toBeInstanceOf(ApiError)
  })
})
