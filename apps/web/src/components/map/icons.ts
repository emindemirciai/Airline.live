/**
 * Uçak ikonlarının bitmapleri. `packages/shared` silüetleri (silhouettes.ts) tuvale çizilir ve
 * katman eklenmeden önce her `hy-ac-<sınıf>-<tür>` için `map.addImage(id, image, {pixelRatio})`
 * ile haritaya verilir (MapLibre v6: `styleimagemissing` yalnızca bildirimdir).
 *
 * Görünüm kullanıcının tasarım tuvalindendir: THY kırmızı gövde, beyaz kenar ve beyaz kuyruk
 * vurgusu; diğerleri açık gri gövde, koyu kenar; seçili uçak kehribar gövde, koyu kenar ve etrafında
 * opak bir halka (kehribar, iki yanı koyu). Kenar önce kalın çizilir, dolgu üstüne gelir; böylece
 * kenar yalnızca silüetin dışında kalır ve alt yolların iç kenarları görünmez.
 */
import {
  AIRCRAFT_CATEGORIES,
  AIRCRAFT_SILHOUETTES,
  AIRCRAFT_TAIL_ACCENTS,
  AIRCRAFT_VARIANTS,
  MAP_COLORS,
  SILHOUETTE_VIEWBOX,
  aircraftIconId,
  type AircraftCategory,
  type AircraftIconId,
  type AircraftVariant,
} from '@havayolu/shared'

/** THY ve diğer uçak ikonunun kenarı, CSS px (katmanın `icon-size` 1 olduğunda). */
export const AIRCRAFT_ICON_SIZE = 32
/** Seçili ikonun tuvali: halka için daha geniştir. */
export const SELECTED_ICON_SIZE = 52
/** Seçili ikondaki silüetin kutusu (halkanın içinde, diğerlerinden biraz büyük). */
const SELECTED_PLANE_BOX = 34
/** Halkanın merkeze uzaklığı ve bandı (kehribar çizgi, iki yanında koyu kenar). */
const RING_RADIUS = 21.5
const RING_WIDTH = 3
const RING_EDGE = 2
/** Kenar çizgisi taşmasın diye görünüm kutusunun çevresine bırakılan pay (silüet birimi). */
const VIEWBOX_MARGIN = 4

interface VariantStyle {
  fill: string
  outline: string
  /** Silüetin dışında kalan kenar kalınlığı, silüet birimi. */
  outlineWidth: number
  /** Kuyruk vurgusunun rengi; null ise çizilmez. */
  accent: string | null
  ring: boolean
}

const VARIANT_STYLES: Readonly<Record<AircraftVariant, VariantStyle>> = {
  thy: {
    fill: MAP_COLORS.thyRed,
    outline: MAP_COLORS.thyWhite,
    outlineWidth: 3.4,
    accent: MAP_COLORS.thyWhite,
    ring: false,
  },
  other: {
    fill: MAP_COLORS.aircraft,
    outline: MAP_COLORS.aircraftOutline,
    outlineWidth: 2.8,
    accent: null,
    ring: false,
  },
  selected: {
    fill: MAP_COLORS.selected,
    outline: MAP_COLORS.aircraftOutline,
    outlineWidth: 2.8,
    accent: null,
    ring: true,
  },
}

/** İkon tuvalinin kenarı, CSS px. */
export function iconSize(variant: AircraftVariant): number {
  return variant === 'selected' ? SELECTED_ICON_SIZE : AIRCRAFT_ICON_SIZE
}

/**
 * Cihaz piksel oranı: keskin ikon için gerçek oran, 1–3 aralığında. Bitmap kenarı tam sayı
 * olsun diye oran, seçilen boyuta göre `addImage`'a ayrıca verilir (`AircraftIconImage.pixelRatio`).
 */
export function iconPixelRatio(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 1) return 1
  return Math.min(devicePixelRatio, 3)
}

export interface AircraftIconImage {
  id: AircraftIconId
  image: ImageData
  pixelRatio: number
}

function drawRing(ctx: CanvasRenderingContext2D, center: number): void {
  ctx.beginPath()
  ctx.arc(center, center, RING_RADIUS, 0, Math.PI * 2)
  ctx.lineWidth = RING_WIDTH + RING_EDGE * 2
  ctx.strokeStyle = MAP_COLORS.background
  ctx.stroke()
  ctx.lineWidth = RING_WIDTH
  ctx.strokeStyle = MAP_COLORS.selected
  ctx.stroke()
}

/** Tek ikonu çizer; bitmap kenarı `round(boyut × oran)` px'tir. */
export function renderAircraftIcon(
  category: AircraftCategory,
  variant: AircraftVariant,
  devicePixelRatio: number,
): AircraftIconImage {
  const style = VARIANT_STYLES[variant]
  const size = iconSize(variant)
  const pixels = Math.max(1, Math.round(size * iconPixelRatio(devicePixelRatio)))
  const pixelRatio = pixels / size
  const canvas = document.createElement('canvas')
  canvas.width = pixels
  canvas.height = pixels
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context is unavailable')
  ctx.scale(pixelRatio, pixelRatio)

  if (style.ring) drawRing(ctx, size / 2)

  const box = variant === 'selected' ? SELECTED_PLANE_BOX : size
  const units = SILHOUETTE_VIEWBOX + VIEWBOX_MARGIN * 2
  const scale = box / units
  ctx.save()
  ctx.translate((size - box) / 2, (size - box) / 2)
  ctx.scale(scale, scale)
  ctx.translate(VIEWBOX_MARGIN, VIEWBOX_MARGIN)
  const body = new Path2D(AIRCRAFT_SILHOUETTES[category])
  ctx.lineJoin = 'round'
  ctx.lineWidth = style.outlineWidth * 2
  ctx.strokeStyle = style.outline
  ctx.stroke(body)
  ctx.fillStyle = style.fill
  ctx.fill(body)
  if (style.accent) {
    ctx.fillStyle = style.accent
    ctx.fill(new Path2D(AIRCRAFT_TAIL_ACCENTS[category]))
  }
  ctx.restore()

  return {
    id: aircraftIconId(category, variant),
    image: ctx.getImageData(0, 0, pixels, pixels),
    pixelRatio,
  }
}

/** Bütün sınıf × tür ikonları (`AIRCRAFT_ICON_IDS` ile aynı küme). */
export function renderAircraftIcons(devicePixelRatio: number): AircraftIconImage[] {
  return AIRCRAFT_CATEGORIES.flatMap((category) =>
    AIRCRAFT_VARIANTS.map((variant) => renderAircraftIcon(category, variant, devicePixelRatio)),
  )
}
