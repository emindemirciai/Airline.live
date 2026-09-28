import { EMPTY_AIRLINE_CODES } from '@havayolu/db'
import { describe, expect, it } from 'vitest'
import { aircraftState, testAirlineCodes } from '../test/helpers'
import { flightNumberOf, toPublicAircraft } from './record'

const codes = testAirlineCodes()

describe('toPublicAircraft', () => {
  it('saklanan kaydı herkese açık biçime çevirir ve yuvarlar', () => {
    const state = aircraftState({ lat: 41.2753456, lon: 28.7519444 })
    expect(toPublicAircraft(state, codes)).toEqual({
      hex: '4bb1a2',
      lat: 41.27535,
      lon: 28.75194,
      alt: 12_000,
      gnd: false,
      gs: 310,
      trk: 179.4,
      vr: -1_216,
      cs: 'THY974',
      fn: { airline: 'TK', number: '974' },
      reg: 'TC-JJA',
      type: 'B77W',
      cat: 'A5',
      sq: '2301',
      src: 'adsbLol',
      psrc: 'adsb_icao',
      t: state.sampleTime,
    })
  })

  it('JSON gidiş dönüşünden (redis-live) sonra da aynı sonucu verir', () => {
    const state = aircraftState()
    const raw = JSON.parse(JSON.stringify(state)) as unknown
    expect(toPublicAircraft(raw, codes)).toEqual(toPublicAircraft(state, codes))
  })

  it('askeri ve bayrağı bilinmeyen uçak gizlidir (D-071)', () => {
    expect(toPublicAircraft(aircraftState({ dbFlags: 1 }), codes)).toBeNull()
    expect(toPublicAircraft(aircraftState({ dbFlags: 1 | 8 }), codes)).toBeNull()
    expect(toPublicAircraft(aircraftState({ dbFlags: null }), codes)).toBeNull()
    const { dbFlags: _omitted, ...withoutFlags } = aircraftState()
    expect(toPublicAircraft(withoutFlags, codes)).toBeNull()
    // "İlginç" bayrağı (2) gizlilik bayrağı değildir.
    expect(toPublicAircraft(aircraftState({ dbFlags: 2 }), codes)?.reg).toBe('TC-JJA')
  })

  it('PIA/LADD uçakta tescil ve tescile eşit çağrı kodu gizlenir', () => {
    const ladd = toPublicAircraft(aircraftState({ dbFlags: 8 }), codes)
    expect(ladd).toMatchObject({ reg: null, cs: 'THY974', fn: { airline: 'TK', number: '974' } })

    const bizjet = toPublicAircraft(
      aircraftState({ dbFlags: 4, callsign: 'TCOIL', registration: 'TC-OIL' }),
      codes,
    )
    expect(bizjet).toMatchObject({ reg: null, cs: null, fn: null })

    const open = toPublicAircraft(
      aircraftState({ dbFlags: 0, callsign: 'TCOIL', registration: 'TC-OIL' }),
      codes,
    )
    expect(open).toMatchObject({ reg: 'TC-OIL', cs: 'TCOIL', fn: null })
  })

  it('dikey hız barometrikten, yoksa geometrikten gelir', () => {
    expect(toPublicAircraft(aircraftState({ baroRateFpm: null }), codes)?.vr).toBe(-1_200)
    expect(
      toPublicAircraft(aircraftState({ baroRateFpm: null, geomRateFpm: null }), codes)?.vr,
    ).toBeNull()
  })

  it('yerdeki uçak: irtifa null, gnd true', () => {
    expect(
      toPublicAircraft(aircraftState({ onGround: true, altBaroFt: null }), codes),
    ).toMatchObject({ alt: null, gnd: true })
  })

  it('bozuk kayıt reddedilir', () => {
    const bad: unknown[] = [
      null,
      'THY974',
      [],
      { ...aircraftState(), hex: '4BB1A2' },
      { ...aircraftState(), hex: 'zzzzzz' },
      { ...aircraftState(), lat: 91 },
      { ...aircraftState(), lon: '28.7' },
      { ...aircraftState(), sampleTime: undefined },
      { ...aircraftState(), source: 'opensky' },
      { ...aircraftState(), onGround: 'false' },
      { ...aircraftState(), dbFlags: -1 },
      { ...aircraftState(), dbFlags: 1.5 },
      { ...aircraftState(), gsKt: '310' },
    ]
    for (const raw of bad) expect(toPublicAircraft(raw, codes), JSON.stringify(raw)).toBeNull()
  })

  it('eksik görüntü alanları null sayılır; ICAO dışı adres geçerlidir', () => {
    const { squawk: _s, category: _c, typeCode: _t, ...rest } = aircraftState({ hex: '~a1b2c3' })
    expect(toPublicAircraft(rest, codes)).toMatchObject({
      hex: '~a1b2c3',
      sq: null,
      cat: null,
      type: null,
    })
  })
})

describe('flightNumberOf', () => {
  it('ICAO kodunun IATA karşılığı varsa sefer no çıkarır; baştaki sıfırlar atılır', () => {
    expect(flightNumberOf('THY974', codes)).toEqual({ airline: 'TK', number: '974' })
    expect(flightNumberOf('PGT0123', codes)).toEqual({ airline: 'PC', number: '123' })
    expect(flightNumberOf('TKJ7', codes)).toEqual({ airline: 'VF', number: '7' })
    expect(flightNumberOf('thy4', codes)).toEqual({ airline: 'TK', number: '4' })
  })

  it('rakamsız, harf sonekli, uzun ya da bilinmeyen havayolu çağrı kodu sefer no değildir', () => {
    for (const callsign of [
      'THY',
      'THY0',
      'THY12345',
      'THY4AB',
      'THY4A',
      'TCOIL',
      'N123AB',
      'XYZ12',
    ]) {
      expect(flightNumberOf(callsign, codes), callsign).toBeNull()
    }
    expect(flightNumberOf(null, codes)).toBeNull()
    expect(flightNumberOf('THY974', EMPTY_AIRLINE_CODES)).toBeNull()
  })
})
