/**
 * Türkiye dışındaki havalimanları halka halka, yakından uzağa açılır (kullanıcı kararı 2026-10-01,
 * D-080). Uzaklık, havalimanından Türkiye'deki **en yakın IATA kodlu havalimanına** büyük daire
 * mesafesidir (km). Halkalar: 1 ≤ 500 km, 2 ≤ 1.000 km, 3 ≤ 2.000 km, 4 ≤ 5.000 km, 5 = dünyanın
 * geri kalanı (ABD dahil). Türkiye havalimanları halka 0'dır.
 *
 * Listelenen havalimanları (`GET /v1/airports?scope=listed`): Türkiye'nin IATA kodlu havalimanları
 * ve halkası `ENABLED_AIRPORT_RING`'i aşmayan yurt dışı adayları. Sonraki halkayı açmak için
 * yalnızca `ENABLED_AIRPORT_RING` değişir; API, worker (hava durumu istasyonları) ve web aynı
 * sabiti okur. Halka üyeliğini sunucu hesaplar (`@havayolu/db` → `listListedAirports`).
 */

/** Halkaların üst sınırları, km, artan; son sınırın ötesi son halkadır (5). */
export const AIRPORT_RINGS_KM = [500, 1000, 2000, 5000] as const

/** Halka sayısı: sınırlar + "dünyanın geri kalanı". */
export const AIRPORT_RING_COUNT = AIRPORT_RINGS_KM.length + 1

/**
 * Açık olan en uzak halka: M6g'den (v0.17.0, D-088) beri 2. halka, ≤ 1.000 km (M6d'de 1. halka,
 * ≤ 500 km). Üretim veritabanı bütün adayları zaten tutar (içe aktarım süzgeci halkaya bakmaz);
 * halkayı açmak için veri migration'ı gerekmez.
 */
export const ENABLED_AIRPORT_RING: number = 2

/** Türkiye'nin ISO 3166-1 alpha-2 kodu (OurAirports `iso_country`); Türkiye havalimanları halka 0. */
export const TURKEY_COUNTRY = 'TR'

/** Sunucu okuyucularına (`@havayolu/db`) verilen halka ayarı; değerler yukarıdaki sabitlerdir. */
export const AIRPORT_RING_CONFIG: {
  readonly ringsKm: readonly number[]
  readonly enabledRing: number
} = { ringsKm: AIRPORT_RINGS_KM, enabledRing: ENABLED_AIRPORT_RING }

/**
 * Türkiye'deki en yakın IATA kodlu havalimanına uzaklıktan (km) halka: 1 … `AIRPORT_RING_COUNT`.
 * Sınır dahildir (tam 500 km → 1. halka). Sonsuz uzaklık (Türkiye havalimanı yok) son halkadır.
 * Negatif ya da sayı olmayan uzaklık `RangeError` fırlatır.
 */
export function airportRing(distanceKm: number): number {
  if (Number.isNaN(distanceKm) || distanceKm < 0) {
    throw new RangeError(`distance must be a non-negative number: ${distanceKm}`)
  }
  const index = AIRPORT_RINGS_KM.findIndex((limit) => distanceKm <= limit)
  return index === -1 ? AIRPORT_RING_COUNT : index + 1
}

/** Halkanın üst sınırı, km; son halka (sınırsız) ve geçersiz halka için null. */
export function airportRingLimitKm(ring: number): number | null {
  return Number.isInteger(ring) && ring >= 1 ? (AIRPORT_RINGS_KM[ring - 1] ?? null) : null
}

/** Halka açık mı: Türkiye (0) her zaman, yurt dışı `ENABLED_AIRPORT_RING`'e kadar. */
export function isEnabledAirportRing(ring: number): boolean {
  return Number.isInteger(ring) && ring >= 0 && ring <= ENABLED_AIRPORT_RING
}

/** IATA havalimanı kodu üç harftir. */
const IATA_CODE = /^[A-Z]{3}$/

/**
 * Türkiye dışındaki bir havalimanı listeye aday mı (D-080, halka analiziyle aynı kural):
 * OurAirports `large_airport` ya da `medium_airport`, tarifeli seferi var ve üç harfli IATA kodu
 * taşıyor. IATA kodu kırpılıp büyük harfe çevrilir. Halka sınırı ayrıca uygulanır (`airportRing`).
 */
export function isForeignCandidate(
  type: string,
  scheduled: boolean,
  iata: string | null | undefined,
): boolean {
  return (
    (type === 'large_airport' || type === 'medium_airport') &&
    scheduled &&
    IATA_CODE.test(iata?.trim().toUpperCase() ?? '')
  )
}
