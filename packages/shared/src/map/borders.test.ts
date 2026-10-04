import { describe, expect, it } from 'vitest'
import {
  COUNTRY_BORDER_CASING_LAYER_ID,
  COUNTRY_BORDER_CASING_OPACITY,
  COUNTRY_BORDER_CASING_WIDTH,
  COUNTRY_BORDER_DASH,
  COUNTRY_BORDER_DISPUTED_LAYER_ID,
  COUNTRY_BORDER_FILTER,
  COUNTRY_BORDER_LAYER_ID,
  COUNTRY_BORDER_SOURCE_ID,
  COUNTRY_BORDER_SOURCE_LAYER,
  COUNTRY_BORDER_SOURCE_MAX_ZOOM,
  COUNTRY_BORDER_WIDTH,
  DISPUTED_BORDER_DASH,
  countryBorderLayers,
  countryBorderSource,
} from './borders'
import { MAP_COLORS } from './colors'
import { LIVE_MAP_LAYERS, type StyleExpression } from './layers'

/** `['interpolate', ['linear'], ['zoom'], z0, v0 …]` ifadesinin `zoom`'daki değeri (uçlarda sabit). */
function valueAt(expression: StyleExpression, zoom: number): number {
  expect(expression.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']])
  const stops = expression.slice(3) as number[]
  const pairs: [number, number][] = []
  for (let i = 0; i < stops.length; i += 2) pairs.push([stops[i] ?? NaN, stops[i + 1] ?? NaN])
  const first = pairs[0]
  const last = pairs.at(-1)
  if (!first || !last) throw new Error('empty interpolate')
  if (zoom <= first[0]) return first[1]
  if (zoom >= last[0]) return last[1]
  for (let i = 1; i < pairs.length; i++) {
    const [z1, v1] = pairs[i] ?? [NaN, NaN]
    const [z0, v0] = pairs[i - 1] ?? [NaN, NaN]
    if (zoom <= z1) return v0 + ((v1 - v0) * (zoom - z0)) / (z1 - z0)
  }
  return last[1]
}

/**
 * Yuvarlak uçlu kesikli çizginin görünen çizgi ve boşluk uzunlukları (kalınlık biriminde): MapLibre
 * her çizginin iki ucuna yarım kalınlık ekler (`line_atlas.ts`, `addRoundDash`).
 */
function visibleRoundDash(dash: readonly number[]): [number, number] {
  const [on = NaN, off = NaN] = dash
  return [on + 1, off - 1]
}

/** Süzgeç, OpenMapTiles `boundary` özelliklerine sahip bir çizgiyi geçirir mi (yalnız bu dosyadaki ifadeler). */
function matches(filter: StyleExpression, properties: Record<string, number | string>): boolean {
  const evaluate = (expression: StyleExpression): unknown => {
    switch (expression[0]) {
      case 'get':
        return properties[expression[1]] ?? null
      case 'has':
        return expression[1] in properties
      case '==':
        return evaluate(expression[1]) === expression[2]
      case '!=':
        return evaluate(expression[1]) !== expression[2]
      case '!':
        return !evaluate(expression[1])
      case 'all':
        return expression.slice(1).every((part) => evaluate(part as StyleExpression) === true)
      default:
        throw new Error(`unsupported expression ${expression[0]}`)
    }
  }
  return evaluate(filter) === true
}

const layers = countryBorderLayers('openmaptiles')
const [casing, settled, disputed] = layers

describe('ülke sınırı katmanları (D-092)', () => {
  it('alttan üste kenar, kesikli çizgi, noktalı çizgi; hepsi verilen kaynağın boundary katmanından', () => {
    expect(layers.map((layer) => layer.id)).toEqual([
      COUNTRY_BORDER_CASING_LAYER_ID,
      COUNTRY_BORDER_LAYER_ID,
      COUNTRY_BORDER_DISPUTED_LAYER_ID,
    ])
    for (const layer of layers) {
      expect(layer.type).toBe('line')
      expect(layer.source).toBe('openmaptiles')
      expect(layer['source-layer']).toBe(COUNTRY_BORDER_SOURCE_LAYER)
      expect(COUNTRY_BORDER_SOURCE_LAYER).toBe('boundary')
      // Bütün yakınlaştırmalarda görünür (harita z2–z17).
      expect(layer.minzoom).toBeUndefined()
      expect(layer.maxzoom).toBeUndefined()
      expect(layer.layout).toEqual({ 'line-cap': 'round', 'line-join': 'round' })
    }
    expect(countryBorderLayers(COUNTRY_BORDER_SOURCE_ID)[0]?.source).toBe('hy-country-borders')
  })

  it('kimlikler kendi katmanlarımızın önekini taşır ve canlı harita katmanlarıyla çakışmaz', () => {
    const live = new Set(LIVE_MAP_LAYERS.map((layer) => layer.id))
    for (const layer of layers) {
      expect(layer.id).toMatch(/^hy-country-border/)
      expect(live.has(layer.id)).toBe(false)
    }
    expect(live.has(COUNTRY_BORDER_SOURCE_ID)).toBe(false)
  })

  it('süzgeç: yalnızca kara ülke sınırları (admin_level 2, deniz değil, iddia çizgisi değil)', () => {
    expect(COUNTRY_BORDER_FILTER).toEqual([
      'all',
      ['==', ['get', 'admin_level'], 2],
      ['!=', ['get', 'maritime'], 1],
      ['!', ['has', 'claimed_by']],
    ])
    const land = { admin_level: 2, maritime: 0, disputed: 0 }
    expect(matches(COUNTRY_BORDER_FILTER, land)).toBe(true)
    // `maritime` olmayan satır da kara sınırıdır.
    expect(matches(COUNTRY_BORDER_FILTER, { admin_level: 2 })).toBe(true)
    expect(matches(COUNTRY_BORDER_FILTER, { ...land, maritime: 1 })).toBe(false)
    expect(matches(COUNTRY_BORDER_FILTER, { ...land, admin_level: 4 })).toBe(false)
    expect(matches(COUNTRY_BORDER_FILTER, { ...land, claimed_by: 'IN' })).toBe(false)
  })

  it('kenar bütün kara sınırlarının altındadır; kesikli tartışmasız, noktalı tartışmalı sınırı çizer', () => {
    const plain = { admin_level: 2, maritime: 0, disputed: 0 }
    const contested = { ...plain, disputed: 1 }
    const filterOf = (layer: (typeof layers)[number] | undefined) => {
      const filter = layer?.filter
      if (!filter) throw new Error('filter missing')
      return filter
    }
    expect(matches(filterOf(casing), plain)).toBe(true)
    expect(matches(filterOf(casing), contested)).toBe(true)
    expect(matches(filterOf(settled), plain)).toBe(true)
    expect(matches(filterOf(settled), contested)).toBe(false)
    expect(matches(filterOf(disputed), plain)).toBe(false)
    expect(matches(filterOf(disputed), contested)).toBe(true)
    for (const layer of layers) {
      expect(matches(filterOf(layer), { ...contested, maritime: 1 })).toBe(false)
      expect(matches(filterOf(layer), { ...plain, admin_level: 4 })).toBe(false)
    }
  })

  it('beyaz kesikli çizgi: görünen çizgi 3, boşluk 2 kalınlık (yuvarlak uçla); tartışmalıda nokta', () => {
    expect(settled?.paint).toMatchObject({
      'line-color': MAP_COLORS.border,
      'line-opacity': 1,
      'line-dasharray': COUNTRY_BORDER_DASH,
      'line-width': COUNTRY_BORDER_WIDTH,
    })
    expect(visibleRoundDash(COUNTRY_BORDER_DASH)).toEqual([3, 2])
    expect(disputed?.paint).toMatchObject({
      'line-color': MAP_COLORS.border,
      'line-opacity': 1,
      'line-dasharray': DISPUTED_BORDER_DASH,
      'line-width': COUNTRY_BORDER_WIDTH,
    })
    // Sıfır uzunluklu çizgi + yuvarlak uç = kalınlık çapında nokta; noktalar arasında boşluk kalır.
    expect(DISPUTED_BORDER_DASH[0]).toBe(0)
    expect(visibleRoundDash(DISPUTED_BORDER_DASH)[1]).toBeGreaterThanOrEqual(1.5)
    expect(MAP_COLORS.border).toBe('#FFFFFF')
  })

  it('koyu kenar: düz (kesiksiz), yarı saydam, çizginin her yanında en az 1 px taşar', () => {
    expect(casing?.paint).toEqual({
      'line-color': MAP_COLORS.borderCasing,
      'line-width': COUNTRY_BORDER_CASING_WIDTH,
      'line-opacity': COUNTRY_BORDER_CASING_OPACITY,
    })
    expect(MAP_COLORS.borderCasing).toBe('#0B2A33')
    expect(COUNTRY_BORDER_CASING_OPACITY).toBeGreaterThanOrEqual(0.5)
    expect(COUNTRY_BORDER_CASING_OPACITY).toBeLessThan(1)
    for (const zoom of [2, 3, 4.5, 6, 8, 10, 14, 17]) {
      const line = valueAt(COUNTRY_BORDER_WIDTH, zoom)
      expect(valueAt(COUNTRY_BORDER_CASING_WIDTH, zoom) - line, `z${zoom}`).toBeGreaterThanOrEqual(
        2,
      )
    }
  })

  it('kalınlık z3’te ~1 px, z10 ve üstünde 2–2,5 px; yakınlaştıkça incelmez', () => {
    expect(valueAt(COUNTRY_BORDER_WIDTH, 2)).toBe(1)
    expect(valueAt(COUNTRY_BORDER_WIDTH, 3)).toBe(1)
    for (const zoom of [10, 12, 17]) {
      expect(valueAt(COUNTRY_BORDER_WIDTH, zoom)).toBeGreaterThanOrEqual(2)
      expect(valueAt(COUNTRY_BORDER_WIDTH, zoom)).toBeLessThanOrEqual(2.5)
    }
    let previous = 0
    for (let zoom = 2; zoom <= 17; zoom += 0.5) {
      const width = valueAt(COUNTRY_BORDER_WIDTH, zoom)
      expect(width).toBeGreaterThanOrEqual(previous)
      previous = width
    }
  })

  it('sınır kaynağı: TileJSON adresi, en büyük karo z10, atıf kaynakta', () => {
    expect(countryBorderSource('https://tiles.example/planet', 'OSM')).toEqual({
      type: 'vector',
      url: 'https://tiles.example/planet',
      maxzoom: COUNTRY_BORDER_SOURCE_MAX_ZOOM,
      attribution: 'OSM',
    })
    expect(COUNTRY_BORDER_SOURCE_MAX_ZOOM).toBe(10)
  })

  it('katmanlar düz JSON: serileştirilip geri okununca aynıdır', () => {
    expect(JSON.parse(JSON.stringify(layers))).toEqual(layers)
  })
})
