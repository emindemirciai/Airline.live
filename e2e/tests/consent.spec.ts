// Analiz onay bandı (Parça 1 M1a'da elle doğrulandı; otomatik test M6'ya bırakılmıştı). Takip
// script'i yalnızca açık onayla yüklenir, "Reddet" hiçbir şey yüklemez, tercih çerezde saklanır ve
// alt bilgideki düğmeyle (alt bilginin gizli olduğu harita sayfasında harita denetimlerindeki
// düğmeyle) değiştirilebilir, admin sayfalarında bant yoktur.
// Analiz adresi yerel ve sahtedir (playwright.config.ts); script isteği tarayıcıdan çıkmadan burada
// yanıtlanır, gerçek analiz uygulamasına istek gitmez.
import { expect, test, type Page } from '@playwright/test'
import { consentCookie, E2E_ANALYZE_SITE_ID, E2E_ANALYZE_URL } from '../support'

const TRACKER_URL = `${E2E_ANALYZE_URL}/api/tracker`

test.beforeEach(async ({ page }) => {
  await page.route(`${E2E_ANALYZE_URL}/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }),
  )
})

const banner = (page: Page) => page.getByRole('dialog', { name: 'Analiz için onay' })
const tracker = (page: Page) => page.locator('script[data-hy-analytics]')

test('onay olmadan script yüklenmez; "Kabul et" yükler ve tercih saklanır', async ({
  page,
  context,
}) => {
  await page.goto('/durum')
  await expect(banner(page)).toBeVisible()
  await expect(tracker(page)).toHaveCount(0)

  await banner(page).getByRole('button', { name: 'Kabul et' }).click()
  await expect(banner(page)).toBeHidden()
  await expect(tracker(page)).toHaveAttribute('src', TRACKER_URL)
  await expect(tracker(page)).toHaveAttribute('data-site', E2E_ANALYZE_SITE_ID)
  expect(await consentCookie(context)).toBe('granted')

  await page.reload()
  await expect(tracker(page)).toHaveCount(1)
  await expect(banner(page)).toHaveCount(0)
})

test('"Reddet" script yüklemez; tercih alt bilgideki düğmeyle değiştirilebilir', async ({
  page,
  context,
}) => {
  await page.goto('/durum')
  await banner(page).getByRole('button', { name: 'Reddet' }).click()
  await expect(banner(page)).toBeHidden()
  await expect(tracker(page)).toHaveCount(0)
  expect(await consentCookie(context)).toBe('denied')

  await page.reload()
  await expect(banner(page)).toHaveCount(0)
  await expect(tracker(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Analiz tercihleri' }).click()
  await expect(banner(page)).toBeVisible()
  await banner(page).getByRole('button', { name: 'Kabul et' }).click()
  await expect(tracker(page)).toHaveAttribute('src', TRACKER_URL)
  expect(await consentCookie(context)).toBe('granted')
})

test('harita sayfasında (alt bilgi gizli) tercih düğmesi harita denetimlerindedir', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await banner(page).getByRole('button', { name: 'Kabul et' }).click()
  await expect(banner(page)).toBeHidden()
  expect(await consentCookie(context)).toBe('granted')

  const settings = page
    .locator('.live-map__controls')
    .getByRole('button', { name: 'Analiz tercihleri' })
  await expect(settings).toBeVisible()
  await settings.click()
  await expect(banner(page)).toBeVisible()
  await banner(page).getByRole('button', { name: 'Reddet' }).click()
  await expect(banner(page)).toBeHidden()
  expect(await consentCookie(context)).toBe('denied')
})

test('admin sayfalarında bant gösterilmez ve script yüklenmez', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Yönetici girişi' })).toBeVisible()
  await expect(banner(page)).toHaveCount(0)
  await expect(tracker(page)).toHaveCount(0)
})
