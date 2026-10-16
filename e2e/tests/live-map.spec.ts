// Canlı harita (Parça 1 M6) kabul akışı: harita IST/LTFM merkezli açılır (D-079) → yaklaşmadaki
// replay uçağı tabloda görünür ve yüksekliği değişir → liste sağ üsttedir; sütunlar, tahmini
// durumlar ve daraltmanın saklanması (D-085) → satıra tıklayınca bilgi kartı solda açılır, tablette
// seçili uçağın etiketi ve simgesi listenin altında kalmaz → arama (her yerdeki) uçağı bulur →
// /?hex= ile doğrudan açılış aynı uçağı seçer → etiket ayarı (uçaklar, havalimanları ve ülke adları,
// D-084, D-095) cihazda saklanır → havalimanları Gizle / Simge / Simge ve kod; Gizle'de pin ve kod
// yok, açık pencerenin ve `?havalimani=` hedefinin pini çizilir, eski kayıt Simge okunur (D-114) →
// askerî hava üslerinin pini, kodu ve liste satırı yoktur,
// `?havalimani=<üs>` bilinmeyen kod gibidir (D-103, D-107) → ülke adları uzaklaşınca sınırlarının
// içinde, pinlerden uzak boş yerde yazılır (D-096, D-099), havalimanı olmayan ülkeler de (D-100),
// yakınlaşınca silinir. Tablo, haritanın erişilebilir karşılığıdır; testler uçakları WebGL
// tuvalinden değil tablodan okur. Havalimanı kutuları ve seçili etiket etiket tuvalinin
// piksellerinden okunur (`e2e/label-canvas.ts`); ülke adları haritanın `data-country-labels`
// niteliğinden ve WebGL tuvalinin ekran görüntüsünden (`e2e/map-pixels.ts`).
import { expect, test, type Locator, type Page } from '@playwright/test'
import { IKA_PIN_Z5, IRAN_Z5_BOX, TEHRAN_COUNTRY_LABELS } from '../country-label-expectations'
import {
  canvasChips,
  mapCenter,
  paintedPixels,
  paintedPixelsIn,
  selectedLabelPixels,
} from '../label-canvas'
import { changedPixels, clipImage, pinPixels } from '../map-pixels'
import {
  AIRCRAFT_LIST_KEY,
  aircraftRow,
  aircraftTable,
  airportListCodes,
  APP_NAME,
  APP_NAME_PATTERN,
  APPROACH_AIRCRAFT,
  countryLabels,
  declineAnalytics,
  FAR_AIRCRAFT,
  hexParam,
  infoCard,
  LABEL_SETTINGS_KEY,
  MILITARY_AIRFIELD,
  MILITARY_AIRFIELD_NEIGHBOUR,
  MISSING_CALLSIGN,
  MISSING_HEX,
  NOT_FOUND_TEXT,
  openMap,
  PRIMARY_AIRPORT,
  REPLAY_AIRCRAFT,
  searchInput,
  TAXI_AIRCRAFT,
  waitForMap,
  WEB_URL,
  zoomIn,
  zoomOut,
} from '../support'

const { hex, callsign } = REPLAY_AIRCRAFT
/** Açılış görünümünde (IST) hep görünen, havadaki uçak. */
const near = APPROACH_AIRCRAFT

test.beforeEach(async ({ context }) => {
  await declineAnalytics(context)
})

test('harita IST/LTFM merkezli açılır, atıflar görünür, replay uçağı tabloda yüksekliğini günceller', async ({
  page,
  request,
}) => {
  // Yerel test stilinde ülke sınırı yoktur (D-092): sınır kaynağı (OpenFreeMap TileJSON'u ve
  // karoları) hiç istenmez, şeritte OpenStreetMap atfı çıkmaz. Harita sayfasının bütün istekleri
  // toplanır.
  const requested: string[] = []
  page.on('request', (sent) => requested.push(sent.url()))
  await openMap(page)
  await expect(page.locator('.live-map__labels')).toBeAttached()
  // Açılış görünümü IST/LTFM merkezlidir (D-079): görünümdeki ilk havalimanı IST, LTFM'deki taksi
  // uçağı tabloda; Esenboğa–Van arasındaki seyir uçağı görünmez (Türkiye görünümü yok).
  expect((await airportListCodes(page))[0]).toBe(PRIMARY_AIRPORT.iata)
  await expect(aircraftRow(page, TAXI_AIRCRAFT.hex)).toBeVisible({ timeout: 30_000 })
  await expect(aircraftRow(page, FAR_AIRCRAFT.hex)).toHaveCount(0)
  // Açılış görünümünde (masaüstünde z8, D-104) ülke adı yoktur (D-095): adlar z8'de biter (katmanın
  // `maxzoom`'u 8); yazı tipi indirilmez.
  await expect(page.locator('.live-map .live-map__canvas')).toHaveAttribute(
    'data-country-labels',
    '',
  )
  expect(requested.filter((url) => new URL(url).pathname.startsWith('/fonts/'))).toEqual([])

  const attribution = page.locator('.maplibregl-ctrl-attrib')
  await expect(attribution.getByRole('link', { name: 'ADSB.lol' })).toHaveAttribute(
    'href',
    'https://adsb.lol',
  )
  await expect(attribution.getByRole('link', { name: 'ODbL' })).toBeVisible()
  // Şerit sitenin kendi künyesiyle başlar (D-089): "Airline.live v<sürüm>", sürüm alt bilgidekiyle ve
  // /api/version'dakiyle aynıdır; bağlantı Yenilikler sayfasına gider. Zorunlu atıflar yerinde kalır.
  const { version } = (await (await request.get('/api/version')).json()) as { version: string }
  const credit = `${APP_NAME} v${version}`
  await expect(attribution).toHaveText(
    new RegExp(`^${credit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\| `),
  )
  await expect(attribution).toContainText('Canlı uçuş verisi: ADSB.lol — ODbL 1.0 · Koşullar')
  const creditLink = attribution.getByRole('link').first()
  await expect(creditLink).toHaveAccessibleName(`${credit}, yenilikler`)
  await expect(creditLink).toHaveText(credit)
  await expect(creditLink).toHaveAttribute('href', '/yenilikler')
  await expect(page.locator('.live-map__status')).toContainText('Veri yaşı')
  // Yerel test stili (D-092): stil yerelden geldi; sınır kaynağı, vektör karo ya da OpenFreeMap
  // isteği yok; atıfta OpenStreetMap/OpenMapTiles yok.
  expect(requested.some((url) => new URL(url).pathname === '/test-style.json')).toBe(true)
  const borderRequests = requested.filter((url) => {
    const { hostname, pathname } = new URL(url)
    return (
      hostname.endsWith('openfreemap.org') ||
      pathname.endsWith('.pbf') ||
      pathname.endsWith('.mvt') ||
      pathname === '/planet' ||
      pathname.startsWith('/planet/')
    )
  })
  expect(borderRequests).toEqual([])
  await expect(attribution).not.toContainText('OpenStreetMap')
  await expect(attribution).not.toContainText('OpenMapTiles')

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
  const input = searchInput(page)
  await input.fill(callsign)
  await input.press('Enter')

  await expect(infoCard(page)).toContainText(callsign)
  await expect(page).toHaveURL(hexParam(hex))
})

test('bulunamayan uçak için açıklayıcı metin çıkar', async ({ page }) => {
  await openMap(page)
  const input = searchInput(page)
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
  const countries = page.getByRole('group', { name: 'Ülke adları' })
  await expect(others.getByRole('radio', { name: 'Tam' })).toBeChecked()
  await others.getByRole('radio', { name: 'Gizle' }).check()
  // Ülke adları (D-095): varsayılan Göster; Gizle de aynı kayıtta saklanır.
  await expect(countries.getByRole('radio', { name: 'Göster' })).toBeChecked()
  await countries.getByRole('radio', { name: 'Gizle' }).check()
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key)
        return raw === null ? null : (JSON.parse(raw) as unknown)
      }, LABEL_SETTINGS_KEY),
    )
    .toMatchObject({ selected: 'full', others: 'hidden', countries: 'hidden' })

  await page.keyboard.press('Escape')
  await expect(button).toHaveAttribute('aria-expanded', 'false')

  await page.reload()
  await waitForMap(page)
  // Her yenilemede yine IST'de açılır (D-079).
  expect((await airportListCodes(page))[0]).toBe(PRIMARY_AIRPORT.iata)
  await button.click()
  await expect(others.getByRole('radio', { name: 'Gizle' })).toBeChecked()
  await expect(selected.getByRole('radio', { name: 'Tam' })).toBeChecked()
  await expect(countries.getByRole('radio', { name: 'Gizle' })).toBeChecked()
})

test('havalimanları Simge ve kod ya da Simge; cihazda saklanır; Simge ve kod’da kutu, Simge’de pin tıklanır (D-084, D-114)', async ({
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
  const selected = page.getByRole('group', { name: 'Seçili uçak' })
  const mode = (name: string) => airports.getByRole('radio', { name, exact: true })
  const popup = page.locator(
    `.live-map [role="dialog"].map-popup[data-icao="${PRIMARY_AIRPORT.icao}"]`,
  )
  const stored = () =>
    page.evaluate((key) => {
      const raw = window.localStorage.getItem(key)
      return raw === null ? null : (JSON.parse(raw) as unknown)
    }, LABEL_SETTINGS_KEY)

  // Pinler ve kodları tek satırda üç seçenek (D-114; "Kod ve ad" 2026-10-04'te kaldırıldı, ad
  // havalimanı penceresindedir). Varsayılan Simge ve kod (D-084'ün Kod'u, kullanıcı kararı
  // 2026-10-03): z10'da da IST kutusunda yalnız kod; tıklanınca pencere.
  await button.click()
  await expect(airports.getByRole('radio')).toHaveCount(3)
  await expect(mode('Gizle')).not.toBeChecked()
  await expect(mode('Simge')).not.toBeChecked()
  await expect(mode('Simge ve kod')).toBeChecked()
  await page.keyboard.press('Escape')
  await clickPrimaryChip(page, popup)
  await page.keyboard.press('Escape')
  await expect(popup).toBeHidden()

  // Simge (D-084'ün eski Gizle'si) klavyeyle seçilir: ok tuşu yalnız kendi grubunda gezer, uçak
  // grupları değişmez. Kayıt yeni biçimdedir (`airportDisplay`); yanında eski sürümler için
  // türetilmiş `airports` yazılır (Simge → `'hidden'`, eski Gizle'nin kodsuz pini; D-114).
  await button.click()
  await mode('Simge ve kod').focus()
  await page.keyboard.press('ArrowLeft')
  await expect(mode('Simge')).toBeChecked()
  await expect(others.getByRole('radio', { name: 'Tam' })).toBeChecked()
  await expect.poll(stored).toEqual({
    selected: 'full',
    others: 'full',
    airportDisplay: 'icon',
    countries: 'shown',
    airports: 'hidden',
  })
  await page.keyboard.press('Escape')
  await expect(button).toHaveAttribute('aria-expanded', 'false')

  // Ayar yeniden açılışta geri gelir; harita yine IST'dedir.
  await page.reload()
  await waitForMap(page)
  await button.click()
  await expect(mode('Simge')).toBeChecked()
  await expect(others.getByRole('radio', { name: 'Tam' })).toBeChecked()

  // Simge: kutu çizilmez, pin görünür ve tıklanır kalır. Seçili ve diğer uçakların etiketi de
  // gizlenir: tuvalde hiçbir şey kalmaz ve pinin başını bir uçak etiketi örtmez (etiket tıklaması
  // önce gelir, D-079). Seçili uçak da gizlenir: önceki tıklama yerdeki uçağı seçmişse adres
  // `?hex=` taşır ve yenilemede seçim geri gelir; o uçağın etiketi tuvali boyardı (CI'da bir kez
  // 8.448 piksel, v0.17.0 PR'ı).
  await others.getByRole('radio', { name: 'Gizle' }).check()
  await selected.getByRole('radio', { name: 'Gizle' }).check()
  await expect.poll(stored).toEqual({
    selected: 'hidden',
    others: 'hidden',
    airportDisplay: 'icon',
    countries: 'shown',
    airports: 'hidden',
  })
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
  // Açılınca odak pencereye geçer (airport-popup.tsx); Escape onu ancak o zaman kapatır. Yük
  // altında odak görünürlükten sonra gelebilir: hemen basılan Escape boşa giderdi.
  await expect
    .poll(() => popup.evaluate((el) => el.contains(document.activeElement)), { timeout: 5_000 })
    .toBe(true)
}

/**
 * Havalimanları ayarının pikselleri Sabiha Gökçen'de okunur: replay'de orada yerde uçak yoktur
 * (seyir uçakları dönüşte birkaç saniye üstünden geçer; bekleyen denetimler yinelenir). IST'nin
 * pininin üstünden replay'in taksi uçağı (`TAXI_AIRCRAFT`) sürekli geçer: IST yalnız DOM'dan
 * (pencere, liste) ve etiket tuvalinden (kod yok) denetlenir.
 */
const SAW = { icao: 'LTFJ', iata: 'SAW', lat: 40.898602, lon: 29.3092 } as const

/**
 * Açılış görünümünün ortası (`PRIMARY_AIRPORT_VIEW`, apps/web camera.ts; e2e uygulamayı import
 * etmez). 1280×720'de açılış z8'dir ve kart açık değilken harita ortası tuvalin ortasıdır.
 */
const OPENING_VIEW = { lat: 41.2753, lon: 28.7519 } as const
const OPENING_ZOOM = 8

/**
 * Ayar haritaya geçsin: pin kaynağının `setData`'sı MapLibre'nin worker'ında eşzamansızdır (veri
 * yükleme, karo yenileme, ardından çizim); iki animasyon karesi yetmez. Değişmemesi beklenen çizim
 * (pin kalır) bu beklemeden sonra denetlenir, yoksa ayardan önceki kare de geçerdi.
 */
async function settleMap(page: Page, ms = 1_000): Promise<void> {
  await page.evaluate(
    (delay) =>
      new Promise<void>((resolve) =>
        setTimeout(
          () => requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          delay,
        ),
      ),
    ms,
  )
}

test.describe('havalimanları Gizle / Simge / Simge ve kod (D-114)', () => {
  // MapLibre `prefers-reduced-motion`'da kamera geçişlerini anında yapar: aramadan ya da
  // `?havalimani=` ile havalimanına gidince pinin ucu hemen harita ortasındadır.
  test.use({ reducedMotion: 'reduce' })

  const stored = (page: Page) =>
    page.evaluate((key) => {
      const raw = window.localStorage.getItem(key)
      return raw === null ? null : (JSON.parse(raw) as unknown)
    }, LABEL_SETTINGS_KEY)

  /** Haritanın ortasındaki havalimanının pini ve kodu (pin başının yanındaki kutu). */
  const centred = async (page: Page) => {
    const tip = await mapCenter(page)
    const head = { x: tip.x, y: tip.y - PIN_HEAD_OFFSET_PX }
    return {
      tip,
      head,
      pinRed: async () => (await pinPixels(page, tip)).red,
      chip: async () =>
        (await canvasChips(page, head)).find(
          (chip) => Math.hypot(chip.x - head.x, chip.y - head.y) <= 30 + chip.width / 2,
        ),
    }
  }

  test('Gizle: pin ve kod çizilmez, tıklanmaz, yenilemede kalır; liste ve arama pencereyi açar, pencere açıkken pini çizilir; Simge pinleri kodsuz, Simge ve kod kodlarıyla getirir', async ({
    page,
  }) => {
    // İki sayfa yüklemesi (her biri bir WebSocket el sıkışması, `WS_RATE_LIMIT`); adım çok.
    test.setTimeout(150_000)
    await openMap(page)
    const button = page.getByRole('button', { name: 'Etiketler', exact: true })
    const airports = page.getByRole('group', { name: 'Havalimanları', exact: true })
    const mode = (name: string) => airports.getByRole('radio', { name, exact: true })
    const sawPopup = page.locator(`.live-map [role="dialog"].map-popup[data-icao="${SAW.icao}"]`)
    const istPopup = page.locator(
      `.live-map [role="dialog"].map-popup[data-icao="${PRIMARY_AIRPORT.icao}"]`,
    )
    const anyPopup = page.locator('.live-map [role="dialog"].map-popup')
    const canvas = page.locator('.live-map .maplibregl-canvas')
    const input = searchInput(page)
    const toggle = page.getByRole('button', { name: 'Havalimanları', exact: true })
    /** Havalimanını aramadan açar: harita z10'da oraya gider, pencere açılır (D-108). */
    const searchAirport = async (iata: string) => {
      await input.fill(iata)
      await expect(
        page
          .getByRole('search')
          .getByRole('option')
          .filter({ hasText: new RegExp(`^${iata}`) }),
      ).toBeVisible()
      await input.press('Enter')
    }
    /** "Havalimanları" listesinden açar (görünümdeki havalimanları; liste görünümle yenilenir). */
    const openFromList = async (iata: string) => {
      const item = page.getByRole('button', { name: new RegExp(`^${iata}\\b`) })
      await expect(async () => {
        if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click()
        await toggle.click()
        await item.click({ timeout: 2_000 })
      }).toPass({ timeout: 15_000 })
    }

    // Tek satır, üç seçenek; varsayılan Simge ve kod. Uçak etiketleri gizlenir: etiket tuvalinde
    // yalnız havalimanı kodları kalır, boş tuval hiçbir kodun çizilmediğini gösterir.
    await button.click()
    await expect(airports.getByRole('radio')).toHaveCount(3)
    await expect(mode('Simge ve kod')).toBeChecked()
    await expect(page.getByRole('group', { name: 'Havalimanı simgeleri' })).toHaveCount(0)
    await page
      .getByRole('group', { name: 'Diğer uçaklar' })
      .getByRole('radio', { name: 'Gizle' })
      .check()
    await page
      .getByRole('group', { name: 'Seçili uçak' })
      .getByRole('radio', { name: 'Gizle' })
      .check()
    await page.keyboard.press('Escape')
    await expect(button).toHaveAttribute('aria-expanded', 'false')

    // Açılış görünümünde (IST, z8) SAW'ın pini çizili: yenilemeden sonraki denetimin karşılığı.
    const opening = await mapCenter(page)
    const offset = mercatorOffset(OPENING_VIEW, SAW, OPENING_ZOOM)
    const sawAtOpening = { x: opening.x + offset.x, y: opening.y + offset.y }
    await expect(async () => {
      expect((await pinPixels(page, sawAtOpening)).red).toBeGreaterThanOrEqual(15)
    }).toPass({ timeout: 15_000 })

    // Arama SAW'ı açar; pencere kapanınca harita SAW'dadır.
    await searchAirport(SAW.iata)
    await expect(sawPopup).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Escape')
    await expect(anyPopup).toHaveCount(0)
    expect((await airportListCodes(page))[0]).toBe(SAW.iata)
    const saw = await centred(page)
    await expect(async () => {
      expect(await saw.pinRed()).toBeGreaterThanOrEqual(15)
      expect(await saw.chip(), 'SAW kutusu tuvalde çizili').toBeDefined()
    }).toPass({ timeout: 15_000 })

    // Gizle klavyeyle seçilir (Simge ve kod → Simge → Gizle); kayıt yeni biçimdedir.
    await button.click()
    await mode('Simge ve kod').focus()
    await page.keyboard.press('ArrowLeft')
    await expect(mode('Simge')).toBeChecked()
    await page.keyboard.press('ArrowLeft')
    await expect(mode('Gizle')).toBeChecked()
    await expect
      .poll(() => stored(page))
      .toEqual({
        selected: 'hidden',
        others: 'hidden',
        airportDisplay: 'hidden',
        countries: 'shown',
        airports: 'hidden',
      })
    await page.keyboard.press('Escape')
    await expect(button).toHaveAttribute('aria-expanded', 'false')

    // Gizle: SAW'ın pini yok, hiçbir havalimanının kodu yok; pinin başı tıklanmaz, imleç değişmez.
    const gone = async () => {
      expect(await saw.pinRed()).toBe(0)
      expect(await paintedPixels(page)).toBe(0)
    }
    await expect(gone).toPass({ timeout: 10_000 })
    await page.mouse.move(saw.head.x, saw.head.y)
    await expect(canvas).not.toHaveCSS('cursor', 'pointer')
    await page.mouse.click(saw.head.x, saw.head.y)
    await expect(anyPopup).toHaveCount(0)

    // Yeniden açılış (adres `/`, harita IST'de, z8): Gizle seçili; IST'nin de kodu yok. Pin kaynağı
    // kayıtlı ayarla kurulur: hiçbir pencere açılmadan (sonraki adımların `setData`'sından önce)
    // açılış görünümündeki SAW'ın pini yok. Liste yüklendikten ve harita oturduktan sonra
    // denetlenir; yanlış kurulan kaynakta pin pencere açılana kadar kalırdı, yineleme yalnız
    // üstünden geçen bir uçağı bekler.
    await page.reload()
    await waitForMap(page)
    expect((await airportListCodes(page))[0]).toBe(PRIMARY_AIRPORT.iata)
    await settleMap(page)
    await expect(async () => {
      expect((await pinPixels(page, sawAtOpening)).red).toBe(0)
    }).toPass({ timeout: 5_000 })
    await expect.poll(() => paintedPixels(page), { timeout: 10_000 }).toBe(0)
    await button.click()
    await expect(mode('Gizle')).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(button).toHaveAttribute('aria-expanded', 'false')

    // "Havalimanları" listesi Gizle'de de IST penceresini açar.
    await openFromList(PRIMARY_AIRPORT.iata)
    await expect(istPopup).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(anyPopup).toHaveCount(0)

    // Arama Gizle'de de SAW'ı açar: pencere açıkken SAW'ın pini çizilir (kodu yazılmaz); pencere
    // kapanınca pin kalkar.
    await searchAirport(SAW.iata)
    await expect(sawPopup).toBeVisible({ timeout: 15_000 })
    const sawAgain = await centred(page)
    await expect(async () => {
      expect(await sawAgain.pinRed()).toBeGreaterThanOrEqual(15)
      expect(await paintedPixels(page)).toBe(0)
    }).toPass({ timeout: 15_000 })
    await page.keyboard.press('Escape')
    await expect(anyPopup).toHaveCount(0)
    await expect(async () => {
      expect(await sawAgain.pinRed()).toBe(0)
      expect(await paintedPixels(page)).toBe(0)
    }).toPass({ timeout: 10_000 })

    // Liste de öyle: SAW'ın penceresi açıkken pini çizili, kapanınca yok.
    await openFromList(SAW.iata)
    await expect(sawPopup).toBeVisible()
    await expect(async () => {
      expect(await sawAgain.pinRed()).toBeGreaterThanOrEqual(15)
    }).toPass({ timeout: 15_000 })
    await page.keyboard.press('Escape')
    await expect(anyPopup).toHaveCount(0)
    await expect(async () => {
      expect(await sawAgain.pinRed()).toBe(0)
    }).toPass({ timeout: 10_000 })

    // Simge: pinler geri gelir, kod yok.
    await button.click()
    await mode('Simge').check()
    await expect
      .poll(() => stored(page))
      .toMatchObject({ airportDisplay: 'icon', airports: 'hidden' })
    await page.keyboard.press('Escape')
    await expect(async () => {
      expect(await sawAgain.pinRed()).toBeGreaterThanOrEqual(15)
      expect(await paintedPixels(page)).toBe(0)
    }).toPass({ timeout: 15_000 })

    // Simge ve kod: kodlar da geri gelir.
    await button.click()
    await mode('Simge ve kod').check()
    await expect
      .poll(() => stored(page))
      .toMatchObject({ airportDisplay: 'icon-code', airports: 'code' })
    await page.keyboard.press('Escape')
    await expect(async () => {
      expect(await sawAgain.pinRed()).toBeGreaterThanOrEqual(15)
      expect(await sawAgain.chip(), 'SAW kutusu tuvalde çizili').toBeDefined()
    }).toPass({ timeout: 15_000 })
  })

  test('eski kayıt (`airports: "hidden"`, v0.14.0–v0.25.2) Simge okunur; Gizle’de `?havalimani=` hedefinin pini çizili kalır ve tıklanır; Simge ve kod kodu getirir', async ({
    page,
  }) => {
    // Tek sayfa yüklemesi. O sürümlerin Gizle'si yalnız kodu kaldırıyordu, pin kalıyordu (D-084).
    const legacy = { selected: 'hidden', others: 'hidden', airports: 'hidden' }
    await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
      key: LABEL_SETTINGS_KEY,
      value: JSON.stringify(legacy),
    })
    await page.goto(`/?havalimani=${SAW.icao}`)
    await waitForMap(page)
    await expect
      .poll(async () => (await airportListCodes(page))[0], { timeout: 30_000 })
      .toBe(SAW.iata)
    const button = page.getByRole('button', { name: 'Etiketler', exact: true })
    const airports = page.getByRole('group', { name: 'Havalimanları', exact: true })
    const mode = (name: string) => airports.getByRole('radio', { name, exact: true })
    const popup = page.locator(`.live-map [role="dialog"].map-popup[data-icao="${SAW.icao}"]`)
    const saw = await centred(page)

    // Simge: panelde seçili, pin çizili, kod yok; kayıt okunurken yeniden yazılmaz.
    await button.click()
    await expect(mode('Simge')).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(await stored(page)).toEqual(legacy)
    await expect(async () => {
      expect(await saw.pinRed()).toBeGreaterThanOrEqual(15)
      expect(await paintedPixels(page)).toBe(0)
    }).toPass({ timeout: 15_000 })
    await expect(popup).toHaveCount(0)

    // Gizle: kayıt yeni biçimde (ve türetilmiş `airports` ile) yazılır. SAW adresin hedefi olduğu
    // için pini çizili ve tıklanır kalır; pencere kapanınca da (parametre adreste).
    await button.click()
    await mode('Gizle').check()
    await expect
      .poll(() => stored(page))
      .toEqual({
        selected: 'hidden',
        others: 'hidden',
        airportDisplay: 'hidden',
        countries: 'shown',
        airports: 'hidden',
      })
    await page.keyboard.press('Escape')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    // Pin kaynağı eşzamansız yenilenir: denetim ~1 sn'lik beklemeden sonradır (`settleMap`), yoksa
    // ayardan önceki kare de geçerdi. Üstünden geçen bir seyir uçağı için denetim yinelenir.
    await settleMap(page)
    await expect(async () => {
      expect(await saw.pinRed()).toBeGreaterThanOrEqual(15)
      expect(await paintedPixels(page)).toBe(0)
    }).toPass({ timeout: 10_000 })
    await expect(async () => {
      await page.mouse.click(saw.head.x, saw.head.y)
      await expect(popup).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 15_000 })
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
    // Doğru kodda pencerenin kapanması pin kaynağını değiştirmez; hedef unutulsaydı pin bu
    // beklemede kalkardı.
    await settleMap(page)
    await expect(async () => {
      expect(await saw.pinRed()).toBeGreaterThanOrEqual(15)
    }).toPass({ timeout: 10_000 })

    // Simge ve kod: SAW'ın kodu geri gelir.
    await button.click()
    await mode('Simge ve kod').check()
    await expect.poll(() => stored(page)).toMatchObject({ airportDisplay: 'icon-code' })
    await page.keyboard.press('Escape')
    await expect(async () => {
      expect(await saw.pinRed()).toBeGreaterThanOrEqual(15)
      expect(await saw.chip(), 'SAW kutusu tuvalde çizili').toBeDefined()
    }).toPass({ timeout: 15_000 })
  })
})

/** Web Mercator (512 px karo): `to`nun `from`a göre z'deki ekran farkı, px (y aşağı). */
function mercatorOffset(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  zoom: number,
): { x: number; y: number } {
  const world = 512 * 2 ** zoom
  const y = (lat: number) =>
    ((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * world
  return { x: ((to.lon - from.lon) / 360) * world, y: y(to.lat) - y(from.lat) }
}

test.describe('askerî hava üsleri haritada yok (D-103, D-107)', () => {
  // MapLibre `prefers-reduced-motion`'da kamera geçişlerini anında yapar: `?havalimani=` uçuşu ve
  // klavyeyle uzaklaştırma beklemesiz ve kesindir (her basış tam bir kademe). Harita yüksek: z10'da
  // ADB ortadayken Çiğli (27 km kuzeybatıda, ~410 px yukarıda) görünümün içindedir.
  test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 1100 } })

  test('?havalimani=LTBL bilinmeyen kod gibidir (harita IST’de açılır); İzmir’de Çiğli’nin pini, kodu ve liste satırı yok, ADB’ninki var', async ({
    page,
  }) => {
    const base = MILITARY_AIRFIELD
    const civil = MILITARY_AIRFIELD_NEIGHBOUR
    const popup = page.locator('.live-map [role="dialog"].map-popup')
    // İki sayfa yüklemesi (her biri bir WebSocket el sıkışması, `WS_RATE_LIMIT`).
    // 1. Üs listede yoktur (D-107): `?havalimani=LTBL` haritayı oraya götürmez, açılış görünümü
    // (IST/LTFM, D-079) kalır; pencere açılmaz.
    await page.goto(`/?havalimani=${base.icao}`)
    await waitForMap(page)
    await expect
      .poll(async () => (await airportListCodes(page))[0], { timeout: 30_000 })
      .toBe(PRIMARY_AIRPORT.iata)
    expect(await airportListCodes(page)).not.toContain(base.iata)
    await expect(popup).toHaveCount(0)

    // 2. İzmir: `?havalimani=LTBJ` ADB'de z10'da açar; görünümde Çiğli'nin yeri de var ama listede
    // yalnız ADB vardır.
    await page.goto(`/?havalimani=${civil.icao}`)
    await waitForMap(page)
    await expect.poll(() => airportListCodes(page), { timeout: 30_000 }).toEqual([civil.iata])
    await expect(popup).toHaveCount(0)

    // z9: ADB'nin pini ortada; Çiğli'nin yeri ~107 px solda, ~205 px yukarıda.
    await zoomOut(page, 1)
    const civilTip = await mapCenter(page)
    const offset = mercatorOffset(civil, base, 9)
    const tip = { x: civilTip.x + offset.x, y: civilTip.y + offset.y }
    const head = (point: { x: number; y: number }) => ({ x: point.x, y: point.y - 13 })
    await expect(async () => {
      // ADB'nin pini ve kod kutusu (pin başının yanında) çizili.
      expect((await pinPixels(page, civilTip)).red).toBeGreaterThanOrEqual(15)
      const [chip] = await canvasChips(page, head(civilTip))
      expect(chip, 'ADB kutusu tuvalde çizili').toBeDefined()
      if (!chip) return
      expect(Math.hypot(chip.x - civilTip.x, chip.y - (civilTip.y - 13))).toBeLessThanOrEqual(
        30 + chip.width / 2,
      )
    }).toPass({ timeout: 15_000 })
    // Çiğli'nin yeri: pin kırmızısı yok; kodun dört adayının (pin başının sağı, solu, pinin üstü,
    // noktanın altı) bulunduğu kesitte etiket tuvali boş.
    await expect(async () => {
      expect((await pinPixels(page, tip)).red).toBe(0)
      expect(
        await paintedPixelsIn(page, { x: tip.x - 50, y: tip.y - 45, width: 100, height: 70 }),
      ).toBe(0)
    }).toPass({ timeout: 10_000 })

    // Çiğli'nin pin başının yeri tıklanmaz (imleç değişmez, pencere açılmaz); ADB'ninki tıklanır.
    const canvas = page.locator('.live-map .maplibregl-canvas')
    await page.mouse.move(head(tip).x, head(tip).y)
    await expect(canvas).not.toHaveCSS('cursor', 'pointer')
    await page.mouse.click(head(tip).x, head(tip).y)
    await expect(popup).toHaveCount(0)
    await expect(async () => {
      await page.mouse.click(head(civilTip).x, head(civilTip).y)
      await expect(popup).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 15_000 })
    await expect(popup).toHaveAttribute('data-icao', civil.icao)
  })
})

test.describe('ülke adları (D-095, D-096, D-099, D-100)', () => {
  // MapLibre `prefers-reduced-motion`'da kamera geçişlerini anında yapar: `?havalimani=` uçuşu ve
  // klavyeyle uzaklaştırma beklemesiz ve kesindir (her basış tam bir kademe).
  test.use({ reducedMotion: 'reduce' })

  test.beforeEach(async ({ context }) => {
    // v0.18.1 kaydı (ülke alanı yok): ülke adları Göster okunur. Eski `airports: 'hidden'` Simge
    // okunur (D-114): pinler çizili, kodlar gizli; pin ucundaki kesiti ve pin tıklamasını kod kutusu
    // etkilemez.
    await context.addInitScript((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({ selected: 'full', others: 'hidden', airports: 'hidden' }),
      )
    }, LABEL_SETTINGS_KEY)
  })

  test('Tahran’da uzaklaşınca İRAN ve sığan komşuları boş yerde yazılır; İRAN modelin kutusunda çizilir, IKA pinine değmez; Gizle saklanır; kesirli ilk yakınlaştırmalı adlar uzaklaşınca kaybolur, yakınlaşınca hepsi silinir', async ({
    page,
  }) => {
    // Tek sayfa yüklemesi (`WS_RATE_LIMIT`). Tahran Mehrabad'ın (OIII) çevresinde replay uçağı yoktur.
    const requested: string[] = []
    page.on('request', (sent) => requested.push(sent.url()))
    await page.goto('/?havalimani=OIII')
    await waitForMap(page)
    // Kamera havalimanına gitti (z10): görünümün ortasındaki havalimanı THR.
    await expect
      .poll(async () => (await airportListCodes(page))[0], { timeout: 30_000 })
      .toBe('THR')
    expect(await countryLabels(page)).toEqual([])

    // Beş kademe uzaklaşınca (z5): İRAN boş yerde, Dest-i Kevir'de (Tahran'ın 428 km
    // doğu-güneydoğusu, D-099); sınırının içine sığan komşular yazılır, z5'te henüz sığmayanlar (ilk
    // yakınlaştırmaları > 5) yazılmaz (D-096; liste tools testinde tablodan denetlenir:
    // e2e/country-label-expectations.ts). z10'da ülke kaynağının karosu yoktur; z5 karoları
    // (İRAN, IRAK ve TÜRKMENİSTAN ayrı karolarda) birer birer gelir ve nitelik arada yazılabilir:
    // beklenen adların hepsi gelene kadar beklenir.
    await zoomOut(page, 5)
    await expect
      .poll(() => countryLabels(page), { timeout: 20_000 })
      .toEqual(expect.arrayContaining([...TEHRAN_COUNTRY_LABELS.z5.shown]))
    const names = await countryLabels(page)
    for (const name of TEHRAN_COUNTRY_LABELS.z5.shown) expect(names).toContain(name)
    for (const name of TEHRAN_COUNTRY_LABELS.z5.hidden) expect(names).not.toContain(name)
    for (const name of names) expect(name).toBe(name.toLocaleUpperCase('tr-TR'))
    expect(names).not.toContain('İSRAİL')
    // Yazı tipi sitenin kendi dosyasıdır (İ latin-ext'tedir); glif (.pbf) ve OpenFreeMap isteği yok.
    const sameOrigin = requested.map((url) => new URL(url)).filter((url) => url.origin === WEB_URL)
    expect(sameOrigin.map((url) => url.pathname)).toContain(
      '/fonts/overpass-latin-ext-600-normal.woff2',
    )
    expect(
      requested.filter((url) => {
        const { hostname, pathname } = new URL(url)
        return hostname.endsWith('openfreemap.org') || pathname.endsWith('.pbf')
      }),
    ).toEqual([])

    // IKA pininin ucundaki kesit adlar Göster ve Gizle iken aynıdır: İRAN boş yerdedir, kesitte ad ya
    // da hale çizilmez (D-099; hiçbir pin ve kodun İRAN'ın kutusuna girmediği tools testinde). Adların
    // pinlerin altında çizildiğini birim testleri denetler: `overlayLayers` sırası
    // (map-controller.test.ts) ve pin ile uçak katmanlarının yerleşime katılmaması (layers.test.ts).
    const tip = await mapCenter(page)
    const ika = { x: tip.x + IKA_PIN_Z5.x, y: tip.y + IKA_PIN_Z5.y }
    const shown = await pinPixels(page, ika)
    expect(shown.red).toBeGreaterThanOrEqual(15)
    // İRAN'ın çevresindeki kesit (modelin görünür kutusu + 12 px): ad açıkken ve kapalıyken değişen
    // pikseller modelin kutusunun içindedir (±1 px). Bu, MapLibre'nin harfleri modelin dediği yere
    // çizdiğini (TinySDF kaymaları, harf aralığı, hale) gerçek tarayıcıda denetler.
    const margin = 12
    const clip = {
      x: Math.round(tip.x + IRAN_Z5_BOX.left - margin),
      y: Math.round(tip.y + IRAN_Z5_BOX.top - margin),
      width: Math.round(IRAN_Z5_BOX.right - IRAN_Z5_BOX.left + 2 * margin),
      height: Math.round(IRAN_Z5_BOX.bottom - IRAN_Z5_BOX.top + 2 * margin),
    }
    const box = {
      left: tip.x + IRAN_Z5_BOX.left - clip.x,
      top: tip.y + IRAN_Z5_BOX.top - clip.y,
      right: tip.x + IRAN_Z5_BOX.right - clip.x,
      bottom: tip.y + IRAN_Z5_BOX.bottom - clip.y,
    }
    const withName = await clipImage(page, clip)
    const button = page.getByRole('button', { name: 'Etiketler' })
    const countries = page.getByRole('group', { name: 'Ülke adları' })
    await button.click()
    await expect(countries.getByRole('radio', { name: 'Göster' })).toBeChecked()
    await countries.getByRole('radio', { name: 'Gizle' }).check()
    await page.keyboard.press('Escape')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(() => countryLabels(page)).toEqual([])
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(window.localStorage.getItem(key) ?? 'null'),
          LABEL_SETTINGS_KEY,
        ),
      )
      // Kayıt yeni biçimde yazılır: eski `airports: 'hidden'` Simge'dir; türetilmiş `airports` yine
      // `'hidden'` (D-114).
      .toEqual({
        selected: 'full',
        others: 'hidden',
        airportDisplay: 'icon',
        countries: 'hidden',
        airports: 'hidden',
      })
    await expect(async () => {
      expect(await pinPixels(page, ika)).toEqual(shown)
      const changed = await changedPixels(page, withName, await clipImage(page, clip))
      expect(changed.count).toBeGreaterThan(200)
      expect(changed.minX).toBeGreaterThanOrEqual(Math.floor(box.left - 1))
      expect(changed.minY).toBeGreaterThanOrEqual(Math.floor(box.top - 1))
      expect(changed.maxX).toBeLessThan(Math.ceil(box.right + 1))
      expect(changed.maxY).toBeLessThan(Math.ceil(box.bottom + 1))
    }).toPass({ timeout: 10_000 })

    // Göster: adlar geri gelir.
    await button.click()
    await countries.getByRole('radio', { name: 'Göster' }).check()
    await page.keyboard.press('Escape')
    await expect.poll(() => countryLabels(page), { timeout: 10_000 }).toContain('İRAN')

    // Adlar açıkken IKA pinine tıklanır: pencere İmam Humeyni'nindir.
    const popup = page.locator('.live-map [role="dialog"].map-popup')
    await expect(async () => {
      await page.mouse.click(ika.x, ika.y - 9)
      await expect(popup).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 15_000 })
    await expect(popup).toHaveAttribute('data-icao', 'OIIE')
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()

    // Bir kademe daha uzaklaşınca (z4) AFGANİSTAN, SURİYE (3,75) ve TÜRKİYE (3,25) görünüme girer;
    // ÖZBEKİSTAN'ın (4,5) ve PAKİSTAN'ın (4,75) çapası tuvalin içindedir ama yazılmaz. Bir kademe daha
    // (z3): ilk yakınlaştırması 3'ten büyük kesirli adlar (AFGANİSTAN, SURİYE, TÜRKİYE ve 4. halkanın
    // pinleri arasında kalabalık kuralıyla 3,25'ten yazılan HİNDİSTAN, D-102) kaybolur, İRAN kalır;
    // ÇAD yazılır (D-100: bütün ülkelerin adı). Kovaları z3 ve z4 karosunda hazırdır: katmanın
    // kesirli `minzoom`'u tarayıcıda.
    for (const key of ['z4', 'z3'] as const) {
      await zoomOut(page, 1)
      const { shown: expected, hidden: absent } = TEHRAN_COUNTRY_LABELS[key]
      await expect
        .poll(
          async () => {
            const current = await countryLabels(page)
            return (
              expected.every((name) => current.includes(name)) &&
              absent.every((name) => !current.includes(name))
            )
          },
          { timeout: 10_000 },
        )
        .toBe(true)
      const far = await countryLabels(page)
      for (const name of expected) expect(far, key).toContain(name)
      for (const name of absent) expect(far, key).not.toContain(name)
    }

    // Altı kademe yakınlaşınca (z9) adlar silinmiştir.
    await zoomIn(page, 6)
    await expect.poll(() => countryLabels(page), { timeout: 10_000 }).toEqual([])
  })
})

test.describe('arama kutusunun ipucu kesilmez', () => {
  // İpucu (placeholder) kısa, erişilebilir ad tam metindir (packages/i18n → map.search).
  const COPY = {
    tr: {
      path: '/',
      name: 'Uçak ya da havalimanı ara: sefer no, çağrı kodu, tescil ya da hex; havalimanı kodu, adı ya da şehri',
    },
    en: {
      path: '/en',
      name: 'Search aircraft or airports: flight number, callsign, registration or hex; airport code, name or city',
    },
  } as const

  // Telefonun iki genişliği tek sayfa yüklemesinde ölçülür (her yükleme bir WebSocket el sıkışması,
  // `WS_RATE_LIMIT`).
  for (const widths of [[1280], [375, 320]]) {
    for (const locale of ['tr', 'en'] as const) {
      test(`${widths.join(' ve ')} px, ${locale}: ipucu kutuya sığar; erişilebilir ad tam`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: widths[0] ?? 1280, height: 812 })
        await page.goto(COPY[locale].path)
        const input = searchInput(page)
        await expect(input).toBeVisible()
        await expect(input).toHaveAccessibleName(COPY[locale].name)
        const placeholder = (await input.getAttribute('placeholder')) ?? ''
        expect(placeholder.length).toBeGreaterThan(0)
        await page.evaluate(() => document.fonts.ready)
        for (const width of widths) {
          await page.setViewportSize({ width, height: 812 })
          // İpucu, ipucu ile aynı yazı tipindeki metin kutuya sığıyorsa sığar: aynı metin yazılır ve
          // kutunun kaydırma genişliği ölçülür (tarayıcının iç düzeni, temizle düğmesi yeri dahil).
          // M6d ilk sürümü: "…tescil ya da he" (1280) ve "…tescil ya" (375) kesiliyordu; v0.22.3'ün
          // ilk ipucu "Sefer no, tescil, havalimanı" 320 px'te kesiliyordu.
          await input.fill(placeholder)
          const overflow = await input.evaluate(
            (element) => element.scrollWidth - element.clientWidth,
          )
          expect(overflow, `${width} px: ${placeholder}`).toBeLessThanOrEqual(0)
          await input.fill('')
          await expect(input).toHaveAttribute('placeholder', placeholder)
        }
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
    await expect(searchInput(page)).toBeVisible()
    const attribution = page.locator('.maplibregl-ctrl-attrib')
    await expect(attribution).toBeVisible()
    // Künye şeridin başında; zorunlu atıflar ve Koşullar ekranın içinde kalır (D-089).
    await expect(attribution).toHaveText(
      new RegExp(`^${APP_NAME_PATTERN} v\\d+\\.\\d+\\.\\d+\\S* \\| Canlı uçuş verisi:`),
    )
    for (const name of ['ADSB.lol', 'ODbL 1.0', 'Koşullar']) {
      await expect(attribution.getByRole('link', { name, exact: true })).toBeInViewport({
        ratio: 1,
      })
    }
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

  test('İngilizce haritada şerit künyeyle başlar; künye /en/yenilikler’e gider (D-089)', async ({
    page,
  }) => {
    await openMap(page, '/en')
    const attribution = page.locator('.maplibregl-ctrl-attrib')
    await expect(attribution).toHaveText(
      new RegExp(`^${APP_NAME_PATTERN} v\\d+\\.\\d+\\.\\d+\\S* \\| Live flight data:`),
    )
    await expect(attribution).toContainText('Live flight data: ADSB.lol — ODbL 1.0 · Terms')
    const creditLink = attribution.getByRole('link').first()
    await expect(creditLink).toHaveAccessibleName(
      new RegExp(`^${APP_NAME_PATTERN} v\\d+\\.\\d+\\.\\d+\\S*, what’s new$`),
    )
    await expect(creditLink).toHaveAttribute('href', '/en/yenilikler')
    await expect(creditLink).toBeInViewport({ ratio: 1 })
    for (const name of ['ADSB.lol', 'ODbL 1.0', 'Terms']) {
      await expect(attribution.getByRole('link', { name, exact: true })).toBeInViewport({
        ratio: 1,
      })
    }

    // Ülke adları İngilizcede (D-095): aynı sayfa yüklemesinde, IST'den dört kademe uzaklaşınca
    // (375 px'te açılış z7,8, yani z3,8) TÜRKIYE yazılır (D-099, D-103: Türkiye'nin görsel
    // merkezinde, 33,8° D, 39,4° K; çapası IST'nin ~100 px doğusunda, görünümün içinde); Türkçe büyük
    // harf (İ) yok.
    // Hareket azaltılır: her basış tam kademe.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await zoomOut(page, 4)
    await expect.poll(() => countryLabels(page), { timeout: 20_000 }).toContain('TÜRKIYE')
    const names = await countryLabels(page)
    expect(names).not.toContain('TÜRKİYE')
    for (const name of names) {
      expect(name).toBe(name.toLocaleUpperCase('en-GB'))
      expect(name).not.toContain('İ')
    }
    const labels = page.getByRole('button', { name: 'Labels', exact: true })
    await labels.click()
    const countries = page.getByRole('group', { name: 'Country names' })
    await expect(countries.getByRole('radio')).toHaveCount(2)
    await expect(countries.getByRole('radio', { name: 'Hide' })).not.toBeChecked()
    await expect(countries.getByRole('radio', { name: 'Show' })).toBeChecked()
    await page.keyboard.press('Escape')
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
