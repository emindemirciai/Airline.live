import 'server-only'
import { getMessages } from '@havayolu/i18n'
import { LOCALES, type Locale } from '@havayolu/shared'
import type { Metadata } from 'next'
import { appName, getServerEnv } from '../env'
import { alternatesFor } from '../locale-routing'
import { siteOgContent, siteOgVersion } from './og-site-content'

/**
 * Sayfa üst verisi (M6b, D-076): kanonik adres, hreflang çiftleri (tr, en, x-default = en), Open
 * Graph ve robots. Adresler göreli verilir; Next.js onları kök düzendeki `metadataBase` (siteUrl)
 * ile mutlak yapar. Google her dil sürümünün kendini ve diğerlerini listelemesini ister.
 * Kaynak: https://developers.google.com/search/docs/specialty/international/localized-versions
 */

/** Yerel geliştirme adresi (CLAUDE.md → yerel portlar: web 3100). WEB_HOST yoksa kullanılır. */
export const DEV_SITE_URL = 'http://localhost:3100'

/** Yerel host'lar https ile sunulmaz (e2e ve `.env.example`: `WEB_HOST=localhost:3100`). */
const LOOPBACK_HOST =
  /^(?:localhost|[a-z0-9.-]+\.localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d{1,5})?$/i

/** WEB_HOST (şemasız, ör. `havayolu.live`) → sitenin kök adresi. Boşsa yerel geliştirme adresi. */
export function siteUrlFrom(webHost: string | undefined): URL {
  const host = webHost?.trim().toLowerCase()
  if (!host) return new URL(DEV_SITE_URL)
  return new URL(`${LOOPBACK_HOST.test(host) ? 'http' : 'https'}://${host}/`)
}

/** Sitenin kök adresi; çalışma zamanında okunur (build'e gömülmez). Üretimde WEB_HOST zorunludur. */
export function siteUrl(): URL {
  return siteUrlFrom(getServerEnv().WEB_HOST)
}

/** Site içi yolu mutlak adrese çevirir (`/istasyon/LTFM` → `https://havayolu.live/istasyon/LTFM`). */
export function absoluteUrl(path: string, base: URL = siteUrl()): string {
  return new URL(path, base).toString()
}

/** Open Graph dil kodları (`og:locale`). */
export const OG_LOCALE: Record<Locale, string> = { tr: 'tr_TR', en: 'en_US' }

/** Sitenin varsayılan paylaşım görseli (`app/og/site/route.ts`); her dil aynı görseli kullanır. */
export const OG_SITE_IMAGE = {
  path: '/og/site',
  width: 1200,
  height: 630,
  type: 'image/png',
} as const

/**
 * Varsayılan paylaşım görselinin adresi, içerikten sürümlü: `/og/site?v=1a2b3c4d` (D-106). Ad, alan
 * adı ya da kısa tanım değişince adres değişir; Facebook, LinkedIn ve X eski görseli adresinden
 * tanıyıp göstermeye devam etmez.
 */
export function siteOgImagePath(name: string, webHost: string | undefined): string {
  // Rotanın (app/og/site/route.ts) içeriğiyle aynı ifade: aynı ortamda aynı sürüm.
  const host = webHost ? siteUrlFrom(webHost).host : null
  return `${OG_SITE_IMAGE.path}?v=${siteOgVersion(siteOgContent(name, host))}`
}

/**
 * Dizine eklenecek sayfalar. Sayfa düzeyindeki `robots` kök düzenin değerini tümüyle ezer (üst veri
 * birleştirmesi sığdır), bu yüzden önizleme yönergeleri burada da açıkça yazılır.
 */
export const INDEX_ROBOTS = {
  index: true,
  follow: true,
  'max-image-preview': 'large',
  'max-snippet': -1,
} as const satisfies NonNullable<Metadata['robots']>

/** Dizine eklenmeyen ama bağlantıları izlenen sayfalar (`/durum`, tarifesiz havalimanları). */
export const NOINDEX_ROBOTS = { index: false, follow: true } as const satisfies NonNullable<
  Metadata['robots']
>

export interface PageMetadataOptions {
  locale: Locale
  /** Dil önekisiz mantıksal yol ve sorgusuz: `/`, `/havalimanlari`, `/istasyon/LTFM`. */
  path: string
  /** Sayfa başlığı; kök düzendeki şablon (`%s · havayolu`) eklenir, `absoluteTitle` ile eklenmez. */
  title: string
  description: string
  /** Varsayılan true. false → `noindex, follow`. */
  index?: boolean
  /**
   * `default`: sitenin paylaşım görseli açıkça eklenir. `segment`: `images` anahtarı hiç yazılmaz,
   * böylece sayfanın kendi klasöründeki `opengraph-image` dosyası kullanılır. Sayfa düzeyindeki
   * `openGraph` üst düzenin dosya tabanlı görsellerini düşürür; bu yüzden varsayılan görsel açıktır
   * (next/dist/lib/metadata/resolve-metadata.js → mergeStaticMetadata).
   */
  ogImage?: 'default' | 'segment'
  /** true → başlık şablonsuz, olduğu gibi kullanılır (ana sayfa). */
  absoluteTitle?: boolean
}

export function pageMetadata(o: PageMetadataOptions): Metadata {
  const alternates = alternatesFor(o.locale, o.path)
  const env = getServerEnv()
  const siteName = appName(env)
  const openGraph: NonNullable<Metadata['openGraph']> = {
    type: 'website',
    siteName,
    url: alternates.canonical,
    title: o.title,
    description: o.description,
    locale: OG_LOCALE[o.locale],
    alternateLocale: LOCALES.filter((locale) => locale !== o.locale).map((l) => OG_LOCALE[l]),
    ...((o.ogImage ?? 'default') === 'default'
      ? {
          images: [
            {
              url: siteOgImagePath(siteName, env.WEB_HOST),
              width: OG_SITE_IMAGE.width,
              height: OG_SITE_IMAGE.height,
              type: OG_SITE_IMAGE.type,
              alt: `${siteName} · ${getMessages(o.locale).seo.ogTagline}`,
            },
          ],
        }
      : {}),
  }
  return {
    title: o.absoluteTitle ? { absolute: o.title } : o.title,
    description: o.description,
    alternates: {
      canonical: alternates.canonical,
      languages: { ...alternates.languages },
    },
    openGraph,
    robots: (o.index ?? true) ? INDEX_ROBOTS : NOINDEX_ROBOTS,
  }
}
