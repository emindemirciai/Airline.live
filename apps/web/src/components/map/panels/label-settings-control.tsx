'use client'

import type { Messages } from '@havayolu/i18n'
import { useEffect, useId, useRef, useState } from 'react'
import {
  AIRPORT_LABEL_MODES,
  LABEL_MODES,
  type LabelSettings,
} from '../../../lib/map/label-settings'

const AIRCRAFT_TARGETS = ['selected', 'others'] as const satisfies readonly (keyof LabelSettings)[]

export interface LabelSettingsControlProps {
  value: LabelSettings
  onChange: (value: LabelSettings) => void
  messages: Messages['map']['labels']
}

/**
 * "Etiketler" düğmesi ve açılır ayar paneli: seçili uçak ve diğer uçaklar için ayrı ayrı Gizle,
 * Kısa ya da Tam; havalimanları için Gizle, Kod ya da Kod ve ad (D-084). Denetimli bileşendir;
 * saklama (`hy:map:labels`) üst bileşenin işidir. Panel Escape'le ve dışına tıklanınca kapanır;
 * Escape odağı düğmeye geri verir ve tüketilir.
 */
export function LabelSettingsControl({ value, onChange, messages }: LabelSettingsControlProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: PointerEvent) => {
      const root = rootRef.current
      if (root && event.target instanceof Node && !root.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // Tüketilir: açık havalimanı penceresi aynı tuşla kapanmaz (airport-popup.tsx).
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
    <div ref={rootRef} className="map-labels">
      <button
        ref={buttonRef}
        type="button"
        className="map-button map-labels__button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="M3.5 12V3.5H12l8.5 8.5-8.5 8.5z" />
          <circle cx="8" cy="8" r="1.6" />
        </svg>
        {messages.button}
      </button>
      {open ? (
        <LabelSettingsPanel id={panelId} value={value} onChange={onChange} messages={messages} />
      ) : null}
    </div>
  )
}

export interface LabelSettingsPanelProps extends LabelSettingsControlProps {
  id?: string
}

/** Açık panelin içeriği: başlık, üç seçenek grubu ve ipucu. */
export function LabelSettingsPanel({ id, value, onChange, messages }: LabelSettingsPanelProps) {
  const titleId = useId()
  const groupName = useId()
  return (
    <div id={id} className="map-panel map-labels__panel" role="group" aria-labelledby={titleId}>
      <p id={titleId} className="map-labels__title">
        {messages.title}
      </p>
      {AIRCRAFT_TARGETS.map((target) => (
        <ModeGroup
          key={target}
          legend={messages[target]}
          name={`${groupName}-${target}`}
          modes={LABEL_MODES}
          label={(mode) => messages[mode]}
          checked={value[target]}
          onSelect={(mode) => onChange({ ...value, [target]: mode })}
        />
      ))}
      <ModeGroup
        legend={messages.airports}
        name={`${groupName}-airports`}
        modes={AIRPORT_LABEL_MODES}
        label={(mode) => messages.airportModes[mode]}
        checked={value.airports}
        onSelect={(mode) => onChange({ ...value, airports: mode })}
      />
      <p className="map-labels__hint">{messages.hint}</p>
    </div>
  )
}

interface ModeGroupProps<M extends string> {
  legend: string
  name: string
  modes: readonly M[]
  label: (mode: M) => string
  checked: M
  onSelect: (mode: M) => void
}

/** Bir seçenek grubu: `legend` ve bölümlü radyo düğmeleri (klavyede ok tuşlarıyla gezilir). */
function ModeGroup<M extends string>({
  legend,
  name,
  modes,
  label,
  checked,
  onSelect,
}: ModeGroupProps<M>) {
  return (
    <fieldset className="map-labels__group">
      <legend>{legend}</legend>
      <div className="map-seg">
        {modes.map((mode) => (
          <label key={mode} className="map-seg__option">
            <input
              type="radio"
              className="map-seg__input"
              name={name}
              value={mode}
              checked={checked === mode}
              onChange={() => onSelect(mode)}
            />
            <span>{label(mode)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
