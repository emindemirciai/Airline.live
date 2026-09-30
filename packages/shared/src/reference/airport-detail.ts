import type { Airport } from '../live'

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

/** Havalimanı sayfasının verisi: harita kaydı (`Airport`) + bölge, istasyon ve pistler. */
export interface AirportDetail extends Airport {
  /** ISO 3166-2 bölge kodu (Türkiye'de il: TR-34); ad için `provinceName`. */
  isoRegion: string
  /** OurAirports `municipality`: çoğu zaman ilçe (Gaziemir, Tarsus); `city` ile aynı değer. */
  municipality: string | null
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
