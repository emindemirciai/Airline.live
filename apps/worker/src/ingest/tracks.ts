import { distanceKm, type LatLon } from '@havayolu/geo'
import type { AircraftState } from '@havayolu/providers'

/**
 * İz örnekleme (domain.md "Saklama", D-073):
 * - `track_points_sampled`: uçuş kaydı başına 30 sn'de bir örnek
 * - `track_points_fine`, geçici kural (sınıflandırma M4'te yok): herhangi bir etkin istasyonun
 *   ARP'ına ≤ 30 km ve (yerde ya da `alt_baro − alan yüksekliği < 10.000 ft`), ya da takip
 *   listesinde. Alan yüksekliği yoksa 0 alınır; irtifası bilinmeyen havadaki uçak yazılmaz.
 * - Yerde, o tabloya son yazılan noktadan 20 m'den az kıpırdayan örnek o tabloya yazılmaz.
 *
 * İmleç uçuş kaydı başınadır: yeni kayıt `emptyCursor()` ile başlar. Saf modüldür, IO yapmaz.
 */

export const SAMPLED_INTERVAL_MS = 30_000
export const FINE_ARP_KM = 30
export const FINE_MAX_AGL_FT = 10_000
export const GROUND_MIN_MOVE_M = 20

export interface FineStation {
  lat: number
  lon: number
  elevationFt: number | null
}

export interface FineContext {
  stations: readonly FineStation[]
  /** Takip listesi; küçük harf hex (`AircraftState.hex` gibi). */
  watch: ReadonlySet<string>
}

export interface TrackCursor {
  sampledTs: number | null
  sampledPos: LatLon | null
  fineTs: number | null
  finePos: LatLon | null
}

export const emptyCursor = (): TrackCursor => ({
  sampledTs: null,
  sampledPos: null,
  fineTs: null,
  finePos: null,
})

/** İnce iz adayı mı: takip listesinde ya da bir istasyonun yakınında alçakta/yerde. */
export function isFineCandidate(s: AircraftState, ctx: FineContext): boolean {
  if (ctx.watch.has(s.hex)) return true
  if (!s.onGround && s.altBaroFt === null) return false
  for (const station of ctx.stations) {
    if (distanceKm(s, station) > FINE_ARP_KM) continue
    if (s.onGround) return true
    if (s.altBaroFt !== null && s.altBaroFt - (station.elevationFt ?? 0) < FINE_MAX_AGL_FT) {
      return true
    }
  }
  return false
}

/** Yerdeki uçak son yazılan noktadan 20 m'den az mı kıpırdadı? */
function groundStill(s: AircraftState, last: LatLon | null): boolean {
  return s.onGround && last !== null && distanceKm(last, s) * 1000 < GROUND_MIN_MOVE_M
}

/**
 * Örnek hangi tablolara yazılır? sampled: ilk örnek ya da son yazılandan ≥ 30 sn sonra; fine:
 * aday ve son yazılandan yeni. Yerde, tablonun son yazılan noktasından 20 m içindeki örnek o
 * tabloya yazılmaz. Yeni imleç de döner (yazılmayan tablonun imleci değişmez).
 */
export function trackDecision(
  c: TrackCursor,
  s: AircraftState,
  ctx: FineContext,
): { sampled: boolean; fine: boolean; cursor: TrackCursor } {
  const ts = s.sampleTime
  const pos: LatLon = { lat: s.lat, lon: s.lon }
  const sampled =
    (c.sampledTs === null || ts - c.sampledTs >= SAMPLED_INTERVAL_MS) &&
    !groundStill(s, c.sampledPos)
  const fine =
    (c.fineTs === null || ts > c.fineTs) && isFineCandidate(s, ctx) && !groundStill(s, c.finePos)
  return {
    sampled,
    fine,
    cursor: {
      sampledTs: sampled ? ts : c.sampledTs,
      sampledPos: sampled ? pos : c.sampledPos,
      fineTs: fine ? ts : c.fineTs,
      finePos: fine ? pos : c.finePos,
    },
  }
}
