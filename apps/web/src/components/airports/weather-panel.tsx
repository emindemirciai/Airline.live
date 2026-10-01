import {
  format,
  formatAgo,
  formatClock,
  formatUtcClock,
  formatUtcOffset,
  NO_VALUE,
  weatherText,
  type WeatherMessages,
  type WeatherTextOptions,
} from '@havayolu/i18n'
import {
  iconCategory,
  isDaytime,
  metarAgeClass,
  summarizeMetar,
  summarizeTaf,
  sunTimes,
  type AirportMetar,
  type AirportTaf,
  type AirportWeather,
  type Locale,
  type MetarAgeClass,
  type WeatherText,
} from '@havayolu/shared'
import type { ReactNode } from 'react'
import { CopyButton } from './copy-button'
import { metarCodeRows, tafPeriodRows } from './weather-expert'
import { WeatherIcon } from './weather-icon'

/**
 * Havalimanı sayfasının hava durumu bölümü (M6c, brief §5): başlık durumu, sade satırlar (rüzgâr,
 * yağmur, kar, gök gürültüsü, sis ve pus her zaman), tahmin özeti, yerel saat ve gün doğumu/batımı,
 * kapalı "Ayrıntılar (uzman)" bölümü. Saf görünüm, kanca yoktur: sunucuda ve adada
 * (`airport-weather-live.tsx`) aynı biçimde çizilir. JavaScript olmadan da eksiksizdir.
 *
 * Saat: yaş sınıfı, tahmin ve yerel saat `now` ile hesaplanır. Sunucu ve hidrasyon çizim anını,
 * ada sonra istemci saatini verir; göreli yaş ("18 dakika önce") yalnızca `live` iken yazılır.
 */
export interface WeatherPanelProps {
  locale: Locale
  t: WeatherMessages
  lat: number
  lon: number
  /** null: API'ye ulaşılamadı. */
  weather: AirportWeather | null
  now: number
  /** İstemci saati çalışıyor: göreli yaş yazılır. */
  live: boolean
}

function Rows({ rows }: { rows: readonly { key: string; label: string; value: ReactNode }[] }) {
  return (
    <dl className="weather-rows">
      {rows.map((row) => (
        <div key={row.key} data-row={row.key}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function MetarReport({
  metar,
  age,
  options,
  now,
  live,
  isDay,
}: {
  metar: AirportMetar
  age: Exclude<MetarAgeClass, 'none'>
  options: WeatherTextOptions
  now: number
  live: boolean
  isDay: boolean
}) {
  const { t } = options
  const text = (value: WeatherText) => weatherText(value, options)
  const summary = summarizeMetar(metar, { now })
  const r = summary.rows
  const time = formatClock(metar.observedAt)
  const headline = text(summary.headline)
  const temperature = summary.temperature ? text(summary.temperature) : null

  const rows: { key: string; label: string; value: ReactNode }[] = [
    {
      key: 'wind',
      label: t.rows.wind,
      value: (
        <>
          {text(r.wind)}
          {summary.strongWind ? (
            <>
              {' · '}
              <span className="weather-chip">{t.wind.strong}</span>
            </>
          ) : null}
        </>
      ),
    },
    { key: 'rain', label: t.rows.rain, value: text(r.rain) },
    { key: 'snow', label: t.rows.snow, value: text(r.snow) },
    { key: 'thunder', label: t.rows.thunder, value: text(r.thunderstorm) },
    { key: 'fog', label: t.rows.fog, value: text(r.fog) },
    ...(r.hail ? [{ key: 'hail', label: t.rows.hail, value: text(r.hail) }] : []),
    ...(r.other ? [{ key: 'other', label: t.rows.other, value: text(r.other) }] : []),
    { key: 'visibility', label: t.rows.visibility, value: text(r.visibility) },
    { key: 'clouds', label: t.rows.clouds, value: text(r.clouds) },
    {
      key: 'temperature',
      label: t.rows.temperature,
      value: r.temperature ? text(r.temperature) : NO_VALUE,
    },
    { key: 'humidity', label: t.rows.humidity, value: r.humidity ? text(r.humidity) : NO_VALUE },
    { key: 'pressure', label: t.rows.pressure, value: r.pressure ? text(r.pressure) : NO_VALUE },
    // Eğilim gözlemden sonraki 2 saati kapsar: pencere geçtiyse satır yoktur (ileriye dönük iddia
    // kalmaz); gözlem eskiyse pencerenin bitiş saatiyle yazılır.
    ...(summary.trend === 'expired'
      ? []
      : [
          {
            key: 'next2h',
            label: summary.trend === 'untilTime' ? t.rows.trendAfterObservation : t.rows.next2h,
            value: summary.next2h ? text(summary.next2h) : t.value.notStated,
          },
        ]),
  ]

  const body = (
    <>
      <p className="weather-headline">
        <WeatherIcon category={iconCategory(metar, isDay)} />
        <span>
          <strong>{headline}</strong>
          {temperature ? ` · ${temperature}` : null}
        </span>
      </p>
      {summary.notes.length > 0 ? (
        <ul className="weather-notes">
          {summary.notes.map((note, index) => (
            <li key={index} className="weather-note">
              {text(note)}
            </li>
          ))}
        </ul>
      ) : null}
      <Rows rows={rows} />
    </>
  )

  return (
    <>
      <p className="weather-status">
        {age === 'delayed' ? (
          <span className="weather-badge is-delayed">{t.age.delayedBadge}</span>
        ) : age === 'stale' ? (
          <span className="weather-badge is-stale">{t.age.staleBadge}</span>
        ) : null}
        <span>
          <time dateTime={metar.observedAt}>
            {format(age === 'fresh' ? t.observed : t.lastObserved, { time })}
          </time>
          {live ? ` · ${formatAgo(metar.observedAt, now, options)}` : null}
        </span>
      </p>
      {age === 'delayed' ? <p className="weather-note">{t.age.delayed}</p> : null}
      {age === 'stale' ? (
        <>
          <p className="weather-note">{t.age.stale}</p>
          <details className="weather-details weather-stale">
            <summary>{t.age.staleValues}</summary>
            {body}
          </details>
        </>
      ) : (
        body
      )}
    </>
  )
}

function Forecast({
  tafs,
  options,
  now,
}: {
  tafs: readonly AirportTaf[]
  options: WeatherTextOptions
  now: number
}) {
  const { t } = options
  const summary = summarizeTaf(tafs, now)
  const text = (value: WeatherText) => weatherText(value, options)
  return (
    <div className="weather-forecast-block">
      <h3>{t.rows.forecast}</h3>
      {summary.items.length > 0 ? (
        <ul className="weather-forecast">
          {summary.items.map((item, index) => (
            <li key={index}>{text(item)}</li>
          ))}
        </ul>
      ) : null}
      {summary.message ? <p>{text(summary.message)}</p> : null}
      {summary.validUntil || summary.amended || summary.corrected ? (
        <p className="weather-note">
          {[
            summary.validUntil ? text(summary.validUntil) : null,
            summary.amended ? t.taf.amended : null,
            summary.corrected ? t.taf.corrected : null,
          ]
            .filter((part): part is string => part !== null)
            .join(' ')}
        </p>
      ) : null}
    </div>
  )
}

function Sun({
  lat,
  lon,
  now,
  options,
}: {
  lat: number
  lon: number
  now: number
  options: WeatherTextOptions
}) {
  const { t } = options
  const sun = sunTimes(lat, lon, now)
  return (
    <ul className="weather-sun" title={t.sunNote}>
      <li>{format(t.localTime, { time: formatClock(now), offset: formatUtcOffset(now) })}</li>
      <li>{format(t.sunrise, { time: sun.sunrise ? formatClock(sun.sunrise) : NO_VALUE })}</li>
      <li>{format(t.sunset, { time: sun.sunset ? formatClock(sun.sunset) : NO_VALUE })}</li>
    </ul>
  )
}

function Raw({ title, raw, t }: { title: string; raw: string; t: WeatherMessages }) {
  return (
    <>
      <div className="weather-raw-head">
        <h4>{title}</h4>
        <CopyButton text={raw} label={t.expert.copy} done={t.expert.copied} />
      </div>
      <pre className="weather-raw">{raw}</pre>
    </>
  )
}

function Expert({
  metar,
  tafs,
  options,
  now,
}: {
  metar: AirportMetar | null
  tafs: readonly AirportTaf[]
  options: WeatherTextOptions
  now: number
}) {
  const { t } = options
  const e = t.expert
  return (
    <details className="weather-details">
      <summary>{e.heading}</summary>
      {metar ? (
        <>
          <div
            className="table-wrap"
            role="region"
            aria-labelledby="weather-codes-caption"
            tabIndex={0}
          >
            <table className="table weather-codes">
              <caption id="weather-codes-caption">{e.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{e.columns.code}</th>
                  <th scope="col">{e.columns.meaning}</th>
                </tr>
              </thead>
              <tbody>
                {metarCodeRows(metar, options).map((row, index) => (
                  <tr key={`${row.code}-${index}`}>
                    <th scope="row" className="mono">
                      {row.code}
                    </th>
                    <td>{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {metar.flightCategory ? (
            <p className="weather-note">
              {e.flightCategory}: <span className="mono">{metar.flightCategory}</span>.{' '}
              {e.flightCategoryNote}
            </p>
          ) : null}
          {metar.unparsed.length > 0 ? (
            <p className="weather-note">
              {e.unparsed}: <span className="mono">{metar.unparsed.join(' ')}</span>
            </p>
          ) : null}
          <Raw title={e.rawMetar} raw={metar.raw} t={t} />
        </>
      ) : null}
      {tafs.map((taf, index) => {
        const captionId = `weather-taf-caption-${index}`
        const issued = `${formatClock(taf.issuedAt)} (${formatUtcClock(taf.issuedAt)} UTC)`
        return (
          <div key={`${taf.issuedAt}-${index}`} className="weather-taf">
            <div className="table-wrap" role="region" aria-labelledby={captionId} tabIndex={0}>
              <table className="table weather-taf-periods">
                <caption id={captionId}>{format(e.tafCaption, { issued })}</caption>
                <thead>
                  <tr>
                    <th scope="col">{e.tafColumns.period}</th>
                    <th scope="col">{e.tafColumns.change}</th>
                    <th scope="col">{e.tafColumns.wind}</th>
                    <th scope="col">{e.tafColumns.visibility}</th>
                    <th scope="col">{e.tafColumns.weather}</th>
                    <th scope="col">{e.tafColumns.clouds}</th>
                  </tr>
                </thead>
                <tbody>
                  {tafPeriodRows(taf, now, options).map((row, rowIndex) => (
                    <tr key={`${row.raw}-${rowIndex}`}>
                      <th scope="row" className="num">
                        {row.period}
                      </th>
                      <td>{row.change}</td>
                      <td>{row.wind}</td>
                      <td>{row.visibility}</td>
                      <td>{row.weather}</td>
                      <td>{row.clouds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Raw title={e.rawTaf} raw={taf.raw} t={t} />
          </div>
        )
      })}
      {tafs.length > 0 ? <p className="weather-note">{e.noTemperature}</p> : null}
      <p className="weather-note">{t.sunNote}</p>
    </details>
  )
}

export function WeatherPanel({ locale, t, lat, lon, weather, now, live }: WeatherPanelProps) {
  const options: WeatherTextOptions = { locale, t }
  const metar = weather?.metar ?? null
  const age: MetarAgeClass = metar ? metarAgeClass(metar.observedAt, now) : 'none'
  // API yalnızca süresi dolmamış TAF'ları verir; açık sekmede süresi dolanlar burada düşer.
  const tafs = weather ? weather.tafs.filter((taf) => Date.parse(taf.validTo) > now) : []
  const sun = sunTimes(lat, lon, metar?.observedAt ?? now)
  const isDay = isDaytime(metar?.observedAt ?? now, sun)

  return (
    <section aria-labelledby="airport-weather" className="airport-weather" data-age={age}>
      <h2 id="airport-weather">{t.heading}</h2>
      {weather === null ? (
        <p className="weather-note">{t.age.unavailable}</p>
      ) : (
        <>
          {metar && age !== 'none' ? (
            <MetarReport
              metar={metar}
              age={age}
              options={options}
              now={now}
              live={live}
              isDay={isDay}
            />
          ) : (
            <p>{t.age.none}</p>
          )}
          <Forecast tafs={tafs} options={options} now={now} />
        </>
      )}
      <Sun lat={lat} lon={lon} now={now} options={options} />
      {weather && (metar || tafs.length > 0) ? (
        <Expert metar={age === 'none' ? null : metar} tafs={tafs} options={options} now={now} />
      ) : null}
    </section>
  )
}
