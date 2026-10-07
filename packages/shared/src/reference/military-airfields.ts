/**
 * Askerî hava alanları, ICAO sırasıyla. Sitenin hiçbir yerinde yoktur (D-107, D-109):
 * - Türkiye'nin beş askerî hava üssü (D-084; İncirlik, Afyon, Bandırma, Eskişehir, Çiğli).
 * - Yurt dışında adı yalnız askerî olan ve tarifeli sivil seferi güvenilir olmayan üç alan (5.
 *   halka, D-109): Bucholz Ordu Hava Alanı (PKWA, Kwajalein), Wake Adası (PWAK) ve Oakey Ordu
 *   Havacılık Merkezi (YBOK). OurAirports üçünü tarifeli orta havalimanı diye kaydeder; D-080 kuralı
 *   onları 5. halkaya aday yapardı. Halka 4'te kaldıkça hiçbir sayfada görünmezler; liste halka
 *   açılmadan önce yazılır. Yurt dışındaki ortak sivil-askerî havalimanları (tarifeli sivil seferi
 *   olan; D-103: Ascension FHAW, MidAmerica KBLV) sivildir, burada yoktur.
 *
 * Sunucu onları listelemez ve Türkiye'deki uzaklık referansı saymaz (`@havayolu/db`
 * `MILITARY_AIRFIELD_ICAOS`, aynı liste; db shared'a bağımlı olmadığı için kendi kopyasını taşır,
 * `apps/api/src/reference/rings.test.ts` ikisini karşılaştırır). Böylece `scope=listed`, ülke
 * listeleri, tek havalimanı ve hava durumu uçları, havalimanı listesi ve sayfaları, site haritası,
 * llms.txt, canlı harita, arama, uçak listesinin konum ve durum satırı ve worker'ın hava durumu
 * istasyonları onları görmez.
 *
 * Liste ad tablosundan türetilmez, burada yazılıdır: canlı harita `mapShownAirports`'u ilk paketinde
 * kullanır; bu modül ad tablolarını (airport-names.ts, foreign-airport-names.ts) içe aktarsaydı
 * paketleyici tabloları haritanın ilk paketine taşırdı ve D-101'in tembel yüklemesi bozulurdu
 * (D-103). Liste fixture'la denetlenir: `reference.test.ts` fixture'daki IATA kodlu Türkiye
 * satırlarından ad tablosunda olmayanların tam olarak Türkiye'nin beş üssü olduğunu, yurt dışı
 * üçünün fixture'da 5. halka adayı olduğunu denetler (üslerin adları D-107'den beri tabloda yoktur,
 * istemci paketlerine girmez); `lazy-chunks.test.ts` bu modülün hiçbir şey içe aktarmadığını
 * denetler.
 */
export const MILITARY_AIRFIELD_ICAOS: readonly string[] = [
  'LTAG',
  'LTAH',
  'LTBG',
  'LTBI',
  'LTBL',
  'PKWA',
  'PWAK',
  'YBOK',
]

const MILITARY_AIRFIELDS: ReadonlySet<string> = /*#__PURE__*/ new Set(MILITARY_AIRFIELD_ICAOS)

/** Askerî hava alanı mı (`MILITARY_AIRFIELD_ICAOS`, D-107, D-109). ICAO kırpılıp büyük harfe çevrilir. */
export function isMilitaryAirfield(icao: string): boolean {
  return MILITARY_AIRFIELDS.has(icao.trim().toUpperCase())
}

/**
 * Haritada gösterilen havalimanları (D-103), sıra korunarak: askerî hava alanları
 * (`isMilitaryAirfield`) çıkarılır. D-107'den beri API'nin listesinde üs yoktur; bu süzgeç
 * savunma amaçlı kalır (eski bir API sürümünün ya da önbellekteki eski listenin üssü haritaya
 * taşımaması için) ve bugünkü listede hiçbir şey çıkarmaz. Web haritası (pinler, kodlar, havalimanı
 * penceresi, "Havalimanları" listesi) ve ülke adlarının engelleri (tools `mapAirportPins`, D-099)
 * bunu kullanır: ikisi her zaman aynı havalimanlarını sayar.
 */
export function mapShownAirports<T extends { readonly icao: string }>(airports: readonly T[]): T[] {
  return airports.filter((airport) => !isMilitaryAirfield(airport.icao))
}
