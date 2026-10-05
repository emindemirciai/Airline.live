import { readFileSync } from 'node:fs'
import { createServer, type IncomingHttpHeaders, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { createScenario } from '../../scenarios'
import { isLocalHostname } from '../env'
import { LIVE_LOCK_SCRIPTS, type LiveRedis } from '../lock'

/**
 * Canlı araç testlerinin yardımcıları (yalnızca test): 127.0.0.1'de sahte adsb.lol sunucusu, sahte
 * saat, yalnızca yerel adrese giden fetch, adsb.lol v2 zarfı ve bellek içi Redis. Hiçbiri ağa
 * çıkmaz.
 */

export const WORKSPACE_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
export const FIXTURES_DIR = fileURLToPath(new URL('../../../fixtures/', import.meta.url))

// ---------------------------------------------------------------------------------------------
// Yalnızca yerel fetch

const NATIVE_FETCH = Symbol.for('havayolu.tools.nativeFetch')
type TaggedFetch = typeof fetch & { [NATIVE_FETCH]?: typeof fetch }

/** Asıl fetch; kurulum dosyası global fetch'i değiştirmiş olsa da sarılmamış hâli. */
const nativeFetch: typeof fetch =
  (globalThis.fetch as TaggedFetch)[NATIVE_FETCH] ?? globalThis.fetch

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (input instanceof Request) return input.url
  if (input instanceof URL) return input.href
  return String(input)
}

/** Yalnızca localhost / 127.0.0.1 / [::1]'e (http/https) giden fetch; başkası ağa çıkmadan hata. */
export const localOnlyFetch: typeof fetch = async (input, init) => {
  let url: URL
  try {
    url = new URL(requestUrl(input))
  } catch {
    throw new TypeError('localOnlyFetch: invalid URL')
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !isLocalHostname(url.hostname)) {
    throw new Error(`tests must not reach a non-local host (${url.protocol}//${url.hostname})`)
  }
  return nativeFetch(input, init)
}

/** `vitest.setup.ts`: global fetch'i `localOnlyFetch` ile değiştirir (asıl fetch etiketle saklanır). */
export function installLocalOnlyFetch(): void {
  const tagged = localOnlyFetch as TaggedFetch
  tagged[NATIVE_FETCH] = nativeFetch
  globalThis.fetch = tagged
}

// ---------------------------------------------------------------------------------------------
// Sahte saat

/** Testlerin varsayılan başlangıç anı: 2026-10-04 12:00:00Z. */
export const FAKE_T0 = Date.UTC(2026, 9, 4, 12, 0, 0)

/**
 * `sleep` zamanı anında ilerletir ve olay döngüsüne bir tur verir (zamanlayıcılar ve soketler
 * aç kalmasın). `now` ve `sleep` ok fonksiyonudur: `clock.now` bağlamsız da geçirilebilir.
 */
export class FakeClock {
  current: number

  constructor(start: number = FAKE_T0) {
    this.current = start
  }

  readonly now = (): number => this.current

  readonly sleep = async (ms: number): Promise<void> => {
    this.current += Math.max(0, Number.isFinite(ms) ? ms : 0)
    await new Promise<void>((resolve) => setImmediate(resolve))
  }

  advance(ms: number): void {
    this.current += ms
  }
}

// ---------------------------------------------------------------------------------------------
// adsb.lol yanıtları

export interface AdsbLolEnvelope {
  ac: Record<string, unknown>[]
  msg: string
  /** Epoch ms. */
  now: number
  total: number
  ctime: number
  ptime: number
}

/** adsb.lol v2 zarfı: `{ ac, msg, now (ms), total, ctime, ptime }`. */
export function adsbLolEnvelope(
  ac: readonly Record<string, unknown>[],
  nowMs: number,
): AdsbLolEnvelope {
  return { ac: [...ac], msg: 'No error', now: nowMs, total: ac.length, ctime: nowMs, ptime: 0 }
}

const POINT_FIXTURE = fileURLToPath(
  new URL('../../../fixtures/adsblol/point-ltfm-40nm.json', import.meta.url),
)

/** Commit'li LTFM 40 NM karesi (18 uçak), `now` ve `ctime` verilen ana taşınmış; her çağrı yeni kopya. */
export function fixturePointFrame(nowMs: number): AdsbLolEnvelope {
  const frame = JSON.parse(readFileSync(POINT_FIXTURE, 'utf8')) as AdsbLolEnvelope
  return { ...frame, now: nowMs, ctime: nowMs }
}

/** `cruise` senaryosunun o anki karesi adsb.lol zarfında (`count` seyir + yaklaşma + taksi uçağı). */
export function cruiseFrame(nowMs: number, count: number): AdsbLolEnvelope {
  const aircraft = createScenario('cruise', { count }).frameAt(nowMs).aircraft
  return adsbLolEnvelope(aircraft as unknown as Record<string, unknown>[], nowMs)
}

/** adsb.lol'ün 429 gövdesi: nginx HTML'i, Retry-After yok. */
export const NGINX_429_HTML = [
  '<html>',
  '<head><title>429 Too Many Requests</title></head>',
  '<body>',
  '<center><h1>429 Too Many Requests</h1></center>',
  '<hr><center>nginx</center>',
  '</body>',
  '</html>',
  '',
].join('\r\n')

export function gzipJson(body: unknown): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(body)))
}

// ---------------------------------------------------------------------------------------------
// Sahte sunucu

export interface StubRequest {
  method: string
  /** Yol ve sorgu dizesi (ör. `/v2/point/41.2749/28.7321/40`). */
  path: string
  headers: IncomingHttpHeaders
  /** Geliş anı (`now` seçeneğiyle; varsayılan Date.now). */
  at: number
}

export interface StubReply {
  status?: number
  headers?: Record<string, string>
  /** Metin ya da bayt olduğu gibi; diğer değerler JSON olarak gönderilir; yoksa gövdesiz. */
  body?: unknown
  /** Gövdeyi gzip'le sıkıştırır (`content-encoding: gzip`; undici açar). */
  gzip?: boolean
  /** Yanıt yerine soketi keser (ağ hatası). */
  destroy?: boolean
}

export type StubHandler = (req: StubRequest, index: number) => StubReply | Promise<StubReply>

export interface AdsbLolStub {
  /** `http://127.0.0.1:<port>` (taban adres; sonunda / yok). */
  baseUrl: string
  requests: StubRequest[]
  close(): Promise<void>
}

/** JSON yanıtı (varsayılan 200). */
export function jsonReply(
  body: unknown,
  opts: { status?: number; gzip?: boolean; headers?: Record<string, string> } = {},
): StubReply {
  return {
    status: opts.status ?? 200,
    body,
    gzip: opts.gzip ?? false,
    headers: { 'content-type': 'application/json', ...opts.headers },
  }
}

/** adsb.lol'ün kısıtlama yanıtı: 429, nginx HTML'i, Retry-After yok. */
export function nginx429Reply(): StubReply {
  return { status: 429, headers: { 'content-type': 'text/html' }, body: NGINX_429_HTML }
}

function send(res: ServerResponse, reply: StubReply): void {
  if (reply.destroy) {
    res.socket?.destroy()
    return
  }
  const headers: Record<string, string> = { ...reply.headers }
  let bytes: Buffer | null = null
  if (reply.body !== undefined) {
    if (typeof reply.body === 'string') {
      bytes = Buffer.from(reply.body)
      headers['content-type'] ??= 'text/plain; charset=utf-8'
    } else if (reply.body instanceof Uint8Array) {
      bytes = Buffer.from(reply.body)
    } else {
      bytes = Buffer.from(JSON.stringify(reply.body))
      headers['content-type'] ??= 'application/json'
    }
    if (reply.gzip) {
      bytes = gzipSync(bytes)
      headers['content-encoding'] = 'gzip'
    }
    headers['content-length'] = String(bytes.byteLength)
  }
  res.writeHead(reply.status ?? 200, headers)
  res.end(bytes ?? undefined)
}

/**
 * 127.0.0.1'de rastgele portta sahte adsb.lol. Her isteği kaydeder ve `handler`'ın yanıtını
 * gönderir; handler hata verirse 500. Kapanışta açık bağlantılar da kesilir.
 */
export async function startAdsbLolStub(
  handler: StubHandler,
  opts: { now?: () => number } = {},
): Promise<AdsbLolStub> {
  const now = opts.now ?? Date.now
  const requests: StubRequest[] = []
  const server = createServer((req, res) => {
    const recorded: StubRequest = {
      method: req.method ?? 'GET',
      path: req.url ?? '/',
      headers: req.headers,
      at: now(),
    }
    const index = requests.push(recorded) - 1
    Promise.resolve()
      .then(() => handler(recorded, index))
      .then(
        (reply) => send(res, reply),
        () => send(res, { status: 500, body: 'stub handler failed' }),
      )
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const { port } = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

// ---------------------------------------------------------------------------------------------
// Bellek içi Redis (LiveRedis)

export type FakePingMode = 'ok' | 'never' | 'error'
/** PING'den sonraki komutların bozukluğu: `never` yanıt vermez, `error` hata verir. */
export type FakeCommandFault = 'never' | 'error'
export type FakeRedisCommand = 'exists' | 'get' | 'set' | 'eval'

/**
 * `LiveRedis`'in bellek içi karşılığı: SET NX PX, GET, EXISTS, kilit betikleri (adlarıyla tanınır),
 * TTL verilen saatle düşer. `ping: 'never'` yanıt vermeyen sunucuyu, `'error'` bağlantı hatasını
 * taklit eder; `faults` PING'e yanıt veren ama sonraki bir komutta takılan ya da hata veren sunucuyu
 * taklit eder. QUIT ya da disconnect'ten sonra komutlar hata verir; `isOpen()` testte istemcinin
 * kapandığını doğrular.
 */
export class FakeLiveRedis implements LiveRedis {
  readonly store = new Map<string, { value: string; expiresAt: number | null }>()
  readonly commands: string[] = []
  pingMode: FakePingMode
  readonly faults: Map<FakeRedisCommand, FakeCommandFault>
  quitCalls = 0
  disconnectCalls = 0
  errorListeners = 0
  private open = true
  private readonly now: () => number

  constructor(
    opts: {
      now?: () => number
      ping?: FakePingMode
      faults?: Partial<Record<FakeRedisCommand, FakeCommandFault>>
    } = {},
  ) {
    this.now = opts.now ?? Date.now
    this.pingMode = opts.ping ?? 'ok'
    this.faults = new Map(
      Object.entries(opts.faults ?? {}) as [FakeRedisCommand, FakeCommandFault][],
    )
  }

  isOpen(): boolean {
    return this.open
  }

  /** Test kurulumu: anahtarı doğrudan yazar (isteğe bağlı TTL, ms). */
  seed(key: string, value: string, ttlMs: number | null = null): void {
    this.store.set(key, { value, expiresAt: ttlMs === null ? null : this.now() + ttlMs })
  }

  /** Süresi dolmamış değer (test denetimi). */
  peek(key: string): string | null {
    return this.read(key)
  }

  private read(key: string): string | null {
    const entry = this.store.get(key)
    if (entry === undefined) return null
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  private command(name: string): void {
    this.commands.push(name)
    if (!this.open) throw new Error('Connection is closed.')
  }

  /** `faults`'taki komut: hiç çözülmeyen ya da reddedilen söz; bozukluk yoksa null. */
  private fault<T>(name: FakeRedisCommand): Promise<T> | null {
    const mode = this.faults.get(name)
    if (mode === 'never') return new Promise<T>(() => {})
    if (mode === 'error') return Promise.reject(new Error(`ERR fake ${name} failure`))
    return null
  }

  async ping(): Promise<string> {
    this.command('ping')
    if (this.pingMode === 'never') return new Promise<string>(() => {})
    if (this.pingMode === 'error') throw new Error('connect ECONNREFUSED 127.0.0.1:1')
    return 'PONG'
  }

  async exists(...keys: string[]): Promise<number> {
    this.command('exists')
    const fault = this.fault<number>('exists')
    if (fault !== null) return fault
    return keys.filter((key) => this.read(key) !== null).length
  }

  async get(key: string): Promise<string | null> {
    this.command('get')
    const fault = this.fault<string | null>('get')
    if (fault !== null) return fault
    return this.read(key)
  }

  async set(
    key: string,
    value: string,
    _px: 'PX',
    milliseconds: number,
    _nx: 'NX',
  ): Promise<'OK' | null> {
    this.command('set')
    const fault = this.fault<'OK' | null>('set')
    if (fault !== null) return fault
    if (this.read(key) !== null) return null
    this.store.set(key, { value, expiresAt: this.now() + milliseconds })
    return 'OK'
  }

  async eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown> {
    this.command('eval')
    const fault = this.fault<unknown>('eval')
    if (fault !== null) return fault
    const keys = args.slice(0, numKeys).map(String)
    const argv = args.slice(numKeys).map(String)
    if (script === LIVE_LOCK_SCRIPTS.refresh) {
      const [lock] = keys
      const [token, ttl] = argv
      if (lock === undefined || this.read(lock) !== token) return 0
      this.store.set(lock, { value: token ?? '', expiresAt: this.now() + Number(ttl) })
      return 1
    }
    if (script === LIVE_LOCK_SCRIPTS.release) {
      const [lock, last] = keys
      const [token, lastAt, ttl] = argv
      let released = 0
      if (lock !== undefined && this.read(lock) === token) {
        this.store.delete(lock)
        released = 1
      }
      if (last !== undefined && lastAt) {
        const previous = Number(this.read(last) ?? '0') || 0
        if (Number(lastAt) > previous) {
          this.store.set(last, { value: lastAt, expiresAt: this.now() + Number(ttl) })
        }
      }
      return released
    }
    throw new Error('FakeLiveRedis: unknown script')
  }

  on(event: 'error', _listener: (error: Error) => void): this {
    if (event === 'error') this.errorListeners += 1
    return this
  }

  async quit(): Promise<'OK'> {
    this.quitCalls += 1
    this.command('quit')
    this.open = false
    return 'OK'
  }

  disconnect(): void {
    this.disconnectCalls += 1
    this.open = false
  }
}
