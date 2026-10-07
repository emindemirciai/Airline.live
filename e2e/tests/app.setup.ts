// Testlerden önce: 3100'deki sunucunun bu uygulama olduğu doğrulanır (bu makinede başka projeler de
// çalışır), canlı veri yolu (replay → worker → redis-live → API), havalimanı referans verisi ve hava
// durumu (fixture → worker `jobs` → PostgreSQL → API) hazır olana kadar beklenir, sayfalar bir kez
// derletilir. Başarısız olursa diğer testler çalışmaz.
import { expect, test as setup } from '@playwright/test'
import {
  AIRPORT_COUNT,
  API_URL,
  LISTED_AIRPORT_COUNT,
  PRIMARY_AIRPORT,
  PRIMARY_WEATHER,
  REPLAY_AIRCRAFT,
  RING1_AIRPORT,
} from '../support'

setup('uygulama havayolu ve replay verisi API’de', async ({ request }) => {
  setup.setTimeout(240_000)
  const version = await request.get('/api/version')
  expect(version.status(), 'GET /api/version').toBe(200)
  const body = (await version.json()) as { app?: unknown }
  expect(body.app, '3100 portundaki uygulama').toBe('havayolu')

  await expect
    .poll(
      async () => {
        const response = await request
          .get(`${API_URL}/v1/live?bbox=25,35,45,43`, { failOnStatusCode: false })
          .catch(() => null)
        if (!response?.ok()) return false
        const live = (await response.json()) as { aircraft?: { hex?: unknown }[] }
        return live.aircraft?.some((ac) => ac.hex === REPLAY_AIRCRAFT.hex) ?? false
      },
      {
        message:
          'Replay uçağı API’de görünmedi. pnpm dev:infra ve pnpm db:migrate çalıştırıldı mı? (e2e/playwright.config.ts)',
        timeout: 150_000,
        // /v1/live dakikada 120 istekle sınırlıdır.
        intervals: [2_000],
      },
    )
    .toBe(true)
})

// Havalimanı sayfaları, sitemap ve llms.txt tek bir toplu API yanıtından türer (apps/web/src/lib/
// airports.ts, bir saat önbellekli). Worker içe aktarımı bitirene kadar liste boştur ve API boş listeyi
// 60 sn tutar (D-075). Web sayfaları istenmeden önce API'nin fixture'daki bütün havalimanlarını
// döndürmesi beklenir; böylece testler içe aktarım yarışına düşmez.
setup('havalimanı referans verisi API’de', async ({ request }) => {
  setup.setTimeout(180_000)
  await expect
    .poll(
      async () => {
        const response = await request
          .get(`${API_URL}/v1/airports?country=TR`, { failOnStatusCode: false })
          .catch(() => null)
        if (!response?.ok()) return -1
        const data = (await response.json()) as { airports?: { icao?: unknown }[] }
        return data.airports?.length ?? -1
      },
      {
        message:
          'API fixture’daki havalimanlarını döndürmedi. Worker’ın jobs rolü referans verisini içe aktardı mı? (pnpm dev:replay günlükleri)',
        timeout: 150_000,
        // /v1/airports IP başına dakikada 60 istekle sınırlıdır; web sunucusu da aynı IP'den çağırır.
        intervals: [3_000],
      },
    )
    .toBe(AIRPORT_COUNT)

  // Listelenen havalimanları (M6d, D-080; M6g, D-088; M6h, D-090; M6i.2, D-102): Türkiye + 1.–4.
  // halka (1.217; askerî hava üsleri yok, D-107). Sayfalar, site haritası ve harita bu listeyi
  // kullanır; halka üyeliği API'de hesaplanıp önbelleğe alınır. Yerel veritabanı eski bir içe
  // aktarımı tutuyorsa (sayı eski halkanın sayısıdır) iki OurAirports satırı `reference_sources`'ta
  // sıfırlanır; web'in geliştirme veri önbelleği (`apps/web/.next/dev/cache/fetch-cache`) de eski
  // listeyi 1 saat sunabilir (M6h kaydı).
  await expect
    .poll(
      async () => {
        const response = await request
          .get(`${API_URL}/v1/airports?scope=listed`, { failOnStatusCode: false })
          .catch(() => null)
        if (!response?.ok()) return -1
        const data = (await response.json()) as { airports?: unknown[] }
        return data.airports?.length ?? -1
      },
      {
        message:
          'API listelenen havalimanlarını (Türkiye + 1.–4. halka) döndürmedi (GET /v1/airports?scope=listed)',
        timeout: 90_000,
        intervals: [3_000],
      },
    )
    .toBe(LISTED_AIRPORT_COUNT)

  const detail = await request.get(`${API_URL}/v1/airports/${PRIMARY_AIRPORT.iata.toLowerCase()}`)
  expect(detail.status(), 'GET /v1/airports/ist').toBe(200)
  const airport = (await detail.json()) as { icao?: unknown; runways?: unknown[] }
  expect(airport.icao).toBe(PRIMARY_AIRPORT.icao)
  expect(airport.runways).toHaveLength(PRIMARY_AIRPORT.runways)
})

// Hava durumu (D-078): worker'ın `jobs` rolü fixture'daki METAR ve TAF'ları referans verisinden
// sonra yükler (tools/fixtures/weather). API yanıtları 60 sn, havalimanı sayfasının toplu hava yanıtı
// da web belleğinde 60 sn tutulur (D-090); sayfalar veri gelmeden derletilirse ilk dakika "rapor yok"
// gösterirdi. Bu yüzden sayfalar istenmeden önce LTFM'nin METAR/TAF kaydının dolması ve toplu
// yanıtta son METAR'ın görünmesi beklenir.
setup('hava durumu verisi API’de', async ({ request }) => {
  setup.setTimeout(240_000)
  const history = `${API_URL}/v1/airports/${PRIMARY_AIRPORT.icao}/weather/history?hours=24`
  await expect
    .poll(
      async () => {
        const response = await request.get(history, { failOnStatusCode: false }).catch(() => null)
        if (!response?.ok()) return 'yanıt yok'
        const data = (await response.json()) as { entries?: { kind?: unknown }[] }
        const entries = data.entries ?? []
        const tafs = entries.filter((entry) => entry.kind === 'TAF').length
        return entries.length >= PRIMARY_WEATHER.logMin24h && tafs > 0
          ? 'hazır'
          : `${entries.length} kayıt, ${tafs} TAF`
      },
      {
        message:
          'LTFM’nin METAR/TAF kaydı API’de dolmadı. Worker’ın jobs rolü hava durumu fixture’ını yükledi mi? (pnpm dev:replay günlükleri)',
        timeout: 200_000,
        // Hava uç noktaları IP başına dakikada 60 istekle sınırlıdır; web sunucusu da aynı IP'den çağırır.
        intervals: [3_000],
      },
    )
    .toBe('hazır')

  await expect
    .poll(
      async () => {
        const response = await request
          .get(`${API_URL}/v1/weather?country=TR`, { failOnStatusCode: false })
          .catch(() => null)
        if (!response?.ok()) return null
        const data = (await response.json()) as {
          stations?: { icao?: unknown; metar?: { raw?: unknown } | null }[]
        }
        const station = data.stations?.find((entry) => entry.icao === PRIMARY_AIRPORT.icao)
        return typeof station?.metar?.raw === 'string' ? station.metar.raw : null
      },
      {
        message:
          'Toplu hava durumu yanıtında LTFM’nin son METAR’ı yok (GET /v1/weather?country=TR)',
        timeout: 90_000,
        intervals: [3_000],
      },
    )
    .toContain(PRIMARY_WEATHER.latestMetarGroups[0])

  // Havalimanı sayfaları listelenen havalimanlarının toplu yanıtını kullanır (`scope=listed`, ayrı
  // önbellek kaydı): 1. halkadaki fixture istasyonu da görünmeli. Harita penceresi 3. halkadan beri
  // tek havalimanını ister (`/v1/airports/<ICAO>/weather`, D-090).
  await expect
    .poll(
      async () => {
        const response = await request
          .get(`${API_URL}/v1/weather?scope=listed`, { failOnStatusCode: false })
          .catch(() => null)
        if (!response?.ok()) return null
        const data = (await response.json()) as {
          stations?: { icao?: unknown; metar?: { raw?: unknown } | null }[]
        }
        const station = data.stations?.find((entry) => entry.icao === RING1_AIRPORT.icao)
        return typeof station?.metar?.raw === 'string' ? station.metar.raw : null
      },
      {
        message: `Toplu hava durumu yanıtında ${RING1_AIRPORT.icao}'ın METAR'ı yok (GET /v1/weather?scope=listed)`,
        timeout: 90_000,
        intervals: [3_000],
      },
    )
    .toContain(RING1_AIRPORT.icao)
})

// next dev her yolu ilk istekte derler; testlerin kendi süre sınırları derlemeyi kapsamasın.
const WARM_PATHS = [
  '/',
  '/havalimanlari',
  `/istasyon/${PRIMARY_AIRPORT.icao}`,
  `/istasyon/${RING1_AIRPORT.icao}`,
  '/hakkinda',
  '/yenilikler',
  '/kullanim-kosullari',
  '/durum',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/manifest.webmanifest',
] as const

setup('sayfalar derlenir', async ({ request }) => {
  setup.setTimeout(WARM_PATHS.length * 120_000)
  for (const path of WARM_PATHS) {
    const response = await request.get(path, { timeout: 120_000 })
    expect(response.status(), `GET ${path}`).toBe(200)
  }
})
