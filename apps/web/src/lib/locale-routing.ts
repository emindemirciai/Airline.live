/**
 * Dil adreste taşınır (D-076, seçenek A): Türkçe kök yoldadır (`/durum`), İngilizce `/en` önekiyle
 * (`/en/durum`). Klasör yapısında `[lang]` bölümü yoktur; proxy `/en/*` isteğini öneksiz yola yeniden
 * yazar ve dili ile mantıksal yolu istek başlıklarıyla sayfaya iletir. Bu modül saftır (Next.js ve
 * IO yok): proxy.ts, sunucu bileşenleri ve dil değiştirme bağlantısı aynı kuralları kullanır.
 */
import type { Locale } from '@havayolu/shared'

/** Proxy'nin sayfaya ilettiği dil (`tr` | `en`). İstemcinin gönderdiği değer her zaman ezilir. */
export const LOCALE_HEADER = 'x-hy-locale'

/** Mantıksal yol ve sorgu metni, `/en` öneki olmadan (`/istasyon/LTFM?x=1`). Her zaman ezilir. */
export const PATH_HEADER = 'x-hy-path'

/** İngilizce sürümün yol öneki. Türkçe varsayılandır ve öneksizdir (`/tr/*` köke yönlenir). */
const PREFIX: Readonly<Record<Locale, string>> = { tr: '', en: '/en' }

/**
 * `/en` altında ikizi olmayan ilk yol bölümleri: yönetim (yalnızca Türkçe), API, eski dil uç noktası,
 * Next varlıkları, kök dosyalar (robots, site haritası, llms.txt, manifest, ikonlar, paylaşım görseli,
 * yerel harita stili) ve iç içe dil önekleri. Bunların `/en` biçimi 404 döner.
 */
const UNLOCALIZED_SEGMENTS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'dil',
  '_next',
  'en',
  'tr',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'manifest.webmanifest',
  'favicon.ico',
  'icon',
  'apple-icon',
  'og',
  'test-style.json',
])

/** Yolu, sorgu metni ve `#` kısmından (varsa) ayırır: `/a?b#c` → [`/a`, `?b#c`]. */
function splitSuffix(value: string): [path: string, suffix: string] {
  const cut = value.search(/[?#]/)
  return cut === -1 ? [value, ''] : [value.slice(0, cut), value.slice(cut)]
}

/**
 * Mantıksal yolun (öneksiz) verilen dildeki adresi. Sorgu metni ve `#` korunur:
 * ('en', '/durum') → '/en/durum'; ('en', '/') → '/en'; ('en', '/?hex=ff0001') → '/en?hex=ff0001';
 * ('tr', '/x') → '/x'.
 */
export function localePath(locale: Locale, path: string): string {
  const [pathname, suffix] = splitSuffix(path.startsWith('/') ? path : `/${path}`)
  const prefix = PREFIX[locale]
  if (prefix === '') return `${pathname}${suffix}`
  return `${pathname === '/' ? prefix : `${prefix}${pathname}`}${suffix}`
}

/**
 * Adresteki dil önekini ayırır: '/en/durum?x=1' → { en, '/durum?x=1' }; '/en' → { en, '/' }.
 * `/tr` öneki de tanınır (proxy onu köke yönlendirir); öneksiz yol Türkçedir. `/english` gibi
 * yollar önek sayılmaz.
 */
export function stripLocale(pathname: string): { locale: Locale; path: string } {
  const [path, suffix] = splitSuffix(pathname)
  for (const locale of ['en', 'tr'] as const) {
    const prefix = `/${locale}`
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return { locale, path: `${path.slice(prefix.length) || '/'}${suffix}` }
    }
  }
  return { locale: 'tr', path: pathname }
}

export interface Alternates {
  canonical: string
  languages: { tr: string; en: string; 'x-default': string }
}

/**
 * Sayfanın kanonik adresi ve dil karşılıkları (göreli; Next `metadataBase` ile mutlak yapar). Her dil
 * sürümü kendini ve diğerini listeler; `x-default` İngilizce adrestir (kullanıcı kararı, D-076).
 * `path` sorgu metni içermeyen mantıksal yoldur.
 */
export function alternatesFor(locale: Locale, path: string): Alternates {
  const en = localePath('en', path)
  return {
    canonical: localePath(locale, path),
    languages: { tr: localePath('tr', path), en, 'x-default': en },
  }
}

export type LocaleRoute =
  | { kind: 'next'; locale: 'tr'; path: string }
  | { kind: 'rewrite'; locale: 'en'; path: string }
  | { kind: 'redirect'; to: string }
  | { kind: 'not_found' }

/** `/en` altında sunulabilen mantıksal yol mu (ilk yol bölümüne göre). */
function isLocalizable(path: string): boolean {
  const first = path.split('/')[1] ?? ''
  return !UNLOCALIZED_SEGMENTS.has(first)
}

/**
 * Proxy'nin dil kararı (yalnızca yol; sorgu metnini proxy ekler):
 * - `/en`, `/en/*` → öneksiz yola yeniden yazılır, dil `en` (`/en/` → `/en` yönlendirmesi).
 * - `/en/admin*`, `/en/api/*`, `/en/dil`, `/en/` + kök dosya → 404.
 * - `/tr`, `/tr/*` → öneksiz yola 308.
 * - Öneki ayrılınca `//` ile başlayan yol (`/tr//host`, `/en//host`) → 404.
 * - Diğer her yol Türkçedir (`/english` önek değildir).
 */
export function localeRouting(pathname: string): LocaleRoute {
  const { locale, path } = stripLocale(pathname)
  // `/tr//evil.example` öneki ayrılınca `//evil.example` olur: yönlendirme adresi olarak dış host,
  // yeniden yazma adresi olarak dış sunucu demektir. Next bu yolları proxy'den önce normalleştirir
  // (resolve-routes.js, yinelenen bölü → 308); bu denetim o davranışa bel bağlamaz.
  if (path !== pathname && path.startsWith('//')) return { kind: 'not_found' }
  if (locale === 'tr') {
    if (path !== pathname) return { kind: 'redirect', to: path }
    return { kind: 'next', locale: 'tr', path }
  }
  if (pathname === '/en/') return { kind: 'redirect', to: '/en' }
  if (!isLocalizable(path)) return { kind: 'not_found' }
  return { kind: 'rewrite', locale: 'en', path }
}
