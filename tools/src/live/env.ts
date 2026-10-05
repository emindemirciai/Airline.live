import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'

export { findWorkspaceRoot } from '../replay-receiver/env'

/**
 * Canlı araçların (`pnpm record`, `pnpm smoke:live`) ortam okuması. Öncelik worker'ın geliştirme
 * yüklemesiyle aynıdır: süreç ortamı > kökteki `.env` > `.env.example` (ilk tanımlı olan kazanır;
 * süreçte tanımlı boş değer de kazanır). `process.env` değiştirilmez.
 */
export function devEnvSource(
  root: string | null,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string | undefined> {
  const merged: Record<string, string | undefined> = {}
  if (root !== null) {
    // Önce en düşük öncelikli dosya; sonraki her katman öncekinin üstüne yazar.
    for (const file of ['.env.example', '.env']) {
      const path = join(root, file)
      if (!existsSync(path)) continue
      Object.assign(merged, parseEnv(readFileSync(path, 'utf8')))
    }
  }
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) merged[key] = value
  }
  return merged
}

/** Kök `package.json` sürümü (User-Agent'taki ürün sürümü). */
export function workspaceVersion(root: string): string {
  const parsed: unknown = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const version =
    typeof parsed === 'object' && parsed !== null && 'version' in parsed ? parsed.version : null
  if (typeof version !== 'string' || !version.trim()) {
    throw new Error('kök package.json sürüm alanı yok')
  }
  return version.trim()
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/** Yalnızca geri döngü adları: localhost, 127.0.0.1, ::1 ve [::1]. */
export function isLocalHostname(h: string): boolean {
  return LOCAL_HOSTNAMES.has(h.trim().toLowerCase())
}

/**
 * User-Agent'a yazılacak site adresi (`providerUserAgent`'ın `webHost`'u). `WEB_HOST`'un host
 * kısmı yerelse (`.env.example`'daki `localhost:3100` gibi) null döner: UA `(+mailto:<e-posta>)`
 * biçimini alır, localhost ilan edilmez. Genel bir host olduğu gibi döner (alan adı koda gömülmez).
 */
export function userAgentWebHost(webHost: string | undefined): string | null {
  const value = webHost?.trim() ?? ''
  if (!value) return null
  let hostname = value
  try {
    hostname = new URL(value.includes('://') ? value : `http://${value}`).hostname
  } catch {
    // Ayrıştırılamayan değer (ör. köşeli parantezsiz ::1) aşağıda olduğu gibi denetlenir.
  }
  if (isLocalHostname(hostname) || isLocalHostname(value)) return null
  return value
}

const REDACT_NAMES = ['CONTACT_EMAIL', 'ADSBLOL_API_KEY'] as const

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Çıktı maskesi: verilen gizli değerlerin her geçişini (büyük/küçük harf duyarsız, URL kodlanmış
 * biçimi dahil) `<AD>` ile değiştirir. Dizi biçiminde sıra `[CONTACT_EMAIL, ADSBLOL_API_KEY]`'dir
 * (sonrakiler `<gizli>` olur); nesne biçiminde anahtar adı kullanılır. Boş değerler atlanır.
 */
export function createRedactor(
  secrets: readonly (string | undefined)[] | Readonly<Record<string, string | undefined>>,
): (text: string) => string {
  const entries: [label: string, value: string][] = Array.isArray(secrets)
    ? secrets.map((value, index) => [`<${REDACT_NAMES[index] ?? 'gizli'}>`, value ?? ''])
    : Object.entries(secrets).map(([name, value]) => [`<${name}>`, value ?? ''])
  const patterns: { label: string; re: RegExp; length: number }[] = []
  for (const [label, raw] of entries) {
    const values = new Set([raw, raw.trim()])
    for (const value of [...values]) {
      try {
        values.add(encodeURIComponent(value))
      } catch {
        // Yalnız vekil karakter içeren değer kodlanamaz; ham hâli yine maskelenir.
      }
    }
    for (const value of values) {
      if (!value.trim()) continue
      patterns.push({ label, re: new RegExp(escapeRegExp(value), 'gi'), length: value.length })
    }
  }
  // Uzun değer önce: biri ötekini içeriyorsa kısa olan uzunun parçasını bozmaz.
  patterns.sort((a, b) => b.length - a.length)
  return (text: string) => patterns.reduce((out, p) => out.replace(p.re, p.label), text)
}
