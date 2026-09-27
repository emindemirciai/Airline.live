import { assertProvidersAllowed, PROVIDER_LICENSES, type DataUsageMode } from '../license'
import { BodyTooLargeError, headersAreValid, readTextCapped } from './http'
import { parseLiveResponse, ResponseFormatError, type ParsedResponse } from './response'

/**
 * Kendi readsb / tar1090 alıcılarımız (data-sources.md §2; opsiyonel, D-006). `LOCAL_RECEIVER_URLS`
 * virgülle ayrılmış `aircraft.json` adresleridir; her birine `|<token>` eklenebilir (Bearer
 * kimlik doğrulaması). Tanımlı değilse adaptör kapalıdır. Geliştirmede replay alıcısı bu yoldan
 * bağlanır. Alıcı başına sağlık metriği tutulur (admin paneli ve kesinti bastırma için).
 * Hata ve sağlık metinleri sabit bir sözlükten gelir: token ya da ham hata metni taşımaz.
 */

/** Token karakterleri (üretilen sırlar [A-Za-z0-9_-]; D-063). */
const TOKEN = /^[A-Za-z0-9._~+/=-]+$/
/** Açılmış yanıt üst sınırı. */
export const MAX_RECEIVER_RESPONSE_BYTES = 8 * 1024 * 1024

export interface ReceiverConfig {
  url: string
  token: string | null
}

export class ReceiverConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReceiverConfigError'
  }
}

/**
 * `url[|token],url[|token]` → alıcı listesi. Boş girdi boş liste döner (adaptör kapalı). Hata
 * iletileri girdiyi yazmaz, yalnızca kaçıncı alıcı olduğunu söyler (token sızmasın).
 */
export function parseReceiverUrls(value: string | undefined | null): ReceiverConfig[] {
  if (!value?.trim()) return []
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const label = `LOCAL_RECEIVER_URLS: ${index + 1}. alıcı`
      const [rawUrl = '', ...tokenParts] = part.split('|')
      const token = tokenParts.join('|').trim() || null
      if (token !== null && !TOKEN.test(token)) {
        throw new ReceiverConfigError(`${label}: token geçersiz karakter içeriyor`)
      }
      let url: URL
      try {
        url = new URL(rawUrl.trim())
      } catch {
        throw new ReceiverConfigError(`${label}: adres geçersiz`)
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new ReceiverConfigError(`${label}: yalnızca http(s) adresi`)
      }
      if (url.username || url.password) {
        throw new ReceiverConfigError(`${label}: kimlik bilgisi adrese değil |token olarak verilir`)
      }
      return { url: url.toString(), token }
    })
}

export interface ReceiverHealth {
  /** Kimlik bilgisi taşımayan adres (loglanabilir). */
  url: string
  lastSuccessAt: number | null
  lastErrorAt: number | null
  lastError: string | null
  consecutiveFailures: number
  lastLatencyMs: number | null
  lastAircraftCount: number | null
}

export interface ReceiverResult {
  url: string
  ok: boolean
  response: ParsedResponse | null
  error: string | null
}

export interface LocalReceiverOptions {
  receivers: ReceiverConfig[]
  dataUsageMode: DataUsageMode
  userAgent: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
  now?: () => number
}

class ReceiverError extends Error {}

/** Sabit hata sözlüğü: ham hata metni (başlık değeri, token) asla dışarı çıkmaz. */
function describe(error: unknown): string {
  if (error instanceof ReceiverError) return error.message
  if (error instanceof BodyTooLargeError) return 'yanıt çok büyük'
  if (error instanceof ResponseFormatError) return 'yanıt biçimi ya da saati hatalı'
  if (error instanceof SyntaxError) return 'yanıt JSON değil'
  if (error instanceof Error && error.name === 'TimeoutError') return 'zaman aşımı'
  return 'bağlantı hatası'
}

export function createLocalReceiverClient(options: LocalReceiverOptions) {
  assertProvidersAllowed(options.dataUsageMode, [PROVIDER_LICENSES.localReceiver])
  const doFetch = options.fetch ?? globalThis.fetch
  const now = options.now ?? (() => Date.now())
  const headersFor = (receiver: ReceiverConfig): Record<string, string> => ({
    'user-agent': options.userAgent,
    accept: 'application/json',
    'accept-encoding': 'gzip',
    ...(receiver.token ? { authorization: `Bearer ${receiver.token}` } : {}),
  })
  for (const [index, receiver] of options.receivers.entries()) {
    if (!headersAreValid(headersFor(receiver))) {
      throw new ReceiverConfigError(`LOCAL_RECEIVER_URLS: ${index + 1}. alıcı: başlık geçersiz`)
    }
  }
  const health = new Map<string, ReceiverHealth>(
    options.receivers.map((r) => [
      r.url,
      {
        url: r.url,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastError: null,
        consecutiveFailures: 0,
        lastLatencyMs: null,
        lastAircraftCount: null,
      },
    ]),
  )

  async function fetchOne(receiver: ReceiverConfig): Promise<ReceiverResult> {
    const record = health.get(receiver.url)
    const started = performance.now()
    try {
      const response = await doFetch(receiver.url, {
        headers: headersFor(receiver),
        // Yönlendirme izlenmez: token başka adrese taşınmasın.
        redirect: 'manual',
        signal: AbortSignal.timeout(options.timeoutMs ?? 5_000),
      })
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => undefined)
        throw new ReceiverError(`HTTP ${response.status}`)
      }
      const text = await readTextCapped(response, MAX_RECEIVER_RESPONSE_BYTES)
      const parsed = parseLiveResponse(JSON.parse(text), 'localReceiver', { receivedAt: now() })
      if (record) {
        record.lastSuccessAt = now()
        record.consecutiveFailures = 0
        record.lastLatencyMs = Math.round(performance.now() - started)
        record.lastAircraftCount = parsed.aircraft.length
      }
      return { url: receiver.url, ok: true, response: parsed, error: null }
    } catch (error) {
      const message = describe(error)
      if (record) {
        record.lastErrorAt = now()
        record.lastError = message
        record.consecutiveFailures += 1
      }
      return { url: receiver.url, ok: false, response: null, error: message }
    }
  }

  return {
    enabled: options.receivers.length > 0,
    /** Bütün alıcılar paralel okunur; biri hata verse de diğerlerinin sonucu döner. */
    fetchAll: () => Promise.all(options.receivers.map(fetchOne)),
    health: (): ReceiverHealth[] => [...health.values()].map((h) => ({ ...h })),
  }
}

export type LocalReceiverClient = ReturnType<typeof createLocalReceiverClient>
