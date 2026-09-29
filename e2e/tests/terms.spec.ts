// Geçici kullanım koşulları (D-075). Esri sözleşmesi (E204 §3.1c.5) kullanıcıların Esri şartlarına
// uymasını isteyen bir maddeyi ister: sayfa açılır, madde ve belgeler oradadır, bağlantı haritanın
// atıf satırında ve site alt bilgisinde her zaman görünür.
import { expect, test } from '@playwright/test'
import { declineAnalytics, openMap } from '../support'

const TERMS_PATH = '/kullanim-kosullari'
const ESRI_CLAUSE = 'Haritayı kullanarak Esri’nin geçerli koşullarına uymayı kabul edersin'
const E204_URL =
  'https://www.esri.com/content/dam/esrisites/en-us/media/legal/platform/platform-legal.pdf'

test.beforeEach(async ({ context }) => {
  await declineAnalytics(context)
})

test('kullanım koşulları sayfası 200 döner ve Esri maddesini içerir', async ({ page, request }) => {
  // İlk istekte next dev sayfayı derler.
  const response = await request.get(TERMS_PATH, { timeout: 60_000 })
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain(ESRI_CLAUSE)

  await page.goto(TERMS_PATH)
  await expect(page).toHaveTitle(/^Kullanım koşulları · havayolu$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Kullanım koşulları' })).toBeVisible()
  await expect(page.getByText(ESRI_CLAUSE)).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'ArcGIS Location Platform sözleşmesi (E204)' }),
  ).toHaveAttribute('href', E204_URL)
  await expect(page.getByRole('link', { name: 'ODbL 1.0' })).toHaveAttribute(
    'href',
    'https://opendatacommons.org/licenses/odbl/1-0/',
  )
})

test('harita atıf satırındaki "Koşullar" bağlantısı sayfayı açar', async ({ page }) => {
  await openMap(page)
  const link = page.locator('.maplibregl-ctrl-attrib').getByRole('link', { name: 'Koşullar' })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', TERMS_PATH)
  await link.click()
  await expect(page).toHaveURL(new RegExp(`${TERMS_PATH}$`))
  await expect(page.getByRole('heading', { level: 1, name: 'Kullanım koşulları' })).toBeVisible()
})

test('site alt bilgisinde kullanım koşulları bağlantısı vardır', async ({ page }) => {
  await page.goto('/durum')
  const link = page.locator('.site-footer').getByRole('link', { name: 'Kullanım koşulları' })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', TERMS_PATH)
})
