import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type Database } from './client'
import { runMigrations } from './migrate'
import {
  getWeatherSource,
  listLatestWeather,
  listWeatherHistory,
  metarStationsSince,
  pruneWeather,
  recordWeatherCheck,
  recordWeatherDisabled,
  recordWeatherError,
  retainMetars,
  retainTafs,
  upsertMetars,
  upsertTafs,
  weatherStatus,
  type MetarWrite,
  type TafWrite,
} from './weather'

const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_db_weather'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))

const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined })
// Worker ve API'deki gibi `createDb` istemcisi (Drizzle zaman serileştiricilerini değiştirir);
// denetim sorguları düz istemciyle yapılır.
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

const at = (value: string) => new Date(value)
const NOW = at('2026-01-15T13:00:00Z')

const metar = (
  station: string,
  observed: string,
  raw: string,
  extra: Partial<MetarWrite> = {},
): MetarWrite => ({
  stationIcao: station,
  reportType: 'METAR',
  observedAt: at(observed),
  rawText: raw,
  qnhHpa: Number(/ Q(\d{4})/.exec(raw)?.[1] ?? Number.NaN),
  flightCategory: 'VFR',
  ...extra,
})

const taf = (station: string, issued: string, from: string, to: string, raw: string): TafWrite => ({
  stationIcao: station,
  issuedAt: at(issued),
  validFrom: at(from),
  validTo: at(to),
  rawText: raw,
})

describe('METAR/SPECI kaydı', () => {
  it('ekler; değişmeyen satırı yeniden yazmaz; düzeltilmiş rapor (COR) metnin yerine geçer', async () => {
    const rows = [
      metar('LTFM', '2026-01-15T12:20:00Z', 'LTFM 151220Z 03017G31KT 9999 -SHRA 09/05 Q1009'),
      metar('LTFM', '2026-01-15T12:50:00Z', 'LTFM 151250Z 03018G32KT 9999 -SHRA 09/05 Q1009'),
      metar('LTBS', '2026-01-15T12:42:00Z', 'LTBS 151242Z 25015G27KT 2000 +TSRAGR Q1007', {
        reportType: 'SPECI',
        flightCategory: 'IFR',
      }),
      metar('LTBS', '2026-01-15T12:42:00Z', 'LTBS 151242Z 25015G27KT 2000 +TSRAGR Q1007'),
    ]
    expect(await upsertMetars(sql, rows, NOW)).toEqual({ inserted: 4, updated: 0, unchanged: 0 })
    expect(await upsertMetars(sql, rows, NOW)).toEqual({ inserted: 0, updated: 0, unchanged: 4 })

    const corrected = metar(
      'LTFM',
      '2026-01-15T12:20:00Z',
      'METAR COR LTFM 151220Z 03017G31KT 9999 -SHRA 08/05 Q1009',
    )
    const later = at('2026-01-15T13:05:00Z')
    expect(await upsertMetars(sql, [corrected], later)).toEqual({
      inserted: 0,
      updated: 1,
      unchanged: 0,
    })
    const [row] = await check<{ raw_text: string; fetched_at: Date; qnh_hpa: number }[]>`
      select raw_text, fetched_at, qnh_hpa from weather_metar
      where station_icao = 'LTFM' and observed_at = '2026-01-15T12:20:00Z'`
    expect(row?.raw_text).toBe(corrected.rawText)
    expect(row?.fetched_at.toISOString()).toBe(later.toISOString())
    expect(row?.qnh_hpa).toBe(1009)
    // Sonlu olmayan QNH boş yazılır.
    const [nan] = await check<{ n: number }[]>`
      select count(*)::int as n from weather_metar where qnh_hpa is null`
    expect(nan?.n).toBe(0)
  })

  it('veritabanı geçersiz istasyon kodunu ve rapor türünü reddeder', async () => {
    await expect(
      upsertMetars(sql, [metar('ltfm', '2026-01-15T12:50:00Z', 'ltfm 151250Z')], NOW),
    ).rejects.toThrow()
    await expect(
      upsertMetars(
        sql,
        [
          metar('LTFM', '2026-01-15T12:50:00Z', 'LTFM 151250Z', {
            reportType: 'SYNOP' as MetarWrite['reportType'],
          }),
        ],
        NOW,
      ),
    ).rejects.toThrow()
  })
})

describe('TAF kaydı', () => {
  it('yayın zamanı anahtardır; geçerlilik ya da metin değişince güncellenir', async () => {
    const rows = [
      taf(
        'LTFM',
        '2026-01-15T10:40:00Z',
        '2026-01-15T12:00:00Z',
        '2026-01-16T18:00:00Z',
        'TAF LTFM 151040Z 1512/1618 03015G28KT 9999 SCT025 BKN035',
      ),
      taf(
        'LTFM',
        '2026-01-15T04:40:00Z',
        '2026-01-15T06:00:00Z',
        '2026-01-16T12:00:00Z',
        'TAF LTFM 150440Z 1506/1612 04012KT 9999 SCT030',
      ),
      taf(
        'LTBJ',
        '2026-01-14T04:40:00Z',
        '2026-01-14T06:00:00Z',
        '2026-01-15T06:00:00Z',
        'TAF LTBJ 140440Z 1406/1506 VRB03KT 9999 FEW040',
      ),
    ]
    expect(await upsertTafs(sql, rows, NOW)).toEqual({ inserted: 3, updated: 0, unchanged: 0 })
    expect(await upsertTafs(sql, rows, NOW)).toEqual({ inserted: 0, updated: 0, unchanged: 3 })
    const first = rows[0]
    if (!first) throw new Error('satır yok')
    expect(await upsertTafs(sql, [{ ...first, validTo: at('2026-01-16T12:00:00Z') }], NOW)).toEqual(
      { inserted: 0, updated: 1, unchanged: 0 },
    )
    await upsertTafs(sql, [first], NOW)
    await expect(
      upsertTafs(
        sql,
        [{ ...first, validTo: first.validFrom, issuedAt: at('2026-01-15T11:00:00Z') }],
        NOW,
      ),
    ).rejects.toThrow()
  })
})

describe('okuma', () => {
  it('güncel hava: istasyon başına en yeni rapor ve geçerli TAFlar (en yeni önce)', async () => {
    const result = await listLatestWeather(sql, ['LTFM', 'ltbs', 'LTBJ', 'LTBQ', 'bozuk!'], NOW)
    expect(
      result.metars.map((m) => [m.stationIcao, m.reportType, m.observedAt.toISOString()]),
    ).toEqual([
      // Aynı anda gözlenen METAR ve SPECI'den SPECI (önemli değişiklik raporu) en yenidir.
      ['LTBS', 'SPECI', '2026-01-15T12:42:00.000Z'],
      ['LTFM', 'METAR', '2026-01-15T12:50:00.000Z'],
    ])
    expect(result.metars[1]).toMatchObject({
      rawText: 'LTFM 151250Z 03018G32KT 9999 -SHRA 09/05 Q1009',
      qnhHpa: 1009,
      flightCategory: 'VFR',
    })
    // LTBJ'nin TAF'ı süresi dolmuş: dönmez.
    expect(result.tafs.map((t) => [t.stationIcao, t.issuedAt.toISOString()])).toEqual([
      ['LTFM', '2026-01-15T10:40:00.000Z'],
      ['LTFM', '2026-01-15T04:40:00.000Z'],
    ])
    expect(result.tafs[0]?.validTo.toISOString()).toBe('2026-01-16T18:00:00.000Z')
    expect(await listLatestWeather(sql, [], NOW)).toEqual({ metars: [], tafs: [] })
  })

  it('metarStationsSince: listeden, o andan sonra gözlemi olan istasyonlar (yeni istasyon doldurma)', async () => {
    const day = at('2026-01-14T13:00:00Z')
    expect(await metarStationsSince(sql, ['LTFM', 'ltbs', 'LTBJ', 'LGAV', 'bozuk!'], day)).toEqual([
      'LTBS',
      'LTFM',
    ])
    // Sınır dahil: 12:50'deki gözlem 12:50'den sonra sayılır, 12:51'den sonra sayılmaz.
    expect(await metarStationsSince(sql, ['LTFM'], at('2026-01-15T12:50:00Z'))).toEqual(['LTFM'])
    expect(await metarStationsSince(sql, ['LTFM'], at('2026-01-15T12:51:00Z'))).toEqual([])
    expect(await metarStationsSince(sql, [], day)).toEqual([])
  })

  it('geçmiş: aralıktaki METAR/SPECI (gözlem) ve TAFlar (yayın), en yeni önce', async () => {
    const history = await listWeatherHistory(
      sql,
      'ltfm',
      at('2026-01-15T05:00:00Z'),
      at('2026-01-15T12:30:00Z'),
    )
    expect(history.metars.map((m) => m.observedAt.toISOString())).toEqual([
      '2026-01-15T12:20:00.000Z',
    ])
    expect(history.metars[0]?.rawText.startsWith('METAR COR')).toBe(true)
    expect(history.tafs.map((t) => t.issuedAt.toISOString())).toEqual(['2026-01-15T10:40:00.000Z'])
    const all = await listWeatherHistory(sql, 'LTFM', at('2026-01-01T00:00:00Z'), NOW)
    expect(all.metars).toHaveLength(2)
    expect(all.tafs).toHaveLength(2)
    expect(await listWeatherHistory(sql, 'LTFM', NOW, at('2026-01-01T00:00:00Z'))).toEqual({
      metars: [],
      tafs: [],
    })
  })
})

interface PlanNode {
  'Node Type': string
  'Relation Name'?: string
  'Index Name'?: string
  Plans?: PlanNode[]
}

/**
 * İşlevin gönderdiği sorguların planı: sorgu metni ve parametreleri istemcinin `debug` kancasıyla
 * yakalanır, aynı parametrelerle EXPLAIN edilir. Sıralı tarama ve sıralama kapatılır: dizin sorgunun
 * sırasını veremiyorsa planda yine `Sort` kalır (başka yol yoktur), verebiliyorsa kalmaz.
 */
async function plansOf(
  run: (client: postgres.Sql) => Promise<unknown>,
): Promise<Map<string, PlanNode>> {
  const captured: { query: string; parameters: unknown[] }[] = []
  const spy = postgres(testUrl, {
    max: 1,
    onnotice: () => undefined,
    debug: (_connection, query, parameters) =>
      captured.push({ query, parameters: [...parameters] }),
  })
  try {
    await run(spy)
  } finally {
    await spy.end({ timeout: 5 })
  }
  const plans = new Map<string, PlanNode>()
  await check.begin(async (tx) => {
    await tx.unsafe('set local enable_seqscan = off')
    await tx.unsafe('set local enable_sort = off')
    for (const { query, parameters } of captured) {
      const table = /from weather_(metar|taf)\b/.exec(query)?.[1]
      if (!table) continue
      const [row] = await tx.unsafe<{ 'QUERY PLAN': { Plan: PlanNode }[] }[]>(
        `explain (format json, costs off) ${query}`,
        parameters as never[],
      )
      const root = row?.['QUERY PLAN'][0]?.Plan
      if (root) plans.set(table, root)
    }
  })
  return plans
}

/** Ağaçtaki düğümler, her biri ebeveyniyle. */
function nodes(
  root: PlanNode,
  parent: PlanNode | null = null,
): { node: PlanNode; parent: PlanNode | null }[] {
  return [{ node: root, parent }, ...(root.Plans ?? []).flatMap((child) => nodes(child, root))]
}

describe('dizin kullanımı (EXPLAIN)', () => {
  it('en yeni METAR istasyon başına dizinden tek satırla okunur; sıralama adımı yok', async () => {
    const plans = await plansOf((client) => listLatestWeather(client, ['LTFM', 'LTBS'], NOW))
    const plan = plans.get('metar')
    expect(plan).toBeDefined()
    const scans = nodes(plan as PlanNode).filter((n) => n.node['Relation Name'] === 'weather_metar')
    expect(scans).toHaveLength(1)
    const [scan] = scans
    expect(scan?.node['Node Type']).toMatch(/^Index (Only )?Scan$/)
    expect(scan?.node['Index Name']).toBe('weather_metar_station_observed_type_idx')
    // Dizin taraması doğrudan LIMIT 1'in altındadır (arada Sort yok).
    expect(scan?.parent?.['Node Type']).toBe('Limit')
  })

  it('geçmiş sorguları dizin sırasıyla okunur; sıralama adımı yok', async () => {
    const plans = await plansOf((client) =>
      listWeatherHistory(client, 'LTFM', at('2026-01-01T00:00:00Z'), NOW),
    )
    for (const [table, index] of [
      ['metar', 'weather_metar_station_observed_type_idx'],
      ['taf', 'weather_taf_station_issued_idx'],
    ] as const) {
      const plan = plans.get(table)
      expect(plan, table).toBeDefined()
      expect(
        nodes(plan as PlanNode).some((n) => n.node['Node Type'] === 'Sort'),
        table,
      ).toBe(false)
      expect(plan?.['Node Type'], table).toMatch(/^Index (Only )?Scan$/)
      expect(plan?.['Index Name'], table).toBe(index)
    }
  })

  it('aynı anda gözlenen SPECI ve METAR: en yeni rapor SPECI, geçmişte SPECI önce', async () => {
    const observed = '2026-01-15T12:55:00Z'
    await upsertMetars(
      sql,
      [
        metar('LTCG', observed, 'LTCG 151255Z 22010KT 9999 FEW030 10/05 Q1012'),
        metar('LTCG', observed, 'SPECI LTCG 151255Z 22025G38KT 3000 TSRA FEW020CB 09/07 Q1010', {
          reportType: 'SPECI',
        }),
      ],
      NOW,
    )
    const latest = await listLatestWeather(sql, ['LTCG'], NOW)
    expect(latest.metars.map((m) => m.reportType)).toEqual(['SPECI'])
    const history = await listWeatherHistory(sql, 'LTCG', at('2026-01-15T12:00:00Z'), NOW)
    expect(history.metars.map((m) => m.reportType)).toEqual(['SPECI', 'METAR'])
    // Sonraki testlerin istasyon sayıları değişmesin.
    await check`delete from weather_metar where station_icao = 'LTCG'`
  })
})

describe('kaynak durumu ve admin özeti', () => {
  it('başarı, hata, engel ve kapalılık kaydedilir', async () => {
    expect(await getWeatherSource(sql, 'metar')).toBeNull()
    await recordWeatherError(sql, 'metar', {
      origin: 'remote',
      now: at('2026-01-15T12:40:00Z'),
      error: 'aviationweather.gov hız sınırı (METAR, HTTP 429)',
      block: { until: at('2026-01-15T12:50:00Z'), kind: 'rate_limit' },
    })
    expect(await getWeatherSource(sql, 'metar')).toMatchObject({
      origin: 'remote',
      checkedAt: null,
      lastError: 'aviationweather.gov hız sınırı (METAR, HTTP 429)',
      blockedUntil: at('2026-01-15T12:50:00Z'),
      blockedKind: 'rate_limit',
    })
    // Engelsiz hata mevcut engeli silmez.
    await recordWeatherError(sql, 'metar', {
      origin: 'remote',
      now: at('2026-01-15T12:45:00Z'),
      error: 'HTTP 503',
    })
    expect(await getWeatherSource(sql, 'metar')).toMatchObject({
      lastError: 'HTTP 503',
      blockedKind: 'rate_limit',
    })
    await recordWeatherCheck(sql, 'metar', {
      origin: 'remote',
      now: at('2026-01-15T12:56:00Z'),
      stationCount: 61,
      reportCount: 120,
      skippedCount: 1,
    })
    expect(await getWeatherSource(sql, 'metar')).toMatchObject({
      kind: 'metar',
      origin: 'remote',
      checkedAt: at('2026-01-15T12:56:00Z'),
      stationCount: 61,
      reportCount: 120,
      skippedCount: 1,
      lastError: null,
      lastErrorAt: null,
      blockedUntil: null,
      blockedKind: null,
    })
    await recordWeatherDisabled(sql, 'taf', { reason: 'EXTERNAL_PROVIDERS_DISABLED=true' })
    expect(await getWeatherSource(sql, 'taf')).toMatchObject({
      origin: 'disabled',
      disabledReason: 'EXTERNAL_PROVIDERS_DISABLED=true',
      checkedAt: null,
    })
  })

  it('özet: son 3 saatte gözlemi olan ve geçerli TAFı olan istasyonlar', async () => {
    const status = await weatherStatus(sql, NOW)
    expect(status).toMatchObject({
      stationsWithRecentMetar: 2,
      newestObservedAt: at('2026-01-15T12:50:00Z'),
      stationsWithValidTaf: 1,
    })
    expect(status.metar?.stationCount).toBe(61)
    expect(status.taf?.origin).toBe('disabled')
    const later = await weatherStatus(sql, at('2026-01-15T16:00:00Z'))
    expect(later.stationsWithRecentMetar).toBe(0)
  })
})

describe('pruneWeather', () => {
  it('30 günden eski raporları ve listeden çıkan istasyonları siler; boş liste istasyon silmez', async () => {
    await upsertMetars(
      sql,
      [metar('LTFM', '2025-12-15T12:50:00Z', 'LTFM 151250Z 03010KT 9999 Q1015')],
      NOW,
    )
    await upsertTafs(
      sql,
      [
        taf(
          'LTFM',
          '2025-12-14T10:40:00Z',
          '2025-12-14T12:00:00Z',
          '2025-12-15T12:00:00Z',
          'TAF LTFM 141040Z 1412/1512 03010KT 9999',
        ),
      ],
      NOW,
    )
    expect(await pruneWeather(sql, { now: NOW, stations: [] })).toEqual({
      metar: 1,
      taf: 1,
      unlisted: 0,
    })
    expect(await pruneWeather(sql, { now: NOW, stations: ['LTFM', 'LTBJ'] })).toEqual({
      metar: 0,
      taf: 0,
      unlisted: 2,
    })
    const [left] = await check<{ metars: number; tafs: number }[]>`
      select (select count(*)::int from weather_metar) as metars,
        (select count(*)::int from weather_taf) as tafs`
    expect(left).toEqual({ metars: 2, tafs: 3 })
  })
})

describe('retainMetars / retainTafs (yalnızca fixture modu)', () => {
  it('istasyonların listede olmayan satırlarını siler; diğer istasyonlara dokunmaz', async () => {
    await check`delete from weather_metar`
    await check`delete from weather_taf`
    const keep = metar(
      'LTFM',
      '2026-01-15T12:50:00Z',
      'LTFM 151250Z 03018G32KT 9999 -SHRA 09/05 Q1009',
    )
    const shifted = metar(
      'LTFM',
      '2026-01-15T13:50:00Z',
      'LTFM 151350Z 03018G32KT 9999 -SHRA 09/05 Q1009',
    )
    await upsertMetars(sql, [keep, shifted], NOW)
    // LTBJ listede değil: satırı kalır.
    await upsertMetars(
      sql,
      [metar('LTBJ', '2026-01-15T12:50:00Z', 'LTBJ 151250Z VRB02KT 9999 Q1012')],
      NOW,
    )
    expect(await retainMetars(sql, ['LTFM', 'LTBQ'], [keep])).toBe(1)
    const rows = await check<{ station_icao: string; observed_at: Date }[]>`
      select station_icao, observed_at from weather_metar order by station_icao, observed_at`
    expect(rows.map((r) => [r.station_icao, r.observed_at.toISOString()])).toEqual([
      ['LTBJ', '2026-01-15T12:50:00.000Z'],
      ['LTFM', '2026-01-15T12:50:00.000Z'],
    ])
    expect(await retainMetars(sql, [], [])).toBe(0)

    const tafKeep = taf(
      'LTFM',
      '2026-01-15T10:40:00Z',
      '2026-01-15T12:00:00Z',
      '2026-01-16T18:00:00Z',
      'TAF LTFM 151040Z 1512/1618 03015KT 9999',
    )
    const tafShifted = taf(
      'LTFM',
      '2026-01-15T11:40:00Z',
      '2026-01-15T13:00:00Z',
      '2026-01-16T19:00:00Z',
      'TAF LTFM 151140Z 1513/1619 03015KT 9999',
    )
    await upsertTafs(sql, [tafKeep, tafShifted], NOW)
    expect(await retainTafs(sql, ['LTFM'], [tafKeep])).toBe(1)
    const tafs = await check<{ issued_at: Date }[]>`
      select issued_at from weather_taf where station_icao = 'LTFM'`
    expect(tafs.map((t) => t.issued_at.toISOString())).toEqual(['2026-01-15T10:40:00.000Z'])
  })
})
