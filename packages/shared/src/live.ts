/**
 * Canlı API'nin (M5) ortak tipleri: REST (`/v1/live`, `/v1/search`, `/v1/airports`) ve WebSocket
 * (`/v1/ws`) aynı kayıt biçimini kullanır; API bunları üretir, web ve mobil istemci okur.
 * Birimler havacılık birimidir (ft, kt, ft/dk); metrik dönüşüm yalnızca arayüzde yapılır (D-072).
 */

/** Canlı veri sağlayıcısı: adsb.lol ya da kendi alıcımız. */
export type LiveProviderId = 'adsbLol' | 'localReceiver'

/** Herkese açık uçak kaydı: gizlilik uygulanmış (askeri ve bayrağı bilinmeyen yok, PIA/LADD tescili yok). */
export interface PublicAircraft {
  hex: string
  lat: number
  lon: number
  /** Barometrik irtifa, ft; yerde ya da bilinmiyorsa null. */
  alt: number | null
  /** Yerde mi. */
  gnd: boolean
  /** Yer hızı, kt. */
  gs: number | null
  /** İz yönü, derece. */
  trk: number | null
  /** Dikey hız, ft/dk (barometrik, yoksa geometrik). */
  vr: number | null
  /** Çağrı kodu (ör. THY974). */
  cs: string | null
  /** Rakamlı çağrı kodundan çıkarılan sefer no (THY974 → TK 974); arayüz "TK-974" yazar. */
  fn: { airline: string; number: string } | null
  /** Tescil; PIA/LADD uçakta null. */
  reg: string | null
  /** ICAO tip kodu (A21N). */
  type: string | null
  /** ADS-B kategori (A3). */
  cat: string | null
  sq: string | null
  /** Veri kaynağı. */
  src: LiveProviderId
  /** Konum kaynağı (adsb_icao, mlat …). */
  psrc: string
  /** Örnek zamanı, UTC epoch ms. */
  t: number
}

/** Coğrafi kutu: `minLon,minLat,maxLon,maxLat` (derece). */
export interface Bbox {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

/** İstenen alanın kapsama çemberleriyle ilişkisi; çemberler bilinmiyorsa `unknown`. */
export type CoverageState = 'full' | 'partial' | 'none' | 'unknown'

/**
 * Sağlayıcının durumu (data-sources.md → Sağlayıcı durumu). `limited`: kaynak çalışıyor ama günlük
 * istek bütçesiyle seyrek sorgulanıyor (D-122); konumlar birkaç dakikada bir yenilenir.
 */
export type ProviderState = 'ok' | 'limited' | 'degraded' | 'down'

/**
 * Canlı uçağın varsayılan yaş penceresi, sn: API bu süreden eski örneği sunmaz, istemci budar.
 * Worker'ın `redis-live` ömrüyle (`@havayolu/db` `LIVE_TTL_SECONDS`) aynıdır; API testi denetler.
 */
export const LIVE_DEFAULT_MAX_AGE_S = 120

/**
 * Yaş penceresinin üst sınırı, sn. Bütçe kipinde (D-122) worker kaydın ömrünü sorgu aralığına göre
 * uzatır; API ve istemci pencereyi bundan öteye açmaz (`@havayolu/db` `LIVE_TTL_MAX_SECONDS`).
 */
export const LIVE_MAX_AGE_LIMIT_S = 1_800

/** Her yanıtta ve her WS mesajında giden veri tazeliği ve sağlayıcı durumu. */
export interface LiveStatus {
  /** Yapılandırılmış sağlayıcıların durumu; kaydı olmayan sağlayıcı yer almaz. */
  providers: Partial<Record<LiveProviderId, ProviderState>>
  /** Birincil istasyon verisinin yaşı, sn (adsb.lol sağlık kaydından); bilinmiyorsa null. */
  primaryAgeS: number | null
  /** Önbellekteki en yeni örneğin yaşı, sn; uçak yoksa null. */
  newestAgeS: number | null
  /**
   * Canlı katman anahtarı (D-115): `off` iken yönetici katmanı kapatmıştır ve hiçbir uçak
   * sunulmaz. API her zaman gönderir; yoksa (eski API) açık sayılır.
   */
  layer?: 'on' | 'off'
  /**
   * API'nin uçakları sunduğu yaş penceresi, sn (D-122). `LIVE_DEFAULT_MAX_AGE_S`'ten büyükse veri
   * seyrektir (adsb.lol günlük bütçesi): örnekler birkaç dakikada bir yenilenir, istemci uçağı bu
   * süre boyunca tutar. API her zaman gönderir; yoksa (eski API) varsayılan sayılır.
   */
  maxAgeS?: number
}

/**
 * Canlı uçak verisinin lisansı ve atfı (D-115, ODbL 4.3): canlı uçak taşıyan her REST yanıtında
 * ve WS tam görüntüsünde gider. Kaynak `@havayolu/providers` `PROVIDER_LICENSES.adsbLol`'dur
 * (API'deki test ikisinin ayrışmadığını denetler).
 */
export interface LiveDataLicense {
  license: 'ODbL-1.0'
  licenseUrl: string
  attribution: 'ADSB.lol'
}

export const LIVE_DATA_LICENSE: LiveDataLicense = {
  license: 'ODbL-1.0',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  attribution: 'ADSB.lol',
}

/**
 * İstemci → sunucu (`/v1/ws`): görünüme abone ol. Görünüm REST'teki `bbox` kuralına uyar (en fazla
 * 60° × 40°). `lastSeq` yalnızca yeniden bağlanınca, aynı görünümün ilk aboneliğinde gönderilir
 * (D-074).
 */
export interface LiveSubscribeMessage {
  type: 'subscribe'
  viewport: Bbox
  /** MapLibre yakınlaştırma düzeyi (0–24, kesirli olabilir). */
  zoom: number
  lastSeq?: number
}

/** Görünümdeki uçakların tamamı: istemci eldeki kümeyi bununla değiştirir. */
export interface LiveSnapshotMessage extends Partial<LiveDataLicense> {
  type: 'snapshot'
  seq: number
  coverage: CoverageState
  status: LiveStatus
  aircraft: PublicAircraft[]
}

/**
 * 2°'lik bir ızgara hücresinin değişimi; `c` = `${Math.floor(lat/2)}:${Math.floor(lon/2)}`.
 * `added` ve `updated` ikisi de "ekle ya da güncelle"dir; `removed` hex listesidir.
 */
export interface LiveDiffCell {
  c: string
  added: PublicAircraft[]
  updated: PublicAircraft[]
  removed: string[]
}

/**
 * Görünümle kesişen hücrelerin farkı. İstemci önce bütün hücrelerin `removed` listelerini, sonra
 * `added`/`updated` kayıtlarını uygular: hücre değiştiren uçak eski hücrede silinip yenisinde
 * eklendiği için kaybolmaz. Bilinmeyen hex'in silinmesi etkisizdir.
 */
export interface LiveDiffMessage {
  type: 'diff'
  seq: number
  status: LiveStatus
  cells: LiveDiffCell[]
}

/** Sunucu kapanıyor: istemci `afterMs` bekleyip son `seq` ile yeniden bağlanır. */
export interface LiveReconnectMessage {
  type: 'reconnect'
  afterMs: number
}

/** Kurala uymayan istemci mesajı (bugün yalnızca `bad_request`); 5. hatada bağlantı kapanır. */
export interface LiveErrorMessage {
  type: 'error'
  code: string
}

export type LiveServerMessage =
  LiveSnapshotMessage | LiveDiffMessage | LiveReconnectMessage | LiveErrorMessage

/** `GET /v1/live?bbox=`: kutudaki anlık görüntü (WS snapshot'ı ile aynı alanlar). */
export interface LiveResponse extends Partial<LiveDataLicense> {
  /** Önbellek sayacı (WS `lastSeq` ile aynı). */
  seq: number
  coverage: CoverageState
  status: LiveStatus
  aircraft: PublicAircraft[]
}

/** Sorgunun hangi yorumla eşleştiği; sorgu hiçbir yoruma uymuyorsa `none`. */
export type SearchKind = 'hex' | 'registration' | 'flight' | 'callsign' | 'none'

/** `GET /v1/search?q=`: canlı önbellekte arama (en fazla 20 sonuç). */
export interface SearchResponse extends Partial<LiveDataLicense> {
  kind: SearchKind
  results: PublicAircraft[]
  status: LiveStatus
}

/** Haritada gösterilen havalimanı (OurAirports; IATA kodu olan büyük, orta ve küçük alanlar). */
export interface Airport {
  /** ICAO kodu; yoksa GPS kodu, o da yoksa OurAirports kimliği (ident). */
  icao: string
  iata: string
  name: string
  /** Şehir (OurAirports `municipality`). */
  city: string | null
  lat: number
  lon: number
  elevationFt: number | null
  type: 'large_airport' | 'medium_airport' | 'small_airport'
  /** Tarifeli sefer var mı. */
  scheduled: boolean
  /**
   * ISO 3166-1 alpha-2 ülke kodu (OurAirports `iso_country`, büyük harf). Görünen ülke adı için
   * `airportCountryName` (Ercan/LCEN: KKTC, D-080).
   */
  country: string
  /**
   * Halka (D-080, `airportRing`): Türkiye havalimanında 0; yurt dışında Türkiye'deki en yakın IATA
   * kodlu havalimanına uzaklığa göre 1 (≤ 500 km) … 5 (5.000 km'nin ötesi).
   */
  ring: number
  /**
   * Türkiye'deki en yakın IATA kodlu havalimanına büyük daire uzaklığı, km, tam sayıya yuvarlı.
   * Türkiye havalimanında (ve veritabanında Türkiye havalimanı yokken) null.
   */
  distanceToTrKm: number | null
}

/** `GET /v1/airports` kapsamları: `listed` = listelenen havalimanları (D-080). */
export const AIRPORT_LIST_SCOPES = ['listed'] as const
export type AirportListScope = (typeof AIRPORT_LIST_SCOPES)[number]

/** `GET /v1/airports?country=TR`: ülkenin havalimanları, IATA koduna göre sıralı. */
export interface AirportsResponse {
  /** ISO 3166-1 alpha-2 ülke kodu. */
  country: string
  airports: Airport[]
}

/**
 * `GET /v1/airports?scope=listed`: listelenen havalimanları (Türkiye'nin IATA kodlu havalimanları
 * ve açık halkalardaki yurt dışı adayları; `ENABLED_AIRPORT_RING`), IATA koduna göre sıralı.
 * Zarfta `country` yoktur.
 */
export interface ListedAirportsResponse {
  scope: AirportListScope
  airports: Airport[]
}
