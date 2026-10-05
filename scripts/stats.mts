// Satır sayısı: git'te izlenen dosyalar üzerinden. Hariç: lockfile, docs/research/ ve elle yazılmayan
// veri: commit'li fixture'lar (tools/fixtures CSV, JSON ve JSON Lines kayıtları, üçüncü taraf
// verisi) ve drizzle-kit'in ürettiği şema snapshot'ları (packages/db/drizzle/meta).
// Toplamı, alan (apps/*, packages/*, docs, …) ve dil bazında dağılımı yazar.
// --json: makine okunur çıktı; --markdown: README'ye yapıştırılabilir tablo.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const EXCLUDED = [
  /^pnpm-lock\.yaml$/,
  /^docs\/research\//,
  /^tools\/fixtures\/.*\.(csv|json|jsonl)$/,
  /^packages\/db\/drizzle\/meta\//,
]
const LANGUAGES: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript (TSX)',
  '.mts': 'TypeScript',
  '.mjs': 'JavaScript',
  '.js': 'JavaScript',
  '.css': 'CSS',
  '.md': 'Markdown',
  '.json': 'JSON',
  '.yml': 'YAML',
  '.yaml': 'YAML',
}

const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter((f) => f && !EXCLUDED.some((re) => re.test(f)))

function area(file: string): string {
  const [first, second] = file.split('/')
  if ((first === 'apps' || first === 'packages') && second) return `${first}/${second}`
  if (
    first === 'docs' ||
    first === 'scripts' ||
    first === 'tools' ||
    first === '.github' ||
    first === '.claude'
  )
    return first
  return '(kök)'
}

let total = 0
let codeTotal = 0
const byArea = new Map<string, number>()
const byLanguage = new Map<string, number>()
for (const file of files) {
  let content: string
  try {
    content = readFileSync(`${root}${file}`, 'utf8')
  } catch {
    continue
  }
  const lines =
    content.length === 0 ? 0 : content.split('\n').length - (content.endsWith('\n') ? 1 : 0)
  const language = LANGUAGES[extname(file)] ?? 'Diğer'
  total += lines
  if (!['Markdown', 'JSON', 'YAML', 'Diğer'].includes(language)) codeTotal += lines
  byArea.set(area(file), (byArea.get(area(file)) ?? 0) + lines)
  byLanguage.set(language, (byLanguage.get(language) ?? 0) + lines)
}

const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])
const fmt = (n: number) => n.toLocaleString('tr-TR')

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        files: files.length,
        total,
        code: codeTotal,
        byArea: Object.fromEntries(sorted(byArea)),
        byLanguage: Object.fromEntries(sorted(byLanguage)),
      },
      null,
      2,
    ),
  )
} else if (process.argv.includes('--markdown')) {
  console.log(
    `| Alan | Satır |\n|---|---|\n${sorted(byArea)
      .map(([k, v]) => `| ${k} | ${fmt(v)} |`)
      .join('\n')}\n| **Toplam** | **${fmt(total)}** |`,
  )
} else {
  console.log(
    `Dosya: ${fmt(files.length)} · Toplam satır: ${fmt(total)} · Kod satırı: ${fmt(codeTotal)}`,
  )
  console.log('\nAlan bazında:')
  for (const [k, v] of sorted(byArea)) console.log(`  ${k.padEnd(22)} ${fmt(v).padStart(8)}`)
  console.log('\nDil bazında:')
  for (const [k, v] of sorted(byLanguage)) console.log(`  ${k.padEnd(22)} ${fmt(v).padStart(8)}`)
}
