import type { StationArp } from '@havayolu/db'
import { distanceKm, kmToNm } from '@havayolu/geo'
import {
  AdsbLolError,
  ProviderLicenseError,
  trackSourceCode,
  type AircraftState,
} from '@havayolu/providers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  adsbLolConfigProblem,
  adsbLolErrorText,
  bounded,
  LIVE_WRITE_TIMEOUT_MS,
  LiveTimeoutError,
  LiveWriter,
  medianSampleTime,
  receiverOutcome,
  regionDataTimes,
  trackRow,
  watchNeed,
  type WatchCoverage,
  VALID_HEX,
} from './index'
import {
  coveragePlan,
  FRESHNESS_TARGETS_MS,
  RequestScheduler,
  type PlannedCircle,
  type PlannedRequest,
  type StationInput,
} from './plan'

const T0 = Date.UTC(2026, 8, 28, 12)

const state = (hex: string, over: Partial<AircraftState> = {}): AircraftState => ({
  hex,
  nonIcao: false,
  callsign: null,
  registration: null,
  typeCode: null,
  category: null,
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
  source: 'adsbLol',
  ...over,
})

const LTFM: StationArp = {
  icao: 'LTFM',
  iata: 'IST',
  isPrimary: true,
  fetchRadiusNm: 60,
  lat: 41.274874,
  lon: 28.732136,
  elevationFt: 325,
}
const LTAI: StationArp = {
  icao: 'LTAI',
  iata: 'AYT',
  isPrimary: false,
  fetchRadiusNm: 60,
  lat: 36.898701,
  lon: 30.800501,
  elevationFt: 177,
}

describe('adsbLolErrorText', () => {
  it('sabit kısa Türkçe metinler; ham ileti yok', () => {
    expect(adsbLolErrorText('rate_limit', 429)).toBe('HTTP 429 (kısıtlama)')
    expect(adsbLolErrorText('rate_limit', 420)).toBe('HTTP 420 (kısıtlama)')
    expect(adsbLolErrorText('config', 403)).toBe('HTTP 403 (yapılandırma)')
    expect(adsbLolErrorText('server', 503)).toBe('HTTP 503 (sunucu hatası)')
    expect(adsbLolErrorText('network', null)).toBe('bağlantı hatası')
    expect(adsbLolErrorText('response', 200)).toBe('yanıt biçimi hatalı')
    expect(adsbLolErrorText('request', 404)).toBe('HTTP 404 (istek hatası)')
    expect(adsbLolErrorText('request', null)).toBe('istek hatası')
  })
})

describe('adsbLolConfigProblem', () => {
  const env = { CONTACT_EMAIL: 'ops@example.org', ADSBLOL_API_KEY: undefined }
  it('nedeni env ve hata türünden çıkarır, değer taşımaz', () => {
    expect(adsbLolConfigProblem({ ...env, CONTACT_EMAIL: undefined }, new Error('x'))).toEqual({
      code: 'contact_email_missing',
      text: 'CONTACT_EMAIL tanımlı değil',
    })
    expect(
      adsbLolConfigProblem({ ...env, ADSBLOL_API_KEY: 'gizli-anahtar' }, new Error('x')).code,
    ).toBe('api_key_header_missing')
    expect(adsbLolConfigProblem(env, new ProviderLicenseError('lisans')).code).toBe('license')
    const header = adsbLolConfigProblem(
      { ...env, ADSBLOL_API_KEY: 'gizli-anahtar', ADSBLOL_API_KEY_HEADER: 'bad header' },
      new AdsbLolError('config', 'geçersiz'),
    )
    expect(header.code).toBe('invalid_header')
    expect(header.text).not.toMatch(/gizli/)
  })
})

describe('receiverOutcome', () => {
  it('yerel alıcının sabit hata metinlerini sayaç türüne çevirir', () => {
    expect(receiverOutcome(null)).toBe('success')
    expect(receiverOutcome('HTTP 503')).toBe('server')
    expect(receiverOutcome('HTTP 429')).toBe('rate_limit')
    expect(receiverOutcome('HTTP 401')).toBe('config')
    expect(receiverOutcome('HTTP 404')).toBe('request')
    expect(receiverOutcome('yanıt JSON değil')).toBe('response')
    expect(receiverOutcome('yanıt biçimi ya da saati hatalı')).toBe('response')
    expect(receiverOutcome('zaman aşımı')).toBe('network')
    expect(receiverOutcome('bağlantı hatası')).toBe('network')
  })
})

describe('medianSampleTime', () => {
  it('tek ve çift sayıda örnekte ortanca; boşta null', () => {
    expect(medianSampleTime([])).toBeNull()
    expect(medianSampleTime([{ sampleTime: 30 }, { sampleTime: 10 }, { sampleTime: 20 }])).toBe(20)
    expect(medianSampleTime([{ sampleTime: 10 }, { sampleTime: 20 }])).toBe(15)
  })
})

describe('regionDataTimes', () => {
  const stations = new Map([
    ['LTFM', LTFM],
    ['LTAI', LTAI],
  ])
  const plan = coveragePlan([LTFM, LTAI])

  it('çemberin ve kapsadığı istasyonların veri zamanı; bölgede uçak yoksa yanıtın now değeri', () => {
    const west = plan.find((c) => c.id === 'west')
    if (!west) throw new Error('west yok')
    const near = [
      state('aa0001', { sampleTime: T0 - 4_000 }),
      state('aa0002', { sampleTime: T0 - 2_000 }),
    ]
    const far = state('aa0003', { lat: 38.4, lon: 29.9, sampleTime: T0 - 30_000 })
    const times = regionDataTimes(west, { aircraft: [...near, far], now: T0 }, stations)
    expect(times).toEqual({ west: T0 - 4_000, LTFM: T0 - 3_000, LTAI: T0 })
  })

  it('birincil çember, P0 çemberi sığmasa da birincil istasyonun zamanını günceller', () => {
    const primary = plan.find((c) => c.id === 'primary')
    if (!primary) throw new Error('primary yok')
    expect(primary.covers).not.toContain('LTFM')
    const times = regionDataTimes(primary, { aircraft: [], now: T0 }, stations)
    expect(times).toEqual({ primary: T0, LTFM: T0 })
  })
})

/** Tohum istasyonlar (CLAUDE.md): IST birincil, SAW, ESB, ADB, AYT. */
const SEED: StationInput[] = [
  { icao: 'LTFM', lat: 41.274874, lon: 28.732136, fetchRadiusNm: 60, isPrimary: true },
  { icao: 'LTFJ', lat: 40.898602, lon: 29.3092, fetchRadiusNm: 60, isPrimary: false },
  { icao: 'LTAC', lat: 40.128101, lon: 32.995098, fetchRadiusNm: 60, isPrimary: false },
  { icao: 'LTBJ', lat: 38.2924, lon: 27.157, fetchRadiusNm: 60, isPrimary: false },
  { icao: 'LTAI', lat: 36.898701, lon: 30.800501, fetchRadiusNm: 60, isPrimary: false },
]
/** Ankara yakını: batı çemberinin içinde, birincil (IST 40 NM) ve Doğu çemberlerinin dışında. */
const NEAR_ANKARA = { lat: 39.9, lon: 32.8 }
/** Girit üstü: hiçbir kapsama çemberinin içinde değil. */
const OVER_CRETE = { lat: 35.3, lon: 24.0 }

const circleOf = (plan: readonly PlannedCircle[], id: string) => {
  const circle = plan.find((c) => c.id === id)
  if (!circle) throw new Error(`circle not in plan: ${id}`)
  return circle
}

describe('watchNeed', () => {
  const plan = coveragePlan(SEED)
  const west = circleOf(plan, 'west')
  const primary = circleOf(plan, 'primary')
  const coverage = (over: Partial<WatchCoverage> = {}): WatchCoverage => ({
    circles: [
      { circle: west, fetchedAt: T0 - 25_000 },
      { circle: primary, fetchedAt: T0 - 5_000 },
    ],
    seenInCircleAt: () => T0 - 25_000,
    unseenSince: T0 - 40_000,
    ...over,
  })
  const at = (hex: string, where: { lat: number; lon: number }, sampleTime: number) =>
    state(hex, { ...where, sampleTime })

  it('son 30 sn’de kendisini getiren çemberin içindeki uçak için /v2/hex gerekmez', () => {
    // İnceleme bulgusu: örnek 26 sn eski (30 sn − slot'u aştı) ama batı 25 sn önce çekildi ve
    // uçak o yanıttaydı; bir sonraki batı çekimi onu yine getirir.
    const latest = at('aa0001', NEAR_ANKARA, T0 - 26_000)
    expect(watchNeed(['aa0001'], () => latest, T0, coverage())).toEqual({
      hexes: [],
      dueAt: null,
    })
  })

  it('kapsama dışındaki uçak, örneği taze olsa da son tarihiyle izlenir', () => {
    const latest = at('aa0001', OVER_CRETE, T0 - 2_000)
    expect(watchNeed(['aa0001'], () => latest, T0, coverage())).toEqual({
      hexes: ['aa0001'],
      dueAt: T0 - 2_000 + FRESHNESS_TARGETS_MS.watch,
    })
  })

  it('kapsayan çemberin son yanıtında gelmeyen ya da çemberi gecikmiş uçak izlenir', () => {
    const latest = at('aa0001', NEAR_ANKARA, T0 - 26_000)
    // Batı 25 sn önce çekildi ama uçak 60 sn önceki yanıttaydı: çemberden çıktı ya da sustu.
    const missed = coverage({ seenInCircleAt: () => T0 - 60_000 })
    expect(watchNeed(['aa0001'], () => latest, T0, missed).hexes).toEqual(['aa0001'])
    // Batı 31 sn'dir çekilmedi (ör. geri çekilme): çemberin kendisi gecikmiş.
    const overdue = coverage({
      circles: [{ circle: west, fetchedAt: T0 - 31_000 }],
      seenInCircleAt: () => T0 - 31_000,
    })
    expect(watchNeed(['aa0001'], () => latest, T0, overdue)).toEqual({
      hexes: ['aa0001'],
      dueAt: T0 - 26_000 + FRESHNESS_TARGETS_MS.watch,
    })
    // Hiç çekilmemiş çember kapsamaz.
    const never = coverage({ circles: [{ circle: west, fetchedAt: null }] })
    expect(watchNeed(['aa0001'], () => latest, T0, never).hexes).toEqual(['aa0001'])
  })

  it('en yeni kapsayan çekim uçağı getirmediyse eski çekim kapsama saymaz', () => {
    // IST yakınındaki uçak batı (25 sn önce) ve birincil (5 sn önce) çemberlerinin içinde; en yeni
    // çekim birincil ve uçak onda yok.
    const latest = at('aa0001', { lat: 41.2, lon: 28.7 }, T0 - 26_000)
    expect(watchNeed(['aa0001'], () => latest, T0, coverage()).hexes).toEqual(['aa0001'])
    const seenInPrimary = coverage({ seenInCircleAt: () => T0 - 5_000 })
    expect(watchNeed(['aa0001'], () => latest, T0, seenInPrimary).hexes).toEqual([])
  })

  it('hiç görülmeyen hex son takip isteğinden 30 sn sonra; liste son tarihe göre sıralı', () => {
    const latest = new Map([
      ['aa0001', at('aa0001', OVER_CRETE, T0 - 5_000)],
      ['aa0002', at('aa0002', OVER_CRETE, T0 - 25_000)],
    ])
    const need = watchNeed(['aa0001', 'aa0002', 'aa0003'], (h) => latest.get(h), T0, coverage())
    expect(need).toEqual({
      hexes: ['aa0003', 'aa0002', 'aa0001'],
      dueAt: T0 - 40_000 + FRESHNESS_TARGETS_MS.watch,
    })
    expect(watchNeed([], (h) => latest.get(h), T0, coverage())).toEqual({
      hexes: [],
      dueAt: null,
    })
  })
})

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('LiveWriter', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('push beklemeden döner; yoldaki yazım sürerken gelenler hex başına en yenisiyle birikir', async () => {
    const calls: string[][] = []
    const releases: (() => void)[] = []
    const writer = new LiveWriter<AircraftState>(
      (list) => {
        calls.push(list.map((s) => `${s.hex}@${s.sampleTime - T0}`))
        return new Promise<void>((resolve) => releases.push(resolve))
      },
      () => {
        throw new Error('no error expected')
      },
      60_000,
    )
    writer.push([state('aa0001', { sampleTime: T0 })])
    await tick()
    expect(calls).toEqual([['aa0001@0']])
    writer.push([state('aa0001', { sampleTime: T0 + 1_000 }), state('aa0002')])
    writer.push([state('aa0001', { sampleTime: T0 + 2_000 })])
    expect(writer.backlog()).toBe(2)
    await tick()
    // İlk yazım bitmeden ikincisi başlamaz.
    expect(calls).toHaveLength(1)
    releases.shift()?.()
    await tick()
    await tick()
    expect(calls).toEqual([['aa0001@0'], ['aa0001@2000', 'aa0002@0']])
    expect(writer.backlog()).toBe(0)
    releases.shift()?.()
    await writer.drain()
  })

  it('hata ve süre aşımı onError’a gider; asılı yazım sonrakileri durdurmaz', async () => {
    vi.useFakeTimers()
    const errors: { error: unknown; count: number }[] = []
    let call = 0
    const written: number[] = []
    const writer = new LiveWriter<AircraftState>(
      async (list) => {
        call += 1
        if (call === 1) throw new Error('connection refused')
        if (call === 2) return new Promise<void>(() => undefined)
        written.push(list.length)
      },
      (error, count) => errors.push({ error, count }),
    )
    writer.push([state('aa0001')])
    await vi.advanceTimersByTimeAsync(0)
    expect(errors).toHaveLength(1)
    expect(errors[0]?.count).toBe(1)
    // İkinci yazım hiç bitmez (Redis yanıtsız); süre dolunca bekleyenler yazılır.
    writer.push([state('aa0001', { sampleTime: T0 + 1 }), state('aa0002')])
    await vi.advanceTimersByTimeAsync(0)
    writer.push([state('aa0003')])
    await vi.advanceTimersByTimeAsync(LIVE_WRITE_TIMEOUT_MS - 1)
    expect(written).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(errors[1]?.error).toBeInstanceOf(LiveTimeoutError)
    expect(errors[1]?.count).toBe(2)
    expect(written).toEqual([1])
    await writer.drain()
  })

  it('bounded: süre dolunca LiveTimeoutError; asıl işin sonraki hatası yutulur', async () => {
    vi.useFakeTimers()
    let reject: (error: Error) => void = () => undefined
    const slow = new Promise<number>((_, r) => {
      reject = r
    })
    const result = bounded(slow, 100).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(100)
    expect(await result).toBeInstanceOf(LiveTimeoutError)
    reject(new Error('late failure'))
    await vi.advanceTimersByTimeAsync(0)
    expect(await bounded(Promise.resolve(7), 100)).toBe(7)
  })
})

interface WatchSimulation {
  watchRequests: number
  ages: Map<string, number[]>
}

/**
 * Takip listesi + zamanlayıcı benzetimi (ingest'teki `runAdsbLolRequest` akışı): 0,1 istek/sn,
 * her istek başarılı ve 1 sn'de yanıtlanır. Takip listesindeki tek uçak `position(t)`'dedir;
 * `/v2/hex` onu her yerde, çember yanıtı yalnızca çemberin içindeyse getirir. Yaşlar saniyede bir
 * örneklenir: iş için isteğin atıldığı andan, uçak için örnek zamanından beri geçen süre.
 */
function simulateWatch(opts: {
  minutes: number
  /** null: uçak artık hiçbir yanıtta gelmez (indi, transponder kapandı). */
  position: (t: number) => { lat: number; lon: number } | null
  seenPosMs: number
}): WatchSimulation {
  const plan = coveragePlan(SEED)
  const scheduler = new RequestScheduler(plan)
  const slotMs = 10_000
  const latency = 1_000
  const hex = 'aa0001'
  let latest: AircraftState | undefined
  const seenInCircle = new Map<string, number>()
  let lastWatchAt: number | null = null
  let pending: { req: PlannedRequest; at: number }[] = []
  let watchRequests = 0
  const ages = new Map<string, number[]>()
  const record = (key: string, age: number) => ages.set(key, [...(ages.get(key) ?? []), age])
  const inside = (circle: PlannedCircle, p: { lat: number; lon: number }) =>
    kmToNm(distanceKm(circle.center, p)) <= circle.radiusNm
  for (let t = 0; t <= opts.minutes * 60_000; t += 1_000) {
    for (const { req, at } of pending) {
      if (at > t) continue
      scheduler.served(req, at)
      const where = opts.position(at)
      const brings = where !== null && (req.kind === 'watch' || inside(req.circle, where))
      if (brings) latest = state(hex, { ...where, sampleTime: at - opts.seenPosMs })
      if (req.kind === 'watch') lastWatchAt = at
      else if (brings) seenInCircle.set(hex, at)
    }
    pending = pending.filter((p) => p.at > t)
    if (t % slotMs === 0) {
      const need = watchNeed([hex], () => latest, t, {
        circles: scheduler.watchCircles(),
        seenInCircleAt: (h) => seenInCircle.get(h),
        unseenSince: lastWatchAt ?? 0,
      })
      const req = scheduler.next(t, slotMs, need.dueAt)
      if (req.kind === 'watch') watchRequests += 1
      pending.push({ req, at: t + latency })
    }
    for (const [key, at] of Object.entries(scheduler.lastServed())) {
      if (at !== null) record(key, t - at + latency)
    }
    // Mağaza gibi: 120 sn'den eski son örnek düşer.
    if (latest && t - latest.sampleTime > 120_000) latest = undefined
    if (latest && opts.position(t) !== null) record('aircraft', t - latest.sampleTime)
  }
  return { watchRequests, ages }
}

function percentile(values: readonly number[] | undefined, p: number): number {
  const sorted = [...(values ?? [])].sort((a, b) => a - b)
  const value = sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]
  if (value === undefined) throw new Error('no samples')
  return value
}

describe('takip listesi ve zamanlayıcı benzetimi (0,1 istek/sn, 30 dk)', () => {
  const SLOT = 10_000

  it('batı çemberinin getirdiği uçak için /v2/hex atılmaz; Doğu hedefte kalır', () => {
    // İnceleme bulgusu: yalnızca örnek yaşına bakan eski kuralda (yaş > 30 sn − slot) bu uçak 181
    // isteğin 49'unu /v2/hex'e çekiyor, Doğu'yu 110 sn'ye kadar bayatlatıyordu.
    const { watchRequests, ages } = simulateWatch({
      minutes: 30,
      position: () => NEAR_ANKARA,
      seenPosMs: 3_000,
    })
    expect(watchRequests).toBe(0)
    expect(percentile(ages.get('primary'), 0.95)).toBeLessThanOrEqual(20_000)
    expect(percentile(ages.get('stations'), 1)).toBeLessThanOrEqual(30_000 + SLOT)
    expect(percentile(ages.get('east'), 1)).toBeLessThanOrEqual(90_000 + SLOT)
    expect(percentile(ages.get('aircraft'), 1)).toBeLessThanOrEqual(30_000 + SLOT)
  })

  it('kapsamadan çıkıp dönen uçak: takip ≤ 30 sn + slot, birincil p95 ≤ 20 sn', () => {
    // 0–10. dk Ankara yakını (batı), 10–20. dk Girit üstü (kapsama dışı), 20–30. dk yine batı.
    // Takip işi yalnızca kapsama dışındayken vardır; o sürede Doğu düşebilir (önce Doğu düşer).
    const { watchRequests, ages } = simulateWatch({
      minutes: 30,
      position: (t) => (t >= 600_000 && t < 1_200_000 ? OVER_CRETE : NEAR_ANKARA),
      seenPosMs: 3_000,
    })
    // Kapsama dışındaki 10 dk'da 30 sn'de en az bir, 20 sn'de en fazla bir istek.
    expect(watchRequests).toBeGreaterThanOrEqual(20)
    expect(watchRequests).toBeLessThanOrEqual(31)
    expect(percentile(ages.get('primary'), 0.95)).toBeLessThanOrEqual(20_000)
    expect(percentile(ages.get('stations'), 1)).toBeLessThanOrEqual(30_000 + SLOT)
    expect(percentile(ages.get('aircraft'), 1)).toBeLessThanOrEqual(30_000 + SLOT)
  })

  it('kapsama dışında susan uçak birincili aç bırakmaz; /v2/hex 30 sn’de en fazla bir kez', () => {
    // Denetim bulgusu: son tarih eski örnekte donunca uçak sustuktan sonra 11 ardışık /v2/hex
    // atılıyor, birincil ve istasyon yaşı 120 sn'ye çıkıyordu.
    const { watchRequests, ages } = simulateWatch({
      minutes: 30,
      position: (t) => (t < 300_000 ? OVER_CRETE : null),
      seenPosMs: 500,
    })
    expect(watchRequests).toBeLessThanOrEqual(Math.ceil(1_800_000 / 30_000) + 1)
    expect(percentile(ages.get('primary'), 0.95)).toBeLessThanOrEqual(20_000)
    expect(percentile(ages.get('primary'), 1)).toBeLessThanOrEqual(30_000)
    expect(percentile(ages.get('stations'), 1)).toBeLessThanOrEqual(30_000 + SLOT)
  })
})

describe('VALID_HEX', () => {
  it('ICAO hex ve ~ önekli ICAO dışı adres geçer; bozuk biçim geçmez', () => {
    for (const ok of ['4bb14b', 'ff0001', '~2c3a4f']) expect(VALID_HEX.test(ok)).toBe(true)
    for (const bad of ['', '4bb14', '4bb14bb', '4BB14B', '4b\u00008750', 'hy:ac', '~~12345'])
      expect(VALID_HEX.test(bad)).toBe(false)
  })
})

describe('trackRow', () => {
  it('örnekten iz satırı; dikey hız önce barometrik, kaynak kodu sağlayıcı × 16 + konum', () => {
    const s = state('aa0001', { source: 'localReceiver', positionSource: 'mlat' })
    expect(trackRow(42, s)).toEqual({
      flightId: 42,
      ts: new Date(T0),
      lat: 41.2,
      lon: 28.73,
      altBaroFt: 2000,
      altGeomFt: 2100,
      gsKt: 160,
      trackDeg: 355,
      verticalRateFpm: -704,
      onGround: false,
      source: trackSourceCode('localReceiver', 'mlat'),
    })
    expect(trackRow(1, state('aa0002', { baroRateFpm: null })).verticalRateFpm).toBe(-640)
  })
})
