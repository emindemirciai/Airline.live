import type { CoverageCircle } from '@havayolu/db'
import { distanceNm, type LatLon } from '@havayolu/geo'
import type { Bbox, CoverageState } from './types'

/** Tek istekte istenebilecek en geniş kutu (derece): yanıt boyutu ve sunucu işi sınırlı kalsın. */
export const BBOX_MAX_SPAN = { lon: 60, lat: 40 } as const

/** Kapsama örneklemesi: kutunun köşeleri dahil 5×5 nokta. */
const COVERAGE_GRID = 5

/** Ondalık sayı; üs, onaltılık ve boş değer kabul edilmez. */
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/

/**
 * Kutu kuralları (REST ve WebSocket aynı): sonlu değerler, enlem −90..90, boylam −180..180,
 * min < max (antimeridyeni aşan kutu yoktur) ve en fazla 60° boylam × 40° enlem.
 */
export function toBbox(
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number,
): Bbox | null {
  const values = [minLon, minLat, maxLon, maxLat]
  if (!values.every((value) => typeof value === 'number' && Number.isFinite(value))) return null
  if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) return null
  if (minLon >= maxLon || minLat >= maxLat) return null
  if (maxLon - minLon > BBOX_MAX_SPAN.lon || maxLat - minLat > BBOX_MAX_SPAN.lat) return null
  return { minLon, minLat, maxLon, maxLat }
}

/** `minLon,minLat,maxLon,maxLat` metnini kutuya çevirir; kurala uymuyorsa null. */
export function parseBbox(s: string): Bbox | null {
  const parts = s.split(',').map((part) => part.trim())
  if (parts.length !== 4 || !parts.every((part) => DECIMAL.test(part))) return null
  const [minLon = NaN, minLat = NaN, maxLon = NaN, maxLat = NaN] = parts.map(Number)
  return toBbox(minLon, minLat, maxLon, maxLat)
}

/** Nokta kutunun içinde ya da sınırında mı? */
export function inBbox(p: LatLon, b: Bbox): boolean {
  return p.lat >= b.minLat && p.lat <= b.maxLat && p.lon >= b.minLon && p.lon <= b.maxLon
}

const RAD = Math.PI / 180

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Noktanın kutuya en kısa uzaklığı, NM; nokta kutudaysa 0. Boylamı kutunun aralığındaki noktaya
 * en yakın yer aynı boylamdaki enlem kenarıdır. Aralığın dışındaki noktaya en yakın yer bir boylam
 * kenarındadır: büyük çember ayağının enlemi (tan φ' = tan φ / cos Δλ) kenara kırpılır. İki boylam
 * kenarına da bakılır; antimeridyen komşuluğu da böylece doğru çıkar.
 */
export function distanceToBboxNm(p: LatLon, b: Bbox): number {
  if (p.lon >= b.minLon && p.lon <= b.maxLon) {
    return distanceNm(p, { lat: clamp(p.lat, b.minLat, b.maxLat), lon: p.lon })
  }
  let nearest = Number.POSITIVE_INFINITY
  for (const lon of [b.minLon, b.maxLon]) {
    const cosDelta = Math.cos((p.lon - lon) * RAD)
    const lats =
      cosDelta > 0
        ? [clamp(Math.atan(Math.tan(p.lat * RAD) / cosDelta) / RAD, b.minLat, b.maxLat)]
        : [b.minLat, b.maxLat]
    for (const lat of lats) nearest = Math.min(nearest, distanceNm(p, { lat, lon }))
  }
  return nearest
}

/**
 * Kutunun kapsama çemberleriyle ilişkisi (D-074). 5×5 noktanın (köşeler dahil) hepsi bir çemberin
 * içindeyse `full`. Hiçbir çember kutuya değmiyorsa `none`: karar örnek noktalarla değil, çember
 * merkezinin kutuya en kısa uzaklığıyla verilir; geniş bir görünümde çember örnek noktaların
 * arasına sığabilir. Arada kalan her durum `partial`. Worker'ın planı okunamıyorsa (`null`)
 * `unknown`.
 */
export function coverageOf(b: Bbox, circles: readonly CoverageCircle[] | null): CoverageState {
  if (circles === null) return 'unknown'
  let inside = 0
  const last = COVERAGE_GRID - 1
  for (let i = 0; i < COVERAGE_GRID; i++) {
    for (let j = 0; j < COVERAGE_GRID; j++) {
      const point = {
        lat: b.minLat + ((b.maxLat - b.minLat) * i) / last,
        lon: b.minLon + ((b.maxLon - b.minLon) * j) / last,
      }
      if (circles.some((c) => distanceNm(c, point) <= c.radiusNm)) inside += 1
    }
  }
  if (inside === COVERAGE_GRID * COVERAGE_GRID) return 'full'
  if (inside > 0) return 'partial'
  return circles.some((c) => distanceToBboxNm(c, b) <= c.radiusNm) ? 'partial' : 'none'
}
