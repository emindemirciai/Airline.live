// Geri alma kapısının testleri (D-115): saf karar ve geçici bir git deposundan hedef okuma. Ağ yok.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  compareVersions,
  decideRollback,
  LIVE_GATE_FILES,
  LIVE_GATE_MIN_VERSION,
  parseAllow,
  parseVersion,
  readRollbackTarget,
} from './rollback-guard.mts'

const ALL_FILES: readonly string[] = []

describe('sürüm karşılaştırma', () => {
  it('yalnız X.Y.Z okunur', () => {
    expect(parseVersion('0.28.0')).toEqual([0, 28, 0])
    expect(parseVersion(' 1.2.3 ')).toEqual([1, 2, 3])
    expect(parseVersion('0.28')).toBeNull()
    expect(parseVersion('0.28.0-rc.1')).toBeNull()
    expect(parseVersion('v0.28.0')).toBeNull()
    expect(parseVersion('')).toBeNull()
  })

  it('sayısal karşılaştırır (0.9.0 < 0.28.0 < 1.0.0)', () => {
    const v = (text: string) => parseVersion(text) ?? [0, 0, 0]
    expect(compareVersions(v('0.9.0'), v('0.28.0'))).toBeLessThan(0)
    expect(compareVersions(v('0.27.9'), v('0.28.0'))).toBeLessThan(0)
    expect(compareVersions(v('0.28.0'), v('0.28.0'))).toBe(0)
    expect(compareVersions(v('0.28.1'), v('0.28.0'))).toBeGreaterThan(0)
    expect(compareVersions(v('1.0.0'), v('0.28.0'))).toBeGreaterThan(0)
  })
})

describe('decideRollback', () => {
  it('eşikteki ve sonraki sürümler girdisiz kabul edilir', () => {
    for (const version of ['0.28.0', '0.28.3', '0.29.0', '1.0.0']) {
      const decision = decideRollback({ version, missingFiles: ALL_FILES }, false)
      expect(decision, version).toMatchObject({ ok: true, level: 'notice' })
    }
  })

  it('eşiğin altındaki sürüm girdisiz reddedilir; mesaj CONTACT_EMAIL adımını söyler', () => {
    const decision = decideRollback({ version: '0.27.0', missingFiles: ALL_FILES }, false)
    expect(decision.ok).toBe(false)
    expect(decision.level).toBe('error')
    expect(decision.message).toContain('v0.27.0')
    expect(decision.message).toContain(`v${LIVE_GATE_MIN_VERSION}`)
    expect(decision.message).toContain('CONTACT_EMAIL')
    expect(decision.message).toContain('allow_pre_live_gate=true')
  })

  it('okunamayan sürüm kapalı varsayımla reddedilir', () => {
    expect(decideRollback({ version: null, missingFiles: ALL_FILES }, false).ok).toBe(false)
    expect(decideRollback({ version: 'abc', missingFiles: ALL_FILES }, false).ok).toBe(false)
  })

  it('sürüm eşiği geçse de süzgeç dosyaları yoksa reddedilir (sürüm numarası kayarsa)', () => {
    const decision = decideRollback(
      { version: '0.28.0', missingFiles: ['packages/providers/src/live-scope.ts'] },
      false,
    )
    expect(decision.ok).toBe(false)
    expect(decision.message).toContain('packages/providers/src/live-scope.ts')
  })

  it('allow_pre_live_gate ile eski hedef uyarıyla kabul edilir', () => {
    const decision = decideRollback({ version: '0.25.2', missingFiles: [...LIVE_GATE_FILES] }, true)
    expect(decision).toMatchObject({ ok: true, level: 'warning' })
    expect(decision.message).toContain('CONTACT_EMAIL boş kalmalı')
  })

  it('geçersiz eşik hata verir', () => {
    expect(() =>
      decideRollback({ version: '0.28.0', missingFiles: ALL_FILES }, false, 'x'),
    ).toThrow('geçersiz eşik')
  })
})

describe('parseAllow', () => {
  it('yalnız "true" izin verir', () => {
    expect(parseAllow('true')).toBe(true)
    expect(parseAllow(' true ')).toBe(true)
    for (const value of [undefined, '', 'false', 'TRUE', '1', 'yes']) {
      expect(parseAllow(value), String(value)).toBe(false)
    }
  })
})

describe('bu depo', () => {
  it('süzgeç dosyaları yerinde ve kök sürüm eşiği geçiyor (kendi kapısından geçer)', () => {
    for (const path of LIVE_GATE_FILES) expect(existsSync(path), path).toBe(true)
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
    const decision = decideRollback({ version, missingFiles: [] }, false)
    expect(decision.ok).toBe(true)
  })
})

describe('readRollbackTarget (geçici git deposu)', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  function repo() {
    const work = mkdtempSync(join(tmpdir(), 'hy-rollback-'))
    dirs.push(work)
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: work, encoding: 'utf8' }).trim()
    git('init', '--initial-branch=main')
    git('config', 'user.name', 'test')
    git('config', 'user.email', 'test@example.test')
    git('config', 'core.autocrlf', 'false')
    const commit = (files: Record<string, string>) => {
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(work, path)), { recursive: true })
        writeFileSync(join(work, path), text)
        git('add', path)
      }
      git('commit', '-q', '-m', 'edit')
      return git('rev-parse', 'HEAD')
    }
    return { work, commit }
  }

  it('eski commit: sürüm ve eksik dosyalar; yeni commit: hepsi var', () => {
    const { work, commit } = repo()
    const old = commit({ 'package.json': JSON.stringify({ version: '0.27.0' }) })
    const gated = commit({
      'package.json': JSON.stringify({ version: '0.28.0' }),
      ...Object.fromEntries(LIVE_GATE_FILES.map((path) => [path, 'export {}\n'])),
    })

    const before = readRollbackTarget(old.slice(0, 7), work)
    expect(before).toEqual({ version: '0.27.0', missingFiles: [...LIVE_GATE_FILES] })
    expect(decideRollback(before, false).ok).toBe(false)

    const after = readRollbackTarget(gated, work)
    expect(after).toEqual({ version: '0.28.0', missingFiles: [] })
    expect(decideRollback(after, false).ok).toBe(true)
  })

  it('bilinmeyen commit ve bozuk package.json okunamaz sayılır', () => {
    const { work, commit } = repo()
    const broken = commit({ 'package.json': '{ bozuk' })
    expect(readRollbackTarget(broken, work).version).toBeNull()
    const unknown = readRollbackTarget('deadbee', work)
    expect(unknown.version).toBeNull()
    expect(unknown.missingFiles).toEqual([...LIVE_GATE_FILES])
  })
})
