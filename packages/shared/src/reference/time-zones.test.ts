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
    for (const code of Object.keys(REGION_TIME_ZONES)) expect(code).toMatch(/^[A-Z]{2}-[A-Z0-9]+$/)
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
    // Rusya'nın kuralı yazılmamış bölgesi (Habarovsk, 5. halka), bölgesiz Almanya (Büsingen
    // ikinci dilimdir), Özbekistan'ın Taşkent şehri kodu (OurAirports Taşkent'i UZ-TO'ya yazar), ABD,
    // Kıbrıs'ın havalimanı kuralı olmayan bir alanı, Ukrayna (iki dilim), Grönland'ın havalimanı
    // kuralı olmayan alanı, bilinmeyen kod.
    expect(airportTimeZone({ icao: 'UHHH', country: 'RU', isoRegion: 'RU-KHA' })).toBeNull()
    expect(airportTimeZone({ icao: 'BGSF', country: 'GL', isoRegion: 'GL-QE' })).toBeNull()
    expect(airportTimeZone({ icao: 'EDDF', country: 'DE' })).toBeNull()
    expect(airportTimeZone({ icao: 'UTTT', country: 'UZ', isoRegion: 'UZ-TK' })).toBeNull()
    expect(airportTimeZone({ icao: 'KJFK', country: 'US', isoRegion: 'US-NY' })).toBeNull()
    expect(airportTimeZone({ icao: 'LCRA', country: 'CY', isoRegion: 'CY-06' })).toBeNull()
    expect(airportTimeZone({ icao: 'UKBB', country: 'UA', isoRegion: 'UA-32' })).toBeNull()
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
    // M6i.2'den beri 1.–4. halka açık: 75 + 89 + 278 + 719 (D-088, D-090, D-102); 1.–3. halka
    // `expected` tablosunda, 4. halka `RING_FOUR_ZONES`'tadır.
    expect(listed).toHaveLength(1161)
    for (const r of listed) {
      const airport = fixtureAirport(r)
      const zone = airportTimeZone(airport)
      expect(zone, airport.icao).not.toBeNull()
      expect(zone, airport.icao).toBe(
        expectedByIcao.get(airport.icao)?.zone ?? ringFourZone(airport.icao),
      )
    }
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
    expect(Object.keys(AIRPORT_TIME_ZONES).sort()).toEqual([
      'BGCO',
      'BGKK',
      'LCEN',
      'LCLK',
      'LCPH',
      'UGSS',
    ])
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

  it('çok dilimli ülkelerdeki fixture adaylarının (1.–4. halka) hepsinin dilimi var', () => {
    // Bölgesi kuralsız kalan aday dilimsiz görünürdü ("Türkiye saati"); fixture yeniden üretilince
    // OurAirports'un yeni bir bölge kodunu bu test yakalar.
    const missing = rows
      .filter((r) => r.get('iso_country') !== 'TR')
      .filter((r) =>
        isScheduledIataAirport(
          r.get('type') ?? '',
          r.get('scheduled_service') === 'yes',
          r.get('iata_code'),
        ),
      )
      .filter((r) => airportRing(distanceToTurkey(r)) <= 4)
      .map(fixtureAirport)
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
