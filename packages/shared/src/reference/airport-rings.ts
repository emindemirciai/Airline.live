import { civilFlightClosure } from './civil-closures'

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
 * Açık olan en uzak halka: M6i.2'den (D-102) beri 4. halka, ≤ 5.000 km (M6d'de 1. halka, ≤ 500 km;
 * M6g'de 2. halka, ≤ 1.000 km; M6h'de 3. halka, ≤ 2.000 km). Üretim veritabanı bütün adayları zaten
 * tutar (içe aktarım süzgeci halkaya bakmaz); halkayı açmak için veri migration'ı gerekmez.
 */
export const ENABLED_AIRPORT_RING: number = 4

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
 * Kanonik ICAO kodu dört harf ya da rakamdır (sayfa yolu, API kodu ve hava durumu istasyonu aynı
 * biçimi ister; hava durumu şeması `IcaoSchema` ve veritabanı kısıtı `^[A-Z0-9]{4}$`).
 */
const CANONICAL_ICAO = /^[A-Z0-9]{4}$/

/**
 * Kanonik ICAO (`ourAirportsIcao`) dört karakterli mi (D-101). OurAirports'ta `icao_code` ve
 * `gps_code` taşımayan satırın kimliği ident'tir ("UG-0002", Kihihi'nin Savannah pisti, IATA KHX):
 * böyle bir havalimanının sayfası, hava durumu istasyonu ve METAR'ı olamaz. Kod kırpılıp büyük
 * harfe çevrilir.
 */
export function isCanonicalIcao(icao: string | null | undefined): boolean {
  return CANONICAL_ICAO.test(icao?.trim().toUpperCase() ?? '')
}

/**
 * D-080'in aday kuralı, ICAO koşulu olmadan: OurAirports `large_airport` ya da `medium_airport`,
 * tarifeli seferi var ve üç harfli IATA kodu taşıyor. IATA kodu kırpılıp büyük harfe çevrilir.
 * Halka analizi ve fixture üreticisinin halka blokları bu kuralı sayar (4. halkada 720 aday);
 * listeye giren aday ayrıca kanonik ICAO koşulunu taşır ve kapanış tablosundakiler de tarifeli
 * sayılır (`isForeignCandidate`; 4. halkada 720 = 719 + Bukavu, D-110).
 */
export function isScheduledIataAirport(
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

/**
 * Türkiye dışındaki bir havalimanı listeye aday mı (D-080, D-101, D-110): D-080 kuralı
 * (`isScheduledIataAirport`; tarifeli ya da kapanış tablosunda, `civilFlightClosure`: savaş
 * nedeniyle kapalı havalimanı OurAirports'ta tarifesiz görünse de tarifeli sayılır) ve kanonik
 * ICAO'su (`ourAirportsIcao`) dört karakter (`isCanonicalIcao`). Değişmez kural: `scope=listed`'deki
 * her havalimanının dört karakterli ICAO'su vardır. Halka sınırı ayrıca uygulanır (`airportRing`).
 * `@havayolu/db` aynı kuralı kendi yazımıyla uygular; `apps/api/src/reference/rings.test.ts` ikisini
 * denetler. Halka analizinin aday sayımları OurAirports bayrağıyla kalır (`isScheduledIataAirport`).
 */
export function isForeignCandidate(
  type: string,
  scheduled: boolean,
  iata: string | null | undefined,
  icao: string | null | undefined,
): boolean {
  const closed = civilFlightClosure(icao ?? '') !== undefined
  return isScheduledIataAirport(type, scheduled || closed, iata) && isCanonicalIcao(icao)
}
