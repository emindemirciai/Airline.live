import { getMessages } from '@havayolu/i18n'
import type { Metadata } from 'next'
import { unstable_rethrow } from 'next/navigation'
import {
  aboutDescription,
  AboutContent,
  type AirportLink,
  type MonitoredStation,
} from '@/components/about/about-content'
import { airportName } from '@/components/airports/airport-text'
import { JsonLd } from '@/components/json-ld'
import { getAirports, isInLiveCoverage, isMonitoredStation, liveCoveragePlan } from '@/lib/airports'
import { appName, getServerEnv } from '@/lib/env'
import { getLocale } from '@/lib/locale'
import { pageMetadata } from '@/lib/seo/metadata'
import { organizationNode, webPageNode } from '@/lib/seo/structured-data'
import type { AirportDetail, Locale } from '@havayolu/shared'

const ABOUT_PATH = '/hakkinda'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return pageMetadata({
    locale,
    path: ABOUT_PATH,
    title: getMessages(locale).seo.about.title,
    description: aboutDescription(locale, appName(getServerEnv())),
  })
}

interface AirportLists {
  stations: MonitoredStation[] | null
  outside: AirportLink[] | null
}

/**
 * İzlenen istasyonlar (birincil önce, sonra ada göre) ve canlı veri çekim alanının dışında kalan
 * havalimanları (ada göre), veriden. Sayfanın asıl içeriği sabit metindir; API'ye ulaşılamazsa sayfa
 * 500 vermez, yalnızca bu listeler çıkmaz.
 */
async function airportLists(locale: Locale): Promise<AirportLists> {
  const collator = locale === 'tr' ? 'tr-TR' : 'en-GB'
  try {
    const airports = await getAirports()
    const plan = liveCoveragePlan(airports)
    const link = (airport: AirportDetail): AirportLink => ({
      icao: airport.icao,
      iata: airport.iata,
      name: airportName(airport, locale),
    })
    return {
      stations: airports
        .filter(isMonitoredStation)
        .map((airport) => ({ ...link(airport), primary: airport.station?.primary === true }))
        .sort(
          (a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name, collator),
        ),
      outside: airports
        .filter((airport) => !isInLiveCoverage(airport, plan))
        .map(link)
        .sort((a, b) => a.name.localeCompare(b.name, collator)),
    }
  } catch (error) {
    // Next'in kendi akış denetimi hataları (dinamik kullanım, yönlendirme) yutulmaz.
    unstable_rethrow(error)
    return { stations: null, outside: null }
  }
}

/** Hakkında ve yöntem (`/hakkinda`, EN `/en/hakkinda`), M6b. */
export default async function AboutPage() {
  const locale = await getLocale()
  const messages = getMessages(locale)
  const app = appName(getServerEnv())
  const organization = organizationNode(locale)

  return (
    <>
      <JsonLd
        data={[
          webPageNode({
            locale,
            path: ABOUT_PATH,
            type: 'AboutPage',
            name: messages.about.title,
            about: String(organization['@id']),
          }),
          organization,
        ]}
      />
      <AboutContent locale={locale} app={app} {...await airportLists(locale)} />
    </>
  )
}
