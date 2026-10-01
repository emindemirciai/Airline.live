import type postgres from 'postgres'

/**
 * Hava durumu kaydı (D-078): METAR/SPECI ve TAF ham metinleri, zamanları ve kaynak durumu.
 * - Her farklı rapor saklanır (geçmiş listesi); METAR `(station_icao, observed_at, report_type)`,
 *   TAF `(station_icao, issued_at)` anahtarıyla. Aynı anahtarla gelen düzeltilmiş rapor (COR)
 *   metnin yerine geçer; değişmeyen satır yeniden yazılmaz.
 * - Saklama 30 gündür (`pruneWeather`, günlük iş); listeden çıkan istasyonun satırları silinir.
 * - Kod çözme okurken yapılır (API); burada yalnızca ham metin ve zamanlar vardır.
 *
 * ingest.ts ile aynı kural: doğrudan postgres-js, zaman ISO metni + `::timestamptz` olarak gider,
 * epoch ms (`float8`) olarak döner (createDb'nin Drizzle istemcisiyle de aynı çalışır).
 */
type Sql = postgres.Sql

/** Ham raporların saklama süresi (gün). */
export const WEATHER_RETENTION_DAYS = 30
/** Admin paneli: bundan yeni gözlemi olan istasyon "güncel" sayılır. */
export const WEATHER_RECENT_OBSERVATION_MS = 3 * 3_600_000
/** Çok satırlı insert'te parti büyüklüğü (7 sütun × 500 = 3.500 parametre). */
const WEATHER_INSERT_CHUNK = 500

export const WEATHER_KINDS = ['metar', 'taf'] as const
export type WeatherKind = (typeof WEATHER_KINDS)[number]
export type WeatherOrigin = 'remote' | 'fixture' | 'disabled'
/** Engelin nedeni: 429 hız sınırı ya da 403 erişim engeli. */
export type WeatherBlockKind = 'rate_limit' | 'forbidden'
export type WeatherReportType = 'METAR' | 'SPECI'

const DAY_MS = 86_400_000

function chunks<T>(rows: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

const iso = (date: Date): string => date.toISOString()
const fromMs = (ms: number | null): Date | null => (ms === null ? null : new Date(ms))

/** `real` sütunu için: sonlu değilse boş. */
const realOrNull = (value: number | null): number | null =>
  value === null || !Number.isFinite(value) ? null : value

// ---------------------------------------------------------------------------------------------
// Yazma

/** Worker'ın yazdığı METAR/SPECI. */
export interface MetarWrite {
  stationIcao: string
  reportType: WeatherReportType
  observedAt: Date
  rawText: string
  /** Ham metindeki `Qdddd` (hPa); yoksa null. */
  qnhHpa: number | null
  flightCategory: string | null
}

export interface TafWrite {
  stationIcao: string
  issuedAt: Date
  validFrom: Date
  validTo: Date
  rawText: string
}

export interface WeatherUpsertCounts {
  inserted: number
  /** Aynı anahtarla farklı metin (düzeltilmiş rapor) ya da geçerlilik. */
  updated: number
  unchanged: number
}

/** Ham metinde `COR` sözcüğü: düzeltilmiş rapor. */
const isCorrection = (raw: string) => /(^| )COR( |$)/.test(raw)

/**
 * Aynı anahtarlı satırlardan biri kalır (tek insert'te aynı satır iki kez güncellenemez):
 * düzeltilmiş rapor (COR) olan, ikisi de aynıysa listede sonra gelen.
 */
function dedupe<T extends { rawText: string }>(rows: readonly T[], keyOf: (row: T) => string): T[] {
  const byKey = new Map<string, T>()
  for (const row of rows) {
    const key = keyOf(row)
    const previous = byKey.get(key)
    if (previous && isCorrection(previous.rawText) && !isCorrection(row.rawText)) continue
    byKey.set(key, row)
  }
  return [...byKey.values()]
}

export const dedupeMetars = (rows: readonly MetarWrite[]): MetarWrite[] =>
  dedupe(rows, (r) => `${r.stationIcao}|${r.observedAt.getTime()}|${r.reportType}`)

export const dedupeTafs = (rows: readonly TafWrite[]): TafWrite[] =>
  dedupe(rows, (r) => `${r.stationIcao}|${r.issuedAt.getTime()}`)

const METAR_COLUMNS = [
  'station_icao',
  'report_type',
  'observed_at',
  'raw_text',
  'qnh_hpa',
  'flight_category',
  'fetched_at',
] as const

const TAF_COLUMNS = [
  'station_icao',
  'issued_at',
  'valid_from',
  'valid_to',
  'raw_text',
  'fetched_at',
] as const

function countWritten(rows: readonly { inserted: boolean }[], total: number): WeatherUpsertCounts {
  const inserted = rows.filter((r) => r.inserted).length
  const updated = rows.length - inserted
  return { inserted, updated, unchanged: total - inserted - updated }
}

/**
 * METAR/SPECI ekler. Aynı anahtarlı satır yalnızca ham metin değiştiyse (COR) güncellenir;
 * `fetched_at` ve `updated_at` o zaman yenilenir.
 */
export async function upsertMetars(
  sql: Sql,
  rows: readonly MetarWrite[],
  fetchedAt: Date,
): Promise<WeatherUpsertCounts> {
  const unique = dedupeMetars(rows)
  const written: { inserted: boolean }[] = []
  for (const part of chunks(unique, WEATHER_INSERT_CHUNK)) {
    const values = part.map((r) => ({
      station_icao: r.stationIcao,
      report_type: r.reportType,
      observed_at: iso(r.observedAt),
      raw_text: r.rawText,
      qnh_hpa: realOrNull(r.qnhHpa),
      flight_category: r.flightCategory,
      fetched_at: iso(fetchedAt),
    }))
    // PostgreSQL 18: RETURNING old.* eklemede NULL'dur; metni aynı olan satır WHERE ile atlanır.
    written.push(
      ...(await sql<{ inserted: boolean }[]>`
        insert into weather_metar ${sql(values, METAR_COLUMNS)}
        on conflict (station_icao, observed_at, report_type) do update set
          raw_text = excluded.raw_text,
          qnh_hpa = excluded.qnh_hpa,
          flight_category = excluded.flight_category,
          fetched_at = excluded.fetched_at,
          updated_at = now()
        where weather_metar.raw_text is distinct from excluded.raw_text
        returning (old.id is null) as inserted`),
    )
  }
  return countWritten(written, unique.length)
}

/** TAF ekler; aynı yayın zamanlı satır ham metin ya da geçerlilik değiştiyse güncellenir. */
export async function upsertTafs(
  sql: Sql,
  rows: readonly TafWrite[],
  fetchedAt: Date,
): Promise<WeatherUpsertCounts> {
  const unique = dedupeTafs(rows)
  const written: { inserted: boolean }[] = []
  for (const part of chunks(unique, WEATHER_INSERT_CHUNK)) {
    const values = part.map((r) => ({
      station_icao: r.stationIcao,
      issued_at: iso(r.issuedAt),
      valid_from: iso(r.validFrom),
      valid_to: iso(r.validTo),
      raw_text: r.rawText,
      fetched_at: iso(fetchedAt),
    }))
    written.push(
      ...(await sql<{ inserted: boolean }[]>`
        insert into weather_taf ${sql(values, TAF_COLUMNS)}
        on conflict (station_icao, issued_at) do update set
          raw_text = excluded.raw_text,
          valid_from = excluded.valid_from,
          valid_to = excluded.valid_to,
          fetched_at = excluded.fetched_at,
          updated_at = now()
        where weather_taf.raw_text is distinct from excluded.raw_text
          or weather_taf.valid_from is distinct from excluded.valid_from
          or weather_taf.valid_to is distinct from excluded.valid_to
        returning (old.id is null) as inserted`),
    )
  }
  return countWritten(written, unique.length)
}

/**
 * Yalnızca fixture modu (dev/test, D-078): verilen istasyonların `keep` listesinde olmayan METAR
 * satırlarını siler. Fixture zamanları her saat kaydırıldığından, silinmeseydi her saat aynı
 * raporların kaydırılmış kopyaları birikirdi; böylece tablo fixture'ın kaydırılmış hâlinin aynısı
 * olur. Silinen satır sayısını döndürür. Uzak kaynakta (aviationweather.gov) kullanılmaz.
 */
export async function retainMetars(
  sql: Sql,
  stations: readonly string[],
  keep: readonly MetarWrite[],
): Promise<number> {
  const list = stationList(stations)
  if (list.length === 0) return 0
  const keys = keep.map((r) => ({
    station_icao: r.stationIcao,
    observed_at: iso(r.observedAt),
    report_type: r.reportType,
  }))
  const result = await sql`
    delete from weather_metar m
    where m.station_icao in ${sql(list)}
      and not exists (
        select 1
        from jsonb_to_recordset(${JSON.stringify(keys)}::text::jsonb)
          as k(station_icao text, observed_at timestamptz, report_type text)
        where k.station_icao = m.station_icao
          and k.observed_at = m.observed_at
          and k.report_type = m.report_type
      )`
  return result.count
}

/** `retainMetars`'ın TAF karşılığı (anahtar istasyon ve yayın zamanı); yalnızca fixture modu. */
export async function retainTafs(
  sql: Sql,
  stations: readonly string[],
  keep: readonly TafWrite[],
): Promise<number> {
  const list = stationList(stations)
  if (list.length === 0) return 0
  const keys = keep.map((r) => ({ station_icao: r.stationIcao, issued_at: iso(r.issuedAt) }))
  const result = await sql`
    delete from weather_taf t
    where t.station_icao in ${sql(list)}
      and not exists (
        select 1
        from jsonb_to_recordset(${JSON.stringify(keys)}::text::jsonb)
          as k(station_icao text, issued_at timestamptz)
        where k.station_icao = t.station_icao and k.issued_at = t.issued_at
      )`
  return result.count
}

export interface WeatherPruneResult {
  /** Saklama süresi dolan METAR/SPECI satırları. */
  metar: number
  /** Geçerliliği saklama süresinden önce biten TAF satırları. */
  taf: number
  /** Listede olmayan istasyonların satırları (iki tablo birlikte). */
  unlisted: number
}

/**
 * Saklama: gözlemi `now − retentionDays`'den eski METAR'lar, geçerliliği o andan önce biten
 * TAF'lar silinir. `stations` verilir ve boş değilse listede olmayan istasyonların satırları da
 * silinir; boş liste hiçbir istasyonu silmez (referans verisi henüz içe aktarılmamış olabilir).
 */
export async function pruneWeather(
  sql: Sql,
  {
    now,
    stations,
    retentionDays = WEATHER_RETENTION_DAYS,
  }: { now: Date; stations: readonly string[] | null; retentionDays?: number },
): Promise<WeatherPruneResult> {
  const cutoff = iso(new Date(now.getTime() - retentionDays * DAY_MS))
  return sql.begin(async (tx) => {
    const metar = await tx`delete from weather_metar where observed_at < ${cutoff}::timestamptz`
    const taf = await tx`delete from weather_taf where valid_to < ${cutoff}::timestamptz`
    let unlisted = 0
    const listed = [...new Set(stations ?? [])]
    if (listed.length > 0) {
      const m = await tx`delete from weather_metar where station_icao not in ${tx(listed)}`
      const t = await tx`delete from weather_taf where station_icao not in ${tx(listed)}`
      unlisted = m.count + t.count
    }
    return { metar: metar.count, taf: taf.count, unlisted }
  })
}

// ---------------------------------------------------------------------------------------------
// Kaynak durumu

export interface WeatherSourceState {
  kind: WeatherKind
  origin: WeatherOrigin
  disabledReason: string | null
  /** Son başarılı kontrol (204 dahil). */
  checkedAt: Date | null
  stationCount: number | null
  reportCount: number | null
  skippedCount: number | null
  lastError: string | null
  lastErrorAt: Date | null
  blockedUntil: Date | null
  blockedKind: WeatherBlockKind | null
  updatedAt: Date
}

interface SourceRow {
  kind: string
  origin: string
  disabled_reason: string | null
  checked_ms: number | null
  station_count: number | null
  report_count: number | null
  skipped_count: number | null
  last_error: string | null
  last_error_ms: number | null
  blocked_until_ms: number | null
  blocked_kind: string | null
  updated_ms: number
}

const asOrigin = (value: string): WeatherOrigin =>
  value === 'remote' || value === 'fixture' ? value : 'disabled'
const asBlockKind = (value: string | null): WeatherBlockKind | null =>
  value === 'rate_limit' || value === 'forbidden' ? value : null

function toSourceState(r: SourceRow): WeatherSourceState {
  return {
    kind: r.kind === 'taf' ? 'taf' : 'metar',
    origin: asOrigin(r.origin),
    disabledReason: r.disabled_reason,
    checkedAt: fromMs(r.checked_ms),
    stationCount: r.station_count,
    reportCount: r.report_count,
    skippedCount: r.skipped_count,
    lastError: r.last_error,
    lastErrorAt: fromMs(r.last_error_ms),
    blockedUntil: fromMs(r.blocked_until_ms),
    blockedKind: asBlockKind(r.blocked_kind),
    updatedAt: new Date(r.updated_ms),
  }
}

async function readSources(sql: Sql, kinds: readonly WeatherKind[]): Promise<WeatherSourceState[]> {
  const rows = await sql<SourceRow[]>`
    select kind, origin, disabled_reason,
      (extract(epoch from checked_at) * 1000)::float8 as checked_ms,
      station_count, report_count, skipped_count, last_error,
      (extract(epoch from last_error_at) * 1000)::float8 as last_error_ms,
      (extract(epoch from blocked_until) * 1000)::float8 as blocked_until_ms,
      blocked_kind,
      (extract(epoch from updated_at) * 1000)::float8 as updated_ms
    from weather_sources
    where kind in ${sql([...kinds])}
    order by kind`
  return rows.map(toSourceState)
}

export async function getWeatherSource(
  sql: Sql,
  kind: WeatherKind,
): Promise<WeatherSourceState | null> {
  const [row] = await readSources(sql, [kind])
  return row ?? null
}

export interface WeatherCheck {
  origin: Exclude<WeatherOrigin, 'disabled'>
  now: Date
  stationCount: number
  reportCount: number
  skippedCount: number
}

/** Başarılı kontrol (204 dahil): önceki hata, engel ve kapalılık nedeni temizlenir. */
export async function recordWeatherCheck(
  sql: Sql,
  kind: WeatherKind,
  check: WeatherCheck,
): Promise<void> {
  await sql`
    insert into weather_sources (
      kind, origin, disabled_reason, checked_at, station_count, report_count, skipped_count,
      last_error, last_error_at, blocked_until, blocked_kind, updated_at
    ) values (
      ${kind}, ${check.origin}, null, ${iso(check.now)}::timestamptz,
      ${Math.max(0, Math.round(check.stationCount))}, ${Math.max(0, Math.round(check.reportCount))},
      ${Math.max(0, Math.round(check.skippedCount))}, null, null, null, null, now()
    )
    on conflict (kind) do update set
      origin = excluded.origin,
      disabled_reason = null,
      checked_at = excluded.checked_at,
      station_count = excluded.station_count,
      report_count = excluded.report_count,
      skipped_count = excluded.skipped_count,
      last_error = null,
      last_error_at = null,
      blocked_until = null,
      blocked_kind = null,
      updated_at = now()`
}

export interface WeatherFailure {
  origin: Exclude<WeatherOrigin, 'disabled'>
  now: Date
  error: string
  /** 429/403 sonrası bekleme; verilmezse mevcut engel olduğu gibi kalır. */
  block?: { until: Date; kind: WeatherBlockKind }
}

/** Başarısız kontrol; son başarılı kontrolün zamanı ve sayıları korunur. */
export async function recordWeatherError(
  sql: Sql,
  kind: WeatherKind,
  failure: WeatherFailure,
): Promise<void> {
  const error = failure.error.slice(0, 500)
  const blockedUntil = failure.block ? iso(failure.block.until) : null
  const blockedKind = failure.block?.kind ?? null
  await sql`
    insert into weather_sources (
      kind, origin, last_error, last_error_at, blocked_until, blocked_kind, updated_at
    ) values (
      ${kind}, ${failure.origin}, ${error}, ${iso(failure.now)}::timestamptz,
      ${blockedUntil}::timestamptz, ${blockedKind}, now()
    )
    on conflict (kind) do update set
      origin = excluded.origin,
      disabled_reason = null,
      last_error = excluded.last_error,
      last_error_at = excluded.last_error_at,
      blocked_until = coalesce(excluded.blocked_until, weather_sources.blocked_until),
      blocked_kind = coalesce(excluded.blocked_kind, weather_sources.blocked_kind),
      updated_at = now()`
}

/**
 * Kaynak kapalı (ör. üretim imajında EXTERNAL_PROVIDERS_DISABLED=true ya da lisans kaydı izin
 * vermiyor). Admin satırı "yapılandırılmamış" gösterir; önceki kontrol bilgisi korunur.
 */
export async function recordWeatherDisabled(
  sql: Sql,
  kind: WeatherKind,
  { reason }: { reason: string },
): Promise<void> {
  const text = reason.slice(0, 500)
  await sql`
    insert into weather_sources (kind, origin, disabled_reason, updated_at)
    values (${kind}, 'disabled', ${text}, now())
    on conflict (kind) do update set
      origin = 'disabled',
      disabled_reason = excluded.disabled_reason,
      updated_at = now()`
}

// ---------------------------------------------------------------------------------------------
// Okuma (API)

/** `weather_metar` satırı; API okurken çözümler. */
export interface WeatherMetarRecord {
  stationIcao: string
  reportType: WeatherReportType
  observedAt: Date
  rawText: string
  qnhHpa: number | null
  flightCategory: string | null
  fetchedAt: Date
}

export interface WeatherTafRecord {
  stationIcao: string
  issuedAt: Date
  validFrom: Date
  validTo: Date
  rawText: string
  fetchedAt: Date
}

/** Bir okumanın raporları: METAR/SPECI gözlem, TAF yayın zamanına göre en yeni önce. */
export interface WeatherRecordSet {
  metars: WeatherMetarRecord[]
  tafs: WeatherTafRecord[]
}

interface MetarRow {
  station_icao: string
  report_type: string
  observed_ms: number
  raw_text: string
  qnh_hpa: number | null
  flight_category: string | null
  fetched_ms: number
}

interface TafRow {
  station_icao: string
  issued_ms: number
  valid_from_ms: number
  valid_to_ms: number
  raw_text: string
  fetched_ms: number
}

const toMetar = (r: MetarRow): WeatherMetarRecord => ({
  stationIcao: r.station_icao,
  reportType: r.report_type === 'SPECI' ? 'SPECI' : 'METAR',
  observedAt: new Date(r.observed_ms),
  rawText: r.raw_text,
  qnhHpa: r.qnh_hpa,
  flightCategory: r.flight_category,
  fetchedAt: new Date(r.fetched_ms),
})

const toTaf = (r: TafRow): WeatherTafRecord => ({
  stationIcao: r.station_icao,
  issuedAt: new Date(r.issued_ms),
  validFrom: new Date(r.valid_from_ms),
  validTo: new Date(r.valid_to_ms),
  rawText: r.raw_text,
  fetchedAt: new Date(r.fetched_ms),
})

const STATION_ID = /^[A-Z0-9]{4}$/

/**
 * PostgreSQL dizi metni (`{LTFM,LTBA}`). Yalnızca `stationList`'ten geçmiş kodlarla kullanılır
 * (dört büyük harf ya da rakam: tırnak ya da kaçış gerekmez). `sql.array` yerine: postgres.js
 * bağlantının ilk sorgusunda dizi türünü henüz bilmediğinde diziyi düz metne çevirir.
 */
const textArray = (codes: readonly string[]) => `{${codes.join(',')}}`

/** Sorguya yalnızca geçerli, tekil istasyon kodları gider. */
const stationList = (icaos: readonly string[]) =>
  [...new Set(icaos.map((icao) => icao.trim().toUpperCase()))].filter((icao) =>
    STATION_ID.test(icao),
  )

/**
 * Güncel hava: her istasyonun en yeni METAR/SPECI'si (raporu olmayan istasyon listede yer almaz)
 * ve geçerliliği bitmemiş (`valid_to > now`) bütün TAF'ları, yayın zamanına göre en yeni önce.
 */
export async function listLatestWeather(
  sql: Sql,
  icaos: readonly string[],
  now: Date,
): Promise<WeatherRecordSet> {
  const stations = stationList(icaos)
  if (stations.length === 0) return { metars: [], tafs: [] }
  const [metars, tafs] = await Promise.all([
    // İstasyon başına dizinden tek satır (LATERAL + LIMIT 1): tablo 30 günlük kayıt tutar,
    // `DISTINCT ON` bütün geçmişi okurdu. Sıra dizinle aynıdır; aynı anda SPECI önce.
    sql<MetarRow[]>`
      select m.station_icao, m.report_type,
        (extract(epoch from m.observed_at) * 1000)::float8 as observed_ms,
        m.raw_text, m.qnh_hpa, m.flight_category,
        (extract(epoch from m.fetched_at) * 1000)::float8 as fetched_ms
      from unnest(${textArray(stations)}::text[]) as s(icao)
      cross join lateral (
        select station_icao, report_type, observed_at, raw_text, qnh_hpa, flight_category,
          fetched_at
        from weather_metar
        where station_icao = s.icao
        order by observed_at desc, report_type desc
        limit 1
      ) m
      order by m.station_icao`,
    sql<TafRow[]>`
      select station_icao,
        (extract(epoch from issued_at) * 1000)::float8 as issued_ms,
        (extract(epoch from valid_from) * 1000)::float8 as valid_from_ms,
        (extract(epoch from valid_to) * 1000)::float8 as valid_to_ms,
        raw_text,
        (extract(epoch from fetched_at) * 1000)::float8 as fetched_ms
      from weather_taf
      where station_icao in ${sql(stations)} and valid_to > ${iso(now)}::timestamptz
      order by station_icao, issued_at desc`,
  ])
  return { metars: metars.map(toMetar), tafs: tafs.map(toTaf) }
}

/**
 * Bir istasyonun `[from, to]` aralığındaki raporları (geçmiş listesi): METAR/SPECI gözlem,
 * TAF yayın zamanına göre; ikisi de en yeni önce.
 */
export async function listWeatherHistory(
  sql: Sql,
  icao: string,
  from: Date,
  to: Date,
): Promise<WeatherRecordSet> {
  const [station] = stationList([icao])
  if (!station || to.getTime() < from.getTime()) return { metars: [], tafs: [] }
  const [metars, tafs] = await Promise.all([
    sql<MetarRow[]>`
      select station_icao, report_type,
        (extract(epoch from observed_at) * 1000)::float8 as observed_ms,
        raw_text, qnh_hpa, flight_category,
        (extract(epoch from fetched_at) * 1000)::float8 as fetched_ms
      from weather_metar
      where station_icao = ${station}
        and observed_at >= ${iso(from)}::timestamptz and observed_at <= ${iso(to)}::timestamptz
      order by observed_at desc, report_type desc`,
    sql<TafRow[]>`
      select station_icao,
        (extract(epoch from issued_at) * 1000)::float8 as issued_ms,
        (extract(epoch from valid_from) * 1000)::float8 as valid_from_ms,
        (extract(epoch from valid_to) * 1000)::float8 as valid_to_ms,
        raw_text,
        (extract(epoch from fetched_at) * 1000)::float8 as fetched_ms
      from weather_taf
      where station_icao = ${station}
        and issued_at >= ${iso(from)}::timestamptz and issued_at <= ${iso(to)}::timestamptz
      order by issued_at desc`,
  ])
  return { metars: metars.map(toMetar), tafs: tafs.map(toTaf) }
}

// ---------------------------------------------------------------------------------------------
// Admin

export interface WeatherStatus {
  metar: WeatherSourceState | null
  taf: WeatherSourceState | null
  /** Son 3 saatte gözlemi olan istasyon sayısı. */
  stationsWithRecentMetar: number
  /** En yeni gözlem zamanı; hiç rapor yoksa null. */
  newestObservedAt: Date | null
  /** Geçerli (`valid_to > now`) TAF'ı olan istasyon sayısı. */
  stationsWithValidTaf: number
}

/** Admin Servisler paneli için kaynak durumları ve tazelik sayıları. */
export async function weatherStatus(
  sql: Sql,
  now: Date,
  recentMs: number = WEATHER_RECENT_OBSERVATION_MS,
): Promise<WeatherStatus> {
  const since = iso(new Date(now.getTime() - recentMs))
  const [sources, [metar], [taf]] = await Promise.all([
    readSources(sql, WEATHER_KINDS),
    sql<{ recent: number; newest_ms: number | null }[]>`
      select
        count(distinct station_icao) filter (where observed_at >= ${since}::timestamptz)::int
          as recent,
        (extract(epoch from max(observed_at)) * 1000)::float8 as newest_ms
      from weather_metar`,
    sql<{ stations: number }[]>`
      select count(distinct station_icao)::int as stations
      from weather_taf
      where valid_to > ${iso(now)}::timestamptz`,
  ])
  return {
    metar: sources.find((s) => s.kind === 'metar') ?? null,
    taf: sources.find((s) => s.kind === 'taf') ?? null,
    stationsWithRecentMetar: metar?.recent ?? 0,
    newestObservedAt: fromMs(metar?.newest_ms ?? null),
    stationsWithValidTaf: taf?.stations ?? 0,
  }
}
