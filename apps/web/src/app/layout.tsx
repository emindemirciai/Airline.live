import '@fontsource/overpass/400.css'
import '@fontsource/overpass/600.css'
import '@fontsource/overpass/800.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './globals.css'

import { getMessages } from '@havayolu/i18n'
import { currentVersion, PROJECT } from '@havayolu/shared'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AnalyticsConsent, ConsentSettingsButton } from '@/components/analytics-consent'
import { CONSENT_COOKIE, parseConsent } from '@/lib/consent'
import { LanguageToggle } from '@/components/language-toggle'
import { analyticsConfig, appName, getServerEnv } from '@/lib/env'
import { getLocale } from '@/lib/locale'
import { sourceNoticeComment } from '@/lib/source-notice'
import { TERMS_PATH } from '@/lib/terms'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const name = appName(getServerEnv())
  return {
    title: { default: name, template: `%s · ${name}` },
    description: getMessages(locale).meta.description,
    authors: [{ name: PROJECT.owner, url: PROJECT.ownerUrl }],
    creator: PROJECT.owner,
    other: { copyright: `© ${PROJECT.copyrightYear} ${PROJECT.owner} · ${PROJECT.license}` },
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const t = getMessages(locale)
  const env = getServerEnv()
  const analytics = analyticsConfig(env)
  const initialConsent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value)

  return (
    <html lang={locale}>
      <body>
        {/* Sayfa kaynağında görünen telif ve lisans bildirimi (ekranda gösterilmez). */}
        <div hidden dangerouslySetInnerHTML={{ __html: sourceNoticeComment(appName(env)) }} />
        <link rel="license" href={PROJECT.licenseUrl} />
        <header className="site-header">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden="true" />
            {appName(env)}
          </Link>
          <nav aria-label={t.nav.mainLabel} className="site-nav">
            <Link href="/">{t.nav.map}</Link>
            <Link href="/durum">{t.nav.status}</Link>
            <Link href="/yenilikler">{t.nav.changelog}</Link>
            <LanguageToggle target={locale === 'tr' ? 'en' : 'tr'} label={t.nav.switchTo} />
          </nav>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <span className="mono">v{currentVersion()}</span>
          <span>{appName(env)}</span>
          <Link href={TERMS_PATH}>{t.terms.title}</Link>
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
