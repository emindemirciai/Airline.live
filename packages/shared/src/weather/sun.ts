import { localTime, toDate, TURKEY_TIME_ZONE, type DateInput } from './time'

/**
 * Gün doğumu ve batımı: NOAA güneş hesabı (Meeus; https://gml.noaa.gov/grad/solcalc/calcdetails.html),
 * bağımlılıksız. Ufuk 90,833° (kırılma ve güneş yarıçapı), sivil alacakaranlık 96°. Hesap 2–3 kez
 * olay anında yinelenir; ±72° enlem içinde yaklaşık 1 dk doğrudur. Yükselti ve arazi düzeltmesi
 * yoktur (dağlık havalimanlarında birkaç dakika fark olabilir). Saat okunmaz: gün parametredir.
 */

/** Takvim günü (ay 1–12). */
export interface CalendarDate {
  year: number
  month: number
  day: number
}

export interface SunTimes {
  /** Hesaplanan yerel takvim günü. */
  date: CalendarDate
  /** Gün doğumu/batımı; kutup gününde ya da gecesinde null. */
  sunrise: Date | null
  sunset: Date | null
  /** Sivil şafak ve alacakaranlık (güneş ufkun 6° altında). */
  civilDawn: Date | null
  civilDusk: Date | null
  /** Güneş hiç batmıyorsa `day`, hiç doğmuyorsa `night`; aksi hâlde null. */
  polar: 'day' | 'night' | null
}

const RAD = Math.PI / 180
const SUNRISE_ZENITH = 90.833
const CIVIL_ZENITH = 96

/** Takvim gününün 0h UT Jülyen günü. */
function julianDay({ year, month, day }: CalendarDate): number {
  let y = year
  let m = month
  if (m <= 2) {
    y -= 1
    m += 12
  }
  const a = Math.floor(y / 100)
  const b = 2 - a + Math.floor(a / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5
}

/** Güneşin dik açıklığı (derece) ve zaman denklemi (dakika). */
function solarPosition(jd: number): { declination: number; equationOfTime: number } {
  const t = (jd - 2451545) / 36525
  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t)
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
  const mr = m * RAD
  const c =
    Math.sin(mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * mr) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * mr) * 0.000289
  const omega = (125.04 - 1934.136 * t) * RAD
  const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(omega)
  const e0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
  const epsilon = e0 + 0.00256 * Math.cos(omega)
  const declination = Math.asin(Math.sin(epsilon * RAD) * Math.sin(lambda * RAD)) / RAD
  const y = Math.tan((epsilon / 2) * RAD) ** 2
  const l0r = l0 * RAD
  const equationOfTime =
    (4 *
      (y * Math.sin(2 * l0r) -
        2 * e * Math.sin(mr) +
        4 * e * y * Math.sin(mr) * Math.cos(2 * l0r) -
        0.5 * y * y * Math.sin(4 * l0r) -
        1.25 * e * e * Math.sin(2 * mr))) /
    RAD
  return { declination, equationOfTime }
}

/**
 * Olayın günün 0h UT'sinden dakika cinsinden zamanı; `sign` −1 doğuş, +1 batış. Güneş o zenite
 * hiç ulaşmıyorsa `cosH` sınır dışıdır: >1 hiç doğmuyor, <−1 hiç batmıyor.
 */
function eventMinutes(
  date: CalendarDate,
  lat: number,
  lon: number,
  sign: -1 | 1,
  zenith: number,
): number | 'day' | 'night' {
  const jd0 = julianDay(date)
  let t = 0.5 - lon / 360
  let minutes = 0
  for (let i = 0; i < 3; i++) {
    const { declination, equationOfTime } = solarPosition(jd0 + t)
    const cosH =
      Math.cos(zenith * RAD) / (Math.cos(lat * RAD) * Math.cos(declination * RAD)) -
      Math.tan(lat * RAD) * Math.tan(declination * RAD)
    if (cosH > 1) return 'night'
    if (cosH < -1) return 'day'
    const hourAngle = Math.acos(cosH) / RAD
    minutes = 720 - 4 * lon - equationOfTime + sign * 4 * hourAngle
    t = minutes / 1440
  }
  return minutes
}

function isCalendarDate(value: unknown): value is CalendarDate {
  return (
    typeof value === 'object' &&
    value !== null &&
    'year' in value &&
    'month' in value &&
    'day' in value
  )
}

/**
 * Bir konumun gün doğumu/batımı. `date` takvim günü ya da bir an olabilir; an verilirse o anın
 * `timeZone`'daki (varsayılan Europe/Istanbul) yerel günü hesaplanır. Saatler UTC anı (Date) döner;
 * gösterim yerel saatle ve tam dakikayla yapılır.
 */
export function sunTimes(
  lat: number,
  lon: number,
  date: CalendarDate | DateInput,
  timeZone: string = TURKEY_TIME_ZONE,
): SunTimes {
  const day: CalendarDate = isCalendarDate(date)
    ? date
    : (() => {
        const local = localTime(toDate(date), timeZone)
        return { year: local.year, month: local.month, day: local.day }
      })()
  const midnight = Date.UTC(day.year, day.month - 1, day.day)
  const at = (value: number | 'day' | 'night') =>
    typeof value === 'number' ? new Date(midnight + Math.round(value * 60_000)) : null
  const rise = eventMinutes(day, lat, lon, -1, SUNRISE_ZENITH)
  const set = eventMinutes(day, lat, lon, 1, SUNRISE_ZENITH)
  const polar = typeof rise === 'number' ? null : rise
  return {
    date: day,
    sunrise: at(rise),
    sunset: at(set),
    civilDawn: at(eventMinutes(day, lat, lon, -1, CIVIL_ZENITH)),
    civilDusk: at(eventMinutes(day, lat, lon, 1, CIVIL_ZENITH)),
    polar,
  }
}

/**
 * An gündüz mü (gün doğumu ≤ an < gün batımı). Kutup gününde true, gecesinde false. Simgenin
 * gece biçimi ve harita penceresi için.
 */
export function isDaytime(at: DateInput, sun: SunTimes): boolean {
  if (sun.polar === 'day') return true
  if (sun.polar === 'night' || !sun.sunrise || !sun.sunset) return false
  const t = toDate(at).getTime()
  return t >= sun.sunrise.getTime() && t < sun.sunset.getTime()
}
