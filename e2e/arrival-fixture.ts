// Kapsama raporu fixture'ını (tools/src/arrival-report/fixture-cli.ts) e2e'den çalıştırır. Ayrı bir
// süreçtir: veritabanı adresi aracın kendi okumasıyla gelir (süreç ortamı > kökteki .env >
// .env.example; yalnızca yerel adres kabul edilir) ve e2e'nin web sunucusuyla aynı veritabanıdır.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const TIMEOUT_MS = 120_000

/**
 * pnpm'i kabuksuz çalıştırır (scripts/dev-replay.mts ile aynı kural): pnpm'in kendi betiği
 * (npm_execpath) varsa Node ile doğrudan; yoksa Windows'ta kabukla (pnpm bir .cmd'dir).
 */
function pnpm(args: readonly string[]): { command: string; args: string[]; shell: boolean } {
  const execPath = process.env.npm_execpath
  if (execPath && basename(execPath).toLowerCase().startsWith('pnpm') && existsSync(execPath)) {
    if (/\.[cm]?js$/i.test(execPath)) {
      return { command: process.execPath, args: [execPath, ...args], shell: false }
    }
    return { command: execPath, args: [...args], shell: false }
  }
  if (process.platform === 'win32') {
    return { command: ['pnpm', ...args].join(' '), args: [], shell: true }
  }
  return { command: 'pnpm', args: [...args], shell: false }
}

/** `seed`: önce eski fixture silinir, üç uçuş yazılır. `clean`: yalnızca silinir. Çıktıyı döndürür. */
export function runArrivalFixture(mode: 'seed' | 'clean'): string {
  const invocation = pnpm([
    '--filter',
    '@havayolu/tools',
    'arrival-fixture',
    ...(mode === 'clean' ? ['--clean'] : []),
  ])
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: invocation.shell,
    timeout: TIMEOUT_MS,
    windowsHide: true,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  if (result.error || result.status !== 0) {
    throw new Error(
      `arrival-fixture ${mode} başarısız (çıkış ${String(result.status)}): ${result.error?.message ?? output}`,
    )
  }
  return output
}
