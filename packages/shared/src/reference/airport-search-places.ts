/**
 * Havalimanı aramasının (D-108) yalnız aranan, hiçbir zaman gösterilmeyen ek adları: verinin
 * vermediği ama herkesin kullandığı şehir ve kısa adlar. Satırda havalimanının gerçek yeri yazılır
 * (Çukurova Mersin'dedir); "Adana" yalnız onu bulur. Düz nesnelerdir (çağrı yok): onları kullanmayan
 * paketten (haritanın ilk paketi, D-101) paketleyici atar. Hiçbir şey içe aktarmaz.
 */

/**
 * Havalimanının (ICAO) yalnız aranan yerleri:
 * - LTDB Çukurova (COV): Adana'nın tarifeli trafiği buradadır; Adana Şakirpaşa (LTAF) OurAirports'ta
 *   tarifesiz küçük havalimanıdır, listelenmez. Tarsus ve Mersin veriden gelir.
 * - LTAJ Gaziantep (GZT) "Antep", LTCS Şanlıurfa GAP (GNY) "Urfa", LTCN Kahramanmaraş (KCM) "Maraş":
 *   şehirlerin gündelik adları (yalnız sözcük başı eşleştiği için "antep" "Gaziantep"i bulmaz).
 * - LTBZ Zafer (KZR): Kütahya, Afyonkarahisar ve Uşak'ın ortak havalimanı; il verisi yalnız Kütahya'dır.
 *   Afyon'daki askerî üs (LTAH) sitede yoktur (D-107). Uşak'ın kendi havalimanı (LTBO) listededir.
 * - LTBQ Kocaeli Cengiz Topel (KCO) "İzmit", LTBS Muğla Dalaman (DLM) "Fethiye".
 */
export const AIRPORT_SEARCH_PLACES: Readonly<Record<string, readonly string[]>> = {
  LTDB: ['Adana'],
  LTAJ: ['Antep'],
  LTCS: ['Urfa'],
  LTCN: ['Maraş'],
  LTBZ: ['Afyon', 'Afyonkarahisar'],
  LTBQ: ['İzmit'],
  LTBS: ['Fethiye'],
}

/**
 * Ülkenin (ISO 3166-1 alpha-2) yalnız aranan adları: Türkiye'nin CLDR 42'ye (2022) kadarki İngilizce
 * adı "Turkey" (site İngilizcede de "Türkiye" yazar).
 */
export const AIRPORT_SEARCH_COUNTRY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  TR: ['Turkey'],
}

const NONE: readonly string[] = []

/** Havalimanının yalnız aranan yerleri (ICAO); yoksa boş. */
export function airportSearchPlaces(icao: string): readonly string[] {
  return Object.hasOwn(AIRPORT_SEARCH_PLACES, icao) ? (AIRPORT_SEARCH_PLACES[icao] ?? NONE) : NONE
}

/** Ülkenin yalnız aranan adları (ISO kodu); yoksa boş. */
export function countrySearchAliases(country: string): readonly string[] {
  return Object.hasOwn(AIRPORT_SEARCH_COUNTRY_ALIASES, country)
    ? (AIRPORT_SEARCH_COUNTRY_ALIASES[country] ?? NONE)
    : NONE
}
