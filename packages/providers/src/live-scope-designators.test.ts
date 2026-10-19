import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { airlineDesignatorsFrom, publishDecision, type PublishState } from './live-scope'
import {
  BUSINESS_JET_TYPES,
  CHARTER_AIRLINE_ALLOW,
  DENIED_DESIGNATORS,
  DENY_GROUPS,
} from './live-scope-designators'
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

/**
 * Askerî, devlet, polis, sınır, sağlık ve kurtarma çağrışımlı adlar. Fixture'da bunlardan biriyle
 * eşleşen ve `airline` sayılan her kod ya reddedilir ya da `REVIEWED_NOT_DENIED`'dadır.
 */
const SENSITIVE_NAME =
  /air ?force|army|navy|naval|armed forces|militar|defen[cs]e|national guard|government|gobierno|gouvernement|governo|ministr|department|departamento|police|polizei|polic[ií]a|public safety|gendarm|coast ?guard|border|frontier|customs|douane|flying training|training unit|squadron|detachment|presiden|amiri|royal flight|test pilot|\bsar\b|rescue|maritime|air patrol|state|federal|aviation authority|civil aviation|calibration|flight inspection|meteorolog|research|air division|red cross|ambulance|medevac|medical|\bsos\b|angel flight|care flight|air care|open skies/i

/** Ad taramasına takılan ama gerekçesiyle reddedilmeyen kodlar (gerçek havayolları, sivil şirketler). */
const REVIEWED_NOT_DENIED: ReadonlyMap<string, string> = new Map([
  ['ADG', 'Aerea Flying Training Organization: sivil uçuş okulu'],
  ['UHS', 'Ulyanovsk Higher Civil Aviation School: sivil havacılık okulu'],
  ['BDG', 'Mississippi State University: üniversite'],
  ['DSU', 'Delta State University: üniversite'],
  ['FDL', 'Farmingdale State University: üniversite'],
  ['KSU', 'Kansas State University: üniversite'],
  ['BRK', 'Briansk State Air Enterprise: sivil bölge havayolu'],
  ['KMA', 'Komiaviatrans State Air Enterprise: sivil bölge havayolu'],
  ['ORM', 'Orel State Air Enterprise: sivil bölge havayolu'],
  ['RYZ', 'Ryazan State Air Enterprise: sivil bölge havayolu'],
  ['SUM', 'State Unitary Air Enterprise: sivil bölge havayolu'],
  ['VGV', 'Vologda State Air Enterprise: sivil bölge havayolu'],
  ['COP', 'Copper State Air Service: havayolu'],
  ['GSA', 'Garden State Airlines: havayolu'],
  ['ITS', 'Inter-State Aviation: havayolu'],
  ['FWA', 'Interstate Airlines: havayolu'],
  ['LOF', 'Trans States Airlines: havayolu'],
  ['MIS', 'Midstate Airlines: havayolu'],
  ['SSQ', 'Sunstate Airlines: havayolu'],
  ['SWJ', 'Stateswest Airlines: havayolu'],
  ['TSS', 'Tri-State Aero: havayolu'],
  ['PCX', 'Pacific Aviation (United States): adda yalnız ülke adı'],
  ['CLD', 'Clowes Estates Limited: "Estates", şirket'],
  ['FDR', 'Federal Air: havayolu'],
  ['FDX', 'Federal Express: kargo havayolu'],
  ['FED', 'Líneas Aéreas Federales: havayolu'],
  ['FLL', 'Federal Airlines: havayolu'],
  ['FRM', 'Federal Armored Service: zırhlı taşımacılık şirketi'],
  ['FFT', 'Frontier Airlines: havayolu'],
  ['FTA', 'Frontier Flying Service: havayolu'],
  ['ITR', 'Frontier Commuter: havayolu'],
  ['MNV', 'Mauritanienne Aerienne Et Navale: hava ve deniz taşımacılığı şirketi'],
  ['RVM', 'River Ministries Air Charter: charter şirketi'],
])

const publishState = (callsign: string, over: Partial<PublishState> = {}): PublishState => ({
  hex: '4b8750',
  nonIcao: false,
  callsign,
  registration: null,
  typeCode: null,
  category: 'A3',
  dbFlags: 0,
  positionSource: 'adsb_icao',
  ...over,
})

describe('DENIED_DESIGNATORS', () => {
  it('284 kod: hepsi üç büyük harf, tekil ve VRS fixture’ında var', () => {
    expect(DENIED_DESIGNATORS.size).toBe(284)
    // Aynı kod iki grupta (ya da bir grupta iki kez) olamaz: grupların toplamı tablonun boyudur.
    expect(DENY_GROUPS.reduce((n, [, codes]) => n + codes.length, 0)).toBe(DENIED_DESIGNATORS.size)
    const codes = [...DENIED_DESIGNATORS.keys()]
    expect(codes.filter((code) => !/^[A-Z]{3}$/.test(code))).toEqual([])
    expect(codes.filter((code) => !byIcao.has(code))).toEqual([])
    const counts: Record<string, number> = {}
    for (const group of DENIED_DESIGNATORS.values()) counts[group] = (counts[group] ?? 0) + 1
    expect(counts).toEqual({
      military: 127,
      state: 48,
      police_border: 28,
      flight_inspection: 17,
      medical_rescue: 35,
      business_vip: 29,
    })
    // 33'ü VRS desenleriyle de `non_airline`dır; ret desene bağlı kalmasın diye burada da durur.
    expect(codes.filter((code) => designators.get(code)?.operator === 'non_airline')).toHaveLength(
      33,
    )
  })

  it('Türk Hava Kuvvetleri, Air Mobility Command ve THY genel havacılık reddedilir', () => {
    expect(DENIED_DESIGNATORS.get('HVK')).toBe('military')
    expect(DENIED_DESIGNATORS.get('RCH')).toBe('military')
    expect(DENIED_DESIGNATORS.get('THK')).toBe('state')
    expect(DENIED_DESIGNATORS.get('TRK')).toBe('business_vip')
  })

  it('VRS’in airline saydığı askerî, devlet ve iş jeti kodları reddedilir', () => {
    expect(DENIED_DESIGNATORS.get('PAT')).toBe('military') // ABD Kara Kuvvetleri C-37
    expect(DENIED_DESIGNATORS.get('OSY')).toBe('military') // Açık Semalar, IATA 1L
    expect(DENIED_DESIGNATORS.get('CAP')).toBe('military')
    expect(DENIED_DESIGNATORS.get('BGF')).toBe('state') // Bulgaristan hükümet uçuşları
    expect(DENIED_DESIGNATORS.get('DAM')).toBe('state')
    expect(DENIED_DESIGNATORS.get('OKL')).toBe('police_border')
    expect(DENIED_DESIGNATORS.get('RFI')).toBe('flight_inspection')
    expect(DENIED_DESIGNATORS.get('RED')).toBe('medical_rescue')
    expect(DENIED_DESIGNATORS.get('QQE')).toBe('business_vip') // IATA QE
    for (const code of ['PAT', 'OSY', 'BGF', 'DAM', 'QQE', 'PJS', 'MLM']) {
      expect(designators.get(code)?.operator, code).toBe('airline')
      const decision = publishDecision(publishState(`${code}101`, { typeCode: 'A319' }), {
        scope: 'airline',
        blocklist: new Set(),
        designators,
      })
      expect(decision, code).toBe('denied_designator')
    }
  })

  it('büyük .* iş jeti işletmecileri VRS deseninden bağımsız reddedilir', () => {
    const big = ['EJA', 'NJE', 'VJT', 'LXJ', 'GAJ', 'TCJ', 'EJM', 'JME', 'IJM', 'GMA', 'TRK']
    expect(big.filter((code) => DENIED_DESIGNATORS.get(code) !== 'business_vip')).toEqual([])
    // Desen sütunu kaybolsa bile (bütün desenler null) bu kodlar yayınlanmaz.
    const patternless = airlineDesignatorsFrom(
      vrs.rows.flatMap((r) =>
        r.icao === null
          ? []
          : [
              {
                icao: r.icao,
                iata: r.iata,
                charterFlightPattern: null,
                positioningFlightPattern: null,
              },
            ],
      ),
    )
    for (const code of big) {
      expect(patternless.get(code)?.operator, code).toBe('airline')
      expect(
        publishDecision(publishState(`${code}512`, { typeCode: 'A320' }), {
          scope: 'airline',
          blocklist: new Set(),
          designators: patternless,
        }),
        code,
      ).toBe('denied_designator')
    }
  })

  it('ad taraması: hassas adlı her airline kodu reddedilmiş ya da gerekçesiyle listelenmiştir', () => {
    const unreviewed: string[] = []
    const hits = new Set<string>()
    for (const row of vrs.rows) {
      if (row.icao === null || !SENSITIVE_NAME.test(row.name)) continue
      if (designators.get(row.icao)?.operator !== 'airline') continue
      if (DENIED_DESIGNATORS.has(row.icao)) continue
      hits.add(row.icao)
      if (!REVIEWED_NOT_DENIED.has(row.icao)) unreviewed.push(`${row.icao} ${row.name}`)
    }
    expect(unreviewed).toEqual([])
    // Gerekçeli liste güncel kalır: her kod hâlâ taramaya takılır ve reddedilmez.
    expect([...REVIEWED_NOT_DENIED.keys()].filter((code) => !hits.has(code))).toEqual([])
  })
})

describe('BUSINESS_JET_TYPES', () => {
  it('83 ICAO tip kodu; havayolu tipleri listede yok', () => {
    expect(BUSINESS_JET_TYPES.size).toBe(83)
    expect([...BUSINESS_JET_TYPES].filter((t) => !/^[A-Z][A-Z0-9]{3}$/.test(t))).toEqual([])
    const airliners = ['A319', 'A320', 'A20N', 'A321', 'A21N', 'A332', 'A333', 'A359', 'B737']
    airliners.push('B738', 'B38M', 'B39M', 'B763', 'B77W', 'B789', 'CRJ9', 'E190', 'E195', 'AT76')
    expect(airliners.filter((t) => BUSINESS_JET_TYPES.has(t))).toEqual([])
    for (const t of ['GLF6', 'GLEX', 'GL7T', 'FA7X', 'F900', 'CL60', 'C68A', 'E55P', 'LJ45']) {
      expect(BUSINESS_JET_TYPES.has(t), t).toBe(true)
    }
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
      // Tipi bilinmese de (yerel alıcı, veritabanında olmayan uçak) yayınlanır: hepsi IATA kodlu.
      expect(
        publishDecision(publishState(`${code}123`), {
          scope: 'airline',
          blocklist: new Set(),
          designators,
        }),
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
