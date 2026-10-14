/**
 * Haritanın havalimanı verisi (M6c, M6d): listelenen havalimanları, yani IATA kodlu Türkiye
 * havalimanları ve açık halkalardaki yurt dışı havalimanları (D-080), tek istekte:
 * `GET /v1/airports?scope=listed&include=map` (D-111). Listede askerî hava üssü yoktur (D-107);
 * canlı harita listeyi yüklerken yine savunma süzgecinden geçirir (`mapShownAirports`,
 * `@havayolu/shared`; D-103). Noktalar ve IATA kodları bu listeden çizilir; havalimanı penceresi
 * (airport-popup.tsx) aynı kayıttaki il ya da ülke, rakım ve pistleri gösterir. Uçak listesinin
 * tahmini durumu ve konumu (D-085) ve `?havalimani=` hedefi (`airportLinkCenter`) aynı listeyi
 * kullanır.
 * Yanıt tarayıcıda savunmacı biçimde denetlenir (bozuk kayıt atlanır, lib/live/validate.ts ile aynı
 * yaklaşım) ve yalnızca haritanın kullandığı alanlar tutulur. Pist uçlarından yalnızca uçak
 * listesinin tahmini durumu (D-085, lib/map/flight-phase.ts) için gereken ad, yön ve eşik tutulur.
 *
 * Ölçek (D-111): `include=map` kaydı pencerenin alanlarını ve pist uzunluklarını taşır; pist uçları
 * yalnız 1.–3. halkada (canlı veri kapsaması, D-073) gelir. 4. halkada 1.217 havalimanı ~0,53 MB
 * ham, ~90 KB brotli (önce pistli liste ~1,05 MB, ~183 KB); 5. halkada 3.243 havalimanı ~1,16 MB,
 * ~185 KB. Uçsuz bir havalimanının uçları, listedeki bir uçak evre yarıçapına girince tek
 * havalimanı ucundan oturumda bir kez istenir (`fetchAirportRunways`, use-flight-phases.ts): izlenen
 * uçak (D-073) JFK'ye inerken de pist etiketi çıkar. Noktalar tek GeoJSON kaynağıdır; etiket tuvali
 * her `render` olayında görünümdeki havalimanlarına kod yerleştirir (labels.ts →
 * `layoutAirportChips`, ızgaralı dizin). Görünür alana göre yükleme dünya geneli canlı veriyle
 * değerlendirilir.
 */
import type { Airport, Bbox } from '@havayolu/shared'
import { ApiError } from '../../lib/live/api'
import { isAirport, isObject } from '../../lib/live/validate'
import { findAirportByCode } from '../../lib/map/url-state'
import { nearestWorldLon } from './camera'

/**
 * Pistin bir ucu, uçak listesinin pist hizası denetimi için (D-085): ad, bu uçtan karşı uca gerçek
 * yön ve pist eşiği (API'de kaydırılmış eşik zaten uygulanmıştır; `RunwayEnd`, airport-detail.ts).
 */
export interface MapRunwayEnd {
  /** Pist adı (ör. 35L); kaynakta yoksa boş metin. */
  ident: string
  trueBearingDeg: number
  /** Pist eşiği, derece. */
  lat: number
  lon: number
}

/** Pencerenin pist özeti ve uçak listesinin pist hizası için pistin gereken alanları. */
export interface MapRunway {
  /** Pist uzunluğu, ft; kaynakta yoksa null. */
  lengthFt: number | null
  /**
   * Yönü ve eşiği bilinen uçlar (yön ya da eşiği eksik uç atlanır). Alan yoksa liste uçları
   * taşımadı (4. halkadan itibaren, `include=map`, D-111): uçlar gerekince tek havalimanı ucundan
   * istenir, o zamana kadar pist hizası denetlenmez. Pencere yalnızca uzunluğu kullanır.
   */
  ends?: readonly MapRunwayEnd[]
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
  /**
   * Adres takma adı (D-109): kodu değişen havalimanının eski dört karakterli kodu (UTSS → UZSS);
   * arama onu tam kod olarak bulur (D-108). Takma ad yoksa ya da biçimi bozuksa alan yoktur.
   */
  identAlias?: string
  runways: readonly MapRunway[]
}

const isLength = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value))

const isCoordinate = (value: unknown, limit: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit

/**
 * Pist uçları hoşgörüyle okunur: dizi değilse boş liste, yönü ya da eşiği eksik ya da bozuk uç
 * atlanır. Havalimanı ve pist bu yüzden düşmez (pencere pist uçlarından önceki API ile de çalışır).
 */
function runwayEndsOf(ends: unknown): MapRunwayEnd[] {
  if (!Array.isArray(ends)) return []
  const parsed: MapRunwayEnd[] = []
  for (const end of ends as unknown[]) {
    if (!isObject(end)) continue
    const { ident, trueBearingDeg, thresholdLat, thresholdLon } = end
    if (typeof trueBearingDeg !== 'number' || !Number.isFinite(trueBearingDeg)) continue
    if (!isCoordinate(thresholdLat, 90) || !isCoordinate(thresholdLon, 180)) continue
    parsed.push({
      ident: typeof ident === 'string' ? ident.trim() : '',
      trueBearingDeg,
      lat: thresholdLat,
      lon: thresholdLon,
    })
  }
  return parsed
}

const COUNTRY_CODE = /^[A-Z]{2}$/
const ALIAS_CODE = /^[A-Z0-9]{4}$/
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
  const { isoRegion, municipality, runways, identAlias } = detail
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
    const lengthFt = runway.lengthFt !== null && runway.lengthFt > 0 ? runway.lengthFt : null
    // Uç alanı yoksa liste uçları taşımadı (D-111): alan yazılmaz, uçlar gerekince istenir.
    parsed.push(
      runway.ends === undefined ? { lengthFt } : { lengthFt, ends: runwayEndsOf(runway.ends) },
    )
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
    // Bozuk takma ad kaydı düşürmez; yalnız alan yazılmaz.
    ...(typeof identAlias === 'string' && ALIAS_CODE.test(identAlias) ? { identAlias } : {}),
    runways: parsed,
  }
}

/**
 * Liste adresi: listelenen havalimanları (D-080), haritanın kaydıyla (`include=map`, D-111; API'de
 * hazır, sıkıştırılmış gövde).
 */
export function mapAirportsUrl(apiBaseUrl: string): URL {
  const url = new URL('/v1/airports', apiBaseUrl)
  url.searchParams.set('scope', 'listed')
  url.searchParams.set('include', 'map')
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

/**
 * Tek havalimanının pistleri uçlarıyla (`GET /v1/airports/<ICAO>`, D-111): haritanın listesinde
 * uçları gelmeyen havalimanı için uçak listesinin pist hizası. Yanıt başarısız ya da bozuksa null
 * (kesilen istek fırlatır).
 */
export async function fetchAirportRunways(
  apiBaseUrl: string,
  icao: string,
  signal?: AbortSignal,
): Promise<readonly MapRunway[] | null> {
  try {
    const response = await fetch(new URL(`/v1/airports/${encodeURIComponent(icao)}`, apiBaseUrl), {
      signal,
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return null
    const airport = toMapAirport((await response.json()) as unknown)
    return airport?.icao === icao ? airport.runways : null
  } catch (error) {
    if (signal?.aborted) throw error
    return null
  }
}

/**
 * `?havalimani=` hedefinin merkezi: kod (ICAO ya da IATA) haritanın listesinde aranır; harita oraya
 * gider (havalimanı sayfasındaki "Canlı haritada aç" bağlantısı). `?havalimani=` hiçbir
 * havalimanında pencere açmaz. Kod listede yoksa null: askerî hava üsleri listede olmadığı için
 * (D-107) `?havalimani=<üs>` haritayı açılış görünümünde bırakır.
 */
export function airportLinkCenter(
  airports: readonly MapAirport[],
  code: string,
): { lat: number; lon: number } | null {
  const airport = findAirportByCode(airports, code)
  return airport ? { lat: airport.lat, lon: airport.lon } : null
}

/** Pist sayısı ve uzunluğu bilinen en uzun pist (ft); uzunluk bilinmiyorsa null. */
export function runwaySummary(runways: readonly Pick<MapRunway, 'lengthFt'>[]): {
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
 * kodlar haritada çizilir, odak alamaz (D-078). MapLibre'nin sınırları sarılmamıştır (180.
 * meridyende batı 170, doğu 190; D-111): boylam karşılaştırmadan önce `[batı, batı + 360)`
 * aralığına, uzaklık için kameranın dünya kopyasına getirilir.
 */
export function airportsInView(
  airports: readonly MapAirport[],
  viewport: { bounds: Bbox; center: { lat: number; lon: number } },
  limit: number = AIRPORT_LIST_LIMIT,
): MapAirport[] {
  const { bounds, center } = viewport
  const cos = Math.cos((center.lat * Math.PI) / 180)
  const distance = (a: MapAirport) =>
    Math.hypot((nearestWorldLon(a.lon, center.lon) - center.lon) * cos, a.lat - center.lat)
  const west = bounds.minLon
  const span = bounds.maxLon - west
  const inLon = (lon: number) => span >= 360 || (((lon - west) % 360) + 360) % 360 <= span
  return airports
    .filter((a) => a.lat >= bounds.minLat && a.lat <= bounds.maxLat && inLon(a.lon))
    .map((airport) => ({ airport, distance: distance(airport) }))
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        (a.airport.iata < b.airport.iata ? -1 : a.airport.iata > b.airport.iata ? 1 : 0),
    )
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.airport)
}
