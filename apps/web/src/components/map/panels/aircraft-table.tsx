'use client'

import { format, formatAltitude, formatSpeed, type Messages, type UnitSystem } from '@havayolu/i18n'
import type { Locale } from '@havayolu/shared'
import { useId, useState } from 'react'
import type { TrackedAircraft } from '../../../lib/live/store'
import { aircraftTitle } from '../../../lib/map/label-text'
import { formatPosition, textOrDash } from './panel-format'

export interface AircraftTableProps {
  /** Görünümdeki uçaklar, merkeze yakınlık sırasıyla (en fazla 50). */
  rows: TrackedAircraft[]
  /** Görünümdeki toplam uçak; satır sayısından büyükse başlık "ilk N / toplam" olur. */
  total: number
  selectedHex: string | null
  onSelect: (hex: string) => void
  locale: Locale
  units: UnitSystem
  messages: Messages['map']['table']
}

/**
 * Haritada görünen uçakların erişilebilir karşılığı: gerçek bir `<table>` (ekran okuyucu ve E2E
 * testleri uçakları buradan okur). Satırın tamamı tıklanabilir; klavye için ilk hücrede bir düğme
 * vardır (düğmeye basmak satırın tıklamasına kabarcıklanır). Dar ekranda liste varsayılan olarak
 * kapalıdır ve düğmeyle açılır; geniş ekranda her zaman açıktır (globals.css).
 */
export function AircraftTable({
  rows,
  total,
  selectedHex,
  onSelect,
  locale,
  units,
  messages,
}: AircraftTableProps) {
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()
  const opts = { locale, units }
  const caption =
    total > rows.length
      ? format(messages.captionLimited, { shown: rows.length, total })
      : messages.caption

  return (
    <section className="map-panel map-table" data-expanded={expanded ? 'true' : 'false'}>
      <button
        type="button"
        className="map-table__toggle"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((value) => !value)}
      >
        <span>{expanded ? messages.hide : messages.show}</span>
        <span className="map-table__count mono" aria-hidden="true">
          {total}
        </span>
      </button>
      <div id={bodyId} className="map-table__body">
        <table className="map-table__table">
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{messages.flight}</th>
              <th scope="col">{messages.type}</th>
              <th scope="col" className="map-table__num">
                {messages.altitude}
              </th>
              <th scope="col" className="map-table__num">
                {messages.speed}
              </th>
              <th scope="col">{messages.position}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="map-table__empty">
                  {messages.empty}
                </td>
              </tr>
            ) : (
              rows.map((ac) => {
                const name = aircraftTitle(ac).text
                const selected = ac.hex === selectedHex
                return (
                  <tr
                    key={ac.hex}
                    data-hex={ac.hex}
                    aria-selected={selected}
                    className={selected ? 'is-selected' : undefined}
                    onClick={() => onSelect(ac.hex)}
                  >
                    <th scope="row">
                      <button
                        type="button"
                        className="map-table__select mono"
                        aria-label={format(messages.select, { flight: name })}
                      >
                        {name}
                      </button>
                    </th>
                    <td className="mono">{textOrDash(ac.type)}</td>
                    <td className="map-table__num mono">
                      {formatAltitude(ac.alt, { ...opts, onGround: ac.gnd })}
                    </td>
                    <td className="map-table__num mono">{formatSpeed(ac.gs, opts)}</td>
                    <td className="mono">{formatPosition(ac.lat, ac.lon)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
