/**
 * Canlı yayın kuralının (D-115, 1. aşama) kodda tutulan genel tabloları. Kaynak VRS standing-data
 * `airlines.csv` (CC0); adlar 2026-10-15 fixture'ındandır (`tools/fixtures/vrs/airlines.csv`) ve
 * her kod fixture'da vardır (live-scope-designators.test.ts).
 *
 * Bunlar ICAO işletmeci kodlarıdır (üç harf, herkese açık); hiçbir uçağı tek başına tanımlamaz.
 * İş jeti tipleri ICAO Doc 8643 tip kodlarıdır (uçak modeli, herkese açık). Devlet ve VIP
 * uçaklarının listesi ve gizleme talepleri koda, imaja ve istemciye girmez; yöneticinin
 * `redis-queue`'daki engel listesi yalnız hex tutar (D-074, D-115).
 *
 * Yanlış pozitif diye bilerek listelenmeyenler (gerçek havayolları ve sivil şirketler): FDX, FED,
 * FLL, FDR, FRM ("Federal…"), FFT, FTA, ITR ("Frontier…"), RVM (River Ministries), ADG ve UHS
 * (sivil uçuş okulları), RAM, RJA, RBA, UAE, SAW (Cham Wings), adında "State Air Enterprise" geçen
 * sivil şirketler (BRK, KMA, ORM, RYZ, VGV, SUM), adında "State" geçen havayolları, üniversiteler
 * (BDG, DSU, FDL, KSU) ve "Coast…" adlı havayolları (BLR, CST, ECB, FCL, PCO). Anahtar sözcük
 * taraması (live-scope-designators.test.ts) her yeni fixture'da askerî, devlet, polis ve sağlık
 * çağrışımlı adları arar; bulunan kod ya burada reddedilir ya da testteki gerekçeli listededir.
 * Türk jandarma, polis ve sahil güvenlik uçakları VRS'te yoktur; ICAO dışı çağrı kodları (TUAF…,
 * ASENA…) çağrı kodu kuralından zaten geçmez.
 */

export type DenyGroup =
  'military' | 'state' | 'police_border' | 'flight_inspection' | 'medical_rescue' | 'business_vip'

/** Hava, kara ve deniz kuvvetleri, NATO ve askerî uçuş birlikleri (127). */
const MILITARY: readonly string[] = [
  'AAC', // Army Air Corps
  'ACW', // Royal Air Force
  'AFP', // Portuguese Air Force
  'AIO', // United States Air Force
  'AKG', // No. 84 Squadron RAF
  'ALF', // Allied Command Europe (Mobile Force)
  'AME', // Spanish Air Force
  'ASF', // Austrian Air Force
  'ASY', // Royal Australian Air Force
  'AYB', // Belgian Army
  'BAF', // Belgian Air Force
  'BFW', // Bahrain Defence Force
  'BRS', // Brazilian Air Force
  'CAP', // Civil Air Patrol; ABD Hava Kuvvetleri'nin yardımcı birliği
  'CBY', // Coningsby Flying Training Unit (RAF)
  'CEF', // Czech Air Force
  'CFC', // Canadian Forces
  'CFN', // Church Fenton Flying Training Unit (RAF)
  'CGD', // Charlotte Air National Guard
  'CHD', // 223 Flight Unit State Airline; Rusya Savunma Bakanlığı uçuş birliği
  'CMB', // United States Transportation Command
  'CNV', // United States Navy
  'COH', // Coltishall Flying Training Unit (RAF)
  'CTM', // Commandement Du Transport Aerien Militaire Francais
  'CWL', // Cranwell Flying Training Unit (RAF)
  'DAF', // Danish Air Force
  'DAR', // Danish Army
  'DCN', // Federal Armed Forces
  'DEF', // Aviation Defense Service; silahlı kuvvetlere eğitim uçuşu yüklenicisi, ihtiyaten
  'DNY', // Danish Navy
  'EEF', // Estonian Air Force
  'EGY', // Egyptian Air Force
  'ETP', // Empire Test Pilots' School (İngiltere Savunma Bakanlığı)
  'EVY', // 34 Squadron, Royal Australian Air Force
  'EXB', // Brazilian Army Aviation
  'FAC', // Colombian Air Force
  'FAF', // Force Aerienne Francaise
  'FAG', // Argentine Air Force
  'FMY', // Aviation Legere De L'Armee De Terre
  'FNF', // Finnish Air Force
  'FNY', // France Marine Nationale
  'FPR', // Peruvian Air Force
  'GAF', // German Air Force
  'GAM', // German Army
  'GDQ', // Lincoln Air National Guard
  'GGA', // First Flying Squadron; doğrulanmadı; ihtiyaten
  'GKA', // US Army Parachute Team
  'GNY', // German Navy
  'HAF', // Hellenic Air Force
  'HNA', // Greek Navy
  'HRZ', // Croatian Air Force
  'HUF', // Hungarian Air Force
  'HVK', // Turkish Air Force; Türk Hava Kuvvetleri
  'IAF', // Israeli Air Force
  'IAM', // Italian Air Force
  'IFC', // Indian Air Force
  'INP', // Peruvian Navy
  'IRL', // Irish Air Corps
  'ISF', // International Stabilisation Assistance Force
  'JMM', // Joint Military Commission
  'KIN', // Kinloss Flying Training Unit (RAF)
  'KIW', // Royal New Zealand Air Force
  'KRC', // New Zealand Air Defence Force
  'LAF', // Latvian Air Force
  'LEE', // Leeming Flying Training Unit (RAF)
  'LMG', // South African Air Force
  'LOP', // Linton-on-Ouse Flying Training Unit (RAF)
  'LOS', // Lossiemouth Flying Training Unit (RAF)
  'LSV', // Slovenian Air Force
  'LYF', // Lithuanian Air Force
  'MBR', // Brazilian Navy Aviation
  'MJN', // Royal Air Force of Oman; IATA kodu var (RS)
  'MMF', // Multinational Multi-Role Tanker Transport Fleet
  'MRH', // Marham Flying Training Unit (RAF)
  'NAF', // Royal Netherlands Air Force
  'NDF', // Namibian Defence Force
  'NGR', // Nigerian Air Force
  'NOH', // No. 32 (The Royal) Squadron
  'NOW', // Royal Norwegian Air Force
  'NRN', // Royal Netherland Navy
  'NVY', // Royal Navy
  'NWO', // Northwood Headquarters (RAF)
  'NYB', // Belgian Navy
  'OAN', // NATO
  'OSY', // Open Skies Consultative Commission; Açık Semalar gözlem uçuşları, IATA kodu var (1L)
  'PAT', // Priority Air Transport; ABD Kara Kuvvetleri (C-37 Gulfstream)
  'PLF', // Polish Air Force
  'PNG', // Puerto Rico National Guard
  'PNY', // Polish Navy
  'POA', // Portuguese Army
  'PON', // Portuguese Navy
  'QID', // USAF 100th Air Refueling Wing
  'RCH', // Air Mobility Command; IATA kodu var (MC); IATA şartı onu dışarıda bırakmazdı
  'RFF', // Russian Federation Air Force
  'RFR', // Royal Air Force; IATA kodu var (RR)
  'RJZ', // Royal Jordanian Air Force
  'RMF', // Royal Malaysian Air Force
  'ROF', // Romanian Air Force
  'RRF', // Royal Air Force
  'RRR', // Royal Air Force
  'RSF', // Royal Saudi Air Force
  'SAF', // Singapore Air Force
  'SAM', // USAF Special Air Mission
  'SHF', // Royal Air Force
  'SIV', // Slovenian Armed Forces
  'SMG', // RAF St Mawgan Search and Rescue
  'SQF', // Slovak Air Force
  'SRD', // Search and Rescue 22
  'SRG', // Search and Rescue 202
  'SUI', // Swiss Air Force
  'SVF', // Swedish Armed Forces
  'SYS', // Shawbury Flying Training Unit (RAF)
  'TFU', // 213 Flight Unit; Rusya Savunma Bakanlığı uçuş birliği
  'THN', // International Security Assistance Force
  'TNG', // Tennessee Air National Guard 164th Airlift Group
  'TOF', // RAF Topcliffe Flying Training Unit
  'TOW', // Air Tanker Services; RAF Voyager tanker ve nakliye
  'TTF', // 224th Flight Unit; Rusya Savunma Bakanlığı uçuş birliği
  'UAA', // University Air Squadron
  'UAD', // University Air Squadron
  'UAF', // United Arab Emirates Air Force
  'UAJ', // University Air Squadron
  'UAS', // University Air Squadron
  'VLL', // RAF Valley SAR Training Unit
  'VYT', // RAF Valley Flying Training Unit
  'WAG', // Wisconsin Air National Guard
  'WYT', // 2 Sqn No 1 Elementary Flying Training School (RAF)
]

/** Devlet, hükümet, emîrlik ve devlet başkanlığı uçuşları; devlet kurumları (48). */
const STATE: readonly string[] = [
  'AUH', // Abu Dhabi Amiri Flight
  'BAH', // The Amiri Flight
  'BAN', // British Antarctic Survey (devlet araştırma kurumu)
  'BEC', // State Air Company Berkut
  'BFA', // Presidence Du Faso
  'BGF', // Aviodetachment-28; Bulgaristan hükümet uçuş birliği
  'CIE', // Czech Government Flying Service
  'DAM', // Kyrgyzstan Department of Aviation
  'DOI', // U.S. Department of the Interior
  'DUB', // Dubai Airwing
  'EVM', // Natural Environment Research Council (devlet araştırma kurumu)
  'FFS', // Florida Department of Agriculture
  'FGC', // Departmento De Agricultura De La Generalitat De Cataluna
  'FGP', // Flying-Research Aerogeophysical Center; araştırma uçuşu, ihtiyaten
  'GGE', // Gobierno De Guinea Ecuatorial
  'GRZ', // Government of Zambia Communications Flight
  'HKG', // Government Flying Service
  'KRF', // United Kingdom Royal VIP Flights
  'KRH', // United Kingdom Royal VIP Flight
  'KUG', // State of Kuwait
  'LPD', // UK Royal/HRH Duke of York
  'MET', // Meteorological Research Flight (İngiltere Meteoroloji Ofisi)
  'MRN', // Missions Gouvernemtales Francaises
  'MSP', // Servicio De Vigilancia Aérea Del Ministerio De Seguridad Pública
  'NEB', // State of Nebraska
  'NHK', // Federal Aviation Administration
  'ONM', // Presidencia de La Republica de Guinea Ecuatorial
  'ORF', // Oman Royal Flight
  'PLT', // South Carolina Aeronautics Commission (eyalet kurumu)
  'PRD', // Presidential Aviation; devlet çağrışımlı adla iş jeti kiralama
  'QAF', // Qatar Amiri Flight
  'QUE', // Quebec Government Air Service
  'RGP', // River State Government of Nigeria
  'RIF', // Aviation Ministry of the Interior of the Russian Federation
  'RSD', // Russia Special Flight Squadron
  'SGF', // STAC Swiss Government Flights
  'SGS', // Saskatchewan Government Executive Air Service
  'SLG', // Saskatchewan Government
  'SNV', // Sudanese States Aviation; devlet işletmecisi, ihtiyaten
  'SSG', // Slovak Government Flying Service
  'THK', // Turk Hava Kurumu Hava Taksi Isletmesi; hava taksi ve yangın söndürme, ihtiyaten (D-115)
  'TQF', // United Kingdom Royal VIP Flights
  'TRI', // Executive Flight Operations Ontario Government
  'UCK', // Air Division of the Eastern Kazakhstan Region (bölge yönetimi)
  'UFA', // State Flight Academy of Ukraine
  'UKP', // United Kingdom Home Office
  'UTS', // Ukrainian State Air Traffic Service Enterprise
  'WDG', // Ministry of Agriculture, Fisheries and Food
]

/** Polis, jandarma, gümrük, sahil güvenlik ve sınır muhafızı (28). */
const POLICE_BORDER: readonly string[] = [
  'BPO', // Bundespolizei-Fliegertruppe
  'CGX', // United States Coast Guard Auxiliary
  'CTG', // Canadian Coast Guard
  'CWP', // Australian Customs Service
  'EDL', // Polizeihubschrauberstaffel Bayern
  'FDO', // France Douanes
  'FGN', // Gendarmie Nationale
  'FNG', // Frontier Guard
  'GDB', // Gendarmerie Belge
  'GRY', // New York State Police
  'HBT', // Polizeihubschrauberstaffel Thüringen
  'ICG', // Icelandic Coast Guard
  'LIB', // Polizeihubschrauberstaffel Hamburg
  'NRW', // Polizeifliegerstaffel Nordrhein-Westfalen
  'OKL', // Oklahoma Department of Public Safety
  'PBB', // Polizeihubschrauberstaffel Brandenburg
  'PBW', // Polizeihubschrauberstaffel Baden-Württemberg
  'PHH', // Polizeihubschrauberstaffel Hessen
  'PHS', // Polizeihubschrauberstaffel Sachsen
  'PIK', // Polizeihubschrauberstaffel Sachsen-Anhalt
  'PLC', // Police Aviation Services
  'PMV', // Polizeihubschrauberstaffel Mecklenburg-Vorpommern
  'POF', // Police Aux Frontiers
  'POL', // Rikspolisstyrelsen
  'PPH', // Polizeihubschrauberstaffel Niedersachsen
  'ROP', // Royal Oman Police
  'SRP', // Polizeihubschauberstaffel Rheinland-Pfalz
  'TRP', // Maryland State Police
]

/** Sivil havacılık ve hava seyrüsefer kurumları, uçuş kontrol (kalibrasyon) uçuşları (17). */
const FLIGHT_INSPECTION: readonly string[] = [
  'CBA', // Civil Aviation Inspectorate of the Czech Republic
  'CBN', // Swedish Civil Aviation Administration
  'CFI', // Flight Inspection Center of the General Administration of Civil Aviation in Chin
  'CFU', // United Kingdom Civil Aviation Authority
  'CIA', // Civil Aviation Authority
  'CIV', // Civil Aviation Authority of New Zealand
  'EXM', // United Kingdom Civil Aviation Authority
  'FCK', // Flight Calibration Service
  'FII', // Aerodata Flight Inspection
  'FLC', // FINFO Flight Inspection Aircraft
  'FOC', // Office Federal De'Aviation Civile
  'LTS', // Flight Inspections and Systems
  'RFI', // National Air Traffic Services
  'SDS', // United Kingdom Civil Aviation Authority
  'VOR', // Flight Calibration Services
  'XMR', // Irish Aviation Authority
  'ZZM', // Agence Nationale des Aerodromes et de la Meteorologie
]

/**
 * Ambulans, hasta taşıma, insani yardım, arama kurtarma ve yangın söndürme işletmecileri (35;
 * sağlık verisi, rapor K1 kural 7).
 */
const MEDICAL_RESCUE: readonly string[] = [
  'ALJ', // Heli Ambulance Team
  'AMB', // Deutsche Rettungsflugwacht; IATA kodu var (1I)
  'AMD', // SA Red Cross Air Mercy Service
  'BIN', // Boise Interagency Fire Center
  'BMD', // British Medical Charter
  'BZD', // Canadian Global Air Ambulance
  'CFH', // Care Flight
  'CHX', // DRF Luftrettung
  'CMF', // Air Care Alliance; gönüllü hasta taşıma uçuşları
  'DIC', // Aeromedica
  'DOC', // Norsk Luftambulanse
  'FDS', // African Medical and Research Foundation
  'FRU', // France - Securite Civile
  'LRQ', // Luxembourg Air Ambulance
  'LUV', // Luxembourg Air Rescue
  'MCD', // Air Medical
  'MCG', // SOS Helikoptern Gotland; ambulans ve arama kurtarma helikopteri
  'MCL', // Medical Aviation Services
  'MCY', // Ambulance Air Africa
  'MED', // Ontario Ministry of Health
  'MRZ', // Medical Air Rescue Services
  'NGF', // Angel Flight America; gönüllü hasta taşıma uçuşları
  'NSP', // Samaritan's Purse
  'OEC', // Christophorus Flugrettungsverein
  'PHX', // SkyCare Air Ambulance
  'RED', // International Committee of the Red Cross; insani yardım ve tıbbi tahliye
  'RES', // Australian Maritime Safety Authority (arama kurtarma)
  'RGA', // REGA Swiss Air-Rescue
  'RHD', // Babcock Mission Critical Services; ambulans, arama kurtarma, yangın söndürme
  'RSQ', // International SOS Windhoek; tıbbi tahliye
  'SAZ', // Swiss Air-Ambulance
  'SWE', // Svenskt Ambulansflyg
  'TKR', // Canadian Interagency Forest Fire Centre
  'TYW', // Tyrol Air Ambulance
  'WPR', // Auckland Regional Rescue Helicopter Trust
]

/**
 * İş jeti ve VIP işletmecileri (29). Büyük `.*` işletmecileri VRS desenine güvenmeden açıkça
 * listelenir (desen sütunu kaybolsa da düşsünler); desensiz ya da IATA kodlu VIP işletmecileri
 * (QQE, PJS, MLM …) ACJ ve BBJ uçakları iş jeti tip listesine takılmadığı için buradadır.
 */
const BUSINESS_VIP: readonly string[] = [
  'TRK', // Turkish Airlines General Aviation; VRS'te .* olsa da açıkça listelenir
  'EJA', // NetJets; .*, IATA kodu var (1I)
  'NJE', // NetJets Europe; .*, IATA kodu var (1I)
  'VJT', // Vistajet; .*
  'LXJ', // Flexjet; .*
  'GAJ', // Wheels Up; .*
  'TCJ', // TAG Aviation; .*
  'EJM', // Executive Jet Management; .*
  'JME', // Executive Jet Management Europe; .*
  'IJM', // International Jet Management; .*
  'GMA', // Gama Aviation; .*
  'QQE', // Qatar Executive; IATA kodu var (QE)
  'ABP', // ABS Jets
  'BDJ', // Deer Jet Beijing
  'BXA', // Bahrain Executive Air Services
  'DER', // Deer Jet
  'EJO', // Execujet Middle East
  'GLJ', // Global Jet Austria
  'MLM', // ComLux Malta
  'PJS', // Jet Aviation
  'TFF', // Talon Air
  'ROJ', // Royal Jet
  'FXF', // VIP Air Charter
  'VPV', // VIP-Avia
  'VUR', // Vuelos Internos Privados VIP
  'VIC', // VIP Servicios Aéreos Ejecutivos
  'VIE', // VIP Empresarial
  'VNK', // Vipport Joint Stock Company
  'LEG', // The Army Aviation Heritage Foundation
]

/** Reddedilen kodların grupları (testler aynı kodun iki grupta olmadığını bunun üstünden denetler). */
export const DENY_GROUPS: readonly (readonly [DenyGroup, readonly string[]])[] = [
  ['military', MILITARY],
  ['state', STATE],
  ['police_border', POLICE_BORDER],
  ['flight_inspection', FLIGHT_INSPECTION],
  ['medical_rescue', MEDICAL_RESCUE],
  ['business_vip', BUSINESS_VIP],
]

/**
 * Yayınlanmayan ICAO işletmeci kodları ve grupları (284). 33'ü VRS desenleriyle de `non_airline`
 * sayılır; ret VRS verisine bağlı kalmasın diye burada da durur. Aynı kod iki grupta olamaz (test).
 */
export const DENIED_DESIGNATORS: ReadonlyMap<string, DenyGroup> = new Map(
  DENY_GROUPS.flatMap(([group, codes]) => codes.map((code) => [code, group] as const)),
)

/**
 * VRS'te bütün uçuşları charter (`CharterFlightPattern` = `.*`) sayılan ama tatil uçuşlarını
 * yolcu uçaklarıyla yapan charter ve ACMI havayolları. Bunlar `non_airline` sayılmaz (D-115; bir
 * takdirdir: liste olmadan ör. Enter Air'in Antalya seferleri haritadan düşerdi).
 */
export const CHARTER_AIRLINE_ALLOW: ReadonlySet<string> = new Set([
  'ENT', // Enter Air (E4)
  'EVE', // Iberojet (E9)
  'EZZ', // ETF Airways (LI)
  'HST', // Heston Airlines (HN)
  'AAE', // Air Atlanta Europe (CT)
  'BUC', // European Air Charter (H6)
  'VAW', // Fly2Sky (F6)
  'EAF', // Electra Airways (IATA kodu yok; A320)
  'OTF', // Orange2Fly Airlines (IATA kodu yok; A320)
  'KRP', // Carpatair (V3)
])

/**
 * İş jeti tipleri (ICAO Doc 8643 tip kodları; adsb.lol veritabanının `t` alanı). Bu tipteki uçak
 * işletmeci kodundan bağımsız yayınlanmaz (`business_jet_type`, D-115): VRS'te deseni olmayan ya
 * da IATA kodu taşıyan iş jeti işletmecilerinin uçakları da düşer. Tipi bilinmeyen uçak (yerel
 * alıcı, veritabanında olmayan uçak) IATA kodu olmayan işletmecideyse düşer
 * (`unknown_type_non_scheduled`); worker tipi aynı hex'in son 24 saatteki örneklerinden hatırlar.
 * Havayolu tipleri (A319/A320, B737, CRJ, E-Jet, ATR) listede yoktur: ACJ ve BBJ bu yüzden
 * tipten tanınmaz; VIP işletmecileri `BUSINESS_VIP`'te kodla düşer.
 */
export const BUSINESS_JET_TYPES: ReadonlySet<string> = new Set([
  // Gulfstream ve IAI
  'ASTR',
  'G150',
  'G280',
  'GALX',
  'GLF2',
  'GLF3',
  'GLF4',
  'GLF5',
  'GLF6',
  'GA5C',
  'GA6C',
  'GA7C',
  'GA8C',
  'WW24',
  // Bombardier Challenger, Global ve Learjet
  'CL30',
  'CL35',
  'CL60',
  'GLEX',
  'GL5T',
  'GL6T',
  'GL7T',
  'GL8T',
  'LJ23',
  'LJ24',
  'LJ25',
  'LJ28',
  'LJ31',
  'LJ35',
  'LJ36',
  'LJ40',
  'LJ45',
  'LJ55',
  'LJ60',
  'LJ70',
  'LJ75',
  'LJ85',
  // Dassault Falcon
  'FA10',
  'FA20',
  'FA50',
  'FA5X',
  'FA6X',
  'FA7X',
  'FA8X',
  'F2TH',
  'F900',
  // Cessna Citation
  'C500',
  'C501',
  'C510',
  'C525',
  'C25A',
  'C25B',
  'C25C',
  'C25M',
  'C526',
  'C550',
  'C551',
  'C55B',
  'C560',
  'C56X',
  'C650',
  'C680',
  'C68A',
  'C700',
  'C750',
  // Embraer Phenom, Praetor ve Legacy
  'E35L',
  'E50P',
  'E55P',
  'E545',
  'E550',
  // Hawker, Beechcraft ve diğerleri
  'BE40',
  'H25A',
  'H25B',
  'H25C',
  'HA4T',
  'PRM1',
  'MU30',
  'SBR1',
  'SBR2',
  'SJ30',
  'HDJT',
  'EA50',
  'SF50',
  'PC24',
])
