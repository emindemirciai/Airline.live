import { getMessages } from '@havayolu/i18n'
import {
  airportTimeZone,
  type AirportDetail,
  type AirportWeather,
  type Locale,
} from '@havayolu/shared'
// Göreli yollar: vitest `@/` takma adını çözmez.
import { getAirportWeatherPage, type WeatherBulk } from '../../lib/weather'
import { AirportWeatherLive } from './airport-weather-live'
import { airportName } from './airport-text'

/**
 * Toplu yanıttan havalimanının güncel havası. Yanıt yoksa (API'ye ulaşılamadı) null; istasyon
 * listede yoksa raporsuz bir kayıt (sayfa "güncel rapor yok" der, "alınamıyor" demez).
 */
export function stationWeather(bulk: WeatherBulk | null, icao: string): AirportWeather | null {
  if (bulk === null) return null
  return bulk.stations.get(icao) ?? { icao, generatedAt: bulk.generatedAt, metar: null, tafs: [] }
}

export interface AirportWeatherSectionProps {
  locale: Locale
  airport: AirportDetail
  /** Tarayıcının bağlandığı API adresi (`config.apiBaseUrl`). */
  apiBaseUrl: string
}

/**
 * Havalimanı sayfasının hava durumu ve METAR/TAF kaydı bölümleri (M6c). Sunucuda toplu hava durumu
 * (60 sn önbellek) ve havalimanının 24 saatlik kaydı (5 dk önbellek) okunur; hata sayfaya taşınmaz.
 * Bölümler istemci adasında çizilir ve açık sekmede tazelenir. Sayfa bunu Suspense içinde verir.
 * Saatler havalimanının yerel saatidir (`airportTimeZone`, D-084); dilimi bilinmeyen yabancı
 * havalimanında Türkiye saatiyle ve öyle etiketlenerek yazılır (D-080).
 */
export async function AirportWeatherSection({
  locale,
  airport,
  apiBaseUrl,
}: AirportWeatherSectionProps) {
  const { bulk, history, renderedAt } = await getAirportWeatherPage(airport.icao)
  return (
    <AirportWeatherLive
      locale={locale}
      t={getMessages(locale).weather}
      icao={airport.icao}
      name={airportName(airport, locale)}
      lat={airport.lat}
      lon={airport.lon}
      apiBaseUrl={apiBaseUrl}
      initialWeather={stationWeather(bulk, airport.icao)}
      initialHistory={history}
      renderedAt={renderedAt}
      timeZone={airportTimeZone(airport)}
    />
  )
}

/** Veri gelene kadar yer tutan bölüm (yalnızca akışlı çizimde görünür). */
export function WeatherSkeleton({ locale }: { locale: Locale }) {
  const t = getMessages(locale).weather
  return (
    <section aria-labelledby="airport-weather" aria-busy="true" className="airport-weather">
      <h2 id="airport-weather">{t.heading}</h2>
      <p className="weather-note">{t.loading}</p>
    </section>
  )
}
