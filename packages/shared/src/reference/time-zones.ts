/**
 * Havalimanının saat dilimi (IANA tz veritabanı; kamu malı, D-084). OurAirports, VRS ve
 * aviationweather.gov saat dilimi vermez; dilim üç tablodan, şu sırayla bulunur:
 *
 * 1. `AIRPORT_TIME_ZONES`: havalimanına (ICAO) özgü kural. Bölgesi ikiye bölünen ya da bölge
 *    kodu dilimle örtüşmeyen havalimanları içindir (Ercan, Larnaka, Baf; Sohum).
 * 2. `REGION_TIME_ZONES`: ISO 3166-2 bölge koduna (OurAirports `iso_region`) göre kural; yalnızca
 *    birden çok dilimi olan ülkelerde (Rusya, Kazakistan …).
 * 3. `COUNTRY_TIME_ZONES`: tek dilimli ülkeler (tzdb `zone.tab`'da tek satırı olan 216 ülke) ve
 *    Kosova (XK tzdb'de yoktur; Belgrad saatini kullanır).
 *
 * Kural yoksa (çok dilimli ülkede kuralı yazılmamış bölge) null döner: dilim tahmin edilmez,
 * arayüz saatleri UTC ile yazıp öyle etiketler (D-106 (c), D-109; önce Türkiye saatiydi, D-080).
 * 5. halkanın adayları halka açılmadan kural taşır (D-109: 308 bölge ve 68 havalimanı kuralı, 30
 * ISO eşi; askerî listedeki üç alan hariç 2.028 aday, 225 dilim). Savaş nedeniyle kapalı 1.–4.
 * halka havalimanları (D-110) 33 bölge ve bir havalimanı kuralı ekledi; birim testi listelenen her
 * havalimanının bir dilimi olduğunu denetler. Gece içe aktarımı OurAirports'tan yeni bir bölge kodu
 * getirirse worker'ın içe aktarım günlüğü dilimsiz listelenen havalimanlarını sayar (D-109).
 *
 * Adlar `Intl`'in (ICU/CLDR) yazdığı biçimdedir (`Asia/Calcutta`, tzdb'de `Asia/Kolkata`'ya
 * bağlantı): her tarayıcı bunları tanır. Ofset koda gömülmez; yaz saati dahil her an için `Intl`
 * hesaplar. Tablo çalışma zamanında hiçbir yerden çekilmez. Havalimanı sayfasında farkları sunucu
 * hesaplar ve sayfaya yazar (`utcOffsetTable`, D-109): tarayıcının tz verisi eski olsa da
 * (Britanya Kolumbiyası 2026b, Kazakistan 2024a) sayfa sunucunun saatini gösterir, hidrasyon farkı
 * olmaz.
 *
 * ¹ Orta güvenli kural (çevrimdışı doğrulanamadı; ACTIVATION'da denetlenir, D-109): CYPL ve CYAQ;
 * bölge varsayılanıyla SBTT (America/Manaus).
 */

import { isSupportedTimeZone } from '../weather/time'

/** Tek dilimli ülkeler, ISO 3166-1 alpha-2 → IANA dilimi (`Intl.Locale#getTimeZones()` ile aynı). */
export const COUNTRY_TIME_ZONES: Readonly<Record<string, string>> = {
  AD: 'Europe/Andorra',
  AE: 'Asia/Dubai',
  AF: 'Asia/Kabul',
  AG: 'America/Antigua',
  AI: 'America/Anguilla',
  AL: 'Europe/Tirane',
  AM: 'Asia/Yerevan',
  AO: 'Africa/Luanda',
  AS: 'Pacific/Pago_Pago',
  AT: 'Europe/Vienna',
  AW: 'America/Aruba',
  AX: 'Europe/Mariehamn',
  AZ: 'Asia/Baku',
  BA: 'Europe/Sarajevo',
  BB: 'America/Barbados',
  BD: 'Asia/Dhaka',
  BE: 'Europe/Brussels',
  BF: 'Africa/Ouagadougou',
  BG: 'Europe/Sofia',
  BH: 'Asia/Bahrain',
  BI: 'Africa/Bujumbura',
  BJ: 'Africa/Porto-Novo',
  BL: 'America/St_Barthelemy',
  BM: 'Atlantic/Bermuda',
  BN: 'Asia/Brunei',
  BO: 'America/La_Paz',
  BQ: 'America/Kralendijk',
  BS: 'America/Nassau',
  BT: 'Asia/Thimphu',
  BW: 'Africa/Gaborone',
  BY: 'Europe/Minsk',
  BZ: 'America/Belize',
  CC: 'Indian/Cocos',
  CF: 'Africa/Bangui',
  CG: 'Africa/Brazzaville',
  CH: 'Europe/Zurich',
  CI: 'Africa/Abidjan',
  CK: 'Pacific/Rarotonga',
  CM: 'Africa/Douala',
  CO: 'America/Bogota',
  CR: 'America/Costa_Rica',
  CU: 'America/Havana',
  CV: 'Atlantic/Cape_Verde',
  CW: 'America/Curacao',
  CX: 'Indian/Christmas',
  CZ: 'Europe/Prague',
  DJ: 'Africa/Djibouti',
  DK: 'Europe/Copenhagen',
  DM: 'America/Dominica',
  DO: 'America/Santo_Domingo',
  DZ: 'Africa/Algiers',
  EE: 'Europe/Tallinn',
  EG: 'Africa/Cairo',
  EH: 'Africa/El_Aaiun',
  ER: 'Africa/Asmera',
  ET: 'Africa/Addis_Ababa',
  FI: 'Europe/Helsinki',
  FJ: 'Pacific/Fiji',
  FK: 'Atlantic/Stanley',
  FO: 'Atlantic/Faeroe',
  FR: 'Europe/Paris',
  GA: 'Africa/Libreville',
  GB: 'Europe/London',
  GD: 'America/Grenada',
  GE: 'Asia/Tbilisi',
  GF: 'America/Cayenne',
  GG: 'Europe/Guernsey',
  GH: 'Africa/Accra',
  GI: 'Europe/Gibraltar',
  GM: 'Africa/Banjul',
  GN: 'Africa/Conakry',
  GP: 'America/Guadeloupe',
  GQ: 'Africa/Malabo',
  GR: 'Europe/Athens',
  GS: 'Atlantic/South_Georgia',
  GT: 'America/Guatemala',
  GU: 'Pacific/Guam',
  GW: 'Africa/Bissau',
  GY: 'America/Guyana',
  HK: 'Asia/Hong_Kong',
  HN: 'America/Tegucigalpa',
  HR: 'Europe/Zagreb',
  HT: 'America/Port-au-Prince',
  HU: 'Europe/Budapest',
  IE: 'Europe/Dublin',
  IL: 'Asia/Jerusalem',
  IM: 'Europe/Isle_of_Man',
  IN: 'Asia/Calcutta',
  IO: 'Indian/Chagos',
  IQ: 'Asia/Baghdad',
  IR: 'Asia/Tehran',
  IS: 'Atlantic/Reykjavik',
  IT: 'Europe/Rome',
  JE: 'Europe/Jersey',
  JM: 'America/Jamaica',
  JO: 'Asia/Amman',
  JP: 'Asia/Tokyo',
  KE: 'Africa/Nairobi',
  KG: 'Asia/Bishkek',
  KH: 'Asia/Phnom_Penh',
  KM: 'Indian/Comoro',
  KN: 'America/St_Kitts',
  KP: 'Asia/Pyongyang',
  KR: 'Asia/Seoul',
  KW: 'Asia/Kuwait',
  KY: 'America/Cayman',
  LA: 'Asia/Vientiane',
  LB: 'Asia/Beirut',
  LC: 'America/St_Lucia',
  LI: 'Europe/Vaduz',
  LK: 'Asia/Colombo',
  LR: 'Africa/Monrovia',
  LS: 'Africa/Maseru',
  LT: 'Europe/Vilnius',
  LU: 'Europe/Luxembourg',
  LV: 'Europe/Riga',
  LY: 'Africa/Tripoli',
  MA: 'Africa/Casablanca',
  MC: 'Europe/Monaco',
  MD: 'Europe/Chisinau',
  ME: 'Europe/Podgorica',
  MF: 'America/Marigot',
  MG: 'Indian/Antananarivo',
  MK: 'Europe/Skopje',
  ML: 'Africa/Bamako',
  MM: 'Asia/Rangoon',
  MO: 'Asia/Macau',
  MP: 'Pacific/Saipan',
  MQ: 'America/Martinique',
  MR: 'Africa/Nouakchott',
  MS: 'America/Montserrat',
  MT: 'Europe/Malta',
  MU: 'Indian/Mauritius',
  MV: 'Indian/Maldives',
  MW: 'Africa/Blantyre',
  MZ: 'Africa/Maputo',
  NA: 'Africa/Windhoek',
  NC: 'Pacific/Noumea',
  NE: 'Africa/Niamey',
  NF: 'Pacific/Norfolk',
  NG: 'Africa/Lagos',
  NI: 'America/Managua',
  NL: 'Europe/Amsterdam',
  NO: 'Europe/Oslo',
  NP: 'Asia/Katmandu',
  NR: 'Pacific/Nauru',
  NU: 'Pacific/Niue',
  OM: 'Asia/Muscat',
  PA: 'America/Panama',
  PE: 'America/Lima',
  PH: 'Asia/Manila',
  PK: 'Asia/Karachi',
  PL: 'Europe/Warsaw',
  PM: 'America/Miquelon',
  PN: 'Pacific/Pitcairn',
  PR: 'America/Puerto_Rico',
  PW: 'Pacific/Palau',
  PY: 'America/Asuncion',
  QA: 'Asia/Qatar',
  RE: 'Indian/Reunion',
  RO: 'Europe/Bucharest',
  RS: 'Europe/Belgrade',
  RW: 'Africa/Kigali',
  SA: 'Asia/Riyadh',
  SB: 'Pacific/Guadalcanal',
  SC: 'Indian/Mahe',
  SD: 'Africa/Khartoum',
  SE: 'Europe/Stockholm',
  SG: 'Asia/Singapore',
  SH: 'Atlantic/St_Helena',
  SI: 'Europe/Ljubljana',
  SJ: 'Arctic/Longyearbyen',
  SK: 'Europe/Bratislava',
  SL: 'Africa/Freetown',
  SM: 'Europe/San_Marino',
  SN: 'Africa/Dakar',
  SO: 'Africa/Mogadishu',
  SR: 'America/Paramaribo',
  SS: 'Africa/Juba',
  ST: 'Africa/Sao_Tome',
  SV: 'America/El_Salvador',
  SX: 'America/Lower_Princes',
  SY: 'Asia/Damascus',
  SZ: 'Africa/Mbabane',
  TC: 'America/Grand_Turk',
  TD: 'Africa/Ndjamena',
  TF: 'Indian/Kerguelen',
  TG: 'Africa/Lome',
  TH: 'Asia/Bangkok',
  TJ: 'Asia/Dushanbe',
  TK: 'Pacific/Fakaofo',
  TL: 'Asia/Dili',
  TM: 'Asia/Ashgabat',
  TN: 'Africa/Tunis',
  TO: 'Pacific/Tongatapu',
  TR: 'Europe/Istanbul',
  TT: 'America/Port_of_Spain',
  TV: 'Pacific/Funafuti',
  TW: 'Asia/Taipei',
  TZ: 'Africa/Dar_es_Salaam',
  UG: 'Africa/Kampala',
  UY: 'America/Montevideo',
  VA: 'Europe/Vatican',
  VC: 'America/St_Vincent',
  VE: 'America/Caracas',
  VG: 'America/Tortola',
  VI: 'America/St_Thomas',
  VN: 'Asia/Saigon',
  VU: 'Pacific/Efate',
  WF: 'Pacific/Wallis',
  WS: 'Pacific/Apia',
  YE: 'Asia/Aden',
  YT: 'Indian/Mayotte',
  ZA: 'Africa/Johannesburg',
  ZM: 'Africa/Lusaka',
  ZW: 'Africa/Harare',
  // tzdb'de olmayan kullanıcı tanımlı kod: Kosova Belgrad saatini kullanır.
  XK: 'Europe/Belgrade',
}

/**
 * Çok dilimli ülkelerde bölge (ISO 3166-2, OurAirports `iso_region`) → dilim. Halkaların
 * gerektirdiği bölgeler (3. halka 49 kural ekledi, D-090; 4. halka 93, D-101; 5. halka 308 kural
 * ve 30 ISO eşi, D-109; savaş nedeniyle kapalı havalimanları 33, D-110; 5. halkanın ülkeleri
 * satırların üstündeki açıklamalardadır):
 * - Rusya: Kuzey Kafkasya, Krasnodar, Rostov ve Kalmukya Moskova saatidir; Volgograd kendi
 *   dilimidir (Moskova kuralları); Astrahan UTC+4'tür. 3. halkada Moskova şehri ve bölgesi,
 *   Voronej, Penza, Mordovya, Nijniy Novgorod, İvanovo, Tataristan, Çuvaşistan, Yaroslavl, Kostroma,
 *   Pskov ve Vologda Moskova saatidir (UTC+3); Samara ve Udmurtya Europe/Samara, Saratov
 *   Europe/Saratov, Ulyanovsk Europe/Ulyanovsk (UTC+4); Orenburg ve Başkurdistan Asia/Yekaterinburg
 *   (UTC+5); Kaliningrad Europe/Kaliningrad (UTC+2). 4. halkada kuzeybatı (Sankt-Peterburg,
 *   Karelya, Murmansk, Arhangelsk, Nenetsya, Komi) Moskova saati, Kirov Europe/Kirov (UTC+3); Ural
 *   ve Batı Sibirya'nın kuzeyi (Perm, Sverdlovsk, Çelyabinsk, Kurgan, Tümen, Hantı-Mansi, Yamalo-
 *   Nenets) Asia/Yekaterinburg (UTC+5); Omsk Asia/Omsk (UTC+6); Novosibirsk, Tomsk, Altay Krayı
 *   (Barnaul), Kemerovo (Novokuznetsk) ve Krasnoyarsk, Hakasya, Tuva kendi dilimleri (UTC+7);
 *   İrkutsk ve Buryatya Asia/Irkutsk (UTC+8). Savaş nedeniyle kapalı havalimanlarının bölgeleri
 *   (D-110): Belgorod, Bryansk, Kursk ve Lipetsk Moskova saatidir.
 * - Ukrayna (D-110): tzdb `zone.tab`'a göre Kırım (UA-43) ve Sivastopol (UA-40)
 *   Europe/Simferopol (bütün yıl UTC+3), öbür bölgeler Kiev saati (UTC+2, yazın UTC+3). Ad
 *   `Intl`'in yazımıdır: Europe/Kiev (tzdb'de Europe/Kyiv; ICU `resolvedOptions()` onu Europe/Kiev
 *   verir). İşgal altındaki bölgeler tzdb'de Europe/Kyiv'dedir; oralarda listelenen havalimanı yok.
 *   Ülkenin 27 ISO kodunun hepsi ve OurAirports'un Rivne kodu (UA-19; ISO UA-56) yazılıdır;
 *   OurAirports kodu değiştirirse dilim kaybolmaz. Harkiv'in OurAirports bölgesi "atanmamış"tır
 *   (UA-U-A): havalimanı kuralı (UKHH).
 * - Kazakistan: 2024-03-01'den beri bütün ülke UTC+5'tir; tzdb dilimleri ayrı tutar. Mangistav
 *   (Aktav), 3. halkada Atırav, Batı Kazakistan (Oral), Aktöbe, Kızılorda ve Baykonur
 *   (Asia/Qyzylorda; Baykonur Rusya'ya kiralıdır ama OurAirports ve ISO'da Kazakistan'dır). 4.
 *   halkada doğu ve kuzey Asia/Almaty, Kostanay Asia/Qostanay. OurAirports kendi harf kodlarını
 *   kullanır: ISO 3166-2'nin 2020 öncesi harf kodları, 2022'de kurulan üç bölge için ISO'da
 *   olmayan kendi kodları (KZ-ABA Abay, KZ-JET Jetisu, KZ-ULY Ulıtav) ve Baykonur (KZ-BAY). ISO
 *   3166-2:KZ 2020'den beri sayısaldır (17 bölge ve 3 şehir: KZ-11 Akmola … KZ-79 Şımkent; 2022
 *   bölgeleri KZ-10, KZ-33, KZ-62). Çin'deki gibi ISO kodları da aynı dilimle yazılıdır:
 *   OurAirports kodları değiştirirse dilim kaybolmaz. Tarifeli havalimanı olmayan Almatı bölgesi
 *   (KZ-ALM) de tablodadır; Kazakistan'ın her bölgesinin kuralı var.
 * - Çin (4. halka): Sincan, Tibet, Gansu ve Qinghai Asia/Shanghai, yani Pekin saati (UTC+8).
 *   tzdb'nin Asia/Urumqi'si (UTC+6) resmî değildir; tarifeler ve havalimanları Pekin saatini
 *   kullanır, Asia/Urumqi seçilseydi Sincan'daki her saat 2 saat kayardı. OurAirports Çin'de eski
 *   sayısal bölge kodlarını kullanır (CN-65 Sincan); ISO 3166-2'nin 2017'den beri geçerli harf
 *   kodları da (CN-XJ) aynı kuralla yazılıdır: OurAirports kodları değiştirirse dilim kaybolmaz.
 * - Moğolistan (4. halka): Asia/Hovd (UTC+7) yalnız Bayan-Ölgii (MN-071), Hovd (MN-043) ve Uvs
 *   (MN-046); Govi-Altay (MN-065) dahil öbür bölgeler Asia/Ulaanbaatar (UTC+8), tzdb
 *   `zone1970.tab`'ın bugünkü yorumu.
 * - Kongo Demokratik Cumhuriyeti (4. halka): batı Africa/Kinshasa (UTC+1), doğu Africa/Lubumbashi
 *   (UTC+2; Goma, Bukavu, Kisangani; Güney Kivu CD-SK Bukavu'yla eklendi, D-110).
 * - Portekiz (4. halka): anakara Europe/Lisbon, Azorlar Atlantic/Azores, Madeira Atlantic/Madeira.
 * - Almanya (Europe/Berlin ve Büsingen; Büsingen'de havalimanı yok), İspanya (Kanarya
 *   Atlantic/Canary, Ceuta ve Melilla Africa/Ceuta, öbür bölgeler Europe/Madrid) ve Özbekistan
 *   (batı Asia/Samarkand, doğu Asia/Tashkent; ikisi de 1992'den beri UTC+5).
 */
export const REGION_TIME_ZONES: Readonly<Record<string, string>> = {
  // Arjantin (5. halka): bütün ülke UTC−3, yaz saati yok. tzdb il dilimlerini ayrı tutar;
  // zone.tab'ın il harfleri ISO 3166-2:AR harfleriyle eşlenmiştir (aynı farklar).
  'AR-A': 'America/Argentina/Salta',
  'AR-B': 'America/Buenos_Aires',
  'AR-C': 'America/Buenos_Aires',
  'AR-D': 'America/Argentina/San_Luis',
  'AR-E': 'America/Cordoba',
  'AR-F': 'America/Argentina/La_Rioja',
  'AR-G': 'America/Cordoba',
  'AR-H': 'America/Cordoba',
  'AR-J': 'America/Argentina/San_Juan',
  'AR-K': 'America/Catamarca',
  'AR-L': 'America/Argentina/Salta',
  'AR-M': 'America/Mendoza',
  'AR-N': 'America/Cordoba',
  'AR-P': 'America/Cordoba',
  'AR-Q': 'America/Argentina/Salta',
  'AR-R': 'America/Argentina/Salta',
  'AR-S': 'America/Cordoba',
  'AR-T': 'America/Argentina/Tucuman',
  'AR-U': 'America/Catamarca',
  'AR-V': 'America/Argentina/Ushuaia',
  'AR-W': 'America/Cordoba',
  'AR-X': 'America/Cordoba',
  'AR-Y': 'America/Jujuy',
  'AR-Z': 'America/Argentina/Rio_Gallegos',
  // Avustralya (5. halka): eyalet ve bölge başına. Broken Hill (YBHI) havalimanı kuralıyla
  // Australia/Broken_Hill (Güney Avustralya saati), Hamilton Adası (YBHM) Australia/Lindeman.
  'AU-ACT': 'Australia/Sydney',
  'AU-NSW': 'Australia/Sydney',
  'AU-NT': 'Australia/Darwin',
  'AU-QLD': 'Australia/Brisbane',
  'AU-SA': 'Australia/Adelaide',
  'AU-TAS': 'Australia/Hobart',
  'AU-VIC': 'Australia/Melbourne',
  'AU-WA': 'Australia/Perth',
  // Brezilya (5. halka): 27 federal birim, zone.tab açıklamalarıyla. Fernando de Noronha
  // (SBFN) ve batı Pará (SBSN, SBIH, SBTB) havalimanı kuralıyla; Tabatinga (SBTT) Amazonas'ın
  // varsayılanıdır (America/Manaus, UTC−4; ¹: tzdb 2021a Tabatinga'yı doğu-batı ayrım çizgisinin
  // ucu olarak anar, iki listede de saymaz; batı listesi eksiktir, 2013 yasası 13 belediye der;
  // çevrimdışı kanıt iki yöne de yetmez, çizgi üstündeki nokta için bölge varsayılanı seçildi).
  'BR-AC': 'America/Rio_Branco',
  'BR-AL': 'America/Maceio',
  'BR-AM': 'America/Manaus',
  'BR-AP': 'America/Belem',
  'BR-BA': 'America/Bahia',
  'BR-CE': 'America/Fortaleza',
  'BR-DF': 'America/Sao_Paulo',
  'BR-ES': 'America/Sao_Paulo',
  'BR-GO': 'America/Sao_Paulo',
  'BR-MA': 'America/Fortaleza',
  'BR-MG': 'America/Sao_Paulo',
  'BR-MS': 'America/Campo_Grande',
  'BR-MT': 'America/Cuiaba',
  'BR-PA': 'America/Belem',
  'BR-PB': 'America/Fortaleza',
  'BR-PE': 'America/Recife',
  'BR-PI': 'America/Fortaleza',
  'BR-PR': 'America/Sao_Paulo',
  'BR-RJ': 'America/Sao_Paulo',
  'BR-RN': 'America/Fortaleza',
  'BR-RO': 'America/Porto_Velho',
  'BR-RR': 'America/Boa_Vista',
  'BR-RS': 'America/Sao_Paulo',
  'BR-SC': 'America/Sao_Paulo',
  'BR-SE': 'America/Maceio',
  'BR-SP': 'America/Sao_Paulo',
  'BR-TO': 'America/Araguaina',
  // Kanada (5. halka): 13 eyalet ve bölge; tzdb 2023 Yellowknife, Thunder Bay, Nipigon ve
  // Montreal'i birleştirdi. Bölgeyi bölen 20 havalimanı (Labrador, Kuzeybatı Ontario, Nunavut'un
  // batısı, Aşağı Kuzey Kıyısı, Magdalen Adaları, Fort St John, Fort Nelson, Cranbrook) havalimanı
  // kuralıyla.
  'CA-AB': 'America/Edmonton',
  'CA-BC': 'America/Vancouver',
  'CA-MB': 'America/Winnipeg',
  'CA-NB': 'America/Moncton',
  'CA-NL': 'America/St_Johns',
  'CA-NS': 'America/Halifax',
  'CA-NT': 'America/Edmonton',
  'CA-NU': 'America/Iqaluit',
  'CA-ON': 'America/Toronto',
  'CA-PE': 'America/Halifax',
  'CA-QC': 'America/Toronto',
  'CA-SK': 'America/Regina',
  'CA-YT': 'America/Whitehorse',
  // Kongo DC: batı Kinşasa (UTC+1), doğu Lubumbaşi (UTC+2; 5. halkada Lubumbaşi ve Kolwezi).
  'CD-EQ': 'Africa/Kinshasa',
  'CD-HK': 'Africa/Lubumbashi',
  'CD-HU': 'Africa/Lubumbashi',
  'CD-IT': 'Africa/Lubumbashi',
  'CD-KC': 'Africa/Lubumbashi',
  'CD-KE': 'Africa/Lubumbashi',
  'CD-KL': 'Africa/Kinshasa',
  'CD-KN': 'Africa/Kinshasa',
  'CD-LU': 'Africa/Lubumbashi',
  'CD-MA': 'Africa/Lubumbashi',
  'CD-NK': 'Africa/Lubumbashi',
  'CD-NU': 'Africa/Kinshasa',
  'CD-SK': 'Africa/Lubumbashi',
  'CD-SU': 'Africa/Kinshasa',
  'CD-TA': 'Africa/Lubumbashi',
  'CD-TO': 'Africa/Lubumbashi',
  // Şili (5. halka): Santiago; Magallanes America/Punta_Arenas; Aysén da America/Punta_Arenas
  // (tzdb 2025b'nin America/Coyhaique'siyle aynı farklar, UTC−3; eski tarayıcılar da tanır).
  // Paskalya Adası OurAirports'ta CL-VS'dedir: havalimanı kuralı (SCIP).
  'CL-AI': 'America/Punta_Arenas',
  'CL-AN': 'America/Santiago',
  'CL-AP': 'America/Santiago',
  'CL-AR': 'America/Santiago',
  'CL-AT': 'America/Santiago',
  'CL-BI': 'America/Santiago',
  'CL-CO': 'America/Santiago',
  'CL-LL': 'America/Santiago',
  'CL-LR': 'America/Santiago',
  'CL-MA': 'America/Punta_Arenas',
  'CL-RM': 'America/Santiago',
  'CL-TA': 'America/Santiago',
  'CL-VS': 'America/Santiago',
  // Çin: Pekin saati. OurAirports'un sayısal kodu (4. halkada Tibet 54, Gansu 62, Qinghai 63,
  // Sincan 65; 5. halkada öbür 27 il) ve ISO 3166-2 harf kodu (XZ, GS, QH, XJ; 5. halkada BJ … NX)
  // ikisi de yazılıdır. tzdb'nin Asia/Urumqi'si seçilmez (D-101).
  'CN-11': 'Asia/Shanghai',
  'CN-12': 'Asia/Shanghai',
  'CN-13': 'Asia/Shanghai',
  'CN-14': 'Asia/Shanghai',
  'CN-15': 'Asia/Shanghai',
  'CN-21': 'Asia/Shanghai',
  'CN-22': 'Asia/Shanghai',
  'CN-23': 'Asia/Shanghai',
  'CN-31': 'Asia/Shanghai',
  'CN-32': 'Asia/Shanghai',
  'CN-33': 'Asia/Shanghai',
  'CN-34': 'Asia/Shanghai',
  'CN-35': 'Asia/Shanghai',
  'CN-36': 'Asia/Shanghai',
  'CN-37': 'Asia/Shanghai',
  'CN-41': 'Asia/Shanghai',
  'CN-42': 'Asia/Shanghai',
  'CN-43': 'Asia/Shanghai',
  'CN-44': 'Asia/Shanghai',
  'CN-45': 'Asia/Shanghai',
  'CN-46': 'Asia/Shanghai',
  'CN-50': 'Asia/Shanghai',
  'CN-51': 'Asia/Shanghai',
  'CN-52': 'Asia/Shanghai',
  'CN-53': 'Asia/Shanghai',
  'CN-54': 'Asia/Shanghai',
  'CN-61': 'Asia/Shanghai',
  'CN-62': 'Asia/Shanghai',
  'CN-63': 'Asia/Shanghai',
  'CN-64': 'Asia/Shanghai',
  'CN-65': 'Asia/Shanghai',
  'CN-AH': 'Asia/Shanghai', // ISO; OurAirports CN-34
  'CN-BJ': 'Asia/Shanghai', // ISO; OurAirports CN-11
  'CN-CQ': 'Asia/Shanghai', // ISO; OurAirports CN-50
  'CN-FJ': 'Asia/Shanghai', // ISO; OurAirports CN-35
  'CN-GD': 'Asia/Shanghai', // ISO; OurAirports CN-44
  'CN-GS': 'Asia/Shanghai',
  'CN-GX': 'Asia/Shanghai', // ISO; OurAirports CN-45
  'CN-GZ': 'Asia/Shanghai', // ISO; OurAirports CN-52
  'CN-HA': 'Asia/Shanghai', // ISO; OurAirports CN-41
  'CN-HB': 'Asia/Shanghai', // ISO; OurAirports CN-42
  'CN-HE': 'Asia/Shanghai', // ISO; OurAirports CN-13
  'CN-HI': 'Asia/Shanghai', // ISO; OurAirports CN-46
  'CN-HL': 'Asia/Shanghai', // ISO; OurAirports CN-23
  'CN-HN': 'Asia/Shanghai', // ISO; OurAirports CN-43
  'CN-JL': 'Asia/Shanghai', // ISO; OurAirports CN-22
  'CN-JS': 'Asia/Shanghai', // ISO; OurAirports CN-32
  'CN-JX': 'Asia/Shanghai', // ISO; OurAirports CN-36
  'CN-LN': 'Asia/Shanghai', // ISO; OurAirports CN-21
  'CN-NM': 'Asia/Shanghai', // ISO; OurAirports CN-15
  'CN-NX': 'Asia/Shanghai', // ISO; OurAirports CN-64
  'CN-QH': 'Asia/Shanghai',
  'CN-SC': 'Asia/Shanghai', // ISO; OurAirports CN-51
  'CN-SD': 'Asia/Shanghai', // ISO; OurAirports CN-37
  'CN-SH': 'Asia/Shanghai', // ISO; OurAirports CN-31
  'CN-SN': 'Asia/Shanghai', // ISO; OurAirports CN-61
  'CN-SX': 'Asia/Shanghai', // ISO; OurAirports CN-14
  'CN-TJ': 'Asia/Shanghai', // ISO; OurAirports CN-12
  'CN-XJ': 'Asia/Shanghai',
  'CN-XZ': 'Asia/Shanghai',
  'CN-YN': 'Asia/Shanghai', // ISO; OurAirports CN-53
  'CN-ZJ': 'Asia/Shanghai', // ISO; OurAirports CN-33
  // Almanya'nın 16 eyaleti; Brandenburg OurAirports'ta DE-BR'dir (ISO kodu DE-BB, ikisi de yazılı).
  'DE-BB': 'Europe/Berlin',
  'DE-BE': 'Europe/Berlin',
  'DE-BR': 'Europe/Berlin',
  'DE-BW': 'Europe/Berlin',
  'DE-BY': 'Europe/Berlin',
  'DE-HB': 'Europe/Berlin',
  'DE-HE': 'Europe/Berlin',
  'DE-HH': 'Europe/Berlin',
  'DE-MV': 'Europe/Berlin',
  'DE-NI': 'Europe/Berlin',
  'DE-NW': 'Europe/Berlin',
  'DE-RP': 'Europe/Berlin',
  'DE-SH': 'Europe/Berlin',
  'DE-SL': 'Europe/Berlin',
  'DE-SN': 'Europe/Berlin',
  'DE-ST': 'Europe/Berlin',
  'DE-TH': 'Europe/Berlin',
  // Ekvador (5. halka): anakara Guayaquil, Galápagos Pacific/Galapagos. OurAirports Santa Elena'yı
  // EC-25 yazar (ISO EC-SE, ikisi de yazılı).
  'EC-25': 'America/Guayaquil',
  'EC-A': 'America/Guayaquil',
  'EC-C': 'America/Guayaquil',
  'EC-D': 'America/Guayaquil',
  'EC-E': 'America/Guayaquil',
  'EC-G': 'America/Guayaquil',
  'EC-M': 'America/Guayaquil',
  'EC-O': 'America/Guayaquil',
  'EC-P': 'America/Guayaquil',
  'EC-S': 'America/Guayaquil',
  'EC-SE': 'America/Guayaquil', // ISO; OurAirports EC-25
  'EC-W': 'Pacific/Galapagos',
  'EC-X': 'America/Guayaquil',
  // İspanya: anakara ve Balear Adaları Europe/Madrid, Kanarya Atlantic/Canary, Melilla Africa/Ceuta.
  'ES-AN': 'Europe/Madrid',
  'ES-AR': 'Europe/Madrid',
  'ES-AS': 'Europe/Madrid',
  'ES-CB': 'Europe/Madrid',
  'ES-CL': 'Europe/Madrid',
  'ES-CN': 'Atlantic/Canary',
  'ES-CT': 'Europe/Madrid',
  'ES-EX': 'Europe/Madrid',
  'ES-GA': 'Europe/Madrid',
  'ES-IB': 'Europe/Madrid',
  'ES-MC': 'Europe/Madrid',
  'ES-MD': 'Europe/Madrid',
  'ES-ML': 'Africa/Ceuta',
  'ES-NC': 'Europe/Madrid',
  'ES-PV': 'Europe/Madrid',
  'ES-RI': 'Europe/Madrid',
  'ES-VC': 'Europe/Madrid',
  // Mikronezya (5. halka): Kosrae, Pohnpei (ICU Pacific/Ponape), Chuuk ve Yap (Pacific/Truk).
  'FM-KSA': 'Pacific/Kosrae',
  'FM-PNI': 'Pacific/Ponape',
  'FM-TRK': 'Pacific/Truk',
  'FM-YAP': 'Pacific/Truk',
  // Grönland (5. halka): dört bölge Nuuk saati (ICU America/Godthab). GL-SE kuralsız kalır (BGCO
  // ve BGKK farklı dilimde; Nuuk BGGH havalimanı kuralıyla).
  'GL-AV': 'America/Godthab',
  'GL-KU': 'America/Godthab',
  'GL-QA': 'America/Godthab',
  'GL-QK': 'America/Godthab',
  // Endonezya (5. halka): batı Jakarta, Batı ve Orta Kalimantan Pontianak, orta Makassar, Papua
  // eyaletleri Jayapura. OurAirports Highland Papua'yı ID-PP yazar (ISO ID-PE, ikisi de yazılı).
  'ID-AC': 'Asia/Jakarta',
  'ID-BA': 'Asia/Makassar',
  'ID-BB': 'Asia/Jakarta',
  'ID-BE': 'Asia/Jakarta',
  'ID-BT': 'Asia/Jakarta',
  'ID-JB': 'Asia/Jakarta',
  'ID-JI': 'Asia/Jakarta',
  'ID-JK': 'Asia/Jakarta',
  'ID-JT': 'Asia/Jakarta',
  'ID-KB': 'Asia/Pontianak',
  'ID-KI': 'Asia/Makassar',
  'ID-KR': 'Asia/Jakarta',
  'ID-KS': 'Asia/Makassar',
  'ID-KT': 'Asia/Pontianak',
  'ID-KU': 'Asia/Makassar',
  'ID-LA': 'Asia/Jakarta',
  'ID-MA': 'Asia/Jayapura',
  'ID-MU': 'Asia/Jayapura',
  'ID-NB': 'Asia/Makassar',
  'ID-NT': 'Asia/Makassar',
  'ID-PA': 'Asia/Jayapura',
  'ID-PB': 'Asia/Jayapura',
  'ID-PE': 'Asia/Jayapura', // ISO; OurAirports ID-PP
  'ID-PP': 'Asia/Jayapura',
  'ID-PS': 'Asia/Jayapura',
  'ID-PT': 'Asia/Jayapura',
  'ID-RI': 'Asia/Jakarta',
  'ID-SA': 'Asia/Makassar',
  'ID-SB': 'Asia/Jakarta',
  'ID-SG': 'Asia/Makassar',
  'ID-SN': 'Asia/Makassar',
  'ID-SS': 'Asia/Jakarta',
  'ID-ST': 'Asia/Makassar',
  'ID-SU': 'Asia/Jakarta',
  'ID-YO': 'Asia/Jakarta',
  // Kiribati (5. halka): Gilbert Adaları Tarawa, Line Adaları Kiritimati (UTC+14).
  'KI-G': 'Pacific/Tarawa',
  'KI-L': 'Pacific/Kiritimati',
  // Kazakistan: bütün ülke UTC+5 (2024); tzdb dilimleri ayrı. ISO 3166-2:KZ'nin sayısal kodları
  // (2020'den beri; 10, 33 ve 62 2022 bölgeleri), sonra OurAirports'un harf kodları (ABA, JET, ULY
  // 2022 bölgeleri için OurAirports'un kendi kodları, ISO'da yok).
  'KZ-10': 'Asia/Almaty', // Abay (KZ-ABA)
  'KZ-11': 'Asia/Almaty', // Akmola (KZ-AKM)
  'KZ-15': 'Asia/Aqtobe', // Aktöbe (KZ-AKT)
  'KZ-19': 'Asia/Almaty', // Almatı bölgesi (KZ-ALM)
  'KZ-23': 'Asia/Atyrau', // Atırav (KZ-ATY)
  'KZ-27': 'Asia/Oral', // Batı Kazakistan (KZ-ZAP)
  'KZ-31': 'Asia/Almaty', // Jambıl (KZ-ZHA)
  'KZ-33': 'Asia/Almaty', // Jetisu (KZ-JET)
  'KZ-35': 'Asia/Almaty', // Karağandı (KZ-KAR)
  'KZ-39': 'Asia/Qostanay', // Kostanay (KZ-KUS)
  'KZ-43': 'Asia/Qyzylorda', // Kızılorda (KZ-KZY; Baykonur KZ-BAY bu bölgededir)
  'KZ-47': 'Asia/Aqtau', // Mangistav (KZ-MAN)
  'KZ-55': 'Asia/Almaty', // Pavlodar (KZ-PAV)
  'KZ-59': 'Asia/Almaty', // Kuzey Kazakistan (KZ-SEV)
  'KZ-61': 'Asia/Almaty', // Türkistan (KZ-YUZ)
  'KZ-62': 'Asia/Almaty', // Ulıtav (KZ-ULY)
  'KZ-63': 'Asia/Almaty', // Doğu Kazakistan (KZ-VOS)
  'KZ-71': 'Asia/Almaty', // Astana şehri (KZ-AST)
  'KZ-75': 'Asia/Almaty', // Almatı şehri (KZ-ALA)
  'KZ-79': 'Asia/Almaty', // Şımkent şehri (OurAirports'ta Türkistan, KZ-YUZ)
  'KZ-ABA': 'Asia/Almaty',
  'KZ-AKM': 'Asia/Almaty',
  'KZ-AKT': 'Asia/Aqtobe',
  'KZ-ALA': 'Asia/Almaty',
  'KZ-ALM': 'Asia/Almaty',
  'KZ-AST': 'Asia/Almaty',
  'KZ-ATY': 'Asia/Atyrau',
  'KZ-BAY': 'Asia/Qyzylorda',
  'KZ-JET': 'Asia/Almaty',
  'KZ-KAR': 'Asia/Almaty',
  'KZ-KUS': 'Asia/Qostanay',
  'KZ-KZY': 'Asia/Qyzylorda',
  'KZ-MAN': 'Asia/Aqtau',
  'KZ-PAV': 'Asia/Almaty',
  'KZ-SEV': 'Asia/Almaty',
  'KZ-ULY': 'Asia/Almaty',
  'KZ-VOS': 'Asia/Almaty',
  'KZ-YUZ': 'Asia/Almaty',
  'KZ-ZAP': 'Asia/Oral',
  'KZ-ZHA': 'Asia/Almaty',
  // Marshall Adaları (5. halka): Majuro. Kwajalein'in tek adayı askerî listededir (PKWA, D-109).
  'MH-MAJ': 'Pacific/Majuro',
  // Moğolistan: batının üç bölgesi Hovd (UTC+7), öbürleri Ulan Batur (UTC+8; 5. halkada Dornod,
  // tzdb'nin Asia/Choibalsan'ı artık bağlantıdır).
  'MN-041': 'Asia/Ulaanbaatar',
  'MN-043': 'Asia/Hovd',
  'MN-046': 'Asia/Hovd',
  'MN-047': 'Asia/Ulaanbaatar',
  'MN-053': 'Asia/Ulaanbaatar',
  'MN-055': 'Asia/Ulaanbaatar',
  'MN-061': 'Asia/Ulaanbaatar',
  'MN-065': 'Asia/Ulaanbaatar',
  'MN-067': 'Asia/Ulaanbaatar',
  'MN-069': 'Asia/Ulaanbaatar',
  'MN-071': 'Asia/Hovd',
  // Meksika (5. halka): 2022 yasasından beri yaz saati yalnız ABD sınırında. OurAirports México
  // City'yi MX-DIF yazar (ISO MX-CMX, ikisi de yazılı). Sınır kentleri (Ciudad Juárez, Piedras
  // Negras, Nuevo Laredo, Reynosa, Matamoros) havalimanı kuralıyla.
  'MX-AGU': 'America/Mexico_City',
  'MX-BCN': 'America/Tijuana',
  'MX-BCS': 'America/Mazatlan',
  'MX-CAM': 'America/Merida',
  'MX-CHH': 'America/Chihuahua',
  'MX-CHP': 'America/Mexico_City',
  'MX-CMX': 'America/Mexico_City', // ISO; OurAirports MX-DIF
  'MX-COA': 'America/Monterrey',
  'MX-COL': 'America/Mexico_City',
  'MX-DIF': 'America/Mexico_City',
  'MX-DUR': 'America/Monterrey',
  'MX-GRO': 'America/Mexico_City',
  'MX-GUA': 'America/Mexico_City',
  'MX-JAL': 'America/Mexico_City',
  'MX-MEX': 'America/Mexico_City',
  'MX-MIC': 'America/Mexico_City',
  'MX-NAY': 'America/Mazatlan',
  'MX-NLE': 'America/Monterrey',
  'MX-OAX': 'America/Mexico_City',
  'MX-PUE': 'America/Mexico_City',
  'MX-QUE': 'America/Mexico_City',
  'MX-ROO': 'America/Cancun',
  'MX-SIN': 'America/Mazatlan',
  'MX-SLP': 'America/Mexico_City',
  'MX-SON': 'America/Hermosillo',
  'MX-TAB': 'America/Mexico_City',
  'MX-TAM': 'America/Monterrey',
  'MX-VER': 'America/Mexico_City',
  'MX-YUC': 'America/Merida',
  'MX-ZAC': 'America/Mexico_City',
  // Malezya (5. halka): yarımada Kuala Lumpur, Sabah, Sarawak ve Labuan Kuching (ikisi de UTC+8).
  'MY-01': 'Asia/Kuala_Lumpur',
  'MY-02': 'Asia/Kuala_Lumpur',
  'MY-03': 'Asia/Kuala_Lumpur',
  'MY-04': 'Asia/Kuala_Lumpur',
  'MY-06': 'Asia/Kuala_Lumpur',
  'MY-07': 'Asia/Kuala_Lumpur',
  'MY-08': 'Asia/Kuala_Lumpur',
  'MY-10': 'Asia/Kuala_Lumpur',
  'MY-11': 'Asia/Kuala_Lumpur',
  'MY-12': 'Asia/Kuching',
  'MY-13': 'Asia/Kuching',
  'MY-15': 'Asia/Kuching',
  // Yeni Zelanda (5. halka): Auckland. Chatham Adaları OurAirports'ta NZ-WGN'dedir: havalimanı kuralı.
  'NZ-AUK': 'Pacific/Auckland',
  'NZ-BOP': 'Pacific/Auckland',
  'NZ-CAN': 'Pacific/Auckland',
  'NZ-GIS': 'Pacific/Auckland',
  'NZ-HKB': 'Pacific/Auckland',
  'NZ-MBH': 'Pacific/Auckland',
  'NZ-MWT': 'Pacific/Auckland',
  'NZ-NSN': 'Pacific/Auckland',
  'NZ-NTL': 'Pacific/Auckland',
  'NZ-OTA': 'Pacific/Auckland',
  'NZ-STL': 'Pacific/Auckland',
  'NZ-TKI': 'Pacific/Auckland',
  'NZ-WGN': 'Pacific/Auckland',
  'NZ-WKO': 'Pacific/Auckland',
  'NZ-WTC': 'Pacific/Auckland',
  // Fransız Polinezyası (5. halka): OurAirports bütün ülkeye tek, ISO'da olmayan bölge kodu verir
  // (PF-U-A, "atanmamış"). Tahiti; Markiz (NTMD, NTMN) ve Gambier (NTGJ) havalimanı kuralıyla.
  'PF-U-A': 'Pacific/Tahiti',
  // Papua Yeni Gine (5. halka): Port Moresby; Bougainville (PG-NSB) Pacific/Bougainville (UTC+11).
  'PG-CPK': 'Pacific/Port_Moresby',
  'PG-EBR': 'Pacific/Port_Moresby',
  'PG-EHG': 'Pacific/Port_Moresby',
  'PG-EPW': 'Pacific/Port_Moresby',
  'PG-ESW': 'Pacific/Port_Moresby',
  'PG-GPK': 'Pacific/Port_Moresby',
  'PG-MBA': 'Pacific/Port_Moresby',
  'PG-MPL': 'Pacific/Port_Moresby',
  'PG-MPM': 'Pacific/Port_Moresby',
  'PG-MRL': 'Pacific/Port_Moresby',
  'PG-NCD': 'Pacific/Port_Moresby',
  'PG-NIK': 'Pacific/Port_Moresby',
  'PG-NPP': 'Pacific/Port_Moresby',
  'PG-NSB': 'Pacific/Bougainville',
  'PG-SAN': 'Pacific/Port_Moresby',
  'PG-SHM': 'Pacific/Port_Moresby',
  'PG-WBK': 'Pacific/Port_Moresby',
  'PG-WHM': 'Pacific/Port_Moresby',
  'PG-WPD': 'Pacific/Port_Moresby',
  // Portekiz: anakaranın altı bölgesi, Azorlar (PT-20) ve Madeira (PT-30).
  'PT-04': 'Europe/Lisbon',
  'PT-08': 'Europe/Lisbon',
  'PT-11': 'Europe/Lisbon',
  'PT-13': 'Europe/Lisbon',
  'PT-17': 'Europe/Lisbon',
  'PT-18': 'Europe/Lisbon',
  'PT-20': 'Atlantic/Azores',
  'PT-30': 'Atlantic/Madeira',
  // Rusya. 5. halkada Uzak Doğu: Amur ve Saha Yakutsk (UTC+9), Habarovsk ve Primorye Vladivostok
  // (UTC+10), Sahalin, Magadan, Kamçatka, Çukotka ve Zabaykalsky kendi dilimleri; Saha'nın doğusu
  // (Ust-Nera UTC+10, Srednekolımsk UTC+11) havalimanı kuralıyla.
  'RU-AD': 'Europe/Moscow',
  'RU-ALT': 'Asia/Barnaul',
  'RU-AMU': 'Asia/Yakutsk',
  'RU-ARK': 'Europe/Moscow',
  'RU-AST': 'Europe/Astrakhan',
  'RU-BA': 'Asia/Yekaterinburg',
  'RU-BEL': 'Europe/Moscow',
  'RU-BRY': 'Europe/Moscow',
  'RU-BU': 'Asia/Irkutsk',
  'RU-CE': 'Europe/Moscow',
  'RU-CHE': 'Asia/Yekaterinburg',
  'RU-CHU': 'Asia/Anadyr',
  'RU-CU': 'Europe/Moscow',
  'RU-DA': 'Europe/Moscow',
  'RU-IN': 'Europe/Moscow',
  'RU-IRK': 'Asia/Irkutsk',
  'RU-IVA': 'Europe/Moscow',
  'RU-KAM': 'Asia/Kamchatka',
  'RU-KB': 'Europe/Moscow',
  'RU-KC': 'Europe/Moscow',
  'RU-KDA': 'Europe/Moscow',
  'RU-KEM': 'Asia/Novokuznetsk',
  'RU-KGD': 'Europe/Kaliningrad',
  'RU-KGN': 'Asia/Yekaterinburg',
  'RU-KHA': 'Asia/Vladivostok',
  'RU-KHM': 'Asia/Yekaterinburg',
  'RU-KIR': 'Europe/Kirov',
  'RU-KK': 'Asia/Krasnoyarsk',
  'RU-KL': 'Europe/Moscow',
  'RU-KO': 'Europe/Moscow',
  'RU-KOS': 'Europe/Moscow',
  'RU-KR': 'Europe/Moscow',
  'RU-KRS': 'Europe/Moscow',
  'RU-KYA': 'Asia/Krasnoyarsk',
  'RU-LIP': 'Europe/Moscow',
  'RU-MAG': 'Asia/Magadan',
  'RU-MO': 'Europe/Moscow',
  'RU-MOS': 'Europe/Moscow',
  'RU-MOW': 'Europe/Moscow',
  'RU-MUR': 'Europe/Moscow',
  'RU-NEN': 'Europe/Moscow',
  'RU-NIZ': 'Europe/Moscow',
  'RU-NVS': 'Asia/Novosibirsk',
  'RU-OMS': 'Asia/Omsk',
  'RU-ORE': 'Asia/Yekaterinburg',
  'RU-PER': 'Asia/Yekaterinburg',
  'RU-PNZ': 'Europe/Moscow',
  'RU-PRI': 'Asia/Vladivostok',
  'RU-PSK': 'Europe/Moscow',
  'RU-ROS': 'Europe/Moscow',
  'RU-SA': 'Asia/Yakutsk',
  'RU-SAK': 'Asia/Sakhalin',
  'RU-SAM': 'Europe/Samara',
  'RU-SAR': 'Europe/Saratov',
  'RU-SE': 'Europe/Moscow',
  'RU-SPE': 'Europe/Moscow',
  'RU-STA': 'Europe/Moscow',
  'RU-SVE': 'Asia/Yekaterinburg',
  'RU-TA': 'Europe/Moscow',
  'RU-TOM': 'Asia/Tomsk',
  'RU-TY': 'Asia/Krasnoyarsk',
  'RU-TYU': 'Asia/Yekaterinburg',
  'RU-UD': 'Europe/Samara',
  'RU-ULY': 'Europe/Ulyanovsk',
  'RU-VGG': 'Europe/Volgograd',
  'RU-VLG': 'Europe/Moscow',
  'RU-VOR': 'Europe/Moscow',
  'RU-YAN': 'Asia/Yekaterinburg',
  'RU-YAR': 'Europe/Moscow',
  'RU-ZAB': 'Asia/Chita',
  // Ukrayna (D-110): tzdb zone.tab; Kırım ve Sivastopol Europe/Simferopol, öbürleri Europe/Kiev
  // (Intl yazımı; tzdb Europe/Kyiv).
  'UA-05': 'Europe/Kiev',
  'UA-07': 'Europe/Kiev',
  'UA-09': 'Europe/Kiev',
  'UA-12': 'Europe/Kiev',
  'UA-14': 'Europe/Kiev',
  'UA-18': 'Europe/Kiev',
  'UA-19': 'Europe/Kiev', // OurAirports: Rivne (ISO UA-56)
  'UA-21': 'Europe/Kiev',
  'UA-23': 'Europe/Kiev',
  'UA-26': 'Europe/Kiev',
  'UA-30': 'Europe/Kiev',
  'UA-32': 'Europe/Kiev',
  'UA-35': 'Europe/Kiev',
  'UA-40': 'Europe/Simferopol', // Sivastopol
  'UA-43': 'Europe/Simferopol', // Kırım
  'UA-46': 'Europe/Kiev',
  'UA-48': 'Europe/Kiev',
  'UA-51': 'Europe/Kiev',
  'UA-53': 'Europe/Kiev',
  'UA-56': 'Europe/Kiev',
  'UA-59': 'Europe/Kiev',
  'UA-61': 'Europe/Kiev',
  'UA-63': 'Europe/Kiev',
  'UA-65': 'Europe/Kiev',
  'UA-68': 'Europe/Kiev',
  'UA-71': 'Europe/Kiev',
  'UA-74': 'Europe/Kiev',
  'UA-77': 'Europe/Kiev',
  // ABD (5. halka): 50 eyalet ve DC, eyaletin tzdb "çoğu yer" dilimiyle. Bölgeyi bölen 21
  // havalimanı (Florida Panhandle, Kuzey Idaho, Indiana, Kentucky, Michigan, Nebraska, Dakota,
  // Tennessee, El Paso, Adak) havalimanı kuralıyla. Arizona America/Phoenix (Navajo Ulusu'nda
  // listelenen havalimanı yok).
  'US-AK': 'America/Anchorage',
  'US-AL': 'America/Chicago',
  'US-AR': 'America/Chicago',
  'US-AZ': 'America/Phoenix',
  'US-CA': 'America/Los_Angeles',
  'US-CO': 'America/Denver',
  'US-CT': 'America/New_York',
  'US-DC': 'America/New_York',
  'US-DE': 'America/New_York',
  'US-FL': 'America/New_York',
  'US-GA': 'America/New_York',
  'US-HI': 'Pacific/Honolulu',
  'US-IA': 'America/Chicago',
  'US-ID': 'America/Boise',
  'US-IL': 'America/Chicago',
  'US-IN': 'America/Indianapolis',
  'US-KS': 'America/Chicago',
  'US-KY': 'America/New_York',
  'US-LA': 'America/Chicago',
  'US-MA': 'America/New_York',
  'US-MD': 'America/New_York',
  'US-ME': 'America/New_York',
  'US-MI': 'America/Detroit',
  'US-MN': 'America/Chicago',
  'US-MO': 'America/Chicago',
  'US-MS': 'America/Chicago',
  'US-MT': 'America/Denver',
  'US-NC': 'America/New_York',
  'US-ND': 'America/Chicago',
  'US-NE': 'America/Chicago',
  'US-NH': 'America/New_York',
  'US-NJ': 'America/New_York',
  'US-NM': 'America/Denver',
  'US-NV': 'America/Los_Angeles',
  'US-NY': 'America/New_York',
  'US-OH': 'America/New_York',
  'US-OK': 'America/Chicago',
  'US-OR': 'America/Los_Angeles',
  'US-PA': 'America/New_York',
  'US-RI': 'America/New_York',
  'US-SC': 'America/New_York',
  'US-SD': 'America/Chicago',
  'US-TN': 'America/Chicago',
  'US-TX': 'America/Chicago',
  'US-UT': 'America/Denver',
  'US-VA': 'America/New_York',
  'US-VT': 'America/New_York',
  'US-WA': 'America/Los_Angeles',
  'US-WI': 'America/Chicago',
  'US-WV': 'America/New_York',
  'US-WY': 'America/Denver',
  // Özbekistan: batı Semerkant, doğu (Taşkent bölgesi, Fergana vadisi, Cizzak, Surhanderya) Taşkent.
  'UZ-AN': 'Asia/Tashkent',
  'UZ-BU': 'Asia/Samarkand',
  'UZ-FA': 'Asia/Tashkent',
  'UZ-JI': 'Asia/Tashkent',
  'UZ-NG': 'Asia/Tashkent',
  'UZ-NW': 'Asia/Samarkand',
  'UZ-QR': 'Asia/Samarkand',
  'UZ-SA': 'Asia/Samarkand',
  'UZ-SU': 'Asia/Samarkand',
  'UZ-TO': 'Asia/Tashkent',
  'UZ-XO': 'Asia/Samarkand',
}

/**
 * Havalimanına (ICAO) özgü dilim; bölge ve ülke kuralından önce gelir.
 * - Kıbrıs'ın iki dilimi vardır, OurAirports bölge kodları dilimle örtüşmez: Ercan (LCEN)
 *   Asia/Famagusta (tzdb "Northern Cyprus"; bugün Lefkoşa ile aynı kurallar), Larnaka ve Baf
 *   Asia/Nicosia.
 * - Sohum (UGSS): fiilen kullanılan Moskova saati, UTC+3 (kullanıcı kararı 2026-10-03). Ülke
 *   gösterimi Gürcistan kalır (D-080 karar 2).
 * - Grönland (4. halka, D-101): iki havalimanı aynı bölgede (GL-SE, Sermersooq) ama farklı dilimde.
 *   Constable Pynt (BGCO, Ittoqqortoormiit) America/Scoresbysund; Kulusuk (BGKK) Nuuk saati,
 *   ICU yazımıyla America/Godthab (tzdb America/Nuuk). İkisi de 2024'ten beri UTC−2, yazın UTC−1.
 * - Harkiv (UKHH, D-110): OurAirports bölgesi "atanmamış" (UA-U-A); Kiev saati.
 * - 5. halka (D-109; 68 kural): bölgesi farklı farkları olan dilimlere bölünen 54 havalimanı (ABD
 *   21, Kanada 20, Meksika 5, Saha 6, Brezilya 1, Avustralya 1; satır açıklamaları), OurAirports
 *   bölgesi dilim sınırından kaba 6 havalimanı (Paskalya, Chatham, Nuuk, Markiz ikisi, Gambier) ve
 *   bölge varsayılanıyla aynı farkları olan, tzdb'ye sadık 8 kural (4. halkanın Kirov, Kostanay,
 *   Semerkant örneği gibi). Satırdaki ¹: orta güvenli (yukarıda).
 */
export const AIRPORT_TIME_ZONES: Readonly<Record<string, string>> = {
  BGCO: 'America/Scoresbysund',
  BGGH: 'America/Godthab', // Nuuk; GL-SE kuralsızdır (BGCO, BGKK)
  BGKK: 'America/Godthab',
  CYAG: 'America/Winnipeg', // Fort Frances (Rainy River): Central
  CYAQ: 'America/Winnipeg', // Kasabonika (Kenora bölgesi): Central varsayıldı ¹
  CYBK: 'America/Rankin_Inlet', // Baker Lake, Kivalliq: Central
  CYBX: 'America/Blanc-Sablon', // Blanc-Sablon, Aşağı Kuzey Kıyısı: bütün yıl AST
  CYCB: 'America/Cambridge_Bay', // Cambridge Bay, Nunavut'un batısı: Mountain
  CYDA: 'America/Dawson', // Dawson City (Whitehorse ile aynı farklar)
  CYEV: 'America/Inuvik', // Inuvik (Edmonton ile aynı farklar)
  CYGR: 'America/Halifax', // Magdalen Adaları: Atlantic, yaz saatiyle
  CYIF: 'America/Blanc-Sablon', // Saint-Augustin, Aşağı Kuzey Kıyısı: bütün yıl AST
  CYPL: 'America/Coral_Harbour', // Pickle Lake: bütün yıl EST (tzdb: Atikokan gibi) ¹
  CYQK: 'America/Winnipeg', // Kenora, kuzeybatı Ontario: Central
  CYQY: 'America/Glace_Bay', // Sydney, Cape Breton (Halifax ile aynı farklar)
  CYRB: 'America/Resolute', // Resolute: Central
  CYRL: 'America/Winnipeg', // Red Lake: Central
  CYRT: 'America/Rankin_Inlet', // Rankin Inlet, Kivalliq: Central
  CYWK: 'America/Goose_Bay', // Wabush, Labrador: Atlantic
  CYXC: 'America/Edmonton', // Cranbrook, Doğu Kootenay: Mountain
  CYXJ: 'America/Dawson_Creek', // Fort St John: bütün yıl MST
  CYXL: 'America/Winnipeg', // Sioux Lookout: Central
  CYYE: 'America/Fort_Nelson', // Fort Nelson: bütün yıl MST
  CYYR: 'America/Goose_Bay', // Goose Bay, Labrador: Atlantic
  CYZS: 'America/Coral_Harbour', // Coral Harbour: bütün yıl EST (tzdb America/Atikokan)
  CZSJ: 'America/Winnipeg', // Sandy Lake: Central
  KAIA: 'America/Denver', // Alliance (Box Butte): Mountain
  KBFF: 'America/Denver', // Scottsbluff, batı Nebraska: Mountain
  KCDR: 'America/Denver', // Chadron (Dawes): Mountain
  KCHA: 'America/New_York', // Chattanooga, doğu Tennessee: Eastern
  KDIK: 'America/Denver', // Dickinson (Stark), güneybatı Kuzey Dakota: Mountain
  KDTS: 'America/Chicago', // Destin Executive (Okaloosa): Central
  KECP: 'America/Chicago', // Panama City Beach (Bay): Central
  KELP: 'America/Denver', // El Paso, batı Teksas: Mountain
  KEVV: 'America/Chicago', // Evansville (Vanderburgh): Central
  KGYY: 'America/Chicago', // Gary (Lake): Central
  KIMT: 'America/Menominee', // Iron Mountain (Dickinson): Central
  KLWS: 'America/Los_Angeles', // Lewiston, kuzey Idaho (Nez Perce): Pacific
  KMGC: 'America/Chicago', // Michigan City (LaPorte): Central
  KOWB: 'America/Chicago', // Owensboro, batı Kentucky: Central
  KPAH: 'America/Chicago', // Paducah, batı Kentucky: Central
  KPNS: 'America/Chicago', // Pensacola, Florida Panhandle (Escambia): Central
  KRAP: 'America/Denver', // Rapid City, batı Güney Dakota: Mountain
  KSDF: 'America/Louisville', // Louisville (tzdb America/Kentucky/Louisville)
  KTRI: 'America/New_York', // Tri-Cities, doğu Tennessee: Eastern
  KTYS: 'America/New_York', // Knoxville, doğu Tennessee: Eastern
  KVPS: 'America/Chicago', // Destin-Fort Walton Beach (Okaloosa): Central
  LCEN: 'Asia/Famagusta',
  LCLK: 'Asia/Nicosia',
  LCPH: 'Asia/Nicosia',
  MMCS: 'America/Ciudad_Juarez', // Ciudad Juárez: ABD sınırı, Mountain, ABD yaz saatiyle
  MMMA: 'America/Matamoros', // Matamoros: ABD sınırı
  MMNL: 'America/Matamoros', // Nuevo Laredo: ABD sınırı
  MMPG: 'America/Matamoros', // Piedras Negras: ABD sınırı, Central, ABD yaz saatiyle
  MMRX: 'America/Matamoros', // Reynosa: ABD sınırı
  NTGJ: 'Pacific/Gambier', // Totegegie (Gambier); OurAirports bölgesi PF-U-A
  NTMD: 'Pacific/Marquesas', // Nuku Hiva (Markiz); OurAirports bölgesi PF-U-A
  NTMN: 'Pacific/Marquesas', // Hiva Oa (Markiz); OurAirports bölgesi PF-U-A
  NZCI: 'Pacific/Chatham', // Chatham Adaları; OurAirports bölgesi NZ-WGN (ISO NZ-CIT)
  PADK: 'America/Adak', // Adak, 169,5° B'nin batısı: Hawaii-Aleut saati
  SBFN: 'America/Noronha', // Fernando de Noronha: UTC−2
  SBIH: 'America/Santarem', // Itaituba, batı Pará (Belém ile aynı farklar)
  SBSN: 'America/Santarem', // Santarém, batı Pará (Belém ile aynı farklar)
  SBTB: 'America/Santarem', // Trombetas (Oriximiná), batı Pará (Belém ile aynı farklar)
  SCIP: 'Pacific/Easter', // Paskalya Adası; OurAirports bölgesi CL-VS
  UEMA: 'Asia/Srednekolymsk', // Honuu (Momski): UTC+11
  UEMT: 'Asia/Ust-Nera', // Ust-Nera (Oymyakon): UTC+10
  UESK: 'Asia/Srednekolymsk', // Srednekolımsk: UTC+11
  UESO: 'Asia/Srednekolymsk', // Çokurdah (Allaikhovski): UTC+11
  UESS: 'Asia/Srednekolymsk', // Çerski (Aşağı Kolıma): UTC+11
  UESU: 'Asia/Srednekolymsk', // Zıryanka (Yukarı Kolıma): UTC+11
  UGSS: 'Europe/Moscow',
  UKHH: 'Europe/Kiev', // Harkiv; OurAirports bölgesi UA-U-A
  YBHI: 'Australia/Broken_Hill', // Broken Hill (Yancowinna): Güney Avustralya saati
  YBHM: 'Australia/Lindeman', // Hamilton Adası, Whitsunday (Brisbane ile aynı farklar)
}

export { isSupportedTimeZone }

/** `airportTimeZone`'un okuduğu alanlar (`Airport`, `AirportDetail`, harita kaydı). */
export interface TimeZoneAirport {
  icao: string
  /** ISO 3166-1 alpha-2 (OurAirports `iso_country`). */
  country: string
  /** ISO 3166-2 (OurAirports `iso_region`); yoksa bölge kuralı atlanır. */
  isoRegion?: string | null
}

const lookup = (table: Readonly<Record<string, string>>, key: string): string | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined

/**
 * Havalimanının IANA saat dilimi: havalimanı kuralı, bölge kuralı, tek dilimli ülke; hiçbiri
 * yoksa ya da çalışma zamanı dilimi tanımıyorsa null. Kodlar kırpılıp büyük harfe çevrilir.
 * Türkiye'deki her havalimanı Europe/Istanbul'dur.
 */
export function airportTimeZone(airport: TimeZoneAirport): string | null {
  const icao = airport.icao.trim().toUpperCase()
  const region = (airport.isoRegion ?? '').trim().toUpperCase()
  const country = airport.country.trim().toUpperCase()
  const zone =
    lookup(AIRPORT_TIME_ZONES, icao) ??
    (region === '' ? undefined : lookup(REGION_TIME_ZONES, region)) ??
    lookup(COUNTRY_TIME_ZONES, country)
  return zone !== undefined && isSupportedTimeZone(zone) ? zone : null
}
