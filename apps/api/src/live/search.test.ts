import { EMPTY_AIRLINE_CODES } from '@havayolu/db'
import { describe, expect, it } from 'vitest'
import { FakeLiveSource, publicAircraft, testAirlineCodes } from '../test/helpers'
import { SEARCH_MAX_RESULTS, searchLive } from './search'

const codes = testAirlineCodes()

const source = new FakeLiveSource([
  publicAircraft({ hex: '4bb1a2', cs: 'THY974', reg: 'TC-JJA' }),
  publicAircraft({ hex: '4bb1a3', cs: 'THY9741', reg: 'TC-JJB' }),
  publicAircraft({ hex: '4bb1a4', cs: 'THY0097', reg: 'TC-JJC' }),
  publicAircraft({ hex: '4ba9c1', cs: 'PGT123', reg: 'TC-NBA' }),
  publicAircraft({ hex: '4bc811', cs: 'TKJ7', reg: 'TC-OAA' }),
  publicAircraft({ hex: '4bc812', cs: 'VLU7', reg: 'TC-VLA' }),
  publicAircraft({ hex: '4bc813', cs: 'TKJ77', reg: 'TC-OAB' }),
  publicAircraft({ hex: '3c6444', cs: 'DLH1HN', reg: 'D-AIZZ' }),
  publicAircraft({ hex: '~a1b2c3', cs: null, reg: null }),
  publicAircraft({ hex: 'abc123', cs: 'ACA123', reg: 'C-FABC' }),
  publicAircraft({ hex: '4bb0f0', cs: 'TCOIL', reg: null }),
])
const hexes = (result: ReturnType<typeof searchLive>) => result.results.map((a) => a.hex)

describe('searchLive', () => {
  it('hex: tam eşleşme, büyük/küçük harf ve ~ öneki', () => {
    expect(searchLive('4BB1A2', source, codes)).toMatchObject({ kind: 'hex' })
    expect(hexes(searchLive(' 4bb1a2 ', source, codes))).toEqual(['4bb1a2'])
    expect(hexes(searchLive('~A1B2C3', source, codes))).toEqual(['~a1b2c3'])
  })

  it('hex gibi görünen ama uçak bulunmayan sorgu çağrı koduna düşer', () => {
    const result = searchLive('ACA123', source, codes)
    // "abc123" hex'i yok ama ACA123 çağrı kodu var; hex eşleşmesi önce denenir.
    expect(result).toMatchObject({ kind: 'callsign' })
    expect(hexes(result)).toEqual(['abc123'])
    expect(hexes(searchLive('abc123', source, codes))).toEqual(['abc123'])
  })

  it('tescil: tireli ya da tiresiz, tam eşleşme', () => {
    expect(searchLive('tc-jja', source, codes)).toMatchObject({ kind: 'registration' })
    expect(hexes(searchLive('TC-JJA', source, codes))).toEqual(['4bb1a2'])
    expect(hexes(searchLive('TCJJA', source, codes))).toEqual(['4bb1a2'])
    expect(hexes(searchLive('D-AIZZ', source, codes))).toEqual(['3c6444'])
    // Son çare: tiresiz yabancı tescil.
    expect(searchLive('DAIZZ', source, codes)).toMatchObject({
      kind: 'registration',
      results: [{ hex: '3c6444' }],
    })
    // Tescil önek eşleşmesi yapmaz.
    expect(searchLive('TC-JJ', source, codes)).toMatchObject({ kind: 'registration', results: [] })
  })

  it('sefer no: IATA → ICAO adayları; tam eşleşme önce, sonra önek', () => {
    const result = searchLive('TK974', source, codes)
    expect(result.kind).toBe('flight')
    expect(hexes(result)).toEqual(['4bb1a2', '4bb1a3'])
    for (const q of ['tk 974', 'TK-974', 'TK0974']) {
      expect(hexes(searchLive(q, source, codes)), q).toEqual(['4bb1a2', '4bb1a3'])
    }
    // Çağrı kodundaki baştaki sıfırlar da yok sayılır (THY0097 → TK97).
    expect(hexes(searchLive('TK97', source, codes))).toEqual(['4bb1a4', '4bb1a2', '4bb1a3'])
    expect(hexes(searchLive('PC123', source, codes))).toEqual(['4ba9c1'])
  })

  it('VF iki ICAO koduna karşılık gelir: iki aday da denenir', () => {
    const result = searchLive('VF7', source, codes)
    expect(result.kind).toBe('flight')
    // Tam eşleşenler (TKJ7, VLU7) önce, sonra önek (TKJ77); her grup çağrı koduna göre sıralı.
    expect(result.results.map((a) => a.cs)).toEqual(['TKJ7', 'VLU7', 'TKJ77'])
  })

  it('bilinmeyen IATA kodu ya da kod eşlemesi yoksa sefer no denenmez', () => {
    expect(searchLive('TK974', source, EMPTY_AIRLINE_CODES)).toMatchObject({
      kind: 'callsign',
      results: [],
    })
    expect(searchLive('XQ974', source, codes).kind).toBe('callsign')
  })

  it('çağrı kodu: 3 harf + rakam tam eşleşme (baştaki sıfır yok sayılır), sonra önek', () => {
    const exact = searchLive('THY974', source, codes)
    expect(exact.kind).toBe('callsign')
    expect(exact.results.map((a) => a.cs)).toEqual(['THY974', 'THY9741'])
    expect(searchLive('THY0974', source, codes).results.map((a) => a.cs)).toEqual([
      'THY974',
      'THY9741',
    ])
    expect(searchLive('THY97', source, codes).results.map((a) => a.cs)).toEqual([
      'THY0097',
      'THY974',
      'THY9741',
    ])
  })

  it('çağrı kodu öneki en az 3 karakter; sonuç sıralı', () => {
    expect(searchLive('thy', source, codes).results.map((a) => a.cs)).toEqual([
      'THY0097',
      'THY974',
      'THY9741',
    ])
    expect(searchLive('TC', source, codes)).toEqual({ kind: 'none', results: [] })
    expect(searchLive('TCO', source, codes).results.map((a) => a.cs)).toEqual(['TCOIL'])
    expect(searchLive('DLH1', source, codes).results.map((a) => a.cs)).toEqual(['DLH1HN'])
  })

  it('boş ya da yorumlanamayan sorgu none döner', () => {
    expect(searchLive('', source, codes)).toEqual({ kind: 'none', results: [] })
    expect(searchLive('   ', source, codes)).toEqual({ kind: 'none', results: [] })
    expect(searchLive('X', source, codes)).toEqual({ kind: 'none', results: [] })
  })

  it('en fazla 20 sonuç döner, tam eşleşme her zaman ilk sıradadır', () => {
    const many = new FakeLiveSource(
      Array.from({ length: 30 }, (_, i) =>
        publicAircraft({
          hex: `4b00${String(29 - i).padStart(2, '0')}`,
          cs: i === 0 ? 'THY1' : `THY1${i}`,
        }),
      ),
    )
    const result = searchLive('THY1', many, codes)
    expect(result.results).toHaveLength(SEARCH_MAX_RESULTS)
    expect(result.results[0]?.cs).toBe('THY1')
  })

  it('kaynakta olmayan (gizli) uçak hiçbir aramada çıkmaz', () => {
    const hidden = new FakeLiveSource([publicAircraft({ hex: '4bb1a2' })])
    hidden.aircraft.delete('4bb1a2')
    for (const q of ['4bb1a2', 'TC-JJA', 'TK974', 'THY974', 'THY']) {
      expect(searchLive(q, hidden, codes).results, q).toEqual([])
    }
  })
})
