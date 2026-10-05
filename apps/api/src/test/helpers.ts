// Yalnızca testlerde kullanılan yardımcılar (üretim kodu bunları import edemez).
import {
  EMPTY_AIRLINE_CODES,
  REFERENCE_SOURCES,
  TRACK_TABLES,
  type AirlineCodes,
  type CoverageCircle,
  type ProviderSummary,
} from '@havayolu/db'
import type { AircraftState } from '@havayolu/providers'
import { buildApp, type AppDeps } from '../app'
import type { ServiceProbes } from '../admin/services'
import { hashToken, newToken, type AdminSession, type SessionStore } from '../auth/session-store'
import { parseEnv } from '../env'
import { coverageOf, inBbox } from '../live/bbox'
import type {
  Bbox,
  CoverageState,
  LiveSource,
  LiveStatus,
  PublicAircraft,
  TickDiff,
} from '../live/types'

/** Süreç içi oturum deposu (test ikamesi). Redis sürümü integration testinde denenir. */
export class InMemorySessionStore implements SessionStore {
  readonly sessions = new Map<string, AdminSession>()

  async create(email: string) {
    const token = newToken()
    this.sessions.set(hashToken(token), {
      email,
      role: 'ADMIN',
      createdAt: new Date().toISOString(),
    })
    return { token, expiresInSeconds: 604_800 }
  }

  async get(token: string) {
    return this.sessions.get(hashToken(token)) ?? null
  }

  async revoke(token: string) {
    this.sessions.delete(hashToken(token))
  }
}

export const ADMIN_EMAIL = 'yonetici@example.com'
export const ADMIN_SETUP_TOKEN = 'kurulum-anahtari-en-az-otuz-iki-karakter-uzun'

export function testEnv(overrides: Record<string, string | undefined> = {}) {
  return parseEnv({
    APP_ENV: 'test',
    LOG_LEVEL: 'silent',
    GIT_SHA: 'abc1234',
    ADMIN_EMAIL,
    ADMIN_SETUP_TOKEN,
    ...overrides,
  })
}

/** adsb.lol için sağlıklı bir provider_health özeti (fakeProbes saatine göre 20 sn önce yazılmış). */
export function fakeProviderSummary(overrides: Partial<ProviderSummary> = {}): ProviderSummary {
  return {
    provider: 'adsbLol',
    status: 'ok',
    lastSuccessAt: new Date('2026-09-25T11:59:52Z'),
    lastErrorAt: null,
    lastError: null,
    consecutiveFailures: 0,
    rps: 0.1,
    circuit: 'closed',
    backoffUntil: null,
    freshnessP95S: 14.26,
    errorRatio60s: 0,
    requests60s: 6,
    updatedAt: new Date('2026-09-25T11:59:40Z'),
    rateLimitedRatio1h: 0.004,
    rateLimitedRatio24h: 0.0123,
    ...overrides,
  }
}

export function fakeProbes(overrides: Partial<Omit<ServiceProbes, 'api'>> = {}) {
  const now = new Date('2026-09-25T12:00:00Z')
  const probes: Omit<ServiceProbes, 'api'> = {
    postgres: async () => ({ latencyMs: 3 }),
    redisQueue: async () => ({
      latencyMs: 1,
      usedBytes: 10 * 1024 * 1024,
      maxBytes: 128 * 1024 * 1024,
    }),
    redisLive: async () => ({
      latencyMs: 1,
      usedBytes: 20 * 1024 * 1024,
      maxBytes: 192 * 1024 * 1024,
    }),
    heartbeats: async () => [
      {
        service: 'worker-rt',
        roles: ['ingest', 'engine'],
        version: '0.3.0',
        gitSha: 'abc1234',
        pid: 1,
        startedAt: '2026-09-25T11:00:00Z',
        at: '2026-09-25T11:59:50Z',
      },
      {
        service: 'worker-bg',
        roles: ['notifier', 'jobs'],
        version: '0.3.0',
        gitSha: 'abc1234',
        pid: 2,
        startedAt: '2026-09-25T11:00:00Z',
        at: '2026-09-25T11:59:55Z',
      },
    ],
    referenceData: async () => ({
      airports: 6347,
      runways: 7977,
      airlines: 5964,
      sources: REFERENCE_SOURCES.map((source) => ({
        source,
        origin: 'remote',
        etag: '"etag"',
        lastModified: null,
        checkedAt: new Date('2026-09-25T04:40:00Z'),
        importedAt: new Date('2026-09-25T04:40:00Z'),
        rowCount: 1,
        skippedCount: 0,
        lastError: null,
        lastErrorAt: null,
        updatedAt: new Date('2026-09-25T04:40:00Z'),
      })),
    }),
    trackPartitions: async () =>
      Object.fromEntries(
        TRACK_TABLES.map((table) => [
          table,
          {
            partitions: 9,
            oldestDay: '2026-09-24',
            newestDay: '2026-10-02',
            daysAhead: 7,
            defaultRows: 0,
          },
        ]),
      ),
    // Yerel alıcı tanımlı değil: yalnızca adsb.lol satırı var.
    providers: async () => [fakeProviderSummary()],
    http: async (url: string) => ({
      status: 200,
      body: url.includes('health') ? { status: 'ok' } : { version: '0.3.0' },
      latencyMs: 5,
    }),
    webUrl: 'http://web.test/api/version',
    analyticsUrl: null,
    expectedWorkers: ['worker-rt', 'worker-bg'],
    now: () => now,
    ...overrides,
  }
  return probes
}

/** Test havayolu kodları: THY→TK, PGT→PC, TKJ ve VLU→VF (VF iki ICAO'ya karşılık gelir). */
export function testAirlineCodes(): AirlineCodes {
  return {
    icaoToIata: new Map([
      ['THY', 'TK'],
      ['PGT', 'PC'],
      ['TKJ', 'VF'],
      ['VLU', 'VF'],
    ]),
    iataToIcao: new Map([
      ['TK', ['THY']],
      ['PC', ['PGT']],
      ['VF', ['TKJ', 'VLU']],
    ]),
  }
}

/** redis-live'da saklanan biçimde (`AircraftState`) bir uçak; varsayılan İstanbul üstünde THY974. */
export function aircraftState(overrides: Partial<AircraftState> = {}): AircraftState {
  return {
    hex: '4bb1a2',
    nonIcao: false,
    callsign: 'THY974',
    registration: 'TC-JJA',
    typeCode: 'B77W',
    category: 'A5',
    dbFlags: 0,
    positionSource: 'adsb_icao',
    lat: 41.2753,
    lon: 28.7519,
    altBaroFt: 12_000,
    onGround: false,
    altGeomFt: 12_300,
    navQnhHpa: 1013.2,
    gsKt: 310.4,
    trackDeg: 179.44,
    trueHeadingDeg: 178,
    baroRateFpm: -1_216,
    geomRateFpm: -1_200,
    iasKt: 250,
    tasKt: 300,
    mach: 0.5,
    windDirDeg: 40,
    windSpeedKt: 12,
    oatC: -5,
    selAltFt: 10_000,
    navModes: ['autopilot'],
    squawk: '2301',
    emergency: null,
    sampleTime: Date.UTC(2026, 8, 28, 12, 0, 0),
    seenPosS: 0.4,
    source: 'adsbLol',
    ...overrides,
  }
}

/** Herkese açık kayıt (`PublicAircraft`); varsayılan İstanbul üstünde THY974. */
export function publicAircraft(overrides: Partial<PublicAircraft> = {}): PublicAircraft {
  return {
    hex: '4bb1a2',
    lat: 41.2753,
    lon: 28.7519,
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
    t: Date.UTC(2026, 8, 28, 12, 0, 0),
    ...overrides,
  }
}

/**
 * Elle doldurulan `LiveSource` (test ikamesi). `aircraft` görünür kümedir (gizlilik uygulanmış
 * sayılır); `emit` bir farkı dinleyicilere iletir ve geçmişe ekler.
 */
export class FakeLiveSource implements LiveSource {
  readonly aircraft = new Map<string, PublicAircraft>()
  readonly history: TickDiff[] = []
  readonly listeners = new Set<(diff: TickDiff) => void>()
  seqValue = 0
  circles: readonly CoverageCircle[] | null = null
  statusValue: LiveStatus = {
    providers: { adsbLol: 'ok' },
    primaryAgeS: 4.2,
    newestAgeS: 1.5,
  }

  constructor(list: readonly PublicAircraft[] = []) {
    for (const a of list) this.aircraft.set(a.hex, a)
  }

  seq() {
    return this.seqValue
  }

  snapshot(bbox?: Bbox) {
    return [...this.aircraft.values()].filter((a) => bbox === undefined || inBbox(a, bbox))
  }

  get(hex: string) {
    return this.aircraft.get(hex)
  }

  all() {
    return this.aircraft.values()
  }

  diffsSince(afterSeq: number) {
    if (afterSeq === this.seqValue) return []
    const first = this.history[0]
    if (first === undefined || afterSeq > this.seqValue || first.seq > afterSeq + 1) return null
    return this.history.filter((d) => d.seq > afterSeq)
  }

  status() {
    return this.statusValue
  }

  coverage(bbox: Bbox): CoverageState {
    return coverageOf(bbox, this.circles)
  }

  onTick(listener: (diff: TickDiff) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(diff: Omit<TickDiff, 'seq'>) {
    this.seqValue += 1
    for (const a of [...diff.added, ...diff.updated]) this.aircraft.set(a.hex, a)
    for (const r of diff.removed) this.aircraft.delete(r.hex)
    const full: TickDiff = { seq: this.seqValue, ...diff }
    this.history.push(full)
    for (const listener of this.listeners) listener(full)
    return full
  }
}

export async function testApp(
  options: { env?: Record<string, string | undefined>; deps?: Partial<AppDeps> } = {},
) {
  const store = new InMemorySessionStore()
  const app = await buildApp(testEnv(options.env), {
    sessionStore: store,
    readiness: { postgres: async () => 1, redisQueue: async () => 1, redisLive: async () => 1 },
    probes: fakeProbes(),
    rateLimitRedis: null,
    live: { source: null, codes: () => EMPTY_AIRLINE_CODES },
    blocklistRedis: null,
    arrivalCoverage: null,
    airports: { list: null },
    weather: { stations: null, latest: null },
    ...options.deps,
  })
  return { app, store }
}

export async function login(app: Awaited<ReturnType<typeof testApp>>['app']) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: ADMIN_EMAIL, password: ADMIN_SETUP_TOKEN },
  })
  return (res.json() as { token: string }).token
}
