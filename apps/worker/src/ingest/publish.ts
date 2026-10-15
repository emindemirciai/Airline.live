import {
  DROP_REASONS,
  EMPTY_AIRLINE_DESIGNATORS,
  publishDecision,
  type AircraftState,
  type AirlineDesignators,
  type DropReason,
  type LiveScope,
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
 * - Yayınlananlar kümesi: daha önce yayınlanmış bir hex kuralı artık tutmuyorsa `withdraw`'a bir
 *   kez girer (canlı durumdan silinir, uçuş kaydı kapanır).
 * - Katman kapalıyken (admin anahtarı) hiçbir şey yayınlanmaz; `withdraw` boştur, çünkü katman
 *   kapanınca bütün canlı durum topluca silinir (`clearLiveAircraft`).
 *
 * Saf modüldür: zaman dışarıdan verilir, IO yapmaz.
 */

export const CALLSIGN_MEMORY_MS = 600_000
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
  /** Yayınlanan hex → son yayınlandığı an (ingest saati). */
  private readonly published = new Map<string, number>()
  private readonly totals = { published: 0, withdrawn: 0, dropped: emptyDropped() }

  constructor(opts: { scope: LiveScope; callsignMemoryMs?: number }) {
    this.scope = opts.scope
    this.callsignMemoryMs = opts.callsignMemoryMs ?? CALLSIGN_MEMORY_MS
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

  designatorCount(): number {
    return this.designators.size
  }

  split(states: readonly AircraftState[], now: number): GateSplit {
    for (const s of states) this.remember(s)
    if (!this.layer) {
      this.totals.dropped.layer_off += states.length
      return { publish: [], withdraw: [] }
    }
    const publish: AircraftState[] = []
    const withdraw: string[] = []
    for (const s of states) {
      const reason = publishDecision(s, {
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

  private remember(s: AircraftState): void {
    const callsign = s.callsign?.trim()
    if (!callsign) return
    const known = this.callsigns.get(s.hex)
    if (known !== undefined && known.sampleTime > s.sampleTime) return
    this.callsigns.set(s.hex, { callsign, sampleTime: s.sampleTime })
  }

  /** Örneğin çağrı kodu; boşsa aynı hex'in 10 dk'dan yeni hatırlanan çağrı kodu. */
  private effectiveCallsign(s: AircraftState): string | null {
    if (s.callsign?.trim()) return s.callsign
    const known = this.callsigns.get(s.hex)
    if (known === undefined || known.sampleTime < s.sampleTime - this.callsignMemoryMs) return null
    return known.callsign
  }
}
