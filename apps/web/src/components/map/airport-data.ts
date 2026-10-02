/**
 * Haritanın havalimanı verisi (M6c, M6d): listelenen havalimanları, yani IATA kodlu Türkiye
 * havalimanları ve açık halkalardaki yakın ülke havalimanları (D-080), tek istekte:
 * `GET /v1/airports?scope=listed&include=runways`. Noktalar ve IATA kodları bu listeden çizilir;
 * havalimanı penceresi (airport-popup.tsx) aynı kayıttaki il ya da ülke, rakım ve pistleri gösterir.
 * Yanıt tarayıcıda savunmacı biçimde denetlenir (bozuk kayıt atlanır, lib/live/validate.ts ile aynı
 * yaklaşım) ve yalnızca haritanın kullandığı alanlar tutulur: pist uçları, kaplama ve istasyon
 * ayarları belleğe alınmaz.
 */
import type { Airport, Bbox } from '@havayolu/shared'
import { ApiError } from '../../lib/live/api'
import { isAirport, isObject } from '../../lib/live/validate'

/** Pencerenin pist özeti için pistin tek gereken alanı. */
export interface MapRunway {
  /** Pist uzunluğu, ft; kaynakta yoksa null. */
  lengthFt: number | null
}

/**
 * Harita kaydı (`Airport`: ülke, halka ve Türkiye'ye uzaklık dahil) + bölge kodu, yerleşim ve açık
 * pistler (`AirportDetail`'in alt kümesi).
 */
export interface MapAirport extends Airport {
  /** ISO 3166-2 bölge kodu (TR-34, GR-I); Türkiye'de il adı için `provinceName`. */
  isoRegion: string
  /** OurAirports `municipality`; yalnızca temiz biçimdeyse gösterilir (`airportDistrict`). */
  municipality: string | null
  runways: readonly MapRunway[]
}

const isLength = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value))

const COUNTRY_CODE = /^[A-Z]{2}$/
const TURKEY = 'TR'

/**
 * Kaydın ülke kodu: `country` alanı; alan yoksa (ülke alanından önceki API) bölge kodunun öneki
 * (`GR-I` → `GR`; OurAirports'ta bölge kodu her zaman ülke koduyla başlar). Ülke metin olup ISO
 * biçiminde değilse ya da önek de geçersizse null.
 */
function countryOf(country: unknown, isoRegion: string): string | null {
  if (typeof country === 'string') return COUNTRY_CODE.test(country) ? country : null
  const prefix = isoRegion.split('-', 1)[0] ?? ''
  return COUNTRY_CODE.test(prefix) ? prefix : null
}

/**
 * Halka (D-080): sıfır ya da artı tam sayı. Alan yoksa (halkadan önceki API, yalnızca Türkiye
 * listesi) Türkiye havalimanı 0'dır; yurt dışındaki kayıt halkasız kabul edilmez (null).
 */
function ringOf(ring: unknown, country: string): number | null {
  if (ring === undefined) return country === TURKEY ? 0 : null
  return typeof ring === 'number' && Number.isInteger(ring) && ring >= 0 ? ring : null
}

/** Türkiye'ye uzaklık, km: sıfır ya da artı sayı, ya da null. Alan yoksa null (bilinmiyor). */
function distanceOf(distance: unknown): number | null | undefined {
  if (distance === undefined || distance === null) return null
  return typeof distance === 'number' && Number.isFinite(distance) && distance >= 0
    ? distance
    : undefined
}

/** Kayıt `AirportDetail` biçimindeyse haritanın kullandığı alanları; değilse null. */
export function toMapAirport(value: unknown): MapAirport | null {
  if (!isAirport(value)) return null
  const detail = value as Airport & Record<string, unknown>
  const { isoRegion, municipality, runways } = detail
  if (typeof isoRegion !== 'string') return null
  const country = countryOf(detail.country, isoRegion)
  if (country === null) return null
  const ring = ringOf(detail.ring, country)
  if (ring === null) return null
  const distanceToTrKm = distanceOf(detail.distanceToTrKm)
  if (distanceToTrKm === undefined) return null
  if (municipality !== null && typeof municipality !== 'string') return null
  if (!Array.isArray(runways)) return null
  const parsed: MapRunway[] = []
  for (const runway of runways as unknown[]) {
    if (!isObject(runway) || !isLength(runway.lengthFt)) return null
    // Sıfır ya da eksi uzunluk kaynakta eksik değerdir; kayıt düşmez, uzunluk bilinmiyor sayılır.
    parsed.push({
      lengthFt: runway.lengthFt !== null && runway.lengthFt > 0 ? runway.lengthFt : null,
    })
  }
  return {
    icao: value.icao,
    iata: value.iata,
    name: value.name,
    city: value.city,
    lat: value.lat,
    lon: value.lon,
    elevationFt: value.elevationFt,
    type: value.type,
    scheduled: value.scheduled,
    country,
    ring,
    distanceToTrKm,
    isoRegion,
    municipality,
    runways: parsed,
  }
}

/**
 * Liste adresi: listelenen havalimanları (D-080), pistlerle birlikte (sayfalarla aynı liste; API'de
 * önbellekli).
 */
export function mapAirportsUrl(apiBaseUrl: string): URL {
  const url = new URL('/v1/airports', apiBaseUrl)
  url.searchParams.set('scope', 'listed')
  url.searchParams.set('include', 'runways')
  return url
}

/**
 * Haritanın havalimanları. 2xx olmayan yanıt ya da bozuk zarf (`airports` dizisi yok) `ApiError`
 * fırlatır; zarf sağlamsa tek tek bozuk kayıtlar atlanır (sürüm geçişinde eski sekme, yeni API).
 */
export async function fetchMapAirports(
  apiBaseUrl: string,
  signal?: AbortSignal,
): Promise<MapAirport[]> {
  const response = await fetch(mapAirportsUrl(apiBaseUrl), {
    signal,
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new ApiError(response.status)
  let body: unknown
  try {
    body = (await response.json()) as unknown
  } catch {
    throw new ApiError(response.status, 'API response is not valid JSON')
  }
  if (!isObject(body) || !Array.isArray(body.airports)) {
    throw new ApiError(response.status, 'API response has an unexpected shape')
  }
  const airports: MapAirport[] = []
  for (const item of body.airports as unknown[]) {
    const airport = toMapAirport(item)
    if (airport) airports.push(airport)
  }
  return airports
}

/** Pist sayısı ve uzunluğu bilinen en uzun pist (ft); uzunluk bilinmiyorsa null. */
export function runwaySummary(runways: readonly MapRunway[]): {
  count: number
  longestFt: number | null
} {
  let longestFt: number | null = null
  for (const { lengthFt } of runways) {
    if (lengthFt !== null && (longestFt === null || lengthFt > longestFt)) longestFt = lengthFt
  }
  return { count: runways.length, longestFt }
}

/** Klavye listesindeki (Havalimanları denetimi) en fazla havalimanı. */
export const AIRPORT_LIST_LIMIT = 12

/**
 * Görünümdeki havalimanları, görünümün ortasına uzaklığa göre (yakın önce; eşitse IATA sırası),
 * en fazla `limit`. Havalimanı penceresinin klavye ve ekran okuyucu yolu bu listedir: pinler ve
 * kodlar haritada çizilir, odak alamaz (D-078).
 */
export function airportsInView(
  airports: readonly MapAirport[],
  viewport: { bounds: Bbox; center: { lat: number; lon: number } },
  limit: number = AIRPORT_LIST_LIMIT,
): MapAirport[] {
  const { bounds, center } = viewport
  const cos = Math.cos((center.lat * Math.PI) / 180)
  const distance = (a: MapAirport) => Math.hypot((a.lon - center.lon) * cos, a.lat - center.lat)
  return airports
    .filter(
      (a) =>
        a.lat >= bounds.minLat &&
        a.lat <= bounds.maxLat &&
        a.lon >= bounds.minLon &&
        a.lon <= bounds.maxLon,
    )
    .map((airport) => ({ airport, distance: distance(airport) }))
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        (a.airport.iata < b.airport.iata ? -1 : a.airport.iata > b.airport.iata ? 1 : 0),
    )
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.airport)
}
