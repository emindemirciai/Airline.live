import { getMessages } from '@havayolu/i18n'
import { airportTimeZone, utcOffsetTable, type AirportDetail, type Locale } from '@havayolu/shared'
// Göreli yollar: vitest `@/` takma adını çözmez.
import { getAirportWeatherPage, stationWeather } from '../../lib/weather'
import { AirportWeatherLive } from './airport-weather-live'
import { airportName } from './airport-text'

export interface AirportWeatherSectionProps {
  locale: Locale
  airport: AirportDetail
  /** Tarayıcının bağlandığı API adresi (`config.apiBaseUrl`). */
  apiBaseUrl: string
}

/**
 * Havalimanı sayfasının hava durumu ve METAR/TAF kaydı bölümleri (M6c). Sunucuda toplu hava durumu
 * (ham biçim, web belleğinde 60 sn, D-090, D-101; yalnız bu havalimanı çözülür) ve havalimanının 24
 * saatlik kaydı (30 dk önbellek, D-102) okunur; hata sayfaya taşınmaz.
 * Bölümler istemci adasında çizilir ve açık sekmede tazelenir. Sayfa bunu Suspense içinde verir.
 * Saatler havalimanının yerel saatidir (`airportTimeZone`, D-084); farklarını sunucu çizim anının
 * ±48 saati için hesaplar ve adaya verir (`utcOffsetTable`, D-109: tarayıcının tz verisi eskiyse de
 * hidrasyon aynıdır). Dilimi bilinmeyen havalimanında saatler UTC ile ve öyle etiketlenerek yazılır
 * (D-106 (c), D-109; önce Türkiye saatiydi, D-080).
 */
export async function AirportWeatherSection({
  locale,
  airport,
  apiBaseUrl,
}: AirportWeatherSectionProps) {
  const { bulk, history, renderedAt } = await getAirportWeatherPage(airport.icao)
  const timeZone = airportTimeZone(airport)
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
      timeZone={timeZone}
      utcOffsets={timeZone === null ? null : utcOffsetTable(timeZone, renderedAt)}
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
