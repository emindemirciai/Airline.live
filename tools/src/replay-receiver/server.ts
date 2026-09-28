import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { ReadsbFrame, Scenario } from '../scenarios'
import { recordingPlayer, type RecordedFrame, type Recording } from './recording'

/**
 * Replay alıcısı: bir senaryoyu ya da kayıtlı kareleri readsb `aircraft.json` olarak sunar; worker
 * onu `LOCAL_RECEIVER_URLS` ile gerçek bir alıcı gibi okur. Yalnızca geliştirme ve testte çalışır
 * (CLAUDE.md → Replay ve simülasyon; D-073). Yanıtın `now` değeri sunulduğu anın saatidir.
 */

export {
  loadRecording,
  parseRecording,
  recordingPlayer,
  RecordingFormatError,
  type RecordedAircraft,
  type RecordedFrame,
  type Recording,
  type RecordingPlayer,
  type ReplayAircraft,
} from './recording'

export const DEFAULT_REPLAY_PORT = 4300
export const DEFAULT_REPLAY_HOST = '127.0.0.1'
/** readsb/tar1090'ın `aircraft.json` yolları. */
export const REPLAY_PATHS: readonly string[] = ['/data/aircraft.json', '/aircraft.json']

const ALLOWED_APP_ENVS = new Set(['development', 'test'])

export class ReplayProductionError extends Error {
  constructor(appEnv: string) {
    super(`replay yalnızca APP_ENV=development|test iken çalışır; APP_ENV=${appEnv}`)
    this.name = 'ReplayProductionError'
  }
}

/** APP_ENV boşsa geliştirme sayılır (env şemasının ve .env.example'ın varsayılanı). */
export function assertReplayAllowed(appEnv: string | undefined): void {
  const value = appEnv?.trim() ?? ''
  if (value !== '' && !ALLOWED_APP_ENVS.has(value)) throw new ReplayProductionError(value)
}

/** `REPLAY_RECEIVER_PORT` → port; boşsa 4300. */
export function replayPortFromEnv(value: string | undefined): number {
  const text = value?.trim() ?? ''
  if (text === '') return DEFAULT_REPLAY_PORT
  const port = /^\d{1,5}$/.test(text) ? Number(text) : Number.NaN
  if (!(port >= 1 && port <= 65535)) {
    throw new RangeError('REPLAY_RECEIVER_PORT geçersiz: 1–65535 arası tam sayı olmalı')
  }
  return port
}

export interface ReplayReceiverOptions {
  /** Varsayılan REPLAY_RECEIVER_PORT ya da 4300; 0 = işletim sisteminin seçtiği boş port. */
  port?: number
  /** Varsayılan 127.0.0.1: alıcı dışarıya açılmaz. */
  host?: string
  source: Scenario | Recording
  now?: () => number
  /** Varsayılan process.env.APP_ENV. */
  appEnv?: string
}

export interface ReplayReceiver {
  /** Örn. http://127.0.0.1:4300/data/aircraft.json */
  url: string
  close(): Promise<void>
}

type FrameSource = (nowMs: number) => ReadsbFrame | RecordedFrame

function frameSourceOf(source: Scenario | Recording, startedAt: number): FrameSource {
  if ('frameAt' in source) return (nowMs) => source.frameAt(nowMs)
  const player = recordingPlayer(source, startedAt)
  return (nowMs) => player.frameAt(nowMs)
}

function send(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  // HEAD isteğinde Node gövdeyi kendisi göndermez.
  res.end(body)
}

function respond(
  req: IncomingMessage,
  res: ServerResponse,
  frame: () => ReadsbFrame | RecordedFrame,
) {
  const path = new URL(req.url ?? '/', 'http://replay.invalid').pathname
  if (!REPLAY_PATHS.includes(path)) return send(res, 404, '{"error":"not_found"}')
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('allow', 'GET, HEAD')
    return send(res, 405, '{"error":"method_not_allowed"}')
  }
  let body: string
  try {
    body = JSON.stringify(frame())
  } catch {
    return send(res, 500, '{"error":"frame_failed"}')
  }
  send(res, 200, body)
}

export async function startReplayReceiver(opts: ReplayReceiverOptions): Promise<ReplayReceiver> {
  assertReplayAllowed(opts.appEnv ?? process.env.APP_ENV)
  const now = opts.now ?? (() => Date.now())
  const host = opts.host ?? DEFAULT_REPLAY_HOST
  const port = opts.port ?? replayPortFromEnv(process.env.REPLAY_RECEIVER_PORT)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new RangeError('replay alıcısı portu 0–65535 arası tam sayı olmalı')
  }
  const frameAt = frameSourceOf(opts.source, now())
  const server = createServer((req, res) => respond(req, res, () => frameAt(now())))
  await new Promise<void>((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      reject(
        new Error(
          `replay alıcısı ${host}:${port} adresini dinleyemedi (${error.code ?? error.message}); ` +
            'REPLAY_RECEIVER_PORT ile başka bir port seçilebilir',
          { cause: error },
        ),
      )
    }
    server.once('error', onError)
    server.listen(port, host, () => {
      server.off('error', onError)
      resolve()
    })
  })
  const bound = (server.address() as AddressInfo).port
  const urlHost = host.includes(':') ? `[${host}]` : host
  let closing: Promise<void> | null = null
  return {
    url: `http://${urlHost}:${bound}/data/aircraft.json`,
    close() {
      closing ??= new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
        // Açık keep-alive bağlantıları kapanışı bekletmesin.
        server.closeAllConnections()
      })
      return closing
    },
  }
}
