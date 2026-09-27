/**
 * Sağlayıcıdan bağımsız iç uçak modeli (parça-1 M3). Canlı sağlayıcılar (adsb.lol, yerel alıcı)
 * yanıtlarını bu modele çevirir; motor, API ve harita yalnızca bu modeli görür.
 * Bilinmeyen değer `null`dır; hiçbir alan uydurulmaz.
 */

/** Konum kaynağı (readsb `type`). mlat, tisb_* ve other olay tespitinde düşük ağırlık alır (domain.md). */
export type PositionSource =
  | 'adsb_icao'
  | 'adsb_icao_nt'
  | 'adsr_icao'
  | 'tisb_icao'
  | 'adsc'
  | 'mlat'
  | 'other'
  | 'mode_s'
  | 'adsb_other'
  | 'adsr_other'
  | 'tisb_other'
  | 'tisb_trackfile'
  | 'unknown'

const KNOWN_SOURCES = new Set<string>([
  'adsb_icao',
  'adsb_icao_nt',
  'adsr_icao',
  'tisb_icao',
  'adsc',
  'mlat',
  'other',
  'mode_s',
  'adsb_other',
  'adsr_other',
  'tisb_other',
  'tisb_trackfile',
])

export function positionSource(value: unknown): PositionSource {
  return typeof value === 'string' && KNOWN_SOURCES.has(value)
    ? (value as PositionSource)
    : 'unknown'
}

/** Olay tespitinde düşük ağırlık alan konum kaynakları (domain.md → Tespit eşikleri). */
export function isLowWeightSource(source: PositionSource): boolean {
  return (
    source === 'mlat' || source === 'other' || source === 'unknown' || source.startsWith('tisb')
  )
}

export type LiveSourceId = 'adsbLol' | 'localReceiver'

export interface AircraftState {
  // Kimlik
  /** Küçük harf ICAO 24 bit adresi; `~` ile başlıyorsa ICAO dışı adres (TIS-B). */
  hex: string
  nonIcao: boolean
  callsign: string | null
  registration: string | null
  typeCode: string | null
  category: string | null
  /**
   * readsb veritabanı bayrakları: 1 askeri, 2 ilginç, 4 PIA, 8 LADD. adsb.lol'de alan yoksa 0'dır.
   * null = bilinmiyor: veritabanı olmadan çalışan yerel alıcı bayrak göndermez. Bilinmeyen bayrak
   * gizlilik açısından kapalı sayılır (D-071); M4 aynı hex'in bilinen bayraklarını taşır.
   */
  dbFlags: number | null
  positionSource: PositionSource
  // Konum
  lat: number
  lon: number
  /** Barometrik irtifa; uçak yerdeyse null. */
  altBaroFt: number | null
  onGround: boolean
  altGeomFt: number | null
  navQnhHpa: number | null
  // Hareket
  gsKt: number | null
  trackDeg: number | null
  trueHeadingDeg: number | null
  baroRateFpm: number | null
  geomRateFpm: number | null
  // Uzman alanları
  iasKt: number | null
  tasKt: number | null
  mach: number | null
  windDirDeg: number | null
  windSpeedKt: number | null
  oatC: number | null
  /** Seçili irtifa (MCP/FCU). */
  selAltFt: number | null
  navModes: string[]
  // Durum
  squawk: string | null
  /** 'none' değilse acil durum türü (ör. 'general', 'nordo'). */
  emergency: string | null
  // Meta
  /** Konum örneğinin zamanı, UTC epoch ms (domain.md: olay zamanları buradan alınır). */
  sampleTime: number
  source: LiveSourceId
}

export const DB_FLAGS = { military: 1, interesting: 2, pia: 4, ladd: 8 } as const

/** Bit testi (data-sources.md: bitlerle okunur). Bilinmeyen bayrakta hiçbir bit set sayılmaz. */
export function hasDbFlag(dbFlags: number | null, flag: keyof typeof DB_FLAGS): boolean {
  return dbFlags !== null && (dbFlags & DB_FLAGS[flag]) !== 0
}

/**
 * Varsayılan olarak gizli mi (API, WS ve aramada dönmez; CLAUDE.md → Gizlilik)? Askeri uçaklar ve
 * bayrakları bilinmeyenler (kapalı varsayım) gizlidir.
 */
export function isHiddenByDefault(state: Pick<AircraftState, 'dbFlags'>): boolean {
  return state.dbFlags === null || hasDbFlag(state.dbFlags, 'military')
}

/** Karşılaştırma için: büyük harf, yalnızca harf ve rakam (TC-OIL → TCOIL). */
const identity = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * PIA ve LADD uçaklarında (ve bayrağı bilinmeyenlerde) tescil gizlenir. Tescilini çağrı kodu olarak
 * yayınlayan uçağın (iş jetleri, ör. TC-OIL → "TCOIL") çağrı kodu da gizlenir; havayolu çağrı
 * kodları (ör. EJA123) görünür kalır.
 */
export function withPrivacy<T extends Pick<AircraftState, 'dbFlags' | 'registration' | 'callsign'>>(
  state: T,
): T {
  const protectedFlags =
    state.dbFlags === null || hasDbFlag(state.dbFlags, 'pia') || hasDbFlag(state.dbFlags, 'ladd')
  if (!protectedFlags) return state
  const callsignIsRegistration =
    state.callsign !== null &&
    state.registration !== null &&
    identity(state.callsign) === identity(state.registration)
  return { ...state, registration: null, callsign: callsignIsRegistration ? null : state.callsign }
}
