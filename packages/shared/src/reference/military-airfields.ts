/**
 * Askerî hava üsleri: ad tablosundaki (`AIRPORT_NAMES`, airport-names.ts) `military` kaynaklı
 * kayıtlar (D-084; İncirlik, Afyon, Bandırma, Eskişehir, Çiğli), ICAO sırasıyla. Haritada pinleri,
 * kodları, pencereleri ve "Havalimanları" listesinde satırları yoktur; ülke adlarının engeli de
 * sayılmazlar (D-103). Sayfaları, API ve uçak listesinin konum ve durum satırı onları yine kullanır
 * (site haritasında ve llms.txt'de zaten yoklar: `noindex`, D-084). Yurt dışındaki ortak
 * sivil-askerî havalimanları (tarifeli sivil seferi olan) sivildir, burada yoktur.
 *
 * Liste ad tablosundan türetilmez, burada yazılıdır: canlı harita `mapShownAirports`'u ilk paketinde
 * kullanır ve bu modül ad tablolarını (airport-names.ts, foreign-airport-names*.ts) içe aktarsaydı
 * paketleyici tabloları haritanın ilk paketine taşırdı (D-101'in ölçtüğü ~76 KB'lık 4. halka tablosu
 * dahil; D-102). Tek kaynak yine tablodur: `reference.test.ts` listenin tablonun `military` kaynaklı
 * kayıtlarıyla tam olarak aynı olduğunu denetler.
 */
export const MILITARY_AIRFIELD_ICAOS: readonly string[] = ['LTAG', 'LTAH', 'LTBG', 'LTBI', 'LTBL']

const MILITARY_AIRFIELDS: ReadonlySet<string> = /*#__PURE__*/ new Set(MILITARY_AIRFIELD_ICAOS)

/** Askerî hava üssü mü (`MILITARY_AIRFIELD_ICAOS`, D-103). ICAO kırpılıp büyük harfe çevrilir. */
export function isMilitaryAirfield(icao: string): boolean {
  return MILITARY_AIRFIELDS.has(icao.trim().toUpperCase())
}

/**
 * Haritada gösterilen havalimanları (D-103), sıra korunarak: askerî hava üsleri
 * (`isMilitaryAirfield`) çıkarılır. Kuralın tek yeridir: web haritası (pinler, kodlar, havalimanı
 * penceresi, "Havalimanları" listesi) ve ülke adlarının engelleri (tools `mapAirportPins`, D-099)
 * bunu kullanır. Kural değişirse ülke adlarının tablosu `pnpm country-labels` ile yeniden üretilir;
 * tools'un sürüklenme testi o zamana kadar kırılır.
 */
export function mapShownAirports<T extends { readonly icao: string }>(airports: readonly T[]): T[] {
  return airports.filter((airport) => !isMilitaryAirfield(airport.icao))
}
