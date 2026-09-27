// Dokploy'a yayın ve doğrulama (docs/spec/infra.md → Deploy sözleşmesi, D-064). CI'daki release
// ve rollback işleri çalıştırır; yerelde çalıştırılmaz (canlı çağrı, CLAUDE.md DUR-SOR 6).
// 0. (release) Canlıdaki sürümden bu commit'e yalnızca docs/ ya da apps/mobile/ değiştiyse yayın
//    gerekmez: imajlar aynıdır, gereksiz kesinti yaşanmaz.
// 1. Mevcut deployment kimlikleri kaydedilir.
// 2. compose.deploy ile yayın kuyruğa alınır. Gövde yalnızca composeId ve title taşır;
//    freshVolumes (volume'ları siler) ASLA gönderilmez, compose.redeploy kullanılmaz.
// 3. Listede ilk görünen yeni deployment 10 sn arayla en fazla 15 dk izlenir (kuyrukta bekleme dahil).
//    Ağ hatası, 5xx ve 429 geçici sayılır; süre dolana kadar beklenir.
// 4. API /version ve web /api/version yeni GIT_SHA'yı, API /ready 200'ü verene kadar yoklanır.
// Çıkış: 0 = yayınlandı, gerekmedi ya da bilerek atlandı; 1 = başarısız.
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export interface DeployConfig {
  dokployUrl: string
  apiToken: string
  composeId: string
  apiUrl: string
  webUrl: string
  /** Beklenen GIT_SHA: tam SHA ya da en az 7 karakterlik başı (rollback). */
  expectedSha: string
  title: string
  /** true: canlı sürümden bu yana yalnızca yayına girmeyen yollar değiştiyse Dokploy tetiklenmez. */
  skipUnchanged: boolean
  pollIntervalMs: number
  deployTimeoutMs: number
  verifyTimeoutMs: number
}

export interface Clock {
  now(): number
  sleep(ms: number): Promise<void>
}

export interface DeployDeps {
  fetch: typeof fetch
  clock: Clock
  log: (line: string) => void
  /** İki commit arasında değişen dosyalar; bilinmiyorsa (commit yok, git hatası) null. */
  changedFiles: (from: string, to: string) => string[] | null
}

export interface Deployment {
  deploymentId: string
  status: string
  title?: string | null
  description?: string | null
  errorMessage?: string | null
  createdAt?: string | null
}

export type DeployResult = { ok: boolean; summary: string }

export const DEFAULT_TIMING = {
  pollIntervalMs: 10_000,
  deployTimeoutMs: 15 * 60_000,
  verifyTimeoutMs: 15 * 60_000,
} as const

/** Yayına girmeyen yollar (ci.yml'deki eski changes filtresiyle aynı: belge ve mobil uygulama). */
export const NON_DEPLOY_PREFIXES = ['docs/', 'apps/mobile/'] as const

const REQUEST_TIMEOUT_MS = 15_000

class DeployError extends Error {
  /** Geçici (ağ, zaman aşımı, 5xx, 429): beklemeye devam edilebilir. */
  constructor(
    message: string,
    readonly transient = false,
  ) {
    super(message)
  }
}

const trimSlash = (url: string) => url.replace(/\/+$/, '')

/** Biri diğerinin başıysa ve kısa olanı en az 7 karakterse aynı commit sayılır. */
export function shaMatches(actual: unknown, expected: string): boolean {
  if (typeof actual !== 'string') return false
  const a = actual.trim().toLowerCase()
  const e = expected.trim().toLowerCase()
  const shorter = Math.min(a.length, e.length)
  return shorter >= 7 && (a.startsWith(e) || e.startsWith(a))
}

export function isNonDeployPath(file: string): boolean {
  return NON_DEPLOY_PREFIXES.some((prefix) => file.startsWith(prefix))
}

async function dokploy(
  config: DeployConfig,
  deps: DeployDeps,
  path: string,
  init: { method: 'GET' | 'POST'; body?: string },
): Promise<unknown> {
  const url = `${trimSlash(config.dokployUrl)}/api/${path}`
  let status: number
  let text: string
  try {
    const response = await deps.fetch(url, {
      method: init.method,
      headers: {
        'x-api-key': config.apiToken,
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
      ...(init.body ? { body: init.body } : {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    status = response.status
    text = await response.text()
  } catch (error) {
    throw new DeployError(`Dokploy'a ulaşılamadı (${path}): ${(error as Error).name}`, true)
  }
  if (status < 200 || status >= 300) {
    const transient = status >= 500 || status === 429
    throw new DeployError(`Dokploy ${path} → HTTP ${status}: ${text.slice(0, 200)}`, transient)
  }
  try {
    return text ? (JSON.parse(text) as unknown) : null
  } catch {
    return text
  }
}

async function listDeployments(config: DeployConfig, deps: DeployDeps): Promise<Deployment[]> {
  const query = new URLSearchParams({ composeId: config.composeId })
  const data = await dokploy(config, deps, `deployment.allByCompose?${query}`, { method: 'GET' })
  if (!Array.isArray(data)) {
    throw new DeployError('Dokploy deployment listesi beklenen biçimde değil (dizi değil)')
  }
  return data.filter(
    (item): item is Deployment =>
      typeof item === 'object' && item !== null && typeof item.deploymentId === 'string',
  )
}

/** compose.deploy gövdesi: yalnızca composeId ve title. freshVolumes asla eklenmez. */
export function deployRequestBody(config: Pick<DeployConfig, 'composeId' | 'title'>): string {
  return JSON.stringify({ composeId: config.composeId, title: config.title })
}

async function waitForDeployment(
  config: DeployConfig,
  deps: DeployDeps,
  before: Set<string>,
): Promise<Deployment> {
  const deadline = deps.clock.now() + config.deployTimeoutMs
  let lastState = ''
  for (;;) {
    let state: string
    let fresh: Deployment | undefined
    try {
      fresh = (await listDeployments(config, deps)).find((d) => !before.has(d.deploymentId))
      state = fresh ? `${fresh.deploymentId}: ${fresh.status}` : 'kuyrukta (henüz kayıt yok)'
    } catch (error) {
      if (!(error instanceof DeployError) || !error.transient) throw error
      state = `geçici hata, bekleniyor (${error.message})`
    }
    if (state !== lastState) {
      deps.log(`deployment ${state}`)
      lastState = state
    }
    if (fresh?.status === 'done') return fresh
    if (fresh && (fresh.status === 'error' || fresh.status === 'cancelled')) {
      const detail = fresh.errorMessage
        ? `: ${fresh.errorMessage}`
        : ' (ayrıntı Dokploy loglarında)'
      throw new DeployError(`Dokploy deployment ${fresh.status}${detail}`)
    }
    if (deps.clock.now() >= deadline) {
      throw new DeployError(
        `Dokploy deployment ${Math.round(config.deployTimeoutMs / 60_000)} dk içinde bitmedi (${state})`,
      )
    }
    await deps.clock.sleep(config.pollIntervalMs)
  }
}

type ProbeResult = { reached: true; status: number; body: unknown } | { reached: false }

/** Yayın sırasında konteynerler yeniden başladığı için ulaşılamamak hata değil, bekleme sebebidir. */
async function probe(deps: DeployDeps, url: string): Promise<ProbeResult> {
  try {
    const response = await deps.fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const body = (await response.json().catch(() => null)) as unknown
    return { reached: true, status: response.status, body }
  } catch {
    return { reached: false }
  }
}

function gitShaOf(body: unknown): unknown {
  return typeof body === 'object' && body !== null ? (body as { gitSha?: unknown }).gitSha : null
}

/** API ve web aynı gerçek commit'i gösteriyorsa onu döndürür; aksi hâlde (ulaşılamıyor, "dev") null. */
async function liveSha(config: DeployConfig, deps: DeployDeps): Promise<string | null> {
  const shas: string[] = []
  for (const url of [
    `${trimSlash(config.apiUrl)}/version`,
    `${trimSlash(config.webUrl)}/api/version`,
  ]) {
    const result = await probe(deps, url)
    const sha = result.reached && result.status === 200 ? gitShaOf(result.body) : null
    if (typeof sha !== 'string' || !/^[0-9a-f]{7,40}$/i.test(sha)) return null
    shas.push(sha.toLowerCase())
  }
  return shas[0] === shas[1] ? (shas[0] ?? null) : null
}

async function verifyRelease(config: DeployConfig, deps: DeployDeps): Promise<void> {
  const deadline = deps.clock.now() + config.verifyTimeoutMs
  const targets = [
    { name: 'API /version', url: `${trimSlash(config.apiUrl)}/version`, kind: 'sha' },
    { name: 'web /api/version', url: `${trimSlash(config.webUrl)}/api/version`, kind: 'sha' },
    { name: 'API /ready', url: `${trimSlash(config.apiUrl)}/ready`, kind: 'ready' },
  ] as const
  let lastState = ''
  for (;;) {
    const pending: string[] = []
    for (const target of targets) {
      const result = await probe(deps, target.url)
      if (!result.reached) {
        pending.push(`${target.name}: ulaşılamadı`)
      } else if (target.kind === 'ready' && result.status !== 200) {
        pending.push(`${target.name}: HTTP ${result.status}`)
      } else if (target.kind === 'sha' && !shaMatches(gitShaOf(result.body), config.expectedSha)) {
        pending.push(`${target.name}: eski SHA ${String(gitShaOf(result.body) ?? '?')}`)
      }
    }
    if (pending.length === 0) return
    const state = pending.join('; ')
    if (state !== lastState) {
      deps.log(`doğrulama bekliyor → ${state}`)
      lastState = state
    }
    if (deps.clock.now() >= deadline) {
      throw new DeployError(
        `yayın ${Math.round(config.verifyTimeoutMs / 60_000)} dk içinde doğrulanamadı → ${state}`,
      )
    }
    await deps.clock.sleep(config.pollIntervalMs)
  }
}

/** Yayın gerekmiyorsa özet metnini döndürür; gerekiyorsa null. */
async function unchangedSummary(config: DeployConfig, deps: DeployDeps): Promise<string | null> {
  if (!config.skipUnchanged) return null
  const live = await liveSha(config, deps)
  if (!live) return null
  const target = config.expectedSha.slice(0, 7)
  if (shaMatches(live, config.expectedSha)) {
    return `YAYIN GEREKMEDİ: ${target} zaten canlıda.`
  }
  const files = deps.changedFiles(live, config.expectedSha)
  if (files === null || !files.every(isNonDeployPath)) return null
  return `YAYIN GEREKMEDİ: canlıdaki ${live.slice(0, 7)} ile ${target} arasında yalnızca belge ya da mobil uygulama değişti; imajlar aynı.`
}

export async function runDeploy(config: DeployConfig, deps: DeployDeps): Promise<DeployResult> {
  const started = deps.clock.now()
  try {
    const unchanged = await unchangedSummary(config, deps)
    if (unchanged) return { ok: true, summary: unchanged }
    const before = new Set((await listDeployments(config, deps)).map((d) => d.deploymentId))
    deps.log(`mevcut deployment sayısı: ${before.size}; yayın kuyruğa alınıyor (${config.title})`)
    await dokploy(config, deps, 'compose.deploy', {
      method: 'POST',
      body: deployRequestBody(config),
    })
    const deployment = await waitForDeployment(config, deps, before)
    deps.log(`Dokploy deployment tamam: ${deployment.deploymentId}`)
    await verifyRelease(config, deps)
    const minutes = ((deps.clock.now() - started) / 60_000).toFixed(1)
    return {
      ok: true,
      summary: `YAYINLANDI: ${config.expectedSha.slice(0, 7)} (${minutes} dk). /version, /api/version ve /ready doğrulandı.`,
    }
  } catch (error) {
    if (error instanceof DeployError)
      return { ok: false, summary: `YAYIN BAŞARISIZ: ${error.message}` }
    throw error
  }
}

export type Plan =
  | { kind: 'skip'; summary: string }
  | { kind: 'error'; summary: string }
  | { kind: 'run'; config: DeployConfig }

/** Ortam değişkenlerinden ne yapılacağına karar verir (sır değerleri hiçbir zaman yazdırılmaz). */
export function planFromEnv(env: Record<string, string | undefined>): Plan {
  if (env.DRY_RUN === 'true') {
    return { kind: 'skip', summary: 'YAYINLANMADI: deneme çalışması (dry_run); imajlar derlendi.' }
  }
  if (env.DEPLOY_ENABLED !== 'true') {
    return {
      kind: 'skip',
      summary:
        'YAYINLANMADI: Dokploy kurulumu tamamlanmadı (DEPLOY_ENABLED=true değil). Bkz. docs/DEPLOY_DOKPLOY.md.',
    }
  }
  const required = [
    'DOKPLOY_URL',
    'DOKPLOY_API_TOKEN',
    'DOKPLOY_COMPOSE_ID',
    'API_URL',
    'WEB_URL',
    'EXPECTED_SHA',
  ] as const
  const missing = required.filter((key) => !env[key]?.trim())
  if (missing.length > 0) {
    return {
      kind: 'error',
      summary: `YAYIN BAŞARISIZ: DEPLOY_ENABLED=true ama şunlar tanımlı değil: ${missing.join(', ')}`,
    }
  }
  const value = (key: (typeof required)[number]) => (env[key] ?? '').trim()
  for (const key of ['DOKPLOY_URL', 'API_URL', 'WEB_URL'] as const) {
    if (!value(key).startsWith('https://')) {
      return { kind: 'error', summary: `YAYIN BAŞARISIZ: ${key} https:// ile başlamalı` }
    }
  }
  // Başlık değeri doğrulanır ama hiçbir mesaja yazılmaz.
  if (!/^[\x21-\x7e]+$/.test(value('DOKPLOY_API_TOKEN'))) {
    return {
      kind: 'error',
      summary: 'YAYIN BAŞARISIZ: DOKPLOY_API_TOKEN yazdırılabilir tek satırlık bir değer olmalı',
    }
  }
  if (!/^[0-9a-f]{7,40}$/i.test(value('EXPECTED_SHA'))) {
    return {
      kind: 'error',
      summary: 'YAYIN BAŞARISIZ: EXPECTED_SHA 7–40 karakterlik bir commit SHA olmalı',
    }
  }
  const sha7 = value('EXPECTED_SHA').slice(0, 7).toLowerCase()
  return {
    kind: 'run',
    config: {
      dokployUrl: value('DOKPLOY_URL'),
      apiToken: value('DOKPLOY_API_TOKEN'),
      composeId: value('DOKPLOY_COMPOSE_ID'),
      apiUrl: value('API_URL'),
      webUrl: value('WEB_URL'),
      expectedSha: value('EXPECTED_SHA'),
      title: env.DEPLOY_TITLE?.trim() || `gh-${sha7}-${env.GITHUB_RUN_ID ?? 'yerel'}`,
      skipUnchanged: env.SKIP_UNCHANGED === 'true',
      ...DEFAULT_TIMING,
    },
  }
}

const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}

/** git diff; commit bilinmiyorsa ya da git hata verirse null (o zaman yayın yapılır). */
function gitChangedFiles(from: string, to: string): string[] | null {
  try {
    const output = execFileSync('git', ['diff', '--name-only', from, to], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output.split('\n').filter(Boolean)
  } catch {
    return null
  }
}

function writeSummary(summary: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY
  if (file) appendFileSync(file, `### Dokploy yayını\n\n${summary}\n`)
}

async function main(): Promise<number> {
  const plan = planFromEnv(process.env)
  if (plan.kind !== 'run') {
    console.log(plan.summary)
    writeSummary(plan.summary)
    return plan.kind === 'skip' ? 0 : 1
  }
  const result = await runDeploy(plan.config, {
    fetch: globalThis.fetch,
    clock: realClock,
    log: (line) => console.log(line),
    changedFiles: gitChangedFiles,
  })
  console.log(result.summary)
  writeSummary(result.summary)
  return result.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main()
}
