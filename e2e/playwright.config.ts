// Tarayıcı testleri (Playwright, Chromium). Çalıştırma: pnpm test:e2e (kökten).
//
// Ön koşullar (yerelde bir kez; CI'daki `e2e` işi aynısını yapar):
// - pnpm dev:infra: PostgreSQL ve iki Redis ayakta (Docker)
// - pnpm db:migrate: migration'lar, iz partition'ları ve tohum istasyonları
// - 3100, 4100, 4200 ve 4300 portları boş: `pnpm dev` açıksa kapat. reuseExistingServer: false
//   olduğu için çalışan bir sunucu kullanılmaz, test hata verir (3000–3003 başka projenindir).
//
// Web sunucusu `pnpm dev:replay`dir: replay alıcısı (4300, sentetik `cruise` senaryosu) + web, API ve
// worker. Canlı veri yalnızca replay'den gelir; harita yerel `/test-style.json` stiliyle açılır. Dış
// servislere istek atılmaz (EXTERNAL_PROVIDERS_DISABLED=true). WebGL2 CI'da GPU olmadan SwiftShader'la
// sağlanır. Rapor: e2e/.report (git'e girmez).
import { defineConfig, devices } from '@playwright/test'
import {
  API_HOST,
  E2E_ADMIN,
  E2E_ANALYZE_SITE_ID,
  E2E_ANALYZE_URL,
  WEB_HOST,
  WEB_URL,
} from './support'

const ci = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  // Tek geliştirme sunucusu paylaşılır; testler sırayla çalışır.
  fullyParallel: false,
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  // CI'da hatalar ayrıca PR'da satır notu olarak görünür.
  reporter: [
    ['list'],
    ...(ci ? [['github'] as const] : []),
    ['html', { outputFolder: './.report', open: 'never' }],
  ],
  use: {
    baseURL: WEB_URL,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    trace: 'on-first-retry',
    // İlk açılışta next dev sayfayı derler.
    navigationTimeout: 60_000,
  },
  projects: [
    // Önce uygulamanın kimliği ve canlı veri yolu doğrulanır; kalan testler buna bağlıdır.
    { name: 'setup', testMatch: /.*\.setup\.ts$/ },
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts$/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    command: 'pnpm dev:replay',
    cwd: '..',
    url: `${WEB_URL}/api/version`,
    reuseExistingServer: false,
    timeout: 180_000,
    // CI'da web, API ve worker günlükleri iş çıktısına düşer: başarısız bir koşu buradan incelenir.
    // Yerelde yalnızca hata çıktısı gösterilir.
    stdout: ci ? 'pipe' : 'ignore',
    stderr: 'pipe',
    env: {
      // Harita altlığı: yerel test stili (D-075); uydu anahtarı ortamdan gelse bile kullanılmaz.
      MAP_STYLE_URL: '/test-style.json',
      EXTERNAL_PROVIDERS_DISABLED: 'true',
      ESRI_API_KEY: '',
      // Kullanıcının .env'i ne derse desin web, API ve WebSocket aynı yerel host'larda buluşur. Sayfalardaki
      // mutlak adresler (canonical, hreflang, sitemap, llms.txt) de WEB_HOST'tan kurulur (D-076).
      WEB_HOST,
      API_HOST,
      ADMIN_HOST: '',
      // Onay bandı testi: analiz adresi yerel ve sahtedir; script isteği test içinde yanıtlanır.
      ANALYZE_URL: E2E_ANALYZE_URL,
      ANALYZE_SITE_ID: E2E_ANALYZE_SITE_ID,
      // Kapsama raporu testi: test yöneticisi (sır değildir; e2e/support.ts). Bu iki değer
      // kullanıcının .env'indeki aynı anahtarları ezer; .env'in diğer değerleri (ör. geliştirme
      // sunucularının ve fixture aracının DATABASE_URL'i) yine okunur. .env'e yazılmaz (D-098).
      ADMIN_EMAIL: E2E_ADMIN.email,
      ADMIN_SETUP_TOKEN: E2E_ADMIN.setupToken,
      // Next.js ve Turborepo telemetrisi dış istektir.
      NEXT_TELEMETRY_DISABLED: '1',
      TURBO_TELEMETRY_DISABLED: '1',
    },
  },
})
