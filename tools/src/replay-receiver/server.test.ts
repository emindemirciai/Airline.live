import {
  createLocalReceiverClient,
  parseLiveResponse,
  parseReceiverUrls,
} from '@havayolu/providers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cruiseScenario } from '../scenarios'
import {
  assertReplayAllowed,
  DEFAULT_REPLAY_PORT,
  replayPortFromEnv,
  ReplayProductionError,
  startReplayReceiver,
  type ReplayReceiver,
} from './server'

const T0 = Date.UTC(2026, 8, 28, 9, 0, 0)

const open: ReplayReceiver[] = []
async function start(opts: Partial<Parameters<typeof startReplayReceiver>[0]> = {}) {
  const receiver = await startReplayReceiver({
    source: cruiseScenario(),
    port: 0,
    appEnv: 'test',
    ...opts,
  })
  open.push(receiver)
  return receiver
}

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(open.splice(0).map((r) => r.close()))
})

describe('replay alıcısı: HTTP', () => {
  it('aircraft.json 200 JSON döner; now sunulduğu anın saatidir', async () => {
    let clock = T0
    const receiver = await start({ now: () => clock })
    expect(receiver.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/data\/aircraft\.json$/)
    const response = await fetch(receiver.url)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/^application\/json/)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = (await response.json()) as { now: number; aircraft: unknown[] }
    expect(body.now).toBe(T0 / 1000)
    expect(body).toEqual(JSON.parse(JSON.stringify(cruiseScenario().frameAt(T0))))
    clock = T0 + 5_000
    const later = (await (await fetch(receiver.url)).json()) as { now: number }
    expect(later.now).toBe((T0 + 5_000) / 1000)
  })

  it('/aircraft.json ve sorgu dizgili istek de sunulur; başka yol 404', async () => {
    const receiver = await start({ now: () => T0 })
    const base = new URL(receiver.url)
    expect((await fetch(new URL('/aircraft.json', base))).status).toBe(200)
    expect((await fetch(`${receiver.url}?_=${T0}`)).status).toBe(200)
    const missing = await fetch(new URL('/data/receiver.json', base))
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'not_found' })
    expect((await fetch(new URL('/', base))).status).toBe(404)
  })

  it('HEAD gövdesiz 200, POST 405 döner', async () => {
    const receiver = await start({ now: () => T0 })
    const head = await fetch(receiver.url, { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
    const post = await fetch(receiver.url, { method: 'POST', body: '{}' })
    expect(post.status).toBe(405)
    expect(post.headers.get('allow')).toBe('GET, HEAD')
  })

  it('kare üretilemezse 500 döner, alıcı ayakta kalır', async () => {
    let fail = true
    const receiver = await start({
      source: {
        name: 'broken',
        frameAt: (t) => {
          if (fail) throw new Error('boom')
          return cruiseScenario().frameAt(t)
        },
      },
      now: () => T0,
    })
    const broken = await fetch(receiver.url)
    expect(broken.status).toBe(500)
    expect(await broken.json()).toEqual({ error: 'frame_failed' })
    fail = false
    expect((await fetch(receiver.url)).status).toBe(200)
  })

  it('yanıt ayrıştırıcıdan sıfır retle geçer (gerçek saat)', async () => {
    const receiver = await start()
    const receivedAt = Date.now()
    const body: unknown = await (await fetch(receiver.url)).json()
    const parsed = parseLiveResponse(body, 'localReceiver', { receivedAt })
    expect(parsed.rejected).toEqual([])
    expect(parsed.aircraft).toHaveLength(10)
    expect(Math.abs(parsed.now - receivedAt)).toBeLessThan(5_000)
  })

  it('yerel alıcı istemcisi (LOCAL_RECEIVER_URLS yolu) alıcıyı okur', async () => {
    const receiver = await start({ now: () => T0 })
    const client = createLocalReceiverClient({
      receivers: parseReceiverUrls(receiver.url),
      dataUsageMode: 'commercial',
      userAgent: 'havayolu-test/0.0.0',
      now: () => T0,
    })
    const [result] = await client.fetchAll()
    expect(result).toMatchObject({ ok: true, error: null })
    expect(result!.response!.aircraft).toHaveLength(10)
    expect(result!.response!.rejected).toEqual([])
    expect(client.health()[0]).toMatchObject({ consecutiveFailures: 0, lastAircraftCount: 10 })
  })

  it('kayıt kaynağı zamanı kaydırarak döngüyle sunulur', async () => {
    let clock = T0
    const frames = [1000, 1001, 1002].map((now, i) => ({
      now,
      messages: i,
      aircraft: [{ hex: `abc00${i}`, lat: 41, lon: 29, seen_pos: 0.2, seen: 0.1, dbFlags: 0 }],
    }))
    const receiver = await start({ source: { frames }, now: () => clock })
    const read = async () =>
      (await (await fetch(receiver.url)).json()) as {
        now: number
        aircraft: { hex: string; seen_pos: number }[]
      }
    expect((await read()).aircraft[0]!.hex).toBe('abc000')
    clock = T0 + 1_500
    const second = await read()
    expect(second.now).toBe((T0 + 1_500) / 1000)
    expect(second.aircraft[0]).toMatchObject({ hex: 'abc001', seen_pos: 0.7 })
    clock = T0 + 3_000
    expect((await read()).aircraft[0]!.hex).toBe('abc000')
  })

  it('tek kareli kayıt döngüye alınmaz; uçaklar donmuş alıcıdaki gibi bayatlar', async () => {
    let clock = T0
    const frames = [
      { now: 1000, aircraft: [{ hex: 'abc000', lat: 41, lon: 29, seen_pos: 0.2, dbFlags: 0 }] },
    ]
    const receiver = await start({ source: { frames }, now: () => clock })
    const read = async () =>
      parseLiveResponse(await (await fetch(receiver.url)).json(), 'localReceiver', {
        receivedAt: clock,
      })
    const first = await read()
    clock = T0 + 45_000
    const later = await read()
    expect(later.aircraft[0]!.sampleTime).toBe(first.aircraft[0]!.sampleTime)
    clock = T0 + 60_000
    expect(await read()).toMatchObject({
      aircraft: [],
      rejected: [{ hex: 'abc000', reason: 'stale' }],
    })
  })

  it('close tekrar çağrılabilir; kapandıktan sonra bağlantı kurulmaz', async () => {
    const receiver = await start({ now: () => T0 })
    await fetch(receiver.url)
    await receiver.close()
    await receiver.close()
    await expect(fetch(receiver.url)).rejects.toThrow()
  })

  it('port doluysa anlaşılır hata verir', async () => {
    const first = await start({ now: () => T0 })
    const port = Number(new URL(first.url).port)
    await expect(start({ port })).rejects.toThrow(/dinleyemedi.*REPLAY_RECEIVER_PORT/)
  })

  it('port verilmezse REPLAY_RECEIVER_PORT okunur; geçersiz port reddedilir', async () => {
    vi.stubEnv('REPLAY_RECEIVER_PORT', 'abc')
    await expect(startReplayReceiver({ source: cruiseScenario(), appEnv: 'test' })).rejects.toThrow(
      /REPLAY_RECEIVER_PORT/,
    )
    await expect(start({ port: 70_000 })).rejects.toThrow(RangeError)
    await expect(start({ port: 1.5 })).rejects.toThrow(RangeError)
  })
})

describe('replay alıcısı: üretim koruması', () => {
  it('APP_ENV=production iken başlamaz', async () => {
    await expect(start({ appEnv: 'production' })).rejects.toBeInstanceOf(ReplayProductionError)
    await expect(start({ appEnv: 'production' })).rejects.toThrow(/APP_ENV=production/)
  })

  it('appEnv verilmezse process.env.APP_ENV kullanılır', async () => {
    vi.stubEnv('APP_ENV', 'production')
    await expect(startReplayReceiver({ source: cruiseScenario(), port: 0 })).rejects.toBeInstanceOf(
      ReplayProductionError,
    )
    vi.stubEnv('APP_ENV', 'development')
    const receiver = await startReplayReceiver({ source: cruiseScenario(), port: 0 })
    open.push(receiver)
    expect(receiver.url).toMatch(/^http:/)
  })

  it('yalnızca development ve test (boş = development) kabul edilir', () => {
    expect(() => assertReplayAllowed(undefined)).not.toThrow()
    expect(() => assertReplayAllowed('')).not.toThrow()
    expect(() => assertReplayAllowed('development')).not.toThrow()
    expect(() => assertReplayAllowed('test')).not.toThrow()
    expect(() => assertReplayAllowed(' production ')).toThrow(ReplayProductionError)
    expect(() => assertReplayAllowed('staging')).toThrow(ReplayProductionError)
  })
})

describe('replayPortFromEnv', () => {
  it('boşsa 4300, geçerli port olduğu gibi', () => {
    expect(replayPortFromEnv(undefined)).toBe(DEFAULT_REPLAY_PORT)
    expect(replayPortFromEnv('  ')).toBe(4300)
    expect(replayPortFromEnv('4301')).toBe(4301)
    expect(replayPortFromEnv(' 65535 ')).toBe(65535)
  })

  it('geçersiz değer RangeError verir', () => {
    for (const value of ['0', '65536', 'abc', '43.5', '-1', '0x10', '1e3']) {
      expect(() => replayPortFromEnv(value), value).toThrow(RangeError)
    }
  })
})
