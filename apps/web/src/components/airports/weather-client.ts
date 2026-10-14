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
 * Haritanın havalimanı penceresi de `fetchAirportWeather`'ı kullanır: bu modül `/`'nin ilk
 * paketindedir. Adanın yenileme döngüsü bu yüzden ayrı modüldedir (weather-refresh.ts, D-111).
 */

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
