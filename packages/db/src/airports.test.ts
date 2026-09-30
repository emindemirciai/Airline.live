import { describe, expect, it } from 'vitest'
import {
  toAirportDetails,
  toListedAirports,
  type AirportDetailSourceRow,
  type AirportSourceRow,
  type RunwaySourceRow,
} from './airports'

let nextId = 1

const row = (overrides: Partial<AirportSourceRow> = {}): AirportSourceRow => ({
  id: nextId++,
  ident: 'LTFM',
  type: 'large_airport',
  name: 'Istanbul Airport',
  latitudeDeg: 41.2611,
  longitudeDeg: 28.7419,
  elevationFt: 325,
  municipality: 'Istanbul',
  scheduledService: true,
  icaoCode: 'LTFM',
  iataCode: 'IST',
  gpsCode: 'LTFM',
  ...overrides,
})

describe('toListedAirports', () => {
  it('satırı ortak Airport biçimine çevirir', () => {
    expect(toListedAirports([row()])).toEqual([
      {
        icao: 'LTFM',
        iata: 'IST',
        name: 'Istanbul Airport',
        city: 'Istanbul',
        lat: 41.2611,
        lon: 28.7419,
        elevationFt: 325,
        type: 'large_airport',
        scheduled: true,
      },
    ])
  })

  it('ICAO: icao_code, yoksa gps_code, o da yoksa ident', () => {
    const list = toListedAirports([
      row({ ident: 'LTBL', icaoCode: null, gpsCode: 'LTBL', iataCode: 'IGL' }),
      row({ ident: 'TR-0099', icaoCode: ' ', gpsCode: null, iataCode: 'XXA' }),
      row({ ident: 'LTXX', icaoCode: 'ltyy', gpsCode: 'LTZZ', iataCode: 'XXB' }),
    ])
    expect(list.map((a) => [a.iata, a.icao])).toEqual([
      ['IGL', 'LTBL'],
      ['XXA', 'TR-0099'],
      ['XXB', 'LTYY'],
    ])
  })

  it('IATA kırpılır ve büyük harfe çevrilir; üç harf değilse satır atlanır', () => {
    const list = toListedAirports([
      row({ ident: 'LTAA', icaoCode: 'LTAA', iataCode: ' saw ' }),
      row({ ident: 'LTAB', icaoCode: 'LTAB', iataCode: '' }),
      row({ ident: 'LTAC', icaoCode: 'LTAC', iataCode: null }),
      row({ ident: 'LTAD', icaoCode: 'LTAD', iataCode: 'AB' }),
      row({ ident: 'LTAE', icaoCode: 'LTAE', iataCode: 'A1B' }),
      row({ ident: 'LTAF', icaoCode: 'LTAF', iataCode: 'ABCD' }),
    ])
    expect(list.map((a) => [a.icao, a.iata])).toEqual([['LTAA', 'SAW']])
  })

  it('yalnızca büyük, orta ve küçük havalimanları', () => {
    const list = toListedAirports([
      row({ ident: 'L1', icaoCode: 'L1', iataCode: 'AAA', type: 'large_airport' }),
      row({ ident: 'L2', icaoCode: 'L2', iataCode: 'BBB', type: 'medium_airport' }),
      row({ ident: 'L3', icaoCode: 'L3', iataCode: 'CCC', type: 'small_airport' }),
      row({ ident: 'L4', icaoCode: 'L4', iataCode: 'DDD', type: 'heliport' }),
      row({ ident: 'L5', icaoCode: 'L5', iataCode: 'EEE', type: 'closed' }),
      row({ ident: 'L6', icaoCode: 'L6', iataCode: 'FFF', type: 'seaplane_base' }),
    ])
    expect(list.map((a) => a.type)).toEqual(['large_airport', 'medium_airport', 'small_airport'])
  })

  it('IATA’ya, eşitse ICAO’ya göre sıralar; aynı ICAO’da önce gelen satır kalır', () => {
    const list = toListedAirports([
      row({ ident: 'LTFM', icaoCode: 'LTFM', iataCode: 'IST', name: 'İlk' }),
      row({ ident: 'LTFJ', icaoCode: 'LTFJ', iataCode: 'SAW' }),
      row({ ident: 'LTAC', icaoCode: 'LTAC', iataCode: 'ESB' }),
      row({ ident: 'LTFM', icaoCode: 'LTFM', iataCode: 'ISX', name: 'İkinci' }),
      row({ ident: 'ZZZZ', icaoCode: 'ZZZZ', iataCode: 'ESB' }),
    ])
    expect(list.map((a) => `${a.iata}/${a.icao}`)).toEqual([
      'ESB/LTAC',
      'ESB/ZZZZ',
      'IST/LTFM',
      'SAW/LTFJ',
    ])
    expect(list.find((a) => a.icao === 'LTFM')?.name).toBe('İlk')
  })

  it('boş şehir null; ad kırpılır; yükseklik bilinmiyorsa null', () => {
    const [airport] = toListedAirports([
      row({ municipality: '  ', name: ' Kapadokya ', elevationFt: null, scheduledService: false }),
    ])
    expect(airport).toMatchObject({
      city: null,
      name: 'Kapadokya',
      elevationFt: null,
      scheduled: false,
    })
  })

  it('satır yoksa liste boş', () => {
    expect(toListedAirports([])).toEqual([])
  })
})

const detailRow = (overrides: Partial<AirportDetailSourceRow> = {}): AirportDetailSourceRow => ({
  ...row(),
  isoRegion: 'TR-34',
  updatedAt: new Date('2026-09-27T04:40:00Z'),
  ...overrides,
})

const runwayRow = (overrides: Partial<RunwaySourceRow> = {}): RunwaySourceRow => ({
  id: 1,
  airportId: 1,
  lengthFt: 12_303,
  widthFt: 197,
  surface: 'CON',
  lighted: true,
  leIdent: '16L',
  leTrueBearingDeg: 175.1,
  leDisplacedThresholdFt: null,
  leThresholdLat: 41.29,
  leThresholdLon: 28.72,
  heIdent: '34R',
  heTrueBearingDeg: 355.1,
  heDisplacedThresholdFt: 0,
  heThresholdLat: 41.26,
  heThresholdLon: 28.73,
  updatedAt: new Date('2026-09-27T04:40:00Z'),
  overrideUpdatedAt: null,
  ...overrides,
})

describe('toAirportDetails', () => {
  it('havalimanına pistleri, istasyonu ve veri tarihini ekler', () => {
    const airport = detailRow({ id: 10, municipality: ' Istanbul ', isoRegion: ' tr-34 ' })
    const [detail] = toAirportDetails(
      [airport],
      [runwayRow({ id: 5, airportId: 10, surface: ' ', leIdent: null })],
      [{ icao: 'LTFM', isActive: true, isPrimary: true, fetchRadiusNm: 60 }],
    )
    expect(detail).toEqual({
      icao: 'LTFM',
      iata: 'IST',
      name: 'Istanbul Airport',
      city: 'Istanbul',
      lat: 41.2611,
      lon: 28.7419,
      elevationFt: 325,
      type: 'large_airport',
      scheduled: true,
      isoRegion: 'TR-34',
      municipality: 'Istanbul',
      station: { active: true, primary: true, fetchRadiusNm: 60 },
      dataUpdatedAt: '2026-09-27T04:40:00.000Z',
      runways: [
        {
          id: 5,
          lengthFt: 12_303,
          widthFt: 197,
          surface: null,
          lighted: true,
          ends: [
            {
              ident: '',
              trueBearingDeg: 175.1,
              displacedThresholdFt: null,
              thresholdLat: 41.29,
              thresholdLon: 28.72,
            },
            {
              ident: '34R',
              trueBearingDeg: 355.1,
              displacedThresholdFt: 0,
              thresholdLat: 41.26,
              thresholdLon: 28.73,
            },
          ],
        },
      ],
    })
  })

  it('istasyon değilse null; istasyon kodu büyük/küçük harf ve boşluk farkıyla eşleşir', () => {
    const [ist, saw] = toAirportDetails(
      [
        detailRow({ id: 1, ident: 'LTFM', icaoCode: 'LTFM', iataCode: 'IST' }),
        detailRow({ id: 2, ident: 'LTFJ', icaoCode: 'LTFJ', iataCode: 'SAW' }),
      ],
      [],
      [{ icao: ' ltfj ', isActive: false, isPrimary: false, fetchRadiusNm: 45.5 }],
    )
    expect(ist?.icao).toBe('LTFM')
    expect(ist?.station).toBeNull()
    expect(ist?.runways).toEqual([])
    expect(saw?.station).toEqual({ active: false, primary: false, fetchRadiusNm: 45.5 })
  })

  it('pistler pist adına göre sayısal sıralanır; adı olmayan sona, eşitlikte kimlik', () => {
    const [detail] = toAirportDetails(
      [detailRow({ id: 1 })],
      [
        runwayRow({ id: 1, leIdent: '18' }),
        runwayRow({ id: 2, leIdent: '16R' }),
        runwayRow({ id: 3, leIdent: null }),
        runwayRow({ id: 4, leIdent: '9' }),
        runwayRow({ id: 5, leIdent: '16L' }),
        runwayRow({ id: 6, leIdent: '16L' }),
        runwayRow({ id: 7, airportId: 99, leIdent: '01' }),
      ],
      [],
    )
    expect(detail?.runways.map((r) => r.id)).toEqual([4, 5, 6, 2, 1, 3])
  })

  it('veri tarihi: havalimanı, pist ve pist düzeltmesinin en yenisi', () => {
    const at = (iso: string) => new Date(iso)
    const [detail] = toAirportDetails(
      [detailRow({ id: 1, updatedAt: at('2026-09-01T00:00:00Z') })],
      [
        runwayRow({ id: 1, updatedAt: at('2026-09-02T00:00:00Z') }),
        runwayRow({
          id: 2,
          updatedAt: at('2026-08-01T00:00:00Z'),
          overrideUpdatedAt: at('2026-09-03T12:00:00Z'),
        }),
      ],
      [],
    )
    expect(detail?.dataUpdatedAt).toBe('2026-09-03T12:00:00.000Z')
    const [plain] = toAirportDetails([detailRow({ updatedAt: at('2026-09-05T00:00:00Z') })], [], [])
    expect(plain?.dataUpdatedAt).toBe('2026-09-05T00:00:00.000Z')
  })

  it('liste kuralı aynen uygulanır: IATA sırası, tekil ICAO, IATA kodu olmayan yok', () => {
    const details = toAirportDetails(
      [
        detailRow({ id: 1, ident: 'LTFM', icaoCode: 'LTFM', iataCode: 'IST', name: 'İlk' }),
        detailRow({ id: 2, ident: 'LTAC', icaoCode: 'LTAC', iataCode: 'ESB' }),
        detailRow({ id: 3, ident: 'LTFM', icaoCode: 'LTFM', iataCode: 'ISX', name: 'İkinci' }),
        detailRow({ id: 4, ident: 'LTAE', icaoCode: 'LTAE', iataCode: null }),
      ],
      [runwayRow({ id: 9, airportId: 3 })],
      [],
    )
    expect(details.map((d) => `${d.iata}/${d.icao}/${d.name}`)).toEqual([
      'ESB/LTAC/Istanbul Airport',
      'IST/LTFM/İlk',
    ])
    // Listede görünmeyen satırın pisti başka havalimanına geçmez.
    expect(details.flatMap((d) => d.runways)).toEqual([])
  })

  it('sürücü sayıyı metin verirse sayıya çevrilir', () => {
    const [detail] = toAirportDetails(
      [detailRow({ id: 1 })],
      [runwayRow({ leTrueBearingDeg: '175.5' as unknown as number, heThresholdLat: null })],
      [],
    )
    expect(detail?.runways[0]?.ends[0].trueBearingDeg).toBe(175.5)
    expect(detail?.runways[0]?.ends[1].thresholdLat).toBeNull()
  })
})
