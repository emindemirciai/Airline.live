/** Saf coğrafi yardımcılar. IO yok; tüm açılar derece, mesafeler km (aksi belirtilmedikçe). */

export const EARTH_RADIUS_KM = 6371.0088
export const KM_PER_NM = 1.852
export const FT_PER_M = 3.280839895

export interface LatLon {
  lat: number
  lon: number
}

const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

export const kmToNm = (km: number) => km / KM_PER_NM
export const nmToKm = (nm: number) => nm * KM_PER_NM
export const mToFt = (m: number) => m * FT_PER_M
export const ftToM = (ft: number) => ft / FT_PER_M

/** Açıyı [0, 360) aralığına getirir. */
export function normalizeBearing(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/** İki yön arasındaki en küçük fark, [0, 180]. */
export function bearingDifference(a: number, b: number): number {
  const diff = Math.abs(normalizeBearing(a) - normalizeBearing(b))
  return diff > 180 ? 360 - diff : diff
}

/** Büyük daire (haversine) yatay mesafe, km. */
export function distanceKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** a'dan b'ye ilk gerçek yön (true bearing), [0, 360). */
export function initialBearing(a: LatLon, b: LatLon): number {
  const phi1 = toRad(a.lat)
  const phi2 = toRad(b.lat)
  const dLambda = toRad(b.lon - a.lon)
  const y = Math.sin(dLambda) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda)
  return normalizeBearing(toDeg(Math.atan2(y, x)))
}

/** Başlangıç noktasından verilen yön ve mesafede varılan nokta (eşik kaydırma gibi işler için). */
export function destinationPoint(
  start: LatLon,
  bearingDeg: number,
  distanceKmValue: number,
): LatLon {
  const delta = distanceKmValue / EARTH_RADIUS_KM
  const theta = toRad(bearingDeg)
  const phi1 = toRad(start.lat)
  const lambda1 = toRad(start.lon)
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  )
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    )
  return { lat: toDeg(phi2), lon: ((toDeg(lambda2) + 540) % 360) - 180 }
}

/** Pist eşiğinin nereden geldiği (domain.md → Pist eşiği). */
export type ThresholdSource = 'runway_end' | 'displaced_threshold' | 'arp_fallback'

export const M_PER_FT = 0.3048

/**
 * Pist eşiği: pist ucu koordinatı `displacedFt × 0,3048` m pist yönünde (bu uçtan karşı uca)
 * kaydırılır. Uç koordinatı yoksa havalimanı merkezi (ARP) kullanılır.
 */
export function runwayThreshold(
  end: LatLon | null,
  runwayBearingDeg: number | null,
  displacedFt: number | null,
  arp: LatLon,
): { point: LatLon; source: ThresholdSource } {
  if (!end) return { point: arp, source: 'arp_fallback' }
  if (!displacedFt || displacedFt <= 0 || runwayBearingDeg === null) {
    return { point: end, source: 'runway_end' }
  }
  const point = destinationPoint(end, runwayBearingDeg, (displacedFt * M_PER_FT) / 1000)
  return { point, source: 'displaced_threshold' }
}
