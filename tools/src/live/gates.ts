import { ADSBLOL_BASE_URL } from '@havayolu/providers'
import { isLocalHostname } from './env'

/**
 * Canlı araçların ortak kapıları (D-094). Ret iletisi sabittir: adres, parola, e-posta ya da başka
 * bir değer yazmaz; `subject` yalnızca değişken ADIDIR.
 */

export type RefusalCode =
  | 'confirm_missing'
  | 'agent_session'
  | 'ci'
  | 'external_disabled'
  | 'app_env'
  | 'contact_email'
  | 'url_missing'
  | 'url_not_local'
  | 'env_invalid'
  | 'targets'
  | 'other_ingest'
  | 'lock_held'
  | 'lock_lost'
  | 'redis_unanswered'
  | 'out_in_fixtures'
  | 'out_in_repo'

export interface Refusal {
  code: RefusalCode
  /** Değişken adı (ör. DATABASE_URL); hiçbir zaman değer değil. */
  subject?: string
}

export type LiveUrlName = 'DATABASE_URL' | 'REDIS_LIVE_URL'

export interface GateInput {
  confirm: boolean
  /** Gerçek kabuk ortamı (CI, EXTERNAL_PROVIDERS_DISABLED, ajan oturumu yalnızca buradan okunur). */
  shellEnv: NodeJS.ProcessEnv
  /** `devEnvSource` sonucu: süreç > .env > .env.example. */
  source: Record<string, string | undefined>
  requiredUrls: readonly LiveUrlName[]
  /**
   * İsteklerin gideceği taban adres; verilmezse canlı adsb.lol. `ci` ve `external_disabled` kapıları
   * yalnızca canlı adreste uygulanır (127.0.0.1'deki test sunucusu CI'da da çalışır).
   */
  baseUrl?: string
}

/** Yerel olması denetlenen adresler; ilk ikisi `requiredUrls` ile zorunlu da olabilir. */
const LOCAL_ONLY_URLS = ['DATABASE_URL', 'REDIS_LIVE_URL', 'REDIS_QUEUE_URL'] as const

const ALLOWED_APP_ENVS = new Set(['development', 'test'])

/** `#…#` şablon talimatı (D-063) tanımsız sayılır; worker'ın `parseEnv`'i de böyle okur. */
function present(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed || /^#.*#$/.test(trimmed)) return null
  return trimmed
}

/** ci-info ile aynı: tanımlı, boş değil ve "false"/"0" değilse CI ortamıdır. */
function isCi(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase() ?? ''
  return v !== '' && v !== 'false' && v !== '0'
}

/** Worker'ın boolean bayrağı gibi: "true" ya da "1" (büyük/küçük harf duyarsız). */
function isTrueFlag(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase() ?? ''
  return v === 'true' || v === '1'
}

/** Taban adres canlı adsb.lol mü? Ayrıştırılamayan adres güvenli tarafta canlı sayılır. */
export function isLiveBaseUrl(baseUrl: string | undefined): boolean {
  if (baseUrl === undefined) return true
  try {
    return new URL(baseUrl).origin === new URL(ADSBLOL_BASE_URL).origin
  } catch {
    return true
  }
}

/**
 * Bütün retleri sırayla döndürür (boş dizi = geçti). `--confirm` yokken `confirm_missing` de
 * listededir; kuru çalıştırma planı kapıların durumunu bu listeden yazar. Ajan oturumu kapısı
 * yalnızca `--confirm` ile uygulanır: plan ve yardım ajan oturumunda da çalışır.
 */
export function checkLiveGates(input: GateInput): Refusal[] {
  const { shellEnv, source } = input
  const refusals: Refusal[] = []
  if (!input.confirm) refusals.push({ code: 'confirm_missing' })
  if (input.confirm) {
    for (const name of ['CLAUDECODE', 'AI_AGENT'] as const) {
      if (shellEnv[name]?.trim()) {
        refusals.push({ code: 'agent_session', subject: name })
        break
      }
    }
  }
  if (isLiveBaseUrl(input.baseUrl)) {
    if (isCi(shellEnv.CI)) refusals.push({ code: 'ci', subject: 'CI' })
    if (isTrueFlag(shellEnv.EXTERNAL_PROVIDERS_DISABLED)) {
      refusals.push({ code: 'external_disabled', subject: 'EXTERNAL_PROVIDERS_DISABLED' })
    }
  }
  const appEnv = present(source.APP_ENV) ?? 'development'
  if (!ALLOWED_APP_ENVS.has(appEnv)) refusals.push({ code: 'app_env', subject: 'APP_ENV' })
  if (present(source.CONTACT_EMAIL) === null) {
    refusals.push({ code: 'contact_email', subject: 'CONTACT_EMAIL' })
  }
  for (const name of LOCAL_ONLY_URLS) {
    const value = present(source[name])
    if (value === null) {
      if ((input.requiredUrls as readonly string[]).includes(name)) {
        refusals.push({ code: 'url_missing', subject: name })
      }
      continue
    }
    let hostname: string
    try {
      hostname = new URL(value).hostname
    } catch {
      refusals.push({ code: 'env_invalid', subject: name })
      continue
    }
    if (!isLocalHostname(hostname)) refusals.push({ code: 'url_not_local', subject: name })
  }
  return refusals
}

/** Sabit Türkçe ret iletisi; hiçbir değer (adres, parola, e-posta) içermez. */
export function refusalText(r: Refusal): string {
  const name = r.subject ?? ''
  switch (r.code) {
    case 'confirm_missing':
      return 'Canlı istek için --confirm ekle (yalnızca plan yazıldı, istek atılmadı)'
    case 'agent_session':
      return 'Canlı araç bir yapay zekâ ajanı oturumunda çalışmaz; kendi terminalinde çalıştır (DUR-SOR 6)'
    case 'ci':
      return "CI ortamında canlı araç çalışmaz (kabukta CI tanımlı); CI ve testler adsb.lol'e istek atmaz"
    case 'external_disabled':
      return 'Kabukta EXTERNAL_PROVIDERS_DISABLED=true; canlı araç için bu kabukta kaldır ya da false yap (dosyalardaki değer okunmaz)'
    case 'app_env':
      return 'APP_ENV development ya da test olmalı; canlı araç üretim ortamında çalışmaz'
    case 'contact_email':
      return "CONTACT_EMAIL tanımlı değil: adsb.lol User-Agent'ı için zorunlu (kökteki .env'e yaz; ACTIVATION 2. adım)"
    case 'url_missing':
      return `${name || 'Bağlantı adresi'} tanımlı değil; yerel altyapı adresi gerekir (pnpm dev:infra)`
    case 'url_not_local':
      return `${name || 'Bağlantı adresi'} yerel değil (yalnızca localhost/127.0.0.1/::1); ${
        name === 'DATABASE_URL' ? 'üretim veritabanına' : 'uzak sunucuya'
      } bağlanılmaz`
    case 'env_invalid':
      return name
        ? `${name} geçersiz; kökteki .env.example'daki biçime bak`
        : "Ortam değişkenleri geçersiz; kökteki .env.example'a bak"
    case 'targets':
      return "Smoke hedefi güvensiz: veritabanı adı app_smoke_live (testte app_test_*) olmalı ve DATABASE_URL'in kendi veritabanı olmamalı; redis-live indeksi 1–15 arası ve REDIS_LIVE_URL'inkinden farklı olmalı"
    case 'other_ingest':
      return "adsb.lol'den çeken başka bir ingest var ya da son 3 dk'da vardı; pnpm dev'i EXTERNAL_PROVIDERS_DISABLED=true ile çalıştır ya da kapat"
    case 'lock_held':
      return 'Başka bir canlı araç (pnpm record ya da pnpm smoke:live) çalışıyor; bitmesini bekle (yarıda kesilen bir çalışmanın kilidi, ör. iki kez Ctrl+C, en çok 2 dk kalır)'
    case 'lock_lost':
      return 'Canlı araç kilidi kaybedildi (başka bir çalışma ya da Redis kesintisi); istekler durduruldu'
    case 'redis_unanswered':
      return "redis-live komutu yanıt vermedi ya da hata verdi; kilit alınamadı, istek atılmadı (pnpm dev:infra'yı denetleyip yeniden dene)"
    case 'out_in_fixtures':
      return "--out tools/fixtures altını gösteremez; commit'lenecek kayıt için --fixture kullan (gizlilik süzgeci uygulanır)"
    case 'out_in_repo':
      return "--out repo içinde yalnızca tools/recordings/tmp altını gösterebilir (gitignore'da): ham kayıt askerî ve PIA/LADD verisi taşır, commit'lenmemeli. Repo dışı bir yol ya da varsayılan çıktıyı kullan"
  }
}
