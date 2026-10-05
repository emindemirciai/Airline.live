import type postgres from 'postgres'

/**
 * Kapsama raporu satırları ve istasyonların 7 günlük kapsama sütunları (Parça 1 M7b.2, D-098).
 *
 * Akış: API `insertQueuedArrivalCoverageReport` ile `queued` satır yazar (danışma kilidi altında,
 * eskimiş satırları kapatıp etkin rapor yoksa); worker'ın `jobs` rolü
 * `claimNextArrivalCoverageReport` ile satırı `running` yapar (FOR UPDATE SKIP LOCKED) ve
 * `finishArrivalCoverageReport` ya da `failArrivalCoverageReport` ile bitirir. Bitirme ve hata
 * yalnızca satır hâlâ `running` iken yazılır. Aynı anda tek etkin rapor olur (kilit ve tekil kısmi
 * dizin). En yeni 50 satır tutulur.
 *
 * Eskime: 15 dk'dan uzun `queued` ya da 20 dk'dan uzun `running` satır `failed` sayılır. POST ve
 * üstlenme bunu yazar; liste ve ayrıntı okumaları yazmadan aynı kuralla "etkin durum" döndürür.
 * Eskiyen satırın bitişi zaman aşımı anıdır (istenme + 15 dk ya da başlangıç + 20 dk): okuma ve
 * yazma aynı anı verir, sayfadaki süre büyümeye devam etmez.
 * Hata sütunu kısa bir koddur (`timeout_queued`, `timeout_running`) ya da worker'ın iletisidir
 * (en çok 500 karakter); arayüz kodları i18n'den çevirir.
 *
 * Saat dışarıdan verilir (`now`); zaman ISO metni + `::timestamptz` olarak gider, epoch ms olarak
 * döner.
 */
type Sql = postgres.Sql
type Tx = postgres.TransactionSql

export const ARRIVAL_COVERAGE_REPORT_STATUSES = ['queued', 'running', 'done', 'failed'] as const
export type ArrivalCoverageReportStatus = (typeof ARRIVAL_COVERAGE_REPORT_STATUSES)[number]

export const ARRIVAL_COVERAGE_REPORT_QUEUED_TIMEOUT_MS = 15 * 60_000
export const ARRIVAL_COVERAGE_REPORT_RUNNING_TIMEOUT_MS = 20 * 60_000
export const ARRIVAL_COVERAGE_REPORTS_KEEP = 50
export const ARRIVAL_COVERAGE_REPORT_ERROR_MAX = 500
/** Kuyrukta eskiyen satırın hata kodu. */
export const ARRIVAL_COVERAGE_TIMEOUT_QUEUED = 'timeout_queued'
/** Çalışırken eskiyen satırın hata kodu. */
export const ARRIVAL_COVERAGE_TIMEOUT_RUNNING = 'timeout_running'
/** Rapor ekleme danışma kilidi (`pg_advisory_xact_lock`); migrate kilidinden farklı sabit. */
export const ARRIVAL_COVERAGE_REPORT_LOCK_KEY = 684_231_917

const UNIQUE_VIOLATION = '23505'
const errorCode = (error: unknown) => (error as { code?: string } | null)?.code
const toId = (value: string | number | bigint): number => Number(value)
const iso = (date: Date) => date.toISOString()
const fromMs = (ms: number | null): Date | null => (ms === null ? null : new Date(ms))

const asStatus = (value: string): ArrivalCoverageReportStatus =>
  (ARRIVAL_COVERAGE_REPORT_STATUSES as readonly string[]).includes(value)
    ? (value as ArrivalCoverageReportStatus)
    : 'failed'

/** Hata metni: kırpılır, en çok 500 karakter (vekil çiftleri bölünmez); boşsa 'error'. */
export function arrivalCoverageErrorText(error: string): string {
  const cleaned = error.replaceAll('\u0000', '').trim()
  const chars = [...(cleaned === '' ? 'error' : cleaned)]
  return chars.length <= ARRIVAL_COVERAGE_REPORT_ERROR_MAX
    ? chars.join('')
    : chars.slice(0, ARRIVAL_COVERAGE_REPORT_ERROR_MAX).join('')
}

export interface ArrivalCoverageReportSummary {
  id: number
  /** Etkin durum: eskimiş `queued`/`running` satır `failed` görünür. */
  status: ArrivalCoverageReportStatus
  /** Tablodaki durum. */
  storedStatus: ArrivalCoverageReportStatus
  hours: number
  requestedAt: Date
  startedAt: Date | null
  /** Etkin bitiş: eskimiş ama henüz kapatılmamış satırda zaman aşımı anı. */
  finishedAt: Date | null
  windowStart: Date | null
  windowEnd: Date | null
  /** Etkin hata: eskimiş satırda zaman aşımı kodu. */
  error: string | null
  definitionVersion: number | null
}

export interface ArrivalCoverageReportDetail extends ArrivalCoverageReportSummary {
  /** `@havayolu/shared` `ArrivalCoverageResult` (JSON); bitmemiş raporda null. */
  result: unknown
  markdown: string | null
}

/** Eskime kuralı (saf): satırın `now` anındaki etkin durumu ve hatası. */
export function effectiveArrivalCoverageReport(
  row: Pick<ArrivalCoverageReportSummary, 'storedStatus' | 'requestedAt' | 'startedAt' | 'error'>,
  now: Date,
): { status: ArrivalCoverageReportStatus; error: string | null } {
  const t = now.getTime()
  if (
    row.storedStatus === 'queued' &&
    t - row.requestedAt.getTime() > ARRIVAL_COVERAGE_REPORT_QUEUED_TIMEOUT_MS
  ) {
    return { status: 'failed', error: ARRIVAL_COVERAGE_TIMEOUT_QUEUED }
  }
  if (
    row.storedStatus === 'running' &&
    t - (row.startedAt ?? row.requestedAt).getTime() > ARRIVAL_COVERAGE_REPORT_RUNNING_TIMEOUT_MS
  ) {
    return { status: 'failed', error: ARRIVAL_COVERAGE_TIMEOUT_RUNNING }
  }
  return { status: row.storedStatus, error: row.error }
}

/**
 * Etkin satırın zaman aşımı anı (saf): `queued` için istenme + 15 dk, `running` için başlangıç
 * (yoksa istenme) + 20 dk; diğer durumlarda null. Eskiyen satırın bitişi budur: kapatma
 * (`expireStaleArrivalCoverageReports`) bu anı yazar, okumalar kapatılmamış satırda bunu döndürür.
 */
export function arrivalCoverageTimeoutAt(
  row: Pick<ArrivalCoverageReportSummary, 'storedStatus' | 'requestedAt' | 'startedAt'>,
): Date | null {
  if (row.storedStatus === 'queued') {
    return new Date(row.requestedAt.getTime() + ARRIVAL_COVERAGE_REPORT_QUEUED_TIMEOUT_MS)
  }
  if (row.storedStatus === 'running') {
    return new Date(
      (row.startedAt ?? row.requestedAt).getTime() + ARRIVAL_COVERAGE_REPORT_RUNNING_TIMEOUT_MS,
    )
  }
  return null
}

interface ReportRow {
  id: string
  status: string
  hours: number
  requested_ms: number
  started_ms: number | null
  finished_ms: number | null
  window_start_ms: number | null
  window_end_ms: number | null
  error: string | null
  definition_version: number | null
}

const summaryColumns = (tx: Sql | Tx) => tx`
  id, status, hours,
  (extract(epoch from requested_at) * 1000)::float8 as requested_ms,
  (extract(epoch from started_at) * 1000)::float8 as started_ms,
  (extract(epoch from finished_at) * 1000)::float8 as finished_ms,
  (extract(epoch from window_start) * 1000)::float8 as window_start_ms,
  (extract(epoch from window_end) * 1000)::float8 as window_end_ms,
  error, definition_version`

function toSummary(r: ReportRow, now: Date): ArrivalCoverageReportSummary {
  const stored = {
    storedStatus: asStatus(r.status),
    requestedAt: new Date(r.requested_ms),
    startedAt: fromMs(r.started_ms),
    error: r.error,
  }
  const effective = effectiveArrivalCoverageReport(stored, now)
  const expired = effective.status !== stored.storedStatus
  return {
    id: toId(r.id),
    status: effective.status,
    storedStatus: stored.storedStatus,
    hours: r.hours,
    requestedAt: stored.requestedAt,
    startedAt: stored.startedAt,
    finishedAt: fromMs(r.finished_ms) ?? (expired ? arrivalCoverageTimeoutAt(stored) : null),
    windowStart: fromMs(r.window_start_ms),
    windowEnd: fromMs(r.window_end_ms),
    error: effective.error,
    definitionVersion: r.definition_version,
  }
}

/**
 * Eskimiş satırları `failed` yapar (kuyrukta > 15 dk: `timeout_queued`; çalışırken > 20 dk:
 * `timeout_running`). Bitiş zaman aşımı anıdır (`arrivalCoverageTimeoutAt`), kapatmanın anı
 * değil. Kapatılan satır sayısını döndürür.
 */
export async function expireStaleArrivalCoverageReports(sql: Sql | Tx, now: Date): Promise<number> {
  const queuedBefore = new Date(now.getTime() - ARRIVAL_COVERAGE_REPORT_QUEUED_TIMEOUT_MS)
  const runningBefore = new Date(now.getTime() - ARRIVAL_COVERAGE_REPORT_RUNNING_TIMEOUT_MS)
  const result = await sql`
    update arrival_coverage_reports set
      status = 'failed',
      finished_at = case when status = 'queued'
        then requested_at
          + ${ARRIVAL_COVERAGE_REPORT_QUEUED_TIMEOUT_MS}::float8 * interval '1 millisecond'
        else coalesce(started_at, requested_at)
          + ${ARRIVAL_COVERAGE_REPORT_RUNNING_TIMEOUT_MS}::float8 * interval '1 millisecond' end,
      error = case when status = 'queued' then ${ARRIVAL_COVERAGE_TIMEOUT_QUEUED}
        else ${ARRIVAL_COVERAGE_TIMEOUT_RUNNING} end
    where (status = 'queued' and requested_at < ${iso(queuedBefore)}::timestamptz)
      or (status = 'running'
        and coalesce(started_at, requested_at) < ${iso(runningBefore)}::timestamptz)`
  return result.count
}

/**
 * En yeni `keep` satırı tutar, eskileri siler; etkin (`queued`/`running`) satırlar silinmez.
 * Silinen satır sayısını döndürür.
 */
export async function pruneArrivalCoverageReports(
  sql: Sql | Tx,
  keep: number = ARRIVAL_COVERAGE_REPORTS_KEEP,
): Promise<number> {
  const result = await sql`
    delete from arrival_coverage_reports
    where status not in ('queued', 'running')
      and id not in (
        select id from arrival_coverage_reports order by id desc limit ${Math.max(0, Math.floor(keep))}
      )`
  return result.count
}

export type InsertArrivalCoverageReportResult =
  { queued: true; id: number } | { queued: false; activeId: number }

/**
 * Yeni rapor isteği (tek işlem): danışma kilidi, eskimiş satırları kapatma, etkin rapor
 * denetimi. Etkin rapor varsa `{ queued: false, activeId }` (API 409), yoksa `queued` satır
 * yazılır ve `{ queued: true, id }` döner (API 202). Ardından en yeni 50 satır tutulur.
 */
export async function insertQueuedArrivalCoverageReport(
  sql: Sql,
  params: { hours: number; now: Date },
): Promise<InsertArrivalCoverageReportResult> {
  try {
    return (await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(${ARRIVAL_COVERAGE_REPORT_LOCK_KEY})`
      await expireStaleArrivalCoverageReports(tx, params.now)
      const [active] = await tx<{ id: string }[]>`
        select id from arrival_coverage_reports
        where status in ('queued', 'running')
        order by id
        limit 1`
      if (active !== undefined) return { queued: false, activeId: toId(active.id) }
      const [row] = await tx<{ id: string }[]>`
        insert into arrival_coverage_reports (status, hours, requested_at)
        values ('queued', ${params.hours}, ${iso(params.now)}::timestamptz)
        returning id`
      if (row === undefined) throw new Error('arrival_coverage_reports insert returned no id')
      await pruneArrivalCoverageReports(tx)
      return { queued: true, id: toId(row.id) }
    })) as InsertArrivalCoverageReportResult
  } catch (error) {
    // Kilit dışından gelen bir yazma tekil dizine çarptıysa (beklenmez) etkin satır bildirilir.
    if (errorCode(error) !== UNIQUE_VIOLATION) throw error
    const [active] = await sql<{ id: string }[]>`
      select id from arrival_coverage_reports
      where status in ('queued', 'running')
      order by id
      limit 1`
    if (active === undefined) throw error
    return { queued: false, activeId: toId(active.id) }
  }
}

/**
 * En yeni raporlar (Markdown ve sonuç olmadan), etkin durumlarıyla; `activeId` etkin durumu
 * `queued` ya da `running` olan satırdır. Okuma yazmaz.
 */
export async function listArrivalCoverageReports(
  sql: Sql,
  params: { now: Date; limit?: number },
): Promise<{ reports: ArrivalCoverageReportSummary[]; activeId: number | null }> {
  const limit = Math.max(
    1,
    Math.min(ARRIVAL_COVERAGE_REPORTS_KEEP, params.limit ?? ARRIVAL_COVERAGE_REPORTS_KEEP),
  )
  const rows = await sql<ReportRow[]>`
    select ${summaryColumns(sql)}
    from arrival_coverage_reports
    order by id desc
    limit ${limit}`
  const reports = rows.map((r) => toSummary(r, params.now))
  const active = reports.find((r) => r.status === 'queued' || r.status === 'running')
  return { reports, activeId: active?.id ?? null }
}

/** Tek rapor, sonucu ve Markdown'ıyla; yoksa null. Okuma yazmaz. */
export async function getArrivalCoverageReport(
  sql: Sql,
  id: number,
  now: Date,
): Promise<ArrivalCoverageReportDetail | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null
  const [row] = await sql<(ReportRow & { result_json: string | null; markdown: string | null })[]>`
    select ${summaryColumns(sql)}, result::text as result_json, markdown
    from arrival_coverage_reports
    where id = ${id}`
  if (row === undefined) return null
  return {
    ...toSummary(row, now),
    result: row.result_json === null ? null : (JSON.parse(row.result_json) as unknown),
    markdown: row.markdown,
  }
}

export interface ClaimedArrivalCoverageReport {
  id: number
  hours: number
  requestedAt: Date
  /** İşin başlangıcı (`now`). */
  startedAt: Date
  /** `startedAt − settleMs − hours`. */
  windowStart: Date
  /** `startedAt − settleMs`. */
  windowEnd: Date
  definitionVersion: number
}

/**
 * Sıradaki `queued` satırı üstlenir (tek işlem): önce eskimiş satırları kapatır, sonra en eski
 * kuyruktaki satırı `FOR UPDATE SKIP LOCKED` ile seçip `running` yapar; başlangıç, pencere ve tanım
 * sürümünü yazar. Kuyrukta satır yoksa null.
 */
export async function claimNextArrivalCoverageReport(
  sql: Sql,
  params: { now: Date; settleMs: number; definitionVersion: number },
): Promise<ClaimedArrivalCoverageReport | null> {
  const windowEnd = new Date(params.now.getTime() - params.settleMs)
  const row = await sql.begin(async (tx) => {
    await expireStaleArrivalCoverageReports(tx, params.now)
    const [claimed] = await tx<
      {
        id: string
        hours: number
        requested_ms: number
        started_ms: number
        window_start_ms: number
        window_end_ms: number
        definition_version: number
      }[]
    >`
      update arrival_coverage_reports set
        status = 'running',
        started_at = ${iso(params.now)}::timestamptz,
        window_end = ${iso(windowEnd)}::timestamptz,
        window_start = ${iso(windowEnd)}::timestamptz - hours * interval '1 hour',
        definition_version = ${params.definitionVersion}
      where id = (
        select id from arrival_coverage_reports
        where status = 'queued'
        order by id
        limit 1
        for update skip locked
      )
      returning id, hours, definition_version,
        (extract(epoch from requested_at) * 1000)::float8 as requested_ms,
        (extract(epoch from started_at) * 1000)::float8 as started_ms,
        (extract(epoch from window_start) * 1000)::float8 as window_start_ms,
        (extract(epoch from window_end) * 1000)::float8 as window_end_ms`
    return claimed ?? null
  })
  if (row === null) return null
  return {
    id: toId(row.id),
    hours: row.hours,
    requestedAt: new Date(row.requested_ms),
    startedAt: new Date(row.started_ms),
    windowStart: new Date(row.window_start_ms),
    windowEnd: new Date(row.window_end_ms),
    definitionVersion: row.definition_version,
  }
}

/**
 * Raporu bitirir (`done`, sonuç ve Markdown); yalnızca satır hâlâ `running` iken. Yazıldıysa
 * true döner, ardından en yeni 50 satır tutulur.
 */
export async function finishArrivalCoverageReport(
  sql: Sql,
  params: { id: number; now: Date; result: unknown; markdown: string },
): Promise<boolean> {
  const result = await sql`
    update arrival_coverage_reports set
      status = 'done',
      finished_at = ${iso(params.now)}::timestamptz,
      result = ${JSON.stringify(params.result)}::text::jsonb,
      markdown = ${params.markdown},
      error = null
    where id = ${params.id} and status = 'running'`
  if (result.count === 0) return false
  await pruneArrivalCoverageReports(sql)
  return true
}

/**
 * Raporu `failed` yapar (hata en çok 500 karakter); yalnızca satır hâlâ `running` iken. Yazıldıysa
 * true döner, ardından en yeni 50 satır tutulur.
 */
export async function failArrivalCoverageReport(
  sql: Sql,
  params: { id: number; now: Date; error: string },
): Promise<boolean> {
  const result = await sql`
    update arrival_coverage_reports set
      status = 'failed',
      finished_at = ${iso(params.now)}::timestamptz,
      error = ${arrivalCoverageErrorText(params.error)}
    where id = ${params.id} and status = 'running'`
  if (result.count === 0) return false
  await pruneArrivalCoverageReports(sql)
  return true
}

// ---------------------------------------------------------------------------------------------
// İstasyonların 7 günlük kapsaması

export interface StationArrivalCoverage7d {
  icao: string
  iata: string
  isActive: boolean
  isPrimary: boolean
  /** Yerde örneği görülen varış / varış; varış yoksa ya da iş çalışmadıysa null. */
  ratio7d: number | null
  arrivals7d: number | null
  updatedAt: Date | null
}

/** Bütün istasyonların 7 günlük kapsama sütunları; önce birincil, sonra ICAO. */
export async function readStationArrivalCoverage7d(sql: Sql): Promise<StationArrivalCoverage7d[]> {
  const rows = await sql<
    {
      icao: string
      iata: string
      is_active: boolean
      is_primary: boolean
      ratio: number | null
      arrivals: number | null
      updated_ms: number | null
    }[]
  >`
    select icao, iata, is_active, is_primary,
      coverage_ground_ratio_7d as ratio, coverage_arrivals_7d as arrivals,
      (extract(epoch from coverage_updated_at) * 1000)::float8 as updated_ms
    from stations
    order by is_primary desc, icao`
  return rows.map((r) => ({
    icao: r.icao,
    iata: r.iata,
    isActive: r.is_active,
    isPrimary: r.is_primary,
    ratio7d: r.ratio,
    arrivals7d: r.arrivals,
    updatedAt: fromMs(r.updated_ms),
  }))
}

export interface StationArrivalCoverage7dWrite {
  icao: string
  arrivals: number
  groundSeen: number
}

/**
 * Günlük işin sonucu: her satır için `coverage_ground_ratio_7d = groundSeen / arrivals` (varış
 * yoksa null), `coverage_arrivals_7d` ve `coverage_updated_at = now`. Güncellenen satır sayısını
 * döndürür (bilinmeyen ICAO atlanır).
 */
export async function writeStationArrivalCoverage7d(
  sql: Sql,
  rows: readonly StationArrivalCoverage7dWrite[],
  now: Date,
): Promise<number> {
  if (rows.length === 0) return 0
  const payload = rows.map((r) => {
    const arrivals = Math.max(0, Math.round(r.arrivals))
    const ground = Math.min(arrivals, Math.max(0, Math.round(r.groundSeen)))
    return { icao: r.icao, arrivals, ratio: arrivals === 0 ? null : ground / arrivals }
  })
  const result = await sql`
    update stations s set
      coverage_ground_ratio_7d = v.ratio,
      coverage_arrivals_7d = v.arrivals,
      coverage_updated_at = ${iso(now)}::timestamptz,
      updated_at = now()
    from jsonb_to_recordset(${JSON.stringify(payload)}::text::jsonb) as v(
      icao text, arrivals int, ratio float8
    )
    where s.icao = v.icao`
  return result.count
}
