import {
  AirportWeatherSchema,
  WeatherHistoryResponseSchema,
  type AirportWeather,
  type WeatherHistoryResponse,
} from '@havayolu/shared'

/**
 * Havalimanı sayfasındaki hava durumu adasının tarayıcı istekleri (M6c). Tarayıcı yalnızca kendi
 * API'mize gider (`API_HOST`, CORS D-074); aviationweather.gov'a hiçbir zaman istek atmaz. Yanıt
 * ortak zod şemasıyla denetlenir; bozuk ya da başarısız yanıt null döner, eldeki veri korunur.
 */

/** Açık sekmede yenileme aralığı (METAR en sık 5 dakikada bir gelir). */
export const WEATHER_REFRESH_MS = 5 * 60_000
/** Sunucu çizimindeki veri bundan eskiyse ada açılır açılmaz yeniler (Next önbelleği eski sunabilir). */
export const WEATHER_STALE_ON_MOUNT_MS = 120_000
/** Başarısız istekten sonra yeniden deneme için en kısa süre. */
export const WEATHER_RETRY_MS = 60_000
/** Sayfadaki kaydın kapsadığı süre, saat. */
export const WEATHER_LOG_HOURS = 24
/** API'nin tek istekte verdiği en uzun kayıt, saat. */
export const WEATHER_HISTORY_MAX_HOURS = 168

export function airportWeatherUrl(apiBaseUrl: string, icao: string): string {
  return new URL(`/v1/airports/${encodeURIComponent(icao)}/weather`, apiBaseUrl).toString()
}

export function airportWeatherHistoryUrl(
  apiBaseUrl: string,
  icao: string,
  hours = WEATHER_LOG_HOURS,
): string {
  const url = new URL(`/v1/airports/${encodeURIComponent(icao)}/weather/history`, apiBaseUrl)
  url.searchParams.set('hours', String(hours))
  return url.toString()
}

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

/** Bir havalimanının güncel havası; başarısızsa null. Kesilen istek hata fırlatır (AbortError). */
export async function fetchAirportWeather(
  apiBaseUrl: string,
  icao: string,
  signal: AbortSignal,
): Promise<AirportWeather | null> {
  try {
    const parsed = AirportWeatherSchema.safeParse(
      await getJson(airportWeatherUrl(apiBaseUrl, icao), signal),
    )
    return parsed.success ? parsed.data : null
  } catch (error) {
    if (signal.aborted) throw error
    return null
  }
}

/** Son 24 saatin METAR/TAF kaydı; başarısızsa null. */
export async function fetchWeatherHistory(
  apiBaseUrl: string,
  icao: string,
  signal: AbortSignal,
): Promise<WeatherHistoryResponse | null> {
  try {
    const parsed = WeatherHistoryResponseSchema.safeParse(
      await getJson(airportWeatherHistoryUrl(apiBaseUrl, icao), signal),
    )
    return parsed.success ? parsed.data : null
  } catch (error) {
    if (signal.aborted) throw error
    return null
  }
}

/**
 * Sunucu çiziminin verisi bir başarılı istek sayılır mı: güncel hava ve kayıt ayrı önbelleklerden
 * gelir (60 sn ve 5 dk), ikisi de `WEATHER_STALE_ON_MOUNT_MS`'den yeniyse evet. Yaş sunucu saatiyle
 * ölçülür (`serverNow`: çizim anına bağlı duvar saati); dönen an, yenileme zamanlayıcısının
 * kullandığı `Date.now()` saatindedir. Biri eksik, bozuk ya da eskiyse null (ada hemen yeniler).
 */
export function initialSuccessAt({
  weatherGeneratedAt,
  historyGeneratedAt,
  serverNow,
  localNow,
}: {
  weatherGeneratedAt: string | null
  historyGeneratedAt: string | null
  serverNow: number
  localNow: number
}): number | null {
  const weather = Date.parse(weatherGeneratedAt ?? '')
  const history = Date.parse(historyGeneratedAt ?? '')
  if (!Number.isFinite(weather) || !Number.isFinite(history)) return null
  const age = Math.max(0, serverNow - Math.min(weather, history))
  return age < WEATHER_STALE_ON_MOUNT_MS ? localNow - age : null
}

/**
 * Yeni istek zamanı geldi mi: hiç başarılı istek yoksa ya da son başarılı veri `WEATHER_REFRESH_MS`
 * eskiyse; son başarısız istekten sonra en az `WEATHER_RETRY_MS` beklenir.
 */
export function weatherRefreshDue(
  now: number,
  lastSuccessAt: number | null,
  lastFailureAt: number | null,
): boolean {
  if (lastFailureAt !== null && now - lastFailureAt < WEATHER_RETRY_MS) return false
  return lastSuccessAt === null || now - lastSuccessAt >= WEATHER_REFRESH_MS
}
