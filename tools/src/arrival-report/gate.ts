import { isLocalHostname } from '../live/env'

/**
 * Yerel kapsama araçlarının (`pnpm coverage:report`, `arrival-fixture`) tek kapısı (D-098): yalnızca
 * yerel veritabanı. Canlı araçların kapılarından (D-094) farkı: ağa çıkılmadığı için `--confirm`,
 * `CONTACT_EMAIL`, ajan oturumu ve CI reddi yoktur; ajan ve CI çalıştırabilir. Ret iletisi sabittir,
 * adres ya da parola yazmaz; yalnızca değişken adını taşır.
 */

export type LocalDbRefusalCode =
  'database_url_missing' | 'database_url_invalid' | 'database_url_not_local' | 'app_env'

export interface LocalDbRefusal {
  code: LocalDbRefusalCode
  /** Değişken adı (DATABASE_URL, APP_ENV); hiçbir zaman değer değil. */
  subject: 'DATABASE_URL' | 'APP_ENV'
}

const ALLOWED_APP_ENVS = new Set(['development', 'test'])

/** `#…#` şablon talimatı (D-063) tanımsız sayılır; worker'ın `parseEnv`'i de böyle okur. */
function present(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed || /^#.*#$/.test(trimmed)) return null
  return trimmed
}

export type LocalDbGate =
  { ok: true; databaseUrl: string } | { ok: false; refusals: LocalDbRefusal[] }

/**
 * `source` = `devEnvSource` sonucu (süreç > kökteki `.env` > `.env.example`). `APP_ENV` yoksa
 * development sayılır. `DATABASE_URL`'in host'u yalnızca localhost, 127.0.0.1 ya da ::1 olabilir:
 * araçlar üretim veritabanına bağlanmaz (rapor üretimde yalnızca admin işidir).
 */
export function checkLocalDbGate(source: Record<string, string | undefined>): LocalDbGate {
  const refusals: LocalDbRefusal[] = []
  const appEnv = present(source.APP_ENV) ?? 'development'
  if (!ALLOWED_APP_ENVS.has(appEnv)) refusals.push({ code: 'app_env', subject: 'APP_ENV' })
  const url = present(source.DATABASE_URL)
  if (url === null) {
    refusals.push({ code: 'database_url_missing', subject: 'DATABASE_URL' })
  } else {
    let hostname: string | null = null
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:') {
        hostname = parsed.hostname
      }
    } catch {
      hostname = null
    }
    if (hostname === null) {
      refusals.push({ code: 'database_url_invalid', subject: 'DATABASE_URL' })
    } else if (!isLocalHostname(hostname)) {
      refusals.push({ code: 'database_url_not_local', subject: 'DATABASE_URL' })
    }
  }
  return refusals.length === 0 && url !== null
    ? { ok: true, databaseUrl: url }
    : { ok: false, refusals }
}

/** Sabit Türkçe ret iletisi; hiçbir değer (adres, parola) içermez. */
export function localDbRefusalText(r: LocalDbRefusal): string {
  switch (r.code) {
    case 'database_url_missing':
      return 'DATABASE_URL tanımlı değil; yerel veritabanı adresi gerekir (pnpm dev:infra, .env.example)'
    case 'database_url_invalid':
      return "DATABASE_URL geçersiz (postgres://… bekleniyor); kökteki .env.example'daki biçime bak"
    case 'database_url_not_local':
      return 'DATABASE_URL yerel değil (yalnızca localhost/127.0.0.1/::1): bu araç üretim veritabanına bağlanmaz; üretim raporu admin panelindeki işle alınır (/admin/kapsama)'
    case 'app_env':
      return 'APP_ENV development ya da test olmalı; bu araç üretim ortamında çalışmaz'
  }
}
