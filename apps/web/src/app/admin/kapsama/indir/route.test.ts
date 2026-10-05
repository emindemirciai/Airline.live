import { getMessages } from '@havayolu/i18n'
import type * as NextServer from 'next/server'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COVERAGE_MARKDOWN_FIXTURE } from '../../../../lib/test/coverage-fixture'
import { GET } from './route'

vi.mock('server-only', () => ({}))
const connection = vi.hoisted(() => vi.fn(async () => undefined))
const cookieValue = vi.hoisted(() => ({ token: 'oturum-token' as string | undefined }))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof NextServer>()),
  connection,
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'hy_admin' && cookieValue.token !== undefined
        ? { name, value: cookieValue.token }
        : undefined,
  }),
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}))

const t = getMessages('tr').admin.coverage.download
const fetchMock = vi.fn<typeof fetch>()

function markdownResponse(name = 'kapsama-20261006T0915Z.md', body = COVERAGE_MARKDOWN_FIXTURE) {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
    },
  })
}

const download = (query: string) =>
  GET(new NextRequest(`http://0.0.0.0:3100/admin/kapsama/indir${query}`))

beforeEach(() => {
  cookieValue.token = 'oturum-token'
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(markdownResponse())
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('GET /admin/kapsama/indir', () => {
  it('Markdown eki: ad kapsama-<YYYYMMDD>T<HHmm>Z.md, no-store, nosniff; API’ye Bearer ile gider', async () => {
    const response = await download('?rapor=42')
    expect(connection).toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="kapsama-20261006T0915Z.md"',
    )
    expect(response.headers.get('content-disposition')?.slice('attachment'.length)).not.toContain(
      ':',
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await response.text()).toBe(COVERAGE_MARKDOWN_FIXTURE)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe(
      'http://api.internal:4000/v1/admin/arrival-coverage/reports/42/markdown',
    )
    expect(init?.headers).toMatchObject({
      authorization: 'Bearer oturum-token',
      'x-forwarded-for': '203.0.113.7',
    })
    expect(init?.cache).toBe('no-store')
  })

  it('18 haneli kimlik olduğu gibi (metin) API yoluna girer', async () => {
    await download('?rapor=999999999999999999')
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'http://api.internal:4000/v1/admin/arrival-coverage/reports/999999999999999999/markdown',
    )
  })

  it('biçim dışı rapor kimliği 400; API çağrılmaz', async () => {
    for (const query of [
      '',
      '?rapor=',
      '?rapor=0',
      '?rapor=01',
      '?rapor=-1',
      '?rapor=1.5',
      '?rapor=abc',
      '?rapor=1e3',
      '?rapor=1999999999999999999',
      `?rapor=${encodeURIComponent('1/../../services')}`,
      `?rapor=${encodeURIComponent('1?x=1')}`,
      '?rapor=%2e%2e',
    ]) {
      const response = await download(query)
      expect(response.status, query).toBe(400)
      expect(await response.text()).toBe(`${t.badId}\n`)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('çerez yoksa ya da API oturumu reddederse giriş sayfasına 303', async () => {
    cookieValue.token = undefined
    const anonymous = await download('?rapor=42')
    expect(anonymous.status).toBe(303)
    expect(anonymous.headers.get('location')).toBe('/admin/giris')
    expect(fetchMock).not.toHaveBeenCalled()

    cookieValue.token = 'eski-token'
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }))
    const expired = await download('?rapor=42')
    expect(expired.status).toBe(303)
    expect(expired.headers.get('location')).toBe('/admin/giris')
  })

  it('API yanıtları: 404 → 404, 409 → 409, 5xx ve ağ hatası → 502', async () => {
    const cases: [() => Promise<Response>, number, string][] = [
      [async () => new Response('{}', { status: 404 }), 404, t.notFound],
      [async () => new Response('{}', { status: 409 }), 409, t.notReady],
      [async () => new Response('{}', { status: 503 }), 502, t.unavailable],
      [
        async () => {
          throw new TypeError('fetch failed')
        },
        502,
        t.unavailable,
      ],
    ]
    for (const [reply, status, message] of cases) {
      fetchMock.mockImplementationOnce(reply)
      const response = await download('?rapor=42')
      expect(response.status).toBe(status)
      expect(await response.text()).toBe(`${message}\n`)
      expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
      expect(response.headers.get('content-disposition')).toBeNull()
    }
  })

  it('API’nin ek adı biçim dışıysa ya da içerik Markdown değilse aktarılmaz (502)', async () => {
    for (const reply of [
      markdownResponse('../../kapsama.md'),
      markdownResponse('kapsama-2026-10-06T09:15Z.md'),
      markdownResponse('kapsama-20261006T0915Z.html'),
      new Response('<script>alert(1)</script>', {
        status: 200,
        headers: {
          'content-type': 'text/html',
          'content-disposition': 'attachment; filename="kapsama-20261006T0915Z.md"',
        },
      }),
      new Response('x', { status: 200, headers: { 'content-type': 'text/markdown' } }),
    ]) {
      fetchMock.mockResolvedValueOnce(reply)
      const response = await download('?rapor=42')
      expect(response.status).toBe(502)
      expect(response.headers.get('content-disposition')).toBeNull()
    }
  })
})
