// Türkiye dışındaki havalimanları, 1. halka (Parça 1 M6d, D-080). Listelenen havalimanları IATA
// kodlu Türkiye havalimanları ve IATA kodlu en yakın Türkiye havalimanına en çok 500 km olan,
// OurAirports'ta tarifeli seferi kayıtlı büyük ve orta boy yabancı havalimanlarıdır. Veri
// tools/fixtures/ourairports'taki commit'li alt kümeden (2026-10-01 indirmesi), hava durumu elle
// yazılmış fixture'dan gelir. Denetlenenler:
// - API: `scope=listed` (61 + 75), halka ve uzaklık alanları, `country` ile birlikte 400; tek
//   havalimanı ve hava durumu yabancı havalimanını da çözer
// - /havalimanlari: Türkiye tablosundan sonra "Yakın ülkelerdeki havalimanları" tablosu (75 satır,
//   ülkeye göre Türkçe sıralı, ülke ve Türkiye'ye uzaklık sütunları)
// - /istasyon/LGAV ve /en/istasyon/LGAV: ülke, hava durumu, harita bağlantısı, dizine eklenir,
//   JSON-LD `addressCountry` GR; /istasyon/LCEN KKTC'yi gösterir ve JSON-LD'de ülke kodu yazmaz;
//   IATA kodu yönlendirir; fixture'da olup listelenmeyen uzak havalimanı 404
// - harita: `?havalimani=LGAV` Atina'da açar; pin ve "Havalimanları" listesi pencereyi açar; pencere
//   il yerine ülkeyi gösterir
// - yerel saat (M6f, D-084): pencerede ve sayfada Atina'nın saati UTC farkıyla ("23:05 (UTC+2)");
//   sayfada gün doğumu ve batımı, "Türkiye saati" notu yok
import { expect, test, type Locator, type Page } from '@playwright/test'
import { jsonLdNodes, metaContents, nodesOfType, type JsonLdNode } from '../html'
import {
  AIRPORT_COUNT,
  airportListCodes,
  API_URL,
  declineAnalytics,
  enPath,
  expectRedirect,
  fetchRaw,
  FOREIGN_AIRPORT_COUNT,
  KKTC_AIRPORT,
  LABEL_SETTINGS_KEY,
  LISTED_AIRPORT_COUNT,
  RING1_AIRPORT,
  RING1_WEATHER_AIRPORTS,
  UNLISTED_FOREIGN_AIRPORT,
  waitForMap,
  WEB_URL,
} from '../support'

const { icao, iata } = RING1_AIRPORT
const STATION_PATH = `/istasyon/${icao}`
const KKTC_PATH = `/istasyon/${KKTC_AIRPORT.icao}`
/** 1. halkanın sınırı, km (`AIRPORT_RINGS_KM[0]`). */
const RING1_KM = 500
/** Atina'nın saat dilimi (`airportTimeZone`, tzdb; D-084). */
const ATHENS_TIME_ZONE = 'Europe/Athens'

/** Sayfadaki metinler (packages/i18n → `airports`, `map.airportPopup`, `weather`). */
const COPY = {
  tr: {
    listPath: '/havalimanlari',
    foreignHeading: 'Yakın ülkelerdeki havalimanları',
    foreignHeaders: ['Havalimanı', 'Ülke', 'IATA', 'ICAO', 'Türkiye’ye uzaklık', 'En uzun pist'],
    country: RING1_AIRPORT.countryTr,
    kktc: new RegExp(KKTC_AIRPORT.shortTr),
    collator: 'tr-TR',
    listButton: 'Havalimanları',
    weather: 'Hava durumu',
    wind: 'Rüzgâr',
    speedUnit: 'km/sa',
    observed: /Gözlem \d{2}:\d{2}/,
    localTime: 'Yerel saat',
    sunrise: /Gün doğumu \d{2}:\d{2}/,
    sunset: /Gün batımı \d{2}:\d{2}/,
    turkeyTime: 'Türkiye saati',
  },
  en: {
    listPath: enPath('/havalimanlari'),
    foreignHeading: 'Airports in neighbouring countries',
    foreignHeaders: ['Airport', 'Country', 'IATA', 'ICAO', 'Distance to Türkiye', 'Longest runway'],
    country: RING1_AIRPORT.countryEn,
    kktc: new RegExp(`${KKTC_AIRPORT.shortEn}|Turkish Republic of Northern Cyprus`),
    collator: 'en-GB',
    listButton: 'Airports',
    weather: 'Weather',
    wind: 'Wind',
    speedUnit: 'km/h',
    observed: /Observed \d{2}:\d{2}/,
    localTime: 'Local time',
    sunrise: /Sunrise \d{2}:\d{2}/,
    sunset: /Sunset \d{2}:\d{2}/,
    turkeyTime: 'Türkiye time',
  },
} as const

interface ListedAirport {
  icao?: unknown
  iata?: unknown
  country?: unknown
  ring?: unknown
  distanceToTrKm?: unknown
  runways?: unknown[]
}

function isRecord(value: unknown): value is JsonLdNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `<dl>` satırının değeri: etiketi tam olarak `label` olan görünür `<dt>`'nin ardındaki `<dd>`. */
function row(scope: Locator, label: string): Locator {
  return scope
    .locator('dt')
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`), visible: true })
    .first()
    .locator('xpath=following-sibling::dd[1]')
}

test.describe('API', () => {
  test('scope=listed: 61 Türkiye + 75 yakın ülke havalimanı; halka ve uzaklık; uzak havalimanı yok', async ({
    request,
  }) => {
    for (const path of ['/v1/airports?scope=listed', '/v1/airports?scope=listed&include=runways']) {
      const response = await request.get(`${API_URL}${path}`)
      expect(response.status(), path).toBe(200)
      const airports = ((await response.json()) as { airports?: ListedAirport[] }).airports ?? []
      expect(airports, path).toHaveLength(LISTED_AIRPORT_COUNT)
      const turkey = airports.filter((airport) => airport.country === 'TR')
      const foreign = airports.filter((airport) => airport.country !== 'TR')
      expect(turkey, `${path}: Türkiye`).toHaveLength(AIRPORT_COUNT)
      expect(foreign, `${path}: yakın ülkeler`).toHaveLength(FOREIGN_AIRPORT_COUNT)
      for (const airport of turkey) {
        expect(airport.ring, `${String(airport.icao)}: halka`).toBe(0)
        expect(airport.distanceToTrKm, `${String(airport.icao)}: uzaklık`).toBeNull()
      }
      for (const airport of foreign) {
        const label = String(airport.icao)
        expect(airport.ring, `${label}: halka`).toBe(1)
        expect(typeof airport.distanceToTrKm, `${label}: uzaklık`).toBe('number')
        expect(airport.distanceToTrKm as number, label).toBeGreaterThan(0)
        expect(airport.distanceToTrKm as number, label).toBeLessThanOrEqual(RING1_KM)
        expect(airport.country, `${label}: ülke kodu`).toMatch(/^[A-Z]{2}$/)
      }
      const athens = airports.find((airport) => airport.icao === icao)
      expect(athens?.iata).toBe(iata)
      expect(athens?.country).toBe(RING1_AIRPORT.country)
      // Ercan OurAirports'ta CY'dir; API ham ülke kodunu verir, KKTC gösterimi arayüzdedir (D-080).
      expect(airports.find((airport) => airport.icao === KKTC_AIRPORT.icao)?.country).toBe('CY')
      expect(airports.some((airport) => airport.icao === UNLISTED_FOREIGN_AIRPORT.icao)).toBe(false)
      if (path.includes('include=runways')) expect(athens?.runways?.length ?? 0).toBeGreaterThan(0)
    }

    // Geriye uyumluluk: varsayılan yine Türkiye'dir; `country` ile `scope` birlikte verilemez.
    const turkey = await request.get(`${API_URL}/v1/airports?country=TR`)
    expect(((await turkey.json()) as { airports?: unknown[] }).airports).toHaveLength(AIRPORT_COUNT)
    const both = await request.get(`${API_URL}/v1/airports?country=TR&scope=listed`, {
      failOnStatusCode: false,
    })
    expect(both.status()).toBe(400)
  })

  test('tek havalimanı ve hava durumu yakın ülke havalimanını ICAO ve IATA koduyla çözer', async ({
    request,
  }) => {
    for (const code of [icao, iata.toLowerCase()]) {
      const response = await request.get(`${API_URL}/v1/airports/${code}`)
      expect(response.status(), code).toBe(200)
      const body = (await response.json()) as ListedAirport
      expect(body.icao, code).toBe(icao)
      expect(body.iata, code).toBe(iata)
    }
    const weather = await request.get(`${API_URL}/v1/airports/${iata}/weather`)
    expect(weather.status()).toBe(200)
    const body = (await weather.json()) as { icao?: unknown; metar?: { raw?: unknown } | null }
    expect(body.icao).toBe(icao)
    expect(String(body.metar?.raw)).toContain(icao)
  })

  test('toplu hava: scope=listed bütün listelenen havalimanları; 1. halka fixture istasyonlarında METAR', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/v1/weather?scope=listed`)
    expect(response.status()).toBe(200)
    const stations =
      (
        (await response.json()) as {
          stations?: { icao?: unknown; metar?: { raw?: unknown } | null }[]
        }
      ).stations ?? []
    expect(stations).toHaveLength(LISTED_AIRPORT_COUNT)
    for (const station of RING1_WEATHER_AIRPORTS) {
      const entry = stations.find((item) => item.icao === station)
      expect(String(entry?.metar?.raw), `${station}: METAR`).toContain(station)
    }
    const both = await request.get(`${API_URL}/v1/weather?country=TR&scope=listed`, {
      failOnStatusCode: false,
    })
    expect(both.status()).toBe(400)
  })
})

test.describe('havalimanı listesi', () => {
  test.beforeEach(async ({ context }) => {
    await declineAnalytics(context)
  })

  for (const locale of ['tr', 'en'] as const) {
    const copy = COPY[locale]

    test(`${copy.listPath}: yakın ülkeler tablosu 75 satır, ülkeye göre sıralı; satır sayfayı açar`, async ({
      page,
    }) => {
      await page.goto(copy.listPath)
      const main = page.locator('main')
      await expect(main.getByRole('heading', { level: 2, name: copy.foreignHeading })).toBeVisible()
      const table = main.getByRole('table', { name: new RegExp(copy.foreignHeading) })
      await expect(table).toHaveCount(1)
      await expect(table.locator('thead th')).toHaveText([...copy.foreignHeaders])
      const rows = table.locator('tbody tr')
      await expect(rows).toHaveCount(FOREIGN_AIRPORT_COUNT)

      // Ülke sütunu sayfanın dilinin alfabesiyle sıralıdır (ilk `<td>`; ad `<th scope="row">`).
      const countries = (await rows.locator('td:nth-of-type(1)').allTextContents()).map((text) =>
        text.trim(),
      )
      const collator = new Intl.Collator(copy.collator)
      expect(countries).toEqual([...countries].sort((a, b) => collator.compare(a, b)))

      const athens = rows.filter({ hasText: icao })
      await expect(athens).toHaveCount(1)
      await expect(athens).toContainText(copy.country)
      await expect(athens).toContainText(iata)
      // Türkiye'ye uzaklık km ile yazılır (Atina ~275 km).
      await expect(athens.locator('td').nth(3)).toHaveText(/^\s*\d+\s*km\s*$/)
      await expect(rows.filter({ hasText: KKTC_AIRPORT.icao })).toContainText(copy.kktc)

      const href = locale === 'tr' ? STATION_PATH : enPath(STATION_PATH)
      await athens.locator(`a[href="${href}"]`).click()
      await expect(page).toHaveURL(`${WEB_URL}${href}`)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(`(${iata}/${icao})`)
    })
  }
})

test.describe('havalimanı sayfası', () => {
  test.beforeEach(async ({ context }) => {
    await declineAnalytics(context)
  })

  for (const locale of ['tr', 'en'] as const) {
    const copy = COPY[locale]
    const path = locale === 'tr' ? STATION_PATH : enPath(STATION_PATH)

    test(`${path}: ülke, hava durumu ve harita bağlantısı; dizine eklenir, JSON-LD ülkesi GR`, async ({
      page,
      request,
    }) => {
      const loadedFrom = Date.now()
      const { response, body } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(200)
      expect(metaContents(body, 'robots').join(', '), `${path}: robots`).not.toMatch(/noindex/)
      const airport = nodesOfType(jsonLdNodes(body), 'Airport')[0]
      expect(airport?.iataCode).toBe(iata)
      expect(airport?.icaoCode).toBe(icao)
      const address = isRecord(airport?.address) ? airport.address : {}
      expect(address.addressCountry).toBe(RING1_AIRPORT.country)

      await page.goto(path)
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      const main = page.locator('main')
      await expect(main.getByRole('heading', { level: 1 })).toContainText(`(${iata}/${icao})`)
      await expect(main).toContainText(copy.country)
      // Hava durumu bölümü yabancı havalimanında da vardır (fixture: LGAV 02016KT).
      const weather = main.getByRole('region', { name: copy.weather, exact: true })
      await expect(weather).toBeVisible()
      await expect(row(weather, copy.wind)).toContainText(copy.speedUnit)
      // Yerel saat Atina'nındır, UTC farkıyla (D-084); gün doğumu ve batımı yazılır, "Türkiye
      // saati" notu yoktur.
      const sun = weather.locator('.weather-sun')
      await expect(sun).toContainText(copy.sunrise)
      await expect(sun).toContainText(copy.sunset)
      await expectAthensClock(sun.locator('li').first(), `${copy.localTime} `, loadedFrom)
      await expect(weather).not.toContainText(copy.turkeyTime)
      const mapHref = locale === 'tr' ? `/?havalimani=${icao}` : `/en?havalimani=${icao}`
      await expect(main.locator(`a[href="${mapHref}"]`)).toBeVisible()
    })
  }

  test('/istasyon/LCEN ve /en/istasyon/LCEN: KKTC gösterilir; JSON-LD’de ülke kodu yazılmaz', async ({
    page,
    request,
  }) => {
    for (const locale of ['tr', 'en'] as const) {
      const path = locale === 'tr' ? KKTC_PATH : enPath(KKTC_PATH)
      const { response, body } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(200)
      const airport = nodesOfType(jsonLdNodes(body), 'Airport')[0]
      expect(airport?.icaoCode, path).toBe(KKTC_AIRPORT.icao)
      // Gösterilen ülke (KKTC) OurAirports'un kodundan (CY) ayrıdır: JSON-LD yalnızca sayfada
      // görünen değeri yazar (D-080).
      const address = isRecord(airport?.address) ? airport.address : {}
      expect(address.addressCountry, `${path}: addressCountry`).toBeUndefined()

      await page.goto(path)
      await expect(page.locator('main')).toContainText(COPY[locale].kktc)
    }
  })

  test('IATA kodu ve küçük harf yönlendirir; listelenmeyen uzak havalimanı gerçek 404', async ({
    request,
  }) => {
    await expectRedirect(request, `/istasyon/${iata}`, STATION_PATH)
    await expectRedirect(request, `/istasyon/${iata.toLowerCase()}`, STATION_PATH)
    await expectRedirect(request, `/istasyon/${icao.toLowerCase()}`, STATION_PATH)
    await expectRedirect(request, `/en/istasyon/${iata.toLowerCase()}`, enPath(STATION_PATH))
    for (const path of [
      `/istasyon/${UNLISTED_FOREIGN_AIRPORT.icao}`,
      `/istasyon/${UNLISTED_FOREIGN_AIRPORT.iata}`,
      enPath(`/istasyon/${UNLISTED_FOREIGN_AIRPORT.icao}`),
    ]) {
      const { response } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(404)
    }
  })
})

test.describe('harita: yakın ülke havalimanı', () => {
  // MapLibre `prefers-reduced-motion`'da kamera geçişlerini anında yapar: `?havalimani=` uçuşu
  // beklemesiz ve kesin olur (weather.spec.ts ile aynı).
  test.use({ reducedMotion: 'reduce' })

  test.beforeEach(async ({ context }) => {
    await declineAnalytics(context)
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, JSON.stringify({ selected: 'full', others: 'hidden' }))
    }, LABEL_SETTINGS_KEY)
  })

  test('?havalimani=LGAV Atina’da açar; pin pencereyi açar; pencere il yerine ülkeyi gösterir', async ({
    page,
  }) => {
    const loadedFrom = Date.now()
    await page.goto(`/?havalimani=${icao}`)
    await waitForMap(page)
    // Harita Atina'dadır: görünümün ortasına en yakın havalimanı ATH (yakın ülke pini ve kodu).
    await expect.poll(async () => (await airportListCodes(page))[0], { timeout: 30_000 }).toBe(iata)

    // Pinin başı: ucu havalimanı merkezinde (harita ortası), baş ~15 px yukarıda. Atina'nın
    // çevresinde canlı uçak yoktur (çekim alanı Türkiye'dedir); tıklama havalimanınındır.
    const popup = mapPopup(page)
    const center = await mapCenter(page)
    await expect(async () => {
      await page.mouse.click(center.x, center.y - 13)
      await expect(popup).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 15_000 })
    await expect(popup).toHaveAttribute('data-icao', icao)
    await expect(popup).toContainText(`${iata} · ${icao}`)
    await expect(popup.locator('.map-popup__place')).toHaveText(COPY.tr.country)
    // Yerel saat Atina'nındır, UTC farkıyla: "23:05 (UTC+2)" (D-084).
    await expectAthensClock(row(popup, COPY.tr.localTime), '', loadedFrom)
    await expect(popup.getByRole('link', { name: /Havalimanı sayfası/ })).toHaveAttribute(
      'href',
      STATION_PATH,
    )
    // Hava durumu listelenen havalimanlarının toplu yanıtından gelir (`scope=listed`).
    const weather = popup.getByRole('region', { name: COPY.tr.weather })
    await expect(row(weather, COPY.tr.wind)).toContainText(COPY.tr.speedUnit, { timeout: 15_000 })
    await expect(weather).toContainText(COPY.tr.observed)
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
  })

  test('İngilizce: "Airports" listesinden klavyeyle açılır; ülke Greece, bağlantı /en altında', async ({
    page,
  }) => {
    const loadedFrom = Date.now()
    await page.goto(enPath(`/?havalimani=${icao}`))
    await waitForMap(page)
    await expect
      .poll(async () => (await airportListCodes(page, COPY.en.listButton))[0], { timeout: 30_000 })
      .toBe(iata)
    const toggle = page.getByRole('button', { name: COPY.en.listButton, exact: true })
    await toggle.focus()
    await page.keyboard.press('Enter')
    const item = page.getByRole('button', { name: new RegExp(`^${iata}\\b`) })
    await item.focus()
    await page.keyboard.press('Enter')
    const popup = mapPopup(page)
    await expect(popup).toBeVisible()
    await expect(popup).toBeFocused()
    await expect(popup).toHaveAttribute('data-icao', icao)
    await expect(popup.locator('.map-popup__place')).toHaveText(COPY.en.country)
    await expectAthensClock(row(popup, COPY.en.localTime), '', loadedFrom)
    await expect(popup.getByRole('link', { name: /Airport page/ })).toHaveAttribute(
      'href',
      enPath(STATION_PATH),
    )
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
    await expect(toggle).toBeFocused()
  })
})

/**
 * Atina'nın `from`'dan şimdiye her dakikadaki yerel saati ve UTC farkı ("23:05 (UTC+2)"), Node'un
 * `Intl`'iyle. Fark koda gömülmez: test yaz saati (UTC+3) ve kış saati (UTC+2) günlerinde, geçiş
 * anında (25 Ekim 2026 01:00 UTC) bile aynı biçimde deterministiktir.
 */
function athensClocks(from: number, to: number): string[] {
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone: ATHENS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'shortOffset',
  })
  const values = new Set<string>()
  for (let at = from - (from % 60_000); at <= to; at += 60_000) {
    const parts = new Map(format.formatToParts(at).map((part) => [part.type, part.value]))
    const offset = (parts.get('timeZoneName') ?? '').replace('GMT', 'UTC')
    values.add(`${parts.get('hour')}:${parts.get('minute')} (${offset})`)
  }
  return [...values]
}

/**
 * Öğe `prefix` + Atina'nın yerel saatini UTC farkıyla yazar ("Yerel saat 23:05 (UTC+2)"). Sayfa
 * saati çizim anından (sunucu) ya da 30 sn adımlı ada saatinden gelir: beklenen değerler sayfanın
 * istendiği andan (`from`, 30 sn pay) okuma anına kadarki dakikalardır.
 */
async function expectAthensClock(locator: Locator, prefix: string, from: number): Promise<void> {
  await expect(locator).toHaveText(new RegExp(`^\\s*${prefix}\\d{2}:\\d{2} \\(UTC\\+[23]\\)\\s*$`))
  const shown = ((await locator.textContent()) ?? '').trim()
  const expected = athensClocks(from - 31_000, Date.now() + 2_000).map((value) => prefix + value)
  expect(expected, `Atina saati (${ATHENS_TIME_ZONE}): ${shown}`).toContain(shown)
}

function mapPopup(page: Page): Locator {
  return page.locator('.live-map [role="dialog"].map-popup')
}

/** Harita kapsayıcısının ortası, sayfa koordinatıyla (CSS px). */
async function mapCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('.live-map .maplibregl-canvas').boundingBox()
  if (!box) throw new Error('harita tuvali yok')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
