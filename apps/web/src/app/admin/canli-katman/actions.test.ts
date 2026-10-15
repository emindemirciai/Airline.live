import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchLiveLayer } from '../../../lib/admin-api'
import { setLiveLayerAction } from './actions'

vi.mock('server-only', () => ({}))
const cookieValue = vi.hoisted(() => ({ token: 'oturum-token' as string | undefined }))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'hy_admin' && cookieValue.token !== undefined
        ? { name, value: cookieValue.token }
        : undefined,
  }),
  headers: async () => new Headers(),
}))
/** `redirect` Next'te denetim akışı hatası fırlatır; testte hedefi taşıyan hata. */
class RedirectSignal extends Error {
  constructor(readonly location: string) {
    super(`redirect ${location}`)
  }
}
vi.mock('next/navigation', () => ({
  redirect: (location: string) => {
    throw new RedirectSignal(location)
  },
}))

const fetchMock = vi.fn<typeof fetch>()
const IDLE = { error: null }

const layer = (enabled: boolean) => ({
  enabled,
  updatedAt: '2026-10-15T09:01:00.000Z',
  updatedBy: 'yonetici@example.com',
  actions: [
    {
      at: '2026-10-15T09:01:00.000Z',
      actor: 'yonetici@example.com',
      action: enabled ? 'on' : 'off',
      reason: null,
    },
  ],
})

function form(enabled: string | null, reason?: string): FormData {
  const data = new FormData()
  if (enabled !== null) data.set('enabled', enabled)
  if (reason !== undefined) data.set('reason', reason)
  return data
}

async function redirectOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof RedirectSignal) return error.location
    throw error
  }
  throw new Error('no redirect')
}

beforeEach(() => {
  cookieValue.token = 'oturum-token'
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(Response.json(layer(false)))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('setLiveLayerAction', () => {
  it('geçersiz alanlar API’ye gitmez', async () => {
    for (const data of [
      form(null),
      form(''),
      form('off'),
      form('1'),
      form('false', 'x'.repeat(501)),
    ]) {
      expect(await setLiveLayerAction(IDLE, data)).toEqual({ error: 'invalid' })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('kapatma: PUT { enabled: false, reason } Bearer ile gider, sonuç satırıyla sayfaya döner', async () => {
    expect(await redirectOf(setLiveLayerAction(IDLE, form('false', '  Karar 2026/123  ')))).toBe(
      '/admin/canli-katman?sonuc=kapatildi',
    )
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('http://api.internal:4000/v1/admin/live-layer')
    expect(init?.method).toBe('PUT')
    expect(init?.body).toBe('{"enabled":false,"reason":"Karar 2026/123"}')
    expect(init?.headers).toMatchObject({
      authorization: 'Bearer oturum-token',
      'content-type': 'application/json',
    })
  })

  it('açma: boş neden gövdeye girmez', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(layer(true)))
    expect(await redirectOf(setLiveLayerAction(IDLE, form('true', '   ')))).toBe(
      '/admin/canli-katman?sonuc=acildi',
    )
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe('{"enabled":true}')
  })

  it('API hataları formda gösterilir; oturum yoksa giriş sayfasına', async () => {
    const cases: [number, string][] = [
      [400, 'invalid'],
      [503, 'no_database'],
      [500, 'unavailable'],
    ]
    for (const [status, error] of cases) {
      fetchMock.mockResolvedValueOnce(Response.json({}, { status }))
      expect(await setLiveLayerAction(IDLE, form('false')), String(status)).toEqual({ error })
    }
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    expect(await setLiveLayerAction(IDLE, form('false'))).toEqual({ error: 'unavailable' })
    // 200 ama gövde bozuk.
    fetchMock.mockResolvedValueOnce(Response.json({ enabled: 'false' }))
    expect(await setLiveLayerAction(IDLE, form('false'))).toEqual({ error: 'unavailable' })

    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 401 }))
    expect(await redirectOf(setLiveLayerAction(IDLE, form('false')))).toBe('/admin/giris')

    cookieValue.token = undefined
    fetchMock.mockClear()
    expect(await redirectOf(setLiveLayerAction(IDLE, form('false')))).toBe('/admin/giris')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('fetchLiveLayer (sayfanın okuması)', () => {
  it('200 durum, 401 giriş, 503 veritabanı yok, diğerleri ulaşılamıyor', async () => {
    expect(await fetchLiveLayer('oturum-token', {})).toEqual({ ok: true, layer: layer(false) })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('http://api.internal:4000/v1/admin/live-layer')
    expect(init?.headers).toMatchObject({ authorization: 'Bearer oturum-token' })
    const cases: [number, string][] = [
      [401, 'unauthorized'],
      [503, 'no_database'],
      [400, 'unavailable'],
      [500, 'unavailable'],
    ]
    for (const [status, reason] of cases) {
      fetchMock.mockResolvedValueOnce(Response.json({}, { status }))
      expect(await fetchLiveLayer('oturum-token', {}), String(status)).toEqual({
        ok: false,
        reason,
      })
    }
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    expect(await fetchLiveLayer('oturum-token', {})).toEqual({ ok: false, reason: 'unavailable' })
  })
})
