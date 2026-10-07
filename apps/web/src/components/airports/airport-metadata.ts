import type { AirportDetail, Locale } from '@havayolu/shared'
import type { Metadata } from 'next'
// Göreli yollar: vitest `@/` takma adını çözmez; bu modül birim testinde yüklenir.
import { isInLiveCoverage, isIndexable, liveCoveragePlan } from '../../lib/airports'
import { pageMetadata } from '../../lib/seo/metadata'
import { airportPath } from '../../lib/seo/paths'
import { airportDescription, airportTitle } from './airport-text'

/**
 * Havalimanı sayfasının (`/istasyon/<ICAO>`, EN `/en/istasyon/<ICAO>`) üst verisi. Sayfanın
 * `generateMetadata`'sı bunu çağırır; `index` bağlantısı `airport-metadata.test.ts`'te denetlenir
 * (dizine eklenmeyen havalimanı sayfası fixture'da yoktur, e2e onu çizemez).
 */
export function airportPageMetadata(o: {
  locale: Locale
  airport: AirportDetail
  airports: readonly AirportDetail[]
}): Metadata {
  return pageMetadata({
    locale: o.locale,
    path: airportPath(o.airport.icao),
    title: airportTitle(o.airport, o.locale),
    description: airportDescription(
      o.airport,
      o.locale,
      isInLiveCoverage(o.airport, liveCoveragePlan(o.airports)),
    ),
    // Adı doğrulanmamış, tarifesiz ve istasyon olmayan yeni kayıt: `noindex, follow`; site
    // haritasında da yok (lib/airports.ts → `isIndexable`, D-076, D-084). Askerî hava üsleri
    // listede olmadığı için sayfaları 404'tür (D-107).
    index: isIndexable(o.airport),
    // Paylaşım görseli sayfanın klasöründeki `opengraph-image.tsx`'tir (iki dil aynı görseli
    // kullanır).
    ogImage: 'segment',
  })
}
