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
 *
 * Kaçınılacak alanlar (D-085; uçak listesi, arama kutusu, sağ alttaki düğmeler): sığan yönlerden
 * hiçbirini örtmeyen ilki seçilir; hepsi örtüyorsa en az örteni (eşitlikte sıradaki ilki). Pencere
 * o zaman panelin üstünde çizilir, kapatma düğmesi ve bağlantı yine erişilebilir kalır. Kaçınılacak
 * alan yoksa sonuç eskisiyle aynıdır.
 */

export type PopupSide = 'right' | 'left' | 'below' | 'above' | 'inside'

export interface PopupPlacement {
  /** Görünümün sol üst köşesine göre, CSS px. */
  left: number
  top: number
  side: PopupSide
}

/** Görünümün sol üst köşesine göre dikdörtgen, CSS px. */
export interface PopupRect {
  left: number
  top: number
  width: number
  height: number
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
  /** Görünüm kenarında bırakılan boşluk; kaçınılacak alanların çevresinde de bırakılır. */
  margin?: number
  /** Pencerenin örtmemesi gereken paneller (görünüme göre), CSS px. */
  avoid?: readonly PopupRect[]
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

/** İki dikdörtgenin kesişim alanı, px²; kesişmiyorlarsa 0. */
function overlapArea(a: PopupRect, b: PopupRect): number {
  const width = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)
  const height = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top)
  return width > 0 && height > 0 ? width * height : 0
}

export function placePopup({
  anchor,
  size,
  view,
  sideGap = POPUP_SIDE_GAP_PX,
  gap = POPUP_GAP_PX,
  margin = POPUP_MARGIN_PX,
  avoid = [],
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

  // Sığan yönler, sırayla (sağ, sol, alt, üst).
  const candidates: PopupPlacement[] = []
  if (fitsHeight) {
    const top = clamp(y - height / 2, minTop, maxTop)
    if (x + sideGap + width <= view.width - margin && x + sideGap >= minLeft) {
      candidates.push(round({ left: x + sideGap, top, side: 'right' }))
    }
    if (x - sideGap - width >= margin && x - sideGap <= view.width - margin) {
      candidates.push(round({ left: x - sideGap - width, top, side: 'left' }))
    }
  }
  if (fitsWidth) {
    const left = clamp(x - width / 2, minLeft, maxLeft)
    if (y + gap + height <= view.height - margin && y + gap >= minTop) {
      candidates.push(round({ left, top: y + gap, side: 'below' }))
    }
    if (y - gap - height >= margin && y - gap <= view.height - margin) {
      candidates.push(round({ left, top: y - gap - height, side: 'above' }))
    }
  }

  const first = candidates[0]
  if (first === undefined) {
    return round({
      left: clamp(x + sideGap, minLeft, maxLeft),
      top: clamp(y - height / 2, minTop, maxTop),
      side: 'inside',
    })
  }
  if (avoid.length === 0) return first

  // Paneller kenar boşluğu kadar büyütülür: pencere panele yapışmaz.
  const grown = avoid.map((rect) => ({
    left: rect.left - margin,
    top: rect.top - margin,
    width: rect.width + 2 * margin,
    height: rect.height + 2 * margin,
  }))
  let best = first
  let bestOverlap = Infinity
  for (const candidate of candidates) {
    const box = { left: candidate.left, top: candidate.top, width, height }
    const overlap = grown.reduce((sum, rect) => sum + overlapArea(box, rect), 0)
    if (overlap === 0) return candidate
    if (overlap < bestOverlap) {
      best = candidate
      bestOverlap = overlap
    }
  }
  return best
}
