import type { Redis } from 'ioredis'

/**
 * Yöneticinin hex engel listesi (D-074): `redis-queue`'da kalıcı bir kümedir (TTL yok). API 30
 * sn'de bir okur ve listedeki uçağı hiçbir kanalda (REST, WebSocket, arama) döndürmez. Yönetimi
 * admin API'sindedir (`/v1/admin/blocklist`).
 */
export const BLOCKLIST_KEY = 'hy:blocklist:hex'

/** ICAO hex (6 onaltılık hane, küçük harf) ya da ICAO dışı adres (`~` önekli). */
export const BLOCKLIST_HEX = /^~?[0-9a-f]{6}$/

/** Tek komutta gönderilen en fazla üye (çok büyük listelerde komut boyutu sınırlı kalsın). */
const MEMBER_CHUNK = 1000

export class InvalidHexError extends Error {
  constructor(readonly invalid: readonly string[]) {
    super(`invalid hex: ${invalid.length} value(s)`)
    this.name = 'InvalidHexError'
  }
}

/**
 * Girdiyi temizler (boşluk kırpılır, küçük harfe çevrilir), tekrarları atar ve doğrular. Geçersiz
 * bir değer varsa hiçbiri yazılmasın diye `InvalidHexError` fırlatır (geçersizler `invalid`'de).
 */
export function normalizeBlocklistHexes(hexes: readonly string[]): string[] {
  const out = new Set<string>()
  const invalid: string[] = []
  for (const value of hexes) {
    const hex = value.trim().toLowerCase()
    if (BLOCKLIST_HEX.test(hex)) out.add(hex)
    else invalid.push(value)
  }
  if (invalid.length > 0) throw new InvalidHexError(invalid)
  return [...out]
}

function chunks<T>(rows: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

/** Engel listesinin tamamı. */
export async function readBlocklist(redis: Redis): Promise<Set<string>> {
  return new Set(await redis.smembers(BLOCKLIST_KEY))
}

/** Hex'leri listeye ekler; yeni eklenen sayısını döndürür (zaten listede olan sayılmaz). */
export async function addToBlocklist(redis: Redis, hexes: readonly string[]): Promise<number> {
  const valid = normalizeBlocklistHexes(hexes)
  let added = 0
  for (const part of chunks(valid, MEMBER_CHUNK)) {
    added += await redis.sadd(BLOCKLIST_KEY, ...part)
  }
  return added
}

/** Hex'leri listeden çıkarır; çıkarılan sayısını döndürür (listede olmayan sayılmaz). */
export async function removeFromBlocklist(redis: Redis, hexes: readonly string[]): Promise<number> {
  const valid = normalizeBlocklistHexes(hexes)
  let removed = 0
  for (const part of chunks(valid, MEMBER_CHUNK)) {
    removed += await redis.srem(BLOCKLIST_KEY, ...part)
  }
  return removed
}
