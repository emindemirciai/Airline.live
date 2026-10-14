import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  DEFAULT_APP_NAME,
  hostMatches,
  isLegacyHostEntry,
  normalizeHost,
  PUBLIC_HOST,
  splitHostList,
  withoutEnvPlaceholders,
} from '@havayolu/shared'
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

/** Eski API alan adları (D-112): web'deki `LEGACY_*_HOSTS` ile aynı biçim ve kurallar. */
const legacyHostList = z.preprocess(
  splitHostList,
  z.array(
    z
      .string()
      .refine(
        isLegacyHostEntry,
        'şemasız ve yolsuz tam alan adı olmalı (ör. api.old.example); IP adresi ve tek parçalı ad (localhost, hy-api) olamaz',
      ),
  ),
)

const EnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_LISTEN_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).optional()),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // İmaja build sırasında gömülür ve Dokploy'a girilmez; boş gelirse açılışı engellemez, 'dev' olur.
  GIT_SHA: z.preprocess(emptyToUndefined, z.string().min(1).default('dev')),
  BUILD_TIME: optionalString,
  // Marka adı (D-112): OpenAPI başlığı ve /version yanıtı. Web ve worker'la aynı env satırı.
  APP_NAME: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).max(64).default(DEFAULT_APP_NAME),
  ),

  DATABASE_URL: optionalUrl,
  REDIS_QUEUE_URL: optionalUrl,
  REDIS_LIVE_URL: optionalUrl,

  WEB_HOST: optionalString,
  ADMIN_HOST: optionalString,
  // API'nin genel host'u (şemasız; web'in tarayıcıya verdiği adresle aynı satır). Yalnızca eski API
  // alan adlarının yönlendirme hedefidir.
  API_HOST: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .toLowerCase()
      .regex(PUBLIC_HOST, 'şemasız host olmalı (ör. api.airline.live ya da localhost:4100)')
      .optional(),
  ),
  // Eski API alan adları (D-112): bu host'lara gelen her istek 308 ile https://<API_HOST>'a gider
  // (yol ve sorgu korunur; WebSocket el sıkışması da 308 alır ve kapanır). Boşsa yönlendirme yok.
  LEGACY_API_HOSTS: legacyHostList,
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

  // Canlı API (D-074): toplam WebSocket bağlantısı ve redis-live yoklama aralığı.
  WS_MAX_CONNECTIONS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(100_000).default(2_000),
  ),
  LIVE_POLL_MS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(250).max(10_000).default(1_000),
  ),
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
  issues.push(...legacyApiHostIssues(data))
  if (issues.length > 0) throw new EnvError(issues)
  const fallbackPort =
    data.APP_ENV === 'production' ? DEFAULT_API_PORT.production : DEFAULT_API_PORT.local
  return { ...data, ...adminSettings(data), API_PORT: data.API_PORT ?? fallbackPort }
}

/**
 * Eski API host listesi hedefi (API_HOST) ister ve yeni host'ları (API_HOST, WEB_HOST, ADMIN_HOST)
 * kapsayamaz: aksi hâlde yönlendirme döngüye girer ya da canlı bir host'u kapatırdı.
 */
function legacyApiHostIssues(data: ParsedEnv): string[] {
  if (data.LEGACY_API_HOSTS.length === 0) return []
  if (!data.API_HOST) {
    return ["LEGACY_API_HOSTS: API_HOST tanımlı olmalı (eski host'lar ona yönlenir)"]
  }
  const current = [data.API_HOST, data.WEB_HOST, data.ADMIN_HOST]
    .map((host) => normalizeHost(host))
    .filter(Boolean)
  return data.LEGACY_API_HOSTS.flatMap((entry) => {
    const covered = current.find((host) => hostMatches(entry, host))
    return covered
      ? [`LEGACY_API_HOSTS: ${entry} yeni host'u (${covered}) kapsıyor; yönlendirme döngüye girer`]
      : []
  })
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
