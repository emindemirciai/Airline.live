import {
  COMPASS_POINTS_16,
  COMPASS_POINTS_8,
  type CompassPoint16,
  type CompassPoint8,
} from './schema'

function normalize(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/**
 * Dereceyi 16 yönden birine çevirir (22,5° dilimler; K = 348,75°–11,25°). Dilim sınırı saat
 * yönündeki dilime gider (11,25° → NNE). Metin anahtarı `weather.compass.*.<key>`; sonlu değilse null.
 */
export function compassKey(deg: number): CompassPoint16 | null {
  if (!Number.isFinite(deg)) return null
  return COMPASS_POINTS_16[Math.round(normalize(deg) / 22.5) % 16] ?? null
}

/**
 * Dereceyi 8 ana yönden birine çevirir (45° dilimler; K = 337,5°–22,5°). Sade görünüm rüzgârı bu
 * yönleri yazar ("Kuzeydoğudan"); sınır saat yönündeki dilime gider (22,5° → NE).
 */
export function compassKey8(deg: number): CompassPoint8 | null {
  if (!Number.isFinite(deg)) return null
  return COMPASS_POINTS_8[Math.round(normalize(deg) / 45) % 8] ?? null
}
