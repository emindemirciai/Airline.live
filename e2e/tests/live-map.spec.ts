// Canlı harita (Parça 1 M6) kabul akışı: harita IST/LTFM merkezli açılır (D-079) → yaklaşmadaki
// replay uçağı tabloda görünür ve yüksekliği değişir → liste sağ üsttedir; sütunlar, tahmini
// durumlar ve daraltmanın saklanması (D-085) → satıra tıklayınca bilgi kartı solda açılır, tablette
// seçili uçağın etiketi ve simgesi listenin altında kalmaz → arama (her yerdeki) uçağı bulur →
// /?hex= ile doğrudan açılış aynı uçağı seçer → etiket ayarı (uçaklar ve havalimanları, D-084)
// cihazda saklanır. Tablo, haritanın erişilebilir karşılığıdır; testler uçakları WebGL tuvalinden
// değil tablodan okur. Havalimanı kutuları ve seçili etiket etiket tuvalinin piksellerinden okunur
// (`e2e/label-canvas.ts`).
import { expect, test, type Locator, type Page } from '@playwright/test'
import { canvasChips, mapCenter, paintedPixels, selectedLabelPixels } from '../label-canvas'
import {
  AIRCRAFT_LIST_KEY,
  aircraftRow,
  aircraftTable,
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

test('harita IST/LTFM merkezli açılır, atıflar görünür, replay uçağı tabloda yüksekliğini günceller', async ({
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
  // Sütunlar Sefer, Kuyruk, Yükseklik, Konum ve durum (D-085). Yaklaşmadaki uçak ~15 ft/sn alçalır,
  // yükseklik 25 ft adımla ~1,7 sn'de bir değişir; konum IST'ye göre yazılır.
  const altitude = row.locator('td').nth(1)
  await expect(altitude).toHaveText(/\d/)
  await expect(row.locator('td.map-table__place')).toContainText('IST')
  const first = (await altitude.textContent())?.trim()
  await expect
    .poll(async () => (await altitude.textContent())?.trim(), { timeout: 6_000, intervals: [500] })
    .not.toBe(first)
})

test('uçak listesi sağ üstte; Sefer, Kuyruk, Yükseklik, Konum ve durum; durumlar; daraltma cihazda saklanır (1280, D-085)', async ({
  page,
}) => {
  // İki sayfa yüklemesi (açılış ve yenileme): her yükleme bir WebSocket el sıkışmasıdır.
  await openMap(page)
  const table = aircraftTable(page)
  const taxi = aircraftRow(page, TAXI_AIRCRAFT.hex)
  const approach = aircraftRow(page, APPROACH_AIRCRAFT.hex)
  await expect(taxi).toBeVisible({ timeout: 30_000 })
  await expect(approach).toBeVisible({ timeout: 30_000 })

  // Dört sütun; "Kuyruk"un erişilebilir adı "Kuyruk tescili"dir. Tip ve Hız listede yoktur.
  await expect(table.locator('thead th')).toHaveCount(4)
  for (const name of ['Sefer', 'Kuyruk tescili', 'Yükseklik', 'Konum ve durum']) {
    await expect(table.getByRole('columnheader', { name, exact: true })).toHaveCount(1)
  }
  await expect(table.getByRole('columnheader', { name: 'Tip', exact: true })).toHaveCount(0)
  await expect(table.getByRole('columnheader', { name: 'Hız', exact: true })).toHaveCount(0)

  // HYS092 LTFM'de taksi yapar: "Yerde", IST; kuyruk tescili görünür.
  await expect(taxi.locator('td').first()).toHaveText('TC-SYN92')
  const taxiPlace = taxi.locator('td.map-table__place')
  await expect(taxiPlace).toHaveAttribute('data-phase', 'onGround', { timeout: 15_000 })
  await expect(taxiPlace.locator('.map-table__phase')).toHaveText('Yerde')
  await expect(taxiPlace).toContainText('IST')
  // HYS091 35L'ye son yaklaşmadadır: duvar saatine göre "Yaklaşmada" ya da "İnişte", hep IST.
  const approachPlace = approach.locator('td.map-table__place')
  await expect(approachPlace).toHaveAttribute('data-phase', /^(approaching|landing)$/, {
    timeout: 15_000,
  })
  await expect(approachPlace.locator('.map-table__phase')).toHaveText(/^(Yaklaşmada|İnişte)$/)
  await expect(approachPlace).toContainText('IST')
  // Seyirdeki uçaklar (35.000 ft) yoldadır: rozet yok, yalnızca konum.
  const cruise = await table
    .locator('tbody tr[data-hex^="ff000"] td.map-table__place')
    .evaluateAll((cells) =>
      cells.map((cell) => ({
        phase: cell.getAttribute('data-phase'),
        badge: cell.querySelector('.map-table__phase') !== null,
      })),
    )
  for (const cell of cruise) expect(cell).toEqual({ phase: 'enRoute', badge: false })

  // Yer: haritanın sağ üstünde 12 px kenarla; alt kenarı haritanın ortasının en az 12 px üstünde;
  // arama, durum şeridi, sağ alttaki düğmeler ve atıfla çakışmaz.
  const layout = await listLayout(page)
  expect(layout).not.toBeNull()
  if (!layout) return
  const { map, list } = layout
  expect(Math.abs(list.top - map.top - 12)).toBeLessThanOrEqual(2)
  expect(Math.abs(map.right - list.right - 12)).toBeLessThanOrEqual(2)
  expect(list.bottom - map.top).toBeLessThanOrEqual(map.height / 2 - 12 + 1)
  expect(layout.overlaps).toEqual([])

  // Daraltma: tablo gizlenir, hâl cihazda saklanır ve yenilemede kalır; açınca yeniden yazılır.
  const toggle = page.locator('.live-map__table .map-table__toggle')
  const stored = () => page.evaluate((key) => window.localStorage.getItem(key), AIRCRAFT_LIST_KEY)
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(toggle).toHaveAccessibleName('Uçak listesini gizle')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toHaveAccessibleName('Uçak listesini göster')
  await expect(table).toBeHidden()
  await expect.poll(stored).toBe('closed')
  // Daraltılmış liste yalnızca başlık düğmesidir: sağ üstte kalır, eskisinden dardır.
  const collapsed = await listLayout(page)
  expect(collapsed?.list.width ?? Infinity).toBeLessThan(list.width)
  expect(
    Math.abs((collapsed?.map.right ?? 0) - (collapsed?.list.right ?? 0) - 12),
  ).toBeLessThanOrEqual(2)

  await page.reload()
  await waitForMap(page)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(table).toBeHidden()
  expect(await stored()).toBe('closed')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(table).toBeVisible()
  await expect.poll(stored).toBe('open')
})

test('havalimanı penceresi uçak listesinin altında kalmaz (1280, D-085)', async ({ page }) => {
  // IST haritanın ortasındadır; pencerenin olağan yeri (sağ) sağ üstteki listeyi örterdi.
  await page.goto(`/?havalimani=${PRIMARY_AIRPORT.icao}`)
  await waitForMap(page)
  const toggle = page.getByRole('button', { name: 'Havalimanları', exact: true })
  const item = page.getByRole('button', { name: new RegExp(`^${PRIMARY_AIRPORT.iata}\\b`) })
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click()
    await toggle.click()
    await item.click({ timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
  const popup = page.locator(
    `.live-map [role="dialog"].map-popup[data-icao="${PRIMARY_AIRPORT.icao}"]`,
  )
  await expect(popup).toBeVisible()
  await expect(popup).toHaveAttribute('data-placed', 'true')
  await expect(page.locator('.live-map__table .map-table__toggle')).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  // Harita IST'ye uçarken pencere de kayar; yerleşince listeyle çakışmaz (hangi yan seçilirse
  // seçilsin geçerli: sağ yan listeyi örterdi, sol yan örtmez).
  await expect
    .poll(
      () =>
        popup.evaluate((element) => {
          const box = element.getBoundingClientRect()
          const list = document.querySelector('.live-map__table')?.getBoundingClientRect()
          if (!list) return 'liste yok'
          const overlaps =
            box.left < list.right &&
            list.left < box.right &&
            box.top < list.bottom &&
            list.top < box.bottom
          return overlaps ? `çakışıyor (${element.getAttribute('data-side') ?? '?'})` : 'ayrı'
        }),
      { timeout: 10_000 },
    )
    .toBe('ayrı')
})

test('satıra tıklayınca bilgi kartı açılır; tablette seçili uçak listenin altında kalmaz; seçim adrese yazılır, kart kapanınca silinir (D-085)', async ({
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
  // Kart solda, aramanın altındadır (D-085); sağ üstteki liste açık kalır ve kartla çakışmaz.
  const cardBox = await card.boundingBox()
  const searchBox = await page.locator('.live-map__search').boundingBox()
  const listBox = await page.locator('.live-map__table').boundingBox()
  expect(cardBox && searchBox && listBox).toBeTruthy()
  if (cardBox && searchBox && listBox) {
    expect(cardBox.x).toBeLessThan(400)
    expect(cardBox.y).toBeGreaterThanOrEqual(searchBox.y + searchBox.height)
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(listBox.x)
  }

  // Tablet genişliğinde (D-085): satıra tıklamak uçağı ortalar (768 px'te kartın sağındaki bölgenin
  // ortasına) ve 768–1180 px'te liste o sütuna uzanır. Seçili etiket listenin altında kalmaz, başka
  // konuma geçer; 960 px'in altında liste dolu olsa da ortalanan simgenin (52 px) üstünde biter.
  // Aynı sayfada boyut değişir (yeni WebSocket el sıkışması yok). Replay'de satır azdır: liste dolu
  // (50 satır) gibi en yüksek boyuna zorlanır; kapsayıcısı `max-height` ile sınırlıdır.
  const fillList = (minHeight: string) =>
    page.locator('.live-map__table .map-table').evaluate((element, value) => {
      ;(element as HTMLElement).style.minHeight = value
    }, minHeight)
  await fillList('200vh')
  for (const size of [
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(size)
    await expect
      .poll(
        async () => {
          const { total, under } = await selectedLabelPixels(page, '.live-map__table')
          return total === 0 ? 'etiket yok' : `${under} piksel listenin altında`
        },
        { timeout: 10_000 },
      )
      .toBe('0 piksel listenin altında')
    const centre = await mapCenter(page)
    const list = await page.locator('.live-map__table').boundingBox()
    expect(list).not.toBeNull()
    if (!list) continue
    if (size.width === 1024) {
      // Kart haritanın ortasına uzanmaz (pay yok): simge listenin solunda kalır.
      expect(list.x).toBeGreaterThanOrEqual(centre.x + 26)
    } else {
      // Liste ortadaki sütunu kaplar: alt kenarı ortalanan simgenin üstünde biter.
      expect(list.y + list.height).toBeLessThanOrEqual(centre.y - 26)
    }
  }
  await fillList('')
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

test('havalimanı etiketi Kod ya da Gizle; cihazda saklanır; Kod’da kutu, Gizle’de pin tıklanır (D-084)', async ({
  page,
}) => {
  // `?havalimani=LTFM` haritayı IST'de z10'da açar. Tek sayfa yüklemesi ve bir yenileme: her
  // yükleme bir WebSocket el sıkışmasıdır (`WS_RATE_LIMIT`).
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

  // Yalnız iki seçenek: "Kod ve ad" 2026-10-04'te kaldırıldı (ad havalimanı penceresindedir).
  // Varsayılan Kod (kullanıcı kararı 2026-10-03): z10'da da IST kutusunda yalnız kod; tıklanınca
  // pencere.
  await button.click()
  await expect(airports.getByRole('radio')).toHaveCount(2)
  await expect(mode('Gizle')).not.toBeChecked()
  await expect(mode('Kod')).toBeChecked()
  await page.keyboard.press('Escape')
  await clickPrimaryChip(page, popup)
  await page.keyboard.press('Escape')
  await expect(popup).toBeHidden()

  // Gizle klavyeyle seçilir: ok tuşu yalnız kendi grubunda gezer, uçak grupları değişmez.
  await button.click()
  await mode('Kod').focus()
  await page.keyboard.press('ArrowLeft')
  await expect(mode('Gizle')).toBeChecked()
  await expect(others.getByRole('radio', { name: 'Tam' })).toBeChecked()
  await expect.poll(stored).toEqual({ selected: 'full', others: 'full', airports: 'hidden' })
  await page.keyboard.press('Escape')
  await expect(button).toHaveAttribute('aria-expanded', 'false')

  // Ayar yeniden açılışta geri gelir; harita yine IST'dedir.
  await page.reload()
  await waitForMap(page)
  await button.click()
  await expect(mode('Gizle')).toBeChecked()
  await expect(others.getByRole('radio', { name: 'Tam' })).toBeChecked()

  // Gizle: kutu çizilmez, pin görünür ve tıklanır kalır. Diğer uçakların etiketi de gizlenir: tuvalde
  // hiçbir şey kalmaz ve pinin başını bir uçak etiketi örtmez (etiket tıklaması önce gelir, D-079).
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
 * IST kutusunun ortasına tıklar ve pencerenin açıldığını bekler. Kutu pin başına en yakın kod
 * kutusudur (`canvasChips`: yalnız kod genişliğinde). Uçaklar ilerledikçe kutu yer değiştirebileceği
 * için tıklama pencere açılana kadar yinelenir.
 */
async function clickPrimaryChip(page: Page, popup: Locator): Promise<void> {
  await expect(async () => {
    const center = await mapCenter(page)
    const head = { x: center.x, y: center.y - PIN_HEAD_OFFSET_PX }
    const [chip] = await canvasChips(page, head)
    expect(chip, 'IST kutusu tuvalde çizili').toBeDefined()
    if (!chip) return
    // Kutu pin başının yanındadır (sağında, solunda, üstünde ya da noktanın altında; D-079).
    expect(Math.hypot(chip.x - head.x, chip.y - head.y)).toBeLessThanOrEqual(30 + chip.width / 2)
    await page.mouse.click(chip.x, chip.y)
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

  test('sayfa yatay kaymaz; arama ve atıf erişilebilir; harita IST’de açılır; uçak listesi sol altta, kapalı başlar', async ({
    page,
  }) => {
    await openMap(page)
    expect((await airportListCodes(page))[0]).toBe(PRIMARY_AIRPORT.iata)
    await expect(page.getByRole('search').getByRole('searchbox')).toBeVisible()
    await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    // Telefonda liste sol alttaki düğmeyle açılır ve her açılışta kapalı başlar (D-085).
    const toggle = page.getByRole('button', { name: 'Uçak listesini göster' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(aircraftTable(page)).toBeHidden()
    await toggle.click()
    const hide = page.getByRole('button', { name: 'Uçak listesini gizle' })
    await expect(hide).toHaveAttribute('aria-expanded', 'true')
    await expect(aircraftRow(page, TAXI_AIRCRAFT.hex)).toBeVisible({ timeout: 30_000 })
    await expect(aircraftTable(page).locator('thead th')).toHaveCount(4)
    // Liste atıf satırının üstündedir; dört sütun yana kaymadan sığar (konum sütunu kırılır).
    const fit = await page.evaluate(() => {
      const list = document.querySelector('.live-map__table')?.getBoundingClientRect()
      const attrib = document.querySelector('.maplibregl-ctrl-attrib')?.getBoundingClientRect()
      const body = document.querySelector('.live-map__table .map-table__body')
      return {
        aboveAttribution: list && attrib ? list.bottom <= attrib.top + 1 : false,
        bodyOverflow: body ? body.scrollWidth - body.clientWidth : Infinity,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })
    expect(fit).toEqual({ aboveAttribution: true, bodyOverflow: 0, pageOverflow: 0 })
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

interface Box {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

/**
 * Uçak listesinin (`.live-map__table`) ve haritanın kutusu, CSS px; listeyle çakışan paneller (arama,
 * durum şeridi, sağ alttaki düğmeler, atıf). Boş (sıfır boyutlu) panel çakışmaz.
 */
async function listLayout(page: Page): Promise<{ map: Box; list: Box; overlaps: string[] } | null> {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const r = document.querySelector(selector)?.getBoundingClientRect()
      return r
        ? {
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            left: r.left,
            width: r.width,
            height: r.height,
          }
        : null
    }
    const map = box('.live-map')
    const list = box('.live-map__table')
    if (!map || !list) return null
    const overlaps = [
      '.live-map__search',
      '.live-map__status',
      '.live-map__controls',
      '.maplibregl-ctrl-attrib',
    ].filter((selector) => {
      const other = box(selector)
      return (
        other !== null &&
        other.width > 0 &&
        other.height > 0 &&
        list.left < other.right &&
        other.left < list.right &&
        list.top < other.bottom &&
        other.top < list.bottom
      )
    })
    return { map, list, overlaps }
  })
}
