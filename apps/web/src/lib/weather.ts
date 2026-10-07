import 'server-only'
import {
  RawAirportWeatherSchema,
  toAirportWeather,
  WeatherHistoryResponseSchema,
  type AirportWeather,
  type RawAirportWeather,
  type WeatherHistoryResponse,
} from '@havayolu/shared'
import { cache } from 'react'
import { z } from 'zod'
// Göreli yol: vitest `@/` takma adını çözmez; bu modül testte yüklenir.
import { WEATHER_LOG_HOURS } from '../components/airports/weather-client'
import { AIRPORTS_SCOPE } from './airports'
import { getServerEnv } from './env'

/**
 * Havalimanı sayfalarının hava durumu verisi (Parça 1 M6c, D-078; M6h ölçek düzeltmesi, D-090). Sayfa
 * sunucuda iki kaynak okur:
 *
 * - Toplu güncel hava durumu, **ham biçimde**: `GET /v1/weather?scope=listed&format=raw`
 *   (listelenen havalimanları: Türkiye ve Türkiye dışındakiler, D-080; ham biçim D-101). API hiçbir
 *   raporu çözümlemez; sayfa yalnız çizdiği havalimanını paylaşılan görünümlerle çözer
 *   (`toAirportWeather`: METAR, süresi dolmamış TAF'lar ve yürürlükteki TAF seçimi; API'nin tam
 *   biçimiyle aynı kayıt). 4. halkada (1.217 istasyon) ham gövde istasyon başına ~0,9 KB, toplam
 *   ~1,1 MB'tır; tam biçim ~4 MB olurdu. **Next veri önbelleğinde değil, web sunucusunun
 *   belleğinde** 60 sn tutulur (`createMemoryCache`, tek kayıt): Next veri önbelleği gövdeyi base64
 *   saklar ve kaydı 2 MiB'ta keser (D-088); sınırı aşan yanıt önbelleğe alınmaz ve her sayfa çizimi
 *   API'ye giderdi (web konteynerinin API kovası 60/dk, D-060). API'ye dakikada en çok bir istek
 *   gider (aynı anda gelen çizimler süren tek isteği paylaşır), gövde dakikada bir kez ayrıştırılır;
 *   çözülen istasyonlar o yanıtla birlikte bellekte kalır (aynı dakikadaki ikinci çizim yeniden
 *   çözmez). Web tek süreçtir; birden çok kopya çalışırsa her biri dakikada bir istek atar.
 * - METAR/TAF kaydı: `GET /v1/airports/<ICAO>/weather/history?hours=24`, Next veri önbelleği 30 dk
 *   (havalimanı başına ~70 KB). 4. halkada 1.217 istasyonun sayfalarının hepsi gezilse ortalama
 *   dakikada ~41 istek eder; web konteynerinin bu rotadaki kovası dakikada 60'tır (kova rota
 *   başınadır; toplu istek ve liste ayrı kovalardadır). 15 dk'lık önbellekle ~81/dk olurdu (D-102;
 *   3. halkada 498 sayfayla 15 dk ~33/dk, 5 dk ~100/dk, D-090, D-107). ~41 bir ortalamadır, tavan
 *   değil: soğuk önbellekte (her yayından sonra) hızlı bir tarama yine dakikada 60'ı aşabilir; o
 *   sayfalar sunucu çiziminde kayıtsız gelir, ada kaydı tarayıcıdan alır. Next süresi dolan kaydı
 *   sunar ve arkada yeniler; 200 olmayan yanıtı (429) önbelleğe almaz, eldeki kaydı silmez. Açık
 *   sekmedeki
 *   ada kaydı tarayıcıdan (ziyaretçinin kendi hız sınırı kovasıyla) 5 dakikada bir tazeler; sunucu
 *   verisi 2 dakikadan eskiyse ada açılışta yeniler (`weather-client.ts`): ziyaretçi 30 dk'lık
 *   önbelleği görmez. METAR en sık 5 dakikada bir gelir.
 *
 * Hiçbir hata sayfaya taşınmaz: API ulaşılamazsa, yanıt bozuksa ya da süre dolarsa `null` döner ve
 * sayfa "Hava durumu şu an alınamıyor" der; sayfa hava durumu yüzünden 500 vermez. API ulaşılamazken
 * eldeki toplu yanıt en çok 10 dk daha kullanılır (gözlem yaşı sayfada yazılır), yeniden deneme en
 * erken 15 sn sonradır. İstemci başlıkları iletilmez (önbellek anahtarı ziyaretçi başına bölünmesin,
 * lib/airports.ts).
 */

/** Toplu hava durumunun web belleğindeki süresi, ms (API'nin önbelleğiyle aynı, 60 sn). */
export const WEATHER_BULK_TTL_MS = 60_000
/** Toplu hava isteği başarısız olunca yeniden deneme için en kısa süre, ms. */
export const WEATHER_BULK_RETRY_MS = 15_000
/** API'ye ulaşılamazken eldeki toplu yanıtın en çok kullanılacağı yaş, ms. */
export const WEATHER_BULK_MAX_STALE_MS = 10 * 60_000
/**
 * METAR/TAF kaydının Next veri önbelleği süresi, saniye (3. halkada 300 → 900, D-090; 4. halkada
 * 1.800, D-102: bütün sayfalar gezilse de ortalama, rotanın dakikada 60'lık kovasının altında kalır).
 */
export const WEATHER_HISTORY_REVALIDATE_S = 1800
/** `revalidateTag` ile elle tazelemek için önbellek etiketi (METAR/TAF kaydı). */
export const WEATHER_CACHE_TAG = 'weather'
/** Hava durumu ikincil bilgidir: sayfa onu en fazla bu kadar bekler. */
export const WEATHER_TIMEOUT_MS = 4000

/** Toplu yanıt (ham biçim): istasyonlar ICAO'ya göre, çözümlenmemiş. */
export interface WeatherBulk {
  generatedAt: string
  attribution: { text: string; url: string } | null
  stations: ReadonlyMap<string, RawAirportWeather>
}

const ICAO = /^[A-Z0-9]{4}$/

const envelopeSchema = z.object({
  generatedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  attribution: z.object({ text: z.string(), url: z.string() }).nullish().catch(null),
  stations: z.array(z.unknown()),
})

export function weatherBulkUrl(apiInternalUrl: string): string {
  const url = new URL('/v1/weather', apiInternalUrl)
  url.searchParams.set('scope', AIRPORTS_SCOPE)
  url.searchParams.set('format', 'raw')
  return url.toString()
}

export function weatherHistoryUrl(
  apiInternalUrl: string,
  icao: string,
  hours = WEATHER_LOG_HOURS,
): string {
  const url = new URL(`/v1/airports/${encodeURIComponent(icao)}/weather/history`, apiInternalUrl)
  url.searchParams.set('hours', String(hours))
  return url.toString()
}

/**
 * Ham toplu yanıtı denetler. Zarf bozuksa null; tek bir bozuk istasyon kaydı (sürüm geçişi) yanıtı
 * düşürmez, atlanır.
 */
export function parseWeatherBulk(body: unknown): WeatherBulk | null {
  const envelope = envelopeSchema.safeParse(body)
  if (!envelope.success) return null
  const stations = new Map<string, RawAirportWeather>()
  for (const item of envelope.data.stations) {
    const parsed = RawAirportWeatherSchema.safeParse(item)
    if (parsed.success && ICAO.test(parsed.data.icao)) stations.set(parsed.data.icao, parsed.data)
  }
  return {
    generatedAt: envelope.data.generatedAt,
    attribution: envelope.data.attribution ?? null,
    stations,
  }
}

/** Çözülmüş istasyonlar, toplu yanıt başına (yanıt yenilenince eskisiyle birlikte çöpe gider). */
const decodedStations = new WeakMap<WeatherBulk, Map<string, AirportWeather>>()

/**
 * Toplu yanıttan havalimanının güncel havası (API'nin tam biçimiyle aynı kayıt). Yanıt yoksa
 * (API'ye ulaşılamadı) null; istasyon listede yoksa raporsuz bir kayıt (sayfa "güncel rapor yok"
 * der, "alınamıyor" demez). Yalnız istenen istasyon çözülür; sonuç yanıtla birlikte tutulur.
 */
export function stationWeather(bulk: WeatherBulk | null, icao: string): AirportWeather | null {
  if (bulk === null) return null
  let decoded = decodedStations.get(bulk)
  if (decoded === undefined) {
    decoded = new Map()
    decodedStations.set(bulk, decoded)
  }
  const cached = decoded.get(icao)
  if (cached !== undefined) return cached
  const station = bulk.stations.get(icao)
  const weather: AirportWeather =
    station === undefined
      ? { icao, generatedAt: bulk.generatedAt, metar: null, tafs: [] }
      : toAirportWeather(station, bulk.generatedAt)
  decoded.set(icao, weather)
  return weather
}

/** Kayıt yanıtını denetler; bozuksa null. */
export function parseWeatherHistory(body: unknown): WeatherHistoryResponse | null {
  const parsed = WeatherHistoryResponseSchema.safeParse(body)
  return parsed.success ? parsed.data : null
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`weather request failed: HTTP ${response.status}`)
  return response.json()
}

export interface MemoryCacheOptions<T> {
  /** Değeri getirir; hata fırlatırsa istek başarısız sayılır. */
  load: () => Promise<T>
  /** Taze sayılma süresi, ms. */
  ttlMs: number
  /** Başarısız istekten sonra yeniden deneme için en kısa süre, ms. */
  retryMs: number
  /** Yenileme başarısızken eldeki değerin en çok kullanılacağı yaş, ms. */
  maxStaleMs: number
  /** Saat, epoch ms (testte sahte saat). */
  now?: () => number
}

/**
 * Süreç belleğinde tek değerlik önbellek: değer `ttlMs` boyunca taze kalır; süresi dolunca ilk
 * çağrı yeniler ve aynı anda gelen çağrılar süren tek isteği bekler (tek uçuş). Yenileme başarısızsa
 * değer `maxStaleMs` yaşına kadar verilir, daha eskiyse null; `retryMs` dolmadan yeniden istek atılmaz.
 * Hiçbir zaman fırlatmaz. Bellek: en çok bir değer (yenilenirken kısa süre iki).
 */
export function createMemoryCache<T>({
  load,
  ttlMs,
  retryMs,
  maxStaleMs,
  now = Date.now,
}: MemoryCacheOptions<T>): () => Promise<T | null> {
  let stored: { value: T; at: number } | null = null
  let failedAt: number | null = null
  let pending: Promise<void> | null = null
  const usable = (): T | null =>
    stored !== null && now() - stored.at <= maxStaleMs ? stored.value : null
  return async () => {
    if (stored !== null && now() - stored.at < ttlMs) return stored.value
    if (failedAt !== null && now() - failedAt < retryMs) return usable()
    pending ??= load()
      .then(
        (value) => {
          stored = { value, at: now() }
          failedAt = null
        },
        () => {
          failedAt = now()
        },
      )
      .finally(() => {
        pending = null
      })
    await pending
    return usable()
  }
}

async function loadWeatherBulk(): Promise<WeatherBulk> {
  const bulk = parseWeatherBulk(
    // Next veri önbelleğine konmaz (gövde her dakika değişir ve büyüktür); bellek önbelleği tutar.
    await fetchJson(weatherBulkUrl(getServerEnv().API_INTERNAL_URL), { cache: 'no-store' }),
  )
  if (bulk === null) throw new Error('weather response has an unexpected shape')
  return bulk
}

/** Toplu hava durumunun süreç içi önbelleği (modül düzeyi; bütün sayfalar paylaşır). */
const weatherBulkCache = createMemoryCache({
  load: loadWeatherBulk,
  ttlMs: WEATHER_BULK_TTL_MS,
  retryMs: WEATHER_BULK_RETRY_MS,
  maxStaleMs: WEATHER_BULK_MAX_STALE_MS,
})

/** Listelenen bütün havalimanlarının güncel hava durumu; hata olursa null (fırlatmaz). */
export const getWeather = cache((): Promise<WeatherBulk | null> => weatherBulkCache())

/** Havalimanı sayfasının hava durumu verisi ve çizim anı. */
export interface AirportWeatherPageData {
  bulk: WeatherBulk | null
  history: WeatherHistoryResponse | null
  /** Sunucu çizim anı (epoch ms); ada hidrasyonda aynı saati kullanır. */
  renderedAt: number
}

/** Toplu hava durumu ve havalimanının kaydı, paralel; hiçbiri fırlatmaz. */
export async function getAirportWeatherPage(icao: string): Promise<AirportWeatherPageData> {
  const [bulk, history] = await Promise.all([getWeather(), getWeatherHistory(icao)])
  return { bulk, history, renderedAt: Date.now() }
}

/** Bir havalimanının son 24 saatlik METAR/TAF kaydı; hata olursa null (fırlatmaz). */
export const getWeatherHistory = cache(
  async (icao: string): Promise<WeatherHistoryResponse | null> => {
    if (!ICAO.test(icao)) return null
    try {
      return parseWeatherHistory(
        await fetchJson(weatherHistoryUrl(getServerEnv().API_INTERNAL_URL, icao), {
          next: { revalidate: WEATHER_HISTORY_REVALIDATE_S, tags: [WEATHER_CACHE_TAG] },
        }),
      )
    } catch {
      return null
    }
  },
)
