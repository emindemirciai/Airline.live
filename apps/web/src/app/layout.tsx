import '@fontsource/overpass/400.css'
import '@fontsource/overpass/600.css'
import '@fontsource/overpass/800.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './globals.css'

import { getMessages } from '@havayolu/i18n'
import { currentVersion, PROJECT, type Locale } from '@havayolu/shared'
import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AnalyticsConsent, ConsentSettingsButton } from '@/components/analytics-consent'
import { SiteBrand } from '@/components/brand/site-brand'
import { CONSENT_COOKIE, parseConsent } from '@/lib/consent'
import { LanguageToggle } from '@/components/language-toggle'
import { isAdminPath } from '@/lib/admin-host'
import { analyticsConfig, appName, getServerEnv, type ServerEnv } from '@/lib/env'
import { languageToggleHref } from '@/lib/language-href'
import { getLocale, getLogicalPath } from '@/lib/locale'
import { localePath } from '@/lib/locale-routing'
import { THEME_COLORS } from '@/lib/seo/brand'
import { siteUrl } from '@/lib/seo/metadata'
import { sourceNoticeComment } from '@/lib/source-notice'
import { TERMS_PATH } from '@/lib/terms'

/** Site içi sayfalar (dil önekisiz; bağlantılar `localePath` ile kurulur). */
const AIRPORTS_PATH = '/havalimanlari'
const ABOUT_PATH = '/hakkinda'

/**
 * Arama motoru doğrulama etiketleri (ACTIVATION → Search Console, Bing, Yandex). Değer tanımsızsa
 * etiket çıkmaz; Bing'in etiketi `msvalidate.01` adını taşır.
 */
function verification(env: ServerEnv): Metadata['verification'] {
  return {
    google: env.GOOGLE_SITE_VERIFICATION,
    yandex: env.YANDEX_VERIFICATION,
    ...(env.BING_SITE_VERIFICATION
      ? { other: { 'msvalidate.01': env.BING_SITE_VERIFICATION } }
      : {}),
  }
}

/**
 * Tüm sayfalarda ortak üst veri. `metadataBase` WEB_HOST'tan çalışma zamanında gelir; sayfaların
 * göreli kanonik ve hreflang adresleri onunla mutlak olur. Kanonik adres, dil karşılıkları ve
 * paylaşım görseli burada **yazılmaz**: üst veri birleştirmesi sığdır; alt sayfalar kök adresin
 * kanoniğini miras alır, sayfa düzeyindeki `openGraph` ise buradakinin yerine geçerdi. Onlar her
 * sayfada `pageMetadata` ile verilir. `robots` önizleme yönergeleri, kendi `robots` değeri olmayan
 * sayfalar içindir.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const env = getServerEnv()
  const name = appName(env)
  return {
    metadataBase: siteUrl(),
    applicationName: name,
    title: { default: name, template: `%s · ${name}` },
    description: getMessages(locale).meta.description,
    authors: [{ name: PROJECT.owner, url: PROJECT.ownerUrl }],
    creator: PROJECT.owner,
    robots: { 'max-image-preview': 'large', 'max-snippet': -1 },
    twitter: { card: 'summary_large_image' },
    verification: verification(env),
    other: { copyright: `© ${PROJECT.copyrightYear} ${PROJECT.owner} · ${PROJECT.license}` },
  }
}

/** Tarayıcı arayüzünün rengi: sitenin başlık şeridi (D-081), manifestteki `theme_color` ile aynı. */
export const viewport: Viewport = {
  themeColor: THEME_COLORS.header,
}

/**
 * Kök layout. Dil adresten gelir (D-076): proxy `/en/*` isteğini öneksiz yola yeniden yazar ve dili
 * başlıkla iletir; `<html lang>`, menü ve alt bilgi bağlantıları o dildedir. Layout istemci
 * gezinmesinde yeniden çizilmez; aynı dildeki sayfalar arasında bu doğrudur, dil değiştirme ise tam
 * sayfa yüklemesidir (`LanguageToggle`). Yönetim yalnızca Türkçedir; orada dil bağlantısı yoktur.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const logicalPath = await getLogicalPath()
  const t = getMessages(locale)
  const env = getServerEnv()
  const analytics = analyticsConfig(env)
  const initialConsent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value)
  const href = (path: string) => localePath(locale, path)
  const otherLocale: Locale = locale === 'tr' ? 'en' : 'tr'
  const admin = isAdminPath(logicalPath.split(/[?#]/)[0] ?? '/')

  return (
    <html lang={locale}>
      <body>
        {/* Sayfa kaynağında görünen telif ve lisans bildirimi (ekranda gösterilmez). */}
        <div hidden dangerouslySetInnerHTML={{ __html: sourceNoticeComment(appName(env)) }} />
        <link rel="license" href={PROJECT.licenseUrl} />
        <header className="site-header">
          <SiteBrand href={href('/')} name={appName(env)} />
          <nav aria-label={t.nav.mainLabel} className="site-nav">
            <Link href={href('/')} className="site-nav-map">
              {t.nav.map}
            </Link>
            <Link href={href(AIRPORTS_PATH)}>{t.nav.airports}</Link>
            <Link href={href('/durum')}>{t.nav.status}</Link>
            <Link href={href('/yenilikler')}>{t.nav.changelog}</Link>
            {admin ? null : (
              <LanguageToggle
                target={otherLocale}
                label={t.nav.switchTo}
                initialHref={languageToggleHref(otherLocale, logicalPath)}
              />
            )}
          </nav>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <span className="mono">v{currentVersion()}</span>
          <span>{appName(env)}</span>
          <Link href={href(AIRPORTS_PATH)}>{t.nav.airports}</Link>
          <Link href={href(ABOUT_PATH)}>{t.nav.about}</Link>
          <Link href={href(TERMS_PATH)}>{t.terms.title}</Link>
          {analytics ? <ConsentSettingsButton label={t.consent.settings} /> : null}
        </footer>
        {analytics ? (
          <AnalyticsConsent
            trackerUrl={analytics.trackerUrl}
            siteId={analytics.siteId}
            initialConsent={initialConsent}
            secure={env.APP_ENV === 'production'}
            labels={{
              title: t.consent.title,
              body: t.consent.body,
              accept: t.consent.accept,
              reject: t.consent.reject,
            }}
          />
        ) : null}
      </body>
    </html>
  )
}
