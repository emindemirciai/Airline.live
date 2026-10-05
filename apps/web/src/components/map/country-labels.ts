/**
 * Haritada ülke adları (D-095, D-096), web tarafı: GeoJSON kaynağı, ayarın ("Ülke adları" Gizle /
 * Göster) ve pencere boyunun katmanlara uygulanması ve testlerin okuduğu `data-country-labels`
 * niteliği. Katmanların kendisi `@havayolu/shared`'dadır (`countryLabelLayers`, 40 katman).
 *
 * Kaynak dile ve harita genişliğine bağlıdır: her adın yeri ve ilk sığma yakınlaştırması iki dilde ve
 * iki genişlikte ayrı hesaplanmıştır (`COUNTRY_LABEL_PLACEMENTS`). Dil değişince kaynak, dar harita
 * sınırı geçilince kaynak ve kademelerin boy ve hale eğrileri yenilenir. Yakınlaştırırken hiçbir
 * şey yapılmaz: adın görünmesini katmanın `minzoom`'u yönetir.
 *
 * Harita çağrıları yalnızca katmanlar haritadayken yapılır (`CountryLabelOverlay.usable`): stil
 * değişirken (altlık zinciri) katmanlar silinir; o arada `setLayoutProperty` MapLibre'de hata
 * fırlatır, eksik katman da kaynaksız bir hata olayı üretir ve altlık zinciri bunu altlığın hatası
 * sayardı. Arada gelen değişiklik saklanır; katmanlar yeniden eklenirken (`current`, `sourceData`)
 * güncel ayarla kurulur.
 */
import {
  COUNTRY_LABEL_COMPACT_MAX_WIDTH_PX,
  COUNTRY_LABEL_LAYER_IDS,
  COUNTRY_LABEL_LAYER_KEYS,
  COUNTRY_LABEL_SOURCE_ID,
  countryLabelHaloCurve,
  countryLabelLayerId,
  countryLabelPoints,
  countryLabelTextSize,
  type CountryLabelFeatureProperties,
  type Locale,
} from '@havayolu/shared'
import type { CountryLabelMode } from '../../lib/map/label-settings'
import type { FeatureCollection, PointFeature } from './motion'

export type CountryLabelCollection = FeatureCollection<PointFeature<CountryLabelFeatureProperties>>

/** Ülke adı noktaları, sayfanın dilinde ve haritanın genişliğine göre (kaynak verisi). */
export function countryLabelCollection(locale: Locale, compact: boolean): CountryLabelCollection {
  return {
    type: 'FeatureCollection',
    features: countryLabelPoints(locale, compact).map(({ lat, lon, properties }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties,
    })),
  }
}

/** Ayarın katman görünürlüğü: Gizle'de katman hiç çizilmez (yerleşim ve glif de yapılmaz). */
export function countryLabelVisibility(mode: CountryLabelMode): 'visible' | 'none' {
  return mode === 'shown' ? 'visible' : 'none'
}

/** Dar harita mı (≤ 767 px, sitenin alttan açılan kart kırılımı): küçük boy, kendi yerleri. */
export function isCompactMap(width: number): boolean {
  return width <= COUNTRY_LABEL_COMPACT_MAX_WIDTH_PX
}

/**
 * MapLibre'nin yerleştirdiği adlar (`queryRenderedFeatures`), koda göre sıralı ve tekil, `|` ile
 * birleşik. Yerleşmiş ad görünür olmayabilir: saydamlığı 0,1'in altındaki ad (tam ilk sığma
 * yakınlaştırmasında ya da z7,9'da) çizilmez ama yerleşmiş sayılır.
 */
export function renderedCountryLabelNames(
  features: readonly { properties?: Record<string, unknown> | null }[],
): string {
  const byCode = new Map<string, string>()
  for (const feature of features) {
    const code = feature.properties?.code
    const name = feature.properties?.name
    if (typeof code === 'string' && typeof name === 'string' && !byCode.has(code)) {
      byCode.set(code, name)
    }
  }
  return [...byCode.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, name]) => name)
    .join('|')
}

/** Haritanın kullanılan yüzü (MapLibre `Map`'in alt kümesi; testte taklit edilir). */
export interface CountryLabelMap {
  getLayer(id: string): unknown
  getSource(id: string): unknown
  setLayoutProperty(layerId: string, name: string, value: unknown): unknown
  setPaintProperty(layerId: string, name: string, value: unknown): unknown
  queryRenderedFeatures(options: {
    layers: string[]
  }): readonly { properties?: Record<string, unknown> | null }[]
}

/** Katmanları etkileyen durum. */
export interface CountryLabelState {
  mode: CountryLabelMode
  locale: Locale
  /** Dar harita (`isCompactMap`). */
  compact: boolean
}

/** `data-country-labels` niteliğinin adı ve yenilenme aralığı. */
export const COUNTRY_LABELS_ATTRIBUTE = 'data-country-labels'
export const COUNTRY_LABELS_REFRESH_MS = 500

export interface CountryLabelOverlayOptions {
  /** Niteliğin yazıldığı öge (harita kapsayıcısı `.live-map__canvas`). */
  element: Pick<HTMLElement, 'getAttribute' | 'setAttribute'>
  state: CountryLabelState
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

function hasSetData(source: unknown): source is { setData: (data: unknown) => void } {
  return (
    typeof source === 'object' &&
    source !== null &&
    typeof (source as { setData?: unknown }).setData === 'function'
  )
}

/**
 * Ülke adlarının harita tarafındaki durumu. Harita denetleyicisi (map-controller.ts) katmanları
 * ekledikten sonra `installed`, stil değiştirmeden önce `detached` çağırır; ayar, dil ve pencere
 * boyu `update` ile gelir; haritanın her `render` olayında `rendered` çağrılır.
 *
 * Test niteliği: `data-country-labels` MapLibre'nin yerleştirdiği adlardır (`|` ile, koda göre
 * sıralı). En fazla 500 ms'de bir yenilenir; son durumu sondaki bir zamanlayıcı yazar. Gizle'de ''
 * yazılır, sorgu yapılmaz. Nitelik yalnızca değişince yeniden yazılır.
 */
export class CountryLabelOverlay {
  private readonly options: CountryLabelOverlayOptions
  private readonly now: () => number
  private readonly setTimer: (fn: () => void, ms: number) => unknown
  private readonly clearTimer: (handle: unknown) => void
  private state: CountryLabelState
  private map: CountryLabelMap | null = null
  private ready = false
  private timer: unknown = null
  private lastRefresh = -Infinity

  constructor(options: CountryLabelOverlayOptions) {
    this.options = options
    this.state = { ...options.state }
    this.now = options.now ?? (() => performance.now())
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearTimer =
      options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  }

  /** Harita kuruldu: nitelik '' ile başlar. */
  attach(map: CountryLabelMap): void {
    this.map = map
    this.ready = false
    this.write('')
  }

  /** Güncel durum. */
  get current(): Readonly<CountryLabelState> {
    return this.state
  }

  /** Kaynak verisi, güncel dilde ve genişlikte. */
  sourceData(): CountryLabelCollection {
    return countryLabelCollection(this.state.locale, this.state.compact)
  }

  /** Katmanlar haritaya eklendi (her stil yüklenişinde). */
  installed(): void {
    this.ready = true
    this.schedule()
  }

  /** Stil değişiyor: katmanlar silinecek; yeniden eklenene kadar haritaya dokunulmaz. */
  detached(): void {
    this.ready = false
  }

  /** Katmanlar haritada mı: hazır ve 40 katmanın hepsi var (çağrı anında denetlenir). */
  usable(): boolean {
    const map = this.map
    return (
      this.ready && map !== null && COUNTRY_LABEL_LAYER_IDS.every((id) => Boolean(map.getLayer(id)))
    )
  }

  /**
   * Ayar, dil ya da pencere boyu değişti: katmanlar kullanılabiliyorsa hemen uygulanır. Dar haritaya
   * geçerken önce boy küçülür, sonra kaynak (dar haritanın yerleri) gelir; geniş haritaya geçerken
   * önce kaynak (geniş haritanın daha geç ilk yakınlaştırmaları), sonra boy büyür. Arada ad hiçbir
   * zaman sığdığından büyük çizilmez.
   */
  update(next: CountryLabelState): void {
    const previous = this.state
    this.state = { ...next }
    const map = this.map
    if (!map || !this.usable()) return
    if (previous.mode !== next.mode) {
      const visibility = countryLabelVisibility(next.mode)
      for (const id of COUNTRY_LABEL_LAYER_IDS) map.setLayoutProperty(id, 'visibility', visibility)
    }
    const sizeChanged = previous.compact !== next.compact
    const dataChanged = sizeChanged || previous.locale !== next.locale
    if (sizeChanged && next.compact) this.applySizes(map, true)
    if (dataChanged) {
      const source = map.getSource(COUNTRY_LABEL_SOURCE_ID)
      if (hasSetData(source)) source.setData(this.sourceData())
    }
    if (sizeChanged && !next.compact) this.applySizes(map, false)
    if (previous.mode !== next.mode || dataChanged) this.schedule()
  }

  /** Kademelerin boy ve hale eğrileri, her katmanda. */
  private applySizes(map: CountryLabelMap, compact: boolean): void {
    for (const [tier, fitZoom] of COUNTRY_LABEL_LAYER_KEYS) {
      const id = countryLabelLayerId(tier, fitZoom)
      map.setLayoutProperty(id, 'text-size', countryLabelTextSize(tier, compact))
      map.setPaintProperty(id, 'text-halo-width', countryLabelHaloCurve(tier, compact, 'width'))
      map.setPaintProperty(id, 'text-halo-blur', countryLabelHaloCurve(tier, compact, 'blur'))
    }
  }

  /** Haritanın `render` olayı: nitelik en fazla 500 ms'de bir yenilenir. */
  rendered(): void {
    this.schedule()
  }

  destroy(): void {
    this.cancel()
    this.map = null
    this.ready = false
  }

  private schedule(): void {
    if (this.timer !== null) return
    const wait = this.lastRefresh + COUNTRY_LABELS_REFRESH_MS - this.now()
    if (wait <= 0) {
      this.refresh()
      return
    }
    this.timer = this.setTimer(() => {
      this.timer = null
      this.refresh()
    }, wait)
  }

  private cancel(): void {
    if (this.timer !== null) this.clearTimer(this.timer)
    this.timer = null
  }

  private refresh(): void {
    if (this.state.mode === 'hidden') {
      this.lastRefresh = this.now()
      this.write('')
      return
    }
    const map = this.map
    if (!map || !this.usable()) return
    this.lastRefresh = this.now()
    this.write(
      renderedCountryLabelNames(
        map.queryRenderedFeatures({ layers: [...COUNTRY_LABEL_LAYER_IDS] }),
      ),
    )
  }

  private write(value: string): void {
    const { element } = this.options
    if (element.getAttribute(COUNTRY_LABELS_ATTRIBUTE) !== value) {
      element.setAttribute(COUNTRY_LABELS_ATTRIBUTE, value)
    }
  }
}
