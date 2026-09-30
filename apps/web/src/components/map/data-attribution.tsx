import type { DataAttribution } from '../../lib/map-config'
import { TERMS_PATH } from '../../lib/terms'

export interface DataAttributionNoticeProps {
  attribution: DataAttribution
  /** "Canlı uçuş verisi:" (i18n `map.dataAttributionPrefix`). */
  prefix: string
  /** "Koşullar" (i18n `map.termsLink`). */
  termsLabel: string
}

/**
 * Canlı veri atfı (data-sources.md §1: "Canlı uçuş verisi: ADSB.lol — ODbL 1.0", iki bağlantı) ve
 * kullanım koşulları bağlantısı. Harita çizilebildiğinde ikisi MapLibre'nin atıf kutusundadır
 * (attribution.ts). Harita yokken (yükleniyor, WebGL2 yok, harita kurulamadı) arama, tablo ve kart
 * yine canlı veri gösterdiği için aynı bağlantılar bu öğeyle haritanın sağ alt köşesinde gösterilir.
 */
export function DataAttributionNotice({
  attribution,
  prefix,
  termsLabel,
}: DataAttributionNoticeProps) {
  return (
    <p className="live-map__attrib">
      {prefix}{' '}
      <a href={attribution.href} target="_blank" rel="noopener">
        {attribution.label}
      </a>
      {' — '}
      <a href={attribution.licenseHref} target="_blank" rel="noopener">
        {attribution.license}
      </a>
      {' · '}
      <a href={TERMS_PATH}>{termsLabel}</a>
    </p>
  )
}
