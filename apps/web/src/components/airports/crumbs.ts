import { getMessages } from '@havayolu/i18n'
import type { AirportDetail, Locale } from '@havayolu/shared'
// Göreli yollar: vitest `@/` takma adını çözmez ve bu modül testte yüklenir.
import { localePath } from '../../lib/locale-routing'
import { airportPath } from '../../lib/seo/paths'
import { airportName } from './airport-text'
import type { Crumb } from './breadcrumbs'

/** Havalimanı listesinin mantıksal yolu (dil öneki `localePath` ile eklenir). */
export const AIRPORTS_PATH = '/havalimanlari'

/** Liste sayfasının içerik yolu: {app} › Havalimanları. */
export function airportsCrumbs(locale: Locale, app: string): Crumb[] {
  return [
    { name: app, href: localePath(locale, '/') },
    { name: getMessages(locale).nav.airports, href: localePath(locale, AIRPORTS_PATH) },
  ]
}

/** Havalimanı sayfasının içerik yolu: {app} › Havalimanları › {ad}. */
export function airportCrumbs(locale: Locale, app: string, airport: AirportDetail): Crumb[] {
  return [
    ...airportsCrumbs(locale, app),
    { name: airportName(airport, locale), href: localePath(locale, airportPath(airport.icao)) },
  ]
}

/** JSON-LD `BreadcrumbList` öğeleri (görünür içerik yoluyla aynı sıra ve adlar). */
export function crumbsForJsonLd(crumbs: readonly Crumb[]): { name: string; url: string }[] {
  return crumbs.map((crumb) => ({ name: crumb.name, url: crumb.href }))
}
