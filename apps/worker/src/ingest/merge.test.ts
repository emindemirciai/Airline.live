import type { AircraftState } from '@havayolu/providers'
import { describe, expect, it } from 'vitest'
import { FLAGS_MEMORY_MS, LatestStore } from './merge'

/** Test örneği: seyirdeki bir uçak; alanlar `overrides` ile değiştirilir. */
function state(overrides: Partial<AircraftState> = {}): AircraftState {
  return {
    hex: '4bb1c3',
    nonIcao: false,
    callsign: 'THY4',
    registration: 'TC-JJE',
    typeCode: 'B77W',
    category: 'A5',
    dbFlags: 0,
    positionSource: 'adsb_icao',
    lat: 41.2,
    lon: 28.7,
    altBaroFt: 35_000,
    onGround: false,
    altGeomFt: 35_500,
    navQnhHpa: null,
    gsKt: 450,
    trackDeg: 90,
    trueHeadingDeg: null,
    baroRateFpm: 0,
    geomRateFpm: null,
    iasKt: null,
    tasKt: null,
    mach: null,
    windDirDeg: null,
    windSpeedKt: null,
    oatC: null,
    selAltFt: null,
    navModes: [],
    squawk: null,
    emergency: null,
    sampleTime: 1_000_000,
    source: 'adsbLol',
    ...overrides,
  }
}

const T = 1_000_000

describe('LatestStore.accept', () => {
  it('ilk partide hepsini, hex’in ilk göründüğü sırayla kabul eder', () => {
    const store = new LatestStore()
    const a = state({ hex: 'aaaaaa' })
    const b = state({ hex: 'bbbbbb' })
    expect(store.accept([a, b], T)).toEqual([a, b])
    expect(store.size()).toBe(2)
    expect(store.get('aaaaaa')).toBe(a)
    expect(store.get('cccccc')).toBeUndefined()
  })

  it('partide aynı hex’ten en yeni örnek kalır; sırası ilk görünüşündür', () => {
    const store = new LatestStore()
    const old = state({ hex: 'aaaaaa', sampleTime: T })
    const other = state({ hex: 'bbbbbb' })
    const fresh = state({ hex: 'aaaaaa', sampleTime: T + 2_000, lat: 41.3 })
    const older = state({ hex: 'aaaaaa', sampleTime: T - 5_000 })
    expect(store.accept([old, other, fresh, older], T + 3_000)).toEqual([fresh, other])
    expect(store.get('aaaaaa')).toBe(fresh)
  })

  it('eşit zaman aynı örnektir: bir kez yazılır, bayrağı bilinen tercih edilir', () => {
    const store = new LatestStore()
    const local = state({ source: 'localReceiver', dbFlags: null })
    const adsbLol = state({ source: 'adsbLol', dbFlags: 8 })
    const accepted = store.accept([local, adsbLol, { ...adsbLol, lat: 1 }], T)
    expect(accepted).toEqual([adsbLol])
    // Sonraki partide aynı örnek (iki çemberden) yeniden gelirse yazılmaz.
    expect(store.accept([adsbLol, local], T + 1_000)).toEqual([])
  })

  it('yalnızca saklanandan kesinlikle yeni örnek kabul edilir', () => {
    const store = new LatestStore()
    store.accept([state({ sampleTime: T })], T)
    expect(store.accept([state({ sampleTime: T - 1 })], T + 1_000)).toEqual([])
    expect(store.accept([state({ sampleTime: T })], T + 1_000)).toEqual([])
    const newer = state({ sampleTime: T + 1, source: 'localReceiver' })
    expect(store.accept([newer], T + 1_000)).toEqual([newer])
    expect(store.get('4bb1c3')).toBe(newer)
  })

  it('null bayrak, aynı hex’in bilinen bayrağıyla doldurulur; girdi değişmez', () => {
    const store = new LatestStore()
    store.accept([state({ dbFlags: 8, sampleTime: T })], T)
    const local = state({ dbFlags: null, sampleTime: T + 1_000, source: 'localReceiver' })
    const [filled] = store.accept([local], T + 1_000)
    expect(filled).toEqual({ ...local, dbFlags: 8 })
    expect(local.dbFlags).toBeNull()
    expect(store.get('4bb1c3')?.dbFlags).toBe(8)
    // Başka hex'e taşınmaz.
    const stranger = state({ hex: 'dddddd', dbFlags: null })
    expect(store.accept([stranger], T + 1_000)).toEqual([stranger])
  })

  it('aynı partideki eski örneğin bayrağı yeni null örneğe taşınır', () => {
    const store = new LatestStore()
    const withFlags = state({ dbFlags: 1, sampleTime: T })
    const local = state({ dbFlags: null, sampleTime: T + 500, source: 'localReceiver' })
    expect(store.accept([local, withFlags], T + 1_000)).toEqual([{ ...local, dbFlags: 1 }])
  })

  it('en yeni örneğin bayrağı hatırlanır; geç gelen eski örnek onu ezmez', () => {
    const store = new LatestStore()
    store.accept([state({ dbFlags: 0, sampleTime: T })], T)
    store.accept([state({ dbFlags: 4, sampleTime: T + 1_000 })], T + 1_000)
    store.accept([state({ hex: '4bb1c3', dbFlags: 0, sampleTime: T - 60_000 })], T + 1_500)
    const [filled] = store.accept([state({ dbFlags: null, sampleTime: T + 2_000 })], T + 2_000)
    expect(filled?.dbFlags).toBe(4)
  })

  it('bayrak hafızası 24 saattir', () => {
    expect(FLAGS_MEMORY_MS).toBe(86_400_000)
    const store = new LatestStore()
    store.accept([state({ dbFlags: 8, sampleTime: T })], T)
    const later = T + FLAGS_MEMORY_MS
    const [kept] = store.accept([state({ dbFlags: null, sampleTime: later })], later)
    expect(kept?.dbFlags).toBe(8)
    const expired = later + FLAGS_MEMORY_MS + 1
    // Bayrak son kez `T`'de görüldü (null örnek bayrağı tazelemez).
    const [unknown] = store.accept([state({ dbFlags: null, sampleTime: expired })], expired)
    expect(unknown?.dbFlags).toBeNull()
  })

  it('hafıza süresi ayarlanabilir', () => {
    const store = new LatestStore({ flagsMemoryMs: 10_000 })
    store.accept([state({ dbFlags: 8, sampleTime: T })], T)
    const [unknown] = store.accept([state({ dbFlags: null, sampleTime: T + 20_000 })], T + 20_000)
    expect(unknown?.dbFlags).toBeNull()
  })
})

describe('LatestStore.prune', () => {
  it('120 sn’den eski son örnekleri siler ve hex’lerini döner', () => {
    const store = new LatestStore()
    store.accept(
      [
        state({ hex: 'aaaaaa', sampleTime: T }),
        state({ hex: 'bbbbbb', sampleTime: T + 60_000 }),
        state({ hex: 'cccccc', sampleTime: T + 119_000 }),
      ],
      T + 119_000,
    )
    expect(store.prune(T + 120_000)).toEqual([])
    expect(store.prune(T + 120_001)).toEqual(['aaaaaa'])
    expect(store.size()).toBe(2)
    expect(store.get('aaaaaa')).toBeUndefined()
    expect(store.prune(T + 200_000, 30_000)).toEqual(['bbbbbb', 'cccccc'])
    expect(store.size()).toBe(0)
  })

  it('silinen uçağın eski örneği yeniden kabul edilir; bayrak hafızası süresince kalır', () => {
    const store = new LatestStore({ flagsMemoryMs: 600_000 })
    store.accept([state({ dbFlags: 8, sampleTime: T })], T)
    store.prune(T + 300_000)
    expect(store.size()).toBe(0)
    const [back] = store.accept([state({ dbFlags: null, sampleTime: T + 300_000 })], T + 300_000)
    expect(back?.dbFlags).toBe(8)
    store.prune(T + 700_000)
    const [again] = store.accept([state({ dbFlags: null, sampleTime: T + 700_000 })], T + 700_000)
    expect(again?.dbFlags).toBeNull()
  })
})
