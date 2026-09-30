/**
 * Etiket ayarı (domain.md → Harita etiketleri): seçili uçak ve diğer uçaklar için ayrı ayrı
 * Gizle / Kısa / Tam; varsayılan ikisi için de Tam. Cihazda (localStorage) saklanır. Depolama
 * kapalı ya da bozuk olabilir (gizli pencere, silinmiş site verisi): her erişim korunur, okunamayan
 * değer varsayılana döner.
 */
import type { LabelMode } from './label-text'

export interface LabelSettings {
  selected: LabelMode
  others: LabelMode
}

/** Seçenek sırası: Gizle, Kısa, Tam (domain.md → Harita etiketleri). */
export const LABEL_MODES: readonly LabelMode[] = ['hidden', 'short', 'full']

export const DEFAULT_LABEL_SETTINGS: Readonly<LabelSettings> = Object.freeze({
  selected: 'full',
  others: 'full',
})

export const LABEL_SETTINGS_KEY = 'hy:map:labels'

export function isLabelMode(value: unknown): value is LabelMode {
  return typeof value === 'string' && (LABEL_MODES as readonly string[]).includes(value)
}

/** Okunamayan ya da geçersiz alan varsayılanına döner. */
export function loadLabelSettings(storage: Pick<Storage, 'getItem'> | null): LabelSettings {
  const defaults = { ...DEFAULT_LABEL_SETTINGS }
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
  const { selected, others } = value as Record<string, unknown>
  return {
    selected: isLabelMode(selected) ? selected : defaults.selected,
    others: isLabelMode(others) ? others : defaults.others,
  }
}

/** Yazılamazsa (kota, kapalı depolama) sessizce geçer; ayar bu oturumda geçerli kalır. */
export function saveLabelSettings(
  storage: Pick<Storage, 'setItem'> | null,
  settings: LabelSettings,
): void {
  if (!storage) return
  try {
    storage.setItem(
      LABEL_SETTINGS_KEY,
      JSON.stringify({ selected: settings.selected, others: settings.others }),
    )
  } catch {
    // Depolama kullanılamıyor: ayar yalnızca bu sayfa açıkken geçerlidir.
  }
}
