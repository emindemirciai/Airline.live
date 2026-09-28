import { distanceKm, kmToNm } from '@havayolu/geo'
import { describe, expect, it } from 'vitest'
import {
  coveragePlan,
  EAST_CIRCLE,
  FRESHNESS_TARGETS_MS,
  MAX_CIRCLE_NM,
  PRIMARY_EXTRA_RADIUS_NM,
  RequestScheduler,
  WEST_CIRCLE,
  type PlannedCircle,
  type PlannedRequest,
  type StationInput,
} from './plan'

const station = (icao: string, lat: number, lon: number, extra: Partial<StationInput> = {}) => ({
  icao,
  lat,
  lon,
  fetchRadiusNm: 60,
  isPrimary: false,
  ...extra,
})

/** Tohum istasyonlar (CLAUDE.md): IST birincil, SAW, ESB, ADB, AYT. */
const SEED: StationInput[] = [
  station('LTFM', 41.274874, 28.732136, { isPrimary: true }),
  station('LTFJ', 40.898602, 29.3092),
  station('LTAC', 40.128101, 32.995098),
  station('LTBJ', 38.2924, 27.157),
  station('LTAI', 36.898701, 30.800501),
]
/** Batıya sığmayan doğu istasyonları: Van ve Erzurum. */
const VAN = station('LTCI', 38.4682, 43.3323)
const ERZURUM = station('LTCE', 39.9565, 41.1702)

const distanceNm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  kmToNm(distanceKm(a, b))

/** P0 çemberi (ARP, fetchRadius) çemberin içinde mi? */
const containsP0 = (circle: PlannedCircle, s: StationInput) =>
  distanceNm(circle.center, s) + s.fetchRadiusNm <= circle.radiusNm + 1e-9

const byId = (plan: PlannedCircle[], id: string) => {
  const circle = plan.find((c) => c.id === id)
  if (!circle) throw new Error(`circle not in plan: ${id}`)
  return circle
}

describe('coveragePlan', () => {
  it('5 tohum istasyon: tek batı çemberi hepsini kapsar, birincil 40 NM ve Doğu eklenir', () => {
    const plan = coveragePlan(SEED)
    expect(plan.map((c) => c.kind)).toEqual(['west', 'primary', 'east'])
    const west = byId(plan, 'west')
    expect(west.covers).toEqual(['LTAC', 'LTAI', 'LTBJ', 'LTFJ', 'LTFM'])
    expect(west.center).toEqual(WEST_CIRCLE.center)
    expect(west.radiusNm).toBe(250)
    for (const s of SEED) expect(containsP0(west, s)).toBe(true)
    // En uzak nokta AYT: ≈ 167,8 + 60 = 227,8 NM (data-sources.md §1).
    const ayt = SEED[4] as StationInput
    expect(distanceNm(WEST_CIRCLE.center, ayt) + 60).toBeCloseTo(227.8, 0)

    const primary = byId(plan, 'primary')
    expect(primary.center).toEqual({ lat: 41.274874, lon: 28.732136 })
    expect(primary.radiusNm).toBe(PRIMARY_EXTRA_RADIUS_NM)
    expect(primary.primaryIcao).toBe('LTFM')
    expect(primary.covers).toEqual([])

    const east = byId(plan, 'east')
    expect(east.center).toEqual(EAST_CIRCLE.center)
    expect(east.radiusNm).toBe(250)
    expect(east.covers).toEqual([])
  })

  it('istasyon yoksa yalnızca Doğu çemberi', () => {
    expect(coveragePlan([]).map((c) => c.id)).toEqual(['east'])
  })

  it('Doğu çemberi her planda vardır ve sondadır', () => {
    for (const stations of [[], SEED, [VAN], [...SEED, VAN, ERZURUM]]) {
      const plan = coveragePlan(stations)
      expect(plan.at(-1)?.kind).toBe('east')
      expect(plan.filter((c) => c.kind === 'east')).toHaveLength(1)
    }
  })

  it('batıya sığmayan iki istasyon ≤ 250 NM çemberde birleşir', () => {
    const plan = coveragePlan([...SEED, VAN, ERZURUM])
    expect(plan.map((c) => c.id)).toEqual(['west', 'station-LTCE-LTCI', 'primary', 'east'])
    const merged = byId(plan, 'station-LTCE-LTCI')
    expect(merged.kind).toBe('station')
    expect(merged.covers).toEqual(['LTCE', 'LTCI'])
    expect(Number.isInteger(merged.radiusNm)).toBe(true)
    expect(merged.radiusNm).toBeLessThanOrEqual(MAX_CIRCLE_NM)
    expect(containsP0(merged, VAN)).toBe(true)
    expect(containsP0(merged, ERZURUM)).toBe(true)
    // İki P0'ı içeren en küçük çember ≈ (d + 60 + 60) / 2; yuvarlama en fazla 1 NM ekler.
    const minimal = (distanceNm(VAN, ERZURUM) + 120) / 2
    expect(merged.radiusNm).toBeGreaterThanOrEqual(minimal)
    expect(merged.radiusNm).toBeLessThanOrEqual(Math.ceil(minimal) + 1)
    // Erzurum'un P0'ı Doğu çemberinin de içindedir.
    expect(byId(plan, 'east').covers).toEqual(['LTCE'])
  })

  it('birleşemeyen istasyon kendi çemberini alır; yarıçap yukarı yuvarlanır', () => {
    const london = station('EGLL', 51.4706, -0.461941, { fetchRadiusNm: 60.2 })
    const plan = coveragePlan([london, VAN])
    expect(plan.map((c) => c.id)).toEqual(['station-EGLL', 'station-LTCI', 'east'])
    const own = byId(plan, 'station-EGLL')
    expect(own.center).toEqual({ lat: 51.4706, lon: -0.461941 })
    expect(own.radiusNm).toBe(61)
    expect(own.covers).toEqual(['EGLL'])
    expect(byId(plan, 'station-LTCI').radiusNm).toBe(60)
  })

  it('250 NM üstü çekim yarıçapı 250 NM ile sınırlanır; istasyon yine kapsanmış sayılır', () => {
    const plan = coveragePlan([station('LTCI', 38.4682, 43.3323, { fetchRadiusNm: 400 })])
    const own = byId(plan, 'station-LTCI')
    expect(own.radiusNm).toBe(MAX_CIRCLE_NM)
    expect(own.covers).toEqual(['LTCI'])
  })

  it('birincil batı dışında olabilir: kendi istasyon çemberi ve 40 NM birincil çember', () => {
    const plan = coveragePlan([
      ...SEED.map((s) => ({ ...s, isPrimary: false })),
      { ...VAN, isPrimary: true },
    ])
    expect(plan.map((c) => c.id)).toEqual(['west', 'station-LTCI', 'primary', 'east'])
    const primary = byId(plan, 'primary')
    expect(primary.primaryIcao).toBe('LTCI')
    expect(primary.center).toEqual({ lat: VAN.lat, lon: VAN.lon })
  })

  it('deterministik: giriş sırası planı değiştirmez; tekrar eden ICAO yok sayılır', () => {
    const stations = [...SEED, VAN, ERZURUM]
    const reversed = [...stations].reverse()
    // Birincil tek olduğundan sıra değişse de aynı istasyon birincildir.
    expect(coveragePlan(reversed)).toEqual(coveragePlan(stations))
    expect(coveragePlan([...stations, { ...VAN, lat: 0, lon: 0 }])).toEqual(coveragePlan(stations))
  })

  it('bütün yarıçaplar 1..250 arası tamsayıdır', () => {
    const plan = coveragePlan([
      ...SEED,
      VAN,
      ERZURUM,
      station('EGLL', 51.4706, -0.461941, { fetchRadiusNm: 0.2 }),
    ])
    for (const circle of plan) {
      expect(Number.isInteger(circle.radiusNm)).toBe(true)
      expect(circle.radiusNm).toBeGreaterThanOrEqual(1)
      expect(circle.radiusNm).toBeLessThanOrEqual(MAX_CIRCLE_NM)
    }
  })
})

const circleId = (req: PlannedRequest) => (req.kind === 'watch' ? 'watch' : req.circle.id)

describe('RequestScheduler', () => {
  const SLOT = 10_000

  it('ilk istek batı: birincil ve istasyonlar hiç çekilmedi', () => {
    const scheduler = new RequestScheduler(coveragePlan(SEED))
    expect(circleId(scheduler.next(0, SLOT, null))).toBe('west')
  })

  it('istasyonların sırası gelmiyorsa birincil için 40 NM çember, geliyorsa batı', () => {
    const scheduler = new RequestScheduler(coveragePlan(SEED))
    const plan = coveragePlan(SEED)
    scheduler.served({ kind: 'circle', circle: byId(plan, 'west') }, 0)
    scheduler.served({ kind: 'circle', circle: byId(plan, 'east') }, 0)
    // İstasyon son tarihi 30 sn; 5 sn'de 2 slot sonrası (25 sn) henüz değil.
    expect(circleId(scheduler.next(5_000, SLOT, null))).toBe('primary')
    // 10 sn'de 2 slot sonrası 30 sn: istasyonun sırası geliyor → batı.
    expect(circleId(scheduler.next(10_000, SLOT, null))).toBe('west')
  })

  it('zorunlu işlerde önem sırası: birincil > istasyonlar > Doğu', () => {
    const plan = coveragePlan([...SEED, VAN])
    const scheduler = new RequestScheduler(plan)
    // Hepsi aynı anda çekildi; 100 sn sonra hepsi zorunlu.
    for (const circle of plan) scheduler.served({ kind: 'circle', circle }, 0)
    const first = scheduler.next(100_000, SLOT, null)
    expect(circleId(first)).toBe('west')
    scheduler.served(first, 100_000)
    // Doğu da zorunlu, ama batı dışı istasyon daha önemli.
    expect(circleId(scheduler.next(110_000, SLOT, null))).toBe('station-LTCI')
  })

  it('takip listesi birincil kadar önemlidir; gerekmediğinde hiç seçilmez', () => {
    const plan = coveragePlan(SEED)
    const scheduler = new RequestScheduler(plan)
    scheduler.served({ kind: 'circle', circle: byId(plan, 'west') }, 0)
    scheduler.served({ kind: 'circle', circle: byId(plan, 'east') }, 0)
    expect(scheduler.next(1_000, SLOT, 1_000)).toEqual({ kind: 'watch' })
    for (let t = 0; t < 600_000; t += SLOT) {
      const req = scheduler.next(t, SLOT, null)
      expect(req.kind).toBe('circle')
      scheduler.served(req, t + 1_000)
    }
  })

  it('takip işinin son tarihi bayatlama anından gelir: sırası gelmiş birincil önce çekilir', () => {
    const plan = coveragePlan(SEED)
    const scheduler = new RequestScheduler(plan)
    // İnceleme bulgusundaki an: birincil 91 sn'de karşılandı (son tarih 111 sn), takip listesindeki
    // uçak 90 sn'deki batı çekiminden geldi ve 110 sn'de 20 sn'yi aştı (son tarih 120 sn).
    // `/v2/hex` hiç atılmadı; bu, takip işini öne geçirmez.
    scheduler.served({ kind: 'circle', circle: byId(plan, 'east') }, 71_000)
    scheduler.served({ kind: 'circle', circle: byId(plan, 'west') }, 91_000)
    const first = scheduler.next(110_000, SLOT, 120_000)
    expect(first.kind).toBe('circle')
    scheduler.served(first, 111_000)
    expect(scheduler.lastServed().primary).toBe(111_000)
    // Bir sonraki slotta takip isteği hedefinde (30 sn) atılır.
    expect(scheduler.next(120_000, SLOT, 120_000)).toEqual({ kind: 'watch' })
  })

  it('son tarihini zaten kaçırmış takip işi, tutturabilecek birincilin slotunu almaz', () => {
    const plan = coveragePlan(SEED)
    const scheduler = new RequestScheduler(plan)
    scheduler.served({ kind: 'circle', circle: byId(plan, 'east') }, 71_000)
    scheduler.served({ kind: 'circle', circle: byId(plan, 'west') }, 91_000)
    // Takip listesindeki uçak kapsayan çemberin son yanıtında gelmedi; son tarihi (100 sn) geçti.
    // Birincil şimdi çekilirse hedefini tutturur (111 sn), bir slot ertelenirse kaçırır.
    const first = scheduler.next(110_000, SLOT, 100_000)
    expect(first.kind).toBe('circle')
    scheduler.served(first, 111_000)
    expect(scheduler.next(120_000, SLOT, 100_000)).toEqual({ kind: 'watch' })
  })

  it('Doğu, önemli işlerin son tarihini kaçırtacaksa slot alamaz', () => {
    const plan = coveragePlan(SEED)
    const scheduler = new RequestScheduler(plan)
    // Doğu hiç çekilmedi (zorunlu). Birincil ve takip listesinin son tarihi aynı slotta (41 sn;
    // takip listesindeki uçak 11 sn'deki `/v2/hex` yanıtından geldi): 30 sn'deki slot Doğu'ya
    // giderse ikisinden biri kaçar.
    scheduler.served({ kind: 'watch' }, 11_000)
    scheduler.served({ kind: 'circle', circle: byId(plan, 'west') }, 21_000)
    expect(circleId(scheduler.next(30_000, SLOT, 41_000))).toBe('primary')
    // Takip listesi gerekmiyorsa aynı anda Doğu'ya yer vardır.
    const relaxed = new RequestScheduler(plan)
    relaxed.served({ kind: 'circle', circle: byId(plan, 'west') }, 21_000)
    expect(circleId(relaxed.next(30_000, SLOT, null))).toBe('east')
  })

  it('watchCircles: 30 sn hedefli işleri karşılayan çemberler ve son çekilme anları', () => {
    const seed = coveragePlan(SEED)
    const scheduler = new RequestScheduler(seed)
    // Yalnızca Doğu'yu (90 sn) karşılayan Doğu çemberi takip kapsaması sayılmaz.
    expect(scheduler.watchCircles()).toEqual([
      { circle: byId(seed, 'west'), fetchedAt: null },
      { circle: byId(seed, 'primary'), fetchedAt: null },
    ])
    scheduler.served({ kind: 'circle', circle: byId(seed, 'west') }, 5_000)
    scheduler.served({ kind: 'circle', circle: byId(seed, 'east') }, 6_000)
    expect(scheduler.watchCircles().map((c) => c.fetchedAt)).toEqual([5_000, null])
    // Doğu bir istasyonu (Erzurum) kapsıyorsa o istasyonun 30 sn hedefi için sayılır.
    const wide = coveragePlan([...SEED, VAN, ERZURUM])
    expect(new RequestScheduler(wide).watchCircles().map((c) => c.circle.id)).toEqual([
      'west',
      'station-LTCE-LTCI',
      'primary',
      'east',
    ])
  })

  it('lastServed: birincil, istasyonlar, Doğu, takip listesi ve istasyon çemberleri', () => {
    const plan = coveragePlan([...SEED, VAN])
    const scheduler = new RequestScheduler(plan)
    expect(scheduler.lastServed()).toEqual({
      primary: null,
      stations: null,
      east: null,
      watch: null,
      'station-LTCI': null,
    })
    scheduler.served({ kind: 'circle', circle: byId(plan, 'west') }, 5_000)
    expect(scheduler.lastServed()).toMatchObject({ primary: 5_000, stations: null })
    scheduler.served({ kind: 'circle', circle: byId(plan, 'station-LTCI') }, 7_000)
    scheduler.served({ kind: 'circle', circle: byId(plan, 'primary') }, 9_000)
    scheduler.served({ kind: 'watch' }, 11_000)
    scheduler.served({ kind: 'circle', circle: byId(plan, 'east') }, 13_000)
    expect(scheduler.lastServed()).toEqual({
      primary: 9_000,
      stations: 5_000,
      east: 13_000,
      watch: 11_000,
      'station-LTCI': 7_000,
    })
    // Eski bir yanıtın geç işlenmesi zamanı geri almaz; planda olmayan çember yok sayılır.
    scheduler.served({ kind: 'circle', circle: byId(plan, 'primary') }, 1_000)
    scheduler.served({ kind: 'circle', circle: { ...byId(plan, 'west'), id: 'unknown' } }, 20_000)
    expect(scheduler.lastServed()).toMatchObject({ primary: 9_000, stations: 5_000 })
  })

  it('istasyonsuz planda yalnızca Doğu ve takip listesi vardır', () => {
    const scheduler = new RequestScheduler(coveragePlan([]))
    expect(scheduler.lastServed()).toEqual({ east: null, watch: null })
    expect(circleId(scheduler.next(0, SLOT, null))).toBe('east')
    expect(scheduler.next(0, SLOT, 0)).toEqual({ kind: 'watch' })
  })

  it('hedefler değiştirilebilir; geçersiz plan ve hedef reddedilir', () => {
    const plan = coveragePlan(SEED)
    const serveAll = (scheduler: RequestScheduler) => {
      scheduler.served({ kind: 'circle', circle: byId(plan, 'east') }, 0)
      scheduler.served({ kind: 'circle', circle: byId(plan, 'west') }, 10_000)
      scheduler.served({ kind: 'circle', circle: byId(plan, 'primary') }, 15_000)
    }
    // Doğu 30 sn hedefle 21 sn'de zorunlu; birincil (35 sn) ve istasyonlar (40 sn) değil.
    const custom = new RequestScheduler(plan, { targets: { east: 30_000 } })
    serveAll(custom)
    expect(circleId(custom.next(21_000, SLOT, null))).toBe('east')
    // Varsayılan 90 sn hedefle Doğu beklemede; son tarihi en erken iş birincil ve istasyonların
    // sırası bir slot içinde geldiğinden batıdan çekilir.
    const standard = new RequestScheduler(plan)
    serveAll(standard)
    expect(circleId(standard.next(21_000, SLOT, null))).toBe('west')
    expect(() => new RequestScheduler([])).toThrow('empty')
    expect(() => new RequestScheduler([...plan, byId(plan, 'east')])).toThrow('duplicate')
    expect(() => new RequestScheduler(plan, { targets: { primary: 0 } })).toThrow('primary')
    expect(FRESHNESS_TARGETS_MS).toEqual({
      primary: 20_000,
      watch: 30_000,
      stations: 30_000,
      east: 90_000,
    })
  })
})

interface Simulation {
  requests: string[]
  /**
   * İş anahtarı → saniyede bir örneklenen yaş (ms). `aircraft`: takip listesindeki uçağın
   * verisinin yaşı (t − örnek zamanı).
   */
  ages: Map<string, number[]>
}

/**
 * Takip listesindeki tek uçak. `/v2/hex` isteği onu her zaman getirir; çember yanıtlarından
 * yalnızca `inCircles`'takiler getirir. Yanıttaki konumun yaşı `seenPosMs`'dir. `covered(t)`
 * doğruysa ingest'in kapsama süzgeci uçağı bir çemberin karşıladığını söyler (takip işi yok).
 */
interface WatchedAircraft {
  inCircles: readonly string[]
  seenPosMs: number
  covered?: (t: number) => boolean
}

/**
 * Deterministik benzetim: her `slotMs`'de bir istek, her istek başarılı ve `latencyMs` sonra
 * karşılanır. Yaş her saniye örneklenir: t − (son karşılanma − gecikme), yani isteğin atıldığı
 * andan beri geçen süre (verinin yolda geçirdiği 1 sn dahil).
 *
 * Takip işinin son tarihi ingest'teki kuralla verilir: kapsanmayan uçak için örnek zamanı + 30
 * sn, hiç örneği yoksa son takip isteği (yoksa açılış) + 30 sn; kapsanan uçak için iş yoktur.
 */
function simulate(opts: {
  plan: PlannedCircle[]
  slotMs: number
  minutes: number
  watch?: WatchedAircraft
  latencyMs?: number
}): Simulation {
  const scheduler = new RequestScheduler(opts.plan)
  const latency = opts.latencyMs ?? 1_000
  const end = opts.minutes * 60_000
  const watchTarget = FRESHNESS_TARGETS_MS.watch
  let pending: { req: PlannedRequest; at: number }[] = []
  let sample: number | null = null
  const requests: string[] = []
  const ages = new Map<string, number[]>()
  const record = (key: string, age: number) => {
    const list = ages.get(key) ?? []
    list.push(age)
    ages.set(key, list)
  }
  const watchDue = (t: number): number | null => {
    if (!opts.watch || (opts.watch.covered?.(t) ?? false)) return null
    return (sample ?? scheduler.lastServed().watch ?? 0) + watchTarget
  }
  for (let t = 0; t <= end; t += 1_000) {
    for (const p of pending) {
      if (p.at > t) continue
      scheduler.served(p.req, p.at)
      const brings =
        p.req.kind === 'watch' || (opts.watch?.inCircles.includes(p.req.circle.id) ?? false)
      if (opts.watch && brings) sample = Math.max(sample ?? -Infinity, p.at - opts.watch.seenPosMs)
    }
    pending = pending.filter((p) => p.at > t)
    if (t % opts.slotMs === 0) {
      const req = scheduler.next(t, opts.slotMs, watchDue(t))
      requests.push(circleId(req))
      pending.push({ req, at: t + latency })
    }
    for (const [key, at] of Object.entries(scheduler.lastServed())) {
      if (at !== null) record(key, t - at + latency)
    }
    if (sample !== null) record('aircraft', t - sample)
  }
  return { requests, ages }
}

/** En yakın sıra yöntemiyle yüzdelik. */
function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const value = sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]
  if (value === undefined) throw new Error('no samples')
  return value
}

const maxOf = (values: readonly number[] | undefined) => {
  if (!values || values.length === 0) throw new Error('no samples')
  return Math.max(...values)
}

describe('RequestScheduler benzetimi (0,1 istek/sn, 30 dk)', () => {
  const SLOT = 10_000

  it('takip listesi yokken: birincil p95 ≤ 20 sn, istasyonlar ≤ 30+slot, Doğu ≤ 90+slot', () => {
    const { ages, requests } = simulate({
      plan: coveragePlan(SEED),
      slotMs: SLOT,
      minutes: 30,
    })
    expect(requests).toHaveLength(181)
    expect(percentile(ages.get('primary') ?? [], 0.95)).toBeLessThanOrEqual(20_000)
    expect(maxOf(ages.get('stations'))).toBeLessThanOrEqual(30_000 + SLOT)
    expect(maxOf(ages.get('east'))).toBeLessThanOrEqual(90_000 + SLOT)
    expect(requests).not.toContain('watch')
  })

  it('takip listesi hep gerekliyken: takip ≤ 30+slot, birincil p95 ≤ 20 sn (Doğu düşebilir)', () => {
    // Uçak kapsama dışında: yalnızca `/v2/hex` getirir, takip ihtiyacı her 30 sn'de doğar.
    const { ages, requests } = simulate({
      plan: coveragePlan(SEED),
      slotMs: SLOT,
      minutes: 30,
      watch: { inCircles: [], seenPosMs: 1_000 },
    })
    expect(maxOf(ages.get('watch'))).toBeLessThanOrEqual(30_000 + SLOT)
    expect(maxOf(ages.get('aircraft'))).toBeLessThanOrEqual(30_000 + SLOT)
    expect(percentile(ages.get('primary') ?? [], 0.95)).toBeLessThanOrEqual(20_000)
    // Bütçe yetmezse önce Doğu düşer; diğer istasyonlar hedefte kalır.
    expect(maxOf(ages.get('stations'))).toBeLessThanOrEqual(30_000 + SLOT)
    expect(requests.filter((r) => r === 'watch').length).toBeGreaterThanOrEqual(59)
  })

  it('takip ihtiyacı açılıp kapanırken (uçak batı çekimlerinden gelir) birincil p95 ≤ 20 sn', () => {
    // İnceleme bulgusu: takip ihtiyacı doğduğunda iş sonsuz gecikmiş sayılırsa (hiç `/v2/hex`
    // atılmamışken) sırası gelmiş birincil çekimin slotunu alır. Burada uçak batı çekimlerinden
    // gelir; kapsama süzgeci onu 2 dk kapsanmış, 2 dk kapsanmamış sayar (ör. çember kenarında).
    const { ages, requests } = simulate({
      plan: coveragePlan(SEED),
      slotMs: SLOT,
      minutes: 30,
      watch: {
        inCircles: ['west'],
        seenPosMs: 1_000,
        covered: (t) => Math.floor(t / 120_000) % 2 === 1,
      },
    })
    expect(percentile(ages.get('primary') ?? [], 0.95)).toBeLessThanOrEqual(20_000)
    expect(maxOf(ages.get('aircraft'))).toBeLessThanOrEqual(30_000 + SLOT)
    expect(maxOf(ages.get('stations'))).toBeLessThanOrEqual(30_000 + SLOT)
    expect(requests).toHaveLength(181)
  })

  it('batı dışı istasyon çemberi de hedefte kalır; bütçe yetmeyince Doğu düşer', () => {
    const { ages } = simulate({
      plan: coveragePlan([...SEED, VAN, ERZURUM]),
      slotMs: SLOT,
      minutes: 30,
    })
    expect(percentile(ages.get('primary') ?? [], 0.95)).toBeLessThanOrEqual(20_000)
    expect(maxOf(ages.get('stations'))).toBeLessThanOrEqual(30_000 + SLOT)
    expect(maxOf(ages.get('station-LTCE-LTCI'))).toBeLessThanOrEqual(30_000 + SLOT)
  })

  it('alt sınırda (0,05 istek/sn) birincil ve istasyonlar Doğu’dan önce gelir', () => {
    const slow = 20_000
    const { ages, requests } = simulate({
      plan: coveragePlan(SEED),
      slotMs: slow,
      minutes: 30,
    })
    expect(maxOf(ages.get('primary'))).toBeLessThanOrEqual(20_000 + slow)
    expect(maxOf(ages.get('stations'))).toBeLessThanOrEqual(30_000 + slow)
    expect(requests.filter((r) => r === 'west').length).toBeGreaterThan(requests.length / 2)
  })
})
