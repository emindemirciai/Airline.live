import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runMigrations } from './migrate'
import {
  defaultPartitionRows,
  dropExpiredTrackPartitions,
  ensureTrackPartitions,
  listTrackPartitions,
  maintainTrackPartitions,
  trackPartitionStatus,
} from './partitions'
import {
  recordReferenceCheck,
  recordReferenceError,
  ReferenceGuardError,
  referenceStatus,
  syncAirlines,
  syncOurAirports,
  type AirlineInsert,
  type AirportInsert,
  type RunwayInsert,
} from './reference'
import { airlineOverrides, airports, runways, stations } from './schema'
import { seedStations } from './seed'

const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_db_data'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))

const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined })
let sql: postgres.Sql
let db: PostgresJsDatabase

beforeAll(async () => {
  await admin.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.unsafe(`create database ${testDbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder })
  sql = postgres(testUrl, { max: 4, onnotice: () => undefined })
  db = drizzle(sql)
})

afterAll(async () => {
  await sql?.end({ timeout: 5 })
  await admin.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.end({ timeout: 5 })
})

const names = async (table: 'track_points_sampled' | 'track_points_fine') =>
  (await listTrackPartitions(sql, table)).map((p) => p.name)

describe("iz partition'ları (sahte saat, DEFAULT partition'lı şema)", () => {
  const retentionDays = { track_points_sampled: 7, track_points_fine: 30 }

  it('dünden 7 gün ilerisine kadar açar; ikinci çalışma bir şey açmaz', async () => {
    const now = new Date('2026-01-20T10:00:00Z')
    const { created, movedRows } = await ensureTrackPartitions(sql, now)
    expect(created).toHaveLength(18)
    expect(movedRows).toBe(0)
    expect(await names('track_points_sampled')).toEqual([
      'track_points_sampled_p20260119',
      'track_points_sampled_p20260120',
      'track_points_sampled_p20260121',
      'track_points_sampled_p20260122',
      'track_points_sampled_p20260123',
      'track_points_sampled_p20260124',
      'track_points_sampled_p20260125',
      'track_points_sampled_p20260126',
      'track_points_sampled_p20260127',
    ])
    expect((await ensureTrackPartitions(sql, now)).created).toEqual([])
  })

  it("satır doğru güne düşer; aralık dışı satır DEFAULT'a gider ve sayılır", async () => {
    await sql`insert into track_points_sampled (flight_id, ts, lat, lon, source)
      values (1, '2026-01-19T12:00:00Z', 41.26, 28.74, 1)`
    await sql`insert into track_points_sampled (flight_id, ts, lat, lon, source)
      values (1, '2026-03-01T00:00:00Z', 41.26, 28.74, 1)`
    const [inDay] = await sql`select count(*)::int as n from track_points_sampled_p20260119`
    expect(inDay?.n).toBe(1)
    expect(await defaultPartitionRows(sql)).toEqual({
      track_points_sampled: 1,
      track_points_fine: 0,
    })
    const status = await trackPartitionStatus(sql, new Date('2026-01-20T10:00:00Z'))
    expect(status.track_points_sampled).toMatchObject({
      partitions: 9,
      oldestDay: '2026-01-19',
      newestDay: '2026-01-27',
      daysAhead: 7,
      defaultRows: 1,
    })
    await sql`delete from track_points_sampled where ts = '2026-03-01T00:00:00Z'`
  })

  it('8 gün sonra: saklama süresi dolanları siler, 7 gün ilerisini açar', async () => {
    const now = new Date('2026-01-28T01:00:00Z')
    const result = await maintainTrackPartitions(sql, now, { retentionDays })
    // Saklama 7 gün: 28 Ocak − 7 = 21 Ocak; bitişi ≤ 21 Ocak olan 19 ve 20 Ocak silinir.
    expect(result.dropped).toEqual([
      'track_points_sampled_p20260119',
      'track_points_sampled_p20260120',
    ])
    expect(result.created).toHaveLength(16)
    expect(result.defaultRows).toEqual({ track_points_sampled: 0, track_points_fine: 0 })
    const sampled = await names('track_points_sampled')
    expect(sampled[0]).toBe('track_points_sampled_p20260121')
    expect(sampled.at(-1)).toBe('track_points_sampled_p20260204')
    // İnce iz 30 gün saklanır: hiçbiri silinmez.
    expect((await names('track_points_fine'))[0]).toBe('track_points_fine_p20260119')
    // Silinen partition'daki satır da gitti.
    const [rows] = await sql`select count(*)::int as n from track_points_sampled`
    expect(rows?.n).toBe(0)
  })

  it('kilit alınamazsa (lock_timeout) bekleyip yeniden dener', async () => {
    const blocker = postgres(testUrl, { max: 1, onnotice: () => undefined })
    let release: () => void = () => undefined
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let locked: () => void = () => undefined
    const lockTaken = new Promise<void>((resolve) => {
      locked = resolve
    })
    const blocking = blocker.begin(async (tx) => {
      await tx`lock table track_points_sampled in access share mode`
      locked()
      await held
    })
    await lockTaken
    const sleeps: number[] = []
    const dropped = await dropExpiredTrackPartitions(sql, new Date('2026-01-29T01:00:00Z'), {
      retentionDays,
      attempts: 2,
      jitter: () => 0,
      sleep: async (ms) => {
        sleeps.push(ms)
        release()
        await blocking
      },
    })
    await blocker.end({ timeout: 5 })
    expect(sleeps).toEqual([1000])
    expect(dropped).toEqual(['track_points_sampled_p20260121'])
  }, 30_000)

  it("DEFAULT'a düşen satır, günü açılırken yeni partition'a taşınır; süresi dolan DEFAULT satırı silinir", async () => {
    // 8 Şubat'ın partition'ı henüz yok (son açılış 28 Ocak'ta, 4 Şubat'a kadar): satır DEFAULT'a düşer.
    // 2 Ocak'ın partition'ı hiç açılmamış: o satır da DEFAULT'tadır ve saklama süresi dolmuştur.
    await sql`insert into track_points_sampled (flight_id, ts, lat, lon, source)
      values (2, '2026-02-08T12:00:00Z', 41.26, 28.74, 1), (3, '2026-01-02T12:00:00Z', 41.26, 28.74, 1)`
    expect((await defaultPartitionRows(sql)).track_points_sampled).toBe(2)

    // 7 Şubat: açılma aralığı 6–14 Şubat, 8 Şubat dahil. Taşıma olmasa CREATE 23514 ile düşerdi.
    const result = await maintainTrackPartitions(sql, new Date('2026-02-07T01:00:00Z'), {
      retentionDays,
    })
    expect(result.movedRows).toBe(1)
    expect(result.purgedDefaultRows).toBe(1)
    expect(result.defaultRows).toEqual({ track_points_sampled: 0, track_points_fine: 0 })
    const [moved] = await sql`select flight_id from track_points_sampled_p20260208`
    expect(moved?.flight_id).toBe('2')
    expect((await names('track_points_sampled')).at(-1)).toBe('track_points_sampled_p20260214')
  })
})

describe('tohum istasyonları', () => {
  it('iki kez çalışınca kayıt yinelenmez; yöneticinin değişikliği korunur', async () => {
    expect(await seedStations(db)).toBe(5)
    await db.update(stations).set({ fetchRadiusNm: 80 }).where(eq(stations.icao, 'LTFJ'))
    expect(await seedStations(db)).toBe(0)
    const rows = await db.select().from(stations).orderBy(stations.icao)
    expect(rows.map((s) => s.icao)).toEqual(['LTAC', 'LTAI', 'LTBJ', 'LTFJ', 'LTFM'])
    expect(rows.filter((s) => s.isPrimary).map((s) => s.iata)).toEqual(['IST'])
    expect(rows.find((s) => s.icao === 'LTFJ')?.fetchRadiusNm).toBe(80)
    expect(rows.find((s) => s.icao === 'LTFM')?.geoidUndulationM).toBeCloseTo(37.05, 2)
  })
})

const airport = (id: number, ident: string, hash = `h${id}`): AirportInsert => ({
  id,
  ident,
  type: 'large_airport',
  name: `Havalimanı ${ident}`,
  latitudeDeg: 41 + id / 100,
  longitudeDeg: 29,
  elevationFt: 100,
  isoCountry: 'TR',
  isoRegion: 'TR-34',
  municipality: null,
  scheduledService: true,
  icaoCode: ident,
  iataCode: null,
  gpsCode: ident,
  rowHash: hash,
})

const runway = (id: number, airportId: number, ident: string, hash = `r${id}`): RunwayInsert => ({
  id,
  airportId,
  airportIdent: ident,
  lengthFt: 10_000,
  widthFt: 150,
  surface: 'ASP',
  lighted: true,
  endsAreThresholds: false,
  leIdent: '09',
  leThresholdLat: 41,
  leThresholdLon: 29,
  leThresholdSource: 'runway_end',
  heIdent: '27',
  heThresholdLat: 41,
  heThresholdLon: 29.03,
  heThresholdSource: 'runway_end',
  rowHash: hash,
})

describe('referans verisinin yazılması', () => {
  const base = {
    airports: [airport(1, 'LTAA'), airport(2, 'LTBB'), airport(3, 'LTCC')],
    runways: [runway(10, 1, 'LTAA'), runway(20, 2, 'LTBB'), runway(30, 3, 'LTCC')],
  }

  it('ilk içe aktarım ekler; aynı veri ikinci kez hiçbir satırı yazmaz', async () => {
    const first = await syncOurAirports(db, base)
    expect(first.airports).toEqual({ inserted: 3, updated: 0, unchanged: 0, deleted: 0 })
    expect(first.runways).toEqual({ inserted: 3, updated: 0, unchanged: 0, deleted: 0 })
    const [before] = await db.select().from(airports).where(eq(airports.id, 1))

    const second = await syncOurAirports(db, base)
    expect(second.airports).toEqual({ inserted: 0, updated: 0, unchanged: 3, deleted: 0 })
    expect(second.runways).toEqual({ inserted: 0, updated: 0, unchanged: 3, deleted: 0 })
    const [after] = await db.select().from(airports).where(eq(airports.id, 1))
    expect(after?.updatedAt.getTime()).toBe(before?.updatedAt.getTime())
  })

  it('değişen satır güncellenir, kaynaktan kalkan havalimanı pistiyle silinir', async () => {
    const changed = { ...airport(2, 'LTBB', 'h2-yeni'), name: 'Yeni ad' }
    const result = await syncOurAirports(db, {
      airports: [airport(1, 'LTAA'), changed, airport(3, 'LTCC'), airport(4, 'LTDD')],
      runways: [runway(10, 1, 'LTAA'), runway(20, 2, 'LTBB'), runway(40, 4, 'LTDD')],
    })
    expect(result.airports).toEqual({ inserted: 1, updated: 1, unchanged: 2, deleted: 0 })
    expect(result.runways).toEqual({ inserted: 1, updated: 0, unchanged: 2, deleted: 1 })
    const [ltbb] = await db.select().from(airports).where(eq(airports.id, 2))
    expect(ltbb?.name).toBe('Yeni ad')

    const removed = await syncOurAirports(db, {
      airports: [airport(1, 'LTAA'), changed, airport(4, 'LTDD')],
      runways: [runway(10, 1, 'LTAA'), runway(20, 2, 'LTBB'), runway(40, 4, 'LTDD')],
    })
    expect(removed.airports.deleted).toBe(1)
    expect((await db.select().from(airports)).map((a) => a.id).sort()).toEqual([1, 2, 4])
  })

  it('bir kod başka kayda geçince (ve iki kod takas edilince) içe aktarım takılmaz', async () => {
    // LTAA (id 1) kaynaktan kalkar, kodunu yeni kayıt (id 5) alır; id 2 ile id 4 kodlarını takas eder.
    const result = await syncOurAirports(db, {
      airports: [
        airport(2, 'LTDD', 'h2-takas'),
        airport(4, 'LTBB', 'h4-takas'),
        airport(5, 'LTAA'),
      ],
      runways: [runway(20, 2, 'LTDD'), runway(40, 4, 'LTBB'), runway(50, 5, 'LTAA')],
    })
    expect(result.airports).toEqual({ inserted: 1, updated: 2, unchanged: 0, deleted: 1 })
    const rows = await db.select().from(airports).orderBy(airports.id)
    expect(rows.map((a) => [a.id, a.ident])).toEqual([
      [2, 'LTDD'],
      [4, 'LTBB'],
      [5, 'LTAA'],
    ])
  })

  it('yarım ya da boş kaynak reddedilir ve hiçbir şey yazılmaz', async () => {
    await expect(
      syncOurAirports(db, { airports: [airport(1, 'LTAA')], runways: [runway(10, 1, 'LTAA')] }),
    ).rejects.toBeInstanceOf(ReferenceGuardError)
    await expect(syncOurAirports(db, { airports: [], runways: [] })).rejects.toBeInstanceOf(
      ReferenceGuardError,
    )
    expect(await db.select().from(airports)).toHaveLength(3)
    expect(await db.select().from(runways)).toHaveLength(3)
  })

  it('havayolları: yöneticinin düzeltmeleri içe aktarımdan etkilenmez', async () => {
    const airline = (code: string, name: string): AirlineInsert => ({
      code,
      name,
      icao: code,
      iata: null,
      positioningFlightPattern: null,
      charterFlightPattern: null,
      rowHash: `${code}:${name}`,
    })
    await db.insert(airlineOverrides).values({ code: 'TKJ', name: 'AJet (düzeltme)' })
    expect(
      await syncAirlines(db, [airline('THY', 'Turkish Airlines'), airline('TKJ', 'AJet')]),
    ).toEqual({ inserted: 2, updated: 0, unchanged: 0, deleted: 0 })
    expect(
      await syncAirlines(db, [airline('THY', 'Turkish Airlines'), airline('TKJ', 'AJet')]),
    ).toEqual({ inserted: 0, updated: 0, unchanged: 2, deleted: 0 })
    const [override] = await db.select().from(airlineOverrides)
    expect(override?.name).toBe('AJet (düzeltme)')
  })

  it('kaynak durumu: hata kaydedilir, sonraki başarılı kontrol hatayı temizler', async () => {
    const now = new Date('2026-01-28T04:40:00Z')
    await recordReferenceCheck(db, 'vrs-airlines', {
      origin: 'remote',
      now,
      etag: '"a"',
      lastModified: null,
      imported: { rowCount: 2, skippedCount: 0 },
    })
    await recordReferenceError(db, 'vrs-airlines', {
      origin: 'remote',
      now: new Date('2026-01-29T04:40:00Z'),
      error: 'HTTP 503',
    })
    let status = await referenceStatus(db)
    expect(status).toMatchObject({ airports: 3, runways: 3, airlines: 2 })
    expect(status.sources[0]).toMatchObject({ lastError: 'HTTP 503', rowCount: 2, etag: '"a"' })

    await recordReferenceCheck(db, 'vrs-airlines', {
      origin: 'remote',
      now: new Date('2026-01-30T04:40:00Z'),
      etag: '"a"',
      lastModified: null,
      imported: null,
    })
    status = await referenceStatus(db)
    expect(status.sources[0]).toMatchObject({ lastError: null, rowCount: 2 })
    expect(status.sources[0]?.importedAt?.toISOString()).toBe(now.toISOString())
  })

  it("0005 veri migration'ı OurAirports doğrulayıcılarını sıfırlar (D-080); VRS'e dokunmaz, tekrarı zararsız", async () => {
    const now = new Date('2026-10-02T04:40:00Z')
    for (const source of ['ourairports-airports', 'ourairports-runways', 'vrs-airlines'] as const) {
      await recordReferenceCheck(db, source, {
        origin: 'remote',
        now,
        etag: `"${source}"`,
        lastModified: 'Thu, 01 Oct 2026 23:03:49 GMT',
        imported: { rowCount: 3, skippedCount: 0 },
      })
    }
    const migration = readFileSync(
      fileURLToPath(new URL('../drizzle/0005_ourairports_reimport.sql', import.meta.url)),
      'utf8',
    )
    // Migration iki kez çalışsa da sonuç aynıdır.
    await sql.unsafe(migration)
    await sql.unsafe(migration)
    const { sources } = await referenceStatus(db)
    const bySource = new Map(sources.map((s) => [s.source, s]))
    for (const source of ['ourairports-airports', 'ourairports-runways']) {
      // Worker koşulsuz indirir (`importedAt` yok) ve açılışta telafi ister (`checkedAt` yok).
      expect(bySource.get(source), source).toMatchObject({
        etag: null,
        lastModified: null,
        importedAt: null,
        checkedAt: null,
        rowCount: 3,
      })
    }
    expect(bySource.get('vrs-airlines')).toMatchObject({
      etag: '"vrs-airlines"',
      importedAt: now,
      checkedAt: now,
    })
  })
})
