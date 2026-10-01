'use client'

import type { Messages } from '@havayolu/i18n'
import { airportDisplayName, type Locale } from '@havayolu/shared'
import { useEffect, useId, useRef, useState } from 'react'
import type { MapAirport } from '../airport-data'

export interface AirportListControlProps {
  /** Görünümdeki havalimanları, ortaya yakın önce (`airportsInView`). */
  airports: readonly MapAirport[]
  locale: Locale
  onSelect: (icao: string) => void
  messages: Messages['map']['airportList']
}

/**
 * "Havalimanları" düğmesi ve açılır liste: görünümdeki havalimanları düğme olarak. Seçmek havalimanı
 * penceresini açar (odak pencereye geçer; pencere kapanınca bu düğmeye döner, WCAG 2.4.3).
 * Haritadaki pin ve kodlar tuvalde çizildiği için odak alamaz; bu liste pencerenin klavye ve ekran
 * okuyucu yoludur (WCAG 2.1.1, D-078). Liste Escape'le ve dışına tıklanınca kapanır; Escape'i
 * kendisi tüketir (açık havalimanı penceresi kapanmaz).
 */
export function AirportListControl({
  airports,
  locale,
  onSelect,
  messages,
}: AirportListControlProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: PointerEvent) => {
      const root = rootRef.current
      if (root && event.target instanceof Node && !root.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      const focusInside = rootRef.current?.contains(document.activeElement) ?? false
      setOpen(false)
      if (focusInside) buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutside)
    // Yakalama evresi: belgeye bağlı diğer Escape dinleyicilerinden (havalimanı penceresi) önce.
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [open])

  return (
    <div ref={rootRef} className="map-labels map-airports">
      <button
        ref={buttonRef}
        type="button"
        className="map-button map-labels__button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="M12 21.5s-6.5-6.4-6.5-11.5a6.5 6.5 0 0 1 13 0c0 5.1-6.5 11.5-6.5 11.5z" />
          <circle cx="12" cy="10" r="2.3" />
        </svg>
        {messages.button}
      </button>
      {open ? (
        <div
          id={panelId}
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
                    onClick={() => {
                      // Öğe liste kapanınca DOM'dan kalkar; odak önce açan düğmeye alınır. Pencere
                      // onu açan denetim olarak saklar ve kapanınca odağı ona verir (body'ye değil).
                      buttonRef.current?.focus({ preventScroll: true })
                      setOpen(false)
                      onSelect(airport.icao)
                    }}
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
      ) : null}
    </div>
  )
}
