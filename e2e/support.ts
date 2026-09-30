// E2E testlerinin ortak değerleri ve yardımcıları. Adresler CLAUDE.md'deki sabit yerel portlardır
// (web 3100, API 4100); API CORS ve WebSocket Origin denetimi yalnızca http://localhost:3100'ü tanır.
import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test'

export const WEB_URL = 'http://localhost:3100'
export const API_URL = 'http://localhost:4100'
/** Web sunucusunun ortamındaki `WEB_HOST` (şemasız); sayfalardaki mutlak adresler bu host'tadır. */
export const WEB_HOST = new URL(WEB_URL).host
export const API_HOST = new URL(API_URL).host

/**
 * `pnpm dev:replay`'in `cruise` senaryosundaki ilk seyir uçağı (IST ↔ ESB, ~450 kt):
 * tools/src/scenarios/cruise.ts → `syntheticIdentity(1)`.
 */
export const REPLAY_AIRCRAFT = { hex: 'ff0001', callsign: 'HYS001' } as const
/** Senaryoda LTFM'de yerde taksi yapan uçak (cruise.ts → `TAXI_NUMBER`, 35R ile 18/36 arası). */
export const TAXI_AIRCRAFT = { hex: 'ff0092', callsign: 'HYS092' } as const
/** LTFM'den hep uzakta, Esenboğa ile Van arasında uçan seyir uçağı (cruise.ts → `CRUISE_ROUTES[3]`). */
export const FAR_AIRCRAFT = { hex: 'ff0004', callsign: 'HYS004' } as const
/** Senaryoda olmayan bir çağrı kodu (seyir uçakları HYS001…HYS008, yaklaşma HYS091, taksi HYS092). */
export const MISSING_CALLSIGN = 'HYS099'
/** Senaryoda olmayan bir hex (replay uçakları ff0001…). */
export const MISSING_HEX = 'fe0099'

/**
 * Referans verisi fixture'ı (tools/fixtures/ourairports; worker'ın `jobs` rolü ilk açılışta yükler):
 * IATA kodlu 61 Türkiye havalimanı; OurAirports'a göre 51'inde tarifeli sefer var. İndekslenen
 * havalimanı sayfası 55'tir (D-076: tarifeli, istasyon ya da resmî adı DHMİ/işletmeciden doğrulanmış
 * sivil havalimanı; Siirt, Kocaeli, Uşak ve Atatürk bu yüzden eklenir). Kalan 6'sı resmî adı
 * doğrulanamayan askerî üslerdir ve `noindex, follow` alır.
 */
export const AIRPORT_COUNT = 61
export const INDEXABLE_AIRPORT_COUNT = 55
/** Sitemap'teki havalimanı dışı sayfalar; her birinin `/en` ikizi de vardır (D-076). */
export const STATIC_PUBLIC_PATHS = [
  '/',
  '/havalimanlari',
  '/hakkinda',
  '/yenilikler',
  '/kullanim-kosullari',
] as const

/**
 * Birincil istasyon (CLAUDE.md): işletmecisinin (İGA) resmî adıyla İstanbul Havalimanı, 6 pist
 * (packages/shared/src/reference/airport-names.ts).
 */
export const PRIMARY_AIRPORT = {
  icao: 'LTFM',
  iata: 'IST',
  nameTr: 'İstanbul Havalimanı',
  nameEn: 'Istanbul Airport',
  runways: 6,
} as const
/** LTFM'ye en yakın tarifeli iki havalimanı: Sabiha Gökçen (~64 km) ve Çorlu (~70 km). */
export const PRIMARY_AIRPORT_NEIGHBOURS = ['LTFJ', 'LTBU'] as const
/**
 * Resmî adı doğrulanamayan, tarifeli seferi kayıtlı olmayan ve istasyon olmayan hava üssü (İncirlik):
 * sayfası açılır ama noindex.
 */
export const NON_INDEXABLE_AIRPORT = { icao: 'LTAG', iata: 'UAB' } as const

/** OpenAI'nin tarayıcısı; Next.js'in varsayılan "HTML-limited bot" listesinde yoktur (D-076). */
export const GPTBOT_USER_AGENT =
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot'

/**
 * Onay bandı testi için sahte analiz adresi. Yereldir; takip script'i isteği tarayıcıdan çıkmadan
 * `page.route` ile yanıtlanır, bu adreste bir sunucu çalışması gerekmez.
 */
export const E2E_ANALYZE_URL = 'http://127.0.0.1:4390'
export const E2E_ANALYZE_SITE_ID = 'e2e.localhost'

export const CONSENT_COOKIE = 'hy_consent'
export const LABEL_SETTINGS_KEY = 'hy:map:labels'

/** Arama sonuçsuz kalınca gösterilen metin (docs/prompts/parca-1.md → M6, birebir). */
export const NOT_FOUND_TEXT =
  'Bu sefer şu an havada görünmüyor ya da farklı bir çağrı koduyla uçuyor; tescil ile arayabilirsin.'

/** Harita testlerinde onay bandı panelleri örtmesin diye tercih önceden "Reddet" yapılır. */
export async function declineAnalytics(context: BrowserContext): Promise<void> {
  await context.addCookies([{ name: CONSENT_COOKIE, value: 'denied', url: WEB_URL }])
}

export async function consentCookie(context: BrowserContext): Promise<string | undefined> {
  const cookies = await context.cookies(WEB_URL)
  return cookies.find((cookie) => cookie.name === CONSENT_COOKIE)?.value
}

/**
 * MapLibre'nin WebGL tuvali oluşana ve ilk stil ile uçak katmanları yüklenene ("Harita yükleniyor"
 * kalkana) kadar bekler. İlk açılışta next dev harita kütüphanesinin istemci parçasını derleyebilir;
 * bu yüzden süre genel beklemeden uzundur.
 */
export async function waitForMap(page: Page): Promise<void> {
  const map = page.locator('.live-map')
  await expect(map.locator('.maplibregl-canvas')).toBeVisible({ timeout: 30_000 })
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 })
  await expect(map.locator('.live-map__message')).toHaveCount(0)
}

/** Sayfayı açar ve haritanın hazır olmasını bekler. */
export async function openMap(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  await waitForMap(page)
}

export function aircraftTable(page: Page): Locator {
  return page.locator('.live-map__table table')
}

export function aircraftRow(page: Page, hex: string): Locator {
  return aircraftTable(page).locator(`tbody tr[data-hex="${hex}"]`)
}

export function infoCard(page: Page): Locator {
  return page.locator('.live-map__card')
}

/** Adres satırında `hex` parametresi tam olarak bu değer mi. */
export function hexParam(hex: string): RegExp {
  return new RegExp(`[?&]hex=${hex}(?:&|#|$)`)
}

/**
 * Dil anahtarı: `hreflang` ve `lang` taşıyan düz `<a>` (D-076). `<Link>` değildir; kök düzen istemci
 * geçişinde yeniden kullanıldığından dil değişimi tam sayfa yüklemesi ister.
 */
export function languageToggle(page: Page): Locator {
  return page.locator('a[hreflang][lang]')
}

/** Bir yolun İngilizce ikizi: `/` → `/en`, `/x?q` → `/en/x?q` (lib/locale-routing.ts'nin sözleşmesi). */
export function enPath(path: string): string {
  const index = path.indexOf('?')
  const pathname = index < 0 ? path : path.slice(0, index)
  const query = index < 0 ? '' : path.slice(index)
  return `${pathname === '/' ? '/en' : `/en${pathname}`}${query}`
}

/**
 * Sitenin mutlak adresini yol + sorguya çevirir. Adres mutlak olmalı ve `WEB_HOST`'ta bulunmalıdır;
 * şema http ya da https olabilir (metadataBase WEB_HOST'tan kurulur).
 */
export function sitePath(url: string | undefined, what: string): string {
  expect(url, `${what}: adres var`).toBeTruthy()
  expect(url, `${what}: mutlak adres`).toMatch(/^https?:\/\//)
  const parsed = new URL(url ?? '')
  expect(parsed.host, `${what}: host`).toBe(WEB_HOST)
  return `${parsed.pathname}${parsed.search}`
}

/** Yönlendirmeleri izlemeden alınan yanıt ve gövdesi. İlk istekte next dev sayfayı derleyebilir. */
export async function fetchRaw(
  request: APIRequestContext,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ response: APIResponse; body: string }> {
  const response = await request.get(path, { headers, maxRedirects: 0, timeout: 60_000 })
  return { response, body: await response.text() }
}

/** Yönlendirmenin durum kodu ve hedefi (Location göreli ya da mutlak olabilir). */
export async function expectRedirect(
  request: APIRequestContext,
  from: string,
  to: string,
  status = 308,
): Promise<APIResponse> {
  const { response } = await fetchRaw(request, from)
  expect(response.status(), `${from}: durum kodu`).toBe(status)
  const location = response.headers()['location']
  expect(location, `${from}: Location başlığı`).toBeTruthy()
  const target = new URL(location ?? '', WEB_URL)
  expect(`${target.pathname}${target.search}`, `${from}: hedef`).toBe(to)
  return response
}
