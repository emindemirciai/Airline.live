import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'
import {
  COUNTRY_LABEL_FONT,
  COUNTRY_LABEL_LETTER_SPACING,
  COUNTRY_LABEL_MAX_WIDTH_EM,
  COUNTRY_LABEL_PLACEMENTS,
  countryLabelLines,
} from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { plainStyle, type MapStyle } from './basemap'
import { MAP_FONT_FILES, mapFontFaces, withMapFonts } from './map-fonts'

const require = createRequire(import.meta.url)
const fontsource = (path: string) => readFileSync(require.resolve(`@fontsource/overpass/${path}`))
const published = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../../public${path}`, import.meta.url)))

const ORIGIN = 'http://localhost:3100'

describe('withMapFonts (D-095)', () => {
  it('iki dosyayı mutlak adresle ekler; glif adresi eklemez; girdi değişmez', () => {
    const plain = plainStyle()
    const style = withMapFonts(plain, ORIGIN)
    expect(style['font-faces']).toEqual({
      [COUNTRY_LABEL_FONT]: [
        {
          url: 'http://localhost:3100/fonts/overpass-latin-600-normal.woff2',
          'unicode-range': [...(MAP_FONT_FILES[0]?.unicodeRange ?? [])],
        },
        {
          url: 'http://localhost:3100/fonts/overpass-latin-ext-600-normal.woff2',
          'unicode-range': [...(MAP_FONT_FILES[1]?.unicodeRange ?? [])],
        },
      ],
    })
    expect(style).not.toHaveProperty('glyphs')
    expect(style.layers).toBe(plain.layers)
    expect(plain).not.toHaveProperty('font-faces')
    expect(COUNTRY_LABEL_FONT).toBe('Overpass SemiBold')
  })

  it('stilin kendi font-faces girdilerini ve glyphs adresini korur', () => {
    const fetched: MapStyle = {
      ...plainStyle(),
      glyphs: 'https://tiles.example/fonts/{fontstack}/{range}.pbf',
      'font-faces': { 'Noto Sans Regular': 'https://tiles.example/noto.woff2' },
    }
    const style = withMapFonts(fetched, 'https://havayolu.live')
    expect(style.glyphs).toBe(fetched.glyphs)
    expect(Object.keys(style['font-faces'] ?? {})).toEqual([
      'Noto Sans Regular',
      COUNTRY_LABEL_FONT,
    ])
    expect(mapFontFaces('https://havayolu.live')[COUNTRY_LABEL_FONT]?.[0]?.url).toBe(
      'https://havayolu.live/fonts/overpass-latin-600-normal.woff2',
    )
  })
})

/** `600.css`'teki bir yüzün `unicode-range`'i, girdilere ayrılmış. */
function cssRanges(css: string, file: string): string[] {
  const block = css.split('@font-face').find((part) => part.includes(`files/${file}`))
  const match = /unicode-range:\s*([^;]+);/.exec(block ?? '')
  return (match?.[1] ?? '').split(',').map((range) => range.trim())
}

/** `U+0130` ya da `U+0100-02BA` → [başlangıç, bitiş]. */
function parseRange(range: string): [number, number] {
  const [start = '', end = start] = range.slice(2).split('-')
  return [Number.parseInt(start, 16), Number.parseInt(end, 16)]
}

describe('haritanın yazı tipi dosyaları (D-095)', () => {
  it('public/fonts dosyaları @fontsource/overpass 5.3.0’ınkilerle bayt bayt aynı; lisans yanında', () => {
    for (const { path } of MAP_FONT_FILES) {
      const name = path.split('/').at(-1) ?? ''
      expect(published(path).equals(fontsource(`files/${name}`)), name).toBe(true)
    }
    expect(published('/fonts/OFL.txt').equals(fontsource('LICENSE'))).toBe(true)
    expect(published('/fonts/OFL.txt').toString('utf8')).toContain('SIL Open Font License')
  })

  it('harf aralıkları 600.css’tekiyle aynı; her girdi style-spec biçiminde', () => {
    const css = fontsource('600.css').toString('utf8')
    for (const { path, unicodeRange } of MAP_FONT_FILES) {
      const name = path.split('/').at(-1) ?? ''
      expect(unicodeRange, name).toEqual(cssRanges(css, name))
      for (const range of unicodeRange) {
        expect(range, name).toMatch(/^U\+[0-9A-F]{1,6}(-[0-9A-F]{1,6})?$/)
      }
    }
  })
})

/** WOFF 1.0 dosyasından (zlib) harf genişlikleri: kod noktası → em. */
function advances(file: string): Map<number, number> {
  const buffer = fontsource(`files/${file}`)
  const tables = new Map<string, Buffer>()
  for (let i = 0; i < buffer.readUInt16BE(12); i++) {
    const at = 44 + i * 20
    const tag = buffer.toString('latin1', at, at + 4)
    const offset = buffer.readUInt32BE(at + 4)
    const length = buffer.readUInt32BE(at + 8)
    const raw = buffer.subarray(offset, offset + length)
    tables.set(tag, length === buffer.readUInt32BE(at + 12) ? raw : inflateSync(raw))
  }
  const table = (tag: string) => {
    const found = tables.get(tag)
    if (!found) throw new Error(`${file}: ${tag} table missing`)
    return found
  }
  const head = table('head')
  const hhea = table('hhea')
  const hmtx = table('hmtx')
  const cmap = table('cmap')
  const unitsPerEm = head.readUInt16BE(18)
  const metrics = hhea.readUInt16BE(34)
  let subtable = -1
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    if (cmap.readUInt16BE(4 + i * 8) === 3 && cmap.readUInt16BE(6 + i * 8) === 1) {
      subtable = cmap.readUInt32BE(8 + i * 8)
    }
  }
  const segments = cmap.readUInt16BE(subtable + 6) / 2
  const ends = subtable + 14
  const starts = ends + segments * 2 + 2
  const deltas = starts + segments * 2
  const offsets = deltas + segments * 2
  const result = new Map<number, number>()
  for (let s = 0; s < segments; s++) {
    const start = cmap.readUInt16BE(starts + s * 2)
    const end = cmap.readUInt16BE(ends + s * 2)
    const delta = cmap.readInt16BE(deltas + s * 2)
    const rangeOffset = cmap.readUInt16BE(offsets + s * 2)
    for (let code = start; code <= end && code !== 0xffff; code++) {
      const raw =
        rangeOffset === 0
          ? code
          : cmap.readUInt16BE(offsets + s * 2 + rangeOffset + (code - start) * 2)
      if (rangeOffset !== 0 && raw === 0) continue
      const glyph = (raw + delta) & 0xffff
      if (glyph === 0) continue
      result.set(code, hmtx.readUInt16BE(4 * Math.min(glyph, metrics - 1)) / unitsPerEm)
    }
  }
  return result
}

const LATIN = advances('overpass-latin-600-normal.woff')
const LATIN_EXT = advances('overpass-latin-ext-600-normal.woff')
const RANGES = MAP_FONT_FILES.map((file) => file.unicodeRange.map(parseRange))

/** Harfin genişliği, em: MapLibre gibi ilk kapsayan dosyadan. */
function advance(char: string): number {
  const code = char.codePointAt(0) ?? 0
  const covers = (index: number) =>
    (RANGES[index] ?? []).some(([start, end]) => code >= start && code <= end)
  const value = covers(0) ? LATIN.get(code) : covers(1) ? LATIN_EXT.get(code) : undefined
  if (value === undefined) throw new Error(`no glyph for ${char} (U+${code.toString(16)})`)
  return value
}

/** Satır genişliği, em: MapLibre gibi harf aralığıyla, sondaki aralık düşülerek, kerning yok. */
function lineWidth(text: string): number {
  let width = 0
  for (const char of text) width += advance(char) + COUNTRY_LABEL_LETTER_SPACING
  return width - COUNTRY_LABEL_LETTER_SPACING
}

/**
 * Haritada yazılabilecek bütün adlar (yerleşim tablosundaki 59 ülke, iki dil; hiç sığmayanlar da),
 * satırlarıyla.
 */
const LABELS = (['tr', 'en'] as const).flatMap((locale) =>
  Object.values(COUNTRY_LABEL_PLACEMENTS[locale]).map((row) => ({
    name: row.name,
    lines: countryLabelLines(row.name, locale),
  })),
)

describe('ülke adlarının yazı tipi kapsamı ve genişliği (D-095, D-096)', () => {
  it('her adın her harfi iki dosyadan birinin aralığında ve yazı tipinde var', () => {
    const chars = new Set(LABELS.flatMap((label) => [...label.lines.join('')]))
    expect(chars.size).toBeGreaterThan(26)
    for (const char of chars) expect(() => advance(char), char).not.toThrow()
    // Türkçe büyük harfler latin-ext'ten gelir.
    for (const char of ['İ', 'Ş', 'Ğ']) {
      const code = char.codePointAt(0) ?? 0
      expect(
        RANGES[0]?.some(([s, e]) => code >= s && code <= e),
        char,
      ).toBe(false)
      expect(LATIN_EXT.has(code), char).toBe(true)
    }
  })

  it('MapLibre ad satırlarına kendi kırmasını eklemez: her adın toplam genişliği 24 em’in altında', () => {
    expect(LABELS).toHaveLength(118)
    const widths = LABELS.map((label) => [label.name, lineWidth(label.lines.join(' '))] as const)
    for (const [name, width] of widths) expect(width, name).toBeLessThan(COUNTRY_LABEL_MAX_WIDTH_EM)
    const widest = widths.toSorted((a, b) => b[1] - a[1])[0]
    expect(widest?.[0]).toBe('BİRLEŞİK ARAP EMİRLİKLERİ')
    expect(widest?.[1]).toBeCloseTo(21.42, 1)
    // tools/src/country-labels/label-model.test.ts aynı genişlikleri kendi tablosundan hesaplar.
    expect(lineWidth('TÜRKİYE')).toBeCloseTo(6.17, 1)
    expect(lineWidth('SUUDİ ARABİSTAN')).toBeCloseTo(13.42, 1)
  })
})
