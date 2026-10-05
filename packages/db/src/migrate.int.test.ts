import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runMigrations } from './migrate'
import { ensureTrackPartitions, TRACK_TABLES } from './partitions'

const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_db_pkg'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))
/** Commit'li migration sayısı (drizzle günlüğü; 0005 veri migration'ı, 0006 ve 0007 dahil 8). */
const journalEntries = (
  JSON.parse(readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8')) as {
    entries: unknown[]
  }
).entries.length

const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined })

beforeAll(async () => {
  await admin.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.unsafe(`create database ${testDbName}`)
})

afterAll(async () => {
  await admin.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.end({ timeout: 5 })
})

describe('runMigrations', () => {
  it("temiz veritabanında bütün migration'ları uygular (PostGIS dahil), ikinci çalışmada bir şey değiştirmez", async () => {
    const log: string[] = []
    await runMigrations({ databaseUrl: testUrl, migrationsFolder, log: (m) => log.push(m) })
    await runMigrations({ databaseUrl: testUrl, migrationsFolder })

    const sql = postgres(testUrl, { max: 1, onnotice: () => undefined })
    try {
      const [ext] = await sql`select extversion from pg_extension where extname = 'postgis'`
      expect(ext?.extversion).toMatch(/^3\./)
      const applied = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`
      expect(journalEntries).toBe(8)
      expect(applied[0]?.n).toBe(journalEntries)
    } finally {
      await sql.end({ timeout: 5 })
    }
    expect(log).toContain("migration'lar tamamlandı")
  })

  it('iki migrate aynı anda çalışınca advisory lock sayesinde ikisi de başarıyla biter', async () => {
    await expect(
      Promise.all([
        runMigrations({ databaseUrl: testUrl, migrationsFolder }),
        runMigrations({ databaseUrl: testUrl, migrationsFolder }),
      ]),
    ).resolves.toBeDefined()
  })
})

describe('0006: iz tablolarına seen_pos_s ve baro_rate_fpm', () => {
  const upgradeDbName = 'app_test_db_pkg_0006'
  const upgradeUrl = adminUrl.replace(/\/[^/]*$/, `/${upgradeDbName}`)
  const tag = '0006_track_seen_pos_baro_rate'
  let beforeDir: string
  let afterDir: string

  /**
   * Migration klasörünün geçici bir kopyası; günlük, 0006'nın sırasından hesaplanan `count`
   * kayıtta kesilir. Böylece sonraki migration'lar (0007+) bu testin 0006'ya özgü
   * denetimlerine karışmaz.
   */
  const journalPrefixCopy = (prefix: string, count: (tagIndex: number) => number): string => {
    const dir = mkdtempSync(join(tmpdir(), prefix))
    cpSync(migrationsFolder, dir, { recursive: true })
    const journalPath = join(dir, 'meta', '_journal.json')
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries: { tag: string }[]
    }
    const index = journal.entries.findIndex((e) => e.tag === tag)
    expect(index).toBeGreaterThan(0)
    writeFileSync(
      journalPath,
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, count(index)) }),
    )
    return dir
  }

  beforeAll(async () => {
    await admin.unsafe(`drop database if exists ${upgradeDbName} with (force)`)
    await admin.unsafe(`create database ${upgradeDbName}`)
    // 0006'dan önceki durum: günlük 0006'nın önünde kesilir.
    beforeDir = journalPrefixCopy('hy-migrations-0005-', (i) => i)
    // 0006 sonrası durum: günlük 0006'da biter.
    afterDir = journalPrefixCopy('hy-migrations-0006-', (i) => i + 1)
  })

  afterAll(async () => {
    await admin.unsafe(`drop database if exists ${upgradeDbName} with (force)`)
    rmSync(beforeDir, { recursive: true, force: true })
    rmSync(afterDir, { recursive: true, force: true })
  })

  it("mevcut günlük ve DEFAULT partition'lara yeniden yazmadan geçer; eski satırlar null okunur", async () => {
    const now = new Date('2026-01-20T12:00:00Z')
    await runMigrations({
      databaseUrl: upgradeUrl,
      migrationsFolder: beforeDir,
      afterMigrate: async (sql) => {
        await ensureTrackPartitions(sql, now)
      },
    })
    const sql = postgres(upgradeUrl, { max: 1, onnotice: () => undefined })
    try {
      // 0006 öncesi biçimde satırlar: biri günün partition'ına, biri (ileri tarihli) DEFAULT'a.
      for (const table of TRACK_TABLES) {
        await sql`
          insert into ${sql(table)} (flight_id, ts, lat, lon, vertical_rate_fpm, source)
          values (1, '2026-01-20T11:00:00Z', 41, 29, -700, 0),
            (1, '2026-03-01T00:00:00Z', 41, 29, -700, 0)`
      }
      const files = async () =>
        new Map(
          (
            await sql<{ name: string; node: number }[]>`
              select c.relname as name, c.relfilenode::int8::float8 as node
              from pg_inherits i
              join pg_class p on p.oid = i.inhparent
              join pg_class c on c.oid = i.inhrelid
              where p.relname in ${sql([...TRACK_TABLES])}`
          ).map((r) => [r.name, r.node]),
        )
      const before = await files()
      expect(before.has('track_points_sampled_default')).toBe(true)
      expect(before.has('track_points_fine_p20260120')).toBe(true)

      await runMigrations({ databaseUrl: upgradeUrl, migrationsFolder: afterDir })

      // Yalnızca katalog değişti: hiçbir partition'ın dosyası yeniden yazılmadı.
      expect(await files()).toEqual(before)
      const columns = await sql<
        { table: string; column: string; type: string; nullable: boolean; dflt: boolean }[]
      >`
        select c.relname as table, a.attname as column, format_type(a.atttypid, a.atttypmod) as type,
          not a.attnotnull as nullable, a.atthasdef as dflt
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        where a.attname in ('seen_pos_s', 'baro_rate_fpm') and not a.attisdropped
          and c.relname in ${sql([...TRACK_TABLES, ...before.keys()])}
        order by c.relname, a.attname`
      expect(columns).toHaveLength((TRACK_TABLES.length + before.size) * 2)
      for (const col of columns) {
        expect(col).toMatchObject({
          type: col.column === 'seen_pos_s' ? 'real' : 'integer',
          nullable: true,
          dflt: false,
        })
      }
      for (const table of TRACK_TABLES) {
        const rows = await sql<{ seen_pos_s: number | null; baro_rate_fpm: number | null }[]>`
          select seen_pos_s, baro_rate_fpm from ${sql(table)} order by ts`
        expect(rows).toEqual([
          { seen_pos_s: null, baro_rate_fpm: null },
          { seen_pos_s: null, baro_rate_fpm: null },
        ])
      }
    } finally {
      await sql.end({ timeout: 5 })
    }
  })
})
