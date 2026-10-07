// Canlı haritanın arama kutusunda havalimanı araması (D-108, M6e.14): yazarken havalimanı önerilir
// (ARIA 1.2 combobox, ağ isteği yok), seçmek pine tıklamakla aynıdır (harita oraya gider, pencere
// açılır, adres değişmez), Escape önce listeyi kapatır, pencere kapanınca odak kutuya döner. Enter
// uçak aramasını da yapar: tek uçak seçilir, tam kodlu havalimanı açılır (en az 4 harfle tek
// eşleşme de; "THY" ve "gok" listede kalır), ikisi yoksa açıklayıcı metin çıkar. Askerî hava üsleri
// hiçbir sorguyla bulunmaz (D-103, D-107). Klavyedeki etkin seçenek uzun listede görünür kalır;
// "Ara"dan açılan listede odak kutuya döner; telefonda dokunup seçmek klavyeyi kapatır, pencere
// kapanınca kutu odak almaz. Her test tek sayfa yüklemesidir (her biri bir WebSocket el sıkışması,
// `WS_RATE_LIMIT`).
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  airportListCodes,
  declineAnalytics,
  infoCard,
  MILITARY_AIRFIELDS,
  openMap,
  PRIMARY_AIRPORT,
  REPLAY_AIRCRAFT,
  searchInput,
} from '../support'

/** "Bu adla ya da kodla bir havalimanı bulunamadı…" (packages/i18n → map.search.airportNotFound). */
const AIRPORT_NOT_FOUND = 'Bu adla ya da kodla bir havalimanı bulunamadı.'

function options(page: Page): Locator {
  return page.getByRole('search').getByRole('listbox').getByRole('option')
}

/** Kodla başlayan seçenek (erişilebilir ad `aria-label`: "IST, İstanbul Havalimanı, İstanbul · LTFM"). */
function option(page: Page, code: string): Locator {
  return options(page).filter({ hasText: new RegExp(`^${code}`) })
}

function listbox(page: Page): Locator {
  return page.getByRole('search').getByRole('listbox')
}

/** Seçenek listenin görünen alanının içinde (liste kendi içinde kaydırılır; 1 px pay). */
async function expectInsideList(page: Page, item: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const [outer, inner] = await Promise.all([listbox(page).boundingBox(), item.boundingBox()])
      if (outer === null || inner === null) return false
      return inner.y >= outer.y - 1 && inner.y + inner.height <= outer.y + outer.height + 1
    })
    .toBe(true)
}

function popup(page: Page, icao?: string): Locator {
  const selector = '.live-map [role="dialog"].map-popup'
  return page.locator(icao === undefined ? selector : `${selector}[data-icao="${icao}"]`)
}

async function expectClosed(input: Locator): Promise<void> {
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await expect(input.page().getByRole('search').getByRole('listbox')).toHaveCount(0)
}

test.use({ reducedMotion: 'reduce' })

test.beforeEach(async ({ context }) => {
  await declineAnalytics(context)
})

test('"esenboğa": öneri listesinden klavyeyle seçilir; harita ESB’ye gider, pencere açılır, adres değişmez; Escape odağı kutuya verir', async ({
  page,
}) => {
  await openMap(page)
  const input = searchInput(page)
  await input.fill('esenboğa')
  const esb = page.getByRole('option', { name: /^ESB, Ankara Esenboğa Havalimanı/ })
  await expect(esb).toBeVisible()
  await expect(input).toHaveAttribute('aria-expanded', 'true')
  await expect(input).toHaveAttribute('aria-controls', /.+/)
  // Hiçbir öneri kendiliğinden seçilmez.
  await expect(input).not.toHaveAttribute('aria-activedescendant', /.+/)

  await input.press('ArrowDown')
  const id = (await esb.getAttribute('id')) ?? ''
  expect(id).not.toBe('')
  await expect(input).toHaveAttribute('aria-activedescendant', id)
  await expect(esb).toHaveAttribute('aria-selected', 'true')
  await input.press('Enter')

  await expect(popup(page, 'LTAC')).toBeVisible({ timeout: 15_000 })
  await expectClosed(input)
  await expect(input).toHaveValue('esenboğa')
  // Adres değişmez: `?havalimani=` pencere açmayan giriş bağlantısıdır (D-079, D-103).
  expect(new URL(page.url()).searchParams.has('hex')).toBe(false)
  expect(new URL(page.url()).searchParams.has('havalimani')).toBe(false)

  // Pencere odaklıdır; Escape kapatır ve odak arama kutusuna döner (WCAG 2.4.3).
  await page.keyboard.press('Escape')
  await expect(popup(page)).toHaveCount(0)
  await expect(input).toBeFocused()
  // Harita Esenboğa'dadır: "Havalimanları" listesinin ilki ESB.
  await expect.poll(async () => (await airportListCodes(page))[0], { timeout: 15_000 }).toBe('ESB')
})

test('ad, şehir ve kodla arama; askerî üsler bulunmaz; Enter tam kodu açar, bulunamayanı söyler', async ({
  page,
}) => {
  await openMap(page)
  const input = searchInput(page)

  // Büyük-küçük harf ve Türkçe harfler yok sayılır: İstanbul Havalimanı, sonra Sabiha Gökçen.
  for (const query of ['istanbul', 'ISTANBUL', 'İstanbul']) {
    await input.fill(query)
    await expect(options(page).nth(0), query).toHaveAccessibleName(
      new RegExp(`^${PRIMARY_AIRPORT.iata}, `),
    )
    await expect(options(page).nth(1), query).toHaveAccessibleName(/^SAW, /)
  }

  await input.fill('izmir')
  await expect(option(page, 'ADB')).toBeVisible()
  await expect(options(page).filter({ hasText: 'LTBL' })).toHaveCount(0)

  // Askerî hava üsleri (D-107): kodu, adı ya da yeriyle hiçbir şey bulunmaz.
  for (const query of ['LTBL', 'IGL', 'Çiğli', 'İncirlik']) {
    await input.fill(query)
    await expect(input, query).toHaveAttribute('aria-expanded', 'false')
  }
  for (const base of MILITARY_AIRFIELDS) {
    for (const query of [base.icao, base.iata]) {
      await input.fill(query)
      await expect(input).toHaveValue(query)
      await expect(options(page).filter({ hasText: base.icao }), query).toHaveCount(0)
    }
  }

  // Uçak olamayan (Türkçe harfli) sorgu yalnız havalimanı arar; bulunamadı metni çıkar.
  await input.fill('Çiğli')
  await input.press('Enter')
  await expect(page.getByRole('search')).toContainText(AIRPORT_NOT_FOUND)
  await expect(popup(page)).toHaveCount(0)

  // Tam kod: uçak bulunmayınca havalimanı doğrudan açılır.
  await input.fill('esb')
  await expect(option(page, 'ESB')).toBeVisible()
  await input.press('Enter')
  await expect(popup(page, 'LTAC')).toBeVisible({ timeout: 15_000 })
  await input.fill('LTFM')
  await input.press('Enter')
  await expect(popup(page, PRIMARY_AIRPORT.icao)).toBeVisible({ timeout: 15_000 })

  // 3 harfle tek ad eşleşmesi Enter'da açılmaz: "THY" (havayolu kodu) Sfaks Thyna'yı, "gok" Sabiha
  // Gökçen'i yalnız listede gösterir ("açmak için seç"; uçak da bulunduysa "birini seç"); kullanıcı
  // seçer.
  for (const [query, code] of [
    ['THY', 'SFA'],
    ['gok', 'SAW'],
  ] as const) {
    await input.fill(query)
    await input.press('Enter')
    await expect(page.getByRole('search'), query).toContainText(/(birini|açmak için) seç\./)
    await expect(input, query).toHaveAttribute('aria-expanded', 'true')
    await expect(option(page, code), query).toBeVisible()
  }
  await expect(popup(page, 'DTTX')).toHaveCount(0)
  await expect(popup(page, 'LTFJ')).toHaveCount(0)

  // Yurt dışı: Türkçe adla.
  await input.fill('Atina')
  await expect(option(page, 'ATH')).toBeVisible()

  // "Ara" düğmesinden klavyeyle gönderim: liste açılınca odak kutuya döner, oklar ve Escape çalışır.
  await input.fill('istanbul')
  await input.press('Tab')
  await expect(page.getByRole('search').getByRole('button', { name: 'Ara' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(input).toHaveAttribute('aria-expanded', 'true')
  await expect(input).toBeFocused()
  await expect(option(page, PRIMARY_AIRPORT.iata)).toBeVisible()
  await input.press('ArrowDown')
  await expect(input).toHaveAttribute('aria-activedescendant', /.+/)
  await page.keyboard.press('Escape')
  await expectClosed(input)
})

test('/en: İngilizce ve Türkçe adla Atina bulunur', async ({ page }) => {
  await openMap(page, '/en')
  const input = searchInput(page)
  await input.fill('Athens')
  await expect(
    page.getByRole('option', { name: /^ATH, Athens Eleftherios Venizelos International Airport/ }),
  ).toBeVisible()
  await input.fill('Atina')
  await expect(option(page, 'ATH')).toBeVisible()
})

test('klavye: uçak araması eskisi gibi; Escape önce listeyi kapatır, açık pencere kalır', async ({
  page,
}) => {
  await openMap(page)
  const input = searchInput(page)

  // Rakamlı sorgu havalimanı adı aramaz: liste açılmaz; Enter uçağı seçer.
  await input.fill(REPLAY_AIRCRAFT.callsign)
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await input.press('Enter')
  await expect(infoCard(page)).toContainText(REPLAY_AIRCRAFT.callsign)

  // Tam kod + Enter: İstanbul Havalimanı'nın penceresi (uçak seçimi kapanır).
  await input.fill(PRIMARY_AIRPORT.iata)
  await expect(option(page, PRIMARY_AIRPORT.iata)).toBeVisible()
  await input.press('Enter')
  await expect(popup(page, PRIMARY_AIRPORT.icao)).toBeVisible({ timeout: 15_000 })
  await expect(infoCard(page)).toBeHidden()

  // Yukarı ok listeyi açar ve sonuncuyu etkinleştirir.
  await input.fill('ist')
  await expect(input).toHaveAttribute('aria-expanded', 'true')
  await input.press('ArrowUp')
  const last = options(page).last()
  const id = (await last.getAttribute('id')) ?? ''
  expect(id).not.toBe('')
  await expect(input).toHaveAttribute('aria-activedescendant', id)

  // Uzun listede (8 havalimanı) etkin seçenek listenin görünen alanında kalır: yukarı ok sonuncuya
  // gider ve liste kendi içinde kayar; aşağı ok başa sarar, liste başa döner.
  await input.fill('Türkiye')
  await expect(options(page)).toHaveCount(8)
  const overflow = await listbox(page).evaluate((list) => list.scrollHeight - list.clientHeight)
  expect(overflow).toBeGreaterThan(0)
  await input.press('ArrowUp')
  const lastOfEight = options(page).last()
  await expect(input).toHaveAttribute(
    'aria-activedescendant',
    (await lastOfEight.getAttribute('id')) ?? '',
  )
  await expectInsideList(page, lastOfEight)
  await input.press('ArrowDown')
  const first = options(page).first()
  await expect(input).toHaveAttribute(
    'aria-activedescendant',
    (await first.getAttribute('id')) ?? '',
  )
  await expectInsideList(page, first)
  await expect.poll(() => listbox(page).evaluate((list) => list.scrollTop)).toBe(0)

  // Escape listeyi kapatır, pencere açık kalır; ikinci Escape de kutunundur.
  await input.press('Escape')
  await expectClosed(input)
  await expect(popup(page, PRIMARY_AIRPORT.icao)).toBeVisible()
  await input.press('Escape')
  await expect(popup(page, PRIMARY_AIRPORT.icao)).toBeVisible()
})

test.describe('telefon genişliği', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

  test('375 px: liste ekranda, yatay taşmaz; seçmek pencereyi açar; dokunmada kutu odak almaz', async ({
    page,
  }) => {
    await openMap(page)
    const input = searchInput(page)
    await input.fill('esenboğa')
    const list = listbox(page)
    const esb = option(page, 'ESB')
    await expect(esb).toBeVisible()
    await expect(list).toBeInViewport({ ratio: 1 })
    const overflow = await list.evaluate((element) => element.scrollWidth - element.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    // Fareyle: pencere kapanınca odak kutuya döner (WCAG 2.4.3).
    await esb.click()
    await expect(page.locator('.live-map__popup')).toBeVisible({ timeout: 15_000 })
    await expect(popup(page, 'LTAC')).toBeVisible()
    await expectClosed(input)
    await popup(page, 'LTAC').getByRole('button', { name: 'Kapat' }).click()
    await expect(popup(page)).toHaveCount(0)
    await expect(input).toBeFocused()

    // Dokunarak: telefon klavyesi kapanır; pencere kapanınca kutu odak almaz (klavye yeniden
    // açılmaz), odak haritaya gider. Aynı metin yeniden yazılınca değişiklik olmaz: önce boşaltılır.
    await input.fill('')
    await input.fill('esenboğa')
    await esb.tap()
    await expect(popup(page, 'LTAC')).toBeVisible({ timeout: 15_000 })
    await expect(input).not.toBeFocused()
    await popup(page, 'LTAC').getByRole('button', { name: 'Kapat' }).tap()
    await expect(popup(page)).toHaveCount(0)
    await expect(input).not.toBeFocused()
  })
})
