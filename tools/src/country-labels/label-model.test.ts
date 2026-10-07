import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { inflateSync } from 'node:zlib'
import {
  COUNTRY_AREA_OVERRIDES_KM2,
  COUNTRY_LABEL_MAX_WIDTH_EM,
  COUNTRY_LABEL_SIZES,
  COUNTRY_LABEL_TIERS,
  countryLabelHalo,
  countryLabelLines,
  countryLabelText,
  countryLabelTextSize,
  GLYPH_SDF_REACH_EM,
  HALO_BLUR_FACTOR,
  interpolateStops,
  SDF_EDGE_GAMMA_PX,
} from '@havayolu/shared'
import { COUNTRY_LABEL_PLACEMENTS } from '@havayolu/shared/country-label-placements'
import { describe, expect, it } from 'vitest'
import { ProjectedShape, type LonLat } from './geometry'
import {
  BASELINE_FROM_LINE_TOP,
  FAR_SAFETY_KM,
  GLYPH_BITMAP_INK_INSET,
  GLYPH_QUAD_RECT_BUFFER,
  INK_LEFT_SHIFT,
  labelInkBox,
  LabelFitter,
  largestCasingHalfWidthPx,
  lineWidth,
  maplibreLineBreaks,
  ONE_EM,
  OVERPASS_600_GLYPHS,
  SAFETY_BUDGET,
  SAFETY_KM,
  SAFETY_PX,
  safetyBudgetKm,
  SHAPING_DEFAULT_OFFSET,
  TINY_SDF_FONT_PX,
  TINY_SDF_TOP_ADJUSTMENT,
  visibleBoxPx,
} from './label-model'
import { NATURAL_EARTH_PARAMS } from './natural-earth'

/** Web'in paketleri (@fontsource/overpass ve maplibre-gl, apps/web'in bağımlılıkları; ağ yok). */
const webRequire = createRequire(new URL('../../../apps/web/package.json', import.meta.url))

interface FontGlyph {
  advance: number
  xMin: number
  yMin: number
  xMax: number
  yMax: number
}

/** WOFF 1.0 dosyasından (zlib) harf ölçüleri: head, hhea, hmtx, cmap (biçim 4), loca, glyf. */
function readFont(file: string): (char: string) => FontGlyph | undefined {
  const buffer = readFileSync(webRequire.resolve(`@fontsource/overpass/files/${file}`))
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
    if (!found) throw new Error(`${file}: ${tag} missing`)
    return found
  }
  const head = table('head')
  const hmtx = table('hmtx')
  const cmap = table('cmap')
  const loca = table('loca')
  const glyf = table('glyf')
  expect(head.readUInt16BE(18)).toBe(2000)
  const longLoca = head.readInt16BE(50) === 1
  const metrics = table('hhea').readUInt16BE(34)
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
  const glyphIndex = (code: number): number => {
    for (let s = 0; s < segments; s++) {
      const start = cmap.readUInt16BE(starts + s * 2)
      const end = cmap.readUInt16BE(ends + s * 2)
      if (code < start || code > end) continue
      const delta = cmap.readInt16BE(deltas + s * 2)
      const rangeOffset = cmap.readUInt16BE(offsets + s * 2)
      if (rangeOffset === 0) return (code + delta) & 0xffff
      const raw = cmap.readUInt16BE(offsets + s * 2 + rangeOffset + (code - start) * 2)
      return raw === 0 ? 0 : (raw + delta) & 0xffff
    }
    return 0
  }
  const location = (glyph: number) =>
    longLoca ? loca.readUInt32BE(glyph * 4) : loca.readUInt16BE(glyph * 2) * 2
  return (char) => {
    const glyph = glyphIndex(char.codePointAt(0) ?? 0)
    if (glyph === 0) return undefined
    const advance = hmtx.readUInt16BE(4 * Math.min(glyph, metrics - 1))
    const at = location(glyph)
    if (location(glyph + 1) === at) return { advance, xMin: 0, yMin: 0, xMax: 0, yMax: 0 }
    return {
      advance,
      xMin: glyf.readInt16BE(at + 2),
      yMin: glyf.readInt16BE(at + 4),
      xMax: glyf.readInt16BE(at + 6),
      yMax: glyf.readInt16BE(at + 8),
    }
  }
}

/** Tablodaki bütün ülkelerin adları (D-100: 244 kod), iki dilde. */
const CODES = Object.keys(COUNTRY_LABEL_PLACEMENTS.tr)
const NAMES = (['tr', 'en'] as const).flatMap((locale) =>
  CODES.map((code) => ({ locale, code, name: countryLabelText(code, locale) })),
)
/** Yazılan (en az bir düzende sığan) adlar. */
const SHOWN = NAMES.filter(({ locale, code }) => {
  const row = COUNTRY_LABEL_PLACEMENTS[locale][code]
  return row?.regular !== null || row.compact !== null
})

describe('Overpass 600 ölçüleri (D-096)', () => {
  it('tablo yazı tipi dosyalarıyla aynı: latin, yoksa latin-ext (MapLibre gibi ilk kapsayan dosya)', () => {
    const latin = readFont('overpass-latin-600-normal.woff')
    const latinExt = readFont('overpass-latin-ext-600-normal.woff')
    for (const [char, values] of Object.entries(OVERPASS_600_GLYPHS)) {
      const font = latin(char) ?? latinExt(char)
      expect(font, char).toBeDefined()
      const { advance, xMin, yMin, xMax, yMax } = font as FontGlyph
      expect([advance, xMin, yMin, xMax, yMax], char).toEqual([...values])
    }
    for (const char of ['İ', 'Ş', 'Ğ']) {
      expect(latin(char), char).toBeUndefined()
      expect(latinExt(char), char).toBeDefined()
    }
  })

  it('her adın her harfi tabloda; mürekkep ilerlemenin içinde (Í’nin vurgusu dışında)', () => {
    for (const { name } of NAMES) expect(() => lineWidth(name), name).not.toThrow()
    const used = new Set(NAMES.flatMap(({ name }) => [...name]))
    expect(Object.keys(OVERPASS_600_GLYPHS).toSorted()).toEqual([...used].toSorted())
    for (const [char, [advance, xMin, , xMax]] of Object.entries(OVERPASS_600_GLYPHS)) {
      expect(xMin, char).toBeGreaterThanOrEqual(0)
      // Í (SÃO TOMÉ AND PRÍNCIPE) vurgusu ilerlemenin 117 birim dışına taşar: mürekkep kutusu her
      // harfi kendi yerinde ölçtüğü için model bunu sayar (son harf olsa bile).
      expect(xMax, char).toBeLessThanOrEqual(char === 'Í' ? advance + 117 : advance)
    }
  })

  it('genişlik: TÜRKİYE 6,17 em, SUUDİ ARABİSTAN 13,42 em, BİRLEŞİK ARAP EMİRLİKLERİ 21,42 em', () => {
    expect(lineWidth('TÜRKİYE') / ONE_EM).toBeCloseTo(6.17, 2)
    expect(lineWidth('SUUDİ ARABİSTAN') / ONE_EM).toBeCloseTo(13.42, 2)
    expect(lineWidth('BİRLEŞİK ARAP EMİRLİKLERİ') / ONE_EM).toBeCloseTo(21.42, 2)
  })
})

describe('mürekkep kutusu (MapLibre 6.11.2 TinySDF yerleşimi)', () => {
  it('modelin sabitleri web’in kurduğu MapLibre 6.11.2’nin kaynağındakilerle aynı', () => {
    const root = dirname(webRequire.resolve('maplibre-gl/package.json'))
    const source = (path: string) => readFileSync(join(root, 'src', path), 'utf8')
    expect(
      (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string }).version,
    ).toBe('6.11.2')
    const glyphManager = source('render/glyph_manager.ts')
    for (const line of [
      'const textureScale = 2;',
      'const topAdjustment = 27.5;',
      'const leftAdjustment = 0.5;',
      'const fontSize = 24 * textureScale;',
      'const padding = 3 * textureScale;',
      'tinySDF.buffer = padding;',
    ]) {
      expect(glyphManager, line).toContain(line)
    }
    expect(source('render/glyph_atlas.ts')).toContain('const padding = 1;')
    expect(source('style/parse_glyph_pbf.ts')).toContain('const border = 3;')
    const quads = source('symbol/quads.ts')
    expect(quads).toContain('const glyphPadding = 1.0;')
    expect(quads).toContain('let rectBuffer = GLYPH_PBF_BORDER + glyphPadding;')
    const shaping = source('symbol/shaping.ts')
    expect(shaping).toContain(`const SHAPING_DEFAULT_OFFSET = ${SHAPING_DEFAULT_OFFSET};`)
    expect(shaping).toContain(
      'shiftY = -verticalAlign * lineCount * lineHeight + 0.5 * lineHeight;',
    )
    expect(TINY_SDF_FONT_PX).toBe(48)
  })

  it('kaymalar: leftAdjustment 0,5 ile dörtgen payı (4) ve atlas karesindeki mürekkep yeri (3,5) birbirini götürür; taban çizgisi satırın üstünden 22 birim', () => {
    expect(GLYPH_QUAD_RECT_BUFFER).toBe(3 + 1)
    expect(GLYPH_BITMAP_INK_INSET).toBe(3.5)
    expect(INK_LEFT_SHIFT).toBe(0)
    // Harf konumu satırın üstünden 12 − 17 = −5; mürekkebin üstü konum + 27,5 − 4 + 3,5 − glyphTop / 2.
    expect(ONE_EM / 2 + SHAPING_DEFAULT_OFFSET).toBe(-5)
    expect(TINY_SDF_TOP_ADJUSTMENT - GLYPH_QUAD_RECT_BUFFER + GLYPH_BITMAP_INK_INSET).toBe(27)
    expect(BASELINE_FROM_LINE_TOP).toBe(22)
  })

  it('tek satır: taban çizgisi çapanın 10 birim altında; Ğ’nin üstü, Ş ve Ç’nin altı', () => {
    // Büyük harf 1.400 birim: tavan(33,6) / 2 = 17 → üst 10 − 17.
    expect(labelInkBox(['HAN']).top).toBe(-7)
    expect(labelInkBox(['HAN']).bottom).toBe(10)
    // Ğ 1.862 → tavan(44,7) / 2 = 22,5; Ş ve Ç −483 → tavan(11,6) / 2 = 6.
    expect(labelInkBox(['Ğ']).top).toBe(-12.5)
    expect(labelInkBox(['Ş']).bottom).toBe(16)
    expect(labelInkBox(['Ç']).bottom).toBe(16)
    // İki satır: blok [−24, 24]; ilk satırın taban çizgisi −2, ikincininki 22.
    const two = labelInkBox(['HAN', 'HAN'])
    expect([two.top, two.bottom]).toEqual([-19, 22])
  })

  it('yatay: sol kenar ilk harfin xMin’inde, sağ kenar son harfin xMax’ında (kayma yok)', () => {
    const width = lineWidth('HAN')
    const box = labelInkBox(['HAN'])
    // H xMin 176 → taban(4,224) / 2 = 2 → −w/2 + 2.
    expect(box.left).toBeCloseTo(-width / 2 + 2, 9)
    // N: ilerleme 1.430 (17,16 birim), xMax 1.254 → tavan(30,1) / 2 = 15,5 → w/2 − 17,16 + 15,5.
    expect(box.right).toBeCloseTo(width / 2 - 17.16 + 15.5, 9)
    // A'nın sağ boşluğu küçüktür: xMax 1.334 → tavan(32,0) / 2 = 16,5; ilerleme 16,896 birim.
    const a = labelInkBox(['A'])
    expect(a.right).toBeCloseTo(lineWidth('A') / 2 - 0.396, 9)
    // Satırlar ortalı: dar satır geniş satırın içinde.
    const lines = labelInkBox(['BOSNIA AND', 'HERZEGOVINA'])
    expect(lines.left).toBeGreaterThan(-lineWidth('HERZEGOVINA') / 2)
    expect(lines.right).toBeLessThan(lineWidth('HERZEGOVINA') / 2 + 1)
  })

  it('görünür kutu: mürekkep × boy / 24, her yana boy / 8 (halenin en uzak ucu)', () => {
    const ink = labelInkBox(['İRAN'])
    const box = visibleBoxPx(ink, 24)
    expect(box.left).toBeCloseTo(ink.left - 3, 9)
    expect(box.right).toBeCloseTo(ink.right + 3, 9)
    expect(box.top).toBeCloseTo(ink.top - 3, 9)
    expect(box.bottom).toBeCloseTo(ink.bottom + 3, 9)
    expect(GLYPH_SDF_REACH_EM).toBe(1 / 8)
  })
})

describe('yazı boyu ve hale', () => {
  it('model katmanın boy eğrisidir (yalnızca yakınlaştırmaya bağlı, doğrusal)', () => {
    for (const layout of ['regular', 'compact'] as const) {
      for (const tier of COUNTRY_LABEL_TIERS) {
        const stops = COUNTRY_LABEL_SIZES[layout][tier]
        expect(countryLabelTextSize(tier, layout === 'compact')).toEqual([
          'interpolate',
          ['linear'],
          ['zoom'],
          ...stops.flat(),
        ])
      }
    }
  })

  it('her eğrinin bağıl büyümesi ln 2’nin altında: sığan ad yakınlaştırınca da sığar', () => {
    let steepest = 0
    for (const layout of ['regular', 'compact'] as const) {
      for (const tier of COUNTRY_LABEL_TIERS) {
        const stops = COUNTRY_LABEL_SIZES[layout][tier]
        for (let i = 1; i < stops.length; i++) {
          const [z0, s0] = stops[i - 1] as readonly [number, number]
          const [z1, s1] = stops[i] as readonly [number, number]
          // Doğrusal parçada d ln s / dz en çok başlangıçtadır: (s1 − s0) / (z1 − z0) / s0.
          const growth = (s1 - s0) / (z1 - z0) / s0
          steepest = Math.max(steepest, growth)
          expect(growth, `${layout} ${tier} z${z0}`).toBeLessThan(Math.LN2)
        }
      }
    }
    expect(steepest).toBeCloseTo(0.35, 2)
  })

  it('hale glif payını (boy / 8) hiçbir durakta aşmaz', () => {
    for (const layout of ['regular', 'compact'] as const) {
      for (const tier of COUNTRY_LABEL_TIERS) {
        for (const [, size] of COUNTRY_LABEL_SIZES[layout][tier]) {
          const { width, blur } = countryLabelHalo(size)
          expect(width + HALO_BLUR_FACTOR * blur + SDF_EDGE_GAMMA_PX).toBeLessThanOrEqual(size / 8)
        }
      }
    }
  })
})

describe('güvenlik payı (D-096)', () => {
  it('km payı bütçeyi karşılar: sadeleştirme + yuvarlama + niceleme + en az 1 km Natural Earth/OSM farkı', () => {
    expect([SAFETY_PX, SAFETY_KM, FAR_SAFETY_KM]).toEqual([3, 2, 2.5])
    expect(SAFETY_BUDGET.naturalEarthVsOsmKm).toBeGreaterThanOrEqual(1)
    expect(safetyBudgetKm()).toBeCloseTo(1.8, 9)
    expect(SAFETY_KM).toBeGreaterThanOrEqual(safetyBudgetKm())
    // Türkiye'den uzak ülkeler 1 km toleransla sadeleşir (D-100): bütçe 2,3, pay 2,5.
    expect(safetyBudgetKm(NATURAL_EARTH_PARAMS.farSimplifyKm)).toBeCloseTo(2.3, 9)
    expect(FAR_SAFETY_KM).toBeGreaterThanOrEqual(safetyBudgetKm(NATURAL_EARTH_PARAMS.farSimplifyKm))
  })

  it('px payı sınırın koyu kenarının içe taşan yarısını ve 1 px boşluğu karşılar (z3–7)', () => {
    expect(largestCasingHalfWidthPx()).toBeCloseTo(3.8125 / 2, 3)
    expect(SAFETY_PX).toBeGreaterThanOrEqual(largestCasingHalfWidthPx() + SAFETY_BUDGET.pixelGapPx)
  })
})

describe('satır kırma', () => {
  it('MapLibre’nin satır kırması (satır sonu cezası, 24 em) her adda tam countryLabelLines’ı verir', () => {
    const multi: string[] = []
    const curatedMulti: string[] = []
    for (const { locale, code, name } of NAMES) {
      const lines = countryLabelLines(name, locale)
      expect(maplibreLineBreaks(lines.join('\n'), COUNTRY_LABEL_MAX_WIDTH_EM), name).toEqual(lines)
      if (lines.length > 1) multi.push(lines.join(' / '))
      if (lines.length > 1 && Object.hasOwn(COUNTRY_AREA_OVERRIDES_KM2, code)) {
        curatedMulti.push(lines.join(' / '))
      }
    }
    // Bütün dünyada 488 addan 137'si çok satırlı (D-100); D-095'in 59 ülkesinde yine sekiz ad.
    expect(multi).toHaveLength(137)
    expect(curatedMulti.toSorted()).toEqual([
      'BOSNA / HERSEK',
      'BOSNIA AND / HERZEGOVINA',
      'BİRLEŞİK / ARAP / EMİRLİKLERİ',
      'KUZEY / MAKEDONYA',
      'NORTH / MACEDONIA',
      'SAUDI / ARABIA',
      'SUUDİ / ARABİSTAN',
      'UNITED / ARAB / EMIRATES',
    ])
  })

  it('yazılan adlar: 24 em’den kısa ya da her satırı MapLibre’nin hedef satır genişliğinden kısa (iki Kongo dışında en uzunu AMERİKA BİRLEŞİK DEVLETLERİ, 23,6 em)', () => {
    const widthEm = (text: string) => lineWidth(text) / ONE_EM
    const long: string[] = []
    for (const { locale, name } of SHOWN) {
      const lines = countryLabelLines(name, locale)
      const total = widthEm(lines.join(' '))
      if (total < COUNTRY_LABEL_MAX_WIDTH_EM) continue
      long.push(name)
      // 24 em'i aşan adda MapLibre ⌈toplam / 24⌉ satır hedefler (hedef genişlik toplam / satır
      // sayısı); her satır hedeften kısa olduğundan bir satırı bölmek kırma cezasını yalnız büyütür,
      // ad yalnız kendi satır sonlarından kırılır (üstteki model de bunu verir).
      const target = total / Math.ceil(total / COUNTRY_LABEL_MAX_WIDTH_EM)
      for (const line of lines) expect(widthEm(line), `${name}: ${line}`).toBeLessThan(target)
    }
    // Elle tutulan iki Kongo adı (D-100) 24 em'i aşar: 25,9 ve 28,8 em.
    expect(long).toEqual(['KONGO DEMOKRATİK CUMHURİYETİ', 'DEMOCRATIC REPUBLIC OF THE CONGO'])
    const widest = SHOWN.map(({ locale, name }) =>
      widthEm(countryLabelLines(name, locale).join(' ')),
    )
      .filter((width) => width < COUNTRY_LABEL_MAX_WIDTH_EM)
      .reduce((max, width) => Math.max(max, width), 0)
    expect(widest).toBeCloseTo(widthEm('AMERİKA BİRLEŞİK DEVLETLERİ'), 9)
    // Hiçbir yerde sığmayan küçük toprakların adları da 24 em'i aşar (Güney Georgia, Heard,
    // Britanya Hint Okyanusu Toprakları…); MapLibre onları da yalnız satır sonlarından kırar (üstte).
    const hidden = NAMES.filter(
      ({ locale, name }) =>
        widthEm(countryLabelLines(name, locale).join(' ')) >= COUNTRY_LABEL_MAX_WIDTH_EM &&
        !SHOWN.some((shown) => shown.locale === locale && shown.name === name),
    )
    expect(hidden.map(({ code }) => code).toSorted()).toEqual([
      'GS',
      'GS',
      'HM',
      'HM',
      'IO',
      'IO',
      'TF',
      'VC',
      'VC',
    ])
    // Satır sonu olmasa MapLibre uzun adı dengeli iki satıra bölerdi (eski dar harita davranışı).
    expect(maplibreLineBreaks('SUUDİ ARABİSTAN', 10)).toEqual(['SUUDİ', 'ARABİSTAN'])
    expect(maplibreLineBreaks('SUUDİ ARABİSTAN', 24)).toEqual(['SUUDİ ARABİSTAN'])
  })
})

describe('LabelFitter.firstFitLevel', () => {
  // Kare ülke: 30–40° D, 35–45° K.
  const square: LonLat[] = [
    [30, 35],
    [40, 35],
    [40, 45],
    [30, 45],
  ]
  const fitter = new LabelFitter(new ProjectedShape([[square]]), ['TÜRKİYE'], 1, 'regular')

  it('katlanarak arama her tahminde doğrusal taramayla aynı sonucu verir', () => {
    const points: [number, number][] = [
      [35, 40],
      [31, 40],
      [30.3, 44.7],
      [39.9, 35.05],
      [35, 44],
    ]
    for (const [lon, lat] of points) {
      let linear = fitter.zooms.length
      for (let level = fitter.zooms.length - 1; level >= 0; level--) {
        if (!fitter.fitsAtLevel(lon, lat, level)) break
        linear = level
      }
      for (let guess = -2; guess <= fitter.zooms.length + 1; guess++) {
        expect(fitter.firstFitLevel(lon, lat, guess), `${lon},${lat} ${guess}`).toBe(linear)
      }
    }
    expect(fitter.fitZoom(35, 40)).toBe(3.5)
    expect(fitter.fitZoom(30.3, 44.7)).toBe(Infinity)
    expect(fitter.zooms).toEqual([
      3, 3.25, 3.5, 3.75, 4, 4.25, 4.5, 4.75, 5, 5.25, 5.5, 5.75, 6, 6.25, 6.5, 6.75,
    ])
  })

  it('kesirli yakınlaştırmada sınama, düzeydeki önceden hesaplı kutuyla aynı', () => {
    for (const [index, zoom] of fitter.zooms.entries()) {
      expect(fitter.fitsAtZoom(31, 40, zoom)).toBe(fitter.fitsAtLevel(31, 40, index))
    }
    expect(interpolateStops(COUNTRY_LABEL_SIZES.regular[1], 3.5)).toBe(23.5)
  })
})
