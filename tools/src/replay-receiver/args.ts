import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  createScenario,
  isScenarioName,
  SCENARIO_NAMES,
  type Scenario,
  type ScenarioName,
} from '../scenarios'
import { loadRecording, type Recording } from './recording'

/** Replay alıcısının ve `pnpm dev:replay`'in ortak argümanları. */

export type ReplaySourceArgs =
  { kind: 'scenario'; name: ScenarioName; count?: number } | { kind: 'recording'; path: string }
export type ReplayArgs = ReplaySourceArgs | { kind: 'help' }

export const REPLAY_USAGE = [
  'Kullanım:',
  '  --scenario <ad>     sentetik senaryo (varsayılan cruise; seçenekler: ' +
    `${SCENARIO_NAMES.join(', ')})`,
  '  --count <n>         senaryodaki seyir uçağı sayısı (cruise: 0–90, varsayılan 8)',
  '  --recording <dosya> kayıtlı kareleri döngüyle sun (readsb aircraft.json, adsb.lol v2,',
  '                      kare dizisi, {"frames": […]} ya da satır başına bir kare)',
  '  -h, --help          bu yardım',
  'Port: REPLAY_RECEIVER_PORT (varsayılan 4300). Yalnızca APP_ENV=development|test.',
].join('\n')

export class ReplayArgsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReplayArgsError'
  }
}

export function parseReplayArgs(argv: readonly string[]): ReplayArgs {
  // `pnpm <script> -- --x` biçiminde gelen ayraç atlanır.
  const args = argv[0] === '--' ? argv.slice(1) : [...argv]
  let values: { scenario?: string; recording?: string; count?: string; help?: boolean }
  try {
    values = parseArgs({
      args,
      options: {
        scenario: { type: 'string' },
        recording: { type: 'string' },
        count: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: true,
      allowPositionals: false,
    }).values
  } catch (error) {
    throw new ReplayArgsError(
      `geçersiz argüman: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (values.help) return { kind: 'help' }
  if (values.recording !== undefined) {
    if (values.scenario !== undefined || values.count !== undefined) {
      throw new ReplayArgsError('--recording, --scenario ya da --count ile birlikte kullanılamaz')
    }
    if (!values.recording.trim()) throw new ReplayArgsError('--recording bir dosya yolu ister')
    return { kind: 'recording', path: values.recording }
  }
  const name = values.scenario ?? 'cruise'
  if (!isScenarioName(name)) {
    throw new ReplayArgsError(
      `bilinmeyen senaryo: ${name} (seçenekler: ${SCENARIO_NAMES.join(', ')})`,
    )
  }
  if (values.count === undefined) return { kind: 'scenario', name }
  if (!/^\d{1,4}$/.test(values.count)) throw new ReplayArgsError('--count tam sayı olmalı')
  return { kind: 'scenario', name, count: Number(values.count) }
}

/**
 * Argümanlardan veri kaynağını kurar. Göreli kayıt yolu, pnpm'in çağrıldığı dizine (INIT_CWD) göre
 * çözülür; `pnpm --filter` paket dizininde çalışsa da kullanıcının yazdığı yol geçerli kalır.
 */
export function createReplaySource(
  args: ReplaySourceArgs,
  baseDir: string = process.env.INIT_CWD ?? process.cwd(),
): Scenario | Recording {
  if (args.kind === 'recording') return loadRecording(resolve(baseDir, args.path))
  return createScenario(args.name, args.count === undefined ? {} : { count: args.count })
}

/** Konsol çıktısı için kısa açıklama, ör. "senaryo cruise, 10 uçak". */
export function describeReplaySource(source: Scenario | Recording, nowMs: number): string {
  if ('frameAt' in source) {
    return `senaryo ${source.name}, ${source.frameAt(nowMs).aircraft.length} uçak`
  }
  return `kayıt, ${source.frames.length} kare`
}
