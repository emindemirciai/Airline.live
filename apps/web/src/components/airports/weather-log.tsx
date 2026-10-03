import {
  format,
  formatDayTime,
  formatUtcClock,
  formatUtcOffset,
  weatherText,
  type WeatherMessages,
  type WeatherTextOptions,
} from '@havayolu/i18n'
import {
  summarizeMetar,
  TURKEY_TIME_ZONE,
  type Locale,
  type WeatherHistoryEntry,
  type WeatherHistoryResponse,
} from '@havayolu/shared'
import { richText } from '../rich-text'
import {
  airportWeatherHistoryUrl,
  WEATHER_HISTORY_MAX_HOURS,
  WEATHER_LOG_HOURS,
} from './weather-client'

/**
 * METAR/TAF kaydı (M6c, D-078): son 24 saatte saklanan bütün raporlar, en yenisi üstte. Her satırda
 * yerel saat ve UTC, tür (METAR, SPECI, TAF), sade özet ve ham metin. Gerçek `<table>`; dar ekranda
 * kendi kutusunda kayar. Saf görünüm: sunucuda ve adada aynı biçimde çizilir. Yerel saat
 * havalimanının saat dilimindedir (D-084); her satırın yanında UTC yazdığı için yaz saati geçişinde
 * de an açıktır.
 *
 * Pencere `now`'a (sunucu saatine bağlı duvar saati) göre yeniden süzülür: önbellekten gelen eski bir
 * kayıt yanıtı "son 24 saat" başlığı altında 24 saatten eski satır göstermez; ada eski kaydı
 * açılışta yeniler (airport-weather-live.tsx).
 */
export interface WeatherLogProps {
  locale: Locale
  t: WeatherMessages
  icao: string
  /** Havalimanının görünen adı (tablo başlığı). */
  name: string
  /** null: kayıt alınamadı. */
  history: WeatherHistoryResponse | null
  now: number
  /** Eski kayıt bağlantısı için API'nin genel adresi (`config.apiBaseUrl`). */
  apiBaseUrl: string
  /**
   * Havalimanının saat dilimi (IANA; varsayılan Europe/Istanbul). null: dilimi bilinmeyen yabancı
   * havalimanı, saatler "Türkiye saati" diye anlatılır (D-080).
   */
  timeZone?: string | null
}

/**
 * Kayıt satırının tek satırlık özeti, virgülle: "Hafif sağanak yağmur, 9 °C, kuzeydoğudan 33 km/sa,
 * hamle 59 km/sa". Sayıdan önce "·" yazılmaz (eksi gibi okunur; kullanıcı kararı 2026-10-02).
 */
export function logSummary(entry: WeatherHistoryEntry, now: number, options: WeatherTextOptions) {
  const { t } = options
  if (entry.metar) {
    if (entry.metar.nil) return t.note.nil
    const summary = summarizeMetar(entry.metar)
    const parts = [weatherText(summary.headline, options)]
    if (summary.temperature) parts.push(weatherText(summary.temperature, options))
    if (entry.metar.wind) {
      parts.push(weatherText(summary.rows.wind, options, { capitalize: false }))
    }
    return parts.join(', ')
  }
  if (entry.taf) {
    const flags = [
      entry.taf.amended ? t.log.amended : null,
      entry.taf.corrected ? t.log.corrected : null,
      entry.taf.cancelled ? t.log.cancelled : null,
    ].filter((flag): flag is string => flag !== null)
    const text = format(t.log.tafSummary, {
      from: formatDayTime(entry.taf.validFrom, now, options),
      to: formatDayTime(entry.taf.validTo, now, options),
    })
    return flags.length > 0 ? `${text} (${flags.join(', ')})` : text
  }
  return ''
}

export function WeatherLog({
  locale,
  t,
  icao,
  name,
  history,
  now,
  apiBaseUrl,
  timeZone = TURKEY_TIME_ZONE,
}: WeatherLogProps) {
  const options: WeatherTextOptions = { locale, t, timeZone: timeZone ?? TURKEY_TIME_ZONE }
  const l = t.log
  // Türkiye: "Saatler yerel saattir"; dilimi bilinen yabancı havalimanı: havalimanının yerel saati ve
  // şu anki farkı; dilimi bilinmeyen: "Saatler Türkiye saatidir".
  const intro =
    timeZone === null
      ? l.introAbroad
      : timeZone === TURKEY_TIME_ZONE
        ? l.intro
        : format(l.introLocal, { offset: formatUtcOffset(now, timeZone) })
  const since = now - WEATHER_LOG_HOURS * 3_600_000
  const entries = (history?.entries ?? []).filter((entry) => Date.parse(entry.time) >= since)
  const count = format(entries.length === 1 ? l.countOne : l.countMany, { count: entries.length })
  return (
    <section aria-labelledby="airport-weather-log" className="airport-weather-log">
      <h2 id="airport-weather-log">{l.heading}</h2>
      <p className="weather-note">{intro}</p>
      {history === null ? (
        <p>{l.unavailable}</p>
      ) : entries.length === 0 ? (
        <p>{l.empty}</p>
      ) : (
        <div
          className="table-wrap"
          role="region"
          aria-labelledby="weather-log-caption"
          tabIndex={0}
        >
          <table className="table weather-log">
            <caption id="weather-log-caption">
              {format(l.caption, { name })} ({count})
            </caption>
            <thead>
              <tr>
                <th scope="col">{l.columns.time}</th>
                <th scope="col">{l.columns.type}</th>
                <th scope="col">{l.columns.summary}</th>
                <th scope="col">{l.columns.raw}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={`${entry.kind}-${entry.time}-${index}`} data-kind={entry.kind}>
                  <th scope="row" className="weather-log-time">
                    <time dateTime={entry.time}>{formatDayTime(entry.time, now, options)}</time>
                    <span className="weather-log-utc">
                      {format(l.utc, { time: formatUtcClock(entry.time) })}
                    </span>
                  </th>
                  <td>
                    <span className={`weather-type is-${entry.kind.toLowerCase()}`}>
                      {entry.kind}
                    </span>
                  </td>
                  <td>{logSummary(entry, now, options)}</td>
                  <td className="weather-log-raw">
                    <pre className="weather-raw">{entry.raw}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="weather-note">
        {richText(l.older, {
          link: (
            <a href={airportWeatherHistoryUrl(apiBaseUrl, icao, WEATHER_HISTORY_MAX_HOURS)}>
              {l.olderLink}
            </a>
          ),
        })}
      </p>
    </section>
  )
}
