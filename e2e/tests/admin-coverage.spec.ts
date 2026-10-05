// Kapsama raporu (Parça 1 M7b.2, D-098): yönetici /admin/kapsama'da 24 saatlik raporu başlatır,
// worker'ın jobs rolü `queued` satırı üstlenip çalıştırır, sayfa "Hazır"ı gösterir ve Markdown
// indirilir. Veri: LTAI fixture'ı (tools arrival-fixture; replay LTAI'ye yaklaşma uçurmaz). Test
// yöneticisi playwright.config.ts'teki webServer ortamından gelir ve `.env`'deki aynı anahtarları
// ezer; `.env`'in diğer değerleri (ör. DATABASE_URL) okunur, `.env`'e yazılmaz.
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { runArrivalFixture } from '../arrival-fixture'
import { ARRIVAL_FIXTURE, E2E_ADMIN } from '../support'

/** Worker kuyruğu 10 sn'de bir yoklar; hesap yerel veritabanında birkaç saniye sürer. */
const REPORT_DONE_TIMEOUT_MS = 240_000

async function login(page: Page): Promise<void> {
  await page.goto('/admin/giris')
  await page.getByLabel('E-posta').fill(E2E_ADMIN.email)
  await page.getByLabel('Kurulum anahtarı').fill(E2E_ADMIN.setupToken)
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test.describe('admin kapsama raporu', () => {
  test.beforeAll(() => {
    const output = runArrivalFixture('seed')
    expect(output).toContain(`${ARRIVAL_FIXTURE.icao} fixture'ı yazıldı: 3 uçuş`)
  })

  test.afterAll(() => {
    runArrivalFixture('clean')
  })

  test('oturumsuz /admin/kapsama ve indirme ucu giriş sayfasına döner', async ({
    page,
    request,
  }) => {
    await page.goto('/admin/kapsama')
    await expect(page).toHaveURL(/\/admin\/giris$/)
    const download = await request.get('/admin/kapsama/indir?rapor=1', { maxRedirects: 0 })
    expect(download.status()).toBe(303)
    expect(download.headers().location).toBe('/admin/giris')
  })

  test('24 saatlik rapor: Hazır, LTAI satırı ve Markdown indirmesi', async ({ page }) => {
    test.setTimeout(REPORT_DONE_TIMEOUT_MS + 120_000)
    await login(page)
    await page.goto('/admin/kapsama')
    await expect(page.getByRole('heading', { level: 1, name: 'Kapsama raporu' })).toBeVisible()

    const hours = page.getByLabel('Pencere')
    await expect(hours).toHaveValue('24')
    await page.getByRole('button', { name: 'Raporu başlat' }).click()
    await expect(page).toHaveURL(/\/admin\/kapsama\?rapor=\d+$/)
    const id = new URL(page.url()).searchParams.get('rapor') ?? ''
    expect(id).toMatch(/^[1-9]\d*$/)

    // Sayfa etkin rapor varken kendini 5 sn'de bir yeniler; başlıktaki rozet "Hazır" olur.
    const heading = page.getByRole('heading', { level: 2, name: new RegExp(`^Rapor ${id}\\b`) })
    await expect(heading).toBeVisible()
    await expect(heading).toContainText('Hazır', { timeout: REPORT_DONE_TIMEOUT_MS })

    const stations = page.getByRole('table', { name: 'İstasyon özeti' })
    const row = stations.getByRole('row').filter({ hasText: ARRIVAL_FIXTURE.icao })
    await expect(row).toHaveCount(1)
    await expect(row.getByRole('rowheader')).toHaveText(
      `${ARRIVAL_FIXTURE.iata} ${ARRIVAL_FIXTURE.icao}`,
    )
    const cells = row.getByRole('cell')
    await expect(cells.nth(0)).toHaveText(ARRIVAL_FIXTURE.arrivals)
    await expect(cells.nth(1)).toHaveText(ARRIVAL_FIXTURE.groundShare)
    // Kural 1 uygulanır (%70'in altında); 3 varışta Wilson aralığı %70'i içerir ve örnek azdır.
    await expect(cells.nth(5)).toHaveText('Uygulanır (sınırda, az örnek)')
    await expect(cells.nth(6)).toHaveText('Uygulanmaz (az örnek)')

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: `${id} numaralı raporu indir (.md)`, exact: true }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^kapsama-\d{8}T\d{4}Z\.md$/)
    const markdown = readFileSync(await download.path(), 'utf8')
    expect(markdown.startsWith('# Kapsama raporu\n')).toBe(true)
    expect(markdown).toContain(`admin raporu #${id}`)
    expect(markdown).toContain(`${ARRIVAL_FIXTURE.icao} (${ARRIVAL_FIXTURE.iata})`)
    expect(markdown).toContain('ODbL')
    expect(markdown).not.toContain('\r')
    for (const hex of ARRIVAL_FIXTURE.hexes) expect(markdown).not.toContain(hex)
  })
})
