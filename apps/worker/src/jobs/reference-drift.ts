import {
  AIRPORT_NAMES,
  airportTimeZone,
  FOREIGN_AIRPORT_NAMES,
  runwaySurfaceKey,
} from '@havayolu/shared'
import type { Logger } from 'pino'

/**
 * İçe aktarım kayması (D-109): gece içe aktarımından sonra listenin, 2026-10-01 kopyasıyla
 * denetlenen kurallardan sapmalarını sayan tek günlük satırı. 5. halka içe aktarımın canlı veriden
 * kayabileceği alanı 2,67 katına çıkarır; kuralların (saat dilimi, kaplama kodu, ad tablosu) eksik
 * kaldığı yer bu satırda görünür, kullanıcıya dönük bir şey değişmez (dilimsiz havalimanı UTC'yle,
 * tanınmayan kaplama "bilinmiyor"la, adsız havalimanı OurAirports adıyla gösterilir). Tek istisna:
 * çok dilimli bir ülkede yeni listelenen havalimanı bölge varsayılanıyla yanlış dilim alabilir;
 * `withoutTimeZone` onu saymaz, tek işareti `withoutCuratedName`'dir (RUNBOOK "İçe aktarım kayması").
 */

/** Örnek listelerinin en çok uzunluğu (günlük satırı kısa kalır). */
export const DRIFT_EXAMPLES = 10

/** Kayma ölçümünün okuduğu havalimanı alanları (`@havayolu/db` `AirportDetailRecord`). */
export interface DriftAirport {
  icao: string
  iata: string
  country: string
  isoRegion: string
  runways: readonly { surface: string | null }[]
}

export interface DriftInput {
  airports: readonly DriftAirport[]
  /** Aday satırlardaki kanonik ICAO çakışmaları (`@havayolu/db` `canonicalIcaoCollisions`). */
  icaoCollisions: readonly string[]
}

/** Bir sayım ve en çok `DRIFT_EXAMPLES` örneği. */
export interface DriftCount {
  count: number
  examples: string[]
}

/** Günlük satırının yedi sayımı. */
export interface ReferenceDrift {
  /** Listelenen havalimanları (açık halkalar, `ENABLED_AIRPORT_RING`). */
  listed: number
  /** Saat dilimi kuralı olmayan listelenen havalimanları (`airportTimeZone` null; sayfada UTC). */
  withoutTimeZone: DriftCount
  /** Görünen pistlerde tanınmayan dolu kaplama kodları (ayrı kod sayısı; UNK hariç). */
  unknownSurfaces: DriftCount
  /** Birden çok listelenen havalimanında geçen IATA kodları (`/istasyon/<IATA>` yönlendirmesi). */
  duplicateIata: DriftCount
  /** Küratörlü adı olmayan listelenen havalimanları (`AIRPORT_NAMES`, `FOREIGN_AIRPORT_NAMES`). */
  withoutCuratedName: DriftCount
  /** Ad tablosunda olup listelenmeyen havalimanları. */
  curatedNotListed: DriftCount
  /** Kanonik ICAO çakışmaları (aynı ICAO'yu taşıyan ikinci ve sonraki aday satırlar). */
  icaoCollisions: DriftCount
}

const count = (values: Iterable<string>): DriftCount => {
  const all = [...new Set(values)].sort()
  return { count: all.length, examples: all.slice(0, DRIFT_EXAMPLES) }
}

/** Küratörlü adı olan ICAO'lar: Türkiye (`AIRPORT_NAMES`) ve yurt dışı (`FOREIGN_AIRPORT_NAMES`). */
export const curatedIcaos = (): ReadonlySet<string> =>
  new Set([...Object.keys(AIRPORT_NAMES), ...Object.keys(FOREIGN_AIRPORT_NAMES)])

/** Kayma sayımları (saf; worker içe aktarımdan sonra veritabanının listesiyle çağırır). */
export function referenceDrift(
  input: DriftInput,
  curated: ReadonlySet<string> = curatedIcaos(),
): ReferenceDrift {
  const listed = new Set(input.airports.map((airport) => airport.icao))
  const iataSeen = new Set<string>()
  const iataTwice: string[] = []
  const unknownSurfaces: string[] = []
  const withoutTimeZone: string[] = []
  const withoutCuratedName: string[] = []
  for (const airport of input.airports) {
    if (iataSeen.has(airport.iata)) iataTwice.push(airport.iata)
    else iataSeen.add(airport.iata)
    if (airportTimeZone(airport) === null) withoutTimeZone.push(airport.icao)
    if (!curated.has(airport.icao)) withoutCuratedName.push(airport.icao)
    for (const runway of airport.runways) {
      const code = runway.surface?.trim() ?? ''
      if (code === '' || code.toUpperCase() === 'UNK') continue
      if (runwaySurfaceKey(code) === 'unknown') unknownSurfaces.push(code)
    }
  }
  return {
    listed: listed.size,
    withoutTimeZone: count(withoutTimeZone),
    unknownSurfaces: count(unknownSurfaces),
    duplicateIata: count(iataTwice),
    withoutCuratedName: count(withoutCuratedName),
    curatedNotListed: count([...curated].filter((icao) => !listed.has(icao))),
    icaoCollisions: count(input.icaoCollisions),
  }
}

/** Sapma var mı (listelenen sayısı dışındaki sayımlardan biri sıfır değil). */
export const hasDrift = (drift: ReferenceDrift): boolean =>
  drift.withoutTimeZone.count +
    drift.unknownSurfaces.count +
    drift.duplicateIata.count +
    drift.withoutCuratedName.count +
    drift.curatedNotListed.count +
    drift.icaoCollisions.count >
  0

/** Tek günlük satırı: sapma yoksa info, varsa warn (RUNBOOK "İçe aktarım kayması"). */
export function logReferenceDrift(log: Pick<Logger, 'info' | 'warn'>, drift: ReferenceDrift): void {
  const line = { drift }
  if (hasDrift(drift)) log.warn(line, 'referans verisi kayması')
  else log.info(line, 'referans verisi kayması')
}
