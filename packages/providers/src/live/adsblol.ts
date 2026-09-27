import { assertProvidersAllowed, PROVIDER_LICENSES, type DataUsageMode } from '../license'
import { BodyTooLargeError, headersAreValid, parseRetryAfter, readTextCapped } from './http'
import { parseLiveResponse, ResponseFormatError, type ParsedResponse } from './response'

/**
 * adsb.lol API istemcisi (data-sources.md §1). Tek canlı kaynak; yalnızca worker çağırır.
 * - Her istekte tanımlayıcı User-Agent (boş ya da `node` UA 403 alır).
 * - Durum kodu JSON ayrıştırmadan önce denetlenir: 429/420 kısıtlama, 401/403 yapılandırma ya da
 *   politika hatası (döngüde yeniden denenmez), 5xx sunucu hatası. 429 gövdesi nginx HTML'idir ve
 *   Retry-After taşımaz; varsa kullanılır (en fazla 300 sn).
 * - Yönlendirme izlenmez (anahtar başlığı başka adrese gitmesin); yanıt boyutu sınırlıdır; yanıtın
 *   saati bizimkinden 60 sn'den fazla saparsa yanıt reddedilir.
 * - Hız sınırı burada değil, çağıranın AIMD kovasındadır (M4): istemci her çağrıda tek istek atar.
 */

export const ADSBLOL_BASE_URL = 'https://api.adsb.lol'
/** Nokta sorgusu yarıçapı üst sınırı (NM). */
export const MAX_RADIUS_NM = 250
/** Çağrı başına en fazla hex ve URL uzunluğu. */
export const MAX_HEX_PER_CALL = 500
export const MAX_URL_LENGTH = 4096
export const REQUEST_TIMEOUT_MS = 15_000
/** Açılmış yanıt üst sınırı; 250 NM'lik çember ~2 MB'tır. */
export const MAX_RESPONSE_BYTES = 32 * 1024 * 1024

export type AdsbLolErrorKind =
  /** 401/403: anahtar ya da User-Agent reddedildi; devre açılır, yeniden denenmez. */
  | 'config'
  /** 429 ya da 420: hız yarıya iner, geri çekilme. */
  | 'rate_limit'
  /** 5xx: geri çekilme ve devre kesici. */
  | 'server'
  /** Ağ hatası ya da zaman aşımı (istek ya da gövde okunurken). */
  | 'network'
  /** 200 ama gövde beklenen biçimde değil, çok büyük ya da saati kaymış. */
  | 'response'
  /** Diğer 4xx, yönlendirme ya da geçersiz sorgu (istek hiç gönderilmeden). */
  | 'request'

export class AdsbLolError extends Error {
  constructor(
    readonly kind: AdsbLolErrorKind,
    message: string,
    readonly status: number | null = null,
    /** Yalnızca yanıt Retry-After taşıyorsa (saniye, en fazla 300). */
    readonly retryAfterSec: number | null = null,
  ) {
    super(message)
    this.name = 'AdsbLolError'
  }
}

export interface UserAgentInput {
  appName: string
  version: string
  /** Şemasız genel host (ör. havayolu.live); yerelde boş. */
  webHost?: string | null
  contactEmail?: string | null
}

/**
 * Sağlayıcı istekleri için User-Agent (data-sources.md §1):
 * `havayolu/<sürüm> (+https://<WEB_HOST>; <CONTACT_EMAIL>)`, WEB_HOST boşsa `(+mailto:<CONTACT_EMAIL>)`.
 */
export function providerUserAgent({ appName, version, webHost, contactEmail }: UserAgentInput) {
  const host = webHost?.trim()
  const email = contactEmail?.trim()
  const contact = host
    ? [`+https://${host}`, email].filter(Boolean).join('; ')
    : email
      ? `+mailto:${email}`
      : ''
  return `${appName}/${version}${contact ? ` (${contact})` : ''}`
}

export interface AdsbLolOptions extends UserAgentInput {
  dataUsageMode: DataUsageMode
  apiKey?: string | null
  apiKeyHeader?: string | null
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
  /** Saat (yanıtın saat kayması denetimi için); testte sabitlenir. */
  now?: () => number
}

export interface AdsbLolResult extends ParsedResponse {
  /** İsteğin gövde dahil süresi (ms). */
  latencyMs: number
}

/** Değerlerde izin verilen karakterler (data-sources.md). */
const SAFE_VALUE = /^[a-zA-Z0-9=_.-]+$/

function coordinate(value: number, max: number, name: string): string {
  if (!Number.isFinite(value) || Math.abs(value) > max) {
    throw new AdsbLolError('request', `${name} geçersiz: ${value}`)
  }
  // Sabit 4 ondalık (~11 m); üstel gösterim (1e-7) oluşmaz.
  const fixed = value.toFixed(4).replace(/\.?0+$/, '')
  return fixed === '-0' ? '0' : fixed
}

function values(list: readonly string[], name: string, normalize: (v: string) => string): string {
  const cleaned = [...new Set(list.map((v) => normalize(v.trim())).filter(Boolean))]
  if (cleaned.length === 0) throw new AdsbLolError('request', `${name} listesi boş`)
  const invalid = cleaned.filter((v) => !SAFE_VALUE.test(v))
  if (invalid.length > 0) {
    throw new AdsbLolError('request', `${name} geçersiz karakter içeriyor: ${invalid.join(', ')}`)
  }
  return cleaned.join(',')
}

/**
 * Hex listesini çağrı sınırlarına göre böler. Yalnızca 6 haneli ICAO adresleri sorgulanır: ICAO dışı
 * (`~`) ve bozuk değerler atlanır (biri bütün bir çağrıyı düşürmesin diye).
 */
export function chunkHexes(hexes: readonly string[]): string[][] {
  const unique = [...new Set(hexes.map((h) => h.trim().toLowerCase()))].filter((h) =>
    /^[0-9a-f]{6}$/.test(h),
  )
  const chunks: string[][] = []
  let current: string[] = []
  let length = 0
  for (const hex of unique) {
    const added = hex.length + 1
    if (current.length >= MAX_HEX_PER_CALL || length + added > MAX_URL_LENGTH - 200) {
      chunks.push(current)
      current = []
      length = 0
    }
    current.push(hex)
    length += added
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

export function createAdsbLolClient(options: AdsbLolOptions) {
  assertProvidersAllowed(options.dataUsageMode, [PROVIDER_LICENSES.adsbLol])
  if (!options.contactEmail?.trim()) {
    throw new AdsbLolError(
      'config',
      'CONTACT_EMAIL tanımlı değil: adsb.lol User-Agent için zorunlu',
    )
  }
  const apiKey = options.apiKey?.trim() || null
  const apiKeyHeader = options.apiKeyHeader?.trim() || null
  if (apiKey && !apiKeyHeader) {
    throw new AdsbLolError('config', 'ADSBLOL_API_KEY verildi ama ADSBLOL_API_KEY_HEADER boş')
  }
  const baseUrl = (options.baseUrl ?? ADSBLOL_BASE_URL).replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  const now = options.now ?? (() => Date.now())
  const headers: Record<string, string> = {
    'user-agent': providerUserAgent(options),
    accept: 'application/json',
    'accept-encoding': 'gzip',
    ...(apiKey && apiKeyHeader ? { [apiKeyHeader]: apiKey } : {}),
  }
  // Geçersiz başlık fetch içinde ağ hatası gibi görünürdü; değerler mesaja yazılmaz.
  if (!headersAreValid(headers)) {
    throw new AdsbLolError(
      'config',
      'User-Agent, ADSBLOL_API_KEY ya da ADSBLOL_API_KEY_HEADER geçersiz karakter içeriyor',
    )
  }

  async function get(path: string): Promise<AdsbLolResult> {
    const url = `${baseUrl}${path}`
    if (url.length > MAX_URL_LENGTH) {
      throw new AdsbLolError('request', `URL ${MAX_URL_LENGTH} karakteri aşıyor`)
    }
    const started = performance.now()
    let response: Response
    try {
      response = await doFetch(url, {
        headers,
        // Yönlendirme izlenmez: anahtar başlığı başka bir adrese taşınmasın (3xx → request hatası).
        redirect: 'manual',
        signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      throw new AdsbLolError('network', `adsb.lol'e ulaşılamadı: ${(error as Error).name}`)
    }
    const { status } = response
    if (status !== 200) {
      // Gövde HTML ya da düz metin olabilir; JSON olarak okunmaz, yalnızca başı okunur.
      const snippet = (await readTextCapped(response, 4096).catch(() => ''))
        .replace(/\s+/g, ' ')
        .slice(0, 120)
      const retryAfterSec = parseRetryAfter(response.headers.get('retry-after'), now())
      const detail = `HTTP ${status}${snippet ? `: ${snippet}` : ''}`
      if (status === 401 || status === 403) {
        throw new AdsbLolError('config', `adsb.lol isteği reddetti (${detail})`, status)
      }
      if (status === 429 || status === 420) {
        throw new AdsbLolError(
          'rate_limit',
          `adsb.lol hız sınırı (${detail})`,
          status,
          retryAfterSec,
        )
      }
      if (status >= 500)
        throw new AdsbLolError('server', `adsb.lol sunucu hatası (${detail})`, status)
      throw new AdsbLolError('request', `adsb.lol beklenmedik yanıt (${detail})`, status)
    }
    let text: string
    try {
      text = await readTextCapped(response, MAX_RESPONSE_BYTES)
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        throw new AdsbLolError('response', `adsb.lol yanıtı çok büyük (${error.message})`, status)
      }
      // Gövde okunurken zaman aşımı ya da bağlantı kopması: ağ hatası.
      throw new AdsbLolError(
        'network',
        `adsb.lol yanıtı okunamadı: ${(error as Error).name}`,
        status,
      )
    }
    const latencyMs = Math.round(performance.now() - started)
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      throw new AdsbLolError('response', 'adsb.lol yanıtı JSON değil', status)
    }
    try {
      return { ...parseLiveResponse(body, 'adsbLol', { receivedAt: now() }), latencyMs }
    } catch (error) {
      if (error instanceof ResponseFormatError) {
        throw new AdsbLolError('response', error.message, status)
      }
      throw error
    }
  }

  return {
    userAgent: headers['user-agent'],
    /** ARP merkezli çember; yarıçap NM, tamsayı, en fazla 250. */
    async point(lat: number, lon: number, radiusNm: number) {
      if (!Number.isInteger(radiusNm) || radiusNm < 1 || radiusNm > MAX_RADIUS_NM) {
        throw new AdsbLolError('request', `yarıçap 1–${MAX_RADIUS_NM} NM arası tamsayı olmalı`)
      }
      return get(
        `/v2/point/${coordinate(lat, 90, 'enlem')}/${coordinate(lon, 180, 'boylam')}/${radiusNm}`,
      )
    },
    /** En fazla 500 hex; daha fazlası için `chunkHexes`. ICAO dışı ve bozuk değerler atlanır. */
    async hex(hexes: readonly string[]) {
      const [chunk, ...rest] = chunkHexes(hexes)
      if (!chunk) throw new AdsbLolError('request', 'sorgulanabilir hex yok')
      if (rest.length > 0) {
        throw new AdsbLolError('request', 'tek çağrı için çok fazla hex; chunkHexes ile böl')
      }
      return get(`/v2/hex/${values(chunk, 'hex', (v) => v)}`)
    },
    async callsign(callsigns: readonly string[]) {
      return get(`/v2/callsign/${values(callsigns, 'çağrı kodu', (v) => v.toUpperCase())}`)
    },
    async registration(registrations: readonly string[]) {
      return get(`/v2/reg/${values(registrations, 'tescil', (v) => v.toUpperCase())}`)
    },
  }
}

export type AdsbLolClient = ReturnType<typeof createAdsbLolClient>
