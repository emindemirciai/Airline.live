import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type Database } from './client'
import {
  activeStationsWithArp,
  addProviderHourly,
  createFlight,
  deleteProviderHealth,
  endFlights,
  insertTrackPoints,
  loadActiveFlights,
  loadTrailingGroundStart,
  readProviderSummaries,
  recordProviderStatusChange,
  touchFlights,
  writeProviderHealth,
  type ProviderHealthSnapshot,
  type ProviderHourlyCounters,
  type TrackPointRow,
} from './ingest'
import { runMigrations } from './migrate'
import { defaultPartitionRows, ensureTrackPartitions } from './partitions'
import { seedStations } from './seed'

const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_db_ingest'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))

const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined })
// Worker'daki gibi `createDb`: Drizzle aynı istemcinin zaman ve JSON serileştiricilerini değiştirir.
// Fonksiyonlar bu istemciyle çağrılır; denetim sorguları düz istemciyle (`check`) yapılır.
let database: Database
let sql: postgres.Sql
let check: postgres.Sql

beforeAll(async () => {
  await admin.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.unsafe(`create database ${testDbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder })
  database = createDb(testUrl, { max: 4 })
  sql = database.sql
  check = postgres(testUrl, { max: 2, onnotice: () => undefined })
})

afterAll(async () => {
  await Promise.allSettled([sql?.end({ timeout: 5 }), check?.end({ timeout: 5 })])
  await admin.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.end({ timeout: 5 })
})

const at = (iso: string) => new Date(iso)

describe('activeStationsWithArp', () => {
  it('etkin ve havalimanı satırı olan istasyonlar, önce birincil; ident iki kez varsa küçük kimlik', async () => {
    await seedStations(database.db)
    const airport = (id: number, ident: string, lat: number, lon: number, elev: number | null) =>
      check`insert into airports (id, ident, type, name, latitude_deg, longitude_deg, elevation_ft,
          iso_country, iso_region, scheduled_service, row_hash)
        values (${id}, ${ident}, 'large_airport', ${ident}, ${lat}, ${lon}, ${elev}, 'TR', 'TR-34',
          true, ${`h${id}`})`
    await airport(1, 'LTFJ', 40.898602, 29.3092, 312)
    await airport(2, 'LTFM', 41.274874, 28.732136, 325)
    await airport(3, 'LTAC', 40.128101, 32.995098, 3125)
    await airport(4, 'LTBJ', 38.2924, 27.157, null)
    // İçe aktarımda geçici çift (D-066): daha büyük kimlikli satır yok sayılır.
    await airport(9, 'LTFJ', 0, 0, 0)
    // LTAI'nin havalimanı satırı yok; LTAC etkin değil.
    await check`update stations set is_active = false where icao = 'LTAC'`

    const stations = await activeStationsWithArp(sql)
    expect(stations.map((s) => s.icao)).toEqual(['LTFM', 'LTBJ', 'LTFJ'])
    expect(stations[0]).toEqual({
      icao: 'LTFM',
      iata: 'IST',
      isPrimary: true,
      fetchRadiusNm: 60,
      lat: 41.274874,
      lon: 28.732136,
      elevationFt: 325,
    })
    expect(stations[1]?.elevationFt).toBeNull()
    expect(stations[2]).toMatchObject({ icao: 'LTFJ', iata: 'SAW', lat: 40.898602, lon: 29.3092 })
  })
})

const flight = (hex: string, first: string, last = first) => ({
  hex,
  callsign: null,
  registration: null,
  typeCode: null,
  firstSeenAt: at(first),
  lastSeenAt: at(last),
})

const flightRow = async (id: number) => {
  const [r] = await check<
    {
      status: string
      last_seen_at: Date
      callsign: string | null
      registration: string | null
      type_code: string | null
    }[]
  >`select status, last_seen_at, callsign, registration, type_code from flights where id = ${id}`
  return r
}

describe('uçuş kaydı', () => {
  it('createFlight sayı kimlik döndürür; touchFlights son görülmeyi yalnızca ileri taşır', async () => {
    const id = await createFlight(sql, {
      ...flight('4bb463', '2026-01-20T10:00:00Z'),
      callsign: 'THY4',
      typeCode: 'A359',
    })
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)

    await touchFlights(sql, [
      {
        id,
        lastSeenAt: at('2026-01-20T10:05:00Z'),
        callsign: null,
        registration: 'TC-LGA',
        typeCode: null,
      },
    ])
    let r = await flightRow(id)
    expect(r).toMatchObject({ status: 'active', callsign: 'THY4', registration: 'TC-LGA' })
    expect(r?.type_code).toBe('A359')
    expect(r?.last_seen_at.toISOString()).toBe('2026-01-20T10:05:00.000Z')

    // Daha eski zaman geri götürmez; aynı kimlik iki kez gelirse en yenisi kullanılır.
    await touchFlights(sql, [
      {
        id,
        lastSeenAt: at('2026-01-20T10:07:00Z'),
        callsign: 'THY4X',
        registration: null,
        typeCode: null,
      },
      {
        id,
        lastSeenAt: at('2026-01-20T10:06:00Z'),
        callsign: 'OLD',
        registration: null,
        typeCode: null,
      },
    ])
    await touchFlights(sql, [
      {
        id,
        lastSeenAt: at('2026-01-20T09:00:00Z'),
        callsign: null,
        registration: null,
        typeCode: null,
      },
    ])
    r = await flightRow(id)
    expect(r?.last_seen_at.toISOString()).toBe('2026-01-20T10:07:00.000Z')
    expect(r).toMatchObject({ callsign: 'THY4X', registration: 'TC-LGA', type_code: 'A359' })

    await touchFlights(sql, [])
  })

  it('touchFlights birden çok uçuşu tek seferde günceller; tırnak ve Unicode bozulmaz', async () => {
    const a = await createFlight(sql, flight('ccccc1', '2026-01-20T10:00:00Z'))
    const b = await createFlight(sql, flight('ccccc2', '2026-01-20T10:00:00Z'))
    await touchFlights(sql, [
      {
        id: a,
        lastSeenAt: at('2026-01-20T10:01:00Z'),
        callsign: `O'NE"1`,
        registration: null,
        typeCode: null,
      },
      {
        id: b,
        lastSeenAt: at('2026-01-20T10:02:00Z'),
        callsign: null,
        registration: 'TC-ŞĞÜ',
        typeCode: 'B38M',
      },
    ])
    expect(await flightRow(a)).toMatchObject({ callsign: `O'NE"1`, registration: null })
    expect(await flightRow(b)).toMatchObject({ registration: 'TC-ŞĞÜ', type_code: 'B38M' })
    expect((await flightRow(b))?.last_seen_at.toISOString()).toBe('2026-01-20T10:02:00.000Z')
  })

  it('metin alanlarından \\u0000 ve eşsiz vekil karakterleri atılır; yazma reddedilmez', async () => {
    const id = await createFlight(sql, {
      ...flight('eeeee1', '2026-01-20T10:00:00Z'),
      callsign: 'THY\u00004',
      registration: '\ud800TC-ABC\udc00',
      // Geçerli vekil çifti (emoji) korunur.
      typeCode: 'A😀',
    })
    expect(await flightRow(id)).toMatchObject({
      callsign: 'THY4',
      registration: 'TC-ABC',
      type_code: 'A😀',
    })
    await touchFlights(sql, [
      {
        id,
        lastSeenAt: at('2026-01-20T10:01:00Z'),
        // Yalnızca geçersiz karakterden oluşan değer null olur ve eskisini silmez.
        callsign: '\u0000',
        registration: 'TC-\u0000LGA\udc00',
        typeCode: '\ud83d',
      },
    ])
    const r = await flightRow(id)
    expect(r).toMatchObject({ callsign: 'THY4', registration: 'TC-LGA', type_code: 'A😀' })
    expect(r?.last_seen_at.toISOString()).toBe('2026-01-20T10:01:00.000Z')
  })

  it('endFlights kapatır; boş liste bir şey yapmaz', async () => {
    const a = await createFlight(sql, flight('aaaaa1', '2026-01-20T10:00:00Z'))
    const b = await createFlight(sql, flight('aaaaa2', '2026-01-20T10:00:00Z'))
    await endFlights(sql, [])
    await endFlights(sql, [a, a])
    expect((await flightRow(a))?.status).toBe('ended')
    expect((await flightRow(b))?.status).toBe('active')
    await endFlights(sql, [b])
  })

  it('loadActiveFlights eskileri ve aynı hex için eski çiftleri kapatır, kalanları döndürür', async () => {
    await check`update flights set status = 'ended'`
    const stale = await createFlight(sql, flight('bbbbb1', '2026-01-20T08:00:00Z'))
    const olderDup = await createFlight(
      sql,
      flight('bbbbb2', '2026-01-20T09:40:00Z', '2026-01-20T09:50:00Z'),
    )
    const newerDup = await createFlight(
      sql,
      flight('bbbbb2', '2026-01-20T09:55:00Z', '2026-01-20T09:58:00Z'),
    )
    const tieA = await createFlight(sql, flight('bbbbb3', '2026-01-20T09:45:00Z'))
    const tieB = await createFlight(sql, flight('bbbbb3', '2026-01-20T09:45:00Z'))
    const fresh = await createFlight(sql, {
      ...flight('bbbbb0', '2026-01-20T09:31:00Z', '2026-01-20T09:59:00.123Z'),
      callsign: 'PGT1',
      registration: 'TC-NBA',
      typeCode: 'A20N',
    })

    const active = await loadActiveFlights(sql, at('2026-01-20T09:30:00Z'))
    expect(active.map((f) => f.id)).toEqual([fresh, newerDup, tieB])
    expect(active[0]).toEqual({
      id: fresh,
      hex: 'bbbbb0',
      callsign: 'PGT1',
      registration: 'TC-NBA',
      typeCode: 'A20N',
      firstSeenAt: at('2026-01-20T09:31:00Z'),
      lastSeenAt: at('2026-01-20T09:59:00.123Z'),
    })
    for (const id of [stale, olderDup, tieA]) expect((await flightRow(id))?.status).toBe('ended')
    // İkinci çağrı aynı sonucu verir.
    expect((await loadActiveFlights(sql, at('2026-01-20T09:30:00Z'))).map((f) => f.id)).toEqual([
      fresh,
      newerDup,
      tieB,
    ])
  })
})

describe('insertTrackPoints', () => {
  const now = at('2026-01-20T12:00:00Z')
  const point = (
    flightId: number,
    ts: Date,
    extra: Partial<TrackPointRow> = {},
  ): TrackPointRow => ({
    flightId,
    ts,
    lat: 41.274874,
    lon: 28.732136,
    altBaroFt: 3025.4,
    altGeomFt: 3150.6,
    gsKt: 182.5,
    trackDeg: 354.25,
    verticalRateFpm: -704.5,
    onGround: false,
    source: 0,
    seenPosS: 0.4,
    baroRateFpm: -704.5,
    ...extra,
  })

  beforeAll(async () => {
    await ensureTrackPartitions(sql, now)
  })

  it('tam sayıları yuvarlar, doğru güne yazar; aynı nokta ikinci kez yazılmaz', async () => {
    const rows = [
      point(1, at('2026-01-20T11:00:00Z')),
      point(1, at('2026-01-20T11:00:30Z'), { altBaroFt: null, gsKt: Number.NaN, onGround: true }),
      point(2, at('2026-01-19T23:59:59.500Z'), { source: 17 }),
    ]
    expect(await insertTrackPoints(sql, 'track_points_sampled', rows)).toBe(3)
    expect(await insertTrackPoints(sql, 'track_points_sampled', rows)).toBe(0)
    expect(
      await insertTrackPoints(sql, 'track_points_sampled', [
        ...rows,
        point(1, at('2026-01-20T11:01:00Z')),
      ]),
    ).toBe(1)

    const [first] = await check<
      {
        alt_baro_ft: number | null
        alt_geom_ft: number
        gs_kt: number
        track_deg: number
        vertical_rate_fpm: number
        lat: number
        source: number
        seen_pos_s: number
        baro_rate_fpm: number
      }[]
    >`select alt_baro_ft, alt_geom_ft, gs_kt, track_deg, vertical_rate_fpm, lat, source,
        seen_pos_s, baro_rate_fpm
      from track_points_sampled_p20260120 where flight_id = 1 and ts = '2026-01-20T11:00:00Z'`
    expect(first).toEqual({
      alt_baro_ft: 3025,
      alt_geom_ft: 3151,
      gs_kt: 182.5,
      track_deg: 354.25,
      vertical_rate_fpm: -704,
      lat: 41.274874,
      source: 0,
      seen_pos_s: expect.closeTo(0.4, 6) as number,
      baro_rate_fpm: -704,
    })
    const [second] = await check<
      { alt_baro_ft: number | null; gs_kt: number | null; on_ground: boolean }[]
    >`select alt_baro_ft, gs_kt, on_ground from track_points_sampled
      where flight_id = 1 and ts = '2026-01-20T11:00:30Z'`
    expect(second).toEqual({ alt_baro_ft: null, gs_kt: null, on_ground: true })
    const [prevDay] = await check<{ ts: Date }[]>`
      select ts from track_points_sampled_p20260119 where source = 17`
    expect(prevDay?.ts.toISOString()).toBe('2026-01-19T23:59:59.500Z')
    expect(await defaultPartitionRows(sql)).toEqual({
      track_points_sampled: 0,
      track_points_fine: 0,
    })
  })

  it('sütun türüne sığmayan sayılar boş yazılır; satır reddedilmez', async () => {
    const ts = at('2026-01-20T11:30:00Z')
    const rows = [
      point(8, ts, {
        altBaroFt: 2_147_483_647.4,
        altGeomFt: 3e9,
        verticalRateFpm: -3e9,
        gsKt: 1e39,
        trackDeg: 1e-50,
        seenPosS: 1e39,
        baroRateFpm: -3e9,
      }),
      point(8, new Date(ts.getTime() + 1000), {
        altBaroFt: -2_147_483_648,
        gsKt: Number.POSITIVE_INFINITY,
        trackDeg: -1e-50,
        verticalRateFpm: Number.NEGATIVE_INFINITY,
        seenPosS: Number.NaN,
        baroRateFpm: Number.POSITIVE_INFINITY,
      }),
      point(8, new Date(ts.getTime() + 2000), { altBaroFt: -2_147_483_649, gsKt: 1e-40 }),
    ]
    for (const client of [sql, check]) {
      await check`delete from track_points_sampled where flight_id = 8`
      expect(await insertTrackPoints(client, 'track_points_sampled', rows)).toBe(3)
      const got = await check<
        {
          alt_baro_ft: number | null
          alt_geom_ft: number | null
          gs_kt: number | null
          track_deg: number | null
          vertical_rate_fpm: number | null
          seen_pos_s: number | null
          baro_rate_fpm: number | null
        }[]
      >`select alt_baro_ft, alt_geom_ft, gs_kt, track_deg, vertical_rate_fpm, seen_pos_s,
          baro_rate_fpm
        from track_points_sampled where flight_id = 8 order by ts`
      expect(got[0]).toEqual({
        alt_baro_ft: 2_147_483_647,
        alt_geom_ft: null,
        gs_kt: null,
        track_deg: 0,
        vertical_rate_fpm: null,
        seen_pos_s: null,
        baro_rate_fpm: null,
      })
      expect(got[1]).toMatchObject({
        alt_baro_ft: -2_147_483_648,
        gs_kt: null,
        track_deg: 0,
        vertical_rate_fpm: null,
        seen_pos_s: null,
        baro_rate_fpm: null,
      })
      expect(got[2]?.alt_baro_ft).toBeNull()
      // Float4'ün alt-normal aralığındaki değer yazılır (sıfır değil).
      expect(got[2]?.gs_kt).toBeGreaterThan(0)
      expect(got[2]?.gs_kt).toBeLessThan(1e-39)
    }
  })

  it('ham seen_pos ve baro_rate iki tabloya da yazılır; verilmeyen değer null okunur', async () => {
    const ts = at('2026-01-20T11:40:00Z')
    const rows = [
      point(11, ts, { seenPosS: 2.75, baroRateFpm: -1216, verticalRateFpm: -1216 }),
      // Barometrik hız yok, görünen dikey hız geometrikten gelir: ham sütun boş kalır.
      point(11, new Date(ts.getTime() + 1000), {
        seenPosS: null,
        baroRateFpm: null,
        verticalRateFpm: -640,
      }),
    ]
    for (const table of ['track_points_sampled', 'track_points_fine'] as const) {
      expect(await insertTrackPoints(sql, table, rows)).toBe(2)
      const got = await check<
        { seen_pos_s: number | null; baro_rate_fpm: number | null; vertical_rate_fpm: number }[]
      >`select seen_pos_s, baro_rate_fpm, vertical_rate_fpm from ${check(table)}
        where flight_id = 11 order by ts`
      expect(got).toEqual([
        { seen_pos_s: 2.75, baro_rate_fpm: -1216, vertical_rate_fpm: -1216 },
        { seen_pos_s: null, baro_rate_fpm: null, vertical_rate_fpm: -640 },
      ])
    }
    // Satırlar günün partition'ına düştü; DEFAULT boş kalır.
    expect(await defaultPartitionRows(sql)).toEqual({
      track_points_sampled: 0,
      track_points_fine: 0,
    })
  })

  it("1000'den fazla satırı partilere böler; tablolar birbirinden bağımsızdır", async () => {
    const start = at('2026-01-20T06:00:00Z').getTime()
    const rows = Array.from({ length: 2500 }, (_, i) => point(7, new Date(start + i * 1000)))
    expect(await insertTrackPoints(sql, 'track_points_fine', rows)).toBe(2500)
    expect(await insertTrackPoints(sql, 'track_points_fine', rows.slice(1000, 1500))).toBe(0)
    const [fine] = await check<{ n: number }[]>`
      select count(*)::int as n from track_points_fine where flight_id = 7`
    expect(fine?.n).toBe(2500)
    const [sampled] = await check<{ n: number }[]>`
      select count(*)::int as n from track_points_sampled where flight_id = 7`
    expect(sampled?.n).toBe(0)
    expect(await insertTrackPoints(sql, 'track_points_fine', [])).toBe(0)
  })

  describe('loadTrailingGroundStart', () => {
    const t = (hhmmss: string) => at(`2026-01-20T${hhmmss}Z`)
    const ground = (flightId: number, hhmmss: string) =>
      point(flightId, t(hhmmss), { onGround: true, altBaroFt: null })
    const air = (flightId: number, hhmmss: string) => point(flightId, t(hhmmss))

    beforeAll(async () => {
      await insertTrackPoints(sql, 'track_points_sampled', [
        // 9001: kalkış öncesi yer dizisi, uçuş, iniş sonrası yer dizisi → iniş sonrası ilk satır.
        ground(9001, '07:00:00'),
        ground(9001, '07:10:00'),
        air(9001, '07:20:00'),
        air(9001, '08:00:00'),
        ground(9001, '08:10:00'),
        ground(9001, '08:10:30'),
        ground(9001, '08:40:00'),
        // 9002: yerde başlar, en yeni satır havada → yok.
        ground(9002, '08:00:00'),
        air(9002, '08:30:00'),
        // 9003: hep yerde; `since` öncesi satır sayılmaz.
        ground(9003, '06:00:00'),
        ground(9003, '07:45:00'),
        ground(9003, '08:20:00'),
        // 9005: yalnızca `since` öncesinde satır → yok.
        ground(9005, '06:30:00'),
        // 9006: havada satır `since` öncesinde; pencere içinde yalnızca yer → pencere başı.
        air(9006, '07:15:00'),
        ground(9006, '07:40:00'),
        ground(9006, '07:50:00'),
      ])
      // İnce iz okunmaz: 9002'nin ince izde daha yeni yer satırı olsa da sonuç değişmez.
      await insertTrackPoints(sql, 'track_points_fine', [ground(9002, '08:45:00')])
    })

    it('sondaki yer dizisinin ilk satırını döndürür; havada biten ve satırsız uçuşlar yok', async () => {
      const since = t('07:30:00')
      const result = await loadTrailingGroundStart(
        sql,
        [9001, 9002, 9003, 9004, 9005, 9006, 9001],
        since,
      )
      expect([...result.keys()].sort()).toEqual([9001, 9003, 9006])
      expect(result.get(9001)).toBe(t('08:10:00').getTime())
      expect(result.get(9003)).toBe(t('07:45:00').getTime())
      expect(result.get(9006)).toBe(t('07:40:00').getTime())
      expect(typeof [...result.keys()][0]).toBe('number')
    })

    it('`since` kalkış öncesine alınırsa yine yalnızca sondaki dizi sayılır; boş liste boş döner', async () => {
      const result = await loadTrailingGroundStart(sql, [9001, 9003], t('00:00:00'))
      expect(result.get(9001)).toBe(t('08:10:00').getTime())
      expect(result.get(9003)).toBe(t('06:00:00').getTime())
      expect((await loadTrailingGroundStart(sql, [], t('00:00:00'))).size).toBe(0)
      // Düz postgres-js istemcisiyle de aynı sonuç.
      expect((await loadTrailingGroundStart(check, [9001], t('07:30:00'))).get(9001)).toBe(
        t('08:10:00').getTime(),
      )
    })
  })
})

const snapshot = (over: Partial<ProviderHealthSnapshot> = {}): ProviderHealthSnapshot => ({
  provider: 'adsbLol',
  status: 'ok',
  lastSuccessAt: at('2026-01-20T10:29:50Z'),
  lastErrorAt: null,
  lastError: null,
  consecutiveFailures: 0,
  rps: 0.1,
  circuit: 'closed',
  backoffUntil: null,
  freshnessP95S: 14.5,
  errorRatio60s: 0,
  requests60s: 6,
  ...over,
})

const counters = (over: Partial<ProviderHourlyCounters> = {}): ProviderHourlyCounters => ({
  requests: 0,
  successes: 0,
  rateLimited: 0,
  serverErrors: 0,
  networkErrors: 0,
  otherErrors: 0,
  freshnessP95S: null,
  ...over,
})

describe('sağlayıcı sağlık tabloları', () => {
  it('writeProviderHealth sağlayıcı başına tek satır tutar ve üzerine yazar', async () => {
    await writeProviderHealth(sql, snapshot())
    await writeProviderHealth(
      sql,
      snapshot({
        status: 'degraded',
        lastErrorAt: at('2026-01-20T10:29:55Z'),
        lastError: 'rate_limit',
        consecutiveFailures: 1,
        rps: 0.05,
        circuit: 'half_open',
        backoffUntil: at('2026-01-20T10:30:25Z'),
        errorRatio60s: 0.25,
        requests60s: 4,
      }),
    )
    const rows = await check<
      {
        status: string
        last_success_at: Date
        last_error_at: Date
        last_error: string
        consecutive_failures: number
        rps: number
        circuit: string
        error_ratio_60s: number
        requests_60s: number
      }[]
    >`select status, last_success_at, last_error_at, last_error, consecutive_failures, rps,
        circuit, error_ratio_60s, requests_60s
      from provider_health`
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      status: 'degraded',
      last_success_at: at('2026-01-20T10:29:50Z'),
      last_error_at: at('2026-01-20T10:29:55Z'),
      last_error: 'rate_limit',
      consecutive_failures: 1,
      circuit: 'half_open',
      error_ratio_60s: 0.25,
      requests_60s: 4,
    })
    expect(rows[0]?.rps).toBeCloseTo(0.05, 5)
  })

  it('deleteProviderHealth yalnızca verilen sağlayıcının satırını siler', async () => {
    await writeProviderHealth(sql, snapshot({ provider: 'toDelete' }))
    expect(await deleteProviderHealth(sql, 'toDelete')).toBe(1)
    expect(await deleteProviderHealth(sql, 'toDelete')).toBe(0)
    const rows = await check<{ provider: string }[]>`select provider from provider_health`
    expect(rows.map((r) => r.provider)).toEqual(['adsbLol'])
  })

  it('addProviderHourly aynı saate ekler; tazelikte saatin en kötüsü kalır', async () => {
    await addProviderHourly(
      sql,
      'localReceiver',
      at('2026-01-20T10:05:00Z'),
      counters({ requests: 60, successes: 59, networkErrors: 1, freshnessP95S: 2.5 }),
    )
    await addProviderHourly(
      sql,
      'localReceiver',
      at('2026-01-20T10:59:59Z'),
      counters({ requests: 60, successes: 60, freshnessP95S: 1.5 }),
    )
    await addProviderHourly(
      sql,
      'localReceiver',
      at('2026-01-20T10:30:00Z'),
      counters({ requests: 1, otherErrors: 1 }),
    )
    await addProviderHourly(sql, 'localReceiver', at('2026-01-20T11:00:00Z'), counters())
    const rows = await check<
      {
        hour: Date
        requests: number
        successes: number
        network_errors: number
        other_errors: number
        freshness_p95_max_s: number | null
      }[]
    >`select hour, requests, successes, network_errors, other_errors, freshness_p95_max_s
      from provider_health_hourly where provider = 'localReceiver' order by hour`
    expect(rows.map((r) => r.hour.toISOString())).toEqual([
      '2026-01-20T10:00:00.000Z',
      '2026-01-20T11:00:00.000Z',
    ])
    expect(rows[0]).toMatchObject({
      requests: 121,
      successes: 119,
      network_errors: 1,
      other_errors: 1,
      freshness_p95_max_s: 2.5,
    })
    expect(rows[1]).toMatchObject({ requests: 0, freshness_p95_max_s: null })
  })

  it('recordProviderStatusChange geçişleri sırayla saklar', async () => {
    await recordProviderStatusChange(sql, {
      provider: 'adsbLol',
      at: at('2026-01-20T10:00:00Z'),
      from: null,
      to: 'ok',
      reason: null,
    })
    await recordProviderStatusChange(sql, {
      provider: 'adsbLol',
      at: at('2026-01-20T10:29:55Z'),
      from: 'ok',
      to: 'degraded',
      reason: 'rate_limit_ratio',
    })
    const rows = await check<
      { at: Date; from_status: string | null; to_status: string; reason: string | null }[]
    >`select at, from_status, to_status, reason from provider_status_changes
      where provider = 'adsbLol' order by at`
    expect(rows.map((r) => ({ ...r }))).toEqual([
      { at: at('2026-01-20T10:00:00Z'), from_status: null, to_status: 'ok', reason: null },
      {
        at: at('2026-01-20T10:29:55Z'),
        from_status: 'ok',
        to_status: 'degraded',
        reason: 'rate_limit_ratio',
      },
    ])
  })

  it('readProviderSummaries: 429 oranları pencere başını içeren kovadan itibaren; istek yoksa null', async () => {
    const now = at('2026-01-20T10:30:00Z')
    // adsbLol: 10:00 (2/10), 09:00 (8/10), dün 11:00 (0/20), dün 10:00 (10/10), dün 09:00 (5/5)
    // ve iki gün önce (100/100). 10:30'da 1 sa penceresi 09:30'da başlar: 09:00 kovası dahildir.
    // 24 sa penceresi dün 10:30'da başlar: dün 10:00 kovası dahil, dün 09:00 ve öncesi hariç.
    await addProviderHourly(
      sql,
      'adsbLol',
      at('2026-01-20T10:10:00Z'),
      counters({ requests: 10, successes: 8, rateLimited: 2 }),
    )
    await addProviderHourly(
      sql,
      'adsbLol',
      at('2026-01-20T09:10:00Z'),
      counters({ requests: 10, successes: 2, rateLimited: 8 }),
    )
    await addProviderHourly(
      sql,
      'adsbLol',
      at('2026-01-19T11:10:00Z'),
      counters({ requests: 20, successes: 20 }),
    )
    await addProviderHourly(
      sql,
      'adsbLol',
      at('2026-01-19T10:20:00Z'),
      counters({ requests: 10, rateLimited: 10 }),
    )
    await addProviderHourly(
      sql,
      'adsbLol',
      at('2026-01-19T09:50:00Z'),
      counters({ requests: 5, rateLimited: 5 }),
    )
    await addProviderHourly(
      sql,
      'adsbLol',
      at('2026-01-18T10:10:00Z'),
      counters({ requests: 100, rateLimited: 100 }),
    )
    // localReceiver: 10:00 kovasında 121 istek, 429 yok; 11:00 kovasında istek yok.
    await writeProviderHealth(
      sql,
      snapshot({ provider: 'localReceiver', rps: null, freshnessP95S: null, errorRatio60s: null }),
    )
    // Hiç saatlik satırı olmayan sağlayıcı; bilinmeyen durum ve devre değerleri.
    await writeProviderHealth(sql, snapshot({ provider: 'zzzOther', status: 'down' }))
    await check`update provider_health set circuit = 'bogus', status = 'bogus'
      where provider = 'zzzOther'`

    const summaries = await readProviderSummaries(sql, now)
    expect(summaries.map((s) => s.provider)).toEqual(['adsbLol', 'localReceiver', 'zzzOther'])
    const [adsbLol, local, other] = summaries
    expect(adsbLol?.rateLimitedRatio1h).toBeCloseTo(10 / 20, 10)
    expect(adsbLol?.rateLimitedRatio24h).toBeCloseTo(20 / 50, 10)
    expect(adsbLol).toMatchObject({
      status: 'degraded',
      circuit: 'half_open',
      lastSuccessAt: at('2026-01-20T10:29:50Z'),
      lastErrorAt: at('2026-01-20T10:29:55Z'),
      lastError: 'rate_limit',
      consecutiveFailures: 1,
      requests60s: 4,
      errorRatio60s: 0.25,
      freshnessP95S: 14.5,
      backoffUntil: at('2026-01-20T10:30:25Z'),
    })
    expect(adsbLol?.rps).toBeCloseTo(0.05, 5)
    expect(adsbLol?.updatedAt).toBeInstanceOf(Date)
    expect(Math.abs(Date.now() - (adsbLol?.updatedAt.getTime() ?? 0))).toBeLessThan(60_000)
    expect(local).toMatchObject({
      rps: null,
      freshnessP95S: null,
      errorRatio60s: null,
      lastErrorAt: null,
      backoffUntil: null,
      rateLimitedRatio1h: 0,
      rateLimitedRatio24h: 0,
    })
    expect(other).toMatchObject({
      status: 'down',
      circuit: 'closed',
      rateLimitedRatio1h: null,
      rateLimitedRatio24h: null,
    })

    // Saat başından hemen sonra (11:00 kovası boş) önceki saatin kovası hâlâ sayılır: oran
    // kaybolmaz. 11:45'te pencere 10:45'te başlar, 10:00 kovası dahildir.
    for (const time of ['2026-01-20T11:00:10Z', '2026-01-20T11:45:00Z']) {
      const summaries = await readProviderSummaries(sql, at(time))
      expect(summaries.find((s) => s.provider === 'adsbLol')?.rateLimitedRatio1h).toBeCloseTo(0.2)
      expect(summaries.find((s) => s.provider === 'localReceiver')?.rateLimitedRatio1h).toBe(0)
    }
    // 1 saatlik pencerede yalnızca istek sayısı 0 olan kova varsa oran null'dır.
    const later = await readProviderSummaries(sql, at('2026-01-20T12:05:00Z'))
    expect(later.find((s) => s.provider === 'localReceiver')?.rateLimitedRatio1h).toBeNull()
    expect(later.find((s) => s.provider === 'adsbLol')?.rateLimitedRatio1h).toBeNull()
  })
})

describe('düz postgres-js istemcisi (Drizzle olmadan)', () => {
  it('aynı fonksiyonlar zaman ve JSON değerlerini doğru yazar ve okur', async () => {
    const id = await createFlight(check, flight('ddddd1', '2026-01-20T10:00:00Z'))
    await touchFlights(check, [
      {
        id,
        lastSeenAt: at('2026-01-20T10:10:00.250Z'),
        callsign: 'THY7',
        registration: null,
        typeCode: null,
      },
    ])
    const active = await loadActiveFlights(check, at('2026-01-20T10:00:00Z'))
    expect(active.find((f) => f.id === id)).toMatchObject({
      callsign: 'THY7',
      lastSeenAt: at('2026-01-20T10:10:00.250Z'),
    })
    expect(
      await insertTrackPoints(check, 'track_points_sampled', [
        {
          flightId: id,
          ts: at('2026-01-20T10:10:00.250Z'),
          lat: 41,
          lon: 29,
          altBaroFt: null,
          altGeomFt: null,
          gsKt: null,
          trackDeg: null,
          verticalRateFpm: null,
          onGround: true,
          source: 1,
          seenPosS: 0.1,
          baroRateFpm: null,
        },
      ]),
    ).toBe(1)
    await writeProviderHealth(
      check,
      snapshot({ provider: 'plainClient', backoffUntil: at('2026-01-20T10:31:00Z') }),
    )
    await addProviderHourly(
      check,
      'plainClient',
      at('2026-01-20T10:15:00Z'),
      counters({ requests: 4, rateLimited: 1 }),
    )
    await recordProviderStatusChange(check, {
      provider: 'plainClient',
      at: at('2026-01-20T10:15:00Z'),
      from: null,
      to: 'ok',
      reason: null,
    })
    const summary = (await readProviderSummaries(check, at('2026-01-20T10:30:00Z'))).find(
      (s) => s.provider === 'plainClient',
    )
    expect(summary).toMatchObject({
      backoffUntil: at('2026-01-20T10:31:00Z'),
      lastSuccessAt: at('2026-01-20T10:29:50Z'),
      rateLimitedRatio1h: 0.25,
    })
  })
})
