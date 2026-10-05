// Haritanın WebGL tuvalinden piksel okuma (D-095, D-096): pin ucundaki kesitte ülke adının
// çizildiğini, pinin kırmızısının ad açıkken de görünür kaldığını ve adın çizilen piksellerinin
// modelin öngördüğü kutunun içinde kaldığını doğrulamak için. Çizim sırasını (ad pinin
// altında mı) bu kesit ayırt etmez; sıra birim testindedir (live-map.spec.ts'teki açıklama). Tuval
// `preserveDrawingBuffer` olmadan çizildiğinden pikseller sayfanın ekran görüntüsünden okunur; PNG
// sayfanın içinde çözülür (ek bağımlılık yok).
import type { Page } from '@playwright/test'

/** Havalimanı pininin rengi (`MAP_COLORS.airport`): #E53935. */
const PIN_RED = { r: 229, g: 57, b: 53 }
/** Kanal başına en çok fark (yumuşatma ve renk dönüşümü payı). */
const PIN_RED_TOLERANCE = 24

/** Pin ucunun çevresindeki kesit: kırmızı piksel sayısı ve kırmızı olmayan piksellerin baytları. */
export interface PinPixels {
  red: number
  /** Kırmızı olmayan piksellerin RGB değerleri, sırayla (iki ölçüm karşılaştırılır). */
  other: string
}

/**
 * Ucu `tip`te (sayfa koordinatı, CSS px) duran pinin kesiti: x ±8, y −18…+1. Kırmızı pikseller pinin
 * gövdesidir; üstüne bir şey çizilirse azalır ya da renk değiştirir. Kırmızı olmayan pikseller pinin
 * çevresidir (altlık, varsa ülke adının harfi ve halesi).
 */
export async function pinPixels(page: Page, tip: { x: number; y: number }): Promise<PinPixels> {
  const clip = { x: Math.round(tip.x) - 8, y: Math.round(tip.y) - 18, width: 16, height: 19 }
  const png = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' })
  return page.evaluate(
    async ({ data, red, tolerance }) => {
      const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) return { red: 0, other: '' }
      ctx.drawImage(bitmap, 0, 0)
      const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data
      let count = 0
      const other: number[] = []
      for (let i = 0; i < pixels.length; i += 4) {
        const [r = 0, g = 0, b = 0] = [pixels[i], pixels[i + 1], pixels[i + 2]]
        if (
          Math.abs(r - red.r) <= tolerance &&
          Math.abs(g - red.g) <= tolerance &&
          Math.abs(b - red.b) <= tolerance
        ) {
          count++
        } else {
          other.push(r, g, b)
        }
      }
      return { red: count, other: other.join(',') }
    },
    { data: png.toString('base64'), red: PIN_RED, tolerance: PIN_RED_TOLERANCE },
  )
}

/** Kesitin (sayfa koordinatı, CSS px) ekran görüntüsü, PNG base64. */
export async function clipImage(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const png = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' })
  return png.toString('base64')
}

/** İki kesit görüntüsünde farklı piksellerin sınırları (kesite göre, dahil) ve sayısı. */
export interface ChangedPixels {
  count: number
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Aynı kesitin iki görüntüsünü karşılaştırır: bir kanalı `threshold`'dan çok değişen pikseller
 * (ör. ülke adı açıkken ve kapalıyken). Fark yoksa `count` 0'dır.
 */
export async function changedPixels(
  page: Page,
  before: string,
  after: string,
  threshold = 8,
): Promise<ChangedPixels> {
  return page.evaluate(
    async ({ images, threshold }) => {
      const decode = async (data: string) => {
        const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('2d context')
        ctx.drawImage(bitmap, 0, 0)
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
      }
      const [a, b] = await Promise.all(images.map(decode))
      if (!a || !b) throw new Error('decode')
      const result = { count: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      for (let y = 0; y < a.height; y++) {
        for (let x = 0; x < a.width; x++) {
          const i = (y * a.width + x) * 4
          let delta = 0
          for (let c = 0; c < 3; c++)
            delta = Math.max(delta, Math.abs((a.data[i + c] ?? 0) - (b.data[i + c] ?? 0)))
          if (delta <= threshold) continue
          result.count++
          result.minX = Math.min(result.minX, x)
          result.minY = Math.min(result.minY, y)
          result.maxX = Math.max(result.maxX, x)
          result.maxY = Math.max(result.maxY, y)
        }
      }
      return result
    },
    { images: [before, after], threshold },
  )
}
