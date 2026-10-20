import type postgres from 'postgres'

/**
 * Canlı katman anahtarı ve yönetici işlem kaydı (Parça 1 M7d.1, D-115).
 *
 * - `live_layer_state` tek satırdır; satır yoksa katman açıktır (varsayılan: kullanıcı anahtara
 *   basana kadar hiçbir şey değişmez).
 * - Her başarılı değişiklik (durum aynı kalsa da) `admin_actions`'a aynı işlemde yazılır: "kim, ne
 *   zaman bastı" kaydı eksiksiz olur. Bu modül kaydı silmez ve kırpmaz; saklama kuralı D-115'tedir
 *   (K7).
 *
 * Zaman ISO metni + `::timestamptz` olarak gider, epoch ms olarak döner (Drizzle'ın verdiği
 * istemcide de aynı çalışır).
 */
type Sql = postgres.Sql

export const LIVE_LAYER_ACTIONS = ['live_layer_on', 'live_layer_off'] as const
export type LiveLayerAction = (typeof LIVE_LAYER_ACTIONS)[number]
/** Neden metninin en uzun hâli (karakter; tablo denetimiyle aynı). */
export const LIVE_LAYER_REASON_MAX = 500
export const ADMIN_ACTIONS_DEFAULT_LIMIT = 20

export interface LiveLayerView {
  enabled: boolean
  /** Son değişiklik; hiç değiştirilmediyse null. */
  updatedAt: Date | null
  updatedBy: string | null
}

export interface AdminAction {
  at: Date
  actor: string
  action: LiveLayerAction
  reason: string | null
}

const iso = (date: Date) => date.toISOString()

const asAction = (value: string): LiveLayerAction =>
  value === 'live_layer_on' ? 'live_layer_on' : 'live_layer_off'

/** Katman açık mı? Satır yoksa açık. */
export async function readLiveLayerEnabled(sql: Sql): Promise<boolean> {
  const [row] = await sql<{ enabled: boolean }[]>`
    select enabled from live_layer_state where id = 1`
  return row?.enabled ?? true
}

/** Katmanın durumu ve son değişikliği; satır yoksa açık ve değiştirilmemiş. */
export async function readLiveLayer(sql: Sql): Promise<LiveLayerView> {
  const [row] = await sql<{ enabled: boolean; updated_ms: number; updated_by: string }[]>`
    select enabled,
      (extract(epoch from updated_at) * 1000)::float8 as updated_ms,
      updated_by
    from live_layer_state
    where id = 1`
  if (row === undefined) return { enabled: true, updatedAt: null, updatedBy: null }
  return {
    enabled: row.enabled,
    updatedAt: new Date(Number(row.updated_ms)),
    updatedBy: row.updated_by,
  }
}

/**
 * Katmanı açar ya da kapatır ve işlemi kaydeder (tek işlem). `reason` çağıranda temizlenmiş olmalı
 * (kırpılmış, en çok 500 karakter, boşsa null); tablo denetimi uzun metni reddeder.
 */
export async function setLiveLayer(
  sql: Sql,
  params: { enabled: boolean; actor: string; reason: string | null; at?: Date },
): Promise<LiveLayerView> {
  const at = iso(params.at ?? new Date())
  const action: LiveLayerAction = params.enabled ? 'live_layer_on' : 'live_layer_off'
  await sql.begin(async (tx) => {
    await tx`
      insert into admin_actions (at, actor, action, reason)
      values (${at}::timestamptz, ${params.actor}, ${action}, ${params.reason})`
    await tx`
      insert into live_layer_state (id, enabled, updated_at, updated_by)
      values (1, ${params.enabled}, ${at}::timestamptz, ${params.actor})
      on conflict (id) do update set
        enabled = excluded.enabled,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by`
  })
  return readLiveLayer(sql)
}

/** Son işlemler, en yeni önce. */
export async function listAdminActions(
  sql: Sql,
  limit: number = ADMIN_ACTIONS_DEFAULT_LIMIT,
): Promise<AdminAction[]> {
  const rows = await sql<{ at_ms: number; actor: string; action: string; reason: string | null }[]>`
    select (extract(epoch from at) * 1000)::float8 as at_ms, actor, action, reason
    from admin_actions
    order by at desc, id desc
    limit ${Math.max(1, Math.min(200, Math.trunc(limit)))}`
  return rows.map((r) => ({
    at: new Date(Number(r.at_ms)),
    actor: r.actor,
    action: asAction(r.action),
    reason: r.reason,
  }))
}
