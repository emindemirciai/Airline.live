import type { ArrivalCoverageStationRow, NearbyAirfieldRow } from '@havayolu/db'
import { distanceKm, initialBearing } from '@havayolu/geo'
import type { AircraftState } from '@havayolu/providers'
import {
  ARRIVAL_ARP_KM,
  ARRIVAL_GEOID_FT_PER_M,
  ARRIVAL_GROUND_ARP_KM,
  ARRIVAL_MAX_ABOVE_FIELD_FT,
  ARRIVAL_ZONE_KM,
  type ArrivalCoverageStation,
} from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { FINE_ARP_KM, FINE_MAX_AGL_FT, isFineCandidate } from '../../ingest/tracks'
import {
  arrivalAgl,
  classifyArrivalAtStation,
  classifyArrivalRecord,
  classifyGeomOnlyAtStation,
  coverageStationFromRow,
  isArrivalQualifyingSample,
  isLowWeightSourceCode,
  medianSampleGapS,
  nearestThresholdKm,
  noGroundClass,
} from './classify'
import {
  ADSB,
  airborneAt,
  approach,
  ESB,
  groundAt,
  IST,
  leg,
  MLAT,
  NO_ELEVATION,
  pointAtKm,
  record,
  rollout,
  sample,
  SAMANDIRA,
  SAW,
  T0,
} from './test/synthetic'

const OPTS = { closedCutoffTs: T0 + 24 * 3_600_000 }
const S = 1000

/** Tek örnekli kayıt bu istasyonda varış mı? */
const qualifies = (station: ArrivalCoverageStation, s: ReturnType<typeof sample>) =>
  classifyArrivalAtStation(record([s]), station, OPTS) !== null

describe('nitelikli örnek sınırları', () => {
  it('ARP mesafesi: 15,000 km içeride, 15,001 km dışarıda (her yönde)', () => {
    for (const bearingDeg of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const at15 = airborneAt(IST, { ts: T0, bearingDeg, km: 15, aglFt: 2000 })
      expect(distanceKm(at15, IST.arp)).toBeLessThanOrEqual(ARRIVAL_ARP_KM)
      expect(distanceKm(at15, IST.arp)).toBeCloseTo(15, 9)
      expect(qualifies(IST, at15)).toBe(true)
      expect(qualifies(IST, airborneAt(IST, { ts: T0, bearingDeg, km: 15.001, aglFt: 2000 }))).toBe(
        false,
      )
    }
  })

  it('irtifa: alan + 3.000 ft içeride, alan + 3.001 ft dışarıda', () => {
    const at = (aglFt: number) => airborneAt(IST, { ts: T0, bearingDeg: 0, km: 10, aglFt })
    expect(at(3000).altBaroFt).toBe(325 + ARRIVAL_MAX_ABOVE_FIELD_FT)
    expect(qualifies(IST, at(3000))).toBe(true)
    expect(qualifies(IST, at(3001))).toBe(false)
    // Alan yüksekliği bilinmiyorsa 0 alınır.
    const unknown = (alt: number) =>
      sample({ ts: T0, ...pointAtKm(NO_ELEVATION.arp, 90, 5), altBaroFt: alt })
    expect(qualifies(NO_ELEVATION, unknown(3000))).toBe(true)
    expect(qualifies(NO_ELEVATION, unknown(3001))).toBe(false)
  })

  it('baro_rate: −300 sayılmaz, −301 sayılır; boş baro ile geometrik −1.500 sayılmaz', () => {
    const at = (baroRateFpm: number | null, verticalRateFpm: number | null) =>
      airborneAt(IST, { ts: T0, bearingDeg: 0, km: 8, aglFt: 1500, baroRateFpm, verticalRateFpm })
    expect(qualifies(IST, at(-300, -300))).toBe(false)
    expect(qualifies(IST, at(-301, -301))).toBe(true)
    expect(qualifies(IST, at(null, -1500))).toBe(false)
    expect(qualifies(IST, at(-1200, -1200))).toBe(true)
  })

  it('irtifası olmayan havadaki örnek ve yerdeki örnek nitelikli değil', () => {
    const noAlt = sample({ ts: T0, ...pointAtKm(IST.arp, 0, 5), altBaroFt: null })
    expect(isArrivalQualifyingSample(noAlt, IST)).toBe(false)
    const ground = sample({
      ts: T0,
      ...pointAtKm(IST.arp, 0, 1),
      altBaroFt: 300,
      onGround: true,
      baroRateFpm: -800,
    })
    expect(isArrivalQualifyingSample(ground, IST)).toBe(false)
  })

  it('geometrik hız duyarlılığı: baro boş, görünen hız < −300 → yalnızca geomOnly', () => {
    const samples = [
      ...approach({
        station: IST,
        bearingDeg: 0,
        startKm: 14,
        endKm: 3,
        startAglFt: 2500,
        endAglFt: 400,
        startTs: T0,
        count: 12,
        baroRateFpm: null,
      }).map((s) => ({ ...s, verticalRateFpm: -900 })),
      ...rollout(IST, { startTs: T0 + 70 * S, count: 3, bearingDeg: 0, fromKm: 2, toKm: 1.5 }),
    ]
    const rec = record(samples)
    expect(classifyArrivalAtStation(rec, IST, OPTS)).toBeNull()
    expect(classifyGeomOnlyAtStation(rec, IST, OPTS)).toEqual({
      icao: 'LTFM',
      firstQualTs: T0,
      recordClosed: true,
      groundSeen: true,
    })
    const all = classifyArrivalRecord(rec, [IST, SAW], OPTS)
    expect(all.arrivals).toEqual([])
    expect(all.geomOnly).toHaveLength(1)
    // Baro kuralıyla nitelikli kayıt geomOnly'ye girmez.
    const baro = record(
      approach({
        station: IST,
        bearingDeg: 0,
        startKm: 14,
        endKm: 3,
        startAglFt: 2500,
        endAglFt: 400,
        startTs: T0,
        count: 5,
      }),
    )
    expect(classifyGeomOnlyAtStation(baro, IST, OPTS)).toBeNull()
  })
})

describe('yerde örneği', () => {
  const final = () =>
    approach({
      station: IST,
      bearingDeg: 180,
      startKm: 14,
      endKm: 3,
      startAglFt: 2500,
      endAglFt: 300,
      startTs: T0,
      count: 12,
    })
  const afterFinal = T0 + 12 * 5 * S

  it('ARP mesafesi: 6,000 km içeride, 6,001 km dışarıda', () => {
    const at = (km: number) => [...final(), groundAt(IST, { ts: afterFinal, bearingDeg: 90, km })]
    const inside = classifyArrivalAtStation(record(at(6)), IST, OPTS)
    expect(distanceKm(at(6).at(-1) as { lat: number; lon: number }, IST.arp)).toBeLessThanOrEqual(
      ARRIVAL_GROUND_ARP_KM,
    )
    expect(inside?.groundSeen).toBe(true)
    expect(inside?.firstGroundTs).toBe(afterFinal)
    expect(inside?.noGround).toBeNull()
    expect(classifyArrivalAtStation(record(at(6.001)), IST, OPTS)?.groundSeen).toBe(false)
  })

  it('varıştan önceki yer örneği (aynı kayıttaki kalkış) sayılmaz', () => {
    // İST'ten kalkış, pist dışında tırmanış, geri dönüş ve alçakta kayıp (yer yok).
    const departure = [
      ...rollout(IST, { startTs: T0, count: 4, bearingDeg: 180, fromKm: 2, toKm: 0.5 }),
      ...leg({
        from: IST.arp,
        to: pointAtKm(IST.arp, 0, 20),
        startTs: T0 + 20 * S,
        count: 10,
        altBaroFt: 4000,
        baroRateFpm: 2000,
      }),
    ]
    const back = approach({
      station: IST,
      bearingDeg: 0,
      startKm: 14,
      endKm: 4,
      startAglFt: 2500,
      endAglFt: 600,
      startTs: T0 + 300 * S,
      count: 8,
    })
    const obs = classifyArrivalAtStation(record([...departure, ...back]), IST, OPTS)
    expect(obs?.firstQualTs).toBe(T0 + 300 * S)
    expect(obs?.groundSeen).toBe(false)
    expect(obs?.noGround).toBe('lost_low')
  })

  it('yalnızca kalkış olan kayıt varış değildir', () => {
    const departure = [
      ...rollout(IST, { startTs: T0, count: 4, bearingDeg: 180, fromKm: 2, toKm: 0.5 }),
      ...leg({
        from: IST.arp,
        to: pointAtKm(IST.arp, 0, 25),
        startTs: T0 + 20 * S,
        count: 12,
        altBaroFt: 2500,
        baroRateFpm: 1800,
      }),
    ]
    expect(classifyArrivalRecord(record(departure), [IST, SAW], OPTS)).toEqual({
      arrivals: [],
      geomOnly: [],
    })
  })

  it('başka istasyondaki yer örneği sayılmaz', () => {
    // İST'te alçalıp inmeden SAW'a gidip orada iniyor.
    const istFinal = approach({
      station: IST,
      bearingDeg: 120,
      startKm: 12,
      endKm: 6,
      startAglFt: 2000,
      endAglFt: 1500,
      startTs: T0,
      count: 6,
    })
    const toSaw = leg({
      from: pointAtKm(IST.arp, 120, 6),
      to: pointAtKm(SAW.arp, 300, 10),
      startTs: T0 + 60 * S,
      count: 10,
      altBaroFt: 3000,
      baroRateFpm: 0,
    })
    const sawFinal = approach({
      station: SAW,
      bearingDeg: 300,
      startKm: 9,
      endKm: 2,
      startAglFt: 2000,
      endAglFt: 200,
      startTs: T0 + 200 * S,
      count: 8,
    })
    const sawGround = rollout(SAW, {
      startTs: T0 + 260 * S,
      count: 3,
      bearingDeg: 240,
      fromKm: 1.5,
      toKm: 1,
    })
    const result = classifyArrivalRecord(
      record([...istFinal, ...toSaw, ...sawFinal, ...sawGround]),
      [IST, SAW],
      OPTS,
    )
    const ist = result.arrivals.find((a) => a.icao === 'LTFM')
    const saw = result.arrivals.find((a) => a.icao === 'LTFJ')
    expect(ist?.groundSeen).toBe(false)
    expect(saw?.groundSeen).toBe(true)
  })
})

describe('kayıt', () => {
  it('pas geçme tek varıştır; ilk nitelikli örnek varış zamanıdır', () => {
    const first = approach({
      station: IST,
      bearingDeg: 180,
      startKm: 12,
      endKm: 2,
      startAglFt: 2500,
      endAglFt: 200,
      startTs: T0,
      count: 10,
    })
    const climb = leg({
      from: pointAtKm(IST.arp, 180, 2),
      to: pointAtKm(IST.arp, 0, 10),
      startTs: T0 + 60 * S,
      count: 8,
      altBaroFt: 2500,
      baroRateFpm: 2000,
    })
    const second = approach({
      station: IST,
      bearingDeg: 180,
      startKm: 12,
      endKm: 2.5,
      startAglFt: 2500,
      endAglFt: 150,
      startTs: T0 + 400 * S,
      count: 10,
    })
    const ground = rollout(IST, {
      startTs: T0 + 460 * S,
      count: 3,
      bearingDeg: 180,
      fromKm: 2,
      toKm: 1,
    })
    const result = classifyArrivalRecord(
      record([...first, ...climb, ...second, ...ground]),
      [IST],
      OPTS,
    )
    expect(result.arrivals).toHaveLength(1)
    const obs = result.arrivals[0]
    expect(obs?.firstQualTs).toBe(T0)
    expect(obs?.groundSeen).toBe(true)
    // Son havadaki örnek ikinci yaklaşmanın sonu, ilk yer örneğinden önce.
    expect(obs?.lastAirborne.ts).toBe(T0 + 445 * S)
    expect(obs?.lastAirborne.ts).toBeLessThan(obs?.firstGroundTs as number)
  })

  it('SAW→IST tek kayıtta yalnızca IST varışıdır; son havadaki örnek IST bölgesinden', () => {
    const sawDeparture = [
      ...rollout(SAW, { startTs: T0, count: 4, bearingDeg: 240, fromKm: 1.5, toKm: 0.5 }),
      ...leg({
        from: SAW.arp,
        to: pointAtKm(IST.arp, initialBearing(IST.arp, SAW.arp), 20),
        startTs: T0 + 20 * S,
        count: 30,
        stepS: 20,
        altBaroFt: 5000,
        baroRateFpm: 1500,
      }),
    ]
    const istFinal = approach({
      station: IST,
      bearingDeg: initialBearing(IST.arp, SAW.arp),
      startKm: 18,
      endKm: 2.5,
      startAglFt: 2900,
      endAglFt: 100,
      startTs: T0 + 700 * S,
      count: 20,
    })
    const istGround = rollout(IST, {
      startTs: T0 + 800 * S,
      count: 3,
      bearingDeg: 180,
      fromKm: 2.4,
      toKm: 2,
    })
    const result = classifyArrivalRecord(
      record([...sawDeparture, ...istFinal, ...istGround]),
      [IST, SAW],
      OPTS,
    )
    expect(result.arrivals.map((a) => a.icao)).toEqual(['LTFM'])
    const obs = result.arrivals[0]
    expect(obs?.groundSeen).toBe(true)
    expect(obs?.lastAirborne.arpKm).toBeLessThanOrEqual(ARRIVAL_ZONE_KM)
    expect(obs?.lastAirborne.ts).toBe(T0 + 795 * S)
  })

  it('sırasız örnekler sıralanır', () => {
    const samples = approach({
      station: IST,
      bearingDeg: 0,
      startKm: 10,
      endKm: 3,
      startAglFt: 2000,
      endAglFt: 300,
      startTs: T0,
      count: 6,
    })
    const shuffled = [
      samples[3],
      samples[0],
      samples[5],
      samples[1],
      samples[4],
      samples[2],
    ].filter((s) => s !== undefined)
    expect(classifyArrivalAtStation(record(shuffled), IST, OPTS)).toEqual(
      classifyArrivalAtStation(record(samples), IST, OPTS),
    )
  })

  it('kapalı ve açık kayıt', () => {
    const samples = approach({
      station: IST,
      bearingDeg: 0,
      startKm: 10,
      endKm: 3,
      startAglFt: 2000,
      endAglFt: 300,
      startTs: T0,
      count: 6,
    })
    const cutoff = T0 + 25 * S
    expect(
      classifyArrivalAtStation(record(samples, cutoff), IST, { closedCutoffTs: cutoff })
        ?.recordClosed,
    ).toBe(true)
    expect(
      classifyArrivalAtStation(record(samples, cutoff + 1), IST, { closedCutoffTs: cutoff })
        ?.recordClosed,
    ).toBe(false)
  })
})

describe('AGL ve mesafe', () => {
  it('LTFM: alt_geom varsa geoid, yoksa baro; işaret korunur', () => {
    const geoid = airborneAt(IST, { ts: T0, bearingDeg: 0, km: 3, aglFt: 250, withGeom: true })
    const a = arrivalAgl(geoid, IST)
    expect(a.method).toBe('geoid')
    expect(a.aglFt).toBeCloseTo(
      (geoid.altGeomFt as number) - 37.05 * ARRIVAL_GEOID_FT_PER_M - 325,
      9,
    )
    expect(a.baroAglFt).toBe(250)
    const baro = airborneAt(IST, { ts: T0, bearingDeg: 0, km: 3, aglFt: 250 })
    expect(arrivalAgl(baro, IST)).toEqual({ aglFt: 250, method: 'baro_tolerant', baroAglFt: 250 })
    // Eşiğin altında görünen uçak: negatif AGL korunur.
    expect(arrivalAgl({ altBaroFt: 200, altGeomFt: null }, IST).aglFt).toBe(-125)
    const negativeGeoid = arrivalAgl({ altBaroFt: 400, altGeomFt: 400 }, IST)
    expect(negativeGeoid.method).toBe('geoid')
    expect(negativeGeoid.aglFt).toBeLessThan(0)
    expect(arrivalAgl({ altBaroFt: null, altGeomFt: null }, IST)).toEqual({
      aglFt: null,
      method: null,
      baroAglFt: null,
    })
  })

  it('ESB hep baro (geoid yok); alan yüksekliği yoksa 0 alınır', () => {
    expect(arrivalAgl({ altBaroFt: 3500, altGeomFt: 3700 }, ESB)).toEqual({
      aglFt: 375,
      method: 'baro_tolerant',
      baroAglFt: 375,
    })
    expect(arrivalAgl({ altBaroFt: 800, altGeomFt: null }, NO_ELEVATION).aglFt).toBe(800)
  })

  it('en yakın gerçek eşik; yalnızca arp_fallback varsa ARP', () => {
    const p = pointAtKm(IST.arp, 0, 5)
    const north = nearestThresholdKm(p, IST)
    expect(north.fallback).toBe(false)
    expect(north.km).toBeCloseTo(3, 6)
    const esb = nearestThresholdKm(pointAtKm(ESB.arp, 90, 4), ESB)
    expect(esb).toEqual({ km: expect.closeTo(4, 9) as number, fallback: true })
    expect(nearestThresholdKm(pointAtKm(NO_ELEVATION.arp, 90, 2), NO_ELEVATION).fallback).toBe(true)
  })

  it('son havadaki örneğin ölçüleri ve düşük ağırlıklı kaynak', () => {
    const samples = approach({
      station: IST,
      bearingDeg: 0,
      startKm: 12,
      endKm: 4,
      startAglFt: 2500,
      endAglFt: 700,
      startTs: T0,
      count: 5,
      withGeom: true,
    })
    const last = samples.at(-1)
    if (last) last.source = MLAT
    const obs = classifyArrivalAtStation(record(samples), IST, OPTS)
    expect(obs?.lastAirborne.arpKm).toBeCloseTo(4, 6)
    expect(obs?.lastAirborne.thresholdKm).toBeCloseTo(2, 6)
    expect(obs?.lastAirborne.aglMethod).toBe('geoid')
    expect(obs?.lastAirborne.lowWeightSource).toBe(true)
    expect(obs?.lowWeightZoneSamples).toBe(1)
    expect(isLowWeightSourceCode(ADSB)).toBe(false)
    expect(isLowWeightSourceCode(MLAT)).toBe(true)
    expect(isLowWeightSourceCode(999)).toBe(true)
  })
})

describe('yerde örneği yoksa sınıf', () => {
  const lostFinal = () =>
    approach({
      station: IST,
      bearingDeg: 0,
      startKm: 12,
      endKm: 3,
      startAglFt: 2500,
      endAglFt: 300,
      startTs: T0,
      count: 10,
    })
  const lastTs = T0 + 45 * S

  it('lost_low: kayıt son örnekte bitiyor', () => {
    const obs = classifyArrivalAtStation(record(lostFinal()), IST, OPTS)
    expect(obs?.noGround).toBe('lost_low')
    expect(obs?.lastAirborne.ts).toBe(lastTs)
  })

  it('left_zone: kayıt son havadaki örnekten max(120 sn, 3 × medyan aralık) sonra hâlâ görüldü', () => {
    expect(
      classifyArrivalAtStation(record(lostFinal(), lastTs + 120 * S), IST, OPTS)?.noGround,
    ).toBe('lost_low')
    expect(
      classifyArrivalAtStation(record(lostFinal(), lastTs + 121 * S), IST, OPTS)?.noGround,
    ).toBe('left_zone')
    // Medyan aralık 60 sn ise sınır 180 sn olur.
    expect(
      noGroundClass({
        lastAirborneTs: 0,
        thresholdKm: 2,
        otherFieldKm: null,
        recordLastSeenTs: 180 * S,
        medianGapS: 60,
      }),
    ).toBe('lost_low')
    expect(
      noGroundClass({
        lastAirborneTs: 0,
        thresholdKm: 2,
        otherFieldKm: null,
        recordLastSeenTs: 181 * S,
        medianGapS: 60,
      }),
    ).toBe('left_zone')
  })

  it("other_field: son havadaki örnek başka bir alana eşikten yakın (left_zone'dan önce gelir)", () => {
    const toBx = initialBearing(SAW.arp, SAMANDIRA)
    const bxKm = distanceKm(SAW.arp, SAMANDIRA)
    const samples = [
      ...approach({
        station: SAW,
        bearingDeg: toBx,
        startKm: 8,
        endKm: bxKm - 0.8,
        startAglFt: 2500,
        endAglFt: 400,
        startTs: T0,
        count: 10,
      }),
      ...rollout(SAW, {
        startTs: T0 + 60 * S,
        count: 4,
        bearingDeg: toBx,
        fromKm: bxKm - 0.4,
        toKm: bxKm,
      }),
    ]
    const obs = classifyArrivalAtStation(record(samples, T0 + 600 * S), SAW, OPTS)
    expect(obs?.groundSeen).toBe(false)
    expect(obs?.lastAirborne.otherFieldKm).toBeLessThan(1)
    expect(obs?.noGround).toBe('other_field')
  })
})

describe('seen_pos ve örnek aralığı', () => {
  it('istasyon bölgesindeki örneklerin ham değerleri; negatif korunur, boş sayılır', () => {
    const samples = [
      airborneAt(IST, { ts: T0, bearingDeg: 0, km: 40, aglFt: 2900, seenPosS: 9 }),
      airborneAt(IST, { ts: T0 + 5 * S, bearingDeg: 0, km: 25, aglFt: 2900, seenPosS: 1.5 }),
      airborneAt(IST, { ts: T0 + 10 * S, bearingDeg: 0, km: 12, aglFt: 2000, seenPosS: -0.2 }),
      airborneAt(IST, { ts: T0 + 20 * S, bearingDeg: 0, km: 8, aglFt: 1500, seenPosS: null }),
      airborneAt(IST, { ts: T0 + 25 * S, bearingDeg: 0, km: 5, aglFt: 900, seenPosS: 0 }),
    ]
    const obs = classifyArrivalAtStation(record(samples), IST, OPTS)
    expect(obs?.seenPosS).toEqual([1.5, -0.2, 0])
    expect(obs?.seenPosUnknown).toBe(1)
    expect(obs?.zoneSamples).toBe(4)
    expect(obs?.medianGapS).toBe(5)
    expect(medianSampleGapS([{ ts: 0 }])).toBeNull()
    expect(medianSampleGapS([{ ts: 0 }, { ts: 4000 }, { ts: 6000 }, { ts: 16_000 }])).toBe(4)
  })

  it('gözlem hex, çağrı kodu ya da tescil taşımaz', () => {
    const obs = classifyArrivalAtStation(
      record(
        approach({
          station: IST,
          bearingDeg: 0,
          startKm: 10,
          endKm: 3,
          startAglFt: 2000,
          endAglFt: 300,
          startTs: T0,
          count: 4,
        }),
      ),
      IST,
      OPTS,
    )
    const keys = JSON.stringify(obs)
    expect(keys).not.toMatch(/hex|callsign|registration/i)
  })
})

describe('ince iz yakalama kuralı bekçisi', () => {
  it('tracks.ts kuralı varış tanımlarını kapsar (daraltılırsa test kırılır)', () => {
    expect(FINE_ARP_KM).toBeGreaterThanOrEqual(ARRIVAL_ZONE_KM)
    expect(ARRIVAL_ZONE_KM).toBeGreaterThanOrEqual(ARRIVAL_ARP_KM)
    expect(ARRIVAL_ARP_KM).toBeGreaterThanOrEqual(ARRIVAL_GROUND_ARP_KM)
    expect(FINE_MAX_AGL_FT).toBeGreaterThan(ARRIVAL_MAX_ABOVE_FIELD_FT)
    const ctx = {
      stations: [{ lat: IST.arp.lat, lon: IST.arp.lon, elevationFt: IST.elevationFt }],
      watch: new Set<string>(),
    }
    const state = (s: ReturnType<typeof sample>): AircraftState =>
      ({
        hex: '4bb1c3',
        lat: s.lat,
        lon: s.lon,
        altBaroFt: s.altBaroFt,
        onGround: s.onGround,
      }) as AircraftState
    // Nitelikli örneğin en uç hâli (15 km, alan + 3.000 ft) ve 30 km bölgesinin kenarı ince ize girer.
    expect(
      isFineCandidate(state(airborneAt(IST, { ts: T0, bearingDeg: 45, km: 15, aglFt: 3000 })), ctx),
    ).toBe(true)
    expect(
      isFineCandidate(state(airborneAt(IST, { ts: T0, bearingDeg: 45, km: 30, aglFt: 3000 })), ctx),
    ).toBe(true)
    expect(isFineCandidate(state(groundAt(IST, { ts: T0, bearingDeg: 45, km: 6 })), ctx)).toBe(true)
  })
})

describe('coverageStationFromRow', () => {
  it('geoid yedeği, eşik kaynakları ve istasyona ait yakın alanlar', () => {
    const row: ArrivalCoverageStationRow = {
      icao: 'LTFJ',
      iata: 'SAW',
      isPrimary: false,
      airportId: 4569,
      lat: 40.898602,
      lon: 29.3092,
      elevationFt: 312,
      geoidUndulationM: null,
      thresholds: [
        {
          runwayId: 1,
          end: 'le',
          ident: '06',
          lat: 40.89,
          lon: 29.29,
          source: 'runway_end',
          elevationFt: 300,
        },
        {
          runwayId: 1,
          end: 'he',
          ident: '24',
          lat: 40.9,
          lon: 29.32,
          source: 'override',
          elevationFt: null,
        },
        {
          runwayId: 2,
          end: 'le',
          ident: null,
          lat: 40.898602,
          lon: 29.3092,
          source: 'weird',
          elevationFt: null,
        },
      ],
    }
    const airfields: NearbyAirfieldRow[] = [
      {
        stationIcao: 'LTFJ',
        airportId: 4546,
        ident: 'LTBX',
        name: 'Samandira',
        type: 'medium_airport',
        lat: 40.993,
        lon: 29.216499,
        elevationFt: 400,
        distanceKm: 13,
      },
      {
        stationIcao: 'LTFM',
        airportId: 4528,
        ident: 'LTBA',
        name: 'Ataturk',
        type: 'large_airport',
        lat: 40.97,
        lon: 28.82,
        elevationFt: 163,
        distanceKm: 29,
      },
    ]
    const station = coverageStationFromRow(row, airfields)
    expect(station.geoidM).toBe(37.61)
    expect(station.geoidSource).toBe('fallback')
    expect(station.thresholds.map((t) => t.source)).toEqual([
      'runway_end',
      'override',
      'arp_fallback',
    ])
    expect(station.nearbyAirfields).toEqual([{ ident: 'LTBX', lat: 40.993, lon: 29.216499 }])
    expect(station.arp).toEqual({ lat: 40.898602, lon: 29.3092 })
  })
})
