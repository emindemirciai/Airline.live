import { decodeMetar, type AirportWeather } from '@havayolu/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAirportWeather } from '../airports/weather-client'
import {
  nextWeatherFetchAt,
  rememberStation,
  WEATHER_CACHE_AIRPORTS,
  WEATHER_REFRESH_MS,
  WEATHER_RETRY_MS,
  type AirportWeatherState,
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

describe('rememberStation: son açılan havalimanlarının verisi', () => {
  const entry = (icao: string): AirportWeatherState => ({
    data: { ...LTFM, icao },
    failed: false,
  })

  it('yeni Map döner (React durumu); aynı havalimanı yeniden yazılınca en yeni olur', () => {
    const first = rememberStation(new Map(), 'LTFM', entry('LTFM'))
    const second = rememberStation(first, 'LGAV', entry('LGAV'))
    expect(second).not.toBe(first)
    expect([...first.keys()]).toEqual(['LTFM'])
    const touched = rememberStation(second, 'LTFM', { data: null, failed: true })
    expect([...touched.keys()]).toEqual(['LGAV', 'LTFM'])
    expect(touched.get('LTFM')).toEqual({ data: null, failed: true })
  })

  it('en çok WEATHER_CACHE_AIRPORTS havalimanı; en eski kullanılan atılır', () => {
    expect(WEATHER_CACHE_AIRPORTS).toBe(32)
    let entries: ReadonlyMap<string, AirportWeatherState> = new Map()
    const codes = Array.from({ length: 40 }, (_, i) => `LT${String(i).padStart(2, '0')}`)
    for (const icao of codes) entries = rememberStation(entries, icao, entry(icao))
    expect(entries.size).toBe(WEATHER_CACHE_AIRPORTS)
    expect([...entries.keys()]).toEqual(codes.slice(-WEATHER_CACHE_AIRPORTS))
    expect(rememberStation(entries, 'LTFM', entry('LTFM'), 2).size).toBe(2)
  })
})

describe('pencerenin isteği: tek havalimanı (D-090)', () => {
  it('GET /v1/airports/<ICAO>/weather, iptal sinyaliyle; toplu yanıt istenmez', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify(LTFM), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const result = await fetchAirportWeather('http://localhost:4100', 'LTFM', controller.signal)
    expect(result?.metar?.wind?.gustKt).toBe(32)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('http://localhost:4100/v1/airports/LTFM/weather')
    expect(init?.signal).toBe(controller.signal)
  })

  it('başarısız ya da bozuk yanıt null (pencere "alınamıyor" der, eldeki veri korunur)', async () => {
    const signal = new AbortController().signal
    vi.stubGlobal('fetch', async () => new Response('down', { status: 503 }))
    expect(await fetchAirportWeather('http://localhost:4100', 'LTFM', signal)).toBeNull()
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ icao: 'LTFM' })))
    expect(await fetchAirportWeather('http://localhost:4100', 'LTFM', signal)).toBeNull()
  })
})
