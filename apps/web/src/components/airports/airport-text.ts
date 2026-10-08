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
  airportCountryName,
  airportDisplayName,
  airportDistrict,
  airportLocality,
  airportRingLimitKm,
  ENABLED_AIRPORT_RING,
  provinceName,
  TURKEY_COUNTRY,
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

/** Havalimanı Türkiye'de mi (`country`, OurAirports `iso_country`; D-080). */
export function isTurkish(airport: Pick<AirportDetail, 'country'>): boolean {
  return airport.country === TURKEY_COUNTRY
}

/**
 * Listelenen yabancı havalimanlarının Türkiye'ye en büyük uzaklığı, km: açık son halkanın sınırı
 * (`airportRingLimitKm(ENABLED_AIRPORT_RING)`, D-080; 3. halkada 2.000, D-090). Son halka
 * (dünyanın geri kalanı) açıksa sınır yoktur: null.
 */
export function listedRadiusKm(): number | null {
  return airportRingLimitKm(ENABLED_AIRPORT_RING)
}

/** Havalimanının görünen adı: resmî Türkçe ad (TR) ya da İngilizce karşılığı; yoksa OurAirports adı. */
export function airportName(airport: AirportDetail, locale: Locale): string {
  return airportDisplayName(airport, locale)
}

/**
 * İl adı; bölge kodu tanınmazsa temiz biçimdeki OurAirports yerleşim adı (`airportDistrict`), o da
 * yoksa ülke adı. Yalnızca Türkiye havalimanları içindir; genel yer etiketi `airportPlace`'tir.
 */
export function airportProvince(airport: AirportDetail, locale: Locale): string {
  return (
    provinceName(airport.isoRegion, locale) ??
    airportDistrict(airport) ??
    getMessages(locale).airport.country
  )
}

/**
 * Ülke adı, sayfanın dilinde (`Intl.DisplayNames`; Ercan için KKTC, D-080): "Yunanistan" / "Greece".
 * Kısa biçim (varsayılan) tablolarda ve yer satırında, uzun biçim olgu listesinde kullanılır.
 */
export function airportCountry(
  airport: AirportDetail,
  locale: Locale,
  style: 'short' | 'long' = 'short',
): string {
  return airportCountryName(airport, locale, style)
}

/**
 * Olgu listesindeki ülke: uzun ad; kısaltması ayrıysa ayraç içinde ("Kuzey Kıbrıs Türk Cumhuriyeti
 * (KKTC)"). Diğer ülkelerde tek ad ("Yunanistan").
 */
export function airportCountryFull(airport: AirportDetail, locale: Locale): string {
  const long = airportCountry(airport, locale, 'long')
  const short = airportCountry(airport, locale, 'short')
  return long === short ? long : `${long} (${short})`
}

/**
 * Havalimanının yer etiketi: Türkiye'de il, yakın ülkelerde ülke (D-080). Liste tablosunun il ve
 * ülke sütunları, en yakın havalimanları ve üst veri açıklaması bunu yazar.
 */
export function airportPlace(airport: AirportDetail, locale: Locale): string {
  return isTurkish(airport) ? airportProvince(airport, locale) : airportCountry(airport, locale)
}

/**
 * Başlığın altındaki yer satırı: "İstanbul, Türkiye". Yakın ülkelerde şehir ve ülke, sayfanın
 * dilinde ("Selanik, Yunanistan" / "Thessaloniki, Greece"; `airportLocality`, küratörlü şehir
 * tablosu). Şehir bilinmiyorsa (tabloda olmayan havalimanının Türkçe sayfası) yalnızca ülke yazılır:
 * OurAirports'un İngilizce yerleşim adı Türkçe adın altına düşmez.
 */
export function airportLocation(airport: AirportDetail, locale: Locale): string {
  const t = getMessages(locale).airport
  if (isTurkish(airport)) return format(t.location, { province: airportProvince(airport, locale) })
  const country = airportCountry(airport, locale)
  const city = airportLocality(airport, locale)
  return city === null ? country : format(t.locationAbroad, { city, country })
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

/**
 * Sayfa başlığı (şablon " · havayolu" ekler): "İstanbul Havalimanı (IST/LTFM) canlı hava trafiği ve
 * pistler". Havalimanı canlı veri çekim alanının dışındaysa (`covered` false; lib/airports.ts →
 * `isInLiveCoverage`, açıklamadaki gibi) canlı trafik vaat etmez: "Viyana Havalimanı (VIE/LOWW):
 * pistler ve havalimanı bilgileri" (D-106).
 */
export function airportTitle(airport: AirportDetail, locale: Locale, covered: boolean): string {
  const t = getMessages(locale).seo.airport
  return format(covered ? t.title : t.titleOutside, {
    name: airportName(airport, locale),
    iata: airport.iata,
    icao: airport.icao,
  })
}

/**
 * Arama sonucu açıklaması, veriden: il (yakın ülkelerde ülke), pist sayısı ve en uzun pist, rakım.
 * Tarife, rötar ya da hava durumu vaat etmez (M6b brief §b, §i). Havalimanı canlı veri çekim
 * alanının dışındaysa (`covered` false; lib/airports.ts → `isInLiveCoverage`) çevredeki uçakları da
 * vaat etmez.
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
  const place = airportPlace(airport, locale)
  const live = covered ? t.liveCovered : t.liveOutside
  return facts.length > 0
    ? format(t.description, { name, place, facts: facts.join('; '), live })
    : format(t.descriptionNoFacts, { name, place, live })
}

/**
 * Önce `primary`, sonra ada, sonra ICAO'ya göre sayfanın dilinin alfabesiyle sıralar. Anahtarlar
 * havalimanı başına bir kez hesaplanır (ad ve ülke tablo ve `Intl` aramasıdır): karşılaştırıcının
 * içinde hesaplamak 4. halkanın 1.161 satırında sıralamayı ~10 kat yavaşlatıyordu (D-102).
 */
function sortByKeys(
  airports: readonly AirportDetail[],
  locale: Locale,
  primary: (airport: AirportDetail) => string,
): AirportDetail[] {
  const collator = new Intl.Collator(INTL_LOCALE[locale])
  return airports
    .map((airport) => ({ airport, first: primary(airport), name: airportName(airport, locale) }))
    .sort(
      (a, b) =>
        collator.compare(a.first, b.first) ||
        collator.compare(a.name, b.name) ||
        a.airport.icao.localeCompare(b.airport.icao),
    )
    .map((row) => row.airport)
}

/** Havalimanlarını ile, sonra ada göre sayfanın dilinin alfabesiyle sıralar. */
export function sortByProvince(
  airports: readonly AirportDetail[],
  locale: Locale,
): AirportDetail[] {
  return sortByKeys(airports, locale, (airport) => airportProvince(airport, locale))
}

/**
 * Yakın ülkelerdeki havalimanlarını ülkeye, sonra ada göre sayfanın dilinin alfabesiyle sıralar
 * (Türkçe sayfada Türkçe sıralama; D-080).
 */
export function sortByCountry(airports: readonly AirportDetail[], locale: Locale): AirportDetail[] {
  return sortByKeys(airports, locale, (airport) => airportCountry(airport, locale))
}
