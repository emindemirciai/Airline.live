/**
 * Ülke adlarının sınır içi yerleşimi, çevrimdışı üretici (D-096). Ağa çıkmaz; yalnızca yerel
 * dosyaları okur ve yazar.
 *
 * - `fixture`: `node_modules/world-atlas`'tan `tools/fixtures/naturalearth/countries.json`
 *   (kökte `pnpm country-labels:fixture`).
 * - `placements`: fixture'dan `packages/shared/src/map/country-label-placements.ts`
 *   (kökte `pnpm country-labels`). Adlar bu makinedeki Node'un CLDR'ından gelir
 *   (`countryLabelText`). Özet: bileşim başına yazılan ad sayısı, hiç sığmayanlar, başkentten
 *   kayanlar.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { distanceKm } from '@havayolu/geo'
import { COUNTRY_CAPITALS, countryLabelText } from '@havayolu/shared'
import {
  buildFixture,
  decodeFixture,
  FIXTURE_URL,
  readFixture,
  readWorldAtlas,
} from './natural-earth'
import { computePlacements, PLACEMENT_COMBOS, renderPlacementsModule } from './placement'

const TABLE_URL = new URL(
  '../../../packages/shared/src/map/country-label-placements.ts',
  import.meta.url,
)

const USAGE = 'usage: tsx tools/src/country-labels/cli.ts <fixture|placements>'

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
  const { table, details } = computePlacements(decodeFixture(readFixture()), countryLabelText)
  writeFileSync(TABLE_URL, renderPlacementsModule(table))
  console.log(
    `${fileURLToPath(TABLE_URL)}: ${Math.round(performance.now() - started)} ms (Node ${process.versions.node}, ICU ${process.versions.icu})`,
  )
  for (const [k, combo] of PLACEMENT_COMBOS.entries()) {
    const shown = details.filter((detail) => detail.placements[k] !== null)
    const never = details.filter((detail) => detail.placements[k] === null).map((d) => d.code)
    console.log(
      `${combo.locale} ${combo.layout}: ${shown.length} shown; never: ${never.join(' ') || '-'}`,
    )
  }
  for (const detail of details) {
    if (detail.kind === 'capital') continue
    const capital = COUNTRY_CAPITALS.find((candidate) => candidate.code === detail.code)
    if (!capital) continue
    const moves = detail.placements.map((placement, k) => {
      if (!placement) return `${PLACEMENT_COMBOS[k]?.locale} ${PLACEMENT_COMBOS[k]?.layout} -`
      const [lon, lat, fitZoom] = placement
      const km = Math.round(distanceKm({ lat, lon }, capital))
      const capitalZoom = detail.capitalFitZooms[k]
      return `${PLACEMENT_COMBOS[k]?.locale} ${PLACEMENT_COMBOS[k]?.layout} z${fitZoom} (capital ${capitalZoom === Infinity ? '-' : `z${capitalZoom}`}) ${km} km`
    })
    console.log(`  ${detail.code} ${detail.kind}: ${moves.join('; ')}`)
  }
}

const command = process.argv[2]
if (command === 'fixture') writeFixture()
else if (command === 'placements') writePlacements()
else {
  console.error(USAGE)
  process.exitCode = 2
}
