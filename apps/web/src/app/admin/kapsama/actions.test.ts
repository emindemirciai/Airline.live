import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startCoverageReportAction } from './actions'

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

function form(hours: string | null): FormData {
  const data = new FormData()
  if (hours !== null) data.set('hours', hours)
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
  fetchMock.mockResolvedValue(
    Response.json({ id: 7, status: 'queued', hours: 24 }, { status: 202 }),
  )
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('startCoverageReportAction', () => {
  it('izinli olmayan saat API’ye gitmez', async () => {
    for (const hours of [null, '', '0', '7', '169', '24.5', 'abc', ' 24']) {
      expect(await startCoverageReportAction(IDLE, form(hours)), String(hours)).toEqual({
        error: 'invalid_hours',
      })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('202: POST { hours } Bearer ile gider, yeni raporun sayfasına yönlenir', async () => {
    expect(await redirectOf(startCoverageReportAction(IDLE, form('168')))).toBe(
      '/admin/kapsama?rapor=7',
    )
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('http://api.internal:4000/v1/admin/arrival-coverage/reports')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"hours":168}')
    expect(init?.headers).toMatchObject({
      authorization: 'Bearer oturum-token',
      'content-type': 'application/json',
    })
  })

  it('API hataları formda gösterilir; oturum yoksa giriş sayfasına', async () => {
    const cases: [number, string][] = [
      [409, 'active'],
      [429, 'rate_limited'],
      [400, 'invalid_hours'],
      [503, 'unavailable'],
      [500, 'unavailable'],
    ]
    for (const [status, error] of cases) {
      fetchMock.mockResolvedValueOnce(Response.json({}, { status }))
      expect(await startCoverageReportAction(IDLE, form('24')), String(status)).toEqual({ error })
    }
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    expect(await startCoverageReportAction(IDLE, form('24'))).toEqual({ error: 'unavailable' })
    // 202 ama gövde bozuk.
    fetchMock.mockResolvedValueOnce(Response.json({ id: '7' }, { status: 202 }))
    expect(await startCoverageReportAction(IDLE, form('24'))).toEqual({ error: 'unavailable' })

    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 401 }))
    expect(await redirectOf(startCoverageReportAction(IDLE, form('24')))).toBe('/admin/giris')

    cookieValue.token = undefined
    fetchMock.mockClear()
    expect(await redirectOf(startCoverageReportAction(IDLE, form('24')))).toBe('/admin/giris')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
