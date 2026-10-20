import Fastify, { type FastifyInstance } from 'fastify'
import type WebSocket from 'ws'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { allowedOrigins } from '../app'
import { parseEnv, type Env } from '../env'
import { aircraft, FakeLiveSource, FakeSocket, type WsMessage } from './test/ws-fakes'
import type { Bbox, PublicAircraft } from './types'
import {
  closeLiveSockets,
  registerLiveWs,
  WS_RATE_LIMIT,
  wsAllowedOrigins,
  wsRateLimit,
} from './ws'
import { LiveHub, WS_LIMITS, type HubClient } from './ws-hub'
import {
  CellTracker,
  cellKey,
  cellRange,
  diffMessage,
  encodeCell,
  inCellRange,
  mergeCellChanges,
  parseClientMessage,
  type CellChange,
} from './ws-protocol'

// İstanbul hücresi 20:14 (40–42° K, 28–30° D); Ankara 19:16.
const V_IST: Bbox = { minLon: 28.2, minLat: 40.5, maxLon: 29.5, maxLat: 41.5 }
const V_ANK: Bbox = { minLon: 32.2, minLat: 39.2, maxLon: 33.5, maxLat: 39.9 }
/** 20:14 ve 20:15 hücrelerini görür. */
const V_WIDE: Bbox = { minLon: 28.2, minLat: 40.5, maxLon: 31.0, maxLat: 41.5 }

const a1 = aircraft('4bb001', 41.0, 29.0)
/** 20:14 hücresinde ama İstanbul görünümünün dışında (enlem 40.2 < 40.5). */
const a2 = aircraft('4bb002', 40.2, 28.1, { cs: 'PGT2AB', fn: null, reg: 'TC-NBA' })
const b1 = aircraft('4bb101', 39.5, 32.8, { cs: 'AJA1A', fn: null, reg: 'TC-AJA' })

const silentLog = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })

function subscribeText(viewport: Bbox, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ type: 'subscribe', viewport, zoom: 8, ...extra })
}

function hexes(list: unknown): string[] {
  return (list as PublicAircraft[]).map((ac) => ac.hex)
}

function cellsOf(message: WsMessage | undefined) {
  return (message?.cells ?? []) as {
    c: string
    added: PublicAircraft[]
    updated: PublicAircraft[]
    removed: string[]
  }[]
}

describe('protokol yardımcıları', () => {
  it('hücre anahtarı 2° ızgarasıdır, negatif koordinatlar aşağı yuvarlanır', () => {
    expect(cellKey(41.26, 28.74)).toBe('20:14')
    expect(cellKey(40, 28)).toBe('20:14')
    expect(cellKey(-0.5, -0.5)).toBe('-1:-1')
    const range = cellRange(V_WIDE)
    expect(range).toEqual({ lat0: 20, lat1: 20, lon0: 14, lon1: 15 })
    expect(inCellRange(range, 20, 15)).toBe(true)
    expect(inCellRange(range, 20, 16)).toBe(false)
  })

  it('subscribe mesajını doğrular; REST bbox kuralına uymayan görünüm reddedilir', () => {
    expect(parseClientMessage(subscribeText(V_IST, { lastSeq: 7, extra: 1 }))).toEqual({
      type: 'subscribe',
      viewport: V_IST,
      zoom: 8,
      lastSeq: 7,
    })
    const bad = [
      '{bozuk',
      JSON.stringify({ type: 'unsubscribe' }),
      subscribeText({ minLon: 0, minLat: 0, maxLon: 61, maxLat: 10 }),
      subscribeText({ minLon: 10, minLat: 0, maxLon: 10, maxLat: 10 }),
      subscribeText({ minLon: 0, minLat: 0, maxLon: 10, maxLat: 41 }),
      subscribeText({ minLon: -181, minLat: 0, maxLon: 10, maxLat: 10 }),
      subscribeText(V_IST, { zoom: 25 }),
      subscribeText(V_IST, { lastSeq: -1 }),
      subscribeText(V_IST, { lastSeq: 1.5 }),
      JSON.stringify({ type: 'subscribe', viewport: { ...V_IST, minLon: '28' }, zoom: 8 }),
    ]
    for (const text of bad) expect(parseClientMessage(text), text).toBeNull()
  })

  it('hücre değiştiren uçak eski hücreden silinir, yeni hücreye eklenir', () => {
    const tracker = new CellTracker()
    tracker.reset([a1, a2])
    const moved = { ...a1, lon: 30.5 }
    const changes = tracker.apply({
      seq: 1,
      added: [b1],
      updated: [moved, { ...a2, lat: 40.3 }],
      removed: [],
    })
    expect(changes.get('20:14')).toMatchObject({
      removed: ['4bb001'],
      updated: [{ hex: '4bb002' }],
    })
    expect(changes.get('20:15')).toMatchObject({ added: [moved], updated: [], removed: [] })
    expect(changes.get('19:16')?.added).toEqual([b1])
    // Silinen uçağın hücresi izlenen hücredir.
    const removal = tracker.apply({
      seq: 2,
      added: [],
      updated: [],
      removed: [{ hex: '4bb001', lat: 0, lon: 0 }],
    })
    expect([...removal.keys()]).toEqual(['20:15'])
    expect(tracker.size).toBe(2)
  })

  it('turları hücre ve hex başına son olayla birleştirir', () => {
    const change = (key: string, part: Partial<CellChange>): Map<string, CellChange> => {
      const [lat, lon] = key.split(':').map(Number)
      return new Map([
        [
          key,
          {
            key,
            latIndex: lat ?? 0,
            lonIndex: lon ?? 0,
            added: [],
            updated: [],
            removed: [],
            ...part,
          },
        ],
      ])
    }
    const merged = mergeCellChanges([
      change('20:14', { added: [a1], updated: [a2] }),
      change('20:14', { updated: [{ ...a1, alt: 13_000 }], removed: ['4bb002'] }),
      change('20:15', { added: [{ ...b1, lat: 41, lon: 30.5 }] }),
      change('20:15', { removed: ['4bb101'] }),
      change('20:15', { added: [{ ...b1, lat: 41, lon: 30.6 }] }),
    ])
    expect(merged.get('20:14')).toMatchObject({
      added: [{ hex: '4bb001', alt: 13_000 }],
      updated: [],
      removed: ['4bb002'],
    })
    expect(merged.get('20:15')).toMatchObject({ added: [{ lon: 30.6 }], removed: [] })
  })

  it('diff mesajı ortak parçalardan geçerli JSON olarak kurulur', () => {
    const one = encodeCell({
      key: '20:14',
      latIndex: 20,
      lonIndex: 14,
      added: [a1],
      updated: [],
      removed: ['abc123'],
    })
    const two = encodeCell({
      key: '20:15',
      latIndex: 20,
      lonIndex: 15,
      added: [],
      updated: [],
      removed: ['def456'],
    })
    const prefix = Buffer.from('{"type":"diff","seq":3,"status":{},"cells":[')
    expect(JSON.parse(diffMessage(prefix, [one, two]).toString())).toEqual({
      type: 'diff',
      seq: 3,
      status: {},
      cells: [
        { c: '20:14', added: [a1], updated: [], removed: ['abc123'] },
        { c: '20:15', added: [], updated: [], removed: ['def456'] },
      ],
    })
    expect(JSON.parse(diffMessage(prefix, []).toString()).cells).toEqual([])
  })
})

describe('LiveHub', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-09-28T12:00:00Z') })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function setup(
    options: { maxConnections?: number; random?: () => number; totalBufferBytes?: number } = {},
  ) {
    const source = new FakeLiveSource([a1, a2, b1], 10)
    const log = silentLog()
    const hub = new LiveHub({
      source,
      log,
      maxConnections: options.maxConnections ?? 50,
      random: options.random ?? (() => 0.5),
      totalBufferBytes: options.totalBufferBytes,
    })
    hub.start()
    const connect = (ip = '203.0.113.1') => {
      const socket = new FakeSocket()
      const client = hub.connect(socket, ip)
      if (client) socket.onClose = () => hub.disconnected(client)
      return { socket, client }
    }
    const subscribe = (
      c: { client: HubClient | null },
      viewport: Bbox = V_IST,
      extra: Record<string, unknown> = {},
    ) => {
      if (!c.client) throw new Error('client rejected')
      hub.message(c.client, subscribeText(viewport, extra))
    }
    return { source, hub, log, connect, subscribe }
  }

  it('abonelik görünümdeki uçakların tam görüntüsünü metin çerçevesiyle gönderir', () => {
    const { connect, subscribe } = setup()
    const c = connect()
    subscribe(c)
    expect(c.socket.frames).toHaveLength(1)
    expect(c.socket.frames[0]?.binary).toBe(false)
    const snapshot = c.socket.last()
    expect(snapshot).toMatchObject({
      type: 'snapshot',
      seq: 10,
      coverage: 'full',
      status: { providers: { adsbLol: 'ok' }, primaryAgeS: 4, newestAgeS: 1 },
    })
    expect(hexes(snapshot?.aircraft)).toEqual(['4bb001'])
  })

  it('tam görüntü canlı veri lisansını, atfını ve katman durumunu taşır (D-115)', () => {
    const { connect, subscribe } = setup()
    const c = connect()
    subscribe(c)
    expect(c.socket.last()).toMatchObject({
      type: 'snapshot',
      status: { layer: 'on' },
      license: 'ODbL-1.0',
      licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
      attribution: 'ADSB.lol',
    })
  })

  it('statusChanged turu görünümü boş istemciler dahil herkese tam görüntü gönderir (D-115)', () => {
    const { source, connect, subscribe } = setup()
    const ist = connect('203.0.113.1')
    // Uçaksız görünüm: boş diff gönderilmediği için haberi ancak tam görüntüyle alır.
    const empty = connect('203.0.113.2')
    subscribe(ist, V_IST)
    subscribe(empty, { minLon: 40, minLat: 37, maxLon: 41, maxLat: 38 })
    vi.advanceTimersByTime(1_000)
    const before = { ist: ist.socket.frames.length, empty: empty.socket.frames.length }
    // Katman kapandı: uçaklar çıkar, durum off olur.
    source.liveStatus = { ...source.liveStatus, layer: 'off' }
    source.tick({ remove: ['4bb001', '4bb002', '4bb101'], statusChanged: true })
    expect(ist.socket.frames.length).toBe(before.ist + 1)
    expect(ist.socket.last()).toMatchObject({
      type: 'snapshot',
      seq: 11,
      status: { layer: 'off' },
      aircraft: [],
    })
    expect(empty.socket.frames.length).toBe(before.empty + 1)
    expect(empty.socket.last()).toMatchObject({ type: 'snapshot', status: { layer: 'off' } })

    // Uçaksız bir durum turu da (fark boş) tam görüntü gönderir.
    vi.advanceTimersByTime(1_000)
    source.liveStatus = { ...source.liveStatus, layer: 'on' }
    source.tick({ statusChanged: true })
    expect(empty.socket.last()).toMatchObject({
      type: 'snapshot',
      seq: 12,
      status: { layer: 'on' },
    })
    // Sıradan boş olmayan tur görünümü boş istemciye bir şey göndermez.
    vi.advanceTimersByTime(1_000)
    const count = empty.socket.frames.length
    source.tick({ upsert: [{ ...a1, lat: 41.2 }] })
    expect(empty.socket.frames.length).toBe(count)
  })

  it('diff yalnızca görünümle kesişen hücreleri taşır; değişiklik yoksa mesaj gitmez', () => {
    const { source, connect, subscribe } = setup()
    const ist = connect('203.0.113.1')
    const ank = connect('203.0.113.2')
    subscribe(ist, V_IST)
    subscribe(ank, V_ANK)
    vi.advanceTimersByTime(1_000)
    const moved = { ...a1, lat: 41.1 }
    const inCellOutsideView = { ...a2, lat: 40.25 }
    source.tick({ upsert: [moved, inCellOutsideView, { ...b1, lon: 34.5 }] })
    const diff = ist.socket.last()
    expect(diff).toMatchObject({ type: 'diff', seq: 11, status: { primaryAgeS: 4 } })
    expect(cellsOf(diff)).toEqual([
      { c: '20:14', added: [], updated: [moved, inCellOutsideView], removed: [] },
    ])
    // Ankara görünümü (19:16): b1 hücre değiştirdi, eski hücresinde silindi.
    expect(cellsOf(ank.socket.last())).toEqual([
      { c: '19:16', added: [], updated: [], removed: ['4bb101'] },
    ])

    ank.socket.clear()
    ist.socket.clear()
    source.tick({ upsert: [{ ...a1, lat: 41.2 }] })
    vi.advanceTimersByTime(1_000)
    expect(ist.socket.last()).toMatchObject({ type: 'diff', seq: 12 })
    expect(ank.socket.frames).toHaveLength(0)
  })

  it('hücre parçası turda bir kez serileştirilir; bütün istemciler aynı Buffer’ı kullanır', () => {
    const { source, hub, connect, subscribe } = setup()
    const clients = ['198.51.100.1', '198.51.100.2', '198.51.100.3'].map((ip) => connect(ip))
    for (const c of clients) subscribe(c)
    vi.advanceTimersByTime(1_000)
    const before = hub.stats().cellEncodes
    source.tick({
      upsert: [
        { ...a1, lat: 41.05 },
        { ...b1, lat: 39.6 },
      ],
    })
    // Üç istemci aynı hücreyi görüyor: 20:14 bir kez serileştirildi; 19:16'yı gören yok.
    expect(hub.stats().cellEncodes - before).toBe(1)
    const fragments = hub.fragmentsSince(10, V_IST)
    expect(fragments).toHaveLength(1)
    const [fragment] = fragments ?? []
    if (!fragment) throw new Error('fragment missing')
    expect(hub.fragmentsSince(10, V_IST)?.[0]).toBe(fragment)
    expect(hub.stats().cellEncodes - before).toBe(1)
    for (const c of clients) {
      const frame = c.socket.frames.at(-1)?.data
      expect(Buffer.isBuffer(frame)).toBe(true)
      expect((frame as Buffer).includes(fragment)).toBe(true)
    }
  })

  it('istemci başına saniyede en fazla bir diff gider; arada biriken turlar birleşir', () => {
    const { source, connect, subscribe } = setup()
    const c = connect()
    subscribe(c)
    vi.advanceTimersByTime(1_000)
    c.socket.clear()
    for (let i = 1; i <= 8; i++) {
      source.tick({ upsert: [{ ...a1, lat: 41 + i / 100, t: a1.t + i * 250 }] })
      vi.advanceTimersByTime(250)
    }
    vi.advanceTimersByTime(1_000)
    const diffs = c.socket.frames.filter((f) => JSON.parse(f.data.toString()).type === 'diff')
    expect(diffs.length).toBeGreaterThanOrEqual(2)
    expect(diffs.length).toBeLessThanOrEqual(3)
    for (let i = 1; i < diffs.length; i++) {
      expect((diffs[i]?.at ?? 0) - (diffs[i - 1]?.at ?? 0)).toBeGreaterThanOrEqual(1_000)
    }
    const last = c.socket.last()
    expect(last?.seq).toBe(18)
    expect(cellsOf(last)[0]?.updated).toEqual([{ ...a1, lat: 41.08, t: a1.t + 2_000 }])
  })

  it('lastSeq tampondaysa eksik turlar tek diff olarak gelir', () => {
    const { source, connect, subscribe } = setup()
    const first = connect()
    subscribe(first)
    expect(first.socket.last()?.seq).toBe(10)
    first.socket.close(1000, 'bye')

    source.tick({ upsert: [{ ...a1, lat: 41.1 }] }) // 11
    source.tick({ upsert: [{ ...b1, lat: 39.4 }] }) // 12, görünüm dışı
    const newcomer = aircraft('4bb003', 41.3, 29.3, { cs: 'THY1', reg: 'TC-LGA' })
    source.tick({ upsert: [{ ...a1, lat: 41.2 }, newcomer] }) // 13
    source.tick({ remove: ['4bb002'] }) // 14

    const again = connect()
    subscribe(again, V_IST, { lastSeq: 10 })
    expect(again.socket.frames).toHaveLength(1)
    const diff = again.socket.last()
    expect(diff).toMatchObject({ type: 'diff', seq: 14 })
    expect(cellsOf(diff)).toEqual([
      { c: '20:14', added: [newcomer], updated: [{ ...a1, lat: 41.2 }], removed: ['4bb002'] },
    ])
  })

  it('lastSeq güncelse boş diff, ilerideyse, tampon dışındaysa ya da sonraki abonelikteyse tam görüntü', () => {
    const { source, connect, subscribe } = setup()
    const current = connect('203.0.113.1')
    subscribe(current, V_IST, { lastSeq: 10 })
    expect(current.socket.last()).toMatchObject({ type: 'diff', seq: 10, cells: [] })

    const ahead = connect('203.0.113.2')
    subscribe(ahead, V_IST, { lastSeq: 500 })
    expect(ahead.socket.last()?.type).toBe('snapshot')

    source.historyLimit = 2
    for (let i = 1; i <= 3; i++) source.tick({ upsert: [{ ...a1, lat: 41 + i / 100 }] })
    const old = connect('203.0.113.3')
    subscribe(old, V_IST, { lastSeq: 10 })
    expect(old.socket.last()).toMatchObject({ type: 'snapshot', seq: 13 })

    // Kaynağın tamponu yetse de merkezin hücre geçmişi (120 tur) yetmiyorsa tam görüntü.
    source.historyLimit = 500
    for (let i = 1; i <= WS_LIMITS.historyTicks + 2; i++) {
      source.tick({ upsert: [{ ...a1, t: a1.t + i }] })
    }
    const stale = connect('203.0.113.4')
    subscribe(stale, V_IST, { lastSeq: 13 })
    expect(stale.socket.last()?.type).toBe('snapshot')

    // Bağlantının ikinci aboneliği lastSeq taşısa da tam görüntü alır.
    vi.advanceTimersByTime(WS_LIMITS.subscribeIntervalMs)
    subscribe(current, V_IST, { lastSeq: source.seq() })
    expect(current.socket.last()?.type).toBe('snapshot')
  })

  it('görünüm değişikliği tam görüntü getirir; sık abonelikte yalnızca sonuncusu işlenir', () => {
    const { connect, subscribe } = setup()
    const c = connect()
    subscribe(c, V_IST)
    subscribe(c, V_ANK)
    vi.advanceTimersByTime(100)
    subscribe(c, V_WIDE)
    expect(c.socket.frames).toHaveLength(1)
    vi.advanceTimersByTime(WS_LIMITS.subscribeIntervalMs - 100)
    expect(c.socket.frames).toHaveLength(2)
    expect(c.socket.last()?.type).toBe('snapshot')
    expect(hexes(c.socket.last()?.aircraft)).toEqual(['4bb001'])
    vi.advanceTimersByTime(1_000)
    subscribe(c, V_ANK)
    expect(hexes(c.socket.last()?.aircraft)).toEqual(['4bb101'])
  })

  it('geri basınç: 1 MiB üstünde diff atlanır ve sonra tam görüntü gider, 4 MiB üstünde koparılır', () => {
    const { source, hub, connect, subscribe } = setup()
    const c = connect()
    subscribe(c)
    vi.advanceTimersByTime(1_000)
    c.socket.clear()

    c.socket.bufferedAmount = WS_LIMITS.softBufferBytes
    source.tick({ upsert: [{ ...a1, lat: 41.1 }] })
    expect(c.socket.last()?.type).toBe('diff')

    vi.advanceTimersByTime(1_000)
    c.socket.clear()
    c.socket.bufferedAmount = WS_LIMITS.softBufferBytes + 1
    source.tick({ upsert: [{ ...a1, lat: 41.2 }] })
    expect(c.socket.frames).toHaveLength(0)
    expect(hub.stats().backpressureSkips).toBe(1)

    c.socket.bufferedAmount = 0
    source.tick({ upsert: [{ ...b1, lat: 39.4 }] })
    const snapshot = c.socket.last()
    expect(snapshot).toMatchObject({ type: 'snapshot', seq: 13 })
    expect(snapshot?.aircraft).toEqual([{ ...a1, lat: 41.2 }])

    vi.advanceTimersByTime(1_000)
    c.socket.bufferedAmount = WS_LIMITS.hardBufferBytes + 1
    source.tick({ upsert: [{ ...a1, lat: 41.3 }] })
    // close() okumayan istemcinin tamponunu 30 sn tutar; terminate() hemen bırakır.
    expect(c.socket.terminated).toBe(true)
    expect(c.socket.closed).toBeNull()
    expect(hub.stats().backpressureCloses).toBe(1)
  })

  it('toplam tampon bütçesi aşılınca en çok biriktirenler koparılır, koparılan sayılmaz', () => {
    const MiB = 1024 * 1024
    const { source, hub, connect, subscribe } = setup({ totalBufferBytes: 3 * MiB })
    const clients = [0.9, 1.2, 1.5, 0.2, 0].map((mib, i) => {
      const c = connect(`203.0.113.${i}`)
      subscribe(c)
      c.socket.bufferedAmount = mib * MiB
      c.socket.closesOnRequest = false // kapanış el sıkışması sürer; istemci merkezde kalır
      return c
    })
    vi.advanceTimersByTime(1_000)
    // Toplam 3,8 MiB > 3 MiB: yalnızca en büyüğü (1,5 MiB) kapatılır, kalan 2,3 MiB.
    source.tick({ upsert: [{ ...a1, lat: 41.1 }] })
    expect(clients.map((c) => c.socket.terminated)).toEqual([false, false, true, false, false])
    expect(hub.stats().budgetCloses).toBe(1)
    // Kapanmakta olan istemcinin tamponu sonraki turda sayılmaz: yeni kapatma yok.
    vi.advanceTimersByTime(1_000)
    source.tick({ upsert: [{ ...a1, lat: 41.2 }] })
    expect(hub.stats().budgetCloses).toBe(1)
    // Biri büyüdü: toplam yeniden aşıldı, şimdi en büyük o.
    const grown = clients[0]
    if (!grown) throw new Error('client missing')
    grown.socket.bufferedAmount = 2 * MiB
    vi.advanceTimersByTime(1_000)
    source.tick({ upsert: [{ ...a1, lat: 41.3 }] })
    expect(grown.socket.terminated).toBe(true)
    expect(clients[1]?.socket.terminated).toBe(false)
    expect(hub.stats().budgetCloses).toBe(2)
  })

  it('varsayılan 64 MiB bütçe: 76 MiB tutan 70 istemciden yalnızca en büyük altısı koparılır', () => {
    const MiB = 1024 * 1024
    expect(WS_LIMITS.totalBufferBytes).toBe(64 * MiB)
    const { source, hub, connect, subscribe } = setup({ maxConnections: 100 })
    const clients = Array.from({ length: 70 }, (_, i) => {
      const c = connect(`198.51.100.${Math.floor(i / WS_LIMITS.perIp)}`)
      subscribe(c)
      c.socket.bufferedAmount = (i % 10 === 3 && i < 60 ? 2 : 1) * MiB
      return c
    })
    vi.advanceTimersByTime(1_000)
    source.tick({ upsert: [{ ...a1, lat: 41.1 }] })
    const closed = clients.filter((c) => c.socket.terminated)
    expect(closed).toHaveLength(6)
    expect(closed.every((c) => c.socket.bufferedAmount === 2 * MiB)).toBe(true)
    expect(closed.every((c) => c.socket.closed === null)).toBe(true)
    expect(hub.stats().budgetCloses).toBe(6)
  })

  it('soket başına saniyede bir abonelik: arada gelenler birleşir, en son görünüm işlenir', () => {
    const { hub, connect, subscribe } = setup()
    const c = connect()
    subscribe(c, V_IST)
    for (let i = 0; i < 20; i++) {
      subscribe(c, i % 2 === 0 ? V_WIDE : V_ANK)
      vi.advanceTimersByTime(40)
    }
    const snapshots = () => c.socket.messages().filter((m) => m.type === 'snapshot')
    expect(snapshots()).toHaveLength(1)
    vi.advanceTimersByTime(WS_LIMITS.subscribeIntervalMs - 800)
    expect(snapshots()).toHaveLength(2)
    expect(hexes(snapshots()[1]?.aircraft)).toEqual(['4bb101'])
    expect(c.client?.viewport).toEqual(V_ANK)
    expect(hub.stats().snapshots).toBe(2)
    expect(hub.stats().deferredSubscribes).toBe(1)
  })

  it('IP bütçesi (dakikada 120) o IP’nin soketlerince paylaşılır; fazlası ertelenir, atılmaz', () => {
    const { hub, connect, subscribe } = setup()
    const ip = '203.0.113.7'
    const sockets = Array.from({ length: WS_LIMITS.perIp }, () => connect(ip))
    const views = [V_IST, V_ANK, V_WIDE]
    const requested: Bbox[] = sockets.map(() => V_IST)
    let n = 0
    const snapshotCount = () =>
      sockets.reduce(
        (sum, c) => sum + c.socket.messages().filter((m) => m.type === 'snapshot').length,
        0,
      )
    // Her soket 100 ms'de bir abonelik gönderir (saniyede 100 istek) — bir dakika boyunca.
    const flood = () => {
      for (let step = 0; step < 600; step++) {
        sockets.forEach((c, i) => {
          const view = views[n++ % views.length] ?? V_IST
          requested[i] = view
          subscribe(c, view)
          if (c.client) hub.pong(c.client) // canlı istemci: ping sonlandırması devreye girmez
        })
        vi.advanceTimersByTime(100)
      }
    }
    flood()
    // Dolu kova (120) + 60 sn'de dolan 120: REST'in sabit penceresinin sınırda izin verdiğiyle aynı.
    const firstMinute = snapshotCount()
    expect(firstMinute).toBeLessThanOrEqual(2 * WS_LIMITS.ipSubscribesPerMinute)
    expect(firstMinute).toBeGreaterThanOrEqual(2 * WS_LIMITS.ipSubscribesPerMinute - 10)
    for (const c of sockets) {
      const own = c.socket.messages().filter((m) => m.type === 'snapshot').length
      expect(own).toBeLessThanOrEqual(61)
    }
    for (const c of sockets) c.socket.clear()
    flood()
    // Kararlı durumda dakikada 120.
    const secondMinute = snapshotCount()
    expect(secondMinute).toBeLessThanOrEqual(WS_LIMITS.ipSubscribesPerMinute + 1)
    expect(secondMinute).toBeGreaterThanOrEqual(WS_LIMITS.ipSubscribesPerMinute - 10)

    // Başka IP etkilenmez.
    const other = connect('203.0.113.8')
    subscribe(other)
    expect(other.socket.last()?.type).toBe('snapshot')

    // Akış durunca her soket en son istediği görünümün tam görüntüsünü alır (tur yok: son çerçeve
    // son tam görüntüdür).
    vi.advanceTimersByTime(10_000)
    sockets.forEach((c, i) => {
      expect(c.client?.pendingSubscribe).toBeNull()
      expect(c.client?.viewport).toEqual(requested[i])
      const last = c.socket.last()
      expect(last?.type).toBe('snapshot')
      expect(hexes(last?.aircraft)).toEqual(requested[i] === V_ANK ? ['4bb101'] : ['4bb001'])
    })
  })

  it('lastSeq ile devam eden diff o anki durumu taşır (son turun durumunu değil)', () => {
    const { source, connect, subscribe } = setup()
    const watcher = connect('203.0.113.1')
    subscribe(watcher)
    vi.advanceTimersByTime(1_000)
    source.tick({ upsert: [{ ...a1, lat: 41.1 }] }) // 11: turda ortak baş kurulur
    expect(watcher.socket.last()).toMatchObject({
      type: 'diff',
      seq: 11,
      status: { primaryAgeS: 4 },
    })
    // Veri kesintisi: tur gelmez, durum değişir.
    source.liveStatus = {
      providers: { adsbLol: 'down' },
      primaryAgeS: 1_900,
      newestAgeS: null,
      layer: 'on',
    }
    vi.advanceTimersByTime(30 * 60_000)
    const current = connect('203.0.113.2')
    subscribe(current, V_IST, { lastSeq: 11 })
    expect(current.socket.last()).toEqual({
      type: 'diff',
      seq: 11,
      status: source.liveStatus,
      cells: [],
    })
    const behind = connect('203.0.113.3')
    subscribe(behind, V_IST, { lastSeq: 10 })
    expect(behind.socket.last()).toMatchObject({ type: 'diff', seq: 11, status: source.liveStatus })
  })

  it('iki ping’e yanıt vermeyen bağlantı sonlandırılır, pong sayacı sıfırlar', async () => {
    const { hub, connect } = setup()
    const alive = connect('203.0.113.1')
    const dead = connect('203.0.113.2')
    if (!alive.client) throw new Error('client rejected')
    vi.advanceTimersByTime(25_000)
    expect([alive.socket.pings, dead.socket.pings]).toEqual([1, 1])
    hub.pong(alive.client)
    vi.advanceTimersByTime(25_000)
    expect([alive.socket.pings, dead.socket.pings]).toEqual([2, 2])
    expect(dead.socket.terminated).toBe(false)
    hub.pong(alive.client)
    vi.advanceTimersByTime(25_000)
    expect(dead.socket.terminated).toBe(true)
    expect(alive.socket.terminated).toBe(false)
    expect(alive.socket.pings).toBe(3)
    await Promise.resolve()
    expect(hub.stats()).toMatchObject({ clients: 1, pingTerminations: 1 })
  })

  it('IP başına 10 bağlantı: 11. bağlantı 1008 ile kapanır, bağlantı kapanınca yer açılır', async () => {
    const { connect } = setup()
    const open = Array.from({ length: WS_LIMITS.perIp }, () => connect('2001:db8:1:2::'))
    expect(open.every((c) => c.client !== null)).toBe(true)
    const rejected = connect('2001:db8:1:2::')
    expect(rejected.client).toBeNull()
    expect(rejected.socket.closed).toEqual({ code: 1008, reason: 'too_many_connections' })
    expect(connect('2001:db8:9:9::').client).not.toBeNull()

    open[0]?.socket.close(1000, 'bye')
    await Promise.resolve()
    expect(connect('2001:db8:1:2::').client).not.toBeNull()
  })

  it('toplam bağlantı sınırında yeni bağlantı 1013 server_busy ile kapanır', () => {
    const { connect, log } = setup({ maxConnections: 3 })
    for (let i = 0; i < 3; i++) expect(connect(`203.0.113.${i}`).client).not.toBeNull()
    const busy = connect('203.0.113.99')
    expect(busy.client).toBeNull()
    expect(busy.socket.closed).toEqual({ code: 1013, reason: 'server_busy' })
    connect('203.0.113.98')
    expect(log.warn).toHaveBeenCalledTimes(1)
  })

  it('hatalı mesaj error alır; 5. hatalı mesajda bağlantı 1008 ile kapanır', () => {
    const { hub, connect } = setup()
    const c = connect()
    if (!c.client) throw new Error('client rejected')
    for (let i = 0; i < WS_LIMITS.badMessages - 1; i++) hub.message(c.client, '{bozuk')
    expect(c.socket.messages()).toEqual(
      Array.from({ length: 4 }, () => ({ type: 'error', code: 'bad_request' })),
    )
    expect(c.socket.closed).toBeNull()
    hub.message(c.client, null) // ikili çerçeve
    expect(c.socket.closed).toEqual({ code: 1008, reason: 'bad_request' })
  })

  it('kaçırılmış turda abone istemciler tam görüntü alır', () => {
    const { source, connect, subscribe } = setup()
    const c = connect()
    subscribe(c)
    vi.advanceTimersByTime(1_000)
    const moved = { ...a1, lat: 41.4 }
    source.skipSilently(3, [moved])
    source.tick({ upsert: [{ ...b1, lat: 39.3 }] })
    expect(c.socket.last()).toMatchObject({ type: 'snapshot', seq: 14, aircraft: [moved] })
  })

  it('closeAll her istemciye reconnect gönderir, 1012 ile kapatır ve yeni bağlantıyı reddeder', async () => {
    const randoms = [0, 0.999_999_9]
    const { hub, connect } = setup({ random: () => randoms.shift() ?? 0.5 })
    const first = connect('203.0.113.1')
    const second = connect('203.0.113.2')
    const closing = hub.closeAll()
    expect(first.socket.messages()).toEqual([{ type: 'reconnect', afterMs: 1_000 }])
    expect(second.socket.messages()).toEqual([{ type: 'reconnect', afterMs: 10_000 }])
    for (const c of [first, second]) {
      expect(c.socket.closed).toEqual({ code: 1012, reason: 'restart' })
    }
    await closing
    expect(hub.stats().clients).toBe(0)

    const late = connect('203.0.113.3')
    expect(late.client).toBeNull()
    expect(late.socket.last()).toEqual({ type: 'reconnect', afterMs: 5_500 })
    expect(late.socket.closed).toEqual({ code: 1012, reason: 'restart' })
  })

  it('closeAll kapanmayan soketi 3 sn sonra sonlandırır ve çözülür', async () => {
    const { hub, connect } = setup()
    const stuck = connect()
    stuck.socket.closesOnRequest = false
    let resolved = false
    const closing = hub.closeAll().then(() => {
      resolved = true
    })
    await vi.advanceTimersByTimeAsync(WS_LIMITS.closeGraceMs - 1)
    expect(resolved).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await closing
    expect(stuck.socket.terminated).toBe(true)
  })

  it('stop kaynak aboneliğini bırakır', () => {
    const { source, hub } = setup()
    expect(source.listenerCount).toBe(1)
    hub.stop()
    expect(source.listenerCount).toBe(0)
  })
})

describe('Fastify bağlaması', () => {
  const apps: FastifyInstance[] = []
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()))
  })

  function env(overrides: Record<string, string> = {}): Env {
    return parseEnv({
      APP_ENV: 'test',
      LOG_LEVEL: 'silent',
      WEB_HOST: 'airline.live',
      ADMIN_HOST: 'admin.airline.live',
      ...overrides,
    })
  }

  async function wired(source: FakeLiveSource | null, ready?: () => boolean) {
    const app = Fastify()
    apps.push(app)
    registerLiveWs(app, { source, ready, env: env(), log: app.log, random: () => 0 })
    await app.ready()
    return app
  }

  /** Dinleyiciler soket açılmadan bağlanır; sunucunun hemen kapattığı bağlantı da yakalanır. */
  async function inject(app: FastifyInstance, headers: Record<string, string> = {}) {
    const messages: WsMessage[] = []
    let onClose: (value: { code: number; reason: string }) => void = () => {}
    const closed = new Promise<{ code: number; reason: string }>((resolve) => {
      onClose = resolve
    })
    const ws: WebSocket = await app.injectWS(
      '/v1/ws',
      { headers },
      {
        onInit: (socket) => {
          socket.on('message', (data) => messages.push(JSON.parse(data.toString()) as WsMessage))
          socket.on('close', (code, reason) => onClose({ code, reason: reason.toString() }))
        },
      },
    )
    const nextMessage = async () => {
      await vi.waitFor(() => expect(messages.length).toBeGreaterThan(0))
      return messages.shift()
    }
    return { ws, closed, nextMessage }
  }

  it('izinli origin listesi app.ts CORS kuralıyla aynıdır', () => {
    const cases: Record<string, string>[] = [
      {},
      { WEB_HOST: '', ADMIN_HOST: '' },
      { WEB_HOST: 'localhost:3100', ADMIN_HOST: '' },
      { WEB_HOST: '127.0.0.1:3100', ADMIN_HOST: 'admin.airline.live' },
    ]
    for (const overrides of cases) {
      const e = env(overrides)
      expect(wsAllowedOrigins(e)).toEqual(allowedOrigins(e))
    }
    expect(wsAllowedOrigins(env())).toEqual(['https://airline.live', 'https://admin.airline.live'])
  })

  it('el sıkışması sınırı üretimde dakikada 30; geliştirme ve testte (StrictMode, iki el sıkışması) 60 (D-088)', () => {
    expect(wsRateLimit('production')).toEqual({ max: 30, timeWindow: '1 minute' })
    expect(wsRateLimit('production')).toBe(WS_RATE_LIMIT)
    expect(wsRateLimit('development')).toEqual({ max: 60, timeWindow: '1 minute' })
    expect(wsRateLimit('test')).toEqual({ max: 60, timeWindow: '1 minute' })
  })

  it('yabancı Origin 1008 ile kapanır; web origin’i ve Origin’siz yerel uygulama kabul edilir', async () => {
    const app = await wired(new FakeLiveSource([a1], 3))
    const foreign = await inject(app, { origin: 'https://evil.example' })
    expect(await foreign.closed).toEqual({ code: 1008, reason: 'origin_not_allowed' })

    const web = await inject(app, { origin: 'https://airline.live' })
    web.ws.send(subscribeText(V_IST))
    expect(await web.nextMessage()).toMatchObject({ type: 'snapshot', seq: 3, aircraft: [a1] })

    const native = await inject(app)
    native.ws.send('{bozuk')
    expect(await native.nextMessage()).toEqual({ type: 'error', code: 'bad_request' })
    web.ws.terminate()
    native.ws.terminate()
  })

  it('canlı kaynak yoksa bağlantı 1013 live_unavailable ile kapanır', async () => {
    const app = await wired(null)
    const { closed } = await inject(app)
    expect(await closed).toEqual({ code: 1013, reason: 'live_unavailable' })
  })

  it('engel listesi yüklenmeden (ready false) bağlantı 1013 live_unavailable ile kapanır', async () => {
    let ready = false
    const app = await wired(new FakeLiveSource([a1], 3), () => ready)
    const early = await inject(app)
    expect(await early.closed).toEqual({ code: 1013, reason: 'live_unavailable' })
    ready = true
    const later = await inject(app)
    later.ws.send(subscribeText(V_IST))
    expect(await later.nextMessage()).toMatchObject({ type: 'snapshot', seq: 3, aircraft: [a1] })
    later.ws.terminate()
  })

  it('closeLiveSockets istemciye reconnect gönderir ve 1012 ile kapatır', async () => {
    const app = await wired(new FakeLiveSource([a1], 3))
    const client = await inject(app)
    await closeLiveSockets()
    expect(await client.nextMessage()).toEqual({ type: 'reconnect', afterMs: 1_000 })
    expect(await client.closed).toEqual({ code: 1012, reason: 'restart' })
  })
})
