// pnpm dev:replay: yerel replay alıcısını başlatır ve pnpm dev'i (web, API, worker) ona bağlar.
// Canlı veri yalnızca sentetik senaryodan ya da kayıttan gelir; dış servislere istek atılmaz
// (EXTERNAL_PROVIDERS_DISABLED=true zorlanır). APP_ENV development|test değilse başlamaz (D-073).
//
// Kullanım: pnpm dev:replay [--scenario cruise] [--count 8] | [--recording <dosya>]
// Port: REPLAY_RECEIVER_PORT (varsayılan 4300). Ctrl+C alıcıyı ve pnpm dev'i birlikte kapatır.
import { spawn, spawnSync, type SpawnOptions } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createReplaySource,
  describeReplaySource,
  parseReplayArgs,
  REPLAY_USAGE,
  ReplayArgsError,
} from '../tools/src/replay-receiver/args.ts'
import { devEnvValue } from '../tools/src/replay-receiver/env.ts'
import {
  assertReplayAllowed,
  replayPortFromEnv,
  startReplayReceiver,
  type ReplayReceiver,
} from '../tools/src/replay-receiver/server.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
/** Kapanış isteğinden sonra pnpm dev bu sürede çıkmazsa süreç ağacı zorla kapatılır. */
const FORCE_KILL_AFTER_MS = 10_000

/**
 * pnpm'i kabuksuz çalıştırır: pnpm'in kendi betiği (npm_execpath) varsa Node ile doğrudan; yoksa
 * Windows'ta kabukla (pnpm bir .cmd'dir), diğerlerinde PATH'teki pnpm ile.
 */
function pnpmCommand(args: string[]): { command: string; args: string[]; options: SpawnOptions } {
  const execPath = process.env.npm_execpath
  if (execPath && basename(execPath).toLowerCase().startsWith('pnpm') && existsSync(execPath)) {
    if (/\.[cm]?js$/i.test(execPath)) {
      return { command: process.execPath, args: [execPath, ...args], options: {} }
    }
    return { command: execPath, args, options: {} }
  }
  if (process.platform === 'win32') {
    // Node 24'te shell: true ile ayrı argüman dizisi kullanımdan kalktı (DEP0190): tek komut dizgisi.
    return { command: ['pnpm', ...args].join(' '), args: [], options: { shell: true } }
  }
  return { command: 'pnpm', args, options: {} }
}

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

const parsed = (() => {
  try {
    return parseReplayArgs(process.argv.slice(2))
  } catch (error) {
    if (error instanceof ReplayArgsError) {
      console.error(REPLAY_USAGE)
      fail(error.message)
    }
    throw error
  }
})()
if (parsed.kind === 'help') {
  console.log(REPLAY_USAGE)
  process.exit(0)
}

const appEnv = devEnvValue('APP_ENV', root)
let receiver: ReplayReceiver
let description: string
try {
  assertReplayAllowed(appEnv)
  const source = createReplaySource(parsed)
  description = describeReplaySource(source, Date.now())
  receiver = await startReplayReceiver({
    source,
    appEnv,
    port: replayPortFromEnv(devEnvValue('REPLAY_RECEIVER_PORT', root)),
  })
} catch (error) {
  fail(`Replay alıcısı başlamadı: ${error instanceof Error ? error.message : String(error)}`)
}

console.log(`✓ Replay alıcısı: ${receiver.url} (${description})`)
console.log(
  `  pnpm dev başlıyor: LOCAL_RECEIVER_URLS=${receiver.url}, EXTERNAL_PROVIDERS_DISABLED=true`,
)

const command = pnpmCommand(['dev'])
const child = spawn(command.command, command.args, {
  ...command.options,
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    LOCAL_RECEIVER_URLS: receiver.url,
    EXTERNAL_PROVIDERS_DISABLED: 'true',
  },
})

let stopping = false
let forceTimer: NodeJS.Timeout | undefined

/** Süreç ağacını zorla kapatır (Windows'ta alt süreçler ebeveynle birlikte ölmez). */
function forceKill() {
  if (child.exitCode !== null || child.pid === undefined) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    child.kill('SIGKILL')
  }
}

function stop(signal: NodeJS.Signals) {
  if (stopping) {
    // İkinci Ctrl+C: beklemeden kapat.
    forceKill()
    return
  }
  stopping = true
  // Windows'ta Ctrl+C konsoldaki bütün süreçlere zaten gider; diğerlerinde sinyal iletilir.
  if (process.platform !== 'win32') child.kill(signal)
  forceTimer = setTimeout(forceKill, FORCE_KILL_AFTER_MS)
  forceTimer.unref()
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

async function finish(code: number): Promise<never> {
  clearTimeout(forceTimer)
  await receiver.close().catch(() => undefined)
  process.exit(code)
}

child.on('error', (error) => {
  console.error(`✗ pnpm dev başlatılamadı: ${error.message}`)
  void finish(1)
})
child.on('exit', (code, signal) => {
  // Kullanıcının istediği kapanış başarıdır; kendiliğinden biten pnpm dev kendi kodunu taşır.
  void finish(stopping ? 0 : (code ?? (signal ? 1 : 0)))
})
