import { describe, expect, it } from 'vitest'
import {
  AIRPORT_PIN_HEAD,
  AIRPORT_PIN_ICON_ID,
  AIRPORT_PIN_MARGIN,
  AIRPORT_PIN_PATH,
  AIRPORT_PIN_VIEWBOX,
} from './airport-pin'
import { MAP_COLORS } from './colors'
import {
  AIRCRAFT_LAYER,
  AIRCRAFT_LAYER_ID,
  AIRCRAFT_SOURCE_ID,
  AIRPORT_LAYER,
  AIRPORT_LAYER_ID,
  AIRPORT_SOURCE_ID,
  LIVE_MAP_LAYERS,
  TRAIL_LAYER,
  TRAIL_LAYER_ID,
  TRAIL_SOURCE_ID,
  type StyleExpression,
} from './layers'

/** `['interpolate', ['linear'], ['zoom'], z0, v0, z1, v1 …]` durakları. */
function stops(value: unknown): [number, number][] {
  const expression = value as StyleExpression
  expect(expression.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']])
  const rest = expression.slice(3) as number[]
  expect(rest.length % 2).toBe(0)
  const pairs: [number, number][] = []
  for (let i = 0; i < rest.length; i += 2) pairs.push([rest[i] ?? NaN, rest[i + 1] ?? NaN])
  return pairs
}

describe('MAP_COLORS', () => {
  it('bütün renkler opak 6 haneli hex', () => {
    for (const [name, color] of Object.entries(MAP_COLORS)) {
      expect(color, name).toMatch(/^#[0-9A-F]{6}$/)
    }
  })

  it('tasarım paleti: THY kırmızı-beyaz, seçili kehribar, havada iz seçili renk, yerde camgöbeği', () => {
    expect(MAP_COLORS.thyRed).toBe('#E30A17')
    expect(MAP_COLORS.thyWhite).toBe('#FFFFFF')
    expect(MAP_COLORS.selected).toBe('#FFB300')
    expect(MAP_COLORS.airTrack).toBe(MAP_COLORS.selected)
    expect(MAP_COLORS.groundTrack).toBe('#22D3EE')
    expect(MAP_COLORS.background).toBe('#0B1016')
  })

  it('açık turkuaz tema (D-081): beyaz opak etiket kutusu, açık turkuaz kenar, koyu yazı', () => {
    expect(MAP_COLORS.labelBox).toBe('#FFFFFF')
    expect(MAP_COLORS.labelBorder).toBe('#B9E2E6')
    expect(MAP_COLORS.labelInk).toBe('#0B2A33')
    expect(MAP_COLORS.panel).toBe('#FFFFFF')
    expect(MAP_COLORS.ink).toBe('#0B2A33')
  })

  it('harita yazıları zeminlerine karşı WCAG AA (en az 4,5:1)', () => {
    const pairs: [string, string, string][] = [
      ['labelInk/labelBox', MAP_COLORS.labelInk, MAP_COLORS.labelBox],
      ['labelMuted/labelBox', MAP_COLORS.labelMuted, MAP_COLORS.labelBox],
      ['labelInk/airportChipMinor', MAP_COLORS.labelInk, MAP_COLORS.airportChipMinor],
      ['selectedInk/selected', MAP_COLORS.selectedInk, MAP_COLORS.selected],
      ['ink/panel', MAP_COLORS.ink, MAP_COLORS.panel],
      ['muted/panel', MAP_COLORS.muted, MAP_COLORS.panel],
      ['muted/panelRaised', MAP_COLORS.muted, MAP_COLORS.panelRaised],
    ]
    for (const [name, text, background] of pairs) {
      expect(contrastRatio(text, background), name).toBeGreaterThanOrEqual(4.5)
    }
    // Giriş kutusu kenarı (WCAG 1.4.11, en az 3:1).
    expect(contrastRatio(MAP_COLORS.lineStrong, MAP_COLORS.panel)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(MAP_COLORS.lineStrong, MAP_COLORS.panelRaised)).toBeGreaterThanOrEqual(3)
  })
})

/** WCAG 2.1 kontrast oranı (`#RRGGBB`). */
function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16)
    const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((channel) => {
      const c = channel / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }) as [number, number, number]
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

describe('katmanlar', () => {
  it('kimlikler ve kaynaklar', () => {
    expect([AIRCRAFT_LAYER.id, AIRCRAFT_LAYER.source]).toEqual([
      AIRCRAFT_LAYER_ID,
      AIRCRAFT_SOURCE_ID,
    ])
    expect([AIRPORT_LAYER.id, AIRPORT_LAYER.source]).toEqual([AIRPORT_LAYER_ID, AIRPORT_SOURCE_ID])
    expect([TRAIL_LAYER.id, TRAIL_LAYER.source]).toEqual([TRAIL_LAYER_ID, TRAIL_SOURCE_ID])
    expect(AIRCRAFT_LAYER_ID).toBe('hy-aircraft')
    expect(AIRPORT_LAYER_ID).toBe('hy-airports')
    expect(TRAIL_LAYER_ID).toBe('hy-trail')
  })

  it('sıra alttan üste: havalimanları, iz, uçaklar', () => {
    expect(LIVE_MAP_LAYERS.map((layer) => layer.id)).toEqual([
      AIRPORT_LAYER_ID,
      TRAIL_LAYER_ID,
      AIRCRAFT_LAYER_ID,
    ])
  })

  it('uçak katmanı: ikon, yön ve sıralama özelliklerden; harita düzleminde, hep çizilir', () => {
    expect(AIRCRAFT_LAYER.type).toBe('symbol')
    expect(AIRCRAFT_LAYER.layout).toMatchObject({
      'icon-image': ['get', 'icon'],
      'icon-rotate': ['get', 'trk'],
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'symbol-sort-key': ['get', 'sort'],
    })
    expect(stops(AIRCRAFT_LAYER.layout['icon-size'])).toEqual([
      [4, 0.55],
      [10, 1],
    ])
  })

  it('havalimanı katmanı: kırmızı pin, ucu noktada (alt kenar + pay), hep çizilir, yakınlaştıkça büyür', () => {
    expect(AIRPORT_LAYER.type).toBe('symbol')
    expect(AIRPORT_LAYER.layout).toMatchObject({
      'icon-image': AIRPORT_PIN_ICON_ID,
      'icon-anchor': 'bottom',
      'icon-offset': [0, AIRPORT_PIN_MARGIN],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    })
    const size = stops(AIRPORT_LAYER.layout['icon-size'])
    for (let i = 1; i < size.length; i++) {
      expect(size[i]?.[0]).toBeGreaterThan(size[i - 1]?.[0] ?? Infinity)
      expect(size[i]?.[1]).toBeGreaterThan(size[i - 1]?.[1] ?? Infinity)
    }
    // Kırmızı pin, beyaz kenar: THY kırmızısıyla aynı değildir.
    expect(MAP_COLORS.airport).not.toBe(MAP_COLORS.thyRed)
    expect(MAP_COLORS.airportOutline).toBe('#FFFFFF')
  })

  it('pin yolu: uç görünüm kutusunun altında ortada, baş yukarıda', () => {
    expect(
      AIRPORT_PIN_PATH.startsWith(
        `M${AIRPORT_PIN_VIEWBOX.width / 2} ${AIRPORT_PIN_VIEWBOX.height}`,
      ),
    ).toBe(true)
    expect(AIRPORT_PIN_HEAD.cy + AIRPORT_PIN_HEAD.r).toBeLessThan(AIRPORT_PIN_VIEWBOX.height)
    expect(AIRPORT_PIN_HEAD.cy - AIRPORT_PIN_HEAD.r).toBeGreaterThanOrEqual(0)
  })

  it('iz katmanı: yerde camgöbeği, havada kehribar; düz ve opak', () => {
    expect(TRAIL_LAYER.type).toBe('line')
    expect(TRAIL_LAYER.paint).toEqual({
      'line-color': ['case', ['get', 'gnd'], MAP_COLORS.groundTrack, MAP_COLORS.airTrack],
      'line-width': 3,
      'line-opacity': 1,
    })
    expect(TRAIL_LAYER.layout).toEqual({ 'line-cap': 'round', 'line-join': 'round' })
  })

  it('katmanlar düz JSON: serileştirilip geri okununca aynıdır', () => {
    for (const layer of LIVE_MAP_LAYERS) {
      expect(JSON.parse(JSON.stringify(layer)), layer.id).toEqual(layer)
    }
  })
})
