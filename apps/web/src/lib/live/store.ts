/**
 * Tarayıcıdaki canlı uçak kümesi: WebSocket tam görüntüsü ve hücre farkları buraya uygulanır
 * (D-074), çizim döngüsü ve paneller buradan okur. React'ten bağımsızdır; değişiklikler
 * `subscribe` ile bildirilir, `version` her değişiklikte bir artar.
 *
 * Zamanlar istemcinin geri gitmeyen saatiyledir (`monotonicNow`, clock.ts; çağıran `now` olarak
 * verir):
 * - `receivedAt`: o örneğin (`t`) istemciye ilk ulaştığı an.
 * - `sampledAt`: örneğin alındığı anın istemci saatindeki tahmini. Sunucu saati her mesajdan
 *   tahmin edilir (`ServerClock`); örneğin yaşı sunucu saatindeki iki değerin farkıdır, saat
 *   kayması etkilemez. Sunucu önbelleği uçağı son örnekten 120 sn sonrasına kadar tuttuğundan
 *   görünüme ilk kez giren bir uçağın örneği dakikalık olabilir; "son görülme", tahminin ufku ve
 *   budama buna dayanır (D-075).
 *
 * Aynı örnek yeniden gelirse (görünüm değişince gelen tam görüntü, hücre değiştiren uçağın sil-ekle
 * çifti) iki zaman korunur; böylece tahmini konum geri sıçramaz. Sunucu saati tahmini iyileştikçe
 * `sampledAt` yalnızca geriye (daha doğru yaşa) düzelir. Eldekinden eski bir örnek (arama sonucu
 * yoldayken gelen yeni fark) yok sayılır.
 */
import type {
  CoverageState,
  LiveDiffMessage,
  LiveSnapshotMessage,
  LiveStatus,
  PublicAircraft,
} from '@havayolu/shared'
import { ServerClock } from './clock'

export interface TrackedAircraft extends PublicAircraft {
  /** Bu örneğin istemciye ilk ulaştığı an, istemci saati (ms). */
  receivedAt: number
  /** Örneğin alındığı anın istemci saatindeki tahmini (≤ `receivedAt`), ms. */
  sampledAt: number
}

export interface TrailPoint {
  lat: number
  lon: number
  gnd: boolean
  /** Örnek zamanı (`PublicAircraft.t`), epoch ms. */
  t: number
}

/** Uçak başına tutulan en fazla iz noktası (D-075: yalnızca sayfa açıldığından beri, istemcide). */
export const TRAIL_MAX_POINTS = 600

/** Örneği bundan eski uçak düşer; sunucu önbelleğinin sınırıyla aynı (120 sn). */
export const STORE_MAX_AGE_MS = 120_000

/**
 * Aynı örnek yeniden gelince `sampledAt` ancak sunucu saati tahmini bundan fazla ilerlemişse
 * düzeltilir (her mesajda küçük titreşimle nesne yenilenmesin).
 */
export const SAMPLED_AT_MIN_CORRECTION_MS = 500

const EMPTY_TRAIL: readonly TrailPoint[] = Object.freeze([])

/**
 * Mesajın sunucu saatine verdiği alt sınır: içindeki en yeni örnek + o andaki en yeni örneğin yaşı.
 * Sunucunun en yeni örneği mesajdakilerden eski olamaz; bu yüzden değer sunucu saatini aşmaz.
 */
export function serverLowerBound(
  aircraft: Iterable<PublicAircraft>,
  status: LiveStatus | null,
): number | null {
  let newest = -Infinity
  for (const ac of aircraft) if (ac.t > newest) newest = ac.t
  if (!Number.isFinite(newest)) return null
  const age = status?.newestAgeS
  return newest + (typeof age === 'number' && Number.isFinite(age) && age > 0 ? age * 1000 : 0)
}

function* diffAircraft(message: LiveDiffMessage): Iterable<PublicAircraft> {
  for (const cell of message.cells) {
    yield* cell.added
    yield* cell.updated
  }
}

export class AircraftStore {
  private readonly aircraft = new Map<string, TrackedAircraft>()
  private readonly trails = new Map<string, TrailPoint[]>()
  private readonly listeners = new Set<() => void>()
  private readonly clock = new ServerClock()
  private currentSeq: number | null = null
  private currentStatus: LiveStatus | null = null
  private currentCoverage: CoverageState | null = null
  private currentVersion = 0

  /** Son uygulanan tam görüntü ya da farkın sayacı; WS `lastSeq` için. */
  get seq(): number | null {
    return this.currentSeq
  }

  get status(): LiveStatus | null {
    return this.currentStatus
  }

  /** Son tam görüntünün kapsama durumu (farklar kapsamayı taşımaz). */
  get coverage(): CoverageState | null {
    return this.currentCoverage
  }

  get version(): number {
    return this.currentVersion
  }

  get size(): number {
    return this.aircraft.size
  }

  /** Kümeyi görüntüdekilerle değiştirir; hâlâ görünen uçakların izi korunur. */
  applySnapshot(message: LiveSnapshotMessage, now: number): void {
    this.observeClock(serverLowerBound(message.aircraft, message.status), now)
    const previous = new Map(this.aircraft)
    this.aircraft.clear()
    for (const ac of message.aircraft) this.put(ac, now, previous.get(ac.hex))
    for (const hex of this.trails.keys()) {
      if (!this.aircraft.has(hex)) this.trails.delete(hex)
    }
    this.currentSeq = message.seq
    this.currentStatus = message.status
    this.currentCoverage = message.coverage
    this.changed()
  }

  /**
   * Hücre farkı (ws-protocol.ts): önce bütün hücrelerin silinenleri, sonra eklenen ve
   * güncellenenler ("ekle ya da güncelle"). Hücre değiştiren uçak bir hücrede silinip diğerinde
   * eklendiği için izi ve zamanları korunur. Bilinmeyen hex'in silinmesi etkisizdir.
   */
  applyDiff(message: LiveDiffMessage, now: number): void {
    this.observeClock(serverLowerBound(diffAircraft(message), message.status), now)
    const removed = new Map<string, TrackedAircraft>()
    for (const cell of message.cells) {
      for (const hex of cell.removed) {
        const ac = this.aircraft.get(hex)
        if (!ac) continue
        removed.set(hex, ac)
        this.aircraft.delete(hex)
      }
    }
    for (const cell of message.cells) {
      for (const ac of cell.added)
        this.put(ac, now, this.aircraft.get(ac.hex) ?? removed.get(ac.hex))
      for (const ac of cell.updated) {
        this.put(ac, now, this.aircraft.get(ac.hex) ?? removed.get(ac.hex))
      }
    }
    for (const hex of removed.keys()) {
      if (!this.aircraft.has(hex)) this.trails.delete(hex)
    }
    this.currentSeq = message.seq
    this.currentStatus = message.status
    this.changed()
  }

  /** Tek kayıt ekler ya da günceller (ör. görünüm dışındaki bir arama sonucu). */
  upsert(ac: PublicAircraft, now: number): void {
    this.put(ac, now, this.aircraft.get(ac.hex))
    this.changed()
  }

  get(hex: string): TrackedAircraft | undefined {
    return this.aircraft.get(hex)
  }

  list(): TrackedAircraft[] {
    return [...this.aircraft.values()]
  }

  /** Uçağın sayfa açıldığından beri alınan konumları, eskiden yeniye (en fazla 600). */
  trail(hex: string): readonly TrailPoint[] {
    return this.trails.get(hex) ?? EMPTY_TRAIL
  }

  /** Örneği `maxAgeMs`'ten eski uçakları ve izlerini atar; bir şey değiştiyse bildirir. */
  prune(now: number, maxAgeMs: number = STORE_MAX_AGE_MS): void {
    let removed = false
    for (const [hex, ac] of this.aircraft) {
      if (now - ac.sampledAt <= maxAgeMs) continue
      this.aircraft.delete(hex)
      this.trails.delete(hex)
      removed = true
    }
    if (removed) this.changed()
  }

  /** Her değişiklikten sonra çağrılır; dönüş fonksiyonu aboneliği kaldırır. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private observeClock(server: number | null, now: number): void {
    if (server !== null) this.clock.observe(server, now)
  }

  /** Örneğin istemci saatindeki tahmini alınma anı; alınmadan sonrası olamaz. */
  private sampleTime(t: number, receivedAt: number): number {
    const local = this.clock.localAt(t)
    return local === null ? receivedAt : Math.min(receivedAt, local)
  }

  private put(ac: PublicAircraft, now: number, previous: TrackedAircraft | undefined): void {
    if (previous !== undefined && ac.t < previous.t) {
      // Eldekinden eski örnek: yeni örnek geri alınmaz, iz geri sıçramaz.
      this.aircraft.set(previous.hex, previous)
      return
    }
    const sameSample =
      previous !== undefined &&
      previous.t === ac.t &&
      previous.lat === ac.lat &&
      previous.lon === ac.lon
    let tracked: TrackedAircraft
    if (sameSample) {
      const refined = this.sampleTime(ac.t, previous.receivedAt)
      const sampledAt =
        previous.sampledAt - refined > SAMPLED_AT_MIN_CORRECTION_MS ? refined : previous.sampledAt
      tracked = { ...ac, receivedAt: previous.receivedAt, sampledAt }
    } else {
      tracked = { ...ac, receivedAt: now, sampledAt: this.sampleTime(ac.t, now) }
    }
    this.aircraft.set(ac.hex, tracked)
    this.appendTrail(tracked)
  }

  private appendTrail(ac: PublicAircraft): void {
    let trail = this.trails.get(ac.hex)
    if (!trail) {
      trail = []
      this.trails.set(ac.hex, trail)
    }
    const last = trail.at(-1)
    if (last && last.lat === ac.lat && last.lon === ac.lon) return
    trail.push({ lat: ac.lat, lon: ac.lon, gnd: ac.gnd, t: ac.t })
    if (trail.length > TRAIL_MAX_POINTS) trail.splice(0, trail.length - TRAIL_MAX_POINTS)
  }

  private changed(): void {
    this.currentVersion += 1
    for (const listener of [...this.listeners]) listener()
  }
}
