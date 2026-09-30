import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { connection } from 'next/server'
// Göreli yollar: vitest `@/` takma adını çözmez; bu dosya testte doğrudan çağrılır.
import { getServerEnv } from '../lib/env'
import { absoluteUrl, siteUrlFrom } from '../lib/seo/metadata'
import { robotsPolicy } from '../lib/seo/robots'

/**
 * `/robots.txt` (politika: lib/seo/robots.ts). İstek anında üretilir: WEB_HOST ve ADMIN_HOST
 * çalışma zamanı ortamındadır, Docker build'inde yoktur (`connection()`, D-075).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection()
  const env = getServerEnv()
  const incoming = await headers()
  return robotsPolicy({
    requestHost: incoming.get('x-forwarded-host') ?? incoming.get('host'),
    adminHost: env.ADMIN_HOST,
    sitemapUrl: env.WEB_HOST ? absoluteUrl('/sitemap.xml', siteUrlFrom(env.WEB_HOST)) : null,
  })
}
