import { describe, expect, it } from 'vitest'
import { COUNTRY_CAPITALS, countryLabelTier, type CountryLabelTier } from '../reference/capitals'
import { MAP_COLORS } from './colors'
import {
  COUNTRY_LABEL_CENTRED_OFFSET_EM,
  COUNTRY_LABEL_COMPACT_MAX_WIDTH_PX,
  COUNTRY_LABEL_COMPACT_WRAP_EM,
  COUNTRY_LABEL_FADE_START_ZOOM,
  COUNTRY_LABEL_FONT,
  COUNTRY_LABEL_HALO_ALPHA,
  COUNTRY_LABEL_LAYER_IDS,
  COUNTRY_LABEL_MAX_WIDTH_EM,
  COUNTRY_LABEL_MAX_ZOOM,
  COUNTRY_LABEL_MIN_ZOOM,
  COUNTRY_LABEL_SIZES,
  COUNTRY_LABEL_SOURCE_ID,
  COUNTRY_LABEL_SOURCE_MAX_ZOOM,
  COUNTRY_LABEL_TEXT_ALPHA,
  COUNTRY_LABEL_TIERS,
  GLYPH_SDF_REACH_EM,
  HALO_BLUR_FACTOR,
  SDF_EDGE_GAMMA_PX,
  countryLabelHalo,
  countryLabelLayers,
  countryLabelMaxWidth,
  countryLabelOffsetEm,
  countryLabelOpacityAt,
  countryLabelPoints,
  countryLabelSizeAt,
  countryLabelTextOffset,
  countryLabelTextSize,
  interpolateStops,
} from './country-labels'
import type { StyleExpression, TextSymbolLayerStyle } from './layers'

/** `['interpolate', ['linear'], ['zoom'], z0, v0, …]` durakları. */
function stops(value: unknown): [number, number][] {
  const expression = value as StyleExpression
  expect(expression.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']])
  const rest = expression.slice(3) as number[]
  expect(rest.length % 2).toBe(0)
  const pairs: [number, number][] = []
  for (let i = 0; i < rest.length; i += 2) pairs.push([rest[i] ?? NaN, rest[i + 1] ?? NaN])
  return pairs
}

const MODES = [false, true] as const
const layerOf = (layers: TextSymbolLayerStyle[], tier: CountryLabelTier) => {
  const layer = layers.find((l) => l.id === `hy-country-labels-${tier}`)
  if (!layer) throw new Error(`layer ${tier} missing`)
  return layer
}

describe('ülke adı katmanları (D-095)', () => {
  it('kimlikler alttan üste kademe 3, 2, 1; tek kaynak; kademe süzgeci', () => {
    expect(COUNTRY_LABEL_SOURCE_ID).toBe('hy-country-labels')
    expect(COUNTRY_LABEL_SOURCE_MAX_ZOOM).toBe(7)
    expect(COUNTRY_LABEL_TIERS).toEqual([3, 2, 1])
    expect(COUNTRY_LABEL_LAYER_IDS).toEqual([
      'hy-country-labels-3',
      'hy-country-labels-2',
      'hy-country-labels-1',
    ])
    for (const compact of MODES) {
      const layers = countryLabelLayers({ compact })
      expect(layers.map((l) => l.id)).toEqual(COUNTRY_LABEL_LAYER_IDS)
      for (const [index, tier] of COUNTRY_LABEL_TIERS.entries()) {
        const layer = layers[index]
        expect(layer?.type).toBe('symbol')
        expect(layer?.source).toBe(COUNTRY_LABEL_SOURCE_ID)
        expect(layer?.filter).toEqual(['==', ['get', 'tier'], tier])
      }
    }
  })

  it('yakınlaştırma: kademe 1 z3, 2 z3,5, 3 z4,5’ten; hepsi z8’de biter', () => {
    expect(COUNTRY_LABEL_MIN_ZOOM).toEqual({ 1: 3, 2: 3.5, 3: 4.5 })
    expect([COUNTRY_LABEL_FADE_START_ZOOM, COUNTRY_LABEL_MAX_ZOOM]).toEqual([7, 8])
    const layers = countryLabelLayers({ compact: false })
    expect(layers.map((l) => [l.minzoom, l.maxzoom])).toEqual([
      [4.5, 8],
      [3.5, 8],
      [3, 8],
    ])
  })

  it('yazı boyu: z5’te tasarımın 34 / 22 / 14 px’i; dar haritada 27 / 18 / 14', () => {
    expect(COUNTRY_LABEL_COMPACT_MAX_WIDTH_PX).toBe(767)
    const regular = countryLabelLayers({ compact: false })
    const compact = countryLabelLayers({ compact: true })
    expect(stops(layerOf(regular, 1).layout['text-size'])).toEqual([
      [3, 20],
      [4, 27],
      [5, 34],
      [7, 39],
    ])
    expect(stops(layerOf(regular, 2).layout['text-size'])).toEqual([
      [3.5, 15],
      [4, 17],
      [5, 22],
      [7, 25],
    ])
    expect(stops(layerOf(regular, 3).layout['text-size'])).toEqual([
      [3, 11],
      [5, 14],
      [7, 16],
    ])
    expect(stops(layerOf(compact, 1).layout['text-size'])).toEqual([
      [3, 17],
      [4, 22],
      [5, 27],
      [7, 31],
    ])
    expect(stops(layerOf(compact, 2).layout['text-size'])).toEqual([
      [3.5, 13],
      [4, 14.5],
      [5, 18],
      [7, 20],
    ])
    expect(layerOf(compact, 3).layout['text-size']).toEqual(layerOf(regular, 3).layout['text-size'])
    expect([1, 2, 3].map((t) => countryLabelSizeAt(t as CountryLabelTier, false, 5))).toEqual([
      34, 22, 14,
    ])
    expect([1, 2, 3].map((t) => countryLabelSizeAt(t as CountryLabelTier, true, 5))).toEqual([
      27, 18, 14,
    ])
    for (const tier of COUNTRY_LABEL_TIERS) {
      for (const compactMode of MODES) {
        expect(countryLabelTextSize(tier, compactMode)).toEqual(
          layerOf(countryLabelLayers({ compact: compactMode }), tier).layout['text-size'],
        )
        // Boy yakınlaştırdıkça büyür.
        const sizes = COUNTRY_LABEL_SIZES[compactMode ? 'compact' : 'regular'][tier]
        for (let i = 1; i < sizes.length; i++) {
          expect(sizes[i]?.[0]).toBeGreaterThan(sizes[i - 1]?.[0] ?? Infinity)
          expect(sizes[i]?.[1]).toBeGreaterThan(sizes[i - 1]?.[1] ?? Infinity)
        }
      }
    }
  })

  it('yazı: Overpass 600, 0,32 em, satır 1, ortalı; çakışır, 6 px pay; büyük harf veride', () => {
    expect(COUNTRY_LABEL_FONT).toBe('Overpass SemiBold')
    for (const compact of MODES) {
      for (const layer of countryLabelLayers({ compact })) {
        expect(layer.layout).toMatchObject({
          'text-field': ['get', 'name'],
          'text-font': [COUNTRY_LABEL_FONT],
          'text-letter-spacing': 0.32,
          'text-line-height': 1,
          'text-anchor': 'center',
          'text-justify': 'center',
          'text-padding': 6,
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-rotation-alignment': 'viewport',
          'text-pitch-alignment': 'viewport',
          'symbol-sort-key': ['get', 'rank'],
          visibility: 'visible',
        })
        expect(layer.layout).not.toHaveProperty('text-transform')
      }
    }
  })

  it('kayma: ad başkentte ortalı; tek istisna Slovakya (kademe 3, 2,5 em yukarıda)', () => {
    expect(COUNTRY_LABEL_CENTRED_OFFSET_EM).toEqual([0, 0])
    expect(countryLabelOffsetEm('SK')).toEqual([0, -2.5])
    expect(countryLabelOffsetEm('TR')).toEqual([0, 0])
    expect(countryLabelOffsetEm('AT')).toEqual([0, 0])
    expect(countryLabelOffsetEm('XX')).toEqual([0, 0])
    expect(countryLabelTextOffset(1)).toEqual([0, 0])
    expect(countryLabelTextOffset(2)).toEqual([0, 0])
    expect(countryLabelTextOffset(3)).toEqual([
      'match',
      ['get', 'code'],
      'SK',
      ['literal', [0, -2.5]],
      ['literal', [0, 0]],
    ])
    for (const compact of MODES) {
      for (const tier of COUNTRY_LABEL_TIERS) {
        expect(layerOf(countryLabelLayers({ compact }), tier).layout['text-offset']).toEqual(
          countryLabelTextOffset(tier),
        )
      }
    }
  })

  it('satır: geniş haritada 24 em (tek satır); dar haritada kademe 1–2 10 em, kademe 3 24 em', () => {
    expect([COUNTRY_LABEL_MAX_WIDTH_EM, COUNTRY_LABEL_COMPACT_WRAP_EM]).toEqual([24, 10])
    const width = (compact: boolean) =>
      countryLabelLayers({ compact }).map((l) => [l.id, l.layout['text-max-width']])
    expect(width(false)).toEqual([
      ['hy-country-labels-3', 24],
      ['hy-country-labels-2', 24],
      ['hy-country-labels-1', 24],
    ])
    expect(width(true)).toEqual([
      ['hy-country-labels-3', 24],
      ['hy-country-labels-2', 10],
      ['hy-country-labels-1', 10],
    ])
    expect(countryLabelMaxWidth(1, true)).toBe(10)
    expect(countryLabelMaxWidth(3, true)).toBe(24)
  })

  it('renk: beyaz 0,6 ve koyu hale 0,85; saydamlık renkte, MAP_COLORS opak', () => {
    expect([COUNTRY_LABEL_TEXT_ALPHA, COUNTRY_LABEL_HALO_ALPHA]).toEqual([0.6, 0.85])
    expect(MAP_COLORS.countryLabel).toBe('#FFFFFF')
    expect(MAP_COLORS.countryLabelHalo).toBe('#000000')
    for (const layer of countryLabelLayers({ compact: false })) {
      expect(layer.paint['text-color']).toBe('rgba(255, 255, 255, 0.6)')
      expect(layer.paint['text-halo-color']).toBe('rgba(0, 0, 0, 0.85)')
    }
  })

  it('hale: boyla orantılı; dış ucu glif SDF payını hiçbir durakta aşmaz', () => {
    expect(GLYPH_SDF_REACH_EM).toBe(1 / 8)
    expect([SDF_EDGE_GAMMA_PX, HALO_BLUR_FACTOR]).toEqual([0.84, 1.19])
    for (const compact of MODES) {
      for (const layer of countryLabelLayers({ compact })) {
        const sizes = stops(layer.layout['text-size'])
        const widths = stops(layer.paint['text-halo-width'])
        const blurs = stops(layer.paint['text-halo-blur'])
        expect(widths.map(([z]) => z)).toEqual(sizes.map(([z]) => z))
        expect(blurs.map(([z]) => z)).toEqual(sizes.map(([z]) => z))
        for (const [i, [zoom, size]] of sizes.entries()) {
          const width = widths[i]?.[1] ?? NaN
          const blur = blurs[i]?.[1] ?? NaN
          const where = `${layer.id} ${compact ? 'compact' : 'regular'} z${zoom}`
          expect(width, where).toBeGreaterThan(0)
          expect(blur, where).toBeGreaterThanOrEqual(0)
          // MapLibre symbolSDF: halenin dış ucu genişlik + 1,19 × yumuşaklık + kenar yumuşatması.
          expect(width + HALO_BLUR_FACTOR * blur + SDF_EDGE_GAMMA_PX, where).toBeLessThanOrEqual(
            size / 8,
          )
        }
      }
    }
    // z5 örnekleri: kademe 1 (34 px) en kalın, kademe 3 (14 px) en ince.
    expect(countryLabelHalo(34)).toEqual({ width: 2.21, blur: 0.85 })
    expect(countryLabelHalo(22)).toEqual({ width: 1.24, blur: 0.48 })
    expect(countryLabelHalo(14)).toEqual({ width: 0.59, blur: 0.22 })
    expect(countryLabelHalo(4)).toEqual({ width: 0, blur: 0 })
  })

  it('saydamlık: yarım kademede belirir, z7’de tam, z8’de yok', () => {
    expect(countryLabelOpacityAt(1, 2.9)).toBe(0)
    expect(countryLabelOpacityAt(1, 3)).toBe(0)
    expect(countryLabelOpacityAt(1, 3.25)).toBeCloseTo(0.5, 9)
    expect(countryLabelOpacityAt(1, 3.5)).toBe(1)
    expect(countryLabelOpacityAt(1, 7)).toBe(1)
    expect(countryLabelOpacityAt(1, 7.5)).toBeCloseTo(0.5, 9)
    expect(countryLabelOpacityAt(1, 8)).toBe(0)
    expect(countryLabelOpacityAt(2, 3.4)).toBe(0)
    expect(countryLabelOpacityAt(2, 3.5)).toBe(0)
    expect(countryLabelOpacityAt(2, 4)).toBe(1)
    expect(countryLabelOpacityAt(3, 4.5)).toBe(0)
    expect(countryLabelOpacityAt(3, 5)).toBe(1)
    expect(countryLabelOpacityAt(3, 7.9)).toBeCloseTo(0.1, 9)
    for (const tier of COUNTRY_LABEL_TIERS) {
      for (const zoom of [5, 6, 7]) expect(countryLabelOpacityAt(tier, zoom)).toBe(1)
      expect(countryLabelOpacityAt(tier, 8.5)).toBe(0)
      const layer = layerOf(countryLabelLayers({ compact: false }), tier)
      const min = COUNTRY_LABEL_MIN_ZOOM[tier]
      expect(stops(layer.paint['text-opacity'])).toEqual([
        [min, 0],
        [min + 0.5, 1],
        [7, 1],
        [8, 0],
      ])
    }
    expect(interpolateStops([], 3)).toBe(0)
  })

  it('Gizle: üç katman visibility none', () => {
    for (const layer of countryLabelLayers({ compact: false, visible: false })) {
      expect(layer.layout.visibility).toBe('none')
    }
  })

  it('katmanlar düz JSON', () => {
    for (const layer of countryLabelLayers({ compact: true })) {
      expect(JSON.parse(JSON.stringify(layer)), layer.id).toEqual(layer)
    }
  })
})

describe('countryLabelPoints (D-095)', () => {
  it('59 nokta başkentlerde; Türkiye sıra 0, sonra büyük yüzölçümü önce; sıralar tekil', () => {
    const points = countryLabelPoints('tr')
    expect(points).toHaveLength(59)
    expect(points[0]?.properties).toEqual({ code: 'TR', name: 'TÜRKİYE', tier: 1, rank: 0 })
    expect(points[0]).toMatchObject({ lat: 39.93, lon: 32.86 })
    expect(points.map((p) => p.properties.rank)).toEqual(points.map((_, i) => i))
    const area = new Map(COUNTRY_CAPITALS.map((c) => [c.code, c.areaKm2]))
    for (let i = 2; i < points.length; i++) {
      const previous = area.get(points[i - 1]?.properties.code ?? '') ?? 0
      expect(area.get(points[i]?.properties.code ?? ''), points[i]?.properties.code).toBeLessThan(
        previous,
      )
    }
    expect(points[1]?.properties.code).toBe('RU')
    for (const tier of COUNTRY_LABEL_TIERS) {
      const ranks = points.filter((p) => p.properties.tier === tier).map((p) => p.properties.rank)
      expect(new Set(ranks).size).toBe(ranks.length)
    }
    for (const point of points) {
      const capital = COUNTRY_CAPITALS.find((c) => c.code === point.properties.code)
      if (!capital) throw new Error(point.properties.code)
      expect(point.properties.tier).toBe(countryLabelTier(capital))
      expect([point.lat, point.lon]).toEqual([capital.lat, capital.lon])
    }
  })

  it('adlar sayfanın dilinde büyük harf: Türkçe TÜRKİYE, KIBRIS; İngilizce TÜRKIYE, CYPRUS', () => {
    const names = (locale: 'tr' | 'en') =>
      new Map(countryLabelPoints(locale).map((p) => [p.properties.code, p.properties.name]))
    const tr = names('tr')
    const en = names('en')
    expect([tr.get('TR'), tr.get('CY'), tr.get('XK'), tr.get('IR'), tr.get('AE')]).toEqual([
      'TÜRKİYE',
      'KIBRIS',
      'KOSOVA',
      'İRAN',
      'BİRLEŞİK ARAP EMİRLİKLERİ',
    ])
    expect([
      en.get('TR'),
      en.get('CY'),
      en.get('XK'),
      en.get('IR'),
      en.get('DZ'),
      en.get('BA'),
    ]).toEqual(['TÜRKIYE', 'CYPRUS', 'KOSOVO', 'IRAN', 'ALGERIA', 'BOSNIA AND HERZEGOVINA'])
    for (const name of [...tr.values(), ...en.values()]) expect(name).not.toMatch(/\p{Ll}/u)
    expect(tr.has('IL')).toBe(false)
    expect(tr.has('PS')).toBe(false)
  })
})
