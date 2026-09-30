/**
 * Dil değiştirme bağlantısının adresi (saf; sunucu layout'u ve istemci bileşeni birlikte kullanır).
 * `'use client'` dosyasında durmaz: sunucu bileşeni oradan yalnızca bileşen alabilir, işlev çağıramaz.
 */
import type { Locale } from '@havayolu/shared'
import { localePath, stripLocale } from './locale-routing'
import { safeLogicalPath } from './safe-path'

/**
 * Mantıksal yolun (öneksiz, sorgu metniyle; proxy'nin `PATH_HEADER` değeri) hedef dildeki adresi:
 * ('en', '/?hex=ff0001') → '/en?hex=ff0001'; ('tr', '/istasyon/LTFM') → '/istasyon/LTFM'. Güvensiz
 * yol kök adrese döner.
 */
export function languageToggleHref(target: Locale, logicalPath: string | null | undefined): string {
  return localePath(target, safeLogicalPath(logicalPath))
}

/**
 * Tarayıcının adresinden (`location.pathname` + `location.search`) hedef dildeki adres. Adresteki
 * dil öneki ayrılır; sorgu metni (seçili uçak `?hex=`) korunur, `#` kısmı alınmaz.
 */
export function languageToggleHrefFromLocation(
  target: Locale,
  pathname: string | null | undefined,
  search: string | null | undefined = '',
): string {
  const path = pathname && pathname.startsWith('/') ? stripLocale(pathname).path : '/'
  const query = (search ?? '').replace(/^\?/, '')
  return languageToggleHref(target, query === '' ? path : `${path}?${query}`)
}
