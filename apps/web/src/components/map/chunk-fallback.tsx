'use client'

import type { ComponentType } from 'react'
import type { AirportPopupProps } from './airport-popup'
import type { AirportListPanelProps } from './panels/airport-list-panel'

/**
 * Tembel parçaların yedekleri (D-101). Havalimanı penceresi, "Havalimanları" paneli ve havalimanı
 * aramasının ad dizini (D-108) ilk paketin dışında, ayrı parçadadır. Parça yüklenemezse `import()`
 * reddedilir: yayından sonra açık kalmış sekme eski, adı özetli dosyayı ister ve 404 alır (imaj
 * yalnız yeni sürümün dosyalarını taşır) ya da bağlantı kesiktir. `next/dynamic` düz `React.lazy`'dir: ret sayfanın hata sınırına
 * (app/error.tsx) çıkar ve bütün canlı harita hata ekranına dönerdi; ret modül düzeyinde saklandığı
 * için yeniden denemek de yardım etmezdi. Yükleyiciler reddi yakalar ve bileşenin yerine buradaki
 * yedeği verir: kısa bir not ve "Sayfayı yenile" düğmesi (sayfa yenilenince yeni sürümün dosyaları
 * gelir). Bu modül ilk pakettedir; yalnız tür olarak import eder, parçaların CSS'ine dayanmaz
 * (stiller globals.css'te).
 */

/**
 * Parça yükleyicisi: `import()` reddedilirse değerin yerine `fallback`'i verir ve hatayı uyarı olarak
 * günlüğe yazar. Ret yakalandığı için önceden isteme (`void load()`) işlenmemiş ret bırakmaz. Değer
 * bileşen olmak zorunda değildir: havalimanı araması (D-108) ad dizinini kuran fonksiyonu yükler,
 * yedeği yalnız kodla arayan fonksiyondur (`panels/search-box-model.ts` → `codeOnlyAirportSearch`).
 */
export function withImportFallback<T>(
  load: () => Promise<T>,
  fallback: T,
  name: string,
): () => Promise<T> {
  return () =>
    load().catch((error: unknown) => {
      console.warn(`${name} could not be loaded`, error)
      return fallback
    })
}

/** Bileşen parçasının yükleyicisi (`withImportFallback`): yüklenemezse yedek bileşen. */
export function withChunkFallback<P extends object>(
  load: () => Promise<ComponentType<P>>,
  fallback: ComponentType<P>,
  name: string,
): () => Promise<ComponentType<P>> {
  return withImportFallback(load, fallback, name)
}

/** Sayfayı yeniler: yeni sürümün HTML'i ve parçaları gelir. */
function reloadPage(): void {
  window.location.reload()
}

/**
 * Havalimanı penceresinin yerine: haritanın ortasında havalimanının kodları, not, "Sayfayı yenile"
 * ve "Kapat". Not ekran okuyucuya hemen bildirilir (`role="alert"`).
 */
export function AirportPopupUnavailable({
  airport,
  onClose,
  messages,
}: Pick<AirportPopupProps, 'airport' | 'onClose' | 'messages'>) {
  return (
    <section className="map-panel live-map__chunk-error" data-icao={airport.icao}>
      <p className="map-chunk-error__codes">
        {airport.iata} · {airport.icao}
      </p>
      <p className="map-chunk-error__text" role="alert">
        {messages.loadFailed}
      </p>
      <div className="map-chunk-error__actions">
        <button type="button" className="map-button" onClick={reloadPage}>
          {messages.reload}
        </button>
        <button type="button" className="map-button" onClick={onClose}>
          {messages.close}
        </button>
      </div>
    </section>
  )
}

/** "Havalimanları" panelinin yerine: aynı yerde başlık, not ve "Sayfayı yenile". */
export function AirportListPanelUnavailable({
  id,
  titleId,
  messages,
}: Pick<AirportListPanelProps, 'id' | 'titleId' | 'messages'>) {
  return (
    <div
      id={id}
      className="map-panel map-labels__panel map-airports__panel"
      role="group"
      aria-labelledby={titleId}
    >
      <p id={titleId} className="map-labels__title">
        {messages.title}
      </p>
      <p className="map-chunk-error__text" role="alert">
        {messages.loadFailed}
      </p>
      <div className="map-chunk-error__actions">
        <button type="button" className="map-button" onClick={reloadPage}>
          {messages.reload}
        </button>
      </div>
    </div>
  )
}
