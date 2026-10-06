import type { AirportDetail, Locale } from '@havayolu/shared'
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { Suspense } from 'react'
import { airportDescription, airportName, airportTitle } from '@/components/airports/airport-text'
import { AirportView } from '@/components/airports/airport-view'
import { AirportWeatherSection, WeatherSkeleton } from '@/components/airports/airport-weather'
import { airportCrumbs, crumbsForJsonLd } from '@/components/airports/crumbs'
import { JsonLd } from '@/components/json-ld'
import {
  getAirports,
  isInLiveCoverage,
  isIndexable,
  liveCoveragePlan,
  resolveAirportCode,
} from '@/lib/airports'
import { appName, getServerEnv } from '@/lib/env'
import { getLocale } from '@/lib/locale'
import { localePath } from '@/lib/locale-routing'
import { apiBaseUrl } from '@/lib/map-config'
import { pageMetadata } from '@/lib/seo/metadata'
import { airportPath } from '@/lib/seo/paths'
import {
  airportId,
  airportNode,
  breadcrumbId,
  breadcrumbList,
  webPageNode,
} from '@/lib/seo/structured-data'

interface LoadedAirport {
  locale: Locale
  airport: AirportDetail
  airports: readonly AirportDetail[]
}

/**
 * Adresteki kodu çözer. Kanonik biçim büyük harfli ICAO'dur (D-076): küçük harfli kod ve IATA kodu
 * kalıcı yönlendirme (308), bilinmeyen kod gerçek 404 alır. Kod listelenen havalimanlarında
 * (Türkiye ve yakın ülkeler, D-080) aranır: veritabanında olup listelenmeyen yabancı havalimanı da
 * 404'tür. Bu karar Suspense sınırından ve akıştan önce verilir; akış başladıktan sonra durum kodu
 * 200'e kilitlenir (yumuşak 404). Bu yüzden bu klasörde `loading.tsx` yoktur (M6b brief §g).
 */
async function loadAirport(params: Promise<{ icao: string }>): Promise<LoadedAirport> {
  const [{ icao }, locale, airports] = await Promise.all([params, getLocale(), getAirports()])
  const resolved = resolveAirportCode(icao, airports)
  if (resolved.kind === 'redirect') {
    permanentRedirect(localePath(locale, airportPath(resolved.icao)))
  }
  if (resolved.kind === 'not_found') notFound()
  return { locale, airport: resolved.airport, airports }
}

export async function generateMetadata({
  params,
}: PageProps<'/istasyon/[icao]'>): Promise<Metadata> {
  const { locale, airport, airports } = await loadAirport(params)
  return pageMetadata({
    locale,
    path: airportPath(airport.icao),
    title: airportTitle(airport, locale),
    description: airportDescription(
      airport,
      locale,
      isInLiveCoverage(airport, liveCoveragePlan(airports)),
    ),
    // Tarifesiz ve istasyon olmayan askerî hava üsleri (adı sivil bir kaynaktan doğrulanmaz):
    // `noindex, follow`; site haritasında da yoklar (lib/airports.ts → `isIndexable`, D-076, D-084).
    index: isIndexable(airport),
    // Paylaşım görseli bu klasördeki `opengraph-image.tsx`'tir (iki dil aynı görseli kullanır).
    ogImage: 'segment',
  })
}

/**
 * Havalimanı sayfası (`/istasyon/<ICAO>`, EN `/en/istasyon/<ICAO>`), M6b brief §g; yakın ülkelerdeki
 * listelenen havalimanları da aynı sayfayla açılır (M6d, D-080). Hava durumu ve
 * METAR/TAF kaydı (M6c) Suspense içinde gelir: 404/308 kararı ondan önce verilir, hava durumu isteği
 * gövdenin geri kalanını bekletmez. Başlık, açıklama, JSON-LD ve paylaşım görseli hava durumu
 * içermez (D-078).
 */
export default async function AirportPage({ params }: PageProps<'/istasyon/[icao]'>) {
  const { locale, airport, airports } = await loadAirport(params)
  const env = getServerEnv()
  const app = appName(env)
  const path = airportPath(airport.icao)
  const crumbs = airportCrumbs(locale, app, airport)

  return (
    <>
      <JsonLd
        data={[
          webPageNode({
            locale,
            path,
            // Görünür H1 ile aynı metin.
            name: `${airportName(airport, locale)} (${airport.iata}/${airport.icao})`,
            about: airportId(airport.icao),
            dateModified: airport.dataUpdatedAt,
            breadcrumb: true,
          }),
          airportNode(airport, locale),
          breadcrumbList(crumbsForJsonLd(crumbs), breadcrumbId(locale, path)),
        ]}
      />
      <AirportView
        locale={locale}
        app={app}
        airport={airport}
        airports={airports}
        weather={
          <Suspense fallback={<WeatherSkeleton locale={locale} />}>
            <AirportWeatherSection
              locale={locale}
              airport={airport}
              apiBaseUrl={apiBaseUrl(env.API_HOST)}
            />
          </Suspense>
        }
      />
    </>
  )
}
