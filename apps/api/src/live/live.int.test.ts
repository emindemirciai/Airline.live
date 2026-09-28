import { fileURLToPath } from 'node:url'
import {
  addToBlocklist,
  createDb,
  createRedis,
  loadAirlineCodes,
  readBlocklist,
  removeFromBlocklist,
  runMigrations,
  writeCoverage,
  writeLiveUpdates,
  writeProviderLive,
  type AirlineCodes,
  type Database,
} from '@havayolu/db'
import type { AircraftState } from '@havayolu/providers'
import type { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { aircraftState, login, testApp } from '../test/helpers'
import { BlocklistSync } from './blocklist-sync'
import { LiveCache } from './cache'
import type { PublicAircraft } from './types'

// Gerçek PostgreSQL + iki Redis (yerelde `pnpm dev:infra`, CI'da dev compose). Başka testlerle
// çakışmasın diye adres ne olursa olsun redis-live'ın 5, redis-queue'nun 6 numaralı veritabanı ve
// bu teste ait bir PostgreSQL veritabanı kullanılır.
const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_api_live'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../../../../packages/db/drizzle', import.meta.url))

function redisUrl(value: string | undefined, fallback: string, db: number): string {
  const url = new URL(value ?? fallback)
  url.pathname = `/${db}`
  return url.toString()
}
const LIVE_URL = redisUrl(
  process.env.TEST_REDIS_LIVE_URL,
  'redis://:live_dev_only@localhost:46380',
  5,
)
const QUEUE_URL = redisUrl(
  process.env.TEST_REDIS_QUEUE_URL,
  'redis://:queue_dev_only@localhost:46379',
  6,
)

let admin: Database
let database: Database
let redisLive: Redis
let redisQueue: Redis
let codes: AirlineCodes

beforeAll(async () => {
  admin = createDb(adminUrl, { max: 1 })
  await admin.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.sql.unsafe(`create database ${testDbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder })
  database = createDb(testUrl, { max: 2 })
  await database.sql`
    insert into airlines (code, name, icao, iata, row_hash) values
      ('THY', 'Turkish Airlines', 'THY', 'TK', 'a'),
      ('TKJ', 'AJet', 'TKJ', 'VF', 'b'),
      ('VLU', 'Valuair', 'VLU', 'VF', 'c')`
  codes = await loadAirlineCodes(database.sql)
  redisLive = createRedis(LIVE_URL, { name: 'test-api-live' })
  redisQueue = createRedis(QUEUE_URL, { name: 'test-api-blocklist' })
  await Promise.all([redisLive.flushdb(), redisQueue.flushdb()])
})

afterAll(async () => {
  await Promise.allSettled([redisLive?.flushdb(), redisQueue?.flushdb()])
  await Promise.allSettled([redisLive?.quit(), redisQueue?.quit()])
  await database?.sql.end({ timeout: 5 })
  await admin?.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin?.sql.end({ timeout: 5 })
})

const IST = { lat: 41.2753, lon: 28.7519 }
const now = Date.now()
const thy = aircraftState({ hex: '4bb1a2', callsign: 'THY974', sampleTime: now - 3_000 })
const ajet = aircraftState({
  hex: '4bc811',
  callsign: 'TKJ7',
  registration: 'TC-OAA',
  lat: 41.1,
  lon: 29.1,
  sampleTime: now - 8_000,
})
const military = aircraftState({
  hex: '4b8001',
  callsign: 'TUAF01',
  registration: '13-0001',
  dbFlags: 1,
  lat: 41.2,
  lon: 28.9,
  sampleTime: now - 1_000,
})
const unknownFlags = aircraftState({
  hex: '4b8002',
  callsign: 'THY975',
  dbFlags: null,
  sampleTime: now - 1_000,
})
const ladd = aircraftState({
  hex: '4b8003',
  callsign: 'TCOIL',
  registration: 'TC-OIL',
  typeCode: 'C68A',
  dbFlags: 8,
  lat: 41.0,
  lon: 28.8,
  sampleTime: now - 2_000,
})

let blocklist: ReadonlySet<string> = new Set()
const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn() }
let cache: LiveCache

type LiveBody = {
  seq: number
  coverage: string
  status: { providers: Record<string, string>; primaryAgeS: number | null }
  aircraft: PublicAircraft[]
}

describe('canlı API gerçek redis-live ve PostgreSQL ile', () => {
  it('worker kaydı → LiveCache → /v1/live ve /v1/search; askeri uçak hiçbir yerde yok', async () => {
    await writeLiveUpdates<AircraftState>(redisLive, [thy, ajet, military, unknownFlags, ladd])
    await writeProviderLive(redisLive, 'adsbLol', {
      status: 'ok',
      primaryAgeS: 3.2,
      updatedAt: Date.now(),
    })
    await writeCoverage(redisLive, [{ id: 'ltfm', kind: 'primary', ...IST, radiusNm: 40 }])

    cache = new LiveCache({ redisLive, codes: () => codes, blocklist: () => blocklist, log })
    const diff = await cache.tick()
    expect(diff?.seq).toBe(1)
    expect(diff?.added.map((a) => a.hex).sort()).toEqual(['4b8003', '4bb1a2', '4bc811'])

    const { app } = await testApp({
      deps: { live: { source: cache, codes: () => codes }, blocklistRedis: redisQueue },
    })
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/live?bbox=28.5,41,29.2,41.4' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as LiveBody
      expect(body.seq).toBe(1)
      expect(body.coverage).toBe('full')
      expect(body.status.providers).toEqual({ adsbLol: 'ok' })
      expect(body.status.primaryAgeS).toBeGreaterThanOrEqual(3.2)
      const byHex = new Map(body.aircraft.map((a) => [a.hex, a]))
      expect([...byHex.keys()].sort()).toEqual(['4b8003', '4bb1a2', '4bc811'])
      expect(byHex.get('4bb1a2')).toMatchObject({
        cs: 'THY974',
        fn: { airline: 'TK', number: '974' },
        reg: 'TC-JJA',
        alt: 12_000,
        vr: -1_216,
        t: thy.sampleTime,
      })
      expect(byHex.get('4bc811')?.fn).toEqual({ airline: 'VF', number: '7' })
      // LADD: tescil ve tescile eşit çağrı kodu gizli; tip görünür.
      expect(byHex.get('4b8003')).toMatchObject({ reg: null, cs: null, type: 'C68A' })
      expect(res.body).not.toContain('TUAF01')
      expect(res.body).not.toContain('TC-OIL')

      const search = async (q: string) => {
        const r = await app.inject({ method: 'GET', url: `/v1/search?q=${encodeURIComponent(q)}` })
        expect(r.statusCode, q).toBe(200)
        return r.json() as { kind: string; results: PublicAircraft[] }
      }
      expect(await search('TK974')).toMatchObject({ kind: 'flight', results: [{ hex: '4bb1a2' }] })
      expect(await search('VF 7')).toMatchObject({ kind: 'flight', results: [{ hex: '4bc811' }] })
      expect(await search('tc-jja')).toMatchObject({
        kind: 'registration',
        results: [{ hex: '4bb1a2' }],
      })
      for (const q of ['4b8001', 'TUAF01', 'TUAF', '13-0001', '4b8002', 'THY975', 'TC-OIL']) {
        expect((await search(q)).results, q).toEqual([])
      }
    } finally {
      await app.close()
    }
  })

  it('yeni örnek güncellenir, süpürülen uçak kaldırılır; lastSeq ile eksik farklar alınır', async () => {
    await writeLiveUpdates<AircraftState>(redisLive, [
      { ...thy, lat: 41.3, sampleTime: Date.now() },
    ])
    const updated = await cache.tick()
    expect(updated?.updated.map((a) => [a.hex, a.lat])).toEqual([['4bb1a2', 41.3]])

    // Worker'ın süpürmesi: kümeden ve hash'ten silinir.
    await redisLive.zrem('hy:ac:seen', ajet.hex)
    await redisLive.del(`hy:ac:${ajet.hex}`)
    const removed = await cache.tick()
    expect(removed?.removed).toEqual([{ hex: ajet.hex, lat: ajet.lat, lon: ajet.lon }])

    expect(cache.diffsSince(1)?.map((d) => d.seq)).toEqual([2, 3])
    expect(await cache.tick()).toBeNull()
  })

  it('admin engel listesi redis-queue’ya yazılır; okunan liste uçağı her kanaldan çıkarır', async () => {
    const { app } = await testApp({
      deps: { live: { source: cache, codes: () => codes }, blocklistRedis: redisQueue },
    })
    try {
      const token = await login(app)
      const auth = { authorization: `Bearer ${token}` }
      const add = await app.inject({
        method: 'POST',
        url: '/v1/admin/blocklist',
        headers: auth,
        payload: { hexes: ['4BB1A2'] },
      })
      expect(add.json()).toEqual({ added: 1 })
      expect([...(await readBlocklist(redisQueue))]).toEqual(['4bb1a2'])

      // API'nin 30 sn'lik yenilemesi (index.ts) yerine burada okunur.
      blocklist = await readBlocklist(redisQueue)
      const diff = await cache.tick()
      expect(diff?.removed.map((r) => r.hex)).toEqual(['4bb1a2'])
      const live = await app.inject({ method: 'GET', url: '/v1/live?bbox=28.5,41,29.2,41.4' })
      expect((live.json() as LiveBody).aircraft.map((a) => a.hex)).toEqual(['4b8003'])
      const search = await app.inject({ method: 'GET', url: '/v1/search?q=THY974' })
      expect(search.json()).toMatchObject({ results: [] })

      const remove = await app.inject({
        method: 'DELETE',
        url: '/v1/admin/blocklist',
        headers: auth,
        payload: { hexes: ['4bb1a2'] },
      })
      expect(remove.json()).toEqual({ removed: 1 })
      const list = await app.inject({ method: 'GET', url: '/v1/admin/blocklist', headers: auth })
      expect(list.json()).toEqual({ hexes: [] })
      blocklist = await readBlocklist(redisQueue)
      expect((await cache.tick())?.added.map((a) => a.hex)).toEqual(['4bb1a2'])
    } finally {
      await app.close()
    }
  })

  it('engel listesi okunamazken canlı veri sunulmaz (503); ilk okumadan sonra engelli uçak hiç görünmez', async () => {
    await addToBlocklist(redisQueue, [ladd.hex])
    // redis-queue bağlantısı kapalı: okuma "Connection is closed." ile reddedilir.
    const down = createRedis(QUEUE_URL, { name: 'test-api-blocklist-down' })
    await down.quit()
    let target: Redis = down
    const sync = new BlocklistSync({ read: () => readBlocklist(target), log, retryMs: 50 })
    const gated = new LiveCache({
      redisLive,
      codes: () => codes,
      blocklist: () => sync.current(),
      log,
    })
    const added: string[] = []
    gated.onTick((diff) => added.push(...diff.added.map((a) => a.hex)))
    // index.ts ile aynı sıra: önbellek yalnızca liste yüklenince başlar, o ana kadar ready false.
    let running = false
    sync.start()
    const started = sync.whenLoaded().then(async (loaded) => {
      if (!loaded) return
      await gated.tick()
      running = true
    })
    const { app } = await testApp({
      deps: { live: { source: gated, codes: () => codes, ready: () => running } },
    })
    try {
      await new Promise((resolve) => setTimeout(resolve, 200))
      expect(sync.loaded()).toBe(false)
      const closed = await app.inject({ method: 'GET', url: '/v1/live?bbox=28.5,41,29.2,41.4' })
      expect(closed.statusCode).toBe(503)
      expect((await app.inject({ method: 'GET', url: '/v1/search?q=TK974' })).statusCode).toBe(503)

      // redis-queue döndü: sonraki denemede liste yüklenir, önbellek başlar.
      target = redisQueue
      await started
      expect(sync.loaded()).toBe(true)
      expect([...sync.current()]).toEqual([ladd.hex])
      const res = await app.inject({ method: 'GET', url: '/v1/live?bbox=28.5,41,29.2,41.4' })
      expect(res.statusCode).toBe(200)
      const hexes = (res.json() as LiveBody).aircraft.map((a) => a.hex).sort()
      expect(hexes).toEqual(['4bb1a2'])
      // Engelli uçak hiçbir turda eklenmedi.
      expect(added).not.toContain(ladd.hex)
      expect(added).toContain('4bb1a2')
    } finally {
      sync.stop()
      await app.close()
      await removeFromBlocklist(redisQueue, [ladd.hex])
    }
  })
})
