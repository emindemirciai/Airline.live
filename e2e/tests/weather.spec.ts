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
//   sayfayla aynı satırları, sıcaklık kutucuğunu ve vurguyu taşır (kullanıcı kararı 2026-10-02);
//   pencerenin havası tek havalimanı isteğiyle gelir, toplu yanıt istenmez (M6h, D-090)
// - M6e (D-083): rüzgâr km/sa ve parantezde kt; etkili rüzgârın satırı kehribar ve şiddetin adı
//   etiketle; havalimanında ve çevresinde oraj ile kümülonimbüste şimşek ve yıldırım uyarısı (metin ve
//   kehribar vurgu)
// - M6e.1 (D-083, kullanıcı geri bildirimi 2026-10-03): pencere tek hizalı tablodur; IST ve LTAI
//   pencerelerinde iki dilde ve 1280, 768, 430, 375 ve 320 px'te her satırın simgesi, etiketi ve
//   değeri aynı x'te, simge etiketin ilk satırının yanında (kırılan etikette de), başlık ve diğer
//   yazılar simge sütunuyla aynı sol kenarda, kapat düğmesi sağda (ölçülür), yatay taşma yok
// - M6e.2 (D-083, kullanıcı kararı 2026-10-03): rüzgâr satırı ortalama ≥ 17 kt ya da hamle ≥ 25 kt'de
//   kehribar ve şiddetin adıyla (LTAI `20015G28KT` "Hamleli rüzgâr"), gösterilen hız ≤ 10 km/sa'da
//   açık yeşil ve "Hafif rüzgâr" etiketiyle (LTAJ `09005KT`)
// - M6e.3 (D-083, kullanıcı isteği 2026-10-04): rüzgâr satırı derecelendirilmiştir, rüzgâr varsa her
//   zaman renklidir ve basamağın adı yazılır: açık yeşil (LTAJ), limon yeşili "Hafif-orta rüzgâr"
//   (LTDB `18006KT`, 11 km/sa; D-116'dan beri bu ad), sarı "Orta rüzgâr" (LTAC `32012KT`, 22 km/sa),
//   kehribar (LTAI "Hamleli rüzgâr"), turuncu (IST `03018G32KT` "Kuvvetli hamle", meydan uyarısı);
//   her basamağın zemini ve yazı rengi (kırmızı dahil) ölçülür
import { expect, test, type Locator, type Page } from '@playwright/test'
import { jsonLdBlocks, metaContents, titles } from '../html'
import { canvasChips, mapCenter } from '../label-canvas'
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
  searchInput,
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
 * Hizası ölçülen havalimanı pencereleri ve vurgulu satırları (fixture: IST
 * `03018G32KT -SHRA FEW025CB`, LTAI `20015G28KT +TSRA SCT015CB`; LTAI'nin rüzgârı M6e.2'den beri
 * hamle 25 kt eşiğiyle kehribardır, IST'ninki M6e.3'ten beri meydan uyarısı turuncusudur, D-083).
 */
const ALIGNED_AIRPORTS = [
  { icao: 'LTFM', iata: 'IST', tones: ['strong', 'rain', 'thunder'] },
  { icao: 'LTAI', iata: 'AYT', tones: ['fresh', 'rain', 'thunder'] },
] as const

/**
 * Rüzgâr basamaklarının zemini ve yazısı (weather-rows.css; M6e.3, D-083): açık yeşil, limon yeşili,
 * sarı, kehribar, turuncu, kırmızı. Fixture'da kırmızı basamak yoktur; renkleri satırın `data-tone`'u
 * tarayıcıda değiştirilerek ölçülür.
 */
const WIND_TONES = [
  { tone: 'calm', background: 'rgb(220, 252, 231)', color: 'rgb(22, 101, 52)' },
  { tone: 'breeze', background: 'rgb(236, 252, 203)', color: 'rgb(63, 98, 18)' },
  { tone: 'moderate', background: 'rgb(253, 249, 176)', color: 'rgb(113, 90, 0)' },
  { tone: 'fresh', background: 'rgb(254, 243, 199)', color: 'rgb(146, 64, 14)' },
  { tone: 'strong', background: 'rgb(255, 237, 213)', color: 'rgb(154, 52, 18)' },
  { tone: 'storm', background: 'rgb(254, 226, 226)', color: 'rgb(153, 27, 27)' },
] as const

/**
 * En uzun pencere etiketi (packages/i18n → `weather.rows.other`): TR'de 8rem'lik etiket sütununda iki
 * satıra kırılır, EN tek satırdır. Fixture'da diğer hava olayı yoktur; satır tarayıcıda eklenir
 * (`addOtherWeatherRow`).
 */
const OTHER_WEATHER = { tr: 'Diğer hava olayları', en: 'Other weather' } as const

/** "Havalimanları" düğmesinin adı (packages/i18n → `map.airportList.button`). */
const AIRPORT_LIST_BUTTON = { tr: 'Havalimanları', en: 'Airports' } as const

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
    /**
     * km/sa ve parantezde knot (D-083): "33 km/sa (18 kt)". Boşluklar bölünmezdir (U+00A0): hız dar
     * sütunda iki satıra bölünmez (`expectPopupAligned` satırları ayrıca ölçer).
     */
    speedDual: /\d+\u00a0km\/sa\u00a0\(\d+\u00a0kt\)/,
    gust: 'hamle',
    /**
     * Fixture IST `03018G32KT`: ortalama meydan uyarısı eşiğinin altında, hamle 32 kt → "Kuvvetli
     * hamle", turuncu (D-083; M6e.3).
     */
    windLevel: 'Kuvvetli hamle',
    /** Fixture LTAI `20015G28KT`: hamle 25 kt'yi geçti, 30 kt'nin altında (M6e.2, D-083). */
    gustyLevel: 'Hamleli rüzgâr',
    /** Fixture LTAJ `09005KT`: 9 km/sa, açık yeşil satır ve etiket (M6e.2, D-083). */
    lightWind: 'Hafif rüzgâr',
    /** Fixture LTDB `18006KT`: 11 km/sa, limon yeşili (M6e.3, D-083; ad D-116). */
    breezeWind: 'Hafif-orta rüzgâr',
    /** Fixture LTAC `32012KT`: 22 km/sa, sarı (M6e.3, D-083). */
    moderateWind: 'Orta rüzgâr',
    rainValue: 'Hafif sağanak yağmur',
    none: 'Yok',
    cb: 'kümülonimbüs',
    /**
     * Fixture IST `-SHRA FEW025CB`: kümülonimbüs ve havalimanında yağış, oraj bildirilmedi. "Yok"
     * denmez, tehlike yazılır (kullanıcının sözü, 2026-10-03; D-083).
     */
    lightningCbPrecip: 'Kümülonimbüs (oraj bulutu) ve yağış var; şimşek ve yıldırım tehlikesi',
    lightningHere: 'Gök gürültüsü var; şimşek ve yıldırım tehlikesi',
    lightningNear: 'Havalimanı çevresinde gök gürültüsü var; yıldırım havalimanına da düşebilir',
    observed: /Gözlem \d{2}:\d{2}/,
    observedAgo: /Gözlem \d{2}:\d{2}, (az önce|\d.* önce)/,
    /** Türkiye: yerel saat UTC+3 (D-084'te değişmedi). */
    localTime: /Yerel saat \d{2}:\d{2} \(UTC\+3\)/,
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
    speedDual: /\d+\u00a0km\/h\u00a0\(\d+\u00a0kt\)/,
    gust: 'gusts',
    windLevel: 'Strong gusts',
    gustyLevel: 'Gusty wind',
    lightWind: 'Light wind',
    breezeWind: 'Gentle breeze',
    moderateWind: 'Moderate wind',
    rainValue: 'Light rain showers',
    none: 'None',
    cb: 'cumulonimbus',
    lightningCbPrecip:
      'Cumulonimbus (thunderstorm cloud) and precipitation present; lightning danger',
    lightningHere: 'Thunderstorm at the airport; lightning danger',
    lightningNear: 'Thunderstorm near the airport; lightning can strike the airport too',
    observed: /Observed \d{2}:\d{2}/,
    observedAgo: /Observed \d{2}:\d{2}, (just now|\d.* ago)/,
    localTime: /Local time \d{2}:\d{2} \(UTC\+3\)/,
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
 * satırı vurgulu, "Yok" satırları sade; meydan uyarısı eşiğindeki rüzgâr turuncu (M6e.3) ve
 * kümülonimbüsün yıldırım olasılığı kehribar vurgulu (D-083); simgeler ekran okuyucudan gizli; sayıdan
 * önce ayraç yok.
 */
async function expectWeatherPresentation(scope: Locator, locale: Locale): Promise<void> {
  const copy = COPY[locale]
  await expect(scope.locator('.wx-temp').first()).toHaveText(TEMPERATURE_CHIP)
  const rainRow = row(scope, copy.rows.rain).locator('xpath=..')
  await expect(rainRow).toHaveAttribute('data-tone', 'rain')
  // Vurgu yalnız renk değildir: değer kalındır ve olayın adını yazar.
  await expect(row(scope, copy.rows.rain)).toHaveCSS('font-weight', '700')
  // Rüzgâr km/sa ve kt; hamle meydan uyarısı eşiğini aştı: satır turuncu, şiddetin adı etiket olarak
  // yazılır (M6e.3, D-083).
  const wind = row(scope, copy.rows.wind)
  const strong = WIND_TONES[4]
  await expect(wind).toContainText(copy.speedDual)
  await expect(wind.locator('xpath=..')).toHaveAttribute('data-tone', strong.tone)
  await expect(wind.locator('xpath=..')).toHaveCSS('background-color', strong.background)
  await expect(wind).toHaveCSS('color', strong.color)
  await expect(wind.locator('.wx-tag')).toHaveText(copy.windLevel)
  await expect(wind).toHaveCSS('font-weight', '700')
  // Kümülonimbüs ve yağış var, gök gürültüsü bildirilmedi: tehlike yazılır; kehribar.
  const thunder = row(scope, copy.rows.thunder)
  await expect(thunder).toHaveText(new RegExp(`^\\s*${escapeRegExp(copy.lightningCbPrecip)}\\s*$`))
  await expect(thunder.locator('xpath=..')).toHaveAttribute('data-tone', 'thunder')
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
      await expect(wind).toContainText(copy.speedDual)
      await expect(wind).toContainText(copy.gust)
      await expect(section).toContainText(copy.windLevel)
      await expect(row(section, copy.rows.rain)).toContainText(copy.rainValue)
      await expect(row(section, copy.rows.snow)).toHaveText(new RegExp(`^\\s*${copy.none}\\s*$`))
      // Gök gürültüsü bildirilmedi, ama kümülonimbüs bulutu ve yağış var (-SHRA FEW025CB): "Yok"
      // denmez, şimşek ve yıldırım tehlikesi yazılır (kullanıcının sözü, 2026-10-03).
      const thunder = row(section, copy.rows.thunder)
      await expect(thunder).not.toHaveText(new RegExp(`^\\s*${copy.none}\\b`))
      await expect(thunder).toContainText(copy.lightningCbPrecip)
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

  for (const locale of ['tr', 'en'] as const) {
    const copy = COPY[locale]
    const path = (code: string) =>
      locale === 'tr' ? `/istasyon/${code}` : enPath(`/istasyon/${code}`)

    test(`${locale}: havalimanında ve çevresinde oraj, şimşek ve yıldırım uyarısı; rüzgâr renkleri (D-083)`, async ({
      page,
    }) => {
      // LTAI (fixture `+TSRA SCT015CB`): havalimanında oraj; tehlike metni ve kehribar vurgu. Yağmur
      // satırı olayın kendisini mavi yazar. Rüzgâr (15 kt, hamle 28 kt) meydan uyarısının altında ama
      // hamle 25 kt'yi geçti: kehribar, "Hamleli rüzgâr" (M6e.2, kullanıcı kararı 2026-10-03).
      await page.goto(path('LTAI'))
      const here = weatherSection(page, locale)
      const thunder = row(here, copy.rows.thunder)
      await expect(thunder).toHaveText(new RegExp(`^\\s*${escapeRegExp(copy.lightningHere)}\\s*$`))
      await expect(thunder.locator('xpath=..')).toHaveAttribute('data-tone', 'thunder')
      await expect(thunder).toHaveCSS('font-weight', '700')
      await expect(row(here, copy.rows.rain).locator('xpath=..')).toHaveAttribute(
        'data-tone',
        'rain',
      )
      const gusty = row(here, copy.rows.wind)
      const fresh = WIND_TONES[3]
      await expect(gusty).toContainText(copy.speedDual)
      await expect(gusty.locator('xpath=..')).toHaveAttribute('data-tone', fresh.tone)
      await expect(gusty.locator('xpath=..')).toHaveCSS('background-color', fresh.background)
      await expect(gusty).toHaveCSS('color', fresh.color)
      await expect(gusty.locator('.wx-tag')).toHaveText(copy.gustyLevel)

      // LTAJ (fixture `09005KT`, 9 km/sa): açık yeşil satır; renk tek ipucu değildir, yanında
      // "Hafif rüzgâr" etiketi (M6e.2, D-083).
      await page.goto(path('LTAJ'))
      const light = row(weatherSection(page, locale), copy.rows.wind)
      await expect(light).toContainText(copy.speedDual)
      await expect(light.locator('xpath=..')).toHaveAttribute('data-tone', 'calm')
      await expect(light.locator('xpath=..')).toHaveCSS('background-color', 'rgb(220, 252, 231)')
      await expect(light).toHaveCSS('color', 'rgb(22, 101, 52)')
      await expect(light.locator('.wx-tag')).toHaveText(copy.lightWind)

      // Derecelendirilmiş rüzgâr (M6e.3, kullanıcı isteği 2026-10-04): LTDB `18006KT` (11 km/sa)
      // limon yeşili "Hafif-orta rüzgâr", LTAC `32012KT` (22 km/sa) sarı "Orta rüzgâr"; eskiden
      // sadeydi. Etiket beyaz zeminde satırın yazı rengindedir.
      for (const [code, tone, tag] of [
        ['LTDB', WIND_TONES[1], copy.breezeWind],
        ['LTAC', WIND_TONES[2], copy.moderateWind],
      ] as const) {
        await page.goto(path(code))
        const wind = row(weatherSection(page, locale), copy.rows.wind)
        await expect(wind, code).toContainText(copy.speedDual)
        await expect(wind.locator('xpath=..'), code).toHaveAttribute('data-tone', tone.tone)
        await expect(wind.locator('xpath=..'), code).toHaveCSS('background-color', tone.background)
        await expect(wind, code).toHaveCSS('color', tone.color)
        await expect(wind, code).toHaveCSS('font-weight', '700')
        await expect(wind.locator('.wx-tag'), code).toHaveText(tag)
        await expect(wind.locator('.wx-tag'), code).toHaveCSS('color', tone.color)
        await expect(wind.locator('.wx-tag'), code).toHaveCSS(
          'background-color',
          'rgb(255, 255, 255)',
        )
      }

      // Her basamağın zemini ve yazısı (kırmızı fixture'da yok): LTAC'nin satırının basamağı
      // hidrasyondan sonra (göreli yaş yalnız istemcide yazılır) tarayıcıda değiştirilir.
      const section = weatherSection(page, locale)
      await expect(section).toContainText(copy.observedAgo)
      const windRow = row(section, copy.rows.wind).locator('xpath=..')
      for (const tone of WIND_TONES) {
        await windRow.evaluate(
          (element, value) => element.setAttribute('data-tone', value),
          tone.tone,
        )
        await expect(windRow, tone.tone).toHaveCSS('background-color', tone.background)
        await expect(windRow.locator('dd'), tone.tone).toHaveCSS('color', tone.color)
        await expect(windRow.locator('dt'), tone.tone).toHaveCSS('color', tone.color)
        await expect(windRow.locator('.wx-tag'), tone.tone).toHaveCSS('color', tone.color)
      }

      // LTAU (fixture `VCTS SCT040CB`): çevrede oraj; yıldırım havalimanına da düşebilir.
      await page.goto(path('LTAU'))
      const near = row(weatherSection(page, locale), copy.rows.thunder)
      await expect(near).toHaveText(new RegExp(`^\\s*${escapeRegExp(copy.lightningNear)}\\s*$`))
      await expect(near.locator('xpath=..')).toHaveAttribute('data-tone', 'thunder')
      expect(await weatherSection(page, locale).innerText()).not.toMatch(DASH_BEFORE_NUMBER)
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
      // Türkiye tablosu ilk tablodur; Türkiye dışındakilerin tablosu (M6d) onu izler.
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
    // Pencerenin hava isteği tek havalimanınındır (D-090); toplu yanıt (`/v1/weather`) istenmez.
    const weatherRequests: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.origin === API_URL && url.pathname.includes('weather')) {
        weatherRequests.push(`${url.pathname}${url.search}`)
      }
    })
    await openAtPrimaryAirport(page)
    const popup = airportPopup(page)

    await clickPrimaryChip(page)
    await expect(popup).toBeVisible()
    await expect(popup).toHaveAttribute('data-icao', icao)
    await expect(popup).toBeFocused()
    await expect(popup.getByRole('heading', { name: PRIMARY_AIRPORT.nameTr })).toBeVisible()
    await expect(popup).toContainText(`${iata} · ${icao}`)
    // Sayı ile birim bölünmez boşlukla (U+00A0): dar değer sütununda ayrı satıra düşmez (D-083).
    await expect(row(popup, 'Rakım')).toHaveText(/^\s*\d+\u00a0m \(\d+\u00a0ft\)\s*$/)
    await expect(row(popup, 'Pistler')).toHaveText(
      new RegExp(`^\\s*${PRIMARY_AIRPORT.runways} pist, en uzunu [\\d.]+\u00a0m\\s*$`),
    )
    // Yerel saat UTC farkıyla, her havalimanında aynı biçimde (D-084).
    await expect(row(popup, 'Yerel saat')).toHaveText(/^\s*\d{2}:\d{2} \(UTC\+3\)\s*$/)
    // Gün doğumu ve batımı yalnız havalimanı sayfasındadır (kullanıcı kararı 2026-10-02).
    await expect(popup).not.toContainText('Gün doğumu')
    await expect(popup).not.toContainText('Gün batımı')

    // Hava durumu ilk açılışta havalimanının kendi isteğiyle gelir (`/v1/airports/LTFM/weather`,
    // D-090; harita açılışında istek yok); havalimanı sayfasıyla aynı sözcükler.
    const weather = popup.getByRole('region', { name: 'Hava durumu' })
    await expect(row(weather, COPY.tr.rows.wind)).toContainText(COPY.tr.speedUnit, {
      timeout: 15_000,
    })
    expect(weatherRequests).toEqual([`/v1/airports/${icao}/weather`])
    await expect(weather).toContainText(COPY.tr.windLevel)
    await expect(row(weather, COPY.tr.rows.rain)).toContainText(COPY.tr.rainValue)
    await expect(row(weather, COPY.tr.rows.snow)).toContainText(COPY.tr.none)
    await expect(row(weather, COPY.tr.rows.thunder)).toContainText(COPY.tr.lightningCbPrecip)
    await expect(row(weather, COPY.tr.rows.fog)).toContainText(COPY.tr.none)
    await expect(weather).toContainText(COPY.tr.observedAgo)
    await expectWeatherPresentation(weather, 'tr')
    await expect(popup.getByRole('link', { name: /Havalimanı sayfası/ })).toHaveAttribute(
      'href',
      STATION_PATH,
    )
    // Tek hizalı tablo; pencerenin genişliği değişmedi (320 px).
    const aligned = await expectPopupAligned(popup, 'tr')
    expect(Math.abs(aligned.width - 320)).toBeLessThanOrEqual(1)

    // Escape kapatır; odak haritaya döner.
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
    await expect(page.locator('.live-map .maplibregl-canvas')).toBeFocused()

    // Haritada boş bir yere tıklamak kapatır: havalimanı merkezinin kuzeybatısı (taksi turu doğuda,
    // yaklaşma hattı güneydedir). Merkezden 450 px batıya tıklanır: pencere hangi yanda olursa olsun
    // (merkezden en çok 44 + 320 px; sağ üstteki liste yüzünden genellikle solda, D-085) tıklama
    // pencerenin dışında ve arama kutusunun altında kalır.
    await clickPrimaryChip(page)
    await expect(popup).toBeVisible()
    const center = await mapCenter(page)
    await page.mouse.click(center.x - 450, center.y - 100)
    await expect(popup).toBeHidden()

    // Uçak seçmek pencereyi kapatır ve bilgi kartını açar. Arama kutusundayken basılan Escape
    // arama kutusunundur: pencere açık kalır.
    await clickPrimaryChip(page)
    await expect(popup).toBeVisible()
    const input = searchInput(page)
    await input.fill(REPLAY_AIRCRAFT.callsign)
    await input.press('Escape')
    await expect(popup).toBeVisible()
    await input.fill(REPLAY_AIRCRAFT.callsign)
    await input.press('Enter')
    await expect(infoCard(page)).toContainText(REPLAY_AIRCRAFT.callsign)
    await expect(popup).toBeHidden()
  })

  /*
   * Tek hizalı tablo (M6e.1; kullanıcı geri bildirimi 2026-10-03, D-083): M6e'nin ortalı düzeni
   * üretimde yamuk göründü. IST (rüzgâr, yağmur ve yıldırım satırı vurgulu) ve LTAI (havalimanında
   * oraj: yağmur ve gök gürültüsü satırı vurgulu; 1280 px'te "3.400 m" kırılıyordu) pencereleri iki
   * dilde ve beş genişlikte ölçülür. Pencere "Havalimanları" listesinden açılır (klavye yolu; pin ve
   * kod tıklaması yukarıdaki testlerde). Sayfa bir kez yüklenir, genişlik pencere açıkken değişir
   * (767 px'in altında alt sayfa olur): API WebSocket el sıkışmasını IP başına dakikada 30 sayfa
   * yüklemesiyle sınırlar (`wsRateLimit`; geliştirme sunucusunda StrictMode yüklemede iki el
   * sıkışması açar, sınır orada 60'tır, D-088), genişlik başına yeniden yükleme sonraki testlerin
   * canlı verisini kesiyordu. Aynı nedenle üçüncü bir havalimanı (LGAV) eklenmedi; hizası aynı kurallarla elle
   * ölçüldü (D-083). Sonda kırılan etiket denenir: "Diğer hava olayları" satırı eklenir, simgesi
   * ilk satırın yanında kalmalı (denetim 2026-10-03: iki satırın ortasındaydı).
   */
  for (const locale of ['tr', 'en'] as const) {
    for (const airport of ALIGNED_AIRPORTS) {
      test(`${locale}: ${airport.iata} penceresi tek hizalı tablo (1280, 768, 430, 375, 320 px), yatay taşma yok`, async ({
        page,
      }) => {
        const popup = await openPopupFromList(page, locale, airport)
        for (const width of [1280, 768, 430, 375, 320]) {
          await page.setViewportSize({ width, height: width >= 768 ? 800 : 812 })
          const sheet = width < 768
          // Geniş ekranda pencere noktanın yanına konur (`transform`); alt sayfada yer verilmez.
          if (sheet) await expect(popup).toHaveCSS('transform', 'none')
          await expect(popup).toHaveAttribute('data-placed', 'true')
          const aligned = await expectPopupAligned(popup, locale)
          // Vurgulu satırlar ölçüme girdi (vurgu zemini ve kalın yazı da aynı ızgarada).
          expect(aligned.tones, `${width} px`).toEqual(expect.arrayContaining([...airport.tones]))
          if (sheet) {
            // Alt sayfa haritanın bütün genişliğindedir. Harita tuvali yeni genişliğe bir sonraki
            // karede uyar (ResizeObserver); eski genişlikle (ör. 375 px'ten 320'ye inince 375)
            // ölçmemek için önce tuvalin pencereye sığmasını bekle (main CI'da bir kez kırmızıydı).
            const canvas = page.locator('.live-map .maplibregl-canvas')
            await expect
              .poll(async () => (await canvas.boundingBox())?.width ?? Infinity, {
                message: `${width} px: harita tuvali yeni genişlikte`,
              })
              .toBeLessThanOrEqual(width)
            const map = await canvas.boundingBox()
            expect(aligned.width, `${width} px`).toBeGreaterThanOrEqual((map?.width ?? 0) - 2)
          } else {
            // Geniş ekranda pencere 320 px'tir (değişmedi).
            expect(Math.abs(aligned.width - 320), `${width} px`).toBeLessThanOrEqual(1)
          }
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          )
          expect(overflow, `${width} px: sayfa yatay kaymaz`).toBeLessThanOrEqual(0)
        }

        // Kırılan etiket: TR "Diğer hava olayları" iki satır, EN "Other weather" tek satır. Simge
        // etiketin ilk satırının yanında, değer o satırla aynı yükseklikte (`expectPopupAligned`).
        for (const width of [320, 1280]) {
          await page.setViewportSize({ width, height: width >= 768 ? 800 : 812 })
          await expect(popup).toHaveAttribute('data-placed', 'true')
          await addOtherWeatherRow(popup, locale)
          const aligned = await expectPopupAligned(popup, locale)
          expect(aligned.labelLines.other, `${width} px: etiket satırı`).toBe(
            locale === 'tr' ? 2 : 1,
          )
        }
      })
    }
  }

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
  // genişlemez, değer sütunu daralmaz, rüzgâr şiddeti etiketi ("Kuvvetli hamle") değerin kutusundan
  // taşmaz.
  const LONG_LABEL = { tr: 'Gözlemden sonraki 2 saat', en: '2 hours after the observation' }

  for (const width of [412, 430, 560]) {
    for (const locale of ['tr', 'en'] as const) {
      test(`${width} px, ${locale}: değer sütunu ve rüzgâr şiddeti etiketi kutusunda`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(COPY[locale].path)
        const section = weatherSection(page, locale)
        const rows = section.locator('.wx-rows--page')
        await expect(rows.locator('.wx-tag')).toHaveText(COPY[locale].windLevel)
        // Etiket DOM'da elle değiştirilir: önce ada çizilmiş olmalı (göreli yaş yalnız istemcide
        // yazılır). Hidrasyondan önce değiştirilen metin uyuşmazlık sayılır, React satırları yeniden
        // kurar ve ölçüm arada sıfır genişlik okuyabilirdi (yerelde 24 koşuda bir).
        await expect(section).toContainText(COPY[locale].observedAgo)
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

/**
 * Haritayı havalimanında açar (`?havalimani=`; dil adreste) ve pencereyi "Havalimanları"
 * listesinden açar. Liste görünümdeki havalimanlarını açıldığı anda yazar: kamera daha
 * yerleşmediyse öğe yoktur, liste kapatılıp yeniden açılır.
 */
async function openPopupFromList(
  page: Page,
  locale: Locale,
  airport: { icao: string; iata: string },
): Promise<Locator> {
  const path = `/?havalimani=${airport.icao}`
  await page.goto(locale === 'tr' ? path : enPath(path))
  await waitForMap(page)
  const toggle = page.getByRole('button', { name: AIRPORT_LIST_BUTTON[locale], exact: true })
  const item = page.getByRole('button', { name: new RegExp(`^${airport.iata}\\b`) })
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click()
    await toggle.click()
    await item.click({ timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
  const popup = page.locator(`.live-map [role="dialog"].map-popup[data-icao="${airport.icao}"]`)
  await expect(popup).toBeVisible()
  return popup
}

/**
 * Pencere tek hizalı tablo mu (M6e.1; kullanıcı geri bildirimi 2026-10-03, D-083). Tarayıcıda
 * ölçülür (CSS px, ±1 px):
 * - Bilgi satırları (rakım, pistler, yerel saat) ve hava durumu satırları: her satırın simgesi
 *   (18 px) aynı x'te ve bu x pencerenin içerik kenarıdır; etiket yazısı aynı x'te; değer yazısı aynı
 *   x'te. Değer kendi sütununda kırılır (hiçbir satır kutusu değer x'inin solunda başlamaz), etiket
 *   değer sütununa taşmaz.
 * - Dikeyde: simgenin ortası etiketin ilk satırının ortasındadır, etiketin ilk satırı değerin ilk
 *   satırıyla aynı yükseklikte başlar. Etiket kırılsa da simge ilk satırın yanında kalır (denetim
 *   2026-10-03: `align-items: center` simgeyi iki satırın ortasına koyuyordu).
 * - Satır kutuları aynı sol ve sağ kenardadır: vurgu zemini bütün satırı kaplar, vurgulu ve sade
 *   satır aynı ızgaradadır.
 * - Kodlar, ad, yer satırı, "Hava durumu", hava başlığı, gözlem satırı ve "Havalimanı sayfası →"
 *   yazısı simge sütunuyla aynı sol kenardadır (M6e'de ortalıydı: kırmızı). Hava başlığında sıcaklık
 *   kutucuğu başlığın hemen yanındadır (öğeler arası boşluk `column-gap` + 1 px'i geçmez). Kapat
 *   düğmesi sağ kenardadır ve başlık bloğunun yazısıyla örtüşmez.
 * - Pencere yatay kaymaz. Rüzgâr satırındaki her hız ("59 km/sa (32 kt)") ile rakım ve en uzun
 *   pistin her uzunluğu ("99 m", "325 ft", "4.100 m") tek satırdadır (bölünmez boşluk, D-083).
 * Hava durumu satırları gelene kadar bekler. Dönüş: pencere genişliği, vurgulu satırların tonları ve
 * her satırın etiketinin kaç satır olduğu (`data-row` → satır sayısı).
 */
async function expectPopupAligned(
  popup: Locator,
  locale: Locale,
): Promise<{ width: number; tones: string[]; labelLines: Record<string, number> }> {
  const copy = COPY[locale]
  const weather = popup.getByRole('region', { name: copy.heading })
  await expect(row(weather, copy.rows.wind)).toContainText(copy.speedUnit, { timeout: 15_000 })
  const layout = await popup.evaluate((root) => {
    const visible = (range: Range) =>
      [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
    const contents = (element: Element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return visible(range)
    }
    const minLeft = (rects: DOMRect[]) =>
      rects.length > 0 ? Math.min(...rects.map((rect) => rect.left)) : Number.NaN
    const maxRight = (rects: DOMRect[]) =>
      rects.length > 0 ? Math.max(...rects.map((rect) => rect.right)) : Number.NaN
    const box = root.getBoundingClientRect()
    const contentLeft =
      box.left + root.clientLeft + Number.parseFloat(getComputedStyle(root).paddingLeft)
    const rows = [...root.querySelectorAll('.wx-row')].map((element) => {
      const dt = element.querySelector(':scope > dt')
      const dd = element.querySelector(':scope > dd')
      // Etiketin yazısı: `<dt>`'deki metin düğümleri (simge hariç).
      const texts = [...(dt?.childNodes ?? [])].filter(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
      )
      const first = texts[0]
      const last = texts.at(-1)
      const label = document.createRange()
      if (first && last) {
        label.setStart(first, 0)
        label.setEnd(last, (last.textContent ?? '').length)
      }
      const labelRects = first ? visible(label) : []
      const icon = dt?.querySelector('.wx-icon')?.getBoundingClientRect()
      const valueRects = dd ? contents(dd) : []
      const rowBox = element.getBoundingClientRect()
      // Etiketin ilk satırı: en üstteki satır kutusu (kırılan etikette iki kutu vardır).
      const labelFirst = labelRects.reduce<DOMRect | undefined>(
        (top, rect) => (top && top.top <= rect.top ? top : rect),
        undefined,
      )
      return {
        key: element.getAttribute('data-row') ?? '',
        facts: element.parentElement?.classList.contains('map-popup__facts') ?? false,
        tone: element.getAttribute('data-tone'),
        iconLeft: icon?.left ?? Number.NaN,
        iconWidth: icon?.width ?? Number.NaN,
        iconMiddle: icon ? (icon.top + icon.bottom) / 2 : Number.NaN,
        labelLeft: minLeft(labelRects),
        labelRight: maxRight(labelRects),
        labelLines: new Set(labelRects.map((rect) => Math.round(rect.top))).size,
        labelFirstTop: labelFirst?.top ?? Number.NaN,
        labelFirstMiddle: labelFirst ? (labelFirst.top + labelFirst.bottom) / 2 : Number.NaN,
        valueLeft: minLeft(valueRects),
        valueTop:
          valueRects.length > 0 ? Math.min(...valueRects.map((rect) => rect.top)) : Number.NaN,
        rowLeft: rowBox.left,
        rowRight: rowBox.right,
      }
    })
    // Başlık bloğu (kodlar, ad, yer) ve kapat düğmesi.
    const heading = root.querySelector('.map-popup__heading')
    const closeButton = root.querySelector('.map-popup__header > button')?.getBoundingClientRect()
    const contentRight =
      box.left +
      root.clientLeft +
      root.clientWidth -
      Number.parseFloat(getComputedStyle(root).paddingRight)
    const header = {
      textRight: heading ? maxRight(contents(heading)) : Number.NaN,
      closeLeft: closeButton?.left ?? Number.NaN,
      closeRight: closeButton?.right ?? Number.NaN,
      contentRight,
    }
    const blocks = [
      '.map-popup__codes',
      '.map-popup__title',
      '.map-popup__place',
      '.map-popup__subheading',
      '.map-popup__headline',
      '.map-popup__note',
      '.map-popup__observed',
      '.map-popup__link',
    ].flatMap((selector) => {
      const element = root.querySelector(selector)
      // Not yalnız gecikmiş gözlemde vardır; diğerleri her zaman.
      if (!element) return selector === '.map-popup__note' ? [] : [{ selector, left: Number.NaN }]
      return [{ selector, left: minLeft(contents(element)) }]
    })
    // Hava başlığı: başlık ve sıcaklık kutucuğu; dikeyde örtüşen öğeler aynı satırdadır.
    const headline = root.querySelector('.map-popup__headline')
    const columnGap = headline ? Number.parseFloat(getComputedStyle(headline).columnGap) || 0 : 0
    const lines: { top: number; bottom: number; right: number; items: number; maxGap: number }[] =
      []
    for (const child of headline?.children ?? []) {
      const rect = child.getBoundingClientRect()
      if (rect.width === 0) continue
      const line = lines.find((l) => rect.top < l.bottom && rect.bottom > l.top)
      if (!line) {
        lines.push({ top: rect.top, bottom: rect.bottom, right: rect.right, items: 1, maxGap: 0 })
        continue
      }
      line.maxGap = Math.max(line.maxGap, rect.left - line.right)
      line.right = Math.max(line.right, rect.right)
      line.items += 1
    }
    // Eşleşen her parçanın satır kutuları (Range.getClientRects) tek satırda mı. `\s` bölünmez
    // boşluğu da kapsar: parça olağan boşlukla yazılsa da bulunur ve ölçülür.
    const pieces = (selector: string, pattern: RegExp) =>
      [...root.querySelectorAll(selector)].flatMap((element) => {
        const found: { text: string; lines: number }[] = []
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          for (const match of (node.textContent ?? '').matchAll(pattern)) {
            const range = document.createRange()
            range.setStart(node, match.index ?? 0)
            range.setEnd(node, (match.index ?? 0) + match[0].length)
            const tops = visible(range).map((rect) => Math.round(rect.top))
            found.push({ text: match[0], lines: new Set(tops).size })
          }
        }
        return found
      })
    return {
      width: box.width,
      overflow: root.scrollWidth - root.clientWidth,
      contentLeft,
      rows,
      header,
      blocks,
      headline: { columnGap, lines },
      // Rüzgâr hızları ("59 km/sa (32 kt)").
      speeds: pieces('.wx-row[data-row="wind"] > dd', /\d+\s(?:km\/sa|km\/h)\s\(\d+\skt\)/g),
      // Rakım ve en uzun pist: sayı ve birimi ("99 m", "325 ft", "4.100 m").
      lengths: pieces(
        '.wx-row[data-row="elevation"] > dd, .wx-row[data-row="runways"] > dd',
        /\d[\d.,]*\s(?:m|ft)(?![\p{L}])/gu,
      ),
    }
  })
  expect(layout.overflow, 'pencere yatay kaymaz').toBeLessThanOrEqual(0)

  // Rakım, pistler, yerel saat; rüzgâr, yağmur, kar, gök gürültüsü, sis ve pus, görüş.
  const { rows } = layout
  expect(rows.filter((r) => r.facts).map((r) => r.key)).toEqual([
    'elevation',
    'runways',
    'localTime',
  ])
  expect(rows.length).toBeGreaterThanOrEqual(9)
  const [first] = rows
  if (!first) throw new Error('satır yok')
  const iconX = first.iconLeft
  const labelX = first.labelLeft
  const valueX = first.valueLeft
  expect(Math.abs(iconX - layout.contentLeft), 'simge sütunu içerik kenarında').toBeLessThanOrEqual(
    1,
  )
  expect(labelX, 'etiket simgenin sağında').toBeGreaterThan(iconX)
  expect(valueX, 'değer etiketin sağında').toBeGreaterThan(labelX)
  for (const r of rows) {
    expect(Math.abs(r.iconWidth - 18), `${r.key}: simge yuvası 18 px`).toBeLessThanOrEqual(0.5)
    expect(Math.abs(r.iconLeft - iconX), `${r.key}: simge x`).toBeLessThanOrEqual(1)
    expect(Math.abs(r.labelLeft - labelX), `${r.key}: etiket x`).toBeLessThanOrEqual(1)
    expect(Math.abs(r.valueLeft - valueX), `${r.key}: değer x`).toBeLessThanOrEqual(1)
    // Etiket kendi sütununda kalır; değerin kırılan satırları etiketin altına geçmez (`valueLeft`
    // bütün satır kutularının en solu).
    expect(r.labelRight, `${r.key}: etiket değer sütununa taşmaz`).toBeLessThanOrEqual(valueX - 4)
    // Simge etiketin ilk satırının yanında (etiket kırılsa da); etiket ve değer aynı yükseklikte
    // başlar. Yazının kutusu (`Range`) satır kutusu değil, yazı tipinin yüksekliğidir: düzgün
    // satırda bile simgenin ortasından ~0,8 px ayrılır (Chromium, Windows). Pay 2 px'tir; kusur yarım
    // satırdır (~9,5 px, düzeltmesiz CSS'te ölçüldü).
    expect(
      Math.abs(r.iconMiddle - r.labelFirstMiddle),
      `${r.key}: simge etiketin ilk satırının ortasında`,
    ).toBeLessThanOrEqual(2)
    expect(
      Math.abs(r.labelFirstTop - r.valueTop),
      `${r.key}: etiket ve değer aynı yükseklikte`,
    ).toBeLessThanOrEqual(1)
    // Satır kutusu (vurgu zemini) bütün satırlarda aynı genişlikte.
    expect(Math.abs(r.rowLeft - first.rowLeft), `${r.key}: satırın sol kenarı`).toBeLessThanOrEqual(
      1,
    )
    expect(
      Math.abs(r.rowRight - first.rowRight),
      `${r.key}: satırın sağ kenarı`,
    ).toBeLessThanOrEqual(1)
  }
  // Başlık bloğu ve diğer yazılar simge sütunuyla aynı sol kenarda.
  for (const block of layout.blocks) {
    expect(Math.abs(block.left - iconX), `${block.selector}: sol kenar`).toBeLessThanOrEqual(1)
  }
  // Kapat düğmesi sağda (sağ payı −8 px, globals.css) ve başlık yazısıyla örtüşmez.
  const { header } = layout
  expect(header.closeRight, 'kapat düğmesi sağ kenarda').toBeGreaterThanOrEqual(
    header.contentRight - 1,
  )
  expect(header.textRight, 'başlık yazısı kapat düğmesinin solunda').toBeLessThanOrEqual(
    header.closeLeft,
  )
  // Hava başlığı ve sıcaklık kutucuğu bitişik (kenarlara yaslı değil).
  const { columnGap, lines } = layout.headline
  expect(
    lines.reduce((sum, line) => sum + line.items, 0),
    'başlık ve sıcaklık kutucuğu',
  ).toBe(2)
  for (const line of lines) {
    expect(line.maxGap, 'hava başlığı: öğeler arası boşluk').toBeLessThanOrEqual(columnGap + 1)
  }
  // Rüzgâr hızı iki satıra bölünmez ("48" ile "km/sa", "(7" ile "kt)" aynı satırda).
  expect(layout.speeds.length, 'rüzgâr hızı').toBeGreaterThanOrEqual(1)
  for (const speed of layout.speeds) expect(speed.lines, speed.text).toBe(1)
  // Rakım ve pist uzunluğu da tek parça: bölünmez boşluk ve tek satır ("4.100" ile "m" aynı satırda).
  expect(layout.lengths.length, 'rakım (m, ft) ve en uzun pist').toBeGreaterThanOrEqual(3)
  for (const length of layout.lengths) {
    expect(length.text, 'sayı ile birim arasında bölünmez boşluk').toMatch(/^[\d.,]+\u00a0(m|ft)$/)
    expect(length.lines, length.text).toBe(1)
  }
  return {
    width: layout.width,
    tones: rows.flatMap((r) => (r.tone ? [r.tone] : [])),
    labelLines: Object.fromEntries(rows.map((r) => [r.key, r.labelLines])),
  }
}

/**
 * Pencerenin hava durumu listesine "Diğer hava olayları" satırını ekler (yoksa). Fixture'da diğer
 * hava olayı yoktur: satır sis satırından kopyalanır, `data-row="other"` ve kehribar vurgu
 * (`data-tone="other"`, kalın yazı) alır, değeri uzun uyarı metnidir (kırılır). Pencere yeniden
 * çizilip kopya düşerse yeniden eklenir. Yalnız ölçüm içindir; React satırı bilmez.
 */
async function addOtherWeatherRow(popup: Locator, locale: Locale): Promise<void> {
  await popup.evaluate(
    (root, { label, value }) => {
      if (root.querySelector('.wx-row[data-row="other"]')) return
      const source = root.querySelector('.map-popup__weather .wx-row[data-row="fog"]')
      const list = source?.parentElement
      if (!source || !list) throw new Error('sis satırı yok')
      const copy = source.cloneNode(true) as HTMLElement
      copy.dataset.row = 'other'
      copy.dataset.tone = 'other'
      const text = [...(copy.querySelector(':scope > dt')?.childNodes ?? [])].find(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
      )
      const dd = copy.querySelector(':scope > dd')
      if (!text || !dd) throw new Error('satırın etiketi ya da değeri yok')
      text.textContent = label
      dd.textContent = value
      list.append(copy)
    },
    { label: OTHER_WEATHER[locale], value: COPY[locale].lightningNear },
  )
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

/** Pinin başı ucunun (havalimanı merkezi) ~15 px yukarısındadır (airport-pin.ts). */
const PIN_HEAD_OFFSET_PX = 15

/**
 * IST kodunun ortasına tıklar. Kodlar `.live-map__labels` tuvaline çizilir (DOM'da yoktur); kutular
 * tuvalin piksellerinden bulunur (`canvasChips`, e2e/label-canvas.ts: kod kutusu boyutunda, en çok
 * `CODE_CHIP_MAX_WIDTH` geniş, kenarı #B9E2E6). IST pininin başına (harita ortası:
 * `?havalimani=LTFM` ve klavyeyle yakınlaştırma merkezi korur) en yakın kutu tıklanır. Taksi uçağı
 * ilerledikçe kod yer değiştirebileceği için tıklama pencere açılana kadar yinelenir.
 */
async function clickPrimaryChip(page: Page): Promise<void> {
  const popup = airportPopup(page)
  await expect(async () => {
    const center = await mapCenter(page)
    const head = { x: center.x, y: center.y - PIN_HEAD_OFFSET_PX }
    const [chip = null] = await canvasChips(page, head)
    expect(chip, 'IST kodu tuvalde çizili').not.toBeNull()
    if (!chip) return
    // Kod pin başının yanındadır (sağında, solunda, üstünde ya da noktanın altında; D-079).
    expect(Math.hypot(chip.x - head.x, chip.y - head.y)).toBeLessThanOrEqual(80)
    await page.mouse.click(chip.x, chip.y)
    await expect(popup).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
}
