import { readFileSync } from 'node:fs'
import { inForceTafs } from '@havayolu/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FIXTURE_NOW,
  fixtureRawWeather,
  fixtureStations,
  fixtureWeather,
} from './test/weather-fixture'
import { createMemoryCache } from './memory-cache'
import {
  parseWeatherBulk,
  stationWeather,
  WEATHER_BULK_MAX_STALE_MS,
  WEATHER_BULK_RETRY_MS,
  WEATHER_BULK_TTL_MS,
  weatherBulkUrl,
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
  stations: [fixtureRawWeather('LTFM'), fixtureRawWeather('LTBQ')],
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
  it('toplu hava durumu (ham biçim, D-101), API iç adresinden', () => {
    expect(weatherBulkUrl('http://api.internal:4000')).toBe(
      'http://api.internal:4000/v1/weather?scope=listed&format=raw',
    )
  })
})

describe('yanıt denetimi', () => {
  it('toplu yanıt: istasyonlar ICAO ile; bozuk istasyon atlanır, bozuk zarf null', () => {
    const parsed = parseWeatherBulk({
      ...BULK,
      stations: [
        ...BULK.stations,
        { icao: 'LTXX', metar: { raw: 'LTXX' }, tafs: [] },
        { icao: 'UG-0002', metar: null, tafs: [] },
      ],
    })
    expect([...(parsed?.stations.keys() ?? [])]).toEqual(['LTFM', 'LTBQ'])
    expect(parsed?.attribution?.url).toBe('https://aviationweather.gov/')
    expect(parsed?.stations.get('LTFM')?.metar?.raw).toMatch(/^LTFM 151250Z/)
    expect(parseWeatherBulk({ stations: 'yok' })).toBeNull()
    expect(parseWeatherBulk(null)).toBeNull()
  })
})

/** Modülün bellek önbelleği her testte boş başlasın: modül yeniden yüklenir. */
async function freshWeatherModule() {
  vi.resetModules()
  return import('./weather')
}

describe('createMemoryCache: toplu hava durumunun web belleği (D-090)', () => {
  let clock = 0
  const now = () => clock
  beforeEach(() => {
    clock = 1_000_000
  })

  function deferred<T>() {
    let resolve: (value: T) => void = () => undefined
    let reject: (error: unknown) => void = () => undefined
    const promise = new Promise<T>((ok, fail) => {
      resolve = ok
      reject = fail
    })
    return { promise, resolve, reject }
  }

  const options = {
    ttlMs: WEATHER_BULK_TTL_MS,
    retryMs: WEATHER_BULK_RETRY_MS,
    maxStaleMs: WEATHER_BULK_MAX_STALE_MS,
    now,
  }

  it('sabitler: 60 sn taze, 15 sn sonra yeniden deneme, en çok 10 dk eski', () => {
    expect([WEATHER_BULK_TTL_MS, WEATHER_BULK_RETRY_MS, WEATHER_BULK_MAX_STALE_MS]).toEqual([
      60_000, 15_000, 600_000,
    ])
  })

  it('tek uçuş: aynı anda gelen çağrılar tek isteği paylaşır; 60 sn içinde yeni istek yok', async () => {
    let calls = 0
    const pending = deferred<string>()
    const get = createMemoryCache({
      ...options,
      load: () => {
        calls += 1
        return pending.promise
      },
    })
    const first = get()
    const second = get()
    const third = get()
    pending.resolve('v1')
    expect(await Promise.all([first, second, third])).toEqual(['v1', 'v1', 'v1'])
    expect(calls).toBe(1)
    clock += WEATHER_BULK_TTL_MS - 1
    expect(await get()).toBe('v1')
    expect(calls).toBe(1)
  })

  it('süresi dolunca yenilenir: dakikada en çok bir istek', async () => {
    let version = 0
    const get = createMemoryCache({ ...options, load: async () => `v${++version}` })
    expect(await get()).toBe('v1')
    clock += WEATHER_BULK_TTL_MS
    expect(await get()).toBe('v2')
    // 503 sayfa aynı dakikada çizilse de API'ye tek istek gider.
    const pages = await Promise.all(Array.from({ length: 503 }, () => get()))
    expect(new Set(pages)).toEqual(new Set(['v2']))
    expect(version).toBe(2)
  })

  it('yenileme başarısız: eldeki değer 10 dk yaşına kadar verilir, 15 sn dolmadan yeniden denenmez', async () => {
    let calls = 0
    let fail = false
    const get = createMemoryCache({
      ...options,
      load: async () => {
        calls += 1
        if (fail) throw new Error('API down')
        return `v${calls}`
      },
    })
    expect(await get()).toBe('v1')
    fail = true
    clock += WEATHER_BULK_TTL_MS
    expect(await get()).toBe('v1')
    expect(calls).toBe(2)
    clock += WEATHER_BULK_RETRY_MS - 1
    expect(await get()).toBe('v1')
    expect(calls).toBe(2)
    clock += 1
    expect(await get()).toBe('v1')
    expect(calls).toBe(3)
    // 10 dakikadan eski değer verilmez: sayfa "alınamıyor" der.
    clock = 1_000_000 + WEATHER_BULK_MAX_STALE_MS + 1
    expect(await get()).toBeNull()
    expect(calls).toBe(4)
    fail = false
    expect(await get()).toBeNull()
    clock += WEATHER_BULK_RETRY_MS
    expect(await get()).toBe('v5')
  })

  it('hiç değer yokken hata: null, fırlatmaz', async () => {
    const get = createMemoryCache({
      ...options,
      load: () => Promise.reject(new TypeError('fetch failed')),
    })
    expect(await get()).toBeNull()
  })
})

describe('getWeather', () => {
  it('Next veri önbelleğine konmaz (no-store); dakikada bir istek, istemci başlığı yok', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000')
    const calls = stubFetch(json(BULK))
    const { getWeather } = await freshWeatherModule()
    const bulk = await getWeather()
    expect(bulk?.stations.size).toBe(2)
    expect(await getWeather()).toBe(bulk)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('http://api.internal:4000/v1/weather?scope=listed&format=raw')
    expect(calls[0]?.init.cache).toBe('no-store')
    expect(calls[0]?.init.next).toBeUndefined()
    expect(calls[0]?.init.headers).toEqual({ accept: 'application/json' })
  })

  it('hata sayfaya taşınmaz: HTTP hatası, ağ hatası ve bozuk gövde null döner', async () => {
    for (const response of [
      () => new Response('down', { status: 503 }),
      () => Promise.reject(new TypeError('fetch failed')),
      () => new Response('<html>', { status: 200 }),
      json({ generatedAt: GENERATED }),
    ]) {
      stubFetch(response)
      const { getWeather } = await freshWeatherModule()
      expect(await getWeather()).toBeNull()
    }
  })

  it('1.240 istasyonun (4. halka, D-110) gövdesi bellekte tek kez ayrıştırılır (2 MiB öğe sınırı yok)', async () => {
    const station = fixtureRawWeather('LTFM')
    const stations = Array.from({ length: 1_240 }, (_, i) => ({
      ...station,
      icao: `X${i.toString(36).toUpperCase().padStart(3, '0')}`,
    }))
    const body = JSON.stringify({ ...BULK, stations })
    const calls = stubFetch(
      () => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    const { getWeather } = await freshWeatherModule()
    expect((await getWeather())?.stations.size).toBe(1_240)
    expect((await getWeather())?.stations.size).toBe(1_240)
    expect(calls).toHaveLength(1)
  })
})

describe('getAirportWeatherPage: METAR/TAF kaydı yalnız tarayıcıda (D-111)', () => {
  it('sunucu çizimi yalnız toplu hava durumunu ister, kayıt istemez', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000')
    const calls = stubFetch(json(BULK))
    const { getAirportWeatherPage } = await freshWeatherModule()
    const before = Date.now()
    const page = await getAirportWeatherPage()
    expect(page.bulk?.stations.size).toBe(2)
    expect(page.renderedAt).toBeGreaterThanOrEqual(before)
    expect(Object.keys(page).sort()).toEqual(['bulk', 'renderedAt'])
    // İkinci havalimanının çizimi de kayıt istemez; toplu yanıt bellektedir.
    await getAirportWeatherPage()
    expect(calls.map((call) => call.url)).toEqual([
      'http://api.internal:4000/v1/weather?scope=listed&format=raw',
    ])
    expect(calls.some((call) => call.url.includes('/weather/history'))).toBe(false)
  })

  it('kaydın sunucu yolu ve Next veri önbelleği kalktı', () => {
    const source = readFileSync(new URL('./weather.ts', import.meta.url), 'utf8')
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    expect(code).not.toContain('/weather/history')
    expect(code).not.toContain('revalidate')
    expect(code).not.toContain('WEATHER_HISTORY_REVALIDATE_S')
  })
})

describe('stationWeather: ham kayıttan çözüm (D-101)', () => {
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

  it("her fixture istasyonu: API'nin tam biçimiyle aynı kayıt (METAR çözülür, yürürlükteki TAF'lar)", () => {
    const stations = fixtureStations()
    expect(stations.length).toBeGreaterThan(15)
    const bulk = parseWeatherBulk({
      ...BULK,
      stations: stations.map((icao) => fixtureRawWeather(icao)),
    })
    let dropped = 0
    for (const icao of stations) {
      const full = fixtureWeather(icao)
      const expected = { ...full, tafs: inForceTafs(full.tafs, FIXTURE_NOW) }
      expect(stationWeather(bulk, icao), icao).toEqual(expected)
      dropped += full.tafs.length - expected.tafs.length
    }
    // Ham biçim yerini yenisine bırakmış TAF'ları da taşır; sayfa yalnız yürürlüktekileri gösterir.
    expect(dropped).toBeGreaterThan(0)
  })

  it('sürüm geçişi: format=raw bilmeyen API tam biçimi verirse de aynı kayıt çıkar', () => {
    const full = { ...BULK, stations: fixtureStations().map((icao) => fixtureWeather(icao)) }
    const raw = { ...BULK, stations: fixtureStations().map((icao) => fixtureRawWeather(icao)) }
    const fromFull = parseWeatherBulk(full)
    const fromRaw = parseWeatherBulk(raw)
    expect(fromFull?.stations.size).toBe(fixtureStations().length)
    for (const icao of fixtureStations()) {
      expect(stationWeather(fromFull, icao), icao).toEqual(stationWeather(fromRaw, icao))
    }
  })

  it('istasyon yanıt başına bir kez çözülür; yeni yanıt yeniden çözülür', () => {
    const first = parseWeatherBulk(BULK)
    const second = parseWeatherBulk(BULK)
    const ltfm = stationWeather(first, 'LTFM')
    expect(stationWeather(first, 'LTFM')).toBe(ltfm)
    expect(stationWeather(first, 'LTCW')).toBe(stationWeather(first, 'LTCW'))
    const again = stationWeather(second, 'LTFM')
    expect(again).not.toBe(ltfm)
    expect(again).toEqual(ltfm)
  })
})
