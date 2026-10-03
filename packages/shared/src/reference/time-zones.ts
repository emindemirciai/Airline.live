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
 * Çok dilimli ülkelerde bölge (ISO 3166-2, OurAirports `iso_region`) → dilim. Açık halkaların
 * gerektirdiği bölgeler (1. ve 2. halka; 2. halka hazır):
 * - Rusya: Kuzey Kafkasya, Krasnodar, Rostov ve Kalmukya Moskova saatidir; Volgograd kendi
 *   dilimidir (Moskova kuralları); Astrahan UTC+4'tür.
 * - Kazakistan: Mangistav (Aktav). 2024'ten beri bütün ülke UTC+5'tir; tzdb dilimleri ayrı tutar.
 */
export const REGION_TIME_ZONES: Readonly<Record<string, string>> = {
  'KZ-MAN': 'Asia/Aqtau',
  'RU-AD': 'Europe/Moscow',
  'RU-AST': 'Europe/Astrakhan',
  'RU-CE': 'Europe/Moscow',
  'RU-DA': 'Europe/Moscow',
  'RU-IN': 'Europe/Moscow',
  'RU-KB': 'Europe/Moscow',
  'RU-KC': 'Europe/Moscow',
  'RU-KDA': 'Europe/Moscow',
  'RU-KL': 'Europe/Moscow',
  'RU-ROS': 'Europe/Moscow',
  'RU-SE': 'Europe/Moscow',
  'RU-STA': 'Europe/Moscow',
  'RU-VGG': 'Europe/Volgograd',
}

/**
 * Havalimanına (ICAO) özgü dilim; bölge ve ülke kuralından önce gelir.
 * - Kıbrıs'ın iki dilimi vardır, OurAirports bölge kodları dilimle örtüşmez: Ercan (LCEN)
 *   Asia/Famagusta (tzdb "Northern Cyprus"; bugün Lefkoşa ile aynı kurallar), Larnaka ve Baf
 *   Asia/Nicosia.
 * - Sohum (UGSS): fiilen kullanılan Moskova saati, UTC+3 (kullanıcı kararı 2026-10-03). Ülke
 *   gösterimi Gürcistan kalır (D-080 karar 2).
 */
export const AIRPORT_TIME_ZONES: Readonly<Record<string, string>> = {
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
