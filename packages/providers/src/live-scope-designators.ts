/**
 * Canlı yayın kuralının (D-115, 1. aşama) kodda tutulan genel tabloları. Kaynak VRS standing-data
 * `airlines.csv` (CC0); adlar 2026-10-15 fixture'ındandır (`tools/fixtures/vrs/airlines.csv`) ve
 * her kod fixture'da vardır (live-scope-designators.test.ts).
 *
 * Bunlar ICAO işletmeci kodlarıdır (üç harf, herkese açık); hiçbir uçağı tek başına tanımlamaz.
 * Hex ve tescil listeleri (devlet ve VIP uçakları, gizleme talepleri) koda, imaja ve istemciye
 * girmez: yöneticinin `redis-queue`'daki hex engel listesindedir (D-074, D-115).
 *
 * Yanlış pozitif diye bilerek listelenmeyenler (gerçek havayolları): FDX, FED, FLL, FDR, FFT, RAM,
 * RJA, RBA, UAE, SAW (Cham Wings), adında "State Air Enterprise" geçen sivil şirketler (BRK, KMA,
 * ORM, RYZ, VGV, SUM), üniversiteler (DSU, FDL, KSU) ve "Coast…" adlı havayolları (BLR, CST, ECB,
 * FCL, PCO). Türk jandarma, polis ve sahil güvenlik uçakları VRS'te yoktur; ICAO dışı çağrı kodları
 * (TUAF…, ASENA…) çağrı kodu kuralından zaten geçmez.
 */

export type DenyGroup =
  'military' | 'state' | 'police_border' | 'flight_inspection' | 'medical_rescue' | 'business_vip'

/** Hava, kara ve deniz kuvvetleri, NATO ve askerî uçuş birlikleri (108). */
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
  'CEF', // Czech Air Force
  'CFC', // Canadian Forces
  'CGD', // Charlotte Air National Guard
  'CHD', // 223 Flight Unit State Airline; Rusya Savunma Bakanlığı uçuş birliği
  'CMB', // United States Transportation Command
  'CNV', // United States Navy
  'CTM', // Commandement Du Transport Aerien Militaire Francais
  'DAF', // Danish Air Force
  'DAR', // Danish Army
  'DCN', // Federal Armed Forces
  'DNY', // Danish Navy
  'EEF', // Estonian Air Force
  'EGY', // Egyptian Air Force
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
  'KIW', // Royal New Zealand Air Force
  'KRC', // New Zealand Air Defence Force
  'LAF', // Latvian Air Force
  'LMG', // South African Air Force
  'LSV', // Slovenian Air Force
  'LYF', // Lithuanian Air Force
  'MBR', // Brazilian Navy Aviation
  'MJN', // Royal Air Force of Oman; IATA kodu var (RS)
  'MMF', // Multinational Multi-Role Tanker Transport Fleet
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
  'TFU', // 213 Flight Unit; Rusya Savunma Bakanlığı uçuş birliği
  'THN', // International Security Assistance Force
  'TNG', // Tennessee Air National Guard 164th Airlift Group
  'TOW', // Air Tanker Services; RAF Voyager tanker ve nakliye
  'TTF', // 224th Flight Unit; Rusya Savunma Bakanlığı uçuş birliği
  'UAA', // University Air Squadron
  'UAD', // University Air Squadron
  'UAF', // United Arab Emirates Air Force
  'UAJ', // University Air Squadron
  'UAS', // University Air Squadron
  'WAG', // Wisconsin Air National Guard
]

/** Devlet, hükümet, emîrlik ve devlet başkanlığı uçuşları (37). */
const STATE: readonly string[] = [
  'AUH', // Abu Dhabi Amiri Flight
  'BAH', // The Amiri Flight
  'BEC', // State Air Company Berkut
  'BFA', // Presidence Du Faso
  'CIE', // Czech Government Flying Service
  'DOI', // U.S. Department of the Interior
  'DUB', // Dubai Airwing
  'GGE', // Gobierno De Guinea Ecuatorial
  'GRZ', // Government of Zambia Communications Flight
  'HKG', // Government Flying Service
  'KRF', // United Kingdom Royal VIP Flights
  'KRH', // United Kingdom Royal VIP Flight
  'KUG', // State of Kuwait
  'LPD', // UK Royal/HRH Duke of York
  'MRN', // Missions Gouvernemtales Francaises
  'MSP', // Servicio De Vigilancia Aérea Del Ministerio De Seguridad Pública
  'NEB', // State of Nebraska
  'NHK', // Federal Aviation Administration
  'ONM', // Presidencia de La Republica de Guinea Ecuatorial
  'ORF', // Oman Royal Flight
  'PRD', // Presidential Aviation; devlet çağrışımlı adla iş jeti kiralama
  'QAF', // Qatar Amiri Flight
  'QUE', // Quebec Government Air Service
  'RGP', // River State Government of Nigeria
  'RIF', // Aviation Ministry of the Interior of the Russian Federation
  'RSD', // Russia Special Flight Squadron
  'SGF', // STAC Swiss Government Flights
  'SGS', // Saskatchewan Government Executive Air Service
  'SLG', // Saskatchewan Government
  'SSG', // Slovak Government Flying Service
  'THK', // Turk Hava Kurumu Hava Taksi Isletmesi; hava taksi ve yangın söndürme, ihtiyaten (D-115)
  'TQF', // United Kingdom Royal VIP Flights
  'TRI', // Executive Flight Operations Ontario Government
  'UFA', // State Flight Academy of Ukraine
  'UKP', // United Kingdom Home Office
  'UTS', // Ukrainian State Air Traffic Service Enterprise
  'WDG', // Ministry of Agriculture, Fisheries and Food
]

/** Polis, jandarma, sahil güvenlik ve sınır muhafızı (26). */
const POLICE_BORDER: readonly string[] = [
  'BPO', // Bundespolizei-Fliegertruppe
  'CGX', // United States Coast Guard Auxiliary
  'CTG', // Canadian Coast Guard
  'CWP', // Australian Customs Service
  'EDL', // Polizeihubschrauberstaffel Bayern
  'FGN', // Gendarmie Nationale
  'FNG', // Frontier Guard
  'GDB', // Gendarmerie Belge
  'GRY', // New York State Police
  'HBT', // Polizeihubschrauberstaffel Thüringen
  'ICG', // Icelandic Coast Guard
  'LIB', // Polizeihubschrauberstaffel Hamburg
  'NRW', // Polizeifliegerstaffel Nordrhein-Westfalen
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

/** Sivil havacılık otoriteleri ve uçuş kontrol (kalibrasyon) uçuşları (15). */
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
  'SDS', // United Kingdom Civil Aviation Authority
  'VOR', // Flight Calibration Services
  'XMR', // Irish Aviation Authority
]

/** Ambulans, arama kurtarma ve yangın söndürme işletmecileri (27; sağlık verisi, rapor K1 kural 7). */
const MEDICAL_RESCUE: readonly string[] = [
  'ALJ', // Heli Ambulance Team
  'AMB', // Deutsche Rettungsflugwacht; IATA kodu var (1I)
  'AMD', // SA Red Cross Air Mercy Service
  'BIN', // Boise Interagency Fire Center
  'BMD', // British Medical Charter
  'BZD', // Canadian Global Air Ambulance
  'CHX', // DRF Luftrettung
  'DIC', // Aeromedica
  'DOC', // Norsk Luftambulanse
  'FDS', // African Medical and Research Foundation
  'FRU', // France - Securite Civile
  'LRQ', // Luxembourg Air Ambulance
  'LUV', // Luxembourg Air Rescue
  'MCD', // Air Medical
  'MCL', // Medical Aviation Services
  'MCY', // Ambulance Air Africa
  'MED', // Ontario Ministry of Health
  'MRZ', // Medical Air Rescue Services
  'NSP', // Samaritan's Purse
  'OEC', // Christophorus Flugrettungsverein
  'PHX', // SkyCare Air Ambulance
  'RGA', // REGA Swiss Air-Rescue
  'SAZ', // Swiss Air-Ambulance
  'SWE', // Svenskt Ambulansflyg
  'TKR', // Canadian Interagency Forest Fire Centre
  'TYW', // Tyrol Air Ambulance
  'WPR', // Auckland Regional Rescue Helicopter Trust
]

/** İş jeti ve VIP işletmecileri (9; VRS .* desenine güvenmeden açıkça listelenir). */
const BUSINESS_VIP: readonly string[] = [
  'TRK', // Turkish Airlines General Aviation; VRS'te .* olsa da açıkça listelenir
  'ROJ', // Royal Jet
  'FXF', // VIP Air Charter
  'VPV', // VIP-Avia
  'VUR', // Vuelos Internos Privados VIP
  'VIC', // VIP Servicios Aéreos Ejecutivos
  'VIE', // VIP Empresarial
  'VNK', // Vipport Joint Stock Company
  'LEG', // The Army Aviation Heritage Foundation
]

const GROUPS: readonly (readonly [DenyGroup, readonly string[]])[] = [
  ['military', MILITARY],
  ['state', STATE],
  ['police_border', POLICE_BORDER],
  ['flight_inspection', FLIGHT_INSPECTION],
  ['medical_rescue', MEDICAL_RESCUE],
  ['business_vip', BUSINESS_VIP],
]

/**
 * Yayınlanmayan ICAO işletmeci kodları ve grupları (222). 23'ü VRS desenleriyle de `non_airline`
 * sayılır; ret VRS verisine bağlı kalmasın diye burada da durur. Aynı kod iki grupta olamaz (test).
 */
export const DENIED_DESIGNATORS: ReadonlyMap<string, DenyGroup> = new Map(
  GROUPS.flatMap(([group, codes]) => codes.map((code) => [code, group] as const)),
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
