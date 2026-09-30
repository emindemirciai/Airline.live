/**
 * Haritanın adresteki durumu (CLAUDE.md → URL şeması):
 * - Seçili uçak `/?hex=<hex>`. Bildirimler ve paylaşılan bağlantılar bu adresi açar; seçim değişince
 *   adres `history.replaceState` ile güncellenir (geçmiş kaydı eklenmez). İngilizce sayfada adres
 *   `/en?hex=` olarak kalır.
 * - Açılışta ortalanacak havalimanı `/?havalimani=<ICAO>` (havalimanı sayfasındaki "Canlı haritada
 *   aç" bağlantısı). Kanonik adres yine `/`'dir.
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

/** ICAO (4) ya da IATA (3) kodu: harf ve rakam. */
const AIRPORT_CODE = /^[A-Z0-9]{3,4}$/

/**
 * `havalimani` sorgu parametresi: kırpılıp büyük harfe çevrilir; geçerli bir ICAO (`LTFM`) ya da IATA
 * (`IST`) biçiminde değilse null. Tekrarlıysa ilki. Kodun gerçekten var olup olmadığına harita
 * havalimanı listesiyle bakar.
 */
export function parseAirportParam(value: string | string[] | undefined | null): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  return AIRPORT_CODE.test(code) ? code : null
}

/** Koda (ICAO ya da IATA) uyan havalimanı; yoksa undefined. ICAO eşleşmesi önceliklidir. */
export function findAirportByCode<T extends { icao: string; iata: string }>(
  airports: readonly T[],
  code: string,
): T | undefined {
  return airports.find((a) => a.icao === code) ?? airports.find((a) => a.iata === code)
}
