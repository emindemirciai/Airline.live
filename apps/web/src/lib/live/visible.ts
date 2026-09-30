/**
 * Haritada görünen uçaklar tablosunun satırları: görünümün içindekiler, görünüm merkezine
 * yakınlığa göre (eşitlikte hex'e göre) sıralı, ilk `limit` tanesi.
 */
import { distanceKm } from '@havayolu/geo'
import type { Bbox } from '@havayolu/shared'

export const VISIBLE_LIMIT = 50

/**
 * Boylam aralıkta mı? Harita sınırı dünya kopyasına taşabilir (170..190); uçak boylamı
 * −180..180 olduğundan ±360 kaydırılmış hâli de denenir.
 */
function lonInRange(lon: number, min: number, max: number): boolean {
  if (max - min >= 360) return true
  return [lon, lon + 360, lon - 360].some((value) => value >= min && value <= max)
}

export function inBounds(p: { lat: number; lon: number }, bounds: Bbox): boolean {
  return (
    p.lat >= bounds.minLat &&
    p.lat <= bounds.maxLat &&
    lonInRange(p.lon, bounds.minLon, bounds.maxLon)
  )
}

export function visibleAircraft<T extends { lat: number; lon: number; hex: string }>(
  list: readonly T[],
  bounds: Bbox,
  center: { lat: number; lon: number },
  limit: number = VISIBLE_LIMIT,
): { rows: T[]; total: number } {
  const inside: { item: T; distance: number }[] = []
  for (const item of list) {
    if (inBounds(item, bounds)) inside.push({ item, distance: distanceKm(center, item) })
  }
  inside.sort(
    (a, b) =>
      a.distance - b.distance || (a.item.hex < b.item.hex ? -1 : a.item.hex > b.item.hex ? 1 : 0),
  )
  const count = Math.max(0, Math.floor(limit))
  return { rows: inside.slice(0, count).map((entry) => entry.item), total: inside.length }
}
