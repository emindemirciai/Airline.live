import type { LocalizedText } from '../locale'

/**
 * Haritada ülke adının yazıldığı başkentler (D-095). Genel coğrafi bilgidir; bir veri sağlayıcısı
 * (`packages/providers`) değildir: hiçbir şey indirilmez, `DATA_USAGE_MODE` kapısı yoktur.
 *
 * - `code`: ISO 3166-1 alpha-2 (Kosova XK). Ad `countryLabelText` ile `Intl`'den gelir.
 * - `capital`: başkentin Türkçe ve İngilizce adı; yalnızca okuyan için, haritada yazılmaz.
 * - `lat`, `lon`: şehir merkezi, 0,01 dereceye yuvarlanmış.
 * - `areaKm2`: iç sular dahil toplam yüzölçümü, 100 km²'ye yuvarlanmış. Fransa, Danimarka ve
 *   Hollanda yalnızca Avrupa'daki toprağıyla; Sırbistan Kosova'sız; Kıbrıs adanın tamamıyla. Ad
 *   boyunu (kademe) ve yerleşim önceliğini belirler.
 * - `labelOffsetEm`: isteğe bağlı; adın başkentten kayması, em, [sağa, aşağı] (yazı boyuyla
 *   ölçeklenir). Kural "ad başkentte ortalı"dır; istisna yalnızca adın başka türlü hiç yer
 *   bulamadığı ülkeye verilir (D-095). Bugün tek istisna Slovakya'dır: Bratislava Viyana'nın
 *   ~55 km doğusunda ve yalnızca 0,06° güneyindedir; daha büyük olan Avusturya önce yerleştiğinden
 *   SLOVAKYA, adlar silinmeye başlayana (z7) kadar hiçbir yakınlaştırmada tam görünmüyordu. Ad
 *   2,5 em yukarıda, Bratislava'nın kuzeyinde (Slovakya'nın içinde) AVUSTURYA'nın çakışma
 *   kutusunun üstünde kalır. Yerleşim modeli testi (country-label-placement.test.ts) her başkentin
 *   adının silinmeden önce yerleştiğini ve istisnanın hâlâ gerektiğini denetler.
 *
 * Kapsam: listelenen havalimanı olan her ülke (Türkiye ve açık halkalar, `ENABLED_AIRPORT_RING`),
 * İsrail hariç; artı "boşluk" ülkesi Ukrayna (`HOLE_COUNTRIES`). Yeni halka açılınca kapsam testi
 * kırılır ve yeni ülkelerin başkentleri buraya eklenir.
 */
export interface CountryCapital {
  code: string
  capital: LocalizedText
  lat: number
  lon: number
  areaKm2: number
  labelOffsetEm?: readonly [x: number, y: number]
}

function row(
  code: string,
  tr: string,
  en: string,
  lat: number,
  lon: number,
  areaKm2: number,
  labelOffsetEm?: readonly [x: number, y: number],
): CountryCapital {
  const capital: CountryCapital = { code, capital: { tr, en }, lat, lon, areaKm2 }
  if (labelOffsetEm) capital.labelOffsetEm = labelOffsetEm
  return capital
}

/**
 * Başkentler, koda göre sıralı: kod, başkentin Türkçe ve İngilizce adı, enlem, boylam, km², varsa
 * adın kayması (em).
 */
export const COUNTRY_CAPITALS: readonly CountryCapital[] = [
  row('AE', 'Abu Dabi', 'Abu Dhabi', 24.45, 54.38, 83_600),
  row('AF', 'Kabil', 'Kabul', 34.53, 69.18, 652_200),
  row('AL', 'Tiran', 'Tirana', 41.33, 19.82, 28_700),
  row('AM', 'Erivan', 'Yerevan', 40.18, 44.51, 29_700),
  row('AT', 'Viyana', 'Vienna', 48.21, 16.37, 83_900),
  row('AZ', 'Bakü', 'Baku', 40.41, 49.87, 86_600),
  row('BA', 'Saraybosna', 'Sarajevo', 43.86, 18.41, 51_200),
  row('BE', 'Brüksel', 'Brussels', 50.85, 4.35, 30_700),
  row('BG', 'Sofya', 'Sofia', 42.7, 23.32, 111_000),
  row('BH', 'Manama', 'Manama', 26.23, 50.59, 800),
  row('BY', 'Minsk', 'Minsk', 53.9, 27.56, 207_600),
  row('CH', 'Bern', 'Bern', 46.95, 7.45, 41_300),
  row('CY', 'Lefkoşa', 'Nicosia', 35.17, 33.36, 9_300),
  row('CZ', 'Prag', 'Prague', 50.08, 14.44, 78_900),
  row('DE', 'Berlin', 'Berlin', 52.52, 13.4, 357_600),
  row('DK', 'Kopenhag', 'Copenhagen', 55.68, 12.57, 42_900),
  row('DZ', 'Cezayir', 'Algiers', 36.75, 3.06, 2_381_700),
  row('EE', 'Tallinn', 'Tallinn', 59.44, 24.75, 45_300),
  row('EG', 'Kahire', 'Cairo', 30.04, 31.24, 1_001_500),
  row('ES', 'Madrid', 'Madrid', 40.42, -3.7, 506_000),
  row('FR', 'Paris', 'Paris', 48.86, 2.35, 551_700),
  row('GE', 'Tiflis', 'Tbilisi', 41.71, 44.8, 69_700),
  row('GR', 'Atina', 'Athens', 37.98, 23.73, 132_000),
  row('HR', 'Zagreb', 'Zagreb', 45.81, 15.98, 56_600),
  row('HU', 'Budapeşte', 'Budapest', 47.5, 19.04, 93_000),
  row('IQ', 'Bağdat', 'Baghdad', 33.32, 44.37, 438_300),
  row('IR', 'Tahran', 'Tehran', 35.69, 51.39, 1_648_200),
  row('IT', 'Roma', 'Rome', 41.9, 12.5, 301_300),
  row('JO', 'Amman', 'Amman', 31.95, 35.93, 89_300),
  row('KW', 'Kuveyt', 'Kuwait City', 29.38, 47.98, 17_800),
  row('KZ', 'Astana', 'Astana', 51.17, 71.44, 2_724_900),
  row('LB', 'Beyrut', 'Beirut', 33.89, 35.5, 10_500),
  row('LT', 'Vilnius', 'Vilnius', 54.69, 25.28, 65_300),
  row('LU', 'Lüksemburg', 'Luxembourg', 49.61, 6.13, 2_600),
  row('LV', 'Riga', 'Riga', 56.95, 24.11, 64_600),
  row('LY', 'Trablus', 'Tripoli', 32.89, 13.19, 1_759_500),
  row('MD', 'Kişinev', 'Chișinău', 47.01, 28.86, 33_800),
  row('ME', 'Podgorica', 'Podgorica', 42.44, 19.26, 13_800),
  row('MK', 'Üsküp', 'Skopje', 42, 21.43, 25_700),
  row('MT', 'Valletta', 'Valletta', 35.9, 14.51, 300),
  row('NL', 'Amsterdam', 'Amsterdam', 52.37, 4.9, 41_900),
  row('OM', 'Maskat', 'Muscat', 23.59, 58.41, 309_500),
  row('PL', 'Varşova', 'Warsaw', 52.23, 21.01, 312_700),
  row('QA', 'Doha', 'Doha', 25.29, 51.53, 11_600),
  row('RO', 'Bükreş', 'Bucharest', 44.43, 26.1, 238_400),
  row('RS', 'Belgrad', 'Belgrade', 44.8, 20.46, 77_500),
  row('RU', 'Moskova', 'Moscow', 55.76, 37.62, 17_098_200),
  row('SA', 'Riyad', 'Riyadh', 24.7, 46.7, 2_149_700),
  row('SD', 'Hartum', 'Khartoum', 15.5, 32.56, 1_861_500),
  row('SE', 'Stockholm', 'Stockholm', 59.33, 18.07, 450_300),
  row('SI', 'Ljubljana', 'Ljubljana', 46.06, 14.51, 20_300),
  row('SK', 'Bratislava', 'Bratislava', 48.15, 17.11, 49_000, [0, -2.5]),
  row('SY', 'Şam', 'Damascus', 33.51, 36.29, 185_200),
  row('TM', 'Aşkabat', 'Ashgabat', 37.96, 58.36, 491_200),
  row('TN', 'Tunus', 'Tunis', 36.81, 10.18, 163_600),
  row('TR', 'Ankara', 'Ankara', 39.93, 32.86, 783_600),
  row('UA', 'Kiev', 'Kyiv', 50.45, 30.52, 603_600),
  row('UZ', 'Taşkent', 'Tashkent', 41.3, 69.24, 449_000),
  row('XK', 'Priştine', 'Pristina', 42.66, 21.17, 10_900),
]

/**
 * Listelenen havalimanı olduğu hâlde adı yazılmayan ülkeler: başkenti tartışmalı İsrail ve
 * Filistin (orkestratör varsayılanı; kullanıcı 2026-10-05'te bu hâliyle tasarım A'yı onayladı).
 */
export const UNLABELLED_COUNTRIES: readonly string[] = ['IL', 'PS']

/**
 * Listelenen havalimanı olmadığı hâlde adı yazılan ülkeler (boşluk kuralı, D-095): başkenti açık
 * halkaların içinde (Türkiye'deki en yakın IATA kodlu havalimanına ≤ 2.000 km), bütün kara
 * komşuları adlandırılmış ve 1.000 km²'den büyük. Bugün yalnızca Ukrayna (OurAirports'ta hiçbir havalimanında
 * tarifeli sefer kayıtlı değil).
 */
export const HOLE_COUNTRIES: readonly string[] = ['UA']

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
export function countryLabelTier(
  capital: Pick<CountryCapital, 'code' | 'areaKm2'>,
): CountryLabelTier {
  const override = Object.hasOwn(COUNTRY_TIER_OVERRIDES, capital.code)
    ? COUNTRY_TIER_OVERRIDES[capital.code]
    : undefined
  if (override !== undefined) return override
  if (capital.areaKm2 >= TIER_1_MIN_AREA_KM2) return 1
  if (capital.areaKm2 >= TIER_2_MIN_AREA_KM2) return 2
  return 3
}
