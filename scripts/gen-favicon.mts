// apps/web/src/app/favicon.ico dosyasını üretir (16, 32 ve 48 px PNG içeren ICO). Ağa çıkmaz,
// yeni bağımlılık gerektirmez: şekiller burada örneklenerek çizilir, PNG node:zlib ile kodlanır.
// Logo ya da renkleri değişince bir kez çalıştırılır ve çıktı commit'lenir:
//   pnpm exec tsx scripts/gen-favicon.mts
// Görünüm logonun küçük işaretidir (D-086; 32 px ve altı): saydam zeminde turkuaz daire ve içinde
// sağ üste uçan beyaz uçak, halka yok. Geometri apps/web/src/lib/brand/logo-geometry.ts'ten, renkler
// apps/web/src/lib/seo/brand.ts → LOGO_COLORS.small'dan okunur; site ve simgelerle aynı kaynaktır.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { crc32, deflateSync } from 'node:zlib'
import {
  LOGO_BOX,
  LOGO_CENTER,
  LOGO_SMALL_DISC_RADIUS,
  PLANE_BODY,
  PLANE_ENGINES,
  toPlaneSpace,
  type LogoPoint,
} from '../apps/web/src/lib/brand/logo-geometry.ts'
import { LOGO_COLORS } from '../apps/web/src/lib/seo/brand.ts'

const OUTPUT = fileURLToPath(new URL('../apps/web/src/app/favicon.ico', import.meta.url))
const SIZES = [16, 32, 48] as const
/** Kenar yumuşatma: piksel başına SAMPLES × SAMPLES örnek. */
const SAMPLES = 16
/** Bézier eğrisi başına doğru parçası sayısı (gövde çokgeni). */
const CURVE_STEPS = 24

type Rgba = [number, number, number, number]

function hex(value: string): Rgba {
  const match = /^#([0-9a-f]{6})$/i.exec(value)
  if (!match?.[1]) throw new Error(`Geçersiz renk: ${value}`)
  const n = Number.parseInt(match[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]
}

const DISC = hex(LOGO_COLORS.small.ring)
const PLANE = hex(LOGO_COLORS.small.plane)
const TRANSPARENT: Rgba = [0, 0, 0, 0]

/** Gövde çizgisinin çokgeni (kübik Bézier'ler CURVE_STEPS doğruya bölünür). */
function bodyPolygon(): LogoPoint[] {
  const points: LogoPoint[] = [PLANE_BODY.start]
  let from = PLANE_BODY.start
  for (const segment of PLANE_BODY.segments) {
    if ('line' in segment) {
      points.push(segment.line)
      from = segment.line
      continue
    }
    const [c1, c2, to] = segment.curve
    for (let step = 1; step <= CURVE_STEPS; step++) {
      const t = step / CURVE_STEPS
      const u = 1 - t
      const a = u * u * u
      const b = 3 * u * u * t
      const c = 3 * u * t * t
      const d = t * t * t
      points.push([
        a * from[0] + b * c1[0] + c * c2[0] + d * to[0],
        a * from[1] + b * c1[1] + c * c2[1] + d * to[1],
      ])
    }
    from = to
  }
  return points
}

const BODY = bodyPolygon()

/** Çokgenin içinde mi (çift-tek kuralı; gövde kendini kesmeyen tek çizgidir). */
function insidePolygon(x: number, y: number, polygon: readonly LogoPoint[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i] as LogoPoint
    const [xj, yj] = polygon[j] as LogoPoint
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Motor kapsüllerinden birinin içinde mi (düz kısma uzaklık ≤ yarıçap). */
function insideEngine(x: number, y: number): boolean {
  return PLANE_ENGINES.some(({ x: cx, top, length, radius }) => {
    const y0 = top + radius
    const nearest = Math.min(Math.max(y, y0), y0 + length)
    return Math.hypot(x - cx, y - nearest) <= radius
  })
}

/** Birim karedeki (merkez 0,0; kenar 1) bir noktanın rengi. */
function colorAt(x: number, y: number): Rgba {
  const ux = LOGO_CENTER + x * LOGO_BOX
  const uy = LOGO_CENTER + y * LOGO_BOX
  if (Math.hypot(ux - LOGO_CENTER, uy - LOGO_CENTER) > LOGO_SMALL_DISC_RADIUS) return TRANSPARENT
  const [px, py] = toPlaneSpace(ux, uy, 'small')
  if (insidePolygon(px, py, BODY) || insideEngine(px, py)) return PLANE
  return DISC
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
