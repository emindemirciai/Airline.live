import type { ArrivalCoverageStationRow, NearbyAirfieldRow } from '@havayolu/db'
import { distanceKm, type LatLon } from '@havayolu/geo'
import { decodeTrackSource, isLowWeightSource } from '@havayolu/providers'
import {
  ARRIVAL_ARP_KM,
  ARRIVAL_BARO_RATE_BELOW_FPM,
  ARRIVAL_GEOID_FT_PER_M,
  ARRIVAL_GROUND_ARP_KM,
  ARRIVAL_LEFT_ZONE_GAP_FACTOR,
  ARRIVAL_LEFT_ZONE_MIN_MS,
  ARRIVAL_MAX_ABOVE_FIELD_FT,
  ARRIVAL_ZONE_KM,
  median,
  resolveArrivalGeoid,
  type ArrivalAglMethod,
  type ArrivalCoverageAirfield,
  type ArrivalCoverageRecord,
  type ArrivalCoverageSample,
  type ArrivalCoverageStation,
  type ArrivalCoverageThreshold,
  type ArrivalGeomOnlyObservation,
  type ArrivalNoGroundClass,
  type ArrivalObservation,
  type ArrivalRecordClassification,
  type ArrivalThresholdSource,
} from '@havayolu/shared'

/**
 * Kapsama raporunun saf sınıflandırıcısı (Parça 1 M7b.2, D-098): bir uçuş kaydının örneklerinden
 * istasyon başına varış gözlemi çıkarır. Tanımlar `@havayolu/shared` `arrival-coverage.ts`'tedir:
 * - **Nitelikli örnek:** havada, `alt_baro` dolu ve `≤ alan + 3.000 ft` (alan yoksa 0), ham
 *   `baro_rate < −300 fpm` (boşsa sayılmaz; yalnızca geometrik hız sayılmaz), ARP'a ≤ 15 km
 *   (haversine, dahil). İlk nitelikli örnek varış zamanıdır; kayıt istasyon başına bir kez sayılır
 *   (pas geçme ikinci varış değildir).
 * - **Yerde örneği:** aynı kayıtta ilk nitelikli örnekten sonra, ARP'a ≤ 6 km içinde yerde.
 *   Öncesindeki yer örnekleri (aynı kayıttaki kalkış) sayılmaz.
 * - **Son havadaki örnek:** ilk nitelikli örnekten başlayıp ilk yerde örneğinden (yoksa kaydın
 *   sonundan) önceki, istasyonun 30 km bölgesindeki son havadaki örnek. İlk nitelikli örneğin
 *   kendisi bu koşulu sağladığı için her varışta vardır.
 * - **AGL:** `geoid` (alt_geom ve N varsa: `alt_geom − N × 3,28084 − alan`), yoksa `baro_tolerant`
 *   (`alt_baro − alan`, ±300 ft). İşaret korunur.
 * - **Pist eşiği mesafesi:** `arp_fallback` olmayan en yakın eşik; yalnızca yedek eşik varsa ARP.
 * - **Yerde örneği yoksa sınıf:** son havadaki örnek başka bir bilinen alana istasyonun eşiğinden
 *   yakınsa `other_field`; kayıt son havadaki örnekten `max(120 sn, 3 × medyan aralık)` sonra hâlâ
 *   görüldüyse `left_zone`; değilse `lost_low` (alçakta kayboldu).
 *
 * Gözlemler hex, çağrı kodu ya da tescil taşımaz. Saf modüldür: IO ve saat yoktur.
 */

export interface ArrivalClassifyOptions {
  /** `flights.last_seen_at` bundan sonraysa kayıt açıktır (`window.closedCutoff`). */
  closedCutoffTs: number
}

const point = (s: { lat: number; lon: number }): LatLon => ({ lat: s.lat, lon: s.lon })

/** Ham baro dikey hız ve irtifa koşulu dışında varış örneği koşulları (havada, irtifa, mesafe). */
function arrivalGeometry(s: ArrivalCoverageSample, station: ArrivalCoverageStation, arpKm: number) {
  return (
    !s.onGround &&
    s.altBaroFt !== null &&
    s.altBaroFt <= (station.elevationFt ?? 0) + ARRIVAL_MAX_ABOVE_FIELD_FT &&
    arpKm <= ARRIVAL_ARP_KM
  )
}

/** Örnek bu istasyon için nitelikli mi (varış tanımının üç koşulu birlikte)? */
export function isArrivalQualifyingSample(
  s: ArrivalCoverageSample,
  station: ArrivalCoverageStation,
  arpKm: number = distanceKm(point(s), station.arp),
): boolean {
  return (
    s.baroRateFpm !== null &&
    s.baroRateFpm < ARRIVAL_BARO_RATE_BELOW_FPM &&
    arrivalGeometry(s, station, arpKm)
  )
}

/**
 * Duyarlılık satırı: baro boşken görünen (geometrik) dikey hızla nitelikli olurdu. Başlık
 * rakamları bunu saymaz.
 */
export function isGeomOnlyQualifyingSample(
  s: ArrivalCoverageSample,
  station: ArrivalCoverageStation,
  arpKm: number = distanceKm(point(s), station.arp),
): boolean {
  return (
    s.baroRateFpm === null &&
    s.verticalRateFpm !== null &&
    s.verticalRateFpm < ARRIVAL_BARO_RATE_BELOW_FPM &&
    arrivalGeometry(s, station, arpKm)
  )
}

/** Yerde örneği konumu: yerde ve ARP'a ≤ 6 km (zaman koşulu çağıranda). */
export function isStationGroundSample(
  s: ArrivalCoverageSample,
  station: ArrivalCoverageStation,
  arpKm: number = distanceKm(point(s), station.arp),
): boolean {
  return s.onGround && arpKm <= ARRIVAL_GROUND_ARP_KM
}

/** Örneğin AGL'si (prompt tanımı) ve yönteminden bağımsız baro AGL'si; işaret korunur. */
export function arrivalAgl(
  s: Pick<ArrivalCoverageSample, 'altBaroFt' | 'altGeomFt'>,
  station: Pick<ArrivalCoverageStation, 'elevationFt' | 'geoidM'>,
): { aglFt: number | null; method: ArrivalAglMethod | null; baroAglFt: number | null } {
  const elevation = station.elevationFt ?? 0
  const baroAglFt = s.altBaroFt === null ? null : s.altBaroFt - elevation
  if (s.altGeomFt !== null && station.geoidM !== null) {
    return {
      aglFt: s.altGeomFt - station.geoidM * ARRIVAL_GEOID_FT_PER_M - elevation,
      method: 'geoid',
      baroAglFt,
    }
  }
  if (baroAglFt !== null) return { aglFt: baroAglFt, method: 'baro_tolerant', baroAglFt }
  return { aglFt: null, method: null, baroAglFt: null }
}

/**
 * En yakın pist eşiğine mesafe: `arp_fallback` olmayan eşikler arasında; hiç yoksa ARP'a mesafe
 * (`fallback: true`).
 */
export function nearestThresholdKm(
  p: LatLon,
  station: Pick<ArrivalCoverageStation, 'arp' | 'thresholds'>,
): { km: number; fallback: boolean } {
  let best: number | null = null
  for (const t of station.thresholds) {
    if (t.source === 'arp_fallback') continue
    const km = distanceKm(p, t)
    if (best === null || km < best) best = km
  }
  return best === null
    ? { km: distanceKm(p, station.arp), fallback: true }
    : { km: best, fallback: false }
}

/** En yakın diğer bilinen alana mesafe; liste boşsa null. */
export function nearestAirfieldKm(
  p: LatLon,
  airfields: readonly ArrivalCoverageAirfield[],
): number | null {
  let best: number | null = null
  for (const a of airfields) {
    const km = distanceKm(p, a)
    if (best === null || km < best) best = km
  }
  return best
}

/** Ardışık örnekler arasındaki aralıkların medyanı (sn); 2'den az örnekte null. */
export function medianSampleGapS(
  samples: readonly Pick<ArrivalCoverageSample, 'ts'>[],
): number | null {
  if (samples.length < 2) return null
  const gaps: number[] = []
  for (let i = 1; i < samples.length; i += 1) {
    gaps.push(
      ((samples[i] as ArrivalCoverageSample).ts - (samples[i - 1] as ArrivalCoverageSample).ts) /
        1000,
    )
  }
  return median(gaps)
}

/** Konum kaynağı kodu düşük ağırlıklı mı (mlat, tisb_*, other, bilinmeyen; çözülemeyen kod da)? */
export function isLowWeightSourceCode(code: number): boolean {
  const decoded = decodeTrackSource(code)
  return decoded === null || isLowWeightSource(decoded.positionSource)
}

/** Örnekler `ts`'e göre artan değilse sıralı bir kopya döner. */
function sortedSamples(
  samples: readonly ArrivalCoverageSample[],
): readonly ArrivalCoverageSample[] {
  for (let i = 1; i < samples.length; i += 1) {
    if ((samples[i] as ArrivalCoverageSample).ts < (samples[i - 1] as ArrivalCoverageSample).ts) {
      return [...samples].sort((a, b) => a.ts - b.ts)
    }
  }
  return samples
}

/** Yerde örneği yoksa sınıf (öncelik: other_field, left_zone, lost_low). */
export function noGroundClass(params: {
  lastAirborneTs: number
  thresholdKm: number
  otherFieldKm: number | null
  recordLastSeenTs: number
  medianGapS: number | null
}): ArrivalNoGroundClass {
  if (params.otherFieldKm !== null && params.otherFieldKm < params.thresholdKm) return 'other_field'
  const slackMs = Math.max(
    ARRIVAL_LEFT_ZONE_MIN_MS,
    ARRIVAL_LEFT_ZONE_GAP_FACTOR * (params.medianGapS ?? 0) * 1000,
  )
  if (params.recordLastSeenTs > params.lastAirborneTs + slackMs) return 'left_zone'
  return 'lost_low'
}

/** Kaydın bir istasyondaki varış gözlemi; nitelikli örnek yoksa null. */
export function classifyArrivalAtStation(
  record: ArrivalCoverageRecord,
  station: ArrivalCoverageStation,
  options: ArrivalClassifyOptions,
): ArrivalObservation | null {
  return classifyWith(record, station, options, sortedSamples(record.samples))
}

function arpDistances(
  samples: readonly ArrivalCoverageSample[],
  station: ArrivalCoverageStation,
): number[] {
  return samples.map((s) => distanceKm(point(s), station.arp))
}

function classifyWith(
  record: ArrivalCoverageRecord,
  station: ArrivalCoverageStation,
  options: ArrivalClassifyOptions,
  samples: readonly ArrivalCoverageSample[],
  distances: readonly number[] = arpDistances(samples, station),
): ArrivalObservation | null {
  const n = samples.length
  const at = (i: number) => samples[i] as ArrivalCoverageSample
  const km = (i: number) => distances[i] as number

  let firstQual = -1
  for (let i = 0; i < n; i += 1) {
    if (isArrivalQualifyingSample(at(i), station, km(i))) {
      firstQual = i
      break
    }
  }
  if (firstQual < 0) return null

  let firstGround = -1
  for (let i = firstQual + 1; i < n; i += 1) {
    if (isStationGroundSample(at(i), station, km(i))) {
      firstGround = i
      break
    }
  }

  const end = firstGround < 0 ? n : firstGround
  let last = firstQual
  for (let i = end - 1; i >= firstQual; i -= 1) {
    if (!at(i).onGround && km(i) <= ARRIVAL_ZONE_KM) {
      last = i
      break
    }
  }
  const la = at(last)
  const agl = arrivalAgl(la, station)
  const threshold = nearestThresholdKm(point(la), station)
  const otherFieldKm = nearestAirfieldKm(point(la), station.nearbyAirfields)
  const gapS = medianSampleGapS(samples)

  const seenPosS: number[] = []
  let seenPosUnknown = 0
  let zoneSamples = 0
  let lowWeightZoneSamples = 0
  for (let i = 0; i < n; i += 1) {
    if (km(i) > ARRIVAL_ZONE_KM) continue
    const s = at(i)
    zoneSamples += 1
    if (s.seenPosS === null || !Number.isFinite(s.seenPosS)) seenPosUnknown += 1
    else seenPosS.push(s.seenPosS)
    if (isLowWeightSourceCode(s.source)) lowWeightZoneSamples += 1
  }

  const groundSeen = firstGround >= 0
  return {
    icao: station.icao,
    firstQualTs: at(firstQual).ts,
    recordClosed: record.lastSeenTs <= options.closedCutoffTs,
    groundSeen,
    firstGroundTs: groundSeen ? at(firstGround).ts : null,
    noGround: groundSeen
      ? null
      : noGroundClass({
          lastAirborneTs: la.ts,
          thresholdKm: threshold.km,
          otherFieldKm,
          recordLastSeenTs: record.lastSeenTs,
          medianGapS: gapS,
        }),
    lastAirborne: {
      ts: la.ts,
      altBaroFt: la.altBaroFt,
      altGeomFt: la.altGeomFt,
      aglFt: agl.aglFt,
      aglMethod: agl.method,
      baroAglFt: agl.baroAglFt,
      thresholdKm: threshold.km,
      thresholdFallback: threshold.fallback,
      arpKm: km(last),
      otherFieldKm,
      lowWeightSource: isLowWeightSourceCode(la.source),
    },
    seenPosS,
    seenPosUnknown,
    zoneSamples,
    lowWeightZoneSamples,
    medianGapS: gapS,
  }
}

/**
 * Duyarlılık: kayıt bu istasyonda baro kuralıyla nitelikli değil ama baro boşken görünen dikey
 * hızla nitelikli olurdu. Yerde örneği aynı kuralla (sonraki, ≤ 6 km) aranır; yoksa null.
 */
export function classifyGeomOnlyAtStation(
  record: ArrivalCoverageRecord,
  station: ArrivalCoverageStation,
  options: ArrivalClassifyOptions,
): ArrivalGeomOnlyObservation | null {
  const samples = sortedSamples(record.samples)
  return geomOnlyWith(record, station, options, samples, arpDistances(samples, station))
}

function geomOnlyWith(
  record: ArrivalCoverageRecord,
  station: ArrivalCoverageStation,
  options: ArrivalClassifyOptions,
  samples: readonly ArrivalCoverageSample[],
  distances: readonly number[],
): ArrivalGeomOnlyObservation | null {
  const n = samples.length
  const at = (i: number) => samples[i] as ArrivalCoverageSample
  const km = (i: number) => distances[i] as number
  for (let i = 0; i < n; i += 1) {
    if (isArrivalQualifyingSample(at(i), station, km(i))) return null
  }
  let first = -1
  for (let i = 0; i < n; i += 1) {
    if (isGeomOnlyQualifyingSample(at(i), station, km(i))) {
      first = i
      break
    }
  }
  if (first < 0) return null
  let groundSeen = false
  for (let i = first + 1; i < n; i += 1) {
    if (isStationGroundSample(at(i), station, km(i))) {
      groundSeen = true
      break
    }
  }
  return {
    icao: station.icao,
    firstQualTs: at(first).ts,
    recordClosed: record.lastSeenTs <= options.closedCutoffTs,
    groundSeen,
  }
}

/**
 * Kaydın bütün istasyonlardaki varışları (istasyon başına en çok bir) ve yalnızca geometrik hızla
 * nitelikli olduğu istasyonlar. Sıra istasyon listesinin sırasıdır.
 */
export function classifyArrivalRecord(
  record: ArrivalCoverageRecord,
  stations: readonly ArrivalCoverageStation[],
  options: ArrivalClassifyOptions,
): ArrivalRecordClassification {
  const samples = sortedSamples(record.samples)
  const arrivals: ArrivalObservation[] = []
  const geomOnly: ArrivalGeomOnlyObservation[] = []
  for (const station of stations) {
    const distances = arpDistances(samples, station)
    let near = false
    for (const d of distances) {
      if (d <= ARRIVAL_ARP_KM) {
        near = true
        break
      }
    }
    if (!near) continue
    const arrival = classifyWith(record, station, options, samples, distances)
    if (arrival !== null) {
      arrivals.push(arrival)
      continue
    }
    const geom = geomOnlyWith(record, station, options, samples, distances)
    if (geom !== null) geomOnly.push(geom)
  }
  return { arrivals, geomOnly }
}

const THRESHOLD_SOURCES: readonly ArrivalThresholdSource[] = [
  'runway_end',
  'displaced_threshold',
  'arp_fallback',
  'override',
]

const asThresholdSource = (value: string): ArrivalThresholdSource =>
  (THRESHOLD_SOURCES as readonly string[]).includes(value)
    ? (value as ArrivalThresholdSource)
    : 'arp_fallback'

/**
 * Veritabanı satırlarından sınıflandırıcının istasyonu: geoid `resolveArrivalGeoid` ile (istasyon
 * değeri, yoksa yedek tablo), eşikler ve istasyona ait yakın alanlar.
 */
export function coverageStationFromRow(
  row: ArrivalCoverageStationRow,
  airfields: readonly NearbyAirfieldRow[],
): ArrivalCoverageStation {
  const geoid = resolveArrivalGeoid(row.icao, row.geoidUndulationM)
  const thresholds: ArrivalCoverageThreshold[] = row.thresholds.map((t) => ({
    lat: t.lat,
    lon: t.lon,
    source: asThresholdSource(t.source),
    elevationFt: t.elevationFt,
    ident: t.ident,
  }))
  return {
    icao: row.icao,
    iata: row.iata,
    arp: { lat: row.lat, lon: row.lon },
    elevationFt: row.elevationFt,
    geoidM: geoid.geoidM,
    geoidSource: geoid.source,
    thresholds,
    nearbyAirfields: airfields
      .filter((a) => a.stationIcao === row.icao)
      .map((a) => ({ ident: a.ident, lat: a.lat, lon: a.lon })),
  }
}

/** `coverageStationFromRow` her istasyon için (sıra korunur). */
export function coverageStationsFromRows(
  rows: readonly ArrivalCoverageStationRow[],
  airfields: readonly NearbyAirfieldRow[],
): ArrivalCoverageStation[] {
  return rows.map((row) => coverageStationFromRow(row, airfields))
}
