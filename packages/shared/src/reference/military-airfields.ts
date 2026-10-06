/**
 * Askerî hava üsleri: ad tablosundaki (`AIRPORT_NAMES`, airport-names.ts) `military` kaynaklı
 * kayıtlar (D-084; İncirlik, Afyon, Bandırma, Eskişehir, Çiğli), ICAO sırasıyla. Sitenin hiçbir
 * yerinde yoktur (D-107): sunucu onları listelemez ve Türkiye'deki uzaklık referansı saymaz
 * (`@havayolu/db` `MILITARY_AIRFIELD_ICAOS`, aynı liste; db shared'a bağımlı olmadığı için kendi
 * kopyasını taşır, `apps/api/src/reference/rings.test.ts` ikisini karşılaştırır). Böylece
 * `scope=listed`, ülke listeleri, tek havalimanı ve hava durumu uçları, havalimanı listesi ve
 * sayfaları, site haritası, llms.txt, canlı harita, uçak listesinin konum ve durum satırı ve
 * worker'ın hava durumu istasyonları onları görmez. Yurt dışındaki ortak sivil-askerî havalimanları
 * (tarifeli sivil seferi olan) sivildir, burada yoktur.
 *
 * Liste ad tablosundan türetilmez, burada yazılıdır: canlı harita `mapShownAirports`'u ilk paketinde
 * kullanır; bu modül ad tablolarını (airport-names.ts, foreign-airport-names.ts) içe aktarsaydı
 * paketleyici tabloları haritanın ilk paketine taşırdı ve D-101'in tembel yüklemesi bozulurdu
 * (D-103). Tek kaynak yine tablodur: `reference.test.ts` listenin tablonun `military` kaynaklı
 * kayıtlarıyla tam olarak aynı olduğunu denetler; `lazy-chunks.test.ts` bu modülün hiçbir şey içe
 * aktarmadığını denetler.
 */
export const MILITARY_AIRFIELD_ICAOS: readonly string[] = ['LTAG', 'LTAH', 'LTBG', 'LTBI', 'LTBL']

const MILITARY_AIRFIELDS: ReadonlySet<string> = /*#__PURE__*/ new Set(MILITARY_AIRFIELD_ICAOS)

/** Askerî hava üssü mü (`MILITARY_AIRFIELD_ICAOS`, D-107). ICAO kırpılıp büyük harfe çevrilir. */
export function isMilitaryAirfield(icao: string): boolean {
  return MILITARY_AIRFIELDS.has(icao.trim().toUpperCase())
}

/**
 * Haritada gösterilen havalimanları (D-103), sıra korunarak: askerî hava üsleri
 * (`isMilitaryAirfield`) çıkarılır. D-107'den beri API'nin listesinde üs yoktur; bu süzgeç
 * savunma amaçlı kalır (eski bir API sürümünün ya da önbellekteki eski listenin üssü haritaya
 * taşımaması için) ve bugünkü listede hiçbir şey çıkarmaz. Web haritası (pinler, kodlar, havalimanı
 * penceresi, "Havalimanları" listesi) ve ülke adlarının engelleri (tools `mapAirportPins`, D-099)
 * bunu kullanır: ikisi her zaman aynı havalimanlarını sayar.
 */
export function mapShownAirports<T extends { readonly icao: string }>(airports: readonly T[]): T[] {
  return airports.filter((airport) => !isMilitaryAirfield(airport.icao))
}
