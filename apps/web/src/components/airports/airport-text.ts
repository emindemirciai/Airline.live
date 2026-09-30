import { nmToKm } from '@havayolu/geo'
import {
  format,
  formatAltitude,
  formatDistance,
  getMessages,
  NO_VALUE,
  type Messages,
} from '@havayolu/i18n'
import {
  airportDisplayName,
  airportDistrict,
  provinceName,
  type AirportDetail,
  type Locale,
  type RunwayDetail,
} from '@havayolu/shared'

/**
 * Havalimanı sayfalarının veriden kurulan metinleri ve biçimleyicileri (M6b). Saf modül: sayfa,
 * üst veri, paylaşım görseli ve testler aynı işlevleri kullanır. Birimler D-072'ye göre metrik
 * önce yazılır (`packages/i18n` birim biçimleyicileri); veri ft/NM'dir.
 */

const INTL_LOCALE: Record<Locale, string> = { tr: 'tr-TR', en: 'en-GB' }

/** Havalimanının görünen adı: resmî Türkçe ad (TR) ya da İngilizce karşılığı; yoksa OurAirports adı. */
export function airportName(airport: AirportDetail, locale: Locale): string {
  return airportDisplayName(airport, locale)
}

/**
 * İl adı; bölge kodu tanınmazsa temiz biçimdeki OurAirports yerleşim adı (`airportDistrict`), o da
 * yoksa ülke adı.
 */
export function airportProvince(airport: AirportDetail, locale: Locale): string {
  return (
    provinceName(airport.isoRegion, locale) ??
    airportDistrict(airport) ??
    getMessages(locale).airport.country
  )
}

/** Uzunluk (ft girdi), metrik önce: "3.750 m (12.303 ft)". Bilinmiyorsa "—". */
export function formatLength(ft: number | null, locale: Locale): string {
  if (ft === null || !Number.isFinite(ft)) return NO_VALUE
  return `${formatAltitude(ft, { locale })} (${formatAltitude(ft, { locale, units: 'aviation' })})`
}

/** Yalnızca metre (ft girdi): "45 m". */
export function formatMeters(ft: number | null, locale: Locale): string {
  return formatAltitude(ft, { locale })
}

/** Deniz mili girdili yarıçap, metrik önce: "111 km (60 NM)". */
export function formatRadius(nm: number, locale: Locale): string {
  const km = nmToKm(nm)
  return `${formatDistance(km, { locale })} (${formatDistance(km, { locale, units: 'aviation' })})`
}

/**
 * Gerçek yön, tam derece: 52,4 → "52°". Kuzey 0 değil 360 yazılır (havacılık yazımı; 359,6 → "360°").
 */
export function formatBearing(deg: number | null): string {
  if (deg === null || !Number.isFinite(deg)) return NO_VALUE
  const rounded = Math.round(((deg % 360) + 360) % 360) % 360
  return `${rounded === 0 ? 360 : rounded}°`
}

function decimal(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(Math.abs(value))
}

/** Derece, dakika, saniye; saniye tam sayıya yuvarlanır ve taşma üst birime aktarılır. */
function dms(value: number): string {
  let total = Math.round(Math.abs(value) * 3600)
  const degrees = Math.floor(total / 3600)
  total -= degrees * 3600
  const minutes = Math.floor(total / 60)
  const seconds = total - minutes * 60
  return `${degrees}° ${String(minutes).padStart(2, '0')}′ ${String(seconds).padStart(2, '0')}″`
}

function hemispheres(lat: number, lon: number, t: Messages): [string, string] {
  const h = t.airport.hemisphere
  return [lat < 0 ? h.s : h.n, lon < 0 ? h.w : h.e]
}

/** Havalimanı merkezi, ondalık derece: "41,2622° K, 28,7278° D" (en: "41.2622° N, 28.7278° E"). */
export function formatCoordinatesDecimal(lat: number, lon: number, locale: Locale): string {
  const [ns, ew] = hemispheres(lat, lon, getMessages(locale))
  return `${decimal(lat, locale)}° ${ns}, ${decimal(lon, locale)}° ${ew}`
}

/** Havalimanı merkezi, derece-dakika-saniye: "41° 15′ 44″ K, 28° 43′ 40″ D". */
export function formatCoordinatesDms(lat: number, lon: number, locale: Locale): string {
  const [ns, ew] = hemispheres(lat, lon, getMessages(locale))
  return `${dms(lat)} ${ns}, ${dms(lon)} ${ew}`
}

/** Veri değişiklik tarihi, İstanbul saatine göre gün: "29 Eylül 2026" / "29 September 2026". */
export function formatDataDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso))
}

/** Pistin adı: iki ucun adı ("16L/34R"); ad yoksa "—". */
export function runwayDesignator(runway: RunwayDetail): string {
  const idents = runway.ends.map((end) => end.ident.trim()).filter((ident) => ident !== '')
  return idents.length > 0 ? idents.join('/') : NO_VALUE
}

/** Uzunluğu bilinen en uzun pist; eşitlikte pist sırasındaki ilki. Yoksa null. */
export function longestRunway(airport: AirportDetail): RunwayDetail | null {
  let longest: RunwayDetail | null = null
  for (const runway of airport.runways) {
    if (runway.lengthFt === null) continue
    if (longest === null || runway.lengthFt > (longest.lengthFt ?? 0)) longest = runway
  }
  return longest
}

/** Sayfa başlığı (şablon " · havayolu" ekler): "İstanbul Havalimanı (IST/LTFM) canlı hava trafiği ve pistler". */
export function airportTitle(airport: AirportDetail, locale: Locale): string {
  return format(getMessages(locale).seo.airport.title, {
    name: airportName(airport, locale),
    iata: airport.iata,
    icao: airport.icao,
  })
}

/**
 * Arama sonucu açıklaması, veriden: il, pist sayısı ve en uzun pist, rakım. Tarife, rötar ya da
 * hava durumu vaat etmez (M6b brief §b, §i). Havalimanı canlı veri çekim alanının dışındaysa
 * (`covered` false; lib/airports.ts → `isInLiveCoverage`) çevredeki uçakları da vaat etmez.
 */
export function airportDescription(
  airport: AirportDetail,
  locale: Locale,
  covered: boolean,
): string {
  const t = getMessages(locale).seo.airport
  const facts: string[] = []
  const count = airport.runways.length
  const longest = longestRunway(airport)
  if (count === 1 && longest) {
    facts.push(format(t.runwaysOne, { length: formatMeters(longest.lengthFt, locale) }))
  } else if (count > 1 && longest) {
    facts.push(format(t.runwaysMany, { count, length: formatMeters(longest.lengthFt, locale) }))
  } else if (count > 0) {
    facts.push(format(t.runwaysCount, { count }))
  }
  if (airport.elevationFt !== null) {
    facts.push(format(t.elevation, { elevation: formatMeters(airport.elevationFt, locale) }))
  }
  const name = airportName(airport, locale)
  const province = airportProvince(airport, locale)
  const live = covered ? t.liveCovered : t.liveOutside
  return facts.length > 0
    ? format(t.description, { name, province, facts: facts.join('; '), live })
    : format(t.descriptionNoFacts, { name, province, live })
}

/** Havalimanlarını ile, sonra ada göre sayfanın dilinin alfabesiyle sıralar. */
export function sortByProvince(
  airports: readonly AirportDetail[],
  locale: Locale,
): AirportDetail[] {
  const collator = new Intl.Collator(INTL_LOCALE[locale])
  return airports.toSorted(
    (a, b) =>
      collator.compare(airportProvince(a, locale), airportProvince(b, locale)) ||
      collator.compare(airportName(a, locale), airportName(b, locale)) ||
      a.icao.localeCompare(b.icao),
  )
}
