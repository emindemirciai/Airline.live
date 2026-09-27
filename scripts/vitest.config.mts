import { defineConfig } from 'vitest/config'

// scripts/*.test.mts: yalnızca yerel stub sunucularına karşı çalışan script testleri.
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.mts'],
    environment: 'node',
  },
})
