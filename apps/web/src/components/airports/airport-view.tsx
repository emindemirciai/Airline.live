import { PRIMARY_EXTRA_RADIUS_NM } from '@havayolu/geo/coverage'
import { format, formatDistance, getMessages, NO_VALUE } from '@havayolu/i18n'
import {
  airportDisplayName,
  airportDistrict,
  airportNameSource,
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
  isMonitoredStation,
  liveCoveragePlan,
  nearestAirports,
  sameProvinceAirports,
} from '../../lib/airports'
import { localePath } from '../../lib/locale-routing'
import { airportMapPath, airportPath } from '../../lib/seo/paths'
import { TERMS_LINKS } from '../../lib/terms'
import { richText } from '../rich-text'
import {
  airportName,
  airportProvince,
  formatBearing,
  formatCoordinatesDecimal,
  formatCoordinatesDms,
  formatDataDate,
  formatLength,
  formatMeters,
  formatRadius,
  longestRunway,
  runwayDesignator,
} from './airport-text'
import { Breadcrumbs } from './breadcrumbs'
import { airportCrumbs } from './crumbs'

/** "En yakın havalimanları" bölümündeki havalimanı sayısı (M6b brief §g). */
export const NEARBY_COUNT = 3

export interface AirportViewProps {
  locale: Locale
  /** Uygulamanın adı (`APP_NAME`). */
  app: string
  airport: AirportDetail
  /** Tüm havalimanları: en yakınlar ve aynı ildeki diğerleri bunlardan hesaplanır. */
  airports: readonly AirportDetail[]
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
 * Havalimanı sayfasının gövdesi (`/istasyon/<ICAO>`, M6b brief §g). Her değer veriden gelir
 * (OurAirports + istasyon tablosu + resmî ad tablosu + kapsama planı); ortak giriş metni yoktur.
 * OurAirports bayrakları (tarifeli sefer, pist ışıklandırması) kaynağa atfedilir: "evet" değilse
 * "kayıtlı değil" yazılır, "yok" denmez (D-076). Sunucuda çizilir, kanca yoktur.
 */
export function AirportView({ locale, app, airport, airports }: AirportViewProps) {
  const messages = getMessages(locale)
  const t = messages.airport
  const name = airportName(airport, locale)
  const province = airportProvince(airport, locale)
  const link = (target: AirportDetail) => localePath(locale, airportPath(target.icao))

  const count = airport.runways.length
  const longest = longestRunway(airport)
  const others = sameProvinceAirports(airport, airports)
  const nearby = nearestAirports(airport, airports, NEARBY_COUNT)
  const monitored = isMonitoredStation(airport)
  const hasDisplaced = airport.runways.some((runway) => runway.ends.some((end) => displacedFt(end)))
  const nameSource = airportNameSource(airport.icao)
  const covered = isInLiveCoverage(airport, liveCoveragePlan(airports))
  const district = airportDistrict(airport)

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

  const stationValue = !monitored
    ? t.stationNo
    : airport.station?.primary
      ? t.stationPrimary
      : t.stationYes

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
        <p className="airport-location">{format(t.location, { province })}</p>
      </header>

      <p className="lead airport-lead">
        {[
          runwaySentence,
          airport.elevationFt === null
            ? null
            : format(t.lead.elevation, { elevation: formatLength(airport.elevationFt, locale) }),
          airport.scheduled ? t.lead.scheduled : t.lead.unscheduled,
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

      <section aria-labelledby="airport-live" className="airport-live">
        <h2 id="airport-live">{t.live.heading}</h2>
        {monitored && airport.station ? (
          <>
            <p>
              {format(t.live.station, {
                app,
                radius: formatRadius(airport.station.fetchRadiusNm, locale),
              })}
            </p>
            {airport.station.primary ? (
              <p>
                {format(t.live.stationPrimary, {
                  radius: formatRadius(PRIMARY_EXTRA_RADIUS_NM, locale),
                })}
              </p>
            ) : null}
          </>
        ) : (
          <p>{covered ? t.live.notStation : t.live.outside}</p>
        )}
        <p>
          <Link href={localePath(locale, airportMapPath(airport.icao))} className="button">
            {t.live.open}
          </Link>
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
          <div>
            <dt>{t.facts.province}</dt>
            <dd>{province}</dd>
          </div>
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
            <dt>{t.facts.scheduled}</dt>
            <dd>{airport.scheduled ? t.yes : t.notRecorded}</dd>
          </div>
          <div>
            <dt>{t.facts.station}</dt>
            <dd>{stationValue}</dd>
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
                  province: airportProvince(other, locale),
                  distance: formatDistance(distanceKm, { locale }),
                })}
              </li>
            ))}
          </ol>
          <p className="hint">{t.nearby.note}</p>
        </section>
      ) : null}

      <p className="airport-limits">
        {richText(t.limits, {
          about: <Link href={localePath(locale, '/hakkinda')}>{t.limitsLink}</Link>,
        })}
      </p>

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
          {richText(t.nameSource[nameSource], {
            name: <span lang="tr">{airportDisplayName(airport, 'tr')}</span>,
          })}
        </p>
      </footer>
    </article>
  )
}
