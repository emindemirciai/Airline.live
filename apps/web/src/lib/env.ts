import 'server-only'
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

/**
 * Eski alan adları (D-112): virgülle ayrılmış, şemasız, tam alan adları; boş = yönlendirme yok. Proxy
 * aynı listeyi hoşgörüyle okur (lib/legacy-host.ts); buradaki sıkı doğrulama hatalı yazımı açılışta
 * yakalar.
 */
const legacyHostList = z.preprocess(
  splitHostList,
  z.array(
    z
      .string()
      .refine(
        isLegacyHostEntry,
        'şemasız ve yolsuz tam alan adı olmalı (ör. old.example ya da www.old.example); IP adresi ve tek parçalı ad (localhost, hy-api) olamaz',
      ),
  ),
)

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
      .regex(PUBLIC_HOST, 'şemasız host olmalı (ör. airline.live ya da localhost:3100)')
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
      .regex(PUBLIC_HOST, 'şemasız host olmalı (ör. api.airline.live ya da localhost:4100)')
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
  // Eski alan adları (D-112): bu host'lara gelen her istek yol ve sorgusuyla 308 alır; web host'ları
  // https://<WEB_HOST>'a (www dahil; ör. old.example,www.old.example), admin host'ları
  // https://<ADMIN_HOST>'a. Boşsa yönlendirme yoktur.
  LEGACY_WEB_HOSTS: legacyHostList,
  LEGACY_ADMIN_HOSTS: legacyHostList,
})

type LegacyListKey = 'LEGACY_WEB_HOSTS' | 'LEGACY_ADMIN_HOSTS'

/**
 * - WEB_HOST üretimde zorunludur: kanonik adresler, site haritası ve robots.txt onunla mutlak yazılır.
 * - Eski host listesi hedefi ister (web listesi WEB_HOST'u, admin listesi ADMIN_HOST'u) ve yeni
 *   host'ları (WEB_HOST, www.WEB_HOST, ADMIN_HOST, API_HOST) kapsayamaz; iki liste ortak host
 *   taşıyamaz. Aksi hâlde yönlendirme döngüye girer ya da canlı bir host'u kapatırdı.
 */
const ServerEnvSchema = ServerEnvFields.superRefine((env, ctx) => {
  if (env.APP_ENV === 'production' && !env.WEB_HOST) {
    ctx.addIssue({
      code: 'custom',
      path: ['WEB_HOST'],
      message: 'üretimde zorunlu (ör. airline.live)',
    })
  }
  const targets: Record<LegacyListKey, ['WEB_HOST' | 'ADMIN_HOST', string | undefined]> = {
    LEGACY_WEB_HOSTS: ['WEB_HOST', env.WEB_HOST],
    LEGACY_ADMIN_HOSTS: ['ADMIN_HOST', env.ADMIN_HOST],
  }
  const current = [
    env.WEB_HOST,
    env.WEB_HOST ? `www.${env.WEB_HOST}` : undefined,
    env.ADMIN_HOST,
    env.API_HOST,
  ]
    .map((host) => normalizeHost(host))
    .filter(Boolean)
  for (const key of ['LEGACY_WEB_HOSTS', 'LEGACY_ADMIN_HOSTS'] as const) {
    const [targetKey, target] = targets[key]
    const list = env[key]
    if (list.length > 0 && !normalizeHost(target)) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `${targetKey} tanımlı olmalı (eski host'lar ona yönlenir)`,
      })
    }
    for (const entry of list) {
      const covered = current.find((host) => hostMatches(entry, host))
      if (covered) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${entry} yeni host'u (${covered}) kapsıyor; yönlendirme döngüye girer`,
        })
      }
    }
  }
  for (const entry of env.LEGACY_WEB_HOSTS) {
    if (
      env.LEGACY_ADMIN_HOSTS.some((other) => hostMatches(entry, other) || hostMatches(other, entry))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['LEGACY_ADMIN_HOSTS'],
        message: `${entry} iki listede birden var (LEGACY_WEB_HOSTS ve LEGACY_ADMIN_HOSTS)`,
      })
    }
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

/** Marka adı (D-112, `@havayolu/shared`). APP_NAME ile değiştirilebilir. */
export { DEFAULT_APP_NAME }

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
