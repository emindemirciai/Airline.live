// E2E testlerinin ortak değerleri ve yardımcıları. Adresler CLAUDE.md'deki sabit yerel portlardır
// (web 3100, API 4100); API CORS ve WebSocket Origin denetimi yalnızca http://localhost:3100'ü tanır.
import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test'

export const WEB_URL = 'http://localhost:3100'
export const API_URL = 'http://localhost:4100'

/**
 * `pnpm dev:replay`'in `cruise` senaryosundaki ilk seyir uçağı (IST ↔ ESB, ~450 kt):
 * tools/src/scenarios/cruise.ts → `syntheticIdentity(1)`.
 */
export const REPLAY_AIRCRAFT = { hex: 'ff0001', callsign: 'HYS001' } as const
/** Senaryoda olmayan bir çağrı kodu (seyir uçakları HYS001…HYS008, yaklaşma HYS091, taksi HYS092). */
export const MISSING_CALLSIGN = 'HYS099'
/** Senaryoda olmayan bir hex (replay uçakları ff0001…). */
export const MISSING_HEX = 'fe0099'

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
 * Sayfayı açar; MapLibre'nin WebGL tuvali oluşana ve ilk stil ile uçak katmanları yüklenene
 * ("Harita yükleniyor" kalkana) kadar bekler. İlk açılışta next dev harita kütüphanesinin istemci
 * parçasını derleyebilir; bu yüzden süre genel beklemeden uzundur.
 */
export async function openMap(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  const map = page.locator('.live-map')
  await expect(map.locator('.maplibregl-canvas')).toBeVisible({ timeout: 30_000 })
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 })
  await expect(map.locator('.live-map__message')).toHaveCount(0)
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
