import {
  AIRPORT_COUNTRY_OVERRIDES,
  airportCountryName,
  airportDisplayName,
  airportDistrict,
  airportLocality,
  airportOfficialName,
  createAirportSearchIndex,
  mapShownAirports,
  provinceName,
  searchAirportIndex,
  type AirportSearchEntry,
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
 *   Türkçe sayfada da bulunur.
 * - **Sıra** (bir eşleşme basamağının içinde): İstanbul Havalimanı (LTFM), Türkiye, tarifeli sefer,
 *   büyüklük (büyük, orta, küçük), Türkiye'ye uzaklık, görünen ad (sayfanın dilinin alfabesiyle),
 *   ICAO.
 * - **Askerî hava üsleri** aranmaz (`mapShownAirports`; D-103, D-107): liste zaten üssüzdür, süzgeç
 *   savunma amaçlıdır.
 * - Dizin (havalimanı listesi, dil) başına bir kez kurulur ve saklanır; satırın metinleri ilk
 *   gösterildiğinde bir kez hesaplanır.
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

/** Listedeki havalimanları üzerinde arama (liste ve dil başına bir kez kurulur). */
export function buildAirportSearch(airports: readonly MapAirport[], locale: Locale): AirportSearch {
  let byLocale = cache.get(airports)
  if (byLocale === undefined) {
    byLocale = new Map()
    cache.set(airports, byLocale)
  }
  let search = byLocale.get(locale)
  if (search === undefined) {
    search = createSearch(airports, locale)
    byLocale.set(locale, search)
  }
  return search
}

const nonEmpty = (values: readonly (string | null | undefined)[]): string[] =>
  values.filter((value): value is string => typeof value === 'string' && value.trim() !== '')

/**
 * Dizinin kayıtları, aramanın sabit sırasıyla. Geçici yapılar (sıralamanın görünen adları, ülke
 * adlarının önbelleği) bu fonksiyonun içinde kalır: kurulan arama onları tutmaz (3.500 havalimanında
 * bellek).
 */
function searchEntries(
  airports: readonly MapAirport[],
  locale: Locale,
): AirportSearchEntry<MapAirport>[] {
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

  // Ülke adları ülke koduna göre (görünümü havalimanına bağlı olanlarda ICAO'ya göre) bir kez.
  const countryNames = new Map<string, readonly string[]>()
  const countriesOf = (a: MapAirport): readonly string[] => {
    const key = Object.hasOwn(AIRPORT_COUNTRY_OVERRIDES, a.icao) ? `icao:${a.icao}` : a.country
    let names = countryNames.get(key)
    if (names === undefined) {
      names = [
        ...new Set(
          LOCALES.flatMap((l) => [
            airportCountryName(a, l, 'short'),
            airportCountryName(a, l, 'long'),
          ]),
        ),
      ]
      countryNames.set(key, names)
    }
    return names
  }

  return keyed.map(({ a }): AirportSearchEntry<MapAirport> => ({
    value: a,
    iata: a.iata,
    icao: a.icao,
    names: nonEmpty([
      airportDisplayName(a, 'tr'),
      airportDisplayName(a, 'en'),
      airportOfficialName(a.icao),
      a.name,
    ]),
    places: nonEmpty([
      ...LOCALES.map((l) => airportLocality(a, l)),
      ...(a.country === TURKEY ? LOCALES.map((l) => provinceName(a.isoRegion, l)) : []),
      a.municipality,
      a.city,
    ]),
    countries: countriesOf(a),
  }))
}

/** Satırın metinleri sayfanın dilinde (bir kez, ilk gösterildiğinde). */
function searchRow(a: MapAirport, locale: Locale): Omit<AirportSearchRow, 'match'> {
  const place =
    a.country === TURKEY
      ? (provinceName(a.isoRegion, locale) ?? airportDistrict(a) ?? '')
      : nonEmpty([airportLocality(a, locale), airportCountryName(a, locale)]).join(', ')
  return { airport: a, code: a.iata || a.icao, name: airportDisplayName(a, locale), place }
}

function createSearch(airports: readonly MapAirport[], locale: Locale): AirportSearch {
  const index = createAirportSearchIndex(searchEntries(airports, locale))
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
    const { hits, total } = searchAirportIndex(index, query)
    return {
      rows: hits.map((hit) => ({ ...rowOf(hit.value), match: hit.match })),
      total,
      degraded: false,
    }
  }
}
