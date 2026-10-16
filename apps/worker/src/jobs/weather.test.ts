import { join } from 'node:path'
import type {
  MetarWrite,
  TafWrite,
  WeatherCheck,
  WeatherFailure,
  WeatherKind,
  WeatherSourceState,
} from '@havayolu/db'
import {
  AWC_MAX_ENTRIES,
  AWC_METAR_MAX_HOURS,
  AviationWeatherError,
  createAviationWeatherClient,
  parseMetarResponse,
  parseTafResponse,
  type MetarReport,
} from '@havayolu/providers'
import { UnrecoverableError } from 'bullmq'
import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import { parseEnv } from '../env'
import { weatherMode } from './index'
import { findFixturesDir } from './reference'
import {
  awcWeatherSource,
  FORBIDDEN_BLOCK_SEC,
  metarLookbackHours,
  metarQnhHpa,
  RATE_LIMIT_BLOCK_SEC,
  runWeatherMetar,
  runWeatherPrune,
  runWeatherTaf,
  type WeatherFetch,
  type WeatherSource,
  type WeatherStore,
  weatherStations,
} from './weather'
import {
  fixtureShiftMs,
  fixtureWeatherSource,
  loadWeatherFixtures,
  rebaseMetarRaw,
  rebaseTafRaw,
  rebaseWeatherFixtures,
  resolveDayTime,
  WeatherFixtureError,
  weatherFixturesDir,
} from './weather-fixture'

const log = pino({ level: 'silent' })
const fixturesRoot = findFixturesDir()
if (!fixturesRoot) throw new Error('tools/fixtures bulunamadı')
const weatherDir = join(fixturesRoot, 'weather')
const FIXTURE_NOW = new Date('2026-01-15T13:00:00Z')
const at = (value: string) => new Date(value)

describe('weatherMode', () => {
  const env = (vars: Record<string, string>) => parseEnv({ APP_ENV: 'test', ...vars })

  it('dış istek açıksa aviationweather.gov; kapalıysa dev/test fixture, üretimde kapalı (nedeniyle)', () => {
    expect(
      weatherMode(env({ EXTERNAL_PROVIDERS_DISABLED: 'false' }), '0.11.0', fixturesRoot).kind,
    ).toBe('remote')
    const fixture = weatherMode(env({}), '0.11.0', fixturesRoot)
    expect(fixture).toMatchObject({ kind: 'fixture', origin: 'fixture', dir: weatherDir })
    expect(weatherMode(env({ APP_ENV: 'development' }), '0.11.0', fixturesRoot).kind).toBe(
      'fixture',
    )
    const production = parseEnv({
      APP_ENV: 'production',
      EXTERNAL_PROVIDERS_DISABLED: 'true',
      DATABASE_URL: 'postgres://u:p@db:5432/x',
      REDIS_QUEUE_URL: 'redis://:p@q:6379/0',
    })
    // Üretimde fixture klasörü bulunsa bile kullanılmaz.
    const disabled = weatherMode(production, '0.11.0', fixturesRoot)
    expect(disabled).toEqual({
      kind: 'disabled',
      reason: expect.stringContaining('EXTERNAL_PROVIDERS_DISABLED=true'),
    })
    expect(weatherMode(env({}), '0.11.0', null).kind).toBe('disabled')
    expect(weatherFixturesDir(join(fixturesRoot, 'yok'))).toBeNull()
  })

  it('fixture kaynağı yalnızca development ve test ortamında kurulur', () => {
    expect(() => fixtureWeatherSource({ dir: weatherDir, appEnv: 'production' })).toThrow(
      WeatherFixtureError,
    )
  })
})

describe('fixture zaman kaydırması', () => {
  it('kaydırma tam saattir; fixtureNow içinde bulunulan saatin başına düşer', () => {
    expect(fixtureShiftMs(FIXTURE_NOW, at('2026-01-15T13:59:59Z'))).toBe(0)
    expect(fixtureShiftMs(FIXTURE_NOW, at('2026-10-01T09:37:00Z'))).toBe(
      at('2026-10-01T09:00:00Z').getTime() - FIXTURE_NOW.getTime(),
    )
  })

  it('gün grubu çapaya en yakın aya çözülür; o ayda olmayan gün atlanır', () => {
    expect(resolveDayTime(31, 18, 0, at('2026-02-01T06:00:00Z'))?.toISOString()).toBe(
      '2026-01-31T18:00:00.000Z',
    )
    expect(resolveDayTime(1, 24, 0, at('2026-01-31T12:00:00Z'))?.toISOString()).toBe(
      '2026-02-02T00:00:00.000Z',
    )
    // 30 Şubat yok: Ocak ya da Mart'tan yakın olan (30 Ocak 28 gün, 30 Mart 31 gün uzakta).
    expect(resolveDayTime(30, 0, 0, at('2026-02-27T00:00:00Z'))?.toISOString()).toBe(
      '2026-01-30T00:00:00.000Z',
    )
    expect(resolveDayTime(32, 0, 0, FIXTURE_NOW)).toBeNull()
  })

  it('METAR: zaman grubu ve eğilim saatleri kaydırılır, ay geçişi dahil; RMK sonrasına dokunulmaz', () => {
    const shift = at('2026-02-01T02:00:00Z').getTime() - FIXTURE_NOW.getTime()
    expect(
      rebaseMetarRaw(
        'LTFM 151250Z 03018KT 9999 BKN035 09/05 Q1009 BECMG FM1300 TL1500 3000 RMK 151250Z FM1300',
        at('2026-01-15T12:50:00Z'),
        shift,
      ),
    ).toBe(
      'LTFM 010150Z 03018KT 9999 BKN035 09/05 Q1009 BECMG FM0200 TL0400 3000 RMK 151250Z FM1300',
    )
    expect(rebaseMetarRaw('METAR COR LTFM 140620Z 22018KT', at('2026-01-14T06:20:00Z'), 0)).toBe(
      'METAR COR LTFM 140620Z 22018KT',
    )
  })

  it('TAF: yayın, geçerlilik, değişim grupları, FM ve TX/TN kaydırılır; 24 saati korunur', () => {
    const anchor = at('2026-01-15T12:00:00Z')
    const shift = at('2026-01-31T13:00:00Z').getTime() - FIXTURE_NOW.getTime()
    expect(
      rebaseTafRaw(
        'TAF LTBA 151040Z 1512/1612 04010KT CAVOK TX12/1512Z TNM02/1604Z BECMG 1600/1602 3000 BR FM161000 05012KT TEMPO 1520/1524 4000',
        anchor,
        shift,
      ),
    ).toBe(
      'TAF LTBA 311040Z 3112/0112 04010KT CAVOK TX12/3112Z TNM02/0104Z BECMG 0100/0102 3000 BR FM011000 05012KT TEMPO 3120/3124 4000',
    )
  })

  it('bütün fixture kaydırılır; kaydırılmış raporlar ayrıştırıcıdan kayıpsız geçer', () => {
    const now = at('2026-10-01T09:37:00Z')
    const rebased = rebaseWeatherFixtures(loadWeatherFixtures(weatherDir), now)
    expect(rebased.fixtureNow.toISOString()).toBe('2026-10-01T09:00:00.000Z')
    const metars = parseMetarResponse(rebased.metars, { now: now.getTime() })
    const tafs = parseTafResponse(rebased.tafs, { now: now.getTime() })
    expect(metars.skipped).toEqual([])
    expect(tafs.skipped).toEqual([])
    const ltfm = metars.items.filter((m) => m.station === 'LTFM')
    const newest = ltfm.reduce((a, b) => (a.observedAt > b.observedAt ? a : b))
    expect(newest.observedAt.toISOString()).toBe('2026-10-01T08:50:00.000Z')
    expect(newest.raw).toBe(
      'LTFM 010850Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA',
    )
    // Geçmiş ay sınırını geçer (28 Eylül → 1 Ekim); ham gün ile epoch tutarlı kalır.
    for (const m of metars.items) {
      const day = m.raw
        .split(' ')
        .find((w) => /^\d{6}Z$/.test(w))
        ?.slice(0, 2)
      expect(Number(day)).toBe(m.observedAt.getUTCDate())
    }
    const oldest = ltfm.reduce((a, b) => (a.observedAt < b.observedAt ? a : b))
    expect(oldest.observedAt.toISOString()).toBe('2026-09-28T09:20:00.000Z')
    const current = tafs.items.find((t) => t.station === 'LTFM' && t.mostRecent)
    expect(current?.raw).toBe(
      'TAF LTFM 010640Z 0108/0214 03015G28KT 9999 SCT025 BKN035 TEMPO 0108/0114 4000 SHRA FEW025CB PROB30 TEMPO 0110/0114 TSRA BECMG 0116/0118 02008KT',
    )
    expect(current?.validFrom.toISOString()).toBe('2026-10-01T08:00:00.000Z')
    expect(current?.validTo.toISOString()).toBe('2026-10-02T14:00:00.000Z')
  })

  it("fixture kaynağı yalnızca istenen istasyonları verir; raporu olmayan istasyon 204'tür", async () => {
    const source = fixtureWeatherSource({
      dir: weatherDir,
      appEnv: 'test',
      now: () => at('2026-10-01T09:37:00Z'),
    })
    const all = await source.metars(['LTFM', 'LTBA', 'LTBQ'], { hours: 2 })
    expect(all.status).toBe(200)
    expect(new Set(all.items.map((m) => m.station))).toEqual(new Set(['LTFM', 'LTBA']))
    expect(await source.metars(['LTBQ'], { hours: 2 })).toEqual({
      status: 204,
      items: [],
      skipped: [],
    })
    expect((await source.tafs(['LTBJ'])).items).toHaveLength(1)
  })

  it("1. halka fixture'ları (D-080): yabancı istasyonların raporları kaydırılır ve ayrıştırılır", async () => {
    const source = fixtureWeatherSource({
      dir: weatherDir,
      appEnv: 'test',
      now: () => at('2026-10-01T09:37:00Z'),
    })
    const ring1 = ['LGAV', 'LGTS', 'LCLK', 'LCEN', 'LBSF', 'UGTB']
    const metars = await source.metars(ring1, { hours: 2 })
    expect(metars.skipped).toEqual([])
    expect(metars.items.map((m) => m.station).sort()).toEqual([...ring1].sort())
    const observed = Object.fromEntries(
      metars.items.map((m) => [m.station, m.observedAt.toISOString()]),
    )
    // :50 gözlemleri 10 dk, :30 gözlemleri (LBSF, UGTB) 30 dk önce (kaydırılmış saat 09:00).
    expect(observed).toMatchObject({
      LGAV: '2026-10-01T08:50:00.000Z',
      LCEN: '2026-10-01T08:50:00.000Z',
      LBSF: '2026-10-01T08:30:00.000Z',
      UGTB: '2026-10-01T08:30:00.000Z',
    })
    expect(metars.items.find((m) => m.station === 'UGTB')?.raw).toBe(
      'UGTB 010830Z 31006MPS 6000 BR BKN025 03/M01 Q1027 NOSIG',
    )
    const tafs = await source.tafs(ring1)
    expect(tafs.skipped).toEqual([])
    expect(new Set(tafs.items.map((t) => t.station))).toEqual(
      new Set(['LGAV', 'LCLK', 'LBSF', 'UGTB']),
    )
    expect(tafs.items.find((t) => t.station === 'LGAV')?.raw).toBe(
      'TAF LGAV 010700Z 0108/0208 02015KT 9999 FEW025 TEMPO 0108/0114 02020G30KT BECMG 0116/0118 36008KT',
    )
  })
})

describe('weatherStations', () => {
  it('listelenen havalimanlarının ICAO kodları: liste sırasıyla, tekil; ICAO olmayan kod atlanır', () => {
    expect(
      weatherStations([
        { icao: 'LTFM' },
        { icao: 'LGAV' },
        { icao: 'LCEN' },
        { icao: 'TR-0042' },
        { icao: '5A8' },
        { icao: 'LTFM' },
        { icao: 'UGTB' },
      ]),
    ).toEqual(['LTFM', 'LGAV', 'LCEN', 'UGTB'])
    expect(weatherStations([])).toEqual([])
  })
})

describe('metarQnhHpa', () => {
  it('ana gövdedeki Qdddd; eğilim ve RMK sonrası okunmaz; A biçimi çevrilir', () => {
    expect(metarQnhHpa('LTFM 151250Z 03018G32KT 9999 09/05 Q1009 TEMPO 4000 SHRA')).toBe(1009)
    expect(metarQnhHpa('METAR COR LTFM 140620Z 22018KT 9999 10/08 Q0998')).toBe(998)
    expect(metarQnhHpa('LTFM 151250Z 03018KT 9999 09/05 Q//// NOSIG')).toBeNull()
    expect(metarQnhHpa('LTFM 151250Z 03018KT 9999 09/05 NOSIG Q1009')).toBeNull()
    expect(metarQnhHpa('KJFK 151251Z 31010KT 10SM FEW250 02/M10 A3010 RMK AO2')).toBe(1019)
    expect(metarQnhHpa('LTFM 151250Z 03018KT 9999 09/05 Q0500')).toBeNull()
  })
})

// ---------------------------------------------------------------------------------------------
// İş akışları: bellek içi sahte depo ve kaynak.

function fakeStore(
  options: {
    stations?: string[] | (() => string[])
    source?: Partial<WeatherSourceState>
    /** Son 24 saatte METAR'ı saklı istasyonlar; verilmezse bütün istasyonlar. */
    stored?: readonly string[]
  } = {},
) {
  const stationsOf = () =>
    typeof options.stations === 'function'
      ? options.stations()
      : (options.stations ?? ['LTFM', 'LTBA', 'LTBQ'])
  const calls = {
    since: [] as [readonly string[], Date][],
    metars: [] as MetarWrite[][],
    tafs: [] as TafWrite[][],
    checks: [] as [WeatherKind, WeatherCheck][],
    errors: [] as [WeatherKind, WeatherFailure][],
    disabled: [] as [WeatherKind, string][],
    pruned: [] as [Date, readonly string[]][],
    retained: [] as [string, readonly string[], number][],
  }
  const state: WeatherSourceState | null = options.source
    ? {
        kind: 'metar',
        origin: 'remote',
        disabledReason: null,
        checkedAt: null,
        stationCount: null,
        reportCount: null,
        skippedCount: null,
        lastError: null,
        lastErrorAt: null,
        blockedUntil: null,
        blockedKind: null,
        updatedAt: FIXTURE_NOW,
        ...options.source,
      }
    : null
  const store: WeatherStore = {
    stations: async () => stationsOf(),
    metarStationsSince: async (stations, since) => {
      calls.since.push([stations, since])
      return stations.filter((s) => (options.stored ?? stationsOf()).includes(s))
    },
    source: async () => state,
    upsertMetars: async (rows) => {
      calls.metars.push([...rows])
      return { inserted: rows.length, updated: 0, unchanged: 0 }
    },
    upsertTafs: async (rows) => {
      calls.tafs.push([...rows])
      return { inserted: rows.length, updated: 0, unchanged: 0 }
    },
    retainMetars: async (stations, rows) => {
      calls.retained.push(['metar', stations, rows.length])
      return 2
    },
    retainTafs: async (stations, rows) => {
      calls.retained.push(['taf', stations, rows.length])
      return 3
    },
    recordCheck: async (kind, check) => {
      calls.checks.push([kind, check])
    },
    recordError: async (kind, failure) => {
      calls.errors.push([kind, failure])
    },
    recordDisabled: async (kind, reason) => {
      calls.disabled.push([kind, reason])
    },
    prune: async (now, stations) => {
      calls.pruned.push([now, stations])
      return { metar: 1, taf: 2, unlisted: 3 }
    },
  }
  return { store, calls }
}

function fakeSource(metars: () => Promise<WeatherFetch<MetarReport>>) {
  const requested: (readonly string[])[] = []
  const hours: number[] = []
  const source: WeatherSource = {
    metars: async (ids, options) => {
      requested.push(ids)
      hours.push(options.hours)
      return metars()
    },
    tafs: async (ids) => {
      requested.push(ids)
      return { status: 204, items: [], skipped: [] }
    },
  }
  return { source, requested, hours }
}

const report = (station: string, observed: string, raw: string): MetarReport => ({
  station,
  type: 'METAR',
  observedAt: at(observed),
  raw,
  flightCategory: 'VFR',
})

describe('runWeatherMetar', () => {
  const now = () => FIXTURE_NOW

  it('raporları QNH ile yazar, kontrolü kaydeder; atlananlar sayılır', async () => {
    const { store, calls } = fakeStore()
    const { source, requested } = fakeSource(async () => ({
      status: 200,
      items: [
        report('LTFM', '2026-01-15T12:50:00Z', 'LTFM 151250Z 03018G32KT 9999 09/05 Q1009 NOSIG'),
        report('LTBA', '2026-01-15T12:50:00Z', 'LTBA 151250Z 04008KT CAVOK 10/03 Q1010 NOSIG'),
        // 30 günden eski rapor yazılmaz.
        report('LTBA', '2025-12-01T12:50:00Z', 'LTBA 011250Z 04008KT CAVOK 10/03 Q1010'),
      ],
      skipped: [{ station: 'LTFM', reason: 'raw_invalid' }],
    }))
    const result = await runWeatherMetar({ store, source, origin: 'remote', log, now })
    expect(requested).toEqual([['LTFM', 'LTBA', 'LTBQ']])
    expect(calls.metars[0]).toEqual([
      {
        stationIcao: 'LTFM',
        reportType: 'METAR',
        observedAt: at('2026-01-15T12:50:00Z'),
        rawText: 'LTFM 151250Z 03018G32KT 9999 09/05 Q1009 NOSIG',
        qnhHpa: 1009,
        flightCategory: 'VFR',
      },
      expect.objectContaining({ stationIcao: 'LTBA', qnhHpa: 1010 }),
    ])
    expect(calls.checks).toEqual([
      [
        'metar',
        { origin: 'remote', now: FIXTURE_NOW, stationCount: 3, reportCount: 3, skippedCount: 1 },
      ],
    ])
    expect(result).toMatchObject({
      status: 200,
      stations: 3,
      reports: 3,
      stationsWithReport: 2,
      skipped: 1,
      // Sahte kaynak istek saymaz.
      requests: 0,
      written: { inserted: 2 },
      removed: 0,
    })
    // Uzak kaynakta hiçbir satır silinmez.
    expect(calls.retained).toEqual([])
  })

  it('kesintiden sonra geriye bakış son başarılı kontrolü kapsar (kayıtta delik kalmaz)', async () => {
    const hour = 3_600_000
    const run = async (checkedAt: Date | null) => {
      const { store } = fakeStore({ source: { checkedAt } })
      const { source, hours } = fakeSource(async () => ({ status: 204, items: [], skipped: [] }))
      await runWeatherMetar({ store, source, origin: 'remote', log, now })
      return hours
    }
    // Olağan 5 dk: 2 saat. Son kontrol 5 saat önce (ör. 4 saatlik 429 engeli): 6 saat.
    expect(await run(new Date(FIXTURE_NOW.getTime() - 5 * 60_000))).toEqual([2])
    expect(await run(new Date(FIXTURE_NOW.getTime() - 5 * hour))).toEqual([6])
    // Hiç kontrol yok (ilk açılış) ya da çok uzun kesinti: en çok 24 saat.
    expect(await run(null)).toEqual([AWC_METAR_MAX_HOURS])
    expect(await run(new Date(FIXTURE_NOW.getTime() - 3 * 24 * hour))).toEqual([
      AWC_METAR_MAX_HOURS,
    ])
    // Durum satırı hiç yoksa da 24 saat.
    const { store } = fakeStore()
    const { source, hours } = fakeSource(async () => ({ status: 204, items: [], skipped: [] }))
    await runWeatherMetar({ store, source, origin: 'remote', log, now })
    expect(hours).toEqual([AWC_METAR_MAX_HOURS])
  })

  it('Türkiye + 1.–4. halka (1.217 istasyon): yayından sonra 719 yeni istasyon 24 saatle (ilk çalışma 127 istek), sonra 16 olağan istek', async () => {
    // 1.217 istasyon × 2 saatte 4 METAR/SPECI = 4.868 kayıt; tek istek 400 sınırına takılırdı (D-080,
    // D-102). Yayın anında kaydı olan 498 istasyon (Türkiye, 1.–3. halka; askerî üsler yok, D-107)
    // olağan 2 saatle (80 × 6 + 18), 4. halkanın 719 istasyonu ayrı isteklerle 24 saatle istenir
    // (6'şarlı 120 istek: 119 × 6 + 5); ilk çalışma 127 istektir (3. halkanın yayınında 225 + 278
    // istasyonla 3 + 47 = 50 istekti).
    const stations = Array.from({ length: 1217 }, (_, i) => {
      const letter = (n: number) => String.fromCharCode(65 + (Math.floor(i / 26 ** n) % 26))
      return `X${letter(2)}${letter(1)}${letter(0)}`
    })
    const { store, calls } = fakeStore({
      stations,
      stored: stations.slice(0, 498),
      source: { checkedAt: new Date(FIXTURE_NOW.getTime() - 5 * 60_000) },
    })
    const backfilled = new Set<string>()
    const requests: URL[] = []
    const fetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input))
      requests.push(url)
      const ids = url.searchParams.get('ids')?.split(',') ?? []
      const body = ids.flatMap((id) =>
        [10, 40, 70, 100].map((minutesAgo) => {
          const observed = new Date(FIXTURE_NOW.getTime() - minutesAgo * 60_000)
          const ddhhmm = [observed.getUTCDate(), observed.getUTCHours(), observed.getUTCMinutes()]
            .map((n) => String(n).padStart(2, '0'))
            .join('')
          return {
            icaoId: id,
            obsTime: observed.getTime() / 1000,
            metarType: 'METAR',
            rawOb: `${id} ${ddhhmm}Z 00000KT 9999 Q1010`,
          }
        }),
      )
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof globalThis.fetch
    // İstekler arası en kısa aralık (D-090) providers testinde sahte saatle denetlenir; burada 143
    // istek gerçek saatte ~100 sn beklerdi.
    const client = createAviationWeatherClient({
      userAgent: 'havayolu/0.12.0 (+https://airline.live)',
      fetch,
      now: () => FIXTURE_NOW.getTime(),
      minIntervalMs: 0,
    })
    const run = () =>
      runWeatherMetar({
        store,
        source: awcWeatherSource(client),
        origin: 'remote',
        log,
        now,
        backfilled,
      })
    const result = await run()
    expect(requests.map((u) => u.searchParams.get('hours'))).toEqual([
      ...Array.from({ length: 7 }, () => '2'),
      ...Array.from({ length: 120 }, () => String(AWC_METAR_MAX_HOURS)),
    ])
    expect(requests.map((u) => u.searchParams.get('ids')?.split(',').length)).toEqual([
      ...Array.from({ length: 6 }, () => 80),
      18,
      ...Array.from({ length: 119 }, () => 6),
      5,
    ])
    expect(requests).toHaveLength(127)
    expect(80 * 4).toBeLessThan(AWC_MAX_ENTRIES)
    expect(result).toMatchObject({
      status: 200,
      stations: 1217,
      reports: 1217 * 4,
      stationsWithReport: 1217,
      truncated: false,
      // Çalışma sonucu (ve günlüğü) istek sayısını taşır (D-101): olağan 7 + doldurma 120.
      requests: 127,
    })
    expect(calls.metars[0]).toHaveLength(1217 * 4)
    expect(calls.metars[0]?.[0]?.rawText).toBe('XAAA 151250Z 00000KT 9999 Q1010')

    // Sonraki çalışmada bütün istasyonlar olağan geriye bakışla: 16 istek (80 × 15 + 17).
    requests.length = 0
    expect(await run()).toMatchObject({ status: 200, stations: 1217, requests: 16 })
    expect(requests.map((u) => u.searchParams.get('hours'))).toEqual(
      Array.from({ length: 16 }, () => '2'),
    )
    expect(requests.map((u) => u.searchParams.get('ids')?.split(',').length)).toEqual([
      ...Array.from({ length: 15 }, () => 80),
      17,
    ])
  })

  it('5. halka ölçeği (3.264 sentetik istasyon, D-111): geri doldurma sınırı yok; 2.087 yeni istasyonlu ilk çalışma 363 istek, sonra 41', async () => {
    // 5. halkanın hava istasyonları 3.264'tür (3.266 listelenen, savaş kapanışlarıyla, D-110; CAJ4 ve
    // CAT4'ün dört harfli METAR kodu yok). Yayın anında son 24 saatte kaydı olan 1.177 istasyon
    // olağan 2 saatle (80 × 14 + 57 = 15 istek), kaydı olmayan 2.087 istasyon 24 saatle 6'şarlı
    // (6 × 347 + 5: 348 istek) istenir: ilk çalışma 363 istek, 700 ms aralıkla en az ~254 sn (aralık
    // providers testinde sahte saatle). D-110'dan önce 3.241 istasyonla 2.064 yeni, 359 istek. Sınır konmaz:
    // bir sınır, istasyonları `backfilled`'e yazdığı için kalanları hiç doldurmazdı (eleştiri F3).
    const stations = Array.from({ length: 3264 }, (_, i) => {
      const letter = (n: number) => String.fromCharCode(65 + (Math.floor(i / 26 ** n) % 26))
      return `X${letter(2)}${letter(1)}${letter(0)}`
    })
    const { store } = fakeStore({
      stations,
      stored: stations.slice(0, 1177),
      source: { checkedAt: new Date(FIXTURE_NOW.getTime() - 5 * 60_000) },
    })
    const backfilled = new Set<string>()
    const requests: URL[] = []
    const fetch = (async (input: string | URL | Request) => {
      requests.push(new URL(String(input)))
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof globalThis.fetch
    const client = createAviationWeatherClient({
      userAgent: 'havayolu/0.26.0 (+https://airline.live)',
      fetch,
      now: () => FIXTURE_NOW.getTime(),
      minIntervalMs: 0,
    })
    const run = () =>
      runWeatherMetar({
        store,
        source: awcWeatherSource(client),
        origin: 'remote',
        log,
        now,
        backfilled,
      })
    expect(await run()).toMatchObject({ status: 200, stations: 3264, requests: 363 })
    expect(requests.map((u) => u.searchParams.get('hours'))).toEqual([
      ...Array.from({ length: 15 }, () => '2'),
      ...Array.from({ length: 348 }, () => String(AWC_METAR_MAX_HOURS)),
    ])
    expect(requests.map((u) => u.searchParams.get('ids')?.split(',').length)).toEqual([
      ...Array.from({ length: 14 }, () => 80),
      57,
      ...Array.from({ length: 347 }, () => 6),
      5,
    ])
    expect(backfilled.size).toBe(3264)

    // Sonraki çalışmalar olağan: 41 METAR isteği (80 × 40 + 64).
    requests.length = 0
    expect(await run()).toMatchObject({ status: 200, stations: 3264, requests: 41 })
    expect(requests.map((u) => u.searchParams.get('ids')?.split(',').length)).toEqual([
      ...Array.from({ length: 40 }, () => 80),
      64,
    ])

    // TAF: 17 istek (200 × 16 + 64). Kararlı durumda saatte 12 × 41 + 4 × 17 = 560 istek.
    requests.length = 0
    const taf = await runWeatherTaf({
      store,
      source: awcWeatherSource(client),
      origin: 'remote',
      log,
      now: () => FIXTURE_NOW,
    })
    expect(taf).toMatchObject({ status: 200, stations: 3264, requests: 17 })
    expect(requests.map((u) => u.searchParams.get('ids')?.split(',').length)).toEqual([
      ...Array.from({ length: 16 }, () => 200),
      64,
    ])
    expect(12 * 41 + 4 * 17).toBe(560)
  })

  it('listeye yeni giren istasyonun son 24 saati istenir; diğerleri olağan geriye bakışla (D-080)', async () => {
    // Yayından önce 3 Türkiye istasyonu; yeni halka 2 yabancı istasyon ekler. METAR kaynağı 5 dk
    // önce denetlenmişti: olağan geriye bakış 2 saattir, yeni istasyonların kaydı boştur.
    let stations = ['LTFM', 'LTBA', 'LTBQ']
    const { store, calls } = fakeStore({
      stations: () => stations,
      stored: ['LTFM', 'LTBA', 'LTBQ'],
      source: { checkedAt: new Date(FIXTURE_NOW.getTime() - 5 * 60_000) },
    })
    const backfilled = new Set<string>()
    const { source, requested, hours } = fakeSource(async () => ({
      status: 200,
      items: [],
      skipped: [],
    }))
    const run = () => runWeatherMetar({ store, source, origin: 'remote', log, now, backfilled })

    await run()
    expect(requested).toEqual([['LTFM', 'LTBA', 'LTBQ']])
    expect(hours).toEqual([2])

    stations = ['LTFM', 'LTBA', 'LGAV', 'LTBQ', 'UGTB']
    requested.length = 0
    hours.length = 0
    const result = await run()
    // Kaydı olan istasyonlar 2 saatle, yeni iki istasyon ayrı istekte 24 saatle.
    expect(requested).toEqual([
      ['LTFM', 'LTBA', 'LTBQ'],
      ['LGAV', 'UGTB'],
    ])
    expect(hours).toEqual([2, AWC_METAR_MAX_HOURS])
    expect(result).toMatchObject({ status: 200, stations: 5 })
    // Kayıt yalnızca denetlenmemiş istasyonlar için sorulur; pencere son 24 saattir.
    expect(calls.since.map(([ids]) => ids)).toEqual([
      ['LTFM', 'LTBA', 'LTBQ'],
      ['LGAV', 'UGTB'],
    ])
    expect(calls.since[1]?.[1]).toEqual(new Date(FIXTURE_NOW.getTime() - 24 * 3_600_000))

    // Sonraki çalışmada (rapor gelmemiş olsa da) yeniden doldurulmaz: tek olağan istek.
    requested.length = 0
    hours.length = 0
    await run()
    expect(requested).toEqual([stations])
    expect(hours).toEqual([2])
    expect(calls.since).toHaveLength(2)
  })

  it('doldurma isteğinin raporları olağan istekle birleşir; ilk açılışta tek 24 saatlik istek', async () => {
    const { store, calls } = fakeStore({
      stations: ['LTFM', 'LGAV'],
      stored: ['LTFM'],
      source: { checkedAt: new Date(FIXTURE_NOW.getTime() - 5 * 60_000) },
    })
    let call = 0
    const { source, hours } = fakeSource(async () => {
      call += 1
      return call === 1
        ? {
            status: 200,
            items: [report('LTFM', '2026-01-15T12:50:00Z', 'LTFM 151250Z 03018KT 9999 Q1009')],
            skipped: [],
            requests: 1,
          }
        : {
            status: 200,
            items: [
              report('LGAV', '2026-01-15T12:50:00Z', 'LGAV 151250Z 01010KT 9999 Q1012'),
              report('LGAV', '2026-01-14T13:50:00Z', 'LGAV 141350Z 01008KT 9999 Q1013'),
            ],
            skipped: [{ station: 'LGAV', reason: 'raw_invalid' }],
            truncated: true,
            requests: 4,
          }
    })
    const result = await runWeatherMetar({ store, source, origin: 'remote', log, now })
    expect(hours).toEqual([2, AWC_METAR_MAX_HOURS])
    expect(result).toMatchObject({
      status: 200,
      reports: 3,
      stationsWithReport: 2,
      skipped: 1,
      truncated: true,
      requests: 5,
    })
    expect(calls.metars[0]?.map((m) => m.stationIcao)).toEqual(['LTFM', 'LGAV', 'LGAV'])

    // Hiç başarılı kontrol yoksa bütün istasyonlar zaten 24 saatle istenir: kayıt sorulmaz.
    const first = fakeStore({ stations: ['LTFM', 'LGAV'], stored: [] })
    const firstSource = fakeSource(async () => ({ status: 204, items: [], skipped: [] }))
    await runWeatherMetar({
      store: first.store,
      source: firstSource.source,
      origin: 'remote',
      log,
      now,
    })
    expect(firstSource.hours).toEqual([AWC_METAR_MAX_HOURS])
    expect(first.calls.since).toEqual([])
  })

  it('metarLookbackHours: 2–24 saat, geçen süre + 1 saat pay', () => {
    const at = (minutesAgo: number) => new Date(FIXTURE_NOW.getTime() - minutesAgo * 60_000)
    expect(metarLookbackHours(at(5), FIXTURE_NOW)).toBe(2)
    expect(metarLookbackHours(at(61), FIXTURE_NOW)).toBe(3)
    expect(metarLookbackHours(at(23 * 60), FIXTURE_NOW)).toBe(24)
    expect(metarLookbackHours(at(-10), FIXTURE_NOW)).toBe(2)
    expect(metarLookbackHours(null, FIXTURE_NOW)).toBe(24)
  })

  it('204: satır silinmez, kontrol başarılı sayılır', async () => {
    const { store, calls } = fakeStore()
    const { source } = fakeSource(async () => ({ status: 204, items: [], skipped: [] }))
    const result = await runWeatherMetar({ store, source, origin: 'remote', log, now })
    expect(calls.metars).toEqual([[]])
    expect(calls.checks[0]?.[1]).toMatchObject({ reportCount: 0 })
    expect(result).toMatchObject({ status: 204, reports: 0 })
  })

  it('istasyon listesi boşsa ya da engel sürüyorsa istek atılmaz', async () => {
    const empty = fakeStore({ stations: [] })
    const a = fakeSource(async () => ({ status: 204, items: [], skipped: [] }))
    expect(
      await runWeatherMetar({ store: empty.store, source: a.source, origin: 'remote', log, now }),
    ).toEqual({
      skipped: 'no_stations',
    })
    const blocked = fakeStore({
      source: { blockedUntil: at('2026-01-15T13:10:00Z'), blockedKind: 'rate_limit' },
    })
    expect(
      await runWeatherMetar({ store: blocked.store, source: a.source, origin: 'remote', log, now }),
    ).toEqual({
      skipped: 'blocked',
      blockedUntil: '2026-01-15T13:10:00.000Z',
      blockedKind: 'rate_limit',
    })
    expect(a.requested).toEqual([])
    // Süresi dolmuş engel istek atmayı durdurmaz.
    const expired = fakeStore({ source: { blockedUntil: at('2026-01-15T12:00:00Z') } })
    await runWeatherMetar({ store: expired.store, source: a.source, origin: 'remote', log, now })
    expect(a.requested).toHaveLength(1)
  })

  it('429: en az 10 dk engel yazılır, Retry-After daha uzunsa o; iş yeniden denenmez', async () => {
    for (const [retryAfterSec, blockedSec] of [
      [null, RATE_LIMIT_BLOCK_SEC],
      [120, RATE_LIMIT_BLOCK_SEC],
      [1_800, 1_800],
    ] as const) {
      const { store, calls } = fakeStore()
      const { source } = fakeSource(async () => {
        throw new AviationWeatherError(
          'rate_limit',
          'hız sınırı (METAR, HTTP 429)',
          429,
          retryAfterSec,
        )
      })
      await expect(runWeatherMetar({ store, source, origin: 'remote', log, now })).rejects.toThrow(
        UnrecoverableError,
      )
      expect(calls.errors).toEqual([
        [
          'metar',
          {
            origin: 'remote',
            now: FIXTURE_NOW,
            error: 'hız sınırı (METAR, HTTP 429)',
            block: {
              until: new Date(FIXTURE_NOW.getTime() + blockedSec * 1000),
              kind: 'rate_limit',
            },
          },
        ],
      ])
      expect(calls.checks).toEqual([])
    }
  })

  it('403: 1 saat engel (forbidden), yeniden denenmez', async () => {
    const { store, calls } = fakeStore()
    const { source } = fakeSource(async () => {
      throw new AviationWeatherError('forbidden', 'erişim engellendi (HTTP 403)', 403)
    })
    await expect(runWeatherMetar({ store, source, origin: 'remote', log, now })).rejects.toThrow(
      UnrecoverableError,
    )
    expect(calls.errors[0]?.[1].block).toEqual({
      until: new Date(FIXTURE_NOW.getTime() + FORBIDDEN_BLOCK_SEC * 1000),
      kind: 'forbidden',
    })
  })

  it('5xx, 400 ve ağ hatası kaydedilir ve olduğu gibi fırlatılır (BullMQ bir kez yeniden dener)', async () => {
    for (const kind of ['server', 'request', 'network'] as const) {
      const { store, calls } = fakeStore()
      const error = new AviationWeatherError(kind, `hata: ${kind}`, kind === 'network' ? null : 503)
      const { source } = fakeSource(async () => {
        throw error
      })
      await expect(runWeatherMetar({ store, source, origin: 'remote', log, now })).rejects.toBe(
        error,
      )
      expect(calls.errors).toEqual([
        ['metar', { origin: 'remote', now: FIXTURE_NOW, error: `hata: ${kind}` }],
      ])
    }
  })

  it('hata kaydı yazılamasa da asıl hata fırlar', async () => {
    const { store } = fakeStore()
    store.recordError = async () => {
      throw new Error('veritabanı kapalı')
    }
    const { source } = fakeSource(async () => {
      throw new AviationWeatherError('server', 'HTTP 502', 502)
    })
    await expect(runWeatherMetar({ store, source, origin: 'remote', log, now })).rejects.toThrow(
      'HTTP 502',
    )
  })
})

describe('runWeatherTaf ve runWeatherPrune', () => {
  it("fixture'dan TAF'lar yazılır; düzeltmesiz geçerlilik korunur", async () => {
    const { store, calls } = fakeStore({ stations: ['LTFM', 'LTBJ', 'LTBQ'] })
    const source = fixtureWeatherSource({ dir: weatherDir, appEnv: 'test', now: () => FIXTURE_NOW })
    const result = await runWeatherTaf({
      store,
      source,
      origin: 'fixture',
      log,
      now: () => FIXTURE_NOW,
    })
    expect(result).toMatchObject({
      status: 200,
      reports: 14,
      stationsWithReport: 2,
      removed: 3,
      // Fixture kaynağı ağa çıkmaz.
      requests: 0,
    })
    // Fixture modu tabloyu fixture'a eşitler: istenen bütün istasyonlar, yazılan satırlarla.
    expect(calls.retained).toEqual([['taf', ['LTFM', 'LTBJ', 'LTBQ'], 14]])
    const ltfm = calls.tafs[0]?.find((t) => t.issuedAt.toISOString() === '2026-01-15T10:40:00.000Z')
    expect(ltfm).toEqual({
      stationIcao: 'LTFM',
      issuedAt: at('2026-01-15T10:40:00Z'),
      validFrom: at('2026-01-15T12:00:00Z'),
      validTo: at('2026-01-16T18:00:00Z'),
      rawText:
        'TAF LTFM 151040Z 1512/1618 03015G28KT 9999 SCT025 BKN035 TEMPO 1512/1518 4000 SHRA FEW025CB PROB30 TEMPO 1514/1518 TSRA BECMG 1520/1522 02008KT',
    })
    expect(calls.checks[0]).toEqual([
      'taf',
      { origin: 'fixture', now: FIXTURE_NOW, stationCount: 3, reportCount: 14, skippedCount: 0 },
    ])
  })

  it('TAF: 1.217 istasyon yedi istek (200 × 6 + 17); sonuç istek sayısını taşır (D-101, D-102)', async () => {
    const stations = Array.from({ length: 1217 }, (_, i) => {
      const letter = (n: number) => String.fromCharCode(65 + (Math.floor(i / 26 ** n) % 26))
      return `X${letter(2)}${letter(1)}${letter(0)}`
    })
    const { store } = fakeStore({ stations })
    const sizes: number[] = []
    const fetch = (async (input: string | URL | Request) => {
      sizes.push(new URL(String(input)).searchParams.get('ids')?.split(',').length ?? 0)
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof globalThis.fetch
    const client = createAviationWeatherClient({
      userAgent: 'havayolu/0.21.0 (+https://airline.live)',
      fetch,
      now: () => FIXTURE_NOW.getTime(),
      minIntervalMs: 0,
    })
    const result = await runWeatherTaf({
      store,
      source: awcWeatherSource(client),
      origin: 'remote',
      log,
      now: () => FIXTURE_NOW,
    })
    // 3. halkada (498 istasyon) üç istekti (200 + 200 + 98).
    expect(sizes).toEqual([200, 200, 200, 200, 200, 200, 17])
    expect(result).toMatchObject({ status: 200, stations: 1217, reports: 0, requests: 7 })
  })

  it('400 kayıt sınırı uyarısı istek sayısıyla yazılır', async () => {
    const { store } = fakeStore()
    const warnings: unknown[] = []
    const spy = pino(
      { level: 'warn' },
      { write: (line: string) => void warnings.push(JSON.parse(line)) },
    )
    const source: WeatherSource = {
      metars: async () => ({ status: 200, items: [], skipped: [], truncated: true, requests: 3 }),
      tafs: async () => ({ status: 204, items: [], skipped: [] }),
    }
    const result = await runWeatherMetar({
      store,
      source,
      origin: 'remote',
      log: spy,
      now: () => FIXTURE_NOW,
    })
    expect(result).toMatchObject({ truncated: true, requests: 3 })
    expect(warnings).toEqual([
      expect.objectContaining({
        kind: 'metar',
        requests: 3,
        msg: 'hava durumu: yanıt 400 kayıt sınırında; bazı raporlar eksik olabilir',
      }),
    ])
  })

  it('temizlik istasyon listesiyle çalışır', async () => {
    const { store, calls } = fakeStore({ stations: ['LTFM'] })
    expect(await runWeatherPrune({ store, log, now: () => FIXTURE_NOW })).toEqual({
      metar: 1,
      taf: 2,
      unlisted: 3,
    })
    expect(calls.pruned).toEqual([[FIXTURE_NOW, ['LTFM']]])
  })
})
