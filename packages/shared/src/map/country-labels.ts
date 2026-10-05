/**
 * Haritada ülke adları (kullanıcı kararı 2026-10-05, tasarım tuvalinde A · "Sessiz büyük harf",
 * "Saydam olsun"; D-095). Her ülkenin adı başkentinin üstünde, ortalı ve sayfanın dilinde büyük
 * harfle yazılır; işaret noktası yoktur. Ad boyu ülkenin yüzölçümü kademesindendir (capitals.ts).
 *
 * - **Yazı:** sitenin yazı tipi Overpass, 600 ağırlık (`COUNTRY_LABEL_FONT`; web stilin
 *   `font-faces` alanında tanımlar), harf aralığı 0,32 em, satır yüksekliği 1. MapLibre sondaki
 *   harf aralığını satır genişliğinden düşer: ad başkente göre ortalıdır.
 * - **Renk:** beyaz 0,6 saydamlıkta, koyu yumuşak hale 0,85 saydamlıkta, zeminsiz. MapLibre'nin
 *   halesi harfin içini boyamaz (yazının çevresinde bir halkadır): harfin içinden altlık görünür,
 *   okunurluğu koyu halka taşır. Hale genişliği yazı boyuyla orantılıdır ve glif SDF'inin
 *   taşıyabildiği payın içinde kalır (`countryLabelHalo`); tasarımdaki 6 ve 14 px'lik geniş
 *   gölgeler SDF'le çizilemez.
 * - **Yakınlaştırma:** kademe 1 z3'ten, 2 z3,5'ten, 3 z4,5'ten görünür (yarım kademede belirir);
 *   z7'de silinmeye başlar, z8 ve üstünde hiç çizilmez. Açılış görünümünde (IST, z7,8–8,5) ad
 *   yoktur.
 * - **Çakışma:** adlar yalnızca birbiriyle çakışır (6 px payla); üstteki kademe ve kademe içinde
 *   önce gelen sıra (`rank`: Türkiye, sonra büyükten küçüğe) kazanır. Pin, kod ve uçaklar her zaman
 *   adların üstünde çizilir ve yerleşime katılmaz: ad onları gizlemez, onlar adı silmez.
 * - **Kayma:** ad başkentte ortalıdır. Komşusu yüzünden hiç yer bulamayan ülkenin adı belgeli bir
 *   kaymayla yazılır (`CountryCapital.labelOffsetEm`, `text-offset`); bugün yalnızca Slovakya
 *   (2,5 em yukarıda, AVUSTURYA'nın üstünde).
 * - **Satır:** geniş haritada ad tek satırdır. Dar haritada (≤ 767 px) kademe 1 ve 2'nin 10 em'i
 *   aşan çok sözcüklü adları iki satıra kırılır ("SUUDİ / ARABİSTAN").
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
import { countryLabelText } from '../reference/countries'
import { MAP_COLORS, withAlpha } from './colors'
import type { StyleExpression, TextSymbolLayerStyle } from './layers'

export const COUNTRY_LABEL_SOURCE_ID = 'hy-country-labels'
/** Kaynağın en büyük karo yakınlaştırması: adlar z8'de silindiğinden z7 karosu yeter. */
export const COUNTRY_LABEL_SOURCE_MAX_ZOOM = 7

/** Kademeler alttan üste (çizim ve yerleşim sırası: üstteki önce yerleşir). */
export const COUNTRY_LABEL_TIERS: readonly CountryLabelTier[] = [3, 2, 1]

export function countryLabelLayerId(tier: CountryLabelTier): string {
  return `hy-country-labels-${tier}`
}

/** Katman kimlikleri alttan üste: kademe 3, 2, 1. */
export const COUNTRY_LABEL_LAYER_IDS: readonly string[] =
  COUNTRY_LABEL_TIERS.map(countryLabelLayerId)

/** Stilin `font-faces` alanındaki yazı tipi adı (Overpass 600). */
export const COUNTRY_LABEL_FONT = 'Overpass SemiBold'

/** Kademenin görünmeye başladığı yakınlaştırma; ad buradan yarım kademe sonra tam görünür. */
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

/** Yazı boyu durakları: [yakınlaştırma, px]. */
export type CountryLabelStops = readonly (readonly [zoom: number, value: number])[]

/**
 * Yazı boyu, px. z5'te tasarımın boyları (34 / 22 / 14; tasarım ~z4,9'da çizildi). Düşük
 * yakınlaştırmada eğri diktir: z3'te kademe 1'in en uzun adı (SUUDİ ARABİSTAN) ülkesinden çok
 * taşmaz. Dar haritada (`compact`) kademe 1 ve 2 ~0,8 katıdır; kademe 3 küçülmez.
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
/** Satır kırma genişliği, em: en uzun ad (BİRLEŞİK ARAP EMİRLİKLERİ, 21,4 em) de tek satırdır. */
export const COUNTRY_LABEL_MAX_WIDTH_EM = 24
/** Dar haritada kademe 1 ve 2'nin satır kırma genişliği, em ("SUUDİ / ARABİSTAN"). */
export const COUNTRY_LABEL_COMPACT_WRAP_EM = 10
/** Adların çakışma kutusuna eklenen pay, px. */
export const COUNTRY_LABEL_PADDING_PX = 6

/** Yazının saydamlığı (beyaz 0,6; kullanıcı: "Saydam olsun"). */
export const COUNTRY_LABEL_TEXT_ALPHA = 0.6
/** Halenin saydamlığı. */
export const COUNTRY_LABEL_HALO_ALPHA = 0.85

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
/** Payın hale genişliğine ve yumuşaklığına ayrılan bölümleri (toplam 0,95; kenarda boşluk). */
export const COUNTRY_LABEL_HALO_WIDTH_SHARE = 0.65
export const COUNTRY_LABEL_HALO_BLUR_SHARE = 0.3

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

/** Kademenin satır kırma genişliği, em. */
export function countryLabelMaxWidth(tier: CountryLabelTier, compact: boolean): number {
  return compact && tier !== 3 ? COUNTRY_LABEL_COMPACT_WRAP_EM : COUNTRY_LABEL_MAX_WIDTH_EM
}

/** Saydamlık durakları: yarım kademede belirir, z7–8 arasında silinir. */
export function countryLabelOpacityStops(tier: CountryLabelTier): CountryLabelStops {
  const min = COUNTRY_LABEL_MIN_ZOOM[tier]
  return [
    [min, 0],
    [min + COUNTRY_LABEL_FADE_IN_ZOOMS, 1],
    [COUNTRY_LABEL_FADE_START_ZOOM, 1],
    [COUNTRY_LABEL_MAX_ZOOM, 0],
  ]
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

/** Kademenin yakınlaştırmadaki saydamlığı: katman aralığının dışında 0. */
export function countryLabelOpacityAt(tier: CountryLabelTier, zoom: number): number {
  if (zoom < COUNTRY_LABEL_MIN_ZOOM[tier] || zoom >= COUNTRY_LABEL_MAX_ZOOM) return 0
  return interpolateStops(countryLabelOpacityStops(tier), zoom)
}

/** Kademenin yakınlaştırmadaki yazı boyu, px. */
export function countryLabelSizeAt(tier: CountryLabelTier, compact: boolean, zoom: number): number {
  return interpolateStops(COUNTRY_LABEL_SIZES[compact ? 'compact' : 'regular'][tier], zoom)
}

/** Kaynaktaki her Point'in özellikleri. */
export interface CountryLabelFeatureProperties {
  /** ISO 3166-1 alpha-2. */
  code: string
  /** Haritada yazılan ad (`countryLabelText`). */
  name: string
  tier: CountryLabelTier
  /** Yerleşim sırası (`symbol-sort-key`): Türkiye 0, sonra büyük yüzölçümü önce. */
  rank: number
}

export interface CountryLabelPoint {
  lat: number
  lon: number
  properties: CountryLabelFeatureProperties
}

/** Ülkelerin yerleşim sırası: Türkiye, sonra büyükten küçüğe (eşitlikte kod). */
const RANKED_CAPITALS: readonly CountryCapital[] = [...COUNTRY_CAPITALS].sort((a, b) => {
  if (a.code === 'TR' || b.code === 'TR') return a.code === 'TR' ? -1 : 1
  return b.areaKm2 - a.areaKm2 || (a.code < b.code ? -1 : 1)
})

/** Ülke adı noktaları, sırayla (rank 0'dan). Ad sayfanın dilindedir. */
export function countryLabelPoints(locale: Locale): CountryLabelPoint[] {
  return RANKED_CAPITALS.map((capital, rank) => ({
    lat: capital.lat,
    lon: capital.lon,
    properties: {
      code: capital.code,
      name: countryLabelText(capital.code, locale),
      tier: countryLabelTier(capital),
      rank,
    },
  }))
}

const zoomCurve = (stops: CountryLabelStops): StyleExpression => [
  'interpolate',
  ['linear'],
  ['zoom'],
  ...stops.flat(),
]

const haloCurve = (stops: CountryLabelStops, part: 'width' | 'blur'): StyleExpression =>
  zoomCurve(stops.map(([zoom, size]) => [zoom, countryLabelHalo(size)[part]] as const))

export interface CountryLabelLayerOptions {
  /** Dar harita (≤ `COUNTRY_LABEL_COMPACT_MAX_WIDTH_PX`): küçük boy, kademe 1–2'de satır kırma. */
  compact: boolean
  /** Ayarda "Gizle" ise false (`visibility: none`; katman hiç çizilmez). Varsayılan true. */
  visible?: boolean
}

/** Bir kademenin yazı boyu ifadesi (pencere boyu değişince web `setLayoutProperty` ile verir). */
export function countryLabelTextSize(tier: CountryLabelTier, compact: boolean): StyleExpression {
  return zoomCurve(COUNTRY_LABEL_SIZES[compact ? 'compact' : 'regular'][tier])
}

/** Kaymasız ad: başkentte ortalı. */
export const COUNTRY_LABEL_CENTRED_OFFSET_EM: readonly [x: number, y: number] = [0, 0]

/** Ülke adının başkentten kayması, em, [sağa, aşağı]: kural ortalı, istisna capitals.ts'te. */
export function countryLabelOffsetEm(code: string): readonly [x: number, y: number] {
  return (
    COUNTRY_CAPITALS.find((capital) => capital.code === code)?.labelOffsetEm ??
    COUNTRY_LABEL_CENTRED_OFFSET_EM
  )
}

/**
 * Bir kademenin `text-offset` değeri: kademede kayan ad yoksa [0, 0]; varsa koda göre `match`
 * (kademe 3: `SK` → [0, −2,5], öbürleri [0, 0]).
 */
export function countryLabelTextOffset(tier: CountryLabelTier): [number, number] | StyleExpression {
  const branches: (string | StyleExpression)[] = []
  for (const capital of COUNTRY_CAPITALS) {
    if (capital.labelOffsetEm && countryLabelTier(capital) === tier) {
      branches.push(capital.code, ['literal', [...capital.labelOffsetEm]])
    }
  }
  const centred: [number, number] = [...COUNTRY_LABEL_CENTRED_OFFSET_EM]
  if (branches.length === 0) return centred
  return ['match', ['get', 'code'], ...branches, ['literal', centred]]
}

/** Ülke adı katmanları alttan üste: kademe 3, 2, 1. */
export function countryLabelLayers(options: CountryLabelLayerOptions): TextSymbolLayerStyle[] {
  const { compact, visible = true } = options
  const sizes = COUNTRY_LABEL_SIZES[compact ? 'compact' : 'regular']
  return COUNTRY_LABEL_TIERS.map((tier) => ({
    id: countryLabelLayerId(tier),
    type: 'symbol',
    source: COUNTRY_LABEL_SOURCE_ID,
    filter: ['==', ['get', 'tier'], tier],
    minzoom: COUNTRY_LABEL_MIN_ZOOM[tier],
    maxzoom: COUNTRY_LABEL_MAX_ZOOM,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': [COUNTRY_LABEL_FONT],
      'text-size': zoomCurve(sizes[tier]),
      'text-letter-spacing': COUNTRY_LABEL_LETTER_SPACING,
      'text-line-height': COUNTRY_LABEL_LINE_HEIGHT,
      'text-max-width': countryLabelMaxWidth(tier, compact),
      'text-anchor': 'center',
      'text-offset': countryLabelTextOffset(tier),
      'text-justify': 'center',
      'text-padding': COUNTRY_LABEL_PADDING_PX,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-rotation-alignment': 'viewport',
      'text-pitch-alignment': 'viewport',
      'symbol-sort-key': ['get', 'rank'],
      visibility: visible ? 'visible' : 'none',
    },
    paint: {
      'text-color': withAlpha(MAP_COLORS.countryLabel, COUNTRY_LABEL_TEXT_ALPHA),
      'text-halo-color': withAlpha(MAP_COLORS.countryLabelHalo, COUNTRY_LABEL_HALO_ALPHA),
      'text-halo-width': haloCurve(sizes[tier], 'width'),
      'text-halo-blur': haloCurve(sizes[tier], 'blur'),
      'text-opacity': zoomCurve(countryLabelOpacityStops(tier)),
    },
  }))
}
