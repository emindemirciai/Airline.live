/**
 * Savaş nedeniyle sivil uçuşlara kapalı havalimanları (D-110; ilk tablo D-090, 2026-10-04).
 *
 * Kullanıcı isteği (2026-10-08): normal şartlarda açık olup savaş nedeniyle kapalı olan
 * havalimanları da listelenir ve not düşülür. OurAirports bu havalimanlarının çoğunu tarifesiz
 * gösterir (`scheduled_service = no`); D-080'in aday kuralı onları dışarıda bırakırdı. Tablodaki
 * havalimanı aday kuralında tarifeli sayılır (`isForeignCandidate`; `@havayolu/db`
 * `isForeignCandidateRow`); D-080'in öbür koşulları (büyük ya da orta havalimanı, üç harfli IATA,
 * dört karakterli kanonik ICAO, açık halka) ve D-107 (askerî alan listelenmez) geçerli kalır.
 * Sayfa, harita penceresi ve havalimanı listesi notu gösterir: kesin kayıtta "Savaş nedeniyle sivil
 * uçuşlara kapalı (2022’den beri)", belirsiz kayıtta "… kapalı olabilir (…)" (metinler
 * `@havayolu/i18n`'dedir; yıl `since`'ten okunur).
 *
 * Ölçüt (D-110): (1) kapanıştan hemen önce düzenli sivil yolcu seferi (tarifeli ya da düzenli
 * charter) alan, sivil işletmeli bir havalimanıydı; (2) kapanışın nedeni savaş ya da silahlı
 * çatışmadır ve kapanış bugün sürüyor; (3) D-080'in öbür aday koşulları; (4) askerî değil (D-107;
 * ortak sivil-askerî alanlar D-103'teki gibi listelenir: Kursk, İvano-Frankivsk).
 *
 * Not türü (`certainty`): kesin (`confirmed`) için resmî bir kaynak (devlet, havacılık otoritesi,
 * bakanlık, NOTAM, EASA CZIB, BM misyonu) kapanışı söyler, kaynak ya da kapanışı doğrulayan güvenilir
 * haber en çok 12 aylıktır ve açılış tarihi ya da "son aşama" duyurusu yoktur. Öbür durumlar belirsiz
 * (`possible`): yalnız havayolu açıklaması, haber ya da dolaylı kanıt; açılışı yakın duyurulan;
 * denetimi son 30 günde el değiştiren.
 *
 * Kaynaklar 2026-10-08'de okundu (dalgalı kayıtlar 2026-10-15'te yeniden); her kaydın tam kaynağı
 * ve okunma tarihi D-110'da ve `docs/research/2026-10-08-savas-kapanislari/`'dedir. Satır yorumundaki
 * etiket kısa kaynaktır.
 *
 * Kayıt kaldırma: resmî bir açılış duyurusu (NOTAM, havacılık otoritesi, bakanlık ya da EASA CZIB
 * revizyonu) ya da tarifeli sivil seferin yeniden başladığına dair güvenilir haber kaydı siler;
 * silinen kayıt tarih ve kaynakla D-110'a yazılır. OurAirports'ta tarifesiz olan havalimanı kayıtla
 * birlikte listeden de çıkar (D-080). Kaldırılanlar: Elista URWI (2024-05-03), Gelencik URKG
 * (2025-07-10), Krasnodar URKK (2025-09-11). Bakım RUNBOOK'tadır ("Savaş kapanışları tablosu").
 *
 * Bu dosya hiçbir şey içe aktarmaz (`airport-rings.ts` onu içe aktarır; döngü yoktur).
 */

/** Not türü: `confirmed` → "kapalı", `possible` → "kapalı olabilir" (D-110 → "Not türü"). */
export type CivilFlightClosureCertainty = 'confirmed' | 'possible'

export interface CivilFlightClosure {
  /**
   * Sivil uçuşların durduğu gün (ISO 8601 YYYY-MM-DD; gün bilinmiyorsa YYYY-MM). Notta yalnız yıl
   * yazılır.
   */
  readonly since: string
  /** `confirmed` → "kapalı", `possible` → "kapalı olabilir" (D-110 → "Not türü"). */
  readonly certainty: CivilFlightClosureCertainty
}

/** Ukrayna hava sahası ve Rosaviatsiya'nın güney Rusya kısıtlaması: 2022-02-24'ten beri, kesin. */
const WAR_2022: CivilFlightClosure = { since: '2022-02-24', certainty: 'confirmed' }
/** Sudan savaşı (2023-04-15'ten beri); yalnız haber ve dolaylı kanıt. */
const SUDAN_2023: CivilFlightClosure = { since: '2023-04-15', certainty: 'possible' }
/** Mali: Sky Mali seferleri 2026-04-28'de askıya aldı; dönüş bulunamadı. */
const MALI_2026: CivilFlightClosure = { since: '2026-04-28', certainty: 'possible' }

/** Kanonik ICAO → kapanış bilgisi; ICAO'ya göre sıralı (35 kayıt: 27 kesin, 8 belirsiz). */
export const CIVIL_FLIGHT_CLOSURES: Readonly<Record<string, CivilFlightClosure>> = {
  // Bukavu Kavumu (BKY), Kongo DC; M23 havalimanını aldı. MONUSCO, BM Güvenlik Konseyi 2026-03-26
  FZMA: { since: '2025-02-14', certainty: 'confirmed' },
  // Goma (GOM), Kongo DC; AFC/M23. MONUSCO 2026-03-26; pist mayınlı (2026-04-23)
  FZNA: { since: '2025-01-27', certainty: 'confirmed' },
  // Gao (GAQ), Mali; Sky Mali askıya aldı (basın, 2026-04-28)
  GAGO: MALI_2026,
  // Mopti Sévaré (MZI), Mali; Sky Mali askıya aldı (basın, 2026-04-28); üsse saldırı 2026-09
  GAMB: MALI_2026,
  // Aksum (AXU), Etiyopya; Tigray çatışması. Seferler 2026-10-09'da askıda (africanews)
  HAAX: { since: '2026-09-23', certainty: 'possible' },
  // El Faşir (ELF), Sudan; RSF kenti 2025-10-26'da aldı (haber)
  HSFS: SUDAN_2023,
  // Nyala (UYL), Sudan; RSF kargo ve askerî kullanımı (Darfur24)
  HSNN: SUDAN_2023,
  // El-Obeid (EBD), Sudan; kuşatma, 2023'ten beri ticari sefer bulunamadı (dolaylı)
  HSOB: SUDAN_2023,
  // Kamışlı (KAC), Suriye; GACA 2026-02-21'de devraldı, onarım "son aşamada" (SANA 2026-09-08)
  OSKL: { since: '2024-12-08', certainty: 'possible' },
  // Lazkiye (LTK), Suriye; onarımda, tarih yok (SANA 2026-08-09)
  OSLK: { since: '2024-12-08', certainty: 'confirmed' },
  // Sana (SAH), Yemen; Yemenia'nın son uçağı vuruldu, resmî kapanış ilanı yok
  OYSN: { since: '2025-05-28', certainty: 'possible' },
  // Taiz (TAI), Yemen; cephe hattı. CAMA; il seferleri 2026-02-01'den beri Muha'dan (Saba)
  OYTZ: { since: '2015-10', certainty: 'confirmed' },
  // Kiev Borispil (KBP), Ukrayna; EASA CZIB-2022-01R14, NOTAM UKBV A0081/26
  UKBB: WAR_2022,
  // Dnipro (DNK), Ukrayna; EASA CZIB, NOTAM
  UKDD: WAR_2022,
  // Zaporijya (OZH), Ukrayna; EASA CZIB, NOTAM
  UKDE: WAR_2022,
  // Kriviy Rih (KWG), Ukrayna; EASA CZIB, NOTAM
  UKDR: WAR_2022,
  // Simferopol (SIP), Kırım; Ukrayna NOTAM'ı (UKFV FIR) ve Rosaviatsiya kısıtlaması
  UKFF: WAR_2022,
  // Harkiv (HRK), Ukrayna; EASA CZIB, NOTAM
  UKHH: WAR_2022,
  // Kiev Igor Sikorsky (IEV, Zhuliany), Ukrayna; EASA CZIB, NOTAM
  UKKK: WAR_2022,
  // İvano-Frankivsk (IFO), Ukrayna; ortak alan, sivil uçuşa kapalı. EASA CZIB, NOTAM
  UKLI: WAR_2022,
  // Lviv (LWO), Ukrayna; EASA CZIB, NOTAM
  UKLL: WAR_2022,
  // Çernivtsi (CWC), Ukrayna; EASA CZIB, NOTAM
  UKLN: WAR_2022,
  // Rivne (RWN), Ukrayna; EASA CZIB, NOTAM
  UKLR: WAR_2022,
  // Ujhorod (UDJ), Ukrayna; EASA CZIB, NOTAM
  UKLU: WAR_2022,
  // Herson (KHE), Ukrayna; EASA CZIB, NOTAM
  UKOH: WAR_2022,
  // Mikolayiv (NLV), Ukrayna; EASA CZIB, NOTAM
  UKON: WAR_2022,
  // Odessa (ODS), Ukrayna; EASA CZIB, NOTAM
  UKOO: WAR_2022,
  // Vinnitsya (VIN), Ukrayna; EASA CZIB, NOTAM
  UKWW: WAR_2022,
  // Anapa Vityazevo (AAQ), Rusya; Rosaviatsiya listesi (AEX, 2026-05-28)
  URKA: WAR_2022,
  // Rostov-na-Donu Platov (ROV), Rusya; Rosaviatsiya listesi (2026-05-28), açılış yalanlandı
  URRP: WAR_2022,
  // Bryansk (BZK), Rusya; Rosaviatsiya listesi (2026-05-28)
  UUBP: WAR_2022,
  // Belgorod (EGO), Rusya; Rosaviatsiya listesi (2026-05-28)
  UUOB: WAR_2022,
  // Kursk (URS), Rusya; ortak sivil-askerî alan. Rosaviatsiya listesi (2026-05-28)
  UUOK: WAR_2022,
  // Lipetsk (LPK), Rusya; Rosaviatsiya listesi (2026-05-28)
  UUOL: WAR_2022,
  // Voronej (VOZ), Rusya; Rosaviatsiya listesi (2026-05-28), "kapalı kalıyor" (2026-03-18)
  UUOO: WAR_2022,
}

/**
 * Havalimanının kapanış kaydı: tablodaki kayıt, yoksa undefined. ICAO kırpılıp büyük harfe
 * çevrilir. Aday kuralı, sayfa, harita penceresi ve havalimanı listesinin notu bununla bakar.
 */
export function civilFlightClosure(icao: string): CivilFlightClosure | undefined {
  const code = icao.trim().toUpperCase()
  return Object.hasOwn(CIVIL_FLIGHT_CLOSURES, code) ? CIVIL_FLIGHT_CLOSURES[code] : undefined
}
