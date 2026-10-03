import type { Locale, LocalizedText } from '../locale'
import { foreignAirportCity } from './foreign-airport-names'

/** Haritadaki kısa adın en çok karakter sayısı (kod kutusu tek satır kalsın). */
export const AIRPORT_MAP_NAME_MAX_LENGTH = 16

const short = (tr: string, en: string = tr): LocalizedText => ({ tr, en })

/**
 * Haritadaki havalimanı kod kutusunun kısa adı (Etiketler → Havalimanları → "Kod ve ad", D-084).
 * Görünen ad (`airportDisplayName`) haritaya sığmaz ("Hakkari Yüksekova Selahaddin Eyyubi
 * Havalimanı" 46 karakter); kısa ad en çok 16 karakterdir ve görünen addaki yer adıdır:
 * - İl adı; havalimanı bilinen ilçe ya da yer adıyla anılıyorsa o ad (Merzifon, Çorlu, Yüksekova,
 *   Dalaman, Bodrum, Gazipaşa, Kapadokya, Çukurova, Koca Seyit).
 * - Aynı ilde birden çok havalimanı varsa ayırt edici ad: İstanbul / Sabiha Gökçen / Atatürk,
 *   Esenboğa / Etimesgut (Ankara Havalimanı'nın adı Esenboğa ile karışır), İzmir / Çiğli Üssü,
 *   Eskişehir / Eskişehir Üssü.
 * - Askerî üsler "<yer> Üssü" / "<place> Base" ("Hava Üssü" / "Air Base" kısa ada sığmaz).
 * İngilizce kısa ad Türkçeyle aynıdır; İstanbul ve İzmir İngilizcede Istanbul, Izmir yazılır, üsler
 * "Base" alır (görünen adlardaki kural, D-076).
 */
export const AIRPORT_MAP_NAMES: Readonly<Record<string, LocalizedText>> = {
  LTAC: short('Esenboğa'),
  LTAD: short('Etimesgut'),
  LTAG: short('İncirlik Üssü', 'Incirlik Base'),
  LTAH: short('Afyon Üssü', 'Afyon Base'),
  LTAI: short('Antalya'),
  LTAJ: short('Gaziantep'),
  LTAL: short('Kastamonu'),
  LTAN: short('Konya'),
  LTAP: short('Merzifon'),
  LTAR: short('Sivas'),
  LTAS: short('Zonguldak'),
  LTAT: short('Malatya'),
  LTAU: short('Kayseri'),
  LTAW: short('Tokat'),
  LTAY: short('Denizli'),
  LTAZ: short('Kapadokya'),
  LTBA: short('Atatürk'),
  LTBF: short('Balıkesir'),
  LTBG: short('Bandırma Üssü', 'Bandırma Base'),
  LTBH: short('Çanakkale'),
  LTBI: short('Eskişehir Üssü', 'Eskişehir Base'),
  LTBJ: short('İzmir', 'Izmir'),
  LTBL: short('Çiğli Üssü', 'Çiğli Base'),
  LTBO: short('Uşak'),
  LTBQ: short('Kocaeli'),
  LTBR: short('Bursa'),
  LTBS: short('Dalaman'),
  LTBU: short('Çorlu'),
  LTBY: short('Eskişehir'),
  LTBZ: short('Zafer'),
  LTCA: short('Elazığ'),
  LTCB: short('Ordu Giresun'),
  LTCC: short('Diyarbakır'),
  LTCD: short('Erzincan'),
  LTCE: short('Erzurum'),
  LTCF: short('Kars'),
  LTCG: short('Trabzon'),
  LTCI: short('Van'),
  LTCJ: short('Batman'),
  LTCK: short('Muş'),
  LTCL: short('Siirt'),
  LTCM: short('Sinop'),
  LTCN: short('Kahramanmaraş'),
  LTCO: short('Ağrı'),
  LTCP: short('Adıyaman'),
  LTCR: short('Mardin'),
  LTCS: short('Şanlıurfa'),
  LTCT: short('Iğdır'),
  LTCU: short('Bingöl'),
  LTCV: short('Şırnak'),
  LTCW: short('Yüksekova'),
  LTDA: short('Hatay'),
  LTDB: short('Çukurova'),
  LTFC: short('Isparta'),
  LTFD: short('Koca Seyit'),
  LTFE: short('Bodrum'),
  LTFG: short('Gazipaşa'),
  LTFH: short('Samsun'),
  LTFJ: short('Sabiha Gökçen'),
  LTFM: short('İstanbul', 'Istanbul'),
  LTFO: short('Rize Artvin'),
}

/**
 * Türkiye dışında şehir tablosu (`FOREIGN_AIRPORT_CITIES`) kullanılır; aynı şehrin ikinci
 * havalimanı ayırt edici adıyla yazılır (Bükreş: Henri Coandă "Bükreş", Băneasa "Băneasa").
 */
const FOREIGN_MAP_NAME_OVERRIDES: Readonly<Record<string, LocalizedText>> = {
  LRBS: short('Băneasa'),
}

const own = (table: Readonly<Record<string, LocalizedText>>, code: string) =>
  Object.hasOwn(table, code) ? table[code] : undefined

/**
 * Havalimanının haritadaki kısa adı, sayfanın dilinde; yoksa null (kutuda yalnız kod yazılır).
 * Sırayla: Türkiye tablosu, yurt dışı ayırt edici ad, yurt dışı şehir tablosu. Sonraki halkalarda
 * tabloda olmayan havalimanının kısa adı yoktur.
 */
export function airportMapName(airport: { icao: string }, locale: Locale): string | null {
  const code = airport.icao.trim().toUpperCase()
  const name =
    own(AIRPORT_MAP_NAMES, code) ??
    own(FOREIGN_MAP_NAME_OVERRIDES, code) ??
    foreignAirportCity(code)
  return name === undefined ? null : name[locale]
}
