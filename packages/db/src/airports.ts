import { and, asc, eq, inArray, isNotNull, ne, or, sql, type SQL } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { airports, runwayOverrides, runways, stations } from './schema'

/**
 * Haritada gösterilen havalimanları (`GET /v1/airports`): OurAirports kayıtlarından IATA kodu
 * olan büyük, orta ve küçük havalimanları. Heliport, deniz uçağı üssü ve kapalı alan yoktur.
 * Tablo zaten içe aktarım süzgecinden geçmiştir (büyük, orta ya da tarifeli sefer alan alanlar;
 * data-sources.md §3); liste kuralı bu koşulu ayrıca uygular (`isListableRow`).
 *
 * Listelenen havalimanları (D-080, `listListedAirports`): Türkiye'nin IATA kodlu havalimanları
 * (askerî hava üsleri hariç, D-107) ve açık halkalardaki yurt dışı adayları. Halka, Türkiye'deki en
 * yakın IATA kodlu havalimanına büyük daire uzaklığından hesaplanır. Halka sınırları ve açık halka
 * `@havayolu/shared`'dadır (`AIRPORT_RING_CONFIG`); bu paket shared'a bağımlı olmadığı için ayar
 * çağırandan gelir.
 */
export const LISTED_AIRPORT_TYPES = ['large_airport', 'medium_airport', 'small_airport'] as const
export type ListedAirportType = (typeof LISTED_AIRPORT_TYPES)[number]

/** Türkiye'nin ISO 3166-1 alpha-2 kodu; Türkiye havalimanları halka 0'dır. */
export const TURKEY_COUNTRY_CODE = 'TR'

/**
 * Halka ayarı (`@havayolu/shared` `AIRPORT_RING_CONFIG`): sınırlar (km, artan; son sınırın ötesi
 * son halka) ve listeye giren en uzak halka.
 */
export interface AirportRingConfig {
  ringsKm: readonly number[]
  enabledRing: number
}

/** Bir havalimanı; `@havayolu/shared` `Airport` ile aynı biçimdedir. */
export interface ListedAirport {
  /** ICAO kodu, yoksa GPS kodu, o da yoksa OurAirports kimliği (ident); `ourAirportsIcao`. */
  icao: string
  iata: string
  name: string
  city: string | null
  lat: number
  lon: number
  elevationFt: number | null
  type: ListedAirportType
  scheduled: boolean
  /** ISO 3166-1 alpha-2 ülke kodu (kırpılmış, büyük harf). */
  country: string
  /** Türkiye'de 0; yurt dışında uzaklığın halkası (1 … sınır sayısı + 1). */
  ring: number
  /** Türkiye'deki en yakın IATA kodlu havalimanına uzaklık, km (tam sayı); Türkiye'de null. */
  distanceToTrKm: number | null
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
  isoCountry: string
  municipality: string | null
  scheduledService: boolean
  icaoCode: string | null
  iataCode: string | null
  gpsCode: string | null
}

/** Konum, derece. */
export interface GeoPoint {
  lat: number
  lon: number
}

/**
 * Türkiye'deki en yakın IATA kodlu havalimanı (D-080): yurt dışı kaydının uzaklığı ona ölçülür.
 * Listelenmeyen küçük alan da olabilir (Gökçeada gibi); `@havayolu/shared` `NearestTurkishAirport`.
 */
export interface NearestTurkishAirportRecord {
  /** ICAO kodu; yoksa GPS kodu, o da yoksa ident (listedeki kural). */
  icao: string
  /** IATA kodu (büyük harf). */
  iata: string
  /** OurAirports adı. */
  name: string
}

/** Türkiye'deki uzaklık referansı: konum ve kimlik. */
export interface TurkishReference extends GeoPoint, NearestTurkishAirportRecord {}

/** Halka hesabının girdileri: Türkiye'deki uzaklık referansları ve halka sınırları. */
export interface RingContext {
  /** Türkiye'deki IATA kodlu havalimanları (`turkishReferencePoints`). */
  turkey: readonly TurkishReference[]
  ringsKm: readonly number[]
}

/** Listelenen havalimanları seçiminin girdileri: halka hesabı ve açık halka. */
export interface ListingContext extends RingContext {
  enabledRing: number
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
 * OurAirports'ta yanlış olduğu bilinen ICAO kodları (D-088): satırın `ident`'i → kaynaktaki yanlış
 * `icao_code` ve uygulamanın kullandığı kod. Satır veritabanında kaynaktaki gibi kalır; düzeltme
 * okurken ve yalnız yanlış değer durdukça uygulanır (OurAirports düzeltirse ya da değiştirirse
 * kendiliğinden devre dışı kalır). `@havayolu/shared` `OURAIRPORTS_ICAO_CORRECTIONS` ile aynıdır
 * (db shared'a bağımlı değildir; `apps/api/src/reference/rings.test.ts` iki yazımı denetler).
 * - HEBA, İskenderiye (Borg El Arab, HBE): `icao_code` ve `gps_code` HEAX; HEAX, 2011'de kapanan El
 *   Nouzha'nın koduydu. HEAX kalsaydı METAR/TAF HEAX diye istenir, hava durumu hiç gelmezdi.
 */
export const OURAIRPORTS_ICAO_CORRECTIONS: Readonly<
  Record<string, { readonly icaoCode: string; readonly icao: string }>
> = {
  HEBA: { icaoCode: 'HEAX', icao: 'HEBA' },
}

/**
 * Askerî hava alanları, kanonik ICAO sırasıyla: Türkiye'nin beş askerî hava üssü (D-107; D-084:
 * İncirlik, Afyon, Bandırma, Eskişehir, Çiğli) ve yurt dışında adı yalnız askerî olan üç alan (5.
 * halka, D-109: Kwajalein Bucholz PKWA, Wake Adası PWAK, Oakey YBOK). Sitenin hiçbir yerinde
 * yoktur: listelenmez (`scope=listed`, ülke listeleri, tek havalimanı ve hava durumu uçları;
 * sayfaları, haritası ve worker'ın hava durumu istasyonları bu listeyi kullanır) ve Türkiye'deki
 * uzaklık referansı da sayılmaz (yabancı havalimanının "Türkiye'deki en yakın havalimanı" hiçbir
 * zaman üs değildir; halka üyeliği değişmez). Satırları ve pistleri veritabanında kalır: içe aktarım
 * süzgeci (`isImportedAirport`) değişmedi, süzme okurken yapılır.
 * `@havayolu/shared` `MILITARY_AIRFIELD_ICAOS` ile aynıdır (db shared'a bağımlı değildir;
 * `apps/api/src/reference/rings.test.ts` iki yazımı denetler).
 */
export const MILITARY_AIRFIELD_ICAOS: readonly string[] = [
  'LTAG',
  'LTAH',
  'LTBG',
  'LTBI',
  'LTBL',
  'PKWA',
  'PWAK',
  'YBOK',
]

const MILITARY_AIRFIELDS: ReadonlySet<string> = new Set(MILITARY_AIRFIELD_ICAOS)

/** Kanonik ICAO'su askerî hava üssü olan satır (D-107); `ourAirportsIcao` ile denetlenir. */
const isMilitaryAirfieldRow = (row: Pick<AirportSourceRow, 'ident' | 'icaoCode' | 'gpsCode'>) =>
  MILITARY_AIRFIELDS.has(ourAirportsIcao(row))

/**
 * Satırın kanonik ICAO'su (listedeki kimlik): düzeltme varsa ve kaynaktaki yanlış değer duruyorsa
 * düzeltilmiş kod; yoksa `icao_code`, `gps_code`, `ident` (ilk boş olmayan), kırpılmış, büyük harf.
 */
export function ourAirportsIcao(
  row: Pick<AirportSourceRow, 'ident' | 'icaoCode' | 'gpsCode'>,
): string {
  const ident = row.ident.trim().toUpperCase()
  const icaoCode = present(row.icaoCode)?.toUpperCase() ?? null
  const correction = Object.hasOwn(OURAIRPORTS_ICAO_CORRECTIONS, ident)
    ? OURAIRPORTS_ICAO_CORRECTIONS[ident]
    : undefined
  if (correction !== undefined && icaoCode === correction.icaoCode) return correction.icao
  return (icaoCode ?? present(row.gpsCode) ?? ident).toUpperCase()
}

/**
 * Adres takma adı olamayacak kimlikler (D-109): OurAirports'ta başka bir satırın kanonik ICAO'su
 * olan, ama o satır içe aktarılmadığı için veritabanında bulunmayan kodlar. 2026-10-01 indirmesinin
 * tam dosyasında (her türden satır) tek örnek: WABP, Timika'nın (WAYY) eski kimliği ve Burumeso
 * pistinin (ID-0394; küçük, tarifesiz, içe aktarılmaz) ICAO'su. Böyle bir kod hiçbir havalimanına
 * yönlenmez.
 */
export const IDENT_ALIAS_EXCLUSIONS: readonly string[] = ['WABP']

/** Adres takma adı biçimi: dört harf ya da rakam (kanonik ICAO'nun biçimi). */
const IDENT_ALIAS = /^[A-Z0-9]{4}$/

/**
 * Satırın OurAirports kimliği (ident) havalimanının adres takma adı mı (D-109): kimlik dört harf ya
 * da rakam, kanonik ICAO'dan (`ourAirportsIcao`) farklı, eldeki satırlardan hiçbirinin kanonik
 * ICAO'su değil (`knownIcaos`) ve `IDENT_ALIAS_EXCLUSIONS`'ta yok. Kodu değişen havalimanlarının
 * eski kodudur (Özbekistan UTSS → UZSS, Lima SPIM → SPJC, Palm Beach KPBI → KDJT); OurAirports
 * kimliği eski kodda bırakır. Tek havalimanı ucu kodu bununla da bulur (`findAirportDetail`), web
 * `/istasyon/<takma ad>`'ı kanonik adrese 308 ile yönlendirir. Takma ad yoksa null.
 */
export function identAlias(
  row: Pick<AirportSourceRow, 'ident' | 'icaoCode' | 'gpsCode'>,
  knownIcaos: ReadonlySet<string>,
): string | null {
  const ident = row.ident.trim().toUpperCase()
  if (!IDENT_ALIAS.test(ident) || ident === ourAirportsIcao(row)) return null
  if (knownIcaos.has(ident) || IDENT_ALIAS_EXCLUSIONS.includes(ident)) return null
  return ident
}

/** Satırların kanonik ICAO'ları (takma ad çakışması denetimi, `identAlias`). */
const canonicalIcaos = (
  rows: readonly Pick<AirportSourceRow, 'ident' | 'icaoCode' | 'gpsCode'>[],
) => new Set(rows.map(ourAirportsIcao))

/**
 * Görünen ad: kırpılmış, art arda boşluklar teke inmiş (D-088; Bacău'nun OurAirports adında
 * "International  Airport"). Yoksa İngilizce sayfa, aynı görünen iki adı farklı sayıp
 * "OurAirports'taki adı" satırını gereksiz yere yazardı. Tek başına duran küçük harfli "airport"
 * "Airport" yapılır (D-090; 3. halkada dokuz Fransız havalimanı: "Bastia-Poretta International
 * airport", "Aurillac airport"); küçük harfli ad İngilizce başlıkta özensiz görünürdü. Yalnız boşluk
 * ve bu tek sözcüğün büyük harfi değişir ("Airportville", "Sea-Airport" gibi sözcüklere dokunulmaz).
 * Web'in test yardımcısı (`apps/web/src/lib/test/ourairports-fixture.ts`) aynı kuralı yazar.
 */
export const cleanAirportName = (name: string): string =>
  name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bairport\b/g, 'Airport')

const countryOf = (row: Pick<AirportSourceRow, 'isoCountry'>) => row.isoCountry.trim().toUpperCase()

const isTurkishRow = (row: Pick<AirportSourceRow, 'isoCountry'>) =>
  countryOf(row) === TURKEY_COUNTRY_CODE

/** Büyük daire (haversine) uzaklığı, km; `@havayolu/geo` `distanceKm` ile aynı yarıçap. */
export function greatCircleKm(a: GeoPoint, b: GeoPoint): number {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** En yakın referans ve uzaklığı, km; referans yoksa null. Eşitlikte önce gelen kalır. */
export function nearestReference<T extends GeoPoint>(
  point: GeoPoint,
  references: readonly T[],
): { reference: T; km: number } | null {
  let best: { reference: T; km: number } | null = null
  for (const reference of references) {
    const km = greatCircleKm(point, reference)
    if (best === null || km < best.km) best = { reference, km }
  }
  return best
}

/** En yakın referansa uzaklık, km; referans yoksa sonsuz. */
export function nearestDistanceKm(point: GeoPoint, references: readonly GeoPoint[]): number {
  return nearestReference(point, references)?.km ?? Number.POSITIVE_INFINITY
}

/**
 * Uzaklığın halkası: sınırı aşmayan ilk sınırın sırası (1'den), hiçbirine sığmıyorsa sınır sayısı
 * + 1. `@havayolu/shared` `airportRing` ile aynı kural (sınır dahil).
 */
export function ringForDistance(distanceKm: number, ringsKm: readonly number[]): number {
  const index = ringsKm.findIndex((limit) => distanceKm <= limit)
  return index === -1 ? ringsKm.length + 1 : index + 1
}

/**
 * Liste kuralı, satır başına: IATA kodu üç harf, tür büyük/orta/küçük ve içe aktarım süzgeciyle
 * aynı koşul (büyük ya da orta havalimanı, ya da tarifeli). Son koşul bugün tablodaki her satırda
 * zaten doğrudur; içe aktarım uzaklık referansı için başka satırlar da alsa (ör. Türkiye'nin IATA
 * kodlu küçük alanları) liste değişmez.
 */
function isListableRow(row: AirportSourceRow, iata: string): boolean {
  return (
    IATA_CODE.test(iata) &&
    isListedType(row.type) &&
    (row.type === 'large_airport' || row.type === 'medium_airport' || row.scheduledService)
  )
}

/** Kanonik ICAO kodu dört harf ya da rakamdır (`@havayolu/shared` `isCanonicalIcao`). */
const CANONICAL_ICAO = /^[A-Z0-9]{4}$/

/**
 * Yurt dışı adayı (`@havayolu/shared` `isForeignCandidate`; D-080, D-101): büyük ya da orta
 * havalimanı, tarifeli, üç harfli IATA kodu (IATA denetimi `listedEntries`'tedir) ve kanonik
 * ICAO'su (`ourAirportsIcao`) dört karakter. `icao_code` ve `gps_code` taşımayan satırın kimliği
 * ident'tir ("UG-0002", Kihihi KHX); sayfası ve hava durumu istasyonu olamayacağı için listeye
 * girmez. Ülke listeleri (`listAirportsWithIata`) bu koşulu uygulamaz.
 */
const isForeignCandidateRow = (row: AirportSourceRow) =>
  (row.type === 'large_airport' || row.type === 'medium_airport') &&
  row.scheduledService &&
  CANONICAL_ICAO.test(ourAirportsIcao(row))

/** Türkiye referansının satırdaki alanları. */
type ReferenceSourceRow = Pick<
  AirportSourceRow,
  | 'ident'
  | 'name'
  | 'isoCountry'
  | 'type'
  | 'icaoCode'
  | 'iataCode'
  | 'gpsCode'
  | 'latitudeDeg'
  | 'longitudeDeg'
>

/**
 * Türkiye'deki uzaklık referansları, satırlardan: IATA kodu üç harf olan büyük, orta ve küçük
 * havalimanları (halka analizinin kuralı: "Türkiye'deki IATA kodlu en yakın havalimanı"; tarifeli
 * olma şartı yoktur, listelenmeyen küçük alanlar da referanstır; içe aktarım onları bunun için alır,
 * data-sources.md §3). Yurt dışı satırları ve askerî hava üsleri (D-107) atlanır. Kimlik listedeki
 * kuralla kurulur (ICAO, yoksa GPS kodu, o da yoksa ident).
 */
export function turkishReferencePoints(rows: readonly ReferenceSourceRow[]): TurkishReference[] {
  const references: TurkishReference[] = []
  for (const row of rows) {
    const iata = present(row.iataCode)?.toUpperCase() ?? ''
    if (!isTurkishRow(row) || !isListedType(row.type) || !IATA_CODE.test(iata)) continue
    if (isMilitaryAirfieldRow(row)) continue
    references.push({
      lat: row.latitudeDeg,
      lon: row.longitudeDeg,
      icao: ourAirportsIcao(row),
      iata,
      name: cleanAirportName(row.name),
    })
  }
  return references
}

/** Satırın ülke, halka ve uzaklık alanları ile Türkiye'deki en yakın IATA kodlu havalimanı. */
function ringFields(
  row: AirportSourceRow,
  context: RingContext,
): {
  fields: Pick<ListedAirport, 'country' | 'ring' | 'distanceToTrKm'>
  nearestTr: NearestTurkishAirportRecord | null
} {
  const country = countryOf(row)
  if (country === TURKEY_COUNTRY_CODE) {
    return { fields: { country, ring: 0, distanceToTrKm: null }, nearestTr: null }
  }
  const nearest = nearestReference({ lat: row.latitudeDeg, lon: row.longitudeDeg }, context.turkey)
  const distance = nearest?.km ?? Number.POSITIVE_INFINITY
  return {
    fields: {
      country,
      // Halka yuvarlanmamış uzaklıktan hesaplanır (halka analiziyle aynı); yanıtta tam km yazılır.
      ring: ringForDistance(distance, context.ringsKm),
      distanceToTrKm: Number.isFinite(distance) ? Math.round(distance) : null,
    },
    nearestTr:
      nearest === null
        ? null
        : {
            icao: nearest.reference.icao,
            iata: nearest.reference.iata,
            name: nearest.reference.name,
          },
  }
}

/** Listeye giren satır, ondan üretilen kayıt ve Türkiye'deki en yakın havalimanı. */
interface ListedEntry<R extends AirportSourceRow> {
  row: R
  airport: ListedAirport
  nearestTr: NearestTurkishAirportRecord | null
}

/**
 * `toListedAirports` kuralı; satırı da taşır (ayrıntı sorguları kimliğe ihtiyaç duyar). Bütün liste
 * ve ayrıntı okumaları buradan geçer; askerî hava üsleri (D-107) burada çıkar.
 */
function listedEntries<R extends AirportSourceRow>(
  rows: readonly R[],
  context: RingContext,
): ListedEntry<R>[] {
  const byIcao = new Map<string, ListedEntry<R>>()
  for (const row of rows) {
    const iata = present(row.iataCode)?.toUpperCase() ?? ''
    if (!isListableRow(row, iata) || !isListedType(row.type)) continue
    const icao = ourAirportsIcao(row)
    if (icao === '' || byIcao.has(icao) || MILITARY_AIRFIELDS.has(icao)) continue
    const { fields, nearestTr } = ringFields(row, context)
    byIcao.set(icao, {
      row,
      nearestTr,
      airport: {
        icao,
        iata,
        name: cleanAirportName(row.name),
        city: present(row.municipality),
        lat: row.latitudeDeg,
        lon: row.longitudeDeg,
        elevationFt: row.elevationFt,
        type: row.type,
        scheduled: row.scheduledService,
        ...fields,
      },
    })
  }
  return [...byIcao.values()].sort(
    (a, b) => byCode(a.airport.iata, b.airport.iata) || byCode(a.airport.icao, b.airport.icao),
  )
}

/**
 * Saf kısım: ham satırlardan liste. IATA kodu kırpılıp büyük harfe çevrilir; üç harf değilse, tür
 * listede yoksa ya da satır içe aktarım koşulunu (büyük, orta ya da tarifeli) taşımıyorsa atlanır.
 * ICAO = `icao_code`, yoksa `gps_code`, o da yoksa `ident` (kaynak düzeltmeleriyle,
 * `ourAirportsIcao`); askerî hava üsleri (`MILITARY_AIRFIELD_ICAOS`, D-107) atlanır; adın
 * boşlukları teke indirilir (`cleanAirportName`). Aynı ICAO'ya düşen
 * satırlardan önce gelen (satırlar kimlik sırasıyla verilir, en küçük kimlik) kalır. Sonuç IATA'ya,
 * eşitse ICAO'ya göre sıralıdır. Her kayıt ülke, halka ve Türkiye'ye uzaklık taşır (`context`).
 */
export function toListedAirports(
  rows: readonly AirportSourceRow[],
  context: RingContext,
): ListedAirport[] {
  return listedEntries(rows, context).map((entry) => entry.airport)
}

/** Listelenen havalimanları seçimi; satırı da taşır. */
function listedSelection<R extends AirportSourceRow>(
  rows: readonly R[],
  context: ListingContext,
): ListedEntry<R>[] {
  const eligible = rows.filter((row) => isTurkishRow(row) || isForeignCandidateRow(row))
  return listedEntries(eligible, context).filter(
    (entry) => entry.airport.ring <= context.enabledRing,
  )
}

/**
 * Kanonik ICAO çakışmaları (D-109, içe aktarım kayması): liste kuralına giren satırlardan (Türkiye
 * satırları ve yurt dışı adayları; üç harfli IATA, liste türü, askerî alan değil) aynı kanonik
 * ICAO'yu taşıyanlar. `listedEntries` en küçük kimlikli satırı tutar, öbürünü sessizce atar; bu
 * işlev atılanların ICAO'larını sırasıyla verir (2026-10-01 indirmesinde hiç yok).
 */
export function canonicalIcaoCollisions(rows: readonly AirportSourceRow[]): string[] {
  const seen = new Set<string>()
  const collisions: string[] = []
  for (const row of byId(rows)) {
    if (!isTurkishRow(row) && !isForeignCandidateRow(row)) continue
    const iata = present(row.iataCode)?.toUpperCase() ?? ''
    if (!isListableRow(row, iata)) continue
    const icao = ourAirportsIcao(row)
    if (icao === '' || MILITARY_AIRFIELDS.has(icao)) continue
    if (seen.has(icao)) collisions.push(icao)
    else seen.add(icao)
  }
  return collisions
}

/**
 * Saf kısım: listelenen havalimanları (D-080). Türkiye satırları liste kuralıyla
 * (`toListedAirports`); yurt dışı satırları aday kuralıyla (büyük ya da orta, tarifeli, üç harfli
 * IATA, dört karakterli kanonik ICAO; D-101) ve halkası `enabledRing`'i aşmıyorsa. Satırlar kimlik
 * sırasıyla verilir; sonuç `toListedAirports` sırasıyladır.
 */
export function selectListedAirports(
  rows: readonly AirportSourceRow[],
  context: ListingContext,
): ListedAirport[] {
  return listedSelection(rows, context).map((entry) => entry.airport)
}

const listedAirportColumns = {
  id: airports.id,
  ident: airports.ident,
  type: airports.type,
  name: airports.name,
  latitudeDeg: airports.latitudeDeg,
  longitudeDeg: airports.longitudeDeg,
  elevationFt: airports.elevationFt,
  isoCountry: airports.isoCountry,
  municipality: airports.municipality,
  scheduledService: airports.scheduledService,
  icaoCode: airports.icaoCode,
  iataCode: airports.iataCode,
  gpsCode: airports.gpsCode,
}

/**
 * Listeye girebilecek satırlar: IATA kodu olan büyük, orta ve küçük havalimanları, içe aktarım
 * koşuluyla (büyük, orta ya da tarifeli). Biçim denetimi `listedEntries`'tedir.
 */
const listedFilter = (...conditions: SQL[]): SQL =>
  and(
    inArray(airports.type, [...LISTED_AIRPORT_TYPES]),
    isNotNull(airports.iataCode),
    or(
      inArray(airports.type, ['large_airport', 'medium_airport']),
      eq(airports.scheduledService, true),
    ),
    ...conditions,
  ) as SQL

/**
 * Yurt dışı adayları (SQL ön süzgeci): `isForeignCandidateRow`'un koşulları; kanonik ICAO'nun
 * biçimi bellekte denetlenir.
 */
const foreignCandidateFilter = (): SQL =>
  and(
    ne(airports.isoCountry, TURKEY_COUNTRY_CODE),
    inArray(airports.type, ['large_airport', 'medium_airport']),
    eq(airports.scheduledService, true),
    isNotNull(airports.iataCode),
  ) as SQL

/**
 * Türkiye'deki uzaklık referansları, veritabanından (IATA kodlu büyük, orta ve küçük alanlar),
 * kimlik sırasıyla (eşit uzaklıkta sonuç kararlıdır).
 */
async function readTurkishReferencePoints(db: PostgresJsDatabase): Promise<TurkishReference[]> {
  const rows = await db
    .select({
      ident: airports.ident,
      name: airports.name,
      isoCountry: airports.isoCountry,
      type: airports.type,
      icaoCode: airports.icaoCode,
      iataCode: airports.iataCode,
      gpsCode: airports.gpsCode,
      latitudeDeg: airports.latitudeDeg,
      longitudeDeg: airports.longitudeDeg,
    })
    .from(airports)
    .where(
      and(
        eq(airports.isoCountry, TURKEY_COUNTRY_CODE),
        inArray(airports.type, [...LISTED_AIRPORT_TYPES]),
        isNotNull(airports.iataCode),
      ),
    )
    .orderBy(asc(airports.id))
  return turkishReferencePoints(rows)
}

const byId = <R extends { id: number }>(rows: readonly R[]): R[] =>
  [...rows].sort((a, b) => a.id - b.id)

/**
 * Listelenen havalimanlarının aday satırları (Türkiye satırları + yurt dışı adayları, kimlik
 * sırasıyla) ve uzaklık referansları. Yurt dışı adayları dünya genelindedir (~3.200 satır); halka
 * süzgeci uzaklıkla bellekte uygulanır.
 */
async function readListedRows<R extends AirportSourceRow>(
  db: PostgresJsDatabase,
  query: (where: SQL) => Promise<R[]>,
): Promise<{ rows: R[]; turkey: TurkishReference[] }> {
  const [turkish, foreign, turkey] = await Promise.all([
    query(listedFilter(eq(airports.isoCountry, TURKEY_COUNTRY_CODE))),
    query(foreignCandidateFilter()),
    readTurkishReferencePoints(db),
  ])
  return { rows: byId([...turkish, ...foreign]), turkey }
}

/**
 * Bir ülkenin IATA kodlu havalimanları (`country`: ISO 3166-1 alpha-2, büyük harf; ör. TR),
 * askerî hava üsleri hariç (D-107). Türkiye'de ~56 kayıttır; süzme SQL'de, biçim denetimi ve
 * sıralama `toListedAirports`'tadır. Yurt dışı kayıtlar halkasını ve Türkiye'ye uzaklığını taşır
 * (`rings.ringsKm`).
 */
export async function listAirportsWithIata(
  db: PostgresJsDatabase,
  country: string,
  rings: Pick<AirportRingConfig, 'ringsKm'>,
): Promise<ListedAirport[]> {
  const [rows, turkey] = await Promise.all([
    db
      .select(listedAirportColumns)
      .from(airports)
      .where(listedFilter(eq(airports.isoCountry, country)))
      .orderBy(asc(airports.id)),
    readTurkishReferencePoints(db),
  ])
  return toListedAirports(rows, { turkey, ringsKm: rings.ringsKm })
}

/**
 * Listelenen havalimanları (D-080; `GET /v1/airports?scope=listed`, worker'ın hava durumu
 * istasyonları): Türkiye'nin IATA kodlu havalimanları (askerî hava üsleri hariç, D-107) ve halkası
 * `rings.enabledRing`'i aşmayan yurt dışı adayları, IATA sırasıyla. Satırlar her çağrıda okunur;
 * önbellek çağıranındır (API 10 dk).
 */
export async function listListedAirports(
  db: PostgresJsDatabase,
  rings: AirportRingConfig,
): Promise<ListedAirport[]> {
  const { rows, turkey } = await readListedRows(db, async (where) =>
    db.select(listedAirportColumns).from(airports).where(where).orderBy(asc(airports.id)),
  )
  return selectListedAirports(rows, {
    turkey,
    ringsKm: rings.ringsKm,
    enabledRing: rings.enabledRing,
  })
}

// Havalimanı sayfaları (M6b): `@havayolu/shared` `AirportDetail` ile aynı biçim. Bu paket
// shared'a bağımlı değildir; API tipleri shared'dan alır, iki biçim testlerle eşit tutulur.

/** Pistin bir ucu; yön ve eşik yöneticinin düzeltmesiyle (`runway_overrides`) birleştirilmiştir. */
export interface RunwayEndRecord {
  /** Pist adı (16L); kaynakta yoksa boş metin. */
  ident: string
  /** Gerçek yön, derece: `true_bearing_deg` (koordinatlardan), `heading_degT` değil (D-066). */
  trueBearingDeg: number | null
  displacedThresholdFt: number | null
  thresholdLat: number | null
  thresholdLon: number | null
}

export interface RunwayDetailRecord {
  id: number
  lengthFt: number | null
  widthFt: number | null
  /** Ham kaplama kodu (ASP, CON, PEM …). */
  surface: string | null
  lighted: boolean
  ends: [RunwayEndRecord, RunwayEndRecord]
}

export interface AirportStationRecord {
  active: boolean
  primary: boolean
  fetchRadiusNm: number
}

export interface AirportDetailRecord extends ListedAirport {
  /**
   * Türkiye'deki en yakın IATA kodlu havalimanı (`distanceToTrKm` ona ölçülür; D-080); Türkiye'de
   * ve veritabanında Türkiye havalimanı yokken null.
   */
  nearestTr: NearestTurkishAirportRecord | null
  /** ISO 3166-2 bölge kodu (TR-34). */
  isoRegion: string
  /** OurAirports `municipality` (kırpılmış; `city` ile aynı). */
  municipality: string | null
  /**
   * Adres takma adı (D-109; `identAlias`): OurAirports kimliği kanonik ICAO'dan farklı dört
   * karakterli bir koddaysa o kod (Özbekistan'ın UTSS'i → UZSS); yoksa alan yazılmaz.
   */
  identAlias?: string
  station: AirportStationRecord | null
  /** Havalimanı, pistleri ve pist düzeltmelerinin en yeni `updated_at` değeri (ISO 8601). */
  dataUpdatedAt: string
  /** Açık pistler, pist adına (sayısal sırayla), eşitse kimliğe göre. */
  runways: RunwayDetailRecord[]
}

/** Ayrıntı için okunan havalimanı satırı. */
export interface AirportDetailSourceRow extends AirportSourceRow {
  isoRegion: string
  updatedAt: Date
}

/** Pist satırı; `le*`/`he*` yön ve eşik alanları düzeltmeyle alan alan birleştirilmiştir (COALESCE). */
export interface RunwaySourceRow {
  id: number
  airportId: number
  lengthFt: number | null
  widthFt: number | null
  surface: string | null
  lighted: boolean
  leIdent: string | null
  leTrueBearingDeg: number | null
  leDisplacedThresholdFt: number | null
  leThresholdLat: number | null
  leThresholdLon: number | null
  heIdent: string | null
  heTrueBearingDeg: number | null
  heDisplacedThresholdFt: number | null
  heThresholdLat: number | null
  heThresholdLon: number | null
  /**
   * Kaynaktaki uç koordinatlarının enlemi (OurAirports `le_latitude_deg`, `he_latitude_deg`); yoksa
   * null. Yalnız boş satır kuralı okur (`visibleRunways`): uç koordinatı olmayan pistin eşiği içe
   * aktarımda havalimanı merkezine (ARP) düşer, eşik ölçüt olamaz.
   */
  leLatitudeDeg: number | null
  heLatitudeDeg: number | null
  updatedAt: Date
  /** Düzeltme yoksa null. */
  overrideUpdatedAt: Date | null
}

export interface StationSourceRow {
  icao: string
  isActive: boolean
  isPrimary: boolean
  fetchRadiusNm: number
}

/**
 * Bundan kısa kayıtlı uzunluk pist değildir, ft (D-101, genel kural). Pamplona'nın (LEPP) 260341
 * "03/21" satırı 2 ft uzunluğunda, genişliği ve uç koordinatı yok, kaplaması UNK; gösterilseydi
 * havalimanı iki pist sayardı (kayıtlı pist 15/33, 2.207 m). Fixture'da bu sınırın altında kalan
 * öbür satırlar zaten tek uçlu helikopter alanlarıdır (Stuttgart H-NORTH ve H-SOUTH 98 ft);
 * Bovanenkovo'nun 722 ft'lik şeridi gibi kısa ama iki uçlu satırlar değişmez.
 */
export const MIN_RUNWAY_LENGTH_FT = 100

/**
 * OurAirports düzenleyicisinin silme işareti (D-109): kaplama alanı "DELETE" ile başlayan satır
 * (büyük-küçük harf fark etmez). 2026-10-01 indirmesinin bütün içe aktarımında yalnız Hamilton'ın
 * (NZHN) iki satırı: 238057 "Delete duplicate" (uzunluğu, genişliği ve uç koordinatları var; gerçek
 * 07/25'in yinelenmiş 07R/25L kopyası) ve 260389 "Delete" (boş).
 */
export const RUNWAY_TOMBSTONE_SURFACE = /^\s*delete/i

/**
 * Pist satırı tek başına gizlenir mi (satırın kendi alanlarıyla; havalimanının öbür satırlarına
 * bakan boş satır kuralı `visibleRunways`'tedir):
 * - karşı ucu yok (`he_ident` boş; D-090, genel kural). Pistin iki ucu vardır; tek uçlu satır
 *   helikopter iniş alanıdır: Stuttgart'ın (EDDS) "H-NORTH" ve "H-SOUTH" satırları (30 × 30 m)
 *   gösterilseydi sayfa ve pencere üç pist sayardı. Langzhong'un (ZULA) adsız 11.811 ft'lik satırı
 *   da bu kuralla gizli kalır (D-090; havalimanı pistsiz görünür, 4. halkanın ZWTK'si gibi); ya da
 * - kayıtlı uzunluğu `MIN_RUNWAY_LENGTH_FT`'ten kısa (D-101, genel kural; uzunluğu bilinmeyen satır
 *   bu kuralla gizlenmez); ya da
 * - kaplaması düzenleyicinin silme işareti (`RUNWAY_TOMBSTONE_SURFACE`, D-109; dolu satırda da).
 *
 * Uçları kayıtlı uzunluğa göre çok uzak satır (D-101, Amravati) gizlenmez: içe aktarım uç
 * koordinatlarını yön ve eşik için kullanmaz (`@havayolu/providers` `endsAreTooFarApart`), pist
 * sayfada sayılır. Web'in test yardımcısı (`apps/web/src/lib/test/ourairports-fixture.ts`) aynı
 * kuralları yazar; `airports.test.ts` iki yazımı karşılaştırır.
 */
export function isHiddenRunway(
  row: Pick<RunwaySourceRow, 'lengthFt' | 'heIdent' | 'surface'>,
): boolean {
  if (present(row.heIdent) === null) return true
  if (row.lengthFt !== null && row.lengthFt < MIN_RUNWAY_LENGTH_FT) return true
  return RUNWAY_TOMBSTONE_SURFACE.test(row.surface ?? '')
}

/** Boş pist satırının alanları (`isEmptyRunway`, `visibleRunways`). */
export type RunwayVisibilityRow = Pick<
  RunwaySourceRow,
  | 'id'
  | 'airportId'
  | 'lengthFt'
  | 'widthFt'
  | 'surface'
  | 'heIdent'
  | 'leLatitudeDeg'
  | 'heLatitudeDeg'
>

/** Satır boş mu: uzunluğu, genişliği ve iki ucunun da koordinatı yok (D-088, D-109). */
export const isEmptyRunway = (
  row: Pick<RunwaySourceRow, 'lengthFt' | 'widthFt' | 'leLatitudeDeg' | 'heLatitudeDeg'>,
): boolean =>
  row.lengthFt === null &&
  row.widthFt === null &&
  row.leLatitudeDeg === null &&
  row.heLatitudeDeg === null

/**
 * Gösterilen pist satırları, sıra korunarak (D-088, D-090, D-101, D-109). Satırlar bir ya da birçok
 * havalimanından olabilir; kurallar havalimanı başına uygulanır:
 * - `isHiddenRunway`'in satır kuralları (karşı ucu yok, 100 ft'ten kısa, silme işareti), ve
 * - boş yinelenen satır (D-109, genel kural; D-088'den beri kimlik tablosuydu): boş satır
 *   (`isEmptyRunway`) aynı havalimanında satır kurallarıyla gizlenmeyen ve uzunluğu bilinen başka
 *   bir satır varken gösterilmez. Gösterilse sayfa ve pencere havalimanında bir pist fazla sayardı.
 *   Satır veritabanında kalır; yalnız boş kaldıkça gizlenir, OurAirports satırı doldurursa (uzunluk,
 *   genişlik ya da uç koordinatı) yeniden görünür. Havalimanının tek bilgisi boş satırsa satır
 *   gösterilir (pist var, ölçüsü bilinmiyor).
 *
 * 2026-10-01 indirmesinde boş satır kuralı 1.–4. halkada tam olarak eski tablonun yedi satırını
 * (260339 Taba, 260408 Cluj, 504922 Linz, 608245 Voronej; 4. halkada 260338 Hassi Messaoud, 260344
 * Beauvais, 260310 Bujumbura) ve 5. halkada 13 satırı gizler (NZGS, NZHN 260389, NZKK, NZRO, NZWK,
 * RCKU, RJNO, SKAS, SKBS, SKMZ, SKRH, SKSV, WAJO); bütün içe aktarımda 32 satır.
 */
export function visibleRunways<R extends RunwayVisibilityRow>(rows: readonly R[]): R[] {
  const shown = rows.filter((row) => !isHiddenRunway(row))
  // Uzunluğu bilinen gösterilen satırı olan havalimanları (boş satırın uzunluğu yoktur: "başka").
  const measured = new Set<number>()
  for (const row of shown) if (row.lengthFt !== null) measured.add(row.airportId)
  return shown.filter((row) => !(isEmptyRunway(row) && measured.has(row.airportId)))
}

/** Sayısal sütun (sürücü `real`/`double` değerini sayı verir; ifade sonuçları için güvence). */
const numeric = (value: number | string | null): number | null =>
  value === null ? null : Number(value)

/** Pist adları sayısal sıralanır: 9 < 16L < 16R (metin sırasında 16L, 9'dan önce gelirdi). */
const identCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

const byRunwayIdent = (a: RunwaySourceRow, b: RunwaySourceRow) => {
  const left = present(a.leIdent)
  const right = present(b.leIdent)
  if (left === null || right === null) {
    if (left !== right) return left === null ? 1 : -1
  } else {
    const order = identCollator.compare(left, right)
    if (order !== 0) return order
  }
  return a.id - b.id
}

function runwayDetail(row: RunwaySourceRow): RunwayDetailRecord {
  return {
    id: row.id,
    lengthFt: row.lengthFt,
    widthFt: row.widthFt,
    surface: present(row.surface),
    lighted: row.lighted,
    ends: [
      {
        ident: present(row.leIdent) ?? '',
        trueBearingDeg: numeric(row.leTrueBearingDeg),
        displacedThresholdFt: row.leDisplacedThresholdFt,
        thresholdLat: numeric(row.leThresholdLat),
        thresholdLon: numeric(row.leThresholdLon),
      },
      {
        ident: present(row.heIdent) ?? '',
        trueBearingDeg: numeric(row.heTrueBearingDeg),
        displacedThresholdFt: row.heDisplacedThresholdFt,
        thresholdLat: numeric(row.heThresholdLat),
        thresholdLon: numeric(row.heThresholdLon),
      },
    ],
  }
}

/**
 * Saf kısım: liste kuralıyla (`toListedAirports`) seçilen havalimanlarına pistleri, istasyon
 * ayarlarını ve veri tarihini ekler. Sıra listeyle aynıdır (IATA, eşitse ICAO). Halka ve uzaklık
 * `context`'ten hesaplanır.
 */
export function toAirportDetails(
  airportRows: readonly AirportDetailSourceRow[],
  runwayRows: readonly RunwaySourceRow[],
  stationRows: readonly StationSourceRow[],
  context: RingContext,
): AirportDetailRecord[] {
  return detailRecords(
    listedEntries(airportRows, context),
    runwayRows,
    stationRows,
    canonicalIcaos(airportRows),
  )
}

function detailRecords(
  listed: readonly ListedEntry<AirportDetailSourceRow>[],
  runwayRows: readonly RunwaySourceRow[],
  stationRows: readonly StationSourceRow[],
  knownIcaos: ReadonlySet<string>,
): AirportDetailRecord[] {
  const runwaysByAirport = new Map<number, RunwaySourceRow[]>()
  for (const runway of visibleRunways(runwayRows)) {
    const list = runwaysByAirport.get(runway.airportId)
    if (list === undefined) runwaysByAirport.set(runway.airportId, [runway])
    else list.push(runway)
  }
  const stationsByIcao = new Map(stationRows.map((s) => [s.icao.trim().toUpperCase(), s]))
  return listed.map(({ row, airport, nearestTr }) => {
    const own = [...(runwaysByAirport.get(row.id) ?? [])].sort(byRunwayIdent)
    let updated = row.updatedAt.getTime()
    for (const runway of own) {
      updated = Math.max(
        updated,
        runway.updatedAt.getTime(),
        runway.overrideUpdatedAt?.getTime() ?? 0,
      )
    }
    const station = stationsByIcao.get(airport.icao)
    return {
      ...airport,
      nearestTr,
      isoRegion: row.isoRegion.trim().toUpperCase(),
      municipality: airport.city,
      ...aliasField(row, knownIcaos),
      station:
        station === undefined
          ? null
          : {
              active: station.isActive,
              primary: station.isPrimary,
              fetchRadiusNm: Number(station.fetchRadiusNm),
            },
      dataUpdatedAt: new Date(updated).toISOString(),
      runways: own.map(runwayDetail),
    }
  })
}

/** `identAlias` alanı: takma ad varsa `{ identAlias }`, yoksa boş (alan yazılmaz). */
function aliasField(
  row: Pick<AirportSourceRow, 'ident' | 'icaoCode' | 'gpsCode'>,
  knownIcaos: ReadonlySet<string>,
): { identAlias?: string } {
  const alias = identAlias(row, knownIcaos)
  return alias === null ? {} : { identAlias: alias }
}

const detailAirportColumns = {
  ...listedAirportColumns,
  isoRegion: airports.isoRegion,
  updatedAt: airports.updatedAt,
}

/** Kaynak ve düzeltme değerinden, düzeltme boş değilse düzeltme (alan alan). */
const overridden = <T>(override: unknown, source: unknown) =>
  sql<T>`coalesce(${override}, ${source})`

/** Seçilmiş kayıtlara pistleri ve istasyon ayarlarını ekler (iki sorgu). */
async function readDetails(
  db: PostgresJsDatabase,
  listed: readonly ListedEntry<AirportDetailSourceRow>[],
  knownIcaos: ReadonlySet<string>,
): Promise<AirportDetailRecord[]> {
  if (listed.length === 0) return []
  const ids = listed.map((entry) => entry.row.id)
  const icaos = listed.map((entry) => entry.airport.icao)
  const [runwayRows, stationRows] = await Promise.all([
    db
      .select({
        id: runways.id,
        airportId: runways.airportId,
        lengthFt: runways.lengthFt,
        widthFt: runways.widthFt,
        surface: runways.surface,
        lighted: runways.lighted,
        leIdent: runways.leIdent,
        leTrueBearingDeg: overridden<number | null>(
          runwayOverrides.leTrueBearingDeg,
          runways.leTrueBearingDeg,
        ),
        leDisplacedThresholdFt: runways.leDisplacedThresholdFt,
        leThresholdLat: overridden<number>(runwayOverrides.leThresholdLat, runways.leThresholdLat),
        leThresholdLon: overridden<number>(runwayOverrides.leThresholdLon, runways.leThresholdLon),
        heIdent: runways.heIdent,
        heTrueBearingDeg: overridden<number | null>(
          runwayOverrides.heTrueBearingDeg,
          runways.heTrueBearingDeg,
        ),
        heDisplacedThresholdFt: runways.heDisplacedThresholdFt,
        heThresholdLat: overridden<number>(runwayOverrides.heThresholdLat, runways.heThresholdLat),
        heThresholdLon: overridden<number>(runwayOverrides.heThresholdLon, runways.heThresholdLon),
        leLatitudeDeg: runways.leLatitudeDeg,
        heLatitudeDeg: runways.heLatitudeDeg,
        updatedAt: runways.updatedAt,
        overrideUpdatedAt: runwayOverrides.updatedAt,
      })
      .from(runways)
      .leftJoin(runwayOverrides, eq(runwayOverrides.runwayId, runways.id))
      .where(inArray(runways.airportId, ids)),
    db
      .select({
        icao: stations.icao,
        isActive: stations.isActive,
        isPrimary: stations.isPrimary,
        fetchRadiusNm: stations.fetchRadiusNm,
      })
      .from(stations)
      .where(inArray(stations.icao, icaos)),
  ])
  return detailRecords(listed, runwayRows, stationRows, knownIcaos)
}

/**
 * Bir ülkenin IATA kodlu havalimanları pistleri, istasyon ayarları ve veri tarihiyle
 * (`GET /v1/airports?include=runways`). Liste ve sıra `listAirportsWithIata` ile aynıdır.
 */
export async function listAirportDetails(
  db: PostgresJsDatabase,
  country: string,
  rings: Pick<AirportRingConfig, 'ringsKm'>,
): Promise<AirportDetailRecord[]> {
  const [rows, turkey] = await Promise.all([
    db
      .select(detailAirportColumns)
      .from(airports)
      .where(listedFilter(eq(airports.isoCountry, country)))
      .orderBy(asc(airports.id)),
    readTurkishReferencePoints(db),
  ])
  return readDetails(
    db,
    listedEntries(rows, { turkey, ringsKm: rings.ringsKm }),
    canonicalIcaos(rows),
  )
}

/** İçe aktarım kayması ölçümünün veritabanı girdisi (D-109; worker'ın günlük satırı). */
export interface ListingDriftInput {
  /** Listelenen havalimanları pistleriyle (`listListedAirportDetails` ile aynı). */
  airports: AirportDetailRecord[]
  /** Kanonik ICAO çakışmaları (`canonicalIcaoCollisions`). */
  icaoCollisions: string[]
}

/**
 * İçe aktarımdan sonra listenin kayma ölçümü için okuma (D-109): listelenen havalimanları
 * pistleriyle ve aday satırlardaki kanonik ICAO çakışmaları. Worker gece içe aktarımından sonra bir
 * kez çağırır.
 */
export async function readListingDrift(
  db: PostgresJsDatabase,
  rings: AirportRingConfig,
): Promise<ListingDriftInput> {
  const { rows, turkey } = await readListedRows(db, async (where) =>
    db.select(detailAirportColumns).from(airports).where(where).orderBy(asc(airports.id)),
  )
  const airportsWithRunways = await readDetails(
    db,
    listedSelection(rows, { turkey, ringsKm: rings.ringsKm, enabledRing: rings.enabledRing }),
    canonicalIcaos(rows),
  )
  return { airports: airportsWithRunways, icaoCollisions: canonicalIcaoCollisions(rows) }
}

/**
 * Listelenen havalimanları pistleri, istasyon ayarları ve veri tarihiyle (D-080;
 * `GET /v1/airports?scope=listed&include=runways`). Liste ve sıra `listListedAirports` ile aynıdır.
 */
export async function listListedAirportDetails(
  db: PostgresJsDatabase,
  rings: AirportRingConfig,
): Promise<AirportDetailRecord[]> {
  const { rows, turkey } = await readListedRows(db, async (where) =>
    db.select(detailAirportColumns).from(airports).where(where).orderBy(asc(airports.id)),
  )
  return readDetails(
    db,
    listedSelection(rows, { turkey, ringsKm: rings.ringsKm, enabledRing: rings.enabledRing }),
    canonicalIcaos(rows),
  )
}

/** Kodun geçtiği satırlar (ICAO, GPS kodu, ident ya da IATA; büyük/küçük harf ve boşluk fark etmez). */
const rowsMatching = (db: PostgresJsDatabase, code: string) =>
  db
    .select(detailAirportColumns)
    .from(airports)
    .where(
      listedFilter(
        or(
          sql`upper(btrim(${airports.icaoCode})) = ${code}`,
          sql`upper(btrim(${airports.gpsCode})) = ${code}`,
          sql`upper(btrim(${airports.ident})) = ${code}`,
          sql`upper(btrim(${airports.iataCode})) = ${code}`,
        ) as SQL,
      ),
    )
    .orderBy(asc(airports.id))

/**
 * Satır kodu taşıyor mu: `rowsMatching` sorgusunun bellekteki eşi (ICAO, GPS kodu, ident ya da
 * IATA; kırpılmış, büyük harf). Liste kuralının öbür koşullarını `listedEntries` uygular.
 */
export function rowMatchesCode(
  row: Pick<AirportSourceRow, 'icaoCode' | 'gpsCode' | 'ident' | 'iataCode'>,
  code: string,
): boolean {
  const wanted = code.trim().toUpperCase()
  if (wanted === '') return false
  return [row.icaoCode, row.gpsCode, row.ident, row.iataCode].some(
    (value) => value !== null && value.trim().toUpperCase() === wanted,
  )
}

/** Tek havalimanı aramasının sonucu: gösterilen kayıt ve takma ad denetiminin satırları. */
interface FoundAirport<R extends AirportSourceRow> {
  entry: ListedEntry<R>
  /** Kanonik ICAO'yla eşleşen satırlar (`identAlias` çakışma denetimi). */
  rows: readonly R[]
}

/**
 * Tek havalimanı kuralı, satır okuyucusundan bağımsız (`findAirportDetail` veritabanıyla,
 * `findAirportInRows` bellekteki satırlarla): önce ICAO, sonra IATA (liste kuralına göre o ICAO'da
 * gösterilen kayıtsa), sonra adres takma adı (D-109, `identAlias`; takma adı taşıyan satır o
 * ICAO'da gösterilen satırsa).
 */
async function findAirport<R extends AirportSourceRow>(
  code: string,
  rowsFor: (code: string) => Promise<readonly R[]> | readonly R[],
  context: RingContext,
): Promise<FoundAirport<R> | null> {
  const wanted = code.trim().toUpperCase()
  if (wanted === '') return null
  const matching = await rowsFor(wanted)
  const candidates = listedEntries(matching, context)
  const byIcao = candidates.find((entry) => entry.airport.icao === wanted)
  if (byIcao !== undefined) return { entry: byIcao, rows: matching }
  const byIata = candidates.find((entry) => entry.airport.iata === wanted)
  const known = canonicalIcaos(matching)
  const byAlias =
    byIata === undefined
      ? candidates.find((entry) => identAlias(entry.row, known) === wanted)
      : undefined
  const found = byIata ?? byAlias
  if (found === undefined) return null
  // Aynı ICAO'yu taşıyan daha küçük kimlikli bir satır varsa listede o görünür.
  const shownRows = await rowsFor(found.airport.icao)
  const shown = listedEntries(shownRows, context).find(
    (entry) => entry.airport.icao === found.airport.icao,
  )
  if (shown === undefined) return null
  if (byIata !== undefined && shown.airport.iata !== wanted) return null
  if (byAlias !== undefined && shown.row.id !== byAlias.row.id) return null
  return { entry: shown, rows: shownRows }
}

/**
 * Tek havalimanı, ICAO (4 karakter) ya da IATA (3 harf) koduyla; büyük/küçük harf fark etmez
 * (`GET /v1/airports/:code`). Önce ICAO eşleşmesi aranır; IATA eşleşmesi, liste kuralına göre o
 * ICAO'da gösterilen kayıtsa döner. Böylece bu uç yalnızca ülke listelerinde (`listAirportsWithIata`)
 * görünen havalimanlarını, listedeki kanonik ICAO ile verir. Halka süzgeci uygulanmaz: her ülkenin
 * IATA kodlu havalimanı bulunur ve halkasını taşır (sayfalar listelenen havalimanlarıyla sınırlıdır).
 * ICAO ve IATA eşleşmesi yoksa adres takma adı aranır (D-109, `identAlias`): kodu değişen
 * havalimanının OurAirports kimliğindeki eski kod (UTSS → UZSS, SPIM → SPJC); başka bir satırın
 * kanonik ICAO'su olan kimlik (WABP) takma ad değildir. Askerî hava alanları (D-107, D-109) hiçbir
 * kodla bulunmaz. Eşleşme yoksa null.
 */
export async function findAirportDetail(
  db: PostgresJsDatabase,
  code: string,
  rings: Pick<AirportRingConfig, 'ringsKm'>,
): Promise<AirportDetailRecord | null> {
  const wanted = code.trim().toUpperCase()
  if (wanted === '') return null
  // İlk kodun satırları ve uzaklık referansları birlikte okunur.
  const [first, turkey] = await Promise.all([
    rowsMatching(db, wanted),
    readTurkishReferencePoints(db),
  ])
  const found = await findAirport(
    wanted,
    (next) => (next === wanted ? first : rowsMatching(db, next)),
    { turkey, ringsKm: rings.ringsKm },
  )
  if (found === null) return null
  const [detail] = await readDetails(db, [found.entry], canonicalIcaos(found.rows))
  return detail ?? null
}

/**
 * `findAirportDetail`'ın bellekteki eşi (testler ve fixture ölçümleri): satırlar veritabanındaki
 * gibi kimlik sırasıyla verilir; pistler ve istasyonlar `toAirportDetails`'taki gibi eklenir.
 */
export async function findAirportInRows(
  airportRows: readonly AirportDetailSourceRow[],
  runwayRows: readonly RunwaySourceRow[],
  stationRows: readonly StationSourceRow[],
  code: string,
  context: RingContext,
): Promise<AirportDetailRecord | null> {
  const found = await findAirport(
    code,
    (wanted) => airportRows.filter((row) => rowMatchesCode(row, wanted)),
    context,
  )
  if (found === null) return null
  const [detail] = detailRecords([found.entry], runwayRows, stationRows, canonicalIcaos(found.rows))
  return detail ?? null
}
