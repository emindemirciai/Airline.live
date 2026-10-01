import { afterEach, describe, expect, it, vi } from 'vitest'
import { stationWeather } from '../components/airports/airport-weather'
import { FIXTURE_NOW, fixtureHistory, fixtureWeather } from './test/weather-fixture'
import {
  getWeather,
  getWeatherHistory,
  parseWeatherBulk,
  parseWeatherHistory,
  WEATHER_CACHE_TAG,
  weatherBulkUrl,
  weatherHistoryUrl,
} from './weather'

vi.mock('server-only', () => ({}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const GENERATED = new Date(FIXTURE_NOW).toISOString()
const BULK = {
  generatedAt: GENERATED,
  attribution: { text: 'NOAA Aviation Weather Center', url: 'https://aviationweather.gov/' },
  stations: [fixtureWeather('LTFM'), fixtureWeather('LTBQ')],
}

function stubFetch(response: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit & { next?: unknown } }[] = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return response()
  })
  return calls
}

const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('adresler', () => {
  it('toplu hava durumu ve 24 saatlik kayıt, API iç adresinden', () => {
    expect(weatherBulkUrl('http://api.internal:4000')).toBe(
      'http://api.internal:4000/v1/weather?country=TR',
    )
    expect(weatherHistoryUrl('http://api.internal:4000', 'LTFM')).toBe(
      'http://api.internal:4000/v1/airports/LTFM/weather/history?hours=24',
    )
  })
})

describe('yanıt denetimi', () => {
  it('toplu yanıt: istasyonlar ICAO ile; bozuk istasyon atlanır, bozuk zarf null', () => {
    const parsed = parseWeatherBulk({
      ...BULK,
      stations: [...BULK.stations, { icao: 'LTXX', generatedAt: 'dün' }],
    })
    expect([...(parsed?.stations.keys() ?? [])]).toEqual(['LTFM', 'LTBQ'])
    expect(parsed?.attribution?.url).toBe('https://aviationweather.gov/')
    expect(parsed?.stations.get('LTFM')?.metar?.raw).toMatch(/^LTFM 151250Z/)
    expect(parseWeatherBulk({ stations: 'yok' })).toBeNull()
    expect(parseWeatherBulk(null)).toBeNull()
  })

  it('kayıt yanıtı şemaya uymazsa null', () => {
    expect(parseWeatherHistory(fixtureHistory('LTFM'))?.entries.length).toBeGreaterThan(48)
    expect(parseWeatherHistory({ icao: 'LTFM', entries: 'yok' })).toBeNull()
  })
})

describe('getWeather', () => {
  it('60 sn önbellek, "weather" etiketi, istemci başlığı yok', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000')
    const calls = stubFetch(json(BULK))
    const bulk = await getWeather()
    expect(bulk?.stations.size).toBe(2)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('http://api.internal:4000/v1/weather?country=TR')
    expect(calls[0]?.init.next).toEqual({ revalidate: 60, tags: [WEATHER_CACHE_TAG] })
    expect(calls[0]?.init.headers).toEqual({ accept: 'application/json' })
  })

  it('hata sayfaya taşınmaz: HTTP hatası, ağ hatası ve bozuk gövde null döner', async () => {
    stubFetch(() => new Response('down', { status: 503 }))
    expect(await getWeather()).toBeNull()
    stubFetch(() => Promise.reject(new TypeError('fetch failed')))
    expect(await getWeather()).toBeNull()
    stubFetch(() => new Response('<html>', { status: 200 }))
    expect(await getWeather()).toBeNull()
  })
})

describe('getWeatherHistory', () => {
  it('5 dk önbellek; geçersiz kodda istek atılmaz; hata null', async () => {
    const calls = stubFetch(json(fixtureHistory('LTFM')))
    expect((await getWeatherHistory('LTFM'))?.icao).toBe('LTFM')
    expect(calls[0]?.init.next).toEqual({ revalidate: 300, tags: [WEATHER_CACHE_TAG] })
    expect(await getWeatherHistory('ltfm')).toBeNull()
    expect(await getWeatherHistory('../x')).toBeNull()
    expect(calls).toHaveLength(1)
    stubFetch(json({ error: 'not found' }, 404))
    expect(await getWeatherHistory('LTFM')).toBeNull()
  })
})

describe('stationWeather', () => {
  it('API yoksa null ("alınamıyor"); listede olmayan istasyon raporsuz kayıt ("rapor yok")', () => {
    const bulk = parseWeatherBulk(BULK)
    expect(stationWeather(null, 'LTFM')).toBeNull()
    expect(stationWeather(bulk, 'LTFM')?.metar).not.toBeNull()
    expect(stationWeather(bulk, 'LTCW')).toEqual({
      icao: 'LTCW',
      generatedAt: GENERATED,
      metar: null,
      tafs: [],
    })
  })
})
