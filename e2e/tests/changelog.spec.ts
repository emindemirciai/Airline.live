// Yenilikler sayfası (D-091): her sürümün yayın tarihi ve saati, Europe/Istanbul, 24 saat. Türkçede
// "4 Ekim 2026, 20:27 (Türkiye saati)", İngilizcede "4 October 2026, 20:27 (UTC+3)". Saat sunucuda yazılır
// (`<time datetime>` ISO 8601 UTC); yayın anı henüz yazılmamış çalışan sürüm için web sunucusunun
// açılış anı gösterilir.
import { expect, test, type Page } from '@playwright/test'
import { declineAnalytics, enPath } from '../support'

type Locale = 'tr' | 'en'

const CHANGELOG_PATH = '/yenilikler'
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const RELEASED: Record<Locale, string> = { tr: 'Yayın tarihi', en: 'Released' }

const card = (page: Page, version: string) => page.locator(`li.release[id="v${version}"]`)
const releaseTimeOf = (page: Page, version: string) =>
  card(page, version).locator('.release-meta time')

/** Anın sayfada beklenen yazımı, İstanbul saatiyle (Türkiye 2016'dan beri UTC+3). */
function istanbulText(iso: string, locale: Locale): string {
  const ms = Date.parse(iso)
  const date = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(ms)
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Europe/Istanbul',
  }).format(ms)
  return `${date}, ${time} (${locale === 'tr' ? 'Türkiye saati' : 'UTC+3'})`
}

test.beforeEach(async ({ context }) => {
  await declineAnalytics(context)
})

test('Türkçe: geçmiş sürümün yayın tarihi ve saati Türkiye saatiyle', async ({ page }) => {
  await page.goto(CHANGELOG_PATH)
  const v0170 = releaseTimeOf(page, '0.17.0')
  await expect(v0170).toHaveAttribute('datetime', '2026-10-04T17:27:12Z')
  await expect(v0170).toHaveText('4 Ekim 2026, 20:27 (Türkiye saati)')
  await expect(card(page, '0.17.0').locator('.release-meta')).toContainText(
    'Yayın tarihi: 4 Ekim 2026, 20:27 (Türkiye saati)',
  )
  // UTC'de 1 Ekim 23:17, İstanbul'da 2 Ekim 02:17: gün de İstanbul takvimindedir.
  const v0110 = releaseTimeOf(page, '0.11.0')
  await expect(v0110).toHaveAttribute('datetime', '2026-10-01T23:17:49Z')
  await expect(v0110).toHaveText('2 Ekim 2026, 02:17 (Türkiye saati)')
})

test('İngilizce: yayın tarihi ve saati UTC farkıyla', async ({ page }) => {
  await page.goto(enPath(CHANGELOG_PATH))
  const v0170 = releaseTimeOf(page, '0.17.0')
  await expect(v0170).toHaveAttribute('datetime', '2026-10-04T17:27:12Z')
  await expect(v0170).toHaveText('4 October 2026, 20:27 (UTC+3)')
  await expect(card(page, '0.17.0').locator('.release-meta')).toContainText(
    'Released: 4 October 2026, 20:27 (UTC+3)',
  )
  await expect(releaseTimeOf(page, '0.11.0')).toHaveText('2 October 2026, 02:17 (UTC+3)')
})

test('her sürümün tek yayın zamanı var; ISO anı ile görünen metin aynı anı gösterir', async ({
  page,
  request,
}) => {
  const { version } = (await (await request.get('/api/version')).json()) as { version: string }
  for (const locale of ['tr', 'en'] as const) {
    await page.goto(locale === 'en' ? enPath(CHANGELOG_PATH) : CHANGELOG_PATH)
    const cards = page.locator('li.release')
    const count = await cards.count()
    expect(count, locale).toBeGreaterThan(20)
    await expect(page.locator('li.release .release-meta time')).toHaveCount(count)
    for (const time of await page.locator('li.release .release-meta time').all()) {
      const dateTime = (await time.getAttribute('datetime')) ?? ''
      expect(dateTime, locale).toMatch(ISO_INSTANT)
      await expect(time).toHaveText(istanbulText(dateTime, locale))
    }
    // Çalışan sürüm: "Güncel sürüm" etiketli; yayın anı yazılmamışsa sunucunun açılış anı (geçmişte).
    const current = releaseTimeOf(page, version)
    const dateTime = (await current.getAttribute('datetime')) ?? ''
    expect(Date.parse(dateTime)).toBeLessThanOrEqual(Date.now())
    await expect(card(page, version).locator('.state-current')).toHaveCount(1)
    await expect(card(page, version).locator('.release-meta')).toContainText(
      `${RELEASED[locale]}: ${istanbulText(dateTime, locale)}`,
    )
    // Açılış anı süreç boyunca sabittir; yeniden yüklemede değişmez.
    await page.reload()
    await expect(releaseTimeOf(page, version)).toHaveAttribute('datetime', dateTime)
  }
})
