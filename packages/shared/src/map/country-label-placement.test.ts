/**
 * Ülke adlarının yerleşim modeli (D-095): her başkentin adı, adlar silinmeye başlamadan
 * (`COUNTRY_LABEL_FADE_START_ZOOM`) önce en az bir yakınlaştırmada tam saydamlıkta yerleşir;
 * listelenen havalimanı olan hiçbir ülke adsız kalmaz. Görünüm o başkentte ortalıdır.
 *
 * Model, maplibre-gl 6.11.2'nin nokta yazıları için çakışma kuralıdır:
 * - **Kutu:** genişlik en geniş satır, yükseklik satır sayısı × satır yüksekliği (24 birim = 1 em).
 *   Birimler px'e yerleşim boyuyla çevrilir: karonun yakınlaştırmasının (taban(z); GeoJSON kaynağı
 *   yuvarlamaz) bir üstündeki `text-size` (`symbol_layout.ts` `layoutTextSize`). `text-offset`
 *   kutuyu em'le kaydırır; her yana `text-padding` (6 px) eklenir.
 * - **Genişlik:** harf genişliği + harf aralığı (0,32 em), sondaki aralık düşülür; kerning yoktur
 *   (`shaping.ts`). Harf genişliği TinySDF'in 48 px'teki `measureText` değerinin yarısıdır, yani
 *   Overpass 600'ün `hmtx` genişliği (@fontsource/overpass 5.3.0, 2.000 birim/em; aşağıdaki
 *   tablo). Web'deki map-fonts.test.ts aynı genişlikleri yazı tipi dosyasının kendisinden ölçer.
 * - **Satır kırma:** `tagged_string.ts` `determineLineBreaks` (boşluk ve kısa çizgiden, dengeli).
 * - **Sıra:** üstteki katman önce (kademe 1, 2, 3), katmanda küçük `symbol-sort-key` (`rank`)
 *   önce. Kenar değmesi de çakışmadır (`grid_index.ts`). Kutusu görünümün 100 px payının
 *   dışında kalan ad yerleşmez (`collision_index.ts` `viewportPadding`).
 * - **Görünüm:** Web Mercator, 512 px karo; eğim ve dönüş yok.
 */
import { describe, expect, it } from 'vitest'
import type { Locale } from '../locale'
import { COUNTRY_CAPITALS, countryLabelTier, type CountryLabelTier } from '../reference/capitals'
import {
  COUNTRY_LABEL_COMPACT_MAX_WIDTH_PX,
  COUNTRY_LABEL_FADE_IN_ZOOMS,
  COUNTRY_LABEL_FADE_START_ZOOM,
  COUNTRY_LABEL_LETTER_SPACING,
  COUNTRY_LABEL_LINE_HEIGHT,
  COUNTRY_LABEL_MIN_ZOOM,
  COUNTRY_LABEL_PADDING_PX,
  COUNTRY_LABEL_TIERS,
  countryLabelLayers,
  countryLabelMaxWidth,
  countryLabelOpacityAt,
  countryLabelPoints,
  countryLabelSizeAt,
  type CountryLabelPoint,
} from './country-labels'

/** MapLibre'nin glif birimi: 1 em = 24. */
const ONE_EM = 24
/** Overpass 600'ün birim/em değeri (`head.unitsPerEm`). */
const UNITS_PER_EM = 2000
/** Collision grid'in görünüm dışındaki payı, px (`viewportPadding`). */
const VIEWPORT_PADDING_PX = 100
/** Model adımı, yakınlaştırma kademesi. */
const ZOOM_STEP = 0.25

/**
 * Adlarda geçen harflerin genişliği, yazı tipi birimi (Overpass 600 `hmtx`; latin dosyası, Ş Ğ İ
 * latin-ext dosyası). Yeni bir ad yeni bir harf getirirse ilk test kırılır ve harf eklenir.
 */
const ADVANCE_UNITS: Readonly<Record<string, number>> = {
  ' ': 490,
  '-': 819,
  A: 1408,
  B: 1358,
  C: 1283,
  D: 1402,
  E: 1232,
  F: 1141,
  G: 1367,
  H: 1428,
  I: 583,
  J: 1107,
  K: 1384,
  L: 1128,
  M: 1615,
  N: 1430,
  O: 1450,
  P: 1271,
  Q: 1450,
  R: 1363,
  S: 1217,
  T: 1192,
  U: 1408,
  V: 1344,
  W: 1690,
  X: 1306,
  Y: 1339,
  Z: 1286,
  Ç: 1283,
  Ö: 1450,
  Ü: 1408,
  Ğ: 1367,
  İ: 583,
  Ş: 1217,
}

const SPACING = COUNTRY_LABEL_LETTER_SPACING * ONE_EM

/** Harfin ilerlemesi, glif birimi: genişlik + harf aralığı. */
function advance(char: string): number {
  const units = ADVANCE_UNITS[char]
  if (units === undefined) throw new Error(`no advance for ${char}`)
  return (units / UNITS_PER_EM) * ONE_EM + SPACING
}

/** Satır genişliği, glif birimi: sondaki harf aralığı düşülür. */
function lineWidth(line: string): number {
  let width = 0
  for (const char of line) width += advance(char)
  return width - SPACING
}

interface LineBreak {
  index: number
  x: number
  prior: LineBreak | null
  badness: number
}

/** MapLibre `determineLineBreaks`: hedef genişliğe en yakın, dengeli satırlar (boşluk, kısa çizgi). */
function breakLines(text: string, maxWidthEm: number): string[] {
  const chars = [...text]
  const total = chars.reduce((sum, char) => sum + advance(char), 0)
  const target = total / Math.max(1, Math.ceil(total / (maxWidthEm * ONE_EM)))
  const badness = (width: number, last: boolean) => {
    const raggedness = (width - target) ** 2
    if (!last) return raggedness
    return width < target ? raggedness / 2 : raggedness * 2
  }
  const evaluate = (index: number, x: number, candidates: LineBreak[], last: boolean) => {
    let best: LineBreak = { index, x, prior: null, badness: badness(x, last) }
    for (const candidate of candidates) {
      const value = badness(x - candidate.x, last) + candidate.badness
      if (value <= best.badness) best = { index, x, prior: candidate, badness: value }
    }
    return best
  }
  const candidates: LineBreak[] = []
  let x = 0
  for (const [i, char] of chars.entries()) {
    const previous = chars[i - 1]
    if (previous === ' ' || previous === '-') candidates.push(evaluate(i, x, candidates, false))
    if (char !== ' ') x += advance(char)
  }
  const indices: number[] = []
  for (let b: LineBreak | null = evaluate(chars.length, x, candidates, true); b; b = b.prior) {
    indices.unshift(b.index)
  }
  const lines: string[] = []
  let start = 0
  for (const index of indices) {
    lines.push(chars.slice(start, index).join('').trim())
    start = index
  }
  return lines.filter((line) => line.length > 0)
}

/** Web Mercator, px (dünya genişliği 512 × 2^z). */
function project(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const world = 512 * 2 ** zoom
  const phi = (lat * Math.PI) / 180
  return {
    x: ((lon + 180) / 360) * world,
    y: (0.5 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI)) * world,
  }
}

type Offset = readonly [x: number, y: number]

/** Katmanın `text-offset` değerinin bir ülke için sonucu: sabit dizi ya da koda göre `match`. */
function layerOffset(value: unknown, code: string): Offset {
  if (!Array.isArray(value)) throw new Error('text-offset missing')
  if (value[0] !== 'match') return [Number(value[0]), Number(value[1])]
  if (JSON.stringify(value[1]) !== JSON.stringify(['get', 'code'])) throw new Error('match input')
  const literal = (output: unknown): Offset => {
    if (!Array.isArray(output) || output[0] !== 'literal') throw new Error('match output')
    const [x, y] = (output as [string, [number, number]])[1]
    return [x, y]
  }
  for (let i = 2; i < value.length - 1; i += 2) {
    if (value[i] === code) return literal(value[i + 1])
  }
  return literal(value.at(-1))
}

interface View {
  width: number
  height: number
  locale: Locale
}

const VIEWS: readonly View[] = [
  { width: 1400, height: 900, locale: 'tr' },
  { width: 1400, height: 900, locale: 'en' },
  { width: 390, height: 844, locale: 'tr' },
  { width: 390, height: 844, locale: 'en' },
]

const viewName = (view: View) => `${view.width}×${view.height} ${view.locale}`

interface ModelLabel {
  point: CountryLabelPoint
  lines: string[]
  /** Kayma, em; `ignoreOffsets` ile [0, 0]. */
  offset: Offset
}

function modelLabels(view: View, ignoreOffsets: boolean): Map<CountryLabelTier, ModelLabel[]> {
  const compact = view.width <= COUNTRY_LABEL_COMPACT_MAX_WIDTH_PX
  const layers = countryLabelLayers({ compact })
  const byTier = new Map<CountryLabelTier, ModelLabel[]>()
  for (const tier of COUNTRY_LABEL_TIERS) {
    const layer = layers.find((candidate) => candidate.id === `hy-country-labels-${tier}`)
    if (!layer) throw new Error(`layer ${tier} missing`)
    const labels = countryLabelPoints(view.locale)
      .filter((point) => point.properties.tier === tier)
      .toSorted((a, b) => a.properties.rank - b.properties.rank)
      .map((point) => ({
        point,
        lines: breakLines(point.properties.name, countryLabelMaxWidth(tier, compact)),
        offset: ignoreOffsets
          ? ([0, 0] as const)
          : layerOffset(layer.layout['text-offset'], point.properties.code),
      }))
    byTier.set(tier, labels)
  }
  return byTier
}

const LABEL_CACHE = new Map<string, Map<CountryLabelTier, ModelLabel[]>>()

/** Görünümün adları (satırlar ve kayma), görünüm başına bir kez hesaplanır. */
function labelsFor(view: View, ignoreOffsets: boolean): Map<CountryLabelTier, ModelLabel[]> {
  const key = `${viewName(view)} ${ignoreOffsets ? 'centred' : 'offsets'}`
  let labels = LABEL_CACHE.get(key)
  if (!labels) {
    labels = modelLabels(view, ignoreOffsets)
    LABEL_CACHE.set(key, labels)
  }
  return labels
}

type Box = readonly [x1: number, y1: number, x2: number, y2: number]

const EPSILON = 1e-6
const overlaps = (a: Box, b: Box) =>
  a[0] <= b[2] + EPSILON &&
  a[1] <= b[3] + EPSILON &&
  a[2] >= b[0] - EPSILON &&
  a[3] >= b[1] - EPSILON

/** Görünümde (merkez `centre`, yakınlaştırma `zoom`) yerleşen adların kodları. */
function placedCodes(
  view: View,
  centre: { lat: number; lon: number },
  zoom: number,
  ignoreOffsets = false,
): Set<string> {
  const compact = view.width <= COUNTRY_LABEL_COMPACT_MAX_WIDTH_PX
  const labels = labelsFor(view, ignoreOffsets)
  const middle = project(centre.lat, centre.lon, zoom)
  const tileZoom = Math.floor(zoom)
  const placed: Box[] = []
  const codes = new Set<string>()
  for (const tier of [1, 2, 3] as const) {
    if (zoom < COUNTRY_LABEL_MIN_ZOOM[tier]) continue
    const scale = countryLabelSizeAt(tier, compact, tileZoom + 1) / ONE_EM
    for (const { point, lines, offset } of labels.get(tier) ?? []) {
      const anchor = project(point.lat, point.lon, zoom)
      const x = anchor.x - middle.x + view.width / 2
      const y = anchor.y - middle.y + view.height / 2
      const width = Math.max(...lines.map(lineWidth))
      const height = lines.length * COUNTRY_LABEL_LINE_HEIGHT * ONE_EM
      const left = offset[0] * ONE_EM - width / 2
      const top = offset[1] * ONE_EM - height / 2
      const box: Box = [
        x + left * scale - COUNTRY_LABEL_PADDING_PX,
        y + top * scale - COUNTRY_LABEL_PADDING_PX,
        x + (left + width) * scale + COUNTRY_LABEL_PADDING_PX,
        y + (top + height) * scale + COUNTRY_LABEL_PADDING_PX,
      ]
      const inside =
        box[2] >= -VIEWPORT_PADDING_PX &&
        box[0] < view.width + VIEWPORT_PADDING_PX &&
        box[3] >= -VIEWPORT_PADDING_PX &&
        box[1] < view.height + VIEWPORT_PADDING_PX
      if (!inside || placed.some((other) => overlaps(box, other))) continue
      placed.push(box)
      codes.add(point.properties.code)
    }
  }
  return codes
}

/** Kademenin tam saydam olduğu, silinmeden önceki yakınlaştırmalar (0,25 adımla). */
function fullOpacityZooms(tier: CountryLabelTier): number[] {
  const zooms: number[] = []
  const first = COUNTRY_LABEL_MIN_ZOOM[tier] + COUNTRY_LABEL_FADE_IN_ZOOMS
  for (let zoom = first; zoom < COUNTRY_LABEL_FADE_START_ZOOM; zoom += ZOOM_STEP) zooms.push(zoom)
  return zooms
}

/** Başkentinde ortalı görünümde adın yerleştiği tam saydam yakınlaştırmalar. */
function placedZooms(view: View, code: string, ignoreOffsets = false): number[] {
  const capital = COUNTRY_CAPITALS.find((candidate) => candidate.code === code)
  if (!capital) throw new Error(`missing ${code}`)
  return fullOpacityZooms(countryLabelTier(capital)).filter((zoom) =>
    placedCodes(view, capital, zoom, ignoreOffsets).has(code),
  )
}

describe('ülke adlarının yerleşim modeli (D-095)', () => {
  it('harf genişlikleri: her adın her harfi tabloda; genişlikler web’in yazı tipinden ölçtüğüyle aynı', () => {
    const names = (['tr', 'en'] as const).flatMap((locale) =>
      countryLabelPoints(locale).map((point) => point.properties.name),
    )
    for (const name of names) expect(() => lineWidth(name), name).not.toThrow()
    // map-fonts.test.ts (web) aynı değerleri yazı tipi dosyasından hesaplar.
    expect(lineWidth('TÜRKİYE') / ONE_EM).toBeCloseTo(6.17, 2)
    expect(lineWidth('SUUDİ ARABİSTAN') / ONE_EM).toBeCloseTo(13.42, 2)
    expect(lineWidth('BİRLEŞİK ARAP EMİRLİKLERİ') / ONE_EM).toBeCloseTo(21.42, 2)
  })

  it('satır kırma: geniş haritada hiçbir ad, dar haritada yalnız SUUDİ / ARABİSTAN ve SAUDI / ARABIA kırılır', () => {
    const wrapped: string[] = []
    for (const view of VIEWS) {
      for (const labels of labelsFor(view, false).values()) {
        for (const { lines } of labels) {
          if (lines.length > 1) wrapped.push(`${view.width} ${lines.join(' / ')}`)
        }
      }
    }
    expect(wrapped.toSorted()).toEqual(['390 SAUDI / ARABIA', '390 SUUDİ / ARABİSTAN'])
  })

  it('her başkentin adı, kendi başkentinde ortalı görünümde, silinmeden önce tam saydam yerleşir', () => {
    expect(COUNTRY_CAPITALS).toHaveLength(59)
    for (const view of VIEWS) {
      for (const { code } of COUNTRY_CAPITALS) {
        const zooms = placedZooms(view, code)
        expect(zooms.length, `${code} ${viewName(view)}`).toBeGreaterThan(0)
        for (const zoom of zooms) {
          const capital = COUNTRY_CAPITALS.find((candidate) => candidate.code === code)
          if (!capital) throw new Error(code)
          expect(countryLabelOpacityAt(countryLabelTier(capital), zoom)).toBe(1)
          expect(zoom).toBeLessThan(COUNTRY_LABEL_FADE_START_ZOOM)
        }
      }
    }
  })

  it('Slovakya istisnası gerekli: kaymasız SLOVAKYA silinmeden önce hiç yerleşmez; kaymayla z5–6,5’te yerleşir', () => {
    for (const view of VIEWS.filter((candidate) => candidate.locale === 'tr')) {
      expect(placedZooms(view, 'SK', true), viewName(view)).toEqual([])
      expect(placedZooms(view, 'SK'), viewName(view)).toEqual([5, 5.25, 5.5, 5.75, 6, 6.25, 6.5])
    }
    for (const view of VIEWS.filter((candidate) => candidate.locale === 'en')) {
      expect(placedZooms(view, 'SK', true), viewName(view)).toEqual([])
      expect(placedZooms(view, 'SK').length, viewName(view)).toBeGreaterThanOrEqual(7)
    }
  })

  it('kayma başka hiçbir adı silmez: her başkentte ortalı görünümde, z3–7,75', () => {
    const lost: string[] = []
    for (const view of VIEWS) {
      for (const capital of COUNTRY_CAPITALS) {
        for (let zoom = 3; zoom < 8; zoom += ZOOM_STEP) {
          const withOffsets = placedCodes(view, capital, zoom)
          for (const code of placedCodes(view, capital, zoom, true)) {
            if (code !== 'SK' && !withOffsets.has(code)) {
              lost.push(`${code} @${capital.code} z${zoom} ${viewName(view)}`)
            }
          }
        }
      }
    }
    expect(lost).toEqual([])
  })
})
