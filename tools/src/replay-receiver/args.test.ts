import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createReplaySource,
  describeReplaySource,
  parseReplayArgs,
  REPLAY_USAGE,
  ReplayArgsError,
} from './args'
import { devEnvValue, findWorkspaceRoot } from './env'

const T0 = Date.UTC(2026, 8, 28, 9, 0, 0)
const tempDir = mkdtempSync(join(tmpdir(), 'hy-replay-args-'))
afterAll(() => rmSync(tempDir, { recursive: true, force: true }))

describe('parseReplayArgs', () => {
  it('varsayılan cruise senaryosu', () => {
    expect(parseReplayArgs([])).toEqual({ kind: 'scenario', name: 'cruise' })
    expect(parseReplayArgs(['--scenario', 'cruise', '--count', '3'])).toEqual({
      kind: 'scenario',
      name: 'cruise',
      count: 3,
    })
    expect(parseReplayArgs(['--count=0'])).toEqual({ kind: 'scenario', name: 'cruise', count: 0 })
  })

  it("kayıt; pnpm'in -- ayracı atlanır", () => {
    expect(parseReplayArgs(['--', '--recording', 'kayit.json'])).toEqual({
      kind: 'recording',
      path: 'kayit.json',
    })
  })

  it('yardım', () => {
    expect(parseReplayArgs(['--help'])).toEqual({ kind: 'help' })
    expect(parseReplayArgs(['-h'])).toEqual({ kind: 'help' })
    expect(REPLAY_USAGE).toContain('--recording')
    expect(REPLAY_USAGE).toContain('cruise')
  })

  it('hatalı argümanlar ReplayArgsError verir', () => {
    const bad =
      (...argv: string[]) =>
      () =>
        parseReplayArgs(argv)
    expect(bad('--bilinmeyen')).toThrow(ReplayArgsError)
    expect(bad('konum')).toThrow(ReplayArgsError)
    expect(bad('--scenario', 'storm')).toThrow(/bilinmeyen senaryo: storm/)
    expect(bad('--recording', 'a.json', '--count', '2')).toThrow(/birlikte/)
    expect(bad('--recording', 'a.json', '--scenario', 'cruise')).toThrow(/birlikte/)
    expect(bad('--recording', ' ')).toThrow(/dosya yolu/)
    expect(bad('--count', '-1')).toThrow(ReplayArgsError)
    expect(bad('--count', 'abc')).toThrow(/tam sayı/)
    expect(bad('--count', '2.5')).toThrow(/tam sayı/)
  })
})

describe('createReplaySource ve describeReplaySource', () => {
  it('senaryo, uçak sayısıyla', () => {
    const source = createReplaySource({ kind: 'scenario', name: 'cruise', count: 3 })
    expect('frameAt' in source && source.frameAt(T0).aircraft).toHaveLength(5)
    expect(describeReplaySource(source, T0)).toBe('senaryo cruise, 5 uçak')
    expect(() => createReplaySource({ kind: 'scenario', name: 'cruise', count: 500 })).toThrow(
      RangeError,
    )
  })

  it('göreli kayıt yolu verilen dizine göre çözülür', () => {
    writeFileSync(join(tempDir, 'kayit.json'), JSON.stringify({ now: 1000, aircraft: [] }))
    const source = createReplaySource({ kind: 'recording', path: 'kayit.json' }, tempDir)
    expect(source).toEqual({ frames: [{ now: 1000, aircraft: [] }] })
    expect(describeReplaySource(source, T0)).toBe('kayıt, 1 kare')
  })
})

describe('geliştirme ortamı okuması', () => {
  const root = join(tempDir, 'repo')
  mkdirSync(join(root, 'a', 'b'), { recursive: true })
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n')
  writeFileSync(join(root, '.env'), 'APP_ENV=test\n')
  writeFileSync(
    join(root, '.env.example'),
    '# açıklama\nAPP_ENV=development\nREPLAY_RECEIVER_PORT=4300\nEMPTY=\nHY_REPLAY_TEST_ONLY=1\n',
  )

  it('workspace kökü yukarı doğru aranır', () => {
    expect(findWorkspaceRoot(join(root, 'a', 'b'))).toBe(root)
    const here = fileURLToPath(new URL('.', import.meta.url))
    expect(findWorkspaceRoot(here)).toBe(
      resolve(fileURLToPath(new URL('../../../', import.meta.url))),
    )
  })

  it('öncelik: süreç ortamı > .env > .env.example; process.env değişmez', () => {
    expect(devEnvValue('APP_ENV', root, {})).toBe('test')
    expect(devEnvValue('APP_ENV', root, { APP_ENV: 'production' })).toBe('production')
    // Süreçte tanımlı boş değer de kazanır (worker'ın yüklemesi gibi).
    expect(devEnvValue('APP_ENV', root, { APP_ENV: '' })).toBe('')
    expect(devEnvValue('REPLAY_RECEIVER_PORT', root, {})).toBe('4300')
    expect(devEnvValue('EMPTY', root, {})).toBe('')
    expect(devEnvValue('MISSING', root, {})).toBeUndefined()
    expect(devEnvValue('APP_ENV', null, {})).toBeUndefined()
    expect(devEnvValue('HY_REPLAY_TEST_ONLY', root, {})).toBe('1')
    expect(process.env.HY_REPLAY_TEST_ONLY).toBeUndefined()
  })

  it('.env yoksa .env.example okunur', () => {
    const other = join(tempDir, 'repo2')
    mkdirSync(other, { recursive: true })
    writeFileSync(join(other, '.env.example'), 'APP_ENV=development\n')
    expect(devEnvValue('APP_ENV', other, {})).toBe('development')
  })
})
