import {
  greatCircleKm,
  ringForDistance,
  selectListedAirports,
  type AirportRingConfig,
  type AirportSourceRow,
} from '@havayolu/db'
import { distanceKm } from '@havayolu/geo'
import {
  AIRPORT_RING_CONFIG,
  AIRPORT_RINGS_KM,
  airportRing,
  ENABLED_AIRPORT_RING,
  isForeignCandidate,
} from '@havayolu/shared'
import { describe, expect, it } from 'vitest'

/**
 * Halka kuralı iki pakette yazılıdır (D-080): `@havayolu/shared` (arayüz, sabitler) ve
 * `@havayolu/db` (sunucuda liste seçimi; db shared'a bağımlı değildir, ayar çağırandan gelir). API
 * ikisine de bağımlıdır; bu test iki yazımın aynı kalmasını denetler.
 */
describe('halka kuralı: shared ile db aynı', () => {
  it('AIRPORT_RING_CONFIG db ayar tipine uyar ve sabitlerden oluşur', () => {
    const config: AirportRingConfig = AIRPORT_RING_CONFIG
    expect(config.ringsKm).toEqual([...AIRPORT_RINGS_KM])
    expect(config.enabledRing).toBe(ENABLED_AIRPORT_RING)
  })

  it('airportRing = ringForDistance (sınırlar, aralar, sonsuz)', () => {
    const distances = [0, 1, 499.99, 500, 500.01, 750, 1000, 1000.5, 1999, 2000, 4999, 5000]
    for (const d of [...distances, 5000.01, 12_000, Number.POSITIVE_INFINITY]) {
      expect(ringForDistance(d, AIRPORT_RINGS_KM), String(d)).toBe(airportRing(d))
    }
  })

  it('greatCircleKm = @havayolu/geo distanceKm', () => {
    const pairs = [
      [
        { lat: 41.2611, lon: 28.7419 },
        { lat: 37.936401, lon: 23.9445 },
      ],
      [
        { lat: 35.153064, lon: 33.507352 },
        { lat: 36.8987, lon: 30.8005 },
      ],
      [
        { lat: 40.1, lon: 25.88 },
        { lat: 42.5728, lon: 21.035801 },
      ],
      [
        { lat: 0, lon: 179.9 },
        { lat: 0, lon: -179.9 },
      ],
    ] as const
    for (const [a, b] of pairs) {
      expect(greatCircleKm(a, b)).toBeCloseTo(distanceKm(a, b), 9)
    }
  })

  it('db yurt dışı aday kuralı = shared isForeignCandidate', () => {
    const types = ['large_airport', 'medium_airport', 'small_airport', 'heliport', 'closed']
    const iatas = ['ATH', ' ath ', 'AB', 'A1B', 'ABCD', '', null]
    let id = 1
    for (const type of types) {
      for (const scheduled of [true, false]) {
        for (const iata of iatas) {
          const row: AirportSourceRow = {
            id: id++,
            ident: `X${id}`,
            type,
            name: 'Test Airport',
            latitudeDeg: 38,
            longitudeDeg: 24,
            elevationFt: null,
            isoCountry: 'GR',
            municipality: null,
            scheduledService: scheduled,
            icaoCode: `X${id}`,
            iataCode: iata,
            gpsCode: null,
          }
          // Tek Türkiye referansı yakında: aday olan her satır 1. halkadadır.
          const selected = selectListedAirports([row], {
            turkey: [{ lat: 38, lon: 25, icao: 'LTXX', iata: 'XXX', name: 'Test' }],
            ringsKm: AIRPORT_RINGS_KM,
            enabledRing: 1,
          })
          expect(selected.length === 1, `${type} ${scheduled} ${String(iata)}`).toBe(
            isForeignCandidate(type, scheduled, iata),
          )
        }
      }
    }
  })
})
