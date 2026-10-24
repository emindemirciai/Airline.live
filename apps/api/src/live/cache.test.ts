import { LIVE_TTL_MAX_SECONDS, LIVE_TTL_SECONDS, type CoverageCircle } from '@havayolu/db'
import type { AircraftState } from '@havayolu/providers'
import { LIVE_DEFAULT_MAX_AGE_S, LIVE_MAX_AGE_LIMIT_S } from '@havayolu/shared'
import type { Redis } from 'ioredis'
import { describe, expect, it, vi } from 'vitest'
import { aircraftState, testAirlineCodes } from '../test/helpers'
import {
  AUX_REFRESH_MS,
  LIVE_CACHE_DEFAULTS,
  LIVE_MAX_AGE_LIMIT_MS,
  LiveCache,
  PROVIDER_STALE_MS,
  type LiveReaders,
} from './cache'
import type { TickDiff } from './types'

const T0 = Date.UTC(2026, 8, 28, 12, 0, 0)

/** Bellekte `hy:ac:seen` + hash'ler + sağlayıcı kayıtları + kapsama; okumalar sayılır. */
function fakeLive() {
  const seen = new Map<string, number>()
  const hashes = new Map<string, unknown>()
  const providers = new Map<string, Record<string, string>>()
  const state = {
    coverage: null as CoverageCircle[] | null,
    configured: null as string[] | null,
    fail: false,
    fetched: [] as string[][],
    sinceArgs: [] as number[],
    providerReads: 0,
  }
  const failIfBroken = () => {
    if (state.fail) throw new Error('Connection is closed.')
  }
  const readers: LiveReaders = {
    changedSince: async (_redis, sinceMs) => {
      failIfBroken()
      state.sinceArgs.push(sinceMs)
      return [...seen]
        .filter(([, score]) => score > sinceMs)
        .map(([hex, sampleTime]) => ({ hex, sampleTime }))
    },
    aircraftMany: async (_redis, hexes) => {
      failIfBroken()
      state.fetched.push([...hexes])
      const out = new Map<string, unknown>()
      for (const hex of hexes) if (hashes.has(hex)) out.set(hex, hashes.get(hex))
      return out
    },
    providerLive: async (_redis, id) => {
      failIfBroken()
      state.providerReads += 1
      return providers.get(id) ?? null
    },
    coverage: async () => {
      failIfBroken()
      return state.coverage
    },
    configuredProviders: async () => {
      failIfBroken()
      return state.configured
    },
  }
  return {
    readers,
    state,
    providers,
    /** Worker'ın yazdığı gibi: skor = sampleTime, hash = JSON. */
    put(...list: AircraftState[]) {
      for (const a of list) {
        seen.set(a.hex, a.sampleTime)
        hashes.set(a.hex, JSON.parse(JSON.stringify(a)) as unknown)
      }
    },
    /** Süpürme: kümeden ve hash'ten silinir. */
    drop(hex: string) {
      seen.delete(hex)
      hashes.delete(hex)
    },
  }
}

function setup(options: { historyTicks?: number; blocklist?: Set<string> } = {}) {
  const live = fakeLive()
  const clock = { t: T0 }
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn() }
  const blocklist = options.blocklist ?? new Set<string>()
  /** Canlı katman anahtarı (D-115); testler değiştirir. */
  const layer = { on: true }
  const cache = new LiveCache({
    redisLive: {} as Redis,
    codes: testAirlineCodes,
    blocklist: () => blocklist,
    layer: () => layer.on,
    log,
    now: () => clock.t,
    readers: live.readers,
    ...(options.historyTicks === undefined ? {} : { historyTicks: options.historyTicks }),
  })
  return { cache, live, clock, log, blocklist, layer }
}

const thy = aircraftState({ hex: '4bb1a2', callsign: 'THY974', sampleTime: T0 - 2_000 })
const pgt = aircraftState({
  hex: '4ba9c1',
  callsign: 'PGT123',
  registration: 'TC-NBA',
  lat: 40.9,
  lon: 29.3,
  sampleTime: T0 - 5_000,
})
const military = aircraftState({ hex: '4b8001', callsign: 'TUAF01', dbFlags: 1, sampleTime: T0 })
const unknownFlags = aircraftState({ hex: '4b8002', dbFlags: null, sampleTime: T0 })
const ladd = aircraftState({
  hex: 'a00001',
  callsign: 'N1LD',
  registration: 'N1LD',
  dbFlags: 8,
  sampleTime: T0,
})

const hexesOf = (list: { hex: string }[]) => list.map((a) => a.hex).sort()

describe('LiveCache turu', () => {
  it('ilk tur bütün uçakları yükler; askeri ve bayrağı bilinmeyen görünmez', async () => {
    const { cache, live } = setup()
    live.put(thy, pgt, military, unknownFlags, ladd)
    const diff = await cache.tick()
    expect(diff?.seq).toBe(1)
    expect(hexesOf(diff?.added ?? [])).toEqual(['4ba9c1', '4bb1a2', 'a00001'])
    expect(diff).toMatchObject({ updated: [], removed: [] })
    expect(cache.seq()).toBe(1)
    expect(cache.get('4bb1a2')).toMatchObject({
      cs: 'THY974',
      fn: { airline: 'TK', number: '974' },
    })
    expect(cache.get('4b8001')).toBeUndefined()
    expect(cache.get('4b8002')).toBeUndefined()
    // LADD: tescil ve tescile eşit çağrı kodu gizli.
    expect(cache.get('a00001')).toMatchObject({ reg: null, cs: null })
    expect(hexesOf([...cache.all()])).toEqual(['4ba9c1', '4bb1a2', 'a00001'])
  })

  it('pencere yaşa göredir: geç gelen (eski sampleTime) örnek de yakalanır', async () => {
    const { cache, live, clock } = setup()
    await cache.tick()
    clock.t += 1_000
    // Worker'ın son turdan sonra yazdığı, sampleTime'ı 40 sn önce olan adsb.lol örneği.
    live.put(aircraftState({ hex: '4bb1a9', sampleTime: clock.t - 40_000 }))
    const diff = await cache.tick()
    expect(hexesOf(diff?.added ?? [])).toEqual(['4bb1a9'])
    expect(live.state.sinceArgs.at(-1)).toBe(clock.t - 120_000)
  })

  it('değişmeyen turda seq artmaz; skoru değişmeyen uçağın hash’i yeniden okunmaz', async () => {
    const { cache, live, clock } = setup()
    live.put(thy, pgt, military)
    await cache.tick()
    expect(live.state.fetched).toEqual([expect.arrayContaining(['4bb1a2', '4ba9c1', '4b8001'])])
    clock.t += 1_000
    expect(await cache.tick()).toBeNull()
    expect(cache.seq()).toBe(1)
    // Gizli uçak da skoru değişmedikçe yeniden okunmaz.
    expect(live.state.fetched).toHaveLength(1)
  })

  it('yeni örnek updated olarak gelir; yalnızca değişen uçak okunur', async () => {
    const { cache, live, clock } = setup()
    live.put(thy, pgt)
    await cache.tick()
    clock.t += 1_000
    live.put({ ...thy, lat: 41.3, sampleTime: T0 + 500 })
    const diff = await cache.tick()
    expect(diff).toMatchObject({ seq: 2, added: [], removed: [] })
    expect(diff?.updated.map((a) => [a.hex, a.lat])).toEqual([['4bb1a2', 41.3]])
    expect(live.state.fetched.at(-1)).toEqual(['4bb1a2'])
    expect(cache.get('4bb1a2')?.t).toBe(T0 + 500)
  })

  it('kümeden silinen uçak son konumuyla removed olur', async () => {
    const { cache, live, clock } = setup()
    live.put(thy, pgt)
    await cache.tick()
    clock.t += 1_000
    live.drop('4ba9c1')
    const diff = await cache.tick()
    expect(diff?.removed).toEqual([{ hex: '4ba9c1', lat: 40.9, lon: 29.3 }])
    expect(cache.get('4ba9c1')).toBeUndefined()
  })

  it('maxAgeMs’ten eski örnek budanır (süpürme gecikse de)', async () => {
    const { cache, live, clock } = setup()
    live.put(thy, pgt)
    await cache.tick()
    // pgt'nin örneği T0 − 5 sn; 120 sn sonra pencerenin dışına düşer, thy'nin yeni örneği gelir.
    clock.t = T0 + 116_000
    live.put({ ...thy, sampleTime: T0 + 115_000 })
    const diff = await cache.tick()
    expect(diff?.removed.map((r) => r.hex)).toEqual(['4ba9c1'])
    expect(diff?.updated.map((a) => a.hex)).toEqual(['4bb1a2'])
  })

  it('yeni örneği askeri görünen uçak kaldırılır', async () => {
    const { cache, live, clock } = setup()
    live.put(thy)
    await cache.tick()
    clock.t += 1_000
    live.put({ ...thy, dbFlags: 1, sampleTime: T0 + 1_000 })
    const diff = await cache.tick()
    expect(diff?.removed.map((r) => r.hex)).toEqual(['4bb1a2'])
    expect(cache.snapshot()).toEqual([])
  })

  it('engel listesine giren uçak kaldırılır, çıkınca yeni örnek beklemeden geri gelir', async () => {
    const { cache, live, clock, blocklist } = setup()
    live.put(thy, pgt)
    await cache.tick()
    blocklist.add('4bb1a2')
    clock.t += 1_000
    const removed = await cache.tick()
    expect(removed?.removed).toEqual([{ hex: '4bb1a2', lat: thy.lat, lon: thy.lon }])
    expect(cache.get('4bb1a2')).toBeUndefined()
    blocklist.delete('4bb1a2')
    clock.t += 1_000
    const back = await cache.tick()
    expect(back?.added.map((a) => a.hex)).toEqual(['4bb1a2'])
  })

  it('snapshot kutuya göre süzer', async () => {
    const { cache, live } = setup()
    live.put(thy, pgt)
    await cache.tick()
    expect(hexesOf(cache.snapshot())).toEqual(['4ba9c1', '4bb1a2'])
    expect(hexesOf(cache.snapshot({ minLon: 28.5, minLat: 41, maxLon: 29, maxLat: 41.5 }))).toEqual(
      ['4bb1a2'],
    )
  })
})

describe('LiveCache farkları', () => {
  it('diffsSince: güncel istemciye boş dizi, eksik farklar, tampon yetmezse null', async () => {
    const { cache, live, clock } = setup({ historyTicks: 3 })
    for (let i = 0; i < 5; i++) {
      live.put({ ...thy, sampleTime: T0 + i * 1_000 })
      clock.t = T0 + i * 1_000
      await cache.tick()
    }
    expect(cache.seq()).toBe(5)
    expect(cache.diffsSince(5)).toEqual([])
    expect(cache.diffsSince(4)?.map((d) => d.seq)).toEqual([5])
    expect(cache.diffsSince(2)?.map((d) => d.seq)).toEqual([3, 4, 5])
    // Tampon yalnızca son 3 turu tutar.
    expect(cache.diffsSince(1)).toBeNull()
    expect(cache.diffsSince(0)).toBeNull()
    // Yeniden başlamış API'den büyük seq ya da geçersiz değer: tam görüntü.
    expect(cache.diffsSince(6)).toBeNull()
    expect(cache.diffsSince(-1)).toBeNull()
    expect(cache.diffsSince(2.5)).toBeNull()
  })

  it('seqBase: sayaç tabandan başlar; önceki sürecin seq değeri tam görüntüye düşer', async () => {
    const live = fakeLive()
    const clock = { t: T0 }
    const cache = new LiveCache({
      redisLive: {} as Redis,
      codes: testAirlineCodes,
      blocklist: () => new Set(),
      log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
      now: () => clock.t,
      readers: live.readers,
      seqBase: T0,
    })
    expect(cache.seq()).toBe(T0)
    expect(cache.diffsSince(T0)).toEqual([])
    // Önceki süreç 0'dan ya da daha eski bir tabandan saymıştı: fark yok, tam görüntü.
    expect(cache.diffsSince(3)).toBeNull()
    expect(cache.diffsSince(T0 - 1)).toBeNull()
    live.put(thy)
    const diff = await cache.tick()
    expect(diff?.seq).toBe(T0 + 1)
    expect(cache.diffsSince(T0)?.map((d) => d.seq)).toEqual([T0 + 1])
    expect(cache.diffsSince(5)).toBeNull()
  })

  it('ilk turdan önce diffsSince(0) boş dizidir', () => {
    const { cache } = setup()
    expect(cache.diffsSince(0)).toEqual([])
  })

  it('dinleyiciler her değişen turda çağrılır; hata veren dinleyici diğerlerini durdurmaz', async () => {
    const { cache, live, clock, log } = setup()
    const seen: TickDiff[] = []
    cache.onTick(() => {
      throw new Error('boom')
    })
    const unsubscribe = cache.onTick((diff) => seen.push(diff))
    live.put(thy)
    await cache.tick()
    clock.t += 1_000
    await cache.tick() // değişiklik yok: bildirim yok
    expect(seen.map((d) => d.seq)).toEqual([1])
    expect(log.warn).toHaveBeenCalledWith(expect.anything(), 'live tick listener failed')
    unsubscribe()
    live.put({ ...thy, sampleTime: T0 + 1_000 })
    await cache.tick()
    expect(seen).toHaveLength(1)
  })
})

describe('LiveCache hata ve durum', () => {
  it('Redis hatasında son durum sunulur; uyarı dakikada bir', async () => {
    const { cache, live, clock, log } = setup()
    live.put(thy, pgt)
    await cache.tick()
    live.state.fail = true
    for (let i = 0; i < 5; i++) {
      clock.t += 1_000
      expect(await cache.tick()).toBeNull()
    }
    expect(hexesOf(cache.snapshot())).toEqual(['4ba9c1', '4bb1a2'])
    const pollWarnings = () =>
      log.warn.mock.calls.filter(([, message]) => String(message).startsWith('live state'))
    expect(pollWarnings()).toHaveLength(1)
    clock.t += 60_000
    await cache.tick()
    expect(pollWarnings()).toHaveLength(2)
    // Kesinti 120 sn'yi aşınca eski konumlar canlı diye sunulmaz.
    clock.t = T0 + 125_000
    const diff = await cache.tick()
    expect(hexesOf(diff?.removed ?? [])).toEqual(['4ba9c1', '4bb1a2'])
    // Redis dönünce yeni örnekler gelir.
    live.state.fail = false
    live.put({ ...thy, sampleTime: clock.t })
    expect((await cache.tick())?.added.map((a) => a.hex)).toEqual(['4bb1a2'])
  })

  it('status: sağlayıcı durumu, birincil yaş ve en yeni örneğin yaşı', async () => {
    const { cache, live, clock } = setup()
    live.providers.set('adsbLol', {
      status: 'degraded',
      primaryAgeS: '12.5',
      updatedAt: String(T0 - 1_000),
    })
    live.providers.set('localReceiver', { status: 'ok', updatedAt: String(T0) })
    expect(cache.status()).toEqual({
      providers: {},
      primaryAgeS: null,
      newestAgeS: null,
      layer: 'on',
      maxAgeS: 120,
    })
    live.put(thy, pgt)
    await cache.tick()
    expect(cache.status()).toEqual({
      providers: { adsbLol: 'degraded', localReceiver: 'ok' },
      primaryAgeS: 13.5,
      newestAgeS: 2,
      layer: 'on',
      maxAgeS: 120,
    })
    clock.t += 3_000
    expect(cache.status()).toMatchObject({ primaryAgeS: 16.5, newestAgeS: 5 })
  })

  it('status: hiç kaydı görülmemiş sağlayıcı yer almaz, bayat kayıt down, bozuk durum yok sayılır', async () => {
    const { cache, live, clock } = setup()
    live.providers.set('adsbLol', {
      status: 'ok',
      updatedAt: String(T0 - PROVIDER_STALE_MS - 1),
    })
    live.providers.set('localReceiver', { status: 'harika' })
    await cache.tick()
    expect(cache.status().providers).toEqual({ adsbLol: 'down' })
    expect(cache.status().primaryAgeS).toBeNull()
    // Kayıt yeniden taze yazılınca ok; kayıt yazıldıktan 30 sn sonra (okuma sürse de) down.
    live.providers.set('adsbLol', { status: 'ok', updatedAt: String(T0) })
    clock.t += AUX_REFRESH_MS
    await cache.tick()
    expect(cache.status().providers).toEqual({ adsbLol: 'ok' })
    clock.t = T0 + PROVIDER_STALE_MS + 1
    expect(cache.status().providers).toEqual({ adsbLol: 'down' })
  })

  it('status: worker 180 sn’den uzun durup kayıt silinince sağlayıcı düşmez, down görünür', async () => {
    const { cache, live, clock } = setup()
    live.providers.set('adsbLol', {
      status: 'ok',
      primaryAgeS: '3',
      updatedAt: String(T0),
    })
    await cache.tick()
    expect(cache.status()).toMatchObject({ providers: { adsbLol: 'ok' }, primaryAgeS: 3 })
    // Kaydın TTL'i (180 sn) doldu: okuma başarılı ama kayıt yok.
    live.providers.delete('adsbLol')
    clock.t = T0 + 185_000
    await cache.tick()
    expect(cache.status()).toEqual({
      providers: { adsbLol: 'down' },
      // Son bilinen birincil yaş yaşlanmaya devam eder.
      primaryAgeS: 188,
      newestAgeS: null,
      layer: 'on',
      maxAgeS: 120,
    })
    // Worker dönünce yeniden ok.
    live.providers.set('adsbLol', { status: 'ok', primaryAgeS: '2', updatedAt: String(clock.t) })
    clock.t += AUX_REFRESH_MS
    await cache.tick()
    expect(cache.status()).toMatchObject({ providers: { adsbLol: 'ok' }, primaryAgeS: 7 })
  })

  it('status: API worker çökükken açılırsa yapılandırılmış sağlayıcı kayıt yokken down görünür', async () => {
    // Denetim bulgusu: seenProviders yalnızca bellekteydi; yeni süreç kaydı hiç görmeden
    // sağlayıcıyı "yapılandırılmamış" gibi (boş) gösteriyordu.
    const { cache, live } = setup()
    live.state.configured = ['adsbLol', 'unknownProvider']
    await cache.tick()
    expect(cache.status()).toEqual({
      providers: { adsbLol: 'down' },
      primaryAgeS: null,
      newestAgeS: null,
      layer: 'on',
      maxAgeS: 120,
    })
  })

  it('status: redis-live 30 sn’den uzun okunamazsa bilinen sağlayıcılar down, dönünce eski hâl', async () => {
    const { cache, live, clock } = setup()
    // İleri tarihli kayıt (saat kayması): yalnızca okuma yaşı down'a çevirebilir.
    live.providers.set('adsbLol', { status: 'ok', updatedAt: String(T0 + 3_600_000) })
    live.providers.set('localReceiver', { status: 'degraded', updatedAt: String(T0) })
    await cache.tick()
    expect(cache.status().providers).toEqual({ adsbLol: 'ok', localReceiver: 'degraded' })
    live.state.fail = true
    for (let s = 1; s <= 30; s++) {
      clock.t = T0 + s * 1_000
      await cache.tick()
    }
    // Son başarılı okuma tam 30 sn önce: henüz down değil.
    expect(cache.status().providers).toEqual({ adsbLol: 'ok', localReceiver: 'degraded' })
    clock.t += 1_000
    await cache.tick()
    expect(cache.status().providers).toEqual({ adsbLol: 'down', localReceiver: 'down' })
    live.state.fail = false
    clock.t += AUX_REFRESH_MS
    await cache.tick()
    expect(cache.status().providers).toEqual({ adsbLol: 'ok', localReceiver: 'down' })
  })

  it('sağlayıcı ve kapsama 5 sn’de bir okunur; okunamazsa önceki değer kalır', async () => {
    const { cache, live, clock } = setup()
    const box = { minLon: 28.6, minLat: 41.2, maxLon: 28.9, maxLat: 41.35 }
    expect(cache.coverage(box)).toBe('unknown')
    live.state.coverage = [{ id: 'ist', kind: 'primary', lat: 41.2753, lon: 28.7519, radiusNm: 40 }]
    live.providers.set('adsbLol', { status: 'ok', updatedAt: String(T0) })
    await cache.tick()
    expect(cache.coverage(box)).toBe('full')
    expect(live.state.providerReads).toBe(2)
    clock.t += 1_000
    await cache.tick()
    expect(live.state.providerReads).toBe(2)
    clock.t = T0 + AUX_REFRESH_MS
    live.state.fail = true
    await cache.tick()
    expect(cache.coverage(box)).toBe('full')
    expect(cache.status().providers).toEqual({ adsbLol: 'ok' })
    live.state.fail = false
    live.state.coverage = null
    clock.t += AUX_REFRESH_MS
    await cache.tick()
    expect(cache.coverage(box)).toBe('unknown')
  })

  it('start/stop: turlar kendiliğinden çalışır, stop sonrası durur', async () => {
    const live = fakeLive()
    live.put(thy)
    const cache = new LiveCache({
      redisLive: {} as Redis,
      codes: testAirlineCodes,
      blocklist: () => new Set(),
      log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
      now: () => T0,
      pollMs: 10,
      readers: live.readers,
    })
    cache.start()
    cache.start() // ikinci çağrı ikinci döngü açmaz
    await vi.waitFor(() => expect(live.state.sinceArgs.length).toBeGreaterThanOrEqual(3))
    await cache.stop()
    expect(cache.get('4bb1a2')).toBeDefined()
    const calls = live.state.sinceArgs.length
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(live.state.sinceArgs.length).toBe(calls)
  })

  it('yanıt vermeyen okuma turu dondurmaz: süre dolunca son durumla biter, budama sürer', async () => {
    const live = fakeLive()
    live.put(thy)
    const clock = { t: T0 }
    let hang = false
    const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn() }
    const cache = new LiveCache({
      redisLive: {} as Redis,
      codes: testAirlineCodes,
      blocklist: () => new Set(),
      log,
      now: () => clock.t,
      readTimeoutMs: 20,
      readers: {
        ...live.readers,
        changedSince: (redis, since) =>
          hang ? new Promise(() => undefined) : live.readers.changedSince(redis, since),
      },
    })
    await cache.tick()
    hang = true
    clock.t += 1_000
    expect(await cache.tick()).toBeNull()
    expect(cache.get('4bb1a2')).toBeDefined()
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'live state could not be read; serving last state',
    )
    clock.t = T0 + 125_000
    expect((await cache.tick())?.removed.map((r) => r.hex)).toEqual(['4bb1a2'])
  })

  it('eşzamanlı tick çağrısı turu ikiye katlamaz', async () => {
    const { cache, live } = setup()
    live.put(thy)
    const [first, second] = await Promise.all([cache.tick(), cache.tick()])
    expect(first?.seq).toBe(1)
    expect(second).toBeNull()
    expect(live.state.sinceArgs).toHaveLength(1)
  })
})

describe('LiveCache canlı katman (D-115)', () => {
  it('kapanınca görünür küme boşalır: çıkarma farkı statusChanged taşır, durum off', async () => {
    const { cache, live, layer } = setup()
    live.put(thy, pgt)
    await cache.tick()
    expect(cache.status().layer).toBe('on')
    layer.on = false
    const diff = await cache.tick()
    expect(diff?.statusChanged).toBe(true)
    expect(diff?.added).toEqual([])
    expect(diff?.removed.map((r) => r.hex).sort()).toEqual(['4ba9c1', '4bb1a2'])
    expect(cache.status().layer).toBe('off')
    expect(cache.snapshot()).toEqual([])
    expect(cache.get('4bb1a2')).toBeUndefined()
    // Kapalıyken kayıt gelse de görünmez; fark yoktur.
    live.put({ ...thy, sampleTime: T0 - 1_000 })
    expect(await cache.tick()).toBeNull()
    expect(cache.snapshot()).toEqual([])
  })

  it('uçak yokken değişim de boş bir fark olarak gönderilir (seq artar)', async () => {
    const { cache, layer } = setup()
    expect(await cache.tick()).toBeNull()
    const seq = cache.seq()
    const heard: unknown[] = []
    cache.onTick((d) => heard.push(d))
    layer.on = false
    const off = await cache.tick()
    expect(off).toEqual({ seq: seq + 1, added: [], updated: [], removed: [], statusChanged: true })
    expect(heard).toHaveLength(1)
    expect(await cache.tick()).toBeNull()
    layer.on = true
    expect((await cache.tick())?.statusChanged).toBe(true)
    expect(cache.seq()).toBe(seq + 2)
  })

  it('yeniden açılınca uçaklar eklenir; ilk turdan önceki durum anahtarın kendisidir', async () => {
    const { cache, live, layer } = setup()
    layer.on = false
    expect(cache.status().layer).toBe('off')
    live.put(thy)
    // İlk tur: katman kapalı, değişim sayılmaz (önceki tur yok), görünür küme boş.
    expect(await cache.tick()).toBeNull()
    layer.on = true
    const diff = await cache.tick()
    expect(diff?.statusChanged).toBe(true)
    expect(hexesOf(diff?.added ?? [])).toEqual(['4bb1a2'])
    expect(cache.status().layer).toBe('on')
  })
})

describe('LiveCache seyrek veri (D-122)', () => {
  /** Bütçe kipindeki worker'ın kaydı: durum limited, ömür 660 sn. */
  const budgetRecord = (at: number, extra: Record<string, string> = {}) => ({
    status: 'limited',
    primaryAgeS: '150',
    liveTtlS: '660',
    mode: 'budget',
    updatedAt: String(at),
    ...extra,
  })

  it('db ve shared sabitleri aynıdır: varsayılan pencere ve üst sınır', () => {
    expect(LIVE_DEFAULT_MAX_AGE_S).toBe(LIVE_TTL_SECONDS)
    expect(LIVE_MAX_AGE_LIMIT_S).toBe(LIVE_TTL_MAX_SECONDS)
    expect(LIVE_CACHE_DEFAULTS.maxAgeMs).toBe(LIVE_TTL_SECONDS * 1_000)
    expect(LIVE_MAX_AGE_LIMIT_MS).toBe(LIVE_TTL_MAX_SECONDS * 1_000)
  })

  it('limited durumu olduğu gibi geçer (down sayılmaz); yaş penceresi kayıttaki ömürdür', async () => {
    const { cache, live } = setup()
    live.providers.set('adsbLol', budgetRecord(T0))
    live.providers.set('localReceiver', { status: 'ok', updatedAt: String(T0) })
    await cache.tick()
    expect(cache.status()).toEqual({
      providers: { adsbLol: 'limited', localReceiver: 'ok' },
      primaryAgeS: 150,
      newestAgeS: null,
      layer: 'on',
      maxAgeS: 660,
    })
  })

  it('iki sorgu arasında uçak düşmez: 300 sn önceki örnek ömür boyunca sunulur, sonra budanır', async () => {
    const { cache, live, clock } = setup()
    live.providers.set('adsbLol', budgetRecord(T0))
    const old = aircraftState({ hex: '4bb1a7', callsign: 'THY7', sampleTime: T0 - 300_000 })
    live.put(old)
    // İlk tur pencereyi henüz bilmez (kayıt aynı turda okunur); sonraki tur 660 sn'yi kullanır.
    await cache.tick()
    clock.t += 1_000
    const diff = await cache.tick()
    expect(diff?.added.map((a) => a.hex)).toEqual(['4bb1a7'])
    expect(live.state.sinceArgs.at(-1)).toBe(clock.t - 660_000)
    // Sonraki sorgu gelene kadar (180 sn) ve bir sorgu kaçsa da (360 sn) uçak görünür kalır.
    for (const at of [T0 + 180_000, T0 + 359_000]) {
      clock.t = at
      live.providers.set('adsbLol', budgetRecord(at))
      await cache.tick()
      expect(cache.get('4bb1a7'), String(at)).toBeDefined()
    }
    // Örnek 660 sn'yi geçince budanır.
    clock.t = T0 + 361_000
    expect((await cache.tick())?.removed.map((r) => r.hex)).toEqual(['4bb1a7'])
  })

  it('ömür tabanla 1.800 sn arasına kırpılır; alan yoksa ya da bozuksa taban', async () => {
    const { cache, live, clock } = setup()
    const cases: [Record<string, string>, number][] = [
      [{ liveTtlS: '7200' }, LIVE_MAX_AGE_LIMIT_S],
      [{ liveTtlS: '30' }, LIVE_DEFAULT_MAX_AGE_S],
      [{ liveTtlS: '660' }, 660],
      [{ liveTtlS: 'abc' }, LIVE_DEFAULT_MAX_AGE_S],
      [{ liveTtlS: '' }, LIVE_DEFAULT_MAX_AGE_S],
    ]
    for (const [extra, expected] of cases) {
      live.providers.set('adsbLol', budgetRecord(clock.t, extra))
      await cache.tick()
      expect(cache.status().maxAgeS, JSON.stringify(extra)).toBe(expected)
      clock.t += AUX_REFRESH_MS
    }
    // Eski worker alanı hiç yazmaz: taban.
    live.providers.set('adsbLol', { status: 'ok', updatedAt: String(clock.t) })
    await cache.tick()
    expect(cache.status().maxAgeS).toBe(LIVE_DEFAULT_MAX_AGE_S)
  })

  it('kayıt kaybolursa son pencere kalır (uçaklar birden düşmez); okuma hatasında da', async () => {
    const { cache, live, clock } = setup()
    live.providers.set('adsbLol', budgetRecord(T0))
    live.put(aircraftState({ hex: '4bb1a7', sampleTime: T0 - 300_000 }))
    await cache.tick()
    clock.t += 1_000
    await cache.tick()
    expect(cache.get('4bb1a7')).toBeDefined()
    live.providers.delete('adsbLol')
    clock.t += AUX_REFRESH_MS
    await cache.tick()
    expect(cache.status()).toMatchObject({ providers: { adsbLol: 'down' }, maxAgeS: 660 })
    expect(cache.get('4bb1a7')).toBeDefined()
    live.state.fail = true
    clock.t += AUX_REFRESH_MS
    await cache.tick()
    expect(cache.status().maxAgeS).toBe(660)
    expect(cache.get('4bb1a7')).toBeDefined()
  })

  it('yerel alıcı ya da kayıtsız kurulumda pencere 120 sn kalır', async () => {
    const { cache, live } = setup()
    live.providers.set('localReceiver', { status: 'ok', liveTtlS: '900', updatedAt: String(T0) })
    await cache.tick()
    expect(cache.status().maxAgeS).toBe(120)
    expect(live.state.sinceArgs.at(-1)).toBe(T0 - 120_000)
  })
})
