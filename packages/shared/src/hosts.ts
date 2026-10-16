/**
 * Host adları (D-112): genel host biçimi, eski alan adlarının listesi ve onlardan yeni host'a kalıcı
 * yönlendirme kararı. Saf modüldür (IO ve Node API'si yok); web'in proxy'si, web ve API env
 * doğrulaması ve API'nin `onRequest` kancası aynı kuralları kullanır. Alan adı koda gömülmez:
 * eski ve yeni host'lar env'den gelir (`LEGACY_WEB_HOSTS`, `LEGACY_ADMIN_HOSTS`, `LEGACY_API_HOSTS`).
 */
import { isEnvPlaceholder } from './env'

/** Şemasız genel host: `airline.live`, `api.airline.live`, `localhost:4100`, `[::1]:4100`. */
export const PUBLIC_HOST =
  /^(?:\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)(?::\d{1,5})?$/

/** Host'un adı ve (varsa) portu: `[::1]:3100` → `[::1]` + `3100`, `airline.live` → port yok. */
function splitHostPort(host: string): { name: string; port: string | null } {
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    if (end === -1) return { name: host, port: null }
    const rest = host.slice(end + 1)
    return { name: host.slice(0, end + 1), port: rest.startsWith(':') ? rest.slice(1) : null }
  }
  const colon = host.lastIndexOf(':')
  return colon === -1
    ? { name: host, port: null }
    : { name: host.slice(0, colon), port: host.slice(colon + 1) }
}

/**
 * Karşılaştırma biçimi: boşluksuz, küçük harf, addaki sondaki nokta atılır (`Airline.Live.:443` →
 * `airline.live:443`). Boş ya da tanımsız değer boş metin olur.
 */
export function normalizeHost(host: string | null | undefined): string {
  const trimmed = (host ?? '').trim().toLowerCase()
  if (!trimmed) return ''
  const { name, port } = splitHostPort(trimmed)
  const bare = name.replace(/\.+$/, '')
  return port === null ? bare : `${bare}:${port}`
}

/**
 * Eski alan adı olarak yazılabilecek host: en az iki parçalı bir alan adı (`old.example`,
 * `www.old.example`), isteğe bağlı portla. IP adresi ve tek parçalı ad (`localhost`, `hy-api`)
 * olamaz: iç trafik (web → `http://hy-api:4000`, konteyner sağlık denetimi `127.0.0.1`) hiçbir zaman
 * yönlendirilmez.
 */
export function isLegacyHostEntry(entry: string): boolean {
  const host = normalizeHost(entry)
  if (!PUBLIC_HOST.test(host) || host.startsWith('[')) return false
  const { name } = splitHostPort(host)
  const labels = name.split('.')
  if (labels.length < 2 || labels.some((label) => label === '')) return false
  return /[a-z]/.test(labels[labels.length - 1] ?? '')
}

/**
 * Virgülle ayrılmış host listesi → karşılaştırma biçiminde, tekil liste (doğrulanmamış). Şablondaki
 * `#…#` talimatı ve tanımsız değer boş listedir (D-063).
 */
export function splitHostList(value: unknown): string[] {
  if (typeof value !== 'string' || isEnvPlaceholder(value)) return []
  const hosts = value
    .split(',')
    .map((part) => normalizeHost(part))
    .filter(Boolean)
  return [...new Set(hosts)]
}

/** Hoşgörülü okuma (proxy hiç hata atmaz): geçersiz girdiler atlanır, sıkı doğrulama env şemasındadır. */
export function parseLegacyHosts(value: unknown): string[] {
  return splitHostList(value).filter(isLegacyHostEntry)
}

/**
 * Listedeki host istek host'unu kapsıyor mu. Portsuz girdi her portu kapsar (`old.example`,
 * `old.example:443` isteğini de); portlu girdi yalnızca aynı portu.
 */
export function hostMatches(entry: string, requestHost: string | null | undefined): boolean {
  const wanted = normalizeHost(entry)
  const actual = normalizeHost(requestHost)
  if (!wanted || !actual) return false
  if (wanted === actual) return true
  const want = splitHostPort(wanted)
  return want.port === null && splitHostPort(actual).name === want.name
}

/** Host'un kökü: yerel adlarda (`localhost`, `127.0.0.1`, `[::1]`) http, diğerlerinde https. */
export function hostOrigin(host: string): string {
  const normalized = normalizeHost(host)
  const { name } = splitHostPort(normalized)
  const local = name === 'localhost' || name === '127.0.0.1' || name === '[::1]'
  return `${local ? 'http' : 'https'}://${normalized}`
}

export interface LegacyRedirectInput {
  /** Eski host'lar (`parseLegacyHosts` ya da doğrulanmış env listesi). */
  legacyHosts: readonly string[]
  /** Yeni host (şemasız; env'den). Tanımsız ya da geçersizse yönlendirme yapılmaz. */
  target: string | null | undefined
  /** İsteğin host'u (`X-Forwarded-Host` ya da `Host`). */
  requestHost: string | null | undefined
  /** İsteğin yolu ve sorgu metni (`/en/havalimanlari?x=1`). */
  pathAndQuery: string
}

/**
 * Eski host'a gelen isteğin kalıcı yönlendirme adresi (308; yol ve sorgu korunur), yoksa null.
 * Adres her zaman env'deki yeni host'tan kurulur, istekteki host'tan değil: sahte `X-Forwarded-Host`
 * ile site dışına yönlendirilemez. İstek zaten yeni host'a geldiyse (hatalı liste) null döner, döngü
 * olmaz. Origin-form olmayan istek hedefi (`GET http://…`) köke gider.
 */
export function legacyRedirectLocation({
  legacyHosts,
  target,
  requestHost,
  pathAndQuery,
}: LegacyRedirectInput): string | null {
  if (legacyHosts.length === 0) return null
  const destination = normalizeHost(target)
  if (!destination || isEnvPlaceholder(target) || !PUBLIC_HOST.test(destination)) return null
  if (!legacyHosts.some((entry) => hostMatches(entry, requestHost))) return null
  if (hostMatches(destination, requestHost)) return null
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : '/'
  return `${hostOrigin(destination)}${path}`
}
