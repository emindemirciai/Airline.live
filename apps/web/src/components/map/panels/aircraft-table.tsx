'use client'

import { format, formatAltitude, type Messages, type UnitSystem } from '@havayolu/i18n'
import type { Locale } from '@havayolu/shared'
import { useId, useState } from 'react'
import type { TrackedAircraft } from '../../../lib/live/store'
import { aircraftTitle } from '../../../lib/map/label-text'
import type { AircraftPlaceView } from './aircraft-place'
import { textOrDash } from './panel-format'

export interface AircraftTableProps {
  /** Görünümdeki uçaklar, merkeze yakınlık sırasıyla (en fazla 50). */
  rows: TrackedAircraft[]
  /** Görünümdeki toplam uçak; satır sayısından büyükse başlık "ilk N / toplam" olur. */
  total: number
  selectedHex: string | null
  onSelect: (hex: string) => void
  /** Satırın "Konum ve durum" hücresi (tahmini durum ve konum; aircraft-place.ts). */
  placeOf: (ac: TrackedAircraft) => AircraftPlaceView
  /** Dar ekran (767 px ve altı): liste alttaki düğmeyle açılır, her açılışta kapalı başlar. */
  sheet: boolean
  /** Geniş ekranda liste açık mı (cihazda saklanır, `hy:map:list`). */
  wideOpen: boolean
  onWideOpenChange: (open: boolean) => void
  locale: Locale
  units: UnitSystem
  messages: Messages['map']['table']
}

/**
 * Haritada görünen uçakların erişilebilir karşılığı: gerçek bir `<table>` (ekran okuyucu ve E2E
 * testleri uçakları buradan okur). Sütunlar Sefer, Kuyruk (tescil; boşsa "—"), Yükseklik, Konum ve
 * durum (D-085; durum yalnızca gösterimdir, hücre canlı bölge değildir ve değişince duyurulmaz).
 * Satırın tamamı tıklanabilir; klavye için ilk hücrede bir düğme vardır (düğmeye
 * basmak satırın tıklamasına kabarcıklanır). Altta "Durumlar tahminidir" notu durur, tabloya
 * `aria-describedby` ile bağlıdır.
 *
 * Başlıktaki düğme listeyi açar ya da daraltır. Geniş ekranda (sağ üst) liste varsayılan olarak
 * açıktır ve hâli cihazda saklanır; dar ekranda (sol alt) her açılışta kapalı başlar ve saklanmaz.
 * Hangisinin geçerli olduğunu CSS (`data-wide-open`, `data-phone-open`) ve `sheet` belirler: sunucu
 * çizimi geniş ekranı varsayar, telefonda liste yine de kapalı görünür (globals.css).
 */
export function AircraftTable({
  rows,
  total,
  selectedHex,
  onSelect,
  placeOf,
  sheet,
  wideOpen,
  onWideOpenChange,
  locale,
  units,
  messages,
}: AircraftTableProps) {
  const [phoneOpen, setPhoneOpen] = useState(false)
  const bodyId = useId()
  const noteId = useId()
  const open = sheet ? phoneOpen : wideOpen
  const toggle = () => {
    if (sheet) setPhoneOpen((value) => !value)
    else onWideOpenChange(!wideOpen)
  }
  const caption =
    total > rows.length
      ? format(messages.captionLimited, { shown: rows.length, total })
      : messages.caption

  return (
    <section
      className="map-panel map-table"
      data-wide-open={wideOpen ? 'true' : 'false'}
      data-phone-open={phoneOpen ? 'true' : 'false'}
    >
      <button
        type="button"
        className="map-table__toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
      >
        <span className="map-table__toggle-label">{open ? messages.hide : messages.show}</span>
        <span className="map-table__count mono" aria-hidden="true">
          {total}
        </span>
        <svg
          className="map-table__chevron"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div id={bodyId} className="map-table__body">
        <table className="map-table__table" aria-describedby={noteId}>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{messages.flight}</th>
              <th scope="col">
                <span aria-hidden="true">{messages.registration}</span>
                <span className="sr-only">{messages.registrationLabel}</span>
              </th>
              <th scope="col" className="map-table__num">
                {messages.altitude}
              </th>
              <th scope="col">{messages.place}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="map-table__empty">
                  {messages.empty}
                </td>
              </tr>
            ) : (
              rows.map((ac) => {
                const name = aircraftTitle(ac).text
                const selected = ac.hex === selectedHex
                const place = placeOf(ac)
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
                    <td className="map-table__reg mono">{textOrDash(ac.reg)}</td>
                    <td className="map-table__num mono">
                      {formatAltitude(ac.alt, { locale, units, onGround: ac.gnd, nowrap: true })}
                    </td>
                    <td
                      className="map-table__place"
                      data-phase={place.phase}
                      data-airport={place.airport ?? undefined}
                    >
                      {place.badge ? (
                        <>
                          <span className="map-table__phase">{place.badge}</span>{' '}
                        </>
                      ) : null}
                      {place.text}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        <p id={noteId} className="map-table__note">
          {messages.note}
        </p>
      </div>
    </section>
  )
}
