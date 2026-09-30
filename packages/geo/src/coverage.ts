import {
  circleContainsPoint,
  destinationPoint,
  distanceKm,
  initialBearing,
  kmToNm,
  nmToKm,
  type LatLon,
} from './index'

/**
 * Canlı veri çekiminin kapsama planı (data-sources.md §1 "Kapsama planı ve öncelikler", D-073).
 * Worker'ın istek zamanlayıcısı (apps/worker/src/ingest/plan.ts) bu planı çeker; web, havalimanı
 * sayfasında havalimanının çekim alanında olup olmadığını aynı planla söyler (D-076).
 *
 * Plan:
 * - P0 istasyon çemberlerinden (ARP merkezli, `fetchRadiusNm`) en az birini içeriyorsa batı çemberi
 * - batıya sığmayan istasyonlar için ayrı çember; iki istasyon ≤ 250 NM'lik tek çembere sığıyorsa
 *   birleştirilir
 * - birincil istasyon için ARP merkezli 40 NM çember
 * - her zaman Doğu çemberi
 *
 * Saf modüldür, IO yapmaz. `@havayolu/geo/coverage` olarak dışa açılır.
 */

export interface CoverageCircle {
  center: LatLon
  radiusNm: number
}

/** P2 birleşik batı çemberi; tohum istasyonların P0 çemberlerini kapsar. */
export const WEST_CIRCLE: Readonly<CoverageCircle> = {
  center: { lat: 39.5, lon: 29.5 },
  radiusNm: 250,
}
/** P2 Doğu Türkiye çemberi; her planda bulunur. */
export const EAST_CIRCLE: Readonly<CoverageCircle> = {
  center: { lat: 39.2, lon: 38.8 },
  radiusNm: 250,
}
export const PRIMARY_EXTRA_RADIUS_NM = 40
/** adsb.lol `/v2/point` yarıçap sınırı (tamsayı NM). */
export const MAX_CIRCLE_NM = 250

/** İçerme hesabındaki kayan nokta payı, NM. */
const EPSILON_NM = 1e-9
/** Birleşik çember merkezi, istemcinin istek adresindeki gibi 4 ondalığa yuvarlanır (~11 m). */
const CENTER_DECIMALS = 4

export interface StationInput {
  icao: string
  lat: number
  lon: number
  fetchRadiusNm: number
  isPrimary: boolean
}

export type CircleKind = 'west' | 'station' | 'primary' | 'east'

export interface PlannedCircle {
  id: string
  kind: CircleKind
  center: { lat: number; lon: number }
  /** Tamsayı NM, 1..250. */
  radiusNm: number
  /** P0 çemberi bu çemberin tamamen içinde kalan istasyonlar (ICAO, alfabetik). */
  covers: string[]
  /** Yalnızca `primary` çemberinde: merkezdeki birincil istasyon (zamanlayıcı bununla tanır). */
  primaryIcao?: string
}

const distanceNm = (a: LatLon, b: LatLon) => kmToNm(distanceKm(a, b))

function containsCircle(outer: CoverageCircle, inner: CoverageCircle): boolean {
  return distanceNm(outer.center, inner.center) + inner.radiusNm <= outer.radiusNm + EPSILON_NM
}

/** P0 çemberi: ARP merkezli, `fetchRadiusNm` yarıçaplı; API sınırı nedeniyle en fazla 250 NM. */
function p0Circle(s: StationInput): CoverageCircle {
  const radius = Number.isFinite(s.fetchRadiusNm) ? s.fetchRadiusNm : 0
  return {
    center: { lat: s.lat, lon: s.lon },
    radiusNm: Math.min(MAX_CIRCLE_NM, Math.max(0, radius)),
  }
}

/** İstek yarıçapı: yukarı yuvarlanmış tamsayı, 1..250. */
const requestRadius = (nm: number) =>
  Math.min(MAX_CIRCLE_NM, Math.max(1, Math.ceil(nm - EPSILON_NM)))

const roundCoordinate = (value: number) => {
  const factor = 10 ** CENTER_DECIMALS
  return Math.round(value * factor) / factor
}

/**
 * İki çemberi içeren en küçük çember (büyük daire üzerinde). Merkez 4 ondalığa yuvarlanır ve
 * yarıçap yuvarlanmış merkeze göre yeniden hesaplanıp yukarı tamsayıya çekilir; iki çember de
 * kesinlikle içeride kalır. 250 NM sınırı çağıranda denetlenir.
 */
function enclosingCircle(a: CoverageCircle, b: CoverageCircle): CoverageCircle {
  const d = distanceNm(a.center, b.center)
  let center: LatLon
  if (d + b.radiusNm <= a.radiusNm) center = a.center
  else if (d + a.radiusNm <= b.radiusNm) center = b.center
  else {
    const radius = (d + a.radiusNm + b.radiusNm) / 2
    const bearing = initialBearing(a.center, b.center)
    center = destinationPoint(a.center, bearing, nmToKm(radius - a.radiusNm))
  }
  const rounded = { lat: roundCoordinate(center.lat), lon: roundCoordinate(center.lon) }
  const needed = Math.max(
    distanceNm(rounded, a.center) + a.radiusNm,
    distanceNm(rounded, b.center) + b.radiusNm,
  )
  return { center: rounded, radiusNm: Math.max(1, Math.ceil(needed - EPSILON_NM)) }
}

function planned(
  id: string,
  kind: CircleKind,
  circle: Readonly<CoverageCircle>,
  covers: string[],
): PlannedCircle {
  return {
    id,
    kind,
    center: { lat: circle.center.lat, lon: circle.center.lon },
    radiusNm: circle.radiusNm,
    covers,
  }
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Kapsama planı. Aynı ICAO iki kez gelirse ilki kullanılır; birden çok birincil varsa listedeki
 * ilki birincildir. Sıra deterministiktir: batı, istasyon çemberleri (ICAO sırasıyla), birincil,
 * Doğu. Aynı istasyon kümesi hangi sırada gelirse gelsin aynı plan çıkar.
 */
export function coveragePlan(stations: readonly StationInput[]): PlannedCircle[] {
  const seen = new Set<string>()
  const entries: { station: StationInput; p0: CoverageCircle }[] = []
  for (const station of stations) {
    if (seen.has(station.icao)) continue
    seen.add(station.icao)
    entries.push({ station, p0: p0Circle(station) })
  }
  const coveredBy = (circle: Readonly<CoverageCircle>) =>
    entries
      .filter((e) => containsCircle(circle, e.p0))
      .map((e) => e.station.icao)
      .sort(compareText)

  const plan: PlannedCircle[] = []
  const westCovers = coveredBy(WEST_CIRCLE)
  if (westCovers.length > 0) plan.push(planned('west', 'west', WEST_CIRCLE, westCovers))

  // Batıya sığmayanlar: her biri için ≤ 250 NM'de birleşebileceği en yakın ortak aranır (açgözlü).
  const outside = entries
    .filter((e) => !westCovers.includes(e.station.icao))
    .sort((a, b) => compareText(a.station.icao, b.station.icao))
  const assigned = new Set<string>()
  for (const entry of outside) {
    if (assigned.has(entry.station.icao)) continue
    let best: { circle: CoverageCircle; partner: string } | null = null
    for (const other of outside) {
      if (other === entry || assigned.has(other.station.icao)) continue
      const merged = enclosingCircle(entry.p0, other.p0)
      if (merged.radiusNm > MAX_CIRCLE_NM) continue
      if (best === null || merged.radiusNm < best.circle.radiusNm) {
        best = { circle: merged, partner: other.station.icao }
      }
    }
    const members = best
      ? [entry.station.icao, best.partner].sort(compareText)
      : [entry.station.icao]
    const circle: CoverageCircle = best
      ? best.circle
      : { center: entry.p0.center, radiusNm: requestRadius(entry.p0.radiusNm) }
    // Çemberin kendi istasyonları, P0'ı (250 NM'ye kırpıldığı için) taşsa bile kapsanmış sayılır.
    const covers = [...new Set([...members, ...coveredBy(circle)])].sort(compareText)
    for (const icao of covers) assigned.add(icao)
    plan.push(planned(`station-${members.join('-')}`, 'station', circle, covers))
  }

  const primary = entries.find((e) => e.station.isPrimary)
  if (primary) {
    const circle = { center: primary.p0.center, radiusNm: PRIMARY_EXTRA_RADIUS_NM }
    plan.push({
      ...planned('primary', 'primary', circle, coveredBy(circle)),
      primaryIcao: primary.station.icao,
    })
  }
  plan.push(planned('east', 'east', EAST_CIRCLE, coveredBy(EAST_CIRCLE)))
  return plan
}

/**
 * Nokta planın herhangi bir çemberinin içinde ya da sınırında mı? Çember dışındaki uçak için veri
 * çekilmez (takip listesindeki uçaklar hariç).
 */
export function planCoversPoint(plan: readonly PlannedCircle[], point: LatLon): boolean {
  return plan.some((circle) => circleContainsPoint(circle, point))
}
