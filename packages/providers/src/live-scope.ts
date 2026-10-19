import { hasDbFlag, sameIdentity, type AircraftState, type PositionSource } from './aircraft'
import {
  BUSINESS_JET_TYPES,
  CHARTER_AIRLINE_ALLOW,
  DENIED_DESIGNATORS,
} from './live-scope-designators'

/**
 * Canlı yayın kapsamı ve kuralı (D-115, aşamalı açılış 1. aşama). Kural worker'da, kaynakta
 * uygulanır: yayınlanmayan uçak `redis-live`'a, uçuş kaydına, ize ve bildirime hiç girmez. Saf
 * modüldür (IO yok); işletmeci kodları dışarıdan verilir (`airlineDesignatorsFrom`).
 *
 * - `airline`: yalnızca bilinen bir havayolu çağrı koduyla (ICAO işletmeci kodu + uçuş tanıtıcısı)
 *   uçan uçaklar yayınlanır; askerî, devlet ve özel uçaklar, PIA/LADD, helikopter, planör ve iş
 *   jeti işletmecileri yayınlanmaz. Üretimde 1. aşamada tek geçerli kapsamdır.
 * - `all`: süzgeçsiz (yalnızca engel listesi ve askerî bit); yalnızca geliştirme ve test.
 */
export const LIVE_SCOPES = ['airline', 'all'] as const
export type LiveScope = (typeof LIVE_SCOPES)[number]

export {
  BUSINESS_JET_TYPES,
  CHARTER_AIRLINE_ALLOW,
  DENIED_DESIGNATORS,
  type DenyGroup,
} from './live-scope-designators'

/** Yayınlanmama nedeni (İngilizce kod; sayaçlarda ve loglarda yalnızca sayısı tutulur). */
export const DROP_REASONS = [
  'blocklist_unavailable',
  'blocklisted',
  'military',
  'flags_unknown',
  'interesting',
  'pia_ladd',
  'non_icao',
  'category',
  'no_callsign',
  'callsign_pattern',
  'callsign_is_registration',
  'denied_designator',
  'designators_unavailable',
  'unknown_designator',
  'non_airline_operator',
  'small_non_scheduled',
  'unknown_type_non_scheduled',
  'business_jet_type',
] as const
export type DropReason = (typeof DROP_REASONS)[number]

/** İşletmeci kodunun sınıfı: `non_airline` = VRS'e göre bütün uçuşları charter ya da konumlandırma. */
export type DesignatorOperator = 'airline' | 'non_airline'

export interface AirlineDesignator {
  /** İşletmecinin IATA kodu var mı (A1/A2 kuralı). */
  iata: boolean
  operator: DesignatorOperator
}

/** ICAO işletmeci kodu (üç büyük harf) → sınıfı. Boşsa (VRS henüz içe aktarılmadı) hiçbir şey yayınlanmaz. */
export type AirlineDesignators = ReadonlyMap<string, AirlineDesignator>

export const EMPTY_AIRLINE_DESIGNATORS: AirlineDesignators = new Map()

/** `packages/db` `loadAirlineDesignatorRows` satırı (yapısal tip; db sağlayıcılara bağımlı değildir). */
export interface AirlineDesignatorRow {
  icao: string
  iata: string | null
  charterFlightPattern: string | null
  positioningFlightPattern: string | null
}

const ICAO_DESIGNATOR = /^[A-Z]{3}$/
/**
 * VRS'te "işletmecinin bütün uçuşları" deseni (`.*`); çapalı ve `+`'lı yazımları da aynı anlama
 * gelir (yazım değişirse iş jeti işletmecileri sessizce `airline` sayılmasın).
 */
const ALL_FLIGHTS: ReadonlySet<string> = new Set(['.*', '^.*$', '.+', '^.+$'])

const isAllFlights = (pattern: string | null) => pattern !== null && ALL_FLIGHTS.has(pattern.trim())

/**
 * `non_airline` işletmeci sayısının alt sınırı (2026-10-15 fixture'ı: 277). VRS'in desen sütunu
 * kaybolur, adı ya da yazımı değişirse bütün iş jeti işletmecileri sessizce `airline` sayılırdı
 * (D-115): üretimde bu sayının altına düşen tablo kabul edilmez.
 */
export const MIN_NON_AIRLINE_DESIGNATORS = 200
/** Yeni tablodaki `non_airline` sayısı son iyi tablonun en az bu oranı olmalıdır. */
export const NON_AIRLINE_KEEP_RATIO = 0.8

export function nonAirlineCount(map: AirlineDesignators): number {
  let n = 0
  for (const d of map.values()) if (d.operator === 'non_airline') n += 1
  return n
}

/**
 * Yeni işletmeci tablosu şüpheli mi? `non_airline` sayısı `minimum`'un ya da son iyi tablodaki
 * sayının %80'inin altındaysa evet: çağıran son iyi tabloyu korur (yoksa boş kalır, hiçbir şey
 * yayınlanmaz) ve uyarır. Boş tablo şüpheli sayılmaz; boş tabloyla zaten hiçbir şey yayınlanmaz.
 */
export function suspectDesignatorTable(
  next: AirlineDesignators,
  opts: { previousNonAirline: number; minimum: number },
): boolean {
  if (next.size === 0) return false
  const floor = Math.max(opts.minimum, Math.floor(NON_AIRLINE_KEEP_RATIO * opts.previousNonAirline))
  return nonAirlineCount(next) < floor
}

/**
 * VRS satırlarından işletmeci kodu tablosu. `CharterFlightPattern` ya da
 * `PositioningFlightPattern` tam olarak `.*` olan ve charter izin listesinde olmayan işletmeci
 * `non_airline`dır (iş jeti, şirket uçuş birimi, okul, ambulans …). Uçuşların yalnız bir kısmını
 * kapsayan desenler (DLH `^((987\d)|(99\d\d))$`, BAW `9\d\d\d`) yok sayılır: bunlar havayolu
 * uçağının charter ya da feribot uçuşlarıdır. Aynı kod birden çok satırda varsa `non_airline`
 * kazanır (kapalı varsayım); IATA kodu herhangi bir satırda varsa var sayılır.
 */
export function airlineDesignatorsFrom(rows: readonly AirlineDesignatorRow[]): AirlineDesignators {
  const out = new Map<string, AirlineDesignator>()
  for (const row of rows) {
    const icao = row.icao.trim().toUpperCase()
    if (!ICAO_DESIGNATOR.test(icao)) continue
    const allFlights =
      isAllFlights(row.charterFlightPattern) || isAllFlights(row.positioningFlightPattern)
    const operator: DesignatorOperator =
      allFlights && !CHARTER_AIRLINE_ALLOW.has(icao) ? 'non_airline' : 'airline'
    const iata = row.iata !== null && row.iata.trim() !== ''
    const previous = out.get(icao)
    out.set(icao, {
      iata: iata || (previous?.iata ?? false),
      operator: previous?.operator === 'non_airline' ? 'non_airline' : operator,
    })
  }
  return out
}

/**
 * Havayolu çağrı kodu: üç harfli ICAO işletmeci kodu + rakamla başlayan en çok dört karakterli
 * uçuş tanıtıcısı (toplam en çok 7, ICAO). Rakam şartı çoğu tescil biçimli çağrı kodunu ayırır
 * (TCOIL, N123AB, HBJFA); harf + rakam biçimli tescilleri olan ülkeler ayrıca denetlenir
 * (`REGISTRATION_SHAPED`). API'nin yalnız rakamlı sefer no kuralı burada kullanılmaz, gerçek
 * trafik harf de taşır (THY2NP, PGT15UE, CAI5A).
 */
export const AIRLINE_CALLSIGN = /^([A-Z]{3})([0-9][A-Z0-9]{0,3})$/

/**
 * Tescili ülke işareti + seri harfi + rakam olan ülkeler: tescil çağrı kodu olarak gönderilince
 * havayolu çağrı kodu biçimine uyar (UP-A2001 → UPA2001, EZ-A777 → EZA777) ve ön ek VRS'te bir
 * işletmeci kodu olabilir (UPA Air Foyle, EZA Eznis Airways). Uçağın ICAO 24-bit adresi o ülkenin
 * bloğundaysa (ICAO Ek 10 Cilt III, Tablo 9-1; hiçbir uçağı tek başına tanımlamaz) ülke işaretiyle
 * başlayan çağrı kodu tescil sayılır, tescil bilinmese de: devlet ve VIP uçakları açık
 * veritabanlarında sık eksiktir. Seri harfi denetlenmez (bütün seriler, kapalı varsayım). O ülkenin
 * havayolları başka kodlarla uçar (Air Astana KZR, Türkmenistan TUA, Vietnam Airlines HVN,
 * Philippine Airlines PAL); tek istisna Küba'dır: Cubana'nın (CUB) Küba adresli uçakları da düşer
 * (kapsama alanının dışında; bir CU-B serisi olup olmadığı doğrulanamadı). Başka ülkenin uçağı bu
 * kuraldan etkilenmez.
 */
const REGISTRATION_SHAPED: readonly { mark: string; from: number; to: number }[] = [
  { mark: 'UP', from: 0x683000, to: 0x6833ff }, // Kazakistan, UP-A2001
  { mark: 'EZ', from: 0x601800, to: 0x601bff }, // Türkmenistan, EZ-A777
  { mark: 'RP', from: 0x758000, to: 0x75ffff }, // Filipinler, RP-C1234
  { mark: 'CU', from: 0x0b0000, to: 0x0b0fff }, // Küba, CU-T1240
  { mark: 'VN', from: 0x888000, to: 0x88ffff }, // Vietnam, VN-A321
]

const HEX_ADDRESS = /^[0-9a-f]{6}$/i

function registrationShaped(hex: string, callsign: string): boolean {
  if (!HEX_ADDRESS.test(hex)) return false
  const address = Number.parseInt(hex, 16)
  return REGISTRATION_SHAPED.some(
    (block) => address >= block.from && address <= block.to && callsign.startsWith(block.mark),
  )
}

/** ICAO dışı adres taşıyan konum kaynakları (TIS-B/ADS-R `*_other`, iz dosyası). */
const NON_ICAO_SOURCES: ReadonlySet<PositionSource> = new Set([
  'adsb_other',
  'adsr_other',
  'tisb_other',
  'tisb_trackfile',
])

/** Yolcu ve kargo uçağı sınıfları (ADS-B emitter category A1–A5). */
const AIRLINER_CATEGORIES: ReadonlySet<string> = new Set(['A1', 'A2', 'A3', 'A4', 'A5'])
const SMALL_CATEGORIES: ReadonlySet<string> = new Set(['A1', 'A2'])

/** Kategori yoksa (null, boş ya da A0 "bilgi yok") null; varsa kırpılmış büyük harf. */
function normalizedCategory(category: string | null): string | null {
  const value = category?.trim().toUpperCase() ?? ''
  return value === '' || value === 'A0' ? null : value
}

export type PublishState = Pick<
  AircraftState,
  | 'hex'
  | 'nonIcao'
  | 'callsign'
  | 'registration'
  | 'typeCode'
  | 'category'
  | 'dbFlags'
  | 'positionSource'
>

export interface PublishContext {
  scope: LiveScope
  /** Yöneticinin hex engel listesi; null = henüz okunamadı (kapalı varsayım: hiçbiri yayınlanmaz). */
  blocklist: ReadonlySet<string> | null
  designators: AirlineDesignators
  /**
   * Karar için kullanılacak çağrı kodu: örneğinki ya da aynı hex'in son 10 dk içinde hatırlanan
   * çağrı kodu (worker `PublishGate`). Verilmezse örneğin çağrı kodu.
   */
  callsign?: string | null
}

/**
 * Örnek yayınlanabilir mi? Yayınlanabilirse null, değilse ilk tutmayan kuralın nedeni. Sıra:
 * engel listesi ve askerî bit her iki kapsamda; `all` kapsamında burada biter. `airline`
 * kapsamında sonra bayraklar (bilinmeyen, ilginç, PIA/LADD), ICAO dışı adres, kategori, çağrı
 * kodu biçimi, tescil biçimli çağrı kodu, reddedilen işletmeci kodu, VRS sınıfı (bilinmeyen kod da
 * yayınlanmaz), IATA kodu olmayan işletmecinin küçük, kategorisiz ya da tipi bilinmeyen uçağı ve
 * iş jeti tipi. Kural kapalı varsayımla çalışır: emin olunamayan uçak yayınlanmaz.
 */
export function publishDecision(state: PublishState, ctx: PublishContext): DropReason | null {
  if (ctx.blocklist === null) return 'blocklist_unavailable'
  if (ctx.blocklist.has(state.hex)) return 'blocklisted'
  if (hasDbFlag(state.dbFlags, 'military')) return 'military'
  // `all`: bugünkü davranış; bayrağı bilinmeyeni API gizler (D-071).
  if (ctx.scope === 'all') return null

  if (state.dbFlags === null) return 'flags_unknown'
  // readsb/tar1090 veritabanında devlet, VIP ve polis uçaklarını sık işaretler (takdir, D-115).
  if (hasDbFlag(state.dbFlags, 'interesting')) return 'interesting'
  if (hasDbFlag(state.dbFlags, 'pia') || hasDbFlag(state.dbFlags, 'ladd')) return 'pia_ladd'
  if (state.nonIcao || state.hex.startsWith('~') || NON_ICAO_SOURCES.has(state.positionSource)) {
    return 'non_icao'
  }

  const category = normalizedCategory(state.category)
  if (category !== null && !AIRLINER_CATEGORIES.has(category)) return 'category'

  const raw = ctx.callsign !== undefined ? ctx.callsign : state.callsign
  const callsign = raw?.trim().toUpperCase() ?? ''
  if (callsign === '') return 'no_callsign'
  const match = AIRLINE_CALLSIGN.exec(callsign)
  const designator = match?.[1]
  if (designator === undefined) return 'callsign_pattern'
  if (state.registration !== null && sameIdentity(callsign, state.registration)) {
    return 'callsign_is_registration'
  }
  if (registrationShaped(state.hex, callsign)) return 'callsign_is_registration'
  if (DENIED_DESIGNATORS.has(designator)) return 'denied_designator'
  if (ctx.designators.size === 0) return 'designators_unavailable'
  const known = ctx.designators.get(designator)
  if (known === undefined) return 'unknown_designator'
  if (known.operator === 'non_airline') return 'non_airline_operator'
  const typeCode = state.typeCode?.trim().toUpperCase() ?? ''
  if (!known.iata) {
    // Tarifesiz ICAO koduyla uçan hafif ve küçük iş jetleri; kategorisi olmayan (A0, yalnız Mode
    // S ya da MLAT) uçak da küçük sayılır (kapalı varsayım, D-115).
    if (category === null || SMALL_CATEGORIES.has(category)) return 'small_non_scheduled'
    // Tipi bilinmeyen uçağın iş jeti olup olmadığı anlaşılamaz (kapalı varsayım).
    if (typeCode === '') return 'unknown_type_non_scheduled'
  }
  // İş jeti tipleri işletmeci kodundan bağımsız düşer.
  if (BUSINESS_JET_TYPES.has(typeCode)) return 'business_jet_type'
  return null
}
