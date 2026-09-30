import { CHANGELOG } from '@havayolu/shared'
import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
// Göreli yollar: vitest `@/` takma adını çözmez; bu dosya testte doğrudan çağrılır.
import { getAirports } from '../lib/airports'
import { siteUrl } from '../lib/seo/metadata'
import { buildSitemap } from '../lib/seo/sitemap'
import { TERMS_EFFECTIVE_DATE } from '../lib/terms'

/**
 * `/sitemap.xml` (kurallar: lib/seo/sitemap.ts). İstek anında üretilir: WEB_HOST çalışma zamanı
 * ortamındadır ve havalimanı verisi API'den gelir (Docker build'inde ikisi de yoktur). Havalimanı
 * verisi sayfalarla aynı önbellekli toplu istekten okunur (saatte bir API çağrısı).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()
  const newest = CHANGELOG[0]
  if (!newest) throw new Error('Changelog boş; site haritası üretilemiyor.')
  return buildSitemap({
    base: siteUrl(),
    airports: await getAirports(),
    changelogDate: newest.date,
    termsDate: TERMS_EFFECTIVE_DATE,
  })
}
