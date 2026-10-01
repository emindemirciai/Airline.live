import { BodyTooLargeError, headersAreValid, readTextCapped } from '../live/http'
import {
  AwcFormatError,
  parseMetarResponse,
  parseTafResponse,
  STATION_ID,
  type MetarReport,
  type ParsedReports,
  type TafReport,
} from './awc-schema'

/**
 * NOAA Aviation Weather Center Data API istemcisi (data-sources.md §5, D-078). Yalnızca worker'ın
 * `jobs` rolü çağırır; web ve mobil istemci bu servise gitmez.
 * - Yalnızca belgelenmiş parametreler gönderilir (belgelenmemiş parametre 400 döner, AWC v4.26):
 *   METAR `ids`, `format=json`, `hours`; TAF `ids`, `format=json` (TAF'ta `hours` yoktur).
 * - İstasyon listesi tek istekte, düz virgülle ayrılmış gider (`ids=LTFM,LTBA`); yanıt belgelenen
 *   400 kayıt sınırına ulaşırsa liste ikiye bölünüp yeniden istenir (en fazla 2 düzey).
 * - Durum kodu JSON ayrıştırmadan önce denetlenir: 204 veri yok (gövde yok), 400 bizim hatamız,
 *   403 erişim engeli, 429 hız sınırı (Retry-After varsa okunur), 5xx sunucu hatası.
 * - Yönlendirme izlenmez, yanıt boyutu sınırlıdır, içerik türü JSON olmalıdır.
 * - Her istekte tanımlayıcı User-Agent (AWC özel User-Agent önerir).
 */

export const AVIATIONWEATHER_BASE_URL = 'https://aviationweather.gov/api/data'
/** Belgelenen yanıt başına kayıt sınırı ("most endpoints return a maximum of 400 entries"). */
export const AWC_MAX_ENTRIES = 400
/** Liste en fazla bu kadar düzey ikiye bölünür (1 + 2 + 4 istek). */
export const AWC_MAX_SPLIT_DEPTH = 2
/** METAR için geriye bakış (saat); AWC varsayılanı 1,5, alım gecikmesini karşılamak için 2. */
export const AWC_METAR_HOURS = 2
/**
 * Kesintiden sonra kaydı doldurmak için en uzun geriye bakış (saat). Worker bunu yalnızca son başarılı
 * kontrol eskiyse ister (`metarLookbackHours`, jobs/weather.ts).
 */
export const AWC_METAR_MAX_HOURS = 24
/**
 * Saat ve istasyon başına beklenen en çok METAR/SPECI (yarım saatte bir rapor + SPECI payı). Uzun
 * geriye bakışta istasyonlar, bir istek 400 kayıt sınırının altında kalacak küçüklükte gruplara
 * bölünür; 2 saatlik olağan istek 80 istasyona kadar tek istektir.
 */
export const AWC_METAR_PER_STATION_HOUR = 2.5
/** Bir çağrıdaki en fazla istasyon (URL ~1.000 karakter). */
export const AWC_MAX_IDS = 200
export const AWC_REQUEST_TIMEOUT_MS = 15_000
/** Açılmış yanıt üst sınırı; 61 istasyonun 2 saatlik METAR'ı ~150 KB'tır. */
export const AWC_MAX_RESPONSE_BYTES = 2_000_000
/** Retry-After üst sınırı (sn); daha uzun değer yanlış yapılandırma sayılır ve kırpılır. */
export const AWC_MAX_RETRY_AFTER_SEC = 6 * 3_600

export type AviationWeatherErrorKind =
  /** 429: hız sınırı; çağıran beklemeye geçer, yeniden denemez. */
  | 'rate_limit'
  /** 403: erişim engellendi; kaynağın davranışı değişti (DUR-SOR 3). */
  | 'forbidden'
  /** 5xx. */
  | 'server'
  /** Ağ hatası ya da zaman aşımı (istek ya da gövde okunurken). */
  | 'network'
  /** 200 ama gövde JSON değil, dizi değil ya da çok büyük. */
  | 'response'
  /** 400 ve diğer 4xx, yönlendirme ya da geçersiz istasyon listesi (istek gönderilmeden). */
  | 'request'

export class AviationWeatherError extends Error {
  constructor(
    readonly kind: AviationWeatherErrorKind,
    message: string,
    readonly status: number | null = null,
    /** Yalnızca yanıt Retry-After taşıyorsa (saniye). */
    readonly retryAfterSec: number | null = null,
  ) {
    super(message)
    this.name = 'AviationWeatherError'
  }
}

export interface AviationWeatherOptions {
  userAgent: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
  maxBodyBytes?: number
  /** Saat (ms); gelecek zaman denetimi ve Retry-After tarihi için, testte sabitlenir. */
  now?: () => number
}

export interface AwcFetchResult<T> extends ParsedReports<T> {
  /** 204: hiçbir istekte veri yok. */
  status: 200 | 204
  /** AWC'nin döndürdüğü kayıt sayısı (bölünmüşse toplam). */
  entryCount: number
  /** Atılan istek sayısı. */
  requests: number
  /** En derin bölmede bile 400 kayda ulaşıldı: bazı raporlar eksik olabilir. */
  truncated: boolean
  /** Son yanıtın Cache-Control başlığı (bilgi için; belgelenmemiştir). */
  cacheControl: string | null
}

/** Retry-After: saniye ya da HTTP tarihi; yoksa ya da geçersizse null, en fazla 6 saat. */
export function awcRetryAfter(value: string | null, now: number = Date.now()): number | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const seconds = /^\d+$/.test(trimmed)
    ? Number(trimmed)
    : Math.ceil((Date.parse(trimmed) - now) / 1000)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return Math.min(seconds, AWC_MAX_RETRY_AFTER_SEC)
}

/** İstasyon listesi: kırpılır, büyük harfe çevrilir, tekilleştirilir; geçersiz kod hata verir. */
export function normalizeStationIds(ids: readonly string[]): string[] {
  const cleaned = [...new Set(ids.map((id) => id.trim().toUpperCase()).filter(Boolean))]
  if (cleaned.length === 0) throw new AviationWeatherError('request', 'istasyon listesi boş')
  const invalid = cleaned.filter((id) => !STATION_ID.test(id))
  if (invalid.length > 0) {
    throw new AviationWeatherError('request', `geçersiz istasyon kodu: ${invalid.join(', ')}`)
  }
  if (cleaned.length > AWC_MAX_IDS) {
    throw new AviationWeatherError('request', `tek çağrıda en fazla ${AWC_MAX_IDS} istasyon`)
  }
  return cleaned
}

/** Hata gövdesinin kısa, tek satırlık özeti (AWC 400 gövdesi `{status:'error', error}`). */
function errorSnippet(text: string): string {
  let message = text
  try {
    const body = JSON.parse(text) as { error?: unknown }
    if (typeof body.error === 'string') message = body.error
  } catch {
    // JSON değil (HTML ya da düz metin): metnin başı kullanılır.
  }
  return message
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

type Product = 'metar' | 'taf'

interface RawResponse {
  status: 200 | 204
  entries: unknown[]
  cacheControl: string | null
}

export function createAviationWeatherClient(options: AviationWeatherOptions) {
  const userAgent = options.userAgent.trim()
  if (!userAgent) throw new AviationWeatherError('request', 'User-Agent boş olamaz')
  const headers: Record<string, string> = {
    'user-agent': userAgent,
    accept: 'application/json',
    'accept-encoding': 'gzip',
  }
  if (!headersAreValid(headers)) {
    throw new AviationWeatherError('request', 'User-Agent geçersiz karakter içeriyor')
  }
  const baseUrl = (options.baseUrl ?? AVIATIONWEATHER_BASE_URL).replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  const now = options.now ?? (() => Date.now())
  const timeoutMs = options.timeoutMs ?? AWC_REQUEST_TIMEOUT_MS
  const maxBodyBytes = options.maxBodyBytes ?? AWC_MAX_RESPONSE_BYTES

  function url(product: Product, ids: readonly string[], hours: number | null): string {
    // Virgüller kodlanmaz: AWC'nin kendi sayfası da düz virgül gönderir.
    const query = [`ids=${ids.join(',')}`, 'format=json']
    if (hours !== null) query.push(`hours=${hours}`)
    return `${baseUrl}/${product}?${query.join('&')}`
  }

  async function request(
    product: Product,
    ids: readonly string[],
    hours: number | null,
  ): Promise<RawResponse> {
    const label = product.toUpperCase()
    let response: Response
    try {
      response = await doFetch(url(product, ids, hours), {
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new AviationWeatherError(
        'network',
        `aviationweather.gov'a ulaşılamadı (${label}): ${(error as Error).name}`,
      )
    }
    const { status } = response
    const cacheControl = response.headers.get('cache-control')
    if (status === 204) {
      await response.body?.cancel().catch(() => undefined)
      return { status: 204, entries: [], cacheControl }
    }
    if (status !== 200) {
      const snippet = errorSnippet(await readTextCapped(response, 4096).catch(() => ''))
      const detail = `HTTP ${status}${snippet ? `: ${snippet}` : ''}`
      if (status === 429) {
        throw new AviationWeatherError(
          'rate_limit',
          `aviationweather.gov hız sınırı (${label}, ${detail})`,
          status,
          awcRetryAfter(response.headers.get('retry-after'), now()),
        )
      }
      if (status === 403) {
        throw new AviationWeatherError(
          'forbidden',
          `aviationweather.gov erişimi engelledi (${label}, ${detail})`,
          status,
        )
      }
      if (status >= 500) {
        throw new AviationWeatherError(
          'server',
          `aviationweather.gov sunucu hatası (${label}, ${detail})`,
          status,
        )
      }
      throw new AviationWeatherError(
        'request',
        `aviationweather.gov isteği reddetti (${label}, ${detail})`,
        status,
      )
    }
    const contentType = response.headers.get('content-type')
    if (contentType !== null && !/json/i.test(contentType)) {
      await response.body?.cancel().catch(() => undefined)
      throw new AviationWeatherError(
        'response',
        `aviationweather.gov yanıtı JSON değil (${label}, ${contentType.slice(0, 60)})`,
        status,
      )
    }
    let text: string
    try {
      text = await readTextCapped(response, maxBodyBytes)
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        throw new AviationWeatherError(
          'response',
          `aviationweather.gov yanıtı çok büyük (${label}, ${error.message})`,
          status,
        )
      }
      throw new AviationWeatherError(
        'network',
        `aviationweather.gov yanıtı okunamadı (${label}): ${(error as Error).name}`,
        status,
      )
    }
    // Boş gövde veri yok sayılır (AWC bu durumda 204 döner; 200 + boş gövde de aynı anlamdadır).
    if (text.trim() === '') return { status: 200, entries: [], cacheControl }
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      throw new AviationWeatherError('response', `${label} yanıtı JSON değil`, status)
    }
    if (!Array.isArray(body)) {
      throw new AviationWeatherError('response', `${label} yanıtı dizi değil`, status)
    }
    return { status: 200, entries: body, cacheControl }
  }

  /** 400 kayıt sınırına ulaşan yanıtta liste ikiye bölünür (en fazla AWC_MAX_SPLIT_DEPTH düzey). */
  async function collect(
    product: Product,
    ids: readonly string[],
    hours: number | null,
    depth = 0,
  ): Promise<{ responses: RawResponse[]; requests: number; truncated: boolean }> {
    const response = await request(product, ids, hours)
    if (response.entries.length < AWC_MAX_ENTRIES) {
      return { responses: [response], requests: 1, truncated: false }
    }
    if (ids.length < 2 || depth >= AWC_MAX_SPLIT_DEPTH) {
      return { responses: [response], requests: 1, truncated: true }
    }
    const middle = Math.ceil(ids.length / 2)
    const first = await collect(product, ids.slice(0, middle), hours, depth + 1)
    const second = await collect(product, ids.slice(middle), hours, depth + 1)
    return {
      responses: [...first.responses, ...second.responses],
      requests: 1 + first.requests + second.requests,
      truncated: first.truncated || second.truncated,
    }
  }

  async function fetchProduct<T>(
    product: Product,
    rawIds: readonly string[],
    hours: number | null,
    parse: (body: unknown, stations: ReadonlySet<string>) => ParsedReports<T>,
  ): Promise<AwcFetchResult<T>> {
    const ids = normalizeStationIds(rawIds)
    // Uzun METAR geriye bakışında liste baştan gruplara bölünür (sınıra çarpıp yinelemek yerine).
    const size =
      hours === null
        ? ids.length
        : Math.max(1, Math.floor(AWC_MAX_ENTRIES / (hours * AWC_METAR_PER_STATION_HOUR)))
    const responses: RawResponse[] = []
    let requests = 0
    let truncated = false
    for (let i = 0; i < ids.length; i += size) {
      const part = await collect(product, ids.slice(i, i + size), hours)
      responses.push(...part.responses)
      requests += part.requests
      truncated ||= part.truncated
    }
    const entries = responses.flatMap((r) => r.entries)
    let parsed: ParsedReports<T>
    try {
      parsed = parse(entries, new Set(ids))
    } catch (error) {
      if (error instanceof AwcFormatError) {
        throw new AviationWeatherError('response', error.message, 200)
      }
      throw error
    }
    return {
      status: responses.some((r) => r.status === 200) ? 200 : 204,
      items: parsed.items,
      skipped: parsed.skipped,
      entryCount: entries.length,
      requests,
      truncated,
      cacheControl: responses.at(-1)?.cacheControl ?? null,
    }
  }

  return {
    userAgent,
    /**
     * METAR ve SPECI; `hours` geriye bakış (varsayılan 2, en çok `AWC_METAR_MAX_HOURS` saat). Uzun
     * geriye bakışta istasyonlar 400 kayıt sınırına göre birkaç isteğe bölünür.
     */
    async metars(
      ids: readonly string[],
      { hours = AWC_METAR_HOURS }: { hours?: number } = {},
    ): Promise<AwcFetchResult<MetarReport>> {
      if (!Number.isInteger(hours) || hours <= 0 || hours > AWC_METAR_MAX_HOURS) {
        throw new AviationWeatherError(
          'request',
          `hours 1–${AWC_METAR_MAX_HOURS} arası tam sayı olmalı: ${hours}`,
        )
      }
      return fetchProduct('metar', ids, hours, (body, stations) =>
        parseMetarResponse(body, { stations, now: now() }),
      )
    },
    /** Geçerli TAF'lar (AWC varsayılanı `time=valid`); bu uç `hours` almaz. */
    async tafs(ids: readonly string[]): Promise<AwcFetchResult<TafReport>> {
      return fetchProduct('taf', ids, null, (body, stations) =>
        parseTafResponse(body, { stations, now: now() }),
      )
    },
  }
}

export type AviationWeatherClient = ReturnType<typeof createAviationWeatherClient>
