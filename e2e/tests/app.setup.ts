// Testlerden önce: 3100'deki sunucunun bu uygulama olduğu doğrulanır (bu makinede başka projeler de
// çalışır), canlı veri yolu (replay → worker → redis-live → API) ve havalimanı referans verisi
// (fixture → worker `jobs` → PostgreSQL → API) hazır olana kadar beklenir, sayfalar bir kez derletilir.
// Başarısız olursa diğer testler çalışmaz.
import { expect, test as setup } from '@playwright/test'
import { AIRPORT_COUNT, API_URL, PRIMARY_AIRPORT, REPLAY_AIRCRAFT } from '../support'

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

  const detail = await request.get(`${API_URL}/v1/airports/${PRIMARY_AIRPORT.iata.toLowerCase()}`)
  expect(detail.status(), 'GET /v1/airports/ist').toBe(200)
  const airport = (await detail.json()) as { icao?: unknown; runways?: unknown[] }
  expect(airport.icao).toBe(PRIMARY_AIRPORT.icao)
  expect(airport.runways).toHaveLength(PRIMARY_AIRPORT.runways)
})

// next dev her yolu ilk istekte derler; testlerin kendi süre sınırları derlemeyi kapsamasın.
const WARM_PATHS = [
  '/',
  '/havalimanlari',
  `/istasyon/${PRIMARY_AIRPORT.icao}`,
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
