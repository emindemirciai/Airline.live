import type { AirlineCodes } from '@havayolu/db'
import { normalizeFlightNumber } from '@havayolu/i18n'
import type { SearchKind } from '@havayolu/shared'
import type { LiveSource, PublicAircraft } from './types'

export type { SearchKind }

export interface SearchResult {
  kind: SearchKind
  results: PublicAircraft[]
}

/** Bir aramada dönen en fazla uçak. */
export const SEARCH_MAX_RESULTS = 20
/** Çağrı kodu önek aramasının en kısa sorgusu. */
export const SEARCH_PREFIX_MIN = 3

const HEX = /^~?[0-9A-F]{6}$/
/** Türk tescili tiresiz yazılmış olabilir (TCJJA). */
const TURKISH_REGISTRATION = /^TC[A-Z]{3}$/
/** Çağrı kodunun başındaki 3 harfli havayolu kodu ve baştaki sıfırlar (THY0974 → THY974). */
const LEADING_ZEROS = /^([A-Z]{3})0+(?=\d)/

const compact = (value: string) => value.toUpperCase().replace(/[\s-]+/g, '')
const normalizeCallsign = (value: string) => compact(value).replace(LEADING_ZEROS, '$1')

/** Çağrı koduna, sonra hex'e göre kararlı sıra. */
const byCallsign = (a: PublicAircraft, b: PublicAircraft) => {
  const ca = a.cs ?? ''
  const cb = b.cs ?? ''
  if (ca !== cb) return ca < cb ? -1 : 1
  return a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0
}

/**
 * Tam eşleşenler önce, sonra önek eşleşenler; her grup kendi içinde sıralı, toplam en fazla 20.
 */
function collect(
  source: LiveSource,
  exact: (a: PublicAircraft) => boolean,
  prefix: ((a: PublicAircraft) => boolean) | null,
): PublicAircraft[] {
  const exactHits: PublicAircraft[] = []
  const prefixHits: PublicAircraft[] = []
  for (const aircraft of source.all()) {
    if (exact(aircraft)) exactHits.push(aircraft)
    else if (prefix?.(aircraft)) prefixHits.push(aircraft)
  }
  exactHits.sort(byCallsign)
  prefixHits.sort(byCallsign)
  return [...exactHits, ...prefixHits].slice(0, SEARCH_MAX_RESULTS)
}

interface Attempt {
  kind: Exclude<SearchKind, 'none'>
  run: () => PublicAircraft[]
}

/**
 * Canlı önbellekte arama (D-074; harici çağrı yok). Gizli uçaklar (askeri, bayrağı bilinmeyen,
 * engel listesi) kaynakta olmadığı için hiçbir aramada çıkmaz. Sorgu kırpılır ve büyük harfe
 * çevrilir; sırayla denenir, sonuç veren ilk yorum kazanır:
 * 1. hex (`~?` + 6 onaltılık hane): tam eşleşme
 * 2. tescil (tire içeriyor ya da TC + 3 harf): tiresiz tam eşleşme
 * 3. sefer no, 2 karakterli havayolu kodu (TK1985, VF 12): IATA'yı taşıyan her ICAO için aday
 *    çağrı kodu (THY1985); tam eşleşme, sonra önek. Baştaki sıfırlar iki tarafta da yok sayılır.
 * 4. çağrı kodu: tam eşleşme (THY974 ve THY0974 aynı), sonra en az 3 karakterlik önek
 * 5. son çare: tiresiz tescil (DAIZZ → D-AIZZ)
 * Hiçbiri sonuç vermezse ilk yorumun türü boş sonuçla döner; sorgu hiçbir yoruma uymuyorsa `none`.
 */
export function searchLive(q: string, source: LiveSource, codes: AirlineCodes): SearchResult {
  const query = q.trim().toUpperCase()
  const key = compact(query)
  if (key === '') return { kind: 'none', results: [] }

  const registrationAttempt: Attempt = {
    kind: 'registration',
    run: () => collect(source, (a) => a.reg !== null && compact(a.reg) === key, null),
  }
  const attempts: Attempt[] = []

  if (HEX.test(key)) {
    const hex = key.toLowerCase()
    attempts.push({ kind: 'hex', run: () => collect(source, (a) => a.hex === hex, null) })
  }
  const looksLikeRegistration = query.includes('-') || TURKISH_REGISTRATION.test(key)
  if (looksLikeRegistration) attempts.push(registrationAttempt)

  const flight = normalizeFlightNumber(query)
  if (flight !== null && flight.airline.length === 2) {
    const candidates = (codes.iataToIcao.get(flight.airline) ?? []).map(
      (icao) => `${icao}${flight.number}`,
    )
    if (candidates.length > 0) {
      const exact = new Set(candidates)
      attempts.push({
        kind: 'flight',
        run: () =>
          collect(
            source,
            (a) => a.cs !== null && exact.has(normalizeCallsign(a.cs)),
            (a) => {
              if (a.cs === null) return false
              const cs = normalizeCallsign(a.cs)
              return candidates.some((candidate) => cs.startsWith(candidate))
            },
          ),
      })
    }
  }

  const callsign = normalizeCallsign(key)
  const exactCallsigns = new Set([callsign])
  if (flight !== null && flight.airline.length === 3) {
    exactCallsigns.add(`${flight.airline}${flight.number}`)
  }
  if (key.length >= SEARCH_PREFIX_MIN) {
    attempts.push({
      kind: 'callsign',
      run: () =>
        collect(
          source,
          (a) => a.cs !== null && exactCallsigns.has(normalizeCallsign(a.cs)),
          (a) =>
            a.cs !== null &&
            (compact(a.cs).startsWith(key) || normalizeCallsign(a.cs).startsWith(callsign)),
        ),
    })
  }

  if (!looksLikeRegistration && key.length >= 4) attempts.push(registrationAttempt)

  for (const attempt of attempts) {
    const results = attempt.run()
    if (results.length > 0) return { kind: attempt.kind, results }
  }
  return { kind: attempts[0]?.kind ?? 'none', results: [] }
}
