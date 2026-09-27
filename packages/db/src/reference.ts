import { count, getTableColumns, notInArray, sql, type SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { airlines, airports, referenceSources, runways } from './schema'

/**
 * Referans verisinin (OurAirports, VRS havayolları) veritabanına yazılması (data-sources.md §3–4):
 * - Değişmeyen satır yeniden yazılmaz (`row_hash`); kaynaktan kalkan satır silinir.
 * - Kaynak bozuk ya da yarım gelirse (satır sayısı mevcudun yarısının altında) hiçbir şey yazılmaz.
 * - Havalimanları ve pistler tek işlemde yazılır (pist → havalimanı yabancı anahtarı).
 */

type Db = PostgresJsDatabase
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export type AirportInsert = typeof airports.$inferInsert
export type RunwayInsert = typeof runways.$inferInsert
export type AirlineInsert = typeof airlines.$inferInsert

export const REFERENCE_SOURCES = [
  'ourairports-airports',
  'ourairports-runways',
  'vrs-airlines',
] as const
export type ReferenceSourceId = (typeof REFERENCE_SOURCES)[number]
export type ReferenceOrigin = 'remote' | 'fixture'

/** Yeni satır sayısı mevcudun bu oranının altındaysa içe aktarım reddedilir. */
export const MIN_KEEP_RATIO = 0.5
/** Tek INSERT'teki satır sayısı (pistte 35 sütun × 500 = 17.500 parametre < 65.535). */
export const UPSERT_BATCH_SIZE = 500
/** Silme sorgusu anahtarları parametre olarak taşır; beklenmedik büyüklükte veri reddedilir. */
export const MAX_REFERENCE_ROWS = 30_000

export class ReferenceGuardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReferenceGuardError'
  }
}

export interface SyncCounts {
  inserted: number
  updated: number
  unchanged: number
  deleted: number
}

/** Anahtar dışındaki sütunlar `excluded` değerleriyle güncellenir; `updated_at` şimdiye çekilir. */
function excludedSet(table: PgTable, key: PgColumn): Record<string, SQL> {
  const set: Record<string, SQL> = {}
  for (const [property, column] of Object.entries(getTableColumns(table))) {
    if (column.name === key.name) continue
    set[property] = column.name === 'updated_at' ? sql`now()` : sql.raw(`excluded."${column.name}"`)
  }
  return set
}

async function guardRowCount(tx: Tx, table: PgTable, label: string, incoming: number) {
  if (incoming === 0) throw new ReferenceGuardError(`${label}: kaynak boş geldi, yazılmadı`)
  if (incoming > MAX_REFERENCE_ROWS) {
    throw new ReferenceGuardError(`${label}: beklenmedik satır sayısı (${incoming}), yazılmadı`)
  }
  const [row] = await tx.select({ n: count() }).from(table)
  const existing = row?.n ?? 0
  if (existing > 0 && incoming < existing * MIN_KEEP_RATIO) {
    throw new ReferenceGuardError(
      `${label}: ${incoming} satır geldi, mevcut ${existing}; kaynak yarım olabilir, yazılmadı`,
    )
  }
}

async function upsertAll<T extends PgTable & { rowHash: PgColumn }>(
  tx: Tx,
  table: T,
  key: PgColumn,
  rows: T['$inferInsert'][],
  keyOf: (row: T['$inferInsert']) => string | number,
): Promise<SyncCounts> {
  const set = excludedSet(table, key)
  let inserted = 0
  let updated = 0
  for (let start = 0; start < rows.length; start += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(start, start + UPSERT_BATCH_SIZE)
    // PostgreSQL 18: RETURNING old.* eklemede NULL'dur; özeti aynı olan satır WHERE ile atlanır ve
    // dönmez.
    const written = await tx
      .insert(table)
      .values(batch)
      .onConflictDoUpdate({
        target: key,
        set,
        setWhere: sql`${table.rowHash} is distinct from excluded.row_hash`,
      })
      .returning({ inserted: sql<boolean>`(old.${sql.identifier(key.name)} is null)` })
    for (const row of written) {
      if (row.inserted) inserted += 1
      else updated += 1
    }
  }
  const keys = rows.map(keyOf)
  const deleted = await tx.delete(table).where(notInArray(key, keys)).returning({ key })
  return {
    inserted,
    updated,
    unchanged: rows.length - inserted - updated,
    deleted: deleted.length,
  }
}

/** Havalimanları ve pistler tek işlemde; kaynakta olmayan pistler ve havalimanları silinir. */
export async function syncOurAirports(
  db: Db,
  data: { airports: AirportInsert[]; runways: RunwayInsert[] },
): Promise<{ airports: SyncCounts; runways: SyncCounts }> {
  return db.transaction(async (tx) => {
    await guardRowCount(tx, airports, 'OurAirports havalimanları', data.airports.length)
    await guardRowCount(tx, runways, 'OurAirports pistleri', data.runways.length)
    const airportCounts = await upsertAll(tx, airports, airports.id, data.airports, (r) => r.id)
    const runwayCounts = await upsertAll(tx, runways, runways.id, data.runways, (r) => r.id)
    return { airports: airportCounts, runways: runwayCounts }
  })
}

/** VRS havayolları; yöneticinin düzeltmeleri (`airline_overrides`) bu işlemden etkilenmez. */
export async function syncAirlines(db: Db, rows: AirlineInsert[]): Promise<SyncCounts> {
  return db.transaction(async (tx) => {
    await guardRowCount(tx, airlines, 'VRS havayolları', rows.length)
    return upsertAll(tx, airlines, airlines.code, rows, (r) => r.code)
  })
}

export type ReferenceSourceState = typeof referenceSources.$inferSelect

export async function getReferenceSource(
  db: Db,
  source: ReferenceSourceId,
): Promise<ReferenceSourceState | null> {
  const [row] = await db
    .select()
    .from(referenceSources)
    .where(sql`${referenceSources.source} = ${source}`)
  return row ?? null
}

export interface ReferenceCheck {
  origin: ReferenceOrigin
  now: Date
  etag: string | null
  lastModified: string | null
  /** İçerik bu kontrolde içe aktarıldıysa satır sayıları; 304 ise null. */
  imported: { rowCount: number; skippedCount: number } | null
}

/** Başarılı kontrol (304 dahil); önceki hata alanları temizlenir. */
export async function recordReferenceCheck(
  db: Db,
  source: ReferenceSourceId,
  check: ReferenceCheck,
): Promise<void> {
  const update = {
    origin: check.origin,
    etag: check.etag,
    lastModified: check.lastModified,
    checkedAt: check.now,
    lastError: null,
    lastErrorAt: null,
    ...(check.imported
      ? {
          importedAt: check.now,
          rowCount: check.imported.rowCount,
          skippedCount: check.imported.skippedCount,
        }
      : {}),
  }
  await db
    .insert(referenceSources)
    .values({ source, ...update })
    .onConflictDoUpdate({
      target: referenceSources.source,
      set: { ...update, updatedAt: sql`now()` },
    })
}

export async function recordReferenceError(
  db: Db,
  source: ReferenceSourceId,
  failure: { origin: ReferenceOrigin; now: Date; error: string },
): Promise<void> {
  const error = failure.error.slice(0, 500)
  await db
    .insert(referenceSources)
    .values({ source, origin: failure.origin, lastError: error, lastErrorAt: failure.now })
    .onConflictDoUpdate({
      target: referenceSources.source,
      set: {
        origin: failure.origin,
        lastError: error,
        lastErrorAt: failure.now,
        updatedAt: sql`now()`,
      },
    })
}

export interface ReferenceStatus {
  airports: number
  runways: number
  airlines: number
  sources: ReferenceSourceState[]
}

/** Admin Servisler paneli için satır sayıları ve kaynak durumları. */
export async function referenceStatus(db: Db): Promise<ReferenceStatus> {
  const [[a], [r], [l], sources] = await Promise.all([
    db.select({ n: count() }).from(airports),
    db.select({ n: count() }).from(runways),
    db.select({ n: count() }).from(airlines),
    db.select().from(referenceSources).orderBy(referenceSources.source),
  ])
  return { airports: a?.n ?? 0, runways: r?.n ?? 0, airlines: l?.n ?? 0, sources }
}
