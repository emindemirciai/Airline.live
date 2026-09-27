// hy-migrate servisinin giriş noktası: `node packages/db/dist/migrate.js`.
// DATABASE_URL zorunludur. Migration klasörü paketin `drizzle/` dizinidir. Migration'lardan sonra
// iz tablolarının günlük partition'ları açılır ve tohum istasyonları eklenir (ikisi de idempotent).
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { runMigrations } from '../migrate'
import { ensureTrackPartitions } from '../partitions'
import { seedStations } from '../seed'

// Yerelde (`pnpm db:migrate`) kökteki .env (varsa) ve .env.example okunur; üretimde env'i compose verir.
if (process.env.APP_ENV !== 'production') {
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      for (const name of ['.env', '.env.example']) {
        if (existsSync(join(dir, name))) process.loadEnvFile(join(dir, name))
      }
      break
    }
    if (dirname(dir) === dir) break
  }
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL tanımlı değil. Açıklama için kökteki .env.example dosyasına bak.')
  process.exit(1)
}
// Şablondaki "#parola üret#" doldurulmadan kalırsa compose onu adrese yazar (D-063).
if (databaseUrl.includes('#')) {
  console.error(
    'DATABASE_URL: POSTGRES_PASSWORD doldurulmamış (#…# talimatı duruyor); parolayı gir.',
  )
  process.exit(1)
}

// Kaynaktan (tsx, src/cli) ve derlenmiş hâlden (dist/migrate.js) çalışırken klasörü bul.
const candidates = ['../drizzle', '../../drizzle'].map((p) =>
  fileURLToPath(new URL(p, import.meta.url)),
)
const migrationsFolder = candidates.find((dir) => existsSync(dir))
if (!migrationsFolder) {
  console.error(`Migration klasörü bulunamadı: ${candidates.join(', ')}`)
  process.exit(1)
}

try {
  await runMigrations({
    databaseUrl,
    migrationsFolder,
    log: (message) => console.log(`[migrate] ${message}`),
    afterMigrate: async (sql) => {
      // Partition açılamazsa (ör. kilit alınamadı) yayın durmaz: satırlar DEFAULT'a düşer, günlük iş
      // yeniden dener ve admin paneli uyarır. Migration hatası ise yayını durdurur.
      try {
        const { created, movedRows } = await ensureTrackPartitions(sql, new Date())
        console.log(
          `[migrate] iz partition'ları: ${created.length} yeni, DEFAULT'tan taşınan satır: ${movedRows}`,
        )
      } catch (error) {
        console.warn(
          "[migrate] UYARI: iz partition'ları açılamadı; günlük bakım işi yeniden deneyecek:",
          error instanceof Error ? error.message : error,
        )
      }
      const seeded = await seedStations(drizzle(sql))
      console.log(`[migrate] tohum istasyonları: ${seeded} yeni`)
    },
  })
  process.exit(0)
} catch (error) {
  console.error('[migrate] başarısız:', error instanceof Error ? error.message : error)
  process.exit(1)
}
