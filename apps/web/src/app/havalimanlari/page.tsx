import { format, getMessages } from '@havayolu/i18n'
import type { Metadata } from 'next'
import { AirportsView, airportCounts } from '@/components/airports/airports-view'
import { airportName, sortByProvince } from '@/components/airports/airport-text'
import { AIRPORTS_PATH, airportsCrumbs, crumbsForJsonLd } from '@/components/airports/crumbs'
import { JsonLd } from '@/components/json-ld'
import { getAirports, latestDataUpdate } from '@/lib/airports'
import { appName, getServerEnv } from '@/lib/env'
import { getLocale } from '@/lib/locale'
import { localePath } from '@/lib/locale-routing'
import { pageMetadata } from '@/lib/seo/metadata'
import { airportPath } from '@/lib/seo/paths'
import { breadcrumbId, breadcrumbList, itemList, webPageNode } from '@/lib/seo/structured-data'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = getMessages(locale).seo.airports
  const { count } = airportCounts(await getAirports())
  return pageMetadata({
    locale,
    path: AIRPORTS_PATH,
    title: t.title,
    description: format(t.description, { count }),
  })
}

/**
 * Türkiye'deki havalimanlarının listesi (M6b). Veri tek toplu API çağrısından gelir
 * (`getAirports`, saatlik önbellek); API ulaşılamazsa sayfa 500 verir.
 */
export default async function AirportsPage() {
  const locale = await getLocale()
  const messages = getMessages(locale)
  const app = appName(getServerEnv())
  const airports = await getAirports()
  const rows = sortByProvince(airports, locale)
  const crumbs = airportsCrumbs(locale, app)
  const latest = latestDataUpdate(airports)

  return (
    <>
      <JsonLd
        data={[
          webPageNode({
            locale,
            path: AIRPORTS_PATH,
            type: 'CollectionPage',
            name: messages.airports.title,
            mainEntity: itemList(
              rows.map((airport) => ({
                name: airportName(airport, locale),
                url: localePath(locale, airportPath(airport.icao)),
              })),
            ),
            ...(latest ? { dateModified: latest } : {}),
            breadcrumb: true,
          }),
          breadcrumbList(crumbsForJsonLd(crumbs), breadcrumbId(locale, AIRPORTS_PATH)),
        ]}
      />
      <AirportsView locale={locale} app={app} airports={airports} />
    </>
  )
}
