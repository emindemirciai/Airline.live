/**
 * Havalimanı pini (kullanıcı isteği 2026-10-01, D-079): özgün, damla biçimli kırmızı iğne. Ucu
 * havalimanı referans noktasını gösterir; başında beyaz nokta, çevresinde beyaz kenar ve koyu hat
 * vardır (uydu, koyu ve açık altlıkta okunur). Başka marka ya da üçüncü taraf simgesi değildir.
 * Web tuvale çizer (`renderAirportPin`), mobil aynı yolu kullanır.
 *
 * Koordinatlar pin birimidir: görünüm kutusu 24 × 32, uç (12, 32), baş merkezi (12, 11,2).
 */
export const AIRPORT_PIN_ICON_ID = 'hy-airport-pin'
export const AIRPORT_PIN_VIEWBOX = { width: 24, height: 32 } as const
export const AIRPORT_PIN_PATH =
  'M12 32C12 32 2 19.6 2 11.2A10 10 0 0 1 22 11.2C22 19.6 12 32 12 32Z'
/** Başın merkezi ve yarıçapı (pin birimi); baştaki beyaz nokta merkezde `AIRPORT_PIN_DOT_RADIUS`. */
export const AIRPORT_PIN_HEAD = { cx: 12, cy: 11.2, r: 10 } as const
export const AIRPORT_PIN_DOT_RADIUS = 3.6
/** Beyaz kenar ve koyu hattın kalınlıkları (pin birimi; yarısı silüetin dışında kalır). */
export const AIRPORT_PIN_OUTLINE = 2.4
export const AIRPORT_PIN_HALO = 1.2
/**
 * Bitmapin çevresindeki pay (pin birimi): kenar ve hat taşmasın. Alt pay katmanın `icon-offset`'i ile
 * telafi edilir; pinin geometrik ucu tam noktaya düşer.
 */
export const AIRPORT_PIN_MARGIN = 3
