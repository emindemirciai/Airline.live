// Yükseltme testi (infra.md → CI testleri): temel commit'teki migration'lar temiz bir veritabanına
// uygulanır, ardından bu commit'inkiler üstüne uygulanır. Temel yerelde origin/main, CI'da HEAD^1'dir
// (PR'da main'in ucu, main push'unda bir önceki main; MIGRATION_BASE_REF). Ayrıca yayınlanmış
// migration'ların değiştirilmediği denetlenir: drizzle migrator uygulanmış bir migration'ı yeniden
// çalıştırmaz, değişiklik üretimde sessizce kaybolurdu. Temel dalda migration yoksa test geçer.
// Gerçek PostgreSQL gerekir (`pnpm dev:infra`; CI'da test-integration işi).
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb } from '../packages/db/src/client.ts'
import { runMigrations } from '../packages/db/src/migrate.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const baseRef = process.env.MIGRATION_BASE_REF ?? 'origin/main'
const folder = 'packages/db/drizzle'
const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://havayolu:havayolu_dev_only@localhost:45432/postgres'
const dbName = 'app_test_db_upgrade'
const testUrl = adminUrl.replace(/\/[^/]*$/, `/${dbName}`)

const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })

interface Journal {
  entries: { idx: number; tag: string; when: number }[]
}

let baseFiles: string[]
try {
  baseFiles = git(['ls-tree', '-r', '--name-only', baseRef, '--', folder])
    .split('\n')
    .filter(Boolean)
} catch {
  console.error(
    `✗ ${baseRef} okunamadı. Yerelde önce: git fetch origin (CI'da checkout fetch-depth: 2)`,
  )
  process.exit(1)
}
if (!baseFiles.includes(`${folder}/meta/_journal.json`)) {
  console.log(`✓ ${baseRef} dalında migration yok; yükseltme testi geçildi.`)
  process.exit(0)
}

const baseDir = mkdtempSync(join(tmpdir(), 'hy-migrations-base-'))
for (const file of baseFiles) {
  const target = join(baseDir, file.slice(folder.length + 1))
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, git(['show', `${baseRef}:${file}`]))
}

const readJournal = (dir: string) =>
  JSON.parse(readFileSync(join(dir, 'meta', '_journal.json'), 'utf8')) as Journal
const baseJournal = readJournal(baseDir)
const branchDir = join(root, folder)
const branchJournal = readJournal(branchDir)

// Yayınlanmış migration'lar değişmez: aynı sıra, ad, zaman ve SQL.
const problems: string[] = []
for (const entry of baseJournal.entries) {
  const branchEntry = branchJournal.entries[entry.idx]
  if (!branchEntry || branchEntry.tag !== entry.tag || branchEntry.when !== entry.when) {
    problems.push(`${entry.tag}: dalda yok ya da sırası/zamanı değişmiş`)
    continue
  }
  const sqlOf = (dir: string) => readFileSync(join(dir, `${entry.tag}.sql`), 'utf8')
  if (sqlOf(baseDir) !== sqlOf(branchDir)) problems.push(`${entry.tag}: SQL içeriği değişmiş`)
}
if (problems.length > 0) {
  console.error(
    `✗ ${baseRef} dalındaki migration'lar değiştirilmiş (yeni migration ekle):\n${problems
      .map((p) => `  ${p}`)
      .join('\n')}`,
  )
  process.exit(1)
}

const admin = createDb(adminUrl, { max: 1, applicationName: 'havayolu-upgrade-test' }).sql
try {
  await admin.unsafe(`drop database if exists ${dbName} with (force)`)
  await admin.unsafe(`create database ${dbName}`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder: baseDir })
  console.log(`• ${baseRef}: ${baseJournal.entries.length} migration uygulandı`)
  await runMigrations({ databaseUrl: testUrl, migrationsFolder: branchDir })
  const { sql } = createDb(testUrl, { max: 1, applicationName: 'havayolu-upgrade-test' })
  const [row] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`
  await sql.end({ timeout: 5 })
  if (row?.n !== branchJournal.entries.length) {
    throw new Error(`uygulanan ${row?.n}, beklenen ${branchJournal.entries.length}`)
  }
  console.log(
    `✓ Yükseltme testi: ${baseJournal.entries.length} → ${branchJournal.entries.length} migration.`,
  )
} catch (error) {
  console.error('✗ Yükseltme testi başarısız:', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await admin.unsafe(`drop database if exists ${dbName} with (force)`)
  await admin.end({ timeout: 5 })
  rmSync(baseDir, { recursive: true, force: true })
}
