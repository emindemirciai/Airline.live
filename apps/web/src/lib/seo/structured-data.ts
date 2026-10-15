import 'server-only'
import { ftToM } from '@havayolu/geo'
import { getMessages } from '@havayolu/i18n'
import {
  airportCountryCode,
  airportDisplayName,
  airportLocality,
  LOCALES,
  provinceName,
  type AirportDetail,
  type Locale,
} from '@havayolu/shared'
// Göreli yol: vitest `@/` takma adını çözmez.
import { isTurkish } from '../../components/airports/airport-text'
import { appName, getServerEnv } from '../env'
import { localePath } from '../locale-routing'
import { absoluteUrl, siteUrl } from './metadata'
import { airportMapPath, airportPath } from './paths'

/**
 * schema.org JSON-LD düğümleri (M6b brief §b). Düğümler `@context` taşımaz; `JsonLd` bileşeni
 * tek düğümü ya da `@graph` dizisini bağlamla sarar. Kurallar:
 * - Her değer sayfada da görünür olmalıdır (Google yapılandırılmış veri yönergeleri).
 * - `SearchAction` yok (Google site bağlantıları arama kutusunu 2024-11-21'de kaldırdı), `sameAs`
 *   yok (repo gizli), FAQPage/Dataset/SoftwareApplication yok (kullanıcı kararı, D-076).
 * Kaynak: https://developers.google.com/search/docs/appearance/structured-data/sd-policies
 */
export type JsonLdNode = Record<string, unknown>

const ids = {
  website: () => absoluteUrl('/#website'),
  organization: () => absoluteUrl('/#org'),
}

/** Sayfanın dil önekli mutlak adresi. */
function pageUrl(locale: Locale, path: string): string {
  return absoluteUrl(localePath(locale, path))
}

/** Sitenin yayıncısı (marka). Logo 512 px uygulama simgesidir (`app/icon.tsx`). */
export function organizationNode(locale: Locale = 'tr'): JsonLdNode {
  const name = appName(getServerEnv())
  return {
    '@type': 'Organization',
    '@id': ids.organization(),
    name,
    url: absoluteUrl('/'),
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/icon/512'),
      width: 512,
      height: 512,
    },
    description: getMessages(locale).seo.home.description,
  }
}

/** Ana sayfa grafiği: `WebSite` + `Organization`. */
export function websiteGraph(locale: Locale): JsonLdNode[] {
  const name = appName(getServerEnv())
  const host = siteUrl().host
  const website: JsonLdNode = {
    '@type': 'WebSite',
    '@id': ids.website(),
    name,
    // Ad alan adıyla aynıysa (büyük-küçük harf dışında; `Airline.live` / `airline.live`) tekrar yazılmaz.
    ...(host.toLowerCase() !== name.toLowerCase() ? { alternateName: host } : {}),
    url: absoluteUrl('/'),
    inLanguage: [...LOCALES],
    description: getMessages(locale).seo.home.description,
    publisher: { '@id': ids.organization() },
  }
  return [website, organizationNode(locale)]
}

export interface BreadcrumbItem {
  name: string
  /** Dil önekli site içi yol (`localePath` ile) ya da mutlak adres. */
  url: string
}

/** Görünür içerik yolu (breadcrumb) ile aynı sırada `BreadcrumbList`; konumlar 1'den başlar. */
export function breadcrumbList(items: readonly BreadcrumbItem[], id?: string): JsonLdNode {
  const base = siteUrl()
  return {
    '@type': 'BreadcrumbList',
    ...(id ? { '@id': id } : {}),
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url, base),
    })),
  }
}

export interface WebPageOptions {
  locale: Locale
  /** Dil önekisiz mantıksal yol (`/istasyon/LTFM`). */
  path: string
  name: string
  description?: string
  type?: 'WebPage' | 'CollectionPage' | 'AboutPage'
  /** Sayfanın konusu olan düğümün `@id`'si (ör. `airportId(a)`). */
  about?: string
  /** Sayfanın ana varlığı (ör. `ItemList`) düğümün kendisi olarak gömülür. */
  mainEntity?: JsonLdNode
  /** ISO tarih; yalnızca doğrulanabilir bir değişiklik tarihi varsa (ör. `dataUpdatedAt`). */
  dateModified?: string
  /** Aynı grafikteki `BreadcrumbList`'e bağlanır (`breadcrumbId(locale, path)`). */
  breadcrumb?: boolean
}

/** Sayfanın `WebPage` düğümünün `@id`'si. */
export function pageId(locale: Locale, path: string): string {
  return `${pageUrl(locale, path)}#page`
}

/** Sayfanın `BreadcrumbList` düğümünün `@id`'si. */
export function breadcrumbId(locale: Locale, path: string): string {
  return `${pageUrl(locale, path)}#breadcrumb`
}

export function webPageNode(o: WebPageOptions): JsonLdNode {
  return {
    '@type': o.type ?? 'WebPage',
    '@id': pageId(o.locale, o.path),
    url: pageUrl(o.locale, o.path),
    name: o.name,
    ...(o.description ? { description: o.description } : {}),
    inLanguage: o.locale,
    isPartOf: { '@id': ids.website() },
    ...(o.about ? { about: { '@id': o.about } } : {}),
    ...(o.mainEntity ? { mainEntity: o.mainEntity } : {}),
    ...(o.dateModified ? { dateModified: o.dateModified } : {}),
    ...(o.breadcrumb ? { breadcrumb: { '@id': breadcrumbId(o.locale, o.path) } } : {}),
  }
}

/**
 * Havalimanı varlığının kimliği iki dilde aynıdır (TR sayfasının adresi): TR ve EN sayfaları aynı
 * havalimanını anlatır.
 */
export function airportId(icao: string): string {
  return `${absoluteUrl(localePath('tr', airportPath(icao)))}#airport`
}

/** Canlı haritayı havalimanında açan mutlak adres (`/?havalimani=LTFM`, EN `/en?havalimani=LTFM`). */
export function airportMapUrl(icao: string, locale: Locale): string {
  return absoluteUrl(localePath(locale, airportMapPath(icao)))
}

/**
 * `Airport` düğümü. Rakım schema.org'da birimsiz sayı olarak metre kabul edilir
 * (https://schema.org/elevation); sayfadaki gibi tam metreye yuvarlanır. Adreste Türkiye'de il
 * (`addressRegion`), yakın ülkelerde yalnızca yerleşim ve ülke yazılır (sayfadaki yer satırı gibi).
 */
export function airportNode(a: AirportDetail, locale: Locale): JsonLdNode {
  const name = airportDisplayName(a, locale)
  const region = isTurkish(a) ? provinceName(a.isoRegion, locale) : null
  // OurAirports'un ülke kodu; gösterilen ülke koddan ayrılıyorsa (Ercan/LCEN: KKTC, kod CY; D-080)
  // yazılmaz: JSON-LD yalnızca sayfada görünen değerleri taşır.
  const country = airportCountryCode(a)
  const geo: JsonLdNode = {
    '@type': 'GeoCoordinates',
    latitude: a.lat,
    longitude: a.lon,
    ...(a.elevationFt === null ? {} : { elevation: Math.round(ftToM(a.elevationFt)) }),
  }
  // Ham OurAirports yerleşimi değil, sayfadaki "Hizmet verdiği yerleşim": Türkiye’de temiz biçimdeki
  // ve ilden farklı ilçe, yakın ülkelerde küratörlü şehir adı (sayfanın dilinde).
  const locality = airportLocality(a, locale)
  const fields: JsonLdNode = {
    ...(locality ? { addressLocality: locality } : {}),
    ...(region ? { addressRegion: region } : {}),
    ...(country ? { addressCountry: country } : {}),
  }
  // Hiçbir adres alanı yoksa boş adres yazılmaz (Ercan'da ülke kodu hiç yazılmaz).
  const address: JsonLdNode | null =
    Object.keys(fields).length > 0 ? { '@type': 'PostalAddress', ...fields } : null
  return {
    '@type': 'Airport',
    '@id': airportId(a.icao),
    name,
    ...(a.name && a.name !== name ? { alternateName: a.name } : {}),
    ...(a.iata ? { iataCode: a.iata } : {}),
    icaoCode: a.icao,
    geo,
    ...(address ? { address } : {}),
    hasMap: airportMapUrl(a.icao, locale),
  }
}

export interface ItemListEntry {
  name: string
  /** Dil önekli site içi yol ya da mutlak adres. */
  url: string
}

/**
 * Liste sayfası (`/havalimanlari`) için `ItemList`; sıra görünür tablodaki sıradır. Sitenin adresi
 * bir kez okunur: `siteUrl()` her çağrıda ortam değişkenlerini zod ile doğrular ve 4. halkada 1.217
 * satırda bu, her çizimde yüzlerce ms tutuyordu (D-102).
 */
export function itemList(entries: readonly ItemListEntry[]): JsonLdNode {
  const base = siteUrl()
  return {
    '@type': 'ItemList',
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      url: absoluteUrl(entry.url, base),
    })),
  }
}
