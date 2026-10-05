import type postgres from 'postgres'
import type { TrackTable } from './partitions'

/**
 * Ingest'in PostgreSQL yazıcıları ve okuyucuları (Parça 1 M4, D-073). Drizzle yerine doğrudan
 * postgres-js kullanılır: toplu yazmalar (`jsonb_to_recordset`, çok satırlı insert) tek sorguda
 * gider. Saat dışarıdan verilir; `now()` yalnızca `updated_at` gibi kayıt zamanlarında kullanılır.
 *
 * `createDb` aynı istemciyi Drizzle'a da verir; Drizzle zaman ve JSON türlerinin
 * serileştiricilerini saydam yapar (Date nesnesi gönderilemez, zaman metin döner). Bu yüzden
 * zaman ISO metni + `::timestamptz` olarak gider, epoch ms (`float8`) olarak döner; JSON metin
 * olarak gider (`::text::jsonb`). Böylece fonksiyonlar iki istemci biçiminde de aynı çalışır.
 */
type Sql = postgres.Sql

/** Çok satırlı insert'te parti büyüklüğü (13 sütun × 1000 = 13.000 parametre < 65.535). */
export const TRACK_INSERT_CHUNK = 1000
/** `in (...)` listelerinde parti büyüklüğü. */
const ID_CHUNK = 5000

function chunks<T>(rows: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

/** bigint sütunlar postgres-js'te metin döner; kimlikler 2^53'ün çok altındadır. */
const toId = (value: string | number | bigint): number => Number(value)

/** Zaman parametresi (sorguda `::timestamptz` ile). */
function iso(date: Date): string
function iso(date: Date | null): string | null
function iso(date: Date | null): string | null {
  return date === null ? null : date.toISOString()
}

/** `(extract(epoch from …) * 1000)::float8` ile dönen zaman. */
function fromMs(ms: number): Date
function fromMs(ms: number | null): Date | null
function fromMs(ms: number | null): Date | null {
  return ms === null ? null : new Date(ms)
}

const LONE_SURROGATE = /[\ud800-\udfff]/gu

/**
 * Metin sütunları için sınır temizliği: PostgreSQL metinde `\u0000` kabul etmez; eşi olmayan
 * UTF-16 vekil karakteri (lone surrogate) jsonb'de hata verir, metinde bozulur. Kaynaktan gelen
 * böyle bir değer her denemede aynı hatayı verip yazmayı tıkamasın diye ikisi de atılır.
 * Temizlikten sonra boş kalan değer null yazılır (eski değeri silmez).
 */
function cleanText(value: string | null): string | null {
  if (value === null) return null
  const cleaned = value.replaceAll('\u0000', '').replace(LONE_SURROGATE, '')
  return cleaned === '' && value !== '' ? null : cleaned
}

// ---------------------------------------------------------------------------------------------
// İstasyonlar

export interface StationArp {
  icao: string
  iata: string
  isPrimary: boolean
  fetchRadiusNm: number
  lat: number
  lon: number
  elevationFt: number | null
}

/**
 * Etkin istasyonlar ve havalimanı referans noktaları (`airports.ident = stations.icao`).
 * Havalimanı satırı olmayan istasyon atlanır (referans verisi henüz içe aktarılmamış olabilir).
 * Aynı ident'e geçici olarak iki satır düşerse (D-066) en küçük kimlikli olan alınır.
 * Sıra: önce birincil, sonra ICAO.
 */
export async function activeStationsWithArp(sql: Sql): Promise<StationArp[]> {
  const rows = await sql<
    {
      icao: string
      iata: string
      is_primary: boolean
      fetch_radius_nm: number
      lat: number
      lon: number
      elevation_ft: number | null
    }[]
  >`
    select s.icao, s.iata, s.is_primary, s.fetch_radius_nm,
      a.latitude_deg as lat, a.longitude_deg as lon, a.elevation_ft
    from stations s
    join lateral (
      select latitude_deg, longitude_deg, elevation_ft
      from airports
      where ident = s.icao
      order by id
      limit 1
    ) a on true
    where s.is_active
    order by s.is_primary desc, s.icao`
  return rows.map((r) => ({
    icao: r.icao,
    iata: r.iata,
    isPrimary: r.is_primary,
    fetchRadiusNm: r.fetch_radius_nm,
    lat: r.lat,
    lon: r.lon,
    elevationFt: r.elevation_ft,
  }))
}

// ---------------------------------------------------------------------------------------------
// Uçuş kaydı

export interface NewFlight {
  hex: string
  callsign: string | null
  registration: string | null
  typeCode: string | null
  firstSeenAt: Date
  lastSeenAt: Date
}

/** Yeni `active` uçuş kaydı açar; kimliğini döndürür. Metin alanları `cleanText` ile temizlenir. */
export async function createFlight(sql: Sql, f: NewFlight): Promise<number> {
  const [row] = await sql<{ id: string }[]>`
    insert into flights (hex, callsign, registration, type_code, first_seen_at, last_seen_at)
    values (${f.hex}, ${cleanText(f.callsign)}, ${cleanText(f.registration)},
      ${cleanText(f.typeCode)},
      ${iso(f.firstSeenAt)}::timestamptz, ${iso(f.lastSeenAt)}::timestamptz)
    returning id`
  if (!row) throw new Error('flights insert returned no id')
  return toId(row.id)
}

export interface FlightTouch {
  id: number
  lastSeenAt: Date
  callsign: string | null
  registration: string | null
  typeCode: string | null
}

/**
 * Toplu güncelleme: `last_seen_at` yalnızca ileri gider (`greatest`); çağrı kodu, tescil ve tip
 * verildiyse eskisinin yerine yazılır, `null` eskisini silmez. Aynı kimlik listede birden çok
 * kez varsa en yeni `lastSeenAt`'li satır kullanılır. Metin alanları `cleanText` ile temizlenir.
 */
export async function touchFlights(sql: Sql, rows: readonly FlightTouch[]): Promise<void> {
  if (rows.length === 0) return
  const latest = new Map<number, FlightTouch>()
  for (const row of rows) {
    const prev = latest.get(row.id)
    if (!prev || row.lastSeenAt.getTime() >= prev.lastSeenAt.getTime()) latest.set(row.id, row)
  }
  for (const part of chunks([...latest.values()], ID_CHUNK)) {
    const payload = part.map((r) => ({
      id: r.id,
      last_seen_at: r.lastSeenAt.toISOString(),
      callsign: cleanText(r.callsign),
      registration: cleanText(r.registration),
      type_code: cleanText(r.typeCode),
    }))
    await sql`
      update flights f set
        last_seen_at = greatest(f.last_seen_at, v.last_seen_at),
        callsign = coalesce(v.callsign, f.callsign),
        registration = coalesce(v.registration, f.registration),
        type_code = coalesce(v.type_code, f.type_code),
        updated_at = now()
      from jsonb_to_recordset(${JSON.stringify(payload)}::text::jsonb) as v(
        id bigint, last_seen_at timestamptz, callsign text, registration text, type_code text
      )
      where f.id = v.id`
  }
}

/** Uçuş kayıtlarını kapatır (`status = 'ended'`); zaten kapalı olanlara dokunmaz. */
export async function endFlights(sql: Sql, ids: readonly number[]): Promise<void> {
  const unique = [...new Set(ids)]
  for (const part of chunks(unique, ID_CHUNK)) {
    await sql`
      update flights set status = 'ended', updated_at = now()
      where id in ${sql(part)} and status <> 'ended'`
  }
}

export interface ActiveFlightRow {
  id: number
  hex: string
  callsign: string | null
  registration: string | null
  typeCode: string | null
  firstSeenAt: Date
  lastSeenAt: Date
}

/**
 * Açılışta uçuş durumunu yükler (D-073): `since`'ten önce görülen `active` kayıtları kapatır;
 * aynı hex'in birden çok açık kaydı varsa yalnızca en yenisi (son görülme, eşitse kimlik) açık
 * kalır, diğerleri kapatılır. Kalan açık kayıtları hex sırasıyla döndürür. Tek işlemdir.
 */
export async function loadActiveFlights(sql: Sql, since: Date): Promise<ActiveFlightRow[]> {
  const rows = await sql.begin(async (tx) => {
    await tx`
      update flights set status = 'ended', updated_at = now()
      where status = 'active' and last_seen_at < ${iso(since)}::timestamptz`
    await tx`
      with ranked as (
        select id, row_number() over (partition by hex order by last_seen_at desc, id desc) as rn
        from flights
        where status = 'active'
      )
      update flights f set status = 'ended', updated_at = now()
      from ranked r
      where f.id = r.id and r.rn > 1`
    return tx<
      {
        id: string
        hex: string
        callsign: string | null
        registration: string | null
        type_code: string | null
        first_seen_ms: number
        last_seen_ms: number
      }[]
    >`
      select id, hex, callsign, registration, type_code,
        (extract(epoch from first_seen_at) * 1000)::float8 as first_seen_ms,
        (extract(epoch from last_seen_at) * 1000)::float8 as last_seen_ms
      from flights
      where status = 'active'
      order by hex`
  })
  return rows.map((r) => ({
    id: toId(r.id),
    hex: r.hex,
    callsign: r.callsign,
    registration: r.registration,
    typeCode: r.type_code,
    firstSeenAt: fromMs(r.first_seen_ms),
    lastSeenAt: fromMs(r.last_seen_ms),
  }))
}

// ---------------------------------------------------------------------------------------------
// İz noktaları

export interface TrackPointRow {
  flightId: number
  ts: Date
  lat: number
  lon: number
  altBaroFt: number | null
  altGeomFt: number | null
  gsKt: number | null
  trackDeg: number | null
  /** Görünen dikey hız: barometrik, yoksa geometrik (fpm). */
  verticalRateFpm: number | null
  onGround: boolean
  /** `trackSourceCode(sağlayıcı, konum kaynağı)` (D-073). */
  source: number
  /** Kaynağın bildirdiği ham `seen_pos` (sn); göndermediyse null (D-097). */
  seenPosS: number | null
  /** Kaynağın bildirdiği ham barometrik dikey hız (fpm); yoksa null (D-097). */
  baroRateFpm: number | null
}

const TRACK_COLUMNS = [
  'flight_id',
  'ts',
  'lat',
  'lon',
  'alt_baro_ft',
  'alt_geom_ft',
  'gs_kt',
  'track_deg',
  'vertical_rate_fpm',
  'on_ground',
  'source',
  'seen_pos_s',
  'baro_rate_fpm',
] as const

const INT4_MIN = -2_147_483_648
const INT4_MAX = 2_147_483_647

/**
 * `integer` sütunlar yuvarlanır; sonlu olmayan (NaN, ∞) ya da `integer` aralığı dışındaki değer
 * boş yazılır. Aralık dışı değer (ör. bozuk çerçevede `alt_geom: 3e9`) yazılsaydı satır her
 * denemede 22003 ile reddedilir, yazmayı tıkardı.
 */
function intOrNull(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  return rounded < INT4_MIN || rounded > INT4_MAX ? null : rounded
}

/**
 * `real` (float4) sütunlar: sonlu olmayan ya da float4'e sığmayan değer boş yazılır. Float4'te
 * sıfıra düşecek kadar küçük değer 0 yazılır; PostgreSQL alttan taşmayı da hata sayar.
 */
function realOrNull(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  const single = Math.fround(value)
  if (!Number.isFinite(single)) return null
  return single === 0 ? 0 : value
}
/** Sayaçlar: negatif olmayan tam sayı. */
const count = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0)

/**
 * Çok satırlı insert, 1000'erlik partilerle; `ON CONFLICT (flight_id, ts) DO NOTHING` sayesinde
 * aynı nokta ikinci kez yazılmaz. Eklenen satır sayısını döndürür. Günün partition'ı yoksa satır
 * DEFAULT partition'a düşer; çağıran açılışta `ensureTrackPartitions` çalıştırır. Sütun türüne
 * sığmayan irtifa, hız, yön, dikey hız ve `seen_pos` değerleri boş yazılır (`intOrNull`,
 * `realOrNull`).
 */
export async function insertTrackPoints(
  sql: Sql,
  table: TrackTable,
  rows: readonly TrackPointRow[],
): Promise<number> {
  let inserted = 0
  for (const part of chunks(rows, TRACK_INSERT_CHUNK)) {
    const values = part.map((r) => ({
      flight_id: r.flightId,
      ts: iso(r.ts),
      lat: r.lat,
      lon: r.lon,
      alt_baro_ft: intOrNull(r.altBaroFt),
      alt_geom_ft: intOrNull(r.altGeomFt),
      gs_kt: realOrNull(r.gsKt),
      track_deg: realOrNull(r.trackDeg),
      vertical_rate_fpm: intOrNull(r.verticalRateFpm),
      on_ground: r.onGround,
      source: Math.round(r.source),
      seen_pos_s: realOrNull(r.seenPosS),
      baro_rate_fpm: intOrNull(r.baroRateFpm),
    }))
    const result = await sql`
      insert into ${sql(table)} ${sql(values, TRACK_COLUMNS)}
      on conflict (flight_id, ts) do nothing`
    inserted += result.count
  }
  return inserted
}

/**
 * Açılışta yer bekleme durumunu geri kurar (D-073, "aynı yer beklemesinde ikinci kez
 * bölünmez"). Verilen her uçuşun `ts >= since` aralığındaki `track_points_sampled` satırlarına
 * bakar: en yeni satır yerdeyse, sondaki kesintisiz yer dizisinin ilk satırının zamanını (epoch
 * ms) döndürür; yani son havada satırdan sonraki en erken yer satırı. Hiç satırı olmayan ya da
 * en yeni satırı havada olan uçuş haritada yer almaz.
 */
export async function loadTrailingGroundStart(
  sql: Sql,
  flightIds: readonly number[],
  since: Date,
): Promise<Map<number, number>> {
  const out = new Map<number, number>()
  const unique = [...new Set(flightIds)]
  for (const part of chunks(unique, ID_CHUNK)) {
    const rows = await sql<{ flight_id: string; ground_since_ms: number }[]>`
      with pts as (
        select flight_id, ts, on_ground
        from track_points_sampled
        where flight_id in ${sql(part)} and ts >= ${iso(since)}::timestamptz
      ),
      last_air as (
        select flight_id, max(ts) filter (where not on_ground) as last_air_ts
        from pts
        group by flight_id
      )
      select p.flight_id, (extract(epoch from min(p.ts)) * 1000)::float8 as ground_since_ms
      from pts p
      join last_air l on l.flight_id = p.flight_id
      where p.on_ground and (l.last_air_ts is null or p.ts > l.last_air_ts)
      group by p.flight_id`
    for (const r of rows) out.set(toId(r.flight_id), r.ground_since_ms)
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Sağlayıcı sağlığı

export type ProviderStatus = 'ok' | 'degraded' | 'down'
export type CircuitState = 'closed' | 'open' | 'half_open' | 'config'
export const PROVIDER_STATUSES: readonly ProviderStatus[] = ['ok', 'degraded', 'down']
export const CIRCUIT_STATES: readonly CircuitState[] = ['closed', 'open', 'half_open', 'config']

export interface ProviderHealthSnapshot {
  provider: string
  status: ProviderStatus
  lastSuccessAt: Date | null
  lastErrorAt: Date | null
  lastError: string | null
  consecutiveFailures: number
  rps: number | null
  circuit: CircuitState
  backoffUntil: Date | null
  freshnessP95S: number | null
  errorRatio60s: number | null
  requests60s: number
}

/** Sağlayıcının anlık durumunu yazar (sağlayıcı başına tek satır, `updated_at = now()`). */
export async function writeProviderHealth(sql: Sql, s: ProviderHealthSnapshot): Promise<void> {
  await sql`
    insert into provider_health (
      provider, status, last_success_at, last_error_at, last_error, consecutive_failures,
      rps, circuit, backoff_until, freshness_p95_s, error_ratio_60s, requests_60s, updated_at
    ) values (
      ${s.provider}, ${s.status}, ${iso(s.lastSuccessAt)}::timestamptz,
      ${iso(s.lastErrorAt)}::timestamptz, ${s.lastError}, ${count(s.consecutiveFailures)},
      ${realOrNull(s.rps)}, ${s.circuit}, ${iso(s.backoffUntil)}::timestamptz,
      ${realOrNull(s.freshnessP95S)}, ${realOrNull(s.errorRatio60s)}, ${count(s.requests60s)},
      now()
    )
    on conflict (provider) do update set
      status = excluded.status,
      last_success_at = excluded.last_success_at,
      last_error_at = excluded.last_error_at,
      last_error = excluded.last_error,
      consecutive_failures = excluded.consecutive_failures,
      rps = excluded.rps,
      circuit = excluded.circuit,
      backoff_until = excluded.backoff_until,
      freshness_p95_s = excluded.freshness_p95_s,
      error_ratio_60s = excluded.error_ratio_60s,
      requests_60s = excluded.requests_60s,
      updated_at = now()`
}

/**
 * Sağlayıcının anlık durum satırını siler. Worker açılışta bu süreçte yapılandırılmamış
 * sağlayıcıların satırını kaldırır; kalsaydı admin paneli onu 180 sn sonra kalıcı "Çalışmıyor"
 * gösterirdi. Silinen satır sayısını döndürür (0 ya da 1).
 */
export async function deleteProviderHealth(sql: Sql, provider: string): Promise<number> {
  const result = await sql`delete from provider_health where provider = ${provider}`
  return result.count
}

export interface ProviderHourlyCounters {
  requests: number
  successes: number
  rateLimited: number
  serverErrors: number
  networkErrors: number
  otherErrors: number
  freshnessP95S: number | null
}

const HOUR_MS = 3_600_000

/** UTC saat başı (`date_trunc('hour', …)` ile aynı; saat dilimine bağlı değil). */
export function hourStart(at: Date): Date {
  return new Date(Math.floor(at.getTime() / HOUR_MS) * HOUR_MS)
}

/**
 * Sayaçları `at`'in saat kovasına ekler (sağlayıcı + saat başına tek satır). Tazelik için saatin
 * en kötü p95'i tutulur: `greatest(eski, yeni)`, boş değer eskisini silmez.
 */
export async function addProviderHourly(
  sql: Sql,
  provider: string,
  at: Date,
  c: ProviderHourlyCounters,
): Promise<void> {
  await sql`
    insert into provider_health_hourly (
      provider, hour, requests, successes, rate_limited, server_errors, network_errors,
      other_errors, freshness_p95_max_s, updated_at
    ) values (
      ${provider}, ${iso(hourStart(at))}::timestamptz, ${count(c.requests)}, ${count(c.successes)},
      ${count(c.rateLimited)}, ${count(c.serverErrors)}, ${count(c.networkErrors)},
      ${count(c.otherErrors)}, ${realOrNull(c.freshnessP95S)}, now()
    )
    on conflict (provider, hour) do update set
      requests = provider_health_hourly.requests + excluded.requests,
      successes = provider_health_hourly.successes + excluded.successes,
      rate_limited = provider_health_hourly.rate_limited + excluded.rate_limited,
      server_errors = provider_health_hourly.server_errors + excluded.server_errors,
      network_errors = provider_health_hourly.network_errors + excluded.network_errors,
      other_errors = provider_health_hourly.other_errors + excluded.other_errors,
      freshness_p95_max_s = greatest(
        provider_health_hourly.freshness_p95_max_s, excluded.freshness_p95_max_s
      ),
      updated_at = now()`
}

/** Durum geçişini kaydeder (ilk durumda `from` null). */
export async function recordProviderStatusChange(
  sql: Sql,
  c: {
    provider: string
    at: Date
    from: ProviderStatus | null
    to: ProviderStatus
    reason: string | null
  },
): Promise<void> {
  await sql`
    insert into provider_status_changes (provider, at, from_status, to_status, reason)
    values (${c.provider}, ${iso(c.at)}::timestamptz, ${c.from}, ${c.to}, ${c.reason})`
}

export interface ProviderSummary extends ProviderHealthSnapshot {
  updatedAt: Date
  /** Son 1 saatteki 429/420 oranı (pencere başını içeren saat kovası dahil); istek yoksa null. */
  rateLimitedRatio1h: number | null
  /** Son 24 saatteki 429/420 oranı (pencere başını içeren saat kovası dahil); istek yoksa null. */
  rateLimitedRatio24h: number | null
}

const asStatus = (value: string): ProviderStatus =>
  (PROVIDER_STATUSES as readonly string[]).includes(value) ? (value as ProviderStatus) : 'down'
const asCircuit = (value: string): CircuitState =>
  (CIRCUIT_STATES as readonly string[]).includes(value) ? (value as CircuitState) : 'closed'

/**
 * Admin Servisler paneli için bütün `provider_health` satırları (sağlayıcı sırasıyla) ve saatlik
 * sayaçlardan 429 oranları: `sum(rate_limited) / sum(requests)`. Pencere başını (`now − 1 sa`,
 * `now − 24 sa`) içeren kova da sayılır; böylece pencere her zaman en az son tam 1 saati (24
 * saati) kapsar ve saat başında o saatin kovası henüz yazılmamışken oran kaybolmaz. İstek yoksa
 * oran null'dır. Bilinmeyen durum değeri 'down', bilinmeyen devre değeri 'closed' okunur.
 */
export async function readProviderSummaries(sql: Sql, now: Date): Promise<ProviderSummary[]> {
  // Kova sınırı JS'te UTC saat başına yuvarlanır (yazarken `hourStart` ile aynı); SQL'deki
  // `date_trunc` oturum saat dilimine bağlı olurdu.
  const hourAgo = hourStart(new Date(now.getTime() - HOUR_MS))
  const dayAgo = hourStart(new Date(now.getTime() - 24 * HOUR_MS))
  const rows = await sql<
    {
      provider: string
      status: string
      last_success_ms: number | null
      last_error_ms: number | null
      last_error: string | null
      consecutive_failures: number
      rps: number | null
      circuit: string
      backoff_until_ms: number | null
      freshness_p95_s: number | null
      error_ratio_60s: number | null
      requests_60s: number
      updated_ms: number
      rate_limited_ratio_1h: number | null
      rate_limited_ratio_24h: number | null
    }[]
  >`
    select h.provider, h.status,
      (extract(epoch from h.last_success_at) * 1000)::float8 as last_success_ms,
      (extract(epoch from h.last_error_at) * 1000)::float8 as last_error_ms,
      h.last_error, h.consecutive_failures, h.rps, h.circuit,
      (extract(epoch from h.backoff_until) * 1000)::float8 as backoff_until_ms,
      h.freshness_p95_s, h.error_ratio_60s, h.requests_60s,
      (extract(epoch from h.updated_at) * 1000)::float8 as updated_ms,
      (select sum(x.rate_limited)::float8 / nullif(sum(x.requests), 0)
        from provider_health_hourly x
        where x.provider = h.provider and x.hour >= ${iso(hourAgo)}::timestamptz
      ) as rate_limited_ratio_1h,
      (select sum(x.rate_limited)::float8 / nullif(sum(x.requests), 0)
        from provider_health_hourly x
        where x.provider = h.provider and x.hour >= ${iso(dayAgo)}::timestamptz
      ) as rate_limited_ratio_24h
    from provider_health h
    order by h.provider`
  return rows.map((r) => ({
    provider: r.provider,
    status: asStatus(r.status),
    lastSuccessAt: fromMs(r.last_success_ms),
    lastErrorAt: fromMs(r.last_error_ms),
    lastError: r.last_error,
    consecutiveFailures: r.consecutive_failures,
    rps: r.rps,
    circuit: asCircuit(r.circuit),
    backoffUntil: fromMs(r.backoff_until_ms),
    freshnessP95S: r.freshness_p95_s,
    errorRatio60s: r.error_ratio_60s,
    requests60s: r.requests_60s,
    updatedAt: fromMs(r.updated_ms),
    rateLimitedRatio1h: r.rate_limited_ratio_1h,
    rateLimitedRatio24h: r.rate_limited_ratio_24h,
  }))
}
