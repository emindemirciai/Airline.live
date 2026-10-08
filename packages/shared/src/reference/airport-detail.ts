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

/**
 * Haritanın listesinde (`include=map`, D-111) pist uçları bu halkaya kadar gelir: canlı veri
 * kapsaması (D-073) 1.–3. halkadadır, uçak listesinin pist hizası (D-085) yalnız orada her zaman
 * gerekir. Daha uzaktaki havalimanının uçlarını harita gerekince tek havalimanı ucundan ister.
 */
export const AIRPORT_MAP_ENDS_MAX_RING = 3

/** Haritanın pist ucu: ad, yön ve eşik (kaydırılmış eşik mesafesi gelmez; eşik zaten kaydırılmıştır). */
export type AirportMapRunwayEnd = Pick<
  RunwayEnd,
  'ident' | 'trueBearingDeg' | 'thresholdLat' | 'thresholdLon'
>

/** Haritanın pisti: uzunluk; uçlar yalnız `AIRPORT_MAP_ENDS_MAX_RING`'e kadar. */
export interface AirportMapRunway {
  lengthFt: number | null
  /** Alçak ve yüksek numaralı uç; 4. halkadan itibaren alan yoktur. */
  ends?: [AirportMapRunwayEnd, AirportMapRunwayEnd]
}

/**
 * `GET /v1/airports?…&include=map` kaydı (D-111): haritanın penceresinin alanları (`Airport` + bölge,
 * yerleşim, adres takma adı) ve pistler. En yakın Türkiye havalimanı, istasyon, veri tarihi ve pistin
 * kimliği, genişliği, kaplaması ve ışığı gelmez (sayfalar `include=runways` ister).
 */
export interface AirportMapEntry extends Airport {
  isoRegion: string
  municipality: string | null
  identAlias?: string
  runways: AirportMapRunway[]
}

/** `GET /v1/airports?scope=listed&include=map`. */
export interface ListedAirportMapResponse {
  scope: AirportListScope
  airports: AirportMapEntry[]
}

/** Ayrıntı kaydından haritanın kaydı; uçlar yalnız `AIRPORT_MAP_ENDS_MAX_RING`'e kadar. */
export function toAirportMapEntry(airport: AirportDetail): AirportMapEntry {
  const withEnds = airport.ring <= AIRPORT_MAP_ENDS_MAX_RING
  return {
    icao: airport.icao,
    iata: airport.iata,
    name: airport.name,
    city: airport.city,
    lat: airport.lat,
    lon: airport.lon,
    elevationFt: airport.elevationFt,
    type: airport.type,
    scheduled: airport.scheduled,
    country: airport.country,
    ring: airport.ring,
    distanceToTrKm: airport.distanceToTrKm,
    isoRegion: airport.isoRegion,
    municipality: airport.municipality,
    ...(airport.identAlias === undefined ? {} : { identAlias: airport.identAlias }),
    runways: airport.runways.map((runway) =>
      withEnds
        ? {
            lengthFt: runway.lengthFt,
            ends: [mapRunwayEnd(runway.ends[0]), mapRunwayEnd(runway.ends[1])],
          }
        : { lengthFt: runway.lengthFt },
    ),
  }
}

function mapRunwayEnd(end: RunwayEnd): AirportMapRunwayEnd {
  return {
    ident: end.ident,
    trueBearingDeg: end.trueBearingDeg,
    thresholdLat: end.thresholdLat,
    thresholdLon: end.thresholdLon,
  }
}
