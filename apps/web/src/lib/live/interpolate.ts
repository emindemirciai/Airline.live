/**
 * Uçak simgesinin iki örnek arasındaki akıcı hareketi (D-075 §5). Konum, örneğin alındığı anın
 * istemci saatindeki tahmininden (`sampledAt`, store.ts) bu yana yer hızı ve iz yönüyle ileri
 * taşınır; örnekten en fazla 10 sn sonrasına kadar. Örnek zamanı `t` doğrudan kullanılmaz: istemci
 * ile sunucu saatleri arasındaki kayma bilinmez. Yeni örnek gelince gösterilen konumdan yeni tahmine
 * 1 sn'de geçilir (`blend`).
 */
import { destinationPoint, ktToKmh, type LatLon } from '@havayolu/geo'

/** Tahminin örnekten itibaren en uzun ufku; sinyali kesilen uçak bu süreden sonra ilerlemez. */
export const MAX_EXTRAPOLATION_MS = 10_000

/** Yeni örnekte gösterilen konumdan yeni tahmine geçiş süresi. */
export const BLEND_MS = 1_000

/** Bu hızın altında (kt) uçak duruyor sayılır. */
const MIN_MOVING_KT = 1

const MS_PER_HOUR = 3_600_000

export interface MotionSample {
  lat: number
  lon: number
  /** Yer hızı, kt. */
  gs: number | null
  /** İz yönü, derece. */
  trk: number | null
}

/**
 * Örneğin `now` anındaki tahmini konumu (`since`: örneğin istemci saatindeki anı); hız ya da yön
 * yoksa örneğin kendisi.
 */
export function predictPosition(
  ac: MotionSample,
  since: number,
  now: number,
  maxAheadMs: number = MAX_EXTRAPOLATION_MS,
): LatLon {
  const origin = { lat: ac.lat, lon: ac.lon }
  const { gs, trk } = ac
  if (gs === null || trk === null || !Number.isFinite(gs) || !Number.isFinite(trk)) return origin
  if (gs < MIN_MOVING_KT) return origin
  const elapsedMs = Math.min(Math.max(now - since, 0), maxAheadMs)
  if (!(elapsedMs > 0)) return origin
  return destinationPoint(origin, trk, (ktToKmh(gs) * elapsedMs) / MS_PER_HOUR)
}

/**
 * `from`'dan `to`'ya doğrusal geçiş; `fraction` 0..1 aralığına kırpılır. Antimeridyeni aşan
 * geçiş (boylam farkı > 180°) dünyanın öbür yüzünden dolaşmasın diye yapılmaz: `to` döner.
 */
export function blend(from: LatLon, to: LatLon, fraction: number): LatLon {
  const f = Number.isNaN(fraction) ? 1 : Math.min(Math.max(fraction, 0), 1)
  if (f >= 1 || Math.abs(to.lon - from.lon) > 180) return { lat: to.lat, lon: to.lon }
  return {
    lat: from.lat + (to.lat - from.lat) * f,
    lon: from.lon + (to.lon - from.lon) * f,
  }
}
