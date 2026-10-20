import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { AircraftState } from './aircraft'
import {
  airlineDesignatorsFrom,
  EMPTY_AIRLINE_DESIGNATORS,
  MIN_NON_AIRLINE_DESIGNATORS,
  nonAirlineCount,
  publishDecision,
  suspectDesignatorTable,
  type AirlineDesignator,
  type AirlineDesignators,
  type PublishContext,
  type PublishState,
} from './live-scope'
import { parseLiveResponse } from './live/response'
import { parseAirlines } from './reference/vrs'

const designators: AirlineDesignators = new Map([
  ['THY', { iata: true, operator: 'airline' }],
  ['PGT', { iata: true, operator: 'airline' }],
  ['CAI', { iata: true, operator: 'airline' }],
  ['FIN', { iata: true, operator: 'airline' }],
  ['ENT', { iata: true, operator: 'airline' }],
  ['EAF', { iata: false, operator: 'airline' }],
  ['BOE', { iata: false, operator: 'non_airline' }],
  ['TCO', { iata: false, operator: 'airline' }],
  // Harf + rakam tescilli ülkelerin işaretiyle başlayan VRS kodları (UPA Air Foyle, UPS, EZA Eznis
  // Airways (Moğolistan), CUB Cubana, RPC ve VNA başka ülkelerin işletmecileri).
  ['UPA', { iata: false, operator: 'airline' }],
  ['UPS', { iata: true, operator: 'airline' }],
  ['EZA', { iata: true, operator: 'airline' }],
  ['CUB', { iata: true, operator: 'airline' }],
  ['CUT', { iata: false, operator: 'airline' }],
  ['RPC', { iata: false, operator: 'airline' }],
  ['VNA', { iata: false, operator: 'airline' }],
  // Reddedilen kodlar VRS'te olsa da tablo sınıfından bağımsız düşer (NJE `non_airline`dır,
  // QQE IATA kodlu `airline`).
  ['HVK', { iata: false, operator: 'airline' }],
  ['RCH', { iata: true, operator: 'airline' }],
  ['NJE', { iata: true, operator: 'non_airline' }],
  ['QQE', { iata: true, operator: 'airline' }],
])

const state = (over: Partial<PublishState> = {}): PublishState => ({
  hex: '4baa62',
  nonIcao: false,
  callsign: 'THY974',
  registration: 'TC-JSB',
  typeCode: 'A321',
  category: 'A3',
  dbFlags: 0,
  positionSource: 'adsb_icao',
  ...over,
})

const ctx = (over: Partial<PublishContext> = {}): PublishContext => ({
  scope: 'airline',
  blocklist: new Set(),
  designators,
  ...over,
})

const decide = (over: Partial<PublishState> = {}, context: Partial<PublishContext> = {}) =>
  publishDecision(state(over), ctx(context))

describe('publishDecision: airline', () => {
  it('çağrı kodu biçimi: ICAO kodu + rakamla başlayan en çok dört karakter', () => {
    for (const callsign of ['THY974', 'THY2NP', 'PGT15UE', 'CAI5A', 'FIN1934', 'THY0123']) {
      expect(decide({ callsign }), callsign).toBeNull()
    }
    expect(decide({ callsign: 'thy974' })).toBeNull()
    expect(decide({ callsign: ' THY974  ' })).toBeNull()
    for (const callsign of ['TCOIL', 'N123AB', 'TCJJA', 'THY', 'THYA12', 'THY12345', 'THY 12']) {
      expect(decide({ callsign }), callsign).toBe('callsign_pattern')
    }
  })

  it('çağrı kodu yoksa ya da boşsa no_callsign; tescile eşitse callsign_is_registration', () => {
    expect(decide({ callsign: null })).toBe('no_callsign')
    expect(decide({ callsign: '   ' })).toBe('no_callsign')
    expect(decide({ callsign: 'TCO123', registration: 'TC-O123' })).toBe('callsign_is_registration')
  })

  it('hatırlanan çağrı kodu örneğin çağrı kodunun yerine geçer', () => {
    expect(decide({ callsign: null }, { callsign: 'THY974' })).toBeNull()
    expect(decide({ callsign: 'THY974' }, { callsign: null })).toBe('no_callsign')
  })

  it('bayraklar: bilinmeyen, askerî, ilginç, PIA ve LADD yayınlanmaz', () => {
    expect(decide({ dbFlags: null })).toBe('flags_unknown')
    expect(decide({ dbFlags: 1 })).toBe('military')
    expect(decide({ dbFlags: 3 })).toBe('military')
    expect(decide({ dbFlags: 2 })).toBe('interesting')
    expect(decide({ dbFlags: 4 })).toBe('pia_ladd')
    expect(decide({ dbFlags: 8 })).toBe('pia_ladd')
    expect(decide({ dbFlags: 0 })).toBeNull()
  })

  it('ICAO dışı adres ve kaynak non_icao; MLAT ve TIS-B ICAO adresiyle geçer', () => {
    expect(decide({ hex: '~abc123' })).toBe('non_icao')
    expect(decide({ nonIcao: true })).toBe('non_icao')
    expect(decide({ positionSource: 'adsb_other' })).toBe('non_icao')
    expect(decide({ positionSource: 'tisb_trackfile' })).toBe('non_icao')
    expect(decide({ positionSource: 'mlat' })).toBeNull()
    expect(decide({ positionSource: 'tisb_icao' })).toBeNull()
  })

  it('kategori: yok ya da A1–A5 geçer; helikopter, planör, İHA ve yer araçları geçmez', () => {
    for (const category of [null, '', 'A0', 'a3', 'A1', 'A2', 'A3', 'A4', 'A5']) {
      expect(decide({ category }), String(category)).toBeNull()
    }
    for (const category of ['A6', 'A7', 'B1', 'B6', 'C1', 'D2', 'X9']) {
      expect(decide({ category }), category).toBe('category')
    }
    // IATA kodu olmayan işletmecinin A1/A2 uçağı (küçük iş jeti) yayınlanmaz; A3 yayınlanır.
    expect(decide({ callsign: 'EAF123', category: 'A2' })).toBe('small_non_scheduled')
    expect(decide({ callsign: 'EAF123', category: 'A3' })).toBeNull()
    expect(decide({ callsign: 'THY974', category: 'A1' })).toBeNull()
    // Kategorisi olmayan (yalnız Mode S ya da MLAT, A0) uçak küçük sayılır (kapalı varsayım).
    for (const category of [null, '', 'A0', ' a0 ']) {
      expect(decide({ callsign: 'EAF123', category }), String(category)).toBe('small_non_scheduled')
      expect(decide({ callsign: 'THY974', category }), String(category)).toBeNull()
    }
  })

  it('iş jeti tipi işletmeci kodundan bağımsız düşer (IATA kodlu işletmecide de)', () => {
    for (const typeCode of ['GLF6', 'GLEX', 'FA7X', 'C68A', 'E55P', 'LJ45', ' gl7t ']) {
      expect(decide({ typeCode }), typeCode).toBe('business_jet_type')
      expect(decide({ callsign: 'EAF123', typeCode }), typeCode).toBe('business_jet_type')
    }
    for (const typeCode of ['A321', 'A319', 'B737', 'B738', 'CRJ9', 'E190', 'AT76']) {
      expect(decide({ typeCode }), typeCode).toBeNull()
      expect(decide({ callsign: 'EAF123', typeCode }), typeCode).toBeNull()
    }
    // Önceki kurallar önce gelir: reddedilen kod ve küçük uçak kendi nedeniyle düşer.
    expect(decide({ callsign: 'HVK123', typeCode: 'GLF5' })).toBe('denied_designator')
    expect(decide({ callsign: 'EAF123', category: 'A2', typeCode: 'C25A' })).toBe(
      'small_non_scheduled',
    )
  })

  it('tipi bilinmeyen uçak IATA kodu olmayan işletmecide düşer, IATA kodluda geçer', () => {
    for (const typeCode of [null, '', '  ']) {
      expect(decide({ callsign: 'EAF123', typeCode }), String(typeCode)).toBe(
        'unknown_type_non_scheduled',
      )
      expect(decide({ callsign: 'THY974', typeCode }), String(typeCode)).toBeNull()
    }
    // Kategorisi de olmayan uçak önce küçük sayılır.
    expect(decide({ callsign: 'EAF123', typeCode: null, category: null })).toBe(
      'small_non_scheduled',
    )
  })

  it('harf + rakam tescilli ülkenin uçağı tescilini çağrı kodu gönderirse tescil bilinmese de düşer', () => {
    const registrationLike = (hex: string, callsign: string, category: string | null = 'A5') =>
      decide({ hex, callsign, category, registration: null })
    expect(registrationLike('601801', 'EZA777')).toBe('callsign_is_registration') // Türkmenistan
    expect(registrationLike('683001', 'UPA2001', 'A3')).toBe('callsign_is_registration') // Kazakistan
    expect(registrationLike('758001', 'RPC5168', null)).toBe('callsign_is_registration') // Filipinler
    expect(registrationLike('0b0001', 'CUT1240', 'A3')).toBe('callsign_is_registration') // Küba
    expect(registrationLike('888001', 'VNA321', 'A3')).toBe('callsign_is_registration') // Vietnam
    // Seri harfi denetlenmez: ülke işaretiyle başlayan her çağrı kodu düşer (kapalı varsayım).
    expect(registrationLike('683002', 'UPS2001', 'A3')).toBe('callsign_is_registration')
    expect(registrationLike('0b0002', 'CUB362', 'A3')).toBe('callsign_is_registration') // Cubana
    // Aynı kodlar başka ülkenin adresiyle havayolu uçuşudur; o ülkenin havayolu etkilenmez.
    expect(registrationLike('682001', 'EZA123', 'A3')).toBeNull() // Eznis, Moğolistan
    expect(registrationLike('4b8750', 'UPA2001', 'A3')).toBeNull()
    expect(registrationLike('a00001', 'UPS2001', 'A3')).toBeNull() // UPS, ABD
    expect(registrationLike('780001', 'CUB362', 'A3')).toBeNull() // Çin adresi
    // Blok sınırları ve ICAO dışı adres.
    expect(registrationLike('601bff', 'EZA777')).toBe('callsign_is_registration')
    expect(registrationLike('601c00', 'EZA777')).toBeNull()
    expect(registrationLike('6833ff', 'UPA2001')).toBe('callsign_is_registration')
    expect(registrationLike('683400', 'UPA2001')).toBeNull()
    expect(registrationLike('~683001', 'UPA2001')).toBe('non_icao')
  })

  it('işletmeci kodu: reddedilen, non_airline, bilinmeyen ve boş tablo', () => {
    expect(decide({ callsign: 'HVK123' })).toBe('denied_designator')
    expect(decide({ callsign: 'RCH401' })).toBe('denied_designator')
    expect(decide({ callsign: 'BOE512' })).toBe('non_airline_operator')
    // Büyük iş jeti işletmecileri VRS sınıfından bağımsız reddedilir (desen kaybolsa da).
    expect(decide({ callsign: 'NJE512' })).toBe('denied_designator')
    expect(decide({ callsign: 'QQE1', typeCode: 'A319' })).toBe('denied_designator')
    expect(decide({ callsign: 'ENT701' })).toBeNull()
    expect(decide({ callsign: 'ZZZ123' })).toBe('unknown_designator')
    expect(decide({}, { designators: EMPTY_AIRLINE_DESIGNATORS })).toBe('designators_unavailable')
    // Reddedilen kod boş tabloda da reddedilir.
    expect(decide({ callsign: 'HVK123' }, { designators: EMPTY_AIRLINE_DESIGNATORS })).toBe(
      'denied_designator',
    )
  })

  it('engel listesi: okunamadıysa hiçbiri, listedeyse o uçak yayınlanmaz', () => {
    expect(decide({}, { blocklist: null })).toBe('blocklist_unavailable')
    expect(decide({}, { blocklist: new Set(['4baa62']) })).toBe('blocklisted')
    expect(decide({}, { blocklist: new Set(['4baa63']) })).toBeNull()
  })
})

describe('işletmeci tablosu güvencesi (VRS desen sütunu kaybolursa)', () => {
  const table = (airline: number, nonAirline: number): AirlineDesignators => {
    const out = new Map<string, AirlineDesignator>()
    for (let i = 0; i < airline + nonAirline; i += 1) {
      out.set(`A${String(i).padStart(4, '0')}`, {
        iata: false,
        operator: i < nonAirline ? 'non_airline' : 'airline',
      })
    }
    return out
  }

  it('non_airline sayısı', () => {
    expect(nonAirlineCount(table(5, 3))).toBe(3)
    expect(nonAirlineCount(EMPTY_AIRLINE_DESIGNATORS)).toBe(0)
  })

  it('alt sınırın ya da son iyi tablonun %80’inin altı şüphelidir; boş tablo şüpheli değildir', () => {
    const minimum = MIN_NON_AIRLINE_DESIGNATORS
    expect(minimum).toBe(200)
    expect(suspectDesignatorTable(table(5_000, 277), { previousNonAirline: 0, minimum })).toBe(
      false,
    )
    expect(suspectDesignatorTable(table(5_900, 0), { previousNonAirline: 0, minimum })).toBe(true)
    expect(suspectDesignatorTable(table(5_900, 199), { previousNonAirline: 0, minimum })).toBe(true)
    expect(suspectDesignatorTable(table(5_000, 222), { previousNonAirline: 277, minimum })).toBe(
      false,
    )
    expect(suspectDesignatorTable(table(5_000, 220), { previousNonAirline: 277, minimum })).toBe(
      true,
    )
    expect(
      suspectDesignatorTable(EMPTY_AIRLINE_DESIGNATORS, { previousNonAirline: 277, minimum }),
    ).toBe(false)
    // Geliştirme ve testte alt sınır yoktur (küçük tablolar); oran yine uygulanır.
    expect(suspectDesignatorTable(table(1, 0), { previousNonAirline: 0, minimum: 0 })).toBe(false)
    expect(suspectDesignatorTable(table(10, 1), { previousNonAirline: 10, minimum: 0 })).toBe(true)
  })

  it('çapalı ve + yazımı (^.*$, .+, ^.+$) da bütün uçuşlar sayılır', () => {
    const row = (icao: string, charterFlightPattern: string) => ({
      icao,
      iata: null,
      charterFlightPattern,
      positioningFlightPattern: null,
    })
    const t = airlineDesignatorsFrom([
      row('AAA', '^.*$'),
      row('BBB', '.+'),
      row('CCC', ' ^.+$ '),
      row('DLH', '^((987\\d)|(99\\d\\d))$'),
      row('RYR', '^\\d$'),
    ])
    expect(nonAirlineCount(t)).toBe(3)
    expect(t.get('DLH')?.operator).toBe('airline')
    expect(t.get('RYR')?.operator).toBe('airline')
  })
})

describe('publishDecision: all', () => {
  const all = (over: Partial<PublishState> = {}, context: Partial<PublishContext> = {}) =>
    decide(over, { scope: 'all', ...context })

  it('yalnızca engel listesi ve askerî bit uygulanır', () => {
    expect(all({ dbFlags: 1 })).toBe('military')
    expect(all({}, { blocklist: new Set(['4baa62']) })).toBe('blocklisted')
    expect(all({}, { blocklist: null })).toBe('blocklist_unavailable')
    expect(all({ dbFlags: null })).toBeNull()
    expect(all({ dbFlags: 4 })).toBeNull()
    expect(all({ callsign: 'TCOIL' })).toBeNull()
    expect(all({ callsign: null, category: 'A7' })).toBeNull()
    expect(all({}, { designators: EMPTY_AIRLINE_DESIGNATORS })).toBeNull()
  })
})

describe('gerçek adsb.lol yanıtı (LTFM 40 nm, 2026-09-27)', () => {
  const point = JSON.parse(
    readFileSync(
      new URL('../../../tools/fixtures/adsblol/point-ltfm-40nm.json', import.meta.url),
      'utf8',
    ),
  ) as unknown
  const vrs = parseAirlines(
    readFileSync(new URL('../../../tools/fixtures/vrs/airlines.csv', import.meta.url), 'utf8'),
  )
  const table = airlineDesignatorsFrom(
    vrs.rows.flatMap((r) =>
      r.icao === null
        ? []
        : [
            {
              icao: r.icao,
              iata: r.iata,
              charterFlightPattern: r.charterFlightPattern,
              positioningFlightPattern: r.positioningFlightPattern,
            },
          ],
    ),
  )

  it('18 uçağın 16’sı yayınlanır: çağrı kodsuz olan ve LADD iş jeti (TCOIL) düşer', () => {
    const { aircraft } = parseLiveResponse(point, 'adsbLol')
    expect(aircraft).toHaveLength(18)
    const decisions = new Map<string, ReturnType<typeof publishDecision>>(
      aircraft.map((a: AircraftState) => [
        a.hex,
        publishDecision(a, { scope: 'airline', blocklist: new Set(), designators: table }),
      ]),
    )
    expect([...decisions.values()].filter((d) => d === null)).toHaveLength(16)
    expect(decisions.get('4baac9')).toBe('no_callsign')
    expect(decisions.get('4bbd2c')).toBe('pia_ladd')
  })
})
