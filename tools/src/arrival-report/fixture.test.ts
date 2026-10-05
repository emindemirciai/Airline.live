import type { ArrivalCoverageStationRow } from '@havayolu/db'
import { distanceKm } from '@havayolu/geo'
import {
  ARRIVAL_ARP_KM,
  ARRIVAL_BARO_RATE_BELOW_FPM,
  ARRIVAL_COVERAGE_CLOSED_RECORD_MS,
  ARRIVAL_COVERAGE_SETTLE_MS,
  ARRIVAL_GEOID_FT_PER_M,
  ARRIVAL_GROUND_ARP_KM,
  ARRIVAL_MAX_ABOVE_FIELD_FT,
  arrivalCoverageWindow,
} from '@havayolu/shared'
import { summarizeArrivalCoverage } from '@havayolu/worker/jobs/arrival-coverage/aggregate'
import {
  classifyArrivalRecord,
  coverageStationFromRow,
} from '@havayolu/worker/jobs/arrival-coverage/classify'
import { describe, expect, it } from 'vitest'
import {
  ARRIVAL_FIXTURE_HEXES,
  ARRIVAL_FIXTURE_ICAO,
  buildArrivalFixture,
  fixtureStationFromRow,
  type FixtureSample,
} from './fixture'

/**
 * LTAI'nin OurAirports fixture'ındaki değerleri (tools/fixtures/ourairports; `readArrivalCoverageStations`
 * satırı biçiminde): ARP, alan yüksekliği 177 ft, üç pist (18C/36C, 18R/36L, 18L/36R).
 */
const LTAI_ROW: ArrivalCoverageStationRow = {
  icao: 'LTAI',
  iata: 'AYT',
  isPrimary: false,
  airportId: 4515,
  lat: 36.898701,
  lon: 30.800501,
  elevationFt: 177,
  geoidUndulationM: null,
  thresholds: [
    {
      runwayId: 239268,
      end: 'le',
      ident: '18C',
      lat: 36.915501,
      lon: 30.794701,
      source: 'runway_end',
      elevationFt: 176,
    },
    {
      runwayId: 239268,
      end: 'he',
      ident: '36C',
      lat: 36.885101,
      lon: 30.7906,
      source: 'runway_end',
      elevationFt: 176,
    },
    {
      runwayId: 239269,
      end: 'le',
      ident: '18R',
      lat: 36.915699,
      lon: 30.7924,
      source: 'runway_end',
      elevationFt: 172,
    },
    {
      runwayId: 239269,
      end: 'he',
      ident: '36L',
      lat: 36.889,
      lon: 30.7887,
      source: 'runway_end',
      elevationFt: 176,
    },
    {
      runwayId: 239270,
      end: 'le',
      ident: '18L',
      lat: 36.911399841308594,
      lon: 30.811399459838867,
      source: 'runway_end',
      elevationFt: 176,
    },
    {
      runwayId: 239270,
      end: 'he',
      ident: '36R',
      lat: 36.88090133666992,
      lon: 30.807199478149414,
      source: 'runway_end',
      elevationFt: 158,
    },
  ],
}

const NOW = Date.parse('2026-10-05T12:00:00Z')
const station = fixtureStationFromRow(LTAI_ROW)
if (station === null) throw new Error('LTAI fixture station')
const arp = { lat: LTAI_ROW.lat, lon: LTAI_ROW.lon }
const flights = buildArrivalFixture(station, NOW)
const byHex = new Map(flights.map((f) => [f.hex, f]))

function qualifies(s: FixtureSample): boolean {
  return (
    !s.onGround &&
    s.altBaroFt !== null &&
    s.altBaroFt <= 177 + ARRIVAL_MAX_ABOVE_FIELD_FT &&
    s.baroRateFpm !== null &&
    s.baroRateFpm < ARRIVAL_BARO_RATE_BELOW_FPM &&
    distanceKm(s, arp) <= ARRIVAL_ARP_KM
  )
}

const lastAirborne = (samples: readonly FixtureSample[]) =>
  [...samples].reverse().find((s) => !s.onGround) as FixtureSample

describe('fixtureStationFromRow', () => {
  it('iki ucu da gerçek eşik olan en küçük kimlikli pisti seçer; iniş le ucuna', () => {
    expect(station.icao).toBe(ARRIVAL_FIXTURE_ICAO)
    expect(station.landing).toEqual({ lat: 36.915501, lon: 30.794701, ident: '18C' })
    expect(station.far).toEqual({ lat: 36.885101, lon: 30.7906 })
    expect(station.elevationFt).toBe(177)
    // İstasyonda geoid yok: yedek tablo (27,36 m) kullanılır.
    expect(station.geoidM).toBe(27.36)
  })

  it('yedek eşikli pist atlanır; alan yüksekliği ya da gerçek pist yoksa null', () => {
    const fallbackFirst: ArrivalCoverageStationRow = {
      ...LTAI_ROW,
      thresholds: [
        {
          ...(LTAI_ROW.thresholds[0] as ArrivalCoverageStationRow['thresholds'][number]),
          runwayId: 1,
          source: 'arp_fallback',
        },
        {
          ...(LTAI_ROW.thresholds[1] as ArrivalCoverageStationRow['thresholds'][number]),
          runwayId: 1,
        },
        ...LTAI_ROW.thresholds.slice(2),
      ],
    }
    expect(fixtureStationFromRow(fallbackFirst)?.landing.ident).toBe('18R')
    expect(fixtureStationFromRow({ ...LTAI_ROW, elevationFt: null })).toBeNull()
    expect(fixtureStationFromRow({ ...LTAI_ROW, thresholds: [] })).toBeNull()
    expect(fixtureStationFromRow({ ...LTAI_ROW, geoidUndulationM: 30 })?.geoidM).toBe(30)
  })
})

describe('buildArrivalFixture', () => {
  it('üç uçuş, sabit sentetik hex’ler; çağrı kodu ya da tescil yok', () => {
    expect(flights.map((f) => f.hex)).toEqual([...ARRIVAL_FIXTURE_HEXES])
    for (const f of flights) {
      expect(Object.keys(f).sort()).toEqual(['firstSeenAt', 'hex', 'lastSeenAt', 'samples'])
      expect(f.samples.length).toBeGreaterThan(30)
    }
  })

  it('örnekler 5 sn arayla artar; kayıt sınırları ilk ve son örnektir', () => {
    for (const f of flights) {
      expect(f.firstSeenAt).toBe(f.samples[0]?.ts)
      expect(f.lastSeenAt).toBe(f.samples.at(-1)?.ts)
      for (let i = 1; i < f.samples.length; i += 1) {
        expect((f.samples[i] as FixtureSample).ts - (f.samples[i - 1] as FixtureSample).ts).toBe(
          5_000,
        )
      }
    }
  })

  it('her uçuş varış tanımını sağlar; ilk örnekler 15 km dışındadır', () => {
    for (const f of flights) {
      expect(qualifies(f.samples[0] as FixtureSample)).toBe(false)
      expect(distanceKm(f.samples[0] as FixtureSample, arp)).toBeGreaterThan(ARRIVAL_ARP_KM)
      expect(f.samples.some(qualifies)).toBe(true)
    }
  })

  it('yalnızca e2e0a1 pistte yerde örneği taşır (ARP’a ≤ 6 km, havadaki örneklerden sonra)', () => {
    const landed = byHex.get('e2e0a1')?.samples ?? []
    const ground = landed.filter((s) => s.onGround)
    expect(ground).toHaveLength(8)
    const firstGround = landed.findIndex((s) => s.onGround)
    expect(landed.slice(firstGround).every((s) => s.onGround)).toBe(true)
    for (const s of ground) {
      expect(distanceKm(s, arp)).toBeLessThanOrEqual(ARRIVAL_GROUND_ARP_KM)
      expect(s.altBaroFt).toBeNull()
      expect(s.baroRateFpm).toBeNull()
    }
    expect(byHex.get('e2e0a2')?.samples.some((s) => s.onGround)).toBe(false)
    expect(byHex.get('e2e0a3')?.samples.some((s) => s.onGround)).toBe(false)
  })

  it('son havadaki örnek: eşikte ~50 ft, 1,5 km’de ~310 ft, 3 km’de ~570 ft (geoid AGL)', () => {
    const expected = { e2e0a1: [0, 50], e2e0a2: [1.5, 308], e2e0a3: [3, 566] } as const
    for (const [hex, [km, agl]] of Object.entries(expected)) {
      const s = lastAirborne(byHex.get(hex as keyof typeof expected)?.samples ?? [])
      expect(distanceKm(s, station.landing)).toBeCloseTo(km, 3)
      const geoidAgl = (s.altGeomFt as number) - 27.36 * ARRIVAL_GEOID_FT_PER_M - 177
      expect(Math.abs(geoidAgl - agl)).toBeLessThan(2)
      expect(Math.abs((s.altBaroFt as number) - 177 - agl)).toBeLessThan(2)
    }
  })

  it('kayıtlar kapalı ve ilk nitelikli örnekler 6 saatlik pencerede bile içeride', () => {
    const window = arrivalCoverageWindow(NOW, 6)
    for (const f of flights) {
      expect(f.lastSeenAt).toBeLessThanOrEqual(window.closedCutoff)
      expect(f.lastSeenAt).toBeLessThan(NOW - 2 * 3_600_000)
      const first = f.samples.find(qualifies) as FixtureSample
      expect(first.ts).toBeGreaterThanOrEqual(window.start)
      expect(first.ts).toBeLessThan(window.end)
    }
    expect(NOW - ARRIVAL_COVERAGE_SETTLE_MS).toBe(window.end)
    expect(NOW - ARRIVAL_COVERAGE_CLOSED_RECORD_MS).toBe(window.closedCutoff)
  })

  it('seen_pos dolu ve çeşitli; kaynak ADS-B', () => {
    const values = new Set(flights.flatMap((f) => f.samples.map((s) => s.seenPosS)))
    expect(values.size).toBeGreaterThan(3)
    expect(new Set(flights.flatMap((f) => f.samples.map((s) => s.source))).size).toBe(1)
  })

  it('aynı an aynı fixture’ı verir', () => {
    expect(buildArrivalFixture(station, NOW)).toEqual(flights)
  })
})

describe("fixture worker'ın sınıflandırıcısı ve toplayıcısıyla", () => {
  const coverageStation = coverageStationFromRow(LTAI_ROW, [])
  const window = arrivalCoverageWindow(NOW, 24)
  const classified = flights.map((f) =>
    classifyArrivalRecord({ lastSeenTs: f.lastSeenAt, samples: f.samples }, [coverageStation], {
      closedCutoffTs: window.closedCutoff,
    }),
  )

  it('3 kapalı varış: e2e0a1 yerde örneğiyle, ikisi lost_low; geoid yöntemi (yedek tablo)', () => {
    const arrivals = classified.flatMap((c) => c.arrivals)
    expect(arrivals).toHaveLength(3)
    expect(classified.every((c) => c.geomOnly.length === 0)).toBe(true)
    expect(arrivals.map((a) => [a.groundSeen, a.noGround, a.recordClosed])).toEqual([
      [true, null, true],
      [false, 'lost_low', true],
      [false, 'lost_low', true],
    ])
    expect(arrivals.every((a) => a.lastAirborne.aglMethod === 'geoid')).toBe(true)
    expect(arrivals.every((a) => !a.lastAirborne.thresholdFallback)).toBe(true)
    // Gözlemler kimlik taşımaz.
    expect(JSON.stringify(arrivals)).not.toMatch(/e2e0a/)
  })

  it('özet: %33,3 (1/3), kural 1 uygulanır (sınırda, az örnek), kural 2 uygulanmaz', () => {
    const result = summarizeArrivalCoverage({
      window,
      hours: 24,
      stations: [coverageStation],
      observations: classified.flatMap((c) => c.arrivals),
      geomOnly: [],
      windowStats: [
        {
          icao: 'LTAI',
          airborneSamples: 100,
          baroRateNull: 0,
          seenPosNull: 0,
          firstBaroRateTs: flights[0]?.firstSeenAt ?? null,
        },
      ],
      provider: null,
      qnh: [],
    })
    const ltai = result.stations[0]
    expect(ltai?.arrivals).toBe(3)
    expect(ltai?.groundSeen).toBe(1)
    expect(ltai?.groundShare).toBeCloseTo(1 / 3, 10)
    expect(ltai?.rule1).toEqual({ verdict: 'applies', borderline: true, lowSample: true })
    expect(ltai?.rule2).toEqual({ verdict: 'does_not_apply', borderline: false, lowSample: true })
    expect(ltai?.all.medianAglFt).toBeGreaterThan(300)
    expect(ltai?.all.medianAglFt).toBeLessThan(320)
    expect(ltai?.all.medianThresholdKm).toBeCloseTo(1.5, 1)
    expect(ltai?.notes).toContain('geoid_fallback')
  })
})
