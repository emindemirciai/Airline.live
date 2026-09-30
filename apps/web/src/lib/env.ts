import 'server-only'
import { withoutEnvPlaceholders } from '@havayolu/shared'
import { z } from 'zod'

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

/** Worker'daki bayrakla aynı yazımlar: true/false/1/0 (büyük-küçük harf fark etmez). */
const booleanFlag = (fallback: boolean) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() || undefined : value),
    z
      .enum(['true', 'false', '1', '0'])
      .optional()
      .transform((value) => (value === undefined ? fallback : value === 'true' || value === '1')),
  )

/** Şemasız genel host: `api.havayolu.live`, `localhost:4100`, `[::1]:4100`. */
const PUBLIC_HOST =
  /^(?:\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)(?::\d{1,5})?$/

/**
 * Harita stili: aynı sitedeki bir yol (`/test-style.json`) ya da mutlak http(s) adresi.
 * `//host/…` biçimi (şemasız dış adres) kabul edilmez.
 */
const styleUrl = z
  .string()
  .trim()
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//')) || /^https?:\/\/[^/\s]+/.test(value),
    "'/' ile başlayan bir yol ya da http(s) adresi olmalı",
  )

/** ArcGIS API anahtarı; karo adresine sorgu parametresi olarak girer. */
const ESRI_API_KEY = /^[A-Za-z0-9._~+/=-]+$/

/**
 * Arama motoru site doğrulama kodu (Google Search Console, Bing Webmaster, Yandex Webmaster): meta
 * etiketinin yalnızca `content` değeri. Kullanıcı üretir (ACTIVATION); tanımsızsa etiket çıkmaz.
 */
const siteVerification = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,128}$/, 'yalnızca harf, rakam, _ ve - (en fazla 128 karakter)')
    .optional(),
)

const ServerEnvFields = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  API_INTERNAL_URL: z.preprocess(emptyToUndefined, z.url().default('http://localhost:4100')),
  // İmaja build sırasında gömülür ve Dokploy'a girilmez; boş gelirse açılışı engellemez, 'dev' olur.
  GIT_SHA: z.preprocess(emptyToUndefined, z.string().min(1).default('dev')),
  BUILD_TIME: z.preprocess(emptyToUndefined, z.string().optional()),
  // Sitenin genel alan adı (şemasız, D-059): kanonik adresler, hreflang, site haritası ve robots.txt
  // bu adla mutlak yazılır; www isteği buraya yönlenir. Üretimde zorunludur.
  WEB_HOST: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .toLowerCase()
      .regex(PUBLIC_HOST, 'şemasız host olmalı (ör. havayolu.live ya da localhost:3100)')
      .optional(),
  ),
  ADMIN_HOST: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  ANALYZE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  ANALYZE_SITE_ID: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  // Tarayıcının REST ve WebSocket için doğrudan bağlandığı API host'u (şemasız, D-075).
  API_HOST: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(PUBLIC_HOST, 'şemasız host olmalı (ör. api.havayolu.live ya da localhost:4100)')
      .default('localhost:4100'),
  ),
  MAP_STYLE_URL: z.preprocess(emptyToUndefined, styleUrl.default('/test-style.json')),
  MAP_STYLE_URL_DARK: z.preprocess(emptyToUndefined, styleUrl.optional()),
  MAP_STYLE_FALLBACK_URL: z.preprocess(emptyToUndefined, styleUrl.optional()),
  // true iken harita yerel stili kullanır; tarayıcı dış harita sunucusuna istek atmaz.
  EXTERNAL_PROVIDERS_DISABLED: booleanFlag(false),
  // Uydu altlığı (Esri World Imagery, D-075); kullanıcı üretir, yoksa koyu vektör harita kullanılır.
  ESRI_API_KEY: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(512)
      .regex(ESRI_API_KEY, 'yalnızca harf, rakam ve ._~+/=- karakterleri')
      .optional(),
  ),
  GOOGLE_SITE_VERIFICATION: siteVerification,
  BING_SITE_VERIFICATION: siteVerification,
  YANDEX_VERIFICATION: siteVerification,
})

/** WEB_HOST üretimde zorunludur: kanonik adresler, site haritası ve robots.txt onunla mutlak yazılır. */
const ServerEnvSchema = ServerEnvFields.superRefine((env, ctx) => {
  if (env.APP_ENV === 'production' && !env.WEB_HOST) {
    ctx.addIssue({
      code: 'custom',
      path: ['WEB_HOST'],
      message: 'üretimde zorunlu (ör. havayolu.live)',
    })
  }
})

export type ServerEnv = z.infer<typeof ServerEnvSchema>

/** Sunucu tarafı yapılandırması; çalışma zamanında okunur (build'e gömülmez). */
export function getServerEnv(): ServerEnv {
  // Şablondaki "#…#" talimatları tanımsız sayılır (D-063).
  const result = ServerEnvSchema.safeParse(withoutEnvPlaceholders(process.env))
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(
      `Web ortam değişkenleri hatalı: ${issues}. Açıklamalar için .env.example dosyasına bak.`,
    )
  }
  return result.data
}

/** Marka adı (D-059). APP_NAME ile değiştirilebilir. */
export const DEFAULT_APP_NAME = 'havayolu'

export function appName(env: ServerEnv): string {
  return env.APP_NAME && env.APP_NAME.length > 0 ? env.APP_NAME : DEFAULT_APP_NAME
}

/** Analiz takip script'i yalnızca adres ve site kimliği birlikte tanımlıysa kullanılabilir. */
export function analyticsConfig(env: ServerEnv): { trackerUrl: string; siteId: string } | null {
  if (!env.ANALYZE_URL || !env.ANALYZE_SITE_ID) return null
  return {
    trackerUrl: new URL('/api/tracker', env.ANALYZE_URL).toString(),
    siteId: env.ANALYZE_SITE_ID,
  }
}
