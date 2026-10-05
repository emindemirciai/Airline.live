import { destinationPoint, distanceKm, initialBearing, type LatLon } from '@havayolu/geo'
import { trackSourceCode } from '@havayolu/providers'
import {
  ARRIVAL_GEOID_FT_PER_M,
  type ArrivalCoverageRecord,
  type ArrivalCoverageSample,
  type ArrivalCoverageStation,
  type ArrivalLastAirborne,
  type ArrivalObservation,
} from '@havayolu/shared'

/**
 * Kapsama raporu testleri için sentetik izler (yalnızca testler ve tools/ kullanır). İstasyonlar
 * gerçek ARP ve alan yükseklikleriyle kurulur; pist eşikleri sentetiktir. Zaman sabit bir
 * başlangıçtan (`T0`) ilerler; hex, çağrı kodu ve tescil yoktur.
 */

export const T0 = Date.parse('2026-10-05T10:00:00Z')
export const ADSB = trackSourceCode('adsbLol', 'adsb_icao')
export const MLAT = trackSourceCode('adsbLol', 'mlat')

/**
 * Merkezden `bearingDeg` yönünde, haversine uzaklığı `km`'yi aşmayan en uzak nokta. Kayan nokta
 * hatası (~1e-12 km) sınırdaki noktayı dışarı itmesin diye uzaklık gerekirse çok az kısaltılır.
 */
export function pointAtKm(center: LatLon, bearingDeg: number, km: number): LatLon {
  let shrink = 0
  for (;;) {
    const p = destinationPoint(center, bearingDeg, km - shrink)
    if (distanceKm(p, center) <= km) return p
    shrink = shrink === 0 ? 1e-12 : shrink * 2
  }
}

const ARP_IST = { lat: 41.274874, lon: 28.732136 }
const ARP_SAW = { lat: 40.898602, lon: 29.3092 }
const ARP_ESB = { lat: 40.128101, lon: 32.995098 }

/** LTFM: geoid istasyonda; iki gerçek eşik (kuzeyde 2 km pist ucu, güneyde 2,5 km kaydırılmış). */
export const IST: ArrivalCoverageStation = {
  icao: 'LTFM',
  iata: 'IST',
  arp: ARP_IST,
  elevationFt: 325,
  geoidM: 37.05,
  geoidSource: 'station',
  thresholds: [
    { ...pointAtKm(ARP_IST, 0, 2), source: 'runway_end', elevationFt: 300, ident: '35' },
    {
      ...pointAtKm(ARP_IST, 180, 2.5),
      source: 'displaced_threshold',
      elevationFt: 330,
      ident: '17',
    },
  ],
  nearbyAirfields: [],
}

/** Samandıra (LTBX), SAW ARP'ının yaklaşık 13 km kuzeybatısında (OurAirports). */
export const SAMANDIRA: LatLon = { lat: 40.993, lon: 29.216499 }

/** LTFJ: geoid yedek tablodan; bir gerçek eşik; yakında Samandıra. */
export const SAW: ArrivalCoverageStation = {
  icao: 'LTFJ',
  iata: 'SAW',
  arp: ARP_SAW,
  elevationFt: 312,
  geoidM: 37.61,
  geoidSource: 'fallback',
  thresholds: [
    { ...pointAtKm(ARP_SAW, 240, 1.5), source: 'runway_end', elevationFt: 300, ident: '06' },
  ],
  nearbyAirfields: [{ ident: 'LTBX', ...SAMANDIRA }],
}

/** LTAC: geoid yok (hep baro); yalnızca ARP'a düşen yedek eşik. */
export const ESB: ArrivalCoverageStation = {
  icao: 'LTAC',
  iata: 'ESB',
  arp: ARP_ESB,
  elevationFt: 3125,
  geoidM: null,
  geoidSource: null,
  thresholds: [{ ...ARP_ESB, source: 'arp_fallback', elevationFt: null, ident: null }],
  nearbyAirfields: [],
}

/** Alan yüksekliği bilinmeyen istasyon (LTBJ ARP'ı). */
export const NO_ELEVATION: ArrivalCoverageStation = {
  icao: 'LTBJ',
  iata: 'ADB',
  arp: { lat: 38.2924, lon: 27.157 },
  elevationFt: null,
  geoidM: null,
  geoidSource: null,
  thresholds: [],
  nearbyAirfields: [],
}

/** Tek örnek: varsayılan olarak alçalan, ADS-B kaynaklı, `seen_pos` 0,5 sn. */
export function sample(
  overrides: Partial<ArrivalCoverageSample> & { ts: number; lat: number; lon: number },
): ArrivalCoverageSample {
  return {
    altBaroFt: 2000,
    altGeomFt: null,
    verticalRateFpm: -800,
    baroRateFpm: -800,
    onGround: false,
    seenPosS: 0.5,
    source: ADSB,
    ...overrides,
  }
}

/** İstasyona göre konumlu tek havadaki örnek; irtifa AGL olarak verilir (alan + agl). */
export function airborneAt(
  station: ArrivalCoverageStation,
  params: {
    ts: number
    bearingDeg: number
    km: number
    aglFt: number
    baroRateFpm?: number | null
    verticalRateFpm?: number | null
    withGeom?: boolean
    seenPosS?: number | null
    source?: number
  },
): ArrivalCoverageSample {
  const p = pointAtKm(station.arp, params.bearingDeg, params.km)
  const altBaroFt = Math.round((station.elevationFt ?? 0) + params.aglFt)
  const baro = params.baroRateFpm === undefined ? -800 : params.baroRateFpm
  return sample({
    ts: params.ts,
    lat: p.lat,
    lon: p.lon,
    altBaroFt,
    altGeomFt:
      params.withGeom && station.geoidM !== null
        ? Math.round(altBaroFt + station.geoidM * ARRIVAL_GEOID_FT_PER_M)
        : null,
    baroRateFpm: baro,
    verticalRateFpm: params.verticalRateFpm === undefined ? baro : params.verticalRateFpm,
    seenPosS: params.seenPosS === undefined ? 0.5 : params.seenPosS,
    source: params.source ?? ADSB,
  })
}

/** İstasyona göre konumlu yerdeki örnek. */
export function groundAt(
  station: ArrivalCoverageStation,
  params: { ts: number; bearingDeg: number; km: number; seenPosS?: number | null },
): ArrivalCoverageSample {
  const p = pointAtKm(station.arp, params.bearingDeg, params.km)
  return sample({
    ts: params.ts,
    lat: p.lat,
    lon: p.lon,
    altBaroFt: null,
    baroRateFpm: null,
    verticalRateFpm: null,
    onGround: true,
    seenPosS: params.seenPosS === undefined ? 0.5 : params.seenPosS,
  })
}

export interface ApproachOptions {
  station: ArrivalCoverageStation
  /** ARP'tan uçağın geldiği yöne. */
  bearingDeg: number
  startKm: number
  endKm: number
  startAglFt: number
  endAglFt: number
  startTs: number
  count: number
  stepS?: number
  baroRateFpm?: number | null
  withGeom?: boolean
  seenPosS?: number | null
}

/** Düz bir yaklaşma: uzaklık ve AGL doğrusal azalır (`count` örnek, `stepS` aralıkla). */
export function approach(o: ApproachOptions): ArrivalCoverageSample[] {
  const step = (o.stepS ?? 5) * 1000
  const out: ArrivalCoverageSample[] = []
  for (let i = 0; i < o.count; i += 1) {
    const f = o.count === 1 ? 1 : i / (o.count - 1)
    out.push(
      airborneAt(o.station, {
        ts: o.startTs + i * step,
        bearingDeg: o.bearingDeg,
        km: o.startKm + (o.endKm - o.startKm) * f,
        aglFt: o.startAglFt + (o.endAglFt - o.startAglFt) * f,
        baroRateFpm: o.baroRateFpm,
        withGeom: o.withGeom,
        seenPosS: o.seenPosS,
      }),
    )
  }
  return out
}

/** Pistte yer örnekleri: ARP'tan `bearingDeg` yönünde `fromKm`'den `toKm`'ye. */
export function rollout(
  station: ArrivalCoverageStation,
  params: {
    startTs: number
    count: number
    bearingDeg: number
    fromKm: number
    toKm: number
    stepS?: number
  },
): ArrivalCoverageSample[] {
  const step = (params.stepS ?? 5) * 1000
  const out: ArrivalCoverageSample[] = []
  for (let i = 0; i < params.count; i += 1) {
    const f = params.count === 1 ? 1 : i / (params.count - 1)
    out.push(
      groundAt(station, {
        ts: params.startTs + i * step,
        bearingDeg: params.bearingDeg,
        km: params.fromKm + (params.toKm - params.fromKm) * f,
      }),
    )
  }
  return out
}

/** İki nokta arasında düz bir uçuş (tırmanış ya da seyir); irtifa ve dikey hız sabit verilir. */
export function leg(params: {
  from: LatLon
  to: LatLon
  startTs: number
  count: number
  stepS?: number
  altBaroFt: number
  baroRateFpm: number | null
}): ArrivalCoverageSample[] {
  const step = (params.stepS ?? 5) * 1000
  const bearing = initialBearing(params.from, params.to)
  const total = distanceKm(params.from, params.to)
  const out: ArrivalCoverageSample[] = []
  for (let i = 0; i < params.count; i += 1) {
    const f = params.count === 1 ? 1 : i / (params.count - 1)
    const p = destinationPoint(params.from, bearing, total * f)
    out.push(
      sample({
        ts: params.startTs + i * step,
        lat: p.lat,
        lon: p.lon,
        altBaroFt: params.altBaroFt,
        baroRateFpm: params.baroRateFpm,
        verticalRateFpm: params.baroRateFpm,
      }),
    )
  }
  return out
}

/** Örneklerden kayıt; `lastSeenTs` verilmezse son örneğin zamanı. */
export function record(
  samples: readonly ArrivalCoverageSample[],
  lastSeenTs?: number,
): ArrivalCoverageRecord {
  const last = samples.reduce((max, s) => Math.max(max, s.ts), Number.NEGATIVE_INFINITY)
  return { lastSeenTs: lastSeenTs ?? last, samples }
}

/** Toplayıcı testleri için doğrudan gözlem (sınıflandırıcıyı atlar). */
export function observation(
  overrides: Partial<Omit<ArrivalObservation, 'lastAirborne'>> & {
    lastAirborne?: Partial<ArrivalLastAirborne>
  } = {},
): ArrivalObservation {
  const { lastAirborne, ...rest } = overrides
  return {
    icao: 'LTFM',
    firstQualTs: T0,
    recordClosed: true,
    groundSeen: false,
    firstGroundTs: null,
    noGround: 'lost_low',
    seenPosS: [],
    seenPosUnknown: 0,
    zoneSamples: 0,
    lowWeightZoneSamples: 0,
    medianGapS: 5,
    ...rest,
    lastAirborne: {
      ts: T0 + 60_000,
      altBaroFt: 825,
      altGeomFt: null,
      aglFt: 500,
      aglMethod: 'geoid',
      baroAglFt: 500,
      thresholdKm: 2,
      thresholdFallback: false,
      arpKm: 3,
      otherFieldKm: null,
      lowWeightSource: false,
      ...lastAirborne,
    },
  }
}
