// Canlı harita (Parça 1 M6) kabul akışı: harita IST/LTFM merkezli açılır (D-079) → yaklaşmadaki
// replay uçağı tabloda görünür ve konumu değişir → satıra tıklayınca bilgi kartı açılır → arama
// (her yerdeki) uçağı bulur → /?hex= ile doğrudan açılış aynı uçağı seçer → etiket ayarı cihazda
// saklanır. Tablo, haritanın erişilebilir karşılığıdır; testler uçakları WebGL tuvalinden değil
// tablodan okur.
import { expect, test } from '@playwright/test'
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
