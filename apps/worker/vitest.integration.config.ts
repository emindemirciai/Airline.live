import { defineConfig } from 'vitest/config'

// Gerçek PostgreSQL ve Redis gerektirir (`pnpm dev:infra`; CI'da dev compose). Bağlantılar
// TEST_DATABASE_ADMIN_URL ve TEST_REDIS_QUEUE_URL'den gelir.
export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
