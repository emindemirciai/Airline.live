import type { OutcomeKind } from './rate'

/**
 * Sağlayıcı durumu (data-sources.md §1 "Sağlayıcı durumu", D-073):
 * - `down`: pencerede (60 sn) başarılı yanıt yok ya da devre açık (401/403 dahil)
 * - `degraded`: pencerede (429/420 + 5xx) / bütün istekler > %20 ya da birincil istasyon
 *   tazeliği > hedef × 2
 * - `ok`: diğer durumlar
 * `down`, `degraded`'dan önce gelir. Saf modüldür: zaman her çağrıda dışarıdan verilir ve
 * azalmayan kabul edilir.
 */

export type ProviderStatus = 'ok' | 'degraded' | 'down'

/** Durum geçişinin nedeni; `provider_status_changes.reason`'a yazılır. */
export type ProviderStatusReason = 'circuit_open' | 'no_success' | 'error_ratio' | 'freshness'

export const STATUS_WINDOW_MS = 60_000
export const FRESHNESS_TARGET_PRIMARY_MS = 20_000
export const DEGRADED_ERROR_RATIO = 0.2
export const FRESHNESS_WINDOW_MS = 300_000

export interface OutcomeCounters {
  requests: number
  successes: number
  rateLimited: number
  serverErrors: number
  networkErrors: number
  /** Bozuk yanıt, kendi hatalı isteğimiz ve 401/403. */
  otherErrors: number
}

function emptyCounters(): OutcomeCounters {
  return {
    requests: 0,
    successes: 0,
    rateLimited: 0,
    serverErrors: 0,
    networkErrors: 0,
    otherErrors: 0,
  }
}

function addOutcome(c: OutcomeCounters, outcome: OutcomeKind): void {
  c.requests += 1
  switch (outcome) {
    case 'success':
      c.successes += 1
      return
    case 'rate_limit':
      c.rateLimited += 1
      return
    case 'server':
      c.serverErrors += 1
      return
    case 'network':
      c.networkErrors += 1
      return
    case 'response':
    case 'request':
    case 'config':
      c.otherErrors += 1
      return
  }
}

interface Timed<T> {
  at: number
  value: T
}

/** Zamana göre sıralı tutar; sıra dışı gelen kayıt yerine yerleştirilir. */
function insertSorted<T>(list: Timed<T>[], item: Timed<T>): void {
  let i = list.length
  while (i > 0 && (list[i - 1]?.at ?? -Infinity) > item.at) i -= 1
  list.splice(i, 0, item)
}

/** `at <= cutoff` olan baştaki kayıtları atar. */
function dropUntil<T>(list: Timed<T>[], cutoff: number): void {
  let n = 0
  while (n < list.length && (list[n]?.at ?? Infinity) <= cutoff) n += 1
  if (n > 0) list.splice(0, n)
}

export class ProviderStatusTracker {
  private readonly windowMs: number
  private readonly degradedErrorRatio: number
  private readonly freshnessTargetMs: number
  private readonly events: Timed<OutcomeKind>[] = []

  constructor(opts?: {
    windowMs?: number
    degradedErrorRatio?: number
    freshnessTargetMs?: number
  }) {
    this.windowMs = opts?.windowMs ?? STATUS_WINDOW_MS
    this.degradedErrorRatio = opts?.degradedErrorRatio ?? DEGRADED_ERROR_RATIO
    this.freshnessTargetMs = opts?.freshnessTargetMs ?? FRESHNESS_TARGET_PRIMARY_MS
    if (!(this.windowMs > 0) || !(this.freshnessTargetMs > 0) || !(this.degradedErrorRatio >= 0)) {
      throw new RangeError('Sağlayıcı durumu ayarları geçersiz')
    }
  }

  record(at: number, outcome: OutcomeKind): void {
    insertSorted(this.events, { at, value: outcome })
    dropUntil(this.events, at - this.windowMs)
  }

  /** Son `windowMs` içindeki (at > now − windowMs) istekler; hata oranı istek yoksa null. */
  counters(now: number): OutcomeCounters & { errorRatio: number | null } {
    dropUntil(this.events, now - this.windowMs)
    const c = emptyCounters()
    for (const e of this.events) addOutcome(c, e.value)
    const errorRatio = c.requests === 0 ? null : (c.rateLimited + c.serverErrors) / c.requests
    return { ...c, errorRatio }
  }

  status(
    now: number,
    ctx: { circuitOpen: boolean; primaryFreshnessMs: number | null },
  ): { status: ProviderStatus; reason: ProviderStatusReason | null } {
    const c = this.counters(now)
    if (ctx.circuitOpen) return { status: 'down', reason: 'circuit_open' }
    if (c.successes === 0) return { status: 'down', reason: 'no_success' }
    if (c.errorRatio !== null && c.errorRatio > this.degradedErrorRatio) {
      return { status: 'degraded', reason: 'error_ratio' }
    }
    if (ctx.primaryFreshnessMs !== null && ctx.primaryFreshnessMs > 2 * this.freshnessTargetMs) {
      return { status: 'degraded', reason: 'freshness' }
    }
    return { status: 'ok', reason: null }
  }
}

/**
 * Birincil istasyon tazeliğinin kayan pencere p95'i (D-073: saniyede bir örneklenir, p95 son
 * 5 dk üzerinden). En yakın sıra yöntemi: sıralı yaşların ⌈0,95·n⌉. elemanı.
 */
export class FreshnessTracker {
  private readonly windowMs: number
  private readonly samples: Timed<number>[] = []

  constructor(opts?: { windowMs?: number }) {
    this.windowMs = opts?.windowMs ?? FRESHNESS_WINDOW_MS
    if (!(this.windowMs > 0)) throw new RangeError('Tazelik penceresi geçersiz')
  }

  /** `ageMs` null ise (henüz veri yok) örnek alınmaz; saat kaymasından gelen negatif yaş 0 sayılır. */
  sample(now: number, ageMs: number | null): void {
    if (ageMs !== null && Number.isFinite(ageMs)) {
      insertSorted(this.samples, { at: now, value: Math.max(0, ageMs) })
    }
    dropUntil(this.samples, now - this.windowMs)
  }

  p95(now: number): number | null {
    dropUntil(this.samples, now - this.windowMs)
    if (this.samples.length === 0) return null
    const ages = this.samples.map((s) => s.value).sort((a, b) => a - b)
    // Tam sayı aritmetiği: 0,95 × n kayan nokta hatasıyla bir üst sıraya taşmasın.
    const rank = Math.ceil((95 * ages.length) / 100)
    return ages[rank - 1] ?? null
  }
}

/** `provider_health_hourly` için iki boşaltma arasında biriken sayaçlar. */
export class HourlyCounter {
  private current: OutcomeCounters = emptyCounters()

  add(outcome: OutcomeKind): void {
    addOutcome(this.current, outcome)
  }

  /** Biriken sayaçları döner ve sıfırlar. */
  take(): OutcomeCounters {
    const taken = this.current
    this.current = emptyCounters()
    return taken
  }
}
