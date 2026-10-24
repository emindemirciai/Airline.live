/**
 * API yanıtlarının ve WebSocket mesajlarının tarayıcıdaki savunmacı denetimi. Sunucu bizimdir,
 * ama sürüm geçişinde (eski sekme, yeni API) ya da bozuk bir ara katmanda beklenmeyen biçim
 * haritayı çökertmemeli: hatalı kayıt atlanır, hatalı mesaj yok sayılır.
 */
import type {
  Airport,
  CoverageState,
  LiveProviderId,
  LiveServerMessage,
  LiveStatus,
  ProviderState,
  PublicAircraft,
  SearchKind,
} from '@havayolu/shared'

type Json = Record<string, unknown>

export const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isNumberOrNull = (value: unknown) => value === null || isFiniteNumber(value)
const isStringOrNull = (value: unknown) => value === null || typeof value === 'string'

const COVERAGE: readonly CoverageState[] = ['full', 'partial', 'none', 'unknown']
const PROVIDER_STATES: readonly string[] = [
  'ok',
  'limited',
  'degraded',
  'down',
] satisfies ProviderState[]
const PROVIDERS: readonly string[] = ['adsbLol', 'localReceiver'] satisfies LiveProviderId[]
const SEARCH_KINDS: readonly SearchKind[] = ['hex', 'registration', 'flight', 'callsign', 'none']
const AIRPORT_TYPES: readonly Airport['type'][] = [
  'large_airport',
  'medium_airport',
  'small_airport',
]

export function isCoverageState(value: unknown): value is CoverageState {
  return typeof value === 'string' && (COVERAGE as readonly string[]).includes(value)
}

export function isSearchKind(value: unknown): value is SearchKind {
  return typeof value === 'string' && (SEARCH_KINDS as readonly string[]).includes(value)
}

export function isLiveStatus(value: unknown): value is LiveStatus {
  if (!isObject(value) || !isObject(value.providers)) return false
  for (const [id, state] of Object.entries(value.providers)) {
    if (!PROVIDERS.includes(id) || typeof state !== 'string' || !PROVIDER_STATES.includes(state)) {
      return false
    }
  }
  // `layer` (D-115): yoksa (eski API) açık sayılır; başka değer bozuk mesajdır.
  const layerOk = value.layer === undefined || value.layer === 'on' || value.layer === 'off'
  // `maxAgeS` (D-122): yoksa (eski API) varsayılan pencere; varsa sıfırdan büyük sonlu sayı.
  const maxAgeOk =
    value.maxAgeS === undefined || (isFiniteNumber(value.maxAgeS) && value.maxAgeS > 0)
  return (
    layerOk && maxAgeOk && isNumberOrNull(value.primaryAgeS) && isNumberOrNull(value.newestAgeS)
  )
}

/** `PublicAircraft` alanlarının hepsi tipine uygun mu (enlem ve boylam aralıkta)? */
export function isPublicAircraft(value: unknown): value is PublicAircraft {
  if (!isObject(value)) return false
  const { fn } = value
  return (
    typeof value.hex === 'string' &&
    value.hex.length > 0 &&
    isFiniteNumber(value.lat) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    isFiniteNumber(value.lon) &&
    value.lon >= -180 &&
    value.lon <= 180 &&
    isNumberOrNull(value.alt) &&
    typeof value.gnd === 'boolean' &&
    isNumberOrNull(value.gs) &&
    isNumberOrNull(value.trk) &&
    isNumberOrNull(value.vr) &&
    isStringOrNull(value.cs) &&
    (fn === null ||
      (isObject(fn) && typeof fn.airline === 'string' && typeof fn.number === 'string')) &&
    isStringOrNull(value.reg) &&
    isStringOrNull(value.type) &&
    isStringOrNull(value.cat) &&
    isStringOrNull(value.sq) &&
    (value.src === 'adsbLol' || value.src === 'localReceiver') &&
    typeof value.psrc === 'string' &&
    isFiniteNumber(value.t)
  )
}

export function isAirport(value: unknown): value is Airport {
  return (
    isObject(value) &&
    typeof value.icao === 'string' &&
    typeof value.iata === 'string' &&
    value.iata.length > 0 &&
    typeof value.name === 'string' &&
    isStringOrNull(value.city) &&
    isFiniteNumber(value.lat) &&
    isFiniteNumber(value.lon) &&
    isNumberOrNull(value.elevationFt) &&
    typeof value.type === 'string' &&
    (AIRPORT_TYPES as readonly string[]).includes(value.type) &&
    typeof value.scheduled === 'boolean'
  )
}

/** Dizi değilse null; dizideki uygun olmayan kayıtlar atlanır. */
export function validItems<T>(value: unknown, guard: (item: unknown) => item is T): T[] | null {
  return Array.isArray(value) ? value.filter(guard) : null
}

const isSeq = (value: unknown): value is number =>
  isFiniteNumber(value) && Number.isInteger(value) && value >= 0

const isString = (value: unknown): value is string => typeof value === 'string'

/**
 * `/v1/ws` metin çerçevesini çözer (D-074). Tanınmayan tür, bozuk JSON ya da zorunlu alanı eksik
 * mesaj null döner; mesajdaki tek tek hatalı uçak kayıtları atlanır.
 */
export function parseServerMessage(text: unknown): LiveServerMessage | null {
  if (typeof text !== 'string') return null
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  if (!isObject(value)) return null
  switch (value.type) {
    case 'snapshot': {
      const aircraft = validItems(value.aircraft, isPublicAircraft)
      if (!isSeq(value.seq) || !isCoverageState(value.coverage) || !isLiveStatus(value.status)) {
        return null
      }
      if (!aircraft) return null
      return {
        type: 'snapshot',
        seq: value.seq,
        coverage: value.coverage,
        status: value.status,
        aircraft,
      }
    }
    case 'diff': {
      if (!isSeq(value.seq) || !isLiveStatus(value.status) || !Array.isArray(value.cells)) {
        return null
      }
      const cells = []
      for (const cell of value.cells) {
        if (!isObject(cell) || typeof cell.c !== 'string') return null
        const added = validItems(cell.added, isPublicAircraft)
        const updated = validItems(cell.updated, isPublicAircraft)
        const removed = validItems(cell.removed, isString)
        if (!added || !updated || !removed) return null
        cells.push({ c: cell.c, added, updated, removed })
      }
      return { type: 'diff', seq: value.seq, status: value.status, cells }
    }
    case 'reconnect':
      return isFiniteNumber(value.afterMs) && value.afterMs >= 0
        ? { type: 'reconnect', afterMs: value.afterMs }
        : null
    case 'error':
      return typeof value.code === 'string' ? { type: 'error', code: value.code } : null
    default:
      return null
  }
}
