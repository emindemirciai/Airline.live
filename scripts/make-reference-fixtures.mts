// Referans verisi fixture'larını, önceden indirilmiş ham dosyalardan üretir. Ağa çıkmaz.
//   pnpm exec tsx scripts/make-reference-fixtures.mts <ham-dosya-klasörü>
// Klasörde OurAirports airports.csv + runways.csv ve VRS airlines.csv bulunur (indirme bir kez,
// kullanıcı onayıyla yapılır; CLAUDE.md DUR-SOR 6). Alt küme: Türkiye'deki bütün kayıtlar ve
// FIXTURE_EXTRA_AIRPORTS; pistler bu havalimanlarınınkiler; havayollarının tamamı.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv } from '../packages/providers/src/reference/csv.ts'

/** Türkiye dışından testlerde kullanılabilecek birkaç büyük havalimanı. */
const FIXTURE_EXTRA_AIRPORTS = ['EGLL', 'LFPG', 'EDDF', 'EHAM', 'OMDB', 'OTHH', 'KJFK', 'LEMD']

const root = fileURLToPath(new URL('..', import.meta.url))
const input = process.argv[2]
if (!input) {
  console.error('Kullanım: tsx scripts/make-reference-fixtures.mts <ham-dosya-klasörü>')
  process.exit(1)
}

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
const countryCol = col(airportHeader, 'iso_country')
const keptAirports = airports.filter(
  (row) => row[countryCol] === 'TR' || FIXTURE_EXTRA_AIRPORTS.includes(row[identCol] ?? ''),
)
const keptIdents = new Set(keptAirports.map((row) => row[identCol]))

const [runwayHeader = [], ...runways] = read('runways.csv')
const runwayAirportCol = col(runwayHeader, 'airport_ident')
const keptRunways = runways.filter((row) => keptIdents.has(row[runwayAirportCol]))

const airlines = read('airlines.csv')

const ourairports = join(root, 'tools', 'fixtures', 'ourairports')
const vrs = join(root, 'tools', 'fixtures', 'vrs')
mkdirSync(ourairports, { recursive: true })
mkdirSync(vrs, { recursive: true })
writeFileSync(join(ourairports, 'airports.csv'), toCsv([airportHeader, ...keptAirports]))
writeFileSync(join(ourairports, 'runways.csv'), toCsv([runwayHeader, ...keptRunways]))
writeFileSync(join(vrs, 'airlines.csv'), toCsv(airlines))
console.log(
  `✓ airports ${keptAirports.length}, runways ${keptRunways.length}, airlines ${airlines.length - 1}`,
)
