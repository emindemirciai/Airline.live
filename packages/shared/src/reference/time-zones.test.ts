import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { localTime } from '../weather/time'
import {
  AIRPORT_TIME_ZONES,
  airportRing,
  airportTimeZone,
  COUNTRY_TIME_ZONES,
  ENABLED_AIRPORT_RING,
  isForeignCandidate,
  isMilitaryAirfield,
  isScheduledIataAirport,
  isSupportedTimeZone,
  ourAirportsIcao,
  REGION_TIME_ZONES,
} from './index'

/**
 * 1., 2. ve 3. halkanın 442 havalimanı (OurAirports 2026-10-01 indirmesi; hepsi listede ve
 * fixture'da, D-088, D-090): "ICAO bölge dilim". İskenderiye uygulamadaki koduyla (HEBA; OurAirports
 * `icao_code` HEAX), Özbekistan'ın beş havalimanı UZxx koduyla (OurAirports kimliği UTxx). Beklenen
 * dilimler M6f ve M6h araştırmalarının karşılaştırmasıdır (tzdb `zone.tab` açıklamaları ve bölge
 * kuralları); Sohum kullanıcı kararıyla Moskova saatidir, Volgograd kendi dilimidir (Moskova
 * kuralları). Berlin Brandenburg'un OurAirports bölge kodu DE-BR'dir (ISO DE-BB). Ülke, bölge
 * kodunun önekidir.
 */
const RING_AIRPORTS: readonly string[] = [
  // 1. halka
  'BKPR XK-01 Europe/Belgrade',
  'LBBG BG-02 Europe/Sofia',
  'LBPD BG-16 Europe/Sofia',
  'LBSF BG-22 Europe/Sofia',
  'LBWN BG-03 Europe/Sofia',
  'LCEN CY-02 Asia/Famagusta',
  'LCLK CY-04 Asia/Nicosia',
  'LCPH CY-06 Asia/Nicosia',
  'LGAL GR-A Europe/Athens',
  'LGAV GR-I Europe/Athens',
  'LGBL GR-E Europe/Athens',
  'LGHI GR-K Europe/Athens',
  'LGIO GR-D Europe/Athens',
  'LGIR GR-M Europe/Athens',
  'LGKL GR-J Europe/Athens',
  'LGKO GR-L Europe/Athens',
  'LGKP GR-L Europe/Athens',
  'LGKV GR-A Europe/Athens',
  'LGKZ GR-C Europe/Athens',
  'LGMK GR-L Europe/Athens',
  'LGMT GR-K Europe/Athens',
  'LGPZ GR-D Europe/Athens',
  'LGRP GR-L Europe/Athens',
  'LGRX GR-G Europe/Athens',
  'LGSA GR-M Europe/Athens',
  'LGSK GR-E Europe/Athens',
  'LGSM GR-K Europe/Athens',
  'LGSR GR-L Europe/Athens',
  'LGST GR-M Europe/Athens',
  'LGTS GR-B Europe/Athens',
  'LLHA IL-HA Asia/Jerusalem',
  'LRBS RO-B Europe/Bucharest',
  'LRCK RO-CT Europe/Bucharest',
  'LRCV RO-DJ Europe/Bucharest',
  'LROP RO-IF Europe/Bucharest',
  'LWOH MK-003 Europe/Skopje',
  'LWSK MK-008 Europe/Skopje',
  'LYNI RS-20 Europe/Belgrade',
  'OICC IR-05 Asia/Tehran',
  'OICS IR-12 Asia/Tehran',
  'OIGG IR-01 Asia/Tehran',
  'OIHH IR-13 Asia/Tehran',
  'OITL IR-24 Asia/Tehran',
  'OITR IR-04 Asia/Tehran',
  'OITT IR-03 Asia/Tehran',
  'OJAM JO-AM Asia/Amman',
  'OLBA LB-JL Asia/Beirut',
  'ORBI IQ-BG Asia/Baghdad',
  'ORER IQ-AR Asia/Baghdad',
  'ORKK IQ-TS Asia/Baghdad',
  'ORSJ IQ-SW Asia/Baghdad',
  'OSAP SY-HL Asia/Damascus',
  'OSDI SY-DI Asia/Damascus',
  'OSKL SY-HA Asia/Damascus',
  'OSLK SY-LA Asia/Damascus',
  'UBBG AZ-GA Asia/Baku',
  'UBBN AZ-NX Asia/Baku',
  'UBBQ AZ-QAB Asia/Baku',
  'UBLC AZ-LAC Asia/Baku',
  'UDSG AM-SH Asia/Yerevan',
  'UDYZ AM-ER Asia/Yerevan',
  'UGKO GE-IM Asia/Tbilisi',
  'UGSB GE-AJ Asia/Tbilisi',
  'UGSS GE-AB Europe/Moscow',
  'UGTB GE-TB Asia/Tbilisi',
  'URKG RU-KDA Europe/Moscow',
  'URKK RU-KDA Europe/Moscow',
  'URMG RU-CE Europe/Moscow',
  'URML RU-DA Europe/Moscow',
  'URMM RU-STA Europe/Moscow',
  'URMN RU-KB Europe/Moscow',
  'URMO RU-SE Europe/Moscow',
  'URMS RU-IN Europe/Moscow',
  'URMT RU-STA Europe/Moscow',
  'URSS RU-KDA Europe/Moscow',
  // 2. halka
  'HEAL EG-MT Africa/Cairo',
  'HEAR EG-SIN Africa/Cairo',
  'HEBA EG-ALX Africa/Cairo',
  'HECA EG-C Africa/Cairo',
  'HECP EG-C Africa/Cairo',
  'HEMM EG-MT Africa/Cairo',
  'HEPS EG-PTS Africa/Cairo',
  'HESH EG-JS Africa/Cairo',
  'HESX EG-GZ Africa/Cairo',
  'HETB EG-JS Africa/Cairo',
  'HLLB LY-BA Africa/Tripoli',
  'HLLQ LY-JA Africa/Tripoli',
  'LATI AL-02 Europe/Tirane',
  'LDDU HR-19 Europe/Zagreb',
  'LDOS HR-14 Europe/Zagreb',
  'LDSB HR-17 Europe/Zagreb',
  'LDSP HR-17 Europe/Zagreb',
  'LDZD HR-13 Europe/Zagreb',
  'LGKF GR-F Europe/Athens',
  'LGKR GR-F Europe/Athens',
  'LGZA GR-F Europe/Athens',
  'LHBP HU-BU Europe/Budapest',
  'LHDC HU-HB Europe/Budapest',
  'LHPP HU-BA Europe/Budapest',
  'LIBC IT-78 Europe/Rome',
  'LIBD IT-75 Europe/Rome',
  'LIBF IT-75 Europe/Rome',
  'LIBR IT-75 Europe/Rome',
  'LICA IT-78 Europe/Rome',
  'LICC IT-82 Europe/Rome',
  'LICR IT-78 Europe/Rome',
  'LIRI IT-72 Europe/Rome',
  'LIRN IT-72 Europe/Rome',
  'LLBG IL-M Asia/Jerusalem',
  'LLER IL-D Asia/Jerusalem',
  'LQBK BA-SRP Europe/Sarajevo',
  'LQMO BA-BIH Europe/Sarajevo',
  'LQSA BA-BIH Europe/Sarajevo',
  'LQTZ BA-BIH Europe/Sarajevo',
  'LRAR RO-AR Europe/Bucharest',
  'LRBC RO-BC Europe/Bucharest',
  'LRBM RO-MM Europe/Bucharest',
  'LRBV RO-BV Europe/Bucharest',
  'LRCL RO-CJ Europe/Bucharest',
  'LRIA RO-IS Europe/Bucharest',
  'LROD RO-BH Europe/Bucharest',
  'LRSB RO-SB Europe/Bucharest',
  'LRSM RO-SM Europe/Bucharest',
  'LRSV RO-SV Europe/Bucharest',
  'LRTM RO-MS Europe/Bucharest',
  'LRTR RO-TM Europe/Bucharest',
  'LUKK MD-CU Europe/Chisinau',
  'LYBE RS-00 Europe/Belgrade',
  'LYKV RS-18 Europe/Belgrade',
  'LYPG ME-16 Europe/Podgorica',
  'LYTV ME-19 Europe/Podgorica',
  'LZKZ SK-KI Europe/Bratislava',
  'OEGT SA-12 Asia/Riyadh',
  'OENN SA-07 Asia/Riyadh',
  'OERF SA-08 Asia/Riyadh',
  'OERR SA-08 Asia/Riyadh',
  'OESK SA-12 Asia/Riyadh',
  'OETB SA-07 Asia/Riyadh',
  'OETR SA-08 Asia/Riyadh',
  'OIAA IR-06 Asia/Tehran',
  'OIAD IR-06 Asia/Tehran',
  'OIAM IR-06 Asia/Tehran',
  'OIAW IR-06 Asia/Tehran',
  'OICK IR-15 Asia/Tehran',
  'OIFK IR-10 Asia/Tehran',
  'OIFM IR-10 Asia/Tehran',
  'OIIE IR-23 Asia/Tehran',
  'OIII IR-23 Asia/Tehran',
  'OIIP IR-30 Asia/Tehran',
  'OINN IR-02 Asia/Tehran',
  'OINR IR-02 Asia/Tehran',
  'OINZ IR-02 Asia/Tehran',
  'OJAI JO-AM Asia/Amman',
  'OJAQ JO-AQ Asia/Amman',
  'OKKK KW-FA Asia/Kuwait',
  'ORMM IQ-BA Asia/Baghdad',
  'ORNI IQ-NA Asia/Baghdad',
  'UATE KZ-MAN Asia/Aqtau',
  'UBBB AZ-BA Asia/Baku',
  'URWA RU-AST Europe/Astrakhan',
  'URWI RU-KL Europe/Moscow',
  'URWW RU-VGG Europe/Volgograd',
  'UTAK TM-B Asia/Ashgabat',
  'UTAN TM-B Asia/Ashgabat',
  // 3. halka
  'DAAE DZ-06 Africa/Algiers',
  'DAAS DZ-19 Africa/Algiers',
  'DAAV DZ-18 Africa/Algiers',
  'DABB DZ-23 Africa/Algiers',
  'DABC DZ-25 Africa/Algiers',
  'DABS DZ-12 Africa/Algiers',
  'DABT DZ-05 Africa/Algiers',
  'DAUB DZ-07 Africa/Algiers',
  'DAUK DZ-55 Africa/Algiers',
  'DAUO DZ-39 Africa/Algiers',
  'DAUZ DZ-33 Africa/Algiers',
  'DTKA TN-32 Africa/Tunis',
  'DTMB TN-52 Africa/Tunis',
  'DTNH TN-51 Africa/Tunis',
  'DTTA TN-11 Africa/Tunis',
  'DTTJ TN-82 Africa/Tunis',
  'DTTX TN-61 Africa/Tunis',
  'DTTZ TN-72 Africa/Tunis',
  'EBLG BE-WLG Europe/Brussels',
  'EDAH DE-MV Europe/Berlin',
  'EDDB DE-BR Europe/Berlin',
  'EDDC DE-SN Europe/Berlin',
  'EDDE DE-TH Europe/Berlin',
  'EDDF DE-HE Europe/Berlin',
  'EDDG DE-NW Europe/Berlin',
  'EDDH DE-HH Europe/Berlin',
  'EDDK DE-NW Europe/Berlin',
  'EDDL DE-NW Europe/Berlin',
  'EDDM DE-BY Europe/Berlin',
  'EDDN DE-BY Europe/Berlin',
  'EDDP DE-SN Europe/Berlin',
  'EDDR DE-SL Europe/Berlin',
  'EDDS DE-BW Europe/Berlin',
  'EDDV DE-NI Europe/Berlin',
  'EDDW DE-HB Europe/Berlin',
  'EDFH DE-RP Europe/Berlin',
  'EDFM DE-BW Europe/Berlin',
  'EDHL DE-SH Europe/Berlin',
  'EDJA DE-BY Europe/Berlin',
  'EDLP DE-NW Europe/Berlin',
  'EDLV DE-NW Europe/Berlin',
  'EDLW DE-NW Europe/Berlin',
  'EDNY DE-BW Europe/Berlin',
  'EDSB DE-BW Europe/Berlin',
  'EDVK DE-HE Europe/Berlin',
  'EEKE EE-74 Europe/Tallinn',
  'EEPU EE-67 Europe/Tallinn',
  'EETU EE-7B Europe/Tallinn',
  'EHBK NL-LI Europe/Amsterdam',
  'EKCH DK-84 Europe/Copenhagen',
  'EKRK DK-85 Europe/Copenhagen',
  'EKRN DK-84 Europe/Copenhagen',
  'ELLX LU-L Europe/Luxembourg',
  'EPBY PL-KP Europe/Warsaw',
  'EPGD PL-PM Europe/Warsaw',
  'EPKK PL-MA Europe/Warsaw',
  'EPKT PL-SL Europe/Warsaw',
  'EPLB PL-LU Europe/Warsaw',
  'EPLL PL-LD Europe/Warsaw',
  'EPMO PL-MZ Europe/Warsaw',
  'EPPO PL-WP Europe/Warsaw',
  'EPRA PL-MZ Europe/Warsaw',
  'EPRZ PL-PK Europe/Warsaw',
  'EPSC PL-ZP Europe/Warsaw',
  'EPSY PL-WN Europe/Warsaw',
  'EPWA PL-MZ Europe/Warsaw',
  'EPWR PL-DS Europe/Warsaw',
  'EPZG PL-LB Europe/Warsaw',
  'ESDF SE-K Europe/Stockholm',
  'ESMQ SE-H Europe/Stockholm',
  'ESMS SE-M Europe/Stockholm',
  'ESMX SE-G Europe/Stockholm',
  'ESSV SE-I Europe/Stockholm',
  'ETMN DE-NI Europe/Berlin',
  'ETNL DE-MV Europe/Berlin',
  'EVRA LV-062 Europe/Riga',
  'EYKA LT-KU Europe/Vilnius',
  'EYPA LT-KL Europe/Vilnius',
  'EYVI LT-VL Europe/Vilnius',
  'HEAT EG-AST Africa/Cairo',
  'HEBL EG-ASN Africa/Cairo',
  'HEGN EG-BA Africa/Cairo',
  'HELX EG-LX Africa/Cairo',
  'HEMA EG-BA Africa/Cairo',
  'HESG EG-SHG Africa/Cairo',
  'HESN EG-ASN Africa/Cairo',
  'HLKF LY-KF Africa/Tripoli',
  'HLLM LY-TB Africa/Tripoli',
  'HLLS LY-SB Africa/Tripoli',
  'HLTD LY-NL Africa/Tripoli',
  'HSDN SD-01 Africa/Khartoum',
  'HSPN SD-26 Africa/Khartoum',
  'LDPL HR-18 Europe/Zagreb',
  'LDRI HR-08 Europe/Zagreb',
  'LDZA HR-01 Europe/Zagreb',
  'LEGE ES-CT Europe/Madrid',
  'LEMH ES-IB Europe/Madrid',
  'LEPA ES-IB Europe/Madrid',
  'LFCK FR-OCC Europe/Paris',
  'LFCR FR-OCC Europe/Paris',
  'LFGJ FR-BFC Europe/Paris',
  'LFJL FR-GES Europe/Paris',
  'LFKB FR-COR Europe/Paris',
  'LFKC FR-COR Europe/Paris',
  'LFKF FR-COR Europe/Paris',
  'LFKJ FR-COR Europe/Paris',
  'LFLB FR-ARA Europe/Paris',
  'LFLC FR-ARA Europe/Paris',
  'LFLL FR-ARA Europe/Paris',
  'LFLP FR-ARA Europe/Paris',
  'LFLS FR-ARA Europe/Paris',
  'LFLW FR-ARA Europe/Paris',
  'LFMK FR-OCC Europe/Paris',
  'LFML FR-PAC Europe/Paris',
  'LFMN FR-PAC Europe/Paris',
  'LFMP FR-OCC Europe/Paris',
  'LFMT FR-OCC Europe/Paris',
  'LFMU FR-OCC Europe/Paris',
  'LFMV FR-PAC Europe/Paris',
  'LFOK FR-GES Europe/Paris',
  'LFSB FR-GES Europe/Paris',
  'LFST FR-GES Europe/Paris',
  'LFTH FR-PAC Europe/Paris',
  'LFTW FR-OCC Europe/Paris',
  'LHSM HU-ZA Europe/Budapest',
  'LIBP IT-65 Europe/Rome',
  'LICB IT-82 Europe/Rome',
  'LICD IT-82 Europe/Rome',
  'LICG IT-82 Europe/Rome',
  'LICJ IT-82 Europe/Rome',
  'LICT IT-82 Europe/Rome',
  'LIEA IT-88 Europe/Rome',
  'LIEE IT-88 Europe/Rome',
  'LIEO IT-88 Europe/Rome',
  'LIMC IT-25 Europe/Rome',
  'LIME IT-25 Europe/Rome',
  'LIMF IT-21 Europe/Rome',
  'LIMJ IT-42 Europe/Rome',
  'LIML IT-25 Europe/Rome',
  'LIMP IT-45 Europe/Rome',
  'LIMZ IT-21 Europe/Rome',
  'LIPB IT-32 Europe/Rome',
  'LIPE IT-45 Europe/Rome',
  'LIPH IT-34 Europe/Rome',
  'LIPK IT-45 Europe/Rome',
  'LIPO IT-25 Europe/Rome',
  'LIPQ IT-36 Europe/Rome',
  'LIPR IT-45 Europe/Rome',
  'LIPX IT-34 Europe/Rome',
  'LIPY IT-57 Europe/Rome',
  'LIPZ IT-34 Europe/Rome',
  'LIRA IT-62 Europe/Rome',
  'LIRF IT-62 Europe/Rome',
  'LIRJ IT-52 Europe/Rome',
  'LIRP IT-52 Europe/Rome',
  'LIRQ IT-52 Europe/Rome',
  'LIRZ IT-55 Europe/Rome',
  'LJLJ SI-012 Europe/Ljubljana',
  'LJMB SI-160 Europe/Ljubljana',
  'LKCS CZ-JC Europe/Prague',
  'LKKV CZ-KA Europe/Prague',
  'LKMT CZ-MO Europe/Prague',
  'LKPD CZ-PA Europe/Prague',
  'LKPR CZ-PR Europe/Prague',
  'LKTB CZ-JM Europe/Prague',
  'LMML MT-25 Europe/Malta',
  'LOWG AT-6 Europe/Vienna',
  'LOWI AT-7 Europe/Vienna',
  'LOWK AT-2 Europe/Vienna',
  'LOWL AT-4 Europe/Vienna',
  'LOWS AT-5 Europe/Vienna',
  'LOWW AT-9 Europe/Vienna',
  'LSGG CH-GE Europe/Zurich',
  'LSZA CH-TI Europe/Zurich',
  'LSZB CH-BE Europe/Zurich',
  'LSZH CH-ZH Europe/Zurich',
  'LSZR CH-SG Europe/Zurich',
  'LZIB SK-BL Europe/Bratislava',
  'LZSL SK-BC Europe/Bratislava',
  'LZTT SK-PV Europe/Bratislava',
  'OAHR AF-HER Asia/Kabul',
  'OBBI BH-15 Asia/Bahrain',
  'OEAH SA-04 Asia/Riyadh',
  'OEAO SA-03 Asia/Riyadh',
  'OEBA SA-11 Asia/Riyadh',
  'OEBH SA-14 Asia/Riyadh',
  'OEDF SA-04 Asia/Riyadh',
  'OEDM SA-01 Asia/Riyadh',
  'OEGS SA-05 Asia/Riyadh',
  'OEHL SA-06 Asia/Riyadh',
  'OEJN SA-02 Asia/Riyadh',
  'OEKK SA-04 Asia/Riyadh',
  'OEMA SA-03 Asia/Riyadh',
  'OEPA SA-04 Asia/Riyadh',
  'OERK SA-01 Asia/Riyadh',
  'OERS SA-07 Asia/Riyadh',
  'OETF SA-02 Asia/Riyadh',
  'OEWD SA-01 Asia/Riyadh',
  'OEWJ SA-07 Asia/Riyadh',
  'OEYN SA-03 Asia/Riyadh',
  'OIAH IR-17 Asia/Tehran',
  'OIBA IR-22 Asia/Tehran',
  'OIBB IR-18 Asia/Tehran',
  'OIBK IR-22 Asia/Tehran',
  'OIBL IR-22 Asia/Tehran',
  'OIBP IR-18 Asia/Tehran',
  'OIBQ IR-18 Asia/Tehran',
  'OIKB IR-22 Asia/Tehran',
  'OIKK IR-08 Asia/Tehran',
  'OIKM IR-08 Asia/Tehran',
  'OIKQ IR-22 Asia/Tehran',
  'OIKR IR-08 Asia/Tehran',
  'OIMB IR-29 Asia/Tehran',
  'OIMM IR-09 Asia/Tehran',
  'OIMN IR-28 Asia/Tehran',
  'OIMS IR-09 Asia/Tehran',
  'OISL IR-07 Asia/Tehran',
  'OISR IR-07 Asia/Tehran',
  'OISS IR-07 Asia/Tehran',
  'OIYY IR-21 Asia/Tehran',
  'OIZH IR-11 Asia/Tehran',
  'OMAA AE-AZ Asia/Dubai',
  'OMAL AE-AZ Asia/Dubai',
  'OMDB AE-DU Asia/Dubai',
  'OMDW AE-DU Asia/Dubai',
  'OMFJ AE-FU Asia/Dubai',
  'OMRK AE-RK Asia/Dubai',
  'OMSJ AE-SH Asia/Dubai',
  'OOKB OM-MU Asia/Muscat',
  'OOSH OM-BA Asia/Muscat',
  'OTBD QA-DA Asia/Qatar',
  'OTHH QA-DA Asia/Qatar',
  'UAOL KZ-BAY Asia/Qyzylorda',
  'UAOO KZ-KZY Asia/Qyzylorda',
  'UARR KZ-ZAP Asia/Oral',
  'UATG KZ-ATY Asia/Atyrau',
  'UATT KZ-AKT Asia/Aqtobe',
  'ULOO RU-PSK Europe/Moscow',
  'ULWC RU-VLG Europe/Moscow',
  'UMBB BY-BR Europe/Minsk',
  'UMGG BY-HO Europe/Minsk',
  'UMKK RU-KGD Europe/Kaliningrad',
  'UMMS BY-MI Europe/Minsk',
  'UMOO BY-MA Europe/Minsk',
  'USCM RU-BA Asia/Yekaterinburg',
  'USII RU-UD Europe/Samara',
  'UTAA TM-S Asia/Ashgabat',
  'UTAM TM-M Asia/Ashgabat',
  'UTAT TM-D Asia/Ashgabat',
  'UTAV TM-L Asia/Ashgabat',
  'UUBA RU-KOS Europe/Moscow',
  'UUBI RU-IVA Europe/Moscow',
  'UUBW RU-MOS Europe/Moscow',
  'UUDD RU-MOS Europe/Moscow',
  'UUDL RU-YAR Europe/Moscow',
  'UUEE RU-MOS Europe/Moscow',
  'UUOO RU-VOR Europe/Moscow',
  'UUWW RU-MOW Europe/Moscow',
  'UWGG RU-NIZ Europe/Moscow',
  'UWKB RU-TA Europe/Moscow',
  'UWKD RU-TA Europe/Moscow',
  'UWKE RU-TA Europe/Moscow',
  'UWKS RU-CU Europe/Moscow',
  'UWLL RU-ULY Europe/Ulyanovsk',
  'UWLW RU-ULY Europe/Ulyanovsk',
  'UWOO RU-ORE Asia/Yekaterinburg',
  'UWOR RU-ORE Asia/Yekaterinburg',
  'UWPP RU-PNZ Europe/Moscow',
  'UWPS RU-MO Europe/Moscow',
  'UWSB RU-SAR Europe/Saratov',
  'UWSG RU-SAR Europe/Saratov',
  'UWUU RU-BA Asia/Yekaterinburg',
  'UWWW RU-SAM Europe/Samara',
  'UZNN UZ-QR Asia/Samarkand',
  'UZNU UZ-XO Asia/Samarkand',
  'UZSA UZ-NW Asia/Samarkand',
  'UZSB UZ-BU Asia/Samarkand',
  'UZSS UZ-SA Asia/Samarkand',
]

const expected = RING_AIRPORTS.map((line) => {
  const [icao = '', isoRegion = '', zone = ''] = line.split(' ')
  return { icao, isoRegion, country: isoRegion.split('-')[0] ?? '', zone }
})
const expectedByIcao = new Map(expected.map((a) => [a.icao, a]))

/** UTC farkı, dakika, verilen anda (`Intl`). */
const offset = (iso: string, zone: string) => localTime(iso, zone).utcOffsetMinutes

/** Çalışma zamanının ülke dilimleri (Node 24: `Intl.Locale#getTimeZones()`; Firefox'ta yok). */
function runtimeZones(country: string): string[] | undefined {
  const locale = new Intl.Locale(`und-${country}`) as Intl.Locale & {
    getTimeZones?: () => string[]
    timeZones?: string[]
  }
  return typeof locale.getTimeZones === 'function' ? locale.getTimeZones() : locale.timeZones
}
const hasRuntimeZones = runtimeZones('GR') !== undefined

describe('saat dilimi tabloları', () => {
  const allZones = [
    ...Object.values(COUNTRY_TIME_ZONES),
    ...Object.values(REGION_TIME_ZONES),
    ...Object.values(AIRPORT_TIME_ZONES),
  ]

  it('her dilim çalışma zamanının listesinde ve biçimlendirilebilir', () => {
    const supported = new Set(Intl.supportedValuesOf('timeZone'))
    for (const zone of new Set(allZones)) {
      expect(supported.has(zone), zone).toBe(true)
      expect(isSupportedTimeZone(zone), zone).toBe(true)
    }
  })

  it('216 tek dilimli ülke ve Kosova; Türkiye Europe/Istanbul', () => {
    expect(Object.keys(COUNTRY_TIME_ZONES)).toHaveLength(217)
    expect(COUNTRY_TIME_ZONES.TR).toBe('Europe/Istanbul')
    expect(COUNTRY_TIME_ZONES.XK).toBe('Europe/Belgrade')
    for (const code of Object.keys(COUNTRY_TIME_ZONES)) expect(code).toMatch(/^[A-Z]{2}$/)
    // Tek istisna Fransız Polinezyası'dır (D-109): OurAirports bütün ülkeye ISO'da olmayan tek bir
    // "atanmamış" kod verir (PF-U-A).
    const regionKeys = Object.keys(REGION_TIME_ZONES)
    expect(regionKeys.filter((code) => !/^[A-Z]{2}-[A-Z0-9]+$/.test(code))).toEqual(['PF-U-A'])
    for (const code of regionKeys) expect(code).toMatch(/^[A-Z]{2}-([A-Z0-9]+|U-A)$/)
    for (const code of Object.keys(AIRPORT_TIME_ZONES)) expect(code).toMatch(/^[A-Z0-9]{4}$/)
  })

  it.runIf(hasRuntimeZones)(
    'ülke tablosu çalışma zamanının ülke dilimleriyle aynı (tzdb zone.tab)',
    () => {
      for (const [country, zone] of Object.entries(COUNTRY_TIME_ZONES)) {
        // XK tzdb'de yoktur (Intl boş liste verir); Belgrad kuralı elle yazılmıştır.
        if (country === 'XK') {
          expect(runtimeZones(country)).toEqual([])
          continue
        }
        expect(runtimeZones(country), country).toEqual([zone])
      }
    },
  )

  it.runIf(hasRuntimeZones)(
    'bölge ve havalimanı kuralları yalnızca çok dilimli ülkelerde ve o ülkenin dilimleriyle',
    () => {
      for (const [region, zone] of Object.entries(REGION_TIME_ZONES)) {
        const country = region.split('-')[0] ?? ''
        expect(Object.hasOwn(COUNTRY_TIME_ZONES, country), region).toBe(false)
        expect(runtimeZones(country), region).toContain(zone)
      }
      // Kıbrıs'ın iki dilimi; Sohum bilinçli istisnadır (Gürcistan tek dilimli, kullanıcı kararı).
      expect(runtimeZones('CY')).toEqual(
        expect.arrayContaining([AIRPORT_TIME_ZONES.LCEN, AIRPORT_TIME_ZONES.LCLK]),
      )
    },
  )
})

describe('airportTimeZone', () => {
  it('1., 2. ve 3. halkanın 442 havalimanı beklenen dilimde', () => {
    expect(expected).toHaveLength(442)
    expect(expectedByIcao.size).toBe(442)
    for (const airport of expected) {
      expect(airportTimeZone(airport), airport.icao).toBe(airport.zone)
    }
  })

  it('kural sırası: havalimanı, bölge, ülke; kodlar kırpılır ve büyük harfe çevrilir', () => {
    // Sohum: ülke Gürcistan (Asia/Tbilisi, UTC+4), havalimanı kuralı Moskova saati.
    expect(airportTimeZone({ icao: 'UGSS', country: 'GE', isoRegion: 'GE-AB' })).toBe(
      'Europe/Moscow',
    )
    expect(airportTimeZone({ icao: 'UGTB', country: 'GE', isoRegion: 'GE-TB' })).toBe(
      'Asia/Tbilisi',
    )
    expect(airportTimeZone({ icao: ' lcen ', country: 'cy', isoRegion: 'cy-02' })).toBe(
      'Asia/Famagusta',
    )
    expect(airportTimeZone({ icao: 'URWA', country: 'RU', isoRegion: 'RU-AST' })).toBe(
      'Europe/Astrakhan',
    )
    expect(airportTimeZone({ icao: 'LTFM', country: 'TR', isoRegion: 'TR-34' })).toBe(
      'Europe/Istanbul',
    )
    expect(airportTimeZone({ icao: 'LTFM', country: 'TR' })).toBe('Europe/Istanbul')
    // 3. halka (D-090): Almanya'da OurAirports'un Brandenburg kodu da kuraldır; Rusya'nın dört
    // dilimi; Kazakistan ve Özbekistan bölge kuralıyla.
    expect(airportTimeZone({ icao: 'EDDB', country: 'DE', isoRegion: 'DE-BR' })).toBe(
      'Europe/Berlin',
    )
    expect(airportTimeZone({ icao: 'EDDF', country: 'DE', isoRegion: 'DE-HE' })).toBe(
      'Europe/Berlin',
    )
    expect(airportTimeZone({ icao: 'UUEE', country: 'RU', isoRegion: 'RU-MOS' })).toBe(
      'Europe/Moscow',
    )
    expect(airportTimeZone({ icao: 'UWWW', country: 'RU', isoRegion: 'RU-SAM' })).toBe(
      'Europe/Samara',
    )
    expect(airportTimeZone({ icao: 'UWUU', country: 'RU', isoRegion: 'RU-BA' })).toBe(
      'Asia/Yekaterinburg',
    )
    expect(airportTimeZone({ icao: 'UMKK', country: 'RU', isoRegion: 'RU-KGD' })).toBe(
      'Europe/Kaliningrad',
    )
    expect(airportTimeZone({ icao: 'UAOL', country: 'KZ', isoRegion: 'KZ-BAY' })).toBe(
      'Asia/Qyzylorda',
    )
    expect(airportTimeZone({ icao: 'UZSS', country: 'UZ', isoRegion: 'UZ-SA' })).toBe(
      'Asia/Samarkand',
    )
    expect(airportTimeZone({ icao: 'LEPA', country: 'ES', isoRegion: 'ES-IB' })).toBe(
      'Europe/Madrid',
    )
    // Tek dilimli ülkeler bölgesiz de: Herat, Dubai, Cezayir.
    expect(airportTimeZone({ icao: 'OAHR', country: 'AF' })).toBe('Asia/Kabul')
    expect(airportTimeZone({ icao: 'OMDB', country: 'AE' })).toBe('Asia/Dubai')
    expect(airportTimeZone({ icao: 'DAAE', country: 'DZ' })).toBe('Africa/Algiers')
  })

  it('kuralı olmayan çok dilimli ülke, bilinmeyen ülke ve boş kod null', () => {
    // Rusya'nın kuralı yazılmamış bölgesi (Leningrad oblastı; 5. halkayla Habarovsk ve New York'un
    // kuralı var, D-109), bölgesiz Almanya (Büsingen ikinci dilimdir), Özbekistan'ın Taşkent şehri
    // kodu (OurAirports Taşkent'i UZ-TO'ya yazar), ABD'de OurAirports'un "atanmamış" kodu, Kıbrıs'ın
    // havalimanı kuralı olmayan bir alanı, bölgesiz Ukrayna (iki dilim; bölgeleri D-110'dan beri
    // kurallı), Grönland'ın kuralı olmayan bölgesi, bilinmeyen kod.
    expect(airportTimeZone({ icao: 'ULLX', country: 'RU', isoRegion: 'RU-LEN' })).toBeNull()
    expect(airportTimeZone({ icao: 'BGSF', country: 'GL', isoRegion: 'GL-QE' })).toBeNull()
    expect(airportTimeZone({ icao: 'EDDF', country: 'DE' })).toBeNull()
    expect(airportTimeZone({ icao: 'UTTT', country: 'UZ', isoRegion: 'UZ-TK' })).toBeNull()
    expect(airportTimeZone({ icao: 'KXXX', country: 'US', isoRegion: 'US-U-A' })).toBeNull()
    expect(airportTimeZone({ icao: 'UHHH', country: 'RU', isoRegion: 'RU-KHA' })).toBe(
      'Asia/Vladivostok',
    )
    expect(airportTimeZone({ icao: 'KJFK', country: 'US', isoRegion: 'US-NY' })).toBe(
      'America/New_York',
    )
    expect(airportTimeZone({ icao: 'LCRA', country: 'CY', isoRegion: 'CY-06' })).toBeNull()
    expect(airportTimeZone({ icao: 'UKXX', country: 'UA', isoRegion: null })).toBeNull()
    expect(airportTimeZone({ icao: 'UKBB', country: 'UA', isoRegion: 'UA-32' })).toBe('Europe/Kiev')
    expect(airportTimeZone({ icao: 'XXXX', country: 'ZZ', isoRegion: 'ZZ-1' })).toBeNull()
    expect(airportTimeZone({ icao: '', country: '', isoRegion: null })).toBeNull()
    // Nesne prototipinin anahtarları tablo kaydı sayılmaz.
    expect(airportTimeZone({ icao: 'constructor', country: 'toString' })).toBeNull()
  })

  it('çalışma zamanının tanımadığı dilim null (eski tarayıcı)', () => {
    expect(isSupportedTimeZone('Mars/Olympus_Mons')).toBe(false)
    expect(isSupportedTimeZone('Europe/Athens')).toBe(true)
  })
})

describe('yerel saat ve UTC farkı (Intl, yaz saati dahil)', () => {
  it('Atina yazın UTC+3, 25 Ekim 2026 01:00 UTC’den sonra UTC+2', () => {
    expect(offset('2026-10-24T12:00:00Z', 'Europe/Athens')).toBe(180)
    expect(offset('2026-10-25T00:59:00Z', 'Europe/Athens')).toBe(180)
    expect(offset('2026-10-25T01:00:00Z', 'Europe/Athens')).toBe(120)
    expect(offset('2026-10-26T12:00:00Z', 'Europe/Athens')).toBe(120)
    expect(localTime('2026-10-26T21:05:00Z', 'Europe/Athens').hhmm).toBe('23:05')
  })

  it('Tahran UTC+3:30 (yaz saati yok), Astrahan UTC+4, Grozni ve Volgograd UTC+3, Aktav UTC+5', () => {
    for (const at of ['2026-01-15T12:00:00Z', '2026-07-15T12:00:00Z']) {
      expect(offset(at, 'Asia/Tehran')).toBe(210)
      expect(offset(at, 'Europe/Astrakhan')).toBe(240)
      expect(offset(at, 'Europe/Moscow')).toBe(180)
      expect(offset(at, 'Europe/Volgograd')).toBe(180)
      expect(offset(at, 'Asia/Aqtau')).toBe(300)
      expect(offset(at, 'Europe/Istanbul')).toBe(180)
    }
  })

  it('3. halka: Samara, Saratov, Ulyanovsk UTC+4; Ufa ve Orenburg UTC+5; Kaliningrad UTC+2; Herat UTC+4:30', () => {
    for (const at of ['2026-01-15T12:00:00Z', '2026-07-15T12:00:00Z']) {
      expect(offset(at, 'Europe/Samara')).toBe(240)
      expect(offset(at, 'Europe/Saratov')).toBe(240)
      expect(offset(at, 'Europe/Ulyanovsk')).toBe(240)
      expect(offset(at, 'Asia/Yekaterinburg')).toBe(300)
      expect(offset(at, 'Europe/Kaliningrad')).toBe(120)
      expect(offset(at, 'Asia/Kabul')).toBe(270)
      expect(offset(at, 'Asia/Dubai')).toBe(240)
      expect(offset(at, 'Asia/Samarkand')).toBe(300)
      // Kazakistan 2024'ten beri tek saat (UTC+5): Kızılorda, Aktöbe, Atırav, Oral.
      expect(offset(at, 'Asia/Qyzylorda')).toBe(300)
      expect(offset(at, 'Asia/Aqtobe')).toBe(300)
      expect(offset(at, 'Asia/Atyrau')).toBe(300)
      expect(offset(at, 'Asia/Oral')).toBe(300)
      // Cezayir ve Tunus yaz saati uygulamaz.
      expect(offset(at, 'Africa/Algiers')).toBe(60)
      expect(offset(at, 'Africa/Tunis')).toBe(60)
    }
    // Frankfurt kışın UTC+1, yazın UTC+2 (25 Ekim 2026 01:00 UTC'de değişir).
    expect(offset('2026-10-25T00:59:00Z', 'Europe/Berlin')).toBe(120)
    expect(offset('2026-10-25T01:00:00Z', 'Europe/Berlin')).toBe(60)
  })

  it('Ercan (Asia/Famagusta) Lefkoşa ile aynı; Kahire 29 Ekim 2026 gecesine kadar UTC+3', () => {
    for (const at of ['2026-01-15T12:00:00Z', '2026-07-15T12:00:00Z', '2026-10-26T12:00:00Z']) {
      expect(offset(at, 'Asia/Famagusta')).toBe(offset(at, 'Asia/Nicosia'))
    }
    expect(offset('2026-10-29T12:00:00Z', 'Africa/Cairo')).toBe(180)
    expect(offset('2026-10-30T12:00:00Z', 'Africa/Cairo')).toBe(120)
  })
})

// Commit'li OurAirports alt kümesi (tools/fixtures/README.md); foreign.test.ts ile aynı okuma.
const rows = (() => {
  const text = readFileSync(
    new URL('../../../../tools/fixtures/ourairports/airports.csv', import.meta.url),
    'utf8',
  )
  const [header = '', ...lines] = text.split(/\r?\n/)
  const columns = header.slice(1, -1).split('","')
  return lines.filter(Boolean).map((line) => {
    const values = line
      .slice(1, -1)
      .split('","')
      .map((v) => v.replaceAll('""', '"'))
    return new Map(columns.map((column, i) => [column, values[i] ?? '']))
  })
})()
const icaoOf = (r: Map<string, string>) =>
  ourAirportsIcao({
    ident: r.get('ident') ?? '',
    icaoCode: r.get('icao_code'),
    gpsCode: r.get('gps_code'),
  })
const fixtureAirport = (r: Map<string, string>) => ({
  icao: icaoOf(r),
  country: r.get('iso_country') ?? '',
  isoRegion: r.get('iso_region') ?? '',
})

/** Büyük daire, km (foreign.test.ts ile aynı). */
function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)))
}
const position = (r: Map<string, string>) => ({
  lat: Number(r.get('latitude_deg')),
  lon: Number(r.get('longitude_deg')),
})

const turkish = rows.filter((r) => r.get('iso_country') === 'TR')
/** Halka analizinin uzaklık referansları: Türkiye'deki IATA kodlu büyük, orta ve küçük alanlar. */
const references = turkish
  .filter((r) => ['large_airport', 'medium_airport', 'small_airport'].includes(r.get('type') ?? ''))
  .filter((r) => /^[A-Z]{3}$/.test((r.get('iata_code') ?? '').trim().toUpperCase()))
  .map(position)
const distanceToTurkey = (r: Map<string, string>) =>
  Math.min(...references.map((tr) => km(position(r), tr)))

describe('fixture: listelenen her havalimanının dilimi var', () => {
  it('Türkiye havalimanları Europe/Istanbul', () => {
    expect(turkish.length).toBeGreaterThan(60)
    for (const r of turkish) {
      expect(airportTimeZone(fixtureAirport(r)), icaoOf(r)).toBe('Europe/Istanbul')
    }
  })

  it('açık halkalardaki yabancı havalimanları beklenen dilimde (halka açılınca liste büyür)', () => {
    const listed = rows
      .filter((r) => r.get('iso_country') !== 'TR')
      .filter((r) =>
        isForeignCandidate(
          r.get('type') ?? '',
          r.get('scheduled_service') === 'yes',
          r.get('iata_code'),
          icaoOf(r),
        ),
      )
      .filter((r) => airportRing(distanceToTurkey(r)) <= ENABLED_AIRPORT_RING)
    // M6i.2'den beri 1.–4. halka açık: 75 + 89 + 278 + 719 (D-088, D-090, D-102) ve savaş nedeniyle
    // kapalı 23 havalimanı (D-110); 1.–3. halka `expected` tablosunda, 4. halka
    // `RING_FOUR_ZONES`'ta, kapanış tablosunun tarifesizleri `WAR_CLOSURE_ZONES`'tadır.
    expect(listed).toHaveLength(1184)
    for (const r of listed) {
      const airport = fixtureAirport(r)
      const zone = airportTimeZone(airport)
      expect(zone, airport.icao).not.toBeNull()
      expect(zone, airport.icao).toBe(
        expectedByIcao.get(airport.icao)?.zone ??
          ringFourZone(airport.icao) ??
          warClosureByIcao.get(airport.icao)?.zone,
      )
    }
  })
})

/**
 * Savaş nedeniyle kapalı, OurAirports'ta tarifesiz 23 havalimanı (D-110; kapanış tablosu
 * `CIVIL_FLIGHT_CLOSURES`, fixture'ın kapanış bloğu): "ICAO bölge dilim". Halka tabloları
 * (`RING_AIRPORTS`, `RING_FOUR_ZONES`) halka analizinin adaylarını sayar, bunlar orada yoktur.
 * Ukrayna tzdb `zone.tab`'a göre (Kırım Europe/Simferopol, öbürleri Europe/Kiev; Intl yazımı),
 * Harkiv'in OurAirports bölgesi "atanmamış" (UA-U-A, havalimanı kuralı), Rivne'ninki OurAirports
 * kodu UA-19 (ISO UA-56).
 */
const WAR_CLOSURE_ZONES: readonly string[] = [
  'FZMA CD-SK Africa/Lubumbashi',
  'UKBB UA-32 Europe/Kiev',
  'UKDD UA-12 Europe/Kiev',
  'UKDE UA-23 Europe/Kiev',
  'UKDR UA-12 Europe/Kiev',
  'UKFF UA-43 Europe/Simferopol',
  'UKHH UA-U-A Europe/Kiev',
  'UKKK UA-30 Europe/Kiev',
  'UKLI UA-26 Europe/Kiev',
  'UKLL UA-46 Europe/Kiev',
  'UKLN UA-77 Europe/Kiev',
  'UKLR UA-19 Europe/Kiev',
  'UKLU UA-21 Europe/Kiev',
  'UKOH UA-65 Europe/Kiev',
  'UKON UA-48 Europe/Kiev',
  'UKOO UA-51 Europe/Kiev',
  'UKWW UA-05 Europe/Kiev',
  'URKA RU-KDA Europe/Moscow',
  'URRP RU-ROS Europe/Moscow',
  'UUBP RU-BRY Europe/Moscow',
  'UUOB RU-BEL Europe/Moscow',
  'UUOK RU-KRS Europe/Moscow',
  'UUOL RU-LIP Europe/Moscow',
]
const warClosureByIcao = new Map(
  WAR_CLOSURE_ZONES.map((line) => {
    const [icao = '', isoRegion = '', zone = ''] = line.split(' ')
    return [icao, { icao, isoRegion, zone }] as const
  }),
)

/** ISO 3166-2:UA: 24 bölge, Kırım Özerk Cumhuriyeti, Kiev ve Sivastopol şehirleri (27 kod). */
const UKRAINE_ISO_REGIONS = [
  ...['UA-05', 'UA-07', 'UA-09', 'UA-12', 'UA-14', 'UA-18', 'UA-21', 'UA-23', 'UA-26'],
  ...['UA-30', 'UA-32', 'UA-35', 'UA-40', 'UA-43', 'UA-46', 'UA-48', 'UA-51', 'UA-53'],
  ...['UA-56', 'UA-59', 'UA-61', 'UA-63', 'UA-65', 'UA-68', 'UA-71', 'UA-74', 'UA-77'],
]

describe('savaş nedeniyle kapalı havalimanlarının saat dilimleri (D-110)', () => {
  const closures = rows
    .filter((r) => r.get('iso_country') !== 'TR' && r.get('scheduled_service') !== 'yes')
    .filter((r) =>
      isForeignCandidate(
        r.get('type') ?? '',
        r.get('scheduled_service') === 'yes',
        r.get('iata_code'),
        icaoOf(r),
      ),
    )

  it("fixture'daki 23 tarifesiz kapanış kaydı beklenen dilimde; hepsi açık halkada", () => {
    expect(closures.map(icaoOf).sort()).toEqual([...warClosureByIcao.keys()].sort())
    for (const r of closures) {
      const airport = fixtureAirport(r)
      const expectedRow = warClosureByIcao.get(airport.icao)
      expect(airport.isoRegion, airport.icao).toBe(expectedRow?.isoRegion)
      expect(airportTimeZone(airport), airport.icao).toBe(expectedRow?.zone)
      expect(airportRing(distanceToTurkey(r)), airport.icao).toBeLessThanOrEqual(4)
    }
  })

  it('33 bölge kuralı (Ukrayna 28, Rusya 4, Kongo DC 1) ve Harkiv havalimanı kuralı', () => {
    const ukraine = Object.keys(REGION_TIME_ZONES).filter((code) => code.startsWith('UA-'))
    // Ukrayna'nın her ISO kodu ve OurAirports'un Rivne kodu: ülkenin her bölgesinin kuralı var.
    expect(ukraine.toSorted()).toEqual([...UKRAINE_ISO_REGIONS, 'UA-19'].sort())
    expect(Object.hasOwn(COUNTRY_TIME_ZONES, 'UA')).toBe(false)
    for (const code of ukraine) {
      expect(REGION_TIME_ZONES[code], code).toBe(
        code === 'UA-40' || code === 'UA-43' ? 'Europe/Simferopol' : 'Europe/Kiev',
      )
    }
    for (const code of ['RU-BEL', 'RU-BRY', 'RU-KRS', 'RU-LIP']) {
      expect(REGION_TIME_ZONES[code], code).toBe('Europe/Moscow')
    }
    expect(REGION_TIME_ZONES['CD-SK']).toBe('Africa/Lubumbashi')
    expect(AIRPORT_TIME_ZONES.UKHH).toBe('Europe/Kiev')
    // Ad Intl'in yazımıdır: tzdb'deki Europe/Kyiv'i ICU Europe/Kiev diye verir.
    const kyiv = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Kyiv' })
    expect(kyiv.resolvedOptions().timeZone).toBe('Europe/Kiev')
    expect(Object.values(REGION_TIME_ZONES)).not.toContain('Europe/Kyiv')
  })

  it('Kiev yazın UTC+3, 25 Ekim 2026’dan sonra UTC+2; Simferopol bütün yıl UTC+3; Bukavu UTC+2', () => {
    expect(offset('2026-10-24T12:00:00Z', 'Europe/Kiev')).toBe(180)
    expect(offset('2026-10-25T01:00:00Z', 'Europe/Kiev')).toBe(120)
    expect(offset('2026-01-15T12:00:00Z', 'Europe/Kiev')).toBe(120)
    expect(offset('2026-01-15T12:00:00Z', 'Europe/Simferopol')).toBe(180)
    expect(offset('2026-07-15T12:00:00Z', 'Europe/Simferopol')).toBe(180)
    expect(offset('2026-07-15T12:00:00Z', 'Africa/Lubumbashi')).toBe(120)
  })
})

/**
 * 4. halkanın 720 adayı (D-080 kuralı, ICAO koşulu olmadan; UG-0002 dahil, D-101), dilime göre:
 * M6i araştırmasının önerisi (`Intl.Locale#getTimeZones()` ve tzdb ülke tablosu; Node 24.16, ICU
 * 78.3, tzdata 2026b). Tablo halka açılmadan önce (M6i.1) her adayın dilimini sabitledi; halka
 * M6i.2'de açıldı (D-102).
 */
const RING_FOUR_ZONES: Readonly<Record<string, readonly string[]>> = {
  'Africa/Abidjan': ['DIAP DIBK DIKO'],
  'Africa/Accra': ['DGAA DGLE DGSI DGSN DGTK'],
  'Africa/Addis_Ababa': [
    'HAAB HAAM HAAX HABC HABD HADR HAGM HAGN HAGO HAJJ HAJM HAKD HALA HAMK HASO',
  ],
  'Africa/Algiers': [
    'DAAG DAAJ DAAP DAAT DAAY DAOF DAOI DAON DAOO DAOR DATM DAUA DAUE DAUG DAUH',
    'DAUI DAUL DAUT DAUU',
  ],
  'Africa/Asmera': ['HHAS'],
  'Africa/Bamako': ['GABS GAGO GAKD GAMB GATB'],
  'Africa/Bangui': ['FEFF'],
  'Africa/Brazzaville': ['FCBB FCPP'],
  'Africa/Bujumbura': ['HBBA HBBE'],
  'Africa/Casablanca': [
    'GMAD GMAT GMAZ GMFB GMFF GMFK GMFO GMMD GMME GMMI GMMN GMMW GMMX GMMZ GMTA',
    'GMTN GMTT',
  ],
  'Africa/Ceuta': ['GEML'],
  'Africa/Dar_es_Salaam': ['HTAR HTDA HTDO HTKJ HTMW HTTG HTZA'],
  'Africa/Djibouti': ['HDAM'],
  'Africa/Douala': ['FKKD FKKL FKKN FKKR FKYS'],
  'Africa/El_Aaiun': ['GMMA GMMH GMML'],
  'Africa/Juba': ['HJJJ HSSM HSWW'],
  'Africa/Kampala': ['HUAR HUEN HUGU HUSO UG-0002'],
  'Africa/Khartoum': ['HSFS HSKA HSNN HSOB HSSK'],
  'Africa/Kigali': ['HRYR HRZA'],
  'Africa/Kinshasa': ['FZAA FZBO FZCA FZEA FZFD FZFK'],
  'Africa/Lagos': [
    'DNAA DNAI DNAK DNAS DNBC DNBE DNCA DNEN DNGO DNIB DNIL DNIM DNJO DNKA DNKN',
    'DNKT DNMA DNMK DNMM DNPM DNPO DNSO DNSU DNYO',
  ],
  'Africa/Libreville': ['FOGO FOOG FOOK FOOL FOON'],
  'Africa/Lome': ['DXXX'],
  'Africa/Luanda': ['FNDU'],
  'Africa/Lubumbashi': ['FZIC FZJH FZKA FZNA FZOA FZRF FZUA FZWA'],
  'Africa/Malabo': ['FGBT FGCO FGMY FGSL'],
  'Africa/Mogadishu': ['HCMF HCMH HCMI HCMM'],
  'Africa/Nairobi': ['HKAM HKEL HKJK HKKI HKLU HKML HKMO HKMS HKNL HKNW HKWJ'],
  'Africa/Ndjamena': ['FTTJ'],
  'Africa/Niamey': ['DRRN DRZR'],
  'Africa/Nouakchott': ['GQNO GQPP GQPZ'],
  'Africa/Ouagadougou': ['DFFD DFOO'],
  'Africa/Porto-Novo': ['DBBB'],
  'Africa/Sao_Tome': ['FPPR FPST'],
  'America/Godthab': ['BGKK'],
  'America/Scoresbysund': ['BGCO'],
  'Asia/Aden': ['OYAA OYGD OYRN OYSN OYSQ OYSY OYTZ'],
  'Asia/Almaty': ['UAAA UAAH UAAT UACC UACK UACP UADD UAII UAIT UAKD UAKK UASK UASP UASS'],
  'Asia/Barnaul': ['UNBB'],
  'Asia/Bishkek': ['UCFK UCFL UCFM UCFO'],
  'Asia/Calcutta': [
    'VAAH VAAM VAAU VABB VABJ VABO VABP VABV VAGD VAHS VAID VAJB VAJM VAKE VAKP',
    'VAKS VALT VAND VANM VANP VAOZ VAPO VAPR VASD VASU VAUD VEAB VEAP VEAT VEAY',
    'VEBD VEBI VEBN VEBS VEBU VECC VECX VEDG VEDH VEGK VEGT VEGY VEHO VEIM VEJT',
    'VEKO VEKU VELP VELR VEMN VEMR VEPT VERC VERP VERW VETZ VEUK VIAG VIAR VIBR',
    'VIBY VICG VIDN VIDP VIGG VIGR VIHR VIHX VIJO VIJP VIJR VIJU VIKG VILH VILK',
    'VIMB VIND VIPK VIPT VISR VOAT VOBL VOBM VOBZ VOCB VOCI VOCL VOCP VOGA VOGO',
    'VOHB VOHS VOKN VOKU VOMD VOML VOMM VOMY VOPC VORY VOSR VOTP VOTR VOTV VOVI',
  ],
  'Asia/Colombo': ['VCBI VCCC VCCJ VCCT'],
  'Asia/Dhaka': ['VGBR VGCB VGEG VGHS VGJR VGRJ VGSD VGSY'],
  'Asia/Dushanbe': ['UTDD UTDK UTDL UTDT'],
  'Asia/Hovd': ['ZMKD ZMUG ZMUL'],
  'Asia/Irkutsk': ['UIBB UIII UITT UIUU'],
  'Asia/Kabul': ['OAKB OAKN OAKS OAMS'],
  'Asia/Karachi': [
    'OPBW OPCH OPDG OPFA OPGT OPGW OPIS OPKC OPLA OPMT OPNH OPPS OPQT OPRK OPSD',
    'OPSK OPST OPTU OPZB',
  ],
  'Asia/Katmandu': ['VNBW VNJP VNKT VNLK VNNG VNPK VNPR VNTJ VNVT'],
  'Asia/Krasnoyarsk': ['UNAA UNII UNIS UNIW UNKL UNKM UNKY UOHH UOII UOOO'],
  'Asia/Muscat': ['OODQ OOMS OOSA'],
  'Asia/Novokuznetsk': ['UNEE UNWW'],
  'Asia/Novosibirsk': ['UNNT'],
  'Asia/Omsk': ['UNOO'],
  'Asia/Qostanay': ['UAUU'],
  'Asia/Riyadh': ['OEAB OEGN OENG OESH'],
  'Asia/Samarkand': ['UZST'],
  'Asia/Shanghai': [
    'ZLDH ZLDL ZLGL ZLGM ZLHX ZLJC ZLJQ ZLYS ZLZY ZUAL ZUBD ZUDR ZULS ZUNZ ZURK',
    'ZWAK ZWAT ZWBL ZWCM ZWFY ZWHM ZWKL ZWKN ZWNL ZWRQ ZWSC ZWSH ZWTK ZWTL ZWTN',
    'ZWWW ZWYN',
  ],
  'Asia/Tashkent': ['UZFA UZFF UZFN UZTP UZTT UZTZ'],
  'Asia/Tehran': ['OIZC'],
  'Asia/Thimphu': ['VQPR'],
  'Asia/Tomsk': ['UNTT'],
  'Asia/Ulaanbaatar': ['ZMAH ZMAT ZMBH ZMBN ZMCK ZMDZ ZMMN'],
  'Asia/Yekaterinburg': [
    'USCC USDA USDB USDD USHH USHN USHQ USHS USHU USMM USMU USNN USPP USRK USRO',
    'USRR USSS USTJ USTR USUU',
  ],
  'Atlantic/Azores': ['LPAZ LPFL LPGR LPHR LPLA LPPD LPPI LPSJ'],
  'Atlantic/Canary': ['GCFV GCHI GCLA GCLP GCRR GCTS GCXO'],
  'Atlantic/Faeroe': ['EKVG'],
  'Atlantic/Madeira': ['LPMA LPPS'],
  'Atlantic/Reykjavik': ['BIAR BIEG BIGR BIHN BIIS BIKF BIRK BIVO'],
  'Europe/Amsterdam': ['EHAM EHEH EHGG EHRD'],
  'Europe/Berlin': ['EDXW'],
  'Europe/Brussels': ['EBAW EBBR EBCI EBOS'],
  'Europe/Copenhagen': ['EKAH EKBI EKEB EKKA EKOD EKSB EKYT'],
  'Europe/Dublin': ['EICK EIDL EIDW EIKN EIKY EINN'],
  'Europe/Gibraltar': ['LXGB'],
  'Europe/Guernsey': ['EGJA EGJB'],
  'Europe/Helsinki': [
    'EFET EFHK EFIV EFJO EFJY EFKE EFKI EFKK EFKS EFKT EFKU EFLP EFMA EFOU EFPO',
    'EFRO EFSA EFTP EFTU EFVA',
  ],
  'Europe/Isle_of_Man': ['EGNS'],
  'Europe/Jersey': ['EGJJ'],
  'Europe/Kirov': ['USKK'],
  'Europe/Lisbon': ['LPBG LPCS LPFR LPPM LPPR LPPT LPVR LPVZ'],
  'Europe/London': [
    'EGAA EGAC EGAE EGBB EGCC EGEC EGED EGFF EGGD EGGP EGGW EGHH EGHI EGHQ EGKK',
    'EGLC EGLL EGMC EGNJ EGNM EGNT EGNV EGNX EGPA EGPB EGPC EGPD EGPE EGPF EGPH',
    'EGPI EGPK EGPL EGPN EGPO EGPR EGPU EGSH EGSS EGTE',
  ],
  'Europe/Madrid': [
    'LEAL LEAM LEAS LEBA LEBB LEBL LEBZ LECH LECO LEDA LEGR LEIB LEJR LELN LEMD',
    'LEMG LEMI LEPP LERJ LERS LESA LESO LEST LESU LEVC LEVD LEVT LEVX LEXJ LEZG',
    'LEZL',
  ],
  'Europe/Moscow': ['ULAA ULAM ULDD ULKK ULLI ULMM ULPB ULWU UUYH UUYP UUYS UUYW UUYY'],
  'Europe/Oslo': [
    'ENAL ENAN ENAT ENBN ENBO ENBR ENBS ENBV ENCN ENDU ENEV ENFL ENGM ENHD ENHF',
    'ENHV ENKB ENKR ENLK ENMH ENML ENMS ENNA ENOL ENOV ENRA ENRM ENRO ENSB ENSH',
    'ENSK ENSO ENSR ENSS ENST ENTC ENTO ENVA ENVD ENZV',
  ],
  'Europe/Paris': [
    'LFBD LFBE LFBH LFBI LFBL LFBO LFBP LFBT LFBZ LFOB LFOT LFPG LFPO LFQQ LFRB',
    'LFRG LFRK LFRN LFRS LFSL',
  ],
  'Europe/Stockholm': [
    'ESGG ESGJ ESGT ESKM ESKN ESKS ESMT ESNG ESNK ESNL ESNN ESNO ESNQ ESNS ESNU',
    'ESNV ESNX ESNZ ESOE ESOK ESOW ESPA ESSA ESSB ESSD ESSL ESSP ESST ESTA',
  ],
  'Europe/Tallinn': ['EEKA EETN'],
  'Indian/Mahe': ['FSIA FSPP'],
  'Indian/Maldives': ['VRDA VRMH VRMK VRMM VRMV'],
}

/**
 * OurAirports'un kullandığı bölge kodu → ISO 3166-2'deki eşi; iki kod da tabloda aynı dilimdedir.
 * Kazakistan'da ISO kodları 2020'den beri sayısaldır; Baykonur'un ISO kodu yoktur, Kızılorda
 * bölgesindedir (KZ-43).
 */
const REGION_CODE_ALIASES: Readonly<Record<string, string>> = {
  'CN-54': 'CN-XZ',
  'CN-62': 'CN-GS',
  'CN-63': 'CN-QH',
  'CN-65': 'CN-XJ',
  'DE-BR': 'DE-BB',
  'KZ-ABA': 'KZ-10',
  'KZ-AKM': 'KZ-11',
  'KZ-AKT': 'KZ-15',
  'KZ-ALA': 'KZ-75',
  'KZ-AST': 'KZ-71',
  'KZ-ATY': 'KZ-23',
  'KZ-BAY': 'KZ-43',
  'KZ-JET': 'KZ-33',
  'KZ-KAR': 'KZ-35',
  'KZ-KUS': 'KZ-39',
  'KZ-KZY': 'KZ-43',
  'KZ-MAN': 'KZ-47',
  'KZ-PAV': 'KZ-55',
  'KZ-SEV': 'KZ-59',
  'KZ-ULY': 'KZ-62',
  'KZ-VOS': 'KZ-63',
  'KZ-YUZ': 'KZ-61',
  'KZ-ZAP': 'KZ-27',
  'KZ-ZHA': 'KZ-31',
  // 5. halka (D-109): Çin'in öbür 27 ili, Meksiko şehri, Santa Elena, Highland Papua.
  ...{ 'CN-11': 'CN-BJ', 'CN-12': 'CN-TJ', 'CN-13': 'CN-HE', 'CN-14': 'CN-SX', 'CN-15': 'CN-NM' },
  ...{ 'CN-21': 'CN-LN', 'CN-22': 'CN-JL', 'CN-23': 'CN-HL', 'CN-31': 'CN-SH', 'CN-32': 'CN-JS' },
  ...{ 'CN-33': 'CN-ZJ', 'CN-34': 'CN-AH', 'CN-35': 'CN-FJ', 'CN-36': 'CN-JX', 'CN-37': 'CN-SD' },
  ...{ 'CN-41': 'CN-HA', 'CN-42': 'CN-HB', 'CN-43': 'CN-HN', 'CN-44': 'CN-GD', 'CN-45': 'CN-GX' },
  ...{ 'CN-46': 'CN-HI', 'CN-50': 'CN-CQ', 'CN-51': 'CN-SC', 'CN-52': 'CN-GZ', 'CN-53': 'CN-YN' },
  ...{ 'CN-61': 'CN-SN', 'CN-64': 'CN-NX' },
  ...{ 'EC-25': 'EC-SE', 'ID-PP': 'ID-PE', 'MX-DIF': 'MX-CMX' },
  // Savaş nedeniyle kapalı havalimanları (D-110): OurAirports'un Rivne kodu.
  'UA-19': 'UA-56',
}

/** ISO 3166-2:KZ: 17 bölge ve 3 şehir (Astana 71, Almatı 75, Şımkent 79); 2022 bölgeleri 10, 33, 62. */
const KAZAKHSTAN_ISO_REGIONS = [
  'KZ-10',
  'KZ-11',
  'KZ-15',
  'KZ-19',
  'KZ-23',
  'KZ-27',
  'KZ-31',
  'KZ-33',
  'KZ-35',
  'KZ-39',
  'KZ-43',
  'KZ-47',
  'KZ-55',
  'KZ-59',
  'KZ-61',
  'KZ-62',
  'KZ-63',
  'KZ-71',
  'KZ-75',
  'KZ-79',
] as const

/** 4. halka adayının beklenen dilimi (`RING_FOUR_ZONES`); tabloda yoksa undefined. */
function ringFourZone(icao: string): string | undefined {
  return Object.entries(RING_FOUR_ZONES).find(([, chunks]) =>
    chunks.some((chunk) => chunk.split(' ').includes(icao)),
  )?.[0]
}

describe("4. halka saat dilimleri (D-101; halka M6i.2'de açıldı, D-102)", () => {
  const ringFour = rows
    .filter((r) => r.get('iso_country') !== 'TR')
    .filter((r) =>
      isScheduledIataAirport(
        r.get('type') ?? '',
        r.get('scheduled_service') === 'yes',
        r.get('iata_code'),
      ),
    )
    .filter((r) => airportRing(distanceToTurkey(r)) === 4)
  const expectedZone = new Map(
    Object.entries(RING_FOUR_ZONES).flatMap(([zone, chunks]) =>
      chunks.flatMap((chunk) => chunk.split(' ')).map((icao) => [icao, zone] as const),
    ),
  )

  it("fixture'daki 720 adayın her biri beklenen dilimde (90 dilim)", () => {
    expect(ringFour).toHaveLength(720)
    expect(expectedZone.size).toBe(720)
    expect(Object.keys(RING_FOUR_ZONES)).toHaveLength(90)
    for (const r of ringFour) {
      const airport = fixtureAirport(r)
      expect(airportTimeZone(airport), `${airport.icao} ${airport.isoRegion}`).toBe(
        expectedZone.get(airport.icao),
      )
    }
  })

  it.runIf(hasRuntimeZones)(
    'her adayın dilimini ICU tanır ve dilim o ülkenin Intl listesindedir (Sincan Asia/Shanghai)',
    () => {
      for (const r of ringFour) {
        const airport = fixtureAirport(r)
        const zone = airportTimeZone(airport) ?? ''
        expect(isSupportedTimeZone(zone), airport.icao).toBe(true)
        expect(runtimeZones(airport.country), airport.icao).toContain(zone)
      }
      // Asia/Urumqi (UTC+6) tzdb'de vardır ama seçilmez: Sincan'ın resmî saati Pekin saatidir.
      expect(runtimeZones('CN')).toContain('Asia/Urumqi')
      expect([...expectedZone.values()]).not.toContain('Asia/Urumqi')
    },
  )

  it('4. halka 93 bölge ve 2 havalimanı kuralı ekledi; her çok dilimli bölgenin kuralı var', () => {
    const regionRules = Object.keys(REGION_TIME_ZONES)
    const byCountry = (codes: readonly string[]) =>
      Object.fromEntries(
        [...new Set(codes.map((code) => code.split('-')[0] ?? ''))]
          .sort()
          .map((country) => [
            country,
            codes.filter((code) => code.startsWith(`${country}-`)).length,
          ]),
      )
    // 4. halka adaylarının çok dilimli ülkelerdeki bölgeleri (Grönland havalimanı kuralıyla).
    const ringFourRegions = [
      ...new Set(
        ringFour
          .map((r) => r.get('iso_region') ?? '')
          .filter((region) => !Object.hasOwn(COUNTRY_TIME_ZONES, region.split('-')[0] ?? '')),
      ),
    ].filter((region) => region !== 'GL-SE')
    expect(ringFourRegions.filter((region) => !regionRules.includes(region))).toEqual([])
    // 3. halkanın kurallarından 4. halkada da kullanılanlar (Katalonya, Balear Adaları,
    // Schleswig-Holstein, Vologda) çıkınca 93 yeni kural.
    const reused = ['DE-SH', 'ES-CT', 'ES-IB', 'RU-VLG']
    const added = ringFourRegions.filter((region) => !reused.includes(region))
    expect(added).toHaveLength(93)
    expect(byCountry(added)).toEqual({
      CD: 13,
      CN: 4,
      ES: 15,
      KZ: 13,
      MN: 10,
      PT: 8,
      RU: 24,
      UZ: 6,
    })
    // 1.–4. halkanın altı havalimanı kuralı (Harkiv'inki aşağıda, D-110; 5. halkanın 68'i, D-109).
    expect(Object.keys(AIRPORT_TIME_ZONES)).toEqual(
      expect.arrayContaining(['BGCO', 'BGKK', 'LCEN', 'LCLK', 'LCPH', 'UGSS']),
    )
    // Grönland'ın iki havalimanı aynı bölgede (GL-SE), farklı dilimde: bölge kuralı yazılamaz.
    expect(Object.hasOwn(REGION_TIME_ZONES, 'GL-SE')).toBe(false)
    expect(
      ringFour
        .filter((r) => r.get('iso_region') === 'GL-SE')
        .map(icaoOf)
        .sort(),
    ).toEqual(['BGCO', 'BGKK'])
  })

  it('bölge kodu eşleri: OurAirports kodu ve ISO 3166-2 kodu aynı dilimde (kod değişirse dilim kaybolmaz)', () => {
    for (const [ourAirports, iso] of Object.entries(REGION_CODE_ALIASES)) {
      expect(REGION_TIME_ZONES[ourAirports], ourAirports).toBeDefined()
      expect(REGION_TIME_ZONES[iso], iso).toBe(REGION_TIME_ZONES[ourAirports])
    }
    // Fixture OurAirports'un kodlarını kullanır: Çin'de sayısal, Brandenburg'da DE-BR. OurAirports
    // kodları değiştirir ve fixture yeniden üretilirse 720 adaylık test kırılır; eşi yazılı kodlar
    // üretimde de dilimsiz kalmaz.
    const fixtureRegions = new Set(rows.map((r) => r.get('iso_region') ?? ''))
    for (const code of Object.keys(REGION_CODE_ALIASES)) {
      expect(fixtureRegions.has(code), code).toBe(true)
    }
    for (const code of Object.values(REGION_CODE_ALIASES)) {
      expect(fixtureRegions.has(code), code).toBe(false)
    }
    // Kazakistan'da OurAirports 2022 bölgeleri için ISO'da olmayan kendi kodlarını kullanır (ISO:
    // KZ-10, KZ-33, KZ-62).
    for (const code of ['KZ-ABA', 'KZ-JET', 'KZ-ULY']) {
      expect(fixtureRegions.has(code), code).toBe(true)
      expect(REGION_TIME_ZONES[code], code).toBe('Asia/Almaty')
    }
    expect(REGION_TIME_ZONES['KZ-KUS']).toBe('Asia/Qostanay')
  })

  it("Kazakistan'ın her bölgesi iki kodla da tabloda (OurAirports harf kodu ve ISO 3166-2 sayısal kodu)", () => {
    // KZ ülke tablosunda değildir (çok dilimli): kuralsız bölge dilimsiz kalırdı.
    expect(Object.hasOwn(COUNTRY_TIME_ZONES, 'KZ')).toBe(false)
    const kazakh = Object.keys(REGION_TIME_ZONES).filter((code) => code.startsWith('KZ-'))
    const ourAirports = kazakh.filter((code) => /^KZ-[A-Z]{3}$/.test(code))
    expect(kazakh.filter((code) => /^KZ-\d{2}$/.test(code))).toEqual([...KAZAKHSTAN_ISO_REGIONS])
    expect(ourAirports).toHaveLength(20)
    expect(kazakh).toHaveLength(40)
    // Her ISO kodunun dilimi, o bölgenin OurAirports kodununkiyle aynı. Eşler tablosunda olmayanlar:
    // Almatı bölgesi (KZ-ALM; tarifeli havalimanı yok, fixture'da satırı yok) ve OurAirports'ta
    // Türkistan'a (KZ-YUZ) yazılan Şımkent şehri.
    const isoPairs: Readonly<Record<string, string>> = {
      ...Object.fromEntries(
        Object.entries(REGION_CODE_ALIASES).filter(([code]) => code.startsWith('KZ-')),
      ),
      'KZ-ALM': 'KZ-19',
    }
    expect(Object.keys(isoPairs).sort()).toEqual(ourAirports)
    for (const [code, iso] of Object.entries(isoPairs)) {
      expect(REGION_TIME_ZONES[iso], `${code} ${iso}`).toBe(REGION_TIME_ZONES[code])
    }
    expect(REGION_TIME_ZONES['KZ-79']).toBe(REGION_TIME_ZONES['KZ-YUZ'])
    expect(new Set([...Object.values(isoPairs), 'KZ-79'])).toEqual(new Set(KAZAKHSTAN_ISO_REGIONS))
    // OurAirports ISO koduna geçerse: bugünkü Kazak adaylarının (3. ve 4. halka) hepsi aynı dilimde.
    const candidates = rows
      .filter((r) => r.get('iso_country') === 'KZ')
      .filter((r) =>
        isScheduledIataAirport(
          r.get('type') ?? '',
          r.get('scheduled_service') === 'yes',
          r.get('iata_code'),
        ),
      )
      .map(fixtureAirport)
    expect(candidates).toHaveLength(21)
    for (const airport of candidates) {
      const iso = isoPairs[airport.isoRegion ?? '']
      expect(iso, airport.icao).toBeDefined()
      expect(airportTimeZone({ ...airport, isoRegion: iso }), airport.icao).toBe(
        airportTimeZone(airport),
      )
    }
  })

  it('çok dilimli ülkelerdeki fixture adaylarının (1.–5. halka) hepsinin dilimi var', () => {
    // Bölgesi kuralsız kalan aday dilimsiz görünürdü (saatler UTC ile, D-109); fixture yeniden
    // üretilince OurAirports'un yeni bir bölge kodunu bu test yakalar. Askerî listedeki üç alanın
    // ikisi (PWAK, PKWA) listelenmediği için kuralsızdır (D-109).
    const missing = rows
      .filter((r) => r.get('iso_country') !== 'TR')
      .filter((r) =>
        isScheduledIataAirport(
          r.get('type') ?? '',
          r.get('scheduled_service') === 'yes',
          r.get('iata_code'),
        ),
      )
      .map(fixtureAirport)
      .filter((airport) => !isMilitaryAirfield(airport.icao))
      .filter((airport) => airportTimeZone(airport) === null)
      .map((airport) => `${airport.icao} ${airport.isoRegion}`)
    expect(missing).toEqual([])
  })

  it('örnek UTC farkları (kış ve yaz 2026)', () => {
    const zoneOf = (icao: string) => {
      const row = ringFour.find((r) => icaoOf(r) === icao)
      expect(row, icao).toBeDefined()
      return row ? (airportTimeZone(fixtureAirport(row)) ?? '') : ''
    }
    const winter = '2026-01-15T12:00:00Z'
    const summer = '2026-07-15T12:00:00Z'
    const offsets = (icao: string) => [offset(winter, zoneOf(icao)), offset(summer, zoneOf(icao))]
    // Yaz saati uygulamayanlar.
    expect(offsets('UNNT'), 'Novosibirsk').toEqual([420, 420])
    expect(offsets('UIII'), 'İrkutsk').toEqual([480, 480])
    expect(offsets('UNOO'), 'Omsk').toEqual([360, 360])
    expect(offsets('USKK'), 'Kirov').toEqual([180, 180])
    expect(offsets('UAAA'), 'Almatı').toEqual([300, 300])
    expect(offsets('UAUU'), 'Kostanay').toEqual([300, 300])
    expect(offsets('ZMKD'), 'Hovd').toEqual([420, 420])
    expect(offsets('ZMCK'), 'Ulan Batur').toEqual([480, 480])
    expect(offsets('FZAA'), 'Kinşasa').toEqual([60, 60])
    expect(offsets('FZNA'), 'Goma').toEqual([120, 120])
    expect(offsets('ZWWW'), 'Urumçi').toEqual([480, 480])
    expect(offsets('VNKT'), 'Katmandu').toEqual([345, 345])
    expect(offsets('VIDP'), 'Delhi').toEqual([330, 330])
    // Yaz saati uygulayanlar.
    expect(offsets('LPPD'), 'Azorlar').toEqual([-60, 0])
    expect(offsets('GCLP'), 'Kanarya').toEqual([0, 60])
    expect(offsets('LPMA'), 'Madeira').toEqual([0, 60])
    expect(offsets('BGCO'), 'Constable Pynt').toEqual([-120, -60])
    expect(offsets('BGKK'), 'Kulusuk').toEqual([-120, -60])
    expect(offsets('EGLL'), 'Londra').toEqual([0, 60])
    expect(offsets('GEML'), 'Melilla').toEqual([60, 120])
  })
})

/**
 * 5. halkanın 2.031 adayından askerî listedeki üçü (PWAK, YBOK, PKWA; D-109) çıkınca kalan 2.028
 * aday (D-080 kuralı, ICAO koşulu olmadan; WKK 5A8 ve LSG CN-0249 dahil), dilime göre: M6j
 * araştırmasının önerisi (`Intl.Locale#getTimeZones()`, tzdb `zone.tab` açıklamaları ve diskteki
 * tzdb kaynakları; Node 24.16, ICU 78.3, tzdata 2026b) ve son tasarımın üç düzeltmesi: Pickle Lake
 * (CYPL) America/Coral_Harbour, Tabatinga (SBTT) bölge varsayılanı America/Manaus, Aysén (CL-AI)
 * America/Punta_Arenas. Tablo halka açılmadan önce (M6j.1) her adayın dilimini sabitler.
 */
const RING_FIVE_ZONES: Readonly<Record<string, readonly string[]>> = {
  'Africa/Abidjan': ['DISP'],
  'Africa/Banjul': ['GBYD'],
  'Africa/Bissau': ['GGOV'],
  'Africa/Blantyre': ['FWCL FWKI'],
  'Africa/Conakry': ['GUCY'],
  'Africa/Dakar': ['GOBD GOGG GOGS'],
  'Africa/Dar_es_Salaam': ['HTGW HTMT'],
  'Africa/Freetown': ['GFLL'],
  'Africa/Gaborone': ['FBKE FBMN FBPM FBSK'],
  'Africa/Harare': ['FVFA FVJN FVKB FVRG'],
  'Africa/Johannesburg': [
    'FABL FACT FAEL FAGG FAHS FAKM FAKN FALA FALE FAMG FAMM FAMU FAOR FAPE FAPH',
    'FAPM FAPP FARB FASS FASZ FAUP FAUT',
  ],
  'Africa/Luanda': ['FNBC FNBJ FNCA FNCT FNGI FNHU FNLU FNMA FNME FNMO FNNG FNSO FNUB'],
  'Africa/Lubumbashi': ['FZQA FZQM'],
  'Africa/Lusaka': ['FLHN FLKK FLMF FLSK'],
  'Africa/Maputo': ['FQBR FQCH FQIN FQLC FQMA FQNC FQNP FQPB FQQL FQTT FQVL'],
  'Africa/Maseru': ['FXMM'],
  'Africa/Mbabane': ['FDSK'],
  'Africa/Monrovia': ['GLMR GLRB'],
  'Africa/Windhoek': ['FYKM FYLZ FYOA FYOG FYRU FYWB FYWE FYWH'],
  'America/Adak': ['PADK'],
  'America/Anchorage': [
    '5A8 PABA PABE PABR PACD PACV PADE PADL PADQ PADU PAEM PAEN PAFA PAFM PAGA',
    'PAGK PAGM PAGS PAHC PAHL PAHN PAHO PAII PAIK PAIL PAIM PAJN PAKN PAKP PAKT',
    'PAKW PALU PAMC PAMR PAMY PANC PANI PANV PAOM PAOR PAOT PAPB PAPG PAPH PAPM',
    'PAQT PARC PARY PASA PASC PASD PASI PASN PATQ PAUN PAVD PAWG PAWI PAYA PFYU',
    'PPIZ',
  ],
  'America/Anguilla': ['TQPF'],
  'America/Antigua': ['TAPA TAPB'],
  'America/Araguaina': ['SBPJ SWGN'],
  'America/Argentina/La_Rioja': ['SANL'],
  'America/Argentina/Rio_Gallegos': ['SAVH SAWC SAWD SAWG SAWP'],
  'America/Argentina/Salta': ['SASA SAVV SAZN SAZR SAZS SAZY'],
  'America/Argentina/San_Juan': ['SANU'],
  'America/Argentina/San_Luis': ['SAOU'],
  'America/Argentina/Tucuman': ['SANT'],
  'America/Argentina/Ushuaia': ['SAWE SAWH'],
  'America/Aruba': ['TNCA'],
  'America/Asuncion': ['SGAS SGEN SGES'],
  'America/Bahia': ['SBIL SBPS SBSV SBUF SBVC'],
  'America/Barbados': ['TBPB'],
  'America/Belem': ['SBBE SBCJ SBHT SBMA SBMQ SBTU'],
  'America/Belize': ['MZBE MZBZ MZCK MZCP MZCZ MZPB MZPL MZSP'],
  'America/Blanc-Sablon': ['CYBX CYIF'],
  'America/Boa_Vista': ['SBBV'],
  'America/Bogota': [
    'SKAR SKAS SKBG SKBO SKBQ SKBS SKBU SKCC SKCG SKCL SKCO SKCZ SKEJ SKFL SKGP',
    'SKIB SKIP SKLC SKLT SKMD SKMR SKMU SKMZ SKNV SKPC SKPD SKPE SKPP SKPS SKPV',
    'SKRG SKRH SKSJ SKSM SKSP SKSV SKTM SKUC SKUI SKVP SKVV SKYP',
  ],
  'America/Boise': ['KBOI KIDA KMYL KPIH KSMN KSUN KTWF'],
  'America/Buenos_Aires': ['SABE SAEZ SAZB SAZL SAZM SAZO'],
  'America/Cambridge_Bay': ['CYCB'],
  'America/Campo_Grande': ['SBCG SBCR SBPP'],
  'America/Cancun': ['MMCM MMCZ MMTL MMUN'],
  'America/Caracas': [
    'SVBC SVBI SVBM SVCN SVCP SVCR SVCU SVJC SVMC SVMG SVMI SVMT SVPR SVSA SVSE',
    'SVSO SVST SVVA SVVG SVVL',
  ],
  'America/Catamarca': ['SANC SAVC SAVE SAVT SAVY'],
  'America/Cayenne': ['SOCA SOOA SOOM'],
  'America/Cayman': ['MWCB MWCR'],
  'America/Chicago': [
    'KABI KABR KACT KAEX KALO KAMA KATW KATY KAUS KBBG KBHM KBIS KBLV KBMI KBNA',
    'KBPT KBRD KBRL KBRO KBTR KCGI KCID KCLL KCMI KCOU KCRP KCWA KDAL KDBQ KDDC',
    'KDEC KDFW KDHN KDLH KDSM KDTS KDVL KEAR KEAU KECP KELD KEVV KFAR KFOD KFSD',
    'KFSM KFTW KGCK KGFK KGGG KGLH KGPT KGRB KGRI KGRK KGTR KGYY KHIB KHOT KHOU',
    'KHRL KHRO KHSV KHYS KIAH KICT KINL KIRK KJAN KJBR KJLN KJMS KLAW KLBB KLBF',
    'KLBL KLCH KLFT KLIT KLNK KLRD KLSE KMAF KMCI KMCK KMCW KMDW KMEI KMEM KMFE',
    'KMGC KMGM KMHK KMKE KMKL KMLI KMLU KMOB KMOT KMSL KMSN KMSP KMSY KMWA KMWL',
    'KOKC KOMA KORD KOWB KPAH KPIA KPIB KPIR KPNS KRFD KRHI KRST KSAT KSGF KSHV',
    'KSJT KSLN KSPI KSPS KSTC KSTL KSUX KSWO KTBN KTUL KTUP KTVF KTXK KTYR KUIN',
    'KVCT KVPS KXNA KXWA',
  ],
  'America/Chihuahua': ['MMCU'],
  'America/Ciudad_Juarez': ['MMCS'],
  'America/Coral_Harbour': ['CYPL CYZS'],
  'America/Cordoba': ['SAAP SAAR SAAV SACO SANE SANR SARC SARE SARF SARI SARP'],
  'America/Costa_Rica': ['MRAN MRGF MRLB MRLM MRNS MROC MRPJ MRPV MRQP'],
  'America/Cuiaba': ['SBAT SBCY SBRD'],
  'America/Curacao': ['TNCC'],
  'America/Dawson': ['CYDA'],
  'America/Dawson_Creek': ['CYXJ'],
  'America/Denver': [
    'KABQ KAIA KALS KASE KBFF KBIL KBJC KBTM KBZN KCDC KCDR KCEZ KCNM KCNY KCOD',
    'KCOS KCPR KCVN KCYS KDEN KDIK KDRO KEGE KELP KGCC KGDV KGGW KGJT KGPI KGTF',
    'KGUC KGUP KHDN KHLN KHOB KHVR KJAC KLAR KLRU KMSO KMTJ KOGD KOLF KPUB KPVU',
    'KRAP KRIW KRKS KROW KSAF KSDY KSGU KSHR KSKX KSLC KSVC KTEX KVEL KWYS',
  ],
  'America/Detroit': ['KAPN KAZO KCIU KCMX KDTW KESC KFNT KGRR KLAN KMBS KMKG KPLN KSAW KTVC'],
  'America/Dominica': ['TDCF TDPD'],
  'America/Edmonton': [
    'CYBF CYEG CYFS CYHY CYLL CYMM CYOJ CYPE CYPY CYQL CYQU CYSM CYVQ CYXC CYXH',
    'CYYC CYZF CYZU',
  ],
  'America/El_Salvador': ['MSLP MSSS'],
  'America/Fort_Nelson': ['CYYE'],
  'America/Fortaleza': ['SBFZ SBIZ SBJE SBJP SBKG SBMS SBPB SBSG SBSL SBTE'],
  'America/Glace_Bay': ['CYQY'],
  'America/Godthab': ['BGAA BGGH BGJN BGQO BGQQ BGSF BGSS'],
  'America/Goose_Bay': ['CYWK CYYR'],
  'America/Grand_Turk': ['MBGT MBNC MBPV MBSC'],
  'America/Grenada': ['TGPY'],
  'America/Guadeloupe': ['TFFM TFFR'],
  'America/Guatemala': ['MGGT MGMM MGPB MGRT'],
  'America/Guayaquil': ['SECO SECU SEGU SELT SEMC SEMT SEQM SERO SESA SETN SETU'],
  'America/Guyana': ['SYCJ SYEC SYKA SYLT'],
  'America/Halifax': ['CYGR CYHZ CYYG'],
  'America/Havana': ['MUBA MUBY MUCC MUCF MUCL MUCM MUCU MUHA MUHG MUMZ MUNG MUSC MUTD MUVR MUVT'],
  'America/Hermosillo': ['MMCN MMGM MMHO'],
  'America/Indianapolis': ['KFWA KIND KLAF KSBN'],
  'America/Inuvik': ['CYEV'],
  'America/Iqaluit': ['CYFB CYUX'],
  'America/Jamaica': ['MKBS MKJP MKJS MKTP'],
  'America/Jujuy': ['SASJ'],
  'America/Kralendijk': ['TNCB TNCE TNCS'],
  'America/La_Paz': ['SLAL SLCB SLCO SLET SLGM SLLP SLOR SLPS SLRI SLTJ SLTR SLUY SLVR'],
  'America/Lima': [
    'SPCL SPEO SPHI SPHO SPJC SPJE SPJJ SPJL SPJR SPLO SPME SPMS SPNC SPPY SPQT',
    'SPQU SPRU SPST SPTN SPTU SPUR SPYL SPZA SPZO',
  ],
  'America/Los_Angeles': [
    'KACV KALW KBFI KBFL KBIH KBLI KBUR KBVU KCCR KCEC KCRQ KEAT KEKO KEUG KFAT',
    'KFHR KGEG KHHR KIPL KLAS KLAX KLGB KLWS KMCE KMFR KMMH KMRY KOAK KOLM KONT',
    'KORS KOTH KPAE KPDT KPDX KPSC KPSP KPUW KRDD KRDM KRNO KSAN KSBA KSBD KSBP',
    'KSCK KSEA KSFO KSJC KSLE KSMF KSMX KSNA KSQL KSTS KTIW KTRK KYKM',
  ],
  'America/Louisville': ['KSDF'],
  'America/Lower_Princes': ['TNCM'],
  'America/Maceio': ['SBAR SBMO'],
  'America/Managua': ['MNBL MNMG MNPC'],
  'America/Manaus': ['SBEG SBMY SBTF SBTT SBUA'],
  'America/Marigot': ['TFFG'],
  'America/Martinique': ['TFFF'],
  'America/Matamoros': ['MMMA MMNL MMPG MMRX'],
  'America/Mazatlan': ['MMCL MMEP MMLM MMLP MMLT MMMZ MMSD MMSL'],
  'America/Mendoza': ['SAME SAMR'],
  'America/Menominee': ['KIMT'],
  'America/Merida': ['MMCE MMCP MMMD'],
  'America/Mexico_City': [
    'MMAA MMAS MMBT MMGL MMIA MMIT MMLO MMMM MMMT MMMX MMOX MMPA MMPB MMPN MMPR',
    'MMPS MMQT MMSM MMSP MMTG MMTO MMTP MMVA MMVR MMZC MMZH MMZO',
  ],
  'America/Miquelon': ['LFVP'],
  'America/Moncton': ['CYFC CYQM CYSJ CZBF'],
  'America/Monterrey': ['MMCV MMDO MMIO MMMY MMTC MMTM'],
  'America/Montevideo': ['SULS SUMU SURV'],
  'America/Montserrat': ['TRPG'],
  'America/Nassau': [
    'MYAF MYAK MYAM MYAN MYAP MYAT MYBC MYBS MYCA MYCB MYCI MYEF MYEH MYEM MYER',
    'MYGF MYIG MYLD MYLS MYMM MYNN MYSM',
  ],
  'America/New_York': [
    'KABE KABY KACK KACY KAGS KALB KAOO KART KATL KAUG KAVL KAVP KBDL KBED KBFD',
    'KBGM KBGR KBHB KBKW KBOS KBQK KBTV KBUF KBWI KCAE KCAK KCHA KCHO KCHS KCKB',
    'KCLE KCLT KCMH KCRW KCSG KCVG KDAB KDAY KDCA KDJT KDOV KDUJ KELM KERI KEWB',
    'KEWN KEWR KEYW KFAY KFLL KFLO KGNV KGSO KGSP KHGR KHPN KHTS KHVN KHXD KHYA',
    'KIAD KIAG KILG KILM KIPT KISP KITH KJAX KJFK KJQF KJST KLAL KLBE KLCK KLEB',
    'KLEX KLGA KLNS KLUK KLWB KLYH KMCN KMCO KMDT KMGW KMHT KMIA KMLB KMSS KMYR',
    'KOAJ KOGS KOPF KORF KORH KOXB KPBG KPDK KPGD KPGV KPHF KPHL KPIE KPIT KPKB',
    'KPQI KPSM KPVD KPWM KRDU KRIC KRKD KROA KROC KRSW KRUT KSAV KSBY KSFB KSGJ',
    'KSHD KSLK KSRQ KSWF KSYR KTEB KTLH KTOL KTPA KTRI KTTN KTYS KUNV KUUU KVLD',
    'KVRB KWST',
  ],
  'America/Noronha': ['SBFN'],
  'America/Panama': ['MPBO MPCE MPCH MPDA MPEJ MPMG MPTO'],
  'America/Paramaribo': ['SMJP'],
  'America/Phoenix': ['KFLG KGCN KHII KIWA KNYL KPGA KPHX KPRC KSOW KTUS'],
  'America/Port-au-Prince': ['MTCA MTCH MTJE MTPP'],
  'America/Port_of_Spain': ['TTCP TTPP'],
  'America/Porto_Velho': ['SBPV SBVH'],
  'America/Puerto_Rico': ['TJBQ TJCP TJIG TJMZ TJPS TJRV TJSJ TJVQ'],
  'America/Punta_Arenas': ['SCBA SCCI SCNT'],
  'America/Rankin_Inlet': ['CYBK CYRT'],
  'America/Recife': ['SBPL SBRF'],
  'America/Regina': ['CYNL CYPA CYQR CYSF CYVC CYXE'],
  'America/Resolute': ['CYRB'],
  'America/Rio_Branco': ['SBCZ SBRB'],
  'America/Santarem': ['SBIH SBSN SBTB'],
  'America/Santiago': ['SCAR SCAT SCCF SCDA SCEL SCES SCFA SCIE SCJO SCQP SCSE SCTE SCVD'],
  'America/Santo_Domingo': ['MDBH MDCY MDJB MDLR MDPC MDPP MDSD MDST'],
  'America/Sao_Paulo': [
    'SBAE SBAQ SBAU SBAX SBBR SBCA SBCF SBCH SBCP SBCT SBCX SBDN SBFI SBFL SBGL',
    'SBGO SBGR SBGV SBIP SBJF SBJV SBKP SBLJ SBLO SBMG SBMK SBML SBNF SBNM SBPA',
    'SBPF SBPG SBPK SBRJ SBRP SBSJ SBSM SBSP SBSR SBUG SBUL SBUR SBVT SBZM',
  ],
  'America/St_Barthelemy': ['TFFJ'],
  'America/St_Johns': ['CYAY CYDF CYQX CYYT'],
  'America/St_Kitts': ['TKPK TKPN'],
  'America/St_Lucia': ['TLPC TLPL'],
  'America/St_Thomas': ['TIST TISX'],
  'America/St_Vincent': ['TVSA TVSB TVSC TVSM TVSU'],
  'America/Tegucigalpa': ['MHLC MHLM MHNJ MHPR MHRO MHTG'],
  'America/Tijuana': ['MMML MMTJ'],
  'America/Toronto': [
    'CYAM CYBC CYBG CYGL CYGP CYGV CYGW CYHM CYHU CYKF CYKL CYLS CYMO CYMT CYMX',
    'CYNA CYND CYOW CYPN CYPQ CYPX CYQA CYQB CYQG CYQN CYQT CYRJ CYRO CYSB CYSN',
    'CYTS CYTZ CYUL CYUY CYVB CYVO CYVP CYVV CYXU CYYB CYYY CYYZ CYZV',
  ],
  'America/Tortola': ['TUPJ TUPW'],
  'America/Vancouver': [
    'CAJ4 CAT4 CBBC CYAZ CYBD CYBL CYCD CYCG CYKA CYLW CYPR CYPW CYPZ CYQQ CYQZ',
    'CYVR CYWL CYXS CYXT CYXX CYYD CYYF CYYJ CYZP CYZT CZMT',
  ],
  'America/Whitehorse': ['CYQH CYXY'],
  'America/Winnipeg': ['CYAG CYAQ CYBR CYDN CYIV CYQD CYQK CYRL CYTH CYWG CYXL CYYL CYYQ CZSJ'],
  'Asia/Anadyr': ['UHMA UHMK UHMP'],
  'Asia/Bangkok': [
    'VTBD VTBO VTBS VTBU VTCC VTCH VTCL VTCN VTCT VTPB VTPH VTPM VTPO VTPP VTSB',
    'VTSC VTSE VTSF VTSG VTSM VTSP VTSR VTSS VTST VTUD VTUI VTUJ VTUK VTUL VTUO',
    'VTUU VTUV VTUW',
  ],
  'Asia/Brunei': ['WBSB'],
  'Asia/Calcutta': ['VOPB'],
  'Asia/Chita': ['UIAA'],
  'Asia/Colombo': ['VCCB VCCK VCRI'],
  'Asia/Dili': ['WPDB WPDL WPEC WPOC'],
  'Asia/Hong_Kong': ['VHHH'],
  'Asia/Jakarta': [
    'WAHH WAHI WAHL WAHQ WAHS WARA WARD WARR WIBB WIBD WICA WICC WIDD WIDN WIDO',
    'WIEE WIGG WIHH WIII WIKK WILL WIMB WIMM WIMS WIMU WIPP WIPQ WITC WITK WITT',
  ],
  'Asia/Jayapura': [
    'WABB WAEE WAJJ WAJO WAKK WAKT WAPF WAPN WAPP WASF WASK WASS WAUU WAVV WAYB',
    'WAYY',
  ],
  'Asia/Kamchatka': ['UHPP'],
  'Asia/Kuala_Lumpur': ['WMBT WMKA WMKC WMKD WMKI WMKJ WMKK WMKL WMKM WMKN WMKP WMSA'],
  'Asia/Kuching': ['WBGB WBGG WBGJ WBGK WBGM WBGR WBGS WBGZ WBKD WBKK WBKL WBKS WBKW WBMU'],
  'Asia/Macau': ['VMMC'],
  'Asia/Magadan': ['UHMM'],
  'Asia/Makassar': [
    'WAAA WADB WADD WADL WAFB WAFF WALL WALS WAMH WAMM WAON WAOO WAQQ WAQT WATT',
    'WAWD WAWP',
  ],
  'Asia/Manila': [
    'RPLB RPLC RPLI RPLK RPLL RPMC RPMD RPME RPMG RPMH RPMJ RPMN RPMO RPMP RPMR',
    'RPMS RPMY RPMZ RPSP RPUH RPUN RPUO RPUT RPUV RPUY RPVA RPVB RPVC RPVD RPVE',
    'RPVF RPVI RPVJ RPVK RPVM RPVP RPVR RPVU RPVV',
  ],
  'Asia/Phnom_Penh': ['VDBG VDDS VDSA VDSV VDTI'],
  'Asia/Pontianak': ['WAGG WIOG WIOK WIOO WIOP WIOS'],
  'Asia/Pyongyang': ['ZKHM ZKPY ZKSD ZKWS'],
  'Asia/Rangoon': [
    'VYDW VYHH VYKG VYKP VYKT VYLK VYLS VYMD VYME VYMK VYMS VYNT VYPT VYSW VYTD',
    'VYTL VYYY',
  ],
  'Asia/Saigon': [
    'VVBM VVCI VVCM VVCR VVCS VVCT VVDB VVDH VVDL VVDN VVNB VVPB VVPC VVPK VVPQ',
    'VVRG VVTH VVTS VVVD VVVH',
  ],
  'Asia/Sakhalin': ['UHSS'],
  'Asia/Seoul': ['RKJB RKJJ RKJK RKJY RKNW RKNY RKPC RKPK RKPS RKPU RKSI RKSS RKTH RKTN RKTU'],
  'Asia/Shanghai': [
    'CN-0249 ZBAA ZBAD ZBAL ZBCD ZBCF ZBDH ZBDS ZBDT ZBER ZBES ZBHD ZBHH ZBHZ ZBLA',
    'ZBLF ZBLL ZBMZ ZBOW ZBSG ZBSJ ZBTJ ZBTL ZBUC ZBUH ZBXH ZBYC ZBYN ZBYZ ZBZJ',
    'ZBZL ZGBH ZGBS ZGCD ZGCJ ZGCZ ZGDY ZGFS ZGGG ZGHA ZGHC ZGHZ ZGKL ZGLG ZGNN',
    'ZGOW ZGSD ZGSG ZGSY ZGSZ ZGWZ ZGYL ZGYY ZGZH ZGZJ ZHCC ZHEC ZHES ZHHH ZHJZ',
    'ZHLY ZHSN ZHSY ZHXF ZHXY ZHYC ZJHK ZJQH ZJSY ZLGY ZLHZ ZLIC ZLLL ZLLN ZLQY',
    'ZLTS ZLXH ZLXN ZLXY ZLYA ZLYL ZLZW ZPBS ZPCW ZPDL ZPDQ ZPJH ZPJM ZPLC ZPLJ',
    'ZPMS ZPNL ZPPP ZPTC ZPZT ZSAM ZSAQ ZSBA ZSCG ZSCN ZSDY ZSFY ZSFZ ZSGS ZSHC',
    'ZSHZ ZSJD ZSJG ZSJN ZSJU ZSJX ZSLG ZSLO ZSLQ ZSLY ZSNB ZSNJ ZSNT ZSOF ZSPD',
    'ZSQD ZSQZ ZSRZ ZSSH ZSSM ZSSR ZSSS ZSTX ZSWA ZSWF ZSWH ZSWX ZSWY ZSWZ ZSXZ',
    'ZSYA ZSYC ZSYN ZSYT ZSYW ZSZS ZUAS ZUBJ ZUBZ ZUCK ZUDA ZUDC ZUGU ZUGY ZUJZ',
    'ZUKD ZUKJ ZULA ZULZ ZUMT ZUMY ZUNP ZUPS ZUQJ ZUTF ZUTR ZUUU ZUWL ZUXC ZUYB',
    'ZUYI ZUZH ZUZY ZYAS ZYBA ZYBS ZYCC ZYCY ZYDD ZYDU ZYFY ZYHB ZYHE ZYJD ZYJM',
    'ZYJS ZYJX ZYJZ ZYLD ZYMD ZYMH ZYQQ ZYSQ ZYTL ZYTN ZYTX ZYYJ ZYYK',
  ],
  'Asia/Singapore': ['WSSL WSSS'],
  'Asia/Srednekolymsk': ['UEMA UESK UESO UESS UESU'],
  'Asia/Taipei': ['RCBS RCFG RCFN RCKH RCKU RCLY RCMQ RCMT RCNN RCQC RCSS RCTP RCYU'],
  'Asia/Tokyo': [
    'RJAA RJAF RJAH RJBB RJBD RJBE RJBT RJCB RJCC RJCH RJCK RJCM RJCN RJCO RJCW',
    'RJDA RJDB RJDC RJDT RJEB RJEC RJEO RJER RJFC RJFE RJFF RJFG RJFK RJFM RJFO',
    'RJFR RJFS RJFT RJFU RJGG RJKA RJKB RJKI RJKN RJNA RJNK RJNO RJNS RJNT RJNW',
    'RJOA RJOB RJOC RJOH RJOI RJOK RJOM RJOO RJOR RJOS RJOT RJOW RJSA RJSC RJSD',
    'RJSF RJSI RJSK RJSM RJSN RJSR RJSS RJSY RJTH RJTO RJTQ RJTT ROAH ROIG ROKJ',
    'ROMD ROMY RORK RORS RORT RORY ROYN',
  ],
  'Asia/Ulaanbaatar': ['ZMCD'],
  'Asia/Ust-Nera': ['UEMT'],
  'Asia/Vientiane': ['VLBK VLLB VLPS VLVT'],
  'Asia/Vladivostok': ['UHHH UHKK UHNN UHOO UHWW'],
  'Asia/Yakutsk': ['UEEE UELL UEMO UENW UERL UERP UERR UERS UEST UEVV UHBB'],
  'Atlantic/Bermuda': ['TXKF'],
  'Atlantic/Cape_Verde': ['GVAC GVBA GVMA GVNP GVSN GVSV'],
  'Atlantic/St_Helena': ['FHAW FHSH'],
  'Atlantic/Stanley': ['EGYP'],
  'Australia/Adelaide': ['YCBP YCDU YKSC YMTG YPAD YPAG YPLC YWHA'],
  'Australia/Brisbane': [
    'YBAR YBBN YBCG YBCK YBCS YBCV YBDV YBIE YBMA YBMK YBOU YBPN YBRK YBSU YBTL',
    'YBUD YBWP YBWW YCCY YCKN YCMU YCOE YEML YGLA YHBA YHID YKOW YLHR YLRE YMRB',
    'YNTN YQLP YROM YTGM YTNG YWDH YWTN',
  ],
  'Australia/Broken_Hill': ['YBHI'],
  'Australia/Darwin': ['YAYE YBAS YELD YGTE YMGD YPDN YPGV YSNK YTNK'],
  'Australia/Hobart': ['YDPO YKII YMHB YMLT YWYY'],
  'Australia/Lindeman': ['YBHM'],
  'Australia/Melbourne': ['YHOT YMAV YMEN YMIA YMMB YMML YPOD'],
  'Australia/Perth': [
    'YABA YBRM YCAR YESP YFTZ YGEL YLEO YLST YMEK YMOG YNWN YPBO YPKA YPKG YPKU',
    'YPLM YPPD YPPH YSHK YWLU',
  ],
  'Australia/Sydney': [
    'YARM YBKE YBNA YBTH YCBA YCFS YCNM YCOM YGTH YLIS YLRD YMAY YMER YMOR YMRY',
    'YNAR YNBR YPKS YPMQ YSCB YSDU YSSY YSTW YSWG YWLG YWLM',
  ],
  'Indian/Antananarivo': ['FMMI FMMS FMMT FMMV FMNA FMNM FMNN FMNQ FMNR FMNS FMSD FMSM FMST'],
  'Indian/Christmas': ['YPXM'],
  'Indian/Cocos': ['YPCC'],
  'Indian/Comoro': ['FMCH FMCV'],
  'Indian/Maldives': ['VRMG VRMT'],
  'Indian/Mauritius': ['FIMP FIMR'],
  'Indian/Mayotte': ['FMCZ'],
  'Indian/Reunion': ['FMEE FMEP'],
  'Pacific/Apia': ['NSFA'],
  'Pacific/Auckland': [
    'NZAA NZAP NZCH NZDN NZGS NZHK NZHN NZKK NZKT NZNP NZNR NZNS NZNV NZPM NZQN',
    'NZRO NZTG NZTU NZWB NZWF NZWK NZWN NZWR NZWS NZWU',
  ],
  'Pacific/Bougainville': ['AYBK'],
  'Pacific/Chatham': ['NZCI'],
  'Pacific/Easter': ['SCIP'],
  'Pacific/Efate': ['NVSS NVVV NVVW'],
  'Pacific/Fiji': ['NFFN NFNA NFNL'],
  'Pacific/Funafuti': ['NGFU'],
  'Pacific/Galapagos': ['SEGS'],
  'Pacific/Gambier': ['NTGJ'],
  'Pacific/Guadalcanal': ['AGGH AGGM'],
  'Pacific/Guam': ['PGUM'],
  'Pacific/Honolulu': ['PHHN PHJH PHKO PHLI PHMK PHMU PHNL PHNY PHOG PHTO'],
  'Pacific/Kiritimati': ['PLCH'],
  'Pacific/Kosrae': ['PTSA'],
  'Pacific/Majuro': ['PKMJ'],
  'Pacific/Marquesas': ['NTMD NTMN'],
  'Pacific/Nauru': ['ANYN'],
  'Pacific/Niue': ['NIUE'],
  'Pacific/Norfolk': ['YSNF'],
  'Pacific/Noumea': ['NWWA NWWD NWWE NWWL NWWM NWWR NWWU NWWV NWWW'],
  'Pacific/Pago_Pago': ['NSTU'],
  'Pacific/Palau': ['PTRO'],
  'Pacific/Ponape': ['PTPN'],
  'Pacific/Port_Moresby': [
    'AYBA AYBM AYCH AYDU AYGA AYGN AYGR AYHK AYKM AYKV AYMD AYMH AYMN AYMO AYNZ',
    'AYPY AYTK AYVN AYWD AYWK',
  ],
  'Pacific/Rarotonga': ['NCRG'],
  'Pacific/Saipan': ['PGRO PGSN PGWT'],
  'Pacific/Tahiti': [
    'NTAA NTAR NTAT NTGA NTGB NTGC NTGF NTGI NTGK NTGM NTGT NTGU NTGV NTHE NTKR',
    'NTTB NTTG NTTH NTTM NTTO NTTP NTTR',
  ],
  'Pacific/Tarawa': ['NGTA'],
  'Pacific/Tongatapu': ['NFTF NFTL NFTV'],
  'Pacific/Truk': ['PTKK PTYA'],
  'Pacific/Wallis': ['NLWW'],
}

/** 5. halkanın yeni bölge kuralları ülke başına (ISO eşleri hariç; D-109). */
const RING_FIVE_REGION_RULES = {
  AR: 24,
  AU: 8,
  BR: 27,
  CA: 13,
  CD: 2,
  CL: 13,
  CN: 27,
  EC: 12,
  FM: 4,
  GL: 4,
  ID: 34,
  KI: 2,
  MH: 1,
  MN: 1,
  MX: 29,
  MY: 12,
  NZ: 15,
  PF: 1,
  PG: 19,
  RU: 9,
  US: 51,
}

describe('5. halka saat dilimleri (D-109; halka kapalı, M6j.1)', () => {
  const ringFive = rows
    .filter((r) => r.get('iso_country') !== 'TR')
    .filter((r) =>
      isScheduledIataAirport(
        r.get('type') ?? '',
        r.get('scheduled_service') === 'yes',
        r.get('iata_code'),
      ),
    )
    .filter((r) => airportRing(distanceToTurkey(r)) === 5)
  const kept = ringFive.filter((r) => !isMilitaryAirfield(icaoOf(r)))
  const expectedZone = new Map(
    Object.entries(RING_FIVE_ZONES).flatMap(([zone, chunks]) =>
      chunks.flatMap((chunk) => chunk.split(' ')).map((icao) => [icao, zone] as const),
    ),
  )
  const zoneOf = (icao: string) => {
    const row = kept.find((r) => icaoOf(r) === icao)
    expect(row, icao).toBeDefined()
    return row ? (airportTimeZone(fixtureAirport(row)) ?? '') : ''
  }

  it("fixture'daki 2.031 adaydan askerî listedeki üçü hariç 2.028'i beklenen dilimde (225 dilim)", () => {
    expect(ringFive).toHaveLength(2031)
    expect(
      ringFive
        .map(icaoOf)
        .filter((icao) => isMilitaryAirfield(icao))
        .sort(),
    ).toEqual(['PKWA', 'PWAK', 'YBOK'])
    expect(kept).toHaveLength(2028)
    expect(expectedZone.size).toBe(2028)
    expect(Object.keys(RING_FIVE_ZONES)).toHaveLength(225)
    for (const r of kept) {
      const airport = fixtureAirport(r)
      expect(airportTimeZone(airport), `${airport.icao} ${airport.isoRegion}`).toBe(
        expectedZone.get(airport.icao),
      )
    }
  })

  it.runIf(hasRuntimeZones)(
    'her adayın dilimini ICU tanır ve dilim o ülkenin Intl listesindedir',
    () => {
      for (const r of kept) {
        const airport = fixtureAirport(r)
        const zone = airportTimeZone(airport) ?? ''
        expect(isSupportedTimeZone(zone), airport.icao).toBe(true)
        expect(runtimeZones(airport.country), airport.icao).toContain(zone)
      }
      // Pickle Lake'in dilimi ICU'nun Kanada listesindedir (tzdb America/Atikokan); Aysén'de
      // America/Coyhaique yerine Punta_Arenas seçildi (aynı farklar, eski ICU da tanır).
      expect(runtimeZones('CA')).toContain('America/Coral_Harbour')
      expect([...expectedZone.values()]).not.toContain('America/Coyhaique')
      expect([...expectedZone.values()]).not.toContain('America/Eirunepe')
    },
  )

  it('308 bölge ve 68 havalimanı kuralı, 30 ISO eşi; her çok dilimli bölgenin kuralı var', () => {
    const regionRules = Object.keys(REGION_TIME_ZONES)
    const ringFiveRegions = [
      ...new Set(
        kept
          .map((r) => r.get('iso_region') ?? '')
          .filter((region) => !Object.hasOwn(COUNTRY_TIME_ZONES, region.split('-')[0] ?? '')),
      ),
    ].filter((region) => region !== 'GL-SE')
    expect(ringFiveRegions.filter((region) => !regionRules.includes(region))).toEqual([])
    // 4. halkanın kurallarından 5. halkada da kullanılanlar (Gansu, Qinghai) çıkınca 308 yeni kural.
    const added = ringFiveRegions.filter((region) => !['CN-62', 'CN-63'].includes(region))
    expect(added).toHaveLength(308)
    const byCountry = Object.fromEntries(
      [...new Set(added.map((code) => code.split('-')[0] ?? ''))]
        .sort()
        .map((country) => [country, added.filter((code) => code.startsWith(`${country}-`)).length]),
    )
    expect(byCountry).toEqual(RING_FIVE_REGION_RULES)
    // ISO eşleri (OurAirports kodu ↔ ISO 3166-2) 30: Çin 27, Meksika, Ekvador, Endonezya.
    const ringFiveAliases = Object.keys(REGION_CODE_ALIASES).filter((code) => added.includes(code))
    expect(ringFiveAliases).toHaveLength(30)
    // Toplam: 4. halkaya kadar 214 anahtar (181 ve savaş kapanışlarının 33'ü, D-110), 5. halkada
    // 308 + 30.
    expect(regionRules).toHaveLength(181 + 33 + 308 + 30)
    // Havalimanı kuralları: 4. halkaya kadar 7 (Harkiv, D-110), 5. halkada 68 (54 bölünen bölge, 6
    // kaba bölge, tzdb'ye sadık 8).
    expect(Object.keys(AIRPORT_TIME_ZONES)).toHaveLength(75)
    const keptIcaos = new Set(kept.map(icaoOf))
    const ringFiveAirportRules = Object.keys(AIRPORT_TIME_ZONES).filter((icao) =>
      keptIcaos.has(icao),
    )
    expect(ringFiveAirportRules).toHaveLength(68)
    // Kaldırılanlar: Tabatinga bölge varsayılanında; askerî alanlar (Wake, Kwajalein) kuralsız.
    for (const icao of ['SBTT', 'PWAK', 'PKWA', 'YBOK']) {
      expect(Object.hasOwn(AIRPORT_TIME_ZONES, icao), icao).toBe(false)
    }
    for (const region of ['UM-79', 'MH-KWA']) {
      expect(Object.hasOwn(REGION_TIME_ZONES, region), region).toBe(false)
    }
    expect(REGION_TIME_ZONES['PF-U-A']).toBe('Pacific/Tahiti')
    expect(REGION_TIME_ZONES['CL-AI']).toBe('America/Punta_Arenas')
  })

  it('örnek UTC farkları (kış ve yaz 2026; Britanya Kolumbiyası yalnız yaz)', () => {
    const winter = '2026-01-15T12:00:00Z'
    const summer = '2026-07-15T12:00:00Z'
    const offsets = (icao: string) => [offset(winter, zoneOf(icao)), offset(summer, zoneOf(icao))]
    // Orta güvenli kurallar ve düzeltmeler (¹; ACTIVATION).
    expect(offsets('CYPL'), 'Pickle Lake').toEqual([-300, -300])
    expect(offsets('SBTT'), 'Tabatinga').toEqual([-240, -240])
    expect(offsets('SCBA'), 'Balmaceda (Aysén)').toEqual([-180, -180])
    expect(offsets('CYAQ'), 'Kasabonika').toEqual([-360, -300])
    // Yaz saati uygulamayanlar.
    expect(offsets('PHNL'), 'Honolulu').toEqual([-600, -600])
    expect(offsets('KPHX'), 'Phoenix').toEqual([-420, -420])
    expect(offsets('CYQR'), 'Regina').toEqual([-360, -360])
    expect(offsets('CYZS'), 'Coral Harbour').toEqual([-300, -300])
    expect(offsets('CYBX'), 'Blanc-Sablon').toEqual([-240, -240])
    expect(offsets('YBBN'), 'Brisbane').toEqual([600, 600])
    expect(offsets('YPDN'), 'Darwin').toEqual([570, 570])
    expect(offsets('YPPH'), 'Perth').toEqual([480, 480])
    expect(offsets('SBFN'), 'Fernando de Noronha').toEqual([-120, -120])
    expect(offsets('SBEG'), 'Manaus').toEqual([-240, -240])
    expect(offsets('SBGR'), 'São Paulo').toEqual([-180, -180])
    expect(offsets('MMMX'), 'México').toEqual([-360, -360])
    expect(offsets('MMUN'), 'Cancún').toEqual([-300, -300])
    expect(offsets('SEGS'), 'Galápagos').toEqual([-360, -360])
    expect(offsets('SAEZ'), 'Buenos Aires').toEqual([-180, -180])
    expect(offsets('UHHH'), 'Habarovsk').toEqual([600, 600])
    expect(offsets('UEMT'), 'Ust-Nera').toEqual([600, 600])
    expect(offsets('UESS'), 'Çerski').toEqual([660, 660])
    expect(offsets('UHMA'), 'Anadır').toEqual([720, 720])
    expect(offsets('WIII'), 'Cakarta').toEqual([420, 420])
    expect(offsets('WAJJ'), 'Jayapura').toEqual([540, 540])
    expect(offsets('NTMN'), 'Hiva Oa').toEqual([-570, -570])
    expect(offsets('NTGJ'), 'Gambier').toEqual([-540, -540])
    expect(offsets('PLCH'), 'Kiritimati').toEqual([840, 840])
    expect(offsets('AYBK'), 'Buka').toEqual([660, 660])
    // Yaz saati uygulayanlar.
    expect(offsets('PADK'), 'Adak').toEqual([-600, -540])
    expect(offsets('PANC'), 'Anchorage').toEqual([-540, -480])
    expect(offsets('KELP'), 'El Paso').toEqual([-420, -360])
    expect(offsets('KPNS'), 'Pensacola').toEqual([-360, -300])
    expect(offsets('KEVV'), 'Evansville').toEqual([-360, -300])
    expect(offsets('KIND'), 'Indianapolis').toEqual([-300, -240])
    expect(offsets('KJFK'), 'New York').toEqual([-300, -240])
    expect(offsets('CYYT'), 'St Johns').toEqual([-210, -150])
    expect(offsets('CYYR'), 'Goose Bay').toEqual([-240, -180])
    expect(offsets('YBHI'), 'Broken Hill').toEqual([630, 570])
    expect(offsets('YSSY'), 'Sidney').toEqual([660, 600])
    expect(offsets('NZCI'), 'Chatham').toEqual([825, 765])
    expect(offsets('SCEL'), 'Santiago').toEqual([-180, -240])
    expect(offsets('SCIP'), 'Paskalya Adası').toEqual([-300, -360])
    expect(offsets('MMCS'), 'Ciudad Juárez').toEqual([-420, -360])
    expect(offsets('MMMA'), 'Matamoros').toEqual([-360, -300])
    expect(offsets('BGGH'), 'Nuuk').toEqual([-120, -60])
    // Britanya Kolumbiyası: tzdata 2026b'de 2026-03-08'den beri bütün yıl UTC−7; eski ICU kışın
    // UTC−8 der. Bu yüzden yalnız yaz örneği (sayfa farkları sunucudan alır, D-109).
    expect(offset(summer, zoneOf('CYVR')), 'Vancouver').toBe(-420)
    expect(offset(summer, zoneOf('CYXJ')), 'Fort St John').toBe(-420)
    expect(offset(summer, zoneOf('CYXC')), 'Cranbrook').toBe(-360)
  })
})
