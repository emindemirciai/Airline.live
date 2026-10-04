/**
 * Veri sağlayıcı lisans kaydı. Her sağlayıcı ticari kullanım, atıf ve paylaşım şartlarını taşır.
 * DATA_USAGE_MODE=commercial iken ticari kullanıma kapalı bir sağlayıcı başlatılamaz.
 * Kaynak ve doğrulama tarihi: docs/spec/data-sources.md (2026-09-25).
 */

export type ShareAlike = 'none' | 'derivative-database'
export type DataUsageMode = 'commercial' | 'noncommercial'

export interface ProviderLicense {
  id: string
  name: string
  license: string
  commercialUse: boolean
  /** Arayüzde gösterilecek atıf; null = atıf zorunlu değil. */
  attribution: { text: string; url: string; licenseUrl?: string } | null
  shareAlike: ShareAlike
  rateLimit: string
  b2cDisplayAllowed: boolean
  mixingWithOtherRealtimeAllowed: boolean
  /** Ham verinin en fazla kaç gün saklanabileceği; null = sınır yok. */
  maxRawStorageDays: number | null
}

export const PROVIDER_LICENSES = {
  adsbLol: {
    id: 'adsbLol',
    name: 'ADSB.lol API',
    license: 'ODbL-1.0',
    commercialUse: true,
    attribution: {
      text: 'ADSB.lol',
      url: 'https://adsb.lol',
      licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    },
    shareAlike: 'derivative-database',
    rateLimit:
      'dinamik; 429 Retry-After taşımaz; başlangıç 0,1 istek/sn (alt 0,05, üst 0,2) + AIMD',
    b2cDisplayAllowed: true,
    mixingWithOtherRealtimeAllowed: true,
    maxRawStorageDays: null,
  },
  localReceiver: {
    id: 'localReceiver',
    name: 'Kendi ADS-B alıcımız (readsb)',
    license: 'kendi verimiz',
    commercialUse: true,
    attribution: null,
    shareAlike: 'none',
    rateLimit: 'yerel; sınır yok',
    b2cDisplayAllowed: true,
    mixingWithOtherRealtimeAllowed: true,
    maxRawStorageDays: null,
  },
  ourAirports: {
    id: 'ourAirports',
    name: 'OurAirports',
    license: 'Public Domain (Unlicense)',
    commercialUse: true,
    attribution: { text: 'OurAirports', url: 'https://ourairports.com/data/' },
    shareAlike: 'none',
    rateLimit: 'günlük CSV indirme (If-Modified-Since)',
    b2cDisplayAllowed: true,
    mixingWithOtherRealtimeAllowed: true,
    maxRawStorageDays: null,
  },
  vrsStandingData: {
    id: 'vrsStandingData',
    name: 'VRS standing-data',
    license: 'CC0-1.0',
    commercialUse: true,
    attribution: {
      text: 'VRS standing-data',
      url: 'https://github.com/vradarserver/standing-data',
    },
    shareAlike: 'none',
    rateLimit: 'günlük dosya indirme (ETag)',
    b2cDisplayAllowed: true,
    mixingWithOtherRealtimeAllowed: true,
    maxRawStorageDays: null,
  },
  /**
   * METAR/TAF (data-sources.md §5, D-078). Türk raporlarını havalimanlarının meteoroloji birimleri
   * (MGM; İncirlik'te USAF) hazırlar, AWC yeniden dağıtır. weather.gov/disclaimer: NWS bilgisi
   * aksi belirtilmedikçe kamu malıdır; sahiplenilemez, onay ima edilemez, değiştirilmiş veri resmî
   * diye sunulamaz, NWS adı ve logosu izinsiz kullanılmaz. Atıf nezaketen verilir (logo yok).
   */
  aviationWeather: {
    id: 'aviationWeather',
    name: 'NOAA Aviation Weather Center',
    license: 'ABD kamu verisi (NWS/NOAA; weather.gov/disclaimer)',
    commercialUse: true,
    attribution: { text: 'NOAA Aviation Weather Center', url: 'https://aviationweather.gov/' },
    shareAlike: 'none',
    rateLimit:
      'dakikada en fazla 100 istek; çoğu uç noktada yanıt başına en fazla 400 kayıt; aşımda erişim engellenir; özel User-Agent önerilir',
    b2cDisplayAllowed: true,
    mixingWithOtherRealtimeAllowed: true,
    maxRawStorageDays: null,
  },
  /**
   * Harita (data-sources.md §6): vektör altlık (koyu stil) ve uydunun üstündeki kesikli ülke
   * sınırları (D-092, TileJSON `tiles.openfreemap.org/planet`, `boundary` katmanı). Karoları
   * tarayıcı doğrudan çeker; worker ve API aracılık etmez, karo saklanmaz. OSM verisinin ODbL
   * paylaşım şartı türetilmiş veritabanı içindir; karolar yalnızca çizilir (üretilmiş eser).
   */
  openFreeMap: {
    id: 'openFreeMap',
    name: 'OpenFreeMap',
    license: 'OpenMapTiles + OSM (ODbL)',
    commercialUse: true,
    attribution: {
      text: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
      url: 'https://openfreemap.org/',
    },
    shareAlike: 'none',
    rateLimit: 'sayı sınırı yok; SLA yok; toplu indirme yasak',
    b2cDisplayAllowed: true,
    mixingWithOtherRealtimeAllowed: true,
    maxRawStorageDays: null,
  },
  /**
   * Uydu altlığı (data-sources.md §6a, D-075). Karoyu tarayıcı kullanıcının anahtarıyla doğrudan
   * çeker; worker ve API aracılık etmez, karo saklanmaz.
   */
  esriWorldImagery: {
    id: 'esriWorldImagery',
    name: 'Esri World Imagery (ArcGIS Location Platform)',
    license: 'Esri E204 (ArcGIS Location Platform Agreement)',
    commercialUse: true,
    attribution: {
      text: 'Powered by Esri | Esri, Vantor, Earthstar Geographics, and the GIS User Community',
      url: 'https://www.esri.com/',
    },
    shareAlike: 'none',
    rateLimit: 'ayda 2 milyon karo (ücretsiz katman); kota dolunca ay sonuna kadar durur',
    b2cDisplayAllowed: true,
    mixingWithOtherRealtimeAllowed: true,
    maxRawStorageDays: 0,
  },
} as const satisfies Record<string, ProviderLicense>

export type ProviderId = keyof typeof PROVIDER_LICENSES

export class ProviderLicenseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderLicenseError'
  }
}

/**
 * Etkinleştirilecek sağlayıcıları lisans kaydına göre denetler. Açılışta çağrılır;
 * kurala aykırı bir sağlayıcı varsa uygulama başlamaz.
 */
export function assertProvidersAllowed(
  mode: DataUsageMode,
  providers: readonly ProviderLicense[],
): void {
  if (mode !== 'commercial') return
  const blocked = providers.filter((p) => !p.commercialUse)
  if (blocked.length > 0) {
    throw new ProviderLicenseError(
      `DATA_USAGE_MODE=commercial iken ticari kullanıma kapalı sağlayıcı başlatılamaz: ${blocked
        .map((p) => p.name)
        .join(', ')}`,
    )
  }
}
