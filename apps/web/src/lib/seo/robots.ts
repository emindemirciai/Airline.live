import type { MetadataRoute } from 'next'
import { isAdminHost } from '../admin-host'

/**
 * robots.txt politikası (kullanıcı kararı 2026-09-29, D-076):
 * - Tüm kurallar tek bir `*` grubundadır. Google ve RFC 9309 bir tarayıcıya yalnızca en özel
 *   grubu uygular; adlı bir "Allow" grubu `Disallow: /admin`'i sessizce kaybettirirdi.
 * - Arama, yanıt ve eğitim tarayıcılarının hepsine izin verilir; yalnızca Bytespider engellenir.
 * - `/_next/` engellenmez: Google sayfayı çizmek için JS ve CSS'e ihtiyaç duyar.
 * - Yandex `Clean-param`: paylaşım ve kampanya parametreleri aynı sayfanın kopyası sayılır
 *   (Next.js 16.3 `rules[].other`, https://yandex.com/support/webmaster/robot-workings/clean-param.html).
 * - Admin alan adı hiçbir şeyi taratmaz.
 * Kaynaklar: https://www.rfc-editor.org/rfc/rfc9309.html ·
 * https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt
 */

/** Taranmaması gereken yollar: yönetim, iç API ve dil değiştirme yönlendirmesi. */
export const DISALLOWED_PATHS = ['/admin', '/api/', '/dil'] as const

/** Yandex için sorgu parametresi temizleme kuralları. */
export const CLEAN_PARAMS = [
  'hex&havalimani /',
  'utm_source&utm_medium&utm_campaign&utm_term&utm_content',
] as const

/** Tamamen engellenen tarayıcılar (yalnızca adlı gruplar engel içindir). */
export const BLOCKED_AGENTS = ['Bytespider'] as const

export interface RobotsInput {
  /** İsteğin geldiği host (`x-forwarded-host` ya da `host`). */
  requestHost: string | null
  /** ADMIN_HOST; tanımlı değilse (yerel) admin ayrımı yapılmaz. */
  adminHost: string | undefined
  /** Mutlak site haritası adresi; WEB_HOST tanımlı değilse null (satır yazılmaz). */
  sitemapUrl: string | null
}

export function robotsPolicy(input: RobotsInput): MetadataRoute.Robots {
  if (isAdminHost(input.adminHost, input.requestHost)) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [...DISALLOWED_PATHS],
        other: { 'Clean-param': [...CLEAN_PARAMS] },
      },
      ...BLOCKED_AGENTS.map((agent) => ({ userAgent: agent, disallow: '/' })),
    ],
    ...(input.sitemapUrl ? { sitemap: input.sitemapUrl } : {}),
  }
}
