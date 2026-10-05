import { defineConfig } from 'vitest/config'

// Gerçek PostgreSQL ve redis-live gerektirir (`pnpm dev:infra`; CI'da dev compose). Bağlantılar
// TEST_DATABASE_ADMIN_URL ve TEST_REDIS_LIVE_URL'den gelir. adsb.lol, 127.0.0.1'deki testin kendi
// sunucusudur; vitest.setup.ts başka bir adrese giden fetch'i reddeder.
export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
