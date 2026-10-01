/**
 * Havalimanı penceresinin (airport-popup.tsx) metinleri, veriden. Saf modül: saat dışarıdan gelir
 * (`now`, istemci saati ms), React ve DOM yoktur; testler bileşeni çizmeden buradan sınanır.
 *
 * Birimler D-072'ye göre metrik önce yazılır; rakım ft ikinci olarak eklenir. Saatler havalimanının
 * yerel saatiyle (Europe/Istanbul, `Intl`) yazılır; sabit bir fark (UTC+3) kodda yoktur. Hava durumu
 * metinleri havalimanı sayfasıyla aynı işlevlerden gelir (`@havayolu/i18n` → weather).
 */
import {
  format,
  formatAgo,
  formatAltitude,
  formatClock as formatLocalClock,
  NO_VALUE,
  weatherText,
  type Messages,
} from '@havayolu/i18n'
import {
  airportDisplayName,
  airportDistrict,
  metarAgeClass,
  provinceName,
  summarizeMetar,
  sunTimes,
  type AirportMetar,
  type Locale,
  type WeatherText,
} from '@havayolu/shared'
import { runwaySummary, type MapAirport } from './airport-data'
import type { BulkWeatherState } from './use-airport-weather'

export type PopupMessages = Messages['map']['airportPopup']
export type WeatherMessages = Messages['weather']

/** Saat ve dakika, havalimanının yerel saatiyle: "15:32". Saat henüz yoksa (0) ya da geçersizse "—". */
export function formatClock(ms: number): string {
  return Number.isFinite(ms) && ms > 0 ? formatLocalClock(ms) : NO_VALUE
}

/** Rakım (ft girdi), metrik önce: "99 m (325 ft)". Bilinmiyorsa "—". */
export function formatElevation(ft: number | null, locale: Locale): string {
  if (ft === null || !Number.isFinite(ft)) return NO_VALUE
  return `${formatAltitude(ft, { locale })} (${formatAltitude(ft, { locale, units: 'aviation' })})`
}

/** Pist özeti: "Tek pist, 3.000 m" / "3 pist, en uzunu 4.100 m"; uzunluk yoksa sayı, pist yoksa "—". */
export function formatRunways(airport: MapAirport, locale: Locale, t: PopupMessages): string {
  const { count, longestFt } = runwaySummary(airport.runways)
  if (count === 0) return NO_VALUE
  if (longestFt === null) return String(count)
  const length = formatAltitude(longestFt, { locale })
  return count === 1 ? format(t.runwaysOne, { length }) : format(t.runwaysMany, { count, length })
}

/** İl adı; bölge kodu tanınmazsa temiz biçimdeki yerleşim adı; o da yoksa null. */
export function airportPlace(airport: MapAirport, locale: Locale): string | null {
  return provinceName(airport.isoRegion, locale) ?? airportDistrict(airport)
}

export interface PopupRow {
  key: string
  label: string
  value: string
  /** Değerin yanında vurgulanan ek (ör. "Kuvvetli rüzgâr"). */
  strong?: string | null
}

export interface AirportFacts {
  /** Resmî ad (TR) ya da İngilizce karşılığı; doğrulanamadıysa OurAirports adı. */
  name: string
  /** Pencerenin erişilebilir adı ("İstanbul Havalimanı bilgileri"). */
  label: string
  rows: PopupRow[]
}

/** Gün doğumu ve batımı (epoch ms); kutup günü/gecesinde ya da hesaplanamazsa null. */
export interface SunTimesMs {
  sunrise: number | null
  sunset: number | null
}

/**
 * Havalimanının bugünkü (yerel takvim günü) gün doğumu ve batımı; NOAA hesabı, deniz seviyesi ve
 * düz ufuk (`sunTimes`). Saat henüz yoksa (0) null.
 */
export function sunToday(airport: Pick<MapAirport, 'lat' | 'lon'>, now: number): SunTimesMs {
  if (!Number.isFinite(now) || now <= 0) return { sunrise: null, sunset: null }
  const sun = sunTimes(airport.lat, airport.lon, now)
  return { sunrise: sun.sunrise?.getTime() ?? null, sunset: sun.sunset?.getTime() ?? null }
}

/**
 * Pencerenin üst bilgileri: ad, rakım, pist özeti, yerel saat, gün doğumu ve batımı. Hava durumu
 * ayrıdır (`popupWeatherView`).
 */
export function airportFacts(
  airport: MapAirport,
  now: number,
  sun: SunTimesMs,
  locale: Locale,
  t: PopupMessages,
): AirportFacts {
  const name = airportDisplayName(airport, locale)
  return {
    name,
    label: format(t.label, { name }),
    rows: [
      { key: 'elevation', label: t.elevation, value: formatElevation(airport.elevationFt, locale) },
      { key: 'runways', label: t.runways, value: formatRunways(airport, locale, t) },
      { key: 'localTime', label: t.localTime, value: formatClock(now) },
      { key: 'sunrise', label: t.sunrise, value: formatClock(sun.sunrise ?? Number.NaN) },
      { key: 'sunset', label: t.sunset, value: formatClock(sun.sunset ?? Number.NaN) },
    ],
  }
}

export interface PopupWeatherReport {
  kind: 'report'
  /** "Hafif sağanak yağmur · 9 °C"; eski gözlemde null (değerler güncel gibi gösterilmez). */
  headline: string | null
  /** Rüzgâr, yağmur, kar, gök gürültüsü, sis ve pus, (dolu, diğer), görüş; eski gözlemde boş. */
  rows: PopupRow[]
  /** Gecikmiş ya da eski gözlem uyarısı; normalde null. */
  note: string | null
  /** "Gözlem 15:50 · 18 dakika önce" / "Son gözlem 09:50 · 6 saat önce". */
  observed: string
  ageClass: 'fresh' | 'delayed' | 'stale'
}

export type PopupWeatherView =
  { kind: 'loading' | 'unavailable' | 'none'; text: string } | PopupWeatherReport

/**
 * Pencerenin hava durumu bölümü: başlık ve sıcaklık, rüzgâr (hamle, kuvvetli rüzgâr), yağmur, kar,
 * gök gürültüsü, sis ve pus, (dolu, diğer), görüş ve gözlem yaşı. Özet havalimanı sayfasıyla aynı
 * kaynaktan gelir (`summarizeMetar` → `weatherText`); dürüstlük kuralları orada uygulanır: yağmur,
 * kar, gök gürültüsü ve sis her zaman yazılır, rapor güvenle çözülemediyse "Belirlenemedi" denir.
 * Gözlem 12 saatten eskiyse rapor yok sayılır; 3–12 saat arası eski gözlemin değerleri gösterilmez.
 */
export function popupWeatherView(
  state: BulkWeatherState,
  icao: string,
  now: number,
  locale: Locale,
  w: WeatherMessages,
  t: PopupMessages,
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
    return metarReport(metar, age, now, locale, w, t)
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
): PopupWeatherReport {
  const options = { locale, t: w }
  const time = formatLocalClock(metar.observedAt)
  const ago = formatAgo(metar.observedAt, now, options)
  const observed = `${format(age === 'fresh' ? t.observed : w.lastObserved, { time })} · ${ago}`
  if (age === 'stale') {
    return { kind: 'report', headline: null, rows: [], note: w.age.stale, observed, ageClass: age }
  }
  const summary = summarizeMetar(metar)
  const text = (value: WeatherText) => weatherText(value, options)
  const { rows } = summary
  const row = (key: string, label: string, value: WeatherText | null): PopupRow[] =>
    value === null ? [] : [{ key, label, value: text(value) }]
  const headline = text(summary.headline)
  return {
    kind: 'report',
    headline: summary.temperature ? `${headline} · ${text(summary.temperature)}` : headline,
    rows: [
      {
        key: 'wind',
        label: w.rows.wind,
        value: text(rows.wind),
        strong: summary.strongWind ? w.wind.strong : null,
      },
      ...row('rain', w.rows.rain, rows.rain),
      ...row('snow', w.rows.snow, rows.snow),
      ...row('thunder', w.rows.thunder, rows.thunderstorm),
      ...row('fog', w.rows.fog, rows.fog),
      ...row('hail', w.rows.hail, rows.hail),
      ...row('other', w.rows.other, rows.other),
      ...row('visibility', w.rows.visibility, rows.visibility),
    ],
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
 * rapor yok ya da yüklenen raporun başlığı. Saniyelik yerel saat bu bölgede değildir.
 */
export function popupStatusText(view: PopupWeatherView): string {
  if (view.kind !== 'report') return view.text
  return view.headline ?? view.note ?? view.observed
}
