// CHANGELOG.md üreticisinin ve GitHub Release notunun testleri (D-067, D-091). Ağ yok; CLI yerel
// tsx ile çalıştırılır ve dosya yazmaz (--check, --release).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CHANGELOG,
  renderChangelogMarkdown,
  type ChangelogEntry,
} from '../packages/shared/src/changelog/index.ts'
import { releaseNotes } from './changelog.mts'

const root = fileURLToPath(new URL('..', import.meta.url))

const UNRELEASED: ChangelogEntry = {
  version: '0.17.0',
  date: '2026-10-04',
  title: { tr: 'Başlık', en: 'Title' },
  items: [{ tr: 'Madde', en: 'Item' }],
  tryLinks: [{ path: '/havalimanlari', label: { tr: 'Havalimanları', en: 'Airports' } }],
}
const ENTRY: ChangelogEntry = { ...UNRELEASED, releasedAt: '2026-10-04T17:27:12Z' }

/** `tsx scripts/changelog.mts <args>`; ortamdan WEB_URL ve GitHub değişkenleri silinir. */
function runCli(args: string[]): string {
  const env = { ...process.env }
  for (const key of ['WEB_URL', 'GITHUB_SERVER_URL', 'GITHUB_REPOSITORY']) delete env[key]
  return execFileSync(process.execPath, ['--import', 'tsx', 'scripts/changelog.mts', ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

describe('CHANGELOG.md', () => {
  it('commit’li dosya kaynağından üretilmiş hâliyle aynıdır', () => {
    const onDisk = readFileSync(`${root}CHANGELOG.md`, 'utf8')
    expect(onDisk).toBe(`${renderChangelogMarkdown(CHANGELOG)}\n`)
  })

  it('başlık yayın anı varsa İstanbul saatini ve UTC farkını taşır, yoksa yalnızca günü', () => {
    const onDisk = readFileSync(`${root}CHANGELOG.md`, 'utf8')
    expect(onDisk).toContain('\n## v0.17.0 — 2026-10-04 20:27 (UTC+3)\n')
    expect(onDisk).toContain('\n## v0.11.0 — 2026-10-02 02:17 (UTC+3)\n')
    expect(onDisk).toContain('\n## v0.1.0 — 2026-09-25 18:07 (UTC+3)\n')
    const headings = onDisk.split('\n').filter((line) => line.startsWith('## v'))
    expect(headings).toHaveLength(CHANGELOG.length)
    for (const heading of headings) {
      expect(heading).toMatch(/^## v\d+\.\d+\.\d+ — \d{4}-\d{2}-\d{2}( \d{2}:\d{2} \(UTC\+3\))?$/)
    }
    expect(renderChangelogMarkdown([{ ...UNRELEASED, version: '0.18.0' }])).toContain(
      '\n## v0.18.0 — 2026-10-04\n',
    )
  })

  it('--check geçer (sürüm, geçerlilik, dosya güncel)', () => {
    expect(runCli(['--check'])).toMatch(/✓ Changelog tutarlı/)
  })
})

describe('GitHub Release notu', () => {
  it('başlık satırı değişmez; tarih satırı yayın anı varsa saati taşır', () => {
    const text = releaseNotes(ENTRY, { siteUrl: 'https://site.test', repoUrl: null })
    const lines = text.split('\n')
    expect(lines[0]).toBe('v0.17.0 — Başlık / Title')
    expect(lines[1]).toBe('')
    expect(text).toContain('Dene: [Havalimanları](https://site.test/havalimanlari)')
    expect(text).toContain('Try it: [Airports](https://site.test/havalimanlari)')
    expect(text.endsWith('Tarih / Date: 2026-10-04 20:27 (UTC+3)\n')).toBe(true)
  })

  it('yayın anı yoksa yalnızca gün; repo adresi varsa CHANGELOG.md bağlantısı', () => {
    const text = releaseNotes(UNRELEASED, { siteUrl: null, repoUrl: 'https://github.test/o/r' })
    expect(text).toContain('Dene: Havalimanları (/havalimanlari)')
    expect(
      text.endsWith(
        'Tarih / Date: 2026-10-04 · Tüm sürümler / All releases: [CHANGELOG.md](https://github.test/o/r/blob/main/CHANGELOG.md)\n',
      ),
    ).toBe(true)
  })

  it('--release <sürüm> notu yazdırır; bilinmeyen sürüm hata verir', () => {
    const out = runCli(['--release', '0.17.0'])
    expect(out.split('\n')[0]).toMatch(/^v0\.17\.0 — /)
    expect(out).toContain('Tarih / Date: 2026-10-04 20:27 (UTC+3)')
    expect(() => runCli(['--release', '9.9.9'])).toThrow()
  })
})
