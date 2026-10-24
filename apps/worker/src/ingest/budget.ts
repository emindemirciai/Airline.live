import {
  ADSBLOL_BUDGET_WINDOW_MS,
  LIVE_TTL_MAX_SECONDS,
  LIVE_TTL_SECONDS,
  readAdsbLolBudget,
  recordAdsbLolRateLimit,
  recordAdsbLolServerLimit,
  reserveAdsbLolRequest,
  type AdsbLolBudgetView,
  type BudgetReservation,
} from '@havayolu/db'
import type { Redis } from 'ioredis'
import type { PlannedCircle } from './plan'

/**
 * adsb.lol günlük bütçe modu (D-122). adsb.lol IP başına günde 500 istek kabul eder; worker
 * `ADSBLOL_DAILY_BUDGET` (varsayılan 480) kadar isteği güne eşit yayar (~180 sn'de bir). Sayaç
 * redis-queue'dadır (`@havayolu/db` `reserveAdsbLolRequest`).
 *
 * - Sorgu planı: yalnız Batı ve Doğu çemberleri; sıra izin sırasına (`seq`) göre B B D. Batı (IST
 *   önceliği) Doğu'dan iki kat sık sorgulanır; Batı'nın iki sorgusu arası 1 ya da 2 slot (180 ya
 *   da 360 sn), Doğu'nunki 3 slot (540 sn). Sıra Redis'te tutulur, yeniden başlatmada sürer.
 * - Canlı kayıt ömrü: `3 · slot + 120 sn` yukarı dakikaya yuvarlanır (480 → 660 sn). Doğu'da iki
 *   sorgu arası 540 sn + örnek yaşı 60 sn = 600 sn; Batı'da 360 sn + kaçan bir slot 180 sn + 60 sn
 *   = 600 sn. Uçak iki sorgu arasında, Batı'da bir istek kaçsa bile kaybolmaz.
 * - Durum penceresi: 2 slot + 60 sn (480 → 420 sn).
 *
 * Saf yardımcılar burada; IO yapan tek parça `createRedisBudgetStore`'dur.
 */

const MINUTE_MS = 60_000
export const LIVE_TTL_MIN_MS = LIVE_TTL_SECONDS * 1000
export const LIVE_TTL_MAX_MS = LIVE_TTL_MAX_SECONDS * 1000
/** Durum penceresinin üst sınırı. */
export const BUDGET_STATUS_WINDOW_MAX_MS = 3_600_000
/** Bütçe modunda sağlayıcı olaylarının tutulduğu süre. */
export const BUDGET_STATUS_RETAIN_MS = 3_600_000
/** Bekleme başlığı sıfırlamasının üst sınırı (gün). */
export const RATE_LIMIT_RESET_MAX_MS = ADSBLOL_BUDGET_WINDOW_MS
/** Ardışık Doğu sorguları arası slot sayısı (B B D). */
export const BUDGET_EAST_EVERY = 3

/** Bütçe modunun sorgu planı: yalnız Batı ve Doğu (istasyon ve birincil çemberleri atlanır). */
export function budgetPlan(plan: readonly PlannedCircle[]): PlannedCircle[] {
  return plan.filter((c) => c.kind === 'west' || c.kind === 'east')
}

/**
 * İzin sırasına göre sorgulanacak çember: `seq % 3 === 0` Doğu, diğerleri Batı (B B D). Batı yoksa
 * Doğu, ikisi de yoksa null.
 */
export function budgetCircle(seq: number, plan: readonly PlannedCircle[]): PlannedCircle | null {
  const west = plan.find((c) => c.kind === 'west') ?? null
  const east = plan.find((c) => c.kind === 'east') ?? null
  if (west === null) return east
  if (east === null) return west
  return seq % BUDGET_EAST_EVERY === 0 ? east : west
}

/** Günlük sınırdan slot (iki izin arası, ms): ⌈24 sa / sınır⌉; 480 → 180 sn. */
export function budgetSlotMs(cap: number): number {
  if (!Number.isFinite(cap) || cap < 1) return ADSBLOL_BUDGET_WINDOW_MS
  return Math.ceil(ADSBLOL_BUDGET_WINDOW_MS / Math.floor(cap))
}

/** Canlı kayıt ömrü (ms): ⌈(3 · slot + 120 sn) / 60 sn⌉ dakika, 120–1800 sn arası; 180 sn → 660 sn. */
export function liveTtlMsForSlot(slotMs: number): number {
  const raw = MINUTE_MS * Math.ceil((3 * slotMs + 120_000) / MINUTE_MS)
  return Math.min(LIVE_TTL_MAX_MS, Math.max(LIVE_TTL_MIN_MS, raw))
}

/** Durum penceresi (ms): min(1 sa, 2 · slot + 60 sn); 180 sn → 420 sn. */
export function budgetStatusWindowMs(slotMs: number): number {
  return Math.min(BUDGET_STATUS_WINDOW_MAX_MS, 2 * slotMs + MINUTE_MS)
}

/**
 * 429 ya da tükenmek üzere kota sonrası bekleme (ms): Retry-After ve sıfırlama başlığının (en
 * fazla 24 sa) büyüğü, ama en az 2 slot. Başlık yoksa 2 slot. Kısa bir başlık beklemeyi 2 slotun
 * altına indirmez; uzun sıfırlama (günlük kota bitti) olduğu gibi uygulanır.
 */
export function rateLimitWaitMs(input: {
  retryAfterSec: number | null
  resetS: number | null
  slotMs: number
}): number {
  const floor = 2 * input.slotMs
  const candidates = [floor]
  if (input.retryAfterSec !== null && Number.isFinite(input.retryAfterSec)) {
    candidates.push(Math.max(0, input.retryAfterSec) * 1000)
  }
  if (input.resetS !== null && Number.isFinite(input.resetS)) {
    candidates.push(Math.min(RATE_LIMIT_RESET_MAX_MS, Math.max(0, input.resetS) * 1000))
  }
  return Math.ceil(Math.max(...candidates))
}

/** Bütçe sayacının deposu; üretimde redis-queue, testte bellek içi sahte (`test/budget-store.ts`). */
export interface BudgetStore {
  /** Bir istek izni ister (atomik). */
  reserve(now: number): Promise<BudgetReservation>
  /** 429 ya da tükenmek üzere kota: engel ve sınır daraltması. */
  rateLimited(now: number, waitMs: number): Promise<{ cap: number; blockedUntil: number }>
  /** Başlıklardan okunan günlük kota. */
  serverLimit(now: number, dailyQuota: number): Promise<void>
  /** Anlık görünüm (yalnız okur). */
  read(now: number): Promise<AdsbLolBudgetView>
}

export function createRedisBudgetStore(redisQueue: Redis, configured: number): BudgetStore {
  return {
    reserve: (now) => reserveAdsbLolRequest(redisQueue, { now, configured }),
    rateLimited: (now, waitMs) => recordAdsbLolRateLimit(redisQueue, { now, configured, waitMs }),
    serverLimit: (now, dailyQuota) => recordAdsbLolServerLimit(redisQueue, { now, dailyQuota }),
    read: (now) => readAdsbLolBudget(redisQueue, { now, configured }),
  }
}

/** Depo erişilemezse (Redis kesintisi) yeni deneme; o arada istek gönderilmez. */
export const BUDGET_STORE_RETRY_MS = 5_000
/** Reddin `retryAt`'i geçmişte kalsa da yerel bekleme en az bu kadardır (sıkı döngü olmasın). */
const MIN_LOCAL_WAIT_MS = 1_000

export type PacerStep =
  /** Bu süreç `untilMs`'e kadar izin istemez (yerel bekleme ya da deponun reddi). */
  | { kind: 'wait'; untilMs: number; decision: 'local' | BudgetReservation['decision'] }
  /** Depo erişilemedi: istek gönderilmez, `untilMs`'te yeniden denenir. */
  | { kind: 'error'; untilMs: number; error: unknown }
  | { kind: 'granted'; reservation: BudgetReservation }

/**
 * Bütçe döngüsünün izin adımı (D-122). Depo izin verene kadar istek gönderilmez; reddin
 * `retryAt`'ine kadar depo yeniden sorulmaz. 429'dan sonra `holdUntil` bu süreci depo yazılamasa
 * bile bekletir. Yeniden başlatılan süreç yerel durumu bilmez; aralık ve sert sınır depodadır.
 */
export class BudgetPacer {
  private nextAt = 0
  private lastReservation: BudgetReservation | null = null

  constructor(private readonly store: BudgetStore) {}

  /** Bu sürecin bir sonraki izin denemesinin en erken anı (ms). */
  nextAttemptAt(): number {
    return this.nextAt
  }

  /** Deponun son yanıtı (izin ya da ret); henüz yoksa null. */
  last(): BudgetReservation | null {
    return this.lastReservation
  }

  /** Bu süreç `until`'e kadar izin istemez (kısaltmaz, yalnız uzatır). */
  holdUntil(until: number): void {
    this.nextAt = Math.max(this.nextAt, until)
  }

  async step(now: number): Promise<PacerStep> {
    if (now < this.nextAt) return { kind: 'wait', untilMs: this.nextAt, decision: 'local' }
    let reservation: BudgetReservation
    try {
      reservation = await this.store.reserve(now)
    } catch (error) {
      this.nextAt = now + BUDGET_STORE_RETRY_MS
      return { kind: 'error', untilMs: this.nextAt, error }
    }
    this.lastReservation = reservation
    this.nextAt = Math.max(reservation.retryAt, now + MIN_LOCAL_WAIT_MS)
    if (!reservation.granted) {
      return { kind: 'wait', untilMs: this.nextAt, decision: reservation.decision }
    }
    return { kind: 'granted', reservation }
  }
}

/**
 * İstemcinin `beforeRequest`'i bütçe izni olmadan çağrıldı: istek gönderilmedi. Bir programlama
 * hatasıdır (izinsiz bir adsb.lol çağrı yolu); sağlayıcı sonucu sayılmaz.
 */
export class BudgetPermitError extends Error {
  constructor() {
    super('adsb.lol request without a budget permit was blocked')
    this.name = 'BudgetPermitError'
  }
}

/**
 * Tek kullanımlık izin sayacı: bütçe izni alınınca `grant()`, istemci isteği göndermeden önce
 * `consume()` (izin yoksa `BudgetPermitError`). Böylece izinsiz hiçbir adsb.lol isteği gitmez.
 */
export class BudgetPermit {
  private permits = 0

  grant(): void {
    this.permits = 1
  }

  revoke(): void {
    this.permits = 0
  }

  consume(): void {
    if (this.permits < 1) throw new BudgetPermitError()
    this.permits -= 1
  }
}
