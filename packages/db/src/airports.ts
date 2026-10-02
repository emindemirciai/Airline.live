import { and, asc, eq, inArray, isNotNull, ne, or, sql, type SQL } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { airports, runwayOverrides, runways, stations } from './schema'

/**
 * Haritada gösterilen havalimanları (`GET /v1/airports`): OurAirports kayıtlarından IATA kodu
 * olan büyük, orta ve küçük havalimanları. Heliport, deniz uçağı üssü ve kapalı alan yoktur.
 * Tablo zaten içe aktarım süzgecinden geçmiştir (büyük, orta ya da tarifeli sefer alan alanlar;
 * data-sources.md §3); liste kuralı bu koşulu ayrıca uygular (`isListableRow`).
 *
 * Listelenen havalimanları (D-080, `listListedAirports`): Türkiye'nin IATA kodlu havalimanları ve
 * açık halkalardaki yurt dışı adayları. Halka, Türkiye'deki en yakın IATA kodlu havalimanına büyük
 * daire uzaklığından hesaplanır. Halka sınırları ve açık halka `@havayolu/shared`'dadır
 * (`AIRPORT_RING_CONFIG`); bu paket shared'a bağımlı olmadığı için ayar çağırandan gelir.
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

/**
 * Yurt dışı adayı (`@havayolu/shared` `isForeignCandidate`): büyük ya da orta havalimanı, tarifeli,
 * üç harfli IATA kodu (IATA denetimi `listedEntries`'tedir).
 */
const isForeignCandidateRow = (row: AirportSourceRow) =>
  (row.type === 'large_airport' || row.type === 'medium_airport') && row.scheduledService

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
 * data-sources.md §3). Yurt dışı satırları atlanır. Kimlik listedeki kuralla kurulur (ICAO, yoksa
 * GPS kodu, o da yoksa ident).
 */
export function turkishReferencePoints(rows: readonly ReferenceSourceRow[]): TurkishReference[] {
  const references: TurkishReference[] = []
  for (const row of rows) {
    const iata = present(row.iataCode)?.toUpperCase() ?? ''
    if (!isTurkishRow(row) || !isListedType(row.type) || !IATA_CODE.test(iata)) continue
    references.push({
      lat: row.latitudeDeg,
      lon: row.longitudeDeg,
      icao: (present(row.icaoCode) ?? present(row.gpsCode) ?? row.ident.trim()).toUpperCase(),
      iata,
      name: row.name.trim(),
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

/** `toListedAirports` kuralı; satırı da taşır (ayrıntı sorguları kimliğe ihtiyaç duyar). */
function listedEntries<R extends AirportSourceRow>(
  rows: readonly R[],
  context: RingContext,
): ListedEntry<R>[] {
  const byIcao = new Map<string, ListedEntry<R>>()
  for (const row of rows) {
    const iata = present(row.iataCode)?.toUpperCase() ?? ''
    if (!isListableRow(row, iata) || !isListedType(row.type)) continue
    const icao = (present(row.icaoCode) ?? present(row.gpsCode) ?? row.ident.trim()).toUpperCase()
    if (icao === '' || byIcao.has(icao)) continue
    const { fields, nearestTr } = ringFields(row, context)
    byIcao.set(icao, {
      row,
      nearestTr,
      airport: {
        icao,
        iata,
        name: row.name.trim(),
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
 * ICAO = `icao_code`, yoksa `gps_code`, o da yoksa `ident`. Aynı ICAO'ya düşen satırlardan önce
 * gelen (satırlar kimlik sırasıyla verilir, en küçük kimlik) kalır. Sonuç IATA'ya, eşitse ICAO'ya
 * göre sıralıdır. Her kayıt ülke, halka ve Türkiye'ye uzaklık taşır (`context`).
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
 * Saf kısım: listelenen havalimanları (D-080). Türkiye satırları liste kuralıyla
 * (`toListedAirports`); yurt dışı satırları aday kuralıyla (büyük ya da orta, tarifeli, üç harfli
 * IATA) ve halkası `enabledRing`'i aşmıyorsa. Satırlar kimlik sırasıyla verilir; sonuç
 * `toListedAirports` sırasıyladır.
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

/** Yurt dışı adayları (SQL ön süzgeci; `isForeignCandidateRow` ile aynı koşul). */
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
 * Bir ülkenin IATA kodlu havalimanları (`country`: ISO 3166-1 alpha-2, büyük harf; ör. TR).
 * Türkiye'de ~60 satırdır; süzme SQL'de, biçim denetimi ve sıralama `toListedAirports`'tadır.
 * Yurt dışı kayıtlar halkasını ve Türkiye'ye uzaklığını taşır (`rings.ringsKm`).
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
 * istasyonları): Türkiye'nin IATA kodlu havalimanları ve halkası `rings.enabledRing`'i aşmayan yurt
 * dışı adayları, IATA sırasıyla. Satırlar her çağrıda okunur; önbellek çağıranındır (API 10 dk).
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
  return detailRecords(listedEntries(airportRows, context), runwayRows, stationRows)
}

function detailRecords(
  listed: readonly ListedEntry<AirportDetailSourceRow>[],
  runwayRows: readonly RunwaySourceRow[],
  stationRows: readonly StationSourceRow[],
): AirportDetailRecord[] {
  const runwaysByAirport = new Map<number, RunwaySourceRow[]>()
  for (const runway of runwayRows) {
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
  return detailRecords(listed, runwayRows, stationRows)
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
  return readDetails(db, listedEntries(rows, { turkey, ringsKm: rings.ringsKm }))
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
 * Tek havalimanı, ICAO (4 karakter) ya da IATA (3 harf) koduyla; büyük/küçük harf fark etmez
 * (`GET /v1/airports/:code`). Önce ICAO eşleşmesi aranır; IATA eşleşmesi, liste kuralına göre o
 * ICAO'da gösterilen kayıtsa döner. Böylece bu uç yalnızca ülke listelerinde (`listAirportsWithIata`)
 * görünen havalimanlarını, listedeki kanonik ICAO ile verir. Halka süzgeci uygulanmaz: her ülkenin
 * IATA kodlu havalimanı bulunur ve halkasını taşır (sayfalar listelenen havalimanlarıyla sınırlıdır).
 * Eşleşme yoksa null.
 */
export async function findAirportDetail(
  db: PostgresJsDatabase,
  code: string,
  rings: Pick<AirportRingConfig, 'ringsKm'>,
): Promise<AirportDetailRecord | null> {
  const wanted = code.trim().toUpperCase()
  if (wanted === '') return null
  const [matching, turkey] = await Promise.all([
    rowsMatching(db, wanted),
    readTurkishReferencePoints(db),
  ])
  const context: RingContext = { turkey, ringsKm: rings.ringsKm }
  const candidates = listedEntries(matching, context)
  const byIcao = candidates.find((entry) => entry.airport.icao === wanted)
  let match = byIcao
  if (match === undefined) {
    const byIata = candidates.find((entry) => entry.airport.iata === wanted)
    if (byIata === undefined) return null
    // Aynı ICAO'yu taşıyan daha küçük kimlikli bir satır varsa listede o görünür.
    const shown = listedEntries(await rowsMatching(db, byIata.airport.icao), context).find(
      (entry) => entry.airport.icao === byIata.airport.icao,
    )
    if (shown === undefined || shown.airport.iata !== wanted) return null
    match = shown
  }
  const [detail] = await readDetails(db, [match])
  return detail ?? null
}
