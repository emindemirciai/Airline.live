import type { Locale, LocalizedText } from '../locale'

/**
 * Ülke adları (D-080). ISO 3166-1 alpha-2 kodunun adı `Intl.DisplayNames` (`type: 'region'`) ile
 * sayfanın dilinde yazılır: GR → "Yunanistan" / "Greece". Kod tablosu tutulmaz; ad tarayıcının ve
 * Node'un CLDR verisinden gelir. Üç ayrım vardır:
 * - XK (Kosova) ISO 3166-1'de kullanıcı tanımlı bir koddur; `Intl` adını bilmiyorsa (kodu geri
 *   verirse) "Kosova" / "Kosovo" yazılır.
 * - Ercan (LCEN): OurAirports ülkesi CY'dir; kullanıcı kararıyla (2026-10-02) KKTC olarak
 *   gösterilir. Bu, havalimanına (ICAO) bağlı bir görünüm kuralıdır; veri (`country`) değişmez.
 *   Tartışmalı bölgelerdeki diğer havalimanları OurAirports ülkesini korur (Sohum → Gürcistan,
 *   Priştine → Kosova).
 * - İngilizce CLDR adlarındaki "&" yazıda "and" olur (D-088): "Bosnia & Herzegovina" →
 *   "Bosnia and Herzegovina" (Birleşik Krallık hükümeti ve BM yazımı; sonraki halkalarda "Trinidad &
 *   Tobago", "Antigua & Barbuda" de aynı kurala girer). Türkçe adlar değişmez ("Bosna-Hersek").
 */

const INTL_LOCALE: Record<Locale, string> = { tr: 'tr-TR', en: 'en-GB' }

/** ISO 3166-1 alpha-2 biçimi. */
const COUNTRY_CODE = /^[A-Z]{2}$/

/** `Intl`'in bilmeyebileceği kullanıcı tanımlı kodlar. */
const FALLBACK_COUNTRY_NAMES: Readonly<Record<string, LocalizedText>> = {
  XK: { tr: 'Kosova', en: 'Kosovo' },
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
 * büyük harfe çevrilir. Ad bilinmiyorsa ya da kod biçimsizse kodun kendisi döner (boş kodda boş
 * metin): ülke satırı hiçbir zaman düşmez.
 */
export function countryName(code: string, locale: Locale): string {
  const normalized = code.trim().toUpperCase()
  if (!COUNTRY_CODE.test(normalized)) return normalized
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
