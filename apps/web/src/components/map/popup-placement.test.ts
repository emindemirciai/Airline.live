import { describe, expect, it } from 'vitest'
import { POPUP_GAP_PX, POPUP_MARGIN_PX, POPUP_SIDE_GAP_PX, placePopup } from './popup-placement'

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
