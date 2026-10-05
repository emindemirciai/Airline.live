import {
  ensureTrackPartitions,
  readArrivalCoverageStations,
  type ArrivalCoverageStationRow,
  type Database,
} from '@havayolu/db'
import { destinationPoint, initialBearing, type LatLon } from '@havayolu/geo'
import { trackSourceCode } from '@havayolu/providers'
import { ARRIVAL_GEOID_FT_PER_M, resolveArrivalGeoid } from '@havayolu/shared'

/**
 * Kapsama raporunun örnek verisi (D-098; yalnızca yerel geliştirme, e2e ve entegrasyon testi):
 * LTAI (Antalya) için üç kapanmış sentetik varış. Replay'in `cruise` senaryosu LTAI'ye yaklaşma
 * uçurmaz (LTFM'nin sonsuz son yaklaşması yerde örneği olmayan varış sayılır), bu yüzden LTAI'nin
 * satırı yalnızca bu fixture'dan gelir ve geoid yedek tablosunu (27,36 m) da sınar.
 *
 * - `e2e0a1`: 3 sa önce, 3° süzülüşle eşiğe iner, pistte 8 yerde örneği → yerde örneği var.
 * - `e2e0a2`: 2 sa 40 dk önce, eşiğe 1,5 km kala (~310 ft AGL) kayıt biter → `lost_low`.
 * - `e2e0a3`: 2 sa 20 dk önce, eşiğe 3 km kala (~570 ft AGL) kayıt biter → `lost_low`.
 *
 * Beklenen rapor: 3 varış, yerde örneği 1/3 (%33,3) → kural 1 uygulanır (Wilson aralığı %70'i
 * içerir: "sınırda"; 3 < 20: "az örnek"); son havadaki örneğin medyan AGL'si ~310 ft ve eşiğe
 * medyan mesafe ~1,5 km → kural 2 uygulanmaz. Uçuşlar `ended`'dır ve son örnekleri 2 saatten
 * eskidir: kapanma payı (30 dk) ve pencere sonu (45 dk) içinde kalır, 6 saatlik rapor da sayar.
 *
 * İstasyon, eşikler ve alan yüksekliği veritabanından okunur (raporun kendi okuyucusu,
 * `readArrivalCoverageStations`): pist seçimi ve mesafeler raporla aynı veriye dayanır. Hex'ler
 * açıkça sentetiktir; çağrı kodu ve tescil yazılmaz.
 */

export const ARRIVAL_FIXTURE_ICAO = 'LTAI'
export const ARRIVAL_FIXTURE_HEXES = ['e2e0a1', 'e2e0a2', 'e2e0a3'] as const

/** Pist eşiğinden yaklaşmanın başladığı uzaklık (km); ARP'a ~16 km, ilk örnekler nitelikli değildir. */
export const FIXTURE_APPROACH_START_KM = 14
/** Eşik geçiş yüksekliği (ft) ve 3° süzülüş: AGL = 50 + km × 171,9. */
export const FIXTURE_THRESHOLD_CROSSING_FT = 50
export const FIXTURE_GLIDE_FT_PER_KM = Math.tan((3 * Math.PI) / 180) * 1000 * 3.28084
/** Yaklaşma hızı ≈ 140 kt; örnek aralığı ingest'in ince iz aralığı gibi 5 sn. */
export const FIXTURE_APPROACH_SPEED_KT = 140
export const FIXTURE_STEP_S = 5
/** 3° süzülüşte 140 kt'nin dikey hızı (≈ −740 fpm); barometrik ve görünen dikey hız aynı. */
export const FIXTURE_DESCENT_FPM = -740

const MPS_PER_KT = 1852 / 3600
const STEP_KM = (FIXTURE_APPROACH_SPEED_KT * MPS_PER_KT * FIXTURE_STEP_S) / 1000
const MINUTE_MS = 60_000
/** Yaklaşma örneklerinin `seen_pos` değerleri (sn) sırayla döner: dağılım boş kalmasın. */
const SEEN_POS_CYCLE = [0.2, 0.6, 1.1, 2.4, 0.4, 7.5] as const
/** Pistte yerde örnekleri: eşikten 0,45 km'den 1,6 km'ye, 120 kt'den 40 kt'ye. */
const ROLLOUT = { count: 8, fromKm: 0.45, toKm: 1.6, fromKt: 120, toKt: 40 } as const

export interface FixtureProfile {
  hex: (typeof ARRIVAL_FIXTURE_HEXES)[number]
  /** Yaklaşmanın başlangıcı, şimdiden önce (dk). */
  startAgoMin: number
  /** Son havadaki örneğin eşiğe uzaklığı (km). */
  endKm: number
  ground: boolean
}

export const ARRIVAL_FIXTURE_PROFILES: readonly FixtureProfile[] = [
  { hex: 'e2e0a1', startAgoMin: 180, endKm: 0, ground: true },
  { hex: 'e2e0a2', startAgoMin: 160, endKm: 1.5, ground: false },
  { hex: 'e2e0a3', startAgoMin: 140, endKm: 3, ground: false },
]

/** Fixture'ın kurulduğu istasyon: ARP, alan yüksekliği, geoid ve iniş yapılan pist. */
export interface FixtureStation {
  icao: string
  arp: LatLon
  elevationFt: number
  /** Örneklerin `alt_geom`'u için (istasyon değeri ya da yedek tablo); null ise `alt_geom` yazılmaz. */
  geoidM: number | null
  /** İniş eşiği (pistin `le` ucu) ve pistin öbür ucu. */
  landing: LatLon & { ident: string | null }
  far: LatLon
}

/** Fixture'ın bir iz örneği (`track_points_fine` satırı; uçuş kimliği yazımda verilir). */
export interface FixtureSample {
  ts: number
  lat: number
  lon: number
  altBaroFt: number | null
  altGeomFt: number | null
  gsKt: number
  trackDeg: number
  verticalRateFpm: number | null
  baroRateFpm: number | null
  onGround: boolean
  source: number
  seenPosS: number
}

export interface FixtureFlight {
  hex: string
  firstSeenAt: number
  lastSeenAt: number
  samples: FixtureSample[]
}

const ADSB_SOURCE = trackSourceCode('adsbLol', 'adsb_icao')

/**
 * Veritabanındaki istasyon satırından fixture istasyonu: iki ucu da gerçek eşik (`arp_fallback`
 * değil) olan, kimliği en küçük gizli olmayan pist; iniş `le` ucuna yapılır. Böyle pist yoksa ya da
 * alan yüksekliği bilinmiyorsa null.
 */
export function fixtureStationFromRow(row: ArrivalCoverageStationRow): FixtureStation | null {
  if (row.elevationFt === null) return null
  const runways = new Map<number, ArrivalCoverageStationRow['thresholds']>()
  for (const t of row.thresholds) {
    const list = runways.get(t.runwayId) ?? []
    list.push(t)
    runways.set(t.runwayId, list)
  }
  const ids = [...runways.keys()].sort((a, b) => a - b)
  for (const id of ids) {
    const ends = runways.get(id) ?? []
    const le = ends.find((t) => t.end === 'le')
    const he = ends.find((t) => t.end === 'he')
    if (!le || !he || le.source === 'arp_fallback' || he.source === 'arp_fallback') continue
    return {
      icao: row.icao,
      arp: { lat: row.lat, lon: row.lon },
      elevationFt: row.elevationFt,
      geoidM: resolveArrivalGeoid(row.icao, row.geoidUndulationM).geoidM,
      landing: { lat: le.lat, lon: le.lon, ident: le.ident },
      far: { lat: he.lat, lon: he.lon },
    }
  }
  return null
}

const round1 = (value: number) => Math.round(value * 10) / 10

/** Bir profilin örnekleri: eşiğe `endKm` kalana kadar 3° yaklaşma, istenirse pistte yerde örnekleri. */
export function buildFixtureFlight(
  station: FixtureStation,
  profile: FixtureProfile,
  nowMs: number,
): FixtureFlight {
  const outbound = initialBearing(station.far, station.landing)
  const landingTrack = initialBearing(station.landing, station.far)
  const geoidFt = station.geoidM === null ? null : station.geoidM * ARRIVAL_GEOID_FT_PER_M
  const startTs = nowMs - profile.startAgoMin * MINUTE_MS
  const samples: FixtureSample[] = []
  const distances: number[] = []
  for (let km = FIXTURE_APPROACH_START_KM; km > profile.endKm + 1e-9; km -= STEP_KM) {
    distances.push(km)
  }
  distances.push(profile.endKm)
  distances.forEach((km, i) => {
    const p = destinationPoint(station.landing, outbound, km)
    const altBaroFt = Math.round(
      station.elevationFt + FIXTURE_THRESHOLD_CROSSING_FT + km * FIXTURE_GLIDE_FT_PER_KM,
    )
    samples.push({
      ts: startTs + i * FIXTURE_STEP_S * 1000,
      lat: p.lat,
      lon: p.lon,
      altBaroFt,
      altGeomFt: geoidFt === null ? null : Math.round(altBaroFt + geoidFt),
      gsKt: FIXTURE_APPROACH_SPEED_KT,
      trackDeg: round1(landingTrack),
      verticalRateFpm: FIXTURE_DESCENT_FPM,
      baroRateFpm: FIXTURE_DESCENT_FPM,
      onGround: false,
      source: ADSB_SOURCE,
      seenPosS: SEEN_POS_CYCLE[i % SEEN_POS_CYCLE.length] as number,
    })
  })
  if (profile.ground) {
    const firstGroundTs = startTs + distances.length * FIXTURE_STEP_S * 1000
    for (let i = 0; i < ROLLOUT.count; i += 1) {
      const f = i / (ROLLOUT.count - 1)
      const p = destinationPoint(
        station.landing,
        landingTrack,
        ROLLOUT.fromKm + (ROLLOUT.toKm - ROLLOUT.fromKm) * f,
      )
      samples.push({
        ts: firstGroundTs + i * FIXTURE_STEP_S * 1000,
        lat: p.lat,
        lon: p.lon,
        altBaroFt: null,
        altGeomFt: null,
        gsKt: Math.round(ROLLOUT.fromKt + (ROLLOUT.toKt - ROLLOUT.fromKt) * f),
        trackDeg: round1(landingTrack),
        verticalRateFpm: null,
        baroRateFpm: null,
        onGround: true,
        source: ADSB_SOURCE,
        seenPosS: SEEN_POS_CYCLE[i % SEEN_POS_CYCLE.length] as number,
      })
    }
  }
  const first = samples[0] as FixtureSample
  const last = samples[samples.length - 1] as FixtureSample
  return { hex: profile.hex, firstSeenAt: first.ts, lastSeenAt: last.ts, samples }
}

/** Üç fixture uçuşu (`ARRIVAL_FIXTURE_PROFILES` sırasıyla). */
export function buildArrivalFixture(station: FixtureStation, nowMs: number): FixtureFlight[] {
  return ARRIVAL_FIXTURE_PROFILES.map((profile) => buildFixtureFlight(station, profile, nowMs))
}

type Sql = Database['sql']

export interface FixtureCleanResult {
  flights: number
  samples: number
}

export interface FixtureSeedResult {
  station: FixtureStation
  removed: FixtureCleanResult
  flights: number
  samples: number
  /** Örneklerin zaman aralığı (epoch ms). */
  from: number
  to: number
}

export class ArrivalFixtureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArrivalFixtureError'
  }
}

/** Fixture hex'lerinin uçuşlarını ve iki iz tablosundaki örneklerini siler (başka satıra dokunmaz). */
export async function cleanArrivalFixture(sql: Sql): Promise<FixtureCleanResult> {
  return sql.begin(async (tx) => {
    const hexes = [...ARRIVAL_FIXTURE_HEXES]
    let samples = 0
    for (const table of ['track_points_fine', 'track_points_sampled'] as const) {
      const result = await tx`
        delete from ${tx(table)}
        where flight_id in (select id from flights where hex in ${tx(hexes)})`
      samples += result.count
    }
    const flights = await tx`delete from flights where hex in ${tx(hexes)}`
    return { flights: flights.count, samples }
  })
}

/**
 * Fixture'ı yazar: önce eski fixture satırlarını siler (idempotent), günlük iz partition'larının
 * açık olduğundan emin olur, sonra üç `ended` uçuşu ve örneklerini tek işlemde ekler. LTAI'nin
 * istasyon ya da havalimanı satırı yoksa (`pnpm db:migrate` ve referans verisi içe aktarımı
 * yapılmamışsa) `ArrivalFixtureError` fırlatır.
 */
export async function seedArrivalFixture(sql: Sql, nowMs: number): Promise<FixtureSeedResult> {
  const rows = await readArrivalCoverageStations(sql)
  const row = rows.find((r) => r.icao === ARRIVAL_FIXTURE_ICAO)
  if (row === undefined) {
    throw new ArrivalFixtureError(
      `${ARRIVAL_FIXTURE_ICAO} etkin istasyon değil ya da havalimanı satırı yok: pnpm db:migrate çalıştır ve worker'ın jobs rolünün referans verisini içe aktarmasını bekle (pnpm dev)`,
    )
  }
  const station = fixtureStationFromRow(row)
  if (station === null) {
    throw new ArrivalFixtureError(
      `${ARRIVAL_FIXTURE_ICAO} için alan yüksekliği ya da iki ucu gerçek eşik olan pist yok (OurAirports referans verisi)`,
    )
  }
  const removed = await cleanArrivalFixture(sql)
  await ensureTrackPartitions(sql, new Date(nowMs))
  const flights = buildArrivalFixture(station, nowMs)
  const samples = await sql.begin(async (tx) => {
    let inserted = 0
    for (const flight of flights) {
      const [created] = await tx<{ id: string }[]>`
        insert into flights (hex, first_seen_at, last_seen_at, status)
        values (${flight.hex}, ${new Date(flight.firstSeenAt).toISOString()}::timestamptz,
          ${new Date(flight.lastSeenAt).toISOString()}::timestamptz, 'ended')
        returning id`
      if (!created) throw new ArrivalFixtureError('flights insert returned no id')
      const flightId = Number(created.id)
      const values = flight.samples.map((s) => ({
        flight_id: flightId,
        ts: new Date(s.ts).toISOString(),
        lat: s.lat,
        lon: s.lon,
        alt_baro_ft: s.altBaroFt,
        alt_geom_ft: s.altGeomFt,
        gs_kt: s.gsKt,
        track_deg: s.trackDeg,
        vertical_rate_fpm: s.verticalRateFpm,
        on_ground: s.onGround,
        source: s.source,
        seen_pos_s: s.seenPosS,
        baro_rate_fpm: s.baroRateFpm,
      }))
      const result = await tx`insert into track_points_fine ${tx(values)}`
      inserted += result.count
    }
    return inserted
  })
  const all = flights.flatMap((f) => f.samples)
  return {
    station,
    removed,
    flights: flights.length,
    samples,
    from: Math.min(...all.map((s) => s.ts)),
    to: Math.max(...all.map((s) => s.ts)),
  }
}
