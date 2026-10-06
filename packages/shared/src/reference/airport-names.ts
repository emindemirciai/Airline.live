import type { Airport } from '../live'
import type { Locale, LocalizedText } from '../locale'
import {
  foreignAirportCity,
  foreignAirportName,
  translatedAirportName,
} from './foreign-airport-names'
import { airportDistrict } from './tr-provinces'

/**
 * Havalimanlarının resmî Türkçe adları ve İngilizce görünen adları (kullanıcı kararı 2026-09-29,
 * kaynak düzeltmesi 2026-09-30; D-076). Kaynak (`source`) yalnızca **Türkçe** adın kaynağıdır.
 * Kaynaklar, erişim 2026-09-30:
 * - `dhmi`: DHMİ "Havalimanları Web Siteleri" listesi,
 *   https://www.dhmi.gov.tr/Sayfalar/HavalimaniListesi.aspx.
 * - `operator`: havalimanını işleten kuruluşun sitesi: İGA https://www.istairport.com/ (LTFM),
 *   ISG https://www.sabihagokcen.aero/anasayfa (LTFJ), http://www.gzpairport.com/tr-TR/ (LTFG),
 *   http://www.zafer.aero/ (LTBZ), Eskişehir Teknik Üniversitesi https://hph.eskisehir.edu.tr/
 *   (LTBY).
 * - `ministry` (D-084): Ulaştırma ve Altyapı Bakanlığı, erişim 2026-10-03. Etimesgut (LTAD)
 *   2026-06-15'te "Ankara Havalimanı" adıyla yeniden açıldı (ANK); DHMİ listesinde henüz yok.
 *   https://www.uab.gov.tr/haberler/cumhurbaskani-erdogan-ankara-havalimani-ve-baglanti-yollarini-hizmete-acti/
 *   Görünen ad, Esenboğa ile karışmasın diye eski adı parantez içinde taşır (kullanıcı kararı
 *   2026-10-03): "Ankara (Etimesgut) Havalimanı"; resmî ad `official` alanındadır.
 * - `military` (D-084): Hava Kuvvetleri üsleri (İncirlik, Afyon, Bandırma, Eskişehir, Çiğli).
 *   Resmî adları birlik adıdır ("10'uncu Ana Jet Üs Komutanlığı"), havalimanı adı değildir; AA'nın
 *   ve kullanıcının bildiği biçimle "<yer> Hava Üssü" / "<place> Air Base" yazılır. İngilizcede
 *   İncirlik ABD Hava Kuvvetleri ve NATO yazımıyla "Incirlik"tir (İstanbul → Istanbul gibi).
 * - `ourairports`: tabloda olmayan (OurAirports'a sonradan eklenen) havalimanı; OurAirports adı
 *   kuralla Türkçeleştirilir (`translatedAirportName`). Tabloda bu kaynakla kayıt yoktur.
 *
 * Kaynaklar adları büyük harfle yazar; Türkçe büyük/küçük harf kuralıyla çevrilmiştir (İSTANBUL →
 * İstanbul, IĞDIR → Iğdır, AHMED-İ → Ahmed-i). Kısaltmalar (GAP, Prof. Dr.) korunur; kısa çizginin
 * iki yanındaki boşluk Türkçe yazıma göre kaldırılmıştır (MİLAS - BODRUM → Milas-Bodrum; işletmeci
 * de "Gazipaşa-Alanya" yazar).
 *
 * İngilizce ad bir kaynaktan alınmaz; resmî Türkçe adın bizim çevirimizdir: "Havalimanı" →
 * "Airport", "Uluslararası" → "International"; İstanbul ve İzmir İngilizcedeki yerleşik
 * biçimleriyle (Istanbul, Izmir) yazılır, diğer Türkçe harfler korunur. DHMİ'nin İngilizce
 * sitesindeki liste (https://www.dhmi.gov.tr/Sayfalar/EN/DefaultEN.aspx, erişim 2026-10-01)
 * tutarsızdır ("DALAMAN AIRPORT", "MUS AIRPORT", "CUKUROVA AİRPORT") ve kullanılmadı. İngilizce
 * sayfalar bu yüzden resmî Türkçe adı ve kaynağını ayrıca yazar (i18n `airport.nameSource`).
 */
export type AirportNameSource = 'dhmi' | 'operator' | 'ministry' | 'military' | 'ourairports'

export interface AirportNameEntry {
  source: Exclude<AirportNameSource, 'ourairports'>
  tr: string
  en: string
  /** Resmî Türkçe ad görünen Türkçe addan farklıysa (LTAD: "Ankara Havalimanı"). */
  official?: string
}

const dhmi = (tr: string, en: string): AirportNameEntry => ({ source: 'dhmi', tr, en })
const operator = (tr: string, en: string): AirportNameEntry => ({ source: 'operator', tr, en })
const ministry = (tr: string, en: string, official: string): AirportNameEntry => ({
  source: 'ministry',
  tr,
  en,
  official,
})
const military = (tr: string, en: string): AirportNameEntry => ({ source: 'military', tr, en })

/**
 * Veritabanındaki IATA kodlu 61 Türkiye havalimanı, ICAO koduna göre sıralı. OurAirports yeni bir
 * havalimanı eklerse tabloda olmayan kod OurAirports adından kuralla Türkçeleştirilir
 * (`airportDisplayName`). Yurt dışı havalimanları `foreign-airport-names.ts`'tedir.
 */
export const AIRPORT_NAMES: Readonly<Record<string, AirportNameEntry>> = {
  LTAC: dhmi('Ankara Esenboğa Havalimanı', 'Ankara Esenboğa Airport'),
  LTAD: ministry(
    'Ankara (Etimesgut) Havalimanı',
    'Ankara (Etimesgut) Airport',
    'Ankara Havalimanı',
  ),
  LTAG: military('İncirlik Hava Üssü', 'Incirlik Air Base'),
  LTAH: military('Afyon Hava Üssü', 'Afyon Air Base'),
  LTAI: dhmi('Antalya Havalimanı', 'Antalya Airport'),
  LTAJ: dhmi('Gaziantep Havalimanı', 'Gaziantep Airport'),
  LTAL: dhmi('Kastamonu Havalimanı', 'Kastamonu Airport'),
  LTAN: dhmi('Konya Havalimanı', 'Konya Airport'),
  LTAP: dhmi('Amasya Merzifon Havalimanı', 'Amasya Merzifon Airport'),
  LTAR: dhmi('Sivas Nuri Demirağ Havalimanı', 'Sivas Nuri Demirağ Airport'),
  LTAS: dhmi('Zonguldak Çaycuma Havalimanı', 'Zonguldak Çaycuma Airport'),
  LTAT: dhmi('Malatya Havalimanı', 'Malatya Airport'),
  LTAU: dhmi('Kayseri Havalimanı', 'Kayseri Airport'),
  LTAW: dhmi('Tokat Havalimanı', 'Tokat Airport'),
  LTAY: dhmi('Denizli Çardak Havalimanı', 'Denizli Çardak Airport'),
  LTAZ: dhmi('Kapadokya Havalimanı', 'Kapadokya Airport'),
  LTBA: dhmi('İstanbul Atatürk Havalimanı', 'Istanbul Atatürk Airport'),
  LTBF: dhmi('Balıkesir Merkez Havalimanı', 'Balıkesir Merkez Airport'),
  LTBG: military('Bandırma Hava Üssü', 'Bandırma Air Base'),
  LTBH: dhmi('Çanakkale Havalimanı', 'Çanakkale Airport'),
  LTBI: military('Eskişehir Hava Üssü', 'Eskişehir Air Base'),
  LTBJ: dhmi('İzmir Adnan Menderes Havalimanı', 'Izmir Adnan Menderes Airport'),
  LTBL: military('Çiğli Hava Üssü', 'Çiğli Air Base'),
  LTBO: dhmi('Uşak Havalimanı', 'Uşak Airport'),
  LTBQ: dhmi('Kocaeli Cengiz Topel Havalimanı', 'Kocaeli Cengiz Topel Airport'),
  LTBR: dhmi('Bursa Yenişehir Havalimanı', 'Bursa Yenişehir Airport'),
  LTBS: dhmi('Muğla Dalaman Havalimanı', 'Muğla Dalaman Airport'),
  LTBU: dhmi('Tekirdağ Çorlu Atatürk Havalimanı', 'Tekirdağ Çorlu Atatürk Airport'),
  LTBY: operator('Eskişehir Hasan Polatkan Havalimanı', 'Eskişehir Hasan Polatkan Airport'),
  LTBZ: operator('Zafer Havalimanı', 'Zafer Airport'),
  LTCA: dhmi('Elazığ Havalimanı', 'Elazığ Airport'),
  LTCB: dhmi('Ordu Giresun Havalimanı', 'Ordu Giresun Airport'),
  LTCC: dhmi('Diyarbakır Havalimanı', 'Diyarbakır Airport'),
  LTCD: dhmi('Erzincan Yıldırım Akbulut Havalimanı', 'Erzincan Yıldırım Akbulut Airport'),
  LTCE: dhmi('Erzurum Havalimanı', 'Erzurum Airport'),
  LTCF: dhmi('Kars Harakani Havalimanı', 'Kars Harakani Airport'),
  LTCG: dhmi('Trabzon Havalimanı', 'Trabzon Airport'),
  LTCI: dhmi('Van Ferit Melen Havalimanı', 'Van Ferit Melen Airport'),
  LTCJ: dhmi('Batman Havalimanı', 'Batman Airport'),
  LTCK: dhmi('Muş Sultan Alparslan Havalimanı', 'Muş Sultan Alparslan Airport'),
  LTCL: dhmi('Siirt Havalimanı', 'Siirt Airport'),
  LTCM: dhmi('Sinop Havalimanı', 'Sinop Airport'),
  LTCN: dhmi('Kahramanmaraş Havalimanı', 'Kahramanmaraş Airport'),
  LTCO: dhmi('Ağrı Ahmed-i Hani Havalimanı', 'Ağrı Ahmed-i Hani Airport'),
  LTCP: dhmi('Adıyaman Havalimanı', 'Adıyaman Airport'),
  LTCR: dhmi('Mardin Prof. Dr. Aziz Sancar Havalimanı', 'Mardin Prof. Dr. Aziz Sancar Airport'),
  LTCS: dhmi('Şanlıurfa GAP Havalimanı', 'Şanlıurfa GAP Airport'),
  LTCT: dhmi('Iğdır Şehit Bülent Aydın Havalimanı', 'Iğdır Şehit Bülent Aydın Airport'),
  LTCU: dhmi('Bingöl Havalimanı', 'Bingöl Airport'),
  LTCV: dhmi('Şırnak Şerafettin Elçi Havalimanı', 'Şırnak Şerafettin Elçi Airport'),
  LTCW: dhmi(
    'Hakkari Yüksekova Selahaddin Eyyubi Havalimanı',
    'Hakkari Yüksekova Selahaddin Eyyubi Airport',
  ),
  LTDA: dhmi('Hatay Havalimanı', 'Hatay Airport'),
  LTDB: dhmi('Çukurova Uluslararası Havalimanı', 'Çukurova International Airport'),
  LTFC: dhmi('Isparta Süleyman Demirel Havalimanı', 'Isparta Süleyman Demirel Airport'),
  LTFD: dhmi('Balıkesir Koca Seyit Havalimanı', 'Balıkesir Koca Seyit Airport'),
  LTFE: dhmi('Muğla Milas-Bodrum Havalimanı', 'Muğla Milas-Bodrum Airport'),
  LTFG: operator('Gazipaşa-Alanya Havalimanı', 'Gazipaşa-Alanya Airport'),
  LTFH: dhmi('Samsun Çarşamba Havalimanı', 'Samsun Çarşamba Airport'),
  LTFJ: operator(
    'İstanbul Sabiha Gökçen Uluslararası Havalimanı',
    'Istanbul Sabiha Gökçen International Airport',
  ),
  LTFM: operator('İstanbul Havalimanı', 'Istanbul Airport'),
  LTFO: dhmi('Rize Artvin Havalimanı', 'Rize Artvin Airport'),
}

/**
 * Türkiye'nin yalnızca uzaklık referansı olan, IATA kodlu ve tarifesiz 5 küçük alanı (D-080):
 * listelenmezler, sayfaları yoktur; yabancı havalimanı sayfasındaki "Türkiye’deki en yakın
 * havalimanı" satırında adlarıyla yazılırlar ("Bodrum-İmsık Havalimanı (küçük alan, listede yok)").
 * Kaynaklar (erişim 2026-09-30): Gökçeada DHMİ listesinde "Çanakkale Gökçeada Havalimanı" adıyla
 * yer alır. Diğer dördünün adı OurAirports adının Türkçe yazımıdır ("Airport" → "Havalimanı"): köyün
 * adı İmsık'tır (OurAirports noktasız "Imsık" yazar), Selçuk-Efes kısa çizgiyle yazılır; Adana
 * Şakirpaşa DHMİ listesinde yalnızca "Adana Havalimanı"dır, Şakirpaşa adı onu Çukurova'dan ayırır.
 * İngilizce ad aynı adın çevirisidir ("Havalimanı" → "Airport"; Türkçe harfler korunur).
 */
export const REFERENCE_AIRFIELD_NAMES: Readonly<Record<string, LocalizedText>> = {
  LTAF: { tr: 'Adana Şakirpaşa Havalimanı', en: 'Adana Şakirpaşa Airport' },
  LTBD: { tr: 'Aydın Çıldır Havalimanı', en: 'Aydın Çıldır Airport' },
  LTBV: { tr: 'Bodrum-İmsık Havalimanı', en: 'Bodrum-İmsık Airport' },
  LTFB: { tr: 'Selçuk-Efes Havalimanı', en: 'Selçuk-Efes Airport' },
  LTFK: { tr: 'Çanakkale Gökçeada Havalimanı', en: 'Çanakkale Gökçeada Airport' },
}

/** Tablodaki kayıt; kod tabloda yoksa undefined. ICAO kırpılıp büyük harfe çevrilir. */
export function airportName(icao: string): AirportNameEntry | undefined {
  const code = icao.trim().toUpperCase()
  return Object.hasOwn(AIRPORT_NAMES, code) ? AIRPORT_NAMES[code] : undefined
}

/**
 * Askerî hava üsleri: tablodaki `military` kaynaklı kayıtlar (D-084; İncirlik, Afyon, Bandırma,
 * Eskişehir, Çiğli), ICAO sırasıyla. Haritada pinleri, kodları, pencereleri ve "Havalimanları"
 * listesinde satırları yoktur; ülke adlarının engeli de sayılmazlar (D-103). Sayfaları, API ve uçak
 * listesinin konum ve durum satırı onları yine kullanır (site haritasında ve llms.txt'de zaten
 * yoklar: `noindex`, D-084). Yurt dışındaki ortak sivil-askerî havalimanları (tarifeli sivil seferi
 * olan) sivildir, burada yoktur.
 */
export const MILITARY_AIRFIELD_ICAOS: readonly string[] = Object.entries(AIRPORT_NAMES)
  .filter(([, entry]) => entry.source === 'military')
  .map(([icao]) => icao)
  .sort()

/** Askerî hava üssü mü (`MILITARY_AIRFIELD_ICAOS`, D-103). ICAO kırpılıp büyük harfe çevrilir. */
export function isMilitaryAirfield(icao: string): boolean {
  return airportName(icao)?.source === 'military'
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

/**
 * Türkçe adın kaynağı; tabloda olmayan havalimanında `ourairports` (İngilizce ad OurAirports
 * adıdır). Yurt dışı havalimanlarının Türkçe adı resmî ad değil, derlemedir: `foreignAirportName`
 * kaydı olsa da kaynak `ourairports` kalır.
 */
export function airportNameSource(icao: string): AirportNameSource {
  return airportName(icao)?.source ?? 'ourairports'
}

/**
 * Sivil havalimanının resmî Türkçe adı (DHMİ, işletmeci ya da bakanlık kaynaklı); askerî üste ve
 * tabloda olmayan havalimanında undefined. Sayfanın ad kaynağı satırı bunu yazar.
 */
export function airportOfficialName(icao: string): string | undefined {
  const entry = airportName(icao)
  if (entry === undefined || entry.source === 'military') return undefined
  return entry.official ?? entry.tr
}

/**
 * Havalimanının görünen adı, sırayla:
 * 1. Türkiye tablosu (`AIRPORT_NAMES`): Türkçe ad (TR) ya da İngilizce karşılığı (EN); askerî
 *    üslerde "<yer> Hava Üssü" / "<place> Air Base" (D-084).
 * 2. Uzaklık referansı küçük alanlar (`REFERENCE_AIRFIELD_NAMES`, D-080).
 * 3. Yurt dışı tablosu (`FOREIGN_AIRPORT_NAMES`, D-080): Türkçe yer adlı derleme ya da İngilizce ad.
 * 4. Tablolarda yoksa (OurAirports'a sonradan eklenen ya da sonraki halkalardaki havalimanı)
 *    OurAirports adı; Türkçede `translatedAirportName` kuralıyla ("Airport" → "Havalimanı").
 */
export function airportDisplayName(
  airport: Pick<Airport, 'icao' | 'name'>,
  locale: Locale,
): string {
  const entry = airportName(airport.icao)
  if (entry !== undefined) return entry[locale]
  const reference = referenceAirfieldName(airport.icao)
  if (reference !== undefined) return reference[locale]
  const foreign = foreignAirportName(airport.icao)
  if (foreign !== undefined) return foreign[locale]
  return translatedAirportName(airport.name, locale)
}

/** Uzaklık referansı tablosundaki kayıt; kod tabloda yoksa undefined. */
export function referenceAirfieldName(icao: string): LocalizedText | undefined {
  const code = icao.trim().toUpperCase()
  return Object.hasOwn(REFERENCE_AIRFIELD_NAMES, code) ? REFERENCE_AIRFIELD_NAMES[code] : undefined
}

/**
 * Havalimanının hizmet verdiği yerleşim, sayfanın dilinde; yoksa null. Başlığın altındaki yer satırı,
 * "Hizmet verdiği yerleşim" satırı, paylaşım görseli ve JSON-LD `addressLocality` bunu yazar.
 * - Türkiye'de temiz biçimdeki ve ilden farklı OurAirports yerleşimi (`airportDistrict`).
 * - Yakın ülkelerde küratörlü şehir adı (`FOREIGN_AIRPORT_CITIES`, D-080): "Selanik" / "Thessaloniki".
 * - Tabloda olmayan yabancı havalimanında (sonraki halkalar) İngilizce sayfada temiz biçimdeki
 *   OurAirports yerleşimi; Türkçe sayfada null: o değer İngilizce ya da yereldir ve Türkçe adın altına
 *   yazılmaz (yer satırında yalnızca ülke kalır).
 */
export function airportLocality(
  airport: {
    icao: string
    country: string
    isoRegion: string
    municipality: string | null
  },
  locale: Locale,
): string | null {
  if (airport.country === 'TR') return airportDistrict(airport)
  const curated = foreignAirportCity(airport.icao)
  if (curated !== undefined) return curated[locale]
  return locale === 'en' ? airportDistrict(airport) : null
}
