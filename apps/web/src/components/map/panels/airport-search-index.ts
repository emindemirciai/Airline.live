import {
  AIRPORT_COUNTRY_OVERRIDES,
  airportCountryName,
  airportDisplayName,
  airportDistrict,
  airportLocality,
  airportOfficialName,
  airportSearchPlaces,
  AIRPORT_SEARCH_MIN_SLICE_ENTRIES,
  airportSearchIndexBuilder,
  countrySearchAliases,
  mapShownAirports,
  provinceName,
  searchAirportIndex,
  type AirportSearchEntry,
  type AirportSearchIndex,
  type AirportSearchIndexBuilder,
  type Locale,
} from '@havayolu/shared'
import type { MapAirport } from '../airport-data'
import { PRIMARY_AIRPORT_VIEW } from '../camera'
import type { AirportSearch, AirportSearchRow } from './search-box-model'

/**
 * Havalimanı aramasının dizini (D-108): canlı haritanın listelenen havalimanları, adları, yerleri ve
 * ülkeleriyle. Ad tablolarını (`airportDisplayName`, `airportLocality`, …) kullanır; bu yüzden
 * haritanın ilk paketinde değil, ayrı parçadadır (D-101): arama kutusu odaklanınca ya da üstüne
 * gelinince ve harita hazır olunca boşta yüklenir (`search-box.tsx` → `loadAirportSearch`).
 *
 * - **Alanlar**, sayfanın dili ne olursa olsun iki dilde: görünen ad (TR ve EN), resmî Türkçe ad,
 *   OurAirports adı; yerleşim (TR ve EN), Türkiye'de il (TR ve EN), OurAirports yerleşimi ve şehri;
 *   ülke (kısa ve uzun, TR ve EN; Ercan için KKTC / TRNC). "Atina" İngilizce sayfada da, "Athens"
 *   Türkçe sayfada da bulunur. Yalnız aranan, gösterilmeyen ek adlar (`AIRPORT_SEARCH_PLACES`:
 *   "Adana" → Çukurova, "Antep", "Urfa", "Maraş", "Sabiha Gökçen", "Cappadocia"…;
 *   `AIRPORT_SEARCH_COUNTRY_ALIASES`: "Turkey").
 * - **Sıra** (bir eşleşme basamağının içinde): İstanbul Havalimanı (LTFM), Türkiye, tarifeli sefer,
 *   büyüklük (büyük, orta, küçük), Türkiye'ye uzaklık, görünen ad (sayfanın dilinin alfabesiyle),
 *   ICAO.
 * - **Adres takma adı** (`identAlias`, D-109: kodu değişen havalimanının eski kodu, ör. Semerkant'ın
 *   UTSS'si) tam kod olarak bulunur; önek ya da sözcük olarak aranmaz.
 * - **Askerî hava üsleri** aranmaz (`mapShownAirports`; D-103, D-107): liste zaten üssüzdür, süzgeç
 *   savunma amaçlıdır.
 * - Dizin (havalimanı listesi, dil) başına bir kez kurulur ve saklanır; satırın metinleri ilk
 *   gösterildiğinde bir kez hesaplanır.
 * - **Dilimli kurulum** (M6j.3, D-108): harita hazır olunca boşta kurulum `prepareAirportSearch`
 *   ile `requestIdleCallback` dilimlerinde yapılır (sıralama, kayıtlar ve motorun dizini; 5.
 *   halkanın 3.266 havalimanında tek seferde masaüstünde ~55 ms, düşük güçlü telefonda birkaç katı;
 *   8 ms'lik dilimlerle 7 dilim). Yarım kalmış
 *   kurulumu `buildAirportSearch` (kutunun odağı, ilk gönderim) bekletmeden tek seferde bitirir;
 *   sonuç tek seferlik kurulumunkiyle aynıdır.
 */

const INTL_LOCALE: Record<Locale, string> = { tr: 'tr-TR', en: 'en-GB' }
const LOCALES: readonly Locale[] = ['tr', 'en']
const TYPE_ORDER: Record<MapAirport['type'], number> = {
  large_airport: 0,
  medium_airport: 1,
  small_airport: 2,
}
const TURKEY = 'TR'

const cache = new WeakMap<readonly MapAirport[], Map<Locale, AirportSearch>>()
/** Yarım kalmış dilimli kurulumlar (liste ve dil başına). */
const pending = new WeakMap<readonly MapAirport[], Map<Locale, SearchBuild>>()

/** Listedeki havalimanları üzerinde arama (liste ve dil başına bir kez kurulur). */
export function buildAirportSearch(airports: readonly MapAirport[], locale: Locale): AirportSearch {
  const search = advance(airports, locale, () => Number.POSITIVE_INFINITY)
  if (search === null) throw new Error('airport search: one-shot build did not finish')
  return search
}

/**
 * Aramayı dilimle kurar (boşta; `timeRemaining` tarayıcının `IdleDeadline.timeRemaining`'i gibi, ms):
 * kurulum bittiyse (ya da zaten kuruluysa) true. Bitmediyse sonraki çağrı kaldığı yerden sürer.
 */
export function prepareAirportSearch(
  airports: readonly MapAirport[],
  locale: Locale,
  timeRemaining: () => number,
): boolean {
  return advance(airports, locale, timeRemaining) !== null
}

buildAirportSearch.prepare = prepareAirportSearch

function advance(
  airports: readonly MapAirport[],
  locale: Locale,
  timeRemaining: () => number,
): AirportSearch | null {
  let byLocale = cache.get(airports)
  if (byLocale === undefined) {
    byLocale = new Map()
    cache.set(airports, byLocale)
  }
  const ready = byLocale.get(locale)
  if (ready !== undefined) return ready
  let builds = pending.get(airports)
  if (builds === undefined) {
    builds = new Map()
    pending.set(airports, builds)
  }
  let build = builds.get(locale)
  if (build === undefined) {
    build = startSearch(airports, locale)
    builds.set(locale, build)
  }
  const search = build.step(timeRemaining)
  if (search === null) return null
  builds.delete(locale)
  byLocale.set(locale, search)
  return search
}

const nonEmpty = (values: readonly (string | null | undefined)[]): string[] =>
  values.filter((value): value is string => typeof value === 'string' && value.trim() !== '')

/** Dilimli kurulumun adımı: bitince arama, yoksa null. */
interface SearchBuild {
  step(timeRemaining: () => number): AirportSearch | null
}

/**
 * Aramanın dilimli kurulumu, üç evre: (1) sıralama (görünen adlarla; tek dilim), (2) dizinin
 * kayıtları (adlar, yerler, ülkeler; dilimli), (3) motorun dizini (dilimli,
 * `airportSearchIndexBuilder`). Geçici yapılar (sıralamanın görünen adları, ülke adlarının
 * önbelleği) kurulumun içinde kalır: kurulan arama onları tutmaz (3.500 havalimanında bellek).
 */
function startSearch(airports: readonly MapAirport[], locale: Locale): SearchBuild {
  let sorted: readonly MapAirport[] | null = null
  let entryOf: ((a: MapAirport) => AirportSearchEntry<MapAirport>) | null = null
  const entries: AirportSearchEntry<MapAirport>[] = []
  let indexBuilder: AirportSearchIndexBuilder<MapAirport> | null = null
  return {
    step(timeRemaining) {
      if (sorted === null) {
        sorted = sortedAirports(airports, locale)
        entryOf = searchEntry()
      }
      let processed = 0
      while (
        entryOf !== null &&
        entries.length < sorted.length &&
        (processed < AIRPORT_SEARCH_MIN_SLICE_ENTRIES || timeRemaining() > 0)
      ) {
        entries.push(entryOf(sorted[entries.length] as MapAirport))
        processed++
      }
      if (entries.length < sorted.length) return null
      entryOf = null
      indexBuilder ??= airportSearchIndexBuilder(entries)
      const index = indexBuilder.step(timeRemaining)
      return index === null ? null : createSearch(index, locale)
    },
  }
}

/**
 * Havalimanları aramanın sabit sırasıyla: İstanbul Havalimanı, Türkiye, tarifeli sefer, büyüklük,
 * Türkiye'ye uzaklık, görünen ad (sayfanın dilinin alfabesiyle), ICAO. Askerî hava üsleri yoktur.
 */
function sortedAirports(airports: readonly MapAirport[], locale: Locale): MapAirport[] {
  const collator = new Intl.Collator(INTL_LOCALE[locale])
  const keyed = mapShownAirports(airports).map((a) => ({ a, name: airportDisplayName(a, locale) }))
  keyed.sort(
    ({ a, name: aName }, { a: b, name: bName }) =>
      Number(b.icao === PRIMARY_AIRPORT_VIEW.icao) - Number(a.icao === PRIMARY_AIRPORT_VIEW.icao) ||
      Number(b.country === TURKEY) - Number(a.country === TURKEY) ||
      Number(b.scheduled) - Number(a.scheduled) ||
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
      (a.distanceToTrKm ?? 0) - (b.distanceToTrKm ?? 0) ||
      collator.compare(aName, bName) ||
      (a.icao < b.icao ? -1 : a.icao > b.icao ? 1 : 0),
  )
  return keyed.map(({ a }) => a)
}

/** Dizinin kaydını kuran işlev; ülke adlarının önbelleği kurulum boyunca yaşar. */
function searchEntry(): (a: MapAirport) => AirportSearchEntry<MapAirport> {
  // Ülke adları ülke koduna göre (görünümü havalimanına bağlı olanlarda ICAO'ya göre) bir kez.
  // Yalnız aranan ülke adları ("Turkey") ülke koduna bağlıdır; Ercan (KKTC) onları almaz.
  const countryNames = new Map<string, readonly string[]>()
  const countriesOf = (a: MapAirport): readonly string[] => {
    const override = Object.hasOwn(AIRPORT_COUNTRY_OVERRIDES, a.icao)
    const key = override ? `icao:${a.icao}` : a.country
    let names = countryNames.get(key)
    if (names === undefined) {
      names = [
        ...new Set([
          ...LOCALES.flatMap((l) => [
            airportCountryName(a, l, 'short'),
            airportCountryName(a, l, 'long'),
          ]),
          ...(override ? [] : countrySearchAliases(a.country)),
        ]),
      ]
      countryNames.set(key, names)
    }
    return names
  }

  return (a): AirportSearchEntry<MapAirport> => ({
    value: a,
    iata: a.iata,
    icao: a.icao,
    ...(a.identAlias === undefined ? {} : { alias: a.identAlias }),
    names: nonEmpty([
      airportDisplayName(a, 'tr'),
      airportDisplayName(a, 'en'),
      airportOfficialName(a.icao),
      a.name,
    ]),
    places: nonEmpty([
      ...airportSearchPlaces(a.icao),
      ...LOCALES.map((l) => airportLocality(a, l)),
      ...(a.country === TURKEY ? LOCALES.map((l) => provinceName(a.isoRegion, l)) : []),
      a.municipality,
      a.city,
    ]),
    countries: countriesOf(a),
  })
}

/** Satırın metinleri sayfanın dilinde (bir kez, ilk gösterildiğinde). */
function searchRow(a: MapAirport, locale: Locale): Omit<AirportSearchRow, 'match'> {
  const place =
    a.country === TURKEY
      ? (provinceName(a.isoRegion, locale) ?? airportDistrict(a) ?? '')
      : nonEmpty([airportLocality(a, locale), airportCountryName(a, locale)]).join(', ')
  return { airport: a, code: a.iata || a.icao, name: airportDisplayName(a, locale), place }
}

function createSearch(index: AirportSearchIndex<MapAirport>, locale: Locale): AirportSearch {
  const rows = new Map<MapAirport, Omit<AirportSearchRow, 'match'>>()
  const rowOf = (a: MapAirport): Omit<AirportSearchRow, 'match'> => {
    let row = rows.get(a)
    if (row === undefined) {
      row = searchRow(a, locale)
      rows.set(a, row)
    }
    return row
  }

  return (query) => {
    const { hits, total, queryLetters } = searchAirportIndex(index, query)
    return {
      rows: hits.map((hit) => ({ ...rowOf(hit.value), match: hit.match })),
      total,
      queryLetters,
      degraded: false,
    }
  }
}
