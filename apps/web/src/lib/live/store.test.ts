import type { LiveDiffCell, LiveDiffMessage, LiveSnapshotMessage } from '@havayolu/shared'
import { describe, expect, it, vi } from 'vitest'
import { liveMaxAgeMs } from './interpolate'
import { AircraftStore, STORE_MAX_AGE_MS, TRAIL_MAX_POINTS, serverLowerBound } from './store'
import { aircraft, STATUS } from './test/fakes'

function snapshot(seq: number, list = [aircraft()]): LiveSnapshotMessage {
  return { type: 'snapshot', seq, coverage: 'full', status: STATUS, aircraft: list }
}

function diff(seq: number, cells: Partial<LiveDiffCell>[]): LiveDiffMessage {
  return {
    type: 'diff',
    seq,
    status: { ...STATUS, newestAgeS: 3 },
    cells: cells.map((cell, i) => ({ c: `${i}:0`, added: [], updated: [], removed: [], ...cell })),
  }
}

describe('AircraftStore — tam görüntü', () => {
  it('kümeyi değiştirir, sayaç, durum ve kapsama değerlerini tutar', () => {
    const store = new AircraftStore()
    expect(store.seq).toBeNull()
    expect(store.status).toBeNull()
    expect(store.coverage).toBeNull()
    store.applySnapshot(snapshot(5, [aircraft(), aircraft({ hex: 'aaaaaa' })]), 10_000)
    expect(store.seq).toBe(5)
    expect(store.status).toEqual(STATUS)
    expect(store.coverage).toBe('full')
    expect(store.list().map((ac) => ac.hex)).toEqual(['4bb1c5', 'aaaaaa'])
    expect(store.get('4bb1c5')?.receivedAt).toBe(10_000)

    store.applySnapshot(snapshot(6, [aircraft({ hex: 'bbbbbb' })]), 11_000)
    expect(store.list().map((ac) => ac.hex)).toEqual(['bbbbbb'])
    expect(store.get('4bb1c5')).toBeUndefined()
  })

  it('hâlâ görünen uçağın izini korur, görünmeyeninkini atar', () => {
    const store = new AircraftStore()
    store.applySnapshot(snapshot(1, [aircraft(), aircraft({ hex: 'aaaaaa' })]), 0)
    store.applySnapshot(
      snapshot(2, [
        aircraft({ lon: 28.8, t: 2_000 }),
        aircraft({ hex: 'aaaaaa', lon: 29, t: 2_000 }),
      ]),
      1_000,
    )
    store.applySnapshot(snapshot(3, [aircraft({ lon: 28.9, t: 3_000 })]), 2_000)
    expect(store.trail('4bb1c5').map((p) => p.lon)).toEqual([28.7, 28.8, 28.9])
    expect(store.trail('aaaaaa')).toEqual([])
  })

  it('aynı örnek yeniden gelirse ilk alınma zamanını korur, yeni örnekte günceller', () => {
    const store = new AircraftStore()
    store.applySnapshot(snapshot(1), 10_000)
    store.applySnapshot(snapshot(2), 14_000)
    expect(store.get('4bb1c5')?.receivedAt).toBe(10_000)
    store.applySnapshot(snapshot(3, [aircraft({ t: 2_000, lon: 28.71 })]), 15_000)
    expect(store.get('4bb1c5')?.receivedAt).toBe(15_000)
  })
})

describe('AircraftStore — fark', () => {
  it('önce bütün silinenleri, sonra eklenen ve güncellenenleri uygular', () => {
    const store = new AircraftStore()
    store.applySnapshot(snapshot(1, [aircraft(), aircraft({ hex: 'aaaaaa' })]), 0)
    // Hücre değiştiren uçak: ilk hücrede eklenmiş, ikinci hücrede silinmiş gelir.
    store.applyDiff(
      diff(2, [
        { added: [aircraft({ lon: 30.01, t: 2_000 })] },
        { removed: ['4bb1c5', 'aaaaaa', 'ffffff'] },
        { added: [aircraft({ hex: 'cccccc' })] },
      ]),
      1_000,
    )
    expect(
      store
        .list()
        .map((ac) => ac.hex)
        .sort(),
    ).toEqual(['4bb1c5', 'cccccc'])
    expect(store.get('4bb1c5')?.lon).toBe(30.01)
    expect(store.seq).toBe(2)
    expect(store.status?.newestAgeS).toBe(3)
    expect(store.coverage).toBe('full')
  })

  it('hücre değiştiren uçağın izini ve alınma zamanını korur', () => {
    const store = new AircraftStore()
    store.applySnapshot(snapshot(1), 0)
    store.applyDiff(diff(2, [{ removed: ['4bb1c5'] }, { added: [aircraft()] }]), 5_000)
    expect(store.get('4bb1c5')?.receivedAt).toBe(0)
    store.applyDiff(
      diff(3, [{ removed: ['4bb1c5'] }, { added: [aircraft({ lon: 28.8, t: 2_000 })] }]),
      6_000,
    )
    expect(store.get('4bb1c5')?.receivedAt).toBe(6_000)
    expect(store.trail('4bb1c5').map((p) => p.lon)).toEqual([28.7, 28.8])
  })

  it('silinen uçağın izini atar; bilinmeyen hex etkisizdir', () => {
    const store = new AircraftStore()
    store.applySnapshot(snapshot(1), 0)
    store.applyDiff(diff(2, [{ removed: ['4bb1c5', '000000'] }]), 1_000)
    expect(store.size).toBe(0)
    expect(store.trail('4bb1c5')).toEqual([])
  })

  it('güncellemeyle bilinmeyen uçak eklenir', () => {
    const store = new AircraftStore()
    store.applyDiff(diff(1, [{ updated: [aircraft({ hex: 'dddddd' })] }]), 1_000)
    expect(store.get('dddddd')?.receivedAt).toBe(1_000)
  })
})

describe('AircraftStore — örnek yaşı (son görülme)', () => {
  // Sunucu saati istemciden 1 saat ileride: yaş hesabı saat kaymasından etkilenmez.
  const SKEW = 3_600_000
  const serverT = (local: number) => local + SKEW

  it('görünüme ilk kez giren eski örnekli uçağın yaşı sunucu saatinden bulunur', () => {
    const store = new AircraftStore()
    const now = 50_000
    store.applySnapshot(
      {
        ...snapshot(1, [
          aircraft({ hex: 'aaaaaa', t: serverT(now) - 2_000 }),
          // Sinyali 100 sn önce kesilen uçak (sunucu önbelleğinde 120 sn kalır).
          aircraft({ hex: 'bbbbbb', t: serverT(now) - 100_000 }),
        ]),
        // Sunucudaki en yeni örnek 2 sn önce alınmış.
        status: { ...STATUS, newestAgeS: 2 },
      },
      now,
    )
    expect(store.get('bbbbbb')?.receivedAt).toBe(now)
    expect(store.get('bbbbbb')?.sampledAt).toBe(now - 100_000)
    expect(store.get('aaaaaa')?.sampledAt).toBe(now - 2_000)
  })

  it('sakin görünümün gevşek alt sınırı iyi tahmini bozmaz; saat ilerledikçe yaş artar', () => {
    const store = new AircraftStore()
    store.applySnapshot(snapshot(1, [aircraft({ hex: 'aaaaaa', t: serverT(10_000) })]), 10_000)
    // 40 sn sonra yalnızca 100 sn'lik örneği olan bir görünüme geçildi.
    store.applySnapshot(
      snapshot(2, [aircraft({ hex: 'bbbbbb', t: serverT(50_000) - 100_000 })]),
      50_000,
    )
    expect(store.get('bbbbbb')?.sampledAt).toBe(50_000 - 100_000 - 1_000)
  })

  it('sunucu saati bilinmeden eklenen örnek, aynı örnek görüntüyle gelince düzelir', () => {
    const store = new AircraftStore()
    const stale = aircraft({ hex: 'bbbbbb', t: serverT(0) - 90_000 })
    // Paylaşılan bağlantı: arama sonucu WebSocket'ten önce geldi.
    store.upsert(stale, 1_000)
    expect(store.get('bbbbbb')?.sampledAt).toBe(1_000)
    store.applySnapshot(snapshot(1, [aircraft({ t: serverT(2_000) }), stale]), 2_000)
    expect(store.get('bbbbbb')?.receivedAt).toBe(1_000)
    // Sunucu saati 2.000 ms'de ≥ t + 1 sn (STATUS.newestAgeS); örnek o andan 93 sn önce.
    expect(store.get('bbbbbb')?.sampledAt).toBe(2_000 - 93_000)
  })

  it('örnek zamanı alınma anından sonra olamaz', () => {
    const store = new AircraftStore()
    store.applySnapshot(snapshot(1, [aircraft({ t: serverT(10_000) })]), 10_000)
    // Başka kaynaktan (saati ileri) gelen örnek.
    store.upsert(aircraft({ hex: 'cccccc', t: serverT(10_000) + 5_000 }), 10_500)
    expect(store.get('cccccc')?.sampledAt).toBe(10_500)
  })

  it('budama örnek yaşına göredir: eski örnekli uçak sunucuyla aynı anda düşer', () => {
    const store = new AircraftStore()
    store.applySnapshot(
      {
        ...snapshot(1, [
          aircraft({ hex: 'aaaaaa', t: serverT(0) }),
          aircraft({ hex: 'bbbbbb', t: serverT(0) - 100_000 }),
        ]),
        status: { ...STATUS, newestAgeS: 0 },
      },
      0,
    )
    store.prune(20_000)
    expect(store.get('bbbbbb')).toBeDefined()
    store.prune(20_001)
    expect(store.get('bbbbbb')).toBeUndefined()
    expect(store.get('aaaaaa')).toBeDefined()
  })

  it('sunucu saati alt sınırı: mesajdaki en yeni örnek + en yeni örneğin yaşı', () => {
    expect(serverLowerBound([aircraft({ t: 5_000 }), aircraft({ t: 7_000 })], STATUS)).toBe(8_000)
    expect(serverLowerBound([aircraft({ t: 5_000 })], { ...STATUS, newestAgeS: null })).toBe(5_000)
    expect(serverLowerBound([], STATUS)).toBeNull()
  })
})

describe('AircraftStore — sıra', () => {
  it('eldekinden eski örnek (yoldayken gelen arama sonucu) yeni örneği geri almaz', () => {
    const store = new AircraftStore()
    store.applyDiff(diff(1, [{ updated: [aircraft({ t: 5_000, lon: 28.9 })] }]), 5_000)
    const current = store.get('4bb1c5')
    store.upsert(aircraft({ t: 4_000, lon: 28.8 }), 5_200)
    expect(store.get('4bb1c5')).toBe(current)
    expect(store.trail('4bb1c5').map((p) => p.lon)).toEqual([28.9])
    // Tam görüntüdeki eski örnek de yok sayılır, uçak kümede kalır.
    store.applySnapshot(snapshot(2, [aircraft({ t: 4_500, lon: 28.85 })]), 5_300)
    expect(store.get('4bb1c5')?.lon).toBe(28.9)
  })
})

describe('AircraftStore — iz', () => {
  it('yalnızca konum değişince nokta ekler; yerde ve havada durumunu taşır', () => {
    const store = new AircraftStore()
    store.upsert(aircraft({ t: 1 }), 0)
    store.upsert(aircraft({ t: 2, alt: 34_000 }), 1)
    store.upsert(aircraft({ t: 3, lat: 41.3, gnd: true, alt: null }), 2)
    expect(store.trail('4bb1c5')).toEqual([
      { lat: 41.2, lon: 28.7, gnd: false, t: 1 },
      { lat: 41.3, lon: 28.7, gnd: true, t: 3 },
    ])
  })

  it(`en fazla ${TRAIL_MAX_POINTS} nokta tutar, en eskileri atar`, () => {
    const store = new AircraftStore()
    for (let i = 0; i < TRAIL_MAX_POINTS + 25; i++) {
      store.upsert(aircraft({ lon: 20 + i * 0.01, t: i }), i)
    }
    const trail = store.trail('4bb1c5')
    expect(trail).toHaveLength(TRAIL_MAX_POINTS)
    expect(trail[0]?.t).toBe(25)
    expect(trail.at(-1)?.t).toBe(TRAIL_MAX_POINTS + 24)
  })

  it('bilinmeyen uçağın izi boştur', () => {
    expect(new AircraftStore().trail('ffffff')).toEqual([])
  })
})

describe('AircraftStore — budama ve bildirim', () => {
  it('eski örnekli uçakları ve izlerini atar (varsayılan 120 sn)', () => {
    const store = new AircraftStore()
    store.upsert(aircraft(), 0)
    store.upsert(aircraft({ hex: 'aaaaaa' }), 60_000)
    store.prune(120_000)
    expect(store.size).toBe(2)
    store.prune(120_001)
    expect(store.list().map((ac) => ac.hex)).toEqual(['aaaaaa'])
    expect(store.trail('4bb1c5')).toEqual([])
    store.prune(70_001, 10_000)
    expect(store.size).toBe(0)
  })

  it('seyrek veride (D-122) API penceresiyle budar: 300 sn önceki örnek 660 sn kalır', () => {
    const store = new AircraftStore()
    // En yeni örneğin yaşı 0: örnek istemci saatinde tam 0 anında alınmış sayılır.
    const sparse = {
      ...STATUS,
      providers: { adsbLol: 'limited' as const },
      newestAgeS: 0,
      maxAgeS: 660,
    }
    store.applySnapshot({ ...snapshot(1), status: sparse }, 0)
    expect(store.get('4bb1c5')?.sampledAt).toBe(0)
    store.prune(300_000, liveMaxAgeMs(store.status))
    store.prune(660_000, liveMaxAgeMs(store.status))
    expect(store.size).toBe(1)
    store.prune(660_001, liveMaxAgeMs(store.status))
    expect(store.size).toBe(0)
    // Eski API (alan yok) ve sık veri: varsayılan 120 sn.
    expect(liveMaxAgeMs(STATUS)).toBe(STORE_MAX_AGE_MS)
    expect(liveMaxAgeMs(null)).toBe(STORE_MAX_AGE_MS)
  })

  it('her değişiklikten sonra bildirir ve sürümü artırır; boş budama bildirmez', () => {
    const store = new AircraftStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.applySnapshot(snapshot(1), 0)
    store.applyDiff(diff(2, []), 0)
    store.upsert(aircraft({ hex: 'aaaaaa' }), 0)
    store.prune(1_000)
    expect(listener).toHaveBeenCalledTimes(3)
    expect(store.version).toBe(3)
    unsubscribe()
    store.prune(1_000_000)
    expect(listener).toHaveBeenCalledTimes(3)
    expect(store.version).toBe(4)
  })

  it('bildirim sırasında abonelik kaldırılsa da diğer dinleyiciler çağrılır', () => {
    const store = new AircraftStore()
    const second = vi.fn()
    const unsubscribeFirst = store.subscribe(() => unsubscribeFirst())
    store.subscribe(second)
    store.upsert(aircraft(), 0)
    expect(second).toHaveBeenCalledTimes(1)
  })
})
