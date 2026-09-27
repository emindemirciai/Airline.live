// CHANGELOG.md'yi packages/shared/src/changelog/entries.ts kaynağından üretir.
// --check: dosyayı yazmaz; changelog geçerli mi, kök package.json sürümü en yeni kayıtla aynı mı
// ve CHANGELOG.md güncel mi diye bakar. Sorun varsa çıkış kodu 1'dir (CI'da çalışır).
// --release <sürüm>: o sürümün GitHub Release başlığını (ilk satır) ve notunu (TR + EN) yazdırır;
// dosya yazmaz (CI'daki github-release işi ve geçmiş sürümlerin release'leri kullanır).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  CHANGELOG,
  currentVersion,
  renderChangelogMarkdown,
  validateChangelog,
} from '../packages/shared/src/changelog/index.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

// Release notundaki bağlantılar mutlak olmalı (göreli yol GitHub'da çalışmaz). Alan adı koda
// gömülmez: site adresi WEB_URL'den (GitHub variable), repo adresi Actions ortamından gelir.
const siteUrl = process.env.WEB_URL?.replace(/\/$/, '')
const repoUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
    : null

const releaseIndex = process.argv.indexOf('--release')
if (releaseIndex >= 0) {
  const version = process.argv[releaseIndex + 1]
  const entry = CHANGELOG.find((e) => e.version === version)
  if (!entry) {
    console.error(`✗ Changelog'da v${version ?? '?'} yok.`)
    process.exit(1)
  }
  const lines = [`v${entry.version} — ${entry.title.tr} / ${entry.title.en}`, '']
  for (const [locale, heading] of [
    ['tr', 'Türkçe'],
    ['en', 'English'],
  ] as const) {
    lines.push(`## ${heading}`, `**${entry.title[locale]}**`, '')
    for (const item of entry.items) lines.push(`- ${item[locale]}`)
    if (entry.tryLinks?.length) {
      const label = locale === 'tr' ? 'Dene' : 'Try it'
      const links = entry.tryLinks.map((l) =>
        siteUrl ? `[${l.label[locale]}](${siteUrl}${l.path})` : `${l.label[locale]} (${l.path})`,
      )
      lines.push('', `${label}: ${links.join(' · ')}`)
    }
    lines.push('')
  }
  const all = repoUrl
    ? ` · Tüm sürümler / All releases: [CHANGELOG.md](${repoUrl}/blob/main/CHANGELOG.md)`
    : ''
  lines.push(`Tarih / Date: ${entry.date}${all}`)
  process.stdout.write(`${lines.join('\n')}\n`)
  process.exit(0)
}
const changelogPath = `${root}CHANGELOG.md`
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { version: string }
const check = process.argv.includes('--check')

const problems = validateChangelog(CHANGELOG)
const latest = currentVersion()
if (pkg.version !== latest) {
  problems.push(
    `Kök package.json sürümü (${pkg.version}) changelog'daki en yeni sürümle (${latest}) aynı değil.`,
  )
}

const markdown = `${renderChangelogMarkdown(CHANGELOG)}\n`

if (check) {
  let existing = ''
  try {
    existing = readFileSync(changelogPath, 'utf8')
  } catch {
    problems.push('CHANGELOG.md bulunamadı.')
  }
  if (existing && existing !== markdown)
    problems.push('CHANGELOG.md güncel değil; "pnpm changelog" çalıştır.')
} else if (problems.length === 0) {
  writeFileSync(changelogPath, markdown)
  console.log(`CHANGELOG.md yazıldı (v${latest}, ${CHANGELOG.length} sürüm).`)
}

if (problems.length > 0) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'))
  process.exit(1)
}
if (check) console.log(`✓ Changelog tutarlı (v${latest}).`)
