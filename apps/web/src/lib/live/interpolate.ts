/**
 * Uçak simgesinin iki örnek arasındaki akıcı hareketi (D-075 §5). Konum, örneğin alındığı anın
 * istemci saatindeki tahmininden (`sampledAt`, store.ts) bu yana yer hızı ve iz yönüyle ileri
 * taşınır; örnekten en fazla 10 sn sonrasına kadar. Örnek zamanı `t` doğrudan kullanılmaz: istemci
 * ile sunucu saatleri arasındaki kayma bilinmez. Yeni örnek gelince gösterilen konumdan yeni tahmine
 * 1 sn'de geçilir (`blend`).
 *
 * Seyrek veride (D-122: adsb.lol günlük bütçesi, API'nin yaş penceresi `maxAgeS` 120 sn'den uzun)
 * örnekler birkaç dakikada bir gelir. Havadaki uçak o zaman örnekten 180 sn sonrasına kadar ileri
 * taşınır, sonra donar; son örneği eskidikçe simge yaş penceresinin sonuna kadar adım adım
 * soluklaşır (`motionPolicy`, `staleOpacity`). Yerdeki uçağın ufku değişmez. İstisna: alçaktaki
 * (10.000 ft altı ya da irtifası bilinmeyen) ve tırmanmayan uçak 10 sn'de durur
 * (`airborneHorizonMs`): yaklaşma, pist turu ya da bekleme sırasında düz çizgide 180 sn taşımak
 * onu pistin kilometrelerce ötesine götürürdü.
 */
import { destinationPoint, ktToKmh, type LatLon } from '@havayolu/geo'
import { LIVE_DEFAULT_MAX_AGE_S, LIVE_MAX_AGE_LIMIT_S, type LiveStatus } from '@havayolu/shared'

/** Tahminin örnekten itibaren en uzun ufku; sinyali kesilen uçak bu süreden sonra ilerlemez. */
export const MAX_EXTRAPOLATION_MS = 10_000

/**
 * Seyrek veride havadaki uçağın tahmin ufku (bütçe kipinde bir sorgu aralığı, D-122); sonrasında
 * simge donar ve soluklaşır.
 */
export const SPARSE_MAX_EXTRAPOLATION_MS = 180_000

/**
 * Seyrek veride bu barometrik irtifanın (ft) altındaki, tırmanmayan uçak havalimanı yakınında
 * sayılır (yaklaşma, pist turu, bekleme) ve uzun ufku almaz.
 */
export const SPARSE_LOW_ALT_FT = 10_000

/** Bu dikey hızın (ft/dk) üstündeki uçak tırmanıyor sayılır. */
export const SPARSE_CLIMB_VR_FPM = 300

/** Soluklaşan simgenin en düşük saydamlığı (yaş penceresinin sonunda). */
export const STALE_MIN_OPACITY = 0.35

/** Saydamlık bu adımlarla değişir: kaynak her karede değil, adım değişince yeniden yüklenir. */
export const OPACITY_STEP = 0.05

const DEFAULT_MAX_AGE_MS = LIVE_DEFAULT_MAX_AGE_S * 1_000
const MAX_AGE_LIMIT_MS = LIVE_MAX_AGE_LIMIT_S * 1_000

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

/** Çizim döngüsünün tahmin ve soluklaşma kuralı (`motionPolicy`). */
export interface MotionPolicy {
  /** Havadaki uçağın tahmin ufku, ms (örnekten itibaren). */
  airborneHorizonMs: number
  /** Yerdeki uçağın tahmin ufku, ms. */
  groundHorizonMs: number
  /** Simgenin soluklaşmaya başladığı örnek yaşı, ms; `maxAgeMs`'e eşitse soluklaşma yoktur. */
  fadeStartMs: number
  /** Yaş penceresi, ms: örneği bundan eski uçak budanır (store.ts `prune`). */
  maxAgeMs: number
  /** Veri seyrek mi (yaş penceresi 120 sn'den uzun, D-122). */
  sparse: boolean
}

/** Sık veri (bugünkü davranış): iki ufuk da 10 sn, soluklaşma yok, pencere 120 sn. */
export const NORMAL_MOTION_POLICY: Readonly<MotionPolicy> = Object.freeze({
  airborneHorizonMs: MAX_EXTRAPOLATION_MS,
  groundHorizonMs: MAX_EXTRAPOLATION_MS,
  fadeStartMs: DEFAULT_MAX_AGE_MS,
  maxAgeMs: DEFAULT_MAX_AGE_MS,
  sparse: false,
})

/**
 * API'nin yaş penceresi, ms (`status.maxAgeS`, D-122): 120 sn ile 1.800 sn arasına kırpılır; durum
 * yoksa ya da alan yoksa (eski API) 120 sn.
 */
export function liveMaxAgeMs(status: Pick<LiveStatus, 'maxAgeS'> | null): number {
  const seconds = status?.maxAgeS
  const ms =
    typeof seconds === 'number' && Number.isFinite(seconds) ? seconds * 1_000 : DEFAULT_MAX_AGE_MS
  return Math.min(Math.max(ms, DEFAULT_MAX_AGE_MS), MAX_AGE_LIMIT_MS)
}

/**
 * Duruma göre tahmin ve soluklaşma kuralı. Pencere 120 sn'den uzunsa veri seyrektir: havadaki
 * uçak 180 sn'ye (pencereden kısaysa pencereye) kadar ileri taşınır (alçaktaki tırmanmayan uçak
 * hariç, `airborneHorizonMs`), yerdeki 10 sn; simge 180 sn'den pencerenin sonuna kadar soluklaşır.
 * Değilse `NORMAL_MOTION_POLICY`.
 */
export function motionPolicy(status: Pick<LiveStatus, 'maxAgeS'> | null): Readonly<MotionPolicy> {
  const maxAgeMs = liveMaxAgeMs(status)
  if (maxAgeMs <= DEFAULT_MAX_AGE_MS) return NORMAL_MOTION_POLICY
  const horizon = Math.min(SPARSE_MAX_EXTRAPOLATION_MS, maxAgeMs)
  return {
    airborneHorizonMs: horizon,
    groundHorizonMs: MAX_EXTRAPOLATION_MS,
    fadeStartMs: horizon,
    maxAgeMs,
    sparse: true,
  }
}

/**
 * Havadaki uçağın tahmin ufku: seyrek veride alçaktaki (irtifası bilinmeyen dahil) ve tırmanmayan
 * uçak 10 sn'lik ufku korur; diğerleri `policy.airborneHorizonMs`. Sık veride her zaman o.
 */
export function airborneHorizonMs(
  ac: { alt: number | null; vr: number | null },
  policy: Readonly<MotionPolicy>,
): number {
  if (!policy.sparse) return policy.airborneHorizonMs
  const low = ac.alt === null || !Number.isFinite(ac.alt) || ac.alt < SPARSE_LOW_ALT_FT
  const climbing = ac.vr !== null && Number.isFinite(ac.vr) && ac.vr > SPARSE_CLIMB_VR_FPM
  return low && !climbing
    ? Math.min(MAX_EXTRAPOLATION_MS, policy.airborneHorizonMs)
    : policy.airborneHorizonMs
}

/**
 * Son örneği `ageMs` önce alınmış simgenin saydamlığı: soluklaşma başlayana kadar 1, sonra
 * pencerenin sonuna kadar doğrusal olarak 0,35'e iner; 0,05'lik adımlara yuvarlanır.
 */
export function staleOpacity(ageMs: number, policy: Readonly<MotionPolicy>): number {
  const span = policy.maxAgeMs - policy.fadeStartMs
  if (!(span > 0) || !(ageMs > policy.fadeStartMs)) return 1
  const fraction = Math.min((ageMs - policy.fadeStartMs) / span, 1)
  const steps = Math.round((1 - STALE_MIN_OPACITY) / OPACITY_STEP)
  const level = Math.round(fraction * steps)
  return Math.round((1 - level * OPACITY_STEP) * 100) / 100
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
