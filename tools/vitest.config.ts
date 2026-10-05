import { configDefaults, defineConfig } from 'vitest/config'

// Birim testleri; gerçek PostgreSQL ve Redis isteyen *.int.test.ts dosyaları
// vitest.integration.config.ts ile koşar. vitest.setup.ts, fetch'i yalnızca yerel adreslere izin
// veren sarmalayıcıyla değiştirir: hiçbir test canlı servise istek atamaz.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.int.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
