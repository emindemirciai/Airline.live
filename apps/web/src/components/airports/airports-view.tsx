import { format, formatDistance, getMessages, NO_VALUE } from '@havayolu/i18n'
import type { AirportDetail, Locale } from '@havayolu/shared'
import Link from 'next/link'
// Göreli yollar: vitest `@/` takma adını çözmez ve bu bileşen testte çizilir.
import { latestDataUpdate, splitByCountry } from '../../lib/airports'
import { localePath } from '../../lib/locale-routing'
import { airportPath } from '../../lib/seo/paths'
import { TERMS_LINKS } from '../../lib/terms'
import { richText } from '../rich-text'
import {
  airportCountry,
  airportName,
  airportProvince,
  formatDataDate,
  formatMeters,
  listedRadiusKm,
  longestRunway,
  sortByCountry,
  sortByProvince,
} from './airport-text'
import { Breadcrumbs } from './breadcrumbs'
import { airportsCrumbs } from './crumbs'

export interface AirportsViewProps {
  locale: Locale
  /** Uygulamanın adı (`APP_NAME`). */
  app: string
  /** Listelenen havalimanları (Türkiye ve yakın ülkeler, D-080); sıralamayı görünüm yapar. */
  airports: readonly AirportDetail[]
}

/**
 * Liste sayfasının sayıları (açıklama ve özet cümlesi aynı sayıları kullanır): Türkiye'deki ve yakın
 * ülkelerdeki havalimanları. Tarifeli sefer ve izlenen istasyon bilgisi gösterilmez (M6c, kullanıcı
 * kararı 2026-10-01, D-078).
 */
export function airportCounts(airports: readonly AirportDetail[]) {
  const { turkey, foreign } = splitByCountry(airports)
  return { count: turkey.length, foreign: foreign.length }
}

/**
 * Listenin görünen sırası: önce Türkiye (ile, sonra ada göre), sonra yakın ülkeler (ülkeye, sonra ada
 * göre). Sayfanın JSON-LD `ItemList`'i de bu sırayı kullanır.
 */
export function listedAirportRows(
  airports: readonly AirportDetail[],
  locale: Locale,
): { turkey: AirportDetail[]; foreign: AirportDetail[] } {
  const { turkey, foreign } = splitByCountry(airports)
  return { turkey: sortByProvince(turkey, locale), foreign: sortByCountry(foreign, locale) }
}

function AirportLink({ airport, locale }: { airport: AirportDetail; locale: Locale }) {
  return (
    <Link href={localePath(locale, airportPath(airport.icao))}>{airportName(airport, locale)}</Link>
  )
}

/**
 * Havalimanı listesi (`/havalimanlari`, M6b brief §g; M6d): özet cümlesi, Türkiye tablosu ve yakın
 * ülkelerdeki havalimanlarının ayrı tablosu (D-080). İki tablo da gerçek `<table>`'dır. Türkiye ile,
 * sonra ada göre; yakın ülkeler ülkeye, sonra ada göre sıralıdır (sayfanın dilinin alfabesi). Yakın
 * ülkeler tablosunda Türkiye'deki en yakın havalimanına uzaklık (`distanceToTrKm`) yazılır; canlı
 * uçak verisinin Türkiye odaklı olduğu bölümün başında söylenir (D-076 kapsama dürüstlüğü).
 */
export function AirportsView({ locale, app, airports }: AirportsViewProps) {
  const messages = getMessages(locale)
  const t = messages.airports
  const a = messages.airport
  const latest = latestDataUpdate(airports)
  const { turkey, foreign } = listedAirportRows(airports, locale)
  const counts = airportCounts(airports)
  const radiusKm = listedRadiusKm()

  return (
    <article className="page page-wide airports-page">
      <Breadcrumbs label={a.breadcrumbLabel} items={airportsCrumbs(locale, app)} />
      <h1>{t.title}</h1>
      {turkey.length + foreign.length === 0 ? (
        <p className="lead">{t.empty}</p>
      ) : (
        <>
          <p className="lead">
            {counts.foreign > 0 ? format(t.summaryWithForeign, counts) : format(t.summary, counts)}
          </p>
          {turkey.length > 0 ? (
            <section aria-labelledby="airports-turkey" className="airports-section">
              <h2 id="airports-turkey">{t.turkeyHeading}</h2>
              <p>{t.scope}</p>
              <div
                className="table-wrap"
                role="region"
                aria-labelledby="airports-caption"
                tabIndex={0}
              >
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
                    {turkey.map((airport) => {
                      const longest = longestRunway(airport)
                      return (
                        <tr key={airport.icao}>
                          <th scope="row">
                            <AirportLink airport={airport} locale={locale} />
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
            </section>
          ) : null}
          {foreign.length > 0 ? (
            <section aria-labelledby="airports-foreign" className="airports-section">
              <h2 id="airports-foreign">{t.foreign.heading}</h2>
              <p>
                {radiusKm === null
                  ? t.foreign.scopeAll
                  : format(t.foreign.scope, { km: formatDistance(radiusKm, { locale }) })}
              </p>
              <p className="airports-coverage">{t.foreign.coverage}</p>
              <div
                className="table-wrap"
                role="region"
                aria-labelledby="airports-foreign-caption"
                tabIndex={0}
              >
                <table className="table airports-table airports-foreign-table">
                  <caption id="airports-foreign-caption">{t.foreign.caption}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t.columns.name}</th>
                      <th scope="col">{t.columns.country}</th>
                      <th scope="col">{t.columns.iata}</th>
                      <th scope="col">{t.columns.icao}</th>
                      <th scope="col">{t.columns.distanceToTr}</th>
                      <th scope="col">{t.columns.longestRunway}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {foreign.map((airport) => {
                      const longest = longestRunway(airport)
                      return (
                        <tr key={airport.icao}>
                          <th scope="row">
                            <AirportLink airport={airport} locale={locale} />
                          </th>
                          <td>{airportCountry(airport, locale)}</td>
                          <td className="mono">{airport.iata}</td>
                          <td className="mono">{airport.icao}</td>
                          <td className="num">
                            {airport.distanceToTrKm === null
                              ? NO_VALUE
                              : formatDistance(airport.distanceToTrKm, { locale })}
                          </td>
                          <td className="num">{formatMeters(longest?.lengthFt ?? null, locale)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="hint">{t.foreign.distanceNote}</p>
              <p className="hint">{t.foreign.names}</p>
            </section>
          ) : null}
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
