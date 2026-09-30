import type { Bbox, LiveServerMessage } from '@havayolu/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clampViewport,
  LiveConnection,
  OFFLINE_AFTER_FAILURES,
  reconnectDelayMs,
  type ConnectionState,
} from './connection'
import { aircraft, FakeTimers, FakeWebSocket, STATUS } from './test/fakes'

const ISTANBUL: Bbox = { minLon: 27, minLat: 40, maxLon: 31, maxLat: 42 }
const ANKARA: Bbox = { minLon: 31, minLat: 38, maxLon: 35, maxLat: 41 }

function setup(random = () => 0.5) {
  const timers = new FakeTimers()
  const messages: LiveServerMessage[] = []
  const states: ConnectionState[] = []
  const connection = new LiveConnection({
    url: 'ws://localhost:4100/v1/ws',
    onMessage: (m) => messages.push(m),
    onState: (s) => states.push(s),
    WebSocketImpl: FakeWebSocket as unknown as { new (url: string): WebSocket },
    random,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  })
  return { connection, timers, messages, states }
}

const snapshot = (seq: number) => ({
  type: 'snapshot',
  seq,
  coverage: 'full',
  status: STATUS,
  aircraft: [aircraft()],
})

beforeEach(() => {
  FakeWebSocket.reset()
})

describe('reconnectDelayMs', () => {
  it('üstel geri çekilmeye 1–10 sn rastgele pay ekler, 60 sn’de durur', () => {
    expect(reconnectDelayMs(0, () => 0)).toBe(2_000)
    expect(reconnectDelayMs(0, () => 1)).toBe(11_000)
    expect(reconnectDelayMs(3, () => 0.5)).toBe(8_000 + 1_000 + 4_500)
    expect(reconnectDelayMs(6, () => 0)).toBe(61_000)
    expect(reconnectDelayMs(50, () => 1)).toBe(70_000)
    expect(reconnectDelayMs(-2, () => 0)).toBe(2_000)
  })
})

describe('clampViewport', () => {
  /** apps/api/src/live/bbox.ts `toBbox` kuralı. */
  const acceptedByApi = (b: Bbox) =>
    [b.minLon, b.minLat, b.maxLon, b.maxLat].every(Number.isFinite) &&
    b.minLat >= -90 &&
    b.maxLat <= 90 &&
    b.minLon >= -180 &&
    b.maxLon <= 180 &&
    b.minLon < b.maxLon &&
    b.minLat < b.maxLat &&
    b.maxLon - b.minLon <= 60 &&
    b.maxLat - b.minLat <= 40

  it('sınır içindeki görünümü değiştirmez', () => {
    expect(clampViewport(ISTANBUL)).toEqual(ISTANBUL)
  })

  it('enlemi ±85’e, boylamı ±180’e kırpar', () => {
    const b = clampViewport({ minLon: 150, minLat: 70, maxLon: 200, maxLat: 89 })
    expect(b.maxLat).toBe(85)
    expect(b.minLat).toBe(70)
    expect(acceptedByApi(b)).toBe(true)
  })

  it('geniş görünümü merkezinin etrafında 60° × 40°’ye daraltır', () => {
    const b = clampViewport({ minLon: -20, minLat: 0, maxLon: 100, maxLat: 70 })
    expect((b.minLon + b.maxLon) / 2).toBeCloseTo(40, 9)
    expect((b.minLat + b.maxLat) / 2).toBeCloseTo(35, 9)
    expect(b.maxLon - b.minLon).toBeCloseTo(60, 5)
    expect(b.maxLat - b.minLat).toBeCloseTo(40, 5)
    expect(acceptedByApi(b)).toBe(true)
  })

  it('dünya kopyasındaki görünümü −180..180’e taşır', () => {
    const b = clampViewport({ minLon: 387, minLat: 40, maxLon: 391, maxLat: 42 })
    expect(b.minLon).toBeCloseTo(27, 9)
    expect(b.maxLon).toBeCloseTo(31, 9)
    const west = clampViewport({ minLon: -333, minLat: 40, maxLon: -329, maxLat: 42 })
    expect(west.minLon).toBeCloseTo(27, 9)
  })

  it('sıfır boyutlu ya da tümüyle dışarıdaki kutudan da geçerli kutu üretir', () => {
    for (const input of [
      { minLon: 29, minLat: 41, maxLon: 29, maxLat: 41 },
      { minLon: 180, minLat: 88, maxLon: 180, maxLat: 89 },
      { minLon: -180, minLat: -89, maxLon: -180, maxLat: -86 },
      { minLon: Number.NaN, minLat: 0, maxLon: Number.NaN, maxLat: 1 },
      { minLon: -720, minLat: -90, maxLon: 720, maxLat: 90 },
    ]) {
      expect(acceptedByApi(clampViewport(input)), JSON.stringify(input)).toBe(true)
    }
  })
})

describe('LiveConnection — bağlantı ve abonelik', () => {
  it('açılınca görünüm aboneliğini gönderir (lastSeq yok)', () => {
    const { connection, states } = setup()
    connection.setViewport(ISTANBUL, 6.5)
    connection.start()
    expect(states).toEqual(['connecting'])
    const socket = FakeWebSocket.last()
    expect(socket.url).toBe('ws://localhost:4100/v1/ws')
    expect(socket.sent).toEqual([])
    socket.serverOpen()
    expect(states).toEqual(['connecting', 'open'])
    expect(socket.messages()).toEqual([{ type: 'subscribe', viewport: ISTANBUL, zoom: 6.5 }])
  })

  it('görünüm sonradan gelirse o an gönderir; aynı görünümü tekrar göndermez', () => {
    const { connection } = setup()
    connection.start()
    const socket = FakeWebSocket.last()
    socket.serverOpen()
    expect(socket.sent).toEqual([])
    connection.setViewport(ISTANBUL, 6)
    connection.setViewport({ ...ISTANBUL }, 6)
    connection.setViewport(ISTANBUL, 7)
    connection.setViewport(ANKARA, 7)
    expect(socket.messages()).toEqual([
      { type: 'subscribe', viewport: ISTANBUL, zoom: 6 },
      { type: 'subscribe', viewport: ISTANBUL, zoom: 7 },
      { type: 'subscribe', viewport: ANKARA, zoom: 7 },
    ])
  })

  it('refresh aynı aboneliği lastSeq olmadan yeniden gönderir; bağlantı açık değilse etkisizdir', () => {
    const { connection } = setup()
    connection.setViewport(ISTANBUL, 6)
    connection.refresh()
    connection.start()
    const socket = FakeWebSocket.last()
    connection.refresh()
    expect(socket.sent).toEqual([])
    socket.serverOpen()
    socket.serverSend(snapshot(3))
    connection.refresh()
    expect(socket.messages()).toEqual([
      { type: 'subscribe', viewport: ISTANBUL, zoom: 6 },
      { type: 'subscribe', viewport: ISTANBUL, zoom: 6 },
    ])
  })

  it('geçerli mesajları iletir; bozuk ve tanınmayan çerçeveleri yok sayar', () => {
    const { connection, messages } = setup()
    connection.start()
    const socket = FakeWebSocket.last()
    socket.serverOpen()
    socket.serverSend('{bozuk')
    socket.serverSend({ type: 'hello' })
    socket.serverSend({ type: 'snapshot', seq: 'x' })
    socket.serverSend({ type: 'error', code: 'bad_request' })
    socket.serverSend(snapshot(4))
    expect(messages.map((m) => m.type)).toEqual(['error', 'snapshot'])
  })

  it('stop soketi 1000 ile kapatır, zamanlayıcıyı iptal eder ve sonraki olayları yok sayar', () => {
    const { connection, timers, messages, states } = setup()
    connection.start()
    const socket = FakeWebSocket.last()
    socket.serverOpen()
    connection.stop()
    expect(socket.closedWith).toEqual({ code: 1000, reason: undefined })
    socket.serverSend(snapshot(1))
    socket.serverClose()
    expect(messages).toEqual([])
    expect(timers.pending.size).toBe(0)
    expect(states).toEqual(['connecting', 'open'])
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})

describe('LiveConnection — yeniden bağlanma', () => {
  it('beklenmeyen kapanışta geri çekilmeyle yeniden bağlanır, lastSeq’i aynı görünümle gönderir', () => {
    const { connection, timers, states } = setup(() => 0)
    connection.setViewport(ISTANBUL, 6)
    connection.start()
    const first = FakeWebSocket.last()
    first.serverOpen()
    first.serverSend(snapshot(10))
    first.serverSend({ type: 'diff', seq: 11, status: STATUS, cells: [] })
    first.serverClose(1006)
    expect(states.at(-1)).toBe('reconnecting')
    expect(timers.only()).toBe(2_000)
    timers.runAll()
    const second = FakeWebSocket.last()
    expect(second).not.toBe(first)
    second.serverOpen()
    expect(states.at(-1)).toBe('open')
    expect(second.messages()).toEqual([
      { type: 'subscribe', viewport: ISTANBUL, zoom: 6, lastSeq: 11 },
    ])
    // Sonraki görünüm değişikliği tam görüntü ister.
    connection.setViewport(ANKARA, 6)
    expect(second.messages().at(-1)).toEqual({ type: 'subscribe', viewport: ANKARA, zoom: 6 })
  })

  it('görünüm kopukken değiştiyse lastSeq göndermez', () => {
    const { connection, timers } = setup()
    connection.setViewport(ISTANBUL, 6)
    connection.start()
    const first = FakeWebSocket.last()
    first.serverOpen()
    first.serverSend(snapshot(10))
    first.serverClose()
    connection.setViewport(ANKARA, 6)
    timers.runAll()
    const second = FakeWebSocket.last()
    second.serverOpen()
    expect(second.messages()).toEqual([{ type: 'subscribe', viewport: ANKARA, zoom: 6 }])
  })

  it('seq, yeni görünümün yanıtı gelmeden önceki görünüme aitse lastSeq göndermez', () => {
    const { connection, timers } = setup()
    connection.setViewport(ISTANBUL, 6)
    connection.start()
    const first = FakeWebSocket.last()
    first.serverOpen()
    first.serverSend(snapshot(10))
    connection.setViewport(ANKARA, 6)
    first.serverClose()
    timers.runAll()
    const second = FakeWebSocket.last()
    second.serverOpen()
    expect(second.messages()).toEqual([{ type: 'subscribe', viewport: ANKARA, zoom: 6 }])
  })

  it('ilk bağlantıda seq yoksa lastSeq göndermez', () => {
    const { connection, timers } = setup()
    connection.setViewport(ISTANBUL, 6)
    connection.start()
    FakeWebSocket.last().serverOpen()
    FakeWebSocket.last().serverClose()
    timers.runAll()
    FakeWebSocket.last().serverOpen()
    expect(FakeWebSocket.last().messages()).toEqual([
      { type: 'subscribe', viewport: ISTANBUL, zoom: 6 },
    ])
  })

  it('sunucunun reconnect mesajında tam afterMs sonra bağlanır; başarısızlık sayılmaz', () => {
    const { connection, timers, messages, states } = setup(() => 0)
    connection.setViewport(ISTANBUL, 6)
    connection.start()
    const first = FakeWebSocket.last()
    first.serverOpen()
    first.serverSend(snapshot(20))
    first.serverSend({ type: 'reconnect', afterMs: 3_456 })
    expect(first.closedWith?.code).toBe(1000)
    expect(messages.at(-1)).toEqual({ type: 'reconnect', afterMs: 3_456 })
    expect(states.at(-1)).toBe('reconnecting')
    expect(timers.only()).toBe(3_456)
    // Sunucunun ardından gelen 1012 kapanışı ikinci bir zamanlayıcı kurmaz.
    first.serverClose(1012)
    expect(timers.only()).toBe(3_456)
    timers.runAll()
    const second = FakeWebSocket.last()
    second.serverOpen()
    expect(second.messages()).toEqual([
      { type: 'subscribe', viewport: ISTANBUL, zoom: 6, lastSeq: 20 },
    ])
    // Bağlantı başarısız olursa ilk deneme süresi kullanılır (sayaç artmamıştı).
    second.serverClose()
    expect(timers.only()).toBe(2_000)
  })

  it('ardışık başarısızlıkta süre katlanır; 8. başarısızlıkta offline olur ve denemeye devam eder', () => {
    const { connection, timers, states } = setup(() => 0)
    connection.start()
    const delays: number[] = []
    for (let i = 0; i < OFFLINE_AFTER_FAILURES + 1; i++) {
      const socket = FakeWebSocket.last()
      if (i % 2 === 0) socket.serverError()
      else socket.serverClose()
      delays.push(timers.only())
      timers.runAll()
    }
    expect(delays).toEqual([2_000, 3_000, 5_000, 9_000, 17_000, 33_000, 61_000, 61_000, 61_000])
    expect(states).toEqual(['connecting', 'reconnecting', 'offline'])
    expect(FakeWebSocket.instances).toHaveLength(OFFLINE_AFTER_FAILURES + 2)
    // Başarılı bağlantı ve tam görüntü sayacı sıfırlar.
    const socket = FakeWebSocket.last()
    socket.serverOpen()
    expect(states.at(-1)).toBe('open')
    socket.serverSend(snapshot(1))
    socket.serverClose()
    expect(states.at(-1)).toBe('reconnecting')
    expect(timers.only()).toBe(2_000)
  })

  it('hata ardından gelen kapanış olayı ikinci kez yeniden bağlanma kurmaz', () => {
    const { connection, timers } = setup(() => 0)
    connection.start()
    const socket = FakeWebSocket.last()
    socket.serverError()
    socket.serverClose()
    expect(timers.pending.size).toBe(1)
    expect(socket.closedWith?.code).toBe(1000)
  })

  it('WebSocket kurucusu hata verirse yeniden dener', () => {
    const timers = new FakeTimers()
    const states: ConnectionState[] = []
    let calls = 0
    class Throwing extends FakeWebSocket {
      constructor(url: string) {
        calls += 1
        if (calls === 1) throw new SyntaxError('bad url')
        super(url)
      }
    }
    const connection = new LiveConnection({
      url: 'ws://localhost:4100/v1/ws',
      onMessage: () => {},
      onState: (s) => states.push(s),
      WebSocketImpl: Throwing as unknown as { new (url: string): WebSocket },
      random: () => 0,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    })
    connection.start()
    expect(states).toEqual(['connecting', 'reconnecting'])
    timers.runAll()
    expect(calls).toBe(2)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('stop sonrası start yeni bir bağlantı açar', () => {
    const { connection, states } = setup()
    connection.start()
    connection.start()
    expect(FakeWebSocket.instances).toHaveLength(1)
    connection.stop()
    connection.start()
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(states).toEqual(['connecting', 'connecting'])
    expect(connection.state).toBe('connecting')
  })
})
