/**
 * Sivil uçuşlara kapalı olabilecek havalimanları (kullanıcı kararı 2026-10-04, D-090).
 *
 * OurAirports'un tarifeli sefer bayrağı (`scheduled_service`) listenin tek kuralıdır (D-080). Bazı
 * havalimanları 2022'den beri sivil uçuşa kapalı olduğu hâlde OurAirports'ta tarifeli görünür ve
 * listelenir. Kullanıcı kararı: bu havalimanları listede kalır; sayfaları ve harita penceresi "Sivil
 * uçuşlara kapalı olabilir (2022’den beri)" / "May be closed to civil flights (since 2022)" notunu
 * gösterir (metin `@havayolu/i18n`'dedir; yıl `since`'ten okunur).
 *
 * Kaynak: Rosaviatsiya'nın 2022-02-24'te güney ve orta Rusya'daki 11 havalimanına getirdiği sivil
 * uçuş kısıtlaması (ilk duyuru 2022-02-24; kısıtlama sonraki duyurularla uzatıldı). Liste çevrim dışı
 * derlendi (2026-10-04); güncel durum canlı doğrulanamadı, bu yüzden not "kapalı olabilir" der.
 * Kısıtlamadaki 11. havalimanı Simferopol tabloda yoktur: Kırım'dadır, OurAirports'ta Ukrayna
 * kaydıdır ve tarifesizdir (bütün Ukrayna havalimanları gibi), listelenmez.
 *
 * 2026-10-01 OurAirports indirmesinde tarifeli görünen ve bu yüzden listelenenler: Krasnodar
 * (URKK, 1. halka), Gelencik (URKG, 1. halka), Elista (URWI, 2. halka), Voronej (UUOO, 3. halka).
 * Diğer altısı (Anapa, Belgorod, Bryansk, Kursk, Lipetsk, Rostov) aynı indirmede tarifesizdir ve
 * listelenmez; OurAirports bayrağını değiştirirse havalimanı not ile birlikte listeye girer.
 *
 * Kayıt kaldırma: havalimanının sivil uçuşa yeniden açıldığı bir resmî duyuruyla doğrulanınca kayıt
 * silinir ve D-090'a tarih ve kaynakla yazılır.
 */
export interface CivilFlightClosure {
  /** Sivil uçuşların durduğu gün (ISO 8601 tarih). */
  readonly since: string
}

const SINCE_2022_02_24: CivilFlightClosure = { since: '2022-02-24' }

/** Kanonik ICAO → kapanış bilgisi; ICAO'ya göre sıralı. */
export const CIVIL_FLIGHT_CLOSURES: Readonly<Record<string, CivilFlightClosure>> = {
  // Krasnodar Paşkovski (KRR)
  URKK: SINCE_2022_02_24,
  // Gelencik (GDZ)
  URKG: SINCE_2022_02_24,
  // Anapa Vityazevo (AAQ); 2026-10-01 indirmesinde tarifesiz
  URKA: SINCE_2022_02_24,
  // Rostov Platov (ROV); 2026-10-01 indirmesinde tarifesiz
  URRP: SINCE_2022_02_24,
  // Elista (ESL)
  URWI: SINCE_2022_02_24,
  // Bryansk (BZK); 2026-10-01 indirmesinde tarifesiz
  UUBP: SINCE_2022_02_24,
  // Belgorod (EGO); 2026-10-01 indirmesinde tarifesiz
  UUOB: SINCE_2022_02_24,
  // Kursk Vostochny (URS); 2026-10-01 indirmesinde tarifesiz
  UUOK: SINCE_2022_02_24,
  // Lipetsk (LPK); 2026-10-01 indirmesinde tarifesiz
  UUOL: SINCE_2022_02_24,
  // Voronej Chertovitskoye (VOZ)
  UUOO: SINCE_2022_02_24,
}

/**
 * Havalimanı sivil uçuşlara kapalı olabilir mi: tablodaki kayıt, yoksa undefined. ICAO kırpılıp
 * büyük harfe çevrilir. Sayfa, harita penceresi ve (isteğe bağlı) liste satırı notu bununla gösterir.
 */
export function civilFlightClosure(icao: string): CivilFlightClosure | undefined {
  const code = icao.trim().toUpperCase()
  return Object.hasOwn(CIVIL_FLIGHT_CLOSURES, code) ? CIVIL_FLIGHT_CLOSURES[code] : undefined
}
