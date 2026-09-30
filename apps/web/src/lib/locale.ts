import 'server-only'
import { resolveLocale } from '@havayolu/i18n'
import type { Locale } from '@havayolu/shared'
import { headers } from 'next/headers'
import { isAdminPath } from './admin-host'
import { LOCALE_HEADER, PATH_HEADER } from './locale-routing'

/**
 * Mantıksal yol ve sorgu metni (`/en` öneki olmadan), proxy'nin `PATH_HEADER` başlığından. Başlık
 * yoksa (proxy'nin çalışmadığı yollar) ya da biçimi bozuksa kök yol döner.
 */
export async function getLogicalPath(): Promise<string> {
  const value = (await headers()).get(PATH_HEADER)
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

/**
 * Sayfanın dili adresten gelir (D-076): proxy `/en/*` isteklerinde `LOCALE_HEADER`'ı `en` yapar,
 * diğerlerinde `tr`. Çerez ve Accept-Language okunmaz. Yönetim yalnızca Türkçedir.
 */
export async function getLocale(): Promise<Locale> {
  const incoming = await headers()
  const path = incoming.get(PATH_HEADER) ?? '/'
  if (isAdminPath(path.split(/[?#]/)[0] ?? '/')) return 'tr'
  return resolveLocale(incoming.get(LOCALE_HEADER))
}
