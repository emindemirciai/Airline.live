import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import type * as Shared from '@havayolu/shared'
import {
  toAirportMetar,
  toAirportTaf,
  toAirportWeather,
  WeatherBulkRawResponseSchema,
  type WeatherBulkRawResponse,
  type WeatherBulkResponse,
} from '@havayolu/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testApp } from '../test/helpers'
import { AIRPORT_ERRORS } from './airports'
import {
  WEATHER_CACHE_CONTROL,
  WEATHER_CACHE_MS,
  WEATHER_ERRORS,
  weatherBulkBody,
  weatherBulkFormat,
  type MetarRecord,
  type TafRecord,
  type WeatherRecords,
  type WeatherRouteOptions,
  type WeatherViews,
} from './weather'

/**
 * Toplu havanın ham biçimi (`GET /v1/weather?format=raw`, D-101): hiçbir rapor çözümlenmez, web
 * yalnız çizdiği havalimanını paylaşılan görünümlerle çözer. Görünümler gerçek uygulamalarına
 * yönlendiren casuslardır: API'nin çözümleme çağrıları sayılır.
 */
vi.mock('@havayolu/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof Shared>()
  return {
    ...actual,
    toAirportMetar: vi.fn(actual.toAirportMetar),
    toAirportTaf: vi.fn(actual.toAirportTaf),
  }
})

const NOW = Date.parse('2026-01-15T13:00:00Z')
const at = (iso: string) => new Date(iso)

let clock = NOW
const apps: { close(): Promise<unknown> }[] = []

beforeEach(() => {
  vi.mocked(toAirportMetar).mockClear()
  vi.mocked(toAirportTaf).mockClear()
})

afterEach(async () => {
  clock = NOW
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

const weatherFixture = (file: string): Record<string, unknown>[] =>
  JSON.parse(
    readFileSync(new URL(`../../../../tools/fixtures/weather/${file}`, import.meta.url), 'utf8'),
  ) as Record<string, unknown>[]

/** tools/fixtures/weather (sentetik, elle yazılmış; fixtureNow = NOW) veritabanı satırı biçiminde. */
function fixtureRecords(): WeatherRecords {
  const awcTime = (value: unknown) =>
    new Date(typeof value === 'number' ? value * 1000 : Date.parse(String(value).replace(' ', 'T')))
  return {
    metars: weatherFixture('metar.json').map((m): MetarRecord => ({
      stationIcao: String(m.icaoId),
      reportType: m.metarType === 'SPECI' ? 'SPECI' : 'METAR',
      observedAt: awcTime(m.obsTime),
      rawText: String(m.rawOb),
      flightCategory: typeof m.fltCat === 'string' ? m.fltCat : null,
    })),
    tafs: weatherFixture('taf.json').map((t): TafRecord => ({
      stationIcao: String(t.icaoId),
      issuedAt: awcTime(t.issueTime),
      validFrom: awcTime(t.validTimeFrom),
      validTo: awcTime(t.validTimeTo),
      rawText: String(t.rawTAF),
    })),
  }
}

/** `latest` veritabanı gibi davranır: istasyon başına en yeni METAR ve süresi dolmamış TAF'lar. */
function latestOf(records: WeatherRecords) {
  return vi.fn(async (icaos: readonly string[], now: Date): Promise<WeatherRecords> => {
    const wanted = new Set(icaos)
    const newest = new Map<string, MetarRecord>()
    for (const row of records.metars) {
      if (!wanted.has(row.stationIcao) || row.observedAt.getTime() > now.getTime()) continue
      const seen = newest.get(row.stationIcao)
      if (seen === undefined || row.observedAt > seen.observedAt) newest.set(row.stationIcao, row)
    }
    return {
      metars: [...newest.values()],
      tafs: records.tafs.filter((t) => wanted.has(t.stationIcao) && t.validTo > now),
    }
  })
}

async function setup(records: WeatherRecords, icaos: readonly string[]) {
  const latest = latestOf(records)
  const listedStations = vi.fn(async () => icaos.map((icao) => ({ icao })))
  const stations = vi.fn(async (_country: string) => icaos.map((icao) => ({ icao })))
  const weather: WeatherRouteOptions = {
    stations,
    listedStations,
    resolve: async (code) => code,
    latest,
    history: async () => ({ metars: [], tafs: [] }),
    now: () => clock,
  }
  const { app } = await testApp({ deps: { weather } })
  apps.push(app)
  const get = (url: string) => app.inject({ method: 'GET', url })
  return { get, latest, listedStations, stations }
}

const FIXTURE = fixtureRecords()
const FIXTURE_STATIONS = [
  ...new Set([...FIXTURE.metars, ...FIXTURE.tafs].map((r) => r.stationIcao)),
  'LTBQ',
]

describe('GET /v1/weather?format=raw (D-101)', () => {
  it('çözümleme yok: METAR ve TAF görünümü hiç çağrılmaz; tam biçim çağırır', async () => {
    const { get } = await setup(FIXTURE, FIXTURE_STATIONS)
    const res = await get('/v1/weather?scope=listed&format=raw')
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(res.headers['cache-control']).toBe(WEATHER_CACHE_CONTROL)
    const body = res.json() as WeatherBulkRawResponse
    expect(WeatherBulkRawResponseSchema.parse(body)).toEqual(body)
    expect(body.stations.map((s) => s.icao)).toEqual(FIXTURE_STATIONS)
    expect(body.stations.filter((s) => s.metar !== null).length).toBeGreaterThan(10)
    expect(body.stations.reduce((n, s) => n + s.tafs.length, 0)).toBeGreaterThan(10)
    expect(toAirportMetar).not.toHaveBeenCalled()
    expect(toAirportTaf).not.toHaveBeenCalled()

    expect((await get('/v1/weather?scope=listed')).statusCode).toBe(200)
    expect(vi.mocked(toAirportMetar).mock.calls.length).toBeGreaterThan(10)
    expect(vi.mocked(toAirportTaf).mock.calls.length).toBeGreaterThan(10)
  })

  it("her fixture istasyonunda ham kaydın çözümü (toAirportWeather) tam biçimin aynısı; ham biçim süresi dolmamış bütün TAF'ları taşır", async () => {
    const { get } = await setup(FIXTURE, FIXTURE_STATIONS)
    const raw = (await get('/v1/weather?scope=listed&format=raw')).json() as WeatherBulkRawResponse
    const full = (await get('/v1/weather?scope=listed')).json() as WeatherBulkResponse
    expect(raw.generatedAt).toBe(full.generatedAt)
    expect(raw.attribution).toEqual(full.attribution)
    expect(raw.stations).toHaveLength(full.stations.length)
    let dropped = 0
    for (const [i, station] of raw.stations.entries()) {
      expect(toAirportWeather(station, raw.generatedAt), station.icao).toEqual(full.stations[i])
      dropped += station.tafs.length - (full.stations[i]?.tafs.length ?? 0)
    }
    // Yerini yenisine bırakmış TAF'lar ham biçimde vardır, tam biçimde yoktur (okuyan seçer).
    expect(dropped).toBeGreaterThan(0)
  })

  it('format geçersizse 400 bad_format; country ve scope hataları önce gelir; okuyucuya gidilmez', async () => {
    const { get, latest, listedStations, stations } = await setup(FIXTURE, FIXTURE_STATIONS)
    for (const query of [
      'scope=listed&format=',
      'scope=listed&format=RAW',
      'scope=listed&format=json',
      'format=raw&format=raw',
      'country=TR&format=decoded',
    ]) {
      const res = await get(`/v1/weather?${query}`)
      expect(res.statusCode, query).toBe(400)
      expect(res.headers['cache-control'], query).toBe('no-store')
      expect(res.json(), query).toEqual(WEATHER_ERRORS.badFormat)
    }
    expect((await get('/v1/weather?scope=all&format=raw')).json()).toEqual(AIRPORT_ERRORS.badScope)
    expect((await get('/v1/weather?country=tr&format=raw')).json()).toEqual(
      AIRPORT_ERRORS.badCountry,
    )
    expect(latest).not.toHaveBeenCalled()
    expect(listedStations).not.toHaveBeenCalled()
    expect(stations).not.toHaveBeenCalled()
    expect(weatherBulkFormat(undefined)).toBe('full')
    expect(weatherBulkFormat('full')).toBe('full')
    expect(weatherBulkFormat('raw')).toBe('raw')
  })

  it('biçim başına ayrı önbellek (60 sn); ülke seçimi de ham biçimi alır', async () => {
    const { get, latest, stations } = await setup(FIXTURE, FIXTURE_STATIONS)
    const first = (await get('/v1/weather?scope=listed&format=raw')).body
    await get('/v1/weather?scope=listed')
    expect(latest).toHaveBeenCalledTimes(2)
    clock += WEATHER_CACHE_MS - 1
    expect((await get('/v1/weather?scope=listed&format=raw')).body).toBe(first)
    expect((await get('/v1/weather?scope=listed&format=full')).statusCode).toBe(200)
    expect(latest).toHaveBeenCalledTimes(2)
    clock += 1
    await get('/v1/weather?scope=listed&format=raw')
    expect(latest).toHaveBeenCalledTimes(3)

    const country = await get('/v1/weather?country=TR&format=raw')
    expect(country.statusCode).toBe(200)
    expect(WeatherBulkRawResponseSchema.safeParse(country.json()).success).toBe(true)
    expect(stations).toHaveBeenCalledWith('TR')
  })
})

// ---------------------------------------------------------------------------------------------
// Ölçek (D-101): 4. halkada ~1.222 istasyon. Bütçeler istasyon başınadır.

/**
 * Üretime benzer raporlar. 2026-10-04 üretim görüntüsünde (225 istasyon, TAF yayım saati) METAR
 * ortalama 56, TAF 97 karakterdi; istasyon başına 1,3 yürürlükte TAF vardı. Veritabanı istasyon
 * başına 3–4 süresi dolmamış TAF verir (1. halkada ortalama 3,4). Burada METAR ~59, TAF ~85
 * karakter; istasyon başına 3,4 süresi dolmamış, 1,3 yürürlükte TAF.
 */
const PROD_METARS = [
  'METAR_ID 151250Z 34008KT CAVOK 25/17 Q1018 NOSIG',
  'METAR_ID 151250Z 03012KT 9999 FEW030 SCT100 09/05 Q1009 NOSIG',
  'METAR_ID 151250Z 24015G25KT 6000 -RA BKN012 OVC025 07/06 Q1002 TEMPO 3000 RA',
] as const

const prodTaf = (issued: string, from: string, to: string, rawText: string) => ({
  issuedAt: at(issued),
  validFrom: at(from),
  validTo: at(to),
  rawText,
})

/** 13:00Z'de süresi dolmamış TAF'lar: T0–T2'nin kalanını T3 kapsar; T4 henüz başlamadı. */
const PROD_TAFS = {
  t0: prodTaf(
    '2026-01-14T16:40:00Z',
    '2026-01-14T18:00:00Z',
    '2026-01-16T00:00:00Z',
    'TAF METAR_ID 141640Z 1418/1600 32008KT 9999 FEW030 BECMG 1506/1508 SCT025',
  ),
  t1: prodTaf(
    '2026-01-14T22:40:00Z',
    '2026-01-15T00:00:00Z',
    '2026-01-16T06:00:00Z',
    'TAF METAR_ID 142240Z 1500/1606 34010KT 9999 SCT025 BECMG 1508/1510 VRB03KT',
  ),
  t2: prodTaf(
    '2026-01-15T04:40:00Z',
    '2026-01-15T06:00:00Z',
    '2026-01-16T12:00:00Z',
    'TAF METAR_ID 150440Z 1506/1612 04012KT 9999 SCT030 TEMPO 1510/1516 5000 -SHRA BKN020',
  ),
  t3: prodTaf(
    '2026-01-15T10:40:00Z',
    '2026-01-15T12:00:00Z',
    '2026-01-16T18:00:00Z',
    'TAF METAR_ID 151040Z 1512/1618 03015G28KT 9999 SCT025 BKN035 TEMPO 1512/1518 4000 SHRA BECMG 1520/1522 02008KT',
  ),
  t4: prodTaf(
    '2026-01-15T12:40:00Z',
    '2026-01-15T15:00:00Z',
    '2026-01-16T21:00:00Z',
    'TAF METAR_ID 151240Z 1515/1621 02012KT 9999 SCT030 BKN040 BECMG 1600/1602 VRB03KT',
  ),
} as const

/**
 * `count` istasyon, ondalık desenle: üçünde T1–T4 (yürürlükte T3 ve T4), birinde T0–T3, altısında
 * T1–T3 (yürürlükte yalnız T3). Ortalama 3,4 süresi dolmamış, 1,3 yürürlükte TAF.
 */
function productionLike(count: number): { icaos: string[]; records: WeatherRecords } {
  const { t0, t1, t2, t3, t4 } = PROD_TAFS
  const icaos = Array.from(
    { length: count },
    (_, i) => `X${i.toString(36).toUpperCase().padStart(3, '0')}`,
  )
  const metars: MetarRecord[] = []
  const tafs: TafRecord[] = []
  for (const [i, icao] of icaos.entries()) {
    metars.push({
      stationIcao: icao,
      reportType: 'METAR',
      observedAt: at('2026-01-15T12:50:00Z'),
      rawText: (PROD_METARS[i % PROD_METARS.length] ?? '').replace('METAR_ID', icao),
      flightCategory: 'VFR',
    })
    const slot = i % 10
    const set = slot < 3 ? [t1, t2, t3, t4] : slot === 3 ? [t0, t1, t2, t3] : [t1, t2, t3]
    for (const taf of set) {
      tafs.push({ ...taf, stationIcao: icao, rawText: taf.rawText.replace('METAR_ID', icao) })
    }
  }
  return { icaos, records: { metars, tafs } }
}

/** Ham biçimde istasyon başına bütçe: 1.222 istasyonda gövde 1,2 MB'ın altında kalır. */
const RAW_BYTES_PER_STATION = 980
/**
 * Tam biçimde üretime benzer veriyle istasyon başına bütçe: 2026-10-04 üretim görüntüsü ~3,3 KB,
 * buradaki veri ~3,6 KB (METAR'larından biri TREND taşır). Ham biçim ~0,9 KB'tır.
 */
const FULL_BYTES_PER_STATION = 3_800
const RING4_STATIONS = 1_222

const decodeSpies = (): WeatherViews & {
  metarView: ReturnType<typeof vi.fn>
  tafView: ReturnType<typeof vi.fn>
} => ({
  metarView: vi.fn(() => null),
  tafView: vi.fn(() => null),
})

describe('ölçek: 1.222 istasyon (4. halka, D-101)', () => {
  it('ham gövde istasyon başına ≤ 980 B, toplam < 1,2 MB; tam biçim istasyon başına ≤ 3,8 KB', async () => {
    const { icaos, records } = productionLike(RING4_STATIONS)
    expect(records.tafs.length / icaos.length).toBeCloseTo(3.4, 2)
    const { get } = await setup(records, icaos)
    const raw = await get('/v1/weather?scope=listed&format=raw')
    const rawBody = raw.json() as WeatherBulkRawResponse
    expect(rawBody.stations).toHaveLength(RING4_STATIONS)
    expect(rawBody.stations.every((s) => s.metar !== null)).toBe(true)
    expect(rawBody.stations.reduce((n, s) => n + s.tafs.length, 0)).toBe(records.tafs.length)
    expect(
      rawBody.stations.reduce(
        (n, s) => n + toAirportWeather(s, rawBody.generatedAt).tafs.length,
        0,
      ) / RING4_STATIONS,
    ).toBeCloseTo(1.3, 2)
    const rawBytes = Buffer.byteLength(raw.body)
    expect(rawBytes / RING4_STATIONS).toBeLessThanOrEqual(RAW_BYTES_PER_STATION)
    expect(rawBytes).toBeLessThan(1_200_000)

    const full = await get('/v1/weather?scope=listed')
    const fullBody = full.json() as WeatherBulkResponse
    expect(fullBody.stations).toHaveLength(RING4_STATIONS)
    expect(Buffer.byteLength(full.body) / RING4_STATIONS).toBeLessThanOrEqual(
      FULL_BYTES_PER_STATION,
    )
  })

  it('ham gövde çözümleme yapmaz ve doğrusal büyür (2.444 / 1.222 istasyon süresi < 3 kat)', () => {
    const small = productionLike(RING4_STATIONS)
    const large = productionLike(RING4_STATIONS * 2)
    const views = decodeSpies()
    const fastest = (input: { icaos: string[]; records: WeatherRecords }) => {
      let best = Infinity
      for (let run = 0; run < 7; run += 1) {
        const started = performance.now()
        weatherBulkBody('raw', input.icaos, input.records, new Date(NOW), views)
        best = Math.min(best, performance.now() - started)
      }
      return best
    }
    // Isınma (JIT), sonra ölçüm.
    fastest(small)
    const ratio = fastest(large) / fastest(small)
    expect(views.metarView).not.toHaveBeenCalled()
    expect(views.tafView).not.toHaveBeenCalled()
    expect(toAirportMetar).not.toHaveBeenCalled()
    expect(toAirportTaf).not.toHaveBeenCalled()
    // İstasyon × rapor taraması (önceki toplu yanıt) bu oranı ~4'e çıkarırdı.
    expect(ratio).toBeLessThan(3)
  })
})
