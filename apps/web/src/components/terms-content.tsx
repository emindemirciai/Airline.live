import { format, formatDate, getMessages } from '@havayolu/i18n'
import type { Locale } from '@havayolu/shared'
import type { ReactNode } from 'react'
// Göreli yollar: vitest `@/` takma adını çözmez ve bu bileşen testte çizilir.
import { DATA_ATTRIBUTION } from '../lib/map-config'
import { TERMS_EFFECTIVE_DATE, TERMS_LINKS } from '../lib/terms'
import { AVIATION_WEATHER_URL, NWS_DISCLAIMER_URL } from './airports/weather-links'
import { richText } from './rich-text'

export interface TermsContentProps {
  locale: Locale
  /** Uygulamanın adı (`APP_NAME`). */
  app: string
}

/** Dış belge bağlantısı; belgeler İngilizcedir. */
function DocLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} hrefLang="en">
      {children}
    </a>
  )
}

/**
 * Geçici kullanım koşullarının metni (D-075). Sunucu bileşenlerinden çizilir; kanca yoktur. Esri
 * maddesi (E204 §3.1c.5), ODbL maddesi (ODbL 4.7: koşullar ADS-B türevi verinin yeniden kullanımını
 * kısıtlamaz) ve hava durumu maddesi (D-078: bilgi amaçlı, NOAA/NWS onayı ima edilmez) buradadır.
 */
export function TermsContent({ locale, app }: TermsContentProps) {
  const messages = getMessages(locale)
  const t = messages.terms

  return (
    <article className="page terms">
      <h1>{t.title}</h1>
      <p className="lead">
        <time dateTime={TERMS_EFFECTIVE_DATE}>
          {format(t.effective, { date: formatDate(TERMS_EFFECTIVE_DATE, locale) })}
        </time>
      </p>
      <p className="terms-notice">{t.interim}</p>

      <section aria-labelledby="terms-service">
        <h2 id="terms-service">{t.service.heading}</h2>
        <p>{format(t.service.about, { app })}</p>
        <p>{t.service.notOperational}</p>
        <p>{t.service.noWarranty}</p>
      </section>

      <section aria-labelledby="terms-data">
        <h2 id="terms-data">{t.data.heading}</h2>
        <p>
          {richText(t.data.live, {
            source: <DocLink href={DATA_ATTRIBUTION.href}>{DATA_ATTRIBUTION.label}</DocLink>,
            license: (
              <DocLink href={DATA_ATTRIBUTION.licenseHref}>{DATA_ATTRIBUTION.license}</DocLink>
            ),
          })}
        </p>
        <p>{t.data.odbl}</p>
        <p>
          {richText(t.data.airports, {
            source: <DocLink href={TERMS_LINKS.ourAirports}>OurAirports</DocLink>,
          })}
        </p>
        <p>
          {richText(t.data.weather, {
            source: <DocLink href={AVIATION_WEATHER_URL}>aviationweather.gov</DocLink>,
            disclaimer: <DocLink href={NWS_DISCLAIMER_URL}>{t.data.weatherDisclaimer}</DocLink>,
          })}
        </p>
      </section>

      <section aria-labelledby="terms-map">
        <h2 id="terms-map">{t.map.heading}</h2>
        <p>
          {richText(t.map.esri, {
            platform: <DocLink href={TERMS_LINKS.esriPlatform}>{t.map.esriPlatform}</DocLink>,
            productTerms: (
              <DocLink href={TERMS_LINKS.esriProductTerms}>{t.map.esriProductTerms}</DocLink>
            ),
          })}
        </p>
        <p>{t.map.tiles}</p>
        <p>
          {richText(t.map.vector, {
            openFreeMap: <DocLink href={TERMS_LINKS.openFreeMap}>OpenFreeMap</DocLink>,
            openMapTiles: <DocLink href={TERMS_LINKS.openMapTiles}>OpenMapTiles</DocLink>,
            openStreetMap: <DocLink href={TERMS_LINKS.openStreetMap}>OpenStreetMap</DocLink>,
          })}
        </p>
      </section>

      <section aria-labelledby="terms-use">
        <h2 id="terms-use">{t.use.heading}</h2>
        <ul>
          <li>{t.use.bulk}</li>
          <li>{t.use.disrupt}</li>
        </ul>
      </section>

      <section aria-labelledby="terms-privacy">
        <h2 id="terms-privacy">{t.privacy.heading}</h2>
        <ul>
          <li>{t.privacy.military}</li>
          <li>{t.privacy.registration}</li>
        </ul>
      </section>

      <section aria-labelledby="terms-code">
        <h2 id="terms-code">{t.code.heading}</h2>
        <p>
          {t.code.license} {format(messages.legal.brand, { app })}
        </p>
      </section>

      <section aria-labelledby="terms-changes">
        <h2 id="terms-changes">{t.changes.heading}</h2>
        <p>{t.changes.body}</p>
      </section>
    </article>
  )
}
