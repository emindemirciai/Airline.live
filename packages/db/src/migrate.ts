import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/** Aynı anda yalnızca bir migrate çalışsın diye kullanılan sabit advisory lock anahtarı. */
export const MIGRATION_LOCK_KEY = 684_231_907

export interface MigrateOptions {
  databaseUrl: string
  migrationsFolder: string
  log?: (message: string) => void
  /**
   * Migration'lardan sonra aynı bağlantıda ve kilit hâlâ tutulurken çalışır: partition açma ve
   * tohum verisi gibi idempotent adımlar (CLI). Hata fırlatırsa migrate başarısız sayılır.
   */
  afterMigrate?: (sql: postgres.Sql) => Promise<void>
}

/**
 * Migration'ları tek bir bağlantı üzerinde, advisory lock altında uygular.
 * lock_timeout 5 sn, statement_timeout 120 sn (infra.md → Migration). Hata fırlatırsa çağıran
 * süreç sıfır olmayan kodla çıkmalıdır; böylece Compose deploy'u durur.
 */
export async function runMigrations({
  databaseUrl,
  migrationsFolder,
  log = () => undefined,
  afterMigrate,
}: MigrateOptions) {
  const sql = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
    onnotice: () => undefined,
    connection: { application_name: 'havayolu-migrate' },
  })
  try {
    await sql`set lock_timeout = '5s'`
    await sql`set statement_timeout = '120s'`
    log('advisory lock bekleniyor')
    await sql`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`
    try {
      log(`migration'lar uygulanıyor: ${migrationsFolder}`)
      await migrate(drizzle(sql), { migrationsFolder })
      log("migration'lar tamamlandı")
      if (afterMigrate) await afterMigrate(sql)
    } finally {
      await sql`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}
