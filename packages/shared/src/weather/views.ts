import { decodeMetar } from './metar'
import {
  AirportMetarSchema,
  AirportTafSchema,
  FLIGHT_CATEGORIES,
  type AirportMetar,
  type AirportTaf,
  type AirportWeather,
  type FlightCategory,
  type RawAirportWeather,
  type RawMetar,
  type RawTaf,
} from './schema'
import { inForceTafs } from './summary'
import { decodeTaf } from './taf'
import { toDate, type DateInput } from './time'

/**
 * Kayıttaki raporun sözleşme görünümleri (D-078, D-101). Esas veri ham metindir; çözümleme okurken
 * yapılır. API'nin tam biçimi (`GET /v1/weather`, tek havalimanı, METAR/TAF kaydı) ve ham biçimi
 * okuyan web aynı fonksiyonları kullanır: ikisinin sonucu aynıdır (apps/api weather.test.ts).
 *
 * Görünümler atmaz: çözümleyici ya da şema denetimi hata verirse `onError` çağrılır ve null döner
 * (tek bozuk rapor bütün yanıtı düşürmez; API bunu loglar).
 */

/** Çözümleme hatasında çağrılır; görünüm null döner. */
export type WeatherDecodeErrorHandler = (error: unknown) => void

/** Kayıttaki METAR/SPECI: veritabanı satırı (Date) ya da ham yanıtın kaydı (ISO metni). */
export interface MetarRecordInput {
  raw: string
  type: 'METAR' | 'SPECI'
  observedAt: DateInput
  /** AWC `fltCat`, olduğu gibi. */
  flightCategory: string | null
}

/** Kayıttaki TAF. */
export interface TafRecordInput {
  raw: string
  issuedAt: DateInput
  validFrom: DateInput
  validTo: DateInput
}

/** AWC `fltCat` bilinen dört değerden biri değilse gösterilmez (null). */
export function weatherFlightCategory(value: string | null | undefined): FlightCategory | null {
  return (FLIGHT_CATEGORIES as readonly (string | null | undefined)[]).includes(value)
    ? (value as FlightCategory)
    : null
}

/** Geçerli bir anın ISO metni; geçersizse null. */
function isoTime(value: DateInput): string | null {
  const date = toDate(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Çözümlenmiş METAR (API'deki biçim: zaman ve tür kayıttan). Çözülemezse null. */
export function toAirportMetar(
  input: MetarRecordInput,
  onError?: WeatherDecodeErrorHandler,
): AirportMetar | null {
  try {
    const observedAt = toDate(input.observedAt).toISOString()
    return AirportMetarSchema.parse({
      ...decodeMetar(input.raw, { observedAt: input.observedAt }),
      type: input.type,
      observedAt,
      raw: input.raw,
      flightCategory: weatherFlightCategory(input.flightCategory),
    })
  } catch (error) {
    onError?.(error)
    return null
  }
}

/** Çözümlenmiş TAF (zamanlar kayıttan; AWC epoch'u ham gün/saatten önceliklidir). Çözülemezse null. */
export function toAirportTaf(
  input: TafRecordInput,
  onError?: WeatherDecodeErrorHandler,
): AirportTaf | null {
  try {
    return AirportTafSchema.parse({
      ...decodeTaf(input.raw, {
        issuedAt: input.issuedAt,
        validFrom: input.validFrom,
        validTo: input.validTo,
      }),
      issuedAt: toDate(input.issuedAt).toISOString(),
      validFrom: toDate(input.validFrom).toISOString(),
      validTo: toDate(input.validTo).toISOString(),
      raw: input.raw,
    })
  } catch (error) {
    onError?.(error)
    return null
  }
}

/** Ham biçimin METAR'ı (çözümlemesiz); gözlem zamanı geçersizse null (tam biçimde de düşer). */
export function toRawMetar(input: MetarRecordInput): RawMetar | null {
  const observedAt = isoTime(input.observedAt)
  if (observedAt === null) return null
  return {
    raw: input.raw,
    type: input.type,
    observedAt,
    flightCategory: weatherFlightCategory(input.flightCategory),
  }
}

/** Ham biçimin TAF'ı (çözümlemesiz); zamanlardan biri geçersizse null (tam biçimde de düşer). */
export function toRawTaf(input: TafRecordInput): RawTaf | null {
  const issuedAt = isoTime(input.issuedAt)
  const validFrom = isoTime(input.validFrom)
  const validTo = isoTime(input.validTo)
  if (issuedAt === null || validFrom === null || validTo === null) return null
  return { raw: input.raw, issuedAt, validFrom, validTo }
}

/**
 * Ham biçimdeki bir havalimanının tam biçimi (`GET /v1/weather` ile aynı kayıt). `generatedAt`
 * ham yanıtın üretim anıdır: süresi dolan TAF'lar ve yürürlükteki TAF'lar (`inForceTafs`, D-088)
 * o ana göre seçilir, tam biçim de aynı anı kullanır. TAF sırası korunur (en yeni yayımlanan önce).
 */
export function toAirportWeather(
  station: RawAirportWeather,
  generatedAt: string,
  onError?: WeatherDecodeErrorHandler,
): AirportWeather {
  const at = Date.parse(generatedAt)
  const metar = station.metar === null ? null : toAirportMetar(station.metar, onError)
  const tafs: AirportTaf[] = []
  for (const raw of station.tafs) {
    if (!(Date.parse(raw.validTo) > at)) continue
    const taf = toAirportTaf(raw, onError)
    if (taf !== null) tafs.push(taf)
  }
  return { icao: station.icao, generatedAt, metar, tafs: inForceTafs(tafs, generatedAt) }
}
