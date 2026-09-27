import type postgres from 'postgres'

/**
 * İz tablolarının günlük partition bakımı (docs/spec/infra.md → Migration):
 * - Partition'lar dünden başlayıp `daysAhead` gün ilerisine kadar açılır (migrate ve günlük iş).
 * - Açılacak güne ait satır DEFAULT partition'a düşmüşse (iş günlerce çalışmadıysa ya da ileri
 *   tarihli bir örnek geldiyse) satırlar aynı işlemde yeni partition'a taşınır; aksi hâlde
 *   PostgreSQL partition'ı açmaz (23514) ve bakım kalıcı olarak takılırdı.
 * - Saklama süresi dolan partition'lar `lock_timeout=5s` ile DETACH (CONCURRENTLY olmadan, çünkü
 *   DEFAULT partition var) + DROP edilir.
 * - Kilit alınamazsa (55P03) gecikmeli yeniden denenir; açma ve silme aynı kuralla çalışır.
 * - DEFAULT partition her zaman boş kalmalıdır; satır varsa sayısı döner (admin uyarısı).
 * Saat dışarıdan verilir (`now`); test sahte saatle çalışır.
 */
export const TRACK_TABLES = ['track_points_sampled', 'track_points_fine'] as const
export type TrackTable = (typeof TRACK_TABLES)[number]

export const PARTITION_DAYS_AHEAD = 7
/** DEFAULT partition'daki satırlar en fazla bu sayıya kadar sayılır (panel sorgusu sınırlı kalsın). */
export const DEFAULT_ROWS_COUNT_LIMIT = 10_000

type Sql = postgres.Sql

const DAY_MS = 86_400_000
const PARTITION_NAME = /_p(\d{4})(\d{2})(\d{2})$/
const LOCK_NOT_AVAILABLE = '55P03'
/** Partition bu arada başka bir süreçte (migrate ya da iş) silinmiş: sonuç zaten istenen. */
const UNDEFINED_TABLE = '42P01'

/** UTC gün başı. */
export function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

const addDays = (day: Date, days: number) => new Date(day.getTime() + days * DAY_MS)
const stamp = (day: Date) => day.toISOString().slice(0, 10).replaceAll('-', '')
const ident = (name: string) => `"${name.replaceAll('"', '""')}"`
const errorCode = (error: unknown) => (error as { code?: string }).code

export function partitionName(table: TrackTable, day: Date): string {
  return `${table}_p${stamp(day)}`
}

export interface RetryOptions {
  /** Kilit alınamazsa deneme sayısı (varsayılan 3). */
  attempts?: number
  sleep?: (ms: number) => Promise<void>
  /** 0–1 arası; yeniden deneme gecikmesine eklenen rastgelelik (test için sabitlenebilir). */
  jitter?: () => number
}

/** Kilit zaman aşımında (55P03) artan gecikmeyle yeniden dener; başka hatayı olduğu gibi fırlatır. */
async function withLockRetry<T>(
  run: () => Promise<T>,
  {
    attempts = 3,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    jitter = Math.random,
  }: RetryOptions,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      if (errorCode(error) !== LOCK_NOT_AVAILABLE || attempt >= attempts) throw error
      await sleep(1000 * attempt + Math.round(jitter() * 1000))
    }
  }
}

/** Mevcut günlük partition'lar (DEFAULT hariç), güne göre sıralı. */
export async function listTrackPartitions(
  sql: Sql,
  table: TrackTable,
): Promise<{ name: string; day: Date }[]> {
  const rows = await sql<{ name: string }[]>`
    select child.relname as name
    from pg_inherits
    join pg_class parent on parent.oid = pg_inherits.inhparent
    join pg_class child on child.oid = pg_inherits.inhrelid
    where parent.relname = ${table}`
  return rows
    .map(({ name }) => {
      const match = PARTITION_NAME.exec(name)
      return match ? { name, day: new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`) } : null
    })
    .filter((p): p is { name: string; day: Date } => p !== null)
    .sort((a, b) => a.day.getTime() - b.day.getTime())
}

/**
 * Bir günün partition'ını açar. DEFAULT'ta o güne ait satır varsa önce geçici tabloya alınır,
 * partition açılınca üst tabloya yeniden yazılır (yeni partition'a düşer). Taşınan satır sayısını
 * döndürür. Tek işlemdir: yarıda kalırsa hiçbir şey değişmez.
 */
async function createDayPartition(sql: Sql, table: TrackTable, day: Date): Promise<number> {
  const from = day.toISOString()
  const to = addDays(day, 1).toISOString()
  const name = ident(partitionName(table, day))
  const parent = ident(table)
  const fallback = ident(`${table}_default`)
  return sql.begin(async (tx) => {
    await tx.unsafe(`set local lock_timeout = '5s'`)
    const [stray] = await tx.unsafe<{ found: boolean }[]>(
      `select exists (select 1 from ${fallback} where ts >= $1 and ts < $2) as found`,
      [from, to],
    )
    if (!stray?.found) {
      await tx.unsafe(
        `create table if not exists ${name} partition of ${parent} for values from ('${from}') to ('${to}')`,
      )
      return 0
    }
    await tx.unsafe(`create temp table hy_moved_rows (like ${parent}) on commit drop`)
    const moved = await tx.unsafe(
      `with m as (delete from ${fallback} where ts >= $1 and ts < $2 returning *)
       insert into hy_moved_rows select * from m`,
      [from, to],
    )
    await tx.unsafe(
      `create table if not exists ${name} partition of ${parent} for values from ('${from}') to ('${to}')`,
    )
    await tx.unsafe(`insert into ${parent} select * from hy_moved_rows`)
    return moved.count
  })
}

export interface EnsureResult {
  /** Açılan partition'ların adları. */
  created: string[]
  /** DEFAULT'tan yeni partition'lara taşınan satırlar. */
  movedRows: number
}

/** Dünden `daysAhead` gün sonrasına kadar eksik partition'ları açar. */
export async function ensureTrackPartitions(
  sql: Sql,
  now: Date,
  daysAhead = PARTITION_DAYS_AHEAD,
  retry: RetryOptions = {},
): Promise<EnsureResult> {
  const today = utcDay(now)
  const result: EnsureResult = { created: [], movedRows: 0 }
  for (const table of TRACK_TABLES) {
    const existing = new Set((await listTrackPartitions(sql, table)).map((p) => p.name))
    for (let offset = -1; offset <= daysAhead; offset += 1) {
      const day = addDays(today, offset)
      const name = partitionName(table, day)
      if (existing.has(name)) continue
      result.movedRows += await withLockRetry(() => createDayPartition(sql, table, day), retry)
      result.created.push(name)
    }
  }
  return result
}

export interface DropOptions extends RetryOptions {
  retentionDays: Record<TrackTable, number>
}

/**
 * Saklama süresi dolan partition'ları siler: partition'ın bitişi (gün + 1) ≤ bugün − saklama.
 * Ör. saklama 7 gün, bugün 20 Ocak → 12 Ocak ve öncesi silinir, 13 Ocak kalır.
 */
export async function dropExpiredTrackPartitions(
  sql: Sql,
  now: Date,
  { retentionDays, ...retry }: DropOptions,
): Promise<string[]> {
  const today = utcDay(now)
  const dropped: string[] = []
  for (const table of TRACK_TABLES) {
    const cutoff = addDays(today, -retentionDays[table])
    const expired = (await listTrackPartitions(sql, table)).filter(
      (p) => addDays(p.day, 1).getTime() <= cutoff.getTime(),
    )
    for (const partition of expired) {
      const done = await withLockRetry(async () => {
        try {
          await sql.begin(async (tx) => {
            await tx.unsafe(`set local lock_timeout = '5s'`)
            await tx.unsafe(`alter table ${ident(table)} detach partition ${ident(partition.name)}`)
            await tx.unsafe(`drop table ${ident(partition.name)}`)
          })
          return true
        } catch (error) {
          if (errorCode(error) === UNDEFINED_TABLE) return false
          throw error
        }
      }, retry)
      if (done) dropped.push(partition.name)
    }
  }
  return dropped
}

/**
 * DEFAULT'a düşüp saklama süresi dolan satırları siler (günlük partition'ı hiç açılmamış eski günler).
 * Bunlar taşınamaz, çünkü o günler artık açılma aralığında değildir; silinmezse DEFAULT sonsuza dek
 * dolu kalır.
 */
export async function purgeExpiredDefaultRows(
  sql: Sql,
  now: Date,
  { retentionDays, ...retry }: DropOptions,
): Promise<number> {
  const today = utcDay(now)
  let purged = 0
  for (const table of TRACK_TABLES) {
    const cutoff = addDays(today, -retentionDays[table]).toISOString()
    purged += await withLockRetry(
      () =>
        sql.begin(async (tx) => {
          await tx.unsafe(`set local lock_timeout = '5s'`)
          const result = await tx.unsafe(`delete from ${ident(`${table}_default`)} where ts < $1`, [
            cutoff,
          ])
          return result.count
        }),
      retry,
    )
  }
  return purged
}

/** DEFAULT partition'lardaki satır sayısı (0 olmalı; en fazla DEFAULT_ROWS_COUNT_LIMIT sayılır). */
export async function defaultPartitionRows(sql: Sql): Promise<Record<TrackTable, number>> {
  const counts = {} as Record<TrackTable, number>
  for (const table of TRACK_TABLES) {
    const [row] = await sql.unsafe<{ n: number }[]>(
      `select count(*)::int as n from (select 1 from ${ident(`${table}_default`)} limit ${DEFAULT_ROWS_COUNT_LIMIT}) as rows`,
    )
    counts[table] = row?.n ?? 0
  }
  return counts
}

export interface TrackTableStatus {
  partitions: number
  /** En eski ve en yeni günlük partition (YYYY-MM-DD); yoksa null. */
  oldestDay: string | null
  newestDay: string | null
  /** Bugünden sonra açık partition günü sayısı (hedef PARTITION_DAYS_AHEAD); yoksa null. */
  daysAhead: number | null
  defaultRows: number
}

/** Admin Servisler paneli için partition durumu. */
export async function trackPartitionStatus(
  sql: Sql,
  now: Date,
): Promise<Record<TrackTable, TrackTableStatus>> {
  const today = utcDay(now)
  const defaults = await defaultPartitionRows(sql)
  const status = {} as Record<TrackTable, TrackTableStatus>
  for (const table of TRACK_TABLES) {
    const partitions = await listTrackPartitions(sql, table)
    const oldest = partitions[0]?.day ?? null
    const newest = partitions.at(-1)?.day ?? null
    status[table] = {
      partitions: partitions.length,
      oldestDay: oldest ? oldest.toISOString().slice(0, 10) : null,
      newestDay: newest ? newest.toISOString().slice(0, 10) : null,
      daysAhead: newest ? Math.round((newest.getTime() - today.getTime()) / DAY_MS) : null,
      defaultRows: defaults[table],
    }
  }
  return status
}

export interface MaintenanceResult extends EnsureResult {
  dropped: string[]
  /** DEFAULT'tan silinen, saklama süresi dolmuş satırlar. */
  purgedDefaultRows: number
  defaultRows: Record<TrackTable, number>
}

/** Günlük bakım: aç (DEFAULT'taki satırları taşıyarak), süresi dolanları sil, DEFAULT'u denetle. */
export async function maintainTrackPartitions(
  sql: Sql,
  now: Date,
  options: DropOptions & { daysAhead?: number },
): Promise<MaintenanceResult> {
  const ensured = await ensureTrackPartitions(sql, now, options.daysAhead, options)
  const dropped = await dropExpiredTrackPartitions(sql, now, options)
  const purgedDefaultRows = await purgeExpiredDefaultRows(sql, now, options)
  return { ...ensured, dropped, purgedDefaultRows, defaultRows: await defaultPartitionRows(sql) }
}
