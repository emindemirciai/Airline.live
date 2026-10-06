/**
 * Haritada ülke adları (D-095, D-096, D-099, D-103). Kullanıcı kararı 2026-10-05: tasarım tuvalinde A ·
 * "Sessiz büyük harf", "Saydam olsun"; sonra "Ülke isimlerini ülke sınırları dışına taşırma. 2 kelime
 * ise alt alta yaz."; sonra "boyut iyi fakat az biraz daha belirgin olsun ülke isimleri. boşlukta bir
 * yerde yazsa da olur." Ad sayfanın dilinde büyük harfle yazılır; işaret noktası yoktur. Ad boyu
 * ülkenin yüzölçümü kademesindendir (capitals.ts).
 *
 * - **Sınırın içinde (D-096):** adın görünür kutusu (bütün satırlar, harf aralığı, hale ve güvenlik
 *   payı) ülkenin kara poligonunun içinde kalmadıkça ad çizilmez. Yer ve ilk yakınlaştırma
 *   çevrimdışı hesaplanır (`COUNTRY_LABEL_PLACEMENTS`, `pnpm country-labels`). Ad, ilk sığdığı
 *   yakınlaştırmanın (`fitZoom`) altında çizilmez; o yakınlaştırmada belirmeye başlar. Hiçbir
 *   yakınlaştırmada sığmayan küçük ülkenin (Bahreyn, Lüksemburg, Malta) adı yazılmaz.
 * - **Boş yerde (D-099):** ad, havalimanı pinlerinin ve kodlarının olmadığı bir yerdedir: üreticinin
 *   modeline göre kutusuna yazıldığı hiçbir yakınlaştırmada pin ya da kod girmez (boş yer için en
 *   çok 1,5 kademe geç belirir); boş yer yoksa (yalnızca Türkiye) en az çakışan yerdedir ve geç
 *   gelmez. Eşitlikte en erken sığan, sonra ülkenin görsel merkezine en yakın yer seçilir; başkent
 *   rol oynamaz. İstisna KIBRIS'tır: kullanıcı kararıyla Lefkoşa'da yazılır (D-095), Ercan pini adın
 *   üstündedir. Model, pini ve kodun pin başının sağındaki ve solundaki kutusunu commit'li
 *   OurAirports fixture'ının (2026-10-01) haritada pini çizilen havalimanları (listelenenler,
 *   askerî hava üsleri hariç: `mapShownAirports`, D-103) için sayar. Haritada kod
 *   pinin üstüne ya da altına geçerse ya da OurAirports'un gece yenilenmesiyle yeni bir havalimanı
 *   listelenirse kod ya da pin adın üstüne düşebilir (D-099 "Bilinen sınırlar").
 * - **Satır:** her sözcük ayrı satırda, ortalı ("SUUDİ / ARABİSTAN"); bağlaç önceki sözcükle kalır
 *   ("BOSNIA AND / HERZEGOVINA"); kısa çizgide kırılır, çizgi yazılmaz ("BOSNA / HERSEK").
 * - **Yazı:** sitenin yazı tipi Overpass, 600 ağırlık (`COUNTRY_LABEL_FONT`; web stilin
 *   `font-faces` alanında tanımlar), harf aralığı 0,32 em, satır yüksekliği 1.
 * - **Renk (D-099):** beyaz 0,85 saydamlıkta, koyu hale 0,9 saydamlıkta, zeminsiz. Hale genişliği
 *   yazı boyuyla orantılıdır, glif SDF'inin taşıyabildiği payın neredeyse tamamını kullanır (az
 *   yumuşaklık) ve payın içinde kalır (`countryLabelHalo`).
 * - **Yakınlaştırma:** kademe 1 en erken z3'te, 2 z3,5'te, 3 z4,5'te belirir (ad sığıyorsa); yarım
 *   kademede tam görünür; z7'de silinmeye başlar, z8 ve üstünde hiç çizilmez.
 * - **Katmanlar:** her (kademe, ilk yakınlaştırma) çifti için bir symbol katmanı (40 katman). Katmanın
 *   `minzoom`'u adın ilk yakınlaştırmasıdır: MapLibre `minzoom`'u kesirli yakınlaştırmada denetler,
 *   ad tam o yakınlaştırmada belirir ya da kaybolur. Boy ve hale yalnızca yakınlaştırmaya bağlı
 *   eğrilerdir; MapLibre bunları çizilen yakınlaştırmada hesaplar, eldeki büyük karodan çizerken de
 *   modelin boyunu aşmaz.
 * - **Çakışma:** adlar birbirini silmez (`text-allow-overlap`): her ad kendi ülkesinin içinde
 *   olduğundan iki ad örtüşemez. Pin, kod ve uçaklar her zaman adların üstünde çizilir ve MapLibre
 *   yerleşimine katılmaz; adın yeri çevrimdışı seçilirken pin ve kodlardan kaçınılır (D-099).
 *
 * Düz nesnelerdir (layers.ts gibi). Katmanlar `LIVE_MAP_LAYERS`'ta değildir: web onları
 * havalimanı pinlerinin altına ekler; mobilde (MapLibre Native) `font-faces` desteği
 * doğrulanmadığından yoktur.
 */
import type { Locale } from '../locale'
import {
  COUNTRY_CAPITALS,
  countryLabelTier,
  type CountryCapital,
  type CountryLabelTier,
} from '../reference/capitals'
import { MAP_COLORS, withAlpha } from './colors'
import { COUNTRY_LABEL_PLACEMENTS } from './country-label-placements'
import type { StyleExpression, StyleTransition, TextSymbolLayerStyle } from './layers'

export const COUNTRY_LABEL_SOURCE_ID = 'hy-country-labels'
/** Kaynağın en büyük karo yakınlaştırması: adlar z8'de silindiğinden z7 karosu yeter. */
export const COUNTRY_LABEL_SOURCE_MAX_ZOOM = 7

/** Kademeler alttan üste (katman sırası). */
export const COUNTRY_LABEL_TIERS: readonly CountryLabelTier[] = [3, 2, 1]

/** Stilin `font-faces` alanındaki yazı tipi adı (Overpass 600). */
export const COUNTRY_LABEL_FONT = 'Overpass SemiBold'

/** Kademenin en erken görünebildiği yakınlaştırma (ad o yakınlaştırmada sığıyorsa). */
export const COUNTRY_LABEL_MIN_ZOOM: Readonly<Record<CountryLabelTier, number>> = {
  1: 3,
  2: 3.5,
  3: 4.5,
}
/** Belirme süresi, yakınlaştırma kademesi. */
export const COUNTRY_LABEL_FADE_IN_ZOOMS = 0.5
/** Adların silinmeye başladığı yakınlaştırma. */
export const COUNTRY_LABEL_FADE_START_ZOOM = 7
/** Bu yakınlaştırmada ve üstünde ad çizilmez (katmanın `maxzoom`'u). */
export const COUNTRY_LABEL_MAX_ZOOM = 8
/** İlk sığma yakınlaştırmalarının adımı. */
export const COUNTRY_LABEL_FIT_ZOOM_STEP = 0.25

/**
 * Kademenin olası ilk sığma yakınlaştırmaları: kademenin en küçüğünden silinmenin başlangıcının
 * bir adım altına (z6,75), 0,25 adımla.
 */
export function countryLabelFitZooms(tier: CountryLabelTier): number[] {
  const zooms: number[] = []
  const steps = Math.round(
    (COUNTRY_LABEL_FADE_START_ZOOM - COUNTRY_LABEL_MIN_ZOOM[tier]) / COUNTRY_LABEL_FIT_ZOOM_STEP,
  )
  for (let i = 0; i < steps; i++) {
    zooms.push(COUNTRY_LABEL_MIN_ZOOM[tier] + i * COUNTRY_LABEL_FIT_ZOOM_STEP)
  }
  return zooms
}

/** Katman kimliği: `hy-country-labels-<kademe>-<ilk yakınlaştırma × 100>` (ör. `-1-300`). */
export function countryLabelLayerId(tier: CountryLabelTier, fitZoom: number): string {
  return `${COUNTRY_LABEL_SOURCE_ID}-${tier}-${Math.round(fitZoom * 100)}`
}

/** Katmanların (kademe, ilk yakınlaştırma) çiftleri, alttan üste: kademe 3, 2, 1; z küçükten. */
export const COUNTRY_LABEL_LAYER_KEYS: readonly (readonly [
  tier: CountryLabelTier,
  fitZoom: number,
])[] = COUNTRY_LABEL_TIERS.flatMap((tier) =>
  countryLabelFitZooms(tier).map((fitZoom) => [tier, fitZoom] as const),
)

/** Katman kimlikleri alttan üste (40). */
export const COUNTRY_LABEL_LAYER_IDS: readonly string[] = COUNTRY_LABEL_LAYER_KEYS.map(
  ([tier, fitZoom]) => countryLabelLayerId(tier, fitZoom),
)

/** Yazı boyu durakları: [yakınlaştırma, px]. */
export type CountryLabelStops = readonly (readonly [zoom: number, value: number])[]

/**
 * Yazı boyu, px. z5'te tasarımın boyları (34 / 22 / 14; tasarım ~z4,9'da çizildi). Düşük
 * yakınlaştırmada eğri diktir. Dar haritada (`compact`) kademe 1 ve 2 ~0,8 katıdır; kademe 3
 * küçülmez. Eğrinin bağıl büyümesi (d ln boy / dz) her yerde ln 2'nin altındadır: harita her
 * kademede iki kat büyüdüğünden bir yakınlaştırmada sığan ad her büyük yakınlaştırmada da sığar
 * (D-096; tools'taki test denetler).
 */
export const COUNTRY_LABEL_SIZES: Readonly<
  Record<'regular' | 'compact', Readonly<Record<CountryLabelTier, CountryLabelStops>>>
> = {
  regular: {
    1: [
      [3, 20],
      [4, 27],
      [5, 34],
      [7, 39],
    ],
    2: [
      [3.5, 15],
      [4, 17],
      [5, 22],
      [7, 25],
    ],
    3: [
      [3, 11],
      [5, 14],
      [7, 16],
    ],
  },
  compact: {
    1: [
      [3, 17],
      [4, 22],
      [5, 27],
      [7, 31],
    ],
    2: [
      [3.5, 13],
      [4, 14.5],
      [5, 18],
      [7, 20],
    ],
    3: [
      [3, 11],
      [5, 14],
      [7, 16],
    ],
  },
}

/** Dar harita: genişliği en çok bu kadar (sitenin alttan açılan kart kırılımı, 767 px). */
export const COUNTRY_LABEL_COMPACT_MAX_WIDTH_PX = 767

export const COUNTRY_LABEL_LETTER_SPACING = 0.32
export const COUNTRY_LABEL_LINE_HEIGHT = 1
/**
 * Satır kırma genişliği, em: her adın toplam genişliğinden büyük (en uzunu BİRLEŞİK ARAP
 * EMİRLİKLERİ, 21,4 em). MapLibre yalnızca adın kendi satır sonlarından kırar.
 */
export const COUNTRY_LABEL_MAX_WIDTH_EM = 24
/** Çakışma kutusuna eklenen pay, px (adlar birbirini silmez; vektör yedekte yer adlarını iter). */
export const COUNTRY_LABEL_PADDING_PX = 6

/**
 * Yazının saydamlığı: beyaz 0,85 (D-099; kullanıcı: "az biraz daha belirgin olsun"). D-095'te
 * 0,6'ydı ("Saydam olsun"); altlık yazının içinden hâlâ biraz görünür.
 */
export const COUNTRY_LABEL_TEXT_ALPHA = 0.85
/** Halenin saydamlığı (D-099; D-095'te 0,85). */
export const COUNTRY_LABEL_HALO_ALPHA = 0.9

/**
 * Glif SDF'inin mürekkebin dışına taşıdığı pay, em: MapLibre `font-faces` gliflerini 48 px'te
 * 6 px tamponla çizer (24 px biriminde 3), yani yazı boyunun 1/8'i. Hale bu payın dışına çıkamaz;
 * çıkarsa glif kutusunun kenarında sert kesilir.
 */
export const GLYPH_SDF_REACH_EM = 1 / 8
/** SDF kenar yumuşatması, px (MapLibre `EDGE_GAMMA` 0,105 × `SDF_PX` 8, cihaz piksel oranı 1). */
export const SDF_EDGE_GAMMA_PX = 0.84
/** MapLibre'nin hale yumuşaklığı çarpanı (`halo_blur * 1.19`). */
export const HALO_BLUR_FACTOR = 1.19
/**
 * Payın hale genişliğine ve yumuşaklığına ayrılan bölümleri (toplam 0,95; kenarda boşluk). D-099:
 * genişlik 0,85, yumuşaklık 0,1 (az yumuşak, en koyu hale); D-095'te 0,65 ve 0,3'tü.
 */
export const COUNTRY_LABEL_HALO_WIDTH_SHARE = 0.85
export const COUNTRY_LABEL_HALO_BLUR_SHARE = 0.1
/**
 * Hale genişliği ve yumuşaklığının geçişi: yok. Dar haritaya geçerken boy (yerleşim özelliği)
 * karolar yenilenince küçülür; hale MapLibre'nin varsayılan 300 ms'lik geçişiyle küçülseydi o arada
 * küçük harfin glif payını aşar ve glif kutusunda kesilirdi.
 */
export const COUNTRY_LABEL_HALO_TRANSITION: Readonly<StyleTransition> = { duration: 0, delay: 0 }

const floor2 = (value: number) => Math.floor(value * 100 + 1e-9) / 100

/**
 * Yazı boyuna göre hale genişliği ve yumuşaklığı, px. Halenin dış ucu
 * `genişlik + 1,19 × yumuşaklık + 0,84` px'tir; bu, glif payını (`boy / 8`) aşmaz.
 */
export function countryLabelHalo(sizePx: number): { width: number; blur: number } {
  const budget = Math.max(0, sizePx * GLYPH_SDF_REACH_EM - SDF_EDGE_GAMMA_PX)
  return {
    width: floor2(budget * COUNTRY_LABEL_HALO_WIDTH_SHARE),
    blur: floor2((budget * COUNTRY_LABEL_HALO_BLUR_SHARE) / HALO_BLUR_FACTOR),
  }
}

/** Kendinden önceki sözcükle aynı satırda kalan bağlaçlar. */
export const COUNTRY_LABEL_CONNECTORS: Readonly<Record<Locale, readonly string[]>> = {
  tr: ['VE'],
  en: ['AND', 'OF', 'THE'],
}

/**
 * Adın satırları (D-096; kullanıcı: "2 kelime ise alt alta yaz"): her sözcük ayrı satırdadır, 3 ve
 * daha çok sözcükte de. Kısa çizgide kırılır, çizgi yazılmaz ("BOSNA-HERSEK" → BOSNA / HERSEK).
 * Bağlaç önceki sözcükle kalır ("BOSNIA AND / HERZEGOVINA"); baştaki bağlaç sonrakine katılır.
 */
export function countryLabelLines(name: string, locale: Locale): string[] {
  const connectors = COUNTRY_LABEL_CONNECTORS[locale]
  const words = name.split(/[\s-]+/).filter((word) => word.length > 0)
  const lines: string[] = []
  let pending = ''
  for (const word of words) {
    if (connectors.includes(word)) {
      const last = lines.length - 1
      if (last >= 0) lines[last] = `${lines[last]} ${word}`
      else pending = pending ? `${pending} ${word}` : word
      continue
    }
    lines.push(pending ? `${pending} ${word}` : word)
    pending = ''
  }
  if (pending) lines.push(pending)
  return lines
}

/**
 * Saydamlık durakları: ilk sığma yakınlaştırmasında 0, yarım kademe sonra (en geç z7'de) tam, z7–8
 * arasında silinir. Yinelenen duraklar atılır.
 */
export function countryLabelOpacityStops(fitZoom: number): CountryLabelStops {
  const full = Math.min(fitZoom + COUNTRY_LABEL_FADE_IN_ZOOMS, COUNTRY_LABEL_FADE_START_ZOOM)
  const stops: [number, number][] = [
    [fitZoom, 0],
    [full, 1],
    [COUNTRY_LABEL_FADE_START_ZOOM, 1],
    [COUNTRY_LABEL_MAX_ZOOM, 0],
  ]
  return stops.filter(
    (stop, index) => index === 0 || stop[0] > (stops[index - 1]?.[0] ?? -Infinity),
  )
}

/** Doğrusal ara değer; ilk duraktan önce ilk, sondan sonra son değer. */
export function interpolateStops(stops: CountryLabelStops, zoom: number): number {
  const first = stops[0]
  const last = stops.at(-1)
  if (!first || !last) return 0
  if (zoom <= first[0]) return first[1]
  if (zoom >= last[0]) return last[1]
  for (let i = 1; i < stops.length; i++) {
    const [z1, v1] = stops[i] as readonly [number, number]
    const [z0, v0] = stops[i - 1] as readonly [number, number]
    if (zoom <= z1) return v0 + ((zoom - z0) / (z1 - z0)) * (v1 - v0)
  }
  return last[1]
}

/** İlk yakınlaştırması `fitZoom` olan adın saydamlığı: katman aralığının dışında 0. */
export function countryLabelOpacityAt(fitZoom: number, zoom: number): number {
  if (zoom < fitZoom || zoom >= COUNTRY_LABEL_MAX_ZOOM) return 0
  return interpolateStops(countryLabelOpacityStops(fitZoom), zoom)
}

/** Kademenin yakınlaştırmadaki yazı boyu, px. */
export function countryLabelSizeAt(tier: CountryLabelTier, compact: boolean, zoom: number): number {
  return interpolateStops(COUNTRY_LABEL_SIZES[compact ? 'compact' : 'regular'][tier], zoom)
}

/** Kaynaktaki her Point'in özellikleri. */
export interface CountryLabelFeatureProperties {
  /** ISO 3166-1 alpha-2. */
  code: string
  /** Ad, tek satır (`COUNTRY_LABEL_PLACEMENTS`'taki, ölçülen ad; test niteliği bunu okur). */
  name: string
  /** Haritada yazılan metin: satırlar `\n` ile (`countryLabelLines`). */
  label: string
  tier: CountryLabelTier
  /** Adın ilk sığdığı yakınlaştırma; katmanını seçer. */
  fitZoom: number
  /** `symbol-sort-key`: Türkiye 0, sonra büyük yüzölçümü önce. */
  rank: number
}

export interface CountryLabelPoint {
  lat: number
  lon: number
  properties: CountryLabelFeatureProperties
}

/** Ülkelerin sırası: Türkiye, sonra büyükten küçüğe (eşitlikte kod). */
const RANKED_CAPITALS: readonly CountryCapital[] = [...COUNTRY_CAPITALS].sort((a, b) => {
  if (a.code === 'TR' || b.code === 'TR') return a.code === 'TR' ? -1 : 1
  return b.areaKm2 - a.areaKm2 || (a.code < b.code ? -1 : 1)
})

/**
 * Ülke adı noktaları, sırayla (rank 0'dan): yer ve ilk yakınlaştırma `COUNTRY_LABEL_PLACEMENTS`'tan,
 * sayfanın dilinde ve haritanın genişliğine göre. Hiç sığmayan ad yoktur.
 */
export function countryLabelPoints(locale: Locale, compact: boolean): CountryLabelPoint[] {
  const placements = COUNTRY_LABEL_PLACEMENTS[locale]
  const points: CountryLabelPoint[] = []
  for (const [rank, capital] of RANKED_CAPITALS.entries()) {
    const row = Object.hasOwn(placements, capital.code) ? placements[capital.code] : undefined
    const placement = row?.[compact ? 'compact' : 'regular']
    if (!row || !placement) continue
    const [lon, lat, fitZoom] = placement
    points.push({
      lat,
      lon,
      properties: {
        code: capital.code,
        name: row.name,
        label: countryLabelLines(row.name, locale).join('\n'),
        tier: countryLabelTier(capital),
        fitZoom,
        rank,
      },
    })
  }
  return points
}

const zoomCurve = (stops: CountryLabelStops): StyleExpression => [
  'interpolate',
  ['linear'],
  ['zoom'],
  ...stops.flat(),
]

const sizesOf = (tier: CountryLabelTier, compact: boolean) =>
  COUNTRY_LABEL_SIZES[compact ? 'compact' : 'regular'][tier]

/** Kademenin yazı boyu ifadesi (pencere boyu değişince web `setLayoutProperty` ile verir). */
export function countryLabelTextSize(tier: CountryLabelTier, compact: boolean): StyleExpression {
  return zoomCurve(sizesOf(tier, compact))
}

/** Kademenin hale genişliği ya da yumuşaklığı ifadesi (`setPaintProperty` ile değişir). */
export function countryLabelHaloCurve(
  tier: CountryLabelTier,
  compact: boolean,
  part: 'width' | 'blur',
): StyleExpression {
  return zoomCurve(
    sizesOf(tier, compact).map(([zoom, size]) => [zoom, countryLabelHalo(size)[part]] as const),
  )
}

export interface CountryLabelLayerOptions {
  /** Dar harita (≤ `COUNTRY_LABEL_COMPACT_MAX_WIDTH_PX`): küçük boy. */
  compact: boolean
  /** Ayarda "Gizle" ise false (`visibility: none`; katman hiç çizilmez). Varsayılan true. */
  visible?: boolean
}

/** Ülke adı katmanları alttan üste: her (kademe, ilk yakınlaştırma) için bir katman (40). */
export function countryLabelLayers(options: CountryLabelLayerOptions): TextSymbolLayerStyle[] {
  const { compact, visible = true } = options
  return COUNTRY_LABEL_LAYER_KEYS.map(([tier, fitZoom]) => ({
    id: countryLabelLayerId(tier, fitZoom),
    type: 'symbol',
    source: COUNTRY_LABEL_SOURCE_ID,
    filter: ['all', ['==', ['get', 'tier'], tier], ['==', ['get', 'fitZoom'], fitZoom]],
    minzoom: fitZoom,
    maxzoom: COUNTRY_LABEL_MAX_ZOOM,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': [COUNTRY_LABEL_FONT],
      'text-size': countryLabelTextSize(tier, compact),
      'text-letter-spacing': COUNTRY_LABEL_LETTER_SPACING,
      'text-line-height': COUNTRY_LABEL_LINE_HEIGHT,
      'text-max-width': COUNTRY_LABEL_MAX_WIDTH_EM,
      'text-anchor': 'center',
      'text-justify': 'center',
      'text-padding': COUNTRY_LABEL_PADDING_PX,
      'text-allow-overlap': true,
      'text-ignore-placement': false,
      'text-rotation-alignment': 'viewport',
      'text-pitch-alignment': 'viewport',
      'symbol-sort-key': ['get', 'rank'],
      visibility: visible ? 'visible' : 'none',
    },
    paint: {
      'text-color': withAlpha(MAP_COLORS.countryLabel, COUNTRY_LABEL_TEXT_ALPHA),
      'text-halo-color': withAlpha(MAP_COLORS.countryLabelHalo, COUNTRY_LABEL_HALO_ALPHA),
      'text-halo-width': countryLabelHaloCurve(tier, compact, 'width'),
      'text-halo-width-transition': { ...COUNTRY_LABEL_HALO_TRANSITION },
      'text-halo-blur': countryLabelHaloCurve(tier, compact, 'blur'),
      'text-halo-blur-transition': { ...COUNTRY_LABEL_HALO_TRANSITION },
      'text-opacity': zoomCurve(countryLabelOpacityStops(fitZoom)),
    },
  }))
}
