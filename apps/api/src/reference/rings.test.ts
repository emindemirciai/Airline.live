import {
  cleanAirportName,
  greatCircleKm,
  MILITARY_AIRFIELD_ICAOS as DB_MILITARY_AIRFIELD_ICAOS,
  OURAIRPORTS_ICAO_CORRECTIONS as DB_ICAO_CORRECTIONS,
  ourAirportsIcao as dbOurAirportsIcao,
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
  FOREIGN_AIRPORT_NAMES,
  isCanonicalIcao,
  isForeignCandidate,
  isMilitaryAirfield,
  isScheduledIataAirport,
  MILITARY_AIRFIELD_ICAOS,
  OURAIRPORTS_ICAO_CORRECTIONS,
  ourAirportsIcao,
} from '@havayolu/shared'
import { describe, expect, it } from 'vitest'

/**
 * Halka kuralı iki pakette yazılıdır (D-080): `@havayolu/shared` (arayüz, sabitler) ve
 * `@havayolu/db` (sunucuda liste seçimi; db shared'a bağımlı değildir, ayar çağırandan gelir). API
 * ikisine de bağımlıdır; bu test iki yazımın aynı kalmasını denetler. Kanonik ICAO kuralı ve
 * OurAirports kaynak düzeltmeleri de (D-088) iki pakette yazılıdır.
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

  it('db yurt dışı aday kuralı = shared isForeignCandidate (tür, tarife, IATA ve ICAO eksenleri)', () => {
    const types = ['large_airport', 'medium_airport', 'small_airport', 'heliport', 'closed']
    const iatas = ['ATH', ' ath ', 'AB', 'A1B', 'ABCD', '', null]
    /**
     * Kanonik ICAO ekseni (D-101): satırın kimlik alanları; shared'a kanonik ICAO
     * (`ourAirportsIcao`) verilir. Dört karakter, üç karakter, OurAirports'un yerel kimliği
     * ("UG-0002", Kihihi), küçük harf, GPS kodu ve ident yedekleri, beş karakter.
     */
    const identities: Pick<AirportSourceRow, 'ident' | 'icaoCode' | 'gpsCode'>[] = [
      { ident: 'LGAV', icaoCode: 'LGAV', gpsCode: 'LGAV' },
      { ident: 'GR-0001', icaoCode: 'LGX', gpsCode: null },
      { ident: 'UG-0002', icaoCode: null, gpsCode: null },
      { ident: 'GR-0002', icaoCode: ' lgts ', gpsCode: null },
      { ident: 'GR-0003', icaoCode: null, gpsCode: 'LGKO' },
      { ident: 'GR-0004', icaoCode: ' ', gpsCode: 'lgx' },
      { ident: 'LGRP', icaoCode: null, gpsCode: null },
      { ident: 'lgsa', icaoCode: null, gpsCode: null },
      { ident: 'GR-0005', icaoCode: 'LGXYZ', gpsCode: null },
      // Kaynak düzeltmesi (D-088): İskenderiye HEAX → HEBA.
      { ident: 'HEBA', icaoCode: 'HEAX', gpsCode: 'HEAX' },
    ]
    const results = new Set<boolean>()
    let id = 1
    for (const type of types) {
      for (const scheduled of [true, false]) {
        for (const iata of iatas) {
          for (const identity of identities) {
            const row: AirportSourceRow = {
              id: id++,
              ...identity,
              type,
              name: 'Test Airport',
              latitudeDeg: 38,
              longitudeDeg: 24,
              elevationFt: null,
              isoCountry: 'GR',
              municipality: null,
              scheduledService: scheduled,
              iataCode: iata,
            }
            // Tek Türkiye referansı yakında: aday olan her satır 1. halkadadır.
            const selected = selectListedAirports([row], {
              turkey: [{ lat: 38, lon: 25, icao: 'LTXX', iata: 'XXX', name: 'Test' }],
              ringsKm: AIRPORT_RINGS_KM,
              enabledRing: 1,
            })
            const expected = isForeignCandidate(type, scheduled, iata, ourAirportsIcao(row))
            results.add(expected)
            expect(
              selected.length === 1,
              `${type} ${scheduled} ${String(iata)} ${JSON.stringify(identity)}`,
            ).toBe(expected)
            // ICAO koşulu olmayan D-080 kuralı yalnız ICAO ekseninde ayrılır.
            if (isCanonicalIcao(ourAirportsIcao(row))) {
              expect(expected).toBe(isScheduledIataAirport(type, scheduled, iata))
            }
          }
        }
      }
    }
    expect([...results].sort()).toEqual([false, true])
  })

  it('kanonik ICAO ve kaynak düzeltmeleri iki pakette aynı (D-088)', () => {
    expect(DB_ICAO_CORRECTIONS).toEqual(OURAIRPORTS_ICAO_CORRECTIONS)
    const rows = [
      { ident: 'HEBA', icaoCode: 'HEAX', gpsCode: 'HEAX' },
      { ident: ' heba ', icaoCode: ' heax ', gpsCode: null },
      { ident: 'HEBA', icaoCode: 'HEBA', gpsCode: 'HEAX' },
      { ident: 'HEBA', icaoCode: null, gpsCode: 'HEAX' },
      { ident: 'EG-0078', icaoCode: 'HEAX', gpsCode: null },
      { ident: 'ORSU', icaoCode: 'ORSJ', gpsCode: 'ORSU' },
      { ident: 'TM-0002', icaoCode: ' ', gpsCode: 'utan' },
      // Özbekistan: OurAirports kimliği UTxx, ICAO'su UZxx (D-090).
      { ident: 'UTSS', icaoCode: 'UZSS', gpsCode: 'UTSS' },
      { ident: 'tr-0099', icaoCode: null, gpsCode: null },
      { ident: 'toString', icaoCode: null, gpsCode: null },
    ]
    for (const row of rows) {
      expect(dbOurAirportsIcao(row), JSON.stringify(row)).toBe(ourAirportsIcao(row))
    }
    expect(ourAirportsIcao({ ident: 'HEBA', icaoCode: 'HEAX', gpsCode: 'HEAX' })).toBe('HEBA')
    expect(cleanAirportName(' Bacău George Enescu International  Airport ')).toBe(
      'Bacău George Enescu International Airport',
    )
    expect(ourAirportsIcao({ ident: 'UTSS', icaoCode: 'UZSS', gpsCode: 'UTSS' })).toBe('UZSS')
  })

  it('askerî hava üsleri iki pakette aynı; db onları listelemez ve uzaklık referansı saymaz (D-107)', () => {
    expect(DB_MILITARY_AIRFIELD_ICAOS).toEqual(MILITARY_AIRFIELD_ICAOS)
    // Her üs, kanonik ICAO'su icao_code, gps_code ya da ident'ten gelse de listede yoktur; aynı
    // biçimdeki sivil satır listededir.
    const base = (icao: string, identity: Pick<AirportSourceRow, 'icaoCode' | 'gpsCode'>) =>
      ({
        id: 1,
        ident: icao,
        type: 'medium_airport',
        name: `${icao} Airport`,
        latitudeDeg: 38,
        longitudeDeg: 27,
        elevationFt: null,
        isoCountry: 'TR',
        municipality: null,
        scheduledService: true,
        iataCode: 'XXX',
        ...identity,
      }) satisfies AirportSourceRow
    const listed = (row: AirportSourceRow) =>
      selectListedAirports([row], { turkey: [], ringsKm: AIRPORT_RINGS_KM, enabledRing: 1 })
    for (const icao of [...MILITARY_AIRFIELD_ICAOS, 'LTBJ', 'LTAD']) {
      for (const identity of [
        { icaoCode: icao, gpsCode: icao },
        { icaoCode: null, gpsCode: ` ${icao.toLowerCase()} ` },
        { icaoCode: null, gpsCode: null },
      ]) {
        const shown = listed(base(icao, identity))
        expect(shown.length === 0, `${icao} ${JSON.stringify(identity)}`).toBe(
          isMilitaryAirfield(icao),
        )
      }
    }
  })

  it("API'nin ad temizliği shared'daki İngilizce adlarla aynı sonucu verir (D-088, D-090)", () => {
    // OurAirports adı → API adı = küratörlü İngilizce ad (sayfada "OurAirports'taki adı" satırı yok).
    const sources: Record<string, string> = {
      LRBC: 'Bacău George Enescu International  Airport',
      LFKB: 'Bastia-Poretta International airport',
      LFOK: 'Chalons Vatry airport',
      LFSB: 'EuroAirport Basel–Mulhouse–Freiburg',
      LOWW: 'Vienna International Airport',
    }
    for (const [icao, source] of Object.entries(sources)) {
      expect(cleanAirportName(source), icao).toBe(FOREIGN_AIRPORT_NAMES[icao]?.en)
    }
  })
})
