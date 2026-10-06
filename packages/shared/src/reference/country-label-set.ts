import type { LocalizedText } from '../locale'

/**
 * Haritada adı yazılan ülkelerin elle tutulan kuralları (D-095, D-099, D-100). Ülke kümesi ve
 * yüzölçümleri üreticidedir (tools/src/country-labels): Natural Earth 4.1.0'ın ISO 3166-1 kodlu
 * bütün birimleri (deniz aşırı bölgeler kendi kodlarıyla), İsrail, Filistin ve Antarktika hariç.
 * Haritaya giren küme ve alanlar üretilen tablodadır (`COUNTRY_LABEL_PLACEMENTS`,
 * `COUNTRY_LABEL_AREAS_KM2`). Ad `countryLabelText` ile `Intl`'den gelir. Genel coğrafi bilgidir; bir
 * veri sağlayıcısı (`packages/providers`) değildir: hiçbir şey indirilmez, `DATA_USAGE_MODE` kapısı
 * yoktur.
 */

/** Ad boyu kademesi: 1 büyük, 2 orta, 3 küçük ülke. */
export type CountryLabelTier = 1 | 2 | 3

/** Kademe 1'in en küçük yüzölçümü, km² (Türkiye 783.600 km² kademe 1, Ukrayna 603.600 km² 2). */
export const TIER_1_MIN_AREA_KM2 = 700_000
/** Kademe 2'nin en küçük yüzölçümü, km² (Azerbaycan 86.600 km² 2, Avusturya 83.900 km² 3). */
export const TIER_2_MIN_AREA_KM2 = 85_000

/**
 * Yüzölçümünden ayrılan kademeler: Irak (438.300 km²) kullanıcının seçtiği tasarımda (A) kademe 1
 * boyunda çizilmiştir.
 */
export const COUNTRY_TIER_OVERRIDES: Readonly<Record<string, CountryLabelTier>> = { IQ: 1 }

/** Ülkenin ad kademesi: önce `COUNTRY_TIER_OVERRIDES`, sonra yüzölçümü eşikleri. */
export function countryLabelTier(country: { code: string; areaKm2: number }): CountryLabelTier {
  const override = Object.hasOwn(COUNTRY_TIER_OVERRIDES, country.code)
    ? COUNTRY_TIER_OVERRIDES[country.code]
    : undefined
  if (override !== undefined) return override
  if (country.areaKm2 >= TIER_1_MIN_AREA_KM2) return 1
  if (country.areaKm2 >= TIER_2_MIN_AREA_KM2) return 2
  return 3
}

/**
 * Natural Earth'te birimi olduğu hâlde adı yazılmayan ülkeler: başkenti tartışmalı İsrail ve
 * Filistin (orkestratör varsayılanı; kullanıcı 2026-10-05'te bu hâliyle tasarım A'yı onayladı).
 * Antarktika ülke değildir, o da yazılmaz (D-100).
 */
export const UNLABELLED_COUNTRIES: readonly string[] = ['IL', 'PS']

/**
 * D-095 tablosunun yüzölçümleri (59 ülke), km², iç sular dahil, 100 km²'ye yuvarlı: kademe ve
 * katmanlardaki sıra bunlarla hesaplanır. Fransa, Danimarka ve Hollanda yalnızca Avrupa'daki
 * toprağıyla; Sırbistan Kosova'sız; Kıbrıs adanın tamamıyla. Öbür ülkelerin yüzölçümü Natural
 * Earth poligonlarından hesaplanır (küre üzerinde, km²'ye yuvarlı; D-100).
 */
export const COUNTRY_AREA_OVERRIDES_KM2: Readonly<Record<string, number>> = {
  AE: 83_600,
  AF: 652_200,
  AL: 28_700,
  AM: 29_700,
  AT: 83_900,
  AZ: 86_600,
  BA: 51_200,
  BE: 30_700,
  BG: 111_000,
  BH: 800,
  BY: 207_600,
  CH: 41_300,
  CY: 9_300,
  CZ: 78_900,
  DE: 357_600,
  DK: 42_900,
  DZ: 2_381_700,
  EE: 45_300,
  EG: 1_001_500,
  ES: 506_000,
  FR: 551_700,
  GE: 69_700,
  GR: 132_000,
  HR: 56_600,
  HU: 93_000,
  IQ: 438_300,
  IR: 1_648_200,
  IT: 301_300,
  JO: 89_300,
  KW: 17_800,
  KZ: 2_724_900,
  LB: 10_500,
  LT: 65_300,
  LU: 2_600,
  LV: 64_600,
  LY: 1_759_500,
  MD: 33_800,
  ME: 13_800,
  MK: 25_700,
  MT: 300,
  NL: 41_900,
  OM: 309_500,
  PL: 312_700,
  QA: 11_600,
  RO: 238_400,
  RS: 77_500,
  RU: 17_098_200,
  SA: 2_149_700,
  SD: 1_861_500,
  SE: 450_300,
  SI: 20_300,
  SK: 49_000,
  SY: 185_200,
  TM: 491_200,
  TN: 163_600,
  TR: 783_600,
  UA: 603_600,
  UZ: 449_000,
  XK: 10_900,
}

/** Adı başkentinde sabit ülkenin başkenti: adı (yalnızca okuyan için) ve şehir merkezi (0,01°). */
export interface CountryLabelCapitalAnchor {
  capital: LocalizedText
  lat: number
  lon: number
}

/**
 * Adı boş yer kuralı (D-099) yerine başkentinde yazılan ülkeler: KIBRIS / CYPRUS Lefkoşa'da (D-095,
 * kullanıcının kararı). Ercan (LCEN) pini ve kodu adın kutusundadır; pinler adların üstünde çizilir.
 */
export const COUNTRY_LABEL_CAPITAL_ANCHORS: Readonly<Record<string, CountryLabelCapitalAnchor>> = {
  CY: { capital: { tr: 'Lefkoşa', en: 'Nicosia' }, lat: 35.17, lon: 33.36 },
}
