/**
 * Canlı haritanın MapLibre tarafı (React dışında): harita, altlık zinciri, uçak/iz/havalimanı
 * katmanları, çizim döngüsü, etiket tuvali, tıklama ve "Uçağı ortala". `MapView` bileşeni bir
 * örnek kurar, prop değişikliklerini `update` ile iletir ve söküldüğünde `destroy` çağırır.
 * MapLibre sayfa paketinde değildir; harita kurulurken yüklenir (maplibre-loader.ts).
 *
 * Harita koddaki düz arka plan stiliyle açılır; kendi katmanlarımız hemen eklenir ve uçaklar altlık
 * zinciri (basemap.ts) yüklenirken, yeniden denenirken ya da hiç yüklenemezken de çizilir.
 *
 * Çizim döngüsü tek bir `requestAnimationFrame` döngüsüdür; en fazla ~66 ms'de bir (≈15 kare/sn)
 * gösterim konumlarını hesaplar. Uçak ve iz kaynaklarına `setData` yalnızca bir şey değişince
 * verilir: küme, seçim, depo sürümü ya da ekranda en az 0,5 px kayan bir simge (motion.ts).
 * Etiketler haritanın her `render` olayında aynı konumlarla yeniden çizilir; React her karede
 * yeniden çizilmez. Süreler geri gitmeyen saatle ölçülür (clock.ts).
 */
import type { UnitSystem } from '@havayolu/i18n'
import {
  AIRCRAFT_LAYER,
  AIRCRAFT_LAYER_ID,
  AIRCRAFT_SOURCE_ID,
  AIRPORT_SOURCE_ID,
  LIVE_MAP_LAYERS,
  TRAIL_SOURCE_ID,
  type Airport,
  type Locale,
} from '@havayolu/shared'
import type * as Maplibre from 'maplibre-gl'
import { monotonicNow } from '../../lib/live/clock'
import type { AircraftStore } from '../../lib/live/store'
import type { LabelSettings } from '../../lib/map/label-settings'
import type { Basemap } from '../../lib/map-config'
import {
  BasemapController,
  basemapSteps,
  fetchStyle,
  plainStyle,
  roadLayerIds,
  withAttribution,
  type BasemapErrorEvent,
  type BasemapStep,
  type MapStyle,
} from './basemap'
import {
  SELECT_MIN_ZOOM,
  TURKEY_BOUNDS,
  TURKEY_CENTER,
  TURKEY_ZOOM,
  type MapViewport,
} from './camera'
import { renderAircraftIcons, type AircraftIconImage } from './icons'
import {
  AIRPORT_LABEL_MIN_ZOOM,
  LabelPainter,
  NORMAL_THEME,
  SELECTED_THEME,
  type ScreenAircraft,
  type ScreenAirport,
} from './labels'
import { loadMaplibre, type MaplibreModule } from './maplibre-loader'
import {
  EMPTY_COLLECTION,
  MIN_UPLOAD_SHIFT_PX,
  MotionTracker,
  aircraftCollection,
  airportCollection,
  pixelsPerDegree,
  screenShiftPx,
  trailCollection,
} from './motion'

/** Bu genişlikten itibaren açılışta ülke sınırlarına sığdırılır. */
const FIT_BOUNDS_MIN_WIDTH = 768

/** Çizim turları arasındaki en kısa süre (≈15 kare/sn). */
export const TICK_MS = 66
/** Görünüm değişikliği React'e en fazla bu aralıkla bildirilir ("Uçağı ortala" her turda kayar). */
const VIEWPORT_EMIT_MS = 500
/** Uçağa tıklamada kabul edilen uzaklık (dokunmatik için), px. */
const CLICK_TOLERANCE = 8
/** Ekranın bu kadar dışındaki uçağın etiketi hesaba katılmaz, px. */
const LABEL_MARGIN = 48
/** Simge çakışma yarıçapı `icon-size` 1'de (32 px ikonun silüeti), px. */
const ICON_RADIUS = 14
/** Havalimanı kodlarının çakışma denetimi için iz noktaları en fazla bu aralıkla sıklaştırılır, px. */
const TRAIL_SAMPLE_PX = 6
/** Çakışma denetimine giren en fazla iz noktası. */
const TRAIL_SAMPLE_LIMIT = 2_000

const OVERLAY_SOURCES: ReadonlySet<string> = new Set([
  AIRCRAFT_SOURCE_ID,
  AIRPORT_SOURCE_ID,
  TRAIL_SOURCE_ID,
])

type MaplibreMap = Maplibre.Map
type GeoJSONSource = Maplibre.GeoJSONSource
type AddLayerObject = Parameters<MaplibreMap['addLayer']>[0]

/** İki ya da daha çok parmakla başlayan hareket (kıstırma): kullanıcının kaydırması sayılmaz. */
function isMultiTouch(event: unknown): boolean {
  return (
    typeof TouchEvent !== 'undefined' && event instanceof TouchEvent && event.touches.length >= 2
  )
}

/** React'ten gelen, çizimi etkileyen durum. */
export interface MapViewState {
  selectedHex: string | null
  following: boolean
  labelSettings: LabelSettings
  airports: readonly Airport[]
  locale: Locale
  units: UnitSystem
  /**
   * Haritanın altını örten panelin yüksekliği, CSS px (dar ekranda alttan açılan bilgi kartı).
   * Harita merkezi bu alanın üstündeki görünür bölgeye alınır; seçili uçak kartın altında kalmaz.
   */
  bottomInset: number
}

export interface MapControllerOptions {
  container: HTMLElement
  labelCanvas: HTMLCanvasElement
  basemap: Basemap
  /** Atıf denetimine her zaman eklenen HTML (canlı veri atfı, ADSB.lol ODbL). */
  customAttribution: string
  /** Harita tuvalinin erişilebilir adı. */
  mapLabel: string
  store: AircraftStore
  state: MapViewState
  onSelect: (hex: string) => void
  /** Kullanıcı haritayı sürükledi ("Uçağı ortala" kapanır). */
  onUserPan: () => void
  onViewportChange: (viewport: MapViewport) => void
  onBasemapFailedChange: (failed: boolean) => void
  /** Harita, atıf denetimi ve kendi katmanlarımız hazır (ilk stil yüklendi). */
  onReady: () => void
  /** Harita kurulamadı (MapLibre dosyaları indirilemedi). */
  onFailure: (error: unknown) => void
}

/**
 * `icon-size` ifadesinin yakınlaştırmadaki değeri (`['interpolate', ['linear'], ['zoom'], z0, v0, …]`);
 * etiket yerleşimi simgenin gerçek boyutunu bilsin diye paylaşılan katmandan okunur.
 */
export function iconScaleAt(
  zoom: number,
  expression: unknown = AIRCRAFT_LAYER.layout['icon-size'],
): number {
  if (typeof expression === 'number') return expression
  if (!Array.isArray(expression) || expression[0] !== 'interpolate') return 1
  const stops = expression.slice(3)
  const pairs: [number, number][] = []
  for (let i = 0; i + 1 < stops.length; i += 2) {
    const z = stops[i]
    const v = stops[i + 1]
    if (typeof z === 'number' && typeof v === 'number') pairs.push([z, v])
  }
  const first = pairs[0]
  const last = pairs.at(-1)
  if (!first || !last) return 1
  if (zoom <= first[0]) return first[1]
  if (zoom >= last[0]) return last[1]
  for (let i = 1; i < pairs.length; i++) {
    const [z1, v1] = pairs[i] as [number, number]
    const [z0, v0] = pairs[i - 1] as [number, number]
    if (zoom <= z1) return v0 + ((zoom - z0) / (z1 - z0)) * (v1 - v0)
  }
  return last[1]
}

function sameViewState(a: MapViewState, b: MapViewState): boolean {
  return (
    a.selectedHex === b.selectedHex &&
    a.following === b.following &&
    a.labelSettings.selected === b.labelSettings.selected &&
    a.labelSettings.others === b.labelSettings.others &&
    a.airports === b.airports &&
    a.locale === b.locale &&
    a.units === b.units &&
    a.bottomInset === b.bottomInset
  )
}

export class MapController {
  private readonly options: MapControllerOptions
  private readonly painter: LabelPainter
  private readonly motion = new MotionTracker()
  private readonly unsubscribeStore: () => void
  private state: MapViewState
  private map: MaplibreMap | null = null
  private basemap: BasemapController | null = null
  private icons: AircraftIconImage[] | null = null
  private destroyed = false
  /** İlk stil yüklendi (`onReady` bildirildi). */
  private ready = false
  private overlaysReady = false
  /** Son `setStyle`'ın kaynağı: açılıştaki düz stil mi, altlık zincirinin bir adımı mı. */
  private styleKind: 'initial' | 'basemap' = 'initial'
  private frameRequest = 0
  private lastTick = -Infinity
  private lastVersion = -1
  private dirty = true
  private trailShown = false
  private pendingCamera: { lat: number; lon: number; minZoom: number } | null = null
  private styleRequest: AbortController | null = null
  private viewportTimer: ReturnType<typeof setTimeout> | null = null
  private lastViewportEmit = -Infinity
  /** Harita hareket ederken değişen alt boşluk, hareket bitince uygulanır. */
  private paddingPending = false

  constructor(options: MapControllerOptions) {
    this.options = options
    this.state = options.state
    this.painter = new LabelPainter(options.labelCanvas)
    this.unsubscribeStore = options.store.subscribe(() => {
      this.dirty = true
    })
    this.loadFonts()
    loadMaplibre().then(
      (maplibregl) => {
        if (!this.destroyed) this.createMap(maplibregl)
      },
      (error: unknown) => {
        if (!this.destroyed) this.options.onFailure(error)
      },
    )
  }

  /** Prop değişikliklerini uygular; değişmeyen durum için hiçbir şey yapmaz. */
  update(next: MapViewState): void {
    const previous = this.state
    if (sameViewState(previous, next)) return
    this.state = next
    const map = this.map
    if (previous.airports !== next.airports && map && this.overlaysReady) {
      map.getSource<GeoJSONSource>(AIRPORT_SOURCE_ID)?.setData(airportCollection(next.airports))
    }
    if (previous.following !== next.following) this.configureFollow()
    if (previous.bottomInset !== next.bottomInset) this.applyPadding()
    this.dirty = true
    map?.triggerRepaint()
  }

  /**
   * Uçağa uçar; yakınlaştırma en az `minZoom` olur (daha yakınsa korunur). Harita henüz kurulmadıysa
   * (MapLibre iniyor) hedef saklanır ve harita doğrudan orada açılır.
   */
  flyTo(target: { lat: number; lon: number }, minZoom: number = SELECT_MIN_ZOOM): void {
    const map = this.map
    if (!map) {
      this.pendingCamera = { ...target, minZoom }
      return
    }
    map.flyTo({ center: [target.lon, target.lat], zoom: Math.max(map.getZoom(), minZoom) })
  }

  destroy(): void {
    this.destroyed = true
    cancelAnimationFrame(this.frameRequest)
    this.styleRequest?.abort()
    if (this.viewportTimer !== null) clearTimeout(this.viewportTimer)
    this.unsubscribeStore()
    this.basemap?.stop()
    this.map?.remove()
    this.map = null
    this.painter.clear()
  }

  private createMap(maplibregl: MaplibreModule): void {
    const { container } = this.options
    const wide = container.clientWidth >= FIT_BOUNDS_MIN_WIDTH
    const camera = wide
      ? {
          bounds: [
            [TURKEY_BOUNDS.minLon, TURKEY_BOUNDS.minLat],
            [TURKEY_BOUNDS.maxLon, TURKEY_BOUNDS.maxLat],
          ] as [[number, number], [number, number]],
          fitBoundsOptions: { padding: 24 },
        }
      : { center: [TURKEY_CENTER.lon, TURKEY_CENTER.lat] as [number, number], zoom: TURKEY_ZOOM }
    const map = new maplibregl.Map({
      container,
      ...camera,
      // Koddaki düz arka plan: kendi katmanlarımız hemen eklenir, uçaklar altlık beklenmeden çizilir.
      style: plainStyle(),
      // Uçak simgeleri yerleşime katılmaz; sembol geçişi yalnızca çizim döngüsünü boşuna döndürür.
      fadeDuration: 0,
      minZoom: 2,
      maxZoom: 17,
      // Atıflar her zaman açık kalır (küçük ekranda da düğmeye katlanmaz); boyutu CSS'tedir.
      attributionControl: { compact: false, customAttribution: this.options.customAttribution },
      // Düz, kuzeyi yukarıda harita: etiket yerleşimi ve simge yönü eğimsiz düzlemi varsayar.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
      locale: { 'Map.Title': this.options.mapLabel },
    })
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    this.map = map
    this.styleKind = 'initial'

    this.basemap = new BasemapController({
      steps: basemapSteps(this.options.basemap, (url) => new URL(url, window.location.href).href),
      apply: (step) => this.applyBasemap(map, step),
      onFailedChange: (failed) => this.options.onBasemapFailedChange(failed),
      isBasemapSource: (sourceId) =>
        !OVERLAY_SOURCES.has(sourceId) && map.getSource(sourceId) !== undefined,
      log: (message) => console.warn(message),
    })

    map.on('style.load', () => this.handleStyleLoad(map))
    map.on('error', (event) => this.basemap?.error(event as BasemapErrorEvent))
    map.on('data', (event) => {
      if (event.dataType === 'source' && event.tile && typeof event.sourceId === 'string') {
        this.basemap?.tileLoaded(event.sourceId)
      }
    })
    map.on('render', () => this.drawLabels())
    map.on('resize', () => this.resizeLabels())
    map.on('moveend', () => {
      this.scheduleViewport()
      if (this.paddingPending) this.applyPadding()
    })
    // Kıstırarak yakınlaştırmada parmakların ortası kayar ve MapLibre bunu da sürükleme sayar;
    // "Uçağı ortala"yı yalnızca tek parmakla ya da fareyle sürükleme kapatır.
    map.on('dragstart', (event) => {
      if (!isMultiTouch(event.originalEvent)) this.options.onUserPan()
    })
    map.on('click', (event) => this.handleClick(map, event.point))
    map.on('mousemove', (event) => {
      map.getCanvas().style.cursor = this.aircraftAt(map, event.point, 3) ? 'pointer' : ''
    })

    const pending = this.pendingCamera
    this.pendingCamera = null
    map.jumpTo({
      padding: this.padding(),
      ...(pending
        ? {
            center: [pending.lon, pending.lat] as [number, number],
            zoom: Math.max(map.getZoom(), pending.minZoom),
          }
        : {}),
    })

    this.resizeLabels()
    this.configureFollow()
    this.emitViewport()
    // Zincirin ilk adımı: nesne stili (uydu) açılış stilinin yerini hemen alır; adresli stil
    // indirilirken düz arka plan ve uçaklar ekranda kalır.
    this.basemap.start()
    this.frameRequest = requestAnimationFrame(this.frame)
  }

  /**
   * Adımın stilini uygular. Stil adresi burada indirilir (MapLibre'nin adres yüklemesi yerine):
   * atıf yazılabilsin ve başarısız istek zincirde sayılsın diye. Yeni adım bekleyen isteği iptal
   * eder. İstek sürerken ekrandaki stil ve kendi katmanlarımız yerinde kalır.
   */
  private applyBasemap(map: MaplibreMap, step: BasemapStep): void {
    this.styleRequest?.abort()
    this.styleRequest = null
    const { style, attribution } = step
    if (typeof style !== 'string') {
      this.setBasemapStyle(map, style)
      return
    }
    const request = new AbortController()
    this.styleRequest = request
    fetchStyle(style, request.signal).then(
      (loaded) => {
        if (request.signal.aborted || this.destroyed) return
        this.styleRequest = null
        this.setBasemapStyle(
          map,
          attribution === null ? loaded : withAttribution(loaded, attribution),
        )
      },
      (error: unknown) => {
        if (request.signal.aborted || this.destroyed) return
        this.styleRequest = null
        console.warn('Basemap style could not be loaded', error)
        this.basemap?.error({})
      },
    )
  }

  /**
   * Altlık stilini haritaya verir. Kendi katmanlarımız stil değişiminde silinir ve yeni stil
   * yüklenince (`style.load`) yeniden eklenir; aradaki kısa sürede çizim döngüsü bekler.
   */
  private setBasemapStyle(map: MaplibreMap, style: MapStyle): void {
    this.overlaysReady = false
    this.styleKind = 'basemap'
    map.setStyle(style, { diff: false })
  }

  private handleStyleLoad(map: MaplibreMap): void {
    const basemap = this.basemap
    if (basemap && this.styleKind === 'basemap') {
      basemap.styleLoaded()
      if (basemap.step.hideRoads) {
        for (const id of roadLayerIds(map.getStyle().layers)) {
          map.setLayoutProperty(id, 'visibility', 'none')
        }
      }
    }
    this.installOverlays(map)
    // Hazır = ilk stil ve katmanlar yüklendi. MapLibre'nin `load` olayı beklenmez: bütün kaynakların
    // yüklenmesini ister, uçak kaynağı ise sık `setData` aldığından yoğun trafikte gecikebilir.
    if (!this.ready) {
      this.ready = true
      this.options.onReady()
    }
  }

  /**
   * İkonlar, kaynaklar ve katmanlar (alttan üste: havalimanları, iz, uçaklar). Her stil
   * değişiminden sonra yeniden eklenir; ikonlar katmandan önce eklenir.
   */
  private installOverlays(map: MaplibreMap): void {
    this.icons ??= renderAircraftIcons(window.devicePixelRatio)
    for (const { id, image, pixelRatio } of this.icons) {
      if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio })
    }
    const sources = [
      [AIRPORT_SOURCE_ID, airportCollection(this.state.airports)],
      [TRAIL_SOURCE_ID, EMPTY_COLLECTION],
      [AIRCRAFT_SOURCE_ID, EMPTY_COLLECTION],
    ] as const
    for (const [id, data] of sources) {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data })
    }
    for (const layer of LIVE_MAP_LAYERS) {
      if (!map.getLayer(layer.id)) map.addLayer(layer as AddLayerObject)
    }
    this.overlaysReady = true
    this.trailShown = false
    this.dirty = true
    this.tick(monotonicNow())
  }

  private readonly frame = (): void => {
    if (this.destroyed) return
    this.frameRequest = requestAnimationFrame(this.frame)
    const now = monotonicNow()
    if (now - this.lastTick < TICK_MS) return
    this.lastTick = now
    this.tick(now)
  }

  /**
   * Gösterim konumları, kaynak verileri ve "Uçağı ortala". Kaynak yalnızca küme, depo sürümü ya da
   * çizimi etkileyen durum değişince ya da bir simge ekranda en az `MIN_UPLOAD_SHIFT_PX` kayınca
   * yeniden yüklenir; düşük yakınlaştırmada seyirdeki uçak saniyelerce bir pikseli aşmaz.
   */
  private tick(now: number): void {
    const map = this.map
    if (!map || !this.overlaysReady) return
    const { store } = this.options
    const aircraft = store.list()
    const setChanged = this.motion.update(aircraft, now)
    const version = store.version
    const pxPerDegree = pixelsPerDegree(map.getZoom())
    if (
      setChanged ||
      this.dirty ||
      version !== this.lastVersion ||
      this.motion.largestShiftPx(pxPerDegree, MIN_UPLOAD_SHIFT_PX) >= MIN_UPLOAD_SHIFT_PX
    ) {
      this.lastVersion = version
      this.dirty = false
      map
        .getSource<GeoJSONSource>(AIRCRAFT_SOURCE_ID)
        ?.setData(aircraftCollection(aircraft, this.motion, this.state.selectedHex))
      this.motion.commit()
      this.updateTrail(map)
    }
    if (this.state.following) this.follow(map, pxPerDegree)
  }

  private updateTrail(map: MaplibreMap): void {
    const hex = this.state.selectedHex
    const ac = hex === null ? undefined : this.options.store.get(hex)
    if (!hex || !ac) {
      if (this.trailShown) map.getSource<GeoJSONSource>(TRAIL_SOURCE_ID)?.setData(EMPTY_COLLECTION)
      this.trailShown = false
      return
    }
    const position = this.motion.position(hex) ?? ac
    const data = trailCollection(this.options.store.trail(hex), {
      lat: position.lat,
      lon: position.lon,
      gnd: ac.gnd,
    })
    map.getSource<GeoJSONSource>(TRAIL_SOURCE_ID)?.setData(data)
    this.trailShown = true
  }

  /**
   * Seçili uçağı ortada tutar; kullanıcının yakınlaştırması ya da uçuş animasyonu sürerken beklenir.
   * Uçak ekranın ortasından yarım pikselden az uzaktaysa kamera oynatılmaz.
   */
  private follow(map: MaplibreMap, pxPerDegree: number): void {
    const hex = this.state.selectedHex
    const position = hex === null ? undefined : this.motion.position(hex)
    if (!position || map.isMoving()) return
    const center = map.getCenter()
    const offset = screenShiftPx({ lat: center.lat, lon: center.lng }, position, pxPerDegree)
    if (offset < MIN_UPLOAD_SHIFT_PX) return
    map.jumpTo({ center: [position.lon, position.lat] })
  }

  private padding(): { top: number; right: number; bottom: number; left: number } {
    return { top: 0, right: 0, bottom: Math.max(0, this.state.bottomInset), left: 0 }
  }

  /**
   * Alt boşluğu (dar ekranda bilgi kartı) haritaya verir: merkezdeki nokta görünür bölgenin ortasına
   * kayar. Uçuş ya da sürükleme sürerken beklenir; `jumpTo`/`easeTo` süren hareketi keserdi.
   */
  private applyPadding(): void {
    const map = this.map
    if (!map) return
    this.paddingPending = false
    const padding = this.padding()
    if (map.getPadding().bottom === padding.bottom) return
    if (map.isMoving()) {
      this.paddingPending = true
      return
    }
    map.easeTo({ padding, duration: 250 })
  }

  /**
   * Ortalarken fare tekerleği ve kıstırma yakınlaştırması ekranın ortasına göre yapılır; uçak
   * yerinden kaymaz. MapLibre 6'da `scrollZoom.enable` açık denetimde seçeneği yok sayar; bu yüzden
   * önce kapatılır.
   */
  private configureFollow(): void {
    const map = this.map
    if (!map) return
    const around = this.state.following ? ({ around: 'center' } as const) : undefined
    map.scrollZoom.disable()
    map.scrollZoom.enable(around)
    map.touchZoomRotate.enable(around)
    const hex = this.state.selectedHex
    const position = hex === null ? undefined : this.motion.position(hex)
    if (this.state.following && position) {
      map.easeTo({ center: [position.lon, position.lat] })
    }
  }

  private scheduleViewport(): void {
    if (this.viewportTimer !== null) return
    const wait = this.lastViewportEmit + VIEWPORT_EMIT_MS - monotonicNow()
    if (wait <= 0) {
      this.emitViewport()
      return
    }
    this.viewportTimer = setTimeout(() => {
      this.viewportTimer = null
      this.emitViewport()
    }, wait)
  }

  private emitViewport(): void {
    const map = this.map
    if (!map || this.destroyed) return
    this.lastViewportEmit = monotonicNow()
    const bounds = map.getBounds()
    const center = map.getCenter()
    this.options.onViewportChange({
      bounds: {
        minLon: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLon: bounds.getEast(),
        maxLat: bounds.getNorth(),
      },
      center: { lat: center.lat, lon: center.lng },
      zoom: map.getZoom(),
    })
  }

  private aircraftAt(
    map: MaplibreMap,
    point: { x: number; y: number },
    tolerance: number,
  ): string | null {
    if (!this.overlaysReady || !map.getLayer(AIRCRAFT_LAYER_ID)) return null
    const features = map.queryRenderedFeatures(
      [
        [point.x - tolerance, point.y - tolerance],
        [point.x + tolerance, point.y + tolerance],
      ],
      { layers: [AIRCRAFT_LAYER_ID] },
    )
    for (const feature of features) {
      const hex: unknown = feature.properties.hex
      if (typeof hex === 'string') return hex
    }
    return null
  }

  /** Uçağa ya da etiketine tıklama seçer; boş haritaya tıklama seçimi değiştirmez. */
  private handleClick(map: MaplibreMap, point: { x: number; y: number }): void {
    const hex =
      this.aircraftAt(map, point, CLICK_TOLERANCE) ?? this.painter.hitTest(point.x, point.y)
    if (hex) this.options.onSelect(hex)
  }

  private resizeLabels(): void {
    const { container } = this.options
    this.painter.resize(container.clientWidth, container.clientHeight, window.devicePixelRatio)
    this.map?.triggerRepaint()
  }

  private drawLabels(): void {
    const map = this.map
    if (!map || !this.overlaysReady) return
    const { container, store } = this.options
    const width = container.clientWidth
    const height = container.clientHeight
    const zoom = map.getZoom()
    const inView = (x: number, y: number) =>
      x >= -LABEL_MARGIN &&
      y >= -LABEL_MARGIN &&
      x <= width + LABEL_MARGIN &&
      y <= height + LABEL_MARGIN

    const aircraft: ScreenAircraft[] = []
    for (const ac of store.list()) {
      const position = this.motion.position(ac.hex)
      if (!position) continue
      const { x, y } = map.project([position.lon, position.lat])
      if (inView(x, y)) aircraft.push({ ac, x, y })
    }
    const airports: ScreenAirport[] = []
    for (const airport of this.state.airports) {
      const { x, y } = map.project([airport.lon, airport.lat])
      if (inView(x, y)) airports.push({ airport, x, y })
    }
    const selectedHex = this.state.selectedHex
    const trail =
      selectedHex !== null && airports.length > 0 && zoom >= AIRPORT_LABEL_MIN_ZOOM
        ? this.screenTrail(map, selectedHex, inView)
        : []
    this.painter.draw({
      width,
      height,
      zoom,
      iconRadius: Math.max(6, ICON_RADIUS * iconScaleAt(zoom)),
      aircraft,
      airports,
      trail,
      selectedHex,
      settings: this.state.labelSettings,
      locale: this.state.locale,
      units: this.state.units,
    })
  }

  /**
   * Seçili uçağın izinin ekrandaki noktaları, çizgi boyunca en fazla `TRAIL_SAMPLE_PX` aralıkla:
   * havalimanı kodları izin (ör. teker koyduktan sonraki yer izinin) üstüne yazılmaz.
   */
  private screenTrail(
    map: MaplibreMap,
    hex: string,
    inView: (x: number, y: number) => boolean,
  ): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = []
    const current = this.motion.position(hex)
    const path = current ? [...this.options.store.trail(hex), current] : []
    let previous: { x: number; y: number } | null = null
    for (const point of path) {
      if (points.length >= TRAIL_SAMPLE_LIMIT) break
      const next = map.project([point.lon, point.lat])
      if (previous) {
        const steps = Math.min(
          TRAIL_SAMPLE_LIMIT,
          Math.ceil(Math.hypot(next.x - previous.x, next.y - previous.y) / TRAIL_SAMPLE_PX),
        )
        for (let i = 1; i < steps && points.length < TRAIL_SAMPLE_LIMIT; i++) {
          const x = previous.x + ((next.x - previous.x) * i) / steps
          const y = previous.y + ((next.y - previous.y) * i) / steps
          if (inView(x, y)) points.push({ x, y })
        }
      }
      if (inView(next.x, next.y)) points.push({ x: next.x, y: next.y })
      previous = next
    }
    return points
  }

  /** Etiket yazı tipi (IBM Plex Mono) yüklenince ölçüler yenilenir. */
  private loadFonts(): void {
    if (typeof document === 'undefined' || !('fonts' in document)) return
    const fonts = [NORMAL_THEME.primaryFont, NORMAL_THEME.secondaryFont, SELECTED_THEME.primaryFont]
    Promise.all(fonts.map((font) => document.fonts.load(font))).then(
      () => {
        if (this.destroyed) return
        this.painter.invalidateText()
        this.map?.triggerRepaint()
      },
      () => {
        // Yazı tipi yüklenemedi: yedek yazı tipinin ölçüleri kullanılmaya devam eder.
      },
    )
  }
}
