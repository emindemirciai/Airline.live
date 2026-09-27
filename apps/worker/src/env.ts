import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { withoutEnvPlaceholders } from '@havayolu/shared'
import { z } from 'zod'

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value
const booleanFlag = (fallback: boolean) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() || undefined : value),
    z
      .enum(['true', 'false', '1', '0'])
      .optional()
      .transform((value) => (value === undefined ? fallback : value === 'true' || value === '1')),
  )
const retentionDays = (fallback: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(3650).default(fallback))

const EnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // İmaja build sırasında gömülür ve Dokploy'a girilmez; boş gelirse açılışı engellemez, 'dev' olur.
  GIT_SHA: z.preprocess(emptyToUndefined, z.string().min(1).default('dev')),
  WORKER_ROLE: z.preprocess(emptyToUndefined, z.string().default('all')),
  /** Admin panelinde görünen servis adı; üretimde worker-rt ya da worker-bg. */
  WORKER_SERVICE_NAME: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^[a-z0-9-]+$/, 'yalnızca küçük harf, rakam ve tire')
      .default('worker-dev'),
  ),
  WORKER_HEALTH_PORT: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(65535).default(4200),
  ),
  REDIS_QUEUE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  DATABASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),

  APP_NAME: z.preprocess(emptyToUndefined, z.string().trim().min(1).default('havayolu')),
  /** Referans indirmelerinin User-Agent'ındaki site adresi (şemasız host). */
  WEB_HOST: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  CONTACT_EMAIL: z.preprocess(emptyToUndefined, z.email().optional()),
  DATA_USAGE_MODE: z.enum(['commercial', 'noncommercial']).default('commercial'),
  /**
   * true: dış servislere istek atılmaz; referans verisi yerelde commit'li fixture'dan gelir.
   * Tanımsızsa true (güvenli taraf): üretim şablonu false'u açıkça verir; unutulursa panel uyarır.
   */
  EXTERNAL_PROVIDERS_DISABLED: booleanFlag(true),
  TRACK_SAMPLED_RETENTION_DAYS: retentionDays(7),
  TRACK_FINE_RETENTION_DAYS: retentionDays(30),
})

export type Env = z.infer<typeof EnvSchema>

export class EnvError extends Error {
  constructor(issues: string[]) {
    super(
      `Ortam değişkenleri hatalı:\n${issues.map((i) => `  - ${i}`).join('\n')}\nAçıklamalar için kökteki .env.example dosyasına bak.`,
    )
    this.name = 'EnvError'
  }
}

/** Compose'un parolalardan kurduğu bağlantı adresleri ve parolanın geldiği değişken (D-063). */
const PASSWORD_URLS = {
  DATABASE_URL: 'POSTGRES_PASSWORD',
  REDIS_QUEUE_URL: 'REDIS_QUEUE_PASSWORD',
} as const

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  // "#parola üret#" doldurulmadan kalırsa compose onu parola olarak adrese yazar; üretilen sırlarda
  // "#" olmadığı için adresteki "#" doldurulmamış talimattır.
  const unfilled = Object.entries(PASSWORD_URLS)
    .filter(([key]) => source[key]?.includes('#'))
    .map(([key, secret]) => `${key}: ${secret} doldurulmamış (#…# talimatı duruyor); parolayı gir`)
  if (unfilled.length > 0) throw new EnvError(unfilled)

  // Şablondaki "#…#" talimatları tanımsız sayılır (D-063).
  const result = EnvSchema.safeParse(withoutEnvPlaceholders(source))
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((i) => `${i.path.join('.') || '(kök)'}: ${i.message}`),
    )
  }
  if (result.data.APP_ENV === 'production') {
    const missing = (['REDIS_QUEUE_URL', 'DATABASE_URL'] as const).filter((k) => !result.data[k])
    if (missing.length > 0) throw new EnvError(missing.map((k) => `${k}: üretimde zorunlu`))
  }
  return result.data
}

/** Geliştirmede kökteki .env (varsa) ve .env.example'ı yükler; üretimde hiçbir şey yüklemez. */
export function loadDotEnvForDevelopment(startDir: string = process.cwd()): string[] {
  if (process.env.APP_ENV === 'production') return []
  let dir = startDir
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      const loaded: string[] = []
      for (const name of ['.env', '.env.example']) {
        const file = join(dir, name)
        if (existsSync(file)) {
          process.loadEnvFile(file)
          loaded.push(file)
        }
      }
      return loaded
    }
    const parent = dirname(dir)
    if (parent === dir) return []
    dir = parent
  }
}
