import type { AircraftState } from '@havayolu/providers'
import { describe, expect, it } from 'vitest'
import {
  continueFlight,
  decideFlight,
  FLIGHT_GAP_MS,
  GROUND_SPLIT_MS,
  restoredGroundState,
  startFlight,
  type FlightDecision,
  type FlightTrack,
} from './flights'

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
    sampleTime: 0,
    seenPosS: null,
    source: 'adsbLol',
    ...overrides,
  }
}

const MIN = 60_000
const T = 1_700_000_000_000
const air = (minute: number, extra: Partial<AircraftState> = {}) =>
  state({ sampleTime: T + minute * MIN, ...extra })
const ground = (minute: number, extra: Partial<AircraftState> = {}) =>
  state({ sampleTime: T + minute * MIN, onGround: true, altBaroFt: null, gsKt: 0, ...extra })

/** Örnekleri sırayla işler; açılan her kaydın nedenini ve ilk örnek dakikasını döner. */
function run(samples: readonly AircraftState[]) {
  let track: FlightTrack | undefined
  const records: { reason: string; minute: number }[] = []
  for (const s of samples) {
    const decision = decideFlight(track, s)
    if (decision.action === 'new' || track === undefined) {
      track = startFlight(s, track, decision)
      records.push({
        reason: decision.action === 'new' ? decision.reason : 'continue',
        minute: (s.sampleTime - T) / MIN,
      })
    } else {
      track = continueFlight(track, s)
    }
  }
  return { records, track }
}

/** `from`..`to` dakikaları arasında `step` dakikada bir örnek. */
const every = (
  from: number,
  to: number,
  step: number,
  make: (minute: number) => AircraftState,
): AircraftState[] => {
  const out: AircraftState[] = []
  for (let m = from; m <= to; m += step) out.push(make(m))
  return out
}

describe('decideFlight', () => {
  it('ilk örnek yeni kayıttır', () => {
    expect(decideFlight(undefined, air(0))).toEqual({ action: 'new', reason: 'first' })
  })

  it('30 dk’dan uzun boşluk yeni kayıttır; tam 30 dk devamdır', () => {
    const track = startFlight(air(0))
    expect(decideFlight(track, air(30))).toEqual({ action: 'continue' })
    expect(decideFlight(track, state({ sampleTime: T + FLIGHT_GAP_MS + 1 }))).toEqual({
      action: 'new',
      reason: 'gap',
    })
  })

  it('iki dolu çağrı kodu arasındaki değişim yeni kayıttır; boşluk ve harf farkı değildir', () => {
    const track = startFlight(air(0, { callsign: 'THY4' }))
    expect(decideFlight(track, air(1, { callsign: 'THY5' }))).toEqual({
      action: 'new',
      reason: 'callsign',
    })
    expect(decideFlight(track, air(1, { callsign: ' thy4 ' }))).toEqual({ action: 'continue' })
    expect(decideFlight(track, air(1, { callsign: null }))).toEqual({ action: 'continue' })
    expect(decideFlight(track, air(1, { callsign: '' }))).toEqual({ action: 'continue' })
  })

  it('çağrı kodu bilinmeyen kayıt, gelen ilk çağrı koduyla devam eder', () => {
    const { records, track } = run([air(0, { callsign: null }), air(1, { callsign: 'PGT12' })])
    expect(records).toEqual([{ reason: 'first', minute: 0 }])
    expect(track?.callsign).toBe('PGT12')
  })
})

describe('çağrı kodunun boşalıp dolması', () => {
  it('aynı çağrı koduyla yeniden dolması yeni kayıt değildir', () => {
    const { records, track } = run([
      air(0, { callsign: 'THY4' }),
      air(1, { callsign: null }),
      air(2, { callsign: null }),
      air(3, { callsign: 'THY4' }),
    ])
    expect(records).toHaveLength(1)
    expect(track?.callsign).toBe('THY4')
  })

  it('arada boşalıp başka çağrı koduyla dolması değişimdir (son bilinen dolu kodla kıyas)', () => {
    const { records } = run([
      air(0, { callsign: 'THY4' }),
      air(1, { callsign: null }),
      air(2, { callsign: 'THY5' }),
    ])
    expect(records).toEqual([
      { reason: 'first', minute: 0 },
      { reason: 'callsign', minute: 2 },
    ])
  })
})

describe('yerde 20 dk', () => {
  it('yer beklemesinin 20. dakikasında bir kez bölünür; park eden uçak yeni kayıt üretmez', () => {
    // İniş (0. dk), 3 saat park; örnekler dakikada bir.
    const { records, track } = run([
      ...every(-10, -1, 1, (m) => air(m, { altBaroFt: 3_000 })),
      ...every(0, 180, 1, (m) => ground(m)),
    ])
    expect(records).toEqual([
      { reason: 'first', minute: -10 },
      { reason: 'ground', minute: 20 },
    ])
    expect(track).toMatchObject({
      groundSince: T,
      groundSplitDone: true,
      firstSeen: T + 20 * MIN,
      lastSeen: T + 180 * MIN,
    })
  })

  it('20 dk dolmadan bölünmez; eşik anında bölünür', () => {
    const landed = continueFlight(startFlight(air(-1)), ground(0))
    expect(landed.groundSince).toBe(T)
    const justBefore = continueFlight(landed, ground(19))
    expect(
      decideFlight(justBefore, state({ ...ground(0), sampleTime: T + GROUND_SPLIT_MS - 1 })),
    ).toEqual({ action: 'continue' })
    const decision = decideFlight(justBefore, ground(20))
    expect(decision).toEqual({ action: 'new', reason: 'ground' })
    const next = startFlight(ground(20), justBefore, decision)
    expect(next).toMatchObject({ id: null, groundSince: T, groundSplitDone: true })
    expect(decideFlight(next, ground(45))).toEqual({ action: 'continue' })
  })

  it('havalanınca yer sayacı sıfırlanır; sonraki yer beklemesi yeniden bölünebilir', () => {
    const { records, track } = run([
      ...every(0, 30, 1, (m) => ground(m)),
      ...every(31, 60, 1, (m) => air(m, { altBaroFt: 5_000 })),
      ...every(61, 90, 1, (m) => ground(m)),
    ])
    expect(records).toEqual([
      { reason: 'first', minute: 0 },
      { reason: 'ground', minute: 20 },
      { reason: 'ground', minute: 81 },
    ])
    expect(track?.groundSince).toBe(T + 61 * MIN)
  })

  it('havadaki örnek bekleme durumunu sıfırlar', () => {
    const split = startFlight(ground(20), continueFlight(startFlight(ground(0)), ground(19)), {
      action: 'new',
      reason: 'ground',
    })
    const airborne = continueFlight(split, air(25, { altBaroFt: 1_500 }))
    expect(airborne).toMatchObject({ groundSince: null, groundSplitDone: false })
  })

  it('yerde çağrı kodu değişimi bekleme bölünmesi sayılır; 20 dk kuralı yeniden bölmez', () => {
    const { records, track } = run([
      ...every(0, 5, 1, (m) => ground(m, { callsign: 'THY4' })),
      ...every(6, 120, 1, (m) => ground(m, { callsign: 'THY5' })),
    ])
    expect(records).toEqual([
      { reason: 'first', minute: 0 },
      { reason: 'callsign', minute: 6 },
    ])
    expect(track).toMatchObject({ callsign: 'THY5', groundSince: T, groundSplitDone: true })
  })

  it('20 dk bölünmesinden sonra gelen yeni çağrı kodu yine yeni kayıttır', () => {
    const { records } = run([
      ...every(0, 30, 1, (m) => ground(m, { callsign: 'THY4' })),
      ...every(31, 40, 1, (m) => ground(m, { callsign: 'THY5' })),
    ])
    expect(records.map((r) => r.reason)).toEqual(['first', 'ground', 'callsign'])
  })

  it('yerde 30 dk’dan uzun boşluk yeni bekleme başlatır', () => {
    const before = continueFlight(startFlight(ground(0)), ground(10))
    const decision: FlightDecision = decideFlight(before, ground(50))
    expect(decision).toEqual({ action: 'new', reason: 'gap' })
    expect(startFlight(ground(50), before, decision)).toMatchObject({
      groundSince: T + 50 * MIN,
      groundSplitDone: false,
    })
  })
})

describe('restoredGroundState (açılışta yer bekleme durumu)', () => {
  /** Yeniden başlatma: kaydın durumu satırlardan kurulur, örnekler kaldığı yerden sürer. */
  const restart = (track: FlightTrack, trailingGroundStart: number | null): FlightTrack => ({
    ...track,
    ...restoredGroundState(track.firstSeen, track.lastSeen, trailingGroundStart),
  })

  it('20 dk bölünmesiyle açılmış kayıt yeniden başlatmadan sonra bir daha bölünmez', () => {
    // İnceleme bulgusu: iniş 0. dk, bölünme 20. dk (G kaydı), yayın 25. dk. G'nin satırları
    // 20. dk'da (ilk örnek) başlar ve hepsi yerdedir.
    const { track } = run([
      ...every(-10, -1, 1, (m) => air(m, { altBaroFt: 3_000 })),
      ...every(0, 25, 1, (m) => ground(m)),
    ])
    if (!track) throw new Error('no track')
    const restored = restart(track, T + 20 * MIN)
    expect(restored).toMatchObject({ groundSince: T + 20 * MIN, groundSplitDone: true })
    let current = restored
    for (let m = 26; m <= 90; m += 1) {
      expect(decideFlight(current, ground(m))).toEqual({ action: 'continue' })
      current = continueFlight(current, ground(m))
    }
  })

  it('havada açılıp inen kaydın beklemesi iniş anından sürer ve 20. dakikada bölünür', () => {
    const { track } = run([
      ...every(-10, -1, 1, (m) => air(m, { altBaroFt: 3_000 })),
      ...every(0, 5, 1, (m) => ground(m)),
    ])
    if (!track) throw new Error('no track')
    const restored = restart(track, T)
    expect(restored).toMatchObject({ groundSince: T, groundSplitDone: false })
    expect(decideFlight(restored, ground(19))).toEqual({ action: 'continue' })
    expect(decideFlight(restored, ground(20))).toEqual({ action: 'new', reason: 'ground' })
  })

  it('20 dk’dan uzun süren yer dizisi bölünmüş sayılır; son satır havadaysa bekleme yok', () => {
    // Kayıt havada açıldı (satırlar -60. dk'dan), yer dizisi 25 dk önce başladı ama kayıt
    // bölünmedi: bellekteki durum bölünmüş olmalıydı.
    const first = T - 60 * MIN
    expect(restoredGroundState(first, T, T - 25 * MIN)).toEqual({
      groundSince: T - 25 * MIN,
      groundSplitDone: true,
    })
    expect(restoredGroundState(first, T, T - 5 * MIN)).toEqual({
      groundSince: T - 5 * MIN,
      groundSplitDone: false,
    })
    expect(restoredGroundState(first, T, null)).toEqual({
      groundSince: null,
      groundSplitDone: false,
    })
  })
})

describe('startFlight ve continueFlight', () => {
  it('ilk kayıt örnekten kurulur', () => {
    expect(startFlight(air(0))).toEqual({
      id: null,
      hex: '4bb1c3',
      callsign: 'THY4',
      registration: 'TC-JJE',
      typeCode: 'B77W',
      firstSeen: T,
      lastSeen: T,
      groundSince: null,
      groundSplitDone: false,
    })
    expect(startFlight(ground(0))).toMatchObject({ groundSince: T, groundSplitDone: false })
    expect(startFlight(air(0, { callsign: '' })).callsign).toBeNull()
  })

  it('yeni kayıt, örnekte olmayan tescil ve tipi aynı uçağın önceki kaydından alır', () => {
    const prev = { ...startFlight(air(0)), id: 42 }
    const sample = air(1, { callsign: 'THY5', registration: null, typeCode: null })
    const next = startFlight(sample, prev, decideFlight(prev, sample))
    expect(next).toMatchObject({
      id: null,
      callsign: 'THY5',
      registration: 'TC-JJE',
      typeCode: 'B77W',
      firstSeen: T + MIN,
    })
    const stranger = startFlight(state({ hex: 'aaaaaa', registration: null }), prev)
    expect(stranger.registration).toBeNull()
  })

  it('devam: lastSeen geri gitmez, dolu alanlar güncellenir, boşlar korunur', () => {
    const track = { ...startFlight(air(0, { registration: null, typeCode: null })), id: 7 }
    const next = continueFlight(
      track,
      air(2, { callsign: null, registration: 'TC-JJE', typeCode: null }),
    )
    expect(next).toMatchObject({
      id: 7,
      callsign: 'THY4',
      registration: 'TC-JJE',
      typeCode: null,
      firstSeen: T,
      lastSeen: T + 2 * MIN,
    })
    expect(continueFlight(next, air(1)).lastSeen).toBe(T + 2 * MIN)
  })
})
