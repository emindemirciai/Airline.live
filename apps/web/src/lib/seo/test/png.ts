import { inflateSync } from 'node:zlib'

/**
 * Testler için küçük PNG çözücü: 8 bit RGBA (renk türü 6) ya da RGB (2), taramasız. `next/og`
 * (resvg) ve `scripts/gen-favicon.mts` çıktısı bu biçimdedir. Piksel değerleri simgelerin şeklini
 * (saydam köşe, dolu kare, uçağın yeri) denetlemek için okunur.
 */
export interface DecodedPng {
  width: number
  height: number
  /** [r, g, b, a] (0–255). */
  pixel: (x: number, y: number) => [number, number, number, number]
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

export function decodePng(bytes: Uint8Array): DecodedPng {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 8
  let width = 0
  let height = 0
  let channels = 0
  const data: Uint8Array[] = []
  while (offset < bytes.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    const body = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      const header = new DataView(body.buffer, body.byteOffset, body.byteLength)
      width = header.getUint32(0)
      height = header.getUint32(4)
      const [depth, colorType, , , interlace] = [...body.subarray(8, 13)]
      if (depth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2)) {
        throw new Error(`unsupported PNG: depth ${depth}, color type ${colorType}`)
      }
      channels = colorType === 6 ? 4 : 3
    } else if (type === 'IDAT') {
      data.push(body)
    }
    offset += 12 + length
  }
  const raw = inflateSync(Buffer.concat(data))
  const stride = width * channels
  const pixels = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    for (let i = 0; i < stride; i++) {
      const value = raw[y * (stride + 1) + 1 + i] ?? 0
      const left = i >= channels ? (pixels[y * stride + i - channels] ?? 0) : 0
      const up = y > 0 ? (pixels[(y - 1) * stride + i] ?? 0) : 0
      const upLeft = y > 0 && i >= channels ? (pixels[(y - 1) * stride + i - channels] ?? 0) : 0
      const predictor =
        filter === 1
          ? left
          : filter === 2
            ? up
            : filter === 3
              ? Math.floor((left + up) / 2)
              : filter === 4
                ? paeth(left, up, upLeft)
                : 0
      pixels[y * stride + i] = (value + predictor) & 255
    }
  }
  return {
    width,
    height,
    pixel: (x, y) => {
      const start = y * stride + x * channels
      const [r = 0, g = 0, b = 0] = pixels.subarray(start, start + 3)
      return [r, g, b, channels === 4 ? (pixels[start + 3] ?? 0) : 255]
    },
  }
}

/** `#RRGGBB` → [r, g, b]. */
export function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
