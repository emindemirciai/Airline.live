'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { AircraftStore } from '../../lib/live/store'
import {
  FlightPhaseTracker,
  type PhaseAirportInput,
  type PhaseRunwayInput,
} from '../../lib/map/flight-phase'
import { fetchAirportRunways } from './airport-data'

/**
 * İstek üzerine pist uçları (D-111): haritanın listesi uçları yalnız 1.–3. halkada taşır; izleyici
 * uçsuz bir havalimanını bildirince uçlar tek havalimanı ucundan (`GET /v1/airports/<ICAO>`) istenir.
 * Her havalimanı haritanın oturumunda bir kez istenir; başarısız istek yinelenmez (pist etiketi o
 * havalimanında çıkmaz, durum yine merkeze göre tahmin edilir). Ayrılınca süren istekler kesilir.
 */
export class RunwayEndsLoader {
  private readonly requested = new Set<string>()
  private readonly controller = new AbortController()

  constructor(
    private readonly fetchRunways: (
      icao: string,
      signal: AbortSignal,
    ) => Promise<readonly PhaseRunwayInput[] | null>,
    private readonly apply: (icao: string, runways: readonly PhaseRunwayInput[]) => void,
  ) {}

  request(icao: string): void {
    if (this.requested.has(icao) || this.controller.signal.aborted) return
    this.requested.add(icao)
    this.fetchRunways(icao, this.controller.signal).then(
      (runways) => {
        if (runways !== null && !this.controller.signal.aborted) this.apply(icao, runways)
      },
      () => {
        // Kesilen ya da başarısız istek: o havalimanında pist etiketi çıkmaz.
      },
    )
  }

  destroy(): void {
    this.controller.abort()
  }
}

/**
 * Uçak listesinin tahmini durumları (D-085). İzleyici depoya abone olur ve her değişiklikte (WebSocket
 * tam görüntüsü ve farkı, arama sonucu, budama) yeni örneği olan uçakları sınıflandırır: React
 * çiziminden önce, çizim döngüsünden (her kare) bağımsız. Çizim yalnızca `tracker.get(hex)` okur;
 * tablo ve kart zaten `useLive` ile seyreltilmiş sürümde yeniden çizilir.
 *
 * Havalimanları değişince (sayfa açılışında bir kez yüklenir) izleyici bütün uçakları yeniden
 * sınıflandırır ve bileşen bir kez yeniden çizilir; yoksa durumlar bir sonraki depo değişikliğine
 * kadar koordinat kalırdı. Uçları listede olmayan havalimanının uçları istek üzerine gelir
 * (`RunwayEndsLoader`, D-111).
 */
export function useFlightPhases(
  store: AircraftStore,
  airports: readonly PhaseAirportInput[],
  apiBaseUrl: string,
): FlightPhaseTracker {
  const [tracker] = useState(() => new FlightPhaseTracker())

  // Uçların aboneliği gözlemden önce kurulur: ilk sınıflandırmadaki bildirim kaybolmaz.
  useEffect(() => {
    const loader = new RunwayEndsLoader(
      (icao, signal) => fetchAirportRunways(apiBaseUrl, icao, signal),
      (icao, runways) => tracker.setRunwayEnds(icao, runways),
    )
    const unsubscribe = tracker.subscribeMissingEnds((icao) => loader.request(icao))
    return () => {
      unsubscribe()
      loader.destroy()
    }
  }, [apiBaseUrl, tracker])

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
