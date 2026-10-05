/**
 * Etiket ayarı (domain.md → Harita etiketleri): seçili uçak ve diğer uçaklar için ayrı ayrı
 * Gizle / Kısa / Tam (varsayılan ikisi için de Tam); havalimanları için Gizle / Kod (varsayılan
 * Kod, kullanıcı kararı 2026-10-03, D-084); ülke adları için Gizle / Göster (varsayılan Göster,
 * D-095). Cihazda (localStorage) saklanır. Depolama kapalı ya da bozuk olabilir (gizli pencere,
 * silinmiş site verisi): her erişim korunur, okunamayan değer varsayılana döner. Havalimanı ya da
 * ülke alanı olmayan eski kayıt geçerlidir (havalimanları Kod, ülke adları Göster; v0.18.1 kaydı
 * aynı anahtardadır). "Kod ve ad" 2026-10-04'te kullanıcı isteğiyle kaldırıldı (D-084): o seçenekle
 * saklanmış `'name'` değeri de Kod okunur.
 */
import type { LabelMode } from './label-text'

/** Havalimanı etiketi: yazı yok (pin kalır) ya da IATA kodu. */
export type AirportLabelMode = 'hidden' | 'code'

/** Ülke adları (D-095): başkentlerde yazılır ya da hiç çizilmez. */
export type CountryLabelMode = 'hidden' | 'shown'

export interface LabelSettings {
  selected: LabelMode
  others: LabelMode
  airports: AirportLabelMode
  countries: CountryLabelMode
}

/** Seçenek sırası: Gizle, Kısa, Tam (domain.md → Harita etiketleri). */
export const LABEL_MODES: readonly LabelMode[] = ['hidden', 'short', 'full']

/** Seçenek sırası: Gizle, Kod. */
export const AIRPORT_LABEL_MODES: readonly AirportLabelMode[] = ['hidden', 'code']

/** Seçenek sırası: Gizle, Göster (diğer gruplar gibi Gizle önce). */
export const COUNTRY_LABEL_MODES: readonly CountryLabelMode[] = ['hidden', 'shown']

export const DEFAULT_LABEL_SETTINGS: Readonly<LabelSettings> = Object.freeze({
  selected: 'full',
  others: 'full',
  airports: 'code',
  countries: 'shown',
})

export const LABEL_SETTINGS_KEY = 'hy:map:labels'

export function isLabelMode(value: unknown): value is LabelMode {
  return typeof value === 'string' && (LABEL_MODES as readonly string[]).includes(value)
}

export function isAirportLabelMode(value: unknown): value is AirportLabelMode {
  return typeof value === 'string' && (AIRPORT_LABEL_MODES as readonly string[]).includes(value)
}

export function isCountryLabelMode(value: unknown): value is CountryLabelMode {
  return typeof value === 'string' && (COUNTRY_LABEL_MODES as readonly string[]).includes(value)
}

/** Ayarın kopyası (yalnızca bilinen alanlar). */
export function copyLabelSettings(settings: LabelSettings): LabelSettings {
  return {
    selected: settings.selected,
    others: settings.others,
    airports: settings.airports,
    countries: settings.countries,
  }
}

/** İki ayar aynı mı (bütün alanlar). */
export function sameLabelSettings(a: LabelSettings, b: LabelSettings): boolean {
  return (
    a.selected === b.selected &&
    a.others === b.others &&
    a.airports === b.airports &&
    a.countries === b.countries
  )
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
  const { selected, others, airports, countries } = value as Record<string, unknown>
  return {
    selected: isLabelMode(selected) ? selected : defaults.selected,
    others: isLabelMode(others) ? others : defaults.others,
    airports: isAirportLabelMode(airports) ? airports : defaults.airports,
    countries: isCountryLabelMode(countries) ? countries : defaults.countries,
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
