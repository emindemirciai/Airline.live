// Havalimanı kod kutularının etiket tuvalindeki yeri (D-079, D-084). Kutular `.live-map__labels`
// tuvaline çizilir, DOM'da yoktur; testler tuvalin piksellerinden okur.
import type { Page } from '@playwright/test'

/** Tuvalde bulunan kutu: ortası sayfa koordinatıyla, boyutu iç beyazınınki (CSS px). */
export interface CanvasChip {
  x: number
  y: number
  width: number
  height: number
}

/** Kod kutusunun kenar rengi (`MAP_COLORS.labelBorder`, D-081): #B9E2E6. */
const CHIP_BORDER = { r: 185, g: 226, b: 230 }

/** Yalnız koddan oluşan kutunun en çok genişliği (iç beyazı; "IST" ~30 px, kod ve ad daha geniş). */
export const CODE_CHIP_MAX_WIDTH = 48

/**
 * Tuvaldeki havalimanı kutuları, `near`a uzaklığa göre sıralı. Uçak etiketleri de kod kutusu gibi
 * beyaz zeminli ve #B9E2E6 kenarlıdır (D-081): tuvaldeki beyaz pikseller tek bir kutu sayılmaz.
 * Beyaz pikseller bağlı bölgelere ayrılır; kod kutusu yüksekliğinde (iç beyazı 11–15 px; uçak
 * etiketi daha yüksektir), en az 14 ve en çok `maxWidth` px geniş ve sol ile sağ kenarı #B9E2E6
 * tonunda olan bölgeler kutudur. Kod ve ad kutusu (D-084) aynı yükseklikte, daha geniştir.
 */
export async function canvasChips(
  page: Page,
  near: { x: number; y: number },
  maxWidth = 240,
): Promise<CanvasChip[]> {
  return page.locator('.live-map .live-map__labels').evaluate(
    (element, { near, border, maxWidth }) => {
      const canvas = element as HTMLCanvasElement
      const ctx = canvas.getContext('2d')
      if (!ctx || canvas.width === 0) return []
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const rect = canvas.getBoundingClientRect()
      const scale = canvas.width / rect.width
      const isWhite = (p: number) =>
        data[p * 4] === 255 &&
        data[p * 4 + 1] === 255 &&
        data[p * 4 + 2] === 255 &&
        data[p * 4 + 3] === 255
      // Kenar: beyaz bölgenin dışındaki ilk 3 pikselden biri #B9E2E6 tonundadır. Kutu kesirli
      // konumdaysa kenar çizgisi yumuşatılır: ilk piksel beyaza yakın, kenar rengi bir sonrakinde,
      // tuvalin saydam zemininde de yarı saydam kalır.
      const hasEdge = (x0: number, y: number, step: -1 | 1) => {
        for (let k = 1; k <= 3; k++) {
          const x = x0 + step * k
          if (x < 0 || y < 0 || x >= width || y >= height) return false
          const i = (y * width + x) * 4
          const [r = 0, g = 0, b = 0, a = 0] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
          if (
            a >= 30 &&
            g - r >= 12 &&
            b - r >= 12 &&
            Math.abs(g - border.g) <= 30 &&
            Math.abs(b - border.b) <= 30
          ) {
            return true
          }
        }
        return false
      }
      const seen = new Uint8Array(width * height)
      const chips: { x: number; y: number; width: number; height: number }[] = []
      for (let start = 0; start < width * height; start++) {
        if (seen[start] || !isWhite(start)) continue
        seen[start] = 1
        const stack = [start]
        let minX = width
        let minY = height
        let maxX = -1
        let maxY = -1
        while (stack.length > 0) {
          const p = stack.pop() ?? 0
          const x = p % width
          const y = (p - x) / width
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
          for (const q of [p - 1, p + 1, p - width, p + width]) {
            if (q < 0 || q >= width * height || seen[q]) continue
            if (Math.abs((q % width) - x) > 1) continue
            if (!isWhite(q)) continue
            seen[q] = 1
            stack.push(q)
          }
        }
        const w = (maxX - minX + 1) / scale
        const h = (maxY - minY + 1) / scale
        // Kod kutusu 16 px yüksektir (iç beyazı ~14 px); uçak etiketi en az 20 px (iç beyazı ~18 px).
        if (h < 11 || h > 15 || w < 14 || w > maxWidth) continue
        const midY = Math.round((minY + maxY) / 2)
        if (!hasEdge(minX, midY, -1) || !hasEdge(maxX, midY, 1)) continue
        chips.push({
          x: rect.left + (minX + maxX + 1) / 2 / scale,
          y: rect.top + (minY + maxY + 1) / 2 / scale,
          width: w,
          height: h,
        })
      }
      const distance = (c: { x: number; y: number }) => Math.hypot(c.x - near.x, c.y - near.y)
      return chips.sort((a, b) => distance(a) - distance(b))
    },
    { near, border: CHIP_BORDER, maxWidth },
  )
}

/** Etiket tuvalinde çizili (saydam olmayan) piksel sayısı. */
export async function paintedPixels(page: Page): Promise<number> {
  return page.locator('.live-map .live-map__labels').evaluate((element) => {
    const canvas = element as HTMLCanvasElement
    const ctx = canvas.getContext('2d')
    if (!ctx || canvas.width === 0) return 0
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let count = 0
    for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 0) > 0) count++
    return count
  })
}

/** Harita tuvalinin ortası, sayfa koordinatıyla (CSS px). */
export async function mapCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('.live-map .maplibregl-canvas').boundingBox()
  if (!box) throw new Error('harita tuvali yok')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Seçili uçak etiketinin zemini (`MAP_COLORS.selected`): #FFB300. */
const SELECTED_FILL = { r: 255, g: 179, b: 0 }

/**
 * Seçili uçak etiketinin tuvaldeki pikselleri (zemin rengi #FFB300, tam opak): toplam ve `selector`
 * elemanının kutusunun içine düşenler. Etiket tuvali panellerin altındadır; panelin örttüğü
 * pikseller de okunur (D-085: seçili etiket listenin altında kalmaz).
 */
export async function selectedLabelPixels(
  page: Page,
  selector: string,
): Promise<{ total: number; under: number }> {
  return page.locator('.live-map .live-map__labels').evaluate(
    (element, { selector, fill }) => {
      const canvas = element as HTMLCanvasElement
      const ctx = canvas.getContext('2d')
      const panel = document.querySelector(selector)?.getBoundingClientRect()
      if (!ctx || canvas.width === 0 || !panel) return { total: 0, under: 0 }
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const rect = canvas.getBoundingClientRect()
      const scale = canvas.width / rect.width
      let total = 0
      let under = 0
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4
          if (
            data[i] !== fill.r ||
            data[i + 1] !== fill.g ||
            data[i + 2] !== fill.b ||
            data[i + 3] !== 255
          ) {
            continue
          }
          total++
          const pageX = rect.left + (x + 0.5) / scale
          const pageY = rect.top + (y + 0.5) / scale
          if (
            pageX > panel.left &&
            pageX < panel.right &&
            pageY > panel.top &&
            pageY < panel.bottom
          ) {
            under++
          }
        }
      }
      return { total, under }
    },
    { selector, fill: SELECTED_FILL },
  )
}
