import { configDefaults, defineConfig } from 'vitest/config'

// Birim testleri; gerçek servis isteyen *.int.test.ts dosyaları vitest.integration.config.ts ile koşar.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.int.test.ts'],
  },
})
