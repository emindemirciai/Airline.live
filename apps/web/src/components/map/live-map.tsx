'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import { DEFAULT_UNIT_SYSTEM, type Messages } from '@havayolu/i18n'
import type { Airport, Locale, PublicAircraft } from '@havayolu/shared'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { fetchAirports, fetchSearch } from '../../lib/live/api'
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
import { ConsentSettingsButton } from '../analytics-consent'
import { mapCustomAttributionHtml } from './attribution'
import {
  SELECT_MIN_ZOOM,
  TURKEY_BOUNDS,
  TURKEY_CENTER,
  TURKEY_ZOOM,
  type MapViewport,
} from './camera'
import { DataAttributionNotice } from './data-attribution'
import { MapView, type MapViewHandle } from './map-view'
import { AircraftTable, InfoCard, LabelSettingsControl, SearchBox, StatusStrip } from './panels'
import { useLabelSettings } from './use-label-settings'
import { useLive } from './use-live'
import { useNow } from './use-now'
import { supportsWebGL2 } from './webgl'

export interface LiveMapProps {
  config: MapConfig
  locale: Locale
  messages: Messages['map']
  /** Paylaşılan bağlantıdaki seçili uçak (`/?hex=`), doğrulanmış. */
  initialHex: string | null
  /**
   * Analiz açıksa (onay bandı var) tercih düğmesinin metni: haritada alt bilgi gizli olduğundan
   * onay harita denetimlerinden geri alınır. Analiz kapalıysa null.
   */
  consentSettingsLabel: string | null
}

/** Harita görünümü gelmeden (WebGL2 yok, harita yükleniyor) abonelik Türkiye için yapılır. */
const INITIAL_VIEWPORT: MapViewport = {
  bounds: TURKEY_BOUNDS,
  center: TURKEY_CENTER,
  zoom: TURKEY_ZOOM,
}

const NO_AIRPORTS: readonly Airport[] = []

/** Bilgi kartının alttan açılan sayfa olduğu genişlik (globals.css ile aynı kırılım). */
const BOTTOM_SHEET_QUERY = '(max-width: 767px)'

/**
 * Alt panellerin atıf satırının üstünde bırakacağı en küçük yükseklik (globals.css
 * `--map-attrib-space`) ve satırla aradaki boşluk. Uzun altlık atfı (Esri) dar ekranda birkaç satıra
 * kırılır; ayrılan yükseklik o zaman ölçülen yüksekliğe göre büyür.
 */
const ATTRIB_MIN_SPACE_PX = 36
const ATTRIB_GAP_PX = 6

const subscribeNever = () => () => {}
const webglServerSnapshot = () => null

/**
 * Canlı harita sayfasının durumu: seçili uçak (adreste `?hex=`), "Uçağı ortala", etiket ayarı
 * (cihazda), altlık hatası, bağlantı durumu ve saniyelik saat. Harita (`MapView`) ve paneller
 * buradan beslenir. Tablo ve kart en fazla saniyede ~2 kez yeniden çizilir; uçakların hareketi
 * React dışında, haritanın çizim döngüsündedir.
 */
export function LiveMap({
  config,
  locale,
  messages,
  initialHex,
  consentSettingsLabel,
}: LiveMapProps) {
  const units = DEFAULT_UNIT_SYSTEM
  const live = useLive(config.wsUrl)
  const { store, setViewport: subscribeViewport } = live
  const now = useNow()
  const [labelSettings, setLabelSettings] = useLabelSettings()
  const webgl = useSyncExternalStore(subscribeNever, supportsWebGL2, webglServerSnapshot)
  const mapRef = useRef<MapViewHandle>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const [selectedHex, setSelectedHex] = useState<string | null>(null)
  const [following, setFollowing] = useState(false)
  const [viewport, setViewport] = useState<MapViewport>(INITIAL_VIEWPORT)
  const [airports, setAirports] = useState<readonly Airport[]>(NO_AIRPORTS)
  const [mapReady, setMapReady] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)
  const [basemapFailed, setBasemapFailed] = useState(false)
  const [heldSelected, setHeldSelected] = useState<TrackedAircraft | null>(null)
  const [bottomInset, setBottomInset] = useState(0)
  const [sharedLink, setSharedLink] = useState<SharedLinkState>(() => initialSharedLink(initialHex))

  /** Seçim (kullanıcının ya da paylaşılan bağlantının); paylaşılan bağlantı süreci biter. */
  const select = useCallback((hex: string | null) => {
    setSelectedHex(hex)
    setSharedLink(SHARED_LINK_DONE)
    if (hex === null) setFollowing(false)
    window.history.replaceState(null, '', hexUrl(window.location.href, hex))
  }, [])

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
  const stopFollowing = useCallback(() => setFollowing(false), [])
  const markReady = useCallback(() => setMapReady(true), [])

  // Harita görünümü gelene kadar (ya da hiç gelmeyecekse) Türkiye'ye abone olunur.
  useEffect(() => {
    subscribeViewport(INITIAL_VIEWPORT.bounds, INITIAL_VIEWPORT.zoom)
  }, [subscribeViewport])

  // Havalimanları bir kez yüklenir; yüklenemezse harita onlarsız çalışır.
  useEffect(() => {
    const controller = new AbortController()
    fetchAirports(config.apiBaseUrl, 'TR', controller.signal).then(
      (response) => setAirports(response.airports),
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

  const customAttribution = mapCustomAttributionHtml(
    config.dataAttribution,
    messages.dataAttributionPrefix,
    messages.termsLink,
  )
  // Seçili uçak görünümün dışına çıkınca abonelikten ve depodan düşer. Kart kullanıcı kapatana kadar
  // son bilinen durumla açık kalır ("Son görülme" ilerler); uçak geri gelince yeniden canlanır.
  // Önceki çizimden türetilen durum (React belgesi: "storing information from previous renders").
  const current = selectedHex === null ? undefined : store.get(selectedHex)
  if (current !== undefined && current !== heldSelected) setHeldSelected(current)
  const selected = current ?? (heldSelected?.hex === selectedHex ? heldSelected : undefined)
  const cardOpen = selected !== undefined

  // Dar ekranda kart haritanın altını örter: yüksekliği haritaya alt boşluk olarak verilir, seçili
  // uçak (ve "Uçağı ortala") kartın üstündeki görünür bölgede kalır.
  useEffect(() => {
    const card = cardRef.current
    const root = card?.parentElement
    if (!cardOpen || !card || !root) {
      setBottomInset(0)
      return
    }
    const sheet = window.matchMedia(BOTTOM_SHEET_QUERY)
    const measure = () => {
      const covered = root.getBoundingClientRect().bottom - card.getBoundingClientRect().top
      setBottomInset(sheet.matches ? Math.max(0, Math.round(covered)) : 0)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(card)
    observer.observe(root)
    sheet.addEventListener('change', measure)
    return () => {
      observer.disconnect()
      sheet.removeEventListener('change', measure)
    }
  }, [cardOpen])
  const { rows, total } = visibleAircraft(store.list(), viewport.bounds, viewport.center)
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
          mapLabel={messages.mapLabel}
          store={store}
          airports={airports}
          selectedHex={selectedHex}
          following={following}
          labelSettings={labelSettings}
          locale={locale}
          units={units}
          bottomInset={bottomInset}
          onSelect={select}
          onUserPan={stopFollowing}
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
      <div className="live-map__search">
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
        <div ref={cardRef} className="live-map__card">
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
      <div className="live-map__table">
        <AircraftTable
          rows={rows}
          total={total}
          selectedHex={selectedHex}
          onSelect={selectFromTable}
          locale={locale}
          units={units}
          messages={messages.table}
        />
      </div>
      <div className="live-map__controls">
        {consentSettingsLabel ? (
          <ConsentSettingsButton label={consentSettingsLabel} className="map-button" />
        ) : null}
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
        />
      )}
    </div>
  )
}
