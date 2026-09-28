import type { Redis } from 'ioredis'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  addToBlocklist,
  BLOCKLIST_KEY,
  InvalidHexError,
  readBlocklist,
  removeFromBlocklist,
} from './blocklist'
import { createRedis } from './redis'

// Engel listesi redis-queue'dadır (kalıcı). Başka testlerle çakışmasın diye adres ne olursa olsun
// 6 numaralı veritabanı kullanılır.
function queueUrl(): string {
  const url = new URL(
    process.env.TEST_REDIS_QUEUE_URL ?? 'redis://:queue_dev_only@localhost:46379/6',
  )
  url.pathname = '/6'
  return url.toString()
}

let redis: Redis

beforeAll(async () => {
  redis = createRedis(queueUrl(), { name: 'test-db-blocklist' })
  await redis.flushdb()
})

beforeEach(async () => {
  await redis.flushdb()
})

afterAll(async () => {
  await redis?.flushdb()
  await redis?.quit()
})

describe('hex engel listesi', () => {
  it('boş liste boş küme döndürür', async () => {
    expect(await readBlocklist(redis)).toEqual(new Set())
  })

  it('ekler, yeni eklenenleri sayar; girdi temizlenir; TTL yoktur', async () => {
    expect(await addToBlocklist(redis, ['4BB463', ' ~2c3a4f', '4bb463'])).toBe(2)
    expect(await addToBlocklist(redis, ['4bb463', 'ff0001'])).toBe(1)
    expect(await readBlocklist(redis)).toEqual(new Set(['4bb463', '~2c3a4f', 'ff0001']))
    expect(await redis.ttl(BLOCKLIST_KEY)).toBe(-1)
    expect(await addToBlocklist(redis, [])).toBe(0)
  })

  it('çıkarır, çıkarılanları sayar; son üye gidince anahtar kalmaz', async () => {
    await addToBlocklist(redis, ['4bb463', 'ff0001'])
    expect(await removeFromBlocklist(redis, ['FF0001', 'aa0000'])).toBe(1)
    expect(await readBlocklist(redis)).toEqual(new Set(['4bb463']))
    expect(await removeFromBlocklist(redis, ['4bb463'])).toBe(1)
    expect(await redis.exists(BLOCKLIST_KEY)).toBe(0)
    expect(await removeFromBlocklist(redis, [])).toBe(0)
  })

  it('geçersiz hex varsa hiçbir şey yazılmaz ya da silinmez', async () => {
    await addToBlocklist(redis, ['4bb463'])
    await expect(addToBlocklist(redis, ['ff0001', 'hy:ac:x'])).rejects.toBeInstanceOf(
      InvalidHexError,
    )
    await expect(removeFromBlocklist(redis, ['4bb463', '4bb46'])).rejects.toBeInstanceOf(
      InvalidHexError,
    )
    expect(await readBlocklist(redis)).toEqual(new Set(['4bb463']))
  })

  it('büyük listeler parça parça yazılır', async () => {
    const many = Array.from({ length: 2500 }, (_, i) => i.toString(16).padStart(6, '0'))
    expect(await addToBlocklist(redis, many)).toBe(2500)
    expect((await readBlocklist(redis)).size).toBe(2500)
    expect(await removeFromBlocklist(redis, many.slice(0, 1500))).toBe(1500)
    expect((await readBlocklist(redis)).size).toBe(1000)
  })
})
