import {
  AIRPORT_SEARCH_PLACES,
  isMilitaryAirfield,
  MILITARY_AIRFIELD_ICAOS,
} from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { fixtureListedAirports } from '../../../lib/test/ourairports-fixture'
import { toMapAirport, type MapAirport } from '../airport-data'
import { buildAirportSearch } from './airport-search-index'
import { submitOutcome, type AircraftLookup, type SubmitOutcome } from './search-box-model'

/** Haritanın listesi: fixture'ın listelenen havalimanları (D-080; askerî üs yok, D-107). */
const AIRPORTS: MapAirport[] = fixtureListedAirports().flatMap((detail) => {
  const airport = toMapAirport(detail)
  return airport ? [airport] : []
})

const tr = buildAirportSearch(AIRPORTS, 'tr')
const en = buildAirportSearch(AIRPORTS, 'en')

/** Sonuç satırlarının kodları (IATA). */
const codes = (query: string, search = tr) => search(query).rows.map((row) => row.code)

describe('havalimanı araması: fixture listesi (D-108)', () => {
  it("liste fixture'ın listelenen havalimanlarıdır", () => {
    expect(AIRPORTS.length).toBe(498)
  })

  it('"ist": önce tam kodla IST, sonra İstanbul havalimanları', () => {
    const result = tr('ist')
    expect(result.rows[0]).toMatchObject({ code: 'IST', match: 'code' })
    expect(codes('ist')).toContain('SAW')
    expect(result.degraded).toBe(false)
  })

  it.each(['istanbul', 'İSTANBUL', 'Istanbul', 'ıstanbul'])(
    '"%s": IST, SAW, sonra ISL',
    (query) => {
      expect(codes(query).slice(0, 3)).toEqual(['IST', 'SAW', 'ISL'])
      expect(codes(query, en).slice(0, 3)).toEqual(['IST', 'SAW', 'ISL'])
    },
  )

  it('ad, il ve şehirle', () => {
    expect(codes('sabiha gökçen')[0]).toBe('SAW')
    expect(codes('sabiha gokcen')[0]).toBe('SAW')
    expect(codes('esenboğa')).toEqual(['ESB'])
    expect(codes('Esenboga', en)).toEqual(['ESB'])
    expect(codes('izmir')[0]).toBe('ADB')
    expect(codes('Kapadokya')).toContain('NAV')
    expect(codes('Nevşehir')).toContain('NAV')
    expect(codes('Eskişehir')).toEqual(['AOE'])
  })

  it('yurt dışı: iki dilde ad ve şehir, her sayfada', () => {
    for (const search of [tr, en]) {
      expect(codes('Atina', search)).toContain('ATH')
      expect(codes('Athens', search)).toContain('ATH')
      expect(codes('Selanik', search)).toContain('SKG')
      expect(codes('Lefkoşa', search)).toContain('ECN')
      expect(codes('KKTC', search)).toEqual(['ECN'])
      expect(codes('TRNC', search)).toEqual(['ECN'])
    }
    expect(codes('Atina')[0]).toBe('ATH')
  })

  it('ülke adı: yalnız o ülkenin havalimanları', () => {
    const greece = tr('Yunanistan')
    expect(greece.total).toBeGreaterThan(1)
    for (const row of greece.rows) expect(row.airport.country).toBe('GR')
    const all = AIRPORTS.filter((a) => a.country === 'GR').length
    expect(greece.total).toBe(all)
    expect(greece.rows.length).toBe(Math.min(8, all))
    const turkey = tr('Türkiye')
    expect(turkey.total).toBe(56)
    expect(turkey.rows[0]?.code).toBe('IST')
  })

  it('"Turkey" (yalnız aranır, gösterilmez): Türkiye havalimanları, Ercan değil', () => {
    for (const [query, search] of [
      ['Turkey', en],
      ['turkey', tr],
      ['turke', en],
    ] as const) {
      const result = search(query)
      expect(result.total, query).toBe(56)
      expect(result.rows[0]?.code, query).toBe('IST')
      for (const row of result.rows) {
        expect(row.airport.country).toBe('TR')
        expect(row.match).toBe('country')
        expect(`${row.name} ${row.place}`).not.toMatch(/Turkey/i)
      }
    }
    expect(codes('Turkey', en)).not.toContain('ECN')
  })

  it('yalnız aranan şehir adları: "Adana" Çukurova, "Antep", "Urfa", "Maraş"', () => {
    for (const search of [tr, en]) {
      expect(search('Adana').rows[0], 'Adana').toMatchObject({ code: 'COV', match: 'start' })
      expect(codes('Antep', search)).toEqual(['GZT'])
      expect(codes('Urfa', search)).toEqual(['GNY'])
      expect(codes('Maraş', search)).toEqual(['KCM'])
      expect(codes('maras', search)).toEqual(['KCM'])
      expect(codes('İzmit', search)).toContain('KCO')
      expect(codes('Fethiye', search)).toContain('DLM')
      expect(codes('Afyon', search)).toEqual(['KZR'])
    }
    // Satır havalimanının gerçek yerini yazar (Çukurova Mersin'dedir); ek ad gösterilmez.
    expect(tr('Adana').rows[0]?.place).toBe('Mersin')
    expect(tr('Adana').rows[0]?.name).not.toContain('Adana')
  })

  it('ek adların her anahtarı listelenen sivil havalimanıdır (eskiyen anahtar testi bozar)', () => {
    const listed = new Set(AIRPORTS.map((a) => a.icao))
    for (const icao of Object.keys(AIRPORT_SEARCH_PLACES)) {
      expect(listed.has(icao), icao).toBe(true)
      expect(isMilitaryAirfield(icao), icao).toBe(false)
    }
  })

  it('3 harfle öneri: "sab" Sabiha Gökçen, "gok" ve "gök" Sabiha Gökçen, "ant" Antalya', () => {
    for (const search of [tr, en]) {
      expect(codes('sab', search), 'sab').toContain('SAW')
      expect(codes('gok', search), 'gok').toEqual(['SAW'])
      expect(codes('gök', search), 'gök').toEqual(['SAW'])
      // "ant": Antalya ve yeri Antalya ya da Antakya olanlar, ek adla Gaziantep ("Antep").
      expect(codes('ant', search), 'ant').toEqual(['AYT', 'GZT', 'GZP', 'HTY'])
      expect(codes('GAP', search)).toEqual(['GNY'])
    }
  })

  it('"THY" (havayolu kodu biçimi) öneride Sfaks Thyna’yı verir (Enter onu açmaz: submitOutcome)', () => {
    for (const search of [tr, en]) {
      expect(search('THY').rows.map((row) => [row.code, row.match])).toEqual([['SFA', 'words']])
      expect(codes('thy', search)).toEqual(['SFA'])
      expect(codes('thyna', search)).toEqual(['SFA'])
    }
  })

  it('Enter (uçak yok): tam kod ya da en az 4 harfle tek eşleşme açılır; "THY" ve "sab" liste', () => {
    const NO_AIRCRAFT: AircraftLookup = { status: 'ok', kind: 'callsign', results: [] }
    const enter = (query: string, search = tr): SubmitOutcome =>
      submitOutcome({
        query,
        aircraft: NO_AIRCRAFT,
        airports: search(query),
        airportsLoaded: true,
      })
    const opened = (outcome: SubmitOutcome) =>
      outcome.type === 'airport' ? outcome.airport.iata : null
    const listed = (outcome: SubmitOutcome) =>
      outcome.type === 'list' ? outcome.airports.map((row) => row.code) : null
    for (const search of [tr, en]) {
      for (const query of ['ESB', 'esb', 'LTAC', 'esenboga', 'Esenboğa', 'esenboğa hav']) {
        expect(opened(enter(query, search)), query).toBe('ESB')
      }
      expect(opened(enter('ist', search))).toBe('IST')
      expect(opened(enter('İST', search))).toBe('IST')
      expect(opened(enter('thyna', search))).toBe('SFA')
      expect(opened(enter('gokcen', search))).toBe('SAW')
      // "THY": öneride Sfaks Thyna var, Enter onu açmaz; liste gösterilir.
      expect(listed(enter('THY', search))).toEqual(['SFA'])
      expect(listed(enter('thy', search))).toEqual(['SFA'])
      expect(listed(enter('sab', search))).toContain('SAW')
      expect(listed(enter('gok', search))).toEqual(['SAW'])
      expect(listed(enter('ant', search))).toEqual(['AYT', 'GZT', 'GZP', 'HTY'])
    }
  })

  it('yarım yazılmış dolgu sözcüğü listeyi boşaltmaz', () => {
    const full = tr('antalya havalimanı').rows.map((row) => row.code)
    expect(full).toContain('AYT')
    for (const query of ['antalya h', 'antalya hava', 'antalya havali']) {
      expect(codes(query), query).toEqual(full)
    }
    expect(codes('esenboğa hav')).toEqual(['ESB'])
    expect(codes('istanbul airp', en)).toEqual(codes('istanbul airport', en))
    expect(codes('istanbul airp', en).slice(0, 3)).toEqual(['IST', 'SAW', 'ISL'])
  })

  it('satırın metinleri sayfanın dilinde', () => {
    expect(tr('esenboğa').rows[0]).toMatchObject({
      code: 'ESB',
      name: 'Ankara Esenboğa Havalimanı',
      place: 'Ankara',
      match: 'start',
    })
    expect(tr('ATH').rows[0]).toMatchObject({ code: 'ATH', place: 'Atina, Yunanistan' })
    expect(en('ATH').rows[0]).toMatchObject({ code: 'ATH', place: 'Athens, Greece' })
    expect(en('ATH').rows[0]?.name).toBe('Athens Eleftherios Venizelos International Airport')
    expect(tr('ECN').rows[0]?.place).toMatch(/, KKTC$/)
    expect(en('ECN').rows[0]?.place).toMatch(/, TRNC$/)
    expect(tr('LTFM').rows[0]).toMatchObject({
      code: 'IST',
      name: 'İstanbul Havalimanı',
      place: 'İstanbul',
      match: 'code',
    })
  })

  it('rakamlı sorgu ad aramaz; tek karakter hiçbir şey bulmaz', () => {
    expect(tr('TK1985')).toEqual({ rows: [], total: 0, degraded: false })
    expect(tr('i').rows).toEqual([])
    expect(tr('havalimanı').rows).toEqual([])
  })

  it('askerî hava üsleri hiçbir sorguyla bulunmaz (savunma süzgeci, D-103, D-107)', () => {
    const template = AIRPORTS.find((a) => a.icao === 'LTBJ')
    expect(template).toBeDefined()
    if (!template) return
    const bases: MapAirport[] = [
      {
        ...template,
        icao: 'LTBL',
        iata: 'IGL',
        name: 'Çiğli Airbase',
        municipality: 'Çiğli',
        city: 'Çiğli',
        scheduled: false,
      },
      {
        ...template,
        icao: 'LTAG',
        iata: 'UAB',
        name: 'Incirlik Air Base',
        municipality: 'İncirlik',
        city: 'İncirlik',
        isoRegion: 'TR-01',
        scheduled: false,
      },
    ]
    const withBases = buildAirportSearch([...AIRPORTS, ...bases], 'tr')
    for (const query of ['LTBL', 'IGL', 'Çiğli', 'İncirlik', 'Hava Üssü', 'Air Base', 'airbase']) {
      const icaos = withBases(query).rows.map((row) => row.airport.icao)
      for (const icao of MILITARY_AIRFIELD_ICAOS) expect(icaos, query).not.toContain(icao)
    }
    expect(withBases('LTBL').rows).toEqual([])
    expect(withBases('Çiğli').rows).toEqual([])
    expect(withBases('izmir').rows[0]?.code).toBe('ADB')
    // Haritanın listesinde (üssüz) bu sorgular hiçbir şey bulmaz: e2e listenin kapalı kaldığını
    // denetler (map-search.spec.ts).
    for (const query of ['LTBL', 'IGL', 'Çiğli', 'İncirlik']) {
      expect(tr(query).rows, query).toEqual([])
    }
  })

  it('aynı liste ve dil için aynı arama (bir kez kurulur)', () => {
    expect(buildAirportSearch(AIRPORTS, 'tr')).toBe(tr)
    expect(buildAirportSearch(AIRPORTS, 'en')).toBe(en)
    expect(buildAirportSearch(AIRPORTS, 'en')).not.toBe(tr)
    expect(buildAirportSearch([...AIRPORTS], 'tr')).not.toBe(tr)
  })
})
