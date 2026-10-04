// Deploy script'inin stub testleri: sahte Dokploy + sahte /version ve /ready sunucusu (yerel HTTP),
// sahte saat (bekleme anında geçer), sahte git gönderimi (dal tetiği). Canlı servise istek atılmaz.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  appVersion,
  deployRequestBody,
  gitPushDeployCommit,
  isNonDeployPath,
  planFromEnv,
  runDeploy,
  shaMatches,
  type Clock,
  type DeployConfig,
  type DeployDeps,
  type Deployment,
} from './deploy-dokploy.mts'

const NEW_SHA = '1234567890abcdef1234567890abcdef12345678'
const OLD_SHA = 'abcdefabcdefabcdefabcdefabcdefabcdefabcd'
const TOKEN = 'test-token-degeri'

interface Scenario {
  /** compose.deploy'dan kaç liste sorgusu sonra yeni deployment görünür (kuyruk süresi). */
  appearAfterPolls: number
  /** Yeni deployment'ın sırayla alacağı durumlar; son durum kalıcıdır. */
  statuses: string[]
  /** Deployment "done" olduktan kaç /version sorgusu sonra yeni SHA döner (Infinity = hiç). */
  shaAfterProbes: number
  readyStatus: number
  /** compose.deploy'dan sonraki ilk N liste sorgusu bu durumla yanıtlanır (geçici hata). */
  listErrorAfterDeploy?: { status: number; count: number }
}

interface Recorded {
  method: string
  path: string
  headers: IncomingMessage['headers']
  body: string
}

class FakeClock implements Clock {
  current = 0
  now() {
    return this.current
  }
  async sleep(ms: number) {
    this.current += ms
  }
}

const servers: Server[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))))
})

async function startStub(scenario: Scenario) {
  const requests: Recorded[] = []
  const existing: Deployment[] = [
    { deploymentId: 'eski-1', status: 'done', title: 'önceki', createdAt: '2026-09-25T10:00:00Z' },
  ]
  let deployed = false
  let listCallsSinceDeploy = 0
  let pollsShowingNew = 0
  let doneServed = false
  let probesAfterDone = 0

  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk: Buffer) => (body += chunk.toString()))
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://stub')
      requests.push({ method: req.method ?? '', path: url.pathname, headers: req.headers, body })
      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(payload))
      }
      if (url.pathname.startsWith('/api/deployment.') || url.pathname === '/api/compose.deploy') {
        if (req.headers['x-api-key'] !== TOKEN) return json(401, { message: 'Unauthorized' })
      }
      if (url.pathname === '/api/deployment.allByCompose') {
        if (!deployed) return json(200, existing)
        listCallsSinceDeploy += 1
        const failure = scenario.listErrorAfterDeploy
        if (failure && listCallsSinceDeploy <= failure.count) {
          return json(failure.status, { message: 'geçici' })
        }
        if (listCallsSinceDeploy <= scenario.appearAfterPolls) return json(200, existing)
        const status = scenario.statuses[Math.min(pollsShowingNew, scenario.statuses.length - 1)]
        pollsShowingNew += 1
        if (status === 'done') doneServed = true
        return json(200, [
          { deploymentId: 'yeni-1', status, title: 'commit mesajı', errorMessage: null },
          ...existing,
        ])
      }
      if (url.pathname === '/api/compose.deploy' && req.method === 'POST') {
        deployed = true
        return json(200, { success: true, message: 'Deployment queued', composeId: 'cmp-1' })
      }
      if (url.pathname === '/version' || url.pathname === '/api/version') {
        if (url.pathname === '/version' && doneServed) probesAfterDone += 1
        const gitSha = doneServed && probesAfterDone > scenario.shaAfterProbes ? NEW_SHA : OLD_SHA
        return json(200, { app: 'havayolu', version: '0.4.0', gitSha })
      }
      if (url.pathname === '/ready') return json(scenario.readyStatus, { status: 'x' })
      return json(404, { message: 'yok' })
    })
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  // Dal tetiği: Dokploy Autodeploy'u taklit eder (yayın hemen biter, SHA sonra döner).
  const autodeploy = () => {
    deployed = true
    doneServed = true
  }
  return { base: `http://127.0.0.1:${port}`, requests, autodeploy }
}

function configFor(base: string, overrides: Partial<DeployConfig> = {}): DeployConfig {
  return {
    trigger: 'api',
    deployBranch: 'release',
    dokployUrl: base,
    apiToken: TOKEN,
    composeId: 'cmp-1',
    apiUrl: base,
    webUrl: base,
    expectedSha: NEW_SHA,
    title: 'gh-1234567-99',
    skipUnchanged: false,
    pollIntervalMs: 10_000,
    deployTimeoutMs: 15 * 60_000,
    verifyTimeoutMs: 15 * 60_000,
    ...overrides,
  }
}

interface Push {
  branch: string
  sha: string
  message: string
}

async function deploy(
  scenario: Scenario,
  overrides: Partial<DeployConfig> = {},
  changedFiles: DeployDeps['changedFiles'] = () => ['apps/api/src/app.ts'],
  push: 'ok' | 'fail' = 'ok',
) {
  const stub = await startStub(scenario)
  const clock = new FakeClock()
  const lines: string[] = []
  const pushes: Push[] = []
  const result = await runDeploy(configFor(stub.base, overrides), {
    fetch: globalThis.fetch,
    clock,
    log: (line) => lines.push(line),
    changedFiles,
    pushDeployCommit: (branch, sha, message) => {
      if (push === 'fail') throw new Error('rejected (fetch first)')
      pushes.push({ branch, sha, message })
      stub.autodeploy()
      return 'feedfacefeedfacefeedfacefeedfacefeedface'
    },
  })
  const posts = stub.requests.filter((r) => r.method === 'POST')
  return { result, requests: stub.requests, posts, clock, lines, pushes }
}

const happy: Scenario = {
  appearAfterPolls: 0,
  statuses: ['running', 'running', 'done'],
  shaAfterProbes: 2,
  readyStatus: 200,
}

describe('deploy-dokploy', () => {
  it('başarılı yayında 0 döner; compose.deploy gövdesi yalnızca composeId ve title taşır', async () => {
    const { result, requests, posts, lines } = await deploy(happy)
    expect(result.ok).toBe(true)
    expect(result.summary).toMatch(/^YAYINLANDI: 1234567/)
    expect(posts.map((r) => r.path)).toEqual(['/api/compose.deploy'])
    for (const post of posts) {
      expect(JSON.parse(post.body)).toEqual({ composeId: 'cmp-1', title: 'gh-1234567-99' })
      expect(post.body).not.toContain('freshVolumes')
      expect(post.headers['x-api-key']).toBe(TOKEN)
    }
    expect(requests.some((r) => r.path === '/api/compose.redeploy')).toBe(false)
    expect(lines.join('\n')).not.toContain(TOKEN)
  })

  it('freshVolumes hiçbir yapılandırmayla gövdeye girmez', () => {
    const body = deployRequestBody({ composeId: 'c', title: 't', freshVolumes: true } as never)
    expect(JSON.parse(body)).toEqual({ composeId: 'c', title: 't' })
    expect(body).not.toContain('freshVolumes')
  })

  it('kuyrukta bekleme süresine izin verir (yeni kayıt geç görünse de başarılı)', async () => {
    const { result } = await deploy({ ...happy, appearAfterPolls: 12 })
    expect(result.ok).toBe(true)
  })

  it('beklerken gelen geçici Dokploy hataları (502, 429) yayını düşürmez', async () => {
    for (const status of [502, 429]) {
      const { result, lines } = await deploy({
        ...happy,
        listErrorAfterDeploy: { status, count: 3 },
      })
      expect(result.ok, `HTTP ${status}`).toBe(true)
      expect(lines.join('\n')).toMatch(/geçici hata, bekleniyor/)
    }
  })

  it('geçici hata 15 dk sürerse → 1 ve son hata yazılır', async () => {
    const { result } = await deploy({
      ...happy,
      listErrorAfterDeploy: { status: 502, count: Number.POSITIVE_INFINITY },
    })
    expect(result.ok).toBe(false)
    expect(result.summary).toMatch(/15 dk içinde bitmedi.*HTTP 502/)
  })

  it('beklerken yetki hatası (403) hemen → 1', async () => {
    const { result, clock } = await deploy({
      ...happy,
      listErrorAfterDeploy: { status: 403, count: Number.POSITIVE_INFINITY },
    })
    expect(result.ok).toBe(false)
    expect(result.summary).toMatch(/HTTP 403/)
    expect(clock.current).toBe(0)
  })

  it('deployment error → 1', async () => {
    const { result } = await deploy({ ...happy, statuses: ['running', 'error'] })
    expect(result.ok).toBe(false)
    expect(result.summary).toMatch(/deployment error/)
  })

  it('deployment cancelled → 1', async () => {
    const { result } = await deploy({ ...happy, statuses: ['cancelled'] })
    expect(result.ok).toBe(false)
    expect(result.summary).toMatch(/cancelled/)
  })

  it('yeni deployment 15 dk içinde görünmezse → 1', async () => {
    const { result, clock } = await deploy({ ...happy, appearAfterPolls: Number.POSITIVE_INFINITY })
    expect(result.ok).toBe(false)
    expect(result.summary).toMatch(/15 dk içinde bitmedi/)
    expect(clock.current).toBeGreaterThanOrEqual(15 * 60_000)
  })

  it('/version 15 dk boyunca eski SHA döndürürse → 1', async () => {
    const { result, clock } = await deploy({ ...happy, shaAfterProbes: Number.POSITIVE_INFINITY })
    expect(result.ok).toBe(false)
    expect(result.summary).toMatch(/doğrulanamadı.*eski SHA abcdefa/)
    expect(clock.current).toBeGreaterThanOrEqual(15 * 60_000)
  })

  it('/ready 503 kalırsa → 1', async () => {
    const { result } = await deploy({ ...happy, readyStatus: 503 })
    expect(result.ok).toBe(false)
    expect(result.summary).toMatch(/API \/ready: HTTP 503/)
  })

  it('Dokploy yetkisiz (401) → 1 ve anahtar hiçbir çıktıya yazılmaz', async () => {
    const { result, lines } = await deploy(happy, { apiToken: 'yanlis-anahtar' })
    expect(result.ok).toBe(false)
    expect(result.summary).toMatch(/HTTP 401/)
    expect(`${result.summary}\n${lines.join('\n')}`).not.toContain('yanlis-anahtar')
  })
})

describe('dal tetiği (Dokploy Autodeploy, D-070)', () => {
  const branch = { trigger: 'branch' as const, title: 'deploy 1234567 (run 99)' }

  it("release dalına yayın commit'i gönderir, Dokploy API'sine istek atmaz ve sürümü doğrular", async () => {
    const { result, requests, pushes, lines } = await deploy(happy, branch)
    expect(result.ok).toBe(true)
    expect(result.summary).toMatch(/^YAYINLANDI: 1234567 .*release dalı → Autodeploy/)
    expect(pushes).toEqual([
      { branch: 'release', sha: NEW_SHA, message: 'deploy 1234567 (run 99)' },
    ])
    expect(
      requests.some(
        (r) => r.path.startsWith('/api/deployment') || r.path.startsWith('/api/compose'),
      ),
    ).toBe(false)
    expect(lines.join('\n')).toMatch(/release ← feedfac/)
  })

  it('gönderim başarısızsa → 1 ve doğrulama beklenmez', async () => {
    const { result, clock } = await deploy(happy, branch, undefined, 'fail')
    expect(result.ok).toBe(false)
    expect(result.summary).toMatch(/release dalına yayın commit'i gönderilemedi: rejected/)
    expect(clock.current).toBe(0)
  })

  it('Autodeploy yeni sürümü 15 dk içinde açmazsa → 1', async () => {
    const { result } = await deploy({ ...happy, shaAfterProbes: Number.POSITIVE_INFINITY }, branch)
    expect(result.ok).toBe(false)
    expect(result.summary).toMatch(/doğrulanamadı.*eski SHA abcdefa/)
  })

  it('yalnızca belge değiştiyse dala hiçbir şey gönderilmez', async () => {
    const { result, pushes } = await deploy(happy, { ...branch, skipUnchanged: true }, () => [
      'docs/DECISIONS.md',
    ])
    expect(result.summary).toMatch(/^YAYIN GEREKMEDİ/)
    expect(pushes).toEqual([])
  })
})

describe('canlı sürüme göre yayın kararı (skipUnchanged)', () => {
  const docsOnly = () => ['docs/plans/parca-1.md', 'apps/mobile/app.json']

  it('canlıdan bu yana yalnızca belge/mobil değiştiyse Dokploy tetiklenmez', async () => {
    const { result, posts } = await deploy(happy, { skipUnchanged: true }, docsOnly)
    expect(result.ok).toBe(true)
    expect(result.summary).toMatch(/^YAYIN GEREKMEDİ: canlıdaki abcdefa/)
    expect(posts).toEqual([])
  })

  it('kod değiştiyse yayın yapılır', async () => {
    const { result, posts } = await deploy(happy, { skipUnchanged: true }, () => [
      'docs/x.md',
      'docker-compose.yml',
    ])
    expect(result.ok).toBe(true)
    expect(result.summary).toMatch(/^YAYINLANDI/)
    expect(posts).toHaveLength(1)
  })

  it('fark bilinmiyorsa (git hatası) yayın yapılır', async () => {
    const { result, posts } = await deploy(happy, { skipUnchanged: true }, () => null)
    expect(result.summary).toMatch(/^YAYINLANDI/)
    expect(posts).toHaveLength(1)
  })

  it('bu commit zaten canlıdaysa yayın gerekmez', async () => {
    const { result, posts } = await deploy(happy, { skipUnchanged: true, expectedSha: OLD_SHA })
    expect(result.summary).toMatch(/^YAYIN GEREKMEDİ: abcdefa zaten canlıda/)
    expect(posts).toEqual([])
  })

  it('skipUnchanged kapalıyken (rollback) her zaman yayın yapılır', async () => {
    const { result, posts } = await deploy(happy, { skipUnchanged: false }, docsOnly)
    expect(result.summary).toMatch(/^YAYINLANDI/)
    expect(posts).toHaveLength(1)
  })
})

describe('yardımcılar', () => {
  it('shaMatches: tam SHA, kısa SHA (rollback) ve eşleşmeyenler', () => {
    expect(shaMatches(NEW_SHA, NEW_SHA)).toBe(true)
    expect(shaMatches(NEW_SHA, '1234567')).toBe(true)
    expect(shaMatches(NEW_SHA.toUpperCase(), NEW_SHA)).toBe(true)
    expect(shaMatches(OLD_SHA, NEW_SHA)).toBe(false)
    expect(shaMatches('123456', NEW_SHA)).toBe(false)
    expect(shaMatches('dev', NEW_SHA)).toBe(false)
    expect(shaMatches(undefined, NEW_SHA)).toBe(false)
  })

  it('isNonDeployPath: yalnızca docs/ ve apps/mobile/', () => {
    expect(isNonDeployPath('docs/DEPLOY_DOKPLOY.md')).toBe(true)
    expect(isNonDeployPath('apps/mobile/app.json')).toBe(true)
    expect(isNonDeployPath('README.md')).toBe(false)
    expect(isNonDeployPath('deploy/dokploy.env.example')).toBe(false)
    expect(isNonDeployPath('apps/web/src/app/layout.tsx')).toBe(false)
  })
})

describe('planFromEnv', () => {
  const branchMode = {
    DEPLOY_ENABLED: 'true',
    API_URL: 'https://api.example.test',
    WEB_URL: 'https://example.test',
    EXPECTED_SHA: NEW_SHA,
    GITHUB_RUN_ID: '42',
  }

  it('varsayılan tetik dal: Dokploy sırrı gerekmez, dal release, başlık İngilizce commit mesajı', () => {
    const plan = planFromEnv(branchMode)
    expect(plan.kind).toBe('run')
    if (plan.kind !== 'run') return
    expect(plan.config).toMatchObject({
      trigger: 'branch',
      deployBranch: 'release',
      title: 'deploy 1234567 (run 42)',
    })
  })

  it("APP_VERSION verilince başlıkta sürüm yazar (Dokploy'da görünür, D-087)", () => {
    const plan = planFromEnv({ ...branchMode, APP_VERSION: '0.16.0' })
    expect(plan.kind === 'run' && plan.config.title).toBe('deploy v0.16.0 1234567 (run 42)')
    // DEPLOY_TITLE (rollback) her zaman önceliklidir.
    const rollback = planFromEnv({
      ...branchMode,
      APP_VERSION: '0.16.0',
      DEPLOY_TITLE: 'rollback v0.15.0 abcdef0 (run 7)',
    })
    expect(rollback.kind === 'run' && rollback.config.title).toBe(
      'rollback v0.15.0 abcdef0 (run 7)',
    )
  })

  it('geçersiz ya da boş APP_VERSION başlığa yazılmaz', () => {
    for (const bad of ['', '  ', 'main', '1.2', 'v1.2.3', '1.2.3\nrm -rf', '1.2.3 extra']) {
      const plan = planFromEnv({ ...branchMode, APP_VERSION: bad })
      expect(plan.kind === 'run' && plan.config.title, JSON.stringify(bad)).toBe(
        'deploy 1234567 (run 42)',
      )
    }
    expect(appVersion(' 0.16.0 ')).toBe('0.16.0')
    expect(appVersion('1.0.0-rc.1')).toBe('1.0.0-rc.1')
    expect(appVersion(undefined)).toBeNull()
  })

  it('dal adı doğrulanır; main ve bilinmeyen tetik reddedilir', () => {
    expect(planFromEnv({ ...branchMode, DEPLOY_BRANCH: 'main' }).kind).toBe('error')
    expect(planFromEnv({ ...branchMode, DEPLOY_BRANCH: 'a b' }).kind).toBe('error')
    expect(planFromEnv({ ...branchMode, DEPLOY_BRANCH: 'deploy/prod' }).kind).toBe('run')
    expect(planFromEnv({ ...branchMode, DEPLOY_TRIGGER: 'webhook' }).kind).toBe('error')
    expect(planFromEnv({ ...branchMode, API_URL: 'http://api.example.test' }).kind).toBe('error')
  })

  const complete = {
    DEPLOY_TRIGGER: 'api',
    DEPLOY_ENABLED: 'true',
    DOKPLOY_URL: 'https://panel.example.test',
    DOKPLOY_API_TOKEN: TOKEN,
    DOKPLOY_COMPOSE_ID: 'cmp-1',
    API_URL: 'https://api.example.test',
    WEB_URL: 'https://example.test',
    EXPECTED_SHA: NEW_SHA,
    GITHUB_RUN_ID: '42',
  }

  it('DEPLOY_ENABLED yoksa ya da deneme çalışmasıysa temiz biçimde atlar', () => {
    expect(planFromEnv({}).kind).toBe('skip')
    expect(planFromEnv({ ...complete, DEPLOY_ENABLED: 'false' }).kind).toBe('skip')
    expect(planFromEnv({ ...complete, DRY_RUN: 'true' }).kind).toBe('skip')
  })

  it('DEPLOY_ENABLED=true iken eksik ayar hatadır; değer değil yalnızca ad yazılır', () => {
    const plan = planFromEnv({ ...complete, DOKPLOY_API_TOKEN: '', WEB_URL: ' ' })
    expect(plan.kind).toBe('error')
    expect(plan.kind === 'error' && plan.summary).toMatch(/DOKPLOY_API_TOKEN, WEB_URL/)
  })

  it('https olmayan adresleri, geçersiz SHA ve çok satırlı anahtarı reddeder', () => {
    expect(planFromEnv({ ...complete, DOKPLOY_URL: 'http://72.62.53.122:3000' }).kind).toBe('error')
    expect(planFromEnv({ ...complete, EXPECTED_SHA: 'main' }).kind).toBe('error')
    const badToken = planFromEnv({ ...complete, DOKPLOY_API_TOKEN: 'abc\ndef' })
    expect(badToken.kind).toBe('error')
    expect(badToken.kind === 'error' && badToken.summary).not.toContain('abc')
  })

  it('başlığı gh-<sha7>-<run_id> olarak kurar; skipUnchanged yalnızca açıkça istenirse', () => {
    const plan = planFromEnv(complete)
    expect(plan.kind).toBe('run')
    expect(plan.kind === 'run' && plan.config.title).toBe('gh-1234567-42')
    const versioned = planFromEnv({ ...complete, APP_VERSION: '0.16.0' })
    expect(versioned.kind === 'run' && versioned.config.title).toBe('gh-v0.16.0-1234567-42')
    expect(plan.kind === 'run' && plan.config.skipUnchanged).toBe(false)
    const release = planFromEnv({ ...complete, SKIP_UNCHANGED: 'true' })
    expect(release.kind === 'run' && release.config.skipUnchanged).toBe(true)
  })
})

describe('gitPushDeployCommit (gerçek git, geçici yerel depo; ağa çıkmaz)', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  function repo() {
    const root = mkdtempSync(join(tmpdir(), 'hy-deploy-'))
    dirs.push(root)
    const origin = join(root, 'origin.git')
    const work = join(root, 'work')
    const git = (cwd: string, ...args: string[]) =>
      execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
    git(root, 'init', '--bare', '--initial-branch=main', origin)
    git(root, 'init', '--initial-branch=main', work)
    git(work, 'config', 'user.name', 'test')
    git(work, 'config', 'user.email', 'test@example.test')
    git(work, 'remote', 'add', 'origin', origin)
    const commit = (file: string, text: string) => {
      writeFileSync(join(work, file), text)
      git(work, 'add', file)
      git(work, 'commit', '-m', `edit ${file}`)
      git(work, 'push', '-q', 'origin', 'main')
      return git(work, 'rev-parse', 'HEAD')
    }
    return { origin, work, git, commit }
  }

  it('ilk yayında dalı açar, sonrakilerde fast-forward ekler; ağaç hedef commit ile aynıdır', () => {
    const { origin, work, git, commit } = repo()
    const first = commit('a.txt', '1')
    const second = commit('a.txt', '2')

    const d1 = gitPushDeployCommit('release', first, 'deploy 1 (run 1)', work)
    expect(git(origin, 'rev-parse', 'refs/heads/release')).toBe(d1)
    expect(git(origin, 'rev-parse', `${d1}^{tree}`)).toBe(git(work, 'rev-parse', `${first}^{tree}`))

    const d2 = gitPushDeployCommit('release', second, 'deploy 2 (run 2)', work)
    expect(git(origin, 'rev-parse', `${d2}^`)).toBe(d1)
    expect(git(origin, 'rev-parse', `${d2}^{tree}`)).toBe(
      git(work, 'rev-parse', `${second}^{tree}`),
    )

    // Geri alma: eski commit'in ağacı yeni bir commit olarak eklenir; force push gerekmez.
    const d3 = gitPushDeployCommit('release', first.slice(0, 7), 'rollback 1 (run 3)', work)
    expect(git(origin, 'rev-parse', `${d3}^`)).toBe(d2)
    expect(git(origin, 'rev-parse', `${d3}^{tree}`)).toBe(git(work, 'rev-parse', `${first}^{tree}`))
    expect(git(origin, 'log', '-1', '--format=%an|%s', 'release')).toBe(
      'github-actions[bot]|rollback 1 (run 3)',
    )
    // main'e dokunulmaz.
    expect(git(origin, 'rev-parse', 'refs/heads/main')).toBe(second)
  })

  it('bilinmeyen commit hata verir ve dala hiçbir şey yazılmaz', () => {
    const { origin, work, git, commit } = repo()
    commit('a.txt', '1')
    expect(() => gitPushDeployCommit('release', 'deadbee', 'deploy x', work)).toThrow()
    expect(git(origin, 'ls-remote', '--heads', origin, 'release')).toBe('')
  })
})
