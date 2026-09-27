import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runMigrations } from './migrate'

const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_db_pkg'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))

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
  it('temiz veritabanında PostGIS eklentisini kurar ve ikinci çalışmada bir şey değiştirmez', async () => {
    const log: string[] = []
    await runMigrations({ databaseUrl: testUrl, migrationsFolder, log: (m) => log.push(m) })
    await runMigrations({ databaseUrl: testUrl, migrationsFolder })

    const sql = postgres(testUrl, { max: 1, onnotice: () => undefined })
    try {
      const [ext] = await sql`select extversion from pg_extension where extname = 'postgis'`
      expect(ext?.extversion).toMatch(/^3\./)
      const applied = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`
      expect(applied[0]?.n).toBe(1)
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
