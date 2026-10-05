import { pino, type Logger } from 'pino'

/**
 * Canlı araçların günlüğü: worker kodunun (ör. `startIngest`) pino satırları terminale kısa
 * satır olarak yazılır: `HH:MM:SSZ <düzey> <ileti> k=v …` (time, pid, hostname, level ve msg
 * dışındaki alanlar). Satırın tamamı maskelenir (CONTACT_EMAIL, ADSBLOL_API_KEY).
 */

export interface ToolLoggerOptions {
  level: string
  write: (line: string) => void
  redact: (s: string) => string
  /** Satır saati; verilmezse Date.now. */
  now?: () => number
}

const SKIPPED_KEYS = new Set(['time', 'pid', 'hostname', 'level', 'msg'])

function clock(ms: unknown): string {
  const date = new Date(typeof ms === 'number' ? ms : Date.now())
  return Number.isNaN(date.getTime()) ? '--:--:--Z' : `${date.toISOString().slice(11, 19)}Z`
}

function fieldValue(value: unknown): string {
  if (typeof value === 'string') return /^[^\s"=]+$/.test(value) ? value : JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value)
  }
  // pino'nun hata serileştiricisi { type, message, stack } yazar; yığın satırı uzatır, ileti yeter.
  if (typeof value === 'object' && 'message' in value && typeof value.message === 'string') {
    return JSON.stringify(value.message)
  }
  return JSON.stringify(value) ?? String(value)
}

/** Tek pino JSON satırını kısa biçime çevirir; JSON değilse satır olduğu gibi kalır. */
export function formatPinoLine(raw: string): string {
  let entry: unknown
  try {
    entry = JSON.parse(raw)
  } catch {
    return raw.trimEnd()
  }
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return raw.trimEnd()
  const record = entry as Record<string, unknown>
  const parts = [clock(record.time), String(record.level ?? '')]
  if (typeof record.msg === 'string' && record.msg) parts.push(record.msg)
  for (const [key, value] of Object.entries(record)) {
    if (SKIPPED_KEYS.has(key) || value === undefined) continue
    parts.push(`${key}=${fieldValue(value)}`)
  }
  return parts.join(' ')
}

export function createToolLogger(opts: ToolLoggerOptions): Logger {
  const now = opts.now ?? Date.now
  return pino(
    {
      level: opts.level,
      base: undefined,
      timestamp: () => `,"time":${now()}`,
      // Düzey sayı yerine adıyla yazılır (info, warn, …).
      formatters: { level: (label) => ({ level: label }) },
    },
    {
      write(chunk: string) {
        for (const raw of chunk.split('\n')) {
          if (raw.trim()) opts.write(opts.redact(formatPinoLine(raw)))
        }
      },
    },
  )
}
