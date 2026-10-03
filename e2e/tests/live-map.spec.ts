// Canlı harita (Parça 1 M6) kabul akışı: harita IST/LTFM merkezli açılır (D-079) → yaklaşmadaki
// replay uçağı tabloda görünür ve konumu değişir → satıra tıklayınca bilgi kartı açılır → arama
// (her yerdeki) uçağı bulur → /?hex= ile doğrudan açılış aynı uçağı seçer → etiket ayarı (uçaklar ve
// havalimanları, D-084) cihazda saklanır. Tablo, haritanın erişilebilir karşılığıdır; testler
// uçakları WebGL tuvalinden değil tablodan okur. Havalimanı kutuları etiket tuvalinin
// piksellerinden okunur (`e2e/label-canvas.ts`).
import { expect, test, type Locator, type Page } from '@playwright/test'
import { canvasChips, CODE_CHIP_MAX_WIDTH, mapCenter, paintedPixels } from '../label-canvas'
import {
  aircraftRow,
  airportListCodes,
  APPROACH_AIRCRAFT,
  declineAnalytics,
  FAR_AIRCRAFT,
  hexParam,
  infoCard,
  LABEL_SETTINGS_KEY,
  MISSING_CALLSIGN,
  MISSING_HEX,
  NOT_FOUND_TEXT,
  openMap,
  PRIMARY_AIRPORT,
  REPLAY_AIRCRAFT,
  TAXI_AIRCRAFT,
  waitForMap,
} from '../support'

const { hex, callsign } = REPLAY_AIRCRAFT
/** Açılış görünümünde (IST) hep görünen, havadaki uçak. */
const near = APPROACH_AIRCRAFT

test.beforeEach(async ({ context }) => {
  await declineAnalytics(context)
})

test('harita IST/LTFM merkezli açılır, atıflar görünür, replay uçağı tabloda konumunu günceller', async ({
  page,
}) => {
  await openMap(page)
  await expect(page.locator('.live-map__labels')).toBeAttached()
  // Açılış görünümü IST/LTFM merkezlidir (D-079): görünümdeki ilk havalimanı IST, LTFM'deki taksi
  // uçağı tabloda; Esenboğa–Van arasındaki seyir uçağı görünmez (Türkiye görünümü yok).
  expect((await airportListCodes(page))[0]).toBe(PRIMARY_AIRPORT.iata)
  await expect(aircraftRow(page, TAXI_AIRCRAFT.hex)).toBeVisible({ timeout: 30_000 })
  await expect(aircraftRow(page, FAR_AIRCRAFT.hex)).toHaveCount(0)

  const attribution = page.locator('.maplibregl-ctrl-attrib')
  await expect(attribution.getByRole('link', { name: 'ADSB.lol' })).toHaveAttribute(
    'href',
    'https://adsb.lol',
  )
  await expect(attribution.getByRole('link', { name: 'ODbL' })).toBeVisible()
  await expect(page.locator('.live-map__status')).toContainText('Veri yaşı')

  const row = aircraftRow(page, near.hex)
  await expect(row).toBeVisible({ timeout: 30_000 })
  // Konum sütunu en sondadır: "enlem, boylam", 3 ondalık (~100 m); uçak ~230 m/sn gider.
  const position = row.locator('td').last()
  await expect(position).toHaveText(/-?\d+[.,]\d{3}/)
  const first = (await position.textContent())?.trim()
  await expect
    .poll(async () => (await position.textContent())?.trim(), { timeout: 6_000, intervals: [500] })
    .not.toBe(first)
})

test('satıra tıklayınca bilgi kartı açılır; seçim adrese yazılır, kart kapanınca silinir', async ({
  page,
}) => {
  await openMap(page)
  const row = aircraftRow(page, near.hex)
  await expect(row).toBeVisible({ timeout: 30_000 })

  await row.locator('td').last().click()
  const card = infoCard(page)
  await expect(card).toBeVisible()
  await expect(card).toContainText(near.callsign)
  await expect(row).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(hexParam(near.hex))
  await expect(card.getByRole('button', { name: 'Uçağı ortala' })).toHaveAttribute(
    'aria-pressed',
    /^(true|false)$/,
  )

  await card.getByRole('button', { name: 'Kapat' }).click()
  await expect(card).toBeHidden()
  await expect(page).not.toHaveURL(/[?&]hex=/)
})

test('tablo satırı klavyeyle seçilebilir', async ({ page }) => {
  await openMap(page)
  const row = aircraftRow(page, near.hex)
  await expect(row).toBeVisible({ timeout: 30_000 })

  await row.getByRole('button').first().focus()
  await page.keyboard.press('Enter')
  await expect(infoCard(page)).toContainText(near.callsign)
})

test('arama çağrı kodunu bulur ve uçağı seçer', async ({ page }) => {
  await openMap(page)
  const search = page.getByRole('search')
  const input = search.getByRole('searchbox')
  await input.fill(callsign)
  await input.press('Enter')

  await expect(infoCard(page)).toContainText(callsign)
  await expect(page).toHaveURL(hexParam(hex))
})

test('bulunamayan uçak için açıklayıcı metin çıkar', async ({ page }) => {
  await openMap(page)
  const search = page.getByRole('search')
  const input = search.getByRole('searchbox')
  await input.fill(MISSING_CALLSIGN)
  await input.press('Enter')

  await expect(page.getByText(NOT_FOUND_TEXT)).toBeVisible()
  await expect(infoCard(page)).toBeHidden()
})

test('/?hex= ile doğrudan açılış aynı uçağı seçer', async ({ page }) => {
  await openMap(page, `/?hex=${hex}`)

  await expect(infoCard(page)).toContainText(callsign)
  await expect(aircraftRow(page, hex)).toHaveAttribute('aria-selected', 'true', {
    timeout: 30_000,
  })
  await expect(page).toHaveURL(hexParam(hex))
})

test('/?hex= ile açılan uçak canlı değilse arama alanında açıklayıcı metin çıkar', async ({
  page,
}) => {
  // Senaryoda olmayan, geçerli biçimli bir hex: arama ve ilk tam görüntüden sonraki ikinci arama
  // boş döner.
  await openMap(page, `/?hex=${MISSING_HEX}`)
  await expect(page.getByRole('search').getByText(NOT_FOUND_TEXT)).toBeVisible({
    timeout: 20_000,
  })
  await expect(infoCard(page)).toBeHidden()
})

test('etiket ayarı cihazda saklanır ve yeniden açılışta geri gelir; harita yine IST’de açılır', async ({
  page,
}) => {
  await openMap(page)
  const button = page.getByRole('button', { name: 'Etiketler' })
  await button.click()
  await expect(button).toHaveAttribute('aria-expanded', 'true')

  const others = page.getByRole('group', { name: 'Diğer uçaklar' })
  const selected = page.getByRole('group', { name: 'Seçili uçak' })
  await expect(others.getByRole('radio', { name: 'Tam' })).toBeChecked()
  await others.getByRole('radio', { name: 'Gizle' }).check()
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key)
        return raw === null ? null : (JSON.parse(raw) as unknown)
      }, LABEL_SETTINGS_KEY),
    )
    .toMatchObject({ selected: 'full', others: 'hidden' })

  await page.keyboard.press('Escape')
  await expect(button).toHaveAttribute('aria-expanded', 'false')

  await page.reload()
  await waitForMap(page)
  // Her yenilemede yine IST'de açılır (D-079).
  expect((await airportListCodes(page))[0]).toBe(PRIMARY_AIRPORT.iata)
  await button.click()
  await expect(others.getByRole('radio', { name: 'Gizle' })).toBeChecked()
  await expect(selected.getByRole('radio', { name: 'Tam' })).toBeChecked()
})

test('havalimanı etiketi Kod, Kod ve ad, Gizle; cihazda saklanır; kutu ve Gizle’de pin tıklanır (D-084)', async ({
  page,
}) => {
  // `?havalimani=LTFM` haritayı IST'de z10'da açar (ad z ≥ 7'de yazılır). Tek sayfa yüklemesi ve
  // bir yenileme: her yükleme bir WebSocket el sıkışmasıdır (`WS_RATE_LIMIT`).
  await page.goto(`/?havalimani=${PRIMARY_AIRPORT.icao}`)
  await waitForMap(page)
  await expect(aircraftRow(page, TAXI_AIRCRAFT.hex)).toHaveCount(1, { timeout: 30_000 })
  const button = page.getByRole('button', { name: 'Etiketler' })
  const airports = page.getByRole('group', { name: 'Havalimanları', exact: true })
  const others = page.getByRole('group', { name: 'Diğer uçaklar' })
  const mode = (name: string) => airports.getByRole('radio', { name, exact: true })
  const popup = page.locator(
    `.live-map [role="dialog"].map-popup[data-icao="${PRIMARY_AIRPORT.icao}"]`,
  )
  const stored = () =>
    page.evaluate((key) => {
      const raw = window.localStorage.getItem(key)
      return raw === null ? null : (JSON.parse(raw) as unknown)
    }, LABEL_SETTINGS_KEY)

  // Varsayılan Kod (kullanıcı kararı 2026-10-03): IST kutusunda yalnız kod; tıklanınca pencere.
  await button.click()
  await expect(mode('Kod')).toBeChecked()
  await page.keyboard.press('Escape')
  await clickPrimaryChip(page, popup, 'code')
  await page.keyboard.press('Escape')
  await expect(popup).toBeHidden()

  // Kod ve ad klavyeyle seçilir: ok tuşu yalnız kendi grubunda gezer, uçak grupları değişmez.
  await button.click()
  await mode('Kod').focus()
  await page.keyboard.press('ArrowRight')
  await expect(mode('Kod ve ad')).toBeChecked()
  await expect.poll(stored).toEqual({ selected: 'full', others: 'full', airports: 'name' })
  await page.keyboard.press('Escape')
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  // z10: IST kutusu kısa adı da yazar ("IST İstanbul", daha geniş); adın üstü de pencereyi açar.
  await clickPrimaryChip(page, popup, 'name')
  await page.keyboard.press('Escape')
  await expect(popup).toBeHidden()

  // Ayar yeniden açılışta geri gelir; harita yine IST'dedir.
  await page.reload()
  await waitForMap(page)
  await button.click()
  await expect(mode('Kod ve ad')).toBeChecked()
  await expect(others.getByRole('radio', { name: 'Tam' })).toBeChecked()

  // Gizle: kutu çizilmez, pin görünür ve tıklanır kalır. Diğer uçakların etiketi de gizlenir: tuvalde
  // hiçbir şey kalmaz ve pinin başını bir uçak etiketi örtmez (etiket tıklaması önce gelir, D-079).
  await mode('Gizle').check()
  await others.getByRole('radio', { name: 'Gizle' }).check()
  await expect.poll(stored).toEqual({ selected: 'full', others: 'hidden', airports: 'hidden' })
  await page.keyboard.press('Escape')
  await expect.poll(() => paintedPixels(page), { timeout: 10_000 }).toBe(0)
  // Pinin başı: ucu havalimanı merkezinde (harita ortası), baş ~13 px yukarıda.
  const center = await mapCenter(page)
  await expect(async () => {
    await page.mouse.click(center.x, center.y - 13)
    await expect(popup).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
  expect(await paintedPixels(page)).toBe(0)
})

/** Pinin başı ucunun (havalimanı merkezi) ~15 px yukarısındadır (airport-pin.ts). */
const PIN_HEAD_OFFSET_PX = 15

/**
 * IST kutusuna tıklar ve pencerenin açıldığını bekler. Kutu pin başına en yakın kutudur (Kod:
 * yalnız kod genişliğinde, kodun ortasına; Kod ve ad: daha geniş, adın sonuna tıklanır). Uçaklar
 * ilerledikçe kutu yer değiştirebileceği için tıklama pencere açılana kadar yinelenir.
 */
async function clickPrimaryChip(
  page: Page,
  popup: Locator,
  expected: 'code' | 'name',
): Promise<void> {
  await expect(async () => {
    const center = await mapCenter(page)
    const head = { x: center.x, y: center.y - PIN_HEAD_OFFSET_PX }
    const [chip] = await canvasChips(page, head)
    expect(chip, 'IST kutusu tuvalde çizili').toBeDefined()
    if (!chip) return
    // Kutu pin başının yanındadır (sağında, solunda, üstünde ya da noktanın altında; D-079).
    expect(Math.hypot(chip.x - head.x, chip.y - head.y)).toBeLessThanOrEqual(30 + chip.width / 2)
    if (expected === 'code') expect(chip.width).toBeLessThanOrEqual(CODE_CHIP_MAX_WIDTH)
    else expect(chip.width).toBeGreaterThan(CODE_CHIP_MAX_WIDTH + 20)
    const x = expected === 'code' ? chip.x : chip.x + chip.width / 2 - 6
    await page.mouse.click(x, chip.y)
    await expect(popup).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
}

test.describe('arama kutusunun ipucu kesilmez', () => {
  // İpucu (placeholder) kısa, erişilebilir ad tam metindir (packages/i18n → map.search).
  const COPY = {
    tr: { path: '/', name: 'Uçak ara: sefer no, çağrı kodu, tescil ya da hex' },
    en: { path: '/en', name: 'Search aircraft: flight number, callsign, registration or hex' },
  } as const

  for (const width of [1280, 375]) {
    for (const locale of ['tr', 'en'] as const) {
      test(`${width} px, ${locale}: ipucu kutuya sığar; erişilebilir ad tam`, async ({ page }) => {
        await page.setViewportSize({ width, height: 812 })
        await page.goto(COPY[locale].path)
        const input = page.getByRole('search').getByRole('searchbox')
        await expect(input).toBeVisible()
        await expect(input).toHaveAccessibleName(COPY[locale].name)
        const placeholder = (await input.getAttribute('placeholder')) ?? ''
        expect(placeholder.length).toBeGreaterThan(0)
        await page.evaluate(() => document.fonts.ready)
        // İpucu, ipucu ile aynı yazı tipindeki metin kutuya sığıyorsa sığar: aynı metin yazılır ve
        // kutunun kaydırma genişliği ölçülür (tarayıcının iç düzeni, temizle düğmesi yeri dahil).
        // M6d ilk sürümü: "…tescil ya da he" (1280) ve "…tescil ya" (375) kesiliyordu.
        await input.fill(placeholder)
        const overflow = await input.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        )
        expect(overflow, placeholder).toBeLessThanOrEqual(0)
        await input.fill('')
        await expect(input).toHaveAttribute('placeholder', placeholder)
      })
    }
  }
})

test.describe('telefon genişliği', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('sayfa yatay kaymaz; arama ve atıf erişilebilir; harita IST’de açılır', async ({ page }) => {
    await openMap(page)
    expect((await airportListCodes(page))[0]).toBe(PRIMARY_AIRPORT.iata)
    await expect(page.getByRole('search').getByRole('searchbox')).toBeVisible()
    await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test.describe('açık panel küçük telefonda arama kutusunun altına girmez (D-084)', () => {
  // 375×560: iPhone SE'nin Safari'deki görünür alanı; 320×480: en dar ve alçak telefon (başlık üç
  // satır); 812×340: yatay telefon. M6f'nin ilk hâlinde üç gruplu Etiketler paneli dikey telefonda
  // haritanın üstüne kadar uzuyor, başlığı ve "Seçili uçak" grubu arama kutusunun altında kalıyordu
  // (320 px'te seçenekler de tıklanmıyordu). Tek sayfa yüklemesi: her yükleme bir WebSocket el
  // sıkışmasıdır (`WS_RATE_LIMIT`).
  test.use({ viewport: { width: 375, height: 560 } })

  test('Etiketler ve Havalimanları panelinin başlığı, grupları ve her seçeneği tıklanır', async ({
    page,
  }) => {
    await openMap(page)
    for (const size of [
      { width: 375, height: 560 },
      { width: 320, height: 480 },
      { width: 812, height: 340 },
    ]) {
      await page.setViewportSize(size)
      for (const name of ['Etiketler', 'Havalimanları']) {
        const where = `${size.width}×${size.height} ${name}`
        const button = page.getByRole('button', { name, exact: true })
        await button.click()
        await expect(button).toHaveAttribute('aria-expanded', 'true')
        const panel = page.locator('.live-map__controls .map-labels__panel')
        await expect(panel).toBeVisible()
        // Yumuşak: bir boyuttaki hata ötekilerin ölçümünü durdurmaz, hepsi raporda görünür.
        expect
          .soft(await panelClearance(page), where)
          .toEqual({ belowMapTop: true, belowSearch: true })
        expect.soft(await unreachableParts(panel), where).toEqual([])
        await page.keyboard.press('Escape')
        await expect(button).toHaveAttribute('aria-expanded', 'false')
      }
    }
    // Gerçek tıklama: en alçak telefonda "Seçili uçak" grubunun seçeneği değişir.
    await page.setViewportSize({ width: 320, height: 480 })
    await page.getByRole('button', { name: 'Etiketler', exact: true }).click()
    const short = page.getByRole('group', { name: 'Seçili uçak' }).getByRole('radio', {
      name: 'Kısa',
    })
    await short.click()
    await expect(short).toBeChecked()
  })
})

/**
 * Açık panelin üst kenarı haritanın içinde (kesilmez) ve, yatayda örtüşüyorlarsa, arama kutusunun
 * altındadır.
 */
async function panelClearance(page: Page): Promise<{ belowMapTop: boolean; belowSearch: boolean }> {
  return page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect()
    const map = rect('.live-map')
    const search = rect('.live-map__search')
    const panel = rect('.live-map__controls .map-labels__panel')
    if (!map || !search || !panel) return { belowMapTop: false, belowSearch: false }
    const sideBySide = panel.left >= search.right || panel.right <= search.left
    return {
      belowMapTop: panel.top >= map.top,
      belowSearch: sideBySide || panel.top >= search.bottom,
    }
  })
}

/**
 * Paneldeki başlık, grup adları, seçenekler ve liste ögeleri sırayla panelin içinde kaydırılıp
 * görünür yapılır; ortalarındaki noktada tıklamayı alan öge kendileri (ya da içlerindeki) olmalıdır,
 * arama kutusu değil. Tıklanamayanlar döner. Harita kapsayıcısı kaymamalıdır.
 */
async function unreachableParts(panel: Locator): Promise<string[]> {
  return panel.evaluate((root) => {
    const failures: string[] = []
    const targets = root.querySelectorAll<HTMLElement>(
      '.map-labels__title, legend, .map-seg__option, .map-airports__item',
    )
    targets.forEach((target) => {
      target.scrollIntoView({ block: 'nearest' })
      const box = target.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      if (hit === null || !target.contains(hit)) {
        const by = hit?.closest('[class]')?.getAttribute('class') ?? 'yok'
        failures.push(`${target.textContent?.trim() ?? ''} → ${by}`)
      }
    })
    const map = root.closest('.live-map')
    if (map && map.scrollTop !== 0) failures.push(`harita kapsayıcısı kaydı ${map.scrollTop}`)
    const scrolled = document.scrollingElement?.scrollTop ?? 0
    if (scrolled !== 0) failures.push(`sayfa kaydı ${scrolled}`)
    root.scrollTop = 0
    return failures
  })
}
