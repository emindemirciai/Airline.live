import type { Locale, LocalizedText } from '../locale'

/**
 * Ülke adları (D-080). ISO 3166-1 alpha-2 kodunun adı `Intl.DisplayNames` (`type: 'region'`) ile
 * sayfanın dilinde yazılır: GR → "Yunanistan" / "Greece". Kod tablosu tutulmaz; ad tarayıcının ve
 * Node'un CLDR verisinden gelir. Dört ayrım vardır:
 * - XK (Kosova) ISO 3166-1'de kullanıcı tanımlı bir koddur; `Intl` adını bilmiyorsa (kodu geri
 *   verirse) "Kosova" / "Kosovo" yazılır.
 * - Ercan (LCEN): OurAirports ülkesi CY'dir; kullanıcı kararıyla (2026-10-02) KKTC olarak
 *   gösterilir. Bu, havalimanına (ICAO) bağlı bir görünüm kuralıdır; veri (`country`) değişmez.
 *   Tartışmalı bölgelerdeki diğer havalimanları OurAirports ülkesini korur (Sohum → Gürcistan,
 *   Priştine → Kosova).
 * - İngilizce CLDR adlarındaki "&" yazıda "and" olur (D-088): "Bosnia & Herzegovina" →
 *   "Bosnia and Herzegovina" (Birleşik Krallık hükümeti ve BM yazımı; sonraki halkalarda "Trinidad &
 *   Tobago", "Antigua & Barbuda" de aynı kurala girer). Türkçe adlar değişmez ("Bosna-Hersek").
 * - Birkaç ülkenin CLDR adı yerine elle tutulan ad yazılır (`COUNTRY_NAME_OVERRIDES`, D-100):
 *   CLDR'ın ayırt edici biçimleri ("Kongo - Kinşasa", "Myanmar (Burma)") ve Türkçe CLDR'ın Fransızca
 *   adı ("Côte d’Ivoire"). Kural ülkeye bağlıdır: havalimanı sayfası, pencere, liste ve haritadaki ad
 *   aynıdır; 4. halkanın (D-102) iki Kongo ve Fildişi Sahili havalimanları da bu adları taşır.
 */

const INTL_LOCALE: Record<Locale, string> = { tr: 'tr-TR', en: 'en-GB' }

/** ISO 3166-1 alpha-2 biçimi. */
const COUNTRY_CODE = /^[A-Z]{2}$/

/** `Intl`'in bilmeyebileceği kullanıcı tanımlı kodlar. */
const FALLBACK_COUNTRY_NAMES: Readonly<Record<string, LocalizedText>> = {
  XK: { tr: 'Kosova', en: 'Kosovo' },
}

/**
 * CLDR adının yerine yazılan ülke adları (D-100; orkestratör varsayılanı, itiraz edilebilir). CLDR'ın
 * iki Kongo'yu başkentle ayırması ("Kongo - Kinşasa" / "Congo - Kinshasa", "Kongo - Brazavil" /
 * "Congo - Brazzaville") haritada başkent adı ülke adının altına düşer gibi okunur; resmî adlar
 * yazılır. "Myanmar (Burma)" ayraçlı eşadı bırakır. Türkçe CLDR Fildişi Sahili'nin Fransızca adını
 * tutar ("Côte d’Ivoire"; Türkçe büyük harfte "IVOİRE" olurdu); İngilizce ad CLDR'ınkiyle aynıdır
 * (tipografik kesme işaretiyle). "Svalbard ve Jan Mayen": ad Svalbard'da yazılır; Jan Mayen'de ne ad
 * ne listelenen havalimanı vardır.
 */
export const COUNTRY_NAME_OVERRIDES: Readonly<Record<string, LocalizedText>> = {
  CD: { tr: 'Kongo Demokratik Cumhuriyeti', en: 'Democratic Republic of the Congo' },
  CG: { tr: 'Kongo Cumhuriyeti', en: 'Republic of the Congo' },
  CI: { tr: 'Fildişi Sahili', en: 'Côte d’Ivoire' },
  MM: { tr: 'Myanmar', en: 'Myanmar' },
  SJ: { tr: 'Svalbard', en: 'Svalbard' },
}

/** Havalimanına bağlı ülke görünümü: kısa ve uzun ad. */
export interface DisplayedCountry {
  short: LocalizedText
  long: LocalizedText
}

/** Kuzey Kıbrıs Türk Cumhuriyeti (KKTC / TRNC). */
export const KKTC: DisplayedCountry = {
  short: { tr: 'KKTC', en: 'TRNC' },
  long: { tr: 'Kuzey Kıbrıs Türk Cumhuriyeti', en: 'Turkish Republic of Northern Cyprus' },
}

/** OurAirports ülkesinin yerine gösterilen ülke, ICAO koduna göre (kullanıcı kararı 2026-10-02). */
export const AIRPORT_COUNTRY_OVERRIDES: Readonly<Record<string, DisplayedCountry>> = {
  LCEN: KKTC,
}

const displayNames = new Map<Locale, Intl.DisplayNames>()

function regionNames(locale: Locale): Intl.DisplayNames {
  let names = displayNames.get(locale)
  if (names === undefined) {
    names = new Intl.DisplayNames(INTL_LOCALE[locale], { type: 'region', fallback: 'code' })
    displayNames.set(locale, names)
  }
  return names
}

/**
 * ISO 3166-1 alpha-2 kodunun adı, verilen dilde ("GR" → "Yunanistan" / "Greece"). Kod kırpılıp
 * büyük harfe çevrilir. Önce `COUNTRY_NAME_OVERRIDES`, sonra `Intl`. Ad bilinmiyorsa ya da kod
 * biçimsizse kodun kendisi döner (boş kodda boş metin): ülke satırı hiçbir zaman düşmez.
 */
export function countryName(code: string, locale: Locale): string {
  const normalized = code.trim().toUpperCase()
  if (!COUNTRY_CODE.test(normalized)) return normalized
  if (Object.hasOwn(COUNTRY_NAME_OVERRIDES, normalized)) {
    const override = COUNTRY_NAME_OVERRIDES[normalized]?.[locale]
    if (override !== undefined) return override
  }
  let name: string | undefined
  try {
    name = regionNames(locale).of(normalized)
  } catch {
    name = undefined
  }
  if (name !== undefined && name !== '' && name !== normalized) {
    return locale === 'en' ? name.replaceAll(' & ', ' and ') : name
  }
  return Object.hasOwn(FALLBACK_COUNTRY_NAMES, normalized)
    ? (FALLBACK_COUNTRY_NAMES[normalized]?.[locale] ?? normalized)
    : normalized
}

/**
 * Haritadaki ülke adı (D-095): `countryName`, sayfanın dilinin büyük harf kuralıyla. Türkçede
 * "i" → "İ" ("TÜRKİYE", "KIBRIS"), İngilizcede "i" → "I" ("TÜRKIYE", "ALGERIA"). Ülkeye bağlıdır;
 * havalimanına bağlı KKTC görünümü (`airportCountryName`) burada uygulanmaz: Kıbrıs'ın adı
 * Lefkoşa'da "KIBRIS" / "CYPRUS" yazılır.
 */
export function countryLabelText(code: string, locale: Locale): string {
  return countryName(code, locale).toLocaleUpperCase(INTL_LOCALE[locale])
}

/** Havalimanının ülke görünümü kuralı (yoksa undefined). ICAO kırpılıp büyük harfe çevrilir. */
function countryOverride(icao: string): DisplayedCountry | undefined {
  const code = icao.trim().toUpperCase()
  return Object.hasOwn(AIRPORT_COUNTRY_OVERRIDES, code)
    ? AIRPORT_COUNTRY_OVERRIDES[code]
    : undefined
}

/**
 * Havalimanının sayfada, pencerede ve listede gösterilen ülkesi: `countryName(country)`; Ercan
 * (LCEN) için KKTC. `style`: `short` (varsayılan; "KKTC" / "TRNC") ya da `long` ("Kuzey Kıbrıs Türk
 * Cumhuriyeti" / "Turkish Republic of Northern Cyprus"). Diğer ülkelerde iki biçim aynıdır.
 */
export function airportCountryName(
  airport: { icao: string; country: string },
  locale: Locale,
  style: 'short' | 'long' = 'short',
): string {
  const override = countryOverride(airport.icao)
  if (override !== undefined) return override[style][locale]
  return countryName(airport.country, locale)
}

/**
 * Gösterilen ülkenin ISO 3166-1 alpha-2 kodu (ör. JSON-LD `addressCountry`). Gösterilen ülke veri
 * kodundan ayrılıyorsa (Ercan: KKTC, kod CY) null: KKTC'nin ISO 3166-1 kodu yoktur, CY yazmak
 * sayfadaki ülkeyle çelişir. Kod kırpılıp büyük harfe çevrilir; biçimsizse null.
 */
export function airportCountryCode(airport: { icao: string; country: string }): string | null {
  if (countryOverride(airport.icao) !== undefined) return null
  const code = airport.country.trim().toUpperCase()
  return COUNTRY_CODE.test(code) ? code : null
}
