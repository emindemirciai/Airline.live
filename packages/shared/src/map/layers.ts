/**
 * Canlı haritanın katmanları (havalimanları, seçili uçağın izi, uçaklar). Düz nesnelerdir:
 * `packages/shared` MapLibre'ye bağımlı değildir; aşağıdaki yerel tipler MapLibre stil
 * belirtiminin (style-spec) katman JSON'unun alt kümesidir, web `map.addLayer()`'a olduğu gibi
 * verir, mobil de aynı nesneleri kullanır. Katman sırası alttan üste: havalimanları, iz, uçaklar.
 */
import { MAP_COLORS } from './colors'

type StyleLiteral = string | number | boolean

/** Bu dosyada kullanılan stil ifadeleri (style-spec `ExpressionSpecification` alt kümesi). */
export type StyleExpression =
  | ['get', string]
  | ['zoom']
  | ['case', StyleExpression, StyleLiteral | StyleExpression, StyleLiteral | StyleExpression]
  | ['interpolate', ['linear'], StyleExpression, ...number[]]

/** Sabit değer ya da ifade. */
export type StyleValue<T extends StyleLiteral> = T | StyleExpression

interface LayerStyleBase {
  id: string
  /** GeoJSON kaynağının kimliği. */
  source: string
  minzoom?: number
  maxzoom?: number
}

export interface SymbolLayerStyle extends LayerStyleBase {
  type: 'symbol'
  layout: {
    'icon-image': StyleValue<string>
    'icon-rotate'?: StyleValue<number>
    'icon-size'?: StyleValue<number>
    'icon-rotation-alignment'?: 'map' | 'viewport' | 'auto'
    'icon-pitch-alignment'?: 'map' | 'viewport' | 'auto'
    'icon-allow-overlap'?: boolean
    'icon-ignore-placement'?: boolean
    'symbol-sort-key'?: StyleValue<number>
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
  }
}

export type MapLayerStyle = SymbolLayerStyle | CircleLayerStyle | LineLayerStyle

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

/** Havalimanları: koyu kenarlı opak beyaz nokta; yakınlaştıkça büyür. */
export const AIRPORT_LAYER: CircleLayerStyle = {
  id: AIRPORT_LAYER_ID,
  type: 'circle',
  source: AIRPORT_SOURCE_ID,
  paint: {
    'circle-color': MAP_COLORS.airport,
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.5, 8, 4, 12, 5.5],
    'circle-opacity': 1,
    'circle-stroke-color': MAP_COLORS.airportOutline,
    'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 8, 2],
    'circle-stroke-opacity': 1,
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
