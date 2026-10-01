/**
 * Geçici kullanım koşulları (D-075). Esri'nin ArcGIS Location Platform sözleşmesi (E204 §3.1c.5)
 * uygulama kullanıcılarının Esri şartlarına uymasını isteyen bir maddenin kullanım koşullarında yer
 * almasını ister; uydu altlığı üretimde açık olduğundan sayfa kapsamlı metinden (Parça 3 M6a) önce
 * yayımlanır. Metinler `packages/i18n` → `terms`'tedir.
 */

/** Sayfanın yolu: site alt bilgisinde ve haritanın atıf satırında bağlantısı vardır. */
export const TERMS_PATH = '/kullanim-kosullari'

/** Yürürlük tarihi; metin değiştikçe güncellenir ("Değişiklikler" maddesi). */
export const TERMS_EFFECTIVE_DATE = '2026-10-01'

/**
 * Koşullarda anılan belgeler ve kaynaklar (data-sources.md §3, §6, §6a). ADSB.lol ve ODbL
 * bağlantıları haritanın atfıyla aynıdır (`DATA_ATTRIBUTION`, map-config.ts).
 */
export const TERMS_LINKS = {
  ourAirports: 'https://ourairports.com/data/',
  esriPlatform:
    'https://www.esri.com/content/dam/esrisites/en-us/media/legal/platform/platform-legal.pdf',
  esriProductTerms:
    'https://www.esri.com/content/dam/esrisites/en-us/media/legal/product-specific-terms-of-use/e300.pdf',
  openFreeMap: 'https://openfreemap.org',
  openMapTiles: 'https://www.openmaptiles.org/',
  openStreetMap: 'https://www.openstreetmap.org/copyright',
} as const
