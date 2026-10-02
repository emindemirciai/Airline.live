import { LOCALES, type AirportDetail } from '@havayolu/shared'
import type { MetadataRoute } from 'next'
import { isIndexable, latestDataUpdate } from '../airports'
import { alternatesFor, localePath } from '../locale-routing'
import { airportPath } from './paths'

/**
 * Site haritası (M6b brief §c):
 * - Dizine eklenen her herkese açık sayfa iki dilde yer alır; her kayıt tr, en ve x-default
 *   karşılıklarını mutlak adresle listeler. Yandex dil sürümlerini site haritasından okumaz; HTML'deki
 *   hreflang etiketleri zorunludur, buradaki karşılıklar Google içindir.
 * - `noindex` sayfalar (`/durum`, tarifesiz havalimanları) ve yönetim sayfaları yer almaz.
 * - Havalimanları listelenen havalimanlarıdır (D-080): Türkiye ve yakın ülkeler; listelenmeyen
 *   yabancı havalimanının sayfası yoktur (404).
 * - `lastmod` yalnızca doğrulanabilir bir değişiklik tarihi varsa yazılır; `new Date()` kullanılmaz
 *   (Google lastmod'u yalnızca "tutarlı ve doğrulanabilir biçimde doğru" ise kullanır).
 * Kaynak: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
 */

/** Havalimanı dışındaki dizine eklenen sayfalar (dil önekisiz mantıksal yol). */
export const SITEMAP_PAGES = [
  '/',
  '/havalimanlari',
  '/hakkinda',
  '/yenilikler',
  '/kullanim-kosullari',
] as const

export interface SitemapInput {
  /** Sitenin kök adresi (`siteUrl()`). */
  base: URL
  /**
   * Listelenen bütün havalimanları (`getAirports()`: Türkiye ve yakın ülkeler); dizine eklenmeyenler
   * (`isIndexable`) ayıklanır.
   */
  airports: readonly AirportDetail[]
  /** Changelog'daki en yeni kaydın tarihi (YYYY-MM-DD); `/yenilikler`'in içeriği ondan gelir. */
  changelogDate: string
  /** Kullanım koşullarının yürürlük tarihi (YYYY-MM-DD). */
  termsDate: string
}

function entriesFor(
  base: URL,
  path: string,
  lastModified: string | undefined,
): MetadataRoute.Sitemap {
  const absolute = (value: string) => new URL(value, base).toString()
  return LOCALES.map((locale) => {
    const { languages } = alternatesFor(locale, path)
    return {
      url: absolute(localePath(locale, path)),
      ...(lastModified ? { lastModified } : {}),
      alternates: {
        languages: {
          tr: absolute(languages.tr),
          en: absolute(languages.en),
          'x-default': absolute(languages['x-default']),
        },
      },
    }
  })
}

export function buildSitemap(input: SitemapInput): MetadataRoute.Sitemap {
  const indexable = input.airports
    .filter(isIndexable)
    .toSorted((a, b) => a.icao.localeCompare(b.icao, 'en'))
  const lastModified: Record<(typeof SITEMAP_PAGES)[number], string | undefined> = {
    '/': undefined,
    // Liste sayfası tüm havalimanlarını (dizine eklenmeyenler dahil) gösterir.
    '/havalimanlari': latestDataUpdate(input.airports) ?? undefined,
    '/hakkinda': undefined,
    '/yenilikler': input.changelogDate,
    '/kullanim-kosullari': input.termsDate,
  }
  return [
    ...SITEMAP_PAGES.flatMap((path) => entriesFor(input.base, path, lastModified[path])),
    ...indexable.flatMap((airport) =>
      entriesFor(input.base, airportPath(airport.icao), airport.dataUpdatedAt),
    ),
  ]
}
