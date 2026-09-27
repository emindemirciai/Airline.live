// Drizzle şeması ile commit'li migration'lar tutarlı mı (infra.md → Migration, M2 kabulü)?
// 1) `drizzle-kit check`: snapshot'lar arasında çakışma yok ("Everything's fine").
// 2) `drizzle-kit generate`: şemada migration'a dönüşmemiş değişiklik yok ("No schema changes").
// drizzle-kit 0.31 bazı hatalarda (etkileşimli yeniden adlandırma sorusu TTY yokken, şema dosyası
// yüklenemezse) hiçbir şey yazmadan 0 ile çıkar. Bu yüzden çıkış koduna değil çıktıdaki başarı
// iletisine bakılır; ayrıca klasördeki dosyalar önce/sonra karşılaştırılır. Veritabanına bağlanmaz.
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const folder = join(root, 'packages', 'db', 'drizzle')

/** Komut sabittir (kullanıcı girdisi yok); Windows'ta pnpm bir .cmd olduğu için kabukla çalışır. */
function drizzleKit(command: 'check' | 'generate'): string {
  let output: string
  try {
    output = execSync(`pnpm --filter @havayolu/db exec drizzle-kit ${command}`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    })
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string; message: string }
    console.error(failed.stdout ?? '', failed.stderr ?? '')
    throw new Error(`drizzle-kit ${command} başarısız: ${failed.message}`)
  }
  process.stdout.write(output)
  return output
}

/** Migration klasöründeki dosyalar ve içerik özetleri. */
function snapshot(): Map<string, string> {
  const files = new Map<string, string>()
  for (const entry of readdirSync(folder, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const path = join(entry.parentPath, entry.name)
    files.set(
      relative(folder, path).split('\\').join('/'),
      createHash('sha1').update(readFileSync(path)).digest('hex'),
    )
  }
  return files
}

const fail = (message: string): never => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

if (!drizzleKit('check').includes("Everything's fine")) {
  fail('drizzle-kit check başarılı bitmedi (çıktıya bak).')
}
const before = snapshot()
const generated = drizzleKit('generate')
const changes = [...snapshot()]
  .filter(([file, hash]) => before.get(file) !== hash)
  .map(([file]) => file)

if (changes.length > 0) {
  fail(
    `Şemada migration'a dönüşmemiş değişiklik var; drizzle-kit şunları yazdı:\n${changes
      .map((file) => `  packages/db/drizzle/${file}`)
      .join('\n')}\n  Dosyaları incele ve commit'le (ya da şema değişikliğini geri al).`,
  )
}
if (!generated.includes('No schema changes')) {
  fail(
    'drizzle-kit generate boş fark bildirmedi (yeniden adlandırma sorusu ya da şema hatası olabilir). Yerelde `pnpm --filter @havayolu/db db:generate` çalıştır.',
  )
}
console.log("✓ Şema ve migration'lar tutarlı (drizzle-kit generate boş fark).")
