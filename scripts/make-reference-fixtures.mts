// Referans verisi fixture'larını, önceden indirilmiş ham dosyalardan üretir. Ağa çıkmaz.
//   pnpm exec tsx scripts/make-reference-fixtures.mts <ham-dosya-klasörü> [çıktı-klasörü]
// Klasörde OurAirports airports.csv + runways.csv ve VRS airlines.csv bulunur (indirme bir kez,
// kullanıcı onayıyla yapılır; CLAUDE.md DUR-SOR 6). Çıktı varsayılan olarak tools/fixtures'tır.
// 2026-10-01 indirmesinin kalıcı kopyası depo dışındadır: C:/PROJELER/havayolu-data/ourairports-2026-10-01
// (SHA256SUMS ile; tools/fixtures/README.md). Bugünkü fixture o klasörden bayt bayt aynı üretilir.
// Alt küme: Türkiye'deki bütün kayıtlar ve FIXTURE_EXTRA_AIRPORTS (pistlerinin hepsiyle), ardından
// Türkiye dışı adaylar halka halka: önce 1., sonra 2., 3., 4. ve 5. halka (açık pistleriyle; D-080,
// D-088, D-090, D-101, D-109), ve kapanış tablosunun tarifesiz havalimanları (açık pistleriyle,
// D-110); havayollarının tamamı.
// Ayrıca adres takma adının dışlama listesini (`IDENT_ALIAS_EXCLUSIONS`, D-109) tam dosyayla sayar
// (`identAliasExclusionCensus`); sayım koddaki listeden farklıysa çıkış kodu 1'dir (fixture yine
// yazılır; liste `packages/db/src/airports.ts`'te ve web test yardımcısında güncellenir).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  IDENT_ALIAS_EXCLUSIONS,
  identAliasExclusionCensus,
  ourAirportsIcao,
} from '../packages/db/src/airports.ts'
import { distanceKm } from '../packages/geo/src/index.ts'
import { parseCsv } from '../packages/providers/src/reference/csv.ts'
import { isImportedAirport } from '../packages/providers/src/reference/ourairports.ts'
import { CIVIL_FLIGHT_CLOSURES } from '../packages/shared/src/reference/civil-closures.ts'

/**
 * Türkiye dışından testlerde kullanılabilecek birkaç büyük havalimanı ve iki dışlama örneği
 * (D-109): Paris-Le Bourget (LFPB, LBG; büyük ama tarifesiz, dört karakterli ICAO'su ve üç pisti
 * var: aday değildir) ve Thohoyandou (FATH, THY; küçük, tarifesiz, pisti yok: içe aktarılmaz).
 * Bütün halkalar fixture'a girince listelenmeyen, geçerli ICAO'lu yabancı havalimanının örnekleri
 * bunlardır; FATH ayrıca "THY"nin listede hiçbir zaman havalimanı kodu olmadığını gösterir (D-108).
 */
const FIXTURE_EXTRA_AIRPORTS = [
  'EGLL',
  'LFPG',
  'EDDF',
  'EHAM',
  'OMDB',
  'OTHH',
  'KJFK',
  'LEMD',
  'LFPB',
  'FATH',
]
/**
 * Fixture'a alınan halkaların üst sınırları, km (`@havayolu/shared` `AIRPORT_RINGS_KM` ve son
 * halka; 1. halka ≤ 500, 2. halka 500 < uzaklık ≤ 1.000, 3. halka 1.000 < uzaklık ≤ 2.000, 4.
 * halka 2.000 < uzaklık ≤ 5.000, 5. halka 5.000 km'nin ötesi, sınırsız; D-080, D-088, D-090,
 * D-101, D-109). Aday: Türkiye dışında,
 * tarifeli seferi olan, üç harfli IATA kodlu büyük ya da orta havalimanı (D-080 kuralı; uygulamanın
 * dört karakterli ICAO koşulu burada yoktur: Kihihi UG-0002 fixture'da dışlamanın örneğidir).
 * Uzaklık Türkiye'deki IATA
 * kodlu bütün satırlara bakılarak ölçülür (listeye girmeyen küçük alanlar dahil; uygulama da aynı
 * kümeyle ölçer). Halkalar sırayla yazılır, her halka kaynak sırasıyla: yeni halka dosyanın sonuna
 * eklenir, önceki satırlar ve sıraları değişmez (tek eşikle yazılsa sonraki halkanın satırları
 * öncekilerin arasına karışırdı; kaynak alfabetik sıradadır). Uzak örneklerden (FIXTURE_EXTRA_AIRPORTS)
 * 3. halkaya düşen Frankfurt, Dubai ve Doha Hamad, 4. halkaya düşen Paris Charles de Gaulle,
 * Amsterdam, Londra Heathrow ve Madrid ile 5. halkaya düşen New York JFK tabanda kalır, halka
 * satırı olarak yinelenmez (5. halkanın satırları bu yüzden 2.031 adayın 2.030'udur).
 */
const FIXTURE_RINGS_KM = [500, 1000, 2000, 5000, Number.POSITIVE_INFINITY] as const
const IATA_CODE = /^[A-Z]{3}$/

const root = fileURLToPath(new URL('..', import.meta.url))
const input = process.argv[2]
if (!input) {
  console.error(
    'Kullanım: tsx scripts/make-reference-fixtures.mts <ham-dosya-klasörü> [çıktı-klasörü]',
  )
  process.exit(1)
}
const output = resolve(process.argv[3] ?? join(root, 'tools', 'fixtures'))

const quote = (field: string) => `"${field.replaceAll('"', '""')}"`
const toCsv = (rows: string[][]) => `${rows.map((r) => r.map(quote).join(',')).join('\n')}\n`
const read = (name: string) => parseCsv(readFileSync(join(resolve(input), name), 'utf8'))

const [airportHeader = [], ...airports] = read('airports.csv')
const col = (header: string[], name: string) => {
  const index = header.indexOf(name)
  if (index < 0) throw new Error(`Sütun yok: ${name}`)
  return index
}
const identCol = col(airportHeader, 'ident')
const typeCol = col(airportHeader, 'type')
const latCol = col(airportHeader, 'latitude_deg')
const lonCol = col(airportHeader, 'longitude_deg')
const countryCol = col(airportHeader, 'iso_country')
const scheduledCol = col(airportHeader, 'scheduled_service')
const iataCol = col(airportHeader, 'iata_code')

const position = (row: string[]) => ({ lat: Number(row[latCol]), lon: Number(row[lonCol]) })
const baseAirports = airports.filter(
  (row) => row[countryCol] === 'TR' || FIXTURE_EXTRA_AIRPORTS.includes(row[identCol] ?? ''),
)
const baseIdents = new Set(baseAirports.map((row) => row[identCol]))
const turkishWithIata = airports
  .filter((row) => row[countryCol] === 'TR' && IATA_CODE.test(row[iataCol] ?? ''))
  .map(position)
const nearestTurkishKm = (row: string[]) =>
  Math.min(...turkishWithIata.map((tr) => distanceKm(position(row), tr)))
const candidates = airports.filter(
  (row) =>
    row[countryCol] !== 'TR' &&
    !baseIdents.has(row[identCol]) &&
    (row[typeCol] === 'large_airport' || row[typeCol] === 'medium_airport') &&
    row[scheduledCol] === 'yes' &&
    IATA_CODE.test(row[iataCol] ?? ''),
)
const distances = new Map(candidates.map((row) => [row, nearestTurkishKm(row)]))
/** Halka halka adaylar: [1. halka, …, 5. halka], her biri kaynak sırasıyla. */
const rings = FIXTURE_RINGS_KM.map((limit, index) => {
  const lower = index === 0 ? -1 : (FIXTURE_RINGS_KM[index - 1] ?? -1)
  return candidates.filter((row) => {
    const km = distances.get(row) ?? Number.POSITIVE_INFINITY
    return km > lower && km <= limit
  })
})
const ringAirports = rings.flat()
const ringIdents = new Set(ringAirports.map((row) => row[identCol]))
const icaoCodeCol = col(airportHeader, 'icao_code')
const gpsCodeCol = col(airportHeader, 'gps_code')
const value = (row: string[], index: number) => row[index]?.trim() ?? ''
const optional = (row: string[], index: number) => value(row, index) || null
const canonicalIcao = (row: string[]) =>
  ourAirportsIcao({
    ident: value(row, identCol),
    icaoCode: optional(row, icaoCodeCol),
    gpsCode: optional(row, gpsCodeCol),
  })
/**
 * Kapanış bloğu (D-110): kapanış tablosunun (`CIVIL_FLIGHT_CLOSURES`) halka bloklarında olmayan,
 * yani OurAirports'ta tarifesiz havalimanları; Türkiye dışında, tabanda yok, büyük ya da orta, üç
 * harfli IATA kodlu ve kanonik ICAO'su tabloda. Kaynak sırasıyla, dosyaların sonunda; önceki
 * satırlar değişmez. Tabloda olup tarifeli olanlar zaten halka bloklarındadır, yinelenmez.
 */
const closureAirports = airports.filter(
  (row) =>
    row[countryCol] !== 'TR' &&
    !baseIdents.has(row[identCol]) &&
    !ringIdents.has(row[identCol]) &&
    (row[typeCol] === 'large_airport' || row[typeCol] === 'medium_airport') &&
    IATA_CODE.test(row[iataCol] ?? '') &&
    Object.hasOwn(CIVIL_FLIGHT_CLOSURES, canonicalIcao(row)),
)

const [runwayHeader = [], ...runways] = read('runways.csv')
const runwayAirportCol = col(runwayHeader, 'airport_ident')
const closedCol = col(runwayHeader, 'closed')
const baseRunways = runways.filter((row) => baseIdents.has(row[runwayAirportCol]))
// Pistler de halka halka: önce 1. halkanın açık pistleri, sonra 2., 3., 4. ve 5. halkanınkiler.
const ringRunways = rings.flatMap((ring) => {
  const idents = new Set(ring.map((row) => row[identCol]))
  return runways.filter((row) => idents.has(row[runwayAirportCol]) && row[closedCol] !== '1')
})

// Kapanış bloğunun açık pistleri (halka satırlarının kuralı), en sonda.
const closureIdents = new Set(closureAirports.map((row) => row[identCol]))
const closureRunways = runways.filter(
  (row) => closureIdents.has(row[runwayAirportCol]) && row[closedCol] !== '1',
)

const airlines = read('airlines.csv')

const ourairports = join(output, 'ourairports')
const vrs = join(output, 'vrs')
mkdirSync(ourairports, { recursive: true })
mkdirSync(vrs, { recursive: true })
writeFileSync(
  join(ourairports, 'airports.csv'),
  toCsv([airportHeader, ...baseAirports, ...ringAirports, ...closureAirports]),
)
writeFileSync(
  join(ourairports, 'runways.csv'),
  toCsv([runwayHeader, ...baseRunways, ...ringRunways, ...closureRunways]),
)
writeFileSync(join(vrs, 'airlines.csv'), toCsv(airlines))
console.log(
  `✓ airports ${baseAirports.length} + rings ${rings.map((ring) => ring.length).join(' + ')} + closures ${closureAirports.length}, runways ${baseRunways.length} + ${ringRunways.length} + ${closureRunways.length}, airlines ${airlines.length - 1}`,
)

const exclusions = identAliasExclusionCensus(
  airports.map((row) => ({
    ident: value(row, identCol),
    icaoCode: optional(row, icaoCodeCol),
    gpsCode: optional(row, gpsCodeCol),
    imported: isImportedAirport({
      type: value(row, typeCol),
      scheduledService: value(row, scheduledCol) === 'yes',
      isoCountry: value(row, countryCol),
      iataCode: optional(row, iataCol),
    }),
  })),
)
if (exclusions.join(',') === IDENT_ALIAS_EXCLUSIONS.join(',')) {
  console.log(`✓ ident alias exclusions ${exclusions.join(', ')}`)
} else {
  console.error(
    `✗ IDENT_ALIAS_EXCLUSIONS differs from the census: code ${IDENT_ALIAS_EXCLUSIONS.join(', ')}, census ${exclusions.join(', ')}`,
  )
  process.exitCode = 1
}
