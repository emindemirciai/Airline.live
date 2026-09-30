// apps/web/src/app/favicon.ico dosyasını üretir (16, 32 ve 48 px PNG içeren ICO). Ağa çıkmaz,
// yeni bağımlılık gerektirmez: şekiller burada örneklenerek çizilir, PNG node:zlib ile kodlanır.
// Marka işareti ya da renkleri değişince bir kez çalıştırılır ve çıktı commit'lenir:
//   pnpm exec tsx scripts/gen-favicon.mts
// Görünüm app/icon.tsx ile aynıdır (apps/web/src/lib/seo/brand.ts): koyu zemin, ince dış çizgi,
// vurgu halkası. Sekme simgesi küçük olduğundan zemin yuvarlatılmış karedir ve işaret daha büyüktür.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { crc32, deflateSync } from 'node:zlib'
import { BRAND_ACCENT, BRAND_MARK_DIAMETERS } from '../apps/web/src/lib/seo/brand.ts'
import { MAP_COLORS } from '../packages/shared/src/map/colors.ts'

const OUTPUT = fileURLToPath(new URL('../apps/web/src/app/favicon.ico', import.meta.url))
const SIZES = [16, 32, 48] as const
/** İşaretin kenara oranı ve zeminin köşe yarıçapı (kenara oran). */
const MARK_RATIO = 0.84
const CORNER_RATIO = 0.22
/** Kenar yumuşatma: piksel başına SAMPLES × SAMPLES örnek. */
const SAMPLES = 8

type Rgba = [number, number, number, number]

function hex(value: string): Rgba {
  const match = /^#([0-9a-f]{6})$/i.exec(value)
  if (!match?.[1]) throw new Error(`Geçersiz renk: ${value}`)
  const n = Number.parseInt(match[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]
}

const BACKGROUND = hex(MAP_COLORS.background)
const OUTLINE = hex(MAP_COLORS.lineStrong)
const ACCENT = hex(BRAND_ACCENT)
const TRANSPARENT: Rgba = [0, 0, 0, 0]

/** Yuvarlatılmış karenin içinde mi (merkez 0,0; kenar 1). */
function insideRoundedSquare(x: number, y: number, radius: number): boolean {
  const qx = Math.abs(x) - (0.5 - radius)
  const qy = Math.abs(y) - (0.5 - radius)
  if (qx <= 0 || qy <= 0) return Math.abs(x) <= 0.5 && Math.abs(y) <= 0.5
  return qx * qx + qy * qy <= radius * radius
}

/** Birim karedeki (merkez 0,0) bir noktanın rengi. */
function colorAt(x: number, y: number): Rgba {
  if (!insideRoundedSquare(x, y, CORNER_RATIO)) return TRANSPARENT
  const r = Math.hypot(x, y)
  const radius = (diameter: number) => (diameter / BRAND_MARK_DIAMETERS.outline) * (MARK_RATIO / 2)
  if (r <= radius(BRAND_MARK_DIAMETERS.hole)) return BACKGROUND
  if (r <= radius(BRAND_MARK_DIAMETERS.ring)) return ACCENT
  if (r <= radius(BRAND_MARK_DIAMETERS.gap)) return BACKGROUND
  if (r <= radius(BRAND_MARK_DIAMETERS.outline)) return OUTLINE
  return BACKGROUND
}

/** size × size RGBA piksel dizisi; her piksel alt örneklerin (önceden çarpılmış alfa) ortalaması. */
function rasterize(size: number): Buffer {
  const pixels = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) / size - 0.5
          const y = (py + (sy + 0.5) / SAMPLES) / size - 0.5
          const [cr, cg, cb, ca] = colorAt(x, y)
          r += (cr * ca) / 255
          g += (cg * ca) / 255
          b += (cb * ca) / 255
          a += ca
        }
      }
      const offset = (py * size + px) * 4
      const alpha = a / (SAMPLES * SAMPLES)
      const unpremultiply = (value: number) => (alpha === 0 ? 0 : Math.round((value / a) * 255))
      pixels[offset] = unpremultiply(r)
      pixels[offset + 1] = unpremultiply(g)
      pixels[offset + 2] = unpremultiply(b)
      pixels[offset + 3] = Math.round(alpha)
    }
  }
  return pixels
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** 8 bit RGBA PNG (renk türü 6), filtre yok. */
function encodePng(size: number, pixels: Buffer): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.writeUInt8(8, 8)
  header.writeUInt8(6, 9)
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** PNG görüntüleri taşıyan ICO kabı (ICONDIR + ICONDIRENTRY'ler + görüntüler). */
function encodeIco(images: { size: number; png: Buffer }[]): Buffer {
  const directory = Buffer.alloc(6 + images.length * 16)
  directory.writeUInt16LE(0, 0)
  directory.writeUInt16LE(1, 2)
  directory.writeUInt16LE(images.length, 4)
  let offset = directory.length
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16
    directory.writeUInt8(size >= 256 ? 0 : size, entry)
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    directory.writeUInt8(0, entry + 2)
    directory.writeUInt8(0, entry + 3)
    directory.writeUInt16LE(1, entry + 4)
    directory.writeUInt16LE(32, entry + 6)
    directory.writeUInt32LE(png.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([directory, ...images.map((image) => image.png)])
}

const ico = encodeIco(SIZES.map((size) => ({ size, png: encodePng(size, rasterize(size)) })))
writeFileSync(OUTPUT, ico)
console.log(`${OUTPUT} yazıldı (${SIZES.join(', ')} px, ${ico.length} bayt).`)
