import 'server-only'
import { createHash } from 'node:crypto'
import { getMessages } from '@havayolu/i18n'

/**
 * Sitenin varsayılan paylaşım görselinin içeriği ve sürümü. Görsel `/og/site`'ta çizilir
 * (app/og/site/route.ts → og-site.tsx); sayfaların `og:image` adresi içerikten türetilen sürümü
 * taşır (`/og/site?v=…`, `pageMetadata`, D-106). Facebook görseli adresine göre önbellekte tutar,
 * LinkedIn ve X kartı yeniden taramaya kadar saklar: içerik değişince adres de değişir. Rota sorguya
 * bakmaz; her sürüm aynı (güncel) görseli alır. Bu modül `next/og`'u yüklemez, `pageMetadata` her
 * sayfada onu çağırır.
 */
export interface SiteOgContent {
  name: string
  /** WEB_HOST (ör. airline.live); yerelde tanımlı değilse gösterilmez. */
  host: string | null
  taglineTr: string
  taglineEn: string
}

/** Görselin içeriği: ad, alan adı ve iki dilde kısa tanım (`packages/i18n` → `seo.ogTagline`). */
export function siteOgContent(name: string, host: string | null): SiteOgContent {
  return {
    name,
    host,
    taglineTr: getMessages('tr').seo.ogTagline,
    taglineEn: getMessages('en').seo.ogTagline,
  }
}

/**
 * Görselin tasarımı (logo, renk, yerleşim; og-site.tsx, og.tsx) metin değişmeden değişirse elle bir
 * artırılır; yoksa sosyal ağlar eski görseli adresinden tanır.
 */
export const SITE_OG_DESIGN_REVISION = 1

/** İçerikten 8 hane onaltılık sürüm; aynı içerik aynı sürümü verir. */
export function siteOgVersion(content: SiteOgContent): string {
  return createHash('sha256')
    .update(JSON.stringify([SITE_OG_DESIGN_REVISION, content]))
    .digest('hex')
    .slice(0, 8)
}
