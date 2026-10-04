/**
 * Havalimanının uygulamadaki kimliği (kanonik ICAO), OurAirports satırından (D-080): `icao_code`,
 * yoksa `gps_code`, o da yoksa `ident`; kırpılmış, büyük harf. Sayfa adresi (`/istasyon/<ICAO>`),
 * ad ve şehir tabloları, saat dilimi kuralları ve hava durumu istasyonu bu kimliği kullanır.
 *
 * Kaynakta yanlış olduğu bilinen kodlar `OURAIRPORTS_ICAO_CORRECTIONS` ile düzeltilir (D-088). Satır
 * kaynakta olduğu gibi kalır (fixture ve veritabanı değişmez); düzeltme okurken uygulanır ve yalnız
 * kaynaktaki yanlış değer durdukça geçerlidir: OurAirports kaydı düzeltirse ya da değiştirirse
 * tablo kendiliğinden devre dışı kalır.
 *
 * Aynı kural `@havayolu/db`'de de yazılıdır (db bu pakete bağımlı değildir); API testi
 * (`apps/api/src/reference/rings.test.ts`) iki yazımın aynı kalmasını denetler.
 */

/** Bir düzeltme: satırın `ident`'i anahtardır; `icaoCode` kaynaktaki yanlış değer, `icao` doğrusu. */
export interface IcaoCorrection {
  /** OurAirports `icao_code` ve `gps_code` alanındaki (yanlış) değer. */
  readonly icaoCode: string
  /** Uygulamanın kullandığı ICAO kodu. */
  readonly icao: string
}

/**
 * OurAirports `ident` → düzeltme (D-088).
 * - **HEBA, İskenderiye (Borg El Arab, HBE):** OurAirports'ta `ident` HEBA, `icao_code` ve
 *   `gps_code` HEAX. HEAX, 2011'de kapanan El Nouzha havalimanının (OurAirports'ta "closed",
 *   anahtar sözcükleri "Alexandria International Airport, HEAX, ALY") koduydu; Borg El Arab'ın
 *   ICAO kodu HEBA'dır ve OurAirports kimliği de odur. Kod HEAX kalsaydı METAR/TAF HEAX diye
 *   istenir, İskenderiye'nin hava durumu hiç gelmezdi. Yayından sonra HEBA raporlarının geldiği
 *   doğrulanır (ACTIVATION).
 */
export const OURAIRPORTS_ICAO_CORRECTIONS: Readonly<Record<string, IcaoCorrection>> = {
  HEBA: { icaoCode: 'HEAX', icao: 'HEBA' },
}

/** OurAirports satırının kimlik alanları (CSV sütunları ya da veritabanı satırı). */
export interface OurAirportsCodes {
  ident: string
  icaoCode: string | null | undefined
  gpsCode: string | null | undefined
}

const present = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

/**
 * Satırın kanonik ICAO'su: düzeltme varsa ve kaynaktaki yanlış değer duruyorsa düzeltilmiş kod;
 * yoksa `icao_code`, `gps_code`, `ident` (ilk boş olmayan), kırpılmış ve büyük harf.
 */
export function ourAirportsIcao(row: OurAirportsCodes): string {
  const ident = row.ident.trim().toUpperCase()
  const icaoCode = present(row.icaoCode)?.toUpperCase() ?? null
  const correction = Object.hasOwn(OURAIRPORTS_ICAO_CORRECTIONS, ident)
    ? OURAIRPORTS_ICAO_CORRECTIONS[ident]
    : undefined
  if (correction !== undefined && icaoCode === correction.icaoCode) return correction.icao
  return (icaoCode ?? present(row.gpsCode) ?? ident).toUpperCase()
}
