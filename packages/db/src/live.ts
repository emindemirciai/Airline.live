import type { Redis } from 'ioredis'

/**
 * `redis-live` anlık durum anahtarları (D-073). Kalıcı değildir; her tur yeniden kurulur.
 * - `hy:ac:{hex}` hash: `d` = uçağın tam durumu (JSON), `t` = `sampleTime`; TTL 120 sn
 * - `hy:ac:geo` (GEO) ve `hy:ac:seen` (skor = `sampleTime`): süpürme `seen` ile yapılır
 * - `hy:ac:updates` stream'i (`MAXLEN ~ 50000`), `hy:ac:batch` pub/sub kanalı
 * - `hy:provider:{id}` sağlayıcı anlık durumu, `hy:ingest:regions` bölge tazeliği
 * - `hy:ingest:coverage` kapsama planının çemberleri (JSON, TTL 600 sn; D-074)
 * - `hy:ingest:providers` worker'ın yapılandırdığı sağlayıcılar (JSON dizi, TTL 7 gün; D-074)
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
  coverage: 'hy:ingest:coverage',
  providers: 'hy:ingest:providers',
} as const

export const LIVE_TTL_SECONDS = 120
export const LIVE_STREAM_MAXLEN = 50_000
export const LIVE_INDEX_TTL_SECONDS = 600
export const PROVIDER_LIVE_TTL_SECONDS = 180
export const COVERAGE_TTL_SECONDS = 600
/**
 * Yapılandırılmış sağlayıcı listesi uzun yaşar: worker uzun süre çökmüşken yeniden başlayan API
 * de hangi sağlayıcının "Çalışmıyor" gösterileceğini bilir (canlı kayıtlar 180 sn'de düşer).
 */
export const CONFIGURED_PROVIDERS_TTL_SECONDS = 7 * 24 * 3600

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
 * komutlar hepsini yeniden kurar; hash'in silinip indekste kalması olmaz. `d` alanına verilen tam
 * nesne (ör. `AircraftState`) yazılır.
 *
 * `remove`: yayından çekilen hex'ler (D-115; kuralı artık tutmayan uçak). Aynı pipeline'da
 * güncellemelerden sonra `seen`, `geo` ve hash'ten silinir; bekleyen bir yazım onu yeniden
 * ekleyemez. İki liste de boşsa bir şey yazılmaz.
 */
export async function writeLiveUpdates<T extends LiveAircraftInput>(
  redis: Redis,
  list: readonly T[],
  remove: readonly string[] = [],
): Promise<void> {
  if (list.length === 0 && remove.length === 0) return
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
  if (list.length > 0) {
    pipeline.expire(LIVE_KEYS.geo, LIVE_INDEX_TTL_SECONDS)
    pipeline.expire(LIVE_KEYS.seen, LIVE_INDEX_TTL_SECONDS)
    pipeline.expire(LIVE_KEYS.updates, LIVE_INDEX_TTL_SECONDS)
    pipeline.publish(LIVE_KEYS.batch, JSON.stringify(compact))
  }
  if (remove.length > 0) {
    pipeline.zrem(LIVE_KEYS.seen, ...remove)
    pipeline.zrem(LIVE_KEYS.geo, ...remove)
    pipeline.del(...remove.map((hex) => LIVE_KEYS.aircraft(hex)))
  }
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
 * Canlı katman kapatıldı (D-115): bütün canlı uçakları siler (`seen`, `geo`, her `hy:ac:{hex}`
 * hash'i ve `hy:ac:updates` stream'i). Sağlayıcı durumu, bölge tazeliği, kapsama planı ve
 * yapılandırılmış sağlayıcılar kalır (admin ve `/durum` doğru kalsın). Silinen uçak sayısını
 * döndürür; küme boşsa ucuzdur (kapalıyken her turda yeniden çağrılır).
 */
export async function clearLiveAircraft(redis: Redis): Promise<number> {
  const removed = await redis.eval(
    SWEEP_SCRIPT,
    2,
    LIVE_KEYS.seen,
    LIVE_KEYS.geo,
    '+inf',
    LIVE_KEYS.aircraft(''),
  )
  await redis.del(LIVE_KEYS.updates)
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

// ---------------------------------------------------------------------------------------------
// Canlı API'nin okumaları (Parça 1 M5, D-074)

/** Kapsama planının bir çemberi (worker yazar, API `/v1/live` kapsamasını bununla hesaplar). */
export interface CoverageCircle {
  id: string
  kind: string
  lat: number
  lon: number
  radiusNm: number
}

/** Worker her sağlık turunda planı yazar; worker durursa kayıt 600 sn sonra düşer (`unknown`). */
export async function writeCoverage(
  redis: Redis,
  circles: readonly CoverageCircle[],
  ttlSeconds = COVERAGE_TTL_SECONDS,
): Promise<void> {
  const payload = circles.map(({ id, kind, lat, lon, radiusNm }) => ({
    id,
    kind,
    lat,
    lon,
    radiusNm,
  }))
  await redis.set(LIVE_KEYS.coverage, JSON.stringify(payload), 'EX', ttlSeconds)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

/**
 * Kapsama kaydını doğrular: dizi olmalı, her çemberin kimliği ve türü metin, merkezi geçerli bir
 * koordinat, yarıçapı pozitif ve sonlu olmalıdır. Tek bir bozuk çember bütün kaydı geçersiz
 * kılar (null): eksik bir plan kapsamayı olduğundan dar gösterirdi, `unknown` daha dürüsttür.
 * Boş dizi geçerlidir (planda çember yok).
 */
export function parseCoverage(raw: string | null): CoverageCircle[] | null {
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  const out: CoverageCircle[] = []
  for (const item of parsed as unknown[]) {
    if (!isRecord(item)) return null
    const { id, kind, lat, lon, radiusNm } = item
    if (typeof id !== 'string' || typeof kind !== 'string') return null
    if (!inRange(lat, -90, 90) || !inRange(lon, -180, 180)) return null
    if (typeof radiusNm !== 'number' || !Number.isFinite(radiusNm) || radiusNm <= 0) return null
    out.push({ id, kind, lat, lon, radiusNm })
  }
  return out
}

/** Worker'ın yazdığı kapsama çemberleri; kayıt yoksa ya da bozuksa null. */
export async function readCoverage(redis: Redis): Promise<CoverageCircle[] | null> {
  return parseCoverage(await redis.get(LIVE_KEYS.coverage))
}

export interface LiveChange {
  hex: string
  sampleTime: number
}

/** `ZRANGEBYSCORE … WITHSCORES` düz yanıtını (üye, skor, üye, skor …) çiftlere çevirir. */
export function parseScoredMembers(flat: readonly string[]): LiveChange[] {
  const out: LiveChange[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const hex = flat[i] as string
    const sampleTime = Number(flat[i + 1])
    if (Number.isFinite(sampleTime)) out.push({ hex, sampleTime })
  }
  return out
}

/**
 * `hy:ac:seen`'de skoru (`sampleTime`) `sinceMs`'ten büyük olan uçaklar, skorlarıyla, skor
 * sırasıyla. Sınır dahil değildir. Sonlu olmayan `sinceMs` bütün kümeyi döndürür (ilk tur).
 */
export async function readLiveChangedSince(redis: Redis, sinceMs: number): Promise<LiveChange[]> {
  const min = Number.isFinite(sinceMs) ? `(${sinceMs}` : '-inf'
  const flat = await redis.zrangebyscore(LIVE_KEYS.seen, min, '+inf', 'WITHSCORES')
  return parseScoredMembers(flat)
}

/**
 * Verilen uçakların tam durumu (`d` alanı), tek pipeline'da. Kaydı olmayan (süpürülmüş) ya da
 * JSON'u bozuk uçak atlanır; sonuç doğrulanmamıştır (çağıran şemayla doğrular). Komut hatası
 * (bağlantı, zaman aşımı) fırlatılır: çağıran son durumu korur ve sonraki turda yeniden dener.
 */
export async function readLiveAircraftMany(
  redis: Redis,
  hexes: readonly string[],
): Promise<Map<string, unknown>> {
  const out = new Map<string, unknown>()
  if (hexes.length === 0) return out
  const pipeline = redis.pipeline()
  for (const hex of hexes) pipeline.hget(LIVE_KEYS.aircraft(hex), 'd')
  const results = await pipeline.exec()
  assertPipeline(results)
  for (const [index, [, raw]] of (results ?? []).entries()) {
    const hex = hexes[index]
    if (hex === undefined || typeof raw !== 'string') continue
    try {
      const value = JSON.parse(raw) as unknown
      if (isRecord(value)) out.set(hex, value)
    } catch {
      // Bozuk kayıt atlanır; worker bir sonraki örnekte üzerine yazar.
    }
  }
  return out
}

/** Sağlayıcının anlık durumu (`writeProviderLive`); kayıt yoksa (süresi dolmuş) null. */
export async function readProviderLive(
  redis: Redis,
  id: string,
): Promise<Record<string, string> | null> {
  const fields = await redis.hgetall(LIVE_KEYS.provider(id))
  return Object.keys(fields).length === 0 ? null : fields
}

/** Worker'ın bu süreçte yapılandırdığı sağlayıcı kimlikleri (adsbLol, localReceiver). */
export async function writeConfiguredProviders(
  redis: Redis,
  ids: readonly string[],
  ttlSeconds = CONFIGURED_PROVIDERS_TTL_SECONDS,
): Promise<void> {
  await redis.set(LIVE_KEYS.providers, JSON.stringify([...new Set(ids)].sort()), 'EX', ttlSeconds)
}

/** Yapılandırılmış sağlayıcılar; anahtar yok ya da bozuksa null. */
export async function readConfiguredProviders(redis: Redis): Promise<string[] | null> {
  const raw = await redis.get(LIVE_KEYS.providers)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.filter((x): x is string => typeof x === 'string' && /^[A-Za-z]{1,32}$/.test(x))
  } catch {
    return null
  }
}
