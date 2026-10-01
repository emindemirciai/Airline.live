'use client'

import './airport-popup.css'

import type { Messages } from '@havayolu/i18n'
import type { Locale } from '@havayolu/shared'
import Link from 'next/link'
import {
  Fragment,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  type RefObject,
} from 'react'
import { localePath } from '../../lib/locale-routing'
import type { MapAirport } from './airport-data'
import {
  airportFacts,
  airportPlace,
  escapeClosesPopup,
  popupStatusText,
  popupWeatherView,
  returnFocusTarget,
  sunToday,
  type FocusPlace,
} from './airport-popup-model'
import type { MapViewHandle } from './map-view'
import type { ScreenPoint } from './map-controller'
import { placePopup } from './popup-placement'
import type { BulkWeatherState } from './use-airport-weather'

export interface AirportPopupProps {
  airport: MapAirport
  /** Toplu hava durumu (`useBulkWeather`); istasyonun raporu buradan okunur. */
  weather: BulkWeatherState
  /**
   * Saniyelik duvar saati (cihaz kipindeki `WallClock`: akla yatkınsa cihaz saati, değilse sunucu
   * saati; ms): yerel saat, gün doğumu ve gözlem yaşı bununla hesaplanır. Geri gitmeyen
   * `monotonicNow` sunucu zamanlarıyla karşılaştırılmaz.
   */
  now: number
  locale: Locale
  /** Dar ekran: pencere alttan açılan sayfadır, havalimanının yanına konmaz. */
  sheet: boolean
  mapRef: RefObject<MapViewHandle | null>
  onClose: () => void
  messages: Messages['map']['airportPopup']
  weatherMessages: Messages['weather']
}

/** Odağın yeri pencereye göre: içi, harita tuvali, hiçbir yer (sayfa, body) ya da başka denetim. */
function focusPlaceIn(root: HTMLElement | null): FocusPlace {
  const active = document.activeElement
  if (active !== null && root?.contains(active)) return 'popup'
  if (active === null || active === document.body || active === document.documentElement) {
    return 'page'
  }
  return active.classList.contains('maplibregl-canvas') ? 'map' : 'other'
}

/**
 * Canlı haritada havalimanı noktasına ya da IATA koduna tıklanınca açılan küçük pencere (M6c):
 * resmî ad, IATA/ICAO, il, rakım, pist özeti, yerel saat, gün doğumu ve batımı, güncel hava durumu ve
 * havalimanı sayfası bağlantısı.
 *
 * - Erişilebilirlik: kipsiz `dialog`; açılınca odak pencereye geçer, Escape ya da Kapat odağı
 *   pencereyi açan denetime (harita tuvali ya da "Havalimanları" düğmesi; yoksa harita tuvali) geri
 *   verir, sayfanın başına (body) göndermez. Escape yalnızca odak pencerede, haritada ya da
 *   hiçbir yerdeyken ve başka bir katman (arama sonuçları, etiket ayarları) onu tüketmediyse kapatır.
 *   Haritada başka yere tıklamak pencereyi kapatır (live-map.tsx); odak orada kalır. Klavyeyle
 *   açmanın yolu "Havalimanları" listesidir (panels/airport-list-control.tsx). Hava durumunun
 *   yüklenmesi ve hatası ekran okuyucuya kibarca bildirilir (`role="status"`).
 * - Geniş ekranda pencere noktanın yanında durur ve harita kaydıkça onunla gider: yer, React dışında
 *   harita her çizildiğinde (`trackPoint`) hesaplanır ve doğrudan stile yazılır.
 */
export function AirportPopup({
  airport,
  weather,
  now,
  locale,
  sheet,
  mapRef,
  onClose,
  messages,
  weatherMessages,
}: AirportPopupProps) {
  const rootRef = useRef<HTMLElement>(null)
  const weatherHeadingId = useId()
  const returnFocusRef = useRef<HTMLElement | null>(null)

  // Açılışta ve başka havalimanına geçişte: pencereyi açan denetim (harita tuvali ya da
  // "Havalimanları" düğmesi) kapanışta odağın döneceği öğe olarak saklanır (`returnFocusTarget`);
  // odak pencereye geçer (ekran okuyucu yeni adı okur).
  useEffect(() => {
    const root = rootRef.current
    const active = document.activeElement
    returnFocusRef.current = returnFocusTarget(
      returnFocusRef.current,
      active instanceof HTMLElement ? active : null,
      focusPlaceIn(root),
    )
    root?.focus({ preventScroll: true })
  }, [airport.icao])

  /** Kapatır; `restoreFocus` ise odak pencereyi açan denetime (yoksa harita tuvaline) döner. */
  const close = (restoreFocus: boolean) => {
    const target = returnFocusRef.current
    const fallback = rootRef.current
      ?.closest('.live-map')
      ?.querySelector<HTMLElement>('.maplibregl-canvas')
    onClose()
    if (!restoreFocus) return
    const next = target?.isConnected ? target : fallback
    next?.focus({ preventScroll: true })
  }

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const focus = focusPlaceIn(rootRef.current)
    if (!escapeClosesPopup(event, focus)) return
    close(focus === 'popup')
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKeyDown(event)
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [])

  // Geniş ekranda yer: nokta kaydıkça (harita çizimi) ve pencere ya da alan boyut değiştirince.
  useLayoutEffect(() => {
    const root = rootRef.current
    const layer = root?.parentElement
    if (!root || !layer) return
    if (sheet) {
      root.style.transform = ''
      root.dataset.placed = 'true'
      return
    }
    root.dataset.placed = 'false'
    let anchor: ScreenPoint | null = null
    let last = ''
    const place = () => {
      if (!anchor) return
      const placement = placePopup({
        anchor,
        size: { width: root.offsetWidth, height: root.offsetHeight },
        view: { width: layer.clientWidth, height: layer.clientHeight },
      })
      const transform = `translate(${placement.left}px, ${placement.top}px)`
      if (transform !== last) {
        last = transform
        root.style.transform = transform
        root.dataset.side = placement.side
      }
      root.dataset.placed = 'true'
    }
    const stop = mapRef.current?.trackPoint({ lat: airport.lat, lon: airport.lon }, (point) => {
      anchor = point
      place()
    })
    const observer = new ResizeObserver(place)
    observer.observe(root)
    observer.observe(layer)
    return () => {
      stop?.()
      observer.disconnect()
    }
  }, [sheet, airport.lat, airport.lon, mapRef])

  const facts = airportFacts(airport, now, sunToday(airport, now), locale, messages)
  const place = airportPlace(airport, locale)
  const view = popupWeatherView(weather, airport.icao, now, locale, weatherMessages, messages)

  return (
    <section
      ref={rootRef}
      className="map-panel map-popup"
      role="dialog"
      aria-label={facts.label}
      tabIndex={-1}
      data-icao={airport.icao}
    >
      <header className="map-popup__header">
        <div className="map-popup__heading">
          <p className="map-popup__codes">
            {airport.iata} · {airport.icao}
          </p>
          <h2 className="map-popup__title">{facts.name}</h2>
          {place ? <p className="map-popup__place">{place}</p> : null}
        </div>
        <button
          type="button"
          className="map-icon-button"
          aria-label={messages.close}
          title={messages.close}
          onClick={() => close(true)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <dl className="map-popup__facts">
        {facts.rows.map((row) => (
          <Fragment key={row.key}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </Fragment>
        ))}
      </dl>

      <section className="map-popup__weather" aria-labelledby={weatherHeadingId}>
        <h3 id={weatherHeadingId} className="map-popup__subheading">
          {messages.weather}
        </h3>
        <p className="sr-only" role="status" aria-live="polite">
          {popupStatusText(view)}
        </p>
        {view.kind === 'report' ? (
          <>
            {view.headline ? <p className="map-popup__headline">{view.headline}</p> : null}
            {view.note ? <p className="map-popup__note">{view.note}</p> : null}
            {view.rows.length > 0 ? (
              <dl className="map-popup__rows">
                {view.rows.map((row) => (
                  <Fragment key={row.key}>
                    <dt>{row.label}</dt>
                    <dd>
                      {row.value}
                      {row.strong ? (
                        <>
                          {' · '}
                          <span className="map-popup__strong">{row.strong}</span>
                        </>
                      ) : null}
                    </dd>
                  </Fragment>
                ))}
              </dl>
            ) : null}
            <p className="map-popup__observed" data-age={view.ageClass}>
              {view.observed}
            </p>
          </>
        ) : (
          <p className="map-popup__note" data-state={view.kind}>
            {view.text}
          </p>
        )}
      </section>

      <Link
        className="map-popup__link"
        href={localePath(locale, `/istasyon/${airport.icao}`)}
        prefetch={false}
      >
        {messages.openAirportPage}
      </Link>
    </section>
  )
}
