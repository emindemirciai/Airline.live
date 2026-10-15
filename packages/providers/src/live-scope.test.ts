import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { AircraftState } from './aircraft'
import {
  airlineDesignatorsFrom,
  EMPTY_AIRLINE_DESIGNATORS,
  publishDecision,
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
  ['NJE', { iata: false, operator: 'non_airline' }],
  ['TCO', { iata: false, operator: 'airline' }],
  // Reddedilen kodlar VRS'te olsa da tablo sınıfından bağımsız düşer.
  ['HVK', { iata: false, operator: 'airline' }],
  ['RCH', { iata: true, operator: 'airline' }],
])

const state = (over: Partial<PublishState> = {}): PublishState => ({
  hex: '4baa62',
  nonIcao: false,
  callsign: 'THY974',
  registration: 'TC-JSB',
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
    expect(decide({ callsign: 'EAF123', category: null })).toBeNull()
    expect(decide({ callsign: 'THY974', category: 'A1' })).toBeNull()
  })

  it('işletmeci kodu: reddedilen, non_airline, bilinmeyen ve boş tablo', () => {
    expect(decide({ callsign: 'HVK123' })).toBe('denied_designator')
    expect(decide({ callsign: 'RCH401' })).toBe('denied_designator')
    expect(decide({ callsign: 'NJE512' })).toBe('non_airline_operator')
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
