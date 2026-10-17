import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  airports,
  createDb,
  findAirportDetail,
  listAirportsWithIata,
  listLatestWeather,
  listListedAirports,
  listWeatherHistory,
  runMigrations,
  upsertMetars,
  upsertTafs,
  type Database,
} from '@havayolu/db'
import { parseAirports } from '@havayolu/providers'
import {
  AIRPORT_RING_CONFIG,
  AirportWeatherSchema,
  toAirportWeather,
  WeatherBulkRawResponseSchema,
  WeatherBulkResponseSchema,
  WeatherHistoryResponseSchema,
  type AirportWeather,
  type WeatherBulkRawResponse,
  type WeatherBulkResponse,
  type WeatherHistoryResponse,
} from '@havayolu/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testApp } from '../test/helpers'
import { AIRPORT_ERRORS } from './airports'
import { WEATHER_CACHE_CONTROL, WEATHER_ERRORS } from './weather'

// Gerçek PostgreSQL (yerelde `pnpm dev:infra`, CI'da dev compose); bu teste ait veritabanı.
// Havalimanları commit'li OurAirports alt kümesinden; hava raporları elle yazılmış, sentetiktir ve
// zamanları testin çalıştığı ana göre kurulur (veritabanı `now()` ile süzer).
const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_api_weather'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../../../../packages/db/drizzle', import.meta.url))
const fixture = (path: string) =>
  readFileSync(new URL(`../../../../tools/fixtures/${path}`, import.meta.url), 'utf8')

let admin: Database
let database: Database
let app: Awaited<ReturnType<typeof testApp>>['app'] | undefined

const get = (url: string) => {
  if (app === undefined) throw new Error('app not started')
  return app.inject({ method: 'GET', url })
}

const MIN = 60_000
const HOUR = 60 * MIN
/** Dakikası sıfırlanmış başlangıç: ham metindeki gün/saat grupları tutarlı olsun. */
const base = Math.floor(Date.now() / HOUR) * HOUR
const ago = (ms: number) => new Date(base - ms)
const pad = (n: number) => String(n).padStart(2, '0')
/** `DDHHMMZ` grubu. */
const ddhhmm = (d: Date) =>
  `${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}Z`
/** `DDHH` grubu. */
const ddhh = (d: Date) => `${pad(d.getUTCDate())}${pad(d.getUTCHours())}`

interface MetarRow {
  station: string
  type: 'METAR' | 'SPECI'
  observedAt: Date
  raw: string
}
interface TafRow {
  station: string
  issuedAt: Date
  validFrom: Date
  validTo: Date
  raw: string
}

const metarRow = (station: string, type: MetarRow['type'], observedAt: Date, body: string) => ({
  station,
  type,
  observedAt,
  raw: `${type === 'SPECI' ? 'SPECI ' : ''}${station} ${ddhhmm(observedAt)} ${body}`,
})
const tafRow = (station: string, issuedAt: Date, validFrom: Date, validTo: Date, body: string) => ({
  station,
  issuedAt,
  validFrom,
  validTo,
  raw: `TAF ${station} ${ddhhmm(issuedAt)} ${ddhh(validFrom)}/${ddhh(validTo)} ${body}`,
})

const metars: MetarRow[] = [
  metarRow(
    'LTFM',
    'METAR',
    ago(10 * MIN),
    '03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA',
  ),
  metarRow('LTFM', 'SPECI', ago(25 * MIN), '03016G30KT 4000 SHRA FEW025CB BKN035 09/06 Q1009'),
  metarRow('LTFM', 'METAR', ago(40 * MIN), '03016G28KT 9999 -SHRA FEW025 BKN035 09/05 Q1009 NOSIG'),
  metarRow('LTFM', 'METAR', ago(30 * HOUR), '04010KT CAVOK 12/04 Q1012 NOSIG'),
  metarRow('LTFM', 'METAR', ago(200 * HOUR), '04010KT CAVOK 12/04 Q1012 NOSIG'),
  metarRow('LTBA', 'METAR', ago(10 * MIN), '04008KT CAVOK 10/03 Q1010 NOSIG'),
  metarRow('LTCW', 'METAR', ago(8 * HOUR), '36004KT 9999 FEW050 M05/M09 Q1024'),
  // 1. halka (D-080): yurt dışı listelenen havalimanları.
  metarRow('LGAV', 'METAR', ago(20 * MIN), '36012KT CAVOK 22/12 Q1015 NOSIG'),
  metarRow('LCEN', 'METAR', ago(50 * MIN), '27008KT 9999 FEW030 26/15 Q1012'),
]
const tafs: TafRow[] = [
  tafRow(
    'LTFM',
    ago(140 * MIN),
    ago(1 * HOUR),
    new Date(base + 29 * HOUR),
    `03015G28KT 9999 SCT025 BKN035 TEMPO ${ddhh(ago(1 * HOUR))}/${ddhh(new Date(base + 5 * HOUR))} 4000 SHRA FEW025CB`,
  ),
  tafRow('LTFM', ago(8 * HOUR), ago(7 * HOUR), new Date(base + 17 * HOUR), '04012KT 9999 SCT030'),
  // Süresi 5 saat önce dolmuş TAF: güncel havada yok, 168 saatlik kayıtta var.
  tafRow('LTFM', ago(30 * HOUR), ago(29 * HOUR), ago(5 * HOUR), '04010KT 9999 FEW030'),
]

beforeAll(async () => {
  admin = createDb(adminUrl, { max: 1 })
  await admin.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.sql.unsafe(`create database ${testDbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder })
  database = createDb(testUrl, { max: 2 })
  // Havalimanları (pistler bu test için gerekmez): worker'ın içe aktarımıyla aynı ayrıştırıcı.
  await database.db.insert(airports).values(parseAirports(fixture('ourairports/airports.csv')).rows)
  const db = database
  // index.ts ile aynı okuyucular.
  app = (
    await testApp({
      deps: {
        weather: {
          stations: (country) => listAirportsWithIata(db.db, country, AIRPORT_RING_CONFIG),
          listedStations: () => listListedAirports(db.db, AIRPORT_RING_CONFIG),
          resolve: async (code) =>
            (await findAirportDetail(db.db, code, AIRPORT_RING_CONFIG))?.icao ?? null,
          latest: (icaos, now) => listLatestWeather(db.sql, icaos, now),
          history: (icao, from, to) => listWeatherHistory(db.sql, icao, from, to),
        },
      },
    })
  ).app
  // Worker'ın yazma yolu (upsert); zamanlar bu ana göre.
  const fetchedAt = new Date(base)
  await upsertMetars(
    database.sql,
    metars.map((m) => ({
      stationIcao: m.station,
      reportType: m.type,
      observedAt: m.observedAt,
      rawText: m.raw,
      qnhHpa: null,
      flightCategory: null,
    })),
    fetchedAt,
  )
  await upsertTafs(
    database.sql,
    tafs.map((t) => ({
      stationIcao: t.station,
      issuedAt: t.issuedAt,
      validFrom: t.validFrom,
      validTo: t.validTo,
      rawText: t.raw,
    })),
    fetchedAt,
  )
})

afterAll(async () => {
  await app?.close()
  await database?.sql.end({ timeout: 5 })
  await admin?.sql.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin?.sql.end({ timeout: 5 })
})

describe('hava durumu uçları (gerçek PostgreSQL)', () => {
  it('GET /v1/weather?country=TR: listedeki 56 havalimanı (askerî üsler yok, D-107) liste sırasıyla; en yeni rapor, geçerli TAF', async () => {
    const res = await get('/v1/weather?country=TR')
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe(WEATHER_CACHE_CONTROL)
    const body = res.json() as WeatherBulkResponse
    expect(WeatherBulkResponseSchema.parse(body)).toEqual(body)
    expect(body.stations).toHaveLength(56)
    expect(body.stations.map((s) => s.icao)).not.toContain('LTBL')
    expect(Buffer.byteLength(res.body)).toBeLessThan(1_000_000)

    const byIcao = new Map(body.stations.map((s) => [s.icao, s]))
    const ltfm = byIcao.get('LTFM')
    expect(ltfm?.metar).toMatchObject({
      type: 'METAR',
      observedAt: ago(10 * MIN).toISOString(),
      raw: metars[0]?.raw,
    })
    // Yürürlükteki TAF (D-088): 8 saat önceki TAF'ın kalan geçerliliğini (17 saat sonrasına kadar)
    // 140 dk önceki TAF kapsar; eskisi güncel havada yok, kayıtta var.
    expect(ltfm?.tafs.map((t) => t.issuedAt)).toEqual([ago(140 * MIN).toISOString()])
    expect(byIcao.get('LTBA')?.metar?.raw).toBe(metars[5]?.raw)
    // Eski gözlem yine en yeni rapordur; yaşını arayüz gösterir.
    expect(byIcao.get('LTCW')?.metar?.observedAt).toBe(ago(8 * HOUR).toISOString())
    expect(byIcao.get('LTBQ')).toMatchObject({ metar: null, tafs: [] })
    const withMetar = body.stations.filter((s) => s.metar !== null).map((s) => s.icao)
    expect(withMetar.sort()).toEqual(['LTBA', 'LTCW', 'LTFM'])
  })

  it('GET /v1/weather?scope=listed&format=raw: Türkiye ve açık halkalar, liste sırasıyla; yurt dışı raporları; biçimsiz 400 (D-111)', async () => {
    const res = await get('/v1/weather?scope=listed&format=raw')
    expect(res.statusCode).toBe(200)
    const body = res.json() as WeatherBulkRawResponse
    expect(WeatherBulkRawResponseSchema.parse(body)).toEqual(body)
    const listed = await listListedAirports(database.db, AIRPORT_RING_CONFIG)
    expect(body.stations.map((s) => s.icao)).toEqual(listed.map((a) => a.icao))
    expect(body.stations.length).toBeGreaterThan(56)
    for (const icao of ['LTAG', 'LTAH', 'LTBG', 'LTBI', 'LTBL']) {
      expect(
        body.stations.map((s) => s.icao),
        icao,
      ).not.toContain(icao)
    }
    expect(Buffer.byteLength(res.body)).toBeLessThan(1_000_000)
    const withMetar = body.stations.filter((s) => s.metar !== null).map((s) => s.icao)
    expect(withMetar.sort()).toEqual(['LCEN', 'LGAV', 'LTBA', 'LTCW', 'LTFM'])
    // Yurt dışı tek havalimanı ve kaydı da çözülür (ICAO ya da IATA).
    const ath = (await get('/v1/airports/ATH/weather')).json() as AirportWeather
    expect(ath).toMatchObject({ icao: 'LGAV', metar: { raw: metars[7]?.raw } })
    const ecn = (await get('/v1/airports/ecn/weather/history')).json() as WeatherHistoryResponse
    expect(ecn.icao).toBe('LCEN')
    expect(ecn.entries.map((e) => e.raw)).toEqual([metars[8]?.raw])
    expect((await get('/v1/weather?scope=listed&country=TR')).statusCode).toBe(400)
    // Tam biçim yalnız ülke isteğinde (D-111): listelenen bütün havalimanlarının çözümlenmiş
    // yanıtı 5. halkada ~15,8 MB olurdu.
    for (const url of ['/v1/weather?scope=listed', '/v1/weather?scope=listed&format=full']) {
      const rejected = await get(url)
      expect(rejected.statusCode, url).toBe(400)
      expect(rejected.json(), url).toEqual(WEATHER_ERRORS.rawRequired)
    }
  })

  it('GET /v1/weather?country=TR&format=raw (D-101): ham kayıtların çözümü tam biçimle aynı', async () => {
    const res = await get('/v1/weather?country=TR&format=raw')
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe(WEATHER_CACHE_CONTROL)
    const raw = res.json() as WeatherBulkRawResponse
    expect(WeatherBulkRawResponseSchema.parse(raw)).toEqual(raw)
    const full = (await get('/v1/weather?country=TR')).json() as WeatherBulkResponse
    expect(raw.stations.map((s) => s.icao)).toEqual(full.stations.map((s) => s.icao))
    // Ham biçim süresi dolmamış bütün TAF'ları taşır (LTFM'de yerini yenisine bırakmış olan da).
    expect(raw.stations.find((s) => s.icao === 'LTFM')?.tafs.length).toBeGreaterThan(1)
    for (const [i, station] of raw.stations.entries()) {
      const expected = full.stations[i]
      expect(
        { ...toAirportWeather(station, raw.generatedAt), generatedAt: expected?.generatedAt },
        station.icao,
      ).toEqual(expected)
    }
    expect(Buffer.byteLength(res.body)).toBeLessThan(Buffer.byteLength(JSON.stringify(full)))
  })

  it('GET /v1/airports/:code/weather: ICAO ya da IATA; raporsuz havalimanı 200; bilinmeyen ve askerî üs 404', async () => {
    for (const code of ['LTFM', 'ist', 'IST']) {
      const res = await get(`/v1/airports/${code}/weather`)
      expect(res.statusCode, code).toBe(200)
      const body = res.json() as AirportWeather
      expect(AirportWeatherSchema.parse(body)).toEqual(body)
      expect(body.icao, code).toBe('LTFM')
      expect(body.metar?.raw, code).toBe(metars[0]?.raw)
      expect(body.tafs, code).toHaveLength(1)
    }
    const kco = await get('/v1/airports/KCO/weather')
    expect(kco.statusCode).toBe(200)
    expect(kco.json()).toMatchObject({ icao: 'LTBQ', metar: null, tafs: [] })
    // Askerî hava üsleri (D-107) güncel havada ve kayıtta 404.
    for (const code of ['ZZZZ', 'LTAF', 'LTBL', 'igl', 'LTAG']) {
      const res = await get(`/v1/airports/${code}/weather`)
      expect(res.statusCode, code).toBe(404)
      expect(res.json(), code).toEqual(AIRPORT_ERRORS.notFound)
      const history = await get(`/v1/airports/${code}/weather/history`)
      expect(history.statusCode, code).toBe(404)
      expect(history.json(), code).toEqual(AIRPORT_ERRORS.notFound)
    }
  })

  it('GET /v1/airports/:code/weather/history: 24 saat ve 168 saat, en yeni önce', async () => {
    const day = (await get('/v1/airports/IST/weather/history')).json() as WeatherHistoryResponse
    expect(WeatherHistoryResponseSchema.parse(day)).toEqual(day)
    expect(day.icao).toBe('LTFM')
    expect(day.entries.map((e) => [e.kind, e.time])).toEqual([
      ['METAR', ago(10 * MIN).toISOString()],
      ['SPECI', ago(25 * MIN).toISOString()],
      ['METAR', ago(40 * MIN).toISOString()],
      ['TAF', ago(140 * MIN).toISOString()],
      ['TAF', ago(8 * HOUR).toISOString()],
    ])
    expect(day.entries[1]?.metar).toMatchObject({ type: 'SPECI', raw: metars[1]?.raw })
    expect(day.entries[3]?.taf).toMatchObject({
      validFrom: ago(1 * HOUR).toISOString(),
      validTo: new Date(base + 29 * HOUR).toISOString(),
    })

    const week = (
      await get('/v1/airports/LTFM/weather/history?hours=168')
    ).json() as WeatherHistoryResponse
    expect(week.entries.map((e) => e.time)).toEqual([
      ago(10 * MIN).toISOString(),
      ago(25 * MIN).toISOString(),
      ago(40 * MIN).toISOString(),
      ago(140 * MIN).toISOString(),
      ago(8 * HOUR).toISOString(),
      ago(30 * HOUR).toISOString(),
      ago(30 * HOUR).toISOString(),
    ])
    expect(week.entries.slice(-2).map((e) => e.kind)).toEqual(['METAR', 'TAF'])

    const kco = (await get('/v1/airports/KCO/weather/history')).json() as WeatherHistoryResponse
    expect(kco).toMatchObject({ icao: 'LTBQ', entries: [] })
  })
})
