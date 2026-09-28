import { initialBearing, type LatLon } from '@havayolu/geo'
import { AIRPORTS, LTFM_35L, type AirportCode } from './airports'
import { approachMotion, loopMotion, shuttleMotion, type Motion } from './motion'
import type { ReadsbAircraft, ReadsbFrame, Scenario } from './types'

/**
 * `cruise` senaryosu: Türkiye'deki havalimanı çiftleri arasında büyük daire üzerinde gidip gelen
 * seyir uçakları, LTFM 35L'ye döngüsel son yaklaşma yapan bir uçak ve LTFM'de yerde taksi yapan bir
 * uçak. Tamamen deterministiktir: kare, istenen anın saf fonksiyonudur.
 *
 * Kimlikler açıkça sentetiktir: hex `ff0001`…, çağrı kodu `HYS001`…, tescil `TC-SYN01`…
 * (gerçek bir uçağa ait olamayacak biçimde), dbFlags 0, kaynak `adsb_icao`.
 */

export const CRUISE_SCENARIO_NAME = 'cruise'
export const DEFAULT_CRUISE_COUNT = 8
/** Seyir uçağı numaraları 1…90; 91 yaklaşma, 92 taksi uçağıdır (kimlikler sayıdan bağımsız sabit). */
export const MAX_CRUISE_COUNT = 90
export const APPROACH_NUMBER = 91
export const TAXI_NUMBER = 92

export const CRUISE_ALTITUDE_FT = 35_000
/** Geometrik (GNSS) irtifa ile barometrik irtifa arasındaki sabit fark (standart dışı atmosfer). */
export const GEOM_OFFSET_FT = 150
/** Her karedeki konumun yaşı (`seen_pos`) ve son mesajın yaşı (`seen`), saniye. */
export const SEEN_POS_S = 0.5
export const SEEN_S = 0.2
/** Alıcının saniyede çözdüğü mesaj sayısı (`messages` sayacı zamanla artar). */
const MESSAGES_PER_SECOND = 25

export const CRUISE_ROUTES: readonly (readonly [AirportCode, AirportCode])[] = [
  ['IST', 'ESB'],
  ['IST', 'AYT'],
  ['SAW', 'ADB'],
  ['ESB', 'VAN'],
  ['ADB', 'TZX'],
  ['AYT', 'ESB'],
  ['IST', 'DIY'],
  ['SAW', 'ERZ'],
]
const CRUISE_SPEEDS_KT = [450, 458, 444, 462, 447, 455, 441, 452] as const
const CRUISE_TYPES = [
  { typeCode: 'A321', category: 'A3' },
  { typeCode: 'B738', category: 'A3' },
  { typeCode: 'A20N', category: 'A3' },
  { typeCode: 'B38M', category: 'A3' },
  { typeCode: 'A333', category: 'A5' },
  { typeCode: 'A21N', category: 'A3' },
  { typeCode: 'B77W', category: 'A5' },
  { typeCode: 'A320', category: 'A3' },
] as const
/** Altın oran eşleniği: ardışık uçakların tur içindeki başlangıç noktaları düzgün dağılır. */
const PHASE_STEP = 0.6180339887498949

/** Yaklaşma: 12 NM'den 3° süzülüşle, 180 kt'tan 140 kt'a; eşik geçişi 50 ft. */
export const APPROACH_PROFILE = {
  threshold: LTFM_35L.threshold,
  runwayBearingDeg: initialBearing(LTFM_35L.threshold, LTFM_35L.farEnd),
  thresholdElevationFt: LTFM_35L.thresholdElevationFt,
  startNm: 12,
  startKt: 180,
  thresholdKt: 140,
  glideSlopeDeg: 3,
  crossingHeightFt: 50,
} as const

/** LTFM'de 35R ile 18/36 arasındaki alanda sentetik taksi turu (≈ 3,6 km), 15 kt. */
export const TAXI_LOOP: readonly LatLon[] = [
  { lat: 41.27, lon: 28.733 },
  { lat: 41.284, lon: 28.733 },
  { lat: 41.284, lon: 28.736 },
  { lat: 41.27, lon: 28.736 },
]
export const TAXI_SPEED_KT = 15

export interface SyntheticIdentity {
  hex: string
  callsign: string
  registration: string
  squawk: string
}

/** n. sentetik uçağın kimliği; squawk sekizlik 2001…'dan başlar (7500/7600/7700'e hiç varmaz). */
export function syntheticIdentity(n: number): SyntheticIdentity {
  return {
    hex: `ff${String(n).padStart(4, '0')}`,
    callsign: `HYS${String(n).padStart(3, '0')}`,
    registration: `TC-SYN${String(n).padStart(2, '0')}`,
    squawk: (0o2000 + n).toString(8).padStart(4, '0'),
  }
}

export interface CruiseFlight extends SyntheticIdentity {
  number: number
  typeCode: string
  category: string
  from: AirportCode
  to: AirportCode
  gsKt: number
  /** Gidiş-dönüş turunun başlangıç noktası, [0, 1). */
  phase: number
}

/** Seyir uçaklarının listesi: rota, tip ve hız sırayla döner; 8'den fazlası aynı rotayı paylaşır. */
export function cruiseFleet(count: number = DEFAULT_CRUISE_COUNT): CruiseFlight[] {
  if (!Number.isInteger(count) || count < 0 || count > MAX_CRUISE_COUNT) {
    throw new RangeError(`seyir uçağı sayısı 0–${MAX_CRUISE_COUNT} arası tam sayı olmalı`)
  }
  return Array.from({ length: count }, (_, i) => {
    const [from, to] = CRUISE_ROUTES[i % CRUISE_ROUTES.length]!
    const type = CRUISE_TYPES[i % CRUISE_TYPES.length]!
    const number = i + 1
    return {
      number,
      ...syntheticIdentity(number),
      ...type,
      from,
      to,
      gsKt: CRUISE_SPEEDS_KT[i % CRUISE_SPEEDS_KT.length]!,
      phase: (i * PHASE_STEP) % 1,
    }
  })
}

const round = (value: number, digits: number) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
/** readsb gibi: iz 2 ondalık, [0, 360). */
const roundTrack = (deg: number) => {
  const value = round(deg, 2)
  return value >= 360 ? 0 : value
}
/** readsb barometrik irtifayı 25 ft, dikey hızı 64 ft/dk adımla verir. */
const roundAltitude = (ft: number) => Math.round(ft / 25) * 25
const roundRate = (fpm: number) => Math.round(fpm / 64) * 64 || 0

function baseAircraft(
  identity: SyntheticIdentity,
  typeCode: string,
  category: string,
  motion: Motion,
): ReadsbAircraft {
  return {
    hex: identity.hex,
    flight: identity.callsign.padEnd(8, ' '),
    r: identity.registration,
    t: typeCode,
    category,
    gs: round(motion.gsKt, 1),
    track: roundTrack(motion.trackDeg),
    lat: round(motion.position.lat, 6),
    lon: round(motion.position.lon, 6),
    seen_pos: SEEN_POS_S,
    seen: SEEN_S,
    squawk: identity.squawk,
    dbFlags: 0,
    type: 'adsb_icao',
  }
}

export function cruiseScenario(opts: { count?: number } = {}): Scenario {
  const fleet = cruiseFleet(opts.count ?? DEFAULT_CRUISE_COUNT).map((flight) => ({
    flight,
    motion: shuttleMotion(AIRPORTS[flight.from], AIRPORTS[flight.to], flight.gsKt, flight.phase),
  }))
  const approach = approachMotion(APPROACH_PROFILE)
  const approachIdentity = syntheticIdentity(APPROACH_NUMBER)
  const taxi = loopMotion(TAXI_LOOP, TAXI_SPEED_KT)
  const taxiIdentity = syntheticIdentity(TAXI_NUMBER)

  return {
    name: CRUISE_SCENARIO_NAME,
    frameAt(epochMs: number): ReadsbFrame {
      if (!Number.isFinite(epochMs)) throw new RangeError('zaman sonlu bir sayı olmalı (epoch ms)')
      // Kare `now` anında ölçülür; konumlar `seen_pos` kadar eskidir, o anın konumu verilir.
      const sampleMs = epochMs - SEEN_POS_S * 1000
      const aircraft: ReadsbAircraft[] = fleet.map(({ flight, motion }) => ({
        ...baseAircraft(flight, flight.typeCode, flight.category, motion(sampleMs)),
        alt_baro: CRUISE_ALTITUDE_FT,
        alt_geom: CRUISE_ALTITUDE_FT + GEOM_OFFSET_FT,
        baro_rate: 0,
      }))
      const onFinal = approach(sampleMs)
      const altitude = roundAltitude(onFinal.altitudeFt)
      aircraft.push({
        ...baseAircraft(approachIdentity, 'A21N', 'A3', onFinal),
        alt_baro: altitude,
        alt_geom: altitude + GEOM_OFFSET_FT,
        baro_rate: roundRate(onFinal.verticalRateFpm),
      })
      aircraft.push({
        ...baseAircraft(taxiIdentity, 'B738', 'A3', taxi(sampleMs)),
        alt_baro: 'ground',
      })
      return {
        now: epochMs / 1000,
        messages: Math.floor((epochMs / 1000) * MESSAGES_PER_SECOND),
        aircraft,
      }
    },
  }
}
