'use client'

import type { Messages } from '@havayolu/i18n'
import { airportDisplayName, type Locale } from '@havayolu/shared'
import type { MapAirport } from '../airport-data'

export interface AirportListPanelProps {
  /** Panelin kimliği (düğmenin `aria-controls`'u) ve başlığının kimliği. */
  id: string
  titleId: string
  /** Görünümdeki havalimanları, ortaya yakın önce (`airportsInView`). */
  airports: readonly MapAirport[]
  locale: Locale
  /** Seçilen havalimanı (ICAO). */
  onPick: (icao: string) => void
  messages: Messages['map']['airportList']
}

/**
 * "Havalimanları" listesinin açılır paneli: başlık, görünümdeki havalimanları (IATA kodu ve görünen
 * ad) ve not. Ad tabloları (`airportDisplayName`) yalnız buradan ve havalimanı penceresinden gelir;
 * bu modül liste ilk açılınca yüklenir (`airport-list-control.tsx`, D-101), haritanın ilk paketine
 * girmez. Panel bütün olarak çizilir: başlık ve öğeler aynı anda görünür.
 */
export function AirportListPanel({
  id,
  titleId,
  airports,
  locale,
  onPick,
  messages,
}: AirportListPanelProps) {
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
      {airports.length === 0 ? (
        <p className="map-labels__hint">{messages.empty}</p>
      ) : (
        <ul className="map-airports__list">
          {airports.map((airport) => (
            <li key={airport.icao}>
              <button
                type="button"
                className="map-airports__item"
                onClick={() => onPick(airport.icao)}
              >
                <span className="map-airports__code">{airport.iata}</span>{' '}
                <span>{airportDisplayName(airport, locale)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="map-labels__hint">{messages.hint}</p>
    </div>
  )
}
