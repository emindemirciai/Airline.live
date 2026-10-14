import { format, formatDistance, getMessages, NO_VALUE } from '@havayolu/i18n'
import {
  airportDisplayName,
  airportLocality,
  airportNameSource,
  airportOfficialName,
  foreignAirportName,
  runwaySurfaceKey,
  type AirportDetail,
  type Locale,
  type RunwayDetail,
} from '@havayolu/shared'
import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'
// Göreli yollar: vitest `@/` takma adını çözmez ve bu bileşen testte çizilir.
import {
  isInLiveCoverage,
  liveCoveragePlan,
  nearestAirports,
  sameProvinceAirports,
} from '../../lib/airports'
import { localePath } from '../../lib/locale-routing'
import { airportMapPath, airportPath } from '../../lib/seo/paths'
import { TERMS_LINKS } from '../../lib/terms'
import { richText } from '../rich-text'
import {
  airportCountryFull,
  airportLocation,
  airportName,
  airportPlace,
  airportProvince,
  formatBearing,
  formatCoordinatesDecimal,
  formatCoordinatesDms,
  formatDataDate,
  formatLength,
  formatMeters,
  isTurkish,
  longestRunway,
  runwayDesignator,
} from './airport-text'
import { Breadcrumbs } from './breadcrumbs'
import { civilClosureNote, civilClosureTemplates } from './civil-closure'
import { airportCrumbs } from './crumbs'
import { AVIATION_WEATHER_URL } from './weather-links'

/** "En yakın havalimanları" bölümündeki havalimanı sayısı (M6b brief §g). */
export const NEARBY_COUNT = 3

export interface AirportViewProps {
  locale: Locale
  /** Uygulamanın adı (`APP_NAME`). */
  app: string
  airport: AirportDetail
  /**
   * Listelenen bütün havalimanları (Türkiye ve diğer ülkeler): en yakınlar, aynı ildeki diğerleri ve
   * canlı veri kapsaması bunlardan hesaplanır.
   */
  airports: readonly AirportDetail[]
  /**
   * Hava durumu ve METAR/TAF kaydı bölümleri (M6c). Sayfa bunları Suspense içinde verir: hava durumu
   * isteği ilk baytı geciktirmez ve görünüm eşzamanlı kalır. Verilmezse bölümler ve kaynak satırı
   * çizilmez (testler, önizlemeler).
   */
  weather?: ReactNode
}

/** Dış kaynak bağlantısı; kaynak siteler İngilizcedir. */
function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} hrefLang="en">
      {children}
    </a>
  )
}

/** Virgülle ayrılmış öğeler (bağlantılar). */
function joined(items: readonly ReactNode[]): ReactNode {
  return items.map((item, index) => (
    <Fragment key={index}>
      {index > 0 ? ', ' : null}
      {item}
    </Fragment>
  ))
}

/** Uçların birer satırda değeri: "16L 164°". */
function perEnd(runway: RunwayDetail, value: (end: RunwayDetail['ends'][number]) => string | null) {
  const lines = runway.ends
    .map((end) => ({ ident: end.ident.trim(), text: value(end) }))
    .filter((line): line is { ident: string; text: string } => line.text !== null)
  if (lines.length === 0) return NO_VALUE
  return lines.map((line, index) => (
    <span key={`${line.ident}-${index}`} className="airport-runway-end">
      {line.ident ? <span className="airport-runway-ident">{line.ident}</span> : null}
      {line.ident ? ' ' : null}
      {line.text}
    </span>
  ))
}

const displacedFt = (end: RunwayDetail['ends'][number]) =>
  end.displacedThresholdFt !== null && end.displacedThresholdFt > 0
    ? end.displacedThresholdFt
    : null

/**
 * Havalimanı sayfasının gövdesi (`/istasyon/<ICAO>`, M6b brief §g, M6c). Her değer veriden gelir
 * (OurAirports + resmî ad tablosu + kapsama planı + hava durumu); ortak giriş metni yoktur. Tarifeli
 * sefer ve izlenen istasyon bilgisi gösterilmez (D-078). OurAirports pist ışıklandırması kaynağa
 * atfedilir: "evet" değilse "kayıtlı değil" yazılır, "yok" denmez (D-076). Sunucuda çizilir, kanca
 * yoktur; hava durumu bölümü `weather` yuvasından gelir.
 *
 * Diğer ülkelerdeki havalimanı (M6d, D-080): yer satırı yerleşim ve ülkedir, il satırı yerine ülke
 * yazılır; Türkiye'ye göre bir satır yoktur (D-106). "… ilindeki diğer havalimanları" cümlesi yalnızca
 * Türkiye'dedir. "En yakın havalimanları" listesi Türkiye'yi ve diğer ülkeleri karışık içerebilir.
 *
 * Sivil uçuşlara kapalı olabilecek havalimanı (kullanıcı kararı 2026-10-04, D-090; Krasnodar,
 * Gelencik, Elista, Voronej): başlığın altında kehribar not (`role="note"`), harita penceresiyle aynı
 * metin. Not yalnız görünür metindir; başlık, açıklama ve JSON-LD değişmez.
 */
export function AirportView({ locale, app, airport, airports, weather }: AirportViewProps) {
  const messages = getMessages(locale)
  const t = messages.airport
  const name = airportName(airport, locale)
  const turkish = isTurkish(airport)
  const province = airportProvince(airport, locale)
  const link = (target: AirportDetail) => localePath(locale, airportPath(target.icao))

  const count = airport.runways.length
  const longest = longestRunway(airport)
  const others = sameProvinceAirports(airport, airports)
  const nearby = nearestAirports(airport, airports, NEARBY_COUNT)
  const hasDisplaced = airport.runways.some((runway) => runway.ends.some((end) => displacedFt(end)))
  const nameSource = airportNameSource(airport.icao)
  const covered = isInLiveCoverage(airport, liveCoveragePlan(airports))
  const district = airportLocality(airport, locale)
  // Savaş nedeniyle kapalı havalimanı (D-110; D-090): başlığın altında görünür not.
  const closure = civilClosureNote(airport.icao, locale, civilClosureTemplates(t))

  const runwaySentence =
    count === 1 && longest
      ? format(t.lead.runwaysOne, {
          length: formatLength(longest.lengthFt, locale),
          designator: runwayDesignator(longest),
        })
      : count > 1 && longest
        ? format(t.lead.runwaysMany, {
            count,
            length: formatLength(longest.lengthFt, locale),
            designator: runwayDesignator(longest),
          })
        : count > 0
          ? format(t.lead.runwaysCount, { count })
          : null

  return (
    <article className="page airport-page">
      <Breadcrumbs label={t.breadcrumbLabel} items={airportCrumbs(locale, app, airport)} />
      <header className="airport-header">
        <h1>
          {name}{' '}
          <span className="airport-codes">
            ({airport.iata}/{airport.icao})
          </span>
        </h1>
        <p className="airport-location">{airportLocation(airport, locale)}</p>
        {closure ? (
          <p className="civil-closure" role="note">
            {closure}
          </p>
        ) : null}
      </header>

      <p className="lead airport-lead">
        {[
          runwaySentence,
          airport.elevationFt === null
            ? null
            : format(t.lead.elevation, { elevation: formatLength(airport.elevationFt, locale) }),
        ]
          .filter((sentence): sentence is string => sentence !== null)
          .join(' ')}
        {others.length > 0 ? (
          <>
            {' '}
            {richText(others.length === 1 ? t.lead.otherOne : t.lead.otherMany, {
              province,
              airports: joined(
                others.map((other) => (
                  <Link key={other.icao} href={link(other)}>
                    {airportName(other, locale)} ({other.iata})
                  </Link>
                )),
              ),
            })}
          </>
        ) : null}
      </p>

      {weather}

      <section aria-labelledby="airport-live" className="airport-live">
        <h2 id="airport-live">{t.live.heading}</h2>
        <p>{covered ? t.live.covered : t.live.outside}</p>
        <p>
          <Link href={localePath(locale, airportMapPath(airport.icao))} className="button">
            {t.live.open}
          </Link>
        </p>
      </section>

      <section aria-labelledby="airport-schedule" className="airport-schedule">
        <h2 id="airport-schedule">{t.schedule.heading}</h2>
        <p>{format(t.schedule.body, { app })}</p>
        <p>
          {richText(t.schedule.observed, {
            about: <Link href={localePath(locale, '/hakkinda')}>{t.schedule.aboutLink}</Link>,
          })}
        </p>
      </section>

      <section aria-labelledby="airport-facts">
        <h2 id="airport-facts">{t.facts.heading}</h2>
        <dl className="facts">
          <div>
            <dt>{t.facts.iata}</dt>
            <dd className="mono">{airport.iata}</dd>
          </div>
          <div>
            <dt>{t.facts.icao}</dt>
            <dd className="mono">{airport.icao}</dd>
          </div>
          <div>
            <dt>{t.facts.type}</dt>
            <dd>{t.types[airport.type]}</dd>
          </div>
          {turkish ? (
            <div>
              <dt>{t.facts.province}</dt>
              <dd>{province}</dd>
            </div>
          ) : (
            <div>
              <dt>{t.facts.country}</dt>
              <dd>{airportCountryFull(airport, locale)}</dd>
            </div>
          )}
          {district ? (
            <div>
              <dt>{t.facts.municipality}</dt>
              <dd>{district}</dd>
            </div>
          ) : null}
          {airport.name !== name ? (
            <div>
              <dt>{t.facts.sourceName}</dt>
              <dd lang="en">{airport.name}</dd>
            </div>
          ) : null}
          <div className="facts-wide">
            <dt>{t.facts.reference}</dt>
            <dd>
              <span className="airport-coordinates">
                {formatCoordinatesDecimal(airport.lat, airport.lon, locale)}
              </span>
              <span className="airport-coordinates muted">
                {formatCoordinatesDms(airport.lat, airport.lon, locale)}
              </span>
            </dd>
          </div>
          <div>
            <dt>{t.facts.elevation}</dt>
            <dd>{formatLength(airport.elevationFt, locale)}</dd>
          </div>
          <div>
            <dt>{t.facts.runways}</dt>
            <dd>{count}</dd>
          </div>
        </dl>
      </section>

      {count > 0 ? (
        <section aria-labelledby="airport-runways">
          <h2 id="airport-runways">{t.runways.heading}</h2>
          <div
            className="table-wrap"
            role="region"
            aria-labelledby="airport-runways-caption"
            tabIndex={0}
          >
            <table className="table airport-runways">
              <caption id="airport-runways-caption">{format(t.runways.caption, { name })}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.runways.designator}</th>
                  <th scope="col">{t.runways.length}</th>
                  <th scope="col">{t.runways.width}</th>
                  <th scope="col">{t.runways.surface}</th>
                  <th scope="col">{t.runways.lighting}</th>
                  <th scope="col">{t.runways.bearing}</th>
                  {hasDisplaced ? <th scope="col">{t.runways.displaced}</th> : null}
                </tr>
              </thead>
              <tbody>
                {airport.runways.map((runway) => (
                  <tr key={runway.id}>
                    <th scope="row" className="mono">
                      {runwayDesignator(runway)}
                    </th>
                    <td className="num">{formatLength(runway.lengthFt, locale)}</td>
                    <td className="num">{formatMeters(runway.widthFt, locale)}</td>
                    <td>{messages.surface[runwaySurfaceKey(runway.surface)]}</td>
                    <td>{runway.lighted ? t.yes : t.notRecorded}</td>
                    <td className="num">
                      {perEnd(runway, (end) =>
                        end.trueBearingDeg === null ? null : formatBearing(end.trueBearingDeg),
                      )}
                    </td>
                    {hasDisplaced ? (
                      <td className="num">
                        {perEnd(runway, (end) => {
                          const ft = displacedFt(end)
                          return ft === null ? null : formatMeters(ft, locale)
                        })}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">{t.runways.bearingNote}</p>
          {hasDisplaced ? <p className="hint">{t.runways.displacedNote}</p> : null}
        </section>
      ) : null}

      {nearby.length > 0 ? (
        <section aria-labelledby="airport-nearby">
          <h2 id="airport-nearby">{t.nearby.heading}</h2>
          <ol className="airport-nearby">
            {nearby.map(({ airport: other, distanceKm }) => (
              <li key={other.icao}>
                {richText(t.nearby.item, {
                  airport: (
                    <Link href={link(other)}>
                      {airportName(other, locale)} ({other.iata})
                    </Link>
                  ),
                  place: airportPlace(other, locale),
                  distance: formatDistance(distanceKm, { locale }),
                })}
              </li>
            ))}
          </ol>
          <p className="hint">{t.nearby.note}</p>
        </section>
      ) : null}

      <footer className="airport-source">
        <p>
          {richText(t.source, {
            source: <SourceLink href={TERMS_LINKS.ourAirports}>OurAirports</SourceLink>,
            date: (
              <time dateTime={airport.dataUpdatedAt}>
                {formatDataDate(airport.dataUpdatedAt, locale)}
              </time>
            ),
          })}
        </p>
        <p>
          {richText(
            turkish
              ? t.nameSource[nameSource]
              : foreignAirportName(airport.icao) === undefined
                ? t.nameSourceForeign.rule
                : t.nameSourceForeign.curated,
            {
              // Resmî ad görünen addan farklı olabilir (LTAD: "Ankara Havalimanı", D-084).
              name: (
                <span lang="tr">
                  {airportOfficialName(airport.icao) ?? airportDisplayName(airport, 'tr')}
                </span>
              ),
            },
          )}
        </p>
        {weather === undefined ? null : (
          <p>
            {richText(messages.weather.source, {
              source: <SourceLink href={AVIATION_WEATHER_URL}>aviationweather.gov</SourceLink>,
            })}
          </p>
        )}
      </footer>
    </article>
  )
}
