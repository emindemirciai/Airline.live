/**
 * Ülke sınırları (kullanıcı isteği 2026-10-04: "haritada ülke sınırları kesikli kesikli çizgilerle
 * belirgin olmalı", D-092). Kaynak OpenMapTiles şemasındaki vektör karoların `boundary`
 * katmanıdır (OpenFreeMap; OpenStreetMap verisi, ODbL). Uydu altlığında sınırlar ayrı bir vektör
 * kaynaktan (`COUNTRY_BORDER_SOURCE_ID`) çizilir; OpenFreeMap'in koyu stilinde stilin kendi
 * kaynağından, stilin `boundary` katmanlarının yerine aynı katmanlarla.
 *
 * Yalnızca kara sınırları çizilir (`COUNTRY_BORDER_FILTER`):
 * - `admin_level` 2: ülke sınırı (il ve eyalet sınırı yok)
 * - `maritime` 1 değil: karasuları ve deniz yetki alanı çizgileri denizi kesik çizgiyle doldurmasın
 * - `claimed_by` yok: OpenMapTiles bu alanı bir ülkenin kendi iddiasına göre görmek istediği çizgiye
 *   koyar; o çizgiler çizilmez, haritada fiilî sınır (OSM'nin "yerinde olan" kuralı) kalır
 *
 * Görünüm: beyaz kesikli çizgi, altında yarı saydam koyu kenar; tartışmalı sınır (`disputed` 1)
 * aynı renk ve kenarla noktalıdır. Katmanlar alttan üste: kenar, kesikli çizgi, noktalı çizgi.
 * Bütün yakınlaştırmalarda görünürler (karolar z0–z4'te Natural Earth, z5'ten sonra OSM'dir).
 * Uçaklar, iz ve havalimanı pinleri bu katmanların üstünde çizilir (altlıktan sonra eklenirler);
 * etiketler ayrı tuvaldedir.
 *
 * Düz nesnelerdir: web stil nesnesine koyar, mobil aynı nesneleri kullanır (layers.ts gibi).
 */
import { MAP_COLORS } from './colors'
import type { LineLayerStyle, StyleExpression } from './layers'

/** Uydu altlığının üstündeki sınır kaynağının kimliği (OpenFreeMap vektör karoları). */
export const COUNTRY_BORDER_SOURCE_ID = 'hy-country-borders'
/** OpenMapTiles şemasında idari sınırları taşıyan katman. */
export const COUNTRY_BORDER_SOURCE_LAYER = 'boundary'

export const COUNTRY_BORDER_CASING_LAYER_ID = 'hy-country-border-casing'
export const COUNTRY_BORDER_LAYER_ID = 'hy-country-border'
export const COUNTRY_BORDER_DISPUTED_LAYER_ID = 'hy-country-border-disputed'

/**
 * Sınır kaynağının en büyük karo yakınlaştırması. TileJSON z14'e kadar karo verir; z10'un üstünde
 * z10 karoları büyütülür. Ülke sınırı z10 karosunda yaklaşık bir piksellik genellemeyle gelir
 * (OpenMapTiles `ZRes(11)` ≈ 76 m); karşılığında havalimanı yakınlaştırmalarında (z11–z17) bina,
 * adres ve yer imi taşıyan ağır karolar yalnızca sınır için indirilmez. MapLibre'de stildeki
 * değer TileJSON'dakine üstün gelir.
 */
export const COUNTRY_BORDER_SOURCE_MAX_ZOOM = 10

/** Kara ülke sınırları: ülke düzeyi, deniz sınırı değil, bir ülkenin iddia çizgisi değil. */
export const COUNTRY_BORDER_FILTER: StyleExpression = [
  'all',
  ['==', ['get', 'admin_level'], 2],
  ['!=', ['get', 'maritime'], 1],
  ['!', ['has', 'claimed_by']],
]

const SETTLED_FILTER: StyleExpression = [
  'all',
  COUNTRY_BORDER_FILTER,
  ['!=', ['get', 'disputed'], 1],
]

const DISPUTED_FILTER: StyleExpression = [
  'all',
  COUNTRY_BORDER_FILTER,
  ['==', ['get', 'disputed'], 1],
]

/**
 * Kesikli çizgi, çizgi kalınlığı biriminde. Uçlar yuvarlaktır: MapLibre yuvarlak ucu her çizginin
 * iki yanına yarım kalınlık ekler. Görünen çizgi 3, boşluk 2 kalınlıktır.
 */
export const COUNTRY_BORDER_DASH = [2, 3]
/** Tartışmalı sınır: sıfır uzunluklu çizgi ve yuvarlak uç = nokta (çapı 1, aralığı 1,5 kalınlık). */
export const DISPUTED_BORDER_DASH = [0, 2.5]

/** Beyaz çizginin kalınlığı, px: z3'te 1, z6'da 1,5, z10 ve üstünde 2,25. */
export const COUNTRY_BORDER_WIDTH: StyleExpression = [
  'interpolate',
  ['linear'],
  ['zoom'],
  3,
  1,
  6,
  1.5,
  10,
  2.25,
]

/** Koyu kenarın kalınlığı, px: çizginin her yanında en az 1 px taşar. */
export const COUNTRY_BORDER_CASING_WIDTH: StyleExpression = [
  'interpolate',
  ['linear'],
  ['zoom'],
  3,
  3,
  6,
  3.5,
  10,
  4.75,
]

/** Koyu kenarın saydamlığı: uydu görüntüsünü örtmeden açık toprakta da çizgiyi ayırır. */
export const COUNTRY_BORDER_CASING_OPACITY = 0.6

const ROUND = { 'line-cap': 'round', 'line-join': 'round' } as const

/**
 * Ülke sınırı katmanları alttan üste (kenar, kesikli, noktalı). `source`, OpenMapTiles şemalı vektör
 * kaynaktır: uyduda `COUNTRY_BORDER_SOURCE_ID`, OpenFreeMap stilinde stilin kendi kaynağı.
 */
export function countryBorderLayers(source: string): LineLayerStyle[] {
  const base = { type: 'line', source, 'source-layer': COUNTRY_BORDER_SOURCE_LAYER } as const
  return [
    {
      ...base,
      id: COUNTRY_BORDER_CASING_LAYER_ID,
      filter: COUNTRY_BORDER_FILTER,
      layout: ROUND,
      paint: {
        'line-color': MAP_COLORS.borderCasing,
        'line-width': COUNTRY_BORDER_CASING_WIDTH,
        'line-opacity': COUNTRY_BORDER_CASING_OPACITY,
      },
    },
    {
      ...base,
      id: COUNTRY_BORDER_LAYER_ID,
      filter: SETTLED_FILTER,
      layout: ROUND,
      paint: {
        'line-color': MAP_COLORS.border,
        'line-width': COUNTRY_BORDER_WIDTH,
        'line-opacity': 1,
        'line-dasharray': COUNTRY_BORDER_DASH,
      },
    },
    {
      ...base,
      id: COUNTRY_BORDER_DISPUTED_LAYER_ID,
      filter: DISPUTED_FILTER,
      layout: ROUND,
      paint: {
        'line-color': MAP_COLORS.border,
        'line-width': COUNTRY_BORDER_WIDTH,
        'line-opacity': 1,
        'line-dasharray': DISPUTED_BORDER_DASH,
      },
    },
  ]
}

/** Vektör karo kaynağı (style-spec `VectorSourceSpecification` alt kümesi; TileJSON adresiyle). */
export interface VectorSourceStyle {
  type: 'vector'
  /** TileJSON adresi; karo adresleri ve sürüm oradan gelir. */
  url: string
  maxzoom: number
  /** Atıf HTML'i; TileJSON'daki atfın yerine geçer ve kaynak kullanılırken haritada görünür. */
  attribution: string
}

/** Uydu altlığının üstündeki sınır kaynağı. Karoları tarayıcı doğrudan çeker; sunucu aracılık etmez. */
export function countryBorderSource(url: string, attribution: string): VectorSourceStyle {
  return { type: 'vector', url, maxzoom: COUNTRY_BORDER_SOURCE_MAX_ZOOM, attribution }
}
