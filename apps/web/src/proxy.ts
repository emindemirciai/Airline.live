import { NextResponse, type NextRequest } from 'next/server'
// Göreli yollar: vitest `@/` takma adını çözmez ve proxy testte doğrudan çağrılır.
import { adminRouting, canonicalHostRedirect, robotsTagFor } from './lib/admin-host'
import { LOCALE_HEADER, localeRouting, PATH_HEADER } from './lib/locale-routing'

/** Şemasız host (`havayolu.live`, `localhost:3100`, `[::1]:3100`); yönlendirme adresi için denetlenir. */
const HOST = /^(?:\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)(?::\d{1,5})?$/

/**
 * Yönlendirmenin mutlak adresi: Next.js proxy'si göreli `Location`'ı reddeder. `request.url` sunucunun
 * iç adresini (0.0.0.0:3000) taşıdığından host istekten (Traefik'in yazdığı X-Forwarded-Host ya da
 * Host), şema Next'in X-Forwarded-Proto'dan çözdüğü protokolden gelir.
 */
function absoluteUrl(request: NextRequest, host: string | null, pathAndQuery: string): URL {
  const trimmed = host?.trim() ?? ''
  const origin = HOST.test(trimmed)
    ? `${request.nextUrl.protocol}//${trimmed}`
    : request.nextUrl.origin
  return new URL(pathAndQuery, origin)
}

/** Dil ve mantıksal yol başlıkları; istemcinin gönderdiği değerler her zaman ezilir. */
function forwardedHeaders(request: NextRequest, locale: string, pathAndQuery: string): Headers {
  const headers = new Headers(request.headers)
  headers.set(LOCALE_HEADER, locale)
  headers.set(PATH_HEADER, pathAndQuery)
  return headers
}

function route(request: NextRequest, host: string | null): NextResponse {
  const { pathname, search } = request.nextUrl
  const decision = adminRouting(process.env.ADMIN_HOST, host, pathname)
  if (decision.action === 'redirect') {
    return new NextResponse(null, { status: 307, headers: { Location: decision.location } })
  }
  if (decision.action === 'not_found') return new NextResponse(null, { status: 404 })

  const locale = localeRouting(pathname)
  switch (locale.kind) {
    case 'redirect':
      return NextResponse.redirect(absoluteUrl(request, host, `${locale.to}${search}`), 308)
    case 'not_found':
      return new NextResponse(null, { status: 404 })
    case 'rewrite':
      return NextResponse.rewrite(new URL(`${locale.path}${search}`, request.url), {
        request: { headers: forwardedHeaders(request, locale.locale, `${locale.path}${search}`) },
      })
    case 'next':
      return NextResponse.next({
        request: { headers: forwardedHeaders(request, locale.locale, `${locale.path}${search}`) },
      })
  }
}

/**
 * Sırasıyla: www → kök alan adı (308), admin alan adı ayrımı (lib/admin-host.ts), dil yönlendirmesi
 * (lib/locale-routing.ts: `/en/*` yeniden yazılır, `/tr/*` köke 308) ve `X-Robots-Tag` (admin
 * host'unda her yanıt, web host'unda `/api/*`). Node.js çalışma zamanı.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const canonical = canonicalHostRedirect(
    process.env.WEB_HOST,
    host,
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  )
  if (canonical) return new NextResponse(null, { status: 308, headers: { Location: canonical } })
  const response = route(request, host)
  const robots = robotsTagFor(process.env.ADMIN_HOST, host, request.nextUrl.pathname)
  if (robots) response.headers.set('X-Robots-Tag', robots)
  return response
}

/**
 * Proxy'nin çalışmadığı yollar: yalnızca Next'in derlenmiş varlıkları (`/_next/static`,
 * `/_next/image`). Kök dosyalar (robots.txt, site haritası, llms.txt, manifest, ikonlar, paylaşım
 * görseli) proxy'den geçer: www → kök alan adı yönlendirmesi ve admin host'unun `X-Robots-Tag`'i
 * onlara da uygulanır. Dil kararı onları olduğu gibi geçirir; `/en/` + kök dosya 404 alır.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
