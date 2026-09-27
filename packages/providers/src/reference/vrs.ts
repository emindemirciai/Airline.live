import { iterateCsvRecords } from './csv'
import { rowHash, type ParseResult, type SkippedRow } from './ourairports'

/** VRS standing-data havayolları (CC0; data-sources.md §4). Aynada yoktur, GitHub raw kullanılır. */
export const VRS_AIRLINES_URL =
  'https://raw.githubusercontent.com/vradarserver/standing-data/main/airlines/schema-01/airlines.csv'

export interface AirlineRow {
  /** VRS Code: benzersiz anahtar (ICAO yoksa IATA ya da başka bir kod olabilir). */
  code: string
  name: string
  icao: string | null
  iata: string | null
  positioningFlightPattern: string | null
  charterFlightPattern: string | null
  rowHash: string
}

const text = (value: string | undefined): string | null => {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

export function parseAirlines(csv: string): ParseResult<AirlineRow> {
  const rows: AirlineRow[] = []
  const skipped: SkippedRow[] = []
  const seen = new Set<string>()
  for (const { line, values } of iterateCsvRecords(csv)) {
    if (!values) {
      skipped.push({ line, reason: 'sütun sayısı tutmuyor' })
      continue
    }
    const code = text(values.Code)
    const name = text(values.Name)
    if (!code || !name) {
      skipped.push({ line, reason: 'Code ya da Name boş' })
      continue
    }
    if (seen.has(code)) {
      skipped.push({ line, reason: `Code yineleniyor: ${code}` })
      continue
    }
    seen.add(code)
    const base = {
      code,
      name,
      icao: text(values.ICAO),
      iata: text(values.IATA),
      positioningFlightPattern: text(values.PositioningFlightPattern),
      charterFlightPattern: text(values.CharterFlightPattern),
    }
    rows.push({ ...base, rowHash: rowHash(base) })
  }
  return { rows, skipped, ignored: 0 }
}
