/**
 * Canlı API'nin (M5) ortak tipleri: REST (`/v1/live`, `/v1/search`) ve WebSocket (`/v1/ws`) aynı
 * kayıt biçimini kullanır. Birimler havacılık birimidir (ft, kt, ft/dk); metrik dönüşüm yalnızca
 * arayüzde yapılır (D-072).
 */

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
  src: 'adsbLol' | 'localReceiver'
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

export type ProviderState = 'ok' | 'degraded' | 'down'

/** Her yanıtta ve her WS mesajında giden veri tazeliği ve sağlayıcı durumu. */
export interface LiveStatus {
  /** Yapılandırılmış sağlayıcıların durumu; kaydı olmayan sağlayıcı yer almaz. */
  providers: Partial<Record<'adsbLol' | 'localReceiver', ProviderState>>
  /** Birincil istasyon verisinin yaşı, sn (adsb.lol sağlık kaydından); bilinmiyorsa null. */
  primaryAgeS: number | null
  /** Önbellekteki en yeni örneğin yaşı, sn; uçak yoksa null. */
  newestAgeS: number | null
}

/** Bir önbellek turunun farkı. `seq` her değişen turda bir artar. */
export interface TickDiff {
  seq: number
  added: PublicAircraft[]
  updated: PublicAircraft[]
  /** Silinen hex ve son bilinen konumu (ızgara hücresini bulmak için). */
  removed: { hex: string; lat: number; lon: number }[]
}

/** WebSocket merkezinin ve REST yollarının okuduğu canlı veri kaynağı (LiveCache bunu uygular). */
export interface LiveSource {
  seq(): number
  snapshot(bbox?: Bbox): PublicAircraft[]
  get(hex: string): PublicAircraft | undefined
  all(): Iterable<PublicAircraft>
  /** `afterSeq`'ten sonraki farklar; tampon yetmiyorsa null. */
  diffsSince(afterSeq: number): TickDiff[] | null
  status(): LiveStatus
  coverage(bbox: Bbox): CoverageState
  /** Her değişen turda çağrılır; dönüş fonksiyonu aboneliği kaldırır. */
  onTick(listener: (diff: TickDiff) => void): () => void
}
