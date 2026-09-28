import {
  createReplaySource,
  describeReplaySource,
  parseReplayArgs,
  REPLAY_USAGE,
  ReplayArgsError,
} from './args'
import { devEnvValue, findWorkspaceRoot } from './env'
import { assertReplayAllowed, replayPortFromEnv, startReplayReceiver } from './server'

/**
 * Tek başına replay alıcısı: `pnpm --filter @havayolu/tools replay [-- --scenario cruise |
 * --recording <dosya>]`. Worker'ı ona bağlamak için LOCAL_RECEIVER_URLS'e yazdırdığı adres verilir;
 * hepsini birlikte başlatmak için kökte `pnpm dev:replay` kullanılır.
 */
async function main(): Promise<void> {
  const args = parseReplayArgs(process.argv.slice(2))
  if (args.kind === 'help') {
    console.log(REPLAY_USAGE)
    return
  }
  const root = findWorkspaceRoot(process.cwd())
  const appEnv = devEnvValue('APP_ENV', root)
  assertReplayAllowed(appEnv)
  const source = createReplaySource(args)
  const receiver = await startReplayReceiver({
    source,
    appEnv,
    port: replayPortFromEnv(devEnvValue('REPLAY_RECEIVER_PORT', root)),
  })
  console.log(`✓ Replay alıcısı: ${receiver.url} (${describeReplaySource(source, Date.now())})`)
  console.log(`  Worker için: LOCAL_RECEIVER_URLS=${receiver.url} · durdurmak için Ctrl+C`)
  const stop = () => {
    receiver.close().then(
      () => process.exit(0),
      (error: unknown) => {
        console.error(error)
        process.exit(1)
      },
    )
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

main().catch((error: unknown) => {
  console.error(
    `✗ Replay alıcısı başlamadı: ${error instanceof Error ? error.message : String(error)}`,
  )
  if (error instanceof ReplayArgsError) console.error(REPLAY_USAGE)
  process.exitCode = 1
})
