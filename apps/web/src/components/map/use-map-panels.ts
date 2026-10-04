'use client'

import { useEffect, useState, type RefObject } from 'react'
import type { ScreenRect } from '../../lib/map/label-layout'
import { NO_PANELS } from './map-controller'

/**
 * Haritanın üstündeki opak panelleri işaretleyen öznitelik (`data-map-panel`): arama, bilgi kartı,
 * uçak listesi ve sağ alttaki düğmeler. Havalimanı penceresi ve seçili uçağın etiketi bunları
 * örtmeyen yeri seçer (D-085). Kart ile pencere aynı anda açık olmaz.
 */
export const MAP_PANEL_SELECTOR = '[data-map-panel]'

/** İki dikdörtgen listesi aynı mı (aynıysa durum değişmez, harita yeniden çizilmez). */
export function sameRects(a: readonly ScreenRect[], b: readonly ScreenRect[]): boolean {
  return (
    a.length === b.length &&
    a.every((rect, i) => {
      const other = b[i]
      return (
        other !== undefined &&
        rect.x === other.x &&
        rect.y === other.y &&
        rect.width === other.width &&
        rect.height === other.height
      )
    })
  )
}

type Box = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>

/**
 * Elemanların köke göre dikdörtgenleri, tam piksele yuvarlanmış; boyutsuz (gizli) olanlar atlanır.
 */
export function panelRects(origin: Box, rects: readonly Box[]): ScreenRect[] {
  const result: ScreenRect[] = []
  for (const rect of rects) {
    if (!(rect.width > 0 && rect.height > 0)) continue
    result.push({
      x: Math.round(rect.left - origin.left),
      y: Math.round(rect.top - origin.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    })
  }
  return result
}

/**
 * Haritanın üstündeki panellerin haritaya (kök `.live-map`) göre dikdörtgenleri, CSS px. Her karede
 * ölçülmez: panellerin, sol sütunun ya da kökün boyutu değişince (arama sonuçları, daraltılan liste,
 * pencere boyutu) ve `key` değişince (kart açılıp kapanınca panel kümesi değişir) yenilenir. Sol
 * sütundaki bir öğe büyüyünce kart aşağı kayar; sütunun boyutu da değiştiği için yeniden ölçülür.
 */
export function useMapPanels(
  rootRef: RefObject<HTMLElement | null>,
  key: unknown,
): readonly ScreenRect[] {
  const [panels, setPanels] = useState<readonly ScreenRect[]>(NO_PANELS)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const elements = [...root.querySelectorAll<HTMLElement>(MAP_PANEL_SELECTOR)]
    const measure = () => {
      const next = panelRects(
        root.getBoundingClientRect(),
        elements.map((element) => element.getBoundingClientRect()),
      )
      setPanels((previous) => (sameRects(previous, next) ? previous : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    for (const element of elements) observer.observe(element)
    const column = root.querySelector('.live-map__left')
    if (column) observer.observe(column)
    return () => observer.disconnect()
  }, [rootRef, key])

  return panels
}
