import 'server-only'
import { distanceKm } from '@havayolu/geo'
import { coveragePlan, planCoversPoint, type PlannedCircle } from '@havayolu/geo/coverage'
import {
  airportNameSource,
  civilFlightClosure,
  type AirportDetail,
  type AirportNameSource,
} from '@havayolu/shared'
import { cache } from 'react'
import { z } from 'zod'
// Göreli yollar: vitest `@/` takma adını çözmez; bu modül ve onu kullanan SEO dosyaları testte yüklenir.
import { isTurkish } from '../components/airports/airport-text'
import { getServerEnv } from './env'

export { isTurkish } from '../components/airports/airport-text'

/**
 * Havalimanı sayfalarının (M6b) tek veri çağrısı: `GET /v1/airports?scope=listed&include=runways`.
 * "Listelenen havalimanları" (D-080): IATA kodlu Türkiye havalimanları ve açık halkalardaki
 * (`ENABLED_AIRPORT_RING`) yakın ülke havalimanları; halka üyeliğini API hesaplar. Sayfa, üst veri,
 * site haritası, llms.txt ve paylaşım görseli hepsi bu listeden türetilir.
 *
 * - Next veri önbelleği: 1 saat (`revalidate`), etiket `airports`. İçe aktarım günde bir çalışır;
 *   API'nin kendi 10 dk önbelleği de vardır. Saatte bir istek, web konteynerinin API'deki tek hız
 *   sınırı kovasını (60/dk, D-060) hiçbir koşulda zorlamaz.
 * - İstemci başlıkları (X-Forwarded-For, CF-Connecting-IP) **iletilmez**: Next önbellek anahtarı
 *   istek başlıklarını içerir (next/dist/server/lib/incremental-cache → generateCacheKey); iletilse
 *   önbellek ziyaretçi başına bölünürdü.
 * - Boyut (4. halka, D-102; savaş kapanışlarıyla, D-110): 1.240 havalimanı ve pistleri 1,07 MB;
 *   Next'in önbellek kaydı (gövde base64) 1,43 MB, 2 MiB öğe sınırının %68'i (geliştirmede sınır
 *   aşılırsa hata, üretimde önbelleksiz istek). API'nin `airports-cache-size.test.ts` testi kaydın
 *   sınırın %85'inin altında kaldığını fixture'dan denetler; 5. halkada sınır kırılır (D-101).
 * - Ayrıştırma önbellek kaydı başına bir kez: Next her çizimde kaydın gövdesini yeniden verir;
 *   gövdenin JSON'u ve denetimi (`parseAirportsBody`) 4. halkada çizim başına ~12 ms'dir (JSON ~6,
 *   zod ~5; 3. halkada ~5). Ayrıştırılan liste pencere başına bellekte tutulur ve gelen gövde
 *   bir öncekiyle aynı metinse yeniden kullanılır (~2 ms: base64 çözme ve metin karşılaştırması;
 *   D-102). Kayıt yenilenip gövde değişince yeniden ayrıştırılır; Next'in önbellek davranışı
 *   (süre, etiket, hatada eski kayıt) değişmez. Dönen dizi istekler arasında paylaşılır, salt
 *   okunurdur (`readonly`).
 * - İstek başına tek çağrı: React `cache()`.
 * - Next yalnızca 200 yanıtı önbelleğe alır; API ulaşılamazsa sayfa 500 verir (yumuşak 404 değil),
 *   önbellekte eski kopya varsa o sunulur.
 * - Boş liste (ilk kurulumda içe aktarım bitmeden) saatlik kayıtta kalabilir; o durumda liste kısa
 *   süreli (1 dk) ikinci bir önbellek kaydından okunur. Hiçbir çizim önbelleksiz istek atmaz: API'ye
 *   en çok dakikada bir istek gider ve içe aktarım bitince sayfalar bir dakika içinde dolar.
 */

/** Listenin kapsamı (`GET /v1/airports?scope=listed`, D-080); hava durumu da aynı kapsamla istenir. */
export const AIRPORTS_SCOPE = 'listed'
/** Next veri önbelleği süresi, saniye. */
export const AIRPORTS_REVALIDATE_S = 3600
/** Saatlik kayıttaki liste boşsa kullanılan kısa süreli önbellek kaydının süresi, saniye. */
export const AIRPORTS_EMPTY_REVALIDATE_S = 60
/** `revalidateTag` ile elle tazelemek için önbellek etiketi. */
export const AIRPORTS_CACHE_TAG = 'airports'
/** API yanıt vermezse sayfa bu kadar bekler. */
export const AIRPORTS_TIMEOUT_MS = 8000

/** ICAO kodu adreste büyük harflidir (D-076). */
const ICAO = /^[A-Z0-9]{4}$/
const IATA = /^[A-Z]{3}$/
/** Adresteki kod: 3 harf IATA ya da 4 karakter ICAO, büyük-küçük harf fark etmez. */
const CODE = /^[A-Za-z0-9]{3,4}$/

const finite = z.number().refine(Number.isFinite)
const nullableNumber = finite.nullable()

const runwayEndSchema = z.object({
  ident: z.string(),
  trueBearingDeg: nullableNumber,
  displacedThresholdFt: nullableNumber,
  thresholdLat: nullableNumber,
  thresholdLon: nullableNumber,
})

const runwaySchema = z.object({
  id: z.number().int(),
  lengthFt: nullableNumber,
  widthFt: nullableNumber,
  surface: z.string().nullable(),
  lighted: z.boolean(),
  ends: z.tuple([runwayEndSchema, runwayEndSchema]),
})

/**
 * `AirportDetail` (`@havayolu/shared`). Tip ataması şemanın ortak tiple aynı kalmasını derleme
 * zamanında denetler; fazladan alanlar atılır.
 */
const airportSchema: z.ZodType<AirportDetail> = z.object({
  icao: z.string().min(1),
  iata: z.string(),
  name: z.string().min(1),
  city: z.string().nullable(),
  lat: finite.min(-90).max(90),
  lon: finite.min(-180).max(180),
  elevationFt: nullableNumber,
  type: z.enum(['large_airport', 'medium_airport', 'small_airport']),
  scheduled: z.boolean(),
  isoRegion: z.string(),
  municipality: z.string().nullable(),
  identAlias: z.string().regex(ICAO).optional(),
  country: z.string().regex(/^[A-Z]{2}$/),
  ring: z.number().int().min(0),
  distanceToTrKm: finite.min(0).nullable(),
  nearestTr: z
    .object({ icao: z.string().min(1), iata: z.string(), name: z.string().min(1) })
    .nullable(),
  station: z
    .object({ active: z.boolean(), primary: z.boolean(), fetchRadiusNm: finite.positive() })
    .nullable(),
  dataUpdatedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  runways: z.array(runwaySchema),
})

/** Zarf: `scope=listed` yanıtında `country` yoktur; yalnızca liste denetlenir. */
const responseSchema = z.object({ airports: z.array(z.unknown()) })

/** API'nin iç adresinden liste adresi (`API_INTERNAL_URL`, D-060). */
export function airportsUrl(apiInternalUrl: string): string {
  const url = new URL('/v1/airports', apiInternalUrl)
  url.searchParams.set('scope', AIRPORTS_SCOPE)
  url.searchParams.set('include', 'runways')
  return url.toString()
}

/**
 * Yanıt gövdesini denetler. Zarf bozuksa hata fırlatır; tek bir bozuk kayıt (sürüm geçişi) listeyi
 * düşürmez, atlanır.
 */
export function parseAirportsBody(body: unknown): AirportDetail[] {
  const envelope = responseSchema.safeParse(body)
  if (!envelope.success) throw new Error('airports response has an unexpected shape')
  const airports: AirportDetail[] = []
  for (const item of envelope.data.airports) {
    const parsed = airportSchema.safeParse(item)
    if (parsed.success) airports.push(parsed.data)
  }
  return airports
}

/** Önbellek kaydını ayıran istek başlığı; API bu başlığı okumaz. */
export const AIRPORTS_CACHE_WINDOW_HEADER = 'x-hy-cache-window'

/**
 * Önbellek penceresi başına son ayrıştırılan liste ve gövdesi: Next'in veri önbelleği aynı gövdeyi
 * verdikçe JSON ve zod yeniden çalışmaz (D-102).
 */
const parsedByWindow = new Map<number, { text: string; airports: readonly AirportDetail[] }>()

/**
 * Önbellekli liste isteği. Next veri önbelleğinin anahtarı `revalidate` süresini içermez, istek
 * başlıklarını içerir (`incremental-cache/index.js` → `generateCacheKey`). Pencere bu yüzden bir
 * başlıkla anahtara girer: saatlik ve dakikalık kayıtlar birbirini ezmez.
 */
async function fetchAirports(url: string, revalidateS: number): Promise<readonly AirportDetail[]> {
  const response = await fetch(url, {
    next: { revalidate: revalidateS, tags: [AIRPORTS_CACHE_TAG] },
    headers: { accept: 'application/json', [AIRPORTS_CACHE_WINDOW_HEADER]: String(revalidateS) },
    signal: AbortSignal.timeout(AIRPORTS_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`airports request failed: HTTP ${response.status}`)
  const text = await response.text()
  const memo = parsedByWindow.get(revalidateS)
  if (memo?.text === text) return memo.airports
  const airports: readonly AirportDetail[] = parseAirportsBody(JSON.parse(text) as unknown)
  parsedByWindow.set(revalidateS, { text, airports })
  return airports
}

/**
 * Listelenen havalimanları (Türkiye ve yakın ülkeler), pistleri ve istasyon bilgisiyle. Saatlik
 * kayıttaki liste boşsa (ilk kurulumda içe aktarım bitmeden alınmış) dakikalık kayda bakılır;
 * önbelleksiz istek atılmaz. Saatlik kayıt süresi dolunca kendiliğinden dolu listeyle yenilenir.
 */
export const getAirports = cache(async (): Promise<readonly AirportDetail[]> => {
  const url = airportsUrl(getServerEnv().API_INTERNAL_URL)
  const cached = await fetchAirports(url, AIRPORTS_REVALIDATE_S)
  if (cached.length > 0) return cached
  return fetchAirports(url, AIRPORTS_EMPTY_REVALIDATE_S)
})

/** ICAO koduyla (büyük-küçük harf fark etmez) tek havalimanı; yoksa undefined. */
export async function getAirport(icao: string): Promise<AirportDetail | undefined> {
  const code = icao.trim().toUpperCase()
  return (await getAirports()).find((airport) => airport.icao === code)
}

export type AirportCodeResolution =
  | { kind: 'found'; airport: AirportDetail }
  /**
   * Kanonik adres başka: küçük harfli ICAO, IATA kodu ya da adres takma adı (D-109) → büyük harfli
   * ICAO (308).
   */
  | { kind: 'redirect'; icao: string }
  | { kind: 'not_found' }

/**
 * Adresteki kodun çözümü (`/istasyon/<kod>`): yalnızca büyük harfli ICAO kanoniktir. IATA kodu,
 * küçük harfli biçimler ve adres takma adı (`identAlias`, D-109: kodu değişen havalimanının eski
 * kodu, ör. UTSS → UZSS) kalıcı olarak ICAO adresine yönlenir; bilinmeyen ya da biçimi bozuk kod
 * 404. Liste yalnız listelenen havalimanlarıdır: takma ad hiçbir zaman listelenmeyen bir
 * havalimanına yönlenmez. Bir kod hem bir havalimanının ICAO'su hem başkasının takma adıysa ICAO
 * kazanır (API takma adı zaten böyle kurar).
 */
export function resolveAirportCode(
  raw: string,
  airports: readonly AirportDetail[],
): AirportCodeResolution {
  let code: string
  try {
    code = decodeURIComponent(raw)
  } catch {
    return { kind: 'not_found' }
  }
  if (!CODE.test(code)) return { kind: 'not_found' }
  const upper = code.toUpperCase()
  const byIcao = ICAO.test(upper) ? airports.find((a) => a.icao === upper) : undefined
  if (byIcao) return code === byIcao.icao ? { kind: 'found', airport: byIcao } : redirect(byIcao)
  const byIata = IATA.test(upper) ? airports.find((a) => a.iata === upper) : undefined
  if (byIata) return redirect(byIata)
  const byAlias = ICAO.test(upper) ? airports.find((a) => a.identAlias === upper) : undefined
  return byAlias ? redirect(byAlias) : { kind: 'not_found' }
}

function redirect(airport: AirportDetail): AirportCodeResolution {
  return { kind: 'redirect', icao: airport.icao }
}

/** Resmî adı sivil bir kaynaktan doğrulanan havalimanının ad kaynakları (D-076, D-084). */
const CIVIL_NAME_SOURCES: ReadonlySet<AirportNameSource> = new Set(['dhmi', 'operator', 'ministry'])

/**
 * Sayfa dizine eklenir mi (D-076): arkasında durabildiğimiz veriye göre. Resmî adı DHMİ, işletmeci
 * ya da bakanlık kaynağından doğrulanan sivil havalimanları (Ankara (Etimesgut) dahil, D-084),
 * izlenen istasyonlar ve OurAirports'ta tarifeli seferi kayıtlı olanlar. OurAirports
 * `scheduled_service` bayrağı tek başına ölçüt değildir: bazı sivil havalimanlarında güncel değildir
 * (Siirt, Kocaeli). Kalanlar (adı doğrulanmamış, tarifesiz ve istasyon olmayan yeni kayıtlar)
 * `noindex, follow` alır ve site haritasına girmez; askerî hava üsleri D-107'den beri listede
 * yoktur (sayfaları 404), D-084'te bu kuralla dışarıda kalıyorlardı. Yakın ülkelerdeki listelenen
 * havalimanları aday kuralı gereği tarifeli ya da kapanış tablosundadır (`isForeignCandidate`),
 * hepsi dizine eklenir (D-080). Savaş nedeniyle kapalı havalimanı (`civilFlightClosure`, D-110)
 * OurAirports'ta tarifesiz görünse de dizine eklenir: kapanış tablosu kaynaklı ve küratörlüdür,
 * sayfanın notu durumu açıklar, sayfa tarife vaat etmez.
 */
export function isIndexable(airport: AirportDetail): boolean {
  return (
    airport.scheduled ||
    airport.station !== null ||
    CIVIL_NAME_SOURCES.has(airportNameSource(airport.icao)) ||
    civilFlightClosure(airport.icao) !== undefined
  )
}

/** Listenin Türkiye kısmı ve yakın ülkeler kısmı, listedeki sırayla. */
export function splitByCountry<T extends Pick<AirportDetail, 'country'>>(
  airports: readonly T[],
): { turkey: T[]; foreign: T[] } {
  const turkey: T[] = []
  const foreign: T[] = []
  for (const airport of airports) (isTurkish(airport) ? turkey : foreign).push(airport)
  return { turkey, foreign }
}

/** Havalimanı şu an izlenen (etkin) bir istasyon mu. */
export function isMonitoredStation(airport: AirportDetail): boolean {
  return airport.station?.active === true
}

/**
 * Worker'ın canlı veri kapsama planı (`@havayolu/geo/coverage`, D-073). Worker planı etkin
 * istasyonlardan ve onların havalimanı merkezinden kurar (`activeStationsWithArp`); burada aynı
 * istasyonlar listeden alınır. Listede olmayan istasyonlar (Türkiye dışı ya da IATA kodsuz) hesaba
 * girmez.
 */
export function liveCoveragePlan(airports: readonly AirportDetail[]): PlannedCircle[] {
  return coveragePlan(
    airports.filter(isMonitoredStation).map((airport) => ({
      icao: airport.icao,
      lat: airport.lat,
      lon: airport.lon,
      fetchRadiusNm: airport.station?.fetchRadiusNm ?? 0,
      isPrimary: airport.station?.primary === true,
    })),
  )
}

/**
 * Havalimanı merkezi canlı veri çekim alanında mı. Dışındaysa çevresindeki uçaklar için veri çekilmez;
 * sayfa canlı haritada uçak vaat etmez (Hakkari Yüksekova, tohum istasyonlarla).
 */
export function isInLiveCoverage(airport: AirportDetail, plan: readonly PlannedCircle[]): boolean {
  return planCoversPoint(plan, airport)
}

export interface NearbyAirport {
  airport: AirportDetail
  /** Havalimanı merkezleri arası büyük daire mesafesi, km. */
  distanceKm: number
}

/** Havalimanı merkezine en yakın `n` havalimanı (kendisi hariç), yakından uzağa. */
export function nearestAirports(
  airport: AirportDetail,
  all: readonly AirportDetail[],
  n: number,
): NearbyAirport[] {
  return all
    .filter((other) => other.icao !== airport.icao)
    .map((other) => ({ airport: other, distanceKm: distanceKm(airport, other) }))
    .sort((a, b) => a.distanceKm - b.distanceKm || a.airport.icao.localeCompare(b.airport.icao))
    .slice(0, Math.max(0, n))
}

/**
 * Aynı ildeki diğer havalimanları (ISO 3166-2 koduna göre), ICAO sırasıyla. Yalnızca Türkiye'de:
 * "… ilindeki diğer havalimanları" cümlesi yabancı havalimanında kurulmaz (D-080).
 */
export function sameProvinceAirports(
  airport: AirportDetail,
  all: readonly AirportDetail[],
): AirportDetail[] {
  if (!isTurkish(airport)) return []
  return all
    .filter(
      (other) =>
        isTurkish(other) && other.isoRegion === airport.isoRegion && other.icao !== airport.icao,
    )
    .sort((a, b) => a.icao.localeCompare(b.icao))
}

/** Listedeki en yeni veri değişikliği (ISO 8601); liste boşsa null. */
export function latestDataUpdate(airports: readonly AirportDetail[]): string | null {
  let latest: string | null = null
  let latestMs = Number.NEGATIVE_INFINITY
  for (const airport of airports) {
    const ms = Date.parse(airport.dataUpdatedAt)
    if (ms > latestMs) {
      latestMs = ms
      latest = airport.dataUpdatedAt
    }
  }
  return latest
}
