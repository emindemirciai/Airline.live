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

    // Tam biçim (D-111'den beri yalnız ülke isteğinde) çözümler.
    expect((await get('/v1/weather?country=TR')).statusCode).toBe(200)
    expect(vi.mocked(toAirportMetar).mock.calls.length).toBeGreaterThan(10)
    expect(vi.mocked(toAirportTaf).mock.calls.length).toBeGreaterThan(10)
  })

  it("her fixture istasyonunda ham kaydın çözümü (toAirportWeather) tam biçimin aynısı; ham biçim süresi dolmamış bütün TAF'ları taşır", async () => {
    const { get } = await setup(FIXTURE, FIXTURE_STATIONS)
    const raw = (await get('/v1/weather?scope=listed&format=raw')).json() as WeatherBulkRawResponse
    // Ülke okuyucusu aynı istasyonları aynı sırayla verir (setup).
    const full = (await get('/v1/weather?country=TR')).json() as WeatherBulkResponse
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
    await get('/v1/weather?country=TR')
    expect(latest).toHaveBeenCalledTimes(2)
    clock += WEATHER_CACHE_MS - 1
    expect((await get('/v1/weather?scope=listed&format=raw')).body).toBe(first)
    expect((await get('/v1/weather?country=TR&format=full')).statusCode).toBe(200)
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
// Ölçek (D-101): 4. halkada 1.217 istasyon (D-102, D-107), 5. halkada 3.241 (D-111). Bütçeler
// istasyon başınadır.

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
 * 5. halkanın uzun raporları (sentetik, elle yazılmış; kayıt değil): ABD ve ICAO düzeninde RMK'lı
 * METAR'lar (~85 karakter) ve FM gruplu TAF'lar (~230 karakter). Zamanlar `PROD_TAFS`'ınkilerdir.
 */
const LONG_METARS = [
  'METAR_ID 151251Z 22014G22KT 10SM FEW045 SCT250 24/13 A2992 RMK AO2 SLP131 T02440128',
  'METAR_ID 151251Z 31009KT 10SM BKN060 OVC120 08/M02 A3011 RMK AO2 SLP199 T00831022 $',
  'METAR_ID 151251Z 18012KT 4SM -RA BR OVC009 12/11 A2978 RMK AO2 RAB25 SLP084 P0003 T01220111',
] as const
const LONG_TAF_TEXT = {
  t0: 'TAF METAR_ID 141720Z 1418/1524 22012G20KT P6SM SCT050 BKN250 FM142100 23010KT P6SM SCT060 FM150200 21007KT P6SM SKC FM151400 24010KT P6SM FEW050',
  t1: 'TAF METAR_ID 142320Z 1500/1606 23010KT P6SM SCT060 FM150200 21007KT P6SM SKC FM151400 24010KT P6SM FEW050 FM151800 25012G20KT P6SM SCT050 BKN100',
  t2: 'TAF METAR_ID 150520Z 1506/1612 21007KT P6SM SKC FM151400 24010KT P6SM FEW050 FM151800 25012G20KT P6SM SCT050 BKN100 FM160200 27008KT P6SM BKN080 TEMPO 1603/1606 5SM -SHRA',
  t3: 'TAF METAR_ID 151120Z 1512/1618 24010KT P6SM FEW050 FM151800 25012G20KT P6SM SCT050 BKN100 FM160200 27008KT P6SM BKN080 TEMPO 1603/1606 5SM -SHRA FM161200 29012KT P6SM SCT040',
  t4: 'TAF METAR_ID 151320Z 1515/1621 25012G20KT P6SM SCT050 BKN100 FM160200 27008KT P6SM BKN080 TEMPO 1603/1606 5SM -SHRA FM161200 29012KT P6SM SCT040 FM161800 30010KT P6SM FEW050',
} as const

/**
 * `count` istasyon, ondalık desenle: üçünde T1–T4 (yürürlükte T3 ve T4), birinde T0–T3, altısında
 * T1–T3 (yürürlükte yalnız T3). Ortalama 3,4 süresi dolmamış, 1,3 yürürlükte TAF. `longFrom`'dan
 * itibaren istasyonlar uzun (ABD boyunda) raporlar taşır.
 */
function productionLike(
  count: number,
  longFrom = Number.POSITIVE_INFINITY,
): { icaos: string[]; records: WeatherRecords } {
  const { t0, t1, t2, t3, t4 } = PROD_TAFS
  const icaos = Array.from(
    { length: count },
    (_, i) => `X${i.toString(36).toUpperCase().padStart(3, '0')}`,
  )
  const metars: MetarRecord[] = []
  const tafs: TafRecord[] = []
  for (const [i, icao] of icaos.entries()) {
    const long = i >= longFrom
    const metarTexts: readonly string[] = long ? LONG_METARS : PROD_METARS
    metars.push({
      stationIcao: icao,
      reportType: 'METAR',
      observedAt: at('2026-01-15T12:50:00Z'),
      rawText: (metarTexts[i % metarTexts.length] ?? '').replace('METAR_ID', icao),
      flightCategory: 'VFR',
    })
    const slot = i % 10
    const set: (keyof typeof PROD_TAFS)[] =
      slot < 3
        ? ['t1', 't2', 't3', 't4']
        : slot === 3
          ? ['t0', 't1', 't2', 't3']
          : ['t1', 't2', 't3']
    for (const key of set) {
      const taf = { t0, t1, t2, t3, t4 }[key]
      const text = long ? LONG_TAF_TEXT[key] : taf.rawText
      tafs.push({ ...taf, stationIcao: icao, rawText: text.replace('METAR_ID', icao) })
    }
  }
  return { icaos, records: { metars, tafs } }
}

/**
 * Ham biçimde istasyon başına bütçe (D-111; 4. halkada 980 B idi): 5. halkada 3.241 istasyonla gövde
 * 4,2 MB'ın altında kalır.
 */
const RAW_BYTES_PER_STATION = 1_250
const RAW_BYTES_RING5 = 4_200_000
/**
 * Tam biçimde üretime benzer veriyle istasyon başına bütçe: 2026-10-04 üretim görüntüsü ~3,3 KB,
 * buradaki veri ~3,6 KB (METAR'larından biri TREND taşır). Ham biçim ~0,9 KB'tır.
 */
const FULL_BYTES_PER_STATION = 3_800
const RING4_STATIONS = 1_217
/** 5. halka açılınca hava durumu istasyonları (3.243 listelenen; CAJ4 ve CAT4'ün METAR kodu yok). */
const RING5_STATIONS = 3_241

const decodeSpies = (): WeatherViews & {
  metarView: ReturnType<typeof vi.fn>
  tafView: ReturnType<typeof vi.fn>
} => ({
  metarView: vi.fn(() => null),
  tafView: vi.fn(() => null),
})

describe('ölçek: 4. halkada 1.217, 5. halkada 3.241 istasyon (D-101, D-102, D-111)', () => {
  it('ham gövde: 5. halkada istasyon başına ≤ 1.250 B, toplam < 4,2 MB (1.–4. halka Türkiye boyunda, 5. halka ABD boyunda raporlar)', async () => {
    const { icaos, records } = productionLike(RING5_STATIONS, RING4_STATIONS)
    expect(records.tafs.length / icaos.length).toBeCloseTo(3.4, 1)
    const { get } = await setup(records, icaos)
    const raw = await get('/v1/weather?scope=listed&format=raw')
    const rawBody = raw.json() as WeatherBulkRawResponse
    expect(rawBody.stations).toHaveLength(RING5_STATIONS)
    expect(rawBody.stations.every((s) => s.metar !== null)).toBe(true)
    expect(rawBody.stations.reduce((n, s) => n + s.tafs.length, 0)).toBe(records.tafs.length)
    // Ölçüm (2026-10-08): 3.448.925 B, istasyon başına 1.064 B (4. halkanın raporları ~891 B).
    const rawBytes = Buffer.byteLength(raw.body)
    expect(rawBytes / RING5_STATIONS).toBeLessThanOrEqual(RAW_BYTES_PER_STATION)
    expect(rawBytes).toBeLessThan(RAW_BYTES_RING5)
  })

  it('4. halka: ham gövde istasyon başına ≤ 980 B; tam biçim (ülke isteği) istasyon başına ≤ 3,8 KB', async () => {
    const { icaos, records } = productionLike(RING4_STATIONS)
    expect(records.tafs.length / icaos.length).toBeCloseTo(3.4, 2)
    const { get } = await setup(records, icaos)
    const raw = await get('/v1/weather?scope=listed&format=raw')
    const rawBody = raw.json() as WeatherBulkRawResponse
    expect(rawBody.stations).toHaveLength(RING4_STATIONS)
    expect(
      rawBody.stations.reduce(
        (n, s) => n + toAirportWeather(s, rawBody.generatedAt).tafs.length,
        0,
      ) / RING4_STATIONS,
    ).toBeCloseTo(1.3, 2)
    expect(Buffer.byteLength(raw.body) / RING4_STATIONS).toBeLessThanOrEqual(980)

    // Tam biçim D-111'den beri yalnız ülke isteğindedir (setup'ın ülke okuyucusu aynı istasyonlar).
    expect((await get('/v1/weather?scope=listed')).statusCode).toBe(400)
    const full = await get('/v1/weather?country=TR')
    const fullBody = full.json() as WeatherBulkResponse
    expect(fullBody.stations).toHaveLength(RING4_STATIONS)
    expect(Buffer.byteLength(full.body) / RING4_STATIONS).toBeLessThanOrEqual(
      FULL_BYTES_PER_STATION,
    )
  })

  it('ham gövde çözümleme yapmaz ve doğrusal büyür (2.434 / 1.217 istasyon süresi < 3 kat)', () => {
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
