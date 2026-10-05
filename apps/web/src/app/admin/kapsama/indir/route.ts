import { getMessages } from '@havayolu/i18n'
import { cookies } from 'next/headers'
import { connection, type NextRequest } from 'next/server'
// Göreli yollar: vitest `@/` takma adını çözmez; bu rota testte doğrudan çağrılır.
import { ADMIN_COOKIE, fetchCoverageMarkdown } from '../../../../lib/admin-api'
import { parseCoverageReportId } from '../../../../lib/arrival-coverage'
import { clientForwardHeaders } from '../../../../lib/forwarded'

/** Yanıtlar önbelleğe alınmaz ve tarayıcı içerik türünü tahmin etmez. */
const COMMON_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const

function plain(status: number, message: string): Response {
  return new Response(`${message}\n`, {
    status,
    headers: { ...COMMON_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

/**
 * Kapsama raporunun Markdown eki: `/admin/kapsama/indir?rapor=<id>` (Parça 1 M7b.2, D-098).
 * - `rapor` 1 ile başlayan en çok 18 hane olmalı; değilse 400. API yolu `encodeURIComponent` ile
 *   kurulur.
 * - Yönetici çerezi (`hy_admin`, yolu `/admin`) yoksa ya da API oturumu reddederse giriş sayfasına
 *   303.
 * - API'ye token Bearer başlığıyla gider; ek adı API'nin verdiği `kapsama-<YYYYMMDD>T<HHmm>Z.md`'dir
 *   ve biçimi denetlenir. Rapor yoksa 404, hazır değilse 409, API yanıt vermezse 502.
 * - Yanıt `no-store` ve `nosniff` taşır; admin host'unda proxy ayrıca `X-Robots-Tag` ekler.
 */
export async function GET(request: NextRequest): Promise<Response> {
  await connection()
  const t = getMessages('tr').admin.coverage.download
  const id = parseCoverageReportId(request.nextUrl.searchParams.get('rapor'))
  if (id === null) return plain(400, t.badId)

  const toLogin = new Response(null, {
    status: 303,
    headers: { ...COMMON_HEADERS, Location: '/admin/giris' },
  })
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!token) return toLogin

  const result = await fetchCoverageMarkdown(token, id, await clientForwardHeaders())
  if (result.ok) {
    return new Response(result.markdown, {
      status: 200,
      headers: {
        ...COMMON_HEADERS,
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
      },
    })
  }
  switch (result.reason) {
    case 'unauthorized':
      return toLogin
    case 'not_found':
      return plain(404, t.notFound)
    case 'not_ready':
      return plain(409, t.notReady)
    case 'unavailable':
      return plain(502, t.unavailable)
  }
}
