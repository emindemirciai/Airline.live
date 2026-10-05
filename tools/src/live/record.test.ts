import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LIVE_KEYS } from '@havayolu/db'
import { hasDbFlag, parseLiveResponse, withPrivacy } from '@havayolu/providers'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { loadRecording, recordingPlayer } from '../replay-receiver/recording'
import type { RecordArgs } from './args'
import { LIVE_MIN_GAP_MS } from './guard'
import { refusalText } from './gates'
import { LIVE_LAST_KEY, LIVE_LOCK_KEY, type LiveRedisFactory } from './lock'
import {
  estimateRecordRequests,
  outPathRefusal,
  RECORD_LIMITS,
  recordingBaseName,
  recordOutputPaths,
  runRecord,
  sanitizeFrameForFixture,
  type RecordConfig,
} from './record'
import {
  FAKE_T0,
  FakeClock,
  FakeLiveRedis,
  FIXTURES_DIR,
  fixturePointFrame,
  jsonReply,
  localOnlyFetch,
  nginx429Reply,
  startAdsbLolStub,
  type AdsbLolEnvelope,
  type AdsbLolStub,
  type StubHandler,
} from './test/adsblol-stub'

const LTFM_PATH = '/v2/point/41.2749/28.7321/40'
const EMAIL = 'ops@example.org'
const VERSION = '0.0.0-test'
const BASE_NAME = 'LTFM-20261004T1200Z'
const BASE_SOURCE: Record<string, string | undefined> = {
  APP_ENV: 'test',
  APP_NAME: 'havayolu',
  CONTACT_EMAIL: EMAIL,
  WEB_HOST: 'localhost:3100',
  DATA_USAGE_MODE: 'commercial',
  ADSBLOL_RPS: '0.1',
  // Sahte istemci (FakeLiveRedis) kullanılır; bu adrese bağlanılmaz.
  REDIS_LIVE_URL: 'redis://localhost:46380/9',
}

type RunArgs = Extract<RecordArgs, { kind: 'run' }>

const stubs: AdsbLolStub[] = []
const roots: string[] = []
afterEach(async () => {
  await Promise.all(stubs.splice(0).map((s) => s.close()))
})
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'hy-record-'))
  roots.push(root)
  return root
}

interface RunOptions {
  clock?: FakeClock
  handler?: StubHandler
  minutes?: number
  args?: Partial<RunArgs>
  source?: Record<string, string | undefined>
  shellEnv?: NodeJS.ProcessEnv
  random?: () => number
  /** null: istemci kurulamaz (bağlantı hatası). */
  redis?: FakeLiveRedis | null
  redisFactory?: LiveRedisFactory
  redisTimeoutMs?: number
  signal?: AbortSignal
  /** null: taban adres verilmez (canlı adsb.lol). */
  baseUrl?: string | null
  fetch?: typeof fetch
  root?: string
}

async function run(opts: RunOptions = {}) {
  const clock = opts.clock ?? new FakeClock()
  const handler: StubHandler = opts.handler ?? (() => jsonReply(fixturePointFrame(clock.now())))
  const stub = await startAdsbLolStub(handler, { now: clock.now })
  stubs.push(stub)
  const root = opts.root ?? tempRoot()
  const redis = opts.redis === undefined ? new FakeLiveRedis({ now: clock.now }) : opts.redis
  const factory = vi.fn(
    opts.redisFactory ??
      ((_url: string) => {
        if (redis === null) throw new Error('connect ECONNREFUSED 127.0.0.1:46380')
        return redis
      }),
  )
  const fetchSpy = vi.fn(opts.fetch ?? localOnlyFetch)
  const logs: string[] = []
  const args: RunArgs = {
    kind: 'run',
    station: 'LTFM',
    minutes: opts.minutes ?? 1,
    radiusNm: 40,
    out: null,
    fixture: false,
    confirm: true,
    ...opts.args,
  }
  const config: RecordConfig = {
    root,
    args,
    source: { ...BASE_SOURCE, ...opts.source },
    shellEnv: opts.shellEnv ?? {},
    version: VERSION,
    referenceDir: FIXTURES_DIR,
    ...(opts.baseUrl === null ? {} : { baseUrl: opts.baseUrl ?? stub.baseUrl }),
  }
  const result = await runRecord(config, {
    fetch: fetchSpy,
    clock,
    random: opts.random ?? (() => 0.5),
    log: (line) => logs.push(line),
    redisFactory: factory,
    redisTimeoutMs: opts.redisTimeoutMs ?? 200,
    ...(opts.signal === undefined ? {} : { signal: opts.signal }),
  })
  const output = recordOutputPaths(root, args, BASE_NAME)
  return { result, clock, stub, root, redis, factory, fetchSpy, logs, output }
}

const times = (stub: AdsbLolStub) => stub.requests.map((r) => r.at)
const gaps = (list: readonly number[]) => list.slice(1).map((t, i) => t - list[i]!)
const lines = (path: string) => readFileSync(path, 'utf8').split('\n').filter(Boolean)
const readMeta = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>

describe('recordingBaseName, çıktı yolları ve istek bütçesi', () => {
  it('ad UTC dakikasıyla: <ICAO>-<YYYYMMDDTHHmm>Z', () => {
    expect(recordingBaseName('LTFM', FAKE_T0 + 59_999)).toBe(BASE_NAME)
    expect(recordingBaseName('UZSS', Date.UTC(2026, 0, 2, 3, 4, 5))).toBe('UZSS-20260102T0304Z')
  })

  it('varsayılan tmp, --fixture tools/fixtures/replay, --out verilen yol; künye .meta.json', () => {
    const root = join(tmpdir(), 'kok')
    const tmp = recordOutputPaths(root, { out: null, fixture: false }, BASE_NAME)
    expect(tmp.final).toBe(join(root, 'tools', 'recordings', 'tmp', `${BASE_NAME}.jsonl`))
    expect(tmp.partial).toBe(`${tmp.final}.partial`)
    expect(tmp.meta).toBe(join(root, 'tools', 'recordings', 'tmp', `${BASE_NAME}.meta.json`))
    const fixture = recordOutputPaths(root, { out: null, fixture: true }, BASE_NAME)
    expect(fixture.final).toBe(join(root, 'tools', 'fixtures', 'replay', `${BASE_NAME}.jsonl`))
    const out = recordOutputPaths(root, { out: join(root, 'kayit.JSONL'), fixture: false }, 'x')
    expect(out).toEqual({
      final: join(root, 'kayit.JSONL'),
      partial: join(root, 'kayit.JSONL.partial'),
      meta: join(root, 'kayit.meta.json'),
    })
  })

  it('bütçe AIMD kovasıyla adımlanır: 30 dk, 0,1 istek/sn → ≈199 istek, en çok 0,121', () => {
    const estimate = estimateRecordRequests(30, 0.1)
    expect(estimate.requests).toBeGreaterThanOrEqual(190)
    expect(estimate.requests).toBeLessThanOrEqual(200)
    expect(estimate.startTimes).toHaveLength(estimate.requests)
    expect(estimate.startTimes[1]! - estimate.startTimes[0]!).toBe(10_000)
    expect(estimate.maxRps).toBeCloseTo(0.121, 9)
    // Üst sınırda başlayan kova üst sınırı aşmaz.
    const fast = estimateRecordRequests(RECORD_LIMITS.maxMinutes, 0.2)
    expect(fast.maxRps).toBe(0.2)
    expect(Math.min(...gaps(fast.startTimes))).toBe(LIVE_MIN_GAP_MS)
    expect(fast.requests).toBe(720)
  })
})

describe('runRecord: 30 dk sahte saatle', () => {
  it('yalnızca LTFM nokta sorgusu, AIMD aralıkları, satır = kare = başarılı istek', async () => {
    const { result, stub, logs, output, redis, root } = await run({ minutes: 30 })
    expect(result).toMatchObject({
      exitCode: 0,
      stopReason: 'completed',
      rateLimited: 0,
      errors: 0,
    })

    // İstekler: tek yol, GET, UA'da yerel WEB_HOST yok.
    expect(new Set(stub.requests.map((r) => `${r.method} ${r.path}`))).toEqual(
      new Set([`GET ${LTFM_PATH}`]),
    )
    for (const req of stub.requests) {
      expect(req.headers['user-agent']).toMatch(
        /^havayolu\/0\.0\.0-test \(\+mailto:ops@example\.org\)$/,
      )
    }

    // Aralıklar: kovanın beklediği anlar (aynı aritmetik), önce tam 10 sn, sonra 1000/0,11 ve
    // 1000/0,121; hiçbiri 5 sn'den kısa değil; süre dolduktan sonra istek başlamaz.
    const startedAt = result.startedAt!
    expect(startedAt).toBe(FAKE_T0)
    const at = times(stub)
    expect(at).toEqual(estimateRecordRequests(30, 0.1, startedAt).startTimes)
    const steps = gaps(at)
    expect(steps[0]).toBe(10_000)
    expect(steps.slice(0, 59).every((g) => g === 10_000)).toBe(true)
    expect(steps[70]).toBeCloseTo(1000 / 0.11, 3)
    expect(steps[steps.length - 1]).toBeCloseTo(1000 / 0.121, 3)
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(LIVE_MIN_GAP_MS)
    expect(at[at.length - 1]).toBeLessThan(startedAt + 30 * 60_000)
    expect(at.length).toBeGreaterThanOrEqual(190)
    expect(at.length).toBeLessThanOrEqual(200)
    expect(result.requests).toBe(at.length)
    expect(result.frames).toBe(at.length)
    expect(result.minGapMs).toBeCloseTo(1000 / 0.121, 3)
    expect(result.finalRps).toBe(0.121)

    // Dosya: LF, satır başına bir kare, .partial kalmaz; replay döngüye alır, ayrıştırıcı 0 ret.
    expect(result.outPath).toBe(output.final)
    expect(output.final).toBe(join(root, 'tools', 'recordings', 'tmp', `${BASE_NAME}.jsonl`))
    expect(existsSync(output.partial)).toBe(false)
    const text = readFileSync(output.final, 'utf8')
    expect(text).not.toContain('\r')
    expect(text.endsWith('\n')).toBe(true)
    expect(lines(output.final)).toHaveLength(result.frames)
    expect(result.bytes).toBe(Buffer.byteLength(text))
    const recording = loadRecording(output.final)
    expect(recording.frames).toHaveLength(result.frames)
    expect(recordingPlayer(recording, FAKE_T0).durationMs).not.toBeNull()
    for (const frame of recording.frames) {
      expect(parseLiveResponse(frame, 'localReceiver').rejected).toEqual([])
    }

    // Künye: düz, ilkel değerli, prettier'da kararlı; UA, e-posta ve adres yok.
    const metaText = readFileSync(output.meta, 'utf8')
    const meta = readMeta(output.meta)
    expect(metaText).toBe(`${JSON.stringify(meta, null, 2)}\n`)
    for (const value of Object.values(meta)) {
      expect(value === null || typeof value !== 'object').toBe(true)
    }
    expect(meta).toMatchObject({
      source: 'https://api.adsb.lol',
      license: 'ODbL-1.0',
      path: LTFM_PATH,
      station: 'LTFM',
      radiusNm: 40,
      startedAt: new Date(FAKE_T0).toISOString(),
      frames: result.frames,
      requests: result.requests,
      rateLimited: 0,
      errors: 0,
      stopReason: 'completed',
      sanitized: false,
      tool: 'havayolu 0.0.0-test pnpm record',
    })
    for (const content of [text, metaText]) {
      expect(content).not.toContain(EMAIL)
      expect(content.toLowerCase()).not.toContain('user-agent')
      expect(content).not.toContain('127.0.0.1')
    }

    // Günlük: maskeli, oynatma komutu kökten göreli.
    const joined = logs.join('\n')
    expect(joined).not.toContain(EMAIL)
    expect(joined).toContain('User-Agent: havayolu/0.0.0-test (+mailto:<CONTACT_EMAIL>)')
    expect(joined).toContain(
      `Oynatmak için: pnpm dev:replay --recording tools/recordings/tmp/${BASE_NAME}.jsonl`,
    )
    expect(joined).not.toContain('127.0.0.1')

    // Kilit bırakıldı, son isteğin başlangıcı yazıldı, istemci kapandı.
    expect(redis!.peek(LIVE_LOCK_KEY)).toBeNull()
    expect(redis!.peek(LIVE_LAST_KEY)).toBe(String(Math.round(at[at.length - 1]!)))
    expect(redis!.quitCalls).toBe(1)
    expect(redis!.isOpen()).toBe(false)
  }, 30_000)

  it("genel WEB_HOST UA'ya girer; künyedeki marka APP_NAME'den", async () => {
    const { result, stub, output } = await run({
      source: { WEB_HOST: 'havayolu.example', APP_NAME: 'testbrand' },
    })
    expect(result.exitCode).toBe(0)
    expect(stub.requests[0]!.headers['user-agent']).toBe(
      'testbrand/0.0.0-test (+https://havayolu.example; ops@example.org)',
    )
    expect(readMeta(output.meta).tool).toBe('testbrand 0.0.0-test pnpm record')
  })
})

describe('runRecord: hata yanıtları', () => {
  it.each([
    ['nginx 429 (HTML, Retry-After yok)', nginx429Reply()],
    ['gövdesiz 420', { status: 420 }],
  ])('%s: hız yarıya iner, jitterli beklemeden sonra devam edilir', async (_label, reply) => {
    const clock = new FakeClock()
    const { result, stub, logs } = await run({
      clock,
      minutes: 3,
      random: () => 0.5,
      handler: (_req, index) => (index === 2 ? reply : jsonReply(fixturePointFrame(clock.now()))),
    })
    expect(result).toMatchObject({ exitCode: 0, stopReason: 'completed', rateLimited: 1 })
    const steps = gaps(times(stub))
    expect(steps.slice(0, 2)).toEqual([10_000, 10_000])
    // 3. istekten sonraki aralık: jitter (0,5 × 15 sn) ve yarıya inen hız (1000 / 0,05).
    expect(steps[2]).toBeGreaterThanOrEqual(7_500)
    for (const step of steps.slice(2)) expect(step).toBeGreaterThanOrEqual(1000 / 0.05)
    expect(stub.requests.length).toBeGreaterThan(4)
    expect(result.frames).toBe(stub.requests.length - 1)
    expect(result.finalRps).toBe(0.05)
    expect(logs.some((l) => /#3 42[09] · kısıtlama/.test(l))).toBe(true)
  })

  it('5 kez üst üste 5xx: devre açılır, yarı açık deneme 5. hatadan ≥ 60 sn sonra', async () => {
    const clock = new FakeClock()
    const { result, stub } = await run({
      clock,
      minutes: 3,
      random: () => 0,
      handler: (_req, index) =>
        index < 5 ? { status: 500, body: 'oops' } : jsonReply(fixturePointFrame(clock.now())),
    })
    const at = times(stub)
    expect(gaps(at).slice(0, 4)).toEqual([10_000, 10_000, 10_000, 10_000])
    expect(at[5]! - at[4]!).toBeGreaterThanOrEqual(60_000)
    expect(result).toMatchObject({ exitCode: 0, errors: 5, frames: at.length - 5 })
  })

  it.each([401, 403])(
    '%s: araç hemen durur, yeniden denemez; alınan kare korunur, çıkış 3',
    async (status) => {
      const clock = new FakeClock()
      const { result, stub, logs, output } = await run({
        clock,
        minutes: 30,
        handler: (_req, index) =>
          index === 1 ? { status, body: 'Forbidden' } : jsonReply(fixturePointFrame(clock.now())),
      })
      expect(stub.requests).toHaveLength(2)
      expect(result).toMatchObject({ exitCode: 3, stopReason: 'config', frames: 1, requests: 2 })
      expect(loadRecording(output.final).frames).toHaveLength(1)
      expect(readMeta(output.meta).stopReason).toBe('config')
      const joined = logs.join('\n')
      expect(joined).toContain(`adsb.lol ${status} döndü`)
      expect(joined).toContain('RUNBOOK: "adsb.lol API anahtarı istemeye başladı (401/403)"')
      expect(joined).toContain('DUR-SOR 3')
    },
  )

  it('302: yönlendirme izlenmez, kayıt durur, çıkış 4', async () => {
    const { result, stub, output, root } = await run({
      minutes: 5,
      handler: () => ({ status: 302, headers: { location: '/v2/point/1/1/1' } }),
    })
    expect(stub.requests.map((r) => r.path)).toEqual([LTFM_PATH])
    expect(result).toMatchObject({ exitCode: 4, stopReason: 'request', frames: 0 })
    expect(existsSync(output.final)).toBe(false)
    expect(existsSync(join(root, 'tools'))).toBe(false)
  })

  it('öz denetim başarısız (hex alanı olmayan uçak): neden ve satır yazılır, çıkış 4', async () => {
    const clock = new FakeClock()
    const { result, logs, output } = await run({
      clock,
      handler: () => {
        const frame = fixturePointFrame(clock.now())
        // Ayrıştırıcı bu uçağı tek başına reddeder, kare geçer; oynatıcı ise bütün dosyayı reddeder.
        frame.ac.push({ lat: 41.2, lon: 28.8, seen_pos: 1, seen: 0.5 })
        frame.total = frame.ac.length
        return jsonReply(frame)
      },
    })
    expect(result.frames).toBeGreaterThan(0)
    expect(result).toMatchObject({ exitCode: 4, stopReason: 'completed', outPath: output.final })
    const joined = logs.join('\n')
    expect(joined).toContain('Kayıt kapatılamadı: öz denetim başarısız, kayıt yeniden okunamadı')
    expect(joined).toContain('1. kare, 19. uçak: hex alanı yok')
    expect(joined).toContain('pnpm dev:replay --recording bu dosyayı reddeder')
    expect(joined).toContain(`kareler tools/recordings/tmp/${BASE_NAME}.jsonl dosyasında duruyor`)
    expect(joined).not.toContain(output.final)
    expect(joined).not.toContain('Oynatmak için')
  })

  it('yanıtın saati 120 sn kaymış: kare yazılmaz, dosya oluşmaz, çıkış 1', async () => {
    const clock = new FakeClock()
    const { result, stub, root } = await run({
      clock,
      minutes: 1,
      random: () => 0,
      handler: () => jsonReply(fixturePointFrame(clock.now() - 120_000)),
    })
    expect(stub.requests.length).toBeGreaterThanOrEqual(5)
    expect(result).toMatchObject({ exitCode: 1, stopReason: 'completed', frames: 0 })
    expect(result.errors).toBe(stub.requests.length)
    expect(result.outPath).toBeNull()
    expect(existsSync(join(root, 'tools'))).toBe(false)
  })

  it('Ctrl+C: eldeki karelerle dosya kapatılır, çıkış 130', async () => {
    const clock = new FakeClock()
    const controller = new AbortController()
    const { result, stub, output } = await run({
      clock,
      minutes: 30,
      signal: controller.signal,
      handler: (_req, index) => {
        if (index === 2) controller.abort()
        return jsonReply(fixturePointFrame(clock.now()))
      },
    })
    expect(stub.requests).toHaveLength(3)
    expect(result).toMatchObject({ exitCode: 130, stopReason: 'interrupted', frames: 3 })
    expect(loadRecording(output.final).frames).toHaveLength(3)
    expect(readMeta(output.meta).stopReason).toBe('interrupted')
  })
})

describe('runRecord: plan ve retler (istek atılmaz)', () => {
  it('--confirm yok: yalnızca plan; fetch, Redis ve dosya yok, çıkış 2', async () => {
    const { result, stub, fetchSpy, factory, logs, root } = await run({
      minutes: 30,
      args: { confirm: false },
    })
    expect(result.exitCode).toBe(2)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(factory).not.toHaveBeenCalled()
    expect(stub.requests).toHaveLength(0)
    expect(existsSync(join(root, 'tools'))).toBe(false)
    const plan = logs.join('\n')
    const estimate = estimateRecordRequests(30, 0.1)
    expect(plan).toContain(`GET ${LTFM_PATH}`)
    expect(plan).toContain(`≈${estimate.requests} istek`)
    expect(plan).toContain('başlangıç 0,100 istek/sn, AIMD ile en çok 0,121')
    expect(plan).toContain(`tools/recordings/tmp/${BASE_NAME}.jsonl`)
    expect(plan).toContain('CONTACT_EMAIL: var')
    expect(plan).toContain('Kapılar: --confirm ile çalışmaya hazır')
    expect(plan).toContain('ACTIVATION 1. adım')
    expect(plan).toContain('Canlı istek için --confirm ekle')
    expect(plan).not.toContain(EMAIL)
  })

  it('plan eksik kapıları değer yazmadan listeler; ajan oturumunda da çalışır', async () => {
    const { result, fetchSpy, factory, logs } = await run({
      args: { confirm: false },
      source: { CONTACT_EMAIL: '#iletisim adresi#', APP_ENV: 'production' },
      shellEnv: { CLAUDECODE: '1' },
      baseUrl: null,
    })
    expect(result.exitCode).toBe(2)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(factory).not.toHaveBeenCalled()
    const plan = logs.join('\n')
    expect(plan).toContain('CONTACT_EMAIL: yok')
    expect(plan).toContain('Kapılar: --confirm ile de reddedilir:')
    expect(plan).toContain('APP_ENV development ya da test olmalı')
    // smoke'un planı gibi: ajan oturumunda --confirm'ün reddi planda görünür.
    expect(plan).toContain(refusalText({ code: 'agent_session' }))
    expect(plan).not.toContain('Kapılar: --confirm ile çalışmaya hazır')
    expect(plan).toContain(refusalText({ code: 'confirm_missing' }))
  })

  it('ajan oturumunda başka engel yoksa plan yalnızca ajan reddini listeler', async () => {
    const { result, logs } = await run({
      args: { confirm: false },
      shellEnv: { AI_AGENT: 'claude' },
    })
    expect(result.exitCode).toBe(2)
    const plan = logs.join('\n')
    expect(plan).toContain('Kapılar: --confirm ile de reddedilir:')
    expect(plan).toContain(refusalText({ code: 'agent_session' }))
  })

  it('ajan oturumunda --confirm reddedilir', async () => {
    const { result, stub, factory, logs } = await run({ shellEnv: { AI_AGENT: 'claude' } })
    expect(result.exitCode).toBe(2)
    expect(stub.requests).toHaveLength(0)
    expect(factory).not.toHaveBeenCalled()
    expect(logs.join('\n')).toContain('yapay zekâ ajanı oturumunda çalışmaz')
  })

  it('canlı adreste kabuktaki CI reddeder; 127.0.0.1 test sunucusunda CI engel değil', async () => {
    const live = await run({
      baseUrl: null,
      shellEnv: { CI: 'true' },
      fetch: () => Promise.reject(new Error('fetch must not be called')),
    })
    expect(live.result.exitCode).toBe(2)
    expect(live.fetchSpy).not.toHaveBeenCalled()
    expect(live.factory).not.toHaveBeenCalled()
    expect(live.logs.join('\n')).toContain('CI ortamında canlı araç çalışmaz')

    const stub = await run({ shellEnv: { CI: 'true', EXTERNAL_PROVIDERS_DISABLED: 'true' } })
    expect(stub.result.exitCode).toBe(0)
    expect(stub.stub.requests.length).toBeGreaterThan(0)
  })

  it('izinli olmayan taban adres: istek atılmaz, çıkış 4', async () => {
    const { result, fetchSpy } = await run({ baseUrl: 'http://localhost:4300' })
    expect(result).toMatchObject({ exitCode: 4, stopReason: 'guard' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it.each(['final', 'partial', 'meta'] as const)(
    'çıktının %s dosyası varsa: istek atılmaz, dosya ezilmez, çıkış 2',
    async (which) => {
      const root = tempRoot()
      const output = recordOutputPaths(root, { out: null, fixture: false }, BASE_NAME)
      mkdirSync(join(root, 'tools', 'recordings', 'tmp'), { recursive: true })
      writeFileSync(output[which], 'eski\n')
      const { result, stub, logs } = await run({ root })
      expect(result.exitCode).toBe(2)
      expect(stub.requests).toHaveLength(0)
      expect(readFileSync(output[which], 'utf8')).toBe('eski\n')
      expect(logs.join('\n')).toContain('Çıktı dosyası zaten var')
    },
  )

  it("--out tools/fixtures altını gösteremez (Windows'ta büyük/küçük harf duyarsız)", async () => {
    const root = tempRoot()
    const dir = process.platform === 'win32' ? 'TOOLS' : 'tools'
    mkdirSync(join(root, dir, 'fixtures'), { recursive: true })
    const { result, stub, logs } = await run({
      root,
      args: { out: join(root, dir, 'fixtures', 'kayit.jsonl') },
    })
    expect(result.exitCode).toBe(2)
    expect(stub.requests).toHaveLength(0)
    expect(logs.join('\n')).toContain('--fixture kullan')
  })

  it.each([
    ['tools/recordings', ['tools', 'recordings', 'ltfm.jsonl']],
    ['e2e/fixtures', ['e2e', 'fixtures', 'x.jsonl']],
    ['docs', ['docs', 'x.jsonl']],
    ['kök', ['x.jsonl']],
  ])(
    '--out repo içinde gitignore dışında (%s): ham kayıt yazılmaz, istek atılmaz, çıkış 2',
    async (_label, parts) => {
      const root = tempRoot()
      const out = join(root, ...parts)
      mkdirSync(join(out, '..'), { recursive: true })
      const { result, stub, fetchSpy, factory, logs } = await run({ root, args: { out } })
      expect(result.exitCode).toBe(2)
      expect(stub.requests).toHaveLength(0)
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(factory).not.toHaveBeenCalled()
      expect(existsSync(out)).toBe(false)
      expect(existsSync(`${out}.partial`)).toBe(false)
      expect(logs.join('\n')).toContain(refusalText({ code: 'out_in_repo' }))
      // Plan da aynı reddi listeler.
      const plan = await run({ root, args: { out, confirm: false } })
      expect(plan.logs.join('\n')).toContain(refusalText({ code: 'out_in_repo' }))
    },
  )

  it('--out repo içinde tools/recordings/tmp altına yazabilir; outPathRefusal kuralı', async () => {
    const root = tempRoot()
    const dir = join(root, 'tools', 'recordings', 'tmp', 'ozel')
    mkdirSync(dir, { recursive: true })
    const out = join(dir, 'ltfm.jsonl')
    const { result } = await run({ root, args: { out } })
    expect(result).toMatchObject({ exitCode: 0, outPath: out })

    expect(outPathRefusal(root, join(tmpdir(), 'repo-disi', 'x.jsonl'))).toBeNull()
    expect(outPathRefusal(root, join(root, 'tools', 'recordings', 'tmp', 'x.jsonl'))).toBeNull()
    expect(outPathRefusal(root, join(root, 'tools', 'fixtures', 'replay', 'x.jsonl'))).toEqual({
      code: 'out_in_fixtures',
      subject: '--out',
    })
    expect(outPathRefusal(root, join(root, 'tools', 'recordings', 'x.jsonl'))).toEqual({
      code: 'out_in_repo',
      subject: '--out',
    })
    expect(outPathRefusal(root, join(`${root}-yan`, 'x.jsonl'))).toBeNull()
  })

  it('--out: verilen yola yazar; klasörü yoksa ret', async () => {
    const root = tempRoot()
    const elsewhere = tempRoot()
    const out = join(elsewhere, 'benim.jsonl')
    const ok = await run({ root, args: { out } })
    expect(ok.result).toMatchObject({ exitCode: 0, outPath: out })
    expect(existsSync(join(elsewhere, 'benim.meta.json'))).toBe(true)
    expect(existsSync(join(root, 'tools'))).toBe(false)
    // Kök dışındaki yol mutlak yazılır.
    expect(ok.logs.join('\n')).toContain(`Kayıt: ${out}`)

    const missing = await run({ root, args: { out: join(elsewhere, 'yok', 'x.jsonl') } })
    expect(missing.result.exitCode).toBe(2)
    expect(missing.stub.requests).toHaveLength(0)
  })

  it("bilinmeyen istasyon: fixture'da yoksa ret", async () => {
    const { result, stub, logs } = await run({ args: { station: 'ZZZZ' } })
    expect(result.exitCode).toBe(2)
    expect(stub.requests).toHaveLength(0)
    expect(logs.join('\n')).toContain('ZZZZ')
  })
})

describe('runRecord: eşzamanlılık ve Redis', () => {
  it('başka ingest (hy:provider:adsbLol) varsa: istek atılmaz, çıkış 2', async () => {
    const clock = new FakeClock()
    const redis = new FakeLiveRedis({ now: clock.now })
    redis.seed(LIVE_KEYS.provider('adsbLol'), '{}', 180_000)
    const { result, stub, logs } = await run({ clock, redis })
    expect(result.exitCode).toBe(2)
    expect(stub.requests).toHaveLength(0)
    expect(logs.join('\n')).toContain('başka bir ingest var')
    expect(redis.peek(LIVE_LOCK_KEY)).toBeNull()
    expect(redis.isOpen()).toBe(false)
  })

  it('kilit başka bir canlı araçtaysa: istek atılmaz, kilit korunur, çıkış 2', async () => {
    const clock = new FakeClock()
    const redis = new FakeLiveRedis({ now: clock.now })
    redis.seed(LIVE_LOCK_KEY, 'baska-arac', 120_000)
    const { result, stub, logs } = await run({ clock, redis })
    expect(result.exitCode).toBe(2)
    expect(stub.requests).toHaveLength(0)
    expect(redis.peek(LIVE_LOCK_KEY)).toBe('baska-arac')
    expect(logs.join('\n')).toContain('Başka bir canlı araç')
  })

  it('önceki çalışmanın son isteğinden 1000 / ADSBLOL_RPS sonra başlar', async () => {
    const clock = new FakeClock()
    const redis = new FakeLiveRedis({ now: clock.now })
    redis.seed(LIVE_LAST_KEY, String(FAKE_T0 - 2_000), 60_000)
    const { result, stub } = await run({ clock, redis })
    expect(stub.requests[0]!.at).toBe(FAKE_T0 + 8_000)
    expect(result.startedAt).toBe(FAKE_T0 + 8_000)
    expect(result.exitCode).toBe(0)
  })

  it('çalışırken başka ingest başlarsa 30 sn denetiminde durur, dosya kapanır, çıkış 2', async () => {
    const clock = new FakeClock()
    const redis = new FakeLiveRedis({ now: clock.now })
    const { result, stub, output, logs } = await run({
      clock,
      redis,
      minutes: 30,
      handler: (_req, index) => {
        if (index === 1) redis.seed(LIVE_KEYS.provider('adsbLol'), '{}', 180_000)
        return jsonReply(fixturePointFrame(clock.now()))
      },
    })
    expect(times(stub)).toEqual([FAKE_T0, FAKE_T0 + 10_000, FAKE_T0 + 20_000])
    expect(result).toMatchObject({ exitCode: 2, stopReason: 'other_ingest', frames: 3 })
    expect(loadRecording(output.final).frames).toHaveLength(3)
    expect(logs.join('\n')).toContain('başka bir ingest var')
    expect(redis.peek(LIVE_LOCK_KEY)).toBeNull()
  })

  it('kilit kaybedilirse 30 sn denetiminde durur, çıkış 2', async () => {
    const clock = new FakeClock()
    const redis = new FakeLiveRedis({ now: clock.now })
    const { result, stub } = await run({
      clock,
      redis,
      minutes: 30,
      handler: (_req, index) => {
        if (index === 1) redis.store.delete(LIVE_LOCK_KEY)
        return jsonReply(fixturePointFrame(clock.now()))
      },
    })
    expect(stub.requests).toHaveLength(3)
    expect(result).toMatchObject({ exitCode: 2, stopReason: 'lock_lost', frames: 3 })
  })

  it('Redis kurulamazsa uyarı verilir ve kilitsiz devam edilir', async () => {
    const { result, stub, logs } = await run({ redis: null })
    expect(result.exitCode).toBe(0)
    expect(stub.requests.length).toBeGreaterThan(0)
    expect(logs.join('\n')).toContain('Redis yok; başka canlı çalışma denetlenemedi')
  })

  it('PING yanıt vermezse: bağlantı kesilir, açık istemci kalmaz, kayıt sürer', async () => {
    const clock = new FakeClock()
    const redis = new FakeLiveRedis({ now: clock.now, ping: 'never' })
    const { result, stub, logs } = await run({ clock, redis, redisTimeoutMs: 50 })
    expect(result.exitCode).toBe(0)
    expect(stub.requests.length).toBeGreaterThan(0)
    expect(redis.errorListeners).toBe(1)
    expect(redis.disconnectCalls).toBe(1)
    expect(redis.isOpen()).toBe(false)
    expect(redis.commands).toEqual(['ping'])
    expect(logs.join('\n')).toContain('Redis yok')
  })

  it.each([
    ['EXISTS yanıt vermez', { exists: 'never' }],
    ['EXISTS hata verir', { exists: 'error' }],
    ['SET NX yanıt vermez', { set: 'never' }],
    ['GET (son istek) yanıt vermez', { get: 'never' }],
    ['GET (son istek) hata verir', { get: 'error' }],
  ] as const)(
    "PING'den sonra %s: kilitsiz devam edilmez, istek atılmaz, çıkış 2",
    async (_label, faults) => {
      const clock = new FakeClock()
      const redis = new FakeLiveRedis({ now: clock.now, faults })
      // EXISTS bozukken başka bir ingest adsb.lol'den çekiyor: kilitsiz devam onunla aynı IP'den
      // çekmek olurdu. Diğer durumlarda kilit alınır ve bırakılmalıdır.
      if ('exists' in faults) redis.seed(LIVE_KEYS.provider('adsbLol'), '{}', 180_000)
      redis.seed(LIVE_LAST_KEY, String(FAKE_T0 - 1_000), 60_000)
      const { result, stub, fetchSpy, logs } = await run({ clock, redis, redisTimeoutMs: 50 })
      expect(result).toMatchObject({ exitCode: 2, requests: 0, frames: 0 })
      expect(stub.requests).toHaveLength(0)
      expect(fetchSpy).not.toHaveBeenCalled()
      const joined = logs.join('\n')
      expect(joined).toContain(refusalText({ code: 'redis_unanswered' }))
      expect(joined).not.toContain('kilitsiz devam')
      // Alınan kilit bırakılır (yanıtsız SET için de bırakma denenir); istemci kapanır.
      expect(redis.peek(LIVE_LOCK_KEY)).toBeNull()
      expect(redis.isOpen()).toBe(false)
      expect(redis.commands.includes('eval')).toBe(!('exists' in faults))
    },
  )

  it('REDIS_LIVE_URL yoksa Redis denenmez, uyarıyla devam edilir', async () => {
    const { result, factory, logs } = await run({ source: { REDIS_LIVE_URL: undefined } })
    expect(result.exitCode).toBe(0)
    expect(factory).not.toHaveBeenCalled()
    expect(logs.join('\n')).toContain('Redis yok')
  })
})

// ---------------------------------------------------------------------------------------------
// Gizlilik süzgeci

const POS = { lat: 41.1, lon: 28.9, seen_pos: 1, seen: 0.5, type: 'adsb_icao' }

function privacyFrame(): AdsbLolEnvelope {
  const frame = fixturePointFrame(FAKE_T0)
  frame.ac.push(
    { hex: 'a00001', dbFlags: 1, r: 'MIL01', flight: 'RCH123', ...POS },
    { hex: 'a00003', dbFlags: 3, r: 'MIL03', ...POS },
    { hex: 'a0000a', dbFlags: 'x', ...POS },
    { hex: 'a0000b', dbFlags: -1, ...POS },
    { hex: 'a0000d', dbFlags: 1.5, ...POS },
    { hex: 'a0000e', dbFlags: null, ...POS },
    { hex: 'a00004', dbFlags: 4, r: 'N123AB', ownOp: 'Owner LLC', flight: 'EJA123  ', ...POS },
    { hex: 'a00008', dbFlags: 8, r: 'D-IABC', ownOp: 'Sahip', flight: 'DIABC', ...POS },
    { hex: 'a0000c', dbFlags: 12, r: 'TC-ABC', ownOp: 'Sahip', ...POS },
    { hex: 'a00002', dbFlags: 2, r: 'TC-XYZ', flight: 'TCXYZ', ...POS },
  )
  frame.ac.push('bozuk' as unknown as Record<string, unknown>)
  frame.total = frame.ac.length
  return frame
}

describe('sanitizeFrameForFixture', () => {
  it('askerî ve bozuk dbFlags atılır; PIA/LADD tescili ve tescille aynı çağrı kodu silinir', () => {
    const original = privacyFrame()
    const snapshot = structuredClone(original)
    const sanitized = sanitizeFrameForFixture(original) as AdsbLolEnvelope
    expect(original).toEqual(snapshot)
    const byHex = new Map(sanitized.ac.map((a) => [a.hex, a]))
    for (const hex of ['a00001', 'a00003', 'a0000a', 'a0000b', 'a0000d', 'a0000e']) {
      expect(byHex.has(hex)).toBe(false)
    }
    expect(sanitized.ac.every((a) => typeof a === 'object')).toBe(true)
    expect(byHex.get('a00004')).toEqual({ hex: 'a00004', dbFlags: 4, flight: 'EJA123  ', ...POS })
    expect(byHex.get('a00008')).toEqual({ hex: 'a00008', dbFlags: 8, ...POS })
    expect(byHex.get('a0000c')).toEqual({ hex: 'a0000c', dbFlags: 12, ...POS })
    // TC-OIL (LADD) "TCOIL" çağrı kodunu da kaybeder.
    const oil = byHex.get('4bbd2c')!
    expect(oil).not.toHaveProperty('r')
    expect(oil).not.toHaveProperty('flight')
    // Diğerleri ve zarf alanları aynen; total güncel.
    const kept = original.ac.filter(
      (a) => typeof a === 'object' && [undefined, 2].includes(a.dbFlags as number | undefined),
    )
    for (const a of kept) expect(byHex.get(a.hex as string)).toEqual(a)
    expect(sanitized.ac).toHaveLength(kept.length + 4)
    expect(sanitized.total).toBe(sanitized.ac.length)
    const { ac: _a, total: _t, ...envelope } = sanitized
    const { ac: _b, total: _u, ...originalEnvelope } = original
    expect(envelope).toEqual(originalEnvelope)
    // Süzgeç kararlıdır; zarf olmayan değer olduğu gibi döner.
    expect(sanitizeFrameForFixture(sanitized)).toEqual(sanitized)
    expect(sanitizeFrameForFixture(42)).toBe(42)
    const noAc = { now: 1 }
    expect(sanitizeFrameForFixture(noAc)).toBe(noAc)
  })

  it('süzülmüş karede withPrivacy bir şey değiştirmez (adsbLol); yerel alıcı karşı denetimi', () => {
    const sanitized = sanitizeFrameForFixture(privacyFrame())
    const parsed = parseLiveResponse(sanitized, 'adsbLol', { receivedAt: FAKE_T0 })
    expect(parsed.aircraft.length).toBeGreaterThan(18)
    expect(parsed.rejected).toEqual([])
    for (const state of parsed.aircraft) {
      expect(withPrivacy(state)).toEqual(state)
      expect(state.dbFlags).not.toBeNull()
      expect(hasDbFlag(state.dbFlags, 'military')).toBe(false)
    }
    // Karşı denetim: aynı kare yerel alıcı gibi okunursa eksik dbFlags "bilinmiyor" (null) olur
    // ve withPrivacy tescili gizler; bu yüzden süzgeç adsb.lol anlamıyla (yok = 0) sınanır.
    const local = parseLiveResponse(sanitized, 'localReceiver', { receivedAt: FAKE_T0 })
    const unknown = local.aircraft.find((a) => a.hex === '4b8750')!
    expect(unknown.dbFlags).toBeNull()
    expect(withPrivacy(unknown).registration).toBeNull()
  })

  it('--fixture: tools/fixtures/replay altına süzülmüş kareler ve sanitized: true künye', async () => {
    const clock = new FakeClock()
    const { result, root, logs } = await run({
      clock,
      args: { fixture: true },
      handler: () => jsonReply({ ...privacyFrame(), now: clock.now(), ctime: clock.now() }),
    })
    expect(result.exitCode).toBe(0)
    const fixture = recordOutputPaths(root, { out: null, fixture: true }, BASE_NAME)
    expect(result.outPath).toBe(fixture.final)
    expect(existsSync(join(root, 'tools', 'recordings'))).toBe(false)
    expect(existsSync(fixture.partial)).toBe(false)
    expect(readMeta(fixture.meta).sanitized).toBe(true)
    expect(logs.join('\n')).toContain('gizlilik süzgeciyle')
    for (const line of lines(fixture.final)) {
      const frame = JSON.parse(line) as AdsbLolEnvelope
      expect(sanitizeFrameForFixture(frame)).toEqual(frame)
      expect(frame.ac.some((a) => a.hex === 'a00001' || a.hex === 'a0000e')).toBe(false)
      expect(frame.total).toBe(frame.ac.length)
    }
  })
})
