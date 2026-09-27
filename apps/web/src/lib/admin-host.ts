/**
 * Admin alan adı yönlendirme kararı (proxy.ts kullanır; saf fonksiyon, test edilebilir).
 * - ADMIN_HOST tanımlı değilse (yerel geliştirme) hiçbir şey yapılmaz; /admin aynı host'ta açılır.
 * - ADMIN_HOST'tan gelen /admin dışı sayfa istekleri https://<ADMIN_HOST>/admin'e yönlenir (API, Next
 *   varlıkları ve dil değiştirme yolu /dil hariç). Adres mutlaktır: Next.js proxy'si göreli
 *   `Location` ile yanıtı reddeder ve 500 döner (üretimde admin kök adresinde görüldü).
 * - Başka host'tan /admin istekleri 404 alır: yönetim yalnızca kendi alan adında açılır.
 */
export type AdminRouting =
  { action: 'next' } | { action: 'redirect'; location: string } | { action: 'not_found' }

export function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export function adminRouting(
  adminHost: string | undefined,
  requestHost: string | null,
  pathname: string,
): AdminRouting {
  const configured = adminHost?.trim().toLowerCase()
  if (!configured) return { action: 'next' }
  const host = (requestHost ?? '').trim().toLowerCase()
  const onAdminHost = host === configured
  if (onAdminHost) {
    if (
      isAdminPath(pathname) ||
      pathname === '/dil' ||
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
