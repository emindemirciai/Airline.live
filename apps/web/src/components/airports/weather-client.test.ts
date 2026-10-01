import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixtureHistory, fixtureWeather } from '../../lib/test/weather-fixture'
import {
  airportWeatherHistoryUrl,
  airportWeatherUrl,
  fetchAirportWeather,
  fetchWeatherHistory,
  initialSuccessAt,
  WEATHER_REFRESH_MS,
  WEATHER_STALE_ON_MOUNT_MS,
  WEATHER_RETRY_MS,
  weatherRefreshDue,
} from './weather-client'

afterEach(() => {
  vi.unstubAllGlobals()
})

const API = 'http://localhost:4100'

describe('adresler', () => {
  it('tarayıcı yalnızca kendi API’mize gider', () => {
    expect(airportWeatherUrl(API, 'LTFM')).toBe('http://localhost:4100/v1/airports/LTFM/weather')
    expect(airportWeatherHistoryUrl('https://api.havayolu.live', 'LTFM', 168)).toBe(
      'https://api.havayolu.live/v1/airports/LTFM/weather/history?hours=168',
    )
  })
})

describe('initialSuccessAt: sunucu çiziminin tazeliği', () => {
  const server = Date.parse('2026-01-15T13:00:00Z')
  const iso = (ms: number) => new Date(ms).toISOString()
  // Cihaz saati 2 saat geri: sonuç cihazın Date.now saatindedir, yaş sunucu saatiyle ölçülür.
  const local = server - 2 * 3_600_000

  it('ikisi de taze: başarılı istek sayılır (yaşı kadar önce)', () => {
    expect(
      initialSuccessAt({
        weatherGeneratedAt: iso(server - 30_000),
        historyGeneratedAt: iso(server - 50_000),
        serverNow: server,
        localNow: local,
      }),
    ).toBe(local - 50_000)
  })

  it('güncel hava taze ama kayıt eski (ayrı önbellek): hemen yenilenir', () => {
    expect(
      initialSuccessAt({
        weatherGeneratedAt: iso(server - 10_000),
        historyGeneratedAt: iso(server - 20 * 3_600_000),
        serverNow: server,
        localNow: local,
      }),
    ).toBeNull()
    expect(
      initialSuccessAt({
        weatherGeneratedAt: iso(server - 10_000),
        historyGeneratedAt: iso(server - WEATHER_STALE_ON_MOUNT_MS),
        serverNow: server,
        localNow: local,
      }),
    ).toBeNull()
  })

  it('eksik ya da bozuk veri: hemen yenilenir', () => {
    expect(
      initialSuccessAt({
        weatherGeneratedAt: null,
        historyGeneratedAt: iso(server),
        serverNow: server,
        localNow: local,
      }),
    ).toBeNull()
    expect(
      initialSuccessAt({
        weatherGeneratedAt: iso(server),
        historyGeneratedAt: 'bozuk',
        serverNow: server,
        localNow: local,
      }),
    ).toBeNull()
  })
})

describe('weatherRefreshDue', () => {
  it('hiç istek yoksa hemen; başarılıdan 5 dk sonra; başarısızdan en erken 1 dk sonra', () => {
    const now = 10_000_000
    expect(weatherRefreshDue(now, null, null)).toBe(true)
    expect(weatherRefreshDue(now, now - WEATHER_REFRESH_MS + 1, null)).toBe(false)
    expect(weatherRefreshDue(now, now - WEATHER_REFRESH_MS, null)).toBe(true)
    expect(weatherRefreshDue(now, null, now - WEATHER_RETRY_MS + 1)).toBe(false)
    expect(weatherRefreshDue(now, null, now - WEATHER_RETRY_MS)).toBe(true)
  })
})

describe('istekler', () => {
  it('geçerli yanıt şemayla okunur; hata ve bozuk yanıt null döner', async () => {
    const signal = new AbortController().signal
    vi.stubGlobal('fetch', async (url: string) =>
      Response.json(url.includes('/history') ? fixtureHistory('LTFM') : fixtureWeather('LTFM')),
    )
    expect((await fetchAirportWeather(API, 'LTFM', signal))?.metar?.raw).toMatch(/^LTFM/)
    expect((await fetchWeatherHistory(API, 'LTFM', signal))?.entries.length).toBeGreaterThan(0)
    vi.stubGlobal('fetch', async () => new Response('down', { status: 503 }))
    expect(await fetchAirportWeather(API, 'LTFM', signal)).toBeNull()
    vi.stubGlobal('fetch', async () => Response.json({ icao: 'LTFM' }))
    expect(await fetchWeatherHistory(API, 'LTFM', signal)).toBeNull()
  })

  it('kesilen istek hata fırlatır (ada sonucu yok sayar)', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', async () => {
      controller.abort()
      throw new DOMException('aborted', 'AbortError')
    })
    await expect(fetchAirportWeather(API, 'LTFM', controller.signal)).rejects.toThrow()
  })
})
