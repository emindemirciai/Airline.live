import { destinationPoint, initialBearing } from '@havayolu/geo'
import type { PublicAircraft } from '@havayolu/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FlightPhaseTracker, type PhaseRunwayInput } from '../../lib/map/flight-phase'
import { fetchAirportRunways, toMapAirport } from './airport-data'
import { createRunwayEndsLoader } from './use-flight-phases'

const RUNWAYS: readonly PhaseRunwayInput[] = [
  {
    ends: [
      { ident: '04L', trueBearingDeg: 31, lat: 40.62, lon: -73.79 },
      { ident: '22R', trueBearingDeg: 211, lat: 40.65, lon: -73.76 },
    ],
  },
]

/** Bekleyen sözleri bitirir. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createRunwayEndsLoader: istek üzerine pist uçları (D-111)', () => {
  it('havalimanı başına oturumda bir istek; gelen uçlar izleyiciye verilir', async () => {
    const fetchRunways = vi.fn(
      async (_icao: string, _signal: AbortSignal): Promise<readonly PhaseRunwayInput[] | null> =>
        RUNWAYS,
    )
    const apply = vi.fn()
    const loader = createRunwayEndsLoader(fetchRunways, apply)
    // İzleyici yarıçaptaki her örnekte bildirir; istek havalimanı başına bir kez gider.
    for (let i = 0; i < 5; i++) loader.request('KJFK')
    loader.request('KLGA')
    loader.request('KJFK')
    await settle()
    expect(fetchRunways.mock.calls.map(([icao]) => icao)).toEqual(['KJFK', 'KLGA'])
    expect(apply.mock.calls).toEqual([
      ['KJFK', RUNWAYS],
      ['KLGA', RUNWAYS],
    ])
  })

  it('başarısız istek yinelenmez; uçlar uygulanmaz', async () => {
    const fetchRunways = vi
      .fn<(icao: string, signal: AbortSignal) => Promise<readonly PhaseRunwayInput[] | null>>()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('network'))
    const apply = vi.fn()
    const loader = createRunwayEndsLoader(fetchRunways, apply)
    loader.request('KJFK')
    loader.request('KBOS')
    await settle()
    loader.request('KJFK')
    loader.request('KBOS')
    await settle()
    expect(fetchRunways).toHaveBeenCalledTimes(2)
    expect(apply).not.toHaveBeenCalled()
  })

  it('kapatılınca süren istek kesilir, yanıtı uygulanmaz ve yeni istek gitmez', async () => {
    let resolve: (runways: readonly PhaseRunwayInput[]) => void = () => undefined
    const signals: AbortSignal[] = []
    const fetchRunways = vi.fn(
      (_icao: string, signal: AbortSignal) =>
        new Promise<readonly PhaseRunwayInput[] | null>((done) => {
          signals.push(signal)
          resolve = done
        }),
    )
    const apply = vi.fn()
    const loader = createRunwayEndsLoader(fetchRunways, apply)
    loader.request('KJFK')
    loader.destroy()
    expect(signals[0]?.aborted).toBe(true)
    resolve(RUNWAYS)
    await settle()
    loader.request('KLGA')
    expect(fetchRunways).toHaveBeenCalledTimes(1)
    expect(apply).not.toHaveBeenCalled()
  })
})

describe('istek üzerine uçlar: izleyici, yükleyici ve tek havalimanı ucu birlikte (D-111)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // İzlenen IST→JFK uçuşu (D-073): JFK 5. halkadadır, haritanın listesi uçlarını taşımaz. Eşik ve
  // ARP yaklaşık (OurAirports 04L); pist yönü uçlardan.
  const ARP = { lat: 40.6398, lon: -73.7789 }
  const T04L = { lat: 40.6223, lon: -73.7856 }
  const T22R = destinationPoint(T04L, 31, 3.68)
  const B04L = initialBearing(T04L, T22R)
  const end = (ident: string, at: { lat: number; lon: number }, bearing: number) => ({
    ident,
    trueBearingDeg: bearing,
    displacedThresholdFt: null,
    thresholdLat: at.lat,
    thresholdLon: at.lon,
  })
  const DETAIL = {
    icao: 'KJFK',
    iata: 'JFK',
    name: 'John F Kennedy International Airport',
    city: 'New York',
    ...ARP,
    elevationFt: 13,
    type: 'large_airport',
    scheduled: true,
    country: 'US',
    ring: 5,
    distanceToTrKm: 8063,
    isoRegion: 'US-NY',
    municipality: 'New York',
    runways: [
      {
        id: 1,
        lengthFt: 12079,
        ends: [end('04L', T04L, B04L), end('22R', T22R, initialBearing(T22R, T04L))],
      },
    ],
  }
  const final = (t: number, km: number): PublicAircraft => {
    const at = destinationPoint(T04L, B04L + 180, km)
    return {
      hex: '4bb26c',
      lat: at.lat,
      lon: at.lon,
      alt: 13 + km * 180,
      gnd: false,
      gs: 140,
      trk: B04L,
      vr: -700,
      cs: 'THY1',
      fn: { airline: 'TK', number: '1' },
      reg: 'TC-LGA',
      type: 'A359',
      cat: 'A5',
      sq: null,
      src: 'adsbLol',
      psrc: 'adsb_icao',
      t,
    }
  }

  it('JFK’ye inen izlenen uçak: tek istek, sonra pist etiketi 04L', async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify(DETAIL), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    // Haritanın listesindeki kayıt: uç alanı yok (5. halka, `include=map`).
    const listed = toMapAirport({ ...DETAIL, runways: [{ lengthFt: 12079 }] })
    expect(listed?.runways).toEqual([{ lengthFt: 12079 }])
    const tracker = new FlightPhaseTracker()
    const loader = createRunwayEndsLoader(
      (icao, signal) => fetchAirportRunways('http://localhost:4100', icao, signal),
      (icao, runways) => tracker.setRunwayEnds(icao, runways),
    )
    tracker.setMissingEndsHandler(loader.request)
    tracker.setAirports(listed ? [listed] : [])
    tracker.observe([final(1_000, 6)])
    expect(tracker.get('4bb26c')).toMatchObject({ phase: 'landing', runway: null })
    tracker.observe([final(2_000, 5.5)])
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://localhost:4100/v1/airports/KJFK')
    tracker.observe([final(3_000, 5)])
    expect(tracker.get('4bb26c')).toMatchObject({ phase: 'landing', runway: '04L' })
    tracker.observe([final(4_000, 4.5)])
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    loader.destroy()
  })
})
