import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { greatCircleKm } from './airports'
import {
  arrivalCandidateQuery,
  arrivalCoverageSampleBatches,
  arrivalSampleQuery,
  findArrivalCandidateFlights,
  readArrivalCoverageFlights,
  readArrivalCoverageSampleBatch,
  readArrivalCoverageStations,
  readArrivalCoverageWindowStats,
  readMetarQnhSeries,
  readMetarQnhStats,
  readNearbyAirfields,
  readOnlyTransaction,
  readProviderWindowStats,
  type ArrivalCandidateParams,
  type ArrivalCandidateStation,
} from './arrival-coverage'
import {
  ARRIVAL_COVERAGE_REPORTS_KEEP,
  claimNextArrivalCoverageReport,
  failArrivalCoverageReport,
  finishArrivalCoverageReport,
  getArrivalCoverageReport,
  insertQueuedArrivalCoverageReport,
  listArrivalCoverageReports,
  pruneArrivalCoverageReports,
  readStationArrivalCoverage7d,
  writeStationArrivalCoverage7d,
} from './arrival-coverage-reports'
import { createDb, type Database } from './client'
import { createFlight, insertTrackPoints, type TrackPointRow } from './ingest'
import { runMigrations } from './migrate'
import { ensureTrackPartitions } from './partitions'
import { seedStations } from './seed'
import { pointAtMostKm } from './test/geodesy'

const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_db_arrival_coverage'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))

const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined })
// Worker'daki gibi `createDb` istemcisi; denetim ve hazırlık sorguları düz istemciyle (`check`).
let database: Database
let sql: postgres.Sql
let check: postgres.Sql

const at = (iso: string) => new Date(iso)
const MIN = 60_000

/**
 * `@havayolu/shared` `ARRIVAL_CANDIDATE_RULE` (bu paket shared'a bağımlı değildir; worker'ın
 * `arrival-coverage` testleri iki değeri birbirine bağlar). Geometrik hız duyarlılığı açık.
 */
const RULE: ArrivalCandidateParams = {
  boxKm: 15.5,
  maxAboveFieldFt: 3000,
  baroRateBelowFpm: -300,
  includeGeomOnly: true,
}

const LTFM = { lat: 41.274874, lon: 28.732136 }
const LTFJ = { lat: 40.898602, lon: 29.3092 }
const LTAI = { lat: 36.898701, lon: 30.800501 }
const CANDIDATE_STATIONS: ArrivalCandidateStation[] = [
  { icao: 'LTFM', ...LTFM, elevationFt: 325 },
  { icao: 'LTFJ', ...LTFJ, elevationFt: 312 },
  { icao: 'LTAI', ...LTAI, elevationFt: 177 },
]

/** Pencere: iş 2026-10-06T12:00Z, 24 sa, kapanma payı 45 dk. */
const WINDOW_START = at('2026-10-05T11:15:00Z')
const WINDOW_END = at('2026-10-06T11:15:00Z')
const t = (minutes: number) => new Date(Date.parse('2026-10-05T12:00:00Z') + minutes * MIN)

const ids: Record<string, number> = {}
const id = (name: string) => {
  const value = ids[name]
  if (value === undefined) throw new Error(`no flight ${name}`)
  return value
}

function row(
  flightId: number,
  ts: Date,
  p: { lat: number; lon: number },
  overrides: Partial<TrackPointRow> = {},
): TrackPointRow {
  return {
    flightId,
    ts,
    lat: p.lat,
    lon: p.lon,
    altBaroFt: 2000,
    altGeomFt: null,
    gsKt: 150,
    trackDeg: 180,
    verticalRateFpm: -800,
    onGround: false,
    source: 0,
    seenPosS: 0.4,
    baroRateFpm: -800,
    ...overrides,
  }
}

async function flight(name: string, first: Date, last: Date = first): Promise<number> {
  const value = await createFlight(sql, {
    hex: `e2e${String(Object.keys(ids).length).padStart(3, '0')}`,
    callsign: null,
    registration: null,
    typeCode: null,
    firstSeenAt: first,
    lastSeenAt: last,
  })
  ids[name] = value
  return value
}

const airport = (
  id: number,
  ident: string,
  type: string,
  p: { lat: number; lon: number },
  elevation: number | null,
) =>
  check`insert into airports (id, ident, type, name, latitude_deg, longitude_deg, elevation_ft,
      iso_country, iso_region, scheduled_service, row_hash)
    values (${id}, ${ident}, ${type}, ${ident}, ${p.lat}, ${p.lon}, ${elevation}, 'TR', 'TR-34',
      true, ${`h${id}`})`

const runway = (
  id: number,
  airportId: number,
  ident: string,
  ends: {
    le: { ident: string; lat: number; lon: number; source: string; elevation: number | null }
    he: { ident: string | null; lat: number; lon: number; source: string; elevation: number | null }
  },
  size: { lengthFt: number | null; widthFt: number | null } = { lengthFt: 12_000, widthFt: 150 },
) =>
  check`insert into runways (id, airport_id, airport_ident, length_ft, width_ft, lighted,
      le_ident, le_elevation_ft, le_threshold_lat, le_threshold_lon, le_threshold_source,
      he_ident, he_elevation_ft, he_threshold_lat, he_threshold_lon, he_threshold_source, row_hash)
    values (${id}, ${airportId}, ${ident}, ${size.lengthFt}, ${size.widthFt}, true,
      ${ends.le.ident}, ${ends.le.elevation}, ${ends.le.lat}, ${ends.le.lon}, ${ends.le.source},
      ${ends.he.ident}, ${ends.he.elevation}, ${ends.he.lat}, ${ends.he.lon}, ${ends.he.source},
      ${`r${id}`})`

/** EXPLAIN (JSON) planındaki tablo adları ve dizin adları. */
async function plan(query: { text: string; values: unknown[] }) {
  const [result] = await check.unsafe<{ 'QUERY PLAN': unknown }[]>(
    `explain (format json) ${query.text}`,
    query.values as never[],
  )
  const relations = new Set<string>()
  const indexes = new Set<string>()
  const nodeTypes = new Set<string>()
  const walk = (node: unknown) => {
    if (node === null || typeof node !== 'object') return
    const n = node as Record<string, unknown>
    if (typeof n['Relation Name'] === 'string') relations.add(n['Relation Name'])
    if (typeof n['Index Name'] === 'string') indexes.add(n['Index Name'])
    if (typeof n['Node Type'] === 'string') nodeTypes.add(n['Node Type'])
    for (const value of Object.values(n)) {
      if (Array.isArray(value)) value.forEach(walk)
      else if (typeof value === 'object') walk(value)
    }
  }
  walk(result?.['QUERY PLAN'])
  return { relations, indexes, nodeTypes }
}

beforeAll(async () => {
  await admin.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.unsafe(`create database ${testDbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder })
  database = createDb(testUrl, { max: 4 })
  sql = database.sql
  check = postgres(testUrl, { max: 3, onnotice: () => undefined })

  await seedStations(database.db)
  // LTAC'nin havalimanı satırı yok (atlanır); LTBJ etkin değil.
  await check`update stations set is_active = false where icao = 'LTBJ'`
  await airport(317457, 'LTFM', 'large_airport', LTFM, 325)
  await airport(4569, 'LTFJ', 'large_airport', LTFJ, 312)
  await airport(4515, 'LTAI', 'large_airport', LTAI, 177)
  await airport(4533, 'LTBJ', 'large_airport', { lat: 38.2924, lon: 27.157 }, 412)
  // Yakın alanlar: Samandıra (SAW'a ~13 km), Atatürk (IST'e ~34 km, dışarıda), heliport (sayılmaz).
  await airport(4546, 'LTBX', 'medium_airport', { lat: 40.993, lon: 29.216499 }, 400)
  await airport(4528, 'LTBA', 'large_airport', { lat: 40.971913, lon: 28.823714 }, 163)
  await airport(900001, 'TR-H01', 'heliport', { lat: 40.91, lon: 29.3 }, 300)

  const n = (km: number) => pointAtMostKm(LTFM, 0, km)
  const s = (km: number) => pointAtMostKm(LTFM, 180, km)
  await runway(1, 317457, 'LTFM', {
    le: { ident: '35', ...s(2), source: 'runway_end', elevation: 330 },
    he: { ident: '17', ...n(2), source: 'displaced_threshold', elevation: 300 },
  })
  // Tek uçlu satır (helikopter alanı): gizli.
  await runway(2, 317457, 'LTFM', {
    le: { ident: 'H1', ...LTFM, source: 'arp_fallback', elevation: null },
    he: { ident: null, ...LTFM, source: 'arp_fallback', elevation: null },
  })
  await runway(3, 317457, 'LTFM', {
    le: { ident: '34L', ...s(3), source: 'runway_end', elevation: 320 },
    he: { ident: '16R', ...n(3), source: 'runway_end', elevation: 310 },
  })
  await check`insert into runway_overrides (runway_id, le_threshold_lat, le_threshold_lon)
    values (3, ${s(2.8).lat}, ${s(2.8).lon})`
  await runway(4, 4515, 'LTAI', {
    le: { ident: '18', ...LTAI, source: 'arp_fallback', elevation: null },
    he: { ident: '36', ...LTAI, source: 'arp_fallback', elevation: null },
  })

  await ensureTrackPartitions(sql, at('2026-10-05T12:00:00Z'))

  const rows: TrackPointRow[] = []
  // A: 15,000 km'de (haversine), alan + 3.000 ft'te, baro −301: sekiz yönde ayrı kayıtlar.
  for (let i = 0; i < 8; i += 1) {
    const fid = await flight(`b${i}`, t(i))
    rows.push(
      row(fid, t(i), pointAtMostKm(LTFM, i * 45, 15), {
        altBaroFt: 325 + 3000,
        baroRateFpm: -301,
        verticalRateFpm: -301,
      }),
    )
  }
  const five = pointAtMostKm(LTFM, 90, 5)
  // Dışarıda kalanlar.
  rows.push(row(await flight('n1', t(10)), t(10), pointAtMostKm(LTFM, 0, 16)))
  rows.push(row(await flight('n2', t(11)), t(11), five, { altBaroFt: 3326 }))
  rows.push(
    row(await flight('n3', t(12)), t(12), five, { baroRateFpm: -300, verticalRateFpm: -300 }),
  )
  rows.push(
    row(await flight('n4', t(13)), t(13), pointAtMostKm(LTFM, 0, 1), {
      onGround: true,
      altBaroFt: null,
      baroRateFpm: null,
      verticalRateFpm: null,
    }),
  )
  // Yalnızca geometrik hız (baro boş, seen_pos boş): geomOnly açıkken aday.
  rows.push(
    row(await flight('g1', t(14)), t(14), five, {
      baroRateFpm: null,
      verticalRateFpm: -1500,
      seenPosS: null,
    }),
  )
  rows.push(row(await flight('n6', at('2026-10-05T11:00:00Z')), at('2026-10-05T11:00:00Z'), five))
  // İkinci gün dilimi.
  rows.push(row(await flight('d2', at('2026-10-06T05:00:00Z')), at('2026-10-06T05:00:00Z'), five))
  rows.push(row(await flight('n8', t(15)), t(15), five, { altBaroFt: null }))
  // LTAI'de varış (yedek eşik ve geoid yedek tablosu istasyonu).
  rows.push(
    row(await flight('a1', t(20), t(30)), t(20), pointAtMostKm(LTAI, 200, 5), {
      altBaroFt: 177 + 1500,
      baroRateFpm: -900,
      verticalRateFpm: -900,
      seenPosS: -0.3,
    }),
    row(id('a1'), t(25), pointAtMostKm(LTAI, 200, 1), {
      onGround: true,
      altBaroFt: null,
      baroRateFpm: null,
      verticalRateFpm: null,
      seenPosS: 1.2,
    }),
  )
  await insertTrackPoints(sql, 'track_points_fine', rows)
  // Yalnızca örneklenmiş tabloda satırı olan kayıt (ince örneği yok).
  await flight('empty', t(40))

  // EXPLAIN için hacim: istasyonlardan uzakta 300 kayıt × 100 örnek (10-05).
  const bulk: TrackPointRow[] = []
  for (let f = 0; f < 300; f += 1) {
    for (let k = 0; k < 100; k += 1) {
      bulk.push(
        row(1_000_000 + f, new Date(Date.parse('2026-10-05T13:00:00Z') + f * 1000 + k * 30_000), {
          lat: 30 + f / 1000,
          lon: 10,
        }),
      )
    }
  }
  await insertTrackPoints(sql, 'track_points_fine', bulk)
  await check`analyze track_points_fine`
})

afterAll(async () => {
  await Promise.allSettled([sql?.end({ timeout: 5 }), check?.end({ timeout: 5 })])
  await admin.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.end({ timeout: 5 })
})

describe('0007 şeması', () => {
  it('istasyonların 7 günlük sütunları ve rapor tablosunun kısıtları', async () => {
    const columns = await check<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_name = 'stations' and column_name like 'coverage_%'
      order by column_name`
    expect(columns.map((c) => c.column_name)).toEqual([
      'coverage_arrivals_7d',
      'coverage_ground_ratio_7d',
      'coverage_updated_at',
    ])
    await expect(
      check`insert into arrival_coverage_reports (status, hours, requested_at) values ('x', 24, now())`,
    ).rejects.toMatchObject({ code: '23514' })
    await expect(
      check`insert into arrival_coverage_reports (status, hours, requested_at) values ('done', 169, now())`,
    ).rejects.toMatchObject({ code: '23514' })
    // Tekil kısmi dizin: aynı anda iki etkin satır olamaz.
    await check`insert into arrival_coverage_reports (status, hours, requested_at) values ('queued', 24, now())`
    await expect(
      check`insert into arrival_coverage_reports (status, hours, requested_at) values ('running', 24, now())`,
    ).rejects.toMatchObject({ code: '23505' })
    await check`insert into arrival_coverage_reports (status, hours, requested_at) values ('done', 24, now())`
    const [{ n } = { n: -1 }] = await check<{ n: number }[]>`
      select count(*)::int as n from arrival_coverage_reports`
    expect(n).toBe(2)
    await check`delete from arrival_coverage_reports`
  })
})

describe('salt okunur işlem', () => {
  it('ayarlar yalnızca işlem içinde geçerli; yazma 25006 ile reddedilir', async () => {
    const settings = await readOnlyTransaction(sql, async (tx) => {
      const [r] = await tx<{ st: string; lt: string; ro: string }[]>`
        select current_setting('statement_timeout') as st, current_setting('lock_timeout') as lt,
          current_setting('transaction_read_only') as ro`
      return r
    })
    expect(settings).toEqual({ st: '1min', lt: '2s', ro: 'on' })
    await expect(
      readOnlyTransaction(sql, (tx) => tx`update stations set iata = iata`),
    ).rejects.toMatchObject({ code: '25006' })
    const [after] = await sql<{ st: string }[]>`select current_setting('statement_timeout') as st`
    expect(after?.st).toBe('0')
  })

  it('statement_timeout etkin: 57014 üç denemeden sonra fırlatılır', async () => {
    const retries: string[] = []
    await expect(
      readOnlyTransaction(sql, (tx) => tx`select pg_sleep(1)`, {
        statementTimeoutMs: 50,
        sleep: async () => undefined,
        onRetry: ({ code }) => retries.push(code),
      }),
    ).rejects.toMatchObject({ code: '57014' })
    expect(retries).toEqual(['57014', '57014'])
  })

  it('lock_timeout 55P03 yeniden denenir; kilit bırakılınca okuma başarılı olur', async () => {
    let release: () => void = () => undefined
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    let locked: () => void = () => undefined
    const isLocked = new Promise<void>((resolve) => {
      locked = resolve
    })
    const holder = check.begin(async (tx) => {
      await tx`lock table stations in access exclusive mode`
      locked()
      await released
    })
    await isLocked
    const retries: string[] = []
    const count = await readOnlyTransaction(
      sql,
      async (tx) => {
        const [r] = await tx<{ n: number }[]>`select count(*)::int as n from stations`
        return r?.n
      },
      {
        lockTimeoutMs: 100,
        onRetry: ({ code }) => retries.push(code),
        sleep: async () => {
          release()
          await holder
        },
      },
    )
    expect(retries).toEqual(['55P03'])
    expect(count).toBe(5)
  })
})

describe('istasyonlar ve yakın alanlar', () => {
  it('etkin ve havalimanı satırı olan istasyonlar; gizli pist yok, düzeltme uygulanır', async () => {
    const stations = await readArrivalCoverageStations(sql)
    expect(stations.map((s) => s.icao)).toEqual(['LTFM', 'LTAI', 'LTFJ'])
    const ltfm = stations[0]
    expect(ltfm).toMatchObject({
      iata: 'IST',
      isPrimary: true,
      airportId: 317457,
      elevationFt: 325,
      geoidUndulationM: 37.05,
    })
    expect(
      ltfm?.thresholds.map((th) => [th.runwayId, th.end, th.ident, th.source, th.elevationFt]),
    ).toEqual([
      [1, 'le', '35', 'runway_end', 330],
      [1, 'he', '17', 'displaced_threshold', 300],
      [3, 'le', '34L', 'override', 320],
      [3, 'he', '16R', 'runway_end', 310],
    ])
    const overridden = ltfm?.thresholds[2]
    expect(greatCircleKm(LTFM, overridden as { lat: number; lon: number })).toBeCloseTo(2.8, 6)
    const ltai = stations[1]
    expect(ltai?.geoidUndulationM).toBeNull()
    expect(ltai?.thresholds.map((th) => th.source)).toEqual(['arp_fallback', 'arp_fallback'])
    expect(stations[2]?.thresholds).toEqual([])
  })

  it('30 km içindeki diğer alanlar (askerî dahil, heliport ve istasyonun kendisi hariç)', async () => {
    const rows = await readNearbyAirfields(sql, {
      stations: [
        { icao: 'LTFM', ...LTFM },
        { icao: 'LTFJ', ...LTFJ },
      ],
      radiusKm: 30,
    })
    expect(rows.map((r) => [r.stationIcao, r.ident])).toEqual([['LTFJ', 'LTBX']])
    expect(rows[0]?.distanceKm).toBeGreaterThan(12)
    expect(rows[0]?.distanceKm).toBeLessThan(14)
    expect(greatCircleKm(LTFM, { lat: 40.971913, lon: 28.823714 })).toBeGreaterThan(30)
  })
})

describe('aday sorgusu', () => {
  it('sınıflandırıcının üst kümesi: 15,000 km ve alan + 3.000 ft sınırındaki örnekler dahil', async () => {
    const found = await findArrivalCandidateFlights(sql, {
      stations: CANDIDATE_STATIONS,
      rule: RULE,
      from: WINDOW_START,
      to: WINDOW_END,
    })
    const boundary = Array.from({ length: 8 }, (_, i) => id(`b${i}`))
    expect(found).toEqual([...boundary, id('g1'), id('d2'), id('a1')].sort((a, b) => a - b))
    for (const name of ['n1', 'n2', 'n3', 'n4', 'n6', 'n8', 'empty']) {
      expect(found).not.toContain(id(name))
    }
    const strict = await findArrivalCandidateFlights(sql, {
      stations: CANDIDATE_STATIONS,
      rule: { ...RULE, includeGeomOnly: false },
      from: WINDOW_START,
      to: WINDOW_END,
    })
    expect(strict).not.toContain(id('g1'))
    expect(strict).toHaveLength(found.length - 1)
  })

  it("EXPLAIN: gün dilimi yalnızca o günün partition'ına iner", async () => {
    const { relations } = await plan(
      arrivalCandidateQuery(CANDIDATE_STATIONS, RULE, WINDOW_START, at('2026-10-06T00:00:00Z')),
    )
    expect([...relations]).toEqual(['track_points_fine_p20261005'])
    const second = await plan(
      arrivalCandidateQuery(CANDIDATE_STATIONS, RULE, at('2026-10-06T00:00:00Z'), WINDOW_END),
    )
    expect([...second.relations]).toEqual(['track_points_fine_p20261006'])
  })
})

describe('kayıtlar ve örnekler', () => {
  it('uçuş kayıtları: ilk ve son görülme; bilinmeyen kimlik atlanır', async () => {
    const flights = await readArrivalCoverageFlights(sql, [id('a1'), id('b0'), 999_999_999])
    expect(flights).toEqual([
      { id: id('b0'), firstSeenAt: t(0).getTime(), lastSeenAt: t(0).getTime(), status: 'active' },
      { id: id('a1'), firstSeenAt: t(20).getTime(), lastSeenAt: t(30).getTime(), status: 'active' },
    ])
  })

  it('parti: kimlik sırasıyla, ts artan; ham seen_pos ve baro_rate; örneği olmayan kayıt boş', async () => {
    const flights = await readArrivalCoverageFlights(sql, [id('a1'), id('g1'), id('empty')])
    const batch = await readArrivalCoverageSampleBatch(sql, {
      flights,
      lookbackStart: new Date(WINDOW_START.getTime() - 24 * 60 * MIN),
      to: at('2026-10-06T12:00:00Z'),
    })
    expect(batch.map((b) => [b.flightId, b.samples.length])).toEqual([
      [id('g1'), 1],
      [id('a1'), 2],
      [id('empty'), 0],
    ])
    const a1 = batch[1]
    expect(a1?.lastSeenTs).toBe(t(30).getTime())
    expect(a1?.samples[0]).toMatchObject({
      ts: t(20).getTime(),
      altBaroFt: 1677,
      baroRateFpm: -900,
      verticalRateFpm: -900,
      onGround: false,
      source: 0,
    })
    expect(a1?.samples[0]?.seenPosS).toBeCloseTo(-0.3, 5)
    expect(a1?.samples[1]).toMatchObject({ onGround: true, altBaroFt: null, baroRateFpm: null })
    expect(batch[0]?.samples[0]).toMatchObject({
      baroRateFpm: null,
      verticalRateFpm: -1500,
      seenPosS: null,
    })
  })

  it('parti en çok 200 kayıt; üreteç partileri sırayla verir', async () => {
    const many = Array.from({ length: 201 }, (_, i) => ({
      id: i + 1,
      firstSeenAt: t(0).getTime(),
      lastSeenAt: t(0).getTime(),
    }))
    await expect(
      readArrivalCoverageSampleBatch(sql, { flights: many, lookbackStart: t(0), to: t(60) }),
    ).rejects.toThrow(RangeError)
    const bulk = Array.from({ length: 250 }, (_, i) => ({
      id: 1_000_000 + i,
      firstSeenAt: Date.parse('2026-10-05T13:00:00Z') + i * 1000,
      lastSeenAt: Date.parse('2026-10-05T13:00:00Z') + i * 1000 + 99 * 30_000,
    }))
    const sizes: number[] = []
    let samples = 0
    for await (const part of arrivalCoverageSampleBatches(sql, {
      flights: bulk,
      lookbackStart: WINDOW_START,
      to: WINDOW_END,
    })) {
      sizes.push(part.length)
      samples += part.reduce((total, f) => total + f.samples.length, 0)
    }
    expect(sizes).toEqual([200, 50])
    expect(samples).toBe(25_000)
  })

  it("EXPLAIN: örnek partisi yalnızca kayıtların günündeki partition'ın birincil anahtar dizinini kullanır", async () => {
    const query = arrivalSampleQuery({
      flights: [0, 1, 2].map((i) => ({
        id: 1_000_000 + i,
        firstSeenAt: Date.parse('2026-10-05T13:00:00Z') + i * 1000,
        lastSeenAt: Date.parse('2026-10-05T13:00:00Z') + i * 1000 + 99 * 30_000,
      })),
      lookbackStart: new Date(WINDOW_START.getTime() - 24 * 60 * MIN),
      to: at('2026-10-06T12:00:00Z'),
    })
    const { relations, indexes } = await plan(query)
    expect([...relations]).toEqual(['track_points_fine_p20261005'])
    expect([...indexes]).toEqual(['track_points_fine_p20261005_pkey'])
  })
})

describe('etkin pencere istatistikleri', () => {
  it('istasyon bölgesindeki havadaki örnekler, boş sayıları ve ilk dolu baro_rate (iki gün toplanır)', async () => {
    const stats = await readArrivalCoverageWindowStats(sql, {
      stations: [
        { icao: 'LTFM', ...LTFM },
        { icao: 'LTAI', ...LTAI },
        { icao: 'LTFJ', ...LTFJ },
      ],
      zoneKm: 30,
      from: WINDOW_START,
      to: WINDOW_END,
    })
    expect(stats).toEqual([
      {
        icao: 'LTFM',
        airborneSamples: 14,
        baroRateNull: 1,
        seenPosNull: 1,
        firstBaroRateTs: t(0).getTime(),
      },
      {
        icao: 'LTAI',
        airborneSamples: 1,
        baroRateNull: 0,
        seenPosNull: 0,
        firstBaroRateTs: t(20).getTime(),
      },
      { icao: 'LTFJ', airborneSamples: 0, baroRateNull: 0, seenPosNull: 0, firstBaroRateTs: null },
    ])
  })
})

describe('sağlayıcı penceresi', () => {
  it('satırı olmayan saatler, sayaçlar ve durum dilimleri', async () => {
    const hourly = (hour: string, requests: number, successes: number, rateLimited: number) =>
      check`insert into provider_health_hourly (provider, hour, requests, successes, rate_limited,
          server_errors, network_errors, other_errors, freshness_p95_max_s)
        values ('adsbLol', ${hour}::timestamptz, ${requests}, ${successes}, ${rateLimited}, 1, 0, 0, 9.5)`
    await hourly('2026-10-05T12:00:00Z', 360, 350, 9)
    await hourly('2026-10-05T14:00:00Z', 40, 0, 40)
    const change = (iso: string, from: string | null, to: string) =>
      check`insert into provider_status_changes (provider, at, from_status, to_status)
        values ('adsbLol', ${iso}::timestamptz, ${from}, ${to})`
    await change('2026-10-05T10:00:00Z', null, 'ok')
    await change('2026-10-05T12:30:00Z', 'ok', 'degraded')
    await change('2026-10-05T13:00:00Z', 'degraded', 'ok')
    await change('2026-10-05T16:00:00Z', 'ok', 'down')

    const from = at('2026-10-05T11:15:00Z')
    const to = at('2026-10-05T15:30:00Z')
    const stats = await readProviderWindowStats(sql, { provider: 'adsbLol', from, to })
    expect(
      stats.hours.map((h) => [new Date(h.hour).toISOString().slice(11, 16), h.present, h.requests]),
    ).toEqual([
      ['11:00', false, 0],
      ['12:00', true, 360],
      ['13:00', false, 0],
      ['14:00', true, 40],
      ['15:00', false, 0],
    ])
    expect(stats.hours[1]).toMatchObject({
      successes: 350,
      rateLimited: 9,
      serverErrors: 1,
      freshnessP95MaxS: 9.5,
    })
    expect(stats.spans).toEqual([
      { status: 'ok', from: from.getTime(), to: Date.parse('2026-10-05T12:30:00Z') },
      {
        status: 'degraded',
        from: Date.parse('2026-10-05T12:30:00Z'),
        to: Date.parse('2026-10-05T13:00:00Z'),
      },
      { status: 'ok', from: Date.parse('2026-10-05T13:00:00Z'), to: to.getTime() },
    ])
    // Durum dilimleri pencere sonundan sonra da okunabilir (varıştan sonraki 10 dk); saatler aynı.
    const statusUntil = at('2026-10-05T16:10:00Z')
    const extended = await readProviderWindowStats(sql, {
      provider: 'adsbLol',
      from,
      to,
      statusUntil,
    })
    expect(extended.hours).toEqual(stats.hours)
    expect(extended.spans.slice(-2)).toEqual([
      {
        status: 'ok',
        from: Date.parse('2026-10-05T13:00:00Z'),
        to: Date.parse('2026-10-05T16:00:00Z'),
      },
      { status: 'down', from: Date.parse('2026-10-05T16:00:00Z'), to: statusUntil.getTime() },
    ])
    const other = await readProviderWindowStats(sql, { provider: 'localReceiver', from, to })
    expect(other.hours.every((h) => !h.present)).toBe(true)
    expect(other.spans).toEqual([{ status: 'unknown', from: from.getTime(), to: to.getTime() }])
  })
})

describe('METAR QNH', () => {
  it("seri ve pencere uç değerleri (QNH'siz gözlem atlanır)", async () => {
    const metar = (icao: string, type: string, iso: string, qnh: number | null) =>
      check`insert into weather_metar (station_icao, report_type, observed_at, raw_text, qnh_hpa, fetched_at)
        values (${icao}, ${type}, ${iso}::timestamptz, ${`${icao} ${iso}`}, ${qnh}, now())`
    await metar('LTFM', 'METAR', '2026-10-05T11:00:00Z', 1015)
    await metar('LTFM', 'METAR', '2026-10-05T12:00:00Z', 1020)
    await metar('LTFM', 'SPECI', '2026-10-05T12:30:00Z', 1019)
    await metar('LTFM', 'METAR', '2026-10-05T13:00:00Z', null)
    await metar('LTAI', 'METAR', '2026-10-05T12:00:00Z', 1008)
    await metar('LTFM', 'METAR', '2026-10-06T12:00:00Z', 1001)
    const series = await readMetarQnhSeries(sql, {
      icaos: ['LTFM', 'LTAI'],
      from: new Date(WINDOW_START.getTime() - 90 * MIN),
      to: WINDOW_END,
    })
    expect(series.map((q) => [q.icao, new Date(q.observedAt).toISOString(), q.qnhHpa])).toEqual([
      ['LTAI', '2026-10-05T12:00:00.000Z', 1008],
      ['LTFM', '2026-10-05T11:00:00.000Z', 1015],
      ['LTFM', '2026-10-05T12:00:00.000Z', 1020],
      ['LTFM', '2026-10-05T12:30:00.000Z', 1019],
    ])
    expect(
      await readMetarQnhStats(sql, {
        icaos: ['LTFM', 'LTAI', 'LTFJ'],
        from: WINDOW_START,
        to: WINDOW_END,
      }),
    ).toEqual([
      { icao: 'LTAI', observations: 1, minHpa: 1008, maxHpa: 1008 },
      { icao: 'LTFM', observations: 2, minHpa: 1019, maxHpa: 1020 },
    ])
  })
})

describe('rapor satırları', () => {
  const now = at('2026-10-06T12:00:00Z')
  const later = (minutes: number) => new Date(now.getTime() + minutes * MIN)

  it('yaşam döngüsü: kuyruk, çakışma, üstlenme, bitiş, ayrıntı', async () => {
    await check`delete from arrival_coverage_reports`
    const first = await insertQueuedArrivalCoverageReport(sql, { hours: 24, now })
    expect(first.queued).toBe(true)
    const reportId = first.queued ? first.id : -1
    expect(await insertQueuedArrivalCoverageReport(sql, { hours: 6, now: later(1) })).toEqual({
      queued: false,
      activeId: reportId,
    })
    let list = await listArrivalCoverageReports(sql, { now: later(1) })
    expect(list.activeId).toBe(reportId)
    expect(list.reports[0]).toMatchObject({
      id: reportId,
      status: 'queued',
      hours: 24,
      startedAt: null,
    })

    const claimed = await claimNextArrivalCoverageReport(sql, {
      now: later(2),
      settleMs: 45 * MIN,
      definitionVersion: 1,
    })
    expect(claimed).toEqual({
      id: reportId,
      hours: 24,
      requestedAt: now,
      startedAt: later(2),
      windowStart: at('2026-10-05T11:17:00Z'),
      windowEnd: at('2026-10-06T11:17:00Z'),
      definitionVersion: 1,
    })
    expect(
      await claimNextArrivalCoverageReport(sql, {
        now: later(3),
        settleMs: 45 * MIN,
        definitionVersion: 1,
      }),
    ).toBeNull()
    list = await listArrivalCoverageReports(sql, { now: later(3) })
    expect(list.reports[0]?.status).toBe('running')
    expect(list.activeId).toBe(reportId)

    const result = { definitionVersion: 1, stations: [{ icao: 'LTFM', arrivals: 3 }] }
    expect(
      await finishArrivalCoverageReport(sql, {
        id: reportId,
        now: later(4),
        result,
        markdown: '# Kapsama raporu\n',
      }),
    ).toBe(true)
    expect(
      await finishArrivalCoverageReport(sql, {
        id: reportId,
        now: later(5),
        result,
        markdown: 'x',
      }),
    ).toBe(false)
    expect(
      await failArrivalCoverageReport(sql, { id: reportId, now: later(5), error: 'late' }),
    ).toBe(false)
    const detail = await getArrivalCoverageReport(sql, reportId, later(30))
    expect(detail).toMatchObject({
      id: reportId,
      status: 'done',
      storedStatus: 'done',
      finishedAt: later(4),
      error: null,
      definitionVersion: 1,
      result,
      markdown: '# Kapsama raporu\n',
    })
    expect(await getArrivalCoverageReport(sql, 999_999, now)).toBeNull()
    expect((await listArrivalCoverageReports(sql, { now: later(30) })).activeId).toBeNull()
  })

  it('hata yalnızca çalışan satıra yazılır, 500 karakterle sınırlı', async () => {
    await check`delete from arrival_coverage_reports`
    const inserted = await insertQueuedArrivalCoverageReport(sql, { hours: 12, now })
    const reportId = inserted.queued ? inserted.id : -1
    expect(
      await failArrivalCoverageReport(sql, { id: reportId, now: later(1), error: 'queued' }),
    ).toBe(false)
    await claimNextArrivalCoverageReport(sql, {
      now: later(1),
      settleMs: 45 * MIN,
      definitionVersion: 1,
    })
    expect(
      await failArrivalCoverageReport(sql, { id: reportId, now: later(2), error: 'e'.repeat(800) }),
    ).toBe(true)
    const detail = await getArrivalCoverageReport(sql, reportId, later(3))
    expect(detail?.status).toBe('failed')
    expect(detail?.error).toHaveLength(500)
    expect(detail?.result).toBeNull()
  })

  it('eskime: okuma etkin durumu gösterir; yeni istek ve üstlenme eskiyeni kapatır', async () => {
    await check`delete from arrival_coverage_reports`
    const stale = await insertQueuedArrivalCoverageReport(sql, { hours: 24, now })
    const staleId = stale.queued ? stale.id : -1
    const list = await listArrivalCoverageReports(sql, { now: later(16) })
    expect(list.activeId).toBeNull()
    // Bitiş zaman aşımı anıdır (istenme + 15 dk); okuma zamanıyla büyümez.
    expect(list.reports[0]).toMatchObject({
      status: 'failed',
      storedStatus: 'queued',
      error: 'timeout_queued',
      finishedAt: later(15),
    })
    expect(
      (await listArrivalCoverageReports(sql, { now: later(90) })).reports[0]?.finishedAt,
    ).toEqual(later(15))
    const next = await insertQueuedArrivalCoverageReport(sql, { hours: 48, now: later(16) })
    expect(next.queued).toBe(true)
    const nextId = next.queued ? next.id : -1
    // Kapatma da aynı anı yazar (kapatmanın anını değil).
    expect(await getArrivalCoverageReport(sql, staleId, later(16))).toMatchObject({
      storedStatus: 'failed',
      error: 'timeout_queued',
      finishedAt: later(15),
    })
    await claimNextArrivalCoverageReport(sql, {
      now: later(17),
      settleMs: 45 * MIN,
      definitionVersion: 1,
    })
    expect(await getArrivalCoverageReport(sql, nextId, later(38))).toMatchObject({
      status: 'failed',
      storedStatus: 'running',
      error: 'timeout_running',
      finishedAt: later(37),
    })
    expect(await getArrivalCoverageReport(sql, nextId, later(37))).toMatchObject({
      status: 'running',
      finishedAt: null,
    })
    // Üstlenme eskiyen çalışan satırı kapatır; kuyrukta satır yoksa null döner.
    expect(
      await claimNextArrivalCoverageReport(sql, {
        now: later(38),
        settleMs: 45 * MIN,
        definitionVersion: 1,
      }),
    ).toBeNull()
    expect(await getArrivalCoverageReport(sql, nextId, later(38))).toMatchObject({
      storedStatus: 'failed',
      error: 'timeout_running',
      finishedAt: later(37),
    })
    expect(
      await finishArrivalCoverageReport(sql, {
        id: nextId,
        now: later(39),
        result: {},
        markdown: 'x',
      }),
    ).toBe(false)
  })

  it('en yeni 50 satır tutulur; etkin satır silinmez', async () => {
    await check`delete from arrival_coverage_reports`
    await check`
      insert into arrival_coverage_reports (status, hours, requested_at)
      select 'done', 24, ${now.toISOString()}::timestamptz from generate_series(1, 55)`
    const queued = await insertQueuedArrivalCoverageReport(sql, { hours: 24, now })
    expect(queued.queued).toBe(true)
    const rows = await check<{ id: string; status: string }[]>`
      select id, status from arrival_coverage_reports order by id`
    expect(rows).toHaveLength(ARRIVAL_COVERAGE_REPORTS_KEEP)
    expect(rows.at(-1)?.status).toBe('queued')
    expect(await pruneArrivalCoverageReports(sql, 0)).toBe(ARRIVAL_COVERAGE_REPORTS_KEEP - 1)
    const left = await check<{ status: string }[]>`select status from arrival_coverage_reports`
    expect(left).toEqual([{ status: 'queued' }])
    const listed = await listArrivalCoverageReports(sql, { now, limit: 500 })
    expect(listed.reports).toHaveLength(1)
  })
})

describe('istasyonların 7 günlük kapsaması', () => {
  it('oran (varış yoksa boş), varış sayısı ve güncellenme zamanı', async () => {
    const now = at('2026-10-06T00:45:00Z')
    const updated = await writeStationArrivalCoverage7d(
      sql,
      [
        { icao: 'LTFM', arrivals: 3, groundSeen: 1 },
        { icao: 'LTAI', arrivals: 0, groundSeen: 0 },
        { icao: 'XXXX', arrivals: 5, groundSeen: 5 },
      ],
      now,
    )
    expect(updated).toBe(2)
    const rows = await readStationArrivalCoverage7d(sql)
    expect(rows.map((r) => r.icao)).toEqual(['LTFM', 'LTAC', 'LTAI', 'LTBJ', 'LTFJ'])
    expect(rows[0]).toMatchObject({ iata: 'IST', isPrimary: true, arrivals7d: 3, updatedAt: now })
    expect(rows[0]?.ratio7d).toBeCloseTo(1 / 3, 6)
    expect(rows[2]).toMatchObject({ icao: 'LTAI', ratio7d: null, arrivals7d: 0, updatedAt: now })
    expect(rows[4]).toMatchObject({
      icao: 'LTFJ',
      ratio7d: null,
      arrivals7d: null,
      updatedAt: null,
    })
    expect(rows[3]?.isActive).toBe(false)
  })
})
