/**
 * Admin alan adı yönlendirme kararı (proxy.ts kullanır; saf fonksiyon, test edilebilir).
 * - ADMIN_HOST tanımlı değilse (yerel geliştirme) hiçbir şey yapılmaz; /admin aynı host'ta açılır.
 * - ADMIN_HOST'tan gelen /admin dışı istekler https://<ADMIN_HOST>/admin'e yönlenir. Hariç olanlar:
 *   API, Next varlıkları, eski dil uç noktası /dil, /robots.txt (admin host'unda tüm siteyi kapatır)
 *   ve admin sayfalarının kullandığı uygulama simgeleri ile manifest. Site haritası, llms.txt ve
 *   paylaşım görseli web sitesinindir; admin host'unda onlar da yönlenir. Adres mutlaktır: Next.js
 *   proxy'si göreli `Location` ile yanıtı reddeder ve 500 döner (üretimde admin kök adresinde görüldü).
 * - Başka host'tan /admin istekleri 404 alır: yönetim yalnızca kendi alan adında açılır.
 * - Admin host'undaki her yanıt `X-Robots-Tag: noindex, nofollow` taşır (`robotsTagFor`).
 */
export type AdminRouting =
  { action: 'next' } | { action: 'redirect'; location: string } | { action: 'not_found' }

export function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

/** İstek admin alan adına mı geldi (ADMIN_HOST tanımlı değilse hiçbir istek gelmez). */
export function isAdminHost(adminHost: string | undefined, requestHost: string | null): boolean {
  const configured = adminHost?.trim().toLowerCase()
  if (!configured) return false
  return (requestHost ?? '').trim().toLowerCase() === configured
}

/** Admin sayfalarının `<head>`'inde bağlanan simgeler ve manifest (app/icon.tsx, apple-icon.tsx, manifest.ts). */
function isAppAsset(pathname: string): boolean {
  return (
    pathname === '/favicon.ico' ||
    pathname === '/apple-icon' ||
    pathname === '/manifest.webmanifest' ||
    pathname.startsWith('/icon/')
  )
}

export function adminRouting(
  adminHost: string | undefined,
  requestHost: string | null,
  pathname: string,
): AdminRouting {
  const configured = adminHost?.trim().toLowerCase()
  if (!configured) return { action: 'next' }
  if (isAdminHost(configured, requestHost)) {
    if (
      isAdminPath(pathname) ||
      pathname === '/dil' ||
      pathname === '/robots.txt' ||
      isAppAsset(pathname) ||
      pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/')
    ) {
      return { action: 'next' }
    }
    return { action: 'redirect', location: `https://${configured}/admin` }
  }
  return isAdminPath(pathname) ? { action: 'not_found' } : { action: 'next' }
}

/**
 * Yanıta eklenecek `X-Robots-Tag` değeri; gerekmiyorsa null.
 * - Admin host'undaki her yanıt: `noindex, nofollow` (sayfalar ayrıca admin layout'unun meta etiketini
 *   taşır; robots.txt orada `Disallow: /` der).
 * - Web host'unda `/api/*`: `noindex` (JSON uç noktaları arama sonucuna girmez). `/dil` başlığını
 *   kendisi ekler.
 */
export function robotsTagFor(
  adminHost: string | undefined,
  requestHost: string | null,
  pathname: string,
): string | null {
  if (isAdminHost(adminHost, requestHost)) return 'noindex, nofollow'
  if (pathname === '/api' || pathname.startsWith('/api/')) return 'noindex'
  return null
}

/**
 * Kanonik alan adı: `www.<WEB_HOST>` istekleri kalıcı yönlendirmeyle (308) `https://<WEB_HOST>`
 * adresine gider; yol ve sorgu korunur. WEB_HOST tanımlı değilse (yerel) hiçbir şey yapılmaz.
 */
export function canonicalHostRedirect(
  webHost: string | undefined,
  requestHost: string | null,
  pathAndQuery: string,
): string | null {
  const canonical = webHost?.trim().toLowerCase()
  const host = (requestHost ?? '').trim().toLowerCase()
  if (!canonical || host !== `www.${canonical}`) return null
  return `https://${canonical}${pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`}`
}
