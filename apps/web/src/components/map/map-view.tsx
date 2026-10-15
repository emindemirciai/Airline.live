'use client'

import type { UnitSystem } from '@havayolu/i18n'
import type { Airport, Locale } from '@havayolu/shared'
import { useEffect, useEffectEvent, useImperativeHandle, useRef, type Ref } from 'react'
import type { AircraftStore } from '../../lib/live/store'
import type { ScreenRect } from '../../lib/map/label-layout'
import type { LabelSettings } from '../../lib/map/label-settings'
import type { Basemap } from '../../lib/map-config'
import { SELECT_MIN_ZOOM, type MapViewport } from './camera'
import { MapController, type MapInsets, type ScreenPoint } from './map-controller'
import { supportsWebGL2 } from './webgl'

/** Üst bileşenin haritaya verdiği komutlar (kamera, havalimanı penceresinin dayanağı). */
export interface MapViewHandle {
  /** Uçağa uçar; yakınlaştırma en az `minZoom` olur, daha yakınsa korunur. */
  flyTo: (target: { lat: number; lon: number }, minZoom?: number) => void
  /**
   * Noktanın ekrandaki yerini izler (`MapController.trackPoint`); harita yeniden kurulursa izleme
   * yeni haritaya geçer. Dönen işlev izlemeyi bırakır.
   */
  trackPoint: (
    target: { lat: number; lon: number },
    listener: (point: ScreenPoint) => void,
  ) => () => void
}

export interface MapViewProps {
  ref?: Ref<MapViewHandle>
  basemap: Basemap
  /** Atıf denetimine her zaman eklenen HTML (canlı veri atfı). */
  customAttribution: string
  /** Atıf şeridinin başındaki site künyesi, HTML (`siteCreditHtml`, D-089). */
  siteCredit: string
  /** Harita tuvalinin erişilebilir adı. */
  mapLabel: string
  store: AircraftStore
  airports: readonly Airport[]
  /** Açık havalimanı penceresinin ICAO kodu: simgeler gizliyken bu havalimanı çizilir (D-113). */
  popupIcao: string | null
  selectedHex: string | null
  following: boolean
  labelSettings: LabelSettings
  locale: Locale
  units: UnitSystem
  /** Haritayı örten panellerin payı (dar ekranda alttaki kart, geniş ekranda soldaki kart), CSS px. */
  insets: MapInsets
  /** Haritanın üstündeki opak paneller (haritaya göre, CSS px): seçili etiket bunları örtmez. */
  panels: readonly ScreenRect[]
  onSelect: (hex: string) => void
  onAirportSelect: (icao: string) => void
  onEmptyClick: () => void
  onUserPan: () => void
  onViewportChange: (viewport: MapViewport) => void
  onBasemapFailedChange: (failed: boolean) => void
  onReady: () => void
  onFailure: (error: unknown) => void
}

/**
 * MapLibre haritası ve etiket tuvali. Harita nesnesi React durumunda tutulmaz; kurulum, çizim
 * döngüsü ve olaylar `MapController`'dadır. Bileşen yalnızca kapsayıcıları çizer, denetleyiciyi
 * kurar, prop değişikliklerini iletir ve sökülünce haritayı kaldırır.
 */
export function MapView({
  ref,
  basemap,
  customAttribution,
  siteCredit,
  mapLabel,
  store,
  airports,
  popupIcao,
  selectedHex,
  following,
  labelSettings,
  locale,
  units,
  insets,
  panels,
  onSelect,
  onAirportSelect,
  onEmptyClick,
  onUserPan,
  onViewportChange,
  onBasemapFailedChange,
  onReady,
  onFailure,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<MapController | null>(null)
  const trackedRef = useRef<{
    target: { lat: number; lon: number }
    listener: (point: ScreenPoint) => void
  } | null>(null)
  const state = {
    selectedHex,
    following,
    labelSettings,
    airports,
    popupIcao,
    locale,
    units,
    insets,
    panels,
  }
  const stateRef = useRef(state)

  const handleSelect = useEffectEvent((hex: string) => onSelect(hex))
  const handleAirportSelect = useEffectEvent((icao: string) => onAirportSelect(icao))
  const handleEmptyClick = useEffectEvent(() => onEmptyClick())
  const handleUserPan = useEffectEvent(() => onUserPan())
  const handleViewport = useEffectEvent((viewport: MapViewport) => onViewportChange(viewport))
  const handleBasemapFailed = useEffectEvent((failed: boolean) => onBasemapFailedChange(failed))
  const handleReady = useEffectEvent(() => onReady())
  const handleFailure = useEffectEvent((error: unknown) => onFailure(error))

  // Her çizimden sonra: denetleyici en güncel durumu alır (yeniden kurulursa da buradan başlar).
  useEffect(() => {
    stateRef.current = state
    controllerRef.current?.update(state)
  })

  useEffect(() => {
    const container = containerRef.current
    const labelCanvas = labelsRef.current
    if (!container || !labelCanvas || !supportsWebGL2()) return
    const controller = new MapController({
      container,
      labelCanvas,
      basemap,
      customAttribution,
      siteCredit,
      mapLabel,
      store,
      state: stateRef.current,
      onSelect: (hex) => handleSelect(hex),
      onAirportSelect: (icao) => handleAirportSelect(icao),
      onEmptyClick: () => handleEmptyClick(),
      onUserPan: () => handleUserPan(),
      onViewportChange: (viewport) => handleViewport(viewport),
      onBasemapFailedChange: (failed) => handleBasemapFailed(failed),
      onReady: () => handleReady(),
      onFailure: (error) => handleFailure(error),
    })
    controllerRef.current = controller
    const tracked = trackedRef.current
    if (tracked) controller.trackPoint(tracked.target, tracked.listener)
    return () => {
      controllerRef.current = null
      controller.destroy()
    }
  }, [basemap, customAttribution, siteCredit, mapLabel, store])

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (target, minZoom = SELECT_MIN_ZOOM) => controllerRef.current?.flyTo(target, minZoom),
      trackPoint: (target, listener) => {
        const entry = { target, listener }
        trackedRef.current = entry
        controllerRef.current?.trackPoint(target, listener)
        return () => {
          if (trackedRef.current !== entry) return
          trackedRef.current = null
          controllerRef.current?.trackPoint(null)
        }
      },
    }),
    [],
  )

  return (
    <>
      <div ref={containerRef} className="live-map__canvas" />
      <canvas ref={labelsRef} className="live-map__labels" aria-hidden="true" />
    </>
  )
}
