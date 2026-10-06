'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import { DEFAULT_UNIT_SYSTEM, type Messages } from '@havayolu/i18n'
import { mapShownAirports, type Locale, type PublicAircraft } from '@havayolu/shared'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { whenIdle } from '../../lib/idle'
import { fetchSearch } from '../../lib/live/api'
import { monotonicNow } from '../../lib/live/clock'
import type { TrackedAircraft } from '../../lib/live/store'
import { visibleAircraft } from '../../lib/live/visible'
import type { MapConfig } from '../../lib/map-config'
import {
  SHARED_LINK_DONE,
  afterSearch,
  afterStore,
  initialSharedLink,
  pendingHex,
  type SharedLinkState,
} from '../../lib/map/shared-link'
import { hexUrl } from '../../lib/map/url-state'
import { localePath } from '../../lib/locale-routing'
import { TERMS_PATH } from '../../lib/terms'
import { useNow, useWallNow } from '../../lib/use-now'
import { WallClock } from '../../lib/wall-clock'
import { ConsentSettingsButton } from '../analytics-consent'
import {
  airportLinkCenter,
  airportsInView,
  fetchMapAirports,
  type MapAirport,
} from './airport-data'
import {
  mapCustomAttributionHtml,
  siteCredit as buildSiteCredit,
  siteCreditHtml,
  type SiteVersion,
} from './attribution'
import {
  AIRPORT_MIN_ZOOM,
  INITIAL_BOUNDS,
  INITIAL_MAX_ZOOM,
  PRIMARY_AIRPORT_VIEW,
  SELECT_MIN_ZOOM,
  type MapViewport,
} from './camera'
import { AirportPopupUnavailable, withChunkFallback } from './chunk-fallback'
import { DataAttributionNotice } from './data-attribution'
import { NO_INSETS, type MapInsets } from './map-controller'
import { MapView, type MapViewHandle } from './map-view'
import {
  AircraftTable,
  AirportListControl,
  InfoCard,
  LabelSettingsControl,
  SearchBox,
  StatusStrip,
  preloadAirportListPanel,
} from './panels'
import { aircraftPlace } from './panels/aircraft-place'
import { useAircraftListOpen } from './use-aircraft-list-open'
import { useAirportWeather } from './use-airport-weather'
import { useFlightPhases } from './use-flight-phases'
import { useLabelSettings } from './use-label-settings'
import { useLive } from './use-live'
import { useMapPanels } from './use-map-panels'
import { supportsWebGL2 } from './webgl'

/**
 * Havalimanı penceresi ayrı parçadadır (D-101): görünen ad tabloları (`airportDisplayName`, 4.
 * halkada ~165 KB kaynak) haritanın ilk paketine girmez. Parça harita hazır olunca boşta önceden
 * istenir (aşağıdaki efekt); seçim ondan önce gelirse o sırada yüklenir. Yüklenemezse
 * (yayından sonra eski sekme, kesik bağlantı) pencerenin yerine yedek not çizilir
 * (`chunk-fallback.tsx`), harita hata ekranına düşmez. Yüklenirken yalnız pencerenin yeri boş kalır
 * (`loading`, kendi Suspense sınırı); sınır olmasaydı ilk seçim kök kabukta askıya alınır, parça
 * gelene kadar tablo, kart ve saat donardı.
 */
const loadAirportPopup = withChunkFallback(
  () => import('./airport-popup').then((module) => module.AirportPopup),
  AirportPopupUnavailable,
  'Airport popup',
)
const AirportPopup = dynamic(() => loadAirportPopup(), { loading: () => null })

export interface LiveMapProps {
  config: MapConfig
  locale: Locale
  messages: Messages['map']
  /** Havalimanı penceresindeki hava durumu metinleri (havalimanı sayfasıyla aynı sözcükler). */
  weatherMessages: Messages['weather']
  /** Paylaşılan bağlantıdaki seçili uçak (`/?hex=`), doğrulanmış. */
  initialHex: string | null
  /**
   * Açılışta ortalanacak havalimanı (`/?havalimani=LTFM`, ICAO ya da IATA), biçimi doğrulanmış.
   * Paylaşılan uçak (`?hex=`) varsa ya da kullanıcı haritayı önce kendisi kullanırsa yok sayılır.
   */
  initialAirport: string | null
  /**
   * Analiz açıksa (onay bandı var) tercih düğmesinin metni: haritada alt bilgi gizli olduğundan
   * onay harita denetimlerinden geri alınır. Analiz kapalıysa null.
   */
  consentSettingsLabel: string | null
  /**
   * Sitenin adı ve sürümü (alt bilgidekiyle aynı: `appName(env)`, `currentVersion()`). Harita
   * sayfasında alt bilgi gizli olduğundan atıf şeridinin başında künye olarak gösterilir (D-089).
   */
  site: SiteVersion
}

/** Künyenin bağlantısı: Yenilikler sayfası (sayfanın dilinde, `localePath`). */
const CHANGELOG_PATH = '/yenilikler'

/**
 * Harita görünümü gelmeden (WebGL2 yok, harita yükleniyor) abonelik açılış görünümünün (IST/LTFM
 * çevresi, D-079) kutusu için yapılır; harita kurulunca gerçek görünüm izlenir.
 */
const INITIAL_VIEWPORT: MapViewport = {
  bounds: INITIAL_BOUNDS,
  center: { lat: PRIMARY_AIRPORT_VIEW.lat, lon: PRIMARY_AIRPORT_VIEW.lon },
  zoom: INITIAL_MAX_ZOOM,
}

const NO_AIRPORTS: readonly MapAirport[] = []

/** Bilgi kartının alttan açılan sayfa olduğu genişlik (globals.css ile aynı kırılım). */
const BOTTOM_SHEET_QUERY = '(max-width: 767px)'

/**
 * Alt panellerin atıf satırının üstünde bırakacağı en küçük yükseklik (globals.css
 * `--map-attrib-space`) ve satırla aradaki boşluk. Uzun altlık atfı (Esri) dar ekranda birkaç satıra
 * kırılır; ayrılan yükseklik o zaman ölçülen yüksekliğe göre büyür.
 */
const ATTRIB_MIN_SPACE_PX = 36
const ATTRIB_GAP_PX = 6

/**
 * Geniş ekranda soldaki bilgi kartı haritanın ortasına bu kadar yaklaşınca (ortadaki uçak simgesi
 * ve etiketi) harita sola pay alır; pay, kartın sağ kenarı ve aradaki boşluktur (D-085).
 */
const CARD_CENTER_CLEARANCE_PX = 24
const CARD_INSET_GAP_PX = 8

/**
 * Haritayı örten panelin payı. Dar ekranda alttan açılan kart ya da havalimanı penceresi haritanın
 * altını örter; geniş ekranda soldaki bilgi kartı ancak haritanın ortasına uzanırsa (768 px'e yakın
 * genişlikte) sola pay verir. Ölçüler harita köküne (`.live-map`) göredir.
 */
function panelInsets(root: DOMRect, panel: DOMRect, sheet: boolean, leftCard: boolean): MapInsets {
  if (sheet) return { bottom: Math.max(0, Math.round(root.bottom - panel.top)), left: 0 }
  if (!leftCard) return NO_INSETS
  const cardRight = panel.right - root.left
  if (cardRight + CARD_CENTER_CLEARANCE_PX <= root.width / 2) return NO_INSETS
  return { bottom: 0, left: Math.round(cardRight + CARD_INSET_GAP_PX) }
}

const subscribeNever = () => () => {}
const webglServerSnapshot = () => null

function subscribeSheet(onChange: () => void): () => void {
  const query = window.matchMedia(BOTTOM_SHEET_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const sheetSnapshot = () => window.matchMedia(BOTTOM_SHEET_QUERY).matches
const sheetServerSnapshot = () => false

/**
 * Canlı harita sayfasının durumu: seçili uçak (adreste `?hex=`), "Uçağı ortala", açık havalimanı
 * penceresi, etiket ayarı ve geniş ekranda uçak listesinin daraltılmış hâli (cihazda), listenin
 * tahmini durumları, altlık hatası, bağlantı durumu ve saniyelik saat. Harita (`MapView`) ve paneller
 * buradan beslenir. Tablo ve kart en fazla saniyede ~2 kez yeniden çizilir; uçakların hareketi React
 * dışında, haritanın çizim döngüsündedir.
 *
 * Yerleşim (D-085): solda arama, durum şeridi ve bilgi kartı (`.live-map__left`); sağ üstte uçak
 * listesi (telefonda sol altta, düğmeyle açılır); sağ altta denetimler. Havalimanı penceresi
 * ve seçili uçağın etiketi `data-map-panel` taşıyan panelleri örtmeyen yeri seçer.
 *
 * Uçak bilgi kartı ile havalimanı penceresi aynı anda açık olmaz: uçak seçmek pencereyi kapatır,
 * havalimanına tıklamak uçak seçimini kaldırır.
 */
export function LiveMap({
  config,
  locale,
  messages,
  weatherMessages,
  initialHex,
  initialAirport,
  consentSettingsLabel,
  site,
}: LiveMapProps) {
  const units = DEFAULT_UNIT_SYSTEM
  const live = useLive(config.wsUrl)
  const { store, setViewport: subscribeViewport } = live
  const now = useNow()
  // Havalimanı penceresinin duvar saati, cihaz kipinde (lib/wall-clock.ts): cihaz saati hava yanıtının
  // `generatedAt`'ine göre akla yatkınsa (geride değil, en çok 10 dk ileride) o, değilse sunucu
  // saati. Önbellekten gelen eski `generatedAt` yerel saati ve gözlem yaşını geride bırakmaz; cihaz
  // uyusa ya da saati yanlış olsa da değerler doğrudur.
  const [weatherClock] = useState(() => WallClock.preferDevice())
  const popupNow = useWallNow(weatherClock, 1_000)
  const [labelSettings, setLabelSettings] = useLabelSettings()
  const [listOpen, setListOpen] = useAircraftListOpen()
  const webgl = useSyncExternalStore(subscribeNever, supportsWebGL2, webglServerSnapshot)
  const mapRef = useRef<MapViewHandle>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const [selectedHex, setSelectedHex] = useState<string | null>(null)
  const [following, setFollowing] = useState(false)
  const [viewport, setViewport] = useState<MapViewport>(INITIAL_VIEWPORT)
  /** Listelenen havalimanlarının hepsi, askerî üsler dahil (D-103). */
  const [airports, setAirports] = useState<readonly MapAirport[]>(NO_AIRPORTS)
  // Haritada gösterilenler (D-103): askerî hava üslerinin pini, kodu, penceresi ve "Havalimanları"
  // listesinde satırı yoktur. Liste değişmedikçe aynı dizi (harita kaynağı yalnız o zaman yenilenir).
  const shownAirports = useMemo(() => mapShownAirports(airports), [airports])
  /** Açık havalimanı penceresinin ICAO kodu. */
  const [popupIcao, setPopupIcao] = useState<string | null>(null)
  const sheetLayout = useSyncExternalStore(subscribeSheet, sheetSnapshot, sheetServerSnapshot)
  const [mapReady, setMapReady] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)
  const [basemapFailed, setBasemapFailed] = useState(false)
  const [heldSelected, setHeldSelected] = useState<TrackedAircraft | null>(null)
  const [insets, setInsets] = useState<MapInsets>(NO_INSETS)
  const [sharedLink, setSharedLink] = useState<SharedLinkState>(() => initialSharedLink(initialHex))
  // `?havalimani=` hedefi havalimanı listesi gelince bir kez uygulanır; seçim ya da sürükleme iptal eder.
  const pendingAirportRef = useRef<string | null>(initialHex === null ? initialAirport : null)

  /**
   * Seçim (kullanıcının ya da paylaşılan bağlantının); paylaşılan bağlantı süreci biter. Uçak seçmek
   * havalimanı penceresini kapatır.
   */
  const select = useCallback((hex: string | null) => {
    setSelectedHex(hex)
    setSharedLink(SHARED_LINK_DONE)
    pendingAirportRef.current = null
    if (hex === null) setFollowing(false)
    else setPopupIcao(null)
    window.history.replaceState(null, '', hexUrl(window.location.href, hex))
  }, [])

  /** Havalimanı penceresini açar (tek pencere); uçak seçimi ve bilgi kartı kapanır. */
  const openAirport = useCallback(
    (icao: string) => {
      select(null)
      setPopupIcao(icao)
    },
    [select],
  )
  const closeAirport = useCallback(() => setPopupIcao(null), [])

  /** Arama sonucu ya da paylaşılan bağlantı: uçak depoya eklenir (görünüm dışında olabilir). */
  const showAircraft = useCallback(
    (ac: PublicAircraft) => {
      store.upsert(ac, monotonicNow())
      select(ac.hex)
      const shown = store.get(ac.hex) ?? ac
      mapRef.current?.flyTo({ lat: shown.lat, lon: shown.lon }, SELECT_MIN_ZOOM)
    },
    [select, store],
  )

  const selectFromTable = useCallback(
    (hex: string) => {
      select(hex)
      const ac = store.get(hex)
      if (ac) mapRef.current?.flyTo({ lat: ac.lat, lon: ac.lon }, SELECT_MIN_ZOOM)
    },
    [select, store],
  )

  const handleViewportChange = useCallback(
    (next: MapViewport) => {
      setViewport(next)
      subscribeViewport(next.bounds, next.zoom)
    },
    [subscribeViewport],
  )

  const handleMapFailure = useCallback((error: unknown) => {
    console.error('Live map could not start', error)
    setMapReady(true)
    setMapFailed(true)
    setBasemapFailed(true)
  }, [])

  const closeCard = useCallback(() => select(null), [select])
  const toggleFollow = useCallback(() => setFollowing((on) => !on), [])
  const handleUserPan = useCallback(() => {
    setFollowing(false)
    pendingAirportRef.current = null
  }, [])
  const markReady = useCallback(() => setMapReady(true), [])

  // Pencerenin ve "Havalimanları" panelinin parçaları harita hazır olunca (ya da WebGL2 yoksa)
  // boşta önceden istenir (D-101): ilk paketin dışında kalırlar ama sayfayı veren yayından gelirler
  // (yayından sonra açık kalan sekmede eski parça istenmez) ve ilk seçim parçayı beklemez.
  const mapSettled = webgl === false || mapReady
  useEffect(() => {
    if (!mapSettled) return
    return whenIdle(() => {
      void loadAirportPopup()
      preloadAirportListPanel()
    })
  }, [mapSettled])

  // Harita görünümü gelene kadar (ya da hiç gelmeyecekse) açılış görünümüne abone olunur.
  useEffect(() => {
    subscribeViewport(INITIAL_VIEWPORT.bounds, INITIAL_VIEWPORT.zoom)
  }, [subscribeViewport])

  // Listelenen havalimanları (Türkiye ve yakın ülkeler, D-080; pistleriyle, havalimanı penceresi
  // için) bir kez yüklenir; yüklenemezse harita onlarsız çalışır. `?havalimani=` hedefi listede
  // varsa harita havalimanı merkezine gider (harita henüz kurulmadıysa doğrudan orada açılır).
  // Askerî üs de bulunur (D-103): harita yine oraya gider, ama üssün pini ve penceresi yoktur.
  useEffect(() => {
    const controller = new AbortController()
    fetchMapAirports(config.apiBaseUrl, controller.signal).then(
      (list) => {
        if (controller.signal.aborted) return
        setAirports(list)
        const code = pendingAirportRef.current
        pendingAirportRef.current = null
        const center = code === null ? null : airportLinkCenter(list, code)
        if (center) mapRef.current?.flyTo(center, AIRPORT_MIN_ZOOM)
      },
      (error: unknown) => {
        if (!controller.signal.aborted) console.warn('Airports could not be loaded', error)
      },
    )
    return () => controller.abort()
  }, [config.apiBaseUrl])

  // Paylaşılan bağlantı (`/?hex=`), 1. adım: uçak canlı önbellekte aranır (lib/map/shared-link.ts).
  const searchHex = sharedLink.phase === 'search' ? sharedLink.hex : null
  const searchAttempt = sharedLink.phase === 'search' ? sharedLink.attempt : 0
  useEffect(() => {
    if (searchHex === null) return
    const controller = new AbortController()
    // Arama bulamadı ya da hata verdi: uçak canlı akışla depoya gelmiş olabilir (görünümde).
    const missed = () => {
      const inStore = store.get(searchHex)
      if (inStore) showAircraft(inStore)
      else
        setSharedLink((state) => afterStore(afterSearch(state, false), false, store.seq !== null))
    }
    fetchSearch(config.apiBaseUrl, searchHex, controller.signal).then(
      (response) => {
        if (controller.signal.aborted) return
        const hit = response.results.find((ac) => ac.hex === searchHex)
        if (hit) showAircraft(hit)
        else missed()
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        console.warn('Shared aircraft could not be loaded', error)
        missed()
      },
    )
    return () => controller.abort()
  }, [config.apiBaseUrl, searchHex, searchAttempt, showAircraft, store])

  // 2. adım: depo her değiştiğinde (tam görüntü, fark) uçak aranır; geldiyse seçilir. İlk tam
  // görüntüde de yoksa arama bir kez yinelenir, sonra "bulunamadı" gösterilir.
  const waitingHex = pendingHex(sharedLink)
  useEffect(() => {
    if (waitingHex === null) return
    return store.subscribe(() => {
      const ac = store.get(waitingHex)
      if (ac) {
        select(ac.hex)
        mapRef.current?.flyTo({ lat: ac.lat, lon: ac.lon }, SELECT_MIN_ZOOM)
        return
      }
      setSharedLink((state) => afterStore(state, false, store.seq !== null))
    })
  }, [waitingHex, store, select])

  const termsHref = localePath(locale, TERMS_PATH)
  const customAttribution = mapCustomAttributionHtml(
    config.dataAttribution,
    messages.dataAttributionPrefix,
    messages.termsLink,
    termsHref,
  )
  // Atıf şeridinin başındaki künye (D-089): "havayolu v0.16.1", Yenilikler sayfasına gider.
  const credit = buildSiteCredit(site, localePath(locale, CHANGELOG_PATH), messages.siteCreditLabel)
  const creditHtml = siteCreditHtml(credit)
  // Seçili uçak görünümün dışına çıkınca abonelikten ve depodan düşer. Kart kullanıcı kapatana kadar
  // son bilinen durumla açık kalır ("Son görülme" ilerler); uçak geri gelince yeniden canlanır.
  // Önceki çizimden türetilen durum (React belgesi: "storing information from previous renders").
  const current = selectedHex === null ? undefined : store.get(selectedHex)
  if (current !== undefined && current !== heldSelected) setHeldSelected(current)
  const selected = current ?? (heldSelected?.hex === selectedHex ? heldSelected : undefined)
  const cardOpen = selected !== undefined
  const popupAirport =
    popupIcao === null ? undefined : shownAirports.find((airport) => airport.icao === popupIcao)
  const popupOpen = popupAirport !== undefined
  // Pencere yalnız kendi havalimanının havasını ister (D-090); kapalıyken istek yok.
  const weather = useAirportWeather(config.apiBaseUrl, popupAirport?.icao ?? null, weatherClock)
  // Listenin tahmini durumları (D-085): depo değiştikçe sınıflandırılır, çizimde yalnızca okunur.
  // Bütün liste: askerî üsse yaklaşan uçağın durumu ve konumu da doğru yere göre yazılır (D-103).
  const phases = useFlightPhases(store, airports)
  // Haritanın üstündeki paneller: seçili uçağın etiketi bunların altında kalmaz (D-085). Kart açılıp
  // kapanınca panel kümesi değişir.
  const panels = useMapPanels(rootRef, cardOpen)

  // Dar ekranda kart ya da havalimanı penceresi haritanın altını örter: yüksekliği haritaya alt
  // boşluk olarak verilir, seçili uçak (ve "Uçağı ortala") kartın üstündeki görünür bölgede kalır.
  // Geniş ekranda kart soldadır (D-085); haritanın ortasını örtecekse harita sola pay alır. Kök her
  // zaman `.live-map`'tir: kart sol sütunun (`.live-map__left`) içindedir.
  useEffect(() => {
    const panel = cardOpen ? cardRef.current : popupOpen ? popupRef.current : null
    const root = rootRef.current
    if (!panel || !root) {
      setInsets(NO_INSETS)
      return
    }
    const leftCard = panel === cardRef.current
    const sheet = window.matchMedia(BOTTOM_SHEET_QUERY)
    const measure = () => {
      const next = panelInsets(
        root.getBoundingClientRect(),
        panel.getBoundingClientRect(),
        sheet.matches,
        leftCard,
      )
      setInsets((previous) =>
        previous.bottom === next.bottom && previous.left === next.left ? previous : next,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    observer.observe(root)
    sheet.addEventListener('change', measure)
    return () => {
      observer.disconnect()
      sheet.removeEventListener('change', measure)
    }
  }, [cardOpen, popupOpen])
  const { rows, total } = visibleAircraft(store.list(), viewport.bounds, viewport.center)
  const placeOf = (ac: TrackedAircraft) =>
    aircraftPlace(ac, phases.get(ac.hex), now, messages.table, { locale, units })
  const showLoading = webgl !== false && !mapReady
  // Atıf, harita çizildiğinde MapLibre'nin atıf kutusundadır; harita yokken (yükleniyor, WebGL2
  // yok, kurulamadı) panellerdeki canlı veri için aynı atıf sayfada gösterilir.
  const attributionInMap = webgl === true && mapReady && !mapFailed

  // Atıf satırı her zaman panellerin üstündedir (z-index). Dar ekranda birkaç satıra kırılınca alt
  // paneller (liste, denetimler, kart) onu örtmesin, o da onları örtmesin diye yüksekliği ölçülür.
  useEffect(() => {
    const root = rootRef.current
    const target = root?.querySelector<HTMLElement>(
      attributionInMap ? '.maplibregl-ctrl-attrib' : '.live-map__attrib',
    )
    if (!root || !target) return
    const measure = () => {
      const height = Math.ceil(target.getBoundingClientRect().height)
      const space = Math.max(ATTRIB_MIN_SPACE_PX, height + ATTRIB_GAP_PX)
      root.style.setProperty('--map-attrib-space', `${space}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(target)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--map-attrib-space')
    }
  }, [attributionInMap])

  return (
    <div ref={rootRef} className="live-map" data-map-ready={mapReady ? 'true' : 'false'}>
      {webgl === false ? (
        <p className="live-map__message" role="status">
          {messages.webglUnavailable}
        </p>
      ) : (
        <MapView
          ref={mapRef}
          basemap={config.basemap}
          customAttribution={customAttribution}
          siteCredit={creditHtml}
          mapLabel={messages.mapLabel}
          store={store}
          airports={shownAirports}
          selectedHex={selectedHex}
          following={following}
          labelSettings={labelSettings}
          locale={locale}
          units={units}
          insets={insets}
          panels={panels}
          onSelect={select}
          onAirportSelect={openAirport}
          onEmptyClick={closeAirport}
          onUserPan={handleUserPan}
          onViewportChange={handleViewportChange}
          onBasemapFailedChange={setBasemapFailed}
          onReady={markReady}
          onFailure={handleMapFailure}
        />
      )}
      {showLoading ? (
        <p className="live-map__message" role="status">
          {messages.loading}
        </p>
      ) : null}
      {/*
       * Sol sütun (D-085): arama, durum şeridi ve seçili uçağın kartı. Konumlandırılmamış, akıştaki
       * tek öğedir; haritanın öteki bütün katmanları `position: absolute` olmalıdır (globals.css).
       */}
      <div className="live-map__left">
        <div className="live-map__search" data-map-panel="">
          <SearchBox
            apiBaseUrl={config.apiBaseUrl}
            messages={messages.search}
            onFound={showAircraft}
            notice={sharedLink.phase === 'missing' ? messages.search.notFound : null}
          />
        </div>
        <div className="live-map__status">
          <StatusStrip
            status={store.status}
            coverage={store.coverage}
            connection={live.connection}
            basemapFailed={basemapFailed}
            now={now}
            messages={messages.status}
          />
        </div>
        {selected ? (
          <div ref={cardRef} className="live-map__card" data-map-panel="">
            <InfoCard
              aircraft={selected}
              now={now}
              locale={locale}
              units={units}
              following={following}
              onToggleFollow={toggleFollow}
              onClose={closeCard}
              messages={messages.card}
            />
          </div>
        ) : null}
      </div>
      {popupAirport && popupNow !== null ? (
        <div ref={popupRef} className="live-map__popup">
          <AirportPopup
            airport={popupAirport}
            weather={weather}
            now={popupNow}
            locale={locale}
            sheet={sheetLayout}
            mapRef={mapRef}
            onClose={closeAirport}
            messages={messages.airportPopup}
            weatherMessages={weatherMessages}
          />
        </div>
      ) : null}
      <div className="live-map__table" data-map-panel="">
        <AircraftTable
          rows={rows}
          total={total}
          selectedHex={selectedHex}
          onSelect={selectFromTable}
          placeOf={placeOf}
          sheet={sheetLayout}
          wideOpen={listOpen}
          onWideOpenChange={setListOpen}
          locale={locale}
          units={units}
          messages={messages.table}
        />
      </div>
      <div className="live-map__controls" data-map-panel="">
        {consentSettingsLabel ? (
          <ConsentSettingsButton label={consentSettingsLabel} className="map-button" />
        ) : null}
        <AirportListControl
          airports={airportsInView(shownAirports, viewport)}
          locale={locale}
          onSelect={openAirport}
          messages={messages.airportList}
        />
        <LabelSettingsControl
          value={labelSettings}
          onChange={setLabelSettings}
          messages={messages.labels}
        />
      </div>
      {attributionInMap ? null : (
        <DataAttributionNotice
          attribution={config.dataAttribution}
          prefix={messages.dataAttributionPrefix}
          termsLabel={messages.termsLink}
          termsHref={termsHref}
          siteCredit={credit}
        />
      )}
    </div>
  )
}
