import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

/**
 * WOFF 1.0 yazı tipinin `cmap` tablosunda glifi olan kod noktaları (yalnız test: paylaşım
 * görsellerinin harf süzgeci `OG_GLYPH_RANGES`'i dosyaların kendisiyle karşılaştırır, D-111).
 * Biçim 4 (BMP) ve 12 (tam Unicode) alt tabloları okunur; glif 0 (`.notdef`) glif sayılmaz.
 * WOFF yapısı: 44 baytlık başlık, tablo başına 20 baytlık dizin satırı (etiket, konum, sıkıştırılmış
 * ve özgün boy); sıkıştırılmış tablo zlib'dir.
 */
export function woffCodePoints(path: string): Set<number> {
  const cmap = woffTable(readFileSync(path), 'cmap')
  const points = new Set<number>()
  const subtables = cmap.readUInt16BE(2)
  for (let i = 0; i < subtables; i++) {
    const offset = cmap.readUInt32BE(4 + i * 8 + 4)
    const format = cmap.readUInt16BE(offset)
    if (format === 4) readFormat4(cmap, offset, points)
    else if (format === 12) readFormat12(cmap, offset, points)
  }
  return points
}

function woffTable(font: Buffer, tag: string): Buffer {
  if (font.toString('latin1', 0, 4) !== 'wOFF') throw new Error('not a WOFF 1.0 font')
  const tables = font.readUInt16BE(12)
  for (let i = 0; i < tables; i++) {
    const entry = 44 + i * 20
    if (font.toString('latin1', entry, entry + 4) !== tag) continue
    const offset = font.readUInt32BE(entry + 4)
    const compressed = font.readUInt32BE(entry + 8)
    const original = font.readUInt32BE(entry + 12)
    const data = font.subarray(offset, offset + compressed)
    return compressed < original ? inflateSync(data) : data
  }
  throw new Error(`WOFF font has no ${tag} table`)
}

function readFormat4(cmap: Buffer, offset: number, points: Set<number>): void {
  const segments = cmap.readUInt16BE(offset + 6) / 2
  const ends = offset + 14
  const starts = ends + segments * 2 + 2
  const deltas = starts + segments * 2
  const rangeOffsets = deltas + segments * 2
  for (let i = 0; i < segments; i++) {
    const end = cmap.readUInt16BE(ends + i * 2)
    const start = cmap.readUInt16BE(starts + i * 2)
    const delta = cmap.readInt16BE(deltas + i * 2)
    const rangeOffset = cmap.readUInt16BE(rangeOffsets + i * 2)
    for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
      let glyph: number
      if (rangeOffset === 0) {
        glyph = (cp + delta) & 0xffff
      } else {
        glyph = cmap.readUInt16BE(rangeOffsets + i * 2 + rangeOffset + (cp - start) * 2)
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff
      }
      if (glyph !== 0) points.add(cp)
    }
  }
}

function readFormat12(cmap: Buffer, offset: number, points: Set<number>): void {
  const groups = cmap.readUInt32BE(offset + 12)
  for (let i = 0; i < groups; i++) {
    const group = offset + 16 + i * 12
    const start = cmap.readUInt32BE(group)
    const end = cmap.readUInt32BE(group + 4)
    const glyph = cmap.readUInt32BE(group + 8)
    for (let cp = start; cp <= end; cp++) if (glyph + (cp - start) !== 0) points.add(cp)
  }
}
