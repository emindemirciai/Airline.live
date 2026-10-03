'use client'

import './airport-popup.css'

import type { Messages } from '@havayolu/i18n'
import type { Locale } from '@havayolu/shared'
import Link from 'next/link'
import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, type RefObject } from 'react'
import { localePath } from '../../lib/locale-routing'
import { WeatherRowList } from '../airports/weather-row-list'
import type { MapAirport } from './airport-data'
import {
  airportFacts,
  airportPlace,
  escapeClosesPopup,
  popupStatusText,
  popupTimeZone,
  popupWeatherView,
  returnFocusTarget,
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
   * saati; ms): yerel saat ve gözlem yaşı bununla hesaplanır. Geri gitmeyen
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
 * resmî ad, IATA/ICAO, il (yakın ülkelerde ülke, D-080), rakım, pist özeti, yerel saat ve UTC farkı
 * (saat dilimi biliniyorsa, `popupTimeZone`; D-084), güncel hava durumu ve havalimanı sayfası
 * bağlantısı. Gün doğumu ve
 * batımı yalnız havalimanı sayfasındadır (kullanıcı kararı 2026-10-02).
 * - Hava durumu: başlığın yanında ayrı sıcaklık kutucuğu (önünde "·" yok; eksi U+2212), simgeli
 *   satırlar; var olan olayın, etkili rüzgârın (şiddet etiketiyle) ve şimşek ve yıldırım riskinin
 *   satırı renkli zemin ve kalın yazıyla vurgulanır (`WeatherRowList`, havalimanı sayfasıyla ortak).
 * - Tek hizalı tablo (M6e.1; kullanıcı geri bildirimi 2026-10-03, D-083; M6e'nin ortalı düzeninin
 *   yerine): bütün yazılar sola yaslıdır ve aynı sol kenardan başlar (kodlar, ad, yer satırı; kapat
 *   düğmesi sağda). Bilgi satırları (rakım, pistler, yerel saat; kendi simgeleriyle) ve hava durumu
 *   satırları aynı listeyle (`WeatherRowList`, `wx-rows--popup`) çizilir: simge, etiket ve değer her
 *   satırda aynı x'tedir. Hava başlığı ile sıcaklık kutucuğu, notlar, gözlem satırı ve bağlantı da
 *   aynı sol kenardadır.
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

  const timeZone = popupTimeZone(airport)
  const facts = airportFacts(airport, now, locale, messages, timeZone)
  const place = airportPlace(airport, locale)
  const view = popupWeatherView(
    weather,
    airport.icao,
    now,
    locale,
    weatherMessages,
    messages,
    timeZone,
  )

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

      <WeatherRowList rows={facts.rows} className="map-popup__facts wx-rows--popup" />

      <section className="map-popup__weather" aria-labelledby={weatherHeadingId}>
        <h3 id={weatherHeadingId} className="map-popup__subheading">
          {messages.weather}
        </h3>
        <p className="sr-only" role="status" aria-live="polite">
          {popupStatusText(view)}
        </p>
        {view.kind === 'report' ? (
          <>
            {view.headline ? (
              <p className="map-popup__headline">
                <span>{view.headline}</span>
                {view.temperature ? (
                  <>
                    {' '}
                    <span className="wx-temp">{view.temperature}</span>
                  </>
                ) : null}
              </p>
            ) : null}
            {view.note ? <p className="map-popup__note">{view.note}</p> : null}
            {view.rows.length > 0 ? (
              <WeatherRowList rows={view.rows} className="wx-rows--popup" />
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
