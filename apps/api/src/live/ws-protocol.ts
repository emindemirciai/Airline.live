/**
 * `/v1/ws` protokolünün saf parçaları: istemci mesajının doğrulanması, 2°'lik ızgara, hücre
 * farklarının kurulması, birleştirilmesi ve serileştirilmesi (D-074). IO ve zamanlayıcı yoktur.
 *
 * İstemci bir diff mesajını şöyle uygular: önce bütün hücrelerin `removed` listeleri, sonra
 * `added` ve `updated` kayıtları (ikisi de "ekle ya da güncelle"dir). Hücre değiştiren uçak eski
 * hücresinde `removed`, yeni hücresinde `added` olarak gelir; iki hücreyi de gören istemci önce
 * silip sonra eklediği için uçağı kaybetmez. Bilinmeyen hex'in silinmesi etkisizdir.
 */
import { z } from 'zod'
import { toBbox } from './bbox'
import type { Bbox, CoverageState, LiveStatus, PublicAircraft, TickDiff } from './types'

/** Izgara hücresinin kenarı, derece. */
export const CELL_DEG = 2

export function cellIndex(deg: number): number {
  return Math.floor(deg / CELL_DEG)
}

/** Hücre anahtarı: `${Math.floor(lat/2)}:${Math.floor(lon/2)}`. */
export function cellKey(lat: number, lon: number): string {
  return `${cellIndex(lat)}:${cellIndex(lon)}`
}

/** Görünümle kesişen hücrelerin indeks aralığı (uçlar dahil). */
export interface CellRange {
  lat0: number
  lat1: number
  lon0: number
  lon1: number
}

export function cellRange(viewport: Bbox): CellRange {
  return {
    lat0: cellIndex(viewport.minLat),
    lat1: cellIndex(viewport.maxLat),
    lon0: cellIndex(viewport.minLon),
    lon1: cellIndex(viewport.maxLon),
  }
}

export function inCellRange(range: CellRange, latIndex: number, lonIndex: number): boolean {
  return (
    latIndex >= range.lat0 &&
    latIndex <= range.lat1 &&
    lonIndex >= range.lon0 &&
    lonIndex <= range.lon1
  )
}

const SubscribeSchema = z.object({
  type: z.literal('subscribe'),
  // REST'teki `bbox` ile aynı kural (`toBbox`): enlem −90..90, boylam −180..180, min < max,
  // en fazla 60° × 40°.
  viewport: z
    .object({ minLon: z.number(), minLat: z.number(), maxLon: z.number(), maxLat: z.number() })
    .refine((v) => toBbox(v.minLon, v.minLat, v.maxLon, v.maxLat) !== null),
  // MapLibre yakınlaştırma aralığı; kesirli olabilir.
  zoom: z.number().min(0).max(24),
  lastSeq: z.number().int().min(0).optional(),
})

export type SubscribeMessage = z.infer<typeof SubscribeSchema>

/** İstemcinin metin mesajı; tanınmayan ya da kurala uymayan mesaj `null` döner. */
export function parseClientMessage(text: string): SubscribeMessage | null {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  const result = SubscribeSchema.safeParse(value)
  return result.success ? result.data : null
}

/** Bir hücrenin bir turdaki (ya da birleştirilmiş turlardaki) değişimi. */
export interface CellChange {
  key: string
  latIndex: number
  lonIndex: number
  added: PublicAircraft[]
  updated: PublicAircraft[]
  removed: string[]
}

function emptyChange(latIndex: number, lonIndex: number): CellChange {
  return { key: `${latIndex}:${lonIndex}`, latIndex, lonIndex, added: [], updated: [], removed: [] }
}

function changeFor(changes: Map<string, CellChange>, key: string): CellChange {
  let change = changes.get(key)
  if (!change) {
    const [lat = '0', lon = '0'] = key.split(':')
    change = emptyChange(Number(lat), Number(lon))
    changes.set(key, change)
  }
  return change
}

/**
 * Her uçağın bulunduğu hücreyi izler ve kaynak farkını hücre farkına çevirir. Hücre değiştiren
 * uçak eski hücreden silinir, yeni hücreye eklenir; böylece yalnızca eski hücreyi gören istemci
 * uçağı bayat bırakmaz.
 */
export class CellTracker {
  private readonly cellOf = new Map<string, string>()

  reset(aircraft: Iterable<PublicAircraft>): void {
    this.cellOf.clear()
    for (const ac of aircraft) this.cellOf.set(ac.hex, cellKey(ac.lat, ac.lon))
  }

  get size(): number {
    return this.cellOf.size
  }

  apply(diff: TickDiff): Map<string, CellChange> {
    const changes = new Map<string, CellChange>()
    const upsert = (ac: PublicAircraft, added: boolean) => {
      const key = cellKey(ac.lat, ac.lon)
      const previous = this.cellOf.get(ac.hex)
      if (previous !== undefined && previous !== key)
        changeFor(changes, previous).removed.push(ac.hex)
      const change = changeFor(changes, key)
      if (added || previous !== key) change.added.push(ac)
      else change.updated.push(ac)
      this.cellOf.set(ac.hex, key)
    }
    for (const ac of diff.added) upsert(ac, true)
    for (const ac of diff.updated) upsert(ac, false)
    for (const gone of diff.removed) {
      const key = this.cellOf.get(gone.hex) ?? cellKey(gone.lat, gone.lon)
      changeFor(changes, key).removed.push(gone.hex)
      this.cellOf.delete(gone.hex)
    }
    return changes
  }
}

type Entry = { state: 'added' | 'updated'; ac: PublicAircraft } | { state: 'removed' }

/**
 * Ardışık turların hücre farklarını birleştirir: hücre ve hex başına en son olay kazanır.
 * Aynı aralıkta eklenip güncellenen ya da silinip geri gelen uçak `added` olur.
 */
export function mergeCellChanges(
  ticks: readonly ReadonlyMap<string, CellChange>[],
): Map<string, CellChange> {
  const cells = new Map<
    string,
    { latIndex: number; lonIndex: number; entries: Map<string, Entry> }
  >()
  for (const tick of ticks) {
    for (const change of tick.values()) {
      let cell = cells.get(change.key)
      if (!cell) {
        cell = { latIndex: change.latIndex, lonIndex: change.lonIndex, entries: new Map() }
        cells.set(change.key, cell)
      }
      const { entries } = cell
      for (const hex of change.removed) entries.set(hex, { state: 'removed' })
      for (const ac of change.added) entries.set(ac.hex, { state: 'added', ac })
      for (const ac of change.updated) {
        const previous = entries.get(ac.hex)
        const state = previous && previous.state !== 'updated' ? 'added' : 'updated'
        entries.set(ac.hex, { state, ac })
      }
    }
  }
  const merged = new Map<string, CellChange>()
  for (const [key, cell] of cells) {
    const change = emptyChange(cell.latIndex, cell.lonIndex)
    for (const [hex, entry] of cell.entries) {
      if (entry.state === 'removed') change.removed.push(hex)
      else if (entry.state === 'added') change.added.push(entry.ac)
      else change.updated.push(entry.ac)
    }
    merged.set(key, change)
  }
  return merged
}

/** Hücre parçası: `{"c":"lat2:lon2","added":[…],"updated":[…],"removed":[…]}`. */
export function encodeCell(change: CellChange): Buffer {
  return Buffer.from(
    JSON.stringify({
      c: change.key,
      added: change.added,
      updated: change.updated,
      removed: change.removed,
    }),
  )
}

/** Diff mesajının turda bir kez kurulan başı: `{"type":"diff","seq":…,"status":…,"cells":[`. */
export function diffPrefix(seq: number, status: LiveStatus): Buffer {
  return Buffer.from(`{"type":"diff","seq":${seq},"status":${JSON.stringify(status)},"cells":[`)
}

const COMMA = Buffer.from(',')
const DIFF_TAIL = Buffer.from(']}')

/** İstemcinin diff mesajı: ortak baş ve ortak hücre Buffer'larının birleşimi (yeniden serileştirme yok). */
export function diffMessage(prefix: Buffer, fragments: readonly Buffer[]): Buffer {
  const parts: Buffer[] = [prefix]
  fragments.forEach((fragment, i) => {
    if (i > 0) parts.push(COMMA)
    parts.push(fragment)
  })
  parts.push(DIFF_TAIL)
  return Buffer.concat(parts)
}

export function snapshotMessage(
  seq: number,
  coverage: CoverageState,
  status: LiveStatus,
  aircraft: readonly PublicAircraft[],
): string {
  return JSON.stringify({ type: 'snapshot', seq, coverage, status, aircraft })
}

export function reconnectMessage(afterMs: number): string {
  return JSON.stringify({ type: 'reconnect', afterMs })
}

export type WsErrorCode = 'bad_request'

export function errorMessage(code: WsErrorCode): string {
  return JSON.stringify({ type: 'error', code })
}
