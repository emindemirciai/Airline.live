/**
 * Havalimanı penceresinin (airport-popup.tsx) metinleri, veriden. Saf modül: saat dışarıdan gelir
 * (`now`, istemci saati ms), React ve DOM yoktur; testler bileşeni çizmeden buradan sınanır.
 *
 * Birimler D-072'ye göre metrik önce yazılır; rakım ft ikinci olarak eklenir. Saatler havalimanının
 * saat dilimiyle (`popupTimeZone`, `Intl`) yazılır; sabit bir fark (UTC+3) kodda yoktur. Hava durumu
 * metinleri ve satırları havalimanı sayfasıyla aynı işlevlerden gelir (`@havayolu/i18n` → weather,
 * `../airports/weather-rows`). Sayıdan önce "·" yazılmaz (eksi gibi okunur): sıcaklık ayrı kutucuktur,
 * parçalar virgülle ayrılır (kullanıcı kararı 2026-10-02).
 */
import {
  format,
  formatAgo,
  formatAltitude,
  formatUtcClock,
  NO_VALUE,
  weatherText,
  type Messages,
} from '@havayolu/i18n'
import {
  airportCountryName,
  airportDisplayName,
  airportDistrict,
  localTime,
  metarAgeClass,
  provinceName,
  summarizeMetar,
  TURKEY_TIME_ZONE,
  type AirportMetar,
  type Locale,
} from '@havayolu/shared'
import { phenomenonRows, plainRow, type WeatherRow } from '../airports/weather-rows'
import { runwaySummary, type MapAirport } from './airport-data'
import type { BulkWeatherState } from './use-airport-weather'

export type PopupMessages = Messages['map']['airportPopup']
export type WeatherMessages = Messages['weather']

/** Türkiye'nin ISO 3166-1 alpha-2 kodu (`MapAirport.country`). */
const TURKEY = 'TR'

/**
 * Pencerenin saat dilimi (IANA): Türkiye havalimanında Europe/Istanbul. Yakın ülkelerin
 * havalimanları için saat dilimi verisi tutulmaz (OurAirports'ta yoktur; D-080): o havalimanlarında
 * yerel saat satırı gösterilmez, gözlem saati UTC ile yazılır. Başka bir
 * ülkenin saati Türkiye saatiyle "yerel saat" diye gösterilmez (Tiflis ve Bakü UTC+4, Tahran
 * UTC+3:30, Yunanistan kışın UTC+2).
 */
export function popupTimeZone(airport: Pick<MapAirport, 'country'>): string | null {
  return airport.country === TURKEY ? TURKEY_TIME_ZONE : null
}

/**
 * Saat ve dakika, verilen saat diliminde (varsayılan Europe/Istanbul): "15:32". Saat henüz yoksa (0)
 * ya da geçersizse "—".
 */
export function formatClock(ms: number, timeZone: string = TURKEY_TIME_ZONE): string {
  return Number.isFinite(ms) && ms > 0 ? localTime(ms, timeZone).hhmm : NO_VALUE
}

/**
 * Rakım (ft girdi), metrik önce: "99 m (325 ft)". Bilinmiyorsa "—". Sayı ile birim arasında
 * bölünmez boşluk vardır (`nowrap`): pencerenin dar değer sütununda (~160 px) "99" / "m" diye
 * kırılmaz (D-083); satır yalnız "99 m" ile "(325 ft)" arasında kırılabilir.
 */
export function formatElevation(ft: number | null, locale: Locale): string {
  if (ft === null || !Number.isFinite(ft)) return NO_VALUE
  const metric = formatAltitude(ft, { locale, nowrap: true })
  return `${metric} (${formatAltitude(ft, { locale, units: 'aviation', nowrap: true })})`
}

/**
 * Pist özeti: "Tek pist, 3.000 m" / "3 pist, en uzunu 4.100 m"; uzunluk yoksa sayı, pist yoksa "—".
 * Uzunluk tek parçadır (bölünmez boşluk): 1280 px'te "3 pist, en uzunu 3.400" / "m" kırılıyordu
 * (AYT, SKG; D-083).
 */
export function formatRunways(airport: MapAirport, locale: Locale, t: PopupMessages): string {
  const { count, longestFt } = runwaySummary(airport.runways)
  if (count === 0) return NO_VALUE
  if (longestFt === null) return String(count)
  const length = formatAltitude(longestFt, { locale, nowrap: true })
  return count === 1 ? format(t.runwaysOne, { length }) : format(t.runwaysMany, { count, length })
}

/**
 * Başlığın altındaki yer satırı. Türkiye'de il adı; bölge kodu tanınmazsa temiz biçimdeki yerleşim
 * adı, o da yoksa null. Yakın ülkelerde ülke adı (D-080; Ercan için KKTC): "Yunanistan" / "Greece".
 */
export function airportPlace(airport: MapAirport, locale: Locale): string | null {
  if (airport.country !== TURKEY) return airportCountryName(airport, locale)
  return provinceName(airport.isoRegion, locale) ?? airportDistrict(airport)
}

export interface AirportFacts {
  /** Resmî ad (TR) ya da İngilizce karşılığı; doğrulanamadıysa OurAirports adı. */
  name: string
  /** Pencerenin erişilebilir adı ("İstanbul Havalimanı bilgileri"). */
  label: string
  /**
   * Rakım, pistler, (yerel saat): vurgusuz satırlar. Hava durumu satırlarıyla aynı listeyle
   * (`WeatherRowList`) ve aynı sütunlarda çizilir (M6e.1, D-083); simgeleri `data-row` anahtarından.
   */
  rows: WeatherRow[]
}

/**
 * Pencerenin üst bilgileri: ad, rakım, pist özeti; saat dilimi biliniyorsa (`popupTimeZone`) yerel
 * saat. Gün doğumu ve batımı pencerede yazılmaz, havalimanı sayfasındadır (kullanıcı kararı
 * 2026-10-02). Hava durumu ayrıdır (`popupWeatherView`).
 */
export function airportFacts(
  airport: MapAirport,
  now: number,
  locale: Locale,
  t: PopupMessages,
  timeZone: string | null = popupTimeZone(airport),
): AirportFacts {
  const name = airportDisplayName(airport, locale)
  const rows: WeatherRow[] = [
    plainRow('elevation', t.elevation, formatElevation(airport.elevationFt, locale)),
    plainRow('runways', t.runways, formatRunways(airport, locale, t)),
  ]
  if (timeZone !== null) {
    rows.push(plainRow('localTime', t.localTime, formatClock(now, timeZone)))
  }
  return { name, label: format(t.label, { name }), rows }
}

export interface PopupWeatherReport {
  kind: 'report'
  /** "Hafif sağanak yağmur"; eski gözlemde null (değerler güncel gibi gösterilmez). */
  headline: string | null
  /** Başlığın yanındaki sıcaklık kutucuğu: "9 °C", "−3 °C"; bilinmiyorsa ya da eski gözlemde null. */
  temperature: string | null
  /**
   * Rüzgâr, yağmur, kar, gök gürültüsü, sis ve pus, (dolu, diğer), görüş; var olan olay vurgulanır
   * (`tone`). Eski gözlemde boş.
   */
  rows: WeatherRow[]
  /** Gecikmiş ya da eski gözlem uyarısı; normalde null. */
  note: string | null
  /** "Gözlem 15:50, 18 dakika önce" / "Son gözlem 09:50, 6 saat önce". */
  observed: string
  ageClass: 'fresh' | 'delayed' | 'stale'
}

export type PopupWeatherView =
  { kind: 'loading' | 'unavailable' | 'none'; text: string } | PopupWeatherReport

/**
 * Pencerenin hava durumu bölümü: başlık ve sıcaklık, rüzgâr (hamle, kuvvetli rüzgâr), yağmur, kar,
 * gök gürültüsü, sis ve pus, (dolu, diğer), görüş ve gözlem yaşı. Özet havalimanı sayfasıyla aynı
 * kaynaktan gelir (`summarizeMetar` → `phenomenonRows`); dürüstlük kuralları orada uygulanır: yağmur,
 * kar, gök gürültüsü ve sis her zaman yazılır, rapor güvenle çözülemediyse "Belirlenemedi" denir.
 * Gözlem 12 saatten eskiyse rapor yok sayılır; 3–12 saat arası eski gözlemin değerleri gösterilmez.
 * Gözlem saati havalimanının saat dilimiyle yazılır; dilim bilinmiyorsa (`null`) UTC ile ("12:50 UTC").
 */
export function popupWeatherView(
  state: BulkWeatherState,
  icao: string,
  now: number,
  locale: Locale,
  w: WeatherMessages,
  t: PopupMessages,
  timeZone: string | null = TURKEY_TIME_ZONE,
): PopupWeatherView {
  if (state.data === null) {
    return state.failed
      ? { kind: 'unavailable', text: t.unavailable }
      : { kind: 'loading', text: t.loading }
  }
  const metar = state.data.stations.get(icao)?.metar ?? null
  if (metar === null) return { kind: 'none', text: t.noReport }
  const age = metarAgeClass(metar.observedAt, now)
  if (age === 'none') return { kind: 'none', text: t.noReport }
  // Metin kurulamazsa (beklenmeyen rapor biçimi) harita düşmez: pencere "alınamıyor" der.
  try {
    return metarReport(metar, age, now, locale, w, t, timeZone)
  } catch (error) {
    console.error('Airport weather text could not be built', error)
    return { kind: 'unavailable', text: t.unavailable }
  }
}

function metarReport(
  metar: AirportMetar,
  age: PopupWeatherReport['ageClass'],
  now: number,
  locale: Locale,
  w: WeatherMessages,
  t: PopupMessages,
  timeZone: string | null,
): PopupWeatherReport {
  const options = { locale, t: w }
  const observedAt = Date.parse(metar.observedAt)
  const time =
    timeZone === null ? `${formatUtcClock(observedAt)} UTC` : formatClock(observedAt, timeZone)
  const ago = formatAgo(metar.observedAt, now, options)
  const observed = `${format(age === 'fresh' ? t.observed : w.lastObserved, { time })}, ${ago}`
  if (age === 'stale') {
    return {
      kind: 'report',
      headline: null,
      temperature: null,
      rows: [],
      note: w.age.stale,
      observed,
      ageClass: age,
    }
  }
  const summary = summarizeMetar(metar)
  return {
    kind: 'report',
    headline: weatherText(summary.headline, options),
    temperature: summary.temperature ? weatherText(summary.temperature, options) : null,
    rows: phenomenonRows(summary, options),
    note: age === 'delayed' ? `${w.age.delayedBadge}: ${w.age.delayed}` : null,
    observed,
    ageClass: age,
  }
}

/** Escape anında odağın yeri: pencerenin içi, harita tuvali, hiçbir yer (sayfa) ya da başka denetim. */
export type FocusPlace = 'popup' | 'map' | 'page' | 'other'

/**
 * Escape pencereyi kapatır mı: başka bir katman (arama sonuçları, etiket ayarları, havalimanı
 * listesi) tüketmediyse (`defaultPrevented`) ve odak pencerede, haritada ya da hiçbir yerde değilse.
 * Odak başka bir denetimdeyken basılan Escape o denetimindir; tek Escape iki katmanı kapatmaz.
 */
export function escapeClosesPopup(
  event: { key: string; defaultPrevented: boolean },
  focus: FocusPlace,
): boolean {
  return event.key === 'Escape' && !event.defaultPrevented && focus !== 'other'
}

/**
 * Pencere kapanınca odağın döneceği öğe; açılışta ve başka havalimanına geçişte, o anki odakla
 * (`active`, yeri `place`) güncellenir. Pencereyi açan denetim (harita tuvali ya da "Havalimanları"
 * düğmesi) saklanır. Odak pencerenin içindeyse ya da sayfadaysa (body: açan öğe DOM'dan kalktı)
 * önceki öğe kalır; hiç öğe yoksa kapanışta harita tuvali kullanılır. Böylece odak sayfanın başına
 * gönderilmez (WCAG 2.4.3).
 */
export function returnFocusTarget<T>(
  previous: T | null,
  active: T | null,
  place: FocusPlace,
): T | null {
  if (active === null || place === 'popup' || place === 'page') return previous
  return active
}

/**
 * Ekran okuyucuya kibarca bildirilen hava durumu durumu (WCAG 4.1.3): yükleniyor, alınamıyor,
 * rapor yok ya da yüklenen raporun başlığı ve sıcaklığı. Saniyelik yerel saat bu bölgede değildir.
 */
export function popupStatusText(view: PopupWeatherView): string {
  if (view.kind !== 'report') return view.text
  if (view.headline === null) return view.note ?? view.observed
  return view.temperature ? `${view.headline}, ${view.temperature}` : view.headline
}
