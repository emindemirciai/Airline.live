/**
 * Tarayıcının API'ye doğrudan yaptığı REST istekleri (D-075 §3): canlı arama. Haritanın havalimanı
 * listesi (pist özetiyle) components/map/airport-data.ts'tedir. 2xx olmayan yanıt `ApiError`
 * fırlatır (429: hız sınırı); yanıtın biçimi döndürülmeden önce denetlenir, uygun olmayan kayıtlar
 * atlanır.
 */
import type { SearchResponse } from '@havayolu/shared'
import { isLiveStatus, isObject, isPublicAircraft, isSearchKind, validItems } from './validate'

export class ApiError extends Error {
  /** HTTP durum kodu; biçimi bozuk 2xx yanıtta o yanıtın kodu. */
  readonly status: number

  constructor(status: number, message = `API request failed with status ${status}`) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function getJson(url: URL, signal: AbortSignal | undefined): Promise<Response> {
  const response = await fetch(url, { signal, headers: { accept: 'application/json' } })
  if (!response.ok) throw new ApiError(response.status)
  return response
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    throw new ApiError(response.status, 'API response is not valid JSON')
  }
}

const invalidShape = (response: Response) =>
  new ApiError(response.status, 'API response has an unexpected shape')

/** `GET /v1/search?q=`: hex, tescil, sefer no ya da çağrı kodu (canlı önbellekte). */
export async function fetchSearch(
  apiBaseUrl: string,
  q: string,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const url = new URL('/v1/search', apiBaseUrl)
  url.searchParams.set('q', q.trim())
  const response = await getJson(url, signal)
  const body = await readBody(response)
  if (!isObject(body) || !isSearchKind(body.kind) || !isLiveStatus(body.status)) {
    throw invalidShape(response)
  }
  const results = validItems(body.results, isPublicAircraft)
  if (!results) throw invalidShape(response)
  return { kind: body.kind, results, status: body.status }
}
