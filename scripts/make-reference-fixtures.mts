// Referans verisi fixture'larını, önceden indirilmiş ham dosyalardan üretir. Ağa çıkmaz.
//   pnpm exec tsx scripts/make-reference-fixtures.mts <ham-dosya-klasörü> [çıktı-klasörü]
// Klasörde OurAirports airports.csv + runways.csv ve VRS airlines.csv bulunur (indirme bir kez,
// kullanıcı onayıyla yapılır; CLAUDE.md DUR-SOR 6). Çıktı varsayılan olarak tools/fixtures'tır.
// Alt küme: Türkiye'deki bütün kayıtlar ve FIXTURE_EXTRA_AIRPORTS (pistlerinin hepsiyle), ardından
// Türkiye dışı 1. halka adayları (açık pistleriyle; D-080); havayollarının tamamı.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { distanceKm } from '../packages/geo/src/index.ts'
import { parseCsv } from '../packages/providers/src/reference/csv.ts'

/** Türkiye dışından testlerde kullanılabilecek birkaç büyük havalimanı. */
const FIXTURE_EXTRA_AIRPORTS = ['EGLL', 'LFPG', 'EDDF', 'EHAM', 'OMDB', 'OTHH', 'KJFK', 'LEMD']
/**
 * 1. halkanın sınırı, km (`@havayolu/shared` `AIRPORT_RINGS_KM[0]`, D-080). Aday: Türkiye dışında,
 * tarifeli seferi olan, üç harfli IATA kodlu büyük ya da orta havalimanı. Uzaklık Türkiye'deki IATA
 * kodlu bütün satırlara bakılarak ölçülür (listeye girmeyen küçük alanlar dahil); bu, uygulamanın
 * listesinden geniş bir kümedir, böylece fixture her iki ölçüyle 1. halkaya giren bütün alanları
 * içerir.
 */
const FIXTURE_RING_KM = 500
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
const ringAirports = airports.filter(
  (row) =>
    row[countryCol] !== 'TR' &&
    !baseIdents.has(row[identCol]) &&
    (row[typeCol] === 'large_airport' || row[typeCol] === 'medium_airport') &&
    row[scheduledCol] === 'yes' &&
    IATA_CODE.test(row[iataCol] ?? '') &&
    turkishWithIata.some((tr) => distanceKm(position(row), tr) <= FIXTURE_RING_KM),
)
const ringIdents = new Set(ringAirports.map((row) => row[identCol]))

const [runwayHeader = [], ...runways] = read('runways.csv')
const runwayAirportCol = col(runwayHeader, 'airport_ident')
const closedCol = col(runwayHeader, 'closed')
const baseRunways = runways.filter((row) => baseIdents.has(row[runwayAirportCol]))
const ringRunways = runways.filter(
  (row) => ringIdents.has(row[runwayAirportCol]) && row[closedCol] !== '1',
)

const airlines = read('airlines.csv')

const ourairports = join(output, 'ourairports')
const vrs = join(output, 'vrs')
mkdirSync(ourairports, { recursive: true })
mkdirSync(vrs, { recursive: true })
writeFileSync(
  join(ourairports, 'airports.csv'),
  toCsv([airportHeader, ...baseAirports, ...ringAirports]),
)
writeFileSync(
  join(ourairports, 'runways.csv'),
  toCsv([runwayHeader, ...baseRunways, ...ringRunways]),
)
writeFileSync(join(vrs, 'airlines.csv'), toCsv(airlines))
console.log(
  `✓ airports ${baseAirports.length} + ring 1 ${ringAirports.length}, runways ${baseRunways.length} + ${ringRunways.length}, airlines ${airlines.length - 1}`,
)
