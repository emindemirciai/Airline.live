import { describe, expect, it } from 'vitest'
import { BLOCKLIST_HEX, BLOCKLIST_KEY, InvalidHexError, normalizeBlocklistHexes } from './blocklist'

describe('normalizeBlocklistHexes', () => {
  it('kırpar, küçük harfe çevirir, tekrarları atar', () => {
    expect(normalizeBlocklistHexes([' 4BB463 ', '4bb463', '~2C3A4F', 'ff0001'])).toEqual([
      '4bb463',
      '~2c3a4f',
      'ff0001',
    ])
    expect(normalizeBlocklistHexes([])).toEqual([])
  })

  it('geçersiz bir değer varsa hepsi reddedilir; geçersizler hatada listelenir', () => {
    const bad = ['', '4bb46', '4bb4633', 'hy:ac', '~~12345', '4b\u00008750', 'g00001', '*']
    let caught: unknown
    try {
      normalizeBlocklistHexes(['4bb463', ...bad])
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(InvalidHexError)
    expect((caught as InvalidHexError).invalid).toEqual(bad)
    // İleti değerleri taşımaz (loglara ham girdi gitmesin).
    expect((caught as InvalidHexError).message).toBe(`invalid hex: ${bad.length} value(s)`)
  })

  it('anahtar ve biçim', () => {
    expect(BLOCKLIST_KEY).toBe('hy:blocklist:hex')
    expect(BLOCKLIST_HEX.test('4bb463')).toBe(true)
    expect(BLOCKLIST_HEX.test('~4bb463')).toBe(true)
    expect(BLOCKLIST_HEX.test('4BB463')).toBe(false)
  })
})
