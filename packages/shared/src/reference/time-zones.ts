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
 * arayüz saatleri Türkiye saatiyle yazıp öyle etiketler (D-080'deki eski davranış). Uzak halkalar
 * açılırken (ABD, Kanada, Rusya'nın doğusu, Avustralya, Brezilya …) yalnızca bölge ve havalimanı
 * kuralları eklenir; birim testi listelenen her havalimanının bir dilimi olduğunu denetler.
 *
 * Adlar `Intl`'in (ICU/CLDR) yazdığı biçimdedir (`Asia/Calcutta`, tzdb'de `Asia/Kolkata`'ya
 * bağlantı): her tarayıcı bunları tanır. Ofset koda gömülmez; yaz saati dahil her an için `Intl`
 * hesaplar. Tablo çalışma zamanında hiçbir yerden çekilmez.
 */

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
 * Çok dilimli ülkelerde bölge (ISO 3166-2, OurAirports `iso_region`) → dilim. Açık halkaların ve
 * 4. halkanın gerektirdiği bölgeler (3. halka 49 kural ekledi, D-090; 4. halka 93 kural, D-101):
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
 *   İrkutsk ve Buryatya Asia/Irkutsk (UTC+8).
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
 *   (UTC+2; Goma, Bukavu, Kisangani).
 * - Portekiz (4. halka): anakara Europe/Lisbon, Azorlar Atlantic/Azores, Madeira Atlantic/Madeira.
 * - Almanya (Europe/Berlin ve Büsingen; Büsingen'de havalimanı yok), İspanya (Kanarya
 *   Atlantic/Canary, Ceuta ve Melilla Africa/Ceuta, öbür bölgeler Europe/Madrid) ve Özbekistan
 *   (batı Asia/Samarkand, doğu Asia/Tashkent; ikisi de 1992'den beri UTC+5).
 */
export const REGION_TIME_ZONES: Readonly<Record<string, string>> = {
  // Kongo DC: batı Kinşasa (UTC+1), doğu Lubumbaşi (UTC+2).
  'CD-EQ': 'Africa/Kinshasa',
  'CD-HU': 'Africa/Lubumbashi',
  'CD-IT': 'Africa/Lubumbashi',
  'CD-KC': 'Africa/Lubumbashi',
  'CD-KE': 'Africa/Lubumbashi',
  'CD-KL': 'Africa/Kinshasa',
  'CD-KN': 'Africa/Kinshasa',
  'CD-MA': 'Africa/Lubumbashi',
  'CD-NK': 'Africa/Lubumbashi',
  'CD-NU': 'Africa/Kinshasa',
  'CD-SU': 'Africa/Kinshasa',
  'CD-TA': 'Africa/Lubumbashi',
  'CD-TO': 'Africa/Lubumbashi',
  // Çin: Pekin saati. OurAirports'un sayısal kodu (Tibet 54, Gansu 62, Qinghai 63, Sincan 65) ve
  // ISO 3166-2 harf kodu (XZ, GS, QH, XJ) ikisi de yazılıdır.
  'CN-54': 'Asia/Shanghai',
  'CN-62': 'Asia/Shanghai',
  'CN-63': 'Asia/Shanghai',
  'CN-65': 'Asia/Shanghai',
  'CN-GS': 'Asia/Shanghai',
  'CN-QH': 'Asia/Shanghai',
  'CN-XJ': 'Asia/Shanghai',
  'CN-XZ': 'Asia/Shanghai',
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
  // Moğolistan: batının üç bölgesi Hovd (UTC+7), öbürleri Ulan Batur (UTC+8).
  'MN-041': 'Asia/Ulaanbaatar',
  'MN-043': 'Asia/Hovd',
  'MN-046': 'Asia/Hovd',
  'MN-047': 'Asia/Ulaanbaatar',
  'MN-053': 'Asia/Ulaanbaatar',
  'MN-055': 'Asia/Ulaanbaatar',
  'MN-065': 'Asia/Ulaanbaatar',
  'MN-067': 'Asia/Ulaanbaatar',
  'MN-069': 'Asia/Ulaanbaatar',
  'MN-071': 'Asia/Hovd',
  // Portekiz: anakaranın altı bölgesi, Azorlar (PT-20) ve Madeira (PT-30).
  'PT-04': 'Europe/Lisbon',
  'PT-08': 'Europe/Lisbon',
  'PT-11': 'Europe/Lisbon',
  'PT-13': 'Europe/Lisbon',
  'PT-17': 'Europe/Lisbon',
  'PT-18': 'Europe/Lisbon',
  'PT-20': 'Atlantic/Azores',
  'PT-30': 'Atlantic/Madeira',
  'RU-AD': 'Europe/Moscow',
  'RU-ALT': 'Asia/Barnaul',
  'RU-ARK': 'Europe/Moscow',
  'RU-AST': 'Europe/Astrakhan',
  'RU-BA': 'Asia/Yekaterinburg',
  'RU-BU': 'Asia/Irkutsk',
  'RU-CE': 'Europe/Moscow',
  'RU-CHE': 'Asia/Yekaterinburg',
  'RU-CU': 'Europe/Moscow',
  'RU-DA': 'Europe/Moscow',
  'RU-IN': 'Europe/Moscow',
  'RU-IRK': 'Asia/Irkutsk',
  'RU-IVA': 'Europe/Moscow',
  'RU-KB': 'Europe/Moscow',
  'RU-KC': 'Europe/Moscow',
  'RU-KDA': 'Europe/Moscow',
  'RU-KEM': 'Asia/Novokuznetsk',
  'RU-KGD': 'Europe/Kaliningrad',
  'RU-KGN': 'Asia/Yekaterinburg',
  'RU-KHM': 'Asia/Yekaterinburg',
  'RU-KIR': 'Europe/Kirov',
  'RU-KK': 'Asia/Krasnoyarsk',
  'RU-KL': 'Europe/Moscow',
  'RU-KO': 'Europe/Moscow',
  'RU-KOS': 'Europe/Moscow',
  'RU-KR': 'Europe/Moscow',
  'RU-KYA': 'Asia/Krasnoyarsk',
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
  'RU-PSK': 'Europe/Moscow',
  'RU-ROS': 'Europe/Moscow',
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
 */
export const AIRPORT_TIME_ZONES: Readonly<Record<string, string>> = {
  BGCO: 'America/Scoresbysund',
  BGKK: 'America/Godthab',
  LCEN: 'Asia/Famagusta',
  LCLK: 'Asia/Nicosia',
  LCPH: 'Asia/Nicosia',
  UGSS: 'Europe/Moscow',
}

const supported = new Map<string, boolean>()

/**
 * Çalışma zamanı dilimi tanıyor mu (`Intl.DateTimeFormat`). Eski bir tarayıcı yeni bir dilimi
 * bilmeyebilir (`RangeError`); sonuç dilim başına bir kez hesaplanır.
 */
export function isSupportedTimeZone(timeZone: string): boolean {
  let known = supported.get(timeZone)
  if (known === undefined) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone }).format(0)
      known = true
    } catch {
      known = false
    }
    supported.set(timeZone, known)
  }
  return known
}

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
