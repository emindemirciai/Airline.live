'use client'

import {
  formatAltitude,
  formatSpeed,
  formatVerticalRate,
  type Messages,
  type UnitSystem,
} from '@havayolu/i18n'
import { isTurkishAirlines, type Locale } from '@havayolu/shared'
import { useId } from 'react'
import type { TrackedAircraft } from '../../../lib/live/store'
import { aircraftTitle } from '../../../lib/map/label-text'
import { elapsedText, formatTrack, positionSourceLabel, textOrDash } from './panel-format'

export interface InfoCardProps {
  aircraft: TrackedAircraft
  /** Saniyelik saat (istemci saati, ms); "son görülme" bununla yenilenir. */
  now: number
  locale: Locale
  units: UnitSystem
  following: boolean
  onToggleFollow: () => void
  onClose: () => void
  messages: Messages['map']['card']
}

interface Fact {
  key: string
  label: string
  value: string
  /** Kod benzeri değerler eş aralıklı yazılır. */
  mono?: boolean
}

/**
 * Seçili uçağın bilgi kartı. Başlık sefer no (TK-974), yoksa çağrı kodu, tescil, o da yoksa hex'tir.
 * Tescil PIA/LADD uçakta API'den gelmez ("—"). "Uçağı ortala" bir aç/kapa düğmesidir
 * (`aria-pressed`); "takip" kelimesi burada kullanılmaz (yalnızca bildirim aboneliği içindir).
 */
export function InfoCard({
  aircraft,
  now,
  locale,
  units,
  following,
  onToggleFollow,
  onClose,
  messages,
}: InfoCardProps) {
  const headingId = useId()
  const title = aircraftTitle(aircraft)
  const opts = { locale, units }

  const facts: Fact[] = [
    { key: 'callsign', label: messages.callsign, value: textOrDash(aircraft.cs), mono: true },
    { key: 'registration', label: messages.registration, value: textOrDash(aircraft.reg) },
    { key: 'type', label: messages.type, value: textOrDash(aircraft.type), mono: true },
    {
      key: 'altitude',
      label: messages.altitude,
      value: formatAltitude(aircraft.alt, { ...opts, onGround: aircraft.gnd }),
    },
    { key: 'speed', label: messages.speed, value: formatSpeed(aircraft.gs, opts) },
    {
      key: 'verticalRate',
      label: messages.verticalRate,
      value: formatVerticalRate(aircraft.vr, opts),
    },
    { key: 'track', label: messages.track, value: formatTrack(aircraft.trk) },
    { key: 'squawk', label: messages.squawk, value: textOrDash(aircraft.sq), mono: true },
    {
      key: 'lastSeen',
      label: messages.lastSeen,
      // Örneğin yaşı (alındığı andan değil): görünüme yeni giren eski örnekli uçak "0 sn" görünmez.
      value: elapsedText(aircraft.sampledAt, now, messages),
    },
    { key: 'source', label: messages.source, value: messages.sources[aircraft.src] },
    {
      key: 'positionSource',
      label: messages.positionSource,
      value: positionSourceLabel(aircraft.psrc),
    },
    { key: 'hex', label: messages.hex, value: aircraft.hex.toUpperCase(), mono: true },
  ]

  return (
    <section
      className="map-panel map-card"
      aria-labelledby={headingId}
      data-hex={aircraft.hex}
      data-thy={isTurkishAirlines(aircraft) ? 'true' : undefined}
    >
      <header className="map-card__header">
        <div className="map-card__heading">
          <p className="map-card__eyebrow">{messages[title.kind]}</p>
          <h2 id={headingId} className="map-card__title">
            {title.text}
          </h2>
        </div>
        <button
          type="button"
          className="map-icon-button"
          aria-label={messages.close}
          title={messages.close}
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <dl className="map-card__facts">
        {facts.map((fact) => (
          <div key={fact.key} className="map-card__fact">
            <dt>{fact.label}</dt>
            <dd className={fact.mono ? 'mono' : undefined}>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="map-card__actions">
        <button
          type="button"
          className="map-button map-card__follow"
          aria-pressed={following}
          onClick={onToggleFollow}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="6.5" />
            <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
          </svg>
          {messages.follow}
        </button>
        {following ? <p className="map-card__note">{messages.following}</p> : null}
      </div>
    </section>
  )
}
