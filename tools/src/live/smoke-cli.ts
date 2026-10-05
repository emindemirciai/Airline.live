import { createRedis } from '@havayolu/db'
import { LiveArgsError, parseSmokeArgs, SMOKE_USAGE } from './args'
import { createRedactor, devEnvSource, findWorkspaceRoot, workspaceVersion } from './env'
import { runSmoke, SMOKE_DB_NAME, SMOKE_DURATION_MS, SMOKE_LIVE_DB_INDEX } from './smoke'

/**
 * `pnpm smoke:live [--confirm]` (M7a, D-094). İnce giriş noktası: argümanlar, kök, ortam kaynağı,
 * gerçek saat ve Ctrl+C; işin tamamı `runSmoke`'tadır. Canlı istek atar (CLAUDE.md DUR-SOR 6):
 * yalnızca kullanıcı kendi terminalinde `--confirm` ile çalıştırır; `--confirm` olmadan yalnızca plan
 * yazılır. İlk Ctrl+C ingest'i kapatıp yarım rapor yazar, ikincisi hemen çıkar (130).
 */

let redact = createRedactor([process.env.CONTACT_EMAIL, process.env.ADSBLOL_API_KEY])
let debug = process.env.LOG_LEVEL?.trim().toLowerCase() === 'debug'
let crashed = false

/** Beklenmeyen hata: maskeli ileti, yığın yalnızca LOG_LEVEL=debug iken (o da maskeli); çıkış 4. */
function reportCrash(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`✗ smoke:live beklenmeyen hata: ${redact(message)}`)
  if (debug && error instanceof Error && error.stack) console.error(redact(error.stack))
  crashed = true
  process.exitCode = 4
}

process.on('unhandledRejection', reportCrash)

async function main(): Promise<void> {
  let args: ReturnType<typeof parseSmokeArgs>
  try {
    args = parseSmokeArgs(process.argv.slice(2))
  } catch (error) {
    if (!(error instanceof LiveArgsError)) throw error
    console.error(`✗ ${error.message}`)
    console.error(SMOKE_USAGE)
    process.exitCode = 2
    return
  }
  if (args.kind === 'help') {
    console.log(SMOKE_USAGE)
    return
  }
  const root = findWorkspaceRoot(process.cwd())
  if (root === null) {
    console.error('✗ Repo kökü bulunamadı (pnpm-workspace.yaml); komutu repo içinde çalıştır')
    process.exitCode = 2
    return
  }
  const source = devEnvSource(root)
  redact = createRedactor([source.CONTACT_EMAIL, source.ADSBLOL_API_KEY])
  debug = source.LOG_LEVEL?.trim().toLowerCase() === 'debug'

  const controller = new AbortController()
  let interrupts = 0
  process.on('SIGINT', () => {
    interrupts += 1
    if (interrupts > 1) process.exit(130)
    console.log(
      'Ctrl+C: ingest kapatılıyor, yarım rapor yazılacak (hemen çıkmak için yeniden Ctrl+C)',
    )
    controller.abort()
  })

  const result = await runSmoke(
    {
      root,
      confirm: args.confirm,
      source,
      shellEnv: process.env,
      version: workspaceVersion(root),
      targets: { databaseName: SMOKE_DB_NAME, liveDbIndex: SMOKE_LIVE_DB_INDEX },
      durationMs: SMOKE_DURATION_MS,
    },
    {
      fetch: globalThis.fetch,
      clock: {
        now: () => Date.now(),
        sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
      },
      random: Math.random,
      log: (line) => console.log(line),
      signal: controller.signal,
      redisFactory: (url) => createRedis(url, { name: 'tools-smoke-guard' }),
    },
  )
  // Ingest sırasında yakalanmamış bir hata olduysa 4 kalır (401/403'ün 3'ü önceliklidir).
  process.exitCode = crashed && result.exitCode !== 3 ? 4 : result.exitCode
}

main()
  .catch(reportCrash)
  .finally(() => {
    // Güvenlik ağı: kapanmamış bir bağlantı süreci tutarsa 3 sn sonra çıkış kodunu koruyarak çık.
    setTimeout(() => process.exit(), 3_000).unref()
  })
