import {
  endFlights,
  insertTrackPoints,
  touchFlights,
  TRACK_INSERT_CHUNK,
  type Database,
  type FlightTouch,
  type TrackPointRow,
} from '@havayolu/db'
import type { Logger } from 'pino'

/**
 * İz ve uçuş kaydı yazıcısı (D-073: yazma 1,5 sn'de bir, `ON CONFLICT DO NOTHING`). Döngüler
 * satırları tampona ekler; `flush` sırasıyla kapanan uçuşları, son görülme güncellemelerini
 * (kimlik başına en yenisi), 30 sn'lik izi ve ince izi yazar. İz satırları
 * `TRACK_INSERT_CHUNK`'lık partilerle gider.
 * - Geçici veritabanı hatasında (bağlantı, zaman aşımı, kilitlenme, sunucu kapanışı) yazılamayan
 *   kısım tamponun başına döner, bir sonraki `flush` yeniden dener (yazmalar idempotenttir: kapanan
 *   kayda ikinci kapanış dokunmaz, `last_seen_at` yalnızca ileri gider, iz noktası ikinci kez
 *   yazılmaz). Uyarı dakikada en fazla bir kez yazılır (arada kaç hata olduğu sayılır); uyarı
 *   verilmiş bir kesintiden sonraki ilk başarılı yazma tek bir `info` satırı yazar.
 * - Veri hatası (`isDataError`: aynı girdi her denemede yine reddedilir) yeniden denenmez: hatalı
 *   parti ikiye bölünerek tek satıra kadar daraltılır, reddedilen satır ya da güncelleme atılır ve
 *   sayılır (uyarı dakikada en fazla bir kez), gerisi yazılır. Böylece tek bozuk satır bütün
 *   yazmayı tıkamaz.
 * - Tampon `maxBuffered` iz satırını aşarsa en eski satırlar atılır ve sayılır (uyarı dakikada en
 *   fazla bir kez).
 * - İki `flush` hiçbir zaman aynı anda çalışmaz; çalışan varken gelen çağrı onun ardından tek bir
 *   ek turda birleşir.
 */

type Sql = Database['sql']
type Step = 'ended' | 'touched' | 'sampled' | 'fine'

export const WRITER_MAX_BUFFERED = 50_000
/** Tekrarlayan yazıcı uyarılarının en sık aralığı (D-073: tür başına dakikada bir). */
export const WRITER_WARN_INTERVAL_MS = 60_000

/** SQLSTATE sınıfı 22 (veri istisnası) ya da 23 (bütünlük kısıtı). */
const DATA_SQLSTATE = /^2[23][0-9A-Z]{3}$/

/**
 * Aynı girdiyle her denemede yine başarısız olacak hata mı: SQLSTATE sınıfı 22 ya da 23, ya da
 * istek gönderilmeden girdiden doğan `RangeError` (ör. geçersiz tarih). Bağlantı ve ağ hataları,
 * zaman aşımı, serileştirme/kilitlenme (40xxx), kilit (55P03) ve yönetici kapanışı (57P01) geçicidir.
 */
export function isDataError(error: unknown): boolean {
  if (error instanceof RangeError) return true
  if (typeof error !== 'object' || error === null) return false
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && DATA_SQLSTATE.test(code)
}

export interface FlushResult {
  sampled: number
  fine: number
  touched: number
  ended: number
}

export interface TrackWriterOptions {
  /** İz tamponlarının (30 sn'lik + ince) toplam üst sınırı. */
  maxBuffered?: number
  /** Uyarı aralığı için saat; varsayılan `Date.now`. */
  now?: () => number
}

const EMPTY_RESULT: FlushResult = { sampled: 0, fine: 0, touched: 0, ended: 0 }

/** Aynı kaydın iki güncellemesi: en yeni son görülme, dolu alanlarda yeni değer önce gelir. */
function mergeTouch(older: FlightTouch, newer: FlightTouch): FlightTouch {
  const newest = newer.lastSeenAt.getTime() >= older.lastSeenAt.getTime() ? newer : older
  const other = newest === newer ? older : newer
  return {
    id: newest.id,
    lastSeenAt: newest.lastSeenAt,
    callsign: newest.callsign ?? other.callsign,
    registration: newest.registration ?? other.registration,
    typeCode: newest.typeCode ?? other.typeCode,
  }
}

/**
 * Aralıklı uyarı: olaylar sayılır; son uyarıdan bu yana aralık dolduysa (ya da hiç uyarı
 * verilmediyse) o ana kadarki sayı döner ve sayaç sıfırlanır, dolmadıysa null döner.
 */
class WarnThrottle {
  private readonly intervalMs: number
  private lastAt: number | null = null
  private pending = 0

  constructor(intervalMs: number) {
    this.intervalMs = intervalMs
  }

  hit(now: number, count = 1): number | null {
    this.pending += count
    if (this.lastAt !== null && now - this.lastAt < this.intervalMs) return null
    this.lastAt = now
    const total = this.pending
    this.pending = 0
    return total
  }
}

/** Bir adımın sonucu: geçici hatada yazılamayan öğeler (reddedilenler hariç) geri döner. */
type StepOutcome<T> =
  | { written: number; failed: false }
  | { written: number; failed: true; error: unknown; remaining: T[] }

/** Yeniden denenecek öğeler (adım sırasıyla). */
interface Pending {
  ended: readonly number[]
  touches: readonly FlightTouch[]
  sampled: TrackPointRow[]
  fine: TrackPointRow[]
}

export class TrackWriter {
  private readonly sql: Sql
  private readonly log: Logger
  private readonly maxBuffered: number
  private readonly now: () => number
  private sampled: TrackPointRow[] = []
  private fine: TrackPointRow[] = []
  private touches = new Map<number, FlightTouch>()
  private ended = new Set<number>()
  private running: Promise<FlushResult> | null = null
  private queued: Promise<FlushResult> | null = null
  private droppedRows = 0
  private rejectedItems = 0
  private failures = 0
  /** Süren hata dizisi için uyarı yazıldı mı (düzelince `info` yalnızca o zaman yazılır). */
  private failureWarned = false
  private readonly dropWarn = new WarnThrottle(WRITER_WARN_INTERVAL_MS)
  private readonly failWarn = new WarnThrottle(WRITER_WARN_INTERVAL_MS)
  private readonly rejectWarn = new WarnThrottle(WRITER_WARN_INTERVAL_MS)

  constructor(sql: Sql, log: Logger, opts: TrackWriterOptions = {}) {
    this.sql = sql
    this.log = log
    this.maxBuffered = opts.maxBuffered ?? WRITER_MAX_BUFFERED
    this.now = opts.now ?? (() => Date.now())
    if (!Number.isInteger(this.maxBuffered) || this.maxBuffered < 1) {
      throw new RangeError(`Yazıcı tampon sınırı geçersiz: ${this.maxBuffered}`)
    }
  }

  addSampled(row: TrackPointRow): void {
    this.sampled.push(row)
    this.enforceLimit()
  }

  addFine(row: TrackPointRow): void {
    this.fine.push(row)
    this.enforceLimit()
  }

  touch(t: FlightTouch): void {
    const previous = this.touches.get(t.id)
    this.touches.set(t.id, previous ? mergeTouch(previous, t) : t)
  }

  end(id: number): void {
    this.ended.add(id)
  }

  /** Tampondaki iz satırları (30 sn'lik + ince). */
  buffered(): number {
    return this.sampled.length + this.fine.length
  }

  /** Tampon sınırı yüzünden atılan satırların toplamı. */
  dropped(): number {
    return this.droppedRows
  }

  /** Veritabanının veri hatasıyla reddettiği için atılan satır ve güncellemelerin toplamı. */
  rejected(): number {
    return this.rejectedItems
  }

  /** Üst üste başarısız `flush` sayısı. */
  consecutiveFailures(): number {
    return this.failures
  }

  flush(): Promise<FlushResult> {
    if (this.queued) return this.queued
    if (this.running) {
      const queued = this.running.then(() => {
        this.queued = null
        return this.start()
      })
      this.queued = queued
      return queued
    }
    return this.start()
  }

  private start(): Promise<FlushResult> {
    const run = this.write().finally(() => {
      if (this.running === run) this.running = null
    })
    this.running = run
    return run
  }

  /** Tamponları alır ve sırayla yazar; geçici hatada yazılamayan kısım tamponun başına döner. */
  private async write(): Promise<FlushResult> {
    const ended = [...this.ended]
    const touches = [...this.touches.values()]
    const sampled = this.sampled
    const fine = this.fine
    this.ended = new Set()
    this.touches = new Map()
    this.sampled = []
    this.fine = []
    if (ended.length + touches.length + sampled.length + fine.length === 0) {
      return { ...EMPTY_RESULT }
    }

    const result: FlushResult = { ...EMPTY_RESULT }
    const endedOut = await this.writeStep('ended', ended, ended.length, async (part) => {
      await endFlights(this.sql, part)
      return part.length
    })
    result.ended = endedOut.written
    if (endedOut.failed) {
      const pending = { ended: endedOut.remaining, touches, sampled, fine }
      return this.failed(result, 'ended', endedOut.error, pending)
    }

    const touchedOut = await this.writeStep('touched', touches, touches.length, async (part) => {
      await touchFlights(this.sql, part)
      return part.length
    })
    result.touched = touchedOut.written
    if (touchedOut.failed) {
      const pending = { ended: [], touches: touchedOut.remaining, sampled, fine }
      return this.failed(result, 'touched', touchedOut.error, pending)
    }

    const sampledOut = await this.writeStep('sampled', sampled, TRACK_INSERT_CHUNK, (part) =>
      insertTrackPoints(this.sql, 'track_points_sampled', part),
    )
    result.sampled = sampledOut.written
    if (sampledOut.failed) {
      const pending = { ended: [], touches: [], sampled: sampledOut.remaining, fine }
      return this.failed(result, 'sampled', sampledOut.error, pending)
    }

    const fineOut = await this.writeStep('fine', fine, TRACK_INSERT_CHUNK, (part) =>
      insertTrackPoints(this.sql, 'track_points_fine', part),
    )
    result.fine = fineOut.written
    if (fineOut.failed) {
      const pending = { ended: [], touches: [], sampled: [], fine: fineOut.remaining }
      return this.failed(result, 'fine', fineOut.error, pending)
    }

    if (this.failures > 0) {
      if (this.failureWarned) {
        this.log.info(
          { failures: this.failures, buffered: this.buffered() },
          'track writer recovered; buffered rows written',
        )
      }
      this.failures = 0
      this.failureWarned = false
    }
    return result
  }

  /**
   * Bir adımın öğelerini `size`'lık partilerle yazar. Geçici hata olursa durur ve yazılamayan
   * öğeleri (bu partinin henüz yazılmamış ve reddedilmemiş olanları + sonraki partiler) döndürür.
   */
  private async writeStep<T>(
    step: Step,
    items: readonly T[],
    size: number,
    write: (part: T[]) => Promise<number>,
  ): Promise<StepOutcome<T>> {
    const state = { written: 0, settled: new Set<T>() }
    const partSize = Math.max(1, size)
    for (let start = 0; start < items.length; start += partSize) {
      const part = items.slice(start, start + partSize)
      state.settled.clear()
      try {
        await this.isolate(step, part, write, state)
      } catch (error) {
        const remaining = [
          ...part.filter((item) => !state.settled.has(item)),
          ...items.slice(start + partSize),
        ]
        return { written: state.written, failed: true, error, remaining }
      }
    }
    return { written: state.written, failed: false }
  }

  /**
   * Partiyi yazar; veri hatasında ikiye bölüp her yarıyı ayrı dener, tek öğeye inince onu atar.
   * Yazılan ya da atılan öğeler `settled`'a girer. Geçici hata yukarı fırlatılır.
   */
  private async isolate<T>(
    step: Step,
    part: T[],
    write: (part: T[]) => Promise<number>,
    state: { written: number; settled: Set<T> },
  ): Promise<void> {
    try {
      state.written += await write(part)
      for (const item of part) state.settled.add(item)
    } catch (error) {
      if (!isDataError(error)) throw error
      if (part.length <= 1) {
        for (const item of part) state.settled.add(item)
        this.reject(step, part.length, error)
        return
      }
      const mid = Math.ceil(part.length / 2)
      await this.isolate(step, part.slice(0, mid), write, state)
      await this.isolate(step, part.slice(mid), write, state)
    }
  }

  /** Veri hatasıyla reddedilen öğeleri sayar; uyarı dakikada en fazla bir kez. */
  private reject(step: Step, count: number, error: unknown): void {
    this.rejectedItems += count
    const since = this.rejectWarn.hit(this.now(), count)
    if (since === null) return
    this.log.warn(
      { err: error, step, rejected: since, rejectedTotal: this.rejectedItems },
      'track writer dropped items rejected by the database as invalid',
    )
  }

  /** Geçici hata: yazılamayanları tampona geri koyar; uyarı dakikada en fazla bir kez. */
  private failed(result: FlushResult, step: Step, error: unknown, pending: Pending): FlushResult {
    this.failures += 1
    for (const id of pending.ended) this.ended.add(id)
    for (const t of pending.touches) {
      const newer = this.touches.get(t.id)
      this.touches.set(t.id, newer ? mergeTouch(t, newer) : t)
    }
    if (pending.sampled.length > 0) this.sampled = [...pending.sampled, ...this.sampled]
    if (pending.fine.length > 0) this.fine = [...pending.fine, ...this.fine]
    this.enforceLimit()
    const since = this.failWarn.hit(this.now())
    if (since !== null) {
      this.failureWarned = true
      this.log.warn(
        {
          err: error,
          step,
          buffered: this.buffered(),
          failures: this.failures,
          failuresSinceLastWarning: since,
        },
        'track writer flush failed; keeping buffers for retry',
      )
    }
    return result
  }

  /** Sınır aşılırsa iki tampondan zamanca en eski satırları atar. */
  private enforceLimit(): void {
    let excess = this.buffered() - this.maxBuffered
    if (excess <= 0) return
    let i = 0
    let j = 0
    const dropCount = excess
    while (excess > 0) {
      const a = this.sampled[i]
      const b = this.fine[j]
      if (a && (!b || a.ts.getTime() <= b.ts.getTime())) i += 1
      else j += 1
      excess -= 1
    }
    if (i > 0) this.sampled = this.sampled.slice(i)
    if (j > 0) this.fine = this.fine.slice(j)
    this.droppedRows += dropCount
    const since = this.dropWarn.hit(this.now(), dropCount)
    if (since !== null) {
      this.log.warn(
        { dropped: since, droppedTotal: this.droppedRows, max: this.maxBuffered },
        'track writer buffer full; dropped oldest rows',
      )
    }
  }
}
