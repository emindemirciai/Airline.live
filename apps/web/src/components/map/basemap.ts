/**
 * Harita altlığı zinciri (D-075 §1–2, data-sources.md §6). Sunucunun çözdüğü `Basemap`'ten
 * sıralı adımlar kurulur; bir adım 3 kez yüklenemezse sonrakine geçilir, sonuncusu koddaki düz
 * arka plandır ve "Harita altlığı yüklenemedi" şeridini açar. Uçaklar her adımda çizilmeye devam
 * eder (katmanlar her stil değişiminden sonra yeniden eklenir, map-controller.ts).
 *
 * Denetleyici MapLibre'ye bağlı değildir: harita olaylarını çağıran iletir, stil değişimini
 * `apply` ile ister. Böylece zincir sahte zamanlayıcıyla test edilir.
 *
 * Ülke sınırları (D-092) uydu ve vektör adımlarında kesikli çizilir: uydu stiline OpenFreeMap'ten
 * ayrı bir vektör kaynak eklenir, indirilen OpenMapTiles stilinde `boundary` katmanları aynı
 * katmanlarla değiştirilir. Yerel stilde ve düz arka planda sınır yoktur (dış istek gitmez).
 *
 * Ülke adları (D-095) kendi katmanlarımızdır (başkentlerde, map-controller.ts); indirilen vektör
 * stillerin kendi ülke adı katmanları çıkarılır (`withoutBasemapCountryLabels`), adlar iki kez
 * yazılmaz.
 */
import type { Map as MaplibreMap } from 'maplibre-gl'
import {
  AIRCRAFT_SOURCE_ID,
  AIRPORT_SOURCE_ID,
  COUNTRY_BORDER_SOURCE_ID,
  COUNTRY_LABEL_SOURCE_ID,
  COUNTRY_BORDER_SOURCE_LAYER,
  MAP_COLORS,
  TRAIL_SOURCE_ID,
  countryBorderLayers,
  countryBorderSource,
} from '@havayolu/shared'
import { OPENFREEMAP_ATTRIBUTION, type Basemap, type CountryBorders } from '../../lib/map-config'

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
  /**
   * Ülke sınırları bu adımda kesikli çizilir (D-092). Uydu stilinde sınır kaynağı ve katmanları
   * stil nesnesinin içindedir; indirilen stilde OpenMapTiles `boundary` katmanları bizimkilerle
   * değiştirilir (`withCountryBorders`). Yerel stil ve düz arka planda false.
   */
  countryBorders: boolean
  /** Zincirin sonu: düz arka plan, altlık yüklenemedi. */
  plain: boolean
}

/** Uydu raster kaynağının kimliği. */
export const SATELLITE_SOURCE_ID = 'satellite'

/**
 * Altlık zincirinin hata sayımına girmeyen kaynaklar: kendi GeoJSON kaynaklarımız (ülke adları
 * dahil, D-095) ve uydunun üstündeki sınır kaynağı (D-092). OpenFreeMap'in TileJSON'u ya da karoları
 * yüklenemezse uydu yerinde kalır, yalnızca sınırlar çizilmez. OpenFreeMap stilinde sınırlar
 * altlığın kendi kaynağındandır; onun hataları yine altlığındır.
 */
export const NON_BASEMAP_SOURCES: ReadonlySet<string> = new Set([
  AIRCRAFT_SOURCE_ID,
  AIRPORT_SOURCE_ID,
  TRAIL_SOURCE_ID,
  COUNTRY_BORDER_SOURCE_ID,
  COUNTRY_LABEL_SOURCE_ID,
])

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

type StyleLayers = MapStyle['layers']

/** Paylaşılan sınır katmanları (`@havayolu/shared`, style-spec JSON'unun alt kümesi). */
function borderLayers(source: string): StyleLayers {
  return countryBorderLayers(source) as StyleLayers
}

/**
 * Esri World Imagery raster stili (D-075 §1). Glif ve sprite yoktur; kendi katmanlarımız metin
 * kullanmaz. Atıf kaynağın üstündedir, yalnızca uydu görünürken çıkar.
 *
 * `borders` verilirse görüntünün üstüne OpenFreeMap'in vektör karolarından kesikli ülke sınırları
 * çizilir (D-092): kaynak `COUNTRY_BORDER_SOURCE_ID`, katmanlar görüntüden hemen sonra (uçak, iz ve
 * havalimanı katmanları stil yüklenince bunların üstüne eklenir). Sınır kaynağının atfı
 * (OpenFreeMap © OpenMapTiles, OpenStreetMap) yalnızca sınır katmanları çizilirken şeride girer.
 */
export function satelliteStyle(
  tilesUrl: string,
  attribution: string,
  borders: CountryBorders | null,
): MapStyle {
  const sources: MapStyle['sources'] = {
    [SATELLITE_SOURCE_ID]: {
      type: 'raster',
      tiles: [tilesUrl],
      tileSize: 256,
      maxzoom: 19,
      attribution,
    },
  }
  const layers: StyleLayers = [
    backgroundLayer,
    { id: SATELLITE_SOURCE_ID, type: 'raster', source: SATELLITE_SOURCE_ID },
  ]
  if (borders) {
    sources[COUNTRY_BORDER_SOURCE_ID] = countryBorderSource(borders.url, borders.attribution)
    layers.push(...borderLayers(COUNTRY_BORDER_SOURCE_ID))
  }
  return { version: 8, sources, layers }
}

/** OpenMapTiles `boundary` katmanından çizilen çizgi katmanı mı (ülke, il, deniz sınırı)? */
function isBoundaryLine(layer: object): boolean {
  const { type, 'source-layer': sourceLayer } = layer as {
    type?: unknown
    'source-layer'?: unknown
  }
  return type === 'line' && sourceLayer === COUNTRY_BORDER_SOURCE_LAYER
}

/**
 * İndirilen OpenMapTiles stilinde (OpenFreeMap koyu stili) sınırları uydudakiyle aynı kesikli
 * katmanlara çevirir (D-092): `boundary` katmanından çizilen bütün çizgi katmanları (ülke ve il
 * sınırları) çıkar, yerlerine ilkinin sırasında ve onun kaynağıyla bizim üç katmanımız girer. Böylece
 * sınırlar yer adlarının altında, yolların ve suyun üstünde kalır. `boundary` katmanı olmayan stil
 * (yerel test stili, Protomaps şeması) olduğu gibi döner. Aynı stile ikinci kez uygulanması bir şey
 * değiştirmez.
 */
export function withCountryBorders(style: MapStyle): MapStyle {
  const index = style.layers.findIndex(isBoundaryLine)
  const first = style.layers[index] as { source?: unknown } | undefined
  if (!first || typeof first.source !== 'string') return style
  // İlk sınır katmanından öncekiler yerinde kalır; yeni katmanlar süzülmüş listede aynı sıraya girer.
  const layers = style.layers.filter((layer) => !isBoundaryLine(layer))
  layers.splice(index, 0, ...borderLayers(first.source))
  return { ...style, layers }
}

/** Vektör stillerin ülke adı katmanlarının kimlikleri (OpenMapTiles, Liberty, Protomaps). */
const BASEMAP_COUNTRY_LABEL_ID = /^(place|places|label)[_-]?country/i
/** Yer adlarını taşıyan katmanlar (OpenMapTiles `place`, Protomaps `places`). */
const PLACE_SOURCE_LAYERS: ReadonlySet<string> = new Set(['place', 'places'])
/** Yer türünün alanı (OpenMapTiles `class`, Protomaps `kind`). */
const PLACE_CLASS_KEYS: ReadonlySet<string> = new Set(['class', 'kind'])

/** `'class'` (eski süzgeç) ya da `['get', 'class']` (ifade); `kind` de olur. */
function isPlaceClass(value: unknown): boolean {
  if (typeof value === 'string') return PLACE_CLASS_KEYS.has(value)
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value[0] === 'get' &&
    typeof value[1] === 'string' &&
    PLACE_CLASS_KEYS.has(value[1])
  )
}

/**
 * Süzgeç yalnızca ülkeleri mi seçiyor: `==`, `in` ve `match` ile türü `country` olanlar (eski ve
 * ifade sözdizimi), `all`'ın herhangi bir koşulunda. `any`, `!`, `!=` ve `none`'a bakılmaz: onlar
 * ülke dışındaki yerleri de seçebilir.
 */
function selectsCountries(filter: unknown): boolean {
  if (!Array.isArray(filter)) return false
  const [operator, ...args] = filter as unknown[]
  switch (operator) {
    case 'all':
      return args.some(selectsCountries)
    case '==':
      return (
        (isPlaceClass(args[0]) && args[1] === 'country') ||
        (isPlaceClass(args[1]) && args[0] === 'country')
      )
    case 'in': {
      // Eski: ['in', 'class', 'country', …]; ifade: ['in', ['get', 'class'], ['literal', […]]].
      const [key, ...values] = args
      if (typeof key === 'string') return PLACE_CLASS_KEYS.has(key) && values.includes('country')
      const haystack = values[0]
      return (
        isPlaceClass(key) &&
        Array.isArray(haystack) &&
        haystack[0] === 'literal' &&
        Array.isArray(haystack[1]) &&
        (haystack[1] as unknown[]).includes('country')
      )
    }
    case 'match': {
      // ['match', ['get', 'class'], etiket, çıktı, …, varsayılan]: `country` dalı true verir.
      if (!isPlaceClass(args[0])) return false
      for (let i = 1; i + 1 < args.length; i += 2) {
        const label = args[i]
        const labels = Array.isArray(label) ? (label as unknown[]) : [label]
        if (labels.includes('country') && args[i + 1] === true) return true
      }
      return false
    }
    default:
      return false
  }
}

/** Vektör stilin kendi ülke adı katmanı mı (kimliğinden ya da yer katmanındaki süzgecinden)? */
function isBasemapCountryLabel(layer: object): boolean {
  const {
    id,
    type,
    filter,
    'source-layer': sourceLayer,
  } = layer as { id?: unknown; type?: unknown; filter?: unknown; 'source-layer'?: unknown }
  if (type !== 'symbol') return false
  if (typeof id === 'string' && BASEMAP_COUNTRY_LABEL_ID.test(id)) return true
  return (
    typeof sourceLayer === 'string' &&
    PLACE_SOURCE_LAYERS.has(sourceLayer) &&
    selectsCountries(filter)
  )
}

/**
 * İndirilen vektör stilin ülke adı katmanlarını çıkarır (D-095): adlar haritada kendi
 * katmanlarımızla başkentlerde yazılır, stilinkilerle iki kez görünmez. Şehir ve diğer yer adları
 * kalır. Çıkacak katman yoksa (uydu, yerel test stili) stil olduğu gibi döner. Canlı OpenFreeMap
 * stilleri çevrimdışı doğrulanamaz; kimlik ve süzgeç kuralı Dark, Liberty ve Protomaps biçimlerini
 * kapsar.
 */
export function withoutBasemapCountryLabels(style: MapStyle): MapStyle {
  const layers = style.layers.filter((layer) => !isBasemapCountryLabel(layer))
  return layers.length === style.layers.length ? style : { ...style, layers }
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
 * Ülke sınırları uydu ve vektör adımlarında açıktır; yerel stil ve düz arka planda kapalıdır.
 * `resolveUrl` göreli stil adresini (`/test-style.json`) sayfaya göre mutlaklaştırır.
 */
export function basemapSteps(basemap: Basemap, resolveUrl: (url: string) => string): BasemapStep[] {
  const steps: BasemapStep[] = []
  switch (basemap.kind) {
    case 'satellite':
      steps.push({
        style: satelliteStyle(basemap.tilesUrl, basemap.attribution, basemap.countryBorders),
        hideRoads: false,
        attribution: null,
        countryBorders: true,
        plain: false,
      })
      if (basemap.fallbackStyleUrl) {
        steps.push({
          style: resolveUrl(basemap.fallbackStyleUrl),
          hideRoads: basemap.hideRoads,
          attribution: OPENFREEMAP_ATTRIBUTION,
          countryBorders: true,
          plain: false,
        })
      }
      // Vektör zincirinin yedeği: kendi atfını taşır (ör. Protomaps + OSM).
      if (basemap.vectorFallbackStyleUrl) {
        steps.push({
          style: resolveUrl(basemap.vectorFallbackStyleUrl),
          hideRoads: basemap.hideRoads,
          attribution: null,
          countryBorders: true,
          plain: false,
        })
      }
      break
    case 'vector':
      steps.push({
        style: resolveUrl(basemap.styleUrl),
        hideRoads: basemap.hideRoads,
        attribution: basemap.attribution,
        countryBorders: true,
        plain: false,
      })
      if (basemap.fallbackStyleUrl) {
        steps.push({
          style: resolveUrl(basemap.fallbackStyleUrl),
          hideRoads: basemap.hideRoads,
          attribution: null,
          countryBorders: true,
          plain: false,
        })
      }
      break
    case 'local':
      steps.push({
        style: resolveUrl(basemap.styleUrl),
        hideRoads: false,
        attribution: basemap.attribution === '' ? null : basemap.attribution,
        countryBorders: false,
        plain: false,
      })
      break
  }
  steps.push({
    style: plainStyle(),
    hideRoads: false,
    attribution: null,
    countryBorders: false,
    plain: true,
  })
  return steps
}

/**
 * İndirilen adım stilini haritaya hazırlar: sınırlar kesikli çizgiye çevrilir (adımda açıksa),
 * stilin ülke adı katmanları çıkar (her adımda, D-095), sonra karo kaynaklarının atfı adımın
 * atfıyla değiştirilir (varsa).
 */
export function prepareFetchedStyle(style: MapStyle, step: BasemapStep): MapStyle {
  const bordered = step.countryBorders ? withCountryBorders(style) : style
  const unlabelled = withoutBasemapCountryLabels(bordered)
  return step.attribution === null ? unlabelled : withAttribution(unlabelled, step.attribution)
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
