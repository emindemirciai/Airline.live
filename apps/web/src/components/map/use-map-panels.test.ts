import { describe, expect, it } from 'vitest'
import { MAP_PANEL_SELECTOR, panelRects, sameRects } from './use-map-panels'

const box = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
})

describe('harita panelleri (D-085)', () => {
  it('dikdörtgenler haritanın köküne göredir, tam piksele yuvarlanır; boyutsuz panel atlanır', () => {
    const root = box(0, 56, 768, 968)
    expect(
      panelRects(root, [box(404.4, 68, 352, 441.6), box(12, 68, 380, 0), box(632.5, 900, 124, 92)]),
    ).toEqual([
      { x: 404, y: 12, width: 352, height: 442 },
      { x: 633, y: 844, width: 124, height: 92 },
    ])
  })

  it('aynı değerli listeler aynı sayılır (harita yeniden çizilmez)', () => {
    const list = { x: 404, y: 12, width: 352, height: 442 }
    const a = [list]
    expect(sameRects(a, [{ ...list }])).toBe(true)
    expect(sameRects(a, [{ x: 404, y: 12, width: 352, height: 300 }])).toBe(false)
    expect(sameRects(a, [])).toBe(false)
    expect(sameRects([], [])).toBe(true)
  })

  it('öznitelik seçicisi', () => {
    expect(MAP_PANEL_SELECTOR).toBe('[data-map-panel]')
  })
})
