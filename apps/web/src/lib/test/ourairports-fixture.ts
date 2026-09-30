import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { initialBearing } from '@havayolu/geo'
import type { AirportDetail, RunwayDetail, RunwayEnd } from '@havayolu/shared'

/**
 * Commit'li OurAirports fixture'ından (üretim dökümünün Türkiye kesiti) API'nin döndüreceği
 * `AirportDetail` listesine yakın bir liste kurar: IATA kodlu Türkiye havalimanları, içe aktarım
 * filtresi (büyük/orta ya da tarifeli; data-sources.md §3), açık pistler ve tohum istasyonları.
 * Sayfa metinlerinin her gerçek havalimanı için sınırlar içinde kaldığını denetlemek içindir.
 */
const FIXTURE_DIR = new URL('../../../../../tools/fixtures/ourairports/', import.meta.url)

/** Tohum istasyonlar (CLAUDE.md): IST birincil. */
const STATIONS: Readonly<Record<string, { primary: boolean }>> = {
  LTFM: { primary: true },
  LTFJ: { primary: false },
  LTAC: { primary: false },
  LTBJ: { primary: false },
  LTAI: { primary: false },
}

type Row = Record<string, string>

/** RFC 4180 CSV (tırnaklı alanlar, çift tırnak kaçışı). */
function parseCsv(text: string): Row[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  const [header = [], ...body] = rows
  return body.map((cells) => Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ''])))
}

function read(file: string): Row[] {
  return parseCsv(readFileSync(fileURLToPath(new URL(file, FIXTURE_DIR)), 'utf8'))
}

const num = (value: string | undefined): number | null =>
  value === undefined || value.trim() === '' ? null : Number(value)

function end(row: Row, prefix: 'le' | 'he', other: 'le' | 'he'): RunwayEnd {
  const lat = num(row[`${prefix}_latitude_deg`])
  const lon = num(row[`${prefix}_longitude_deg`])
  const otherLat = num(row[`${other}_latitude_deg`])
  const otherLon = num(row[`${other}_longitude_deg`])
  const bearing =
    lat !== null && lon !== null && otherLat !== null && otherLon !== null
      ? initialBearing({ lat, lon }, { lat: otherLat, lon: otherLon })
      : num(row[`${prefix}_heading_degT`])
  return {
    ident: row[`${prefix}_ident`] ?? '',
    trueBearingDeg: bearing,
    displacedThresholdFt: num(row[`${prefix}_displaced_threshold_ft`]),
    thresholdLat: lat,
    thresholdLon: lon,
  }
}

let cached: AirportDetail[] | undefined

export function fixtureTurkishAirports(): AirportDetail[] {
  if (cached) return cached
  const runways = read('runways.csv').filter((row) => row.closed !== '1')
  cached = read('airports.csv')
    .filter(
      (row) =>
        row.iso_country === 'TR' &&
        row.iata_code !== '' &&
        (row.type === 'large_airport' ||
          row.type === 'medium_airport' ||
          row.scheduled_service === 'yes'),
    )
    .map((row): AirportDetail => {
      const icao = row.icao_code || row.gps_code || row.ident || ''
      const station = STATIONS[icao]
      return {
        icao,
        iata: row.iata_code ?? '',
        name: row.name ?? '',
        city: row.municipality || null,
        lat: Number(row.latitude_deg),
        lon: Number(row.longitude_deg),
        elevationFt: num(row.elevation_ft),
        type: row.type as AirportDetail['type'],
        scheduled: row.scheduled_service === 'yes',
        isoRegion: row.iso_region ?? '',
        municipality: row.municipality || null,
        station: station ? { active: true, primary: station.primary, fetchRadiusNm: 60 } : null,
        dataUpdatedAt: '2026-09-29T04:40:00.000Z',
        runways: runways
          .filter((r) => r.airport_ident === row.ident)
          .map((r): RunwayDetail => ({
            id: Number(r.id),
            lengthFt: num(r.length_ft),
            widthFt: num(r.width_ft),
            surface: r.surface || null,
            lighted: r.lighted === '1',
            ends: [end(r, 'le', 'he'), end(r, 'he', 'le')],
          }))
          .sort((a, b) => (a.ends[0].ident < b.ends[0].ident ? -1 : 1)),
      }
    })
  return cached
}
