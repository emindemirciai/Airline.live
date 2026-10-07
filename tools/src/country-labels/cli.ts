/**
 * Ülke adlarının sınır içi yerleşimi, çevrimdışı üretici (D-096). Ağa çıkmaz; yalnızca yerel
 * dosyaları okur ve yazar.
 *
 * - `fixture`: `node_modules/world-atlas`'tan `tools/fixtures/naturalearth/countries.json`
 *   (kökte `pnpm country-labels:fixture`).
 * - `placements`: fixture'lardan (Natural Earth ve OurAirports'un haritada pini çizilen
 *   havalimanları: listelenenler; askerî hava üsleri listede yok, D-103, D-107)
 *   `packages/shared/src/map/country-label-placements.ts` (kökte `pnpm country-labels`). Adlar bu
 *   makinedeki Node'un CLDR'ından gelir (`countryLabelText`). Özet: bileşim başına yazılan ad
 *   sayısı, hiç sığmayanlar, yerleşim türleri, boş yer için geciken adlar, boş yer bulunamayan ve
 *   başkentte sabit adların çakışması (D-099).
 * - `airports`: fixture'ın listelenen havalimanlarının ICAO kodları (498; askerî hava üsleri
 *   listelenmez, D-107), satır başına bir, sıralı (kökte
 *   `pnpm exec tsx tools/src/country-labels/cli.ts airports`). Kullanıcı bunu üretimin
 *   `GET /v1/airports?scope=listed` listesiyle karşılaştırır (ACTIVATION, D-099): üretim
 *   OurAirports'u her gece yeniler, fixture 2026-10-01 kopyasıdır. Tablonun engelleri bu listedir.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { countryLabelText } from '@havayolu/shared'
import {
  AirportObstacles,
  listedAirportPins,
  mapAirportPins,
  readOurAirportsFixture,
} from './airport-pins'
import {
  buildFixture,
  decodeFixture,
  FIXTURE_URL,
  readFixture,
  readWorldAtlas,
} from './natural-earth'
import {
  computePlacements,
  PLACEMENT_COMBOS,
  placementParams,
  renderPlacementsModule,
} from './placement'

const TABLE_URL = new URL(
  '../../../packages/shared/src/map/country-label-placements.ts',
  import.meta.url,
)

const USAGE = 'usage: tsx tools/src/country-labels/cli.ts <fixture|placements|airports>'

function printAirports(): void {
  const icaos = listedAirportPins(readOurAirportsFixture()).map((airport) => airport.icao)
  console.log(icaos.join('\n'))
}

function writeFixture(): void {
  const fixture = buildFixture(readWorldAtlas())
  mkdirSync(new URL('.', FIXTURE_URL), { recursive: true })
  writeFileSync(FIXTURE_URL, `${JSON.stringify(fixture)}\n`)
  let points = 0
  for (const parts of Object.values(fixture.countries)) {
    for (const rings of parts) for (const ring of rings) points += ring.length / 2
  }
  console.log(
    `${fileURLToPath(FIXTURE_URL)}: ${Object.keys(fixture.countries).length} countries, ${points} points`,
  )
}

function writePlacements(): void {
  const started = performance.now()
  const obstacles = new AirportObstacles(mapAirportPins(readOurAirportsFixture()))
  const { table, details } = computePlacements(
    decodeFixture(readFixture()),
    countryLabelText,
    obstacles,
  )
  writeFileSync(TABLE_URL, renderPlacementsModule(table, placementParams(obstacles)))
  console.log(
    `${fileURLToPath(TABLE_URL)}: ${Math.round(performance.now() - started)} ms (Node ${process.versions.node}, ICU ${process.versions.icu}); ${obstacles.airports.length} airport pins`,
  )
  for (const [k, combo] of PLACEMENT_COMBOS.entries()) {
    const shown = details.filter((detail) => detail.placements[k] !== null)
    const never = details.filter((detail) => detail.placements[k] === null).map((d) => d.code)
    console.log(
      `${combo.locale} ${combo.layout}: ${shown.length} shown; never: ${never.join(' ') || '-'}`,
    )
  }
  for (const kind of ['clear', 'crowded', 'capital', 'per-combination', 'hidden'] as const) {
    const codes = details.filter((detail) => detail.kind === kind).map((detail) => detail.code)
    console.log(`${kind}: ${codes.length}${codes.length > 0 ? ` (${codes.join(' ')})` : ''}`)
  }
  for (const detail of details) {
    const delays = detail.placements.map((placement, k) =>
      placement ? placement[2] - (detail.bestFitZooms[k] as number) : 0,
    )
    const reported = detail.kind === 'crowded' || detail.kind === 'capital'
    if (!reported && delays.every((delay) => delay === 0)) continue
    const parts = detail.placements.map((placement, k) => {
      const combo = `${PLACEMENT_COMBOS[k]?.locale} ${PLACEMENT_COMBOS[k]?.layout}`
      if (!placement) return `${combo} -`
      return `${combo} z${placement[2]} (earliest z${detail.bestFitZooms[k]}) overlaps ${detail.overlaps[k]}`
    })
    console.log(`  ${detail.code} ${detail.kind}: ${parts.join('; ')}`)
  }
}

const command = process.argv[2]
if (command === 'fixture') writeFixture()
else if (command === 'placements') writePlacements()
else if (command === 'airports') printAirports()
else {
  console.error(USAGE)
  process.exitCode = 2
}
