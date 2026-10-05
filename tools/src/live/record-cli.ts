import { createRedis } from '@havayolu/db'
import { LiveArgsError, parseRecordArgs, RECORD_USAGE } from './args'
import { createRedactor, devEnvSource, findWorkspaceRoot, workspaceVersion } from './env'
import { runRecord, type RecordExitCode } from './record'

/**
 * `pnpm record --station <ICAO> [--minutes 30] [--radius 40] [--out <dosya> | --fixture]
 * [--confirm]`. İnce giriş: argümanlar, ortam ve gerçek saat; iş `runRecord`'dadır. Canlı istek atar
 * (DUR-SOR 6): yalnızca kullanıcı kendi terminalinde `--confirm` ile çalıştırır.
 * İlk Ctrl+C eldeki karelerle dosyayı kapatır, ikincisi hemen çıkar (130).
 */

let redact = createRedactor([process.env.CONTACT_EMAIL, process.env.ADSBLOL_API_KEY])
let debug = process.env.LOG_LEVEL === 'debug'
let fatal = false

/** Beklenmeyen hata: yalnızca maskeli ileti (yığın yalnızca LOG_LEVEL=debug iken), çıkış 4. */
function reportFatal(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error(redact(`✗ pnpm record beklenmeyen hata: ${message}`))
  if (debug && error instanceof Error && error.stack) console.error(redact(error.stack))
  fatal = true
  process.exitCode = 4
}

async function main(): Promise<RecordExitCode> {
  let args: ReturnType<typeof parseRecordArgs>
  try {
    args = parseRecordArgs(process.argv.slice(2))
  } catch (error) {
    if (!(error instanceof LiveArgsError)) throw error
    console.error(`✗ ${error.message}`)
    console.error(RECORD_USAGE)
    return 2
  }
  if (args.kind === 'help') {
    console.log(RECORD_USAGE)
    return 0
  }
  const root = findWorkspaceRoot(process.cwd())
  if (root === null) {
    console.error('✗ Repo kökü bulunamadı (pnpm-workspace.yaml); komutu repo içinde çalıştır')
    return 2
  }
  const source = devEnvSource(root)
  redact = createRedactor([source.CONTACT_EMAIL, source.ADSBLOL_API_KEY])
  debug = source.LOG_LEVEL?.trim() === 'debug'

  const controller = new AbortController()
  let interrupts = 0
  process.on('SIGINT', () => {
    interrupts += 1
    if (interrupts > 1) process.exit(130)
    console.log('Durduruluyor: eldeki karelerle dosya kapatılıyor (hemen çıkmak için yine Ctrl+C)')
    controller.abort()
  })

  const result = await runRecord(
    { root, args, source, shellEnv: process.env, version: workspaceVersion(root) },
    {
      fetch: globalThis.fetch,
      clock: {
        now: () => Date.now(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      },
      random: Math.random,
      log: (line) => console.log(line),
      redisFactory: (url) => createRedis(url, { name: 'tools-live' }),
      signal: controller.signal,
    },
  )
  return result.exitCode
}

process.on('unhandledRejection', reportFatal)

main().then((code) => {
  // Çalışma sırasında yakalanmamış bir hata olduysa 4 kalır (401/403'ün 3'ü önceliklidir).
  process.exitCode = fatal && code !== 3 ? 4 : code
}, reportFatal)
