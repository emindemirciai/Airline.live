/**
 * Uçak ikonunun seçimi: silüet sınıfı (ADS-B kategori, yoksa ICAO tip kodu) ve renk türü (THY,
 * diğer, seçili). İkonlar haritaya önceden `hy-ac-<sınıf>-<tür>` adlarıyla eklenir; katman
 * `icon` özelliğinden okur (layers.ts).
 */

export const AIRCRAFT_CATEGORIES = ['heavy', 'jet', 'light', 'rotor', 'unknown'] as const
/** Silüet sınıfı: geniş gövde, jet (dar gövde ve turboprop), hafif uçak, helikopter, bilinmeyen. */
export type AircraftCategory = (typeof AIRCRAFT_CATEGORIES)[number]

export const AIRCRAFT_VARIANTS = ['thy', 'other', 'selected'] as const
/** Renk türü: THY kırmızı-beyaz, diğerleri açık gri, seçili uçak kehribar. */
export type AircraftVariant = (typeof AIRCRAFT_VARIANTS)[number]

/**
 * ADS-B yayıcı kategorisi (DO-260B) → silüet. A2 (küçük, 7–34 t) hafif çizilir; A6 (yüksek
 * performans), B2 (balon), B6 (İHA) ve C* (yer aracı, engel) tabloda yoktur, tip koduna düşer.
 * B1 (planör) ve B4 (ultra hafif) hafif uçak silüetini kullanır.
 */
const CATEGORY_BY_ADSB: Readonly<Record<string, AircraftCategory>> = {
  A1: 'light',
  A2: 'light',
  A3: 'jet',
  A4: 'jet',
  A5: 'heavy',
  A7: 'rotor',
  B1: 'light',
  B4: 'light',
}

/** Bu öneklerle başlayan ICAO tip kodları geniş gövdedir (747, 767, 777, 787, A330, A340, A350, A380). */
const HEAVY_TYPE_PREFIXES = ['A33', 'A34', 'A35', 'A38', 'B74', 'B76', 'B77', 'B78'] as const

/** Önekle yakalanmayan ağır iz türbülansı sınıfındaki tipler (A300, A310, MD-11, DC-10, Il-96 …). */
const HEAVY_TYPES: ReadonlySet<string> = new Set([
  'A306',
  'A30B',
  'A310',
  'A3ST',
  'A124',
  'A225',
  'A400',
  'C5',
  'C5M',
  'C17',
  'DC10',
  'IL62',
  'IL76',
  'IL86',
  'IL96',
  'L101',
  'MD11',
])

/**
 * Kategori yayınlamayan (çoğunlukla MLAT) yaygın genel havacılık tipleri; hafif uçak silüeti
 * alır. Listede olmayan her tip jet sayılır.
 */
const LIGHT_TYPES: ReadonlySet<string> = new Set([
  'BE36',
  'BE58',
  'C150',
  'C152',
  'C172',
  'C182',
  'C206',
  'C208',
  'C210',
  'DA40',
  'DA42',
  'DA62',
  'DV20',
  'M20P',
  'M20T',
  'P28A',
  'P28B',
  'P28R',
  'P32R',
  'PA18',
  'PA34',
  'PA44',
  'PA46',
  'SR20',
  'SR22',
])

/**
 * Silüet sınıfı. Önce ADS-B kategori (A1/A2 hafif, A3/A4 jet, A5 geniş gövde, A7 helikopter),
 * yoksa ICAO tip kodu: bilinen geniş gövdeler `heavy`, bilinen hafif tipler `light`, diğer her tip
 * `jet`. Helikopter tip kodundan güvenilir biçimde çıkarılamaz; yalnızca A7 ile tanınır. Kategori
 * ve tip yoksa `unknown`.
 */
export function aircraftCategory(cat: string | null, type: string | null): AircraftCategory {
  const byCategory = cat === null ? undefined : CATEGORY_BY_ADSB[cat.trim().toUpperCase()]
  if (byCategory !== undefined) return byCategory
  const designator = type === null ? '' : type.trim().toUpperCase()
  if (designator === '') return 'unknown'
  if (
    HEAVY_TYPES.has(designator) ||
    HEAVY_TYPE_PREFIXES.some((prefix) => designator.startsWith(prefix))
  ) {
    return 'heavy'
  }
  if (LIGHT_TYPES.has(designator)) return 'light'
  return 'jet'
}

/** THY çağrı kodu (THY974, THY7RN). */
const THY_CALLSIGN = /^THY/

/** Türk Hava Yolları uçağı mı: sefer no TK ya da çağrı kodu THY ile başlıyor. */
export function isTurkishAirlines(ac: {
  cs: string | null
  fn: { airline: string } | null
}): boolean {
  return ac.fn?.airline === 'TK' || (ac.cs !== null && THY_CALLSIGN.test(ac.cs))
}

/** Seçili uçak her zaman kehribardır; değilse THY ya da diğer. */
export function aircraftVariant(
  ac: { cs: string | null; fn: { airline: string } | null },
  selected: boolean,
): AircraftVariant {
  if (selected) return 'selected'
  return isTurkishAirlines(ac) ? 'thy' : 'other'
}

const SORT_KEY: Readonly<Record<AircraftVariant, number>> = { other: 0, thy: 1, selected: 2 }

/** Katmanın `sort` özelliği: büyük olan üstte çizilir (seçili 2, THY 1, diğer 0). */
export function aircraftSortKey(variant: AircraftVariant): number {
  return SORT_KEY[variant]
}

export type AircraftIconId = `hy-ac-${AircraftCategory}-${AircraftVariant}`

/** Haritaya eklenen ikonun adı: `hy-ac-<sınıf>-<tür>` (ör. `hy-ac-jet-thy`). */
export function aircraftIconId(
  category: AircraftCategory,
  variant: AircraftVariant,
): AircraftIconId {
  return `hy-ac-${category}-${variant}`
}

/** Bütün sınıf × tür ikonları: katman eklenmeden önce hepsi `addImage` ile eklenir. */
export const AIRCRAFT_ICON_IDS: readonly AircraftIconId[] = AIRCRAFT_CATEGORIES.flatMap(
  (category) => AIRCRAFT_VARIANTS.map((variant) => aircraftIconId(category, variant)),
)
