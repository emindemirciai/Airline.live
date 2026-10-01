import { toDate, type DateInput } from './time'

/**
 * Gözlem yaşı sınıfı (brief §5): `fresh` ≤ 90 dk normal; `delayed` 90 dk–3 sa "gecikmiş gözlem";
 * `stale` 3–12 sa "eski gözlem" (değerler katlanır); `none` 12 saatten eski ya da gözlem yok
 * (boş durum). İstemci her 30 sn yeniden hesaplar; sunucu yalnız mutlak saati yazar.
 */
export type MetarAgeClass = 'fresh' | 'delayed' | 'stale' | 'none'

/** Sınıf sınırları, dakika (dahil). */
export const METAR_AGE_LIMITS_MIN = { fresh: 90, delayed: 180, stale: 720 } as const

/**
 * Gözlemin yaşı, tam dakika (aşağı yuvarlanır). Gözlem yoksa null. Saat kayması yüzünden gelecekte
 * görünen gözlem 0 dakikadır.
 */
export function metarAgeMinutes(
  observedAt: DateInput | null | undefined,
  now: DateInput,
): number | null {
  if (observedAt === null || observedAt === undefined) return null
  const observed = toDate(observedAt).getTime()
  const current = toDate(now).getTime()
  if (!Number.isFinite(observed) || !Number.isFinite(current)) return null
  return Math.max(0, Math.floor((current - observed) / 60_000))
}

/** Gözlem yaşı sınıfı. */
export function metarAgeClass(
  observedAt: DateInput | null | undefined,
  now: DateInput,
): MetarAgeClass {
  const minutes = metarAgeMinutes(observedAt, now)
  if (minutes === null) return 'none'
  if (minutes <= METAR_AGE_LIMITS_MIN.fresh) return 'fresh'
  if (minutes <= METAR_AGE_LIMITS_MIN.delayed) return 'delayed'
  if (minutes <= METAR_AGE_LIMITS_MIN.stale) return 'stale'
  return 'none'
}
