import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { airports } from './schema'

/**
 * Haritada gösterilen havalimanları (`GET /v1/airports`): OurAirports kayıtlarından IATA kodu
 * olan büyük, orta ve küçük havalimanları. Heliport, deniz uçağı üssü ve kapalı alan yoktur.
 * Tablo zaten içe aktarım süzgecinden geçmiştir (büyük, orta ya da tarifeli sefer alan alanlar;
 * data-sources.md §3).
 */
export const LISTED_AIRPORT_TYPES = ['large_airport', 'medium_airport', 'small_airport'] as const
export type ListedAirportType = (typeof LISTED_AIRPORT_TYPES)[number]

/** Bir havalimanı; `@havayolu/shared` `Airport` ile aynı biçimdedir. */
export interface ListedAirport {
  /** ICAO kodu; yoksa GPS kodu, o da yoksa OurAirports kimliği (ident). */
  icao: string
  iata: string
  name: string
  city: string | null
  lat: number
  lon: number
  elevationFt: number | null
  type: ListedAirportType
  scheduled: boolean
}

/** `airports` tablosundan okunan ham satır (sütunlar schema.ts'teki adlarıyla). */
export interface AirportSourceRow {
  id: number
  ident: string
  type: string
  name: string
  latitudeDeg: number
  longitudeDeg: number
  elevationFt: number | null
  municipality: string | null
  scheduledService: boolean
  icaoCode: string | null
  iataCode: string | null
  gpsCode: string | null
}

/** IATA havalimanı kodu üç harftir. */
const IATA_CODE = /^[A-Z]{3}$/

const isListedType = (type: string): type is ListedAirportType =>
  (LISTED_AIRPORT_TYPES as readonly string[]).includes(type)

/** Kırpılmış, boş değilse değer. */
const present = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Saf kısım: ham satırlardan liste. IATA kodu kırpılıp büyük harfe çevrilir; üç harf değilse ya da
 * tür listede yoksa satır atlanır. ICAO = `icao_code`, yoksa `gps_code`, o da yoksa `ident`.
 * Aynı ICAO'ya düşen satırlardan önce gelen (satırlar kimlik sırasıyla verilir, en küçük
 * kimlik) kalır. Sonuç IATA'ya, eşitse ICAO'ya göre sıralıdır.
 */
export function toListedAirports(rows: readonly AirportSourceRow[]): ListedAirport[] {
  const byIcao = new Map<string, ListedAirport>()
  for (const row of rows) {
    const iata = present(row.iataCode)?.toUpperCase() ?? ''
    if (!IATA_CODE.test(iata) || !isListedType(row.type)) continue
    const icao = (present(row.icaoCode) ?? present(row.gpsCode) ?? row.ident.trim()).toUpperCase()
    if (icao === '' || byIcao.has(icao)) continue
    byIcao.set(icao, {
      icao,
      iata,
      name: row.name.trim(),
      city: present(row.municipality),
      lat: row.latitudeDeg,
      lon: row.longitudeDeg,
      elevationFt: row.elevationFt,
      type: row.type,
      scheduled: row.scheduledService,
    })
  }
  return [...byIcao.values()].sort((a, b) => byCode(a.iata, b.iata) || byCode(a.icao, b.icao))
}

/**
 * Bir ülkenin IATA kodlu havalimanları (`country`: ISO 3166-1 alpha-2, büyük harf; ör. TR).
 * Türkiye'de ~60 satırdır; süzme SQL'de, biçim denetimi ve sıralama `toListedAirports`'tadır.
 */
export async function listAirportsWithIata(
  db: PostgresJsDatabase,
  country: string,
): Promise<ListedAirport[]> {
  const rows = await db
    .select({
      id: airports.id,
      ident: airports.ident,
      type: airports.type,
      name: airports.name,
      latitudeDeg: airports.latitudeDeg,
      longitudeDeg: airports.longitudeDeg,
      elevationFt: airports.elevationFt,
      municipality: airports.municipality,
      scheduledService: airports.scheduledService,
      icaoCode: airports.icaoCode,
      iataCode: airports.iataCode,
      gpsCode: airports.gpsCode,
    })
    .from(airports)
    .where(
      and(
        eq(airports.isoCountry, country),
        inArray(airports.type, [...LISTED_AIRPORT_TYPES]),
        isNotNull(airports.iataCode),
      ),
    )
    .orderBy(asc(airports.id))
  return toListedAirports(rows)
}
