/**
 * Eski alan adlarından kalıcı yönlendirme (D-112; proxy.ts kullanır, saf fonksiyon). Proxy'nin ilk
 * adımıdır: www → kök ve admin alan adı ayrımından önce çalışır, böylece eski admin host'u da 404
 * almadan yeni admin host'una gider.
 * - `LEGACY_WEB_HOSTS` (ör. eski kök ve eski www) → `https://<WEB_HOST>` + aynı yol ve sorgu; eski
 *   www tek adımda yeni köke gider.
 * - `LEGACY_ADMIN_HOSTS` → `https://<ADMIN_HOST>` + aynı yol ve sorgu; yeni admin host'u /admin dışı
 *   yolları bugünkü gibi /admin'e yönlendirir.
 * Env `process.env`'den ham okunur ve hiçbir zaman hata atılmaz: geçersiz girdi, `#…#` talimatı ve
 * yeni host'ları kapsayan girdi atlanır (sıkı doğrulama `getServerEnv`'dedir). Liste boşsa ya da
 * hedef tanımsızsa hiçbir şey yapılmaz.
 */
import {
  hostMatches,
  legacyRedirectLocation,
  normalizeHost,
  parseLegacyHosts,
} from '@havayolu/shared/hosts'

/** Okunan anahtarlar: WEB_HOST, ADMIN_HOST, API_HOST, LEGACY_WEB_HOSTS, LEGACY_ADMIN_HOSTS. */
export type LegacyHostEnv = Readonly<Record<string, string | undefined>>

export function legacyHostRedirect(
  env: LegacyHostEnv,
  requestHost: string | null,
  pathAndQuery: string,
): string | null {
  const webHost = normalizeHost(env.WEB_HOST)
  const current = [webHost, webHost ? `www.${webHost}` : '', env.ADMIN_HOST, env.API_HOST]
    .map((host) => normalizeHost(host))
    .filter(Boolean)
  const usable = (value: string | undefined) =>
    parseLegacyHosts(value).filter((entry) => !current.some((host) => hostMatches(entry, host)))
  return (
    legacyRedirectLocation({
      legacyHosts: usable(env.LEGACY_ADMIN_HOSTS),
      target: env.ADMIN_HOST,
      requestHost,
      pathAndQuery,
    }) ??
    legacyRedirectLocation({
      legacyHosts: usable(env.LEGACY_WEB_HOSTS),
      target: env.WEB_HOST,
      requestHost,
      pathAndQuery,
    })
  )
}
