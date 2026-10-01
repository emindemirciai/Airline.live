/**
 * Havalimanı penceresinin geniş ekrandaki yeri (airport-popup.tsx): havalimanı noktasının yanında,
 * görünümün içinde kalacak biçimde. Saf modül; harita her çizildiğinde (kaydırma, yakınlaştırma)
 * yeniden hesaplanır ve yalnızca sonuç değişince DOM'a yazılır.
 *
 * Sıra: sağ, sol, alt, üst. Sağ ve solda pencere dikey olarak, alt ve üstte yatay olarak kaydırılıp
 * görünüme sığdırılır; nokta pencerenin altında kalmaz. Sağ ve soldaki boşluk, kodun olağan yeri
 * olan noktanın sağındaki ya da solundaki IATA kodunu da açıkta bırakır (labels.ts). Hiçbir yön sığmıyorsa (çok küçük görünüm
 * ya da nokta görünümün dışına kaydırılmış) pencere görünümün içine sıkıştırılır: kapatma düğmesi
 * ve bağlantı her zaman erişilebilir kalır.
 */

export type PopupSide = 'right' | 'left' | 'below' | 'above' | 'inside'

export interface PopupPlacement {
  /** Görünümün sol üst köşesine göre, CSS px. */
  left: number
  top: number
  side: PopupSide
}

export interface PlacementInput {
  /** Havalimanı noktasının görünümdeki yeri, CSS px. */
  anchor: { x: number; y: number }
  /** Pencerenin boyutu, CSS px. */
  size: { width: number; height: number }
  /** Pencerenin kalacağı alan (harita eksi atıf şeridi), CSS px. */
  view: { width: number; height: number }
  /** Nokta ile pencere arası, sağ ve sol konumda. */
  sideGap?: number
  /** Nokta ile pencere arası, alt ve üst konumda. */
  gap?: number
  /** Görünüm kenarında bırakılan boşluk. */
  margin?: number
}

/** Alt ve üst konumda noktanın yarıçapı ve tıklama payı kadar boşluk: pencere noktayı örtmez. */
export const POPUP_GAP_PX = 14
/**
 * Sağ ve sol konumda boşluk: noktanın yanındaki IATA kodu (noktadan 7 px uzakta, 3 harf ve iç
 * boşluklarla yaklaşık 32 px genişlikte; labels.ts → `layoutAirportChips`) pencerenin altında kalmaz.
 */
export const POPUP_SIDE_GAP_PX = 44
export const POPUP_MARGIN_PX = 8

function clamp(value: number, min: number, max: number): number {
  return max < min ? min : Math.min(Math.max(value, min), max)
}

export function placePopup({
  anchor,
  size,
  view,
  sideGap = POPUP_SIDE_GAP_PX,
  gap = POPUP_GAP_PX,
  margin = POPUP_MARGIN_PX,
}: PlacementInput): PopupPlacement {
  const { x, y } = anchor
  const { width, height } = size
  const minLeft = margin
  const maxLeft = view.width - margin - width
  const minTop = margin
  const maxTop = view.height - margin - height
  const fitsHeight = height <= view.height - 2 * margin
  const fitsWidth = width <= view.width - 2 * margin
  const round = (placement: PopupPlacement): PopupPlacement => ({
    left: Math.round(placement.left),
    top: Math.round(placement.top),
    side: placement.side,
  })

  if (fitsHeight) {
    const top = clamp(y - height / 2, minTop, maxTop)
    if (x + sideGap + width <= view.width - margin && x + sideGap >= minLeft) {
      return round({ left: x + sideGap, top, side: 'right' })
    }
    if (x - sideGap - width >= margin && x - sideGap <= view.width - margin) {
      return round({ left: x - sideGap - width, top, side: 'left' })
    }
  }
  if (fitsWidth) {
    const left = clamp(x - width / 2, minLeft, maxLeft)
    if (y + gap + height <= view.height - margin && y + gap >= minTop) {
      return round({ left, top: y + gap, side: 'below' })
    }
    if (y - gap - height >= margin && y - gap <= view.height - margin) {
      return round({ left, top: y - gap - height, side: 'above' })
    }
  }
  return round({
    left: clamp(x + sideGap, minLeft, maxLeft),
    top: clamp(y - height / 2, minTop, maxTop),
    side: 'inside',
  })
}
