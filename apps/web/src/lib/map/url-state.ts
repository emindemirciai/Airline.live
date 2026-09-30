/**
 * Seçili uçağın adreste tutulması: canlı uçak `/?hex=<hex>` (CLAUDE.md → URL şeması). Bildirimler
 * ve paylaşılan bağlantılar bu adresi açar; seçim değişince adres `history.replaceState` ile
 * güncellenir (geçmiş kaydı eklenmez).
 */

/** ICAO 24 bit adresi; `~` öneki ICAO dışı (TIS-B, MLAT) adresleri belirtir. */
const HEX = /^~?[0-9a-f]{6}$/

/** `hex` sorgu parametresi: kırpılıp küçük harfe çevrilir; geçersizse null. Tekrarlıysa ilki. */
export function parseHexParam(value: string | string[] | undefined | null): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return null
  const hex = raw.trim().toLowerCase()
  return HEX.test(hex) ? hex : null
}

/**
 * Geçerli adresin `hex` parametresi ayarlanmış (null ise kaldırılmış) hâli; diğer parametreler
 * ve `#` kısmı korunur. Aynı sitede kalır: yol + sorgu + parça döner.
 */
export function hexUrl(currentHref: string, hex: string | null): string {
  const url = new URL(currentHref)
  if (hex === null) url.searchParams.delete('hex')
  else url.searchParams.set('hex', hex)
  return `${url.pathname}${url.search}${url.hash}`
}
