import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import {
  AirportWeatherSchema,
  WeatherBulkResponseSchema,
  WeatherHistoryResponseSchema,
  type AirportWeather,
  type WeatherBulkResponse,
  type WeatherHistoryResponse,
} from '@havayolu/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { testApp } from '../test/helpers'
import { AIRPORT_ERRORS, AIRPORTS_CACHE_MS, AIRPORTS_EMPTY_CACHE_MS } from './airports'
import { CACHE_RETRY_MS } from './cache'
import {
  WEATHER_CACHE_CONTROL,
  WEATHER_CACHE_MS,
  WEATHER_ERRORS,
  WEATHER_HISTORY_CACHE_MAX_ENTRIES,
  WEATHER_HISTORY_MAX_HOURS,
  historyCacheWindow,
  nullableEnums,
  type MetarRecord,
  type TafRecord,
  type WeatherRecords,
  type WeatherRouteOptions,
} from './weather'

// Elle yazılmış, sentetik raporlar (tools/fixtures/weather ile aynı vakalar; canlı istek yok).
const NOW = Date.parse('2026-01-15T13:00:00Z')
const at = (iso: string) => new Date(iso)

const LTFM_RAW = 'LTFM 151250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA'
const LTFM_OLD_RAW = 'LTFM 151220Z 03016G28KT 9999 -SHRA FEW025 BKN035 09/05 Q1009 NOSIG'
const LTBA_RAW = 'LTBA 151250Z 04008KT CAVOK 10/03 Q1010 NOSIG'
const LTBS_SPECI_RAW = 'SPECI LTBS 151242Z 25015G27KT 2000 +TSRAGR SCT012CB BKN025 12/10 Q1007'

const metar = (overrides: Partial<MetarRecord> & Pick<MetarRecord, 'stationIcao'>) =>
  ({
    reportType: 'METAR',
    observedAt: at('2026-01-15T12:50:00Z'),
    rawText: LTFM_RAW,
    flightCategory: 'VFR',
    ...overrides,
  }) satisfies MetarRecord

const ltfmMetar = metar({ stationIcao: 'LTFM' })
const ltfmOldMetar = metar({
  stationIcao: 'LTFM',
  observedAt: at('2026-01-15T12:20:00Z'),
  rawText: LTFM_OLD_RAW,
})
const ltbaMetar = metar({ stationIcao: 'LTBA', rawText: LTBA_RAW })
const ltbsSpeci = metar({
  stationIcao: 'LTBS',
  reportType: 'SPECI',
  observedAt: at('2026-01-15T12:42:00Z'),
  rawText: LTBS_SPECI_RAW,
  flightCategory: 'IFR',
})

const ltfmTaf: TafRecord = {
  stationIcao: 'LTFM',
  issuedAt: at('2026-01-15T10:40:00Z'),
  validFrom: at('2026-01-15T12:00:00Z'),
  validTo: at('2026-01-16T18:00:00Z'),
  rawText:
    'TAF LTFM 151040Z 1512/1618 03015G28KT 9999 SCT025 BKN035 TEMPO 1512/1518 4000 SHRA FEW025CB PROB30 TEMPO 1514/1518 TSRA BECMG 1520/1522 02008KT',
}
const ltfmOldTaf: TafRecord = {
  stationIcao: 'LTFM',
  issuedAt: at('2026-01-15T04:40:00Z'),
  validFrom: at('2026-01-15T06:00:00Z'),
  validTo: at('2026-01-16T12:00:00Z'),
  rawText: 'TAF LTFM 150440Z 1506/1612 04012KT 9999 SCT030 TEMPO 1510/1516 5000 -SHRA',
}
/**
 * Henüz başlamamış yeni TAF (15:00'te başlar): 13:00'te o ana kadar 151040Z'yi yürürlükten
 * kaldırmaz, ikisi de yürürlüktedir (D-088). Toplu yanıtın en kötü durumu budur.
 */
const ltfmNextTaf: TafRecord = {
  stationIcao: 'LTFM',
  issuedAt: at('2026-01-15T12:40:00Z'),
  validFrom: at('2026-01-15T15:00:00Z'),
  validTo: at('2026-01-16T21:00:00Z'),
  rawText:
    'TAF LTFM 151240Z 1515/1621 02012KT 9999 SCT030 BKN040 TEMPO 1515/1519 4000 SHRA BKN020 PROB30 TEMPO 1516/1519 TSRA SCT020CB BECMG 1600/1602 VRB03KT',
}
const ltfmExpiredTaf: TafRecord = {
  stationIcao: 'LTFM',
  issuedAt: at('2026-01-14T04:40:00Z'),
  validFrom: at('2026-01-14T06:00:00Z'),
  validTo: at('2026-01-15T06:00:00Z'),
  rawText: 'TAF LTFM 140440Z 1406/1506 04010KT 9999 FEW030',
}

let clock = NOW
const apps: { close(): Promise<unknown> }[] = []

afterEach(async () => {
  clock = NOW
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

/** Okuyucu sahte; `latest` ve `history` verilen kayıtlardan istenen istasyonları süzer. */
function readers(records: WeatherRecords) {
  const pick = (icaos: readonly string[]): WeatherRecords => ({
    metars: records.metars.filter((m) => icaos.includes(m.stationIcao)),
    tafs: records.tafs.filter((t) => icaos.includes(t.stationIcao)),
  })
  return {
    stations: vi.fn(async (_country: string) => [
      { icao: 'LTFM' },
      { icao: 'LTBQ' },
      { icao: 'LTBA' },
    ]),
    // Listelenen havalimanları (D-080): Türkiye ve 1. halka, liste (IATA) sırasıyla.
    listedStations: vi.fn(async () => [{ icao: 'LGAV' }, { icao: 'LTBA' }, { icao: 'LTFM' }]),
    resolve: vi.fn(async (code: string): Promise<string | null> =>
      code === 'LTFM' || code === 'IST'
        ? 'LTFM'
        : code === 'LTBQ' || code === 'BQJ'
          ? 'LTBQ'
          : null,
    ),
    latest: vi.fn(async (icaos: readonly string[], _now: Date) => pick(icaos)),
    history: vi.fn(async (icao: string, from: Date, to: Date): Promise<WeatherRecords> => {
      const one = pick([icao])
      return {
        metars: one.metars.filter((m) => m.observedAt >= from && m.observedAt <= to),
        tafs: one.tafs.filter((t) => t.issuedAt >= from && t.issuedAt <= to),
      }
    }),
  }
}

const allRecords: WeatherRecords = {
  metars: [ltfmOldMetar, ltfmMetar, ltbaMetar, ltbsSpeci],
  tafs: [ltfmOldTaf, ltfmExpiredTaf, ltfmTaf],
}

async function setup(options: Partial<WeatherRouteOptions> = {}) {
  const { app } = await testApp({
    deps: {
      weather: { ...readers(allRecords), now: () => clock, ...options },
    },
  })
  apps.push(app)
  const get = (url: string) => app.inject({ method: 'GET', url })
  return { app, get }
}

describe('GET /v1/weather', () => {
  it('liste sırasıyla her havalimanı; raporu olmayan metar null; başlıklar ve atıf', async () => {
    const weather = readers(allRecords)
    const { get } = await setup(weather)
    const res = await get('/v1/weather?country=TR')
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(res.headers['cache-control']).toBe(WEATHER_CACHE_CONTROL)
    expect(res.headers['x-ratelimit-limit']).toBe('60')
    const body = res.json() as WeatherBulkResponse
    // Yanıt paylaşılan zod sözleşmesine birebir uyar (fazla alan yok, eksik alan yok).
    expect(WeatherBulkResponseSchema.parse(body)).toEqual(body)
    expect(body.generatedAt).toBe(new Date(NOW).toISOString())
    expect(body.attribution).toEqual({
      text: 'NOAA Aviation Weather Center',
      url: 'https://aviationweather.gov/',
    })
    expect(body.stations.map((s) => s.icao)).toEqual(['LTFM', 'LTBQ', 'LTBA'])
    expect(weather.stations).toHaveBeenCalledWith('TR')
    expect(weather.latest).toHaveBeenCalledWith(['LTFM', 'LTBQ', 'LTBA'], new Date(NOW))

    const [ltfm, ltbq, ltba] = body.stations
    expect(ltbq).toEqual({
      icao: 'LTBQ',
      generatedAt: body.generatedAt,
      metar: null,
      tafs: [],
    })
    // En yeni gözlem; ham metin ve zamanlar veritabanından, gerisi okurken çözümlenir.
    expect(ltfm?.metar).toMatchObject({
      type: 'METAR',
      observedAt: '2026-01-15T12:50:00.000Z',
      raw: LTFM_RAW,
      flightCategory: 'VFR',
      temperatureC: 9,
      dewPointC: 5,
      qnhHpa: 1009,
      wind: { speedKt: 18, gustKt: 32, directionDeg: 30 },
    })
    // Süresi geçen TAF ve yerini 151040Z'ye bırakmış 150440Z düşer (yürürlükteki TAF'lar, D-088).
    expect(ltfm?.tafs.map((t) => t.issuedAt)).toEqual(['2026-01-15T10:40:00.000Z'])
    expect(ltfm?.tafs[0]).toMatchObject({
      validFrom: '2026-01-15T12:00:00.000Z',
      validTo: '2026-01-16T18:00:00.000Z',
      raw: ltfmTaf.rawText,
      amended: false,
      corrected: false,
      cancelled: false,
    })
    expect(ltfm?.tafs[0]?.periods.length).toBeGreaterThan(1)
    expect(ltba?.metar).toMatchObject({ raw: LTBA_RAW, cavok: true, nosig: true })
  })

  it('varsayılan ülke TR; başka ülke ayrı okunur', async () => {
    const weather = readers(allRecords)
    const { get } = await setup(weather)
    expect((await get('/v1/weather')).statusCode).toBe(200)
    expect((await get('/v1/weather?country=DE')).statusCode).toBe(200)
    expect(weather.stations.mock.calls).toEqual([['TR'], ['DE']])
  })

  it('liste boşsa rapor okunmaz, stations boş döner', async () => {
    const weather = readers(allRecords)
    weather.stations.mockResolvedValue([])
    const { get } = await setup(weather)
    const body = (await get('/v1/weather')).json() as WeatherBulkResponse
    expect(body.stations).toEqual([])
    expect(weather.latest).not.toHaveBeenCalled()
  })

  it('ülke kodu iki büyük harf değilse 400 bad_country; okuyucuya gidilmez', async () => {
    const weather = readers(allRecords)
    const { get } = await setup(weather)
    for (const query of ['tr', 'TUR', '', 'T1', 'TR&country=DE', '%20TR']) {
      const res = await get(`/v1/weather?country=${query}`)
      expect(res.statusCode, query).toBe(400)
      expect(res.headers['cache-control'], query).toBe('no-store')
      expect(res.json(), query).toEqual(AIRPORT_ERRORS.badCountry)
    }
    expect(weather.stations).not.toHaveBeenCalled()
    expect(weather.latest).not.toHaveBeenCalled()
  })

  it('60 sn önbellekte kalır, sonra yeniden okunur (çözümleme okurken)', async () => {
    const weather = readers(allRecords)
    const { get } = await setup(weather)
    const first = (await get('/v1/weather')).body
    clock += WEATHER_CACHE_MS - 1
    expect((await get('/v1/weather')).body).toBe(first)
    expect(weather.latest).toHaveBeenCalledTimes(1)
    clock += 1
    const second = (await get('/v1/weather')).json() as WeatherBulkResponse
    expect(weather.latest).toHaveBeenCalledTimes(2)
    expect(second.generatedAt).toBe(new Date(NOW + WEATHER_CACHE_MS).toISOString())
  })

  it('okuma başarısızsa eski kopya sunulur ve 1 dk yeniden denenmez; kopya yoksa 503', async () => {
    const weather = readers(allRecords)
    weather.latest.mockRejectedValueOnce(new Error('connection refused'))
    const { get } = await setup(weather)
    const failed = await get('/v1/weather')
    expect(failed.statusCode).toBe(503)
    expect(failed.headers['cache-control']).toBe('no-store')
    expect(failed.json()).toEqual(WEATHER_ERRORS.unavailable)
    expect(failed.body).not.toContain('connection refused')

    const fresh = await get('/v1/weather')
    expect(fresh.statusCode).toBe(200)
    weather.latest.mockRejectedValue(new Error('down'))
    clock += WEATHER_CACHE_MS
    const stale = await get('/v1/weather')
    expect(stale.statusCode).toBe(200)
    expect(stale.body).toBe(fresh.body)
    expect(weather.latest).toHaveBeenCalledTimes(3)
    clock += CACHE_RETRY_MS - 1
    await get('/v1/weather')
    expect(weather.latest).toHaveBeenCalledTimes(3)
  })

  it('veritabanı yoksa 503 weather_unavailable', async () => {
    const { get } = await setup({ stations: null, latest: null })
    const res = await get('/v1/weather')
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual(WEATHER_ERRORS.unavailable)
  })

  it('veritabanı satırının fazla alanları yanıta girmez', async () => {
    const extra = { ...ltfmMetar, id: 77, fetchedAt: at('2026-01-15T12:55:00Z'), secret: 'x' }
    const { get } = await setup(readers({ metars: [extra], tafs: [] }))
    const res = await get('/v1/weather')
    expect(res.body).not.toContain('secret')
    expect(res.body).not.toContain('fetchedAt')
    const body = res.json() as WeatherBulkResponse
    expect(WeatherBulkResponseSchema.parse(body)).toEqual(body)
  })

  it('bilinmeyen uçuş kategorisi gösterilmez; ICAO kodu olmayan havalimanı listede yer almaz', async () => {
    const weather = readers({
      metars: [
        { ...ltfmMetar, flightCategory: 'UNKN' },
        { ...ltbaMetar, flightCategory: null },
      ],
      tafs: [],
    })
    weather.stations.mockResolvedValue([{ icao: 'LTFM' }, { icao: 'TR-0042' }, { icao: 'LTBA' }])
    const { get } = await setup(weather)
    const body = (await get('/v1/weather')).json() as WeatherBulkResponse
    expect(body.stations.map((s) => [s.icao, s.metar?.flightCategory])).toEqual([
      ['LTFM', null],
      ['LTBA', null],
    ])
    expect(weather.latest).toHaveBeenCalledWith(['LTFM', 'LTBA'], new Date(NOW))
  })

  it('bozuk kayıt loglanır ve atlanır; yanıtın geri kalanı etkilenmez', async () => {
    const broken = { ...ltfmMetar, observedAt: new Date(Number.NaN) }
    const brokenTaf = { ...ltfmTaf, validFrom: new Date(Number.NaN) }
    const weather = readers({
      metars: [broken, ltfmOldMetar, ltbaMetar],
      tafs: [brokenTaf, ltfmOldTaf],
    })
    const { app, get } = await setup(weather)
    const errors = vi.spyOn(app.log, 'error')
    const res = await get('/v1/weather')
    expect(res.statusCode).toBe(200)
    const [ltfm, , ltba] = (res.json() as WeatherBulkResponse).stations
    // En yeni rapor çözülemezse bir önceki gösterilir (zamanıyla, yaşı arayüzde görünür).
    expect(ltfm?.metar?.raw).toBe(LTFM_OLD_RAW)
    expect(ltfm?.tafs.map((t) => t.raw)).toEqual([ltfmOldTaf.rawText])
    expect(ltba?.metar?.raw).toBe(LTBA_RAW)
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({ station: 'LTFM', raw: LTFM_RAW }),
      'metar could not be decoded',
    )
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({ station: 'LTFM', raw: ltfmTaf.rawText }),
      'taf could not be decoded',
    )
  })

  it('61 havalimanı, her birinde METAR ve yürürlükte iki TAF: gövde 1 MB altında', async () => {
    const icaos = Array.from(
      { length: 61 },
      (_, i) =>
        `LT${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`,
    )
    const records: WeatherRecords = {
      metars: icaos.map((icao) =>
        metar({
          stationIcao: icao,
          rawText: `${icao} 151250Z 27022G35KT 220V310 0800 R35/0450N R17/P2000U +SHSN BLSN VV004 M08/M10 Q1021 RESN WS R35 TEMPO 0400 +SHSN`,
        }),
      ),
      tafs: icaos.flatMap((icao) => [
        { ...ltfmTaf, stationIcao: icao, rawText: ltfmTaf.rawText.replace('LTFM', icao) },
        { ...ltfmNextTaf, stationIcao: icao, rawText: ltfmNextTaf.rawText.replace('LTFM', icao) },
      ]),
    }
    const weather = readers(records)
    weather.stations.mockResolvedValue(icaos.map((icao) => ({ icao })))
    const { get } = await setup(weather)
    const res = await get('/v1/weather')
    const body = res.json() as WeatherBulkResponse
    expect(body.stations).toHaveLength(61)
    expect(body.stations.every((s) => s.metar !== null && s.tafs.length === 2)).toBe(true)
    expect(Buffer.byteLength(res.body)).toBeLessThan(1_000_000)
  })
})

describe('GET /v1/weather?scope=listed (D-080)', () => {
  it('listelenen havalimanları liste sırasıyla; ülke okuyucusuna gidilmez; ayrı önbellek', async () => {
    const weather = readers(allRecords)
    const { get } = await setup(weather)
    const res = await get('/v1/weather?scope=listed')
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe(WEATHER_CACHE_CONTROL)
    const body = res.json() as WeatherBulkResponse
    expect(body.stations.map((s) => s.icao)).toEqual(['LGAV', 'LTBA', 'LTFM'])
    // Raporu olmayan yurt dışı havalimanı: metar null, tafs boş.
    expect(body.stations[0]).toMatchObject({ icao: 'LGAV', metar: null, tafs: [] })
    expect(body.stations[2]?.metar?.raw).toBe(ltfmMetar.rawText)
    expect(weather.listedStations).toHaveBeenCalledTimes(1)
    expect(weather.stations).not.toHaveBeenCalled()
    await get('/v1/weather?scope=listed')
    expect(weather.listedStations).toHaveBeenCalledTimes(1)
    await get('/v1/weather')
    expect(weather.stations).toHaveBeenCalledWith('TR')
    expect(weather.listedStations).toHaveBeenCalledTimes(1)
  })

  it('country ile scope birlikte 400 scope_conflict; bilinmeyen scope 400 bad_scope', async () => {
    const weather = readers(allRecords)
    const { get } = await setup(weather)
    for (const query of ['country=TR&scope=listed', 'scope=listed&country=DE']) {
      const res = await get(`/v1/weather?${query}`)
      expect(res.statusCode, query).toBe(400)
      expect(res.headers['cache-control'], query).toBe('no-store')
      expect(res.json(), query).toEqual(AIRPORT_ERRORS.scopeConflict)
    }
    for (const query of ['scope=', 'scope=all', 'scope=Listed', 'scope=listed&scope=listed']) {
      const res = await get(`/v1/weather?${query}`)
      expect(res.statusCode, query).toBe(400)
      expect(res.json(), query).toEqual(AIRPORT_ERRORS.badScope)
    }
    expect(weather.stations).not.toHaveBeenCalled()
    expect(weather.listedStations).not.toHaveBeenCalled()
    expect(weather.latest).not.toHaveBeenCalled()
  })

  it('liste okuyucusu yoksa scope=listed 503; ülke isteği etkilenmez', async () => {
    const { get } = await setup({ listedStations: null })
    const res = await get('/v1/weather?scope=listed')
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual(WEATHER_ERRORS.unavailable)
    expect((await get('/v1/weather?country=TR')).statusCode).toBe(200)
  })

  /**
   * 503 havalimanı (61 Türkiye, 1. halkada 75, 2. halkada 89, 3. halkada 278; D-090). 2. halkada
   * (225) web sunucusu toplu yanıtı Next veri önbelleğinde tutuyordu (öğe sınırı 2 MiB, gövde base64
   * saklandığı için ham gövdede ~1,57 MB) ve harita pencere açılınca istiyordu; bütçe o yüzden 1,8
   * MB'tı. 3. halkada gövde bu sınırı aşar: web toplu yanıtı kendi belleğinde 60 sn tutar, harita
   * penceresi tek havalimanının havasını ister (D-090). Bütçe artık API ve mobil içindir: en kötü
   * durumda 4 MB'ın altı. 2026-10-03 üretim görüntüsü (yalnız yürürlükteki TAF'lar) istasyon başına
   * ~2,9 KB'tı: 503 istasyonda ~1,44 MB, TAF yayım saatlerinde (yürürlükte iki TAF) ~2,35 MB.
   * Buradaki rapor ağırdır (RVR, rüzgâr kesmesi, eğilim; çok dönemli TAF): gerçek veriden büyük.
   */
  /** Tam biçimde ağır raporlarla istasyon başına bütçeler (D-101). */
  const HEAVY_FULL_BYTES_PER_STATION = 7_000
  const HEAVY_ONE_TAF_BYTES_PER_STATION = 4_600

  const heavyListed = (count: number, tafs: readonly TafRecord[]) => {
    const icaos = Array.from(
      { length: count },
      (_, i) =>
        `L${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}X`,
    )
    const records: WeatherRecords = {
      metars: icaos.map((icao) =>
        metar({
          stationIcao: icao,
          rawText: `${icao} 151250Z 27022G35KT 220V310 0800 R35/0450N R17/P2000U +SHSN BLSN VV004 M08/M10 Q1021 RESN WS R35 TEMPO 0400 +SHSN`,
        }),
      ),
      tafs: icaos.flatMap((icao) =>
        tafs.map((taf) => ({
          ...taf,
          stationIcao: icao,
          rawText: taf.rawText.replace('LTFM', icao),
        })),
      ),
    }
    const weather = readers(records)
    weather.listedStations.mockResolvedValue(icaos.map((icao) => ({ icao })))
    return weather
  }

  it('503 havalimanı (1.–3. halka), METAR ve üç geçerli TAF: eski TAF düşer, istasyon başına ≤ 7 KB', async () => {
    // Her istasyonda TAF yayım saatlerindeki durum: yürürlükteki TAF, henüz başlamamış yenisi ve
    // yerini ikisine bırakmış eskisi. Eskisi yanıta girmez.
    const weather = heavyListed(503, [ltfmTaf, ltfmNextTaf, ltfmOldTaf])
    const { get } = await setup(weather)
    const res = await get('/v1/weather?scope=listed')
    const body = res.json() as WeatherBulkResponse
    expect(body.stations).toHaveLength(503)
    expect(body.stations.every((s) => s.metar !== null)).toBe(true)
    expect(
      body.stations.every(
        (s) =>
          s.tafs.map((t) => t.issuedAt).join() ===
          '2026-01-15T12:40:00.000Z,2026-01-15T10:40:00.000Z',
      ),
    ).toBe(true)
    // En kötü durum (her istasyonda ağır METAR ve yürürlükte iki ağır TAF) istasyon başına ~6,8 KB
    // (503 istasyonda ~3,4 MB); eski TAF da girseydi ~8,2 KB olurdu. Bütçe istasyon başınadır
    // (D-101): 4. halkada (1.222 istasyon) web ham biçimi ister (weather-raw.test.ts).
    expect(Buffer.byteLength(res.body) / 503).toBeLessThanOrEqual(HEAVY_FULL_BYTES_PER_STATION)
    expect(weather.latest).toHaveBeenCalledTimes(1)
  })

  it('503 havalimanı, METAR ve yürürlükte tek TAF (olağan durum): istasyon başına ≤ 4,6 KB', async () => {
    const { get } = await setup(heavyListed(503, [ltfmTaf, ltfmOldTaf]))
    const res = await get('/v1/weather?scope=listed')
    const body = res.json() as WeatherBulkResponse
    expect(body.stations).toHaveLength(503)
    expect(body.stations.every((s) => s.tafs.length === 1)).toBe(true)
    // İstasyon başına ~4,4 KB (ağır METAR ve TAF ile; üretim verisiyle ~2,9 KB).
    expect(Buffer.byteLength(res.body) / 503).toBeLessThanOrEqual(HEAVY_ONE_TAF_BYTES_PER_STATION)
  })

  it("yürürlükteki TAF: toplu yanıt ve tek havalimanı aynı TAF'ları verir; kayıtta hepsi kalır", async () => {
    const weather = readers({ metars: [ltfmMetar], tafs: [ltfmOldTaf, ltfmTaf, ltfmNextTaf] })
    const { get } = await setup(weather)
    const bulk = (await get('/v1/weather?scope=listed')).json() as WeatherBulkResponse
    const one = (await get('/v1/airports/LTFM/weather')).json() as AirportWeather
    const issued = ['2026-01-15T12:40:00.000Z', '2026-01-15T10:40:00.000Z']
    expect(bulk.stations.find((s) => s.icao === 'LTFM')?.tafs.map((t) => t.issuedAt)).toEqual(
      issued,
    )
    expect(one.tafs.map((t) => t.issuedAt)).toEqual(issued)
    // 15:30'da 151240Z başlamıştır; 151040Z'nin kalan geçerliliğini kapsar.
    clock = Date.parse('2026-01-15T15:30:00Z')
    const later = (await get('/v1/airports/LTFM/weather')).json() as AirportWeather
    expect(later.tafs.map((t) => t.issuedAt)).toEqual(['2026-01-15T12:40:00.000Z'])
    // METAR/TAF kaydı yerini yenisine bırakmış TAF'ları da verir.
    const log = (await get('/v1/airports/LTFM/weather/history?hours=24')).json() as {
      entries: { kind: string; time: string }[]
    }
    expect(log.entries.filter((e) => e.kind === 'TAF')).toHaveLength(3)
  })
})

describe('GET /v1/airports/:code/weather', () => {
  it('ICAO ya da IATA, büyük/küçük harf fark etmez; kanonik ICAO ile tek kayıt', async () => {
    const weather = readers(allRecords)
    const { get } = await setup(weather)
    const bodies: AirportWeather[] = []
    for (const code of ['LTFM', 'ltfm', 'IST', 'iSt']) {
      const res = await get(`/v1/airports/${code}/weather`)
      expect(res.statusCode, code).toBe(200)
      expect(res.headers['content-type'], code).toBe('application/json; charset=utf-8')
      expect(res.headers['cache-control'], code).toBe(WEATHER_CACHE_CONTROL)
      expect(res.headers['x-ratelimit-limit'], code).toBe('60')
      bodies.push(res.json() as AirportWeather)
    }
    const [first] = bodies
    expect(first && AirportWeatherSchema.parse(first)).toEqual(first)
    expect(first?.icao).toBe('LTFM')
    expect(first?.metar?.raw).toBe(LTFM_RAW)
    // Yürürlükteki TAF (D-088): 150440Z'nin kalan geçerliliğini 151040Z kapsar.
    expect(first?.tafs.map((t) => t.raw)).toEqual([ltfmTaf.rawText])
    for (const body of bodies) expect(body).toEqual(first)
    // Kod büyük harfe çevrilip bir kez çözülür; hava kanonik ICAO başına bir kez okunur.
    expect(weather.resolve.mock.calls).toEqual([['LTFM'], ['IST']])
    expect(weather.latest).toHaveBeenCalledTimes(1)
    expect(weather.latest).toHaveBeenCalledWith(['LTFM'], new Date(NOW))
  })

  it('raporu olmayan bilinen havalimanı 200, metar null ve tafs boş', async () => {
    const { get } = await setup()
    const res = await get('/v1/airports/BQJ/weather')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      icao: 'LTBQ',
      generatedAt: new Date(NOW).toISOString(),
      metar: null,
      tafs: [],
    })
  })

  it('SPECI de güncel rapor olarak döner', async () => {
    const weather = readers(allRecords)
    weather.resolve.mockResolvedValue('LTBS')
    const { get } = await setup(weather)
    const body = (await get('/v1/airports/LTBS/weather')).json() as AirportWeather
    expect(body.metar).toMatchObject({
      type: 'SPECI',
      observedAt: '2026-01-15T12:42:00.000Z',
      raw: LTBS_SPECI_RAW,
      flightCategory: 'IFR',
    })
  })

  it('biçimi bozuk kod 400 bad_code; okuyucuya gidilmez', async () => {
    const weather = readers(allRecords)
    const { get } = await setup(weather)
    for (const code of ['LT', 'LTFMX', 'LT-M', 'LT%20M', '%C4%B0ST', 'ab_c']) {
      const res = await get(`/v1/airports/${code}/weather`)
      expect(res.statusCode, code).toBe(400)
      expect(res.headers['cache-control'], code).toBe('no-store')
      expect(res.json(), code).toEqual(AIRPORT_ERRORS.badCode)
    }
    expect(weather.resolve).not.toHaveBeenCalled()
    expect(weather.latest).not.toHaveBeenCalled()
  })

  it('bilinmeyen kod 404 airport_not_found; sonuç 1 dk tutulur', async () => {
    const weather = readers(allRecords)
    const { get } = await setup(weather)
    const res = await get('/v1/airports/ZZZZ/weather')
    expect(res.statusCode).toBe(404)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.json()).toEqual(AIRPORT_ERRORS.notFound)
    clock += AIRPORTS_EMPTY_CACHE_MS - 1
    await get('/v1/airports/zzzz/weather')
    expect(weather.resolve).toHaveBeenCalledTimes(1)
    clock += 1
    await get('/v1/airports/ZZZZ/weather')
    expect(weather.resolve).toHaveBeenCalledTimes(2)
    expect(weather.latest).not.toHaveBeenCalled()
  })

  it('çözülen kod 10 dk, hava 60 sn önbellekte kalır', async () => {
    const weather = readers(allRecords)
    const { get } = await setup(weather)
    await get('/v1/airports/IST/weather')
    clock += WEATHER_CACHE_MS
    await get('/v1/airports/IST/weather')
    expect(weather.latest).toHaveBeenCalledTimes(2)
    clock += AIRPORTS_CACHE_MS - WEATHER_CACHE_MS - 1
    await get('/v1/airports/IST/weather')
    expect(weather.resolve).toHaveBeenCalledTimes(1)
    clock += 1
    await get('/v1/airports/IST/weather')
    expect(weather.resolve).toHaveBeenCalledTimes(2)
  })

  it('çözülen kod ICAO konum göstergesi değilse 404 (rapor ICAO ile tutulur)', async () => {
    const weather = readers(allRecords)
    weather.resolve.mockResolvedValue('TR-0042')
    const { get } = await setup(weather)
    const res = await get('/v1/airports/XYZ/weather')
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual(AIRPORT_ERRORS.notFound)
    expect(weather.latest).not.toHaveBeenCalled()
  })

  it('çözümleyici ya da hava okuyucusu yoksa 503', async () => {
    const noResolver = await setup({ resolve: null })
    const unresolved = await noResolver.get('/v1/airports/LTFM/weather')
    expect(unresolved.statusCode).toBe(503)
    expect(unresolved.json()).toEqual(AIRPORT_ERRORS.unavailable)

    const noWeather = await setup({ latest: null })
    const res = await noWeather.get('/v1/airports/LTFM/weather')
    expect(res.statusCode).toBe(503)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.json()).toEqual(WEATHER_ERRORS.unavailable)
  })
})

describe('GET /v1/airports/:code/weather/history', () => {
  /** LTFM için 7 günlük kayıt: yarım saatte bir METAR, günde dört TAF ve bir SPECI. */
  function weekOfRecords(): WeatherRecords {
    const metars: MetarRecord[] = []
    const tafs: TafRecord[] = []
    const pad = (n: number) => String(n).padStart(2, '0')
    // Pencerenin içinde: ilk gözlem başlangıçtan 20 dk sonra, sonra her :20 ve :50.
    const start = NOW - WEATHER_HISTORY_MAX_HOURS * 3_600_000 + 20 * 60_000
    for (let t = start; t <= NOW; t += 30 * 60_000) {
      const d = new Date(t)
      const group = `${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}Z`
      metars.push(
        metar({
          stationIcao: 'LTFM',
          observedAt: d,
          rawText: `LTFM ${group} 27022G35KT 220V310 0800 R35/0450N R17/P2000U +SHSN BLSN VV004 M08/M10 Q1021 RESN WS R35 TEMPO 0400 +SHSN`,
        }),
      )
      if (d.getUTCHours() % 6 === 4 && d.getUTCMinutes() === 50) {
        const issued = d
        const day = pad(issued.getUTCDate())
        const hour = pad(issued.getUTCHours())
        metars.push(
          metar({
            stationIcao: 'LTFM',
            reportType: 'SPECI',
            observedAt: new Date(t - 15 * 60_000),
            rawText: `SPECI LTFM ${day}${hour}35Z 25015G27KT 2000 +TSRAGR SCT012CB BKN025 12/10 Q1007`,
          }),
        )
        tafs.push({
          stationIcao: 'LTFM',
          issuedAt: issued,
          validFrom: new Date(issued.getTime() + 70 * 60_000),
          validTo: new Date(issued.getTime() + 31 * 3_600_000),
          rawText: `TAF LTFM ${day}${hour}50Z ${day}06/${day}12 03015G28KT 9999 SCT025 BKN035 TEMPO ${day}06/${day}10 4000 SHRA FEW025CB PROB30 TEMPO ${day}08/${day}10 TSRA BECMG ${day}10/${day}12 02008KT`,
        })
      }
    }
    return { metars, tafs }
  }

  it('varsayılan son 24 saat, en yeni önce; METAR/SPECI çözümlenmiş, TAF özetli', async () => {
    const weather = readers(allRecords)
    const { get } = await setup(weather)
    const res = await get('/v1/airports/IST/weather/history')
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(res.headers['cache-control']).toBe(WEATHER_CACHE_CONTROL)
    expect(res.headers['x-ratelimit-limit']).toBe('60')
    const body = res.json() as WeatherHistoryResponse
    expect(WeatherHistoryResponseSchema.parse(body)).toEqual(body)
    expect(body).toMatchObject({
      icao: 'LTFM',
      from: '2026-01-14T13:00:00.000Z',
      to: '2026-01-15T13:00:00.000Z',
      generatedAt: '2026-01-15T13:00:00.000Z',
    })
    expect(weather.history).toHaveBeenCalledWith(
      'LTFM',
      new Date(NOW - 24 * 3_600_000),
      new Date(NOW),
    )
    // Süresi geçmiş TAF 24 saatten önce yayımlandığı için kayıtta yok.
    expect(body.entries.map((e) => [e.kind, e.time])).toEqual([
      ['METAR', '2026-01-15T12:50:00.000Z'],
      ['METAR', '2026-01-15T12:20:00.000Z'],
      ['TAF', '2026-01-15T10:40:00.000Z'],
      ['TAF', '2026-01-15T04:40:00.000Z'],
    ])
    const [newest, , taf] = body.entries
    expect(newest).toMatchObject({ raw: LTFM_RAW, metar: { raw: LTFM_RAW, type: 'METAR' } })
    expect(newest?.taf).toBeUndefined()
    expect(taf).toEqual({
      kind: 'TAF',
      time: '2026-01-15T10:40:00.000Z',
      raw: ltfmTaf.rawText,
      taf: {
        validFrom: '2026-01-15T12:00:00.000Z',
        validTo: '2026-01-16T18:00:00.000Z',
        amended: false,
        corrected: false,
        cancelled: false,
      },
    })
  })

  it('hours penceresi; SPECI kendi türüyle; pencere dışı kayıt girmez', async () => {
    const weather = readers(allRecords)
    weather.resolve.mockResolvedValue('LTBS')
    const { get } = await setup(weather)
    const body = (
      await get('/v1/airports/LTBS/weather/history?hours=1')
    ).json() as WeatherHistoryResponse
    expect(body.from).toBe('2026-01-15T12:00:00.000Z')
    expect(body.entries).toHaveLength(1)
    expect(body.entries[0]).toMatchObject({
      kind: 'SPECI',
      time: '2026-01-15T12:42:00.000Z',
      metar: { type: 'SPECI', raw: LTBS_SPECI_RAW },
    })
    // Okuyucu pencere dışı satır döndürse bile yanıta girmez.
    const loose = readers(allRecords)
    loose.history.mockResolvedValue(allRecords)
    const other = await setup(loose)
    const filtered = (
      await other.get('/v1/airports/LTFM/weather/history?hours=1')
    ).json() as WeatherHistoryResponse
    expect(filtered.entries.map((e) => e.time)).toEqual([
      '2026-01-15T12:50:00.000Z',
      '2026-01-15T12:20:00.000Z',
    ])
  })

  it('hours 1–168 tam sayı değilse 400 bad_hours; okuyucuya gidilmez', async () => {
    const weather = readers(allRecords)
    const { get } = await setup(weather)
    for (const hours of ['0', '169', '-1', '1.5', 'abc', '', '24&hours=48', '1000']) {
      const res = await get(`/v1/airports/LTFM/weather/history?hours=${hours}`)
      expect(res.statusCode, hours).toBe(400)
      expect(res.headers['cache-control'], hours).toBe('no-store')
      expect(res.json(), hours).toEqual(WEATHER_ERRORS.badHours)
    }
    // Kod önce denetlenir.
    expect((await get('/v1/airports/L-M/weather/history?hours=0')).json()).toEqual(
      AIRPORT_ERRORS.badCode,
    )
    expect(weather.resolve).not.toHaveBeenCalled()
    expect(weather.history).not.toHaveBeenCalled()
    for (const hours of ['1', '168']) {
      expect((await get(`/v1/airports/LTFM/weather/history?hours=${hours}`)).statusCode).toBe(200)
    }
  })

  it('bilinmeyen kod 404; okuyucu yoksa 503', async () => {
    const { get } = await setup()
    const missing = await get('/v1/airports/ZZZ/weather/history')
    expect(missing.statusCode).toBe(404)
    expect(missing.json()).toEqual(AIRPORT_ERRORS.notFound)
    const none = await setup({ history: null })
    const res = await none.get('/v1/airports/LTFM/weather/history')
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual(WEATHER_ERRORS.unavailable)
  })

  it('ICAO ve pencere (24 ya da 168 saat) başına 60 sn önbellek; diğer saatler pencereden kesilir', async () => {
    const weather = readers(allRecords)
    const { get } = await setup(weather)
    await get('/v1/airports/LTFM/weather/history')
    await get('/v1/airports/IST/weather/history?hours=24')
    const one = (
      await get('/v1/airports/IST/weather/history?hours=1')
    ).json() as WeatherHistoryResponse
    expect(weather.history).toHaveBeenCalledTimes(1)
    expect(one.from).toBe('2026-01-15T12:00:00.000Z')
    expect(one.entries.map((e) => e.time)).toEqual([
      '2026-01-15T12:50:00.000Z',
      '2026-01-15T12:20:00.000Z',
    ])
    await get('/v1/airports/IST/weather/history?hours=48')
    await get('/v1/airports/IST/weather/history?hours=167')
    expect(weather.history).toHaveBeenCalledTimes(2)
    expect(weather.history).toHaveBeenLastCalledWith(
      'LTFM',
      new Date(NOW - WEATHER_HISTORY_MAX_HOURS * 3_600_000),
      new Date(NOW),
    )
    clock += WEATHER_CACHE_MS
    await get('/v1/airports/LTFM/weather/history')
    expect(weather.history).toHaveBeenCalledTimes(3)
  })

  it('kesilmiş pencere, aynı saatle doğrudan okunan yanıtla birebir aynıdır', async () => {
    const records = weekOfRecords()
    const { get } = await setup(readers(records))
    for (const hours of [1, 7, 24, 25, 100, 168]) {
      const res = await get(`/v1/airports/LTFM/weather/history?hours=${hours}`)
      const body = res.json() as WeatherHistoryResponse
      expect(WeatherHistoryResponseSchema.parse(body), String(hours)).toEqual(body)
      const from = NOW - hours * 3_600_000
      expect(body.from).toBe(new Date(from).toISOString())
      const expected =
        records.metars.filter((m) => m.observedAt.getTime() >= from).length +
        records.tafs.filter((t) => t.issuedAt.getTime() >= from).length
      expect(body.entries, String(hours)).toHaveLength(expected)
    }
  })

  it('farklı saat ve istasyonlarla doldurulan önbellek anahtar ve bayt sınırında kalır (bellek tükenmez)', async () => {
    // 12 istasyon, her biri 168 saatlik (~0,5 MB) kayıt; bütçe 2 MB, yani pencereler atılmak zorunda.
    // Her yanıt kaydı çözümlediği için yük küçük tutulur (CI makinesinde 320 istek 20 sn sürüyordu).
    const week = weekOfRecords()
    const icaos = Array.from({ length: 12 }, (_, i) => `Z${String(i).padStart(3, '0')}`)
    const history = vi.fn(async (icao: string, from: Date, to: Date): Promise<WeatherRecords> => ({
      metars: week.metars
        .filter((m) => m.observedAt >= from && m.observedAt <= to)
        .map((m) => ({
          ...m,
          stationIcao: icao,
          rawText: m.rawText.replace(/^(SPECI )?LTFM/, `$1${icao}`),
        })),
      tafs: week.tafs
        .filter((t) => t.issuedAt >= from && t.issuedAt <= to)
        .map((t) => ({ ...t, stationIcao: icao, rawText: t.rawText.replace('LTFM', icao) })),
    }))
    const budget = 2 * 1024 * 1024
    const { app } = await setup({
      resolve: async (code) => (icaos.includes(code) ? code : null),
      history,
      historyCacheMaxBytes: budget,
    })
    // Saldırgan çok sayıda IP'den gelir: istasyon başına ayrı adres (IP başına hız sınırı 60/dk).
    const get = (url: string, ip = '10.0.0.1') =>
      app.inject({ method: 'GET', url, remoteAddress: ip })
    for (const [i, icao] of icaos.entries()) {
      for (const hours of [168, 100, 24, 1]) {
        const res = await get(`/v1/airports/${icao}/weather/history?hours=${hours}`, `10.0.1.${i}`)
        expect(res.statusCode).toBe(200)
      }
    }
    // 4 farklı saat değeri yalnızca iki pencere okur: istasyon başına 2 okuma (eskiden 4 anahtar).
    expect(history).toHaveBeenCalledTimes(icaos.length * 2)
    // Bütçe birkaç tam pencere tutar: ilk istasyonun 168 saati çoktan atılmıştır, yeniden okunur;
    // son istasyonunki önbellektedir.
    await get(`/v1/airports/${icaos.at(-1)}/weather/history?hours=168`)
    expect(history).toHaveBeenCalledTimes(icaos.length * 2)
    await get(`/v1/airports/${icaos[0]}/weather/history?hours=168`)
    expect(history).toHaveBeenCalledTimes(icaos.length * 2 + 1)
    await app.close()
  }, 30_000)

  it('pencere seçimi: 1–24 saat 24, 25–168 saat 168; anahtar sınırı küçüktür', () => {
    expect(historyCacheWindow(1)).toBe(24)
    expect(historyCacheWindow(24)).toBe(24)
    expect(historyCacheWindow(25)).toBe(168)
    expect(historyCacheWindow(168)).toBe(168)
    // Listelenen havalimanları × 2 pencere (3. halkada 503 × 2 = 1.006, D-090); asıl sınır bayt
    // bütçesidir.
    expect(WEATHER_HISTORY_CACHE_MAX_ENTRIES).toBeGreaterThanOrEqual(503 * 2)
    expect(WEATHER_HISTORY_CACHE_MAX_ENTRIES).toBeLessThanOrEqual(1024)
  })

  it('168 saatlik kayıt (yarım saatte bir METAR, SPECI, TAF): gövde 1 MB altında', async () => {
    const records = weekOfRecords()
    const { get } = await setup(readers(records))
    const res = await get(`/v1/airports/LTFM/weather/history?hours=${WEATHER_HISTORY_MAX_HOURS}`)
    expect(res.statusCode).toBe(200)
    const body = res.json() as WeatherHistoryResponse
    expect(body.entries.length).toBe(records.metars.length + records.tafs.length)
    expect(body.entries.every((e) => (e.kind === 'TAF' ? e.taf : e.metar) !== undefined)).toBe(true)
    const times = body.entries.map((e) => Date.parse(e.time))
    expect(times).toEqual([...times].sort((a, b) => b - a))
    expect(Buffer.byteLength(res.body)).toBeLessThan(1_000_000)
  })
})

describe('OpenAPI', () => {
  it('üç uç weather etiketiyle ve zod sözleşmesinden üretilen yanıt şemasıyla belgelenir', async () => {
    const { get } = await setup()
    const spec = (await get('/openapi.json')).json() as {
      tags: { name: string }[]
      paths: Record<
        string,
        Record<
          string,
          {
            tags?: string[]
            parameters?: { name: string; in: string }[]
            responses?: Record<
              string,
              {
                content?: Record<
                  string,
                  { schema?: { properties?: object; anyOf?: { properties?: object }[] } }
                >
              }
            >
          }
        >
      >
    }
    expect(spec.tags.map((t) => t.name)).toContain('weather')
    const paths = [
      '/v1/weather',
      '/v1/airports/{code}/weather',
      '/v1/airports/{code}/weather/history',
    ]
    const expectedKeys = [
      ['generatedAt', 'attribution', 'stations'],
      ['icao', 'generatedAt', 'metar', 'tafs'],
      ['icao', 'from', 'to', 'generatedAt', 'entries'],
    ]
    for (const [i, path] of paths.entries()) {
      const get = spec.paths[path]?.get
      expect(get?.tags, path).toEqual(['weather'])
      const schema = get?.responses?.['200']?.content?.['application/json']?.schema
      // Toplu yanıt iki biçimden biridir (full ya da raw, D-101): ikisi de aynı zarfı taşır.
      const variants = schema?.anyOf ?? [schema]
      expect(variants, path).toHaveLength(path === '/v1/weather' ? 2 : 1)
      for (const variant of variants) {
        expect(Object.keys(variant?.properties ?? {}).sort(), path).toEqual(
          expect.arrayContaining((expectedKeys[i] ?? []).sort()),
        )
      }
    }
    expect(
      spec.paths['/v1/airports/{code}/weather/history']?.get?.parameters?.map((p) => p.name).sort(),
    ).toEqual(['code', 'hours'])
    expect(spec.paths['/v1/weather']?.get?.parameters?.map((p) => p.name).sort()).toEqual([
      'country',
      'format',
      'scope',
    ])
  })
})

// ---------------------------------------------------------------------------------------------
// Yayımlanan OpenAPI şeması gerçek yanıtları kabul eder (Ajv ile gidiş-dönüş).

type Validate = ((data: unknown) => boolean) & { errors?: unknown }
interface AjvLike {
  compile(schema: object): Validate
}

/**
 * Ajv ve ajv-formats, Fastify'ın kendi doğrulayıcısının (@fastify/ajv-compiler) bağımlılıklarıdır;
 * pakete yeni bağımlılık eklenmez, aynı kurulumdan çözülür.
 */
function fastifyAjv(): AjvLike {
  const fromApi = createRequire(import.meta.url)
  const fromFastify = createRequire(fromApi.resolve('fastify'))
  const fromCompiler = createRequire(fromFastify.resolve('@fastify/ajv-compiler'))
  const Ajv = (fromCompiler('ajv') as { default: new (options: object) => AjvLike }).default
  const addFormats = (fromCompiler('ajv-formats') as { default: (ajv: AjvLike) => void }).default
  const ajv = new Ajv({ strict: false, allErrors: true })
  addFormats(ajv)
  return ajv
}

const weatherFixture = (file: string): unknown[] =>
  JSON.parse(
    readFileSync(new URL(`../../../../tools/fixtures/weather/${file}`, import.meta.url), 'utf8'),
  ) as unknown[]

/** tools/fixtures/weather kayıtları (fixtureNow = NOW; kaydırma yok) veritabanı satırı biçiminde. */
function fixtureRecords(): WeatherRecords {
  const awcTime = (value: unknown) =>
    new Date(typeof value === 'number' ? value * 1000 : Date.parse(String(value).replace(' ', 'T')))
  const metars = (weatherFixture('metar.json') as Record<string, unknown>[]).map(
    (m): MetarRecord => ({
      stationIcao: String(m.icaoId),
      reportType: m.metarType === 'SPECI' ? 'SPECI' : 'METAR',
      observedAt: awcTime(m.obsTime),
      rawText: String(m.rawOb),
      flightCategory: typeof m.fltCat === 'string' ? m.fltCat : null,
    }),
  )
  const tafs = (weatherFixture('taf.json') as Record<string, unknown>[]).map((t): TafRecord => ({
    stationIcao: String(t.icaoId),
    issuedAt: awcTime(t.issueTime),
    validFrom: awcTime(t.validTimeFrom),
    validTo: awcTime(t.validTimeTo),
    rawText: String(t.rawTAF),
  }))
  return { metars, tafs }
}

describe('OpenAPI gidiş-dönüş', () => {
  it('null alabilen enum alanları yayımlanan şemada null kabul eder', () => {
    expect(
      nullableEnums({
        properties: {
          qualifier: { anyOf: [{ type: 'string', enum: ['above', 'below'] }, { type: 'null' }] },
          kind: { type: 'string', enum: ['METAR', 'SPECI'] },
        },
      }),
    ).toEqual({
      properties: {
        qualifier: {
          anyOf: [{ type: 'string', enum: ['above', 'below', null] }, { type: 'null' }],
        },
        kind: { type: 'string', enum: ['METAR', 'SPECI'] },
      },
    })
  })

  it('üç ucun fixture yanıtları (ham toplu biçim ve 168 saatlik kayıt dahil) /openapi.json şemalarıyla doğrulanır', async () => {
    const records = fixtureRecords()
    const week = weekOfRecordsForSpec()
    const icaos = [...new Set(records.metars.map((m) => m.stationIcao))]
    const all: WeatherRecords = {
      metars: [...records.metars, ...week.metars],
      tafs: [...records.tafs, ...week.tafs],
    }
    const weather = readers(all)
    const { get } = await setup({
      ...weather,
      stations: async () => [...icaos, 'LTBQ', 'ZZWK'].map((icao) => ({ icao })),
      resolve: async (code) => (code === 'IST' ? 'LTFM' : code),
    })
    const spec = (await get('/openapi.json')).json() as {
      paths: Record<
        string,
        { get?: { responses?: Record<string, { content?: Record<string, { schema?: object }> }> } }
      >
    }
    const ajv = fastifyAjv()
    const validator = (path: string) => {
      const schema =
        spec.paths[path]?.get?.responses?.['200']?.content?.['application/json']?.schema
      expect(schema, path).toBeDefined()
      return ajv.compile(schema ?? {})
    }
    const cases: [string, string][] = [
      ['/v1/weather', '/v1/weather?country=TR'],
      ['/v1/weather', '/v1/weather?scope=listed'],
      ['/v1/weather', '/v1/weather?scope=listed&format=raw'],
      ['/v1/weather', '/v1/weather?country=TR&format=raw'],
      ...icaos.map((icao): [string, string] => [
        '/v1/airports/{code}/weather',
        `/v1/airports/${icao}/weather`,
      ]),
      ...icaos.map((icao): [string, string] => [
        '/v1/airports/{code}/weather/history',
        `/v1/airports/${icao}/weather/history?hours=${WEATHER_HISTORY_MAX_HOURS}`,
      ]),
      ['/v1/airports/{code}/weather/history', '/v1/airports/ZZWK/weather/history?hours=168'],
    ]
    let nulls = 0
    for (const [path, url] of cases) {
      const res = await get(url)
      expect(res.statusCode, url).toBe(200)
      const body = res.json() as unknown
      const validate = validator(path)
      const valid = validate(body)
      expect(valid ? null : validate.errors, url).toBeNull()
      nulls += (res.body.match(/"qualifier":null/g) ?? []).length
    }
    // Vakalar gerçekten null enum değerleri içerir (düzeltme olmadan Ajv bunları reddederdi).
    expect(nulls).toBeGreaterThan(10)
  })
})

/** 168 saatlik yoğun kayıt (ZZWK): yarım saatte bir METAR, günde dört TAF ve SPECI. */
function weekOfRecordsForSpec(): WeatherRecords {
  const metars: MetarRecord[] = []
  const tafs: TafRecord[] = []
  const pad = (n: number) => String(n).padStart(2, '0')
  for (
    let t = NOW - WEATHER_HISTORY_MAX_HOURS * 3_600_000 + 20 * 60_000;
    t <= NOW;
    t += 30 * 60_000
  ) {
    const d = new Date(t)
    const day = pad(d.getUTCDate())
    const hour = pad(d.getUTCHours())
    metars.push(
      metar({
        stationIcao: 'ZZWK',
        observedAt: d,
        rawText: `ZZWK ${day}${hour}${pad(d.getUTCMinutes())}Z 27022G35KT 220V310 0800 R35/0450N R17/P2000U +SHSN BLSN VV004 M08/M10 Q1021 RESN WS R35 TEMPO 0400 +SHSN`,
      }),
    )
    if (d.getUTCHours() % 6 === 4 && d.getUTCMinutes() === 50) {
      tafs.push({
        stationIcao: 'ZZWK',
        issuedAt: d,
        validFrom: new Date(t + 70 * 60_000),
        validTo: new Date(t + 31 * 3_600_000),
        rawText: `TAF ZZWK ${day}${hour}50Z ${day}06/${day}12 03015G28KT 9999 SCT025 BKN035 TEMPO ${day}06/${day}10 4000 SHRA FEW025CB PROB30 TEMPO ${day}08/${day}10 TSRA BECMG ${day}10/${day}12 02008KT`,
      })
    }
  }
  return { metars, tafs }
}
