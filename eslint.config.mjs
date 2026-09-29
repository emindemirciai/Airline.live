// Tek, paylaşılan ESLint yapılandırması (flat config). Her paket `eslint . --max-warnings 0` çalıştırır.
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const productionRestrictedImports = {
  patterns: [
    {
      group: [
        '**/tools/**',
        '**/fixtures/**',
        '**/test/**',
        '**/e2e/**',
        '**/*.test',
        '**/*.test.*',
      ],
      message:
        "Üretim kodu test yardımcılarını, fixture'ları, e2e/ ya da tools/ altını import edemez.",
    },
  ],
}

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      // Playwright çıktıları (e2e/.report, test-results).
      '**/.report/**',
      '**/test-results/**',
      '**/playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-warning-comments': [
        'error',
        { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'anywhere' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['**/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/test/**'],
    rules: {
      'no-restricted-imports': ['error', productionRestrictedImports],
    },
  },
  prettier,
)
