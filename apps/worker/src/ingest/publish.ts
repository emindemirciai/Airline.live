import {
  DROP_REASONS,
  EMPTY_AIRLINE_DESIGNATORS,
  MIN_NON_AIRLINE_DESIGNATORS,
  nonAirlineCount,
  publishDecision,
  suspectDesignatorTable,
  type AircraftState,
  type AirlineDesignators,
  type DropReason,
  type LiveScope,
  type PublishState,
} from '@havayolu/providers'

/**
 * Yayın kapısı (D-115, kaynakta süzme): `LatestStore`'un kabul ettiği örneklerden hangilerinin
 * `redis-live`'a, uçuş kaydına ve ize gideceğine karar verir. Yayınlanmayan örnek hiçbir yere
 * yazılmaz; yalnızca anonim sayaçlar tutulur (hex, çağrı kodu, tescil yok).
 *
 * - Çağrı kodu hafızası: readsb kimlik mesajları arasında çağrı kodsuz kareler gönderir ve
 *   `LatestStore` çağrı kodunu birleştirmez. Kapı her örnekten (yayınlansın ya da yayınlanmasın)
 *   hex başına son dolu çağrı kodunu `sampleTime`'ıyla tutar; çağrı kodu boş gelen örneğin kararı
 *   10 dk'dan yeni hatırlanan çağrı koduyla verilir. Yayınlanan örneğin kendisi değişmez.
 * - Uçak hafızası: veritabanısız yerel alıcı tescil ve tip göndermez, yalnız Mode S ya da MLAT
 *   uçağı kategori göndermez. Kapı her örnekten hex başına son dolu tescili, tipi ve kategoriyi
 *   24 saat tutar; alanı boş gelen örneğin kararı hatırlanan değerle verilir. Böylece adsb.lol'ün
 *   iş jeti ya da helikopter dediği uçak yerel alıcının karelerinden yayına sızmaz.
 * - Yayınlananlar kümesi: daha önce yayınlanmış bir hex kuralı artık tutmuyorsa `withdraw`'a bir
 *   kez girer (canlı durumdan silinir, uçuş kaydı kapanır).
 * - Katman kapalıyken (admin anahtarı) hiçbir şey yayınlanmaz; `withdraw` boştur, çünkü katman
 *   kapanınca bütün canlı durum topluca silinir (`clearLiveAircraft`).
 *
 * Saf modüldür: zaman dışarıdan verilir, IO yapmaz.
 */

export const CALLSIGN_MEMORY_MS = 600_000
/** Tescil, tip ve kategori hafızası: `LatestStore`'un bayrak hafızasıyla aynı (24 sa). */
export const AIRCRAFT_MEMORY_MS = 24 * 3_600_000
/** Yayınlananlar kümesinin budama yaşı: canlı durum TTL'i (120 sn) ile aynı. */
export const PUBLISHED_MAX_AGE_MS = 120_000

export type GateCounterKey = DropReason | 'layer_off'

export interface GateCounters {
  /** Açılıştan beri yayınlanan örnek sayısı. */
  published: number
  /** Açılıştan beri yayından çekilen uçak sayısı. */
  withdrawn: number
  /** Açılıştan beri nedene göre yayınlanmayan örnek sayısı. */
  dropped: Record<GateCounterKey, number>
}

export interface GateSplit {
  publish: AircraftState[]
  /** Daha önce yayınlanmış ama artık yayınlanmayan hex'ler. */
  withdraw: string[]
}

/** `offerDesignators` sonucu (yalnız sayılar; loglanır). */
export interface DesignatorOffer {
  accepted: boolean
  /** Yeni tablodaki `non_airline` işletmeci sayısı. */
  nonAirline: number
  /** Yürürlükteki (son iyi) tablodaki `non_airline` işletmeci sayısı. */
  previousNonAirline: number
}

/**
 * Yeni işletmeci tablosundaki `non_airline` sayısının alt sınırı: üretimde
 * `MIN_NON_AIRLINE_DESIGNATORS`. Geliştirme ve testte yoktur (entegrasyon testleri birkaç satırlık
 * tablo kurar); son iyi tablonun %80 oranı her ortamda uygulanır.
 */
export function designatorFloor(appEnv: 'development' | 'test' | 'production'): number {
  return appEnv === 'production' ? MIN_NON_AIRLINE_DESIGNATORS : 0
}

type AircraftField = 'registration' | 'typeCode' | 'category'
const AIRCRAFT_FIELDS: readonly AircraftField[] = ['registration', 'typeCode', 'category']

interface KnownAircraft {
  fields: Partial<Record<AircraftField, { value: string; sampleTime: number }>>
  /** Bir alanın en son öğrenildiği an (ingest saati); hafıza süresi buna göre dolar. */
  seenAt: number
}

/** Dolu alan değeri; boşsa null. Kategoride A0 da "bilgi yok"tur. */
function filled(field: AircraftField, value: string | null): string | null {
  const trimmed = value?.trim() ?? ''
  if (trimmed === '') return null
  if (field === 'category' && trimmed.toUpperCase() === 'A0') return null
  return trimmed
}

const emptyDropped = (): Record<GateCounterKey, number> => {
  const out = { layer_off: 0 } as Record<GateCounterKey, number>
  for (const reason of DROP_REASONS) out[reason] = 0
  return out
}

export class PublishGate {
  readonly scope: LiveScope
  private readonly callsignMemoryMs: number
  private layer = true
  private blocklist: ReadonlySet<string> | null = null
  private designators: AirlineDesignators = EMPTY_AIRLINE_DESIGNATORS
  private readonly callsigns = new Map<string, { callsign: string; sampleTime: number }>()
  private readonly aircraftMemoryMs: number
  private readonly aircraft = new Map<string, KnownAircraft>()
  /** Yayınlanan hex → son yayınlandığı an (ingest saati). */
  private readonly published = new Map<string, number>()
  private readonly totals = { published: 0, withdrawn: 0, dropped: emptyDropped() }

  constructor(opts: { scope: LiveScope; callsignMemoryMs?: number; aircraftMemoryMs?: number }) {
    this.scope = opts.scope
    this.callsignMemoryMs = opts.callsignMemoryMs ?? CALLSIGN_MEMORY_MS
    this.aircraftMemoryMs = opts.aircraftMemoryMs ?? AIRCRAFT_MEMORY_MS
  }

  setLayer(on: boolean): void {
    this.layer = on
    // Katman kapanınca canlı durum topluca silinir; açılınca uçaklar yeniden yayınlanır.
    if (!on) this.published.clear()
  }

  layerOn(): boolean {
    return this.layer
  }

  /** null: liste henüz okunamadı (kapalı varsayım: hiçbir örnek yayınlanmaz). */
  setBlocklist(list: ReadonlySet<string> | null): void {
    this.blocklist = list
  }

  blocklistLoaded(): boolean {
    return this.blocklist !== null
  }

  setDesignators(map: AirlineDesignators): void {
    this.designators = map
  }

  /**
   * Yeni işletmeci tablosunu dener (D-115). `non_airline` sayısı `minimum`'un ya da yürürlükteki
   * tablodakinin %80'inin altındaysa (VRS'in desen sütunu kayboldu ya da yazımı değişti, iş jeti
   * işletmecileri `airline` sayılırdı) tablo reddedilir ve yürürlükteki kalır; yürürlükte tablo
   * yoksa kapı boş kalır ve hiçbir şey yayınlanmaz. Boş tablo reddedilmez (boş tabloyla da hiçbir
   * şey yayınlanmaz).
   */
  offerDesignators(next: AirlineDesignators, minimum: number): DesignatorOffer {
    const previousNonAirline = nonAirlineCount(this.designators)
    const nonAirline = nonAirlineCount(next)
    const accepted = !suspectDesignatorTable(next, { previousNonAirline, minimum })
    if (accepted) this.designators = next
    return { accepted, nonAirline, previousNonAirline }
  }

  designatorCount(): number {
    return this.designators.size
  }

  /**
   * Çağrı kodunu, tescili, tipi ve kategoriyi öğrenir; karar vermez. Worker bunu `LatestStore`'un
   * reddettiği eski örnekler dahil her örnek için çağırır (adsb.lol'ün tipi, yerel alıcının daha
   * yeni ama tipsiz karesinden önce gelebilir). `split` kendi örneklerini ayrıca öğrenir.
   */
  observe(states: readonly AircraftState[], now: number): void {
    for (const s of states) this.remember(s, now)
  }

  split(states: readonly AircraftState[], now: number): GateSplit {
    for (const s of states) this.remember(s, now)
    if (!this.layer) {
      this.totals.dropped.layer_off += states.length
      return { publish: [], withdraw: [] }
    }
    const publish: AircraftState[] = []
    const withdraw: string[] = []
    for (const s of states) {
      const reason = publishDecision(this.decisionState(s, now), {
        scope: this.scope,
        blocklist: this.blocklist,
        designators: this.designators,
        callsign: this.effectiveCallsign(s),
      })
      if (reason === null) {
        publish.push(s)
        this.published.set(s.hex, now)
        this.totals.published += 1
        continue
      }
      this.totals.dropped[reason] += 1
      if (this.published.delete(s.hex)) {
        withdraw.push(s.hex)
        this.totals.withdrawn += 1
      }
    }
    return { publish, withdraw }
  }

  /** Hafıza süresi dolan çağrı kodlarını ve 120 sn'dir yayınlanmamış hex'leri siler. */
  prune(now: number): void {
    for (const [hex, entry] of this.callsigns) {
      if (entry.sampleTime < now - this.callsignMemoryMs) this.callsigns.delete(hex)
    }
    for (const [hex, at] of this.published) {
      if (at < now - PUBLISHED_MAX_AGE_MS) this.published.delete(hex)
    }
    for (const [hex, known] of this.aircraft) {
      if (known.seenAt < now - this.aircraftMemoryMs) this.aircraft.delete(hex)
    }
  }

  /** Açılıştan beri birikmiş anonim sayaçlar (kopya). */
  counters(): GateCounters {
    return {
      published: this.totals.published,
      withdrawn: this.totals.withdrawn,
      dropped: { ...this.totals.dropped },
    }
  }

  /** Sıfır olmayan düşme sayaçları (loglar ve `IngestStats` için). */
  droppedNonZero(): Partial<Record<GateCounterKey, number>> {
    const out: Partial<Record<GateCounterKey, number>> = {}
    for (const [key, value] of Object.entries(this.totals.dropped) as [GateCounterKey, number][]) {
      if (value > 0) out[key] = value
    }
    return out
  }

  private remember(s: AircraftState, now: number): void {
    this.rememberAircraft(s, now)
    const callsign = s.callsign?.trim()
    if (!callsign) return
    const known = this.callsigns.get(s.hex)
    if (known !== undefined && known.sampleTime > s.sampleTime) return
    this.callsigns.set(s.hex, { callsign, sampleTime: s.sampleTime })
  }

  /** Hex başına alan alan en yeni dolu değer (eski örnek yeniyi ezmez). */
  private rememberAircraft(s: AircraftState, now: number): void {
    let known = this.aircraft.get(s.hex)
    for (const field of AIRCRAFT_FIELDS) {
      const value = filled(field, s[field])
      if (value === null) continue
      known ??= { fields: {}, seenAt: now }
      const current = known.fields[field]
      if (current === undefined || current.sampleTime <= s.sampleTime) {
        known.fields[field] = { value, sampleTime: s.sampleTime }
      }
      known.seenAt = Math.max(known.seenAt, now)
    }
    if (known !== undefined) this.aircraft.set(s.hex, known)
  }

  /** Kararın girdisi: örneğin boş tescil, tip ve kategorisi 24 saatte hatırlananla doldurulur. */
  private decisionState(s: AircraftState, now: number): PublishState {
    const known = this.aircraft.get(s.hex)
    if (known === undefined || known.seenAt < now - this.aircraftMemoryMs) return s
    const pick = (field: AircraftField): string | null =>
      filled(field, s[field]) !== null ? s[field] : (known.fields[field]?.value ?? s[field])
    return {
      hex: s.hex,
      nonIcao: s.nonIcao,
      callsign: s.callsign,
      registration: pick('registration'),
      typeCode: pick('typeCode'),
      category: pick('category'),
      dbFlags: s.dbFlags,
      positionSource: s.positionSource,
    }
  }

  /** Örneğin çağrı kodu; boşsa aynı hex'in 10 dk'dan yeni hatırlanan çağrı kodu. */
  private effectiveCallsign(s: AircraftState): string | null {
    if (s.callsign?.trim()) return s.callsign
    const known = this.callsigns.get(s.hex)
    if (known === undefined || known.sampleTime < s.sampleTime - this.callsignMemoryMs) return null
    return known.callsign
  }
}
