/**
 * Etiket ayarı (domain.md → Harita etiketleri): seçili uçak ve diğer uçaklar için ayrı ayrı
 * Gizle / Kısa / Tam (varsayılan ikisi için de Tam); havalimanları için tek ayar Gizle / Simge /
 * Simge ve kod (varsayılan Simge ve kod; kullanıcı istekleri 2026-10-15, D-114); ülke adları için
 * Gizle / Göster (varsayılan Göster, D-095). Cihazda (localStorage) saklanır. Depolama kapalı ya da
 * bozuk olabilir (gizli pencere, silinmiş site verisi): her erişim korunur, okunamayan değer
 * varsayılana döner.
 *
 * Eski kayıtlar aynı anahtardadır ve geçerlidir: ülke alanı olmayan (v0.18.1) kayıtta ülke adları
 * Göster okunur. v0.18.1–v0.25.1 kayıtlarının havalimanı alanı `airports`'tur (D-084): o sürümlerde
 * Gizle yalnız kodu kaldırıyordu, pin kalıyordu; bu yüzden `'hidden'` Simge, `'code'` ve 2026-10-04'te
 * kaldırılan "Kod ve ad"ın `'name'`'i Simge ve kod okunur (`legacyAirportDisplay`). Geçerli
 * `airportDisplay` her zaman önce gelir. Yayımlanmamış `airportIcons` alanı yok sayılır. Kayıt
 * kendiliğinden yeniden yazılmaz; kullanıcı ayarı değiştirince yalnız yeni biçimle yazılır.
 */
import type { LabelMode } from './label-text'

/**
 * Havalimanları (D-114): Gizle → ne pin ne kod; Simge → pin, kod yok (D-084'ün eski Gizle'si);
 * Simge ve kod → pin ve IATA kodu (z ≥ 5). Gizle'de yalnız açık pencerenin ve `?havalimani=`
 * hedefinin havalimanı çizilir (map-controller.ts → `drawnAirports`).
 */
export type AirportDisplayMode = 'hidden' | 'icon' | 'icon-code'

/** Ülke adları (D-095): başkentlerde yazılır ya da hiç çizilmez. */
export type CountryLabelMode = 'hidden' | 'shown'

export interface LabelSettings {
  selected: LabelMode
  others: LabelMode
  airportDisplay: AirportDisplayMode
  countries: CountryLabelMode
}

/** Seçenek sırası: Gizle, Kısa, Tam (domain.md → Harita etiketleri). */
export const LABEL_MODES: readonly LabelMode[] = ['hidden', 'short', 'full']

/** Seçenek sırası: Gizle, Simge, Simge ve kod (diğer gruplar gibi Gizle önce). */
export const AIRPORT_DISPLAY_MODES: readonly AirportDisplayMode[] = ['hidden', 'icon', 'icon-code']

/** Seçenek sırası: Gizle, Göster (diğer gruplar gibi Gizle önce). */
export const COUNTRY_LABEL_MODES: readonly CountryLabelMode[] = ['hidden', 'shown']

export const DEFAULT_LABEL_SETTINGS: Readonly<LabelSettings> = Object.freeze({
  selected: 'full',
  others: 'full',
  airportDisplay: 'icon-code',
  countries: 'shown',
})

export const LABEL_SETTINGS_KEY = 'hy:map:labels'

export function isLabelMode(value: unknown): value is LabelMode {
  return typeof value === 'string' && (LABEL_MODES as readonly string[]).includes(value)
}

export function isAirportDisplayMode(value: unknown): value is AirportDisplayMode {
  return typeof value === 'string' && (AIRPORT_DISPLAY_MODES as readonly string[]).includes(value)
}

export function isCountryLabelMode(value: unknown): value is CountryLabelMode {
  return typeof value === 'string' && (COUNTRY_LABEL_MODES as readonly string[]).includes(value)
}

/**
 * v0.18.1–v0.25.1 kayıtlarındaki `airports` alanının karşılığı (D-114): `'hidden'` (o sürümlerde pin
 * kalıyordu) → Simge; `'code'` ve kaldırılan "Kod ve ad"ın `'name'`'i → Simge ve kod. Başka değer ya
 * da alan yoksa undefined (varsayılan geçerli olur).
 */
export function legacyAirportDisplay(value: unknown): AirportDisplayMode | undefined {
  if (value === 'hidden') return 'icon'
  if (value === 'code' || value === 'name') return 'icon-code'
  return undefined
}

/** Ayarın kopyası (yalnızca bilinen alanlar). */
export function copyLabelSettings(settings: LabelSettings): LabelSettings {
  return {
    selected: settings.selected,
    others: settings.others,
    airportDisplay: settings.airportDisplay,
    countries: settings.countries,
  }
}

/** İki ayar aynı mı (bütün alanlar). */
export function sameLabelSettings(a: LabelSettings, b: LabelSettings): boolean {
  return (
    a.selected === b.selected &&
    a.others === b.others &&
    a.airportDisplay === b.airportDisplay &&
    a.countries === b.countries
  )
}

/** Okunamayan ya da geçersiz alan varsayılanına döner; eski havalimanı alanı çevrilir. */
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
  const { selected, others, airportDisplay, airports, countries } = value as Record<string, unknown>
  return {
    selected: isLabelMode(selected) ? selected : defaults.selected,
    others: isLabelMode(others) ? others : defaults.others,
    airportDisplay: isAirportDisplayMode(airportDisplay)
      ? airportDisplay
      : (legacyAirportDisplay(airports) ?? defaults.airportDisplay),
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
