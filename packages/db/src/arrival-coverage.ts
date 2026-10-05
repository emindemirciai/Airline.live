import type postgres from 'postgres'
import { greatCircleKm, isHiddenRunway } from './airports'
import { hourStart } from './ingest'
import { utcDay } from './partitions'

/**
 * Kapsama raporunun salt okunur okuyucuları (Parça 1 M7b.2, D-098). Tanımlar (`15 km`, `alan +
 * 3.000 ft`, `baro_rate < −300 fpm`, kutu yarıçapı, bölge yarıçapı) `@havayolu/shared`
 * `arrival-coverage.ts`'tedir; bu paket shared'a bağımlı olmadığı için değerler çağırandan
 * parametre olarak gelir (worker `ARRIVAL_CANDIDATE_RULE` vb. geçirir).
 *
 * Üretim güvenliği:
 * - Her okuma kendi `begin read only` işleminde çalışır: `statement_timeout` 60 sn,
 *   `lock_timeout` 2 sn. Bağlantı partiler arasında havuza döner.
 * - 55P03 (kilit alınamadı) ve 57014 (zaman aşımı) üç kez, artan ve rastgele gecikmeyle denenir.
 * - Çağıranın `checkpoint`'i (iş bütçesi, kapanış) her denemeden ve her yeniden deneme
 *   beklemesinden önce çağrılır. Gün dilimleri ve partiler de birer okuma olduğundan bütçe aşımı
 *   en geç bir ifade (≤ 60 sn) sonra görülür.
 * - Aday sorgusu pencerenin her UTC günü için ayrı ve kısa bir ifadedir; `ts` aralığı yalnızca o
 *   günün partition'ına iner.
 * - Örnekler en çok 200 uçuşluk partilerle birincil anahtar dizininden okunur.
 *
 * Zaman ISO metni + `::timestamptz` olarak gider, epoch ms (`float8`) olarak döner (ingest.ts ile
 * aynı yöntem; iki istemci biçiminde de aynı çalışır).
 */
type Sql = postgres.Sql
type Tx = postgres.TransactionSql

const KM_PER_DEGREE = (Math.PI * 6371.0088) / 180
const DAY_MS = 86_400_000

/** bigint sütunlar postgres-js'te metin döner; kimlikler 2^53'ün çok altındadır. */
const toId = (value: string | number | bigint): number => Number(value)
const iso = (ms: number) => new Date(ms).toISOString()
const errorCode = (error: unknown) => (error as { code?: string } | null)?.code

function chunks<T>(rows: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

// ---------------------------------------------------------------------------------------------
// Salt okunur işlem

export const ARRIVAL_COVERAGE_STATEMENT_TIMEOUT_MS = 60_000
export const ARRIVAL_COVERAGE_LOCK_TIMEOUT_MS = 2_000
export const ARRIVAL_COVERAGE_READ_ATTEMPTS = 3
/** Yeniden denenen SQLSTATE'ler: kilit alınamadı, ifade zaman aşımı (iptal). */
export const ARRIVAL_COVERAGE_RETRY_CODES: readonly string[] = ['55P03', '57014']

export interface ReadOnlyOptions {
  statementTimeoutMs?: number
  lockTimeoutMs?: number
  /** Toplam deneme sayısı (varsayılan 3). */
  attempts?: number
  sleep?: (ms: number) => Promise<void>
  /** 0–1 arası; gecikmeye eklenen rastgelelik (test için sabitlenebilir). */
  jitter?: () => number
  /** Yeniden denemeden önce çağrılır (günlük için). */
  onRetry?: (info: { attempt: number; code: string; delayMs: number }) => void
  /**
   * Her denemeden (ilki dahil) ve her yeniden deneme beklemesinden önce çağrılır. Fırlatırsa okuma
   * durur ve hata olduğu gibi çağırana gider (iş bütçesi aşıldı, worker kapanıyor).
   */
  checkpoint?: () => void
}

/** Deneme `attempt`'ten (1'den) sonraki bekleme: 250 ms × 2^(n−1) + en çok 250 ms rastgele. */
export function arrivalCoverageRetryDelayMs(attempt: number, jitter: number): number {
  return 250 * 2 ** (attempt - 1) + Math.round(Math.min(1, Math.max(0, jitter)) * 250)
}

/**
 * `run`'ı salt okunur bir işlemde çalıştırır: `statement_timeout` ve `lock_timeout` yalnızca bu
 * işlem için (`set_config(…, true)`) ayarlanır. 55P03 ve 57014'te işlem baştan, en çok `attempts`
 * kez denenir; başka hata olduğu gibi fırlatılır. Yazma girişimi 25006 ile reddedilir.
 * `checkpoint` her denemeden ve her yeniden deneme beklemesinden önce çağrılır.
 */
export async function readOnlyTransaction<T>(
  sql: Sql,
  run: (tx: Tx) => Promise<T>,
  options: ReadOnlyOptions = {},
): Promise<T> {
  const {
    statementTimeoutMs = ARRIVAL_COVERAGE_STATEMENT_TIMEOUT_MS,
    lockTimeoutMs = ARRIVAL_COVERAGE_LOCK_TIMEOUT_MS,
    attempts = ARRIVAL_COVERAGE_READ_ATTEMPTS,
    sleep = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    jitter = Math.random,
    onRetry,
    checkpoint,
  } = options
  for (let attempt = 1; ; attempt += 1) {
    checkpoint?.()
    try {
      return (await sql.begin('read only', async (tx) => {
        await tx`
          select set_config('statement_timeout', ${String(Math.round(statementTimeoutMs))}, true),
            set_config('lock_timeout', ${String(Math.round(lockTimeoutMs))}, true)`
        return run(tx)
      })) as T
    } catch (error) {
      const code = errorCode(error)
      if (code === undefined || !ARRIVAL_COVERAGE_RETRY_CODES.includes(code)) throw error
      if (attempt >= attempts) throw error
      checkpoint?.()
      const delayMs = arrivalCoverageRetryDelayMs(attempt, jitter())
      onRetry?.({ attempt, code, delayMs })
      await sleep(delayMs)
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Saf yardımcılar

export interface TimeSlice {
  from: Date
  to: Date
}

/** [from, to) aralığını UTC gün sınırlarında böler (boş aralık → boş liste). */
export function utcDaySlices(from: Date, to: Date): TimeSlice[] {
  const out: TimeSlice[] = []
  let cursor = from.getTime()
  const end = to.getTime()
  while (cursor < end) {
    const nextDay = utcDay(new Date(cursor)).getTime() + DAY_MS
    const sliceEnd = Math.min(nextDay, end)
    out.push({ from: new Date(cursor), to: new Date(sliceEnd) })
    cursor = sliceEnd
  }
  return out
}

export interface LatLonBox {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

/**
 * Merkezin çevresinde yarı genişliği `halfKm` olan enlem/boylam kutusu. Boylam açıklığı kutunun
 * kutba yakın kenarının enleminde alınır; böylece kutu aynı yarıçaplı büyük daire çemberini
 * tümüyle kapsar (haversine, R = 6371,0088 km). Kutup ya da 180° boylamı yakınında boylam
 * aralığı tüm dünyaya açılır.
 */
export function latLonBox(center: { lat: number; lon: number }, halfKm: number): LatLonBox {
  const dLat = halfKm / KM_PER_DEGREE
  const poleward = Math.min(90, Math.abs(center.lat) + dLat)
  const cos = Math.cos((poleward * Math.PI) / 180)
  const dLon = cos > 1e-9 ? halfKm / (KM_PER_DEGREE * cos) : 360
  const minLon = center.lon - dLon
  const maxLon = center.lon + dLon
  const wraps = dLon >= 180 || minLon < -180 || maxLon > 180
  return {
    minLat: Math.max(-90, center.lat - dLat),
    maxLat: Math.min(90, center.lat + dLat),
    minLon: wraps ? -180 : minLon,
    maxLon: wraps ? 180 : maxLon,
  }
}

/** SQL haversine (km), `greatCircleKm` ve `@havayolu/geo` `distanceKm` ile aynı yarıçap. */
const haversineSql = (lat: string, lon: string, refLat: string, refLon: string) =>
  `2 * 6371.0088 * asin(least(1, sqrt(power(sin(radians(${lat} - ${refLat}) / 2), 2) + ` +
  `cos(radians(${refLat})) * cos(radians(${lat})) * power(sin(radians(${lon} - ${refLon}) / 2), 2))))`

export interface SqlQuery {
  text: string
  values: (string | number | boolean | null | readonly number[])[]
}

// ---------------------------------------------------------------------------------------------
// İstasyonlar, pist eşikleri, yakın alanlar

export interface ArrivalCoverageThresholdRow {
  runwayId: number
  end: 'le' | 'he'
  /** Pist ucu adı (34L); kaynakta yoksa null. */
  ident: string | null
  lat: number
  lon: number
  /** 'runway_end' | 'displaced_threshold' | 'arp_fallback' | 'override' */
  source: string
  /** Pist ucunun yüksekliği (ft); bilinmiyorsa null. */
  elevationFt: number | null
}

export interface ArrivalCoverageStationRow {
  icao: string
  iata: string
  isPrimary: boolean
  airportId: number
  lat: number
  lon: number
  elevationFt: number | null
  /** `stations.geoid_undulation_m`; yedek tablo çağıranda uygulanır (`resolveArrivalGeoid`). */
  geoidUndulationM: number | null
  /** Gizli olmayan pistlerin iki ucu; `runway_overrides` alan alan uygulanmıştır. */
  thresholds: ArrivalCoverageThresholdRow[]
}

/**
 * Etkin istasyonlar: ARP ve alan yüksekliği (`activeStationsWithArp` ile aynı lateral birleşim,
 * aynı ident'in en küçük kimlikli satırı), geoid ondülasyonu ve pist eşikleri. Gizli pistler
 * (`isHiddenRunway`) atlanır; yöneticinin düzeltmesi eşik koordinatına alan alan uygulanır ve
 * düzeltilen ucun kaynağı 'override' olur. Havalimanı satırı olmayan istasyon atlanır.
 * Sıra: önce birincil, sonra ICAO; eşikler pist kimliği ve uç sırasıyla.
 */
export async function readArrivalCoverageStations(
  sql: Sql,
  options: ReadOnlyOptions = {},
): Promise<ArrivalCoverageStationRow[]> {
  return readOnlyTransaction(
    sql,
    async (tx) => {
      const stations = await tx<
        {
          icao: string
          iata: string
          is_primary: boolean
          geoid_undulation_m: number | null
          airport_id: number
          lat: number
          lon: number
          elevation_ft: number | null
        }[]
      >`
        select s.icao, s.iata, s.is_primary, s.geoid_undulation_m,
          a.id as airport_id, a.latitude_deg as lat, a.longitude_deg as lon, a.elevation_ft
        from stations s
        join lateral (
          select id, latitude_deg, longitude_deg, elevation_ft
          from airports
          where ident = s.icao
          order by id
          limit 1
        ) a on true
        where s.is_active
        order by s.is_primary desc, s.icao`
      if (stations.length === 0) return []
      const runways = await tx<
        {
          id: number
          airport_id: number
          length_ft: number | null
          width_ft: number | null
          le_ident: string | null
          le_elevation_ft: number | null
          le_threshold_lat: number
          le_threshold_lon: number
          le_threshold_source: string
          le_overridden: boolean
          he_ident: string | null
          he_elevation_ft: number | null
          he_threshold_lat: number
          he_threshold_lon: number
          he_threshold_source: string
          he_overridden: boolean
        }[]
      >`
        select r.id, r.airport_id, r.length_ft, r.width_ft,
          r.le_ident, r.le_elevation_ft,
          coalesce(o.le_threshold_lat, r.le_threshold_lat) as le_threshold_lat,
          coalesce(o.le_threshold_lon, r.le_threshold_lon) as le_threshold_lon,
          r.le_threshold_source,
          (o.le_threshold_lat is not null or o.le_threshold_lon is not null) as le_overridden,
          r.he_ident, r.he_elevation_ft,
          coalesce(o.he_threshold_lat, r.he_threshold_lat) as he_threshold_lat,
          coalesce(o.he_threshold_lon, r.he_threshold_lon) as he_threshold_lon,
          r.he_threshold_source,
          (o.he_threshold_lat is not null or o.he_threshold_lon is not null) as he_overridden
        from runways r
        left join runway_overrides o on o.runway_id = r.id
        where r.airport_id in ${tx(stations.map((s) => s.airport_id))}
        order by r.id`
      const byAirport = new Map<number, ArrivalCoverageThresholdRow[]>()
      for (const r of runways) {
        if (
          isHiddenRunway({
            id: r.id,
            lengthFt: r.length_ft,
            widthFt: r.width_ft,
            heIdent: r.he_ident,
          })
        ) {
          continue
        }
        const list = byAirport.get(r.airport_id) ?? []
        list.push(
          {
            runwayId: r.id,
            end: 'le',
            ident: r.le_ident,
            lat: Number(r.le_threshold_lat),
            lon: Number(r.le_threshold_lon),
            source: r.le_overridden ? 'override' : r.le_threshold_source,
            elevationFt: r.le_elevation_ft,
          },
          {
            runwayId: r.id,
            end: 'he',
            ident: r.he_ident,
            lat: Number(r.he_threshold_lat),
            lon: Number(r.he_threshold_lon),
            source: r.he_overridden ? 'override' : r.he_threshold_source,
            elevationFt: r.he_elevation_ft,
          },
        )
        byAirport.set(r.airport_id, list)
      }
      return stations.map((s) => ({
        icao: s.icao,
        iata: s.iata,
        isPrimary: s.is_primary,
        airportId: s.airport_id,
        lat: s.lat,
        lon: s.lon,
        elevationFt: s.elevation_ft,
        geoidUndulationM: s.geoid_undulation_m,
        thresholds: byAirport.get(s.airport_id) ?? [],
      }))
    },
    options,
  )
}

/** Yakın alan olarak sayılan OurAirports türleri (askerî alanlar dahil; heliport ve kapalı yok). */
export const NEARBY_AIRFIELD_TYPES = ['large_airport', 'medium_airport', 'small_airport'] as const

export interface NearbyAirfieldRow {
  stationIcao: string
  airportId: number
  ident: string
  name: string
  type: string
  lat: number
  lon: number
  elevationFt: number | null
  distanceKm: number
}

/**
 * Her istasyonun ARP'ına `radiusKm` (dahil) içindeki başka havalimanları (OurAirports; büyük, orta
 * ve küçük alanlar, askerî alanlar dahil). İstasyonun kendi kaydı (`ident` = ICAO) dışarıda kalır.
 * Uzaklık haversine'dir. Sıra: istasyon girdisinin sırası, sonra uzaklık, sonra kimlik.
 */
export async function readNearbyAirfields(
  sql: Sql,
  params: { stations: readonly { icao: string; lat: number; lon: number }[]; radiusKm: number },
  options: ReadOnlyOptions = {},
): Promise<NearbyAirfieldRow[]> {
  if (params.stations.length === 0) return []
  const boxes = params.stations.map((s) => ({
    icao: s.icao,
    ...boxJson(latLonBox(s, params.radiusKm)),
  }))
  const rows = await readOnlyTransaction(
    sql,
    (tx) =>
      tx<
        {
          station_icao: string
          id: number
          ident: string
          name: string
          type: string
          lat: number
          lon: number
          elevation_ft: number | null
        }[]
      >`
        select b.icao as station_icao, a.id, a.ident, a.name, a.type,
          a.latitude_deg as lat, a.longitude_deg as lon, a.elevation_ft
        from jsonb_to_recordset(${JSON.stringify(boxes)}::text::jsonb) as b(
          icao text, min_lat float8, max_lat float8, min_lon float8, max_lon float8
        )
        join airports a
          on a.latitude_deg between b.min_lat and b.max_lat
          and a.longitude_deg between b.min_lon and b.max_lon
        where a.type in ${tx([...NEARBY_AIRFIELD_TYPES])}
          and a.ident <> b.icao`,
    options,
  )
  const order = new Map(params.stations.map((s, i) => [s.icao, i]))
  const center = new Map(params.stations.map((s) => [s.icao, s]))
  const out: NearbyAirfieldRow[] = []
  for (const r of rows) {
    const station = center.get(r.station_icao)
    if (station === undefined) continue
    const distanceKm = greatCircleKm(station, { lat: r.lat, lon: r.lon })
    if (distanceKm > params.radiusKm) continue
    out.push({
      stationIcao: r.station_icao,
      airportId: r.id,
      ident: r.ident,
      name: r.name,
      type: r.type,
      lat: r.lat,
      lon: r.lon,
      elevationFt: r.elevation_ft,
      distanceKm,
    })
  }
  return out.sort(
    (a, b) =>
      (order.get(a.stationIcao) ?? 0) - (order.get(b.stationIcao) ?? 0) ||
      a.distanceKm - b.distanceKm ||
      a.airportId - b.airportId,
  )
}

const boxJson = (box: LatLonBox) => ({
  min_lat: box.minLat,
  max_lat: box.maxLat,
  min_lon: box.minLon,
  max_lon: box.maxLon,
})

// ---------------------------------------------------------------------------------------------
// Aday uçuş kayıtları

export interface ArrivalCandidateStation {
  icao: string
  lat: number
  lon: number
  elevationFt: number | null
}

/** `@havayolu/shared` `ArrivalCandidateRule` ile aynı biçim. */
export interface ArrivalCandidateParams {
  boxKm: number
  maxAboveFieldFt: number
  baroRateBelowFpm: number
  includeGeomOnly: boolean
}

/**
 * Aday sorgusu (tek zaman dilimi). Sınıflandırıcının kesin üst kümesidir: havada, `alt_baro` dolu,
 * istasyonun `boxKm` kutusunda, `alt_baro ≤ coalesce(alan, 0) + maxAboveFieldFt` ve
 * `baro_rate < baroRateBelowFpm` (ya da `includeGeomOnly` iken baro boş ve görünen dikey hız
 * sınırın altında). `ts` aralığı partition budamasını sağlar. EXPLAIN testi aynı metni kullanır.
 */
export function arrivalCandidateQuery(
  stations: readonly ArrivalCandidateStation[],
  rule: ArrivalCandidateParams,
  from: Date,
  to: Date,
): SqlQuery {
  const boxes = stations.map((s) => ({
    ...boxJson(latLonBox(s, rule.boxKm)),
    max_alt_ft: (s.elevationFt ?? 0) + rule.maxAboveFieldFt,
  }))
  return {
    text: `select distinct t.flight_id
from track_points_fine t
join jsonb_to_recordset($1::text::jsonb) as b(
  min_lat float8, max_lat float8, min_lon float8, max_lon float8, max_alt_ft float8
)
  on t.lat between b.min_lat and b.max_lat
  and t.lon between b.min_lon and b.max_lon
  and t.alt_baro_ft <= b.max_alt_ft
where t.ts >= $2::timestamptz and t.ts < $3::timestamptz
  and not t.on_ground
  and t.alt_baro_ft is not null
  and (
    t.baro_rate_fpm < $4::int
    or ($5::boolean and t.baro_rate_fpm is null and t.vertical_rate_fpm < $4::int)
  )
order by t.flight_id`,
    values: [
      JSON.stringify(boxes),
      from.toISOString(),
      to.toISOString(),
      Math.round(rule.baroRateBelowFpm),
      rule.includeGeomOnly,
    ],
  }
}

/**
 * Pencerede en az bir aday örneği olan uçuş kayıtları (artan kimlik, tekil). Pencerenin her UTC
 * günü ayrı bir salt okunur işlemde, kısa bir ifadeyle sorgulanır.
 */
export async function findArrivalCandidateFlights(
  sql: Sql,
  params: {
    stations: readonly ArrivalCandidateStation[]
    rule: ArrivalCandidateParams
    from: Date
    to: Date
  },
  options: ReadOnlyOptions = {},
): Promise<number[]> {
  if (params.stations.length === 0) return []
  const ids = new Set<number>()
  for (const slice of utcDaySlices(params.from, params.to)) {
    const query = arrivalCandidateQuery(params.stations, params.rule, slice.from, slice.to)
    const rows = await readOnlyTransaction(
      sql,
      (tx) => tx.unsafe<{ flight_id: string }[]>(query.text, query.values as never[]),
      options,
    )
    for (const r of rows) ids.add(toId(r.flight_id))
  }
  return [...ids].sort((a, b) => a - b)
}

// ---------------------------------------------------------------------------------------------
// Uçuş kayıtları ve örnekler

export interface ArrivalCoverageFlightRow {
  id: number
  /** Epoch ms. */
  firstSeenAt: number
  lastSeenAt: number
  status: string
}

const FLIGHT_CHUNK = 5000

/** Uçuş kayıtlarının ilk ve son görülme zamanları (artan kimlik); bulunmayan kimlik atlanır. */
export async function readArrivalCoverageFlights(
  sql: Sql,
  ids: readonly number[],
  options: ReadOnlyOptions = {},
): Promise<ArrivalCoverageFlightRow[]> {
  const out: ArrivalCoverageFlightRow[] = []
  for (const part of chunks([...new Set(ids)], FLIGHT_CHUNK)) {
    const rows = await readOnlyTransaction(
      sql,
      (tx) =>
        tx<{ id: string; first_seen_ms: number; last_seen_ms: number; status: string }[]>`
          select id, status,
            (extract(epoch from first_seen_at) * 1000)::float8 as first_seen_ms,
            (extract(epoch from last_seen_at) * 1000)::float8 as last_seen_ms
          from flights
          where id in ${tx(part)}
          order by id`,
      options,
    )
    for (const r of rows) {
      out.push({
        id: toId(r.id),
        firstSeenAt: r.first_seen_ms,
        lastSeenAt: r.last_seen_ms,
        status: r.status,
      })
    }
  }
  return out.sort((a, b) => a.id - b.id)
}

/** Bir partide okunan en çok uçuş kaydı. */
export const ARRIVAL_SAMPLE_BATCH_FLIGHTS = 200

/** `@havayolu/shared` `ArrivalCoverageSample` ile aynı biçim. */
export interface ArrivalCoverageSampleRow {
  ts: number
  lat: number
  lon: number
  altBaroFt: number | null
  altGeomFt: number | null
  verticalRateFpm: number | null
  baroRateFpm: number | null
  onGround: boolean
  seenPosS: number | null
  source: number
}

/** Bir uçuş kaydı ve ince örnekleri (`ts` artan); `@havayolu/shared` `ArrivalCoverageRecord` biçimi. */
export interface ArrivalCoverageFlightSamples {
  flightId: number
  firstSeenTs: number
  lastSeenTs: number
  samples: ArrivalCoverageSampleRow[]
}

export interface ArrivalSampleBatchParams {
  flights: readonly { id: number; firstSeenAt: number; lastSeenAt: number }[]
  /** Pencere başı − geriye bakış (24 sa); örnekler `max(first_seen_at, bu)`'dan okunur. */
  lookbackStart: Date
  /** Üst sınır (hariç), işin başlangıcı. */
  to: Date
}

/**
 * Örnek sorgusu: partideki kimlikler, birincil anahtar `(flight_id, ts)` sırasıyla. Alt sınır,
 * partideki kayıtların `max(first_seen_at, lookbackStart)` değerlerinin en küçüğüdür; üst sınır
 * `min(to, en geç last_seen_at + 1 ms)`. Bir kaydın satırları zaten `first_seen_at`'ten sonradır,
 * bu yüzden kayıt başına alt sınır bu ortak sınırla aynı sonucu verir; ortak sınır partition
 * budamasını sağlar.
 */
export function arrivalSampleQuery(params: ArrivalSampleBatchParams): SqlQuery {
  const lookback = params.lookbackStart.getTime()
  let from = Number.POSITIVE_INFINITY
  let to = Number.NEGATIVE_INFINITY
  for (const f of params.flights) {
    from = Math.min(from, Math.max(f.firstSeenAt, lookback))
    to = Math.max(to, f.lastSeenAt + 1)
  }
  to = Math.min(to, params.to.getTime())
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    from = lookback
    to = lookback
  }
  return {
    text: `select t.flight_id,
  (extract(epoch from t.ts) * 1000)::float8 as ts_ms,
  t.lat, t.lon, t.alt_baro_ft, t.alt_geom_ft, t.vertical_rate_fpm, t.baro_rate_fpm,
  t.on_ground, t.seen_pos_s, t.source
from track_points_fine t
where t.flight_id = any($1::bigint[])
  and t.ts >= $2::timestamptz and t.ts < $3::timestamptz
order by t.flight_id, t.ts`,
    values: [params.flights.map((f) => f.id), iso(from), iso(to)],
  }
}

/**
 * En çok `ARRIVAL_SAMPLE_BATCH_FLIGHTS` kaydın ince örnekleri, tek salt okunur işlemde. Dönen
 * liste girdideki her kaydı (örneği olmasa da) artan kimlik sırasıyla içerir.
 */
export async function readArrivalCoverageSampleBatch(
  sql: Sql,
  params: ArrivalSampleBatchParams,
  options: ReadOnlyOptions = {},
): Promise<ArrivalCoverageFlightSamples[]> {
  if (params.flights.length > ARRIVAL_SAMPLE_BATCH_FLIGHTS) {
    throw new RangeError(
      `sample batch too large: ${params.flights.length} > ${ARRIVAL_SAMPLE_BATCH_FLIGHTS}`,
    )
  }
  if (params.flights.length === 0) return []
  const query = arrivalSampleQuery(params)
  const rows = await readOnlyTransaction(
    sql,
    (tx) =>
      tx.unsafe<
        {
          flight_id: string
          ts_ms: number
          lat: number
          lon: number
          alt_baro_ft: number | null
          alt_geom_ft: number | null
          vertical_rate_fpm: number | null
          baro_rate_fpm: number | null
          on_ground: boolean
          seen_pos_s: number | null
          source: number
        }[]
      >(query.text, query.values as never[]),
    options,
  )
  const lookback = params.lookbackStart.getTime()
  const byId = new Map<number, ArrivalCoverageFlightSamples>()
  for (const f of [...params.flights].sort((a, b) => a.id - b.id)) {
    byId.set(f.id, {
      flightId: f.id,
      firstSeenTs: f.firstSeenAt,
      lastSeenTs: f.lastSeenAt,
      samples: [],
    })
  }
  for (const r of rows) {
    const record = byId.get(toId(r.flight_id))
    if (record === undefined) continue
    if (r.ts_ms < Math.max(record.firstSeenTs, lookback)) continue
    record.samples.push({
      ts: r.ts_ms,
      lat: r.lat,
      lon: r.lon,
      altBaroFt: r.alt_baro_ft,
      altGeomFt: r.alt_geom_ft,
      verticalRateFpm: r.vertical_rate_fpm,
      baroRateFpm: r.baro_rate_fpm,
      onGround: r.on_ground,
      seenPosS: r.seen_pos_s,
      source: r.source,
    })
  }
  return [...byId.values()]
}

/**
 * Kayıtları `ARRIVAL_SAMPLE_BATCH_FLIGHTS`'lik partilerle (artan kimlik) okur; her parti kendi
 * işlemindedir ve bağlantı partiler arasında tutulmaz. Çağıran partiler arasında bütçesini
 * denetleyebilir.
 */
export async function* arrivalCoverageSampleBatches(
  sql: Sql,
  params: ArrivalSampleBatchParams & { batchSize?: number },
  options: ReadOnlyOptions = {},
): AsyncGenerator<ArrivalCoverageFlightSamples[]> {
  const size = Math.max(
    1,
    Math.min(ARRIVAL_SAMPLE_BATCH_FLIGHTS, params.batchSize ?? ARRIVAL_SAMPLE_BATCH_FLIGHTS),
  )
  const sorted = [...params.flights].sort((a, b) => a.id - b.id)
  for (const part of chunks(sorted, size)) {
    yield await readArrivalCoverageSampleBatch(
      sql,
      { flights: part, lookbackStart: params.lookbackStart, to: params.to },
      options,
    )
  }
}

// ---------------------------------------------------------------------------------------------
// Etkin pencere (veri bütünlüğü)

/** `@havayolu/shared` `ArrivalCoverageWindowStats` ile aynı biçim. */
export interface ArrivalCoverageWindowStatsRow {
  icao: string
  airborneSamples: number
  baroRateNull: number
  seenPosNull: number
  /** Penceredeki `baro_rate_fpm`'i dolu en erken havadaki örnek (epoch ms); yoksa null. */
  firstBaroRateTs: number | null
}

/** Pencere istatistiği sorgusu (tek zaman dilimi): istasyon bölgesindeki (haversine) havadaki örnekler. */
export function arrivalWindowStatsQuery(
  stations: readonly { icao: string; lat: number; lon: number }[],
  zoneKm: number,
  from: Date,
  to: Date,
): SqlQuery {
  const zones = stations.map((s) => ({
    icao: s.icao,
    lat: s.lat,
    lon: s.lon,
    zone_km: zoneKm,
    ...boxJson(latLonBox(s, zoneKm)),
  }))
  return {
    text: `select b.icao,
  count(*)::int as airborne,
  count(*) filter (where t.baro_rate_fpm is null)::int as baro_rate_null,
  count(*) filter (where t.seen_pos_s is null)::int as seen_pos_null,
  (extract(epoch from min(t.ts) filter (where t.baro_rate_fpm is not null)) * 1000)::float8
    as first_baro_ms
from track_points_fine t
join jsonb_to_recordset($1::text::jsonb) as b(
  icao text, lat float8, lon float8, zone_km float8,
  min_lat float8, max_lat float8, min_lon float8, max_lon float8
)
  on t.lat between b.min_lat and b.max_lat
  and t.lon between b.min_lon and b.max_lon
where t.ts >= $2::timestamptz and t.ts < $3::timestamptz
  and not t.on_ground
  and ${haversineSql('t.lat', 't.lon', 'b.lat', 'b.lon')} <= b.zone_km
group by b.icao`,
    values: [JSON.stringify(zones), from.toISOString(), to.toISOString()],
  }
}

/**
 * İstasyon başına penceredeki havadaki ince örnekler: toplam, `baro_rate_fpm` boş, `seen_pos_s`
 * boş ve `baro_rate_fpm`'i dolu en erken örnek. Her UTC günü ayrı bir ifadedir; sonuçlar toplanır.
 * Her istasyon için bir satır döner (örneği yoksa sıfırlarla).
 */
export async function readArrivalCoverageWindowStats(
  sql: Sql,
  params: {
    stations: readonly { icao: string; lat: number; lon: number }[]
    zoneKm: number
    from: Date
    to: Date
  },
  options: ReadOnlyOptions = {},
): Promise<ArrivalCoverageWindowStatsRow[]> {
  const totals = new Map<string, ArrivalCoverageWindowStatsRow>(
    params.stations.map((s) => [
      s.icao,
      { icao: s.icao, airborneSamples: 0, baroRateNull: 0, seenPosNull: 0, firstBaroRateTs: null },
    ]),
  )
  if (params.stations.length === 0) return []
  for (const slice of utcDaySlices(params.from, params.to)) {
    const query = arrivalWindowStatsQuery(params.stations, params.zoneKm, slice.from, slice.to)
    const rows = await readOnlyTransaction(
      sql,
      (tx) =>
        tx.unsafe<
          {
            icao: string
            airborne: number
            baro_rate_null: number
            seen_pos_null: number
            first_baro_ms: number | null
          }[]
        >(query.text, query.values as never[]),
      options,
    )
    for (const r of rows) {
      const total = totals.get(r.icao)
      if (total === undefined) continue
      total.airborneSamples += r.airborne
      total.baroRateNull += r.baro_rate_null
      total.seenPosNull += r.seen_pos_null
      if (r.first_baro_ms !== null) {
        total.firstBaroRateTs =
          total.firstBaroRateTs === null
            ? r.first_baro_ms
            : Math.min(total.firstBaroRateTs, r.first_baro_ms)
      }
    }
  }
  return params.stations.map((s) => totals.get(s.icao) as ArrivalCoverageWindowStatsRow)
}

// ---------------------------------------------------------------------------------------------
// Sağlayıcı penceresi

export type ArrivalProviderStatusValue = 'ok' | 'degraded' | 'down' | 'unknown'

/** `@havayolu/shared` `ArrivalCoverageProviderHour` ile aynı biçim. */
export interface ProviderWindowHourRow {
  hour: number
  present: boolean
  requests: number
  successes: number
  rateLimited: number
  serverErrors: number
  networkErrors: number
  otherErrors: number
  freshnessP95MaxS: number | null
}

/** `@havayolu/shared` `ArrivalCoverageStatusSpan` ile aynı biçim. */
export interface ProviderStatusSpanRow {
  status: ArrivalProviderStatusValue
  from: number
  to: number
}

export interface ProviderWindowStats {
  provider: string
  hours: ProviderWindowHourRow[]
  spans: ProviderStatusSpanRow[]
}

const asSpanStatus = (value: string | null | undefined): ArrivalProviderStatusValue =>
  value === 'ok' || value === 'degraded' || value === 'down' ? value : 'unknown'

/**
 * Durum geçişlerinden [from, to) aralığının durum dilimleri. Pencere başındaki durum, başlangıçtan
 * önceki (ya da tam başlangıçtaki) son geçişin hedef durumudur; geçiş yoksa 'unknown'. Ardışık aynı
 * durumlar birleştirilir. Geçişler zamana göre sıralanır; eşit zamanda girdi sırası korunur.
 */
export function providerStatusSpans(
  prior: { status: string } | null,
  changes: readonly { at: number; status: string }[],
  from: number,
  to: number,
): ProviderStatusSpanRow[] {
  if (!(to > from)) return []
  const spans: ProviderStatusSpanRow[] = []
  let status = asSpanStatus(prior?.status)
  let cursor = from
  const sorted = changes
    .map((c, i) => ({ ...c, i }))
    .filter((c) => c.at >= from && c.at < to)
    .sort((a, b) => a.at - b.at || a.i - b.i)
  const push = (end: number) => {
    if (end <= cursor) return
    const last = spans.at(-1)
    if (last !== undefined && last.status === status && last.to === cursor) last.to = end
    else spans.push({ status, from: cursor, to: end })
    cursor = end
  }
  for (const change of sorted) {
    push(change.at)
    status = asSpanStatus(change.status)
  }
  push(to)
  return spans
}

/**
 * Sağlayıcının pencere istatistikleri.
 * - Pencereye değen her UTC saati (`generate_series`) `provider_health_hourly` ile LEFT JOIN
 *   edilir; satırı olmayan saat `present: false`'tur (ingest çalışmıyordu). Saatlik satır
 *   bölünemez: pencere saat başında başlamıyorsa ilk ve son saat pencere dışındaki dakikaları da
 *   içerir (24 saatlik pencere 25 saate değer).
 * - Durum dilimleri `provider_status_changes`'ten `[from, max(to, statusUntil))` aralığında
 *   hesaplanır. `statusUntil` pencere sonundan sonraki kesintiyi görmek içindir (pencerenin son
 *   dakikalarındaki varıştan sonraki 10 dk); durumlarda geçen süreyi çağıran pencereye kırpar.
 */
export async function readProviderWindowStats(
  sql: Sql,
  params: { provider: string; from: Date; to: Date; statusUntil?: Date },
  options: ReadOnlyOptions = {},
): Promise<ProviderWindowStats> {
  const from = params.from.getTime()
  const to = params.to.getTime()
  if (!(to > from)) return { provider: params.provider, hours: [], spans: [] }
  const statusTo = Math.max(to, params.statusUntil?.getTime() ?? to)
  const firstHour = hourStart(params.from)
  const lastHour = hourStart(new Date(to - 1))
  return readOnlyTransaction(
    sql,
    async (tx) => {
      const hours = await tx<
        {
          hour_ms: number
          present: boolean
          requests: number
          successes: number
          rate_limited: number
          server_errors: number
          network_errors: number
          other_errors: number
          freshness_p95_max_s: number | null
        }[]
      >`
        select (extract(epoch from g.hour) * 1000)::float8 as hour_ms,
          (h.provider is not null) as present,
          coalesce(h.requests, 0) as requests,
          coalesce(h.successes, 0) as successes,
          coalesce(h.rate_limited, 0) as rate_limited,
          coalesce(h.server_errors, 0) as server_errors,
          coalesce(h.network_errors, 0) as network_errors,
          coalesce(h.other_errors, 0) as other_errors,
          h.freshness_p95_max_s
        from generate_series(
          ${firstHour.toISOString()}::timestamptz,
          ${lastHour.toISOString()}::timestamptz,
          interval '1 hour'
        ) as g(hour)
        left join provider_health_hourly h on h.provider = ${params.provider} and h.hour = g.hour
        order by g.hour`
      const [prior] = await tx<{ to_status: string }[]>`
        select to_status
        from provider_status_changes
        where provider = ${params.provider} and at <= ${iso(from)}::timestamptz
        order by at desc, id desc
        limit 1`
      const changes = await tx<{ at_ms: number; to_status: string }[]>`
        select (extract(epoch from at) * 1000)::float8 as at_ms, to_status
        from provider_status_changes
        where provider = ${params.provider}
          and at > ${iso(from)}::timestamptz and at < ${iso(statusTo)}::timestamptz
        order by at, id`
      return {
        provider: params.provider,
        hours: hours.map((h) => ({
          hour: h.hour_ms,
          present: h.present,
          requests: h.requests,
          successes: h.successes,
          rateLimited: h.rate_limited,
          serverErrors: h.server_errors,
          networkErrors: h.network_errors,
          otherErrors: h.other_errors,
          freshnessP95MaxS: h.freshness_p95_max_s,
        })),
        spans: providerStatusSpans(
          prior === undefined ? null : { status: prior.to_status },
          changes.map((c) => ({ at: c.at_ms, status: c.to_status })),
          from,
          statusTo,
        ),
      }
    },
    options,
  )
}

// ---------------------------------------------------------------------------------------------
// METAR QNH

/** `@havayolu/shared` `ArrivalCoverageQnhObservation` ile aynı biçim. */
export interface MetarQnhRow {
  icao: string
  observedAt: number
  qnhHpa: number
}

export interface MetarQnhStatsRow {
  icao: string
  observations: number
  minHpa: number
  maxHpa: number
}

/** İstasyonların [from, to) aralığındaki QNH'li METAR/SPECI gözlemleri (istasyon, zaman sırası). */
export async function readMetarQnhSeries(
  sql: Sql,
  params: { icaos: readonly string[]; from: Date; to: Date },
  options: ReadOnlyOptions = {},
): Promise<MetarQnhRow[]> {
  if (params.icaos.length === 0) return []
  const rows = await readOnlyTransaction(
    sql,
    (tx) =>
      tx<{ station_icao: string; observed_ms: number; qnh_hpa: number }[]>`
        select station_icao, (extract(epoch from observed_at) * 1000)::float8 as observed_ms, qnh_hpa
        from weather_metar
        where station_icao in ${tx([...params.icaos])}
          and observed_at >= ${params.from.toISOString()}::timestamptz
          and observed_at < ${params.to.toISOString()}::timestamptz
          and qnh_hpa is not null
        order by station_icao, observed_at, report_type`,
    options,
  )
  return rows.map((r) => ({ icao: r.station_icao, observedAt: r.observed_ms, qnhHpa: r.qnh_hpa }))
}

/** İstasyon başına [from, to) aralığındaki QNH'nin en küçüğü, en büyüğü ve gözlem sayısı. */
export async function readMetarQnhStats(
  sql: Sql,
  params: { icaos: readonly string[]; from: Date; to: Date },
  options: ReadOnlyOptions = {},
): Promise<MetarQnhStatsRow[]> {
  if (params.icaos.length === 0) return []
  const rows = await readOnlyTransaction(
    sql,
    (tx) =>
      tx<{ station_icao: string; n: number; min_hpa: number; max_hpa: number }[]>`
        select station_icao, count(*)::int as n, min(qnh_hpa) as min_hpa, max(qnh_hpa) as max_hpa
        from weather_metar
        where station_icao in ${tx([...params.icaos])}
          and observed_at >= ${params.from.toISOString()}::timestamptz
          and observed_at < ${params.to.toISOString()}::timestamptz
          and qnh_hpa is not null
        group by station_icao
        order by station_icao`,
    options,
  )
  return rows.map((r) => ({
    icao: r.station_icao,
    observations: r.n,
    minHpa: r.min_hpa,
    maxHpa: r.max_hpa,
  }))
}
