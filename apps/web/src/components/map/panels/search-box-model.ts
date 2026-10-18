import { format, formatDistance, type Messages } from '@havayolu/i18n'
import {
  airportRingLimitKm,
  ENABLED_AIRPORT_RING,
  mapShownAirports,
  type AirportSearchMatch,
  type Locale,
  type PublicAircraft,
  type SearchKind,
} from '@havayolu/shared'
// Göreli yollar: vitest `@/` takma adını çözmez (panel testleri bu dosyayı yükler).
import { findAirportByCode } from '../../../lib/map/url-state'
import type { MapAirport } from '../airport-data'

/**
 * Arama kutusunun saf mantığı (D-108): türler, gönderimin sonucu, durum metni, klavyeyle gezinme.
 * Haritanın ilk paketindedir; ad tablolarının yardımcılarını (görünen ad, yer, il, ülke) ve arama
 * motorunu (`@havayolu/shared` `airport-search.ts`) kullanmaz. Havalimanı adlarıyla arama ayrı
 * parçadadır (`airport-search-index.ts`, D-101); parça yüklenemezse burada yalnız kodla arama
 * (`codeOnlyAirportSearch`) vardır.
 */

/** Listede bir havalimanı satırı: kod, ad ve yer sayfanın dilinde, bir kez hesaplanır. */
export interface AirportSearchRow {
  airport: MapAirport
  /** IATA kodu; yoksa ICAO. */
  code: string
  /** Görünen ad; yalnız kodla aramada boş. */
  name: string
  /** Türkiye'de il (yoksa yerleşim), yurt dışında "şehir, ülke"; bilinmiyorsa ya da yalnız kodla aramada boş. */
  place: string
  match: AirportSearchMatch
}

/**
 * Bir havalimanı araması: en fazla 8 satır, bütün eşleşmelerin sayısı, aranan sorgunun harf sayısı,
 * adların yüklenip yüklenmediği.
 */
export interface AirportSearchResult {
  rows: readonly AirportSearchRow[]
  total: number
  /**
   * Motorun aradığı sorgudaki harf sayısı (`@havayolu/shared` `searchAirportIndex`): dolgu sözcükleri
   * ve yedekte atılan yarım dolgu sözcüğü sayılmaz ("THY airport" ve "THY h" 3, "esenboğa hav" 8).
   * Enter kuralı bununla sayar (`AIRPORT_OPEN_MIN_LETTERS`); ilk paket motoru içe aktarmadığı için
   * sonuçla gelir.
   */
  queryLetters: number
  /** Ad parçası yüklenemedi: yalnız tam kodla arandı (`codeOnlyAirportSearch`). */
  degraded: boolean
  /**
   * İlk satır yurt dışındaki bir havalimanının tam koduyken sorgu Türkiye'deki bir havalimanının da
   * adına ya da yerine uyuyor mu (başlangıç ya da sözcük basamağında; listedeki 8 satırla sınırlı
   * değil, bütün eşleşmelerde): "den" Denver'ın (DEN) kodu ve Denizli'nin başı. Enter o zaman
   * havalimanını açmaz, listeyi gösterir (`submitOutcome`, D-118). Öbür durumlarda ve yalnız kodla
   * aramada false.
   */
  turkeyNameMatch: boolean
}

/** Haritanın havalimanları üzerinde kurulmuş arama. */
export type AirportSearch = (query: string) => AirportSearchResult

/**
 * Aramayı kurar (havalimanı listesi ve sayfanın dili). `prepare` varsa kurulum boşta dilimlerle
 * yapılabilir (M6j.3, D-108; `prebuildAirportSearch`): her çağrı `timeRemaining()` (ms) bitene kadar
 * ilerler, kurulum bitince true döner; sonraki `builder(...)` çağrısı kurulan aramayı verir. Kodla
 * arama yedeğinde (`codeOnlyAirportSearch`) yoktur: kurulum tek adımdır.
 */
export interface AirportSearchBuilder {
  (airports: readonly MapAirport[], locale: Locale): AirportSearch
  prepare?: (
    airports: readonly MapAirport[],
    locale: Locale,
    timeRemaining: () => number,
  ) => boolean
}

export const NO_AIRPORT_RESULTS: AirportSearchResult = {
  rows: [],
  total: 0,
  queryLetters: 0,
  degraded: false,
  turkeyNameMatch: false,
}

/**
 * Sorgunun havalimanı kodu biçimi: kırpılır, Türkçe İ/ı karşılığına döner, büyük harf, boşluksuz.
 * Motorun tam kod kuralıyla aynıdır (`airport-search.ts` `codeKey`).
 */
function airportCodeKey(query: string): string {
  return query.trim().replace(/İ/g, 'I').replace(/ı/g, 'i').toUpperCase().replace(/\s+/g, '')
}

/**
 * Ad parçası yüklenemezse (`withImportFallback`) kullanılan arama: yalnız tam IATA ya da ICAO kodu
 * ("ist", "LTFM") ya da adres takma adı (D-109, "UTSS"; motor gibi ICAO ve IATA önce). Askerî hava
 * üsleri aranmaz (`mapShownAirports`). Satırda ad ve yer yoktur; sonuç `degraded` işaretlidir (durum
 * satırı adların yüklenemediğini söyler). Yalnız tam kod döndüğü için harf sayısı sorgunun
 * kendisinindir (tam kod Enter'da harf sayısına bakılmadan açılır).
 */
export const codeOnlyAirportSearch: AirportSearchBuilder = (airports) => {
  const shown = mapShownAirports(airports)
  const byCode = (key: string): MapAirport | undefined =>
    findAirportByCode(shown, key) ?? shown.find((a) => a.identAlias === key)
  return (query) => {
    const key = airportCodeKey(query)
    const queryLetters = letterCount(key)
    const airport = key.length >= 3 && key.length <= 4 ? byCode(key) : undefined
    if (airport === undefined) {
      return { rows: [], total: 0, queryLetters, degraded: true, turkeyNameMatch: false }
    }
    const row: AirportSearchRow = {
      airport,
      code: airport.iata || airport.icao,
      name: '',
      place: '',
      match: 'code',
    }
    return { rows: [row], total: 1, queryLetters, degraded: true, turkeyNameMatch: false }
  }
}

const DIGIT = /\p{N}/u
const HEX_QUERY = /^~?[0-9a-f]{6}$/i
const LETTER = /\p{L}/gu

/** Sorguda rakam var mı (rakamlı sorgu havalimanı adı aramaz; motorun `code` türü). */
export function hasDigit(query: string): boolean {
  return DIGIT.test(query)
}

/**
 * Sorgudaki harf sayısı; rakam, boşluk ve noktalama sayılmaz ("esenboğa" 8, "İst" 3). Katlanmış
 * sorgunun sayısıdır: katlama aksanı ve büyük harfi kaldırır, harf atmaz. Dolgu sözcüklerini bilmez:
 * Enter kuralı motorun saydığını kullanır (`AirportSearchResult.queryLetters`).
 */
function letterCount(query: string): number {
  return query.match(LETTER)?.length ?? 0
}

/**
 * Enter'da tam kod olmayan tek havalimanı eşleşmesinin doğrudan açılması için aranan sorgudaki en az
 * harf (`AirportSearchResult.queryLetters`, D-108). 3 harf havayolu kodu da olabilir ("THY" Sfaks
 * Thyna'nın sözcük başıdır) ya da yazarken yarım kalmış bir adın başıdır ("gok"); ikisinde de liste
 * gösterilir, kullanıcı seçer. Dolgu sözcükleri sayılmaz: "THY airport", "THY h" de 3 harftir.
 */
const AIRPORT_OPEN_MIN_LETTERS = 4

/**
 * Havalimanı adı aranabilecek metin mi: rakam yok, hex değil, en az iki harf. Motorun
 * `airportQueryKind` → `text` kuralının ilk paketteki karşılığıdır (dolgu sözcüklerini bilmez);
 * yalnız ad parçası yüklenemediğinde durum metnini seçmek için kullanılır.
 */
export function isTextQuery(query: string): boolean {
  if (hasDigit(query) || HEX_QUERY.test(query.trim())) return false
  return letterCount(query) >= 2
}

/** API'nin kabul ettiği karakterler: İngilizce harf, rakam, boşluk, tire ve `~`. */
const AIRCRAFT_QUERY = /^[~A-Za-z0-9 -]+$/

/**
 * `/v1/search`'e gidecek uçak sorgusu: kırpılır, tire çeşitleri (U+2010–U+2015) "-" olur, Türkçe
 * klavyenin İ/ı harfleri I/i olur ("TC-JİA" → "TC-JIA"). Başka bir karakter kalırsa (ğ, ş, ç, ö,
 * ü, nokta…) uçak araması yapılmaz (null): sorgu çağrı kodu, sefer no, tescil ya da hex olamaz.
 */
export function aircraftQuery(query: string): string | null {
  const value = query.trim().replace(/[‐-―]/g, '-').replace(/İ/g, 'I').replace(/ı/g, 'i')
  return AIRCRAFT_QUERY.test(value) ? value : null
}

/**
 * Klavyeyle etkin seçeneğin yeni sırası: -1 hiçbiri. Hiçbiri etkin değilken aşağı ilkini, yukarı
 * sonuncuyu seçer; iki uçta başa ya da sona sarar. Seçenek yoksa -1.
 */
export function moveActive(index: number, count: number, step: 1 | -1): number {
  if (count <= 0) return -1
  if (index < 0 || index >= count) return step === 1 ? 0 : count - 1
  return (index + step + count) % count
}

/** Sonuç listesinin bir seçeneği: kimliği listenin kimliğinden türer (`aria-activedescendant`). */
export type SearchOption =
  | { kind: 'airport'; id: string; row: AirportSearchRow }
  | { kind: 'aircraft'; id: string; aircraft: PublicAircraft }

/**
 * Listenin seçenekleri, gösterildikleri sırayla: önce havalimanları, sonra uçaklar (D-108).
 * Kimlikler: `<liste>-a-<ICAO>` ve `<liste>-p-<hex>`.
 */
export function searchOptions(
  listId: string,
  airports: readonly AirportSearchRow[],
  aircraft: readonly PublicAircraft[],
): SearchOption[] {
  return [
    ...airports.map((row): SearchOption => ({
      kind: 'airport',
      id: `${listId}-a-${row.airport.icao}`,
      row,
    })),
    ...aircraft.map((ac): SearchOption => ({
      kind: 'aircraft',
      id: `${listId}-p-${ac.hex}`,
      aircraft: ac,
    })),
  ]
}

/** Listede en fazla gösterilen uçak (API'nin sınırı, `SEARCH_MAX_RESULTS`). */
export const AIRCRAFT_RESULTS_LIMIT = 20

/** Uçak aramasının sonucu: yanıt, atlandı (sorgu uçak olamaz) ya da hata. */
export type AircraftLookup =
  | { status: 'ok'; kind: SearchKind; results: readonly PublicAircraft[] }
  | { status: 'skipped' }
  | { status: 'failed'; rateLimited: boolean }

/** "Bulunamadı" metninin parçaları, sırasıyla (`map.search` anahtarları). */
export type NotFoundPart =
  | 'notFound'
  | 'flightNumberNote'
  | 'airportNotFound'
  | 'airportNote'
  | 'airportNamesUnavailable'
  | 'airportCoverage'

/**
 * Aranan yurt dışı havalimanlarının Türkiye'ye en büyük uzaklığı, km: açık son halkanın sınırı
 * (`ENABLED_AIRPORT_RING`, D-080); bütün halkalar açıksa null (kapsama cümlesi yazılmaz).
 */
const AIRPORT_COVERAGE_KM = airportRingLimitKm(ENABLED_AIRPORT_RING)

/** Havalimanı bulunamadı metnine kapsama cümlesi eklenir (yalnız açık halkalar aranır). */
function withCoverage(parts: NotFoundPart[]): NotFoundPart[] {
  return AIRPORT_COVERAGE_KM === null ? parts : [...parts, 'airportCoverage']
}

/** Uçak araması yapılamadı (sonuç listesinde yalnız havalimanları varken). */
export interface AircraftFailure {
  rateLimited: boolean
}

/** Arama kutusunun durumu (yazarken öneri listesi `idle`'dadır). */
export type SearchState =
  | { phase: 'idle' }
  | { phase: 'searching' }
  | { phase: 'notFound'; parts: readonly NotFoundPart[] }
  | {
      phase: 'pick'
      airports: readonly AirportSearchRow[]
      /** Bütün havalimanı eşleşmeleri (listedekiler en fazla 8). */
      airportTotal: number
      aircraft: readonly PublicAircraft[]
      aircraftFailure: AircraftFailure | null
    }
  | { phase: 'failed'; rateLimited: boolean }

/** Durum satırının girdisi: aramanın durumu ya da yazarken öneri sayısı. */
export type SearchStatus =
  | SearchState
  | {
      phase: 'typing'
      /** Listedeki öneriler. */
      shown: number
      total: number
      /** Ad parçası yüklenemedi ve sorgu bir ad olabilir. */
      namesUnavailable: boolean
    }

/** Yazarken durum satırı: öneri sayısı ya da adların yüklenemediği. */
export function typingStatus(result: AirportSearchResult, query: string): SearchStatus {
  return {
    phase: 'typing',
    shown: result.rows.length,
    total: result.total,
    namesUnavailable: result.degraded && isTextQuery(query),
  }
}

/** Gönderimin (Enter, "Ara") girdisi. */
export interface SubmitInput {
  /** Kırpılmış sorgu. */
  query: string
  aircraft: AircraftLookup
  airports: AirportSearchResult
  /** Haritanın havalimanı listesi yüklendi (boş değil). */
  airportsLoaded: boolean
}

/** Gönderimin sonucu. */
export type SubmitOutcome =
  | { type: 'aircraft'; aircraft: PublicAircraft }
  | { type: 'airport'; airport: MapAirport }
  | {
      type: 'list'
      airports: readonly AirportSearchRow[]
      airportTotal: number
      aircraft: readonly PublicAircraft[]
      aircraftFailure: AircraftFailure | null
    }
  | { type: 'notFound'; parts: readonly NotFoundPart[] }
  | { type: 'failed'; rateLimited: boolean }

/**
 * Gönderimin kuralları, sırayla (D-108):
 * 1. Tek uçak bulundu ve hiçbir havalimanı eşleşmedi → uçak seçilir.
 * 2. Uçak yok (ya da sorgu uçak olamaz) ve ilki tam kod (IATA ya da ICAO) ya da tek havalimanı, ülke
 *    basamağında değil ve aranan sorguda en az 4 harf (`queryLetters`, `AIRPORT_OPEN_MIN_LETTERS`;
 *    dolgu sözcükleri sayılmaz) → havalimanı açılır. "THY", "THY airport" ve "THY h" Sfaks Thyna'yı,
 *    "gok" Sabiha Gökçen'i açmaz: 5. kurala gider (tek satırlık liste). Ülke adıyla tek eşleşme de
 *    açılmaz: "turkish" ("Turkish Airlines" yazılırken) Ercan'ı (KKTC'nin İngilizce uzun adı)
 *    yalnız tek satırlık listede gösterir. Yurt dışındaki bir havalimanının tam kodu, sorgu
 *    Türkiye'deki bir havalimanının adına ya da yerine de uyuyorsa açılmaz (`turkeyNameMatch`,
 *    D-118): "den" Denver'ı, "sin" Singapur'u, "sab" Saba'yı açmaz, liste gösterilir (önce kodun
 *    havalimanı, sonra Denizli, Sinop, Sabiha Gökçen). "IST", "ESB", "JFK", "AJA" açılır.
 * 3. Uçak yok ve havalimanı yok → bulunamadı (uçak araması atlandıysa havalimanı metni; değilse
 *    uçak metni, sefer no notu ve rakamsız sorguda havalimanı ipucu; havalimanı metnine ve ipucuna
 *    kapsama cümlesi eklenir). Uçak araması atlandı ve havalimanı listesi yüklenmedi → hata (hiçbir
 *    şey aranmadı, "bulunamadı" denmez).
 * 4. Uçak araması hata verdi, havalimanı var → yalnız havalimanları listede; 4b. havalimanı da yok
 *    → hata.
 * 5. Öbür durumlar → tek liste: önce havalimanları (en fazla 8), sonra uçaklar (en fazla 20).
 */
export function submitOutcome({
  query,
  aircraft,
  airports,
  airportsLoaded,
}: SubmitInput): SubmitOutcome {
  const [firstAirport] = airports.rows
  if (aircraft.status === 'ok' && aircraft.results.length === 1 && firstAirport === undefined) {
    const [only] = aircraft.results
    if (only) return { type: 'aircraft', aircraft: only }
  }
  const noAircraft =
    aircraft.status === 'skipped' || (aircraft.status === 'ok' && aircraft.results.length === 0)
  const opensAirport =
    (firstAirport?.match === 'code' && !airports.turkeyNameMatch) ||
    (airports.total === 1 &&
      firstAirport?.match !== 'country' &&
      airports.queryLetters >= AIRPORT_OPEN_MIN_LETTERS)
  if (noAircraft && firstAirport && opensAirport) {
    return { type: 'airport', airport: firstAirport.airport }
  }
  if (noAircraft && airports.rows.length === 0) {
    const digit = hasDigit(query)
    const namesUnavailable = airports.degraded && !digit
    if (aircraft.status === 'skipped') {
      // Havalimanı listesi yüklenmedi ve sorgu uçak olamaz: hiçbir şey aranmadı.
      if (!airportsLoaded) return { type: 'failed', rateLimited: false }
      return {
        type: 'notFound',
        parts: namesUnavailable ? ['airportNamesUnavailable'] : withCoverage(['airportNotFound']),
      }
    }
    const parts: NotFoundPart[] = ['notFound']
    if (aircraft.status === 'ok' && aircraft.kind === 'flight') parts.push('flightNumberNote')
    if (!digit && airportsLoaded) {
      return {
        type: 'notFound',
        parts: namesUnavailable
          ? [...parts, 'airportNamesUnavailable']
          : withCoverage([...parts, 'airportNote']),
      }
    }
    return { type: 'notFound', parts }
  }
  if (aircraft.status === 'failed') {
    if (airports.rows.length === 0) return { type: 'failed', rateLimited: aircraft.rateLimited }
    return {
      type: 'list',
      airports: airports.rows,
      airportTotal: airports.total,
      aircraft: [],
      aircraftFailure: { rateLimited: aircraft.rateLimited },
    }
  }
  return {
    type: 'list',
    airports: airports.rows,
    airportTotal: airports.total,
    aircraft: aircraft.status === 'ok' ? aircraft.results.slice(0, AIRCRAFT_RESULTS_LIMIT) : [],
    aircraftFailure: null,
  }
}

type SearchMessages = Messages['map']['search']

/** Havalimanı listesi kesildiyse sayı ve "aramayı daralt"; değilse boş. */
function countMore(shown: number, total: number, messages: SearchMessages): string {
  return total > shown ? format(messages.airportCountMore, { n: total, shown }) : ''
}

const joined = (...parts: string[]) => parts.filter((part) => part !== '').join(' ')

/**
 * Durum satırının metni (ekran okuyucuya `aria-live="polite"` ile okunur):
 * - yazarken öneri sayısı ("Eşleşen havalimanı: 3."; liste kesildiyse ilk kaçının listede olduğu),
 *   öneri yoksa boş; ad parçası yüklenemediyse ve sorgu bir ad olabilirse bunu söyler;
 * - aranıyor, bulunamadı (parçalar sırayla; kapsama cümlesi açık halkanın sınırıyla, sayfanın dilinde),
 *   hata;
 * - sonuç listesi: yalnız uçak, yalnız havalimanı (tek havalimanında "açmak için seç") ya da ikisi;
 *   uçak araması yapılamadıysa onu söyler; havalimanı listesi kesildiyse sayı eklenir.
 */
export function searchStatusText(
  status: SearchStatus,
  messages: SearchMessages,
  locale: Locale,
): string {
  switch (status.phase) {
    case 'idle':
      return ''
    case 'typing':
      if (status.namesUnavailable) return messages.airportNamesUnavailable
      if (status.shown === 0) return ''
      return status.total > status.shown
        ? format(messages.airportCountMore, { n: status.total, shown: status.shown })
        : format(messages.airportCount, { n: status.total })
    case 'searching':
      return messages.searching
    case 'notFound':
      return joined(
        ...status.parts.map((part) =>
          part === 'airportCoverage'
            ? AIRPORT_COVERAGE_KM === null
              ? ''
              : format(messages.airportCoverage, {
                  km: formatDistance(AIRPORT_COVERAGE_KM, { locale }),
                })
            : messages[part],
        ),
      )
    case 'pick': {
      const more = countMore(status.airports.length, status.airportTotal, messages)
      if (status.aircraftFailure !== null) {
        const failure = status.aircraftFailure.rateLimited
          ? messages.rateLimited
          : messages.aircraftUnavailable
        return joined(failure, more)
      }
      if (status.airports.length === 0) return messages.pick
      if (status.aircraft.length > 0) return joined(messages.pickMixed, more)
      return status.airportTotal === 1 ? messages.pickAirport : joined(messages.pickAirports, more)
    }
    case 'failed':
      return status.rateLimited ? messages.rateLimited : messages.error
  }
}
