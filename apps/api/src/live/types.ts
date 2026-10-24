/**
 * Canlı API'nin (M5) sunucu tarafı tipleri. İstemciyle paylaşılan kayıt biçimleri (`PublicAircraft`,
 * `Bbox`, `LiveStatus` …) `@havayolu/shared`'dadır (live.ts); burada yeniden dışa aktarılır.
 */
import type { Bbox, CoverageState, LiveStatus, PublicAircraft } from '@havayolu/shared'

export type {
  Bbox,
  CoverageState,
  LiveStatus,
  ProviderState,
  PublicAircraft,
} from '@havayolu/shared'

/**
 * API'nin her yanıtta ve WS mesajında gönderdiği durum: `layer` (D-115) ve `maxAgeS` (D-122) her
 * zaman vardır.
 */
export type ServedLiveStatus = LiveStatus & { layer: 'on' | 'off'; maxAgeS: number }

/** Bir önbellek turunun farkı. `seq` her değişen turda bir artar. */
export interface TickDiff {
  seq: number
  added: PublicAircraft[]
  updated: PublicAircraft[]
  /** Silinen hex ve son bilinen konumu (ızgara hücresini bulmak için). */
  removed: { hex: string; lat: number; lon: number }[]
  /**
   * Durum, uçaklardan bağımsız değişti (canlı katman açıldı ya da kapandı, D-115): fark boş olsa da
   * gönderilir ve WS merkezi abone her istemciye tam görüntü yollar.
   */
  statusChanged?: true
}

/** WebSocket merkezinin ve REST yollarının okuduğu canlı veri kaynağı (LiveCache bunu uygular). */
export interface LiveSource {
  seq(): number
  snapshot(bbox?: Bbox): PublicAircraft[]
  get(hex: string): PublicAircraft | undefined
  all(): Iterable<PublicAircraft>
  /** `afterSeq`'ten sonraki farklar; tampon yetmiyorsa null. */
  diffsSince(afterSeq: number): TickDiff[] | null
  status(): ServedLiveStatus
  coverage(bbox: Bbox): CoverageState
  /** Her değişen turda çağrılır; dönüş fonksiyonu aboneliği kaldırır. */
  onTick(listener: (diff: TickDiff) => void): () => void
}
