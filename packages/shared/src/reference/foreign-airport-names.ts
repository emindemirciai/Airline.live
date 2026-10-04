import type { Locale, LocalizedText } from '../locale'

/**
 * Türkiye dışındaki listelenen havalimanlarının (D-080) Türkçe ve İngilizce görünen adları: 1.
 * halkanın (≤ 500 km) 75 ve 2. halkanın (≤ 1.000 km, D-088) 89 havalimanı, toplam 164, ICAO koduna
 * göre sıralı (anahtar listedeki kanonik ICAO'dur: Süleymaniye'nin OurAirports kimliği ORSU, ICAO'su
 * ORSJ; İskenderiye'nin OurAirports `icao_code`'u HEAX, uygulamadaki kodu HEBA,
 * `OURAIRPORTS_ICAO_CORRECTIONS`).
 *
 * Kaynak: İngilizce ad OurAirports adıdır (kamu malı; indirme 2026-10-01T23:03Z), art arda boşluklar
 * teke indirilmiş olarak (Bacău'nun kaynaktaki adında "International  Airport"). Askerî üs eki
 * yazılmaz, havalimanının kendi İngilizce adı kalır: Bağdat ("/ New Al Muthana Air Base") ve
 * Podgorica ("/ Podgorica Golubovci Airbase"). Eski ad da kural gereği kalır (Kefalonya "Kefallinia
 * Airport"). Türkçe ad havayolu'nun derlemesidir (kullanıcı kararı 2026-10-01, D-080), kuralları:
 * - Şehir ya da ada adı Türkçede bugün kullanılan yerleşik biçimiyle (exonym) yazılır: Atina,
 *   Selanik, Sofya, Filibe, Burgaz, Üsküp, Ohri, Priştine, Niş, Bükreş, Köstence, Krayova, Tiflis,
 *   Batum, Sohum, Erivan, Gümrü, Nahçıvan, Gence, Tebriz, Urmiye, Erdebil, Bağdat, Erbil, Kerkük,
 *   Süleymaniye, Halep, Şam, Kamışlı, Lazkiye, Beyrut, Hayfa, Larnaka, Baf, Rodos, İstanköy, Midilli,
 *   Sakız, Sisam, Kerpe, Kandiye, Hanya, Dedeağaç, Yanya, Preveze, Soçi, Gebele; 2. halkada Kahire,
 *   İskenderiye, Gize, Şarm el-Şeyh, El Ariş, El Alameyn, Bingazi, Belgrad, Saraybosna, Budapeşte,
 *   Kişinev, Tiran, Korfu, Kefalonya, Zakintos, Napoli, Tahran, İsfahan, Kaşan, Kerec, Hürremabad,
 *   Mahşehr, Necef, Basra, Kuveyt, Akabe, Eylat, Tebük, Bakü, Aktav, Türkmenbaşı, Astrahan.
 *   Yalnız tarihte kalan biçimler kullanılmaz (D-088): Iași (Yaş değil), Timișoara (Temeşvar değil),
 *   Catania (Katanya değil), Pécs (Peçuy değil). Yerleşik Türkçe biçim yoksa yerel ad Türkçe
 *   harflerle ya da özgün yazımıyla kalır (Kalamata, Skiathos, Santorini, Volos, Kurayyat, Sekaka,
 *   Beyda, Nowshahr, Sari Dasht-e Naz). Farsça "Nowshahr" Türkçe harflerle "Nevşehr" olurdu ve
 *   Nevşehir'le karışırdı; uluslararası yazımı kalır.
 * - Resmî adın ayırt edici özel adı korunur ("Atina Eleftherios Venizelos Havalimanı", "Ahvaz Kasım
 *   Süleymani Havalimanı"). Havalimanının adı şehir adını taşımıyorsa önüne hizmet verdiği şehir
 *   eklenir ("Baia Mare Maramureș", "Beyda El Abrak", "Sekaka El Cevf", "Kraljevo Morava"). Yer
 *   (semt) adı olan ek atılır ("Crotone Sant'Anna" → "Crotone", "Lamezia Terme Sant'Eufemia" →
 *   "Lamezia Terme"). Tarihî ve klasik kişilerin Türkçede yerleşik adları kullanılır (Büyük İskender,
 *   Büyük Konstantin, Hipokrat, Demokritos, Aziz Pavlus, Kral Pirus, Pisagor, Aziz Hieronymus, Büyük
 *   Stefan); bölge adı da Türkçe biçimiyle (Makedonya, Transilvanya). Çağdaş kişilerin adı özgün
 *   yazımıyla kalır (Henri Coandă, Nikos Kazantzakis, Nikola Tesla, Karol Wojtyła, Liszt Ferenc),
 *   Türkçede yerleşik yazımı varsa onunla (Refik Hariri, Celal Talabani, Ahmet Kadirov, Eşrefi
 *   İsfahani, Haydar Aliyev, Rahibe Teresa, Kraliçe Alia, Kral Hüseyin, İmam Humeyni, Kasım
 *   Süleymani, Prens Sultan bin Abdulaziz, Boris Kustodiyev; unvan da Türkçe haberlerdeki biçimiyle:
 *   Şehit, Serdar Cengel, Ayetullah; D-084, D-088).
 * - "International", "National", "Domestic", "Island" gibi nitelemeler Türkçe adda yazılmaz; ad
 *   "Havalimanı" ile biter. Tartışmalı bölgelerde (Sohum) yalnızca şehir adı kullanılır.
 *
 * Tabloda olmayan yurt dışı havalimanı (sonraki halkalar) `translatedAirportName` kuralıyla
 * Türkçeleştirilir ("International Airport" → "Uluslararası Havalimanı", "Airport" → "Havalimanı").
 */
export const FOREIGN_AIRPORT_NAMES: Readonly<Record<string, LocalizedText>> = {
  BKPR: {
    tr: 'Priştine Adem Jashari Havalimanı',
    en: 'Priština Adem Jashari International Airport',
  },
  HEAL: { tr: 'El Alameyn Havalimanı', en: 'El Alamein International Airport' },
  HEAR: { tr: 'El Ariş Havalimanı', en: 'El Arish International Airport' },
  HEBA: { tr: 'İskenderiye Havalimanı', en: 'Alexandria International Airport' },
  HECA: { tr: 'Kahire Havalimanı', en: 'Cairo International Airport' },
  HECP: { tr: 'Kahire Başkent Havalimanı', en: 'Capital International Airport' },
  HEMM: { tr: 'Mersa Matruh Havalimanı', en: 'Mersa Matruh International Airport' },
  HEPS: { tr: 'Port Said Havalimanı', en: 'Port Said International Airport' },
  HESH: { tr: 'Şarm el-Şeyh Havalimanı', en: 'Sharm El Sheikh International Airport' },
  HESX: { tr: 'Gize Sfenks Havalimanı', en: 'Sphinx International Airport' },
  HETB: { tr: 'Taba Havalimanı', en: 'Taba International Airport' },
  HLLB: { tr: 'Bingazi Benina Havalimanı', en: 'Benina International Airport' },
  HLLQ: { tr: 'Beyda El Abrak Havalimanı', en: 'Al Abraq International Airport' },
  LATI: { tr: 'Tiran Rahibe Teresa Havalimanı', en: 'Tirana International Airport Mother Teresa' },
  LBBG: { tr: 'Burgaz Havalimanı', en: 'Burgas Airport' },
  LBPD: { tr: 'Filibe Havalimanı', en: 'Plovdiv International Airport' },
  LBSF: { tr: 'Sofya Havalimanı', en: 'Sofia Airport' },
  LBWN: { tr: 'Varna Havalimanı', en: 'Varna Airport' },
  LCEN: { tr: 'Ercan Havalimanı', en: 'Ercan International Airport' },
  LCLK: { tr: 'Larnaka Havalimanı', en: 'Larnaca International Airport' },
  LCPH: { tr: 'Baf Havalimanı', en: 'Paphos International Airport' },
  LDDU: { tr: 'Dubrovnik Ruđer Bošković Havalimanı', en: 'Dubrovnik Ruđer Bošković Airport' },
  LDOS: { tr: 'Osijek Havalimanı', en: 'Osijek Airport' },
  LDSB: { tr: 'Brač Havalimanı', en: 'Brač Airport' },
  LDSP: { tr: 'Split Aziz Hieronymus Havalimanı', en: 'Split Saint Jerome Airport' },
  LDZD: { tr: 'Zadar Havalimanı', en: 'Zadar Airport' },
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
  LGKF: { tr: 'Kefalonya Havalimanı', en: 'Kefallinia Airport' },
  LGKL: { tr: 'Kalamata Havalimanı', en: 'Kalamata Airport' },
  LGKO: { tr: 'İstanköy Hipokrat Havalimanı', en: 'Kos International Airport "Ippokratis"' },
  LGKP: { tr: 'Kerpe Havalimanı', en: 'Karpathos Airport' },
  LGKR: {
    tr: 'Korfu Ioannis Kapodistrias Havalimanı',
    en: 'Corfu Ioannis Kapodistrias International Airport',
  },
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
  LGTS: { tr: 'Selanik Makedonya Havalimanı', en: 'Thessaloniki Macedonia International Airport' },
  LGZA: {
    tr: 'Zakintos Dionysios Solomos Havalimanı',
    en: 'Zakynthos International Airport Dionysios Solomos',
  },
  LHBP: {
    tr: 'Budapeşte Liszt Ferenc Havalimanı',
    en: 'Budapest Liszt Ferenc International Airport',
  },
  LHDC: { tr: 'Debrecen Havalimanı', en: 'Debrecen International Airport' },
  LHPP: { tr: 'Pécs-Pogány Havalimanı', en: 'Pécs-Pogány International Airport' },
  LIBC: { tr: 'Crotone Pisagor Havalimanı', en: "Crotone Sant'Anna Pythagoras Airport" },
  LIBD: { tr: 'Bari Karol Wojtyła Havalimanı', en: 'Bari Karol Wojtyła International Airport' },
  LIBF: { tr: 'Foggia Gino Lisa Havalimanı', en: 'Foggia Gino Lisa Airport' },
  LIBR: { tr: 'Brindisi Havalimanı', en: 'Brindisi Airport' },
  LICA: { tr: 'Lamezia Terme Havalimanı', en: "Lamezia Terme Sant'Eufemia International Airport" },
  LICC: { tr: 'Catania Fontanarossa Havalimanı', en: 'Catania-Fontanarossa Airport' },
  LICR: { tr: 'Reggio Calabria Havalimanı', en: 'Reggio Calabria Airport' },
  LIRI: { tr: "Salerno Costa d'Amalfi Havalimanı", en: "Salerno Costa d'Amalfi Airport" },
  LIRN: { tr: 'Napoli Havalimanı', en: 'Naples International Airport' },
  LLBG: { tr: 'Tel Aviv Ben Gurion Havalimanı', en: 'Ben Gurion International Airport' },
  LLER: { tr: 'Eylat Ramon Havalimanı', en: 'Ramon International Airport' },
  LLHA: { tr: 'Hayfa Uri Michaeli Havalimanı', en: 'Uri Michaeli Haifa International Airport' },
  LQBK: { tr: 'Banja Luka Havalimanı', en: 'Banja Luka International Airport' },
  LQMO: { tr: 'Mostar Havalimanı', en: 'Mostar International Airport' },
  LQSA: { tr: 'Saraybosna Havalimanı', en: 'Sarajevo International Airport' },
  LQTZ: { tr: 'Tuzla Havalimanı', en: 'Tuzla International Airport' },
  LRAR: { tr: 'Arad Havalimanı', en: 'Arad International Airport' },
  LRBC: { tr: 'Bacău George Enescu Havalimanı', en: 'Bacău George Enescu International Airport' },
  LRBM: { tr: 'Baia Mare Maramureș Havalimanı', en: 'Maramureș International Airport' },
  LRBS: {
    tr: 'Bükreş Băneasa Aurel Vlaicu Havalimanı',
    en: 'Bucharest Băneasa Aurel Vlaicu International Airport',
  },
  LRBV: { tr: 'Brașov-Ghimbav Havalimanı', en: 'Brașov-Ghimbav International Airport' },
  LRCK: {
    tr: 'Köstence Mihail Kogălniceanu Havalimanı',
    en: 'Mihail Kogălniceanu International Airport',
  },
  LRCL: { tr: 'Cluj-Napoca Avram Iancu Havalimanı', en: 'Avram Iancu Cluj International Airport' },
  LRCV: { tr: 'Krayova Havalimanı', en: 'Craiova International Airport' },
  LRIA: { tr: 'Iași Havalimanı', en: 'Iaşi International Airport' },
  LROD: { tr: 'Oradea Havalimanı', en: 'Oradea International Airport' },
  LROP: {
    tr: 'Bükreş Henri Coandă Havalimanı',
    en: 'Bucharest Henri Coandă International Airport',
  },
  LRSB: { tr: 'Sibiu Havalimanı', en: 'Sibiu International Airport' },
  LRSM: { tr: 'Satu Mare Havalimanı', en: 'Satu Mare International Airport' },
  LRSV: {
    tr: 'Suceava Büyük Stefan Havalimanı',
    en: 'Suceava Ștefan cel Mare International Airport',
  },
  LRTM: {
    tr: 'Târgu Mureș Transilvanya Havalimanı',
    en: 'Târgu Mureş Transilvania International Airport',
  },
  LRTR: {
    tr: 'Timișoara Traian Vuia Havalimanı',
    en: 'Timișoara Traian Vuia International Airport',
  },
  LUKK: { tr: 'Kişinev Havalimanı', en: 'Chişinău International Airport' },
  LWOH: { tr: 'Ohri Aziz Pavlus Havalimanı', en: 'Ohrid St. Paul the Apostle Airport' },
  LWSK: { tr: 'Üsküp Havalimanı', en: 'Skopje International Airport' },
  LYBE: { tr: 'Belgrad Nikola Tesla Havalimanı', en: 'Belgrade Nikola Tesla Airport' },
  LYKV: { tr: 'Kraljevo Morava Havalimanı', en: 'Morava Airport' },
  LYNI: { tr: 'Niş Büyük Konstantin Havalimanı', en: 'Niš Constantine the Great Airport' },
  // OurAirports: "Podgorica Airport / Podgorica Golubovci Airbase".
  LYPG: { tr: 'Podgorica Havalimanı', en: 'Podgorica Airport' },
  LYTV: { tr: 'Tivat Havalimanı', en: 'Tivat Airport' },
  LZKZ: { tr: 'Košice Havalimanı', en: 'Košice International Airport' },
  OEGT: { tr: 'Kurayyat Havalimanı', en: 'Gurayat Domestic Airport' },
  OENN: { tr: 'Neom Körfezi Havalimanı', en: 'Neom Bay Airport' },
  OERF: { tr: 'Rafha Havalimanı', en: 'Rafha Domestic Airport' },
  OERR: { tr: 'Arar Havalimanı', en: 'Arar Domestic Airport' },
  OESK: { tr: 'Sekaka El Cevf Havalimanı', en: 'Al-Jawf International Airport' },
  OETB: {
    tr: 'Tebük Prens Sultan bin Abdulaziz Havalimanı',
    en: 'Prince Sultan bin Abdulaziz International Airport',
  },
  OETR: { tr: 'Turaif Havalimanı', en: 'Turaif Domestic Airport' },
  OIAA: {
    tr: 'Abadan Ayetullah Cami Havalimanı',
    en: 'Abadan Ayatollah Jami International Airport',
  },
  OIAD: { tr: 'Dezful Havalimanı', en: 'Dezful Airport' },
  OIAM: { tr: 'Mahşehr Havalimanı', en: 'Mahshahr Airport' },
  OIAW: { tr: 'Ahvaz Kasım Süleymani Havalimanı', en: 'Qasem Soleimani International Airport' },
  OICC: { tr: 'Kirmanşah Şehit Eşrefi İsfahani Havalimanı', en: 'Shahid Ashrafi Esfahani Airport' },
  OICK: { tr: 'Hürremabad Havalimanı', en: 'Khoram Abad Airport' },
  OICS: { tr: 'Senendec Havalimanı', en: 'Sanandaj Airport' },
  OIFK: { tr: 'Kaşan Havalimanı', en: 'Kashan Airport' },
  OIFM: {
    tr: 'İsfahan Şehit Beheşti Havalimanı',
    en: 'Isfahan Shahid Beheshti International Airport',
  },
  OIGG: { tr: 'Reşt Serdar Cengel Havalimanı', en: 'Sardar-e-Jangal Airport' },
  OIHH: { tr: 'Hemedan Havalimanı', en: 'Hamadan Airport' },
  OIIE: { tr: 'Tahran İmam Humeyni Havalimanı', en: 'Imam Khomeini International Airport' },
  OIII: { tr: 'Tahran Mehrabad Havalimanı', en: 'Mehrabad International Airport' },
  OIIP: { tr: 'Kerec Payam Havalimanı', en: 'Payam International Airport' },
  OINN: { tr: 'Nowshahr Havalimanı', en: 'Nowshahr Airport' },
  OINR: { tr: 'Ramsar Havalimanı', en: 'Ramsar Airport' },
  OINZ: { tr: 'Sari Dasht-e Naz Havalimanı', en: 'Sari Dasht-e Naz International Airport' },
  OITL: { tr: 'Erdebil Havalimanı', en: 'Ardabil Airport' },
  OITR: { tr: 'Urmiye Havalimanı', en: 'Urmia Airport' },
  OITT: { tr: 'Tebriz Havalimanı', en: 'Tabriz International Airport' },
  OJAI: { tr: 'Amman Kraliçe Alia Havalimanı', en: 'Queen Alia International Airport' },
  OJAM: { tr: 'Amman Marka Havalimanı', en: 'Marka International (Amman Civil) Airport' },
  OJAQ: { tr: 'Akabe Kral Hüseyin Havalimanı', en: 'King Hussein International Airport' },
  OKKK: { tr: 'Kuveyt Havalimanı', en: 'Kuwait International Airport' },
  OLBA: { tr: 'Beyrut Refik Hariri Havalimanı', en: 'Beirut Rafic Hariri International Airport' },
  // OurAirports: "Baghdad International Airport / New Al Muthana Air Base".
  ORBI: { tr: 'Bağdat Havalimanı', en: 'Baghdad International Airport' },
  ORER: { tr: 'Erbil Havalimanı', en: 'Erbil International Airport' },
  ORKK: { tr: 'Kerkük Havalimanı', en: 'Kirkuk International Airport' },
  ORMM: { tr: 'Basra Havalimanı', en: 'Basra International Airport' },
  ORNI: { tr: 'Necef Havalimanı', en: 'Al Najaf International Airport' },
  ORSJ: { tr: 'Süleymaniye Celal Talabani Havalimanı', en: 'Jalal Talabani International Airport' },
  OSAP: { tr: 'Halep Havalimanı', en: 'Aleppo International Airport' },
  OSDI: { tr: 'Şam Havalimanı', en: 'Damascus International Airport' },
  OSKL: { tr: 'Kamışlı Havalimanı', en: 'Qamishli International Airport' },
  OSLK: { tr: 'Lazkiye Havalimanı', en: 'Latakia International Airport' },
  UATE: { tr: 'Aktav Havalimanı', en: 'Aktau International Airport' },
  UBBB: { tr: 'Bakü Haydar Aliyev Havalimanı', en: 'Heydar Aliyev International Airport' },
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
  URKK: { tr: 'Krasnodar Paşkovski Havalimanı', en: 'Krasnodar Pashkovsky International Airport' },
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
  URWA: {
    tr: 'Astrahan Narimanovo Boris Kustodiyev Havalimanı',
    en: 'Astrakhan Narimanovo Boris M. Kustodiev International Airport',
  },
  URWI: { tr: 'Elista Havalimanı', en: 'Elista Airport' },
  URWW: { tr: 'Volgograd Havalimanı', en: 'Volgograd International Airport' },
  UTAK: { tr: 'Türkmenbaşı Havalimanı', en: 'Turkmenbaşy International Airport' },
  UTAN: { tr: 'Balkanabat Havalimanı', en: 'Balkanabat International Airport' },
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
 * Vladikavkaz, Magas; Ercan için Lefkoşa). 2. halkada (D-088) OurAirports yerleşimi boş (Hürremabad),
 * yazım hatalı (El Abrak için "Al Albraq") ya da köy adıdır (Tiran için "Rinas", Gize için "Al Jiza",
 * Banja Luka için "Mahovljani", Baia Mare için "Tăuții-Măgherăuș"); hepsinde şehir bu tablodandır.
 * Kahire Başkent Havalimanı (Capital International, OurAirports "New Cairo") Kahire'ye yazılır.
 */
export const FOREIGN_AIRPORT_CITIES: Readonly<Record<string, LocalizedText>> = {
  BKPR: city('Priştine', 'Pristina'),
  HEAL: city('El Alameyn', 'El Alamein'),
  HEAR: city('El Ariş', 'El Arish'),
  HEBA: city('İskenderiye', 'Alexandria'),
  HECA: city('Kahire', 'Cairo'),
  HECP: city('Kahire', 'Cairo'),
  HEMM: city('Mersa Matruh', 'Mersa Matruh'),
  HEPS: city('Port Said', 'Port Said'),
  HESH: city('Şarm el-Şeyh', 'Sharm El Sheikh'),
  HESX: city('Gize', 'Giza'),
  HETB: city('Taba', 'Taba'),
  HLLB: city('Bingazi', 'Benghazi'),
  HLLQ: city('Beyda', 'Bayda'),
  LATI: city('Tiran', 'Tirana'),
  LBBG: city('Burgaz', 'Burgas'),
  LBPD: city('Filibe', 'Plovdiv'),
  LBSF: city('Sofya', 'Sofia'),
  LBWN: city('Varna', 'Varna'),
  LCEN: city('Lefkoşa', 'North Nicosia'),
  LCLK: city('Larnaka', 'Larnaca'),
  LCPH: city('Baf', 'Paphos'),
  LDDU: city('Dubrovnik', 'Dubrovnik'),
  LDOS: city('Osijek', 'Osijek'),
  LDSB: city('Brač', 'Brač'),
  LDSP: city('Split', 'Split'),
  LDZD: city('Zadar', 'Zadar'),
  LGAL: city('Dedeağaç', 'Alexandroupoli'),
  LGAV: city('Atina', 'Athens'),
  LGBL: city('Volos', 'Volos'),
  LGHI: city('Sakız', 'Chios'),
  LGIO: city('Yanya', 'Ioannina'),
  LGIR: city('Kandiye', 'Heraklion'),
  LGKF: city('Kefalonya', 'Kefalonia'),
  LGKL: city('Kalamata', 'Kalamata'),
  LGKO: city('İstanköy', 'Kos'),
  LGKP: city('Kerpe', 'Karpathos'),
  LGKR: city('Korfu', 'Corfu'),
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
  LGZA: city('Zakintos', 'Zakynthos'),
  LHBP: city('Budapeşte', 'Budapest'),
  LHDC: city('Debrecen', 'Debrecen'),
  LHPP: city('Pécs', 'Pécs'),
  LIBC: city('Crotone', 'Crotone'),
  LIBD: city('Bari', 'Bari'),
  LIBF: city('Foggia', 'Foggia'),
  LIBR: city('Brindisi', 'Brindisi'),
  LICA: city('Lamezia Terme', 'Lamezia Terme'),
  LICC: city('Catania', 'Catania'),
  LICR: city('Reggio Calabria', 'Reggio Calabria'),
  LIRI: city('Salerno', 'Salerno'),
  LIRN: city('Napoli', 'Naples'),
  LLBG: city('Tel Aviv', 'Tel Aviv'),
  LLER: city('Eylat', 'Eilat'),
  LLHA: city('Hayfa', 'Haifa'),
  LQBK: city('Banja Luka', 'Banja Luka'),
  LQMO: city('Mostar', 'Mostar'),
  LQSA: city('Saraybosna', 'Sarajevo'),
  LQTZ: city('Tuzla', 'Tuzla'),
  LRAR: city('Arad', 'Arad'),
  LRBC: city('Bacău', 'Bacău'),
  LRBM: city('Baia Mare', 'Baia Mare'),
  LRBS: city('Bükreş', 'Bucharest'),
  LRBV: city('Brașov', 'Brașov'),
  LRCK: city('Köstence', 'Constanța'),
  LRCL: city('Cluj-Napoca', 'Cluj-Napoca'),
  LRCV: city('Krayova', 'Craiova'),
  LRIA: city('Iași', 'Iași'),
  LROD: city('Oradea', 'Oradea'),
  LROP: city('Bükreş', 'Bucharest'),
  LRSB: city('Sibiu', 'Sibiu'),
  LRSM: city('Satu Mare', 'Satu Mare'),
  LRSV: city('Suceava', 'Suceava'),
  LRTM: city('Târgu Mureș', 'Târgu Mureș'),
  LRTR: city('Timișoara', 'Timișoara'),
  LUKK: city('Kişinev', 'Chișinău'),
  LWOH: city('Ohri', 'Ohrid'),
  LWSK: city('Üsküp', 'Skopje'),
  LYBE: city('Belgrad', 'Belgrade'),
  LYKV: city('Kraljevo', 'Kraljevo'),
  LYNI: city('Niş', 'Niš'),
  LYPG: city('Podgorica', 'Podgorica'),
  LYTV: city('Tivat', 'Tivat'),
  LZKZ: city('Košice', 'Košice'),
  OEGT: city('Kurayyat', 'Qurayyat'),
  OENN: city('Neom', 'Neom'),
  OERF: city('Rafha', 'Rafha'),
  OERR: city('Arar', 'Arar'),
  OESK: city('Sekaka', 'Sakakah'),
  OETB: city('Tebük', 'Tabuk'),
  OETR: city('Turaif', 'Turaif'),
  OIAA: city('Abadan', 'Abadan'),
  OIAD: city('Dezful', 'Dezful'),
  OIAM: city('Mahşehr', 'Mahshahr'),
  OIAW: city('Ahvaz', 'Ahvaz'),
  OICC: city('Kirmanşah', 'Kermanshah'),
  OICK: city('Hürremabad', 'Khorramabad'),
  OICS: city('Senendec', 'Sanandaj'),
  OIFK: city('Kaşan', 'Kashan'),
  OIFM: city('İsfahan', 'Isfahan'),
  OIGG: city('Reşt', 'Rasht'),
  OIHH: city('Hemedan', 'Hamadan'),
  OIIE: city('Tahran', 'Tehran'),
  OIII: city('Tahran', 'Tehran'),
  OIIP: city('Kerec', 'Karaj'),
  OINN: city('Nowshahr', 'Nowshahr'),
  OINR: city('Ramsar', 'Ramsar'),
  OINZ: city('Sari', 'Sari'),
  OITL: city('Erdebil', 'Ardabil'),
  OITR: city('Urmiye', 'Urmia'),
  OITT: city('Tebriz', 'Tabriz'),
  OJAI: city('Amman', 'Amman'),
  OJAM: city('Amman', 'Amman'),
  OJAQ: city('Akabe', 'Aqaba'),
  OKKK: city('Kuveyt', 'Kuwait City'),
  OLBA: city('Beyrut', 'Beirut'),
  ORBI: city('Bağdat', 'Baghdad'),
  ORER: city('Erbil', 'Erbil'),
  ORKK: city('Kerkük', 'Kirkuk'),
  ORMM: city('Basra', 'Basra'),
  ORNI: city('Necef', 'Najaf'),
  ORSJ: city('Süleymaniye', 'Sulaymaniyah'),
  OSAP: city('Halep', 'Aleppo'),
  OSDI: city('Şam', 'Damascus'),
  OSKL: city('Kamışlı', 'Qamishli'),
  OSLK: city('Lazkiye', 'Latakia'),
  UATE: city('Aktav', 'Aktau'),
  UBBB: city('Bakü', 'Baku'),
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
  URWA: city('Astrahan', 'Astrakhan'),
  URWI: city('Elista', 'Elista'),
  URWW: city('Volgograd', 'Volgograd'),
  UTAK: city('Türkmenbaşı', 'Turkmenbashi'),
  UTAN: city('Balkanabat', 'Balkanabat'),
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
