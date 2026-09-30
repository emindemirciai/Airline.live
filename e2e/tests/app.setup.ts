// Testlerden önce: 3100'deki sunucunun bu uygulama olduğu doğrulanır (bu makinede başka projeler de
// çalışır), canlı veri yolu (replay → worker → redis-live → API) hazır olana kadar beklenir ve harita
// sayfası bir kez derletilir. Başarısız olursa diğer testler çalışmaz.
import { expect, test as setup } from '@playwright/test'
import { API_URL, REPLAY_AIRCRAFT } from '../support'

setup.setTimeout(240_000)

setup('uygulama havayolu ve replay verisi API’de', async ({ request }) => {
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

  // next dev sayfayı ilk istekte derler; testlerin kendi süre sınırları derlemeyi kapsamasın.
  const home = await request.get('/', { timeout: 120_000 })
  expect(home.status(), 'GET / (harita sayfası)').toBe(200)
})
