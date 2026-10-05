import { ADSBLOL_BASE_URL, MAX_RESPONSE_BYTES, readTextCapped } from '@havayolu/providers'
import { ADSBLOL_RATE } from '@havayolu/worker/ingest/rate'

/**
 * Canlı araçların ek bekçisi (D-094): adsb.lol istemcisinin `fetch`'ini sarar ve yalnızca şu isteğe
 * izin verir: taban adresin kökeni, GET, `/v2/point/<enlem>/<boylam>/<yarıçap>` (sorgu dizesi yok),
 * `redirect: 'manual'`, User-Agent var ve önceki isteğin başlangıcından en az 5 sn sonra (üst sınır
 * 0,2 istek/sn; saat oynamasına 250 ms pay). İhlal sabit bir neden kaydeder (başlık değeri asla),
 * `violation()`'ı doldurur ve LiveGuardError fırlatır. Bekçi KİLİTLENİR: ilk ihlalden sonra her
 * çağrı alttaki fetch'e hiç gitmeden hata verir. İstemci bu hatayı `network` türüne çevirir; çağıran
 * her istekten sonra `violation()`'a bakar ve çıkış 4 ile durur.
 */

/** İki istek başlangıcı arası en kısa süre: 1000 / üst sınır (0,2 istek/sn) = 5000 ms. */
export const LIVE_MIN_GAP_MS = 1000 / ADSBLOL_RATE.ceilingRps
/** Zamanlayıcı ve saat oynaması payı: aralık `minGapMs − 250`'den kısaysa ihlaldir. */
export const LIVE_GAP_TOLERANCE_MS = 250

const POINT_PATH = /^\/v2\/point\/-?\d+(\.\d+)?\/-?\d+(\.\d+)?\/\d{1,3}$/

export type LiveGuardReason =
  | 'base_url'
  | 'request'
  | 'origin'
  | 'method'
  | 'path'
  | 'redirect'
  | 'user_agent'
  | 'gap'
  | 'latched'
  | 'targets'

const REASON_TEXT: Record<LiveGuardReason, string> = {
  base_url:
    'bekçi: taban adres izinli değil (yalnızca https://api.adsb.lol ya da http://127.0.0.1:<port> test sunucusu)',
  request: 'bekçi: istek çözümlenemedi',
  origin: 'bekçi: taban adresin dışında bir adrese istek',
  method: 'bekçi: GET dışında istek',
  path: 'bekçi: /v2/point dışında yol (hex, all, mil, ladd, pia, routeset ve route yasak)',
  redirect: "bekçi: yönlendirme 'manual' değil",
  user_agent: 'bekçi: User-Agent yok',
  gap: "bekçi: iki istek arası 5 sn'den kısa (üst sınır 0,2 istek/sn)",
  latched: 'bekçi: önceki ihlalden sonra istek atılmaz',
  targets: 'bekçi: smoke hedefi güvensiz',
}

export class LiveGuardError extends Error {
  constructor(
    readonly reason: LiveGuardReason,
    message: string = REASON_TEXT[reason],
  ) {
    super(message)
    this.name = 'LiveGuardError'
  }
}

/** İstemciyle aynı biçim: sabit 4 ondalık, sondaki sıfırlar atılır, -0 → 0. */
function coordinate(value: number): string {
  const fixed = value.toFixed(4).replace(/\.?0+$/, '')
  return fixed === '-0' ? '0' : fixed
}

/** adsb.lol nokta sorgusunun yolu; LTFM 40 NM → `/v2/point/41.2749/28.7321/40`. */
export function pointPath(lat: number, lon: number, radiusNm: number): string {
  return `/v2/point/${coordinate(lat)}/${coordinate(lon)}/${radiusNm}`
}

/** Yalnızca canlı adsb.lol (`ADSBLOL_BASE_URL`) ya da `http://127.0.0.1:<port>` test sunucusu. */
export function assertAllowedBaseUrl(baseUrl: string): void {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new LiveGuardError('base_url')
  }
  const bare = url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password
  const live = url.origin === new URL(ADSBLOL_BASE_URL).origin
  const stub = url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port !== ''
  if (!bare || !(live || stub)) throw new LiveGuardError('base_url')
}

export interface LiveRequestRecord {
  path: string
  /** Başlangıç (verilen saatle, ms). */
  startedAt: number
  /** Yanıt durumu; ağ hatasında null. */
  status: number | null
  /** Başlıklar gelene kadar geçen süre (verilen saatle, ms). */
  durationMs: number
  /** Yakalanan gövdenin bayt sayısı ya da content-length; bilinmiyorsa null. */
  bytes: number | null
}

export interface LiveFetch {
  fetch: typeof fetch
  requests(): readonly LiveRequestRecord[]
  /** İlk ihlalin sabit nedeni; ihlal yoksa null. */
  violation(): string | null
  /** Son 200 yanıtın ham gövdesi (`captureBodies` ile); bir kez alınır, yoksa null. */
  takeBody(): Promise<string | null>
}

export interface LiveFetchOptions {
  baseUrl: string
  now: () => number
  fetch?: typeof fetch
  minGapMs?: number
  captureBodies?: boolean
}

export function createLiveFetch(opts: LiveFetchOptions): LiveFetch {
  assertAllowedBaseUrl(opts.baseUrl)
  const origin = new URL(opts.baseUrl).origin
  const inner = opts.fetch ?? globalThis.fetch
  const minGapMs = opts.minGapMs ?? LIVE_MIN_GAP_MS
  const records: LiveRequestRecord[] = []
  let violated: LiveGuardError | null = null
  let lastStart: number | null = null
  let pendingBody: Promise<string | null> | null = null

  const fail = (reason: LiveGuardReason): never => {
    violated = new LiveGuardError(reason)
    throw violated
  }

  const guarded = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    if (violated !== null) throw new LiveGuardError('latched')
    let request: Request
    try {
      request = new Request(input, init)
    } catch {
      return fail('request')
    }
    const url = new URL(request.url)
    if (url.origin !== origin) return fail('origin')
    if (request.method !== 'GET') return fail('method')
    if (!POINT_PATH.test(url.pathname) || url.search || url.hash) return fail('path')
    if (request.redirect !== 'manual') return fail('redirect')
    if (!request.headers.get('user-agent')?.trim()) return fail('user_agent')
    const startedAt = opts.now()
    if (lastStart !== null && startedAt - lastStart < minGapMs - LIVE_GAP_TOLERANCE_MS) {
      return fail('gap')
    }
    lastStart = startedAt
    const record: LiveRequestRecord = {
      path: url.pathname,
      startedAt,
      status: null,
      durationMs: 0,
      bytes: null,
    }
    records.push(record)
    pendingBody = null
    let response: Response
    try {
      response = await inner(input, init)
    } catch (error) {
      record.durationMs = Math.max(0, opts.now() - startedAt)
      throw error
    }
    record.status = response.status
    record.durationMs = Math.max(0, opts.now() - startedAt)
    const declared = Number(response.headers.get('content-length'))
    if (response.headers.has('content-length') && Number.isFinite(declared)) {
      record.bytes = declared
    }
    if (opts.captureBodies && response.status === 200) {
      // İstemcinin kendi okuması (durum denetimi, 32 MiB sınırı, zaman aşımı) aynen sürer; kopya
      // aynı anda okunur ki iki dal birbirini beklemesin. undici gzip'i zaten açmıştır.
      pendingBody = readTextCapped(response.clone(), MAX_RESPONSE_BYTES).then(
        (text) => {
          record.bytes = Buffer.byteLength(text)
          return text
        },
        () => null,
      )
    }
    return response
  }

  return {
    fetch: guarded as typeof fetch,
    requests: () => records.map((r) => ({ ...r })),
    violation: () => violated?.message ?? null,
    async takeBody() {
      const body = pendingBody
      pendingBody = null
      return body === null ? null : await body
    },
  }
}
