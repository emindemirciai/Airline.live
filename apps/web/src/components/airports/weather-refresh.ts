import type { AirportWeather, WeatherHistoryResponse } from '@havayolu/shared'
import { fetchAirportWeather, fetchWeatherHistory } from './weather-client'

/**
 * Havalimanı sayfasındaki hava durumu adasının yenileme döngüsü (M6c; D-111). Yalnız ada kullanır:
 * `weather-client.ts` haritanın penceresiyle ortak olduğu için `/`'nin ilk paketindedir, bu modül
 * değildir.
 */

/** Açık sekmede yenileme aralığı (METAR en sık 5 dakikada bir gelir). */
export const WEATHER_REFRESH_MS = 5 * 60_000
/**
 * Sunucu çizimindeki güncel hava bundan eskiyse ada açılışta onu da yeniler (toplu yanıt web
 * belleğinde 60 sn tutulur); yeniyse açılıştaki istek yalnız kaydı alır.
 */
export const WEATHER_STALE_ON_MOUNT_MS = 120_000
/** Başarısız istekten sonra yeniden deneme için en kısa süre. */
export const WEATHER_RETRY_MS = 60_000

/**
 * Sunucu çizimindeki güncel hava taze mi: `WEATHER_STALE_ON_MOUNT_MS`'den yeniyse üretildiği an,
 * yenileme zamanlayıcısının kullandığı `Date.now()` saatinde; eksik, bozuk ya da eskiyse null (ada
 * açılışta onu da ister). Yaş sunucu saatiyle ölçülür (`serverNow`: çizim anına bağlı duvar saati).
 * METAR/TAF kaydı sunucu çiziminde yoktur (D-111): ada onu her açılışta ister.
 */
export function initialWeatherAt({
  weatherGeneratedAt,
  serverNow,
  localNow,
}: {
  weatherGeneratedAt: string | null
  serverNow: number
  localNow: number
}): number | null {
  const weather = Date.parse(weatherGeneratedAt ?? '')
  if (!Number.isFinite(weather)) return null
  const age = Math.max(0, serverNow - weather)
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

/** Bir yenilemenin sonucu: null alan istenmedi ya da alınamadı (eldeki veri korunur). */
export interface WeatherRefreshResult {
  weather: AirportWeather | null
  history: WeatherHistoryResponse | null
}

export interface WeatherRefresherOptions {
  apiBaseUrl: string
  icao: string
  /**
   * Sunucu çizimindeki güncel havanın tazeliği (`initialWeatherAt`): null değilse açılıştaki istek
   * yalnız kaydı alır, sonraki yenileme güncel havanın yaşına göre gelir.
   */
  freshWeatherAt: number | null
  /** Kesilmeyen her istekten sonra (başarısız da olsa) çağrılır. */
  apply: (result: WeatherRefreshResult) => void
  fetchWeather?: typeof fetchAirportWeather
  fetchHistory?: typeof fetchWeatherHistory
  now?: () => number
}

/**
 * Adanın yenileme döngüsü (D-111): METAR/TAF kaydı yalnız tarayıcıdan gelir. İlk `check` kaydı hemen
 * ister (güncel hava tazeyse yalnız kaydı); sonra her `check` zamanı geldiyse
 * (`weatherRefreshDue`: başarılıdan 5 dk, başarısızdan en erken 1 dk sonra) ikisini birlikte ister.
 * Yeni istek süreni keser; `destroy` süren isteği keser ve yenilemeyi durdurur. DOM'a dokunmaz:
 * görünürlük denetimi adadadır.
 */
export class WeatherRefresher {
  private controller: AbortController | null = null
  private lastSuccessAt: number | null = null
  private lastFailureAt: number | null = null
  private freshWeatherAt: number | null
  private destroyed = false
  private readonly now: () => number
  private readonly fetchWeather: typeof fetchAirportWeather
  private readonly fetchHistory: typeof fetchWeatherHistory

  constructor(private readonly options: WeatherRefresherOptions) {
    this.freshWeatherAt = options.freshWeatherAt
    this.now = options.now ?? Date.now
    this.fetchWeather = options.fetchWeather ?? fetchAirportWeather
    this.fetchHistory = options.fetchHistory ?? fetchWeatherHistory
  }

  /** Zamanı geldiyse yeniler; dönen söz istek bitince çözülür (zamanı gelmediyse null). */
  check(): Promise<void> | null {
    if (this.destroyed) return null
    if (!weatherRefreshDue(this.now(), this.lastSuccessAt, this.lastFailureAt)) return null
    return this.refresh()
  }

  destroy(): void {
    this.destroyed = true
    this.controller?.abort()
  }

  private async refresh(): Promise<void> {
    this.controller?.abort()
    const current = new AbortController()
    this.controller = current
    const weatherAt = this.freshWeatherAt
    this.freshWeatherAt = null
    const { apiBaseUrl, icao } = this.options
    try {
      const [weather, history] = await Promise.all([
        weatherAt === null ? this.fetchWeather(apiBaseUrl, icao, current.signal) : null,
        this.fetchHistory(apiBaseUrl, icao, current.signal),
      ])
      if (current.signal.aborted) return
      if ((weather !== null || weatherAt !== null) && history !== null) {
        // Güncel hava istenmediyse sonraki yenileme onun yaşına göre (5 dk) gelir.
        this.lastSuccessAt = weatherAt ?? this.now()
      } else {
        this.lastFailureAt = this.now()
      }
      this.options.apply({ weather, history })
    } catch {
      if (current.signal.aborted) return
      this.lastFailureAt = this.now()
      this.options.apply({ weather: null, history: null })
    }
  }
}
