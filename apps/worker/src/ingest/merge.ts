import type { AircraftState } from '@havayolu/providers'

/**
 * Canlı örneklerin birleştirilmesi (data-sources.md §2 "Birleştirme", D-073):
 * - hex başına yalnızca daha yeni `sampleTime` kabul edilir; eşit zaman aynı örnektir, bir kez
 *   yazılır (aynı örnek iki çemberden ya da iki kaynaktan gelebilir)
 * - bayrağı `null` gelen örnek (veritabanısız yerel alıcı), aynı hex'in son 24 saatte bilinen
 *   bayrağını taşır (D-071); bilinmeyen bayrak gizli sayıldığından bu, uçağın haritada görünmesini
 *   sağlar
 *
 * Saf modüldür: zaman dışarıdan verilir, IO yapmaz.
 */

export const FLAGS_MEMORY_MS = 24 * 3600_000
/** `prune` varsayılanı: canlı durum TTL'i (120 sn) ile aynı. */
export const LATEST_MAX_AGE_MS = 120_000

interface KnownFlags {
  flags: number
  /** Bayrağı taşıyan örneğin zamanı. */
  sampleTime: number
  /** Bayrağın en son görüldüğü an (ingest saati); hafıza süresi buna göre dolar. */
  seenAt: number
}

export class LatestStore {
  private readonly flagsMemoryMs: number
  private readonly latest = new Map<string, AircraftState>()
  private readonly flags = new Map<string, KnownFlags>()

  constructor(opts: { flagsMemoryMs?: number } = {}) {
    this.flagsMemoryMs = opts.flagsMemoryMs ?? FLAGS_MEMORY_MS
  }

  /**
   * Toplu örnekleri işler: aynı partide hex başına en yeni örnek kalır (eşit zamanda bayrağı
   * bilinen tercih edilir), yalnızca saklanandan kesinlikle yeni olan kabul edilir, `null` bayrak
   * bilinen bayrakla doldurulur. Kabul edilenler, hex'in partide ilk göründüğü sırayla döner.
   */
  accept(states: readonly AircraftState[], now: number): AircraftState[] {
    const newest = new Map<string, AircraftState>()
    for (const state of states) {
      this.learnFlags(state, now)
      const current = newest.get(state.hex)
      if (
        current === undefined ||
        state.sampleTime > current.sampleTime ||
        (state.sampleTime === current.sampleTime &&
          current.dbFlags === null &&
          state.dbFlags !== null)
      ) {
        newest.set(state.hex, state)
      }
    }

    const accepted: AircraftState[] = []
    for (const [hex, state] of newest) {
      const stored = this.latest.get(hex)
      if (stored !== undefined && state.sampleTime <= stored.sampleTime) continue
      const filled = this.withKnownFlags(state, now)
      this.latest.set(hex, filled)
      accepted.push(filled)
    }
    return accepted
  }

  get(hex: string): AircraftState | undefined {
    return this.latest.get(hex)
  }

  size(): number {
    return this.latest.size
  }

  /**
   * `sampleTime`'ı `now - maxAgeMs`'den eski son örnekleri ve hafıza süresi dolan bayrakları
   * siler. Silinen son örneklerin hex'lerini döner.
   */
  prune(now: number, maxAgeMs: number = LATEST_MAX_AGE_MS): string[] {
    const dropped: string[] = []
    for (const [hex, state] of this.latest) {
      if (state.sampleTime < now - maxAgeMs) {
        this.latest.delete(hex)
        dropped.push(hex)
      }
    }
    for (const [hex, known] of this.flags) {
      if (known.seenAt < now - this.flagsMemoryMs) this.flags.delete(hex)
    }
    return dropped
  }

  /** Aynı hex için en yeni örneğin bayrağı hatırlanır (bayrak veritabanında değişebilir). */
  private learnFlags(state: AircraftState, now: number): void {
    if (state.dbFlags === null) return
    const known = this.flags.get(state.hex)
    if (known !== undefined && known.sampleTime > state.sampleTime) {
      known.seenAt = Math.max(known.seenAt, now)
      return
    }
    this.flags.set(state.hex, { flags: state.dbFlags, sampleTime: state.sampleTime, seenAt: now })
  }

  private withKnownFlags(state: AircraftState, now: number): AircraftState {
    if (state.dbFlags !== null) return state
    const known = this.flags.get(state.hex)
    if (known === undefined || known.seenAt < now - this.flagsMemoryMs) return state
    return { ...state, dbFlags: known.flags }
  }
}
