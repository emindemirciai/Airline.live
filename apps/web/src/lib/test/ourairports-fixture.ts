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
 * Commit'li OurAirports fixture'ından (üretim dökümünün Türkiye kesiti ile 1.–4. halkanın yabancı
 * havalimanları, D-080, D-088, D-090, D-101) API'nin döndüreceği `AirportDetail` listesine yakın bir liste kurar:
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

/**
 * İçe aktarımın uç uzaklığı kuralı (D-101; `@havayolu/providers` `endsAreTooFarApart`,
 * `MAX_RUNWAY_END_SEPARATION_RATIO` ve `MAX_RUNWAY_END_SEPARATION_M`; web o pakete bağımlı değildir,
 * `packages/providers/src/reference/reference.test.ts` değerleri karşılaştırır): uçlar kayıtlı
 * uzunluğun iki katından ve 1 km'den uzaksa uç koordinatları kullanılmaz.
 */
const MAX_RUNWAY_END_SEPARATION_RATIO = 2
const MAX_RUNWAY_END_SEPARATION_M = 1000
const M_PER_FT = 0.3048

function endsAreTooFarApart(row: Row): boolean {
  const lengthFt = num(row.length_ft)
  const le = { lat: num(row.le_latitude_deg), lon: num(row.le_longitude_deg) }
  const he = { lat: num(row.he_latitude_deg), lon: num(row.he_longitude_deg) }
  if (lengthFt === null || lengthFt <= 0) return false
  if (le.lat === null || le.lon === null || he.lat === null || he.lon === null) return false
  const separationM = distanceKm({ lat: le.lat, lon: le.lon }, { lat: he.lat, lon: he.lon }) * 1000
  return (
    separationM > lengthFt * M_PER_FT * MAX_RUNWAY_END_SEPARATION_RATIO &&
    separationM > MAX_RUNWAY_END_SEPARATION_M
  )
}

/**
 * Pistin bir ucu. Uçları kayıtlı uzunluğa göre çok uzak pistte (VAAM, D-101) API gibi: yön heading
 * alanından, eşik havalimanı merkezinde (`arp`).
 */
function end(
  row: Row,
  prefix: 'le' | 'he',
  other: 'le' | 'he',
  arp: { lat: number; lon: number },
): RunwayEnd {
  const usable = !endsAreTooFarApart(row)
  const lat = num(row[`${prefix}_latitude_deg`])
  const lon = num(row[`${prefix}_longitude_deg`])
  const otherLat = num(row[`${other}_latitude_deg`])
  const otherLon = num(row[`${other}_longitude_deg`])
  const bearing =
    usable && lat !== null && lon !== null && otherLat !== null && otherLon !== null
      ? initialBearing({ lat, lon }, { lat: otherLat, lon: otherLon })
      : num(row[`${prefix}_heading_degT`])
  return {
    ident: row[`${prefix}_ident`] ?? '',
    trueBearingDeg: bearing,
    displacedThresholdFt: num(row[`${prefix}_displaced_threshold_ft`]),
    thresholdLat: usable ? lat : arp.lat,
    thresholdLon: usable ? lon : arp.lon,
  }
}

let cached: AirportDetail[] | undefined
let cachedListed: AirportDetail[] | undefined
let cachedRunways: Row[] | undefined

/**
 * API'nin gizlediği yinelenen boş pist satırları (D-088, D-090, D-101; `@havayolu/db` →
 * `HIDDEN_RUNWAY_IDS`, web o pakete bağımlı değildir, `packages/db/src/airports.test.ts` iki listeyi
 * karşılaştırır): Bujumbura "02/20", Hassi Messaoud "01/19", Taba "04/22", Beauvais "13R/31L",
 * Cluj-Napoca "08/26", Linz "07H/25H" ve Voronej "18/36"; yalnız uzunluk ve genişlik boşken.
 */
const HIDDEN_RUNWAY_IDS = new Set([
  '260310',
  '260338',
  '260339',
  '260344',
  '260408',
  '504922',
  '608245',
])

/** Bundan kısa kayıtlı uzunluk pist değildir, ft (`@havayolu/db` `MIN_RUNWAY_LENGTH_FT`, D-101). */
const MIN_RUNWAY_LENGTH_FT = 100

/**
 * API'nin gösterdiği pist satırları (`isHiddenRunway`): açık, tabloda boş satır olarak yok, karşı
 * ucu var (D-090: tek uçlu satır pist değildir; Stuttgart'ın H-NORTH ve H-SOUTH helikopter alanları)
 * ve kayıtlı uzunluğu 100 ft'ten kısa değil (D-101: Pamplona'nın 2 ft'lik "03/21" satırı).
 */
function openRunways(): Row[] {
  cachedRunways ??= read('runways.csv').filter((row) => {
    const lengthFt = num(row.length_ft)
    return (
      row.closed !== '1' &&
      (row.he_ident ?? '').trim() !== '' &&
      !(lengthFt !== null && lengthFt < MIN_RUNWAY_LENGTH_FT) &&
      !(HIDDEN_RUNWAY_IDS.has(row.id ?? '') && !row.length_ft && !row.width_ft)
    )
  })
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
  const arp = { lat: Number(row.latitude_deg), lon: Number(row.longitude_deg) }
  return {
    icao,
    iata: row.iata_code ?? '',
    // API gibi (`cleanAirportName`): art arda boşluklar teke iner (Bacău, D-088), tek başına duran
    // küçük harfli "airport" büyük harfle yazılır (Fransız havalimanları, D-090).
    name: (row.name ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\bairport\b/g, 'Airport'),
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
        ends: [end(r, 'le', 'he', arp), end(r, 'he', 'le', arp)],
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
 * yabancı adaylar (`isForeignCandidate`; kanonik ICAO'su dört karakter, D-101). Uzaklık, Türkiye'deki
 * en yakın IATA kodlu havalimanına büyük daire mesafesidir (API'nin `distanceToTrKm`'i ve
 * `nearestTr`'si gibi, tam km); fixture'daki uzak halkalar listeye girmez.
 */
export function fixtureListedAirports(): AirportDetail[] {
  cachedListed ??= [
    ...fixtureTurkishAirports(),
    ...foreignCandidates()
      .filter((candidate) => candidate.ring <= ENABLED_AIRPORT_RING)
      .map(candidateDetail),
  ]
  return cachedListed
}

/**
 * Halkası açık olsun olmasın, fixture'daki bir yabancı adayın (`isForeignCandidate`) API'deki
 * kaydı: halka henüz kapalıyken 4. halkanın sayfalarını denetlemek için (D-101). Aday değilse hata.
 */
export function fixtureForeignAirport(icao: string): AirportDetail {
  const candidate = foreignCandidates().find((c) => icaoOf(c.row) === icao)
  if (!candidate) throw new Error(`fixture has no foreign candidate ${icao}`)
  return candidateDetail(candidate)
}

interface ForeignCandidate {
  row: Row
  ring: number
  km: number
  nearest: AirportDetail['nearestTr']
}

let cachedCandidates: ForeignCandidate[] | undefined

/** Bütün halkaların yabancı adayları, kaynak sırasıyla; Türkiye'deki en yakın havalimanıyla. */
function foreignCandidates(): ForeignCandidate[] {
  if (cachedCandidates) return cachedCandidates
  const references = turkishReferences().map((row) => ({
    lat: Number(row.latitude_deg),
    lon: Number(row.longitude_deg),
    nearest: { icao: icaoOf(row), iata: row.iata_code ?? '', name: row.name ?? '' },
  }))
  cachedCandidates = read('airports.csv')
    .filter(
      (row) =>
        row.iso_country !== 'TR' &&
        isForeignCandidate(
          row.type ?? '',
          row.scheduled_service === 'yes',
          row.iata_code ?? '',
          icaoOf(row),
        ),
    )
    .flatMap((row) => {
      const point = { lat: Number(row.latitude_deg), lon: Number(row.longitude_deg) }
      let best: { km: number; nearest: AirportDetail['nearestTr'] } | null = null
      for (const reference of references) {
        const km = distanceKm(point, reference)
        if (best === null || km < best.km) best = { km, nearest: reference.nearest }
      }
      return best === null ? [] : [{ row, ring: airportRing(best.km), ...best }]
    })
  return cachedCandidates
}

/** API gibi: halka tam uzaklıktan, `distanceToTrKm` tam sayıya yuvarlı. */
const candidateDetail = (candidate: ForeignCandidate): AirportDetail =>
  toDetail(candidate.row, candidate.ring, Math.round(candidate.km), candidate.nearest)
