import type { AirlineCodes } from '@havayolu/db'
import { isHiddenByDefault, withPrivacy } from '@havayolu/providers'
import { z } from 'zod'
import type { PublicAircraft } from './types'

/**
 * `redis-live`'daki `AircraftState` JSON'unun (packages/providers/src/aircraft.ts) API'nin kullandığı
 * alanları. Worker'ın yazdığı kayıt doğrulanır; bozuk kayıt hiçbir yanıta girmez. Görüntü alanları
 * eksikse null sayılır (eski ya da yeni bir worker sürümü alan eklese/çıkarsa kayıt düşmesin), ama
 * kimlik, konum, zaman ve bayrak alanı olmadan kayıt kullanılmaz. `dbFlags` hiç yoksa bilinmiyor
 * (null) sayılır, bu da uçağı gizler (D-071).
 */
const nullableNumber = z.number().nullable().default(null)
const nullableString = z.string().nullable().default(null)

const StoredAircraft = z.object({
  hex: z.string().regex(/^~?[0-9a-f]{6}$/),
  callsign: nullableString,
  registration: nullableString,
  typeCode: nullableString,
  category: nullableString,
  dbFlags: z.number().int().min(0).nullable().default(null),
  positionSource: z.string().default('unknown'),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  altBaroFt: nullableNumber,
  onGround: z.boolean(),
  gsKt: nullableNumber,
  trackDeg: nullableNumber,
  baroRateFpm: nullableNumber,
  geomRateFpm: nullableNumber,
  squawk: nullableString,
  sampleTime: z.number().positive(),
  source: z.enum(['adsbLol', 'localReceiver']),
})

/** Rakamlı havayolu çağrı kodu: 3 harfli ICAO kodu ve 1–4 rakam (THY974, PGT0123). */
const AIRLINE_CALLSIGN = /^([A-Z]{3})(\d{1,4})$/

const round = (value: number, digits: number) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
const roundOrNull = (value: number | null, digits: number) =>
  value === null ? null : round(value, digits)

/**
 * Çağrı kodundan sefer no (THY974 → TK / 974). Yalnızca ICAO kodunun IATA karşılığı bilinen
 * havayolu çağrı kodlarında; baştaki sıfırlar atılır, sıfır numara sefer no değildir.
 */
export function flightNumberOf(callsign: string | null, codes: AirlineCodes): PublicAircraft['fn'] {
  if (callsign === null) return null
  const match = AIRLINE_CALLSIGN.exec(callsign.trim().toUpperCase())
  if (!match) return null
  const [, icao = '', digits = ''] = match
  const airline = codes.icaoToIata.get(icao)
  const number = digits.replace(/^0+/, '')
  if (airline === undefined || number === '') return null
  return { airline, number }
}

/**
 * Saklanan kaydı herkese açık kayda çevirir (D-074). Geçersiz kayıt, askeri ve bayrağı bilinmeyen
 * uçak (D-071) null döner; PIA/LADD uçakta tescil ve tescile eşit çağrı kodu gizlenir
 * (`withPrivacy`). Yük küçük kalsın diye konum 5 ondalığa (~1 m), iz yönü 1 ondalığa, irtifa, hız
 * ve dikey hız tam sayıya yuvarlanır.
 */
export function toPublicAircraft(raw: unknown, codes: AirlineCodes): PublicAircraft | null {
  const parsed = StoredAircraft.safeParse(raw)
  if (!parsed.success) return null
  const state = parsed.data
  if (isHiddenByDefault(state)) return null
  const { callsign, registration } = withPrivacy(state)
  return {
    hex: state.hex,
    lat: round(state.lat, 5),
    lon: round(state.lon, 5),
    alt: roundOrNull(state.altBaroFt, 0),
    gnd: state.onGround,
    gs: roundOrNull(state.gsKt, 0),
    trk: roundOrNull(state.trackDeg, 1),
    vr: roundOrNull(state.baroRateFpm ?? state.geomRateFpm, 0),
    cs: callsign,
    fn: flightNumberOf(callsign, codes),
    reg: registration,
    type: state.typeCode,
    cat: state.category,
    sq: state.squawk,
    src: state.source,
    psrc: state.positionSource,
    t: state.sampleTime,
  }
}
