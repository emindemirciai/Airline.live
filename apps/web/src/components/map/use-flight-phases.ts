'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { AircraftStore } from '../../lib/live/store'
import { FlightPhaseTracker, type PhaseAirportInput } from '../../lib/map/flight-phase'

/**
 * Uçak listesinin tahmini durumları (D-085). İzleyici depoya abone olur ve her değişiklikte (WebSocket
 * tam görüntüsü ve farkı, arama sonucu, budama) yeni örneği olan uçakları sınıflandırır: React
 * çiziminden önce, çizim döngüsünden (her kare) bağımsız. Çizim yalnızca `tracker.get(hex)` okur;
 * tablo ve kart zaten `useLive` ile seyreltilmiş sürümde yeniden çizilir.
 *
 * Havalimanları değişince (sayfa açılışında bir kez yüklenir) izleyici bütün uçakları yeniden
 * sınıflandırır ve bileşen bir kez yeniden çizilir; yoksa durumlar bir sonraki depo değişikliğine
 * kadar koordinat kalırdı.
 */
export function useFlightPhases(
  store: AircraftStore,
  airports: readonly PhaseAirportInput[],
): FlightPhaseTracker {
  const [tracker] = useState(() => new FlightPhaseTracker())

  useEffect(() => {
    const observe = () => tracker.observe(store.list())
    observe()
    return store.subscribe(observe)
  }, [store, tracker])

  useEffect(() => {
    tracker.setAirports(airports)
    tracker.observe(store.list())
  }, [airports, store, tracker])

  useSyncExternalStore(
    tracker.subscribeAirports,
    () => tracker.airportsRevision,
    () => 0,
  )
  return tracker
}
