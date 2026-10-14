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
import { initialWeatherAt, WeatherRefresher } from './weather-refresh'
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
  /** Sunucu çiziminin güncel havası; null: API'ye ulaşılamadı. METAR/TAF kaydı tarayıcıdan gelir. */
  initialWeather: AirportWeather | null
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
 * - METAR/TAF kaydı yalnız tarayıcıdan gelir (D-111): ada açılışta ister (sunucu çizimi ve ilk
 *   istemci çizimi "yükleniyor" der), sonra sekme görünürken 5 dakikada bir güncel havayla birlikte
 *   tazeler. Sunucunun güncel havası 2 dakikadan yeniyse açılıştaki istek yalnız kaydı alır.
 *   Başarısız istekte eldeki veri korunur (ilk kayıt isteği başarısızsa bölüm "alınamıyor" der), en
 *   erken 1 dakika sonra yeniden denenir. Ayrılınca süren istek kesilir. Döngü
 *   `WeatherRefresher`'dadır (weather-refresh.ts); ada yalnız görünürlüğü denetler.
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
  const [history, setHistory] = useState<WeatherHistoryResponse | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  // Sunucu verisinin üretim anı yalnızca ilk açılışta okunur (sonraki çizimler kendi durumunu
  // kullanır). Saat sunucunun çizim anına bağlanır.
  const [initial] = useState(() => ({ weatherGeneratedAt: initialWeather?.generatedAt ?? null }))
  const [clock] = useState(() => new WallClock(renderedAt))
  const clientNow = useWallNow(clock, CLOCK_STEP_MS)
  const now = clientNow ?? renderedAt

  useEffect(() => {
    const refresher = new WeatherRefresher({
      apiBaseUrl,
      icao,
      freshWeatherAt: initialWeatherAt({
        ...initial,
        serverNow: clock.now(),
        localNow: Date.now(),
      }),
      apply: ({ weather: nextWeather, history: nextHistory }) => {
        for (const next of [nextWeather, nextHistory]) {
          if (next) clock.observe(Date.parse(next.generatedAt))
        }
        if (nextWeather) setWeather(nextWeather)
        if (nextHistory) setHistory(nextHistory)
        setHistoryLoading(false)
      },
    })

    const check = () => {
      if (document.visibilityState === 'visible') void refresher.check()
    }

    check()
    const timer = setInterval(check, CHECK_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      refresher.destroy()
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
        loading={historyLoading}
        now={now}
        apiBaseUrl={apiBaseUrl}
        timeZone={zone}
      />
    </>
  )
}
