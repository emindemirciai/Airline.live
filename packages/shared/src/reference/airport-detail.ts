import type { Airport, AirportListScope } from '../live'

/**
 * Havalimanı sayfalarının (M6b) ve `GET /v1/airports?include=runways`, `GET /v1/airports/:code`
 * yanıtlarının ortak tipleri. Değerler OurAirports (kamu malı) kayıtlarından ve istasyon
 * tablosundan gelir; birimler havacılık birimidir (ft), metrik dönüşüm arayüzde yapılır (D-072).
 */

/** Pistin bir ucu. Yön ve eşik, yöneticinin pist düzeltmesi (`runway_overrides`) varsa odur. */
export interface RunwayEnd {
  /** Pist adı (ör. 16L); kaynakta yoksa boş metin. */
  ident: string
  /**
   * Bu uçtan karşı uca gerçek yön, derece (gerçek kuzeye göre). Uç koordinatlarından hesaplanır;
   * OurAirports `heading_degT` alanı bazı kayıtlarda hatalı olduğu için doğrudan kullanılmaz (D-066).
   */
  trueBearingDeg: number | null
  /** Kaydırılmış eşik mesafesi, ft; kaynakta yoksa null. */
  displacedThresholdFt: number | null
  /** Pist eşiği (domain.md), derece. */
  thresholdLat: number | null
  thresholdLon: number | null
}

/** Açık bir pist (kapalı pistler içe aktarılmaz). */
export interface RunwayDetail {
  /** OurAirports pist kimliği. */
  id: number
  lengthFt: number | null
  widthFt: number | null
  /** Kaplama, kaynaktaki ham kod (ör. ASP, CON, PEM); etiket için `runwaySurfaceKey`. */
  surface: string | null
  lighted: boolean
  /** Alçak ve yüksek numaralı uç (OurAirports `le_*`, `he_*`). */
  ends: [RunwayEnd, RunwayEnd]
}

/** Havalimanı havayolu'nun izlediği bir istasyonsa istasyon ayarları. */
export interface AirportStationInfo {
  /** İstasyon açık mı (yönetici kapatabilir). */
  active: boolean
  /** Birincil istasyon mu (tek; bugün IST). */
  primary: boolean
  /** Veri çekimi için havalimanı merkezli çemberin yarıçapı, deniz mili. */
  fetchRadiusNm: number
}

/**
 * Türkiye'deki en yakın IATA kodlu havalimanı (D-080): yurt dışı havalimanının `distanceToTrKm`'i
 * ona ölçülür. Listelenmeyen, tarifesiz küçük bir alan olabilir (Gökçeada gibi); o zaman sayfası
 * yoktur.
 */
export interface NearestTurkishAirport {
  /** ICAO kodu (listedeki kural: ICAO, yoksa GPS kodu, o da yoksa OurAirports kimliği). */
  icao: string
  /** IATA kodu. */
  iata: string
  /** OurAirports adı; görünen ad için `airportDisplayName`. */
  name: string
}

/** Havalimanı sayfasının verisi: harita kaydı (`Airport`) + bölge, istasyon ve pistler. */
export interface AirportDetail extends Airport {
  /**
   * Türkiye'deki en yakın IATA kodlu havalimanı (D-080); Türkiye havalimanında (ve veritabanında
   * Türkiye havalimanı yokken) null.
   */
  nearestTr: NearestTurkishAirport | null
  /** ISO 3166-2 bölge kodu (Türkiye'de il: TR-34; ad için `provinceName`), yurt dışında GR-I gibi. */
  isoRegion: string
  /** OurAirports `municipality`: çoğu zaman ilçe (Gaziemir, Tarsus); `city` ile aynı değer. */
  municipality: string | null
  /**
   * Adres takma adı (D-109): kodu değişen havalimanının OurAirports kimliğindeki eski dört karakterli
   * kod (Özbekistan UTSS → UZSS, Lima SPIM → SPJC). `/istasyon/<takma ad>` kanonik adrese 308 ile
   * gider; `GET /v1/airports/<takma ad>` kanonik kaydı verir. Takma adı yoksa alan yoktur.
   */
  identAlias?: string
  /** İzlenen istasyon değilse null. */
  station: AirportStationInfo | null
  /**
   * Havalimanı, pistleri ve pist düzeltmelerinin en yeni değişiklik anı (ISO 8601, UTC). İçe
   * aktarım yalnızca kaynak satır değişince `updated_at`'i ilerletir (D-066); bu yüzden dürüsttür.
   */
  dataUpdatedAt: string
  /** Açık pistler, pist adına göre sıralı. */
  runways: RunwayDetail[]
}

/** `GET /v1/airports?country=TR&include=runways`: ülkenin havalimanları, IATA koduna göre sıralı. */
export interface AirportDetailsResponse {
  /** ISO 3166-1 alpha-2 ülke kodu. */
  country: string
  airports: AirportDetail[]
}

/** `GET /v1/airports?scope=listed&include=runways`: listelenen havalimanları (D-080), IATA sırasıyla. */
export interface ListedAirportDetailsResponse {
  scope: AirportListScope
  airports: AirportDetail[]
}
