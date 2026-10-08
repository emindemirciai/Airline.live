import { PRIMARY_EXTRA_RADIUS_NM } from '@havayolu/geo/coverage'
import { format, formatDistance, getMessages } from '@havayolu/i18n'
import { PROJECT, type Locale } from '@havayolu/shared'
import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'
// Göreli yollar: vitest `@/` takma adını çözmez ve bu bileşen testte çizilir.
import { localePath } from '../../lib/locale-routing'
import { DATA_ATTRIBUTION } from '../../lib/map-config'
import { airportPath } from '../../lib/seo/paths'
import { TERMS_LINKS, TERMS_PATH } from '../../lib/terms'
import { formatRadius, listedRadiusKm } from '../airports/airport-text'
import { AVIATION_WEATHER_URL } from '../airports/weather-links'
import { richText } from '../rich-text'

/** Havayolu kodlarının kaynağı (data-sources.md §4; ATTRIBUTION.md: nezaketen anılır). */
export const VRS_STANDING_DATA_URL = 'https://github.com/vradarserver/standing-data'

/**
 * Esri'nin zorunlu atıf metni (data-sources.md §6a, map-config.ts → ESRI_ATTRIBUTION). Sağlayıcının
 * istediği İngilizce metindir; çevrilmez.
 */
const ESRI_CREDIT =
  'Powered by Esri · Esri, Vantor, Earthstar Geographics, and the GIS User Community'

export interface AirportLink {
  icao: string
  iata: string
  name: string
}

export interface MonitoredStation extends AirportLink {
  primary: boolean
}

export interface AboutContentProps {
  locale: Locale
  /** Uygulamanın adı (`APP_NAME`). */
  app: string
  /**
   * İzlenen (etkin) istasyonlar, veriden (`getAirports`); birincil önce. API'ye ulaşılamazsa null:
   * sayfa listesiz çizilir.
   */
  stations: readonly MonitoredStation[] | null
  /**
   * Canlı veri çekim alanının dışında kalan Türkiye havalimanları (kapsama planı, `isInLiveCoverage`),
   * veriden. Diğer ülkelerdeki havalimanları burada sayılmaz; onlar için ayrı cümle vardır (D-080).
   * API'ye ulaşılamazsa null.
   */
  outside: readonly AirportLink[] | null
}

/** Dış kaynak bağlantısı; kaynak siteler İngilizcedir. */
function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} hrefLang="en">
      {children}
    </a>
  )
}

/**
 * Hakkında ve yöntem sayfası (`/hakkinda`, M6b). Siteyi kimin işlettiği, neyi gösterip neyi
 * göstermediği (domain.md → "v1 sınırları"), yöntem (ADS-B, MLAT, tazelik hedefleri: data-sources.md
 * §1 ve D-073), veri kaynakları ve lisanslar (data-sources.md §1, §3, §4, §5, §6, §6a; ATTRIBUTION.md;
 * hava durumu D-078) ve
 * uçak gizliliği (D-071, CLAUDE.md → Gizlilik; engel listesi apps/api/src/admin/blocklist.ts).
 * Canlı uçak verisinin şimdilik yalnızca Türkiye ve çevresinden çekildiği yöntem bölümünün kapsama
 * cümlesindedir (`method.coverage`, D-106); diğer ülkelerdeki havalimanlarının listelendiği ayrı
 * cümledir, uzaklık sınırı açık halkalardandır (`listedRadiusKm`, D-080).
 * Uydurma bilgi yoktur; sayılar bu belgelerdendir. İstasyon listesi ve çekim alanı dışındaki
 * havalimanları veriden gelir; birincil çemberin yarıçapı kapsama planındandır (packages/geo). Durum
 * satırının gösterdiği yaş: components/map/panels/status-strip.tsx → `dataAgeSeconds`.
 */
export function AboutContent({ locale, app, stations, outside }: AboutContentProps) {
  const messages = getMessages(locale)
  const t = messages.about
  const radiusKm = listedRadiusKm()

  return (
    <article className="page about">
      <h1>{t.title}</h1>
      <p className="lead">
        {richText(t.intro, {
          app,
          owner: (
            <a href={PROJECT.ownerUrl} rel="author">
              {PROJECT.owner}
            </a>
          ),
        })}
      </p>

      <section aria-labelledby="about-shows">
        <h2 id="about-shows">{t.shows.heading}</h2>
        <ul>
          <li>{t.shows.map}</li>
          <li>{t.shows.search}</li>
          <li>{t.shows.airports}</li>
          <li>{t.shows.weather}</li>
        </ul>
      </section>

      <section aria-labelledby="about-limits">
        <h2 id="about-limits">{t.limits.heading}</h2>
        <p>{t.limits.intro}</p>
        <ul>
          <li>{t.limits.times}</li>
          <li>{t.limits.delays}</li>
          <li>{t.limits.board}</li>
          <li>{t.limits.search}</li>
        </ul>
      </section>

      <section aria-labelledby="about-method">
        <h2 id="about-method">{t.method.heading}</h2>
        <p>
          {richText(t.method.adsb, {
            source: <SourceLink href={DATA_ATTRIBUTION.href}>{DATA_ATTRIBUTION.label}</SourceLink>,
          })}
        </p>
        <p>{t.method.coverage}</p>
        <p>
          {format(t.method.freshness, { radius: formatRadius(PRIMARY_EXTRA_RADIUS_NM, locale) })}
        </p>
        {stations && stations.length > 0 ? (
          <p>
            {t.method.stations}{' '}
            {stations.map((station, index) => (
              <Fragment key={station.icao}>
                {index > 0 ? ', ' : null}
                <Link href={localePath(locale, airportPath(station.icao))}>{station.name}</Link> (
                {station.iata}
                {station.primary ? `, ${t.method.primary}` : ''})
              </Fragment>
            ))}
            .
          </p>
        ) : null}
        {outside && outside.length > 0 ? (
          <p>
            {t.method.outside}{' '}
            {outside.map((airport, index) => (
              <Fragment key={airport.icao}>
                {index > 0 ? ', ' : null}
                <Link href={localePath(locale, airportPath(airport.icao))}>{airport.name}</Link> (
                {airport.iata})
              </Fragment>
            ))}
            .
          </p>
        ) : null}
        <p>
          {radiusKm === null
            ? t.method.abroadAll
            : format(t.method.abroad, { km: formatDistance(radiusKm, { locale }) })}{' '}
          {t.method.abroadCoverage}
        </p>
        <p>{t.method.reference}</p>
      </section>

      <section aria-labelledby="about-sources">
        <h2 id="about-sources">{t.sources.heading}</h2>
        <ul>
          <li>
            {richText(t.sources.live, {
              source: (
                <SourceLink href={DATA_ATTRIBUTION.href}>{DATA_ATTRIBUTION.label}</SourceLink>
              ),
              license: (
                <SourceLink href={DATA_ATTRIBUTION.licenseHref}>
                  {DATA_ATTRIBUTION.license}
                </SourceLink>
              ),
            })}{' '}
            {t.sources.derived}
          </li>
          <li>
            {richText(t.sources.reference, {
              source: <SourceLink href={TERMS_LINKS.ourAirports}>OurAirports</SourceLink>,
            })}
          </li>
          <li>{t.sources.names}</li>
          <li>
            {richText(t.sources.airlines, {
              source: <SourceLink href={VRS_STANDING_DATA_URL}>VRS standing-data</SourceLink>,
            })}
          </li>
          <li>
            {richText(t.sources.vector, {
              openFreeMap: <SourceLink href={TERMS_LINKS.openFreeMap}>OpenFreeMap</SourceLink>,
              openMapTiles: <SourceLink href={TERMS_LINKS.openMapTiles}>OpenMapTiles</SourceLink>,
              openStreetMap: (
                <SourceLink href={TERMS_LINKS.openStreetMap}>OpenStreetMap</SourceLink>
              ),
            })}
          </li>
          <li>{richText(t.sources.satellite, { esri: <span lang="en">{ESRI_CREDIT}</span> })}</li>
          <li>
            {richText(t.sources.weather, {
              source: <SourceLink href={AVIATION_WEATHER_URL}>aviationweather.gov</SourceLink>,
            })}
          </li>
        </ul>
      </section>

      <section aria-labelledby="about-privacy">
        <h2 id="about-privacy">{t.privacy.heading}</h2>
        <ul>
          <li>{t.privacy.military}</li>
          <li>{t.privacy.registration}</li>
          <li>{t.privacy.blocklist}</li>
        </ul>
      </section>

      <section aria-labelledby="about-more">
        <h2 id="about-more">{t.more.heading}</h2>
        <ul>
          <li>
            {richText(t.more.terms, {
              link: <Link href={localePath(locale, TERMS_PATH)}>{messages.terms.title}</Link>,
            })}
          </li>
          <li>
            {richText(t.more.changelog, {
              link: (
                <Link href={localePath(locale, '/yenilikler')}>{messages.changelog.title}</Link>
              ),
            })}
          </li>
        </ul>
      </section>
    </article>
  )
}

/** Sayfanın uygulama adıyla biçimlenmiş açıklaması (üst veri). */
export function aboutDescription(locale: Locale, app: string): string {
  return format(getMessages(locale).seo.about.description, { app })
}
