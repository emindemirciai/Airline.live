import { describe, expect, it } from 'vitest'
import {
  POPUP_GAP_PX,
  POPUP_MARGIN_PX,
  POPUP_SIDE_GAP_PX,
  placePopup,
  type PopupRect,
} from './popup-placement'

const view = { width: 1000, height: 600 }
const size = { width: 300, height: 280 }

describe('placePopup', () => {
  it('yer varsa noktanın sağında, dikeyde ortalı', () => {
    expect(placePopup({ anchor: { x: 200, y: 300 }, size, view })).toEqual({
      left: 200 + POPUP_SIDE_GAP_PX,
      top: 160,
      side: 'right',
    })
  })

  it('sağda yer yoksa solunda', () => {
    const placement = placePopup({ anchor: { x: 900, y: 300 }, size, view })
    expect(placement).toEqual({ left: 900 - POPUP_SIDE_GAP_PX - 300, top: 160, side: 'left' })
  })

  it('yandaki IATA kodu (noktanın 7 px sağında, 3 harf) pencerenin altında kalmaz', () => {
    const chipRight = 200 + 7 + 32
    const right = placePopup({ anchor: { x: 200, y: 300 }, size, view })
    expect(right.left).toBeGreaterThan(chipRight)
    const chipLeft = 900 - 7 - 32
    const left = placePopup({ anchor: { x: 900, y: 300 }, size, view })
    expect(left.left + size.width).toBeLessThan(chipLeft)
  })

  it('üst ve alt kenarda dikeyde kaydırılır, nokta pencerenin yanında kalır', () => {
    expect(placePopup({ anchor: { x: 200, y: 20 }, size, view })).toMatchObject({
      top: POPUP_MARGIN_PX,
      side: 'right',
    })
    expect(placePopup({ anchor: { x: 200, y: 590 }, size, view })).toMatchObject({
      top: 600 - POPUP_MARGIN_PX - 280,
      side: 'right',
    })
  })

  it('dar görünümde altına ya da üstüne konur, yatayda kaydırılır', () => {
    const narrow = { width: 400, height: 900 }
    expect(placePopup({ anchor: { x: 200, y: 100 }, size, view: narrow })).toEqual({
      left: 50,
      top: 100 + POPUP_GAP_PX,
      side: 'below',
    })
    expect(placePopup({ anchor: { x: 250, y: 800 }, size, view: narrow })).toEqual({
      left: 400 - POPUP_MARGIN_PX - 300,
      top: 800 - POPUP_GAP_PX - 280,
      side: 'above',
    })
  })

  it('hiçbir yön sığmazsa görünümün içine sıkıştırılır (nokta görünüm dışında da olsa)', () => {
    const tiny = { width: 320, height: 300 }
    const placement = placePopup({ anchor: { x: 160, y: 150 }, size, view: tiny })
    expect(placement.side).toBe('inside')
    expect(placement.left).toBeGreaterThanOrEqual(POPUP_MARGIN_PX)
    expect(placement.left + size.width).toBeLessThanOrEqual(tiny.width - POPUP_MARGIN_PX)
    expect(placement.top).toBeGreaterThanOrEqual(POPUP_MARGIN_PX)

    const off = placePopup({ anchor: { x: -500, y: -400 }, size, view })
    expect(off.left).toBeGreaterThanOrEqual(POPUP_MARGIN_PX)
    expect(off.top).toBeGreaterThanOrEqual(POPUP_MARGIN_PX)
    expect(off.left + size.width).toBeLessThanOrEqual(view.width)
  })

  it('pencere hiçbir zaman görünümden taşmaz', () => {
    for (let x = -100; x <= 1100; x += 50) {
      for (let y = -100; y <= 700; y += 50) {
        const { left, top } = placePopup({ anchor: { x, y }, size, view })
        expect(left).toBeGreaterThanOrEqual(POPUP_MARGIN_PX)
        expect(top).toBeGreaterThanOrEqual(POPUP_MARGIN_PX)
        expect(left + size.width).toBeLessThanOrEqual(view.width - POPUP_MARGIN_PX)
        expect(top + size.height).toBeLessThanOrEqual(view.height - POPUP_MARGIN_PX)
      }
    }
  })

  it('tam piksele yuvarlanır', () => {
    const { left, top } = placePopup({ anchor: { x: 200.4, y: 300.7 }, size, view })
    expect(Number.isInteger(left)).toBe(true)
    expect(Number.isInteger(top)).toBe(true)
  })
})

describe('placePopup: kaçınılacak paneller (D-085)', () => {
  // Dört yönün de sığdığı görünüm: sağ {544, 260}, sol {156, 260}, alt {350, 414}, üst {350, 106}.
  const wide = { width: 1000, height: 800 }
  const anchor = { x: 500, y: 400 }
  const place = (avoid: readonly PopupRect[]) => placePopup({ anchor, size, view: wide, avoid })
  /** Sağ üstteki uçak listesi gibi: sağ yönü örter. */
  const list: PopupRect = { left: 700, top: 0, width: 300, height: 400 }

  it('kaçınılacak alan yoksa sonuç eskisiyle aynıdır', () => {
    expect(place([])).toEqual({ left: 544, top: 260, side: 'right' })
    for (let x = -100; x <= 1100; x += 50) {
      for (let y = -100; y <= 700; y += 50) {
        const input = { anchor: { x, y }, size, view }
        expect(placePopup({ ...input, avoid: [] })).toEqual(placePopup(input))
      }
    }
  })

  it('sağ yönü örten panel varsa sol seçilir', () => {
    expect(place([list])).toEqual({ left: 156, top: 260, side: 'left' })
  })

  it('sağ ve sol örtülüyse alt seçilir', () => {
    const left: PopupRect = { left: 0, top: 200, width: 300, height: 200 }
    expect(place([list, left])).toEqual({ left: 350, top: 414, side: 'below' })
  })

  it('her yön örtülüyse en az örten seçilir; eşitlikte sıradaki ilki', () => {
    // Sağ yarı ve sol yarı: sağ 300×280, sol 252×280, alt ve üst (58 + 138)×280 örtülür.
    const right: PopupRect = { left: 520, top: 0, width: 480, height: 800 }
    const left: PopupRect = { left: 0, top: 0, width: 400, height: 800 }
    expect(place([right, left])).toEqual({ left: 350, top: 414, side: 'below' })
    // Bütün görünümü örten panel: hepsi eşit, ilk yön (sağ).
    expect(place([{ left: 0, top: 0, width: 1000, height: 800 }]).side).toBe('right')
  })

  it('panelin çevresinde kenar boşluğu kadar yer bırakılır', () => {
    // Sağ yöndeki pencere x 544–844'tedir.
    const near: PopupRect = { left: 844 + POPUP_MARGIN_PX - 2, top: 260, width: 100, height: 100 }
    expect(place([near]).side).toBe('left')
    const clear: PopupRect = { ...near, left: 844 + POPUP_MARGIN_PX + 1 }
    expect(place([clear]).side).toBe('right')
  })

  it('hiçbir yön sığmazsa kaçınma yok sayılır, pencere görünümün içine sıkıştırılır', () => {
    const tiny = { width: 320, height: 300 }
    const avoid: PopupRect[] = [{ left: 0, top: 0, width: 320, height: 300 }]
    expect(placePopup({ anchor: { x: 160, y: 150 }, size, view: tiny, avoid }).side).toBe('inside')
  })
})
