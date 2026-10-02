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
 * Havalimanı sayfalarının hava durumu verisi (Parça 1 M6c, D-078). Sayfa sunucuda iki istek atar:
 *
 * - Toplu güncel hava durumu: `GET /v1/weather?scope=listed` (listelenen havalimanları: Türkiye ve
 *   yakın ülkeler, D-080), Next veri önbelleği 60 sn, etiket `weather`. Bütün havalimanı sayfaları
 *   aynı kaydı paylaşır: API'ye dakikada en çok bir istek gider.
 * - METAR/TAF kaydı: `GET /v1/airports/<ICAO>/weather/history?hours=24`, 5 dk önbellek. Havalimanı
 *   başına ayrı kayıt; 136 listelenen havalimanı en kötü durumda dakikada ~27 istek eder. Web
 *   konteynerinin API'deki tek hız sınırı kovası (60/dk, D-060) böylece zorlanmaz. METAR en sık 5
 *   dakikada bir gelir.
 *
 * Hiçbir hata sayfaya taşınmaz: API ulaşılamazsa, yanıt bozuksa ya da süre dolarsa `null` döner ve
 * sayfa "Hava durumu şu an alınamıyor" der; sayfa hava durumu yüzünden 500 vermez. İstemci başlıkları
 * iletilmez (önbellek anahtarı ziyaretçi başına bölünmesin, lib/airports.ts). Tarayıcıdaki ada
 * (`airport-weather-live.tsx`) veriyi açık sekmede 5 dakikada bir tazeler.
 */

/** Toplu hava durumunun Next veri önbelleği süresi, saniye. */
export const WEATHER_REVALIDATE_S = 60
/** METAR/TAF kaydının Next veri önbelleği süresi, saniye. */
export const WEATHER_HISTORY_REVALIDATE_S = 300
/** `revalidateTag` ile elle tazelemek için önbellek etiketi. */
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

async function fetchJson(url: string, revalidateS: number): Promise<unknown> {
  const response = await fetch(url, {
    next: { revalidate: revalidateS, tags: [WEATHER_CACHE_TAG] },
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`weather request failed: HTTP ${response.status}`)
  return response.json()
}

/** Listelenen bütün havalimanlarının güncel hava durumu; hata olursa null (fırlatmaz). */
export const getWeather = cache(async (): Promise<WeatherBulk | null> => {
  try {
    return parseWeatherBulk(
      await fetchJson(weatherBulkUrl(getServerEnv().API_INTERNAL_URL), WEATHER_REVALIDATE_S),
    )
  } catch {
    return null
  }
})

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
        await fetchJson(
          weatherHistoryUrl(getServerEnv().API_INTERNAL_URL, icao),
          WEATHER_HISTORY_REVALIDATE_S,
        ),
      )
    } catch {
      return null
    }
  },
)
