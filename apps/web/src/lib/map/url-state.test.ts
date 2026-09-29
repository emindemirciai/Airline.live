import { describe, expect, it } from 'vitest'
import { hexUrl, parseHexParam } from './url-state'

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

  it('null ile hex’i kaldırır', () => {
    expect(hexUrl('https://havayolu.live/?hex=ff0001', null)).toBe('/')
    expect(hexUrl('https://havayolu.live/?x=1&hex=ff0001#a', null)).toBe('/?x=1#a')
  })
})
