import { and, asc, eq, inArray, isNotNull, or, sql, type SQL } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { airports, runwayOverrides, runways, stations } from './schema'

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

/** Listeye giren satır ve ondan üretilen kayıt. */
interface ListedEntry<R extends AirportSourceRow> {
  row: R
  airport: ListedAirport
}

/** `toListedAirports` kuralı; satırı da taşır (ayrıntı sorguları kimliğe ihtiyaç duyar). */
function listedEntries<R extends AirportSourceRow>(rows: readonly R[]): ListedEntry<R>[] {
  const byIcao = new Map<string, ListedEntry<R>>()
  for (const row of rows) {
    const iata = present(row.iataCode)?.toUpperCase() ?? ''
    if (!IATA_CODE.test(iata) || !isListedType(row.type)) continue
    const icao = (present(row.icaoCode) ?? present(row.gpsCode) ?? row.ident.trim()).toUpperCase()
    if (icao === '' || byIcao.has(icao)) continue
    byIcao.set(icao, {
      row,
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
      },
    })
  }
  return [...byIcao.values()].sort(
    (a, b) => byCode(a.airport.iata, b.airport.iata) || byCode(a.airport.icao, b.airport.icao),
  )
}

/**
 * Saf kısım: ham satırlardan liste. IATA kodu kırpılıp büyük harfe çevrilir; üç harf değilse ya da
 * tür listede yoksa satır atlanır. ICAO = `icao_code`, yoksa `gps_code`, o da yoksa `ident`.
 * Aynı ICAO'ya düşen satırlardan önce gelen (satırlar kimlik sırasıyla verilir, en küçük
 * kimlik) kalır. Sonuç IATA'ya, eşitse ICAO'ya göre sıralıdır.
 */
export function toListedAirports(rows: readonly AirportSourceRow[]): ListedAirport[] {
  return listedEntries(rows).map((entry) => entry.airport)
}

const listedAirportColumns = {
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
}

/** Listeye girebilecek satırlar: IATA kodu olan büyük, orta ve küçük havalimanları. */
const listedFilter = (...conditions: SQL[]) =>
  and(
    inArray(airports.type, [...LISTED_AIRPORT_TYPES]),
    isNotNull(airports.iataCode),
    ...conditions,
  )

/**
 * Bir ülkenin IATA kodlu havalimanları (`country`: ISO 3166-1 alpha-2, büyük harf; ör. TR).
 * Türkiye'de ~60 satırdır; süzme SQL'de, biçim denetimi ve sıralama `toListedAirports`'tadır.
 */
export async function listAirportsWithIata(
  db: PostgresJsDatabase,
  country: string,
): Promise<ListedAirport[]> {
  const rows = await db
    .select(listedAirportColumns)
    .from(airports)
    .where(listedFilter(eq(airports.isoCountry, country)))
    .orderBy(asc(airports.id))
  return toListedAirports(rows)
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
 * ayarlarını ve veri tarihini ekler. Sıra listeyle aynıdır (IATA, eşitse ICAO).
 */
export function toAirportDetails(
  airportRows: readonly AirportDetailSourceRow[],
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
  return listedEntries(airportRows).map(({ row, airport }) => {
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

async function readDetails(
  db: PostgresJsDatabase,
  airportRows: AirportDetailSourceRow[],
): Promise<AirportDetailRecord[]> {
  const listed = listedEntries(airportRows)
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
  return toAirportDetails(
    listed.map((entry) => entry.row),
    runwayRows,
    stationRows,
  )
}

/**
 * Bir ülkenin IATA kodlu havalimanları pistleri, istasyon ayarları ve veri tarihiyle
 * (`GET /v1/airports?include=runways`). Liste ve sıra `listAirportsWithIata` ile aynıdır.
 */
export async function listAirportDetails(
  db: PostgresJsDatabase,
  country: string,
): Promise<AirportDetailRecord[]> {
  const rows = await db
    .select(detailAirportColumns)
    .from(airports)
    .where(listedFilter(eq(airports.isoCountry, country)))
    .orderBy(asc(airports.id))
  return readDetails(db, rows)
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
 * ICAO'da gösterilen kayıtsa döner. Böylece bu uç yalnızca listede görünen havalimanlarını, listedeki
 * kanonik ICAO ile verir. Eşleşme yoksa null.
 */
export async function findAirportDetail(
  db: PostgresJsDatabase,
  code: string,
): Promise<AirportDetailRecord | null> {
  const wanted = code.trim().toUpperCase()
  if (wanted === '') return null
  const candidates = listedEntries(await rowsMatching(db, wanted))
  const byIcao = candidates.find((entry) => entry.airport.icao === wanted)
  let match = byIcao
  if (match === undefined) {
    const byIata = candidates.find((entry) => entry.airport.iata === wanted)
    if (byIata === undefined) return null
    // Aynı ICAO'yu taşıyan daha küçük kimlikli bir satır varsa listede o görünür.
    const shown = listedEntries(await rowsMatching(db, byIata.airport.icao)).find(
      (entry) => entry.airport.icao === byIata.airport.icao,
    )
    if (shown === undefined || shown.airport.iata !== wanted) return null
    match = shown
  }
  const [detail] = await readDetails(db, [match.row])
  return detail ?? null
}
