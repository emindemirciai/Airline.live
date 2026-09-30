import { describe, expect, it } from 'vitest'
import { findAirportByCode, hexUrl, parseAirportParam, parseHexParam } from './url-state'

describe('parseHexParam', () => {
  it('geçerli hex’i kırpıp küçük harfe çevirir', () => {
    expect(parseHexParam('4BB1C5')).toBe('4bb1c5')
    expect(parseHexParam('  ff0001 ')).toBe('ff0001')
    expect(parseHexParam('~AB12CD')).toBe('~ab12cd')
  })

  it('tekrarlanan parametrede ilk değeri kullanır', () => {
    expect(parseHexParam(['ff0001', '4bb1c5'])).toBe('ff0001')
    expect(parseHexParam([])).toBeNull()
  })

  it('geçersiz ya da eksik değerde null döner', () => {
    for (const value of [
      undefined,
      null,
      '',
      'ff001',
      'ff00011',
      'gg0001',
      '~~ab12cd',
      'ab 12cd',
    ]) {
      expect(parseHexParam(value), String(value)).toBeNull()
    }
  })
})

describe('hexUrl', () => {
  it('hex’i ekler ya da değiştirir; diğer parametreleri ve # kısmını korur', () => {
    expect(hexUrl('http://localhost:3100/', 'ff0001')).toBe('/?hex=ff0001')
    expect(hexUrl('https://havayolu.live/?hex=aaaaaa&x=1#labels', '4bb1c5')).toBe(
      '/?hex=4bb1c5&x=1#labels',
    )
    expect(hexUrl('https://havayolu.live/en?lang=en', '~ab12cd')).toBe('/en?lang=en&hex=%7Eab12cd')
  })

  it('İngilizce sayfada /en önekini korur', () => {
    expect(hexUrl('http://localhost:3100/en', 'ff0001')).toBe('/en?hex=ff0001')
    expect(hexUrl('https://havayolu.live/en?hex=ff0001', null)).toBe('/en')
    expect(hexUrl('https://havayolu.live/en?havalimani=LTFM', '4bb1c5')).toBe(
      '/en?havalimani=LTFM&hex=4bb1c5',
    )
  })

  it('null ile hex’i kaldırır', () => {
    expect(hexUrl('https://havayolu.live/?hex=ff0001', null)).toBe('/')
    expect(hexUrl('https://havayolu.live/?x=1&hex=ff0001#a', null)).toBe('/?x=1#a')
  })
})

describe('parseAirportParam', () => {
  it('ICAO ya da IATA kodunu kırpıp büyük harfe çevirir', () => {
    expect(parseAirportParam('LTFM')).toBe('LTFM')
    expect(parseAirportParam(' ltfm ')).toBe('LTFM')
    expect(parseAirportParam('ist')).toBe('IST')
    expect(parseAirportParam(['LTBA', 'LTFM'])).toBe('LTBA')
  })

  it('geçersiz ya da eksik değerde null döner', () => {
    for (const value of [undefined, null, '', [], 'LT', 'LTFMX', 'LT-M', 'İST', 'LT M']) {
      expect(parseAirportParam(value), String(value)).toBeNull()
    }
  })
})

describe('findAirportByCode', () => {
  const airports = [
    { icao: 'LTFM', iata: 'IST' },
    { icao: 'LTFJ', iata: 'SAW' },
    { icao: 'ISTX', iata: 'LTF' },
  ]

  it('ICAO ile, yoksa IATA ile bulur', () => {
    expect(findAirportByCode(airports, 'LTFM')).toBe(airports[0])
    expect(findAirportByCode(airports, 'SAW')).toBe(airports[1])
    expect(findAirportByCode(airports, 'ZZZZ')).toBeUndefined()
  })

  it('ICAO eşleşmesi önceliklidir', () => {
    expect(findAirportByCode([...airports, { icao: 'IST', iata: 'XXX' }], 'IST')).toEqual({
      icao: 'IST',
      iata: 'XXX',
    })
  })
})
