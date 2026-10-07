import { getMessages } from '@havayolu/i18n'
import { airportRingLimitKm, ENABLED_AIRPORT_RING, type PublicAircraft } from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import type { MapAirport } from '../airport-data'
import {
  aircraftQuery,
  codeOnlyAirportSearch,
  moveActive,
  NO_AIRPORT_RESULTS,
  searchOptions,
  searchStatusText,
  submitOutcome,
  typingStatus,
  type AircraftLookup,
  type AirportSearchResult,
  type AirportSearchRow,
  type SubmitInput,
} from './search-box-model'

const airport = (icao: string, iata: string): MapAirport => ({ icao, iata }) as MapAirport

const IST = airport('LTFM', 'IST')
const SAW = airport('LTFJ', 'SAW')
const AJA = airport('LFKJ', 'AJA')
const ESB = airport('LTAC', 'ESB')
const SFA = airport('DTTX', 'SFA')
/** Savunma süzgecinin denemesi: askerî üs listede olsa da yalnız kodla aramada bulunmaz. */
const LTBL = airport('LTBL', 'IGL')

const row = (a: MapAirport, match: AirportSearchRow['match']): AirportSearchRow => ({
  airport: a,
  code: a.iata || a.icao,
  name: a.icao,
  place: '',
  match,
})

const result = (
  rows: AirportSearchRow[],
  total = rows.length,
  degraded = false,
): AirportSearchResult => ({ rows, total, degraded })

const aircraft = (hex: string, cs: string): PublicAircraft => ({ hex, cs }) as PublicAircraft
const AJA123 = aircraft('4bb001', 'AJA123')
const THY974 = aircraft('4bb26c', 'THY974')

const ok = (...results: PublicAircraft[]): AircraftLookup => ({
  status: 'ok',
  kind: 'callsign',
  results,
})
const SKIPPED: AircraftLookup = { status: 'skipped' }
const failed = (rateLimited = false): AircraftLookup => ({ status: 'failed', rateLimited })

/** Havalimanı bulunamadı metnine eklenen kapsama cümlesi (bütün halkalar açılınca yok). */
const COVERAGE =
  airportRingLimitKm(ENABLED_AIRPORT_RING) === null ? [] : (['airportCoverage'] as const)

const input = (
  query: string,
  lookup: AircraftLookup,
  airports: AirportSearchResult,
  airportsLoaded = true,
): SubmitInput => ({ query, aircraft: lookup, airports, airportsLoaded })

describe('submitOutcome: gönderimin kuralları (D-108)', () => {
  it('1: tek uçak ve hiçbir havalimanı eşleşmedi → uçak seçilir', () => {
    expect(submitOutcome(input('HYS001', ok(THY974), NO_AIRPORT_RESULTS))).toEqual({
      type: 'aircraft',
      aircraft: THY974,
    })
    // Ad parçası yüklenemedi, havalimanı satırı yok: uçak yine seçilir.
    expect(submitOutcome(input('anka', ok(THY974), result([], 0, true)))).toEqual({
      type: 'aircraft',
      aircraft: THY974,
    })
  })

  it('1: tek uçak ve bir havalimanı eşleşmesi (tam kod ya da ad) → liste, kullanıcı seçer', () => {
    for (const match of ['code', 'start', 'words', 'country'] as const) {
      expect(submitOutcome(input('anka', ok(THY974), result([row(ESB, match)]))), match).toEqual({
        type: 'list',
        airports: [row(ESB, match)],
        airportTotal: 1,
        aircraft: [THY974],
        aircraftFailure: null,
      })
    }
  })

  it('2: uçak yok ya da aranmadı; ilki tam kod → havalimanı açılır (IATA ya da ICAO)', () => {
    for (const query of ['ESB', 'esb', 'LTAC', 'ltac']) {
      expect(submitOutcome(input(query, ok(), result([row(ESB, 'code')]))), query).toEqual({
        type: 'airport',
        airport: ESB,
      })
    }
    // "ist": IST tam kod, SAW başlangıç → IST açılır (3 harf olsa da).
    expect(
      submitOutcome(input('ist', ok(), result([row(IST, 'code'), row(SAW, 'start')]))),
    ).toEqual({ type: 'airport', airport: IST })
    expect(
      submitOutcome(input('İST', SKIPPED, result([row(IST, 'code'), row(SAW, 'start')], 4))),
    ).toEqual({ type: 'airport', airport: IST })
  })

  it('2: tek havalimanı ve en az 4 harf → havalimanı açılır', () => {
    expect(submitOutcome(input('esenboğa', SKIPPED, result([row(ESB, 'start')])))).toEqual({
      type: 'airport',
      airport: ESB,
    })
    expect(submitOutcome(input('esenboga', ok(), result([row(ESB, 'start')])))).toEqual({
      type: 'airport',
      airport: ESB,
    })
    // Sınır: 4 harf açar; boşluk, tire ve noktalama sayılmaz.
    expect(submitOutcome(input('thyn', ok(), result([row(SFA, 'words')])))).toEqual({
      type: 'airport',
      airport: SFA,
    })
    expect(submitOutcome(input('Ağrı', SKIPPED, result([row(ESB, 'start')])))).toEqual({
      type: 'airport',
      airport: ESB,
    })
  })

  it('2: 3 harfle tek ad eşleşmesi açılmaz → tek satırlık liste ("THY" Sfaks Thyna değil)', () => {
    for (const [query, lookup, only] of [
      ['THY', ok(), SFA],
      ['thy', ok(), SFA],
      ['sab', ok(), SAW],
      ['gök', SKIPPED, SAW],
      ['s-a.b', ok(), SAW],
      ['İst', SKIPPED, IST],
    ] as const) {
      const airports = result([row(only, 'words')])
      expect(submitOutcome(input(query, lookup, airports)), query).toEqual({
        type: 'list',
        airports: airports.rows,
        airportTotal: 1,
        aircraft: [],
        aircraftFailure: null,
      })
    }
    // "THY" ile uçaklar da bulunduysa: havalimanı satırı ve uçaklar tek listede.
    expect(submitOutcome(input('THY', ok(THY974, AJA123), result([row(SFA, 'words')])))).toEqual({
      type: 'list',
      airports: [row(SFA, 'words')],
      airportTotal: 1,
      aircraft: [THY974, AJA123],
      aircraftFailure: null,
    })
    // Birden fazla havalimanı her zaman liste (4 harf ve üstü de).
    expect(
      submitOutcome(input('sabiha', ok(), result([row(SAW, 'words'), row(IST, 'words')]))),
    ).toEqual(expect.objectContaining({ type: 'list', airportTotal: 2 }))
  })

  it('3: hiçbir şey yok → bulunamadı; metnin parçaları', () => {
    // Uçak araması atlandı (sorgu uçak olamaz): yalnız havalimanı metni ve kapsama.
    expect(submitOutcome(input('Çiğli', SKIPPED, NO_AIRPORT_RESULTS))).toEqual({
      type: 'notFound',
      parts: ['airportNotFound', ...COVERAGE],
    })
    // Uçak araması boş: uçak metni, rakamsız sorguda havalimanı ipucu ve kapsama.
    expect(submitOutcome(input('xyzq', ok(), NO_AIRPORT_RESULTS))).toEqual({
      type: 'notFound',
      parts: ['notFound', 'airportNote', ...COVERAGE],
    })
    // Sefer no araması: sefer no notu; rakamlı sorguda havalimanı ipucu yok.
    expect(
      submitOutcome(
        input('TK1985', { status: 'ok', kind: 'flight', results: [] }, NO_AIRPORT_RESULTS),
      ),
    ).toEqual({ type: 'notFound', parts: ['notFound', 'flightNumberNote'] })
    // Havalimanı listesi yüklenmediyse ipucu yok.
    expect(submitOutcome(input('xyzq', ok(), NO_AIRPORT_RESULTS, false))).toEqual({
      type: 'notFound',
      parts: ['notFound'],
    })
    // Havalimanı listesi yüklenmedi ve sorgu uçak olamaz: hiçbir şey aranmadı → hata, "bulunamadı"
    // değil.
    expect(submitOutcome(input('Çiğli', SKIPPED, NO_AIRPORT_RESULTS, false))).toEqual({
      type: 'failed',
      rateLimited: false,
    })
  })

  it('3, ad parçası yüklenemedi: ipucunun yerine "adlar yüklenemedi"', () => {
    const degraded = result([], 0, true)
    expect(submitOutcome(input('esenboga', ok(), degraded))).toEqual({
      type: 'notFound',
      parts: ['notFound', 'airportNamesUnavailable'],
    })
    expect(submitOutcome(input('esenboğa', SKIPPED, degraded))).toEqual({
      type: 'notFound',
      parts: ['airportNamesUnavailable'],
    })
    // Rakamlı sorgu ad aramazdı: adların yüklenmemesi önemli değil.
    expect(submitOutcome(input('TK1985', ok(), degraded))).toEqual({
      type: 'notFound',
      parts: ['notFound'],
    })
    // Yalnız kodla aramada tam kod bulunursa havalimanı açılır.
    expect(submitOutcome(input('esb', ok(), result([row(ESB, 'code')], 1, true)))).toEqual({
      type: 'airport',
      airport: ESB,
    })
  })

  it('4: uçak araması hata verdi, havalimanı var → yalnız havalimanları; 4b: yoksa hata', () => {
    expect(submitOutcome(input('istanbul', failed(), result([row(IST, 'start')])))).toEqual({
      type: 'list',
      airports: [row(IST, 'start')],
      airportTotal: 1,
      aircraft: [],
      aircraftFailure: { rateLimited: false },
    })
    expect(submitOutcome(input('istanbul', failed(true), result([row(IST, 'start')])))).toEqual(
      expect.objectContaining({ type: 'list', aircraftFailure: { rateLimited: true } }),
    )
    expect(submitOutcome(input('THY974', failed(), NO_AIRPORT_RESULTS))).toEqual({
      type: 'failed',
      rateLimited: false,
    })
    expect(submitOutcome(input('THY974', failed(true), NO_AIRPORT_RESULTS))).toEqual({
      type: 'failed',
      rateLimited: true,
    })
  })

  it('5: öbür durumlar → tek liste (havalimanları önce, en çok 20 uçak)', () => {
    // "AJA": havayolu öneki ve havalimanı kodu; tek uçak olsa da tam kod eşleşmesi listeyi açar.
    expect(submitOutcome(input('AJA', ok(AJA123), result([row(AJA, 'code')])))).toEqual({
      type: 'list',
      airports: [row(AJA, 'code')],
      airportTotal: 1,
      aircraft: [AJA123],
      aircraftFailure: null,
    })
    // Birden fazla havalimanı ("istanbul").
    const istanbul = result([row(IST, 'start'), row(SAW, 'start')], 3)
    expect(submitOutcome(input('istanbul', SKIPPED, istanbul))).toEqual({
      type: 'list',
      airports: istanbul.rows,
      airportTotal: 3,
      aircraft: [],
      aircraftFailure: null,
    })
    // Yalnız uçaklar; 20'den fazlası kesilir.
    const many = Array.from({ length: 25 }, (_, i) => aircraft(`a${i}`, `AJA${i}`))
    const outcome = submitOutcome(input('AJA', ok(...many), NO_AIRPORT_RESULTS))
    expect(outcome.type).toBe('list')
    if (outcome.type === 'list') {
      expect(outcome.aircraft).toHaveLength(20)
      expect(outcome.airports).toEqual([])
    }
  })
})

describe('aircraftQuery: /v1/search sorgusu', () => {
  it('Türkçe klavye harfleri ve tire çeşitleri', () => {
    expect(aircraftQuery('TC-JİA')).toBe('TC-JIA')
    expect(aircraftQuery('tc-jıa')).toBe('tc-jia')
    expect(aircraftQuery('TK–1985')).toBe('TK-1985')
    expect(aircraftQuery('TK‐1985')).toBe('TK-1985')
    expect(aircraftQuery('~ABC123')).toBe('~ABC123')
    expect(aircraftQuery('  THY974 ')).toBe('THY974')
    expect(aircraftQuery('TK 1985')).toBe('TK 1985')
    // Yalnız İ ve ı'dan oluşan Türkçe metin aranabilir kalır (API eşleşmeyince "bulunamadı").
    expect(aircraftQuery('İstanbul Havalimanı')).toBe('Istanbul Havalimani')
  })

  it('başka karakterli sorgu uçak araması yapmaz', () => {
    for (const query of ['esenboğa', 'Çiğli', 'Sabiha Gökçen', 'TK.1985', 'Ömer', 'a/b']) {
      expect(aircraftQuery(query), query).toBeNull()
    }
  })
})

describe('moveActive: klavyeyle gezinme', () => {
  it('hiçbiri etkin değilken aşağı ilki, yukarı sonuncuyu seçer', () => {
    expect(moveActive(-1, 3, 1)).toBe(0)
    expect(moveActive(-1, 3, -1)).toBe(2)
  })

  it('iki uçta sarar', () => {
    expect(moveActive(0, 3, 1)).toBe(1)
    expect(moveActive(2, 3, 1)).toBe(0)
    expect(moveActive(0, 3, -1)).toBe(2)
    expect(moveActive(1, 3, -1)).toBe(0)
    expect(moveActive(0, 1, 1)).toBe(0)
  })

  it('seçenek yoksa -1; liste kısaldıysa baştan', () => {
    expect(moveActive(-1, 0, 1)).toBe(-1)
    expect(moveActive(0, 0, -1)).toBe(-1)
    expect(moveActive(5, 3, 1)).toBe(0)
  })
})

describe('searchOptions: kimlikler ve sıra', () => {
  it('önce havalimanları, sonra uçaklar', () => {
    const options = searchOptions('l', [row(IST, 'code')], [THY974])
    expect(options.map((option) => option.id)).toEqual(['l-a-LTFM', 'l-p-4bb26c'])
    expect(options.map((option) => option.kind)).toEqual(['airport', 'aircraft'])
  })
})

describe.each(['tr', 'en'] as const)('searchStatusText (%s)', (locale) => {
  const t = getMessages(locale).map.search
  const pick = (
    airports: AirportSearchRow[],
    airportTotal: number,
    list: PublicAircraft[],
    aircraftFailure: { rateLimited: boolean } | null = null,
  ) =>
    searchStatusText(
      { phase: 'pick', airports, airportTotal, aircraft: list, aircraftFailure },
      t,
      locale,
    )

  it('boş, aranıyor, hata', () => {
    expect(searchStatusText({ phase: 'idle' }, t, locale)).toBe('')
    expect(searchStatusText({ phase: 'searching' }, t, locale)).toBe(t.searching)
    expect(searchStatusText({ phase: 'failed', rateLimited: false }, t, locale)).toBe(t.error)
    expect(searchStatusText({ phase: 'failed', rateLimited: true }, t, locale)).toBe(t.rateLimited)
  })

  it('bulunamadı: parçalar sırayla; kapsama açık halkanın sınırıyla, sayfanın dilinde', () => {
    expect(searchStatusText({ phase: 'notFound', parts: ['airportNotFound'] }, t, locale)).toBe(
      t.airportNotFound,
    )
    expect(
      searchStatusText(
        { phase: 'notFound', parts: ['notFound', 'flightNumberNote', 'airportNote'] },
        t,
        locale,
      ),
    ).toBe(`${t.notFound} ${t.flightNumberNote} ${t.airportNote}`)
    const coverage = searchStatusText(
      { phase: 'notFound', parts: ['airportNotFound', 'airportCoverage'] },
      t,
      locale,
    )
    const km = airportRingLimitKm(ENABLED_AIRPORT_RING)
    if (km === null) {
      expect(coverage).toBe(t.airportNotFound)
    } else {
      expect(coverage).toBe(
        `${t.airportNotFound} ${t.airportCoverage.replace('{km}', locale === 'tr' ? '2.000 km' : '2,000 km')}`,
      )
      expect(km).toBe(2000)
    }
  })

  it('yazarken: öneri sayısı; liste kesildiyse ilk kaçı', () => {
    const typing = (shown: number, total: number, namesUnavailable = false) =>
      searchStatusText({ phase: 'typing', shown, total, namesUnavailable }, t, locale)
    expect(typing(0, 0)).toBe('')
    expect(typing(3, 3)).toBe(locale === 'tr' ? 'Eşleşen havalimanı: 3.' : 'Matching airports: 3.')
    expect(typing(8, 56)).toBe(
      locale === 'tr'
        ? 'Eşleşen havalimanı: 56; ilk 8 tanesi listede, aramayı daralt.'
        : 'Matching airports: 56; the first 8 are listed, narrow your search.',
    )
    expect(typing(0, 0, true)).toBe(t.airportNamesUnavailable)
  })

  it('sonuç listesi: uçak, havalimanı ya da ikisi; uçak araması yapılamadıysa onu söyler', () => {
    expect(pick([], 0, [THY974, AJA123])).toBe(t.pick)
    expect(pick([row(IST, 'start'), row(SAW, 'start')], 2, [])).toBe(t.pickAirports)
    // Enter'da açılmayan tek havalimanı ("gok", "THY").
    expect(pick([row(SFA, 'words')], 1, [])).toBe(t.pickAirport)
    expect(pick([row(SFA, 'words')], 1, [THY974])).toBe(t.pickMixed)
    expect(pick([row(AJA, 'code')], 1, [AJA123])).toBe(t.pickMixed)
    const eight = Array.from({ length: 8 }, () => row(IST, 'country'))
    expect(pick(eight, 56, [])).toBe(
      `${t.pickAirports} ${locale === 'tr' ? 'Eşleşen havalimanı: 56; ilk 8 tanesi listede, aramayı daralt.' : 'Matching airports: 56; the first 8 are listed, narrow your search.'}`,
    )
    expect(pick([row(IST, 'start')], 1, [], { rateLimited: false })).toBe(t.aircraftUnavailable)
    expect(pick([row(IST, 'start')], 1, [], { rateLimited: true })).toBe(t.rateLimited)
  })
})

describe('typingStatus', () => {
  it('ad parçası yüklenemediyse yalnız ad olabilecek sorguda söyler', () => {
    const degraded = result([], 0, true)
    expect(typingStatus(degraded, 'esenboğa')).toEqual({
      phase: 'typing',
      shown: 0,
      total: 0,
      namesUnavailable: true,
    })
    expect(typingStatus(degraded, 'TK1985')).toMatchObject({ namesUnavailable: false })
    expect(typingStatus(degraded, '4bb26c')).toMatchObject({ namesUnavailable: false })
    expect(typingStatus(degraded, 'e')).toMatchObject({ namesUnavailable: false })
    expect(typingStatus(result([row(IST, 'code')]), 'ist')).toEqual({
      phase: 'typing',
      shown: 1,
      total: 1,
      namesUnavailable: false,
    })
  })
})

describe('codeOnlyAirportSearch: ad parçası yüklenemezse yalnız tam kod', () => {
  const search = codeOnlyAirportSearch([IST, SAW, ESB, LTBL], 'tr')

  it('IATA ya da ICAO, büyük-küçük harf ve Türkçe İ/ı yok sayılır', () => {
    for (const query of ['ist', 'IST', 'İST', 'ıst', ' ltfm ', 'LTFM']) {
      expect(search(query), query).toEqual({
        rows: [{ airport: IST, code: 'IST', name: '', place: '', match: 'code' }],
        total: 1,
        degraded: true,
      })
    }
  })

  it('ad, önek ve askerî üs bulunmaz; sonuç yine degraded', () => {
    for (const query of ['istanbul', 'es', 'LT', 'LTBL', 'IGL', 'Çiğli', '']) {
      expect(search(query), query).toEqual({ rows: [], total: 0, degraded: true })
    }
  })
})
