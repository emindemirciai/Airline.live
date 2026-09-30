/**
 * SEO dosyalarının kullandığı site içi yollar (dil önekisiz; dil için `localePath`). Saf modül.
 */

/** Havalimanı sayfası: `/istasyon/LTFM`. ICAO adreste büyük harflidir (D-076). */
export function airportPath(icao: string): string {
  return `/istasyon/${encodeURIComponent(icao.trim().toUpperCase())}`
}

/** Canlı haritayı havalimanında açan adres: `/?havalimani=LTFM` (kanonik adres `/` kalır). */
export function airportMapPath(icao: string): string {
  return `/?havalimani=${encodeURIComponent(icao.trim().toUpperCase())}`
}
