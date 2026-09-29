/**
 * Görünüm aboneliğinin planı (D-074, D-075). Sunucu her abonelikte görünümün tam görüntüsünü
 * gönderir; farkları ise 2°'lik ızgara hücreleri hâlinde, görünümle kesişen bütün hücreler için
 * yollar (ws-protocol.ts). Bu yüzden abonelik kutusu dışa doğru hücre sınırlarına yuvarlanır: tam
 * görüntü farklarla aynı uçakları taşır (hücrede olup kutunun dışında kalan uçak her görüntüde düşüp
 * farkla geri gelmez) ve kutu, görünüm yeni bir hücreye taşmadıkça değişmez.
 *
 * Yeniden abonelik yalnızca iki durumda gerekir:
 * - görünüm (hücreye yuvarlanmış hâli) eldeki aboneliğin dışına taştı (kaydırma, uzaklaştırma,
 *   "Uçağı ortala" ile yeni hücreye geçen uçak);
 * - görünüm çok küçüldü (yakınlaştırma): abonelik gerekenin `SHRINK_FACTOR` katından büyükse
 *   gereksiz farklar gelmesin diye daraltılır.
 * "Uçağı ortala" her turda haritayı kaydırır; bu planla abonelik saniyede iki kez değil, uçak bir
 * hücre sınırını geçtiğinde (dakikalar) yenilenir.
 */
import type { Bbox } from '@havayolu/shared'
import { VIEWPORT_MAX_SPAN, clampViewport } from './connection'

/** Sunucunun fark ızgarası (apps/api/src/live/ws-protocol.ts `CELL_DEG`). */
export const CELL_DEG = 2

/** Abonelik gerekenin bu katından büyükse daraltılır. */
export const SHRINK_FACTOR = 4

/**
 * Kutunun üst kenarı hücre sınırının hemen altında durur: sunucu kenardaki değeri üstteki hücreye
 * sayar (`Math.floor(maxLat / 2)`), fazladan bir sıra hücre abone olunmaz.
 */
const EDGE_EPSILON = 1e-7

const MAX_LAT = 85

function snapDown(value: number): number {
  return Math.floor(value / CELL_DEG) * CELL_DEG
}

function snapUp(value: number): number {
  return Math.ceil(value / CELL_DEG) * CELL_DEG - EDGE_EPSILON
}

/** Kutunun kapladığı hücre sayısı (kesirli kenarlar yukarı yuvarlanır). */
function cellCount(b: Bbox): number {
  const cols = Math.max(1, Math.ceil((b.maxLon - b.minLon) / CELL_DEG - EDGE_EPSILON))
  const rows = Math.max(1, Math.ceil((b.maxLat - b.minLat) / CELL_DEG - EDGE_EPSILON))
  return cols * rows
}

function contains(outer: Bbox, inner: Bbox): boolean {
  return (
    inner.minLon >= outer.minLon &&
    inner.maxLon <= outer.maxLon &&
    inner.minLat >= outer.minLat &&
    inner.maxLat <= outer.maxLat
  )
}

/**
 * Görünüm için abone olunacak kutu: API sınırına kırpılır, hücre sınırlarına dışa doğru yuvarlanır.
 * Görünüm API'nin en geniş kutusundan (60° × 40°) büyükse kutu, hücreye yuvarlanmış merkezin
 * etrafında kurulur; merkez bir hücre içinde kaydıkça kutu değişmez.
 */
export function subscriptionBox(view: Bbox): Bbox {
  const clamped = clampViewport(view)
  let minLon = snapDown(clamped.minLon)
  let maxLon = snapUp(clamped.maxLon)
  let minLat = snapDown(clamped.minLat)
  let maxLat = snapUp(clamped.maxLat)
  if (maxLon - minLon > VIEWPORT_MAX_SPAN.lon) {
    const centre = Math.round((clamped.minLon + clamped.maxLon) / 2 / CELL_DEG) * CELL_DEG
    minLon = centre - VIEWPORT_MAX_SPAN.lon / 2
    maxLon = centre + VIEWPORT_MAX_SPAN.lon / 2 - EDGE_EPSILON
  }
  if (maxLat - minLat > VIEWPORT_MAX_SPAN.lat) {
    const centre = Math.round((clamped.minLat + clamped.maxLat) / 2 / CELL_DEG) * CELL_DEG
    minLat = centre - VIEWPORT_MAX_SPAN.lat / 2
    maxLat = centre + VIEWPORT_MAX_SPAN.lat / 2 - EDGE_EPSILON
  }
  return {
    minLon: Math.max(minLon, -180),
    maxLon: Math.min(maxLon, 180 - EDGE_EPSILON),
    minLat: Math.max(minLat, -MAX_LAT),
    maxLat: Math.min(maxLat, MAX_LAT),
  }
}

/** Eldeki aboneliği tutar; görünüm değişince yeni kutu gerekip gerekmediğine karar verir. */
export class SubscriptionPlanner {
  private current: Bbox | null = null

  /** Abone olunan kutu (henüz yoksa null). */
  get box(): Bbox | null {
    return this.current
  }

  /**
   * Planı eldeki aboneliğe geri alır: sıraya alınmış ama gönderilmemiş bir kutu iptal edildiyse
   * (seyreltici durduruldu) son gönderilen kutu verilir; sonraki görünüm yeniden değerlendirilir.
   */
  reset(sent: Bbox | null = null): void {
    this.current = sent
  }

  /** Görünüm için yeni abonelik kutusu; eldeki yeterliyse null. */
  next(view: Bbox): Bbox | null {
    const target = subscriptionBox(view)
    const current = this.current
    if (
      current !== null &&
      contains(current, target) &&
      cellCount(current) <= SHRINK_FACTOR * cellCount(target)
    ) {
      return null
    }
    this.current = target
    return target
  }
}
