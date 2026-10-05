// E2E testlerinin ortak değerleri ve yardımcıları. Adresler CLAUDE.md'deki sabit yerel portlardır
// (web 3100, API 4100); API CORS ve WebSocket Origin denetimi yalnızca http://localhost:3100'ü tanır.
import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test'

export const WEB_URL = 'http://localhost:3100'
export const API_URL = 'http://localhost:4100'
/** Web sunucusunun ortamındaki `WEB_HOST` (şemasız); sayfalardaki mutlak adresler bu host'tadır. */
export const WEB_HOST = new URL(WEB_URL).host
export const API_HOST = new URL(API_URL).host

/**
 * `pnpm dev:replay`'in `cruise` senaryosundaki ilk seyir uçağı (IST ↔ ESB, ~450 kt):
 * tools/src/scenarios/cruise.ts → `syntheticIdentity(1)`.
 */
export const REPLAY_AIRCRAFT = { hex: 'ff0001', callsign: 'HYS001' } as const
/**
 * Senaryoda LTFM 35L'ye döngüsel son yaklaşma yapan uçak (cruise.ts → `APPROACH_NUMBER`, 12 NM'den
 * eşiğe): hep havadadır ve haritanın açılış görünümünün (IST/LTFM, D-079) içindedir.
 */
export const APPROACH_AIRCRAFT = { hex: 'ff0091', callsign: 'HYS091' } as const
/** Senaryoda LTFM'de yerde taksi yapan uçak (cruise.ts → `TAXI_NUMBER`, 35R ile 18/36 arası). */
export const TAXI_AIRCRAFT = { hex: 'ff0092', callsign: 'HYS092' } as const
/** LTFM'den hep uzakta, Esenboğa ile Van arasında uçan seyir uçağı (cruise.ts → `CRUISE_ROUTES[3]`). */
export const FAR_AIRCRAFT = { hex: 'ff0004', callsign: 'HYS004' } as const
/** Senaryoda olmayan bir çağrı kodu (seyir uçakları HYS001…HYS008, yaklaşma HYS091, taksi HYS092). */
export const MISSING_CALLSIGN = 'HYS099'
/** Senaryoda olmayan bir hex (replay uçakları ff0001…). */
export const MISSING_HEX = 'fe0099'

/**
 * Referans verisi fixture'ı (tools/fixtures/ourairports; worker'ın `jobs` rolü ilk açılışta yükler):
 * IATA kodlu 61 Türkiye havalimanı; OurAirports'a göre 51'inde tarifeli sefer var. İndekslenen
 * havalimanı sayfası 56'dır (D-076, D-084: tarifeli, istasyon ya da resmî adı DHMİ, işletmeci ya da
 * bakanlıktan doğrulanmış sivil havalimanı; Siirt, Kocaeli, Uşak, Atatürk ve Ankara (Etimesgut) bu
 * yüzden eklenir). Kalan 5'i askerî hava üssüdür ve `noindex, follow` alır.
 */
export const AIRPORT_COUNT = 61
export const INDEXABLE_AIRPORT_COUNT = 56

/**
 * Türkiye dışındaki listelenen havalimanları (M6d, D-080; M6g, D-088; M6h, D-090): 1.–3. halka,
 * yani IATA kodlu en yakın Türkiye havalimanına en çok 2.000 km olan, OurAirports'ta tarifeli seferi
 * kayıtlı büyük ve orta boy havalimanları. Fixture'a 2026-10-01 indirmesinden eklenen 75 + 89 + 275
 * havalimanı ve fixture'ın uzak örneklerinden 3. halkadaki Frankfurt, Dubai ve Doha Hamad bu
 * kuraldadır ve hepsi dizine eklenir. Fixture'ın diğer uzak havalimanları (EGLL, LFPG, EHAM, LEMD,
 * KJFK) listelenmez.
 */
export const RING1_AIRPORT_COUNT = 75
export const RING2_AIRPORT_COUNT = 89
export const RING3_AIRPORT_COUNT = 278
export const FOREIGN_AIRPORT_COUNT = RING1_AIRPORT_COUNT + RING2_AIRPORT_COUNT + RING3_AIRPORT_COUNT
/** `GET /v1/airports?scope=listed`: 61 Türkiye + 442 Türkiye dışı = 503. */
export const LISTED_AIRPORT_COUNT = AIRPORT_COUNT + FOREIGN_AIRPORT_COUNT
/** Dizine eklenen havalimanı sayfaları: Türkiye'nin 56'sı ve Türkiye dışındakilerin hepsi (498). */
export const INDEXABLE_LISTED_AIRPORT_COUNT = INDEXABLE_AIRPORT_COUNT + FOREIGN_AIRPORT_COUNT
/** Halkaların üst sınırları, km (`AIRPORT_RINGS_KM`; D-080). */
export const RING_LIMITS_KM = { 1: 500, 2: 1000, 3: 2000 } as const

/**
 * 1. halkadan örnek havalimanı: Atina (en yakın Türkiye havalimanına ~275 km). OurAirports ülkesi
 * GR; hava durumu fixture'ında güncel METAR'ı ve TAF'ı vardır (tools/fixtures/weather).
 */
export const RING1_AIRPORT = {
  icao: 'LGAV',
  iata: 'ATH',
  country: 'GR',
  countryTr: 'Yunanistan',
  countryEn: 'Greece',
} as const
/**
 * Ercan: OurAirports'ta CY (Kıbrıs); KKTC olarak gösterilir (kullanıcı kararı 2026-10-02, D-080).
 * Hava durumu fixture'ında METAR'ı var, TAF'ı yok.
 */
export const KKTC_AIRPORT = { icao: 'LCEN', iata: 'ECN', shortTr: 'KKTC', shortEn: 'TRNC' } as const
/**
 * 2. halkadan örnek havalimanı (D-088): Kahire (en yakın Türkiye havalimanı Gazipaşa-Alanya, ~693 km).
 * OurAirports ülkesi EG; saat dilimi Africa/Cairo (yazın UTC+3, kışın UTC+2).
 */
export const RING2_AIRPORT = {
  icao: 'HECA',
  iata: 'CAI',
  country: 'EG',
  countryTr: 'Mısır',
  countryEn: 'Egypt',
  nameTr: 'Kahire Havalimanı',
  nameEn: 'Cairo International Airport',
  timeZone: 'Africa/Cairo',
} as const
/**
 * 2. halkanın sınırı: Tel Aviv Ben Gurion, Hatay'a 500,44 km. Halka tam uzaklıktan hesaplanır (2),
 * API uzaklığı tam km'ye yuvarlar (500): 2. halkada uzaklık 500'den küçük değildir, 500 olabilir.
 */
export const RING2_BOUNDARY_AIRPORT = { icao: 'LLBG', iata: 'TLV', distanceToTrKm: 500 } as const
/**
 * 3. halkadan örnek havalimanı (D-090): Viyana (Türkiye'deki en yakın IATA kodlu alan listelenmeyen
 * Gökçeada, 1.149 km). OurAirports ülkesi AT; saat dilimi Europe/Vienna (yazın UTC+2, kışın UTC+1).
 * 3. halkada uzaklık 1.000 km'den büyüktür (en yakını Gachsaran, 1.006 km; yuvarlama sınırı yok).
 */
export const RING3_AIRPORT = {
  icao: 'LOWW',
  iata: 'VIE',
  country: 'AT',
  countryTr: 'Avusturya',
  countryEn: 'Austria',
  nameTr: 'Viyana Havalimanı',
  nameEn: 'Vienna International Airport',
  timeZone: 'Europe/Vienna',
} as const
/**
 * Sivil uçuşlara kapalı olabilecek listelenen havalimanı (kullanıcı kararı 2026-10-04, D-090):
 * Voronej (3. halka). Sayfası ve haritadaki penceresi notu gösterir; listede kalır, dizine eklenir.
 */
export const CIVIL_CLOSURE_AIRPORT = {
  icao: 'UUOO',
  iata: 'VOZ',
  noteTr: 'Sivil uçuşlara kapalı olabilir (2022’den beri)',
  noteEn: 'May be closed to civil flights (since 2022)',
} as const
/** Hava durumu fixture'ı elle yazılmış 1. halka havalimanları (M6d). */
export const RING1_WEATHER_AIRPORTS = ['LGAV', 'LCLK', 'LCEN', 'UGTB', 'LBSF', 'LGTS'] as const
/**
 * Referans fixture'ında olan ama listelenmeyen uzak havalimanı (Londra Heathrow; Türkiye'ye
 * ~2.375 km, 4. halka): sayfası 404'tür.
 */
export const UNLISTED_FOREIGN_AIRPORT = { icao: 'EGLL', iata: 'LHR' } as const
/** Sitemap'teki havalimanı dışı sayfalar; her birinin `/en` ikizi de vardır (D-076). */
export const STATIC_PUBLIC_PATHS = [
  '/',
  '/havalimanlari',
  '/hakkinda',
  '/yenilikler',
  '/kullanim-kosullari',
] as const

/**
 * Birincil istasyon (CLAUDE.md): işletmecisinin (İGA) resmî adıyla İstanbul Havalimanı, 6 pist
 * (packages/shared/src/reference/airport-names.ts).
 */
export const PRIMARY_AIRPORT = {
  icao: 'LTFM',
  iata: 'IST',
  nameTr: 'İstanbul Havalimanı',
  nameEn: 'Istanbul Airport',
  runways: 6,
} as const
/** LTFM'ye en yakın tarifeli iki havalimanı: Sabiha Gökçen (~64 km) ve Çorlu (~70 km). */
export const PRIMARY_AIRPORT_NEIGHBOURS = ['LTFJ', 'LTBU'] as const
/**
 * Tarifeli seferi kayıtlı olmayan ve istasyon olmayan askerî hava üssü (İncirlik Hava Üssü, D-084):
 * sayfası açılır ama noindex.
 */
export const NON_INDEXABLE_AIRPORT = { icao: 'LTAG', iata: 'UAB' } as const

/**
 * Hava durumu fixture'ı (tools/fixtures/weather; elle yazılmış ve sentetik, D-078). Worker'ın `jobs`
 * rolü geliştirme ve testte yükler ve bütün zamanları tam saat kaydırır: fixture'ın "şimdi"si
 * (15 Ocak 13:00Z) içinde bulunulan UTC saatinin başına gelir, dakikalar korunur.
 *
 * LTFM'nin son METAR'ı (fixture'da `LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009
 * TEMPO 4000 SHRA`): kuzeydoğudan 18 kt, hamle 32 kt (kuvvetli rüzgâr), hafif sağanak yağmur,
 * kümülonimbüs; kar, gök gürültüsü ve sis yok. Ham metinde yalnızca gün ve saat grubu kaydırılır.
 */
export const PRIMARY_WEATHER = {
  /** Son METAR'ın kaydırılmayan, yalnızca ona özgü grupları (bir önceki rapor `03017G31KT`). */
  latestMetarGroups: ['03018G32KT', '-SHRA', 'FEW025CB'],
  /**
   * Son 24 saatteki en az METAR/TAF kaydı. Fixture'da METAR yarım saatte birdir (:20 ve :50); saatin
   * dakikasına göre pencerede 46–48 METAR ve 4 TAF kalır. Pencere kenarı için pay bırakılır.
   */
  logMin24h: 45,
} as const
/** Fixture'da METAR'ı da TAF'ı da olmayan havalimanı (Kocaeli Cengiz Topel). */
export const NO_WEATHER_AIRPORT = 'LTBQ'

/** OpenAI'nin tarayıcısı; Next.js'in varsayılan "HTML-limited bot" listesinde yoktur (D-076). */
export const GPTBOT_USER_AGENT =
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot'

/**
 * Onay bandı testi için sahte analiz adresi. Yereldir; takip script'i isteği tarayıcıdan çıkmadan
 * `page.route` ile yanıtlanır, bu adreste bir sunucu çalışması gerekmez.
 */
export const E2E_ANALYZE_URL = 'http://127.0.0.1:4390'
export const E2E_ANALYZE_SITE_ID = 'e2e.localhost'

/**
 * e2e'nin test yöneticisi (sır değildir; yalnızca bu yerel test sunucusunda geçerlidir). Playwright
 * `webServer` ortamı API'ye `ADMIN_EMAIL` ve `ADMIN_SETUP_TOKEN` olarak verir. Süreç ortamı kökteki
 * `.env`'in önündedir, ama anahtar başına: bu iki değer `.env`'dekini ezer, `.env`'in diğer
 * değerleri (ör. `DATABASE_URL`) yine okunur. `.env`'e hiçbir şey yazılmaz (D-098). Anahtar API
 * kuralına uyar: en az 12 karakter, yalnızca `[A-Za-z0-9_-]`.
 */
export const E2E_ADMIN = {
  email: 'e2e-yonetici@example.com',
  setupToken: 'e2e-kurulum-anahtari-yalnizca-yerel',
} as const

/**
 * Kapsama raporu fixture'ı (`pnpm --filter @havayolu/tools arrival-fixture`, D-098): LTAI'ye üç
 * kapanmış sentetik varış, biri yerde örneğiyle (tools/src/arrival-report/fixture.ts). Replay
 * LTAI'ye yaklaşma uçurmadığı için istasyonun satırı yalnızca bu fixture'dan gelir.
 */
export const ARRIVAL_FIXTURE = {
  icao: 'LTAI',
  iata: 'AYT',
  hexes: ['e2e0a1', 'e2e0a2', 'e2e0a3'],
  arrivals: '3',
  groundShare: '%33,3 (1/3)',
} as const

export const CONSENT_COOKIE = 'hy_consent'
export const LABEL_SETTINGS_KEY = 'hy:map:labels'
/** Uçak listesinin geniş ekrandaki açık ya da daraltılmış hâli (D-085; lib/map/list-settings.ts). */
export const AIRCRAFT_LIST_KEY = 'hy:map:list'

/** Arama sonuçsuz kalınca gösterilen metin (docs/prompts/parca-1.md → M6, birebir). */
export const NOT_FOUND_TEXT =
  'Bu sefer şu an havada görünmüyor ya da farklı bir çağrı koduyla uçuyor; tescil ile arayabilirsin.'

/** Harita testlerinde onay bandı panelleri örtmesin diye tercih önceden "Reddet" yapılır. */
export async function declineAnalytics(context: BrowserContext): Promise<void> {
  await context.addCookies([{ name: CONSENT_COOKIE, value: 'denied', url: WEB_URL }])
}

export async function consentCookie(context: BrowserContext): Promise<string | undefined> {
  const cookies = await context.cookies(WEB_URL)
  return cookies.find((cookie) => cookie.name === CONSENT_COOKIE)?.value
}

/**
 * MapLibre'nin WebGL tuvali oluşana ve ilk stil ile uçak katmanları yüklenene ("Harita yükleniyor"
 * kalkana) kadar bekler. İlk açılışta next dev harita kütüphanesinin istemci parçasını derleyebilir;
 * bu yüzden süre genel beklemeden uzundur.
 */
export async function waitForMap(page: Page): Promise<void> {
  const map = page.locator('.live-map')
  await expect(map.locator('.maplibregl-canvas')).toBeVisible({ timeout: 30_000 })
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 })
  await expect(map.locator('.live-map__message')).toHaveCount(0)
}

/** Sayfayı açar ve haritanın hazır olmasını bekler. */
export async function openMap(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  await waitForMap(page)
}

/**
 * Haritada MapLibre'nin yerleştirdiği ülke adları (D-095): harita kapsayıcısının
 * `data-country-labels` niteliği (`|` ile, koda göre sıralı; en fazla 500 ms gecikmeyle yenilenir).
 * Gizle'de ve z8 ve üstünde boştur.
 */
export async function countryLabels(page: Page): Promise<string[]> {
  const value = await page
    .locator('.live-map .live-map__canvas')
    .getAttribute('data-country-labels')
  return (value ?? '').split('|').filter(Boolean)
}

/**
 * Klavyeyle `steps` kademe uzaklaştırır ("-" tuşu; merkez yerinde kalır). Hareket azaltılmışsa
 * (`reducedMotion: 'reduce'`) her basış anında ve tam bir kademedir.
 */
export async function zoomOut(page: Page, steps: number): Promise<void> {
  await page.locator('.live-map .maplibregl-canvas').focus()
  for (let i = 0; i < steps; i++) await page.keyboard.press('Minus')
}

/** Klavyeyle `steps` kademe yakınlaştırır ("=" tuşu). */
export async function zoomIn(page: Page, steps: number): Promise<void> {
  await page.locator('.live-map .maplibregl-canvas').focus()
  for (let i = 0; i < steps; i++) await page.keyboard.press('Equal')
}

export function aircraftTable(page: Page): Locator {
  return page.locator('.live-map__table table')
}

export function aircraftRow(page: Page, hex: string): Locator {
  return aircraftTable(page).locator(`tbody tr[data-hex="${hex}"]`)
}

/** "Havalimanları" denetiminin listesindeki düğmeler (görünümdekiler, haritanın ortasına yakın önce). */
export async function airportListCodes(page: Page, button = 'Havalimanları'): Promise<string[]> {
  const toggle = page.getByRole('button', { name: button, exact: true })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  const codes = page.locator('.map-airports__code')
  await expect(codes.first()).toBeVisible()
  const list = await codes.allTextContents()
  await toggle.click()
  return list
}

export function infoCard(page: Page): Locator {
  return page.locator('.live-map__card')
}

/** Adres satırında `hex` parametresi tam olarak bu değer mi. */
export function hexParam(hex: string): RegExp {
  return new RegExp(`[?&]hex=${hex}(?:&|#|$)`)
}

/**
 * Dil anahtarı: `hreflang` ve `lang` taşıyan düz `<a>` (D-076). `<Link>` değildir; kök düzen istemci
 * geçişinde yeniden kullanıldığından dil değişimi tam sayfa yüklemesi ister.
 */
export function languageToggle(page: Page): Locator {
  return page.locator('a[hreflang][lang]')
}

/** Bir yolun İngilizce ikizi: `/` → `/en`, `/x?q` → `/en/x?q` (lib/locale-routing.ts'nin sözleşmesi). */
export function enPath(path: string): string {
  const index = path.indexOf('?')
  const pathname = index < 0 ? path : path.slice(0, index)
  const query = index < 0 ? '' : path.slice(index)
  return `${pathname === '/' ? '/en' : `/en${pathname}`}${query}`
}

/**
 * Sitenin mutlak adresini yol + sorguya çevirir. Adres mutlak olmalı ve `WEB_HOST`'ta bulunmalıdır;
 * şema http ya da https olabilir (metadataBase WEB_HOST'tan kurulur).
 */
export function sitePath(url: string | undefined, what: string): string {
  expect(url, `${what}: adres var`).toBeTruthy()
  expect(url, `${what}: mutlak adres`).toMatch(/^https?:\/\//)
  const parsed = new URL(url ?? '')
  expect(parsed.host, `${what}: host`).toBe(WEB_HOST)
  return `${parsed.pathname}${parsed.search}`
}

/** Yönlendirmeleri izlemeden alınan yanıt ve gövdesi. İlk istekte next dev sayfayı derleyebilir. */
export async function fetchRaw(
  request: APIRequestContext,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ response: APIResponse; body: string }> {
  const response = await request.get(path, { headers, maxRedirects: 0, timeout: 60_000 })
  return { response, body: await response.text() }
}

/** Yönlendirmenin durum kodu ve hedefi (Location göreli ya da mutlak olabilir). */
export async function expectRedirect(
  request: APIRequestContext,
  from: string,
  to: string,
  status = 308,
): Promise<APIResponse> {
  const { response } = await fetchRaw(request, from)
  expect(response.status(), `${from}: durum kodu`).toBe(status)
  const location = response.headers()['location']
  expect(location, `${from}: Location başlığı`).toBeTruthy()
  const target = new URL(location ?? '', WEB_URL)
  expect(`${target.pathname}${target.search}`, `${from}: hedef`).toBe(to)
  return response
}
