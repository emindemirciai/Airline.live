import type { Redis } from 'ioredis'

/**
 * `redis-live` anlık durum anahtarları (D-073). Kalıcı değildir; her tur yeniden kurulur.
 * - `hy:ac:{hex}` hash: `d` = uçağın tam durumu (JSON), `t` = `sampleTime`; TTL 120 sn
 * - `hy:ac:geo` (GEO) ve `hy:ac:seen` (skor = `sampleTime`): süpürme `seen` ile yapılır
 * - `hy:ac:updates` stream'i (`MAXLEN ~ 50000`), `hy:ac:batch` pub/sub kanalı
 * - `hy:provider:{id}` sağlayıcı anlık durumu, `hy:ingest:regions` bölge tazeliği
 * İndeks anahtarlarına her turda 600 sn TTL verilir; `volatile-ttl` bellek dolunca onları atsa
 * da sonraki tur yeniden kurar.
 */
export const LIVE_KEYS = {
  aircraft: (hex: string) => `hy:ac:${hex}`,
  geo: 'hy:ac:geo',
  seen: 'hy:ac:seen',
  updates: 'hy:ac:updates',
  batch: 'hy:ac:batch',
  provider: (id: string) => `hy:provider:${id}`,
  regions: 'hy:ingest:regions',
} as const

export const LIVE_TTL_SECONDS = 120
export const LIVE_STREAM_MAXLEN = 50_000
export const LIVE_INDEX_TTL_SECONDS = 600
export const PROVIDER_LIVE_TTL_SECONDS = 180

/** Redis GEO'nun kabul ettiği enlem sınırı (EPSG:3857); ötesindeki uçak GEO'ya eklenmez. */
const GEO_MAX_LAT = 85.05112878

/** packages/db sağlayıcılara bağımlı olmasın diye yapısal tip (`AircraftState` bunu sağlar). */
export interface LiveAircraftInput {
  hex: string
  lat: number
  lon: number
  altBaroFt: number | null
  onGround: boolean
  gsKt: number | null
  trackDeg: number | null
  sampleTime: number
  dbFlags: number | null
}

/**
 * Stream ve pub/sub için kısa biçim:
 * [hex, lat (5 ondalık), lon (5 ondalık), altBaroFt, yerde 0|1, gsKt (tam), trackDeg (tam, 0–359),
 *  sampleTime, dbFlags]
 */
export type CompactAircraft = [
  string,
  number,
  number,
  number | null,
  0 | 1,
  number | null,
  number | null,
  number,
  number | null,
]

const round5 = (value: number) => Math.round(value * 1e5) / 1e5
const intOrNull = (value: number | null) =>
  value === null || !Number.isFinite(value) ? null : Math.round(value)

export function compactAircraft(a: LiveAircraftInput): CompactAircraft {
  const track = intOrNull(a.trackDeg)
  return [
    a.hex,
    round5(a.lat),
    round5(a.lon),
    intOrNull(a.altBaroFt),
    a.onGround ? 1 : 0,
    intOrNull(a.gsKt),
    track === null ? null : ((track % 360) + 360) % 360,
    a.sampleTime,
    a.dbFlags,
  ]
}

type PipelineResult = [Error | null, unknown][] | null

/** Pipeline'daki komutlardan biri hata verdiyse ilkini fırlatır (ioredis pipeline reddetmez). */
function assertPipeline(results: PipelineResult): void {
  for (const [error] of results ?? []) {
    if (error) throw error
  }
}

/**
 * Bir turun uçaklarını tek pipeline'da yazar. Uçak başına sıra `seen` → `geo` → hash → stream'dir:
 * eşzamanlı bir süpürme `seen` skoru eskiyken araya girerse üç kaydı birlikte siler, ardından bu
 * komutlar hepsini yeniden kurar; hash'in silinip indekste kalması olmaz. Liste boşsa bir şey
 * yazılmaz. `d` alanına verilen tam nesne (ör. `AircraftState`) yazılır.
 */
export async function writeLiveUpdates<T extends LiveAircraftInput>(
  redis: Redis,
  list: readonly T[],
): Promise<void> {
  if (list.length === 0) return
  const pipeline = redis.pipeline()
  const compact: CompactAircraft[] = []
  for (const aircraft of list) {
    const tuple = compactAircraft(aircraft)
    compact.push(tuple)
    const key = LIVE_KEYS.aircraft(aircraft.hex)
    pipeline.zadd(LIVE_KEYS.seen, 'GT', aircraft.sampleTime, aircraft.hex)
    if (Math.abs(aircraft.lat) <= GEO_MAX_LAT) {
      pipeline.geoadd(LIVE_KEYS.geo, aircraft.lon, aircraft.lat, aircraft.hex)
    } else {
      pipeline.zrem(LIVE_KEYS.geo, aircraft.hex)
    }
    pipeline.hset(key, 'd', JSON.stringify(aircraft), 't', String(aircraft.sampleTime))
    pipeline.expire(key, LIVE_TTL_SECONDS)
    pipeline.xadd(
      LIVE_KEYS.updates,
      'MAXLEN',
      '~',
      LIVE_STREAM_MAXLEN,
      '*',
      'c',
      JSON.stringify(tuple),
    )
  }
  pipeline.expire(LIVE_KEYS.geo, LIVE_INDEX_TTL_SECONDS)
  pipeline.expire(LIVE_KEYS.seen, LIVE_INDEX_TTL_SECONDS)
  pipeline.expire(LIVE_KEYS.updates, LIVE_INDEX_TTL_SECONDS)
  pipeline.publish(LIVE_KEYS.batch, JSON.stringify(compact))
  assertPipeline(await pipeline.exec())
}

/**
 * `seen` skoru `now − 120 sn`'den eski uçakları `seen` ve `geo`'dan çıkarır, hash'lerini siler.
 * Atomiktir (Lua): arada gelen bir güncelleme ya tamamen önce ya tamamen sonra işlenir.
 */
const SWEEP_SCRIPT = `
local hexes = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local n = #hexes
local step = 500
for i = 1, n, step do
  local last = math.min(i + step - 1, n)
  local part = {}
  local keys = {}
  for j = i, last do
    part[#part + 1] = hexes[j]
    keys[#keys + 1] = ARGV[2] .. hexes[j]
  end
  redis.call('ZREM', KEYS[1], unpack(part))
  redis.call('ZREM', KEYS[2], unpack(part))
  redis.call('DEL', unpack(keys))
end
return n
`

/** Süpürülen uçak sayısını döndürür. */
export async function sweepLive(redis: Redis, now: number): Promise<number> {
  const cutoff = `(${now - LIVE_TTL_SECONDS * 1000}`
  const removed = await redis.eval(
    SWEEP_SCRIPT,
    2,
    LIVE_KEYS.seen,
    LIVE_KEYS.geo,
    cutoff,
    LIVE_KEYS.aircraft(''),
  )
  return Number(removed)
}

/**
 * Sağlayıcının anlık durumunu yazar; önceki alanların yerine geçer (atomik). Boş değerli alan
 * yazılmaz (yokluğu boş demektir).
 */
export async function writeProviderLive(
  redis: Redis,
  id: string,
  snapshot: Record<string, string | number | null>,
  ttlSeconds = PROVIDER_LIVE_TTL_SECONDS,
): Promise<void> {
  const key = LIVE_KEYS.provider(id)
  const fields: string[] = []
  for (const [field, value] of Object.entries(snapshot)) {
    if (value !== null) fields.push(field, String(value))
  }
  const tx = redis.multi().del(key)
  if (fields.length > 0) tx.hset(key, ...fields).expire(key, ttlSeconds)
  assertPipeline(await tx.exec())
}

/** Bölgelerin veri zamanını (ms) yazar; verilmeyen bölgeler olduğu gibi kalır. */
export async function writeRegionFreshness(
  redis: Redis,
  regions: Record<string, number>,
): Promise<void> {
  const fields: string[] = []
  for (const [region, at] of Object.entries(regions)) fields.push(region, String(at))
  if (fields.length === 0) return
  assertPipeline(
    await redis
      .pipeline()
      .hset(LIVE_KEYS.regions, ...fields)
      .expire(LIVE_KEYS.regions, LIVE_INDEX_TTL_SECONDS)
      .exec(),
  )
}

/** Uçağın son yazılan tam durumu (`d` alanı); yoksa null. */
export async function readLiveAircraft(redis: Redis, hex: string): Promise<unknown | null> {
  const raw = await redis.hget(LIVE_KEYS.aircraft(hex), 'd')
  return raw === null ? null : (JSON.parse(raw) as unknown)
}
