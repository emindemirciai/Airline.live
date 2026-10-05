import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { providerUserAgent } from '@havayolu/providers'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createRedactor,
  devEnvSource,
  findWorkspaceRoot,
  isLocalHostname,
  userAgentWebHost,
  workspaceVersion,
} from './env'
import { WORKSPACE_ROOT } from './test/adsblol-stub'

const tempDir = mkdtempSync(join(tmpdir(), 'hy-live-env-'))
afterAll(() => rmSync(tempDir, { recursive: true, force: true }))

function makeRoot(name: string, files: Record<string, string>): string {
  const root = join(tempDir, name)
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n')
  for (const [file, text] of Object.entries(files)) writeFileSync(join(root, file), text)
  return root
}

describe('devEnvSource', () => {
  const root = makeRoot('repo', {
    '.env.example': '# açıklama\nA=example\nB=example\nC=example\nEMPTY=\nHY_LIVE_TEST_ONLY=1\n',
    '.env': 'B=dotenv\nC=dotenv\n',
  })

  it('öncelik: süreç ortamı > .env > .env.example; process.env değişmez', () => {
    const source = devEnvSource(root, { C: 'process', D: 'process' })
    expect(source).toMatchObject({ A: 'example', B: 'dotenv', C: 'process', D: 'process' })
    expect(source.EMPTY).toBe('')
    expect(source.MISSING).toBeUndefined()
    expect(source.HY_LIVE_TEST_ONLY).toBe('1')
    expect(process.env.HY_LIVE_TEST_ONLY).toBeUndefined()
  })

  it('süreçte tanımlı boş değer de kazanır; tanımsız değer kazanmaz', () => {
    expect(devEnvSource(root, { B: '' }).B).toBe('')
    expect(devEnvSource(root, { B: undefined }).B).toBe('dotenv')
  })

  it('.env yoksa .env.example; kök yoksa yalnızca süreç ortamı', () => {
    const other = makeRoot('repo2', { '.env.example': 'A=example\n' })
    expect(devEnvSource(other, {}).A).toBe('example')
    expect(devEnvSource(null, { A: 'process' })).toEqual({ A: 'process' })
  })

  it('workspace kökü replay araçlarıyla aynı yolla bulunur', () => {
    mkdirSync(join(root, 'x', 'y'), { recursive: true })
    expect(findWorkspaceRoot(join(root, 'x', 'y'))).toBe(root)
  })
})

describe('workspaceVersion', () => {
  it('kök package.json sürümü', () => {
    expect(workspaceVersion(makeRoot('v', { 'package.json': '{"version":" 1.2.3 "}' }))).toBe(
      '1.2.3',
    )
    expect(workspaceVersion(WORKSPACE_ROOT)).toMatch(/^\d+\.\d+\.\d+/)
    expect(() => workspaceVersion(makeRoot('nov', { 'package.json': '{"name":"x"}' }))).toThrow(
      /sürüm/,
    )
  })
})

describe('isLocalHostname ve userAgentWebHost', () => {
  it('yalnızca geri döngü adları yereldir', () => {
    for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '::1', '[::1]']) {
      expect(isLocalHostname(host)).toBe(true)
    }
    for (const host of ['havayolu.live', '127.0.0.2', '0.0.0.0', 'localhost.example', '']) {
      expect(isLocalHostname(host)).toBe(false)
    }
  })

  it('yerel WEB_HOST düşer, genel host olduğu gibi kalır', () => {
    for (const host of ['localhost:3100', '127.0.0.1', '127.0.0.1:3100', '[::1]:3100', '::1']) {
      expect(userAgentWebHost(host)).toBeNull()
    }
    expect(userAgentWebHost('http://localhost:3100')).toBeNull()
    expect(userAgentWebHost(undefined)).toBeNull()
    expect(userAgentWebHost('  ')).toBeNull()
    expect(userAgentWebHost('havayolu.live')).toBe('havayolu.live')
    expect(userAgentWebHost(' havayolu.example:8443 ')).toBe('havayolu.example:8443')
  })

  it("UA: yerel WEB_HOST'ta (+mailto:…), genel host'ta (+https://…; …)", () => {
    const ua = (webHost: string) =>
      providerUserAgent({
        appName: 'havayolu',
        version: '0.0.0-test',
        webHost: userAgentWebHost(webHost),
        contactEmail: 'ops@example.org',
      })
    expect(ua('localhost:3100')).toBe('havayolu/0.0.0-test (+mailto:ops@example.org)')
    expect(ua('havayolu.example')).toBe(
      'havayolu/0.0.0-test (+https://havayolu.example; ops@example.org)',
    )
  })
})

describe('createRedactor', () => {
  it('dizi sırası [CONTACT_EMAIL, ADSBLOL_API_KEY]; harf duyarsız ve URL kodlu biçim', () => {
    const redact = createRedactor(['ops@example.org', 'k3y-SECRET'])
    expect(redact('UA (+mailto:ops@example.org) OPS@EXAMPLE.ORG ops%40example.org')).toBe(
      'UA (+mailto:<CONTACT_EMAIL>) <CONTACT_EMAIL> <CONTACT_EMAIL>',
    )
    expect(redact('x-api-key: k3y-secret')).toBe('x-api-key: <ADSBLOL_API_KEY>')
    expect(redact('temiz satır')).toBe('temiz satır')
  })

  it('boş ve tanımsız değerler atlanır; nesne biçiminde anahtar adı kullanılır', () => {
    expect(createRedactor([undefined, ''])('a b c')).toBe('a b c')
    expect(createRedactor(['', 'tok'])('tok')).toBe('<ADSBLOL_API_KEY>')
    expect(createRedactor({ SETUP_TOKEN: 'abc123' })('t=abc123')).toBe('t=<SETUP_TOKEN>')
    expect(createRedactor(['a@b.co', 'x', 'y'])('y')).toBe('<gizli>')
  })

  it('uzun değer önce maskelenir; düzenli ifade karakterleri kaçışlanır', () => {
    const redact = createRedactor(['first.last+tag@example.org', 'example'])
    expect(redact('first.last+tag@example.org / example')).toBe(
      '<CONTACT_EMAIL> / <ADSBLOL_API_KEY>',
    )
    expect(createRedactor(['a.b@c.d'])('aXb@c.d')).toBe('aXb@c.d')
  })
})
