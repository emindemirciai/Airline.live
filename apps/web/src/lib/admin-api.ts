import 'server-only'
import type { ArrivalCoverageHours, ServicesReport } from '@havayolu/shared'
import {
  COVERAGE_API_PATH,
  CoverageDetailSchema,
  CoverageListSchema,
  coverageApiPath,
  coverageAttachmentName,
  type CoverageDetail,
  type CoverageList,
} from './arrival-coverage'
import { getServerEnv } from './env'
import { LIVE_LAYER_API_PATH, LiveLayerSchema, type LiveLayerState } from './live-layer'

/** Yönetici oturum token'ının tutulduğu çerez (httpOnly; yalnızca /admin altında gönderilir). */
export const ADMIN_COOKIE = 'hy_admin'
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

export type LoginFailure = 'invalid' | 'rate_limited' | 'disabled' | 'unavailable'

const TIMEOUT_MS = 5_000

function apiUrl(path: string): string {
  return new URL(path, getServerEnv().API_INTERNAL_URL).toString()
}

/** İstemci başlıkları: `clientForwardHeaders()` (lib/forwarded.ts); hız sınırı istemci başına tutulur. */
type ForwardHeaders = Record<string, string>

/** API'nin platform-admin sözleşmesiyle giriş yapar (analiz uygulamasıyla aynı uç nokta). */
export async function loginToApi(
  email: string,
  password: string,
  forwarded: ForwardHeaders,
): Promise<{ ok: true; token: string } | { ok: false; reason: LoginFailure }> {
  let response: Response
  try {
    response = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { ...forwarded, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  if (response.status === 429) return { ok: false, reason: 'rate_limited' }
  if (response.status === 404) return { ok: false, reason: 'disabled' }
  if (!response.ok) return { ok: false, reason: response.status >= 500 ? 'unavailable' : 'invalid' }
  const body = (await response.json().catch(() => ({}))) as { token?: unknown }
  return typeof body.token === 'string' && body.token
    ? { ok: true, token: body.token }
    : { ok: false, reason: 'unavailable' }
}

export async function fetchServices(
  token: string,
  forwarded: ForwardHeaders,
): Promise<
  { ok: true; report: ServicesReport } | { ok: false; reason: 'unauthorized' | 'unavailable' }
> {
  try {
    const response = await fetch(apiUrl('/v1/admin/services'), {
      headers: { ...forwarded, authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (response.status === 401) return { ok: false, reason: 'unauthorized' }
    if (!response.ok) return { ok: false, reason: 'unavailable' }
    return { ok: true, report: (await response.json()) as ServicesReport }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

export async function logoutFromApi(token: string, forwarded: ForwardHeaders): Promise<void> {
  try {
    await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: { ...forwarded, authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    // API'ye ulaşılamasa da yerel çerez silinir; token 7 gün sonra kendiliğinden düşer.
  }
}

// ---------------------------------------------------------------------------------------------
// Kapsama raporu (Parça 1 M7b.2, D-098): `/v1/admin/arrival-coverage/reports`

type CoverageFailure = 'unauthorized' | 'unavailable'

async function coverageGet(
  path: string,
  token: string,
  forwarded: ForwardHeaders,
): Promise<Response | null> {
  try {
    return await fetch(apiUrl(path), {
      headers: { ...forwarded, authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return null
  }
}

/** Raporlar (Markdown olmadan), etkin raporun kimliği ve istasyonların 7 günlük kapsaması. */
export async function fetchCoverageReports(
  token: string,
  forwarded: ForwardHeaders,
): Promise<{ ok: true; list: CoverageList } | { ok: false; reason: CoverageFailure }> {
  const response = await coverageGet(COVERAGE_API_PATH, token, forwarded)
  if (response?.status === 401) return { ok: false, reason: 'unauthorized' }
  if (!response?.ok) return { ok: false, reason: 'unavailable' }
  const parsed = CoverageListSchema.safeParse(await response.json().catch(() => null))
  return parsed.success ? { ok: true, list: parsed.data } : { ok: false, reason: 'unavailable' }
}

/** Tek rapor, sonucu ve Markdown metniyle. `id` denetlenmiş kimliktir (`parseCoverageReportId`). */
export async function fetchCoverageReport(
  token: string,
  id: string,
  forwarded: ForwardHeaders,
): Promise<
  { ok: true; report: CoverageDetail } | { ok: false; reason: CoverageFailure | 'not_found' }
> {
  const response = await coverageGet(coverageApiPath(id), token, forwarded)
  if (response?.status === 401) return { ok: false, reason: 'unauthorized' }
  if (response?.status === 404 || response?.status === 400) {
    return { ok: false, reason: 'not_found' }
  }
  if (!response?.ok) return { ok: false, reason: 'unavailable' }
  const parsed = CoverageDetailSchema.safeParse(await response.json().catch(() => null))
  return parsed.success ? { ok: true, report: parsed.data } : { ok: false, reason: 'unavailable' }
}

export type CoverageRequestFailure =
  'unauthorized' | 'invalid_hours' | 'active' | 'rate_limited' | 'unavailable'

/** Yeni rapor ister (API 202 → kimlik; etkin rapor varsa 409 → `active`). */
export async function requestCoverageReport(
  token: string,
  hours: ArrivalCoverageHours,
  forwarded: ForwardHeaders,
): Promise<{ ok: true; id: number } | { ok: false; reason: CoverageRequestFailure }> {
  let response: Response
  try {
    response = await fetch(apiUrl(COVERAGE_API_PATH), {
      method: 'POST',
      headers: {
        ...forwarded,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ hours }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  if (response.status === 401) return { ok: false, reason: 'unauthorized' }
  if (response.status === 400) return { ok: false, reason: 'invalid_hours' }
  if (response.status === 409) return { ok: false, reason: 'active' }
  if (response.status === 429) return { ok: false, reason: 'rate_limited' }
  if (response.status !== 202) return { ok: false, reason: 'unavailable' }
  const body = (await response.json().catch(() => null)) as { id?: unknown } | null
  return typeof body?.id === 'number' && Number.isSafeInteger(body.id) && body.id > 0
    ? { ok: true, id: body.id }
    : { ok: false, reason: 'unavailable' }
}

export type CoverageMarkdownFailure = CoverageFailure | 'not_found' | 'not_ready'

/**
 * Raporun Markdown metni ve dosya adı (API'nin `Content-Disposition` başlığından; ad
 * `kapsama-<YYYYMMDD>T<HHmm>Z.md` biçiminde değilse `unavailable`).
 */
export async function fetchCoverageMarkdown(
  token: string,
  id: string,
  forwarded: ForwardHeaders,
): Promise<
  { ok: true; markdown: string; fileName: string } | { ok: false; reason: CoverageMarkdownFailure }
> {
  const response = await coverageGet(coverageApiPath(id, 'markdown'), token, forwarded)
  if (response?.status === 401) return { ok: false, reason: 'unauthorized' }
  if (response?.status === 404 || response?.status === 400) {
    return { ok: false, reason: 'not_found' }
  }
  if (response?.status === 409) return { ok: false, reason: 'not_ready' }
  if (!response?.ok) return { ok: false, reason: 'unavailable' }
  const fileName = coverageAttachmentName(response.headers.get('content-disposition'))
  const type = response.headers.get('content-type') ?? ''
  if (fileName === null || !type.toLowerCase().startsWith('text/markdown')) {
    return { ok: false, reason: 'unavailable' }
  }
  try {
    return { ok: true, markdown: await response.text(), fileName }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

// ---------------------------------------------------------------------------------------------
// Canlı katman anahtarı (Parça 1 M7d.1, D-115): `/v1/admin/live-layer`

/** `no_database`: API'de veritabanı bağlı değil (503); anahtar kullanılamaz. */
export type LiveLayerFailure = 'unauthorized' | 'no_database' | 'unavailable'

async function liveLayerResult(
  response: Response | null,
): Promise<
  { ok: true; layer: LiveLayerState } | { ok: false; reason: LiveLayerFailure | 'invalid' }
> {
  if (response === null) return { ok: false, reason: 'unavailable' }
  if (response.status === 401) return { ok: false, reason: 'unauthorized' }
  if (response.status === 400) return { ok: false, reason: 'invalid' }
  if (response.status === 503) return { ok: false, reason: 'no_database' }
  if (!response.ok) return { ok: false, reason: 'unavailable' }
  const parsed = LiveLayerSchema.safeParse(await response.json().catch(() => null))
  return parsed.success ? { ok: true, layer: parsed.data } : { ok: false, reason: 'unavailable' }
}

/** Anahtarın durumu, son değişikliği ve son 20 işlem. */
export async function fetchLiveLayer(
  token: string,
  forwarded: ForwardHeaders,
): Promise<{ ok: true; layer: LiveLayerState } | { ok: false; reason: LiveLayerFailure }> {
  let response: Response | null
  try {
    response = await fetch(apiUrl(LIVE_LAYER_API_PATH), {
      headers: { ...forwarded, authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    response = null
  }
  const result = await liveLayerResult(response)
  if (result.ok) return result
  // GET 400 dönmez; dönerse beklenmeyen yanıttır.
  return { ok: false, reason: result.reason === 'invalid' ? 'unavailable' : result.reason }
}

/** Katmanı açar ya da kapatır; `reason` temizlenmiş olmalı (`parseLiveLayerReason`). */
export async function setLiveLayer(
  token: string,
  forwarded: ForwardHeaders,
  body: { enabled: boolean; reason: string | null },
): Promise<
  { ok: true; layer: LiveLayerState } | { ok: false; reason: LiveLayerFailure | 'invalid' }
> {
  let response: Response | null
  try {
    response = await fetch(apiUrl(LIVE_LAYER_API_PATH), {
      method: 'PUT',
      headers: {
        ...forwarded,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(
        body.reason === null
          ? { enabled: body.enabled }
          : { enabled: body.enabled, reason: body.reason },
      ),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    response = null
  }
  return liveLayerResult(response)
}
