import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { withoutEnvPlaceholders } from '@havayolu/shared'
import { z } from 'zod'
import { isCidr } from './net/client-ip'

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value
const optionalString = z.preprocess(emptyToUndefined, z.string().trim().optional())
const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional())
const splitCsv = (value: unknown) =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    : []
const csv = z.preprocess(splitCsv, z.array(z.string()))

const EnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_LISTEN_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).optional()),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // İmaja build sırasında gömülür ve Dokploy'a girilmez; boş gelirse açılışı engellemez, 'dev' olur.
  GIT_SHA: z.preprocess(emptyToUndefined, z.string().min(1).default('dev')),
  BUILD_TIME: optionalString,

  DATABASE_URL: optionalUrl,
  REDIS_QUEUE_URL: optionalUrl,
  REDIS_LIVE_URL: optionalUrl,

  WEB_HOST: optionalString,
  ADMIN_HOST: optionalString,
  WEB_INTERNAL_URL: z.preprocess(emptyToUndefined, z.url().default('http://localhost:3100')),
  ANALYZE_URL: optionalUrl,
  EXPECTED_WORKERS: z.preprocess(
    (value) => (value === undefined || value === '' ? 'worker-rt,worker-bg' : value),
    csv,
  ),

  // Yönetici ayarları şemada serbest; kurala uymazsa API açılır, yalnızca giriş kapanır (adminSettings).
  ADMIN_EMAIL: optionalString,
  ADMIN_SETUP_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),

  TRUSTED_PROXY_CIDRS: z.preprocess(
    splitCsv,
    z.array(z.string().refine(isCidr, 'geçerli bir IP ya da CIDR olmalı (ör. 10.0.0.0/8)')),
  ),
  EDGE_PROXY: z.preprocess(emptyToUndefined, z.enum(['cloudflare']).optional()),
})

/** Yönetici kurulum anahtarının en kısa uzunluğu; giriş denemeleri ziyaretçi başına sınırlıdır (D-069). */
export const ADMIN_SETUP_TOKEN_MIN_LENGTH = 12

/** Konteyner içi üretim portu 4000; yerel geliştirmede 4100 (3000–3003 bu makinede dolu). */
export const DEFAULT_API_PORT = { production: 4000, local: 4100 } as const

type ParsedEnv = z.infer<typeof EnvSchema>
export type Env = Omit<ParsedEnv, 'API_PORT'> & {
  API_PORT: number
  /** Yönetici ayarı hatalıysa nedeni; giriş kapalıdır ama API çalışır. Ayar yoksa null. */
  ADMIN_DISABLED_REASON: string | null
}

export class EnvError extends Error {
  constructor(issues: string[]) {
    super(
      `Ortam değişkenleri hatalı:\n${issues.map((i) => `  - ${i}`).join('\n')}\nAçıklamalar için kökteki .env.example dosyasına bak.`,
    )
    this.name = 'EnvError'
  }
}

/** Compose'un parolalardan kurduğu bağlantı adresleri ve parolanın geldiği değişken. */
const PASSWORD_URLS = {
  DATABASE_URL: 'POSTGRES_PASSWORD',
  REDIS_QUEUE_URL: 'REDIS_QUEUE_PASSWORD',
  REDIS_LIVE_URL: 'REDIS_LIVE_PASSWORD',
} as const

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  // Şablondaki "#parola üret#" gibi bir talimat doldurulmadan kalırsa compose onu parola olarak
  // adrese yazar. Üretilen sırlar yalnızca [A-Za-z0-9_-] içerdiği için adreste "#" olamaz (D-063).
  const unfilled = Object.entries(PASSWORD_URLS)
    .filter(([key]) => source[key]?.includes('#'))
    .map(
      ([key, secret]) =>
        `${key}: ${secret} doldurulmamış (#…# talimatı duruyor); parolayı üret ve gir`,
    )
  if (unfilled.length > 0) throw new EnvError(unfilled)

  const result = EnvSchema.safeParse(withoutEnvPlaceholders(source))
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((i) => `${i.path.join('.') || '(kök)'}: ${i.message}`),
    )
  }
  const data = result.data
  const issues: string[] = []
  if (data.APP_ENV === 'production') {
    for (const key of ['DATABASE_URL', 'REDIS_QUEUE_URL', 'REDIS_LIVE_URL'] as const) {
      if (!data[key]) issues.push(`${key}: üretimde zorunlu`)
    }
    if (data.TRUSTED_PROXY_CIDRS.length === 0) {
      issues.push(
        'TRUSTED_PROXY_CIDRS: üretimde zorunlu (Docker özel ağları; ör. 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16)',
      )
    }
  }
  if (issues.length > 0) throw new EnvError(issues)
  const fallbackPort =
    data.APP_ENV === 'production' ? DEFAULT_API_PORT.production : DEFAULT_API_PORT.local
  return { ...data, ...adminSettings(data), API_PORT: data.API_PORT ?? fallbackPort }
}

/**
 * Yönetici girişi ayarları. Hatalı bir yönetici ayarı bütün API'yi (dolayısıyla siteyi) kapatmaz:
 * giriş kapatılır ve nedeni döner, çağıran loglar (D-069). İkisi de boşsa giriş bilerek kapalıdır.
 */
function adminSettings(data: ParsedEnv): {
  ADMIN_EMAIL: string | undefined
  ADMIN_SETUP_TOKEN: string | undefined
  ADMIN_DISABLED_REASON: string | null
} {
  const email = data.ADMIN_EMAIL
  const token = data.ADMIN_SETUP_TOKEN
  const disabled = (reason: string) => ({
    ADMIN_EMAIL: undefined,
    ADMIN_SETUP_TOKEN: undefined,
    ADMIN_DISABLED_REASON: reason,
  })
  if (!email && !token) {
    return { ADMIN_EMAIL: undefined, ADMIN_SETUP_TOKEN: undefined, ADMIN_DISABLED_REASON: null }
  }
  if (!email || !token) {
    return disabled('ADMIN_EMAIL ve ADMIN_SETUP_TOKEN birlikte tanımlanmalı (ya da ikisi de boş)')
  }
  if (!z.email().safeParse(email).success) return disabled('ADMIN_EMAIL geçerli bir e-posta değil')
  if (token.length < ADMIN_SETUP_TOKEN_MIN_LENGTH) {
    return disabled(
      `ADMIN_SETUP_TOKEN en az ${ADMIN_SETUP_TOKEN_MIN_LENGTH} karakter olmalı (şu an ${token.length})`,
    )
  }
  return { ADMIN_EMAIL: email, ADMIN_SETUP_TOKEN: token, ADMIN_DISABLED_REASON: null }
}

/**
 * Geliştirmede repo kökündeki env dosyalarını yükler: önce kullanıcının .env'i (varsa), sonra
 * .env.example (sır olmayan geliştirme varsayılanları). Önce yüklenen kazanır; zaten tanımlı
 * değişkenler ezilmez. Üretimde env'i Dokploy sağlar ve bu fonksiyon hiçbir şey yüklemez.
 */
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
