import type { Airport } from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LABEL_SETTINGS } from '../../lib/map/label-settings'
import type { TrackedAircraft } from '../../lib/live/store'
import {
  NORMAL_THEME,
  SELECTED_THEME,
  THY_BAR_WIDTH,
  chipObstacles,
  labelPriority,
  layoutAirportChips,
  measureLabel,
  type LabelFrame,
  type ScreenAirport,
} from './labels'

/** Eş aralıklı yazı: her karakter yazı boyutunun 0,6'sı. */
const measure = (font: string, text: string) => {
  const size = Number(/(\d+)px/.exec(font)?.[1] ?? 12)
  return text.length * size * 0.6
}

describe('measureLabel', () => {
  it('kısa etiket: tek satır, yan boşluklar', () => {
    const size = measureLabel(
      { primary: 'TK-974', primaryMuted: false, lines: [] },
      NORMAL_THEME,
      false,
      measure,
    )
    expect(size.width).toBe(Math.ceil(6 * 13 * 0.6 + NORMAL_THEME.padX * 2))
    expect(size.height).toBe(
      NORMAL_THEME.padTop + NORMAL_THEME.primaryLine + NORMAL_THEME.padBottom,
    )
  })

  it('tam etiket: en geniş satır belirler; THY şeridi genişliğe eklenir', () => {
    const content = { primary: 'TK-4', primaryMuted: false, lines: ['431 km/sa · 333 m'] }
    const size = measureLabel(content, NORMAL_THEME, true, measure)
    expect(size.width).toBe(Math.ceil(17 * 12 * 0.6 + NORMAL_THEME.padX * 2 + THY_BAR_WIDTH))
    expect(size.height).toBe(
      NORMAL_THEME.padTop +
        NORMAL_THEME.primaryLine +
        NORMAL_THEME.secondaryLine +
        NORMAL_THEME.padBottom,
    )
  })

  it('seçili etiket daha büyük yazılır', () => {
    const content = { primary: 'TK-4', primaryMuted: false, lines: [] }
    const normal = measureLabel(content, NORMAL_THEME, false, measure)
    const selected = measureLabel(content, SELECTED_THEME, false, measure)
    expect(selected.width).toBeGreaterThan(normal.width)
    expect(selected.height).toBeGreaterThan(normal.height)
  })
})

describe('labelPriority', () => {
  it('seçili > THY > diğer; aynı grupta ekranın ortasına yakın olan önce', () => {
    const selected = labelPriority(true, false, 0, 0, 800, 600)
    const thyEdge = labelPriority(false, true, 0, 0, 800, 600)
    const otherCentre = labelPriority(false, false, 400, 300, 800, 600)
    const otherEdge = labelPriority(false, false, 10, 10, 800, 600)
    expect(selected).toBeGreaterThan(thyEdge)
    expect(thyEdge).toBeGreaterThan(otherCentre)
    expect(otherCentre).toBeGreaterThan(otherEdge)
    expect(otherCentre).toBeLessThan(2)
  })
})

describe('layoutAirportChips', () => {
  const airport = (iata: string, type: Airport['type']): Airport => ({
    icao: `LT${iata}`,
    iata,
    name: iata,
    city: null,
    lat: 0,
    lon: 0,
    elevationFt: null,
    type,
    scheduled: true,
  })
  const at = (iata: string, type: Airport['type'], x: number, y: number): ScreenAirport => ({
    airport: airport(iata, type),
    x,
    y,
  })
  const view = { width: 400, height: 300 }

  it('kodu noktanın sağına koyar; büyük havalimanı beyaz zeminlidir', () => {
    const [chip] = layoutAirportChips([at('IST', 'large_airport', 100, 100)], view, measure)
    expect(chip).toMatchObject({ iata: 'IST', major: true, y: 91 })
    expect(chip?.x).toBe(107)
  })

  it('yer yoksa sola, üste ya da alta kaydırır; hiçbiri olmazsa yazmaz', () => {
    const chips = layoutAirportChips(
      [
        at('IST', 'large_airport', 100, 100),
        at('ISL', 'medium_airport', 100, 100),
        at('SAW', 'large_airport', 100, 100),
        at('BZI', 'small_airport', 100, 100),
        at('OGU', 'small_airport', 100, 100),
      ],
      view,
      measure,
    )
    // Büyükler önce (IST, SAW), sonra orta (ISL), sonra küçük (BZI); beşincisine yer kalmaz.
    expect(chips.map((chip) => chip.iata)).toEqual(['IST', 'SAW', 'ISL', 'BZI'])
    for (let i = 0; i < chips.length; i++) {
      for (let j = i + 1; j < chips.length; j++) {
        const a = chips[i]
        const b = chips[j]
        if (!a || !b) continue
        const overlap =
          a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
        expect(overlap).toBe(false)
      }
    }
  })

  it('uçak simgesini örtmez: sağdaki uçak kodu sola kaydırır, her yan doluysa kod yazılmaz', () => {
    const ist = at('IST', 'large_airport', 100, 100)
    const frameWith = (
      aircraft: { hex: string; x: number; y: number }[],
      trail: { x: number; y: number }[] = [],
    ): LabelFrame => ({
      width: 400,
      height: 300,
      iconRadius: 14,
      zoom: 10,
      aircraft: aircraft.map(({ hex, x, y }) => ({ ac: { hex } as TrackedAircraft, x, y })),
      airports: [ist],
      trail,
      selectedHex: 'sel',
      settings: DEFAULT_LABEL_SETTINGS,
      locale: 'tr',
      units: 'metric',
    })
    // Pistte, havalimanı noktasının 25 px doğusunda iniş yapan uçak (LTFM 18/36 örneği).
    const [left] = layoutAirportChips(
      [ist],
      view,
      measure,
      chipObstacles(frameWith([{ hex: 'a', x: 125, y: 100 }])),
    )
    expect(left?.x).toBeLessThan(100)
    const blocked = chipObstacles(
      frameWith([
        { hex: 'a', x: 125, y: 100 },
        { hex: 'b', x: 75, y: 100 },
        { hex: 'c', x: 100, y: 75 },
        { hex: 'd', x: 100, y: 125 },
      ]),
    )
    expect(layoutAirportChips([ist], view, measure, blocked)).toEqual([])
  })

  it('seçili uçağın yer izini de örtmez', () => {
    const ist = at('IST', 'large_airport', 100, 100)
    const trail = [
      { x: 110, y: 90 },
      { x: 120, y: 100 },
      { x: 130, y: 110 },
    ]
    const obstacles = chipObstacles({
      width: 400,
      height: 300,
      iconRadius: 14,
      zoom: 12,
      aircraft: [],
      airports: [ist],
      trail,
      selectedHex: null,
      settings: DEFAULT_LABEL_SETTINGS,
      locale: 'tr',
      units: 'metric',
    })
    const [chip] = layoutAirportChips([ist], view, measure, obstacles)
    expect(chip?.x).toBeLessThan(100)
  })

  it('görünümden taşan kod yazılmaz', () => {
    expect(layoutAirportChips([at('VAN', 'medium_airport', -50, 100)], view, measure)).toEqual([])
    const [chip] = layoutAirportChips([at('VAN', 'medium_airport', 395, 100)], view, measure)
    expect(chip?.x).toBeLessThan(395)
  })
})
