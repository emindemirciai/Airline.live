/**
 * Haritanın havalimanı verisi (M6c): `GET /v1/airports?country=TR&include=runways`, tek istek.
 * Noktalar ve IATA kodları bu listeden çizilir; havalimanı penceresi (airport-popup.tsx) aynı
 * kayıttaki il, rakım ve pistleri gösterir. Yanıt tarayıcıda savunmacı biçimde denetlenir (bozuk
 * kayıt atlanır, lib/live/validate.ts ile aynı yaklaşım) ve yalnızca haritanın kullandığı alanlar
 * tutulur: pist uçları, kaplama ve istasyon ayarları belleğe alınmaz.
 */
import type { Airport, Bbox } from '@havayolu/shared'
import { ApiError } from '../../lib/live/api'
import { isAirport, isObject } from '../../lib/live/validate'

/** Pencerenin pist özeti için pistin tek gereken alanı. */
export interface MapRunway {
  /** Pist uzunluğu, ft; kaynakta yoksa null. */
  lengthFt: number | null
}

/** Harita kaydı (`Airport`) + il kodu, yerleşim ve açık pistler (`AirportDetail`'in alt kümesi). */
export interface MapAirport extends Airport {
  /** ISO 3166-2 bölge kodu (TR-34); il adı için `provinceName`. */
  isoRegion: string
  /** OurAirports `municipality`; yalnızca temiz biçimdeyse gösterilir (`airportDistrict`). */
  municipality: string | null
  runways: readonly MapRunway[]
}

const isLength = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value))

/** Kayıt `AirportDetail` biçimindeyse haritanın kullandığı alanları; değilse null. */
export function toMapAirport(value: unknown): MapAirport | null {
  if (!isAirport(value)) return null
  const detail = value as Airport & Record<string, unknown>
  const { isoRegion, municipality, runways } = detail
  if (typeof isoRegion !== 'string') return null
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
    isoRegion,
    municipality,
    runways: parsed,
  }
}

/** Liste adresi: pistlerle birlikte (sayfalarla aynı istek; API'de 10 dk önbellekli). */
export function mapAirportsUrl(apiBaseUrl: string, country = 'TR'): URL {
  const url = new URL('/v1/airports', apiBaseUrl)
  url.searchParams.set('country', country)
  url.searchParams.set('include', 'runways')
  return url
}

/**
 * Haritanın havalimanları. 2xx olmayan yanıt ya da bozuk zarf `ApiError` fırlatır; zarf
 * sağlamsa tek tek bozuk kayıtlar atlanır (sürüm geçişinde eski sekme, yeni API).
 */
export async function fetchMapAirports(
  apiBaseUrl: string,
  signal?: AbortSignal,
  country = 'TR',
): Promise<MapAirport[]> {
  const response = await fetch(mapAirportsUrl(apiBaseUrl, country), {
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
  if (!isObject(body) || typeof body.country !== 'string' || !Array.isArray(body.airports)) {
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
