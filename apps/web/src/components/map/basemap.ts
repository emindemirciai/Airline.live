/**
 * Harita altlığı zinciri (D-075 §1–2, data-sources.md §6). Sunucunun çözdüğü `Basemap`'ten
 * sıralı adımlar kurulur; bir adım 3 kez yüklenemezse sonrakine geçilir, sonuncusu koddaki düz
 * arka plandır ve "Harita altlığı yüklenemedi" şeridini açar. Uçaklar her adımda çizilmeye devam
 * eder (katmanlar her stil değişiminden sonra yeniden eklenir, map-controller.ts).
 *
 * Denetleyici MapLibre'ye bağlı değildir: harita olaylarını çağıran iletir, stil değişimini
 * `apply` ile ister. Böylece zincir sahte zamanlayıcıyla test edilir.
 */
import type { Map as MaplibreMap } from 'maplibre-gl'
import { MAP_COLORS } from '@havayolu/shared'
import { OPENFREEMAP_ATTRIBUTION, type Basemap } from '../../lib/map-config'

/** MapLibre stil belirtimi (style-spec `StyleSpecification`; maplibre-gl bunu dışa aktarmaz). */
export type MapStyle = Exclude<Parameters<MaplibreMap['setStyle']>[0], string | null>

export interface BasemapStep {
  /** Stil nesnesi ya da mutlak stil adresi. */
  style: MapStyle | string
  /** Yüklenince yol ve yol adı katmanları gizlenir (havalimanı katmanları kalır). */
  hideRoads: boolean
  /**
   * Stilin kaynak atfının yerine yazılacak metin (ör. OpenFreeMap); null ise stilin kendi atfı
   * kalır. Böylece aynı atıf haritada iki kez görünmez.
   */
  attribution: string | null
  /** Zincirin sonu: düz arka plan, altlık yüklenemedi. */
  plain: boolean
}

/** Uydu raster kaynağının kimliği. */
export const SATELLITE_SOURCE_ID = 'satellite'

/** Yolları taşıyan OpenMapTiles katmanları; `aeroway` (pist, apron) görünür kalır. */
export const ROAD_SOURCE_LAYERS: ReadonlySet<string> = new Set([
  'transportation',
  'transportation_name',
])

const backgroundLayer = {
  id: 'background',
  type: 'background',
  paint: { 'background-color': MAP_COLORS.background },
} as const

/**
 * Esri World Imagery raster stili (D-075 §1). Glif ve sprite yoktur; kendi katmanlarımız metin
 * kullanmaz. Atıf kaynağın üstündedir, yalnızca uydu görünürken çıkar.
 */
export function satelliteStyle(tilesUrl: string, attribution: string): MapStyle {
  return {
    version: 8,
    sources: {
      [SATELLITE_SOURCE_ID]: {
        type: 'raster',
        tiles: [tilesUrl],
        tileSize: 256,
        maxzoom: 19,
        attribution,
      },
    },
    layers: [
      backgroundLayer,
      { id: SATELLITE_SOURCE_ID, type: 'raster', source: SATELLITE_SOURCE_ID },
    ],
  }
}

/** Zincirin son adımı: tek bir koyu arka plan katmanı (dış istek yok). */
export function plainStyle(): MapStyle {
  return { version: 8, sources: {}, layers: [backgroundLayer] }
}

/**
 * Altlık adımları:
 * - uydu → koyu vektör yedek (dış sağlayıcılar açıksa) → `MAP_STYLE_FALLBACK_URL` (varsa) → düz
 *   arka plan
 * - vektör → `MAP_STYLE_FALLBACK_URL` (varsa) → düz arka plan
 * - yerel stil (geliştirme, test) → düz arka plan
 *
 * `resolveUrl` göreli stil adresini (`/test-style.json`) sayfaya göre mutlaklaştırır.
 */
export function basemapSteps(basemap: Basemap, resolveUrl: (url: string) => string): BasemapStep[] {
  const steps: BasemapStep[] = []
  switch (basemap.kind) {
    case 'satellite':
      steps.push({
        style: satelliteStyle(basemap.tilesUrl, basemap.attribution),
        hideRoads: false,
        attribution: null,
        plain: false,
      })
      if (basemap.fallbackStyleUrl) {
        steps.push({
          style: resolveUrl(basemap.fallbackStyleUrl),
          hideRoads: basemap.hideRoads,
          attribution: OPENFREEMAP_ATTRIBUTION,
          plain: false,
        })
      }
      // Vektör zincirinin yedeği: kendi atfını taşır (ör. Protomaps + OSM).
      if (basemap.vectorFallbackStyleUrl) {
        steps.push({
          style: resolveUrl(basemap.vectorFallbackStyleUrl),
          hideRoads: basemap.hideRoads,
          attribution: null,
          plain: false,
        })
      }
      break
    case 'vector':
      steps.push({
        style: resolveUrl(basemap.styleUrl),
        hideRoads: basemap.hideRoads,
        attribution: basemap.attribution,
        plain: false,
      })
      if (basemap.fallbackStyleUrl) {
        steps.push({
          style: resolveUrl(basemap.fallbackStyleUrl),
          hideRoads: basemap.hideRoads,
          attribution: null,
          plain: false,
        })
      }
      break
    case 'local':
      steps.push({
        style: resolveUrl(basemap.styleUrl),
        hideRoads: false,
        attribution: basemap.attribution === '' ? null : basemap.attribution,
        plain: false,
      })
      break
  }
  steps.push({ style: plainStyle(), hideRoads: false, attribution: null, plain: true })
  return steps
}

/** Yol katmanlarının kimlikleri (`source-layer` transportation ya da transportation_name). */
export function roadLayerIds(layers: readonly object[]): string[] {
  const ids: string[] = []
  for (const layer of layers) {
    const { id, 'source-layer': sourceLayer } = layer as { id?: unknown; 'source-layer'?: unknown }
    if (
      typeof id === 'string' &&
      typeof sourceLayer === 'string' &&
      ROAD_SOURCE_LAYERS.has(sourceLayer)
    ) {
      ids.push(id)
    }
  }
  return ids
}

/**
 * Stil adresini indirir ve en temel biçimi denetler (sürüm 8, kaynaklar, katmanlar). Başarısız
 * istek ya da bozuk stil hata fırlatır; zincir bunu bir deneme sayar.
 */
export async function fetchStyle(url: string, signal?: AbortSignal): Promise<MapStyle> {
  const response = await fetch(url, { signal, headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`Map style request failed with status ${response.status}`)
  const style = (await response.json()) as unknown
  if (
    typeof style !== 'object' ||
    style === null ||
    (style as { version?: unknown }).version !== 8 ||
    typeof (style as { sources?: unknown }).sources !== 'object' ||
    !Array.isArray((style as { layers?: unknown }).layers)
  ) {
    throw new Error('Map style has an unexpected shape')
  }
  return style as MapStyle
}

/** İndirilen stilin karo kaynaklarının atfını adımın atfıyla değiştirir. */
export function withAttribution(style: MapStyle, attribution: string): MapStyle {
  const sources: MapStyle['sources'] = {}
  for (const [id, source] of Object.entries(style.sources)) {
    const tiled =
      source.type === 'vector' || source.type === 'raster' || source.type === 'raster-dem'
    sources[id] = tiled ? { ...source, attribution } : source
  }
  return { ...style, sources }
}

/** Bir adımın başarısız sayıldığı ardışık hata sayısı (data-sources.md §6: 3 kez). */
export const BASEMAP_MAX_FAILURES = 3
/** Stil isteği başarısız olunca yeniden denemeden önceki bekleme. */
export const STYLE_RETRY_DELAY_MS = 1_500
/** Bu sürede yüklenmeyen stil başarısız bir deneme sayılır (yanıt vermeyen sunucu). */
export const STYLE_LOAD_TIMEOUT_MS = 20_000

export interface BasemapControllerOptions {
  steps: readonly BasemapStep[]
  /** Adımın stilini haritaya uygular (`map.setStyle(…, {diff: false})`). */
  apply: (step: BasemapStep) => void
  /** Düz arka plana düşülünce true (durum şeridi). */
  onFailedChange: (failed: boolean) => void
  /** Hata olayındaki kaynak şu anki altlığa mı ait (bizim katmanlarımız ve eski stil hariç)? */
  isBasemapSource: (sourceId: string) => boolean
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  log?: (message: string) => void
}

/** Hata olayının ilgilendiğimiz alanları (MapLibre `ErrorEvent` + kaynak verisi). */
export interface BasemapErrorEvent {
  sourceId?: unknown
}

export class BasemapController {
  private readonly options: BasemapControllerOptions
  private readonly setTimer: (fn: () => void, ms: number) => unknown
  private readonly clearTimer: (handle: unknown) => void
  private index = 0
  private failures = 0
  private loaded = false
  private timer: unknown = null
  private stopped = false

  constructor(options: BasemapControllerOptions) {
    if (options.steps.length === 0) throw new Error('Basemap chain needs at least one step')
    this.options = options
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearTimer =
      options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  }

  /** Şu anki adım. */
  get step(): BasemapStep {
    const step = this.options.steps[this.index]
    if (!step) throw new Error('Basemap step out of range')
    return step
  }

  /** Düz arka plana düşüldü mü. */
  get failed(): boolean {
    return this.step.plain && this.index > 0
  }

  /** İlk adımı uygular. */
  start(): void {
    this.stopped = false
    this.load()
  }

  stop(): void {
    this.stopped = true
    this.cancelTimer()
  }

  /** `style.load`: adım yüklendi; hata sayacı sıfırlanır. */
  styleLoaded(): void {
    if (this.stopped) return
    this.cancelTimer()
    this.loaded = true
    this.failures = 0
  }

  /** Altlık kaynağından bir karo yüklendi: ardışık hata sayacı sıfırlanır. */
  tileLoaded(sourceId: string): void {
    if (this.loaded && this.options.isBasemapSource(sourceId)) this.failures = 0
  }

  /**
   * Hata olayı (MapLibre `error` ya da stil isteğinin kendisi). Stil yüklenmeden gelen kaynaksız
   * hata stilindir (istek, doğrulama; yeniden denenir). Kaynaklı hata ancak stil yüklendikten
   * sonra ve yalnızca şu anki altlığın kaynağındaysa (karo, glif) sayılır: önceki stilin geç
   * gelen karo hataları, kendi katmanlarımız ve programlama hataları altlığı değiştirmez.
   */
  error(event: BasemapErrorEvent): void {
    if (this.stopped || this.step.plain) return
    const { sourceId } = event
    if (typeof sourceId === 'string') {
      if (this.loaded && this.options.isBasemapSource(sourceId)) this.fail('tiles')
      return
    }
    if (!this.loaded) this.fail('style')
  }

  private load(): void {
    this.loaded = false
    this.cancelTimer()
    this.options.apply(this.step)
    if (!this.step.plain) {
      this.timer = this.setTimer(() => {
        this.timer = null
        this.fail('timeout')
      }, STYLE_LOAD_TIMEOUT_MS)
    }
  }

  private fail(reason: 'style' | 'tiles' | 'timeout'): void {
    this.failures += 1
    if (this.failures >= BASEMAP_MAX_FAILURES) {
      this.next(reason)
      return
    }
    if (reason === 'tiles') return
    // Stil isteği başarısız: kısa bir beklemeden sonra aynı adım yeniden istenir.
    this.cancelTimer()
    this.timer = this.setTimer(() => {
      this.timer = null
      if (!this.stopped) this.load()
    }, STYLE_RETRY_DELAY_MS)
  }

  private next(reason: string): void {
    if (this.index >= this.options.steps.length - 1) return
    this.index += 1
    this.failures = 0
    this.options.log?.(`Basemap failed (${reason}); switching to step ${this.index}`)
    if (this.step.plain) this.options.onFailedChange(true)
    this.load()
  }

  private cancelTimer(): void {
    if (this.timer !== null) this.clearTimer(this.timer)
    this.timer = null
  }
}
