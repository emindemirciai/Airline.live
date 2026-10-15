'use client'

import type { Messages } from '@havayolu/i18n'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type SyntheticEvent,
} from 'react'
import {
  AIRPORT_ICON_MODES,
  AIRPORT_LABEL_MODES,
  COUNTRY_LABEL_MODES,
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
 * Kısa ya da Tam; havalimanı simgeleri için Gizle ya da Göster (D-113); havalimanları için Gizle ya
 * da Kod (D-084); ülke adları için Gizle ya da Göster (D-095). Denetimli bileşendir; saklama
 * (`hy:map:labels`) üst bileşenin işidir. Panel Escape'le ve dışına tıklanınca kapanır; Escape odağı
 * düğmeye geri verir ve tüketilir.
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

/**
 * Açık panelin içeriği: başlık, beş seçenek grubu ve ipucu. "Havalimanı simgeleri" (D-113)
 * "Havalimanları" grubunun hemen üstündedir: simgeler gizliyken kodlar da çizilmez, bu yüzden
 * "Havalimanları" grubu kapalı (`aria-disabled`) ve kısa notludur; seçimi değişmez ve saklı kalır.
 */
export function LabelSettingsPanel({ id, value, onChange, messages }: LabelSettingsPanelProps) {
  const titleId = useId()
  const groupName = useId()
  const iconsHidden = value.airportIcons === 'hidden'
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
        legend={messages.airportIcons}
        name={`${groupName}-airportIcons`}
        modes={AIRPORT_ICON_MODES}
        label={(mode) => messages.airportIconModes[mode]}
        checked={value.airportIcons}
        onSelect={(mode) => onChange({ ...value, airportIcons: mode })}
      />
      <ModeGroup
        legend={messages.airports}
        name={`${groupName}-airports`}
        modes={AIRPORT_LABEL_MODES}
        label={(mode) => messages.airportModes[mode]}
        checked={value.airports}
        onSelect={(mode) => onChange({ ...value, airports: mode })}
        disabledNote={iconsHidden ? messages.airportsWithoutIcons : null}
      />
      <ModeGroup
        legend={messages.countries}
        name={`${groupName}-countries`}
        modes={COUNTRY_LABEL_MODES}
        label={(mode) => messages.countryModes[mode]}
        checked={value.countries}
        onSelect={(mode) => onChange({ ...value, countries: mode })}
      />
      <p className="map-labels__hint">{messages.hint}</p>
    </div>
  )
}

/**
 * Radyo grubunda seçimi değiştiren tuşlar (tarayıcı odağı yandaki seçeneğe geçirir ve onu seçer):
 * kapalı grupta engellenir, odak seçili seçenekte kalır. Boşluk tuşu tıklama olarak gelir ve
 * tıklamayla birlikte engellenir.
 */
export function isRadioNavigationKey(key: string): boolean {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown'
}

const preventDefault = (event: SyntheticEvent) => event.preventDefault()
const blockRadioNavigation = (event: ReactKeyboardEvent) => {
  if (isRadioNavigationKey(event.key)) event.preventDefault()
}

interface ModeGroupProps<M extends string> {
  legend: string
  name: string
  modes: readonly M[]
  label: (mode: M) => string
  checked: M
  onSelect: (mode: M) => void
  /**
   * Doluysa grup kapalıdır (D-113) ve not seçeneklerin altında yazılır. Kapalı grubun seçenekleri
   * `aria-disabled` taşır, odaklanır (ekran okuyucu notu okur) ama değişmez: tıklama, boşluk ve ok
   * tuşları seçimi değiştirmez; seçili değer korunur.
   */
  disabledNote?: string | null
}

/** Bir seçenek grubu: `legend` ve bölümlü radyo düğmeleri (klavyede ok tuşlarıyla gezilir). */
function ModeGroup<M extends string>({
  legend,
  name,
  modes,
  label,
  checked,
  onSelect,
  disabledNote = null,
}: ModeGroupProps<M>) {
  const noteId = useId()
  const disabled = disabledNote !== null
  return (
    <fieldset className="map-labels__group" aria-disabled={disabled ? true : undefined}>
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
              aria-disabled={disabled ? true : undefined}
              aria-describedby={disabled ? noteId : undefined}
              onChange={() => {
                if (!disabled) onSelect(mode)
              }}
              onClick={disabled ? preventDefault : undefined}
              onKeyDown={disabled ? blockRadioNavigation : undefined}
            />
            <span>{label(mode)}</span>
          </label>
        ))}
      </div>
      {disabled ? (
        <p id={noteId} className="map-labels__note">
          {disabledNote}
        </p>
      ) : null}
    </fieldset>
  )
}
