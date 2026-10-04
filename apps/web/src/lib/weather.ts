import 'server-only'
import {
  AirportWeatherSchema,
  WeatherHistoryResponseSchema,
  type AirportWeather,
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
 * - Toplu güncel hava durumu: `GET /v1/weather?scope=listed` (listelenen havalimanları: Türkiye ve
 *   Türkiye dışındakiler, D-080). **Next veri önbelleğinde değil, web sunucusunun belleğinde** 60 sn
 *   tutulur (`createMemoryCache`, tek kayıt). 3. halkada 503 istasyonun gövdesi olağan ~1,4 MB, TAF
 *   yayım saatlerinde ~2,4 MB, test en kötü durumunda ~3,4 MB'tır; Next veri önbelleği gövdeyi
 *   base64 saklar ve kaydı 2 MiB'ta keser (önbelleğe girebilen ham gövde ~1,57 MB, D-088). Sınırı
 *   aşan yanıt önbelleğe alınmaz ve her sayfa çizimi API'ye giderdi (web konteynerinin API kovası
 *   60/dk, D-060). Bellek önbelleğinde boyut sınırı yoktur; API'ye dakikada en çok bir istek gider
 *   (aynı anda gelen çizimler süren tek isteği paylaşır), gövde dakikada bir kez ayrıştırılır (önceden
 *   her sayfa çizimi bütün gövdeyi ayrıştırıyordu; 503 istasyonda ~10–25 ms). Bellek: tek
 *   ayrıştırılmış yanıt, JSON'un ~1,5 katı (503 istasyonda ~2–5 MB; yenilenirken kısa süre iki
 *   kopya), web yığını 224 MB. Web tek süreçtir; birden çok kopya çalışırsa her biri dakikada bir
 *   istek atar.
 * - METAR/TAF kaydı: `GET /v1/airports/<ICAO>/weather/history?hours=24`, Next veri önbelleği 15 dk
 *   (havalimanı başına ~70 KB). 503 sayfanın hepsi gezilse bile en kötü durumda dakikada ~34 istek
 *   eder (toplu istek ve liste ile ~36; 5 dk'lık önbellekle ~100/dk olurdu, D-090). Açık sekmedeki
 *   ada kaydı tarayıcıdan (ziyaretçinin kendi hız sınırı kovasıyla) 5 dakikada bir tazeler; sunucu
 *   verisi 2 dakikadan eskiyse ada açılışta yeniler (`weather-client.ts`). METAR en sık 5 dakikada bir
 *   gelir.
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
/** METAR/TAF kaydının Next veri önbelleği süresi, saniye (3. halkada 300 → 900, D-090). */
export const WEATHER_HISTORY_REVALIDATE_S = 900
/** `revalidateTag` ile elle tazelemek için önbellek etiketi (METAR/TAF kaydı). */
export const WEATHER_CACHE_TAG = 'weather'
/** Hava durumu ikincil bilgidir: sayfa onu en fazla bu kadar bekler. */
export const WEATHER_TIMEOUT_MS = 4000

/** Toplu yanıt: istasyonlar ICAO'ya göre. */
export interface WeatherBulk {
  generatedAt: string
  attribution: { text: string; url: string } | null
  stations: ReadonlyMap<string, AirportWeather>
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
 * Toplu yanıtı denetler. Zarf bozuksa null; tek bir bozuk istasyon kaydı (sürüm geçişi) yanıtı
 * düşürmez, atlanır.
 */
export function parseWeatherBulk(body: unknown): WeatherBulk | null {
  const envelope = envelopeSchema.safeParse(body)
  if (!envelope.success) return null
  const stations = new Map<string, AirportWeather>()
  for (const item of envelope.data.stations) {
    const parsed = AirportWeatherSchema.safeParse(item)
    if (parsed.success && ICAO.test(parsed.data.icao)) stations.set(parsed.data.icao, parsed.data)
  }
  return {
    generatedAt: envelope.data.generatedAt,
    attribution: envelope.data.attribution ?? null,
    stations,
  }
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
    // Next veri önbelleğine konmaz (gövde 2 MiB öğe sınırını aşabilir); bellek önbelleği tutar.
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
