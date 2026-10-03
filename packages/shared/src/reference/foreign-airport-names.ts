import type { Locale, LocalizedText } from '../locale'

/**
 * Türkiye dışındaki listelenen havalimanlarının (D-080) Türkçe ve İngilizce görünen adları, 1.
 * halkanın (≤ 500 km) 75 havalimanı, ICAO koduna göre sıralı (anahtar listedeki kanonik ICAO'dur:
 * Süleymaniye'nin OurAirports kimliği ORSU, ICAO'su ORSJ).
 *
 * Kaynak: İngilizce ad OurAirports adıdır (kamu malı; indirme 2026-10-01T23:03Z). Yalnızca Bağdat'ın
 * adı kısaltılmıştır: askerî üs eki ("/ New Al Muthana Air Base") yazılmaz, havalimanının kendi
 * İngilizce adı kalır. Türkçe ad havayolu'nun derlemesidir
 * (kullanıcı kararı 2026-10-01, D-080), kuralları:
 * - Şehir ya da ada adı Türkçede yerleşik biçimiyle (exonym) yazılır: Atina, Selanik, Sofya,
 *   Filibe, Burgaz, Üsküp, Ohri, Priştine, Niş, Bükreş, Köstence, Krayova, Tiflis, Batum, Sohum,
 *   Erivan, Gümrü, Nahçıvan, Gence, Tebriz, Urmiye, Erdebil, Bağdat, Erbil, Kerkük, Süleymaniye,
 *   Halep, Şam, Kamışlı, Lazkiye, Beyrut, Hayfa, Larnaka, Baf, Rodos, İstanköy, Midilli, Sakız,
 *   Sisam, Kerpe, Kandiye, Hanya, Dedeağaç, Yanya, Preveze, Soçi, Gebele … Yerleşik Türkçe biçim
 *   yoksa yerel ad Türkçe harflerle ya da özgün yazımıyla kalır (Kalamata, Skiathos, Santorini,
 *   Volos).
 * - Resmî adın ayırt edici özel adı korunur ("Atina Eleftherios Venizelos Havalimanı"). Tarihî ve
 *   klasik kişilerin Türkçede yerleşik adları kullanılır (Büyük İskender, Büyük Konstantin, Hipokrat,
 *   Demokritos, Aziz Pavlus, Kral Pirus); çağdaş kişilerin adı özgün yazımıyla kalır (Henri Coandă,
 *   Nikos Kazantzakis), Türkçede yerleşik yazımı varsa onunla (Refik Hariri, Celal Talabani, Ahmet
 *   Kadirov, Eşrefi İsfahani; unvan da Türkçesiyle: Şehit, Serdar-ı Cengel; D-084).
 * - "International", "National", "Island" gibi nitelemeler Türkçe adda yazılmaz; ad "Havalimanı"
 *   ile biter. Tartışmalı bölgelerde (Sohum) yalnızca şehir adı kullanılır.
 *
 * Tabloda olmayan yurt dışı havalimanı (sonraki halkalar) `translatedAirportName` kuralıyla
 * Türkçeleştirilir ("International Airport" → "Uluslararası Havalimanı", "Airport" → "Havalimanı").
 */
export const FOREIGN_AIRPORT_NAMES: Readonly<Record<string, LocalizedText>> = {
  BKPR: {
    tr: 'Priştine Adem Jashari Havalimanı',
    en: 'Priština Adem Jashari International Airport',
  },
  LBBG: { tr: 'Burgaz Havalimanı', en: 'Burgas Airport' },
  LBPD: { tr: 'Filibe Havalimanı', en: 'Plovdiv International Airport' },
  LBSF: { tr: 'Sofya Havalimanı', en: 'Sofia Airport' },
  LBWN: { tr: 'Varna Havalimanı', en: 'Varna Airport' },
  LCEN: { tr: 'Ercan Havalimanı', en: 'Ercan International Airport' },
  LCLK: { tr: 'Larnaka Havalimanı', en: 'Larnaca International Airport' },
  LCPH: { tr: 'Baf Havalimanı', en: 'Paphos International Airport' },
  LGAL: { tr: 'Dedeağaç Demokritos Havalimanı', en: 'Alexandroupoli Democritus Airport' },
  LGAV: {
    tr: 'Atina Eleftherios Venizelos Havalimanı',
    en: 'Athens Eleftherios Venizelos International Airport',
  },
  LGBL: { tr: 'Volos Nea Anchialos Havalimanı', en: 'Nea Anchialos National Airport' },
  LGHI: { tr: 'Sakız Havalimanı', en: 'Chios Island National Airport' },
  LGIO: { tr: 'Yanya Kral Pirus Havalimanı', en: 'Ioannina King Pyrrhus National Airport' },
  LGIR: {
    tr: 'Kandiye Nikos Kazantzakis Havalimanı',
    en: 'Heraklion International Nikos Kazantzakis Airport',
  },
  LGKL: { tr: 'Kalamata Havalimanı', en: 'Kalamata Airport' },
  LGKO: { tr: 'İstanköy Hipokrat Havalimanı', en: 'Kos International Airport "Ippokratis"' },
  LGKP: { tr: 'Kerpe Havalimanı', en: 'Karpathos Airport' },
  LGKV: {
    tr: 'Kavala Büyük İskender Havalimanı',
    en: 'Kavala Alexander the Great International Airport',
  },
  LGKZ: { tr: 'Kozana Filippos Havalimanı', en: 'Kozani National Airport Filippos' },
  LGMK: { tr: 'Mikonos Havalimanı', en: 'Mykonos Island National Airport' },
  LGMT: { tr: 'Midilli Havalimanı', en: 'Mytilene International Airport' },
  LGPZ: { tr: 'Preveze Aktion Havalimanı', en: 'Aktion National Airport' },
  LGRP: { tr: 'Rodos Diagoras Havalimanı', en: 'Rhodes International Airport "Diagoras"' },
  LGRX: { tr: 'Patra Araxos Agamemnon Havalimanı', en: 'Patras Araxos Agamemnon Airport' },
  LGSA: { tr: 'Hanya Havalimanı', en: 'Chania International Airport' },
  LGSK: { tr: 'Skiathos Havalimanı', en: 'Skiathos Island National Airport' },
  LGSM: { tr: 'Sisam Havalimanı', en: 'Samos Airport' },
  LGSR: { tr: 'Santorini Havalimanı', en: 'Santorini International Airport' },
  LGST: { tr: 'Sitia Havalimanı', en: 'Sitia Airport' },
  LGTS: {
    tr: 'Selanik Makedonya Havalimanı',
    en: 'Thessaloniki Macedonia International Airport',
  },
  LLHA: { tr: 'Hayfa Uri Michaeli Havalimanı', en: 'Uri Michaeli Haifa International Airport' },
  LRBS: {
    tr: 'Bükreş Băneasa Aurel Vlaicu Havalimanı',
    en: 'Bucharest Băneasa Aurel Vlaicu International Airport',
  },
  LRCK: {
    tr: 'Köstence Mihail Kogălniceanu Havalimanı',
    en: 'Mihail Kogălniceanu International Airport',
  },
  LRCV: { tr: 'Krayova Havalimanı', en: 'Craiova International Airport' },
  LROP: {
    tr: 'Bükreş Henri Coandă Havalimanı',
    en: 'Bucharest Henri Coandă International Airport',
  },
  LWOH: { tr: 'Ohri Aziz Pavlus Havalimanı', en: 'Ohrid St. Paul the Apostle Airport' },
  LWSK: { tr: 'Üsküp Havalimanı', en: 'Skopje International Airport' },
  LYNI: { tr: 'Niş Büyük Konstantin Havalimanı', en: 'Niš Constantine the Great Airport' },
  OICC: {
    tr: 'Kirmanşah Şehit Eşrefi İsfahani Havalimanı',
    en: 'Shahid Ashrafi Esfahani Airport',
  },
  OICS: { tr: 'Senendec Havalimanı', en: 'Sanandaj Airport' },
  OIGG: { tr: 'Reşt Serdar-ı Cengel Havalimanı', en: 'Sardar-e-Jangal Airport' },
  OIHH: { tr: 'Hemedan Havalimanı', en: 'Hamadan Airport' },
  OITL: { tr: 'Erdebil Havalimanı', en: 'Ardabil Airport' },
  OITR: { tr: 'Urmiye Havalimanı', en: 'Urmia Airport' },
  OITT: { tr: 'Tebriz Havalimanı', en: 'Tabriz International Airport' },
  OJAM: { tr: 'Amman Marka Havalimanı', en: 'Marka International (Amman Civil) Airport' },
  OLBA: {
    tr: 'Beyrut Refik Hariri Havalimanı',
    en: 'Beirut Rafic Hariri International Airport',
  },
  // OurAirports: "Baghdad International Airport / New Al Muthana Air Base".
  ORBI: { tr: 'Bağdat Havalimanı', en: 'Baghdad International Airport' },
  ORER: { tr: 'Erbil Havalimanı', en: 'Erbil International Airport' },
  ORKK: { tr: 'Kerkük Havalimanı', en: 'Kirkuk International Airport' },
  ORSJ: {
    tr: 'Süleymaniye Celal Talabani Havalimanı',
    en: 'Jalal Talabani International Airport',
  },
  OSAP: { tr: 'Halep Havalimanı', en: 'Aleppo International Airport' },
  OSDI: { tr: 'Şam Havalimanı', en: 'Damascus International Airport' },
  OSKL: { tr: 'Kamışlı Havalimanı', en: 'Qamishli International Airport' },
  OSLK: { tr: 'Lazkiye Havalimanı', en: 'Latakia International Airport' },
  UBBG: { tr: 'Gence Havalimanı', en: 'Ganja International Airport' },
  UBBN: { tr: 'Nahçıvan Havalimanı', en: 'Nakhchivan International Airport' },
  UBBQ: { tr: 'Gebele Havalimanı', en: 'Gabala International Airport' },
  UBLC: { tr: 'Laçın Havalimanı', en: 'Lachin International Airport' },
  UDSG: { tr: 'Gümrü Şirak Havalimanı', en: 'Shirak International Airport' },
  UDYZ: { tr: 'Erivan Zvartnots Havalimanı', en: 'Zvartnots International Airport' },
  UGKO: { tr: 'Kutaisi Havalimanı', en: 'David the Builder Kutaisi International Airport' },
  UGSB: {
    tr: 'Batum Alexander Kartveli Havalimanı',
    en: 'Alexander Kartveli Batumi International Airport',
  },
  UGSS: { tr: 'Sohum Havalimanı', en: 'Vladislav Ardzinba Sukhum International Airport' },
  UGTB: { tr: 'Tiflis Havalimanı', en: 'Tbilisi International Airport' },
  URKG: { tr: 'Gelencik Havalimanı', en: 'Gelendzhik Airport' },
  URKK: {
    tr: 'Krasnodar Paşkovski Havalimanı',
    en: 'Krasnodar Pashkovsky International Airport',
  },
  URMG: {
    tr: 'Grozni Ahmet Kadirov Havalimanı',
    en: 'Akhmat Kadyrov Grozny International Airport',
  },
  URML: { tr: 'Mahaçkale Uytaş Havalimanı', en: 'Makhachkala Uytash International Airport' },
  URMM: { tr: 'Mineralnıye Vodı Havalimanı', en: 'Mineralnye Vody Airport' },
  URMN: { tr: 'Nalçik Havalimanı', en: 'Nalchik Airport' },
  URMO: { tr: 'Vladikavkaz Beslan Havalimanı', en: 'Vladikavkaz Beslan International Airport' },
  URMS: { tr: 'Magas Havalimanı', en: 'Magas Airport' },
  URMT: { tr: 'Stavropol Şpakovskoye Havalimanı', en: 'Stavropol Shpakovskoye Airport' },
  URSS: { tr: 'Soçi Havalimanı', en: 'Sochi International Airport' },
}

/** Tablodaki kayıt; kod tabloda yoksa undefined. ICAO kırpılıp büyük harfe çevrilir. */
export function foreignAirportName(icao: string): LocalizedText | undefined {
  const code = icao.trim().toUpperCase()
  return Object.hasOwn(FOREIGN_AIRPORT_NAMES, code) ? FOREIGN_AIRPORT_NAMES[code] : undefined
}

const city = (tr: string, en: string): LocalizedText => ({ tr, en })

/**
 * `FOREIGN_AIRPORT_NAMES`'teki havalimanlarının hizmet verdiği şehir, iki dilde (M6d düzeltme turu,
 * D-080): havalimanı sayfasının başlığı altındaki yer satırı ("Selanik, Yunanistan"), "Hizmet
 * verdiği yerleşim" satırı, JSON-LD `addressLocality` ve paylaşım görseli bunu yazar.
 *
 * OurAirports `municipality` alanı İngilizce ya da yereldir ve bazen şehir değildir ("Kos Island",
 * Sitia için "Crete Island", Hanya için "Souda", Üsküp için "Ilinden", Bükreş Henri Coandă için
 * "Otopeni"); Türkçe sayfada Türkçe adın hemen altına İngilizce yer adı düşüyordu. Bu yüzden ham
 * değer yabancı havalimanında gösterilmez. Türkçe şehir adı havalimanının Türkçe adındaki yer adıdır
 * (exonym; kurallar yukarıda); İngilizce ad şehrin İngilizcede yerleşik adıdır. Havalimanı başka bir
 * yerleşimin sınırındaysa havalimanının hizmet verdiği şehir yazılır (Atina, Bükreş, Üsküp, Kutaisi,
 * Vladikavkaz, Magas; Ercan için Lefkoşa).
 */
export const FOREIGN_AIRPORT_CITIES: Readonly<Record<string, LocalizedText>> = {
  BKPR: city('Priştine', 'Pristina'),
  LBBG: city('Burgaz', 'Burgas'),
  LBPD: city('Filibe', 'Plovdiv'),
  LBSF: city('Sofya', 'Sofia'),
  LBWN: city('Varna', 'Varna'),
  LCEN: city('Lefkoşa', 'North Nicosia'),
  LCLK: city('Larnaka', 'Larnaca'),
  LCPH: city('Baf', 'Paphos'),
  LGAL: city('Dedeağaç', 'Alexandroupoli'),
  LGAV: city('Atina', 'Athens'),
  LGBL: city('Volos', 'Volos'),
  LGHI: city('Sakız', 'Chios'),
  LGIO: city('Yanya', 'Ioannina'),
  LGIR: city('Kandiye', 'Heraklion'),
  LGKL: city('Kalamata', 'Kalamata'),
  LGKO: city('İstanköy', 'Kos'),
  LGKP: city('Kerpe', 'Karpathos'),
  LGKV: city('Kavala', 'Kavala'),
  LGKZ: city('Kozana', 'Kozani'),
  LGMK: city('Mikonos', 'Mykonos'),
  LGMT: city('Midilli', 'Mytilene'),
  LGPZ: city('Preveze', 'Preveza'),
  LGRP: city('Rodos', 'Rhodes'),
  LGRX: city('Patra', 'Patras'),
  LGSA: city('Hanya', 'Chania'),
  LGSK: city('Skiathos', 'Skiathos'),
  LGSM: city('Sisam', 'Samos'),
  LGSR: city('Santorini', 'Santorini'),
  LGST: city('Sitia', 'Sitia'),
  LGTS: city('Selanik', 'Thessaloniki'),
  LLHA: city('Hayfa', 'Haifa'),
  LRBS: city('Bükreş', 'Bucharest'),
  LRCK: city('Köstence', 'Constanța'),
  LRCV: city('Krayova', 'Craiova'),
  LROP: city('Bükreş', 'Bucharest'),
  LWOH: city('Ohri', 'Ohrid'),
  LWSK: city('Üsküp', 'Skopje'),
  LYNI: city('Niş', 'Niš'),
  OICC: city('Kirmanşah', 'Kermanshah'),
  OICS: city('Senendec', 'Sanandaj'),
  OIGG: city('Reşt', 'Rasht'),
  OIHH: city('Hemedan', 'Hamadan'),
  OITL: city('Erdebil', 'Ardabil'),
  OITR: city('Urmiye', 'Urmia'),
  OITT: city('Tebriz', 'Tabriz'),
  OJAM: city('Amman', 'Amman'),
  OLBA: city('Beyrut', 'Beirut'),
  ORBI: city('Bağdat', 'Baghdad'),
  ORER: city('Erbil', 'Erbil'),
  ORKK: city('Kerkük', 'Kirkuk'),
  ORSJ: city('Süleymaniye', 'Sulaymaniyah'),
  OSAP: city('Halep', 'Aleppo'),
  OSDI: city('Şam', 'Damascus'),
  OSKL: city('Kamışlı', 'Qamishli'),
  OSLK: city('Lazkiye', 'Latakia'),
  UBBG: city('Gence', 'Ganja'),
  UBBN: city('Nahçıvan', 'Nakhchivan'),
  UBBQ: city('Gebele', 'Gabala'),
  UBLC: city('Laçın', 'Lachin'),
  UDSG: city('Gümrü', 'Gyumri'),
  UDYZ: city('Erivan', 'Yerevan'),
  UGKO: city('Kutaisi', 'Kutaisi'),
  UGSB: city('Batum', 'Batumi'),
  UGSS: city('Sohum', 'Sukhumi'),
  UGTB: city('Tiflis', 'Tbilisi'),
  URKG: city('Gelencik', 'Gelendzhik'),
  URKK: city('Krasnodar', 'Krasnodar'),
  URMG: city('Grozni', 'Grozny'),
  URML: city('Mahaçkale', 'Makhachkala'),
  URMM: city('Mineralnıye Vodı', 'Mineralnye Vody'),
  URMN: city('Nalçik', 'Nalchik'),
  URMO: city('Vladikavkaz', 'Vladikavkaz'),
  URMS: city('Magas', 'Magas'),
  URMT: city('Stavropol', 'Stavropol'),
  URSS: city('Soçi', 'Sochi'),
}

/** Şehir tablosundaki kayıt; kod tabloda yoksa undefined. ICAO kırpılıp büyük harfe çevrilir. */
export function foreignAirportCity(icao: string): LocalizedText | undefined {
  const code = icao.trim().toUpperCase()
  return Object.hasOwn(FOREIGN_AIRPORT_CITIES, code) ? FOREIGN_AIRPORT_CITIES[code] : undefined
}

/**
 * Tabloda olmayan havalimanının Türkçe adı, OurAirports adından kuralla: "International Airport"
 * → "Uluslararası Havalimanı", kalan "Airport" → "Havalimanı" (tam sözcük, büyük/küçük harf
 * duyarlı). Diğer sözcükler (Air Base, Airfield, özel adlar) olduğu gibi kalır. İngilizce ad
 * OurAirports adının kendisidir.
 */
export function translatedAirportName(name: string, locale: Locale): string {
  const trimmed = name.trim()
  if (locale === 'en') return trimmed
  return trimmed
    .replace(/\bInternational Airport\b/g, 'Uluslararası Havalimanı')
    .replace(/\bAirport\b/g, 'Havalimanı')
}
