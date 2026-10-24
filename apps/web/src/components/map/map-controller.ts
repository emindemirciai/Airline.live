/**
 * Canlı haritanın MapLibre tarafı (React dışında): harita, altlık zinciri, uçak/iz/havalimanı
 * katmanları, çizim döngüsü, etiket tuvali, tıklama ve "Uçağı ortala". `MapView` bileşeni bir
 * örnek kurar, prop değişikliklerini `update` ile iletir ve söküldüğünde `destroy` çağırır.
 * MapLibre sayfa paketinde değildir; harita kurulurken yüklenir (maplibre-loader.ts).
 *
 * Tıklama: uçak simgesi ya da etiketi uçağı seçer; havalimanı pini ya da IATA kodu havalimanı
 * penceresini açar; boş harita pencereyi kapatır. Öncelik `resolveHit`'tedir (D-079). Pencerenin dayanağı `trackPoint` ile izlenir:
 * yer yalnızca haritanın kendi `render` olayında hesaplanır, çizim döngüsüne iş eklenmez.
 *
 * Havalimanları Gizle'deyken (D-114) pinler ve kodlar çizilmez ve tıklanmaz, imleç değişmez:
 * havalimanı kaynağına ve kod çizimine yalnız açık pencerenin ve `?havalimani=` hedefinin
 * havalimanı girer (`drawnAirports`); pencere kapanınca onunki de kalkar.
 *
 * Harita koddaki düz arka plan stiliyle açılır; kendi katmanlarımız hemen eklenir ve uçaklar altlık
 * zinciri (basemap.ts) yüklenirken, yeniden denenirken ya da hiç yüklenemezken de çizilir.
 *
 * Ülke adları (D-095, D-096) havalimanı pinlerinin altındaki GL katmanlarıdır (country-labels.ts);
 * yazı tipleri haritaya verilen her stile `font-faces` olarak eklenir (map-fonts.ts).
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
  AIRPORT_LAYER,
  AIRPORT_LAYER_ID,
  AIRPORT_SOURCE_ID,
  COUNTRY_LABEL_SOURCE_ID,
  COUNTRY_LABEL_SOURCE_MAX_ZOOM,
  LIVE_MAP_LAYERS,
  TRAIL_SOURCE_ID,
  countryLabelLayers,
  type Airport,
  type CountryLabelLayerOptions,
  type Locale,
  type MapLayerStyle,
} from '@havayolu/shared'
import type * as Maplibre from 'maplibre-gl'
import { monotonicNow } from '../../lib/live/clock'
import { motionPolicy } from '../../lib/live/interpolate'
import type { AircraftStore } from '../../lib/live/store'
import type { ScreenRect } from '../../lib/map/label-layout'
import { sameLabelSettings, type LabelSettings } from '../../lib/map/label-settings'
import type { Basemap } from '../../lib/map-config'
import { prependSiteCredit } from './attribution'
import {
  BasemapController,
  basemapSteps,
  fetchStyle,
  NON_BASEMAP_SOURCES,
  plainStyle,
  prepareFetchedStyle,
  roadLayerIds,
  type BasemapErrorEvent,
  type BasemapStep,
  type MapStyle,
} from './basemap'
import {
  initialZoom,
  nearestWorldLon,
  PRIMARY_AIRPORT_VIEW,
  SELECT_MIN_ZOOM,
  type MapViewport,
} from './camera'
import { CountryLabelOverlay, isCompactMap } from './country-labels'
import {
  renderAircraftIcons,
  renderAirportPin,
  type AircraftIconImage,
  type AirportPinImage,
} from './icons'
import {
  airportChipsEnabled,
  LabelPainter,
  NORMAL_THEME,
  pinGeometry,
  SELECTED_THEME,
  showsAirportChips,
  type ScreenAircraft,
  type ScreenAirport,
} from './labels'
import { withMapFonts } from './map-fonts'
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

/** Çizim turları arasındaki en kısa süre (≈15 kare/sn). */
export const TICK_MS = 66
/** Görünüm değişikliği React'e en fazla bu aralıkla bildirilir ("Uçağı ortala" her turda kayar). */
const VIEWPORT_EMIT_MS = 500
/** Uçağa tıklamada kabul edilen uzaklık (dokunmatik için), px. */
const CLICK_TOLERANCE = 8
/** Havalimanı pinine tıklamada pinin kutusuna eklenen pay, px. */
const AIRPORT_CLICK_TOLERANCE = 2
/** İmlecin uçak ve havalimanı pini üstünde sayıldığı pay, px. */
const HOVER_TOLERANCE = 3
const AIRPORT_HOVER_TOLERANCE = 0
/** İzlenen nokta (havalimanı penceresi) en az bu kadar kayınca bildirilir, CSS px. */
const TRACK_MIN_SHIFT_PX = 0.5
/** Ekranın bu kadar dışındaki uçağın etiketi hesaba katılmaz, px. */
const LABEL_MARGIN = 48
/** Simge çakışma yarıçapı `icon-size` 1'de (32 px ikonun silüeti), px. */
const ICON_RADIUS = 14
/** Havalimanı kodlarının çakışma denetimi için iz noktaları en fazla bu aralıkla sıklaştırılır, px. */
const TRAIL_SAMPLE_PX = 6
/** Çakışma denetimine giren en fazla iz noktası. */
const TRAIL_SAMPLE_LIMIT = 2_000

type MaplibreMap = Maplibre.Map
type GeoJSONSource = Maplibre.GeoJSONSource
type AddLayerObject = Parameters<MaplibreMap['addLayer']>[0]

/** İki ya da daha çok parmakla başlayan hareket (kıstırma): kullanıcının kaydırması sayılmaz. */
function isMultiTouch(event: unknown): boolean {
  return (
    typeof TouchEvent !== 'undefined' && event instanceof TouchEvent && event.touches.length >= 2
  )
}

/** Haritada tıklanan ya da imlecin altındaki hedef: uçak (simge ya da etiket) ya da havalimanı. */
export type MapHit = { kind: 'aircraft'; hex: string } | { kind: 'airport'; icao: string }

/** Noktadaki adaylar, her biri ayrı denetimden (yoksa null). */
export interface HitCandidates {
  /** Uçak etiketi (tuvalde en üstte). */
  label: string | null
  /** Havadaki uçağın simgesine tam isabet. */
  airborne: string | null
  /** Havalimanı kodu (tuvalde). */
  chip: string | null
  /** Havalimanı pini (GL katmanı). */
  pin: string | null
  /** Yerdeki uçağın simgesine tam isabet. */
  ground: string | null
  /** Uçak simgesinin dokunma payı (±8 px). */
  near: string | null
}

/**
 * Tıklama önceliği (kullanıcı kararı 2026-10-01, D-079): uçak etiketi > havadaki uçağın simgesi >
 * havalimanı kodu ya da pini > yerdeki uçağın simgesi > dokunma payı. Apronda pinin ve kodun
 * üstündeki yerdeki uçaklar havalimanı penceresini engellemez; havadaki uçak her zaman önce gelir.
 */
export function resolveHit(c: HitCandidates): MapHit | null {
  if (c.label) return { kind: 'aircraft', hex: c.label }
  if (c.airborne) return { kind: 'aircraft', hex: c.airborne }
  if (c.chip) return { kind: 'airport', icao: c.chip }
  if (c.pin) return { kind: 'airport', icao: c.pin }
  if (c.ground) return { kind: 'aircraft', hex: c.ground }
  if (c.near) return { kind: 'aircraft', hex: c.near }
  return null
}

/** Ekrandaki nokta, harita kapsayıcısının sol üst köşesine göre CSS px. */
export interface ScreenPoint {
  x: number
  y: number
}

/** Haritayla birlikte kayan nokta (havalimanı penceresinin dayanağı). */
interface TrackedPoint {
  lat: number
  lon: number
  listener: (point: ScreenPoint) => void
  last: ScreenPoint | null
}

/**
 * Haritanın üstünü örten panellerin payı, CSS px. Harita merkezi bu alanların dışındaki görünür
 * bölgenin ortasına alınır; seçili uçak (ve "Uçağı ortala") panelin altında kalmaz.
 */
export interface MapInsets {
  /** Dar ekranda alttan açılan bilgi kartı ya da havalimanı penceresi. */
  bottom: number
  /** Geniş ekranda soldaki bilgi kartı haritanın ortasını örttüğünde (D-085). */
  left: number
}

export const NO_INSETS: Readonly<MapInsets> = Object.freeze({ bottom: 0, left: 0 })

const NO_AIRPORTS: readonly Airport[] = Object.freeze([])

/** Havalimanları Gizle'deyken de çizilen havalimanları (D-114). */
export interface KeptAirports {
  /**
   * Açık havalimanı penceresinin ICAO kodu (yoksa null): pencere "Havalimanları" listesinden,
   * aramadan ya da Gizle'den önce pine tıklanarak açılmış olabilir.
   */
  popupIcao: string | null
  /** Adresteki `?havalimani=` hedefinin ICAO kodu (parametre yoksa ya da listede değilse null). */
  linkIcao: string | null
}

/**
 * Haritada çizilen havalimanları (pin kaynağı ve kod çizimi, D-114). Simge ve Simge ve kod'da liste
 * kendisidir (aynı başvuru). Gizle'de hiçbiri çizilmez; yalnız açık pencerenin havalimanı (pencere
 * kapanana kadar) ve `?havalimani=` hedefi (parametre adresteyken) çizilir, listedeki sırayla:
 * pencerenin dayanağı ve bağlantının gösterdiği havalimanı haritada görünür kalır, pinleri tıklanır.
 * Kodları Gizle'de yazılmaz (`airportChipsEnabled`).
 */
export function drawnAirports<A extends Airport>(
  airports: readonly A[],
  settings: Pick<LabelSettings, 'airportDisplay'>,
  kept: KeptAirports,
): readonly A[] {
  if (settings.airportDisplay !== 'hidden') return airports
  const { popupIcao, linkIcao } = kept
  if (popupIcao === null && linkIcao === null) return NO_AIRPORTS as readonly A[]
  const drawn = airports.filter((a) => a.icao === popupIcao || a.icao === linkIcao)
  return drawn.length === 0 ? (NO_AIRPORTS as readonly A[]) : drawn
}

/** Çizilen havalimanları değişti mi: aynı başvuru ya da aynı sırada aynı nesneler değişmemiştir. */
export function sameAirportList(a: readonly Airport[], b: readonly Airport[]): boolean {
  return a === b || (a.length === b.length && a.every((airport, i) => airport === b[i]))
}

/** Coğrafi süzgeç: her havalimanı geçer (görünüm bütün dünyayı kapsıyor ya da süzgeç yok). */
const EVERYWHERE = (): boolean => true

/**
 * Görünümün coğrafi penceresi (izdüşümden önceki ön süzgeç, D-118): haritanın paylı kuzeybatı ve
 * güneydoğu köşelerinin konumu (`map.unproject`; boylam sarılmamış). Harita kuzeye bakar ve eğilmez
 * (döndürme ve eğim kapalı): ekran dikdörtgeni boylamda ve enlemde bir penceredir. Boylam testi
 * 180. meridyende de doğrudur (`((lon − batı) mod 360) ≤ açıklık`, `airportsInView` gibi); açıklık
 * 360°'ye ulaşırsa her havalimanı geçer.
 */
export function lonLatWindow(
  northWest: { lng: number; lat: number },
  southEast: { lng: number; lat: number },
): (lon: number, lat: number) => boolean {
  const span = southEast.lng - northWest.lng
  if (!(span < 360)) return EVERYWHERE
  return (lon, lat) =>
    lat <= northWest.lat &&
    lat >= southEast.lat &&
    (((lon - northWest.lng) % 360) + 360) % 360 <= span
}

/**
 * Havalimanı kodlarının çizim girdisi: görünümdeki havalimanları ekran konumlarıyla (`airports`
 * çizilen havalimanlarıdır, `drawnAirports`). Kod yazılmayacaksa (yakınlaştırma
 * `AIRPORT_LABEL_MIN_ZOOM`'un altında ya da ayar Simge ve kod değil) hiçbir havalimanı izdüşürülmez:
 * her karede bütün liste (5. halkada 3.266 havalimanı, D-118) boşuna izdüşürülürdü (D-101). Yazılacaksa
 * yalnız görünümün coğrafi penceresindekiler (`near`, `lonLatWindow`) izdüşürülür: z5'te Türkiye'ye
 * bakan 2560×1440 görünümde 3.266'nın ~490'ı (`labels.test.ts`), daha yakında daha azı (D-118);
 * kesin sınır izdüşümden sonraki `inView`'dur. Uçak etiketleri bundan etkilenmez. Boylam kameranın ortasına en yakın dünya
 * kopyasına sarılır (`nearestWorldLon`, D-111): 180. meridyenin öbür yanındaki havalimanının kodu da
 * pininin yanında çizilir.
 */
export function screenAirports(
  project: (lngLat: [number, number]) => { x: number; y: number },
  airports: readonly Airport[],
  zoom: number,
  settings: Pick<LabelSettings, 'airportDisplay'>,
  inView: (x: number, y: number) => boolean,
  centerLon: number,
  near: (lon: number, lat: number) => boolean = EVERYWHERE,
): ScreenAirport[] {
  if (!airportChipsEnabled(zoom, settings)) return []
  const screen: ScreenAirport[] = []
  for (const airport of airports) {
    if (!near(airport.lon, airport.lat)) continue
    const { x, y } = project([nearestWorldLon(airport.lon, centerLon), airport.lat])
    if (inView(x, y)) screen.push({ airport, x, y })
  }
  return screen
}

/** Panel yokken (ya da henüz ölçülmemişken) `MapViewState.panels`. */
export const NO_PANELS: readonly ScreenRect[] = Object.freeze([])

/**
 * React'ten gelen, çizimi etkileyen durum. `popupIcao` ve `linkIcao` (`KeptAirports`) havalimanları
 * Gizle'deyken de çizilen havalimanlarıdır (D-114).
 */
export interface MapViewState extends KeptAirports {
  selectedHex: string | null
  following: boolean
  labelSettings: LabelSettings
  airports: readonly Airport[]
  locale: Locale
  units: UnitSystem
  /** Haritayı örten panellerin payı (alttan açılan kart ya da pencere, soldaki kart). */
  insets: MapInsets
  /**
   * Haritanın üstündeki opak panellerin (arama, bilgi kartı, uçak listesi, sağ alttaki düğmeler)
   * haritaya göre dikdörtgenleri, CSS px: seçili uçağın etiketi bunları örtmez (D-085). Değerler
   * değişmedikçe aynı dizi verilir (başvuruyla karşılaştırılır).
   */
  panels: readonly ScreenRect[]
}

export interface MapControllerOptions {
  container: HTMLElement
  labelCanvas: HTMLCanvasElement
  basemap: Basemap
  /** Atıf denetimine her zaman eklenen HTML (canlı veri atfı, ADSB.lol ODbL). */
  customAttribution: string
  /** Atıf şeridinin başına konan site künyesi, HTML (`siteCreditHtml`, D-089). */
  siteCredit: string
  /** Harita tuvalinin erişilebilir adı. */
  mapLabel: string
  store: AircraftStore
  state: MapViewState
  onSelect: (hex: string) => void
  /** Havalimanı noktasına ya da IATA koduna tıklandı. */
  onAirportSelect: (icao: string) => void
  /** Uçak ya da havalimanı olmayan bir yere tıklandı (havalimanı penceresi kapanır). */
  onEmptyClick: () => void
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

/**
 * Çizimi etkileyen durum değişmedi mi (`update` aynı durumda hiçbir şey yapmaz). Etiket ayarının
 * bütün alanları karşılaştırılır; havalimanları ayarı da yeniden çizim ister (D-084, D-114). Açık
 * pencere ve `?havalimani=` hedefi de karşılaştırılır: Gizle'de onların havalimanı çizilir.
 */
export function sameViewState(a: MapViewState, b: MapViewState): boolean {
  return (
    a.selectedHex === b.selectedHex &&
    a.following === b.following &&
    sameLabelSettings(a.labelSettings, b.labelSettings) &&
    a.airports === b.airports &&
    a.popupIcao === b.popupIcao &&
    a.linkIcao === b.linkIcao &&
    a.locale === b.locale &&
    a.units === b.units &&
    a.insets.bottom === b.insets.bottom &&
    a.insets.left === b.insets.left &&
    a.panels === b.panels
  )
}

/**
 * Kendi katmanlarımız alttan üste: ülke adları (40 katman: kademe 3, 2, 1 ve ilk sığma
 * yakınlaştırması; D-095, D-096), sonra havalimanı pinleri, iz ve uçaklar. Adlar pinlerin altında
 * kalır; pin, iz ve uçak hep çizilir ve yerleşime katılmaz.
 */
export function overlayLayers(options: CountryLabelLayerOptions): MapLayerStyle[] {
  return [...countryLabelLayers(options), ...LIVE_MAP_LAYERS]
}

/** MapLibre'nin `padding` değeri: üst ve sağ hep 0, negatif pay 0 sayılır. */
export function mapPadding(insets: MapInsets): {
  top: number
  right: number
  bottom: number
  left: number
} {
  return { top: 0, right: 0, bottom: Math.max(0, insets.bottom), left: Math.max(0, insets.left) }
}

export class MapController {
  private readonly options: MapControllerOptions
  private readonly painter: LabelPainter
  private readonly motion = new MotionTracker()
  private readonly countryLabels: CountryLabelOverlay
  private readonly unsubscribeStore: () => void
  private state: MapViewState
  /** Haritada çizilen havalimanları (`drawnAirports`): pin kaynağının ve kodların girdisi. */
  private drawn: readonly Airport[]
  private map: MaplibreMap | null = null
  private basemap: BasemapController | null = null
  private icons: AircraftIconImage[] | null = null
  private pin: AirportPinImage | null = null
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
  private tracked: TrackedPoint | null = null

  constructor(options: MapControllerOptions) {
    this.options = options
    this.state = options.state
    this.drawn = drawnAirports(options.state.airports, options.state.labelSettings, options.state)
    this.painter = new LabelPainter(options.labelCanvas)
    this.countryLabels = new CountryLabelOverlay({
      element: options.container,
      state: {
        mode: options.state.labelSettings.countries,
        locale: options.state.locale,
        compact: isCompactMap(options.container.clientWidth),
      },
    })
    this.unsubscribeStore = options.store.subscribe(() => {
      this.dirty = true
    })
    this.loadFonts()
    // Ülke adlarının yerleşim tablosu ilk pakette değildir (D-100): MapLibre ile paralel iner.
    // Parça yüklenemezse adlar yazılmaz; hata ekranı yoktur.
    import('@havayolu/shared/country-label-points').then(
      (chunk) => {
        if (!this.destroyed) this.countryLabels.setPoints(chunk.countryLabelPoints)
      },
      (error: unknown) => {
        console.warn('Country labels could not be loaded', error)
      },
    )
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
    // Pin kaynağı yalnız çizilen havalimanları değişince yenilenir: liste, havalimanları ayarı ya da
    // (Gizle'de) açık pencere ve `?havalimani=` hedefi (D-114). Simge ile Simge ve kod arasında liste
    // aynıdır, yalnız kodlar yeniden çizilir. Katmanlar hazır değilse `installOverlays` güncel listeyi
    // ekler.
    const drawn = drawnAirports(next.airports, next.labelSettings, next)
    if (!sameAirportList(this.drawn, drawn)) {
      this.drawn = drawn
      if (map && this.overlaysReady) {
        map.getSource<GeoJSONSource>(AIRPORT_SOURCE_ID)?.setData(airportCollection(drawn))
      }
    }
    if (
      previous.labelSettings.countries !== next.labelSettings.countries ||
      previous.locale !== next.locale
    ) {
      this.countryLabels.update({
        ...this.countryLabels.current,
        mode: next.labelSettings.countries,
        locale: next.locale,
      })
    }
    if (previous.following !== next.following) this.configureFollow()
    if (
      previous.insets.bottom !== next.insets.bottom ||
      previous.insets.left !== next.insets.left
    ) {
      this.applyPadding()
    }
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

  /**
   * Noktanın ekrandaki yerini izler: harita her çizildiğinde (kaydırma, yakınlaştırma, boyut) yer
   * en az yarım piksel değiştiyse `listener` çağrılır; kayıt anında da bir kez (harita kuruluysa).
   * Tek nokta izlenir; null izlemeyi bırakır. Dinleyici React durumu değil, doğrudan DOM yazar.
   */
  trackPoint(target: { lat: number; lon: number } | null, listener?: (point: ScreenPoint) => void) {
    this.tracked =
      target && listener ? { lat: target.lat, lon: target.lon, listener, last: null } : null
    this.emitTracked()
  }

  destroy(): void {
    this.destroyed = true
    this.tracked = null
    cancelAnimationFrame(this.frameRequest)
    this.styleRequest?.abort()
    if (this.viewportTimer !== null) clearTimeout(this.viewportTimer)
    this.countryLabels.destroy()
    this.unsubscribeStore()
    this.basemap?.stop()
    this.map?.remove()
    this.map = null
    this.painter.clear()
  }

  private createMap(maplibregl: MaplibreModule): void {
    const { container } = this.options
    // Açılış: IST/LTFM merkezli, yaklaşma alanını gösteren yakınlaştırma (D-079). `?hex=` ve
    // `?havalimani=` hedefi varsa (`pendingCamera`) aşağıda doğrudan oraya atlanır.
    const map = new maplibregl.Map({
      container,
      center: [PRIMARY_AIRPORT_VIEW.lon, PRIMARY_AIRPORT_VIEW.lat],
      zoom: initialZoom(container.clientWidth, container.clientHeight),
      // Koddaki düz arka plan: kendi katmanlarımız hemen eklenir, uçaklar altlık beklenmeden çizilir.
      // Ülke adlarının yazı tipi her stile eklenir (`font-faces`; glif adresi yok, D-095).
      style: withMapFonts(plainStyle(), window.location.origin),
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
    // Atıf denetimi kurucuda eklenir; site künyesi şeridin başına, MapLibre girdilerinin önüne
    // konur (D-089). Girdiler uzunluğa göre sıralandığından künye girdi olarak ilk sırada kalmazdı.
    if (!prependSiteCredit(container, this.options.siteCredit)) {
      console.warn('Site credit could not be added to the map attribution')
    }
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    this.map = map
    this.styleKind = 'initial'
    this.countryLabels.attach(map)

    this.basemap = new BasemapController({
      steps: basemapSteps(this.options.basemap, (url) => new URL(url, window.location.href).href),
      apply: (step) => this.applyBasemap(map, step),
      onFailedChange: (failed) => this.options.onBasemapFailedChange(failed),
      // Kendi katmanlarımızın ve uydunun üstündeki sınır kaynağının hataları altlığı değiştirmez.
      isBasemapSource: (sourceId) =>
        !NON_BASEMAP_SOURCES.has(sourceId) && map.getSource(sourceId) !== undefined,
      log: (message) => console.warn(message),
    })

    map.on('style.load', () => this.handleStyleLoad(map))
    map.on('error', (event) => this.basemap?.error(event as BasemapErrorEvent))
    map.on('data', (event) => {
      if (event.dataType === 'source' && event.tile && typeof event.sourceId === 'string') {
        this.basemap?.tileLoaded(event.sourceId)
      }
    })
    map.on('render', () => {
      this.drawLabels()
      this.emitTracked()
      this.countryLabels.rendered()
    })
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
      const hit = this.hitAt(map, event.point, HOVER_TOLERANCE, AIRPORT_HOVER_TOLERANCE)
      map.getCanvas().style.cursor = hit ? 'pointer' : ''
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
    this.emitTracked()
    // Zincirin ilk adımı: nesne stili (uydu) açılış stilinin yerini hemen alır; adresli stil
    // indirilirken düz arka plan ve uçaklar ekranda kalır.
    this.basemap.start()
    this.frameRequest = requestAnimationFrame(this.frame)
  }

  /**
   * Adımın stilini uygular. Stil adresi burada indirilir (MapLibre'nin adres yüklemesi yerine):
   * atıf yazılabilsin, ülke sınırları kesikli çizgiye çevrilebilsin (D-092) ve başarısız istek
   * zincirde sayılsın diye. Yeni adım bekleyen isteği iptal eder. İstek sürerken ekrandaki stil ve
   * kendi katmanlarımız yerinde kalır.
   */
  private applyBasemap(map: MaplibreMap, step: BasemapStep): void {
    this.styleRequest?.abort()
    this.styleRequest = null
    const { style } = step
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
        this.setBasemapStyle(map, prepareFetchedStyle(loaded, step))
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
    this.countryLabels.detached()
    this.styleKind = 'basemap'
    map.setStyle(withMapFonts(style, window.location.origin), { diff: false })
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
   * İkonlar, kaynaklar ve katmanlar (alttan üste: ülke adları, havalimanları, iz, uçaklar;
   * `overlayLayers`). Her stil değişiminden sonra yeniden eklenir; ikonlar katmandan önce eklenir.
   * Ülke adları güncel ayarla (görünürlük, dar harita, dil) kurulur.
   */
  private installOverlays(map: MaplibreMap): void {
    this.icons ??= renderAircraftIcons(window.devicePixelRatio)
    this.pin ??= renderAirportPin(window.devicePixelRatio)
    for (const { id, image, pixelRatio } of [...this.icons, this.pin]) {
      if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio })
    }
    const sources = [
      [AIRPORT_SOURCE_ID, airportCollection(this.drawn)],
      [TRAIL_SOURCE_ID, EMPTY_COLLECTION],
      [AIRCRAFT_SOURCE_ID, EMPTY_COLLECTION],
    ] as const
    for (const [id, data] of sources) {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data })
    }
    const countries = this.countryLabels.current
    const countrySource = map.getSource<GeoJSONSource>(COUNTRY_LABEL_SOURCE_ID)
    if (countrySource) {
      countrySource.setData(this.countryLabels.sourceData())
    } else {
      map.addSource(COUNTRY_LABEL_SOURCE_ID, {
        type: 'geojson',
        data: this.countryLabels.sourceData(),
        maxzoom: COUNTRY_LABEL_SOURCE_MAX_ZOOM,
      })
    }
    const layers = overlayLayers({
      compact: countries.compact,
      visible: countries.mode === 'shown',
    })
    for (const layer of layers) {
      if (!map.getLayer(layer.id)) map.addLayer(layer as AddLayerObject)
    }
    this.countryLabels.installed()
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
   * Gösterim konumları, kaynak verileri ve "Uçağı ortala". Kaynak yalnızca küme, depo sürümü,
   * çizimi etkileyen durum ya da bir simgenin saydamlık adımı değişince (seyrek veri, D-122) ya da
   * bir simge ekranda en az `MIN_UPLOAD_SHIFT_PX` kayınca yeniden yüklenir; düşük yakınlaştırmada
   * seyirdeki uçak saniyelerce bir pikseli aşmaz. Tahmin ufku ve soluklaşma API'nin yaş
   * penceresinden gelir (`motionPolicy`).
   */
  private tick(now: number): void {
    const map = this.map
    if (!map || !this.overlaysReady) return
    const { store } = this.options
    const aircraft = store.list()
    const setChanged = this.motion.update(aircraft, now, motionPolicy(store.status))
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
    return mapPadding(this.state.insets)
  }

  /**
   * Panel payını (dar ekranda alttaki kart, geniş ekranda soldaki kart) haritaya verir: merkezdeki
   * nokta görünür bölgenin ortasına kayar. Uçuş ya da sürükleme sürerken beklenir; `jumpTo`/`easeTo`
   * süren hareketi keserdi.
   */
  private applyPadding(): void {
    const map = this.map
    if (!map) return
    this.paddingPending = false
    const padding = this.padding()
    const current = map.getPadding()
    if (current.bottom === padding.bottom && current.left === padding.left) return
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

  /**
   * Noktadaki uçak simgeleri (çizim sırasının tersiyle, üstteki önce): havadaki ve yerdeki ilk
   * uçak ayrı döner. `tolerance` 0 ise tam isabet; değilse kare dokunma payı.
   */
  private aircraftAt(
    map: MaplibreMap,
    point: { x: number; y: number },
    tolerance: number,
  ): { airborne: string | null; ground: string | null } {
    const found: { airborne: string | null; ground: string | null } = {
      airborne: null,
      ground: null,
    }
    if (!this.overlaysReady || !map.getLayer(AIRCRAFT_LAYER_ID)) return found
    const features = map.queryRenderedFeatures(
      tolerance > 0
        ? [
            [point.x - tolerance, point.y - tolerance],
            [point.x + tolerance, point.y + tolerance],
          ]
        : [point.x, point.y],
      { layers: [AIRCRAFT_LAYER_ID] },
    )
    for (const feature of features) {
      const hex: unknown = feature.properties.hex
      if (typeof hex !== 'string') continue
      const onGround = this.options.store.get(hex)?.gnd === true
      if (onGround) found.ground ??= hex
      else found.airborne ??= hex
      if (found.airborne && found.ground) break
    }
    return found
  }

  /**
   * Noktadaki havalimanı pininin ICAO kodu (`tolerance`: pinin kutusuna eklenen pay). Birden çok pin
   * varsa başı noktaya en yakın olan; pinin ucu havalimanı noktasındadır, baş yukarıdadır.
   */
  private airportAt(map: MaplibreMap, point: ScreenPoint, tolerance: number): string | null {
    if (!this.overlaysReady || !map.getLayer(AIRPORT_LAYER_ID)) return null
    const features = map.queryRenderedFeatures(
      tolerance > 0
        ? [
            [point.x - tolerance, point.y - tolerance],
            [point.x + tolerance, point.y + tolerance],
          ]
        : [point.x, point.y],
      { layers: [AIRPORT_LAYER_ID] },
    )
    const scale = iconScaleAt(map.getZoom(), AIRPORT_LAYER.layout['icon-size'])
    let best: { icao: string; distance: number } | null = null
    for (const feature of features) {
      const icao: unknown = feature.properties.icao
      const { geometry } = feature
      if (typeof icao !== 'string' || geometry.type !== 'Point') continue
      const [lon, lat] = geometry.coordinates
      if (lon === undefined || lat === undefined) continue
      const projected = map.project([lon, lat])
      const head = pinGeometry(projected.x, projected.y, scale)
      const distance = Math.hypot(head.headX - point.x, head.headY - point.y)
      if (!best || distance < best.distance) best = { icao, distance }
    }
    return best?.icao ?? null
  }

  /** Noktadaki hedef; öncelik `resolveHit`'tedir. */
  private hitAt(
    map: MaplibreMap,
    point: ScreenPoint,
    tolerance: number,
    airportTolerance: number,
  ): MapHit | null {
    const exact = this.aircraftAt(map, point, 0)
    const near = tolerance > 0 ? this.aircraftAt(map, point, tolerance) : null
    return resolveHit({
      label: this.painter.hitTest(point.x, point.y),
      airborne: exact.airborne,
      chip: this.painter.airportHitTest(point.x, point.y),
      pin: this.airportAt(map, point, airportTolerance),
      ground: exact.ground,
      near: near ? (near.airborne ?? near.ground) : null,
    })
  }

  /**
   * Uçağa ya da etiketine tıklama seçer; havalimanı noktası ya da koduna tıklama havalimanı
   * penceresini açar. Boş haritaya tıklama uçak seçimini değiştirmez, pencereyi kapatır.
   */
  private handleClick(map: MaplibreMap, point: ScreenPoint): void {
    const hit = this.hitAt(map, point, CLICK_TOLERANCE, AIRPORT_CLICK_TOLERANCE)
    if (hit?.kind === 'aircraft') this.options.onSelect(hit.hex)
    else if (hit?.kind === 'airport') this.options.onAirportSelect(hit.icao)
    else this.options.onEmptyClick()
  }

  private emitTracked(): void {
    const tracked = this.tracked
    const map = this.map
    if (!tracked || !map) return
    // Pencerenin dayanağı da kameranın dünya kopyasında (180. meridyen, D-111).
    const { x, y } = map.project([nearestWorldLon(tracked.lon, map.getCenter().lng), tracked.lat])
    const last = tracked.last
    if (
      last &&
      Math.abs(last.x - x) < TRACK_MIN_SHIFT_PX &&
      Math.abs(last.y - y) < TRACK_MIN_SHIFT_PX
    ) {
      return
    }
    tracked.last = { x, y }
    tracked.listener({ x, y })
  }

  private resizeLabels(): void {
    const { container } = this.options
    this.painter.resize(container.clientWidth, container.clientHeight, window.devicePixelRatio)
    // Dar harita sınırı (767 px) geçilince ülke adlarının boyu, yeri ve ilk yakınlaştırması değişir.
    const compact = isCompactMap(container.clientWidth)
    if (compact !== this.countryLabels.current.compact) {
      this.countryLabels.update({ ...this.countryLabels.current, compact })
    }
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
    const selectedHex = this.state.selectedHex
    const settings = this.state.labelSettings
    // Coğrafi ön süzgeç yalnız kodlar yazılacaksa kurulur; pencere `inView`'dan 1 px geniştir.
    const edge = LABEL_MARGIN + 1
    const near = airportChipsEnabled(zoom, settings)
      ? lonLatWindow(map.unproject([-edge, -edge]), map.unproject([width + edge, height + edge]))
      : undefined
    const airports = screenAirports(
      (lngLat) => map.project(lngLat),
      this.drawn,
      zoom,
      settings,
      inView,
      map.getCenter().lng,
      near,
    )
    // İz yalnızca kodların engelidir: kod yazılmayacaksa (Simge, Gizle, uzak görünüm) hesaplanmaz.
    const trail =
      selectedHex !== null && showsAirportChips({ zoom, airports, settings })
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
      settings,
      locale: this.state.locale,
      units: this.state.units,
      pinScale: iconScaleAt(zoom, AIRPORT_LAYER.layout['icon-size']),
      primaryIcao: PRIMARY_AIRPORT_VIEW.icao,
      panels: this.state.panels,
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
