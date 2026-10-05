// Haritanın WebGL tuvalinden piksel okuma (D-095): pin ucundaki kesitte ülke adının çizildiğini ve
// pinin kırmızısının ad açıkken de görünür kaldığını doğrulamak için. Çizim sırasını (ad pinin
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
