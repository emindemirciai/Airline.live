import { describe, expect, it } from 'vitest'
import { DEFAULT_PATH, safeNextPath } from './safe-path'

describe('safeNextPath', () => {
  it('varsayılan hedef kök adresteki haritadır', () => {
    expect(DEFAULT_PATH).toBe('/')
  })

  it('göreli iç yolları sorgu metniyle birlikte korur', () => {
    expect(safeNextPath('/yenilikler')).toBe('/yenilikler')
    expect(safeNextPath('/durum?x=1')).toBe('/durum?x=1')
    expect(safeNextPath('/?hex=4bb26c')).toBe('/?hex=4bb26c')
  })

  it('dış ya da tehlikeli hedefleri reddeder', () => {
    for (const value of [
      'https://evil.example',
      '//evil.example',
      '/\\evil',
      'yenilikler',
      '',
      null,
      undefined,
      '/a\nb',
    ]) {
      expect(safeNextPath(value)).toBe(DEFAULT_PATH)
    }
  })
})
