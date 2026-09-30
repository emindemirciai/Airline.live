import { describe, expect, it } from 'vitest'
import { toListedAirports, type AirportSourceRow } from './airports'

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
