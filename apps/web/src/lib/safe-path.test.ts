import { describe, expect, it } from 'vitest'
import { DEFAULT_PATH, safeLogicalPath, safeNextPath } from './safe-path'

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

describe('safeLogicalPath', () => {
  it('/en ve /tr önekini ayırır, sorgu metnini korur', () => {
    expect(safeLogicalPath('/en')).toBe('/')
    expect(safeLogicalPath('/en/durum')).toBe('/durum')
    expect(safeLogicalPath('/en?hex=4bb26c')).toBe('/?hex=4bb26c')
    expect(safeLogicalPath('/en/istasyon/LTFM?x=1')).toBe('/istasyon/LTFM?x=1')
    expect(safeLogicalPath('/tr/durum')).toBe('/durum')
  })

  it('öneksiz yolları olduğu gibi bırakır; /english önek değildir', () => {
    expect(safeLogicalPath('/durum?x=1')).toBe('/durum?x=1')
    expect(safeLogicalPath('/english')).toBe('/english')
    expect(safeLogicalPath('/')).toBe('/')
  })

  it('güvensiz hedeflerde kök yolu verir', () => {
    for (const value of ['//evil.example', 'https://evil.example', '/en\\evil', null, '']) {
      expect(safeLogicalPath(value)).toBe(DEFAULT_PATH)
    }
  })

  it('önek ayrıldıktan sonra // ile başlayan hedefi reddeder (açık yönlendirme)', () => {
    for (const value of [
      '/en//evil.example',
      '/en//evil.example/x?y=1',
      '/tr//evil.example',
      '/tr//evil.example/x',
      '/en/\\evil',
      '/tr/\\evil.example',
      '/en///evil.example',
    ]) {
      expect(safeLogicalPath(value), value).toBe(DEFAULT_PATH)
    }
  })

  it('yüzde kodlu bölü işareti yolun parçası olarak kalır (şemasız adres olmaz)', () => {
    const path = safeLogicalPath('/en/%2F%2Fevil.example')
    expect(path).toBe('/%2F%2Fevil.example')
    expect(new URL(path, 'https://airline.live').host).toBe('airline.live')
  })
})
