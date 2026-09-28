import { readFileSync } from 'node:fs'
import type { ReadsbAircraft } from '../scenarios'
import { positiveMod } from '../scenarios/motion'

/**
 * Kayıtlı kareler: replay alıcısı bunları zamanı kaydırarak sunar (ilk kare alıcının açıldığı ana
 * denk gelir); en az iki farklı zamanlı kare varsa döngüyle. Kabul edilen dosya biçimleri:
 * - `{ "frames": [kare, …] }`, kare dizisi `[kare, …]`, tek kare ya da satır başına bir kare (JSON Lines)
 * - kare = readsb `aircraft.json` (`now` saniye, `aircraft`) ya da adsb.lol v2 yanıtı (`now` ms, `ac`)
 *
 * adsb.lol'de `dbFlags` alanının yokluğu 0 demektir; yerel alıcıda ise "bilinmiyor" (gizli sayılır,
 * D-071). Bu yüzden adsb.lol karelerinde eksik `dbFlags` 0 olarak yazılır, anlamı korunur.
 */

/** Kayıttan gelen uçak: readsb alanları olduğu gibi (konumsuz kayıtlar dahil); yalnızca hex zorunlu. */
export type RecordedAircraft = { hex: string } & Record<string, unknown>
export type ReplayAircraft = ReadsbAircraft | RecordedAircraft

export interface RecordedFrame {
  /** Ölçüm anı, epoch saniye. */
  now: number
  messages?: number
  aircraft: ReplayAircraft[]
}

export interface Recording {
  frames: RecordedFrame[]
}

export class RecordingFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecordingFormatError'
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Bütün metin tek JSON değeri değilse satır satır (JSON Lines) okunur. */
function jsonValues(text: string): { values: unknown[]; lines: boolean } {
  try {
    return { values: [JSON.parse(text)], lines: false }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
  }
  const values: unknown[] = []
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue
    try {
      values.push(JSON.parse(line))
    } catch {
      throw new RecordingFormatError(`${index + 1}. satır JSON değil`)
    }
  }
  return { values, lines: true }
}

function normalizeFrame(raw: unknown, index: number): RecordedFrame {
  const label = `${index + 1}. kare`
  if (!isObject(raw)) throw new RecordingFormatError(`${label} nesne değil`)
  const { now } = raw
  if (typeof now !== 'number' || !Number.isFinite(now) || now <= 0) {
    throw new RecordingFormatError(`${label}: now alanı yok ya da geçersiz`)
  }
  const fromAdsbLol = raw.aircraft === undefined && Array.isArray(raw.ac)
  const list = fromAdsbLol ? raw.ac : raw.aircraft
  if (!Array.isArray(list))
    throw new RecordingFormatError(`${label}: aircraft (ya da ac) dizisi yok`)
  const aircraft = list.map((item: unknown, i): RecordedAircraft => {
    if (!isObject(item) || typeof item.hex !== 'string') {
      throw new RecordingFormatError(`${label}, ${i + 1}. uçak: hex alanı yok`)
    }
    const hex = item.hex
    return fromAdsbLol && item.dbFlags === undefined
      ? { ...item, hex, dbFlags: 0 }
      : { ...item, hex }
  })
  return {
    // adsb.lol `now` ms, readsb saniyedir (data-sources.md: now > 1e12 ise ms).
    now: now > 1e12 ? now / 1000 : now,
    ...(typeof raw.messages === 'number' ? { messages: raw.messages } : {}),
    aircraft,
  }
}

/** Kayıt metnini ayrıştırır; kareler zamana göre sıralanır. */
export function parseRecording(text: string): Recording {
  if (!text.trim()) throw new RecordingFormatError('kayıt boş')
  const { values, lines } = jsonValues(text)
  const [single] = values
  const rawFrames = lines
    ? values
    : Array.isArray(single)
      ? single
      : isObject(single) && Array.isArray(single.frames)
        ? single.frames
        : [single]
  const frames = rawFrames.map((raw: unknown, index) => normalizeFrame(raw, index))
  if (frames.length === 0) throw new RecordingFormatError('kayıtta kare yok')
  return { frames: frames.sort((a, b) => a.now - b.now) }
}

export function loadRecording(path: string): Recording {
  const text = readFileSync(path, 'utf8')
  try {
    return parseRecording(text)
  } catch (error) {
    if (error instanceof RecordingFormatError) {
      throw new RecordingFormatError(`${path}: ${error.message}`)
    }
    throw error
  }
}

export interface RecordingPlayer {
  /**
   * Bir döngünün süresi: son karenin göreli zamanı + tipik kare aralığı (medyan). Kayıtta iki
   * farklı zamanlı kare yoksa (tek kare) döngü kurulmaz ve değer `null` olur.
   */
  durationMs: number | null
  frameAt(nowMs: number): RecordedFrame
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const roundMs = (seconds: number) => Math.round(seconds * 1000) / 1000

/**
 * Karedeki uçakları `lagS` saniye yaşlandırır: `seen_pos` ve `seen` bu kadar artar. İkisi de
 * yoksa ayrıştırıcı konumu kare anında ölçülmüş sayar; yaş `seen` olarak eklenir ki aynı konum
 * her okumada yeni örnek gibi görünmesin.
 */
function agedAircraft(aircraft: readonly ReplayAircraft[], lagS: number): ReplayAircraft[] {
  if (lagS <= 0) return [...aircraft]
  return aircraft.map((a): RecordedAircraft => {
    const seenPos: unknown = a.seen_pos
    const seen: unknown = a.seen
    const hasSeenPos = isFiniteNumber(seenPos)
    const hasSeen = isFiniteNumber(seen)
    if (!hasSeenPos && !hasSeen) return { ...a, seen: roundMs(lagS) }
    return {
      ...a,
      ...(hasSeenPos ? { seen_pos: roundMs(seenPos + lagS) } : {}),
      ...(hasSeen ? { seen: roundMs(seen + lagS) } : {}),
    }
  })
}

/**
 * Kaydı `startedAt`'ten başlayarak oynatır. `now` sunulduğu anın saatidir (ayrıştırıcı 60 sn'den
 * fazla kayan yanıtı reddeder, D-073). Kare sunuldukça `seen_pos` ve `seen` geçen süre kadar artar:
 * aynı kare tekrar okunduğunda örnek zamanı değişmez, aynı konum yeni bir örnek gibi görünmez.
 *
 * - En az iki farklı zamanlı kare varsa kayıt döngüyle sunulur; her kare kendi zaman diliminde.
 * - Tek kare (ya da hepsi aynı anda) döngüye alınmaz: bir döngü adımı uydurulursa donmuş uçaklar
 *   her adımda taze örnek üretirdi. Kare, donmuş bir alıcı gibi, yaşı alıcının açılışından beri
 *   geçen süre kadar artarak sunulur; uçaklar 60 sn içinde bayatlar ve ayrıştırıcıdan geçmez.
 */
export function recordingPlayer(recording: Recording, startedAt: number): RecordingPlayer {
  if (recording.frames.length === 0) throw new RecordingFormatError('kayıtta kare yok')
  const frames = [...recording.frames].sort((a, b) => a.now - b.now)
  const first = frames[0]!.now
  const offsets = frames.map((frame) => Math.round((frame.now - first) * 1000))
  const steps = offsets
    .slice(1)
    .map((offset, i) => offset - offsets[i]!)
    .filter((step) => step > 0)
    .sort((a, b) => a - b)
  const step = steps[Math.floor(steps.length / 2)]
  const durationMs = step === undefined ? null : offsets[offsets.length - 1]! + step

  const serve = (frame: RecordedFrame, nowMs: number, lagMs: number): RecordedFrame => ({
    now: nowMs / 1000,
    ...(frame.messages === undefined ? {} : { messages: frame.messages }),
    aircraft: agedAircraft(frame.aircraft, lagMs / 1000),
  })

  if (durationMs === null) {
    // Aynı anlı kareler arasında sonuncusu (sıralama kararlıdır) sunulur.
    const last = frames[frames.length - 1]!
    return {
      durationMs,
      frameAt: (nowMs) => serve(last, nowMs, Math.max(0, nowMs - startedAt)),
    }
  }

  return {
    durationMs,
    frameAt(nowMs) {
      const elapsed = positiveMod(nowMs - startedAt, durationMs)
      // Göreli zamanı elapsed'i aşmayan son kare (ikili arama).
      let lo = 0
      let hi = offsets.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (offsets[mid]! <= elapsed) lo = mid
        else hi = mid - 1
      }
      return serve(frames[lo]!, nowMs, elapsed - offsets[lo]!)
    },
  }
}
