import { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  compactAircraft,
  CONFIGURED_PROVIDERS_TTL_SECONDS,
  COVERAGE_TTL_SECONDS,
  LIVE_INDEX_TTL_SECONDS,
  LIVE_KEYS,
  LIVE_STREAM_MAXLEN,
  LIVE_TTL_SECONDS,
  readConfiguredProviders,
  readCoverage,
  readLiveAircraft,
  readLiveAircraftMany,
  readLiveChangedSince,
  readProviderLive,
  sweepLive,
  writeConfiguredProviders,
  writeCoverage,
  writeLiveUpdates,
  writeProviderLive,
  writeRegionFreshness,
  type CompactAircraft,
  type CoverageCircle,
  type LiveAircraftInput,
} from './live'
import { createRedis } from './redis'

// Yerelde docker-compose.dev.yml (redis-live 46380), CI'da aynı dosyanın servisleri. Başka
// testlerle çakışmasın diye adres ne olursa olsun 2 numaralı veritabanı kullanılır.
function liveUrl(): string {
  const url = new URL(process.env.TEST_REDIS_LIVE_URL ?? 'redis://:live_dev_only@localhost:46380/2')
  url.pathname = '/2'
  return url.toString()
}

let redis: Redis
let subscriber: Redis

beforeAll(async () => {
  redis = createRedis(liveUrl(), { name: 'test-db-live' })
  subscriber = createRedis(liveUrl(), { name: 'test-db-live-sub' })
  await redis.flushdb()
})

afterAll(async () => {
  await redis?.flushdb()
  await Promise.allSettled([redis?.quit(), subscriber?.quit()])
})

interface TestAircraft extends LiveAircraftInput {
  registration: string | null
}

const T0 = 1_790_000_000_000

const aircraft = (hex: string, sampleTime: number, over: Partial<TestAircraft> = {}) =>
  ({
    hex,
    lat: 41.274874,
    lon: 28.732136,
    altBaroFt: 3025,
    onGround: false,
    gsKt: 182.4,
    trackDeg: 354.6,
    sampleTime,
    dbFlags: 0,
    registration: 'TC-LGA',
    ...over,
  }) satisfies TestAircraft

describe('writeLiveUpdates', () => {
  it('hash, GEO, seen ve stream kayıtlarını TTL ile yazar; tam nesne okunur', async () => {
    const a = aircraft('4bb463', T0)
    const b = aircraft('4bb464', T0 + 500, { lat: 40.898602, lon: 29.3092, dbFlags: null })
    await writeLiveUpdates(redis, [a, b])

    expect(await readLiveAircraft(redis, '4bb463')).toEqual(a)
    expect(await readLiveAircraft(redis, 'ffffff')).toBeNull()
    expect(await redis.hget(LIVE_KEYS.aircraft('4bb464'), 't')).toBe(String(T0 + 500))
    const ttl = await redis.ttl(LIVE_KEYS.aircraft('4bb463'))
    expect(ttl).toBeGreaterThan(LIVE_TTL_SECONDS - 5)
    expect(ttl).toBeLessThanOrEqual(LIVE_TTL_SECONDS)
    for (const key of [LIVE_KEYS.geo, LIVE_KEYS.seen, LIVE_KEYS.updates]) {
      expect(await redis.ttl(key)).toBeGreaterThan(LIVE_INDEX_TTL_SECONDS - 5)
    }

    expect(await redis.zscore(LIVE_KEYS.seen, '4bb464')).toBe(String(T0 + 500))
    const near = await redis.geosearch(
      LIVE_KEYS.geo,
      'FROMLONLAT',
      28.73,
      41.27,
      'BYRADIUS',
      5,
      'km',
    )
    expect(near).toEqual(['4bb463'])

    const entries = await redis.xrange(LIVE_KEYS.updates, '-', '+')
    expect(entries).toHaveLength(2)
    const [, fields] = entries[1] ?? ['', []]
    expect(fields[0]).toBe('c')
    expect(JSON.parse(fields[1] ?? 'null')).toEqual(compactAircraft(b))
  })

  it("seen skoru geri gitmez; GEO'nun enlem sınırı dışındaki uçak yalnızca GEO'ya yazılmaz", async () => {
    await writeLiveUpdates(redis, [aircraft('4bb463', T0 - 10_000)])
    expect(await redis.zscore(LIVE_KEYS.seen, '4bb463')).toBe(String(T0))

    await writeLiveUpdates(redis, [aircraft('polar1', T0, { lat: 86.5 })])
    expect(await redis.zscore(LIVE_KEYS.seen, 'polar1')).toBe(String(T0))
    expect(await redis.geopos(LIVE_KEYS.geo, 'polar1')).toEqual([null])
    expect(await readLiveAircraft(redis, 'polar1')).toMatchObject({ lat: 86.5 })
  })

  it('boş liste hiçbir şey yazmaz', async () => {
    const before = await redis.xlen(LIVE_KEYS.updates)
    await writeLiveUpdates(redis, [])
    expect(await redis.xlen(LIVE_KEYS.updates)).toBe(before)
  })

  it('her tur hy:ac:batch kanalına kısa biçimli tek ileti yayınlar', async () => {
    const received = new Promise<CompactAircraft[]>((resolve) => {
      subscriber.on('message', (channel: string, message: string) => {
        if (channel !== LIVE_KEYS.batch) return
        const batch = JSON.parse(message) as CompactAircraft[]
        // Kanal veritabanından bağımsızdır; yalnızca bu testin iletisi alınır.
        if (batch.some((t) => t[0] === 'pubsb1')) resolve(batch)
      })
    })
    await subscriber.subscribe(LIVE_KEYS.batch)
    const list = [aircraft('pubsb1', T0), aircraft('pubsb2', T0 + 1, { onGround: true })]
    await writeLiveUpdates(redis, list)
    expect(await received).toEqual(list.map(compactAircraft))
    await subscriber.unsubscribe(LIVE_KEYS.batch)
  })
})

describe('sweepLive', () => {
  it("120 sn'den eski uçakları seen, GEO ve hash'ten siler; yenilere dokunmaz", async () => {
    await redis.flushdb()
    await writeLiveUpdates(redis, [
      aircraft('old001', T0),
      aircraft('old002', T0 + 1000),
      aircraft('edge01', T0 + 5000),
      aircraft('new001', T0 + 60_000),
    ])
    // Sınır: skoru tam now − 120 sn olan uçak kalır (ZRANGEBYSCORE -inf (cutoff).
    const now = T0 + 5000 + LIVE_TTL_SECONDS * 1000
    expect(await sweepLive(redis, now)).toBe(2)
    expect(await redis.zrange(LIVE_KEYS.seen, '0', '-1')).toEqual(['edge01', 'new001'])
    expect((await redis.geopos(LIVE_KEYS.geo, 'old001', 'edge01'))[0]).toBeNull()
    expect(await redis.exists(LIVE_KEYS.aircraft('old001'), LIVE_KEYS.aircraft('old002'))).toBe(0)
    expect(await readLiveAircraft(redis, 'new001')).not.toBeNull()
    expect(await sweepLive(redis, now)).toBe(0)
  })

  it('bir seferde çok sayıda uçağı süpürür (Lua parçaları)', async () => {
    await redis.flushdb()
    const many = Array.from({ length: 1234 }, (_, i) =>
      aircraft(`s${String(i).padStart(5, '0')}`, T0 + i),
    )
    await writeLiveUpdates(redis, many)
    expect(await sweepLive(redis, T0 + 10_000_000)).toBe(1234)
    expect(await redis.zcard(LIVE_KEYS.seen)).toBe(0)
    expect(await redis.zcard(LIVE_KEYS.geo)).toBe(0)
  })
})

describe('stream sınırı', () => {
  it(`hy:ac:updates yaklaşık ${LIVE_STREAM_MAXLEN} kayıtta tutulur`, async () => {
    await redis.flushdb()
    const hexes = Array.from({ length: 1000 }, (_, i) => `m${String(i).padStart(5, '0')}`)
    for (let round = 0; round < 51; round += 1) {
      await writeLiveUpdates(
        redis,
        hexes.map((hex) => aircraft(hex, T0 + round * 1000)),
      )
    }
    const length = await redis.xlen(LIVE_KEYS.updates)
    // MAXLEN ~ yalnızca bütün düğümleri siler: sınırın altına inmez, en fazla bir düğüm fazlası kalır.
    expect(length).toBeGreaterThanOrEqual(LIVE_STREAM_MAXLEN)
    expect(length).toBeLessThanOrEqual(LIVE_STREAM_MAXLEN + 100)
    expect(await redis.zcard(LIVE_KEYS.seen)).toBe(1000)
  }, 30_000)
})

describe('sağlayıcı ve bölge anlık durumu', () => {
  it('writeProviderLive önceki alanların yerine geçer, boş alanı yazmaz, TTL verir', async () => {
    const key = LIVE_KEYS.provider('adsbLol')
    await writeProviderLive(redis, 'adsbLol', { status: 'ok', rps: 0.1, lastError: 'x' })
    await writeProviderLive(redis, 'adsbLol', { status: 'degraded', rps: 0.05, lastError: null })
    expect(await redis.hgetall(key)).toEqual({ status: 'degraded', rps: '0.05' })
    const ttl = await redis.ttl(key)
    expect(ttl).toBeGreaterThan(170)
    expect(ttl).toBeLessThanOrEqual(180)

    await writeProviderLive(redis, 'adsbLol', { status: 'down' }, 30)
    expect(await redis.ttl(key)).toBeLessThanOrEqual(30)
    await writeProviderLive(redis, 'adsbLol', { status: null })
    expect(await redis.exists(key)).toBe(0)
  })

  it('writeRegionFreshness bölgeleri birleştirir ve TTL verir', async () => {
    await writeRegionFreshness(redis, { west: T0, east: T0 - 50_000 })
    await writeRegionFreshness(redis, { west: T0 + 10_000 })
    await writeRegionFreshness(redis, {})
    expect(await redis.hgetall(LIVE_KEYS.regions)).toEqual({
      west: String(T0 + 10_000),
      east: String(T0 - 50_000),
    })
    expect(await redis.ttl(LIVE_KEYS.regions)).toBeGreaterThan(LIVE_INDEX_TTL_SECONDS - 5)
  })

  it('readProviderLive yazılan alanları döndürür; kayıt yoksa null', async () => {
    await redis.del(LIVE_KEYS.provider('localReceiver'))
    expect(await readProviderLive(redis, 'localReceiver')).toBeNull()
    await writeProviderLive(redis, 'localReceiver', {
      status: 'ok',
      receivers: 2,
      lastError: null,
      updatedAt: T0,
    })
    expect(await readProviderLive(redis, 'localReceiver')).toEqual({
      status: 'ok',
      receivers: '2',
      updatedAt: String(T0),
    })
    await writeProviderLive(redis, 'localReceiver', { status: null })
    expect(await readProviderLive(redis, 'localReceiver')).toBeNull()
  })

  it('writeConfiguredProviders tekilleştirip sıralar, uzun TTL verir; bozuk kayıt null, geçersiz ad atılır', async () => {
    await redis.del(LIVE_KEYS.providers)
    expect(await readConfiguredProviders(redis)).toBeNull()
    await writeConfiguredProviders(redis, ['localReceiver', 'adsbLol', 'adsbLol'])
    expect(await readConfiguredProviders(redis)).toEqual(['adsbLol', 'localReceiver'])
    expect(await redis.ttl(LIVE_KEYS.providers)).toBeGreaterThan(
      CONFIGURED_PROVIDERS_TTL_SECONDS - 5,
    )

    await redis.set(LIVE_KEYS.providers, '{bozuk')
    expect(await readConfiguredProviders(redis)).toBeNull()
    await redis.set(LIVE_KEYS.providers, JSON.stringify({ adsbLol: true }))
    expect(await readConfiguredProviders(redis)).toBeNull()
    await redis.set(LIVE_KEYS.providers, JSON.stringify(['adsbLol', 7, 'hy:bad', '']))
    expect(await readConfiguredProviders(redis)).toEqual(['adsbLol'])
  })
})

describe('kapsama çemberleri', () => {
  const west: CoverageCircle = { id: 'west', kind: 'west', lat: 39.5, lon: 30.1, radiusNm: 250 }
  const primary: CoverageCircle = {
    id: 'primary',
    kind: 'primary',
    lat: 41.274874,
    lon: 28.732136,
    radiusNm: 40,
  }
  const circles = [west, primary]

  it('writeCoverage JSON olarak TTL ile yazar; readCoverage doğrulayarak okur', async () => {
    await redis.del(LIVE_KEYS.coverage)
    expect(await readCoverage(redis)).toBeNull()

    // PlannedCircle gibi fazla alanlı nesne verilse de yalnızca sözleşmedeki alanlar yazılır.
    const withExtra = { ...west, covers: ['LTFM'], center: { lat: 0, lon: 0 } }
    await writeCoverage(redis, [withExtra, primary])
    expect(await readCoverage(redis)).toEqual(circles)
    expect(JSON.parse((await redis.get(LIVE_KEYS.coverage)) ?? 'null')).toEqual(circles)
    const ttl = await redis.ttl(LIVE_KEYS.coverage)
    expect(ttl).toBeGreaterThan(COVERAGE_TTL_SECONDS - 5)
    expect(ttl).toBeLessThanOrEqual(COVERAGE_TTL_SECONDS)

    await writeCoverage(redis, [], 30)
    expect(await readCoverage(redis)).toEqual([])
    expect(await redis.ttl(LIVE_KEYS.coverage)).toBeLessThanOrEqual(30)
  })

  it('bozuk kayıt null okunur', async () => {
    await redis.set(LIVE_KEYS.coverage, '{"broken"')
    expect(await readCoverage(redis)).toBeNull()
    await redis.set(LIVE_KEYS.coverage, JSON.stringify([{ ...west, radiusNm: -1 }]))
    expect(await readCoverage(redis)).toBeNull()
    await redis.del(LIVE_KEYS.coverage)
  })
})

describe('canlı API okumaları', () => {
  it('readLiveChangedSince: skoru sınırdan büyük olanlar (sınır hariç), skor sırasıyla', async () => {
    await redis.flushdb()
    expect(await readLiveChangedSince(redis, 0)).toEqual([])
    await writeLiveUpdates(redis, [
      aircraft('cc0003', T0 + 3_000),
      aircraft('cc0001', T0 + 1_000),
      aircraft('cc0002', T0 + 2_000),
      aircraft('~cc0004', T0 + 2_500),
    ])
    expect(await readLiveChangedSince(redis, 0)).toEqual([
      { hex: 'cc0001', sampleTime: T0 + 1_000 },
      { hex: 'cc0002', sampleTime: T0 + 2_000 },
      { hex: '~cc0004', sampleTime: T0 + 2_500 },
      { hex: 'cc0003', sampleTime: T0 + 3_000 },
    ])
    expect(await readLiveChangedSince(redis, T0 + 2_000)).toEqual([
      { hex: '~cc0004', sampleTime: T0 + 2_500 },
      { hex: 'cc0003', sampleTime: T0 + 3_000 },
    ])
    expect(await readLiveChangedSince(redis, T0 + 1_999.5)).toHaveLength(3)
    expect(await readLiveChangedSince(redis, T0 + 3_000)).toEqual([])
    // İlk tur: sınır yok (negatif ya da sonsuz).
    expect(await readLiveChangedSince(redis, -2_000)).toHaveLength(4)
    expect(await readLiveChangedSince(redis, -Infinity)).toHaveLength(4)

    // Güncellenen uçak yeni skoruyla yeniden görünür.
    await writeLiveUpdates(redis, [aircraft('cc0001', T0 + 4_000)])
    expect(await readLiveChangedSince(redis, T0 + 3_000)).toEqual([
      { hex: 'cc0001', sampleTime: T0 + 4_000 },
    ])
  })

  it('readLiveAircraftMany: tam durumlar; kaydı olmayan ve bozuk JSON atlanır', async () => {
    await redis.flushdb()
    const a = aircraft('dd0001', T0)
    const b = aircraft('~dd0002', T0 + 1, { dbFlags: 8, registration: null })
    await writeLiveUpdates(redis, [a, b])
    await redis.hset(LIVE_KEYS.aircraft('dd0003'), 'd', '{"hex":"dd0003"', 't', String(T0))
    await redis.hset(LIVE_KEYS.aircraft('dd0004'), 'd', '42', 't', String(T0))
    await redis.hset(LIVE_KEYS.aircraft('dd0005'), 't', String(T0))

    const many = await readLiveAircraftMany(redis, [
      'dd0001',
      'ffffff',
      '~dd0002',
      'dd0003',
      'dd0004',
      'dd0005',
    ])
    expect([...many.keys()]).toEqual(['dd0001', '~dd0002'])
    expect(many.get('dd0001')).toEqual(a)
    expect(many.get('~dd0002')).toEqual(b)
    expect((await readLiveAircraftMany(redis, [])).size).toBe(0)
  })

  it('readLiveAircraftMany: çok sayıda uçak tek pipeline’da okunur', async () => {
    await redis.flushdb()
    const list = Array.from({ length: 3000 }, (_, i) =>
      aircraft(`e${String(i).padStart(5, '0')}`, T0 + i),
    )
    await writeLiveUpdates(redis, list)
    const changed = await readLiveChangedSince(redis, T0 - 1)
    expect(changed).toHaveLength(3000)
    const many = await readLiveAircraftMany(
      redis,
      changed.map((c) => c.hex),
    )
    expect(many.size).toBe(3000)
    expect(many.get('e02999')).toMatchObject({ sampleTime: T0 + 2999 })
  })

  it('bağlantı hatası fırlatılır (çağıran son durumu korur)', async () => {
    // Bağlanamayan, kuyruk tutmayan istemci: komutlar hemen hata verir.
    const dead = new Redis({
      host: '127.0.0.1',
      port: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    })
    dead.on('error', () => undefined)
    try {
      await expect(readLiveAircraftMany(dead, ['dd0001'])).rejects.toBeInstanceOf(Error)
      await expect(readLiveChangedSince(dead, 0)).rejects.toBeInstanceOf(Error)
    } finally {
      dead.disconnect()
    }
  })
})
