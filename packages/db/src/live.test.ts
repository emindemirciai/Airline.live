import { describe, expect, it } from 'vitest'
import { hourStart } from './ingest'
import { compactAircraft, LIVE_KEYS, type LiveAircraftInput } from './live'

const base: LiveAircraftInput = {
  hex: '4bb463',
  lat: 41.2748739,
  lon: 28.7321363,
  altBaroFt: 3025,
  onGround: false,
  gsKt: 182.6,
  trackDeg: 354.4,
  sampleTime: 1_790_000_000_500,
  dbFlags: 0,
}

describe('compactAircraft', () => {
  it('koordinatı 5 ondalığa, hızı ve yönü tam sayıya yuvarlar', () => {
    expect(compactAircraft(base)).toEqual([
      '4bb463',
      41.27487,
      28.73214,
      3025,
      0,
      183,
      354,
      1_790_000_000_500,
      0,
    ])
  })

  it('bilinmeyen değerler null kalır; yerdeki uçak 1 olur', () => {
    expect(
      compactAircraft({
        ...base,
        altBaroFt: null,
        onGround: true,
        gsKt: null,
        trackDeg: null,
        dbFlags: null,
      }),
    ).toEqual(['4bb463', 41.27487, 28.73214, null, 1, null, null, 1_790_000_000_500, null])
  })

  it('yuvarlanınca 360 olan yön 0 yazılır; negatif koordinat korunur', () => {
    const tuple = compactAircraft({ ...base, trackDeg: 359.7, lat: -12.345678, lon: -0.000004 })
    expect(tuple[6]).toBe(0)
    expect(tuple[1]).toBe(-12.34568)
    expect(Math.abs(tuple[2])).toBe(0)
  })

  it('sonlu olmayan irtifa ve hız boş yazılır', () => {
    const tuple = compactAircraft({ ...base, altBaroFt: Number.NaN, gsKt: Infinity })
    expect(tuple[3]).toBeNull()
    expect(tuple[5]).toBeNull()
  })
})

describe('LIVE_KEYS', () => {
  it('bütün anahtarlar projenin hy: önekini taşır', () => {
    expect(LIVE_KEYS.aircraft('abc123')).toBe('hy:ac:abc123')
    expect(LIVE_KEYS.provider('adsbLol')).toBe('hy:provider:adsbLol')
    for (const key of [
      LIVE_KEYS.geo,
      LIVE_KEYS.seen,
      LIVE_KEYS.updates,
      LIVE_KEYS.batch,
      LIVE_KEYS.regions,
    ]) {
      expect(key.startsWith('hy:')).toBe(true)
    }
  })
})

describe('hourStart', () => {
  it('UTC saat başına indirir', () => {
    expect(hourStart(new Date('2026-01-20T10:59:59.999Z')).toISOString()).toBe(
      '2026-01-20T10:00:00.000Z',
    )
    expect(hourStart(new Date('2026-01-20T10:00:00.000Z')).toISOString()).toBe(
      '2026-01-20T10:00:00.000Z',
    )
  })
})
