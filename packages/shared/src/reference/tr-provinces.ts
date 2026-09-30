import type { Locale, LocalizedText } from '../locale'

/**
 * Türkiye'nin 81 ili, ISO 3166-2:TR kodlarıyla (TR-01 … TR-81; OurAirports `iso_region` alanı).
 * Kodlar plaka numarasıyla aynıdır. İngilizce yazım Türkçe adla aynıdır; yalnızca İngilizcede
 * yerleşik biçimi noktasız olan İstanbul (Istanbul) ve İzmir (Izmir) ayrılır.
 */
export const TR_PROVINCES: Readonly<Record<string, LocalizedText>> = {
  'TR-01': { tr: 'Adana', en: 'Adana' },
  'TR-02': { tr: 'Adıyaman', en: 'Adıyaman' },
  'TR-03': { tr: 'Afyonkarahisar', en: 'Afyonkarahisar' },
  'TR-04': { tr: 'Ağrı', en: 'Ağrı' },
  'TR-05': { tr: 'Amasya', en: 'Amasya' },
  'TR-06': { tr: 'Ankara', en: 'Ankara' },
  'TR-07': { tr: 'Antalya', en: 'Antalya' },
  'TR-08': { tr: 'Artvin', en: 'Artvin' },
  'TR-09': { tr: 'Aydın', en: 'Aydın' },
  'TR-10': { tr: 'Balıkesir', en: 'Balıkesir' },
  'TR-11': { tr: 'Bilecik', en: 'Bilecik' },
  'TR-12': { tr: 'Bingöl', en: 'Bingöl' },
  'TR-13': { tr: 'Bitlis', en: 'Bitlis' },
  'TR-14': { tr: 'Bolu', en: 'Bolu' },
  'TR-15': { tr: 'Burdur', en: 'Burdur' },
  'TR-16': { tr: 'Bursa', en: 'Bursa' },
  'TR-17': { tr: 'Çanakkale', en: 'Çanakkale' },
  'TR-18': { tr: 'Çankırı', en: 'Çankırı' },
  'TR-19': { tr: 'Çorum', en: 'Çorum' },
  'TR-20': { tr: 'Denizli', en: 'Denizli' },
  'TR-21': { tr: 'Diyarbakır', en: 'Diyarbakır' },
  'TR-22': { tr: 'Edirne', en: 'Edirne' },
  'TR-23': { tr: 'Elazığ', en: 'Elazığ' },
  'TR-24': { tr: 'Erzincan', en: 'Erzincan' },
  'TR-25': { tr: 'Erzurum', en: 'Erzurum' },
  'TR-26': { tr: 'Eskişehir', en: 'Eskişehir' },
  'TR-27': { tr: 'Gaziantep', en: 'Gaziantep' },
  'TR-28': { tr: 'Giresun', en: 'Giresun' },
  'TR-29': { tr: 'Gümüşhane', en: 'Gümüşhane' },
  'TR-30': { tr: 'Hakkari', en: 'Hakkari' },
  'TR-31': { tr: 'Hatay', en: 'Hatay' },
  'TR-32': { tr: 'Isparta', en: 'Isparta' },
  'TR-33': { tr: 'Mersin', en: 'Mersin' },
  'TR-34': { tr: 'İstanbul', en: 'Istanbul' },
  'TR-35': { tr: 'İzmir', en: 'Izmir' },
  'TR-36': { tr: 'Kars', en: 'Kars' },
  'TR-37': { tr: 'Kastamonu', en: 'Kastamonu' },
  'TR-38': { tr: 'Kayseri', en: 'Kayseri' },
  'TR-39': { tr: 'Kırklareli', en: 'Kırklareli' },
  'TR-40': { tr: 'Kırşehir', en: 'Kırşehir' },
  'TR-41': { tr: 'Kocaeli', en: 'Kocaeli' },
  'TR-42': { tr: 'Konya', en: 'Konya' },
  'TR-43': { tr: 'Kütahya', en: 'Kütahya' },
  'TR-44': { tr: 'Malatya', en: 'Malatya' },
  'TR-45': { tr: 'Manisa', en: 'Manisa' },
  'TR-46': { tr: 'Kahramanmaraş', en: 'Kahramanmaraş' },
  'TR-47': { tr: 'Mardin', en: 'Mardin' },
  'TR-48': { tr: 'Muğla', en: 'Muğla' },
  'TR-49': { tr: 'Muş', en: 'Muş' },
  'TR-50': { tr: 'Nevşehir', en: 'Nevşehir' },
  'TR-51': { tr: 'Niğde', en: 'Niğde' },
  'TR-52': { tr: 'Ordu', en: 'Ordu' },
  'TR-53': { tr: 'Rize', en: 'Rize' },
  'TR-54': { tr: 'Sakarya', en: 'Sakarya' },
  'TR-55': { tr: 'Samsun', en: 'Samsun' },
  'TR-56': { tr: 'Siirt', en: 'Siirt' },
  'TR-57': { tr: 'Sinop', en: 'Sinop' },
  'TR-58': { tr: 'Sivas', en: 'Sivas' },
  'TR-59': { tr: 'Tekirdağ', en: 'Tekirdağ' },
  'TR-60': { tr: 'Tokat', en: 'Tokat' },
  'TR-61': { tr: 'Trabzon', en: 'Trabzon' },
  'TR-62': { tr: 'Tunceli', en: 'Tunceli' },
  'TR-63': { tr: 'Şanlıurfa', en: 'Şanlıurfa' },
  'TR-64': { tr: 'Uşak', en: 'Uşak' },
  'TR-65': { tr: 'Van', en: 'Van' },
  'TR-66': { tr: 'Yozgat', en: 'Yozgat' },
  'TR-67': { tr: 'Zonguldak', en: 'Zonguldak' },
  'TR-68': { tr: 'Aksaray', en: 'Aksaray' },
  'TR-69': { tr: 'Bayburt', en: 'Bayburt' },
  'TR-70': { tr: 'Karaman', en: 'Karaman' },
  'TR-71': { tr: 'Kırıkkale', en: 'Kırıkkale' },
  'TR-72': { tr: 'Batman', en: 'Batman' },
  'TR-73': { tr: 'Şırnak', en: 'Şırnak' },
  'TR-74': { tr: 'Bartın', en: 'Bartın' },
  'TR-75': { tr: 'Ardahan', en: 'Ardahan' },
  'TR-76': { tr: 'Iğdır', en: 'Iğdır' },
  'TR-77': { tr: 'Yalova', en: 'Yalova' },
  'TR-78': { tr: 'Karabük', en: 'Karabük' },
  'TR-79': { tr: 'Kilis', en: 'Kilis' },
  'TR-80': { tr: 'Osmaniye', en: 'Osmaniye' },
  'TR-81': { tr: 'Düzce', en: 'Düzce' },
}

/**
 * ISO 3166-2 bölge kodundan il adı (`TR-34` → İstanbul / Istanbul). Kod kırpılıp büyük harfe
 * çevrilir; Türkiye dışı ya da bilinmeyen kodda null.
 */
export function provinceName(isoRegion: string | null | undefined, locale: Locale): string | null {
  const code = isoRegion?.trim().toUpperCase() ?? ''
  if (!Object.hasOwn(TR_PROVINCES, code)) return null
  return TR_PROVINCES[code]?.[locale] ?? null
}

/** Karşılaştırma biçimi: büyük-küçük harf ve Türkçe harf farkı yok sayılır (İstanbul = Istanbul). */
function foldName(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ı/g, 'i')
}

/** Tek bir yer adı: harfler; arada tek boşluk, kısa çizgi ya da kesme işareti. Virgül, ayraç, rakam yok. */
const PLACE_NAME = /^\p{L}+(?:[ '’-]\p{L}+)*$/u

/**
 * Havalimanının hizmet verdiği yerleşim (OurAirports `municipality`), yalnızca temiz biçimdeyse: tek
 * bir yer adıdır ve il adını tekrar etmez. OurAirports bu alanı serbest metin olarak tutar; İstanbul
 * kayıtlarında "Istanbul(Bakırköy)", "Pendik, Istanbul" ve ille aynı "Istanbul" gibi İngilizce ya da
 * biçimsiz değerler vardır. Bunlar gösterilmez; il zaten `provinceName` ile yazılır. Değer yoksa,
 * biçimi bozuksa ya da ille aynıysa null.
 */
export function airportDistrict(airport: {
  isoRegion: string
  municipality: string | null
}): string | null {
  const value = airport.municipality?.trim() ?? ''
  if (!PLACE_NAME.test(value)) return null
  const province = provinceName(airport.isoRegion, 'tr')
  if (province !== null && foldName(province) === foldName(value)) return null
  return value
}
