import { describe, expect, it } from 'vitest'
import { buildAirlineCodes, EMPTY_AIRLINE_CODES, type AirlineCodeRow } from './airlines'

const row = (
  code: string,
  icao: string | null,
  iata: string | null,
  overridden = false,
): AirlineCodeRow => ({ code, icao, iata, overridden })

describe('buildAirlineCodes', () => {
  it('ICAO → IATA ve IATA → ICAO eşlemeleri; paylaşılan IATA alfabetik listelenir', () => {
    const codes = buildAirlineCodes([
      row('THY', 'THY', 'TK'),
      row('PGT', 'PGT', 'PC'),
      row('VLU', 'VLU', 'VF'),
      row('TKJ', 'TKJ', 'VF'),
    ])
    expect(Object.fromEntries(codes.icaoToIata)).toEqual({
      THY: 'TK',
      PGT: 'PC',
      VLU: 'VF',
      TKJ: 'VF',
    })
    expect(Object.fromEntries(codes.iataToIcao)).toEqual({
      TK: ['THY'],
      PC: ['PGT'],
      VF: ['TKJ', 'VLU'],
    })
  })

  it('biçimi geçersiz kodlar yok sayılır; kodlar kırpılıp büyük harfe çevrilir', () => {
    const codes = buildAirlineCodes([
      // VRS'teki ICAO'suz IATA satırları (ör. rezervasyon sistemleri) eşleme üretmez.
      row('1B', null, '1B'),
      row('AAB', 'AAB', null),
      row('AB1', 'AB1', 'XX'),
      row('ABCD', 'ABCD', 'XY'),
      row('DIG', 'DIG', '12'),
      row('LNG', 'LNG', 'ABC'),
      row('SYM', 'SYM', 'A*'),
      row('EMP', 'EMP', ''),
      row('low', ' low ', ' 8q '),
      row('W2', 'WRX', '2W'),
    ])
    expect(Object.fromEntries(codes.icaoToIata)).toEqual({ LOW: '8Q', WRX: '2W' })
    expect(Object.fromEntries(codes.iataToIcao)).toEqual({ '8Q': ['LOW'], '2W': ['WRX'] })
  })

  it('aynı ICAO iki satırda: önce düzeltme, sonra en küçük code', () => {
    const plain = buildAirlineCodes([row('ZZB', 'ABC', 'B2'), row('ZZA', 'ABC', 'A2')])
    expect(plain.icaoToIata.get('ABC')).toBe('A2')
    const overridden = buildAirlineCodes([row('ZZA', 'ABC', 'A2'), row('ZZB', 'ABC', 'B2', true)])
    expect(overridden.icaoToIata.get('ABC')).toBe('B2')
    // IATA → ICAO her iki IATA'da da ICAO'yu listeler.
    expect(overridden.iataToIcao.get('A2')).toEqual(['ABC'])
    expect(overridden.iataToIcao.get('B2')).toEqual(['ABC'])
  })

  it('IATA → ICAO: önce düzeltmeden gelenler, sonra alfabetik; tekrar yok', () => {
    const codes = buildAirlineCodes([
      row('AAA', 'AAA', 'QQ'),
      row('CCC', 'CCC', 'QQ'),
      row('ZZZ', 'ZZZ', 'QQ', true),
      row('BBB', 'BBB', 'QQ'),
      row('BB2', 'BBB', 'QQ'),
      row('YYY', 'YYY', 'QQ', true),
    ])
    expect(codes.iataToIcao.get('QQ')).toEqual(['YYY', 'ZZZ', 'AAA', 'BBB', 'CCC'])
  })

  it('satır yoksa eşlemeler boştur', () => {
    const codes = buildAirlineCodes([])
    expect(codes.icaoToIata.size).toBe(0)
    expect(codes.iataToIcao.size).toBe(0)
    expect(EMPTY_AIRLINE_CODES.icaoToIata.size).toBe(0)
    expect(EMPTY_AIRLINE_CODES.iataToIcao.size).toBe(0)
  })
})
