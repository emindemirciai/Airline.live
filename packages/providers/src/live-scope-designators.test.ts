import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { airlineDesignatorsFrom, publishDecision } from './live-scope'
import { CHARTER_AIRLINE_ALLOW, DENIED_DESIGNATORS } from './live-scope-designators'
import { parseAirlines } from './reference/vrs'

// VRS standing-data airlines.csv (CC0), 2026-10-15 fixture'ı (tools/fixtures/vrs).
const vrs = parseAirlines(
  readFileSync(new URL('../../../tools/fixtures/vrs/airlines.csv', import.meta.url), 'utf8'),
)
const byIcao = new Map(vrs.rows.filter((r) => r.icao !== null).map((r) => [r.icao as string, r]))
const designators = airlineDesignatorsFrom(
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

/** Haritadan düşmemesi gereken havayolları (Türkiye trafiğinin çoğu ve büyük yabancılar). */
const PROTECTED = [
  'THY',
  'PGT',
  'TKJ',
  'SXS',
  'CAI',
  'FHY',
  'STW',
  'TWI',
  'MNB',
  'CXI',
  'HYS',
  'HYT',
  'FIN',
  'DLH',
  'BAW',
  'AFR',
  'KLM',
  'UAE',
  'QTR',
  'RYR',
  'EZY',
  'WZZ',
  'AFL',
  'SVA',
  'IRA',
  'TUI',
  'TOM',
  'CFG',
  'ENT',
  'EVE',
  'AZQ',
  'KZR',
  'UTA',
  'RBG',
]

describe('DENIED_DESIGNATORS', () => {
  it('222 kod: hepsi üç büyük harf, tekil ve VRS fixture’ında var', () => {
    expect(DENIED_DESIGNATORS.size).toBe(222)
    for (const code of DENIED_DESIGNATORS.keys()) {
      expect(code, code).toMatch(/^[A-Z]{3}$/)
      expect(byIcao.has(code), code).toBe(true)
    }
    const counts: Record<string, number> = {}
    for (const group of DENIED_DESIGNATORS.values()) counts[group] = (counts[group] ?? 0) + 1
    expect(counts).toEqual({
      military: 108,
      state: 37,
      police_border: 26,
      flight_inspection: 15,
      medical_rescue: 27,
      business_vip: 9,
    })
  })

  it('Türk Hava Kuvvetleri, Air Mobility Command ve THY genel havacılık reddedilir', () => {
    expect(DENIED_DESIGNATORS.get('HVK')).toBe('military')
    expect(DENIED_DESIGNATORS.get('RCH')).toBe('military')
    expect(DENIED_DESIGNATORS.get('THK')).toBe('state')
    expect(DENIED_DESIGNATORS.get('TRK')).toBe('business_vip')
  })
})

describe('CHARTER_AIRLINE_ALLOW', () => {
  it('her kod VRS’te bütün uçuşları charter sayılan (.*) bir işletmecidir', () => {
    expect(CHARTER_AIRLINE_ALLOW.size).toBe(10)
    for (const code of CHARTER_AIRLINE_ALLOW) {
      expect(byIcao.get(code)?.charterFlightPattern, code).toBe('.*')
      expect(designators.get(code)?.operator, code).toBe('airline')
      expect(DENIED_DESIGNATORS.has(code), code).toBe(false)
    }
  })
})

describe('airlineDesignatorsFrom (VRS fixture)', () => {
  it('5.904 işletmeci kodu; izin listesinden sonra 277’si non_airline', () => {
    expect(designators.size).toBe(5_904)
    const nonAirline = [...designators.values()].filter((d) => d.operator === 'non_airline')
    expect(nonAirline).toHaveLength(277)
    // Bilinen iş jeti işletmecileri ve VRS'in .* ile işaretlediği devlet ve askerî charter.
    for (const code of ['NJE', 'EJA', 'VJT', 'LXJ', 'GAJ', 'TCJ', 'TRK', 'OAE', 'NCR', 'GXA']) {
      expect(designators.get(code)?.operator, code).toBe('non_airline')
    }
  })

  it('korunan havayolları airline sayılır ve reddedilmez', () => {
    for (const code of PROTECTED) {
      expect(designators.get(code)?.operator, code).toBe('airline')
      expect(DENIED_DESIGNATORS.has(code), code).toBe(false)
      expect(
        publishDecision(
          {
            hex: '4b8750',
            nonIcao: false,
            callsign: `${code}123`,
            registration: null,
            category: 'A3',
            dbFlags: 0,
            positionSource: 'adsb_icao',
          },
          { scope: 'airline', blocklist: new Set(), designators },
        ),
        code,
      ).toBeNull()
    }
  })

  it('uçuşların bir kısmını kapsayan desenler havayolunu non_airline yapmaz', () => {
    expect(byIcao.get('DLH')?.charterFlightPattern).not.toBeNull()
    expect(designators.get('DLH')).toEqual({ iata: true, operator: 'airline' })
    expect(designators.get('EAF')).toEqual({ iata: false, operator: 'airline' })
  })

  it('aynı kod birden çok satırda: non_airline kazanır; geçersiz kod atlanır', () => {
    const table = airlineDesignatorsFrom([
      { icao: 'ABC', iata: 'AB', charterFlightPattern: null, positioningFlightPattern: null },
      { icao: 'abc', iata: null, charterFlightPattern: '.*', positioningFlightPattern: null },
      { icao: 'XYZ', iata: null, charterFlightPattern: null, positioningFlightPattern: ' .* ' },
      { icao: 'XYZ', iata: null, charterFlightPattern: null, positioningFlightPattern: null },
      { icao: 'AB1', iata: null, charterFlightPattern: null, positioningFlightPattern: null },
    ])
    expect(table.get('ABC')).toEqual({ iata: true, operator: 'non_airline' })
    expect(table.get('XYZ')).toEqual({ iata: false, operator: 'non_airline' })
    expect(table.has('AB1')).toBe(false)
  })
})
