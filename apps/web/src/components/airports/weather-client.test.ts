import type { WeatherHistoryResponse } from '@havayolu/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixtureHistory, fixtureWeather } from '../../lib/test/weather-fixture'
import {
  airportWeatherHistoryUrl,
  airportWeatherUrl,
  fetchAirportWeather,
  fetchWeatherHistory,
} from './weather-client'
import {
  initialWeatherAt,
  WEATHER_REFRESH_MS,
  WEATHER_RETRY_MS,
  WEATHER_STALE_ON_MOUNT_MS,
  weatherRefreshDue,
  WeatherRefresher,
} from './weather-refresh'

afterEach(() => {
  vi.unstubAllGlobals()
})

const API = 'http://localhost:4100'

describe('adresler', () => {
  it('tarayıcı yalnızca kendi API’mize gider', () => {
    expect(airportWeatherUrl(API, 'LTFM')).toBe('http://localhost:4100/v1/airports/LTFM/weather')
    expect(airportWeatherHistoryUrl('https://api.airline.live', 'LTFM', 168)).toBe(
      'https://api.airline.live/v1/airports/LTFM/weather/history?hours=168',
    )
  })
})

describe('initialWeatherAt: sunucu çizimindeki güncel havanın tazeliği', () => {
  const server = Date.parse('2026-01-15T13:00:00Z')
  const iso = (ms: number) => new Date(ms).toISOString()
  // Cihaz saati 2 saat geri: sonuç cihazın Date.now saatindedir, yaş sunucu saatiyle ölçülür.
  const local = server - 2 * 3_600_000
  const at = (weatherGeneratedAt: string | null) =>
    initialWeatherAt({ weatherGeneratedAt, serverNow: server, localNow: local })

  it('taze: üretildiği an (yaşı kadar önce); açılıştaki istek yalnız kaydı alır (D-111)', () => {
    expect(at(iso(server - 30_000))).toBe(local - 30_000)
    // Sunucu saati üretim anından gerideyse yaş sıfırdır.
    expect(at(iso(server + 5_000))).toBe(local)
  })

  it('eski, eksik ya da bozuk: null (ada açılışta güncel havayı da ister)', () => {
    expect(at(iso(server - WEATHER_STALE_ON_MOUNT_MS))).toBeNull()
    expect(at(null)).toBeNull()
    expect(at('bozuk')).toBeNull()
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

describe('WeatherRefresher: kayıt yalnız tarayıcıda (D-111)', () => {
  const START = Date.parse('2026-01-15T13:00:00Z')

  function setup(freshWeatherAt: number | null) {
    let clock = START
    const fetchWeather = vi.fn(async (_api: string, icao: string, _signal: AbortSignal) =>
      fixtureWeather(icao),
    )
    const fetchHistory = vi.fn(
      async (
        _api: string,
        icao: string,
        _signal: AbortSignal,
      ): Promise<WeatherHistoryResponse | null> => fixtureHistory(icao),
    )
    const apply = vi.fn()
    const refresher = new WeatherRefresher({
      apiBaseUrl: API,
      icao: 'LTFM',
      freshWeatherAt,
      apply,
      fetchWeather,
      fetchHistory,
      now: () => clock,
    })
    return {
      refresher,
      fetchWeather,
      fetchHistory,
      apply,
      advance: (ms: number) => {
        clock += ms
      },
    }
  }

  it('güncel hava tazeyse açılışta yalnız kayıt; sonraki yenileme havanın yaşına göre ikisini birden ister', async () => {
    const weatherAt = START - 30_000
    const { refresher, fetchWeather, fetchHistory, apply, advance } = setup(weatherAt)
    await refresher.check()
    expect(fetchWeather).not.toHaveBeenCalled()
    expect(fetchHistory).toHaveBeenCalledTimes(1)
    expect(fetchHistory.mock.calls[0]?.slice(0, 2)).toEqual([API, 'LTFM'])
    expect(apply).toHaveBeenCalledWith({ weather: null, history: fixtureHistory('LTFM') })
    // Güncel hava 5 dakikalık olana kadar yeni istek yok.
    advance(WEATHER_REFRESH_MS - 30_000 - 1)
    expect(refresher.check()).toBeNull()
    advance(1)
    await refresher.check()
    expect(fetchWeather).toHaveBeenCalledTimes(1)
    expect(fetchHistory).toHaveBeenCalledTimes(2)
    expect(apply).toHaveBeenLastCalledWith({
      weather: fixtureWeather('LTFM'),
      history: fixtureHistory('LTFM'),
    })
  })

  it('güncel hava eski ya da yoksa açılışta ikisi birden; 5 dakikada bir yenilenir', async () => {
    const { refresher, fetchWeather, fetchHistory, advance } = setup(null)
    await refresher.check()
    expect([fetchWeather.mock.calls.length, fetchHistory.mock.calls.length]).toEqual([1, 1])
    advance(WEATHER_REFRESH_MS - 1)
    expect(refresher.check()).toBeNull()
    advance(1)
    await refresher.check()
    expect([fetchWeather.mock.calls.length, fetchHistory.mock.calls.length]).toEqual([2, 2])
  })

  it('kayıt alınamazsa sonuç yine bildirilir (bölüm "alınamıyor" der); en erken 1 dk sonra ikisi birden yeniden', async () => {
    const { refresher, fetchWeather, fetchHistory, apply, advance } = setup(START)
    fetchHistory.mockResolvedValueOnce(null)
    await refresher.check()
    expect(apply).toHaveBeenLastCalledWith({ weather: null, history: null })
    advance(WEATHER_RETRY_MS - 1)
    expect(refresher.check()).toBeNull()
    advance(1)
    await refresher.check()
    expect(fetchWeather).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenLastCalledWith({
      weather: fixtureWeather('LTFM'),
      history: fixtureHistory('LTFM'),
    })
    // Ağ hatası da bildirilir.
    fetchHistory.mockRejectedValueOnce(new TypeError('fetch failed'))
    advance(WEATHER_REFRESH_MS)
    await refresher.check()
    expect(apply).toHaveBeenLastCalledWith({ weather: null, history: null })
  })

  it('kapatılınca süren istek kesilir, sonucu uygulanmaz ve yeni istek gitmez', async () => {
    const { refresher, fetchHistory, apply, advance } = setup(null)
    const signals: AbortSignal[] = []
    fetchHistory.mockImplementationOnce(
      (_api, _icao, signal) =>
        new Promise((_resolve, reject) => {
          signals.push(signal)
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const pending = refresher.check()
    refresher.destroy()
    await pending
    expect(signals[0]?.aborted).toBe(true)
    expect(apply).not.toHaveBeenCalled()
    advance(WEATHER_REFRESH_MS)
    expect(refresher.check()).toBeNull()
    expect(fetchHistory).toHaveBeenCalledTimes(1)
  })
})
