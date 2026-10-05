/**
 * Canlı haritanın katmanları (havalimanları, seçili uçağın izi, uçaklar). Düz nesnelerdir:
 * `packages/shared` MapLibre'ye bağımlı değildir; aşağıdaki yerel tipler MapLibre stil
 * belirtiminin (style-spec) katman JSON'unun alt kümesidir, web `map.addLayer()`'a olduğu gibi
 * verir, mobil de aynı nesneleri kullanır. Katman sırası alttan üste: havalimanları, iz, uçaklar.
 * Ülke adları (country-labels.ts, D-095, D-096) bu listede değildir: web onları havalimanlarının altına
 * ekler; mobil şimdilik eklemez.
 */
import { AIRPORT_PIN_ICON_ID, AIRPORT_PIN_MARGIN } from './airport-pin'
import { MAP_COLORS } from './colors'

type StyleLiteral = string | number | boolean

/**
 * Haritanın kendi katmanlarında (bu dosya, borders.ts ve country-labels.ts) kullanılan stil
 * ifadeleri (style-spec `ExpressionSpecification` alt kümesi).
 */
export type StyleExpression =
  | ['get', string]
  | ['has', string]
  | ['zoom']
  | ['==' | '!=', StyleExpression, StyleLiteral]
  | ['!', StyleExpression]
  | ['all', ...StyleExpression[]]
  | ['case', StyleExpression, StyleLiteral | StyleExpression, StyleLiteral | StyleExpression]
  | ['interpolate', ['linear'], StyleExpression, ...number[]]
  | ['literal', number[]]
  | ['match', StyleExpression, ...(StyleLiteral | StyleExpression)[]]

/** Sabit değer ya da ifade. */
export type StyleValue<T extends StyleLiteral> = T | StyleExpression

/**
 * Boya özelliğinin geçişi, ms (style-spec `TransitionSpecification`). Stilde `transition` yoksa
 * MapLibre `setPaintProperty` sonrasında her geçişli özelliği 300 ms'de kaydırır.
 */
export interface StyleTransition {
  duration: number
  delay: number
}

interface LayerStyleBase {
  id: string
  /** Kaynağın kimliği: kendi GeoJSON kaynaklarımız ya da ülke sınırlarının vektör karo kaynağı. */
  source: string
  /** Vektör karo kaynağındaki katman (ülke sınırları: OpenMapTiles `boundary`). */
  'source-layer'?: string
  /** Süzgeç; yalnızca ifade sözdizimi (eski `["==", "alan", değer]` biçimi kullanılmaz). */
  filter?: StyleExpression
  minzoom?: number
  maxzoom?: number
}

export interface SymbolLayerStyle extends LayerStyleBase {
  type: 'symbol'
  layout: {
    'icon-image': StyleValue<string>
    'icon-rotate'?: StyleValue<number>
    'icon-size'?: StyleValue<number>
    /** İkonun noktaya bağlanan kenarı (pin: alt kenar). */
    'icon-anchor'?: 'center' | 'bottom' | 'top' | 'left' | 'right'
    /** İkon pikseli cinsinden kaydırma (`icon-size` ile ölçeklenir). */
    'icon-offset'?: [number, number]
    'icon-rotation-alignment'?: 'map' | 'viewport' | 'auto'
    'icon-pitch-alignment'?: 'map' | 'viewport' | 'auto'
    'icon-allow-overlap'?: boolean
    'icon-ignore-placement'?: boolean
    'symbol-sort-key'?: StyleValue<number>
  }
}

/**
 * Yazı taşıyan symbol katmanı (ülke adları, country-labels.ts). Yazı tipi stilin `font-faces`
 * alanında tanımlanır (web: map-fonts.ts); stile `glyphs` adresi eklenmez.
 */
export interface TextSymbolLayerStyle extends LayerStyleBase {
  type: 'symbol'
  layout: {
    'text-field': StyleValue<string>
    /** `font-faces`'te tanımlı yazı tipi adları. */
    'text-font': string[]
    'text-size': StyleValue<number>
    /** Harf aralığı, em. */
    'text-letter-spacing'?: number
    /** Satır yüksekliği, em. */
    'text-line-height'?: number
    /** Satır kırma genişliği, em (bu genişliği aşan metin boşluklardan kırılır). */
    'text-max-width'?: number
    'text-anchor'?: 'center' | 'top' | 'bottom' | 'left' | 'right'
    'text-justify'?: 'center' | 'left' | 'right' | 'auto'
    /** Çakışma kutusunun her yanına eklenen pay, px. */
    'text-padding'?: number
    'text-allow-overlap'?: boolean
    'text-ignore-placement'?: boolean
    'text-rotation-alignment'?: 'map' | 'viewport' | 'auto'
    'text-pitch-alignment'?: 'map' | 'viewport' | 'auto'
    'symbol-sort-key'?: StyleValue<number>
    visibility?: 'visible' | 'none'
  }
  paint: {
    'text-color': StyleValue<string>
    'text-halo-color'?: StyleValue<string>
    /** Halenin genişliği, px. */
    'text-halo-width'?: StyleValue<number>
    'text-halo-width-transition'?: StyleTransition
    /** Halenin yumuşaklığı, px. */
    'text-halo-blur'?: StyleValue<number>
    'text-halo-blur-transition'?: StyleTransition
    'text-opacity'?: StyleValue<number>
  }
}

export interface CircleLayerStyle extends LayerStyleBase {
  type: 'circle'
  paint: {
    'circle-color': StyleValue<string>
    'circle-radius'?: StyleValue<number>
    'circle-opacity'?: StyleValue<number>
    'circle-stroke-color'?: StyleValue<string>
    'circle-stroke-width'?: StyleValue<number>
    'circle-stroke-opacity'?: StyleValue<number>
  }
}

export interface LineLayerStyle extends LayerStyleBase {
  type: 'line'
  layout?: {
    'line-cap'?: 'butt' | 'round' | 'square'
    'line-join'?: 'bevel' | 'round' | 'miter'
  }
  paint: {
    'line-color': StyleValue<string>
    'line-width'?: StyleValue<number>
    'line-opacity'?: StyleValue<number>
    /** Kesikli çizgi: çizgi ve boşluk uzunlukları, çizgi kalınlığı biriminde. */
    'line-dasharray'?: number[]
  }
}

export type MapLayerStyle =
  SymbolLayerStyle | TextSymbolLayerStyle | CircleLayerStyle | LineLayerStyle

export const AIRCRAFT_SOURCE_ID = 'hy-aircraft'
export const AIRCRAFT_LAYER_ID = 'hy-aircraft'

/** Uçak kaynağındaki her Point'in özellikleri. */
export interface AircraftFeatureProperties {
  hex: string
  /** `aircraftIconId(...)`; ikon haritaya önceden eklenmiş olmalı. */
  icon: string
  /** İz yönü, derece (bilinmiyorsa 0). */
  trk: number
  /** `aircraftSortKey(...)`: seçili 2, THY 1, diğer 0; büyük olan üstte çizilir. */
  sort: number
}

/**
 * Uçaklar: tek symbol katmanı. İkon harita düzleminde iz yönüne döner, çakışsa da hep çizilir
 * (etiketler ayrı tuvalde yerleştirilir). Boyut z4'te 0,55'ten z10'da 1'e büyür.
 */
export const AIRCRAFT_LAYER: SymbolLayerStyle = {
  id: AIRCRAFT_LAYER_ID,
  type: 'symbol',
  source: AIRCRAFT_SOURCE_ID,
  layout: {
    'icon-image': ['get', 'icon'],
    'icon-rotate': ['get', 'trk'],
    'icon-rotation-alignment': 'map',
    'icon-pitch-alignment': 'map',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    'symbol-sort-key': ['get', 'sort'],
    'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.55, 10, 1],
  },
}

export const AIRPORT_SOURCE_ID = 'hy-airports'
export const AIRPORT_LAYER_ID = 'hy-airports'

/** Havalimanı kaynağındaki her Point'in özellikleri (IATA kodu tuvalde yazılır). */
export interface AirportFeatureProperties {
  icao: string
  iata: string
  name: string
}

/**
 * Havalimanları: kırmızı pin (airport-pin.ts), ucu havalimanı referans noktasında (alt kenar +
 * kenar payı kadar kaydırma). Çakışsa da hep çizilir; yakınlaştıkça büyür (z4 0,45 → z15 0,9).
 * Yerli ve yabancı havalimanları aynı pini kullanır. `icon-image` haritaya önceden eklenir.
 */
export const AIRPORT_LAYER: SymbolLayerStyle = {
  id: AIRPORT_LAYER_ID,
  type: 'symbol',
  source: AIRPORT_SOURCE_ID,
  layout: {
    'icon-image': AIRPORT_PIN_ICON_ID,
    'icon-anchor': 'bottom',
    'icon-offset': [0, AIRPORT_PIN_MARGIN],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.45, 8, 0.6, 12, 0.8, 15, 0.9],
  },
}

export const TRAIL_SOURCE_ID = 'hy-trail'
export const TRAIL_LAYER_ID = 'hy-trail'

/** İz kaynağındaki her LineString parçasının özelliği: parça yerde mi. */
export interface TrailFeatureProperties {
  gnd: boolean
}

/** Seçili uçağın izi: havada kehribar, yerde camgöbeği; düz ve opak (saydam değil). */
export const TRAIL_LAYER: LineLayerStyle = {
  id: TRAIL_LAYER_ID,
  type: 'line',
  source: TRAIL_SOURCE_ID,
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': ['case', ['get', 'gnd'], MAP_COLORS.groundTrack, MAP_COLORS.airTrack],
    'line-width': 3,
    'line-opacity': 1,
  },
}

/** Harita katmanları alttan üste; web ve mobil bu sırayla ekler. */
export const LIVE_MAP_LAYERS: readonly MapLayerStyle[] = [
  AIRPORT_LAYER,
  TRAIL_LAYER,
  AIRCRAFT_LAYER,
]
