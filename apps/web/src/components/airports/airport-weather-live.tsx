'use client'

import type { WeatherMessages } from '@havayolu/i18n'
import {
  hasUtcOffsetTable,
  isSupportedTimeZone,
  registerUtcOffsetTable,
  type AirportWeather,
  type Locale,
  type UtcOffsetTable,
  type WeatherHistoryResponse,
} from '@havayolu/shared'
import { useEffect, useState } from 'react'
import { useWallNow } from '../../lib/use-now'
import { WallClock } from '../../lib/wall-clock'
import {
  fetchAirportWeather,
  fetchWeatherHistory,
  initialSuccessAt,
  weatherRefreshDue,
} from './weather-client'
import { WeatherLog } from './weather-log'
import { WeatherPanel } from './weather-panel'

/** Göreli yaş ve yerel saat bu aralıkla yeniden çizilir. */
const CLOCK_STEP_MS = 30_000
/** Yenileme zamanı geldi mi diye bakma aralığı. */
const CHECK_MS = 30_000

export interface AirportWeatherLiveProps {
  locale: Locale
  t: WeatherMessages
  icao: string
  name: string
  lat: number
  lon: number
  /** Tarayıcının bağlandığı API adresi (`config.apiBaseUrl`, D-075). */
  apiBaseUrl: string
  /** Sunucu çiziminin verisi; null: API'ye ulaşılamadı. */
  initialWeather: AirportWeather | null
  initialHistory: WeatherHistoryResponse | null
  /** Sunucu çizim anı (epoch ms): hidrasyon aynı saatle çizer, uyuşmazlık olmaz. */
  renderedAt: number
  /**
   * Havalimanının saat dilimi (IANA, `airportTimeZone`; D-084). null: dilimi bilinmeyen havalimanı,
   * saatler UTC etiketiyle (D-106 (c), D-109).
   */
  timeZone: string | null
  /**
   * Sunucunun bu dilim için hesapladığı fark tablosu (`utcOffsetTable`, çizim anının ±48 saati;
   * D-109); dilim yoksa null.
   */
  utcOffsets: UtcOffsetTable | null
}

/**
 * Hava durumu ve METAR/TAF kaydının istemci adası (M6c, brief §5):
 *
 * - Sunucu verisinin (güncel hava ve kayıt; ayrı önbelleklerden gelir) biri 2 dakikadan eskiyse
 *   (Next önbelleği eski kopya sunabilir) açılışta yeniler; sonra sekme görünürken 5 dakikada bir.
 *   Başarısız istekte eldeki veri korunur, en erken 1 dakika sonra yeniden denenir. Ayrılınca süren
 *   istek kesilir.
 * - "Şimdi" sunucu saatine bağlı duvar saatidir (`WallClock`: çizim anı ve yanıtların
 *   `generatedAt`'i): yerel saat, gözlem yaşı, eskime sınıfı ve TAF süresi cihaz uyuyup uyansa ya da
 *   cihaz saati yanlış olsa da doğrudur. 30 saniyede bir ve sekme görünür olunca ilerler; sunucu ve
 *   hidrasyon çizim anını kullanır, göreli yaş yalnızca istemcide eklenir.
 * - Saat dilimini ve farklarını sunucu verir (D-109): ada çizimde sunucunun fark tablosunu kaydeder
 *   (`registerUtcOffsetTable`), böylece tablonun ±48 saatindeki bütün yerel saatler UTC + farktan
 *   yazılır. Tarayıcının tz verisi eski olsa da (Britanya Kolumbiyası 2026, Kazakistan 2024) ya da
 *   dilimi hiç tanımasa da (eski tarayıcıda America/Ciudad_Juarez) sunucu çizimi ve hidrasyon aynı
 *   metni üretir. Tablonun dışında tarayıcının `Intl`'i kullanılır; dilimi tanımayan tarayıcıda
 *   tablonun kenar farkı. Dilim yoksa saatler UTC etiketiyle yazılır (D-106 (c)), sayfa düşmez.
 */
export function AirportWeatherLive({
  locale,
  t,
  icao,
  name,
  lat,
  lon,
  apiBaseUrl,
  initialWeather,
  initialHistory,
  renderedAt,
  timeZone,
  utcOffsets,
}: AirportWeatherLiveProps) {
  // Çizimin ilk adımı: sunucunun farkları kayıtlı olmadan hiçbir saat yazılmaz (hidrasyon aynı).
  if (utcOffsets !== null && utcOffsets.timeZone === timeZone) registerUtcOffsetTable(utcOffsets)
  const zone =
    timeZone !== null && (isSupportedTimeZone(timeZone) || hasUtcOffsetTable(timeZone))
      ? timeZone
      : null
  const [weather, setWeather] = useState(initialWeather)
  const [history, setHistory] = useState(initialHistory)
  // Sunucu verisinin üretim anları yalnızca ilk açılışta okunur (sonraki çizimler kendi durumunu
  // kullanır). Saat sunucunun çizim anına bağlanır.
  const [initial] = useState(() => ({
    weatherGeneratedAt: initialWeather?.generatedAt ?? null,
    historyGeneratedAt: initialHistory?.generatedAt ?? null,
  }))
  const [clock] = useState(() => new WallClock(renderedAt))
  const clientNow = useWallNow(clock, CLOCK_STEP_MS)
  const now = clientNow ?? renderedAt

  useEffect(() => {
    let controller: AbortController | null = null
    let lastFailureAt: number | null = null
    // Taze sunucu verisi (ikisi de) bir başarılı istek sayılır; eski ya da eksik veri hemen yenilenir.
    let lastSuccessAt = initialSuccessAt({
      ...initial,
      serverNow: clock.now(),
      localNow: Date.now(),
    })

    const refresh = async () => {
      controller?.abort()
      const current = new AbortController()
      controller = current
      try {
        const [nextWeather, nextHistory] = await Promise.all([
          fetchAirportWeather(apiBaseUrl, icao, current.signal),
          fetchWeatherHistory(apiBaseUrl, icao, current.signal),
        ])
        if (current.signal.aborted) return
        for (const next of [nextWeather, nextHistory]) {
          if (next) clock.observe(Date.parse(next.generatedAt))
        }
        if (nextWeather) setWeather(nextWeather)
        if (nextHistory) setHistory(nextHistory)
        if (nextWeather && nextHistory) lastSuccessAt = Date.now()
        else lastFailureAt = Date.now()
      } catch {
        if (!current.signal.aborted) lastFailureAt = Date.now()
      }
    }

    const check = () => {
      if (document.visibilityState !== 'visible') return
      if (weatherRefreshDue(Date.now(), lastSuccessAt, lastFailureAt)) void refresh()
    }

    check()
    const timer = setInterval(check, CHECK_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      controller?.abort()
    }
  }, [apiBaseUrl, icao, initial, clock])

  return (
    <>
      <WeatherPanel
        locale={locale}
        t={t}
        lat={lat}
        lon={lon}
        weather={weather}
        now={now}
        live={clientNow !== null}
        timeZone={zone}
      />
      <WeatherLog
        locale={locale}
        t={t}
        icao={icao}
        name={name}
        history={history}
        now={now}
        apiBaseUrl={apiBaseUrl}
        timeZone={zone}
      />
    </>
  )
}
