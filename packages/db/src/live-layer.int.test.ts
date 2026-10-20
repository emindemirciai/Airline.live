import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type Database } from './client'
import { listAdminActions, readLiveLayer, readLiveLayerEnabled, setLiveLayer } from './live-layer'
import { runMigrations } from './migrate'

const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const testDbName = 'app_test_db_live_layer'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${testDbName}`)
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))

const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined })
let database: Database
let check: postgres.Sql

beforeAll(async () => {
  await admin.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.unsafe(`create database ${testDbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder })
  database = createDb(testUrl, { max: 2 })
  check = postgres(testUrl, { max: 2, onnotice: () => undefined })
})

afterAll(async () => {
  await Promise.allSettled([database?.sql.end({ timeout: 5 }), check?.end({ timeout: 5 })])
  await admin.unsafe(`drop database if exists ${testDbName} with (force)`)
  await admin.end({ timeout: 5 })
})

beforeEach(async () => {
  await check`truncate live_layer_state, admin_actions`
})

const T0 = new Date('2026-10-15T09:00:00.000Z')
const T1 = new Date('2026-10-15T09:05:00.000Z')

describe('canlı katman (D-115)', () => {
  it('satır yoksa katman açık ve hiç değiştirilmemiş', async () => {
    expect(await readLiveLayerEnabled(database.sql)).toBe(true)
    expect(await readLiveLayer(database.sql)).toEqual({
      enabled: true,
      updatedAt: null,
      updatedBy: null,
    })
    expect(await listAdminActions(database.sql)).toEqual([])
  })

  it('kapatıp açmak durumu ve iki işlem satırını yazar; işlemler en yeni önce', async () => {
    const off = await setLiveLayer(database.sql, {
      enabled: false,
      actor: 'admin@example.test',
      reason: 'Karar 2026/123',
      at: T0,
    })
    expect(off).toEqual({ enabled: false, updatedAt: T0, updatedBy: 'admin@example.test' })
    expect(await readLiveLayerEnabled(database.sql)).toBe(false)

    const on = await setLiveLayer(check, {
      enabled: true,
      actor: 'admin@example.test',
      reason: null,
      at: T1,
    })
    expect(on).toEqual({ enabled: true, updatedAt: T1, updatedBy: 'admin@example.test' })
    expect(await readLiveLayerEnabled(check)).toBe(true)

    expect(await listAdminActions(database.sql)).toEqual([
      { at: T1, actor: 'admin@example.test', action: 'live_layer_on', reason: null },
      { at: T0, actor: 'admin@example.test', action: 'live_layer_off', reason: 'Karar 2026/123' },
    ])
    const [state] = await check<{ n: number }[]>`select count(*)::int as n from live_layer_state`
    expect(state?.n).toBe(1)
  })

  it('durum değişmese de her basış kaydedilir; liste sınırı uygulanır', async () => {
    for (let i = 0; i < 3; i += 1) {
      await setLiveLayer(database.sql, {
        enabled: false,
        actor: 'admin@example.test',
        reason: null,
        at: new Date(T0.getTime() + i * 1_000),
      })
    }
    expect(await listAdminActions(database.sql)).toHaveLength(3)
    expect(await listAdminActions(database.sql, 2)).toHaveLength(2)
  })

  it('500 karakterden uzun neden tablo denetimine takılır, durum değişmez', async () => {
    await expect(
      setLiveLayer(database.sql, {
        enabled: false,
        actor: 'admin@example.test',
        reason: 'x'.repeat(501),
        at: T0,
      }),
    ).rejects.toThrow()
    expect(await readLiveLayerEnabled(database.sql)).toBe(true)
    expect(await listAdminActions(database.sql)).toEqual([])
    // 500 karakter (çok baytlı harfler dahil) kabul edilir.
    await setLiveLayer(database.sql, {
      enabled: false,
      actor: 'admin@example.test',
      reason: 'ş'.repeat(500),
      at: T0,
    })
    expect((await listAdminActions(database.sql))[0]?.reason).toHaveLength(500)
  })

  it('tek satır denetimi: id 1 dışında satır yazılamaz', async () => {
    await expect(
      check`insert into live_layer_state (id, enabled, updated_at, updated_by)
        values (2, false, now(), 'admin@example.test')`,
    ).rejects.toThrow()
  })
})
