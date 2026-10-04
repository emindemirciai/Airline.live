import type { DataAttribution } from '../../lib/map-config'
import { ATTRIBUTION_SEPARATOR, SITE_CREDIT_CLASS, type SiteCredit } from './attribution'

export interface DataAttributionNoticeProps {
  attribution: DataAttribution
  /** "Canlı uçuş verisi:" (i18n `map.dataAttributionPrefix`). */
  prefix: string
  /** "Koşullar" (i18n `map.termsLink`). */
  termsLabel: string
  /** Kullanım koşullarının sayfanın dilindeki adresi (`localePath(locale, TERMS_PATH)`). */
  termsHref: string
  /** Satırın başındaki site künyesi ("havayolu v0.16.1", D-089). */
  siteCredit: SiteCredit
}

/**
 * Site künyesi (D-089), canlı veri atfı (data-sources.md §1: "Canlı uçuş verisi: ADSB.lol — ODbL
 * 1.0", iki bağlantı) ve kullanım koşulları bağlantısı. Harita çizilebildiğinde üçü MapLibre'nin
 * atıf kutusundadır (attribution.ts). Harita yokken (yükleniyor, WebGL2 yok, harita kurulamadı)
 * arama, tablo ve kart yine canlı veri gösterdiği için aynı bağlantılar bu öğeyle haritanın sağ alt
 * köşesinde, aynı sırayla gösterilir.
 */
export function DataAttributionNotice({
  attribution,
  prefix,
  termsLabel,
  termsHref,
  siteCredit,
}: DataAttributionNoticeProps) {
  return (
    <p className="live-map__attrib">
      <span className={SITE_CREDIT_CLASS}>
        <a href={siteCredit.href} aria-label={siteCredit.label}>
          {siteCredit.text}
        </a>
        <span aria-hidden="true">{ATTRIBUTION_SEPARATOR}</span>
      </span>
      {prefix}{' '}
      <a href={attribution.href} target="_blank" rel="noopener">
        {attribution.label}
      </a>
      {' — '}
      <a href={attribution.licenseHref} target="_blank" rel="noopener">
        {attribution.license}
      </a>
      {' · '}
      <a href={termsHref}>{termsLabel}</a>
    </p>
  )
}
