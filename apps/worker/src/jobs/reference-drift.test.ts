import { readFileSync } from 'node:fs'
import {
  canonicalIcaoCollisions,
  selectListedAirports,
  toAirportDetails,
  turkishReferencePoints,
  type AirportDetailSourceRow,
  type AirportSourceRow,
  type RunwaySourceRow,
} from '@havayolu/db'
import { parseAirports, parseRunways } from '@havayolu/providers'
import { AIRPORT_RING_CONFIG, AIRPORT_RINGS_KM } from '@havayolu/shared'
import { describe, expect, it, vi } from 'vitest'
import {
  DRIFT_EXAMPLES,
  hasDrift,
  logReferenceDrift,
  referenceDrift,
  type DriftAirport,
  type ReferenceDrift,
} from './reference-drift'

/**
 * Commit'li OurAirports fixture'ı (2026-10-01 kopyası; 1.–5. halka) veritabanındaki gibi: içe
 * aktarım çözümleyicisi ve `@havayolu/db`'nin liste ve ayrıntı kuralı. Dosya bir kez ayrıştırılır.
 */
const fixture = (file: string) =>
  readFileSync(new URL(`../../../../tools/fixtures/ourairports/${file}`, import.meta.url), 'utf8')
const airports = parseAirports(fixture('airports.csv'))
const runways = parseRunways(
  fixture('runways.csv'),
  new Map(airports.rows.map((a) => [a.id, { lat: a.latitudeDeg, lon: a.longitudeDeg }])),
)
const updatedAt = new Date('2026-10-01T23:03:49Z')
const airportRows: AirportDetailSourceRow[] = airports.rows
  .toSorted((a, b) => a.id - b.id)
  .map(({ rowHash: _hash, ...row }) => ({ ...row, updatedAt }))
const runwayRows: RunwaySourceRow[] = runways.rows.map((r) => ({
  id: r.id,
  airportId: r.airportId,
  lengthFt: r.lengthFt,
  widthFt: r.widthFt,
  surface: r.surface,
  lighted: r.lighted,
  leIdent: r.le.ident,
  leTrueBearingDeg: r.le.trueBearingDeg,
  leDisplacedThresholdFt: r.le.displacedThresholdFt,
  leThresholdLat: r.le.thresholdLat,
  leThresholdLon: r.le.thresholdLon,
  heIdent: r.he.ident,
  heTrueBearingDeg: r.he.trueBearingDeg,
  heDisplacedThresholdFt: r.he.displacedThresholdFt,
  heThresholdLat: r.he.thresholdLat,
  heThresholdLon: r.he.thresholdLon,
  leLatitudeDeg: r.le.latitudeDeg,
  heLatitudeDeg: r.he.latitudeDeg,
  updatedAt,
  overrideUpdatedAt: null,
}))
const turkey = turkishReferencePoints(airportRows)

/** `@havayolu/db` `readListingDrift`'in bellekteki eşi. */
function listingDrift(enabledRing: number) {
  const context = { turkey, ringsKm: AIRPORT_RINGS_KM, enabledRing }
  const listed = new Set(selectListedAirports(airportRows, context).map((a) => a.icao))
  return {
    airports: toAirportDetails(airportRows, runwayRows, [], context).filter((a) =>
      listed.has(a.icao),
    ),
    icaoCollisions: canonicalIcaoCollisions(airportRows),
  }
}

const zero = { count: 0, examples: [] }

describe('referans verisi kayması (D-109)', () => {
  it('fixture, açık halka (4): 1.240 listelenen (savaş kapanışlarıyla, D-110), sapma yok', () => {
    expect(AIRPORT_RING_CONFIG.enabledRing).toBe(4)
    const drift = referenceDrift(listingDrift(4))
    expect(drift).toEqual({
      listed: 1240,
      withoutTimeZone: zero,
      unknownSurfaces: zero,
      duplicateIata: zero,
      withoutCuratedName: zero,
      curatedNotListed: zero,
      icaoCollisions: zero,
    })
    expect(hasDrift(drift)).toBe(false)
  })

  it('fixture, 5. halka açık bağlamla: 3.266 (D-110); adları M6j.3 getirir, öbür sapmalar yok', () => {
    const drift = referenceDrift(listingDrift(5))
    expect(drift.listed).toBe(3266)
    // Saat dilimi, kaplama, IATA ve ICAO kuralları 5. halkada da tam (M6j.1).
    for (const key of [
      'withoutTimeZone',
      'unknownSurfaces',
      'duplicateIata',
      'curatedNotListed',
      'icaoCollisions',
    ] as const) {
      expect(drift[key], key).toEqual(zero)
    }
    // 2.026 havalimanının küratörlü adı henüz yok (5. halkanın ad tablosu M6j.3'te).
    expect(drift.withoutCuratedName.count).toBe(2026)
    expect(drift.withoutCuratedName.examples).toHaveLength(DRIFT_EXAMPLES)
  })

  it('her sayım kendi sapmasını sayar; örnekler sıralı ve en çok 10', () => {
    const airport = (overrides: Partial<DriftAirport>): DriftAirport => ({
      icao: 'LTFM',
      iata: 'IST',
      country: 'TR',
      isoRegion: 'TR-34',
      runways: [{ surface: 'CON' }],
      ...overrides,
    })
    const drift = referenceDrift(
      {
        airports: [
          airport({}),
          // Kuralı olmayan bölge (dilimsiz), tanınmayan kaplama (UNK ve boş sayılmaz), aynı IATA.
          airport({ icao: 'KXXX', iata: 'IST', country: 'US', isoRegion: 'US-U-A' }),
          airport({
            icao: 'KYYY',
            iata: 'YYY',
            country: 'US',
            isoRegion: 'US-NY',
            runways: [
              { surface: 'MOON' },
              { surface: 'moon' },
              { surface: 'UNK' },
              { surface: null },
            ],
          }),
        ],
        icaoCollisions: ['ZZZZ', 'ZZZZ'],
      },
      new Set(['LTFM', 'LTFJ']),
    )
    expect(drift).toEqual({
      listed: 3,
      withoutTimeZone: { count: 1, examples: ['KXXX'] },
      unknownSurfaces: { count: 2, examples: ['MOON', 'moon'] },
      duplicateIata: { count: 1, examples: ['IST'] },
      withoutCuratedName: { count: 2, examples: ['KXXX', 'KYYY'] },
      curatedNotListed: { count: 1, examples: ['LTFJ'] },
      icaoCollisions: { count: 1, examples: ['ZZZZ'] },
    })
    const many = referenceDrift(
      {
        airports: Array.from({ length: 12 }, (_, i) =>
          airport({
            icao: `KA${String(i).padStart(2, '0')}`,
            iata: `A${String(i).padStart(2, '0')}`,
          }),
        ),
        icaoCollisions: [],
      },
      new Set(),
    )
    expect(many.withoutCuratedName.count).toBe(12)
    expect(many.withoutCuratedName.examples).toHaveLength(DRIFT_EXAMPLES)
  })

  it('kanonik ICAO çakışması: aynı ICAO’yu taşıyan ikinci aday satır', () => {
    const base: AirportSourceRow = {
      id: 1,
      ident: 'LGAV',
      type: 'large_airport',
      name: 'Athens',
      latitudeDeg: 37.9,
      longitudeDeg: 23.9,
      elevationFt: 300,
      isoCountry: 'GR',
      municipality: 'Athens',
      scheduledService: true,
      icaoCode: 'LGAV',
      iataCode: 'ATH',
      gpsCode: 'LGAV',
    }
    expect(canonicalIcaoCollisions([base])).toEqual([])
    expect(
      canonicalIcaoCollisions([{ ...base, id: 2, ident: 'GR-0001', iataCode: 'XAT' }, base]),
    ).toEqual(['LGAV'])
    // Aday olmayan satır (tarifesiz, küçük) sayılmaz; askerî alan sayılmaz.
    expect(
      canonicalIcaoCollisions([
        base,
        { ...base, id: 2, type: 'small_airport', scheduledService: false },
      ]),
    ).toEqual([])
    const wake = { ...base, ident: 'PWAK', icaoCode: 'PWAK', gpsCode: 'PWAK', iataCode: 'AWK' }
    expect(canonicalIcaoCollisions([wake, { ...wake, id: 2, iataCode: 'AWX' }])).toEqual([])
  })

  it('günlük satırı: yedi sayım tek satırda; sapma yoksa info, varsa warn', () => {
    const log = { info: vi.fn(), warn: vi.fn() }
    const clean = referenceDrift(listingDrift(4))
    logReferenceDrift(log, clean)
    expect(log.warn).not.toHaveBeenCalled()
    expect(log.info).toHaveBeenCalledTimes(1)
    const [line, message] = log.info.mock.calls[0] as [{ drift: ReferenceDrift }, string]
    expect(message).toBe('referans verisi kayması')
    expect(Object.keys(line.drift).sort()).toEqual(
      [
        'listed',
        'withoutTimeZone',
        'unknownSurfaces',
        'duplicateIata',
        'withoutCuratedName',
        'curatedNotListed',
        'icaoCollisions',
      ].sort(),
    )
    logReferenceDrift(log, referenceDrift(listingDrift(5)))
    expect(log.warn).toHaveBeenCalledTimes(1)
    expect(log.warn.mock.calls[0]?.[1]).toBe('referans verisi kayması')
  })
})
