'use client'

import type { UnitSystem } from '@havayolu/i18n'
import type { Airport, Locale } from '@havayolu/shared'
import { useEffect, useEffectEvent, useImperativeHandle, useRef, type Ref } from 'react'
import type { AircraftStore } from '../../lib/live/store'
import type { LabelSettings } from '../../lib/map/label-settings'
import type { Basemap } from '../../lib/map-config'
import { SELECT_MIN_ZOOM, type MapViewport } from './camera'
import { MapController } from './map-controller'
import { supportsWebGL2 } from './webgl'

/** Üst bileşenin haritaya verdiği komutlar (kamera). */
export interface MapViewHandle {
  /** Uçağa uçar; yakınlaştırma en az `minZoom` olur, daha yakınsa korunur. */
  flyTo: (target: { lat: number; lon: number }, minZoom?: number) => void
}

export interface MapViewProps {
  ref?: Ref<MapViewHandle>
  basemap: Basemap
  /** Atıf denetimine her zaman eklenen HTML (canlı veri atfı). */
  customAttribution: string
  /** Harita tuvalinin erişilebilir adı. */
  mapLabel: string
  store: AircraftStore
  airports: readonly Airport[]
  selectedHex: string | null
  following: boolean
  labelSettings: LabelSettings
  locale: Locale
  units: UnitSystem
  /** Haritanın altını örten panelin yüksekliği (dar ekranda bilgi kartı), CSS px. */
  bottomInset: number
  onSelect: (hex: string) => void
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
  mapLabel,
  store,
  airports,
  selectedHex,
  following,
  labelSettings,
  locale,
  units,
  bottomInset,
  onSelect,
  onUserPan,
  onViewportChange,
  onBasemapFailedChange,
  onReady,
  onFailure,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<MapController | null>(null)
  const state = { selectedHex, following, labelSettings, airports, locale, units, bottomInset }
  const stateRef = useRef(state)

  const handleSelect = useEffectEvent((hex: string) => onSelect(hex))
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
      mapLabel,
      store,
      state: stateRef.current,
      onSelect: (hex) => handleSelect(hex),
      onUserPan: () => handleUserPan(),
      onViewportChange: (viewport) => handleViewport(viewport),
      onBasemapFailedChange: (failed) => handleBasemapFailed(failed),
      onReady: () => handleReady(),
      onFailure: (error) => handleFailure(error),
    })
    controllerRef.current = controller
    return () => {
      controllerRef.current = null
      controller.destroy()
    }
  }, [basemap, customAttribution, mapLabel, store])

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (target, minZoom = SELECT_MIN_ZOOM) => controllerRef.current?.flyTo(target, minZoom),
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
