import { greatCircleKm } from '../airports'

/**
 * Test yardımcısı: küresel hedef noktası (`@havayolu/geo` `destinationPoint` ile aynı formül ve
 * yarıçap; db paketi geo'ya bağımlı değildir).
 */
export function destination(
  start: { lat: number; lon: number },
  bearingDeg: number,
  km: number,
): { lat: number; lon: number } {
  const rad = (d: number) => (d * Math.PI) / 180
  const deg = (r: number) => (r * 180) / Math.PI
  const delta = km / 6371.0088
  const theta = rad(bearingDeg)
  const phi1 = rad(start.lat)
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  )
  const lambda2 =
    rad(start.lon) +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    )
  return { lat: deg(phi2), lon: ((deg(lambda2) + 540) % 360) - 180 }
}

/**
 * Merkezden `bearingDeg` yönünde, haversine uzaklığı `km`'yi aşmayan en uzak nokta: kayan nokta
 * hatası (~1e-12 km) sınırdaki noktayı dışarı itmesin diye uzaklık gerekirse çok az kısaltılır.
 */
export function pointAtMostKm(
  center: { lat: number; lon: number },
  bearingDeg: number,
  km: number,
): { lat: number; lon: number } {
  let shrink = 0
  for (;;) {
    const p = destination(center, bearingDeg, km - shrink)
    if (greatCircleKm(p, center) <= km) return p
    shrink = shrink === 0 ? 1e-12 : shrink * 2
  }
}
