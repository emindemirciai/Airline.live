'use client'

/**
 * Havalimanı penceresinin hava durumu verisi (M6c, M6d; M6h'den beri tek havalimanı, D-090): açılan
 * havalimanının güncel havası, `GET /v1/airports/<ICAO>/weather` (havalimanı sayfasının adasıyla aynı
 * uç nokta ve aynı denetim, `../airports/weather-client`). Pencere yalnız kendi havalimanını gösterir;
 * 3. halkadan beri ~500 istasyonun (D-107'den beri 498) toplu yanıtı (`/v1/weather?scope=listed`,
 * 1,4–2,4 MB, sıkıştırmasız) tek bir havalimanı için indirilmez (yanıt ~3–7 KB).
 *
 * İstek ilk pencere açılışında atılır (harita açılışında değil); pencere açıkken ve sayfa görünürken
 * aynı havalimanının verisi en fazla 5 dakikada bir yenilenir. Pencere kapalıyken ya da sekme arka
 * plandayken istek atılmaz; kapanırken ya da başka havalimanına geçerken süren istek kesilmez,
 * sonucu saklanır. Başarısız istekten sonra en erken 1 dakika beklenir; eldeki veri korunur. Son
 * açılan `WEATHER_CACHE_AIRPORTS` havalimanının verisi hatırlanır: yeniden açılışta veri 5 dakikadan
 * eskiyse önce eldeki gösterilir, sonra yenilenir.
 */
import type { AirportWeather } from '@havayolu/shared'
import { useEffect, useRef, useState } from 'react'
import { monotonicNow } from '../../lib/live/clock'
import type { WallClock } from '../../lib/wall-clock'
import { fetchAirportWeather } from '../airports/weather-client'

/** Başarılı yanıttan sonra yeniden istek için en kısa süre. */
export const WEATHER_REFRESH_MS = 5 * 60_000
/** Başarısız istekten sonra yeniden deneme için en kısa süre. */
export const WEATHER_RETRY_MS = 60_000
/** Verisi hatırlanan en çok havalimanı (son açılanlar); her kayıt birkaç KB'tır. */
export const WEATHER_CACHE_AIRPORTS = 32

/** Açık penceredeki havalimanının hava durumu. */
export interface AirportWeatherState {
  /** Havalimanının son başarılı yanıtı; henüz yoksa null. Raporu yoksa `metar` null'dır. */
  data: AirportWeather | null
  /** Son istek başarısız oldu (eldeki veri, varsa, daha eski bir yanıttandır). */
  failed: boolean
}

export interface WeatherTiming {
  lastSuccessAt: number | null
  lastFailureAt: number | null
}

const NO_TIMING: WeatherTiming = { lastSuccessAt: null, lastFailureAt: null }
const NO_WEATHER: AirportWeatherState = { data: null, failed: false }

/** Yeni isteğin atılabileceği en erken an (aynı saatle, ms); hiç istek atılmadıysa 0. */
export function nextWeatherFetchAt({ lastSuccessAt, lastFailureAt }: WeatherTiming): number {
  return Math.max(
    lastSuccessAt === null ? 0 : lastSuccessAt + WEATHER_REFRESH_MS,
    lastFailureAt === null ? 0 : lastFailureAt + WEATHER_RETRY_MS,
  )
}

/**
 * Havalimanının kaydını en yeni olarak yazar; `max`'tan fazlası varsa en eski kullanılanlar atılır.
 * Saf: yeni bir Map döner (React durumu).
 */
export function rememberStation<T>(
  entries: ReadonlyMap<string, T>,
  icao: string,
  entry: T,
  max = WEATHER_CACHE_AIRPORTS,
): Map<string, T> {
  const next = new Map(entries)
  next.delete(icao)
  next.set(icao, entry)
  for (const key of next.keys()) {
    if (next.size <= max) break
    next.delete(key)
  }
  return next
}

/**
 * `icao` (açık penceredeki havalimanı; pencere kapalıyken null) için veriyi getirir ve tazeler. Dönen
 * durum yalnız o havalimanınındır: başka havalimanına geçilince önceki havalimanının raporu bir an
 * bile gösterilmez. Her yanıtın `generatedAt`'i (sunucu saati) `clock`'a verilir: pencerenin saati
 * (cihaz kipindeki `WallClock`) cihaz saatini bununla sınar ve yanlışsa sunucu saatine döner.
 * Aralıklar geri gitmeyen saatle ölçülür.
 */
export function useAirportWeather(
  apiBaseUrl: string,
  icao: string | null,
  clock?: WallClock,
): AirportWeatherState {
  const [entries, setEntries] = useState<ReadonlyMap<string, AirportWeatherState>>(() => new Map())
  const timings = useRef(new Map<string, WeatherTiming>())
  const inFlight = useRef(new Map<string, AbortController>())
  /** Açık pencerenin zamanlayıcısı; istek bitince (pencere arada kapanıp açılmış olsa da) çağrılır. */
  const schedule = useRef<{ icao: string; run: () => void } | null>(null)

  // Bileşen sökülünce süren istekler kesilir.
  useEffect(() => {
    const requests = inFlight.current
    return () => {
      for (const request of requests.values()) request.abort()
    }
  }, [])

  useEffect(() => {
    if (icao === null) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const finish = (data: AirportWeather | null) => {
      const timing = { ...(timings.current.get(icao) ?? NO_TIMING) }
      if (data !== null) {
        timing.lastSuccessAt = monotonicNow()
        clock?.observe(Date.parse(data.generatedAt))
      } else {
        timing.lastFailureAt = monotonicNow()
        console.warn('Airport weather could not be loaded', icao)
      }
      timings.current = rememberStation(timings.current, icao, timing)
      setEntries((previous) =>
        rememberStation(
          previous,
          icao,
          data !== null
            ? { data, failed: false }
            : { data: previous.get(icao)?.data ?? null, failed: true },
        ),
      )
    }
    const run = () => {
      if (timer !== null) clearTimeout(timer)
      timer = null
      // Kesilmiş istek (geliştirmede StrictMode'un sök-tak turu) süren istek sayılmaz.
      const running = inFlight.current.get(icao)
      if (stopped || (running !== undefined && !running.signal.aborted)) return
      if (document.visibilityState !== 'visible') return
      const wait = nextWeatherFetchAt(timings.current.get(icao) ?? NO_TIMING) - monotonicNow()
      if (wait > 0) {
        timer = setTimeout(run, wait)
        return
      }
      const request = new AbortController()
      inFlight.current.set(icao, request)
      fetchAirportWeather(apiBaseUrl, icao, request.signal)
        .then(
          (data) => {
            if (!request.signal.aborted) finish(data)
          },
          () => {
            // Yalnız kesilen istek buraya düşer (bileşen söküldü); başka hata `null` döner.
            if (!request.signal.aborted) finish(null)
          },
        )
        .finally(() => {
          if (inFlight.current.get(icao) === request) inFlight.current.delete(icao)
          if (!request.signal.aborted && schedule.current?.icao === icao) schedule.current.run()
        })
    }
    schedule.current = { icao, run }
    run()
    document.addEventListener('visibilitychange', run)
    return () => {
      stopped = true
      if (schedule.current?.run === run) schedule.current = null
      if (timer !== null) clearTimeout(timer)
      document.removeEventListener('visibilitychange', run)
    }
  }, [apiBaseUrl, icao, clock])

  return icao === null ? NO_WEATHER : (entries.get(icao) ?? NO_WEATHER)
}
