import type { Locale } from '@havayolu/shared'

/**
 * Birim ve sefer no biçimleyicileri (D-072). Arayüz varsayılanı metriktir: yükseklik m, hız km/sa,
 * dikey hız m/dk, mesafe km. Ayarlardan havacılık birimleri (ft, kt, ft/dk, NM) seçilebilir.
 * Veri, API ve motor ft/kt'de kalır; dönüşüm yalnızca burada, gösterimde yapılır.
 *
 * - Sayılar Intl.NumberFormat ile biçimlenir: tr 'tr-TR' (1.093; 6,0), en 'en-GB' (1,093; 6.0).
 * - Negatif değerler U+2212 eksi işaretiyle yazılır; yuvarlama sıfırdan uzağadır (−376,5 → −377).
 * - Yuvarlanınca sıfır olan değer işaretsiz yazılır ("0 m/dk", "−0" yazılmaz).
 * - Bilinmeyen (null) ya da sonlu olmayan değer "—" olarak gösterilir.
 */

export type UnitSystem = 'metric' | 'aviation'
export const UNIT_SYSTEMS: readonly UnitSystem[] = ['metric', 'aviation']
export const DEFAULT_UNIT_SYSTEM: UnitSystem = 'metric'

export function isUnitSystem(value: unknown): value is UnitSystem {
  return typeof value === 'string' && (UNIT_SYSTEMS as readonly string[]).includes(value)
}

export interface UnitOptions {
  /** Varsayılan metrik. */
  units?: UnitSystem
  /** Varsayılan tr. */
  locale?: Locale
}

/** Değeri bilinmeyen alanın gösterimi. */
export const NO_VALUE = '—'

/**
 * Bölünmez boşluk (U+00A0): dar sütunda sayı biriminden ayrı satıra düşmez ("3.400 m" tek parça;
 * D-083). Ekran okuyucu ve arama için olağan boşluk gibidir.
 */
export const NBSP = '\u00a0'

// Dönüşüm katsayıları: packages/geo ile aynı değerler (i18n yalnızca shared'e bağımlıdır).
const M_PER_FT = 0.3048
const KMH_PER_KT = 1.852
const KM_PER_NM = 1.852

const MINUS = '−'

const INTL_LOCALE: Record<Locale, string> = { tr: 'tr-TR', en: 'en-GB' }

interface UnitLabels {
  onGround: string
  altitude: Record<UnitSystem, string>
  speed: Record<UnitSystem, string>
  verticalRate: Record<UnitSystem, string>
  distance: Record<UnitSystem, string>
}

const LABELS: Record<Locale, UnitLabels> = {
  tr: {
    onGround: 'yerde',
    altitude: { metric: 'm', aviation: 'ft' },
    speed: { metric: 'km/sa', aviation: 'kt' },
    verticalRate: { metric: 'm/dk', aviation: 'ft/dk' },
    distance: { metric: 'km', aviation: 'NM' },
  },
  en: {
    onGround: 'on ground',
    altitude: { metric: 'm', aviation: 'ft' },
    speed: { metric: 'km/h', aviation: 'kt' },
    verticalRate: { metric: 'm/min', aviation: 'ft/min' },
    distance: { metric: 'km', aviation: 'NM' },
  },
}

type FractionDigits = 0 | 1

const formatters = new Map<string, Intl.NumberFormat>()

function numberFormat(locale: Locale, digits: FractionDigits): Intl.NumberFormat {
  const key = `${locale}:${digits}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(INTL_LOCALE[locale], {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    formatters.set(key, formatter)
  }
  return formatter
}

function resolve(opts: UnitOptions | undefined): { units: UnitSystem; locale: Locale } {
  return { units: opts?.units ?? DEFAULT_UNIT_SYSTEM, locale: opts?.locale ?? 'tr' }
}

const known = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** Mutlak değeri sıfırdan uzağa yuvarlar; işareti kendisi ekler. */
function formatNumber(
  value: number,
  locale: Locale,
  digits: FractionDigits,
  signed: 'negative' | 'always',
): string {
  const factor = digits === 1 ? 10 : 1
  const rounded = Math.round(Math.abs(value) * factor) / factor
  const text = numberFormat(locale, digits).format(rounded)
  if (rounded === 0) return text
  if (value < 0) return `${MINUS}${text}`
  return signed === 'always' ? `+${text}` : text
}

/**
 * Barometrik yükseklik (ft girdi). Metrikte tam metre ("333 m", "1.093 m"), havacılıkta ft.
 * Uçak yerdeyse değer ne olursa olsun "yerde" / "on ground" yazılır. `nowrap` sayı ile birimi
 * bölünmez boşlukla (`NBSP`) birleştirir: dar sütunda "3.400" / "m" diye kırılmaz (haritadaki
 * havalimanı penceresinde rakım ve pist uzunluğu, D-083). Varsayılan olağan boşluktur (harita
 * etiketleri tuvalde ölçülür).
 */
export function formatAltitude(
  ft: number | null,
  opts?: UnitOptions & { onGround?: boolean; nowrap?: boolean },
): string {
  const { units, locale } = resolve(opts)
  if (opts?.onGround) return LABELS[locale].onGround
  if (!known(ft)) return NO_VALUE
  const value = units === 'metric' ? ft * M_PER_FT : ft
  const space = opts?.nowrap ? NBSP : ' '
  return `${formatNumber(value, locale, 0, 'negative')}${space}${LABELS[locale].altitude[units]}`
}

/** Yer hızı (kt girdi). Metrikte "431 km/sa" (en "431 km/h"), havacılıkta "233 kt". */
export function formatSpeed(kt: number | null, opts?: UnitOptions): string {
  const { units, locale } = resolve(opts)
  if (!known(kt)) return NO_VALUE
  const value = units === 'metric' ? kt * KMH_PER_KT : kt
  return `${formatNumber(value, locale, 0, 'negative')} ${LABELS[locale].speed[units]}`
}

/**
 * Dikey hız (ft/dk girdi). Tırmanış "+", alçalma "−" (U+2212) ile yazılır; yuvarlanınca sıfır olan
 * değer işaretsizdir. Metrikte "−376 m/dk" (en "−376 m/min"), havacılıkta "−1.235 ft/dk".
 */
export function formatVerticalRate(fpm: number | null, opts?: UnitOptions): string {
  const { units, locale } = resolve(opts)
  if (!known(fpm)) return NO_VALUE
  const value = units === 'metric' ? fpm * M_PER_FT : fpm
  return `${formatNumber(value, locale, 0, 'always')} ${LABELS[locale].verticalRate[units]}`
}

/**
 * Yatay mesafe (km girdi). 10'un altında bir ondalık ("6,0 km", "3,2 NM"), üstünde tam sayı;
 * yuvarlama 10'a ulaşırsa tam sayı yazılır (9,96 km → "10 km"). `nowrap` sayı ile birimi bölünmez
 * boşlukla birleştirir (`formatAltitude` gibi; uçak listesinin konum sütunu, D-085).
 */
export function formatDistance(
  km: number | null,
  opts?: UnitOptions & { nowrap?: boolean },
): string {
  const { units, locale } = resolve(opts)
  if (!known(km)) return NO_VALUE
  const value = units === 'metric' ? km : km / KM_PER_NM
  const digits: FractionDigits = Math.round(Math.abs(value) * 10) / 10 < 10 ? 1 : 0
  const space = opts?.nowrap ? NBSP : ' '
  return `${formatNumber(value, locale, digits, 'negative')}${space}${LABELS[locale].distance[units]}`
}

/**
 * Sayı (adet), tam sayıya yuvarlanır ve dilin binlik ayırıcısıyla yazılır: 1161 → "1.161" (en
 * "1,161"). Sayfa metnindeki sayımlar için (`/havalimanlari` girişi ve açıklaması, D-102, D-106;
 * tek yardımcı, web'in kendi kopyası yoktur).
 */
export function formatCount(value: number, locale: Locale): string {
  return formatNumber(value, locale, 0, 'negative')
}

/**
 * Sefer no gösterimi: havayolu kodu ile numara arasında tire (domain.md → Harita etiketleri).
 * ("TK", 4) → "TK-4"; numaradaki baştaki sıfırlar atılır ("0004" → "4").
 */
export function formatFlightNumber(airline: string, number: string | number): string {
  const digits = String(number)
    .trim()
    .toUpperCase()
    .replace(/^0+(?=\d)/, '')
  return `${airline.trim().toUpperCase()}-${digits}`
}

/**
 * Havayolu kodu: 3 harf (ICAO, ör. THY) ya da 2 karakter (IATA, ör. TK, W6, 6E); ardından boşluk
 * ya da tire olabilir, sonra 1–4 rakam ve isteğe bağlı tek harf sonek. 3 harfli okuma önce denenir.
 */
const FLIGHT_NUMBER = /^([A-Z]{3}|[A-Z0-9]{2})[\s-]*(\d{1,4})([A-Z]?)$/

/**
 * Aramada TK4, tk 4, TK-4 ve TK0004 aynı sayılır (domain.md → Harita etiketleri).
 * Dönen numarada baştaki sıfırlar atılır, varsa sonek harfi korunur ("TK 4A" → TK / "4A").
 * İki rakamdan oluşan havayolu kodu, sıfır numara ya da tanınmayan biçim null döner.
 */
export function normalizeFlightNumber(input: string): { airline: string; number: string } | null {
  const match = FLIGHT_NUMBER.exec(input.trim().toUpperCase())
  if (!match) return null
  const [, airline = '', digits = '', suffix = ''] = match
  if (/^\d{2}$/.test(airline)) return null
  const number = digits.replace(/^0+/, '')
  if (number === '') return null
  return { airline, number: `${number}${suffix}` }
}
