import type { AircraftState } from '@havayolu/providers'
import {
  ARRIVAL_ARP_KM,
  ARRIVAL_CANDIDATE_BOX_KM,
  ARRIVAL_CANDIDATE_RULE,
  ARRIVAL_GROUND_ARP_KM,
  ARRIVAL_LANDING_RULES,
  ARRIVAL_MAX_ABOVE_FIELD_FT,
  ARRIVAL_NEARBY_AIRFIELD_KM,
  ARRIVAL_ZONE_KM,
  type ArrivalCoverageSample,
  type ArrivalCoverageStation,
} from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import {
  emptyCursor,
  FINE_ARP_KM,
  FINE_MAX_AGL_FT,
  isFineCandidate,
  trackDecision,
  type FineContext,
} from '../../ingest/tracks'
import {
  isArrivalQualifyingSample,
  isGeomOnlyQualifyingSample,
  isStationGroundSample,
} from './classify'
import { airborneAt, ESB, groundAt, IST, NO_ELEVATION, pointAtKm, SAW, T0 } from './test/synthetic'

/**
 * Koruma testi (M7b.2, D-098): kapsama raporu `track_points_fine` satırlarını okur. İnce iz
 * yakalama kuralı (`ingest/tracks.ts`) ileride daraltılırsa varış, yerde örneği, son havadaki
 * örnek ve `seen_pos` tanımlarının ihtiyaç duyduğu örnekler sessizce kaybolurdu. Bu test, tanımın
 * sınırındaki her örneğin ince ize yazıldığını ve sınıflandırıcının onu aynı şekilde gördüğünü
 * birlikte doğrular. Bu test kırılırsa tanım ya da yakalama kuralı değişmiştir: DUR-SOR.
 */

/** Sentetik örnekten ingest'in gördüğü uçak durumu (kimlik alanları sentetiktir). */
function aircraft(s: ArrivalCoverageSample): AircraftState {
  return {
    hex: 'e2e0f1',
    nonIcao: false,
    callsign: null,
    registration: null,
    typeCode: null,
    category: null,
    dbFlags: 0,
    positionSource: 'adsb_icao',
    lat: s.lat,
    lon: s.lon,
    altBaroFt: s.altBaroFt,
    onGround: s.onGround,
    altGeomFt: s.altGeomFt,
    navQnhHpa: null,
    gsKt: 140,
    trackDeg: 0,
    trueHeadingDeg: null,
    baroRateFpm: s.baroRateFpm,
    geomRateFpm: null,
    iasKt: null,
    tasKt: null,
    mach: null,
    windDirDeg: null,
    windSpeedKt: null,
    oatC: null,
    selAltFt: null,
    navModes: [],
    squawk: null,
    emergency: null,
    sampleTime: s.ts,
    seenPosS: s.seenPosS,
    source: 'adsbLol',
  }
}

const context = (station: ArrivalCoverageStation): FineContext => ({
  stations: [{ lat: station.arp.lat, lon: station.arp.lon, elevationFt: station.elevationFt }],
  watch: new Set(),
})

const STATIONS = [IST, SAW, ESB, NO_ELEVATION]
const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315]

describe('ince iz yakalama kuralı ⊇ varış tanımları', () => {
  it('sabitler: yakalama yarıçapı ve irtifası tanımların sınırlarını kapsar', () => {
    expect(FINE_ARP_KM).toBeGreaterThanOrEqual(ARRIVAL_ZONE_KM)
    expect(ARRIVAL_ZONE_KM).toBeGreaterThanOrEqual(ARRIVAL_ARP_KM)
    expect(ARRIVAL_ARP_KM).toBeGreaterThanOrEqual(ARRIVAL_GROUND_ARP_KM)
    expect(FINE_MAX_AGL_FT).toBeGreaterThan(ARRIVAL_MAX_ABOVE_FIELD_FT)
    // Bugünkü kuralların konum koşulları da bölge içinde (low: ARP'a ≤ 20 km).
    for (const rule of Object.values(ARRIVAL_LANDING_RULES)) {
      expect(rule.maxKm).toBeLessThanOrEqual(ARRIVAL_ZONE_KM)
      expect(rule.maxAglFt).toBeLessThan(FINE_MAX_AGL_FT)
    }
    // Aday sorgusu sınıflandırıcının üst kümesi.
    expect(ARRIVAL_CANDIDATE_BOX_KM).toBeGreaterThan(ARRIVAL_ARP_KM)
    expect(ARRIVAL_CANDIDATE_RULE).toEqual({
      boxKm: ARRIVAL_CANDIDATE_BOX_KM,
      maxAboveFieldFt: ARRIVAL_MAX_ABOVE_FIELD_FT,
      baroRateBelowFpm: -300,
      includeGeomOnly: true,
    })
    expect(ARRIVAL_NEARBY_AIRFIELD_KM).toBeGreaterThan(0)
  })

  it('sınırdaki nitelikli örnek (15 km, alan + 3.000 ft, −301 fpm) her yönde ince ize yazılır', () => {
    for (const station of STATIONS) {
      for (const bearingDeg of BEARINGS) {
        const s = airborneAt(station, {
          ts: T0,
          bearingDeg,
          km: ARRIVAL_ARP_KM,
          aglFt: ARRIVAL_MAX_ABOVE_FIELD_FT,
          baroRateFpm: -301,
        })
        expect(isArrivalQualifyingSample(s, station)).toBe(true)
        expect(isFineCandidate(aircraft(s), context(station))).toBe(true)
        expect(trackDecision(emptyCursor(), aircraft(s), context(station)).fine).toBe(true)
      }
    }
  })

  it('geometrik hız duyarlılığının sınır örneği de ince ize yazılır', () => {
    for (const station of STATIONS) {
      const s = airborneAt(station, {
        ts: T0,
        bearingDeg: 90,
        km: ARRIVAL_ARP_KM,
        aglFt: ARRIVAL_MAX_ABOVE_FIELD_FT,
        baroRateFpm: null,
        verticalRateFpm: -301,
      })
      expect(isGeomOnlyQualifyingSample(s, station)).toBe(true)
      expect(isFineCandidate(aircraft(s), context(station))).toBe(true)
    }
  })

  it('6 km’deki yerde örneği yazılır; son havadaki örnek ve seen_pos bölgesi (30 km) yazılır', () => {
    for (const station of STATIONS) {
      for (const bearingDeg of BEARINGS) {
        const ground = groundAt(station, { ts: T0, bearingDeg, km: ARRIVAL_GROUND_ARP_KM })
        expect(isStationGroundSample(ground, station)).toBe(true)
        expect(isFineCandidate(aircraft(ground), context(station))).toBe(true)
        // Yere değişte son yazılan nokta havadaki örnektir; yer örneği 20 m kuralına takılmaz.
        const lastAirborne = pointAtKm(station.arp, bearingDeg, ARRIVAL_GROUND_ARP_KM + 0.3)
        const cursor = { ...emptyCursor(), fineTs: T0 - 5_000, finePos: lastAirborne }
        expect(trackDecision(cursor, aircraft(ground), context(station)).fine).toBe(true)

        // Bölge sınırında, nitelikli irtifanın üstünde bir pas geçme örneği de yazılır.
        const zone = airborneAt(station, {
          ts: T0,
          bearingDeg,
          km: ARRIVAL_ZONE_KM,
          aglFt: ARRIVAL_MAX_ABOVE_FIELD_FT + 1_000,
          baroRateFpm: 1_500,
        })
        expect(isFineCandidate(aircraft(zone), context(station))).toBe(true)
      }
    }
  })
})
