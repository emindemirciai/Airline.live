import { describe, expect, it } from 'vitest'
import { aircraft, STATUS } from './test/fakes'
import { isAirport, isLiveStatus, isPublicAircraft, parseServerMessage } from './validate'

const text = (value: unknown) => JSON.stringify(value)

describe('isPublicAircraft', () => {
  it('API kaydını kabul eder, eksik ya da yanlış tipli alanı reddeder', () => {
    expect(isPublicAircraft(aircraft())).toBe(true)
    expect(isPublicAircraft(aircraft({ fn: null, cs: null, reg: null, alt: null, gs: null }))).toBe(
      true,
    )
    const { psrc: _psrc, ...withoutPsrc } = aircraft()
    for (const bad of [
      null,
      [],
      withoutPsrc,
      { ...aircraft(), hex: '' },
      { ...aircraft(), lat: 91 },
      { ...aircraft(), lon: Number.NaN },
      { ...aircraft(), gnd: 'false' },
      { ...aircraft(), fn: { airline: 'TK' } },
      { ...aircraft(), src: 'opensky' },
      { ...aircraft(), t: '1000' },
    ]) {
      expect(isPublicAircraft(bad), JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('isLiveStatus', () => {
  it('bilinen sağlayıcı ve durumları kabul eder', () => {
    expect(isLiveStatus(STATUS)).toBe(true)
    expect(isLiveStatus({ providers: {}, primaryAgeS: null, newestAgeS: null })).toBe(true)
    expect(isLiveStatus({ providers: { adsbLol: 'late' }, primaryAgeS: 1, newestAgeS: 1 })).toBe(
      false,
    )
    expect(isLiveStatus({ providers: {}, primaryAgeS: '1', newestAgeS: null })).toBe(false)
  })

  it('canlı katman (D-115): yok, on ve off kabul edilir; başka değer reddedilir', () => {
    const base = { providers: {}, primaryAgeS: null, newestAgeS: null }
    expect(isLiveStatus(base)).toBe(true)
    expect(isLiveStatus({ ...base, layer: 'on' })).toBe(true)
    expect(isLiveStatus({ ...base, layer: 'off' })).toBe(true)
    expect(isLiveStatus({ ...base, layer: 'maybe' })).toBe(false)
    expect(isLiveStatus({ ...base, layer: null })).toBe(false)
  })
})

describe('isAirport', () => {
  it('IATA kodu boş olan ya da türü bilinmeyen kaydı reddeder', () => {
    const ok = {
      icao: 'LTAC',
      iata: 'ESB',
      name: 'Esenboğa',
      city: null,
      lat: 40.1,
      lon: 32.9,
      elevationFt: null,
      type: 'large_airport',
      scheduled: true,
    }
    expect(isAirport(ok)).toBe(true)
    expect(isAirport({ ...ok, iata: '' })).toBe(false)
    expect(isAirport({ ...ok, type: 'closed' })).toBe(false)
    expect(isAirport({ ...ok, scheduled: 'yes' })).toBe(false)
  })
})

describe('parseServerMessage', () => {
  it('tam görüntüyü çözer, hatalı uçak kayıtlarını atlar', () => {
    const message = parseServerMessage(
      text({
        type: 'snapshot',
        seq: 7,
        coverage: 'partial',
        status: STATUS,
        aircraft: [aircraft(), { hex: 'x' }],
      }),
    )
    expect(message).toEqual({
      type: 'snapshot',
      seq: 7,
      coverage: 'partial',
      status: STATUS,
      aircraft: [aircraft()],
    })
  })

  it('farkı hücreleriyle çözer', () => {
    const cell = { c: '20:14', added: [aircraft()], updated: [], removed: ['aaaaaa'] }
    expect(
      parseServerMessage(text({ type: 'diff', seq: 8, status: STATUS, cells: [cell] })),
    ).toEqual({ type: 'diff', seq: 8, status: STATUS, cells: [cell] })
  })

  it('reconnect ve error mesajlarını çözer', () => {
    expect(parseServerMessage(text({ type: 'reconnect', afterMs: 4_200 }))).toEqual({
      type: 'reconnect',
      afterMs: 4_200,
    })
    expect(parseServerMessage(text({ type: 'error', code: 'bad_request' }))).toEqual({
      type: 'error',
      code: 'bad_request',
    })
  })

  it('bozuk, eksik ya da tanınmayan mesajda null döner', () => {
    for (const input of [
      42,
      null,
      '{',
      text([]),
      text({ type: 'ping' }),
      text({ type: 'snapshot', seq: -1, coverage: 'full', status: STATUS, aircraft: [] }),
      text({ type: 'snapshot', seq: 1.5, coverage: 'full', status: STATUS, aircraft: [] }),
      text({ type: 'snapshot', seq: 1, coverage: 'most', status: STATUS, aircraft: [] }),
      text({ type: 'snapshot', seq: 1, coverage: 'full', status: STATUS, aircraft: {} }),
      text({ type: 'diff', seq: 1, status: STATUS, cells: [{ c: '1:1', added: [] }] }),
      text({
        type: 'diff',
        seq: 1,
        status: STATUS,
        cells: [{ c: 1, added: [], updated: [], removed: [] }],
      }),
      text({ type: 'diff', seq: 1, status: null, cells: [] }),
      text({ type: 'reconnect', afterMs: -5 }),
      text({ type: 'reconnect' }),
      text({ type: 'error' }),
    ]) {
      expect(parseServerMessage(input), String(input)).toBeNull()
    }
  })
})
