import {
  MIN_NON_AIRLINE_DESIGNATORS,
  type AircraftState,
  type AirlineDesignator,
  type AirlineDesignators,
} from '@havayolu/providers'
import { describe, expect, it } from 'vitest'
import {
  AIRCRAFT_MEMORY_MS,
  CALLSIGN_MEMORY_MS,
  designatorFloor,
  PUBLISHED_MAX_AGE_MS,
  PublishGate,
} from './publish'

const T0 = Date.UTC(2026, 9, 15, 12)

const state = (hex: string, over: Partial<AircraftState> = {}): AircraftState => ({
  hex,
  nonIcao: false,
  callsign: 'THY974',
  registration: 'TC-JSB',
  typeCode: 'A321',
  category: 'A3',
  dbFlags: 0,
  positionSource: 'adsb_icao',
  lat: 41.2,
  lon: 28.73,
  altBaroFt: 2000,
  onGround: false,
  altGeomFt: 2100,
  navQnhHpa: null,
  gsKt: 160,
  trackDeg: 355,
  trueHeadingDeg: null,
  baroRateFpm: -704,
  geomRateFpm: -640,
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
  sampleTime: T0,
  seenPosS: 0.5,
  source: 'adsbLol',
  ...over,
})

const DESIGNATORS: AirlineDesignators = new Map([
  ['THY', { iata: true, operator: 'airline' }],
  ['PGT', { iata: true, operator: 'airline' }],
])

function airlineGate() {
  const gate = new PublishGate({ scope: 'airline' })
  gate.setBlocklist(new Set())
  gate.setDesignators(DESIGNATORS)
  return gate
}

const hexes = (list: readonly AircraftState[]) => list.map((s) => s.hex)

describe('PublishGate', () => {
  it('yalnızca kuralı tutan örnekler yayınlanır; sayaçlar nedene göre ve anonimdir', () => {
    const gate = airlineGate()
    const { publish, withdraw } = gate.split(
      [
        state('4baa62'),
        state('4bbd2c', { callsign: 'TCOIL', registration: 'TC-OIL', dbFlags: 8 }),
        state('4b0001', { callsign: 'HVK123' }),
        state('4b0002', { category: 'A7' }),
        state('4b0003', { dbFlags: 1 }),
      ],
      T0,
    )
    expect(hexes(publish)).toEqual(['4baa62'])
    expect(withdraw).toEqual([])
    const counters = gate.counters()
    expect(counters.published).toBe(1)
    expect(counters.withdrawn).toBe(0)
    expect(gate.droppedNonZero()).toEqual({
      pia_ladd: 1,
      denied_designator: 1,
      category: 1,
      military: 1,
    })
    // Sayaçlarda hex, çağrı kodu ya da tescil yoktur.
    const text = JSON.stringify(counters)
    for (const secret of ['4baa62', '4bbd2c', 'TCOIL', 'TC-OIL', 'HVK123', 'THY974']) {
      expect(text).not.toContain(secret)
    }
  })

  it('çağrı kodsuz örnek 10 dk içinde hatırlanan çağrı koduyla karar alır; örnek değişmez', () => {
    const gate = airlineGate()
    expect(hexes(gate.split([state('4baa62')], T0).publish)).toEqual(['4baa62'])
    const silent = state('4baa62', { callsign: null, sampleTime: T0 + 60_000 })
    const { publish } = gate.split([silent], T0 + 60_000)
    expect(publish).toEqual([silent])
    expect(publish[0]?.callsign).toBeNull()

    // Hafıza süresi dolunca çağrı kodsuz örnek yayınlanmaz ve yayından çekilir.
    const late = state('4baa62', { callsign: null, sampleTime: T0 + CALLSIGN_MEMORY_MS + 1 })
    const after = gate.split([late], T0 + CALLSIGN_MEMORY_MS + 1)
    expect(after.publish).toEqual([])
    expect(after.withdraw).toEqual(['4baa62'])
    expect(gate.droppedNonZero()).toEqual({ no_callsign: 1 })
  })

  it('yayınlanmayan örneğin çağrı kodu da hatırlanır', () => {
    const gate = new PublishGate({ scope: 'airline' })
    gate.setDesignators(DESIGNATORS)
    // Engel listesi henüz okunmadı: yayın yok ama çağrı kodu öğrenilir.
    expect(gate.split([state('4baa62')], T0).publish).toEqual([])
    expect(gate.droppedNonZero()).toEqual({ blocklist_unavailable: 1 })
    gate.setBlocklist(new Set())
    const silent = state('4baa62', { callsign: '  ', sampleTime: T0 + 1_000 })
    expect(gate.split([silent], T0 + 1_000).publish).toEqual([silent])
  })

  it('yayınlanmış hex kuralı tutmayınca withdraw’a tam bir kez girer', () => {
    const gate = airlineGate()
    gate.split([state('4baa62'), state('4baa63', { callsign: 'PGT15UE' })], T0)
    const first = gate.split([state('4baa62', { dbFlags: 4, sampleTime: T0 + 1_000 })], T0 + 1_000)
    expect(first).toEqual({ publish: [], withdraw: ['4baa62'] })
    const second = gate.split([state('4baa62', { dbFlags: 4, sampleTime: T0 + 2_000 })], T0 + 2_000)
    expect(second).toEqual({ publish: [], withdraw: [] })
    expect(gate.counters().withdrawn).toBe(1)
    // Engel listesine eklenen yayınlanmış uçak da çekilir.
    gate.setBlocklist(new Set(['4baa63']))
    const blocked = gate.split(
      [state('4baa63', { callsign: 'PGT15UE', sampleTime: T0 + 3_000 })],
      T0 + 3_000,
    )
    expect(blocked.withdraw).toEqual(['4baa63'])
  })

  it('katman kapalıyken hiçbir şey yayınlanmaz, layer_off sayılır; açılınca sürer', () => {
    const gate = airlineGate()
    gate.split([state('4baa62')], T0)
    gate.setLayer(false)
    expect(gate.layerOn()).toBe(false)
    expect(
      gate.split([state('4baa62', { sampleTime: T0 + 1_000 }), state('4baa63')], T0 + 1_000),
    ).toEqual({
      publish: [],
      withdraw: [],
    })
    expect(gate.counters().dropped.layer_off).toBe(2)
    gate.setLayer(true)
    expect(
      hexes(gate.split([state('4baa62', { sampleTime: T0 + 2_000 })], T0 + 2_000).publish),
    ).toEqual(['4baa62'])
  })

  it('sayaçlar birikir; counters() kopya döndürür', () => {
    const gate = airlineGate()
    gate.split([state('4baa62')], T0)
    const snapshot = gate.counters()
    gate.split(
      [state('4baa62', { sampleTime: T0 + 1_000 }), state('4b0003', { dbFlags: 1 })],
      T0 + 1_000,
    )
    expect(snapshot.published).toBe(1)
    expect(snapshot.dropped.military).toBe(0)
    expect(gate.counters().published).toBe(2)
    expect(gate.counters().dropped.military).toBe(1)
  })

  it('prune: eski çağrı kodu hafızası ve 120 sn’dir yayınlanmamış hex silinir', () => {
    const gate = airlineGate()
    gate.split([state('4baa62')], T0)
    gate.prune(T0 + PUBLISHED_MAX_AGE_MS + 1)
    // Yayınlananlar kümesinden düştü: sonraki ret withdraw üretmez (canlı kayıt zaten süpürüldü).
    const later = T0 + PUBLISHED_MAX_AGE_MS + 2
    expect(
      gate.split([state('4baa62', { dbFlags: 4, sampleTime: later })], later).withdraw,
    ).toEqual([])

    const fresh = airlineGate()
    fresh.split([state('4baa63')], T0)
    fresh.prune(T0 + CALLSIGN_MEMORY_MS + 1)
    // Hafıza budandı: pencere içindeki zamanlı çağrı kodsuz örnek de yayınlanmaz.
    const silent = state('4baa63', { callsign: null, sampleTime: T0 + 1_000 })
    expect(fresh.split([silent], T0 + CALLSIGN_MEMORY_MS + 2).publish).toEqual([])
  })

  it('all kapsamı: bayrağı bilinmeyen ve tescil çağrı kodlu uçak yayınlanır, askerî yayınlanmaz', () => {
    const gate = new PublishGate({ scope: 'all' })
    gate.setBlocklist(new Set())
    const { publish } = gate.split(
      [
        state('4baa62', { dbFlags: null }),
        state('4bbd2c', { callsign: 'TCOIL', dbFlags: 8 }),
        state('4b0003', { dbFlags: 1 }),
      ],
      T0,
    )
    expect(hexes(publish)).toEqual(['4baa62', '4bbd2c'])
  })
})

/** `airline` sayıda havayolu ve `nonAirline` sayıda `non_airline` işletmeciden oluşan tablo. */
function designatorTable(airline: number, nonAirline: number): AirlineDesignators {
  const out = new Map<string, AirlineDesignator>([
    ['THY', { iata: true, operator: 'airline' }],
    ['PGT', { iata: true, operator: 'airline' }],
    ['EAF', { iata: false, operator: 'airline' }],
  ])
  for (let i = 0; i < airline + nonAirline; i += 1) {
    out.set(`Z${String(i).padStart(4, '0')}`, {
      iata: false,
      operator: i < nonAirline ? 'non_airline' : 'airline',
    })
  }
  return out
}

describe('PublishGate.offerDesignators (VRS desen sütunu kaybolursa, D-115)', () => {
  it('alt sınır yalnız üretimde', () => {
    expect(designatorFloor('production')).toBe(MIN_NON_AIRLINE_DESIGNATORS)
    expect(designatorFloor('development')).toBe(0)
    expect(designatorFloor('test')).toBe(0)
  })

  it('üretim: non_airline sayısı alt sınırın altındaki ilk tablo reddedilir, hiçbir şey yayınlanmaz', () => {
    const gate = new PublishGate({ scope: 'airline' })
    gate.setBlocklist(new Set())
    const floor = designatorFloor('production')
    expect(gate.offerDesignators(designatorTable(5_000, 0), floor)).toEqual({
      accepted: false,
      nonAirline: 0,
      previousNonAirline: 0,
    })
    expect(gate.designatorCount()).toBe(0)
    expect(gate.split([state('4baa62')], T0).publish).toEqual([])
    expect(gate.droppedNonZero()).toEqual({ designators_unavailable: 1 })

    expect(gate.offerDesignators(designatorTable(5_000, 277), floor).accepted).toBe(true)
    expect(
      hexes(gate.split([state('4baa62', { sampleTime: T0 + 1_000 })], T0 + 1_000).publish),
    ).toEqual(['4baa62'])
  })

  it('sert düşüşte son iyi tablo kalır; yavaş değişim ve boş tablo kabul edilir', () => {
    const gate = airlineGate()
    const floor = designatorFloor('production')
    expect(gate.offerDesignators(designatorTable(5_000, 277), floor).accepted).toBe(true)
    const size = gate.designatorCount()
    // 277'nin %80'i 221: 220 reddedilir, tablo değişmez.
    expect(gate.offerDesignators(designatorTable(4_000, 220), floor)).toEqual({
      accepted: false,
      nonAirline: 220,
      previousNonAirline: 277,
    })
    expect(gate.designatorCount()).toBe(size)
    expect(gate.offerDesignators(designatorTable(4_000, 230), floor).accepted).toBe(true)
    expect(gate.designatorCount()).toBe(4_233)
    // Boş tablo (havayolu tablosu boşaltıldı): kabul edilir, hiçbir şey yayınlanmaz.
    expect(gate.offerDesignators(new Map(), floor).accepted).toBe(true)
    expect(gate.designatorCount()).toBe(0)
  })

  it('geliştirme ve test: küçük tablo kabul edilir, oran yine uygulanır', () => {
    const gate = new PublishGate({ scope: 'airline' })
    expect(gate.offerDesignators(DESIGNATORS, designatorFloor('test')).accepted).toBe(true)
    expect(gate.offerDesignators(designatorTable(0, 10), 0).accepted).toBe(true)
    expect(gate.offerDesignators(designatorTable(5, 7), 0).accepted).toBe(false)
  })
})

describe('PublishGate uçak hafızası (tescil, tip, kategori)', () => {
  /** Veritabanısız yerel alıcının karesi: tescil, tip ve kategori yok. */
  const local = (hex: string, sampleTime: number, over: Partial<AircraftState> = {}) =>
    state(hex, {
      registration: null,
      typeCode: null,
      category: null,
      source: 'localReceiver',
      sampleTime,
      ...over,
    })

  it('adsb.lol’ün iş jeti dediği uçak tipsiz yerel karelerden yayınlanmaz', () => {
    const gate = airlineGate()
    const jet = state('4b0010', { callsign: 'PGT15', typeCode: 'GLF6' })
    expect(gate.split([jet], T0).publish).toEqual([])
    expect(gate.split([local('4b0010', T0 + 1_000)], T0 + 1_000).publish).toEqual([])
    expect(gate.droppedNonZero()).toEqual({ business_jet_type: 2 })
    // Hafızası olmayan kapı aynı kareyi yayınlardı (IATA kodlu işletmeci, tip bilinmiyor).
    expect(hexes(airlineGate().split([local('4b0010', T0 + 1_000)], T0 + 1_000).publish)).toEqual([
      '4b0010',
    ])
  })

  it('kategori ve tescil de hatırlanır: helikopter ve tescil çağrı kodlu uçak sızmaz', () => {
    const gate = airlineGate()
    gate.split(
      [
        state('4b0011', { category: 'A7', typeCode: 'EC35' }),
        state('4b0012', { callsign: 'TCO123', registration: 'TC-O123' }),
      ],
      T0,
    )
    const later = [local('4b0011', T0 + 1_000), local('4b0012', T0 + 1_000, { callsign: 'TCO123' })]
    expect(gate.split(later, T0 + 1_000).publish).toEqual([])
    expect(gate.droppedNonZero()).toEqual({ category: 2, callsign_is_registration: 2 })
  })

  it('observe, LatestStore’un eski diye reddettiği örnekten de öğrenir', () => {
    const gate = airlineGate()
    // Yerel alıcının daha yeni karesi önce kabul edildi; adsb.lol'ün eski örneği split'e hiç gelmez.
    gate.observe([state('4b0013', { typeCode: 'FA7X', sampleTime: T0 - 2_000 })], T0)
    expect(gate.split([local('4b0013', T0)], T0).publish).toEqual([])
    expect(gate.droppedNonZero()).toEqual({ business_jet_type: 1 })
  })

  it('örneğin kendi dolu alanı kazanır; eski örnek yeni değeri ezmez', () => {
    const gate = airlineGate()
    gate.observe([state('4b0014', { typeCode: 'A321', sampleTime: T0 })], T0)
    gate.observe([state('4b0014', { typeCode: 'GLF5', sampleTime: T0 - 5_000 })], T0)
    expect(hexes(gate.split([local('4b0014', T0 + 1_000)], T0 + 1_000).publish)).toEqual(['4b0014'])
    // A0 "bilgi yok"tur: hatırlanan kategori kullanılır.
    gate.observe([state('4b0015', { category: 'A7', sampleTime: T0 })], T0)
    expect(
      gate.split([local('4b0015', T0 + 1_000, { category: 'A0' })], T0 + 1_000).publish,
    ).toEqual([])
    // Yayınlanan örnek değişmez: hatırlanan alanlar yalnız karar içindir.
    const sample = local('4b0014', T0 + 2_000)
    expect(gate.split([sample], T0 + 2_000).publish).toEqual([sample])
  })

  it('hafıza 24 saatte dolar ve prune ile silinir', () => {
    expect(AIRCRAFT_MEMORY_MS).toBe(24 * 3_600_000)
    const gate = new PublishGate({ scope: 'airline', aircraftMemoryMs: 60_000 })
    gate.setBlocklist(new Set())
    gate.setDesignators(DESIGNATORS)
    gate.observe([state('4b0016', { typeCode: 'GLF6' })], T0)
    expect(gate.split([local('4b0016', T0 + 59_000)], T0 + 59_000).publish).toEqual([])
    // Süre doldu: karar hafızasız verilir (IATA kodlu işletmecinin tipsiz uçağı yayınlanır).
    expect(hexes(gate.split([local('4b0016', T0 + 61_000)], T0 + 61_000).publish)).toEqual([
      '4b0016',
    ])
    gate.observe([state('4b0017', { typeCode: 'GLF6' })], T0)
    gate.prune(T0 + 61_000)
    expect(hexes(gate.split([local('4b0017', T0 + 30_000)], T0 + 30_000).publish)).toEqual([
      '4b0017',
    ])
  })
})
