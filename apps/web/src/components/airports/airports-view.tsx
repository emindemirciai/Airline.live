import { format, getMessages } from '@havayolu/i18n'
import type { AirportDetail, Locale } from '@havayolu/shared'
import Link from 'next/link'
// Göreli yollar: vitest `@/` takma adını çözmez ve bu bileşen testte çizilir.
import { latestDataUpdate } from '../../lib/airports'
import { localePath } from '../../lib/locale-routing'
import { airportPath } from '../../lib/seo/paths'
import { TERMS_LINKS } from '../../lib/terms'
import { richText } from '../rich-text'
import {
  airportName,
  airportProvince,
  formatDataDate,
  formatMeters,
  longestRunway,
  sortByProvince,
} from './airport-text'
import { Breadcrumbs } from './breadcrumbs'
import { airportsCrumbs } from './crumbs'

export interface AirportsViewProps {
  locale: Locale
  /** Uygulamanın adı (`APP_NAME`). */
  app: string
  /** Sayfanın göstereceği sırayla (`sortByProvince`) havalimanları. */
  airports: readonly AirportDetail[]
}

/**
 * Liste sayfasının sayıları (açıklama ve özet cümlesi aynı sayıyı kullanır). Tarifeli sefer ve
 * izlenen istasyon bilgisi gösterilmez (M6c, kullanıcı kararı 2026-10-01, D-078).
 */
export function airportCounts(airports: readonly AirportDetail[]) {
  return { count: airports.length }
}

/**
 * Havalimanı listesi (`/havalimanlari`, M6b brief §g): özet cümlesi, kapsam notu ve bütün
 * havalimanlarının gerçek bir tablosu. Sıra ile göre, sonra ada göredir (sayfanın dilinin alfabesi).
 */
export function AirportsView({ locale, app, airports }: AirportsViewProps) {
  const messages = getMessages(locale)
  const t = messages.airports
  const a = messages.airport
  const latest = latestDataUpdate(airports)
  const rows = sortByProvince(airports, locale)

  return (
    <article className="page page-wide airports-page">
      <Breadcrumbs label={a.breadcrumbLabel} items={airportsCrumbs(locale, app)} />
      <h1>{t.title}</h1>
      {rows.length === 0 ? (
        <p className="lead">{t.empty}</p>
      ) : (
        <>
          <p className="lead">{format(t.summary, airportCounts(airports))}</p>
          <p>{t.scope}</p>
          <div className="table-wrap" role="region" aria-labelledby="airports-caption" tabIndex={0}>
            <table className="table airports-table">
              <caption id="airports-caption">{t.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.columns.name}</th>
                  <th scope="col">{t.columns.province}</th>
                  <th scope="col">{t.columns.iata}</th>
                  <th scope="col">{t.columns.icao}</th>
                  <th scope="col">{t.columns.longestRunway}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((airport) => {
                  const longest = longestRunway(airport)
                  return (
                    <tr key={airport.icao}>
                      <th scope="row">
                        <Link href={localePath(locale, airportPath(airport.icao))}>
                          {airportName(airport, locale)}
                        </Link>
                      </th>
                      <td>{airportProvince(airport, locale)}</td>
                      <td className="mono">{airport.iata}</td>
                      <td className="mono">{airport.icao}</td>
                      <td className="num">{formatMeters(longest?.lengthFt ?? null, locale)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="hint">{t.names}</p>
          {latest ? (
            <p className="airport-source">
              {richText(a.source, {
                source: (
                  <a href={TERMS_LINKS.ourAirports} hrefLang="en">
                    OurAirports
                  </a>
                ),
                date: <time dateTime={latest}>{formatDataDate(latest, locale)}</time>,
              })}
            </p>
          ) : null}
        </>
      )}
    </article>
  )
}
