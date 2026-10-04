import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { distanceKm, initialBearing } from '@havayolu/geo'
import {
  airportRing,
  ENABLED_AIRPORT_RING,
  isForeignCandidate,
  ourAirportsIcao,
  type AirportDetail,
  type RunwayDetail,
  type RunwayEnd,
} from '@havayolu/shared'

/**
 * Commit'li OurAirports fixture'ından (üretim dökümünün Türkiye kesiti ile 1. ve 2. halkanın yabancı
 * havalimanları, D-080, D-088) API'nin döndüreceği `AirportDetail` listesine yakın bir liste kurar:
 * IATA kodlu Türkiye havalimanları, içe aktarım filtresi (büyük/orta ya da tarifeli; data-sources.md §3),
 * açık pistler ve tohum istasyonları; `fixtureListedAirports` bunlara açık halkalardaki yabancı
 * adayları ekler. Sayfa metinlerinin her gerçek havalimanı için sınırlar içinde kaldığını denetlemek
 * içindir.
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
let cachedListed: AirportDetail[] | undefined
let cachedRunways: Row[] | undefined

/**
 * API'nin gizlediği yinelenen boş pist satırları (D-088; `@havayolu/db` → `HIDDEN_RUNWAY_IDS`, web o
 * pakete bağımlı değildir): Taba "04/22" ve Cluj-Napoca "08/26"; yalnız uzunluk ve genişlik boşken.
 */
const HIDDEN_RUNWAY_IDS = new Set(['260339', '260408'])

function openRunways(): Row[] {
  cachedRunways ??= read('runways.csv').filter(
    (row) =>
      row.closed !== '1' &&
      !(HIDDEN_RUNWAY_IDS.has(row.id ?? '') && !row.length_ft && !row.width_ft),
  )
  return cachedRunways
}

const importable = (row: Row) =>
  row.type === 'large_airport' || row.type === 'medium_airport' || row.scheduled_service === 'yes'

/**
 * Listedeki kimlik kuralı (API ile aynı, `ourAirportsIcao`): ICAO, yoksa GPS kodu, o da yoksa
 * OurAirports kimliği; kaynakta yanlış olduğu bilinen kod düzeltilir (İskenderiye HEAX → HEBA, D-088).
 */
const icaoOf = (row: Row) =>
  ourAirportsIcao({ ident: row.ident ?? '', icaoCode: row.icao_code, gpsCode: row.gps_code })

function toDetail(
  row: Row,
  ring: number,
  distanceToTrKm: number | null,
  nearestTr: AirportDetail['nearestTr'] = null,
): AirportDetail {
  const icao = icaoOf(row)
  const station = STATIONS[icao]
  return {
    icao,
    iata: row.iata_code ?? '',
    // API gibi art arda boşluklar teke iner (Bacău, `cleanAirportName`; D-088).
    name: (row.name ?? '').trim().replace(/\s+/g, ' '),
    city: row.municipality || null,
    lat: Number(row.latitude_deg),
    lon: Number(row.longitude_deg),
    elevationFt: num(row.elevation_ft),
    type: row.type as AirportDetail['type'],
    scheduled: row.scheduled_service === 'yes',
    isoRegion: row.iso_region ?? '',
    municipality: row.municipality || null,
    country: row.iso_country ?? '',
    ring,
    distanceToTrKm,
    nearestTr,
    station: station ? { active: true, primary: station.primary, fetchRadiusNm: 60 } : null,
    dataUpdatedAt: '2026-09-29T04:40:00.000Z',
    runways: openRunways()
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
}

/** IATA kodlu Türkiye havalimanları (bugünkü 61; içe aktarım filtresiyle). */
export function fixtureTurkishAirports(): AirportDetail[] {
  cached ??= read('airports.csv')
    .filter((row) => row.iso_country === 'TR' && row.iata_code !== '' && importable(row))
    .map((row) => toDetail(row, 0, null))
  return cached
}

/**
 * Türkiye'deki uzaklık referansları (API'nin kuralı, D-080): IATA kodlu büyük, orta ve küçük
 * alanlar; tarifesiz küçük alanlar da (Gökçeada gibi; listelenmezler).
 */
function turkishReferences(): Row[] {
  return read('airports.csv').filter(
    (row) =>
      row.iso_country === 'TR' &&
      /^[A-Z]{3}$/.test(row.iata_code ?? '') &&
      ['large_airport', 'medium_airport', 'small_airport'].includes(row.type ?? ''),
  )
}

/**
 * Listelenen havalimanları (D-080): Türkiye havalimanları ve halkası `ENABLED_AIRPORT_RING`'i aşmayan
 * yabancı adaylar (`isForeignCandidate`). Uzaklık, Türkiye'deki en yakın IATA kodlu havalimanına
 * büyük daire mesafesidir (API'nin `distanceToTrKm`'i ve `nearestTr`'si gibi, tam km); fixture'daki
 * uzak halkalar listeye girmez.
 */
export function fixtureListedAirports(): AirportDetail[] {
  if (cachedListed) return cachedListed
  const turkey = fixtureTurkishAirports()
  const references = turkishReferences().map((row) => ({
    lat: Number(row.latitude_deg),
    lon: Number(row.longitude_deg),
    nearest: { icao: icaoOf(row), iata: row.iata_code ?? '', name: row.name ?? '' },
  }))
  const foreign = read('airports.csv')
    .filter(
      (row) =>
        row.iso_country !== 'TR' &&
        isForeignCandidate(row.type ?? '', row.scheduled_service === 'yes', row.iata_code ?? ''),
    )
    .flatMap((row) => {
      const point = { lat: Number(row.latitude_deg), lon: Number(row.longitude_deg) }
      let best: { km: number; nearest: AirportDetail['nearestTr'] } | null = null
      for (const reference of references) {
        const km = distanceKm(point, reference)
        if (best === null || km < best.km) best = { km, nearest: reference.nearest }
      }
      if (best === null) return []
      const ring = airportRing(best.km)
      // API gibi: halka tam uzaklıktan, `distanceToTrKm` tam sayıya yuvarlı.
      return ring <= ENABLED_AIRPORT_RING
        ? [toDetail(row, ring, Math.round(best.km), best.nearest)]
        : []
    })
  cachedListed = [...turkey, ...foreign]
  return cachedListed
}
