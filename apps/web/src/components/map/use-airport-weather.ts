'use client'

/**
 * Havalimanı penceresinin hava durumu verisi (M6c, M6d): haritadaki bütün havalimanları (listelenen
 * havalimanları, D-080) tek istekte, `GET /v1/weather?scope=listed`. İstek ilk pencere açılışında
 * atılır (harita açılışında değil);
 * pencere açıkken ve sayfa görünürken veri en fazla 5 dakikada bir yenilenir. Pencere kapalıyken
 * ya da sekme arka plandayken istek atılmaz; kapanırken süren istek kesilmez, sonucu saklanır.
 * Başarısız istekten sonra en erken 1 dakika beklenir; eldeki veri korunur.
 *
 * Yanıt ortak zod şemasıyla (`AirportWeatherSchema`, @havayolu/shared) denetlenir: zarf bozuksa
 * yanıt yok sayılır, tek tek bozuk istasyon kayıtları atlanır (lib/live/validate.ts yaklaşımı).
 */
import { AirportWeatherSchema, type AirportWeather } from '@havayolu/shared'
import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../lib/live/api'
import { monotonicNow } from '../../lib/live/clock'
import { isObject } from '../../lib/live/validate'
import type { WallClock } from '../../lib/wall-clock'

/** Başarılı yanıttan sonra yeniden istek için en kısa süre. */
export const WEATHER_REFRESH_MS = 5 * 60_000
/** Başarısız istekten sonra yeniden deneme için en kısa süre. */
export const WEATHER_RETRY_MS = 60_000

export interface BulkWeather {
  /** API yanıtının üretildiği an (ISO 8601). */
  generatedAt: string
  /** ICAO → istasyonun hava durumu. Listede olmayan havalimanının raporu yoktur. */
  stations: ReadonlyMap<string, AirportWeather>
}

export interface BulkWeatherState {
  data: BulkWeather | null
  /** Son istek başarısız oldu (eldeki veri, varsa, daha eski bir yanıttandır). */
  failed: boolean
}

export interface WeatherTiming {
  lastSuccessAt: number | null
  lastFailureAt: number | null
}

/** Yeni isteğin atılabileceği en erken an (aynı saatle, ms); hiç istek atılmadıysa 0. */
export function nextWeatherFetchAt({ lastSuccessAt, lastFailureAt }: WeatherTiming): number {
  return Math.max(
    lastSuccessAt === null ? 0 : lastSuccessAt + WEATHER_REFRESH_MS,
    lastFailureAt === null ? 0 : lastFailureAt + WEATHER_RETRY_MS,
  )
}

/** Toplu hava adresi: haritanın havalimanı listesiyle aynı küme (`scope=listed`). */
export function weatherUrl(apiBaseUrl: string): URL {
  const url = new URL('/v1/weather', apiBaseUrl)
  url.searchParams.set('scope', 'listed')
  return url
}

/** Yanıt gövdesi: zarf bozuksa null; bozuk istasyon kayıtları atlanır. */
export function parseBulkWeather(body: unknown): BulkWeather | null {
  if (!isObject(body) || typeof body.generatedAt !== 'string' || !Array.isArray(body.stations)) {
    return null
  }
  const stations = new Map<string, AirportWeather>()
  for (const item of body.stations as unknown[]) {
    const parsed = AirportWeatherSchema.safeParse(item)
    if (parsed.success) stations.set(parsed.data.icao, parsed.data)
  }
  return { generatedAt: body.generatedAt, stations }
}

/** `GET /v1/weather?scope=listed`. 2xx olmayan ya da biçimi bozuk yanıt `ApiError` fırlatır. */
export async function fetchBulkWeather(
  apiBaseUrl: string,
  signal?: AbortSignal,
): Promise<BulkWeather> {
  const response = await fetch(weatherUrl(apiBaseUrl), {
    signal,
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new ApiError(response.status)
  let body: unknown
  try {
    body = (await response.json()) as unknown
  } catch {
    throw new ApiError(response.status, 'API response is not valid JSON')
  }
  const parsed = parseBulkWeather(body)
  if (!parsed) throw new ApiError(response.status, 'API response has an unexpected shape')
  return parsed
}

const INITIAL_STATE: BulkWeatherState = { data: null, failed: false }

/**
 * `active` (pencere açık) iken veriyi getirir ve tazeler. Dönen durum pencere kapandıktan sonra
 * da korunur; yeniden açılışta veri 5 dakikadan eskiyse önce eldeki gösterilir, sonra yenilenir.
 * Her yanıtın `generatedAt`'i (sunucu saati) `clock`'a verilir: pencerenin saati (cihaz kipindeki
 * `WallClock`) cihaz saatini bununla sınar ve yanlışsa sunucu saatine döner. Aralıklar geri gitmeyen
 * saatle ölçülür.
 */
export function useBulkWeather(
  apiBaseUrl: string,
  active: boolean,
  clock?: WallClock,
): BulkWeatherState {
  const [state, setState] = useState<BulkWeatherState>(INITIAL_STATE)
  const timing = useRef<WeatherTiming>({ lastSuccessAt: null, lastFailureAt: null })
  const inFlight = useRef<AbortController | null>(null)
  /** Açık pencerenin zamanlayıcısı; istek bitince (pencere arada kapanıp açılmış olsa da) çağrılır. */
  const schedule = useRef<(() => void) | null>(null)

  // Bileşen sökülünce süren istek kesilir.
  useEffect(() => () => inFlight.current?.abort(), [])

  useEffect(() => {
    if (!active) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const run = () => {
      if (timer !== null) clearTimeout(timer)
      timer = null
      if (stopped || inFlight.current !== null) return
      if (document.visibilityState !== 'visible') return
      const wait = nextWeatherFetchAt(timing.current) - monotonicNow()
      if (wait > 0) {
        timer = setTimeout(run, wait)
        return
      }
      const request = new AbortController()
      inFlight.current = request
      fetchBulkWeather(apiBaseUrl, request.signal)
        .then(
          (data) => {
            if (request.signal.aborted) return
            timing.current.lastSuccessAt = monotonicNow()
            clock?.observe(Date.parse(data.generatedAt))
            setState({ data, failed: false })
          },
          (error: unknown) => {
            if (request.signal.aborted) return
            timing.current.lastFailureAt = monotonicNow()
            console.warn('Airport weather could not be loaded', error)
            setState((previous) => ({ data: previous.data, failed: true }))
          },
        )
        .finally(() => {
          if (inFlight.current === request) inFlight.current = null
          if (!request.signal.aborted) schedule.current?.()
        })
    }
    schedule.current = run
    run()
    document.addEventListener('visibilitychange', run)
    return () => {
      stopped = true
      if (schedule.current === run) schedule.current = null
      if (timer !== null) clearTimeout(timer)
      document.removeEventListener('visibilitychange', run)
    }
  }, [active, apiBaseUrl, clock])

  return state
}
