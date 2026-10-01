// Dil yönlendirmesi (Parça 1 M6b, D-076). Türkçe kökte, İngilizce `/en` altındadır: proxy `/en/*`
// isteğini öneksiz yola yeniden yazar ve dili kendi istek başlığıyla verir (istemcinin gönderdiği
// başlık ezilir). Dil çerezi emekliye ayrıldı; eski `/dil` bağlantıları önekli adrese kalıcı olarak
// yönlenir. Dil anahtarı düz bir `<a>`dır, sorgu metnini (seçili uçak `?hex=`) korur ve istemci
// geçişinden sonra yeni sayfayı gösterir.
import { expect, test, type Page } from '@playwright/test'
import { htmlLang, tags } from '../html'
import {
  aircraftRow,
  declineAnalytics,
  enPath,
  expectRedirect,
  fetchRaw,
  hexParam,
  infoCard,
  languageToggle,
  openMap,
  PRIMARY_AIRPORT,
  APPROACH_AIRCRAFT,
  REPLAY_AIRCRAFT,
  waitForMap,
  WEB_URL,
} from '../support'

const { hex, callsign } = REPLAY_AIRCRAFT
const STATION_PATH = `/istasyon/${PRIMARY_AIRPORT.icao}`

test.describe('yönlendirme', () => {
  test('/en sayfaları İngilizce, öneksiz sayfalar Türkçe', async ({ request }) => {
    const cases: [string, 'tr' | 'en'][] = [
      ['/', 'tr'],
      ['/en', 'en'],
      ['/durum', 'tr'],
      ['/en/durum', 'en'],
      ['/yenilikler', 'tr'],
      ['/en/yenilikler', 'en'],
      ['/kullanim-kosullari', 'tr'],
      ['/en/kullanim-kosullari', 'en'],
    ]
    for (const [path, lang] of cases) {
      const { response, body } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(200)
      expect(htmlLang(body), `${path}: <html lang>`).toBe(lang)
    }
  })

  test('/tr öneki öneksiz adrese kalıcı olarak yönlenir, sorgu korunur', async ({ request }) => {
    await expectRedirect(request, '/tr', '/')
    await expectRedirect(request, '/tr/durum', '/durum')
    await expectRedirect(request, `/tr?hex=${hex}`, `/?hex=${hex}`)
  })

  test('/en altında karşılığı olmayan yollar ve benzer adresler 404 döner', async ({ request }) => {
    for (const path of [
      '/en/admin',
      '/en/admin/giris',
      '/en/api/version',
      '/en/dil',
      '/en/robots.txt',
      '/en/sitemap.xml',
      '/en/llms.txt',
      '/english',
      '/enx/durum',
    ]) {
      const { response } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(404)
    }
  })

  test('istemcinin gönderdiği dil başlıkları ve eski dil çerezi yok sayılır', async ({
    request,
  }) => {
    const spoofed = await fetchRaw(request, '/durum', { 'x-hy-locale': 'en', 'x-hy-path': '/x' })
    expect(htmlLang(spoofed.body)).toBe('tr')
    expect(toggleHrefs(spoofed.body)).toEqual(['/en/durum'])
    const spoofedEn = await fetchRaw(request, '/en/durum', { 'x-hy-locale': 'tr' })
    expect(htmlLang(spoofedEn.body)).toBe('en')
    const oldCookie = await fetchRaw(request, '/durum', { cookie: 'lang=en' })
    expect(htmlLang(oldCookie.body)).toBe('tr')
  })

  test('/dil eski bağlantıları önekli adrese yönlendirir ve dil çerezini siler', async ({
    request,
  }) => {
    const response = await expectRedirect(request, '/dil?to=en&next=/durum', '/en/durum')
    expect(response.headers()['x-robots-tag']).toMatch(/noindex/)
    const cookies = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === 'set-cookie')
      .map((header) => header.value)
    expect(
      cookies.some(
        (cookie) => /^lang=/.test(cookie) && /max-age=0|expires=thu, 01 jan 1970/i.test(cookie),
      ),
      'lang çerezi silinir',
    ).toBe(true)

    await expectRedirect(
      request,
      `/dil?to=en&next=${encodeURIComponent(`/?hex=${hex}`)}`,
      `/en?hex=${hex}`,
    )
    await expectRedirect(request, '/dil?to=tr&next=/en/durum', '/durum')
    // Açık yönlendirme yok: site dışı hedef kök sayfaya döner.
    for (const next of ['//evil.example/x', 'https://evil.example/']) {
      await expectRedirect(request, `/dil?to=en&next=${encodeURIComponent(next)}`, '/en')
    }
    // Önek ayrılınca `//evil.example` olan hedefler de site içinde kalır (iki dilde, kodlu ve kodsuz).
    const prefixed: [string, string][] = [
      ['/dil?next=/en//evil.example/x', '/'],
      ['/dil?to=tr&next=/tr//evil.example', '/'],
      ['/dil?to=en&next=/en//evil.example', '/en'],
      [`/dil?to=tr&next=${encodeURIComponent('/en//evil.example/x')}`, '/'],
      [`/dil?to=en&next=${encodeURIComponent('/tr/\\evil.example')}`, '/en'],
    ]
    for (const [path, target] of prefixed) {
      const redirect = await expectRedirect(request, path, target)
      const location = redirect.headers()['location'] ?? ''
      expect(location, `${path}: şemasız dış adres değil`).not.toMatch(/^\/[/\\]/)
      expect(new URL(location, WEB_URL).host, `${path}: aynı site`).toBe(new URL(WEB_URL).host)
    }
  })

  test('sunucu çizimindeki dil anahtarı sayfanın ikizini gösterir, sorguyu korur', async ({
    request,
  }) => {
    const cases: [string, string][] = [
      ['/', '/en'],
      ['/en', '/'],
      [`/?hex=${hex}`, `/en?hex=${hex}`],
      [`/en?hex=${hex}`, `/?hex=${hex}`],
      [STATION_PATH, enPath(STATION_PATH)],
      [enPath(STATION_PATH), STATION_PATH],
      ['/havalimanlari', '/en/havalimanlari'],
    ]
    for (const [path, target] of cases) {
      const { body } = await fetchRaw(request, path)
      expect(toggleHrefs(body), path).toEqual([target])
    }
  })
})

/** Ham HTML'deki dil anahtarlarının (`hreflang` ve `lang` taşıyan `<a>`) adresleri. */
function toggleHrefs(html: string): string[] {
  return tags(html, 'a')
    .filter((a) => a.hreflang !== undefined && a.lang !== undefined)
    .map((a) => a.href ?? '')
}

/** Sayfadaki site içi bağlantılar (dil anahtarı hariç). */
async function internalLinks(page: Page): Promise<string[]> {
  return page
    .locator('a[href^="/"]:not([hreflang])')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
}

const EN_PREFIX = /^\/en(?:[/?#]|$)/

test.describe('tarayıcıda', () => {
  test.beforeEach(async ({ context }) => {
    await declineAnalytics(context)
  })

  test('havalimanı sayfasında İngilizceye ve geri geçer', async ({ page }) => {
    await page.goto(STATION_PATH)
    const toggle = languageToggle(page)
    await expect(toggle).toHaveCount(1)
    await expect(toggle).toHaveAttribute('href', enPath(STATION_PATH))
    await expect(toggle).toHaveAttribute('hreflang', 'en')
    await expect(toggle).toHaveAttribute('lang', 'en')

    await toggle.click()
    await expect(page).toHaveURL(`${WEB_URL}${enPath(STATION_PATH)}`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(toggle).toHaveAttribute('href', STATION_PATH)
    await expect(toggle).toHaveAttribute('hreflang', 'tr')

    await toggle.click()
    await expect(page).toHaveURL(`${WEB_URL}${STATION_PATH}`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  })

  test('istemci geçişinden sonra anahtar yeni sayfayı gösterir', async ({ page }) => {
    for (const locale of ['tr', 'en'] as const) {
      const from = locale === 'en' ? '/en/yenilikler' : '/yenilikler'
      const to = locale === 'en' ? '/en/durum' : '/durum'
      await page.goto(from)
      await page.evaluate(() => {
        ;(window as Window & { hySameDocument?: boolean }).hySameDocument = true
      })
      // Menüdeki bağlantı Next.js `<Link>`idir.
      await page.locator(`header a[href="${to}"]`).click()
      await expect(page).toHaveURL(`${WEB_URL}${to}`)
      // Tam sayfa yüklemesi değil, istemci geçişi oldu: kök düzen ve anahtar yeniden kullanıldı.
      expect(
        await page.evaluate(
          () => (window as Window & { hySameDocument?: boolean }).hySameDocument === true,
        ),
        `${from} → ${to} istemci geçişi`,
      ).toBe(true)
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      await expect(languageToggle(page)).toHaveAttribute(
        'href',
        locale === 'en' ? '/durum' : '/en/durum',
      )
    }
  })

  test('haritada seçili uçak dil değişince korunur', async ({ page }) => {
    await openMap(page, `/?hex=${hex}`)
    await expect(infoCard(page)).toContainText(callsign)
    const toggle = languageToggle(page)
    await expect(toggle).toHaveAttribute('href', `/en?hex=${hex}`)

    await toggle.click()
    await expect(page).toHaveURL(`${WEB_URL}/en?hex=${hex}`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await waitForMap(page)
    await expect(infoCard(page)).toContainText(callsign)
    await expect(toggle).toHaveAttribute('href', `/?hex=${hex}`)
  })

  test('haritada seçim değişince adres ve anahtar önekini korur', async ({ page }) => {
    for (const home of ['/', '/en'] as const) {
      // Açılış görünümü IST'dir (D-079): orada hep görünen yaklaşmadaki uçak seçilir.
      const { hex: nearHex, callsign: nearCallsign } = APPROACH_AIRCRAFT
      await openMap(page, home)
      const row = aircraftRow(page, nearHex)
      await expect(row).toBeVisible({ timeout: 30_000 })
      await row.locator('td').last().click()
      await expect(infoCard(page)).toContainText(nearCallsign)
      await expect(page).toHaveURL(`${WEB_URL}${home}?hex=${nearHex}`)
      await expect(page).toHaveURL(hexParam(nearHex))
      const other = home === '/' ? `/en?hex=${nearHex}` : `/?hex=${nearHex}`
      await expect(languageToggle(page)).toHaveAttribute('href', other)

      await infoCard(page)
        .getByRole('button', { name: home === '/' ? 'Kapat' : 'Close', exact: true })
        .click()
      await expect(infoCard(page)).toBeHidden()
      await expect(page).toHaveURL(`${WEB_URL}${home}`)
      await expect(languageToggle(page)).toHaveAttribute('href', home === '/' ? '/en' : '/')
    }
  })

  test('bütün site içi bağlantılar sayfanın dilindedir', async ({ page }) => {
    const pages = [
      '/havalimanlari',
      STATION_PATH,
      '/hakkinda',
      '/yenilikler',
      '/kullanim-kosullari',
      '/durum',
    ]
    for (const path of pages) {
      for (const locale of ['tr', 'en'] as const) {
        const url = locale === 'en' ? enPath(path) : path
        await page.goto(url)
        const links = await internalLinks(page)
        expect(links.length, `${url}: bağlantı var`).toBeGreaterThan(0)
        const wrong = links.filter((href) =>
          locale === 'en' ? !EN_PREFIX.test(href) : EN_PREFIX.test(href),
        )
        expect(wrong, `${url}: başka dildeki bağlantılar`).toEqual([])
      }
    }
  })
})
