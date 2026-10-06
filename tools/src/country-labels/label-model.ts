/**
 * Ülke adının haritada kapladığı kutu (D-096): MapLibre 6.11.2'nin nokta yazısını nasıl çizdiğinin
 * modeli. Yalnızca çevrimdışı üretici ve testler kullanır.
 *
 * - **Glif birimi:** 1 em = 24 birim; yazı boyu s px'te 1 birim = s / 24 px.
 * - **Genişlik:** harf ilerlemesi (Overpass 600 `hmtx`, 2.000 birim/em) + 0,32 em harf aralığı;
 *   sondaki aralık düşülür, kerning yoktur (`shaping.ts`). Satırlar ortalıdır (`text-justify`).
 * - **Mürekkep:** harfler TinySDF ile 48 px'te çizilir (`glyph_manager.ts`): harfin başlangıcından
 *   sol kenar `taban(xMin × 48 / 2000) / 2`, sağ kenar `tavan(xMax × 48 / 2000) / 2`; üst
 *   `tavan(yMax × 48 / 2000) / 2` taban çizgisinin üstünde, alt `tavan(−yMin × 48 / 2000) / 2`
 *   altında. Harfin dörtgeni (`quads.ts` `getGlyphQuads`) `left` ve `−top`'tan 4 birim
 *   (`GLYPH_PBF_BORDER` 3 + 1) önce başlar; dörtgenin kapladığı atlas karesinde mürekkep 3,5 birim
 *   içeridedir (1 doku pikseli atlas boşluğu + TinySDF'in 6 piksellik `buffer`'ı, 2× çizimde
 *   yarıya iner). Aradaki 0,5 birim `leftAdjustment` 0,5'i götürür: mürekkep sağa kaymaz.
 * - **Dikey yer:** n satırlık blok çapanın çevresinde [−12n, +12n] birimdir. i. satırın harf konumu
 *   −12n + 24i − 5'tir (`shaping.ts`: `SHAPING_DEFAULT_OFFSET` −17, ortalama kayması −12n + 12);
 *   harfin mürekkep üstü konum + 27,5 − 4 + 3,5 − glyphTop / 2'dir (`topAdjustment` 27,5). Taban
 *   çizgisi satırın üstünden 22 birim aşağıdadır.
 * - **Hale:** glif SDF'i mürekkebin en çok s / 8 px dışına taşar (`GLYPH_SDF_REACH_EM`); hale bu payı
 *   aşmaz (`countryLabelHalo`).
 * - **Boy:** kademenin yakınlaştırma eğrisi (`COUNTRY_LABEL_SIZES`), çizilen yakınlaştırmada doğrusal;
 *   yalnızca yakınlaştırmaya bağlı `text-size` MapLibre'de tam bu eğridir ve karonun boyunu aşmaz
 *   (`symbol_size.ts` `evaluateCameraSize`).
 */
import {
  COUNTRY_BORDER_CASING_WIDTH,
  COUNTRY_LABEL_FADE_START_ZOOM,
  COUNTRY_LABEL_FIT_ZOOM_STEP,
  COUNTRY_LABEL_LETTER_SPACING,
  COUNTRY_LABEL_SIZES,
  GLYPH_SDF_REACH_EM,
  countryLabelFitZooms,
  interpolateStops,
  type CountryLabelStops,
  type CountryLabelTier,
} from '@havayolu/shared'
import { NATURAL_EARTH_PARAMS } from './natural-earth'
import { mercatorX, mercatorY, unitsPerKm, type ProjectedShape } from './geometry'

/** MapLibre'nin glif birimi: 1 em. */
export const ONE_EM = 24
/** Overpass 600'ün birim/em değeri (`head.unitsPerEm`). */
export const UNITS_PER_EM = 2000
/** TinySDF'in çizim boyu, px (MapLibre `font-faces`: 24 × 2). */
export const TINY_SDF_FONT_PX = 48
/** TinySDF glifinin `metrics.left`'ine eklenen pay, glif birimi (`glyph_manager.ts` `leftAdjustment`). */
export const TINY_SDF_LEFT_ADJUSTMENT = 0.5
/** TinySDF glifinin `metrics.top`'undan düşülen pay, glif birimi (`glyph_manager.ts` `topAdjustment`). */
export const TINY_SDF_TOP_ADJUSTMENT = 27.5
/**
 * Harf dörtgeninin `left` ve `−top`'tan önce başladığı pay, glif birimi (`quads.ts`
 * `GLYPH_PBF_BORDER` 3 + `glyphPadding` 1).
 */
export const GLYPH_QUAD_RECT_BUFFER = 4
/**
 * Mürekkebin dörtgenin kapladığı atlas karesinde başladığı yer, glif birimi: 1 doku pikseli atlas
 * boşluğu (`glyph_atlas.ts` `padding`) + TinySDF'in 6 piksellik `buffer`'ı (`3 × textureScale`); 2×
 * çizimde yarıya iner.
 */
export const GLYPH_BITMAP_INK_INSET = (1 + 6) / 2
/** `shaping.ts` `SHAPING_DEFAULT_OFFSET`: satırın harf konumu satırın ortasından bu kadar yukarıda. */
export const SHAPING_DEFAULT_OFFSET = -17
/** Mürekkebin harf başlangıcına göre fazladan kayması, glif birimi: 0,5 − 4 + 3,5 = 0. */
export const INK_LEFT_SHIFT =
  TINY_SDF_LEFT_ADJUSTMENT - GLYPH_QUAD_RECT_BUFFER + GLYPH_BITMAP_INK_INSET
/**
 * Satırın üstünden taban çizgisine, glif birimi: satırın ortası (12) + `SHAPING_DEFAULT_OFFSET`
 * (−17) harf konumudur; taban çizgisi ondan `topAdjustment` − 4 + 3,5 = 27 aşağıdadır:
 * 12 − 17 + 27 = 22.
 */
export const BASELINE_FROM_LINE_TOP =
  ONE_EM / 2 +
  SHAPING_DEFAULT_OFFSET +
  TINY_SDF_TOP_ADJUSTMENT -
  GLYPH_QUAD_RECT_BUFFER +
  GLYPH_BITMAP_INK_INSET

/**
 * Adlarda geçen harflerin ölçüleri, yazı tipi birimi: [ilerleme, xMin, yMin, xMax, yMax]
 * (@fontsource/overpass 5.3.0, Overpass 600; latin dosyası, Ğ İ Ş latin-ext dosyası; MapLibre de
 * harfi ilk kapsayan dosyadan alır). label-model.test.ts değerleri WOFF dosyalarından yeniden okur.
 * Í'nin vurgusu ilerlemesinin 117 birim dışına taşar; mürekkep kutusu her harfi kendi yerinde sayar.
 */
export const OVERPASS_600_GLYPHS: Readonly<
  Record<string, readonly [advance: number, xMin: number, yMin: number, xMax: number, yMax: number]>
> = {
  ' ': [490, 0, 0, 0, 0],
  '(': [725, 150, -260, 636, 1424],
  ')': [725, 90, -260, 576, 1424],
  '-': [819, 160, 486, 660, 701],
  A: [1408, 74, 0, 1334, 1400],
  B: [1358, 176, 0, 1240, 1400],
  C: [1283, 120, -22, 1191, 1424],
  D: [1402, 176, 0, 1282, 1400],
  E: [1232, 176, 0, 1126, 1400],
  F: [1141, 176, 0, 1077, 1400],
  G: [1367, 120, -24, 1233, 1424],
  H: [1428, 176, 0, 1252, 1400],
  I: [583, 176, 0, 407, 1400],
  J: [1107, 40, -24, 940, 1400],
  K: [1384, 176, 0, 1310, 1400],
  L: [1128, 176, 0, 1088, 1400],
  M: [1615, 176, -24, 1439, 1400],
  N: [1430, 176, 0, 1254, 1400],
  O: [1450, 120, -24, 1330, 1424],
  P: [1271, 176, 0, 1216, 1400],
  Q: [1450, 120, -146, 1330, 1424],
  R: [1363, 176, 0, 1242, 1400],
  S: [1217, 96, -24, 1103, 1424],
  T: [1192, 85, 0, 1106, 1400],
  U: [1408, 166, -24, 1242, 1400],
  V: [1344, 76, 0, 1268, 1400],
  W: [1690, 82, 0, 1608, 1400],
  X: [1306, 82, 0, 1224, 1400],
  Y: [1339, 55, 0, 1284, 1400],
  Z: [1286, 106, 0, 1166, 1400],
  Ã: [1408, 74, 0, 1334, 1823],
  Å: [1408, 74, 0, 1334, 1740],
  Ç: [1283, 120, -483, 1191, 1424],
  É: [1232, 176, 0, 1126, 1842],
  Í: [583, 126, 0, 700, 1842],
  Ô: [1450, 120, -24, 1330, 1842],
  Ö: [1450, 120, -24, 1330, 1816],
  Ü: [1408, 166, -24, 1242, 1816],
  Ğ: [1367, 120, -24, 1233, 1862],
  İ: [583, 163, 0, 433, 1817],
  Ş: [1217, 96, -483, 1103, 1424],
  '’': [482, 91, 863, 407, 1424],
}

function glyph(char: string) {
  const metrics = OVERPASS_600_GLYPHS[char]
  if (!metrics) throw new Error(`no glyph metrics for ${JSON.stringify(char)}`)
  return metrics
}

const SPACING = COUNTRY_LABEL_LETTER_SPACING * ONE_EM
const toGlyph = (units: number) => (units / UNITS_PER_EM) * ONE_EM
const atSdf = (units: number) => (units * TINY_SDF_FONT_PX) / UNITS_PER_EM

/** Harfin ilerlemesi, glif birimi (harf aralığı hariç). */
export function advance(char: string): number {
  return toGlyph(glyph(char)[0])
}

/** Satır genişliği, glif birimi: ilerlemeler + harf aralıkları, sondaki aralık düşülür. */
export function lineWidth(line: string): number {
  let width = 0
  for (const char of line) width += advance(char) + SPACING
  return width - SPACING
}

/** Glif birimiyle kutu, çapaya göre (y aşağı). */
export interface GlyphBox {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Satırların mürekkep kutusu, glif birimi, çapaya göre: her harfin TinySDF'te çizildiği yer (boşluk
 * çizilmez). Satırlar ortalı, blok çapada ortalı.
 */
export function labelInkBox(lines: readonly string[]): GlyphBox {
  const n = lines.length
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity
  for (const [index, line] of lines.entries()) {
    const baseline = -12 * n + ONE_EM * index + BASELINE_FROM_LINE_TOP
    let x = -lineWidth(line) / 2
    for (const char of line) {
      const [advanceUnits, xMin, yMin, xMax, yMax] = glyph(char)
      if (xMax > xMin && yMax > yMin) {
        left = Math.min(left, x + INK_LEFT_SHIFT + Math.floor(atSdf(xMin)) / 2)
        right = Math.max(right, x + INK_LEFT_SHIFT + Math.ceil(atSdf(xMax)) / 2)
        top = Math.min(top, baseline - Math.ceil(atSdf(yMax)) / 2)
        bottom = Math.max(bottom, baseline + Math.ceil(atSdf(Math.max(0, -yMin))) / 2)
      }
      x += toGlyph(advanceUnits) + SPACING
    }
  }
  return { left, top, right, bottom }
}

/** Ad boyu düzeni: geniş ya da dar harita. */
export type LabelLayout = 'regular' | 'compact'
export const LABEL_LAYOUTS: readonly LabelLayout[] = ['regular', 'compact']

/** Kademenin yazı boyu eğrisi. */
export function sizeCurve(tier: CountryLabelTier, layout: LabelLayout): CountryLabelStops {
  return COUNTRY_LABEL_SIZES[layout][tier]
}

/**
 * Görünür kutu, px, çapaya göre: mürekkep × s / 24, her yana s / 8 (halenin en uzak ucu). Güvenlik
 * payı yoktur (e2e piksel denetimi bunu kullanır).
 */
export function visibleBoxPx(ink: GlyphBox, sizePx: number): GlyphBox {
  const scale = sizePx / ONE_EM
  const halo = sizePx * GLYPH_SDF_REACH_EM
  return {
    left: ink.left * scale - halo,
    top: ink.top * scale - halo,
    right: ink.right * scale + halo,
    bottom: ink.bottom * scale + halo,
  }
}

/**
 * Güvenlik payı. Çizilen sınır OpenFreeMap/OSM'dir, model Natural Earth 1:10m'dir; pay ikisinin
 * farkını, üreticinin kendi hatasını ve sınırın koyu kenarını karşılar:
 * - `SAFETY_PX` (px): sınırın koyu kenarının (z3–7'de 3–3,8 px) yarısı ülkenin içine taşar
 *   (`COUNTRY_BORDER_CASING_WIDTH`), üstüne 1 px boşluk.
 * - `SAFETY_KM` (km, yakınlaştırmayla büyür): Douglas–Peucker toleransı + fixture yuvarlaması +
 *   world-atlas nicelemesi + Natural Earth ile OSM arasındaki fark için en az 1 km.
 * - `FAR_SAFETY_KM`: Türkiye'den uzak ülkelerin km payı (D-100): toleransları 1 km'dir
 *   (`farSimplifyKm`), bileşenler aynı (toplam 2,3).
 */
export const SAFETY_PX = 3
export const SAFETY_KM = 2
export const FAR_SAFETY_KM = 2.5
/** Payın bileşenleri (testte toplamın payı aşmadığı denetlenir). */
export const SAFETY_BUDGET = {
  /** Sınırın koyu kenarından sonra kalan boşluk, px. */
  pixelGapPx: 1,
  /** world-atlas nicelemesinin yarısı, km (0,0036° boylam ≈ 0,4 km; yarısı 0,2). */
  sourceQuantumKm: 0.2,
  /** Fixture'ın 0,001°'ye yuvarlanması, km (√2 × 0,0005° ≈ 0,08). */
  fixtureQuantumKm: 0.1,
  /** Natural Earth 1:10m ile OSM sınırları ve Esri kıyısı arasındaki fark, km. */
  naturalEarthVsOsmKm: 1,
} as const

/** Payın km bileşenlerinin toplamı (≤ `SAFETY_KM`; uzak ülkelerde `farSimplifyKm` ile ≤ `FAR_SAFETY_KM`). */
export function safetyBudgetKm(simplifyKm: number = NATURAL_EARTH_PARAMS.simplifyKm): number {
  return (
    simplifyKm +
    SAFETY_BUDGET.fixtureQuantumKm +
    SAFETY_BUDGET.sourceQuantumKm +
    SAFETY_BUDGET.naturalEarthVsOsmKm
  )
}

/** Sınırın koyu kenarının en geniş yarısı, px, adların tam göründüğü aralıkta (z3–7). */
export function largestCasingHalfWidthPx(): number {
  const expression = COUNTRY_BORDER_CASING_WIDTH as unknown[]
  const flat = expression.slice(3) as number[]
  const stops: [number, number][] = []
  for (let i = 0; i + 1 < flat.length; i += 2)
    stops.push([flat[i] as number, flat[i + 1] as number])
  let widest = 0
  for (let zoom = 3; zoom <= COUNTRY_LABEL_FADE_START_ZOOM + 1e-9; zoom += 0.05) {
    widest = Math.max(widest, interpolateStops(stops, zoom))
  }
  return widest / 2
}

/** Sığma sınamasının kutusu: görünür kutu + `SAFETY_PX` (px; km payı ayrıca eklenir). */
export function fitBoxPx(ink: GlyphBox, sizePx: number): GlyphBox {
  const box = visibleBoxPx(ink, sizePx)
  return {
    left: box.left - SAFETY_PX,
    top: box.top - SAFETY_PX,
    right: box.right + SAFETY_PX,
    bottom: box.bottom + SAFETY_PX,
  }
}

/** Bir adın bir kademede ve düzende sığma sınaması (bir ülkenin geometrisine karşı). */
export class LabelFitter {
  readonly zooms: readonly number[]
  readonly ink: GlyphBox
  private readonly boxes: GlyphBox[]
  private readonly scales: number[]

  /**
   * @param shape ülkenin izdüşümdeki kenarları
   * @param lines adın satırları
   * @param tier ad boyu kademesi (eğri ve ilk yakınlaştırma)
   * @param layout geniş ya da dar harita
   * @param safetyKm km payı (`SAFETY_KM`; Türkiye'den uzak ülkede `FAR_SAFETY_KM`)
   */
  constructor(
    readonly shape: ProjectedShape,
    readonly lines: readonly string[],
    readonly tier: CountryLabelTier,
    readonly layout: LabelLayout,
    readonly safetyKm: number = SAFETY_KM,
  ) {
    this.zooms = countryLabelFitZooms(tier)
    this.ink = labelInkBox(lines)
    const curve = sizeCurve(tier, layout)
    this.boxes = this.zooms.map((zoom) => fitBoxPx(this.ink, interpolateStops(curve, zoom)))
    this.scales = this.zooms.map((zoom) => 2 ** zoom)
  }

  /** Adın z'deki görünür kutusu, px, çapaya göre (güvenlik payı yok; havalimanı çakışması). */
  visibleBoxAt(zoom: number): GlyphBox {
    return visibleBoxPx(this.ink, interpolateStops(sizeCurve(this.tier, this.layout), zoom))
  }

  /** Ad z'de (herhangi bir yakınlaştırma) çapası (lon, lat) iken ülkenin içinde mi. */
  fitsAtZoom(lon: number, lat: number, zoom: number, centreInside?: boolean): boolean {
    const box = fitBoxPx(this.ink, interpolateStops(sizeCurve(this.tier, this.layout), zoom))
    return this.fitsBox(box, 2 ** zoom, lon, lat, centreInside)
  }

  /** `zooms[index]`'te sığıyor mu (önceden hesaplı kutu). */
  fitsAtLevel(lon: number, lat: number, index: number, centreInside?: boolean): boolean {
    return this.fitsBox(
      this.boxes[index] as GlyphBox,
      this.scales[index] as number,
      lon,
      lat,
      centreInside,
    )
  }

  private fitsBox(
    box: GlyphBox,
    scale: number,
    lon: number,
    lat: number,
    centreInside?: boolean,
  ): boolean {
    const x = mercatorX(lon)
    const y = mercatorY(lat)
    const km = this.safetyKm * unitsPerKm(lat)
    return this.shape.containsRect(
      x + box.left / scale - km,
      y + box.top / scale - km,
      x + box.right / scale + km,
      y + box.bottom / scale + km,
      x,
      y,
      centreInside,
    )
  }

  /**
   * İlk sığma düzeyi (`zooms` dizini): sığma yakınlaştırmayla bozulmadığından (testte denetlenir)
   * ikili aramayla bulunur; hiç sığmazsa `zooms.length`. `guess` komşu noktanın sonucudur: oradan
   * katlanarak aranır, çoğu nokta iki sınamayla biter.
   */
  firstFitLevel(
    lon: number,
    lat: number,
    guess = this.zooms.length - 1,
    centreInside?: boolean,
  ): number {
    const count = this.zooms.length
    const fits = (index: number) => this.fitsAtLevel(lon, lat, index, centreInside)
    const start = Math.max(0, Math.min(count - 1, guess))
    // low: sığmadığı bilinen en büyük düzey (−1: yok); high: sığdığı bilinen en küçük (count: hiç).
    let low = -1
    let high = count
    let step = 1
    if (fits(start)) {
      high = start
      while (high > 0) {
        const probe = Math.max(0, high - step)
        if (!fits(probe)) {
          low = probe
          break
        }
        high = probe
        step *= 2
      }
    } else {
      low = start
      while (low < count - 1) {
        const probe = Math.min(count - 1, low + step)
        if (fits(probe)) {
          high = probe
          break
        }
        low = probe
        step *= 2
      }
    }
    while (high - low > 1) {
      const middle = (low + high) >> 1
      if (fits(middle)) high = middle
      else low = middle
    }
    return high
  }

  /** İlk sığma yakınlaştırması ya da `Infinity` (adlar silinmeye başlamadan hiç sığmaz). */
  fitZoom(lon: number, lat: number): number {
    const level = this.firstFitLevel(lon, lat)
    return level < this.zooms.length ? (this.zooms[level] as number) : Infinity
  }
}

/** Izgara adımı, yakınlaştırma (`COUNTRY_LABEL_FIT_ZOOM_STEP`). */
export const FIT_ZOOM_STEP = COUNTRY_LABEL_FIT_ZOOM_STEP

interface LineBreak {
  index: number
  x: number
  prior: LineBreak | null
  badness: number
}

/**
 * MapLibre'nin satır kırması (`tagged_string.ts` `determineLineBreaks`): boşluk, kısa çizgi, sağ
 * parantez, & ve satır sonundan (MapLibre'nin kırılabilir harflerinden adlarda geçebilenler); satır
 * sonu −10.000 cezayla her zaman kırar. Satırlar kırpılır (`shapeLines`).
 */
export function maplibreLineBreaks(text: string, maxWidthEm: number): string[] {
  const chars = [...text]
  const advanceOf = (char: string) => (char === '\n' ? 0 : advance(char) + SPACING)
  const total = chars.reduce((sum, char) => sum + advanceOf(char), 0)
  const target = total / Math.max(1, Math.ceil(total / (maxWidthEm * ONE_EM)))
  const badness = (width: number, penalty: number, last: boolean) => {
    const raggedness = (width - target) ** 2
    if (last) return width < target ? raggedness / 2 : raggedness * 2
    return raggedness + Math.abs(penalty) * penalty
  }
  const evaluate = (
    index: number,
    x: number,
    candidates: LineBreak[],
    penalty: number,
    last: boolean,
  ) => {
    let best: LineBreak = { index, x, prior: null, badness: badness(x, penalty, last) }
    for (const candidate of candidates) {
      const value = badness(x - candidate.x, penalty, last) + candidate.badness
      if (value <= best.badness) best = { index, x, prior: candidate, badness: value }
    }
    return best
  }
  const breakable = new Set(['\n', ' ', '-', ')', '&'])
  const candidates: LineBreak[] = []
  let x = 0
  for (const [i, char] of chars.entries()) {
    const previous = chars[i - 1]
    if (previous !== undefined && breakable.has(previous)) {
      candidates.push(evaluate(i, x, candidates, previous === '\n' ? -10000 : 0, false))
    }
    if (char !== ' ' && char !== '\n') x += advanceOf(char)
  }
  const indices: number[] = []
  for (let b: LineBreak | null = evaluate(chars.length, x, candidates, 0, true); b; b = b.prior) {
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
