// Canlı katman anahtarı (Parça 1 M7d.1, D-115) uçtan uca: yönetici /admin/canli-katman'da katmanı
// kapatır → işlem kaydına satır düşer, API ve arama 200 ile boş küme ve `status.layer: "off"` döner,
// açık harita sekmesinin uçak listesi boşalır ve durum şeridi uyarıyı gösterir → yönetici katmanı
// açar → replay uçağı haritaya döner. Anahtar yerel veritabanına yazılır. Test yarıda kalsa da
// `afterAll` katmanı API ile açar ve replay uçağının API'ye dönmesini bekler; sonraki testler
// (live-map.spec.ts) uçaksız kalmaz.
import { expect, test, type APIRequestContext } from '@playwright/test'
import {
  adminLogin,
  aircraftRow,
  aircraftTable,
  API_URL,
  APPROACH_AIRCRAFT,
  declineAnalytics,
  E2E_ADMIN,
  openMap,
  REPLAY_AIRCRAFT,
} from '../support'

/** Türkiye kutusu (app.setup.ts ile aynı). */
const LIVE_BBOX = '25,35,45,43'
const LAYER_OFF_NOTICE = 'Canlı uçak katmanı şu an kapalı; haritada uçak gösterilmiyor.'
const REASON = 'e2e: kapatma denemesi'
/** Worker ve API anahtarı 2 sn'de bir okur; WS durum turunda her istemciye tam görüntü gider. */
const SWITCH_TIMEOUT_MS = 30_000
/** Açılınca uçaklar bir sonraki çekimle gelir (RUNBOOK: genellikle saniyeler, en çok ~1 dk). */
const RETURN_TIMEOUT_MS = 90_000

interface LiveBody {
  status?: { layer?: unknown }
  aircraft?: { hex?: unknown }[]
  license?: unknown
  attribution?: unknown
}

/** `/v1/live`'ın gövdesi; API hazır değilse null. Uç dakikada 120 istekle sınırlıdır. */
async function live(request: APIRequestContext): Promise<LiveBody | null> {
  const response = await request
    .get(`${API_URL}/v1/live?bbox=${LIVE_BBOX}`, { failOnStatusCode: false })
    .catch(() => null)
  return response?.ok() ? ((await response.json()) as LiveBody) : null
}

/** Katman ve uçak sayısı tek değer olarak (poll için): "off:0", "on:12"; API yoksa "unavailable". */
async function layerAndCount(request: APIRequestContext): Promise<string> {
  const body = await live(request)
  if (!body) return 'unavailable'
  return `${String(body.status?.layer)}:${body.aircraft?.length ?? -1}`
}

/**
 * Temizlik: katmanı test yöneticisinin API belirteciyle açar (panel düğmesiyle aynı işlem, işlem
 * kaydına yazılır). Giriş dakikada 5 denemeyle sınırlı olduğundan yalnız katman kapalıysa çağrılır.
 */
async function switchOnViaApi(request: APIRequestContext): Promise<void> {
  const login = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: E2E_ADMIN.email, password: E2E_ADMIN.setupToken },
  })
  expect(login.status(), 'POST /api/auth/login').toBe(200)
  const { token } = (await login.json()) as { token: string }
  const headers = { authorization: `Bearer ${token}` }
  const put = await request.put(`${API_URL}/v1/admin/live-layer`, {
    headers,
    data: { enabled: true, reason: 'e2e: temizlik' },
  })
  expect(put.status(), 'PUT /v1/admin/live-layer').toBe(200)
  await request.post(`${API_URL}/api/auth/logout`, { headers })
}

test.beforeEach(async ({ context }) => {
  await declineAnalytics(context)
})

test.afterAll(async ({ request }) => {
  test.setTimeout(RETURN_TIMEOUT_MS + 30_000)
  const body = await live(request)
  if (body?.status?.layer !== 'on') await switchOnViaApi(request)
  await expect
    .poll(
      async () => {
        const current = await live(request)
        return (
          current?.status?.layer === 'on' &&
          (current.aircraft?.some((ac) => ac.hex === REPLAY_AIRCRAFT.hex) ?? false)
        )
      },
      {
        message: 'katman açık ve replay uçağı API’de',
        timeout: RETURN_TIMEOUT_MS,
        intervals: [2_000],
      },
    )
    .toBe(true)
})

test('yönetici canlı katmanı kapatır: harita, liste ve API boşalır; açınca uçaklar döner', async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(240_000)
  const near = APPROACH_AIRCRAFT

  // Harita açık kalır ve WS'ten güncellenir; panel aynı oturumda ayrı sekmededir.
  await openMap(page)
  await expect(aircraftRow(page, near.hex)).toBeVisible({ timeout: 30_000 })
  const strip = page.locator('.live-map__status')
  await expect(strip).not.toContainText(LAYER_OFF_NOTICE)

  const admin = await context.newPage()
  await adminLogin(admin)
  await admin.goto('/admin/canli-katman')
  await expect(admin.getByRole('heading', { level: 1, name: 'Canlı katman' })).toBeVisible()
  const state = admin.locator('.live-layer-state')
  await expect(state).toHaveText('Durum: Açık')

  // Kapat: sonuç satırı ve işlem kaydı (en yeni önce; ilk satır başlıktır).
  await admin.getByLabel('Neden (isteğe bağlı; ör. karar sayısı)').fill(REASON)
  await admin.getByRole('button', { name: 'Canlı katmanı kapat' }).click()
  await expect(admin).toHaveURL(/\/admin\/canli-katman\?sonuc=kapatildi$/)
  await expect(state).toHaveText('Durum: Kapalı')
  await expect(admin.locator('.live-layer-result')).toHaveText(
    'Kapatıldı. Harita, arama ve API birkaç saniye içinde boşalır.',
  )
  const log = admin.getByRole('table', { name: 'Son 20 işlem, en yeni önce' })
  const latest = log.getByRole('row').nth(1)
  await expect(latest).toContainText('Kapatıldı')
  await expect(latest).toContainText(E2E_ADMIN.email)
  await expect(latest).toContainText(REASON)

  // API: 200, boş küme, `status.layer: "off"`; lisans ve atıf yerinde. Arama da boş döner.
  await expect
    .poll(() => layerAndCount(request), { timeout: SWITCH_TIMEOUT_MS, intervals: [1_000] })
    .toBe('off:0')
  const body = await live(request)
  expect(body?.license).toBe('ODbL-1.0')
  expect(body?.attribution).toBe('ADSB.lol')
  const search = await request.get(`${API_URL}/v1/search?q=${near.callsign}`)
  expect(search.status(), 'GET /v1/search').toBe(200)
  const found = (await search.json()) as { results?: unknown[]; status?: { layer?: unknown } }
  expect(found.status?.layer).toBe('off')
  expect(found.results).toEqual([])

  // Harita: uçak listesi boşalır, durum şeridi katmanın kapalı olduğunu söyler.
  await expect(aircraftTable(page).locator('tbody tr[data-hex]')).toHaveCount(0, {
    timeout: SWITCH_TIMEOUT_MS,
  })
  await expect(strip).toContainText(LAYER_OFF_NOTICE, { timeout: SWITCH_TIMEOUT_MS })

  // Aç: durum, sonuç satırı ve ikinci kayıt; uçak haritaya döner, uyarı kalkar.
  await admin.getByRole('button', { name: 'Canlı katmanı aç' }).click()
  await expect(admin).toHaveURL(/\/admin\/canli-katman\?sonuc=acildi$/)
  await expect(state).toHaveText('Durum: Açık')
  await expect(admin.locator('.live-layer-result')).toHaveText(
    'Açıldı. Uçaklar bir dakika içinde geri gelir.',
  )
  await expect(log.getByRole('row').nth(1)).toContainText('Açıldı')
  await expect(log.getByRole('row').nth(2)).toContainText(REASON)
  await expect(aircraftRow(page, near.hex)).toBeVisible({ timeout: RETURN_TIMEOUT_MS })
  await expect(strip).not.toContainText(LAYER_OFF_NOTICE)
  await expect
    .poll(async () => (await live(request))?.status?.layer, {
      timeout: SWITCH_TIMEOUT_MS,
      intervals: [1_000],
    })
    .toBe('on')
  await admin.close()
})
