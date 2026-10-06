import { createHash } from 'node:crypto'
import {
  bearingDifference,
  distanceKm,
  initialBearing,
  M_PER_FT,
  runwayThreshold,
  type LatLon,
  type ThresholdSource,
} from '@havayolu/geo'
import { iterateCsvRecords } from './csv'

/** OurAirports airports.csv ve runways.csv (kamu malı; data-sources.md §3). */
export const OURAIRPORTS_URLS = {
  airports: 'https://davidmegginson.github.io/ourairports-data/airports.csv',
  runways: 'https://davidmegginson.github.io/ourairports-data/runways.csv',
} as const

export interface SkippedRow {
  line: number
  reason: string
}

export interface ParseResult<T> {
  rows: T[]
  /** Hatalı olduğu için atlanan satırlar (loglanır). */
  skipped: SkippedRow[]
  /** Filtre dışı kalan satırların sayısı (hata değildir). */
  ignored: number
}

export interface AirportRow {
  id: number
  ident: string
  type: string
  name: string
  latitudeDeg: number
  longitudeDeg: number
  elevationFt: number | null
  isoCountry: string
  isoRegion: string
  municipality: string | null
  scheduledService: boolean
  icaoCode: string | null
  iataCode: string | null
  gpsCode: string | null
  /** Satırın özeti: değişmeyen satır veritabanına yeniden yazılmaz. */
  rowHash: string
}

/** Pist yönü nereden geldi: iki uç koordinatı (tercih) ya da kayıttaki heading alanı. */
export type BearingSource = 'coordinates' | 'heading_field'

/** Kayıttaki heading alanı koordinatlardan hesaplanan yönden bu kadar saparsa tutarsız sayılır. */
export const HEADING_MISMATCH_DEG = 1

export interface RunwayEnd {
  ident: string | null
  latitudeDeg: number | null
  longitudeDeg: number | null
  elevationFt: number | null
  /** OurAirports `*_heading_degT` (olduğu gibi; bazı kayıtlarda hatalı, D-066). */
  headingDegT: number | null
  displacedThresholdFt: number | null
  /** Bu uçtan karşı uca gerçek yön; koordinatlardan, yoksa heading alanından. */
  trueBearingDeg: number | null
  bearingSource: BearingSource | null
  /** heading alanı koordinat yönünden HEADING_MISMATCH_DEG'den fazla sapıyor. */
  headingMismatch: boolean
  /** Pist eşiği (domain.md): uç, kaydırma miktarı kadar pist yönünde taşınmış hâli. */
  thresholdLat: number
  thresholdLon: number
  thresholdSource: ThresholdSource
}

export interface RunwayRow {
  id: number
  airportId: number
  airportIdent: string
  lengthFt: number | null
  widthFt: number | null
  surface: string | null
  lighted: boolean
  /**
   * Uç koordinatları zaten kaydırılmış eşikleri gösteriyor (uçlar arası mesafe uzunluk eksi
   * kaydırmaya uyuyor); bu durumda koordinatlar yeniden kaydırılmaz (D-066, ör. LTAC 03L).
   */
  endsAreThresholds: boolean
  le: RunwayEnd
  he: RunwayEnd
  rowHash: string
}

/** Uzunluk tutarlılığı için tolerans (M2 kabulündeki ±50 m ile aynı). */
export const RUNWAY_LENGTH_TOLERANCE_M = 50

/**
 * Uçlar bundan yakınsa (ya da kayıtlı uzunluğun %10'undan kısa bir aralıktaysa) koordinatlar yön için
 * kullanılmaz: kaynakta iki ucu aynı noktaya yazılmış pistler var (ör. LHTL, MDLR); aynı iki noktadan
 * hesaplanan yön 0° (kuzey) çıkar ve kaydırılmış eşik pistin dışına düşerdi.
 */
export const MIN_RUNWAY_END_SEPARATION_M = 100

/** İki uç yön hesabına yetecek kadar ayrık mı? */
export function endsAreSeparated(le: LatLon, he: LatLon, lengthFt: number | null): boolean {
  const separationM = distanceKm(le, he) * 1000
  const minimum = Math.max(MIN_RUNWAY_END_SEPARATION_M, (lengthFt ?? 0) * M_PER_FT * 0.1)
  return separationM >= minimum
}

/** Uçlar kayıtlı uzunluğun bu katından uzaksa uç koordinatları kullanılmaz (D-101). */
export const MAX_RUNWAY_END_SEPARATION_RATIO = 2

/** ... ve aynı zamanda bundan uzaksa, m (kısa pistlerde küçük konum hataları kuralı tetiklemez). */
export const MAX_RUNWAY_END_SEPARATION_M = 1000

/**
 * İki uç kayıtlı uzunluğa göre çok mu uzak (D-101, `endsAreSeparated`'ın üst sınırı)? Uçlar arası
 * mesafe hem uzunluğun `MAX_RUNWAY_END_SEPARATION_RATIO` katından hem
 * `MAX_RUNWAY_END_SEPARATION_M`'den fazlaysa uç koordinatlarından en az biri yanlıştır: Amravati'nin
 * (VAAM, 610195) 08/26 pisti 1.850 m kayıtlı, uçları 74,5 km arayla yazılmış; o uçlardan hesaplanan
 * yön 89,6°/269,6° olur, heading alanı 75°/255° der. Uzunluk bilinmiyorsa kural uygulanmaz
 * (karşılaştıracak değer yok; 2026-10-01 indirmesinde uzunluksuz ve iki uçlu açık pist ikidir, ikisi
 * de 1 km'den kısa). 2026-10-01 indirmesinin bütün açık pistlerinde kural 24 satırı yakalar,
 * fixture'ın açık pistlerinde yalnız 610195'i; heading alanının birkaç derece saptığı pistler
 * (D-066, LTFM) kuralın çok altındadır. Böyle pistte yön heading alanından gelir, eşikler
 * havalimanı merkezine düşer (`arp_fallback`); pist sayfada sayılır.
 */
export function endsAreTooFarApart(le: LatLon, he: LatLon, lengthFt: number | null): boolean {
  if (lengthFt === null || lengthFt <= 0) return false
  const separationM = distanceKm(le, he) * 1000
  return (
    separationM > lengthFt * M_PER_FT * MAX_RUNWAY_END_SEPARATION_RATIO &&
    separationM > MAX_RUNWAY_END_SEPARATION_M
  )
}

/**
 * Kaydırma varken uç koordinatları fiziksel pist uçları mı, yoksa zaten eşikler mi? Uçlar arası
 * mesafe "uzunluk − kaydırmalar"a daha yakınsa ve tolerans içindeyse koordinatlar eşiktir.
 * Bilgi yetmezse domain.md'deki varsayım (fiziksel uç, kaydırılır) geçerlidir.
 */
export function endsLookLikeThresholds(
  le: LatLon | null,
  he: LatLon | null,
  lengthFt: number | null,
  displacedFt: number,
): boolean {
  if (!le || !he || lengthFt === null || displacedFt <= 0) return false
  const endsM = distanceKm(le, he) * 1000
  const lengthM = lengthFt * M_PER_FT
  const asThresholds = Math.abs(endsM - (lengthM - displacedFt * M_PER_FT))
  const asEnds = Math.abs(endsM - lengthM)
  return asThresholds < asEnds && asThresholds <= RUNWAY_LENGTH_TOLERANCE_M
}

/** Satırın içe aktarım süzgecinin baktığı alanları. */
export interface AirportKind {
  type: string
  scheduledService: boolean
  /** OurAirports `iso_country` (ISO 3166-1 alpha-2). */
  isoCountry: string
  /** OurAirports `iata_code`; boşsa null. */
  iataCode: string | null
}

/**
 * Uzaklık referansı olarak içe aktarılan küçük alanların ülkesi: Türkiye. Yurt dışı havalimanlarının
 * halkası Türkiye'deki IATA kodlu en yakın havalimanına uzaklıktan hesaplanır (D-080).
 */
export const REFERENCE_SMALL_AIRPORT_COUNTRY = 'TR'

const IATA_CODE = /^[A-Z]{3}$/

/**
 * İçe aktarılan havalimanları (data-sources.md §3): büyük ve orta havalimanları, tarifeli sefer
 * alanlar ve Türkiye'nin IATA kodlu küçük alanları. Sonuncular (Gökçeada, Selçuk-Efes, Bodrum-İmsık
 * gibi tarifesiz 5 alan, 2026-10-01) yalnızca yurt dışı havalimanlarının Türkiye'ye uzaklığının
 * referansıdır (D-080); listelenmez, sayfaları ve hava durumları yoktur. Diğer küçük alanlar,
 * heliportlar ve kapalı alanlar alınmaz.
 */
export function isImportedAirport(airport: AirportKind): boolean {
  if (
    airport.type === 'large_airport' ||
    airport.type === 'medium_airport' ||
    airport.scheduledService
  ) {
    return true
  }
  return (
    airport.type === 'small_airport' &&
    airport.isoCountry.trim().toUpperCase() === REFERENCE_SMALL_AIRPORT_COUNTRY &&
    IATA_CODE.test(airport.iataCode?.trim().toUpperCase() ?? '')
  )
}

class RowError extends Error {}

export function rowHash(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex')
}

const text = (value: string | undefined): string | null => {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

function number(value: string | undefined, field: string): number | null {
  const raw = text(value)
  if (raw === null) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) throw new RowError(`${field} sayı değil: ${raw}`)
  return parsed
}

function requiredText(value: string | undefined, field: string): string {
  const raw = text(value)
  if (raw === null) throw new RowError(`${field} boş`)
  return raw
}

function coordinate(lat: number | null, lon: number | null, field: string): LatLon | null {
  if (lat === null || lon === null) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new RowError(`${field} koordinatı geçersiz: ${lat},${lon}`)
  }
  return { lat, lon }
}

/**
 * `filter` dışında kalan satırlar doğrulanmadan sayılıp geçilir; böylece tam dosyadaki (~85 bin
 * satır) küçük alanların kusurları atlanan satır olarak görünmez ve bellekte tutulmaz.
 */
export function parseAirports(
  csv: string,
  filter: (airport: AirportKind) => boolean = isImportedAirport,
): ParseResult<AirportRow> {
  const rows: AirportRow[] = []
  const skipped: SkippedRow[] = []
  let ignored = 0
  for (const { line, values } of iterateCsvRecords(csv)) {
    if (!values) {
      skipped.push({ line, reason: 'sütun sayısı tutmuyor' })
      continue
    }
    const kind: AirportKind = {
      type: (values.type ?? '').trim(),
      scheduledService: text(values.scheduled_service) === 'yes',
      isoCountry: (values.iso_country ?? '').trim(),
      iataCode: text(values.iata_code),
    }
    if (!filter(kind)) {
      ignored += 1
      continue
    }
    try {
      const id = number(values.id, 'id')
      if (id === null || !Number.isInteger(id)) throw new RowError('id geçersiz')
      const point = coordinate(
        number(values.latitude_deg, 'latitude_deg'),
        number(values.longitude_deg, 'longitude_deg'),
        'havalimanı',
      )
      if (!point) throw new RowError('koordinat boş')
      const base = {
        id,
        ident: requiredText(values.ident, 'ident'),
        type: requiredText(values.type, 'type'),
        name: requiredText(values.name, 'name'),
        latitudeDeg: point.lat,
        longitudeDeg: point.lon,
        elevationFt: number(values.elevation_ft, 'elevation_ft'),
        isoCountry: requiredText(values.iso_country, 'iso_country'),
        isoRegion: requiredText(values.iso_region, 'iso_region'),
        municipality: text(values.municipality),
        scheduledService: text(values.scheduled_service) === 'yes',
        icaoCode: text(values.icao_code),
        iataCode: text(values.iata_code),
        gpsCode: text(values.gps_code),
      }
      rows.push({ ...base, rowHash: rowHash(base) })
    } catch (error) {
      if (!(error instanceof RowError)) throw error
      skipped.push({ line, reason: error.message })
    }
  }
  return { rows, skipped, ignored }
}

/**
 * Pistin bir ucu. `endUsable` false ise (uçlar kayıtlı uzunluğa göre çok uzak, `endsAreTooFarApart`)
 * uç koordinatı ne yön ne eşik için kullanılır: yön heading alanından, eşik havalimanı merkezinden
 * (ARP) gelir. Ham koordinatlar kayıtta olduğu gibi kalır.
 */
function runwayEnd(
  values: Record<string, string>,
  prefix: 'le' | 'he',
  opposite: LatLon | null,
  arp: LatLon,
  endsAreThresholds: boolean,
  endUsable: boolean,
): RunwayEnd {
  const ident = text(values[`${prefix}_ident`])
  const latitudeDeg = number(values[`${prefix}_latitude_deg`], `${prefix}_latitude_deg`)
  const longitudeDeg = number(values[`${prefix}_longitude_deg`], `${prefix}_longitude_deg`)
  const recorded = coordinate(latitudeDeg, longitudeDeg, `${prefix} ucu`)
  const point = endUsable ? recorded : null
  const headingDegT = number(values[`${prefix}_heading_degT`], `${prefix}_heading_degT`)
  const displacedThresholdFt = number(
    values[`${prefix}_displaced_threshold_ft`],
    `${prefix}_displaced_threshold_ft`,
  )
  // Pist yönü: iki uç koordinatı varsa onlardan (ölçülmüş koordinatlar heading alanından daha
  // güvenilir; ör. LTFM'de heading alanı 5° sapıyor, D-066); yoksa kayıttaki heading alanı.
  const coordinateBearing = point && opposite ? initialBearing(point, opposite) : null
  const trueBearingDeg = coordinateBearing ?? headingDegT
  const bearingSource: BearingSource | null =
    coordinateBearing !== null ? 'coordinates' : headingDegT !== null ? 'heading_field' : null
  const headingMismatch =
    coordinateBearing !== null &&
    headingDegT !== null &&
    bearingDifference(coordinateBearing, headingDegT) > HEADING_MISMATCH_DEG
  const displaced = (displacedThresholdFt ?? 0) > 0
  const threshold = runwayThreshold(
    point,
    trueBearingDeg,
    endsAreThresholds ? null : displacedThresholdFt,
    arp,
  )
  // Koordinat zaten eşikse nokta olduğu gibi alınır ama kaynağı yine kaydırılmış eşiktir.
  const thresholdSource: ThresholdSource =
    endsAreThresholds && displaced && point ? 'displaced_threshold' : threshold.source
  return {
    ident,
    latitudeDeg,
    longitudeDeg,
    elevationFt: number(values[`${prefix}_elevation_ft`], `${prefix}_elevation_ft`),
    headingDegT,
    displacedThresholdFt,
    trueBearingDeg,
    bearingSource,
    headingMismatch,
    thresholdLat: threshold.point.lat,
    thresholdLon: threshold.point.lon,
    thresholdSource,
  }
}

/**
 * Pistler; `airports` içe aktarılan havalimanlarının merkezlerini verir (uç koordinatı yoksa eşik
 * ARP'a düşer). Bu kümede olmayan havalimanlarının pistleri ve kapalı pistler (`closed = 1`)
 * filtre dışıdır (data-sources.md §3).
 */
export function parseRunways(
  csv: string,
  airports: ReadonlyMap<number, LatLon>,
): ParseResult<RunwayRow> {
  const rows: RunwayRow[] = []
  const skipped: SkippedRow[] = []
  let ignored = 0
  for (const { line, values } of iterateCsvRecords(csv)) {
    if (!values) {
      skipped.push({ line, reason: 'sütun sayısı tutmuyor' })
      continue
    }
    try {
      const airportId = number(values.airport_ref, 'airport_ref')
      const arp = airportId === null ? undefined : airports.get(airportId)
      if (airportId === null || !arp || text(values.closed) === '1') {
        ignored += 1
        continue
      }
      const id = number(values.id, 'id')
      if (id === null || !Number.isInteger(id)) throw new RowError('id geçersiz')
      const lePoint = coordinate(
        number(values.le_latitude_deg, 'le_latitude_deg'),
        number(values.le_longitude_deg, 'le_longitude_deg'),
        'le ucu',
      )
      const hePoint = coordinate(
        number(values.he_latitude_deg, 'he_latitude_deg'),
        number(values.he_longitude_deg, 'he_longitude_deg'),
        'he ucu',
      )
      const lengthFt = number(values.length_ft, 'length_ft')
      // Uçlar kayıtlı uzunluğa göre çok uzaksa (D-101) ikisi de kullanılmaz: yön heading alanından,
      // eşikler ARP'tan.
      const endsUsable = !(lePoint && hePoint && endsAreTooFarApart(lePoint, hePoint, lengthFt))
      const separated =
        endsUsable && lePoint && hePoint ? endsAreSeparated(lePoint, hePoint, lengthFt) : false
      const displacedFt =
        (number(values.le_displaced_threshold_ft, 'le_displaced_threshold_ft') ?? 0) +
        (number(values.he_displaced_threshold_ft, 'he_displaced_threshold_ft') ?? 0)
      const endsAreThresholds =
        endsUsable && endsLookLikeThresholds(lePoint, hePoint, lengthFt, displacedFt)
      const base = {
        id,
        airportId,
        airportIdent: requiredText(values.airport_ident, 'airport_ident'),
        lengthFt,
        widthFt: number(values.width_ft, 'width_ft'),
        surface: text(values.surface),
        lighted: text(values.lighted) === '1',
        endsAreThresholds,
        le: runwayEnd(values, 'le', separated ? hePoint : null, arp, endsAreThresholds, endsUsable),
        he: runwayEnd(values, 'he', separated ? lePoint : null, arp, endsAreThresholds, endsUsable),
      }
      rows.push({ ...base, rowHash: rowHash(base) })
    } catch (error) {
      if (!(error instanceof RowError)) throw error
      skipped.push({ line, reason: error.message })
    }
  }
  return { rows, skipped, ignored }
}
