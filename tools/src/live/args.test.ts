import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  isPathInside,
  LiveArgsError,
  parseRecordArgs,
  parseSmokeArgs,
  RECORD_DEFAULTS,
  RECORD_LIMITS,
  RECORD_USAGE,
  SMOKE_USAGE,
} from './args'

const tempDir = mkdtempSync(join(tmpdir(), 'hy-live-args-'))
afterAll(() => rmSync(tempDir, { recursive: true, force: true }))

const bad =
  (...argv: string[]) =>
  () =>
    parseRecordArgs(argv, tempDir)

describe('parseRecordArgs', () => {
  it('varsayılanlar: 30 dk, 40 NM, çıktı yok, --confirm yok', () => {
    expect(parseRecordArgs(['--station', 'LTFM'], tempDir)).toEqual({
      kind: 'run',
      station: 'LTFM',
      minutes: 30,
      radiusNm: 40,
      out: null,
      fixture: false,
      confirm: false,
    })
    expect(RECORD_DEFAULTS).toEqual({ minutes: 30, radiusNm: 40 })
    expect(RECORD_LIMITS).toEqual({
      minMinutes: 1,
      maxMinutes: 60,
      minRadiusNm: 1,
      maxRadiusNm: 60,
    })
  })

  it("küçük harfli istasyon büyütülür; pnpm'in -- ayracı atlanır", () => {
    expect(parseRecordArgs(['--station', 'ltfm'], tempDir)).toMatchObject({ station: 'LTFM' })
    expect(parseRecordArgs(['--', '--station=ltfj', '--confirm'], tempDir)).toMatchObject({
      station: 'LTFJ',
      confirm: true,
    })
  })

  it('sınırlar dahil süre ve yarıçap', () => {
    expect(
      parseRecordArgs(['--station', 'LTFM', '--minutes', '1', '--radius', '60'], tempDir),
    ).toMatchObject({ minutes: 1, radiusNm: 60 })
    expect(
      parseRecordArgs(['--station', 'LTFM', '--minutes', '60', '--radius', '1'], tempDir),
    ).toMatchObject({ minutes: 60, radiusNm: 1 })
  })

  it('geçersiz süre, yarıçap ve istasyon reddedilir', () => {
    for (const minutes of ['0', '61', 'abc', '2.5', '-1', '', '1000']) {
      expect(bad('--station', 'LTFM', '--minutes', minutes)).toThrow(LiveArgsError)
    }
    expect(bad('--station', 'LTFM', '--minutes', '61')).toThrow(/--minutes 1–60/)
    for (const radius of ['0', '61', '40nm']) {
      expect(bad('--station', 'LTFM', '--radius', radius)).toThrow(/--radius 1–60/)
    }
    expect(bad()).toThrow(/--station zorunlu/)
    expect(bad('--station', ' ')).toThrow(/--station zorunlu/)
    for (const station of ['LTF', 'LTFMX', 'IST1', 'LT-M']) {
      expect(bad('--station', station)).toThrow(/4 harfli/)
    }
  })

  it('--out INIT_CWD dizinine göre mutlak yola çözülür ve .jsonl ile biter', () => {
    expect(parseRecordArgs(['--station', 'LTFM', '--out', 'kayit.jsonl'], tempDir)).toMatchObject({
      out: resolve(tempDir, 'kayit.jsonl'),
      fixture: false,
    })
    const absolute = join(tempDir, 'alt', 'K.JSONL')
    expect(parseRecordArgs(['--station', 'LTFM', '--out', absolute], tempDir).kind).toBe('run')
    expect(bad('--station', 'LTFM', '--out', 'kayit.json')).toThrow(/\.jsonl ile bitmeli/)
    expect(bad('--station', 'LTFM', '--out', ' ')).toThrow(/dosya yolu/)
  })

  it('--fixture tek başına; --out ile birlikte reddedilir', () => {
    expect(parseRecordArgs(['--station', 'LTFM', '--fixture'], tempDir)).toMatchObject({
      fixture: true,
      out: null,
    })
    expect(bad('--station', 'LTFM', '--fixture', '--out', 'a.jsonl')).toThrow(/birlikte/)
  })

  it('yardım; bilinmeyen bayrak ve konumsal argüman hata verir', () => {
    expect(parseRecordArgs(['--help'], tempDir)).toEqual({ kind: 'help' })
    expect(parseRecordArgs(['-h', '--station', 'LTFM'], tempDir)).toEqual({ kind: 'help' })
    expect(bad('--station', 'LTFM', '--hex', 'abc')).toThrow(/geçersiz argüman/)
    expect(bad('--station', 'LTFM', 'fazla')).toThrow(LiveArgsError)
    expect(bad('--station')).toThrow(LiveArgsError)
    for (const text of ['--station', '--minutes', '--radius', '--out', '--fixture', '--confirm']) {
      expect(RECORD_USAGE).toContain(text)
    }
    expect(RECORD_USAGE).toContain('DUR-SOR 6')
    expect(RECORD_USAGE).toContain('tools/recordings/tmp/ altı ya da repo dışı')
    expect(RECORD_USAGE).toContain('4 bekçi ihlali, beklenmeyen yanıt, dosya hatası ya da iç hata')
  })
})

describe('parseSmokeArgs', () => {
  it('yalnızca --confirm ve -h/--help', () => {
    expect(parseSmokeArgs([])).toEqual({ kind: 'run', confirm: false })
    expect(parseSmokeArgs(['--confirm'])).toEqual({ kind: 'run', confirm: true })
    expect(parseSmokeArgs(['--', '--confirm'])).toEqual({ kind: 'run', confirm: true })
    expect(parseSmokeArgs(['-h'])).toEqual({ kind: 'help' })
    expect(parseSmokeArgs(['--help', '--confirm'])).toEqual({ kind: 'help' })
    expect(() => parseSmokeArgs(['--minutes', '5'])).toThrow(LiveArgsError)
    expect(() => parseSmokeArgs(['--station', 'LTFM'])).toThrow(LiveArgsError)
    expect(() => parseSmokeArgs(['simdi'])).toThrow(LiveArgsError)
    expect(SMOKE_USAGE).toContain('--confirm')
    expect(SMOKE_USAGE).toContain('app_smoke_live')
    expect(SMOKE_USAGE).toContain('4 bekçi ihlali ya da iç hata')
  })
})

describe('isPathInside', () => {
  const fixtures = join(tempDir, 'tools', 'fixtures')

  it('alt yol ve dizinin kendisi içeride; kardeş ve üst dizin dışarıda', () => {
    expect(isPathInside(join(fixtures, 'replay', 'a.jsonl'), fixtures)).toBe(true)
    expect(isPathInside(fixtures, fixtures)).toBe(true)
    expect(isPathInside(join(fixtures, '..', 'recordings', 'a.jsonl'), fixtures)).toBe(false)
    expect(isPathInside(join(tempDir, 'tools', 'fixtures2', 'a.jsonl'), fixtures)).toBe(false)
    // ".." ile başlayan ama üst dizin olmayan klasör adı içeridedir.
    expect(isPathInside(join(fixtures, '..foo', 'a.jsonl'), fixtures)).toBe(true)
    expect(isPathInside(join(fixtures, 'x', '..', '..', 'a.jsonl'), fixtures)).toBe(false)
  })

  it("Windows'ta büyük/küçük harf duyarsız; diğer platformlarda duyarlı", () => {
    const upper = join(tempDir, 'TOOLS', 'Fixtures', 'replay', 'a.jsonl')
    expect(isPathInside(upper, fixtures, 'win32')).toBe(true)
    // Windows'un kendi yol modülü zaten harf duyarsızdır; duyarlılık yalnız POSIX'te denenir.
    if (process.platform !== 'win32') expect(isPathInside(upper, fixtures, 'linux')).toBe(false)
  })
})
