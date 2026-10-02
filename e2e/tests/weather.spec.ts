// Havalimanı hava durumu (Parça 1 M6c, D-078). Veri aviationweather.gov'dan değil, elle yazılmış
// sentetik fixture'dan gelir (tools/fixtures/weather; worker zamanları bugüne kaydırır). Denetlenenler:
// - API: toplu güncel hava, tek havalimanının havası ve METAR/TAF kaydı (`hours` 1–168)
// - havalimanı sayfası TR ve EN: rüzgâr, yağmur, kar, gök gürültüsü ve sis satırları her zaman açıkça
//   yazılır; sıcaklık başlığın yanında ayrı kutucuktur, sayıdan önce "·" ya da "–" yoktur; var olan
//   olayın satırı vurguludur, simgeler ekran okuyucudan gizlidir; uzman ayrıntısında ham METAR;
//   METAR/TAF kaydı en yenisi önce; "Sefer sayısı, rötar ve iptal" bölümü; hava durumu başlık,
//   açıklama ve JSON-LD'ye girmez
// - kaldırılan iki bilgi ("Tarifeli sefer (OurAirports)", "İzlenen istasyon") hiçbir sayfada yok
// - harita: IST koduna ya da pinine tıklayınca havalimanı penceresi açılır (apronda yerdeki uçaklar
//   engellemez, D-079); "Havalimanları" listesiyle klavyeden açılır ve kapanınca odak o düğmeye
//   döner; Escape (başka bir katmanın değilse), boş yere tıklama ve uçak seçimi kapatır; dar
//   ekranda pencere alttan açılan sayfadır; pencerede gün doğumu ve batımı yoktur, hava durumu
//   sayfayla aynı satırları, sıcaklık kutucuğunu ve vurguyu taşır (kullanıcı kararı 2026-10-02)
import { expect, test, type Locator, type Page } from '@playwright/test'
import { jsonLdBlocks, metaContents, titles } from '../html'
import {
  aircraftRow,
  AIRPORT_COUNT,
  API_URL,
  declineAnalytics,
  enPath,
  FAR_AIRCRAFT,
  fetchRaw,
  infoCard,
  LABEL_SETTINGS_KEY,
  NO_WEATHER_AIRPORT,
  PRIMARY_AIRPORT,
  PRIMARY_WEATHER,
  REPLAY_AIRCRAFT,
  TAXI_AIRCRAFT,
  waitForMap,
} from '../support'

type Locale = 'tr' | 'en'

const { icao, iata } = PRIMARY_AIRPORT
const STATION_PATH = `/istasyon/${icao}`
/**
 * Sayfadaki kaydın penceresi sayfanın "şimdi"sine göre süzülür (weather-log.tsx; saat 30 sn
 * adımlıdır): sunucu önbelleği eski bir kayıt yanıtı verse de 24 saatten eski satır gösterilmez,
 * ada eski kaydı açılışta yeniler. Pay = saat adımı + çizim ile okuma arası.
 */
const LOG_WINDOW_SLACK_MS = 60_000
const LATEST_GROUP = PRIMARY_WEATHER.latestMetarGroups[0]

/**
 * Sayfadaki metinler (packages/i18n → `weather`, `airport.schedule`, `map.airportPopup`). Satır
 * değerleri LTFM'nin son METAR'ından gelir (support.ts → PRIMARY_WEATHER).
 */
const COPY = {
  tr: {
    path: STATION_PATH,
    name: PRIMARY_AIRPORT.nameTr,
    heading: 'Hava durumu',
    rows: {
      wind: 'Rüzgâr',
      rain: 'Yağmur',
      snow: 'Kar',
      thunder: 'Gök gürültüsü',
      fog: 'Sis ve pus',
    },
    windFrom: 'Kuzeydoğudan',
    speedUnit: 'km/sa',
    gust: 'hamle',
    strongWind: 'Kuvvetli rüzgâr',
    rainValue: 'Hafif sağanak yağmur',
    none: 'Yok',
    cb: 'kümülonimbüs',
    observed: /Gözlem \d{2}:\d{2}/,
    observedAgo: /Gözlem \d{2}:\d{2}, (az önce|\d.* önce)/,
    localTime: /Yerel saat \d{2}:\d{2}/,
    sunrise: /Gün doğumu \d{2}:\d{2}/,
    sunset: /Gün batımı \d{2}:\d{2}/,
    expert: 'Ayrıntılar (uzman)',
    logCaption: /son 24 saatin raporları/,
    schedule: 'Sefer sayısı, rötar ve iptal',
    scheduleBody: 'Bu bilgiler henüz yok.',
    aboutPath: '/hakkinda',
    source: 'aviationweather.gov',
    removed: [
      'Tarifeli sefer (OurAirports)',
      'tarifeli havayolu seferi',
      'İzlenen istasyon',
      'izlenen istasyon',
      'bu havalimanını izliyor',
      'Birincil istasyondur',
      'varış izleme',
    ],
    listHeaders: ['Havalimanı', 'İl', 'IATA', 'ICAO', 'En uzun pist'],
  },
  en: {
    path: enPath(STATION_PATH),
    name: PRIMARY_AIRPORT.nameEn,
    heading: 'Weather',
    rows: {
      wind: 'Wind',
      rain: 'Rain',
      snow: 'Snow',
      thunder: 'Thunderstorm',
      fog: 'Fog and mist',
    },
    windFrom: 'From the northeast',
    speedUnit: 'km/h',
    gust: 'gusts',
    strongWind: 'Strong wind',
    rainValue: 'Light rain showers',
    none: 'None',
    cb: 'cumulonimbus',
    observed: /Observed \d{2}:\d{2}/,
    observedAgo: /Observed \d{2}:\d{2}, (just now|\d.* ago)/,
    localTime: /Local time \d{2}:\d{2}/,
    sunrise: /Sunrise \d{2}:\d{2}/,
    sunset: /Sunset \d{2}:\d{2}/,
    expert: 'Details (expert)',
    logCaption: /reports from the last 24 hours/,
    schedule: 'Flight counts, delays and cancellations',
    scheduleBody: 'Not available yet.',
    aboutPath: '/en/hakkinda',
    source: 'aviationweather.gov',
    removed: [
      'Scheduled service (OurAirports)',
      'scheduled airline service',
      'Monitored station',
      'monitored station',
      'monitors this airport',
      'primary station',
      'Arrival monitoring',
    ],
    listHeaders: ['Airport', 'Province', 'IATA', 'ICAO', 'Longest runway'],
  },
} as const

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Sayıdan (ya da eksi işaretinden) hemen önce "·" ya da "–": eksi gibi okunur (2026-10-02). */
const DASH_BEFORE_NUMBER = /[·–]\s*[−-]?\d/
/** Sıcaklık kutucuğu: "9 °C", eksi U+2212 ile "−3 °C". */
const TEMPERATURE_CHIP = /^\s*−?\d+ °C\s*$/

/**
 * Hava durumu satırları (sayfa ve pencere ortak): sıcaklık kutucuğu başlığın yanındadır; yağmur
 * satırı vurgulu, "Yok" satırları sade; simgeler ekran okuyucudan gizli; sayıdan önce ayraç yok.
 */
async function expectWeatherPresentation(scope: Locator, locale: Locale): Promise<void> {
  const copy = COPY[locale]
  await expect(scope.locator('.wx-temp').first()).toHaveText(TEMPERATURE_CHIP)
  const rainRow = row(scope, copy.rows.rain).locator('xpath=..')
  await expect(rainRow).toHaveAttribute('data-tone', 'rain')
  // Vurgu yalnız renk değildir: değer kalındır ve olayın adını yazar.
  await expect(row(scope, copy.rows.rain)).toHaveCSS('font-weight', '700')
  for (const label of [copy.rows.snow, copy.rows.fog]) {
    await expect(row(scope, label).locator('xpath=..'), label).not.toHaveAttribute('data-tone')
  }
  for (const label of Object.values(copy.rows)) {
    const icon = scope
      .locator('dt')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`), visible: true })
      .first()
      .locator('svg.wx-icon')
    await expect(icon, label).toHaveAttribute('aria-hidden', 'true')
  }
  expect(await scope.innerText()).not.toMatch(DASH_BEFORE_NUMBER)
}

/** `<dl>` satırının değeri: etiketi tam olarak `label` olan görünür `<dt>`'nin ardındaki `<dd>`. */
function row(scope: Locator, label: string): Locator {
  return scope
    .locator('dt')
    .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`), visible: true })
    .first()
    .locator('xpath=following-sibling::dd[1]')
}

function weatherSection(page: Page, locale: Locale): Locator {
  return page.locator('main').getByRole('region', { name: COPY[locale].heading, exact: true })
}

function logTable(page: Page, locale: Locale): Locator {
  return page.locator('main').getByRole('table', { name: COPY[locale].logCaption })
}

interface HistoryEntry {
  kind?: unknown
  time?: unknown
  raw?: unknown
}

test.describe('API', () => {
  test('toplu güncel hava: listedeki her havalimanı, raporu olmayan istasyon boş döner', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/v1/weather?country=TR`)
    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toMatch(/max-age=60\b/)
    const body = (await response.json()) as {
      generatedAt?: unknown
      stations?: { icao?: unknown; metar?: { raw?: unknown } | null }[]
    }
    expect(Number.isNaN(Date.parse(String(body.generatedAt))), 'generatedAt').toBe(false)
    const stations = body.stations ?? []
    expect(stations).toHaveLength(AIRPORT_COUNT)
    const primary = stations.find((station) => station.icao === icao)
    for (const group of PRIMARY_WEATHER.latestMetarGroups) {
      expect(String(primary?.metar?.raw), `LTFM son METAR ${group}`).toContain(group)
    }
    const empty = stations.find((station) => station.icao === NO_WEATHER_AIRPORT)
    expect(empty, `${NO_WEATHER_AIRPORT} listede`).toBeDefined()
    expect(empty?.metar ?? null, `${NO_WEATHER_AIRPORT}: rapor yok`).toBeNull()
  })

  test('tek havalimanı IATA koduyla da bulunur; bilinmeyen kod 404, hatalı kod 400', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/v1/airports/${iata.toLowerCase()}/weather`)
    expect(response.status()).toBe(200)
    const body = (await response.json()) as { icao?: unknown; metar?: { raw?: unknown } | null }
    expect(body.icao).toBe(icao)
    expect(String(body.metar?.raw)).toContain(LATEST_GROUP)

    const missing = await request.get(`${API_URL}/v1/airports/ZZZZ/weather`, {
      failOnStatusCode: false,
    })
    expect(missing.status()).toBe(404)
    const invalid = await request.get(`${API_URL}/v1/airports/x1/weather`, {
      failOnStatusCode: false,
    })
    expect(invalid.status()).toBe(400)
  })

  test('METAR/TAF kaydı: en yenisi önce, METAR ve TAF birlikte; saat aralığı 1–168', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/v1/airports/${iata}/weather/history?hours=24`)
    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toMatch(/max-age=60\b/)
    const body = (await response.json()) as { icao?: unknown; entries?: HistoryEntry[] }
    expect(body.icao).toBe(icao)
    const entries = body.entries ?? []
    expect(entries.length).toBeGreaterThanOrEqual(PRIMARY_WEATHER.logMin24h)
    const times = entries.map((entry) => Date.parse(String(entry.time)))
    expect(
      times.every((time) => !Number.isNaN(time)),
      'zamanlar ISO',
    ).toBe(true)
    expect(times, 'en yenisi önce').toEqual([...times].sort((a, b) => b - a))
    const now = Date.now()
    expect(Math.min(...times), 'son 24 saat').toBeGreaterThanOrEqual(now - 24 * 3_600_000 - 60_000)
    expect(Math.max(...times), 'gelecekte kayıt yok').toBeLessThanOrEqual(now + 60_000)
    const kinds = new Set(entries.map((entry) => entry.kind))
    expect(kinds.has('METAR')).toBe(true)
    expect(kinds.has('TAF')).toBe(true)
    expect(entries[0]?.kind).toBe('METAR')
    expect(String(entries[0]?.raw)).toContain(LATEST_GROUP)

    // Fixture'da LTFM için 3 günlük kayıt vardır; 72 saat 24 saatten fazlasını döndürür.
    const longer = await request.get(`${API_URL}/v1/airports/${icao}/weather/history?hours=72`)
    expect(longer.status()).toBe(200)
    const longerEntries = ((await longer.json()) as { entries?: unknown[] }).entries ?? []
    expect(longerEntries.length).toBeGreaterThan(entries.length)

    for (const hours of ['0', '169', 'abc']) {
      const bad = await request.get(
        `${API_URL}/v1/airports/${icao}/weather/history?hours=${hours}`,
        { failOnStatusCode: false },
      )
      expect(bad.status(), `hours=${hours}`).toBe(400)
    }
  })
})

test.describe('havalimanı sayfası', () => {
  test.beforeEach(async ({ context }) => {
    await declineAnalytics(context)
  })

  for (const locale of ['tr', 'en'] as const) {
    const copy = COPY[locale]

    test(`${copy.path}: rüzgâr, yağmur, kar, gök gürültüsü ve sis açıkça yazılır`, async ({
      page,
    }) => {
      await page.goto(copy.path)
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      const section = weatherSection(page, locale)
      await expect(section).toBeVisible()

      // Bütün satırlar her zaman vardır; "Yok" yalnızca rapor temiz çözümlendiyse yazılır.
      const wind = row(section, copy.rows.wind)
      await expect(wind).toContainText(copy.windFrom)
      await expect(wind).toContainText(copy.speedUnit)
      await expect(wind).toContainText(copy.gust)
      await expect(section).toContainText(copy.strongWind)
      await expect(row(section, copy.rows.rain)).toContainText(copy.rainValue)
      await expect(row(section, copy.rows.snow)).toHaveText(new RegExp(`^\\s*${copy.none}\\s*$`))
      // Gök gürültüsü yok, ama kümülonimbüs bulutu var (FEW025CB).
      const thunder = row(section, copy.rows.thunder)
      await expect(thunder).toHaveText(new RegExp(`^\\s*${copy.none}\\b`))
      await expect(thunder).toContainText(copy.cb)
      await expect(row(section, copy.rows.fog)).toHaveText(new RegExp(`^\\s*${copy.none}\\s*$`))

      await expect(section).toContainText(copy.observed)
      // Gözlem yaşı istemci saatiyle gelir; saatten virgülle ayrılır.
      await expect(section).toContainText(copy.observedAgo)
      await expect(section).toContainText(copy.localTime)
      await expect(section).toContainText(copy.sunrise)
      await expect(section).toContainText(copy.sunset)
      await expect(page.locator('main')).toContainText(copy.source)
      await expectWeatherPresentation(section, locale)

      // Uzman ayrıntısı kapalı açılır; içinde ham METAR (kaydırılmayan gruplarıyla) vardır.
      const details = section.locator('details').filter({ hasText: copy.expert }).first()
      await expect(details).not.toHaveAttribute('open')
      await details.locator('summary').first().click()
      const raw = details.locator('pre').filter({ hasText: LATEST_GROUP }).first()
      await expect(raw).toBeVisible()
      for (const group of PRIMARY_WEATHER.latestMetarGroups) await expect(raw).toContainText(group)
      // Uzman tablosunda da (rüzgâr, tahmin dönemleri) sayıdan önce ayraç yoktur.
      expect(await details.innerText()).not.toMatch(DASH_BEFORE_NUMBER)
    })

    test(`${copy.path}: METAR/TAF kaydı son 24 saati en yenisi önce listeler`, async ({ page }) => {
      await page.goto(copy.path)
      const table = logTable(page, locale)
      await expect(table).toBeVisible()
      const rows = table.locator('tbody tr')
      await expect
        .poll(() => rows.count(), { message: 'kayıt satırı sayısı' })
        .toBeGreaterThanOrEqual(PRIMARY_WEATHER.logMin24h)
      // En üstteki satır son METAR'dır; listede TAF'lar da vardır.
      await expect(rows.first()).toHaveAttribute('data-kind', 'METAR')
      await expect(rows.first()).toContainText(LATEST_GROUP)
      await expect(table.locator('tbody tr[data-kind="TAF"]').first()).toBeVisible()
      // Saatler yerel saattir; UTC yanında yazılır.
      await expect(rows.first()).toContainText(/\d{2}:\d{2}/)
      await expect(rows.first()).toContainText('UTC')
      // Her satırın anı `<time datetime>`'dadır: en yenisi önce, hepsi son 24 saatte.
      const times = await rows
        .locator('time[datetime]')
        .evaluateAll((elements) =>
          elements.map((element) => Date.parse(element.getAttribute('datetime') ?? '')),
        )
      expect(times.length).toBeGreaterThanOrEqual(PRIMARY_WEATHER.logMin24h)
      expect(times, 'en yenisi önce').toEqual([...times].sort((a, b) => b - a))
      expect(Math.min(...times)).toBeGreaterThanOrEqual(
        Date.now() - 24 * 3_600_000 - LOG_WINDOW_SLACK_MS,
      )
    })

    test(`${copy.path}: sefer sayısı, rötar ve iptal bilgisinin olmadığı açıkça yazılır`, async ({
      page,
    }) => {
      await page.goto(copy.path)
      const section = page.locator('main').getByRole('region', { name: copy.schedule })
      await expect(section).toBeVisible()
      await expect(section).toContainText(copy.scheduleBody)
      await expect(section.locator(`a[href="${copy.aboutPath}"]`)).toBeVisible()
    })
  }

  test.describe('dar ekran', () => {
    test.use({ viewport: { width: 320, height: 640 } })

    test('uzman ayrıntısı açıkken de sayfa 320 px’te yatay kaymaz', async ({ page }) => {
      for (const locale of ['tr', 'en'] as const) {
        await page.goto(COPY[locale].path)
        const section = weatherSection(page, locale)
        const details = section.locator('details').filter({ hasText: COPY[locale].expert }).first()
        await details.locator('summary').first().click()
        await expect(details.locator('pre').first()).toBeVisible()
        await expect(logTable(page, locale)).toBeAttached()
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, COPY[locale].path).toBeLessThanOrEqual(0)
      }
    })
  })

  test('hava durumu başlık, açıklama, paylaşım metni ve JSON-LD’ye girmez', async ({ request }) => {
    // Kod adları büyük harfle ve tam kelime aranır ("Mustafa" gibi adlarda "taf" geçer).
    const forbidden = [/\bMETAR\b|\bTAF\b/, /hava durumu|weather|sağanak|showers|rüzgâr|\bwind\b/i]
    for (const path of [STATION_PATH, enPath(STATION_PATH)]) {
      const { response, body } = await fetchRaw(request, path)
      expect(response.status(), path).toBe(200)
      const head = [
        ...titles(body),
        ...metaContents(body, 'description'),
        ...metaContents(body, 'og:title'),
        ...metaContents(body, 'og:description'),
        ...metaContents(body, 'twitter:description'),
      ]
      for (const text of head) {
        for (const pattern of forbidden) expect(text, `${path}: ${text}`).not.toMatch(pattern)
      }
      const jsonLd = JSON.stringify(jsonLdBlocks(body))
      expect(jsonLd, `${path}: JSON-LD`).not.toMatch(/\bMETAR\b|\bTAF\b|weather|Weather/)
      expect(jsonLd, `${path}: JSON-LD`).not.toContain(LATEST_GROUP)
    }
  })
})

test.describe('kaldırılan bilgiler', () => {
  test.beforeEach(async ({ context }) => {
    await declineAnalytics(context)
  })

  for (const locale of ['tr', 'en'] as const) {
    const copy = COPY[locale]
    const listPath = locale === 'tr' ? '/havalimanlari' : enPath('/havalimanlari')

    test(`${listPath} ve ${copy.path}: tarifeli sefer ve izlenen istasyon bilgisi yok`, async ({
      page,
    }) => {
      await page.goto(listPath)
      // Türkiye tablosu ilk tablodur; yakın ülkelerin tablosu (M6d) onu izler.
      const tables = page.locator('main table')
      const table = tables.first()
      await expect(table.locator('tbody tr').first()).toBeVisible()
      await expect(table.locator('thead th')).toHaveText([...copy.listHeaders])
      await expect(tables.locator('tbody tr.is-unscheduled')).toHaveCount(0)
      const listText = await page.locator('main').innerText()
      for (const text of copy.removed) expect(listText, `${listPath}: ${text}`).not.toContain(text)

      await page.goto(copy.path)
      await expect(weatherSection(page, locale)).toBeVisible()
      const pageText = await page.locator('main').innerText()
      for (const text of copy.removed) expect(pageText, `${copy.path}: ${text}`).not.toContain(text)
    })
  }

  test('liste açıklaması ve llms.txt tarifeli sefer ya da izlenen istasyon bilgisi vermez', async ({
    request,
  }) => {
    for (const [path, pattern] of [
      ['/havalimanlari', /tarifeli sefer/i],
      [enPath('/havalimanlari'), /scheduled service/i],
    ] as const) {
      const { body } = await fetchRaw(request, path)
      for (const description of metaContents(body, 'description')) {
        expect(description, `${path}: açıklama`).not.toMatch(pattern)
      }
      // Kapsam cümlesi de OurAirports'un tarifeli sefer kaydından söz etmez (kullanıcı kararı).
      expect(body, `${path}: kapsam cümlesi`).not.toMatch(pattern)
    }
    const { response, body } = await fetchRaw(request, '/llms.txt')
    expect(response.status()).toBe(200)
    const airportLines = body.split('\n').filter((line) => /\/istasyon\/[A-Z0-9]{4}\)/.test(line))
    expect(airportLines.length).toBeGreaterThan(0)
    for (const line of airportLines) {
      expect(line).not.toMatch(/izlenen istasyon|İzlenen istasyon|tarifeli/)
    }
  })
})

test.describe('harita: havalimanı penceresi', () => {
  // MapLibre `prefers-reduced-motion`'da kamera geçişlerini anında yapar: `?havalimani=` uçuşu ve
  // klavyeyle yakınlaştırma beklemesiz ve kesin olur.
  test.use({ reducedMotion: 'reduce' })

  test.beforeEach(async ({ context }) => {
    await declineAnalytics(context)
    // Diğer uçakların etiketleri gizlenir: IST kodunun yerini ve tıklamayı etiketler etkilemez.
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, JSON.stringify({ selected: 'full', others: 'hidden' }))
    }, LABEL_SETTINGS_KEY)
  })

  test('IST koduna tıklayınca pencere açılır; Escape, boş yere tıklama ve uçak seçimi kapatır', async ({
    page,
  }) => {
    await openAtPrimaryAirport(page)
    const popup = airportPopup(page)

    await clickPrimaryChip(page)
    await expect(popup).toBeVisible()
    await expect(popup).toHaveAttribute('data-icao', icao)
    await expect(popup).toBeFocused()
    await expect(popup.getByRole('heading', { name: PRIMARY_AIRPORT.nameTr })).toBeVisible()
    await expect(popup).toContainText(`${iata} · ${icao}`)
    await expect(row(popup, 'Rakım')).toContainText(/\d+ m/)
    await expect(row(popup, 'Pistler')).toContainText(String(PRIMARY_AIRPORT.runways))
    await expect(row(popup, 'Yerel saat')).toHaveText(/\d{2}:\d{2}/)
    // Gün doğumu ve batımı yalnız havalimanı sayfasındadır (kullanıcı kararı 2026-10-02).
    await expect(popup).not.toContainText('Gün doğumu')
    await expect(popup).not.toContainText('Gün batımı')

    // Hava durumu ilk açılışta toplu istekle gelir; havalimanı sayfasıyla aynı sözcükler.
    const weather = popup.getByRole('region', { name: 'Hava durumu' })
    await expect(row(weather, COPY.tr.rows.wind)).toContainText(COPY.tr.speedUnit, {
      timeout: 15_000,
    })
    await expect(weather).toContainText(COPY.tr.strongWind)
    await expect(row(weather, COPY.tr.rows.rain)).toContainText(COPY.tr.rainValue)
    await expect(row(weather, COPY.tr.rows.snow)).toContainText(COPY.tr.none)
    await expect(row(weather, COPY.tr.rows.thunder)).toContainText(COPY.tr.none)
    await expect(row(weather, COPY.tr.rows.fog)).toContainText(COPY.tr.none)
    await expect(weather).toContainText(COPY.tr.observedAgo)
    await expectWeatherPresentation(weather, 'tr')
    await expect(popup.getByRole('link', { name: /Havalimanı sayfası/ })).toHaveAttribute(
      'href',
      STATION_PATH,
    )

    // Escape kapatır; odak haritaya döner.
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
    await expect(page.locator('.live-map .maplibregl-canvas')).toBeFocused()

    // Haritada boş bir yere tıklamak kapatır (havalimanı merkezinin kuzeybatısı: taksi turu doğudadır).
    await clickPrimaryChip(page)
    await expect(popup).toBeVisible()
    const center = await mapCenter(page)
    await page.mouse.click(center.x - 150, center.y - 100)
    await expect(popup).toBeHidden()

    // Uçak seçmek pencereyi kapatır ve bilgi kartını açar. Arama kutusundayken basılan Escape
    // arama kutusunundur: pencere açık kalır.
    await clickPrimaryChip(page)
    await expect(popup).toBeVisible()
    const input = page.getByRole('search').getByRole('searchbox')
    await input.fill(REPLAY_AIRCRAFT.callsign)
    await input.press('Escape')
    await expect(popup).toBeVisible()
    await input.fill(REPLAY_AIRCRAFT.callsign)
    await input.press('Enter')
    await expect(infoCard(page)).toContainText(REPLAY_AIRCRAFT.callsign)
    await expect(popup).toBeHidden()
  })

  test('apronda (z10) IST kodu ve pini tıklanır; "Havalimanları" listesiyle klavyeden açılır', async ({
    page,
  }) => {
    await page.goto(`/?havalimani=${icao}`)
    await waitForMap(page)
    await expect(aircraftRow(page, TAXI_AIRCRAFT.hex)).toHaveCount(1, { timeout: 30_000 })
    const popup = airportPopup(page)
    // Taksi uçağı havalimanı merkezinin 1–3 px yakınında; birincil istasyon kuralı (D-079) yokken
    // kod çizilmezdi. Kod yerdeki uçağın üstündedir ve tıklama havalimanınındır.
    await clickPrimaryChip(page)
    await expect(popup).toBeVisible()
    await popup.getByRole('button', { name: 'Kapat' }).click()
    await expect(popup).toBeHidden()
    // Pinin başı: ucu havalimanı merkezinde (harita ortası), baş ~15 px yukarıda.
    const center = await mapCenter(page)
    await expect(async () => {
      await page.mouse.click(center.x, center.y - 13)
      await expect(popup).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 15_000 })
    await expect(popup).toHaveAttribute('data-icao', icao)
    await popup.getByRole('button', { name: 'Kapat' }).click()
    await expect(popup).toBeHidden()

    // Klavye: "Havalimanları" düğmesi görünümdeki havalimanlarını listeler.
    const toggle = page.getByRole('button', { name: 'Havalimanları', exact: true })
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const item = page.getByRole('button', { name: new RegExp(`^${iata}\\b`) })
    await expect(item).toBeVisible()
    // Liste açıkken Escape listenindir: liste kapanır, odak düğmeye döner.
    await page.keyboard.press('Escape')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toBeFocused()
    await page.keyboard.press('Enter')
    await item.focus()
    await page.keyboard.press('Enter')
    await expect(popup).toBeVisible()
    await expect(popup).toBeFocused()
    await expect(popup).toHaveAttribute('data-icao', icao)
    // Hava durumu ekran okuyucuya kibarca bildirilir.
    await expect(popup.getByRole('status')).toContainText(COPY.tr.rainValue, { timeout: 15_000 })
    // Escape kapatır; liste öğesi artık yok, odak açan düğmeye döner (sayfanın başına, body'ye değil).
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
    await expect(toggle).toBeFocused()
    // Kapat düğmesiyle de aynı: düğmede Enter listeyi, öğede Enter pencereyi açar; Tab ile Kapat.
    await page.keyboard.press('Enter')
    await item.focus()
    await page.keyboard.press('Enter')
    await expect(popup).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(popup.getByRole('button', { name: 'Kapat' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(popup).toBeHidden()
    await expect(toggle).toBeFocused()
  })

  test('IST kodu diğer uçak etiketleri görünürken de bulunur (etiketler de beyaz kutudur)', async ({
    page,
  }) => {
    // beforeEach'in ayarını ezer: diğer uçakların etiketleri de çizilir (taksi uçağı IST'nin yanında).
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, JSON.stringify({ selected: 'full', others: 'full' }))
    }, LABEL_SETTINGS_KEY)
    await openAtPrimaryAirport(page)
    const popup = airportPopup(page)
    await clickPrimaryChip(page)
    await expect(popup).toHaveAttribute('data-icao', icao)
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
  })

  test('kapat düğmesi kapatır; bağlantı havalimanı sayfasını açar', async ({ page }) => {
    await openAtPrimaryAirport(page)
    const popup = airportPopup(page)
    await clickPrimaryChip(page)
    await expect(popup).toBeVisible()
    await popup.getByRole('button', { name: 'Kapat' }).click()
    await expect(popup).toBeHidden()

    await clickPrimaryChip(page)
    await popup.getByRole('link', { name: /Havalimanı sayfası/ }).click()
    await page.waitForURL((url) => url.pathname === STATION_PATH)
    await expect(weatherSection(page, 'tr')).toBeVisible()
  })

  test.describe('telefon genişliği', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('pencere alttan açılan sayfadır; sayfa yatay kaymaz', async ({ page }) => {
      await openAtPrimaryAirport(page)
      const popup = airportPopup(page)
      await clickPrimaryChip(page)
      await expect(popup).toBeVisible()
      const box = await popup.boundingBox()
      const map = await page.locator('.live-map .maplibregl-canvas').boundingBox()
      expect(box, 'pencere kutusu').not.toBeNull()
      expect(map, 'harita kutusu').not.toBeNull()
      // Alt sayfa haritanın altına dayanır ve bütün genişliği kaplar.
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThanOrEqual(
        (map?.y ?? 0) + (map?.height ?? 0) - 2,
      )
      expect(box?.width ?? 0).toBeGreaterThanOrEqual((map?.width ?? 0) - 2)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      await page.keyboard.press('Escape')
      await expect(popup).toBeHidden()
    })

    test('"Havalimanı sayfası" bağlantısı alt sayfa kaydırılmadan görünür ve tıklanır', async ({
      page,
    }) => {
      await openAtPrimaryAirport(page)
      const popup = airportPopup(page)
      await clickPrimaryChip(page)
      await expect(popup).toBeVisible()
      // Hava durumu satırları gelince alt sayfa en uzun hâlindedir.
      const weather = popup.getByRole('region', { name: 'Hava durumu' })
      await expect(row(weather, COPY.tr.rows.wind)).toContainText(COPY.tr.speedUnit, {
        timeout: 15_000,
      })
      const link = popup.getByRole('link', { name: /Havalimanı sayfası/ })
      const layout = await popup.evaluate((sheet) => {
        const anchor = sheet.querySelector<HTMLElement>('.map-popup__link')
        if (!anchor) return null
        // Yazının kendi kutusu (bağlantı şeridi bütün genişliktedir).
        const range = document.createRange()
        range.selectNodeContents(anchor)
        const text = range.getBoundingClientRect()
        const box = sheet.getBoundingClientRect()
        const hit = document.elementFromPoint(
          text.left + text.width / 2,
          text.top + text.height / 2,
        )
        return {
          scrollTop: sheet.scrollTop,
          text: { top: text.top, bottom: text.bottom },
          sheet: { top: box.top, bottom: box.bottom },
          viewport: window.innerHeight,
          hit: hit?.closest('.map-popup__link') === anchor,
        }
      })
      expect(layout, 'bağlantı').not.toBeNull()
      if (!layout) return
      expect(layout.scrollTop).toBe(0)
      expect(layout.text.top).toBeGreaterThanOrEqual(layout.sheet.top)
      expect(layout.text.bottom).toBeLessThanOrEqual(Math.min(layout.sheet.bottom, layout.viewport))
      // Bağlantının üstünde başka öğe (atıf şeridi, kayan satırlar) yoktur.
      expect(layout.hit, 'bağlantı tıklanabilir').toBe(true)
      await link.click()
      await page.waitForURL((url) => url.pathname === STATION_PATH)
    })
  })
})

test.describe('havalimanı sayfası: dar ekranda hava durumu satırları', () => {
  // Gözlem 30 dk'dan eskiyken eğilim satırının etiketi en uzun etikettir ("Gözlemden sonraki 2 saat");
  // fixture'ın saatine bağlı kalmasın diye ilk satırın etiketine yazılır. Etiket sütunu
  // genişlemez, değer sütunu daralmaz, "Kuvvetli rüzgâr" etiketi değerin kutusundan taşmaz.
  const LONG_LABEL = { tr: 'Gözlemden sonraki 2 saat', en: '2 hours after the observation' }

  for (const width of [412, 430, 560]) {
    for (const locale of ['tr', 'en'] as const) {
      test(`${width} px, ${locale}: değer sütunu ve kuvvetli rüzgâr etiketi kutusunda`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(COPY[locale].path)
        const section = weatherSection(page, locale)
        const rows = section.locator('.wx-rows--page')
        await expect(rows.locator('.wx-tag')).toHaveText(COPY[locale].strongWind)
        await rows
          .locator('.wx-row dt')
          .first()
          .evaluate((dt, label) => {
            const text = [...dt.childNodes].findLast((node) => node.nodeType === Node.TEXT_NODE)
            if (text) text.textContent = label
          }, LONG_LABEL[locale])
        const boxes = await rows.evaluate((list) => {
          const right = list.getBoundingClientRect().right
          return [...list.querySelectorAll('.wx-row')].map((row) => {
            const dd = row.querySelector('dd')?.getBoundingClientRect()
            const tag = row.querySelector('.wx-tag')?.getBoundingClientRect()
            return {
              key: row.getAttribute('data-row'),
              ddWidth: dd?.width ?? 0,
              ddRight: dd?.right ?? 0,
              tagRight: tag?.right ?? null,
              listRight: right,
            }
          })
        })
        expect(boxes.length).toBeGreaterThan(5)
        for (const box of boxes) {
          // M6d ilk sürümü: 412 px'te değer sütunu 79–102 px'e düşüyor, etiket kutudan taşıyordu.
          expect(box.ddWidth, `${box.key}: değer genişliği`).toBeGreaterThanOrEqual(150)
          expect(box.ddRight, `${box.key}: liste içinde`).toBeLessThanOrEqual(box.listRight + 0.5)
          if (box.tagRight !== null) {
            expect(box.tagRight, `${box.key}: etiket`).toBeLessThanOrEqual(box.ddRight + 0.5)
          }
        }
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow).toBeLessThanOrEqual(0)
      })
    }
  }
})

function airportPopup(page: Page): Locator {
  return page.locator('.live-map').getByRole('dialog', { name: new RegExp(PRIMARY_AIRPORT.nameTr) })
}

/** Harita kapsayıcısının ortası, sayfa koordinatıyla (CSS px). */
async function mapCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('.live-map .maplibregl-canvas').boundingBox()
  if (!box) throw new Error('harita tuvali yok')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/**
 * Haritayı LTFM merkezli açar ve kodun uçaklardan ayrı çizileceği yakınlaştırmaya getirir.
 * `?havalimani=LTFM` haritayı 10 yakınlaştırmayla havalimanı merkezine götürür; senaryodaki taksi
 * uçağı (cruise.ts → TAXI_LOOP) orada merkezin 1–3 px yakınındadır ve IST kodu uçak simgesini örtmez
 * kuralı yüzünden çizilmez. Klavyeyle 5 kademe yakınlaştırılınca (15) taksi turu merkezin 20–90 px
 * doğusunda kalır, kod batıda ya da doğuda yer bulur.
 */
async function openAtPrimaryAirport(page: Page): Promise<void> {
  await page.goto(`/?havalimani=${icao}`)
  await waitForMap(page)
  // Kamera havalimanına gidince tablo yalnızca oradaki uçakları listeler (airports.spec.ts ile aynı).
  // Dar ekranda tablo kapalıdır; satırlar yine DOM'dadır.
  await expect(aircraftRow(page, TAXI_AIRCRAFT.hex)).toHaveCount(1, { timeout: 30_000 })
  await expect(aircraftRow(page, FAR_AIRCRAFT.hex)).toHaveCount(0, { timeout: 30_000 })
  await page.locator('.live-map .maplibregl-canvas').focus()
  // MapLibre klavye denetimi: "=" bir kademe yakınlaştırır, merkez yerinde kalır.
  for (let i = 0; i < 5; i++) await page.keyboard.press('Equal')
}

/** IATA kod kutusunun kenar rengi (`MAP_COLORS.labelBorder`, D-081): #B9E2E6. */
const CHIP_BORDER = { r: 185, g: 226, b: 230 }
/** Pinin başı ucunun (havalimanı merkezi) ~15 px yukarısındadır (airport-pin.ts). */
const PIN_HEAD_OFFSET_PX = 15

/**
 * IST kodunun ortasına tıklar. Kodlar `.live-map__labels` tuvaline çizilir (DOM'da yoktur). Uçak
 * etiketleri de kod kutusu gibi beyaz zeminli ve #B9E2E6 kenarlıdır (D-081): tuvaldeki beyaz
 * pikseller tek bir kutu sayılmaz. Bunun yerine beyaz pikseller bağlı bölgelere ayrılır; kod kutusu
 * boyutunda (iç beyazı 11–15 px yüksek, en çok 48 px geniş; uçak etiketi daha yüksektir) ve sol ile
 * sağ kenarı #B9E2E6 tonunda olan bölgeler aday sayılır; IST pininin başına (harita ortası:
 * `?havalimani=LTFM` ve klavyeyle yakınlaştırma merkezi korur) en yakın aday tıklanır. Taksi uçağı
 * ilerledikçe kod yer değiştirebileceği için tıklama pencere açılana kadar yinelenir.
 */
async function clickPrimaryChip(page: Page): Promise<void> {
  const popup = airportPopup(page)
  await expect(async () => {
    const center = await mapCenter(page)
    const head = { x: center.x, y: center.y - PIN_HEAD_OFFSET_PX }
    const chip = await page.locator('.live-map .live-map__labels').evaluate(
      (element, { head, border }) => {
        const canvas = element as HTMLCanvasElement
        const ctx = canvas.getContext('2d')
        if (!ctx || canvas.width === 0) return null
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const rect = canvas.getBoundingClientRect()
        const scale = canvas.width / rect.width
        const isWhite = (p: number) =>
          data[p * 4] === 255 &&
          data[p * 4 + 1] === 255 &&
          data[p * 4 + 2] === 255 &&
          data[p * 4 + 3] === 255
        // Kenar: beyaz bölgenin dışındaki ilk 3 pikselden biri #B9E2E6 tonundadır. Kutu kesirli
        // konumdaysa kenar çizgisi kenarı yumuşatılır: ilk piksel beyaza yakın, kenar rengi bir
        // sonrakinde, tuvalin saydam zemininde de yarı saydam kalır.
        const hasEdge = (x0: number, y: number, step: -1 | 1) => {
          for (let k = 1; k <= 3; k++) {
            const x = x0 + step * k
            if (x < 0 || y < 0 || x >= width || y >= height) return false
            const i = (y * width + x) * 4
            const [r = 0, g = 0, b = 0, a = 0] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
            if (
              a >= 30 &&
              g - r >= 12 &&
              b - r >= 12 &&
              Math.abs(g - border.g) <= 30 &&
              Math.abs(b - border.b) <= 30
            ) {
              return true
            }
          }
          return false
        }
        const seen = new Uint8Array(width * height)
        const candidates: { x: number; y: number; width: number; height: number }[] = []
        for (let start = 0; start < width * height; start++) {
          if (seen[start] || !isWhite(start)) continue
          seen[start] = 1
          const stack = [start]
          let minX = width
          let minY = height
          let maxX = -1
          let maxY = -1
          while (stack.length > 0) {
            const p = stack.pop() ?? 0
            const x = p % width
            const y = (p - x) / width
            minX = Math.min(minX, x)
            maxX = Math.max(maxX, x)
            minY = Math.min(minY, y)
            maxY = Math.max(maxY, y)
            for (const q of [p - 1, p + 1, p - width, p + width]) {
              if (q < 0 || q >= width * height || seen[q]) continue
              if (Math.abs((q % width) - x) > 1) continue
              if (!isWhite(q)) continue
              seen[q] = 1
              stack.push(q)
            }
          }
          const w = (maxX - minX + 1) / scale
          const h = (maxY - minY + 1) / scale
          // Kod kutusu 16 px yüksektir (iç beyazı ~14 px); uçak etiketi en az 20 px (iç beyazı ~18 px).
          if (h < 11 || h > 15 || w < 14 || w > 48) continue
          const midY = Math.round((minY + maxY) / 2)
          if (!hasEdge(minX, midY, -1) || !hasEdge(maxX, midY, 1)) continue
          candidates.push({
            x: rect.left + (minX + maxX + 1) / 2 / scale,
            y: rect.top + (minY + maxY + 1) / 2 / scale,
            width: w,
            height: h,
          })
        }
        const distance = (c: { x: number; y: number }) => Math.hypot(c.x - head.x, c.y - head.y)
        return candidates.sort((a, b) => distance(a) - distance(b))[0] ?? null
      },
      { head, border: CHIP_BORDER },
    )
    expect(chip, 'IST kodu tuvalde çizili').not.toBeNull()
    if (!chip) return
    // Kod pin başının yanındadır (sağında, solunda, üstünde ya da noktanın altında; D-079).
    expect(Math.hypot(chip.x - head.x, chip.y - head.y)).toBeLessThanOrEqual(80)
    await page.mouse.click(chip.x, chip.y)
    await expect(popup).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
}
