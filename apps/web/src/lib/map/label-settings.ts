/**
 * Etiket ayarı (domain.md → Harita etiketleri): seçili uçak ve diğer uçaklar için ayrı ayrı
 * Gizle / Kısa / Tam (varsayılan ikisi için de Tam); havalimanları için Gizle / Kod / Kod ve ad
 * (varsayılan Kod, kullanıcı kararı 2026-10-03, D-084). Cihazda (localStorage) saklanır. Depolama
 * kapalı ya da bozuk olabilir (gizli pencere, silinmiş site verisi): her erişim korunur, okunamayan
 * değer varsayılana döner. Havalimanı alanı olmayan eski kayıt geçerlidir (havalimanları Kod).
 */
import type { LabelMode } from './label-text'

/** Havalimanı etiketi: yazı yok (pin kalır), IATA kodu ya da kod ve kısa ad. */
export type AirportLabelMode = 'hidden' | 'code' | 'name'

export interface LabelSettings {
  selected: LabelMode
  others: LabelMode
  airports: AirportLabelMode
}

/** Seçenek sırası: Gizle, Kısa, Tam (domain.md → Harita etiketleri). */
export const LABEL_MODES: readonly LabelMode[] = ['hidden', 'short', 'full']

/** Seçenek sırası: Gizle, Kod, Kod ve ad. */
export const AIRPORT_LABEL_MODES: readonly AirportLabelMode[] = ['hidden', 'code', 'name']

export const DEFAULT_LABEL_SETTINGS: Readonly<LabelSettings> = Object.freeze({
  selected: 'full',
  others: 'full',
  airports: 'code',
})

export const LABEL_SETTINGS_KEY = 'hy:map:labels'

export function isLabelMode(value: unknown): value is LabelMode {
  return typeof value === 'string' && (LABEL_MODES as readonly string[]).includes(value)
}

export function isAirportLabelMode(value: unknown): value is AirportLabelMode {
  return typeof value === 'string' && (AIRPORT_LABEL_MODES as readonly string[]).includes(value)
}

/** Ayarın kopyası (yalnızca bilinen alanlar). */
export function copyLabelSettings(settings: LabelSettings): LabelSettings {
  return { selected: settings.selected, others: settings.others, airports: settings.airports }
}

/** İki ayar aynı mı (bütün alanlar). */
export function sameLabelSettings(a: LabelSettings, b: LabelSettings): boolean {
  return a.selected === b.selected && a.others === b.others && a.airports === b.airports
}

/** Okunamayan ya da geçersiz alan varsayılanına döner. */
export function loadLabelSettings(storage: Pick<Storage, 'getItem'> | null): LabelSettings {
  const defaults = copyLabelSettings(DEFAULT_LABEL_SETTINGS)
  if (!storage) return defaults
  let value: unknown
  try {
    const raw = storage.getItem(LABEL_SETTINGS_KEY)
    if (raw === null) return defaults
    value = JSON.parse(raw)
  } catch {
    return defaults
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return defaults
  const { selected, others, airports } = value as Record<string, unknown>
  return {
    selected: isLabelMode(selected) ? selected : defaults.selected,
    others: isLabelMode(others) ? others : defaults.others,
    airports: isAirportLabelMode(airports) ? airports : defaults.airports,
  }
}

/** Yazılamazsa (kota, kapalı depolama) sessizce geçer; ayar bu oturumda geçerli kalır. */
export function saveLabelSettings(
  storage: Pick<Storage, 'setItem'> | null,
  settings: LabelSettings,
): void {
  if (!storage) return
  try {
    storage.setItem(LABEL_SETTINGS_KEY, JSON.stringify(copyLabelSettings(settings)))
  } catch {
    // Depolama kullanılamıyor: ayar yalnızca bu sayfa açıkken geçerlidir.
  }
}
