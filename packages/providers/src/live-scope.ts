import { hasDbFlag, sameIdentity, type AircraftState, type PositionSource } from './aircraft'
import { CHARTER_AIRLINE_ALLOW, DENIED_DESIGNATORS } from './live-scope-designators'

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

export { CHARTER_AIRLINE_ALLOW, DENIED_DESIGNATORS, type DenyGroup } from './live-scope-designators'

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
/** VRS'te "işletmecinin bütün uçuşları" deseni. */
const ALL_FLIGHTS = '.*'

const isAllFlights = (pattern: string | null) => pattern !== null && pattern.trim() === ALL_FLIGHTS

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
 * uçuş tanıtıcısı (toplam en çok 7, ICAO). Rakam şartı tescil biçimli çağrı kodlarını ayırır
 * (TCOIL, N123AB, HBJFA); API'nin yalnız rakamlı sefer no kuralı burada kullanılmaz, gerçek trafik
 * harf de taşır (THY2NP, PGT15UE, CAI5A).
 */
export const AIRLINE_CALLSIGN = /^([A-Z]{3})([0-9][A-Z0-9]{0,3})$/

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
  'hex' | 'nonIcao' | 'callsign' | 'registration' | 'category' | 'dbFlags' | 'positionSource'
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
 * kodu biçimi, reddedilen işletmeci kodu ve VRS sınıfı (bilinmeyen kod da yayınlanmaz).
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
  if (DENIED_DESIGNATORS.has(designator)) return 'denied_designator'
  if (ctx.designators.size === 0) return 'designators_unavailable'
  const known = ctx.designators.get(designator)
  if (known === undefined) return 'unknown_designator'
  if (known.operator === 'non_airline') return 'non_airline_operator'
  // Tarifesiz ICAO koduyla uçan hafif ve küçük iş jetleri (büyük iş jeti A3 açık risktir, D-115).
  if (category !== null && SMALL_CATEGORIES.has(category) && !known.iata) {
    return 'small_non_scheduled'
  }
  return null
}
